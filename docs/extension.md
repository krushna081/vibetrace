# Chrome extension

`apps/extension` is a Manifest V3 extension that analyzes the active tab with the same VibeTrace API and analysis pipeline as the web app. It is intentionally small in scope: one tab, one user action, one sanitized snapshot.

## Build and load

```bash
pnpm install --allow-build=esbuild
pnpm build:extension
```

The build runs icon generation, type checking, the popup/side-panel/background Vite build and a separate content-script build. Output is written to `apps/extension/dist`.

In Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select `apps/extension/dist`.
5. Ensure the VibeTrace API is running at the configured URL and the website is running for report links.

The extension requires Chrome 116+ for the side panel API.

## Manifest and permissions

```json
"permissions": ["activeTab", "scripting", "storage", "sidePanel"],
"host_permissions": ["http://localhost:8787/*", "http://127.0.0.1:8787/*"],
"optional_host_permissions": ["http://*/*", "https://*/*"]
```

Why each permission exists:

- **activeTab** — temporary access to the tab the user explicitly invokes the extension on. No all-site access at install time.
- **scripting** — inject the bundled, self-contained content collector into that tab.
- **storage** — remember API/website settings and the last scan id.
- **sidePanel** — present the full workflow in Chrome's side panel.
- **host_permissions** — allow the default local API without a permission prompt.
- **optional_host_permissions** — allow a custom API origin after an explicit, scoped `chrome.permissions.request` from the settings panel.

The extension does **not** request `tabs`, `history`, `cookies`, `webRequest`, `management`, clipboard or all-site host access.

## User interface

- **Popup** — active-tab summary, analyze action, progress, compact result card, last scan, privacy note, settings.
- **Side panel** — larger result view, full-report link, recent scan, privacy boundary, "how it works", settings.
- **Background worker** — serializes errors, injects the collector, validates the snapshot, calls the API, updates the badge, stores the last scan and opens website report links.
- **Settings** — API and website base URLs, test connection, save, health status, permission explanation, methodology link.

Analyze actions:

- Click the extension action, then **Analyze current tab**.
- Open the side panel from the popup.
- Press `Ctrl+Shift+Y` (`Command+Shift+Y` on macOS).

The keyboard command uses the same capture path. Chrome grants the temporary active-tab permission when the user invokes the extension.

## Snapshot privacy boundary

`src/content/collect.ts` builds a bounded `PageSnapshot` from the rendered DOM. It intentionally removes or redacts:

- values of inputs, textareas and selects;
- hidden fields and inputs;
- password and other sensitive field content;
- cookies, `localStorage`, `sessionStorage`, IndexedDB and history;
- keystrokes, event listeners and page JavaScript execution;
- iframes, embedded objects, form actions and active content;
- script bodies and style declarations;
- inline `style` values and event handler attributes;
- query strings and fragments from the page URL, resource URLs and sampled page links;
- secret-like strings (API keys, bearer tokens, private key blocks) in sampled inline scripts and comments;
- email addresses in sampled technical text;
- arbitrary page body text, except allowlisted accessible names such as headings, links, buttons, labels and alt text;
- personal metadata such as author, and most non-technical meta tags.

It retains technical evidence that is useful for analysis:

- title, language, allowlisted metadata (generator, description, viewport, `og:*`, application name, theme color, robots, canonical);
- escaped heading/link/button/label/image structure with bounded depth and counts;
- script and stylesheet URLs without query strings;
- class-name samples for framework fingerprints;
- bounded inline-script and JSON-LD excerpts, redacted;
- HTML comments only when they contain technical builder/hosting markers;
- navigation/resource timing summaries;
- DOM depth, node count, duplicate IDs, semantic elements, accessibility counters.

Snapshot mode has no access to response headers, cookies, external bundles or anything not represented in the DOM. Those checks are marked unavailable instead of imputed.

### Server side defense in depth

The API does not trust the extension payload. It validates the snapshot with `PageSnapshotSchema`, caps HTML at 600,000 characters, and `buildSnapshotHtml()` runs a second sanitizer that removes scripts, frames, objects, embeds, styles, links, metadata in the body, SVG/MathML, event handlers and script-bearing URL schemes before parsing.

## Settings and permissions flow

Default settings:

```text
API:     http://localhost:8787
Website: http://localhost:5173
```

`Test` and `Save settings` both request the exact API origin if it is not already covered:

```ts
chrome.permissions.request({ origins: ["https://api.example.com/*"] });
```

If the user denies the prompt, the settings are not treated as connected and the error explains that Chrome cannot call that API. The permission is narrow to the API origin, not all websites. The website base URL is only used to open links in a new tab.

The background uses the shared `@vibetrace/api-client`; it never sends the API key or any browser credential. No API keys are stored in the extension.

## Error handling

The background normalizes common Chrome errors into readable codes:

- `PAGE_ACCESS_DENIED` — internal pages, Chrome Web Store, other extensions, local files.
- `TAB_UNAVAILABLE` — tab closed or navigated during capture.
- `CONTENT_UNAVAILABLE` — content script did not respond.
- API errors from `ApiClientError` — validation, not found, rate limit, scan not ready, provider errors.
- `SERVICE_WORKER_UNAVAILABLE` — popup could not reach the extension worker.

The UI shows retry/settings actions and never displays a report skeleton as if it were data.

## Full report links

The extension opens:

```text
${webBaseUrl}/scan/${id}
```

The web app loads the stored report from the API. The extension does not bundle the report UI or a second scoring implementation. Public sharing is available from the full report page; shared reports deliberately omit AI narratives.

## Development

```bash
pnpm dev:extension        # Vite dev server for popup/side panel
pnpm build:extension
pnpm --filter @vibetrace/extension typecheck
```

Vite uses two passes: the normal build emits the service worker, popup and side panel; `vite build --mode content` emits a self-contained IIFE content script.

## Manual verification checklist (desktop Chrome)

1. Start API and web app, build and load the unpacked extension.
2. Open a normal public HTTPS page and analyze from the popup.
3. Confirm a progress state, then a compact result with security/performance/tech cards and a full-report link.
4. Open the side panel and repeat; confirm the report opens in the configured website.
5. Open a `chrome://` page and confirm the friendly blocked state.
6. Set a custom API origin and verify Chrome asks only for that origin; deny once and confirm the connection failure is explained.
7. Confirm form values, password contents, cookies and unrelated body text are absent from the request payload.
8. Revoke a share link on the website and confirm the public URL stops working.

## Limitations

- Chrome does not permit content-script access to internal pages, the Chrome Web Store, other extension pages or local files.
- Snapshot analysis cannot inspect response headers, cookie flags or external bundles.
- The extension depends on the configured API being reachable from the browser; offline analysis is not supported.
- Chrome may clear `storage.local` data if the extension is removed or its profile is reset.
- The active-tab grant is invalidated by navigation; capture errors are shown rather than silently retried against a different page.
- Interactive Chrome testing is not possible in this Termux/Android workspace; the extension is built and its snapshot collector/contracts are covered by tests, but a desktop Chrome pass is still required before distribution.
