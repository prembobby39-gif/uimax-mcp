import { describe, it, expect, vi, beforeEach } from "vitest";
import { PNG } from "pngjs";

// ── Mock browser utilities ───────────────────────────────────────

const { mockScreenshot, mockPage } = vi.hoisted(() => {
  const mockScreenshot = vi.fn();
  const mockClose = vi.fn();
  const mockIsClosed = vi.fn().mockReturnValue(false);

  const mockPage = {
    screenshot: mockScreenshot,
    isClosed: mockIsClosed,
    close: mockClose,
  };

  return { mockScreenshot, mockPage };
});

vi.mock("../utils/browser.js", () => ({
  createPage: vi.fn().mockResolvedValue(mockPage),
  navigateAndWait: vi.fn().mockResolvedValue(undefined),
  closePage: vi.fn().mockResolvedValue(undefined),
}));

import { compareScreenshots } from "../tools/compare.js";

// ── Test Helpers ──────────────────────────────────────────────────

function createSolidPngBuffer(
  width: number,
  height: number,
  color: { r: number; g: number; b: number; a: number },
): Buffer {
  const png = new PNG({ width, height });

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      png.data[idx] = color.r;
      png.data[idx + 1] = color.g;
      png.data[idx + 2] = color.b;
      png.data[idx + 3] = color.a;
    }
  }

  return PNG.sync.write(png);
}

const RED = { r: 255, g: 0, b: 0, a: 255 };
const BLUE = { r: 0, g: 0, b: 255, a: 255 };

// ── Tests ────────────────────────────────────────────────────────

describe("compareScreenshots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns pixel-level comparison for identical screenshots", async () => {
    const pngBuffer = createSolidPngBuffer(10, 10, RED);
    mockScreenshot
      .mockResolvedValueOnce(pngBuffer)
      .mockResolvedValueOnce(pngBuffer);

    const result = await compareScreenshots(
      "http://localhost:3000",
      "http://localhost:3001",
    );

    expect(result.differencePercent).toBe(0);
    expect(result.pixelsChanged).toBe(0);
    expect(result.urlA).toBe("http://localhost:3000");
    expect(result.urlB).toBe("http://localhost:3001");
    expect(result.screenshotA.mimeType).toBe("image/png");
    expect(result.screenshotB.mimeType).toBe("image/png");
    expect(result.diffImage).toBeTruthy();
    expect(result.dimensions).toBeDefined();
  });

  it("detects differences between different screenshots", async () => {
    const redPng = createSolidPngBuffer(10, 10, RED);
    const bluePng = createSolidPngBuffer(10, 10, BLUE);
    mockScreenshot
      .mockResolvedValueOnce(redPng)
      .mockResolvedValueOnce(bluePng);

    const result = await compareScreenshots(
      "http://localhost:3000",
      "http://localhost:3001",
    );

    expect(result.differencePercent).toBe(100);
    expect(result.pixelsChanged).toBe(100);
    expect(result.dimensions).toEqual({ width: 10, height: 10 });
  });

  it("returns a valid diff image as base64", async () => {
    const redPng = createSolidPngBuffer(10, 10, RED);
    const bluePng = createSolidPngBuffer(10, 10, BLUE);
    mockScreenshot
      .mockResolvedValueOnce(redPng)
      .mockResolvedValueOnce(bluePng);

    const result = await compareScreenshots(
      "http://localhost:3000",
      "http://localhost:3001",
    );

    // Verify the diff image is a decodable PNG
    const diffBuffer = Buffer.from(result.diffImage, "base64");
    const diffPng = PNG.sync.read(diffBuffer);
    expect(diffPng.width).toBe(10);
    expect(diffPng.height).toBe(10);
  });

  it("uses provided viewport dimensions", async () => {
    const pngBuffer = createSolidPngBuffer(10, 10, RED);
    mockScreenshot
      .mockResolvedValueOnce(pngBuffer)
      .mockResolvedValueOnce(pngBuffer);

    const result = await compareScreenshots(
      "http://localhost:3000",
      "http://localhost:3001",
      { width: 800, height: 600 },
    );

    expect(result.screenshotA.width).toBe(800);
    expect(result.screenshotA.height).toBe(600);
  });

  it("defaults to 1440x900 viewport", async () => {
    const pngBuffer = createSolidPngBuffer(10, 10, RED);
    mockScreenshot
      .mockResolvedValueOnce(pngBuffer)
      .mockResolvedValueOnce(pngBuffer);

    const result = await compareScreenshots(
      "http://localhost:3000",
      "http://localhost:3001",
    );

    expect(result.screenshotA.width).toBe(1440);
    expect(result.screenshotA.height).toBe(900);
  });

  it("includes timestamps in both screenshots", async () => {
    const pngBuffer = createSolidPngBuffer(10, 10, RED);
    mockScreenshot
      .mockResolvedValueOnce(pngBuffer)
      .mockResolvedValueOnce(pngBuffer);

    const result = await compareScreenshots(
      "http://localhost:3000",
      "http://localhost:3001",
    );

    expect(result.screenshotA.timestamp).toBeDefined();
    expect(result.screenshotB.timestamp).toBeDefined();
  });
});
