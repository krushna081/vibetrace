# VibeTrace

Evidence-first website forensics for AI-era builds. VibeTrace analyzes publicly reachable websites and sanitized browser snapshots, then explains what was observed, what it means, and what was **not** measured.

The monorepo contains a responsive React web app, a Chrome Manifest V3 extension, a Fastify API, and shared analysis and scoring packages. All clients use the same Zod contracts and the same analysis pipeline.

> VibeTrace does not claim to detect AI authorship. Its AI-development signal index is a weighted evidence summary, not a probability. Missing signals are not evidence that AI was not used.

## What is implemented

- **Web app** — landing, scanner, live scan progress, report overview, AI-signal evidence, technology intelligence, security, performance, quality/SEO, history, comparison, settings, methodology, privacy, public shared reports, printable report and 404 states.
- **Chrome MV3 extension** — popup, side panel, background service worker, a read-only content collector, active-tab snapshots, a keyboard command, configurable API/website origins and links to full reports.
- **API** — asynchronous scan queue, validated creation, polling status, reports, history, deletion, revocable public links, registries, optional AI narrative, OpenAPI and request IDs.
- **Analysis engine** — SSRF-guarded fetching on every redirect, bounded parsing, technology fingerprints, AI-builder evidence, asset/robots/sitemap probes and source-map checks when available.
- **Scoring engine** — seven independent scores, explicit coverage, withheld scores when evidence is insufficient, recommendations and documented methodology.
- **Storage** — in-memory by default; optional PostgreSQL through Prisma (install and generate the client to enable it).
- **Exports** — validated JSON download, copyable plain-text summary and print-to-PDF view.
- **Tests** — URL guard/SSRF, safe fetch, analyzers, scoring/classification, API lifecycle/sharing, web components, extension sanitization and formatting.
- **Docs** — architecture, API, extension, security, deployment and methodology guides in [`docs/`](./docs).

## Repository layout

```text
vibetrace/
├─ apps/
│  ├─ api/                 Fastify v1 API, queue, stores, OpenAPI, Prisma schema
│  ├─ web/                 React + Vite + Tailwind web application
│  └─ extension/           Chrome MV3 extension (popup + side panel + content script)
├─ packages/
│  ├─ shared-types/        Zod schemas and API/report/snapshot contracts
│  ├─ analysis-engine/     Fetching, extraction, probes, fingerprints, analyzers
│  ├─ scoring-engine/      Category scores, AI classifier, recommendations, methodology
│  ├─ api-client/          Typed client shared by the web app and extension
│  └─ design-system/       CSS-variable primitives and design tokens
├─ e2e/                    Playwright browser tests
├─ docs/                   Architecture, API, extension, security, deployment, methodology
├─ scripts/                Repository utilities
└─ .env.example            Every supported configuration variable
```

## Requirements

- Node.js **20.19+** (tested with Node 24)
- pnpm **12.x** with workspace support
- A modern desktop browser for the web app
- Chrome/Chromium **116+** for the extension
- Optional: PostgreSQL for Prisma storage
- Optional: an Ollama or OpenAI-compatible endpoint for AI narratives

## Quick start

```bash
cd vibetrace
pnpm install --allow-build=esbuild
cp .env.example .env
pnpm dev
```

Open:

- Web app: <http://localhost:5173>
- API: <http://localhost:8787>
- Interactive API docs: <http://localhost:8787/api/v1/docs>
- OpenAPI JSON: <http://localhost:8787/api/v1/openapi.json>

`pnpm dev` runs the API and web app in parallel. On Termux/Android, use `pnpm install --allow-build=esbuild`; esbuild needs its native postinstall step.

### Useful commands

```bash
pnpm dev:api              # API only
pnpm dev:web              # web only
pnpm build                # build web, extension and API
pnpm typecheck            # all workspace type checks
pnpm test                 # Vitest unit/integration suites
pnpm test:coverage        # coverage report
pnpm test:e2e             # Playwright (desktop Chromium required)
pnpm lint                 # ESLint
pnpm format:check         # Prettier check
```

## Chrome extension

```bash
pnpm build:extension
```

Then open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `apps/extension/dist`.

The extension defaults to:

- API: `http://localhost:8787`
- Website: `http://localhost:5173`

Use the extension settings panel to point it at another API or website. Custom API origins trigger a scoped `chrome.permissions.request` for that origin only.

Analyze the current tab from the popup, the side panel or `Ctrl+Shift+Y` (`Command+Shift+Y` on macOS). The content collector reads only allowlisted DOM structure and technical artifacts; it never reads form values, password fields, cookies, storage, history or keystrokes. See [`docs/extension.md`](./docs/extension.md).

## How a scan flows

```text
Web app ── POST /scans ─────┐
Extension ── snapshot ──────┤
                            ▼
                    Fastify scan queue
                            │
                ┌───────────┴────────────┐
                │                        │
        SSRF-safe remote fetch     Sanitized snapshot
        + bounded probes           (no network fetch)
                │                        │
                └───────────┬────────────┘
                            ▼
              Shared analysis + scoring pipeline
                            ▼
         Validated ScanReport stored by the API
                            ▼
       Web report / JSON / print / shared link
```

Scan creation returns `202` with a scan id and progress URLs. Statuses are `queued`, `running`, `completed`, `failed` and `partially_completed`. A report is only available after the scan reaches a terminal state.

## Routes

| Method   | Path                            | Purpose                                   |
| -------- | ------------------------------- | ----------------------------------------- |
| `GET`    | `/api/v1/health`                | API, storage and optional AI status       |
| `POST`   | `/api/v1/scans`                 | Create a remote or snapshot scan          |
| `GET`    | `/api/v1/scans`                 | List recent scans                         |
| `DELETE` | `/api/v1/scans`                 | Clear stored scans                        |
| `GET`    | `/api/v1/scans/:id`             | Scan detail and progress                  |
| `DELETE` | `/api/v1/scans/:id`             | Delete one scan                           |
| `GET`    | `/api/v1/scans/:id/status`      | Lightweight status polling                |
| `GET`    | `/api/v1/scans/:id/report`      | Validated report (`409` until ready)      |
| `POST`   | `/api/v1/scans/:id/share`       | Create/return a revocable public token    |
| `DELETE` | `/api/v1/scans/:id/share`       | Revoke the public token                   |
| `POST`   | `/api/v1/scans/:id/explain`     | Optional consented AI narrative           |
| `GET`    | `/api/v1/public/reports/:token` | Public report without source or narrative |
| `GET`    | `/api/v1/technologies`          | Technology fingerprint registry           |
| `GET`    | `/api/v1/fingerprints`          | AI/source-pattern fingerprint registry    |
| `GET`    | `/api/v1/openapi.json`          | OpenAPI document                          |
| `GET`    | `/api/v1/docs`                  | Interactive docs page                     |

Web routes: `/`, `/scan`, `/scan/:id`, `/scan/:id/ai`, `/scan/:id/technology`, `/scan/:id/security`, `/scan/:id/performance`, `/scan/:id/quality`, `/history`, `/compare?a=…&b=…`, `/settings`, `/methodology`, `/privacy`, `/shared/:token`, `/scan/:id/print`.

## Configuration

Copy `.env.example` to `.env`. Key variables:

| Variable                                  | Default                 | Notes                                                 |
| ----------------------------------------- | ----------------------- | ----------------------------------------------------- |
| `PORT`                                    | `8787`                  | API port                                              |
| `PUBLIC_API_URL`                          | `http://localhost:8787` | Public API root                                       |
| `WEB_BASE_URL`                            | `http://localhost:5173` | Public website root                                   |
| `CORS_ORIGINS`                            | localhost web origins   | Comma-separated; extension origins are always allowed |
| `STORAGE_DRIVER`                          | `memory`                | `memory` or `prisma`                                  |
| `DATABASE_URL`                            | —                       | Required for Prisma                                   |
| `SCAN_TIMEOUT_MS`                         | `45000`                 | Whole-scan deadline                                   |
| `MAX_CONCURRENT_SCANS`                    | `2`                     | Worker concurrency                                    |
| `SCAN_MAX_QUEUE`                          | `50`                    | Queued-scan limit                                     |
| `SCAN_MAX_HTML_BYTES`                     | `3145728`               | HTML cap                                              |
| `SCAN_MAX_REDIRECTS`                      | `5`                     | Redirect cap                                          |
| `SCAN_ALLOWED_PORTS`                      | `80,443`                | Allowed remote ports                                  |
| `SCAN_ASSET_PROBES`                       | `true`                  | Same-origin JS/CSS/source-map probes                  |
| `SCAN_RETENTION_HOURS`                    | `24`                    | In-memory retention sweep                             |
| `SCAN_CREATE_RATE_LIMIT_MAX`              | `10`                    | Scan creations per window                             |
| `AI_PROVIDER`                             | `disabled`              | `disabled`, `ollama`, `openai-compatible`             |
| `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` | —                       | Server-side only; never sent to browsers              |
| `VITE_API_BASE_URL`                       | `http://localhost:8787` | Web build-time API default                            |

Never commit real API keys. The optional AI narrative is sent only after the API validates a request with explicit consent; the web UI additionally requires a local consent setting.

## Optional PostgreSQL storage

The default in-memory store requires no database and is intended for local use. For persistent storage:

```bash
pnpm --filter @vibetrace/api add -D prisma
pnpm --filter @vibetrace/api add @prisma/client
export DATABASE_URL='postgresql://user:password@localhost:5432/vibetrace?schema=public'
pnpm db:generate
pnpm db:push
STORAGE_DRIVER=prisma pnpm dev:api
```

The schema lives at `apps/api/prisma/schema.prisma`. See [`docs/deployment.md`](./docs/deployment.md).

## Testing

```bash
pnpm typecheck
pnpm test
pnpm build
```

Vitest covers the security guard and redirect handling, bounded fetching, snapshot analysis, scoring and AI classification, the API lifecycle and sharing, web report components, formatting and extension snapshot sanitization.

Playwright tests live in `e2e/` and start the API and web app automatically:

```bash
pnpm test:e2e
```

They require a desktop Chromium that Playwright supports. Playwright refuses to run on Android/Termux, so browser E2E and loading the extension in Chrome must be performed on a supported desktop environment.

## Limitations

- No website JavaScript is executed on the API. Browser-only behavior and full Core Web Vitals cannot be measured server-side.
- Snapshot reports cannot inspect response headers, cookie attributes, external bundles or assets that the extension did not capture.
- AI-development detection is heuristic. It surfaces evidence and contradictions; it cannot establish authorship.
- Automated security checks are passive observations, not vulnerability tests. Accessibility checks cover detectable markup issues only.
- Scores are withheld when weighted coverage is below 40%. “—” means unavailable, not zero.
- The default memory store is process-local and loses scans on restart. The API has no user accounts or authentication; exposed deployments should sit behind access control and a reverse proxy.
- Public share links are unlisted, revocable and exclude raw source and AI narratives, but they are not password-protected and do not expire automatically.
- The extension was built and unit-tested in this environment; interactive Chrome validation requires a desktop Chrome installation.

## Documentation

- [Architecture](./docs/architecture.md)
- [API reference](./docs/api.md)
- [Extension guide](./docs/extension.md)
- [Security model](./docs/security.md)
- [Deployment](./docs/deployment.md)
- [Scoring methodology](./docs/methodology.md)

## License

Released under the [MIT License](./LICENSE). © 2026 Krushna Jadhav.
