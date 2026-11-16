import { Link } from "react-router-dom";

export function Logo({ compact = false }: { compact?: boolean }): React.ReactNode {
  return (
    <Link
      to="/"
      aria-label="VibeTrace home"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        textDecoration: "none",
        color: "var(--vt-text)",
      }}
    >
      <svg
        width="30"
        height="30"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        style={{ flex: "0 0 auto" }}
      >
        <rect x="0.5" y="0.5" width="31" height="31" rx="7" stroke="var(--vt-border-strong)" />
        <path d="M7 9l7 17h3l7-17h-4l-4.5 12L11 9H7z" fill="var(--vt-lime)" />
        <path d="M22 9h3v3h-3z" fill="var(--vt-text)" opacity="0.75" />
      </svg>
      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
        <span
          className="vt-mono"
          style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.06em" }}
        >
          VIBE<span style={{ color: "var(--vt-lime)" }}>TRACE</span>
        </span>
        {!compact ? (
          <span
            className="vt-mono"
            style={{
              marginTop: 5,
              fontSize: 8,
              letterSpacing: "0.24em",
              color: "var(--vt-text-faint)",
            }}
          >
            WEB FORENSICS
          </span>
        ) : null}
      </span>
    </Link>
  );
}
