import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock browser utilities ───────────────────────────────────────

const { mockPage, mockEvaluate, mockEvaluateOnNewDocument, mockGoto } = vi.hoisted(() => {
  const mockEvaluate = vi.fn();
  const mockEvaluateOnNewDocument = vi.fn();
  const mockGoto = vi.fn();
  const mockIsClosed = vi.fn().mockReturnValue(false);
  const mockClose = vi.fn();

  const mockPage = {
    evaluate: mockEvaluate,
    evaluateOnNewDocument: mockEvaluateOnNewDocument,
    goto: mockGoto,
    isClosed: mockIsClosed,
    close: mockClose,
  };

  return { mockPage, mockEvaluate, mockEvaluateOnNewDocument, mockGoto };
});

vi.mock("../utils/browser.js", () => ({
  createPage: vi.fn().mockResolvedValue(mockPage),
  closePage: vi.fn().mockResolvedValue(undefined),
}));

import { measurePerformance } from "../tools/performance.js";

// ── Tests ────────────────────────────────────────────────────────

describe("measurePerformance", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockEvaluateOnNewDocument.mockResolvedValue(undefined);
    mockGoto.mockResolvedValue(undefined);

    mockEvaluate.mockResolvedValue({
      loadTime: 1200,
      domContentLoaded: 800,
      firstPaint: 150,
      firstContentfulPaint: 300,
      largestContentfulPaint: 1000,
      cumulativeLayoutShift: 0.02,
      totalBlockingTime: 80,
      domNodes: 250,
      resourceCount: 20,
      totalResourceSize: 256000,
      jsHeapSize: 2097152,
    });
  });

  it("returns PerformanceMetrics with all fields", async () => {
    const result = await measurePerformance("http://localhost:3000");

    expect(result.url).toBe("http://localhost:3000");
    expect(result.timestamp).toBeDefined();
    expect(result.loadTime).toBe(1200);
    expect(result.domContentLoaded).toBe(800);
    expect(result.firstPaint).toBe(150);
    expect(result.firstContentfulPaint).toBe(300);
    expect(result.largestContentfulPaint).toBe(1000);
    expect(result.cumulativeLayoutShift).toBe(0.02);
    expect(result.totalBlockingTime).toBe(80);
    expect(result.domNodes).toBe(250);
    expect(result.resourceCount).toBe(20);
    expect(result.totalResourceSize).toBe(256000);
    expect(result.jsHeapSize).toBe(2097152);
  });

  it("sets up performance observers before navigation", async () => {
    await measurePerformance("http://localhost:3000");

    // evaluateOnNewDocument should be called before goto
    expect(mockEvaluateOnNewDocument).toHaveBeenCalledTimes(1);
    expect(mockGoto).toHaveBeenCalledWith("http://localhost:3000", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
  });

  it("handles null metrics from browser", async () => {
    mockEvaluate.mockResolvedValue({
      loadTime: 500,
      domContentLoaded: 300,
      firstPaint: null,
      firstContentfulPaint: null,
      largestContentfulPaint: null,
      cumulativeLayoutShift: null,
      totalBlockingTime: null,
      domNodes: 50,
      resourceCount: 5,
      totalResourceSize: 10000,
      jsHeapSize: null,
    });

    const result = await measurePerformance("http://localhost:3000");

    expect(result.firstPaint).toBeNull();
    expect(result.firstContentfulPaint).toBeNull();
    expect(result.largestContentfulPaint).toBeNull();
    expect(result.cumulativeLayoutShift).toBeNull();
    expect(result.totalBlockingTime).toBeNull();
    expect(result.jsHeapSize).toBeNull();
  });
});
