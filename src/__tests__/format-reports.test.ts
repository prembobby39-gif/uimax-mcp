import { describe, it, expect } from "vitest";
import type {
  AccessibilityResult,
  AccessibilityViolation,
  PerformanceMetrics,
  FullReviewResult,
  ScreenshotResult,
  CodeAnalysisResult,
} from "../types.js";
import { formatAccessibilityReport } from "../tools/accessibility.js";
import { formatPerformanceReport } from "../tools/performance.js";
import { formatFullReviewReport } from "../tools/full-review.js";

// ── Test Data Factories ──────────────────────────────────────────

function makeViolation(overrides: Partial<AccessibilityViolation> = {}): AccessibilityViolation {
  return {
    id: overrides.id ?? "color-contrast",
    impact: overrides.impact ?? "serious",
    description: overrides.description ?? "Elements must have sufficient color contrast",
    help: overrides.help ?? "Ensure sufficient contrast ratio",
    helpUrl: overrides.helpUrl ?? "https://dequeuniversity.com/rules/axe/4.4/color-contrast",
    nodes: overrides.nodes ?? [
      {
        target: ["#main > p"],
        html: "<p style=\"color:#ccc\">Low contrast text</p>",
        failureSummary: "Fix foreground or background color",
      },
    ],
  };
}

function makeAccessibilityResult(overrides: Partial<AccessibilityResult> = {}): AccessibilityResult {
  return {
    url: overrides.url ?? "http://localhost:3000",
    timestamp: overrides.timestamp ?? "2025-01-01T00:00:00.000Z",
    violations: overrides.violations ?? [],
    passes: overrides.passes ?? 42,
    incomplete: overrides.incomplete ?? 3,
    inapplicable: overrides.inapplicable ?? 10,
  };
}

function makePerformanceMetrics(overrides: Partial<PerformanceMetrics> = {}): PerformanceMetrics {
  const defaults: PerformanceMetrics = {
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
    jsHeapSize: 4194304,
  };
  return { ...defaults, ...overrides };
}

function makeScreenshotResult(): ScreenshotResult {
  return {
    base64: "fakeBase64Data",
    mimeType: "image/png",
    width: 1440,
    height: 900,
    url: "http://localhost:3000",
    timestamp: "2025-01-01T00:00:00.000Z",
  };
}

function makeCodeAnalysisResult(): CodeAnalysisResult {
  return {
    directory: "/project/src",
    timestamp: "2025-01-01T00:00:00.000Z",
    framework: "react",
    totalFiles: 5,
    totalLines: 300,
    findings: [],
    summary: {
      components: 3,
      stylesheets: 2,
      avgFileSize: 60,
      largestFiles: [{ file: "App.tsx", lines: 100 }],
    },
    configStatus: {
      loaded: false,
      path: null,
      rulesDisabled: [],
      severityOverrides: [],
    },
  };
}

// ── formatAccessibilityReport ────────────────────────────────────

describe("formatAccessibilityReport", () => {
  it("formats report header with correct stats", () => {
    const result = makeAccessibilityResult({ passes: 50, incomplete: 2 });
    const report = formatAccessibilityReport(result);

    expect(report).toContain("## Accessibility Audit Results");
    expect(report).toContain("**URL:** http://localhost:3000");
    expect(report).toContain("**Violations:** 0");
    expect(report).toContain("**Passes:** 50");
    expect(report).toContain("**Incomplete:** 2");
  });

  it("reports 'no violations found' when empty", () => {
    const result = makeAccessibilityResult();
    const report = formatAccessibilityReport(result);

    expect(report).toContain("No accessibility violations found.");
  });

  it("groups violations by impact level", () => {
    const result = makeAccessibilityResult({
      violations: [
        makeViolation({ id: "crit-rule", impact: "critical" }),
        makeViolation({ id: "serious-rule", impact: "serious" }),
        makeViolation({ id: "moderate-rule", impact: "moderate" }),
        makeViolation({ id: "minor-rule", impact: "minor" }),
      ],
    });

    const report = formatAccessibilityReport(result);

    expect(report).toContain("### CRITICAL (1)");
    expect(report).toContain("### SERIOUS (1)");
    expect(report).toContain("### MODERATE (1)");
    expect(report).toContain("### MINOR (1)");
  });

  it("includes violation details and help URL", () => {
    const violation = makeViolation({
      id: "image-alt",
      help: "Images must have alternate text",
      description: "Ensures <img> elements have alternate text or a role of none or presentation",
      helpUrl: "https://example.com/image-alt",
    });
    const result = makeAccessibilityResult({ violations: [violation] });
    const report = formatAccessibilityReport(result);

    expect(report).toContain("**image-alt**: Images must have alternate text");
    expect(report).toContain("[Learn more](https://example.com/image-alt)");
  });

  it("includes node target and fix suggestion", () => {
    const result = makeAccessibilityResult({
      violations: [makeViolation()],
    });
    const report = formatAccessibilityReport(result);

    expect(report).toContain("Element: `#main > p`");
    expect(report).toContain("Fix: Fix foreground or background color");
  });

  it("limits displayed nodes to 3", () => {
    const manyNodes = Array.from({ length: 5 }, (_, i) => ({
      target: [`#el-${i}`],
      html: `<div id="el-${i}">item</div>`,
      failureSummary: `Fix element ${i}`,
    }));
    const result = makeAccessibilityResult({
      violations: [makeViolation({ nodes: manyNodes })],
    });
    const report = formatAccessibilityReport(result);

    // Should show nodes 0, 1, 2 but not 3 or 4
    expect(report).toContain("#el-0");
    expect(report).toContain("#el-1");
    expect(report).toContain("#el-2");
    expect(report).not.toContain("#el-3");
  });
});

// ── formatPerformanceReport ──────────────────────────────────────

describe("formatPerformanceReport", () => {
  it("formats report header", () => {
    const metrics = makePerformanceMetrics();
    const report = formatPerformanceReport(metrics);

    expect(report).toContain("## Performance Metrics");
    expect(report).toContain("**URL:** http://localhost:3000");
    expect(report).toContain("### Core Web Vitals");
  });

  it("rates FCP as Good when under 1800ms", () => {
    const metrics = makePerformanceMetrics({ firstContentfulPaint: 500 });
    const report = formatPerformanceReport(metrics);

    expect(report).toContain("500ms (Good)");
  });

  it("rates FCP as Needs Improvement between 1800-3000ms", () => {
    const metrics = makePerformanceMetrics({ firstContentfulPaint: 2500 });
    const report = formatPerformanceReport(metrics);

    expect(report).toContain("2500ms (Needs Improvement)");
  });

  it("rates FCP as Poor above 3000ms", () => {
    const metrics = makePerformanceMetrics({ firstContentfulPaint: 4000 });
    const report = formatPerformanceReport(metrics);

    expect(report).toContain("4000ms (Poor)");
  });

  it("rates LCP as Good when under 2500ms", () => {
    const metrics = makePerformanceMetrics({ largestContentfulPaint: 1500 });
    const report = formatPerformanceReport(metrics);

    expect(report).toContain("1500ms (Good)");
  });

  it("rates CLS as Good when under 0.1", () => {
    const metrics = makePerformanceMetrics({ cumulativeLayoutShift: 0.05 });
    const report = formatPerformanceReport(metrics);

    expect(report).toContain("0.050 (Good)");
  });

  it("rates CLS as Needs Improvement between 0.1 and 0.25", () => {
    const metrics = makePerformanceMetrics({ cumulativeLayoutShift: 0.15 });
    const report = formatPerformanceReport(metrics);

    expect(report).toContain("0.150 (Needs Improvement)");
  });

  it("rates CLS as Poor above 0.25", () => {
    const metrics = makePerformanceMetrics({ cumulativeLayoutShift: 0.5 });
    const report = formatPerformanceReport(metrics);

    expect(report).toContain("0.500 (Poor)");
  });

  it("rates TBT as Good when under 200ms", () => {
    const metrics = makePerformanceMetrics({ totalBlockingTime: 100 });
    const report = formatPerformanceReport(metrics);

    expect(report).toContain("100ms (Good)");
  });

  it("shows N/A for null metrics", () => {
    const metrics = makePerformanceMetrics({
      firstContentfulPaint: null,
      largestContentfulPaint: null,
      cumulativeLayoutShift: null,
      totalBlockingTime: null,
    });
    const report = formatPerformanceReport(metrics);

    // Should have multiple N/A
    const naCount = (report.match(/N\/A/g) ?? []).length;
    expect(naCount).toBeGreaterThanOrEqual(4);
  });

  it("includes page metrics section", () => {
    const metrics = makePerformanceMetrics({
      loadTime: 1200,
      domContentLoaded: 800,
      domNodes: 350,
      resourceCount: 25,
      totalResourceSize: 512000,
    });
    const report = formatPerformanceReport(metrics);

    expect(report).toContain("### Page Metrics");
    expect(report).toContain("**Load Time:** 1200ms");
    expect(report).toContain("**DOM Content Loaded:** 800ms");
    expect(report).toContain("**DOM Nodes:** 350");
    expect(report).toContain("**Resources:** 25");
    expect(report).toContain("**Total Transfer Size:** 500.0 KB");
  });

  it("shows JS heap size when available", () => {
    const metrics = makePerformanceMetrics({ jsHeapSize: 4194304 });
    const report = formatPerformanceReport(metrics);

    expect(report).toContain("**JS Heap Size:** 4.0 MB");
  });

  it("omits JS heap size when null", () => {
    const metrics = makePerformanceMetrics({ jsHeapSize: null });
    const report = formatPerformanceReport(metrics);

    expect(report).not.toContain("JS Heap Size");
  });

  it("formats bytes correctly (B, KB, MB)", () => {
    // < 1024 bytes
    const metricsSmall = makePerformanceMetrics({ totalResourceSize: 512 });
    expect(formatPerformanceReport(metricsSmall)).toContain("512 B");

    // KB range
    const metricsKB = makePerformanceMetrics({ totalResourceSize: 10240 });
    expect(formatPerformanceReport(metricsKB)).toContain("10.0 KB");

    // MB range
    const metricsMB = makePerformanceMetrics({ totalResourceSize: 2097152 });
    expect(formatPerformanceReport(metricsMB)).toContain("2.0 MB");
  });
});

// ── formatFullReviewReport ───────────────────────────────────────

describe("formatFullReviewReport", () => {
  it("combines all sub-reports into a single document", () => {
    const fullResult: FullReviewResult = {
      url: "http://localhost:3000",
      codeDirectory: "/project/src",
      timestamp: "2025-01-01T00:00:00.000Z",
      screenshot: makeScreenshotResult(),
      accessibility: makeAccessibilityResult(),
      performance: makePerformanceMetrics(),
      codeAnalysis: makeCodeAnalysisResult(),
    };

    const report = formatFullReviewReport(fullResult);

    // Header
    expect(report).toContain("# UIMax Review Report");
    expect(report).toContain("**URL:** http://localhost:3000");
    expect(report).toContain("**Code Directory:** /project/src");

    // Sub-reports
    expect(report).toContain("## Accessibility Audit Results");
    expect(report).toContain("## Performance Metrics");
    expect(report).toContain("## Code Analysis Results");

    // Separators
    expect(report).toContain("---");
  });

  it("includes accessibility violations in full report", () => {
    const fullResult: FullReviewResult = {
      url: "http://localhost:3000",
      codeDirectory: "/project/src",
      timestamp: "2025-01-01T00:00:00.000Z",
      screenshot: makeScreenshotResult(),
      accessibility: makeAccessibilityResult({
        violations: [makeViolation({ id: "color-contrast", impact: "serious" })],
      }),
      performance: makePerformanceMetrics(),
      codeAnalysis: makeCodeAnalysisResult(),
    };

    const report = formatFullReviewReport(fullResult);
    expect(report).toContain("color-contrast");
    expect(report).toContain("SERIOUS");
  });
});
