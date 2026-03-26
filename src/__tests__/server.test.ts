import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

// ── Mock all browser/tool dependencies ───────────────────────────

const {
  mockCaptureScreenshot,
  mockCaptureResponsiveScreenshots,
  mockRunAccessibilityAudit,
  mockFormatAccessibilityReport,
  mockMeasurePerformance,
  mockFormatPerformanceReport,
  mockAnalyzeCode,
  mockFormatCodeAnalysisReport,
  mockRunFullReview,
  mockFormatFullReviewReport,
  mockCheckDarkMode,
  mockCloseBrowser,
} = vi.hoisted(() => ({
  mockCaptureScreenshot: vi.fn(),
  mockCaptureResponsiveScreenshots: vi.fn(),
  mockRunAccessibilityAudit: vi.fn(),
  mockFormatAccessibilityReport: vi.fn(),
  mockMeasurePerformance: vi.fn(),
  mockFormatPerformanceReport: vi.fn(),
  mockAnalyzeCode: vi.fn(),
  mockFormatCodeAnalysisReport: vi.fn(),
  mockRunFullReview: vi.fn(),
  mockFormatFullReviewReport: vi.fn(),
  mockCheckDarkMode: vi.fn(),
  mockCloseBrowser: vi.fn(),
}));

vi.mock("../utils/browser.js", () => ({
  closeBrowser: mockCloseBrowser,
}));

vi.mock("../tools/screenshot.js", () => ({
  captureScreenshot: mockCaptureScreenshot,
  captureResponsiveScreenshots: mockCaptureResponsiveScreenshots,
}));

vi.mock("../tools/accessibility.js", () => ({
  runAccessibilityAudit: mockRunAccessibilityAudit,
  formatAccessibilityReport: mockFormatAccessibilityReport,
}));

vi.mock("../tools/performance.js", () => ({
  measurePerformance: mockMeasurePerformance,
  formatPerformanceReport: mockFormatPerformanceReport,
}));

vi.mock("../tools/code-analysis.js", () => ({
  analyzeCode: mockAnalyzeCode,
  formatCodeAnalysisReport: mockFormatCodeAnalysisReport,
}));

vi.mock("../tools/full-review.js", () => ({
  runFullReview: mockRunFullReview,
  formatFullReviewReport: mockFormatFullReviewReport,
}));

vi.mock("../tools/dark-mode.js", () => ({
  checkDarkMode: mockCheckDarkMode,
}));

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../server.js";

// ── Shared setup ─────────────────────────────────────────────────

let client: Client;

beforeAll(async () => {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  client = new Client({ name: "test-client", version: "1.0.0" });

  await server.connect(serverTransport);
  await client.connect(clientTransport);
});

afterAll(async () => {
  await client.close();
});

// ── Default mock returns ─────────────────────────────────────────

function setupDefaultMocks(): void {
  mockCaptureScreenshot.mockResolvedValue({
    base64: Buffer.from("fake-png-data").toString("base64"),
    mimeType: "image/png",
    width: 1440,
    height: 900,
    url: "http://localhost:3000",
    timestamp: "2025-01-01T00:00:00.000Z",
  });

  const validBase64 = Buffer.from("fake-png-data").toString("base64");
  mockCaptureResponsiveScreenshots.mockResolvedValue([
    { base64: validBase64, mimeType: "image/png", width: 375, height: 812, url: "http://localhost:3000", timestamp: "t" },
    { base64: validBase64, mimeType: "image/png", width: 768, height: 1024, url: "http://localhost:3000", timestamp: "t" },
    { base64: validBase64, mimeType: "image/png", width: 1440, height: 900, url: "http://localhost:3000", timestamp: "t" },
  ]);

  mockRunAccessibilityAudit.mockResolvedValue({
    url: "http://localhost:3000",
    timestamp: "2025-01-01T00:00:00.000Z",
    violations: [],
    passes: 42,
    incomplete: 2,
    inapplicable: 10,
  });
  mockFormatAccessibilityReport.mockReturnValue("## A11y Report");

  mockMeasurePerformance.mockResolvedValue({
    url: "http://localhost:3000",
    timestamp: "t",
    loadTime: 1000,
    domContentLoaded: 500,
    firstPaint: 100,
    firstContentfulPaint: 200,
    largestContentfulPaint: 800,
    cumulativeLayoutShift: 0.01,
    totalBlockingTime: 50,
    domNodes: 100,
    resourceCount: 10,
    totalResourceSize: 50000,
    jsHeapSize: null,
  });
  mockFormatPerformanceReport.mockReturnValue("## Perf Report");

  mockAnalyzeCode.mockResolvedValue({
    directory: "/project/src",
    timestamp: "t",
    framework: "react",
    totalFiles: 5,
    totalLines: 300,
    findings: [],
    summary: { components: 3, stylesheets: 2, avgFileSize: 60, largestFiles: [] },
    configStatus: { loaded: false, path: null, rulesDisabled: [], severityOverrides: [] },
  });
  mockFormatCodeAnalysisReport.mockReturnValue("## Code Report");

  mockRunFullReview.mockResolvedValue({
    url: "http://localhost:3000",
    codeDirectory: "/project/src",
    timestamp: "2025-01-01T00:00:00.000Z",
    screenshot: {
      base64: Buffer.from("fake-png-data").toString("base64"),
      mimeType: "image/png",
      width: 1440,
      height: 900,
      url: "http://localhost:3000",
      timestamp: "t",
    },
    accessibility: {
      url: "http://localhost:3000",
      timestamp: "t",
      violations: [],
      passes: 42,
      incomplete: 2,
      inapplicable: 10,
    },
    performance: {
      url: "http://localhost:3000",
      timestamp: "t",
      loadTime: 1000,
      domContentLoaded: 500,
      firstPaint: 100,
      firstContentfulPaint: 200,
      largestContentfulPaint: 800,
      cumulativeLayoutShift: 0.01,
      totalBlockingTime: 50,
      domNodes: 100,
      resourceCount: 10,
      totalResourceSize: 50000,
      jsHeapSize: null,
    },
    codeAnalysis: {
      directory: "/project/src",
      timestamp: "t",
      framework: "react",
      totalFiles: 5,
      totalLines: 300,
      findings: [],
      summary: { components: 3, stylesheets: 2, avgFileSize: 60, largestFiles: [] },
      configStatus: { loaded: false, path: null, rulesDisabled: [], severityOverrides: [] },
    },
  });
  mockFormatFullReviewReport.mockReturnValue("## Full Report");

  mockCheckDarkMode.mockResolvedValue({
    hasDarkMode: true,
    differencePercent: 35.5,
    lightScreenshot: { base64: Buffer.from("light-data").toString("base64"), mimeType: "image/png" },
    darkScreenshot: { base64: Buffer.from("dark-data").toString("base64"), mimeType: "image/png" },
    url: "http://localhost:3000",
    timestamp: "2025-01-01T00:00:00.000Z",
  });
}

// ── Server creation ──────────────────────────────────────────────

describe("createServer", () => {
  it("creates an MCP server instance", () => {
    const server = createServer();
    expect(server).toBeDefined();
    expect(typeof server.connect).toBe("function");
  });

  it("can be created multiple times", () => {
    const s1 = createServer();
    const s2 = createServer();
    expect(s1).not.toBe(s2);
  });
});

// ── Tool: review_ui ──────────────────────────────────────────────

describe("tool: review_ui", () => {
  it("returns screenshot image and audit report", async () => {
    setupDefaultMocks();

    const result = await client.callTool({
      name: "review_ui",
      arguments: {
        url: "http://localhost:3000",
        codeDirectory: "/project/src",
      },
    });

    expect(result.isError).toBeFalsy();
    expect(result.content).toBeDefined();

    // Should include text and image content
    const types = (result.content as Array<{ type: string }>).map((c) => c.type);
    expect(types).toContain("text");
    expect(types).toContain("image");
  });

  it("returns error when runFullReview throws", async () => {
    setupDefaultMocks();
    mockRunFullReview.mockRejectedValueOnce(new Error("Browser crashed"));

    const result = await client.callTool({
      name: "review_ui",
      arguments: {
        url: "http://localhost:3000",
        codeDirectory: "/project/src",
      },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("UI review failed");
    expect(text).toContain("Browser crashed");
  });
});

// ── Tool: quick_review ───────────────────────────────────────────

describe("tool: quick_review", () => {
  it("returns screenshot with design prompt", async () => {
    setupDefaultMocks();

    const result = await client.callTool({
      name: "quick_review",
      arguments: { url: "http://localhost:3000" },
    });

    expect(result.isError).toBeFalsy();
    const types = (result.content as Array<{ type: string }>).map((c) => c.type);
    expect(types).toContain("image");
    expect(types).toContain("text");
  });

  it("returns error on failure", async () => {
    setupDefaultMocks();
    mockCaptureScreenshot.mockRejectedValueOnce(new Error("No Chrome"));

    const result = await client.callTool({
      name: "quick_review",
      arguments: { url: "http://localhost:3000" },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Quick review failed");
  });
});

// ── Tool: screenshot ─────────────────────────────────────────────

describe("tool: screenshot", () => {
  it("returns captured screenshot", async () => {
    setupDefaultMocks();

    const result = await client.callTool({
      name: "screenshot",
      arguments: { url: "http://localhost:3000" },
    });

    expect(result.isError).toBeFalsy();
    const types = (result.content as Array<{ type: string }>).map((c) => c.type);
    expect(types).toContain("image");
  });

  it("returns error on failure", async () => {
    setupDefaultMocks();
    mockCaptureScreenshot.mockRejectedValueOnce(new Error("Timeout"));

    const result = await client.callTool({
      name: "screenshot",
      arguments: { url: "http://localhost:3000" },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Screenshot failed");
  });
});

// ── Tool: responsive_screenshots ─────────────────────────────────

describe("tool: responsive_screenshots", () => {
  it("returns 3 viewport screenshots", async () => {
    setupDefaultMocks();

    const result = await client.callTool({
      name: "responsive_screenshots",
      arguments: { url: "http://localhost:3000" },
    });

    expect(result.isError).toBeFalsy();
    const images = (result.content as Array<{ type: string }>).filter((c) => c.type === "image");
    expect(images).toHaveLength(3);
  });

  it("returns error on failure", async () => {
    setupDefaultMocks();
    mockCaptureResponsiveScreenshots.mockRejectedValueOnce(new Error("Fail"));

    const result = await client.callTool({
      name: "responsive_screenshots",
      arguments: { url: "http://localhost:3000" },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Responsive screenshots failed");
  });
});

// ── Tool: check_dark_mode ────────────────────────────────────────

describe("tool: check_dark_mode", () => {
  it("returns dark mode detection result with screenshots", async () => {
    setupDefaultMocks();

    const result = await client.callTool({
      name: "check_dark_mode",
      arguments: { url: "http://localhost:3000" },
    });

    expect(result.isError).toBeFalsy();
    const images = (result.content as Array<{ type: string }>).filter((c) => c.type === "image");
    expect(images).toHaveLength(2); // light + dark
  });

  it("indicates when dark mode is not detected", async () => {
    setupDefaultMocks();
    mockCheckDarkMode.mockResolvedValueOnce({
      hasDarkMode: false,
      differencePercent: 0,
      lightScreenshot: { base64: Buffer.from("same-data").toString("base64"), mimeType: "image/png" },
      darkScreenshot: { base64: Buffer.from("same-data").toString("base64"), mimeType: "image/png" },
      url: "http://localhost:3000",
      timestamp: "t",
    });

    const result = await client.callTool({
      name: "check_dark_mode",
      arguments: { url: "http://localhost:3000" },
    });

    expect(result.isError).toBeFalsy();
    const texts = (result.content as Array<{ type: string; text?: string }>)
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");
    expect(texts).toContain("No dark mode detected");
  });

  it("returns error on failure", async () => {
    setupDefaultMocks();
    mockCheckDarkMode.mockRejectedValueOnce(new Error("No browser"));

    const result = await client.callTool({
      name: "check_dark_mode",
      arguments: { url: "http://localhost:3000" },
    });

    expect(result.isError).toBe(true);
  });
});

// ── Tool: accessibility_audit ────────────────────────────────────

describe("tool: accessibility_audit", () => {
  it("returns formatted accessibility report", async () => {
    setupDefaultMocks();

    const result = await client.callTool({
      name: "accessibility_audit",
      arguments: { url: "http://localhost:3000" },
    });

    expect(result.isError).toBeFalsy();
    const texts = (result.content as Array<{ type: string; text: string }>).map((c) => c.text);
    expect(texts[0]).toContain("A11y Report");
  });

  it("returns error on failure", async () => {
    setupDefaultMocks();
    mockRunAccessibilityAudit.mockRejectedValueOnce(new Error("axe failed"));

    const result = await client.callTool({
      name: "accessibility_audit",
      arguments: { url: "http://localhost:3000" },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Accessibility audit failed");
  });
});

// ── Tool: performance_audit ──────────────────────────────────────

describe("tool: performance_audit", () => {
  it("returns formatted performance report", async () => {
    setupDefaultMocks();

    const result = await client.callTool({
      name: "performance_audit",
      arguments: { url: "http://localhost:3000" },
    });

    expect(result.isError).toBeFalsy();
    const texts = (result.content as Array<{ type: string; text: string }>).map((c) => c.text);
    expect(texts[0]).toContain("Perf Report");
  });

  it("returns error on failure", async () => {
    setupDefaultMocks();
    mockMeasurePerformance.mockRejectedValueOnce(new Error("timeout"));

    const result = await client.callTool({
      name: "performance_audit",
      arguments: { url: "http://localhost:3000" },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Performance audit failed");
  });
});

// ── Tool: analyze_code ───────────────────────────────────────────

describe("tool: analyze_code", () => {
  it("returns formatted code analysis report", async () => {
    setupDefaultMocks();

    const result = await client.callTool({
      name: "analyze_code",
      arguments: { directory: "/project/src" },
    });

    expect(result.isError).toBeFalsy();
    const texts = (result.content as Array<{ type: string; text: string }>).map((c) => c.text);
    expect(texts[0]).toContain("Code Report");
  });

  it("returns error on failure", async () => {
    setupDefaultMocks();
    mockAnalyzeCode.mockRejectedValueOnce(new Error("dir not found"));

    const result = await client.callTool({
      name: "analyze_code",
      arguments: { directory: "/nonexistent" },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Code analysis failed");
  });
});

// ── Prompts ──────────────────────────────────────────────────────

describe("prompts", () => {
  it("returns ui-review prompt", async () => {
    const result = await client.getPrompt({ name: "ui-review" });

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe("user");
    const content = result.messages[0].content;
    expect(content.type).toBe("text");
    if (content.type === "text") {
      expect(content.text).toContain("world-class frontend engineer");
    }
  });

  it("returns responsive-review prompt", async () => {
    const result = await client.getPrompt({ name: "responsive-review" });

    expect(result.messages).toHaveLength(1);
    const content = result.messages[0].content;
    if (content.type === "text") {
      expect(content.text).toContain("375px");
      expect(content.text).toContain("768px");
      expect(content.text).toContain("1440px");
    }
  });

  it("returns quick-design-review prompt", async () => {
    const result = await client.getPrompt({ name: "quick-design-review" });

    expect(result.messages).toHaveLength(1);
    const content = result.messages[0].content;
    if (content.type === "text") {
      expect(content.text).toContain("senior UI designer");
    }
  });
});
