import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CodeAnalysisResult, CodeFinding } from "../types.js";

// ── Mock file-utils before importing code-analysis ──────────────
vi.mock("../utils/file-utils.js", () => ({
  detectFramework: vi.fn().mockResolvedValue("react"),
  collectFrontendFiles: vi.fn().mockResolvedValue([]),
}));

import { analyzeCode, formatCodeAnalysisReport } from "../tools/code-analysis.js";
import { collectFrontendFiles, detectFramework } from "../utils/file-utils.js";
import type { FileInfo } from "../utils/file-utils.js";

// ── Helpers ──────────────────────────────────────────────────────

function makeFile(overrides: Partial<FileInfo> & { relativePath: string; extension: string; content: string }): FileInfo {
  const lines = overrides.content.split("\n").length;
  return {
    path: `/fake/${overrides.relativePath}`,
    relativePath: overrides.relativePath,
    extension: overrides.extension,
    content: overrides.content,
    lineCount: overrides.lineCount ?? lines,
    size: overrides.size ?? overrides.content.length,
  };
}

function findingsWithRule(findings: readonly CodeFinding[], ruleId: string): readonly CodeFinding[] {
  return findings.filter((f) => f.rule === ruleId);
}

// ── Rule Tests ───────────────────────────────────────────────────

describe("code-analysis rules", () => {
  beforeEach(() => {
    vi.mocked(detectFramework).mockResolvedValue("react");
  });

  // ── Accessibility ──

  describe("img-no-alt", () => {
    it("detects <img> without alt attribute", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "Hero.tsx",
          extension: ".tsx",
          content: `<img src="hero.png" />`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "img-no-alt");
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits[0].category).toBe("accessibility");
      expect(hits[0].severity).toBe("high");
    });

    it("does NOT flag <img> with alt", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "Hero.tsx",
          extension: ".tsx",
          content: `<img src="hero.png" alt="Hero banner" />`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "img-no-alt");
      expect(hits).toHaveLength(0);
    });

    it("detects in .html files", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "index.html",
          extension: ".html",
          content: `<html lang="en"><head><meta name="viewport" content="width=device-width"><meta name="description" content="Test"></head><body><img src="x.png"></body></html>`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "img-no-alt");
      expect(hits.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("click-no-keyboard", () => {
    it("detects onClick without keyboard handler", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "Button.tsx",
          extension: ".tsx",
          content: `<div onClick={handleClick}>Click me</div>`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "click-no-keyboard");
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits[0].severity).toBe("high");
    });

    it("does NOT flag onClick paired with onKeyDown", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "Button.tsx",
          extension: ".tsx",
          content: `<div onClick={handleClick} onKeyDown={handleKey}>Click me</div>`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "click-no-keyboard");
      expect(hits).toHaveLength(0);
    });
  });

  describe("no-form-label", () => {
    it("detects <input> without label association", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "Form.tsx",
          extension: ".tsx",
          content: `<input type="text" name="email" />`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "no-form-label");
      expect(hits.length).toBeGreaterThanOrEqual(1);
    });

    it("does NOT flag <input> with aria-label", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "Form.tsx",
          extension: ".tsx",
          content: `<input type="text" aria-label="Email address" />`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "no-form-label");
      expect(hits).toHaveLength(0);
    });

    it("does NOT flag <input> with id (for label association)", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "Form.tsx",
          extension: ".tsx",
          content: `<input type="text" id="email" />`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "no-form-label");
      expect(hits).toHaveLength(0);
    });
  });

  describe("no-lang-attr", () => {
    it("detects <html> without lang", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "index.html",
          extension: ".html",
          content: `<html><head><meta name="viewport" content="w"><meta name="description" content="t"></head><body></body></html>`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "no-lang-attr");
      expect(hits.length).toBeGreaterThanOrEqual(1);
    });

    it("does NOT flag <html lang='en'>", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "index.html",
          extension: ".html",
          content: `<html lang="en"><head><meta name="viewport" content="w"><meta name="description" content="t"></head><body></body></html>`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "no-lang-attr");
      expect(hits).toHaveLength(0);
    });
  });

  // ── Code Quality ──

  describe("console-log", () => {
    it("detects console.log", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "utils.ts",
          extension: ".ts",
          content: `console.log("debug");`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "console-log");
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits[0].severity).toBe("low");
    });

    it("detects console.debug and console.info", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "utils.ts",
          extension: ".ts",
          content: `console.debug("d");\nconsole.info("i");`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "console-log");
      expect(hits.length).toBeGreaterThanOrEqual(2);
    });

    it("does NOT flag console.error or console.warn", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "utils.ts",
          extension: ".ts",
          content: `console.error("err");\nconsole.warn("warn");`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "console-log");
      expect(hits).toHaveLength(0);
    });
  });

  describe("todo-fixme", () => {
    it("detects TODO comments", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "App.tsx",
          extension: ".tsx",
          content: `// TODO: fix this later`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "todo-fixme");
      expect(hits.length).toBeGreaterThanOrEqual(1);
    });

    it("detects FIXME and HACK comments", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "App.tsx",
          extension: ".tsx",
          content: `// FIXME: broken\n/* HACK: temporary */`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "todo-fixme");
      expect(hits.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("inline-style", () => {
    it("detects JSX inline styles", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "Card.tsx",
          extension: ".tsx",
          content: `<div style={{ color: "red" }}>Hello</div>`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "inline-style");
      expect(hits.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("any-type", () => {
    it("detects TypeScript 'any' usage", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "utils.ts",
          extension: ".ts",
          content: `function process(data: any): void {}`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "any-type");
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits[0].severity).toBe("medium");
    });

    it("does NOT flag 'any' in non-TS files", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "utils.js",
          extension: ".js",
          content: `function process(data: any): void {}`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "any-type");
      expect(hits).toHaveLength(0);
    });
  });

  describe("magic-number", () => {
    it("detects magic numbers in style properties", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "Layout.tsx",
          extension: ".tsx",
          content: `width: 384`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "magic-number");
      expect(hits.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Design Rules ──

  describe("important-css", () => {
    it("detects !important in CSS", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "styles.css",
          extension: ".css",
          content: `.header { color: red !important; }`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "important-css");
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits[0].category).toBe("design");
    });
  });

  describe("hardcoded-color", () => {
    it("detects hardcoded hex colors in CSS", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "theme.css",
          extension: ".css",
          content: `.text { color: #ff5500; }`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "hardcoded-color");
      expect(hits.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("z-index-high", () => {
    it("detects high z-index values", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "modal.css",
          extension: ".css",
          content: `.modal { z-index: 9999; }`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "z-index-high");
      expect(hits.length).toBeGreaterThanOrEqual(1);
    });

    it("does NOT flag low z-index values", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "modal.css",
          extension: ".css",
          content: `.modal { z-index: 10; }`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "z-index-high");
      expect(hits).toHaveLength(0);
    });
  });

  // ── Performance Rules ──

  describe("no-lazy-image", () => {
    it("detects img without loading=lazy", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "Gallery.tsx",
          extension: ".tsx",
          content: `<img src="photo.jpg" alt="Photo" />`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "no-lazy-image");
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits[0].category).toBe("performance");
    });

    it("does NOT flag img with loading=lazy", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "Gallery.tsx",
          extension: ".tsx",
          content: `<img loading="lazy" src="photo.jpg" alt="Photo" />`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "no-lazy-image");
      expect(hits).toHaveLength(0);
    });
  });

  describe("large-bundle-import", () => {
    it("detects full lodash import", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "utils.ts",
          extension: ".ts",
          content: `import lodash from 'lodash'`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "large-bundle-import");
      expect(hits.length).toBeGreaterThanOrEqual(1);
    });

    it("does NOT flag tree-shakeable import", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "utils.ts",
          extension: ".ts",
          content: `import { debounce } from 'lodash/debounce'`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "large-bundle-import");
      expect(hits).toHaveLength(0);
    });
  });

  // ── UX Rules ──

  describe("missing-error-boundary", () => {
    it("detects missing ErrorBoundary in a React project", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "App.tsx",
          extension: ".tsx",
          content: `export default function App() { return <div />; }`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "no-error-boundary");
      expect(hits.length).toBeGreaterThanOrEqual(1);
    });

    it("does NOT flag when ErrorBoundary component exists", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "App.tsx",
          extension: ".tsx",
          content: `export default function App() { return <div />; }`,
        }),
        makeFile({
          relativePath: "ErrorBoundary.tsx",
          extension: ".tsx",
          content: `export class ErrorBoundary extends React.Component {}`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "no-error-boundary");
      expect(hits).toHaveLength(0);
    });
  });

  // ── React Hooks & Patterns ──

  describe("react-hooks-conditional", () => {
    it("detects hook called inside a conditional", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "Component.tsx",
          extension: ".tsx",
          content: `if (condition) useState(0)`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "react-hooks-conditional");
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits[0].severity).toBe("high");
    });
  });

  describe("missing-key-prop", () => {
    it("detects .map() rendering JSX without key", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "List.tsx",
          extension: ".tsx",
          content: `items.map((item) => (<li>{item.name}</li>))`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "missing-key-prop");
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits[0].category).toBe("bug");
    });

    it("does NOT flag .map() with key prop", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "List.tsx",
          extension: ".tsx",
          content: `items.map((item) => (<li key={item.id}>{item.name}</li>))`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "missing-key-prop");
      expect(hits).toHaveLength(0);
    });
  });

  describe("direct-dom-access", () => {
    it("detects document.querySelector in component files", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "Modal.tsx",
          extension: ".tsx",
          content: `const el = document.querySelector('.modal');`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "direct-dom-access");
      expect(hits.length).toBeGreaterThanOrEqual(1);
    });

    it("detects document.getElementById", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "Modal.tsx",
          extension: ".tsx",
          content: `const el = document.getElementById('modal');`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "direct-dom-access");
      expect(hits.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("empty-catch", () => {
    it("detects empty catch blocks", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "api.ts",
          extension: ".ts",
          content: `try { fetch("/api"); } catch (e) {}`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "empty-catch");
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits[0].severity).toBe("high");
    });

    it("does NOT flag catch with body", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "api.ts",
          extension: ".ts",
          content: `try { fetch("/api"); } catch (e) { console.error(e); }`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "empty-catch");
      expect(hits).toHaveLength(0);
    });
  });

  describe("event-handler-inline", () => {
    it("detects inline arrow function in onClick", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "Button.tsx",
          extension: ".tsx",
          content: `<button onClick={() => doSomething()}>Go</button>`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "event-handler-inline");
      expect(hits.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("font-too-small", () => {
    it("detects font-size below 12px", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "styles.css",
          extension: ".css",
          content: `.caption { font-size: 9px; }`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "font-too-small");
      expect(hits.length).toBeGreaterThanOrEqual(1);
    });

    it("does NOT flag font-size 12px or above", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "styles.css",
          extension: ".css",
          content: `.text { font-size: 14px; }`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "font-too-small");
      expect(hits).toHaveLength(0);
    });
  });

  describe("missing-meta-description", () => {
    it("detects HTML file missing meta description", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "index.html",
          extension: ".html",
          content: `<html lang="en"><head><meta name="viewport" content="w"></head><body></body></html>`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "missing-meta-description");
      expect(hits.length).toBeGreaterThanOrEqual(1);
    });

    it("does NOT flag when meta description present", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "index.html",
          extension: ".html",
          content: `<html lang="en"><head><meta name="viewport" content="w"><meta name="description" content="A great site"></head><body></body></html>`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "missing-meta-description");
      expect(hits).toHaveLength(0);
    });
  });

  describe("missing-viewport-meta", () => {
    it("detects HTML file missing viewport meta", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "index.html",
          extension: ".html",
          content: `<html lang="en"><head><meta name="description" content="t"></head><body></body></html>`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "missing-viewport-meta");
      expect(hits.length).toBeGreaterThanOrEqual(1);
    });

    it("does NOT flag when viewport meta present", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "index.html",
          extension: ".html",
          content: `<html lang="en"><head><meta name="viewport" content="width=device-width"><meta name="description" content="t"></head><body></body></html>`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "missing-viewport-meta");
      expect(hits).toHaveLength(0);
    });
  });

  describe("no-focus-visible", () => {
    it("detects :focus without :focus-visible", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "base.css",
          extension: ".css",
          content: `button:focus { outline: 2px solid blue; }`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "no-focus-visible");
      expect(hits.length).toBeGreaterThanOrEqual(1);
    });

    it("does NOT flag :focus-visible", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "base.css",
          extension: ".css",
          content: `button:focus-visible { outline: 2px solid blue; }`,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "no-focus-visible");
      expect(hits).toHaveLength(0);
    });
  });

  // ── File-Level Checks ──

  describe("large-file check", () => {
    it("flags files over 500 lines as medium severity", async () => {
      const bigContent = Array.from({ length: 600 }, (_, i) => `line ${i}`).join("\n");
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "BigFile.tsx",
          extension: ".tsx",
          content: bigContent,
          lineCount: 600,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "large-file");
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits[0].severity).toBe("medium");
    });

    it("flags files over 800 lines as high severity", async () => {
      const bigContent = Array.from({ length: 900 }, (_, i) => `line ${i}`).join("\n");
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "HugeFile.tsx",
          extension: ".tsx",
          content: bigContent,
          lineCount: 900,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "large-file");
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits[0].severity).toBe("high");
    });

    it("does NOT flag files under 500 lines", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "SmallFile.tsx",
          extension: ".tsx",
          content: `export const x = 1;`,
          lineCount: 10,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "large-file");
      expect(hits).toHaveLength(0);
    });
  });

  describe("deep-nesting check", () => {
    it("flags deeply nested code (>6 levels)", async () => {
      // 16 spaces = 8 indent levels with 2-space indent
      const content = `function x() {\n  if (a) {\n    if (b) {\n      if (c) {\n        if (d) {\n          if (e) {\n            if (f) {\n              if (g) {\n                doStuff();\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n}`;
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "Nested.ts",
          extension: ".ts",
          content,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const hits = findingsWithRule(result.findings, "deep-nesting");
      expect(hits.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Sorting & Summary ──

  describe("analyzeCode result structure", () => {
    it("returns proper structure with framework, files, lines", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "App.tsx",
          extension: ".tsx",
          content: `export default function App() { return <div />; }`,
          lineCount: 1,
        }),
        makeFile({
          relativePath: "styles.css",
          extension: ".css",
          content: `.app { color: red; }`,
          lineCount: 1,
        }),
      ]);

      const result = await analyzeCode("/fake");
      expect(result.directory).toBe("/fake");
      expect(result.framework).toBe("react");
      expect(result.totalFiles).toBe(2);
      expect(result.totalLines).toBe(2);
      expect(result.summary.components).toBe(1);
      expect(result.summary.stylesheets).toBe(1);
      expect(result.summary.avgFileSize).toBe(1);
      expect(result.summary.largestFiles.length).toBeGreaterThanOrEqual(1);
      expect(result.timestamp).toBeDefined();
    });

    it("sorts findings by severity (critical > high > medium > low)", async () => {
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "App.tsx",
          extension: ".tsx",
          content: [
            `console.log("debug");`,                         // low
            `<img src="x.png" />`,                            // high (img-no-alt)
            `try {} catch (e) {}`,                            // high (empty-catch)
          ].join("\n"),
        }),
      ]);

      const result = await analyzeCode("/fake");
      const severities = result.findings.map((f) => f.severity);

      // Verify high comes before low
      const firstHigh = severities.indexOf("high");
      const firstLow = severities.indexOf("low");
      if (firstHigh !== -1 && firstLow !== -1) {
        expect(firstHigh).toBeLessThan(firstLow);
      }
    });

    it("limits findings to 5 per rule per file", async () => {
      const manyImages = Array.from({ length: 10 }, (_, i) => `<img src="img${i}.png" />`).join("\n");
      vi.mocked(collectFrontendFiles).mockResolvedValue([
        makeFile({
          relativePath: "Images.tsx",
          extension: ".tsx",
          content: manyImages,
        }),
      ]);

      const result = await analyzeCode("/fake");
      const imgHits = findingsWithRule(result.findings, "img-no-alt");
      expect(imgHits.length).toBeLessThanOrEqual(5);
    });
  });
});

// ── formatCodeAnalysisReport Tests ────────────────────────────────

describe("formatCodeAnalysisReport", () => {
  it("formats a report with findings grouped by category", () => {
    const mockResult: CodeAnalysisResult = {
      directory: "/project/src",
      timestamp: "2025-01-01T00:00:00.000Z",
      framework: "react",
      totalFiles: 10,
      totalLines: 500,
      findings: [
        {
          file: "App.tsx",
          line: 5,
          severity: "high",
          category: "accessibility",
          rule: "img-no-alt",
          message: "Image element missing alt attribute",
          suggestion: "Add an alt attribute",
        },
        {
          file: "utils.ts",
          line: 10,
          severity: "low",
          category: "code-quality",
          rule: "console-log",
          message: "console.log statement found",
          suggestion: "Remove console.log",
        },
      ],
      summary: {
        components: 5,
        stylesheets: 3,
        avgFileSize: 50,
        largestFiles: [
          { file: "App.tsx", lines: 200 },
          { file: "Form.tsx", lines: 150 },
        ],
      },
      configStatus: {
        loaded: false,
        path: null,
        rulesDisabled: [],
        severityOverrides: [],
      },
    };

    const report = formatCodeAnalysisReport(mockResult);

    expect(report).toContain("## Code Analysis Results");
    expect(report).toContain("**Framework:** react");
    expect(report).toContain("**Files Analyzed:** 10");
    expect(report).toContain("**Total Lines:** 500");
    expect(report).toContain("**Components:** 5");
    expect(report).toContain("**Stylesheets:** 3");
    expect(report).toContain("### Largest Files");
    expect(report).toContain("App.tsx (200 lines)");
    expect(report).toContain("### Findings (2 total)");
    expect(report).toContain("#### Accessibility (1)");
    expect(report).toContain("#### Code Quality (1)");
    expect(report).toContain("[HIGH]");
    expect(report).toContain("[LOW]");
  });

  it("handles empty findings", () => {
    const mockResult: CodeAnalysisResult = {
      directory: "/project/src",
      timestamp: "2025-01-01T00:00:00.000Z",
      framework: "unknown",
      totalFiles: 0,
      totalLines: 0,
      findings: [],
      summary: {
        components: 0,
        stylesheets: 0,
        avgFileSize: 0,
        largestFiles: [],
      },
      configStatus: {
        loaded: false,
        path: null,
        rulesDisabled: [],
        severityOverrides: [],
      },
    };

    const report = formatCodeAnalysisReport(mockResult);

    expect(report).toContain("### Findings (0 total)");
    expect(report).not.toContain("#### ");
  });
});
