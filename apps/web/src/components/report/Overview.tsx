import { Link } from "react-router-dom";
import {
  Accessibility,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  FileCode2,
  Gauge,
  Globe2,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  TextSearch,
} from "lucide-react";
import type { ScanReport } from "@vibetrace/shared-types";
import { Badge, Card } from "@vibetrace/design-system";
import { CategorySummaryCard, ScoreGrid, ScoreRadar } from "./Scores.js";
import { LimitationsPanel, RecommendationList } from "./Metrics.js";
import { formatBytes, formatDate, formatDuration, formatNumber } from "../../lib/format.js";

function MetaRow({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 0.8fr) minmax(0, 1.2fr)",
        gap: 10,
        padding: "7px 0",
        borderBottom: "1px solid var(--vt-border)",
        fontSize: 12,
      }}
    >
      <span style={{ color: "var(--vt-text-faint)" }}>{label}</span>
      <span
        className={mono ? "vt-mono" : undefined}
        style={{
          color: "var(--vt-text)",
          overflowWrap: "anywhere",
          fontFamily: mono ? undefined : "inherit",
          fontSize: mono ? 11 : 12,
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function ReportOverview({ report }: { report: ScanReport }): React.ReactNode {
  const { overview, scores, source, ai } = report;
  const findings = overview.keyFindings.slice(0, 8);
  const recommendations = report.recommendations.slice(0, 6);
  const technologies = report.technologies.slice(0, 10);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <ScoreGrid report={report} />

      <div className="report-layout">
        <div style={{ display: "grid", gap: 14, minWidth: 0 }}>
          <Card>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "15px 18px",
                borderBottom: "1px solid var(--vt-border)",
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 14 }}>Key findings</h2>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--vt-text-muted)" }}>
                  Observations selected by the analysis engine, not editorial conclusions.
                </p>
              </div>
              <Badge>{findings.length}</Badge>
            </div>
            <div style={{ padding: "6px 18px 14px" }}>
              {findings.length ? (
                findings.map((finding, index) => (
                  <div
                    key={`${finding}-${index}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "24px minmax(0, 1fr)",
                      gap: 10,
                      padding: "10px 0",
                      borderBottom:
                        index === findings.length - 1 ? 0 : "1px solid var(--vt-border)",
                    }}
                  >
                    <span
                      className="vt-mono"
                      style={{ fontSize: 10, color: "var(--vt-lime)", paddingTop: 2 }}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span style={{ fontSize: 13, color: "var(--vt-text-muted)" }}>{finding}</span>
                  </div>
                ))
              ) : (
                <p style={{ margin: "10px 0", color: "var(--vt-text-muted)", fontSize: 13 }}>
                  No distinct key findings were returned. Inspect the section checks directly.
                </p>
              )}
            </div>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <CategorySummaryCard
              title="Code quality"
              section={scores.codeQuality}
              to={`/scan/${report.scan.id}/quality`}
              icon={<Sparkles size={12} aria-hidden="true" />}
            />
            <CategorySummaryCard
              title="Security"
              section={scores.security}
              to={`/scan/${report.scan.id}/security`}
              icon={<ShieldCheck size={12} aria-hidden="true" />}
            />
            <CategorySummaryCard
              title="Performance"
              section={scores.performance}
              to={`/scan/${report.scan.id}/performance`}
              icon={<Gauge size={12} aria-hidden="true" />}
            />
            <CategorySummaryCard
              title="Accessibility"
              section={scores.accessibility}
              to={`/scan/${report.scan.id}/quality#accessibility`}
              icon={<Accessibility size={12} aria-hidden="true" />}
            />
            <CategorySummaryCard
              title="SEO"
              section={scores.seo}
              to={`/scan/${report.scan.id}/quality#seo`}
              icon={<TextSearch size={12} aria-hidden="true" />}
            />
            <Card
              style={{
                padding: "16px 18px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    color: "var(--vt-text-muted)",
                  }}
                >
                  <BrainCircuit size={12} aria-hidden="true" />
                  <span
                    className="vt-mono"
                    style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}
                  >
                    AI signals
                  </span>
                </div>
                <p style={{ margin: "9px 0 0", fontSize: 13, fontWeight: 600 }}>{ai.label}</p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--vt-text-muted)" }}>
                  {ai.signalScore === null
                    ? "No positive signal index"
                    : `Index ${ai.signalScore}/100`}{" "}
                  · {ai.confidence} confidence
                </p>
              </div>
              <Link
                to={`/scan/${report.scan.id}/ai`}
                className="vt-mono"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  marginTop: 10,
                  fontSize: 10,
                  color: "var(--vt-lime)",
                  textDecoration: "none",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Inspect evidence <ArrowRight size={11} aria-hidden="true" />
              </Link>
            </Card>
          </div>

          <Card>
            <div style={{ padding: "15px 18px", borderBottom: "1px solid var(--vt-border)" }}>
              <h2 style={{ margin: 0, fontSize: 14 }}>Recommendations</h2>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--vt-text-muted)" }}>
                Generated only from failed or warning checks with a concrete remediation.
              </p>
            </div>
            <div style={{ padding: "10px 14px 14px" }}>
              <RecommendationList items={recommendations} />
              {report.recommendations.length > recommendations.length ? (
                <p
                  className="vt-mono"
                  style={{ margin: "8px 2px 0", fontSize: 10, color: "var(--vt-text-faint)" }}
                >
                  +{report.recommendations.length - recommendations.length} more recommendations in
                  the section pages
                </p>
              ) : null}
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card style={{ padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <FileCode2 size={13} style={{ color: "var(--vt-lime)" }} aria-hidden="true" />
                <h2 style={{ margin: 0, fontSize: 13 }}>Source profile</h2>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 14px" }}>
                <MetaRow
                  label="HTML size"
                  value={`${formatBytes(source.htmlBytes)}${source.htmlTruncated ? " (truncated)" : ""}`}
                />
                <MetaRow label="Nodes" value={formatNumber(source.nodeCount)} />
                <MetaRow
                  label="Scripts"
                  value={`${source.scriptCount} (${source.externalScriptCount} ext)`}
                />
                <MetaRow label="Stylesheets" value={String(source.stylesheetCount)} />
                <MetaRow label="Images" value={String(source.imageCount)} />
                <MetaRow label="Max depth" value={String(source.maxDepth)} />
                <MetaRow label="Comments" value={String(source.comments)} />
                <MetaRow label="Duplicate IDs" value={String(source.duplicateIds)} />
              </div>
              {source.thirdPartyDomains.length ? (
                <div style={{ marginTop: 10 }}>
                  <span
                    className="vt-mono"
                    style={{
                      fontSize: 9,
                      letterSpacing: "0.1em",
                      color: "var(--vt-text-faint)",
                      textTransform: "uppercase",
                    }}
                  >
                    Third-party domains
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
                    {source.thirdPartyDomains.slice(0, 8).map((domain) => (
                      <Badge key={domain}>{domain}</Badge>
                    ))}
                    {source.thirdPartyDomains.length > 8 ? (
                      <Badge>+{source.thirdPartyDomains.length - 8}</Badge>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <p style={{ margin: "10px 0 0", fontSize: 11, color: "var(--vt-text-faint)" }}>
                Raw HTML is not included in reports. Only bounded structural facts and sanitized
                samples are retained.
              </p>
            </Card>

            <Card style={{ padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <ScanSearch size={13} style={{ color: "var(--vt-lime)" }} aria-hidden="true" />
                <h2 style={{ margin: 0, fontSize: 13 }}>Technology signals</h2>
              </div>
              {technologies.length ? (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {technologies.map((tech) => (
                    <div
                      key={tech.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        padding: "6px 0",
                        borderBottom: "1px solid var(--vt-border)",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{tech.name}</span>
                        <span
                          style={{ marginLeft: 6, fontSize: 10, color: "var(--vt-text-faint)" }}
                        >
                          {tech.version ?? tech.category}
                        </span>
                      </div>
                      <Badge
                        tone={
                          tech.confidence >= 70
                            ? "lime"
                            : tech.confidence >= 45
                              ? "amber"
                              : "neutral"
                        }
                      >
                        {tech.confidence}%
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--vt-text-muted)" }}>
                  No technology crossed the confidence threshold.
                </p>
              )}
              <Link
                to={`/scan/${report.scan.id}/technology`}
                className="vt-mono"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  marginTop: 10,
                  fontSize: 10,
                  color: "var(--vt-lime)",
                  textDecoration: "none",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Technology intelligence <ArrowRight size={11} aria-hidden="true" />
              </Link>
            </Card>
          </div>

          <LimitationsPanel limitations={report.limitations} partialReason={report.partialReason} />
        </div>

        <aside className="report-sidebar" style={{ display: "grid", gap: 12 }}>
          <ScoreRadar report={report} />

          <Card style={{ padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Globe2 size={13} style={{ color: "var(--vt-cyan)" }} aria-hidden="true" />
              <h2 style={{ margin: 0, fontSize: 13 }}>Scan facts</h2>
            </div>
            <div style={{ marginTop: 8 }}>
              <MetaRow label="HTTP" value={overview.httpStatus ?? "unavailable"} />
              <MetaRow label="Type" value={overview.contentType ?? "unknown"} />
              <MetaRow label="Generator" value={overview.generator ?? "not declared"} />
              <MetaRow label="Server" value={overview.server ?? "not declared"} />
              <MetaRow label="Language" value={overview.language ?? "not declared"} />
              <MetaRow label="Mode" value={report.scan.mode} mono={false} />
              <MetaRow label="Duration" value={formatDuration(report.scan.durationMs)} />
              <MetaRow label="Completed" value={formatDate(report.scan.completedAt)} />
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 10, color: "var(--vt-text-faint)" }}>
              Engine {report.engineVersion} · schema {report.schemaVersion}
            </p>
          </Card>

          <Card style={{ padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <BrainCircuit size={13} style={{ color: "var(--vt-lime)" }} aria-hidden="true" />
              <h2 style={{ margin: 0, fontSize: 13 }}>AI signal summary</h2>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <Badge
                tone={
                  ai.classification === "strong"
                    ? "lime"
                    : ai.classification === "moderate"
                      ? "amber"
                      : ai.classification === "mixed"
                        ? "red"
                        : "neutral"
                }
              >
                {ai.label}
              </Badge>
              <span className="vt-mono" style={{ fontSize: 10, color: "var(--vt-text-faint)" }}>
                confidence {ai.confidenceScore}%
              </span>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--vt-text-muted)" }}>
              {ai.summary}
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 10, color: "var(--vt-text-faint)" }}>
              The signal index summarizes observed evidence. It is not a probability of AI
              authorship.
            </p>
            <Link
              to={`/scan/${report.scan.id}/ai`}
              className="vt-mono"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                marginTop: 8,
                fontSize: 10,
                color: "var(--vt-lime)",
                textDecoration: "none",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Full evidence trail <ArrowRight size={11} aria-hidden="true" />
            </Link>
          </Card>

          {ai.builderFingerprints.length ? (
            <Card style={{ padding: "16px 18px" }}>
              <h2 style={{ margin: 0, fontSize: 13 }}>Builder fingerprints</h2>
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {ai.builderFingerprints.slice(0, 4).map((fingerprint) => (
                  <div key={fingerprint.id}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 6,
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{fingerprint.name}</span>
                      <Badge>{fingerprint.confidence}%</Badge>
                    </div>
                    <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--vt-text-faint)" }}>
                      {fingerprint.kind} · {fingerprint.evidenceTitles.length} signals
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          <Card style={{ padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <CheckCircle2 size={13} style={{ color: "var(--vt-lime)" }} aria-hidden="true" />
              <h2 style={{ margin: 0, fontSize: 13 }}>Report integrity</h2>
            </div>
            <ul
              style={{
                margin: "9px 0 0",
                paddingLeft: 16,
                color: "var(--vt-text-muted)",
                fontSize: 11,
                lineHeight: 1.7,
              }}
            >
              <li>Validated against schema {report.schemaVersion}</li>
              <li>{report.recommendations.length} recommendations</li>
              <li>{report.limitations.length} recorded limitations</li>
              <li>
                {
                  [
                    scores.codeQuality,
                    scores.security,
                    scores.performance,
                    scores.accessibility,
                    scores.seo,
                  ].filter((score) => score.score !== null).length
                }{" "}
                of 5 category scores available
              </li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
