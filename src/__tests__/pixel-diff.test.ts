import { describe, it, expect } from "vitest";
import { PNG } from "pngjs";
import { computePixelDiff } from "../utils/pixel-diff.js";

// ── Test Helpers ──────────────────────────────────────────────────

/**
 * Create a solid-color PNG and return it as a base64 string.
 */
function createSolidPng(
  width: number,
  height: number,
  color: { r: number; g: number; b: number; a: number },
): string {
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

  const buffer = PNG.sync.write(png);
  return buffer.toString("base64");
}

/**
 * Create a PNG that is half one color and half another (split vertically).
 */
function createSplitPng(
  width: number,
  height: number,
  leftColor: { r: number; g: number; b: number; a: number },
  rightColor: { r: number; g: number; b: number; a: number },
): string {
  const png = new PNG({ width, height });
  const midpoint = Math.floor(width / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const color = x < midpoint ? leftColor : rightColor;
      png.data[idx] = color.r;
      png.data[idx + 1] = color.g;
      png.data[idx + 2] = color.b;
      png.data[idx + 3] = color.a;
    }
  }

  const buffer = PNG.sync.write(png);
  return buffer.toString("base64");
}

// ── Constants ────────────────────────────────────────────────────

const RED = { r: 255, g: 0, b: 0, a: 255 };
const GREEN = { r: 0, g: 255, b: 0, a: 255 };
const BLUE = { r: 0, g: 0, b: 255, a: 255 };
const WHITE = { r: 255, g: 255, b: 255, a: 255 };

// ── Tests ────────────────────────────────────────────────────────

describe("computePixelDiff", () => {
  describe("identical images", () => {
    it("returns 0% difference for identical images", () => {
      const base64 = createSolidPng(10, 10, RED);

      const result = computePixelDiff({ base64A: base64, base64B: base64 });

      expect(result.differencePercent).toBe(0);
      expect(result.pixelsChanged).toBe(0);
      expect(result.totalPixels).toBe(100);
      expect(result.dimensions).toEqual({ width: 10, height: 10 });
    });

    it("returns 0% for two separately created identical images", () => {
      const base64A = createSolidPng(20, 20, BLUE);
      const base64B = createSolidPng(20, 20, BLUE);

      const result = computePixelDiff({ base64A, base64B });

      expect(result.differencePercent).toBe(0);
      expect(result.pixelsChanged).toBe(0);
    });
  });

  describe("completely different images", () => {
    it("returns 100% difference for fully different solid colors", () => {
      const base64A = createSolidPng(10, 10, RED);
      const base64B = createSolidPng(10, 10, BLUE);

      const result = computePixelDiff({ base64A, base64B });

      expect(result.differencePercent).toBe(100);
      expect(result.pixelsChanged).toBe(100);
      expect(result.totalPixels).toBe(100);
    });
  });

  describe("partially different images", () => {
    it("detects roughly 50% difference for half-changed images", () => {
      // Image A: all red
      const base64A = createSolidPng(10, 10, RED);
      // Image B: left half red, right half green
      const base64B = createSplitPng(10, 10, RED, GREEN);

      const result = computePixelDiff({ base64A, base64B });

      // Right half (5 of 10 columns) should differ = 50%
      expect(result.differencePercent).toBe(50);
      expect(result.pixelsChanged).toBe(50);
    });
  });

  describe("different dimensions", () => {
    it("handles images with different widths", () => {
      const base64A = createSolidPng(10, 10, RED);
      const base64B = createSolidPng(20, 10, RED);

      const result = computePixelDiff({ base64A, base64B });

      // The bounding box should be 20x10
      expect(result.dimensions).toEqual({ width: 20, height: 10 });
      // The extra 10 columns in B will be transparent black in A's resized version,
      // but red in B, so those pixels should differ
      expect(result.pixelsChanged).toBeGreaterThan(0);
    });

    it("handles images with different heights", () => {
      const base64A = createSolidPng(10, 10, GREEN);
      const base64B = createSolidPng(10, 20, GREEN);

      const result = computePixelDiff({ base64A, base64B });

      expect(result.dimensions).toEqual({ width: 10, height: 20 });
      expect(result.pixelsChanged).toBeGreaterThan(0);
    });
  });

  describe("diff image output", () => {
    it("returns a valid base64 PNG as the diff image", () => {
      const base64A = createSolidPng(10, 10, RED);
      const base64B = createSolidPng(10, 10, GREEN);

      const result = computePixelDiff({ base64A, base64B });

      // Should be a non-empty base64 string
      expect(result.diffImageBase64).toBeTruthy();
      expect(typeof result.diffImageBase64).toBe("string");

      // Should decode to a valid PNG
      const buffer = Buffer.from(result.diffImageBase64, "base64");
      const diffPng = PNG.sync.read(buffer);
      expect(diffPng.width).toBe(10);
      expect(diffPng.height).toBe(10);
    });

    it("diff image has correct dimensions for different-sized inputs", () => {
      const base64A = createSolidPng(10, 10, RED);
      const base64B = createSolidPng(15, 20, BLUE);

      const result = computePixelDiff({ base64A, base64B });

      const buffer = Buffer.from(result.diffImageBase64, "base64");
      const diffPng = PNG.sync.read(buffer);
      expect(diffPng.width).toBe(15);
      expect(diffPng.height).toBe(20);
    });
  });

  describe("error handling", () => {
    it("throws a descriptive error for invalid base64 PNG data", () => {
      const invalidBase64 = Buffer.from("not-a-png").toString("base64");
      const validBase64 = createSolidPng(10, 10, RED);

      expect(() =>
        computePixelDiff({ base64A: invalidBase64, base64B: validBase64 }),
      ).toThrow(/Failed to decode screenshot A as PNG/);
    });

    it("throws a descriptive error for the second image too", () => {
      const validBase64 = createSolidPng(10, 10, RED);
      const invalidBase64 = Buffer.from("also-not-a-png").toString("base64");

      expect(() =>
        computePixelDiff({ base64A: validBase64, base64B: invalidBase64 }),
      ).toThrow(/Failed to decode screenshot B as PNG/);
    });
  });

  describe("return value immutability", () => {
    it("returns a new result object each time", () => {
      const base64 = createSolidPng(5, 5, WHITE);

      const result1 = computePixelDiff({ base64A: base64, base64B: base64 });
      const result2 = computePixelDiff({ base64A: base64, base64B: base64 });

      expect(result1).toEqual(result2);
      expect(result1).not.toBe(result2);
      expect(result1.dimensions).not.toBe(result2.dimensions);
    });
  });
});
