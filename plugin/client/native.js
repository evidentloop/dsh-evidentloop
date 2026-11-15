export class NativeClient {
  constructor(ctx) { this.ctx = ctx; }
  workspaceState() { return this.ctx.get('uiWorkspace').workspaces.list.getSnapshot(); }
  sessionId() { return this.ctx.get('uiSession').current.getSnapshot()?.key || null; }
  workspaceId() {
    const w = this.ctx.get('uiWorkspace'), selection = w.selection?.getSnapshot?.();
    return selection?.workspaceId || this.workspaceState().items.find(x => x.sessionIds.includes(this.sessionId()))?.workspaceId || null;
  }
  subscribe(callback) {
    const w = this.ctx.get('uiWorkspace'), services = [w.workspaces.list, w.selection, this.ctx.get('uiSession').current];
    const disposers = services.filter(x => x?.subscribe).map(x => x.subscribe(callback));
    return () => disposers.forEach(off => { if (typeof off === 'function') off(); });
  }
  async selectWorkspace(id) { await this.ctx.get('uiWorkspace').openWorkspace(id); this.ctx.layout.selectPanel('dsh-evidentloop'); }
  async openSession(id) { await this.ctx.get('uiWorkspace').openSession(id); }
  showPanel() { this.ctx.layout.selectPanel('dsh-evidentloop'); }
  async input(id, action, expiresAt) {
    const sessions = this.ctx.get('uiSession').sessions, lease = sessions.retain(id, { source: 'dsh-evidentloop' });
    let timer;
    try { await Promise.race([lease.ready, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('会话输入框加载超时')), Math.max(0, expiresAt - Date.now())); })]);
      if (Date.now() >= expiresAt) throw Error('操作已过期，未修改草稿'); const binding = sessions.binding(id); if (!binding) throw Error('会话输入框不可用'); return await action(binding.ctx.get('conversation').input.for(binding.ctx)); }
    finally { clearTimeout(timer); lease.release(); }
  }
  async execute(action, payload, expiresAt = Date.now() + 10000) {
    if (Date.now() >= expiresAt) throw Error('操作已过期');
    if (action === 'copy') { if (!navigator.clipboard?.writeText) throw Error('剪贴板不可用'); await navigator.clipboard.writeText(payload.text); return { copied: true }; }
    if (action === 'openFile') {
      const remote = this.ctx.get('remote')?.session; if (!remote?.openWorkspacePath) throw Error('宿主未提供文件打开接口');
      return remote.openWorkspacePath({ path: payload.path }, AbortSignal.timeout(Math.max(1, expiresAt - Date.now())));
    }
    return this.input(payload.sessionId, async input => {
      if (action === 'getDraft') {
        const draft = input.draftSnapshot, state = input.state.getSnapshot();
        return { text: draft.text, revision: state.draftRev, quotes: draft.quotes || [], references: draft.references || [], attachments: state.attachmentIds || [] };
      }
      if (action === 'quote') {
        const draft = input.draftSnapshot, state = input.state.getSnapshot();
        const content = payload.summary + '\n```\n' + payload.code + '\n```\n请结合上下文分析这段代码，是否存在安全或逻辑隐患，以及如何改进？';
        if (draft.text.includes(content)) { await this.openSession(payload.sessionId); return { written: true, duplicate: true }; }
        const result = await this.writeDraft(input, { text: draft.text + (draft.text ? '\n\n' : '') + content, expectedRevision: payload.expectedRevision ?? state.draftRev });
        if (result.written) await this.openSession(payload.sessionId);
        return result;
      }
      if (action !== 'writeDraft') throw Error('未知原生操作');
      return this.writeDraft(input, payload);
    }, expiresAt);
  }
  async writeDraft(input, payload) {
      const before = structuredClone(input.draftSnapshot), state = input.state.getSnapshot();
      if (state.draftRev !== payload.expectedRevision || state.phase !== 'plain') return { written: false };
      const attachmentIds = [...(state.attachmentIds || [])];
      input.actions.setDraft({ ...before, text: payload.text });
      const appliedRevision = input.state.getSnapshot().draftRev;
      // Composer state commits without a paint; background Desktop windows may suspend rAF.
      await Promise.resolve();
      const after = input.draftSnapshot, next = input.state.getSnapshot();
      const same = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);
      if (next.draftRev !== appliedRevision || after.text !== payload.text || !same(after.quotes, before.quotes) || !same(after.references, before.references) || !same(next.attachmentIds, attachmentIds)) {
        // A user may type during the frame. Never roll their newer draft back.
        if (next.draftRev === appliedRevision) input.actions.setDraft(before);
        input.actions.persistDraft(); return { written: false };
      }
      input.actions.persistDraft(); return { written: true, revision: next.draftRev };
  }
}
