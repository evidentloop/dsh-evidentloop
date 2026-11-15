import { prepareRequirements, normalizeLF, canonical } from './common.mjs';

/** Pure source-order state. The host supplies authoritative message ids/sequences, never timestamps. */
export class RequirementLedger {
  constructor(rows = []) {
    this.rows = structuredClone(rows);
    if (new Set(this.rows.map(r => r.sourceKey)).size !== this.rows.length || this.rows.some((r, i) => r.source.order !== i)) throw Error('Invalid persisted requirement ledger');
    if (canonical(prepareRequirements(this.rows.map(r => r.source))) !== canonical(this.rows.map(r => r.source))) throw Error('Persisted requirement identity mismatch');
  }
  captureMessages(sessionId, messages) {
    if (typeof sessionId !== 'string' || !sessionId || !Array.isArray(messages)) throw Error('Requirement message order unconfirmed');
    let previous = -1; const staged = structuredClone(this.rows);
    for (const m of messages) {
      if (!Number.isSafeInteger(m.sequence) || m.sequence < 0 || m.sequence <= previous || typeof m.id !== 'string' || !m.id || typeof m.text !== 'string') throw Error('Requirement message order unconfirmed');
      previous = m.sequence;
      const sourceKey = 'message:' + sessionId + ':' + m.id, old = staged.find(r => r.sourceKey === sourceKey);
      if (old) { if (old.sequence !== m.sequence || old.source.text !== normalizeLF(m.text)) throw Error('Previously captured requirement identity changed'); continue; }
      const latest = Math.max(-1, ...staged.filter(r => r.sessionId === sessionId).map(r => r.sequence));
      if (m.sequence <= latest) throw Error('Late historical message cannot be reordered behind a manual requirement');
      staged.push({ sourceKey, sessionId, sequence: m.sequence, source: prepareRequirements([{ kind: 'session-message', text: m.text, origin: sessionId, order: staged.length }])[0] });
    }
    this.rows = staged; return this.sources();
  }
  captureManual({ id, source, sessionId = null, messages = [] }) {
    const before = structuredClone(this.rows);
    try {
    if (sessionId) this.captureMessages(sessionId, messages);
    else if (messages.length) throw Error('Messages need a confirmed Session identity');
    if (typeof id !== 'string' || !id || !['file', 'paste'].includes(source.kind)) throw Error('Invalid manual requirement source');
    const sourceKey = 'manual:' + id, old = this.rows.find(r => r.sourceKey === sourceKey);
    const prepared = prepareRequirements([{ ...source, order: old?.source.order ?? this.rows.length }])[0];
    if (old) { if (old.source.sha256 !== prepared.sha256 || old.source.kind !== prepared.kind) throw Error('Manual source identity changed'); return structuredClone(old.source); }
    this.rows.push({ sourceKey, source: prepared }); return structuredClone(prepared);
    } catch (error) { this.rows = before; throw error; }
  }
  sources() { return structuredClone(this.rows.map(r => r.source)); }
  state() { return structuredClone(this.rows); }
}
