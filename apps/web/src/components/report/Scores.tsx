import { Link } from "react-router-dom";
import {
  Accessibility,
  ArrowUpRight,
  BookOpen,
  BrainCircuit,
  Gauge,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  TextSearch,
} from "lucide-react";
import type { CategoryScore, ScanReport } from "@vibetrace/shared-types";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Badge, Card, ScoreRing, scoreTone } from "@vibetrace/design-system";

function toneFor(score: number | null): "lime" | "amber" | "red" | "neutral" {
  const tone = scoreTone(score);
  if (tone === "excellent" || tone === "good") return "lime";
  if (tone === "fair") return "amber";
  if (tone === "poor") return "red";
  return "neutral";
}

export function ScoreGrid({ report }: { report: ScanReport }): React.ReactNode {
  const { scores } = report;
  const id = report.scan.id;
  const cells = [
    {
      label: "AI signals",
      score: scores.aiSignals.signalScore,
      caption: scores.aiSignals.classification.replace("_", " "),
      to: `/scan/${id}/ai`,
      icon: BrainCircuit,
    },
    {
      label: "Tech confidence",
      score: scores.technologyConfidence.score,
      caption: `${scores.technologyConfidence.detectedCount} detected`,
      to: `/scan/${id}/technology`,
      icon: ScanSearch,
    },
    {
      label: "Code quality",
      score: scores.codeQuality.score,
      caption: scores.codeQuality.grade ? `Grade ${scores.codeQuality.grade}` : "Insufficient data",
      to: `/scan/${id}/quality`,
      icon: Sparkles,
    },
    {
      label: "Security",
      score: scores.security.score,
      caption: `${Math.round(scores.security.coverage)}% coverage`,
      to: `/scan/${id}/security`,
      icon: ShieldCheck,
    },
    {
      label: "Performance",
      score: scores.performance.score,
      caption: `${Math.round(scores.performance.coverage)}% coverage`,
      to: `/scan/${id}/performance`,
      icon: Gauge,
    },
    {
      label: "Accessibility",
      score: scores.accessibility.score,
      caption: `${Math.round(scores.accessibility.coverage)}% coverage`,
      to: `/scan/${id}/quality#accessibility`,
      icon: Accessibility,
    },
    {
      label: "SEO",
      score: scores.seo.score,
      caption: scores.seo.grade ? `Grade ${scores.seo.grade}` : "Insufficient data",
      to: `/scan/${id}/quality#seo`,
      icon: TextSearch,
    },
  ];

  return (
    <div>
      <div className="score-grid">
        {cells.map((cell) => {
          const Icon = cell.icon;
          return (
            <Link
              key={cell.label}
              to={cell.to}
              className="score-cell"
              aria-label={`${cell.label}: ${cell.score === null ? "unavailable" : `${Math.round(cell.score)} out of 100`}. Open details.`}
              style={{ textDecoration: "none", position: "relative" }}
            >
              <Icon
                size={13}
                aria-hidden="true"
                style={{ position: "absolute", top: 12, right: 12, color: "var(--vt-text-faint)" }}
              />
              <ScoreRing value={cell.score} label={cell.label} size={92} />
              <Badge tone={toneFor(cell.score)} style={{ marginTop: 4 }}>
                {cell.caption}
              </Badge>
            </Link>
          );
        })}
        <Link
          to="/methodology"
          className="score-cell"
          aria-label="Read the scoring methodology"
          style={{ textDecoration: "none", color: "var(--vt-text-muted)" }}
        >
          <span
            aria-hidden="true"
            style={{
              display: "grid",
              placeItems: "center",
              width: 92,
              height: 92,
              borderRadius: 999,
              border: "1px dashed var(--vt-border-strong)",
              color: "var(--vt-lime)",
            }}
          >
            <BookOpen size={26} />
          </span>
          <span
            className="vt-mono"
            style={{
              marginTop: 10,
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Methodology
          </span>
          <span style={{ fontSize: 11 }}>Formulas & limits</span>
        </Link>
      </div>
      <p
        className="vt-mono"
        style={{
          margin: "9px 2px 0",
          fontSize: 9,
          color: "var(--vt-text-faint)",
          letterSpacing: "0.04em",
        }}
      >
        AI signal index is an evidence summary, not a probability. Unavailable categories are shown
        as “—” and never imputed.
      </p>
    </div>
  );
}

const RADAR_AXES = [
  { key: "codeQuality", label: "Quality" },
  { key: "security", label: "Security" },
  { key: "performance", label: "Performance" },
  { key: "accessibility", label: "Accessibility" },
  { key: "seo", label: "SEO" },
] as const;

export function ScoreRadar({ report }: { report: ScanReport }): React.ReactNode {
  const data = RADAR_AXES.map((axis) => {
    const section = report.scores[axis.key] as CategoryScore;
    return { axis: axis.label, score: section.score, id: axis.key };
  });
  const available = data.filter((item) => item.score !== null) as Array<{
    axis: string;
    score: number;
  }>;
  const missing = data.filter((item) => item.score === null);

  return (
    <Card>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "16px 18px 0",
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 650 }}>Signal profile</h3>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--vt-text-muted)" }}>
            Measured category scores only. No score is synthesized for missing data.
          </p>
        </div>
        <Badge>
          {available.length}/{data.length} measured
        </Badge>
      </div>
      {available.length >= 3 ? (
        <div style={{ height: 280, padding: "6px 6px 10px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={available} outerRadius="72%">
              <PolarGrid stroke="var(--vt-border)" />
              <PolarAngleAxis
                dataKey="axis"
                tick={{
                  fill: "var(--vt-text-muted)",
                  fontSize: 10,
                  fontFamily: "var(--vt-font-mono)",
                }}
              />
              <Radar
                name="Score"
                dataKey="score"
                stroke="var(--vt-lime)"
                fill="var(--vt-lime)"
                fillOpacity={0.16}
                strokeWidth={1.5}
                isAnimationActive={false}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--vt-panel-raised)",
                  border: "1px solid var(--vt-border-strong)",
                  borderRadius: 6,
                  fontSize: 12,
                  color: "var(--vt-text)",
                }}
                itemStyle={{ color: "var(--vt-lime)" }}
                labelStyle={{ color: "var(--vt-text)" }}
                formatter={(value) => [value == null ? "—" : `${value} / 100`, "Score"]}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div style={{ padding: "20px 18px 24px", color: "var(--vt-text-muted)", fontSize: 13 }}>
          Fewer than three categories had enough measurable checks for a profile. This is an
          availability limitation, not a score of zero.
        </div>
      )}
      {missing.length ? (
        <div style={{ padding: "0 18px 16px" }}>
          <span
            className="vt-mono"
            style={{
              fontSize: 9,
              letterSpacing: "0.1em",
              color: "var(--vt-text-faint)",
              textTransform: "uppercase",
            }}
          >
            Not measured
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
            {missing.map((item) => (
              <Badge key={item.id}>{item.axis}</Badge>
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

export function CategorySummaryCard({
  title,
  section,
  to,
  icon,
}: {
  title: string;
  section: CategoryScore;
  to: string;
  icon?: React.ReactNode;
}): React.ReactNode {
  return (
    <Card style={{ padding: "16px 18px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div
            style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--vt-text-muted)" }}
          >
            {icon}
            <span
              className="vt-mono"
              style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}
            >
              {title}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 6 }}>
            <span style={{ fontSize: 26, fontWeight: 650, lineHeight: 1 }}>
              {section.score === null ? "—" : Math.round(section.score)}
            </span>
            <span className="vt-mono" style={{ fontSize: 10, color: "var(--vt-text-faint)" }}>
              /100
            </span>
            {section.grade ? <Badge>{section.grade}</Badge> : null}
          </div>
        </div>
        <Badge tone={toneFor(section.score)}>{Math.round(section.coverage)}%</Badge>
      </div>
      <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--vt-text-muted)" }}>
        {section.explanation.split(". ").slice(-1)[0]}
      </p>
      <Link
        to={to}
        className="vt-mono"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          marginTop: 10,
          fontSize: 10,
          color: "var(--vt-lime)",
          textDecoration: "none",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        Inspect checks <ArrowUpRight size={11} aria-hidden="true" />
      </Link>
    </Card>
  );
}
