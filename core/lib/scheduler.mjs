/** Per-project serial dispatcher. The pending map stores merged intents; execute rechecks generation after cancellation settles. */
export class Scheduler {
  constructor() { this.projects = new Map(); }
  state(key) {
    if (!this.projects.has(key)) this.projects.set(key, { active: null, pending: new Map(), draining: false, idleWaiters: [] });
    return this.projects.get(key);
  }
  submit(key, request) {
    const state = this.state(key);
    const promise = new Promise((resolve, reject) => {
      const prior = state.pending.get(request.deliveryId);
      if (prior) {
        const paths = new Set([...prior.paths, ...request.paths]);
        const force = prior.force || request.force, whole = prior.whole || request.whole, incremental = prior.incremental || request.incremental;
        const waiters = [...prior.waiters, { resolve, reject }];
        Object.assign(prior, request, { paths, force, whole, incremental, scope: paths.size > 1 ? 'incremental' : request.scope, waiters });
      } else state.pending.set(request.deliveryId, { ...request, paths: new Set(request.paths), waiters: [{ resolve, reject }] });
    });
    if (state.active?.deliveryId === request.deliveryId && state.active.generation !== request.generation) state.active.controller.abort(new Error('superseded'));
    this.drain(key); return promise;
  }
  async drain(key) {
    const state = this.state(key); if (state.draining) return; state.draining = true;
    try {
      while (state.pending.size) {
        const [deliveryId, job] = state.pending.entries().next().value; state.pending.delete(deliveryId);
        const controller = new AbortController(); let settled;
        const finished = new Promise(resolve => { settled = resolve; });
        state.active = { ...job, controller, finished };
        try { const result = await job.execute(job, controller.signal); job.waiters.forEach(w => w.resolve(result)); }
        catch (error) { job.waiters.forEach(w => w.reject(error)); }
        finally { state.active = null; settled(); }
      }
    } finally { state.draining = false; for (const resolve of state.idleWaiters.splice(0)) resolve(); }
  }
  async cancelDelivery(key, deliveryId, predicate = () => true) {
    const state = this.state(key), pending = state.pending.get(deliveryId);
    if (pending && predicate(pending)) { state.pending.delete(deliveryId); pending.waiters.forEach(w => w.resolve({ status: 'cancelled', errorCode: 'deleted' })); }
    if (state.active?.deliveryId === deliveryId && predicate(state.active)) {
      const active = state.active; active.controller.abort(new Error('deleted')); await active.finished;
    }
  }
  idle(key) {
    const state = this.state(key); return !state.draining ? Promise.resolve() : new Promise(resolve => state.idleWaiters.push(resolve));
  }
}
