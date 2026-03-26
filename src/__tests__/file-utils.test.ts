import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { detectFramework, collectFrontendFiles, countLines } from "../utils/file-utils.js";

// ── Temp directory helpers ────────────────────────────────────────

function createTempDir(): string {
  const dir = join(tmpdir(), `uimax-test-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeFile(dir: string, relativePath: string, content: string): void {
  const fullPath = join(dir, relativePath);
  const parentDir = fullPath.substring(0, fullPath.lastIndexOf("/"));
  mkdirSync(parentDir, { recursive: true });
  writeFileSync(fullPath, content, "utf-8");
}

// ── detectFramework ──────────────────────────────────────────────

describe("detectFramework", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("detects 'next' when next is in dependencies", async () => {
    writeFile(tempDir, "package.json", JSON.stringify({
      dependencies: { next: "^14.0.0", react: "^18.0.0" },
    }));

    const result = await detectFramework(tempDir);
    expect(result).toBe("next");
  });

  it("detects 'react' when react is in dependencies (but not next)", async () => {
    writeFile(tempDir, "package.json", JSON.stringify({
      dependencies: { react: "^18.0.0", "react-dom": "^18.0.0" },
    }));

    const result = await detectFramework(tempDir);
    expect(result).toBe("react");
  });

  it("detects 'vue' when vue is in dependencies", async () => {
    writeFile(tempDir, "package.json", JSON.stringify({
      dependencies: { vue: "^3.0.0" },
    }));

    const result = await detectFramework(tempDir);
    expect(result).toBe("vue");
  });

  it("detects 'svelte' when svelte is in dependencies", async () => {
    writeFile(tempDir, "package.json", JSON.stringify({
      dependencies: { svelte: "^4.0.0" },
    }));

    const result = await detectFramework(tempDir);
    expect(result).toBe("svelte");
  });

  it("detects 'svelte' when @sveltejs/kit is in devDependencies", async () => {
    writeFile(tempDir, "package.json", JSON.stringify({
      devDependencies: { "@sveltejs/kit": "^1.0.0" },
    }));

    const result = await detectFramework(tempDir);
    expect(result).toBe("svelte");
  });

  it("detects 'angular' when @angular/core is in dependencies", async () => {
    writeFile(tempDir, "package.json", JSON.stringify({
      dependencies: { "@angular/core": "^16.0.0" },
    }));

    const result = await detectFramework(tempDir);
    expect(result).toBe("angular");
  });

  it("detects 'html' when HTML files exist but no package.json", async () => {
    writeFile(tempDir, "index.html", "<html><body>Hello</body></html>");

    const result = await detectFramework(tempDir);
    expect(result).toBe("html");
  });

  it("returns 'unknown' when no framework detected", async () => {
    // Empty directory, no package.json, no HTML files
    const result = await detectFramework(tempDir);
    expect(result).toBe("unknown");
  });

  it("searches parent directories for package.json", async () => {
    // package.json in parent
    writeFile(tempDir, "package.json", JSON.stringify({
      dependencies: { react: "^18.0.0" },
    }));

    const childDir = join(tempDir, "src");
    mkdirSync(childDir, { recursive: true });

    const result = await detectFramework(childDir);
    expect(result).toBe("react");
  });

  it("prioritizes 'next' over 'react' when both present", async () => {
    writeFile(tempDir, "package.json", JSON.stringify({
      dependencies: { next: "^14.0.0", react: "^18.0.0" },
    }));

    const result = await detectFramework(tempDir);
    expect(result).toBe("next");
  });
});

// ── collectFrontendFiles ─────────────────────────────────────────

describe("collectFrontendFiles", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("collects .tsx, .ts, .css, .html files", async () => {
    writeFile(tempDir, "App.tsx", "export const App = () => <div />;");
    writeFile(tempDir, "utils.ts", "export const add = (a: number, b: number) => a + b;");
    writeFile(tempDir, "styles.css", ".app { color: red; }");
    writeFile(tempDir, "index.html", "<html><body></body></html>");

    const files = await collectFrontendFiles(tempDir);

    const extensions = files.map((f) => f.extension).sort();
    expect(extensions).toContain(".tsx");
    expect(extensions).toContain(".ts");
    expect(extensions).toContain(".css");
    expect(extensions).toContain(".html");
  });

  it("ignores node_modules", async () => {
    writeFile(tempDir, "App.tsx", "export const App = () => <div />;");
    writeFile(tempDir, "node_modules/lib/index.js", "module.exports = {};");

    const files = await collectFrontendFiles(tempDir);

    const paths = files.map((f) => f.relativePath);
    expect(paths).not.toContain(expect.stringContaining("node_modules"));
  });

  it("ignores dist and build directories", async () => {
    writeFile(tempDir, "App.tsx", "export const App = () => <div />;");
    writeFile(tempDir, "dist/index.js", "compiled code");
    writeFile(tempDir, "build/index.js", "compiled code");

    const files = await collectFrontendFiles(tempDir);
    const paths = files.map((f) => f.relativePath);

    for (const p of paths) {
      expect(p).not.toContain("dist/");
      expect(p).not.toContain("build/");
    }
  });

  it("ignores test files (*.test.*, *.spec.*)", async () => {
    writeFile(tempDir, "App.tsx", "export const App = () => <div />;");
    writeFile(tempDir, "App.test.tsx", "test('renders', () => {});");
    writeFile(tempDir, "App.spec.tsx", "test('renders', () => {});");

    const files = await collectFrontendFiles(tempDir);
    const paths = files.map((f) => f.relativePath);

    expect(paths).not.toContain(expect.stringContaining(".test."));
    expect(paths).not.toContain(expect.stringContaining(".spec."));
  });

  it("returns correct FileInfo structure", async () => {
    const content = "export const x = 42;\nexport const y = 'hello';";
    writeFile(tempDir, "constants.ts", content);

    const files = await collectFrontendFiles(tempDir);
    const file = files.find((f) => f.relativePath === "constants.ts");

    expect(file).toBeDefined();
    expect(file!.extension).toBe(".ts");
    expect(file!.content).toBe(content);
    expect(file!.lineCount).toBe(2);
    expect(file!.size).toBeGreaterThan(0);
    expect(file!.path).toContain("constants.ts");
  });

  it("respects maxFiles limit", async () => {
    for (let i = 0; i < 10; i++) {
      writeFile(tempDir, `file${i}.ts`, `export const x${i} = ${i};`);
    }

    const files = await collectFrontendFiles(tempDir, 3);
    expect(files.length).toBeLessThanOrEqual(3);
  });

  it("collects .jsx, .vue, .svelte, .scss files", async () => {
    writeFile(tempDir, "Component.jsx", "export default function C() { return <div />; }");
    writeFile(tempDir, "Page.vue", "<template><div /></template>");
    writeFile(tempDir, "App.svelte", "<script>let name = 'world';</script>");
    writeFile(tempDir, "theme.scss", "$primary: blue;");

    const files = await collectFrontendFiles(tempDir);
    const extensions = files.map((f) => f.extension);

    expect(extensions).toContain(".jsx");
    expect(extensions).toContain(".vue");
    expect(extensions).toContain(".svelte");
    expect(extensions).toContain(".scss");
  });

  it("returns empty array for empty directory", async () => {
    const files = await collectFrontendFiles(tempDir);
    expect(files).toHaveLength(0);
  });
});

// ── countLines ───────────────────────────────────────────────────

describe("countLines", () => {
  it("counts single line", () => {
    expect(countLines("hello")).toBe(1);
  });

  it("counts multiple lines", () => {
    expect(countLines("line1\nline2\nline3")).toBe(3);
  });

  it("counts empty string as 1 line", () => {
    expect(countLines("")).toBe(1);
  });

  it("handles trailing newline", () => {
    expect(countLines("line1\nline2\n")).toBe(3);
  });
});
