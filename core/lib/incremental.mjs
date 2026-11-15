import { canonical, fileIdentity, requirementDigest, sha256, isTarget } from './common.mjs';

const copy = value => structuredClone(value);
export function carryable(snapshot, sourceSnapshot, sourceRun) {
  const same = sourceSnapshot && sourceRun && sourceSnapshot.deliveryId === snapshot.deliveryId &&
    sourceRun.deliveryId === snapshot.deliveryId && ['succeeded', 'partial'].includes(sourceRun.status) &&
    snapshot.rulesVersion === sourceSnapshot.rulesVersion && snapshot.promptVersion === sourceSnapshot.promptVersion &&
    requirementDigest(snapshot.requirements) === requirementDigest(sourceSnapshot.requirements);
  if (!same) return [];
  return snapshot.files.filter(isTarget).filter(file => {
    const old = sourceSnapshot.files.find(f => f.path === file.path);
    return old && canonical(fileIdentity(file)) === canonical(fileIdentity(old)) && sourceRun.coverage.reviewed.includes(file.path) &&
      !(sourceRun.withheldDetails ?? []).some(item => item.paths === null || item.paths.includes(file.path));
  }).map(file => file.path);
}
export function affectedWithheld(model, withheld, snapshot) {
  const normalize = name => snapshot.files.find(f => f.path === name || f.oldPath === name)?.path ?? name;
  return withheld.map(item => {
    let paths = null;
    if (item.kind === 'finding') {
      const finding = model.findings[Number(item.ref.slice('finding:'.length))];
      if (finding) paths = [normalize(finding.anchor.path)];
    } else if (item.ref.startsWith('file:')) {
      const file = snapshot.files.find(f => item.ref === 'file:' + f.path || item.ref.startsWith('file:' + f.path + ':'));
      if (file) paths = [file.path];
    } else if (item.ref.startsWith('feature:')) paths = model.features.find(f => f.featureId === item.ref.slice(8))?.files ?? null;
    return { ...copy(item), paths };
  });
}
export function remapResult(source, { runId, snapshotId, generation, deliveryId }) {
  const result = copy(source), features = Object.fromEntries(result.understanding.features.map(f => [f.featureId, 'feature-' + sha256(canonical([runId, f.featureId])).slice(0, 24)]));
  const findingIds = {};
  result.understanding.features.forEach(f => { f.featureId = features[f.featureId]; });
  result.understanding.files.forEach(f => { f.featureIds = f.featureIds.map(id => features[id]); f.carriedFrom = { runId: source.runId, snapshotId: source.snapshotId }; });
  result.findings.forEach(f => {
    const old = f.findingId, id = 'finding-' + sha256(canonical([runId, old])).slice(0, 24); findingIds[old] = id;
    f.findingId = id; f.runId = runId; f.carriedFrom = { runId: source.runId, snapshotId: source.snapshotId, findingId: old };
  });
  Object.assign(result, { runId, snapshotId, generation, deliveryId, carriedFrom: { runId: source.runId, snapshotId: source.snapshotId } });
  return { result, findingIds };
}
export function applyScope(validation, model, snapshot, reviewedPaths, carriedPaths = [], sourceRun = null) {
  const { run, understanding, findings } = copy(validation.formal);
  const all = snapshot.files.filter(isTarget).map(f => f.path), actual = new Set([...reviewedPaths, ...carriedPaths]);
  const withheldDetails = affectedWithheld(model, validation.withheld, snapshot);
  const acceptedFindings = findings.filter(f => reviewedPaths.includes(f.anchor.path));
  for (const finding of findings.filter(f => !reviewedPaths.includes(f.anchor.path))) {
    run.coverage.withheld.push({ kind: 'finding', ref: finding.findingId, code: 'out-of-scope' });
    withheldDetails.push({ kind: 'finding', ref: finding.findingId, code: 'out-of-scope', paths: [finding.anchor.path] });
  }
  const inheritedMarks = [];
  if (sourceRun) for (const name of carriedPaths) {
    const fresh = understanding.files.find(f => f.path === name), old = sourceRun.understanding.files.find(f => f.path === name);
    if (fresh && old) Object.assign(fresh, { semantic: copy(old.semantic), basis: old.basis, carriedFrom: { runId: sourceRun.runId, snapshotId: sourceRun.snapshotId } });
    for (const oldFinding of sourceRun.findings.filter(f => f.anchor.path === name)) {
      const findingId = 'finding-' + sha256(canonical([run.runId, oldFinding.findingId])).slice(0, 24);
      acceptedFindings.push({ ...copy(oldFinding), findingId, runId: run.runId, carriedFrom: { runId: sourceRun.runId, snapshotId: sourceRun.snapshotId, findingId: oldFinding.findingId } });
      inheritedMarks.push({ oldFindingId: oldFinding.findingId, findingId, oldSnapshotId: sourceRun.snapshotId });
    }
  }
  run.coverage.reviewed = all.filter(name => actual.has(name));
  const covered = run.coverage.reviewed.length === all.length;
  if (!covered) for (const row of understanding.alignment) if (['implemented', 'partial'].includes(row.status)) { row.status = 'unclear'; row.note = '审查覆盖不足，需确认：' + row.note; }
  run.status = covered ? 'succeeded' : 'partial';
  run.complete = snapshot.status === 'complete' && run.status === 'succeeded' && !run.coverage.failed.length && !run.coverage.withheld.length && covered;
  const rank = { P0: 0, P1: 1, P2: 2 };
  acceptedFindings.sort((a, b) => rank[a.severity] - rank[b.severity] || all.indexOf(a.anchor.path) - all.indexOf(b.anchor.path) || (a.anchor.line ?? Infinity) - (b.anchor.line ?? Infinity));
  return { ...run, understanding, findings: acceptedFindings, withheldDetails, inheritedMarks };
}
export const scopePaths = (scope, targets) => {
  if (scope === 'all' || scope === 'incremental') return new Set(targets);
  if (typeof scope !== 'string' || !scope.startsWith('file:') || !targets.includes(scope.slice(5))) throw Error('Invalid review scope or non-target file');
  return new Set([scope.slice(5)]);
};
export const covers = (run, paths) => run.status === 'succeeded' && run.complete && [...paths].every(p => run.coverage.reviewed.includes(p));
