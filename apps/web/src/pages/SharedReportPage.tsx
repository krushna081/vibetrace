import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { Eye, LockKeyhole, Printer } from "lucide-react";
import type { ScanReport } from "@vibetrace/shared-types";
import { Badge, Button, Card, Skeleton } from "@vibetrace/design-system";
import { getApiClient } from "../lib/settings.js";
import { usePageTitle } from "../hooks/use-api.js";
import { ReportOverview } from "../components/report/Overview.js";
import { ErrorPanel } from "../components/ErrorPanel.js";
import { formatDate } from "../lib/format.js";

export function SharedReportPage(): ReactNode {
  const { token } = useParams();
  const [report, setReport] = useState<ScanReport | null>(null);
  const [sharedAt, setSharedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  usePageTitle(report ? `Shared report — ${report.scan.domain}` : "Shared report");

  useEffect(() => {
    if (!token) {
      setError(new Error("A share token is required."));
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getApiClient()
      .getSharedReport(token)
      .then((result) => {
        if (cancelled) return;
        setReport(result.report);
        setSharedAt(result.sharedAt);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div aria-busy="true" style={{ display: "grid", gap: 12 }}>
        <Skeleton width="100%" height={120} />
        <Skeleton width="100%" height={180} />
        <Skeleton width="100%" height={320} />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorPanel
        error={error}
        title="Shared report unavailable"
        showSettings={false}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (!report) {
    return (
      <ErrorPanel error={new Error("No shared report data was returned.")} showSettings={false} />
    );
  }

  return (
    <div>
      <Card
        raised
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "14px 18px",
          marginBottom: 16,
          borderLeft: "2px solid var(--vt-lime)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Eye size={16} style={{ color: "var(--vt-lime)" }} aria-hidden="true" />
          <div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
              <strong style={{ fontSize: 13 }}>Public shared report</strong>
              <Badge tone="lime">read only</Badge>
            </div>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--vt-text-muted)" }}>
              Shared {formatDate(sharedAt)} · raw page source, cookies and AI narratives are
              excluded.
            </p>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <Button size="sm" variant="secondary" onClick={() => window.print()}>
            <Printer size={13} aria-hidden="true" /> Print
          </Button>
          <Link to="/scan" className="vt-button vt-button--ghost vt-button--sm">
            Analyze another site
          </Link>
        </div>
      </Card>

      <div style={{ marginBottom: 18 }}>
        <div
          className="vt-mono"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 9,
            letterSpacing: "0.1em",
            color: "var(--vt-text-faint)",
            textTransform: "uppercase",
          }}
        >
          <LockKeyhole size={10} aria-hidden="true" /> VibeTrace shared report
        </div>
        <h1
          style={{
            margin: "7px 0 0",
            fontSize: "clamp(24px, 4vw, 34px)",
            letterSpacing: "-0.04em",
          }}
        >
          {report.overview.title?.trim() || report.scan.domain}
        </h1>
        <p
          className="vt-mono"
          style={{
            margin: "5px 0 0",
            fontSize: 11,
            color: "var(--vt-text-muted)",
            overflowWrap: "anywhere",
          }}
        >
          {report.scan.finalUrl ?? report.scan.url}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 9 }}>
          <Badge>{report.scan.mode}</Badge>
          <Badge>{formatDate(report.scan.completedAt)}</Badge>
          <Badge>{report.engineVersion}</Badge>
        </div>
      </div>

      <ReportOverview report={report} />
    </div>
  );
}
