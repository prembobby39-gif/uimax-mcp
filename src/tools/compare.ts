import { createPage, navigateAndWait, closePage } from "../utils/browser.js";

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
  readonly urlA: string;
  readonly urlB: string;
}

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Compare two base64 strings character-by-character and return the
 * percentage of characters that differ. Returns 0 when the strings
 * are identical.
 */
function calculateBase64DifferencePercent(
  base64A: string,
  base64B: string
): number {
  if (base64A === base64B) {
    return 0;
  }

  const maxLength = Math.max(base64A.length, base64B.length);

  if (maxLength === 0) {
    return 0;
  }

  let differingCharacters = 0;

  for (let i = 0; i < maxLength; i++) {
    if (base64A[i] !== base64B[i]) {
      differingCharacters++;
    }
  }

  const rawPercent = (differingCharacters / maxLength) * 100;
  return Math.round(rawPercent * 100) / 100;
}

// ── Screenshot capture ──────────────────────────────────────────

const DEFAULT_DEVICE_SCALE_FACTOR = 2;
const DEFAULT_SETTLE_DELAY = 1000;

async function captureUrlScreenshot(
  url: string,
  width: number,
  height: number
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
 * the difference between them.
 *
 * Captures both pages at the same viewport dimensions, then compares
 * the resulting screenshots via base64 string comparison. Returns
 * both screenshots, metadata, and the approximate difference percentage.
 */
export async function compareScreenshots(
  urlA: string,
  urlB: string,
  options?: { readonly width?: number; readonly height?: number }
): Promise<ComparisonResult> {
  const width = options?.width ?? 1440;
  const height = options?.height ?? 900;

  const screenshotA = await captureUrlScreenshot(urlA, width, height);
  const screenshotB = await captureUrlScreenshot(urlB, width, height);

  const differencePercent = calculateBase64DifferencePercent(
    screenshotA.base64,
    screenshotB.base64
  );

  return {
    screenshotA,
    screenshotB,
    differencePercent,
    urlA,
    urlB,
  };
}
