# Deployment

VibeTrace has three deployable parts:

1. **API** — Node.js service, built with tsup, default port 8787.
2. **Web app** — static React/Vite build, served by any static host with SPA fallback.
3. **Extension** — packaged `apps/extension/dist` for Chrome.

The default memory store and in-process queue make a single API instance the simplest safe deployment. A shared store alone is not enough for multiple API replicas; the queue would also need to move to a shared job system.

## Build

```bash
pnpm install --allow-build=esbuild
pnpm typecheck
pnpm test
pnpm build
```

Artifacts:

- `apps/web/dist/`
- `apps/extension/dist/`
- `apps/api/dist/`

Set the web build-time API default before building the web app if the API is not on localhost:

```bash
VITE_API_BASE_URL=https://api.example.com pnpm build:web
```

The web app also lets a user override the API base URL at runtime in Settings. That override is stored in `localStorage`; it does not change the server.

## API service

```bash
NODE_ENV=production \
HOST=127.0.0.1 \
PORT=8787 \
PUBLIC_API_URL=https://api.example.com \
WEB_BASE_URL=https://app.example.com \
CORS_ORIGINS=https://app.example.com \
pnpm start:api
```

Use a process supervisor (systemd, pm2, a platform process runner) to restart on failure. The API handles `SIGINT`/`SIGTERM` with a graceful shutdown.

Production checklist:

- `NODE_ENV=production`
- HTTPS termination in front of the API
- `HOST=127.0.0.1` when a reverse proxy is on the same host
- `CORS_ORIGINS` contains only trusted web origins (extension origins are always allowed)
- `PUBLIC_API_URL` matches the public URL (used in OpenAPI)
- `WEB_BASE_URL` matches the public website URL
- Strong `SCAN_CREATE_RATE_LIMIT_MAX` and `RATE_LIMIT_MAX` for your traffic
- `SCAN_TIMEOUT_MS` below the reverse-proxy request timeout
- Restrict outbound network egress if your infrastructure supports it
- Add authentication at the proxy or network layer; v1 has no user accounts
- Keep secrets only in server environment or a secret manager

Health check:

```http
GET https://api.example.com/api/v1/health
```

A healthy response has `status: "ok"` and a `200`. `degraded` may indicate an optional dependency problem; inspect logs and the storage/AI fields. Scan queue depth is included in the response.

### Reverse proxy example

```nginx
server {
    listen 443 ssl http2;
    server_name api.example.com;

    client_max_body_size 2m;

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 75s;
    }
}
```

Do not set a proxy body limit below the snapshot payload size or a response timeout below `SCAN_TIMEOUT_MS` plus overhead.

## Web app

Serve `apps/web/dist` as static files with SPA fallback so client routes work on refresh:

```nginx
server {
    listen 443 ssl http2;
    server_name app.example.com;
    root /var/www/vibetrace/web;
    index index.html;

    location /assets/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }
}
```

Headers worth setting at the web host:

- HTTPS only
- `Referrer-Policy: strict-origin-when-cross-origin` (or stricter)
- a CSP compatible with Vite assets and Recharts inline styles
- `X-Content-Type-Options: nosniff`

The report uses browser print-to-PDF. No server-side PDF renderer is required.

## Optional PostgreSQL

Prisma is loaded dynamically, so the default memory mode does not require the packages or a generated client. To enable persistence:

```bash
pnpm --filter @vibetrace/api add -D prisma
pnpm --filter @vibetrace/api add @prisma/client

export DATABASE_URL='postgresql://vibetrace:password@db:5432/vibetrace?schema=public'
pnpm db:generate
pnpm db:push

STORAGE_DRIVER=prisma \
DATABASE_URL="$DATABASE_URL" \
pnpm start:api
```

The schema is `apps/api/prisma/schema.prisma` and contains scan metadata, report JSON, summary JSON and share fields. Back up the database and run migrations (`prisma migrate deploy`) in real production; `db:push` is suitable for local bootstrap.

Remember to install the Prisma packages in the runtime image. `tsup` intentionally externalizes `@prisma/client` and `prisma`.

## Extension packaging

```bash
pnpm build:extension
cd apps/extension
zip -r ../vibetrace-extension.zip dist
```

Upload `vibetrace-extension.zip` to the Chrome Web Store or distribute it privately. The package contains only `dist` output and generated icons.

Before publishing:

- confirm the final manifest permissions and privacy disclosures;
- set default API/website URLs appropriate for your deployment;
- run the manual desktop Chrome checklist in [`extension.md`](./extension.md);
- ensure the API allows `chrome-extension://` CORS (it does) without credentials;
- ensure the API is reachable over HTTPS from browsers;
- decide whether broad optional host patterns are acceptable for store review. They are used to support custom API origins and are requested only per origin.

## Scaling and availability

- The in-memory store loses data on restart and is per-process.
- The scan queue is in-process; multiple API replicas would each have their own queue and memory store.
- For horizontal scaling, add a shared store (Prisma is available) **and** a shared job queue/worker model. This is not implemented.
- Use a single API instance with a persistent store for the simplest reliable deployment.
- Configure backups for PostgreSQL and monitor failed scans, queue depth, API latency and provider failures.

## Environments

Keep separate `.env` files or platform secret stores per environment. Never commit `.env`, API keys, database URLs or private keys. The `.gitignore` excludes common secret files.

For a quick staging check:

```bash
curl -sS https://api.example.com/api/v1/health
curl -sSI https://app.example.com/ | head
```

Then run one real remote scan through the UI and verify report, JSON export, print view and a revocable share link.
