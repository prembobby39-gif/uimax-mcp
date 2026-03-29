import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import crypto from "node:crypto";
import type {
  ReviewEntry,
  ReviewHistoryFile,
  ReviewScores,
  ReviewFindings,
  ReviewFinding,
  ReviewStats,
  ReviewDiff,
  ReviewTrend,
} from "../types.js";
import { scoreToGrade, formatGradeTransition } from "../utils/grading.js";

// ── Constants ──────────────────────────────────────────────────────

const REVIEWS_FILENAME = ".uimax-reviews.json";
const CURRENT_VERSION = 1;

// ── File Path Helpers ──────────────────────────────────────────────

function reviewsFilePath(codeDir?: string): string {
  return resolve(codeDir ?? process.cwd(), REVIEWS_FILENAME);
}

// ── Read / Write Helpers ───────────────────────────────────────────

async function readReviewsFile(
  codeDir?: string
): Promise<ReviewHistoryFile> {
  try {
    const raw = await readFile(reviewsFilePath(codeDir), "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (!isValidHistoryFile(parsed)) {
      return { version: CURRENT_VERSION, reviews: [] };
    }
    return parsed;
  } catch {
    return { version: CURRENT_VERSION, reviews: [] };
  }
}

function isValidHistoryFile(data: unknown): data is ReviewHistoryFile {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return typeof obj.version === "number" && Array.isArray(obj.reviews);
}

async function writeReviewsFile(
  historyFile: ReviewHistoryFile,
  codeDir?: string
): Promise<void> {
  const filePath = reviewsFilePath(codeDir);
  await writeFile(filePath, JSON.stringify(historyFile, null, 2), "utf-8");
}

// ── Public API: Save / Load ────────────────────────────────────────

/**
 * Append a review entry to the .uimax-reviews.json file.
 * Creates the file if it doesn't exist. Never overwrites existing entries.
 */
export async function saveReviewEntry(
  entry: ReviewEntry,
  codeDir?: string
): Promise<void> {
  const existing = await readReviewsFile(codeDir);
  const updated: ReviewHistoryFile = {
    ...existing,
    reviews: [...existing.reviews, entry],
  };
  await writeReviewsFile(updated, codeDir);
}

/**
 * Load review history with optional filters.
 * Returns entries sorted newest-first.
 */
export function loadReviewHistory(
  codeDir?: string,
  options?: { readonly limit?: number; readonly url?: string }
): Promise<readonly ReviewEntry[]> {
  return readReviewsFile(codeDir).then((file) => {
    const sorted = [...file.reviews].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const filtered = options?.url
      ? sorted.filter((e) => e.url === options.url)
      : sorted;

    const limited =
      options?.limit !== undefined && options.limit > 0
        ? filtered.slice(0, options.limit)
        : filtered;

    return limited;
  });
}

// ── Public API: Stats ──────────────────────────────────────────────

/**
 * Compute aggregate stats across all reviews.
 */
export async function getReviewStats(
  codeDir?: string
): Promise<ReviewStats> {
  const entries = await loadReviewHistory(codeDir);

  if (entries.length === 0) {
    return emptyStats();
  }

  const totalIssuesFound = entries.reduce(
    (sum, e) => sum + e.findings.total,
    0
  );

  const mostCommonIssues = computeMostCommonIssues(entries);
  const scoreTrends = computeScoreTrends(entries);
  const mostImprovedMetric = findMostImprovedMetric(scoreTrends);
  const mostProblematicFiles = computeMostProblematicFiles(entries);

  return {
    totalReviews: entries.length,
    totalIssuesFound,
    mostCommonIssues,
    scoreTrends,
    mostImprovedMetric,
    mostProblematicFiles,
  };
}

function emptyStats(): ReviewStats {
  return {
    totalReviews: 0,
    totalIssuesFound: 0,
    mostCommonIssues: [],
    scoreTrends: [],
    mostImprovedMetric: null,
    mostProblematicFiles: [],
  };
}

function computeMostCommonIssues(
  entries: readonly ReviewEntry[]
): readonly { readonly rule: string; readonly count: number }[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const finding of entry.findings.topFindings) {
      counts.set(finding.rule, (counts.get(finding.rule) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([rule, count]) => ({ rule, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function computeScoreTrends(
  entries: readonly ReviewEntry[]
): readonly ReviewTrend[] {
  // entries are newest-first, so last element is the oldest
  const oldest = entries[entries.length - 1];
  const newest = entries[0];

  if (!oldest || !newest) return [];

  const metrics: readonly {
    readonly name: string;
    readonly extract: (e: ReviewEntry) => number | null;
    readonly higherIsBetter: boolean;
  }[] = [
    { name: "Lighthouse Performance", extract: (e) => e.scores.lighthouse.performance, higherIsBetter: true },
    { name: "Lighthouse Accessibility", extract: (e) => e.scores.lighthouse.accessibility, higherIsBetter: true },
    { name: "Lighthouse Best Practices", extract: (e) => e.scores.lighthouse.bestPractices, higherIsBetter: true },
    { name: "Lighthouse SEO", extract: (e) => e.scores.lighthouse.seo, higherIsBetter: true },
    { name: "FCP", extract: (e) => e.scores.performanceMetrics.fcp, higherIsBetter: false },
    { name: "LCP", extract: (e) => e.scores.performanceMetrics.lcp, higherIsBetter: false },
    { name: "CLS", extract: (e) => e.scores.performanceMetrics.cls, higherIsBetter: false },
    { name: "TBT", extract: (e) => e.scores.performanceMetrics.tbt, higherIsBetter: false },
    { name: "Accessibility Violations", extract: (e) => e.scores.accessibilityViolations, higherIsBetter: false },
    { name: "Code Issues", extract: (e) => e.scores.codeIssues.total, higherIsBetter: false },
  ];

  return metrics.map((m) => {
    const first = m.extract(oldest);
    const latest = m.extract(newest);
    return {
      metric: m.name,
      first,
      latest,
      direction: classifyTrendDirection(first, latest, m.higherIsBetter),
    };
  });
}

function classifyTrendDirection(
  first: number | null,
  latest: number | null,
  higherIsBetter: boolean
): ReviewTrend["direction"] {
  if (first === null || latest === null) return "unknown";
  if (first === latest) return "unchanged";
  const increased = latest > first;
  return (higherIsBetter ? increased : !increased) ? "improved" : "regressed";
}

function findMostImprovedMetric(
  trends: readonly ReviewTrend[]
): string | null {
  const improved = trends.filter((t) => t.direction === "improved");
  if (improved.length === 0) return null;

  // Find the one with the biggest relative improvement
  let best: ReviewTrend | null = null;
  let bestDelta = 0;

  for (const trend of improved) {
    if (trend.first === null || trend.latest === null) continue;
    const delta = Math.abs(trend.latest - trend.first);
    if (delta > bestDelta) {
      bestDelta = delta;
      best = trend;
    }
  }

  return best?.metric ?? null;
}

function computeMostProblematicFiles(
  entries: readonly ReviewEntry[]
): readonly { readonly file: string; readonly count: number }[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const file of entry.filesWithIssues) {
      counts.set(file, (counts.get(file) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([file, count]) => ({ file, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

// ── Public API: Diff ───────────────────────────────────────────────

/**
 * Compare two review entries.
 * Returns new issues, resolved issues, score changes, and an overall verdict.
 */
export function diffReviews(
  entryA: ReviewEntry,
  entryB: ReviewEntry
): ReviewDiff {
  const newIssues = findNewIssues(entryA, entryB);
  const resolvedIssues = findResolvedIssues(entryA, entryB);
  const scoreChanges = computeScoreChanges(entryA, entryB);
  const verdict = computeVerdict(scoreChanges, newIssues, resolvedIssues);

  return {
    entryA,
    entryB,
    newIssues,
    resolvedIssues,
    scoreChanges,
    verdict,
  };
}

function findNewIssues(
  entryA: ReviewEntry,
  entryB: ReviewEntry
): readonly ReviewFinding[] {
  const aRules = new Set(entryA.findings.topFindings.map((f) => findingKey(f)));
  return entryB.findings.topFindings.filter((f) => !aRules.has(findingKey(f)));
}

function findResolvedIssues(
  entryA: ReviewEntry,
  entryB: ReviewEntry
): readonly ReviewFinding[] {
  const bRules = new Set(entryB.findings.topFindings.map((f) => findingKey(f)));
  return entryA.findings.topFindings.filter((f) => !bRules.has(findingKey(f)));
}

function findingKey(f: ReviewFinding): string {
  return `${f.rule}:${f.severity}:${f.file ?? ""}:${f.line ?? ""}`;
}

function computeScoreChanges(
  entryA: ReviewEntry,
  entryB: ReviewEntry
): ReviewDiff["scoreChanges"] {
  const metrics: readonly {
    readonly name: string;
    readonly extract: (e: ReviewEntry) => number | null;
    readonly higherIsBetter: boolean;
  }[] = [
    { name: "Lighthouse Performance", extract: (e) => e.scores.lighthouse.performance, higherIsBetter: true },
    { name: "Lighthouse Accessibility", extract: (e) => e.scores.lighthouse.accessibility, higherIsBetter: true },
    { name: "Lighthouse Best Practices", extract: (e) => e.scores.lighthouse.bestPractices, higherIsBetter: true },
    { name: "Lighthouse SEO", extract: (e) => e.scores.lighthouse.seo, higherIsBetter: true },
    { name: "FCP", extract: (e) => e.scores.performanceMetrics.fcp, higherIsBetter: false },
    { name: "LCP", extract: (e) => e.scores.performanceMetrics.lcp, higherIsBetter: false },
    { name: "CLS", extract: (e) => e.scores.performanceMetrics.cls, higherIsBetter: false },
    { name: "TBT", extract: (e) => e.scores.performanceMetrics.tbt, higherIsBetter: false },
    { name: "Accessibility Violations", extract: (e) => e.scores.accessibilityViolations, higherIsBetter: false },
    { name: "Code Issues", extract: (e) => e.scores.codeIssues.total, higherIsBetter: false },
  ];

  return metrics.map((m) => {
    const previous = m.extract(entryA);
    const current = m.extract(entryB);
    const delta = previous !== null && current !== null ? current - previous : null;
    return {
      metric: m.name,
      previous,
      current,
      delta,
      direction: classifyTrendDirection(previous, current, m.higherIsBetter),
    };
  });
}

function computeVerdict(
  scoreChanges: ReviewDiff["scoreChanges"],
  newIssues: readonly ReviewFinding[],
  resolvedIssues: readonly ReviewFinding[]
): ReviewDiff["verdict"] {
  const improved = scoreChanges.filter((c) => c.direction === "improved").length;
  const regressed = scoreChanges.filter((c) => c.direction === "regressed").length;
  const issueBalance = resolvedIssues.length - newIssues.length;

  if (improved === 0 && regressed === 0 && issueBalance === 0) return "unchanged";
  if (regressed === 0 && issueBalance >= 0 && improved > 0) return "improved";
  if (improved === 0 && issueBalance <= 0 && regressed > 0) return "regressed";
  return "mixed";
}

// ── Public API: Formatting ─────────────────────────────────────────

/**
 * Format review entries as a readable markdown table.
 */
export function formatReviewHistory(
  entries: readonly ReviewEntry[]
): string {
  if (entries.length === 0) {
    return [
      "## Review History",
      "",
      "No reviews found. Run `review_ui` to start building your review history.",
    ].join("\n");
  }

  const header = [
    "## Review History",
    "",
    "| Date | URL | Perf | A11y | BP | SEO | Code | Issues | Status |",
    "|------|-----|------|------|----|-----|------|--------|--------|",
  ];

  const rows = entries.map((e) => {
    const date = new Date(e.timestamp).toLocaleDateString();
    const shortUrl = truncateUrl(e.url, 30);
    const perf = formatScoreWithGrade(e.scores.lighthouse.performance);
    const a11y = formatScoreWithGrade(e.scores.lighthouse.accessibility);
    const bp = formatScoreWithGrade(e.scores.lighthouse.bestPractices);
    const seo = formatScoreWithGrade(e.scores.lighthouse.seo);
    const code = formatCodeGrade(e.scores.codeIssues);
    const issues = String(e.findings.total);
    const status = e.status;
    return `| ${date} | ${shortUrl} | ${perf} | ${a11y} | ${bp} | ${seo} | ${code} | ${issues} | ${status} |`;
  });

  return [...header, ...rows].join("\n");
}

function truncateUrl(url: string, maxLen: number): string {
  if (url.length <= maxLen) return url;
  return url.slice(0, maxLen - 3) + "...";
}

function formatScore(score: number | null): string {
  return score !== null ? String(score) : "N/A";
}

/**
 * Format a score with its letter grade: "B+ (87)"
 */
function formatScoreWithGrade(score: number | null): string {
  if (score === null) return "N/A";
  const grade = scoreToGrade(score);
  return `${grade.grade} (${score})`;
}

/**
 * Format a code quality grade from issue counts.
 */
function formatCodeGrade(codeIssues: {
  readonly total: number;
  readonly bySeverity: {
    readonly critical: number;
    readonly high: number;
    readonly medium: number;
    readonly low: number;
  };
}): string {
  // Simple heuristic: start at 100, penalize by severity
  const penalty =
    codeIssues.bySeverity.critical * 10 +
    codeIssues.bySeverity.high * 5 +
    codeIssues.bySeverity.medium * 2 +
    codeIssues.bySeverity.low * 1;
  const score = Math.max(0, 100 - penalty);
  const grade = scoreToGrade(score);
  return grade.grade;
}

/**
 * Format aggregate stats as markdown.
 */
export function formatReviewStats(stats: ReviewStats): string {
  if (stats.totalReviews === 0) {
    return [
      "## Review Statistics",
      "",
      "No reviews found. Run `review_ui` to start building your review history.",
    ].join("\n");
  }

  const sections: string[] = [
    "## Review Statistics",
    "",
    `**Total Reviews:** ${stats.totalReviews}`,
    `**Total Issues Found:** ${stats.totalIssuesFound}`,
  ];

  if (stats.mostImprovedMetric) {
    sections.push(`**Most Improved:** ${stats.mostImprovedMetric}`);
  }

  sections.push("");

  if (stats.scoreTrends.length > 0) {
    sections.push("### Score Trends (First vs Latest)");
    sections.push("");
    sections.push("| Metric | First | Latest | Grade | Trend |");
    sections.push("|--------|-------|--------|-------|-------|");
    for (const trend of stats.scoreTrends) {
      const first = formatScore(trend.first);
      const latest = formatScore(trend.latest);
      const grade = trend.metric.startsWith("Lighthouse") && trend.latest !== null
        ? scoreToGrade(trend.latest).grade
        : "-";
      const icon = trendIcon(trend.direction);
      sections.push(`| ${trend.metric} | ${first} | ${latest} | ${grade} | ${icon} |`);
    }
    sections.push("");
  }

  if (stats.mostCommonIssues.length > 0) {
    sections.push("### Most Common Issues");
    sections.push("");
    for (const issue of stats.mostCommonIssues) {
      sections.push(`- **${issue.rule}** (appeared ${issue.count} times)`);
    }
    sections.push("");
  }

  if (stats.mostProblematicFiles.length > 0) {
    sections.push("### Most Problematic Files");
    sections.push("");
    for (const file of stats.mostProblematicFiles) {
      sections.push(`- \`${file.file}\` (issues in ${file.count} reviews)`);
    }
    sections.push("");
  }

  return sections.join("\n");
}

function trendIcon(direction: ReviewTrend["direction"]): string {
  switch (direction) {
    case "improved": return "improved";
    case "regressed": return "regressed";
    case "unchanged": return "unchanged";
    case "unknown": return "N/A";
  }
}

/**
 * Format a review diff as markdown with indicators.
 */
export function formatReviewDiff(diff: ReviewDiff): string {
  const sections: string[] = [
    "## Review Comparison",
    "",
    `**Review A:** ${diff.entryA.timestamp} (${diff.entryA.url})`,
    `**Review B:** ${diff.entryB.timestamp} (${diff.entryB.url})`,
    `**Verdict:** ${formatVerdict(diff.verdict)}`,
    "",
  ];

  // Build grade transition summary for score-based metrics
  const gradeChanges = diff.scoreChanges
    .filter((c) => c.metric.startsWith("Lighthouse") && c.previous !== null && c.current !== null)
    .map((c) => {
      const prevGrade = scoreToGrade(c.previous!);
      const currGrade = scoreToGrade(c.current!);
      return {
        metric: c.metric.replace("Lighthouse ", ""),
        changed: prevGrade.grade !== currGrade.grade,
        display: formatGradeTransition(prevGrade, currGrade),
      };
    })
    .filter((g) => g.changed);

  if (gradeChanges.length > 0) {
    sections.push("### Grade Changes");
    sections.push("");
    for (const gc of gradeChanges) {
      sections.push(`- **${gc.metric}:** ${gc.display}`);
    }
    sections.push("");
  }

  if (diff.scoreChanges.length > 0) {
    sections.push("### Score Changes");
    sections.push("");
    sections.push("| Metric | Before | After | Delta | Grade | Status |");
    sections.push("|--------|--------|-------|-------|-------|--------|");
    for (const change of diff.scoreChanges) {
      const prev = formatScore(change.previous);
      const curr = formatScore(change.current);
      const delta = change.delta !== null
        ? (change.delta > 0 ? `+${change.delta}` : String(change.delta))
        : "N/A";
      const grade = change.metric.startsWith("Lighthouse") && change.current !== null
        ? scoreToGrade(change.current).grade
        : "-";
      const icon = change.direction === "improved" ? "improved"
        : change.direction === "regressed" ? "regressed"
        : "unchanged";
      sections.push(`| ${change.metric} | ${prev} | ${curr} | ${delta} | ${grade} | ${icon} |`);
    }
    sections.push("");
  }

  if (diff.resolvedIssues.length > 0) {
    sections.push("### Resolved Issues");
    sections.push("");
    for (const issue of diff.resolvedIssues) {
      const loc = issue.file ? ` (${issue.file}${issue.line ? `:${issue.line}` : ""})` : "";
      sections.push(`- [${issue.severity}] ${issue.rule}: ${issue.message}${loc}`);
    }
    sections.push("");
  }

  if (diff.newIssues.length > 0) {
    sections.push("### New Issues");
    sections.push("");
    for (const issue of diff.newIssues) {
      const loc = issue.file ? ` (${issue.file}${issue.line ? `:${issue.line}` : ""})` : "";
      sections.push(`- [${issue.severity}] ${issue.rule}: ${issue.message}${loc}`);
    }
    sections.push("");
  }

  return sections.join("\n");
}

function formatVerdict(verdict: ReviewDiff["verdict"]): string {
  switch (verdict) {
    case "improved": return "Improved";
    case "regressed": return "Regressed";
    case "mixed": return "Mixed (some improved, some regressed)";
    case "unchanged": return "Unchanged";
  }
}

// ── Public API: Summary Generation ─────────────────────────────────

/**
 * Generate a one-line summary from review scores and findings.
 */
export function generateReviewSummary(
  scores: ReviewScores,
  findings: ReviewFindings
): string {
  const parts: string[] = [];

  const severityParts: string[] = [];
  if (findings.bySeverity.critical > 0) {
    severityParts.push(`${findings.bySeverity.critical} critical`);
  }
  if (findings.bySeverity.high > 0) {
    severityParts.push(`${findings.bySeverity.high} high`);
  }
  if (findings.bySeverity.medium > 0) {
    severityParts.push(`${findings.bySeverity.medium} medium`);
  }
  if (findings.bySeverity.low > 0) {
    severityParts.push(`${findings.bySeverity.low} low`);
  }

  const issueStr = severityParts.length > 0
    ? `Found ${findings.total} issues (${severityParts.join(", ")})`
    : `Found ${findings.total} issues`;

  parts.push(issueStr);

  const lighthouseParts: string[] = [];
  if (scores.lighthouse.performance !== null) {
    lighthouseParts.push(`${scores.lighthouse.performance} perf`);
  }
  if (scores.lighthouse.accessibility !== null) {
    lighthouseParts.push(`${scores.lighthouse.accessibility} a11y`);
  }

  if (lighthouseParts.length > 0) {
    parts.push(`Lighthouse: ${lighthouseParts.join(", ")}`);
  }

  return parts.join(". ");
}

// ── Public API: Review Entry Builder ───────────────────────────────

/**
 * Build a ReviewEntry from the results of a full review.
 * This is used by the review_ui tool to automatically save history.
 */
export function buildReviewEntry(params: {
  readonly url: string;
  readonly codeDir?: string;
  readonly duration: number;
  readonly lighthouse?: {
    readonly scores: {
      readonly performance: number | null;
      readonly accessibility: number | null;
      readonly bestPractices: number | null;
      readonly seo: number | null;
    };
  } | null;
  readonly accessibility: {
    readonly violations: readonly { readonly id: string; readonly impact: string; readonly description: string }[];
  };
  readonly performance: {
    readonly firstContentfulPaint: number | null;
    readonly largestContentfulPaint: number | null;
    readonly cumulativeLayoutShift: number | null;
    readonly totalBlockingTime: number | null;
  };
  readonly codeAnalysis: {
    readonly totalFiles: number;
    readonly findings: readonly {
      readonly file: string;
      readonly line: number | null;
      readonly severity: string;
      readonly category: string;
      readonly rule: string;
      readonly message: string;
    }[];
  };
  readonly status: "completed" | "partial" | "failed";
}): ReviewEntry {
  const severityCounts = countBySeverity(params.codeAnalysis.findings);

  const categoryCounts: Record<string, number> = {};
  for (const f of params.codeAnalysis.findings) {
    categoryCounts[f.category] = (categoryCounts[f.category] ?? 0) + 1;
  }

  // Add accessibility violations to the category and finding counts
  const a11yViolationCount = params.accessibility.violations.length;
  if (a11yViolationCount > 0) {
    categoryCounts["accessibility"] =
      (categoryCounts["accessibility"] ?? 0) + a11yViolationCount;
  }

  const totalFindings = params.codeAnalysis.findings.length + a11yViolationCount;

  const topFindings = buildTopFindings(
    params.codeAnalysis.findings,
    params.accessibility.violations
  );

  const filesWithIssues = extractFilesWithIssues(params.codeAnalysis.findings);

  const scores: ReviewScores = {
    lighthouse: {
      performance: params.lighthouse?.scores.performance ?? null,
      accessibility: params.lighthouse?.scores.accessibility ?? null,
      bestPractices: params.lighthouse?.scores.bestPractices ?? null,
      seo: params.lighthouse?.scores.seo ?? null,
    },
    accessibilityViolations: a11yViolationCount,
    codeIssues: {
      total: params.codeAnalysis.findings.length,
      bySeverity: severityCounts,
    },
    performanceMetrics: {
      fcp: params.performance.firstContentfulPaint,
      lcp: params.performance.largestContentfulPaint,
      cls: params.performance.cumulativeLayoutShift,
      tbt: params.performance.totalBlockingTime,
    },
  };

  const findings: ReviewFindings = {
    total: totalFindings,
    bySeverity: {
      critical: severityCounts.critical,
      high: severityCounts.high + a11yViolationCount,
      medium: severityCounts.medium,
      low: severityCounts.low,
    },
    byCategory: categoryCounts,
    topFindings,
  };

  const summary = generateReviewSummary(scores, findings);

  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    url: params.url,
    codeDir: params.codeDir,
    duration: params.duration,
    scores,
    findings,
    filesAnalyzed: params.codeAnalysis.totalFiles,
    filesWithIssues,
    status: params.status,
    summary,
  };
}

function countBySeverity(
  findings: readonly { readonly severity: string }[]
): { readonly critical: number; readonly high: number; readonly medium: number; readonly low: number } {
  let critical = 0;
  let high = 0;
  let medium = 0;
  let low = 0;
  for (const f of findings) {
    switch (f.severity) {
      case "critical": critical++; break;
      case "high": high++; break;
      case "medium": medium++; break;
      case "low": low++; break;
    }
  }
  return { critical, high, medium, low };
}

function buildTopFindings(
  codeFindings: readonly {
    readonly file: string;
    readonly line: number | null;
    readonly severity: string;
    readonly rule: string;
    readonly message: string;
  }[],
  a11yViolations: readonly {
    readonly id: string;
    readonly impact: string;
    readonly description: string;
  }[]
): readonly ReviewFinding[] {
  const allFindings: ReviewFinding[] = [];

  for (const f of codeFindings) {
    allFindings.push({
      rule: f.rule,
      severity: f.severity,
      message: f.message,
      file: f.file,
      line: f.line ?? undefined,
    });
  }

  for (const v of a11yViolations) {
    allFindings.push({
      rule: v.id,
      severity: mapA11yImpact(v.impact),
      message: v.description,
    });
  }

  // Sort by severity priority and take top 10
  const severityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return [...allFindings]
    .sort((a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4))
    .slice(0, 10);
}

function mapA11yImpact(impact: string): string {
  switch (impact) {
    case "critical": return "critical";
    case "serious": return "high";
    case "moderate": return "medium";
    case "minor": return "low";
    default: return "medium";
  }
}

function extractFilesWithIssues(
  findings: readonly { readonly file: string }[]
): readonly string[] {
  const files = new Set<string>();
  for (const f of findings) {
    files.add(f.file);
  }
  return [...files].sort();
}
