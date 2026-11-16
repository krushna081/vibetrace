import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Bot,
  CheckCircle2,
  Database,
  Download,
  ExternalLink,
  Laptop,
  Moon,
  RefreshCcw,
  Server,
  Settings2,
  Sun,
  Trash2,
} from "lucide-react";
import type { ClientHealth } from "@vibetrace/api-client";
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  PageHeader,
  Switch,
  TextInput,
} from "@vibetrace/design-system";
import { useHealth, usePageTitle } from "../hooks/use-api.js";
import { useSettings } from "../providers/SettingsProvider.js";
import { useToast } from "../providers/ToastProvider.js";
import {
  createClientFor,
  DEFAULT_API_BASE_URL,
  normalizeApiBaseUrl,
  type ThemePreference,
} from "../lib/settings.js";
import { getApiClient } from "../lib/settings.js";
import { clearReportCache } from "../lib/report-cache.js";
import { describeError } from "../lib/errors.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";

const THEMES: Array<{ value: ThemePreference; label: string; icon: typeof Moon; detail: string }> =
  [
    { value: "dark", label: "Dark", icon: Moon, detail: "Charcoal surfaces, lime accent" },
    { value: "light", label: "Light", icon: Sun, detail: "Paper surfaces, ink typography" },
    { value: "system", label: "System", icon: Laptop, detail: "Follow the OS preference" },
  ];

export function SettingsPage(): ReactNode {
  usePageTitle("Settings");
  const { settings, updateSettings, setTheme } = useSettings();
  const { toast } = useToast();
  const health = useHealth();
  const [apiUrl, setApiUrl] = useState(settings.apiBaseUrl);
  const [apiError, setApiError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testingDraft, setTestingDraft] = useState(false);
  const [testResult, setTestResult] = useState<ClientHealth | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const saveApi = (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizeApiBaseUrl(apiUrl);
    if (!normalized) {
      setApiError("Enter an absolute http(s) API URL without embedded credentials.");
      return;
    }
    setApiError(null);
    updateSettings({ apiBaseUrl: normalized });
    setApiUrl(normalized);
    toast({ tone: "success", title: "API base URL saved", message: normalized });
  };

  const testConnection = async (useDraft: boolean) => {
    const client = createClientFor(useDraft ? apiUrl : settings.apiBaseUrl);
    if (!client) {
      setApiError("Enter a valid API URL before testing.");
      return;
    }
    if (useDraft) setTestingDraft(true);
    else setTesting(true);
    setTestResult(null);
    setApiError(null);
    try {
      const result = await client.health();
      setTestResult(result);
      toast({
        tone: "success",
        title: "API reachable",
        message: `v${result.version} · ${result.storage} storage`,
      });
    } catch (err) {
      setApiError(describeError(err).message);
      toast({ tone: "error", title: "API unreachable", message: describeError(err).message });
    } finally {
      if (useDraft) setTestingDraft(false);
      else setTesting(false);
    }
  };

  const exportIndex = async () => {
    setExporting(true);
    try {
      const result = await getApiClient().listScans(200);
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `vibetrace-scan-index-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast({
        tone: "success",
        title: "Scan index exported",
        message: `${result.scans.length} summaries`,
      });
    } catch (err) {
      toast({ tone: "error", title: "Export failed", message: describeError(err).message });
    } finally {
      setExporting(false);
    }
  };

  const clearServerScans = async () => {
    setClearing(true);
    try {
      const deleted = await getApiClient().clearScans();
      clearReportCache();
      setClearOpen(false);
      toast({
        tone: "success",
        title: `${deleted} server scan${deleted === 1 ? "" : "s"} deleted`,
      });
    } catch (err) {
      toast({ tone: "error", title: "Could not clear scans", message: describeError(err).message });
    } finally {
      setClearing(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Local preferences, explicit connections."
        description="VibeTrace has no account system. Theme, API endpoint and AI consent live in this browser's local storage. Nothing is sent anywhere by saving these preferences."
      />

      <div style={{ display: "grid", gap: 14, maxWidth: 920 }}>
        <Card>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--vt-border)" }}>
            <h2 style={{ margin: 0, fontSize: 15 }}>Appearance</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--vt-text-muted)" }}>
              Dark is the default. The theme is stored locally and applied before first paint.
            </p>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-3">
            {THEMES.map((theme) => {
              const Icon = theme.icon;
              const active = settings.theme === theme.value;
              return (
                <button
                  key={theme.value}
                  type="button"
                  onClick={() => setTheme(theme.value)}
                  aria-pressed={active}
                  style={{
                    textAlign: "left",
                    padding: "12px 14px",
                    border: "1px solid",
                    borderColor: active ? "var(--vt-lime)" : "var(--vt-border)",
                    borderRadius: 8,
                    background: active ? "var(--vt-lime-glow)" : "var(--vt-black)",
                    color: "var(--vt-text)",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Icon
                      size={16}
                      style={{ color: active ? "var(--vt-lime)" : "var(--vt-text-muted)" }}
                      aria-hidden="true"
                    />
                    {active ? <Badge tone="lime">active</Badge> : null}
                  </div>
                  <div style={{ marginTop: 9, fontSize: 13, fontWeight: 650 }}>{theme.label}</div>
                  <div style={{ marginTop: 2, fontSize: 11, color: "var(--vt-text-muted)" }}>
                    {theme.detail}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <Card>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--vt-border)" }}>
            <h2 style={{ margin: 0, fontSize: 15 }}>API connection</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--vt-text-muted)" }}>
              Both the web app and extension use the same versioned API. The default is the local
              development server.
            </p>
          </div>
          <form onSubmit={saveApi} style={{ padding: "18px 20px" }} noValidate>
            <Field
              label="API base URL"
              htmlFor="api-base-url"
              hint={`Default: ${DEFAULT_API_BASE_URL}. The client appends /api/v1 automatically.`}
              error={apiError}
            >
              <TextInput
                id="api-base-url"
                type="url"
                inputMode="url"
                spellCheck={false}
                value={apiUrl}
                invalid={Boolean(apiError)}
                onChange={(event) => {
                  setApiUrl(event.target.value);
                  setApiError(null);
                }}
                placeholder="http://localhost:8787"
              />
            </Field>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              <Button type="submit" variant="primary" size="sm">
                Save base URL
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={testingDraft}
                onClick={() => void testConnection(true)}
              >
                Test draft URL
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                loading={testing}
                onClick={() => void testConnection(false)}
              >
                Test saved connection
              </Button>
              <a
                href={`${settings.apiBaseUrl.replace(/\/+$/, "")}/api/v1/docs`}
                target="_blank"
                rel="noreferrer"
                className="vt-button vt-button--ghost vt-button--sm"
              >
                API docs <ExternalLink size={12} aria-hidden="true" />
              </a>
            </div>
            {testResult ? (
              <div style={{ marginTop: 12 }}>
                <Alert tone="success" title={`Connected to VibeTrace API v${testResult.version}`}>
                  {testResult.storage} storage · AI adapter{" "}
                  {testResult.ai.enabled ? `enabled (${testResult.ai.provider})` : "disabled"} ·
                  queue{" "}
                  {testResult.scanQueue
                    ? `${testResult.scanQueue.queued} queued, ${testResult.scanQueue.active} active`
                    : "available"}{" "}
                  · uptime {Math.round(testResult.uptimeSeconds)}s
                </Alert>
              </div>
            ) : null}
          </form>
        </Card>

        <Card>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--vt-border)" }}>
            <h2 style={{ margin: 0, fontSize: 15 }}>API status</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--vt-text-muted)" }}>
              Live health from the currently saved endpoint.
            </p>
          </div>
          <div style={{ padding: "16px 20px", display: "grid", gap: 12 }}>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: Server, label: "Version", value: health.health?.version ?? "—" },
                { icon: Database, label: "Storage", value: health.health?.storage ?? "—" },
                {
                  icon: Bot,
                  label: "AI adapter",
                  value: health.health
                    ? health.health.ai.enabled
                      ? health.health.ai.provider
                      : "disabled"
                    : "—",
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    style={{
                      padding: "10px 12px",
                      border: "1px solid var(--vt-border)",
                      borderRadius: 6,
                      background: "var(--vt-black)",
                    }}
                  >
                    <div
                      className="vt-mono"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 9,
                        letterSpacing: "0.08em",
                        color: "var(--vt-text-faint)",
                        textTransform: "uppercase",
                      }}
                    >
                      <Icon size={11} aria-hidden="true" /> {item.label}
                    </div>
                    <div
                      style={{
                        marginTop: 5,
                        fontSize: 13,
                        fontWeight: 600,
                        textTransform: "capitalize",
                      }}
                    >
                      {item.value}
                    </div>
                  </div>
                );
              })}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                color: "var(--vt-text-muted)",
              }}
            >
              <span
                className={`live-dot${health.error ? " live-dot--offline" : ""}`}
                aria-hidden="true"
              />
              {health.loading
                ? "Checking the saved endpoint…"
                : health.error
                  ? `Unreachable: ${describeError(health.error).message}`
                  : `Online · ${health.health?.scanQueue ? `${health.health.scanQueue.queued} queued / ${health.health.scanQueue.active} active` : "queue unavailable"}`}
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--vt-border)" }}>
            <h2 style={{ margin: 0, fontSize: 15 }}>AI explanation consent</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--vt-text-muted)" }}>
              Applies only to the optional narrative explanation on the AI signals page. The core
              forensic analysis is deterministic and provider-independent.
            </p>
          </div>
          <div style={{ padding: "18px 20px" }}>
            <Switch
              checked={settings.aiConsent}
              onChange={(checked) => {
                updateSettings({ aiConsent: checked });
                toast({
                  tone: "success",
                  title: checked ? "AI narrative consent enabled" : "AI narrative consent disabled",
                  message: checked
                    ? "You can now explicitly send a report summary from the AI page."
                    : "The explanation request is disabled in this browser.",
                });
              }}
              label="Allow explicit report-summary requests to the configured provider"
              description="Even with this enabled, nothing is sent until you press Generate explanation and confirm the request. Raw HTML, cookies and headers are never included."
            />
            {!health.health?.ai.enabled && !health.loading ? (
              <p style={{ margin: "12px 0 0", fontSize: 11, color: "var(--vt-text-faint)" }}>
                The saved API currently reports no configured AI provider. Consent has no effect
                until an operator configures one.
              </p>
            ) : null}
          </div>
        </Card>

        <Card>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--vt-border)" }}>
            <h2 style={{ margin: 0, fontSize: 15 }}>Local data & exports</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--vt-text-muted)" }}>
              The browser stores preferences only. Reports and scan history live on the API store.
            </p>
          </div>
          <div style={{ padding: "18px 20px", display: "grid", gap: 12 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Button
                size="sm"
                variant="secondary"
                loading={exporting}
                onClick={() => void exportIndex()}
              >
                <Download size={14} aria-hidden="true" /> Export scan index (JSON)
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  clearReportCache();
                  toast({ tone: "success", title: "In-browser report cache cleared" });
                }}
              >
                <RefreshCcw size={14} aria-hidden="true" /> Clear report cache
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  updateSettings({
                    theme: "dark",
                    apiBaseUrl: DEFAULT_API_BASE_URL,
                    aiConsent: false,
                  });
                  setApiUrl(DEFAULT_API_BASE_URL);
                  toast({ tone: "success", title: "Local preferences reset to defaults" });
                }}
              >
                <Settings2 size={14} aria-hidden="true" /> Reset preferences
              </Button>
            </div>
            <p style={{ margin: 0, fontSize: 11, color: "var(--vt-text-faint)" }}>
              The scan index export contains summaries only. Open an individual report to export its
              full validated JSON. Themes and consent are never uploaded.
            </p>
          </div>
        </Card>

        <Card style={{ borderColor: "color-mix(in srgb, var(--vt-red) 30%, var(--vt-border))" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--vt-border)" }}>
            <h2 style={{ margin: 0, fontSize: 15, color: "var(--vt-red)" }}>Danger zone</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--vt-text-muted)" }}>
              Deletes all stored scans and reports on the saved API, including active public share
              links. This cannot be undone.
            </p>
          </div>
          <div
            style={{
              padding: "18px 20px",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <div style={{ fontSize: 12, color: "var(--vt-text-muted)" }}>
              Target:{" "}
              <code className="vt-mono" style={{ color: "var(--vt-text)" }}>
                {settings.apiBaseUrl}
              </code>
            </div>
            <Button size="sm" variant="danger" onClick={() => setClearOpen(true)}>
              <Trash2 size={14} aria-hidden="true" /> Delete all server scans
            </Button>
          </div>
        </Card>

        <p
          className="vt-mono"
          style={{
            margin: "0 2px 20px",
            fontSize: 9,
            color: "var(--vt-text-faint)",
            letterSpacing: "0.04em",
          }}
        >
          <CheckCircle2
            size={10}
            style={{ display: "inline", marginRight: 4 }}
            aria-hidden="true"
          />
          No account, no analytics SDK, no hidden sync. Read the{" "}
          <Link to="/privacy" style={{ color: "var(--vt-lime)" }}>
            privacy policy
          </Link>
          .
        </p>
      </div>

      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={clearServerScans}
        busy={clearing}
        title="Delete all server scans?"
        confirmLabel="Delete everything"
        description={`Every scan stored at ${settings.apiBaseUrl} will be permanently removed. Shared links will return 404. The browser preference itself is not affected.`}
      />
    </div>
  );
}
