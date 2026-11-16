import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Fingerprint, Layers3, ScanSearch, ServerCog } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ScanReport, TechnologyCategory } from "@vibetrace/shared-types";
import { Badge, Card, EmptyState, ScoreRing } from "@vibetrace/design-system";
import { ReportGate } from "../components/report/ReportFrame.js";
import { EvidenceCard } from "../components/report/Metrics.js";
import { formatBytes, formatNumber, titleCase } from "../lib/format.js";

export function TechnologyPage(): ReactNode {
  return (
    <ReportGate page="Technology intelligence">
      {(report) => <TechnologyContent report={report} />}
    </ReportGate>
  );
}

function TechnologyContent({ report }: { report: ScanReport }): ReactNode {
  const confidence = report.scores.technologyConfidence;
  const [category, setCategory] = useState<"all" | TechnologyCategory>("all");
  const categories = useMemo(() => {
    const counts = new Map<TechnologyCategory, number>();
    for (const tech of report.technologies) {
      counts.set(tech.category, (counts.get(tech.category) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [report.technologies]);

  const visible = [...report.technologies]
    .filter((tech) => category === "all" || tech.category === category)
    .sort((a, b) => b.confidence - a.confidence);

  const chartData = [...report.technologies]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10)
    .map((tech) => ({ name: tech.name, confidence: tech.confidence }));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card raised style={{ padding: "clamp(18px, 4vw, 26px)" }}>
        <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
          <div style={{ justifySelf: "center" }}>
            <ScoreRing
              value={confidence.score}
              label="Tech confidence"
              caption="detection certainty"
              size={124}
            />
          </div>
          <div>
            <span className="vt-eyebrow">
              <ScanSearch size={12} aria-hidden="true" /> Technology intelligence
            </span>
            <h2
              style={{
                margin: "9px 0 0",
                fontSize: "clamp(21px, 3.4vw, 29px)",
                letterSpacing: "-0.03em",
              }}
            >
              {confidence.detectedCount} technolog{confidence.detectedCount === 1 ? "y" : "ies"}{" "}
              detected
            </h2>
            <p style={{ margin: "7px 0 0", color: "var(--vt-text-muted)", fontSize: 13 }}>
              {confidence.explanation}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              <Badge
                tone={
                  confidence.score === null ? "neutral" : confidence.score >= 70 ? "lime" : "amber"
                }
              >
                {confidence.label}
              </Badge>
              <Badge>{confidence.coverage}% at ≥50 confidence</Badge>
              <Badge>
                {report.technologies.reduce((sum, tech) => sum + tech.evidence.length, 0)} evidence
                items
              </Badge>
            </div>
          </div>
          <div
            className="vt-terminal"
            style={{ padding: "12px 14px", fontSize: 10, minWidth: 210 }}
          >
            <div
              style={{
                color: "var(--vt-text-faint)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontSize: 9,
              }}
            >
              Not a quality ranking
            </div>
            <p
              style={{
                margin: "6px 0 0",
                color: "var(--vt-text-muted)",
                fontFamily: "var(--vt-font-sans)",
                fontSize: 11,
              }}
            >
              Confidence measures certainty of detection, not whether a stack is modern, secure, or
              well chosen.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--vt-border)" }}>
            <h2 style={{ margin: 0, fontSize: 14 }}>Detection confidence</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--vt-text-muted)" }}>
              Top 10 detections by evidence-weighted confidence.
            </p>
          </div>
          {chartData.length ? (
            <div
              style={{
                height: Math.max(220, chartData.length * 34 + 40),
                padding: "12px 8px 10px",
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 0, right: 20, bottom: 0, left: 6 }}
                >
                  <CartesianGrid horizontal={false} stroke="var(--vt-border)" />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fill: "var(--vt-text-faint)", fontSize: 9 }}
                    axisLine={{ stroke: "var(--vt-border)" }}
                    tickLine={false}
                    unit="%"
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={{ fill: "var(--vt-text-muted)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--vt-lime-glow)" }}
                    contentStyle={{
                      background: "var(--vt-panel-raised)",
                      border: "1px solid var(--vt-border-strong)",
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                    formatter={(value) => [value == null ? "—" : `${value}%`, "Confidence"]}
                  />
                  <Bar
                    dataKey="confidence"
                    fill="var(--vt-lime)"
                    radius={[0, 3, 3, 0]}
                    barSize={14}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              title="No technology chart"
              description="No detection crossed the confidence threshold."
            />
          )}
        </Card>

        <Card style={{ padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <Layers3 size={14} style={{ color: "var(--vt-lime)" }} aria-hidden="true" />
            <h2 style={{ margin: 0, fontSize: 13 }}>Detection coverage</h2>
          </div>
          <p style={{ margin: "6px 0 10px", fontSize: 12, color: "var(--vt-text-muted)" }}>
            {confidence.methodology[1] ?? confidence.methodology[0]}
          </p>
          <div
            style={{ display: "flex", flexWrap: "wrap", gap: 5 }}
            role="group"
            aria-label="Filter technologies by category"
          >
            <button
              type="button"
              onClick={() => setCategory("all")}
              aria-pressed={category === "all"}
              className="vt-badge"
              style={{
                cursor: "pointer",
                borderColor: category === "all" ? "var(--vt-lime)" : undefined,
                color: category === "all" ? "var(--vt-lime)" : undefined,
              }}
            >
              All {report.technologies.length}
            </button>
            {categories.map(([name, count]) => (
              <button
                key={name}
                type="button"
                onClick={() => setCategory(name)}
                aria-pressed={category === name}
                className="vt-badge"
                style={{
                  cursor: "pointer",
                  borderColor: category === name ? "var(--vt-lime)" : undefined,
                  color: category === name ? "var(--vt-lime)" : undefined,
                }}
              >
                {titleCase(name)} {count}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--vt-border)" }}>
            <span
              className="vt-mono"
              style={{
                fontSize: 9,
                letterSpacing: "0.1em",
                color: "var(--vt-text-faint)",
                textTransform: "uppercase",
              }}
            >
              Missing evidence
            </span>
            <ul
              style={{
                margin: "5px 0 0",
                paddingLeft: 16,
                fontSize: 11,
                color: "var(--vt-text-muted)",
              }}
            >
              {confidence.missing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 8,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 15 }}>Detected technologies</h2>
          <span
            className="vt-mono"
            style={{ fontSize: 9, letterSpacing: "0.08em", color: "var(--vt-text-faint)" }}
          >
            {visible.length} SHOWN
          </span>
        </div>
        {visible.length ? (
          <div style={{ display: "grid", gap: 10 }}>
            {visible.map((tech) => (
              <Card key={tech.id} style={{ padding: "15px 17px" }}>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 7 }}
                    >
                      <h3 style={{ margin: 0, fontSize: 15 }}>{tech.name}</h3>
                      {tech.version ? <Badge tone="cyan">v{tech.version}</Badge> : null}
                      <Badge>{titleCase(tech.category)}</Badge>
                    </div>
                    <p
                      style={{
                        margin: "5px 0 0",
                        fontSize: 12,
                        color: "var(--vt-text-muted)",
                        maxWidth: 760,
                      }}
                    >
                      {tech.description}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", minWidth: 100 }}>
                    <div
                      className="vt-mono"
                      style={{
                        fontSize: 20,
                        fontWeight: 650,
                        color:
                          tech.confidence >= 70
                            ? "var(--vt-lime)"
                            : tech.confidence >= 45
                              ? "var(--vt-amber)"
                              : "var(--vt-text-muted)",
                      }}
                    >
                      {tech.confidence}%
                    </div>
                    <div
                      className="vt-mono"
                      style={{
                        fontSize: 8,
                        letterSpacing: "0.08em",
                        color: "var(--vt-text-faint)",
                        textTransform: "uppercase",
                      }}
                    >
                      confidence
                    </div>
                  </div>
                </div>
                <details style={{ marginTop: 10 }}>
                  <summary style={{ cursor: "pointer", fontSize: 11, color: "var(--vt-lime)" }}>
                    {tech.evidence.length} evidence item{tech.evidence.length === 1 ? "" : "s"}
                  </summary>
                  <div className="evidence-grid" style={{ marginTop: 8 }}>
                    {tech.evidence.map((item) => (
                      <EvidenceCard key={item.id} evidence={item} />
                    ))}
                  </div>
                </details>
                {tech.website ? (
                  <a
                    href={tech.website}
                    target="_blank"
                    rel="noreferrer"
                    className="vt-mono"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 3,
                      marginTop: 8,
                      fontSize: 9,
                      color: "var(--vt-text-faint)",
                      textDecoration: "none",
                      letterSpacing: "0.04em",
                    }}
                  >
                    vendor / project <ArrowUpRight size={10} aria-hidden="true" />
                  </a>
                ) : null}
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState
              icon={<ScanSearch size={18} />}
              title="No technologies in this category"
              description="Confidence thresholds are conservative; absence is not proof the technology is unused."
            />
          </Card>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card style={{ padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <ServerCog size={14} style={{ color: "var(--vt-cyan)" }} aria-hidden="true" />
            <h2 style={{ margin: 0, fontSize: 13 }}>Source & infrastructure facts</h2>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "2px 14px",
              marginTop: 8,
            }}
          >
            {[
              ["Generator meta", report.source.metaGenerator ?? "not declared"],
              ["Server header", report.scan.server ?? "not disclosed"],
              [
                "HTML",
                `${formatBytes(report.source.htmlBytes)}${report.source.htmlTruncated ? " (truncated)" : ""}`,
              ],
              ["DOM nodes", formatNumber(report.source.nodeCount)],
              [
                "Scripts",
                `${report.source.scriptCount} (${report.source.inlineScriptCount} inline)`,
              ],
              ["Stylesheets", String(report.source.stylesheetCount)],
              ["Images", String(report.source.imageCount)],
              ["Source maps", String(report.source.sourceMaps.length)],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  padding: "6px 0",
                  borderBottom: "1px solid var(--vt-border)",
                  fontSize: 11,
                }}
              >
                <div style={{ color: "var(--vt-text-faint)", fontSize: 10 }}>{label}</div>
                <div style={{ marginTop: 2, color: "var(--vt-text)", wordBreak: "break-word" }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card style={{ padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <Fingerprint size={14} style={{ color: "var(--vt-lime)" }} aria-hidden="true" />
            <h2 style={{ margin: 0, fontSize: 13 }}>Builder fingerprints</h2>
          </div>
          {report.ai.builderFingerprints.length ? (
            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              {report.ai.builderFingerprints.map((item) => (
                <div
                  key={item.id}
                  style={{ paddingBottom: 8, borderBottom: "1px solid var(--vt-border)" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 650 }}>{item.name}</span>
                    <Badge>{item.confidence}%</Badge>
                  </div>
                  <p style={{ margin: "3px 0 0", fontSize: 10, color: "var(--vt-text-faint)" }}>
                    {item.caveat}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--vt-text-muted)" }}>
              No builder marker was observed. General frameworks are not builder fingerprints.
            </p>
          )}
          <p style={{ margin: "10px 0 0", fontSize: 10, color: "var(--vt-text-faint)" }}>
            Published-tool fingerprints describe likely tooling, not code authorship. See the{" "}
            <Link to="/methodology#technology" style={{ color: "var(--vt-lime)" }}>
              registry methodology
            </Link>
            .
          </p>
        </Card>
      </div>

      <Card style={{ padding: "0" }}>
        <details>
          <summary
            style={{ padding: "14px 18px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
          >
            <ScanSearch
              size={14}
              style={{ display: "inline", marginRight: 7, color: "var(--vt-lime)" }}
              aria-hidden="true"
            />
            Confidence methodology & missing data
          </summary>
          <div style={{ padding: "0 18px 16px", color: "var(--vt-text-muted)", fontSize: 12 }}>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {confidence.methodology.map((item) => (
                <li key={item} style={{ marginBottom: 5 }}>
                  {item}
                </li>
              ))}
            </ul>
            <p style={{ margin: "8px 0 0" }}>
              Registry metadata is available from{" "}
              <code className="vt-mono">GET /api/v1/technologies</code>. Detection rules are modular
              and versioned with the engine.
            </p>
          </div>
        </details>
      </Card>
    </div>
  );
}
