import fs from 'node:fs';
import { sha256 } from './common.mjs';
import { uuid, now } from './store.mjs';

export const projectFor = repoRoot => ({ projectKey: sha256(fs.realpathSync(repoRoot)), repoRoot: fs.realpathSync(repoRoot) });
export async function developmentSession(adapter, sessionId) {
  const seen = new Set(); let session = sessionId ? await adapter.session(sessionId) : null;
  while (session?.origin === 'subagent' && session.parentSession) {
    if (seen.has(session.id)) throw Error('Cyclic parent Session'); seen.add(session.id);
    session = await adapter.session(session.parentSession);
  }
  return session?.kind === 'review' ? null : session;
}
export class Deliveries {
  constructor(store) { this.store = store; this.tails = new Map(); }
  binding({ branch, targetBranch, session }) {
    return branch && branch !== targetBranch ? { kind: 'branch', value: branch }
      : session ? { kind: 'session', value: session.id } : { kind: 'manual', value: uuid('manual') };
  }
  findOpen(projectKey, input) {
    const bindKey = input.bindKey || this.binding(input);
    return this.store.deliveries(projectKey).find(d => !d.closedAt && d.branch === input.branch && d.bindKey.kind === bindKey.kind && d.bindKey.value === bindKey.value);
  }
  observe(project, input) {
    const next = (this.tails.get(project.projectKey) ?? Promise.resolve()).catch(() => {}).then(() => this._observe(project, input));
    this.tails.set(project.projectKey, next); return next;
  }
  async _observe(project, { branch, targetBranch, session, requirements = [], headSha, baseSha, targetSha, reachable, hasChanges = true }) {
    const key = project.projectKey;
    const bindKey = this.binding({ branch, targetBranch, session });
    let delivery = this.findOpen(key, { branch, bindKey });
    let closed = null;
    if (delivery?.everAhead && delivery.lastHeadSha && targetSha && await reachable(delivery.lastHeadSha, targetSha)) {
      closed = await this.store.updateDelivery(key, delivery.deliveryId, d => {
        if (!d.closedAt) { d.closedAt = now(); d.archivedAt = d.closedAt; delete d.pinnedAt; }
      }); delivery = null;
      if (!hasChanges) return { delivery: closed, closed, shouldFreeze: false };
    }
    if (!delivery && !hasChanges) {
      const previous = this.store.deliveries(key).find(d => d.closedAt && d.branch === branch && d.bindKey.kind === bindKey.kind && d.bindKey.value === bindKey.value);
      if (previous) return { delivery: previous, closed: null, shouldFreeze: false };
    }
    if (!delivery) {
      const first = [...requirements].sort((a, b) => a.order - b.order)[0]?.text.trim().split('\n')[0];
      const titleSource = first ? 'requirement' : branch ? 'branch' : 'session';
      delivery = { deliveryId: uuid('delivery'), projectKey: key, bindKey, title: Array.from(first || branch || session?.title || '本次交付').slice(0, 120).join(''), titleSource,
        branch: branch || '', sessionIds: [], createdAt: now(), latestSnapshotId: null, snapshotIds: [], everAhead: false };
      await this.store.putDelivery(key, delivery, { create: true });
    }
    delivery = await this.store.updateDelivery(key, delivery.deliveryId, d => {
      d.lastHeadSha = headSha; d.everAhead ||= Boolean(headSha && headSha !== baseSha);
      if (session) d.sessionIds = [...d.sessionIds.filter(id => id !== session.id), session.id];
    });
    return { delivery, closed, shouldFreeze: true };
  }
}
