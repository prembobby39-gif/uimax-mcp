# UImax Distribution Plan

**Goal:** 1,000 weekly active users within 90 days (by June 2026)
**Current:** ~725 total downloads, Day 2 post-launch (March 27, 2026)

---

## Channel Strategy

### Tier 1 — High-Impact, Low-Effort (Week 1-2)

#### 1. MCP Directories & Registries
These are where Claude Code users discover new tools. Be listed everywhere.

- **mcp.so** — submit for listing (largest MCP directory)
- **Smithery** — already have server.json, ensure listing is live
- **glama.ai** — submit (automated MCP testing and listing)
- **modelcontextprotocol.io** — official MCP repo, submit PR to add to community servers
- **awesome-mcp-servers** GitHub repo — submit PR

**Action items:**
1. Submit to mcp.so with full description + screenshots of HTML report
2. Verify Smithery listing is active and metadata is correct
3. Submit to awesome-mcp-servers GitHub repo

#### 2. Claude Code Community
The most targeted audience — people who already use Claude Code daily.

- **Anthropic Discord** (#claude-code channel) — share with demo video
- **r/ClaudeAI** — post showing before/after of a UI review
- **r/ChatGPTCoding** — crosspost (many users try both tools)
- **Claude Code GitHub Discussions** — post in Show & Tell

**Content format:** Short video (60-90s) showing:
1. `claude mcp add uimax -- npx -y uimax-mcp`
2. "review my UI at localhost:3000"
3. Grade card output (A-F per section) — the visual hook
4. Auto-fix in action

#### 3. Twitter/X Developer Community
Frontend developers and indie hackers are very active here.

**Post cadence:** 3 posts/week for first 2 weeks, then 2/week

**Post types:**
- Launch thread: "I built an MCP that turns Claude Code into a frontend expert..."
- Demo GIF: Show the grade card + auto-fix flow
- Comparison post: "What 5-7 separate tools do vs. what UImax does in one command"
- Build in public: Share the competitive analysis findings (sanitized)

**Accounts to tag/engage:** @anthropaboris, @alexalbert__, Claude Code power users, MCP builders

### Tier 2 — Medium-Impact, Medium-Effort (Week 2-4)

#### 4. Dev.to / Hashnode Articles
Write 2-3 articles:

1. **"How I Built an MCP That Replaces 7 Frontend Tools"** — the builder story
2. **"The Only Free Lighthouse + axe-core + Code Analysis Pipeline for Claude Code"** — SEO-optimized tutorial
3. **"Your UI is Getting a D- and You Don't Know It"** — hook with letter grades, show how to check

#### 5. YouTube / Loom Demos
- Record a 5-minute walkthrough reviewing a real app (use a popular open source project)
- Share in all channels above + embed in README
- Target keywords: "claude code ui review", "mcp server frontend", "automated ui audit"

#### 6. Product Hunt
- **Timing:** Launch when you hit 35+ tools (after v0.8.0 ships the priority features)
- **Preparation:** Get 10+ upvotes from existing users on Day 1
- **Tagline:** "Turn Claude Code into a senior frontend engineer. Free."
- Review the existing `docs/product-hunt-launch.md` for details

### Tier 3 — Long-Term Growth (Month 2-3)

#### 7. GitHub Presence
- Star-for-star exchanges with other MCP projects
- Contribute to Claude Code discussions with helpful UImax use cases
- Create issue templates that showcase different review workflows
- Add "Made with UImax" badge for users to put in their READMEs

#### 8. Integration Partnerships
- Reach out to other MCP builders for cross-promotion
- Build integrations with popular tools (Figma MCP, Stitch MCP, etc.)
- Create recipes: "UImax + Figma = design-to-code validation pipeline"

#### 9. Agency/Freelancer Channel
- Post in freelancer communities (Indie Hackers, r/webdev, r/freelance)
- Frame UImax as "generate client-ready audit reports in 60 seconds"
- The branded PDF + letter grades are the hook for this audience
- Create a landing page with sample reports

---

## Content Calendar (First 30 Days)

| Week | Channel | Content | Owner |
|------|---------|---------|-------|
| 1 | MCP directories | Submit to mcp.so, Smithery, awesome-mcp | Prem |
| 1 | Twitter/X | Launch thread + demo GIF | Prem |
| 1 | Discord/Reddit | Claude Code community posts | Rishi |
| 2 | Dev.to | "Replaces 7 Tools" article | Prem |
| 2 | YouTube | 5-min demo video | Rishi |
| 2 | Twitter/X | Comparison post (coverage matrix from competitive analysis) | Prem |
| 3 | Hashnode | Tutorial article | Prem |
| 3 | Twitter/X | Build in public updates | Both |
| 4 | Product Hunt | Launch (if v0.8.0 ready) | Both |

---

## Key Metrics to Track

| Metric | Tool | Target (30 days) | Target (90 days) |
|--------|------|-------------------|-------------------|
| npm weekly downloads | npm stats API | 500/week | 2,000/week |
| GitHub stars | GitHub API | 50 | 200 |
| MCP directory position | Manual check | Top 20 | Top 10 |
| Twitter impressions | X Analytics | 50K total | 200K total |
| Dev.to views | Dev.to dashboard | 5K total | 20K total |

---

## Messaging Framework

### One-liner
"Turn Claude Code into a frontend expert that reviews and fixes your UI. Free."

### Elevator pitch (30 seconds)
"UImax is an MCP server that gives Claude Code the ability to see your running app, audit it for accessibility/performance/SEO/code quality, grade each section A through F, and then fix the issues — all in one command. It replaces 5-7 separate tools with a single pipeline. And it's free for anyone on the Claude Pro plan."

### Key differentiators (for all content)
1. **All-in-one:** No other tool covers all 10 audit categories
2. **Free:** Runs on your existing Claude Pro plan, no API keys
3. **Auto-fix:** Doesn't just report — it fixes the code
4. **Letter grades:** Instantly see where you're failing (A-F per section)
5. **Branded reports:** Shareable HTML reports with zero dependencies

### Hook phrases for social media
- "Your UI just got graded. It's a D+."
- "One command. Full UI audit. Auto-fix included."
- "I replaced Lighthouse + axe-core + 5 other tools with one MCP."
- "Free frontend expert for Claude Code users."

---

## Anti-Patterns to Avoid

- **Don't spam** — quality posts in the right channels beat volume
- **Don't oversell** — be honest about limitations (e.g., Lighthouse can timeout)
- **Don't ignore feedback** — early users shape the product, respond to every issue
- **Don't chase vanity metrics** — 50 active users who give feedback > 500 who install and forget
- **Don't compete on features alone** — the UX of "one command, full review" is the moat

---

## Budget

**$0** — all channels are free. The only cost is time.

If/when paid promotion makes sense:
- Twitter/X promoted posts: $50-100/week for targeted dev audience
- Sponsoring a developer newsletter: $200-500 one-time (e.g., TLDR, Bytes)
- Only after organic traction proves the messaging works
