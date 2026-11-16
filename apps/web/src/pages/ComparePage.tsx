import { type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowLeftRight, GitCompareArrows } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ScanReport } from "@vibetrace/shared-types";
import { Badge, Button, Card, EmptyState, Skeleton } from "@vibetrace/design-system";
import { useReport, usePageTitle } from "../hooks/use-api.js";
import { ErrorPanel } from "../components/ErrorPanel.js";
import { formatDate, formatDuration } from "../lib/format.js";

const COMPARABLE = [
  { key: "aiSignals", label: "AI signal index" },
  { key: "technologyConfidence", label: "Technology confidence" },
  { key: "codeQuality", label: "Code quality" },
  { key: "security", label: "Security" },
  { key: "performance", label: "Performance" },
  { key: "accessibility", label: "Accessibility" },
  { key: "seo", label: "SEO" },
] as const;

function scoreOf(report: ScanReport, key: (typeof COMPARABLE)[number]["key"]): number | null {
  if (key === "aiSignals") return report.scores.aiSignals.signalScore;
  if (key === "technologyConfidence") return report.scores.technologyConfidence.score;
  return report.scores[key].score;
}

function Delta({ a, b }: { a: number | null; b: number | null }): ReactNode {
  if (a === null || b === null)
    return (
      <span className="vt-mono" style={{ fontSize: 10, color: "var(--vt-text-faint)" }}>
        —
      </span>
    );
  const delta = Math.round(b - a);
  if (delta === 0)
    return (
      <span className="vt-mono" style={{ fontSize: 10, color: "var(--vt-text-faint)" }}>
        0
      </span>
    );
  return (
    <span
      className="vt-mono"
      style={{
        fontSize: 10,
        fontWeight: 650,
        color: delta > 0 ? "var(--vt-lime)" : "var(--vt-red)",
      }}
    >
      {delta > 0 ? "+" : ""}
      {delta}
    </span>
  );
}

function CompareContent({ a, b }: { a: ScanReport; b: ScanReport }): ReactNode {
  const chartData = COMPARABLE.map((row) => ({
    name: row.label
      .replace("Technology confidence", "Tech confidence")
      .replace("AI signal index", "AI signals"),
    left: scoreOf(a, row.key),
    right: scoreOf(b, row.key),
  }));

  const techA = new Map(a.technologies.map((tech) => [tech.name, tech]));
  const techB = new Map(b.technologies.map((tech) => [tech.name, tech]));
  const common = [...techA.keys()].filter((name) => techB.has(name));
  const onlyA = [...techA.keys()].filter((name) => !techB.has(name));
  const onlyB = [...techB.keys()].filter((name) => !techA.has(name));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="grid gap-4 lg:grid-cols-2">
        {[a, b].map((report, index) => (
          <Card key={report.scan.id} raised style={{ padding: "16px 18px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <Badge tone={index === 0 ? "cyan" : "lime"}>{index === 0 ? "A" : "B"}</Badge>
              <span className="vt-mono" style={{ fontSize: 9, color: "var(--vt-text-faint)" }}>
                {report.scan.id.slice(0, 8)}
              </span>
            </div>
            <h2 style={{ margin: "8px 0 0", fontSize: 18, letterSpacing: "-0.02em" }}>
              {report.scan.domain}
            </h2>
            <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--vt-text-muted)" }}>
              {formatDate(report.scan.completedAt)}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
              <Badge tone={report.scan.status === "completed" ? "lime" : "amber"}>
                {report.scan.status.replace("_", " ")}
              </Badge>
              <Badge>{report.scan.mode}</Badge>
              <Badge>{formatDuration(report.scan.durationMs)}</Badge>
              <Badge>{report.technologies.length} tech</Badge>
            </div>
            <div style={{ marginTop: 10 }}>
              <span
                className="vt-mono"
                style={{
                  fontSize: 9,
                  letterSpacing: "0.08em",
                  color: "var(--vt-text-faint)",
                  textTransform: "uppercase",
                }}
              >
                AI classification
              </span>
              <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600 }}>{report.ai.label}</p>
              <p style={{ margin: "1px 0 0", fontSize: 10, color: "var(--vt-text-faint)" }}>
                {report.ai.signalScore === null
                  ? "no signal index"
                  : `index ${report.ai.signalScore}/100`}{" "}
                · confidence {report.ai.confidenceScore}%
              </p>
            </div>
            <Link
              to={`/scan/${report.scan.id}`}
              className="vt-button vt-button--secondary vt-button--sm"
              style={{ marginTop: 12 }}
            >
              Open report
            </Link>
          </Card>
        ))}
      </div>

      <Card>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "14px 18px",
            borderBottom: "1px solid var(--vt-border)",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 14 }}>Score comparison</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--vt-text-muted)" }}>
              Independent scales. A delta is descriptive, not a combined quality verdict.
            </p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <Badge tone="cyan">A · {a.scan.domain}</Badge>
            <Badge tone="lime">B · {b.scan.domain}</Badge>
          </div>
        </div>
        <div style={{ height: 300, padding: "12px 8px 6px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: -18 }}>
              <CartesianGrid stroke="var(--vt-border)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: "var(--vt-text-faint)", fontSize: 9 }}
                axisLine={{ stroke: "var(--vt-border)" }}
                tickLine={false}
                interval={0}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: "var(--vt-text-faint)", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--vt-panel-raised)",
                  border: "1px solid var(--vt-border-strong)",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                cursor={{ fill: "var(--vt-lime-glow)" }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar
                dataKey="left"
                name={a.scan.domain}
                fill="var(--vt-cyan)"
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
              <Bar
                dataKey="right"
                name={b.scan.domain}
                fill="var(--vt-lime)"
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="vt-scroll-x">
          <table className="vt-table" style={{ minWidth: 560 }}>
            <thead>
              <tr>
                <th>Signal</th>
                <th style={{ textAlign: "right" }}>A</th>
                <th style={{ textAlign: "right" }}>B</th>
                <th style={{ textAlign: "right" }}>Δ B−A</th>
              </tr>
            </thead>
            <tbody>
              {COMPARABLE.map((row) => {
                const left = scoreOf(a, row.key);
                const right = scoreOf(b, row.key);
                return (
                  <tr key={row.key}>
                    <td style={{ color: "var(--vt-text)" }}>{row.label}</td>
                    <td
                      className="vt-mono"
                      style={{
                        textAlign: "right",
                        color: left === null ? "var(--vt-text-faint)" : "var(--vt-cyan)",
                      }}
                    >
                      {left ?? "—"}
                    </td>
                    <td
                      className="vt-mono"
                      style={{
                        textAlign: "right",
                        color: right === null ? "var(--vt-text-faint)" : "var(--vt-lime)",
                      }}
                    >
                      {right ?? "—"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Delta a={left} b={right} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card style={{ padding: "16px 18px" }}>
          <h2 style={{ margin: 0, fontSize: 14 }}>Technology overlap</h2>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <div>
              <span
                className="vt-mono"
                style={{
                  fontSize: 9,
                  letterSpacing: "0.08em",
                  color: "var(--vt-text-faint)",
                  textTransform: "uppercase",
                }}
              >
                Common ({common.length})
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
                {common.length ? (
                  common.map((name) => (
                    <Badge key={name} tone="lime">
                      {name}
                    </Badge>
                  ))
                ) : (
                  <span style={{ fontSize: 11, color: "var(--vt-text-faint)" }}>None</span>
                )}
              </div>
            </div>
            <div>
              <span
                className="vt-mono"
                style={{
                  fontSize: 9,
                  letterSpacing: "0.08em",
                  color: "var(--vt-text-faint)",
                  textTransform: "uppercase",
                }}
              >
                Only A ({onlyA.length})
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
                {onlyA.length ? (
                  onlyA.map((name) => (
                    <Badge key={name} tone="cyan">
                      {name}
                    </Badge>
                  ))
                ) : (
                  <span style={{ fontSize: 11, color: "var(--vt-text-faint)" }}>None</span>
                )}
              </div>
            </div>
            <div>
              <span
                className="vt-mono"
                style={{
                  fontSize: 9,
                  letterSpacing: "0.08em",
                  color: "var(--vt-text-faint)",
                  textTransform: "uppercase",
                }}
              >
                Only B ({onlyB.length})
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
                {onlyB.length ? (
                  onlyB.map((name) => (
                    <Badge key={name} tone="lime">
                      {name}
                    </Badge>
                  ))
                ) : (
                  <span style={{ fontSize: 11, color: "var(--vt-text-faint)" }}>None</span>
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card style={{ padding: "16px 18px" }}>
          <h2 style={{ margin: 0, fontSize: 14 }}>Report completeness</h2>
          <div className="vt-scroll-x">
            <table className="vt-table" style={{ minWidth: 360, marginTop: 6 }}>
              <thead>
                <tr>
                  <th>Measure</th>
                  <th style={{ textAlign: "right" }}>A</th>
                  <th style={{ textAlign: "right" }}>B</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Technologies detected</td>
                  <td style={{ textAlign: "right" }}>{a.technologies.length}</td>
                  <td style={{ textAlign: "right" }}>{b.technologies.length}</td>
                </tr>
                <tr>
                  <td>Recommendations</td>
                  <td style={{ textAlign: "right" }}>{a.recommendations.length}</td>
                  <td style={{ textAlign: "right" }}>{b.recommendations.length}</td>
                </tr>
                <tr>
                  <td>Recorded limitations</td>
                  <td style={{ textAlign: "right" }}>{a.limitations.length}</td>
                  <td style={{ textAlign: "right" }}>{b.limitations.length}</td>
                </tr>
                <tr>
                  <td>AI evidence items</td>
                  <td style={{ textAlign: "right" }}>{a.ai.evidence.length}</td>
                  <td style={{ textAlign: "right" }}>{b.ai.evidence.length}</td>
                </tr>
                <tr>
                  <td>HTTP status</td>
                  <td style={{ textAlign: "right" }}>{a.scan.httpStatus ?? "—"}</td>
                  <td style={{ textAlign: "right" }}>{b.scan.httpStatus ?? "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 10, color: "var(--vt-text-faint)" }}>
            Comparisons do not normalize for page purpose, traffic, hosting region, or time. Treat
            deltas as descriptive observations, not rankings.
          </p>
        </Card>
      </div>
    </div>
  );
}

export function ComparePage(): ReactNode {
  usePageTitle("Compare scans");
  const [params, setParams] = useSearchParams();
  const aId = params.get("a") ?? undefined;
  const bId = params.get("b") ?? undefined;
  const first = useReport(aId);
  const second = useReport(bId);

  const swap = () => {
    const next = new URLSearchParams(params);
    next.set("a", bId ?? "");
    next.set("b", aId ?? "");
    setParams(next);
  };

  if (!aId || !bId) {
    return (
      <div>
        <Link
          to="/history"
          className="vt-button vt-button--ghost vt-button--sm"
          style={{ marginBottom: 14 }}
        >
          <ArrowLeft size={14} aria-hidden="true" /> History
        </Link>
        <Card>
          <EmptyState
            icon={<GitCompareArrows size={18} />}
            title="Choose two scans to compare"
            description="Select two completed scans from History. The comparison reads both stored reports; nothing is recomputed."
            action={
              <Link to="/history" className="vt-button vt-button--primary vt-button--sm">
                Open scan history
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const loading = first.loading || second.loading;
  const error = first.error || second.error;

  return (
    <div>
      <div
        className="no-print"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <div>
          <Link
            to="/history"
            className="vt-mono"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 10,
              color: "var(--vt-text-faint)",
              textDecoration: "none",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            <ArrowLeft size={11} aria-hidden="true" /> Back to history
          </Link>
          <h1
            style={{
              margin: "7px 0 0",
              fontSize: "clamp(24px, 4vw, 34px)",
              letterSpacing: "-0.04em",
            }}
          >
            Compare scans
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--vt-text-muted)" }}>
            Stored reports, side by side. Scores are not merged into a single verdict.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={swap}>
          <ArrowLeftRight size={14} aria-hidden="true" /> Swap A / B
        </Button>
      </div>

      {loading ? (
        <div style={{ display: "grid", gap: 12 }} aria-busy="true">
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton width="100%" height={180} />
            <Skeleton width="100%" height={180} />
          </div>
          <Skeleton width="100%" height={360} />
        </div>
      ) : error ? (
        <ErrorPanel
          error={error}
          onRetry={() => {
            first.refresh();
            second.refresh();
          }}
          title="Unable to load one or both reports"
        />
      ) : first.report && second.report ? (
        <CompareContent a={first.report} b={second.report} />
      ) : (
        <Card>
          <EmptyState
            title="One of these scans has no report"
            description="Only completed or partially completed scans can be compared."
            action={
              <Link to="/history" className="vt-button vt-button--secondary vt-button--sm">
                Choose different scans
              </Link>
            }
          />
        </Card>
      )}
    </div>
  );
}
