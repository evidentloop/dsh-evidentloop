/* Shared prototype utilities. No network, no storage outside this tab. */
(function () {
  'use strict';
  const P = window.CRPrototype = window.CRPrototype || {};
  P.escape = text => String(text ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[x]);
  P.inlineMarkdown = text => P.escape(text).replace(/`([^`]+)`/g, '<code>$1</code>');
  P.normalizeNewlines = text => String(text ?? '').replace(/\r\n/g, '\n');
  P.codePointLength = text => Array.from(P.normalizeNewlines(text)).length;

  const svg = (content, size = 16) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${content}</svg>`;
  P.icons = {
    chevron: svg('<polyline points="6 9 12 15 18 9"/>'),
    back: svg('<path d="M15 5l-7 7 7 7"/>'),
    mark: svg('<circle cx="12" cy="12" r="9"/><path d="M9 12h6"/>'),
    suppress: svg('<circle cx="12" cy="12" r="9"/><line x1="8" y1="12" x2="16" y2="12"/>', 14),
    ask: svg('<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/><path d="M19 4v4"/><path d="M22 5h-4"/>', 12),
    comment: svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>', 14),
    commentPlus: svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 8v6"/><path d="M9 11h6"/>', 14),
    restore: svg('<path d="M12.5 6a6 6 0 1 1-3 11"/><path d="M11.4 4.6 8.6 6.3 10.4 8z" fill="currentColor" stroke="none"/>'),
    report: svg('<path d="M4 19h16M4 5h16"/><rect x="8" y="9" width="8" height="6" rx="1"/>'),
    closeReport: svg('<path d="M20 12H4M14 18l6-6-6-6"/>'),
    note: svg('<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5"/><path d="M10 12h6M10 16h6"/>'),
    download: svg('<path d="M12 4v11"/><path d="m8 11 4 4 4-4"/><path d="M5 20h14"/>'),
    settings: svg('<circle cx="12" cy="12" r="2.8"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.08a1.7 1.7 0 0 0-1.1-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.08a1.7 1.7 0 0 0 1.56-1.1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.08a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.08a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.08a1.7 1.7 0 0 0-1.52 1z"/>'),
    fullscreen: svg('<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>'),
    search: svg('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>'),
    check: svg('<circle cx="12" cy="12" r="8.5"/><path d="m8 12 2.7 2.7L16 9.5"/>'),
    warn: svg('<path d="M12 3.5 22 20H2z"/><path d="M12 9v5M12 17.2v.1"/>'),
    skip: svg('<circle cx="12" cy="12" r="8.5"/><path d="m6.5 6.5 11 11"/>'),
    close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    folder: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
    chat: svg('<path d="M4 5h16v11H9l-5 4z"/>'),
    plug: svg('<path d="M9 3v5M15 3v5M7 8h10v3a5 5 0 0 1-10 0zM12 16v5"/>'),
    auto: svg('<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="m18.5 15 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>'),
    layers: svg('<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 16 9 5 9-5"/>'),
    more: svg('<circle cx="5.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.2" fill="currentColor" stroke="none"/>'),
    dots: svg('<circle cx="5.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.2" fill="currentColor" stroke="none"/>'),
    send: svg('<path d="M12 19V5M6 11l6-6 6 6"/>'),
    panel: svg('<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M15 4.5v15"/>'),
    splitSingle: svg('<rect x="3.5" y="4.5" width="17" height="15" rx="2"/>'),
    splitDouble: svg('<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M12 4.5v15"/>'),
    doc: svg('<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5"/>'),
    code: svg('<path d="m8.5 8-4 4 4 4M15.5 8l4 4-4 4"/>'),
    history: svg('<path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v5h5"/><path d="M12 8v4l3 2"/>'),
    pin: svg('<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 1 0-4H8a2 2 0 0 1 0 4h1z"/>'),
    edit: svg('<path d="M4 20h4l11-11-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'),
    pinUp: svg('<path d="M5 4h14M12 20V8M7 13l5-5 5 5"/>', 14),
    gridView: svg('<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>'),
    compactView: svg('<path d="M8 5h12M8 12h12M8 19h12M4 5h.01M4 12h.01M4 19h.01"/>'),
    arrowDown: svg('<path d="M12 4v16M6 14l6 6 6-6"/>'),
    arrowRight: svg('<path d="M4 12h16M14 6l6 6-6 6"/>'),
    copy: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M14 1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-3v3a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h3V2a1 1 0 0 1 1-1h8ZM10 6H2v8h8V6ZM9 11v1H3v-1h6Zm5-9H6v3h4a1 1 0 0 1 1 1v4h3V2ZM9 8v1H3V8h6Z"/></svg>',
    shield: svg('<path d="M12 3.5 19 6v5.2c0 4.1-2.7 7.8-7 9.3-4.3-1.5-7-5.2-7-9.3V6z"/><path d="m9.2 12 2 2 3.6-3.8"/>'),
    evidentloopLine: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="m9 8.5-2 2.5 2 2.5M13 8.5l2 2.5-2 2.5"/></svg>',
  };

  P.updateTruncatedTitle = (event, text, stateTip = '') => {
    const element = event.currentTarget;
    const label = element.querySelector('[data-truncate]') || element;
    const truncated = getComputedStyle(label).display === 'none' || label.clientWidth === 0 || label.scrollWidth > label.clientWidth + 1;
    element.title = truncated ? [text, stateTip].filter(Boolean).join(' · ') : stateTip;
  };

  P.basisLabel = { fact: '代码事实', model: '模型推断', verified: '代码事实' };
  P.normalizeBasis = basis => basis === 'model' ? 'model' : (basis === 'fact' || basis === 'verified' ? 'fact' : '');
  P.basisClass = basis => 'basis-tag--' + (P.normalizeBasis(basis) || 'model');
  P.formatBasis = basis => P.basisLabel[basis] || '模型推断';

  P.sendBack = Vue.reactive({
    writes: 0, copies: 0, sends: 0, modelCalls: 0,
    lockedSnapshotId: '', lockedContent: '', lockedTemplate: '',
    lockedSessionId: '', lockedProjectKey: '', lockedDeliveryId: '',
  });

  P.ui = Vue.reactive({ tooltip: null, confirm: null, message: '' });
  let tipTimer, messageTimer, tipAnchor, floatingFrame;
  P.hideTip = function () { clearTimeout(tipTimer); P.ui.tooltip = null; tipAnchor = null; };
  P.hideTipWithin = function (root) { if (tipAnchor && root?.contains(tipAnchor)) P.hideTip(); };
  P.floatingBounds = function () {
    const rect = (document.querySelector('.evidentloop-review-surface') || document.querySelector('.dsh-app'))?.getBoundingClientRect();
    return {
      left: Math.max(0, rect?.left || 0) + 8, right: Math.min(innerWidth, rect?.right ?? innerWidth) - 8,
      top: Math.max(0, rect?.top || 0) + 8, bottom: Math.min(innerHeight, rect?.bottom ?? innerHeight) - 8,
    };
  };
  function placeFloating(node, anchor, { below = false, alignRight = false, card = false } = {}) {
    if (!node || !P.app?.anyOptimizationEnabled) return;
    const bounds = P.floatingBounds(), rect = anchor?.getBoundingClientRect();
    if (card) {
      const cardRect = anchor?.closest('.gpt-risk-marker')?.getBoundingClientRect();
      if (cardRect) { bounds.left = Math.max(bounds.left, cardRect.left + 8); bounds.right = Math.min(bounds.right, cardRect.right - 8); }
    }
    const clamp = (value, min, max) => Math.max(min, Math.min(Math.max(min, max), value));
    node.style.maxWidth = Math.max(0, bounds.right - bounds.left) + 'px';
    node.style.maxHeight = Math.max(0, bounds.bottom - bounds.top) + 'px';
    const size = node.getBoundingClientRect();
    let x = rect ? (alignRight ? rect.right - size.width : rect.left + (rect.width - size.width) / 2) : (bounds.left + bounds.right - size.width) / 2;
    let y = rect ? (below ? rect.bottom + 9 : rect.top - 9 - size.height) : bounds.top;
    if (rect && !below && y < bounds.top && rect.bottom + 9 + size.height <= bounds.bottom) { below = true; y = rect.bottom + 9; }
    else if (rect && below && y + size.height > bounds.bottom && rect.top - 9 - size.height >= bounds.top) { below = false; y = rect.top - 9 - size.height; }
    x = clamp(x, bounds.left, bounds.right - size.width); y = clamp(y, bounds.top, bounds.bottom - size.height);
    node.style.left = x + 'px'; node.style.top = y + 'px'; node.dataset.placement = below ? 'bottom' : 'top';
    const arrow = node.querySelector('.popover-arrow');
    if (arrow && rect) arrow.style.left = clamp(rect.left + rect.width / 2 - x - 4, 10, size.width - 18) + 'px';
  }
  P.refreshFloating = function () {
    if (!P.app?.anyOptimizationEnabled) return;
    if (P.ui.tooltip) placeFloating(document.querySelector('[role="tooltip"]'), tipAnchor, { alignRight: !!P.ui.tooltip.alignRight, card: !!P.ui.tooltip.card });
    if (P.ui.confirm) placeFloating(document.querySelector('.n-popconfirm'), P.ui.confirm.anchor, { alignRight: true });
    if (P.ui.message) placeFloating(document.querySelector('.n-message'));
  };
  const scheduleFloating = () => {
    if (floatingFrame || !P.app?.anyOptimizationEnabled || !(P.ui.tooltip || P.ui.confirm || P.ui.message)) return;
    floatingFrame = requestAnimationFrame(() => { floatingFrame = null; P.refreshFloating(); });
  };
  window.addEventListener('resize', scheduleFloating);
  document.addEventListener('scroll', scheduleFloating, true);
  P.message = function (text) {
    clearTimeout(messageTimer); P.ui.message = text;
    messageTimer = setTimeout(() => { P.ui.message = ''; }, 3200);
  };
  P.tooltipDirective = {
    mounted(element, binding) {
      element._tip = binding.value;
      element._showTip = () => {
        clearTimeout(tipTimer);
        tipTimer = setTimeout(() => {
          const rect = element.getBoundingClientRect();
          if (!element.isConnected || !element._tip) return;
          const options = typeof element._tip === 'object' ? element._tip : { html: element._tip };
          const isMultiline = String(options.html).includes('<br>') || String(options.html).includes('<div') || !!options.multiline;
          const isCard = !!options.card || !!element.closest('.gpt-risk-marker');
          tipAnchor = element;
          P.ui.tooltip = {
            html: options.html, x: rect.left + rect.width / 2, y: rect.top - 9,
            singleLine: !isMultiline, multiline: isMultiline, card: isCard,
            alignRight: isCard || !!options.alignRight,
          };
          Vue.nextTick(P.refreshFloating);
        }, 300);
      };
      element.addEventListener('mouseenter', element._showTip);
      element.addEventListener('mouseleave', P.hideTip);
      element.addEventListener('focusin', element._showTip);
      element.addEventListener('focusout', P.hideTip);
    },
    updated(element, binding) { element._tip = binding.value; },
    unmounted(element) {
      element.removeEventListener('mouseenter', element._showTip);
      element.removeEventListener('mouseleave', P.hideTip);
      element.removeEventListener('focusin', element._showTip);
      element.removeEventListener('focusout', P.hideTip);
      if (tipAnchor === element) P.hideTip();
    },
  };
  P.copyText = async function (text, message) {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const area = document.createElement('textarea'); area.value = text;
        area.style.cssText = 'position:fixed;left:-9999px'; document.body.append(area); area.select();
        const success = document.execCommand('copy'); area.remove();
        if (!success) throw new Error('Clipboard unavailable');
      }
      P.message(message);
    } catch { P.message('复制失败，请手动复制'); }
  };
  const SAFE_HREF = /^(?:https?:\/\/|mailto:|#)/i;
  const safeHref = raw => {
    const value = String(raw ?? '').trim();
    return SAFE_HREF.test(value.replace(/[\u0000-\u0020]+/g, '')) ? value : '';
  };
  const BLOCKED_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'link', 'meta', 'base']);
  P.sanitizeHtml = function (html) {
    const template = document.createElement('template');
    template.innerHTML = String(html ?? '');
    for (const element of [...template.content.querySelectorAll('*')]) {
      if (BLOCKED_TAGS.has(element.tagName.toLowerCase())) { element.remove(); continue; }
      for (const attribute of [...element.attributes]) {
        const name = attribute.name.toLowerCase();
        const value = attribute.value;
        if (name.startsWith('on') || ['style', 'srcdoc', 'formaction', 'action', 'poster', 'background'].includes(name)) {
          element.removeAttribute(attribute.name); continue;
        }
        if (['href', 'src', 'xlink:href'].includes(name) && !(name === 'href' && safeHref(value))) {
          element.removeAttribute(attribute.name);
        }
      }
    }
    return template.innerHTML;
  };
  P.convertToMarkdown = function (text, options = {}) {
    if (!text) return '';
    const renderer = new marked.Renderer();
    let noCopy = false;
    const update = text => {
      if (text.includes('待改进代码')) noCopy = true;
      else if (text.includes('改进建议')) noCopy = false;
    };
    renderer.heading = (text, level) => { noCopy = false; update(text); return `<h${level}>${text}</h${level}>`; };
    renderer.paragraph = text => { update(text); return `<p>${text}</p>`; };
    renderer.listitem = text => { update(text); return `<li>${text}</li>`; };
    renderer.html = P.escape;
    renderer.image = (_href, _title, alt) => P.escape(alt || '');
    renderer.link = (href, title, text) => {
      const safe = safeHref(href);
      if (!safe) return text;
      const titleAttr = title ? ` title="${P.escape(title)}"` : '';
      const external = /^https?:\/\//i.test(safe) ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<a href="${P.escape(safe)}"${titleAttr}${external}>${text}</a>`;
    };
    renderer.code = (code, language) => {
      const rawLanguage = String(language || '');
      const evidence = rawLanguage.match(/^evidence:(\d+)-(\d+)$/);
      if (evidence) {
        const start = evidence[1], end = evidence[2];
        const range = start === end ? `第 ${start} 行` : `第 ${start}–${end} 行`;
        const copyButton = options.iconButtons
          ? `<button class="gpt-code-copy-btn focus-icon-button" type="button" aria-label="复制代码">${P.icons.copy}</button>`
          : `<button class="gpt-code-copy-btn" type="button" title="复制代码">${P.icons.copy}</button>`;
        return `<div class="gpt-code-block gpt-evidence-block"><div class="gpt-evidence-tools"><span class="gpt-evidence-range">${range}</span>${copyButton}</div><pre><code class="hljs">${P.escape(code)}</code></pre><span class="gpt-evidence-fade" aria-hidden="true"></span></div>`;
      }
      const lang = language === 'ets' ? 'typescript' : rawLanguage.split(/\s/)[0];
      const content = hljs.getLanguage(lang) ? hljs.highlight(code, { language: lang }).value : P.escape(code);
      const disableCopy = noCopy && !options.copyAll;
      return `<div class="gpt-code-block${disableCopy ? ' gpt-code-block--no-copy' : ''}">${disableCopy ? '' : `<button class="gpt-code-copy-btn${options.iconButtons ? ' focus-icon-button' : ''}" type="button"${options.iconButtons ? ' aria-label="复制代码"' : ' title="复制代码"'}>${P.icons.copy}</button>`}<pre><code class="hljs ${P.escape(lang)}">${content}</code></pre></div>`;
    };
    const rendered = marked.parse(text, { renderer });
    const sanitized = P.sanitizeHtml(rendered);
    return options.linkLines ? P.linkifyLineReferences(sanitized, options.fileKey, options.lineNumbers) : sanitized;
  };
  const handleDynamicTooltip = event => {
    const copyButton = event.target.closest?.('.gpt-code-copy-btn');
    if (copyButton && P.app?.anyOptimizationEnabled && !copyButton._tip) {
      P.tooltipDirective.mounted(copyButton, { value: '复制代码' });
      copyButton._showTip();
    }
  };
  document.addEventListener('mouseenter', handleDynamicTooltip, true);
  document.addEventListener('focusin', handleDynamicTooltip, true);
  // Evidence fade: only while the code actually overflows and is not scrolled to the end.
  const updateEvidenceFade = block => {
    const pre = block?.querySelector?.(':scope > pre');
    if (!pre) return;
    const overflow = pre.scrollWidth - pre.clientWidth;
    const atEnd = pre.scrollLeft >= overflow - 1;
    block.classList.toggle('is-fade-right', overflow > 1 && !atEnd);
  };
  const updateAllEvidenceFades = () => {
    document.querySelectorAll('.gpt-evidence-block').forEach(updateEvidenceFade);
  };
  let evidenceFadeFrame = 0;
  const scheduleEvidenceFades = () => {
    if (evidenceFadeFrame) return;
    evidenceFadeFrame = requestAnimationFrame(() => { evidenceFadeFrame = 0; updateAllEvidenceFades(); });
  };
  document.addEventListener('scroll', event => {
    const block = event.target.closest?.('.gpt-evidence-block');
    if (block) updateEvidenceFade(block);
  }, true);
  window.addEventListener('resize', scheduleEvidenceFades);
  new MutationObserver(scheduleEvidenceFades).observe(document.documentElement, { childList: true, subtree: true });
  scheduleEvidenceFades();
  document.addEventListener('click', event => {
    const copyButton = event.target.closest('.gpt-code-copy-btn');
    if (copyButton) {
      event.preventDefault(); event.stopPropagation();
      P.copyText(copyButton.closest('.gpt-code-block').querySelector('code').textContent.trimEnd(), '已复制代码块');
    }
    if (P.ui.confirm && !event.target.closest('.n-popconfirm,.file-risk-item__suppress-btn')) P.ui.confirm = null;
  });
  document.addEventListener('keydown', event => { if (event.isComposing || event.keyCode === 229 || P.app?.extensionComposing) return; if (event.key === 'Escape') { P.ui.confirm = null; P.hideTip(); } });

  // ISO timestamp with the local timezone offset, matching the snapshot contract.
  P.nowIso = function (date = new Date()) {
    const pad = value => String(value).padStart(2, '0');
    const offset = -date.getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const abs = Math.abs(offset);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
  };
  P.formatClock = iso => {
    if (!iso) return '—';
    const match = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    return match ? `${match[2]}-${match[3]} ${match[4]}:${match[5]}` : String(iso);
  };
  P.formatDate = iso => {
    if (!iso) return '—';
    const match = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[1]}-${match[2]}-${match[3]}` : String(iso);
  };
  P.formatRelative = iso => {
    const time = Date.parse(iso);
    if (!Number.isFinite(time)) return '—';
    const minutes = Math.max(0, Math.round((Date.now() - time) / 60000));
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.round(hours / 24);
    if (days < 30) return `${days} 天前`;
    return P.formatDate(iso);
  };

  // Compact SHA-256 for prototype-local identities. Crypto.subtle is unavailable on some file:// contexts.
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const rotr = (value, bits) => (value >>> bits) | (value << (32 - bits));
  P.sha256 = function (text) {
    const bytes = new TextEncoder().encode(String(text));
    const length = bytes.length;
    const padded = new Uint8Array((((length + 9) + 63) >> 6) << 6);
    padded.set(bytes); padded[length] = 0x80;
    const view = new DataView(padded.buffer);
    view.setUint32(padded.length - 8, Math.floor(length * 8 / 0x100000000));
    view.setUint32(padded.length - 4, (length * 8) >>> 0);
    let H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const w = new Uint32Array(64);
    for (let offset = 0; offset < padded.length; offset += 64) {
      for (let t = 0; t < 16; t++) w[t] = view.getUint32(offset + t * 4);
      for (let t = 16; t < 64; t++) {
        const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let t = 0; t < 64; t++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + S1 + ch + K[t] + w[t]) >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
      }
      H = [H[0] + a, H[1] + b, H[2] + c, H[3] + d, H[4] + e, H[5] + f, H[6] + g, H[7] + h].map(value => value >>> 0);
    }
    return H.map(value => value.toString(16).padStart(8, '0')).join('');
  };
})();
