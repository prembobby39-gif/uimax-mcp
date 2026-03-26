import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock browser utilities ───────────────────────────────────────

const { mockPage, mockEvaluate } = vi.hoisted(() => {
  const mockEvaluate = vi.fn();
  const mockPage = {
    screenshot: vi.fn().mockResolvedValue(Buffer.from("fake-png")),
    setViewport: vi.fn(),
    goto: vi.fn(),
    isClosed: vi.fn().mockReturnValue(false),
    close: vi.fn(),
    evaluate: mockEvaluate,
    evaluateOnNewDocument: vi.fn(),
  };
  return { mockPage, mockEvaluate };
});

vi.mock("../utils/browser.js", () => ({
  createPage: vi.fn().mockResolvedValue(mockPage),
  navigateAndWait: vi.fn().mockResolvedValue(undefined),
  closePage: vi.fn().mockResolvedValue(undefined),
  getBrowser: vi.fn(),
}));

vi.mock("../tools/screenshot.js", () => ({
  captureScreenshot: vi.fn().mockResolvedValue({
    base64: "fakebase64",
    mimeType: "image/png",
    width: 1440,
    height: 900,
    url: "http://localhost:3000",
    timestamp: "2026-01-01T00:00:00.000Z",
  }),
}));

vi.mock("../tools/accessibility.js", () => ({
  runAccessibilityAudit: vi.fn().mockResolvedValue({
    url: "http://localhost:3000",
    timestamp: "2026-01-01T00:00:00.000Z",
    violations: [],
    passes: 10,
    incomplete: 0,
    inapplicable: 0,
  }),
}));

vi.mock("../tools/performance.js", () => ({
  measurePerformance: vi.fn().mockResolvedValue({
    url: "http://localhost:3000",
    timestamp: "2026-01-01T00:00:00.000Z",
    loadTime: 500,
    domContentLoaded: 300,
    firstPaint: 200,
    firstContentfulPaint: 250,
    largestContentfulPaint: 400,
    cumulativeLayoutShift: 0.01,
    totalBlockingTime: 50,
    domNodes: 100,
    resourceCount: 10,
    totalResourceSize: 50000,
    jsHeapSize: null,
  }),
}));

import {
  filterInternalLinks,
  normalizeUrl,
  deduplicateUrls,
  clampMaxPages,
  extractInternalLinks,
  crawlAndReview,
  formatCrawlReport,
} from "../tools/crawl.js";

// ── Pure function tests ─────────────────────────────────────────

describe("normalizeUrl", () => {
  const origin = "http://localhost:3000";

  it("returns null for non-http schemes", () => {
    expect(normalizeUrl("mailto:test@test.com", origin)).toBeNull();
    expect(normalizeUrl("javascript:void(0)", origin)).toBeNull();
    expect(normalizeUrl("tel:+1234567890", origin)).toBeNull();
  });

  it("returns null for cross-origin links", () => {
    expect(normalizeUrl("https://external.com/page", origin)).toBeNull();
    expect(normalizeUrl("http://other-host:4000/page", origin)).toBeNull();
  });

  it("strips fragment from URL", () => {
    const result = normalizeUrl("http://localhost:3000/about#section", origin);
    expect(result).toBe("http://localhost:3000/about");
  });

  it("strips trailing slash for non-root paths", () => {
    const result = normalizeUrl("http://localhost:3000/about/", origin);
    expect(result).toBe("http://localhost:3000/about");
  });

  it("keeps trailing slash for root path", () => {
    const result = normalizeUrl("http://localhost:3000/", origin);
    expect(result).toBe("http://localhost:3000/");
  });

  it("handles same-origin absolute URLs", () => {
    const result = normalizeUrl("http://localhost:3000/contact", origin);
    expect(result).toBe("http://localhost:3000/contact");
  });

  it("returns null for malformed URLs", () => {
    // URL constructor can throw for truly invalid strings when base is also malformed
    // However with a valid base, most strings are resolved. Test with a known failure case.
    expect(normalizeUrl("http://[invalid", origin)).toBeNull();
  });
});

describe("filterInternalLinks", () => {
  const origin = "http://localhost:3000";

  it("keeps only same-origin http links", () => {
    const links = [
      "http://localhost:3000/about",
      "http://localhost:3000/contact",
      "https://external.com/page",
      "mailto:test@test.com",
    ];

    const result = filterInternalLinks(links, origin);
    expect(result).toEqual([
      "http://localhost:3000/about",
      "http://localhost:3000/contact",
    ]);
  });

  it("returns empty array when no internal links found", () => {
    const links = [
      "https://external.com",
      "mailto:test@test.com",
    ];

    const result = filterInternalLinks(links, origin);
    expect(result).toEqual([]);
  });

  it("normalizes URLs during filtering", () => {
    const links = [
      "http://localhost:3000/about#section",
      "http://localhost:3000/contact/",
    ];

    const result = filterInternalLinks(links, origin);
    expect(result).toEqual([
      "http://localhost:3000/about",
      "http://localhost:3000/contact",
    ]);
  });

  it("handles empty input", () => {
    expect(filterInternalLinks([], origin)).toEqual([]);
  });
});

describe("deduplicateUrls", () => {
  it("removes duplicate URLs", () => {
    const urls = [
      "http://localhost:3000/about",
      "http://localhost:3000/contact",
      "http://localhost:3000/about",
      "http://localhost:3000/about",
    ];

    const result = deduplicateUrls(urls);
    expect(result).toEqual([
      "http://localhost:3000/about",
      "http://localhost:3000/contact",
    ]);
  });

  it("preserves order of first occurrence", () => {
    const urls = [
      "http://localhost:3000/c",
      "http://localhost:3000/a",
      "http://localhost:3000/b",
      "http://localhost:3000/a",
    ];

    const result = deduplicateUrls(urls);
    expect(result).toEqual([
      "http://localhost:3000/c",
      "http://localhost:3000/a",
      "http://localhost:3000/b",
    ]);
  });

  it("handles empty input", () => {
    expect(deduplicateUrls([])).toEqual([]);
  });

  it("returns same array when no duplicates", () => {
    const urls = ["http://a.com", "http://b.com"];
    expect(deduplicateUrls(urls)).toEqual(urls);
  });
});

describe("clampMaxPages", () => {
  it("returns default of 5 when undefined", () => {
    expect(clampMaxPages(undefined)).toBe(5);
  });

  it("clamps to minimum of 1", () => {
    expect(clampMaxPages(0)).toBe(1);
    expect(clampMaxPages(-5)).toBe(1);
  });

  it("clamps to maximum of 10", () => {
    expect(clampMaxPages(15)).toBe(10);
    expect(clampMaxPages(100)).toBe(10);
  });

  it("passes through valid values", () => {
    expect(clampMaxPages(1)).toBe(1);
    expect(clampMaxPages(5)).toBe(5);
    expect(clampMaxPages(10)).toBe(10);
    expect(clampMaxPages(7)).toBe(7);
  });
});

// ── Integration-level tests (with mocked browser) ───────────────

describe("extractInternalLinks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts and filters internal links from a page", async () => {
    mockEvaluate.mockResolvedValueOnce([
      "http://localhost:3000/about",
      "http://localhost:3000/contact",
      "https://external.com/page",
      "mailto:test@test.com",
      "http://localhost:3000/about",
    ]);

    const result = await extractInternalLinks("http://localhost:3000");

    expect(result).toEqual([
      "http://localhost:3000/about",
      "http://localhost:3000/contact",
    ]);
  });

  it("returns empty array when page has no links", async () => {
    mockEvaluate.mockResolvedValueOnce([]);

    const result = await extractInternalLinks("http://localhost:3000");
    expect(result).toEqual([]);
  });

  it("deduplicates links with fragments", async () => {
    mockEvaluate.mockResolvedValueOnce([
      "http://localhost:3000/about#section1",
      "http://localhost:3000/about#section2",
      "http://localhost:3000/about",
    ]);

    const result = await extractInternalLinks("http://localhost:3000");
    expect(result).toEqual(["http://localhost:3000/about"]);
  });
});

describe("crawlAndReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEvaluate.mockResolvedValue([]);
  });

  it("always includes the start URL in results", async () => {
    const result = await crawlAndReview("http://localhost:3000");

    expect(result.startUrl).toBe("http://localhost:3000");
    expect(result.pages.length).toBeGreaterThanOrEqual(1);
    expect(result.pages[0].url).toBe("http://localhost:3000");
  });

  it("limits pages to maxPages", async () => {
    mockEvaluate.mockResolvedValueOnce([
      "http://localhost:3000/a",
      "http://localhost:3000/b",
      "http://localhost:3000/c",
      "http://localhost:3000/d",
      "http://localhost:3000/e",
    ]);

    const result = await crawlAndReview("http://localhost:3000", 3);

    expect(result.pagesAudited).toBeLessThanOrEqual(3);
    expect(result.pagesRequested).toBe(3);
  });

  it("returns performance and accessibility data for each page", async () => {
    const result = await crawlAndReview("http://localhost:3000", 1);

    const page = result.pages[0];
    expect(page.screenshot).not.toBeNull();
    expect(page.performanceMetrics).not.toBeNull();
    expect(page.accessibilityPasses).toBe(10);
    expect(page.error).toBeNull();
  });

  it("sets pagesAudited correctly", async () => {
    mockEvaluate.mockResolvedValueOnce([
      "http://localhost:3000/about",
    ]);

    const result = await crawlAndReview("http://localhost:3000", 5);

    // Start URL + 1 discovered = 2
    expect(result.pagesAudited).toBe(2);
  });
});

describe("formatCrawlReport", () => {
  it("includes start URL and timestamp", () => {
    const result = {
      startUrl: "http://localhost:3000",
      timestamp: "2026-01-01T00:00:00.000Z",
      pagesAudited: 1,
      pagesRequested: 5,
      pages: [
        {
          url: "http://localhost:3000",
          screenshot: null,
          accessibilityIssues: [],
          accessibilityPasses: 10,
          performanceMetrics: null,
          error: null,
        },
      ],
    };

    const report = formatCrawlReport(result);
    expect(report).toContain("http://localhost:3000");
    expect(report).toContain("2026-01-01");
    expect(report).toContain("1 / 5 requested");
  });

  it("includes error messages for failed pages", () => {
    const result = {
      startUrl: "http://localhost:3000",
      timestamp: "2026-01-01T00:00:00.000Z",
      pagesAudited: 1,
      pagesRequested: 1,
      pages: [
        {
          url: "http://localhost:3000",
          screenshot: null,
          accessibilityIssues: [],
          accessibilityPasses: 0,
          performanceMetrics: null,
          error: "Navigation timeout",
        },
      ],
    };

    const report = formatCrawlReport(result);
    expect(report).toContain("Navigation timeout");
  });

  it("includes overall summary with total violations", () => {
    const result = {
      startUrl: "http://localhost:3000",
      timestamp: "2026-01-01T00:00:00.000Z",
      pagesAudited: 2,
      pagesRequested: 5,
      pages: [
        {
          url: "http://localhost:3000",
          screenshot: null,
          accessibilityIssues: [
            {
              id: "color-contrast",
              impact: "serious" as const,
              description: "Ensures contrast ratio",
              help: "Elements must have sufficient color contrast",
              helpUrl: "https://dequeuniversity.com/rules/axe/4.10/color-contrast",
              nodes: [],
            },
          ],
          accessibilityPasses: 8,
          performanceMetrics: {
            url: "http://localhost:3000",
            timestamp: "2026-01-01T00:00:00.000Z",
            loadTime: 500,
            domContentLoaded: 300,
            firstPaint: 200,
            firstContentfulPaint: 250,
            largestContentfulPaint: 400,
            cumulativeLayoutShift: 0.01,
            totalBlockingTime: 50,
            domNodes: 100,
            resourceCount: 10,
            totalResourceSize: 50000,
            jsHeapSize: null,
          },
          error: null,
        },
        {
          url: "http://localhost:3000/about",
          screenshot: null,
          accessibilityIssues: [],
          accessibilityPasses: 12,
          performanceMetrics: null,
          error: null,
        },
      ],
    };

    const report = formatCrawlReport(result);
    expect(report).toContain("Overall Summary");
    expect(report).toContain("Total accessibility violations:** 1");
    expect(report).toContain("Total pages audited:** 2");
  });

  it("includes performance metrics when available", () => {
    const result = {
      startUrl: "http://localhost:3000",
      timestamp: "2026-01-01T00:00:00.000Z",
      pagesAudited: 1,
      pagesRequested: 1,
      pages: [
        {
          url: "http://localhost:3000",
          screenshot: null,
          accessibilityIssues: [],
          accessibilityPasses: 10,
          performanceMetrics: {
            url: "http://localhost:3000",
            timestamp: "2026-01-01T00:00:00.000Z",
            loadTime: 500,
            domContentLoaded: 300,
            firstPaint: 200,
            firstContentfulPaint: 250,
            largestContentfulPaint: 400,
            cumulativeLayoutShift: 0.01,
            totalBlockingTime: 50,
            domNodes: 100,
            resourceCount: 10,
            totalResourceSize: 50000,
            jsHeapSize: null,
          },
          error: null,
        },
      ],
    };

    const report = formatCrawlReport(result);
    expect(report).toContain("Load time: 500ms");
    expect(report).toContain("DOM nodes: 100");
    expect(report).toContain("FCP: 250ms");
  });
});
