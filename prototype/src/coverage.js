/* Review targets come only from the frozen snapshot file identities. */
(function () {
  'use strict';
  const P = window.CRPrototype = window.CRPrototype || {};

  const isMetadataOnlyChange = file => file.change === 'mode-changed' ||
    (file.change === 'renamed' && Boolean(file.baseSha256) && file.baseSha256 === file.headSha256);

  const isReviewTargetFile = file => Boolean(file) &&
    file.kind === 'text' && !isMetadataOnlyChange(file);

  function reviewTargetsOf(snapshot) {
    return (snapshot?.files || []).filter(isReviewTargetFile).map(file => file.path);
  }

  function fileIdentityOf(file) {
    return {
      path: file?.path ?? null,
      oldPath: file?.oldPath ?? null,
      change: file?.change ?? null,
      kind: file?.kind ?? null,
      baseMode: file?.baseMode ?? null,
      headMode: file?.headMode ?? null,
      baseSha256: file?.baseSha256 ?? null,
      headSha256: file?.headSha256 ?? null,
    };
  }

  function identityKeyOf(file) {
    return JSON.stringify(fileIdentityOf(file));
  }

  function diffFileIdentities(previousFiles, currentFiles) {
    const previous = new Map((previousFiles || []).map(file => [file.path, file]));
    const current = new Map((currentFiles || []).map(file => [file.path, file]));
    const changed = [], added = [], removed = [];
    for (const [path, after] of current) {
      const before = previous.get(path);
      if (!before) added.push({ path, before: null, after });
      else if (identityKeyOf(before) !== identityKeyOf(after)) changed.push({ path, before, after });
    }
    for (const [path, before] of previous) if (!current.has(path)) removed.push({ path, before, after: null });
    return { changed, added, removed };
  }

  // Stable identity for withheld conclusions: equal kind/ref/code is the same entry.
  const withheldIdentity = entry => [
    entry?.kind || 'finding',
    entry?.ref || entry?.findingRef || entry?.findingId || '',
    entry?.code || 'unknown',
  ].join('\u0000');

  const normalizeWithheld = entry => ({
    kind: entry?.kind || 'finding',
    ref: entry?.ref || entry?.findingRef || entry?.findingId || '',
    code: entry?.code || 'unknown',
  });

  function mergeWithheld(formal, details) {
    const merged = [];
    const seen = new Set();
    for (const raw of [...(formal || []), ...(details || [])]) {
      const entry = normalizeWithheld(raw);
      const key = withheldIdentity(entry);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(entry);
    }
    return merged;
  }

  function coverageErrorOf(coverage, targets) {
    const reviewed = coverage?.reviewed || [];
    const reviewedSet = new Set(reviewed);
    const targetSet = new Set(targets);
    const duplicate = reviewed.length !== reviewedSet.size;
    const missing = targets.filter(path => !reviewedSet.has(path));
    const outside = reviewed.filter(path => !targetSet.has(path));
    if (!duplicate && !missing.length && !outside.length) return '';
    const parts = [];
    if (missing.length) parts.push(`缺少 ${missing.length} 个已审文件`);
    if (outside.length) parts.push(`含 ${outside.length} 个范围外路径`);
    if (duplicate) parts.push('存在重复');
    return `审查覆盖记录不完整：${parts.join('、')}`;
  }

  P.coverage = Object.freeze({
    isReviewTargetFile, isMetadataOnlyChange, reviewTargetsOf, fileIdentityOf, identityKeyOf, diffFileIdentities, coverageErrorOf,
    withheldIdentity, normalizeWithheld, mergeWithheld,
  });
})();
