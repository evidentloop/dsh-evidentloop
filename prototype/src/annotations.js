/* Reviewer annotations. The browser storage append log stands in for the host's annotations.jsonl. */
(function () {
  'use strict';
  const P = window.CRPrototype = window.CRPrototype || {};
  const STORAGE_KEY = 'evidentloop-prototype-annotations-v1';
  const MAX_CODE_POINTS = 2000;
  let persistedEvents = null;
  const memoryEvents = [];
  const cache = new Map();

  const data = () => window.CR_PROTOTYPE_DATA || {};
  const normalize = text => P.normalizeNewlines(text);
  const lengthOf = text => P.codePointLength(text);
  const failure = (code, message) => ({ ok: false, code, message });

  function cleanStorageRaw(raw) {
    if (!raw) return '';
    if (raw.endsWith('\n')) return raw;
    const lastBreak = raw.lastIndexOf('\n');
    const tail = raw.slice(lastBreak + 1);
    try {
      const event = JSON.parse(tail);
      if (event && typeof event.event === 'string') return raw + '\n';
    } catch { /* the tail is the interrupted append */ }
    return lastBreak >= 0 ? raw.slice(0, lastBreak + 1) : '';
  }

  function readPersisted() {
    if (persistedEvents) return persistedEvents;
    let raw = '';
    try { raw = localStorage.getItem(STORAGE_KEY) || ''; } catch { raw = ''; }
    const clean = cleanStorageRaw(raw);
    if (clean !== raw) {
      try { localStorage.setItem(STORAGE_KEY, clean); } catch { /* storage may be unavailable */ }
    }
    const events = [];
    for (const line of clean.split('\n')) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        if (event && typeof event.event === 'string') events.push(event);
      } catch { /* discard any other unparseable line */ }
    }
    persistedEvents = events;
    return events;
  }

  function allEvents() { return [...readPersisted(), ...memoryEvents]; }

  function appendEvent(event) {
    readPersisted();
    memoryEvents.push(event);
    cache.clear();
    try {
      const all = allEvents();
      localStorage.setItem(STORAGE_KEY, all.map(entry => JSON.stringify(entry)).join('\n') + '\n');
      return true;
    } catch { return false; /* memory-only fallback when browser storage is unavailable */ }
  }

  const cloneAnnotation = annotation => annotation ? { ...annotation, anchor: { ...annotation.anchor } } : null;

  function appDeliveries() {
    const app = P.app;
    return app && Array.isArray(app.deliveries) ? app.deliveries : (data().deliveries || []);
  }

  function appRecords() {
    return P.app?.currentDelivery?.records || {};
  }

  function canonicalSnapshotOf(snapshotId) {
    const d = data();
    if (d.snapshot?.snapshotId === snapshotId) return d.snapshot;
    if (d.records?.[snapshotId]?.snapshot) return d.records[snapshotId].snapshot;
    if (d.history?.snapshot?.snapshotId === snapshotId) return d.history.snapshot;
    return null;
  }

  function snapshotSignature(snapshot) {
    return (snapshot?.files || []).map(file => [
      file.path, file.oldPath || '', file.change, file.kind,
      file.baseMode || '', file.headMode || '',
      file.baseSha256 || '', file.headSha256 || '',
    ].join('|')).sort().join('\n');
  }

  function writeSnapshotOf(snapshotId) {
    if (!snapshotId) return { error: failure('snapshot-not-found', '审查记录不存在') };
    if (isSnapshotDeleted(snapshotId)) return { error: failure('snapshot-deleted', '审查记录已删除，不能写入批注') };
    const canonical = canonicalSnapshotOf(snapshotId);
    const live = P.app?.snapshot?.snapshotId === snapshotId ? P.app.snapshot : null;
    if (canonical && live && snapshotSignature(canonical) !== snapshotSignature(live)) {
      return { error: failure('snapshot-mismatch', '当前审查记录与冻结记录不一致，不能写入批注') };
    }
    const snapshot = canonical || live || appRecords()[snapshotId]?.snapshot || null;
    if (!snapshot) return { error: failure('snapshot-not-found', '审查记录不存在') };
    return { snapshot };
  }

  function isSnapshotDeleted(snapshotId) {
    return allEvents().some(event => event.event === 'delete-snapshot' && event.snapshotId === snapshotId);
  }

  function seedAnnotations(snapshotId) {
    const d = data();
    if (d.snapshot?.snapshotId === snapshotId) return d.seedAnnotations || [];
    if (d.records?.[snapshotId]) return d.records[snapshotId].seedAnnotations || [];
    if (d.history?.snapshot?.snapshotId === snapshotId) return d.history.seedAnnotations || [];
    return [];
  }

  function isEditable(snapshotId) {
    if (isSnapshotDeleted(snapshotId)) return false;
    const delivery = appDeliveries().find(item => item.latestSnapshotId === snapshotId);
    return Boolean(delivery) && !delivery.closedAt;
  }

  function applyMarks(findings, marks) {
    const byId = new Map((marks || []).map(mark => [mark.findingId, mark]));
    return (findings || []).map(finding => {
      const mark = byId.get(finding.findingId);
      return mark && Object.prototype.hasOwnProperty.call(mark, 'suppressed')
        ? { ...finding, suppressed: Boolean(mark.suppressed) }
        : { ...finding, suppressed: Boolean(finding.suppressed) };
    });
  }

  function canonicalFindings(snapshotId) {
    const d = data();
    if (d.snapshot?.snapshotId === snapshotId) return { findings: d.findings || [], marks: d.marks || [] };
    if (d.records?.[snapshotId]) return { findings: d.records[snapshotId].findings || [], marks: d.records[snapshotId].marks || [] };
    if (d.history?.snapshot?.snapshotId === snapshotId) return { findings: d.history.findings || [], marks: d.history.marks || [] };
    return null;
  }

  function mergeMarks(base, overlay) {
    const merged = new Map((base || []).map(mark => [mark.findingId, mark]));
    for (const mark of overlay || []) merged.set(mark.findingId, mark);
    return [...merged.values()];
  }

  function recordFindings(snapshotId) {
    const canonical = canonicalFindings(snapshotId);
    const captured = appRecords()[snapshotId];
    if (canonical) {
      const marks = captured?.marks?.length ? mergeMarks(canonical.marks, captured.marks) : canonical.marks;
      return applyMarks(canonical.findings, marks);
    }
    if (captured) return applyMarks(captured.findings || [], captured.marks || []);
    return [];
  }

  function liveFinding(snapshotId, findingId) {
    if (!findingId || P.app?.snapshot?.snapshotId !== snapshotId) return null;
    for (const issues of Object.values(P.app.issueItemsByFile || {})) {
      const issue = issues.find(entry => entry.issueKey === findingId);
      if (issue) return { finding: issue.finding, suppressed: Boolean(issue.suppressed) };
    }
    return null;
  }

  function findingContext(annotation) {
    if (!annotation?.findingId) return null;
    const live = liveFinding(annotation.snapshotId, annotation.findingId);
    if (live) return { findingId: annotation.findingId, title: live.finding.title, suppressed: live.suppressed };
    const finding = recordFindings(annotation.snapshotId).find(entry => entry.findingId === annotation.findingId);
    return finding ? { findingId: finding.findingId, title: finding.title, suppressed: Boolean(finding.suppressed) } : null;
  }

  function validateText(raw) {
    const text = normalize(raw);
    const visible = String(text).replace(/[\p{Cc}\p{Cf}\p{Z}]/gu, '');
    if (!visible.trim()) return failure('empty', '批注内容不能为空');
    if (lengthOf(text) > MAX_CODE_POINTS) return failure('too-long', `批注最多 ${MAX_CODE_POINTS} 字`);
    return { ok: true, text };
  }

  function sideFacts(file, side) {
    if (!file || file.kind !== 'text') return null;
    if (side === 'base') {
      if (!file.baseSha256) return null;
      return { sha256: file.baseSha256, lineCount: Number.isInteger(file.baseLineCount) ? file.baseLineCount : null };
    }
    if (side === 'head') {
      if (!file.headSha256) return null;
      return { sha256: file.headSha256, lineCount: Number.isInteger(file.headLineCount) ? file.headLineCount : null };
    }
    return null;
  }

  function fileForAnchor(snapshot, anchor) {
    return (snapshot.files || []).find(entry => entry.path === anchor.path ||
      (anchor.side === 'base' && entry.oldPath === anchor.path));
  }

  function validateAnchor(snapshot, anchor) {
    if (!anchor || typeof anchor.path !== 'string' || !anchor.path) return failure('invalid-anchor', '批注位置无效');
    if (!['base', 'head'].includes(anchor.side)) return failure('invalid-side', '批注位置必须指明旧代码或新代码');
    const file = fileForAnchor(snapshot, anchor);
    const facts = sideFacts(file, anchor.side);
    if (!facts) return failure('no-frozen-text', '该位置没有冻结文本，不能批注');
    if (anchor.sha256 !== facts.sha256) return failure('sha-mismatch', '批注锚点的文件哈希与审查记录不一致');
    const startNull = anchor.startLine === null || anchor.startLine === undefined;
    const endNull = anchor.endLine === null || anchor.endLine === undefined;
    if (startNull || endNull) {
      if (!(startNull && endNull)) return failure('invalid-lines', '批注行号必须同时为空或同时有效');
      return { ok: true, anchor: { path: file.path, side: anchor.side, startLine: null, endLine: null, sha256: facts.sha256 } };
    }
    if (!Number.isInteger(facts.lineCount) || facts.lineCount < 1) {
      return failure('missing-line-metadata', '缺少冻结文本行数，不能按行批注');
    }
    if (!Number.isInteger(anchor.startLine) || !Number.isInteger(anchor.endLine) ||
        anchor.startLine < 1 || anchor.endLine < anchor.startLine || anchor.endLine > facts.lineCount) {
      return failure('invalid-lines', '行号超出冻结文本范围');
    }
    return {
      ok: true,
      anchor: { path: file.path, side: anchor.side, startLine: anchor.startLine, endLine: anchor.endLine, sha256: facts.sha256 },
    };
  }

  function anchorFromFinding(snapshot, finding) {
    const raw = finding?.anchor;
    if (!raw?.path || !['base', 'head'].includes(raw.side)) return failure('finding-anchor-invalid', '该问题的锚点没有冻结文本');
    const file = fileForAnchor(snapshot, raw);
    const facts = sideFacts(file, raw.side);
    if (!facts) return failure('finding-anchor-invalid', '该问题的锚点没有冻结文本');
    const line = raw.line === null || raw.line === undefined ? null : raw.line;
    return validateAnchor(snapshot, {
      path: raw.path, side: raw.side, startLine: line, endLine: line, sha256: facts.sha256,
    });
  }

  function locateAnnotation(annotationId) {
    const events = allEvents();
    for (let index = events.length - 1; index >= 0; index--) {
      const event = events[index];
      if (event.event === 'delete' && event.annotationId === annotationId) return null;
      if ((event.event === 'add' || event.event === 'update') && event.annotation?.annotationId === annotationId) {
        return { ...event.annotation };
      }
    }
    const seedIds = new Set([
      data().snapshot?.snapshotId,
      ...Object.keys(data().records || {}),
      data().history?.snapshot?.snapshotId,
    ]);
    for (const snapshotId of seedIds) {
      if (!snapshotId) continue;
      const seed = seedAnnotations(snapshotId).find(item => item.annotationId === annotationId);
      if (seed) return { ...seed };
    }
    return null;
  }

  function list(snapshotId) {
    if (!snapshotId || isSnapshotDeleted(snapshotId)) return [];
    if (cache.has(snapshotId)) return cache.get(snapshotId).map(cloneAnnotation);
    const entries = new Map();
    for (const seed of seedAnnotations(snapshotId)) entries.set(seed.annotationId, cloneAnnotation(seed));
    for (const event of allEvents()) {
      if (event.event === 'add' || event.event === 'update') {
        const annotation = event.annotation;
        if (annotation?.snapshotId === snapshotId) entries.set(annotation.annotationId, cloneAnnotation(annotation));
      } else if (event.event === 'delete') {
        if (event.snapshotId === snapshotId && event.annotationId) entries.delete(event.annotationId);
      }
    }
    const result = [...entries.values()];
    cache.set(snapshotId, result);
    return result.map(cloneAnnotation);
  }

  function add({ snapshotId, anchor, findingId, text } = {}) {
    const target = writeSnapshotOf(snapshotId);
    if (target.error) return target.error;
    if (!isEditable(snapshotId)) return failure('readonly', '更早的审查记录与已合并交付为只读，不能写入批注');
    const validatedText = validateText(text);
    if (!validatedText.ok) return validatedText;
    let resolvedAnchor;
    if (findingId) {
      const live = liveFinding(snapshotId, findingId);
      const finding = live?.finding || recordFindings(snapshotId).find(entry => entry.findingId === findingId);
      if (!finding) return failure('finding-not-found', '关联的问题不在本次审查记录中');
      const derived = anchorFromFinding(target.snapshot, finding);
      if (!derived.ok) return derived;
      resolvedAnchor = derived.anchor;
    } else {
      const validated = validateAnchor(target.snapshot, anchor);
      if (!validated.ok) return validated;
      resolvedAnchor = validated.anchor;
    }
    const now = P.nowIso();
    const annotation = {
      annotationId: 'ann-' + P.sha256([snapshotId, resolvedAnchor.path, resolvedAnchor.side, resolvedAnchor.startLine, validatedText.text, now, Math.random()].join('|')).slice(0, 12),
      snapshotId,
      anchor: resolvedAnchor,
      text: validatedText.text,
      ...(findingId ? { findingId } : {}),
      createdAt: now,
      updatedAt: now,
    };
    const persisted = appendEvent({ event: 'add', annotation });
    return { ok: true, annotation: cloneAnnotation(annotation), persisted };
  }

  // User writes revalidate text and anchor against the frozen snapshot; only host lifecycle deletions may bypass it.
  function update(annotationId, { text } = {}) {
    const current = locateAnnotation(annotationId);
    if (!current) return failure('not-found', '批注不存在');
    const target = writeSnapshotOf(current.snapshotId);
    if (target.error) return target.error;
    if (!isEditable(current.snapshotId)) return failure('readonly', '更早的审查记录与已合并交付为只读，不能编辑批注');
    const validatedText = validateText(text);
    if (!validatedText.ok) return validatedText;
    const validatedAnchor = resolveAnchor(target.snapshot, current);
    if (!validatedAnchor.ok) return validatedAnchor;
    const annotation = { ...current, anchor: validatedAnchor.anchor, text: validatedText.text, updatedAt: P.nowIso() };
    const persisted = appendEvent({ event: 'update', annotation });
    return { ok: true, annotation: cloneAnnotation(annotation), persisted };
  }

  function remove(annotationId) {
    const current = locateAnnotation(annotationId);
    if (!current) return failure('not-found', '批注不存在');
    const target = writeSnapshotOf(current.snapshotId);
    if (target.error) return target.error;
    if (!isEditable(current.snapshotId)) return failure('readonly', '更早的审查记录与已合并交付为只读，不能删除批注');
    const persisted = appendEvent({
      event: 'delete', annotationId, snapshotId: current.snapshotId,
      origin: 'user', annotation: cloneAnnotation(current),
    });
    return { ok: true, annotation: cloneAnnotation(current), persisted };
  }

  function restore(annotation) {
    if (!annotation?.annotationId || !annotation.snapshotId) return failure('not-found', '批注不存在');
    const events = allEvents();
    let deletion = null;
    for (let index = events.length - 1; index >= 0; index--) {
      const event = events[index];
      if ((event.event === 'add' || event.event === 'update') && event.annotation?.annotationId === annotation.annotationId) break;
      if (event.event === 'delete' && event.annotationId === annotation.annotationId && event.snapshotId === annotation.snapshotId) {
        deletion = event;
        break;
      }
    }
    if (!deletion) return failure('not-found', '只能撤销刚删除的批注');
    if (deletion.origin !== 'user' || !deletion.annotation) return failure('not-found', '只能撤销本次手动删除的批注');
    const source = deletion.annotation;
    const target = writeSnapshotOf(source.snapshotId);
    if (target.error) return target.error;
    if (!isEditable(source.snapshotId)) return failure('readonly', '更早的审查记录与已合并交付为只读，不能恢复批注');
    const validatedText = validateText(source.text);
    if (!validatedText.ok) return validatedText;
    const validatedAnchor = resolveAnchor(target.snapshot, source);
    if (!validatedAnchor.ok) return validatedAnchor;
    const restored = { ...source, anchor: validatedAnchor.anchor, text: validatedText.text };
    const persisted = appendEvent({ event: 'add', annotation: restored });
    return { ok: true, annotation: cloneAnnotation(restored), persisted };
  }

  function resolveAnchor(snapshot, annotation) {
    if (annotation.findingId) {
      const live = liveFinding(annotation.snapshotId, annotation.findingId);
      const finding = live?.finding || recordFindings(annotation.snapshotId).find(entry => entry.findingId === annotation.findingId);
      if (!finding) return failure('finding-not-found', '关联的问题不在本次审查记录中');
      return anchorFromFinding(snapshot, finding);
    }
    return validateAnchor(snapshot, annotation.anchor);
  }

  // Host lifecycle cleanup: deleting a record or delivery removes its annotations even when the record was read-only.
  function deleteSnapshot(snapshotId, origin = 'snapshot') {
    if (!snapshotId) return 0;
    if (isSnapshotDeleted(snapshotId)) return 0;
    const known = new Map();
    for (const seed of seedAnnotations(snapshotId)) known.set(seed.annotationId, cloneAnnotation(seed));
    for (const event of allEvents()) {
      if (event.annotation?.snapshotId === snapshotId) known.set(event.annotation.annotationId, cloneAnnotation(event.annotation));
      if (event.event === 'delete' && event.snapshotId === snapshotId && !known.has(event.annotationId)) {
        known.set(event.annotationId, null);
      }
    }
    for (const [annotationId, annotation] of known) {
      appendEvent({
        event: 'delete', annotationId, snapshotId, origin,
        ...(annotation ? { annotation } : {}),
      });
    }
    appendEvent({ event: 'delete-snapshot', snapshotId, origin, at: P.nowIso() });
    cache.delete(snapshotId);
    return known.size;
  }

  function deleteDelivery(delivery) {
    if (!delivery) return 0;
    const ids = new Set([
      delivery.latestSnapshotId,
      ...(delivery.snapshots || []).map(entry => entry.snapshotId),
    ].filter(Boolean));
    let removed = 0;
    for (const snapshotId of ids) removed += deleteSnapshot(snapshotId, 'delivery');
    return removed;
  }

  function eventsFor(snapshotId) {
    return allEvents()
      .filter(event => event.snapshotId === snapshotId ||
        (event.annotation && event.annotation.snapshotId === snapshotId))
      .map(event => ({ ...event, ...(event.annotation ? { annotation: cloneAnnotation(event.annotation) } : {}) }));
  }

  function storageText() {
    const events = allEvents();
    return events.map(event => JSON.stringify(event)).join('\n') + (events.length ? '\n' : '');
  }

  P.annotations = Object.freeze({
    STORAGE_KEY,
    MAX_CODE_POINTS,
    add, update, remove, restore, list,
    findingContext, isEditable,
    deleteSnapshot, deleteDelivery,
    eventsFor, storageText,
  });
})();
