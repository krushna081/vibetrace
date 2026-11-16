import type { AIScoreSummary, AISignalReport, Metric } from "@vibetrace/shared-types";
import { AI_CLASSIFICATION_LABELS } from "@vibetrace/shared-types";
import type { AISignalDetection } from "../fingerprints/ai.js";
import type { AnalyzerContext } from "../types.js";

const LIMITATIONS = [
  "Frontend source cannot establish authorship. AI-assisted work often leaves no detectable trace, and hand-written code can resemble generated code.",
  "Builder fingerprints identify publishing or scaffolding tools. They do not prove what proportion of a site was AI-generated.",
  "Production minification and bundling remove comments, component names, source maps and other provenance clues.",
  "The signal index is a transparent heuristic, not a probability calibrated against a representative dataset.",
  "Absence of AI signals is not evidence of absence.",
];

export function buildAIReport(
  context: AnalyzerContext,
  detection: AISignalDetection,
  score: AIScoreSummary,
): AISignalReport {
  const topEvidence = detection.evidence
    .slice()
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((item) => item.title);

  const builderNames = detection.builderFingerprints.map((builder) => builder.name);
  let summary: string;
  switch (score.classification) {
    case "strong":
      summary = `Strong builder-specific or AI-tooling signals were observed${builderNames.length ? ` (${builderNames.slice(0, 3).join(", ")})` : ""}. ${topEvidence.length ? `The highest-weight indicators are: ${topEvidence.join("; ")}.` : ""} This is a strong association with AI-assisted tooling, not proof that every file was AI-generated.`;
      break;
    case "moderate":
      summary = `Moderate AI-assisted development signals were observed. ${topEvidence.length ? `Key indicators: ${topEvidence.join("; ")}.` : ""} Corroborate with build provenance or repository history before drawing conclusions.`;
      break;
    case "weak":
      summary = `Only weak circumstantial signals were observed. These patterns are common in both human and AI-assisted work and should not be treated as evidence of authorship.`;
      break;
    case "mixed":
      summary = `The evidence is mixed or conflicting. Positive indicators are present alongside contradictory or complicating signals, so the report intentionally does not select a single origin explanation.`;
      break;
    case "insufficient":
      summary = `No meaningful AI-builder metadata or distinctive AI-tooling source patterns were observed. This does not mean AI was not used. Most AI-assisted development is invisible from the public frontend.`;
      break;
  }

  const metrics: Metric[] = [
    ...detection.metrics,
    {
      id: "builder-fingerprints",
      label: "Builder fingerprints identified",
      value: detection.builderFingerprints.length,
      measured: true,
    },
    {
      id: "response-headers",
      label: "Server response headers inspected",
      value: context.response.headersAvailable ? "Yes" : "No",
      measured: true,
      note: context.response.headersAvailable
        ? undefined
        : "Snapshot mode cannot access response headers.",
    },
  ];

  const limitations = [...LIMITATIONS];
  if (context.mode === "snapshot") {
    limitations.push(
      "Snapshot mode analyzes sanitized DOM structure, metadata and inline samples supplied by the extension. External bundles and server headers are not analyzed.",
    );
  }
  if (context.response.headersAvailable && context.response.redirects.length > 0) {
    limitations.push(
      `The site redirected ${context.response.redirects.length} time(s); only the final document was analyzed.`,
    );
  }

  const insufficientEvidenceNotes: string[] = [];
  if (detection.evidence.length === 0) {
    insufficientEvidenceNotes.push(
      "No registered builder metadata, AI-related source comments or distinctive tooling artifacts matched the inspected material.",
    );
    insufficientEvidenceNotes.push(
      "AI features inside IDEs, chat tools or screen builders usually leave no public frontend fingerprint.",
    );
    insufficientEvidenceNotes.push(
      "Minified production bundles remove the comments and component names that are most useful for forensic inspection.",
    );
  }
  if (detection.contradictions.length > 0) {
    insufficientEvidenceNotes.push(
      `Contradictory evidence includes: ${detection.contradictions.map((item) => item.title).join(", ")}.`,
    );
  }
  if (context.mode === "snapshot") {
    insufficientEvidenceNotes.push(
      "Extension snapshots intentionally exclude cookies, form values, local storage and unrelated page text.",
    );
  }

  const recommendations: string[] = [];
  switch (score.classification) {
    case "strong":
      recommendations.push(
        "Treat this as a strong builder/tooling signal. Verify provenance with the site owner, build metadata or repository history before making any authorship claim.",
      );
      break;
    case "moderate":
      recommendations.push(
        "Review the individual evidence items and corroborate with build or repository history. Moderate signals are not proof of authorship.",
      );
      break;
    case "weak":
      recommendations.push(
        "Do not draw a conclusion from weak signals; they are common across many development workflows.",
      );
      break;
    case "mixed":
      recommendations.push(
        "Inspect the contradictory signals manually. A mixed report means the automated evidence does not support a single clean explanation.",
      );
      break;
    case "insufficient":
      recommendations.push(
        "No AI-specific action is recommended. Consider a server-side scan or source review only with the site owner's authorization.",
      );
      break;
  }
  recommendations.push(
    "Never present this signal index as a probability of AI authorship; it is an uncalibrated evidence summary.",
  );

  if (builderNames.length > 0) {
    recommendations.push(
      `Builder fingerprints observed: ${builderNames.join(", ")}. Review each builder caveat in the evidence section.`,
    );
  }

  return {
    classification: score.classification,
    label: AI_CLASSIFICATION_LABELS[score.classification],
    signalScore: score.signalScore,
    confidence: score.confidence,
    confidenceScore: score.confidenceScore,
    summary,
    evidence: detection.evidence,
    contradictions: detection.contradictions,
    builderFingerprints: detection.builderFingerprints,
    insufficientEvidenceNotes,
    limitations,
    recommendations,
    metrics,
  };
}
