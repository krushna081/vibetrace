import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Accessibility, Code2, FileWarning, Sparkles, TextSearch } from "lucide-react";
import type { ScanReport, SectionReport } from "@vibetrace/shared-types";
import { Badge, Card } from "@vibetrace/design-system";
import { ReportGate, ReportSectionIntro } from "../components/report/ReportFrame.js";
import { CheckList, SectionMethodology } from "../components/report/CheckList.js";
import { MetricGrid, RecommendationList } from "../components/report/Metrics.js";
import { formatNumber } from "../lib/format.js";

const ANCHORS = [
  { id: "quality", label: "Code quality" },
  { id: "accessibility", label: "Accessibility" },
  { id: "seo", label: "SEO" },
] as const;

function CategoryBlock({
  id,
  eyebrow,
  title,
  section,
  icon,
  recommendations,
}: {
  id: string;
  eyebrow: string;
  title: string;
  section: SectionReport;
  icon: ReactNode;
  recommendations: ScanReport["recommendations"];
}): ReactNode {
  return (
    <section id={id} style={{ display: "grid", gap: 12, scrollMarginTop: 90 }}>
      <ReportSectionIntro
        eyebrow={eyebrow}
        title={title}
        description={section.summary}
        score={section.score.score}
        coverage={section.score.coverage}
        grade={section.score.grade}
        icon={icon}
      />
      <MetricGrid metrics={section.metrics} />
      <CheckList section={section} showFilters />
      <SectionMethodology section={section} />
      {recommendations.length ? (
        <div>
          <h3 style={{ margin: "4px 0 8px", fontSize: 14 }}>Recommendations</h3>
          <RecommendationList items={recommendations} />
        </div>
      ) : null}
    </section>
  );
}

export function QualityPage(): ReactNode {
  const [active, setActive] = useState<string>("quality");
  return (
    <ReportGate page="Quality & SEO">
      {(report) => {
        const quality = report.sections.codeQuality;
        const accessibility = report.sections.accessibility;
        const seo = report.sections.seo;
        const recommendations = report.recommendations;
        return (
          <div style={{ display: "grid", gap: 18 }}>
            <Card raised style={{ padding: "clamp(18px, 4vw, 26px)" }}>
              <span className="vt-eyebrow">
                <Sparkles size={12} aria-hidden="true" /> Structure, accessibility & discoverability
              </span>
              <h2
                style={{
                  margin: "9px 0 0",
                  fontSize: "clamp(22px, 3.6vw, 31px)",
                  letterSpacing: "-0.035em",
                }}
              >
                Three independent audits. No composite grade.
              </h2>
              <p
                style={{
                  margin: "7px 0 0",
                  maxWidth: 760,
                  fontSize: 13,
                  color: "var(--vt-text-muted)",
                }}
              >
                Code structure, accessibility markup and SEO metadata answer different questions.
                VibeTrace reports each separately so a strong SEO score cannot mask inaccessible
                markup, or vice versa.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {[
                  { label: "Code quality", score: report.scores.codeQuality, icon: Code2 },
                  {
                    label: "Accessibility",
                    score: report.scores.accessibility,
                    icon: Accessibility,
                  },
                  { label: "SEO", score: report.scores.seo, icon: TextSearch },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      style={{
                        padding: "10px 12px",
                        border: "1px solid var(--vt-border)",
                        borderRadius: 7,
                        background: "var(--vt-black)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <span
                          className="vt-mono"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            fontSize: 9,
                            letterSpacing: "0.08em",
                            color: "var(--vt-text-faint)",
                            textTransform: "uppercase",
                          }}
                        >
                          <Icon size={11} aria-hidden="true" /> {item.label}
                        </span>
                        <Badge
                          tone={
                            item.score.score === null
                              ? "neutral"
                              : item.score.score >= 75
                                ? "lime"
                                : item.score.score >= 50
                                  ? "amber"
                                  : "red"
                          }
                        >
                          {item.score.score === null ? "—" : Math.round(item.score.score)}
                        </Badge>
                      </div>
                      <div style={{ marginTop: 6, fontSize: 18, fontWeight: 650 }}>
                        {item.score.score === null
                          ? "Insufficient data"
                          : `${item.score.grade} · ${Math.round(item.score.coverage)}% coverage`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <div
              className="vt-scroll-x no-print"
              style={{
                display: "flex",
                gap: 6,
                padding: 5,
                border: "1px solid var(--vt-border)",
                borderRadius: 8,
                background: "var(--vt-panel)",
                width: "fit-content",
                maxWidth: "100%",
              }}
            >
              {ANCHORS.map((anchor) => (
                <a
                  key={anchor.id}
                  href={`#${anchor.id}`}
                  onClick={() => setActive(anchor.id)}
                  className="vt-mono"
                  style={{
                    padding: "6px 10px",
                    borderRadius: 5,
                    textDecoration: "none",
                    fontSize: 10,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    background: active === anchor.id ? "var(--vt-lime)" : "transparent",
                    color: active === anchor.id ? "#080908" : "var(--vt-text-muted)",
                  }}
                >
                  {anchor.label}
                </a>
              ))}
            </div>

            <CategoryBlock
              id="quality"
              eyebrow="Code quality"
              title="Structure and maintainability signals"
              section={quality}
              icon={<Code2 size={12} aria-hidden="true" />}
              recommendations={recommendations.filter((item) => item.area === "quality")}
            />

            <Card style={{ padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <FileWarning size={14} style={{ color: "var(--vt-amber)" }} aria-hidden="true" />
                <h2 style={{ margin: 0, fontSize: 13 }}>
                  Structural observations from the source profile
                </h2>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ["DOM nodes", formatNumber(report.source.nodeCount)],
                  ["Max depth", String(report.source.maxDepth)],
                  ["Duplicate IDs", String(report.source.duplicateIds)],
                  ["HTML comments", String(report.source.comments)],
                  ["Inline scripts", String(report.source.inlineScriptCount)],
                  ["External scripts", String(report.source.externalScriptCount)],
                  ["Source maps", String(report.source.sourceMaps.length)],
                  ["Repeated structures", String(report.source.repeatedStructures.length)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      padding: "8px 10px",
                      border: "1px solid var(--vt-border)",
                      borderRadius: 6,
                      background: "var(--vt-black)",
                    }}
                  >
                    <div
                      className="vt-mono"
                      style={{
                        fontSize: 8,
                        letterSpacing: "0.08em",
                        color: "var(--vt-text-faint)",
                        textTransform: "uppercase",
                      }}
                    >
                      {label}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 15, fontWeight: 650 }}>{value}</div>
                  </div>
                ))}
              </div>
              {report.source.repeatedStructures.length ? (
                <div style={{ marginTop: 12 }}>
                  <span
                    className="vt-mono"
                    style={{
                      fontSize: 9,
                      letterSpacing: "0.1em",
                      color: "var(--vt-text-faint)",
                      textTransform: "uppercase",
                    }}
                  >
                    Repeated structural signatures (heuristic)
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
                    {report.source.repeatedStructures.slice(0, 8).map((item) => (
                      <Badge key={item.signature} title={item.signature}>
                        {item.signature.slice(0, 28)} × {item.count}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
              <p
                className="mt-3"
                style={{ margin: "10px 0 0", fontSize: 10, color: "var(--vt-text-faint)" }}
              >
                Structural repetition may indicate templated or generated markup, but it is not
                evidence of AI authorship. Raw HTML and full inline scripts are excluded from
                reports.
              </p>
            </Card>

            <CategoryBlock
              id="accessibility"
              eyebrow="Accessibility markup"
              title="Detectable markup issues"
              section={accessibility}
              icon={<Accessibility size={12} aria-hidden="true" />}
              recommendations={recommendations.filter((item) => item.area === "accessibility")}
            />

            <CategoryBlock
              id="seo"
              eyebrow="SEO foundations"
              title="Metadata and crawl hints"
              section={seo}
              icon={<TextSearch size={12} aria-hidden="true" />}
              recommendations={recommendations.filter((item) => item.area === "seo")}
            />

            <p
              className="vt-mono"
              style={{
                margin: 0,
                fontSize: 9,
                color: "var(--vt-text-faint)",
                letterSpacing: "0.04em",
              }}
            >
              Automated checks cannot establish keyboard operability, screen-reader behavior or
              visual contrast with full confidence. Read the{" "}
              <Link to="/methodology#accessibility" style={{ color: "var(--vt-lime)" }}>
                accessibility
              </Link>{" "}
              and{" "}
              <Link to="/methodology#seo" style={{ color: "var(--vt-lime)" }}>
                SEO
              </Link>{" "}
              methodology.
            </p>
          </div>
        );
      }}
    </ReportGate>
  );
}
