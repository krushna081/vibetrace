# Security model

VibeTrace fetches arbitrary URLs supplied by users. The highest-risk part is SSRF. This document describes what is enforced, what is deliberately out of scope, and what a deployer must still do.

## Threat model

Assets and trust boundaries:

| Component                | Trust                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------- |
| Web app                  | Untrusted browser input; validated client and server side                             |
| Extension content script | Runs on an untrusted page; treats the DOM as hostile                                  |
| Extension snapshot       | Untrusted remote input at the API boundary; schema-validated and sanitized again      |
| API                      | Trusted application; no user accounts in v1                                           |
| Target website           | Untrusted remote content                                                              |
| Optional AI provider     | Operator-configured third party; receives only a bounded report summary after consent |
| Public share viewers     | Unauthenticated holders of an unlisted token                                          |

The primary adversarial goals are: reading internal services through the scanner, exfiltrating page secrets through the extension, causing resource exhaustion, or making a public link expose more than intended.

## SSRF protection

Every remote fetch — the main document, every redirect hop, same-origin asset probes, source maps, `robots.txt` and sitemaps — goes through `validateTargetUrl()`/`safeFetch()`.

### URL and host checks

- Only `http:` and `https:` are allowed.
- Usernames and passwords embedded in URLs are rejected, so credentials are never forwarded.
- Hostnames are lowercased and trailing dots normalized.
- Single-label hostnames are rejected.
- Blocked hostnames include `localhost`, metadata names, Kubernetes names and related aliases.
- Blocked suffixes include `.localhost`, `.local`, `.internal`, `.intranet`, `.lan`, `.home.arpa`, `.corp`, `.localdomain`.
- Ports default to `80,443` and are configurable only by the operator. Arbitrary ports are rejected.
- IP literals are validated directly; DNS hostnames are resolved before connecting.

### Address checks

`isPublicAddress()` parses IPv4 and IPv6 with `ipaddr.js` and rejects loopback, private, link-local, shared/CGNAT, documentation, benchmark, multicast, reserved, unspecified and other non-global ranges. It also rejects addresses that can smuggle non-public IPv4 destinations:

- IPv4-mapped IPv6 (`::ffff:127.0.0.1`);
- NAT64 (`64:ff9b::/96`);
- 6to4 (`2002::/16`);
- Teredo (`2001:0::/32`);
- known cloud metadata addresses such as `169.254.169.254`, `169.254.170.2`, `100.100.100.200`, `192.0.0.192` and `168.63.129.16`.

If **any** resolved address is non-public, the whole target is rejected. This prevents a DNS answer that mixes a public and private address from succeeding.

### DNS pinning and redirects

- `validateTargetUrl()` returns a selected validated address.
- Undici's `lookup` is replaced with `createPinnedLookup()` for the connection, so the validated address cannot be swapped by a second DNS answer (DNS rebinding).
- Redirects are followed manually with `redirect: "manual"`.
- Each `Location` value is resolved and revalidated from scratch: protocol, credentials, hostname, DNS, address and port.
- Redirect loops, malformed locations and hop-limit exhaustion are rejected with safe errors.
- Redirect chains are capped by `SCAN_MAX_REDIRECTS` (default 5).
- Cookies, authorization headers and browser credentials are never sent. Set-Cookie values are counted for security evidence and removed from the stored response headers.

### Bounds

- Whole-scan timeout: `SCAN_TIMEOUT_MS` (default 45 s), propagated as an abort signal.
- Per-fetch timeout: bounded (asset/probe timeouts shorter than the whole scan).
- HTML size: `SCAN_MAX_HTML_BYTES` (default 3 MB).
- Asset bytes and probe counts: `SCAN_ASSET_MAX_BYTES`, `SCAN_MAX_ASSET_PROBES`.
- Redirects: `SCAN_MAX_REDIRECTS`.
- Queue and concurrency: `SCAN_MAX_QUEUE`, `MAX_CONCURRENT_SCANS`.
- API request body: 2 MB.
- Snapshot HTML: 600,000 characters at the shared schema level.
- AI provider request: 30-second timeout; output capped.

Content types are checked before parsing. A non-HTML response for the document is rejected rather than blindly treated as a page.

## Extension security

- Uses `activeTab` + `scripting`; does not request all-site access at install.
- Minimal permissions: `activeTab`, `scripting`, `storage`, `sidePanel`.
- Custom API origins require a scoped optional-host permission prompt.
- Content script is a bundled local IIFE; remote code execution is not used.
- The collector does not read cookies, storage, history, form values, password values or keystrokes.
- Active content, event handlers, inline styles, iframes and secret-like strings are removed/redacted.
- Query strings and fragments are stripped from the page URL and resource URLs.
- The background validates the snapshot with Zod before sending it to the API.
- The API validates it again and applies a second HTML sanitizer.

## Output and data retention

Reports contain derived findings and sanitized observations. They never contain raw page HTML, script bodies, cookies, form values, storage or request headers.

- Public share tokens are 24 random bytes (32 URL-safe characters), stored uniquely, opt-in and revocable.
- Public reports exclude AI narratives and do not expose raw source.
- The default memory store is bounded and purges expired scans on a retention sweep.
- API responses use `cache-control: no-store`.
- Structured logs redact authorization, cookie, set-cookie, `apiKey` and `password` fields.
- API CSP is restrictive: `default-src 'none'`, inline styles only, no framing, no form submissions.

## API controls

- Zod validation for every body, path and query.
- `x-request-id` validation/generation and propagation.
- Global rate limit and a stricter scan-creation limit.
- Public-report endpoint limit.
- AI explanation limit.
- CORS is explicit; `chrome-extension://` origins are accepted, no credentials are allowed.
- Queue-full and rate-limit failures return structured errors rather than crashing.
- Request and scan timeouts abort work.

## Optional AI

AI is off by default. Enabling it requires server configuration (`AI_PROVIDER`, `AI_BASE_URL`, `AI_MODEL`, optional key) and a request body with `consent: true`. The web UI also requires a local consent toggle.

The provider receives a bounded textual summary: URL, mode, classification, evidence titles/descriptions, technologies, scores, failed checks and limitations. It does not receive raw HTML, headers, cookies or page storage. Generated narrative text is returned to the requester and is not persisted in reports or public shares. The response carries a disclaimer that it is not a forensic measurement or authorship determination.

Never place provider keys in `VITE_*` variables or extension storage.

## Residual risks and operator responsibilities

The application protects the fetch path, but no single layer is sufficient for every deployment:

- **No authentication.** The v1 API is designed for a trusted single-operator deployment. Put it behind an authenticated reverse proxy or private network before exposing it. Anyone who can reach the API can create scans and read history unless you add access control.
- **Public network egress.** The guard blocks non-public destinations, but it cannot prevent a public host from serving sensitive content it chooses to expose. Use an egress firewall/allowlist for stronger isolation where possible.
- **Resource use.** Rate limits and bounds reduce abuse but do not replace capacity planning. A public deployment should add per-IP quotas and monitoring.
- **Share links.** Tokens are unlisted, not password-protected and do not expire automatically. Revoke links that should no longer be reachable.
- **Target content.** Parsing untrusted HTML/JSON has inherent risk. Keep dependencies patched; the engine does not execute page JavaScript.
- **AI provider.** A configured provider is another trust boundary. Review its data handling, keep keys server-side, and obtain user consent.
- **Extension distribution.** Before shipping to the Chrome Web Store, review the final manifest, privacy disclosures and store policies. The current broad _optional_ host patterns exist only to support custom API origins and are requested one origin at a time.
- **TLS.** The dev defaults use HTTP on localhost. Deploy the API and web app behind HTTPS, and set `PUBLIC_API_URL`, `WEB_BASE_URL` and `CORS_ORIGINS` accordingly.

## Disclosure

If you find a security issue, do not open a public issue with exploit details. Report it privately to the operator of the deployment and include the request id, reproduction steps and affected component.
