/* Shared review-state and session-state rules from design §1.5.
 * The delivery list, the workbench (toolbar, conclusion line, exports) and the
 * review-record dropdown must all call these functions instead of re-deriving. */
(function () {
  'use strict';
  const P = window.CRPrototype = window.CRPrototype || {};
  P.status = P.status || {};

  // 'present' | 'unaddressable' | 'archived' | 'deleted'; the single session-state rule.
  P.status.sessionStateOf = function (session) {
    if (!session) return 'deleted';
    if (!String(session.sessionId || '').trim()) return 'unaddressable';
    if (session.formatStatus && session.formatStatus !== 'current' || ['error', 'migration-required'].includes(session.projections?.state)) return 'unavailable';
    return session.archived ? 'archived' : 'present';
  };

  P.status.sessionViewOf = function (session) {
    const state = P.status.sessionStateOf(session);
    if (state === 'deleted') return { state, text: '', title: '', suffix: '', tip: '' };
    const title = String(session.title || '').trim() || '未命名会话';
    if (state === 'archived') {
      return {
        state,
        title,
        suffix: '（会话已归档）',
        text: title + '（会话已归档）',
        tip: '该会话已归档，取消归档后查看',
      };
    }
    if (state === 'unavailable') return { state, title, suffix: '（会话不可用）', text: title + '（会话不可用）', tip: '该会话需要迁移或暂不可用，请先在会话列表处理' };
    return { state, text: title, title, suffix: '', tip: '' };
  };

  const codeReadDetail = {
    'changed-during-read': '读取时代码有改动，改完后重新审查',
    'shallow-history': '缺少与目标分支的共同历史，需要补全 Git 历史',
    'split-index': '仓库启用了 split index，v0 不支持',
  };

  const cappedCount = count => Number(count) > 99 ? '99+' : String(count);
  const withheldText = count => Number(count) >= 10
    ? `${cappedCount(count)} 条未通过校验`
    : `${count} 条结论未通过校验`;
  const fileFailedText = count => Number(count) > 99
    ? `${cappedCount(count)} 个文件失败`
    : `${count} 个文件审查失败`;
  const pendingText = count => `${cappedCount(count)} 个文件待审`;

  // Ordered by design §1.5: 代码读取不完整 > 审查失败 > 文件待审 > 结论证据未通过校验.
  P.status.reasonsOf = function (input) {
    const reasons = [];
    if (input.snapshotStatus && input.snapshotStatus !== 'complete') {
      reasons.push({ code: 'code-read', text: '代码读取不完整' });
    }
    if (input.runStatus === 'failed') {
      reasons.push({ code: 'run-failed', text: '审查失败' });
    } else if (Number(input.failedCount) > 0) {
      reasons.push({ code: 'file-failed', text: fileFailedText(input.failedCount), count: Number(input.failedCount) });
    }
    if (Number(input.pendingCount) > 0 && input.runStatus && input.runStatus !== 'failed') {
      reasons.push({ code: 'pending', text: pendingText(input.pendingCount), count: Number(input.pendingCount) });
    }
    if (Number(input.withheldCount) > 0) {
      reasons.push({ code: 'withheld', text: withheldText(input.withheldCount), count: Number(input.withheldCount) });
    }
    return reasons;
  };

  const detailOfReason = (reason, input) => {
    if (reason.code === 'code-read') return codeReadDetail[input.codeReadReason] || '读取时未能取得稳定代码，请重新审查';
    if (reason.code === 'run-failed') return '写明原因，点重试';
    if (reason.code === 'file-failed') return '模型出错或超时，点重试';
    if (reason.code === 'pending') return '点击“审查全部”审查剩余文件';
    if (reason.code === 'withheld') return '引用的代码与原文对不上，没有展示；可重新审查';
    return '';
  };

  P.status.reviewStateOf = function (input) {
    const active = Number(input.activeFindings) || 0;
    const highest = input.highestSeverity || null;
    const runStatus = input.runStatus || null;
    const findingsLabel = `发现 ${cappedCount(active)} 个问题`;
    const findingPill = active > 0
      ? { text: findingsLabel, tone: highest === 'P2' ? 'warn' : 'error' }
      : { text: '未发现问题', tone: 'success' };
    const base = { activeFindings: active, reasons: [], pills: [], toolbar: null, conclusion: null, exportText: '' };

    if (runStatus === 'queued' || runStatus === 'running') {
      return {
        ...base,
        kind: runStatus,
        pills: [{ text: '审查中', tone: 'idle' }],
        toolbar: { label: runStatus === 'queued' ? '排队中' : '审查中', action: 'cancel', tone: 'idle' },
        conclusion: { title: '正在审查', detail: '' },
        exportText: '—',
      };
    }

    const reasons = P.status.reasonsOf(input);
    // Only a succeeded run may ever enter the success branch; unknown or cancelled never does.
    const complete = reasons.length === 0 && input.complete === true && runStatus === 'succeeded';

    if (!runStatus && !reasons.length) {
      return {
        ...base,
        kind: 'pending',
        pills: [{ text: '待审', tone: 'idle' }],
        toolbar: { label: '审查全部', action: 'review-all', tone: 'idle' },
        conclusion: { title: '待审', detail: '点击“审查全部”开始审查' },
        exportText: '待审',
      };
    }

    if (complete) {
      return {
        ...base,
        kind: active > 0 ? 'findings' : 'zero',
        pills: [findingPill],
        toolbar: null,
        conclusion: { title: active > 0 ? findingsLabel : '未发现问题', detail: '' },
        exportText: active > 0 ? `发现 ${active} 个问题` : '未发现问题',
      };
    }

    if (!reasons.length) {
      if (runStatus === 'cancelled') {
        return {
          ...base,
          kind: 'pending',
          pills: [{ text: '待审', tone: 'idle' }],
          toolbar: { label: '重新审查', action: 'review-all', tone: 'idle' },
          conclusion: { title: '待审', detail: '点重新审查开始' },
          exportText: '待审',
        };
      }
      return {
        ...base,
        kind: 'pending',
        pills: [{ text: '待审', tone: 'idle' }],
        toolbar: { label: '审查全部', action: 'review-all', tone: 'idle' },
        conclusion: { title: '待审', detail: '点击“审查全部”开始审查' },
        exportText: '待审',
      };
    }

    let kind;
    let pills;
    let reasonPill;
    if (reasons.length > 1) {
      kind = 'multiple';
      reasonPill = { text: `${reasons.length} 项待处理`, tone: 'idle' };
    } else {
      const reason = reasons[0];
      kind = reason.code;
      reasonPill = { text: reason.text, tone: 'idle' };
    }
    pills = active > 0 ? [findingPill, reasonPill] : [reasonPill];

    const toolbar = (() => {
      if (runStatus === 'cancelled') return { label: '重新审查', action: 'review-all', tone: 'idle' };
      if (reasons.some(reason => reason.code === 'run-failed' || reason.code === 'file-failed')) {
        return { label: '重试', action: 'review-all', tone: 'error' };
      }
      if (reasons.some(reason => reason.code === 'pending')) {
        return { label: '审查全部', action: 'review-all', tone: 'idle' };
      }
      return { label: reasons[0].text, action: 'reasons', tone: 'idle' };
    })();

    const single = reasons.length === 1 ? reasons[0] : null;
    const detailOf = reason => detailOfReason(reason, input);
    const conclusion = single
      ? {
        title: active > 0 ? `${findingsLabel} · ${single.text}` : single.text,
        detail: detailOf(single),
      }
      : {
        title: active > 0 ? `${findingsLabel} · ${reasons.length} 项待处理` : `${reasons.length} 项待处理`,
        detail: '',
        lines: reasons.map(reason => `${reason.text}：${detailOf(reason)}`),
      };

    const exportReasons = reasons.map(reason => reason.text).join('；');
    const exportText = active > 0
      ? (reasons.length === 1 && reasons[0].code === 'run-failed' ? `发现 ${active} 个问题；审查失败` : `发现 ${active} 个问题；不完整（${exportReasons}）`)
      : (reasons.length === 1 && reasons[0].code === 'run-failed' ? '审查失败' : `不完整（${exportReasons}）`);

    return { ...base, kind, reasons, pills, toolbar, conclusion, exportText };
  };

  const shortSha = sha => String(sha || '').slice(0, 7);

  // Range wording shared by the workbench header, the draft source and both exports.
  P.status.rangeTextOf = function ({ delivery, snapshot } = {}) {
    const range = snapshot?.range || {};
    const target = range.targetRef || '';
    const branch = delivery?.branch || '';
    if (!target || target.startsWith('(')) return '未提交的改动';
    if (branch && branch === target) return '未提交的改动';
    return `相比 ${target} 的改动`;
  };

  P.status.rangeTipOf = function ({ delivery, snapshot } = {}) {
    const range = snapshot?.range || {};
    const baseShort = shortSha(range.baseSha) || '—';
    const subject = String(range.baseSubject || '').trim();
    const fork = subject ? `分叉处的提交：「${subject}」（${baseShort}）` : `分叉处的提交：${baseShort}`;
    const dirty = range.dirty ? '含未提交改动' : '不含未提交改动';
    return `${fork} · ${dirty}`;
  };

  P.status.basedCommitOf = function (snapshot) {
    const range = snapshot?.range || {};
    const short = shortSha(range.headSha || range.baseSha) || '—';
    const subject = String(range.headSubject || '').trim();
    const value = subject ? `提交「${subject}」（${short}）` : short;
    return range.dirty ? `${value} · 含未提交改动` : value;
  };

  // Dropdown second line: HEAD equal to the fork point means only uncommitted changes exist.
  P.status.codeSourceOf = function (snapshot) {
    const range = snapshot?.range || {};
    const short = shortSha(range.headSha || range.baseSha) || '—';
    if (!range.headSha || !range.baseSha || range.headSha === range.baseSha) return '未提交的改动';
    const subject = String(range.headSubject || '').trim();
    const head = subject ? `提交「${subject}」` : `提交 ${short}`;
    return range.dirty ? `${head}+ 未提交改动` : head;
  };

  P.status.recordHoverOf = function (snapshot) {
    const range = snapshot?.range || {};
    const short = shortSha(range.headSha || range.baseSha) || '—';
    const subject = String(range.headSubject || '').trim();
    const dirty = range.dirty ? ' · 含未提交改动' : '';
    return subject ? `${subject} · ${short}${dirty}` : `${short}${dirty}`;
  };
})();
