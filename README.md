# UIMax MCP

**Turns Claude Code into a frontend expert that reviews and fixes your UI automatically.**

<p align="center">
  <img src="https://img.shields.io/npm/v/uimax-mcp" alt="npm version" />
  <img src="https://img.shields.io/npm/dm/uimax-mcp" alt="npm downloads" />
  <img src="https://img.shields.io/npm/l/uimax-mcp" alt="license" />
  <img src="https://img.shields.io/badge/tools-34-blue" alt="34 tools" />
  <img src="https://img.shields.io/badge/tests-463%20passing-brightgreen" alt="463 tests passing" />
  <img src="https://img.shields.io/badge/cost-free%20(Pro%20plan)-brightgreen" alt="free for Pro plan" />
</p>

One command — *"review my UI at localhost:3000"* — and it:

1. **Sees your app** — captures a real screenshot via Puppeteer
2. **Audits accessibility** — runs axe-core for WCAG 2.1 violations
3. **Runs Lighthouse** — real Google Lighthouse scores (Performance, Accessibility, Best Practices, SEO)
4. **Measures performance** — captures Core Web Vitals (FCP, LCP, CLS, TBT)
5. **Scans your code** — AST-based analysis for 25+ anti-patterns across accessibility, design, and code quality
6. **Generates an expert review** — Claude acts as a senior frontend engineer with a baked-in review methodology
7. **Implements the fixes** — edits your actual code files, starting from critical issues down
8. **Tracks everything** — auto-saves review history so you can see progress over time

**Works on any URL** — localhost, staging, production. Any site your machine can reach.

**Free for all Claude Code users (Pro plan and above). No API keys. No extra costs. Just install and go.**

```bash
claude mcp add uimax -- npx -y uimax-mcp
```

---

## Quick Start

### Install as MCP Server (for Claude Code)

```bash
# Add to Claude Code — that's it, no API keys needed
claude mcp add uimax -- npx -y uimax-mcp
```

That's it. Now in any Claude Code conversation:

```
You: Review the UI at http://localhost:3000, source code is in ./src

Claude Code calls review_ui ->
  1. Captures screenshot of your running app
  2. Runs axe-core accessibility audit
  3. Runs Google Lighthouse (Performance, A11y, Best Practices, SEO)
  4. Measures Core Web Vitals
  5. Scans source code with AST-based analysis
  6. Returns screenshot + all data + expert review methodology
  7. Claude Code generates expert review (using YOUR Pro plan -- $0 extra)
  8. Claude Code implements every fix automatically
  9. Review saved to .uimax-reviews.json for tracking
```

### Install Globally

```bash
npm install -g uimax-mcp
```

---

## Tools (34)

### Review Pipeline

| Tool | Description |
|------|-------------|
| `review_ui` | **The main tool.** Full automated pipeline: screenshot + Lighthouse + axe-core + performance + code analysis + expert review methodology. Auto-saves to review history. |
| `quick_review` | Fast design-only review. Screenshot + focused design methodology. No code analysis or performance audit. |
| `export_report` | Generate a standalone HTML report with everything embedded. Dark themed, zero dependencies. Share with your team. |

### Screenshots & Visual

| Tool | Description |
|------|-------------|
| `screenshot` | Capture a high-resolution PNG screenshot of any URL. |
| `responsive_screenshots` | Screenshots at mobile (375px), tablet (768px), and desktop (1440px) viewports. |
| `check_dark_mode` | Compare light mode vs dark mode (emulated). Returns both screenshots + difference percentage. |
| `compare_screenshots` | Pixel-level diff using `pixelmatch`. Returns both screenshots + red-highlighted diff image + exact pixel difference %. |
| `semantic_compare` | **AI-powered visual comparison.** Captures before/after + pixel diff, returns structured methodology for Claude to evaluate whether changes match the intended design request. |

### Lighthouse & Performance

| Tool | Description |
|------|-------------|
| `lighthouse_audit` | Full Google Lighthouse audit — Performance, Accessibility, Best Practices, SEO scores + failing audits. |
| `pwa_audit` | PWA readiness: installable, service worker, HTTPS, manifest, offline capability. |
| `security_audit` | Security analysis: HTTPS, CSP, mixed content, vulnerable JS libraries, external links without `noopener`. |
| `unused_code` | Find unused JavaScript and CSS with exact byte savings per resource. |
| `lcp_optimization` | Deep LCP analysis: what the element is, resource load time, render delay, TTFB, optimization suggestions. |
| `resource_analysis` | Full resource breakdown by type, transfer sizes, request count, top 10 largest, render-blocking resources. |
| `performance_audit` | Core Web Vitals via Performance API: FCP, LCP, CLS, TBT, DOM node count, JS heap size. |
| `accessibility_audit` | axe-core WCAG 2.1 Level A & AA audit. Violations grouped by severity with fix instructions. |

### Code Analysis

| Tool | Description |
|------|-------------|
| `analyze_code` | AST-based analysis (TypeScript compiler API) for 25+ rules. Zero false positives on string literals. Falls back to regex for non-JS files. Configurable via `.uimaxrc.json`. |

### Browser Interaction

| Tool | Description |
|------|-------------|
| `navigate` | Navigate to a URL, wait for network idle. Returns page info + screenshot. |
| `click` | Click an element by CSS selector. Returns screenshot after click. |
| `type_text` | Type into input fields. Options: `clearFirst`, `pressEnter`. Returns screenshot after. |
| `select_option` | Select a dropdown option by value. Returns screenshot after. |
| `scroll` | Scroll by pixel amount or to a specific element. Returns screenshot after. |
| `wait_for` | Wait for an element to appear in the DOM. Returns tag name and text content. |
| `get_element` | Get element details: attributes, bounding box, computed styles, visibility. |

### Debugging

| Tool | Description |
|------|-------------|
| `capture_console` | Capture all console messages (log, warn, error, info, debug) + uncaught exceptions during page load. |
| `capture_network` | Capture all network requests with status, size, timing, resource type. Summary grouped by type. |
| `capture_errors` | Capture JS exceptions, unhandled rejections, and failed resource loads. |

### Multi-Page

| Tool | Description |
|------|-------------|
| `crawl_and_review` | Discover internal links from a URL and audit up to 10 pages — screenshot + axe-core + performance each. |

### Baselines & Budgets

| Tool | Description |
|------|-------------|
| `save_baseline` | Save current audit state to `.uimax-history.json`. Track scores over time. |
| `compare_to_baseline` | Compare current state vs previous baseline. Shows improvements and regressions. |
| `check_budgets` | Enforce performance budgets from `.uimaxrc.json`. Pass/fail for Lighthouse scores, Web Vitals, violation counts. |

### Review History

| Tool | Description |
|------|-------------|
| `get_review_history` | View past UIMax reviews for this project. Filter by URL, limit count. |
| `get_review_stats` | Aggregate statistics: total reviews, score trends, most common issues, most problematic files. |
| `review_diff` | Compare two specific reviews — new issues, resolved issues, score changes with improved/regressed indicators. |

> **Every review is auto-saved.** When you run `review_ui`, the results are automatically persisted to `.uimax-reviews.json`. No manual save needed — just ask "show me my review history" anytime.

---

## AST-Powered Code Analysis

The `analyze_code` tool uses the **TypeScript compiler API** for `.ts/.tsx/.js/.jsx` files — catching bugs that regex misses with zero false positives.

| Rule | What AST catches that regex misses |
|------|-----------------------------------|
| `react-hooks-conditional` | Hooks inside nested if/for/while/ternary — proper scope traversal |
| `missing-key-prop` | `.map()` callbacks returning JSX without `key` — handles arrow/block bodies |
| `empty-catch` | Empty catch blocks — not fooled by comments |
| `any-type` | `any` in type positions only — ignores "any" in strings/comments |
| `direct-dom-access` | `document.querySelector` etc. — proper call expression matching |
| `console-log` | `console.log/warn/error` — not fooled by variable names containing "console" |
| `inline-style` | JSX `style={}` attributes — proper attribute detection |

Falls back to regex for file types that can't be AST-parsed and for rules without AST implementations (hardcoded colors, z-index, font sizes, etc.).

---

## Configuration

Create a `.uimaxrc.json` in your project root to customize code analysis and performance budgets:

```json
{
  "rules": {
    "console-log": "off",
    "magic-number": "off",
    "hardcoded-color": "warn",
    "inline-style": "error"
  },
  "severity": {
    "todo-fixme": "high"
  },
  "ignore": [
    "node_modules",
    "dist",
    "*.test.*",
    "*.spec.*"
  ],
  "budgets": {
    "lighthouse": {
      "performance": 90,
      "accessibility": 95,
      "bestPractices": 90,
      "seo": 90
    },
    "webVitals": {
      "fcp": 1800,
      "lcp": 2500,
      "cls": 0.1,
      "tbt": 300
    },
    "maxAccessibilityViolations": 0,
    "maxCodeIssues": 10
  }
}
```

- **`rules`** — Set any rule to `"off"`, `"warn"`, or `"error"`
- **`severity`** — Override severity: `"low"`, `"medium"`, `"high"`, `"critical"`
- **`ignore`** — Additional glob patterns to exclude from analysis
- **`budgets`** — Performance thresholds enforced by the `check_budgets` tool

UIMax searches for `.uimaxrc.json` in the target directory and up to 3 parent directories, so it works in monorepos.

---

## Prompts

Expert review prompts that guide Claude's analysis:

| Prompt | Use Case |
|--------|----------|
| `ui-review` | Comprehensive review (design + UX + a11y + perf + code) |
| `responsive-review` | Responsive design review across viewports |
| `quick-design-review` | Fast visual/UX feedback from a screenshot only |
| `semantic-compare` | AI-powered before/after visual comparison |

---

## Example Workflows

### Full Review (the main workflow)
```
You: Review the UI at http://localhost:3000
     Source code is in ./src

Claude: [Calls review_ui]
        [Captures screenshot, runs Lighthouse + axe + perf + code scan]
        [Generates 20+ findings with specific fixes]
        [Implements every fix automatically]
        [Auto-saves review to .uimax-reviews.json]
```

### Review Any Public Website
```
You: Review the UI at https://stripe.com

Claude: [Calls review_ui]
        [Full audit of the live production site]
        [Returns findings + recommendations]
```

### Track Progress Over Time
```
You: Show me my review history

Claude: [Calls get_review_history]
        [Shows table of past reviews: dates, scores, issue counts]

You: Compare my last two reviews

Claude: [Calls review_diff]
        [Shows what improved ✅, what regressed ❌, new issues, resolved issues]

You: What are my most common issues?

Claude: [Calls get_review_stats]
        [Shows trends, most common issues, most problematic files]
```

### Interact with Your App
```
You: Navigate to localhost:3000, click the login button,
     type "test@email.com" in the email field

Claude: [Calls navigate → click → type_text]
        [Returns a screenshot after each action]
        [Verifies each step visually]
```

### Deep Performance Analysis
```
You: Find unused code on https://myapp.com

Claude: [Calls unused_code]
        [Lists every unused JS/CSS file with byte savings]
        [Suggests what to tree-shake]

You: Why is my LCP slow?

Claude: [Calls lcp_optimization]
        [Identifies the LCP element, breakdown of load time]
        [Specific optimization suggestions]
```

### Debug Page Load Issues
```
You: What console errors does localhost:3000 produce?

Claude: [Calls capture_console]
        [Returns all console messages + uncaught exceptions]

You: Show me all network requests on page load

Claude: [Calls capture_network]
        [Returns every request: URL, status, size, timing]
        [Summary grouped by resource type]
```

### Before/After Comparison
```
You: Compare localhost:3000 with localhost:3001

Claude: [Calls compare_screenshots]
        [Pixel-level diff with red-highlighted changes]
        [Reports exact pixel difference %]
```

### Semantic Visual Review
```
You: I changed the header to be sticky. Compare before and after.

Claude: [Calls semantic_compare with change description]
        [Captures both states + pixel diff]
        [Evaluates whether changes match the intent]
        [Checks for visual regressions]
```

### Enforce Performance Budgets
```
You: Check if my site meets our performance budgets

Claude: [Calls check_budgets]
        [Reads thresholds from .uimaxrc.json]
        [Returns ✅ pass or ❌ fail for each metric]
```

### Generate Shareable Report
```
You: Export a full report of localhost:3000 to ./report.html

Claude: [Calls export_report]
        [Generates standalone dark-themed HTML report]
        [Open in any browser, share with team]
```

### Multi-Page Audit
```
You: Crawl localhost:3000 and audit all pages

Claude: [Calls crawl_and_review]
        [Discovers internal links, audits up to 10 pages]
        [Per-page: screenshot + accessibility + performance]
```

---

## What Claude Reviews

When using the full `review_ui` pipeline, Claude evaluates:

| Category | What's Checked |
|----------|----------------|
| **Visual Design** | Layout, typography, color contrast, whitespace, shadows, icon consistency |
| **User Experience** | Navigation, interaction states, loading/error/empty states, edge cases |
| **Accessibility** | WCAG 2.1 AA, keyboard nav, screen reader compat, focus management |
| **Performance** | Lighthouse scores, Core Web Vitals, render-blocking resources, bundle size |
| **Code Quality** | Component architecture, CSS organization, error boundaries, TypeScript safety |
| **Security** | HTTPS, CSP, vulnerable libraries, mixed content |
| **Creative** | Modern UI patterns (Linear, Vercel, Raycast), micro-interactions, animations |

---

## Code Analysis Rules

The `analyze_code` tool checks for **25+ rules** across categories:

| Rule | Severity | Category |
|------|----------|----------|
| `img-no-alt` | High | Accessibility |
| `click-no-keyboard` | High | Accessibility |
| `no-form-label` | High | Accessibility |
| `missing-viewport-meta` | High | Accessibility |
| `no-lang-attr` | Medium | Accessibility |
| `no-focus-visible` | Medium | Accessibility |
| `empty-catch` | High | Code Quality |
| `react-hooks-conditional` | High | Code Quality |
| `missing-key-prop` | High | Bug |
| `console-log` | Low | Code Quality |
| `todo-fixme` | Low | Code Quality |
| `inline-style` | Medium | Code Quality |
| `any-type` | Medium | Code Quality |
| `magic-number` | Low | Code Quality |
| `direct-dom-access` | Medium | Code Quality |
| `event-handler-inline` | Low | Code Quality |
| `important-css` | Medium | Design |
| `hardcoded-color` | Low | Design |
| `z-index-high` | Medium | Design |
| `font-too-small` | Medium | Design |
| `no-lazy-image` | Medium | Performance |
| `large-bundle-import` | Medium | Performance |
| `no-error-boundary` | Medium | UX |
| `missing-meta-description` | Medium | UX |
| `large-file` | Medium/High | Code Quality |
| `deep-nesting` | Medium/High | Code Quality |

All rules can be toggled via [`.uimaxrc.json`](#configuration).

---

## Supported Frameworks

Auto-detected from `package.json`:
- React / Next.js
- Vue / Nuxt
- Svelte / SvelteKit
- Angular
- Plain HTML/CSS/JS

---

## Requirements

- **Node.js** >= 18.0.0
- **Chrome/Chromium** (uses your system Chrome — no extra download)
- **Claude Code** (for MCP integration)
- **No API keys needed** — runs entirely within Claude Code using your existing Pro plan

---

## How It Works

```
+----------------------------------------------------------------------+
|                    Claude Code (your Pro plan)                         |
|                                                                       |
|  User: "Review my UI at localhost:3000 and fix everything"            |
|           |                                                           |
|           v                                                           |
|  +----------------------------------------------------------------+  |
|  |                UIMax MCP (34 tools)                             |  |
|  |                                                                 |  |
|  |  Screenshot -------> Puppeteer ----------> PNG Image            |  |
|  |  Accessibility ----> axe-core ------------> WCAG Violations     |  |
|  |  Lighthouse -------> Google LH ----------> Scores + Audits     |  |
|  |  Deep LH ----------> PWA/Security/LCP --> Granular Analysis    |  |
|  |  Performance ------> Perf API ----------> Web Vitals           |  |
|  |  Code Scan --------> TypeScript AST -----> Anti-patterns       |  |
|  |  Browser ----------> Click/Type/Scroll --> Interaction          |  |
|  |  Debugging --------> Console/Network ----> Runtime Data        |  |
|  |  History ----------> .uimax-reviews.json > Progress Tracking   |  |
|  |  Expert Prompt ----> Baked-in methodology                      |  |
|  +----------------------------+-----------------------------------+  |
|                               |                                      |
|                               v                                      |
|  Claude Code receives: screenshot + data + expert methodology        |
|                               |                                      |
|                               v                                      |
|  Claude acts as world-class frontend expert (FREE -- Pro plan)       |
|     Generates comprehensive review with exact fixes                  |
|                               |                                      |
|                               v                                      |
|  Claude implements every fix in the codebase automatically           |
|                                                                       |
+----------------------------------------------------------------------+
```

---

## Development

```bash
# Clone
git clone https://github.com/prembobby39-gif/uimax-mcp.git
cd uimax-mcp

# Install
npm install

# Build
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Test locally with Claude Code
claude mcp add uimax-dev -- node /path/to/uimax-mcp/dist/index.js
```

---

## Contributing

Contributions welcome! Some ideas:

- [ ] CSS specificity analyzer
- [ ] Design token extraction
- [ ] Framework-specific checks (Vue composition API, Svelte stores)
- [x] Visual regression with pixel-level diffing
- [x] Performance budgets (fail if scores drop below thresholds)
- [x] Browser interaction (click, type, scroll, navigate)
- [x] Console and network capture
- [x] Deep Lighthouse analysis (PWA, security, unused code, LCP, resources)
- [x] AI-powered semantic visual comparison
- [x] Review history tracking with auto-save
- [ ] Custom rule plugins (user-defined regex rules)
- [ ] Figma design comparison (screenshot vs Figma mock)
- [ ] Cross-browser testing (Firefox, WebKit via Playwright)

---

## License

MIT
