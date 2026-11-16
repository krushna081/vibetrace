import type { CategoryScore, Metric, SectionReport } from "@vibetrace/shared-types";
import { buildCategoryScore, SCORE_METHODOLOGIES } from "@vibetrace/scoring-engine";
import type { AnalyzerContext } from "../types.js";
import { check, metric, percent, serviceSummary, unavailable } from "./helpers.js";

function validJsonLd(values: string[]): number {
  let valid = 0;
  for (const value of values) {
    try {
      JSON.parse(value);
      valid += 1;
    } catch {
      // Invalid structured data is reported as a warning, not counted.
    }
  }
  return valid;
}

export function analyzeSeo(context: AnalyzerContext): {
  section: SectionReport;
  score: CategoryScore;
} {
  const checks = [];
  const { facts } = context;
  const snapshot = context.snapshot;
  const headingLevels = snapshot?.dom.headingLevels.length
    ? snapshot.dom.headingLevels
    : facts.headings.map((heading) => heading.level);
  const h1Count = headingLevels.filter((level) => level === 1).length;
  const imageCount = snapshot?.dom.imageCount ?? facts.images.length;
  const imagesWithAlt =
    snapshot?.dom.imagesWithAlt ?? facts.images.filter((image) => image.altPresent).length;
  const altCoverage = percent(imagesWithAlt, imageCount);
  const title = facts.title;
  const description = facts.description ?? "";
  const jsonLdCount = validJsonLd(facts.jsonLd);

  checks.push(
    check({
      id: "title",
      title: "Page title",
      category: "seo",
      status: !title ? "fail" : title.length >= 10 && title.length <= 65 ? "pass" : "warn",
      weight: 12,
      detail: !title
        ? "No document title was found."
        : `Title length is ${title.length} characters (guideline 10–65): "${title.slice(0, 180)}".`,
      recommendation: !title
        ? "Add a unique, descriptive <title> to the page."
        : title.length < 10 || title.length > 65
          ? "Rewrite the title to be descriptive and roughly 10–65 characters."
          : undefined,
    }),
  );

  checks.push(
    check({
      id: "meta-description",
      title: "Meta description",
      category: "seo",
      status: !description
        ? "fail"
        : description.length >= 50 && description.length <= 160
          ? "pass"
          : "warn",
      weight: 8,
      detail: !description
        ? "No meta description was found."
        : `Meta description length is ${description.length} characters (guideline 50–160).`,
      recommendation: !description
        ? "Add a unique meta description summarizing the page."
        : description.length < 50 || description.length > 160
          ? "Adjust the meta description to roughly 50–160 characters."
          : undefined,
    }),
  );

  const canonical = facts.canonical;
  let canonicalMatches = false;
  if (canonical) {
    try {
      const canonicalUrl = new URL(canonical, context.finalUrl);
      const finalUrl = new URL(context.finalUrl);
      canonicalMatches =
        canonicalUrl.origin === finalUrl.origin &&
        canonicalUrl.pathname.replace(/\/$/, "") === finalUrl.pathname.replace(/\/$/, "");
    } catch {
      canonicalMatches = false;
    }
  }
  checks.push(
    check({
      id: "canonical",
      title: "Canonical URL",
      category: "seo",
      status: !canonical ? "warn" : canonicalMatches ? "pass" : "warn",
      weight: 6,
      detail: !canonical
        ? "No canonical link element was observed."
        : canonicalMatches
          ? `Canonical URL points to the analyzed page: ${canonical.slice(0, 300)}`
          : `Canonical URL differs from the analyzed URL: ${canonical.slice(0, 300)}. This can be intentional, but should be verified.`,
      recommendation: !canonical
        ? "Add a canonical link to indicate the preferred URL."
        : !canonicalMatches
          ? "Verify that the cross-URL canonical is intentional and consistent with internal links."
          : undefined,
    }),
  );

  checks.push(
    check({
      id: "h1",
      title: "Primary heading",
      category: "seo",
      status: h1Count === 1 ? "pass" : "warn",
      weight: 8,
      detail:
        h1Count === 1
          ? "Exactly one H1 was found."
          : `${h1Count} H1 heading(s) were found. A single descriptive H1 is the usual convention.`,
      recommendation:
        h1Count === 1 ? undefined : "Use one primary H1 that describes the page content.",
    }),
  );

  let skips = 0;
  for (let index = 1; index < headingLevels.length; index += 1) {
    const previous = headingLevels[index - 1]!;
    const current = headingLevels[index]!;
    if (current - previous > 1) skips += 1;
  }
  checks.push(
    check({
      id: "heading-hierarchy",
      title: "Heading hierarchy",
      category: "seo",
      status: headingLevels.length === 0 ? "warn" : skips === 0 ? "pass" : "warn",
      weight: 4,
      detail:
        headingLevels.length === 0
          ? "No headings were found."
          : `${headingLevels.length} heading(s) analyzed; ${skips} level-skip(s) detected.`,
      recommendation:
        headingLevels.length === 0 || skips > 0
          ? "Structure content with headings in sequential order without skipping levels."
          : undefined,
    }),
  );

  checks.push(
    check({
      id: "viewport",
      title: "Responsive viewport",
      category: "seo",
      status: facts.responsiveMeta ? "pass" : "fail",
      weight: 5,
      detail: facts.responsiveMeta
        ? "A responsive viewport meta tag is present."
        : "No width=device-width viewport meta tag was found.",
      recommendation: facts.responsiveMeta
        ? undefined
        : 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.',
    }),
  );

  checks.push(
    check({
      id: "language",
      title: "Document language",
      category: "seo",
      status: facts.lang ? "pass" : "warn",
      weight: 3,
      detail: facts.lang
        ? `The document language is "${facts.lang}".`
        : "No html lang attribute was found.",
      recommendation: facts.lang ? undefined : "Add a valid lang attribute to the html element.",
    }),
  );

  const ogPresent = ["og:title", "og:description", "og:image"].filter((key) =>
    Boolean(facts.og[key]),
  );
  checks.push(
    check({
      id: "open-graph",
      title: "Open Graph metadata",
      category: "seo",
      status: ogPresent.length === 3 ? "pass" : ogPresent.length === 0 ? "warn" : "warn",
      weight: 6,
      detail:
        ogPresent.length === 0
          ? "No Open Graph title, description or image tags were observed."
          : `${ogPresent.length} of 3 core Open Graph fields are present (${ogPresent.join(", ")}).`,
      recommendation:
        ogPresent.length < 3
          ? "Add og:title, og:description and an absolute og:image for predictable social previews."
          : undefined,
    }),
  );

  const robots = (facts.robots ?? "").toLowerCase();
  const noindex = /noindex|none/.test(robots);
  checks.push(
    check({
      id: "robots-meta",
      title: "Indexing directives",
      category: "seo",
      status: noindex ? "warn" : "pass",
      weight: 5,
      detail: noindex
        ? `A restrictive robots directive is present: "${facts.robots}". This may be intentional (staging, private page).`
        : "No noindex meta directive was observed.",
      recommendation: noindex
        ? "Confirm that the page should be excluded from search indexing."
        : undefined,
    }),
  );

  checks.push(
    check({
      id: "structured-data",
      title: "Structured data",
      category: "seo",
      status: facts.jsonLd.length === 0 ? "warn" : jsonLdCount > 0 ? "pass" : "warn",
      weight: 5,
      detail:
        facts.jsonLd.length === 0
          ? "No JSON-LD structured data blocks were observed."
          : `${jsonLdCount} valid JSON-LD block(s) of ${facts.jsonLd.length} parsed successfully.`,
      recommendation:
        facts.jsonLd.length === 0
          ? "Add relevant JSON-LD structured data where it accurately describes the page (Organization, WebSite, Article, Product, etc.)."
          : jsonLdCount < facts.jsonLd.length
            ? "Fix invalid JSON-LD syntax so search engines can parse it."
            : undefined,
    }),
  );

  checks.push(
    check({
      id: "image-alt",
      title: "Image alternative text",
      category: "seo",
      status:
        imageCount === 0
          ? "info"
          : altCoverage === 100
            ? "pass"
            : altCoverage >= 70
              ? "warn"
              : "fail",
      weight: 6,
      detail:
        imageCount === 0
          ? "No content images were found."
          : `${imagesWithAlt} of ${imageCount} images have an alt attribute (${altCoverage}%). Empty alt is counted as present because it is valid for decorative images.`,
      recommendation:
        imageCount > 0 && altCoverage < 100
          ? 'Add meaningful alt text to informative images and alt="" to decorative images.'
          : undefined,
    }),
  );

  const sitemapCheck =
    context.mode === "snapshot" || !context.probes.seo
      ? unavailable(
          "crawl-hints",
          "robots.txt and sitemap availability",
          "seo",
          5,
          "Extension snapshots do not fetch robots.txt or sitemaps.",
          "Run a server-side URL scan to check robots.txt and sitemap availability.",
        )
      : (() => {
          const seo = context.probes.seo!;
          const sitemapOk = seo.sitemapAccessible;
          const robotsOk = seo.robotsAccessible;
          return check({
            id: "crawl-hints",
            title: "robots.txt and sitemap availability",
            category: "seo",
            status: sitemapOk ? "pass" : robotsOk ? "warn" : "warn",
            weight: 5,
            detail: `${seo.robotsUrl}: HTTP ${seo.robotsStatus ?? "unavailable"}. ${seo.sitemapUrl}: HTTP ${seo.sitemapStatus ?? "unavailable"}.${seo.disallowAll ? " robots.txt contains a blanket Disallow: / rule." : ""}`,
            recommendation:
              !sitemapOk || seo.disallowAll
                ? "Publish a reachable sitemap and ensure robots.txt does not unintentionally block the whole site."
                : undefined,
          });
        })();
  checks.push(sitemapCheck);

  checks.push(
    unavailable(
      "broken-links",
      "Broken internal links",
      "seo",
      4,
      "VibeTrace analyzes the submitted page only. It does not crawl or issue requests to every internal link.",
      "Use a dedicated link crawler for a full broken-link audit.",
    ),
  );

  const score = buildCategoryScore({
    checks,
    explanation:
      "SEO is scored from metadata, headings, social preview fields, indexability hints, structured data and single-request crawl-file probes.",
    methodology: [SCORE_METHODOLOGIES.seo, ...SCORE_METHODOLOGIES.category.split("\n")],
    missing: [
      "Broken-link crawl",
      ...(context.mode === "snapshot" ? ["robots.txt and sitemap probes"] : []),
    ],
  });

  const metrics: Metric[] = [
    metric("title", "Title", title || null, {
      measured: true,
      note: title ? `${title.length} characters` : "Missing",
    }),
    metric("description", "Meta description", description || null, {
      measured: true,
      note: description ? `${description.length} characters` : "Missing",
    }),
    metric("canonical", "Canonical URL", canonical, { measured: true }),
    metric("h1-count", "H1 headings", h1Count),
    metric("heading-count", "Total headings", headingLevels.length),
    metric("image-alt-coverage", "Image alt coverage", imageCount > 0 ? `${altCoverage}%` : "n/a", {
      measured: imageCount > 0,
    }),
    metric("json-ld", "Valid JSON-LD blocks", jsonLdCount),
    metric("robots-meta", "robots meta", facts.robots ?? "none"),
    metric("robots-txt", "robots.txt", context.probes.seo?.robotsStatus ?? null, {
      measured: Boolean(context.probes.seo),
    }),
    metric("sitemap", "sitemap", context.probes.seo?.sitemapStatus ?? null, {
      measured: Boolean(context.probes.seo),
    }),
  ];

  const section: SectionReport = {
    id: "seo",
    title: "SEO",
    summary: serviceSummary(score.score, "SEO"),
    score,
    metrics,
    limitations: [
      "Only the submitted document was analyzed; no ranking, traffic or backlink claims are made.",
      "robots.txt and sitemap.xml checks are availability probes, not a full crawl validation.",
      "Meta length guidelines are conventions used by search-result previews, not guarantees.",
      "Structured-data validity is syntax and presence checking, not rich-result eligibility verification.",
      "No search engine index state is queried.",
    ],
  };
  return { section, score };
}
