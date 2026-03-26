import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Use vi.hoisted for mock data referenced in vi.mock factories ─

const {
  mockScreenshot,
  mockAccessibility,
  mockPerformance,
  mockCodeAnalysis,
} = vi.hoisted(() => {
  const mockScreenshot = {
    base64: "fakeBase64",
    mimeType: "image/png" as const,
    width: 1440,
    height: 900,
    url: "http://localhost:3000",
    timestamp: "2025-01-01T00:00:00.000Z",
  };

  const mockAccessibility = {
    url: "http://localhost:3000",
    timestamp: "2025-01-01T00:00:00.000Z",
    violations: [] as readonly never[],
    passes: 42,
    incomplete: 2,
    inapplicable: 10,
  };

  const mockPerformance = {
    url: "http://localhost:3000",
    timestamp: "2025-01-01T00:00:00.000Z",
    loadTime: 1200,
    domContentLoaded: 800,
    firstPaint: 200,
    firstContentfulPaint: 500,
    largestContentfulPaint: 1500,
    cumulativeLayoutShift: 0.05,
    totalBlockingTime: 100,
    domNodes: 350,
    resourceCount: 25,
    totalResourceSize: 512000,
    jsHeapSize: null,
  };

  const mockCodeAnalysis = {
    directory: "/project/src",
    timestamp: "2025-01-01T00:00:00.000Z",
    framework: "react",
    totalFiles: 5,
    totalLines: 300,
    findings: [] as readonly never[],
    summary: {
      components: 3,
      stylesheets: 2,
      avgFileSize: 60,
      largestFiles: [{ file: "App.tsx", lines: 100 }],
    },
    configStatus: {
      loaded: false,
      path: null,
      rulesDisabled: [] as readonly string[],
      severityOverrides: [] as readonly string[],
    },
  };

  return { mockScreenshot, mockAccessibility, mockPerformance, mockCodeAnalysis };
});

vi.mock("../tools/screenshot.js", () => ({
  captureScreenshot: vi.fn().mockResolvedValue(mockScreenshot),
}));

vi.mock("../tools/accessibility.js", () => ({
  runAccessibilityAudit: vi.fn().mockResolvedValue(mockAccessibility),
  formatAccessibilityReport: vi.fn().mockReturnValue("## Accessibility Report"),
}));

vi.mock("../tools/performance.js", () => ({
  measurePerformance: vi.fn().mockResolvedValue(mockPerformance),
  formatPerformanceReport: vi.fn().mockReturnValue("## Performance Report"),
}));

vi.mock("../tools/code-analysis.js", () => ({
  analyzeCode: vi.fn().mockResolvedValue(mockCodeAnalysis),
  formatCodeAnalysisReport: vi.fn().mockReturnValue("## Code Analysis Report"),
}));

vi.mock("../tools/lighthouse.js", () => ({
  runLighthouse: vi.fn().mockResolvedValue(null),
  formatLighthouseReport: vi.fn().mockReturnValue("## Lighthouse Report"),
  LighthouseResult: {},
}));

import { runFullReview, formatFullReviewReport } from "../tools/full-review.js";

// ── Tests ────────────────────────────────────────────────────────

describe("runFullReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a complete FullReviewResult", async () => {
    const result = await runFullReview("http://localhost:3000", "/project/src");

    expect(result.url).toBe("http://localhost:3000");
    expect(result.codeDirectory).toBe("/project/src");
    expect(result.timestamp).toBeDefined();
    expect(result.screenshot).toBeDefined();
    expect(result.accessibility).toBeDefined();
    expect(result.performance).toBeDefined();
    expect(result.codeAnalysis).toBeDefined();
  });

  it("uses custom viewport when provided", async () => {
    const result = await runFullReview("http://localhost:3000", "/project/src", {
      width: 800,
      height: 600,
    });

    expect(result).toBeDefined();
    expect(result.screenshot).toBeDefined();
  });

  it("uses default viewport when not provided", async () => {
    const result = await runFullReview("http://localhost:3000", "/project/src");

    expect(result).toBeDefined();
  });

  it("contains screenshot, accessibility, performance, and code analysis data", async () => {
    const result = await runFullReview("http://localhost:3000", "/project/src");

    expect(result.screenshot.base64).toBe("fakeBase64");
    expect(result.accessibility.passes).toBe(42);
    expect(result.performance.loadTime).toBe(1200);
    expect(result.codeAnalysis.framework).toBe("react");
  });
});

describe("formatFullReviewReport (with mocked sub-formatters)", () => {
  it("includes all section headers", () => {
    const result = {
      url: "http://localhost:3000",
      codeDirectory: "/project/src",
      timestamp: "2025-01-01T00:00:00.000Z",
      screenshot: mockScreenshot,
      accessibility: mockAccessibility as any,
      performance: mockPerformance,
      codeAnalysis: mockCodeAnalysis as any,
    };

    const report = formatFullReviewReport(result);

    expect(report).toContain("# UIMax Review Report");
    expect(report).toContain("**URL:** http://localhost:3000");
    expect(report).toContain("**Code Directory:** /project/src");
    expect(report).toContain("## Accessibility Report");
    expect(report).toContain("## Performance Report");
    expect(report).toContain("## Code Analysis Report");
  });
});
