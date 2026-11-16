import type {
  ScanProgress,
  ScanReport,
  ScanStatus,
  ScanSummary,
  ScanMode,
  ScanClient,
} from "@vibetrace/shared-types";

export interface StoredError {
  code: string;
  message: string;
}

export interface StoredScan {
  id: string;
  url: string;
  domain: string;
  mode: ScanMode;
  client: ScanClient;
  status: ScanStatus;
  progress: ScanProgress;
  error: StoredError | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  report: ScanReport | null;
  summary: ScanSummary;
  shareToken: string | null;
  sharedAt: string | null;
}

export type StoredScanPatch = Partial<
  Pick<
    StoredScan,
    | "status"
    | "progress"
    | "error"
    | "startedAt"
    | "completedAt"
    | "durationMs"
    | "report"
    | "summary"
    | "shareToken"
    | "sharedAt"
  >
>;

export interface ScanStore {
  create(scan: StoredScan): Promise<StoredScan>;
  get(id: string): Promise<StoredScan | undefined>;
  getByShareToken(token: string): Promise<StoredScan | undefined>;
  update(id: string, patch: StoredScanPatch): Promise<StoredScan | undefined>;
  list(limit: number): Promise<ScanSummary[]>;
  delete(id: string): Promise<boolean>;
  clear(): Promise<number>;
  purgeExpired(): Promise<number>;
  close(): Promise<void>;
}

export function emptySummary(input: {
  id: string;
  url: string;
  domain: string;
  mode: ScanMode;
  client: ScanClient;
  status: ScanStatus;
  createdAt: string;
}): ScanSummary {
  return {
    id: input.id,
    url: input.url,
    domain: input.domain,
    mode: input.mode,
    client: input.client,
    status: input.status,
    createdAt: input.createdAt,
    completedAt: null,
    durationMs: null,
    aiClassification: null,
    aiLabel: null,
    technologyCount: 0,
    technologyNames: [],
    securityScore: null,
    performanceScore: null,
    shared: false,
  };
}

export function summaryFromReport(scan: StoredScan, report: ScanReport): ScanSummary {
  return {
    id: scan.id,
    url: scan.url,
    domain: scan.domain,
    mode: scan.mode,
    client: scan.client,
    status: report.scan.status,
    createdAt: scan.createdAt,
    completedAt: report.scan.completedAt,
    durationMs: report.scan.durationMs,
    aiClassification: report.ai.classification,
    aiLabel: report.ai.label,
    technologyCount: report.technologies.length,
    technologyNames: report.technologies.map((item) => item.name).slice(0, 12),
    securityScore: report.scores.security.score,
    performanceScore: report.scores.performance.score,
    shared: Boolean(scan.shareToken),
  };
}
