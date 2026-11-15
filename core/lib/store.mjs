import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadBundle } from '../validate.mjs';
import { inside, externalDestination } from './common.mjs';

const clone = value => structuredClone(value);
const id = value => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,180}$/.test(value) || value.includes('..')) throw Error('Invalid storage identity');
  return value;
};
export const now = () => new Date().toISOString();
export const uuid = prefix => prefix + '-' + crypto.randomUUID();

/** Node implementation of the storage adapter. Every mutation is serialized per project. */
export class FileStore {
  constructor(root) {
    externalDestination(root);
    fs.mkdirSync(root, { recursive: true });
    this.root = fs.realpathSync(root);
    this.tails = new Map();
    this.poisoned = new Set();
  }
  location(projectKey, ...pieces) {
    if (!/^[a-f0-9]{64}$/.test(projectKey)) throw Error('Invalid projectKey');
    const file = path.join(this.root, projectKey, ...pieces.map(id));
    let cursor = this.root;
    for (const part of path.relative(this.root, file).split(path.sep)) {
      cursor = path.join(cursor, part);
      if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) throw Error('Storage symlink refused');
    }
    return file;
  }
  serial(key, action) {
    const next = (this.tails.get(key) ?? Promise.resolve()).catch(() => {}).then(action);
    this.tails.set(key, next);
    return next;
  }
  atomic(file, value, raw = false) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.existsSync(file) && !fs.lstatSync(file).isFile()) throw Error('Storage target is not a regular file');
    const temporary = file + '.tmp-' + crypto.randomUUID();
    const fd = fs.openSync(temporary, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600);
    try {
      try { fs.writeFileSync(fd, raw ? value : JSON.stringify(value, null, 2) + '\n'); fs.fsyncSync(fd); }
      finally { fs.closeSync(fd); }
      fs.renameSync(temporary, file);
    } finally { fs.rmSync(temporary, { force: true }); }
  }
  read(key, directory, name) {
    const file = this.location(key, directory, name + '.json');
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  }
  list(key, directory) {
    const folder = this.location(key, directory);
    if (!fs.existsSync(folder)) return [];
    return fs.readdirSync(folder).filter(name => name.endsWith('.json')).map(name => this.read(key, directory, name.slice(0, -5)));
  }
  deliveries(key) { return this.list(key, 'deliveries'); }
  runs(key, snapshotId) { return this.list(key, 'runs').filter(run => !snapshotId || run.snapshotId === snapshotId); }
  delivery(key, deliveryId) { return this.read(key, 'deliveries', deliveryId); }
  snapshot(key, snapshotId) {
    const file = this.location(key, 'snapshots', snapshotId, 'snapshot.json');
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  }
  bundlePath(key, snapshotId) { return this.location(key, 'snapshots', snapshotId, 'blobs'); }
  settings(key) {
    const file = this.location(key, 'settings.json');
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { autoMode: false, targetBranch: '', extensionPrompt: '', exportEmbedDiff: false };
  }
  setSettings(key, settings) { return this.serial(key, () => this.atomic(this.location(key, 'settings.json'), clone(settings))); }
  putDelivery(key, delivery, { create = false } = {}) {
    const data = clone(delivery);
    return this.serial(key, () => {
      if (!create && !this.delivery(key, data.deliveryId)) return false;
      this.atomic(this.location(key, 'deliveries', data.deliveryId + '.json'), data);
      return true;
    });
  }
  updateDelivery(key, deliveryId, change) {
    return this.serial(key, () => {
      const data = this.delivery(key, deliveryId); if (!data) return null;
      change(data); this.atomic(this.location(key, 'deliveries', deliveryId + '.json'), data); return data;
    });
  }
  putSnapshot(key, deliveryId, bundleDirectory, { snapshotId = uuid('snap'), trigger = 'manual' } = {}) {
    const bundle = loadBundle(bundleDirectory);
    return this.serial(key, () => {
      const delivery = this.delivery(key, deliveryId); if (!delivery) throw Error('Delivery deleted');
      const destination = this.location(key, 'snapshots', snapshotId);
      if (fs.existsSync(destination)) throw Error('Snapshot is immutable');
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      const stage = fs.mkdtempSync(path.join(path.dirname(destination), '.staging-'));
      const snapshot = { ...clone(bundle.snapshot), snapshotId, deliveryId, projectKey: key, createdAt: now(), trigger };
      try {
        fs.cpSync(bundle.root, path.join(stage, 'blobs'), { recursive: true });
        this.atomic(path.join(stage, 'snapshot.json'), snapshot);
        this.atomic(path.join(stage, 'blobs/snapshot.json'), snapshot);
        fs.renameSync(stage, destination);
      } finally { fs.rmSync(stage, { recursive: true, force: true }); }
      delivery.snapshotIds = [...(delivery.snapshotIds ?? []), snapshotId];
      delivery.latestSnapshotId = snapshotId;
      this.atomic(this.location(key, 'deliveries', deliveryId + '.json'), delivery);
      return snapshot;
    });
  }
  putRun(key, run) {
    const data = clone(run);
    return this.serial(key, () => {
      if (!this.snapshot(key, data.snapshotId) || !this.delivery(key, data.deliveryId)) return false;
      this.atomic(this.location(key, 'runs', data.runId + '.json'), data); return true;
    });
  }
  events(key, kind) {
    if (!['marks', 'annotations'].includes(kind)) throw Error('Unknown event stream');
    const file = this.location(key, kind + '.jsonl'); if (!fs.existsSync(file)) return [];
    const text = fs.readFileSync(file, 'utf8'), lines = text.split('\n'); lines.pop();
    return lines.filter(Boolean).map(line => JSON.parse(line));
  }
  append(key, kind, event, { requireCurrent = false } = {}) {
    const value = clone(event);
    return this.serial(key, () => {
      if (!['marks', 'annotations'].includes(kind)) throw Error('Unknown event stream');
      if (this.poisoned.has(key + ':' + kind)) throw Error('Event stream needs recovery after failed append');
      const snapshot = this.snapshot(key, value.snapshotId);
      if (!snapshot) throw Error('Snapshot deleted');
      if (requireCurrent && this.delivery(key, snapshot.deliveryId)?.current?.snapshotId !== value.snapshotId) throw Error('History is read-only');
      const file = this.location(key, kind + '.jsonl'); fs.mkdirSync(path.dirname(file), { recursive: true });
      const fd = fs.openSync(file, fs.constants.O_CREAT | fs.constants.O_APPEND | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600);
      try { fs.writeFileSync(fd, JSON.stringify(value) + '\n'); fs.fsyncSync(fd); }
      catch (error) { this.poisoned.add(key + ':' + kind); throw error; }
      finally { fs.closeSync(fd); }
      return value;
    });
  }
  marks(key, snapshotId) {
    const map = new Map(); for (const event of this.events(key, 'marks')) if (event.snapshotId === snapshotId) map.set(event.findingId, event);
    return [...map.values()];
  }
  annotations(key, snapshotId) {
    const map = new Map(); for (const event of this.events(key, 'annotations')) if (event.snapshotId === snapshotId) {
      if (event.type === 'delete') map.delete(event.annotationId); else map.set(event.annotationId, event);
    }
    return [...map.values()];
  }
  async recover() {
    for (const key of fs.readdirSync(this.root).filter(name => /^[a-f0-9]{64}$/.test(name))) await this.serial(key, () => {
      for (const kind of ['marks', 'annotations']) {
        const file = this.location(key, kind + '.jsonl'); if (!fs.existsSync(file)) continue;
        const bytes = fs.readFileSync(file), end = bytes.lastIndexOf(10) + 1;
        const text = bytes.subarray(0, end).toString('utf8'); text.split('\n').filter(Boolean).forEach(line => JSON.parse(line));
        if (end !== bytes.length) this.atomic(file, text, true);
        this.poisoned.delete(key + ':' + kind);
      }
      for (const run of this.runs(key)) if (run.status === 'running') {
        run.status = 'failed'; run.errorCode = 'interrupted'; run.complete = false; run.endedAt = now();
        this.atomic(this.location(key, 'runs', run.runId + '.json'), run);
        const delivery = this.delivery(key, run.deliveryId);
        if (delivery?.activeRunId === run.runId && delivery.current?.generation === run.generation && delivery.current.snapshotId === run.snapshotId) {
          delivery.latestResultRunId = run.runId; this.atomic(this.location(key, 'deliveries', delivery.deliveryId + '.json'), delivery);
        }
      }
      const folder = this.location(key, 'runs');
      if (fs.existsSync(folder)) for (const name of fs.readdirSync(folder)) if (name.includes('.tmp-')) fs.rmSync(this.location(key, 'runs', name));
    });
  }
  _removeRecords(key, snapshots) {
    for (const run of this.runs(key)) if (snapshots.has(run.snapshotId)) fs.rmSync(this.location(key, 'runs', run.runId + '.json'), { force: true });
    for (const kind of ['marks', 'annotations']) {
      const remaining = this.events(key, kind).filter(event => !snapshots.has(event.snapshotId));
      this.atomic(this.location(key, kind + '.jsonl'), remaining.map(event => JSON.stringify(event) + '\n').join(''), true);
    }
    for (const snapshotId of snapshots) fs.rmSync(this.location(key, 'snapshots', snapshotId), { recursive: true, force: true });
  }
  _deleteDelivery(key, deliveryId) {
    const delivery = this.delivery(key, deliveryId); if (!delivery) return;
    this._removeRecords(key, new Set(delivery.snapshotIds ?? []));
    fs.rmSync(this.location(key, 'deliveries', deliveryId + '.json'), { force: true });
  }
  deleteDelivery(key, deliveryId) { return this.serial(key, () => this._deleteDelivery(key, deliveryId)); }
  deleteSnapshot(key, snapshotId) {
    return this.serial(key, () => {
      const snapshot = this.snapshot(key, snapshotId); if (!snapshot) return;
      const delivery = this.delivery(key, snapshot.deliveryId);
      this._removeRecords(key, new Set([snapshotId]));
      if (!delivery) return;
      delivery.snapshotIds = (delivery.snapshotIds ?? []).filter(id => id !== snapshotId);
      if (!delivery.snapshotIds.length) return this._deleteDelivery(key, delivery.deliveryId);
      delivery.latestSnapshotId = delivery.snapshotIds.at(-1);
      if (delivery.current?.snapshotId === snapshotId) {
        const latest = this.snapshot(key, delivery.latestSnapshotId);
        delivery.current = { snapshotId: latest.snapshotId, inputSha: latest.inputSha, generation: (delivery.current.generation ?? 0) + 1 };
        delete delivery.activeRunId;
      }
      this.atomic(this.location(key, 'deliveries', delivery.deliveryId + '.json'), delivery);
    });
  }
  pin(key, deliveryId, value) { return this.updateDelivery(key, deliveryId, d => { if (d.archivedAt) throw Error('Archived delivery cannot be pinned'); if (value) d.pinnedAt = now(); else delete d.pinnedAt; }); }
  archive(key, deliveryId, value) { return this.updateDelivery(key, deliveryId, d => { if (value) { d.archivedAt = now(); delete d.pinnedAt; } else delete d.archivedAt; }); }
  assertOutsideRepository(repoRoot) { if (inside(fs.realpathSync(repoRoot), this.root)) throw Error('Storage must be outside the input repository'); }
}
