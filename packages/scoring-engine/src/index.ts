import type {
  AIClassification,
  AIScoreSummary,
  CategoryScore,
  CheckResult,
  ConfidenceLevel,
  Evidence,
  Recommendation,
  TechnologyConfidence,
  TechnologyDetection,
} from "@vibetrace/shared-types";
import { AI_CLASSIFICATION_LABELS } from "@vibetrace/shared-types";

export const GRADE_THRESHOLDS = [
  { grade: "A", min: 90 },
  { grade: "B", min: 80 },
  { grade: "C", min: 70 },
  { grade: "D", min: 60 },
  { grade: "E", min: 50 },
  { grade: "F", min: 0 },
] as const;

export const MINIMUM_SCORE_COVERAGE = 40;

export const SCORE_METHODOLOGIES = {
  category:
    "Each check has a fixed weight. Available checks (pass, warn, fail) contribute their full weight to the denominator. A pass earns 100% of its weight, a warning earns 50%, a failure earns 0%. Info and unavailable checks do not earn points; unavailable checks still count toward missing-data coverage. score = round(earned / availableWeight × 100). Coverage = availableWeight / allScoredWeight × 100. If coverage is below 40%, the score is withheld as insufficient rather than presented as reliable.",
  ai: "The AI signal index is a weighted evidence index, not a probability. Positive evidence weights are summed by category (builder-specific, source-pattern, circumstantial). Contradictory weights reduce the index by 50% of their total. Strong classification requires an adjusted index of at least 40 and at least one strong builder-specific indicator. Moderate requires ≥24; weak requires ≥7. Conflicting evidence (contradictions ≥75% of positive weight) produces a mixed classification. Confidence reflects breadth and independence of evidence, not the probability that AI was used.",
  technologyConfidence:
    "Each technology's confidence is 100 × (1 − e^(−Σ evidence weights / 38)), capped at 98. Independent strong signals raise confidence more than a single weak pattern. The aggregate technology-confidence score is the arithmetic mean of detected technology confidences. Coverage is the share of detections with confidence ≥ 50.",
  security:
    "Security checks are passive observations of HTTPS, response headers, cookie attributes, mixed content and publicly visible configuration patterns. Scores weight missing protections; observations are not vulnerability tests and do not establish exploitability.",
  performance:
    "Performance uses real server-side fetch timings and response/asset measurements where available. Estimates are never presented as measurements. Browser-only metrics such as full Core Web Vitals are marked unavailable unless a browser (the extension) supplies navigation timing.",
  accessibility:
    "Automated accessibility checks cover detectable markup issues only. Contrast, keyboard operability and screen-reader behavior cannot be fully assessed from static markup, so those checks are marked unavailable or heuristic and excluded from the score when not measurable.",
  seo: "SEO checks cover indexable metadata, heading structure, crawl hints and structured data. Sitemap/robots checks are single-request availability probes and do not validate every URL. Broken-link crawling is not performed.",
} as const;

export function gradeFor(score: number | null): string | null {
  if (score === null) return null;
  return GRADE_THRESHOLDS.find((entry) => score >= entry.min)?.grade ?? "F";
}

export function confidenceLevel(score: number): ConfidenceLevel {
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  return "low";
}

const STATUS_VALUE: Record<CheckResult["status"], number | null> = {
  pass: 1,
  warn: 0.5,
  fail: 0,
  info: null,
  unavailable: null,
};

export interface CategoryScoreInput {
  checks: CheckResult[];
  explanation: string;
  methodology?: string[];
  missing?: string[];
  minimumCoverage?: number;
}

export function buildCategoryScore(input: CategoryScoreInput): CategoryScore {
  const scored = input.checks.filter((check) => check.status !== "info" && check.weight > 0);
  const allWeight = scored.reduce((sum, check) => sum + check.weight, 0);
  const available = scored.filter((check) => check.status !== "unavailable");
  const availableWeight = available.reduce((sum, check) => sum + check.weight, 0);
  const earned = available.reduce((sum, check) => {
    const factor = STATUS_VALUE[check.status];
    return sum + (factor === null ? 0 : check.weight * factor);
  }, 0);

  const coverage = allWeight > 0 ? Math.round((availableWeight / allWeight) * 100) : 0;
  const minimum = input.minimumCoverage ?? MINIMUM_SCORE_COVERAGE;
  const rawScore = availableWeight > 0 ? Math.round((earned / availableWeight) * 100) : null;
  const score = rawScore !== null && coverage >= minimum ? rawScore : null;

  const missing = new Set(input.missing ?? []);
  for (const check of input.checks) {
    if (check.status === "unavailable") missing.add(check.title);
  }

  const explanation =
    score === null
      ? `${input.explanation} No numeric score is shown because fewer than ${minimum}% of weighted checks could be measured (coverage ${coverage}%).`
      : `${input.explanation} Earned ${earned.toFixed(1)} of ${availableWeight} available points across ${available.length} measured checks (${coverage}% data coverage).`;

  return {
    score,
    grade: gradeFor(score),
    coverage,
    earned: Number(earned.toFixed(2)),
    possible: availableWeight,
    explanation,
    methodology: input.methodology ?? [SCORE_METHODOLOGIES.category],
    missing: [...missing],
    checks: input.checks,
  };
}

export interface AIScoringInput {
  evidence: Evidence[];
  contradictions: Evidence[];
  builderFingerprintCount: number;
  rulesEvaluated: number;
  headersAvailable: boolean;
}

interface ClassificationResult {
  classification: AIClassification;
  label: string;
  signalScore: number | null;
  confidence: ConfidenceLevel;
  confidenceScore: number;
}

export function classifyAISignals(input: AIScoringInput): ClassificationResult {
  const positive = input.evidence.reduce((sum, item) => sum + item.weight, 0);
  const contradictions = input.contradictions.reduce((sum, item) => sum + item.weight, 0);
  const strongEvidence = input.evidence.filter(
    (item) => item.category === "strong_builder" && item.weight >= 30,
  );
  const adjusted = Math.max(0, Math.round(positive - contradictions * 0.5));

  let classification: AIClassification;
  if (positive === 0) {
    classification = contradictions > 0 ? "mixed" : "insufficient";
  } else if (contradictions >= positive * 0.75) {
    classification = "mixed";
  } else if (adjusted >= 40 && strongEvidence.length > 0) {
    classification = "strong";
  } else if (adjusted >= 24) {
    classification = "moderate";
  } else if (adjusted >= 7) {
    classification = "weak";
  } else {
    classification = "mixed";
  }

  const categories = new Set(input.evidence.map((item) => item.category));
  let confidenceScore =
    15 +
    Math.min(3, categories.size) * 10 +
    Math.min(3, strongEvidence.length) * 12 +
    Math.min(5, input.evidence.length) * 3 +
    Math.min(2, input.builderFingerprintCount) * 4 -
    Math.min(25, contradictions * 0.8);

  if (input.evidence.length === 1) confidenceScore = Math.min(confidenceScore, 45);
  if (input.evidence.every((item) => item.category === "weak_circumstantial")) {
    confidenceScore = Math.min(confidenceScore, 34);
  }
  if (contradictions >= positive && positive > 0) confidenceScore = Math.min(confidenceScore, 42);
  confidenceScore = Math.max(0, Math.min(95, Math.round(confidenceScore)));

  return {
    classification,
    label: AI_CLASSIFICATION_LABELS[classification],
    signalScore: positive > 0 ? adjusted : null,
    confidence: confidenceLevel(confidenceScore),
    confidenceScore,
  };
}

export function scoreAISignals(input: AIScoringInput): AIScoreSummary {
  const result = classifyAISignals(input);
  const positive = input.evidence.reduce((sum, item) => sum + item.weight, 0);
  const contradictions = input.contradictions.reduce((sum, item) => sum + item.weight, 0);

  const missing: string[] = [];
  if (!input.headersAvailable) missing.push("Response headers (snapshot mode)");
  if (positive === 0) missing.push("Any positive AI-builder or source-pattern indicator");

  const explanation =
    result.classification === "insufficient"
      ? "No meaningful AI-builder or AI-source indicators were observed. This is not evidence that AI was not used; most AI-assisted source code leaves no reliable frontend fingerprint."
      : `Positive evidence weight ${positive}, contradictory weight ${contradictions}. Adjusted signal index ${result.signalScore ?? 0}/100. This index summarizes observed signals; it is not a calibrated probability of AI authorship. Absence of these signals would not prove the site was built without AI. Confidence ${result.confidenceScore}% reflects signal breadth and consistency.`;

  return {
    ...result,
    explanation,
    methodology: [
      SCORE_METHODOLOGIES.ai,
      `Evaluated ${input.rulesEvaluated} modular fingerprint rules against metadata, DOM structure, source comments, asset URLs, headers and builder markers.`,
      "Builder fingerprints identify publishing tools. AI-native builders make AI assistance likely; general website builders do not.",
    ],
    missing,
  };
}

export function scoreTechnologyConfidence(detections: TechnologyDetection[]): TechnologyConfidence {
  if (detections.length === 0) {
    return {
      score: null,
      label: "No technologies detected",
      detectedCount: 0,
      coverage: 0,
      explanation:
        "No technology evidence crossed the observation threshold. The site may be statically rendered, heavily bundled, or using an unregistered technology.",
      methodology: [SCORE_METHODOLOGIES.technologyConfidence],
      missing: ["Technology signatures"],
    };
  }

  const score = Math.round(
    detections.reduce((sum, item) => sum + item.confidence, 0) / detections.length,
  );
  const coverage = Math.round(
    (detections.filter((item) => item.confidence >= 50).length / detections.length) * 100,
  );
  const label =
    score >= 75 ? "High confidence" : score >= 45 ? "Mixed confidence" : "Low confidence";

  return {
    score,
    label,
    detectedCount: detections.length,
    coverage,
    explanation: `${detections.length} technolog${detections.length === 1 ? "y was" : "ies were"} detected. The aggregate is the mean of each detection's evidence-weighted confidence. ${coverage}% of detections have confidence ≥ 50. This measures detection certainty, not how modern or good the stack is.`,
    methodology: [
      SCORE_METHODOLOGIES.technologyConfidence,
      "Technologies are never inferred from visual appearance alone. Each display is backed by inspectable evidence.",
    ],
    missing: [
      "Backend technologies that leave no response-header or asset evidence",
      "Technologies bundled without recognizable runtime artifacts",
    ],
  };
}

const AREA_FOR_SECTION: Record<string, Recommendation["area"]> = {
  security: "security",
  performance: "performance",
  accessibility: "accessibility",
  seo: "seo",
  codeQuality: "quality",
};

export function recommendationsFromChecks(
  sections: { id: string; score: CategoryScore }[],
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  for (const section of sections) {
    for (const check of section.score.checks) {
      if (check.status !== "fail" && check.status !== "warn") continue;
      if (!check.recommendation) continue;
      const priority: Recommendation["priority"] =
        check.status === "fail" ? (check.weight >= 12 ? "high" : "medium") : "low";
      recommendations.push({
        id: `${section.id}-${check.id}`,
        title: check.title,
        detail: check.recommendation,
        area: AREA_FOR_SECTION[section.id] ?? "quality",
        priority,
      });
    }
  }

  const rank: Record<Recommendation["priority"], number> = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => rank[a.priority] - rank[b.priority]);
  return recommendations.slice(0, 14);
}
