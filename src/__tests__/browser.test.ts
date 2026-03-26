import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock puppeteer-core and child_process ────────────────────────

const { mockBrowser, mockPage, mockLaunch } = vi.hoisted(() => {
  const mockPage = {
    setViewport: vi.fn().mockResolvedValue(undefined),
    goto: vi.fn().mockResolvedValue(undefined),
    isClosed: vi.fn().mockReturnValue(false),
    close: vi.fn().mockResolvedValue(undefined),
  };

  const mockBrowser = {
    connected: true,
    newPage: vi.fn().mockResolvedValue(mockPage),
    close: vi.fn().mockResolvedValue(undefined),
  };

  const mockLaunch = vi.fn().mockResolvedValue(mockBrowser);

  return { mockBrowser, mockPage, mockLaunch };
});

vi.mock("puppeteer-core", () => ({
  default: {
    launch: mockLaunch,
  },
}));

vi.mock("node:child_process", () => ({
  execSync: vi.fn().mockReturnValue("/usr/bin/google-chrome\n"),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn().mockReturnValue(true),
}));

import { getBrowser, createPage, navigateAndWait, closePage, closeBrowser } from "../utils/browser.js";

// ── Tests ────────────────────────────────────────────────────────

describe("browser utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBrowser.connected = true;
  });

  afterEach(async () => {
    // Reset the module-level browserInstance by calling closeBrowser
    await closeBrowser();
  });

  describe("getBrowser", () => {
    it("launches a browser and returns it", async () => {
      const browser = await getBrowser();

      expect(browser).toBe(mockBrowser);
      expect(mockLaunch).toHaveBeenCalledTimes(1);
    });

    it("reuses existing connected browser", async () => {
      const browser1 = await getBrowser();
      const browser2 = await getBrowser();

      expect(browser1).toBe(browser2);
      expect(mockLaunch).toHaveBeenCalledTimes(1);
    });

    it("launches a new browser if previous disconnected", async () => {
      await getBrowser();
      mockBrowser.connected = false;

      await getBrowser();

      expect(mockLaunch).toHaveBeenCalledTimes(2);
    });

    it("passes headless and security flags to puppeteer", async () => {
      await getBrowser();

      const launchCall = mockLaunch.mock.calls[0][0];
      expect(launchCall.headless).toBe(true);
      expect(launchCall.args).toContain("--no-sandbox");
      expect(launchCall.args).toContain("--disable-setuid-sandbox");
    });
  });

  describe("createPage", () => {
    it("creates a page with the given viewport", async () => {
      const page = await createPage(1024, 768, 2);

      expect(page).toBe(mockPage);
      expect(mockPage.setViewport).toHaveBeenCalledWith({
        width: 1024,
        height: 768,
        deviceScaleFactor: 2,
      });
    });

    it("defaults deviceScaleFactor to 1", async () => {
      await createPage(1440, 900);

      expect(mockPage.setViewport).toHaveBeenCalledWith({
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
      });
    });
  });

  describe("navigateAndWait", () => {
    it("navigates to the URL with networkidle2", async () => {
      await navigateAndWait(mockPage as any, "http://localhost:3000", 0);

      expect(mockPage.goto).toHaveBeenCalledWith("http://localhost:3000", {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
    });

    it("waits for the specified delay", async () => {
      const start = Date.now();
      await navigateAndWait(mockPage as any, "http://localhost:3000", 100);
      const elapsed = Date.now() - start;

      // Should have waited at least 80ms (accounting for timer imprecision)
      expect(elapsed).toBeGreaterThanOrEqual(50);
    });

    it("skips delay when 0", async () => {
      const start = Date.now();
      await navigateAndWait(mockPage as any, "http://localhost:3000", 0);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(50);
    });
  });

  describe("closePage", () => {
    it("closes an open page", async () => {
      mockPage.isClosed.mockReturnValue(false);

      await closePage(mockPage as any);

      expect(mockPage.close).toHaveBeenCalledTimes(1);
    });

    it("does not close an already closed page", async () => {
      mockPage.isClosed.mockReturnValue(true);

      await closePage(mockPage as any);

      expect(mockPage.close).not.toHaveBeenCalled();
    });

    it("does not throw if close fails", async () => {
      mockPage.isClosed.mockReturnValue(false);
      mockPage.close.mockRejectedValueOnce(new Error("Already closed"));

      await expect(closePage(mockPage as any)).resolves.not.toThrow();
    });
  });

  describe("closeBrowser", () => {
    it("closes the browser instance", async () => {
      await getBrowser(); // ensure browser exists
      await closeBrowser();

      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("does not throw if browser close fails", async () => {
      await getBrowser();
      mockBrowser.close.mockRejectedValueOnce(new Error("Already closed"));

      await expect(closeBrowser()).resolves.not.toThrow();
    });

    it("is safe to call when no browser exists", async () => {
      // closeBrowser called in afterEach already, so no browser instance
      await expect(closeBrowser()).resolves.not.toThrow();
    });
  });
});
