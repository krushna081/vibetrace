import type { CategoryScore, Metric, SectionReport } from "@vibetrace/shared-types";
import { buildCategoryScore, SCORE_METHODOLOGIES } from "@vibetrace/scoring-engine";
import type { AnalyzerContext } from "../types.js";
import {
  formatBytes,
  formatMs,
  check,
  metric,
  percent,
  serviceSummary,
  unavailable,
} from "./helpers.js";

function modernImage(url: string): boolean {
  return /\.(?:avif|webp|svg)(?:[?#]|$)/i.test(url) || /(?:format=webp|format=avif)/i.test(url);
}

function cacheMaxAge(value: string | null): number {
  if (!value) return 0;
  const match = /max-age\s*=\s*(\d+)/i.exec(value);
  return match ? Number(match[1]) : 0;
}

export function analyzePerformance(context: AnalyzerContext): {
  section: SectionReport;
  score: CategoryScore;
} {
  const checks = [];
  const clientTiming = context.snapshot?.timing;
  const headersAvailable = context.response.headersAvailable;
  const ttfbMs = clientTiming?.ttfbMs ?? context.response.ttfbMs;
  const ttfbMeasured = ttfbMs !== undefined && ttfbMs !== null;

  checks.push(
    check({
      id: "ttfb",
      title: "Time to first byte",
      category: "performance",
      status: !ttfbMeasured
        ? "unavailable"
        : ttfbMs! <= 800
          ? "pass"
          : ttfbMs! <= 1_800
            ? "warn"
            : "fail",
      weight: 15,
      detail: ttfbMeasured
        ? `Measured TTFB was ${formatMs(ttfbMs!)}${clientTiming ? " in the analyzed browser session" : " while fetching the HTML document from the server"}. This includes network distance from the scanner.`
        : "TTFB could not be measured.",
      recommendation:
        ttfbMeasured && ttfbMs! > 800
          ? "Investigate server response time, origin latency, redirects and CDN cache hit behavior for the HTML document."
          : undefined,
    }),
  );

  const documentBytes =
    context.mode === "remote"
      ? context.response.bodyBytes
      : clientTiming?.decodedBodySize && clientTiming.decodedBodySize > 0
        ? clientTiming.decodedBodySize
        : null;
  checks.push(
    check({
      id: "document-size",
      title: "HTML document size",
      category: "performance",
      status:
        documentBytes === null
          ? "unavailable"
          : documentBytes <= 120_000
            ? "pass"
            : documentBytes <= 350_000
              ? "warn"
              : "fail",
      weight: 6,
      detail:
        documentBytes === null
          ? "The original HTML document size is unavailable in this mode."
          : `The analyzed HTML document was ${formatBytes(documentBytes)}${context.mode === "remote" ? " (compressed transfer decoded)" : " (navigation timing)"}.`,
      recommendation:
        documentBytes !== null && documentBytes > 120_000
          ? "Reduce server-rendered HTML size by removing unused markup, inlining less data and deferring large payloads."
          : undefined,
    }),
  );

  const referenceCount =
    context.facts.scriptFacts.length +
    context.facts.stylesheets.length +
    (context.snapshot?.dom.imageCount ?? context.facts.images.length);
  const resourceCount = clientTiming?.resourceCount ?? referenceCount;
  checks.push(
    check({
      id: "request-count",
      title: "Referenced resource count",
      category: "performance",
      status: resourceCount <= 40 ? "pass" : resourceCount <= 100 ? "warn" : "fail",
      weight: 8,
      detail: `${resourceCount} resource reference(s) were counted${clientTiming?.resourceCount !== undefined ? " from browser resource timing" : " from HTML references"}. The count excludes requests started later by scripts.`,
      recommendation:
        resourceCount > 40
          ? "Audit request count: bundle modules, remove unused third-party tags and lazy-load below-the-fold media."
          : undefined,
    }),
  );

  const snapshotScriptBytes = clientTiming?.scriptBytes;
  const probedScripts = context.probes.assets.filter(
    (asset) => asset.kind === "script" && asset.measured && asset.bytes !== null,
  );
  const sampledScriptBytes = probedScripts.reduce((sum, asset) => sum + (asset.bytes ?? 0), 0);
  const scriptBytes =
    snapshotScriptBytes !== undefined && snapshotScriptBytes > 0
      ? snapshotScriptBytes
      : probedScripts.length > 0
        ? sampledScriptBytes
        : null;
  const scriptSizeLabel =
    snapshotScriptBytes !== undefined && snapshotScriptBytes > 0
      ? "browser resource timing"
      : `sample of ${probedScripts.length} script(s)`;
  checks.push(
    check({
      id: "javascript-size",
      title: "JavaScript payload",
      category: "performance",
      status:
        scriptBytes === null
          ? "unavailable"
          : scriptBytes <= 350_000
            ? "pass"
            : scriptBytes <= 1_200_000
              ? "warn"
              : "fail",
      weight: 12,
      detail:
        scriptBytes === null
          ? "JavaScript bytes could not be measured. The extension or asset probes may not have access to resource sizes."
          : `Measured ${formatBytes(scriptBytes)} of JavaScript from ${scriptSizeLabel}.${snapshotScriptBytes === undefined ? " This is a sample, not necessarily the full payload." : ""}`,
      recommendation:
        scriptBytes !== null && scriptBytes > 350_000
          ? "Split and defer large bundles, remove duplicate dependencies and use route-level code splitting."
          : undefined,
    }),
  );

  const probedStyles = context.probes.assets.filter(
    (asset) => asset.kind === "stylesheet" && asset.measured && asset.bytes !== null,
  );
  const sampledCssBytes = probedStyles.reduce((sum, asset) => sum + (asset.bytes ?? 0), 0);
  const styleBytes =
    clientTiming?.styleBytes !== undefined && clientTiming.styleBytes > 0
      ? clientTiming.styleBytes
      : probedStyles.length > 0
        ? sampledCssBytes
        : null;
  checks.push(
    check({
      id: "css-size",
      title: "CSS payload",
      category: "performance",
      status:
        styleBytes === null
          ? "unavailable"
          : styleBytes <= 120_000
            ? "pass"
            : styleBytes <= 300_000
              ? "warn"
              : "fail",
      weight: 8,
      detail:
        styleBytes === null
          ? "CSS bytes could not be measured in this mode."
          : `Measured ${formatBytes(styleBytes)} of CSS${probedStyles.length > 0 && (clientTiming?.styleBytes ?? 0) === 0 ? ` from a sample of ${probedStyles.length} stylesheet(s)` : " from browser resource timing"}.`,
      recommendation:
        styleBytes !== null && styleBytes > 120_000
          ? "Remove unused CSS, split critical CSS and avoid shipping full framework stylesheets to every page."
          : undefined,
    }),
  );

  const blocking = context.facts.scriptFacts.filter(
    (script) =>
      script.inHead &&
      Boolean(script.src) &&
      !script.async &&
      !script.defer &&
      script.type !== "module",
  );
  checks.push(
    context.mode === "snapshot"
      ? unavailable(
          "render-blocking",
          "Render-blocking scripts",
          "performance",
          10,
          "Sanitized extension snapshots cannot reliably reconstruct head-script async/defer attributes.",
          "Run a server-side URL scan for full render-blocking analysis.",
        )
      : check({
          id: "render-blocking",
          title: "Render-blocking scripts",
          category: "performance",
          status: blocking.length === 0 ? "pass" : blocking.length <= 2 ? "warn" : "fail",
          weight: 10,
          detail:
            blocking.length === 0
              ? "No parser-blocking external scripts were found in the document head."
              : `${blocking.length} external script(s) in the head are not async, deferred or modules and may block parsing.`,
          evidence: blocking.slice(0, 5).map((script) => script.src?.split("?")[0] ?? ""),
          recommendation:
            blocking.length > 0
              ? 'Add async, defer or type="module" to non-critical head scripts.'
              : undefined,
        }),
  );

  const contentEncoding = context.response.headers["content-encoding"] ?? "";
  checks.push(
    check({
      id: "compression",
      title: "Text compression",
      category: "performance",
      status: !headersAvailable
        ? "unavailable"
        : /^(?:gzip|br|zstd|deflate)$/i.test(contentEncoding.trim())
          ? "pass"
          : "warn",
      weight: 6,
      detail: !headersAvailable
        ? "Compression headers are unavailable in snapshot mode."
        : contentEncoding
          ? `The HTML response uses Content-Encoding: ${contentEncoding}.`
          : "No Content-Encoding header was observed on the HTML response.",
      recommendation:
        headersAvailable && !contentEncoding
          ? "Enable Brotli or gzip compression for HTML, CSS and JavaScript at the origin or CDN."
          : undefined,
    }),
  );

  const measuredAssets = context.probes.assets.filter((asset) => asset.measured);
  const cacheableAssets = measuredAssets.filter(
    (asset) => asset.cacheControl && cacheMaxAge(asset.cacheControl) >= 86_400,
  );
  checks.push(
    check({
      id: "asset-caching",
      title: "Static asset caching",
      category: "performance",
      status:
        measuredAssets.length === 0
          ? "unavailable"
          : cacheableAssets.length === measuredAssets.length
            ? "pass"
            : cacheableAssets.length > 0
              ? "warn"
              : "fail",
      weight: 6,
      detail:
        measuredAssets.length === 0
          ? "No same-origin script or stylesheet probes succeeded, so asset cache headers could not be checked."
          : `${cacheableAssets.length} of ${measuredAssets.length} successfully probed assets advertise a cache lifetime of at least one day.`,
      recommendation:
        measuredAssets.length > 0 && cacheableAssets.length === 0
          ? "Serve immutable, content-hashed static assets with long Cache-Control lifetimes."
          : undefined,
    }),
  );

  const images = context.facts.images;
  const imageCount = context.snapshot?.dom.imageCount ?? images.length;
  const modernImages = images.filter((image) => modernImage(image.src)).length;
  const imageDataAvailable = images.length > 0 || imageCount > 0;
  const modernPercent = percent(modernImages, images.length || imageCount);
  checks.push(
    check({
      id: "image-formats",
      title: "Image format optimization",
      category: "performance",
      status: !imageDataAvailable
        ? "info"
        : modernPercent >= 70
          ? "pass"
          : modernPercent >= 30
            ? "warn"
            : "fail",
      weight: 8,
      detail: !imageDataAvailable
        ? "No content images were found in the inspected markup."
        : `${modernImages} of ${images.length || imageCount} image reference(s) use WebP, AVIF or SVG (${modernPercent}%). Format inference is URL-based and may miss CDN content negotiation.`,
      recommendation:
        imageDataAvailable && modernPercent < 70
          ? "Serve responsive WebP/AVIF variants and verify that CDN content negotiation is active."
          : undefined,
    }),
  );

  const loadingKnown = images.filter((image) => image.loading !== null).length;
  const lazyImages = images.filter((image) => image.loading === "lazy").length;
  checks.push(
    check({
      id: "lazy-images",
      title: "Image loading strategy",
      category: "performance",
      status:
        images.length === 0
          ? "info"
          : images.length <= 8
            ? "pass"
            : lazyImages >= images.length / 2
              ? "pass"
              : "warn",
      weight: 4,
      detail:
        images.length === 0
          ? "No content images were found."
          : `${lazyImages} of ${images.length} images explicitly use loading="lazy"; ${loadingKnown} images expose a loading attribute.`,
      recommendation:
        images.length > 8 && lazyImages < images.length / 2
          ? "Lazy-load below-the-fold images and set explicit dimensions to reduce layout shift."
          : undefined,
    }),
  );

  const thirdParties = new Set([
    ...context.facts.externalDomains,
    ...(clientTiming?.thirdPartyOrigins ?? []),
  ]);
  checks.push(
    check({
      id: "third-parties",
      title: "Third-party resource origins",
      category: "performance",
      status: thirdParties.size <= 5 ? "pass" : thirdParties.size <= 12 ? "warn" : "fail",
      weight: 5,
      detail: `${thirdParties.size} third-party origin(s) were observed in markup or browser resource timing.`,
      evidence: [...thirdParties].slice(0, 10),
      recommendation:
        thirdParties.size > 5
          ? "Review third-party tags, remove unused vendors and load non-critical integrations after the main content."
          : undefined,
    }),
  );

  checks.push(
    unavailable(
      "core-web-vitals",
      "Core Web Vitals (LCP, CLS, INP)",
      "performance",
      10,
      "Full Core Web Vitals require a controlled browser session across real navigation and interaction. Server-side fetching cannot measure them. The extension can supply FCP and navigation timings, but not a complete field/lab CWV assessment.",
      "Run a browser-based lab test (for example Lighthouse with a controlled throttled profile) for full Core Web Vitals.",
    ),
  );

  const score = buildCategoryScore({
    checks,
    explanation:
      "Performance is scored from measured server timings, HTML structure, client navigation timing when provided by the extension, and bounded same-origin asset samples. Estimates are not substituted for measurements.",
    methodology: [SCORE_METHODOLOGIES.performance, ...SCORE_METHODOLOGIES.category.split("\n")],
    missing: [
      "Full browser-based Core Web Vitals",
      ...(context.mode === "snapshot" ? ["Server-side header and asset measurements"] : []),
    ],
  });

  const metrics: Metric[] = [
    metric("ttfb", "Time to first byte", ttfbMeasured ? Math.round(ttfbMs!) : null, {
      unit: "ms",
      measured: ttfbMeasured,
      note:
        clientTiming?.ttfbMs !== undefined ? "Browser navigation timing" : "Server fetch timing",
    }),
    metric("html-bytes", "HTML document", documentBytes, {
      unit: "bytes",
      measured: documentBytes !== null,
    }),
    metric("requests", "Resource references", resourceCount, {
      measured: true,
      note:
        clientTiming?.resourceCount !== undefined ? "Browser resource timing" : "HTML references",
    }),
    metric("js-bytes", "JavaScript bytes", scriptBytes, {
      unit: "bytes",
      measured: scriptBytes !== null,
      note:
        snapshotScriptBytes === undefined ? "Same-origin asset sample" : "Browser resource timing",
    }),
    metric("css-bytes", "CSS bytes", styleBytes, {
      unit: "bytes",
      measured: styleBytes !== null,
      note: "Measured subset where applicable",
    }),
    metric("dom-content-loaded", "DOMContentLoaded", clientTiming?.domContentLoadedMs ?? null, {
      unit: "ms",
      measured: clientTiming?.domContentLoadedMs !== undefined,
    }),
    metric("load", "Load event", clientTiming?.loadMs ?? null, {
      unit: "ms",
      measured: clientTiming?.loadMs !== undefined,
    }),
    metric("fcp", "First Contentful Paint", clientTiming?.firstContentfulPaintMs ?? null, {
      unit: "ms",
      measured: clientTiming?.firstContentfulPaintMs !== undefined,
      note:
        clientTiming?.firstContentfulPaintMs === undefined
          ? "Requires browser paint timing"
          : undefined,
    }),
    metric(
      "blocking-scripts",
      "Render-blocking head scripts",
      context.mode === "snapshot" ? null : blocking.length,
      {
        measured: context.mode !== "snapshot",
      },
    ),
    metric("compression", "HTML compression", headersAvailable ? contentEncoding || "none" : null, {
      measured: headersAvailable,
    }),
    metric("third-parties", "Third-party origins", thirdParties.size),
  ];

  const section: SectionReport = {
    id: "performance",
    title: "Performance",
    summary: serviceSummary(score.score, "Performance"),
    score,
    metrics,
    limitations: [
      "TTFB includes network distance between the scanner and the website and is not a field measurement for every user.",
      "Asset sizes from bounded probes are samples unless browser resource timing is supplied by the extension.",
      "Resource timing can be restricted by cross-origin TAO headers, making some browser sizes unavailable.",
      "Server-side analysis cannot measure layout shift, interaction latency or full Core Web Vitals.",
      "No synthetic transaction is run against the site, and no JavaScript from the site is executed on the backend.",
      ...(context.mode === "snapshot"
        ? ["Extension snapshots cannot reconstruct all original response and resource attributes."]
        : []),
    ],
  };
  return { section, score };
}
