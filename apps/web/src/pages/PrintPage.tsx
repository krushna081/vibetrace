import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import type { CategoryScore, ScanReport, SectionReport } from "@vibetrace/shared-types";
import { Badge, Button } from "@vibetrace/design-system";
import { usePageTitle, useReport } from "../hooks/use-api.js";
import { ErrorPanel } from "../components/ErrorPanel.js";
import { formatDate, formatDuration } from "../lib/format.js";

function PrintScoreTable({ scores }: { scores: ScanReport["scores"] }): React.ReactNode {
  const rows: Array<[string, number | null, string]> = [
    [
      "AI signal index",
      scores.aiSignals.signalScore,
      `${scores.aiSignals.label} · not a probability`,
    ],
    ["Technology confidence", scores.technologyConfidence.score, scores.technologyConfidence.label],
    ["Code quality", scores.codeQuality.score, scores.codeQuality.grade ?? "insufficient data"],
    ["Security", scores.security.score, scores.security.grade ?? "insufficient data"],
    ["Performance", scores.performance.score, scores.performance.grade ?? "insufficient data"],
    [
      "Accessibility",
      scores.accessibility.score,
      scores.accessibility.grade ?? "insufficient data",
    ],
    ["SEO", scores.seo.score, scores.seo.grade ?? "insufficient data"],
  ];
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, marginTop: 6 }}>
      <thead>
        <tr>
          <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 4 }}>Signal</th>
          <th style={{ textAlign: "right", borderBottom: "1px solid #ccc", padding: 4 }}>Score</th>
          <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 4 }}>
            Interpretation
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, score, note]) => (
          <tr key={label}>
            <td style={{ padding: 4, borderBottom: "1px solid #eee" }}>{label}</td>
            <td
              style={{
                padding: 4,
                borderBottom: "1px solid #eee",
                textAlign: "right",
                fontWeight: 700,
              }}
            >
              {score ?? "—"}
            </td>
            <td style={{ padding: 4, borderBottom: "1px solid #eee" }}>{note}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PrintSection({
  title,
  section,
}: {
  title: string;
  section: SectionReport;
}): React.ReactNode {
  const score: CategoryScore = section.score;
  return (
    <section style={{ marginTop: 14, breakInside: "avoid" }}>
      <h2
        style={{
          fontSize: 13,
          margin: "0 0 4px",
          borderBottom: "1px solid #333",
          paddingBottom: 3,
        }}
      >
        {title} — {score.score === null ? "insufficient data" : `${score.score}/100`} (
        {score.coverage}% coverage)
      </h2>
      <p style={{ margin: "0 0 6px", fontSize: 9, color: "#333" }}>{section.summary}</p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: 3, borderBottom: "1px solid #ccc" }}>Check</th>
            <th style={{ textAlign: "left", padding: 3, borderBottom: "1px solid #ccc" }}>
              Status
            </th>
            <th style={{ textAlign: "left", padding: 3, borderBottom: "1px solid #ccc" }}>
              Observation
            </th>
          </tr>
        </thead>
        <tbody>
          {score.checks.map((check) => (
            <tr key={check.id}>
              <td style={{ padding: 3, borderBottom: "1px solid #eee", verticalAlign: "top" }}>
                {check.title}
              </td>
              <td
                style={{
                  padding: 3,
                  borderBottom: "1px solid #eee",
                  verticalAlign: "top",
                  textTransform: "uppercase",
                  fontSize: 8,
                }}
              >
                {check.status}
              </td>
              <td style={{ padding: 3, borderBottom: "1px solid #eee", verticalAlign: "top" }}>
                {check.detail}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function PrintPage(): React.ReactNode {
  const { id } = useParams();
  const { report, loading, error, refresh } = useReport(id);
  usePageTitle(report ? `Printable report — ${report.scan.domain}` : "Printable report");

  if (loading) return <p style={{ padding: 24, fontSize: 12 }}>Preparing the printable report…</p>;
  if (error)
    return (
      <div style={{ padding: 16 }}>
        <ErrorPanel error={error} onRetry={refresh} title="Unable to build the printable report" />
      </div>
    );
  if (!report) return <p style={{ padding: 24 }}>No report data.</p>;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 22px", color: "var(--vt-text)" }}>
      <div
        className="no-print"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 20,
        }}
      >
        <Link to={`/scan/${report.scan.id}`} className="vt-button vt-button--ghost vt-button--sm">
          <ArrowLeft size={13} aria-hidden="true" /> Back to report
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: "var(--vt-text-faint)" }}>
            Use your browser's print dialog and choose “Save as PDF”.
          </span>
          <Button size="sm" variant="primary" onClick={() => window.print()}>
            <Printer size={13} aria-hidden="true" /> Print / Save as PDF
          </Button>
        </div>
      </div>

      <header style={{ borderBottom: "2px solid #333", paddingBottom: 10 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "flex-start",
          }}
        >
          <div>
            <div
              style={{ fontFamily: "var(--vt-font-mono)", fontSize: 9, letterSpacing: "0.12em" }}
            >
              VIBETRACE · WEBSITE FORENSICS
            </div>
            <h1 style={{ margin: "5px 0 0", fontSize: 21, letterSpacing: "-0.02em" }}>
              {report.overview.title?.trim() || report.scan.domain}
            </h1>
            <p style={{ margin: "3px 0 0", fontSize: 9, wordBreak: "break-all" }}>
              {report.scan.finalUrl ?? report.scan.url}
            </p>
          </div>
          <div style={{ textAlign: "right", fontSize: 8 }}>
            <div>{formatDate(report.scan.completedAt)}</div>
            <div>Scan mode: {report.scan.mode}</div>
            <div>Duration: {formatDuration(report.scan.durationMs)}</div>
            <div>Report: {report.scan.id.slice(0, 8)}</div>
          </div>
        </div>
      </header>

      <section style={{ marginTop: 12 }}>
        <h2 style={{ fontSize: 13, margin: "0 0 4px" }}>Scores</h2>
        <PrintScoreTable scores={report.scores} />
        <p style={{ fontSize: 8, color: "#555", margin: "4px 0 0" }}>
          AI signal index summarizes observed evidence; it is not a probability or authorship claim.
          Scores below 40% coverage are withheld and shown as “—”.
        </p>
      </section>

      <section style={{ marginTop: 14, breakInside: "avoid" }}>
        <h2
          style={{
            fontSize: 13,
            margin: "0 0 5px",
            borderBottom: "1px solid #333",
            paddingBottom: 3,
          }}
        >
          Key findings
        </h2>
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 9 }}>
          {report.overview.keyFindings.map((finding) => (
            <li key={finding} style={{ marginBottom: 2 }}>
              {finding}
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 14, breakInside: "avoid" }}>
        <h2
          style={{
            fontSize: 13,
            margin: "0 0 5px",
            borderBottom: "1px solid #333",
            paddingBottom: 3,
          }}
        >
          AI-development signals
        </h2>
        <p style={{ margin: "0 0 4px", fontSize: 9 }}>
          <strong>{report.ai.label}</strong> · signal index {report.ai.signalScore ?? "—"} ·
          confidence {report.ai.confidenceScore}% · positive evidence {report.ai.evidence.length} ·
          contradictions {report.ai.contradictions.length}
        </p>
        <p style={{ margin: "0 0 4px", fontSize: 9, color: "#333" }}>{report.ai.summary}</p>
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 9 }}>
          {report.ai.evidence.map((item) => (
            <li key={item.id} style={{ marginBottom: 2 }}>
              <strong>{item.title}</strong> ({item.strength}, weight {item.weight}):{" "}
              {item.description}
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 14, breakInside: "avoid" }}>
        <h2
          style={{
            fontSize: 13,
            margin: "0 0 5px",
            borderBottom: "1px solid #333",
            paddingBottom: 3,
          }}
        >
          Detected technologies ({report.technologies.length})
        </h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 3, borderBottom: "1px solid #ccc" }}>
                Technology
              </th>
              <th style={{ textAlign: "left", padding: 3, borderBottom: "1px solid #ccc" }}>
                Category
              </th>
              <th style={{ textAlign: "right", padding: 3, borderBottom: "1px solid #ccc" }}>
                Confidence
              </th>
            </tr>
          </thead>
          <tbody>
            {report.technologies.map((tech) => (
              <tr key={tech.id}>
                <td style={{ padding: 3, borderBottom: "1px solid #eee" }}>
                  {tech.name}
                  {tech.version ? ` ${tech.version}` : ""}
                </td>
                <td style={{ padding: 3, borderBottom: "1px solid #eee" }}>{tech.category}</td>
                <td style={{ padding: 3, borderBottom: "1px solid #eee", textAlign: "right" }}>
                  {tech.confidence}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <PrintSection title="Code quality" section={report.sections.codeQuality} />
      <PrintSection title="Security" section={report.sections.security} />
      <PrintSection title="Performance" section={report.sections.performance} />
      <PrintSection title="Accessibility" section={report.sections.accessibility} />
      <PrintSection title="SEO" section={report.sections.seo} />

      <section style={{ marginTop: 14, breakInside: "avoid" }}>
        <h2
          style={{
            fontSize: 13,
            margin: "0 0 5px",
            borderBottom: "1px solid #333",
            paddingBottom: 3,
          }}
        >
          Recommendations
        </h2>
        <ol style={{ margin: 0, paddingLeft: 16, fontSize: 9 }}>
          {report.recommendations.map((item) => (
            <li key={item.id} style={{ marginBottom: 3 }}>
              <strong>
                [{item.priority}] {item.title}
              </strong>{" "}
              — {item.detail}
            </li>
          ))}
        </ol>
      </section>

      <section style={{ marginTop: 14, breakInside: "avoid" }}>
        <h2
          style={{
            fontSize: 13,
            margin: "0 0 5px",
            borderBottom: "1px solid #333",
            paddingBottom: 3,
          }}
        >
          Limitations
        </h2>
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 9 }}>
          {report.limitations.map((item) => (
            <li key={item} style={{ marginBottom: 2 }}>
              {item}
            </li>
          ))}
        </ul>
      </section>

      <footer
        style={{
          marginTop: 18,
          borderTop: "1px solid #999",
          paddingTop: 6,
          fontSize: 8,
          color: "#555",
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span>
          VibeTrace engine {report.engineVersion} · schema {report.schemaVersion}
        </span>
        <span>
          Generated {formatDate(report.generatedAt)} · Evidence-first, uncertainty visible.
        </span>
      </footer>
      <div className="no-print" style={{ marginTop: 16 }}>
        <Badge>Raw HTML, cookies and credentials are excluded from this report.</Badge>
      </div>
    </div>
  );
}
