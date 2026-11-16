import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { ScanReportSchema } from "@vibetrace/shared-types";
import { buildApp } from "../src/app.js";
import { loadConfig, type AppConfig } from "../src/config.js";
import { ScanService } from "../src/services/scan-service.js";
import { createScanStore } from "../src/stores/index.js";
import { buildFixtureSnapshot } from "../../../packages/analysis-engine/tests/fixtures.js";

const config: AppConfig = loadConfig({
  NODE_ENV: "test",
  STORAGE_DRIVER: "memory",
  LOG_LEVEL: "silent",
  RATE_LIMIT_MAX: "1000",
  SCAN_CREATE_RATE_LIMIT_MAX: "100",
  SCAN_ASSET_PROBES: "false",
});

const snapshot = buildFixtureSnapshot();
const scanPayload = {
  url: snapshot.url,
  mode: "snapshot" as const,
  client: "extension" as const,
  snapshot,
};

async function waitForTerminal(
  app: FastifyInstance,
  id: string,
  maxAttempts = 40,
): Promise<{ status: string; progress: { percent: number } }> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await app.inject({ method: "GET", url: `/api/v1/scans/${id}/status` });
    const body = response.json() as { data: { status: string; progress: { percent: number } } };
    if (["completed", "partially_completed", "failed"].includes(body.data.status)) {
      return body.data;
    }
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  throw new Error(`Scan ${id} did not finish in time`);
}

describe("VibeTrace API", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ config, logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("reports health, storage and disabled AI without secrets", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/health" });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      data: { status: string; storage: string; ai: { enabled: boolean; provider: string } };
    };
    expect(body.data.status).toBe("ok");
    expect(body.data.storage).toBe("memory");
    expect(body.data.ai).toEqual({ enabled: false, provider: "disabled" });
    expect(response.headers["x-request-id"]).toBeTruthy();
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("accepts a validated snapshot scan and exposes asynchronous status", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/scans",
      headers: { "x-request-id": "test-request-123" },
      payload: scanPayload,
    });
    expect(response.statusCode).toBe(202);
    expect(response.headers["x-request-id"]).toBe("test-request-123");
    const created = response.json() as {
      data: { id: string; status: string; statusUrl: string; reportUrl: string; requestId: string };
    };
    expect(created.data.status).toBe("queued");
    expect(created.data.statusUrl).toContain(created.data.id);
    expect(created.data.requestId).toBe("test-request-123");

    const finished = await waitForTerminal(app, created.data.id);
    expect(finished.status).toBe("completed");
    expect(finished.progress.percent).toBe(100);

    const detail = await app.inject({ method: "GET", url: `/api/v1/scans/${created.data.id}` });
    expect(detail.statusCode).toBe(200);
    const detailBody = detail.json() as {
      data: { reportReady: boolean; scan: { status: string; technologyCount: number } };
    };
    expect(detailBody.data.reportReady).toBe(true);
    expect(detailBody.data.scan.status).toBe("completed");
    expect(detailBody.data.scan.technologyCount).toBeGreaterThan(0);

    const reportResponse = await app.inject({
      method: "GET",
      url: `/api/v1/scans/${created.data.id}/report`,
    });
    expect(reportResponse.statusCode).toBe(200);
    const report = (reportResponse.json() as { data: unknown }).data;
    const parsed = ScanReportSchema.safeParse(report);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.scan.mode).toBe("snapshot");
    expect(parsed.data.scan.client).toBe("extension");
    expect(parsed.data.ai.classification).toBe("strong");
    expect(JSON.stringify(parsed.data)).not.toContain("<main>");

    const shareResponse = await app.inject({
      method: "POST",
      url: `/api/v1/scans/${created.data.id}/share`,
    });
    expect(shareResponse.statusCode).toBe(200);
    const share = shareResponse.json() as {
      data: { token: string; path: string; createdAt: string };
    };
    expect(share.data.token).toMatch(/^[A-Za-z0-9_-]{24,64}$/);
    expect(share.data.path).toBe(`/shared/${share.data.token}`);

    const publicResponse = await app.inject({
      method: "GET",
      url: `/api/v1/public/reports/${share.data.token}`,
    });
    expect(publicResponse.statusCode).toBe(200);
    const publicBody = publicResponse.json() as {
      data: { report: unknown; sharedAt: string };
    };
    expect(ScanReportSchema.safeParse(publicBody.data.report).success).toBe(true);
    expect(publicBody.data.sharedAt).toBe(share.data.createdAt);
    expect(JSON.stringify(publicBody.data)).not.toContain("rawHtml");

    const unshare = await app.inject({
      method: "DELETE",
      url: `/api/v1/scans/${created.data.id}/share`,
    });
    expect(unshare.statusCode).toBe(204);
    const revoked = await app.inject({
      method: "GET",
      url: `/api/v1/public/reports/${share.data.token}`,
    });
    expect(revoked.statusCode).toBe(404);

    const history = await app.inject({ method: "GET", url: "/api/v1/scans?limit=10" });
    expect(history.statusCode).toBe(200);
    const historyBody = history.json() as { data: { scans: Array<{ id: string }>; total: number } };
    expect(historyBody.data.scans.some((scan) => scan.id === created.data.id)).toBe(true);

    const removed = await app.inject({
      method: "DELETE",
      url: `/api/v1/scans/${created.data.id}`,
    });
    expect(removed.statusCode).toBe(204);
    const missing = await app.inject({
      method: "GET",
      url: `/api/v1/scans/${created.data.id}/report`,
    });
    expect(missing.statusCode).toBe(404);
  });

  it("rejects invalid URLs and malformed snapshots with structured validation errors", async () => {
    const invalidUrl = await app.inject({
      method: "POST",
      url: "/api/v1/scans",
      payload: { ...scanPayload, url: "javascript:alert(1)" },
    });
    expect(invalidUrl.statusCode).toBe(400);
    const invalidBody = invalidUrl.json() as {
      error: { code: string; message: string };
      requestId: string;
    };
    expect(invalidBody.error.code).toBe("VALIDATION_ERROR");
    expect(invalidBody.requestId).toBeTruthy();

    const missingSnapshot = await app.inject({
      method: "POST",
      url: "/api/v1/scans",
      payload: { url: "https://example.com", mode: "snapshot", client: "extension" },
    });
    expect(missingSnapshot.statusCode).toBe(400);

    const oversizedHtml = await app.inject({
      method: "POST",
      url: "/api/v1/scans",
      payload: {
        ...scanPayload,
        snapshot: { ...snapshot, html: "x".repeat(600_001) },
      },
    });
    expect(oversizedHtml.statusCode).toBe(400);
  });

  it("returns 404 for unknown scan ids and unknown public tokens", async () => {
    const missing = await app.inject({
      method: "GET",
      url: "/api/v1/scans/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    expect(missing.statusCode).toBe(404);
    expect((missing.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");

    const token = await app.inject({
      method: "GET",
      url: "/api/v1/public/reports/abcdefghijklmnopqrstuvwx",
    });
    expect(token.statusCode).toBe(404);
  });

  it("publishes the technology registry, fingerprint registry and OpenAPI document", async () => {
    const technologies = await app.inject({ method: "GET", url: "/api/v1/technologies" });
    expect(technologies.statusCode).toBe(200);
    const techBody = technologies.json() as { data: { technologies: unknown[] } };
    expect(techBody.data.technologies.length).toBeGreaterThan(10);

    const fingerprints = await app.inject({ method: "GET", url: "/api/v1/fingerprints" });
    expect(fingerprints.statusCode).toBe(200);
    const fingerprintBody = fingerprints.json() as { data: { fingerprints: unknown[] } };
    expect(fingerprintBody.data.fingerprints.length).toBeGreaterThan(10);

    const openapi = await app.inject({ method: "GET", url: "/api/v1/openapi.json" });
    expect(openapi.statusCode).toBe(200);
    const spec = openapi.json() as { openapi: string; paths: Record<string, unknown> };
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.paths["/api/v1/scans"]).toBeDefined();
    expect(spec.paths["/api/v1/public/reports/{token}"]).toBeDefined();

    const docs = await app.inject({ method: "GET", url: "/api/v1/docs" });
    expect(docs.statusCode).toBe(200);
    expect(docs.headers["content-type"]).toContain("text/html");
  });

  it("allows extension-origin CORS preflight without credentials", async () => {
    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/v1/scans",
      headers: {
        origin: "chrome-extension://abcdefghijklmnop",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });
    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "chrome-extension://abcdefghijklmnop",
    );
    expect(response.headers["access-control-allow-credentials"]).toBeUndefined();
  });

  it("returns a friendly 409 while a report is not ready", async () => {
    const localStore = await createScanStore(config);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const analyzer = vi.fn(async () => {
      await gate;
      throw new Error("test shutdown");
    });
    const service = new ScanService({ store: localStore, config, analyzer });
    const slowApp = await buildApp({
      config,
      store: localStore,
      scanService: service,
      logger: false,
    });
    await slowApp.ready();

    const created = await slowApp.inject({
      method: "POST",
      url: "/api/v1/scans",
      payload: { url: "https://slow.example/", mode: "remote", client: "web" },
    });
    expect(created.statusCode).toBe(202);
    const id = (created.json() as { data: { id: string } }).data.id;

    const early = await slowApp.inject({ method: "GET", url: `/api/v1/scans/${id}/report` });
    expect(early.statusCode).toBe(409);
    const earlyBody = early.json() as {
      error: { code: string; message: string; details?: { status: string } };
    };
    expect(earlyBody.error.code).toBe("SCAN_NOT_READY");
    expect(earlyBody.error.details?.status).toMatch(/queued|running/);

    release();
    await slowApp.close();
  });
});
