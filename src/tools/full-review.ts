import type { FullReviewResult } from "../types.js";
import { captureScreenshot } from "./screenshot.js";
import { runAccessibilityAudit, formatAccessibilityReport } from "./accessibility.js";
import { measurePerformance, formatPerformanceReport } from "./performance.js";
import { analyzeCode, formatCodeAnalysisReport } from "./code-analysis.js";
import {
  runLighthouse,
  formatLighthouseReport,
  type LighthouseResult,
} from "./lighthouse.js";
import { runSeoAudit, formatSeoReport } from "./seo.js";
import {
  computeSectionGrades,
  formatGradeCompact,
  type SectionGrades,
} from "../utils/grading.js";

/**
 * Run a comprehensive UI review combining:
 * - Screenshot capture (for visual review by Claude)
 * - Accessibility audit (axe-core WCAG check)
 * - Performance metrics (Core Web Vitals)
 * - Code analysis (anti-patterns, quality, design)
 * - Lighthouse scores (optional — gracefully skipped on failure)
 * - SEO audit (meta tags, headings, Open Graph, structured data)
 * - Per-section letter grades (A+ through F)
 *
 * This is the main orchestration tool that runs all audits
 * and returns everything Claude needs for an expert review.
 */
export async function runFullReview(
  url: string,
  codeDirectory: string,
  viewport?: { width: number; height: number }
): Promise<FullReviewResult> {
  const width = viewport?.width ?? 1440;
  const height = viewport?.height ?? 900;

  // Run screenshot first (needed for visual review)
  const screenshot = await captureScreenshot({
    url,
    width,
    height,
    fullPage: true,
    delay: 1500,
    deviceScaleFactor: 2,
  });

  // Run remaining audits concurrently (Lighthouse + SEO are optional/safe)
  const [accessibility, performance, codeAnalysis, lighthouseOutcome, seoResult] =
    await Promise.all([
      runAccessibilityAudit(url),
      measurePerformance(url),
      analyzeCode(codeDirectory),
      runLighthouseSafe(url),
      runSeoSafe(url),
    ]);

  // Count code findings by severity
  const codeFindings = countCodeFindingsBySeverity(codeAnalysis.findings);

  // Compute letter grades for each section
  const grades = computeSectionGrades({
    lighthouseScores: lighthouseOutcome
      ? {
          performance: lighthouseOutcome.scores.performance,
          accessibility: lighthouseOutcome.scores.accessibility,
          bestPractices: lighthouseOutcome.scores.bestPractices,
          seo: lighthouseOutcome.scores.seo,
        }
      : null,
    accessibilityViolations: accessibility.violations.length,
    accessibilityPasses: accessibility.passes,
    performanceMetrics: {
      fcp: performance.firstContentfulPaint,
      lcp: performance.largestContentfulPaint,
      cls: performance.cumulativeLayoutShift,
      tbt: performance.totalBlockingTime,
    },
    codeFindings,
    totalFiles: codeAnalysis.totalFiles,
  });

  // If we have a dedicated SEO score, update the SEO grade
  const seoGrade = seoResult
    ? { ...grades.seo, score: seoResult.score }
    : grades.seo;

  const finalGrades = { ...grades, seo: seoGrade };

  return {
    url,
    codeDirectory,
    timestamp: new Date().toISOString(),
    screenshot,
    accessibility,
    performance,
    codeAnalysis,
    lighthouse: lighthouseOutcome ?? undefined,
    seo: seoResult ?? undefined,
    grades: finalGrades,
  };
}

/**
 * Attempt to run Lighthouse, returning null on any failure.
 */
async function runLighthouseSafe(
  url: string
): Promise<LighthouseResult | null> {
  try {
    return await runLighthouse(url);
  } catch {
    return null;
  }
}

/**
 * Attempt to run SEO audit, returning null on any failure.
 * SEO audit is non-fatal — the review continues without it.
 */
async function runSeoSafe(
  url: string
): Promise<Awaited<ReturnType<typeof runSeoAudit>> | null> {
  try {
    return await runSeoAudit(url);
  } catch {
    return null;
  }
}

/**
 * Count code findings grouped by severity.
 */
function countCodeFindingsBySeverity(
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

/**
 * Format the full review into a comprehensive text report.
 * Now includes letter grades and SEO section.
 */
export function formatFullReviewReport(result: FullReviewResult): string {
  const sections = [
    `# UIMax Review Report`,
    ``,
    `**URL:** ${result.url}`,
    `**Code Directory:** ${result.codeDirectory}`,
    `**Generated:** ${result.timestamp}`,
    ``,
  ];

  // Add letter grade report card if available
  if (result.grades) {
    sections.push(
      ...formatGradeReportCard(result.grades),
      ``,
    );
  }

  sections.push(
    `---`,
    ``,
    formatAccessibilityReport(result.accessibility),
    ``,
    `---`,
    ``,
    formatPerformanceReport(result.performance),
    ``,
  );

  // Include Lighthouse scores when available
  if (result.lighthouse) {
    sections.push(
      `---`,
      ``,
      formatLighthouseReport(result.lighthouse),
      ``,
    );
  }

  // Include SEO report when available
  if (result.seo) {
    sections.push(
      `---`,
      ``,
      formatSeoReport(result.seo),
      ``,
    );
  }

  sections.push(
    `---`,
    ``,
    formatCodeAnalysisReport(result.codeAnalysis),
  );

  return sections.join("\n");
}

/**
 * Format the letter grade report card as markdown lines.
 */
function formatGradeReportCard(grades: SectionGrades): string[] {
  return [
    `## Report Card`,
    ``,
    `| Section | Grade | Score | Rating |`,
    `|---------|-------|-------|--------|`,
    `| Accessibility | **${grades.accessibility.grade}** | ${grades.accessibility.score}/100 | ${grades.accessibility.label} |`,
    `| Performance | **${grades.performance.grade}** | ${grades.performance.score}/100 | ${grades.performance.label} |`,
    `| Best Practices | **${grades.bestPractices.grade}** | ${grades.bestPractices.score}/100 | ${grades.bestPractices.label} |`,
    `| SEO | **${grades.seo.grade}** | ${grades.seo.score}/100 | ${grades.seo.label} |`,
    `| Code Quality | **${grades.codeQuality.grade}** | ${grades.codeQuality.score}/100 | ${grades.codeQuality.label} |`,
    ``,
  ];
}
