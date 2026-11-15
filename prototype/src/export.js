/* Browser-only export: Markdown log and self-contained HTML report. No network. */
(function () {
  'use strict';
  const P = window.CRPrototype = window.CRPrototype || {};
  const CATEGORY_LABEL = { logic: '逻辑', security: '安全', performance: '性能' };
  const KIND_LABEL = { api: 'API', data: '数据', config: '配置', behavior: '行为', dependency: '依赖', ui: '界面' };
  const REPORT_APP_LIGHT = '<svg class="report-icon report-icon--light" width="40" height="40" viewBox="0 0 512 512" aria-hidden="true"><line x1="345" y1="345" x2="438" y2="438" stroke="#0b0f1c" stroke-width="96" stroke-linecap="round"/><line x1="345" y1="345" x2="438" y2="438" stroke="#4176e6" stroke-width="40" stroke-linecap="round"/><circle cx="233" cy="233" r="195" fill="#ebe9e8" stroke="#0b0f1c" stroke-width="32"/><path d="M190 185 137 236l53 52M285 185l53 51-53 52" fill="none" stroke="#0b0f1c" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const REPORT_APP_DARK = '<svg class="report-icon report-icon--dark" width="40" height="40" viewBox="0 0 512 512" aria-hidden="true"><line x1="345" y1="345" x2="438" y2="438" stroke="#f1f3f5" stroke-width="96" stroke-linecap="round"/><line x1="345" y1="345" x2="438" y2="438" stroke="#7aaaff" stroke-width="40" stroke-linecap="round"/><circle cx="233" cy="233" r="195" fill="#2c2e35" stroke="#f1f3f5" stroke-width="32"/><path d="M190 185 137 236l53 52M285 185l53 51-53 52" fill="none" stroke="#f1f3f5" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const MAX_SNIPPET_LINES = 30;
  const MAX_DIFF_LINES = 400;
  const MAX_HTML_BYTES = 3 * 1024 * 1024;
  const MAX_REQUIREMENT_BYTES = 64 * 1024;
  const MAX_FINDING_FIELD_BYTES = 16 * 1024;
  const MAX_EVIDENCE_BYTES = 16 * 1024;
  const MAX_UNDERSTANDING_BYTES = 16 * 1024;
  const SECRET_PATTERNS = [
    [/((?:["']?)(?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password|authorization)(?:["']?)\s*[:=]\s*)(["'])([^"']*)\2/gi,
      (_match, prefix, quote) => `${prefix}${quote}***${quote}`],
    [/((?:["']?)(?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password|authorization)(?:["']?)\s*[:=]\s*)\[([^\]]*)\]/gi,
      (_match, prefix, body) => `${prefix}[${body.replace(/[^\s,\[\]{}]+/g, '***')}]`],
    [/(authorization\s*[:=]\s*)(Bearer\s+)?([^\s'"[\]{]+)/gi, (_match, prefix, bearer) => `${prefix}${bearer || ''}***`],
    [/((?:["']?)(?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password|authorization)(?:["']?)\s*[:=]\s*)([^\s'"[\]{]{8,})/gi, '$1***'],
    [/\bsk-[A-Za-z0-9_-]{16,}\b/g, 'sk-***'],
    [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, 'gh-***'],
  ];

  const escapeHtml = value => P.escape(maskSecrets(String(value ?? '')));
  const maskSecrets = value => SECRET_PATTERNS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), String(value ?? ''));
  const SECRET_KEY = /^(?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password|authorization)$/i;
  const redactSecrets = value => {
    if (typeof value === 'string') return '***';
    if (Array.isArray(value)) return value.map(redactSecrets);
    if (value && typeof value === 'object') {
      const copy = {};
      for (const [key, entry] of Object.entries(value)) copy[key] = redactSecrets(entry);
      return copy;
    }
    return value;
  };
  const maskDeep = value => {
    if (typeof value === 'string') return maskSecrets(value);
    if (Array.isArray(value)) return value.map(maskDeep);
    if (value && typeof value === 'object') {
      const copy = {};
      for (const [key, entry] of Object.entries(value)) {
        copy[key] = SECRET_KEY.test(key) ? redactSecrets(entry) : maskDeep(entry);
      }
      return copy;
    }
    return value;
  };
  const byteLength = value => new TextEncoder().encode(String(value ?? '')).length;
  const truncateToBytes = (value, limit) => {
    const text = String(value ?? '');
    if (byteLength(text) <= limit) return text;
    let low = 0, high = text.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (byteLength(text.slice(0, middle)) <= limit) low = middle;
      else high = middle - 1;
    }
    return text.slice(0, low);
  };
  const formatLimit = bytes => `${Math.round(bytes / 1024)} KiB`;
  const capString = (value, limit, max) => byteLength(value) > limit ? truncateToBytes(value, max) : value;
  const lines = (value, limit) => {
    const all = String(value ?? '').replace(/\r\n/g, '\n').split('\n');
    return limit && all.length > limit ? all.slice(0, limit) : all;
  };
  // Only call for already-redacted patch text, never evidence.quote source code.
  // Physical lines carry no inferred source coordinates or finding highlights.
  const renderDiff = text => `<pre class="report-diff">${String(maskSecrets(text)).split('\n').map(line => {
    const kind = line.startsWith('+') ? 'add' : line.startsWith('-') ? 'del' : line.startsWith('@@') ? 'hunk' : '';
    return kind ? `<span class="report-diff-line report-diff-${kind}">${P.escape(line)}</span>` : P.escape(line);
  }).join('\n')}</pre>`;
  const refsLabel = refs => (refs || []).map(ref => `${ref.path}${ref.startLine ? ':' + ref.startLine : ''}`).join('、');
  const statusLabel = (context, file) => {
    if (file.reviewStatus === 'skipped' || file.reviewStatus === 'metadata') return '跳过';
    if (file.reviewStatus === 'pending') return '待审';
    if (file.reviewStatus === 'failed') return '失败';
    if (file.reviewStatus === 'carried') return '沿用自 ' + (file.carriedFromLabel || '更早的审查');
    if (file.kind && file.kind !== 'text') return '跳过';
    return '已审';
  };
  const changeLabel = change => ({ added: '新增', modified: '修改', deleted: '删除', renamed: '改名', 'mode-changed': '权限变更' }[change] || change || '—');
  const findingLabel = finding => `${CATEGORY_LABEL[finding.category] || finding.category || '逻辑'} · ${finding.severity || 'P2'}`;
  const findingLocation = finding => `${finding.anchor?.path || ''}${finding.anchor?.line ? ':' + finding.anchor.line : ''}`;
  const findingStatus = finding => finding.suppressed ? '已标记为非问题' : '待处理问题';
  const annotationLocation = annotation => annotation?.anchor?.startLine
    ? `${annotation.anchor.path}:${annotation.anchor.startLine}`
    : `${annotation?.anchor?.path || ''}（文件级）`;
  const fileReason = file => {
    if (file.kind === 'binary') return '二进制文件，未载入文本差异；可在编辑器中打开查看完整文件';
    if (file.kind === 'oversize') return (file.note || '超过大小上限，未载入文本差异') + '；可在编辑器中打开查看完整文件';
    if (file.kind === 'excluded') return file.note || '已按工作区规则排除';
    if (file.kind === 'symlink') return '符号链接，仅记录链接目标';
    if (file.kind === 'submodule') return '子模块，仅记录提交指针';
    if (file.kind === 'conflicted') return '存在未解决的合并冲突';
    if (!file.diff) return '没有可展示的文本差异';
    return '';
  };

  function relativeChangeItems(context) {
    const previous = context.previousSnapshot;
    if (!previous) return ['这是该交付的第一份审查记录。'];
    const delta = P.coverage.diffFileIdentities(previous.files || [], context.files.map(file => file.file));
    const items = [
      ...delta.added.map(entry => `新增 ${entry.path}`),
      ...delta.changed.map(entry => `修改 ${entry.path}`),
      ...delta.removed.map(entry => `移除 ${entry.path}`),
    ];
    const previousRequirements = (previous.requirements || []).map(source => source.sha256).join(',');
    const currentRequirements = (context.requirements || []).map(source => source.sha256).join(',');
    if (previousRequirements !== currentRequirements) items.push('需求依据已更新');
    return items.length ? items : ['与上次审查相比，文件清单与内容没有变化。'];
  }

  const isUnderstandingValid = understanding => Boolean(understanding && !understanding.stale);

  function buildExportContext(source) {
    const sourceFiles = source.files || source.normalizedDiffItems || [];
    const files = sourceFiles.map(item => {
      const file = item.file || item;
      return {
        path: item.path || file.path,
        change: file.change,
        kind: file.kind,
        additions: file.additions,
        deletions: file.deletions,
        note: file.note,
        diff: item.origin?.diff ?? item.diff ?? file.diff ?? '',
        findings: P.issues.effectiveFindings(item),
        withheld: item.withheld || [],
        reviewStatus: item.reviewStatus,
        file,
      };
    });
    return {
      project: source.project || {},
      delivery: source.delivery || source.currentDelivery || {},
      snapshot: source.snapshot || {},
      run: source.run || null,
      requirements: source.snapshot?.requirements || source.requirements || [],
      understanding: isUnderstandingValid(source.understanding) ? source.understanding : {
        overview: {}, features: [], files: [], impacts: [], alignment: [], extras: [], stale: true,
      },
      coverage: source.coverage || {},
      marks: source.marks || [],
      annotations: Array.isArray(source.annotations) ? source.annotations
        : (P.annotations?.list?.(source.snapshot?.snapshotId || '') || []),
      files,
      summary: source.summary || { fileCount: files.length, additions: 0, deletions: 0 },
      meta: window.CR_PROTOTYPE_DATA?.meta || {},
    };
  }

  function exportReview(context) {
    const snapshot = context.snapshot || {};
    const run = context.run || null;
    const files = context.files || [];
    const coverage = context.coverage || {};
    const finished = new Set(['reviewed', 'carried', 'skipped', 'metadata']);
    const statusesKnown = files.every(file => typeof file.reviewStatus === 'string');
    const outstanding = files.filter(file => file.reviewStatus && !finished.has(file.reviewStatus));
    const failedFiles = outstanding.filter(file => file.reviewStatus === 'failed');
    const pending = outstanding.filter(file => file.reviewStatus !== 'failed').length;
    const reviewed = files.filter(file => file.reviewStatus === 'reviewed' || file.reviewStatus === 'carried').length;
    const skipped = files.filter(file => file.reviewStatus === 'skipped' || file.reviewStatus === 'metadata').length;
    const detailWithheld = [];
    for (const file of files) {
      for (const entry of file.withheld || []) {
        detailWithheld.push({
          kind: entry.kind || 'finding',
          ref: entry.findingId || entry.findingRef || entry.ref || `${file.path}:${entry.code || ''}`,
          code: entry.code || 'unknown',
        });
      }
    }
    const withheld = P.coverage.mergeWithheld(coverage.withheld || [], detailWithheld);
    const failed = [...(coverage.failed || []), ...failedFiles.map(file => ({ path: file.path, reason: '文件审查失败' }))];
    const targets = P.coverage.reviewTargetsOf(snapshot);
    const coverageError = P.coverage.coverageErrorOf(coverage, targets);
    const coverageConsistent = !coverageError;
    const statusByPath = new Map(files.map(file => [file.path, file.reviewStatus]));
    const missingResultFiles = targets.filter(path => !statusByPath.has(path));
    const unfinishedResultFiles = targets.filter(path => !['reviewed', 'carried'].includes(statusByPath.get(path)));
    const resultFilesConsistent = missingResultFiles.length === 0 && unfinishedResultFiles.length === 0;
    const complete = snapshot.status === 'complete' && run?.status === 'succeeded' &&
      statusesKnown && outstanding.length === 0 && failed.length === 0 && withheld.length === 0 &&
      coverageConsistent && resultFilesConsistent;
    let reason = '';
    if (!complete) {
      if (!run) reason = outstanding.length ? `待审，${outstanding.length} 个文件待审查` : '待审，尚无审查运行';
      else if (run.status === 'queued') reason = '审查排队中';
      else if (run.status === 'running') reason = '审查进行中';
      else if (run.status === 'cancelled') reason = '审查已取消';
      else if (run.status === 'failed') reason = '审查失败，可重试';
      else if (withheld.length) reason = `${withheld.length} 条结论证据未通过校验，未展示`;
      else if (failed.length) reason = '部分文件审查失败，可重试';
      else if (snapshot.status !== 'complete') reason = '审查记录不完整' + (snapshot.note ? `：${snapshot.note}` : '');
      else if (outstanding.length) reason = `待审，${outstanding.length} 个文件待审查`;
      else if (!statusesKnown) reason = '缺少逐文件审查状态';
      else if (!resultFilesConsistent) reason = missingResultFiles.length
        ? `审查结果文件与冻结的审查记录不一致：缺少 ${missingResultFiles.length} 个目标文件`
        : `审查结果文件与冻结的审查记录不一致：${unfinishedResultFiles.length} 个目标未完成审查`;
      else if (!coverageConsistent) reason = coverageError;
      else reason = '缺少逐文件审查结果';
    }
    const activeFindings = files.reduce((sum, file) => sum + (file.findings || []).filter(finding => !finding.suppressed).length, 0);
    const codeReadReason = (() => {
      if (snapshot.status === 'complete') return '';
      const note = String(snapshot.range?.note || snapshot.note || '');
      if (note.includes('split index')) return 'split-index';
      if (note.includes('共同历史')) return 'shallow-history';
      return 'changed-during-read';
    })();
    const reviewState = P.status.reviewStateOf({
      snapshotStatus: snapshot.status || null,
      runStatus: run?.status || null,
      pendingCount: pending,
      failedCount: failed.length,
      withheldCount: withheld.length,
      activeFindings,
      highestSeverity: null,
      complete,
      codeReadReason,
    });
    return {
      complete, reason, pending, reviewed, skipped, coverageConsistent,
      runStatus: run?.status || null,
      snapshotStatus: snapshot.status || null,
      failed, withheld,
      label: reviewState.exportText,
      conclusion: reviewState.conclusion,
    };
  }

  function alignmentGroups(context) {
    const alignment = context.understanding?.alignment || [];
    return [
      { key: 'implemented', label: '已对齐', items: alignment.filter(item => item.status === 'implemented') },
      { key: 'pending', label: '未对齐 / 待确认', items: alignment.filter(item => ['partial', 'not-found', 'unclear'].includes(item.status)) },
    ].filter(group => group.items.length);
  }

  function requirementText(context, itemId) {
    for (const source of context.requirements || []) {
      const item = (source.items || []).find(entry => entry.itemId === itemId);
      if (item) return source.text.slice(item.start, item.end);
    }
    return '';
  }

  function buildMarkdown(context) {
    context = maskDeep(context);
    const review = exportReview(context);
    const out = [];
    const delivery = context.delivery || {};
    const snapshot = context.snapshot || {};
    const range = snapshot.range || {};
    const understanding = context.understanding || {};
    const findings = context.files.flatMap(file => (file.findings || []).map(finding => ({ ...finding, path: file.path })));
    out.push(`# 变更日志 · ${delivery.title || '变更评审'}`);
    out.push('');
    out.push(`- 仓库：${context.project.displayName || '—'}`);
    if (delivery.externalRef) out.push(`- 需求编号：${delivery.externalRef}`);
    out.push(`- 分支：${delivery.branch || range.targetRef || '—'}`);
    out.push(`- 范围：${P.status.rangeTextOf({ delivery, snapshot })}`);
    out.push(`- 时间：${P.formatClock(snapshot.createdAt)}`);
    out.push(`- 基于的提交：${P.status.basedCommitOf(snapshot)}`);
    out.push(`- 审查结论：${review.label}`);
    out.push(`- 覆盖：已审 ${review.reviewed} 个文件 · 跳过 ${review.skipped} 个 · 待审 ${review.pending} 个`);
    out.push(`- 内置规则：${snapshot.rulesVersion || '—'}`);
    out.push(`- 扩展提示词：${snapshot.extensionPrompt?.text ? `已使用 · ${snapshot.extensionPrompt.length} 字` : '未使用'}`);
    if (understanding.stale) out.push('变更说明尚未生成；以下只列文件事实与审查结论。');
    out.push('');
    out.push('## 需求依据');
    if (!(context.requirements || []).length) out.push('未提供需求依据。');
    for (const source of context.requirements || []) {
      out.push(`### ${source.origin || source.kind} · ${P.formatClock(source.capturedAt)}`);
      out.push('');
      out.push(source.text);
      out.push('');
    }
    out.push('## 变更概览');
    out.push(understanding.overview?.purpose || '—');
    for (const highlight of understanding.overview?.highlights || []) {
      out.push(`- ${highlight.text}${highlight.refs?.length ? `（${refsLabel(highlight.refs)}）` : ''}`);
    }
    out.push('');
    out.push('## 按功能变更');
    for (const feature of understanding.features || []) {
      out.push(`### ${feature.title}`);
      out.push('');
      out.push(feature.purpose || '');
      if (feature.approach) out.push(feature.approach);
      if (feature.files?.length) out.push(`文件：${feature.files.join('、')}`);
      if (feature.refs?.length) out.push(`引用：${refsLabel(feature.refs)}`);
      out.push('');
    }
    out.push('## 文件清单');
    out.push('| 文件 | 变化 | + | − | 状态 | 说明 |');
    out.push('|---|---|---:|---:|---|---|');
    for (const file of context.files) {
      out.push(`| ${file.path} | ${changeLabel(file.change)} | ${file.additions ?? '—'} | ${file.deletions ?? '—'} | ${statusLabel(context, file)} | ${fileReason(file) || '—'} |`);
    }
    out.push('');
    out.push('## 行为影响');
    for (const impact of understanding.impacts || []) {
      out.push(`- [${KIND_LABEL[impact.kind] || impact.kind || '变更'}] ${impact.text}${impact.refs?.length ? `（${refsLabel(impact.refs)}）` : ''}`);
    }
    out.push('');
    out.push('## 未对齐 / 待确认');
    const pendingGroup = alignmentGroups(context).find(group => group.key === 'pending');
    if (understanding.stale) {
      out.push('变更说明尚未生成，未对齐条目未参与本次整理。');
    } else if (pendingGroup?.items.length) {
      for (const item of pendingGroup.items) {
        const text = requirementText(context, item.requirementItemId);
        out.push(`- ${text || item.requirementItemId}${item.note ? `：${item.note}` : ''}${item.codeRefs?.length ? `（${refsLabel(item.codeRefs)}）` : ''}`);
      }
    } else {
      out.push((context.requirements || []).length ? '没有未对齐条目。' : '未提供需求依据。');
    }
    if ((understanding.extras || []).length) {
      out.push('');
      out.push('### 需求外改动');
      for (const extra of understanding.extras) out.push(`- ${extra.text}${extra.refs?.length ? `（${refsLabel(extra.refs)}）` : ''}`);
    }
    out.push('');
    out.push('## 问题与处置');
    if (!findings.length) out.push(`本次审查结论：${review.label}。`);
    else if (!review.complete) out.push(`本次审查结论：${review.label}；以下为已通过校验的问题。`);
    for (const finding of findings) {
      out.push(`### ${findingLabel(finding)} · ${finding.title}`);
      out.push('');
      out.push(`- 位置：${findingLocation(finding) || finding.path}`);
      out.push(`- 处置：${findingStatus(finding)}`);
      out.push(`- 问题：${finding.problem || ''}`);
      out.push(`- 影响：${finding.impact || ''}`);
      if (finding.suggestion?.text) out.push(`- 建议：${finding.suggestion.text}`);
      for (const evidence of finding.evidence || []) {
        out.push('');
        out.push(`证据（${evidence.path}:${evidence.startLine}–${evidence.endLine}）：`);
        out.push('```');
        out.push(...lines(evidence.quote));
        out.push('```');
      }
      out.push('');
    }
    out.push('## 批注');
    if (!(context.annotations || []).length) {
      out.push('没有批注。');
    } else {
      for (const annotation of context.annotations) {
        const finding = findings.find(entry => entry.findingId === annotation.findingId);
        out.push(`### ${annotationLocation(annotation)}`);
        out.push('');
        out.push(annotation.text);
        out.push('');
        out.push(`- 时间：${P.formatClock(annotation.createdAt)}`);
        if (finding) {
          out.push(`- 关联问题：${finding.title}`);
          if (finding.suppressed) out.push('- 原问题已标记为非问题');
        }
        out.push('- 评审人意见，未经模型校验。');
        out.push('');
      }
    }
    out.push('## 与上次审查相比');
    for (const item of relativeChangeItems(context)) out.push(`- ${item}`);
    out.push('');
    out.push('## 局限');
    out.push('- 审查说明、问题与证据来自本次审查结果；文件清单与 Diff 取自本仓当前文件。');
    out.push('- 已提交改名检测、clean/process 过滤器、LFS 与冻结后一致性核对尚未实现。');
    out.push('- 导出在浏览器内完成，不会调用模型。');
    return out.join('\n') + '\n';
  }

  function htmlEscape(value) { return escapeHtml(value); }

  function prepareHtmlContext(context, omitted) {
    const note = (path, reason) => { if (!omitted.some(item => item.path === path)) omitted.push({ path, reason }); };
    let requirementTrimmed = false, findingTrimmed = false, evidenceTrimmed = false, understandingTrimmed = false;
    for (const source of context.requirements || []) {
      if (byteLength(source.text) > MAX_REQUIREMENT_BYTES) {
        source.text = truncateToBytes(source.text, MAX_REQUIREMENT_BYTES);
        source.truncated = true;
        requirementTrimmed = true;
      }
    }
    if (requirementTrimmed) note('需求依据', `单条文本超过 ${formatLimit(MAX_REQUIREMENT_BYTES)}，已截断`);
    for (const file of context.files || []) {
      for (const finding of file.findings || []) {
        for (const key of ['problem', 'impact']) {
          if (byteLength(finding[key]) > MAX_FINDING_FIELD_BYTES) {
            finding[key] = truncateToBytes(finding[key], MAX_FINDING_FIELD_BYTES);
            findingTrimmed = true;
          }
        }
        if (finding.suggestion?.text && byteLength(finding.suggestion.text) > MAX_FINDING_FIELD_BYTES) {
          finding.suggestion.text = truncateToBytes(finding.suggestion.text, MAX_FINDING_FIELD_BYTES);
          findingTrimmed = true;
        }
        for (const evidence of finding.evidence || []) {
          if (byteLength(evidence.quote) > MAX_EVIDENCE_BYTES) {
            evidence.quote = truncateToBytes(evidence.quote, MAX_EVIDENCE_BYTES);
            evidenceTrimmed = true;
          }
        }
      }
    }
    if (findingTrimmed) note('问题与建议', `单条文本超过 ${formatLimit(MAX_FINDING_FIELD_BYTES)}，已截断`);
    if (evidenceTrimmed) note('证据引用', `单条引用超过 ${formatLimit(MAX_EVIDENCE_BYTES)}，已截断`);
    const understanding = context.understanding || {};
    const capUnderstanding = value => {
      if (byteLength(value) <= MAX_UNDERSTANDING_BYTES) return value;
      understandingTrimmed = true;
      return truncateToBytes(value, MAX_UNDERSTANDING_BYTES);
    };
    if (understanding.overview?.purpose) understanding.overview.purpose = capUnderstanding(understanding.overview.purpose);
    for (const highlight of understanding.overview?.highlights || []) highlight.text = capUnderstanding(highlight.text);
    for (const feature of understanding.features || []) {
      feature.purpose = capUnderstanding(feature.purpose);
      feature.approach = capUnderstanding(feature.approach);
    }
    for (const file of understanding.files || []) {
      for (const item of file.semantic?.items || []) item.text = capUnderstanding(item.text);
    }
    for (const impact of understanding.impacts || []) impact.text = capUnderstanding(impact.text);
    for (const item of understanding.alignment || []) item.note = capUnderstanding(item.note);
    for (const extra of understanding.extras || []) extra.text = capUnderstanding(extra.text);
    if (understandingTrimmed) note('变更说明', `单条文本超过 ${formatLimit(MAX_UNDERSTANDING_BYTES)}，已截断`);
  }

  function buildHtml(context, options = {}) {
    const originalExtension = context.snapshot?.extensionPrompt || null;
    const originalExtensionText = originalExtension ? P.normalizeNewlines(originalExtension.text || '') : '';
    const originalExtensionMeta = originalExtension ? {
      sha256: originalExtension.sha256 || P.sha256(originalExtensionText),
      originalLength: Number.isFinite(originalExtension.length) ? originalExtension.length : P.codePointLength(originalExtensionText),
      text: originalExtensionText,
    } : null;
    context = maskDeep(context);
    const embedDiff = Boolean(options.embedDiff);
    const review = exportReview(context);
    const delivery = context.delivery || {};
    const snapshot = context.snapshot || {};
    const range = snapshot.range || {};
    const understanding = context.understanding || {};
    let extensionText = originalExtensionMeta ? String(snapshot.extensionPrompt?.text || '') : '';
    let extensionTruncated = false;
    const extensionRedacted = Boolean(originalExtensionMeta && extensionText !== originalExtensionMeta.text);
    const nonce = P.sha256(String(Date.now()) + Math.random()).slice(0, 20);
    const omitted = [];
    prepareHtmlContext(context, omitted);
    const sectionIds = {
      '需求依据': 'requirements', '变更概览': 'overview', '按功能变更': 'features', '文件清单': 'files',
      '行为影响': 'impacts', '未对齐 / 待确认': 'pending', '需求外改动': 'extras',
      '问题与处置': 'findings', '关键片段': 'snippets', '完整 Diff': 'diff', '批注': 'annotations',
      '与上次审查相比': 'comparison', '局限': 'limitations', '省略清单': 'omissions',
    };
    const navigation = new Map();
    const section = (title, body, count, unit = '项') => {
      const id = 'report-' + sectionIds[title];
      const label = count === undefined ? title : `${title}（${count} ${unit}）`;
      navigation.set(id, label);
      const heading = `<h2 id="${id}">${htmlEscape(label)}</h2>`;
      return `<section>${count === undefined ? heading + body : `<details><summary>${heading}</summary><div class="section-body">${body}</div></details>`}</section>`;
    };
    const nav = () => `<nav class="report-nav" aria-label="报告章节">${[...navigation].map(([id, title]) => `<a href="#${id}">${htmlEscape(title)}</a>`).join('')}</nav>`;
    const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; img-src data:; script-src 'nonce-${nonce}'">`;
    const reportStyle = ':root{color-scheme:light;--el-bg-base:#fff;--el-bg-l3:#f4f5f7;--el-hover:rgba(38,49,72,.06);--el-border-l2:rgba(0,0,0,.10);--el-label-1:#0f1115;--el-label-2:#61666b;--el-brand:#4176e6}@media(prefers-color-scheme:dark){:root{color-scheme:dark;--el-bg-base:#16171a;--el-bg-l3:#282a30;--el-hover:rgba(255,255,255,.08);--el-border-l2:rgba(255,255,255,.12);--el-label-1:#f1f3f5;--el-label-2:#adb2b8;--el-brand:#7aaaff}}body{background:var(--el-bg-base);color:var(--el-label-1);overflow-wrap:anywhere}h1{color:var(--el-brand)}h2{border-color:var(--el-border-l2);scroll-margin-top:16px}section{margin-top:24px}small,.muted{color:var(--el-label-2)}pre,code{background:var(--el-bg-l3)}th,td{border-color:var(--el-border-l2);overflow-wrap:anywhere}.finding{background:var(--el-bg-base);border-color:var(--el-border-l2);border-left-color:#df2a3f}.report-nav{display:flex;flex-wrap:wrap;gap:4px 8px;padding:12px;margin:24px 0;border:1px solid var(--el-border-l2);border-radius:8px;background:var(--el-bg-l3);font-size:13px}.report-nav a{display:block;color:var(--el-label-2);padding:4px 8px;border-radius:4px;text-decoration:none}.report-nav a:hover{color:var(--el-label-1);background:var(--el-hover)}summary{padding:12px 14px;border:1px solid var(--el-border-l2);border-radius:8px;background:var(--el-bg-l3);color:var(--el-label-1);font-size:18px;font-weight:600;cursor:pointer;overflow-wrap:anywhere}summary h2{display:inline;font:inherit;margin:0;padding:0;border:0}details[open]>summary{margin-bottom:12px}.section-body{overflow-x:auto}.report-nav a:focus-visible,summary:focus-visible{outline:2px solid var(--el-brand);outline-offset:3px}pre.report-diff,pre.report-snippet{font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre;overflow-wrap:normal;word-break:normal;tab-size:4;overflow:auto;padding:12px;max-width:100%;box-sizing:border-box}.report-diff{--el-diff-add-fg:#176333;--el-diff-add-bg:#e6f4ea;--el-diff-del-fg:#a82032;--el-diff-del-bg:#fce8eb;--el-diff-hunk-fg:#50555c;--el-diff-hunk-bg:#e7e9ed}.report-diff .report-diff-line{display:inline-block;min-width:100%}.report-diff .report-diff-add{color:var(--el-diff-add-fg);background:var(--el-diff-add-bg)}.report-diff .report-diff-del{color:var(--el-diff-del-fg);background:var(--el-diff-del-bg)}.report-diff .report-diff-hunk{color:var(--el-diff-hunk-fg);background:var(--el-diff-hunk-bg)}@media(prefers-color-scheme:dark){.report-diff{--el-diff-add-fg:#9ee5b2;--el-diff-add-bg:#183b28;--el-diff-del-fg:#ffb0bb;--el-diff-del-bg:#48232c;--el-diff-hunk-fg:#c5c9d0;--el-diff-hunk-bg:#33363d}}';
    const list = values => `<ul>${values.map(value => `<li>${value}</li>`).join('')}</ul>`;
    const refs = values => (values || []).map(ref => `<code>${htmlEscape(ref.path)}${ref.startLine ? ':' + ref.startLine : ''}</code>`).join(' ');
    const findings = context.files.flatMap(file => (file.findings || []).map(finding => ({ ...finding, path: file.path })));
    const fileSnippets = [];
    let snippetBudgetBytes = 0;
    const snippetLimitBytes = Math.floor(MAX_HTML_BYTES * 0.55);
    for (const file of context.files) {
      const reason = fileReason(file);
      if (reason) { omitted.push({ path: file.path, reason }); continue; }
      const diffLines = lines(file.diff);
      const limit = embedDiff ? MAX_DIFF_LINES : MAX_SNIPPET_LINES;
      const excerpt = diffLines.slice(0, limit);
      if (embedDiff && diffLines.length > MAX_DIFF_LINES) {
        omitted.push({ path: file.path, reason: `Diff 超过 ${MAX_DIFF_LINES} 行上限，已省略` });
      }
      const excerptText = excerpt.join('\n');
      const excerptBytes = byteLength(excerptText);
      if (snippetBudgetBytes + excerptBytes > snippetLimitBytes) {
        omitted.push({ path: file.path, reason: '整份报告体积上限，已省略 Diff' });
        continue;
      }
      snippetBudgetBytes += excerptBytes;
      fileSnippets.push({
        path: file.path,
        html: `<h3>${htmlEscape(file.path)} <small>${htmlEscape(changeLabel(file.change))} +${file.additions ?? 0} −${file.deletions ?? 0}</small></h3>${renderDiff(excerptText)}`,
      });
    }
    let html = '';
    html += '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">';
    html += '<meta name="viewport" content="width=device-width, initial-scale=1">';
    html += csp;
    html += `<title>评审报告 · ${htmlEscape(delivery.title || '变更评审')}</title>`;
    html += `<style nonce="${nonce}">body{font:14px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif;max-width:980px;margin:32px auto;padding:0 24px}h1{font-size:24px;display:flex;align-items:center;gap:12px}.report-icon{flex:0 0 40px;width:40px;height:40px}.report-icon--dark{display:none}@media (prefers-color-scheme:dark){.report-icon--light{display:none}.report-icon--dark{display:inline-flex}}h2{font-size:18px;margin-top:28px;border-bottom:1px solid;padding-bottom:6px}h3{font-size:14px;margin-top:18px}small{font-weight:400}pre{padding:12px;overflow:auto;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}code{padding:1px 4px;border-radius:3px}table{border-collapse:collapse;width:100%}th,td{border:1px solid;padding:6px 8px;text-align:left;vertical-align:top}.finding{border:1px solid;border-left-width:3px;padding:10px 14px;margin:12px 0}.finding[data-severity="P2"]{border-left-color:#d97706}.finding h3{margin-top:0}.omitted{color:#8a5a00;background:#fffaf0;padding:10px;border:1px solid #f1dfb4}${reportStyle}</style>`;
    html += '</head><body>';
    html += `<h1>${REPORT_APP_LIGHT}${REPORT_APP_DARK}评审报告 · ${htmlEscape(delivery.title || '变更评审')}</h1>`;
    const reviewLabel = review.label;
    const extensionLabel = snapshot.extensionPrompt?.text ? `已使用 · ${snapshot.extensionPrompt.length} 字` : '未使用';
    html += `<p class="muted">仓库：${htmlEscape(context.project.displayName || '—')}${delivery.externalRef ? ` · 需求编号：${htmlEscape(delivery.externalRef)}` : ''} · 分支：${htmlEscape(delivery.branch || '—')} · ${htmlEscape(P.formatClock(snapshot.createdAt))} · 审查结论：${htmlEscape(reviewLabel)} · 覆盖：已审 ${review.reviewed} · 跳过 ${review.skipped} · 待审 ${review.pending} · 内置规则：${htmlEscape(snapshot.rulesVersion || '—')} · 扩展提示词：${htmlEscape(extensionLabel)}</p>`;
    html += '<!--report-navigation-->';
    if (understanding.stale) html += '<p class="omitted">变更说明尚未生成；以下只列文件事实与审查结论。</p>';
    html += section('需求依据', (context.requirements || []).length
      ? list(context.requirements.map(source => `${htmlEscape(source.origin)} · ${htmlEscape(P.formatClock(source.capturedAt))}<br>${htmlEscape(source.text)}`))
      : '<p>未提供需求依据。</p>');
    html += section('变更概览', `<p>${htmlEscape(understanding.overview?.purpose || '—')}</p>${list((understanding.overview?.highlights || []).map(item => `${htmlEscape(item.text)} ${refs(item.refs)}`))}`);
    html += section('按功能变更', (understanding.features || []).map(feature => `<h3>${htmlEscape(feature.title)}</h3><p>${htmlEscape(feature.purpose)}</p><p class="muted">${htmlEscape(feature.approach)}</p><p>${htmlEscape((feature.files || []).join('、'))}</p>`).join(''));
    html += section('文件清单', `<table><thead><tr><th>文件</th><th>变化</th><th>+</th><th>−</th><th>状态</th><th>说明</th></tr></thead><tbody>${context.files.map(file => `<tr><td>${htmlEscape(file.path)}</td><td>${htmlEscape(changeLabel(file.change))}</td><td>${file.additions ?? '—'}</td><td>${file.deletions ?? '—'}</td><td>${htmlEscape(statusLabel(context, file))}</td><td>${htmlEscape(fileReason(file) || '—')}</td></tr>`).join('')}</tbody></table>`, context.files.length, '个文件');
    html += section('行为影响', list((understanding.impacts || []).map(impact => `[${htmlEscape(KIND_LABEL[impact.kind] || impact.kind || '变更')}] ${htmlEscape(impact.text)} ${refs(impact.refs)}`)));
    const pendingGroup = alignmentGroups(context).find(group => group.key === 'pending');
    const alignmentHtml = understanding.stale
      ? '<p>变更说明尚未生成，未对齐条目未参与本次整理。</p>'
      : (pendingGroup
        ? `<h3>${htmlEscape(pendingGroup.label)}</h3>${list(pendingGroup.items.map(item => `${htmlEscape(requirementText(context, item.requirementItemId) || item.requirementItemId)}${item.note ? `：${htmlEscape(item.note)}` : ''} ${refs(item.codeRefs)}`))}`
        : `<p>${(context.requirements || []).length ? '没有未对齐条目。' : '未提供需求依据。'}</p>`);
    const extrasHtml = (understanding.extras || []).length
      ? `<h3>需求外改动</h3>${list(understanding.extras.map(extra => `${htmlEscape(extra.text)} ${refs(extra.refs)}`))}` : '';
    html += section('未对齐 / 待确认', alignmentHtml || ((context.requirements || []).length ? '<p>没有未对齐条目。</p>' : '<p>未提供需求依据。</p>'));
    html += extrasHtml ? section('需求外改动', extrasHtml.replace(/^<h3>需求外改动<\/h3>/, '')) : '';
    const incompleteNotice = review.complete ? '' : `<p class="omitted">本次审查结论：${htmlEscape(review.label)}${findings.length ? '；以下为已通过校验的问题' : ''}。</p>`;
    const findingBody = findings.length
      ? findings.map(finding => `<article class="finding" data-severity="${htmlEscape(finding.severity || 'P2')}"><h3>${htmlEscape(findingLabel(finding))} · ${htmlEscape(finding.title)}</h3><p class="muted">${htmlEscape(findingLocation(finding))} · ${htmlEscape(findingStatus(finding))}</p><h3>问题</h3><p>${htmlEscape(finding.problem || '')}</p><h3>影响</h3><p>${htmlEscape(finding.impact || '')}</p>${finding.suggestion?.text ? `<h3>建议</h3><p>${htmlEscape(finding.suggestion.text)}</p>` : ''}${(finding.evidence || []).map(evidence => `<pre class="report-snippet">${htmlEscape(evidence.quote)}</pre>`).join('')}</article>`).join('')
      : (review.complete ? `<p>本次审查结论：${htmlEscape(review.label)}。</p>` : '');
    html += section('问题与处置', incompleteNotice + findingBody);
    const deliveryInfo = {
      deliveryId: delivery.deliveryId, projectKey: delivery.projectKey, title: delivery.title,
      titleSource: delivery.titleSource, externalRef: delivery.externalRef, branch: delivery.branch,
      sessionIds: delivery.sessionIds, purpose: delivery.purpose, createdAt: delivery.createdAt,
      latestSnapshotId: delivery.latestSnapshotId, everAhead: delivery.everAhead, closedAt: delivery.closedAt,
    };
    const extensionInfo = originalExtensionMeta ? {
      sha256: originalExtensionMeta.sha256,
      originalLength: originalExtensionMeta.originalLength,
      text: extensionText,
      redacted: extensionRedacted,
      truncated: extensionTruncated,
    } : null;
    const buildDataBlock = () => {
      if (extensionInfo) {
        extensionInfo.text = extensionText;
        extensionInfo.truncated = extensionTruncated;
      }
      const snapshotInfo = {
        snapshotId: snapshot.snapshotId, deliveryId: snapshot.deliveryId, projectKey: snapshot.projectKey,
        createdAt: snapshot.createdAt, trigger: snapshot.trigger, status: snapshot.status, range,
        rulesVersion: snapshot.rulesVersion, promptVersion: snapshot.promptVersion, inputSha: snapshot.inputSha,
        extensionPrompt: extensionInfo,
      };
      const data = {
        project: context.project, delivery: deliveryInfo, snapshot: snapshotInfo, requirements: context.requirements,
        files: context.files.map(file => ({ path: file.path, change: file.change, kind: file.kind, additions: file.additions, deletions: file.deletions, note: file.note })),
        understanding, findings: findings.map(finding => ({ ...finding, suppressed: Boolean(finding.suppressed) })),
        review: {
          complete: review.complete, reason: review.reason, label: review.label,
          pending: review.pending, reviewed: review.reviewed,
          skipped: review.skipped, runStatus: review.runStatus, snapshotStatus: review.snapshotStatus,
          failed: review.failed, withheld: review.withheld, coverageConsistent: review.coverageConsistent,
        },
        coverage: context.coverage,
        annotations: (context.annotations || []).map(annotation => ({
          annotationId: annotation.annotationId, path: annotation.anchor?.path || null,
          side: annotation.anchor?.side || null, startLine: annotation.anchor?.startLine ?? null,
          endLine: annotation.anchor?.endLine ?? null, text: annotation.text,
          findingId: annotation.findingId || null, createdAt: annotation.createdAt, updatedAt: annotation.updatedAt,
        })),
        run: context.run ? { runId: context.run.runId, generation: context.run.generation, status: context.run.status, scope: context.run.scope } : null,
      };
      return `<script type="application/json" id="evidentloop-data" nonce="${nonce}">${JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')}</script>`;
    };
    const annotationBody = (context.annotations || []).length
      ? list(context.annotations.map(annotation => {
        const finding = findings.find(entry => entry.findingId === annotation.findingId);
        return `<b>${htmlEscape(annotationLocation(annotation))}</b><br><span class="annotation-text">${htmlEscape(annotation.text)}</span><br><small>${htmlEscape(P.formatClock(annotation.createdAt))}${finding ? ` · 关联问题：${htmlEscape(finding.title)}${finding.suppressed ? '（原问题已标记为非问题）' : ''}` : ''} · 评审人意见，未经模型校验。</small>`;
      }))
      : '<p>没有批注。</p>';
    const assemble = snippets => {
      const body = html
      + section(embedDiff ? '完整 Diff' : '关键片段', snippets.map(item => item.html).join('') || '<p>无</p>', snippets.length, embedDiff ? '个文件' : '段')
      + section('批注', annotationBody)
      + section('与上次审查相比', list(relativeChangeItems(context).map(htmlEscape)))
      + section('局限', list(['审查说明、问题与证据来自本次审查结果；文件清单与 Diff 取自本仓当前文件。', '已提交改名检测、clean/process 过滤器、LFS 与冻结后一致性核对尚未实现。', '导出在浏览器内完成，不会调用模型。']))
      + (omitted.length ? section('省略清单', `<div class="omitted">${list(omitted.map(item => `${htmlEscape(item.path)}：${htmlEscape(item.reason)}`))}</div>`, omitted.length) : '')
      + buildDataBlock() + '</body></html>';
      return body.replace('<!--report-navigation-->', nav());
    };
    const kept = fileSnippets.slice();
    let output = assemble(kept);
    while (byteLength(output) > MAX_HTML_BYTES && kept.length) {
      const removed = kept.pop();
      omitted.push({ path: removed.path, reason: `整份报告超过 ${formatLimit(MAX_HTML_BYTES)} 体积上限，已省略 Diff` });
      output = assemble(kept);
    }
    if (byteLength(output) > MAX_HTML_BYTES && extensionText) {
      extensionText = '';
      extensionTruncated = true;
      omitted.push({ path: '扩展提示词', reason: '扩展提示词正文超过整份报告体积上限，已省略正文' });
      output = assemble(kept);
    }
    if (byteLength(output) > MAX_HTML_BYTES) {
      const overflowReason = `整份报告超过 ${formatLimit(MAX_HTML_BYTES)} 体积上限，已省略正文、说明与片段`;
      omitted.push({ path: '报告正文', reason: overflowReason });
      const compactEntries = [
        { path: '报告正文', reason: overflowReason },
        ...omitted.slice(0, 49),
      ];
      const compactTitle = truncateToBytes(delivery.title || '变更评审', 256);
      const compactData = {
        project: { displayName: truncateToBytes(context.project?.displayName || '', 256) },
        delivery: {
          deliveryId: truncateToBytes(delivery.deliveryId || '', 256),
          title: compactTitle,
          branch: truncateToBytes(delivery.branch || '', 256),
          externalRef: truncateToBytes(delivery.externalRef || '', 256),
        },
        snapshot: {
          snapshotId: truncateToBytes(snapshot.snapshotId || '', 256),
          status: snapshot.status || null,
          createdAt: snapshot.createdAt || null,
        },
        review: {
          complete: review.complete, reason: truncateToBytes(review.reason, 512),
          pending: review.pending, reviewed: review.reviewed, skipped: review.skipped,
          runStatus: review.runStatus, snapshotStatus: review.snapshotStatus,
        },
      };
      const buildCompact = entries => {
        const compactJson = JSON.stringify({ ...compactData, omitted: entries })
          .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
        navigation.clear();
        const omissions = section('省略清单', `<div class="omitted">${list(entries.map(item => `${htmlEscape(item.path)}：${htmlEscape(item.reason)}`))}</div>`, entries.length);
        return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
          + csp + `<style nonce="${nonce}">h1{display:flex;align-items:center;gap:12px}.report-icon--dark{display:none}@media (prefers-color-scheme:dark){.report-icon--light{display:none}.report-icon--dark{display:inline-flex}}${reportStyle}</style>`
          + `<title>评审报告 · ${htmlEscape(compactTitle)}</title></head><body>`
          + `<h1>${REPORT_APP_LIGHT}${REPORT_APP_DARK}评审报告 · ${htmlEscape(compactTitle)}</h1>`
          + `<p class="omitted">${htmlEscape(overflowReason)}。</p>`
          + nav() + omissions
          + `<script type="application/json" id="evidentloop-data" nonce="${nonce}">${compactJson}</script>`
          + '</body></html>';
      };
      output = buildCompact(compactEntries);
      while (byteLength(output) > MAX_HTML_BYTES && compactEntries.length > 1) {
        compactEntries.pop();
        output = buildCompact(compactEntries);
      }
    }
    return { html: output, omitted };
  }

  function safeName(value) {
    return String(value || '变更评审').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').slice(0, 80);
  }

  function downloadBlob(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename;
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return url;
  }

  P.exports = {
    buildExportContext, buildMarkdown, buildHtml, maskSecrets, maskDeep, exportReview, byteLength,
    isUnderstandingValid,
    MAX_HTML_BYTES, MAX_REQUIREMENT_BYTES, safeName, downloadBlob,
    downloadMarkdown(context) {
      const content = buildMarkdown(context);
      downloadBlob(`变更日志-${safeName(maskSecrets(context.delivery?.title))}.md`, content, 'text/markdown;charset=utf-8');
      return content;
    },
    downloadHtml(context, options = {}) {
      const { html } = buildHtml(context, options);
      downloadBlob(`评审报告-${safeName(maskSecrets(context.delivery?.title))}.html`, html, 'text/html;charset=utf-8');
      return html;
    },
    previewHtml(html) {
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
      const popup = window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      return popup;
    },
  };
})();
