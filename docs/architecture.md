# Architecture

VibeTrace is a pnpm workspace with three applications and five shared packages. The web app and extension are separate clients of one API and one deterministic analysis pipeline. There is no second scoring implementation for the extension.

## Components

```text
┌──────────────────────┐      ┌────────────────────────┐
│ React web app        │      │ Chrome MV3 extension   │
│ apps/web             │      │ apps/extension         │
│ · routes & charts    │      │ · popup + side panel   │
│ · report UI          │      │ · background worker    │
│ · JSON/print/share   │      │ · content collector    │
└──────────┬───────────┘      └───────────┬────────────┘
           │ @vibetrace/api-client         │ @vibetrace/api-client
           └───────────────┬───────────────┘
                           ▼
                 ┌───────────────────┐
                 │ Fastify API       │
                 │ apps/api          │
                 │ · async queue     │
                 │ · validation      │
                 │ · stores/sharing  │
                 │ · OpenAPI/logs    │
                 └─────────┬─────────┘
                           ▼
              ┌─────────────────────────────┐
              │ @vibetrace/analysis-engine  │
              │ · SSRF-safe fetch           │
              │ · extraction + probes       │
              │ · tech/AI fingerprints      │
              │ · seven category analyzers  │
              └──────────────┬──────────────┘
                             ▼
              ┌─────────────────────────────┐
              │ @vibetrace/scoring-engine   │
              │ · coverage-aware scores      │
              │ · AI evidence classifier     │
              │ · recommendations            │
              └─────────────────────────────┘
```

`@vibetrace/shared-types` defines the canonical Zod contracts for API envelopes, scan requests, snapshots, reports, scores, checks, technologies, evidence and sharing. Both clients validate responses. The API validates its own inputs and validates the completed report before storing it.

`@vibetrace/design-system` exposes CSS-variable primitives (`Button`, `Card`, `Badge`, `Field`, `Progress`, `Alert`, `Skeleton`, and others) and the dark-first token stylesheet. Tailwind is used for layout utilities in the web app; the extension reuses the same primitives with a compact layout.

## Analysis flow

### Remote scans (web)

1. `POST /api/v1/scans` validates `{ url, mode: "remote", client: "web" }`.
2. `ScanService` creates a queued record, returns `202` and schedules the scan.
3. The worker calls `analyzeWebsite()` with the configured limits.
4. `safeFetch` validates and pins the target address, follows redirects manually and validates each hop again.
5. The final HTML is parsed into bounded `DocumentFacts`. Same-origin script/style assets, source maps, `robots.txt` and a sitemap are optionally probed through the same fetch guard.
6. Technology and AI/source-pattern registries produce detections and weighted evidence.
7. Seven independent analyzers produce checks. The scoring engine computes coverage, scores and grades; unavailable categories stay unavailable.
8. The API validates the full `ScanReport`, stores it, updates progress and exposes it at `/report`.

### Snapshot scans (extension)

1. The user clicks analyze in the popup/side panel or uses the keyboard command.
2. The background worker injects `content.js` into the active tab under `activeTab` + `scripting`.
3. The content collector builds a bounded, escaped DOM skeleton and structured facts. It strips hidden/private content, form values, active elements, style attributes, query strings and secret-like strings.
4. The background validates the snapshot with `PageSnapshotSchema` and sends `{ mode: "snapshot", client: "extension", snapshot }`.
5. The API runs the **same** analyzers. Snapshot mode does not fetch the website. Header and external-asset checks become unavailable or heuristic rather than invented.
6. The extension polls status through its background worker and opens the full web report when finished.

The content collector is deliberately not a page scraper. It retains allowlisted structural and technical information, not page bodies.

## Scan queue and statuses

The queue lives in the API process:

- `MAX_CONCURRENT_SCANS` controls active workers.
- `SCAN_MAX_QUEUE` rejects work when the queue is full.
- `SCAN_TIMEOUT_MS` aborts the analysis signal and marks the scan failed.
- On progress updates, status and percent are persisted.

Statuses:

```text
queued ──▶ running ──▶ completed
                    ├─▶ partially_completed
                    └─▶ failed
```

`partially_completed` means the report was produced but meaningful evidence was unavailable or a bounded probe failed. The report carries `partialReason` and explicit limitations. A report endpoint returns `409 SCAN_NOT_READY` until a terminal success.

Queued work is in-process. Multiple API replicas need a shared queue and shared store before horizontal scaling; the current design intentionally keeps local setup simple.

## Storage

`ScanStore` is a narrow interface implemented by:

- **MemoryScanStore** — default; bounded history, retention sweep, zero dependencies.
- **PrismaScanStore** — optional PostgreSQL persistence. Prisma is loaded dynamically so the memory-mode install does not require it.

The Prisma schema stores scan metadata, validated report JSON and share token fields. See `docs/deployment.md` for enabling it.

## Sharing and exports

A share operation creates a random URL-safe token and records `sharedAt`. The public endpoint returns the stored report, which never contains raw HTML, script bodies, cookies, form values, storage or AI narratives. Revoking deletes the token; subsequent requests return `404`.

Web exports:

- **Copy** builds a plain-text summary from the validated report.
- **JSON** downloads the full report object with a stable filename.
- **PDF / print** opens `/scan/:id/print`, which hides app navigation and uses the browser's print dialog. PDF generation is browser-driven, not a server service.
- **Public sharing** is opt-in via the Share dialog.

## Error model

All API errors use:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request body is invalid.",
    "details": { "issues": [] }
  },
  "requestId": "…"
}
```

Codes include validation errors, not-found, scan-not-ready, queue-full, timeout, scan failures, blocked URLs, rate limiting, disabled AI and provider failures. `x-request-id` is echoed or generated and included in structured logs. The client normalizes network, timeout, HTTP and schema failures into `ApiClientError`.

## Design decisions and tradeoffs

- **One engine, two modes.** Snapshot mode reuses the remote analyzer with explicit unavailable checks. It does not pretend a browser snapshot has server headers.
- **No backend browser.** Avoiding headless Chrome reduces operational complexity and SSRF surface, at the cost of not measuring browser-only behavior.
- **Coverage over false precision.** Categories below 40% weighted coverage show no score. AI classification can be `insufficient` or `mixed`.
- **Server-side deterministic scoring.** Optional AI is only a narrative layer and never feeds scores.
- **Broad optional extension host access is scoped.** The extension requests a specific API origin when needed; it does not request all-site access at install time.
- **No auth in v1.** The API is a single-operator/local service. Exposing it publicly requires a reverse proxy with authentication and stricter rate limits.
