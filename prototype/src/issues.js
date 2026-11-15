/* Structured findings -> the prototype's existing issue-card model. */
(function () {
  'use strict';
  const P = window.CRPrototype = window.CRPrototype || {};
  const CATEGORIES = {
    logic: { type: 'logic', label: '逻辑' },
    security: { type: 'logic', label: '安全' },
    performance: { type: 'performance', label: '性能' },
  };
  const SEVERITY_RANK = { P0: 0, P1: 1, P2: 2 };
  const SEVERITY_LABEL = { P0: '阻断', P1: '严重', P2: '一般' };

  function rangeLabel(evidence) {
    if (!evidence) return '';
    const start = evidence.startLine, end = evidence.endLine;
    if (!start) return evidence.path;
    return `${evidence.path}:${start}${end && end !== start ? '–' + end : ''}`;
  }

  function dedent(text) {
    const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
    const widths = lines.filter(line => line.trim()).map(line => line.match(/^[ \t]*/)[0].length);
    if (!widths.length) return String(text || '');
    const common = Math.min(...widths);
    if (!common) return lines.join('\n');
    return lines.map(line => line.trim() ? line.slice(common) : '').join('\n');
  }

  function narrativeOf(finding) {
    const problem = String(finding?.problem || '').trim();
    const impact = String(finding?.impact || '').trim();
    if (!problem) return impact;
    if (!impact) return problem;
    return `${problem.replace(/[。．.!！?？;；,\s]+$/u, '')}；${impact}`;
  }

  function renderFinding(finding) {
    const lines = [];
    const narrative = narrativeOf(finding);
    if (narrative) lines.push(narrative);
    if (finding.suggestion?.text || finding.suggestion?.code) {
      if (lines.length) lines.push('');
      if (finding.suggestion.text) lines.push(`**💡 建议方案：** ${finding.suggestion.text}`);
      else lines.push('**💡 建议方案：**');
      if (finding.suggestion.code) {
        lines.push('');
        lines.push('~~~');
        lines.push(dedent(finding.suggestion.code));
        lines.push('~~~');
      }
    }
    return lines.join('\n');
  }

  function effectiveFindings(item) {
    let overrides = item?.issue_overrides || {};
    if (typeof overrides === 'string') { try { overrides = JSON.parse(overrides); } catch { overrides = {}; } }
    return (item?.findings || []).map(finding => {
      const override = overrides[finding.findingId];
      const hasOverride = Boolean(override) && Object.prototype.hasOwnProperty.call(override, 'suppressed');
      return {
        ...finding,
        suppressed: hasOverride ? [true, 1, '1', 'true'].includes(override.suppressed) : Boolean(finding.suppressed),
        override: override || null,
      };
    });
  }

  function parseIssues(item) {
    const issues = effectiveFindings(item).map((finding, index) => {
      const category = CATEGORIES[finding.category] || CATEGORIES.logic;
      const severity = finding.severity || 'P2';
      const suppressed = Boolean(finding.suppressed);
      const lineNumber = finding.anchor?.line || 0;
      return {
        type: category.type,
        typeLabel: `${category.label} · ${severity}`,
        categoryLabel: category.label,
        severityName: SEVERITY_LABEL[severity] || '',
        severityClass: 'P' + severity.replace(/^P/, ''),
        order: index + 1,
        displayOrder: index + 1,
        title: finding.title,
        side: finding.anchor?.side || 'head',
        issueKey: finding.findingId,
        markdown: renderFinding(finding),
        narrative: narrativeOf(finding),
        textSuggestion: String(finding.suggestion?.text || '').trim(),
        codeSuggestion: finding.suggestion?.code ? dedent(finding.suggestion.code) : '',
        summary: finding.problem || finding.impact || finding.title,
        brief: finding.title,
        lineNumber,
        lineEnd: finding.evidence?.[0]?.endLine,
        category: finding.category,
        severity,
        carriedFrom: finding.carriedFrom,
        carriedFromLabel: item.carriedFromLabel || '',
        finding,
        fileKey: item.md5_str,
        suppressed,
      };
    });
    return issues.sort((a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      (a.lineNumber || Number.MAX_SAFE_INTEGER) - (b.lineNumber || Number.MAX_SAFE_INTEGER) ||
      a.displayOrder - b.displayOrder);
  }

  P.issues = { parseIssues, effectiveFindings, renderFinding, narrativeOf, rangeLabel, CATEGORIES, SEVERITY_RANK, SEVERITY_LABEL };
})();
