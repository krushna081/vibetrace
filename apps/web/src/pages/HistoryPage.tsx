import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Clock3, GitCompareArrows, RefreshCw, Search, Trash2 } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ScanSummary } from "@vibetrace/shared-types";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Skeleton,
  TextInput,
} from "@vibetrace/design-system";
import { useHistory, usePageTitle } from "../hooks/use-api.js";
import { describeError } from "../lib/errors.js";
import { formatRelative, formatShortDate, hostnameOf } from "../lib/format.js";
import { useToast } from "../providers/ToastProvider.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import { ErrorPanel } from "../components/ErrorPanel.js";

const STATUS_FILTERS = [
  "all",
  "completed",
  "partially_completed",
  "failed",
  "queued",
  "running",
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function statusTone(status: ScanSummary["status"]): "lime" | "amber" | "red" | "cyan" | "neutral" {
  if (status === "completed") return "lime";
  if (status === "partially_completed") return "amber";
  if (status === "failed") return "red";
  if (status === "queued" || status === "running") return "cyan";
  return "neutral";
}

function ScoreHint({ score }: { score: number | null }): ReactNode {
  if (score === null)
    return (
      <span className="vt-mono" style={{ fontSize: 11, color: "var(--vt-text-faint)" }}>
        —
      </span>
    );
  const color = score >= 80 ? "var(--vt-lime)" : score >= 55 ? "var(--vt-amber)" : "var(--vt-red)";
  return (
    <span className="vt-mono" style={{ fontSize: 13, fontWeight: 650, color }}>
      {Math.round(score)}
    </span>
  );
}

export function HistoryPage(): ReactNode {
  usePageTitle("Scan history");
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params] = useSearchParams();
  const history = useHistory(100);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<string[]>(() => {
    const seed = params.get("compare");
    return seed ? [seed] : [];
  });
  const [deleteTarget, setDeleteTarget] = useState<ScanSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return history.scans.filter((scan) => {
      if (status !== "all" && scan.status !== status) return false;
      if (!needle) return true;
      return (
        scan.domain.toLowerCase().includes(needle) ||
        scan.url.toLowerCase().includes(needle) ||
        scan.technologyNames.some((name) => name.toLowerCase().includes(needle))
      );
    });
  }, [history.scans, query, status]);

  const trend = useMemo(() => {
    return history.scans
      .filter((scan) => scan.status === "completed" || scan.status === "partially_completed")
      .slice()
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((scan) => ({
        date: formatShortDate(scan.createdAt),
        security: scan.securityScore,
        performance: scan.performanceScore,
        domain: scan.domain,
      }));
  }, [history.scans]);

  const toggleCompare = (id: string) => {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 2) return [current[1]!, id];
      return [...current, id];
    });
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await history.remove(deleteTarget.id);
      setSelected((current) => current.filter((id) => id !== deleteTarget.id));
      toast({ tone: "success", title: "Scan deleted", message: deleteTarget.domain });
      setDeleteTarget(null);
    } catch (err) {
      toast({ tone: "error", title: "Delete failed", message: describeError(err).message });
    } finally {
      setDeleting(false);
    }
  };

  const clearAll = async () => {
    setClearing(true);
    try {
      const deleted = await history.clear();
      setSelected([]);
      setClearOpen(false);
      toast({ tone: "success", title: `${deleted} scan${deleted === 1 ? "" : "s"} deleted` });
    } catch (err) {
      toast({ tone: "error", title: "Could not clear scans", message: describeError(err).message });
    } finally {
      setClearing(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Scan history"
        title="Every analysis, on this API."
        description="History is scoped to the configured API instance. In-memory storage resets on restart; PostgreSQL persistence is optional. Nothing is synced to an account."
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={history.refresh} loading={history.loading}>
              <RefreshCw size={14} aria-hidden="true" /> Refresh
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setClearOpen(true)}
              disabled={!history.scans.length}
            >
              <Trash2 size={14} aria-hidden="true" /> Clear
            </Button>
            <Link to="/scan" className="vt-button vt-button--primary vt-button--sm">
              New scan
            </Link>
          </>
        }
      />

      {selected.length ? (
        <div
          className="no-print"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "10px 14px",
            marginBottom: 14,
            border: "1px solid color-mix(in srgb, var(--vt-lime) 36%, var(--vt-border))",
            borderRadius: 8,
            background: "var(--vt-lime-glow)",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12 }}>
            <GitCompareArrows size={15} style={{ color: "var(--vt-lime)" }} aria-hidden="true" />
            {selected.length === 1
              ? "Select one more completed scan to compare."
              : "Two scans selected. Compare scores, AI signals and technology sets."}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
              Clear selection
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={selected.length !== 2}
              onClick={() => navigate(`/compare?a=${selected[0]}&b=${selected[1]}`)}
            >
              Compare scans <ArrowRight size={13} aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}

      {history.error ? (
        <ErrorPanel
          error={history.error}
          onRetry={history.refresh}
          title="Unable to load history"
        />
      ) : (
        <>
          {trend.length >= 2 ? (
            <Card style={{ marginBottom: 14 }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "14px 18px",
                  borderBottom: "1px solid var(--vt-border)",
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: 14 }}>Security & performance over time</h2>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--vt-text-muted)" }}>
                    Real scores from stored reports, plotted in scan order. Null scores are gaps,
                    not zeros.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Badge tone="lime">Security</Badge>
                  <Badge tone="cyan">Performance</Badge>
                </div>
              </div>
              <div style={{ height: 250, padding: "10px 8px 8px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ top: 6, right: 16, bottom: 0, left: -16 }}>
                    <CartesianGrid stroke="var(--vt-border)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "var(--vt-text-faint)", fontSize: 9 }}
                      axisLine={{ stroke: "var(--vt-border)" }}
                      tickLine={false}
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
                      labelStyle={{ color: "var(--vt-text)" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="security"
                      name="Security"
                      stroke="var(--vt-lime)"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="performance"
                      name="Performance"
                      stroke="var(--vt-cyan)"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          ) : null}

          <Card>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "12px 16px",
                borderBottom: "1px solid var(--vt-border)",
              }}
            >
              <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 360 }}>
                <Search
                  size={14}
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--vt-text-faint)",
                  }}
                />
                <TextInput
                  type="search"
                  placeholder="Filter by domain, URL or technology…"
                  aria-label="Filter scans"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  style={{ minHeight: 36, paddingLeft: 30, fontSize: 12 }}
                />
              </div>
              <div
                className="vt-scroll-x"
                style={{ display: "flex", gap: 4, maxWidth: "100%" }}
                role="group"
                aria-label="Filter by status"
              >
                {STATUS_FILTERS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setStatus(item)}
                    aria-pressed={status === item}
                    className="vt-mono"
                    style={{
                      padding: "4px 8px",
                      border: "1px solid",
                      borderColor: status === item ? "var(--vt-lime)" : "var(--vt-border)",
                      borderRadius: 4,
                      background: status === item ? "var(--vt-lime-glow)" : "transparent",
                      color: status === item ? "var(--vt-lime)" : "var(--vt-text-muted)",
                      fontSize: 9,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.replace("_", " ")}
                  </button>
                ))}
              </div>
              <span
                className="vt-mono"
                style={{ fontSize: 9, color: "var(--vt-text-faint)", letterSpacing: "0.08em" }}
              >
                {filtered.length} / {history.total}
              </span>
            </div>

            {history.loading ? (
              <div style={{ display: "grid", gap: 14, padding: 20 }} aria-busy="true">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="grid grid-cols-[1fr_auto] gap-4">
                    <div>
                      <Skeleton width="38%" height={13} />
                      <Skeleton width="22%" height={9} style={{ marginTop: 6 }} />
                    </div>
                    <Skeleton width={90} height={22} />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<Clock3 size={18} />}
                title={history.scans.length === 0 ? "No scans yet" : "No scans match these filters"}
                description={
                  history.scans.length === 0
                    ? "Run a public URL through the scanner. Completed and failed scans will appear here."
                    : "Clear the search or choose a different status filter."
                }
                action={
                  history.scans.length === 0 ? (
                    <Link to="/scan" className="vt-button vt-button--primary vt-button--sm">
                      Run the first scan
                    </Link>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setQuery("");
                        setStatus("all");
                      }}
                    >
                      Reset filters
                    </Button>
                  )
                }
              />
            ) : (
              <div className="vt-scroll-x">
                <table className="vt-table" style={{ minWidth: 830 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 34 }} aria-label="Compare selection" />
                      <th>Target</th>
                      <th>Status</th>
                      <th>AI signals</th>
                      <th>Tech</th>
                      <th>Sec</th>
                      <th>Perf</th>
                      <th>Scanned</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((scan) => {
                      const selectable =
                        scan.status === "completed" || scan.status === "partially_completed";
                      const checked = selected.includes(scan.id);
                      return (
                        <tr key={scan.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!selectable}
                              onChange={() => toggleCompare(scan.id)}
                              aria-label={`Select ${scan.domain} for comparison`}
                              style={{ width: 14, height: 14, accentColor: "var(--vt-lime)" }}
                            />
                          </td>
                          <td>
                            <Link
                              to={`/scan/${scan.id}`}
                              style={{
                                color: "var(--vt-text)",
                                textDecoration: "none",
                                fontSize: 13,
                                fontWeight: 600,
                              }}
                            >
                              {scan.domain}
                            </Link>
                            <div
                              style={{ marginTop: 3, display: "flex", flexWrap: "wrap", gap: 4 }}
                            >
                              {scan.shared ? <Badge tone="lime">shared</Badge> : null}
                              {scan.technologyNames.slice(0, 3).map((name) => (
                                <Badge key={name}>{name}</Badge>
                              ))}
                            </div>
                          </td>
                          <td>
                            <Badge tone={statusTone(scan.status)}>
                              {scan.status.replace("_", " ")}
                            </Badge>
                          </td>
                          <td>
                            <span style={{ fontSize: 11, color: "var(--vt-text-muted)" }}>
                              {scan.aiLabel ?? "—"}
                            </span>
                          </td>
                          <td>
                            <span className="vt-mono" style={{ fontSize: 11 }}>
                              {scan.technologyCount}
                            </span>
                          </td>
                          <td>
                            <ScoreHint score={scan.securityScore} />
                          </td>
                          <td>
                            <ScoreHint score={scan.performanceScore} />
                          </td>
                          <td>
                            <span
                              className="vt-mono"
                              style={{
                                fontSize: 10,
                                color: "var(--vt-text-faint)",
                                whiteSpace: "nowrap",
                              }}
                              title={new Date(scan.createdAt).toLocaleString()}
                            >
                              {formatRelative(scan.createdAt)}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
                              <Link
                                to={`/scan/${scan.id}`}
                                className="vt-button vt-button--ghost vt-button--sm"
                                style={{ padding: "3px 7px" }}
                                aria-label={`Open ${scan.domain} report`}
                              >
                                <ArrowRight size={13} aria-hidden="true" />
                              </Link>
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label={`Delete ${scan.domain}`}
                                style={{ padding: "3px 7px" }}
                                onClick={() => setDeleteTarget(scan)}
                              >
                                <Trash2 size={13} aria-hidden="true" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <p
            className="vt-mono"
            style={{
              margin: "10px 2px",
              fontSize: 9,
              color: "var(--vt-text-faint)",
              letterSpacing: "0.04em",
            }}
          >
            {history.total} records · API retention depends on STORAGE_DRIVER and retention settings
            ·{" "}
            <Link to="/settings" style={{ color: "var(--vt-lime)" }}>
              storage settings
            </Link>
          </p>
        </>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        busy={deleting}
        title="Delete this scan?"
        confirmLabel="Delete scan"
        description={
          <>
            {deleteTarget ? hostnameOf(deleteTarget.url) : "This scan"} and its report will be
            removed from the API. Any public link stops working. This cannot be undone.
          </>
        }
      />

      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={clearAll}
        busy={clearing}
        title="Clear all scan history?"
        confirmLabel="Delete all scans"
        description="Every scan and report stored by this API instance will be deleted, including active public links. This cannot be undone."
      />
    </div>
  );
}
