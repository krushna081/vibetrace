import { useHealth } from "../hooks/use-api.js";
import { describeError } from "../lib/errors.js";

export function ApiStatus({ compact = false }: { compact?: boolean }): React.ReactNode {
  const { health, loading, error, checkedAt } = useHealth();
  const online = Boolean(health) && !error;
  const description = loading
    ? "Checking API connection"
    : online
      ? `API online${health?.version ? ` · v${health.version}` : ""}`
      : `${describeError(error).title}${checkedAt ? "" : ""}`;
  const title = loading
    ? "Checking the VibeTrace API…"
    : online
      ? `API online · storage: ${health?.storage ?? "unknown"}${health?.ai.enabled ? " · AI adapter enabled" : " · AI adapter off"}`
      : describeError(error).message;

  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        color: online ? "var(--vt-text-muted)" : "var(--vt-red)",
        fontFamily: "var(--vt-font-mono)",
        fontSize: 10,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      <span
        className={`live-dot${online || loading ? "" : " live-dot--offline"}`}
        aria-hidden="true"
      />
      {compact ? null : (
        <span>{loading ? "Checking API" : online ? "API online" : "API offline"}</span>
      )}
      {loading ? null : <span className="vt-visually-hidden">{description}</span>}
    </span>
  );
}
