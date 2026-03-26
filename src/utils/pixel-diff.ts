import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

// ── Types ─────────────────────────────────────────────────────────

export interface PixelDiffInput {
  readonly base64A: string;
  readonly base64B: string;
}

export interface PixelDiffResult {
  readonly differencePercent: number;
  readonly pixelsChanged: number;
  readonly totalPixels: number;
  readonly dimensions: {
    readonly width: number;
    readonly height: number;
  };
  readonly diffImageBase64: string;
}

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Decode a base64-encoded PNG into a pngjs PNG object.
 * Throws a descriptive error if decoding fails.
 */
function decodePng(base64: string, label: string): PNG {
  const buffer = Buffer.from(base64, "base64");

  try {
    return PNG.sync.read(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to decode ${label} as PNG: ${message}`);
  }
}

/**
 * Resize a PNG to target dimensions by creating a new image and
 * copying overlapping pixel data. Pixels outside the original
 * bounds are filled with transparent black.
 */
function resizePngToMatch(
  source: PNG,
  targetWidth: number,
  targetHeight: number,
): PNG {
  const resized = new PNG({ width: targetWidth, height: targetHeight });

  // Fill with transparent black (all zeros is the default for a new PNG buffer)
  resized.data.fill(0);

  const copyWidth = Math.min(source.width, targetWidth);
  const copyHeight = Math.min(source.height, targetHeight);

  for (let y = 0; y < copyHeight; y++) {
    for (let x = 0; x < copyWidth; x++) {
      const srcIdx = (y * source.width + x) * 4;
      const dstIdx = (y * targetWidth + x) * 4;
      resized.data[dstIdx] = source.data[srcIdx]!;
      resized.data[dstIdx + 1] = source.data[srcIdx + 1]!;
      resized.data[dstIdx + 2] = source.data[srcIdx + 2]!;
      resized.data[dstIdx + 3] = source.data[srcIdx + 3]!;
    }
  }

  return resized;
}

/**
 * Encode a pngjs PNG object to a base64 string.
 */
function encodePngToBase64(png: PNG): string {
  const buffer = PNG.sync.write(png);
  return buffer.toString("base64");
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Compute pixel-level difference between two base64 PNG images.
 *
 * If the images have different dimensions, both are padded to the
 * larger bounding box (extra pixels treated as transparent black,
 * which will show as differences).
 *
 * Returns the diff percentage, pixel count, dimensions, and a
 * red-highlighted diff image as base64 PNG.
 */
export function computePixelDiff(input: PixelDiffInput): PixelDiffResult {
  const pngA = decodePng(input.base64A, "screenshot A");
  const pngB = decodePng(input.base64B, "screenshot B");

  // Normalize to the same dimensions (use the larger bounding box)
  const width = Math.max(pngA.width, pngB.width);
  const height = Math.max(pngA.height, pngB.height);

  const normalizedA = (pngA.width === width && pngA.height === height)
    ? pngA
    : resizePngToMatch(pngA, width, height);

  const normalizedB = (pngB.width === width && pngB.height === height)
    ? pngB
    : resizePngToMatch(pngB, width, height);

  const diffPng = new PNG({ width, height });
  const totalPixels = width * height;

  const pixelsChanged = pixelmatch(
    normalizedA.data,
    normalizedB.data,
    diffPng.data,
    width,
    height,
    { threshold: 0.1 },
  );

  const rawPercent = totalPixels > 0
    ? (pixelsChanged / totalPixels) * 100
    : 0;
  const differencePercent = Math.round(rawPercent * 100) / 100;

  const diffImageBase64 = encodePngToBase64(diffPng);

  return {
    differencePercent,
    pixelsChanged,
    totalPixels,
    dimensions: { width, height },
    diffImageBase64,
  };
}
