import type { FastifyReply, FastifyRequest } from "fastify";
import {
  fingerprintRegistryMetadata,
  technologyRegistryMetadata,
} from "@vibetrace/analysis-engine";
import type { AppConfig } from "../config.js";
import type { AIService } from "../services/ai-service.js";
import type { ScanService } from "../services/scan-service.js";
import { openApiDocument } from "../openapi.js";

export class MetaController {
  constructor(
    private readonly config: AppConfig,
    private readonly scans: ScanService,
    private readonly ai: AIService,
  ) {}

  health = async (_request: FastifyRequest, _reply: FastifyReply) => {
    return {
      data: {
        status: "ok" as const,
        version: "0.1.0",
        uptimeSeconds: Math.round(process.uptime()),
        storage: this.config.storageDriver,
        ai: { enabled: this.ai.enabled, provider: this.ai.provider },
        scanQueue: {
          active: this.scans.activeCount,
          queued: this.scans.queueDepth,
        },
      },
    };
  };

  technologies = async (_request: FastifyRequest, _reply: FastifyReply) => {
    return { data: { technologies: technologyRegistryMetadata() } };
  };

  fingerprints = async (_request: FastifyRequest, _reply: FastifyReply) => {
    return { data: { fingerprints: fingerprintRegistryMetadata() } };
  };

  openapi = async (_request: FastifyRequest, _reply: FastifyReply) => {
    return openApiDocument(this.config);
  };

  docs = async (_request: FastifyRequest, reply: FastifyReply) => {
    const paths = Object.entries(openApiDocument(this.config).paths)
      .flatMap(([path, methods]) =>
        Object.keys(methods as Record<string, unknown>).map((method) => ({
          method: method.toUpperCase(),
          path,
        })),
      )
      .filter((entry) => entry.method !== "PARAMETERS");
    const rows = paths
      .map(
        (entry) =>
          `<tr><td><span class="method ${entry.method.toLowerCase()}">${entry.method}</span></td><td><code>${entry.path}</code></td></tr>`,
      )
      .join("");
    reply.header("content-type", "text/html; charset=utf-8");
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>VibeTrace API</title>
<style>
  :root{color-scheme:dark}body{margin:0;background:#08090a;color:#e8eae4;font:15px/1.6 ui-sans-serif,system-ui,sans-serif}
  main{max-width:860px;margin:0 auto;padding:48px 20px}h1{font-size:32px;letter-spacing:-.03em;margin:0 0 6px}
  p{color:#9ca197}.mono,code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
  .tag{display:inline-block;color:#c7f65a;border:1px solid #2a2e25;border-radius:4px;padding:2px 8px;font-size:12px}
  table{width:100%;border-collapse:collapse;margin:24px 0;border:1px solid #252823}
  td{padding:11px 14px;border-bottom:1px solid #1c1f1a;font-size:13px}tr:last-child td{border:0}
  .method{font-weight:700;font-size:11px;letter-spacing:.08em}.get{color:#9edcff}.post{color:#c7f65a}.delete{color:#ff9e9e}
  a{color:#c7f65a}.card{border:1px solid #252823;background:#0d0f0c;padding:18px;border-radius:8px;margin:16px 0}
</style></head>
<body><main>
<span class="tag">VIBETRACE API v1</span>
<h1>Forensic analysis API</h1>
<p>Versioned REST API used by both the VibeTrace website and Chrome extension. All untrusted targets are fetched through the SSRF-hardened analysis pipeline.</p>
<div class="card"><strong>OpenAPI document</strong><br><a href="/api/v1/openapi.json">/api/v1/openapi.json</a> · <a href="/api/v1/health">Health</a></div>
<table><tbody>${rows}</tbody></table>
<p class="mono" style="font-size:12px;color:#6e7469">Errors use a consistent envelope with a requestId. No credentials or cookies are accepted.</p>
</main></body></html>`;
  };
}
