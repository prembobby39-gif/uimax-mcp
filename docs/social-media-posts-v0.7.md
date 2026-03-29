# Social Media Posts — UIMax MCP v0.7.0

> **Date:** March 27, 2026
> **Version:** 0.7.0 — 34 tools, 463 tests
> **GitHub:** https://github.com/prembobby39-gif/uimax-mcp
> **npm:** https://www.npmjs.com/package/uimax-mcp
> **Glama:** https://glama.ai/mcp/servers/prembobby39-gif/uimax-mcp

---

## 1. Hacker News — Show HN

**Title:**
```
Show HN: UIMax MCP – Turn Claude Code into a frontend expert (34 tools, free)
```

**URL field:** `https://github.com/prembobby39-gif/uimax-mcp`

**First comment (post immediately after submitting):**

```
Hey HN — I built UIMax MCP because I kept hitting the same wall with AI coding assistants: they write frontend code but can't see the running app. They don't know your Lighthouse score is 42 or that your button fails WCAG contrast.

UIMax MCP is an MCP server that gives Claude Code real eyes for your frontend. One command — "review my UI at localhost:3000" — triggers:

1. Puppeteer screenshot capture
2. axe-core WCAG 2.1 accessibility audit
3. Real Google Lighthouse (Performance, A11y, Best Practices, SEO)
4. Core Web Vitals (FCP, LCP, CLS, TBT)
5. AST-based code analysis (TypeScript Compiler API, not regex) for 25+ anti-patterns
6. Auto-saves review history so you can track progress over time

Then Claude acts as a senior frontend engineer and implements fixes in your actual codebase.

The MCP handles data collection. Your existing Claude subscription handles the thinking. Zero extra cost.

v0.7.0 ships 34 tools across 8 categories:

- Core review pipeline (review_ui, quick_review, screenshot, responsive, dark mode)
- Google Lighthouse (full audit + 5 deep-dive tools: PWA, security, unused code, LCP, resources)
- Accessibility (axe-core WCAG 2.1)
- Code analysis (AST-based, 25+ rules)
- Visual comparison (pixel-level diff via pixelmatch + semantic AI compare)
- Browser interaction (navigate, click, type, scroll, wait, get element — persistent page state)
- Console/network debugging (capture_console, capture_network, capture_errors)
- Review history tracking (auto-save, stats, diff between reviews)
- Performance budgets and baseline tracking

Tech: Puppeteer-core, axe-core, Lighthouse, pixelmatch, TypeScript Compiler API, Playwright, Zod. 463 tests passing.

Install:
  claude mcp add uimax -- npx -y uimax-mcp

MIT licensed. Solo dev. Happy to answer questions about the architecture.
```

---

## 2. Dev.to Article

**Title:** `I built an MCP server that turns Claude Code into a frontend expert — here's what it does`

**Tags:** `#mcp` `#webdev` `#accessibility` `#claudecode` `#frontend`

**Body:**

```markdown
AI coding assistants write frontend code, but they can't *see* the running app. They don't know your Lighthouse score. They can't detect WCAG violations in the rendered DOM. They review code in a vacuum.

I built [UIMax MCP](https://github.com/prembobby39-gif/uimax-mcp) to close that gap.

## What it does

One command — *"review my UI at localhost:3000"* — and Claude Code:

1. **Captures a real screenshot** via Puppeteer
2. **Runs axe-core** for WCAG 2.1 accessibility violations
3. **Runs Google Lighthouse** — real Performance, Accessibility, Best Practices, SEO scores
4. **Measures Core Web Vitals** — FCP, LCP, CLS, TBT
5. **Scans your code** with AST-based analysis (TypeScript Compiler API) for 25+ anti-patterns
6. **Generates an expert review** — Claude acts as a senior frontend engineer
7. **Implements every fix** in your actual codebase
8. **Saves review history** so you can track progress over time

## 34 tools across 8 categories

| Category | Tools |
|----------|-------|
| Core review | `review_ui`, `quick_review`, `screenshot`, `responsive_screenshots`, `check_dark_mode` |
| Lighthouse | `lighthouse_audit`, `pwa_audit`, `security_audit`, `unused_code`, `lcp_optimization`, `resource_analysis` |
| Accessibility | `accessibility_audit` (axe-core WCAG 2.1) |
| Code analysis | `analyze_code` (AST-based, 25+ rules) |
| Visual comparison | `compare_screenshots` (pixel diff), `semantic_compare` (AI-powered) |
| Browser interaction | `navigate`, `click`, `type_text`, `select_option`, `scroll`, `wait_for`, `get_element` |
| Debugging | `capture_console`, `capture_network`, `capture_errors` |
| History | `save_baseline`, `compare_to_baseline`, `check_budgets`, `get_review_history`, `get_review_stats`, `review_diff` |

## How it works

The key insight: the MCP server handles all data collection (screenshots, audits, metrics), and Claude Code — using your existing subscription — does the expert review and code fixes.

**Zero extra cost.** No API keys. No SaaS. No usage limits.

## Why AST-based code analysis?

Most linters use regex. UIMax uses the TypeScript Compiler API (`ts.createSourceFile()`) to build an actual AST. This means:

- Zero false positives on `react-hooks-conditional`, `missing-key-prop`, `empty-catch`, `any-type`, `direct-dom-access`, `console-log`, `inline-style`
- Findings tagged with `analysisMethod: "ast"` vs `"regex"` so you know the confidence level

## Install

```bash
claude mcp add uimax -- npx -y uimax-mcp
```

One command. Works immediately. MIT licensed. 463 tests passing.

GitHub: [prembobby39-gif/uimax-mcp](https://github.com/prembobby39-gif/uimax-mcp)
npm: [uimax-mcp](https://www.npmjs.com/package/uimax-mcp)

Would love to hear what tools you'd want added next.
```

---

## 3. Reddit — r/ClaudeAI

**Title:** `I built UIMax MCP — an MCP server with 34 tools that turns Claude Code into a frontend expert (free, open source)`

**Body:**

```
I built an MCP server that gives Claude Code real eyes for your frontend.

One command — "review my UI at localhost:3000" — triggers screenshot capture, axe-core accessibility audit, real Lighthouse scores, Core Web Vitals, AST-based code analysis, and then Claude reviews everything as a senior frontend engineer and implements the fixes.

**v0.7.0 highlights:**
- 34 tools across 8 categories
- Browser interaction (navigate, click, type, scroll — persistent page state with screenshots)
- AST-based code analysis via TypeScript Compiler API (not regex)
- Review history tracking — auto-saves every review, stats, and diff between reviews
- Performance budgets and baseline tracking
- Console/network capture for debugging
- Pixel-level visual diff + semantic AI-powered comparison
- Deep Lighthouse tools (PWA, security, unused code, LCP, resources)

**Install:**
```
claude mcp add uimax -- npx -y uimax-mcp
```

Free. MIT licensed. No API keys. 463 tests passing.

GitHub: https://github.com/prembobby39-gif/uimax-mcp

I built this because Claude Code is great at writing code but can't see the running app. This closes that gap. Happy to answer questions.
```

---

## 4. Reddit — r/SideProject

**Title:** `I built UIMax MCP — 34 free tools that turn Claude Code into a frontend expert that reviews and fixes your UI`

**Body:**

```
**What is it:** An open-source MCP server that gives Claude Code real eyes for your frontend.

**The problem:** AI coding assistants write code but can't see the running app. They don't know your Lighthouse score or accessibility violations.

**The solution:** One command — "review my UI at localhost:3000" — and it captures screenshots, runs real Lighthouse, audits accessibility with axe-core, measures Core Web Vitals, scans code with AST analysis, then Claude acts as a senior frontend engineer and implements fixes.

**Tech stack:**
- TypeScript
- Puppeteer-core (screenshots)
- axe-core (WCAG 2.1 accessibility)
- Google Lighthouse (perf/a11y/SEO)
- TypeScript Compiler API (AST-based code analysis)
- pixelmatch (visual diffing)
- Playwright (browser interaction)
- Vitest (463 tests)

**Pricing:** Free forever. MIT licensed. No API keys. Your existing Claude subscription handles everything.

**What I'd love feedback on:** What tools would make this more useful for your workflow? Currently 34 tools across screenshot capture, Lighthouse, accessibility, code analysis, visual comparison, browser interaction, debugging, and review history.

GitHub: https://github.com/prembobby39-gif/uimax-mcp

Install: `claude mcp add uimax -- npx -y uimax-mcp`
```

---

## 5. Reddit — r/ClaudeCode

**Title:** `UIMax MCP v0.7.0 — 34 tools that turn Claude Code into a frontend expert (free)`

**Body:**

```
Just shipped v0.7.0 of UIMax MCP. It's an MCP server that gives Claude Code the ability to see and interact with your running frontend.

**What it does with one command:**
1. Captures real screenshots (Puppeteer)
2. Runs axe-core WCAG 2.1 audit
3. Runs real Google Lighthouse
4. Measures Core Web Vitals
5. AST-based code analysis (25+ rules)
6. Claude reviews as a senior frontend engineer
7. Claude implements all fixes
8. Auto-saves review history

**New in v0.7.0:**
- Review history tracking with stats and diff
- Browser interaction (navigate, click, type with persistent page state)
- Deep Lighthouse tools (PWA, security, unused code, LCP)
- Console/network/error capture
- Semantic AI-powered visual comparison
- Performance budgets

Install:
```
claude mcp add uimax -- npx -y uimax-mcp
```

34 tools, 463 tests. Free + MIT licensed.

https://github.com/prembobby39-gif/uimax-mcp
```

---

## 6. Twitter/X — Main Post

```
I built UIMax MCP — an MCP server with 34 tools that turns Claude Code into a frontend expert.

One command: "review my UI at localhost:3000"

It captures screenshots, runs Lighthouse, audits accessibility, scans code with AST analysis, then Claude reviews everything and implements fixes.

Free. Open source. 463 tests.

Install: claude mcp add uimax -- npx -y uimax-mcp

https://github.com/prembobby39-gif/uimax-mcp
```

---

## 7. Twitter/X — Thread Version

**Tweet 1:**
```
UIMax MCP v0.7 — 34 tools that turn Claude Code into a frontend expert.

One command reviews your entire UI, then Claude implements fixes.

Here's what happens behind the scenes: 🧵
```

**Tweet 2:**
```
1. Puppeteer captures a real screenshot
2. axe-core runs WCAG 2.1 on the live DOM
3. Google Lighthouse scores Performance, A11y, Best Practices, SEO
4. Core Web Vitals: FCP, LCP, CLS, TBT
5. AST-based code analysis (TypeScript Compiler API, not regex)
```

**Tweet 3:**
```
New in v0.7:

- Browser interaction (navigate, click, type — persistent page state)
- Review history tracking with stats & diff
- Console/network capture for debugging
- Semantic AI-powered visual comparison
- Performance budgets
- Deep Lighthouse (PWA, security, unused code)
```

**Tweet 4:**
```
The key: MCP handles data collection. Your Claude subscription handles the thinking. $0 extra.

34 tools. 463 tests. MIT licensed.

Install:
claude mcp add uimax -- npx -y uimax-mcp

GitHub: https://github.com/prembobby39-gif/uimax-mcp
```

---

## 8. Reddit — r/webdev (Showoff Saturday, March 29)

**Title:** `[Showoff Saturday] UIMax MCP — 34 free tools that turn Claude Code into a frontend expert`

**Body:**

```
Built an MCP server that gives Claude Code real eyes for your frontend.

Say "review my UI at localhost:3000" and it:

1. Captures real screenshots (Puppeteer)
2. Runs Google Lighthouse
3. Audits accessibility (axe-core WCAG 2.1)
4. Measures Core Web Vitals
5. Scans code with AST analysis (TypeScript Compiler API)
6. Claude reviews as a senior frontend engineer
7. Claude implements every fix
8. Auto-saves review history

34 tools total including browser interaction, pixel-level visual diff, console/network capture, performance budgets, multi-page crawl, and more.

Free. MIT licensed. No API keys. One command install.

```
claude mcp add uimax -- npx -y uimax-mcp
```

463 tests. TypeScript. Open source.

GitHub: https://github.com/prembobby39-gif/uimax-mcp

Happy to answer any technical questions about the architecture.
```

---

## Posting Schedule

| Day | Platform | Status |
|-----|----------|--------|
| Thu Mar 27 | Hacker News (Show HN) | Post today |
| Thu Mar 27 | Dev.to article | Post today |
| Thu Mar 27 | r/ClaudeAI | Post today |
| Thu Mar 27 | r/SideProject | Post today |
| Thu Mar 27 | r/ClaudeCode | Post today |
| Thu Mar 27 | MCP directories (PulseMCP, mcp.so) | Submit today |
| Thu Mar 27 | Twitter/X (main + thread) | Post today |
| Sat Mar 29 | r/webdev (Showoff Saturday) | Schedule |
| TBD | Product Hunt | After prep |
