import type { ScanReport } from "@vibetrace/shared-types";
import { formatDate, formatDuration } from "./format.js";

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  const successful = document.execCommand("copy");
  document.body.removeChild(area);
  if (!successful) throw new Error("Clipboard access is unavailable in this browser.");
}

export function downloadJson(report: ScanReport): void {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `vibetrace-${slugify(report.scan.domain)}-${report.scan.id.slice(0, 8)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function buildReportSummary(report: ScanReport): string {
  const scores = report.scores;
  const lines = [
    `VibeTrace report — ${report.scan.domain}`,
    `URL: ${report.scan.finalUrl ?? report.scan.url}`,
    `Generated: ${formatDate(report.generatedAt)} · Engine ${report.engineVersion}`,
    `Duration: ${formatDuration(report.scan.durationMs)} · HTTP ${report.scan.httpStatus ?? "unavailable"}`,
    `Status: ${report.scan.status.replace("_", " ")}`,
    "",
    "SCORES (0–100; not all categories may be available)",
    `AI signals: ${scores.aiSignals.signalScore ?? "—"} (${scores.aiSignals.label}; not a probability)`,
    `Technology confidence: ${scores.technologyConfidence.score ?? "—"} (${scores.technologyConfidence.label})`,
    `Code quality: ${scores.codeQuality.score ?? "—"}`,
    `Security: ${scores.security.score ?? "—"}`,
    `Performance: ${scores.performance.score ?? "—"}`,
    `Accessibility: ${scores.accessibility.score ?? "—"}`,
    `SEO: ${scores.seo.score ?? "—"}`,
    "",
    "KEY FINDINGS",
    ...(report.overview.keyFindings.length
      ? report.overview.keyFindings.map((finding) => `- ${finding}`)
      : ["- No key findings were produced."]),
    "",
    "DETECTED TECHNOLOGIES",
    ...(report.technologies.length
      ? report.technologies
          .slice(0, 20)
          .map((tech) => `- ${tech.name} (${tech.category}, ${tech.confidence}% confidence)`)
      : ["- None crossed the detection threshold."]),
    "",
    "TOP RECOMMENDATIONS",
    ...(report.recommendations.length
      ? report.recommendations
          .slice(0, 10)
          .map((item) => `- [${item.priority.toUpperCase()}] ${item.title}: ${item.detail}`)
      : ["- None."]),
    "",
    "LIMITATIONS",
    ...report.limitations.map((item) => `- ${item}`),
    "",
    "The AI signal index summarizes observed evidence. It is not a probability and does not identify authorship.",
    `Report id: ${report.scan.id}`,
  ];
  return lines.join("\n");
}
