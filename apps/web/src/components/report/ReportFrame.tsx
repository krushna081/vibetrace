import { useEffect, type ReactNode } from "react";
import { Link, NavLink, useParams } from "react-router-dom";
import {
  Accessibility,
  BrainCircuit,
  Clock3,
  Gauge,
  LayoutDashboard,
  ScanSearch,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { ScanReport } from "@vibetrace/shared-types";
import { ApiClientError } from "@vibetrace/api-client";
import { Badge, Button, Card, Skeleton } from "@vibetrace/design-system";
import { formatDuration } from "../../lib/format.js";
import { useReport, usePageTitle } from "../../hooks/use-api.js";
import { ErrorPanel } from "../ErrorPanel.js";
import { ReportActions } from "../ReportActions.js";

const TABS = [
  { path: "", label: "Overview", icon: LayoutDashboard, end: true },
  { path: "/ai", label: "AI signals", icon: BrainCircuit },
  { path: "/technology", label: "Technology", icon: ScanSearch },
  { path: "/security", label: "Security", icon: ShieldCheck },
  { path: "/performance", label: "Performance", icon: Gauge },
  { path: "/quality", label: "Quality & SEO", icon: Accessibility },
] as const;

function statusTone(status: string): "lime" | "amber" | "red" | "cyan" | "neutral" {
  if (status === "completed" || status === "pass") return "lime";
  if (status === "partially_completed" || status === "warn") return "amber";
  if (status === "failed" || status === "fail") return "red";
  if (status === "info") return "cyan";
  return "neutral";
}

export function ReportHeader({ report }: { report: ScanReport }): ReactNode {
  const href = report.scan.finalUrl ?? report.scan.url;
  const ai = report.scores.aiSignals;
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        className="vt-mono"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          fontSize: 10,
          letterSpacing: "0.08em",
          color: "var(--vt-text-faint)",
          textTransform: "uppercase",
        }}
      >
        <Link to="/history" className="link-quiet">
          Scan history
        </Link>
        <span aria-hidden="true">/</span>
        <span>{report.scan.domain}</span>
        <span aria-hidden="true">/</span>
        <span>Report</span>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginTop: 10,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 6,
              marginBottom: 8,
            }}
          >
            <Badge tone={statusTone(report.scan.status)}>
              {report.scan.status === "completed" ? "Completed" : "Partial report"}
            </Badge>
            <Badge
              tone={
                ai.classification === "strong"
                  ? "lime"
                  : ai.classification === "moderate"
                    ? "amber"
                    : "neutral"
              }
            >
              {ai.label}
            </Badge>
            <Badge tone="cyan">
              {report.scan.mode === "snapshot" ? "Browser snapshot" : "Server crawl"}
            </Badge>
            {report.scan.httpStatus ? <Badge>HTTP {report.scan.httpStatus}</Badge> : null}
          </div>
          <h1
            className="text-balance"
            style={{
              margin: 0,
              fontSize: "clamp(23px, 3.6vw, 34px)",
              lineHeight: 1.14,
              letterSpacing: "-0.035em",
            }}
          >
            {report.overview.title?.trim() || report.scan.domain}
          </h1>
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="vt-mono"
            style={{
              display: "inline-block",
              marginTop: 8,
              color: "var(--vt-text-muted)",
              fontSize: 12,
              overflowWrap: "anywhere",
            }}
          >
            {report.scan.domain}
            <span style={{ color: "var(--vt-text-faint)" }}>
              {href.slice(href.indexOf(report.scan.domain) + report.scan.domain.length) || "/"}
            </span>
          </a>
          <p
            className="vt-mono"
            style={{
              margin: "7px 0 0",
              fontSize: 10,
              color: "var(--vt-text-faint)",
              letterSpacing: "0.04em",
            }}
          >
            {formatDuration(report.scan.durationMs)} · {report.engineVersion} ·{" "}
            {report.technologies.length} technologies · {report.scan.id.slice(0, 8)}
          </p>
        </div>
        <ReportActions report={report} />
      </div>
    </div>
  );
}

export function ReportTabs({ scanId }: { scanId: string }): ReactNode {
  return (
    <nav
      aria-label="Report sections"
      className="vt-scroll-x no-print"
      style={{
        display: "flex",
        gap: 4,
        padding: 4,
        marginBottom: 22,
        border: "1px solid var(--vt-border)",
        borderRadius: 9,
        background: "var(--vt-panel)",
        width: "fit-content",
        maxWidth: "100%",
      }}
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.path}
            to={`/scan/${scanId}${tab.path}`}
            end={"end" in tab ? tab.end : false}
            style={({ isActive }) => ({
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "7px 11px",
              borderRadius: 6,
              textDecoration: "none",
              fontSize: 12,
              fontWeight: isActive ? 650 : 500,
              whiteSpace: "nowrap",
              color: isActive ? "#080908" : "var(--vt-text-muted)",
              background: isActive ? "var(--vt-lime)" : "transparent",
            })}
          >
            <Icon size={13} aria-hidden="true" />
            {tab.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

export function ReportFrame({
  report,
  children,
}: {
  report: ScanReport;
  children: ReactNode;
}): ReactNode {
  return (
    <div>
      <ReportHeader report={report} />
      <ReportTabs scanId={report.scan.id} />
      {children}
    </div>
  );
}

export function ReportLoadingSkeleton(): ReactNode {
  return (
    <div aria-busy="true" aria-label="Loading report">
      <Skeleton width={180} height={12} />
      <Skeleton width="min(560px, 88%)" height={38} style={{ marginTop: 16 }} />
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <Skeleton width={90} height={22} />
        <Skeleton width={110} height={22} />
        <Skeleton width={70} height={22} />
      </div>
      <Skeleton width="100%" height={48} style={{ marginTop: 24 }} />
      <div className="score-grid" style={{ marginTop: 20 }}>
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="score-cell">
            <Skeleton width={84} height={84} radius={999} />
            <Skeleton width={70} height={10} style={{ marginTop: 8 }} />
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gap: 14, marginTop: 20 }}>
        <Skeleton width="100%" height={180} />
        <Skeleton width="100%" height={120} />
      </div>
    </div>
  );
}

export function ReportGate({
  page,
  children,
}: {
  page?: string;
  children: (report: ScanReport) => ReactNode;
}): ReactNode {
  const { id } = useParams();
  const { report, loading, error, refresh } = useReport(id);
  const notReady = error instanceof ApiClientError && error.code === "SCAN_NOT_READY";

  useEffect(() => {
    if (!notReady) return;
    const timer = window.setTimeout(refresh, 3_000);
    return () => window.clearTimeout(timer);
  }, [notReady, refresh]);

  usePageTitle(
    report
      ? `${page ?? "Report"} — ${report.scan.domain}`
      : page
        ? `${page} — VibeTrace`
        : "Report — VibeTrace",
  );

  if (loading) return <ReportLoadingSkeleton />;
  if (notReady) {
    return (
      <Card style={{ padding: "28px 24px", maxWidth: 680, margin: "24px auto" }}>
        <div style={{ display: "flex", gap: 14 }}>
          <div
            aria-hidden="true"
            style={{
              display: "grid",
              placeItems: "center",
              width: 38,
              height: 38,
              flex: "0 0 auto",
              border: "1px solid var(--vt-border-strong)",
              borderRadius: 8,
              background: "var(--vt-graphite)",
              color: "var(--vt-lime)",
            }}
          >
            <Clock3 size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <Badge tone="cyan">Analysis in progress</Badge>
            <h2 style={{ margin: "9px 0 0", fontSize: 18, letterSpacing: "-0.02em" }}>
              This report is still being built
            </h2>
            <p style={{ margin: "6px 0 0", color: "var(--vt-text-muted)", fontSize: 13 }}>
              The scan is running on the analysis worker. This page checks again every few seconds,
              or open the live scan view for stage-by-stage progress.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
              <Link to={`/scan/${id}`} className="vt-button vt-button--primary vt-button--sm">
                View live progress
              </Link>
              <Button variant="secondary" size="sm" onClick={refresh}>
                Check now
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }
  if (error) {
    return (
      <ErrorPanel error={error} onRetry={refresh} title="Unable to load this report" showSettings />
    );
  }
  if (!report) {
    return (
      <Card style={{ padding: 24 }}>
        <p style={{ margin: 0, color: "var(--vt-text-muted)" }}>No report data was returned.</p>
      </Card>
    );
  }
  return <ReportFrame report={report}>{children(report)}</ReportFrame>;
}

export function ReportSectionIntro({
  eyebrow,
  title,
  description,
  score,
  coverage,
  grade,
  icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  score: number | null;
  coverage: number;
  grade: string | null;
  icon?: ReactNode;
}): ReactNode {
  return (
    <Card style={{ padding: "20px 22px", marginBottom: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 16 }}>
        <div style={{ minWidth: 0, maxWidth: 700 }}>
          <span className="vt-eyebrow">
            {icon ?? <Sparkles size={12} aria-hidden="true" />} {eyebrow}
          </span>
          <h2
            style={{
              margin: "9px 0 0",
              fontSize: "clamp(20px, 2.6vw, 26px)",
              letterSpacing: "-0.025em",
            }}
          >
            {title}
          </h2>
          <p style={{ margin: "7px 0 0", color: "var(--vt-text-muted)", fontSize: 13 }}>
            {description}
          </p>
        </div>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <div style={{ textAlign: "right" }}>
            <div
              className="vt-mono"
              style={{ fontSize: 34, fontWeight: 650, lineHeight: 1, color: "var(--vt-lime)" }}
            >
              {score === null ? "—" : Math.round(score)}
            </div>
            <div
              className="vt-mono"
              style={{
                marginTop: 4,
                fontSize: 9,
                letterSpacing: "0.1em",
                color: "var(--vt-text-faint)",
                textTransform: "uppercase",
              }}
            >
              score / 100
            </div>
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            <Badge
              tone={
                score === null ? "neutral" : score >= 80 ? "lime" : score >= 55 ? "amber" : "red"
              }
            >
              Grade {grade ?? "—"}
            </Badge>
            <Badge>{Math.round(coverage)}% coverage</Badge>
          </div>
        </div>
      </div>
    </Card>
  );
}
