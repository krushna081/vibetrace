import { z } from "zod";
import {
  AIExplanationResponseSchema,
  CreateScanResponseSchema,
  FingerprintsResponseSchema,
  HealthResponseSchema,
  ScanListResponseSchema,
  ScanProgressSchema,
  ScanReportSchema,
  ScanStatusInfoSchema,
  ScanSummarySchema,
  SharedReportResponseSchema,
  ShareReportResponseSchema,
  TechnologiesResponseSchema,
  ApiErrorSchema,
  type CreateScanRequest,
  type FingerprintRegistryEntry,
  type ScanReport,
  type ScanStatusInfo,
  type ShareReportResponse,
  type TechnologyRegistryEntry,
} from "@vibetrace/shared-types";
import { ApiClientError, CLIENT_ERROR_CODES } from "./errors.js";

/** Detail payload for `GET /api/v1/scans/:id` (not part of the report contract). */
export const ScanDetailSchema = z.object({
  scan: ScanSummarySchema,
  progress: ScanProgressSchema,
  error: z.object({ code: z.string(), message: z.string() }).nullable(),
  startedAt: z.string().nullable(),
  sharedAt: z.string().nullable(),
  reportReady: z.boolean(),
});
export type ScanDetail = z.infer<typeof ScanDetailSchema>;

export const ClientHealthSchema = HealthResponseSchema.extend({
  scanQueue: z
    .object({ active: z.number().int().min(0), queued: z.number().int().min(0) })
    .optional(),
});
export type ClientHealth = z.infer<typeof ClientHealthSchema>;

export type CreateScanResult = z.infer<typeof CreateScanResponseSchema>["data"];
export type ScanList = z.infer<typeof ScanListResponseSchema>["data"];
export type SharedReport = z.infer<typeof SharedReportResponseSchema>["data"];
export type AIExplanation = z.infer<typeof AIExplanationResponseSchema>["data"];

export interface ApiClientOptions {
  /** API origin, e.g. `http://localhost:8787`. A trailing `/api/v1` is also accepted. */
  baseUrl: string;
  /** Override for tests, service workers, or custom runtimes. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export interface WaitForReportOptions {
  intervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  onProgress?: (status: ScanStatusInfo) => void;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const TERMINAL_FAILURES = new Set(["failed"]);

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Typed client for the VibeTrace v1 API. Used by the web app and the extension
 * service worker so both clients share validation and error semantics.
 */
export class VibeTraceClient {
  readonly baseUrl: string;
  readonly apiBase: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly defaultHeaders: Record<string, string>;

  constructor(options: ApiClientOptions) {
    const trimmed = options.baseUrl.replace(/\/+$/, "");
    if (!/^https?:\/\//i.test(trimmed)) {
      throw new Error("ApiClientOptions.baseUrl must be an absolute http(s) URL.");
    }
    this.apiBase = trimmed.endsWith("/api/v1") ? trimmed : `${trimmed}/api/v1`;
    this.baseUrl = this.apiBase.slice(0, -"/api/v1".length);
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.defaultHeaders = {
      accept: "application/json",
      ...options.headers,
    };
  }

  /** Resolve a server-relative path (e.g. a share path) against the API origin. */
  resolveUrl(path: string): string {
    return new URL(path, `${this.baseUrl}/`).toString();
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
    schema?: z.ZodType<T>,
  ): Promise<T> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);
    const onExternalAbort = () => controller.abort();
    init.signal?.addEventListener("abort", onExternalAbort, { once: true });

    const headers = new Headers(this.defaultHeaders);
    if (init.body !== undefined && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    if (init.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.apiBase}${path}`, {
        ...init,
        headers,
        signal: controller.signal,
        credentials: "omit",
        cache: "no-store",
      });
    } catch (error) {
      if (timedOut) {
        throw new ApiClientError({
          status: 0,
          code: CLIENT_ERROR_CODES.timeout,
          message: `The API did not respond within ${Math.round(this.timeoutMs / 1000)}s.`,
          cause: error,
        });
      }
      if (controller.signal.aborted) {
        throw new ApiClientError({
          status: 0,
          code: "ABORTED",
          message: "The request was cancelled.",
          cause: error,
        });
      }
      throw new ApiClientError({
        status: 0,
        code: CLIENT_ERROR_CODES.network,
        message:
          "Could not reach the VibeTrace API. Check that the API server is running and reachable.",
        cause: error,
      });
    } finally {
      clearTimeout(timer);
      init.signal?.removeEventListener("abort", onExternalAbort);
    }

    const requestId = response.headers.get("x-request-id") ?? undefined;

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }

    if (!response.ok) {
      const parsedError = ApiErrorSchema.safeParse(json);
      if (parsedError.success) {
        throw new ApiClientError({
          status: response.status,
          code: parsedError.data.error.code,
          message: parsedError.data.error.message,
          requestId: parsedError.data.requestId ?? requestId,
          details: parsedError.data.error.details,
        });
      }
      throw new ApiClientError({
        status: response.status,
        code: response.status === 429 ? "RATE_LIMITED" : "HTTP_ERROR",
        message:
          response.status === 429
            ? "Too many requests. Please wait a moment and try again."
            : `The API returned HTTP ${response.status}.`,
        requestId,
      });
    }

    const envelope = z.object({ data: z.unknown() }).safeParse(json);
    if (!envelope.success) {
      throw new ApiClientError({
        status: response.status,
        code: CLIENT_ERROR_CODES.invalidResponse,
        message: "The API returned an unexpected response shape.",
        requestId,
      });
    }

    if (!schema) return envelope.data.data as T;
    const parsed = schema.safeParse(envelope.data.data);
    if (!parsed.success) {
      throw new ApiClientError({
        status: response.status,
        code: CLIENT_ERROR_CODES.invalidResponse,
        message: "The API response failed contract validation.",
        requestId,
        details: parsed.error.issues.slice(0, 10),
      });
    }
    return parsed.data;
  }

  async health(): Promise<ClientHealth> {
    return this.request("/health", { method: "GET" }, ClientHealthSchema);
  }

  async createScan(input: CreateScanRequest): Promise<CreateScanResult> {
    return this.request(
      "/scans",
      { method: "POST", body: JSON.stringify(input) },
      CreateScanResponseSchema.shape.data,
    );
  }

  async getScan(id: string): Promise<ScanDetail> {
    return this.request(`/scans/${encodeURIComponent(id)}`, { method: "GET" }, ScanDetailSchema);
  }

  async getScanStatus(id: string): Promise<ScanStatusInfo> {
    return this.request(
      `/scans/${encodeURIComponent(id)}/status`,
      { method: "GET" },
      ScanStatusInfoSchema,
    );
  }

  async getReport(id: string): Promise<ScanReport> {
    return this.request(
      `/scans/${encodeURIComponent(id)}/report`,
      { method: "GET" },
      ScanReportSchema,
    );
  }

  async listScans(limit = 50): Promise<ScanList> {
    const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 200));
    return this.request(
      `/scans?limit=${safeLimit}`,
      { method: "GET" },
      ScanListResponseSchema.shape.data,
    );
  }

  async deleteScan(id: string): Promise<void> {
    await this.request(`/scans/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async clearScans(): Promise<number> {
    const result = await this.request(
      "/scans",
      { method: "DELETE" },
      z.object({ deleted: z.number().int().min(0) }),
    );
    return result.deleted;
  }

  async shareReport(id: string): Promise<ShareReportResponse> {
    return this.request(
      `/scans/${encodeURIComponent(id)}/share`,
      { method: "POST" },
      ShareReportResponseSchema,
    );
  }

  async unshareReport(id: string): Promise<void> {
    await this.request(`/scans/${encodeURIComponent(id)}/share`, { method: "DELETE" });
  }

  async getSharedReport(token: string): Promise<SharedReport> {
    return this.request(
      `/public/reports/${encodeURIComponent(token)}`,
      { method: "GET" },
      SharedReportResponseSchema.shape.data,
    );
  }

  async explainWithAI(id: string): Promise<AIExplanation> {
    return this.request(
      `/scans/${encodeURIComponent(id)}/explain`,
      { method: "POST", body: JSON.stringify({ consent: true }) },
      AIExplanationResponseSchema.shape.data,
    );
  }

  async getTechnologies(): Promise<TechnologyRegistryEntry[]> {
    const result = await this.request(
      "/technologies",
      { method: "GET" },
      TechnologiesResponseSchema.shape.data,
    );
    return result.technologies;
  }

  async getFingerprints(): Promise<FingerprintRegistryEntry[]> {
    const result = await this.request(
      "/fingerprints",
      { method: "GET" },
      FingerprintsResponseSchema.shape.data,
    );
    return result.fingerprints;
  }

  async getOpenApiDocument(): Promise<unknown> {
    const response = await this.fetchImpl(`${this.apiBase}/openapi.json`, {
      headers: this.defaultHeaders,
      credentials: "omit",
    });
    if (!response.ok) {
      throw new ApiClientError({
        status: response.status,
        code: "HTTP_ERROR",
        message: "Unable to load the OpenAPI document.",
      });
    }
    return response.json();
  }

  /**
   * Poll until the scan reaches a terminal state, then return the report.
   * Throws `ApiClientError` when the scan fails or polling times out.
   */
  async waitForReport(id: string, options: WaitForReportOptions = {}): Promise<ScanReport> {
    const intervalMs = Math.max(400, options.intervalMs ?? 1_250);
    const deadline = Date.now() + (options.timeoutMs ?? 180_000);

    for (;;) {
      const status = await this.getScanStatus(id);
      options.onProgress?.(status);

      if (status.status === "completed" || status.status === "partially_completed") {
        return this.getReport(id);
      }
      if (TERMINAL_FAILURES.has(status.status)) {
        throw new ApiClientError({
          status: 422,
          code: status.error?.code ?? "SCAN_FAILED",
          message: status.error?.message ?? "The scan failed.",
        });
      }
      if (Date.now() >= deadline) {
        throw new ApiClientError({
          status: 0,
          code: "POLL_TIMEOUT",
          message:
            "The scan is taking longer than expected. It may still complete; refresh history later.",
        });
      }
      await delay(intervalMs, options.signal);
    }
  }
}
