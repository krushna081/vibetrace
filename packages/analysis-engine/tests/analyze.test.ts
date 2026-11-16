import { describe, expect, it, vi } from "vitest";
import { ScanReportSchema } from "@vibetrace/shared-types";
import { analyzeWebsite, buildSnapshotHtml, mergeSnapshotFacts } from "../src/index.js";
import { extractDocumentFacts } from "../src/document.js";
import { buildFixtureSnapshot } from "./fixtures.js";

const createdAt = "2026-11-15T12:00:00.000Z";

function analyzeFixture() {
  const snapshot = buildFixtureSnapshot();
  return analyzeWebsite(
    {
      scanId: "11111111-1111-4111-8111-111111111111",
      url: snapshot.url,
      mode: "snapshot",
      client: "extension",
      snapshot,
      createdAt,
    },
    {
      enableProbes: false,
      now: () => new Date("2026-11-15T12:00:05.000Z"),
    },
  );
}

describe("snapshot analysis pipeline", () => {
  it("produces a schema-valid report without making network requests", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("snapshot mode must not fetch");
    });
    const snapshot = buildFixtureSnapshot();
    const report = await analyzeWebsite(
      {
        scanId: "22222222-2222-4222-8222-222222222222",
        url: snapshot.url,
        mode: "snapshot",
        client: "extension",
        snapshot,
        createdAt,
      },
      {
        enableProbes: false,
        fetchImpl,
        now: () => new Date("2026-11-15T12:00:05.000Z"),
        progress: () => undefined,
      },
    );
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(ScanReportSchema.safeParse(report).success).toBe(true);
    expect(report.scan.mode).toBe("snapshot");
    expect(report.scan.client).toBe("extension");
    expect(report.scan.status).toBe("completed");
    expect(report.overview.title).toBe("Atlas Workspace — AI product console");
    expect(report.source.htmlBytes).toBeGreaterThan(0);
    expect(report.technologies.length).toBeGreaterThan(0);
  });

  it("classifies strong Lovable evidence without calling it a probability", async () => {
    const report = await analyzeFixture();
    expect(report.ai.classification).toBe("strong");
    expect(report.ai.label.toLowerCase()).toContain("strong");
    expect(report.ai.signalScore).toBeGreaterThanOrEqual(40);
    expect(report.ai.builderFingerprints.some((item) => item.name === "Lovable")).toBe(true);
    expect(report.ai.evidence.some((item) => /lovable/i.test(item.title))).toBe(true);
    expect(report.scores.aiSignals.explanation).toContain("not a calibrated probability");
    expect(report.scores.aiSignals.explanation).not.toMatch(/\d+% (chance|probability)/i);
  });

  it("keeps category scores independent and evidence-linked", async () => {
    const report = await analyzeFixture();
    const categories = [
      report.scores.security,
      report.scores.performance,
      report.scores.accessibility,
      report.scores.seo,
      report.scores.codeQuality,
    ];
    for (const category of categories) {
      expect(category.checks.length).toBeGreaterThan(0);
      expect(category.coverage).toBeGreaterThanOrEqual(0);
      expect(category.coverage).toBeLessThanOrEqual(100);
      expect(category.score === null || (category.score >= 0 && category.score <= 100)).toBe(true);
      expect(category.methodology.length).toBeGreaterThan(0);
      for (const check of category.checks) {
        expect(check.basis === "measured" || check.basis === "heuristic").toBe(true);
        expect(Array.isArray(check.evidence)).toBe(true);
      }
    }
    expect(report.overview.keyFindings.length).toBeGreaterThan(0);
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(report.limitations.length).toBeGreaterThan(0);
  });

  it("does not expose sanitized HTML, script bodies or fixture-only secrets in the report", async () => {
    const snapshot = buildFixtureSnapshot({
      html:
        buildFixtureSnapshot().html + '<div data-fixture-secret="SHOULD_NOT_SURVIVE">hidden</div>',
    });
    const report = await analyzeWebsite(
      {
        scanId: "33333333-3333-4333-8333-333333333333",
        url: snapshot.url,
        mode: "snapshot",
        client: "extension",
        snapshot,
        createdAt,
      },
      { enableProbes: false, now: () => new Date("2026-11-15T12:00:05.000Z") },
    );
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain("SHOULD_NOT_SURVIVE");
    expect(serialized).not.toContain("<main>");
    expect(serialized).not.toContain("window.__NEXT_DATA__");
    expect(report.source).not.toHaveProperty("html");
    expect(report.source).not.toHaveProperty("inlineScriptSamples");
  });

  it("emits monotonic progress stages", async () => {
    const stages: Array<{ stage: string; percent: number }> = [];
    const snapshot = buildFixtureSnapshot();
    await analyzeWebsite(
      {
        scanId: "44444444-4444-4444-8444-444444444444",
        url: snapshot.url,
        mode: "snapshot",
        client: "extension",
        snapshot,
        createdAt,
      },
      {
        enableProbes: false,
        now: () => new Date("2026-11-15T12:00:05.000Z"),
        progress: (stage, percent) => stages.push({ stage, percent }),
      },
    );
    expect(stages.length).toBeGreaterThan(3);
    expect(stages[0]?.stage).toContain("Inspecting snapshot");
    expect(stages.at(-1)?.percent).toBe(100);
    for (let index = 1; index < stages.length; index += 1) {
      expect(stages[index]!.percent).toBeGreaterThanOrEqual(stages[index - 1]!.percent);
    }
  });
});

describe("snapshot normalization", () => {
  it("rebuilds a parseable document and merges structured facts", () => {
    const snapshot = buildFixtureSnapshot();
    const html = buildSnapshotHtml(snapshot);
    expect(html).toContain("<title>");
    expect(html).toContain('name="generator"');
    expect(html).toContain("Atlas Workspace");
    const facts = extractDocumentFacts(html, snapshot.url);
    mergeSnapshotFacts(facts, snapshot);
    expect(facts.title).toContain("Atlas");
    expect(facts.scriptFacts.some((script) => script.src?.includes("app.js"))).toBe(true);
    expect(facts.headings.map((heading) => heading.level)).toEqual([1, 2]);
    expect(facts.images[0]?.alt).toBe("Atlas dashboard preview");
    expect(facts.inputs.filter((control) => control.hasLabel)).toHaveLength(2);
    expect(facts.inlineScriptSamples.length).toBeGreaterThan(0);
    expect(facts.externalDomains).toContain("cdn.fixture.example");
  });

  it("omits active content and does not inject script bodies", () => {
    const snapshot = buildFixtureSnapshot({
      html: '<div onclick="steal()" style="background:url(//evil.example)">hello</div><script>alert(1)</script><iframe src="https://evil.example"></iframe><a href="javascript:alert(1)">unsafe</a><form action="data:text/html,steal"><button formaction="vbscript:steal">Go</button></form>',
    });
    const html = buildSnapshotHtml(snapshot);
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("style=");
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("data:text/html");
    expect(html).not.toContain("vbscript:");
  });
});
