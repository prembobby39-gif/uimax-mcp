import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type {
  BaselineData,
  BaselineEntry,
  BaselineComparison,
  BaselineMetricChange,
} from "../types.js";
import { scoreToGrade, formatGradeTransition } from "../utils/grading.js";

// ── Constants ──────────────────────────────────────────────────────

const HISTORY_FILENAME = ".uimax-history.json";

// ── File Path Helpers ──────────────────────────────────────────────

function historyFilePath(outputDir?: string): string {
  return resolve(outputDir ?? process.cwd(), HISTORY_FILENAME);
}

// ── Read / Write Helpers ───────────────────────────────────────────

async function readHistoryFile(
  outputDir?: string
): Promise<readonly BaselineEntry[]> {
  try {
    const raw = await readFile(historyFilePath(outputDir), "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as readonly BaselineEntry[];
  } catch {
    return [];
  }
}

async function writeHistoryFile(
  entries: readonly BaselineEntry[],
  outputDir?: string
): Promise<void> {
  const filePath = historyFilePath(outputDir);
  await writeFile(filePath, JSON.stringify(entries, null, 2), "utf-8");
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Save a baseline snapshot for a URL.
 * Appends to the history file (never overwrites existing entries).
 */
export async function saveBaseline(
  url: string,
  results: BaselineData,
  outputDir?: string
): Promise<BaselineEntry> {
  const existing = await readHistoryFile(outputDir);

  const entry: BaselineEntry = {
    url,
    timestamp: results.timestamp,
    data: results,
  };

  const updated = [...existing, entry];
  await writeHistoryFile(updated, outputDir);

  return entry;
}

/**
 * Load the most recent baseline for a given URL.
 * Returns null if no baseline exists.
 */
export async function loadBaseline(
  url: string,
  outputDir?: string
): Promise<BaselineEntry | null> {
  const entries = await readHistoryFile(outputDir);

  const matching = entries.filter((e) => e.url === url);
  if (matching.length === 0) return null;

  return matching[matching.length - 1] ?? null;
}

/**
 * Load all baseline entries from the history file.
 */
export async function loadAllBaselines(
  outputDir?: string
): Promise<readonly BaselineEntry[]> {
  return readHistoryFile(outputDir);
}

// ── Comparison Logic ───────────────────────────────────────────────

/**
 * Determine the direction of a metric change.
 * For "higher is better" metrics (scores), an increase is an improvement.
 * For "lower is better" metrics (timings, counts), a decrease is an improvement.
 */
function classifyChange(
  metric: string,
  previous: number | null,
  current: number | null
): BaselineMetricChange {
  if (previous === null || current === null) {
    return { metric, previous, current, delta: null, direction: "unknown" };
  }

  const delta = current - previous;

  if (delta === 0) {
    return { metric, previous, current, delta, direction: "unchanged" };
  }

  const higherIsBetter = isHigherBetterMetric(metric);
  const improved = higherIsBetter ? delta > 0 : delta < 0;

  return {
    metric,
    previous,
    current,
    delta,
    direction: improved ? "improved" : "regressed",
  };
}

function isHigherBetterMetric(metric: string): boolean {
  const higherBetterMetrics = [
    "Lighthouse Performance",
    "Lighthouse Accessibility",
    "Lighthouse Best Practices",
    "Lighthouse SEO",
  ];
  return higherBetterMetrics.includes(metric);
}

/**
 * Compare two baseline snapshots and categorize each metric
 * as improved, regressed, or unchanged.
 */
export function compareToBaseline(
  current: BaselineData,
  previous: BaselineData
): BaselineComparison {
  const changes = buildMetricChanges(current, previous);

  const improvements = changes.filter((c) => c.direction === "improved");
  const regressions = changes.filter((c) => c.direction === "regressed");
  const unchanged = changes.filter(
    (c) => c.direction === "unchanged" || c.direction === "unknown"
  );

  return {
    url: current.url,
    previousTimestamp: previous.timestamp,
    currentTimestamp: current.timestamp,
    improvements,
    regressions,
    unchanged,
  };
}

function buildMetricChanges(
  current: BaselineData,
  previous: BaselineData
): readonly BaselineMetricChange[] {
  return [
    classifyChange(
      "Lighthouse Performance",
      previous.lighthouseScores.performance,
      current.lighthouseScores.performance
    ),
    classifyChange(
      "Lighthouse Accessibility",
      previous.lighthouseScores.accessibility,
      current.lighthouseScores.accessibility
    ),
    classifyChange(
      "Lighthouse Best Practices",
      previous.lighthouseScores.bestPractices,
      current.lighthouseScores.bestPractices
    ),
    classifyChange(
      "Lighthouse SEO",
      previous.lighthouseScores.seo,
      current.lighthouseScores.seo
    ),
    classifyChange(
      "FCP",
      previous.performanceMetrics.fcp,
      current.performanceMetrics.fcp
    ),
    classifyChange(
      "LCP",
      previous.performanceMetrics.lcp,
      current.performanceMetrics.lcp
    ),
    classifyChange(
      "CLS",
      previous.performanceMetrics.cls,
      current.performanceMetrics.cls
    ),
    classifyChange(
      "TBT",
      previous.performanceMetrics.tbt,
      current.performanceMetrics.tbt
    ),
    classifyChange(
      "Accessibility Violations",
      previous.accessibilityViolationCount,
      current.accessibilityViolationCount
    ),
    classifyChange(
      "Code Issues",
      previous.codeIssueCount,
      current.codeIssueCount
    ),
  ];
}

// ── Formatting ─────────────────────────────────────────────────────

function formatMetricLine(change: BaselineMetricChange): string {
  const prev = change.previous !== null ? String(change.previous) : "N/A";
  const curr = change.current !== null ? String(change.current) : "N/A";
  const deltaStr =
    change.delta !== null
      ? change.delta > 0
        ? `+${change.delta}`
        : String(change.delta)
      : "N/A";

  return `| ${change.metric} | ${prev} | ${curr} | ${deltaStr} |`;
}

/**
 * Format a baseline comparison as readable markdown.
 * Now includes letter grade transitions for score-based metrics.
 */
export function formatBaselineComparison(
  comparison: BaselineComparison
): string {
  const allChanges = [
    ...comparison.improvements,
    ...comparison.regressions,
    ...comparison.unchanged,
  ];

  // Build grade transition summary for score-based metrics
  const gradeTransitions = buildGradeTransitions(allChanges);

  const sections: string[] = [
    `## Baseline Comparison`,
    ``,
    `**URL:** ${comparison.url}`,
    `**Previous:** ${comparison.previousTimestamp}`,
    `**Current:** ${comparison.currentTimestamp}`,
    ``,
  ];

  // Add grade transition summary if available
  if (gradeTransitions.length > 0) {
    sections.push(`### Grade Changes`);
    sections.push(``);
    for (const transition of gradeTransitions) {
      sections.push(`- **${transition.metric}:** ${transition.display}`);
    }
    sections.push(``);
  }

  if (comparison.improvements.length > 0) {
    sections.push(`### Improvements`);
    sections.push(`| Metric | Previous | Current | Delta | Grade |`);
    sections.push(`|--------|----------|---------|-------|-------|`);
    for (const change of comparison.improvements) {
      sections.push(formatMetricLineWithGrade(change));
    }
    sections.push(``);
  }

  if (comparison.regressions.length > 0) {
    sections.push(`### Regressions`);
    sections.push(`| Metric | Previous | Current | Delta | Grade |`);
    sections.push(`|--------|----------|---------|-------|-------|`);
    for (const change of comparison.regressions) {
      sections.push(formatMetricLineWithGrade(change));
    }
    sections.push(``);
  }

  if (comparison.unchanged.length > 0) {
    sections.push(`### Unchanged`);
    sections.push(`| Metric | Previous | Current | Delta | Grade |`);
    sections.push(`|--------|----------|---------|-------|-------|`);
    for (const change of comparison.unchanged) {
      sections.push(formatMetricLineWithGrade(change));
    }
    sections.push(``);
  }

  return sections.join("\n");
}

interface GradeTransitionDisplay {
  readonly metric: string;
  readonly display: string;
}

/**
 * Build grade transition strings for score-based metrics.
 * Only includes metrics where the grade actually changed.
 */
function buildGradeTransitions(
  changes: readonly BaselineMetricChange[]
): readonly GradeTransitionDisplay[] {
  const scoreMetrics = new Set([
    "Lighthouse Performance",
    "Lighthouse Accessibility",
    "Lighthouse Best Practices",
    "Lighthouse SEO",
  ]);

  const transitions: GradeTransitionDisplay[] = [];

  for (const change of changes) {
    if (!scoreMetrics.has(change.metric)) continue;
    if (change.previous === null || change.current === null) continue;

    const prevGrade = scoreToGrade(change.previous);
    const currGrade = scoreToGrade(change.current);

    if (prevGrade.grade !== currGrade.grade) {
      transitions.push({
        metric: change.metric.replace("Lighthouse ", ""),
        display: formatGradeTransition(prevGrade, currGrade),
      });
    }
  }

  return transitions;
}

/**
 * Format a metric line with an appended grade column for score-based metrics.
 */
function formatMetricLineWithGrade(change: BaselineMetricChange): string {
  const prev = change.previous !== null ? String(change.previous) : "N/A";
  const curr = change.current !== null ? String(change.current) : "N/A";
  const deltaStr =
    change.delta !== null
      ? change.delta > 0
        ? `+${change.delta}`
        : String(change.delta)
      : "N/A";

  // Add grade for score-based metrics (Lighthouse scores are 0-100)
  const isScoreMetric = change.metric.startsWith("Lighthouse");
  const gradeStr = isScoreMetric && change.current !== null
    ? scoreToGrade(change.current).grade
    : "-";

  return `| ${change.metric} | ${prev} | ${curr} | ${deltaStr} | ${gradeStr} |`;
}
