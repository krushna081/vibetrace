import type { CategoryScore, Metric, SectionReport } from "@vibetrace/shared-types";
import { buildCategoryScore, SCORE_METHODOLOGIES } from "@vibetrace/scoring-engine";
import type { AnalyzerContext } from "../types.js";
import { check, formatBytes, metric, serviceSummary, unavailable } from "./helpers.js";

export function analyzeCodeQuality(context: AnalyzerContext): {
  section: SectionReport;
  score: CategoryScore;
} {
  const { facts } = context;
  const checks = [];
  const snapshot = context.snapshot;
  const nodeCount = snapshot?.dom.nodeCount ?? facts.nodeCount;
  const inlineStyleRatio = nodeCount > 0 ? (facts.inlineStyleAttributes / nodeCount) * 100 : 0;
  const inlineScripts = facts.scriptFacts.filter((script) => Boolean(script.inline)).length;
  const externalScripts = facts.scriptFacts.filter((script) => Boolean(script.src)).length;
  const inlineStyleBlocks = facts.inlineStyles.length;

  checks.push(
    check({
      id: "doctype",
      title: "Document type declaration",
      category: "codeQuality",
      status: facts.hasDoctype && !facts.doctypeLegacy ? "pass" : "warn",
      weight: 6,
      detail: !facts.hasDoctype
        ? "No doctype was found; the page may render in quirks mode."
        : facts.doctypeLegacy
          ? "A legacy doctype was found instead of the HTML5 doctype."
          : "A modern HTML5 doctype is present.",
      recommendation:
        facts.hasDoctype && !facts.doctypeLegacy
          ? undefined
          : "Start the document with <!doctype html>.",
    }),
  );

  checks.push(
    check({
      id: "charset",
      title: "Character encoding declaration",
      category: "codeQuality",
      status: facts.charset ? "pass" : "warn",
      weight: 4,
      detail: facts.charset
        ? `A character encoding declaration was found: ${facts.charset.slice(0, 80)}`
        : "No meta charset declaration was observed.",
      recommendation: facts.charset ? undefined : "Declare UTF-8 early in the document head.",
    }),
  );

  checks.push(
    check({
      id: "viewport",
      title: "Responsive viewport metadata",
      category: "codeQuality",
      status: facts.responsiveMeta ? "pass" : "warn",
      weight: 3,
      detail: facts.responsiveMeta
        ? "A width=device-width viewport is declared."
        : "No responsive viewport declaration was found.",
      recommendation: facts.responsiveMeta ? undefined : "Add a responsive viewport meta tag.",
    }),
  );

  checks.push(
    check({
      id: "language",
      title: "Document language",
      category: "codeQuality",
      status: facts.lang ? "pass" : "warn",
      weight: 3,
      detail: facts.lang
        ? `Language declared as "${facts.lang}".`
        : "No html lang attribute was found.",
      recommendation: facts.lang ? undefined : "Declare the document language on the html element.",
    }),
  );

  const landmarks = facts.semanticElements.filter((tag) =>
    ["header", "nav", "main", "footer", "article", "aside"].includes(tag),
  );
  const hasMain = facts.semanticElements.includes("main");
  checks.push(
    check({
      id: "semantic-landmarks",
      title: "Semantic landmarks",
      category: "codeQuality",
      status: hasMain && landmarks.length >= 3 ? "pass" : landmarks.length >= 1 ? "warn" : "fail",
      weight: 8,
      detail:
        landmarks.length === 0
          ? "No semantic landmark elements were found."
          : `Semantic landmarks observed: ${facts.semanticElements.join(", ")}.${hasMain ? "" : " A main landmark was not found."}`,
      recommendation:
        hasMain && landmarks.length >= 3
          ? undefined
          : "Use header, nav, main and footer landmarks to make the document structure explicit.",
    }),
  );

  checks.push(
    check({
      id: "inline-styles",
      title: "Inline style density",
      category: "codeQuality",
      status:
        nodeCount === 0
          ? "unavailable"
          : inlineStyleRatio <= 1.5
            ? "pass"
            : inlineStyleRatio <= 5
              ? "warn"
              : "fail",
      weight: 7,
      basis: "heuristic",
      detail:
        nodeCount === 0
          ? "DOM size was not measurable."
          : `${facts.inlineStyleAttributes} inline style attribute(s) across ${nodeCount} nodes (${inlineStyleRatio.toFixed(1)}%).`,
      recommendation:
        inlineStyleRatio > 1.5
          ? "Move repeated inline styles into maintainable classes or design tokens."
          : undefined,
    }),
  );

  checks.push(
    check({
      id: "inline-handlers",
      title: "Inline event handlers",
      category: "codeQuality",
      status:
        facts.inlineEventHandlers === 0 ? "pass" : facts.inlineEventHandlers <= 3 ? "warn" : "fail",
      weight: 6,
      basis: "heuristic",
      detail:
        facts.inlineEventHandlers === 0
          ? "No inline onclick-style handlers were found."
          : `${facts.inlineEventHandlers} inline event handler attribute(s) were found, which can complicate CSP and maintainability.`,
      recommendation:
        facts.inlineEventHandlers === 0
          ? undefined
          : "Move event handling into modular scripts and remove inline handlers.",
    }),
  );

  checks.push(
    check({
      id: "duplicate-ids",
      title: "Unique element identifiers",
      category: "codeQuality",
      status: facts.duplicateIds === 0 ? "pass" : "warn",
      weight: 5,
      detail:
        facts.duplicateIds === 0
          ? "No duplicate IDs were found."
          : `${facts.duplicateIds} duplicate ID value(s) were found.`,
      recommendation: facts.duplicateIds === 0 ? undefined : "Make element IDs unique.",
    }),
  );

  const blocking = facts.scriptFacts.filter(
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
          "script-blocking",
          "Head script loading strategy",
          "codeQuality",
          7,
          "Sanitized snapshot markup does not preserve reliable head-script loading attributes.",
        )
      : check({
          id: "script-blocking",
          title: "Head script loading strategy",
          category: "codeQuality",
          status: blocking.length === 0 ? "pass" : blocking.length <= 2 ? "warn" : "fail",
          weight: 7,
          detail:
            blocking.length === 0
              ? "No parser-blocking head scripts were detected."
              : `${blocking.length} parser-blocking external head script(s) were detected.`,
          recommendation:
            blocking.length === 0
              ? undefined
              : "Use async, defer or ES modules for non-critical scripts.",
        }),
  );

  checks.push(
    check({
      id: "css-organization",
      title: "Stylesheet organization",
      category: "codeQuality",
      status:
        facts.stylesheets.length === 0 && inlineStyleBlocks === 0
          ? "info"
          : facts.stylesheets.length > 0
            ? "pass"
            : "warn",
      weight: 6,
      basis: "heuristic",
      detail:
        facts.stylesheets.length === 0 && inlineStyleBlocks === 0
          ? "No stylesheets or style blocks were found."
          : `${facts.stylesheets.length} external stylesheet(s) and ${inlineStyleBlocks} inline <style> block(s) were found.`,
      recommendation:
        facts.stylesheets.length === 0 && inlineStyleBlocks > 0
          ? "Extract sizeable inline CSS into cacheable stylesheets or component-scoped modules."
          : undefined,
    }),
  );

  checks.push(
    check({
      id: "script-organization",
      title: "Script organization",
      category: "codeQuality",
      status:
        facts.scriptFacts.length === 0
          ? "info"
          : externalScripts > 0 && externalScripts >= inlineScripts
            ? "pass"
            : "warn",
      weight: 5,
      basis: "heuristic",
      detail:
        facts.scriptFacts.length === 0
          ? "No scripts were found."
          : `${externalScripts} external script(s) and ${inlineScripts} inline script(s) were found. Inline count uses non-empty script bodies.`,
      recommendation:
        facts.scriptFacts.length > 0 && externalScripts < inlineScripts
          ? "Prefer cacheable external modules for substantial JavaScript and keep inline bootstrap code minimal."
          : undefined,
    }),
  );

  checks.push(
    check({
      id: "html-size",
      title: "HTML document size",
      category: "codeQuality",
      status:
        context.response.bodyBytes <= 120_000
          ? "pass"
          : context.response.bodyBytes <= 350_000
            ? "warn"
            : "fail",
      weight: 4,
      detail: `The response body was ${formatBytes(context.response.bodyBytes)}${snapshot ? " in sanitized snapshot form" : ""}.`,
      recommendation:
        context.response.bodyBytes > 120_000
          ? "Reduce redundant server-rendered markup and embedded serialized state."
          : undefined,
    }),
  );

  checks.push(
    check({
      id: "source-maps",
      title: "Source-map references",
      category: "codeQuality",
      status: context.probes.sourceMaps.length > 0 ? "info" : "info",
      weight: 3,
      basis: "measured",
      detail:
        context.probes.sourceMaps.length > 0
          ? `${context.probes.sourceMaps.length} source-map reference(s) were observed. Public source maps can improve debuggability but may expose source structure.`
          : "No source-map references were observed in the inspected document or asset samples.",
      recommendation:
        context.probes.sourceMaps.length > 0
          ? "Review whether public source maps expose proprietary or sensitive source; limit them to release artifacts where appropriate."
          : undefined,
    }),
  );

  checks.push(
    check({
      id: "repeated-structures",
      title: "Repeated component structures",
      category: "codeQuality",
      status: "info",
      weight: 3,
      basis: "heuristic",
      detail:
        facts.repeatedStructures.length === 0
          ? "No significant repeated class signatures were observed."
          : `The most repeated DOM signature appears ${facts.repeatedStructures[0]!.count} times (${facts.repeatedStructures[0]!.signature}). Repetition can be intentional component reuse and is not inherently a defect.`,
    }),
  );

  const score = buildCategoryScore({
    checks,
    explanation:
      "Code quality is a structural maintainability signal. Measured markup facts are separated from heuristic conventions in every check; this is not a software-quality certification.",
    methodology: [SCORE_METHODOLOGIES.category, ...SCORE_METHODOLOGIES.category.split("\n")],
    missing: context.mode === "snapshot" ? ["Head-script loading attributes"] : [],
  });

  const metrics: Metric[] = [
    metric("nodes", "DOM nodes", nodeCount),
    metric("depth", "Maximum DOM depth", snapshot?.dom.maxDepth ?? facts.maxDepth),
    metric("inline-styles", "Inline style attributes", facts.inlineStyleAttributes),
    metric("inline-handlers", "Inline event handlers", facts.inlineEventHandlers),
    metric("duplicate-ids", "Duplicate IDs", facts.duplicateIds),
    metric("external-scripts", "External scripts", externalScripts),
    metric("inline-scripts", "Inline scripts", inlineScripts),
    metric("stylesheets", "External stylesheets", facts.stylesheets.length),
    metric("inline-style-blocks", "Inline style blocks", inlineStyleBlocks),
    metric("semantic-landmarks", "Semantic landmark types", landmarks.length),
    metric(
      "repeated-structure",
      "Repeated DOM signature peak",
      facts.repeatedStructures[0]?.count ?? 0,
    ),
  ];

  const section: SectionReport = {
    id: "codeQuality",
    title: "Code quality indicators",
    summary: serviceSummary(score.score, "Code quality"),
    score,
    metrics,
    limitations: [
      "This section evaluates public structural indicators, not the private repository or source authorship.",
      "Minification, framework conventions and generated markup can make code quality signals ambiguous.",
      "Framework idioms vary; inline styles or many nodes can be deliberate performance or architecture choices.",
      "No JavaScript from the site is executed on the backend, so runtime maintainability is not assessed.",
      ...(snapshot
        ? ["Snapshot markup is sanitized and may differ from the full original document."]
        : []),
    ],
  };
  return { section, score };
}
