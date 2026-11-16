import { useState, type ReactNode } from "react";
import { ExternalLink, PanelRightOpen, Settings, X } from "lucide-react";
import { Logo } from "../components/Logo.js";
import { LastScanCard, PrivacyNote, ScanPanel } from "../components/ScanPanel.js";
import { SettingsPanel } from "../components/SettingsPanel.js";
import { useExtension } from "../hooks/useExtension.js";
import { errorMessage } from "../lib/extension-api.js";

function HealthDot({
  status,
  version,
}: {
  status: "ok" | "degraded" | null;
  version?: string;
}): ReactNode {
  const label =
    status === "ok" ? "API connected" : status === "degraded" ? "API degraded" : "API offline";
  return (
    <span
      className={`ext-health-dot ${status === "ok" ? "is-ok" : status === "degraded" ? "is-degraded" : "is-down"}`}
      title={version ? `${label} · v${version}` : label}
      aria-label={label}
      role="img"
    />
  );
}

export function Popup(): ReactNode {
  const controller = useExtension();
  const [view, setView] = useState<"scan" | "settings">("scan");
  const [panelError, setPanelError] = useState<string | null>(null);

  const openPanel = async () => {
    setPanelError(null);
    try {
      await controller.openSidePanel();
      window.close();
    } catch (error) {
      setPanelError(errorMessage(error));
    }
  };

  return (
    <div className="ext-surface ext-popup">
      <header className="ext-header">
        <Logo />
        <div className="ext-header-actions">
          <HealthDot
            status={controller.health?.status ?? null}
            version={controller.health?.version}
          />
          <button
            type="button"
            className="ext-icon-button"
            aria-label={view === "settings" ? "Close settings" : "Open settings"}
            title={view === "settings" ? "Close settings" : "API settings"}
            onClick={() => setView((current) => (current === "settings" ? "scan" : "settings"))}
          >
            {view === "settings" ? <X size={16} /> : <Settings size={16} />}
          </button>
          <button
            type="button"
            className="ext-icon-button"
            aria-label="Open VibeTrace side panel"
            title="Open side panel"
            onClick={() => void openPanel()}
          >
            <PanelRightOpen size={16} />
          </button>
        </div>
      </header>

      <main className="ext-main">
        {view === "settings" ? (
          <SettingsPanel controller={controller} onClose={() => setView("scan")} />
        ) : (
          <>
            <ScanPanel controller={controller} compact onOpenSettings={() => setView("settings")} />
            <LastScanCard controller={controller} />
            <PrivacyNote compact />
          </>
        )}

        {panelError ? (
          <p className="ext-form-message ext-form-message--error" role="alert">
            {panelError}
          </p>
        ) : null}
      </main>

      <footer className="ext-footer">
        <button
          type="button"
          className="ext-text-button"
          onClick={() => void controller.openWeb("/")}
        >
          VibeTrace website <ExternalLink size={11} aria-hidden="true" />
        </button>
        <span>v0.1.0 · MV3</span>
      </footer>
    </div>
  );
}
