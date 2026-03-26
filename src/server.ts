import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { captureScreenshot, captureResponsiveScreenshots } from "./tools/screenshot.js";
import { runAccessibilityAudit, formatAccessibilityReport } from "./tools/accessibility.js";
import { measurePerformance, formatPerformanceReport } from "./tools/performance.js";
import { analyzeCode, formatCodeAnalysisReport } from "./tools/code-analysis.js";
import { runFullReview, formatFullReviewReport } from "./tools/full-review.js";
import { checkDarkMode } from "./tools/dark-mode.js";
import { closeBrowser } from "./utils/browser.js";
import {
  UI_REVIEW_PROMPT,
  RESPONSIVE_REVIEW_PROMPT,
  QUICK_DESIGN_PROMPT,
} from "./prompts/review.js";

// ── Server Creation ────────────────────────────────────────────────

export function createServer(): McpServer {
  const server = new McpServer({
    name: "uimax",
    version: "0.2.0",
    // 0.2.0: Dark mode detection, 25+ code rules, framework detection fix
  });

  // ── Primary Tools (automated pipeline) ────────────────────────

  server.tool(
    "review_ui",
    `THE PRIMARY TOOL — Fully automated UI review pipeline. Captures a screenshot, runs accessibility/performance/code audits, then returns ALL data along with an expert frontend review methodology so you can generate a comprehensive review and implement fixes.

Use this when the user asks to "review my UI", "audit my frontend", or "find UI issues". After receiving the results, you MUST:
1. Study the screenshot carefully for visual/UX issues
2. Analyze the audit data following the expert methodology provided
3. Generate a comprehensive review with SPECIFIC fixes (exact CSS values, code changes)
4. Implement the fixes directly in the codebase

This tool is FREE — it runs entirely within Claude Code using the user's existing plan. No API keys needed.`,
    {
      url: z.string().url().describe("URL of the running application (e.g., http://localhost:3000)"),
      codeDirectory: z.string().describe("Absolute path to the frontend source directory (e.g., /Users/me/project/src)"),
      width: z.number().optional().default(1440).describe("Viewport width in pixels"),
      height: z.number().optional().default(900).describe("Viewport height in pixels"),
    },
    async ({ url, codeDirectory, width, height }) => {
      try {
        // Collect all audit data
        const auditData = await runFullReview(url, codeDirectory, {
          width: width ?? 1440,
          height: height ?? 900,
        });

        const auditReport = formatFullReviewReport(auditData);

        // Return screenshot + data + expert prompt to Claude Code
        // Claude Code (on the user's Pro plan) generates the expert review itself
        return {
          content: [
            {
              type: "text" as const,
              text: [
                `# UIMax Data Collection Complete`,
                ``,
                `**URL:** ${url}`,
                `**Code Directory:** ${codeDirectory}`,
                `**Timestamp:** ${auditData.timestamp}`,
                `**Accessibility violations:** ${auditData.accessibility.violations.length}`,
                `**Accessibility passes:** ${auditData.accessibility.passes}`,
                `**Load time:** ${auditData.performance.loadTime.toFixed(0)}ms`,
                `**DOM nodes:** ${auditData.performance.domNodes}`,
                `**Code files analyzed:** ${auditData.codeAnalysis.totalFiles}`,
                `**Code findings:** ${auditData.codeAnalysis.findings.length}`,
                `**Framework detected:** ${auditData.codeAnalysis.framework}`,
                ``,
                `---`,
                ``,
                `## Screenshot of the live UI — study this carefully:`,
              ].join("\n"),
            },
            {
              type: "image" as const,
              data: auditData.screenshot.base64,
              mimeType: auditData.screenshot.mimeType,
            },
            {
              type: "text" as const,
              text: [
                ``,
                `---`,
                ``,
                auditReport,
                ``,
                `---`,
                ``,
                `# Expert Review Instructions`,
                ``,
                `You now have everything you need. Follow the methodology below to generate a comprehensive expert UI review, then implement every fix.`,
                ``,
                UI_REVIEW_PROMPT,
                ``,
                `---`,
                ``,
                `# Implementation Instructions`,
                ``,
                `After generating your review, IMMEDIATELY implement the fixes:`,
                `1. Start with CRITICAL severity findings`,
                `2. Then HIGH, MEDIUM, LOW in order`,
                `3. For each finding, locate the exact file and apply the specific code change`,
                `4. After implementing all fixes, provide a summary of what was changed`,
                ``,
                `DO NOT just list the findings — actually edit the code files and fix them.`,
              ].join("\n"),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `UI review failed: ${message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "quick_review",
    `Quick design-only review. Captures a screenshot and returns it with a focused design review methodology. No code analysis, no performance audit — just visual/UX feedback. Great for rapid design iteration.

After receiving the screenshot, analyze it as a senior UI designer and provide 5-10 high-impact observations with specific fixes.

This tool is FREE — runs entirely within Claude Code.`,
    {
      url: z.string().url().describe("URL of the page to review"),
    },
    async ({ url }) => {
      try {
        const screenshot = await captureScreenshot({
          url,
          width: 1440,
          height: 900,
          fullPage: true,
          delay: 1000,
          deviceScaleFactor: 2,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `# Quick Design Review\n\n**URL:** ${url}\n**Captured:** ${screenshot.timestamp}\n\nScreenshot:`,
            },
            {
              type: "image" as const,
              data: screenshot.base64,
              mimeType: screenshot.mimeType,
            },
            {
              type: "text" as const,
              text: [
                ``,
                `---`,
                ``,
                `# Review Methodology`,
                ``,
                QUICK_DESIGN_PROMPT,
                ``,
                `---`,
                ``,
                `After generating your design review, implement the fixes directly in the code.`,
              ].join("\n"),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Quick review failed: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // ── Individual Data Collection Tools ──────────────────────────

  server.tool(
    "screenshot",
    "Capture a screenshot of a webpage. Returns a PNG image that you can visually analyze for design issues, layout problems, and UI quality.",
    {
      url: z.string().url().describe("URL of the page to screenshot (e.g., http://localhost:3000)"),
      width: z.number().optional().default(1440).describe("Viewport width in pixels"),
      height: z.number().optional().default(900).describe("Viewport height in pixels"),
      fullPage: z.boolean().optional().default(true).describe("Capture the full scrollable page"),
      delay: z.number().optional().default(1000).describe("Wait time in ms after page load before capturing"),
    },
    async ({ url, width, height, fullPage, delay }) => {
      try {
        const result = await captureScreenshot({
          url,
          width: width ?? 1440,
          height: height ?? 900,
          fullPage: fullPage ?? true,
          delay: delay ?? 1000,
          deviceScaleFactor: 2,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Screenshot captured: ${result.url} (${result.width}x${result.height}) at ${result.timestamp}`,
            },
            {
              type: "image" as const,
              data: result.base64,
              mimeType: result.mimeType,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Screenshot failed: ${message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "responsive_screenshots",
    "Capture screenshots at mobile (375px), tablet (768px), and desktop (1440px) viewports. Perfect for reviewing responsive design.",
    {
      url: z.string().url().describe("URL of the page to capture"),
    },
    async ({ url }) => {
      try {
        const results = await captureResponsiveScreenshots(url);
        const labels = ["Mobile (375px)", "Tablet (768px)", "Desktop (1440px)"];

        const content = results.flatMap((result, i) => [
          {
            type: "text" as const,
            text: `### ${labels[i]}`,
          },
          {
            type: "image" as const,
            data: result.base64,
            mimeType: result.mimeType,
          },
        ]);

        content.push({
          type: "text" as const,
          text: [
            ``,
            `---`,
            ``,
            `# Responsive Review Methodology`,
            ``,
            RESPONSIVE_REVIEW_PROMPT,
          ].join("\n"),
        });

        return { content };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Responsive screenshots failed: ${message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "check_dark_mode",
    "Detect whether a webpage supports dark mode. Captures two screenshots — one in light mode and one with prefers-color-scheme: dark emulated — then compares them. Returns both screenshots and a difference percentage. Great for checking if dark mode is properly implemented.",
    {
      url: z.string().url().describe("URL of the page to check"),
    },
    async ({ url }) => {
      try {
        const result = await checkDarkMode(url);

        const status = result.hasDarkMode
          ? `Dark mode DETECTED (${result.differencePercent}% difference between light and dark)`
          : "No dark mode detected — the page looks identical in light and dark mode";

        return {
          content: [
            {
              type: "text" as const,
              text: `# Dark Mode Check\n\n**URL:** ${url}\n**Result:** ${status}\n\n## Light Mode:`,
            },
            {
              type: "image" as const,
              data: result.lightScreenshot.base64,
              mimeType: result.lightScreenshot.mimeType,
            },
            {
              type: "text" as const,
              text: `\n## Dark Mode (emulated):`,
            },
            {
              type: "image" as const,
              data: result.darkScreenshot.base64,
              mimeType: result.darkScreenshot.mimeType,
            },
            {
              type: "text" as const,
              text: result.hasDarkMode
                ? `\n\nDark mode is implemented. Review both screenshots for contrast issues, missing dark variants, or elements that don't adapt properly.`
                : `\n\nNo dark mode support detected. Consider adding \`prefers-color-scheme: dark\` media queries or CSS custom properties for theming. This is increasingly expected by users — ~80% of mobile users prefer dark mode.`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Dark mode check failed: ${message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "accessibility_audit",
    "Run an automated accessibility audit using axe-core. Checks for WCAG 2.1 Level A and AA violations, reporting issues by severity with specific fix instructions.",
    {
      url: z.string().url().describe("URL of the page to audit"),
    },
    async ({ url }) => {
      try {
        const result = await runAccessibilityAudit(url);
        const report = formatAccessibilityReport(result);

        return {
          content: [
            { type: "text" as const, text: report },
            {
              type: "text" as const,
              text: `\n\n<raw_data>\n${JSON.stringify(result, null, 2)}\n</raw_data>`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Accessibility audit failed: ${message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "performance_audit",
    "Measure Core Web Vitals and performance metrics: FCP, LCP, CLS, TBT, load time, resource count, DOM size, and JS heap usage.",
    {
      url: z.string().url().describe("URL of the page to measure"),
    },
    async ({ url }) => {
      try {
        const result = await measurePerformance(url);
        const report = formatPerformanceReport(result);

        return {
          content: [
            { type: "text" as const, text: report },
            {
              type: "text" as const,
              text: `\n\n<raw_data>\n${JSON.stringify(result, null, 2)}\n</raw_data>`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Performance audit failed: ${message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "analyze_code",
    "Analyze frontend source code for quality issues: accessibility anti-patterns, CSS problems, component complexity, design inconsistencies, and performance concerns.",
    {
      directory: z.string().describe("Absolute path to the frontend source directory (e.g., /Users/me/project/src)"),
    },
    async ({ directory }) => {
      try {
        const result = await analyzeCode(directory);
        const report = formatCodeAnalysisReport(result);

        return {
          content: [
            { type: "text" as const, text: report },
            {
              type: "text" as const,
              text: `\n\n<raw_data>\n${JSON.stringify(result, null, 2)}\n</raw_data>`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Code analysis failed: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // ── Prompts ────────────────────────────────────────────────────

  server.prompt(
    "ui-review",
    "Comprehensive UI review methodology. Use this prompt after running the review_ui tool to get expert-level analysis of the collected data.",
    () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: UI_REVIEW_PROMPT,
          },
        },
      ],
    })
  );

  server.prompt(
    "responsive-review",
    "Responsive design review methodology. Use after capturing responsive_screenshots to analyze layout across mobile, tablet, and desktop.",
    () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: RESPONSIVE_REVIEW_PROMPT,
          },
        },
      ],
    })
  );

  server.prompt(
    "quick-design-review",
    "Quick design-only review. Use after taking a screenshot when you just want visual/UX feedback without code analysis.",
    () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: QUICK_DESIGN_PROMPT,
          },
        },
      ],
    })
  );

  // ── Cleanup ────────────────────────────────────────────────────

  process.on("SIGINT", async () => {
    await closeBrowser();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await closeBrowser();
    process.exit(0);
  });

  return server;
}
