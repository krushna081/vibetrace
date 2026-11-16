import { describe, expect, it } from "vitest";
import type { CheckResult, Evidence, TechnologyDetection } from "@vibetrace/shared-types";
import {
  buildCategoryScore,
  classifyAISignals,
  gradeFor,
  scoreAISignals,
  scoreTechnologyConfidence,
} from "../src/index.js";

function check(
  partial: Partial<CheckResult> & Pick<CheckResult, "id" | "status" | "weight">,
): CheckResult {
  return {
    title: partial.id,
    category: "security",
    basis: "measured",
    detail: "Fixture check",
    evidence: [],
    ...partial,
  };
}

function evidence(
  partial: Partial<Evidence> & Pick<Evidence, "id" | "category" | "weight">,
): Evidence {
  return {
    title: partial.id,
    description: "Fixture evidence",
    strength: "moderate",
    source: "test",
    ...partial,
  };
}

describe("buildCategoryScore", () => {
  it("earns full, half and zero weight for pass, warn and fail", () => {
    const result = buildCategoryScore({
      checks: [
        check({ id: "pass", status: "pass", weight: 10 }),
        check({ id: "warn", status: "warn", weight: 10 }),
        check({ id: "fail", status: "fail", weight: 10 }),
      ],
      explanation: "Fixture category.",
    });
    expect(result.score).toBe(50);
    expect(result.grade).toBe("E");
    expect(result.coverage).toBe(100);
    expect(result.earned).toBe(15);
    expect(result.possible).toBe(30);
    expect(result.explanation).toContain("100% data coverage");
  });

  it("does not award points for informational checks", () => {
    const result = buildCategoryScore({
      checks: [
        check({ id: "info", status: "info", weight: 100 }),
        check({ id: "pass", status: "pass", weight: 10 }),
      ],
      explanation: "Fixture category.",
    });
    expect(result.score).toBe(100);
    expect(result.coverage).toBe(100);
    expect(result.possible).toBe(10);
  });

  it("withholds a score below the minimum coverage threshold", () => {
    const result = buildCategoryScore({
      checks: [
        check({ id: "measured", status: "pass", weight: 10 }),
        check({ id: "missing", status: "unavailable", weight: 30 }),
      ],
      explanation: "Fixture category.",
      missing: ["Headers were unavailable"],
    });
    expect(result.score).toBeNull();
    expect(result.grade).toBeNull();
    expect(result.coverage).toBe(25);
    expect(result.missing).toContain("Headers were unavailable");
    expect(result.missing).toContain("missing");
    expect(result.explanation).toContain("No numeric score is shown");
  });

  it("returns null when no weighted checks exist", () => {
    const result = buildCategoryScore({ checks: [], explanation: "Nothing measured." });
    expect(result.score).toBeNull();
    expect(result.coverage).toBe(0);
  });

  it.each([
    [100, "A"],
    [90, "A"],
    [89, "B"],
    [80, "B"],
    [70, "C"],
    [60, "D"],
    [50, "E"],
    [49, "F"],
    [0, "F"],
  ])("grades %i as %s", (score, grade) => {
    expect(gradeFor(score)).toBe(grade);
  });

  it("has no grade for a withheld score", () => {
    expect(gradeFor(null)).toBeNull();
  });
});

describe("classifyAISignals", () => {
  const base = {
    contradictions: [],
    builderFingerprintCount: 0,
    rulesEvaluated: 24,
    headersAvailable: true,
  };

  it("reports insufficient evidence when nothing was observed", () => {
    const result = classifyAISignals({ ...base, evidence: [] });
    expect(result.classification).toBe("insufficient");
    expect(result.signalScore).toBeNull();
    expect(result.confidence).toBe("low");
  });

  it("requires strong builder evidence for a strong classification", () => {
    const weakOnly = classifyAISignals({
      ...base,
      evidence: [
        evidence({ id: "pattern", category: "moderate_pattern", weight: 46, strength: "moderate" }),
      ],
    });
    expect(weakOnly.classification).toBe("moderate");
    expect(weakOnly.signalScore).toBe(46);

    const strong = classifyAISignals({
      ...base,
      builderFingerprintCount: 1,
      evidence: [
        evidence({ id: "builder", category: "strong_builder", weight: 46, strength: "strong" }),
      ],
    });
    expect(strong.classification).toBe("strong");
    expect(strong.signalScore).toBe(46);
  });

  it("applies the moderate and weak thresholds", () => {
    const moderate = classifyAISignals({
      ...base,
      evidence: [evidence({ id: "m", category: "weak_circumstantial", weight: 24 })],
    });
    expect(moderate.classification).toBe("moderate");

    const weak = classifyAISignals({
      ...base,
      evidence: [evidence({ id: "w", category: "weak_circumstantial", weight: 7 })],
    });
    expect(weak.classification).toBe("weak");

    const below = classifyAISignals({
      ...base,
      evidence: [evidence({ id: "b", category: "weak_circumstantial", weight: 6 })],
    });
    expect(below.classification).toBe("mixed");
  });

  it("halves contradictory weight and flags mixed evidence at 75%", () => {
    const result = classifyAISignals({
      ...base,
      evidence: [evidence({ id: "p", category: "moderate_pattern", weight: 40 })],
      contradictions: [evidence({ id: "c", category: "contradictory", weight: 30 })],
    });
    expect(result.signalScore).toBe(25);
    expect(result.classification).toBe("mixed");
  });

  it("caps confidence for single weak evidence", () => {
    const result = classifyAISignals({
      ...base,
      evidence: [evidence({ id: "one", category: "weak_circumstantial", weight: 8 })],
    });
    expect(result.confidenceScore).toBeLessThanOrEqual(34);
    expect(result.confidence).toBe("low");
  });

  it("labels the index as uncalibrated rather than a probability", () => {
    const summary = scoreAISignals({
      ...base,
      evidence: [evidence({ id: "builder", category: "strong_builder", weight: 50 })],
    });
    expect(summary.explanation).toContain("not a calibrated probability");
    expect(summary.explanation).toContain("not prove");
    expect(summary.methodology.join(" ")).toContain("not a probability");
    expect(summary.missing).toEqual([]);
  });

  it("records missing headers and evidence in snapshot mode", () => {
    const summary = scoreAISignals({ ...base, headersAvailable: false, evidence: [] });
    expect(summary.missing).toEqual([
      "Response headers (snapshot mode)",
      "Any positive AI-builder or source-pattern indicator",
    ]);
  });
});

describe("scoreTechnologyConfidence", () => {
  function tech(confidence: number, id = "t"): TechnologyDetection {
    return {
      id,
      name: id,
      category: "framework",
      confidence,
      description: "Fixture",
      evidence: [],
    };
  }

  it("returns an explicit no-detection result", () => {
    const result = scoreTechnologyConfidence([]);
    expect(result.score).toBeNull();
    expect(result.coverage).toBe(0);
    expect(result.label).toBe("No technologies detected");
  });

  it("averages confidence and reports coverage of confident detections", () => {
    const result = scoreTechnologyConfidence([tech(90, "a"), tech(50, "b"), tech(20, "c")]);
    expect(result.score).toBe(53);
    expect(result.coverage).toBe(67);
    expect(result.detectedCount).toBe(3);
    expect(result.label).toBe("Mixed confidence");
  });
});
