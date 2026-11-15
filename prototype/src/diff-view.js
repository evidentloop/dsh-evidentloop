(function () {
  'use strict';
  const P = window.CRPrototype;
  P.stats = patch => {
    let added = 0, deleted = 0;
    for (const line of (patch || '').split('\n')) {
      if (line.startsWith('+++') || line.startsWith('---')) continue;
      if (line.startsWith('+')) added++;
      else if (line.startsWith('-')) deleted++;
    }
    return { added, deleted };
  };
  P.gitDiff = origin => {
    const path = value => value?.replace(/\.vue$/, '.ts') || '';
    return `--- a/${path(origin.old_path)}\n+++ b/${path(origin.new_path)}\n${origin.diff || ''}`;
  };
  P.CodeReviewLite = {
    props: ['origin', 'item', 'issues', 'savingIssues', 'outputFormat', 'reportOpen', 'enhancements', 'canReview', 'reviewLoading', 'readonly', 'readonlyLabel', 'colorScheme', 'annotations', 'annotationEnabled', 'annotationEditor', 'annotationReadonly'], // O2/O3c/O4/§3.3/A14
    emits: ['toggle-report', 'toggle-issue', 'request-issue', 'code-review', 'annotation-draft', 'annotation-save', 'annotation-cancel', 'request-annotation'],
    data: () => ({ observers: [], lineAnchors: [], markerRows: [], highlightTimers: [], locateGeneration:0, isFileNameTruncated: false,
      markEmphasis: null, markEmphasisTimer: null, markInteractionVersion: 0, suppressedOpen: {}, // A14：单个短暂强调，切文件/卸载时清理。
    }), // O2: invalidate stale opening-location requests.
    computed: {
      badge() { return this.origin.new_file ? 'A' : this.origin.deleted_file ? 'D' : this.origin.renamed_file ? 'R' : 'M'; },
      badgeClass() { return { M: 'modify', A: 'add', D: 'delete', R: 'rename' }[this.badge]; },
      changeStats() { const stats = P.stats(this.origin.diff); return { added: this.origin.additions ?? stats.added, deleted: this.origin.deletions ?? stats.deleted }; },
      icons() { return P.icons; },
      annotationShortcutHint() {
        return (/Mac|iPhone|iPad|iPod/.test(navigator.platform || '') ? '⌘' : 'Ctrl') + ' + Enter 保存 · Esc 收起（保留草稿）';
      },
      emptyMessage() {
        const origin = this.origin || {};
        if (origin.kind === 'binary') return '二进制文件，未载入文本差异；只保留元数据。可在编辑器中打开查看完整文件。';
        if (origin.kind === 'oversize') return '超过大小上限，未载入文本差异；只保留元数据。可在编辑器中打开查看完整文件。';
        if (origin.kind === 'excluded') return '已按工作区规则排除，未载入文本差异；只保留元数据。' + (origin.note ? '（' + origin.note + '）' : '');
        if (origin.kind === 'symlink') return '符号链接，仅记录链接目标文本，不跟随读取。';
        if (origin.kind === 'submodule') return '子模块，仅记录提交指针，不读取子模块内容。';
        if (origin.file?.kind === 'text' && !origin.diff) return '仅元数据变化，没有可展示的文本差异。';
        return '该文件没有可展示的文本差异。';
      },
      activeIssues() { // Severity -> line; the same order drives initial location and card buttons.
        return this.issues.filter(issue => !issue.suppressed).sort((a, b) =>
          (P.issues.SEVERITY_RANK[a.severity] ?? 9) - (P.issues.SEVERITY_RANK[b.severity] ?? 9) ||
          (a.lineNumber || Number.MAX_SAFE_INTEGER) - (b.lineNumber || Number.MAX_SAFE_INTEGER) ||
          a.displayOrder - b.displayOrder);
      },
      fileNameTip() {
        if (this.isFileNameTruncated) {
          return `<div class="focus-filename-tip"><div class="focus-filename-tip__path">${P.escape(this.item.path)}</div><div class="focus-filename-tip__action">在编辑器中打开</div></div>`;
        }
        return '在编辑器中打开';
      },
    },
    watch: {
      'origin.diff'() { this.$nextTick(this.renderDiff); },
      'item.md5_str'() { this.markInteractionVersion++; this.clearMarkEmphasis(); this.$nextTick(this.renderDiff); }, // A13/A14
      'item.path'() { this.$nextTick(this.updateFileNameTruncation); },
      outputFormat() { this.$nextTick(this.renderDiff); },
      colorScheme() { this.$nextTick(this.renderDiff); },
      issues: { deep: true, handler() { this.$nextTick(() => { this.injectRiskMarkers(); this.injectAnnotations(); }); } },
      annotations: { deep: true, handler() { this.$nextTick(this.injectAnnotations); } },
      'annotationEditor.open'() { this.$nextTick(this.refreshAnnotationEditor); },
      'annotationEditor.key'() { this.$nextTick(this.refreshAnnotationEditor); },
      'annotationEditor.error'(value) {
        const error = this.$refs.body?.querySelector('.annotation-editor__error');
        if (error) error.textContent = value || '';
      },
      savingIssues: { deep: true, handler() { this.$nextTick(this.updateSavingButtons); } }, // A14：保存结束只更新可操作状态，不重建卡片和焦点。
      enhancements: { deep: true, handler(value, previous) {
        if (!value.iconButtons) this.clearMarkEmphasis();
        this.$nextTick(this.injectRiskMarkers);
        if (value.linkLines && !previous?.linkLines) this.queueFirstIssue();
        if (!value.linkLines && previous?.linkLines) { this.locateGeneration++; this.clearIssueHighlight(); this.$refs.body?.scrollTo({top:0,behavior:'instant'}); }
      } }, // O2/O4
    },
    mounted() {
      this.renderDiff(); this.$refs.body.addEventListener('copy', this.handleDiffCopy);
      this.$nextTick(this.updateFileNameTruncation);
      if (window.ResizeObserver && this.$refs.fileNameLink) {
        this.nameObserver = new ResizeObserver(() => this.updateFileNameTruncation());
        this.nameObserver.observe(this.$refs.fileNameLink);
      }
    }, // O4
    beforeUnmount() {
      this.markInteractionVersion++; this.clearMarkEmphasis();
      this.nameObserver?.disconnect(); this.nameObserver = null;
      this.locateGeneration++; this.clearDecorations(); this.highlightTimers.forEach(clearTimeout); this.$refs.body?.removeEventListener('copy', this.handleDiffCopy);
    },
    methods: {
      recordFileLink(event) {
        event.preventDefault();
        // DSH 原生打开能力待 P2 验证；演示只记录意图，不发起外站请求。
        P.openedLinks ||= [];
        P.openedLinks.push({ action: 'open-in-editor', path: this.item.path, line: null });
        P.message('模拟在编辑器中打开 ' + this.item.path);
      },
      updateFileNameTruncation() {
        const el = this.$refs.fileNameLink;
        this.isFileNameTruncated = Boolean(el && el.scrollWidth > el.clientWidth);
      },
      clearDecorations() {
        this.observers.forEach(observer => observer.disconnect()); this.observers = [];
        this.$refs.body?.querySelectorAll('.issue-card-comment, .issue-card-ask, .file-risk-item__suppress-btn, .annotation-card [data-action="edit"]').forEach(button=>P.tooltipDirective.unmounted(button)); // §3.9: release component tooltip handlers.
        P.hideTipWithin(this.$refs.body);
        this.$refs.body?.querySelectorAll('.decoration-row, .annotation-holder, .annotation-decoration, .annotation-editor-holder').forEach(row => row.remove());
        this.$refs.body?.querySelectorAll('.annotation-anchored-line').forEach(row => row.classList.remove('annotation-anchored-line'));
        this.$refs.body?.querySelectorAll('.focus-file-level-reviews').forEach(list => list.remove()); // O3c
        this.$refs.body?.querySelectorAll('.focus-suppressed-marker').forEach(button => { P.tooltipDirective.unmounted(button); button.remove(); });
        this.$refs.body?.querySelectorAll('.focus-suppressed-cell').forEach(cell => cell.classList.remove('focus-suppressed-cell')); // A13: leave original line numbers intact.
        this.$refs.body?.querySelectorAll('.focus-suppressed-holder').forEach(row => row.remove());
        this.$refs.body?.querySelectorAll('.focus-suppressed-slot').forEach(slot => slot.remove());
        this.markerRows = [];
      },
      renderDiff() {
        if (!this.$refs.body) return;
        this.clearDecorations();
        const body = this.$refs.body;
        body.innerHTML = '';
        const viewer = new Diff2HtmlUI(body, P.gitDiff(this.origin), {
          drawFileList: false, matching: 'lines', outputFormat: this.outputFormat,
          colorScheme: this.colorScheme === 'dark' ? 'dark' : 'light',
          highlight: true, synchronisedScroll: false, renderNothingWhenEmpty: true, highlightLanguages: [],
        });
        viewer.draw(); viewer.highlightCode();
        this.lineAnchors = [];
        const double = this.outputFormat === 'side-by-side';
        const sides = [...body.querySelectorAll('.d2h-file-side-diff')];
        body.querySelectorAll('tr').forEach(row => {
          if (double) {
            const side = row.closest('.d2h-file-side-diff') === sides[1] ? 'right' : 'left';
            const number = Number(row.querySelector('.d2h-code-side-linenumber')?.textContent.trim());
            if (number > 0) this.lineAnchors.push({ row, number, side });
          } else {
            for (const side of ['left', 'right']) {
              const number = Number(row.querySelector(side === 'left' ? '.line-num1' : '.line-num2')?.textContent.trim());
              if (number > 0) this.lineAnchors.push({ row, number, side });
            }
          }
        });
        this.lineAnchors.forEach(({ row, number, side }) => {
          row.dataset.line = number; row.dataset.side = side;
          row.id = `risk-issue-line-${this.item.md5_str}-${side}-${number}`;
          row.classList.add('diff-line-anchor-target');
        });
        this.injectRiskMarkers(); this.injectAnnotationButtons(); this.injectAnnotations(); body.scrollTop = 0;
        this.queueFirstIssue(); // O2: open both single- and multi-defect files at their first active issue.
      },
      findLine(number, side) {
        return this.lineAnchors.find(entry => entry.number === number && (!side || entry.side === side))?.row;
      },
      isFileLevelIssue(issue) { return !(issue.lineNumber > 0) || !this.findLine(issue.lineNumber, issue.side === 'base' ? 'left' : 'right'); }, // O3c: missing and out-of-diff lines share the top card group.
      isIssueSaving(issue) { return Boolean(this.savingIssues?.[`${issue.fileKey}:${issue.issueKey}`]); },
      updateSavingButtons() { // A14：aria-disabled 保留键盘焦点，点击入口仍检查记录锁。
        if (!this.enhancements?.iconButtons) return;
        this.$refs.body?.querySelectorAll('.gpt-risk-marker').forEach(card => {
          const issue = this.issues.find(item => item.issueKey === card.dataset.issueKey);
          if (issue) card.querySelector('.file-risk-item__suppress-btn')?.setAttribute('aria-disabled', String(this.isIssueSaving(issue)));
        });
      },
      markedByText(issue) { // A14：处置胶囊只显示时间，不显示处置人。
        let overrides = this.item.issue_overrides || {};
        if (typeof overrides === 'string') { try { overrides = JSON.parse(overrides); } catch { return ''; } }
        const entry = overrides[issue.issueKey];
        if (!entry) return '';
        const raw = entry.updatedAt;
        const timestamp = typeof raw === 'number' || (typeof raw === 'string' && raw.trim()) ? Number(raw) : NaN;
        const date = new Date(timestamp);
        if (!(timestamp > 0) || !Number.isFinite(date.getTime())) return '';
        const pad = value => String(value).padStart(2, '0');
        return `处置于 ${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
      },
      markDestination(issue) {
        return this.$refs.body?.querySelector(`.gpt-risk-marker[data-issue-key="${CSS.escape(issue.issueKey)}"]`);
      },
      clearMarkEmphasis() {
        clearTimeout(this.markEmphasisTimer); this.markEmphasisTimer = null; this.markEmphasis = null;
        this.$refs.body?.querySelectorAll('.focus-mark-emphasis').forEach(node => node.classList.remove('focus-mark-emphasis'));
      },
      applyMarkEmphasis() { // A14：装饰重建后续上原计时，不因列表刷新延长强调。
        const current = this.markEmphasis;
        if (!current) return;
        const issue = this.issues.find(item => item.issueKey === current.issueKey && item.suppressed);
        if (this.item.md5_str !== current.fileKey || !issue || !this.enhancements?.iconButtons) return this.clearMarkEmphasis();
        this.markDestination(issue)?.classList.add('focus-mark-emphasis');
      },
      emphasizeMarkedIssue(issue) {
        this.clearMarkEmphasis();
        this.markEmphasis = { fileKey: issue.fileKey, issueKey: issue.issueKey };
        this.applyMarkEmphasis();
        this.markEmphasisTimer = setTimeout(() => this.clearMarkEmphasis(), 2400);
      },
      requestIssueToggle(issue, event) {
        if (this.readonly) { P.message(this.readonlyLabel || '处置只读'); return; }
        if (this.isIssueSaving(issue)) return;
        P.hideTip();
        this.$emit('request-issue', issue, event);
      },
      isAnnotationEntryOpen({ findingId = null, annotationId = null }) {
        const editor = P.app?.annotationEditor || this.annotationEditor;
        if (!editor?.open) return false;
        return annotationId ? editor.annotationId === annotationId
          : Boolean(findingId && !editor.annotationId && editor.findingId === findingId);
      },
      updateAnnotationEntryState(root = this.$refs.body) {
        if (!root) return;
        const update = (button, expanded, closedLabel) => {
          const label = expanded ? '收起批注（保留草稿）' : closedLabel;
          if (button.getAttribute('aria-label') !== label) P.hideTip();
          button.setAttribute('aria-expanded', String(expanded));
          button.setAttribute('aria-label', label);
          if (button._showTip) P.tooltipDirective.updated(button, { value: label });
          else P.tooltipDirective.mounted(button, { value: label });
        };
        root.querySelectorAll('.issue-card-comment').forEach(button => {
          const findingId = button.closest('.gpt-risk-marker')?.dataset.issueKey;
          update(button, this.isAnnotationEntryOpen({ findingId }), '添加批注');
        });
        root.querySelectorAll('.annotation-card [data-action="edit"]').forEach(button => {
          const annotationId = button.closest('.annotation-card').dataset.annotationId;
          const expanded = this.isAnnotationEntryOpen({ annotationId });
          const text = expanded ? '收起' : '编辑';
          if (button.textContent !== text) button.textContent = text;
          update(button, expanded, '编辑批注');
        });
      },
      refreshAnnotationEditor() {
        this.injectAnnotationEditor();
        this.updateAnnotationEntryState();
      },
      createRiskMarkerElement(issue) {
        const fileLevel = this.enhancements?.fileLevelReviews && this.isFileLevelIssue(issue); // O3c: preserve issues outside displayed hunks.
        const marker = document.createElement('div');
        const severityClass = issue.severity === 'P2' ? ' gpt-risk-marker--p2' : '';
        marker.className = `gpt-risk-marker gpt-risk-marker--${issue.type}${severityClass}${issue.suppressed ? ' gpt-risk-marker--suppressed is-collapsed' : ''}`;
        marker.dataset.issueKey = issue.issueKey;
        const suppressLabel = this.readonly ? (this.readonlyLabel || '处置只读') : (issue.suppressed ? '恢复为有效问题' : '忽略问题');
        const categoryLabel = issue.categoryLabel || (issue.type === 'logic' ? '逻辑' : '性能');
        const severityLabel = issue.severity || 'P2';
        const severityName = issue.severityName || P.issues.SEVERITY_LABEL[severityLabel] || '';
        const categoryIcon = issue.category === 'security' ? P.icons.shield : '';
        const carriedLabel = issue.carriedFromLabel || '更早的审查';
        const carriedTag = issue.carriedFrom ? `<span class="carried-tag" title="${P.escape('沿用自 ' + carriedLabel)}">${P.escape('沿用自 ' + carriedLabel)}</span>` : '';
        const markedAt = issue.suppressed ? this.markedByText(issue) : '';
        const suppressControl = this.readonly ? '' : (issue.suppressed
          ? `<button type="button" class="gpt-risk-marker__restore file-risk-item__suppress-btn">恢复</button>`
          : '');
        const markedChip = issue.suppressed
          ? `<span class="gpt-risk-marker__marked" title="${P.escape(markedAt || '已忽略')}">已忽略</span>${suppressControl}`
          : '';
        const narrativeHtml = issue.narrative ? P.convertToMarkdown(issue.narrative, { ...this.enhancements, fileKey: issue.fileKey }) : '';
        const textSolution = issue.textSuggestion
          ? `<div class="gpt-risk-marker__text-solution">${P.inlineMarkdown(issue.textSuggestion)}</div>` : '';
        const suggestion = issue.textSuggestion || issue.codeSuggestion
          ? `<section class="gpt-risk-marker__suggestion${issue.codeSuggestion ? ' gpt-risk-marker__code-panel' : ''}" aria-label="修改建议">${issue.codeSuggestion
            ? `<div class="gpt-risk-marker__code-head" role="button" tabindex="0" aria-expanded="true"><span class="gpt-risk-marker__code-head-left">${P.icons.chevron}修改建议</span><button type="button" class="gpt-risk-marker__code-copy">${P.icons.copy}<span>复制建议</span></button></div>`
            : '<div class="gpt-risk-marker__suggestion-heading">修改建议</div>'}${textSolution}${issue.codeSuggestion
            ? `<pre class="gpt-risk-marker__code-body"><code>${P.escape(issue.codeSuggestion)}</code></pre>` : ''}</section>` : '';
        marker.innerHTML = `<div class="gpt-risk-marker__header" tabindex="0" role="button" aria-expanded="${!issue.suppressed}"><div class="gpt-risk-marker__header-left"><span class="gpt-risk-marker__toggle">${P.icons.chevron}</span><span class="gpt-risk-marker__type"><span class="gpt-risk-marker__category">${categoryIcon}${P.escape(categoryLabel)}</span><span class="gpt-risk-marker__severity">${P.escape(severityLabel)}${severityName ? ' · ' + P.escape(severityName) : ''}</span></span>${carriedTag}<span class="gpt-risk-marker__title" title="${P.escape(issue.title)}">${P.escape(issue.title)}</span></div><div class="gpt-risk-marker__header-right">${markedChip}</div></div><div class="gpt-risk-marker__content markdown-body"><div class="gpt-risk-marker__narrative">${narrativeHtml}</div>${suggestion}</div>`;
        const header = marker.querySelector('.gpt-risk-marker__header');
        const headerRight = marker.querySelector('.gpt-risk-marker__header-right');
        if (!this.readonly && !issue.suppressed && this.annotationEnabled !== false) {
          const commentButton = document.createElement('button');
          commentButton.type = 'button';
          commentButton.className = 'annotation-add issue-card-comment focus-icon-button';
          commentButton.setAttribute('aria-label', '添加批注');
          commentButton.innerHTML = P.icons.comment;
          P.tooltipDirective.mounted(commentButton, { value: '添加批注' });
          commentButton.addEventListener('click', event => {
            event.stopPropagation();
            if (this.isAnnotationEntryOpen({ findingId: issue.issueKey })) {
              P.app?.cancelAnnotationEditor();
              return;
            }
            marker.classList.remove('is-collapsed');
            header.setAttribute('aria-expanded', 'true');
            P.app?.openAnnotationEditor({ findingId: issue.issueKey });
          });
          headerRight.append(commentButton);
        }
        if (!issue.suppressed) {
        const askButton = document.createElement('button');
        askButton.type = 'button';
        askButton.className = 'issue-card-ask focus-icon-button';
        askButton.dataset.action = 'ask-in-session';
        askButton.setAttribute('aria-label', '在会话中追问');
        askButton.innerHTML = P.icons.ask;
        askButton.addEventListener('click', event => {
          event.stopPropagation();
          P.app?.askIssueInSession(issue);
        });
        P.tooltipDirective.mounted(askButton, { value: '在会话中追问' });
        headerRight.append(askButton);
        }
        if (!this.readonly && !issue.suppressed) {
          const ignoreButton = document.createElement('button');
          ignoreButton.type = 'button';
          ignoreButton.className = 'issue-card-suppress file-risk-item__suppress-btn focus-icon-button';
          ignoreButton.setAttribute('aria-label', '忽略问题');
          ignoreButton.innerHTML = P.icons.suppress;
          P.tooltipDirective.mounted(ignoreButton, { value: '忽略问题' });
          headerRight.append(ignoreButton);
        }
        if (!issue.suppressed && this.activeIssues.length > 1) {
          const nextButton = document.createElement('button');
          nextButton.type = 'button';
          nextButton.className = 'issue-card-next focus-icon-button';
          nextButton.setAttribute('aria-label', '下一个问题');
          nextButton.innerHTML = P.icons.arrowDown;
          P.tooltipDirective.mounted(nextButton, { value: '下一个问题' });
          nextButton.addEventListener('click', event => {
            event.stopPropagation();
            // Resolve on every click: ignore/restore and card reinjection can change the order.
            const cards = [...this.$refs.body.querySelectorAll('.gpt-risk-marker:not(.gpt-risk-marker--suppressed)')];
            if (!cards.length) return;
            const index = cards.indexOf(marker);
            const target = cards[(index + 1) % cards.length];
            target.classList.remove('is-collapsed');
            target.querySelector('.gpt-risk-marker__header')?.setAttribute('aria-expanded', 'true');
            this.cancelAutoLocate();
            target.scrollIntoView({ block: 'center', behavior: 'smooth' });
            P.app?.pulseIssueCard(target);
            target.querySelector('.issue-card-next')?.focus({ preventScroll: true });
            P.hideTip();
          });
          headerRight.append(nextButton);
        }
        const suppressBtn = marker.querySelector('.file-risk-item__suppress-btn');
        if (suppressBtn && issue.suppressed) {
          suppressBtn.classList.remove('focus-icon-button');
          suppressBtn.classList.add('gpt-risk-marker__restore');
        }
        if (suppressBtn) {
          suppressBtn.setAttribute('aria-label', suppressLabel);
          suppressBtn.setAttribute('aria-disabled', String(Boolean(this.readonly) || Boolean(this.isIssueSaving(issue))));
          P.tooltipDirective.mounted(suppressBtn, { value: suppressLabel });
        }
        const codeHead = marker.querySelector('.gpt-risk-marker__code-head');
        if (codeHead) {
          const toggleCode = () => {
            const panel = codeHead.closest('.gpt-risk-marker__code-panel');
            const codeBody = panel?.querySelector('.gpt-risk-marker__code-body');
            if (!codeBody) return;
            const collapsed = !codeBody.hidden;
            codeBody.hidden = collapsed;
            const text = panel.querySelector('.gpt-risk-marker__text-solution');
            if (text) text.hidden = collapsed;
            panel.classList.toggle('is-collapsed', collapsed);
            codeHead.setAttribute('aria-expanded', String(!collapsed));
          };
          codeHead.addEventListener('click', event => {
            if (event.target.closest('.gpt-risk-marker__code-copy')) return;
            toggleCode();
          });
          codeHead.addEventListener('keydown', event => {
            if (event.target === codeHead && [' ', 'Enter'].includes(event.key)) { event.preventDefault(); toggleCode(); }
          });
        }
        marker.querySelector('.gpt-risk-marker__code-copy')?.addEventListener('click', event => {
          event.stopPropagation();
          P.copyText(issue.codeSuggestion, '已复制建议');
        });
        if (fileLevel) {
          marker.classList.add('focus-file-level-card');
          const scope = document.createElement('span'); scope.className = 'gpt-risk-marker__scope'; scope.textContent = '文件级';
          marker.querySelector('.gpt-risk-marker__title').before(scope);
        }
        const toggle = () => { marker.classList.toggle('is-collapsed'); header.setAttribute('aria-expanded', !marker.classList.contains('is-collapsed')); };
        header.addEventListener('click', toggle);
        header.addEventListener('keydown', event => { if (event.target === header && [' ', 'Enter'].includes(event.key)) { event.preventDefault(); toggle(); } });
        marker.querySelector('.gpt-risk-marker__marked')?.addEventListener('click', event => event.stopPropagation());
        marker.querySelector('.file-risk-item__suppress-btn')?.addEventListener('click', event => {
          event.stopPropagation();
          this.requestIssueToggle(issue, event, marker);
        });
        this.updateAnnotationEntryState(marker);
        return marker;
      },
      annotationLocationLabel(annotation) {
        const anchor = annotation?.anchor || {};
        if (!anchor.startLine) return '文件级';
        const name = String(anchor.path || '').split('/').pop();
        return `${name}:${anchor.startLine}`;
      },
      createAnnotationCard(annotation) {
        const card = document.createElement('div');
        card.className = 'annotation-card';
        card.dataset.annotationId = annotation.annotationId;
        const context = P.annotations.findingContext(annotation);
        const actions = [];
        actions.push('<button type="button" class="annotation-card__action" data-action="copy">复制</button>');
        if (!this.annotationReadonly && P.annotations.isEditable(annotation.snapshotId)) {
          actions.push('<button type="button" class="annotation-card__action" data-action="edit">编辑</button>');
          actions.push('<button type="button" class="annotation-card__action" data-action="delete">删除</button>');
        }
        const location = this.annotationLocationLabel(annotation);
        card.innerHTML = `<div class="annotation-card__head"><span class="annotation-card__chip">${P.icons.commentPlus}批注</span><span class="annotation-card__location" title="${P.escape(annotation.anchor?.path || '')}:${annotation.anchor?.startLine || ''}">${P.escape(location)}</span><span class="annotation-card__actions">${actions.join('')}</span></div>`
          + (context ? `<p class="annotation-card__link">关于 ${P.escape(context.title)}${context.suppressed ? '（原问题已标记为非问题）' : ''}</p>` : '')
          + `<div class="annotation-card__text">${P.escape(annotation.text)}</div>`;
        card.querySelectorAll('.annotation-card__action').forEach(button => {
          button.addEventListener('click', event => {
            event.stopPropagation();
            const id = annotation.annotationId;
            if (button.dataset.action === 'copy') P.app?.copyAnnotationById(id);
            else if (button.dataset.action === 'edit') {
              if (this.isAnnotationEntryOpen({ annotationId: id })) P.app?.cancelAnnotationEditor();
              else P.app?.openAnnotationEditor({ annotationId: id });
            }
            else if (button.dataset.action === 'delete') P.app?.deleteAnnotationById(id);
          });
        });
        this.updateAnnotationEntryState(card);
        return card;
      },
      annotationRowAfter(row, cards) {
        const tr = document.createElement('tr');
        tr.className = 'decoration-row annotation-decoration';
        const td = document.createElement('td');
        td.colSpan = Math.max(1, row.children.length);
        td.className = 'decoration-cell annotation-decoration-cell';
        cards.forEach(card => td.append(card));
        tr.append(td);
        row.after(tr);
        return tr;
      },
      annotationFileLevelList() {
        let list = this.$refs.body?.querySelector('.focus-file-level-reviews');
        if (list) return list;
        list = document.createElement('div');
        list.className = 'gpt-risk-marker-list focus-file-level-reviews annotation-file-level';
        const wrapper = this.$refs.body?.querySelector('.d2h-file-wrapper');
        const header = wrapper?.querySelector('.d2h-file-header');
        if (header) header.after(list); else if (wrapper) wrapper.prepend(list); else this.$refs.body?.prepend(list);
        return list;
      },
      injectAnnotations() {
        const body = this.$refs.body;
        if (!body) return;
        body.querySelectorAll('.annotation-card [data-action="edit"]').forEach(button => P.tooltipDirective.unmounted(button));
        body.querySelectorAll('.annotation-holder, .annotation-decoration, .annotation-file-level').forEach(node => node.remove());
        const annotations = this.annotations || [];
        if (!annotations.length) { this.refreshAnnotationEditor(); return; }
        const lineCards = new Map();
        for (const annotation of annotations) {
          const card = this.createAnnotationCard(annotation);
          if (annotation.findingId) {
            const marker = body.querySelector(`.gpt-risk-marker[data-issue-key="${CSS.escape(annotation.findingId)}"]`);
            if (marker) {
              const holder = document.createElement('div');
              holder.className = 'annotation-holder';
              card.classList.add('annotation-card--inline');
              holder.append(card);
              (marker.querySelector('.gpt-risk-marker__content') || marker).append(holder);
              continue;
            }
          }
          const anchor = annotation.anchor || {};
          if (anchor.startLine) {
            const row = this.findLine(anchor.startLine, anchor.side);
            if (row) {
              if (!lineCards.has(row)) lineCards.set(row, []);
              lineCards.get(row).push(card);
              continue;
            }
          }
          this.annotationFileLevelList().append(card);
        }
        for (const [row, cards] of lineCards) {
          row.classList.add('annotation-anchored-line');
          this.annotationRowAfter(row, cards);
        }
        this.refreshAnnotationEditor();
      },
      injectAnnotationButtons() {
        const body = this.$refs.body;
        if (!body) return;
        body.querySelectorAll('.annotation-add-btn').forEach(button => button.remove());
        body.querySelectorAll('.annotation-anchor-cell').forEach(cell => cell.classList.remove('annotation-anchor-cell'));
        if (!this.annotationEnabled || this.readonly) return;
        const file = this.item.file || {};
        const addButton = (row, side, number) => {
          const facts = side === 'head'
            ? { hash: file.headSha256, count: file.headLineCount }
            : { hash: file.baseSha256, count: file.baseLineCount };
          if (!facts.hash || !Number.isInteger(facts.count) || number < 1 || number > facts.count) return;
          const marker = row.querySelector(side === 'head' ? '.line-num2' : '.line-num1')
            || row.querySelector('.d2h-code-side-linenumber.d2h-code-linenumber')
            || row.querySelector('.d2h-code-side-linenumber');
          const cell = marker?.closest('td') || row.querySelector('td');
          if (!cell) return;
          cell.classList.add('annotation-anchor-cell');
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'annotation-add-btn';
          button.innerHTML = P.icons.ask;
          button.setAttribute('aria-label', '在会话中追问此代码段');
          button.title = '在会话中追问此代码段';
          button.dataset.annotationSide = side;
          button.dataset.annotationLine = String(number);
          button.addEventListener('click', event => {
            event.stopPropagation();
            P.app?.askCodeHunkInSession(this.item, side, number);
          });
          cell.append(button);
        };
        if (this.outputFormat === 'side-by-side') {
          this.lineAnchors.forEach(({ row, number, side }) => addButton(row, side === 'right' ? 'head' : 'base', number));
          return;
        }
        const rows = new Set(this.lineAnchors.map(entry => entry.row));
        rows.forEach(row => {
          const right = Number(row.querySelector('.line-num2')?.textContent.trim());
          const left = Number(row.querySelector('.line-num1')?.textContent.trim());
          if (right > 0 && file.headSha256) addButton(row, 'head', right);
          else if (left > 0 && file.baseSha256) addButton(row, 'base', left);
        });
      },
      injectAnnotationEditor() {
        const body = this.$refs.body;
        const editor = this.annotationEditor;
        if (!body) return;
        body.querySelectorAll('.annotation-editor-holder').forEach(node => node.remove());
        if (!editor?.open) return;
        let target = null;
        if (editor.findingId) target = body.querySelector(`.gpt-risk-marker[data-issue-key="${CSS.escape(editor.findingId)}"]`);
        let holder = null;
        if (target) {
          holder = document.createElement('div');
          holder.className = 'annotation-editor-holder';
          (target.querySelector('.gpt-risk-marker__content') || target).append(holder);
        } else {
          const row = editor.line ? this.findLine(editor.line, editor.side) : null;
          if (row) {
            holder = this.annotationRowAfter(row, []);
            holder.classList.add('annotation-editor-holder');
          } else {
            holder = document.createElement('div');
            holder.className = 'annotation-editor-holder focus-file-level-reviews';
            this.annotationFileLevelList().append(holder);
          }
        }
        const box = document.createElement('div');
        box.className = 'annotation-editor' + (target ? ' annotation-editor--inline' : '');
        box.innerHTML = `<div class="annotation-editor__head"><b>${P.escape(editor.label || '批注')}</b>`
          + (editor.subtitle && !target ? `<span class="annotation-editor__subtitle">${P.escape(editor.subtitle)}</span>` : '')
          + '</div>'
          + '<textarea class="annotation-editor__input" rows="3" placeholder="写下修改要求或意见…"></textarea>'
          + '<p class="annotation-editor__error" role="alert"></p>'
          + `<div class="annotation-editor__actions"><span class="annotation-editor__count" aria-live="polite"></span><span class="annotation-editor__hint">${this.annotationShortcutHint}</span><button type="button" class="n-button annotation-editor__cancel">收起</button><button type="button" class="n-button annotation-editor__save">保存</button></div>`;
        holder.append(box);
        const input = box.querySelector('.annotation-editor__input');
        input.value = editor.text || '';
        let composing = false;
        const save = box.querySelector('.annotation-editor__save');
        const count = box.querySelector('.annotation-editor__count');
        const updateCount = () => {
          const length = P.codePointLength(input.value);
          count.textContent = `${length} / ${P.annotations.MAX_CODE_POINTS}`;
          count.classList.toggle('is-over', length > P.annotations.MAX_CODE_POINTS);
          save.disabled = !input.value.trim() || length > P.annotations.MAX_CODE_POINTS;
        };
        input.addEventListener('compositionstart', () => { composing = true; });
        input.addEventListener('compositionend', () => { composing = false; updateCount(); });
        input.addEventListener('input', () => { this.$emit('annotation-draft', input.value); updateCount(); });
        input.addEventListener('keydown', event => {
          if (composing || event.isComposing || event.keyCode === 229) return;
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.$emit('annotation-cancel'); }
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); if (!save.disabled) this.$emit('annotation-save'); }
        });
        box.querySelector('.annotation-editor__cancel')?.addEventListener('click', () => this.$emit('annotation-cancel'));
        save.addEventListener('click', () => { if (!save.disabled) this.$emit('annotation-save'); });
        updateCount();
        setTimeout(() => {
          if (!input.isConnected) return;
          input.focus({ preventScroll: true }); input.setSelectionRange(input.value.length, input.value.length);
          const available = body.getBoundingClientRect(), rect = input.getBoundingClientRect();
          if (rect.top < available.top || rect.bottom > available.bottom) input.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        }, 0);
      },
      suppressedMarkerLabel(issue, open) {
        const severity = issue.severity + (issue.severityName ? ' · ' + issue.severityName : '');
        return `已忽略 · ${issue.categoryLabel} ${severity} ${issue.title} · ${open ? '点击收起' : '点击查看，可撤销'}`;
      },
      updateSuppressedMarker(marker, issue, open) {
        const label = this.suppressedMarkerLabel(issue, open);
        marker.setAttribute('aria-expanded', String(open));
        marker.setAttribute('aria-label', label);
        marker.title = label;
        P.tooltipDirective.unmounted(marker);
        P.tooltipDirective.mounted(marker, { value: label });
      },
      openSuppressedCard(issue, host) {
        this.closeSuppressedCard(issue);
        const row = document.createElement('tr');
        row.className = 'decoration-row focus-suppressed-holder';
        row.dataset.issueKey = issue.issueKey;
        const cell = document.createElement('td');
        cell.colSpan = Math.max(1, host.children.length);
        cell.className = 'decoration-cell focus-suppressed-holder-cell';
        const card = this.createRiskMarkerElement(issue);
        cell.append(card);
        row.append(cell);
        host.after(row);
        this.markerRows.push(row);
      },
      closeSuppressedCard(issue) {
        this.$refs.body?.querySelectorAll(`.focus-suppressed-holder[data-issue-key="${CSS.escape(issue.issueKey)}"]`).forEach(row => row.remove());
      },
      toggleSuppressedMarker(issue, host, marker) {
        const open = !this.suppressedOpen[issue.issueKey];
        this.suppressedOpen[issue.issueKey] = open;
        this.updateSuppressedMarker(marker, issue, open);
        if (open) this.openSuppressedCard(issue, host); else this.closeSuppressedCard(issue);
      },
      injectSuppressedMarkers(suppressed, double) {
        const body = this.$refs.body;
        if (!body) return;
        const keys = new Set(suppressed.map(issue => issue.issueKey));
        Object.keys(this.suppressedOpen).forEach(key => { if (!keys.has(key)) delete this.suppressedOpen[key]; });
        if (suppressed.length) {
          const wrapper = body.querySelector('.d2h-file-wrapper');
          const fileHeader = wrapper?.querySelector('.d2h-file-header');
          const bar = document.createElement('div');
          bar.className = 'focus-file-level-reviews focus-file-suppressed-bar';
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'focus-file-suppressed-chip';
          const allOpen = suppressed.every(issue => Boolean(this.suppressedOpen[issue.issueKey]));
          chip.setAttribute('aria-expanded', String(allOpen));
          chip.innerHTML = P.icons.suppress + `<span>已标记非问题 (${suppressed.length})</span>`;
          P.tooltipDirective.mounted(chip, { value: allOpen ? '收起全部已忽略卡片' : '展开全部已忽略卡片' });
          chip.addEventListener('click', event => {
            event.stopPropagation();
            const next = !allOpen;
            suppressed.forEach(issue => { this.suppressedOpen[issue.issueKey] = next; });
            this.injectRiskMarkers();
          });
          bar.append(chip);
          if (fileHeader) fileHeader.after(bar); else if (wrapper) wrapper.prepend(bar); else body.prepend(bar);
        }
        suppressed.forEach(issue => {
          const host = this.findLine(issue.lineNumber, issue.side === 'base' ? 'left' : 'right');
          if (!host) return;
          const sideCell = host.querySelector(issue.side === 'base' ? '.line-num1' : '.line-num2')?.closest('td')
            || host.querySelector('.line-num2')?.closest('td')
            || host.querySelector('.d2h-code-side-linenumber')?.closest('td')
            || host.firstElementChild;
          if (!sideCell) return;
          sideCell.classList.add('focus-suppressed-cell');
          const marker = document.createElement('button');
          marker.type = 'button';
          marker.className = 'focus-suppressed-marker';
          marker.dataset.issueKey = issue.issueKey;
          marker.innerHTML = P.icons.suppress;
          this.updateSuppressedMarker(marker, issue, Boolean(this.suppressedOpen[issue.issueKey]));
          marker.addEventListener('click', event => {
            event.stopPropagation();
            this.toggleSuppressedMarker(issue, host, marker);
          });
          let slot = sideCell.querySelector('.focus-suppressed-slot');
          if (!slot) { slot = document.createElement('span'); slot.className = 'focus-suppressed-slot'; sideCell.append(slot); }
          slot.append(marker);
          if (this.suppressedOpen[issue.issueKey]) this.openSuppressedCard(issue, host);
        });
      },
      injectRiskMarkers() {
        if (!this.$refs.body) return;
        const compact = this.enhancements?.iconButtons;
        const scrollTop=this.enhancements?.linkLines || compact ? this.$refs.body.scrollTop : null;
        this.clearDecorations();
        if (!this.item.suggestion) return;
        const grouped = new Map();
        const suppressed = this.issues.filter(issue => issue.suppressed && !this.isFileLevelIssue(issue));
        this.issues.filter(issue => !issue.suppressed && !this.isFileLevelIssue(issue)).forEach(issue => {
          const host = this.findLine(issue.lineNumber, issue.side === 'base' ? 'left' : 'right');
          if (!grouped.has(host)) grouped.set(host, []);
          grouped.get(host).push(issue);
        });
        if (this.enhancements?.fileLevelReviews) { // O3c: a single full-width list before the first hunk in either diff layout.
          const fileIssues = this.issues.filter(issue => this.isFileLevelIssue(issue));
          if (fileIssues.length) {
            const list = document.createElement('div'); list.className = 'gpt-risk-marker-list focus-file-level-reviews';
            fileIssues.forEach(issue => list.append(this.createRiskMarkerElement(issue)));
            const wrapper = this.$refs.body.querySelector('.d2h-file-wrapper');
            const fileHeader = wrapper?.querySelector('.d2h-file-header');
            if (fileHeader) fileHeader.after(list); else if (wrapper) wrapper.prepend(list); else this.$refs.body.prepend(list);
          }
        }
        const double = this.outputFormat === 'side-by-side';
        const sides = [...this.$refs.body.querySelectorAll('.d2h-file-side-diff')];
        const baseRows = sides.map(side => [...side.querySelectorAll('tr')]);
        grouped.forEach((issues, host) => {
          if (!host) return;
          const visible = issues;
          if (!visible.length) return;
          const makeRow = (target, spacer) => {
            const row = document.createElement('tr');
            const colorClasses = ['d2h-del', 'd2h-ins', 'd2h-change', 'd2h-cntx', 'd2h-info', 'd2h-emptyplaceholder'].filter(name => target.querySelector('td')?.classList.contains(name));
            const types = new Set(visible.map(issue => issue.type));
            row.className = ['decoration-row', 'decoration-block', 'gpt-risk-decoration', `gpt-risk-decoration--${types.size > 1 ? 'mixed' : visible[0].type}`, ...colorClasses, ...(spacer ? ['gpt-risk-decoration--spacer'] : [])].join(' ');
            const cell = document.createElement('td'); cell.colSpan = 2; cell.className = ['decoration-cell', ...colorClasses].join(' ');
            // Inherit the actual GitLab row color, including changed-line yellow.
            cell.style.backgroundColor = getComputedStyle(target.firstElementChild).backgroundColor;
            row.append(cell);
            target.after(row); return { row, cell };
          };
          const actual = makeRow(host, false);
          const list = document.createElement('div'); list.className = 'gpt-risk-marker-list';
          visible.forEach(issue => list.append(this.createRiskMarkerElement(issue))); actual.cell.append(list);
          this.markerRows.push(actual.row);
          if (double) {
            const sideIndex = host.closest('.d2h-file-side-diff') === sides[1] ? 1 : 0;
            const peer = baseRows[1 - sideIndex][baseRows[sideIndex].indexOf(host)];
            if (peer) {
              const placeholder = makeRow(peer, true);
              placeholder.row.setAttribute('aria-hidden', 'true');
              const align = () => { placeholder.cell.style.height = `${actual.row.getBoundingClientRect().height}px`; };
              const observer = new ResizeObserver(align); observer.observe(list); this.observers.push(observer); align();
            }
          }
        });
        this.injectSuppressedMarkers(suppressed, double);
        if (scrollTop !== null) this.$refs.body.scrollTop=scrollTop;
        this.applyMarkEmphasis();
      },
      clearIssueHighlight() { // O2: each location replaces the previous temporary emphasis.
        this.highlightTimers.forEach(clearTimeout); this.highlightTimers=[];
        this.$refs.body?.querySelectorAll('.focus-defect-highlight,[class*="diff-line-highlight"]').forEach(node=>{
          [...node.classList].filter(name=>name==='focus-defect-highlight'||name.startsWith('diff-line-highlight')).forEach(name=>node.classList.remove(name));
        });
      },
      releaseSuppressionSpace() { // A14：显式定位后无需继续保留短 diff 的旧滚动范围。
        const wrapper = this.$refs.body?.querySelector('.d2h-wrapper');
        if (wrapper) wrapper.style.minHeight = '';
      },
      queueFirstIssue() { // O2: wait for fonts/layout while preventing stale callbacks on file changes.
        const generation=++this.locateGeneration;
        if (!this.enhancements?.linkLines) return;
        document.fonts.ready.then(()=>this.$nextTick(()=>{
          if (generation===this.locateGeneration && this.$refs.body?.clientHeight) this.locateFirstIssue();
        }));
      },
      locateFirstIssue() {
        if (!this.enhancements?.linkLines) return;
        this.releaseSuppressionSpace();
        if (this.activeIssues.length) this.locateIssue(this.activeIssues[0]);
        else { this.clearIssueHighlight(); this.$refs.body?.scrollTo({top:0,behavior:'smooth'}); }
      },
      scrollToFileTop() {
        this.locateGeneration++;
        this.clearIssueHighlight();
        this.releaseSuppressionSpace();
        this.$refs.body?.scrollTo({ top: 0, behavior: 'smooth' });
      },
      cancelAutoLocate() {
        this.locateGeneration++;
      },
      locateIssue(issue) {
        if (!this.enhancements?.linkLines) return false;
        this.locateGeneration++; // O2: explicit user navigation supersedes any pending initial location.
        this.clearIssueHighlight();
        return this.jumpToIssue(issue);
      },
      jumpToIssue(issue) {
        if (this.enhancements?.iconButtons) this.releaseSuppressionSpace();
        const fileLevel=this.enhancements?.linkLines && this.isFileLevelIssue(issue);
        const requestedSide = issue.side === 'base' ? 'left' : issue.side === 'head' ? 'right' : null;
        const row = !fileLevel && issue.lineNumber > 0
          ? this.findLine(issue.lineNumber, requestedSide)
          : this.enhancements?.linkLines && this.$refs.body?.querySelector(`.focus-file-level-card[data-issue-key="${CSS.escape(issue.issueKey)}"]`);
        if (!row) return false;
        const body = this.$refs.body;
        const offset=this.enhancements?.linkLines ? body.clientHeight/3 : 48; // O2: retain context above the issue; opt=none preserves baseline.
        const card = row.closest('.gpt-risk-marker') || row;
        const cardHeight = card.getBoundingClientRect().height;
        const tallCard = cardHeight > body.clientHeight * 0.72;
        const top = Math.max(0, body.scrollTop + row.getBoundingClientRect().top - body.getBoundingClientRect().top - offset);
        body.scrollTo({ top, behavior: tallCard ? 'auto' : 'smooth' });
        if (tallCard) { // A tall card cannot show its evidence with a top-aligned jump; keep the evidence in view.
          const overflow = card.getBoundingClientRect().bottom - body.getBoundingClientRect().bottom + 8;
          if (overflow > 0) body.scrollTop += overflow;
        }
        this.highlightIssueTarget(row, issue, fileLevel);
        return true;
      },
      highlightIssueTarget(row, issue, fileLevel) { // A13/S2: one existing highlighter for O2 and the file's suppressed-review entry.
        if (fileLevel) {
          row.classList.add('focus-defect-highlight');
          this.highlightTimers.push(setTimeout(()=>row.classList.remove('focus-defect-highlight'),2400)); return;
        }
        const code = row.querySelector('.d2h-code-line,.d2h-code-side-line') || row;
        const rowClasses = ['diff-line-highlight-row', `diff-line-highlight-row--${issue.type}`];
        const codeClasses = ['diff-line-highlight', `diff-line-highlight--${issue.type}`];
        row.classList.add(...rowClasses); code.classList.add(...codeClasses);
        this.highlightTimers.push(setTimeout(() => { row.classList.remove(...rowClasses); code.classList.remove(...codeClasses); }, 2400));
      },
      // O4: copy only selected code spans, preserving genuine code +/- and indentation.
      handleDiffCopy(event) {
        if (!this.enhancements?.copyAll || !event.clipboardData) return;
        const selection = window.getSelection();
        if (!selection?.rangeCount || selection.isCollapsed) return;
        const body = this.$refs.body, range = selection.getRangeAt(0);
        if (!body.contains(range.startContainer) || !body.contains(range.endContainer)) return;
        const lines = [];
        body.querySelectorAll('.d2h-code-line-ctn').forEach(code => {
          if (code.closest('.d2h-info') || !range.intersectsNode(code)) return;
          const selected = document.createRange(); selected.selectNodeContents(code);
          if (code.contains(range.startContainer)) selected.setStart(range.startContainer, range.startOffset);
          if (code.contains(range.endContainer)) selected.setEnd(range.endContainer, range.endOffset);
          lines.push(selected.toString());
        });
        if (lines.length) { event.clipboardData.setData('text/plain', lines.join('\n')); event.preventDefault(); }
      },
    },
    template: `
      <div class="code-review-lite" :class="'code-review-lite--'+outputFormat">
        <div class="code-review-lite__header">
          <span class="code-review-lite__badge" :class="'code-review-lite__badge--'+badgeClass">{{badge}}</span>
          <div class="code-review-lite__head-main">
            <button ref="fileNameLink" type="button" class="code-review-lite__file-name code-review-lite__file-name--clickable" :title="enhancements?.iconButtons ? undefined : item.path" :aria-label="enhancements?.iconButtons ? (isFileNameTruncated ? item.path + '（在编辑器中打开）' : '在编辑器中打开') : undefined" v-tip="enhancements?.iconButtons ? fileNameTip : undefined" @click="recordFileLink">{{item.path}}</button>
            <div class="code-review-lite__stats" v-if="origin.diff !== ''">
              <span class="code-review-lite__stat code-review-lite__stat--add">+{{changeStats.added}}</span>
              <span class="code-review-lite__stat code-review-lite__stat--del">-{{changeStats.deleted}}</span>
            </div>
          </div>
          <div class="code-review-lite__head-extra">
            <slot name="file-navigation"></slot>
            <button v-if="item.suggestion" type="button" class="review-toggle-btn" :title="enhancements?.iconButtons ? undefined : (reportOpen ? '收起文件说明' : '查看文件说明')" @click="$emit('toggle-report')">
              <span class="review-toggle-btn__icon" v-html="reportOpen ? icons.closeReport : icons.report">
              </span>
              <span>{{reportOpen ? '收起说明' : '查看说明'}}</span>
            </button>
            <button v-else-if="enhancements?.iconButtons && canReview" type="button" class="review-toggle-btn focus-code-review-btn" :disabled="reviewLoading" @click="$emit('code-review')">
              <span v-if="reviewLoading" class="loading-spinner"></span>
              <span v-else class="review-toggle-btn__icon" v-html="icons.code"></span>
              <span>{{reviewLoading ? '审查中…' : '审查本文件'}}</span>
            </button>
          </div>
        </div>
        <div v-if="origin.diff === ''" class="experience-diff-empty" role="status">{{ emptyMessage }}</div>
        <div ref="body" class="code-review-lite__body">
        </div>
      </div>
    `,
  };
})();
