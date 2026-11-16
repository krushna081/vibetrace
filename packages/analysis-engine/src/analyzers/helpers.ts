import type { CheckResult, Metric, SectionId } from "@vibetrace/shared-types";

export interface CheckSpec {
  id: string;
  title: string;
  category: SectionId | string;
  status: CheckResult["status"];
  weight: number;
  basis?: CheckResult["basis"];
  detail: string;
  evidence?: string[];
  recommendation?: string;
}

export function check(spec: CheckSpec): CheckResult {
  return {
    id: spec.id,
    title: spec.title,
    category: spec.category,
    status: spec.status,
    basis: spec.basis ?? "measured",
    weight: spec.weight,
    detail: spec.detail,
    evidence: (spec.evidence ?? []).slice(0, 20),
    recommendation: spec.recommendation,
  };
}

export function unavailable(
  id: string,
  title: string,
  category: SectionId,
  weight: number,
  detail: string,
  recommendation?: string,
): CheckResult {
  return check({
    id,
    title,
    category,
    status: "unavailable",
    weight,
    detail,
    recommendation,
  });
}

export function metric(
  id: string,
  label: string,
  value: string | number | null,
  options: { unit?: string; measured?: boolean; note?: string } = {},
): Metric {
  return {
    id,
    label,
    value,
    unit: options.unit,
    measured: options.measured ?? true,
    note: options.note,
  };
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return "unavailable";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatMs(ms: number | null): string {
  if (ms === null) return "unavailable";
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
}

export function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

export function serviceSummary(score: number | null, area: string): string {
  if (score === null) {
    return `Insufficient data was available to produce a reliable ${area} score. Review the individual checks and missing-data notes.`;
  }
  if (score >= 90) return `${area} configuration scores strongly in this passive review.`;
  if (score >= 75) return `${area} is generally sound, with a few improvements available.`;
  if (score >= 50) return `${area} has notable gaps that should be reviewed.`;
  return `${area} has significant gaps in this passive review. The score reflects observable configuration, not exploitability.`;
}
