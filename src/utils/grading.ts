// ── Letter Grade System ─────────────────────────────────────────────
//
// Maps 0-100 scores to A+ through F letter grades.
// Used across the review pipeline, HTML reports, and baseline comparisons.

// ── Types ────────────────────────────────────────────────────────────

export type LetterGrade =
  | "A+" | "A" | "A-"
  | "B+" | "B" | "B-"
  | "C+" | "C" | "C-"
  | "D+" | "D" | "D-"
  | "F";

export interface GradeResult {
  readonly grade: LetterGrade;
  readonly score: number;
  readonly label: string;
  readonly color: string;
}

export interface SectionGrades {
  readonly accessibility: GradeResult;
  readonly performance: GradeResult;
  readonly bestPractices: GradeResult;
  readonly seo: GradeResult;
  readonly codeQuality: GradeResult;
}

// ── Grade Thresholds ────────────────────────────────────────────────

interface GradeThreshold {
  readonly min: number;
  readonly grade: LetterGrade;
  readonly label: string;
}

const GRADE_THRESHOLDS: readonly GradeThreshold[] = [
  { min: 97, grade: "A+", label: "Exceptional" },
  { min: 93, grade: "A",  label: "Excellent" },
  { min: 90, grade: "A-", label: "Great" },
  { min: 87, grade: "B+", label: "Very Good" },
  { min: 83, grade: "B",  label: "Good" },
  { min: 80, grade: "B-", label: "Above Average" },
  { min: 77, grade: "C+", label: "Fair" },
  { min: 73, grade: "C",  label: "Average" },
  { min: 70, grade: "C-", label: "Below Average" },
  { min: 67, grade: "D+", label: "Poor" },
  { min: 63, grade: "D",  label: "Weak" },
  { min: 60, grade: "D-", label: "Very Weak" },
  { min: 0,  grade: "F",  label: "Failing" },
];

// ── Grade Colors ────────────────────────────────────────────────────

const GRADE_COLORS: Readonly<Record<string, string>> = {
  "A+": "#22c55e",
  "A":  "#22c55e",
  "A-": "#4ade80",
  "B+": "#86efac",
  "B":  "#a3e635",
  "B-": "#bef264",
  "C+": "#facc15",
  "C":  "#eab308",
  "C-": "#f59e0b",
  "D+": "#f97316",
  "D":  "#fb923c",
  "D-": "#ef4444",
  "F":  "#dc2626",
};

// ── Core Functions ──────────────────────────────────────────────────

/**
 * Convert a 0-100 numeric score to a letter grade result.
 */
export function scoreToGrade(score: number): GradeResult {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));

  for (const threshold of GRADE_THRESHOLDS) {
    if (clamped >= threshold.min) {
      return {
        grade: threshold.grade,
        score: clamped,
        label: threshold.label,
        color: GRADE_COLORS[threshold.grade] ?? "#94a3b8",
      };
    }
  }

  // Fallback (shouldn't reach here due to min: 0 threshold)
  return {
    grade: "F",
    score: clamped,
    label: "Failing",
    color: GRADE_COLORS["F"] ?? "#dc2626",
  };
}

/**
 * Compute accessibility grade from violations and Lighthouse score.
 *
 * Strategy: if Lighthouse a11y score is available, use it directly.
 * Otherwise, compute from violation count vs passes ratio.
 */
export function computeAccessibilityGrade(params: {
  readonly lighthouseScore: number | null;
  readonly violationCount: number;
  readonly passCount: number;
}): GradeResult {
  if (params.lighthouseScore !== null) {
    return scoreToGrade(params.lighthouseScore);
  }

  // Fallback: compute from pass/fail ratio
  const total = params.violationCount + params.passCount;
  if (total === 0) return scoreToGrade(100);

  const passRate = params.passCount / total;
  // Weight violations more heavily: each violation penalizes 3x
  const penalty = Math.min(params.violationCount * 3, 50);
  const score = Math.max(0, passRate * 100 - penalty);
  return scoreToGrade(score);
}

/**
 * Compute performance grade from Lighthouse score and Core Web Vitals.
 *
 * Strategy: if Lighthouse performance score is available, use it.
 * Otherwise, compute from Core Web Vitals thresholds.
 */
export function computePerformanceGrade(params: {
  readonly lighthouseScore: number | null;
  readonly fcp: number | null;
  readonly lcp: number | null;
  readonly cls: number | null;
  readonly tbt: number | null;
}): GradeResult {
  if (params.lighthouseScore !== null) {
    return scoreToGrade(params.lighthouseScore);
  }

  // Fallback: compute from Core Web Vitals
  const metricScores: number[] = [];

  if (params.fcp !== null) {
    metricScores.push(rateMetric(params.fcp, 1800, 3000));
  }
  if (params.lcp !== null) {
    metricScores.push(rateMetric(params.lcp, 2500, 4000));
  }
  if (params.cls !== null) {
    metricScores.push(rateMetric(params.cls, 0.1, 0.25));
  }
  if (params.tbt !== null) {
    metricScores.push(rateMetric(params.tbt, 200, 600));
  }

  if (metricScores.length === 0) return scoreToGrade(50);

  const avg = metricScores.reduce((a, b) => a + b, 0) / metricScores.length;
  return scoreToGrade(avg);
}

/**
 * Compute code quality grade from findings count, severity, and file count.
 *
 * Strategy: starts at 100, penalizes based on findings relative to file count.
 * Critical findings penalize 10 points, high 5, medium 2, low 1.
 */
export function computeCodeQualityGrade(params: {
  readonly totalFiles: number;
  readonly findings: {
    readonly critical: number;
    readonly high: number;
    readonly medium: number;
    readonly low: number;
  };
}): GradeResult {
  const totalPenalty =
    params.findings.critical * 10 +
    params.findings.high * 5 +
    params.findings.medium * 2 +
    params.findings.low * 1;

  // Normalize by file count — more files should tolerate more findings
  const normalizer = Math.max(1, params.totalFiles * 0.5);
  const normalizedPenalty = totalPenalty / normalizer;

  const score = Math.max(0, 100 - normalizedPenalty * 5);
  return scoreToGrade(score);
}

/**
 * Compute all section grades from review data.
 */
export function computeSectionGrades(params: {
  readonly lighthouseScores: {
    readonly performance: number | null;
    readonly accessibility: number | null;
    readonly bestPractices: number | null;
    readonly seo: number | null;
  } | null;
  readonly accessibilityViolations: number;
  readonly accessibilityPasses: number;
  readonly performanceMetrics: {
    readonly fcp: number | null;
    readonly lcp: number | null;
    readonly cls: number | null;
    readonly tbt: number | null;
  };
  readonly codeFindings: {
    readonly critical: number;
    readonly high: number;
    readonly medium: number;
    readonly low: number;
  };
  readonly totalFiles: number;
}): SectionGrades {
  const lh = params.lighthouseScores;

  return {
    accessibility: computeAccessibilityGrade({
      lighthouseScore: lh?.accessibility ?? null,
      violationCount: params.accessibilityViolations,
      passCount: params.accessibilityPasses,
    }),
    performance: computePerformanceGrade({
      lighthouseScore: lh?.performance ?? null,
      fcp: params.performanceMetrics.fcp,
      lcp: params.performanceMetrics.lcp,
      cls: params.performanceMetrics.cls,
      tbt: params.performanceMetrics.tbt,
    }),
    bestPractices: lh?.bestPractices !== null
      ? scoreToGrade(lh?.bestPractices ?? 0)
      : scoreToGrade(50),
    seo: lh?.seo !== null
      ? scoreToGrade(lh?.seo ?? 0)
      : scoreToGrade(50),
    codeQuality: computeCodeQualityGrade({
      totalFiles: params.totalFiles,
      findings: params.codeFindings,
    }),
  };
}

/**
 * Format a grade result as a compact string: "B+ (83)"
 */
export function formatGradeCompact(grade: GradeResult): string {
  return `${grade.grade} (${grade.score})`;
}

/**
 * Format a grade transition: "D → B+ (+22)"
 */
export function formatGradeTransition(
  previous: GradeResult,
  current: GradeResult
): string {
  const delta = current.score - previous.score;
  const deltaStr = delta > 0 ? `+${delta}` : String(delta);
  return `${previous.grade} -> ${current.grade} (${deltaStr})`;
}

// ── Internal Helpers ────────────────────────────────────────────────

/**
 * Rate a metric value against Good/Needs Improvement thresholds.
 * Returns a 0-100 score where lower metric values are better.
 */
function rateMetric(
  value: number,
  goodThreshold: number,
  poorThreshold: number
): number {
  if (value <= goodThreshold) return 100;
  if (value >= poorThreshold) return 30;

  // Linear interpolation between good (100) and poor (30)
  const range = poorThreshold - goodThreshold;
  const offset = value - goodThreshold;
  return Math.round(100 - (offset / range) * 70);
}
