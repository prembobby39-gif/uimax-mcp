import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  saveReviewEntry,
  loadReviewHistory,
  getReviewStats,
  diffReviews,
  buildReviewEntry,
  formatReviewHistory,
  formatReviewStats,
  formatReviewDiff,
  generateReviewSummary,
} from "../tools/review-history.js";
import type {
  ReviewEntry,
  ReviewScores,
  ReviewFindings,
  ReviewFinding,
} from "../types.js";

// ── Test Fixtures ──────────────────────────────────────────────────

function makeReviewEntry(overrides: Partial<ReviewEntry> = {}): ReviewEntry {
  return {
    id: overrides.id ?? `test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: "2026-03-26T10:00:00.000Z",
    url: "http://localhost:3000",
    duration: 5000,
    scores: {
      lighthouse: {
        performance: 85,
        accessibility: 90,
        bestPractices: 95,
        seo: 80,
      },
      accessibilityViolations: 3,
      codeIssues: {
        total: 5,
        bySeverity: { critical: 1, high: 2, medium: 1, low: 1 },
      },
      performanceMetrics: {
        fcp: 1200,
        lcp: 2500,
        cls: 0.05,
        tbt: 200,
      },
    },
    findings: {
      total: 8,
      bySeverity: { critical: 1, high: 5, medium: 1, low: 1 },
      byCategory: { accessibility: 3, design: 2, performance: 3 },
      topFindings: [
        { rule: "missing-alt", severity: "high", message: "Image missing alt text" },
        { rule: "color-contrast", severity: "high", message: "Insufficient color contrast" },
        { rule: "no-inline-styles", severity: "medium", message: "Avoid inline styles", file: "src/App.tsx", line: 15 },
      ],
    },
    filesAnalyzed: 10,
    filesWithIssues: ["src/App.tsx", "src/Header.tsx"],
    status: "completed",
    summary: "Found 8 issues (1 critical, 5 high). Lighthouse: 85 perf, 90 a11y",
    ...overrides,
  };
}

function makeScores(overrides: Partial<ReviewScores> = {}): ReviewScores {
  return {
    lighthouse: {
      performance: 85,
      accessibility: 90,
      bestPractices: 95,
      seo: 80,
    },
    accessibilityViolations: 3,
    codeIssues: {
      total: 5,
      bySeverity: { critical: 1, high: 2, medium: 1, low: 1 },
    },
    performanceMetrics: {
      fcp: 1200,
      lcp: 2500,
      cls: 0.05,
      tbt: 200,
    },
    ...overrides,
  };
}

function makeFindings(overrides: Partial<ReviewFindings> = {}): ReviewFindings {
  return {
    total: 8,
    bySeverity: { critical: 1, high: 5, medium: 1, low: 1 },
    byCategory: { accessibility: 3, design: 2, performance: 3 },
    topFindings: [
      { rule: "missing-alt", severity: "high", message: "Image missing alt text" },
      { rule: "color-contrast", severity: "high", message: "Insufficient color contrast" },
    ],
    ...overrides,
  };
}

// ── Temp Directory Management ──────────────────────────────────────

let tempDir: string;

beforeEach(async () => {
  tempDir = join(tmpdir(), `uimax-test-review-history-${Date.now()}`);
  await mkdir(tempDir, { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// ── saveReviewEntry Tests ──────────────────────────────────────────

describe("saveReviewEntry", () => {
  it("creates a new file when none exists", async () => {
    const entry = makeReviewEntry({ id: "entry-1" });
    await saveReviewEntry(entry, tempDir);

    const raw = await readFile(join(tempDir, ".uimax-reviews.json"), "utf-8");
    const parsed = JSON.parse(raw);

    expect(parsed.version).toBe(1);
    expect(parsed.reviews).toHaveLength(1);
    expect(parsed.reviews[0].id).toBe("entry-1");
  });

  it("appends to an existing file without overwriting", async () => {
    const entry1 = makeReviewEntry({ id: "entry-1", timestamp: "2026-03-26T10:00:00.000Z" });
    const entry2 = makeReviewEntry({ id: "entry-2", timestamp: "2026-03-26T11:00:00.000Z" });

    await saveReviewEntry(entry1, tempDir);
    await saveReviewEntry(entry2, tempDir);

    const raw = await readFile(join(tempDir, ".uimax-reviews.json"), "utf-8");
    const parsed = JSON.parse(raw);

    expect(parsed.reviews).toHaveLength(2);
    expect(parsed.reviews[0].id).toBe("entry-1");
    expect(parsed.reviews[1].id).toBe("entry-2");
  });

  it("preserves the version field", async () => {
    const entry = makeReviewEntry();
    await saveReviewEntry(entry, tempDir);

    const raw = await readFile(join(tempDir, ".uimax-reviews.json"), "utf-8");
    const parsed = JSON.parse(raw);

    expect(parsed.version).toBe(1);
  });

  it("handles multiple URLs in the same file", async () => {
    const entry1 = makeReviewEntry({ id: "e1", url: "http://localhost:3000" });
    const entry2 = makeReviewEntry({ id: "e2", url: "http://localhost:4000" });

    await saveReviewEntry(entry1, tempDir);
    await saveReviewEntry(entry2, tempDir);

    const raw = await readFile(join(tempDir, ".uimax-reviews.json"), "utf-8");
    const parsed = JSON.parse(raw);

    expect(parsed.reviews).toHaveLength(2);
    expect(parsed.reviews[0].url).toBe("http://localhost:3000");
    expect(parsed.reviews[1].url).toBe("http://localhost:4000");
  });
});

// ── loadReviewHistory Tests ────────────────────────────────────────

describe("loadReviewHistory", () => {
  it("returns empty array when no file exists", async () => {
    const result = await loadReviewHistory(tempDir);
    expect(result).toEqual([]);
  });

  it("returns entries sorted newest-first", async () => {
    const entry1 = makeReviewEntry({ id: "old", timestamp: "2026-03-26T10:00:00.000Z" });
    const entry2 = makeReviewEntry({ id: "new", timestamp: "2026-03-26T12:00:00.000Z" });

    await saveReviewEntry(entry1, tempDir);
    await saveReviewEntry(entry2, tempDir);

    const result = await loadReviewHistory(tempDir);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("new");
    expect(result[1].id).toBe("old");
  });

  it("filters by URL", async () => {
    const entry1 = makeReviewEntry({ id: "e1", url: "http://localhost:3000" });
    const entry2 = makeReviewEntry({ id: "e2", url: "http://localhost:4000" });

    await saveReviewEntry(entry1, tempDir);
    await saveReviewEntry(entry2, tempDir);

    const result = await loadReviewHistory(tempDir, { url: "http://localhost:3000" });

    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("http://localhost:3000");
  });

  it("respects limit parameter", async () => {
    const entry1 = makeReviewEntry({ id: "e1", timestamp: "2026-03-26T10:00:00.000Z" });
    const entry2 = makeReviewEntry({ id: "e2", timestamp: "2026-03-26T11:00:00.000Z" });
    const entry3 = makeReviewEntry({ id: "e3", timestamp: "2026-03-26T12:00:00.000Z" });

    await saveReviewEntry(entry1, tempDir);
    await saveReviewEntry(entry2, tempDir);
    await saveReviewEntry(entry3, tempDir);

    const result = await loadReviewHistory(tempDir, { limit: 2 });

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("e3");
    expect(result[1].id).toBe("e2");
  });

  it("applies URL filter before limit", async () => {
    const entry1 = makeReviewEntry({ id: "e1", url: "http://localhost:3000", timestamp: "2026-03-26T10:00:00.000Z" });
    const entry2 = makeReviewEntry({ id: "e2", url: "http://localhost:4000", timestamp: "2026-03-26T11:00:00.000Z" });
    const entry3 = makeReviewEntry({ id: "e3", url: "http://localhost:3000", timestamp: "2026-03-26T12:00:00.000Z" });

    await saveReviewEntry(entry1, tempDir);
    await saveReviewEntry(entry2, tempDir);
    await saveReviewEntry(entry3, tempDir);

    const result = await loadReviewHistory(tempDir, { url: "http://localhost:3000", limit: 1 });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("e3");
  });
});

// ── getReviewStats Tests ───────────────────────────────────────────

describe("getReviewStats", () => {
  it("returns empty stats when no reviews exist", async () => {
    const stats = await getReviewStats(tempDir);

    expect(stats.totalReviews).toBe(0);
    expect(stats.totalIssuesFound).toBe(0);
    expect(stats.mostCommonIssues).toEqual([]);
    expect(stats.scoreTrends).toEqual([]);
    expect(stats.mostImprovedMetric).toBeNull();
    expect(stats.mostProblematicFiles).toEqual([]);
  });

  it("computes correct total reviews and issues", async () => {
    const entry1 = makeReviewEntry({
      id: "e1",
      timestamp: "2026-03-26T10:00:00.000Z",
      findings: makeFindings({ total: 5 }),
    });
    const entry2 = makeReviewEntry({
      id: "e2",
      timestamp: "2026-03-26T11:00:00.000Z",
      findings: makeFindings({ total: 3 }),
    });

    await saveReviewEntry(entry1, tempDir);
    await saveReviewEntry(entry2, tempDir);

    const stats = await getReviewStats(tempDir);

    expect(stats.totalReviews).toBe(2);
    expect(stats.totalIssuesFound).toBe(8);
  });

  it("identifies most common issues", async () => {
    const entry1 = makeReviewEntry({
      id: "e1",
      timestamp: "2026-03-26T10:00:00.000Z",
      findings: makeFindings({
        topFindings: [
          { rule: "missing-alt", severity: "high", message: "Alt text missing" },
          { rule: "color-contrast", severity: "high", message: "Low contrast" },
        ],
      }),
    });
    const entry2 = makeReviewEntry({
      id: "e2",
      timestamp: "2026-03-26T11:00:00.000Z",
      findings: makeFindings({
        topFindings: [
          { rule: "missing-alt", severity: "high", message: "Alt text missing" },
        ],
      }),
    });

    await saveReviewEntry(entry1, tempDir);
    await saveReviewEntry(entry2, tempDir);

    const stats = await getReviewStats(tempDir);

    expect(stats.mostCommonIssues[0].rule).toBe("missing-alt");
    expect(stats.mostCommonIssues[0].count).toBe(2);
  });

  it("computes score trends (first vs latest)", async () => {
    const entry1 = makeReviewEntry({
      id: "e1",
      timestamp: "2026-03-26T10:00:00.000Z",
      scores: makeScores({
        lighthouse: { performance: 70, accessibility: 80, bestPractices: 85, seo: 75 },
      }),
    });
    const entry2 = makeReviewEntry({
      id: "e2",
      timestamp: "2026-03-26T12:00:00.000Z",
      scores: makeScores({
        lighthouse: { performance: 90, accessibility: 95, bestPractices: 95, seo: 85 },
      }),
    });

    await saveReviewEntry(entry1, tempDir);
    await saveReviewEntry(entry2, tempDir);

    const stats = await getReviewStats(tempDir);

    const perfTrend = stats.scoreTrends.find(
      (t) => t.metric === "Lighthouse Performance"
    );
    expect(perfTrend).toBeDefined();
    expect(perfTrend!.first).toBe(70);
    expect(perfTrend!.latest).toBe(90);
    expect(perfTrend!.direction).toBe("improved");
  });

  it("identifies most problematic files", async () => {
    const entry1 = makeReviewEntry({
      id: "e1",
      timestamp: "2026-03-26T10:00:00.000Z",
      filesWithIssues: ["src/App.tsx", "src/Header.tsx"],
    });
    const entry2 = makeReviewEntry({
      id: "e2",
      timestamp: "2026-03-26T11:00:00.000Z",
      filesWithIssues: ["src/App.tsx", "src/Footer.tsx"],
    });

    await saveReviewEntry(entry1, tempDir);
    await saveReviewEntry(entry2, tempDir);

    const stats = await getReviewStats(tempDir);

    expect(stats.mostProblematicFiles[0].file).toBe("src/App.tsx");
    expect(stats.mostProblematicFiles[0].count).toBe(2);
  });
});

// ── diffReviews Tests ──────────────────────────────────────────────

describe("diffReviews", () => {
  it("detects new issues (in B but not A)", () => {
    const entryA = makeReviewEntry({
      id: "a",
      findings: makeFindings({
        topFindings: [
          { rule: "missing-alt", severity: "high", message: "Alt text missing" },
        ],
      }),
    });
    const entryB = makeReviewEntry({
      id: "b",
      findings: makeFindings({
        topFindings: [
          { rule: "missing-alt", severity: "high", message: "Alt text missing" },
          { rule: "new-rule", severity: "medium", message: "New issue found" },
        ],
      }),
    });

    const diff = diffReviews(entryA, entryB);

    expect(diff.newIssues).toHaveLength(1);
    expect(diff.newIssues[0].rule).toBe("new-rule");
  });

  it("detects resolved issues (in A but not B)", () => {
    const entryA = makeReviewEntry({
      id: "a",
      findings: makeFindings({
        topFindings: [
          { rule: "missing-alt", severity: "high", message: "Alt text missing" },
          { rule: "old-issue", severity: "low", message: "Old issue" },
        ],
      }),
    });
    const entryB = makeReviewEntry({
      id: "b",
      findings: makeFindings({
        topFindings: [
          { rule: "missing-alt", severity: "high", message: "Alt text missing" },
        ],
      }),
    });

    const diff = diffReviews(entryA, entryB);

    expect(diff.resolvedIssues).toHaveLength(1);
    expect(diff.resolvedIssues[0].rule).toBe("old-issue");
  });

  it("detects score improvements", () => {
    const entryA = makeReviewEntry({
      id: "a",
      scores: makeScores({
        lighthouse: { performance: 70, accessibility: 80, bestPractices: 85, seo: 75 },
      }),
    });
    const entryB = makeReviewEntry({
      id: "b",
      scores: makeScores({
        lighthouse: { performance: 90, accessibility: 95, bestPractices: 95, seo: 85 },
      }),
    });

    const diff = diffReviews(entryA, entryB);

    const perfChange = diff.scoreChanges.find(
      (c) => c.metric === "Lighthouse Performance"
    );
    expect(perfChange).toBeDefined();
    expect(perfChange!.direction).toBe("improved");
    expect(perfChange!.delta).toBe(20);
  });

  it("detects score regressions", () => {
    const entryA = makeReviewEntry({
      id: "a",
      scores: makeScores({
        lighthouse: { performance: 90, accessibility: 95, bestPractices: 95, seo: 85 },
      }),
    });
    const entryB = makeReviewEntry({
      id: "b",
      scores: makeScores({
        lighthouse: { performance: 70, accessibility: 80, bestPractices: 85, seo: 75 },
      }),
    });

    const diff = diffReviews(entryA, entryB);

    const perfChange = diff.scoreChanges.find(
      (c) => c.metric === "Lighthouse Performance"
    );
    expect(perfChange).toBeDefined();
    expect(perfChange!.direction).toBe("regressed");
    expect(perfChange!.delta).toBe(-20);
  });

  it("returns 'improved' verdict when scores only improve", () => {
    const entryA = makeReviewEntry({
      id: "a",
      scores: makeScores({
        lighthouse: { performance: 70, accessibility: 80, bestPractices: 85, seo: 75 },
        performanceMetrics: { fcp: 2000, lcp: 3000, cls: 0.1, tbt: 400 },
        accessibilityViolations: 5,
        codeIssues: { total: 10, bySeverity: { critical: 1, high: 2, medium: 3, low: 4 } },
      }),
      findings: makeFindings({
        topFindings: [
          { rule: "old-issue", severity: "high", message: "Will be resolved" },
        ],
      }),
    });
    const entryB = makeReviewEntry({
      id: "b",
      scores: makeScores({
        lighthouse: { performance: 90, accessibility: 95, bestPractices: 95, seo: 85 },
        performanceMetrics: { fcp: 1000, lcp: 2000, cls: 0.05, tbt: 100 },
        accessibilityViolations: 2,
        codeIssues: { total: 5, bySeverity: { critical: 0, high: 1, medium: 2, low: 2 } },
      }),
      findings: makeFindings({
        topFindings: [],
      }),
    });

    const diff = diffReviews(entryA, entryB);

    expect(diff.verdict).toBe("improved");
  });

  it("returns 'regressed' verdict when scores only regress", () => {
    const entryA = makeReviewEntry({
      id: "a",
      scores: makeScores({
        lighthouse: { performance: 90, accessibility: 95, bestPractices: 95, seo: 85 },
        performanceMetrics: { fcp: 1000, lcp: 2000, cls: 0.05, tbt: 100 },
        accessibilityViolations: 2,
        codeIssues: { total: 5, bySeverity: { critical: 0, high: 1, medium: 2, low: 2 } },
      }),
      findings: makeFindings({
        topFindings: [],
      }),
    });
    const entryB = makeReviewEntry({
      id: "b",
      scores: makeScores({
        lighthouse: { performance: 70, accessibility: 80, bestPractices: 85, seo: 75 },
        performanceMetrics: { fcp: 2000, lcp: 3000, cls: 0.1, tbt: 400 },
        accessibilityViolations: 5,
        codeIssues: { total: 10, bySeverity: { critical: 1, high: 2, medium: 3, low: 4 } },
      }),
      findings: makeFindings({
        topFindings: [
          { rule: "new-issue", severity: "high", message: "New problem" },
        ],
      }),
    });

    const diff = diffReviews(entryA, entryB);

    expect(diff.verdict).toBe("regressed");
  });

  it("returns 'unchanged' verdict when nothing changes", () => {
    const entry = makeReviewEntry({ id: "same" });
    const diff = diffReviews(entry, entry);

    expect(diff.verdict).toBe("unchanged");
  });

  it("returns 'mixed' verdict when some improve and some regress", () => {
    const entryA = makeReviewEntry({
      id: "a",
      scores: makeScores({
        lighthouse: { performance: 70, accessibility: 95, bestPractices: 95, seo: 85 },
        performanceMetrics: { fcp: 1000, lcp: 2000, cls: 0.05, tbt: 100 },
        accessibilityViolations: 3,
        codeIssues: { total: 5, bySeverity: { critical: 1, high: 2, medium: 1, low: 1 } },
      }),
    });
    const entryB = makeReviewEntry({
      id: "b",
      scores: makeScores({
        lighthouse: { performance: 90, accessibility: 80, bestPractices: 95, seo: 85 },
        performanceMetrics: { fcp: 1000, lcp: 2000, cls: 0.05, tbt: 100 },
        accessibilityViolations: 3,
        codeIssues: { total: 5, bySeverity: { critical: 1, high: 2, medium: 1, low: 1 } },
      }),
    });

    const diff = diffReviews(entryA, entryB);

    expect(diff.verdict).toBe("mixed");
  });
});

// ── formatReviewHistory Tests ──────────────────────────────────────

describe("formatReviewHistory", () => {
  it("produces a readable markdown table", () => {
    const entries = [makeReviewEntry({ id: "e1" })];
    const output = formatReviewHistory(entries);

    expect(output).toContain("## Review History");
    expect(output).toContain("| Date");
    expect(output).toContain("| URL");
    expect(output).toContain("localhost:3000");
    expect(output).toContain("completed");
  });

  it("returns a graceful message for empty history", () => {
    const output = formatReviewHistory([]);

    expect(output).toContain("No reviews found");
    expect(output).toContain("review_ui");
  });

  it("includes Lighthouse scores in the table", () => {
    const entry = makeReviewEntry({
      id: "e1",
      scores: makeScores({
        lighthouse: { performance: 92, accessibility: 88, bestPractices: 95, seo: 80 },
      }),
    });
    const output = formatReviewHistory([entry]);

    expect(output).toContain("92");
    expect(output).toContain("88");
  });

  it("shows N/A for null Lighthouse scores", () => {
    const entry = makeReviewEntry({
      id: "e1",
      scores: makeScores({
        lighthouse: { performance: null, accessibility: null, bestPractices: null, seo: null },
      }),
    });
    const output = formatReviewHistory([entry]);

    expect(output).toContain("N/A");
  });
});

// ── formatReviewStats Tests ────────────────────────────────────────

describe("formatReviewStats", () => {
  it("produces readable output", async () => {
    const entry1 = makeReviewEntry({ id: "e1", timestamp: "2026-03-26T10:00:00.000Z" });
    const entry2 = makeReviewEntry({
      id: "e2",
      timestamp: "2026-03-26T12:00:00.000Z",
      scores: makeScores({
        lighthouse: { performance: 95, accessibility: 98, bestPractices: 100, seo: 90 },
      }),
    });

    await saveReviewEntry(entry1, tempDir);
    await saveReviewEntry(entry2, tempDir);

    const stats = await getReviewStats(tempDir);
    const output = formatReviewStats(stats);

    expect(output).toContain("## Review Statistics");
    expect(output).toContain("Total Reviews");
    expect(output).toContain("2");
  });

  it("returns a graceful message for empty stats", () => {
    const output = formatReviewStats({
      totalReviews: 0,
      totalIssuesFound: 0,
      mostCommonIssues: [],
      scoreTrends: [],
      mostImprovedMetric: null,
      mostProblematicFiles: [],
    });

    expect(output).toContain("No reviews found");
  });
});

// ── formatReviewDiff Tests ─────────────────────────────────────────

describe("formatReviewDiff", () => {
  it("shows improved/regressed indicators", () => {
    const entryA = makeReviewEntry({
      id: "a",
      scores: makeScores({
        lighthouse: { performance: 70, accessibility: 95, bestPractices: 95, seo: 85 },
      }),
    });
    const entryB = makeReviewEntry({
      id: "b",
      scores: makeScores({
        lighthouse: { performance: 90, accessibility: 80, bestPractices: 95, seo: 85 },
      }),
    });

    const diff = diffReviews(entryA, entryB);
    const output = formatReviewDiff(diff);

    expect(output).toContain("## Review Comparison");
    expect(output).toContain("improved");
    expect(output).toContain("regressed");
  });

  it("shows resolved issues section", () => {
    const entryA = makeReviewEntry({
      id: "a",
      findings: makeFindings({
        topFindings: [
          { rule: "fixed-issue", severity: "high", message: "This was fixed" },
        ],
      }),
    });
    const entryB = makeReviewEntry({
      id: "b",
      findings: makeFindings({ topFindings: [] }),
    });

    const diff = diffReviews(entryA, entryB);
    const output = formatReviewDiff(diff);

    expect(output).toContain("Resolved Issues");
    expect(output).toContain("fixed-issue");
  });

  it("shows new issues section", () => {
    const entryA = makeReviewEntry({
      id: "a",
      findings: makeFindings({ topFindings: [] }),
    });
    const entryB = makeReviewEntry({
      id: "b",
      findings: makeFindings({
        topFindings: [
          { rule: "new-problem", severity: "critical", message: "New problem found" },
        ],
      }),
    });

    const diff = diffReviews(entryA, entryB);
    const output = formatReviewDiff(diff);

    expect(output).toContain("New Issues");
    expect(output).toContain("new-problem");
  });

  it("includes file and line info for located issues", () => {
    const entryA = makeReviewEntry({
      id: "a",
      findings: makeFindings({ topFindings: [] }),
    });
    const entryB = makeReviewEntry({
      id: "b",
      findings: makeFindings({
        topFindings: [
          { rule: "located-issue", severity: "medium", message: "Issue in file", file: "src/App.tsx", line: 42 },
        ],
      }),
    });

    const diff = diffReviews(entryA, entryB);
    const output = formatReviewDiff(diff);

    expect(output).toContain("src/App.tsx");
    expect(output).toContain("42");
  });
});

// ── generateReviewSummary Tests ────────────────────────────────────

describe("generateReviewSummary", () => {
  it("produces a correct one-liner with severity breakdown", () => {
    const scores = makeScores();
    const findings = makeFindings({
      total: 10,
      bySeverity: { critical: 2, high: 3, medium: 3, low: 2 },
    });

    const summary = generateReviewSummary(scores, findings);

    expect(summary).toContain("Found 10 issues");
    expect(summary).toContain("2 critical");
    expect(summary).toContain("3 high");
    expect(summary).toContain("Lighthouse: 85 perf, 90 a11y");
  });

  it("omits Lighthouse section when scores are null", () => {
    const scores = makeScores({
      lighthouse: { performance: null, accessibility: null, bestPractices: null, seo: null },
    });
    const findings = makeFindings({ total: 5 });

    const summary = generateReviewSummary(scores, findings);

    expect(summary).toContain("Found 5 issues");
    expect(summary).not.toContain("Lighthouse");
  });

  it("handles zero issues", () => {
    const scores = makeScores();
    const findings = makeFindings({
      total: 0,
      bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
    });

    const summary = generateReviewSummary(scores, findings);

    expect(summary).toContain("Found 0 issues");
  });
});

// ── buildReviewEntry Tests ─────────────────────────────────────────

describe("buildReviewEntry", () => {
  it("builds a valid ReviewEntry from audit data", () => {
    const entry = buildReviewEntry({
      url: "http://localhost:3000",
      codeDir: "/test/project",
      duration: 5000,
      lighthouse: {
        scores: { performance: 85, accessibility: 90, bestPractices: 95, seo: 80 },
      },
      accessibility: {
        violations: [
          { id: "color-contrast", impact: "serious", description: "Insufficient contrast" },
        ],
      },
      performance: {
        firstContentfulPaint: 1200,
        largestContentfulPaint: 2500,
        cumulativeLayoutShift: 0.05,
        totalBlockingTime: 200,
      },
      codeAnalysis: {
        totalFiles: 10,
        findings: [
          {
            file: "src/App.tsx",
            line: 15,
            severity: "high",
            category: "design",
            rule: "no-inline-styles",
            message: "Avoid inline styles",
          },
        ],
      },
      status: "completed",
    });

    expect(entry.id).toBeTruthy();
    expect(entry.url).toBe("http://localhost:3000");
    expect(entry.codeDir).toBe("/test/project");
    expect(entry.duration).toBe(5000);
    expect(entry.status).toBe("completed");
    expect(entry.scores.lighthouse.performance).toBe(85);
    expect(entry.scores.accessibilityViolations).toBe(1);
    expect(entry.scores.codeIssues.total).toBe(1);
    expect(entry.findings.total).toBe(2); // 1 code + 1 a11y
    expect(entry.filesAnalyzed).toBe(10);
    expect(entry.filesWithIssues).toContain("src/App.tsx");
    expect(entry.summary).toBeTruthy();
  });

  it("handles null lighthouse results", () => {
    const entry = buildReviewEntry({
      url: "http://localhost:3000",
      duration: 3000,
      lighthouse: null,
      accessibility: { violations: [] },
      performance: {
        firstContentfulPaint: null,
        largestContentfulPaint: null,
        cumulativeLayoutShift: null,
        totalBlockingTime: null,
      },
      codeAnalysis: { totalFiles: 0, findings: [] },
      status: "partial",
    });

    expect(entry.scores.lighthouse.performance).toBeNull();
    expect(entry.scores.lighthouse.accessibility).toBeNull();
    expect(entry.status).toBe("partial");
  });
});

// ── Immutability Tests ─────────────────────────────────────────────

describe("immutability", () => {
  it("loadReviewHistory returns a new array each call", async () => {
    const entry = makeReviewEntry({ id: "e1" });
    await saveReviewEntry(entry, tempDir);

    const result1 = await loadReviewHistory(tempDir);
    const result2 = await loadReviewHistory(tempDir);

    expect(result1).not.toBe(result2);
    expect(result1).toEqual(result2);
  });

  it("diffReviews does not mutate input entries", () => {
    const entryA = makeReviewEntry({ id: "a" });
    const entryB = makeReviewEntry({ id: "b" });

    const entryACopy = JSON.parse(JSON.stringify(entryA));
    const entryBCopy = JSON.parse(JSON.stringify(entryB));

    diffReviews(entryA, entryB);

    expect(entryA).toEqual(entryACopy);
    expect(entryB).toEqual(entryBCopy);
  });

  it("getReviewStats returns a new object each call", async () => {
    const entry = makeReviewEntry({ id: "e1" });
    await saveReviewEntry(entry, tempDir);

    const stats1 = await getReviewStats(tempDir);
    const stats2 = await getReviewStats(tempDir);

    expect(stats1).not.toBe(stats2);
    expect(stats1).toEqual(stats2);
  });
});
