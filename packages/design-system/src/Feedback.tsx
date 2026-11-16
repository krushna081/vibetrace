import type { CSSProperties, ReactNode } from "react";
import { cn } from "./cn.js";

export type FeedbackTone = "info" | "success" | "warn" | "danger";

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: FeedbackTone;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}): ReactNode {
  return (
    <div
      className={cn("vt-alert", `vt-alert--${tone}`, className)}
      role={tone === "danger" ? "alert" : "note"}
    >
      <div>
        {title ? <p className="vt-alert-title">{title}</p> : null}
        <p>{children}</p>
      </div>
    </div>
  );
}

export function Progress({
  value,
  label,
  indeterminate = false,
  className,
}: {
  value?: number;
  label?: string;
  indeterminate?: boolean;
  className?: string;
}): ReactNode {
  const clamped = Math.max(0, Math.min(100, Math.round(value ?? 0)));
  return (
    <div
      className={cn("vt-progress", className)}
      role="progressbar"
      aria-label={label ?? "Progress"}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : clamped}
    >
      <div
        className={cn("vt-progress-bar", indeterminate && "vt-progress-bar--indeterminate")}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function Skeleton({
  width = "100%",
  height = 14,
  radius,
  className,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  className?: string;
  style?: CSSProperties;
}): ReactNode {
  return (
    <span
      className={cn("vt-skeleton", className)}
      style={{ display: "block", width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}

export function Spinner({ label = "Loading" }: { label?: string }): ReactNode {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }} role="status">
      <span className="vt-spinner" aria-hidden="true" />
      <span className="vt-visually-hidden">{label}</span>
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}): ReactNode {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "44px 20px",
        textAlign: "center",
      }}
    >
      {icon ? (
        <div
          aria-hidden="true"
          style={{
            display: "grid",
            placeItems: "center",
            width: 42,
            height: 42,
            marginBottom: 2,
            border: "1px solid var(--vt-border)",
            borderRadius: 10,
            background: "var(--vt-graphite)",
            color: "var(--vt-lime)",
          }}
        >
          {icon}
        </div>
      ) : null}
      <p style={{ margin: 0, fontSize: 14, fontWeight: 650 }}>{title}</p>
      {description ? (
        <p style={{ margin: 0, maxWidth: 440, color: "var(--vt-text-muted)", fontSize: 13 }}>
          {description}
        </p>
      ) : null}
      {action ? <div style={{ marginTop: 6 }}>{action}</div> : null}
    </div>
  );
}
