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

/**
 * Run a comprehensive UI review combining:
 * - Screenshot capture (for visual review by Claude)
 * - Accessibility audit (axe-core WCAG check)
 * - Performance metrics (Core Web Vitals)
 * - Code analysis (anti-patterns, quality, design)
 * - Lighthouse scores (optional — gracefully skipped on failure)
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

  // Run remaining audits concurrently (Lighthouse is optional)
  const [accessibility, performance, codeAnalysis, lighthouseOutcome] =
    await Promise.all([
      runAccessibilityAudit(url),
      measurePerformance(url),
      analyzeCode(codeDirectory),
      runLighthouseSafe(url),
    ]);

  return {
    url,
    codeDirectory,
    timestamp: new Date().toISOString(),
    screenshot,
    accessibility,
    performance,
    codeAnalysis,
    lighthouse: lighthouseOutcome ?? undefined,
  };
}

/**
 * Attempt to run Lighthouse, returning null on any failure.
 * Lighthouse is a heavy dependency and may not always succeed
 * (e.g., Chrome not found, timeouts, etc.). The full review
 * should continue even if Lighthouse fails.
 */
async function runLighthouseSafe(
  url: string
): Promise<LighthouseResult | null> {
  try {
    return await runLighthouse(url);
  } catch {
    // Lighthouse failure is non-fatal in the full review pipeline.
    // The performance_audit still provides Core Web Vitals via
    // the Performance API, so the review remains useful.
    return null;
  }
}

/**
 * Format the full review into a comprehensive text report.
 * The screenshot is returned separately as an image.
 */
export function formatFullReviewReport(result: FullReviewResult): string {
  const sections = [
    `# UIMax Review Report`,
    ``,
    `**URL:** ${result.url}`,
    `**Code Directory:** ${result.codeDirectory}`,
    `**Generated:** ${result.timestamp}`,
    ``,
    `---`,
    ``,
    formatAccessibilityReport(result.accessibility),
    ``,
    `---`,
    ``,
    formatPerformanceReport(result.performance),
    ``,
  ];

  // Include Lighthouse scores when available
  if (result.lighthouse) {
    sections.push(
      `---`,
      ``,
      formatLighthouseReport(result.lighthouse),
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
