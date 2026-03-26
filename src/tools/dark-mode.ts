import { createPage, navigateAndWait, closePage } from "../utils/browser.js";

// ── Types ─────────────────────────────────────────────────────────

export interface DarkModeScreenshot {
  readonly base64: string;
  readonly mimeType: "image/png";
}

export interface DarkModeResult {
  readonly hasDarkMode: boolean;
  readonly differencePercent: number;
  readonly lightScreenshot: DarkModeScreenshot;
  readonly darkScreenshot: DarkModeScreenshot;
  readonly url: string;
  readonly timestamp: string;
}

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Compare two base64 strings character-by-character and return the
 * percentage of characters that differ. Returns 0 when the strings
 * are identical (no dark mode support detected).
 */
function calculateBase64DifferencePercent(
  lightBase64: string,
  darkBase64: string
): number {
  if (lightBase64 === darkBase64) {
    return 0;
  }

  const maxLength = Math.max(lightBase64.length, darkBase64.length);

  if (maxLength === 0) {
    return 0;
  }

  let differingCharacters = 0;

  for (let i = 0; i < maxLength; i++) {
    if (lightBase64[i] !== darkBase64[i]) {
      differingCharacters++;
    }
  }

  const rawPercent = (differingCharacters / maxLength) * 100;
  return Math.round(rawPercent * 100) / 100;
}

// ── Screenshot capture helpers ────────────────────────────────────

const DEFAULT_WIDTH = 1440;
const DEFAULT_HEIGHT = 900;
const DEFAULT_DEVICE_SCALE_FACTOR = 2;
const DEFAULT_SETTLE_DELAY = 1000;

async function captureLightScreenshot(url: string): Promise<string> {
  const page = await createPage(
    DEFAULT_WIDTH,
    DEFAULT_HEIGHT,
    DEFAULT_DEVICE_SCALE_FACTOR
  );

  try {
    await navigateAndWait(page, url, DEFAULT_SETTLE_DELAY);

    const buffer = await page.screenshot({
      type: "png",
      fullPage: true,
      encoding: "binary",
    });

    return Buffer.from(buffer).toString("base64");
  } finally {
    await closePage(page);
  }
}

async function captureDarkScreenshot(url: string): Promise<string> {
  const page = await createPage(
    DEFAULT_WIDTH,
    DEFAULT_HEIGHT,
    DEFAULT_DEVICE_SCALE_FACTOR
  );

  try {
    await page.emulateMediaFeatures([
      { name: "prefers-color-scheme", value: "dark" },
    ]);

    await navigateAndWait(page, url, DEFAULT_SETTLE_DELAY);

    const buffer = await page.screenshot({
      type: "png",
      fullPage: true,
      encoding: "binary",
    });

    return Buffer.from(buffer).toString("base64");
  } finally {
    await closePage(page);
  }
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Detect whether a web page supports dark mode.
 *
 * Captures the page twice — once in light mode (default) and once
 * with `prefers-color-scheme: dark` emulated — then compares the
 * resulting screenshots via base64 string comparison.
 *
 * Returns both screenshots, a boolean indicating dark mode support,
 * and the approximate difference percentage.
 */
export async function checkDarkMode(url: string): Promise<DarkModeResult> {
  const lightBase64 = await captureLightScreenshot(url);
  const darkBase64 = await captureDarkScreenshot(url);

  const differencePercent = calculateBase64DifferencePercent(
    lightBase64,
    darkBase64
  );

  return {
    hasDarkMode: differencePercent > 0,
    differencePercent,
    lightScreenshot: { base64: lightBase64, mimeType: "image/png" },
    darkScreenshot: { base64: darkBase64, mimeType: "image/png" },
    url,
    timestamp: new Date().toISOString(),
  };
}
