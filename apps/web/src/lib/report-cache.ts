import type { ScanReport } from "@vibetrace/shared-types";
import { getApiClient } from "./settings.js";

const reportCache = new Map<string, ScanReport>();
const pending = new Map<string, Promise<ScanReport>>();

export async function loadReport(
  id: string,
  options: { force?: boolean } = {},
): Promise<ScanReport> {
  if (!options.force) {
    const cached = reportCache.get(id);
    if (cached) return cached;
    const inFlight = pending.get(id);
    if (inFlight) return inFlight;
  }

  const request = getApiClient()
    .getReport(id)
    .then((report) => {
      reportCache.set(id, report);
      return report;
    })
    .finally(() => {
      pending.delete(id);
    });

  pending.set(id, request);
  return request;
}

export function primeReport(report: ScanReport): void {
  reportCache.set(report.scan.id, report);
}

export function invalidateReport(id: string): void {
  reportCache.delete(id);
}

export function clearReportCache(): void {
  reportCache.clear();
  pending.clear();
}
