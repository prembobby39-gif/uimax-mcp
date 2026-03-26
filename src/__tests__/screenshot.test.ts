import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock browser utilities ───────────────────────────────────────

const { mockPage, mockSetViewport, mockGoto, mockScreenshot, mockIsClosed, mockClose } = vi.hoisted(() => {
  const mockScreenshot = vi.fn();
  const mockSetViewport = vi.fn();
  const mockGoto = vi.fn();
  const mockIsClosed = vi.fn().mockReturnValue(false);
  const mockClose = vi.fn();

  const mockPage = {
    screenshot: mockScreenshot,
    setViewport: mockSetViewport,
    goto: mockGoto,
    isClosed: mockIsClosed,
    close: mockClose,
  };

  return { mockPage, mockSetViewport, mockGoto, mockScreenshot, mockIsClosed, mockClose };
});

vi.mock("../utils/browser.js", () => ({
  createPage: vi.fn().mockResolvedValue(mockPage),
  navigateAndWait: vi.fn().mockResolvedValue(undefined),
  closePage: vi.fn().mockResolvedValue(undefined),
}));

import { captureScreenshot, captureResponsiveScreenshots } from "../tools/screenshot.js";

// ── Tests ────────────────────────────────────────────────────────

describe("captureScreenshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScreenshot.mockResolvedValue(Buffer.from("fake-png-data"));
  });

  it("returns a ScreenshotResult with base64 data", async () => {
    const result = await captureScreenshot({
      url: "http://localhost:3000",
      width: 1440,
      height: 900,
      fullPage: true,
      delay: 1000,
      deviceScaleFactor: 2,
    });

    expect(result.base64).toBe(Buffer.from("fake-png-data").toString("base64"));
    expect(result.mimeType).toBe("image/png");
    expect(result.width).toBe(1440);
    expect(result.height).toBe(900);
    expect(result.url).toBe("http://localhost:3000");
    expect(result.timestamp).toBeDefined();
  });

  it("uses default values when optional params are omitted", async () => {
    const result = await captureScreenshot({
      url: "http://localhost:3000",
    });

    expect(result.width).toBe(1440);
    expect(result.height).toBe(900);
    expect(result.url).toBe("http://localhost:3000");
  });

  it("calls page.screenshot with correct options", async () => {
    await captureScreenshot({
      url: "http://localhost:3000",
      fullPage: false,
    });

    expect(mockScreenshot).toHaveBeenCalledWith({
      type: "png",
      fullPage: false,
      encoding: "binary",
    });
  });

  it("propagates errors from browser", async () => {
    mockScreenshot.mockRejectedValueOnce(new Error("Browser crashed"));

    await expect(
      captureScreenshot({ url: "http://localhost:3000" })
    ).rejects.toThrow("Browser crashed");
  });
});

describe("captureResponsiveScreenshots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScreenshot.mockResolvedValue(Buffer.from("fake-png-data"));
  });

  it("returns 3 screenshots (mobile, tablet, desktop)", async () => {
    const results = await captureResponsiveScreenshots("http://localhost:3000");

    expect(results).toHaveLength(3);
  });

  it("returns screenshots with correct viewport widths", async () => {
    const results = await captureResponsiveScreenshots("http://localhost:3000");

    expect(results[0].width).toBe(375);   // mobile
    expect(results[1].width).toBe(768);   // tablet
    expect(results[2].width).toBe(1440);  // desktop
  });

  it("each screenshot has base64 and mimeType", async () => {
    const results = await captureResponsiveScreenshots("http://localhost:3000");

    for (const result of results) {
      expect(result.base64).toBeDefined();
      expect(result.mimeType).toBe("image/png");
    }
  });
});
