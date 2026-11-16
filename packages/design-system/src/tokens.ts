/** Canonical VibeTrace palette. Dark is the default; light is an override. */
export const palette = {
  void: "#050605",
  black: "#080908",
  panel: "#0d0f0c",
  panelRaised: "#121510",
  graphite: "#191c17",
  border: "#242821",
  borderStrong: "#343a2f",
  text: "#eef0e8",
  textMuted: "#a4aa9c",
  textFaint: "#72786c",
  lime: "#c7f65a",
  limeDim: "#9ec93c",
  limeGlow: "rgba(199, 246, 90, 0.12)",
  cyan: "#8fd8ff",
  amber: "#ffc46b",
  red: "#ff8d8d",
  violet: "#c3a6ff",
} as const;

export const fonts = {
  sans: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: '"JetBrains Mono", "SFMono-Regular", ui-monospace, Menlo, Consolas, monospace',
} as const;

export const radii = {
  sm: "4px",
  md: "8px",
  lg: "12px",
  pill: "999px",
} as const;

export const layout = {
  maxWidth: "1180px",
  pagePadding: "clamp(16px, 4vw, 40px)",
} as const;

export type ScoreTone = "excellent" | "good" | "fair" | "poor" | "unknown";

export function scoreTone(score: number | null | undefined): ScoreTone {
  if (score === null || score === undefined || Number.isNaN(score)) return "unknown";
  if (score >= 85) return "excellent";
  if (score >= 65) return "good";
  if (score >= 40) return "fair";
  return "poor";
}

export const scoreToneColor: Record<ScoreTone, string> = {
  excellent: palette.lime,
  good: "#a8e278",
  fair: palette.amber,
  poor: palette.red,
  unknown: palette.textFaint,
};

export function formatScore(score: number | null | undefined): string {
  return score === null || score === undefined || Number.isNaN(score)
    ? "—"
    : String(Math.round(score));
}
