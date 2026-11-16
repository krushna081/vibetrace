import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, ExternalLink, PlugZap, Save } from "lucide-react";
import { Button, Field, TextInput } from "@vibetrace/design-system";
import type { ExtensionController } from "../hooks/useExtension.js";
import { errorMessage } from "../lib/extension-api.js";

export function SettingsPanel({
  controller,
  onClose,
}: {
  controller: ExtensionController;
  onClose?: () => void;
}): ReactNode {
  const { settings, health, saveSettings, testConnection, openWeb } = controller;
  const [apiBaseUrl, setApiBaseUrl] = useState(settings?.apiBaseUrl ?? "http://localhost:8787");
  const [webBaseUrl, setWebBaseUrl] = useState(settings?.webBaseUrl ?? "http://localhost:5173");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    setApiBaseUrl(settings.apiBaseUrl);
    setWebBaseUrl(settings.webBaseUrl);
  }, [settings]);

  const onTest = async () => {
    setError(null);
    setNotice(null);
    setTesting(true);
    try {
      const result = await testConnection(apiBaseUrl);
      setNotice(
        `Connected to VibeTrace API v${result.health.version} (${result.health.status}). Storage: ${result.health.storage}.`,
      );
      if (result.health.ai.enabled) {
        setNotice((current) => `${current ?? ""} AI narrative is configured on the server.`);
      }
    } catch (testError) {
      setError(errorMessage(testError));
    } finally {
      setTesting(false);
    }
  };

  const onSave = async () => {
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      const saved = await saveSettings({ apiBaseUrl, webBaseUrl });
      setApiBaseUrl(saved.apiBaseUrl);
      setWebBaseUrl(saved.webBaseUrl);
      setNotice("Connection settings saved.");
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="ext-card ext-settings" aria-labelledby="ext-settings-heading">
      <div className="ext-settings-head">
        <div>
          <div className="ext-eyebrow">Configuration</div>
          <h2 id="ext-settings-heading">API connection</h2>
        </div>
        {onClose ? (
          <Button variant="ghost" size="sm" onClick={onClose}>
            Done
          </Button>
        ) : null}
      </div>

      <p className="ext-settings-copy">
        The extension uses the same VibeTrace analysis engine as the website. Point it at a local or
        deployed API. Page access stays limited to the tab you explicitly analyze.
      </p>

      <div className="ext-form">
        <Field
          label="API base URL"
          htmlFor="ext-api-url"
          hint="Example: http://localhost:8787 or https://vibetrace-api.example.com"
        >
          <TextInput
            id="ext-api-url"
            value={apiBaseUrl}
            onChange={(event) => setApiBaseUrl(event.target.value)}
            placeholder="http://localhost:8787"
            autoComplete="url"
            spellCheck={false}
          />
        </Field>

        <Field
          label="Website base URL"
          htmlFor="ext-web-url"
          hint="Used for full report links. Example: http://localhost:5173"
        >
          <TextInput
            id="ext-web-url"
            value={webBaseUrl}
            onChange={(event) => setWebBaseUrl(event.target.value)}
            placeholder="http://localhost:5173"
            autoComplete="url"
            spellCheck={false}
          />
        </Field>
      </div>

      {error ? (
        <p className="ext-form-message ext-form-message--error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="ext-form-message ext-form-message--ok" role="status">
          <CheckCircle2 size={13} aria-hidden="true" /> {notice}
        </p>
      ) : null}

      <div className="ext-settings-actions">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void onTest()}
          loading={testing}
          leadingIcon={<PlugZap size={14} />}
        >
          Test
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => void onSave()}
          loading={saving}
          leadingIcon={<Save size={14} />}
        >
          Save settings
        </Button>
      </div>

      <div className="ext-health-line">
        <span
          className={`ext-health-dot ${health ? (health.status === "ok" ? "is-ok" : "is-degraded") : "is-down"}`}
          aria-hidden="true"
        />
        {health
          ? `API ${health.status} · v${health.version} · ${health.storage} storage`
          : "API not reachable with current settings"}
      </div>

      <p className="ext-permission-note">
        Saving or testing may ask Chrome for access to the API origin. That permission is used only
        for VibeTrace requests. The extension never asks for access to all websites; page snapshots
        use the temporary active-tab grant from your click.
      </p>

      <button
        type="button"
        className="ext-text-button"
        onClick={() => void openWeb("/methodology")}
      >
        <ExternalLink size={13} aria-hidden="true" /> Read the methodology
      </button>
    </section>
  );
}
