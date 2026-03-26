import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock browser utilities ───────────────────────────────────────
// vi.mock is hoisted, so we must use vi.hoisted() to create mocks
// that are available inside the factory.

const { mockScreenshot, mockEmulateMediaFeatures, mockPage } = vi.hoisted(() => {
  const mockScreenshot = vi.fn();
  const mockEmulateMediaFeatures = vi.fn();
  const mockClose = vi.fn();
  const mockIsClosed = vi.fn().mockReturnValue(false);

  const mockPage = {
    screenshot: mockScreenshot,
    emulateMediaFeatures: mockEmulateMediaFeatures,
    isClosed: mockIsClosed,
    close: mockClose,
  };

  return { mockScreenshot, mockEmulateMediaFeatures, mockPage };
});

vi.mock("../utils/browser.js", () => ({
  createPage: vi.fn().mockResolvedValue(mockPage),
  navigateAndWait: vi.fn().mockResolvedValue(undefined),
  closePage: vi.fn().mockResolvedValue(undefined),
}));

import { checkDarkMode } from "../tools/dark-mode.js";

// ── Tests ────────────────────────────────────────────────────────

describe("checkDarkMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("detects dark mode when screenshots differ", async () => {
    // First call = light screenshot, second call = dark screenshot
    mockScreenshot
      .mockResolvedValueOnce(Buffer.from("light-screenshot-data-AAAA"))
      .mockResolvedValueOnce(Buffer.from("dark-screenshot-data-BBBB"));

    const result = await checkDarkMode("http://localhost:3000");

    expect(result.hasDarkMode).toBe(true);
    expect(result.differencePercent).toBeGreaterThan(0);
    expect(result.url).toBe("http://localhost:3000");
    expect(result.lightScreenshot.mimeType).toBe("image/png");
    expect(result.darkScreenshot.mimeType).toBe("image/png");
    expect(result.timestamp).toBeDefined();
  });

  it("reports no dark mode when screenshots are identical", async () => {
    const identicalData = Buffer.from("identical-screenshot-data");
    mockScreenshot
      .mockResolvedValueOnce(identicalData)
      .mockResolvedValueOnce(identicalData);

    const result = await checkDarkMode("http://localhost:3000");

    expect(result.hasDarkMode).toBe(false);
    expect(result.differencePercent).toBe(0);
  });

  it("emulates dark media feature for the dark screenshot", async () => {
    mockScreenshot
      .mockResolvedValueOnce(Buffer.from("light"))
      .mockResolvedValueOnce(Buffer.from("dark"));

    await checkDarkMode("http://localhost:3000");

    // The dark screenshot capture should call emulateMediaFeatures
    expect(mockEmulateMediaFeatures).toHaveBeenCalledWith([
      { name: "prefers-color-scheme", value: "dark" },
    ]);
  });

  it("returns base64-encoded screenshots", async () => {
    const lightData = Buffer.from("light-data");
    const darkData = Buffer.from("dark-data");
    mockScreenshot
      .mockResolvedValueOnce(lightData)
      .mockResolvedValueOnce(darkData);

    const result = await checkDarkMode("http://localhost:3000");

    expect(result.lightScreenshot.base64).toBe(lightData.toString("base64"));
    expect(result.darkScreenshot.base64).toBe(darkData.toString("base64"));
  });

  it("calculates difference percentage correctly", async () => {
    // Completely different data should yield a high difference
    mockScreenshot
      .mockResolvedValueOnce(Buffer.from("AAAAAAAAAA"))
      .mockResolvedValueOnce(Buffer.from("BBBBBBBBBB"));

    const result = await checkDarkMode("http://localhost:3000");

    expect(result.differencePercent).toBeGreaterThan(0);
    expect(result.differencePercent).toBeLessThanOrEqual(100);
  });
});
