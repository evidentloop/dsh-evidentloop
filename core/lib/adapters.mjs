/** Host seam: no DSH imports. The model receives only immutable frozen inputs. */
export class SyntheticAdapter {
  constructor({ model, sessions = [] } = {}) {
    this.model = model; this.sessionRows = new Map(sessions.map(s => [s.id, structuredClone(s)]));
    this.drafts = new Map(); this.clipboard = ''; this.calls = []; this.kind = 'synthetic';
  }
  async review(request, { signal }) {
    this.calls.push({ runId: request.runId, snapshotId: request.snapshot.snapshotId, inputSha: request.snapshot.inputSha, scope: [...request.reviewPaths], tools: [] });
    signal.throwIfAborted(); if (!this.model) throw Error('Synthetic model not supplied');
    return this.model(request, { signal });
  }
  async session(id) { return structuredClone(this.sessionRows.get(id) ?? null); }
  async getDraft(id) { return structuredClone(this.drafts.get(id) ?? { text: '', revision: 0, quotes: [], attachments: [] }); }
  async writeDraft(id, text, { expectedRevision } = {}) {
    const previous = await this.getDraft(id);
    if (expectedRevision !== undefined && previous.revision !== expectedRevision) return false;
    this.drafts.set(id, { ...previous, text, revision: previous.revision + 1 }); return true;
  }
  async copy(text) { this.clipboard = text; return true; }
}

export function assertAdapter(adapter) {
  for (const method of ['review', 'session', 'getDraft', 'writeDraft', 'copy']) if (typeof adapter?.[method] !== 'function') throw Error('Missing adapter capability: ' + method);
  return adapter;
}
