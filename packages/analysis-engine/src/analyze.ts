import type {
  Recommendation,
  ScanReport,
  SectionReport,
  TechnologyDetection,
} from "@vibetrace/shared-types";
import { safeFetch } from "./fetch/safe-fetch.js";
import { toScanError } from "./fetch/errors.js";
import { extractDocumentFacts } from "./document.js";
import { buildSnapshotHtml, mergeSnapshotFacts } from "./snapshot.js";
import { detectTechnologies } from "./fingerprints/technologies.js";
import { detectAISignals } from "./fingerprints/ai.js";
import { collectPageEvidence } from "./probes.js";
import { analyzeSecurity } from "./analyzers/security.js";
import { analyzePerformance } from "./analyzers/performance.js";
import { analyzeSeo } from "./analyzers/seo.js";
import { analyzeAccessibility } from "./analyzers/accessibility.js";
import { analyzeCodeQuality } from "./analyzers/quality.js";
import { buildAIReport } from "./analyzers/ai.js";
import { buildSourceProfile } from "./analyzers/source.js";
import {
  recommendationsFromChecks,
  scoreAISignals,
  scoreTechnologyConfidence,
} from "@vibetrace/scoring-engine";
import type { AnalyzeInput, AnalyzeOptions, AnalyzerContext, ProbeSummary } from "./types.js";

export const ENGINE_VERSION = "0.1.0";

const EMPTY_PROBES: ProbeSummary = {
  assets: [],
  sourceMaps: [],
  seo: null,
  errors: [],
};

function reportProgress(options: AnalyzeOptions, stage: string, percent: number, message?: string) {
  options.progress?.(stage, percent, message);
}

function assertHttpUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw toScanError(new Error("Invalid URL"));
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw toScanError(new Error("Unsupported URL protocol"));
  }
  return url;
}

function makeRecommendations(
  sections: { id: string; score: SectionReport["score"] }[],
  classification: string,
  builderNames: string[],
): Recommendation[] {
  const recommendations = recommendationsFromChecks(sections);
  if (classification === "strong" || classification === "moderate") {
    recommendations.push({
      id: "ai-provenance",
      title: "Corroborate AI-development signals",
      detail:
        "Treat the AI signal report as heuristic evidence, not authorship proof. Verify provenance with the site owner, build metadata or repository history. Do not present the signal index as a probability.",
      area: "ai",
      priority: "low",
    });
  }
  if (builderNames.length > 0) {
    recommendations.push({
      id: "ai-builder-caveats",
      title: "Review publishing-platform caveats",
      detail: `Builder fingerprints were observed for ${builderNames.join(", ")}. A publishing tool identifies the platform, not the amount of AI-generated code.`,
      area: "ai",
      priority: "low",
    });
  }
  return recommendations.slice(0, 16);
}

function buildKeyFindings(
  technologies: TechnologyDetection[],
  aiLabel: string,
  sections: SectionReport[],
): string[] {
  const findings: string[] = [];
  if (technologies.length > 0) {
    findings.push(
      `Detected ${technologies.length} technolog${technologies.length === 1 ? "y" : "ies"}: ${technologies
        .slice(0, 4)
        .map((item) => `${item.name} (${item.confidence}% confidence)`)
        .join(", ")}.`,
    );
  } else {
    findings.push("No registered technology fingerprints were detected.");
  }
  findings.push(`AI-development assessment: ${aiLabel}.`);

  for (const section of sections) {
    const fails = section.score.checks.filter((item) => item.status === "fail");
    const warns = section.score.checks.filter((item) => item.status === "warn");
    if (section.score.score !== null) {
      findings.push(
        `${section.title}: ${section.score.score}/100 (${section.score.coverage}% coverage)${fails.length ? `, ${fails.length} failed check(s)` : warns.length ? `, ${warns.length} warning(s)` : ""}.`,
      );
    } else {
      findings.push(`${section.title}: insufficient data for a numeric score.`);
    }
  }
  return findings.slice(0, 9);
}

/**
 * The single analysis pipeline. Browser website scans and extension snapshots
 * both flow through this function and the same scoring engine.
 */
export async function analyzeWebsite(
  input: AnalyzeInput,
  options: AnalyzeOptions = {},
): Promise<ScanReport> {
  const startedAt = performance.now();
  const now = options.now ?? (() => new Date());
  const createdAt = input.createdAt;
  const targetUrl = assertHttpUrl(input.url);
  const partialReasons: string[] = [];
  let facts;
  let probes: ProbeSummary = EMPTY_PROBES;
  let finalUrl = targetUrl.toString();
  let response: AnalyzerContext["response"];

  if (input.mode === "snapshot") {
    if (!input.snapshot) {
      throw toScanError(new Error("Snapshot mode requires a snapshot"));
    }
    reportProgress(options, "Inspecting snapshot", 20, "Normalizing sanitized DOM evidence");
    const syntheticHtml = buildSnapshotHtml(input.snapshot);
    facts = extractDocumentFacts(syntheticHtml, targetUrl.toString());
    mergeSnapshotFacts(facts, input.snapshot);
    finalUrl = input.snapshot.url;
    response = {
      status: null,
      contentType: "text/html",
      headers: {},
      headersAvailable: false,
      bodyBytes: Buffer.byteLength(syntheticHtml, "utf8"),
      ttfbMs: input.snapshot.timing?.ttfbMs ?? null,
      durationMs: input.snapshot.timing?.loadMs ?? null,
      redirects: [],
      truncated: false,
      cookieFlags: { count: 0, allSecure: false, allHttpOnly: false, allSameSite: false },
    };
    if (input.snapshot.html.trim().length < 40) {
      partialReasons.push("The extension captured very little sanitized markup.");
    }
  } else {
    reportProgress(options, "Fetching page", 10, "Validating target and enforcing SSRF controls");
    const fetched = await safeFetch(targetUrl, {
      maxBytes: options.maxHtmlBytes,
      maxRedirects: options.maxRedirects,
      allowedPorts: options.allowedPorts,
      resolver: options.resolver,
      fetchImpl: options.fetchImpl,
      timeoutMs: options.timeoutMs,
      signal: options.signal,
    });
    finalUrl = fetched.finalUrl;
    reportProgress(options, "Parsing document", 28, "Inspecting HTML, metadata and structure");
    facts = extractDocumentFacts(fetched.text, fetched.finalUrl);
    response = {
      status: fetched.status,
      contentType: fetched.contentType,
      headers: fetched.headers,
      headersAvailable: true,
      bodyBytes: fetched.bodyBytes,
      ttfbMs: fetched.ttfbMs,
      durationMs: fetched.durationMs,
      redirects: fetched.redirects,
      truncated: fetched.truncated,
      cookieFlags: fetched.cookieFlags,
    };
    if (fetched.status >= 400) {
      partialReasons.push(
        `The upstream server returned HTTP ${fetched.status}; the analyzed document may be an error page.`,
      );
    }
    if (fetched.truncated) {
      partialReasons.push("The HTML document was truncated at the configured response-size limit.");
    }

    if (options.enableProbes !== false) {
      reportProgress(
        options,
        "Probing resources",
        42,
        "Sampling same-origin assets, robots.txt and sitemap",
      );
      probes = await collectPageEvidence(facts, fetched.finalUrl, {
        resolver: options.resolver,
        fetchImpl: options.fetchImpl,
        allowedPorts: options.allowedPorts,
        maxAssetProbes: options.maxAssetProbes,
        assetMaxBytes: options.assetProbeMaxBytes,
        signal: options.signal,
      });
      if (probes.errors.length > 0) {
        partialReasons.push(`${probes.errors.length} optional resource probe(s) were unavailable.`);
      }
    }
  }

  if (options.signal?.aborted) {
    throw toScanError(Object.assign(new Error("Scan aborted"), { name: "AbortError" }));
  }

  reportProgress(
    options,
    "Fingerprinting technologies",
    55,
    "Matching evidence-backed technology signatures",
  );
  const technologies = detectTechnologies({
    facts,
    headers: response.headers,
    hostname: new URL(finalUrl).hostname,
  });

  reportProgress(
    options,
    "Analyzing AI-development signals",
    63,
    "Applying builder and source-pattern rules",
  );
  const aiDetection = detectAISignals({
    facts,
    headers: response.headers,
    hostname: new URL(finalUrl).hostname,
    technologies,
  });
  const aiScore = scoreAISignals({
    evidence: aiDetection.evidence,
    contradictions: aiDetection.contradictions,
    builderFingerprintCount: aiDetection.builderFingerprints.length,
    rulesEvaluated: aiDetection.rulesEvaluated,
    headersAvailable: response.headersAvailable,
  });

  const context: AnalyzerContext = {
    scanId: input.scanId,
    url: input.url,
    finalUrl,
    hostname: new URL(finalUrl).hostname,
    mode: input.mode,
    client: input.client,
    facts,
    snapshot: input.snapshot,
    response,
    probes,
    generatedAt: now().toISOString(),
    partialReasons,
  };

  reportProgress(options, "Inspecting security", 72, "Evaluating passive security configuration");
  const security = analyzeSecurity(context);
  reportProgress(options, "Measuring performance", 80, "Scoring measured performance evidence");
  const performanceAnalysis = analyzePerformance(context);
  reportProgress(
    options,
    "Auditing SEO and accessibility",
    88,
    "Running automated metadata and markup checks",
  );
  const seo = analyzeSeo(context);
  const accessibility = analyzeAccessibility(context);
  const codeQuality = analyzeCodeQuality(context);
  const ai = buildAIReport(context, aiDetection, aiScore);
  const source = buildSourceProfile(context);
  const technologyConfidence = scoreTechnologyConfidence(technologies);

  const sectionReports = [
    codeQuality.section,
    security.section,
    performanceAnalysis.section,
    seo.section,
    accessibility.section,
  ];
  const recommendations = makeRecommendations(
    [
      { id: "codeQuality", score: codeQuality.score },
      { id: "security", score: security.score },
      { id: "performance", score: performanceAnalysis.score },
      { id: "seo", score: seo.score },
      { id: "accessibility", score: accessibility.score },
    ],
    ai.classification,
    ai.builderFingerprints.map((builder) => builder.name),
  );

  const generatedAt = now().toISOString();
  const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
  const partialReason = partialReasons.length > 0 ? [...new Set(partialReasons)].join(" ") : null;

  const report: ScanReport = {
    schemaVersion: "1.0",
    engineVersion: ENGINE_VERSION,
    generatedAt,
    scan: {
      id: input.scanId,
      url: input.url,
      finalUrl,
      domain: new URL(finalUrl).hostname,
      mode: input.mode,
      client: input.client,
      status: partialReason ? "partially_completed" : "completed",
      httpStatus: response.status,
      createdAt,
      completedAt: generatedAt,
      durationMs,
      title: facts.title || null,
      language: facts.lang || null,
      generator: facts.generator,
      server: response.headers.server ?? null,
      contentType: response.contentType || null,
    },
    overview: {
      title: facts.title || null,
      description: facts.description,
      language: facts.lang || null,
      generator: facts.generator,
      server: response.headers.server ?? null,
      httpStatus: response.status,
      contentType: response.contentType || null,
      finalUrl,
      technologySummary: technologies.map((item) => item.name),
      builderSummary: ai.builderFingerprints.map((builder) => builder.name),
      keyFindings: buildKeyFindings(technologies, ai.label, sectionReports),
    },
    ai,
    technologies,
    source,
    sections: {
      codeQuality: codeQuality.section,
      security: security.section,
      performance: performanceAnalysis.section,
      seo: seo.section,
      accessibility: accessibility.section,
    },
    scores: {
      aiSignals: aiScore,
      technologyConfidence,
      codeQuality: codeQuality.score,
      security: security.score,
      performance: performanceAnalysis.score,
      accessibility: accessibility.score,
      seo: seo.score,
    },
    recommendations,
    limitations: [
      "VibeTrace analyzes publicly reachable frontend material only. It does not authenticate, bypass paywalls or test for exploitable vulnerabilities.",
      "No website JavaScript is executed on the backend. Browser-only behavior and complete Core Web Vitals cannot be measured server-side.",
      "Reports contain derived findings and sanitized observations, not raw page HTML, script bodies, cookies, form values or storage.",
      "AI-development detection is heuristic. It cannot establish authorship, and absence of signals is not evidence of absence.",
      "Automated accessibility and security checks cover a subset of possible issues and do not replace manual review.",
      ...(input.mode === "snapshot"
        ? [
            "This report was produced from a sanitized extension snapshot. Response headers, cookie attributes and external bundles are out of scope.",
          ]
        : []),
    ],
    partialReason,
  };

  reportProgress(options, "Building report", 100, "Analysis complete");
  return report;
}
