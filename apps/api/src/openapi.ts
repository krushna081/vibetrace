import type { AppConfig } from "./config.js";

const errorResponse = {
  description: "Consistent API error envelope",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/Error" },
    },
  },
};

const rateLimited = {
  description: "Rate limited",
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
};

const scanIdParameter = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" },
};

const scanSummary = {
  type: "object",
  required: ["id", "url", "domain", "status", "createdAt"],
  properties: {
    id: { type: "string", format: "uuid" },
    url: { type: "string", format: "uri" },
    domain: { type: "string" },
    mode: { type: "string", enum: ["remote", "snapshot"] },
    client: { type: "string", enum: ["web", "extension", "api"] },
    status: {
      type: "string",
      enum: ["queued", "running", "completed", "partially_completed", "failed"],
    },
    createdAt: { type: "string", format: "date-time" },
    completedAt: { type: "string", format: "date-time", nullable: true },
    durationMs: { type: "integer", nullable: true },
    aiClassification: {
      type: "string",
      nullable: true,
      enum: ["strong", "moderate", "weak", "mixed", "insufficient", null],
    },
    aiLabel: { type: "string", nullable: true },
    technologyCount: { type: "integer" },
    technologyNames: { type: "array", items: { type: "string" } },
    securityScore: { type: "number", nullable: true },
    performanceScore: { type: "number", nullable: true },
    shared: { type: "boolean" },
  },
};

export function openApiDocument(config: AppConfig) {
  return {
    openapi: "3.1.0",
    info: {
      title: "VibeTrace API",
      version: "0.1.0",
      description:
        "Website forensics API. Scans are asynchronous. The API never accepts cookies, never executes website JavaScript, and blocks SSRF targets. AI-management signals are heuristic and are not authorship probabilities.",
      license: { name: "MIT" },
    },
    servers: [{ url: config.publicApiUrl, description: "Configured API origin" }],
    tags: [
      { name: "Scans", description: "Create, monitor, retrieve and manage analyses" },
      { name: "Registry", description: "Public technology and AI fingerprint metadata" },
      { name: "Public reports", description: "Opt-in shared report retrieval" },
      { name: "System", description: "Health and documentation" },
    ],
    paths: {
      "/api/v1/scans": {
        post: {
          tags: ["Scans"],
          summary: "Create an asynchronous scan",
          operationId: "createScan",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["url"],
                  properties: {
                    url: { type: "string", format: "uri", example: "https://example.com" },
                    mode: {
                      type: "string",
                      enum: ["remote", "snapshot"],
                      default: "remote",
                      description:
                        "remote fetches the URL through the SSRF-hardened server fetcher. snapshot analyzes a sanitized extension DOM snapshot without a server-side fetch.",
                    },
                    client: { type: "string", enum: ["web", "extension", "api"], default: "web" },
                    snapshot: { $ref: "#/components/schemas/PageSnapshot" },
                  },
                },
              },
            },
          },
          responses: {
            "202": {
              description: "Scan accepted",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        type: "object",
                        properties: {
                          id: { type: "string", format: "uuid" },
                          status: { type: "string" },
                          progress: { $ref: "#/components/schemas/Progress" },
                          statusUrl: { type: "string" },
                          reportUrl: { type: "string" },
                          requestId: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
            "400": errorResponse,
            "429": rateLimited,
          },
        },
        get: {
          tags: ["Scans"],
          summary: "List recent scan summaries",
          parameters: [
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", minimum: 1, maximum: 200, default: 50 },
            },
          ],
          responses: {
            "200": {
              description: "Scan summaries, newest first",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        type: "object",
                        properties: {
                          scans: { type: "array", items: scanSummary },
                          total: { type: "integer" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        delete: {
          tags: ["Scans"],
          summary: "Clear completed scan history",
          responses: {
            "200": { description: "History cleared" },
            "409": errorResponse,
          },
        },
      },
      "/api/v1/scans/{id}": {
        parameters: [scanIdParameter],
        get: {
          tags: ["Scans"],
          summary: "Get scan status metadata",
          responses: { "200": { description: "Scan metadata" }, "404": errorResponse },
        },
        delete: {
          tags: ["Scans"],
          summary: "Delete a completed scan",
          responses: { "204": { description: "Deleted" }, "409": errorResponse },
        },
      },
      "/api/v1/scans/{id}/status": {
        parameters: [scanIdParameter],
        get: {
          tags: ["Scans"],
          summary: "Poll scan status and progress",
          responses: {
            "200": {
              description: "Current status",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          status: { type: "string" },
                          progress: { $ref: "#/components/schemas/Progress" },
                          error: { type: "object", nullable: true },
                          createdAt: { type: "string" },
                          completedAt: { type: "string", nullable: true },
                        },
                      },
                    },
                  },
                },
              },
            },
            "404": errorResponse,
          },
        },
      },
      "/api/v1/scans/{id}/report": {
        parameters: [scanIdParameter],
        get: {
          tags: ["Scans"],
          summary: "Retrieve a completed report",
          responses: {
            "200": {
              description: "Full report",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { data: { type: "object", description: "ScanReport" } },
                  },
                },
              },
            },
            "409": errorResponse,
            "404": errorResponse,
          },
        },
      },
      "/api/v1/scans/{id}/share": {
        parameters: [scanIdParameter],
        post: {
          tags: ["Scans"],
          summary: "Create or return an opt-in public share token",
          responses: { "200": { description: "Share token" }, "409": errorResponse },
        },
        delete: {
          tags: ["Scans"],
          summary: "Revoke public sharing",
          responses: { "204": { description: "Revoked" } },
        },
      },
      "/api/v1/scans/{id}/explain": {
        parameters: [scanIdParameter],
        post: {
          tags: ["Scans"],
          summary: "Optional AI-provider explanation of existing findings",
          description:
            "Disabled unless the server operator configures AI_PROVIDER. The caller must explicitly send consent:true. Only derived report findings are sent to the provider, never raw source code.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["consent"],
                  properties: { consent: { type: "boolean", enum: [true] } },
                },
              },
            },
          },
          responses: {
            "200": { description: "Generated explanation" },
            "503": errorResponse,
          },
        },
      },
      "/api/v1/public/reports/{token}": {
        get: {
          tags: ["Public reports"],
          summary: "Retrieve a shared report by token",
          parameters: [{ name: "token", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Shared report" }, "404": errorResponse },
        },
      },
      "/api/v1/technologies": {
        get: {
          tags: ["Registry"],
          summary: "List supported technology fingerprints",
          responses: { "200": { description: "Technology registry metadata" } },
        },
      },
      "/api/v1/fingerprints": {
        get: {
          tags: ["Registry"],
          summary: "List AI/builder fingerprint rules and caveats",
          responses: { "200": { description: "Fingerprint registry metadata" } },
        },
      },
      "/api/v1/health": {
        get: {
          tags: ["System"],
          summary: "Liveness and configuration summary",
          responses: { "200": { description: "Healthy" } },
        },
      },
      "/api/v1/openapi.json": {
        get: {
          tags: ["System"],
          summary: "This OpenAPI document",
          responses: { "200": { description: "OpenAPI 3.1 document" } },
        },
      },
    },
    components: {
      schemas: {
        Progress: {
          type: "object",
          required: ["stage", "percent"],
          properties: {
            stage: { type: "string" },
            percent: { type: "number", minimum: 0, maximum: 100 },
            message: { type: "string" },
          },
        },
        Error: {
          type: "object",
          required: ["error", "requestId"],
          properties: {
            error: {
              type: "object",
              required: ["code", "message"],
              properties: {
                code: { type: "string", example: "VALIDATION_ERROR" },
                message: { type: "string" },
                details: {},
              },
            },
            requestId: { type: "string" },
          },
        },
        PageSnapshot: {
          type: "object",
          description:
            "Sanitized extension DOM snapshot. Never includes form values, cookies, storage or unrelated page text.",
          required: [
            "url",
            "title",
            "lang",
            "meta",
            "html",
            "scriptSources",
            "stylesheetHrefs",
            "dom",
            "capturedAt",
          ],
          properties: {
            url: { type: "string", format: "uri" },
            title: { type: "string" },
            lang: { type: "string" },
            meta: { type: "object", additionalProperties: { type: "string" } },
            html: { type: "string", maxLength: 600000 },
            scriptSources: { type: "array", items: { type: "string" } },
            stylesheetHrefs: { type: "array", items: { type: "string" } },
            dom: {
              type: "object",
              description: "Structural counts and sanitized samples; no input values or cookies.",
            },
            timing: {
              type: "object",
              properties: {
                ttfbMs: { type: "number" },
                domContentLoadedMs: { type: "number" },
                loadMs: { type: "number" },
                firstContentfulPaintMs: { type: "number" },
                resourceCount: { type: "integer" },
                scriptBytes: { type: "number" },
                styleBytes: { type: "number" },
                imageBytes: { type: "number" },
                transferSize: { type: "number" },
                decodedBodySize: { type: "number" },
                thirdPartyOrigins: { type: "array", items: { type: "string" } },
              },
            },
            capturedAt: { type: "string", format: "date-time" },
          },
        },
      },
    },
  };
}
