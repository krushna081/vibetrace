import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Chrome,
  Clock3,
  Globe2,
  Radar,
  ScanLine,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, Skeleton } from "@vibetrace/design-system";
import { ScanForm } from "../components/ScanForm.js";
import { useHistory, usePageTitle } from "../hooks/use-api.js";
import { formatRelative } from "../lib/format.js";
import { describeError } from "../lib/errors.js";

export function ScannerPage(): React.ReactNode {
  usePageTitle("Scanner");
  const [params] = useSearchParams();
  const initialUrl = params.get("url") ?? "";
  const history = useHistory(6);

  return (
    <div>
      <PageHeader
        eyebrow="Scanner"
        title="Analyze a public website."
        description="Start a server-side scan through the SSRF-guarded fetch pipeline. Reports are asynchronous: progress is streamed by polling and the final report is validated before it is stored."
        actions={
          <Link to="/history" className="vt-button vt-button--ghost vt-button--sm">
            <Clock3 size={14} aria-hidden="true" /> Scan history
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] lg:items-start">
        <div style={{ display: "grid", gap: 16 }}>
          <Card raised style={{ padding: "clamp(18px, 4vw, 26px)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <span
                style={{
                  display: "grid",
                  placeItems: "center",
                  width: 32,
                  height: 32,
                  border: "1px solid var(--vt-border)",
                  borderRadius: 7,
                  background: "var(--vt-graphite)",
                  color: "var(--vt-lime)",
                }}
              >
                <Radar size={15} aria-hidden="true" />
              </span>
              <div>
                <h2 style={{ margin: 0, fontSize: 15 }}>New server-side scan</h2>
                <p style={{ margin: 0, fontSize: 12, color: "var(--vt-text-muted)" }}>
                  Public HTTP/HTTPS targets only.
                </p>
              </div>
            </div>
            <ScanForm initialUrl={initialUrl} autoFocus={!initialUrl} />
            <div
              style={{
                display: "grid",
                gap: 8,
                marginTop: 18,
                paddingTop: 16,
                borderTop: "1px solid var(--vt-border)",
              }}
            >
              {[
                {
                  icon: ShieldCheck,
                  title: "Fetch protections",
                  text: "Private, loopback, link-local and metadata addresses are blocked after DNS resolution and again on every redirect.",
                },
                {
                  icon: ScanLine,
                  title: "Bounded analysis",
                  text: "HTML, assets, probes, redirects and total duration have explicit limits. No page source is stored in the public report.",
                },
                {
                  icon: SlidersHorizontal,
                  title: "Coverage-aware scores",
                  text: "If fewer than 40% of a section's weighted checks are measurable, that score is withheld instead of guessed.",
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} style={{ display: "flex", gap: 10 }}>
                    <Icon
                      size={14}
                      style={{ flex: "0 0 auto", marginTop: 3, color: "var(--vt-text-faint)" }}
                      aria-hidden="true"
                    />
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{item.title}</span>
                      <p style={{ margin: "1px 0 0", fontSize: 12, color: "var(--vt-text-muted)" }}>
                        {item.text}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card style={{ padding: 18 }}>
              <Chrome size={17} style={{ color: "var(--vt-cyan)" }} aria-hidden="true" />
              <h2 style={{ margin: "8px 0 0", fontSize: 14 }}>Need the page you are on?</h2>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--vt-text-muted)" }}>
                The Chrome extension analyzes the current tab from a sanitized snapshot, including
                pages behind a login that the server cannot fetch.
              </p>
              <Link
                to="/methodology#extension"
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
                Install / architecture <ArrowRight size={11} aria-hidden="true" />
              </Link>
            </Card>
            <Card style={{ padding: 18 }}>
              <Globe2 size={17} style={{ color: "var(--vt-lime)" }} aria-hidden="true" />
              <h2 style={{ margin: "8px 0 0", fontSize: 14 }}>Why no raw source?</h2>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--vt-text-muted)" }}>
                Reports include structured evidence and short sanitized samples only. Full HTML is
                analyzed transiently and is not exposed in the report, share links, or exports.
              </p>
            </Card>
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <Card>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 16px",
                borderBottom: "1px solid var(--vt-border)",
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 13 }}>Recent scans</h2>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--vt-text-muted)" }}>
                  From this API instance
                </p>
              </div>
              <Link
                to="/history"
                className="vt-mono"
                style={{
                  fontSize: 9,
                  color: "var(--vt-lime)",
                  textDecoration: "none",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                All →
              </Link>
            </div>
            <div style={{ padding: "4px 16px" }}>
              {history.loading ? (
                <div style={{ display: "grid", gap: 12, padding: "12px 0" }} aria-busy="true">
                  {[1, 2, 3].map((item) => (
                    <div key={item}>
                      <Skeleton width="65%" height={12} />
                      <Skeleton width="40%" height={9} style={{ marginTop: 6 }} />
                    </div>
                  ))}
                </div>
              ) : history.error ? (
                <div style={{ padding: "14px 0", fontSize: 12, color: "var(--vt-red)" }}>
                  {describeError(history.error).message}
                </div>
              ) : history.scans.length === 0 ? (
                <EmptyState
                  title="No scans yet"
                  description="Your first analysis will appear here as soon as it is queued."
                />
              ) : (
                history.scans.map((scan) => (
                  <Link
                    key={scan.id}
                    to={`/scan/${scan.id}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: "11px 0",
                      borderBottom: "1px solid var(--vt-border)",
                      textDecoration: "none",
                    }}
                  >
                    <span style={{ minWidth: 0 }}>
                      <span
                        style={{
                          display: "block",
                          fontSize: 12,
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {scan.domain}
                      </span>
                      <span
                        className="vt-mono"
                        style={{
                          display: "block",
                          marginTop: 2,
                          fontSize: 9,
                          color: "var(--vt-text-faint)",
                        }}
                      >
                        {formatRelative(scan.createdAt)}
                      </span>
                    </span>
                    <Badge
                      tone={
                        scan.status === "completed"
                          ? "lime"
                          : scan.status === "failed"
                            ? "red"
                            : scan.status === "partially_completed"
                              ? "amber"
                              : "cyan"
                      }
                    >
                      {scan.status.replace("_", " ")}
                    </Badge>
                  </Link>
                ))
              )}
            </div>
          </Card>

          <div
            style={{
              border: "1px dashed var(--vt-border-strong)",
              borderRadius: 8,
              padding: "14px 16px",
              color: "var(--vt-text-faint)",
              fontSize: 11,
              lineHeight: 1.7,
            }}
          >
            <span
              className="vt-mono"
              style={{
                display: "block",
                fontSize: 9,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              API connection
            </span>
            The web client talks to the Fastify API configured in Settings. If the API is offline,
            scans cannot be queued.{" "}
            <Link to="/settings" style={{ color: "var(--vt-lime)" }}>
              Check connection
            </Link>
            .
          </div>
        </div>
      </div>
    </div>
  );
}
