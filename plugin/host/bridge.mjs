import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';

/** Tab-addressed, acknowledged RPC over the existing DSH exact Fetch carrier. No server is opened. */
export class ClientBridge {
  constructor({ timeoutMs = 12000 } = {}) { this.timeout = timeoutMs; this.pending = new Map(); this.clients = new Map(); this.context = new AsyncLocalStorage(); }
  withClient(clientId, action) {
    if (typeof clientId !== 'string' || !/^[a-zA-Z0-9-]{20,100}$/.test(clientId)) throw Error('Invalid client identity');
    return this.context.run(clientId, action);
  }
  next(clientId) {
    if (this.closed || typeof clientId !== 'string' || !/^[a-zA-Z0-9-]{20,100}$/.test(clientId)) throw Error('Invalid client identity');
    for (const [id, seen] of this.clients) if (Date.now() - seen > 15000) this.clients.delete(id);
    this.clients.set(clientId, Date.now());
    return [...this.pending.values()].filter(p => p.clientId === clientId && !p.delivered).map(p => { p.delivered = true; return { id: p.id, nonce: p.nonce, expiresAt: p.expiresAt, action: p.action, payload: p.payload }; });
  }
  call(action, payload) {
    if (this.closed) throw Error('Plugin unloaded');
    const clientId = this.context.getStore(); if (!clientId) throw Error('No initiating client for composer operation');
    if (Date.now() - (this.clients.get(clientId) || 0) > 15000) throw Error('Initiating client disconnected');
    const id = crypto.randomUUID(), nonce = crypto.randomBytes(24).toString('hex');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(Error('Client operation timed out')); }, this.timeout);
      this.pending.set(id, { id, nonce, clientId, action, expiresAt: Date.now() + this.timeout, payload: structuredClone(payload), delivered: false,
        finish: (value, error) => { clearTimeout(timer); this.pending.delete(id); error ? reject(Error(String(error))) : resolve(value); } });
    });
  }
  answer(clientId, { id, nonce, result, error }) {
    const pending = this.pending.get(id);
    if (!pending || pending.clientId !== clientId || pending.nonce !== nonce) throw Error('Unknown client operation');
    pending.finish(result, error); return { accepted: true };
  }
  close() { this.closed = true; for (const p of [...this.pending.values()]) p.finish(null, 'Plugin unloaded'); this.clients.clear(); }
}
