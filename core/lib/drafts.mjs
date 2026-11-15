import { activeFindings, exportData, locationLabel, redactText } from './export.mjs';
import { developmentSession } from './deliveries.mjs';
import { sha256 } from './common.mjs';
import { uuid } from './store.mjs';

export class Drafts {
  constructor(adapter, { maxCodePoints = 12000, patterns = [] } = {}) { this.adapter = adapter; this.max = maxCodePoints; this.patterns = patterns; this.locks = new Map(); }
  async target(delivery) {
    for (const id of [...delivery.sessionIds].reverse()) {
      const direct = await this.adapter.session(id);
      if (!direct) return { id, session: null };
      if (direct.kind === 'review') continue;
      const session = await developmentSession(this.adapter, id);
      return { id: session?.id || id, session };
    }
    return null;
  }
  async lock(context, template, { skillName = '____' } = {}) {
    if (!['issues', 'understanding'].includes(template)) throw Error('Unknown draft template');
    const target = await this.target(context.delivery); if (!target) return { available: false, reason: '没有关联开发会话' };
    const data = exportData(context, { patterns: this.patterns }), run = data.run;
    if (!run) return { available: false, reason: '先完成审查' };
    const groups = [], footer = `交付：${data.delivery.title}\n审查时间：${run.endedAt || data.snapshot.createdAt}`;
    if (template === 'issues') {
      const suppressed = new Set(data.marks.filter(m => m.suppressed).map(m => m.findingId)), linked = new Set();
      const annotations = data.annotations.map(a => {
        const finding = run.findings?.find(f => f.findingId === a.findingId) ?? data.associatedFindings?.find(f => f.findingId === a.findingId); if (finding) linked.add(finding.findingId);
        return { id: a.annotationId, text: `${locationLabel(a.anchor)}\n${a.text}${finding ? '\n关联问题：' + finding.title + (suppressed.has(finding.findingId) ? '（原问题已标记为非问题）' : '') : ''}` };
      });
      const rank = { P0: 0, P1: 1, P2: 2 };
      const findings = activeFindings(run, data.marks).filter(f => !linked.has(f.findingId)).sort((a, b) => rank[a.severity] - rank[b.severity]).map(f => ({ id: f.findingId, text: `${f.severity} ${f.title} · ${locationLabel(f.anchor)}\n${f.problem}${f.suggestion ? '\n建议：' + f.suggestion.text + (f.suggestion.code ? '\n' + f.suggestion.code : '') : ''}` }));
      const sources = new Map(data.snapshot.requirements.flatMap(s => s.items.map(i => [i.itemId, i.text ?? Array.from(s.text).slice(i.start, i.end).join('')])));
      const alignment = (run.understanding?.alignment ?? []).filter(r => !['implemented', 'superseded'].includes(r.status)).map(r => ({ id: r.requirementItemId, text: `${sources.get(r.requirementItemId) ?? r.requirementItemId}\n${r.status}：${r.note}\n${r.codeRefs.length ? r.codeRefs.map(x => `${x.path}:${x.startLine}–${x.endLine}（${x.side}）`).join('、') : '无代码定位'}` }));
      groups.push(['批注', annotations], ['待处理问题', findings], ['未对齐 / 待确认', alignment]);
      if (groups.every(([, items]) => !items.length)) return { available: false, reason: '没有待发回内容' };
    } else {
      const u = run.understanding;
      if (!u || !(u.features.length || u.files.some(f => f.semantic.items.length) || u.impacts.length)) return { available: false, reason: '先完成审查，尚无通过校验的说明' };
      const safeSkill = Array.from(redactText(skillName, this.patterns).replace(/[\r\n]/g, ' ')).slice(0, 120).join('');
      const range = data.snapshot.range;
      groups.push(['补充说明', [{ id: 'source', text: `${footer}\n范围：${range.targetRef} merge-base ↔ 工作树\n基于提交：${range.headSubject || '提交'}（${(range.headSha || '').slice(0, 8)}）${range.dirty ? '，含未提交改动' : ''}\n请用本地Skill「${safeSkill}」增强以下说明。以所附说明为输入，资料不足请指出；不改写审查结论；本任务不修改业务代码。\n交付目标：${u.overview.purpose}` },
        ...u.features.map(f => ({ id: f.featureId, text: `${f.title}：${f.approach}\n文件：${f.files.join('、')}\n引用：${f.refs.map(r => `${r.path}:${r.startLine}–${r.endLine}（${r.side}）`).join('、')}` })),
        { id: 'coverage', text: `已审查${run.coverage.reviewed.length}个文件；未通过校验${run.coverage.withheld.length}条；失败${run.coverage.failed.length}个文件。` }]]);
    }
    const omitted = [];
    const render = () => groups.filter(([, items]) => items.length).map(([title, items]) => `## ${title}（${items.length}）\n` + items.map(i => i.text).join('\n\n')).join('\n\n') + '\n\n' + footer + (omitted.length ? '\n\n省略清单：' + omitted.slice(0, 20).join('、') + (omitted.length > 20 ? `等${omitted.length}项` : '') : '');
    let text = render();
    while (Array.from(text).length > this.max) {
      const group = [...groups].reverse().find(([, items]) => items.length); if (!group) throw Error('Draft metadata exceeds length limit');
      omitted.push(group[1].pop().id); text = render();
    }
    const token = uuid('draft'), row = { token, available: true, projectKey: context.snapshot.projectKey, snapshotId: context.snapshot.snapshotId, targetId: target.id, template, text, hash: sha256(text), omitted };
    this.locks.set(token, structuredClone(row)); return structuredClone(row);
  }
  async commit(token, { displayedSnapshotId, choice = 'auto' } = {}) {
    if (!['auto', 'append', 'copy'].includes(choice)) throw Error('Invalid draft choice');
    const locked = this.locks.get(token); if (!locked) throw Error('Unknown draft lock');
    const copy = async reason => { try { await this.adapter.copy(locked.text); return { status: 'copied', reason, text: locked.text }; } catch { return { status: 'failed', reason: '剪贴板不可用', text: locked.text }; } };
    if (choice === 'copy') return copy('用户选择复制');
    if (displayedSnapshotId !== locked.snapshotId) return copy('当前显示的审查记录已改变');
    const target = await this.adapter.session(locked.targetId);
    if (!target) return copy('关联会话已删除');
    if (target.archived) return copy('关联会话已归档');
    if (target.kind === 'review' || target.projectKey !== locked.projectKey) return copy('目标会话不属于本仓库开发会话');
    try {
      const draft = await this.adapter.getDraft(locked.targetId);
      if (draft.text.includes(locked.text)) return { status: 'unchanged', reason: '相同内容已在草稿中', text: locked.text };
      const existing = Boolean(draft.text || draft.quotes?.length || draft.attachments?.length);
      if (existing && choice !== 'append') return { status: 'preview', choices: ['append', 'copy'], text: locked.text, existingDraft: draft };
      const text = draft.text ? draft.text + '\n\n' + locked.text : locked.text;
      if (!await this.adapter.writeDraft(locked.targetId, text, { expectedRevision: draft.revision, preserveQuotesAndAttachments: true })) return copy('输入框草稿已改变');
      return { status: 'written', targetId: locked.targetId, text: locked.text };
    } catch { return copy('宿主无法写入草稿'); }
  }
}
