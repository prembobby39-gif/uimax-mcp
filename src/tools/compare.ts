import { createPage, navigateAndWait, closePage } from "../utils/browser.js";
import { computePixelDiff } from "../utils/pixel-diff.js";

// ── Types ─────────────────────────────────────────────────────────

export interface ComparisonScreenshot {
  readonly base64: string;
  readonly mimeType: "image/png";
  readonly width: number;
  readonly height: number;
  readonly url: string;
  readonly timestamp: string;
}

export interface ComparisonResult {
  readonly screenshotA: ComparisonScreenshot;
  readonly screenshotB: ComparisonScreenshot;
  readonly differencePercent: number;
  readonly pixelsChanged: number;
  readonly dimensions: {
    readonly width: number;
    readonly height: number;
  };
  readonly diffImage: string;
  readonly urlA: string;
  readonly urlB: string;
}

// ── Screenshot capture ──────────────────────────────────────────

const DEFAULT_DEVICE_SCALE_FACTOR = 2;
const DEFAULT_SETTLE_DELAY = 1000;

async function captureUrlScreenshot(
  url: string,
  width: number,
  height: number,
): Promise<ComparisonScreenshot> {
  const page = await createPage(width, height, DEFAULT_DEVICE_SCALE_FACTOR);

  try {
    await navigateAndWait(page, url, DEFAULT_SETTLE_DELAY);

    const buffer = await page.screenshot({
      type: "png",
      fullPage: true,
      encoding: "binary",
    });

    const base64 = Buffer.from(buffer).toString("base64");

    return {
      base64,
      mimeType: "image/png",
      width,
      height,
      url,
      timestamp: new Date().toISOString(),
    };
  } finally {
    await closePage(page);
  }
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Compare two URLs by capturing screenshots of each and computing
 * the pixel-level difference between them.
 *
 * Captures both pages at the same viewport dimensions, then uses
 * pixelmatch to compute an accurate pixel difference. Returns both
 * screenshots, a red-highlighted diff image, and difference metrics.
 */
export async function compareScreenshots(
  urlA: string,
  urlB: string,
  options?: { readonly width?: number; readonly height?: number },
): Promise<ComparisonResult> {
  const width = options?.width ?? 1440;
  const height = options?.height ?? 900;

  const screenshotA = await captureUrlScreenshot(urlA, width, height);
  const screenshotB = await captureUrlScreenshot(urlB, width, height);

  const diffResult = computePixelDiff({
    base64A: screenshotA.base64,
    base64B: screenshotB.base64,
  });

  return {
    screenshotA,
    screenshotB,
    differencePercent: diffResult.differencePercent,
    pixelsChanged: diffResult.pixelsChanged,
    dimensions: diffResult.dimensions,
    diffImage: diffResult.diffImageBase64,
    urlA,
    urlB,
  };
}
