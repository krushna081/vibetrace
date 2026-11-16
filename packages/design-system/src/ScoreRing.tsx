import type { ReactNode } from "react";
import { scoreTone, scoreToneColor } from "./tokens.js";

export function ScoreRing({
  value,
  label,
  size = 104,
  thickness = 6,
  caption,
}: {
  value: number | null | undefined;
  label: string;
  size?: number;
  thickness?: number;
  caption?: string;
}): ReactNode {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const known = value !== null && value !== undefined && !Number.isNaN(value);
  const clamped = known ? Math.max(0, Math.min(100, value)) : 0;
  const offset = circumference - (clamped / 100) * circumference;
  const tone = scoreTone(value);
  const color = scoreToneColor[tone];

  return (
    <div
      role="img"
      aria-label={`${label}: ${known ? `${Math.round(clamped)} out of 100` : "unavailable"}`}
      style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 6 }}
    >
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--vt-graphite)"
            strokeWidth={thickness}
          />
          {known ? (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={thickness}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{ transition: "stroke-dashoffset 500ms ease" }}
            />
          ) : null}
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 0,
          }}
        >
          <span
            className="vt-mono"
            style={{ fontSize: size * 0.26, fontWeight: 650, lineHeight: 1, color }}
          >
            {known ? Math.round(clamped) : "—"}
          </span>
          {caption ? (
            <span
              style={{
                marginTop: 4,
                fontSize: 9,
                letterSpacing: "0.08em",
                color: "var(--vt-text-faint)",
                textTransform: "uppercase",
              }}
            >
              {caption}
            </span>
          ) : null}
        </div>
      </div>
      <span
        style={{
          fontFamily: "var(--vt-font-mono)",
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--vt-text-muted)",
        }}
      >
        {label}
      </span>
    </div>
  );
}
