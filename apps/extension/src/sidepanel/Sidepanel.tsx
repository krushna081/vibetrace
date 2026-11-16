import { useState, type ReactNode } from "react";
import { ArrowUpRight, RefreshCw, Settings2, SlidersHorizontal } from "lucide-react";
import { Badge, Button } from "@vibetrace/design-system";
import { Logo } from "../components/Logo.js";
import { LastScanCard, PrivacyNote, ScanPanel } from "../components/ScanPanel.js";
import { SettingsPanel } from "../components/SettingsPanel.js";
import { useExtension } from "../hooks/useExtension.js";

export function Sidepanel(): ReactNode {
  const controller = useExtension();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="ext-surface ext-sidepanel">
      <header className="ext-header ext-sidepanel-header">
        <Logo />
        <div className="ext-header-actions">
          <span className="ext-sidepanel-label">SIDE PANEL</span>
          <button
            type="button"
            className="ext-icon-button"
            onClick={() => void controller.refreshTab()}
            aria-label="Refresh current tab"
            title="Refresh current tab"
          >
            <RefreshCw size={15} />
          </button>
          <button
            type="button"
            className={`ext-icon-button ${settingsOpen ? "is-active" : ""}`}
            onClick={() => setSettingsOpen((current) => !current)}
            aria-label="Toggle API settings"
            aria-pressed={settingsOpen}
            title="API settings"
          >
            <Settings2 size={16} />
          </button>
        </div>
      </header>

      <main className="ext-main">
        <div className="ext-context-strip">
          <span className="ext-live-dot" aria-hidden="true" />
          <span>
            {controller.phase === "analyzing"
              ? "Analysis running"
              : controller.phase === "done"
                ? "Report ready"
                : "Ready for the active tab"}
          </span>
          <Badge tone={controller.health?.status === "ok" ? "lime" : "amber"}>
            {controller.health ? `API ${controller.health.status}` : "API offline"}
          </Badge>
        </div>

        <ScanPanel controller={controller} onOpenSettings={() => setSettingsOpen(true)} />

        {controller.session?.report ? (
          <div className="ext-sidepanel-link">
            <Button
              variant="secondary"
              size="sm"
              block
              leadingIcon={<ArrowUpRight size={14} />}
              onClick={() => {
                if (controller.session) void controller.openReport(controller.session.id);
              }}
            >
              Open report in website
            </Button>
          </div>
        ) : null}

        <LastScanCard controller={controller} />
        <PrivacyNote />

        <section className="ext-card ext-how" aria-labelledby="ext-how-heading">
          <div className="ext-eyebrow">How this works</div>
          <h2 id="ext-how-heading">One shared engine</h2>
          <ol className="ext-steps">
            <li>
              <span>01</span>
              <div>
                <strong>Capture</strong>
                <p>A read-only content script builds a bounded, redacted DOM skeleton.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Analyze</strong>
                <p>
                  The Fastify API runs the same evidence, technology and scoring pipeline as the web
                  app.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Explain</strong>
                <p>
                  Open the full report for checks, evidence, limitations and fixes. Scores are never
                  fabricated.
                </p>
              </div>
            </li>
          </ol>
        </section>

        {settingsOpen ? (
          <SettingsPanel controller={controller} onClose={() => setSettingsOpen(false)} />
        ) : (
          <button
            type="button"
            className="ext-settings-teaser"
            onClick={() => setSettingsOpen(true)}
          >
            <SlidersHorizontal size={14} aria-hidden="true" />
            API and website connection settings
          </button>
        )}
      </main>

      <footer className="ext-footer">
        <span>Sanitized snapshot mode</span>
        <span>v0.1.0 · MV3</span>
      </footer>
    </div>
  );
}
