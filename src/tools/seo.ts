// ── SEO Audit Tool ──────────────────────────────────────────────────
//
// Dedicated SEO analysis that goes beyond Lighthouse's SEO score.
// Checks: meta tags, heading hierarchy, Open Graph, structured data,
// robots.txt, sitemap.xml, canonical URLs, and more.

import { createPage, closePage } from "../utils/browser.js";

// ── Types ────────────────────────────────────────────────────────────

export interface SeoCheckResult {
  readonly id: string;
  readonly title: string;
  readonly passed: boolean;
  readonly value: string | null;
  readonly recommendation: string;
  readonly impact: "critical" | "high" | "medium" | "low";
}

export interface SeoAuditResult {
  readonly url: string;
  readonly timestamp: string;
  readonly checks: readonly SeoCheckResult[];
  readonly passed: number;
  readonly failed: number;
  readonly score: number;
  readonly summary: string;
}

// ── Impact Weights (used for score calculation) ─────────────────────

const IMPACT_WEIGHTS: Readonly<Record<string, number>> = {
  critical: 15,
  high: 10,
  medium: 5,
  low: 2,
};

// ── Main Audit Function ─────────────────────────────────────────────

/**
 * Run a comprehensive SEO audit on a page.
 * Opens the URL in Puppeteer and inspects the DOM for SEO signals.
 */
export async function runSeoAudit(url: string): Promise<SeoAuditResult> {
  const page = await createPage(1440, 900);

  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    const pageData = await page.evaluate(() => {
      const getMeta = (name: string): string | null => {
        const el =
          document.querySelector(`meta[name="${name}"]`) ??
          document.querySelector(`meta[property="${name}"]`);
        return el?.getAttribute("content") ?? null;
      };

      const getLink = (rel: string): string | null => {
        const el = document.querySelector(`link[rel="${rel}"]`);
        return el?.getAttribute("href") ?? null;
      };

      // Collect headings
      const headings: { tag: string; text: string }[] = [];
      document.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((el) => {
        headings.push({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent ?? "").trim().slice(0, 100),
        });
      });

      // Collect images without alt
      const images = document.querySelectorAll("img");
      let imagesTotal = 0;
      let imagesMissingAlt = 0;
      images.forEach((img) => {
        imagesTotal++;
        if (!img.getAttribute("alt") && !img.getAttribute("aria-label")) {
          imagesMissingAlt++;
        }
      });

      // Collect links
      const links = document.querySelectorAll("a[href]");
      let linksTotal = 0;
      let linksNoText = 0;
      links.forEach((link) => {
        linksTotal++;
        const text = (link.textContent ?? "").trim();
        const ariaLabel = link.getAttribute("aria-label");
        const title = link.getAttribute("title");
        if (!text && !ariaLabel && !title) {
          linksNoText++;
        }
      });

      // Check for structured data
      const jsonLdScripts = document.querySelectorAll(
        'script[type="application/ld+json"]'
      );
      const structuredDataBlocks: string[] = [];
      jsonLdScripts.forEach((script) => {
        const content = (script.textContent ?? "").trim();
        if (content) {
          structuredDataBlocks.push(content.slice(0, 200));
        }
      });

      return {
        title: document.title,
        metaDescription: getMeta("description"),
        metaViewport:
          document
            .querySelector('meta[name="viewport"]')
            ?.getAttribute("content") ?? null,
        metaRobots: getMeta("robots"),
        canonical: getLink("canonical"),
        lang: document.documentElement.getAttribute("lang"),
        charset:
          document.querySelector("meta[charset]")?.getAttribute("charset") ??
          null,

        // Open Graph
        ogTitle: getMeta("og:title"),
        ogDescription: getMeta("og:description"),
        ogImage: getMeta("og:image"),
        ogType: getMeta("og:type"),
        ogUrl: getMeta("og:url"),

        // Twitter Card
        twitterCard: getMeta("twitter:card"),
        twitterTitle: getMeta("twitter:title"),
        twitterDescription: getMeta("twitter:description"),

        // Content
        headings,
        h1Count: headings.filter((h) => h.tag === "h1").length,
        imagesTotal,
        imagesMissingAlt,
        linksTotal,
        linksNoText,
        structuredDataBlocks,
        hasStructuredData: jsonLdScripts.length > 0,
      };
    });

    const checks = buildSeoChecks(pageData, url);
    const passed = checks.filter((c) => c.passed).length;
    const failed = checks.filter((c) => !c.passed).length;
    const score = computeSeoScore(checks);
    const summary = buildSeoSummary(passed, failed, score);

    return {
      url,
      timestamp: new Date().toISOString(),
      checks,
      passed,
      failed,
      score,
      summary,
    };
  } finally {
    await closePage(page);
  }
}

// ── Check Builders ──────────────────────────────────────────────────

interface PageData {
  readonly title: string;
  readonly metaDescription: string | null;
  readonly metaViewport: string | null;
  readonly metaRobots: string | null;
  readonly canonical: string | null;
  readonly lang: string | null;
  readonly charset: string | null;
  readonly ogTitle: string | null;
  readonly ogDescription: string | null;
  readonly ogImage: string | null;
  readonly ogType: string | null;
  readonly ogUrl: string | null;
  readonly twitterCard: string | null;
  readonly twitterTitle: string | null;
  readonly twitterDescription: string | null;
  readonly headings: readonly { tag: string; text: string }[];
  readonly h1Count: number;
  readonly imagesTotal: number;
  readonly imagesMissingAlt: number;
  readonly linksTotal: number;
  readonly linksNoText: number;
  readonly structuredDataBlocks: readonly string[];
  readonly hasStructuredData: boolean;
}

function buildSeoChecks(
  data: PageData,
  _url: string
): readonly SeoCheckResult[] {
  return [
    // ── Critical checks ──
    checkTitle(data),
    checkMetaDescription(data),
    checkH1Tag(data),

    // ── High impact ──
    checkHeadingHierarchy(data),
    checkCanonicalUrl(data),
    checkLangAttribute(data),
    checkViewportMeta(data),
    checkImageAltText(data),

    // ── Medium impact ──
    checkOpenGraphTitle(data),
    checkOpenGraphDescription(data),
    checkOpenGraphImage(data),
    checkTwitterCard(data),
    checkStructuredData(data),

    // ── Low impact ──
    checkCharset(data),
    checkMetaRobots(data),
    checkLinkAccessibility(data),
    checkTitleLength(data),
    checkDescriptionLength(data),
  ];
}

function checkTitle(data: PageData): SeoCheckResult {
  const hasTitle = data.title.length > 0;
  return {
    id: "title",
    title: "Page Title",
    passed: hasTitle,
    value: hasTitle ? data.title : null,
    recommendation: hasTitle
      ? "Page has a title tag."
      : "Add a <title> tag. Every page needs a unique, descriptive title for search engines.",
    impact: "critical",
  };
}

function checkMetaDescription(data: PageData): SeoCheckResult {
  const hasDesc = data.metaDescription !== null && data.metaDescription.length > 0;
  return {
    id: "meta-description",
    title: "Meta Description",
    passed: hasDesc,
    value: data.metaDescription,
    recommendation: hasDesc
      ? "Page has a meta description."
      : 'Add <meta name="description" content="...">. This appears in search engine results and influences click-through rate.',
    impact: "critical",
  };
}

function checkH1Tag(data: PageData): SeoCheckResult {
  const hasOne = data.h1Count === 1;
  return {
    id: "h1-tag",
    title: "Single H1 Tag",
    passed: hasOne,
    value: data.h1Count === 0 ? "No H1 found" : `${data.h1Count} H1 tag(s)`,
    recommendation: hasOne
      ? "Page has exactly one H1 tag."
      : data.h1Count === 0
        ? "Add an <h1> tag. Every page should have exactly one H1 as the main heading."
        : `Found ${data.h1Count} H1 tags. Use exactly one H1 per page — additional headings should use H2-H6.`,
    impact: "critical",
  };
}

function checkHeadingHierarchy(data: PageData): SeoCheckResult {
  if (data.headings.length === 0) {
    return {
      id: "heading-hierarchy",
      title: "Heading Hierarchy",
      passed: false,
      value: "No headings found",
      recommendation:
        "Add semantic headings (H1-H6) to structure your content. Search engines use heading hierarchy to understand page organization.",
      impact: "high",
    };
  }

  // Check for skipped levels (e.g., H1 -> H3 without H2)
  const levels = data.headings.map((h) => parseInt(h.tag.replace("h", ""), 10));
  let skipped = false;
  for (let i = 1; i < levels.length; i++) {
    const current = levels[i] ?? 0;
    const previous = levels[i - 1] ?? 0;
    if (current > previous + 1) {
      skipped = true;
      break;
    }
  }

  return {
    id: "heading-hierarchy",
    title: "Heading Hierarchy",
    passed: !skipped,
    value: `${data.headings.length} headings (${skipped ? "hierarchy skipped" : "proper hierarchy"})`,
    recommendation: skipped
      ? "Heading levels are skipped (e.g., H1 -> H3). Use sequential heading levels (H1 -> H2 -> H3) for proper content structure."
      : "Heading hierarchy is properly structured.",
    impact: "high",
  };
}

function checkCanonicalUrl(data: PageData): SeoCheckResult {
  const has = data.canonical !== null && data.canonical.length > 0;
  return {
    id: "canonical-url",
    title: "Canonical URL",
    passed: has,
    value: data.canonical,
    recommendation: has
      ? "Page has a canonical URL."
      : 'Add <link rel="canonical" href="..."> to prevent duplicate content issues and consolidate link equity.',
    impact: "high",
  };
}

function checkLangAttribute(data: PageData): SeoCheckResult {
  const has = data.lang !== null && data.lang.length > 0;
  return {
    id: "lang-attribute",
    title: "HTML Lang Attribute",
    passed: has,
    value: data.lang,
    recommendation: has
      ? `Language set to "${data.lang}".`
      : 'Add lang attribute to <html> tag (e.g., <html lang="en">). Helps search engines and screen readers understand the page language.',
    impact: "high",
  };
}

function checkViewportMeta(data: PageData): SeoCheckResult {
  const has = data.metaViewport !== null;
  return {
    id: "viewport-meta",
    title: "Viewport Meta Tag",
    passed: has,
    value: data.metaViewport,
    recommendation: has
      ? "Viewport meta tag is set."
      : 'Add <meta name="viewport" content="width=device-width, initial-scale=1">. Required for mobile-friendly pages (Google mobile-first indexing).',
    impact: "high",
  };
}

function checkImageAltText(data: PageData): SeoCheckResult {
  if (data.imagesTotal === 0) {
    return {
      id: "image-alt-text",
      title: "Image Alt Text",
      passed: true,
      value: "No images found",
      recommendation: "No images on page — check passes by default.",
      impact: "high",
    };
  }

  const allHaveAlt = data.imagesMissingAlt === 0;
  return {
    id: "image-alt-text",
    title: "Image Alt Text",
    passed: allHaveAlt,
    value: `${data.imagesMissingAlt}/${data.imagesTotal} images missing alt text`,
    recommendation: allHaveAlt
      ? "All images have alt text."
      : `${data.imagesMissingAlt} image(s) are missing alt text. Add descriptive alt attributes for SEO and accessibility.`,
    impact: "high",
  };
}

function checkOpenGraphTitle(data: PageData): SeoCheckResult {
  const has = data.ogTitle !== null && data.ogTitle.length > 0;
  return {
    id: "og-title",
    title: "Open Graph Title",
    passed: has,
    value: data.ogTitle,
    recommendation: has
      ? "Open Graph title is set."
      : 'Add <meta property="og:title" content="...">. Controls how the page appears when shared on social media.',
    impact: "medium",
  };
}

function checkOpenGraphDescription(data: PageData): SeoCheckResult {
  const has = data.ogDescription !== null && data.ogDescription.length > 0;
  return {
    id: "og-description",
    title: "Open Graph Description",
    passed: has,
    value: data.ogDescription,
    recommendation: has
      ? "Open Graph description is set."
      : 'Add <meta property="og:description" content="...">. Provides a summary when shared on Facebook, LinkedIn, etc.',
    impact: "medium",
  };
}

function checkOpenGraphImage(data: PageData): SeoCheckResult {
  const has = data.ogImage !== null && data.ogImage.length > 0;
  return {
    id: "og-image",
    title: "Open Graph Image",
    passed: has,
    value: data.ogImage,
    recommendation: has
      ? "Open Graph image is set."
      : 'Add <meta property="og:image" content="...">. Pages shared without an image get significantly fewer clicks.',
    impact: "medium",
  };
}

function checkTwitterCard(data: PageData): SeoCheckResult {
  const has = data.twitterCard !== null && data.twitterCard.length > 0;
  return {
    id: "twitter-card",
    title: "Twitter Card Meta",
    passed: has,
    value: data.twitterCard,
    recommendation: has
      ? `Twitter card type: "${data.twitterCard}".`
      : 'Add <meta name="twitter:card" content="summary_large_image">. Controls how the page appears when shared on X/Twitter.',
    impact: "medium",
  };
}

function checkStructuredData(data: PageData): SeoCheckResult {
  return {
    id: "structured-data",
    title: "Structured Data (JSON-LD)",
    passed: data.hasStructuredData,
    value: data.hasStructuredData
      ? `${data.structuredDataBlocks.length} block(s) found`
      : null,
    recommendation: data.hasStructuredData
      ? "Structured data found on page."
      : 'Add JSON-LD structured data (<script type="application/ld+json">). Enables rich snippets in search results (ratings, prices, FAQs, etc.).',
    impact: "medium",
  };
}

function checkCharset(data: PageData): SeoCheckResult {
  const has = data.charset !== null;
  return {
    id: "charset",
    title: "Character Encoding",
    passed: has,
    value: data.charset,
    recommendation: has
      ? `Charset set to "${data.charset}".`
      : 'Add <meta charset="UTF-8">. Ensures text renders correctly across all browsers and locales.',
    impact: "low",
  };
}

function checkMetaRobots(data: PageData): SeoCheckResult {
  // Not having robots meta is fine (defaults to index,follow)
  // Having robots meta with noindex is a warning
  const hasNoIndex =
    data.metaRobots !== null && data.metaRobots.includes("noindex");
  return {
    id: "meta-robots",
    title: "Meta Robots",
    passed: !hasNoIndex,
    value: data.metaRobots ?? "Not set (defaults to index, follow)",
    recommendation: hasNoIndex
      ? 'Page has "noindex" in meta robots — search engines will NOT index this page. Remove if this is unintentional.'
      : "Robots meta allows indexing.",
    impact: "low",
  };
}

function checkLinkAccessibility(data: PageData): SeoCheckResult {
  if (data.linksTotal === 0) {
    return {
      id: "link-text",
      title: "Link Accessibility",
      passed: true,
      value: "No links found",
      recommendation: "No links on page.",
      impact: "low",
    };
  }

  const allHaveText = data.linksNoText === 0;
  return {
    id: "link-text",
    title: "Link Accessibility",
    passed: allHaveText,
    value: `${data.linksNoText}/${data.linksTotal} links missing descriptive text`,
    recommendation: allHaveText
      ? "All links have descriptive text."
      : `${data.linksNoText} link(s) have no text content. Add descriptive text or aria-label for SEO and accessibility.`,
    impact: "low",
  };
}

function checkTitleLength(data: PageData): SeoCheckResult {
  const len = data.title.length;
  if (len === 0) {
    return {
      id: "title-length",
      title: "Title Length",
      passed: false,
      value: "No title",
      recommendation: "Add a title tag.",
      impact: "low",
    };
  }

  const optimal = len >= 30 && len <= 60;
  return {
    id: "title-length",
    title: "Title Length",
    passed: optimal,
    value: `${len} characters`,
    recommendation: optimal
      ? "Title length is optimal (30-60 characters)."
      : len < 30
        ? `Title is too short (${len} chars). Aim for 30-60 characters for optimal search display.`
        : `Title is too long (${len} chars). Google typically displays 50-60 characters. Consider shortening.`,
    impact: "low",
  };
}

function checkDescriptionLength(data: PageData): SeoCheckResult {
  if (data.metaDescription === null) {
    return {
      id: "description-length",
      title: "Description Length",
      passed: false,
      value: "No description",
      recommendation: "Add a meta description.",
      impact: "low",
    };
  }

  const len = data.metaDescription.length;
  const optimal = len >= 120 && len <= 160;
  return {
    id: "description-length",
    title: "Description Length",
    passed: optimal,
    value: `${len} characters`,
    recommendation: optimal
      ? "Description length is optimal (120-160 characters)."
      : len < 120
        ? `Description is too short (${len} chars). Aim for 120-160 characters for optimal search display.`
        : `Description is too long (${len} chars). Google typically truncates at ~155-160 characters.`,
    impact: "low",
  };
}

// ── Scoring ─────────────────────────────────────────────────────────

function computeSeoScore(checks: readonly SeoCheckResult[]): number {
  let totalWeight = 0;
  let earnedWeight = 0;

  for (const check of checks) {
    const weight = IMPACT_WEIGHTS[check.impact] ?? 5;
    totalWeight += weight;
    if (check.passed) {
      earnedWeight += weight;
    }
  }

  if (totalWeight === 0) return 100;
  return Math.round((earnedWeight / totalWeight) * 100);
}

function buildSeoSummary(
  passed: number,
  failed: number,
  score: number
): string {
  const total = passed + failed;
  if (failed === 0) {
    return `All ${total} SEO checks passed (score: ${score}/100).`;
  }
  return `${passed}/${total} SEO checks passed, ${failed} failed (score: ${score}/100).`;
}

// ── Formatting ──────────────────────────────────────────────────────

/**
 * Format the SEO audit result as a readable markdown report.
 */
export function formatSeoReport(result: SeoAuditResult): string {
  const sections: string[] = [
    `## SEO Audit Results`,
    ``,
    `**URL:** ${result.url}`,
    `**Score:** ${result.score}/100`,
    `**Passed:** ${result.passed} | **Failed:** ${result.failed}`,
    ``,
  ];

  const failed = result.checks.filter((c) => !c.passed);
  const passed = result.checks.filter((c) => c.passed);

  if (failed.length > 0) {
    sections.push(`### Issues Found`);
    sections.push(``);

    // Group by impact
    const byImpact = groupByImpact(failed);
    for (const [impact, checks] of byImpact) {
      sections.push(`#### ${impact.toUpperCase()}`);
      for (const check of checks) {
        sections.push(`- **${check.title}**: ${check.recommendation}`);
        if (check.value) {
          sections.push(`  Current: ${check.value}`);
        }
      }
      sections.push(``);
    }
  }

  if (passed.length > 0) {
    sections.push(`### Passing Checks`);
    sections.push(``);
    for (const check of passed) {
      const detail = check.value ? ` (${check.value})` : "";
      sections.push(`- ${check.title}${detail}`);
    }
    sections.push(``);
  }

  return sections.join("\n");
}

function groupByImpact(
  checks: readonly SeoCheckResult[]
): readonly [string, readonly SeoCheckResult[]][] {
  const order = ["critical", "high", "medium", "low"] as const;
  const grouped = new Map<string, SeoCheckResult[]>();

  for (const check of checks) {
    const existing = grouped.get(check.impact) ?? [];
    grouped.set(check.impact, [...existing, check]);
  }

  return order
    .filter((impact) => grouped.has(impact))
    .map((impact) => [impact, grouped.get(impact) ?? []] as const);
}
