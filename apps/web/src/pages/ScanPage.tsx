import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Clock3, LoaderCircle, Radar, RefreshCw } from "lucide-react";
import { Alert, Badge, Progress, Terminal, TerminalLine } from "@vibetrace/design-system";
import { useScanSession, usePageTitle } from "../hooks/use-api.js";
import { ErrorPanel } from "../components/ErrorPanel.js";
import { ReportFrame, ReportLoadingSkeleton } from "../components/report/ReportFrame.js";
import { ReportOverview } from "../components/report/Overview.js";
import { formatDuration, hostnameOf } from "../lib/format.js";
import { describeError } from "../lib/errors.js";
import { getApiClient } from "../lib/settings.js";
import { useToast } from "../providers/ToastProvider.js";

interface LogEntry {
  at: number;
  stage: string;
  message?: string;
  percent: number;
}

function ScanProgressView({
  id,
  session,
  onRetry,
}: {
  id: string;
  session: ReturnType<typeof useScanSession>;
  onRetry: () => void;
}): ReactNode {
  const { toast } = useToast();
  const [log, setLog] = useState<LogEntry[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const lastStage = useRef<string>("");

  const target = session.detail?.scan.url ?? "";
  const domain = target ? hostnameOf(target) : "target";
  const percent = Math.round(session.progress.percent);
  const active = session.status?.status === "queued" || session.status?.status === "running";

  useEffect(() => {
    if (!session.progress.stage) return;
    if (lastStage.current === session.progress.stage) {
      setLog((current) => {
        if (current.length === 0) return current;
        const copy = [...current];
        const last = copy[copy.length - 1];
        if (last) copy[copy.length - 1] = { ...last, message: session.progress.message, percent };
        return copy;
      });
      return;
    }
    lastStage.current = session.progress.stage;
    setLog((current) => [
      ...current,
      {
        at: Date.now(),
        stage: session.progress.stage,
        message: session.progress.message,
        percent,
      },
    ]);
  }, [session.progress.stage, session.progress.message, percent]);

  useEffect(() => {
    if (!active) return;
    const tick = () => setElapsed(Math.max(0, Date.now() - session.startedAt));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [active, session.startedAt]);

  const retry = async () => {
    if (!target) return;
    try {
      const result = await getApiClient().createScan({
        url: target,
        mode: "remote",
        client: "web",
      });
      toast({ tone: "success", title: "Replacement scan queued" });
      window.location.assign(`/scan/${result.id}`);
    } catch (error) {
      toast({
        tone: "error",
        title: "Could not queue scan",
        message: describeError(error).message,
      });
    }
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <Link to="/history" className="vt-button vt-button--ghost vt-button--sm">
          <ArrowLeft size={14} aria-hidden="true" /> History
        </Link>
        <span
          className="vt-mono"
          style={{ fontSize: 10, color: "var(--vt-text-faint)", letterSpacing: "0.06em" }}
        >
          SCAN {id.slice(0, 8)}
        </span>
      </div>

      <div
        className="scan-beam"
        style={{
          border: "1px solid var(--vt-border-strong)",
          borderRadius: 12,
          background: "var(--vt-panel)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "clamp(20px, 4vw, 32px)" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 18,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <span className="vt-eyebrow">
                <Radar size={12} aria-hidden="true" />{" "}
                {active ? "Analysis in progress" : "Scan status"}
              </span>
              <h1
                style={{
                  margin: "10px 0 0",
                  fontSize: "clamp(26px, 4.4vw, 38px)",
                  letterSpacing: "-0.04em",
                  lineHeight: 1.08,
                  overflowWrap: "anywhere",
                }}
              >
                {domain}
              </h1>
              <p
                className="vt-mono"
                style={{
                  margin: "7px 0 0",
                  fontSize: 11,
                  color: "var(--vt-text-muted)",
                  overflowWrap: "anywhere",
                }}
              >
                {target || "Preparing target…"}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                <Badge tone={session.status?.status === "running" ? "cyan" : "neutral"}>
                  {session.status?.status?.replace("_", " ") ?? "loading"}
                </Badge>
                <Badge tone="lime">{percent}%</Badge>
                <Badge>
                  <Clock3 size={10} aria-hidden="true" /> {formatDuration(elapsed)}
                </Badge>
                <Badge>Server crawl</Badge>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                className="vt-mono"
                style={{
                  fontSize: "clamp(40px, 8vw, 64px)",
                  lineHeight: 0.9,
                  fontWeight: 650,
                  color: "var(--vt-lime)",
                }}
              >
                {percent}
                <span style={{ fontSize: 18, color: "var(--vt-text-faint)" }}>%</span>
              </div>
              <div
                className="vt-mono"
                style={{
                  marginTop: 6,
                  fontSize: 9,
                  letterSpacing: "0.1em",
                  color: "var(--vt-text-faint)",
                  textTransform: "uppercase",
                }}
              >
                Overall progress
              </div>
            </div>
          </div>

          <div style={{ marginTop: 22 }}>
            <Progress value={percent} label="Scan progress" />
            <div
              style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 8 }}
            >
              <span style={{ fontSize: 12, color: "var(--vt-text)" }}>
                {session.progress.stage}
                {session.progress.message ? (
                  <span style={{ color: "var(--vt-text-muted)" }}>
                    {" "}
                    — {session.progress.message}
                  </span>
                ) : null}
              </span>
              <span className="vt-mono" style={{ fontSize: 10, color: "var(--vt-text-faint)" }}>
                {percent}/100
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: 14,
            padding: "0 clamp(20px, 4vw, 32px) clamp(20px, 4vw, 32px)",
          }}
          className="lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
        >
          <Terminal
            title="live stage log"
            footer="Observed stages from the analysis worker. Leaving does not cancel the scan."
          >
            {log.length === 0 ? (
              <TerminalLine prompt="…" tone="muted">
                Waiting for the first progress update
              </TerminalLine>
            ) : (
              log.map((entry, index) => (
                <TerminalLine
                  key={`${entry.stage}-${index}`}
                  prompt={String(index + 1).padStart(2, "0")}
                  tone={index === log.length - 1 ? "lime" : "muted"}
                >
                  <span style={{ color: "var(--vt-text)" }}>{entry.stage}</span>
                  <span style={{ color: "var(--vt-text-faint)" }}> · {entry.percent}%</span>
                  {entry.message ? (
                    <div style={{ color: "var(--vt-text-faint)", fontSize: 10 }}>
                      {entry.message}
                    </div>
                  ) : null}
                </TerminalLine>
              ))
            )}
          </Terminal>

          <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
            <Alert tone="info" title="Asynchronous by design">
              The Fastify worker continues even if this tab closes. Reopen the scan from History to
              resume live progress or read the completed report.
            </Alert>
            {session.pollError ? (
              <Alert tone="warn" title="Live updates interrupted">
                {describeError(session.pollError).message} The scan may still be running.
              </Alert>
            ) : null}
            <div
              className="vt-terminal"
              style={{ padding: "12px 14px", color: "var(--vt-text-muted)", fontSize: 11 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span>Scan id</span>
                <span style={{ color: "var(--vt-text)" }}>{id.slice(0, 8)}</span>
              </div>
              <div
                style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 6 }}
              >
                <span>Created</span>
                <span style={{ color: "var(--vt-text)" }}>
                  {session.status ? new Date(session.status.createdAt).toLocaleTimeString() : "—"}
                </span>
              </div>
              <div
                style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 6 }}
              >
                <span>Poll interval</span>
                <span style={{ color: "var(--vt-text)" }}>1.3 s</span>
              </div>
            </div>
            <button
              type="button"
              className="vt-button vt-button--ghost vt-button--sm"
              onClick={onRetry}
            >
              <RefreshCw size={13} aria-hidden="true" /> Reconnect now
            </button>
          </div>
        </div>
      </div>

      {session.error && !session.loading ? (
        <div style={{ marginTop: 16 }}>
          <ErrorPanel
            error={session.error}
            onRetry={() => void retry()}
            title="This scan did not complete"
            showSettings={false}
          />
          <div style={{ display: "flex", justifyContent: "center", marginTop: 2 }}>
            <Link to="/scan" className="vt-button vt-button--ghost vt-button--sm">
              Start a new scan
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ScanPage(): ReactNode {
  const { id } = useParams();
  const session = useScanSession(id);
  usePageTitle(
    session.report
      ? `${session.report.scan.domain} report`
      : session.detail
        ? `Analyzing ${session.detail.scan.domain}`
        : "Scan",
  );

  if (session.report) {
    return (
      <ReportFrame report={session.report}>
        <ReportOverview report={session.report} />
      </ReportFrame>
    );
  }

  if (session.loading && !session.detail) {
    return (
      <div aria-busy="true" aria-label="Loading scan">
        <ReportLoadingSkeleton />
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: 16,
            color: "var(--vt-text-faint)",
            fontSize: 12,
          }}
        >
          <LoaderCircle
            size={14}
            className="vt-spinner"
            style={{ marginRight: 8 }}
            aria-hidden="true"
          />{" "}
          Contacting the analysis API…
        </div>
      </div>
    );
  }

  if (session.error && !session.detail) {
    return (
      <ErrorPanel
        error={session.error}
        onRetry={session.refresh}
        title="Unable to load this scan"
        showSettings
      />
    );
  }

  return <ScanProgressView id={id ?? ""} session={session} onRetry={session.refresh} />;
}
