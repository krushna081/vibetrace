import type { ReactNode } from "react";

export function Terminal({
  title = "vibetrace",
  children,
  footer,
}: {
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}): ReactNode {
  return (
    <div className="vt-terminal">
      <div className="vt-terminal-bar">
        <span className="vt-terminal-dot" />
        <span className="vt-terminal-dot" />
        <span className="vt-terminal-dot" />
        <span style={{ marginLeft: 8 }}>{title}</span>
      </div>
      <div style={{ padding: "12px 14px" }}>{children}</div>
      {footer ? (
        <div
          style={{
            padding: "9px 14px",
            borderTop: "1px solid var(--vt-border)",
            color: "var(--vt-text-faint)",
            fontSize: 11,
          }}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export function TerminalLine({
  prompt = "$",
  children,
  tone = "default",
}: {
  prompt?: string;
  children: ReactNode;
  tone?: "default" | "lime" | "muted" | "warn" | "danger";
}): ReactNode {
  const color =
    tone === "lime"
      ? "var(--vt-lime)"
      : tone === "warn"
        ? "var(--vt-amber)"
        : tone === "danger"
          ? "var(--vt-red)"
          : tone === "muted"
            ? "var(--vt-text-faint)"
            : "var(--vt-text-muted)";
  return (
    <div style={{ display: "flex", gap: 10, color }}>
      <span style={{ color: "var(--vt-lime)", opacity: 0.8, flex: "0 0 auto" }}>{prompt}</span>
      <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{children}</span>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}): ReactNode {
  return (
    <header
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 18,
        marginBottom: 24,
      }}
    >
      <div style={{ minWidth: 0, maxWidth: 720 }}>
        {eyebrow ? <span className="vt-eyebrow">{eyebrow}</span> : null}
        <h1
          style={{
            margin: eyebrow ? "10px 0 0" : 0,
            fontSize: "clamp(24px, 3.6vw, 34px)",
            lineHeight: 1.12,
            letterSpacing: "-0.035em",
            fontWeight: 650,
          }}
        >
          {title}
        </h1>
        {description ? (
          <p style={{ margin: "8px 0 0", color: "var(--vt-text-muted)", fontSize: 14 }}>
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{actions}</div> : null}
    </header>
  );
}
