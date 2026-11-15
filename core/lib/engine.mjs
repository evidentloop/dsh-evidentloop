import fs from 'node:fs';
import path from 'node:path';
import { prepare, readState } from '../prepare.mjs';
import { loadBundle, validate } from '../validate.mjs';
import { METHOD_ROOT, isTarget, normalizeLF, prepareRequirements } from './common.mjs';
import { createGit, preflight, rangeOf, branchLabelOf, currentBranchOf, EMPTY_WORKTREE_MESSAGE } from './git.mjs';
import { FileStore, now, uuid } from './store.mjs';
import { Deliveries, projectFor, developmentSession } from './deliveries.mjs';
import { Scheduler } from './scheduler.mjs';
import { assertAdapter } from './adapters.mjs';
import { freezeMethod } from './method.mjs';
import { checkSchemaSupport } from './schema.mjs';
import { carryable, applyScope, remapResult, covers, scopePaths } from './incremental.mjs';

const clone = x => structuredClone(x);
export class ReviewCore {
  constructor({ storageRoot, store = storageRoot && new FileStore(storageRoot), adapter, methodRoot = METHOD_ROOT } = {}) {
    if (!store) throw Error('A storage adapter or storageRoot is required');
    this.store = store; this.adapter = assertAdapter(adapter); this.methodRoot = methodRoot;
    this.deliveries = new Deliveries(store); this.scheduler = new Scheduler();
    this.deletedSnapshots = new Set(); this.deletedDeliveries = new Set();
  }
  async initialize() { await this.store.recover(); return this; }
  async trigger({ repo, target, sessionId, requirements = [], extension, scope = 'incremental', force = false, trigger = 'manual', captureOnly = false, expectedDeliveryId, onPrepared, _testAfterRead } = {}) {
    let temp;
    try {
      if (trigger === 'auto') {
        const source = sessionId ? await this.adapter.session(sessionId) : null;
        if (!source || source.kind === 'review') return { status: 'skipped', code: source ? 'own-review-session' : 'no-development-session' };
      }
      const git = createGit(repo); preflight(git); this.store.assertOutsideRepository(git.root);
      const project = projectFor(git.root), settings = this.store.settings(project.projectKey);
      if (trigger === 'auto' && !settings.autoMode && !captureOnly) return { status: 'skipped', code: 'auto-disabled' };
      requirements = prepareRequirements(requirements);
      const effectiveTarget = target ?? (settings.targetBranch || undefined), range = rangeOf(git, effectiveTarget);
      const branchName = currentBranchOf(git), branch = branchName === 'HEAD' ? '' : branchName;
      if (!branch) return { status: 'incomplete', code: 'branch-unavailable', reason: 'Cannot group a delivery without a confirmed current branch' };
      const targetBranch = range.kind === 'empty-tree-worktree' ? branch : branchLabelOf(git, range.targetRef);
      const observedState = readState(git, effectiveTarget);
      if (range.kind === 'empty-tree-worktree' && !observedState.files.length) return { status: 'incomplete', code: 'empty-worktree', reason: EMPTY_WORKTREE_MESSAGE };
      const session = await developmentSession(this.adapter, sessionId);
      if (trigger === 'auto' && !session) return { status: 'skipped', code: 'own-review-or-missing-parent' };
      if (expectedDeliveryId && this.deliveries.findOpen(project.projectKey, { branch, targetBranch, session })?.deliveryId !== expectedDeliveryId) return { status: 'incomplete', code: 'delivery-context-changed', reason: '当前分支或开发会话已改变，请重新打开交付' };
      const observation = await this.deliveries.observe(project, { branch, targetBranch, session, requirements,
        headSha: range.headSha, baseSha: range.baseSha, targetSha: range.targetSha, hasChanges: observedState.files.length > 0,
        reachable: async (a, b) => { try { git.run(['merge-base', '--is-ancestor', a, b]); return true; } catch { return false; } } });
      if (!observation.shouldFreeze) return { status: 'closed', delivery: observation.delivery };
      const captures = this.store.location(project.projectKey, 'captures'); fs.mkdirSync(captures, { recursive: true });
      temp = path.join(captures, uuid('bundle'));
      const frozen = prepare({ repo: git.root, out: temp, target: effectiveTarget, requirements, extension: extension ?? settings.extensionPrompt, methodRoot: this.methodRoot, _testAfterRead });
      if (frozen.status !== 'complete') return frozen;
      const captured = loadBundle(temp);
      if (captured.snapshot.range.headSha !== range.headSha || currentBranchOf(git) !== branchName) return { status: 'incomplete', code: 'branch-or-head-changed' };
      return await this.requestBundle({ projectKey: project.projectKey, deliveryId: observation.delivery.deliveryId, bundle: temp, scope, force, trigger, captureOnly, onPrepared, sourceSessionId: session?.id });
    } catch (error) { return { status: 'incomplete', code: error.code || 'preparation-failed', reason: error.message }; }
    finally { if (temp) fs.rmSync(temp, { recursive: true, force: true }); }
  }
  async requestBundle({ projectKey, deliveryId, bundle, scope = 'incremental', force = false, trigger = 'manual', captureOnly = false, onPrepared, sourceSessionId }) {
    if (this.deletedDeliveries.has(deliveryId)) throw Error('Delivery deleted');
    const input = loadBundle(bundle), delivery = this.store.delivery(projectKey, deliveryId);
    if (!delivery) throw Error('Delivery not found');
    const paths = scopePaths(scope, input.targets);
    let snapshot;
    if ((trigger === 'auto' || captureOnly) && delivery.current?.inputSha === input.snapshot.inputSha) snapshot = this.store.snapshot(projectKey, delivery.current.snapshotId);
    else snapshot = await this.store.putSnapshot(projectKey, deliveryId, bundle, { trigger });
    const current = await this.store.updateDelivery(projectKey, deliveryId, d => {
      const generation = d.current ? d.current.generation + Number(d.current.inputSha !== snapshot.inputSha) : 1;
      d.current = { snapshotId: snapshot.snapshotId, inputSha: snapshot.inputSha, generation };
      d.latestSnapshotId = snapshot.snapshotId;
    });
    if (!current || this.deletedDeliveries.has(deliveryId)) return { status: 'cancelled', errorCode: 'deleted' };
    await onPrepared?.({ projectKey, deliveryId, snapshotId: snapshot.snapshotId, inputSha: snapshot.inputSha, generation: current.current.generation });
    if (captureOnly) {
      // Capturing an input never grants a model call. A changed input still invalidates old work.
      await this.scheduler.cancelDelivery(projectKey, deliveryId, job => job.inputSha !== snapshot.inputSha);
      const latest = this.store.delivery(projectKey, deliveryId)?.current;
      if (latest?.generation !== current.current.generation || latest.snapshotId !== snapshot.snapshotId) return { status: 'cancelled', errorCode: 'superseded' };
      return { status: 'pending', projectKey, deliveryId, snapshotId: snapshot.snapshotId, inputSha: snapshot.inputSha, generation: latest.generation };
    }
    return this.scheduler.submit(projectKey, { projectKey, deliveryId, snapshot, snapshotId: snapshot.snapshotId, inputSha: snapshot.inputSha,
      generation: current.current.generation, sourceSessionId, paths, whole: scope === 'all' || scope === 'incremental', incremental: scope === 'incremental', force, scope,
      execute: (job, signal) => this.execute(job, signal) });
  }
  async reviewCurrent(projectKey, deliveryId, { scope = 'incremental', force = false } = {}) {
    const d = this.store.delivery(projectKey, deliveryId); if (!d?.current) throw Error('No current snapshot');
    const snapshot = this.store.snapshot(projectKey, d.current.snapshotId), targets = snapshot.files.filter(isTarget).map(f => f.path);
    return this.scheduler.submit(projectKey, { projectKey, deliveryId, snapshot, snapshotId: snapshot.snapshotId, inputSha: snapshot.inputSha,
      generation: d.current.generation, paths: scopePaths(scope, targets), whole: scope === 'all' || scope === 'incremental', incremental: scope === 'incremental', force, scope,
      execute: (job, signal) => this.execute(job, signal) });
  }
  currentMatches(job) {
    const d = this.store.delivery(job.projectKey, job.deliveryId);
    return d?.current?.generation === job.generation && d.current.snapshotId === job.snapshotId && !this.deletedSnapshots.has(job.snapshotId) && !this.deletedDeliveries.has(job.deliveryId);
  }
  async copyMarks(key, maps, newSnapshotId) {
    for (const { oldSnapshotId, oldFindingId, findingId } of maps) {
      const mark = this.store.marks(key, oldSnapshotId).find(m => m.findingId === oldFindingId);
      if (mark) await this.store.append(key, 'marks', { ...clone(mark), snapshotId: newSnapshotId, findingId, at: now(), carriedFrom: { snapshotId: oldSnapshotId, findingId: oldFindingId } });
    }
  }
  async commit(job, run) {
    if (this.deletedSnapshots.has(job.snapshotId) || this.deletedDeliveries.has(job.deliveryId)) return run;
    if (!await this.store.putRun(job.projectKey, run)) return run;
    await this.store.updateDelivery(job.projectKey, job.deliveryId, d => {
      if (d.current?.generation === job.generation && d.current.snapshotId === job.snapshotId && d.activeRunId === run.runId) d.latestResultRunId = run.runId;
    });
    return run;
  }
  async execute(job, signal) {
    const key = job.projectKey;
    if (!this.currentMatches(job)) return { status: 'cancelled', errorCode: 'superseded' };
    const paths = job.whole ? job.snapshot.files.filter(isTarget).map(f => f.path) : [...job.paths];
    const candidates = this.store.runs(key).filter(r => r.deliveryId === job.deliveryId && r.understanding).sort((a, b) => (b.endedAt || '').localeCompare(a.endedAt || ''));
    const cached = !job.force && candidates.find(r => r.inputSha === job.inputSha && covers(r, paths));
    if (cached && cached.snapshotId === job.snapshotId && cached.generation === job.generation) return { ...clone(cached), deduplicated: true };
    const runId = uuid('run'), startedAt = now();
    let run = { runId, generation: job.generation, snapshotId: job.snapshotId, deliveryId: job.deliveryId, inputSha: job.inputSha,
      promptVersion: job.snapshot.promptVersion, scope: job.scope, requestedPaths: paths, startedAt, status: 'running', complete: false,
      injectedModules: [], coverage: { reviewed: [], skipped: [], failed: [], withheld: [] }, model: { adapter: this.adapter.kind || 'host' } };
    await this.store.putRun(key, run);
    await this.store.updateDelivery(key, job.deliveryId, d => { if (d.current?.generation === job.generation && d.current.snapshotId === job.snapshotId) d.activeRunId = runId; });
    try {
      signal.throwIfAborted();
      if (!this.currentMatches(job)) { const error = Error('superseded'); error.code = 'superseded'; throw error; }
      if (cached) {
        const { result, findingIds } = remapResult(cached, { runId, snapshotId: job.snapshotId, generation: job.generation, deliveryId: job.deliveryId });
        run = { ...result, startedAt, endedAt: now(), scope: job.scope, requestedPaths: paths, status: 'succeeded', complete: true };
        await this.copyMarks(key, Object.entries(findingIds).map(([oldFindingId, findingId]) => ({ oldFindingId, findingId, oldSnapshotId: cached.snapshotId })), job.snapshotId);
        return await this.commit(job, run);
      }
      const bundleRoot = this.store.bundlePath(key, job.snapshotId), bundle = loadBundle(bundleRoot);
      const modules = freezeMethod(this.methodRoot, job.snapshot, bundleRoot);
      const schemaBytes = modules.find(m => m.path === 'schema/run.schema.json').text;
      checkSchemaSupport(JSON.parse(schemaBytes));
      run.injectedModules = modules.map(({ path, sha256 }) => ({ path, sha256 }));
      let source = null, carried = [];
      if (!job.force) for (const candidate of candidates) {
        const eligible = carryable(job.snapshot, this.store.snapshot(key, candidate.snapshotId), candidate).filter(p => !paths.includes(p) || job.incremental);
        if (eligible.length > carried.length) { source = candidate; carried = eligible; }
      }
      const reviewed = paths.filter(p => !carried.includes(p));
      let model;
      if (!bundle.targets.length) {
        model = { schemaVersion: 1, inputSha: job.inputSha, promptVersion: job.snapshot.promptVersion, overview: { purpose: '本次仅包含文件元数据变化，无可审查文本。', requirementStatus: bundle.requirements.length ? 'checked' : 'no-requirement' }, features: [], files: [], impacts: [], extras: [], findings: [],
          alignment: bundle.requirements.flatMap(s => s.items.map(i => ({ requirementItemId: i.itemId, status: 'unclear', codeRefs: [], note: '本次没有可审查文本，需确认' }))) };
      } else model = await this.adapter.review(Object.freeze({ runId, sourceSessionId: job.sourceSessionId, snapshot: clone(job.snapshot), bundleRoot, modules, reviewPaths: Object.freeze(reviewed), carriedPaths: Object.freeze(carried), tools: Object.freeze([]) }), { signal });
      const late = signal.aborted;
      const validation = validate(bundleRoot, model, { runId, schemaBytes });
      if (validation.status === 'failed') { run.status = 'failed'; run.errorCode = 'validation-layer-' + validation.layer; run.errors = validation.errors; }
      else {
        const scoped = applyScope(validation, model, job.snapshot, reviewed, carried, source);
        run = { ...run, ...scoped };
        if (!late) await this.copyMarks(key, scoped.inheritedMarks, job.snapshotId); delete run.inheritedMarks;
        if (!bundle.targets.length) { run.understanding.overview.basis = 'fact'; run.understanding.alignment.forEach(row => { row.basis = 'fact'; }); run.model = { adapter: 'none-metadata-only' }; }
      }
      if (late) { run.status = 'cancelled'; run.errorCode = 'cancelled'; run.complete = false; run.lateResult = true; }
    } catch (error) { run.status = signal.aborted || error.code === 'superseded' ? 'cancelled' : 'failed'; run.errorCode = signal.aborted ? 'cancelled' : error.message; run.complete = false; }
    run.endedAt = now();
    return this.commit(job, run);
  }
  writable(key, snapshotId, readOnly) {
    const snapshot = this.store.snapshot(key, snapshotId); if (!snapshot) throw Error('Snapshot missing');
    const d = this.store.delivery(key, snapshot.deliveryId);
    if (readOnly || d?.current?.snapshotId !== snapshotId) throw Error('History is read-only');
    return snapshot;
  }
  async mark(key, { snapshotId, findingId, suppressed, by = 'reviewer', readOnly = false }) {
    this.writable(key, snapshotId, readOnly);
    if (typeof suppressed !== 'boolean' || !this.store.runs(key, snapshotId).some(r => r.findings?.some(f => f.findingId === findingId))) throw Error('Finding does not belong to snapshot');
    return this.store.append(key, 'marks', { snapshotId, findingId, suppressed, by, at: now() }, { requireCurrent: true });
  }
  async annotate(key, { snapshotId, annotationId = uuid('annotation'), findingId, anchor, text, readOnly = false }) {
    this.writable(key, snapshotId, readOnly);
    if (typeof text !== 'string') throw Error('Annotation text must be plain text');
    text = normalizeLF(text); if (!text.trim() || Array.from(text).length > 2000) throw Error('Annotation text must contain 1..2000 code points');
    const bundle = loadBundle(this.store.bundlePath(key, snapshotId));
    if (findingId) {
      const finding = this.store.runs(key, snapshotId).flatMap(r => r.findings ?? []).find(f => f.findingId === findingId); if (!finding) throw Error('Foreign finding');
      anchor = { ...finding.anchor, startLine: finding.anchor.line, endLine: finding.anchor.line };
    }
    const file = bundle.snapshot.files.find(f => f.path === anchor?.path);
    const side = file && bundle.texts.get(anchor.side + ':' + (anchor.side === 'base' ? file.oldPath || file.path : file.path));
    if (!side || !['base', 'head'].includes(anchor.side)) throw Error('No frozen text at anchor');
    if (!findingId && anchor.sha256 !== side.sha256) throw Error('Annotation hash mismatch');
    const { startLine, endLine } = anchor;
    if (!(startLine === null && endLine === null) && !(Number.isInteger(startLine) && Number.isInteger(endLine) && startLine >= 1 && endLine >= startLine && endLine <= side.lines.length)) throw Error('Annotation range invalid');
    const old = this.store.annotations(key, snapshotId).find(a => a.annotationId === annotationId)
      || this.store.events(key, 'annotations').find(a => a.snapshotId === snapshotId && a.annotationId === annotationId && a.type === 'upsert');
    if (this.store.events(key, 'annotations').some(a => a.annotationId === annotationId && a.snapshotId !== snapshotId)) throw Error('Annotation belongs to another snapshot');
    return this.store.append(key, 'annotations', { type: 'upsert', annotationId, snapshotId, anchor: { path: file.path, side: anchor.side, startLine, endLine, sha256: side.sha256 }, text,
      ...(findingId ? { findingId } : {}), createdAt: old?.createdAt || now(), updatedAt: now() }, { requireCurrent: true });
  }
  async deleteAnnotation(key, snapshotId, annotationId, readOnly = false) {
    this.writable(key, snapshotId, readOnly);
    if (!this.store.annotations(key, snapshotId).some(a => a.annotationId === annotationId)) throw Error('Annotation missing');
    return this.store.append(key, 'annotations', { type: 'delete', snapshotId, annotationId, at: now() }, { requireCurrent: true });
  }
  async deleteSnapshot(key, snapshotId) {
    const snapshot = this.store.snapshot(key, snapshotId); if (!snapshot) return;
    this.deletedSnapshots.add(snapshotId);
    await this.store.updateDelivery(key, snapshot.deliveryId, d => { if (d.current?.snapshotId === snapshotId) d.current.generation++; });
    await this.scheduler.cancelDelivery(key, snapshot.deliveryId, job => job.snapshotId === snapshotId);
    await this.store.deleteSnapshot(key, snapshotId);
  }
  async deleteDelivery(key, deliveryId) {
    this.deletedDeliveries.add(deliveryId);
    await this.store.updateDelivery(key, deliveryId, d => { if (d.current) d.current.generation++; });
    await this.scheduler.cancelDelivery(key, deliveryId); await this.store.deleteDelivery(key, deliveryId);
  }
  selected(key, snapshotId) {
    const snapshot = this.store.snapshot(key, snapshotId); if (!snapshot) throw Error('Snapshot missing');
    const delivery = this.store.delivery(key, snapshot.deliveryId);
    const candidates = this.store.runs(key, snapshotId).sort((a, b) => (b.endedAt || b.startedAt).localeCompare(a.endedAt || a.startedAt));
    const run = candidates.find(r => r.runId === delivery.activeRunId && ['running', 'queued'].includes(r.status)) || candidates.find(r => r.runId === delivery.latestResultRunId) || candidates[0] || null;
    const annotations = this.store.annotations(key, snapshotId), linked = new Set(annotations.map(a => a.findingId).filter(Boolean));
    const associatedFindings = candidates.flatMap(r => r.findings ?? []).filter(f => linked.has(f.findingId)).map(({ findingId, title, anchor }) => ({ findingId, title, anchor }));
    return { snapshot, delivery, run, marks: this.store.marks(key, snapshotId), annotations, associatedFindings, bundleRoot: this.store.bundlePath(key, snapshotId) };
  }
}
