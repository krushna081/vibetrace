import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, RefreshCw, Settings2 } from "lucide-react";
import { Button, Card } from "@vibetrace/design-system";
import { describeError } from "../lib/errors.js";

export function ErrorPanel({
  error,
  onRetry,
  title,
  showSettings = true,
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  showSettings?: boolean;
}): ReactNode {
  const described = describeError(error);
  return (
    <Card style={{ padding: "28px 24px", maxWidth: 680, margin: "24px auto" }}>
      <div style={{ display: "flex", gap: 14 }}>
        <div
          aria-hidden="true"
          style={{
            display: "grid",
            placeItems: "center",
            width: 38,
            height: 38,
            flex: "0 0 auto",
            border: "1px solid color-mix(in srgb, var(--vt-red) 40%, transparent)",
            borderRadius: 8,
            background: "color-mix(in srgb, var(--vt-red) 8%, transparent)",
            color: "var(--vt-red)",
          }}
        >
          <AlertTriangle size={18} />
        </div>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 17, letterSpacing: "-0.02em" }}>
            {title ?? described.title}
          </h2>
          <p style={{ margin: "6px 0 0", color: "var(--vt-text-muted)", fontSize: 13 }}>
            {described.message}
          </p>
          <div
            className="vt-mono"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              marginTop: 8,
              fontSize: 10,
              color: "var(--vt-text-faint)",
            }}
          >
            {described.code ? <span>CODE {described.code}</span> : null}
            {described.requestId ? <span>REQUEST {described.requestId}</span> : null}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
            {onRetry ? (
              <Button variant="secondary" size="sm" onClick={onRetry}>
                <RefreshCw size={14} aria-hidden="true" /> Try again
              </Button>
            ) : null}
            {showSettings ? (
              <Link to="/settings" className="vt-button vt-button--ghost vt-button--sm">
                <Settings2 size={14} aria-hidden="true" /> API settings
              </Link>
            ) : null}
            <Link to="/scan" className="vt-button vt-button--ghost vt-button--sm">
              New scan
            </Link>
          </div>
        </div>
      </div>
    </Card>
  );
}
