import { deferred } from '../../core/tests/helpers.mjs';
/** Synthetic public-host shape. Never imported by production entries. */
export function fakeHost({ repo, mode = 'complete', response = { ok: true } } = {}) {
  const listeners = new Set(), handles = new Map(), calls = { create: [], prompts: [], cancel: [], titles: [], flushed: [], disposed: [], steps: [] }, routes = new Map();
  const workspaces = [{ id: 'w1', title: 'Fixture repository', path: repo.root, sessionIds: ['dev'] }, { id: 'w2', title: 'Same repo', path: repo.root, sessionIds: ['dev'] }];
  const selection = { provider: 'fixture-offline', model: 'synthetic', reasoningEffort: 'high' };
  const rows = [{ sessionId: 'dev', cwd: repo.root, origin: 'user', updatedAt: new Date().toISOString(), projections: { values: { title: 'Development fixture' } } }];
  const emit = (session, event) => { for (const fn of listeners) fn(session, event); };
  const ctx = {
    connection: { fetch: { register: route => routes.set(route.path, route) } },
    workspaceRegistry: { list: () => workspaces, archivedSessionIds: [] },
    sessions: { get: id => handles.get(id)?.agent.session, flush: async session => calls.flushed.push(session.id) },
    get: name => name === 'agentDefaultModel' ? { currentSelection: () => selection } : name === 'sessionTitle' ? { rename: (session, title) => calls.titles.push({ id: session.id, title }), get: () => null } : undefined,
    on: (name, listener) => { if (name !== 'session/event') throw Error(name); listeners.add(listener); return () => listeners.delete(listener); },
    llm: { resolveModelInfo: async () => ({ context: { contextWindow: 1000000 }, reasoning: { defaultEffort: 'high' } }) },
    tools: { schemas: agent => agent?.allowed ? agent.allowed.map(name => ({ name })) : [{ name: 'parent-write-tool' }] },
    sessionController: {
      list: async () => ({ items: [...rows] }), resolveAgent: async () => ({ agent: { model: { current: () => selection } } }),
      events: async () => ({ cursor: 0, records: [], hasMore: false }),
      prompt: async body => {
        calls.prompts.push(structuredClone(body)); const h = handles.get(body.sessionId);
        await h.pre({}, async () => { calls.steps.push(body.sessionId); });
        emit(h.agent.session, { type: 'request/header', data: { header: { config: calls.create.find(c => c.sessionId === body.sessionId).agentOptions } } });
        emit(h.agent.session, { type: 'request/context', data: { ...selection, contextWindow: 1000000 } });
        if (mode === 'wait') return;
        if (mode === 'transport') { h.stream({ frame: { type: 'chunk', chunk: { type: 'finish', reason: { kind: 'error', failure: { code: 'TRANSPORT' } } } } }); return; }
        emit(h.agent.session, { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: mode === 'invalid-json' ? 'not JSON' : JSON.stringify(response) }] } } });
        emit(h.agent.session, { type: 'turn/end', data: { reason: { kind: 'completed' } } }); h.done.resolve();
      }
    },
    agents: { create: async options => {
      calls.create.push(options); const done = deferred(); let pre, stream;
      const agent = { session: { id: options.sessionId }, allowed: ['write'], whenIdle: () => done.promise, cancel: reason => { calls.cancel.push(reason); emit(agent.session, { type: 'turn/end', data: { reason: { kind: 'cancelled' } } }); done.resolve(); } };
      options.setup({ tools: { restrict: value => { agent.allowed = value.allow; } }, on: (name, fn) => { if (name === 'agent/pre-step') pre = fn; else if (name === 'agent/assistant-stream') stream = fn; } }, agent);
      handles.set(options.sessionId, { agent, done, get pre() { return pre; }, get stream() { return stream; } });
      return { agent, dispose: async () => calls.disposed.push(agent.session.id) };
    } }
  };
  async function fetchRoute(suffix, body, query = '') {
    const route = routes.get('/api/dsh-evidentloop/' + suffix); if (!route) throw Error('Unregistered route ' + suffix);
    const response = await route.fetch(new Request('http://fixture.invalid/api/dsh-evidentloop/' + suffix + query, body === undefined ? undefined : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
    return { status: response.status, headers: Object.fromEntries(response.headers), text: await response.text() };
  }
  return { ctx, calls, handles, listeners, routes, rows, workspaces, selection, fetchRoute };
}
export function nativeFixture({ concurrent = false, corrupt = false } = {}) {
  let draft = { text: 'Existing handwritten draft', references: [{ id: 'ref-1' }], quotes: [{ text: 'Quoted source' }] };
  let state = { draftRev: 7, phase: 'plain', attachmentIds: ['attachment-1'] }, persisted = 0, released = 0, updates = 0;
  const input = { get draftSnapshot() { return structuredClone(draft); }, state: { getSnapshot: () => structuredClone(state) }, actions: {
    setDraft: value => { draft = structuredClone(value); state.draftRev++; if (corrupt && ++updates === 1) draft.references = []; if (concurrent) queueMicrotask(() => { draft.text += ' + user typed'; state.draftRev++; }); },
    persistDraft: () => { persisted++; }
  } };
  const frame = resolve => { if (concurrent) { draft.text += ' + user typed'; state.draftRev++; } resolve(); };
  const ctx = { get: name => name === 'uiSession' ? { current: { getSnapshot: () => ({ key: 'dev' }) }, sessions: { retain: () => ({ ready: Promise.resolve(), release: () => released++ }), binding: () => ({ ctx: { get: () => ({ input: { for: () => input } }) } }) } } : null };
  return { ctx, frame, input, get persisted() { return persisted; }, get released() { return released; } };
}
