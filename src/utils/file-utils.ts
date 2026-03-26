import { readFile, stat } from "node:fs/promises";
import { glob } from "glob";
import { resolve, relative, extname } from "node:path";

// ── Framework Detection ────────────────────────────────────────────

export type Framework =
  | "react"
  | "next"
  | "vue"
  | "svelte"
  | "angular"
  | "html"
  | "unknown";

async function detectFrameworkFromPkgJson(
  dir: string
): Promise<Framework | null> {
  try {
    const pkgPath = resolve(dir, "package.json");
    const content = await readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(content);
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };

    if (allDeps["next"]) return "next";
    if (allDeps["react"]) return "react";
    if (allDeps["vue"]) return "vue";
    if (allDeps["svelte"] || allDeps["@sveltejs/kit"]) return "svelte";
    if (allDeps["@angular/core"]) return "angular";
  } catch {
    // No package.json or parsing failed
  }
  return null;
}

export async function detectFramework(directory: string): Promise<Framework> {
  // Search for package.json in the given directory, then one and two levels up
  const searchDirs = [
    directory,
    resolve(directory, ".."),
    resolve(directory, "..", ".."),
  ];

  for (const dir of searchDirs) {
    const framework = await detectFrameworkFromPkgJson(dir);
    if (framework) return framework;
  }

  // Check for HTML files
  const htmlFiles = await glob("**/*.html", {
    cwd: directory,
    ignore: ["node_modules/**"],
    nodir: true,
  });
  if (htmlFiles.length > 0) return "html";

  return "unknown";
}

// ── File Collection ────────────────────────────────────────────────

const FRONTEND_EXTENSIONS = new Set([
  ".tsx",
  ".jsx",
  ".ts",
  ".js",
  ".vue",
  ".svelte",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".html",
  ".htm",
]);

export interface FileInfo {
  readonly path: string;
  readonly relativePath: string;
  readonly extension: string;
  readonly content: string;
  readonly lineCount: number;
  readonly size: number;
}

export async function collectFrontendFiles(
  directory: string,
  maxFiles: number = 200,
  additionalIgnorePatterns: readonly string[] = []
): Promise<readonly FileInfo[]> {
  const patterns = [
    "**/*.tsx",
    "**/*.jsx",
    "**/*.ts",
    "**/*.js",
    "**/*.vue",
    "**/*.svelte",
    "**/*.css",
    "**/*.scss",
    "**/*.html",
  ];

  const ignorePatterns = [
    "node_modules/**",
    "dist/**",
    "build/**",
    ".next/**",
    ".nuxt/**",
    "coverage/**",
    "**/*.min.*",
    "**/*.bundle.*",
    "**/vendor/**",
    "**/__tests__/**",
    "**/*.test.*",
    "**/*.spec.*",
    ...additionalIgnorePatterns,
  ];

  const allFiles: string[] = [];

  for (const pattern of patterns) {
    const files = await glob(pattern, {
      cwd: directory,
      ignore: ignorePatterns,
      nodir: true,
    });
    allFiles.push(...files);
  }

  // Deduplicate and limit
  const uniqueFiles = [...new Set(allFiles)].slice(0, maxFiles);

  const fileInfos: FileInfo[] = [];

  for (const filePath of uniqueFiles) {
    try {
      const fullPath = resolve(directory, filePath);
      const ext = extname(filePath);

      if (!FRONTEND_EXTENSIONS.has(ext)) continue;

      const fileStat = await stat(fullPath);
      if (fileStat.size > 500_000) continue; // Skip files > 500KB

      const content = await readFile(fullPath, "utf-8");
      const lineCount = content.split("\n").length;

      fileInfos.push({
        path: fullPath,
        relativePath: relative(directory, fullPath),
        extension: ext,
        content,
        lineCount,
        size: fileStat.size,
      });
    } catch {
      // Skip unreadable files
    }
  }

  return fileInfos;
}

// ── Line Counting ──────────────────────────────────────────────────

export function countLines(content: string): number {
  return content.split("\n").length;
}
