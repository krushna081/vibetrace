import type { ClientHealth, CreateScanResult, ScanDetail } from "@vibetrace/api-client";
import type {
  PageSnapshot,
  ScanProgress,
  ScanReport,
  ScanStatusInfo,
} from "@vibetrace/shared-types";

export interface ExtensionSettings {
  apiBaseUrl: string;
  webBaseUrl: string;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:8787",
  webBaseUrl: import.meta.env.VITE_WEB_BASE_URL?.trim() || "http://localhost:5173",
};

export interface LastScan {
  id: string;
  url: string;
  domain: string;
  createdAt: string;
  status: ScanStatusInfo["status"];
}

export interface CaptureResult {
  scan: CreateScanResult;
  snapshot: {
    htmlBytes: number;
    nodeCount: number;
    scriptCount: number;
    imageCount: number;
  };
}

export interface TestConnectionResult {
  health: ClientHealth;
  checkedAt: string;
}

export type ExtensionRequest =
  | { type: "settings:get" }
  | { type: "settings:set"; settings: ExtensionSettings }
  | { type: "health" }
  | { type: "testConnection"; apiBaseUrl: string }
  | { type: "lastScan:get" }
  | { type: "capture"; tabId: number; tabUrl: string }
  | { type: "scan:status"; id: string }
  | { type: "scan:detail"; id: string }
  | { type: "scan:report"; id: string }
  | { type: "openReport"; id: string }
  | { type: "openWeb"; path?: string };

export interface ExtensionErrorPayload {
  code: string;
  message: string;
}

export type ExtensionResponse<T> =
  { ok: true; data: T } | { ok: false; error: ExtensionErrorPayload };

export interface ContentCollectRequest {
  type: "VIBETRACE_COLLECT";
}

export type ContentCollectResponse =
  { ok: true; snapshot: PageSnapshot } | { ok: false; error: ExtensionErrorPayload };

export interface ScanSessionResult {
  status: ScanStatusInfo;
  detail?: ScanDetail;
  progress?: ScanProgress;
  report?: ScanReport;
}
