import type {
  CrawlResult,
  CrawlPageResult,
  AccessibilityViolation,
  PerformanceMetrics,
  ScreenshotResult,
} from "../types.js";
import { createPage, navigateAndWait, closePage } from "../utils/browser.js";
import { captureScreenshot } from "./screenshot.js";
import { runAccessibilityAudit } from "./accessibility.js";
import { measurePerformance } from "./performance.js";

// ── Constants ──────────────────────────────────────────────────────

const DEFAULT_MAX_PAGES = 5;
const ABSOLUTE_MAX_PAGES = 10;

// ── Link Extraction ────────────────────────────────────────────────

/**
 * Extract all internal (same-origin) links from an HTML page.
 * Returns a deduplicated array of absolute URLs, excluding
 * fragments, mailto, tel, and javascript: links.
 */
export async function extractInternalLinks(
  pageUrl: string
): Promise<readonly string[]> {
  const page = await createPage(1440, 900);

  try {
    await navigateAndWait(page, pageUrl, 500);

    const rawLinks: string[] = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll("a[href]"));
      return anchors.map((a) => (a as HTMLAnchorElement).href);
    });

    const origin = new URL(pageUrl).origin;
    return deduplicateUrls(filterInternalLinks(rawLinks, origin));
  } finally {
    await closePage(page);
  }
}

/**
 * Filter links to only same-origin URLs, removing fragments,
 * non-http schemes, and normalizing paths.
 */
export function filterInternalLinks(
  links: readonly string[],
  origin: string
): readonly string[] {
  return links.reduce<readonly string[]>((acc, link) => {
    const normalized = normalizeUrl(link, origin);
    if (normalized === null) return acc;
    return [...acc, normalized];
  }, []);
}

/**
 * Normalize a URL: resolve relative, strip fragments, validate same-origin.
 * Returns null if the URL should be excluded.
 */
export function normalizeUrl(
  link: string,
  origin: string
): string | null {
  try {
    const url = new URL(link, origin);

    // Only http(s) links
    if (!url.protocol.startsWith("http")) return null;

    // Same-origin check
    if (url.origin !== origin) return null;

    // Strip fragment
    url.hash = "";

    // Strip trailing slash for consistency (unless it's the root)
    const normalized = url.toString();
    return normalized.endsWith("/") && url.pathname !== "/"
      ? normalized.slice(0, -1)
      : normalized;
  } catch {
    return null;
  }
}

/**
 * Remove duplicate URLs while preserving order.
 */
export function deduplicateUrls(
  urls: readonly string[]
): readonly string[] {
  const seen = new Set<string>();
  return urls.filter((url) => {
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

/**
 * Clamp maxPages within valid bounds.
 */
export function clampMaxPages(maxPages: number | undefined): number {
  const requested = maxPages ?? DEFAULT_MAX_PAGES;
  return Math.max(1, Math.min(requested, ABSOLUTE_MAX_PAGES));
}

// ── Per-Page Audit ─────────────────────────────────────────────────

/**
 * Run a lightweight audit on a single page: screenshot + accessibility + performance.
 * Returns a CrawlPageResult; never throws — errors are captured in the result.
 */
async function auditSinglePage(url: string): Promise<CrawlPageResult> {
  try {
    const [screenshot, accessibility, performance] = await Promise.all([
      captureScreenshotSafe(url),
      runAccessibilityAuditSafe(url),
      measurePerformanceSafe(url),
    ]);

    return {
      url,
      screenshot,
      accessibilityIssues: accessibility?.violations ?? [],
      accessibilityPasses: accessibility?.passes ?? 0,
      performanceMetrics: performance,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      url,
      screenshot: null,
      accessibilityIssues: [],
      accessibilityPasses: 0,
      performanceMetrics: null,
      error: message,
    };
  }
}

/**
 * Capture a screenshot, returning null on failure.
 */
async function captureScreenshotSafe(
  url: string
): Promise<ScreenshotResult | null> {
  try {
    return await captureScreenshot({
      url,
      width: 1440,
      height: 900,
      fullPage: true,
      delay: 1000,
      deviceScaleFactor: 2,
    });
  } catch {
    return null;
  }
}

/**
 * Run accessibility audit, returning null on failure.
 */
async function runAccessibilityAuditSafe(
  url: string
): Promise<{ violations: readonly AccessibilityViolation[]; passes: number } | null> {
  try {
    const result = await runAccessibilityAudit(url);
    return { violations: result.violations, passes: result.passes };
  } catch {
    return null;
  }
}

/**
 * Measure performance, returning null on failure.
 */
async function measurePerformanceSafe(
  url: string
): Promise<PerformanceMetrics | null> {
  try {
    return await measurePerformance(url);
  } catch {
    return null;
  }
}

// ── Main Crawl Entrypoint ──────────────────────────────────────────

/**
 * Crawl a website from a starting URL and run lightweight audits
 * (screenshot + accessibility + performance) on each discovered page.
 *
 * - Extracts internal links from the starting page
 * - Deduplicates and limits to maxPages
 * - Audits each page independently; failures on one page don't stop others
 * - Does NOT run full Lighthouse (too slow for multi-page crawl)
 */
export async function crawlAndReview(
  startUrl: string,
  maxPages?: number
): Promise<CrawlResult> {
  const limit = clampMaxPages(maxPages);

  // Always include the start URL, then discover more
  const discoveredLinks = await extractInternalLinks(startUrl);

  // Build final page list: start URL first, then discovered (up to limit)
  const allUrls = deduplicateUrls([startUrl, ...discoveredLinks]);
  const pagesToAudit = allUrls.slice(0, limit);

  // Audit each page (sequentially to avoid overloading the browser)
  const pages: CrawlPageResult[] = [];
  for (const url of pagesToAudit) {
    const result = await auditSinglePage(url);
    pages.push(result);
  }

  return {
    startUrl,
    timestamp: new Date().toISOString(),
    pagesAudited: pages.length,
    pagesRequested: limit,
    pages,
  };
}

// ── Report Formatting ──────────────────────────────────────────────

/**
 * Format a CrawlResult into a human-readable summary report.
 */
export function formatCrawlReport(result: CrawlResult): string {
  const sections: string[] = [
    `# Crawl & Review Report`,
    ``,
    `**Start URL:** ${result.startUrl}`,
    `**Timestamp:** ${result.timestamp}`,
    `**Pages audited:** ${result.pagesAudited} / ${result.pagesRequested} requested`,
    ``,
    `---`,
    ``,
  ];

  for (const page of result.pages) {
    sections.push(formatPageSummary(page));
    sections.push(`---`);
    sections.push(``);
  }

  sections.push(formatOverallSummary(result));

  return sections.join("\n");
}

/**
 * Format a single page's audit results.
 */
function formatPageSummary(page: CrawlPageResult): string {
  const lines: string[] = [
    `## ${page.url}`,
    ``,
  ];

  if (page.error) {
    lines.push(`**Error:** ${page.error}`);
    lines.push(``);
    return lines.join("\n");
  }

  // Accessibility summary
  const violationCount = page.accessibilityIssues.length;
  const a11yStatus = violationCount === 0
    ? "No violations found"
    : `${violationCount} violation(s)`;
  lines.push(`**Accessibility:** ${a11yStatus} | ${page.accessibilityPasses} passes`);

  if (violationCount > 0) {
    for (const v of page.accessibilityIssues.slice(0, 5)) {
      lines.push(`  - [${v.impact}] ${v.id}: ${v.help}`);
    }
    if (violationCount > 5) {
      lines.push(`  - ... and ${violationCount - 5} more`);
    }
  }

  // Performance summary
  if (page.performanceMetrics) {
    const perf = page.performanceMetrics;
    lines.push(``);
    lines.push(`**Performance:**`);
    lines.push(`  - Load time: ${perf.loadTime.toFixed(0)}ms`);
    lines.push(`  - DOM nodes: ${perf.domNodes}`);
    if (perf.firstContentfulPaint !== null) {
      lines.push(`  - FCP: ${perf.firstContentfulPaint.toFixed(0)}ms`);
    }
    if (perf.largestContentfulPaint !== null) {
      lines.push(`  - LCP: ${perf.largestContentfulPaint.toFixed(0)}ms`);
    }
    if (perf.cumulativeLayoutShift !== null) {
      lines.push(`  - CLS: ${perf.cumulativeLayoutShift.toFixed(3)}`);
    }
  } else {
    lines.push(``);
    lines.push(`**Performance:** unavailable`);
  }

  lines.push(``);
  return lines.join("\n");
}

/**
 * Format an overall summary across all crawled pages.
 */
function formatOverallSummary(result: CrawlResult): string {
  const totalViolations = result.pages.reduce(
    (sum, p) => sum + p.accessibilityIssues.length,
    0
  );
  const failedPages = result.pages.filter((p) => p.error !== null).length;
  const avgLoadTime = computeAverageLoadTime(result.pages);

  return [
    `## Overall Summary`,
    ``,
    `- **Total pages audited:** ${result.pagesAudited}`,
    `- **Pages with errors:** ${failedPages}`,
    `- **Total accessibility violations:** ${totalViolations}`,
    `- **Average load time:** ${avgLoadTime !== null ? `${avgLoadTime.toFixed(0)}ms` : "N/A"}`,
  ].join("\n");
}

/**
 * Compute the average load time across pages that have performance data.
 */
function computeAverageLoadTime(
  pages: readonly CrawlPageResult[]
): number | null {
  const loadTimes = pages
    .filter((p): p is CrawlPageResult & { performanceMetrics: PerformanceMetrics } =>
      p.performanceMetrics !== null
    )
    .map((p) => p.performanceMetrics.loadTime);

  if (loadTimes.length === 0) return null;
  return loadTimes.reduce((sum, t) => sum + t, 0) / loadTimes.length;
}
