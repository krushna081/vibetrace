import { randomBytes, randomUUID } from "node:crypto";
import type {
  CreateScanRequest,
  ScanReport,
  ScanStatusInfo,
  ScanSummary,
  ShareReportResponse,
} from "@vibetrace/shared-types";
import { ScanReportSchema } from "@vibetrace/shared-types";
import {
  analyzeWebsite,
  ScanError,
  type AnalyzeInput,
  type AnalyzeOptions,
} from "@vibetrace/analysis-engine";
import type { AppConfig } from "../config.js";
import type { ScanStore, StoredScan } from "../stores/index.js";
import { emptySummary, summaryFromReport } from "../stores/index.js";
import { ServiceError, notFound } from "./errors.js";

type Analyzer = (input: AnalyzeInput, options: AnalyzeOptions) => Promise<ScanReport>;

interface LoggerLike {
  info: (value: unknown, message?: string) => void;
  warn: (value: unknown, message?: string) => void;
  error: (value: unknown, message?: string) => void;
}

export interface ScanServiceOptions {
  store: ScanStore;
  config: AppConfig;
  analyzer?: Analyzer;
  analyzeOptions?: Partial<AnalyzeOptions>;
  logger?: LoggerLike;
}

interface QueueItem {
  scan: StoredScan;
  input: AnalyzeInput;
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export class ScanService {
  private readonly store: ScanStore;
  private readonly config: AppConfig;
  private readonly analyzer: Analyzer;
  private readonly baseAnalyzeOptions: Partial<AnalyzeOptions>;
  private readonly logger: LoggerLike;
  private readonly queue: QueueItem[] = [];
  private readonly activeControllers = new Set<AbortController>();
  private running = 0;
  private scheduled = false;

  constructor(options: ScanServiceOptions) {
    this.store = options.store;
    this.config = options.config;
    this.analyzer = options.analyzer ?? analyzeWebsite;
    this.baseAnalyzeOptions = options.analyzeOptions ?? {};
    this.logger =
      options.logger ??
      ({
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      } as LoggerLike);
  }

  get queueDepth(): number {
    return this.queue.length;
  }

  get activeCount(): number {
    return this.running;
  }

  async create(request: CreateScanRequest): Promise<StoredScan> {
    if (this.queue.length >= this.config.maxQueue) {
      throw new ServiceError(
        429,
        "SCAN_QUEUE_FULL",
        "The scan queue is full. Please retry shortly.",
      );
    }
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const domain = domainOf(request.url);
    const summary = emptySummary({
      id,
      url: request.url,
      domain,
      mode: request.mode,
      client: request.client,
      status: "queued",
      createdAt,
    });
    const scan: StoredScan = {
      id,
      url: request.url,
      domain,
      mode: request.mode,
      client: request.client,
      status: "queued",
      progress: { stage: "Queued", percent: 0, message: "Waiting for an analysis worker" },
      error: null,
      createdAt,
      startedAt: null,
      completedAt: null,
      durationMs: null,
      report: null,
      summary,
      shareToken: null,
      sharedAt: null,
    };

    await this.store.create(scan);
    this.queue.push({
      scan,
      input: {
        scanId: id,
        url: request.url,
        mode: request.mode,
        client: request.client,
        snapshot: request.snapshot,
        createdAt,
      },
    });
    this.scheduleDrain();
    return scan;
  }

  private scheduleDrain(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    setImmediate(() => {
      this.scheduled = false;
      void this.drain();
    });
  }

  private async drain(): Promise<void> {
    while (this.running < this.config.maxConcurrentScans && this.queue.length > 0) {
      const item = this.queue.shift()!;
      this.running += 1;
      void this.process(item).finally(() => {
        this.running -= 1;
        this.scheduleDrain();
      });
    }
  }

  private async updateScan(id: string, patch: Parameters<ScanStore["update"]>[1]): Promise<void> {
    await this.store.update(id, patch).catch((error) => {
      this.logger.warn({ err: error, scanId: id }, "Failed to update scan record");
    });
  }

  private async process(item: QueueItem): Promise<void> {
    const { scan, input } = item;
    const startedAt = new Date().toISOString();
    const controller = new AbortController();
    this.activeControllers.add(controller);
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.config.scanTimeoutMs);
    timeout.unref?.();

    await this.updateScan(scan.id, {
      status: "running",
      startedAt,
      progress: { stage: "Starting", percent: 2, message: "Preparing analysis" },
      summary: { ...scan.summary, status: "running" },
    });

    try {
      const report = await this.analyzer(input, {
        ...this.baseAnalyzeOptions,
        maxHtmlBytes: this.baseAnalyzeOptions.maxHtmlBytes ?? this.config.maxHtmlBytes,
        maxRedirects: this.baseAnalyzeOptions.maxRedirects ?? this.config.maxRedirects,
        allowedPorts: this.baseAnalyzeOptions.allowedPorts ?? this.config.allowedPorts,
        maxAssetProbes: this.baseAnalyzeOptions.maxAssetProbes ?? this.config.maxAssetProbes,
        assetProbeMaxBytes: this.baseAnalyzeOptions.assetProbeMaxBytes ?? this.config.assetMaxBytes,
        enableProbes: this.baseAnalyzeOptions.enableProbes ?? this.config.assetProbes,
        timeoutMs: Math.min(this.baseAnalyzeOptions.timeoutMs ?? 15_000, this.config.scanTimeoutMs),
        signal: controller.signal,
        progress: (stage, percent, message) => {
          void this.updateScan(scan.id, {
            progress: { stage, percent, message },
          });
        },
      });

      const parsed = ScanReportSchema.safeParse(report);
      if (!parsed.success) {
        this.logger.error(
          { scanId: scan.id, issues: parsed.error.issues.slice(0, 8) },
          "Generated report failed schema validation",
        );
        throw new Error("Generated report failed internal validation.");
      }

      const completedAt = parsed.data.scan.completedAt;
      const current = await this.store.get(scan.id);
      if (!current) return;
      const summary = summaryFromReport(current, parsed.data);
      await this.updateScan(scan.id, {
        status: parsed.data.scan.status,
        progress: {
          stage: parsed.data.scan.status === "completed" ? "Completed" : "Partially completed",
          percent: 100,
          message:
            parsed.data.scan.status === "completed"
              ? "Analysis finished"
              : (parsed.data.partialReason ?? "Analysis finished with limitations"),
        },
        completedAt,
        durationMs: parsed.data.scan.durationMs,
        report: parsed.data,
        summary,
        error: null,
      });
      this.logger.info(
        {
          scanId: scan.id,
          status: parsed.data.scan.status,
          durationMs: parsed.data.scan.durationMs,
          domain: scan.domain,
        },
        "Scan completed",
      );
    } catch (error) {
      const scanError = error instanceof ScanError ? error : null;
      const message = timedOut
        ? `The scan exceeded the ${Math.round(this.config.scanTimeoutMs / 1000)} second limit.`
        : (scanError?.publicMessage ??
          (error instanceof Error ? error.message : "The scan failed unexpectedly."));
      const code = timedOut ? "SCAN_TIMEOUT" : (scanError?.code ?? "SCAN_FAILED");
      const completedAt = new Date().toISOString();
      this.logger.error(
        { scanId: scan.id, code, err: error instanceof Error ? error.message : error },
        "Scan failed",
      );
      const current = await this.store.get(scan.id);
      if (!current) return;
      await this.updateScan(scan.id, {
        status: "failed",
        error: { code, message },
        completedAt,
        progress: { stage: "Failed", percent: 100, message },
        summary: {
          ...current.summary,
          status: "failed",
          completedAt,
          durationMs: new Date(completedAt).getTime() - new Date(scan.createdAt).getTime(),
        },
      });
    } finally {
      clearTimeout(timeout);
      this.activeControllers.delete(controller);
      item.input.snapshot = undefined;
    }
  }

  async get(id: string): Promise<StoredScan> {
    const scan = await this.store.get(id);
    if (!scan) throw notFound("Scan not found.");
    return scan;
  }

  async status(id: string): Promise<ScanStatusInfo> {
    const scan = await this.get(id);
    return {
      id: scan.id,
      status: scan.status,
      progress: scan.progress,
      error: scan.error,
      createdAt: scan.createdAt,
      completedAt: scan.completedAt,
    };
  }

  async report(id: string): Promise<ScanReport> {
    const scan = await this.get(id);
    if (scan.status === "queued" || scan.status === "running") {
      throw new ServiceError(409, "SCAN_NOT_READY", "The scan is still running.", {
        status: scan.status,
        progress: scan.progress,
      });
    }
    if (scan.status === "failed" || !scan.report) {
      throw new ServiceError(
        409,
        "SCAN_FAILED",
        scan.error?.message ?? "This scan did not produce a report.",
      );
    }
    return scan.report;
  }

  async list(limit = 50): Promise<ScanSummary[]> {
    return this.store.list(limit);
  }

  async remove(id: string): Promise<void> {
    const scan = await this.get(id);
    if (scan.status === "queued" || scan.status === "running") {
      throw new ServiceError(409, "SCAN_ACTIVE", "An active scan cannot be deleted.");
    }
    await this.store.delete(id);
  }

  async clearAll(): Promise<number> {
    if (this.running > 0 || this.queue.length > 0) {
      throw new ServiceError(
        409,
        "SCANS_ACTIVE",
        "Wait for active or queued scans to finish before clearing history.",
      );
    }
    return this.store.clear();
  }

  async share(id: string): Promise<ShareReportResponse> {
    const scan = await this.get(id);
    if (!scan.report || (scan.status !== "completed" && scan.status !== "partially_completed")) {
      throw new ServiceError(409, "REPORT_NOT_READY", "Only a completed report can be shared.");
    }
    const now = new Date().toISOString();
    const token = scan.shareToken ?? randomBytes(24).toString("base64url");
    const sharedAt = scan.sharedAt ?? now;
    await this.store.update(id, {
      shareToken: token,
      sharedAt,
      summary: { ...scan.summary, shared: true },
    });
    return {
      token,
      path: `/shared/${token}`,
      createdAt: sharedAt,
    };
  }

  async unshare(id: string): Promise<void> {
    const scan = await this.get(id);
    if (!scan.shareToken) return;
    await this.store.update(id, {
      shareToken: null,
      sharedAt: null,
      summary: { ...scan.summary, shared: false },
    });
  }

  async getShared(token: string): Promise<{ report: ScanReport; sharedAt: string }> {
    if (!/^[A-Za-z0-9_-]{24,64}$/.test(token)) throw notFound("Shared report not found.");
    const scan = await this.store.getByShareToken(token);
    if (!scan || !scan.report || !scan.sharedAt) throw notFound("Shared report not found.");
    return { report: scan.report, sharedAt: scan.sharedAt };
  }

  async purgeExpired(): Promise<number> {
    return this.store.purgeExpired();
  }

  async shutdown(): Promise<void> {
    this.queue.length = 0;
    for (const controller of this.activeControllers) controller.abort();
    this.activeControllers.clear();
    await this.store.close();
  }
}
