import type { ReactNode } from "react";
import { Globe2, Lock, ScanLine, Settings2 } from "lucide-react";
import { Alert, Badge, Button, Progress, Skeleton } from "@vibetrace/design-system";
import type { ExtensionController } from "../hooks/useExtension.js";
import { isAnalyzableUrl } from "../lib/extension-api.js";
import { ResultSummary } from "./ResultSummary.js";

function statusLabel(controller: ExtensionController): string {
  if (controller.phase === "capturing") return "Capturing sanitized snapshot…";
  if (controller.phase === "analyzing") return "Analyzing evidence…";
  if (controller.phase === "done") return "Analysis complete";
  if (controller.phase === "error") return "Analysis interrupted";
  return "Ready to analyze";
}

export function ScanPanel({
  controller,
  compact = false,
  onOpenSettings,
}: {
  controller: ExtensionController;
  compact?: boolean;
  onOpenSettings?: () => void;
}): ReactNode {
  const { tab, session, phase, busy, error, canAnalyze, recent } = controller;
  const report = session?.report ?? null;
  const analyzable = isAnalyzableUrl(tab?.url);
  const title = tab?.title?.trim() || "Current tab";
  const domain = tab?.url ? new URL(tab.url).hostname.replace(/^www\./, "") : "No website selected";
  const progress = session?.progress;

  return (
    <section className="ext-card ext-scan" aria-labelledby="ext-scan-heading">
      <div className="ext-site">
        <div className="ext-site-icon" aria-hidden="true">
          {analyzable ? domain.slice(0, 1).toUpperCase() : <Lock size={15} />}
        </div>
        <div className="ext-site-copy">
          <h2 id="ext-scan-heading" className="ext-site-title" title={title}>
            {title}
          </h2>
          <p className="ext-site-domain">{domain}</p>
        </div>
        <Badge tone={analyzable ? "cyan" : "neutral"}>
          {analyzable ? "ACTIVE TAB" : "BLOCKED"}
        </Badge>
      </div>

      {controller.loading ? (
        <div style={{ paddingTop: 16 }}>
          <Skeleton height={12} width="72%" />
          <div style={{ height: 8 }} />
          <Skeleton height={12} width="48%" />
        </div>
      ) : !analyzable ? (
        <div style={{ paddingTop: 14 }}>
          <Alert tone="warn" title="This page is off limits">
            Chrome does not allow extensions to read internal pages, the Web Store, other extensions
            or local files. Open a normal public website and click the VibeTrace action again.
          </Alert>
          <div className="ext-privacy-line">
            <Globe2 size={13} aria-hidden="true" /> Need a public URL? Analyze directly on the
            VibeTrace website.
          </div>
        </div>
      ) : (
        <>
          <div className="ext-scan-row">
            <div className="ext-scan-status">
              <span
                className={`ext-live-dot ${busy ? "ext-live-dot--busy" : ""}`}
                aria-hidden="true"
              />
              <span>{statusLabel(controller)}</span>
            </div>
            <span className="ext-mode-chip">
              <ScanLine size={12} aria-hidden="true" /> Snapshot
            </span>
          </div>

          {busy && progress ? (
            <div className="ext-progress">
              <Progress
                value={progress.percent}
                label={progress.stage}
                indeterminate={progress.percent <= 2}
              />
              <div className="ext-progress-meta">
                <span>{progress.stage}</span>
                <span>{Math.round(progress.percent)}%</span>
              </div>
              {progress.message ? <p className="ext-progress-message">{progress.message}</p> : null}
            </div>
          ) : null}

          {error ? (
            <Alert tone="danger" title="Could not finish">
              {error}
            </Alert>
          ) : null}

          {phase !== "done" && (!report || error) ? (
            <div className="ext-primary-action">
              <Button
                variant="primary"
                block
                size={compact ? "md" : "lg"}
                loading={busy}
                onClick={() => void controller.startScan()}
                disabled={!canAnalyze || busy}
                leadingIcon={!busy ? <ScanLine size={16} /> : undefined}
              >
                {phase === "capturing"
                  ? "Capturing page…"
                  : phase === "analyzing"
                    ? "Analyzing…"
                    : "Analyze current tab"}
              </Button>
              <p className="ext-action-note">
                Reads a sanitized DOM snapshot. No form values, passwords, cookies, history or
                keystrokes leave the tab.
              </p>
              {error && onOpenSettings ? (
                <button type="button" className="ext-text-button" onClick={onOpenSettings}>
                  <Settings2 size={13} aria-hidden="true" /> Check API connection settings
                </button>
              ) : null}
            </div>
          ) : null}

          {report && phase === "done" ? (
            <ResultSummary
              report={report}
              compact={compact}
              onOpenReport={() => {
                const id = session?.id ?? recent?.id;
                if (id) void controller.openReport(id);
              }}
            />
          ) : null}

          {report && phase === "done" ? (
            <Button
              variant="ghost"
              size="sm"
              block
              onClick={() => void controller.startScan()}
              disabled={busy}
              leadingIcon={<ScanLine size={14} />}
            >
              Analyze again
            </Button>
          ) : null}
        </>
      )}
    </section>
  );
}

export function LastScanCard({ controller }: { controller: ExtensionController }): ReactNode {
  const { recent, phase } = controller;
  if (!recent || phase === "analyzing" || phase === "capturing") return null;
  const canOpen = recent.status === "completed" || recent.status === "partially_completed";
  return (
    <section className="ext-card ext-recent" aria-label="Last analysis">
      <div className="ext-eyebrow">Last analysis</div>
      <div className="ext-recent-row">
        <div>
          <p className="ext-recent-domain">{recent.domain}</p>
          <p className="ext-recent-meta">
            {new Date(recent.createdAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            · {recent.status.replace("_", " ")}
          </p>
        </div>
        {canOpen ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void controller.openReport(recent.id)}
          >
            Open
          </Button>
        ) : (
          <Badge tone={recent.status === "failed" ? "red" : "amber"}>
            {recent.status.replace("_", " ")}
          </Badge>
        )}
      </div>
    </section>
  );
}

export function PrivacyNote({ compact = false }: { compact?: boolean }): ReactNode {
  return (
    <section className="ext-privacy" aria-label="Privacy">
      <div className="ext-privacy-title">
        <Lock size={13} aria-hidden="true" /> Privacy boundary
      </div>
      <p>
        VibeTrace inspects metadata, technology artifacts and sanitized DOM structure. It does not
        read form values, password fields, cookies, local storage, browsing history or keystrokes.
        {compact
          ? ""
          : " Screenshots, full page text, form contents and raw source are never uploaded."}
      </p>
    </section>
  );
}
