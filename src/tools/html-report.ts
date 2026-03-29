import type {
  FullReviewResult,
  AccessibilityViolation,
  CodeFinding,
  Severity,
  PerformanceMetrics,
  SectionGradeReport,
} from "../types.js";

// ── Constants ─────────────────────────────────────────────────────

const SEVERITY_COLORS: Readonly<Record<Severity, string>> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
};

const IMPACT_TO_SEVERITY: Readonly<Record<string, Severity>> = {
  critical: "critical",
  serious: "high",
  moderate: "medium",
  minor: "low",
};

interface MetricThreshold {
  readonly good: number;
  readonly needsImprovement: number;
}

const METRIC_THRESHOLDS: Readonly<Record<string, MetricThreshold>> = {
  firstContentfulPaint: { good: 1800, needsImprovement: 3000 },
  largestContentfulPaint: { good: 2500, needsImprovement: 4000 },
  cumulativeLayoutShift: { good: 0.1, needsImprovement: 0.25 },
  totalBlockingTime: { good: 200, needsImprovement: 600 },
  loadTime: { good: 2000, needsImprovement: 4000 },
  domContentLoaded: { good: 1500, needsImprovement: 3000 },
};

// ── Helpers ───────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getRatingColor(metric: string, value: number): string {
  const threshold = METRIC_THRESHOLDS[metric];
  if (!threshold) return "#94a3b8";
  if (value <= threshold.good) return "#22c55e";
  if (value <= threshold.needsImprovement) return "#eab308";
  return "#ef4444";
}

function getRatingLabel(metric: string, value: number): string {
  const threshold = METRIC_THRESHOLDS[metric];
  if (!threshold) return "N/A";
  if (value <= threshold.good) return "Good";
  if (value <= threshold.needsImprovement) return "Needs Improvement";
  return "Poor";
}

function formatMs(value: number | null): string {
  if (value === null) return "N/A";
  return `${Math.round(value)}ms`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function countBySeverity(
  findings: readonly CodeFinding[]
): Readonly<Record<Severity, number>> {
  const counts: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const finding of findings) {
    counts[finding.severity]++;
  }
  return counts;
}

// ── CSS ───────────────────────────────────────────────────────────

function generateStyles(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #0a0e1a;
      color: #e2e8f0;
      line-height: 1.6;
      min-height: 100vh;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 24px;
    }

    /* ── Header ─────────────────────────────── */
    .header {
      text-align: center;
      margin-bottom: 48px;
      padding-bottom: 32px;
      border-bottom: 1px solid #1e293b;
    }

    .logo {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin-bottom: 8px;
    }

    .logo-ui { color: #e2e8f0; }
    .logo-max { color: #f59e0b; }

    .header-subtitle {
      color: #94a3b8;
      font-size: 14px;
      margin-bottom: 16px;
    }

    .header-meta {
      display: flex;
      justify-content: center;
      gap: 24px;
      flex-wrap: wrap;
      font-size: 13px;
      color: #64748b;
    }

    .header-meta a {
      color: #60a5fa;
      text-decoration: none;
    }

    .header-meta a:hover { text-decoration: underline; }

    /* ── Summary Cards ──────────────────────── */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 48px;
    }

    .summary-card {
      background: #111827;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
    }

    .summary-card-value {
      font-size: 36px;
      font-weight: 700;
      line-height: 1.2;
    }

    .summary-card-label {
      font-size: 13px;
      color: #94a3b8;
      margin-top: 4px;
    }

    /* ── Sections ───────────────────────────── */
    .section {
      margin-bottom: 48px;
    }

    .section-title {
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 2px solid #f59e0b;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .section-title-icon {
      font-size: 20px;
      width: 24px;
      text-align: center;
    }

    /* ── Screenshot ─────────────────────────── */
    .screenshot-wrapper {
      border: 1px solid #1e293b;
      border-radius: 12px;
      overflow: hidden;
      background: #111827;
    }

    .screenshot-wrapper img {
      width: 100%;
      height: auto;
      display: block;
    }

    /* ── Severity Badge ─────────────────────── */
    .badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0a0e1a;
    }

    .badge-critical { background: #ef4444; }
    .badge-high { background: #f97316; }
    .badge-medium { background: #eab308; }
    .badge-low { background: #3b82f6; color: #e2e8f0; }

    /* ── Accessibility ──────────────────────── */
    .violation-card {
      background: #111827;
      border: 1px solid #1e293b;
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 12px;
    }

    .violation-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 8px;
      flex-wrap: wrap;
    }

    .violation-id {
      font-weight: 600;
      color: #f1f5f9;
      font-size: 15px;
    }

    .violation-desc {
      color: #94a3b8;
      font-size: 14px;
      margin-bottom: 12px;
    }

    .violation-nodes {
      font-size: 13px;
      color: #64748b;
    }

    .violation-node {
      margin-bottom: 8px;
      padding: 8px 12px;
      background: #0a0e1a;
      border-radius: 6px;
      font-family: 'SF Mono', Menlo, Consolas, monospace;
      font-size: 12px;
      overflow-x: auto;
    }

    .violation-link {
      display: inline-block;
      margin-top: 8px;
      color: #60a5fa;
      font-size: 13px;
      text-decoration: none;
    }

    .violation-link:hover { text-decoration: underline; }

    /* ── Performance ────────────────────────── */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 16px;
    }

    .metric-card {
      background: #111827;
      border: 1px solid #1e293b;
      border-radius: 10px;
      padding: 20px;
    }

    .metric-name {
      font-size: 13px;
      color: #94a3b8;
      margin-bottom: 4px;
    }

    .metric-value {
      font-size: 28px;
      font-weight: 700;
      line-height: 1.2;
    }

    .metric-rating {
      font-size: 12px;
      margin-top: 4px;
      font-weight: 600;
    }

    /* ── Code Findings ──────────────────────── */
    .findings-table-wrapper {
      overflow-x: auto;
      border: 1px solid #1e293b;
      border-radius: 10px;
    }

    .findings-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }

    .findings-table th {
      background: #111827;
      text-align: left;
      padding: 12px 16px;
      font-weight: 600;
      color: #94a3b8;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #1e293b;
    }

    .findings-table td {
      padding: 12px 16px;
      border-bottom: 1px solid #1e293b;
      vertical-align: top;
    }

    .findings-table tr:last-child td {
      border-bottom: none;
    }

    .findings-table tr:hover td {
      background: #111827;
    }

    .finding-file {
      font-family: 'SF Mono', Menlo, Consolas, monospace;
      font-size: 12px;
      color: #60a5fa;
    }

    .finding-message {
      color: #e2e8f0;
    }

    .finding-suggestion {
      color: #94a3b8;
      font-size: 13px;
      margin-top: 4px;
    }

    .category-group {
      margin-bottom: 32px;
    }

    .category-label {
      font-size: 16px;
      font-weight: 600;
      color: #f1f5f9;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .category-count {
      background: #1e293b;
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 12px;
      color: #94a3b8;
    }

    /* ── Footer ─────────────────────────────── */
    .footer {
      text-align: center;
      padding-top: 32px;
      border-top: 1px solid #1e293b;
      color: #475569;
      font-size: 13px;
    }

    .footer a {
      color: #f59e0b;
      text-decoration: none;
    }

    .footer a:hover { text-decoration: underline; }

    /* ── Empty State ────────────────────────── */
    .empty-state {
      text-align: center;
      padding: 32px;
      color: #22c55e;
      font-size: 15px;
      background: #111827;
      border-radius: 10px;
      border: 1px solid #1e293b;
    }

    /* ── Grade Cards ────────────────────────── */
    .grade-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 16px;
      margin-bottom: 48px;
    }

    .grade-card {
      background: #111827;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 24px 16px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }

    .grade-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
    }

    .grade-letter {
      font-size: 48px;
      font-weight: 800;
      line-height: 1;
      margin-bottom: 4px;
    }

    .grade-score {
      font-size: 14px;
      color: #64748b;
      margin-bottom: 8px;
    }

    .grade-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .grade-section-name {
      font-size: 13px;
      color: #94a3b8;
      margin-top: 8px;
    }

    /* ── SEO Section ───────────────────────── */
    .seo-check {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 16px;
      border-bottom: 1px solid #1e293b;
    }

    .seo-check:last-child {
      border-bottom: none;
    }

    .seo-check-icon {
      font-size: 16px;
      min-width: 24px;
      text-align: center;
      margin-top: 2px;
    }

    .seo-check-content {
      flex: 1;
    }

    .seo-check-title {
      font-weight: 600;
      font-size: 14px;
      color: #e2e8f0;
    }

    .seo-check-detail {
      font-size: 13px;
      color: #94a3b8;
      margin-top: 2px;
    }

    /* ── Responsive ─────────────────────────── */
    @media (max-width: 768px) {
      .container { padding: 24px 16px; }
      .header-meta { flex-direction: column; gap: 8px; }
      .summary-grid { grid-template-columns: repeat(2, 1fr); }
      .metrics-grid { grid-template-columns: 1fr; }
      .grade-grid { grid-template-columns: repeat(2, 1fr); }
    }
  `;
}

// ── Section Builders ──────────────────────────────────────────────

function buildHeader(data: FullReviewResult): string {
  return `
    <header class="header">
      <div class="logo"><span class="logo-ui">UI</span><span class="logo-max">Max</span> Report</div>
      <p class="header-subtitle">Comprehensive UI Review</p>
      <div class="header-meta">
        <span>URL: <a href="${escapeHtml(data.url)}" target="_blank" rel="noopener">${escapeHtml(data.url)}</a></span>
        <span>Generated: ${escapeHtml(new Date(data.timestamp).toLocaleString())}</span>
        <span>Code: ${escapeHtml(data.codeDirectory)}</span>
      </div>
    </header>
  `;
}

function buildSummaryCards(data: FullReviewResult): string {
  const codeCounts = countBySeverity(data.codeAnalysis.findings);
  const totalViolations = data.accessibility.violations.length;
  const totalCodeFindings = data.codeAnalysis.findings.length;

  const criticalAndHigh =
    codeCounts.critical +
    codeCounts.high +
    data.accessibility.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    ).length;

  return `
    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-card-value" style="color: ${criticalAndHigh > 0 ? "#ef4444" : "#22c55e"}">${criticalAndHigh}</div>
        <div class="summary-card-label">Critical + High Issues</div>
      </div>
      <div class="summary-card">
        <div class="summary-card-value" style="color: #f59e0b">${totalViolations}</div>
        <div class="summary-card-label">Accessibility Violations</div>
      </div>
      <div class="summary-card">
        <div class="summary-card-value" style="color: ${getRatingColor("loadTime", data.performance.loadTime)}">${formatMs(data.performance.loadTime)}</div>
        <div class="summary-card-label">Load Time</div>
      </div>
      <div class="summary-card">
        <div class="summary-card-value" style="color: #3b82f6">${totalCodeFindings}</div>
        <div class="summary-card-label">Code Findings</div>
      </div>
      <div class="summary-card">
        <div class="summary-card-value" style="color: #94a3b8">${data.codeAnalysis.totalFiles}</div>
        <div class="summary-card-label">Files Analyzed</div>
      </div>
      <div class="summary-card">
        <div class="summary-card-value" style="color: #94a3b8">${data.codeAnalysis.framework}</div>
        <div class="summary-card-label">Framework</div>
      </div>
    </div>
  `;
}

function buildScreenshotSection(data: FullReviewResult): string {
  return `
    <div class="section">
      <h2 class="section-title">
        <span class="section-title-icon">&#128247;</span>
        Screenshot
      </h2>
      <div class="screenshot-wrapper">
        <img
          src="data:${data.screenshot.mimeType};base64,${data.screenshot.base64}"
          alt="Screenshot of ${escapeHtml(data.url)}"
          width="${data.screenshot.width}"
          height="${data.screenshot.height}"
        />
      </div>
    </div>
  `;
}

function buildSingleViolation(violation: AccessibilityViolation): string {
  const severity = IMPACT_TO_SEVERITY[violation.impact] ?? "medium";
  const nodes = violation.nodes.slice(0, 5);

  const nodeHtml = nodes
    .map(
      (node) => `
      <div class="violation-node">${escapeHtml(node.html)}</div>
      `
    )
    .join("");

  const moreCount = violation.nodes.length - nodes.length;
  const moreHtml =
    moreCount > 0
      ? `<div style="color: #64748b; font-size: 12px; margin-top: 4px;">+ ${moreCount} more affected element(s)</div>`
      : "";

  return `
    <div class="violation-card">
      <div class="violation-header">
        <span class="violation-id">${escapeHtml(violation.id)}</span>
        <span class="badge badge-${severity}">${severity}</span>
      </div>
      <div class="violation-desc">${escapeHtml(violation.help)}</div>
      <div class="violation-nodes">
        <div style="margin-bottom: 6px; color: #94a3b8;">Affected elements (${violation.nodes.length}):</div>
        ${nodeHtml}
        ${moreHtml}
      </div>
      <a class="violation-link" href="${escapeHtml(violation.helpUrl)}" target="_blank" rel="noopener">Learn more &rarr;</a>
    </div>
  `;
}

function buildAccessibilitySection(data: FullReviewResult): string {
  const { violations, passes } = data.accessibility;

  const violationsHtml =
    violations.length === 0
      ? `<div class="empty-state">No accessibility violations found. ${passes} checks passed.</div>`
      : violations.map(buildSingleViolation).join("");

  return `
    <div class="section">
      <h2 class="section-title">
        <span class="section-title-icon">&#9855;</span>
        Accessibility
      </h2>
      <div style="margin-bottom: 16px; color: #94a3b8; font-size: 14px;">
        ${violations.length} violation(s) found &middot; ${passes} checks passed
      </div>
      ${violationsHtml}
    </div>
  `;
}

function buildSingleMetricCard(
  label: string,
  key: string,
  value: number | null,
  formatter: (v: number | null) => string
): string {
  if (value === null) {
    return `
      <div class="metric-card">
        <div class="metric-name">${escapeHtml(label)}</div>
        <div class="metric-value" style="color: #475569;">N/A</div>
      </div>
    `;
  }

  const color = getRatingColor(key, value);
  const rating = getRatingLabel(key, value);

  return `
    <div class="metric-card">
      <div class="metric-name">${escapeHtml(label)}</div>
      <div class="metric-value" style="color: ${color};">${formatter(value)}</div>
      <div class="metric-rating" style="color: ${color};">${rating}</div>
    </div>
  `;
}

function buildPerformanceSection(perf: PerformanceMetrics): string {
  const metricsHtml = [
    buildSingleMetricCard("First Contentful Paint", "firstContentfulPaint", perf.firstContentfulPaint, formatMs),
    buildSingleMetricCard("Largest Contentful Paint", "largestContentfulPaint", perf.largestContentfulPaint, formatMs),
    buildSingleMetricCard("Cumulative Layout Shift", "cumulativeLayoutShift", perf.cumulativeLayoutShift, (v) =>
      v === null ? "N/A" : v.toFixed(3)
    ),
    buildSingleMetricCard("Total Blocking Time", "totalBlockingTime", perf.totalBlockingTime, formatMs),
    buildSingleMetricCard("Load Time", "loadTime", perf.loadTime, formatMs),
    buildSingleMetricCard("DOM Content Loaded", "domContentLoaded", perf.domContentLoaded, formatMs),
  ].join("");

  const extraStats = `
    <div style="display: flex; gap: 24px; flex-wrap: wrap; margin-top: 16px; font-size: 14px; color: #94a3b8;">
      <span>DOM Nodes: <strong style="color: #e2e8f0;">${perf.domNodes.toLocaleString()}</strong></span>
      <span>Resources: <strong style="color: #e2e8f0;">${perf.resourceCount}</strong></span>
      <span>Total Size: <strong style="color: #e2e8f0;">${formatBytes(perf.totalResourceSize)}</strong></span>
      ${perf.jsHeapSize !== null ? `<span>JS Heap: <strong style="color: #e2e8f0;">${formatBytes(perf.jsHeapSize)}</strong></span>` : ""}
    </div>
  `;

  return `
    <div class="section">
      <h2 class="section-title">
        <span class="section-title-icon">&#9889;</span>
        Performance
      </h2>
      <div class="metrics-grid">
        ${metricsHtml}
      </div>
      ${extraStats}
    </div>
  `;
}

function buildCodeAnalysisSection(data: FullReviewResult): string {
  const { findings, summary } = data.codeAnalysis;

  if (findings.length === 0) {
    return `
      <div class="section">
        <h2 class="section-title">
          <span class="section-title-icon">&#128269;</span>
          Code Analysis
        </h2>
        <div class="empty-state">No code findings. ${summary.components} components and ${summary.stylesheets} stylesheets analyzed.</div>
      </div>
    `;
  }

  // Group findings by category immutably
  const byCategory = findings.reduce<Readonly<Record<string, readonly CodeFinding[]>>>(
    (acc, finding) => {
      const existing = acc[finding.category] ?? [];
      return { ...acc, [finding.category]: [...existing, finding] };
    },
    {}
  );

  const categoryLabels: Readonly<Record<string, string>> = {
    accessibility: "Accessibility",
    "code-quality": "Code Quality",
    design: "Design Consistency",
    performance: "Performance",
    ux: "User Experience",
    bug: "Bugs",
  };

  const groupsHtml = Object.entries(byCategory)
    .map(([category, categoryFindings]) => {
      const label = categoryLabels[category] ?? category;
      const rows = categoryFindings
        .slice(0, 30)
        .map(
          (f) => `
          <tr>
            <td><span class="badge badge-${f.severity}">${f.severity}</span></td>
            <td class="finding-file">${escapeHtml(f.file)}${f.line !== null ? `:${f.line}` : ""}</td>
            <td>
              <div class="finding-message">${escapeHtml(f.message)}</div>
              <div class="finding-suggestion">${escapeHtml(f.suggestion)}</div>
            </td>
          </tr>
        `
        )
        .join("");

      const moreCount = categoryFindings.length - 30;
      const moreRow =
        moreCount > 0
          ? `<tr><td colspan="3" style="color: #64748b; font-size: 13px; text-align: center;">+ ${moreCount} more finding(s)</td></tr>`
          : "";

      return `
        <div class="category-group">
          <div class="category-label">
            ${escapeHtml(label)}
            <span class="category-count">${categoryFindings.length}</span>
          </div>
          <div class="findings-table-wrapper">
            <table class="findings-table">
              <thead>
                <tr>
                  <th style="width: 100px;">Severity</th>
                  <th style="width: 250px;">Location</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
                ${moreRow}
              </tbody>
            </table>
          </div>
        </div>
      `;
    })
    .join("");

  const statsLine = `
    <div style="margin-bottom: 20px; color: #94a3b8; font-size: 14px;">
      ${findings.length} finding(s) across ${data.codeAnalysis.totalFiles} files
      &middot; ${summary.components} components
      &middot; ${summary.stylesheets} stylesheets
      &middot; avg ${summary.avgFileSize} lines/file
    </div>
  `;

  return `
    <div class="section">
      <h2 class="section-title">
        <span class="section-title-icon">&#128269;</span>
        Code Analysis
      </h2>
      ${statsLine}
      ${groupsHtml}
    </div>
  `;
}

function buildGradeCards(data: FullReviewResult): string {
  if (!data.grades) return "";

  const sections: readonly {
    readonly name: string;
    readonly key: keyof SectionGradeReport;
  }[] = [
    { name: "Accessibility", key: "accessibility" },
    { name: "Performance", key: "performance" },
    { name: "Best Practices", key: "bestPractices" },
    { name: "SEO", key: "seo" },
    { name: "Code Quality", key: "codeQuality" },
  ];

  const cards = sections
    .map((section) => {
      const grade = data.grades![section.key];
      return `
        <div class="grade-card" style="border-top: 3px solid ${grade.color};">
          <div class="grade-letter" style="color: ${grade.color};">${escapeHtml(grade.grade)}</div>
          <div class="grade-score">${grade.score}/100</div>
          <div class="grade-label" style="color: ${grade.color};">${escapeHtml(grade.label)}</div>
          <div class="grade-section-name">${escapeHtml(section.name)}</div>
        </div>
      `;
    })
    .join("");

  return `
    <div class="section">
      <h2 class="section-title">
        <span class="section-title-icon">&#127942;</span>
        Report Card
      </h2>
      <div class="grade-grid">
        ${cards}
      </div>
    </div>
  `;
}

function buildSeoSection(data: FullReviewResult): string {
  if (!data.seo) return "";

  const { checks, passed, failed, score } = data.seo;

  const checksHtml = checks
    .map((check) => {
      const icon = check.passed ? "&#9989;" : "&#10060;";
      const detail = check.value
        ? `<div class="seo-check-detail">${escapeHtml(check.value)}</div>`
        : "";
      const recommendation = !check.passed
        ? `<div class="seo-check-detail" style="color: #f59e0b;">${escapeHtml(check.recommendation)}</div>`
        : "";

      return `
        <div class="seo-check">
          <span class="seo-check-icon">${icon}</span>
          <div class="seo-check-content">
            <div class="seo-check-title">${escapeHtml(check.title)}</div>
            ${detail}
            ${recommendation}
          </div>
          <span class="badge badge-${check.impact}">${check.impact}</span>
        </div>
      `;
    })
    .join("");

  return `
    <div class="section">
      <h2 class="section-title">
        <span class="section-title-icon">&#128270;</span>
        SEO
      </h2>
      <div style="margin-bottom: 16px; color: #94a3b8; font-size: 14px;">
        Score: <strong style="color: #e2e8f0;">${score}/100</strong>
        &middot; ${passed} passed &middot; ${failed} failed
      </div>
      <div style="background: #111827; border: 1px solid #1e293b; border-radius: 10px; overflow: hidden;">
        ${checksHtml}
      </div>
    </div>
  `;
}

function buildSeveritySummary(data: FullReviewResult): string {
  const codeCounts = countBySeverity(data.codeAnalysis.findings);

  // Count accessibility violations by mapped severity
  const a11yCounts: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const v of data.accessibility.violations) {
    const severity = IMPACT_TO_SEVERITY[v.impact] ?? "medium";
    a11yCounts[severity]++;
  }

  const combined: Record<Severity, number> = {
    critical: codeCounts.critical + a11yCounts.critical,
    high: codeCounts.high + a11yCounts.high,
    medium: codeCounts.medium + a11yCounts.medium,
    low: codeCounts.low + a11yCounts.low,
  };

  const total = combined.critical + combined.high + combined.medium + combined.low;

  const rows = (["critical", "high", "medium", "low"] as const)
    .map(
      (sev) => `
      <div style="display: flex; align-items: center; gap: 12px; padding: 8px 0;">
        <span class="badge badge-${sev}" style="min-width: 80px; text-align: center;">${sev}</span>
        <div style="flex: 1; height: 8px; background: #1e293b; border-radius: 4px; overflow: hidden;">
          <div style="height: 100%; width: ${total > 0 ? (combined[sev] / total) * 100 : 0}%; background: ${SEVERITY_COLORS[sev]}; border-radius: 4px;"></div>
        </div>
        <span style="min-width: 40px; text-align: right; font-weight: 600; color: ${SEVERITY_COLORS[sev]};">${combined[sev]}</span>
      </div>
    `
    )
    .join("");

  return `
    <div class="section">
      <h2 class="section-title">
        <span class="section-title-icon">&#128202;</span>
        Summary
      </h2>
      <div style="background: #111827; border: 1px solid #1e293b; border-radius: 12px; padding: 24px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <span style="font-size: 48px; font-weight: 800; color: ${total === 0 ? "#22c55e" : combined.critical > 0 ? "#ef4444" : "#f59e0b"};">${total}</span>
          <div style="color: #94a3b8; font-size: 14px;">Total Findings</div>
        </div>
        ${rows}
      </div>
    </div>
  `;
}

function buildFooter(): string {
  return `
    <footer class="footer">
      <p>Generated by <a href="https://github.com/prem-fission/uimax-mcp" target="_blank" rel="noopener">UIMax MCP</a></p>
    </footer>
  `;
}

// ── Main Export ───────────────────────────────────────────────────

/**
 * Generate a self-contained HTML report from full review data.
 *
 * The output has zero external dependencies — all CSS is inline,
 * the screenshot is base64-embedded, and it uses a system font stack.
 */
export function generateHtmlReport(data: FullReviewResult): string {
  const title = `UIMax Report — ${data.url}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>${generateStyles()}</style>
</head>
<body>
  <div class="container">
    ${buildHeader(data)}
    ${buildGradeCards(data)}
    ${buildSummaryCards(data)}
    ${buildScreenshotSection(data)}
    ${buildAccessibilitySection(data)}
    ${buildPerformanceSection(data.performance)}
    ${buildSeoSection(data)}
    ${buildCodeAnalysisSection(data)}
    ${buildSeveritySummary(data)}
    ${buildFooter()}
  </div>
</body>
</html>`;
}
