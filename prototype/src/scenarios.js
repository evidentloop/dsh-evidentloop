/* Scenario derivation for the P1 prototype. One generated snapshot, many view states. */
(function () {
  'use strict';
  const P = window.CRPrototype = window.CRPrototype || {};
  P.params = new URLSearchParams(location.search);

  P.scenarioLabels = {
    list: '交付列表 · 默认',
    'list-empty': '交付列表 · 无交付',
    'list-history': '交付列表 · 多条审查记录',
    records: '三条审查记录 · 最新含未提交改动',
    reviewed: '有结论 · 发现问题',
    partial: '部分待审',
    unreviewed: '待审',
    zero: '未发现问题 · 审查完整',
    incomplete: '证据未通过校验',
    incremental: '增量 · 沿用上次结论 + 待审',
    history: '更早的审查记录 · 只读',
    running: '运行中',
    cancelled: '已取消',
    failed: '失败',
    'no-requirement': '无需求依据',
    'added-requirement': '添加需求依据后',
    'extension-none': '扩展提示词 · 未配置',
    'extension-configured': '扩展提示词 · 已配置',
    'extension-changed': '扩展提示词 · 修改后提示',
    'sendback-draft': '发回会话 · 已有草稿',
    'sendback-no-session': '发回会话 · 无开发会话',
    'auto-on': '自动模式 · 开',
    'auto-off': '自动模式 · 关',
    'preflight-not-git': '前置提示 · 非 Git 仓库',
    'preflight-no-target': '前置提示 · 目标分支不明',
    'preflight-no-model': '前置提示 · 未配置模型',
    'preflight-split-index': '前置提示 · split index 不支持',
  };
  P.DEFAULT_SCENARIO = 'list';
  // Console variants that preview a state without being the delivery's frozen record.
  const RECORD_DERIVED_SCENARIOS = new Set([
    'partial', 'unreviewed', 'zero', 'incomplete', 'incremental', 'running', 'cancelled', 'failed',
    'no-requirement', 'extension-configured', 'extension-changed',
  ]);

  P.PREFLIGHT = {
    'preflight-not-git': {
      code: 'not-git',
      title: '当前目录不是 Git 仓库',
      description: 'EvidentLoop 只从 Git 读取变更元数据。请在一个 Git 仓库的工作区中打开插件，或先初始化仓库再重试。',
      action: 'retry', actionLabel: '重新检测',
      detail: 'git rev-parse --is-inside-work-tree → false',
    },
    'preflight-no-target': {
      code: 'no-target',
      title: '无法确定目标分支',
      description: '没有找到 origin/HEAD、main 或 master。请在设置中指定目标分支；v0 不会静默选择其他分支。',
      action: 'settings', actionLabel: '打开设置',
      detail: 'origin/HEAD → 未找到 · main → 未找到 · master → 未找到',
    },
    'preflight-no-model': {
      code: 'no-model',
      title: '未配置可用模型',
      description: '审查使用 DSH 已配置的模型与连接。请先在 DSH 设置中配置模型，再回到这里生成审查记录。',
      action: 'none', actionLabel: '',
      detail: 'DSH 设置 → 模型 · 当前没有可用的模型配置',
    },
    'preflight-split-index': {
      code: 'split-index',
      title: '仓库启用了 split index，v0 暂不支持',
      description: '为避免刷新 sharedindex.* 的修改时间，v0 在读取 index 之前停止，不会生成审查记录，也不会触碰仓库。请关闭 split index 后重试。',
      action: 'none', actionLabel: '',
      detail: '.git/index 含 link 扩展 · sharedindex.* 存在',
    },
  };

  const EXTENSION_SAMPLE = '团队规范：\n\n- 日志缺失按 P2。\n- 重点关注权限校验与错误处理。\n- 忽略测试文件中的命名风格。\n';
  const EXTENSION_CHANGED = '团队规范：\n\n- 日志缺失按 P1。\n- 重点关注并发与数据一致性。\n- 忽略测试文件中的命名风格。\n';
  const extensionOf = text => {
    const normalized = P.normalizeNewlines(text);
    return { text: normalized, sha256: P.sha256(normalized), length: P.codePointLength(normalized) };
  };
  const rulesWithExtension = (text, base) => base + '+' + P.sha256('extension:' + P.sha256(text)).slice(0, 8);

  const clone = value => JSON.parse(JSON.stringify(value));
  const isMetadataOnly = file => P.coverage.isMetadataOnlyChange(file);
  const isReviewable = file => P.coverage.isReviewTargetFile(file);

  function skipReason(file) {
    if (isMetadataOnly(file)) return file.note || '仅元数据变化，无需模型审查。';
    if (file.kind === 'binary') return '二进制文件，仅保留元数据，未载入文本差异。可在编辑器中打开查看完整文件。';
    if (file.kind === 'oversize') return (file.note || '超过大小上限，仅保留元数据，未载入文本差异。') + ' 可在编辑器中打开查看完整文件。';
    if (file.kind === 'excluded') return file.note || '已按工作区规则排除，仅保留元数据。';
    if (file.kind === 'symlink') return '符号链接，仅记录链接目标文本，不跟随读取。';
    if (file.kind === 'submodule') return '子模块，仅记录提交指针，不读取子模块内容。';
    return file.note || '该文件不在本次审查范围内。';
  }

  function requirementItemsOf(requirements) {
    return (requirements || []).flatMap(source => (source.items || []).map(item => ({
      ...item,
      source,
      text: source.text.slice(item.start, item.end),
    })));
  }

  P.makeRequirementSource = function (text, { kind = 'paste', origin = '粘贴 · 用户', order = 0, truncated = false, originalLength } = {}) {
    const clean = String(text).replace(/\r\n/g, '\n');
    const sha = P.sha256(clean);
    return {
      reqId: 'req-' + sha.slice(0, 12),
      kind,
      origin,
      capturedAt: P.nowIso(),
      text: clean,
      truncated,
      originalLength: originalLength ?? clean.length,
      sha256: sha,
      order,
      items: [{ itemId: P.sha256(sha + '0' + clean.length).slice(0, 12), start: 0, end: clean.length }],
    };
  };

  function markMapOf(marks) {
    return new Map((marks || []).map(mark => [mark.findingId, mark]));
  }

  function applyMarks(findings, marks) {
    const map = markMapOf(marks);
    return findings.map(finding => {
      const mark = map.get(finding.findingId);
      const suppressed = mark && Object.prototype.hasOwnProperty.call(mark, 'suppressed')
        ? Boolean(mark.suppressed) : Boolean(finding.suppressed);
      return { ...finding, suppressed, mark: mark || null };
    });
  }

  function overridesOf(findings) {
    const overrides = {};
    for (const finding of findings) {
      if (!finding.suppressed) continue;
      overrides[finding.findingId] = {
        suppressed: true,
        updatedBy: finding.mark?.by || '',
        updatedAt: finding.mark?.at || '',
        carriedFrom: finding.mark?.carriedFrom || '',
      };
    }
    return overrides;
  }

  function buildFiles({ snapshot, understanding, findings, marks, reviewedPaths, carriedPaths, carriedFrom, carriedFromLabel = '', withheld }) {
    const semantics = new Map((understanding?.files || []).map(file => [file.path, file]));
    const markMap = markMapOf(marks);
    return snapshot.files.map((file, index) => {
      const key = 'f' + String(index).padStart(2, '0');
      const reviewable = isReviewable(file);
      const metadataOnly = isMetadataOnly(file);
      const semanticEntry = semantics.get(file.path);
      const rawFindings = findings.filter(finding => finding.anchor?.path === file.path).map(finding => {
        const mark = markMap.get(finding.findingId);
        const carried = carriedPaths?.has(file.path);
        const suppressed = mark && Object.prototype.hasOwnProperty.call(mark, 'suppressed')
          ? Boolean(mark.suppressed) : Boolean(finding.suppressed);
        return {
          ...finding,
          suppressed,
          mark: mark || null,
          ...(carried && carriedFrom ? { carriedFrom, carriedFromLabel } : {}),
        };
      });
      let reviewStatus;
      if (!reviewable) reviewStatus = metadataOnly ? 'metadata' : 'skipped';
      else if (reviewedPaths?.has(file.path)) reviewStatus = carriedPaths?.has(file.path) ? 'carried' : 'reviewed';
      else reviewStatus = 'pending';
      const isReviewed = reviewStatus === 'reviewed' || reviewStatus === 'carried';
      const visibleFindings = isReviewed ? rawFindings : [];
      const reason = skipReason(file);
      const semanticItems = semanticEntry?.semantic?.items || [];
      const semantic = semanticItems.map(item => item.text).join(' ');
      const suggestion = !reviewable
        ? (metadataOnly ? '仅元数据变化：' + reason : reason)
        : isReviewed ? (semantic || '本文件已完成审查，未提供额外的逐文件说明。') : '';
      const origin = {
        key,
        path: file.path,
        old_path: file.oldPath || file.path,
        new_path: file.path,
        new_file: file.change === 'added',
        deleted_file: file.change === 'deleted',
        renamed_file: file.change === 'renamed',
        diff: file.diff || '',
        additions: file.additions,
        deletions: file.deletions,
        kind: file.kind,
        change: file.change,
        note: file.note || '',
        file,
      };
      const item = {
        md5_str: key,
        path: file.path,
        suggestion,
        reviewStatus,
        reviewable,
        metadataOnly,
        carriedFrom: reviewStatus === 'carried' ? carriedFrom : '',
        carriedFromLabel: reviewStatus === 'carried' ? carriedFromLabel : '',
        semantic,
        semanticItems,
        basis: semanticEntry?.basis || (reviewable ? 'model' : 'fact'),
        semanticStatus: semanticEntry?.semantic?.status || 'stated',
        fileNote: reason,
        skipReason: reviewable ? '' : reason,
        findings: visibleFindings,
        pendingFindings: reviewStatus === 'pending' ? rawFindings : [],
        issue_overrides: overridesOf(visibleFindings),
        withheld: withheld.filter(entry => entry.anchor?.path === file.path),
        origin,
        file,
      };
      return item;
    });
  }

  function coverageOf(files, { withheld = [], failed = [] } = {}) {
    return {
      reviewed: files.filter(item => item.reviewStatus === 'reviewed' || item.reviewStatus === 'carried').map(item => item.path),
      skipped: files.filter(item => ['skipped', 'metadata'].includes(item.reviewStatus)).map(item => ({ path: item.path, reason: item.skipReason })),
      failed,
      withheld: withheld.map(entry => ({ kind: entry.kind || 'finding', ref: entry.findingId, code: entry.code })),
    };
  }

  function buildState(name, opts = {}) {
    const label = P.scenarioLabels[name] || name;
    const base = {
      scenario: name,
      scenarioLabel: label,
      recordDerived: RECORD_DERIVED_SCENARIOS.has(name),
      autoMode: Boolean(opts.autoMode),
      targetBranchOverride: opts.targetBranch || '',
      exportEmbedDiff: Boolean(opts.exportEmbedDiff),
      openMenu: null,
      mainView: 'diff',
      panelMode: null,
      staleNotice: '',
      noticeKind: '',
      history: false,
      readonly: false,
      preflight: null,
      deliveries: [],
      currentDeliveryId: null,
      listExpandedId: null,
      requirementRef: '',
      composerDraft: '',
      sessions: clone(window.CR_PROTOTYPE_DATA.sessions || []),
      workspaces: clone(window.CR_PROTOTYPE_DATA.workspaces || []),
      currentWorkspaceId: window.CR_PROTOTYPE_DATA.currentWorkspaceId || '',
    };
    if (name === 'list' || name === 'list-empty' || name === 'list-history') {
      const deliveries = name === 'list-empty' ? [] : clone(window.CR_PROTOTYPE_DATA.deliveries || []);
      const currentDeliveryId = deliveries[0]?.deliveryId || null;
      return {
        ...base,
        project: clone(window.CR_PROTOTYPE_DATA.project),
        deliveries,
        currentDeliveryId,
        listExpandedId: null,
        requirementRef: deliveries[0]?.externalRef || '',
        snapshot: null, understanding: null, run: null, marks: [],
        withheldFindings: [], requirements: [], requirementItems: [],
        files: [], coverage: null, summary: { fileCount: 0, additions: 0, deletions: 0 },
        readonly: false, preflight: null,
      };
    }
    if (name.startsWith('preflight-')) {
      return {
        ...base,
        project: clone(window.CR_PROTOTYPE_DATA.project),
        snapshot: null, understanding: null, run: null, marks: [],
        withheldFindings: [], requirements: [], requirementItems: [],
        files: [], coverage: null, summary: { fileCount: 0, additions: 0, deletions: 0 },
        deliveries: clone(window.CR_PROTOTYPE_DATA.deliveries || []),
        currentDeliveryId: window.CR_PROTOTYPE_DATA.deliveries?.[0]?.deliveryId || null,
        requirementRef: window.CR_PROTOTYPE_DATA.deliveries?.[0]?.externalRef || '',
        preflight: clone(P.PREFLIGHT[name]),
        readonly: true,
      };
    }

    const history = name === 'history';
    const dataset = history ? clone(window.CR_PROTOTYPE_DATA.history) : clone(window.CR_PROTOTYPE_DATA);
    const snapshot = dataset.snapshot;
    const understanding = dataset.understanding;
    let run = dataset.run;
    let findings = applyMarks(dataset.findings || [], dataset.marks || []);
    let marks = clone(dataset.marks || []);
    let withheld = [];
    let requirements = clone(snapshot.requirements || []);
    const reviewable = snapshot.files.filter(isReviewable).map(file => file.path);
    const pendingPaths = new Set(reviewable.slice(-5));
    let reviewedPaths = new Set(reviewable);
    let carriedPaths = new Set();
    let carriedFrom = '';
    let carriedFromLabel = '';
    const failed = [];
    let readonly = history;

    if (name === 'partial') {
      reviewedPaths = new Set(reviewable.filter(path => !pendingPaths.has(path)));
      run = { ...run, status: 'partial', endedAt: P.nowIso(), scope: 'incremental' };
    } else if (name === 'unreviewed') {
      reviewedPaths = new Set();
      run = null;
      marks = [];
      understanding.stale = true;
    } else if (name === 'zero') {
      findings = [];
      marks = [];
    } else if (name === 'incomplete') {
      withheld = clone((window.CR_PROTOTYPE_DATA.withheldFindings || []).filter(entry => entry.snapshotId === 'snap-demo-withheld'));
      const withheldSnapshotId = withheld[0]?.snapshotId || snapshot.snapshotId;
      const withheldRunId = withheld[0]?.runId || run?.runId || 'run-demo-withheld';
      snapshot.snapshotId = withheldSnapshotId;
      snapshot.deliveryId = 'del-demo-incomplete';
      snapshot.requirements = [];
      understanding.overview = {
        purpose: '验证证据未通过校验时只展示通过校验的部分。',
        highlights: [], requirementStatus: 'no-requirement', basis: 'model',
      };
      understanding.features = [];
      understanding.files = [];
      understanding.impacts = [];
      understanding.alignment = [];
      understanding.extras = [];
      run = { ...run, runId: withheldRunId, snapshotId: withheldSnapshotId, status: 'succeeded', endedAt: P.nowIso(), scope: 'incremental' };
    } else if (name === 'incremental') {
      reviewedPaths = new Set(reviewable.filter(path => !pendingPaths.has(path)));
      carriedPaths = new Set(reviewedPaths);
      carriedFrom = window.CR_PROTOTYPE_DATA.history.snapshot.snapshotId;
      carriedFromLabel = P.formatClock(window.CR_PROTOTYPE_DATA.history.snapshot.createdAt) + ' 的审查';
      run = { ...run, status: 'partial', scope: 'incremental', endedAt: P.nowIso() };
    } else if (name === 'running') {
      reviewedPaths = new Set(reviewable.filter(path => !pendingPaths.has(path)).slice(0, 3));
      run = { ...run, status: 'running', scope: 'incremental', startedAt: P.nowIso(), endedAt: null };
      understanding.stale = true;
    } else if (name === 'cancelled') {
      reviewedPaths = new Set();
      run = { ...run, status: 'cancelled', scope: 'incremental', startedAt: P.nowIso(), endedAt: P.nowIso(), errorCode: 'cancelled-by-user' };
      marks = [];
      understanding.stale = true;
    } else if (name === 'failed') {
      reviewedPaths = new Set();
      run = { ...run, status: 'failed', scope: 'incremental', startedAt: P.nowIso(), endedAt: P.nowIso(), errorCode: 'contract-invalid' };
      marks = [];
      understanding.stale = true;
      failed.push({ path: reviewable[0] || '', reason: '模型输出未通过合同校验（缺少 evidence）' });
      failed.push({ path: reviewable[1] || '', reason: '模型输出未通过合同校验（refs 越界）' });
    } else if (name === 'no-requirement') {
      requirements = [];
      snapshot.requirements = requirements;
      understanding.overview.requirementStatus = 'no-requirement';
      understanding.overview.basis = 'model';
      understanding.alignment = [];
      understanding.extras = [];
    } else if (name === 'added-requirement') {
      reviewedPaths = new Set();
      run = null;
      marks = [];
      understanding.stale = true;
      const source = P.makeRequirementSource(
        '所有结论都要能指回审查记录中的文件、行与内容；证据不成立的结论不得显示为问题，应作为未通过校验的结论处理。',
        { kind: 'paste', origin: '粘贴 · 控制台', order: requirements.length },
      );
      requirements = [...requirements, source];
      snapshot.snapshotId = 'snap-' + P.sha256(snapshot.snapshotId + source.sha256).slice(0, 12);
      snapshot.createdAt = P.nowIso();
      snapshot.inputSha = P.sha256(JSON.stringify({ previous: snapshot.inputSha, requirement: source.sha256, order: source.order }));
      snapshot.requirements = requirements;
    } else if (name === 'auto-on' || name === 'auto-off') {
      base.autoMode = name === 'auto-on';
      base.openMenu = 'settings';
    } else if (name === 'sendback-draft') {
      base.composerDraft = '上次讨论的草稿：先把导出菜单补齐，再确认卡片状态文案。';
    }
    if (history) readonly = true;
    base.readonly = readonly;
    base.history = history;
    if (name === 'extension-none') {
      base.extensionPrompt = '';
      base.openMenu = 'settings';
    } else if (name === 'extension-configured') {
      base.extensionPrompt = EXTENSION_SAMPLE;
      base.openMenu = 'settings';
      snapshot.extensionPrompt = extensionOf(EXTENSION_SAMPLE);
      snapshot.rulesVersion = rulesWithExtension(EXTENSION_SAMPLE, snapshot.rulesVersion);
    } else if (name === 'extension-changed') {
      base.extensionPrompt = EXTENSION_CHANGED;
      base.mainView = 'overview';
      snapshot.extensionPrompt = extensionOf(EXTENSION_SAMPLE);
      snapshot.rulesVersion = rulesWithExtension(EXTENSION_SAMPLE, snapshot.rulesVersion);
    }

    const files = buildFiles({
      snapshot, understanding, findings, marks, reviewedPaths, carriedPaths, carriedFrom, carriedFromLabel, withheld,
    });
    const coverage = coverageOf(files, { withheld, failed });
    if (run) run.coverage = coverage;
    const pending = files.filter(item => item.reviewStatus === 'pending');
    const complete = Boolean(
      snapshot.status === 'complete' && run?.status === 'succeeded' &&
      pending.length === 0 && coverage.failed.length === 0 && coverage.withheld.length === 0,
    );
    let incompleteReason = '';
    if (!run) incompleteReason = '待审';
    else if (run.status === 'queued') incompleteReason = '审查排队中';
    else if (run.status === 'running') incompleteReason = '审查进行中';
    else if (run.status === 'cancelled') incompleteReason = '审查已取消';
    else if (run.status === 'failed') incompleteReason = '审查失败，可重试';
    else if (coverage.withheld.length) incompleteReason = `${coverage.withheld.length} 条结论证据未通过校验，未展示`;
    else if (coverage.failed.length) incompleteReason = '部分文件审查失败，可重试';
    else if (snapshot.status !== 'complete') incompleteReason = '审查记录不完整' + (snapshot.note ? '：' + snapshot.note : '');
    else if (pending.length) incompleteReason = '仍有待审文件';

    if (['zero', 'incomplete', 'incremental', 'no-requirement', 'added-requirement', 'records'].includes(name)) {
      base.mainView = 'overview';
      base.panelMode = null;
    }
    if (name === 'added-requirement') {
      base.staleNotice = '需求依据已更新，审查全部后更新对齐判断';
      base.noticeKind = 'requirement';
    } else if (name === 'unreviewed') {
      base.staleNotice = '待审，审查全部后生成变更说明。';
      base.noticeKind = 'pending';
    } else if (name === 'running') {
      base.staleNotice = '审查进行中，完成后生成变更说明。';
      base.noticeKind = 'running';
    } else if (name === 'cancelled') {
      base.staleNotice = '本次运行已取消，没有可展示的审查结果。';
      base.noticeKind = 'run';
    } else if (name === 'failed') {
      base.staleNotice = '审查失败，未产生可展示的结果；重试会重新调用模型。';
      base.noticeKind = 'run';
    }

    const deliveries = clone(window.CR_PROTOTYPE_DATA.deliveries || []);
    if (name === 'sendback-no-session' && deliveries[0]) deliveries[0].sessionIds = [];
    const preferredDeliveryId = name === 'incomplete' ? 'del-demo-incomplete' : deliveries[0]?.deliveryId;
    const selectedDelivery = deliveries.find(delivery => delivery.deliveryId === preferredDeliveryId) || deliveries[0] || null;
    if (name === 'added-requirement' && selectedDelivery) {
      const previousId = selectedDelivery.latestSnapshotId;
      const previousEntry = (selectedDelivery.snapshots || []).find(item => item.snapshotId === previousId);
      selectedDelivery.previousSnapshotData = clone(window.CR_PROTOTYPE_DATA.snapshot);
      selectedDelivery.latestSnapshotId = snapshot.snapshotId;
      selectedDelivery.snapshotRequirements = clone(requirements);
      selectedDelivery.snapshots = [
        { snapshotId: snapshot.snapshotId, createdAt: snapshot.createdAt, mode: 'unreviewed' },
        ...(previousEntry ? [{ ...previousEntry, mode: 'history' }] : []),
        ...(selectedDelivery.snapshots || []).filter(item =>
          item.snapshotId !== previousId && item.snapshotId !== snapshot.snapshotId),
      ];
      selectedDelivery.latest = {
        status: 'pending', validFindingCount: 0, highestSeverity: null,
        requirementPending: 0, complete: false, runStatus: null, createdAt: snapshot.createdAt,
      };
    }
    return {
      ...base,
      project: dataset.project || clone(window.CR_PROTOTYPE_DATA.project),
      deliveries,
      currentDeliveryId: selectedDelivery?.deliveryId || null,
      listExpandedId: null,
      requirementRef: selectedDelivery?.externalRef || '',
      snapshot,
      understanding,
      run,
      marks,
      withheldFindings: withheld,
      requirements,
      requirementItems: requirementItemsOf(requirements),
      files,
      coverage,
      reviewComplete: complete,
      incompleteReason,
      summary: {
        fileCount: files.length,
        additions: files.reduce((sum, item) => sum + (item.file.additions || 0), 0),
        deletions: files.reduce((sum, item) => sum + (item.file.deletions || 0), 0),
      },
    };
  }

  P.createRecordScenario = function (record, { delivery = null, entry = null, readonly = false, mainView = 'diff', opts = {} } = {}) {
    const snapshot = clone(record.snapshot);
    const understanding = record.understanding ? clone(record.understanding) : null;
    const run = record.run ? clone(record.run) : null;
    const withheld = clone(record.withheldFindings || []);
    const marks = clone(record.marks || []);
    const findings = applyMarks(clone(record.findings || []), marks);
    const reviewable = snapshot.files.filter(isReviewable).map(file => file.path);
    const reviewedPaths = new Set(record.coverage?.reviewed || (run?.status === 'succeeded' ? reviewable : []));
    const files = buildFiles({
      snapshot, understanding, findings, marks, reviewedPaths,
      carriedPaths: new Set(), carriedFrom: '', carriedFromLabel: '', withheld,
    });
    const coverage = coverageOf(files, { withheld, failed: record.coverage?.failed || [] });
    // The formal coverage.withheld is the source of truth; withheldFindings is only the
    // auxiliary detail projection. Merge both by identity and never drop formal entries.
    coverage.withheld = P.coverage.mergeWithheld(record.coverage?.withheld, withheld);
    if (run) run.coverage = coverage;
    const pending = files.filter(item => item.reviewStatus === 'pending');
    const complete = Boolean(
      snapshot.status === 'complete' && run?.status === 'succeeded' &&
      pending.length === 0 && coverage.failed.length === 0 && coverage.withheld.length === 0,
    );
    let incompleteReason = '';
    if (!run) incompleteReason = '待审';
    else if (run.status === 'queued') incompleteReason = '审查排队中';
    else if (run.status === 'running') incompleteReason = '审查进行中';
    else if (run.status === 'cancelled') incompleteReason = '审查已取消';
    else if (run.status === 'failed') incompleteReason = '审查失败，可重试';
    else if (coverage.withheld.length) incompleteReason = `${coverage.withheld.length} 条结论证据未通过校验，未展示`;
    else if (coverage.failed.length) incompleteReason = '部分文件审查失败，可重试';
    else if (snapshot.status !== 'complete') incompleteReason = '审查记录不完整' + (snapshot.note ? '：' + snapshot.note : '');
    else if (pending.length) incompleteReason = '仍有待审文件';
    const requirements = clone(snapshot.requirements || []);
    return {
      scenario: 'record', scenarioLabel: '审查记录', recordDerived: false,
      autoMode: Boolean(opts.autoMode), targetBranchOverride: opts.targetBranch || '',
      exportEmbedDiff: Boolean(opts.exportEmbedDiff),
      openMenu: null, mainView: mainView === 'overview' ? 'overview' : 'diff', panelMode: null,
      staleNotice: record.notice || '', noticeKind: record.notice ? 'run' : '',
      history: Boolean(readonly), readonly: Boolean(readonly) || Boolean(delivery?.closedAt),
      preflight: null, deliveries: clone(window.CR_PROTOTYPE_DATA.deliveries || []),
      currentDeliveryId: delivery?.deliveryId || null, listExpandedId: null,
      requirementRef: delivery?.externalRef || '', composerDraft: opts.composerDraft || '',
      sessions: clone(window.CR_PROTOTYPE_DATA.sessions || []),
      project: clone(window.CR_PROTOTYPE_DATA.project),
      snapshot, understanding, run, marks, withheldFindings: withheld, requirements,
      requirementItems: requirementItemsOf(requirements), files, coverage,
      reviewComplete: complete, incompleteReason,
      summary: {
        fileCount: files.length,
        additions: files.reduce((sum, item) => sum + (item.file.additions || 0), 0),
        deletions: files.reduce((sum, item) => sum + (item.file.deletions || 0), 0),
      },
      delivery,
    };
  };

  P.createScenario = function (rawName, opts = {}) {
    const name = Object.prototype.hasOwnProperty.call(P.scenarioLabels, rawName) ? rawName : P.DEFAULT_SCENARIO;
    return buildState(name, opts);
  };
  P.requirementItemsOf = requirementItemsOf;
})();
