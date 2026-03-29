// ── Verify Fixes Tool ───────────────────────────────────────────────
//
// Re-runs the full audit pipeline after fixes are applied, then compares
// the before/after results to show grade transitions, resolved issues,
// and remaining problems. Closes the review-fix-verify loop.

import { runFullReview } from "./full-review.js";
import type { FullReviewResult } from "../types.js";
import type { SectionGrades, GradeResult } from "../utils/grading.js";
import { formatGradeCompact, formatGradeTransition } from "../utils/grading.js";

// ── Types ────────────────────────────────────────────────────────────

export interface VerifyFixesResult {
  readonly url: string;
  readonly codeDirectory: string;
  readonly timestamp: string;
  readonly before: FullReviewResult;
  readonly after: FullReviewResult;
  readonly gradeTransitions: readonly GradeTransition[];
  readonly issuesSummary: IssuesSummary;
  readonly overallVerdict: "improved" | "regressed" | "mixed" | "unchanged";
}

export interface GradeTransition {
  readonly section: string;
  readonly before: GradeResult;
  readonly after: GradeResult;
  readonly delta: number;
  readonly direction: "improved" | "regressed" | "unchanged";
}

export interface IssuesSummary {
  readonly beforeTotal: number;
  readonly afterTotal: number;
  readonly resolved: number;
  readonly remaining: number;
  readonly newlyIntroduced: number;
  readonly accessibilityBefore: number;
  readonly accessibilityAfter: number;
  readonly codeBefore: number;
  readonly codeAfter: number;
}

// ── Main Function ────────────────────────────────────────────────────

/**
 * Re-run the full audit pipeline and compare against the "before" snapshot.
 * The `before` result should be the original review_ui output that was
 * passed in (or re-fetched from review history).
 */
export async function verifyFixes(
  url: string,
  codeDirectory: string,
  before: FullReviewResult,
  viewport?: { width: number; height: number }
): Promise<VerifyFixesResult> {
  // Run fresh audit (the "after" state)
  const after = await runFullReview(url, codeDirectory, viewport);

  // Compute grade transitions
  const gradeTransitions = computeGradeTransitions(
    before.grades ?? null,
    after.grades ?? null
  );

  // Compute issue resolution summary
  const issuesSummary = computeIssuesSummary(before, after);

  // Overall verdict
  const overallVerdict = determineVerdict(gradeTransitions, issuesSummary);

  return {
    url,
    codeDirectory,
    timestamp: new Date().toISOString(),
    before,
    after,
    gradeTransitions,
    issuesSummary,
    overallVerdict,
  };
}

// ── Grade Comparison ─────────────────────────────────────────────────

function computeGradeTransitions(
  before: SectionGrades | null,
  after: SectionGrades | null
): readonly GradeTransition[] {
  if (!before || !after) return [];

  const sections: readonly (keyof SectionGrades)[] = [
    "accessibility",
    "performance",
    "bestPractices",
    "seo",
    "codeQuality",
  ];

  const sectionLabels: Readonly<Record<string, string>> = {
    accessibility: "Accessibility",
    performance: "Performance",
    bestPractices: "Best Practices",
    seo: "SEO",
    codeQuality: "Code Quality",
  };

  return sections.map((key) => {
    const beforeGrade = before[key];
    const afterGrade = after[key];
    const delta = afterGrade.score - beforeGrade.score;

    return {
      section: sectionLabels[key] ?? key,
      before: beforeGrade,
      after: afterGrade,
      delta,
      direction:
        delta > 0 ? "improved" as const :
        delta < 0 ? "regressed" as const :
        "unchanged" as const,
    };
  });
}

// ── Issue Comparison ─────────────────────────────────────────────────

function computeIssuesSummary(
  before: FullReviewResult,
  after: FullReviewResult
): IssuesSummary {
  const accessibilityBefore = before.accessibility.violations.length;
  const accessibilityAfter = after.accessibility.violations.length;
  const codeBefore = before.codeAnalysis.findings.length;
  const codeAfter = after.codeAnalysis.findings.length;

  const beforeTotal = accessibilityBefore + codeBefore;
  const afterTotal = accessibilityAfter + codeAfter;
  const resolved = Math.max(0, beforeTotal - afterTotal);
  const newlyIntroduced = Math.max(0, afterTotal - beforeTotal);

  return {
    beforeTotal,
    afterTotal,
    resolved,
    remaining: afterTotal,
    newlyIntroduced,
    accessibilityBefore,
    accessibilityAfter,
    codeBefore,
    codeAfter,
  };
}

// ── Verdict ──────────────────────────────────────────────────────────

function determineVerdict(
  transitions: readonly GradeTransition[],
  issues: IssuesSummary
): "improved" | "regressed" | "mixed" | "unchanged" {
  const improved = transitions.filter((t) => t.direction === "improved").length;
  const regressed = transitions.filter((t) => t.direction === "regressed").length;
  const issuesReduced = issues.afterTotal < issues.beforeTotal;

  if (improved > 0 && regressed === 0 && issuesReduced) return "improved";
  if (regressed > 0 && improved === 0) return "regressed";
  if (improved === 0 && regressed === 0 && !issuesReduced) return "unchanged";
  return "mixed";
}

// ── Formatting ───────────────────────────────────────────────────────

/**
 * Format the verification result as a readable markdown report.
 */
export function formatVerifyFixesReport(result: VerifyFixesResult): string {
  const sections: string[] = [
    `## Fix Verification Report`,
    ``,
    `**URL:** ${result.url}`,
    `**Verified:** ${result.timestamp}`,
    `**Verdict:** ${formatVerdict(result.overallVerdict)}`,
    ``,
  ];

  // Grade transitions table
  if (result.gradeTransitions.length > 0) {
    sections.push(
      `### Report Card — Before vs After`,
      ``,
      `| Section | Before | After | Change |`,
      `|---------|--------|-------|--------|`,
    );

    for (const t of result.gradeTransitions) {
      const arrow = t.direction === "improved" ? "↑" :
                    t.direction === "regressed" ? "↓" : "—";
      const sign = t.delta > 0 ? `+${t.delta}` : String(t.delta);
      const indicator = t.direction === "improved" ? "✅" :
                        t.direction === "regressed" ? "❌" : "➖";
      sections.push(
        `| ${t.section} | **${t.before.grade}** (${t.before.score}) | **${t.after.grade}** (${t.after.score}) | ${indicator} ${arrow} ${sign} |`,
      );
    }
    sections.push(``);
  }

  // Issues summary
  sections.push(
    `### Issues Summary`,
    ``,
    `| Metric | Before | After |`,
    `|--------|--------|-------|`,
    `| Total issues | ${result.issuesSummary.beforeTotal} | ${result.issuesSummary.afterTotal} |`,
    `| Accessibility violations | ${result.issuesSummary.accessibilityBefore} | ${result.issuesSummary.accessibilityAfter} |`,
    `| Code findings | ${result.issuesSummary.codeBefore} | ${result.issuesSummary.codeAfter} |`,
    ``,
    `**Resolved:** ${result.issuesSummary.resolved} issue(s)`,
    `**Remaining:** ${result.issuesSummary.remaining} issue(s)`,
  );

  if (result.issuesSummary.newlyIntroduced > 0) {
    sections.push(
      `**⚠️ Newly introduced:** ${result.issuesSummary.newlyIntroduced} issue(s)`,
    );
  }

  sections.push(``);

  return sections.join("\n");
}

function formatVerdict(verdict: string): string {
  switch (verdict) {
    case "improved": return "✅ **IMPROVED** — Fixes verified successfully";
    case "regressed": return "❌ **REGRESSED** — Some metrics got worse";
    case "mixed": return "⚠️ **MIXED** — Some improvements, some regressions";
    case "unchanged": return "➖ **UNCHANGED** — No measurable change";
    default: return verdict;
  }
}
