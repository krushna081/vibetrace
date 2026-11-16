import { useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Globe2, Lock, Radar } from "lucide-react";
import { Button, TextInput } from "@vibetrace/design-system";
import { getApiClient } from "../lib/settings.js";
import { normalizeUrlInput } from "../lib/format.js";
import { describeError } from "../lib/errors.js";
import { useToast } from "../providers/ToastProvider.js";

export function ScanForm({
  initialUrl = "",
  variant = "card",
  autoFocus = false,
}: {
  initialUrl?: string;
  variant?: "card" | "hero";
  autoFocus?: boolean;
}): ReactNode {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    const normalized = normalizeUrlInput(url);
    if (!normalized) {
      setError("Enter a valid public website URL, e.g. https://example.com.");
      return;
    }
    try {
      const parsed = new URL(normalized);
      if (parsed.username || parsed.password) {
        setError("URLs with embedded credentials are not accepted.");
        return;
      }
    } catch {
      setError("Enter a valid public website URL.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await getApiClient().createScan({
        url: normalized,
        mode: "remote",
        client: "web",
      });
      toast({
        tone: "success",
        title: "Scan queued",
        message: "The analysis worker has started. Progress is live on the report page.",
      });
      navigate(`/scan/${result.id}`);
    } catch (err) {
      setError(describeError(err).message);
      setSubmitting(false);
    }
  };

  const hero = variant === "hero";

  return (
    <form onSubmit={submit} noValidate>
      <div
        style={{
          border: "1px solid var(--vt-border-strong)",
          borderRadius: 10,
          background: "var(--vt-panel)",
          padding: hero ? "10px" : 14,
          boxShadow: hero ? "0 24px 60px rgba(0,0,0,0.35)" : "none",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: hero ? "2px 4px 10px" : "0 0 10px",
          }}
        >
          <span
            className="vt-mono"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 10,
              letterSpacing: "0.12em",
              color: "var(--vt-text-faint)",
              textTransform: "uppercase",
            }}
          >
            <Radar size={12} color="var(--vt-lime)" aria-hidden="true" />
            Target input
          </span>
          <span
            className="vt-mono"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 9,
              letterSpacing: "0.1em",
              color: "var(--vt-text-faint)",
              textTransform: "uppercase",
            }}
          >
            <Lock size={10} aria-hidden="true" /> SSRF-guarded
          </span>
        </div>

        <div
          style={{ display: "flex", gap: 8, alignItems: "stretch" }}
          className="flex flex-col sm:flex-row"
        >
          <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
            <Globe2
              size={16}
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--vt-text-faint)",
                pointerEvents: "none",
              }}
            />
            <label htmlFor="scan-url" className="vt-visually-hidden">
              Website URL to analyze
            </label>
            <TextInput
              id="scan-url"
              name="url"
              type="url"
              inputMode="url"
              autoComplete="url"
              spellCheck={false}
              placeholder="https://example.com"
              value={url}
              autoFocus={autoFocus}
              onChange={(event) => {
                setUrl(event.target.value);
                if (error) setError(null);
              }}
              invalid={Boolean(error)}
              aria-describedby={error ? "scan-url-error" : "scan-url-hint"}
              style={{
                minHeight: 48,
                paddingLeft: 36,
                fontSize: 14,
                background: "var(--vt-black)",
              }}
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={submitting}
            style={{ minWidth: hero ? 168 : undefined }}
          >
            {submitting ? "Queuing scan" : "Analyze site"}
            {!submitting ? <ArrowRight size={15} aria-hidden="true" /> : null}
          </Button>
        </div>

        {error ? (
          <p
            id="scan-url-error"
            role="alert"
            style={{ margin: "9px 2px 0", color: "var(--vt-red)", fontSize: 12 }}
          >
            {error}
          </p>
        ) : (
          <p
            id="scan-url-hint"
            style={{ margin: "9px 2px 0", color: "var(--vt-text-faint)", fontSize: 11 }}
          >
            Public HTTP/HTTPS pages only. The server fetches the page; your browser cookies and
            credentials are never forwarded.
          </p>
        )}
      </div>
    </form>
  );
}
