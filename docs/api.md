# API reference (v1)

Base path: `/api/v1`

The source of truth for request and response shapes is [`packages/shared-types/src/schemas.ts`](../packages/shared-types/src/schemas.ts). The running API publishes OpenAPI at `/api/v1/openapi.json` and interactive documentation at `/api/v1/docs`.

All JSON responses use an envelope:

```json
{ "data": {} }
```

Errors use:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request body is invalid.",
    "details": { "issues": [] }
  },
  "requestId": "9f8c…"
}
```

Every response includes `x-request-id`. You may send a request id of 8–100 characters matching `[A-Za-z0-9._-]` in `x-request-id`; otherwise one is generated. The API sends `cache-control: no-store`, `x-content-type-options: nosniff`, a restrictive CSP and no CORS credentials.

## Health

```http
GET /api/v1/health
```

```json
{
  "data": {
    "status": "ok",
    "version": "0.1.0",
    "uptimeSeconds": 42,
    "storage": "memory",
    "ai": { "enabled": false, "provider": "disabled" },
    "scanQueue": { "active": 0, "queued": 0 }
  }
}
```

`ai.enabled` is true only when a provider, base URL and model are configured server-side. It does not mean any request has consent.

## Create a scan

```http
POST /api/v1/scans
Content-Type: application/json
```

### Remote scan

```json
{
  "url": "https://example.com",
  "mode": "remote",
  "client": "web"
}
```

### Snapshot scan

```json
{
  "url": "https://example.com/dashboard",
  "mode": "snapshot",
  "client": "extension",
  "snapshot": {
    "url": "https://example.com/dashboard",
    "title": "Example dashboard",
    "lang": "en",
    "meta": { "generator": "Lovable" },
    "html": "<main><h1>Example</h1></main>",
    "scriptSources": ["https://example.com/app.js"],
    "stylesheetHrefs": ["https://example.com/app.css"],
    "dom": {
      "nodeCount": 20,
      "maxDepth": 4,
      "headingLevels": [1],
      "imageCount": 0,
      "imagesWithAlt": 0,
      "imageSources": [],
      "inputCount": 0,
      "labeledInputCount": 0,
      "buttonCount": 1,
      "unnamedButtonCount": 0,
      "linkCount": 0,
      "unnamedLinkCount": 0,
      "duplicateIds": 0,
      "inlineStyleCount": 0,
      "inlineScriptCount": 0,
      "semanticElements": ["main"],
      "classSignatureSamples": [],
      "inlineScriptSamples": [],
      "htmlComments": [],
      "jsonLdSamples": []
    },
    "timing": {
      "ttfbMs": 120,
      "domContentLoadedMs": 500,
      "loadMs": 800,
      "firstContentfulPaintMs": 700,
      "transferSize": 90000,
      "decodedBodySize": 250000,
      "resourceCount": 10,
      "thirdPartyOrigins": [],
      "scriptBytes": 120000,
      "styleBytes": 10000,
      "imageBytes": 60000
    },
    "capturedAt": "2026-11-15T12:00:00.000Z"
  }
}
```

Snapshot payloads are strictly validated; HTML is capped (600,000 characters by the shared schema and further bounded by the API request limit). The engine applies a second sanitizer to the snapshot body before parsing.

Responses:

- `202 Accepted` — queued or running.
- `400 VALIDATION_ERROR` — malformed URL, mode/client mismatch, invalid snapshot or oversized payload.
- `429 RATE_LIMITED` — creation or global rate limit exceeded.
- `429 SCAN_QUEUE_FULL` — queue limit reached.

```json
{
  "data": {
    "id": "d6e0f33d-…",
    "status": "queued",
    "progress": {
      "stage": "Queued",
      "percent": 0,
      "message": "Waiting for an analysis worker"
    },
    "statusUrl": "/api/v1/scans/d6e0f33d-…/status",
    "reportUrl": "/api/v1/scans/d6e0f33d-…/report",
    "requestId": "…"
  }
}
```

## Status and detail

```http
GET /api/v1/scans/:id/status
GET /api/v1/scans/:id
```

Status:

```json
{
  "data": {
    "id": "d6e0f33d-…",
    "status": "running",
    "progress": { "stage": "Analyzing security", "percent": 62, "message": "…" },
    "error": null,
    "createdAt": "2026-11-15T12:00:00.000Z",
    "completedAt": null
  }
}
```

Statuses: `queued`, `running`, `completed`, `failed`, `partially_completed`. Terminal failures include `{ code, message }` in `error`.

Detail adds the stored summary, `startedAt`, `sharedAt` and `reportReady`.

## Report

```http
GET /api/v1/scans/:id/report
```

Returns the full validated `ScanReport`. The report includes:

- `scan` metadata (mode, client, status, timings, HTTP status)
- `overview` (title, summary, key findings, category values)
- `ai` evidence, contradictions, builder fingerprints and limitations
- `technologies` with confidence and evidence
- `source` structural counts only
- `sections` (security, performance, accessibility, SEO, code quality)
- `scores` (seven independent categories with checks, coverage and methodology)
- `recommendations`, `limitations`, `partialReason`

`409 SCAN_NOT_READY` is returned while queued or running; `404 NOT_FOUND` after deletion. A failed scan never has a report.

## History and deletion

```http
GET /api/v1/scans?limit=50
DELETE /api/v1/scans/:id
DELETE /api/v1/scans
```

History returns lightweight scan summaries sorted newest first. `DELETE /api/v1/scans` clears stored scans and returns the count.

## Sharing

```http
POST /api/v1/scans/:id/share
DELETE /api/v1/scans/:id/share
GET /api/v1/public/reports/:token
```

Share requires a stored report. The operation is idempotent and returns:

```json
{
  "data": {
    "token": "random-url-safe-token",
    "path": "/shared/random-url-safe-token",
    "createdAt": "2026-11-15T12:05:00.000Z"
  }
}
```

The public endpoint returns `{ "data": { "report": …, "sharedAt": … } }`. Public reports exclude raw source and AI narratives. Revocation returns `204`, after which the public token returns `404`.

Public share links are unlisted but not password-protected. They do not expire automatically.

## Optional AI narrative

```http
POST /api/v1/scans/:id/explain
Content-Type: application/json

{ "consent": true }
```

Requires a completed report, a server-configured provider and explicit `consent: true`. Returns:

```json
{
  "data": {
    "explanation": "…",
    "provider": "openai-compatible",
    "model": "…",
    "generatedAt": "2026-11-15T12:06:00.000Z",
    "disclaimer": "AI-generated explanation. …"
  }
}
```

The explanation is not stored in the report and does not change scores. Errors: `400 VALIDATION_ERROR` without consent, `404` without a report, `503 AI_DISABLED`, `502 AI_PROVIDER_ERROR`/`AI_PROVIDER_INVALID`/`AI_PROVIDER_UNAVAILABLE`.

## Registries and meta

```http
GET /api/v1/technologies
GET /api/v1/fingerprints
GET /api/v1/openapi.json
GET /api/v1/docs
```

Registries are read-only and include detection methods, descriptions, sources and caveats. They are useful for auditing why a technology or AI pattern exists.

## Limits and headers

- Request body limit: 2 MB.
- Global rate limit: configurable (`RATE_LIMIT_MAX`, default 120/window).
- Scan creation rate limit: configurable (`SCAN_CREATE_RATE_LIMIT_MAX`, default 10/window).
- AI explanation requests: 5/minute.
- Public report requests: 60/minute.
- Rate-limited responses include the standard rate-limit and `Retry-After` headers from `@fastify/rate-limit`.

## CORS

Configured website origins are allowed. `chrome-extension://*` origins are always allowed because the API is credential-free and public read/write behavior is already governed by rate limits. No cookies or credentials are used. Set `CORS_ORIGINS` to your deployed web origin.

## curl example

```bash
API=http://localhost:8787/api/v1

created=$(curl -sS -X POST "$API/scans" \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com","mode":"remote","client":"web"}')

id=$(printf '%s' "$created" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).data.id')

until curl -sS "$API/scans/$id/status" | grep -q '"status":"completed"'; do
  sleep 1
done

curl -sS "$API/scans/$id/report" > report.json
```
