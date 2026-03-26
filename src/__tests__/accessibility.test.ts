import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock browser utilities ───────────────────────────────────────

const { mockPage, mockEvaluate, mockGoto } = vi.hoisted(() => {
  const mockEvaluate = vi.fn();
  const mockGoto = vi.fn();
  const mockIsClosed = vi.fn().mockReturnValue(false);
  const mockClose = vi.fn();

  const mockPage = {
    evaluate: mockEvaluate,
    goto: mockGoto,
    isClosed: mockIsClosed,
    close: mockClose,
  };

  return { mockPage, mockEvaluate, mockGoto };
});

vi.mock("../utils/browser.js", () => ({
  createPage: vi.fn().mockResolvedValue(mockPage),
  navigateAndWait: vi.fn().mockResolvedValue(undefined),
  closePage: vi.fn().mockResolvedValue(undefined),
}));

// Mock the fs readFile for axe-core source
vi.mock("node:fs/promises", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...original,
    readFile: vi.fn().mockImplementation((path: string, encoding?: string) => {
      if (typeof path === "string" && path.includes("axe")) {
        return Promise.resolve("// fake axe-core source");
      }
      return original.readFile(path, encoding as BufferEncoding);
    }),
  };
});

import { runAccessibilityAudit } from "../tools/accessibility.js";

// ── Tests ────────────────────────────────────────────────────────

describe("runAccessibilityAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // First evaluate call injects axe-core (returns undefined)
    // Second evaluate call runs the audit and returns results
    mockEvaluate
      .mockResolvedValueOnce(undefined) // inject axe source
      .mockResolvedValueOnce({
        violations: [
          {
            id: "color-contrast",
            impact: "serious",
            description: "Elements must have sufficient color contrast",
            help: "Ensure sufficient contrast ratio",
            helpUrl: "https://example.com/color-contrast",
            nodes: [
              {
                target: ["#main > p"],
                html: "<p>Low contrast</p>",
                failureSummary: "Fix foreground or background color",
              },
            ],
          },
        ],
        passCount: 40,
        incompleteCount: 2,
        inapplicableCount: 8,
      });
  });

  it("returns AccessibilityResult with violations", async () => {
    const result = await runAccessibilityAudit("http://localhost:3000");

    expect(result.url).toBe("http://localhost:3000");
    expect(result.timestamp).toBeDefined();
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].id).toBe("color-contrast");
    expect(result.passes).toBe(40);
    expect(result.incomplete).toBe(2);
    expect(result.inapplicable).toBe(8);
  });

  it("injects axe-core source into the page", async () => {
    await runAccessibilityAudit("http://localhost:3000");

    // First evaluate call should inject the axe source
    expect(mockEvaluate).toHaveBeenCalledTimes(2);
    expect(mockEvaluate.mock.calls[0][0]).toBe("// fake axe-core source");
  });

  it("handles zero violations", async () => {
    mockEvaluate.mockReset();
    mockEvaluate
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        violations: [],
        passCount: 50,
        incompleteCount: 0,
        inapplicableCount: 15,
      });

    const result = await runAccessibilityAudit("http://localhost:3000");

    expect(result.violations).toHaveLength(0);
    expect(result.passes).toBe(50);
  });
});
