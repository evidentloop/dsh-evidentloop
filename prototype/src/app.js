(function () {
  'use strict';
  const P = window.CRPrototype;
  const params = P.params;

  const preferredFiles = [
    'prototype/src/app.js', 'prototype/src/scenarios.js', 'prototype/src/diff-view.js',
    'prototype/scripts/build-data.mjs', 'prototype/tests/verify.cjs',
  ];
  function pickInitialFile(files, pathParam) {
    if (!files.length) return {};
    if (pathParam) {
      const match = files.find(file => file.path.includes(pathParam));
      if (match) return match;
    }
    const reviewable = files.filter(file => file.reviewable);
    const flagged = reviewable.find(file => (file.findings || []).some(finding => !finding.suppressed) || (file.withheld || []).length);
    if (flagged) return flagged;
    for (const path of preferredFiles) {
      const match = reviewable.find(file => file.path === path);
      if (match) return match;
    }
    return reviewable[0] || files[0];
  }

  function mergeMarks(base, overlay) {
    const merged = new Map((base || []).map(mark => [mark.findingId, mark]));
    for (const mark of overlay || []) merged.set(mark.findingId, mark);
    return [...merged.values()];
  }

  const THEME_STORAGE_KEY = 'evidentloop-demo-theme';
  const readStoredTheme = () => {
    try {
      const value = window.localStorage?.getItem(THEME_STORAGE_KEY);
      return ['auto', 'light', 'dark'].includes(value) ? value : null;
    } catch { return null; }
  };
  const clearStoredTheme = () => {
    try { window.localStorage?.removeItem(THEME_STORAGE_KEY); } catch { /* storage may be unavailable */ }
  };
  const storeTheme = value => {
    try {
      const storage = window.localStorage;
      if (!storage || typeof storage.setItem !== 'function') return false;
      storage.setItem(THEME_STORAGE_KEY, value);
      return true;
    } catch { return false; }
  };

  const requestedScenario = params.get('scenario');
  const themeParam = params.get('theme');
  const initialTheme = ['auto', 'light', 'dark'].includes(themeParam)
    ? themeParam
    : (readStoredTheme() || 'auto');
  const scenarioName = Object.prototype.hasOwnProperty.call(P.scenarioLabels, requestedScenario) ? requestedScenario : P.DEFAULT_SCENARIO;
  const effectiveScenario = !requestedScenario && params.get('view') === 'review' ? 'reviewed' : scenarioName;
  const state = P.createScenario(effectiveScenario, {
    autoMode: params.get('auto') === '1',
    targetBranch: params.get('target') || '',
    exportEmbedDiff: params.get('embed') === '1',
  });

  const mainParam = params.get('main');
  if (mainParam === 'overview' || mainParam === 'diff') state.mainView = mainParam;
  const panelParam = params.get('panel');
  if (panelParam === 'overview') { state.mainView = 'overview'; state.panelMode = null; }
  else if (panelParam === 'file') { state.mainView = 'diff'; state.panelMode = 'file'; }
  else if (panelParam === 'none') state.panelMode = null;
  const menuParam = params.get('menu');
  if (menuParam === 'settings' || menuParam === 'export') state.openMenu = menuParam;

  const originDiffDict = {}, diffDict = {};
  state.files.forEach(file => { originDiffDict[file.md5_str] = file.origin; diffDict[file.md5_str] = file; });

  const viewParam = params.get('view');
  const initialView = viewParam === 'conversation' ? 'conversation'
    : viewParam === 'list' ? 'list'
    : viewParam === 'review' ? 'review'
    : effectiveScenario.startsWith('list') ? 'list'
    : params.has('scenario') ? 'review' : 'list';
  const initialFilter = ['all', 'risk', 'pending'].includes(params.get('filter')) ? params.get('filter') : 'all';
  const initialSelected = state.preflight ? {} : pickInitialFile(state.files, params.get('file'));
  const isAddedLayoutFile = item => { const file = item?.file || item || {}; return file.change === 'added' || file.baseLineCount === 0 || item?.origin?.new_file === true; };
  const diffLayoutKey = (snapshot, item) => [snapshot?.snapshotId || '', item?.path || ''].join(':');
  const initialData = { ...state };
  delete initialData.requirementItems;
  delete initialData.requirements;

  const app = Vue.createApp({
    mixins: [P.FocusReviewMixin],
    components: {
      Splitpanes: splitpanes.Splitpanes, Pane: splitpanes.Pane,
      CodeReviewLite: P.CodeReviewLite, DshSidebar: P.DshSidebar, DshConversation: P.DshConversation, WorkspaceSettings: P.WorkspaceSettings, DeliveryMenu: P.DeliveryMenu, DeliverySession: P.DeliverySession,
    },
    data() {
      return {
        ...initialData,
        view: initialView,
        mainView: state.mainView || 'diff',
        overviewProblemView: 'severity',
        reviewOrigin: 'list',
        lastMainView: null,
        deliverySearch: '',
        workspaceSearch: '',
        requirementRef: state.requirementRef || '',
        dshDraft: state.composerDraft || '',
        sessionDrafts: {},
        conversationTitle: '',
        activeSessionId: '',
        sendBackDialog: { open: false, content: '', meta: '', template: 'fix' },
        originDiffDict,
        diffDict,
        total: state.files.length,
        userInfo: !state.preflight,
        errMsg: '',
        initialReviewSelectionPending: false,
        selectedFileItem: initialSelected,
        fileFilterMode: initialFilter,
        fileSearchKeyword: '',
        preferredDiffStyle: params.get('style') !== 'double',
        explicitDoubleDiffPreset: params.get('style') === 'double',
        addedDiffStyleChoices: {},
        isFilePaneCollapsed: params.get('sidebar') === '0',
        reviewPaneSize: 45,
        reviewDiffPaneSize: 55,
        pendingIssueSaves: {},
        isSavingIssueOverride: false,
        reviewRun: 0,
        findingJumpToken: 0,
        issuePulseTimer: null,
        timers: [],
        layoutKey: 0,
        consoleVisible: params.get('console') !== '0',
        consoleExpanded: params.get('console') === '1',
        themeMode: initialTheme,
        systemDark: window.matchMedia?.('(prefers-color-scheme: dark)').matches || false,
        scenarioLabels: P.scenarioLabels,
        extensionPrompt: state.extensionPrompt || '',
        extensionDialog: { open: false, mode: 'edit', draft: '', initial: '' },
        requirementDialog: { open: false, text: '', kind: 'paste', origin: '粘贴 · 用户', truncated: false, originalLength: 0, fileName: '' },
        annotationEditor: { open: false, key: '', side: 'head', line: null, findingId: null, annotationId: null, text: '', error: '', label: '', subtitle: '' },
        annotationDrafts: {},
        annotationUndo: { open: false, annotation: null, timer: null },
        annotationVersion: 0,
        repoSettingsByKey: {},
        listState: {},
        deletedDeliveryIds: [],
        archiveExpanded: false,
        listProblemOnly: false,
        listSort: 'updated',
        listLayout: 'grid',
        listTableOverflow: false,
        menuTrigger: null,
        extensionDiscardOpen: false,
        extensionComposing: false,
        archiveBeforeSearch: null,
        archiveSearchManual: false,
        deleteDialog: { open: false, delivery: null },
        icons: P.icons,
        ui: P.ui,
      };
    },
    computed: {
      projectName() { return this.project?.displayName || 'dsh-evidentloop'; },
      effectiveTheme() {
        if (this.themeMode === 'light' || this.themeMode === 'dark') return this.themeMode;
        return this.systemDark ? 'dark' : 'light';
      },
      currentDelivery() {
        const deliveries = this.deliveries || [];
        return deliveries.find(delivery => delivery.deliveryId === this.currentDeliveryId) || deliveries[0] || null;
      },
      workspaceDeliveries() {
        const workspace = this.activeWorkspace;
        const repoKey = workspace ? workspace.repoKey || '' : (this.project?.projectKey || '');
        if (!repoKey) return [];
        return (this.deliveries || []).filter(delivery => delivery.projectKey === repoKey);
      },
      deliveryRows() {
        return this.sortedDeliveries(this.workspaceDeliveries.filter(delivery =>
          !this.listMeta(delivery).archived && this.matchesDeliverySearch(delivery) && this.matchesDeliveryProblemFilter(delivery)));
      },
      archivedDeliveryRows() {
        return this.sortedDeliveries(this.workspaceDeliveries.filter(delivery =>
          this.listMeta(delivery).archived && this.matchesDeliverySearch(delivery) && this.matchesDeliveryProblemFilter(delivery)));
      },
      visibleDeliveryRows() { return this.archiveExpanded ? this.archivedDeliveryRows : this.deliveryRows; },
      listSortLabel() { return this.listSort === 'problems' ? '问题最多' : '最近更新'; },
      workspaceActiveCount() { return this.workspaceDeliveries.filter(delivery => !this.listMeta(delivery).archived).length; },
      hasWorkspaceProblems() { return this.workspaceDeliveries.some(delivery => Boolean(this.listMeta(delivery).archived) === this.archiveExpanded && this.matchesDeliverySearch(delivery) && Number(delivery.latest?.validFindingCount) > 0); },
      extensionDirty() { return P.normalizeNewlines(this.extensionDialog.draft) !== P.normalizeNewlines(this.extensionDialog.initial); },
      listEmptyMode() {
        if (!this.workspaceDeliveries.length) return 'workspace';
        if (this.visibleDeliveryRows.length) return '';
        if (this.deliverySearch.trim()) return 'search';
        if (this.listProblemOnly) return 'filter';
        return 'scope';
      },
      listCountText() {
        const count = this.workspaceDeliveries.filter(delivery => !this.listMeta(delivery).archived).length;
        return count > 0 ? `${count} 个进行中` : '';
      },
      workspaceArchivedCount() {
        return this.workspaceDeliveries.filter(delivery => this.listMeta(delivery).archived).length;
      },
      workspaceItems() { return this.workspaces || []; },
      activeWorkspace() {
        return this.workspaceItems.find(workspace => workspace.workspaceId === this.currentWorkspaceId) || this.workspaceItems[0] || null;
      },
      activeWorkspaceName() { return this.activeWorkspace?.name || this.projectName; },
      activeWorkspaceIsGit() { return Boolean(this.activeWorkspace?.repoKey); },
      repoWorkspaceCount() {
        const repoKey = this.activeWorkspace?.repoKey;
        return repoKey ? this.workspaceItems.filter(workspace => workspace.repoKey === repoKey).length : 0;
      },
      settingsSharedRepo() { return this.repoWorkspaceCount > 1; },
      workspaceOptions() {
        const keyword = this.workspaceSearch.trim().toLowerCase();
        return this.workspaceItems.filter(workspace => !keyword || workspace.name.toLowerCase().includes(keyword));
      },
      listPreflight() { return this.activeWorkspaceIsGit ? null : P.PREFLIGHT['preflight-not-git']; },
      deliveryCard() {
        const delivery = this.currentDelivery;
        const latest = delivery?.latest;
        if (!latest) return null;
        const currentReview = Boolean(this.snapshot && this.currentDeliveryId === delivery.deliveryId && this.snapshotBelongsTo(delivery));
        const active = currentReview ? this.activeFindingCount : (Number(latest.validFindingCount) || 0);
        const status = currentReview && this.reviewCompleteNow
          ? (active > 0 ? `发现 ${active} 个问题` : '未发现问题')
          : this.deliveryStatusLabel(delivery);
        const statusTone = currentReview && this.reviewCompleteNow
          ? (active > 0 ? (this.activeTone === 'warn' ? 'warn' : 'error') : 'success')
          : this.deliveryStatusTone(delivery);
        return {
          status,
          statusTone,
          requirementLabel: latest.requirementPending > 0 ? `需求待确认 ${latest.requirementPending} 项` : '',
        };
      },
      recordEntries() { return this.currentDelivery?.snapshots || []; },
      recordPosition() {
        if (!this.snapshot) return -1;
        return this.recordEntries.findIndex(entry => entry.snapshotId === this.snapshot.snapshotId);
      },
      isViewingEarlier() { return this.recordPosition > 0; },
      displayedRecordEntry() {
        const position = this.recordPosition;
        return (position >= 0 ? this.recordEntries[position] : this.recordEntries[0]) || null;
      },
      previousRecordEntry() {
        const position = this.recordPosition;
        return position >= 0 ? this.recordEntries[position + 1] || null : null;
      },
      headerBranch() { return this.currentDelivery?.branch || this.snapshot?.range?.targetRef || ''; },
      headerRangeText() { return P.status.rangeTextOf({ delivery: this.currentDelivery, snapshot: this.snapshot }); },
      headerRangeTip() { return P.status.rangeTipOf({ delivery: this.currentDelivery, snapshot: this.snapshot }); },
      recordCapsuleText() {
        if (!this.snapshot) return '';
        const prefix = this.isViewingEarlier ? '审查记录 · ' : '审查记录 · 最新 ';
        return prefix + P.formatClock(this.snapshot.createdAt);
      },
      sessionsById() {
        return Object.fromEntries((this.sessions || []).map(session => [session.sessionId, session]));
      },
      sendBackTarget() {
        return this.devSessionFor(this.currentDelivery);
      },
      sendBackDisabled() {
        return !this.sendBackTarget;
      },
      hasValidatedDescription() {
        return this.understandingValid;
      },
      supplementDisabled() {
        return this.sendBackDisabled || !this.hasValidatedDescription;
      },
      supplementDisabledReason() {
        if (this.sendBackDisabled) return '本次交付无关联会话';
        if (this.isRunning) return '审查进行中，完成后可补充说明';
        return '尚无可用的变更说明，请先完成审查';
      },
      conversationTime() {
        const session = this.devSessionFor(this.currentDelivery);
        return session ? P.formatRelative(session.updatedAt) : '1 小时前';
      },
      normalizedDiffItems() {
        return Object.keys(this.originDiffDict).map(key => {
          const origin = this.originDiffDict[key];
          const item = this.diffDict[key] || {};
          return { ...item, path: item.path || origin.new_path || origin.old_path || '', md5_str: key };
        });
      },
      issueItemsByFile() { return Object.fromEntries(this.normalizedDiffItems.map(item => [item.md5_str, P.issues.parseIssues(item)])); },
      issueCountByFile() {
        return Object.fromEntries(Object.entries(this.issueItemsByFile).map(([key, issues]) => {
          const active = issues.filter(issue => !issue.suppressed);
          const logic = active.filter(issue => issue.type === 'logic').length;
          const performance = active.length - logic;
          return [key, { total: active.length, logic, performance, suppressed: issues.length - active.length, dominantType: logic && performance ? 'both' : logic ? 'logic' : performance ? 'performance' : null }];
        }));
      },
      activeFindingCount() { return Object.values(this.issueCountByFile).reduce((sum, count) => sum + count.total, 0); },
      suppressedCount() { return Object.values(this.issueCountByFile).reduce((sum, count) => sum + count.suppressed, 0); },
      pendingCount() { return this.normalizedDiffItems.filter(item => item.reviewStatus === 'pending').length; },
      riskAdjustedCount() {
        const items = this.normalizedDiffItems.filter(this.matchesKeyword);
        return {
          total: items.length,
          risk: items.filter(this.hasRiskFlag).length,
          pending: items.filter(this.isPendingReview).length,
        };
      },
      filterModes() {
        const modes = ['all'];
        if (this.riskAdjustedCount.risk > 0 || this.fileFilterMode === 'risk') modes.push('risk');
        if (this.riskAdjustedCount.pending > 0 || this.fileFilterMode === 'pending') modes.push('pending');
        return modes;
      },
      displayedFileList() {
        return this.normalizedDiffItems.filter(item => {
          if (!this.matchesKeyword(item)) return false;
          if (this.fileFilterMode === 'all') return true;
          if (this.anyOptimizationEnabled && this.stickyFileKey === item.md5_str) return true;
          return this.fileFilterMode === 'risk' ? this.hasRiskFlag(item) : this.isPendingReview(item);
        });
      },
      fileRiskNavByFile() {
        const nav = {};
        this.normalizedDiffItems.forEach(item => {
          const issues = this.issueItemsByFile[item.md5_str];
          if (item.suggestion && issues.length) nav[item.md5_str] = {
            total: issues.length, resolved: issues.filter(issue => issue.suppressed).length,
            locatable: issues.filter(issue => issue.lineNumber > 0), unlocatable: issues.filter(issue => !(issue.lineNumber > 0)),
          };
        });
        return nav;
      },
      allReviewed() { return this.normalizedDiffItems.every(item => !this.isPendingReview(item)); },
      hasReviewedFiles() { return this.normalizedDiffItems.some(item => ['reviewed', 'carried'].includes(item.reviewStatus)); },
      selectedIssues() { return this.issueItemsByFile[this.selectedFileItem.md5_str] || []; },
      selectedOrigin() { return this.originDiffDict[this.selectedFileItem.md5_str]; },
      formattedDiffStyle: {
        get() {
          if (!isAddedLayoutFile(this.selectedFileItem)) return this.preferredDiffStyle;
          const key = diffLayoutKey(this.snapshot, this.selectedFileItem);
          return Object.prototype.hasOwnProperty.call(this.addedDiffStyleChoices, key) ? this.addedDiffStyleChoices[key] : !this.explicitDoubleDiffPreset;
        },
        set(value) {
          this.preferredDiffStyle = Boolean(value);
          if (isAddedLayoutFile(this.selectedFileItem)) this.addedDiffStyleChoices = { ...this.addedDiffStyleChoices, [diffLayoutKey(this.snapshot, this.selectedFileItem)]: Boolean(value) };
        },
      },
      currentOutputFormat() { return this.formattedDiffStyle ? 'line-by-line' : 'side-by-side'; },
      canReviewSelectedFile() {
        return Boolean(this.selectedFileItem.path) && this.isPendingReview(this.selectedFileItem) &&
          !this.autoMode && !this.readonly && !this.isRunning && !this.preflight;
      },
      isHistory() { return Boolean(this.history); },
      isRunning() { return this.run?.status === 'running' || this.run?.status === 'queued'; },
      reReviewDisabledReason() {
        if (!this.snapshot) return '没有可用的审查记录';
        if (this.readonly) return this.isViewingEarlier || this.isHistory ? '更早的审查记录不可重新审查' : '只读交付不可重新审查';
        if (this.isRunning) return '审查进行中，完成后再重新审查';
        return '';
      },
      panelOpen() { return this.panelMode === 'file'; },
      requirementsList() { return this.snapshot?.requirements || []; },
      requirementItems() { return P.requirementItemsOf(this.requirementsList); },
      canAddRequirement() {
        const dialog = this.requirementDialog;
        return Boolean(dialog.text.trim()) && (dialog.kind !== 'file' || Boolean(dialog.fileName));
      },
      allFeatures() { return this.understanding?.features || []; },
      allImpacts() { return this.understanding?.impacts || []; },
      showUnderstanding() { return this.understandingValid; },
      understandingValid() { return P.exports?.isUnderstandingValid?.(this.understanding) ?? Boolean(this.understanding && !this.understanding.stale); },
      alignmentPlaceholder() {
        if (this.isRunning) return '审查进行中；完成后更新需求对齐。';
        if (this.run?.status === 'cancelled') return '审查已取消；重新审查后更新需求对齐。';
        if (this.run?.status === 'failed') return '审查失败；重试后更新需求对齐。';
        return '尚未生成需求对齐；审查全部后更新。';
      },
      extensionPromptChanged() {
        if (!this.snapshot) return false;
        const current = P.normalizeNewlines(this.extensionPrompt || '');
        const stored = this.snapshot.extensionPrompt || null;
        if (!current.trim() && !stored?.text) return false;
        const currentHash = current.trim() ? P.sha256(current) : '';
        const storedHash = stored?.sha256 || (stored?.text ? P.sha256(P.normalizeNewlines(stored.text)) : '');
        return currentHash !== storedHash;
      },
      extensionDraftLength() { return P.codePointLength(this.extensionDialog.draft || ''); },
      extensionOverLimit() { return this.extensionDraftLength > 20000; },
      extensionPreviewHtml() { return P.convertToMarkdown(this.extensionDialog.draft || ''); },
      withheldCount() {
        const details = [];
        for (const item of this.normalizedDiffItems) {
          for (const entry of item.withheld || []) {
            details.push({
              ...entry,
              ref: entry.findingId || entry.findingRef || entry.ref || `${item.md5_str}:${entry.code || ''}:${entry.title || ''}`,
            });
          }
        }
        return P.coverage.mergeWithheld(this.coverage?.withheld || [], details).length;
      },
      reviewTargets() { return P.coverage.reviewTargetsOf(this.snapshot); },
      reviewCoverageError() {
        return P.coverage.coverageErrorOf(this.coverage, this.reviewTargets);
      },
      reviewCoverageConsistent() { return !this.reviewCoverageError; },
      reviewResultFilesConsistent() {
        if (!this.snapshot) return false;
        const byPath = new Map(this.normalizedDiffItems.map(item => [item.path, item]));
        return this.reviewTargets.every(path => {
          const item = byPath.get(path);
          return Boolean(item) && ['reviewed', 'carried'].includes(item.reviewStatus);
        });
      },
      failedFilesCount() {
        const files = this.normalizedDiffItems.filter(item => item.reviewStatus === 'failed').length;
        return files + (this.coverage?.failed || []).length;
      },
      codeReadReasonNow() {
        if (!this.snapshot || this.snapshot.status === 'complete') return '';
        const note = String(this.snapshot.range?.note || this.snapshot.note || '');
        if (note.includes('split index')) return 'split-index';
        if (note.includes('共同历史')) return 'shallow-history';
        return 'changed-during-read';
      },
      reviewStateInput() {
        return {
          snapshotStatus: this.snapshot?.status,
          runStatus: this.run ? this.run.status : null,
          pendingCount: this.pendingCount,
          failedCount: this.failedFilesCount,
          withheldCount: this.withheldCount,
          activeFindings: this.activeFindingCount,
          highestSeverity: this.activeTone === 'idle' ? null : (this.activeTone === 'warn' ? 'P2' : 'P1'),
          complete: this.reviewCompleteNow,
          codeReadReason: this.codeReadReasonNow,
        };
      },
      reviewState() {
        if (!this.snapshot) return null;
        return P.status.reviewStateOf(this.reviewStateInput);
      },
      snapshotAnnotations() {
        this.annotationVersion;
        return this.snapshot ? P.annotations.list(this.snapshot.snapshotId) : [];
      },
      annotationCount() { return this.snapshotAnnotations.length; },
      currentFileAnnotations() {
        const item = this.selectedFileItem || {};
        const path = item.path || (item.file && item.file.path) || '';
        const oldPath = item.file?.oldPath || item.old_path || '';
        return this.snapshotAnnotations.filter(annotation => annotation.anchor?.path === path ||
          (annotation.anchor?.side === 'base' && oldPath && annotation.anchor?.path === oldPath));
      },
      annotationEnabled() {
        return Boolean(this.snapshot && this.selectedFileItem?.reviewable && !this.readonly);
      },
      previousAnnotationHint() {
        const entry = this.previousRecordEntry;
        if (!entry) return null;
        const count = P.annotations.list(entry.snapshotId).length;
        return count ? { entry, count, text: `${P.formatClock(entry.createdAt)} 的审查有 ${count} 条批注` } : null;
      },
      reviewCompleteNow() {
        if (!this.snapshot || this.snapshot.status !== 'complete' || this.run?.status !== 'succeeded') return false;
        if (this.pendingCount > 0) return false;
        if (this.normalizedDiffItems.some(item => item.reviewStatus === 'failed' ||
          !['reviewed', 'carried', 'pending', 'skipped', 'metadata'].includes(item.reviewStatus))) return false;
        if (this.withheldCount || (this.coverage?.failed || []).length) return false;
        if (!this.reviewCoverageConsistent || !this.reviewResultFilesConsistent) return false;
        return true;
      },
      incompleteReasonNow() {
        if (this.isRunning) return '审查进行中';
        const review = this.reviewState;
        if (!review || this.reviewCompleteNow) return '';
        const reasons = (review.reasons || []).map(reason => reason.text);
        if (reasons.length) return reasons.join('；');
        if (this.run?.status === 'cancelled') return '审查已取消';
        if (!this.run) return '待审';
        return this.run?.status === 'failed' ? '审查失败' : '';
      },
      runDisplay() {
        if (this.preflight || this.isHistory) return null;
        const review = this.reviewState;
        if (!review) return null;
        if (review.kind === 'queued' || review.kind === 'running') {
          return {
            kind: review.kind, label: review.kind === 'queued' ? '排队中' : '审查中…',
            tone: 'gray', busy: true, primary: { label: '取消', action: 'cancel' },
          };
        }
        if (this.run?.status === 'cancelled') {
          return { kind: 'cancelled', label: '已取消', tone: 'gray', primary: { label: '重新审查', action: 'review-all' } };
        }
        if (review.toolbar?.label === '重试') {
          const failed = (review.reasons || []).find(reason => reason.code === 'run-failed');
          return {
            kind: 'failed', label: failed ? '审查失败' : '', tone: 'red',
            primary: { label: '重试', action: 'review-all' }, title: this.run?.errorCode || '',
          };
        }
        if (review.toolbar?.label === '审查全部') {
          return { kind: 'idle', label: '', tone: 'gray', primary: { label: '审查全部', action: 'review-all' } };
        }
        if (review.toolbar?.action === 'reasons') {
          return { kind: review.kind, label: review.toolbar.label, tone: 'reasons', reason: true };
        }
        return null;
      },
      alignmentGroups() {
        if (!this.requirementsList.length) return [];
        const alignment = this.understanding?.alignment || [];
        return [
          { key: 'pending', label: '未对齐 / 待确认', items: alignment.filter(item => ['partial', 'not-found', 'unclear'].includes(item.status)) },
          { key: 'implemented', label: '已对齐', items: alignment.filter(item => item.status === 'implemented') },
        ].filter(group => group.items.length);
      },
      pendingAlignmentGroup() { return this.alignmentGroups.find(group => group.key === 'pending') || null; },
      implementedAlignmentGroup() { return this.alignmentGroups.find(group => group.key === 'implemented') || null; },
      overviewChanges() {
        if (!this.showUnderstanding) return [];
        return this.allFeatures.slice(0, 5).map(feature => {
          const fileCount = new Set(feature.files || []).size;
          const action = String(feature.approach || feature.purpose || '').replace(/[。.]+$/, '');
          return { featureId: feature.featureId, title: feature.title, action, fileCount };
        });
      },
      incompleteOverviewNotice() {
        if (!this.understanding) return '尚未生成变更说明；审查全部后更新。';
        return this.incompleteReasonNow ? `${this.incompleteReasonNow}；只显示已通过校验的部分。` : '尚未生成可展示的变更说明。';
      },
      problemGroups() {
        const labels = P.issues.SEVERITY_LABEL;
        return ['P0', 'P1', 'P2'].map(severity => ({
          severity,
          label: labels[severity],
          items: this.activeFindingsList.filter(issue => issue.severity === severity),
        })).filter(group => group.items.length);
      },
      overviewProblemGroups() {
        if (this.overviewProblemView === 'severity') return this.problemGroups.map(group => ({ ...group, key: group.severity }));
        const files = new Map();
        for (const group of this.problemGroups) for (const issue of group.items) {
          const path = this.issuePath(issue);
          if (!files.has(path)) files.set(path, { key: path, path, items: [] });
          files.get(path).items.push(issue);
        }
        return [...files.values()];
      },
      impactGroupsByFeature() {
        const groups = Object.fromEntries(this.allFeatures.map(feature => [feature.featureId, []]));
        for (const impact of this.allImpacts) {
          const feature = this.allFeatures.find(entry =>
            (impact.refs || []).some(ref => (entry.files || []).includes(ref.path)));
          if (feature) groups[feature.featureId].push(impact);
        }
        return groups;
      },
      featureImpacts() {
        return feature => this.impactGroupsByFeature[feature.featureId] || [];
      },
      alignmentExtras() { return this.understanding?.extras || []; },
      activeFindingsList() {
        return this.normalizedDiffItems.flatMap(item => (this.issueItemsByFile[item.md5_str] || []).filter(issue => !issue.suppressed));
      },
      activeTone() {
        if (!this.activeFindingCount) return 'idle';
        return this.activeFindingsList.some(issue => issue.severity === 'P0' || issue.severity === 'P1') ? 'error' : 'warn';
      },
      reviewBanner() {
        const review = this.reviewState;
        if (!review) return null;
        const tone = review.kind === 'zero' ? 'green'
          : review.kind === 'findings' ? (this.activeTone === 'warn' ? 'amber' : 'red')
          : review.kind === 'pending' || review.kind === 'queued' || review.kind === 'running' ? 'gray'
          : 'amber';
        return {
          tone,
          label: review.conclusion.title,
          detail: review.conclusion.detail,
          lines: review.conclusion.lines || [],
        };
      },
      panelFileWithheld() { return this.selectedFileItem?.withheld || []; },
      exportReportDisabled() {
        return Boolean(this.preflight) || !this.snapshot;
      },
      reviewStateText() {
        if (!this.snapshot) return '审查结论：没有审查记录';
        return `审查结论：${this.reviewState?.exportText || '待审'}`;
      },
      markdownOptions() {
        return {
          linkLines: this.optimizationFlags.O2,
          copyAll: this.optimizationFlags.O4,
          fileKey: this.selectedFileItem.md5_str,
          lineNumbers: P.diffLineNumbers(this.selectedOrigin),
          fileLevelReviews: this.anyOptimizationEnabled,
          iconButtons: this.anyOptimizationEnabled,
          experience: this.anyOptimizationEnabled,
        };
      },
      fileNavigation() {
        const index = this.displayedFileList.findIndex(item => item.md5_str === this.selectedFileItem.md5_str);
        return { index, total: this.displayedFileList.length, previous: index > 0, next: index >= 0 && index < this.displayedFileList.length - 1 };
      },
      fileMenuRows() {
        if (!this.treeNavigationEnabled) return [];
        const root = { folders: new Map(), files: [], path: '' };
        for (const item of this.displayedFileList) {
          const parts = item.path.split('/'); const label = parts.pop(); let parent = root;
          for (const part of parts) {
            if (!parent.folders.has(part)) parent.folders.set(part, { label: part, path: parent.path ? parent.path + '/' + part : part, folders: new Map(), files: [] });
            parent = parent.folders.get(part);
          }
          parent.files.push({ key: item.md5_str, label, item, isFolder: false, collapsed: false, hasRisk: this.hasRiskFlag(item) });
        }
        const rows = [], byName = (a, b) => a.label.localeCompare(b.label, 'en');
        const hasRisk = node => node.files.some(file => file.hasRisk) || [...node.folders.values()].some(hasRisk);
        const flatten = (parent, depth) => {
          for (let folder of [...parent.folders.values()].sort(byName)) {
            let label = folder.label;
            while (!folder.files.length && folder.folders.size === 1) {
              folder = [...folder.folders.values()][0]; label += '/' + folder.label;
            }
            const collapsed = !!this.collapsedDirectories[folder.path];
            rows.push({ key: 'directory:' + folder.path, path: folder.path, label, depth, isFolder: true, collapsed, hasRisk: hasRisk(folder) });
            if (!collapsed) flatten(folder, depth + 1);
          }
          for (const file of parent.files.sort(byName)) rows.push({ ...file, depth });
        };
        flatten(root, 0);
        return rows.map(entry => {
          const iconKey = entry.isFolder ? P.fileTreeIcons.folder(entry.path, entry.collapsed) : P.fileTreeIcons.file(entry.item.path);
          return { ...entry, iconKey, iconSvg: P.fileTreeIcons.svg(iconKey, this.treeIconInstance, entry.key) };
        });
      },
    },
    watch: {
      deliverySearch(value) {
        const keyword = String(value || '').trim();
        if (keyword && this.archiveBeforeSearch === null) {
          this.archiveBeforeSearch = this.archiveExpanded;
          this.archiveSearchManual = false;
          if (this.searchHasArchivedMatch()) this.archiveExpanded = true;
        } else if (keyword && this.archiveBeforeSearch !== null) {
          if (!this.archiveSearchManual && this.searchHasArchivedMatch()) this.archiveExpanded = true;
        } else if (!keyword && this.archiveBeforeSearch !== null) {
          this.archiveExpanded = Boolean(this.archiveBeforeSearch);
          this.archiveBeforeSearch = null;
          this.archiveSearchManual = false;
        }
      },
      selectedFileItem: {
        handler(next, previous) {
          if (previous?.path && next?.path && next.path !== previous.path && this.annotationEditor.open) {
            this.annotationDrafts[this.annotationEditor.key] = this.annotationEditor.text;
            this.annotationEditor = { ...this.annotationEditor, open: false };
          }
        },
      },
      displayedFileList(items) {
        if (this.anyOptimizationEnabled && this.fileSearchKeyword.trim()) {
          const current = this.normalizedDiffItems.find(item => item.md5_str === this.selectedFileItem.md5_str);
          if (current) this.selectedFileItem = current;
          else this.showCrResult(items[0]?.md5_str);
          return;
        }
        if (!items.some(item => item.md5_str === this.selectedFileItem.md5_str)) this.showCrResult(items[0]?.md5_str);
        else this.selectedFileItem = items.find(item => item.md5_str === this.selectedFileItem.md5_str);
      },
      dshDraft(value) { if (this.activeSessionId) this.sessionDrafts[this.activeSessionId] = value || ''; },
      'riskAdjustedCount.risk'(count) { if (!count && this.fileFilterMode === 'risk' && !this.stickyFileKey && !this.fileSearchKeyword.trim()) this.fileFilterMode = 'all'; },
      'riskAdjustedCount.pending'(count) { if (!count && this.fileFilterMode === 'pending' && !this.stickyFileKey && !this.fileSearchKeyword.trim()) this.fileFilterMode = 'all'; },
      panelMode() { this.$nextTick(P.refreshFloating); },
      view() { this.$nextTick(P.refreshFloating); this.watchListLayout(); },
      listLayout() { this.watchListLayout(); },
      visibleDeliveryRows() { this.watchListLayout(); },
      'ui.confirm'() { this.$nextTick(P.refreshFloating); },
      'ui.message'() { this.$nextTick(P.refreshFloating); },
      effectiveTheme() { this.applyTheme(); this.$nextTick(P.refreshFloating); },
      anyOptimizationEnabled(enabled) {
        P.hideTip(); this.ui.confirm = null;
        if (!enabled) {
          if ((this.fileFilterMode === 'risk' && !this.riskAdjustedCount.risk) ||
              (this.fileFilterMode === 'pending' && !this.riskAdjustedCount.pending)) this.fileFilterMode = 'all';
        }
        this.$nextTick(P.refreshFloating);
      },
    },
    created() {
      this.loadListState();
      this.initializeFocusReview();
      if (this.fileFilterMode !== 'all' && !this.riskAdjustedCount[this.fileFilterMode]) this.fileFilterMode = 'all';
      if (this.panelMode) this.reviewPaneSize = this.reviewPaneSize || 45;
      this.ensureConversationTitle();
      this.bindConversationSession(state.composerDraft || '');
      document.title = '变更评审 · DSH Desktop 演示';
    },
    mounted() {
      this.applyTheme();
      this.themeMedia = window.matchMedia?.('(prefers-color-scheme: dark)');
      this.themeMediaHandler = event => {
        this.systemDark = event.matches;
        if (this.themeMode === 'auto') this.applyTheme();
      };
      this.themeMedia?.addEventListener?.('change', this.themeMediaHandler);
      document.fonts.ready.then(() => { document.documentElement.dataset.ready = 'true'; });
      this.closeMenusHandler = event => {
        if (this.openMenu && !event.target.closest('.wb-menu,.menu-anchor')) this.openMenu = null;
      };
      this.escapeHandler = event => {
        if (event.isComposing || event.keyCode === 229 || this.extensionComposing) return;
        if (event.key !== 'Escape') return;
        if (this.extensionDiscardOpen) { this.keepEditingExtension(); return; }
        if (this.extensionDialog.open) { this.closeExtensionDialog(); return; }
        if (this.deleteDialog.open) { this.closeDeleteDialog(); return; }
        if (this.requirementDialog.open) this.closeRequirementDialog();
        if (this.openMenu) this.closeMenu();
      };
      this.watchListLayout();
      document.addEventListener('click', this.closeMenusHandler);
      document.addEventListener('keydown', this.escapeHandler);
      this.$nextTick(P.refreshFloating);
    },
    beforeUnmount() {
      this.reviewRun++;
      this.timers.forEach(clearTimeout);
      this.listResizeObserver?.disconnect();
      this.themeMedia?.removeEventListener?.('change', this.themeMediaHandler);
      document.removeEventListener('click', this.closeMenusHandler);
      document.removeEventListener('keydown', this.escapeHandler);
    },
    methods: {
      // ---------- state ----------
      applyState(next, { seedDraft } = {}) {
        this.reviewRun++;
        this.timers.forEach(clearTimeout); this.timers = [];
        const origins = {}, items = {};
        next.files.forEach(file => { origins[file.md5_str] = file.origin; items[file.md5_str] = file; });
        this.originDiffDict = origins;
        this.diffDict = items;
        this.files = next.files;
        this.total = next.files.length;
        this.userInfo = !next.preflight;
        this.errMsg = '';
        this.scenario = next.scenario; this.scenarioLabel = next.scenarioLabel;
        this.recordDerived = Boolean(next.recordDerived);
        this.autoMode = next.autoMode;
        this.targetBranchOverride = next.targetBranchOverride;
        this.exportEmbedDiff = next.exportEmbedDiff;
        this.project = next.project;
        this.snapshot = next.snapshot;
        this.understanding = next.understanding;
        this.run = next.run;
        this.marks = next.marks;
        this.withheldFindings = next.withheldFindings;
        this.coverage = next.coverage;
        this.summary = next.summary;
        this.history = next.history;
        this.readonly = next.readonly;
        this.preflight = next.preflight;
        this.staleNotice = next.staleNotice || '';
        this.noticeKind = next.noticeKind || '';
        this.reviewComplete = next.reviewComplete;
        this.incompleteReason = next.incompleteReason;
        this.deliveries = next.deliveries || this.deliveries || [];
        this.currentDeliveryId = next.currentDeliveryId || this.currentDeliveryId || null;
        this.listExpandedId = next.listExpandedId || null;
        this.sessions = next.sessions || this.sessions || [];
        this.bindConversationSession(seedDraft);
        this.sendBackDialog = { open: false, content: '', meta: '', template: 'fix' };
        this.annotationEditor = { open: false, key: '', side: 'head', line: null, findingId: null, annotationId: null, text: '', error: '', label: '', subtitle: '' };
        this.annotationDrafts = {};
        if (this.annotationUndo.timer) clearTimeout(this.annotationUndo.timer);
        this.annotationUndo = { open: false, annotation: null, timer: null };
        P.sendBack.lockedSnapshotId = '';
        P.sendBack.lockedContent = '';
        P.sendBack.lockedTemplate = '';
        P.sendBack.lockedSessionId = '';
        P.sendBack.lockedProjectKey = '';
        P.sendBack.lockedDeliveryId = '';
        if (next.requirementRef !== undefined) this.requirementRef = next.requirementRef;
        // A record's frozen prompt is not a workspace setting; never let it overwrite the live value.
        if (next.scenario !== 'record' && next.extensionPrompt !== undefined) this.extensionPrompt = next.extensionPrompt;
        this.mainView = next.mainView === 'overview' ? 'overview' : 'diff';
        this.overviewProblemView = 'severity';
        this.panelMode = next.panelMode === 'file' ? 'file' : null;
        this.openMenu = next.openMenu || null;
        this.selectedFileItem = next.preflight ? {} : pickInitialFile(next.files, null);
        this.pendingIssueSaves = {};
        this.isSavingIssueOverride = false;
        this.requirementDialog = { open: false, text: '', kind: 'paste', origin: '粘贴 · 用户', truncated: false, originalLength: 0, fileName: '' };
        if (this.panelMode) this.reviewPaneSize = this.reviewPaneSize || 45;
        this.layoutKey++;
        this.ui.confirm = null; this.ui.message = ''; P.hideTip();
        this.$nextTick(P.refreshFloating);
      },
      resetScenario(name) {
        const next = P.createScenario(name, {
          autoMode: this.autoMode,
          targetBranch: this.targetBranchOverride,
          exportEmbedDiff: this.exportEmbedDiff,
        });
        this.sessionDrafts = {};
        this.activeSessionId = '';
        this.applyState(next, { seedDraft: next.composerDraft || '' });
        this.fileFilterMode = 'all';
        this.fileSearchKeyword = '';
        this.stickyFileKey = null;
      },
      applyConsoleScenario(name) {
        this.resetScenario(name);
        this.view = name.startsWith('list') ? 'list' : 'review';
      },
      showConversation() {
        if (this.view === 'review') this.lastMainView = this.mainView;
        this.view = 'conversation';
        this.openMenu = null;
        this.ensureConversationTitle();
        this.bindConversationSession();
        this.$nextTick(P.refreshFloating);
      },
      ensureConversationTitle() {
        if (this.conversationTitle) return;
        const session = this.devSessionFor(this.currentDelivery);
        if (session) this.conversationTitle = session.title || '';
      },
      openList() {
        if (this.view !== 'list') this.lastMainView = this.mainView;
        this.view = 'list';
        this.openMenu = null;
        this.panelMode = null;
        this.$nextTick(P.refreshFloating);
      },
      recordDataFor(delivery, snapshotId) {
        if (!snapshotId) return null;
        const captured = delivery?.records?.[snapshotId] || null;
        const data = window.CR_PROTOTYPE_DATA;
        let canonical = null;
        if (data?.snapshot?.snapshotId === snapshotId) {
          canonical = {
            snapshot: data.snapshot, understanding: data.understanding, run: data.run,
            findings: data.findings, marks: data.marks,
            withheldFindings: (data.withheldFindings || []).filter(entry => entry.snapshotId === snapshotId),
            coverage: data.run?.coverage || null,
          };
        } else if (data?.records?.[snapshotId]) {
          canonical = data.records[snapshotId];
        } else if (data?.history?.snapshot?.snapshotId === snapshotId) {
          canonical = data.history;
        }
        if (!canonical) return captured;
        // Same record revisited in this page session: keep the frozen snapshot and findings
        // untouched, but restore the run, explanation validity and coverage from leave time.
        if (!captured) return canonical;
        return {
          ...canonical,
          run: captured.run ?? canonical.run,
          understanding: captured.understanding ?? canonical.understanding,
          findings: captured.findings ?? canonical.findings,
          withheldFindings: captured.withheldFindings ?? canonical.withheldFindings,
          coverage: captured.coverage ?? canonical.coverage,
          marks: mergeMarks(canonical.marks, captured.marks),
        };
      },
      captureCurrentRecord({ leaving = false } = {}) {
        if (!this.snapshot || !this.currentDelivery || this.recordDerived) return;
        const delivery = this.currentDelivery;
        if (this.snapshot.deliveryId && this.snapshot.deliveryId !== delivery.deliveryId) return;
        delivery.records = delivery.records || {};
        const findings = [];
        const findingIds = new Set();
        const markMap = new Map((this.marks || []).map(mark => [mark.findingId, { ...mark }]));
        for (const item of this.normalizedDiffItems) {
          const raw = this.diffDict[item.md5_str];
          if (!raw) continue;
          const pending = P.issues.effectiveFindings({ findings: raw.pendingFindings || [], issue_overrides: raw.issue_overrides });
          for (const finding of [...P.issues.effectiveFindings(raw), ...pending]) {
            if (findingIds.has(finding.findingId)) continue;
            findingIds.add(finding.findingId);
            const copy = JSON.parse(JSON.stringify(finding));
            delete copy.override;
            findings.push(copy);
          }
          let overrides = raw.issue_overrides || {};
          if (typeof overrides === 'string') { try { overrides = JSON.parse(overrides); } catch { overrides = {}; } }
          for (const [findingId, override] of Object.entries(overrides)) {
            if (!override || !Object.prototype.hasOwnProperty.call(override, 'suppressed')) continue;
            const existing = markMap.get(findingId);
            markMap.set(findingId, {
              findingId, snapshotId: this.snapshot.snapshotId,
              suppressed: [true, 1, '1', 'true'].includes(override.suppressed),
              by: override.updatedBy || existing?.by || '', at: override.updatedAt || existing?.at || '',
            });
          }
        }
        const marks = [...markMap.values()];
        // Leaving the workbench stops an in-flight run; record the honest terminated state then.
        const run = this.run ? JSON.parse(JSON.stringify(this.run)) : null;
        if (leaving && run && (run.status === 'running' || run.status === 'queued')) {
          run.status = 'cancelled';
          run.errorCode = run.errorCode || 'cancelled-by-switch';
          run.endedAt = run.endedAt || P.nowIso();
          run.coverage = JSON.parse(JSON.stringify(this.coverage || { reviewed: [], skipped: [], failed: [], withheld: [] }));
        }
        delivery.records[this.snapshot.snapshotId] = {
          snapshot: JSON.parse(JSON.stringify(this.snapshot)),
          understanding: this.understanding ? JSON.parse(JSON.stringify(this.understanding)) : null,
          run,
          findings, marks,
          withheldFindings: JSON.parse(JSON.stringify(this.withheldFindings || [])),
          coverage: JSON.parse(JSON.stringify(this.coverage || { reviewed: [], skipped: [], failed: [], withheld: [] })),
        };
      },
      openDelivery(delivery, snapshotEntry = null, origin = 'list', options = {}) {
        if (!delivery) return;
        const entries = delivery.snapshots || [];
        const entry = snapshotEntry || entries[0] || null;
        const targetId = entry?.snapshotId || delivery.latestSnapshotId;
        const sameLive = !this.recordDerived && this.snapshot?.snapshotId === targetId && this.currentDeliveryId === delivery.deliveryId;
        if (!sameLive && this.snapshot && this.currentDelivery) {
          if (this.isRunning) this.cancelReview();
          this.captureCurrentRecord({ leaving: true });
        }
        const keepView = options.preserveView ? this.mainView : null;
        const view = options.mainView
          || (origin === 'conversation' ? 'overview' : keepView || this.lastMainView || 'diff');
        let next = null;
        if (!sameLive) {
          const record = this.recordDataFor(delivery, targetId);
          if (record) {
            next = P.createRecordScenario(record, {
              delivery, entry, readonly: !entry || entry.snapshotId !== delivery.latestSnapshotId, mainView: view,
              opts: {
                autoMode: this.autoMode, targetBranch: this.targetBranchOverride,
                exportEmbedDiff: this.exportEmbedDiff,
              },
            });
          } else {
            const mode = entry?.mode || (delivery.latest?.status === 'zero' ? 'zero'
              : delivery.latest?.status === 'incomplete' ? 'incomplete' : 'reviewed');
            next = P.createScenario(mode, {
              autoMode: this.autoMode, targetBranch: this.targetBranchOverride, exportEmbedDiff: this.exportEmbedDiff,
            });
            if (next.snapshot) {
              next.snapshot.deliveryId = delivery.deliveryId;
              next.snapshot.snapshotId = targetId;
              next.snapshot.createdAt = entry?.createdAt || delivery.latest?.createdAt || delivery.createdAt;
            }
            next.readonly = Boolean(entry && entry.snapshotId !== delivery.latestSnapshotId) || Boolean(delivery.closedAt);
            next.history = Boolean(entry && entry.snapshotId !== delivery.latestSnapshotId);
            next.recordDerived = true;
            next.mainView = view === 'overview' ? 'overview' : 'diff';
          }
          next.deliveries = this.deliveries;
          next.currentDeliveryId = delivery.deliveryId;
          next.requirementRef = delivery.externalRef || '';
          next.listExpandedId = null;
          next.delivery = delivery;
          next.sessions = this.sessions;
          this.applyState(next);
          this.mainView = view === 'overview' ? 'overview' : 'diff';
          this.panelMode = null;
        } else {
          this.currentDeliveryId = delivery.deliveryId;
          this.mainView = view === 'overview' ? 'overview' : 'diff';
          this.panelMode = null;
          this.openMenu = null;
        }
        if (origin === 'conversation') {
          const session = this.devSessionFor(delivery);
          if (session) this.conversationTitle = session.title || this.conversationTitle;
        }
        this.reviewOrigin = origin;
        this.lastMainView = this.mainView;
        this.view = 'review';
        this.$nextTick(P.refreshFloating);
      },
      openDeliverySnapshot(delivery, snapshotEntry) {
        this.openDelivery(delivery, snapshotEntry, 'list', { preserveView: true });
      },
      openLatest() {
        this.openDelivery(this.currentDelivery, this.recordEntries[0] || null, 'list', { preserveView: true });
        P.message('已打开最新审查记录');
      },
      selectRecord(entry) {
        this.openMenu = null;
        this.openDelivery(this.currentDelivery, entry, this.reviewOrigin || 'list', { preserveView: true });
      },
      snapshotEntryMeta(snapshot, { mode, findingCount = 0, sessionId = null }) {
        const range = snapshot.range || {};
        return {
          snapshotId: snapshot.snapshotId, createdAt: snapshot.createdAt, mode,
          basedSha: String(range.headSha || range.baseSha || '').slice(0, 7) || '—',
          dirty: Boolean(range.dirty), findingCount, sessionId: sessionId || null,
          headSha: range.headSha || '', baseSha: range.baseSha || '',
          headSubject: range.headSubject || '', baseSubject: range.baseSubject || '',
          targetRef: range.targetRef || '',
        };
      },
      recordSourceSession(entry) { return entry?.sessionId ? this.sessionsById[entry.sessionId] || null : null; },
      recordIsLatest(entry) { return this.recordEntries[0]?.snapshotId === entry?.snapshotId; },
      recordIsCurrent(entry) { return Boolean(entry && this.snapshot && entry.snapshotId === this.snapshot.snapshotId); },
      recordReviewState(entry) {
        if (this.recordIsCurrent(entry)) return this.reviewState;
        const snapshotEntry = entry || {};
        return P.status.reviewStateOf({
          snapshotStatus: snapshotEntry.snapshotStatus || '',
          runStatus: snapshotEntry.runStatus === undefined ? null : snapshotEntry.runStatus,
          pendingCount: snapshotEntry.pendingCount || 0,
          failedCount: snapshotEntry.failedCount || 0,
          withheldCount: snapshotEntry.withheldCount || 0,
          activeFindings: snapshotEntry.validFindingCount || 0,
          highestSeverity: snapshotEntry.highestSeverity || null,
          complete: snapshotEntry.complete === true,
          codeReadReason: snapshotEntry.codeReadReason || '',
        });
      },
      recordConclusion(entry) {
        const review = this.recordReviewState(entry);
        return review?.pills?.map(pill => pill.text).join(' · ') || '待审';
      },
      recordCodeSource(entry) {
        const record = this.recordDataFor(this.currentDelivery, entry?.snapshotId);
        if (record?.snapshot) return P.status.codeSourceOf(record.snapshot);
        return P.status.codeSourceOf({ range: entry });
      },
      recordHoverTip(entry) {
        const record = this.recordDataFor(this.currentDelivery, entry?.snapshotId);
        const snapshot = record?.snapshot || { range: entry };
        return P.status.recordHoverOf(snapshot);
      },
      recordSessionView(entry) {
        const session = this.recordSourceSession(entry);
        if (!session) return null;
        const view = P.status.sessionViewOf(session);
        return view.state === 'deleted' ? null : view;
      },
      openRecordSession(entry, event) {
        event?.stopPropagation();
        const session = this.recordSourceSession(entry);
        if (!session) return;
        const view = P.status.sessionViewOf(session);
        if (view.state !== 'present') return;
        this.conversationTitle = view.title;
        this.activateSession(session.sessionId);
        this.view = 'conversation';
        this.openMenu = null;
        P.message(`已回到会话：${view.title}`);
      },
      reviewBack() {
        if (this.reviewOrigin === 'conversation') {
          this.lastMainView = this.mainView;
          this.showConversation();
        } else {
          this.openList();
        }
      },
      openReview(origin = 'list') { this.openDelivery(this.currentDelivery, null, origin); },
      setView(value) {
        if (value === 'conversation') this.showConversation();
        else if (value === 'list') this.openList();
        else if (this.recordDerived && this.snapshot) {
          this.view = 'review';
          this.reviewOrigin = 'list';
          this.openMenu = null;
          this.$nextTick(P.refreshFloating);
        } else this.openReview('list');
      },
      setMainView(value) {
        if (value === 'overview') { this.showOverview(); return; }
        this.mainView = 'diff';
        if (!this.selectedFileItem?.path) {
          const first = this.displayedFileList[0] || this.normalizedDiffItems[0];
          if (first) this.showCrResult(first.md5_str);
        }
      },
      deliveryReviewState(delivery) {
        const latest = delivery?.latest || {};
        return P.status.reviewStateOf({
          snapshotStatus: latest.snapshotStatus || '',
          runStatus: latest.runStatus === undefined ? null : latest.runStatus,
          pendingCount: latest.pendingCount || 0,
          failedCount: latest.failedCount || 0,
          withheldCount: latest.withheldCount || 0,
          activeFindings: latest.validFindingCount || 0,
          highestSeverity: latest.highestSeverity || null,
          complete: latest.complete === true,
          codeReadReason: latest.codeReadReason || '',
        });
      },
      deliveryStatusPills(delivery) { return this.deliveryReviewState(delivery).pills; },
      deliveryStatusLabel(delivery) { return this.deliveryStatusPills(delivery)[0]?.text || '待审'; },
      deliveryStatusTone(delivery) { return this.deliveryStatusPills(delivery)[0]?.tone || 'idle'; },
      recentSessionView(delivery) {
        const session = this.devSessionFor(delivery);
        if (!session) return null;
        const view = P.status.sessionViewOf(session);
        return view.state === 'deleted' ? null : { ...view, session, time: P.formatRelative(session.updatedAt) };
      },
      deliveryPurpose(delivery) { return delivery?.purpose || delivery?.latest?.purpose || ''; },
      deliveryTime(delivery) { return P.formatClock(delivery?.latest?.createdAt || delivery?.createdAt); },
      deliveryRelativeTime(value) { return P.formatRelative(value); },
      deliverySnapshots(delivery) { return (delivery?.snapshots || []).filter(snapshot => snapshot.snapshotId !== delivery.latestSnapshotId); },
      normalizeDevSession(session) {
        let current = session;
        const seen = new Set();
        while (current?.parentSessionId && !seen.has(current.sessionId)) {
          seen.add(current.sessionId);
          current = this.sessionsById[current.parentSessionId];
        }
        return current || null;
      },
      isDeliverySession(delivery, sessionId) {
        return (delivery?.sessionIds || []).some(id => {
          const normalized = this.normalizeDevSession(this.sessionsById[id]);
          return normalized?.sessionId === sessionId;
        });
      },
      devSessionFor(delivery) {
        const seen = new Set();
        const sessions = (delivery?.sessionIds || [])
          .map(sessionId => this.normalizeDevSession(this.sessionsById[sessionId]))
          .filter(session => {
            if (!session || session.kind === 'review' || seen.has(session.sessionId)) return false;
            seen.add(session.sessionId);
            return true;
          });
        return sessions.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0] || null;
      },
      deliveryRecentSession(delivery) { return this.devSessionFor(delivery); },
      openSession(delivery) {
        const session = this.deliveryRecentSession(delivery);
        if (!session?.sessionId) return;
        const view = P.status.sessionViewOf(session);
        if (view.state !== 'present') return;
        this.currentDeliveryId = delivery.deliveryId;
        this.requirementRef = delivery.externalRef || '';
        this.conversationTitle = view.title;
        this.activateSession(session.sessionId);
        this.view = 'conversation';
        this.openMenu = null;
        this.$nextTick(P.refreshFloating);
        P.message(`已回到会话：${view.title}`);
      },
      toggleDeliveryMenu(delivery) {
        P.hideTip();
        this.menuTrigger = document.querySelector(`[data-delivery-id="${CSS.escape(delivery.deliveryId)}"] .delivery-more`);
        const key = 'delivery:' + delivery.deliveryId;
        this.openMenu = this.openMenu === key ? null : key;
        this.$nextTick(() => {
          const menu = document.querySelector(`[data-delivery-id="${CSS.escape(delivery.deliveryId)}"] .delivery-menu`);
          if (menu && this.listLayout === 'compact') {
            const rect = this.menuTrigger.getBoundingClientRect();
            const box = menu.getBoundingClientRect();
            const top = rect.bottom + box.height + 8 <= innerHeight ? rect.bottom + 4 : Math.max(8, rect.top - box.height - 4);
            menu.style.top = top + 'px'; menu.style.left = Math.max(8, Math.min(innerWidth - box.width - 8, rect.right - box.width)) + 'px';
          }
          P.refreshFloating();
        });
      },
      deleteDelivery(delivery) {
        const wasCurrent = this.currentDeliveryId === delivery.deliveryId;
        if (wasCurrent && this.isRunning) this.cancelReview();
        P.annotations.deleteDelivery(delivery);
        this.deliveries = (this.deliveries || []).filter(item => item.deliveryId !== delivery.deliveryId);
        if (!this.deletedDeliveryIds.includes(delivery.deliveryId)) {
          this.deletedDeliveryIds = [...this.deletedDeliveryIds, delivery.deliveryId];
          this.persistDeletedDeliveries();
        }
        if (wasCurrent) {
          this.currentDeliveryId = this.deliveries[0]?.deliveryId || null;
          this.requirementRef = this.currentDelivery?.externalRef || '';
          this.snapshot = null;
          this.understanding = null;
          this.run = null;
          this.marks = [];
          this.withheldFindings = [];
          this.coverage = null;
          this.staleNotice = '';
          this.noticeKind = '';
          this.recordDerived = false;
          this.layoutKey++;
        }
        const bucket = this.listState?.[delivery.projectKey];
        if (bucket && Object.prototype.hasOwnProperty.call(bucket, delivery.deliveryId)) {
          delete bucket[delivery.deliveryId];
          this.persistListState();
          this.listState = { ...this.listState };
        }
        this.openMenu = null;
        this.deleteDialog = { open: false, delivery: null };
        P.message('已删除交付');
      },
      snapshotBelongsTo(delivery) {
        if (!this.snapshot || !delivery) return false;
        if (this.snapshot.deliveryId !== delivery.deliveryId) return false;
        const entries = delivery.snapshots || [];
        return entries.some(entry => entry.snapshotId === this.snapshot.snapshotId) ||
          delivery.latestSnapshotId === this.snapshot.snapshotId;
      },
      listMeta(delivery) {
        const override = this.listState?.[delivery?.projectKey]?.[delivery?.deliveryId] || {};
        const pinnedAt = Object.prototype.hasOwnProperty.call(override, 'pinnedAt') ? override.pinnedAt : (delivery?.pinnedAt || '');
        const archivedAt = Object.prototype.hasOwnProperty.call(override, 'archivedAt') ? override.archivedAt : (delivery?.archivedAt || '');
        const session = this.devSessionFor(delivery);
        const activity = Math.max(
          Date.parse(delivery?.latest?.createdAt || delivery?.createdAt || '') || 0,
          Date.parse(delivery?.createdAt || '') || 0,
          Date.parse(session?.updatedAt || '') || 0,
        );
        return { pinned: Boolean(pinnedAt) && !archivedAt, pinnedAt: pinnedAt || '', archivedAt: archivedAt || '', archived: Boolean(archivedAt), activity };
      },
      sortedDeliveries(list) {
        return [...list].sort((a, b) => {
          const am = this.listMeta(a), bm = this.listMeta(b);
          if (am.pinned !== bm.pinned) return am.pinned ? -1 : 1;
          if (this.listSort === 'problems') {
            const difference = (Number(b.latest?.validFindingCount) || 0) - (Number(a.latest?.validFindingCount) || 0);
            if (difference) return difference;
          }
          return bm.activity - am.activity;
        });
      },
      updateListTruncation(event, text, stateTip = '') { P.updateTruncatedTitle(event, text, stateTip); },
      matchesDeliveryProblemFilter(delivery) { return !this.listProblemOnly || Number(delivery.latest?.validFindingCount) > 0; },
      deliveryReasonDetail(delivery) {
        const state = this.deliveryReviewState(delivery);
        return state.reasons.length > 1 ? state.pills.map(pill => pill.text).join(' · ') + '；' + state.reasons.map(reason => reason.text).join('；') : '';
      },
      setListScope(archived) {
        this.archiveExpanded = archived;
        if (this.archiveBeforeSearch !== null) this.archiveSearchManual = true;
      },
      clearListConstraints() {
        this.archiveBeforeSearch = null; this.archiveSearchManual = false;
        this.deliverySearch = ''; this.listProblemOnly = false;
      },
      setListSort(value) { this.listSort = value; this.closeMenu(); },
      watchListLayout() {
        this.listResizeObserver?.disconnect();
        this.$nextTick(() => {
          const wrapper = this.$refs.deliveryScroll;
          if (!wrapper) { this.listTableOverflow = false; return; }
          const measure = () => { this.listTableOverflow = wrapper.scrollWidth > wrapper.clientWidth + 1; };
          this.listResizeObserver?.disconnect();
          this.listResizeObserver = new ResizeObserver(measure); this.listResizeObserver.observe(wrapper); measure();
        });
      },
      closeMenu(restoreFocus = true) {
        P.hideTip();
        const trigger = this.menuTrigger;
        this.openMenu = null;
        if (restoreFocus) this.$nextTick(() => {
          const target = trigger?.isConnected ? trigger : document.querySelector('.list-scope button[aria-pressed="true"]');
          target?.focus({ preventScroll: true });
        });
      },
      listKeydown(event) {
        if (event.isComposing || event.keyCode === 229) return;
        const anchor = event.target.closest('.menu-anchor');
        const trigger = anchor?.querySelector('button[aria-haspopup]');
        const menu = event.target.closest('[role="menu"],[role="listbox"]');
        if (menu && event.key === 'Escape') {
          event.preventDefault(); event.stopPropagation(); this.closeMenu(); return;
        }
        if (event.key === 'Tab' && menu) {
          this.$nextTick(() => { if (!anchor?.contains(document.activeElement)) this.closeMenu(false); }); return;
        }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        if (!menu && event.target === trigger && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
          event.preventDefault();
          if (trigger.getAttribute('aria-expanded') !== 'true') trigger.click();
          this.$nextTick(() => {
            const items = anchor.querySelectorAll('[role="menuitem"]:not(:disabled),[role="menuitemradio"],[role="option"]');
            items[event.key === 'ArrowUp' ? items.length - 1 : 0]?.focus();
          }); return;
        }
        if (!menu) return;
        const items = [...menu.querySelectorAll('[role="menuitem"]:not(:disabled),[role="menuitemradio"],[role="option"]')];
        if (!items.length) return;
        event.preventDefault();
        const index = items.indexOf(event.target);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[next]?.focus();
      },
      trapDialogKeys(event) {
        if (event.isComposing || event.keyCode === 229 || event.key !== 'Tab') return;
        const nodes = [...event.currentTarget.querySelectorAll('button:not(:disabled),textarea,input:not(:disabled),a[href]')].filter(node => node.getClientRects().length);
        if (!nodes.length) return;
        if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes[nodes.length - 1].focus(); }
        else if (!event.shiftKey && document.activeElement === nodes[nodes.length - 1]) { event.preventDefault(); nodes[0].focus(); }
      },
      matchesDeliverySearch(delivery) {
        const keyword = this.deliverySearch.trim().toLowerCase();
        if (!keyword) return true;
        return [delivery.title, delivery.externalRef, delivery.branch].some(value =>
          String(value || '').toLowerCase().includes(keyword));
      },
      loadListState() {
        try {
          const stored = window.localStorage?.getItem('evidentloop-demo-list-state');
          this.listState = stored ? JSON.parse(stored) : {};
        } catch { this.listState = {}; }
        if (!this.listState || typeof this.listState !== 'object') this.listState = {};
        try {
          const storedDeleted = window.localStorage?.getItem('evidentloop-demo-deleted-deliveries');
          this.deletedDeliveryIds = storedDeleted ? JSON.parse(storedDeleted) : [];
        } catch { this.deletedDeliveryIds = []; }
        if (!Array.isArray(this.deletedDeliveryIds)) this.deletedDeliveryIds = [];
        if (this.deletedDeliveryIds.length) {
          this.deliveries = (this.deliveries || []).filter(delivery => !this.deletedDeliveryIds.includes(delivery.deliveryId));
        }
        let changed = false;
        for (const delivery of this.deliveries || []) {
          const bucket = this.listState[delivery.projectKey] = this.listState[delivery.projectKey] || {};
          const override = bucket[delivery.deliveryId] = bucket[delivery.deliveryId] || {};
          const hasOverride = Object.prototype.hasOwnProperty.call(override, 'archivedAt');
          const hasDefault = Object.prototype.hasOwnProperty.call(delivery, 'archivedAt');
          if (delivery.closedAt && !hasOverride && !hasDefault) {
            override.archivedAt = delivery.closedAt;
            override.pinnedAt = '';
            changed = true;
          }
        }
        if (changed) this.persistListState();
        this.autoExpandArchiveIfEmpty();
      },
      persistListState() {
        try { window.localStorage?.setItem('evidentloop-demo-list-state', JSON.stringify(this.listState)); } catch { /* display must survive storage failures */ }
      },
      persistDeletedDeliveries() {
        try { window.localStorage?.setItem('evidentloop-demo-deleted-deliveries', JSON.stringify(this.deletedDeliveryIds)); } catch { /* display must survive storage failures */ }
      },
      setListOverride(delivery, patch) {
        const repo = this.listState[delivery.projectKey] = this.listState[delivery.projectKey] || {};
        repo[delivery.deliveryId] = { ...(repo[delivery.deliveryId] || {}), ...patch };
        this.persistListState();
        this.listState = { ...this.listState };
      },
      isDeliveryRunning(delivery) {
        if (delivery?.deliveryId === this.currentDeliveryId && this.snapshot) return this.isRunning;
        const status = delivery?.latest?.runStatus;
        return status === 'running' || status === 'queued';
      },
      togglePin(delivery) {
        const pinned = this.listMeta(delivery).pinned;
        this.setListOverride(delivery, { pinnedAt: pinned ? '' : P.nowIso() });
        this.closeMenu();
        P.message(pinned ? '已取消置顶' : '已置顶');
      },
      archiveDelivery(delivery) {
        if (this.isDeliveryRunning(delivery)) return;
        this.setListOverride(delivery, { archivedAt: P.nowIso(), pinnedAt: '' });
        const remainingActive = this.workspaceDeliveries.filter(item =>
          item.deliveryId !== delivery.deliveryId && !this.listMeta(item).archived).length;
        if (!remainingActive && this.workspaceArchivedCount > 0) this.archiveExpanded = true;
        this.closeMenu();
        P.message('已归档');
      },
      unarchiveDelivery(delivery) {
        this.setListOverride(delivery, { archivedAt: '', pinnedAt: '' });
        this.closeMenu();
        P.message('已取消归档');
      },
      toggleArchiveGroup() {
        this.archiveExpanded = !this.archiveExpanded;
        if (this.archiveBeforeSearch !== null) this.archiveSearchManual = true;
      },
      autoExpandArchiveIfEmpty() {
        if (!this.listCountText && this.workspaceArchivedCount > 0) this.archiveExpanded = true;
      },
      askDeleteDelivery(delivery) {
        this.openMenu = null;
        this.deleteDialog = { open: true, delivery };
        this.$nextTick(() => this.$refs.deleteCancel?.focus());
      },
      closeDeleteDialog() { this.deleteDialog = { open: false, delivery: null }; this.$nextTick(() => this.menuTrigger?.focus?.()); },
      confirmDeleteDelivery() {
        const delivery = this.deleteDialog.delivery;
        this.deleteDialog = { open: false, delivery: null };
        if (delivery) this.deleteDelivery(delivery);
      },
      searchHasArchivedMatch() {
        return this.workspaceDeliveries.some(delivery => this.listMeta(delivery).archived && this.matchesDeliverySearch(delivery));
      },
      selectWorkspace(workspace) {
        if (!workspace) return;
        this.saveRepoSettings();
        this.currentWorkspaceId = workspace.workspaceId;
        this.openMenu = null;
        this.workspaceSearch = '';
        const repoKey = workspace.repoKey || '';
        const first = (this.deliveries || []).find(delivery => repoKey && delivery.projectKey === repoKey) || null;
        this.currentDeliveryId = first?.deliveryId || null;
        this.requirementRef = first?.externalRef || '';
        this.applyRepoSettings();
        this.archiveExpanded = false;
        this.autoExpandArchiveIfEmpty();
        this.$nextTick(() => { P.refreshFloating(); this.menuTrigger?.focus?.({ preventScroll: true }); });
      },
      settingsBucketKey() {
        const workspace = this.activeWorkspace;
        return workspace ? (workspace.repoKey || 'workspace:' + workspace.workspaceId) : 'workspace:default';
      },
      saveRepoSettings() {
        this.repoSettingsByKey[this.settingsBucketKey()] = {
          autoMode: Boolean(this.autoMode),
          targetBranch: this.targetBranchOverride || '',
          exportEmbedDiff: Boolean(this.exportEmbedDiff),
          extensionPrompt: this.extensionPrompt || '',
        };
      },
      applyRepoSettings() {
        const saved = this.repoSettingsByKey[this.settingsBucketKey()];
        const next = saved || { autoMode: false, targetBranch: '', exportEmbedDiff: false, extensionPrompt: '' };
        this.autoMode = Boolean(next.autoMode);
        this.targetBranchOverride = next.targetBranch || '';
        this.exportEmbedDiff = Boolean(next.exportEmbedDiff);
        this.extensionPrompt = next.extensionPrompt || '';
      },
      setAutoMode(value) {
        this.autoMode = Boolean(value);
        this.saveRepoSettings();
        this.notifyAutoMode();
      },
      setTargetBranch(value) {
        this.targetBranchOverride = String(value || '');
        this.saveRepoSettings();
      },
      setExportEmbedDiff(value) {
        this.exportEmbedDiff = Boolean(value);
        this.saveRepoSettings();
      },
      listPreflightRetry() { P.message('演示：重新检测（未执行）'); },
      copyListPreflightDetail() { P.copyText(this.listPreflight?.detail || '', '已复制诊断信息'); },
      updateRequirementRef(value) {
        this.requirementRef = value;
        if (this.currentDelivery) this.currentDelivery.externalRef = value;
      },
      exportContext() {
        const context = P.exports.buildExportContext(this);
        context.delivery = this.currentDelivery || {};
        context.previousSnapshot = this.previousSnapshotForExport();
        context.annotations = this.snapshot ? P.annotations.list(this.snapshot.snapshotId) : [];
        return context;
      },
      previousSnapshotForExport() {
        const delivery = this.currentDelivery;
        const entry = this.previousRecordEntry;
        if (entry) {
          const record = this.recordDataFor(delivery, entry.snapshotId);
          if (record?.snapshot) return JSON.parse(JSON.stringify(record.snapshot));
        }
        if (delivery?.previousSnapshotData) return delivery.previousSnapshotData;
        return null;
      },
      deliverySourceContext(delivery) {
        const entry = delivery?.snapshots?.[0] || null;
        const record = this.recordDataFor(delivery, delivery?.latestSnapshotId);
        let source = null;
        if (record) {
          source = P.createRecordScenario(record, {
            delivery, entry, readonly: false, mainView: 'diff',
            opts: {
              autoMode: this.autoMode, targetBranch: this.targetBranchOverride,
              exportEmbedDiff: this.exportEmbedDiff,
            },
          });
        } else {
          const mode = entry?.mode || (delivery.latest?.status === 'zero' ? 'zero'
            : delivery.latest?.status === 'incomplete' ? 'incomplete' : 'reviewed');
          source = P.createScenario(mode, { autoMode: this.autoMode, targetBranch: this.targetBranchOverride, exportEmbedDiff: this.exportEmbedDiff });
          if (source.snapshot) {
            source.snapshot.deliveryId = delivery.deliveryId;
            source.snapshot.snapshotId = delivery.latestSnapshotId;
            source.snapshot.createdAt = entry?.createdAt || delivery.latest?.createdAt || delivery.createdAt;
          }
        }
        source.delivery = delivery;
        const context = P.exports.buildExportContext(source);
        context.delivery = delivery;
        context.annotations = P.annotations.list(source.snapshot?.snapshotId || delivery.latestSnapshotId);
        const previousEntry = delivery?.snapshots?.[1] || null;
        const previousRecord = previousEntry ? this.recordDataFor(delivery, previousEntry.snapshotId) : null;
        context.previousSnapshot = previousRecord?.snapshot || null;
        return context;
      },
      downloadDelivery(delivery) {
        P.exports.downloadMarkdown(this.deliverySourceContext(delivery));
        this.openMenu = null;
        P.message('已生成变更日志');
      },
      downloadDeliveryHtml(delivery) {
        P.exports.downloadHtml(this.deliverySourceContext(delivery), { embedDiff: this.exportEmbedDiff });
        this.openMenu = null;
        P.message('已生成评审报告');
      },
      buildSendBackContent() {
        const title = this.currentDelivery?.title || '变更评审';
        const lines = [`变更评审 · ${title}`, this.reviewStateText, ''];
        const findings = [];
        this.normalizedDiffItems.forEach((item, fileIndex) => {
          (this.issueItemsByFile[item.md5_str] || []).filter(issue => !issue.suppressed).forEach(issue => {
            findings.push({ issue, item, fileIndex });
          });
        });
        findings.sort((a, b) =>
          (P.issues.SEVERITY_RANK[a.issue.severity] ?? 9) - (P.issues.SEVERITY_RANK[b.issue.severity] ?? 9) ||
          a.fileIndex - b.fileIndex ||
          (a.issue.lineNumber || Number.MAX_SAFE_INTEGER) - (b.issue.lineNumber || Number.MAX_SAFE_INTEGER));
        const annotations = this.snapshotAnnotations.map(annotation => {
          const context = P.annotations.findingContext(annotation);
          const location = annotation.anchor?.startLine
            ? `${annotation.anchor.path}:${annotation.anchor.startLine}`
            : `${annotation.anchor?.path || ''}（文件级）`;
          return { annotation, context, location };
        });
        const annotatedFindings = new Set(annotations.map(entry => entry.annotation.findingId).filter(Boolean));
        if (annotations.length) {
          lines.push(`## 批注（${annotations.length}）`);
          annotations.forEach(({ annotation, context, location }, index) => {
            lines.push(`${index + 1}. ${location}：${P.exports.maskSecrets(annotation.text)}`);
            if (context) {
              lines.push(`   关联问题：${context.title}`);
              if (context.suppressed) lines.push('   原问题已标记为非问题');
            }
          });
          lines.push('');
        }
        const remainingFindings = findings.filter(entry => !annotatedFindings.has(entry.issue.issueKey));
        lines.push(`## 待处理问题（${remainingFindings.length}）`);
        if (remainingFindings.length) {
          remainingFindings.forEach(({ issue, item }, index) => {
            const location = issue.lineNumber > 0 ? `${item.path}:${issue.lineNumber}` : `${item.path}（文件级）`;
            lines.push(`${index + 1}. [${issue.severity}] ${issue.title}`);
            lines.push(`   位置：${location}`);
            if (issue.finding.problem) lines.push(`   问题：${issue.finding.problem}`);
            if (issue.finding.suggestion?.text) lines.push(`   建议：${issue.finding.suggestion.text}`);
            lines.push('');
          });
        } else {
          lines.push(this.reviewCompleteNow ? '没有未处置的问题。' : '本次审查尚未完成，未列出未处置问题。');
        }
        const pending = this.understandingValid
          ? (this.understanding?.alignment || []).filter(item => ['partial', 'not-found', 'unclear'].includes(item.status))
          : [];
        if (pending.length || !this.understandingValid || !this.requirementsList.length) {
          lines.push(`## 未对齐 / 待确认（${pending.length}）`);
          if (!this.understandingValid) lines.push('变更说明尚未生成，未对齐条目未参与本次整理。');
          else if (!pending.length) lines.push(this.requirementsList.length ? '没有未对齐或待确认条目。' : '未提供需求依据。');
        }
        pending.forEach(item => {
          const requirement = this.requirementText(item.requirementItemId) || '需求条目';
          const location = item.codeRefs?.length ? `位置：${this.refsText(item.codeRefs)}` : '位置：无代码定位';
          lines.push(`- ${requirement}（${this.alignmentStatusLabel(item.status)}）`);
          lines.push(`  ${location}${item.note ? `；${item.note}` : ''}`);
        });
        lines.push('', `交付：${title}`, `审查时间：${P.formatClock(this.snapshot?.createdAt)}`);
        return P.exports.maskSecrets(lines.join('\n'));
      },
      buildSupplementContent() {
        const delivery = this.currentDelivery || {};
        const snapshot = this.snapshot || {};
        const based = P.status.basedCommitOf(snapshot);
        const lines = [
          '## 来源',
          `- 交付：${delivery.title || '变更评审'}`,
          `- 审查时间：${P.formatClock(snapshot.createdAt)}`,
          `- 对比范围：${P.status.rangeTextOf({ delivery, snapshot })}`,
          `- 基于的提交：${based}`,
          `- ${this.reviewStateText}`,
          '',
          '## 请求',
          '请借助本会话可用的 Skill 为以下变更做补充说明。',
          '以所附说明为输入，资料不足请指出；不改写审查结论；本任务不修改业务代码。',
          'Skill 名称：（在此填写）',
          '',
          '## 已有变更说明',
          `目标：${this.understanding?.overview?.purpose || '—'}`,
        ];
        for (const feature of this.allFeatures) {
          lines.push(`- ${feature.title}：${feature.approach || feature.purpose || ''}`);
          if (feature.files?.length) lines.push(`  文件：${feature.files.join('、')}`);
          if (feature.refs?.length) lines.push(`  引用：${this.refsText(feature.refs)}`);
        }
        const skipped = this.coverage?.skipped || [];
        const failed = this.coverage?.failed || [];
        const withheld = this.coverage?.withheld || [];
        if (skipped.length || failed.length || withheld.length || !this.reviewCompleteNow) {
          lines.push('', '## 覆盖不足');
          if (this.incompleteReasonNow) lines.push(`- ${this.incompleteReasonNow}`);
          if (skipped.length) lines.push(`- 跳过 ${skipped.length} 个文件：${skipped.map(item => item.path).join('、')}`);
          if (failed.length) lines.push(`- 失败 ${failed.length} 个文件：${failed.map(item => item.path).join('、')}`);
          if (withheld.length) lines.push(`- ${withheld.length} 条结论证据未通过校验，未展示`);
        }
        return P.exports.maskSecrets(lines.join('\n'));
      },
      refsText(refs) { return (refs || []).map(ref => `${ref.path}${ref.startLine ? ':' + ref.startLine : ''}`).join('、'); },
      refLabel(ref) { const name = String(ref?.path || '').split('/').pop(); return ref?.startLine ? `${name}:${ref.startLine}` : name; },
      refTitle(ref) { return ref?.startLine ? `${ref.path}:${ref.startLine}` : String(ref?.path || ''); },
      fileLabel(filePath) { return String(filePath || '').split('/').pop(); },
      handleSend() {
        if (!String(this.dshDraft || '').trim()) return;
        P.sendBack.sends += 1;
        P.sendBack.modelCalls += 1;
        if (this.activeSessionId) this.sessionDrafts[this.activeSessionId] = '';
        this.dshDraft = '';
        P.message('演示：消息已发送，未连接真实模型');
      },
      draftForSession(sessionId) {
        if (!sessionId) return '';
        return Object.prototype.hasOwnProperty.call(this.sessionDrafts, sessionId) ? this.sessionDrafts[sessionId] || '' : '';
      },
      rememberActiveDraft() {
        if (this.activeSessionId) this.sessionDrafts[this.activeSessionId] = this.dshDraft || '';
      },
      bindConversationSession(seedDraft) {
        this.rememberActiveDraft();
        const target = this.devSessionFor(this.currentDelivery);
        if (!target) {
          this.activeSessionId = '';
          this.dshDraft = seedDraft !== undefined ? seedDraft || '' : '';
          this.conversationTitle = '';
          return;
        }
        if (seedDraft !== undefined && !Object.prototype.hasOwnProperty.call(this.sessionDrafts, target.sessionId)) {
          this.sessionDrafts[target.sessionId] = seedDraft || '';
        }
        this.activeSessionId = target.sessionId;
        this.dshDraft = this.draftForSession(target.sessionId);
        if (target.title) this.conversationTitle = target.title;
      },
      activateSession(sessionId) {
        if (!sessionId || sessionId === this.activeSessionId) return;
        this.rememberActiveDraft();
        const next = this.draftForSession(sessionId);
        this.activeSessionId = sessionId;
        this.dshDraft = next;
      },
      sendBackTargetError() {
        if (!this.snapshot) return '没有可用的审查记录';
        const sessionId = P.sendBack.lockedSessionId;
        if (!sessionId) return '该交付没有开发会话';
        const session = this.sessionsById[sessionId];
        if (!session) return '目标会话已不存在';
        const delivery = (this.deliveries || []).find(item => item.deliveryId === P.sendBack.lockedDeliveryId);
        if (!delivery) return '交付已不存在';
        if (!this.isDeliverySession(delivery, sessionId)) return '目标会话已不属于该交付';
        if (session.kind === 'review') return '目标不是开发会话';
        const projectKey = P.sendBack.lockedProjectKey || delivery.projectKey;
        if (!projectKey || session.projectKey !== projectKey || delivery.projectKey !== projectKey) return '目标会话属于其他仓库';
        if (this.snapshot.snapshotId !== P.sendBack.lockedSnapshotId) return '评审台已切换审查记录';
        return '';
      },
      openSendBackSession(sessionId = P.sendBack.lockedSessionId) {
        const session = this.sessionsById[sessionId] || null;
        if (session) {
          this.conversationTitle = session.title || this.conversationTitle;
          this.activateSession(session.sessionId);
        }
        this.view = 'conversation';
        this.openMenu = null;
        this.$nextTick(P.refreshFloating);
      },
      limitSendBackContent(content) {
        if (P.codePointLength(content) <= 20000) return content;
        return [...P.normalizeNewlines(content)].slice(0, 20000).join('') + '\n\n（内容超过 20000 字，已截断）';
      },
      sendBackToSession(template = 'fix') {
        if (template === 'supplement' && this.supplementDisabled) {
          P.message(this.supplementDisabledReason);
          return;
        }
        if (this.sendBackDisabled) { P.message('本次交付无关联会话'); return; }
        const target = this.sendBackTarget;
        const content = this.limitSendBackContent(template === 'supplement'
          ? this.buildSupplementContent() : this.buildSendBackContent());
        P.sendBack.lockedSessionId = target?.sessionId || '';
        P.sendBack.lockedProjectKey = this.currentDelivery?.projectKey || '';
        P.sendBack.lockedDeliveryId = this.currentDelivery?.deliveryId || '';
        P.sendBack.lockedSnapshotId = this.snapshot?.snapshotId || '';
        P.sendBack.lockedTemplate = template;
        P.sendBack.lockedContent = content;
        this.openMenu = null;
        if (target && P.status.sessionStateOf(target) === 'archived') {
          P.sendBack.copies += 1;
          P.copyText(content, '关联会话已归档，已复制到剪贴板；取消归档后可直接发回');
          return;
        }
        if (!String(this.draftForSession(target?.sessionId) || '').trim()) { this.writeSendBack(content); return; }
        this.sendBackDialog = {
          open: true,
          content,
          template,
          meta: `模板：${template === 'supplement' ? '补充说明' : '修改问题'} · 目标会话：${target?.title || '—'}` + (template === 'supplement' ? '' : ` · 待处理问题 ${this.activeFindingCount} 个`),
        };
        this.$nextTick(P.refreshFloating);
      },
      writeSendBack(content) {
        const error = this.sendBackTargetError();
        if (error) {
          P.sendBack.copies += 1;
          P.copyText(content, `无法写入草稿：${error}；内容已复制到剪贴板`);
          return;
        }
        const targetId = P.sendBack.lockedSessionId;
        if (targetId && this.activeSessionId !== targetId) this.activateSession(targetId);
        if (targetId) this.sessionDrafts[targetId] = content;
        this.dshDraft = content;
        P.sendBack.writes += 1;
        this.sendBackDialog.open = false;
        P.message('已写入草稿，未发送');
        this.openSendBackSession();
      },
      appendSendBack() {
        const content = this.sendBackDialog.content;
        const error = this.sendBackTargetError();
        if (error) {
          P.sendBack.copies += 1;
          P.copyText(content, `无法写入草稿：${error}；内容已复制到剪贴板`);
          return;
        }
        const targetId = P.sendBack.lockedSessionId;
        if (targetId && this.activeSessionId !== targetId) this.activateSession(targetId);
        const current = this.draftForSession(targetId);
        if (String(current || '').trim().includes(content.trim())) {
          this.sendBackDialog.open = false;
          P.message('该内容已在草稿中，未重复追加');
          this.openSendBackSession();
          return;
        }
        const next = String(current || '').trimEnd() + (String(current || '').trim() ? '\n\n' : '') + content;
        if (targetId) this.sessionDrafts[targetId] = next;
        this.dshDraft = next;
        P.sendBack.writes += 1;
        this.sendBackDialog.open = false;
        P.message('已追加到草稿，未发送');
        this.openSendBackSession();
      },
      copySendBack() {
        P.sendBack.copies += 1;
        P.copyText(this.sendBackDialog.content, '已复制发回会话内容');
        this.sendBackDialog.open = false;
      },
      closeSendBackDialog() { this.sendBackDialog.open = false; },
      withheldLocation(entry) {
        const path = entry?.anchor?.path || '';
        const name = path.split('/').pop();
        return entry?.anchor?.line ? `${name}:${entry.anchor.line}` : name;
      },
      withheldTitle(entry) {
        const path = entry?.anchor?.path || '';
        return entry?.anchor?.line ? `${path}:${entry.anchor.line}` : path;
      },
      withheldTarget(entry) {
        return this.normalizedDiffItems.some(item => item.path === entry?.anchor?.path);
      },
      withheldCodeLabel(code) {
        return {
          'missing-ref': '缺少代码引用',
          'evidence-line-not-covered': '证据未覆盖问题行',
          'evidence-quote-mismatch': '证据引文不一致',
          'evidence-sha-mismatch': '证据哈希不一致',
          'evidence-not-in-changed-lines': '证据不在变更行内',
          'evidence-path-missing': '证据路径不在审查记录中',
          'evidence-not-text': '证据指向非文本文件',
        }[code] || '证据未通过校验';
      },
      setPanel(mode) {
        if (mode === 'overview') this.showOverview();
        else if (mode === 'file') { this.mainView = 'diff'; this.panelMode = 'file'; this.reviewPaneSize = this.reviewPaneSize || 45; }
        else this.panelMode = null;
      },
      notifyAutoMode() { P.message((this.activeWorkspaceIsGit ? '当前仓库' : '当前工作区') + (this.autoMode ? '已开启演示自动审查偏好，不调用模型' : '已关闭演示自动审查偏好')); },
      setThemeMode(value, event) {
        const next = ['auto', 'light', 'dark'].includes(value) ? value : 'auto';
        if (next !== 'auto' && !storeTheme(next)) {
          clearStoredTheme();
          this.themeMode = 'auto';
          this.applyTheme();
          if (event?.target) event.target.value = this.themeMode;
          P.message('本地存储不可用，已跟随系统主题');
          return;
        }
        this.themeMode = next;
        if (next === 'auto' && !storeTheme(next)) clearStoredTheme();
        this.applyTheme();
      },
      toggleDemoTheme(target) {
        const next = ['light', 'dark'].includes(target) ? target : (this.effectiveTheme === 'dark' ? 'light' : 'dark');
        this.setThemeMode(next);
      },
      applyTheme() {
        const root = document.documentElement;
        if (this.themeMode === 'auto') root.removeAttribute('data-theme');
        else root.dataset.theme = this.themeMode;
        const light = document.getElementById('hljs-light');
        const dark = document.getElementById('hljs-dark');
        if (light) light.media = this.effectiveTheme === 'dark' ? 'not all' : 'all';
        if (dark) dark.media = this.effectiveTheme === 'dark' ? 'all' : 'not all';
      },
      toggleMenu(name) {
        P.hideTip();
        this.menuTrigger = document.activeElement;
        this.openMenu = this.openMenu === name ? null : name;
        this.$nextTick(P.refreshFloating);
      },
      // ---------- file selection ----------
      matchesKeyword(item) {
        const keyword = this.fileSearchKeyword.trim().toLowerCase();
        const origin = this.originDiffDict[item.md5_str];
        return [item.path, origin?.old_path, origin?.new_path].some(path => path?.toLowerCase().includes(keyword));
      },
      hasRiskFlag(item) { return this.issueCountByFile[item.md5_str]?.total > 0; },
      isPendingReview(item) { return item.reviewStatus === 'pending'; },
      isReviewConsideredComplete(item) {
        return ['reviewed', 'carried'].includes(item.reviewStatus) && !this.hasRiskFlag(item) && !(item.withheld || []).length;
      },
      isFileRiskResolved(key) { const nav = this.fileRiskNavByFile[key]; return nav && nav.resolved >= nav.total; },
      getFileRiskIssues(key) { return this.issueItemsByFile[key] || []; },
      fileTip(item) {
        const stats = P.stats(this.originDiffDict[item.md5_str]?.diff);
        return `<div class="file-pop-title"><span class="file-pop-title__path">${P.escape(item.path)}</span><span class="file-pop-title__delta">${stats.added || stats.deleted ? `(+${stats.added} -${stats.deleted})` : ''}</span></div>`;
      },
      showCrResult(key, { locateFirst = true } = {}) {
        const sameFile = key === this.selectedFileItem.md5_str;
        if (!sameFile) this.stickyFileKey = null;
        this.selectedFileItem = this.normalizedDiffItems.find(item => item.md5_str === key) || {};
        if (sameFile && locateFirst && this.optimizationFlags.O2) this.$nextTick(() => this.$refs.codeReview?.locateFirstIssue());
      },
      revealFile(item) {
        if (!item) return;
        if (this.fileFilterMode !== 'all') {
          const visible = this.fileFilterMode === 'risk' ? this.hasRiskFlag(item) : this.isPendingReview(item);
          if (!visible) this.fileFilterMode = 'all';
        }
        if (this.fileSearchKeyword.trim() && !this.matchesKeyword(item)) this.fileSearchKeyword = '';
        this.collapsedDirectories = {};
      },
      selectByPath(path, { scrollTop = true } = {}) {
        const match = this.normalizedDiffItems.find(item => item.path === path);
        if (!match) return;
        this.revealFile(match);
        this.mainView = 'diff';
        this.showCrResult(match.md5_str, { locateFirst: false });
        if (scrollTop) this.$nextTick(() => this.$nextTick(() => this.$refs.codeReview?.scrollToFileTop()));
      },
      filterLabel(mode) { return { all: '全部文件', risk: '风险文件', pending: '待审文件' }[mode] || mode; },
      fileStatus(item) {
        if ((item.withheld || []).length) return 'withheld';
        if (item.reviewStatus === 'skipped') return 'skipped';
        if (item.reviewStatus === 'metadata') return 'metadata';
        if (this.hasRiskFlag(item)) return 'risk';
        if (item.reviewStatus === 'pending') return 'pending';
        if (this.isFileRiskResolved(item.md5_str)) return 'suppressed';
        if (item.carriedFrom) return 'carried';
        if (this.isReviewConsideredComplete(item)) return 'complete';
        return 'pending';
      },
      fileStatusLabel(item) {
        const status = this.fileStatus(item);
        if (status === 'carried') return '沿用自 ' + (item.carriedFromLabel || '更早的审查');
        return { withheld: '结论未通过校验', skipped: '已跳过', metadata: '仅元数据', risk: '有待处理问题', pending: '待审', suppressed: '问题已全部标记', complete: '已完成' }[status];
      },
      // ---------- panels and main view ----------
      showOverview() {
        if (!this.snapshot) return;
        this.mainView = 'overview';
        this.panelMode = null;
        P.hideTip();
      },
      scrollToOverviewSection(id) {
        if (!this.snapshot) return;
        this.mainView = 'overview';
        this.panelMode = null;
        P.hideTip();
        this.$nextTick(() => {
          const section = document.getElementById(id);
          section?.scrollIntoView({ block: 'start', behavior: 'smooth' });
          if (section) {
            section.classList.add('overview-section--target');
            setTimeout(() => section.classList.remove('overview-section--target'), 1600);
          }
        });
      },
      showOverviewProblems() {
        if (!this.snapshot) return;
        const problems = document.getElementById('overview-problems');
        const coverage = document.getElementById('overview-coverage');
        this.scrollToOverviewSection('overview-problems');
        this.$nextTick(() => {
          for (const section of [problems, coverage]) {
            if (!section) continue;
            section.classList.add('overview-section--target');
            setTimeout(() => section.classList.remove('overview-section--target'), 1600);
          }
        });
      },
      pendingCoverageFiles() {
        return this.normalizedDiffItems.filter(item => item.reviewable && item.reviewStatus === 'pending').map(item => item.path);
      },
      scrollToFeature(featureId) {
        this.scrollToOverviewSection('feature-' + featureId);
      },
      toggleFilePanel() {
        if (!this.selectedFileItem.path) return;
        this.mainView = 'diff';
        this.panelMode = this.panelMode === 'file' ? null : 'file';
        if (this.panelMode) this.reviewPaneSize = this.reviewPaneSize || 45;
        P.hideTip();
      },
      closePanel() { this.panelMode = null; },
      onReviewResized(event) {
        const panes = Array.isArray(event) ? event : event.panes;
        if (this.panelOpen && panes?.[1]) this.reviewPaneSize = panes[1].size;
        if (this.panelOpen && panes?.[0]) this.reviewDiffPaneSize = panes[0].size;
      },
      // ---------- annotations ----------
      annotationFacts(side) {
        const file = this.selectedFileItem?.file || {};
        return side === 'base'
          ? { hash: file.baseSha256, count: file.baseLineCount }
          : { hash: file.headSha256, count: file.headLineCount };
      },
      annotationLabelFor({ side, line, findingId }) {
        let anchorSide = side || 'head';
        let anchorLine = line;
        if (findingId) {
          const issue = Object.values(this.issueItemsByFile || {}).flat().find(entry => entry.issueKey === findingId);
          anchorSide = issue?.finding?.anchor?.side || 'head';
          anchorLine = issue?.finding?.anchor?.line ?? null;
        }
        if (!anchorLine) return '批注 · 文件级';
        if (this.formattedDiffStyle) return `批注 · 第 ${anchorLine} 行`;
        return anchorSide === 'base' ? `批注 · 旧代码第 ${anchorLine} 行` : `批注 · 新代码第 ${anchorLine} 行`;
      },
      annotationSubtitleFor(findingId) {
        if (!findingId) return '';
        const issue = Object.values(this.issueItemsByFile || {}).flat().find(entry => entry.issueKey === findingId);
        return issue ? `关于 ${issue.title}` : '';
      },
      openAnnotationEditor({ side = 'head', line = null, findingId = null, annotationId = null, text = '' } = {}) {
        if (!this.snapshot) return;
        if (this.readonly) { P.message(this.readonlyMessage()); return; }
        if (annotationId) {
          const annotation = this.snapshotAnnotations.find(entry => entry.annotationId === annotationId);
          if (!annotation) return;
          const key = 'edit:' + annotationId;
          this.annotationEditor = {
            open: true, key, side: annotation.anchor?.side || 'head', line: annotation.anchor?.startLine ?? null,
            findingId: annotation.findingId || null, annotationId,
            text: Object.prototype.hasOwnProperty.call(this.annotationDrafts, key) ? this.annotationDrafts[key] : annotation.text,
            error: '', label: this.annotationLabelFor({ side: annotation.anchor?.side, line: annotation.anchor?.startLine, findingId: annotation.findingId }),
            subtitle: this.annotationSubtitleFor(annotation.findingId),
          };
          return;
        }
        const key = `${this.selectedFileItem?.path || ''}|${side}|${line ?? 'file'}|${findingId || ''}`;
        this.annotationEditor = {
          open: true, key, side, line, findingId, annotationId: null,
          text: Object.prototype.hasOwnProperty.call(this.annotationDrafts, key) ? this.annotationDrafts[key] : text,
          error: '', label: this.annotationLabelFor({ side, line, findingId }), subtitle: this.annotationSubtitleFor(findingId),
        };
      },
      updateAnnotationDraft(text) {
        if (!this.annotationEditor.open) return;
        this.annotationEditor.text = text;
        this.annotationDrafts[this.annotationEditor.key] = text;
      },
      annotationAnchorFor(side, line) {
        const facts = this.annotationFacts(side);
        if (!facts.hash || !Number.isInteger(facts.count)) return null;
        return { path: this.selectedFileItem.path, side, startLine: line, endLine: line, sha256: facts.hash };
      },
      focusAnnotationEntry(editor, annotationId = null) {
        this.$nextTick(() => this.$nextTick(() => {
          let target = annotationId && document.querySelector(`.annotation-card[data-annotation-id="${CSS.escape(annotationId)}"] [data-action="edit"]`);
          if (!target && editor.findingId) target = document.querySelector(`.gpt-risk-marker[data-issue-key="${CSS.escape(editor.findingId)}"] .issue-card-comment`);
          target?.focus({ preventScroll: true });
        }));
      },
      saveAnnotation() {
        const editor = this.annotationEditor;
        if (!editor.open || !this.snapshot) return;
        const snapshotId = this.snapshot.snapshotId;
        let result;
        if (editor.annotationId) {
          result = P.annotations.update(editor.annotationId, { text: editor.text });
        } else if (editor.findingId) {
          result = P.annotations.add({ snapshotId, findingId: editor.findingId, text: editor.text });
        } else {
          const anchor = this.annotationAnchorFor(editor.side, editor.line);
          if (!anchor) { this.annotationEditor.error = '该位置没有冻结文本，不能批注'; return; }
          result = P.annotations.add({ snapshotId, anchor, text: editor.text });
        }
        if (!result?.ok) {
          this.annotationEditor.error = result?.message || '保存失败';
          return;
        }
        delete this.annotationDrafts[editor.key];
        this.annotationEditor = { ...editor, open: false, error: '' };
        this.annotationVersion++;
        this.focusAnnotationEntry(editor, result.annotation?.annotationId);
        P.message('已保存，发回会话时一并带入');
      },
      cancelAnnotationEditor() {
        if (this.annotationEditor.open) this.annotationDrafts[this.annotationEditor.key] = this.annotationEditor.text;
        const editor = this.annotationEditor;
        this.annotationEditor = { ...editor, open: false };
        this.focusAnnotationEntry(editor, editor.annotationId);
      },
      copyAnnotationById(annotationId) {
        const annotation = this.snapshotAnnotations.find(entry => entry.annotationId === annotationId);
        if (!annotation) return;
        const location = annotation.anchor?.startLine
          ? `${annotation.anchor.path}:${annotation.anchor.startLine}`
          : `${annotation.anchor?.path || ''}（文件级）`;
        P.copyText(`批注 · ${location}\n${annotation.text}`, '已复制批注与位置');
      },
      deleteAnnotationById(annotationId) {
        const result = P.annotations.remove(annotationId);
        if (!result?.ok) { P.message(result?.message || '删除失败'); return; }
        if (this.annotationUndo.timer) clearTimeout(this.annotationUndo.timer);
        const timer = setTimeout(() => { this.annotationUndo = { open: false, annotation: null, timer: null }; }, 6000);
        this.annotationUndo = { open: true, annotation: result.annotation, timer };
        this.annotationEditor = { ...this.annotationEditor, open: false };
        this.annotationVersion++;
      },
      undoAnnotationDelete() {
        const annotation = this.annotationUndo.annotation;
        if (this.annotationUndo.timer) clearTimeout(this.annotationUndo.timer);
        this.annotationUndo = { open: false, annotation: null, timer: null };
        if (!annotation) return;
        const result = P.annotations.restore(annotation);
        if (!result?.ok) { P.message(result?.message || '撤销失败'); return; }
        this.annotationVersion++;
        P.message('已恢复批注');
      },
      jumpToAnnotation(annotation) {
        if (!annotation?.anchor?.path) return;
        this.selectByPath(annotation.anchor.path, { scrollTop: false });
        if (annotation.anchor.startLine) {
          this.$nextTick(() => this.$nextTick(() => {
            const review = this.$refs.codeReview;
            review?.cancelAutoLocate();
            const side = annotation.anchor.side === 'base' ? 'left' : 'right';
            const row = review?.findLine(annotation.anchor.startLine, side);
            row?.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }));
        }
      },
      codeHunkFor(item, side, lineNumber) {
        const path = item?.path || item?.file?.path || '';
        const diff = String(item?.file?.diff ?? item?.origin?.diff ?? this.selectedOrigin?.diff ?? '');
        const rows = [];
        let oldLine = 0, newLine = 0, inHunk = false;
        for (const raw of diff.replace(/\r\n/g, '\n').split('\n')) {
          const head = raw.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
          if (head) { inHunk = true; oldLine = Number(head[1]); newLine = Number(head[2]); continue; }
          if (!inHunk || !raw || raw.startsWith('\\')) continue;
          const prefix = raw[0];
          const text = raw.slice(1);
          if (prefix === '+') { rows.push({ oldLine: null, newLine, text, prefix }); newLine++; }
          else if (prefix === '-') { rows.push({ oldLine, newLine: null, text, prefix }); oldLine++; }
          else if (prefix === ' ') { rows.push({ oldLine, newLine, text, prefix }); oldLine++; newLine++; }
        }
        const lineOf = row => side === 'base' ? (row.oldLine ?? row.newLine) : (row.newLine ?? row.oldLine);
        const index = rows.findIndex(row => lineOf(row) === lineNumber);
        const ext = String(path).split('.').pop().toLowerCase();
        const language = ({ js: 'js', mjs: 'js', cjs: 'js', jsx: 'jsx', ts: 'ts', tsx: 'tsx', html: 'html', htm: 'html', css: 'css', json: 'json', md: 'md', vue: 'vue' })[ext] || '';
        if (index < 0) return { text: '', language, found: false };
        const start = Math.max(0, index - 2);
        const end = Math.min(rows.length, index + 3);
        const text = rows.slice(start, end).map(row => `${lineOf(row)} | ${row.prefix} ${row.text}`).join('\n');
        return { text, language, found: true };
      },
      askIssueInSession(issue) {
        const item = this.selectedFileItem || {};
        const path = item.path || item.file?.path || '';
        const line = issue?.lineNumber || 0;
        const title = issue?.title || '';
        const quote = String(issue?.finding?.evidence?.[0]?.quote || issue?.summary || '').replace(/\r\n/g, '\n').trim();
        const marker = `关于 \`${path}:${line}\` 的问题【${title}】`;
        const lines = [marker + '：', '> ' + quote.replace(/\n/g, '\n> ')];
        if (issue?.finding?.problem) lines.push(issue.finding.problem);
        if (issue?.finding?.suggestion?.text) lines.push('建议：' + issue.finding.suggestion.text);
        lines.push('请分析这里的上下文并评估是否存在该风险或如何修复？');
        this.appendAskToSession(lines.join('\n'), marker);
      },
      askCodeHunkInSession(item, side, lineNumber) {
        const path = item?.path || item?.file?.path || this.selectedFileItem?.path || '';
        const line = Number(lineNumber) || 0;
        const hunk = this.codeHunkFor(item, side, line);
        const marker = `关于 \`${path}:${line}\` 的代码段`;
        const content = [
          marker + '：',
          '```' + hunk.language,
          hunk.text,
          '```',
          '请结合上下文分析这段代码，是否存在安全/规范隐患，以及如何改进？',
        ].join('\n');
        this.appendAskToSession(content, marker);
      },
      appendAskToSession(content, marker) {
        const maskedContent = P.exports.maskSecrets(content);
        const maskedMarker = P.exports.maskSecrets(marker);
        const target = this.devSessionFor(this.currentDelivery);
        const view = target ? P.status.sessionViewOf(target) : null;
        if (!target || !view || ['deleted', 'archived', 'unaddressable', 'unavailable'].includes(view.state)) {
          P.copyText(maskedContent, '目标会话不可用，内容已复制到剪贴板');
          return;
        }
        const activeDraft = (this.activeSessionId === target.sessionId) ? String(this.dshDraft || '') : '';
        const targetDraft = this.draftForSession(target.sessionId);
        if (activeDraft.includes(maskedMarker) || String(targetDraft || '').includes(maskedMarker)) {
          P.message('该问题已在追问草稿中，未重复追加');
          this.openSendBackSession(target.sessionId);
          return;
        }
        this.rememberActiveDraft();
        const current = this.draftForSession(target.sessionId);
        const next = String(current || '') + (String(current || '') ? '\n\n' : '') + maskedContent;
        this.sessionDrafts[target.sessionId] = next;
        this.activeSessionId = target.sessionId;
        this.dshDraft = next;
        if (target.title) this.conversationTitle = target.title;
        P.message('已追加到草稿，未发送');
        this.openSendBackSession(target.sessionId);
      },
      // ---------- review runs ----------
      delay(ms) { return new Promise(resolve => this.timers.push(setTimeout(resolve, ms))); },
      handleRunAction(action) {
        if (action === 'cancel') return this.cancelReview();
        if (action === 're-review') return this.reReviewAll();
        return this.handleReviewAll();
      },
      handleReviewAll() {
        if (this.readonly) { P.message(this.readonlyMessage()); return; }
        if (this.isRunning) return;
        this.startReview({ scope: 'incremental' });
      },
      handleCodeReview() {
        if (this.readonly) { P.message(this.readonlyMessage()); return; }
        if (!this.canReviewSelectedFile) return;
        this.startReview({ scope: 'file', file: this.selectedFileItem });
      },
      reReviewAll() {
        if (this.readonly) { P.message(this.readonlyMessage()); return; }
        if (this.isRunning) return;
        this.openMenu = null;
        this.startReview({ scope: 'all', force: true });
      },
      async startReview({ scope = 'all', file = null, force = false } = {}) {
        if (!this.snapshot || this.readonly || this.isRunning) return;
        if (this.extensionPromptChanged && !this.applyExtensionPromptSnapshot()) return;
        this.openMenu = null;
        if (!file) {
          this.withheldFindings = [];
          for (const raw of Object.values(this.diffDict)) raw.withheld = [];
        }
        if (force) {
          if (this.understanding) this.understanding.stale = true;
          for (const item of this.normalizedDiffItems) {
            const raw = this.diffDict[item.md5_str];
            if (!raw?.reviewable) continue;
            const all = new Map([...(raw.findings || []), ...(raw.pendingFindings || [])].map(finding => [finding.findingId, finding]));
            raw.reviewStatus = 'pending';
            raw.suggestion = '';
            raw.findings = [];
            raw.pendingFindings = [...all.values()];
            raw.carriedFrom = '';
          }
        }
        let targets;
        if (file) targets = [file.md5_str].filter(key => this.diffDict[key]?.reviewStatus === 'pending');
        else targets = this.normalizedDiffItems.filter(item => item.reviewStatus === 'pending').map(item => item.md5_str);
        if (file) {
          const targetPaths = new Set(targets.map(key => this.diffDict[key]?.path).filter(Boolean));
          for (const key of targets) if (this.diffDict[key]) this.diffDict[key].withheld = [];
          this.withheldFindings = (this.withheldFindings || []).filter(entry => !targetPaths.has(entry.anchor?.path));
        }
        if (!targets.length) { P.message('没有待审文件'); return; }
        const skipped = this.coverage?.skipped || [];
        this.coverage = { reviewed: [], skipped, failed: [], withheld: [] };
        this.run = {
          runId: 'run-' + P.sha256(String(Date.now()) + targets.join(',')).slice(0, 12),
          generation: (this.run?.generation || 0) + 1,
          snapshotId: this.snapshot.snapshotId,
          scope: file ? `file:${file.path}` : (force ? 'all' : scope),
          startedAt: P.nowIso(), endedAt: null, status: 'running',
          model: 'DeepSeek-V4.1-Flash',
          coverage: this.coverage,
        };
        this.reviewRun++;
        const generation = this.reviewRun;
        this.timers.forEach(clearTimeout); this.timers = [];
        for (const key of targets) {
          await this.delay(file ? 620 : 520);
          if (generation !== this.reviewRun) return;
          const item = this.diffDict[key];
          if (!item) continue;
          item.reviewStatus = 'reviewed';
          item.carriedFrom = '';
          item.suggestion = item.semantic || '本文件已完成审查，未提供额外的逐文件说明。';
          if ((item.pendingFindings || []).length) {
            item.findings = item.pendingFindings;
            item.pendingFindings = [];
          }
        }
        if (generation !== this.reviewRun || !this.run) return;
        this.rebuildCoverage();
        this.run.status = 'succeeded';
        this.run.endedAt = P.nowIso();
        this.run.coverage = this.coverage;
        if (!file && (!this.understanding || this.understanding.stale)) {
          if (this.understanding) this.understanding.stale = false;
          else if (window.CR_PROTOTYPE_DATA?.understanding) {
            this.understanding = JSON.parse(JSON.stringify(window.CR_PROTOTYPE_DATA.understanding));
          }
          this.staleNotice = '';
          this.noticeKind = '';
        }
        if (!file) this.ensureAlignmentCoverage();
        this.refreshDeliveryLatest();
        this.captureCurrentRecord();
        this.$nextTick(() => {
          this.showCrResult(this.selectedFileItem.md5_str || this.displayedFileList[0]?.md5_str);
          P.refreshFloating();
        });
        P.message(file ? '本文件已审完' : '已审查全部文件');
      },
      cancelReview() {
        if (!this.isRunning) return;
        this.reviewRun++;
        this.timers.forEach(clearTimeout); this.timers = [];
        this.rebuildCoverage();
        this.run.status = 'cancelled';
        this.run.errorCode = 'cancelled-by-user';
        this.run.endedAt = P.nowIso();
        this.run.coverage = this.coverage;
        this.refreshDeliveryLatest();
        P.message('审查已取消');
      },
      ensureAlignmentCoverage() {
        if (!this.understanding) return;
        const existing = new Set((this.understanding.alignment || []).map(item => item.requirementItemId));
        const missing = this.requirementItems.filter(item => !existing.has(item.itemId));
        if (!missing.length) return;
        this.understanding.alignment = [
          ...(this.understanding.alignment || []),
          ...missing.map(item => ({
            requirementItemId: item.itemId, status: 'unclear', codeRefs: [],
            note: '新增需求依据尚未在本次审查中完成对齐。', basis: 'model',
          })),
        ];
      },
      refreshDeliveryLatest() {
        const delivery = this.currentDelivery;
        if (!delivery || !this.snapshot || this.recordDerived) return;
        if (this.snapshot.deliveryId && this.snapshot.deliveryId !== delivery.deliveryId) return;
        const snapshotEntry = delivery.snapshots?.find(entry => entry.snapshotId === this.snapshot.snapshotId);
        if (!snapshotEntry) return;
        const active = this.activeFindingCount;
        const requirementPending = (this.understanding?.alignment || []).filter(item => item.status !== 'implemented').length;
        const highestSeverity = ['P0', 'P1', 'P2'].find(severity =>
          this.activeFindingsList.some(issue => issue.severity === severity)) || null;
        const complete = this.reviewCompleteNow;
        const status = complete ? (active > 0 ? 'issues' : 'zero') : (this.pendingCount > 0 ? 'pending' : 'incomplete');
        delivery.latestSnapshotId = this.snapshot.snapshotId;
        if (complete) snapshotEntry.mode = active > 0 ? 'reviewed' : 'zero';
        else if (!String(this.run?.scope || '').startsWith('file:')) snapshotEntry.mode = 'incomplete';
        Object.assign(snapshotEntry, this.snapshotEntryMeta(this.snapshot, {
          mode: snapshotEntry.mode, findingCount: active, sessionId: snapshotEntry.sessionId,
        }), {
          pendingCount: this.pendingCount, failedCount: this.failedFilesCount,
          withheldCount: this.withheldCount, runStatus: this.run?.status || null,
          snapshotStatus: this.snapshot.status, validFindingCount: active,
          highestSeverity, complete,
        });
        delivery.latest = {
          status, validFindingCount: active, highestSeverity, requirementPending, complete,
          runStatus: this.run?.status || null, createdAt: this.run?.endedAt || P.nowIso(),
          pendingCount: this.pendingCount,
          failedCount: this.failedFilesCount,
          withheldCount: this.withheldCount,
          snapshotStatus: this.snapshot?.status || null,
        };
      },
      rebuildCoverage() {
        const reviewed = [], skipped = [], withheld = [];
        for (const item of this.normalizedDiffItems) {
          if (item.reviewStatus === 'reviewed' || item.reviewStatus === 'carried') reviewed.push(item.path);
          else if (item.reviewStatus === 'skipped' || item.reviewStatus === 'metadata') {
            skipped.push({ path: item.path, reason: item.skipReason });
          }
          for (const entry of item.withheld || []) {
            withheld.push({
              kind: entry.kind || 'finding',
              ref: entry.findingId || entry.findingRef || entry.ref || '',
              code: entry.code || 'unknown',
            });
          }
        }
        this.coverage = { reviewed, skipped, failed: this.coverage?.failed || [], withheld };
        if (this.run) this.run.coverage = this.coverage;
        return this.coverage;
      },
      // ---------- marks ----------
      readonlyMessage() { return this.isViewingEarlier || this.isHistory ? '更早的审查记录 · 处置只读' : '只读交付 · 处置不可用'; },
      askSuppression(issue, event) {
        if (this.readonly) { P.message(this.readonlyMessage()); return; }
        P.hideTip();
        const rect = event.currentTarget.getBoundingClientRect();
        this.ui.confirm = { issue, anchor: event.currentTarget, x: Math.max(8, Math.min(innerWidth - 300, rect.right - 292)), y: Math.max(8, rect.top - 120) };
      },
      async toggleIssueSuppression(issue, feedback) {
        if (this.readonly) { P.message(this.readonlyMessage()); return; }
        const item = this.diffDict[issue.fileKey];
        if (!item) return;
        const operationKey = `${issue.fileKey}:${issue.issueKey}`;
        if (this.pendingIssueSaves[operationKey]) return;
        const overrides = { ...(item.issue_overrides || {}) };
        const previous = overrides[issue.issueKey];
        const disposition = { by: '用户（演示）', at: P.nowIso() };
        const run = this.reviewRun;
        this.pendingIssueSaves[operationKey] = true;
        this.isSavingIssueOverride = true;
        overrides[issue.issueKey] = {
          ...(previous || {}),
          suppressed: !issue.suppressed,
          updatedBy: disposition.by,
          updatedAt: disposition.at,
        };
        item.issue_overrides = overrides;
        this.ui.confirm = null;
        feedback?.afterApply?.();
        await this.delay(140);
        if (run !== this.reviewRun) return;
        delete this.pendingIssueSaves[operationKey];
        this.isSavingIssueOverride = Object.keys(this.pendingIssueSaves).length > 0;
        this.marks = (this.marks || []).filter(mark => mark.findingId !== issue.issueKey);
        this.marks.push({
          findingId: issue.issueKey, snapshotId: this.snapshot?.snapshotId || '',
          suppressed: Boolean(overrides[issue.issueKey]?.suppressed),
          by: disposition.by, at: disposition.at,
        });
        this.refreshDeliveryLatest();
        this.captureCurrentRecord();
        await feedback?.afterSave?.(true);
      },
      // ---------- extension prompt ----------
      openExtensionDialog(mode = 'edit') {
        this.extensionDiscardOpen = false; this.extensionComposing = false;
        this.extensionDialog = { open: true, mode, draft: this.extensionPrompt || '', initial: this.extensionPrompt || '' };
        this.openMenu = null;
        this.$nextTick(() => this.$refs.extensionText?.focus());
      },
      closeExtensionDialog() {
        if (this.extensionDirty) {
          this.extensionDiscardOpen = true;
          this.$nextTick(() => this.$refs.keepExtension?.focus());
        } else this.finishCloseExtension();
      },
      keepEditingExtension() { this.extensionDiscardOpen = false; this.$nextTick(() => this.$refs.extensionText?.focus()); },
      finishCloseExtension() {
        this.extensionDialog.open = false; this.extensionDiscardOpen = false; this.extensionComposing = false;
        this.openMenu = 'settings';
        this.$nextTick(() => [...document.querySelectorAll('.settings-menu .osw-text-link')].find(node => node.getClientRects().length)?.focus());
      },
      clearExtensionDraft() { this.extensionDialog.draft = ''; },
      importExtensionFile(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => { this.extensionDialog.draft = String(reader.result || '').replace(/\r\n/g, '\n'); };
        reader.onerror = () => P.message('读取文件失败，请改用粘贴');
        reader.readAsText(file);
      },
      saveExtensionPrompt() {
        if (this.extensionOverLimit) return;
        const text = String(this.extensionDialog.draft || '').replace(/\r\n/g, '\n');
        this.extensionPrompt = text.trim() ? text : '';
        this.finishCloseExtension();
        this.saveRepoSettings();
        P.message(this.extensionPrompt.trim() ? '扩展提示词已保存' : '扩展提示词已清空');
      },
      restoreFrozenRecord() {
        const delivery = this.currentDelivery;
        if (!delivery || !this.recordDerived) return;
        const entry = (delivery.snapshots || []).find(item => item.snapshotId === delivery.latestSnapshotId) || null;
        this.openDelivery(delivery, entry, 'list', { preserveView: true });
      },
      applyExtensionPromptSnapshot() {
        if (!this.snapshot) return false;
        const nextExtensionPrompt = this.extensionPrompt || '';
        this.restoreFrozenRecord();
        if (this.recordDerived) {
          P.message('请先打开最新审查记录，再按新扩展提示词审查');
          return false;
        }
        this.captureCurrentRecord();
        const text = P.normalizeNewlines(nextExtensionPrompt);
        this.extensionPrompt = text;
        const extension = text.trim() ? { text, sha256: P.sha256(text), length: P.codePointLength(text) } : null;
        const previousSnapshotData = JSON.parse(JSON.stringify(this.snapshot));
        const previousSnapshotId = this.snapshot.snapshotId;
        const previousCreatedAt = this.snapshot.createdAt;
        this.snapshot.extensionPrompt = extension;
        const baseRules = window.CR_PROTOTYPE_DATA?.meta?.rulesVersion || 'evidentloop-rules-v0.1';
        this.snapshot.rulesVersion = extension
          ? baseRules + '+' + P.sha256('extension:' + extension.sha256).slice(0, 8)
          : baseRules;
        this.snapshot.snapshotId = 'snap-' + P.sha256(this.snapshot.snapshotId + ':' + (extension?.sha256 || '')).slice(0, 12);
        this.snapshot.createdAt = P.nowIso();
        this.snapshot.inputSha = P.sha256(JSON.stringify({
          previous: this.snapshot.inputSha,
          extension: extension?.sha256 || '',
          rules: this.snapshot.rulesVersion,
        }));
        const delivery = this.currentDelivery;
        if (delivery) {
          delivery.snapshotRequirements = JSON.parse(JSON.stringify(this.snapshot.requirements || []));
          delivery.previousSnapshotData = previousSnapshotData;
          delivery.latestSnapshotId = this.snapshot.snapshotId;
          const previousEntry = (delivery.snapshots || []).find(snapshot => snapshot.snapshotId === previousSnapshotId) || {};
          delivery.snapshots = [
            this.snapshotEntryMeta(this.snapshot, { mode: 'unreviewed', findingCount: 0, sessionId: previousEntry.sessionId }),
            {
              ...previousEntry,
              ...this.snapshotEntryMeta(previousSnapshotData, {
                mode: 'history', findingCount: this.activeFindingCount, sessionId: previousEntry.sessionId,
              }),
            },
            ...(delivery.snapshots || []).filter(snapshot =>
              snapshot.snapshotId !== previousSnapshotId && snapshot.snapshotId !== this.snapshot.snapshotId),
          ];
          delivery.snapshotExtensionPrompt = extension;
          delivery.snapshotRulesVersion = this.snapshot.rulesVersion;
          delivery.snapshotInputSha = this.snapshot.inputSha;
          delivery.latest = {
            status: 'pending', validFindingCount: 0, highestSeverity: null,
            requirementPending: 0, complete: false, runStatus: null, createdAt: this.snapshot.createdAt,
          };
        }
        const selectedKey = this.selectedFileItem.md5_str;
        for (const key of Object.keys(this.diffDict)) {
          const item = this.diffDict[key];
          if (!item.reviewable) continue;
          const all = new Map([...(item.findings || []), ...(item.pendingFindings || [])].map(finding => [finding.findingId, finding]));
          item.reviewStatus = 'pending';
          item.suggestion = '';
          item.findings = [];
          item.pendingFindings = [...all.values()];
          item.issue_overrides = {};
          item.carriedFrom = '';
          item.withheld = [];
        }
        this.run = null;
        this.understanding = null;
        this.marks = [];
        this.withheldFindings = [];
        this.coverage = { reviewed: [], skipped: this.coverage?.skipped || [], failed: [], withheld: [] };
        this.staleNotice = '';
        this.noticeKind = '';
        this.panelMode = null;
        this.layoutKey++;
        this.$nextTick(() => { this.showCrResult(selectedKey || this.displayedFileList[0]?.md5_str); P.refreshFloating(); });
        return true;
      },
      // ---------- requirements ----------
      openRequirementDialog() {
        if (this.readonly) { P.message(this.readonlyMessage()); return; }
        if (!this.snapshot) return;
        this.requirementDialog = { open: true, text: '', kind: 'paste', origin: '粘贴 · 用户', truncated: false, originalLength: 0, fileName: '' };
        this.$nextTick(() => this.$refs.requirementText?.focus());
      },
      closeRequirementDialog() { this.requirementDialog.open = false; },
      setRequirementKind(kind) {
        this.requirementDialog.kind = kind;
        this.requirementDialog.origin = kind === 'paste' ? '粘贴 · 用户' : (this.requirementDialog.fileName ? '文件 · ' + this.requirementDialog.fileName : '文件 · 待选择');
      },
      readRequirementFile(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const raw = String(reader.result || '');
          const limit = 20000;
          this.requirementDialog.text = raw.slice(0, limit);
          this.requirementDialog.truncated = raw.length > limit;
          this.requirementDialog.originalLength = raw.length;
          this.requirementDialog.kind = 'file';
          this.requirementDialog.fileName = file.name;
          this.requirementDialog.origin = '文件 · ' + file.name;
        };
        reader.onerror = () => P.message('读取文件失败，请改用粘贴');
        reader.readAsText(file);
      },
      confirmRequirement() {
        if (this.readonly) { P.message(this.readonlyMessage()); return; }
        if (!this.canAddRequirement) return;
        if (this.isRunning) { P.message('审查进行中，完成后再添加需求依据'); return; }
        const dialog = { ...this.requirementDialog };
        const nextExtensionPrompt = this.extensionPrompt;
        this.captureCurrentRecord();
        this.restoreFrozenRecord();
        if (this.recordDerived) {
          this.requirementDialog = { ...dialog, open: true };
          P.message('最新审查记录暂不可用，请刷新后重试');
          return;
        }
        this.requirementDialog = { ...dialog };
        this.extensionPrompt = nextExtensionPrompt;
        const previousSnapshotData = JSON.parse(JSON.stringify(this.snapshot));
        const previousSnapshotId = this.snapshot.snapshotId;
        const previousCreatedAt = this.snapshot.createdAt;
        const source = P.makeRequirementSource(dialog.text, {
          kind: dialog.kind,
          origin: dialog.origin,
          order: (this.snapshot.requirements || []).length,
          truncated: dialog.truncated,
          originalLength: dialog.originalLength || dialog.text.length,
        });
        this.snapshot.requirements = [...(this.snapshot.requirements || []), source];
        this.snapshot.snapshotId = 'snap-' + P.sha256(this.snapshot.snapshotId + source.sha256).slice(0, 12);
        this.snapshot.createdAt = P.nowIso();
        this.snapshot.inputSha = P.sha256(JSON.stringify({ previous: this.snapshot.inputSha, requirement: source.sha256, order: source.order }));
        const delivery = this.currentDelivery;
        if (delivery) {
          delivery.snapshotRequirements = JSON.parse(JSON.stringify(this.snapshot.requirements));
          delivery.previousSnapshotData = previousSnapshotData;
          delivery.latestSnapshotId = this.snapshot.snapshotId;
          delivery.snapshotExtensionPrompt = this.snapshot.extensionPrompt || null;
          delivery.snapshotRulesVersion = this.snapshot.rulesVersion;
          delivery.snapshotInputSha = this.snapshot.inputSha;
          const previousEntry = (delivery.snapshots || []).find(snapshot => snapshot.snapshotId === previousSnapshotId) || {};
          delivery.snapshots = [
            this.snapshotEntryMeta(this.snapshot, { mode: 'unreviewed', findingCount: 0, sessionId: previousEntry.sessionId }),
            {
              ...previousEntry,
              ...this.snapshotEntryMeta(previousSnapshotData, {
                mode: 'history', findingCount: this.activeFindingCount, sessionId: previousEntry.sessionId,
              }),
            },
            ...(delivery.snapshots || []).filter(snapshot =>
              snapshot.snapshotId !== previousSnapshotId && snapshot.snapshotId !== this.snapshot.snapshotId),
          ];
          delivery.latest = {
            status: 'pending', validFindingCount: 0, highestSeverity: null,
            requirementPending: 0, complete: false, runStatus: null, createdAt: this.snapshot.createdAt,
          };
        }
        for (const key of Object.keys(this.diffDict)) {
          const item = this.diffDict[key];
          if (!item.reviewable) continue;
          const all = new Map([...(item.findings || []), ...(item.pendingFindings || [])].map(finding => [finding.findingId, finding]));
          item.reviewStatus = 'pending';
          item.suggestion = '';
          item.findings = [];
          item.pendingFindings = [...all.values()];
          item.issue_overrides = {};
          item.carriedFrom = '';
          item.withheld = [];
        }
        this.run = null;
        this.understanding = null;
        this.marks = [];
        this.withheldFindings = [];
        this.coverage = { reviewed: [], skipped: this.coverage?.skipped || [], failed: [], withheld: [] };
        this.staleNotice = '需求依据已更新，审查全部后更新对齐判断';
        this.noticeKind = 'requirement';
        this.scenario = 'added-requirement';
        this.scenarioLabel = P.scenarioLabels['added-requirement'];
        this.mainView = 'overview';
        this.panelMode = null;
        this.requirementDialog.open = false;
        const selectedKey = this.selectedFileItem.md5_str;
        this.layoutKey++;
        this.$nextTick(() => {
          this.showCrResult(selectedKey || this.displayedFileList[0]?.md5_str);
          P.refreshFloating();
        });
        P.message('需求依据已更新，全部文件回到待审');
      },
      // ---------- refs and navigation ----------
      async jumpToRef(ref) {
        if (!ref?.path) return;
        const match = this.normalizedDiffItems.find(item => item.path === ref.path);
        if (!match) { P.message('目标文件不在当前审查记录中'); return; }
        this.revealFile(match);
        this.mainView = 'diff';
        this.showCrResult(match.md5_str, { locateFirst: false });
        if (!ref.startLine) return;
        await this.$nextTick(); await this.$nextTick();
        const located = this.$refs.codeReview?.locateIssue({ lineNumber: ref.startLine, side: ref.side || 'head', type: 'logic' });
        if (!located) P.message(`无法定位：当前审查记录中没有该侧的第 ${ref.startLine} 行`);
      },
      async jumpToFinding(finding) {
        const token = ++this.findingJumpToken;
        const anchor = finding?.anchor;
        const match = this.normalizedDiffItems.find(item => item.path === anchor?.path);
        if (!match) { P.message('无法定位：目标文件不在当前审查记录中'); return; }
        this.revealFile(match);
        this.mainView = 'diff';
        this.showCrResult(match.md5_str, { locateFirst: false });
        await this.$nextTick(); await this.$nextTick();
        if (token !== this.findingJumpToken) return;
        const card = this.prepareIssueCard(finding.findingId);
        const located = this.$refs.codeReview?.locateIssue({
          lineNumber: anchor?.line || 0, side: anchor?.side || 'head',
          type: finding.category === 'performance' ? 'performance' : 'logic', issueKey: finding.findingId,
        });
        if (token !== this.findingJumpToken) return;
        if (!located) {
          if (card) {
            card.scrollIntoView({ block: 'center', behavior: 'smooth' });
            this.pulseIssueCard(card);
            P.message(this.markdownOptions.linkLines ? '无法定位：当前审查记录中没有该问题对应的代码行' : '已展开问题卡片；当前模式未启用行号定位');
          } else {
            P.message('无法定位：当前审查记录中没有该问题对应的代码行');
          }
          return;
        }
        this.pulseIssueCard(card);
      },
      prepareIssueCard(issueKey) {
        const card = document.querySelector(`.gpt-risk-marker[data-issue-key="${CSS.escape(issueKey)}"]`);
        if (!card) return null;
        card.classList.remove('is-collapsed');
        card.querySelector('.gpt-risk-marker__header')?.setAttribute('aria-expanded', 'true');
        return card;
      },
      pulseIssueCard(card) {
        if (!card) return;
        clearTimeout(this.issuePulseTimer);
        document.querySelectorAll('.gpt-risk-marker.card-highlight-pulse').forEach(node => node.classList.remove('card-highlight-pulse'));
        void card.offsetWidth;
        card.classList.add('card-highlight-pulse');
        this.issuePulseTimer = setTimeout(() => card.classList.remove('card-highlight-pulse'), 1600);
      },
      issuePath(issue) {
        const item = this.normalizedDiffItems.find(entry => entry.md5_str === issue.fileKey);
        return item?.path || issue.finding?.anchor?.path || '';
      },
      issueLineLocatable(issue) {
        if (!(issue.lineNumber > 0)) return false;
        const numbers = P.diffLineNumbers ? P.diffLineNumbers(this.originDiffDict[issue.fileKey]) : null;
        return !numbers || numbers.includes(issue.lineNumber);
      },
      issueJumpHint(issue) {
        return this.issueLineLocatable(issue) ? `↗ 定位至第 ${issue.lineNumber} 行` : '↗ 查看问题卡片';
      },
      issueLineLocation(issue) {
        return this.issueLineLocatable(issue) ? `第 ${issue.lineNumber} 行` : '文件级';
      },
      issueDeltaLabel(issue) { return issue.carriedFrom ? '沿用上版' : '本次更新'; },
      issueLocation(issue) {
        const item = this.normalizedDiffItems.find(entry => entry.md5_str === issue.fileKey);
        const path = item?.path || issue.finding?.anchor?.path || '';
        const name = path.split('/').pop();
        return issue.lineNumber > 0 ? `${name}:${issue.lineNumber}` : name;
      },
      issueLocationTitle(issue) {
        const item = this.normalizedDiffItems.find(entry => entry.md5_str === issue.fileKey);
        const path = item?.path || issue.finding?.anchor?.path || '';
        return issue.lineNumber > 0 ? `${path}:${issue.lineNumber}` : `${path}（文件级）`;
      },
      requirementText(itemId) {
        return this.requirementItems.find(item => item.itemId === itemId)?.text || '';
      },
      requirementKindLabel(kind) { return { 'session-message': '会话消息', file: '文件', paste: '粘贴' }[kind] || kind; },
      alignmentStatusLabel(status) { return { implemented: '已对齐', partial: '部分对齐', 'not-found': '未找到', unclear: '待确认' }[status] || status; },
      basisTags(items) { return [...new Set((items || []).map(item => P.normalizeBasis(item?.basis)).filter(Boolean))]; },
      inlineMarkdown(text) { return P.inlineMarkdown(text); },
      changeLabel(change) { return { added: '新增', modified: '修改', deleted: '删除', renamed: '改名', 'mode-changed': '权限变更' }[change] || change; },
      basisLabel(basis) { return P.formatBasis(basis); },
      basisClass(basis) { return P.basisClass(basis); },
      formatClock(iso) { return P.formatClock(iso); },
      runIcon(display) {
        if (!display) return P.icons.history;
        if (display.tone === 'green') return P.icons.check;
        if (display.tone === 'amber' || display.tone === 'red') return P.icons.warn;
        return P.icons.history;
      },
      // ---------- export / preflight ----------
      exportLog() {
        if (this.exportReportDisabled) return;
        P.hideTip();
        this.openMenu = null;
        P.exports.downloadMarkdown(this.exportContext());
        P.message('已下载变更日志（Markdown）');
      },
      exportReport() {
        if (this.exportReportDisabled) return;
        P.hideTip();
        this.openMenu = null;
        const html = P.exports.downloadHtml(this.exportContext(), { embedDiff: this.exportEmbedDiff });
        P.exports.previewHtml(html);
        P.message('已下载评审报告（HTML）并打开预览');
      },
      preflightAction() {
        if (!this.preflight) return;
        if (this.preflight.action === 'settings') { this.openMenu = 'settings'; return; }
        if (this.preflight.action === 'retry') { P.message('演示：重新检测（未执行）'); return; }
        this.showConversation();
      },
      prototypeAction() { P.message('演示：未执行'); },
      copyPreflightDetail() { P.copyText(this.preflight?.detail || '', '已复制诊断信息'); },
    },
    template: `
      <div class="dsh-app">
        <dsh-sidebar :view="view" :project-name="projectName" :workspaces="workspaceItems" :current-workspace-id="currentWorkspaceId" :sessions="sessions" :conversation-title="conversationTitle || '接入 EvidentLoop 变更评审'" :conversation-time="conversationTime" @open-list="openList" @open-conversation="showConversation"></dsh-sidebar>
        <main class="dsh-main">
          <dsh-conversation v-if="view==='conversation'" :card="deliveryCard" :project-name="projectName" :title="conversationTitle || '接入 EvidentLoop 变更评审'" :draft="dshDraft" @update:draft="dshDraft=$event" @open-review="openReview('conversation')" @send="handleSend"></dsh-conversation>
          <section v-else-if="view==='list'" class="dsh-list-view" @keydown="listKeydown">
            <header class="list-header">
              <div class="list-heading">
                <h1>变更评审</h1>
                <p class="list-subtitle">
                  <span class="menu-anchor list-workspace-anchor">
                    <button class="list-workspace-switch" type="button" aria-haspopup="listbox" aria-label="切换工作区" :aria-expanded="openMenu==='workspaces'" @click.stop="toggleMenu('workspaces')" @mouseenter="updateListTruncation($event,activeWorkspaceName)" @focus="updateListTruncation($event,activeWorkspaceName)"><span class="list-workspace-name" data-truncate>{{activeWorkspaceName}}</span><span class="list-workspace-caret menu-caret" :class="{'is-open':openMenu==='workspaces'}" aria-hidden="true" v-html="icons.chevron"></span></button>
                    <div v-if="openMenu==='workspaces'" class="wb-menu workspace-menu" role="listbox" aria-label="切换工作区" @click.stop>
                      <div class="workspace-search">
                        <span class="file-search-icon" v-html="icons.search"></span>
                        <input class="n-input__inner" type="text" aria-label="搜索工作区" placeholder="搜索工作区" v-model="workspaceSearch">
                      </div>
                      <button v-for="workspaceOption in workspaceOptions" :key="workspaceOption.workspaceId" class="workspace-item" :class="{'is-current': workspaceOption.workspaceId===currentWorkspaceId}" type="button" role="option" :aria-selected="workspaceOption.workspaceId===currentWorkspaceId" @click="selectWorkspace(workspaceOption)">
                        <span class="workspace-item-icon" v-html="icons.folder"></span>
                        <span class="workspace-item-body">
                          <span class="workspace-item-name">{{workspaceOption.name}}</span>
                          <span v-if="workspaceOption.repoKey" class="workspace-item-meta">所属仓库：{{workspaceOption.repoName}}</span>
                          <span v-else class="workspace-item-meta">不是 Git 仓库</span>
                        </span>
                        <span v-if="workspaceOption.workspaceId===currentWorkspaceId" class="workspace-item-check" aria-hidden="true">{{'✓'}}</span>
                      </button>
                      <div v-if="!workspaceOptions.length" class="workspace-empty">没有匹配的工作区</div>
                    </div>
                  </span>
                </p>
              </div>
              <div class="list-tools">
                <div class="n-input n-input--small list-search">
                  <span class="file-search-icon" v-html="icons.search"></span>
                  <input class="n-input__inner" type="text" aria-label="搜索交付" placeholder="搜索交付、需求编号或分支" v-model="deliverySearch">
                </div>
                <span class="focus-toolbar-item menu-anchor">
                  <button class="focus-icon-button cr-icon-button cr-toolbar-icon" aria-label="工作区设置" v-tip="'工作区设置'" @click.stop="toggleMenu('settings')" v-html="icons.settings"></button>
                  <div v-if="openMenu==='settings'" class="wb-menu settings-menu list-settings-menu" role="dialog" aria-label="工作区设置" @click.stop>
                    <workspace-settings :auto-mode="autoMode" :target-branch="targetBranchOverride" :export-embed-diff="exportEmbedDiff" :extension-prompt="extensionPrompt" :shared-repo="settingsSharedRepo" :repo-available="activeWorkspaceIsGit" @update:auto-mode="setAutoMode($event)" @update:target-branch="setTargetBranch($event)" @update:export-embed-diff="setExportEmbedDiff($event)" @edit-extension="openExtensionDialog('edit')"></workspace-settings>
                  </div>
                </span>
              </div>
            </header>
            <div class="list-rail" aria-label="交付列表操作">
              <div class="list-scope" role="group" aria-label="交付范围">
                <button type="button" class="delivery-scope-all" :aria-pressed="String(!archiveExpanded)" @click="setListScope(false)">全部 <span v-if="workspaceActiveCount">{{workspaceActiveCount}}</span></button>
                <button v-if="archiveExpanded || workspaceArchivedCount" type="button" class="delivery-archive-toggle" :aria-pressed="String(archiveExpanded)" :aria-expanded="String(archiveExpanded)" @click="setListScope(true)">归档 <span v-if="workspaceArchivedCount">{{workspaceArchivedCount}}</span></button>
              </div>
              <div class="list-filters"><label v-if="listProblemOnly || hasWorkspaceProblems" class="list-problem-filter"><input type="checkbox" v-model="listProblemOnly">只看有问题</label>
                <span class="menu-anchor list-sort-anchor"><button type="button" class="list-sort-trigger" aria-haspopup="menu" :aria-label="'排序：'+listSortLabel" :aria-expanded="String(openMenu==='list-sort')" @click.stop="toggleMenu('list-sort')">{{listSortLabel}}<span class="menu-caret" :class="{'is-open':openMenu==='list-sort'}" aria-hidden="true" v-html="icons.chevron"></span></button>
                  <div v-if="openMenu==='list-sort'" class="wb-menu list-sort-menu" role="menu" aria-label="交付排序" @click.stop><button v-for="option in [{value:'updated',label:'最近更新'},{value:'problems',label:'问题最多'}]" :key="option.value" class="wb-menu-item" role="menuitemradio" type="button" :aria-checked="String(listSort===option.value)" @click="setListSort(option.value)">{{option.label}}</button></div>
                </span>
              </div>
              <div class="list-view-switch" role="group" aria-label="交付视图"><button type="button" aria-label="网格视图" v-tip="'网格视图'" :aria-pressed="String(listLayout==='grid')" @click="listLayout='grid'" v-html="icons.gridView"></button><button type="button" aria-label="紧凑视图" v-tip="'紧凑视图'" :aria-pressed="String(listLayout==='compact')" @click="listLayout='compact'" v-html="icons.compactView"></button></div>
            </div>
            <div v-if="listPreflight" class="list-preflight-wrap">
              <div class="wb-preflight">
                <span class="wb-preflight-icon" v-html="icons.warn"></span>
                <h2>{{listPreflight.title}}</h2>
                <p>{{listPreflight.description}}</p>
                <button class="wb-preflight-detail" type="button" title="复制诊断信息" @click="copyListPreflightDetail"><code>{{listPreflight.detail}}</code></button>
                <div class="wb-preflight-actions">
                  <button class="n-button" type="button" @click.stop="listPreflightRetry">重新检测</button>
                </div>
              </div>
            </div>
            <div v-else class="delivery-list">
              <div v-if="listEmptyMode" class="delivery-empty">
                <template v-if="listEmptyMode==='workspace'">当前工作区还没有交付。<a class="delivery-empty-link" href="https://evidentloop.sanze.dev/guide.html" target="_blank" rel="noopener noreferrer">了解怎么用 ↗</a></template><template v-else-if="listEmptyMode==='search'">没有匹配的交付</template><template v-else-if="listEmptyMode==='filter'">当前范围没有有问题的交付</template><template v-else>当前范围没有交付</template>
                <button v-if="deliverySearch.trim() || listProblemOnly" class="wb-link list-clear" type="button" @click="clearListConstraints">清空搜索与筛选</button>
              </div>
              <div v-if="visibleDeliveryRows.length" :class="{'delivery-archive':archiveExpanded}">
                <div v-if="listLayout==='grid'" class="delivery-grid" :class="{'delivery-grid--archive':archiveExpanded}">
                  <article v-for="delivery in visibleDeliveryRows" :key="delivery.deliveryId" class="delivery-row" :data-delivery-id="delivery.deliveryId" @click="openDelivery(delivery,null,'list',{mainView:'diff'})">
                    <header class="delivery-card__head"><div class="delivery-title-line"><span v-if="listMeta(delivery).pinned" class="delivery-pin" title="已置顶" aria-label="已置顶" v-html="icons.pinUp"></span><button class="delivery-title" type="button" :aria-label="'打开文件对比：'+delivery.title" @mouseenter="updateListTruncation($event,delivery.title)" @focus="updateListTruncation($event,delivery.title)" @click.stop="openDelivery(delivery,null,'list',{mainView:'diff'})"><span data-truncate>{{delivery.title}}</span></button><span v-if="delivery.closedAt" class="delivery-closed">已合并</span></div></header>
                    <div class="delivery-main"><div class="delivery-meta"><span class="delivery-branch" @mouseenter="updateListTruncation($event,delivery.branch || '分支信息不可用')">{{delivery.branch || '分支信息不可用'}}</span><span class="delivery-meta-sep" aria-hidden="true">·</span><span>{{deliveryTime(delivery)}}</span></div><div class="delivery-status-row" :title="deliveryReasonDetail(delivery) || undefined" :aria-label="deliveryReasonDetail(delivery) || undefined"><span v-for="pill in deliveryStatusPills(delivery)" :key="pill.text" class="delivery-status" :class="'delivery-status--'+pill.tone"><span class="delivery-status-dot" aria-hidden="true"></span>{{pill.text}}</span></div><p v-if="deliveryPurpose(delivery)" class="delivery-purpose">{{deliveryPurpose(delivery)}}</p></div>
                    <footer class="delivery-footer"><delivery-session :entry="recentSessionView(delivery)" @open="openSession(delivery)"></delivery-session><div class="delivery-actions"><button class="delivery-changes delivery-inner-link" type="button" @click.stop="openDelivery(delivery,null,'list',{mainView:'overview'})">变更说明<span class="delivery-link-arrow" aria-hidden="true">→</span></button></div></footer>
                    <delivery-menu :delivery="delivery" :meta="listMeta(delivery)" :running="isDeliveryRunning(delivery)" :open="openMenu==='delivery:'+delivery.deliveryId" @toggle="toggleDeliveryMenu" @pin="togglePin" @archive="archiveDelivery" @unarchive="unarchiveDelivery" @delete="askDeleteDelivery"></delivery-menu>
                  </article>
                </div>
                <template v-else>
                  <p v-if="listTableOverflow" class="delivery-scroll-hint" role="status">列表可左右滚动，查看其余信息</p>
                  <div ref="deliveryScroll" class="delivery-table-scroll" @scroll.passive="openMenu && closeMenu(false)">
                    <table class="delivery-table"><caption class="visually-hidden">{{archiveExpanded ? '归档交付' : '交付'}}列表</caption>
                      <thead><tr><th scope="col">名称</th><th scope="col" class="column-branch">分支</th><th scope="col">审查结果</th><th scope="col">最近会话</th><th scope="col" class="column-updated">更新</th><th scope="col">说明</th><th scope="col"><span class="visually-hidden">操作</span></th></tr></thead>
                      <tbody><tr v-for="delivery in visibleDeliveryRows" :key="delivery.deliveryId" class="delivery-row" :data-delivery-id="delivery.deliveryId" @click="openDelivery(delivery,null,'list',{mainView:'diff'})">
                        <td class="delivery-name-cell"><div class="delivery-title-line"><span v-if="listMeta(delivery).pinned" class="delivery-pin" title="已置顶" aria-label="已置顶" v-html="icons.pinUp"></span><button class="delivery-title" type="button" :aria-label="'打开文件对比：'+delivery.title" @mouseenter="updateListTruncation($event,delivery.title)" @focus="updateListTruncation($event,delivery.title)" @click.stop="openDelivery(delivery,null,'list',{mainView:'diff'})"><span data-truncate>{{delivery.title}}</span></button><span v-if="delivery.closedAt" class="delivery-closed">已合并</span></div><div class="delivery-branch-subline"><span class="delivery-branch" @mouseenter="updateListTruncation($event,delivery.branch || '分支信息不可用')">{{delivery.branch || '分支信息不可用'}}</span></div></td>
                        <td class="column-branch"><span class="delivery-branch" @mouseenter="updateListTruncation($event,delivery.branch || '分支信息不可用')">{{delivery.branch || '分支信息不可用'}}</span></td>
                        <td class="delivery-result-cell"><div class="delivery-status-row" :title="deliveryReasonDetail(delivery) || undefined" :aria-label="deliveryReasonDetail(delivery) || undefined"><span v-for="pill in deliveryStatusPills(delivery)" :key="pill.text" class="delivery-status" :class="'delivery-status--'+pill.tone"><span class="delivery-status-dot" aria-hidden="true"></span>{{pill.text}}</span></div></td>
                        <td class="delivery-session-cell"><delivery-session :entry="recentSessionView(delivery)" @open="openSession(delivery)"></delivery-session></td>
                        <td class="column-updated">{{deliveryTime(delivery)}}</td>
                        <td class="delivery-explanation-cell"><button class="delivery-changes delivery-inner-link" type="button" @click.stop="openDelivery(delivery,null,'list',{mainView:'overview'})">变更说明<span class="delivery-link-arrow" aria-hidden="true">→</span></button></td>
                        <td class="delivery-menu-cell"><delivery-menu :delivery="delivery" :meta="listMeta(delivery)" :running="isDeliveryRunning(delivery)" :open="openMenu==='delivery:'+delivery.deliveryId" @toggle="toggleDeliveryMenu" @pin="togglePin" @archive="archiveDelivery" @unarchive="unarchiveDelivery" @delete="askDeleteDelivery"></delivery-menu></td>
                      </tr></tbody>
                    </table>
                  </div>
                </template>
              </div>
            </div>
          </section>
          <section v-else class="dsh-workbench" :class="{'is-history':isHistory}">
            <header class="wb-header">
              <button class="wb-back" type="button" @click="reviewBack"><span v-html="icons.back"></span>返回</button>
              <div class="wb-title-wrap">
                <div class="wb-title-line"><h1>{{currentDelivery?.title || '变更评审'}}</h1></div>
                <div class="wb-meta-row">
                  <span class="wb-meta" :title="headerRangeTip"><span class="wb-meta-branch" :title="headerBranch">{{headerBranch}}</span><span class="wb-meta-sep" aria-hidden="true">·</span><span class="wb-meta-range">{{headerRangeText}}</span></span>
                  <span v-if="snapshot" class="wb-meta-sep" aria-hidden="true">·</span>
                  <span v-if="snapshot" class="menu-anchor wb-record-anchor">
                    <button class="wb-record-trigger" type="button" :aria-label="'切换审查记录（共 '+recordEntries.length+' 次）'" v-tip="'切换审查记录（共 '+recordEntries.length+' 次）'" :aria-expanded="openMenu==='records'" @click.stop="toggleMenu('records')">
                      {{recordCapsuleText}} <span class="wb-record-caret" aria-hidden="true">▾</span>
                    </button>
                    <div v-if="openMenu==='records'" class="wb-menu record-menu" role="menu" @click.stop>
                      <div class="wb-menu-title">审查记录</div>
                      <div v-for="entry in recordEntries" :key="entry.snapshotId" class="wb-menu-item record-item" :class="{'is-current': recordIsCurrent(entry)}" role="menuitem" tabindex="0" :title="recordHoverTip(entry)" @click="selectRecord(entry)" @keydown.enter.prevent="selectRecord(entry)">
                        <span class="record-item__top">
                          <span class="record-item__check" aria-hidden="true">{{recordIsCurrent(entry) ? '✓' : ''}}</span>
                          <b class="record-item__time">{{formatClock(entry.createdAt)}}</b>
                          <span v-if="recordIsLatest(entry)" class="record-item__latest">最新</span>
                          <span class="record-item__conclusion">{{recordConclusion(entry)}}</span>
                        </span>
                        <span class="record-item__source">
                          <span class="record-item__code">{{recordCodeSource(entry)}}</span>
                          <template v-if="recordSessionView(entry)">
                            <span class="record-item__sep" aria-hidden="true"> · </span>
                            <button v-if="recordSessionView(entry).state==='present'" class="record-item__session-link" type="button" :title="recordSessionView(entry).title" @click.stop="openRecordSession(entry, $event)">{{recordSessionView(entry).title}}</button>
                            <template v-else><span class="record-item__session" :title="recordSessionView(entry).tip">{{recordSessionView(entry).title}}</span><span class="record-item__session-suffix">{{recordSessionView(entry).suffix}}</span></template>
                          </template>
                        </span>
                      </div>
                    </div>
                  </span>
                </div>
              </div>
            </header>
            <div v-if="isViewingEarlier" class="wb-history-banner">
              <span>正在查看较早的审查记录（只读）</span>
              <span class="wb-history-sep" aria-hidden="true">·</span>
              <button class="wb-link" type="button" @click="openLatest">打开最新审查 →</button>
            </div>
            <div v-if="extensionPromptChanged" class="wb-extension-banner"><span v-html="icons.auto"></span><span>扩展提示词已更改，重新审查全部后按新要求生成结论</span><button v-if="!readonly" class="n-button" type="button" :disabled="isRunning" @click="handleReviewAll">审查全部</button></div>
            <div v-if="preflight" class="wb-preflight-wrap">
              <div class="wb-preflight">
                <span class="wb-preflight-icon" v-html="icons.warn"></span>
                <h2>{{preflight.title}}</h2>
                <p>{{preflight.description}}</p>
                <button class="wb-preflight-detail" type="button" title="复制诊断信息" @click="copyPreflightDetail"><code>{{preflight.detail}}</code><span v-html="icons.copy"></span></button>
                <div class="wb-preflight-actions">
                  <button v-if="preflight.action==='retry'" class="n-button" type="button" @click.stop="preflightAction">重新检测</button>
                  <button v-if="preflight.action==='settings'" class="n-button" type="button" @click.stop="preflightAction">打开设置</button>
                  <button class="n-button" type="button" @click="showConversation">返回对话</button>
                </div>
                <div v-if="openMenu==='settings'" class="wb-menu wb-preflight-menu" role="dialog" aria-label="工作区设置" @click.stop>
                  <workspace-settings :auto-mode="autoMode" :target-branch="targetBranchOverride" :export-embed-diff="exportEmbedDiff" :extension-prompt="extensionPrompt" :shared-repo="settingsSharedRepo" :repo-available="activeWorkspaceIsGit" @update:auto-mode="setAutoMode($event)" @update:target-branch="setTargetBranch($event)" @update:export-embed-diff="setExportEmbedDiff($event)" @edit-extension="openExtensionDialog('edit')"></workspace-settings>
                </div>
                <p class="wb-preflight-note">演示状态：不会读写仓库，也不会调用模型。</p>
              </div>
            </div>
            <div v-else class="wb-body">
              <button v-if="runDisplay?.reason && mainView!=='overview'" type="button" class="wb-reason-link wb-reason-link--semantic" @click="showOverviewProblems">{{runDisplay.label}}</button>
              <div class="review-surface evidentloop-review-surface focus-review">
                <div class="review-status-container wb-toolbar">
                  <div class="review-button-container">
                    <button v-if="optimizationFlags.O3a && snapshot" type="button" class="focus-icon-button focus-toggle-file-pane" :aria-label="filePaneCollapsed ? '展开文件栏' : '收起文件栏'" :aria-expanded="!filePaneCollapsed" :aria-pressed="!filePaneCollapsed" aria-controls="focus-file-pane" :aria-disabled="String(!filePaneCanCollapse)" v-tip="filePaneCollapsed ? '展开文件栏' : '收起文件栏'" @click="filePaneCanCollapse && (isFilePaneCollapsed = !filePaneCollapsed)" v-html="icons.fileTree"></button>
                    <div v-if="snapshot" class="view-switch" role="tablist" aria-label="主区域视图">
                      <button type="button" role="tab" :aria-selected="mainView==='overview'" :class="{'is-active':mainView==='overview'}" @click="setMainView('overview')">变更说明</button>
                      <button type="button" role="tab" :aria-selected="mainView==='diff'" :class="{'is-active':mainView==='diff'}" @click="setMainView('diff')">文件对比</button>
                    </div>
                    <template v-if="runDisplay">
                      <template v-if="!runDisplay.reason">
                        <div v-if="runDisplay.label" class="run-state" :class="'run-state--'+runDisplay.tone" role="status">
                          <span v-if="runDisplay.busy" class="loading-spinner"></span>
                          <span v-else class="run-state__icon" v-html="runIcon(runDisplay)"></span>
                          <span class="run-state__label">{{runDisplay.label}}</span>
                          <button v-if="runDisplay.busy && runDisplay.primary" class="run-state__action" type="button" @click="handleRunAction(runDisplay.primary.action)">{{runDisplay.primary.label}}</button>
                        </div>
                        <button v-if="!runDisplay.busy && runDisplay.primary" class="n-button run-primary" type="button" :title="runDisplay.title" @click="handleRunAction(runDisplay.primary.action)">{{runDisplay.primary.label}}</button>
                      </template>
                    </template>
                    <div v-if="snapshot" class="n-radio-group file-filter-group" :class="{'is-invisible': mainView!=='diff'}" :aria-hidden="mainView!=='diff'" role="radiogroup" aria-label="文件过滤">
                      <label v-for="mode in filterModes" :key="mode" class="n-radio-button n-radio-button--medium" :class="{'n-radio-button--checked':fileFilterMode === mode}">
                        <input class="n-radio-button__original" type="radio" name="file-filter" :value="mode" v-model="fileFilterMode">
                        <span class="n-radio-button__label">
                          <span class="file-filter-label" :class="'file-filter-label--'+mode">{{filterLabel(mode)}}</span>
                          <span class="file-filter-count" :class="'file-filter-count--'+(mode === 'all' ? 'total':mode)">{{riskAdjustedCount[mode === 'all' ? 'total':mode]}}</span>
                        </span>
                      </label>
                    </div>
                  </div>
                  <div class="toolbar-spacer"></div>
                  <div class="wb-toolbar-right">
                    <button v-if="snapshot" type="button" class="focus-icon-button cr-icon-button cr-toolbar-icon wb-split-toggle" :class="{'is-invisible': mainView!=='diff'}" :aria-hidden="mainView!=='diff'" :tabindex="mainView==='diff' ? 0 : -1" :aria-label="formattedDiffStyle ? '切换为双栏' : '切换为单栏'" v-tip="formattedDiffStyle ? '切换为双栏' : '切换为单栏'" @click="formattedDiffStyle = !formattedDiffStyle" v-html="formattedDiffStyle ? icons.splitDouble : icons.splitSingle"></button>
                    <span class="focus-toolbar-item menu-anchor">
                      <button type="button" class="focus-icon-button cr-icon-button cr-toolbar-icon focus-export-icon-btn" aria-label="导出与发回" v-tip="'导出与发回'" aria-haspopup="menu" :aria-expanded="openMenu==='export'" :disabled="exportReportDisabled" @click.stop="toggleMenu('export')" v-html="icons.download"></button>
                      <div v-if="openMenu==='export'" class="wb-menu export-menu" role="menu" @click.stop>
                        <div class="wb-menu-title">导出</div>
                        <button class="wb-menu-item" type="button" role="menuitem" @click="exportLog"><span><b>变更日志（Markdown）</b><small>{{understandingValid ? '需求依据、变更概览、文件清单与问题位置' : '仅文件事实与当前状态（变更说明尚未生成）'}}</small></span></button>
                        <button class="wb-menu-item" type="button" role="menuitem" @click="exportReport"><span><b>评审报告（HTML）</b><small>{{understandingValid ? '自包含单文件，离线可打开' : '自包含单文件，仅文件事实与当前状态'}}</small></span></button>
                        <div class="wb-menu-title wb-menu-subtitle">发回会话</div>
                        <button class="wb-menu-item" type="button" role="menuitem" :disabled="sendBackDisabled" :title="sendBackDisabled ? '本次交付无关联会话' : undefined" @click="sendBackToSession('fix')"><span><b>修改问题</b><small>整理待处理问题与待确认条目，写入开发会话草稿，不自动发送</small></span></button>
                        <button class="wb-menu-item" type="button" role="menuitem" :disabled="supplementDisabled" :title="supplementDisabled ? supplementDisabledReason : undefined" @click="sendBackToSession('supplement')"><span><b>补充说明</b><small>{{supplementDisabled ? supplementDisabledReason : '把已通过校验的变更说明整理成请求，Skill 名称留给草稿填写'}}</small></span></button>
                        <label class="wb-menu-check"><input type="checkbox" v-model="exportEmbedDiff"> 嵌入完整 Diff</label>
                        <div class="wb-menu-sep"></div>
                        <button class="wb-menu-item wb-menu-item--danger" type="button" role="menuitem" :disabled="Boolean(reReviewDisabledReason)" :title="reReviewDisabledReason || undefined" @click="reReviewAll"><span><b>全部重新审查</b><small>{{reReviewDisabledReason || '忽略沿用结果，重新调用模型'}}</small></span></button>
                      </div>
                    </span>
                    <span class="focus-toolbar-item menu-anchor">
                      <button type="button" class="focus-icon-button cr-icon-button cr-toolbar-icon" aria-label="工作区设置" v-tip="'工作区设置'" @click.stop="toggleMenu('settings')" v-html="icons.settings"></button>
                      <div v-if="openMenu==='settings'" class="wb-menu settings-menu" role="dialog" aria-label="工作区设置" @click.stop>
                        <workspace-settings :auto-mode="autoMode" :target-branch="targetBranchOverride" :export-embed-diff="exportEmbedDiff" :extension-prompt="extensionPrompt" :shared-repo="settingsSharedRepo" :repo-available="activeWorkspaceIsGit" @update:auto-mode="setAutoMode($event)" @update:target-branch="setTargetBranch($event)" @update:export-embed-diff="setExportEmbedDiff($event)" @edit-extension="openExtensionDialog('edit')"></workspace-settings>
                      </div>
                    </span>
                  </div>
                </div>
                <splitpanes :key="layoutKey" class="file-diff-wrapper default-theme" :class="{'focus-file-pane-collapsed':filePaneCollapsed}" @resized="onFilePaneResized">
                  <pane id="focus-file-pane" v-show="!filePaneCollapsed" :size="filePaneCollapsed ? 0 : filePaneSize" :min-size="filePaneCollapsed ? 0 : 20" :max-size="filePaneCollapsed ? 0 : 32">
                    <div class="focus-file-browser">
                      <div class="file-list-toolbar">
                        <div class="n-input n-input--small file-search-input">
                          <span class="file-search-icon" v-html="icons.search"></span>
                          <input class="n-input__inner" type="text" aria-label="搜索文件或路径" placeholder="搜索文件或路径" v-model="fileSearchKeyword">
                          <button v-if="fileSearchKeyword" type="button" aria-label="清空搜索" class="input-clear focus-icon-button" @click="fileSearchKeyword = ''">×</button>
                        </div>
                      </div>
                      <div class="file-list-container focus-tree-navigation">
                        <button v-for="entry in fileMenuRows" :key="entry.key" type="button" class="focus-tree-row" :class="{'is-folder':entry.isFolder,'is-selected':entry.item && selectedFileItem.md5_str === entry.item.md5_str,'is-weak-selected':mainView==='overview' && entry.item && selectedFileItem.md5_str === entry.item.md5_str}" :style="{'--tree-depth':entry.depth}" :data-path="entry.path || entry.item.path" :data-depth="entry.depth" :aria-label="!entry.isFolder && isFileRiskResolved(entry.item.md5_str) ? entry.label+'，问题已全部标记为非问题' : undefined" :aria-expanded="entry.isFolder ? !entry.collapsed : undefined" v-tip="treeRowTip(entry)" @click="clickTreeRow(entry)">
                          <span class="focus-tree-label"><span class="focus-tree-kind-icon" :data-icon="entry.iconKey" aria-hidden="true" v-html="entry.iconSvg"></span><span class="focus-tree-name">{{entry.label}}</span></span>
                          <span class="focus-tree-status">
                            <template v-if="!entry.isFolder">
                              <span v-if="entry.item.withheld && entry.item.withheld.length" class="focus-tree-withheld" title="结论证据未通过校验"><span v-html="icons.warn"></span></span>
                              <span v-else-if="entry.item.reviewStatus==='skipped' || entry.item.reviewStatus==='metadata'" class="focus-tree-skip" :title="entry.item.skipReason"><span v-html="icons.skip"></span></span>
                              <span v-else-if="entry.hasRisk" class="focus-tree-badge">{{issueCountByFile[entry.item.md5_str].total}}</span>
                              <span v-else-if="entry.item.reviewStatus==='pending'" class="focus-tree-pending" aria-hidden="true"></span>
                              <svg v-else-if="isReviewConsideredComplete(entry.item)" class="focus-tree-complete" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.5"/><path d="m4.5 8 2.3 2.3 4.7-4.6"/></svg>
                            </template>
                            <span v-else-if="entry.collapsed && entry.hasRisk" class="focus-tree-risk-dot"></span>
                          </span>
                        </button>
                        <div v-if="!displayedFileList.length" class="empty-files">暂无匹配文件</div>
                      </div>
                    </div>
                  </pane>
                  <pane :size="filePaneCollapsed ? 100 : 100 - filePaneSize">
                    <div v-if="mainView==='overview'" class="overview-main">
                      <div class="overview-inner">
                        <div v-if="staleNotice" class="panel-notice" :class="'panel-notice--'+noticeKind">{{staleNotice}}</div>
                        <section id="overview-conclusion" class="overview-section overview-hero">
                          <div class="overview-head">
                            <h2>结论</h2>
                            <template v-if="showUnderstanding"><span v-for="basis in basisTags([understanding && understanding.overview])" :key="basis" class="basis-tag" :class="basisClass(basis)">{{basisLabel(basis)}}</span></template>
                          </div>
                          <p class="overview-purpose">{{showUnderstanding && understanding && understanding.overview && understanding.overview.purpose || (showUnderstanding ? '尚未生成交付目标。' : incompleteOverviewNotice)}}</p>
                          <div class="overview-stats" aria-label="变更统计">
                            <button v-if="activeFindingsList.length || !reviewCompleteNow" class="overview-stat" :class="{'has-problems':activeFindingsList.length}" type="button" @click="scrollToOverviewSection('overview-problems')"><strong>{{activeFindingsList.length || reviewCompleteNow ? activeFindingsList.length : '待审'}}</strong>问题</button>
                            <button v-if="showUnderstanding && allFeatures.length" class="overview-stat" type="button" @click="scrollToOverviewSection('overview-features')"><strong>{{showUnderstanding ? allFeatures.length : 0}}</strong>功能</button>
                            <button v-if="showUnderstanding && implementedAlignmentGroup && implementedAlignmentGroup.items.length" class="overview-stat" type="button" @click="scrollToOverviewSection('overview-alignment')"><strong>{{showUnderstanding && implementedAlignmentGroup ? implementedAlignmentGroup.items.length : 0}}</strong>已对齐</button>
                            <button v-if="coverage && coverage.reviewed && coverage.reviewed.length" class="overview-stat" type="button" @click="scrollToOverviewSection('overview-coverage')"><strong>{{coverage && coverage.reviewed ? coverage.reviewed.length : 0}}</strong>覆盖文件</button>
                          </div>
                          <div v-if="reviewBanner" class="panel-status" :class="'panel-status--'+reviewBanner.tone">
                            <span class="panel-status__icon" v-html="reviewBanner.tone==='green' ? icons.check : reviewBanner.tone==='amber' || reviewBanner.tone==='red' ? icons.warn : icons.history"></span>
                            <div><b>{{reviewBanner.label}}</b><p v-if="reviewBanner.detail">{{reviewBanner.detail}}</p><p v-for="(line,index) in reviewBanner.lines" :key="index">{{line}}</p></div>
                          </div>
                          <div v-if="runDisplay?.reason" class="overview-audit-notice">
                            <span>本次审查有结论未通过校验，已收进问题与覆盖范围。</span>
                            <button type="button" class="wb-reason-link" @click="showOverviewProblems">{{runDisplay.label}}</button>
                          </div>
                          <div v-if="overviewChanges.length" class="overview-changes-block">
                            <h3 class="overview-subhead">本次改动</h3>
                            <ul class="overview-list overview-changes">
                              <li v-for="change in overviewChanges" :key="change.featureId">
                                <button class="overview-change" type="button" @click="scrollToFeature(change.featureId)">
                                  <span class="overview-change__title">{{change.title}}</span><span class="overview-change__desc">：{{change.action}}</span><span class="overview-change__count">（{{change.fileCount}} 个文件）</span>
                                </button>
                              </li>
                            </ul>
                          </div>
                        </section>
                        <section id="overview-features" class="overview-section">
                          <div class="overview-head">
                            <h2>按功能的变更</h2>
                            <template v-if="showUnderstanding"><span v-for="basis in basisTags(allFeatures)" :key="basis" class="basis-tag" :class="basisClass(basis)">{{basisLabel(basis)}}</span></template>
                          </div>
                          <ul v-if="overviewChanges.length" class="overview-list feature-list">
                            <li v-for="feature in allFeatures" :id="'feature-'+feature.featureId" :key="feature.featureId" class="overview-feature feature-card">
                              <h3>{{feature.title}}</h3>
                              <p>{{feature.purpose}}</p>
                              <p class="overview-muted">{{feature.approach}}</p>
                              <ul v-if="featureImpacts(feature).length" class="overview-list impact-list">
                                <li v-for="(impact,index) in featureImpacts(feature)" :key="index">
                                  <span>{{impact.text}}</span>
                                  <span v-if="impact.refs && impact.refs.length" class="overview-refs"><button v-for="(ref,refIndex) in impact.refs" :key="refIndex" class="ref-link" type="button" :title="refTitle(ref)" @click="jumpToRef(ref)">{{refLabel(ref)}}</button></span>
                                </li>
                              </ul>
                              <details class="overview-details">
                                <summary>文件 {{new Set(feature.files || []).size}} 个</summary>
                                <ul class="overview-list">
                                  <li v-for="path in [...new Set(feature.files || [])]" :key="path"><button class="ref-link" type="button" :title="path" @click="selectByPath(path)">{{fileLabel(path)}}</button></li>
                                </ul>
                              </details>
                            </li>
                          </ul>
                          <p v-else class="overview-muted">{{showUnderstanding ? '本次没有可展开的功能条目。' : incompleteOverviewNotice}}</p>
                        </section>
                        <section id="overview-alignment" class="overview-section">
                          <div class="overview-head">
                            <h2>需求对齐</h2>
                            <template v-if="showUnderstanding"><span v-for="basis in basisTags([...(understanding && understanding.alignment || []), ...alignmentExtras])" :key="basis" class="basis-tag" :class="basisClass(basis)">{{basisLabel(basis)}}</span></template>
                          </div>
                          <p v-if="requirementsList.length && !showUnderstanding" class="overview-muted">{{alignmentPlaceholder}}</p>
                          <template v-else-if="requirementsList.length">
                            <div v-if="pendingAlignmentGroup" class="align-group">
                              <h3>{{pendingAlignmentGroup.label}} <span class="overview-count">{{pendingAlignmentGroup.items.length}}</span></h3>
                              <ul class="overview-list">
                                <li v-for="item in pendingAlignmentGroup.items" :key="item.requirementItemId" class="align-row">
                                  <div class="align-row__head"><span class="gap-kind">{{alignmentStatusLabel(item.status)}}</span></div>
                                  <p class="align-req">需求：{{requirementText(item.requirementItemId)}}</p>
                                  <p v-if="item.note" class="overview-muted">{{item.note}}</p>
                                  <div v-if="item.codeRefs && item.codeRefs.length" class="overview-refs"><button v-for="(ref,refIndex) in item.codeRefs" :key="refIndex" class="ref-link" type="button" :title="refTitle(ref)" @click="jumpToRef(ref)">{{refLabel(ref)}}</button></div>
                                </li>
                              </ul>
                            </div>
                            <p v-else class="overview-muted">没有未对齐或待确认条目。</p>
                            <details v-if="implementedAlignmentGroup" class="overview-details">
                              <summary>已对齐 {{implementedAlignmentGroup.items.length}} 项</summary>
                              <ul class="overview-list">
                                <li v-for="item in implementedAlignmentGroup.items" :key="item.requirementItemId" class="align-row">
                                  <p class="align-req">需求：{{requirementText(item.requirementItemId)}}</p>
                                  <p v-if="item.note" class="overview-muted">{{item.note}}</p>
                                  <div v-if="item.codeRefs && item.codeRefs.length" class="overview-refs"><button v-for="(ref,refIndex) in item.codeRefs" :key="refIndex" class="ref-link" type="button" :title="refTitle(ref)" @click="jumpToRef(ref)">{{refLabel(ref)}}</button></div>
                                </li>
                              </ul>
                            </details>
                            <div v-if="alignmentExtras.length" class="align-group">
                              <h3>需求外改动</h3>
                              <ul class="overview-list">
                                <li v-for="(extra,index) in alignmentExtras" :key="index" class="align-row">
                                  <p>{{extra.text}}</p>
                                  <div v-if="extra.refs && extra.refs.length" class="overview-refs"><button v-for="(ref,refIndex) in extra.refs" :key="refIndex" class="ref-link" type="button" :title="refTitle(ref)" @click="jumpToRef(ref)">{{refLabel(ref)}}</button></div>
                                </li>
                              </ul>
                            </div>
                          </template>
                          <p v-else class="overview-muted">未提供需求依据</p>
                        </section>
                        <section id="overview-problems" class="overview-section">
                          <div class="overview-head overview-problems-head"><h2>问题</h2><span class="overview-count">{{activeFindingsList.length}} 个</span><button v-if="annotationCount" class="annotation-link-button overview-annotation-jump" type="button" @click="jumpToAnnotation(snapshotAnnotations[0])">批注 {{annotationCount}}</button>
                            <div class="overview-group-switch" role="group" aria-label="问题分组">
                              <button type="button" :aria-pressed="String(overviewProblemView==='severity')" @click="overviewProblemView='severity'">按严重度</button>
                              <button type="button" :aria-pressed="String(overviewProblemView==='file')" @click="overviewProblemView='file'">按文件</button>
                            </div>
                          </div>
                          <div v-for="group in overviewProblemGroups" :key="group.key" class="overview-problem-group" :class="[overviewProblemView==='file' ? 'overview-file-group' : 'overview-severity-group', group.severity && 'severity-'+group.severity.toLowerCase()]">
                            <div v-if="overviewProblemView==='file'" class="overview-file-head">
                              <button class="overview-file-path" type="button" :title="group.path" @click="selectByPath(group.path)"><span class="overview-file-path__label">{{group.path}}</span><span class="overview-file-path__hint" aria-hidden="true">↗ 跳转文件</span></button>
                              <span class="overview-count">{{group.items.length}} 个问题</span>
                            </div>
                            <h3 v-else><span class="overview-severity-bar" aria-hidden="true"></span>{{group.label}} · {{group.items.length}}</h3>
                            <ul class="overview-list">
                              <li v-for="issue in group.items" :key="issue.issueKey">
                                <div class="overview-problem" :data-issue-key="issue.issueKey">
                                  <div class="overview-problem__head">
                                    <span class="overview-severity-chip" :class="'severity-'+issue.severity.toLowerCase()">{{issue.severity}} · {{issue.severityName || issue.severity}}</span>
                                    <button v-if="overviewProblemView==='severity'" class="overview-file-path" type="button" :title="issuePath(issue)" @click="selectByPath(issuePath(issue))">
                                      <span class="overview-file-path__label">{{issuePath(issue)}}</span>
                                      <span class="overview-file-path__hint" aria-hidden="true">↗ 跳转文件</span>
                                    </button>
                                    <button class="overview-problem__title" type="button" :title="issue.title" @click="jumpToFinding(issue.finding)">
                                      <span class="overview-problem__title-text">{{issue.title}}</span>
                                      <span class="overview-problem__jump" aria-hidden="true">↗</span>
                                    </button>
                                  </div>
                                  <div class="overview-problem__foot">
                                    <span class="overview-delta-badge" :class="issue.carriedFrom ? 'is-carried' : 'is-new'">{{issueDeltaLabel(issue)}}</span>
                                    <span class="overview-problem__meta">{{issueLineLocation(issue)}}</span>
                                  </div>
                                </div>
                              </li>
                            </ul>
                          </div>
                          <p v-if="!problemGroups.length && !withheldCount" class="overview-muted">{{showUnderstanding ? (reviewCompleteNow ? '未发现问题。' : '尚未生成问题。') : '尚无已通过校验的问题；审查全部后更新。'}}</p>
                          <button v-if="previousAnnotationHint" class="annotation-link-button overview-previous-annotations" type="button" @click="selectRecord(previousAnnotationHint.entry)">{{previousAnnotationHint.text}} · 查看</button>
                          <div v-if="withheldFindings.length" class="withheld-box">
                            <div class="withheld-box__head"><span v-html="icons.warn"></span>{{withheldFindings.length}} 条结论证据未通过校验，未展示</div>
                            <ul class="overview-list">
                              <li v-for="entry in withheldFindings" :key="entry.findingId" class="withheld-row">
                                <b>{{entry.title}}</b>
                                <button v-if="withheldTarget(entry)" class="withheld-path withheld-path--link" type="button" :title="withheldTitle(entry)" @click="jumpToRef({ path: entry.anchor.path, side: entry.anchor.side, startLine: entry.anchor.line || null })">{{withheldLocation(entry)}}</button>
                                <span v-else class="withheld-path">{{withheldLocation(entry)}}</span>
                                <span class="withheld-code">{{withheldCodeLabel(entry.code)}}</span>
                                <span class="withheld-reason">{{entry.reason}}</span>
                              </li>
                            </ul>
                            <p class="overview-muted">这些结论不显示为问题，也不计入问题数。</p>
                          </div>
                        </section>
                        <section id="overview-coverage" class="overview-section">
                          <div class="overview-head"><h2>审查覆盖</h2></div>
                          <p class="overview-muted">已审 {{coverage && coverage.reviewed ? coverage.reviewed.length : 0}} 个文件 · 待审 {{pendingCoverageFiles.length}} 个 · 跳过 {{coverage && coverage.skipped ? coverage.skipped.length : 0}} 个 · 失败 {{coverage && coverage.failed ? coverage.failed.length : 0}} 个</p>
                          <details v-if="pendingCoverageFiles.length" class="overview-details">
                            <summary>待审文件 {{pendingCoverageFiles.length}} 个</summary>
                            <ul class="overview-list">
                              <li v-for="path in pendingCoverageFiles" :key="path"><button class="ref-link" type="button" :title="path" @click="selectByPath(path)">{{fileLabel(path)}}</button></li>
                            </ul>
                          </details>
                          <details v-if="coverage && coverage.reviewed && coverage.reviewed.length" class="overview-details">
                            <summary>已审文件 {{coverage.reviewed.length}} 个</summary>
                            <ul class="overview-list">
                              <li v-for="path in coverage.reviewed" :key="path">{{path}}</li>
                            </ul>
                          </details>
                          <details v-if="coverage && coverage.skipped && coverage.skipped.length" class="overview-details">
                            <summary>跳过 {{coverage.skipped.length}} 个文件</summary>
                            <ul class="overview-list coverage-list">
                              <li v-for="skip in coverage.skipped" :key="skip.path" class="coverage-row"><span class="coverage-path">{{skip.path}}</span><span class="coverage-reason">{{skip.reason}}</span></li>
                            </ul>
                          </details>
                          <div v-if="coverage && coverage.failed && coverage.failed.length" class="overview-sub">
                            <h3>失败</h3>
                            <ul class="overview-list coverage-failed">
                              <li v-for="failure in coverage.failed" :key="failure.path">{{failure.path}} · {{failure.reason}}</li>
                            </ul>
                          </div>
                          <p v-if="!coverage || (!coverage.reviewed?.length && !coverage.skipped?.length && !coverage.failed?.length)" class="overview-muted">尚无审查覆盖记录。</p>
                        </section>
                        <details id="overview-requirements" class="overview-section overview-requirements">
                          <summary><span>需求依据</span><span class="overview-muted">{{requirementsList.length ? requirementsList.length + ' 条' : '未提供'}}</span></summary>
                          <p v-if="!requirementsList.length" class="overview-muted">未提供需求依据</p>
                          <ul v-if="requirementsList.length" class="overview-list req-list">
                            <li v-for="source in requirementsList" :key="source.reqId" class="req-card">
                              <div class="req-card__head">
                                <span class="req-kind">{{requirementKindLabel(source.kind)}}</span>
                                <span class="req-origin">{{source.origin}}</span>
                                <span class="req-time">{{formatClock(source.capturedAt)}}</span>
                              </div>
                              <div class="req-text" :class="{'is-scroll': source.text.length > 220}">{{source.text}}</div>
                              <div v-if="source.truncated" class="req-note">超长已截断（原文 {{source.originalLength}} 字符）</div>
                            </li>
                          </ul>
                          <label class="req-ref-row"><span>需求编号</span><input class="wb-input" type="text" :value="requirementRef" placeholder="如 REQ-1234" :disabled="readonly" @input="updateRequirementRef($event.target.value)"></label>
                          <button class="req-add" type="button" :disabled="readonly" @click="openRequirementDialog"><span v-html="icons.plus"></span>添加需求依据</button>
                          <p v-if="readonly" class="overview-muted">更早的审查记录中不可添加需求依据。</p>
                        </details>
                      </div>
                    </div>
                    <splitpanes v-else horizontal :class="{'focus-report-closed':!panelOpen}" @resized="onReviewResized">
                      <pane :size="panelOpen ? reviewDiffPaneSize : 100" :min-size="0">
                        <div class="diff-container">
                          <code-review-lite v-if="selectedFileItem.path" ref="codeReview" :origin="selectedOrigin" :item="selectedFileItem" :issues="selectedIssues" :saving-issues="pendingIssueSaves" :output-format="currentOutputFormat" :report-open="panelMode==='file'" :enhancements="markdownOptions" :can-review="canReviewSelectedFile" :review-loading="isRunning" :readonly="readonly" :readonly-label="readonlyMessage()" :color-scheme="effectiveTheme" :annotations="currentFileAnnotations" :annotation-enabled="annotationEnabled" :annotation-editor="annotationEditor" :annotation-readonly="readonly" @annotation-draft="updateAnnotationDraft" @annotation-save="saveAnnotation" @annotation-cancel="cancelAnnotationEditor" @toggle-report="toggleFilePanel" @toggle-issue="toggleIssueSuppression" @request-issue="askSuppression" @code-review="handleCodeReview">
                            <template #file-navigation>
                              <div v-if="optimizationFlags.O3b" class="focus-file-nav-main">
                                <button class="focus-icon-button" type="button" aria-label="上一个文件" aria-keyshortcuts="[" v-tip="fileNavigationTip(-1)" :aria-disabled="String(!fileNavigation.previous)" @click="navigateFile(-1)" v-html="icons.chevronLeft"></button>
                                <span class="focus-file-position" :aria-label="fileNavigation.index < 0 ? '当前文件不在搜索结果中' : undefined">{{fileNavigation.index < 0 ? '—' : fileNavigation.index+1}}/{{fileNavigation.total}}</span>
                                <button class="focus-icon-button" type="button" aria-label="下一个文件" aria-keyshortcuts="]" v-tip="fileNavigationTip(1)" :aria-disabled="String(!fileNavigation.next)" @click="navigateFile(1)" v-html="icons.chevronRight"></button>
                              </div>
                            </template>
                          </code-review-lite>
                          <div v-else class="empty-files">请选择文件</div>
                        </div>
                      </pane>
                      <pane v-if="panelOpen" :size="reviewPaneSize" :min-size="0">
                        <div class="review-panel" @click.stop>
                          <div class="review-panel__header">
                            <div class="review-panel__title"><h2>当前文件说明</h2></div>
                            <button class="focus-icon-button" type="button" aria-label="关闭说明" v-tip="'关闭说明'" @click="closePanel" v-html="icons.close"></button>
                          </div>
                          <div class="review-panel__body">
                            <div class="file-panel">
                              <template v-if="selectedFileItem.reviewStatus==='skipped' || selectedFileItem.reviewStatus==='metadata'">
                                <p class="panel-empty-text">{{selectedFileItem.skipReason}}</p>
                              </template>
                              <template v-else-if="selectedFileItem.reviewStatus==='pending'">
                                <p class="panel-empty-text">待审。审查全部或本文件后生成说明。</p>
                                <div class="panel-actions">
                                  <button v-if="!autoMode && !readonly" class="n-button" type="button" :disabled="isRunning" @click="handleCodeReview">审查本文件</button>
                                  <button class="n-button" type="button" :disabled="isRunning" @click="handleReviewAll">审查全部</button>
                                </div>
                              </template>
                              <template v-else>
                                <div class="panel-section__head"><h3>变更摘要</h3></div>
                                <div class="semantic-items">
                                  <template v-for="(item,index) in selectedFileItem.semanticItems" :key="index">
                                    <button v-if="item.refs && item.refs.length" class="semantic-item" type="button" @click="jumpToRef(item.refs[0])"><span v-html="inlineMarkdown(item.text)"></span></button>
                                    <p v-else class="semantic-item semantic-item--static"><span v-html="inlineMarkdown(item.text)"></span></p>
                                  </template>
                                  <p v-if="!selectedFileItem.semanticItems || !selectedFileItem.semanticItems.length" class="panel-empty-text">说明不完整。</p>
                                </div>
                                <div v-if="panelFileWithheld.length" class="withheld-box">
                                  <div class="withheld-box__head"><span v-html="icons.warn"></span>{{panelFileWithheld.length}} 条结论证据未通过校验，未展示</div>
                                  <p class="panel-muted">这些结论不会显示为问题，也不计入问题数。</p>
                                </div>
                                <section class="panel-section">
                                  <h3>代码评审</h3>
                                  <p v-if="!selectedIssues.length && !panelFileWithheld.length" class="panel-muted">未发现问题。</p>
                                  <ul v-if="selectedIssues.length" class="finding-line-list">
                                    <li v-for="issue in selectedIssues" :key="issue.issueKey">
                                      <button v-if="!issue.suppressed" type="button" class="finding-line" @click="jumpToFinding(issue.finding)">
                                        <span class="finding-line__severity" :class="'finding-line__severity--'+issue.severity">{{issue.severity}} · {{issue.severityName}}</span>
                                        <span class="finding-line__title">{{issue.title}}</span>
                                      </button>
                                      <div v-else class="finding-line finding-line--static">
                                        <span class="finding-line__severity" :class="'finding-line__severity--'+issue.severity">{{issue.severity}} · {{issue.severityName}}</span>
                                        <span class="finding-line__title">{{issue.title}}</span>
                                        <span class="suppressed-chip">已标记非问题</span>
                                      </div>
                                    </li>
                                  </ul>
                                </section>
                              </template>
                            </div>
                          </div>
                        </div>
                      </pane>
                    </splitpanes>
                  </pane>
                </splitpanes>
              </div>
            </div>
          </section>
        </main>
        <aside v-if="consoleVisible" class="prototype-console focus-console">
          <div class="console-titlebar">
            <button class="console-toggle" type="button" @click="consoleExpanded = !consoleExpanded" :aria-expanded="consoleExpanded">演示控制台 <span>{{consoleExpanded ? '−' : '＋'}}</span></button>
            <div v-if="!consoleExpanded" class="console-theme-switch" role="group" aria-label="主题">
              <button type="button" class="console-theme-option" :class="{'is-active': effectiveTheme==='light'}" :aria-pressed="effectiveTheme==='light'" aria-label="切换为浅色" v-tip="'切换为浅色'" @click="toggleDemoTheme('light')">浅色</button>
              <button type="button" class="console-theme-option" :class="{'is-active': effectiveTheme==='dark'}" :aria-pressed="effectiveTheme==='dark'" aria-label="切换为深色" v-tip="'切换为深色'" @click="toggleDemoTheme('dark')">深色</button>
            </div>
          </div>
          <div v-if="consoleExpanded" class="console-content">
            <p>演示 · 本仓真实差异 · 示例审查结果</p>
            <label>视图<select :value="view" aria-label="视图" @change="setView($event.target.value)"><option value="list">交付列表</option><option value="conversation">对话</option><option value="review">评审台</option></select></label>
            <label>场景<select :value="scenario" aria-label="场景" @change="applyConsoleScenario($event.target.value)"><option v-for="(label,key) in scenarioLabels" :key="key" :value="key">{{label}}</option></select></label>
            <label>主题<select :value="themeMode" aria-label="主题" @change="setThemeMode($event.target.value, $event)"><option value="auto">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></select></label>
            <label>主区域<select :value="mainView" aria-label="主区域" @change="setMainView($event.target.value)"><option value="diff">文件 Diff</option><option value="overview">整批变更说明</option></select></label>
            <label>下方面板<select :value="panelMode || 'none'" aria-label="下方面板" @change="setPanel($event.target.value)"><option value="none">关闭</option><option value="file">当前文件说明</option></select></label>
            <label class="console-switch"><input type="checkbox" v-model="autoMode" @change="notifyAutoMode"> 自动模式</label>
            <div class="console-actions"><button type="button" @click="openReview">打开评审台</button><button type="button" @click="showConversation">返回对话</button></div>
            <p>切换场景重置本地处置。所有操作仅在内存中模拟。</p>
          </div>
        </aside>
        <teleport to="body">
          <div v-if="requirementDialog.open" class="req-modal-backdrop" @click.self="closeRequirementDialog">
            <div class="req-modal" role="dialog" aria-modal="true" aria-label="添加需求依据">
              <div class="req-modal__head"><h2>添加需求依据</h2><button class="focus-icon-button" type="button" aria-label="关闭" v-tip="'关闭'" @click="closeRequirementDialog" v-html="icons.close"></button></div>
              <p class="req-modal__hint">需求依据会冻结进新的审查记录。代码内容不变，需求摘要变化后全部文件回到待审。</p>
              <div class="req-modal__tabs">
                <button type="button" :class="{active: requirementDialog.kind === 'paste'}" @click="setRequirementKind('paste')">粘贴文字</button>
                <button type="button" :class="{active: requirementDialog.kind === 'file'}" @click="setRequirementKind('file')">选择文件</button>
              </div>
              <label v-if="requirementDialog.kind === 'file'" class="req-file-pick">
                <input type="file" accept=".md,.txt,.json,.yaml,.yml,.js,.ts" @change="readRequirementFile">
                <span>选择文件…</span>
                <small v-if="requirementDialog.fileName">{{requirementDialog.fileName}}</small>
              </label>
              <textarea ref="requirementText" v-model="requirementDialog.text" rows="7" placeholder="粘贴需求、验收标准或用户消息…"></textarea>
              <div class="req-modal__meta"><span>{{requirementDialog.text.length}} 字符</span><span v-if="requirementDialog.truncated">已截断（原文 {{requirementDialog.originalLength}} 字符）</span></div>
              <div class="req-modal__actions">
                <button class="n-button" type="button" @click="closeRequirementDialog">取消</button>
                <button class="n-button" type="button" :disabled="!canAddRequirement" @click="confirmRequirement">添加并生成新的审查记录</button>
              </div>
            </div>
          </div>
        </teleport>
        <teleport to="body">
          <div v-if="sendBackDialog.open" class="req-modal-backdrop" @click.self="closeSendBackDialog">
            <div class="req-modal sendback-modal" role="dialog" aria-modal="true" aria-label="发回会话">
              <div class="req-modal__head"><h2>发回会话</h2><button class="focus-icon-button" type="button" aria-label="关闭" v-tip="'关闭'" @click="closeSendBackDialog" v-html="icons.close"></button></div>
              <p class="sendback-meta">{{sendBackDialog.meta}}</p>
              <pre class="sendback-content">{{sendBackDialog.content}}</pre>
              <p class="sendback-hint">输入框已有内容。请选择追加到草稿末尾，或复制到剪贴板。不会自动发送。</p>
              <div class="req-modal__actions">
                <button class="n-button" type="button" @click="closeSendBackDialog">取消</button>
                <button class="n-button" type="button" @click="copySendBack">复制到剪贴板</button>
                <button class="n-button" type="button" @click="appendSendBack">追加到草稿末尾</button>
              </div>
            </div>
          </div>
        </teleport>
        <teleport to="body">
          <div v-if="deleteDialog.open" class="req-modal-backdrop" @click.self="closeDeleteDialog">
            <div class="req-modal delete-modal" role="dialog" aria-modal="true" aria-label="删除交付">
              <div class="req-modal__head"><h2>确认删除此交付记录？</h2></div>
              <p class="delete-modal__body">会一并删除它的审查记录、问题处置与批注，不能恢复。</p>
              <div class="req-modal__actions">
                <button ref="deleteCancel" class="n-button" type="button" @click="closeDeleteDialog">取消</button>
                <button class="n-button delete-danger" type="button" @click="confirmDeleteDelivery">删除</button>
              </div>
            </div>
          </div>
        </teleport>
        <teleport to="body">
          <div v-if="extensionDialog.open" class="req-modal-backdrop" @click.self.stop="closeExtensionDialog">
            <section class="extension-modal" role="dialog" aria-modal="true" aria-label="扩展提示词" @keydown="trapDialogKeys" @click.stop>
              <div class="req-modal__head"><h2>扩展提示词</h2><button class="focus-icon-button" type="button" aria-label="关闭" v-tip="'关闭'" @click="closeExtensionDialog" v-html="icons.close"></button></div>
              <p class="extension-hint">会随每次审查（审查全部、单文件、自动）一起发送。可写团队规范、需要重点检查或忽略的问题、严重度标准（如「未校验的外部输入一律按 P1」）；不能改变输出格式和证据要求。</p>
              <div class="extension-editor">
                <div class="extension-pane">
                  <div class="extension-pane__head">编辑</div>
                  <textarea ref="extensionText" v-model="extensionDialog.draft" @compositionstart="extensionComposing=true" @compositionend="extensionComposing=false" class="extension-textarea" placeholder="写下本工作区的审查关注点、团队规范或严重度标准…"></textarea>
                </div>
                <div class="extension-pane">
                  <div class="extension-pane__head">预览</div>
                  <div class="extension-preview markdown-body" v-html="extensionPreviewHtml"></div>
                </div>
              </div>
              <div class="extension-footer">
                <span class="extension-count" :class="{'is-over': extensionOverLimit}">{{extensionDraftLength}} / 20000</span>
                <div class="extension-actions">
                  <label class="extension-import"><input type="file" accept=".md,.markdown,.txt" @change="importExtensionFile">导入 .md</label>
                  <button type="button" class="osw-text-link" @click="clearExtensionDraft">清空</button>
                  <button type="button" class="n-button" @click="closeExtensionDialog">取消</button>
                  <button type="button" class="n-button" :disabled="extensionOverLimit" @click="saveExtensionPrompt">保存</button>
                </div>
              </div>
            </section>
          </div>
        </teleport>
        <teleport to="body"><div v-if="extensionDiscardOpen" class="req-modal-backdrop extension-discard-backdrop" @click.self.stop="keepEditingExtension"><section class="req-modal extension-discard-dialog" role="alertdialog" aria-modal="true" aria-label="放弃未保存的修改" @keydown="trapDialogKeys" @click.stop><h2>放弃未保存的修改？</h2><p>扩展提示词尚未保存，放弃后保留上次保存的设置。</p><div class="req-modal__actions"><button ref="keepExtension" type="button" class="n-button" @click="keepEditingExtension">继续编辑</button><button type="button" class="n-button" @click="finishCloseExtension">放弃修改</button></div></section></div></teleport>
        <teleport to="body">
          <div v-if="ui.tooltip" class="n-popover n-popover--top" :class="{'focus-card-tooltip':ui.tooltip.singleLine,'focus-bounded-popover':anyOptimizationEnabled,'focus-multiline-tooltip':ui.tooltip.multiline}" role="tooltip" :style="{left:ui.tooltip.x+'px',top:ui.tooltip.y+'px'}">
            <div class="n-popover__popcontent pop-content" v-html="ui.tooltip.html"></div>
            <span class="popover-arrow"></span>
          </div>
          <div v-if="ui.confirm" class="n-popconfirm" :class="{'focus-bounded-popover':anyOptimizationEnabled}" role="alertdialog" aria-label="确认问题处置" :style="{left:ui.confirm.x+'px',top:ui.confirm.y+'px'}">
            <div class="popconfirm-title"><span class="warning-icon">!</span>{{ui.confirm.issue.suppressed ? '确认恢复为有效问题？' : '确认标记为非问题？'}}</div>
            <p v-if="!ui.confirm.issue.suppressed" class="popconfirm-note">标记为非问题后，将不计入待修复清单，可随时在此恢复。</p>
            <span class="popover-arrow"></span>
            <div class="popconfirm-actions">
              <button type="button" class="n-button" @click="ui.confirm = null">取消</button>
              <button type="button" class="n-button" @click="toggleIssueSuppression(ui.confirm.issue)">{{ui.confirm.issue.suppressed ? '恢复' : '确认标记'}}</button>
            </div>
          </div>
          <div v-if="ui.message" class="n-message" :class="{'focus-bounded-message':anyOptimizationEnabled}" role="status">{{ui.message}}</div>
          <div v-if="annotationUndo.open" class="annotation-undo" role="status"><span>已删除批注</span><button type="button" class="wb-link" @click="undoAnnotationDelete">撤销</button></div>
        </teleport>
      </div>
    `,
  });
  app.config.globalProperties.CR_PROTOTYPE_DATA = window.CR_PROTOTYPE_DATA;
  app.directive('tip', P.tooltipDirective);
  P.app = app.mount('#app');
})();
