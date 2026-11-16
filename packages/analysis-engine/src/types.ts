import type { PageSnapshot, ScanClient, ScanMode } from "@vibetrace/shared-types";
import type { DocumentFacts } from "./document.js";
import type { CookieFlags, SafeFetchImplementation } from "./fetch/safe-fetch.js";
import type { HostResolver } from "./fetch/url-guard.js";

export interface AssetProbe {
  url: string;
  kind: "script" | "stylesheet";
  status: number | null;
  bytes: number | null;
  encodedBytes: number | null;
  compressed: boolean | null;
  cacheControl: string | null;
  sourceMapUrls: string[];
  error: string | null;
  measured: boolean;
}

export interface SeoProbe {
  robotsUrl: string;
  robotsStatus: number | null;
  robotsAccessible: boolean;
  sitemapUrl: string | null;
  sitemapStatus: number | null;
  sitemapAccessible: boolean;
  disallowAll: boolean;
  errors: string[];
}

export interface ProbeSummary {
  assets: AssetProbe[];
  sourceMaps: string[];
  seo: SeoProbe | null;
  errors: string[];
}

export interface AnalyzerResponse {
  status: number | null;
  contentType: string;
  headers: Record<string, string>;
  headersAvailable: boolean;
  bodyBytes: number;
  ttfbMs: number | null;
  durationMs: number | null;
  redirects: string[];
  truncated: boolean;
  cookieFlags: CookieFlags;
}

export interface AnalyzerContext {
  scanId: string;
  url: string;
  finalUrl: string;
  hostname: string;
  mode: ScanMode;
  client: ScanClient;
  facts: DocumentFacts;
  snapshot?: PageSnapshot;
  response: AnalyzerResponse;
  probes: ProbeSummary;
  generatedAt: string;
  partialReasons: string[];
}

export interface AnalyzeInput {
  scanId: string;
  url: string;
  mode: ScanMode;
  client: ScanClient;
  snapshot?: PageSnapshot;
  createdAt: string;
}

export interface AnalyzeOptions {
  fetchImpl?: SafeFetchImplementation;
  resolver?: HostResolver;
  allowedPorts?: number[];
  maxHtmlBytes?: number;
  maxRedirects?: number;
  maxAssetProbes?: number;
  assetProbeMaxBytes?: number;
  timeoutMs?: number;
  enableProbes?: boolean;
  signal?: AbortSignal;
  now?: () => Date;
  progress?: (stage: string, percent: number, message?: string) => void;
}
