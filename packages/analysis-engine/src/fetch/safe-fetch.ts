import { isIP } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";
import type { Dispatcher, Response as UndiciResponse } from "undici";
import { ScanError } from "./errors.js";
import {
  createPinnedLookup,
  validateTargetUrl,
  type HostResolver,
  type ValidatedTarget,
} from "./url-guard.js";

const DEFAULT_ACCEPT_HTML =
  "text/html,application/xhtml+xml,application/xml;q=0.8,text/plain;q=0.5,*/*;q=0.1";
const DEFAULT_UA = "VibeTraceBot/0.1 (+https://github.com/your-org/vibetrace)";

export type SafeFetchImplementation = (
  input: string,
  init: Record<string, unknown>,
) => Promise<UndiciResponse>;

export interface CookieFlags {
  count: number;
  allSecure: boolean;
  allHttpOnly: boolean;
  allSameSite: boolean;
}

export interface SafeFetchResult {
  requestUrl: string;
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  text: string;
  bodyBytes: number;
  contentType: string;
  charset: string;
  ttfbMs: number;
  durationMs: number;
  redirects: string[];
  truncated: boolean;
  cookieFlags: CookieFlags;
}

export interface SafeFetchOptions {
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  allowedPorts?: number[];
  userAgent?: string;
  resolver?: HostResolver;
  fetchImpl?: SafeFetchImplementation;
  accept?: string;
  allowedContentTypes?: string[];
  allowMissingContentType?: boolean;
  truncate?: boolean;
  signal?: AbortSignal;
}

const HTML_TYPES = ["text/html", "application/xhtml+xml"];
const TEXT_TYPES = ["text/plain", "application/xml", "text/xml"];
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const SENSITIVE_HEADERS = new Set([
  "set-cookie",
  "cookie",
  "authorization",
  "proxy-authorization",
  "proxy-authenticate",
]);

function collectHeaders(response: UndiciResponse): {
  headers: Record<string, string>;
  cookieFlags: CookieFlags;
} {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, name) => {
    const lower = name.toLowerCase();
    if (SENSITIVE_HEADERS.has(lower)) return;
    headers[lower] = value.slice(0, 16_384);
  });

  let cookieHeaders: string[] = [];
  const maybeGetSetCookie = (response.headers as unknown as { getSetCookie?: () => string[] })
    .getSetCookie;
  if (typeof maybeGetSetCookie === "function") {
    cookieHeaders = maybeGetSetCookie.call(response.headers);
  } else {
    const raw = response.headers.get("set-cookie");
    if (raw) cookieHeaders = [raw];
  }

  return {
    headers,
    cookieFlags: {
      count: cookieHeaders.length,
      allSecure:
        cookieHeaders.length > 0 && cookieHeaders.every((cookie) => /;\s*secure\b/i.test(cookie)),
      allHttpOnly:
        cookieHeaders.length > 0 && cookieHeaders.every((cookie) => /;\s*httponly\b/i.test(cookie)),
      allSameSite:
        cookieHeaders.length > 0 && cookieHeaders.every((cookie) => /;\s*samesite=/i.test(cookie)),
    },
  };
}

function parseContentType(value: string | null): { mime: string; charset: string } {
  if (!value) return { mime: "", charset: "utf-8" };
  const [mimeRaw, ...parts] = value.split(";");
  const charsetPart = parts.find((part) => part.trim().toLowerCase().startsWith("charset="));
  const charset =
    charsetPart
      ?.split("=")[1]
      ?.trim()
      .replace(/^["']|["']$/g, "") ?? "utf-8";
  return { mime: (mimeRaw ?? "").trim().toLowerCase(), charset: charset.toLowerCase() };
}

function decodeBody(buffer: Buffer, charset: string): string {
  const label = /^[a-z0-9_-]+$/i.test(charset) ? charset : "utf-8";
  try {
    return new TextDecoder(label, { fatal: false }).decode(buffer);
  } catch {
    return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  }
}

function makeAgent(target: ValidatedTarget, timeoutMs: number): Agent {
  const lookup = createPinnedLookup(target.pinned);
  return new Agent({
    connect: {
      lookup: lookup as never,
      timeout: Math.max(1_000, timeoutMs),
      ...(isIP(target.hostname) === 0 ? { servername: target.hostname } : {}),
    },
  });
}

async function readBody(
  response: UndiciResponse,
  maxBytes: number,
  truncate: boolean,
): Promise<{ buffer: Buffer; truncated: boolean }> {
  if (!response.body) return { buffer: Buffer.alloc(0), truncated: false };

  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes && !truncate) {
    await response.body.cancel().catch(() => undefined);
    throw new ScanError(
      "RESPONSE_TOO_LARGE",
      `Content-Length ${declaredLength} exceeds ${maxBytes}`,
    );
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      if (total + value.byteLength > maxBytes) {
        if (!truncate) {
          await reader.cancel().catch(() => undefined);
          throw new ScanError("RESPONSE_TOO_LARGE", `Response exceeded ${maxBytes} bytes`);
        }
        chunks.push(value.subarray(0, maxBytes - total));
        total = maxBytes;
        truncated = true;
        await reader.cancel().catch(() => undefined);
        break;
      }
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }

  return {
    buffer: Buffer.concat(
      chunks.map((chunk) => Buffer.from(chunk)),
      total,
    ),
    truncated,
  };
}

/**
 * Controlled outbound HTTP client for all untrusted website content.
 *
 * - http/https only, no credentials, restricted ports
 * - every redirect hop is validated and DNS-pinned individually
 * - response size, redirect count and wall-clock time are bounded
 * - cookies are never sent and Set-Cookie values never leave this function
 */
export async function safeFetch(
  input: string | URL,
  options: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const maxBytes = options.maxBytes ?? 3_145_728;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const maxRedirects = options.maxRedirects ?? 5;
  const allowedContentTypes = options.allowedContentTypes ?? [...HTML_TYPES];
  const allowMissingContentType = options.allowMissingContentType ?? true;
  const fetchImpl = options.fetchImpl ?? (undiciFetch as unknown as SafeFetchImplementation);
  const startedAt = performance.now();
  let firstResponseAt: number | null = null;
  let current = new URL(input.toString());
  const requestUrl = current.toString();
  const redirects: string[] = [];
  const seen = new Set<string>();

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    if (options.signal?.aborted) throw new ScanError("SCAN_ABORTED");
    if (seen.has(current.toString())) {
      throw new ScanError("TOO_MANY_REDIRECTS", "Redirect loop detected");
    }
    seen.add(current.toString());

    const target = await validateTargetUrl(current, {
      resolver: options.resolver,
      allowedPorts: options.allowedPorts,
    });

    const dispatcher = makeAgent(target, timeoutMs);
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onExternalAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onExternalAbort, { once: true });

    try {
      let response: UndiciResponse;
      try {
        response = await fetchImpl(target.url.toString(), {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
          dispatcher,
          headers: {
            "user-agent": options.userAgent ?? process.env.SCAN_USER_AGENT ?? DEFAULT_UA,
            accept: options.accept ?? DEFAULT_ACCEPT_HTML,
            "accept-encoding": "gzip, deflate, br",
            "cache-control": "no-cache",
          },
        });
      } catch (error) {
        if (timedOut) throw new ScanError("FETCH_TIMEOUT", "Request timed out", error);
        if (options.signal?.aborted) throw new ScanError("SCAN_ABORTED", "Scan cancelled", error);
        if (error instanceof ScanError) throw error;
        const message = error instanceof Error ? error.message : "Network error";
        throw new ScanError("FETCH_FAILED", message, error);
      }

      if (firstResponseAt === null) firstResponseAt = performance.now();

      const { mime, charset } = parseContentType(response.headers.get("content-type"));

      if (REDIRECT_STATUSES.has(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel().catch(() => undefined);
        if (!location) {
          throw new ScanError("INVALID_REDIRECT", `HTTP ${response.status} without Location`);
        }
        if (hop === maxRedirects) {
          throw new ScanError("TOO_MANY_REDIRECTS", `Exceeded ${maxRedirects} redirects`);
        }
        let next: URL;
        try {
          next = new URL(location, target.url);
        } catch {
          throw new ScanError("INVALID_REDIRECT");
        }
        redirects.push(next.toString());
        current = next;
        continue;
      }

      const contentTypeAllowed =
        allowedContentTypes.includes(mime) ||
        (mime === "" && allowMissingContentType) ||
        (allowedContentTypes.includes("text/html") &&
          TEXT_TYPES.includes(mime) &&
          mime === "text/plain");

      if (!contentTypeAllowed) {
        await response.body?.cancel().catch(() => undefined);
        throw new ScanError(
          "UNSUPPORTED_CONTENT_TYPE",
          `Content-Type ${mime || "(missing)"} is not allowed`,
        );
      }

      const { buffer, truncated } = await readBody(response, maxBytes, options.truncate ?? false);
      const text = decodeBody(buffer, charset);
      const completedAt = performance.now();
      const headerData = collectHeaders(response);

      return {
        requestUrl,
        finalUrl: target.url.toString(),
        status: response.status,
        headers: headerData.headers,
        text,
        bodyBytes: buffer.byteLength,
        contentType: mime,
        charset,
        ttfbMs: Math.round((firstResponseAt ?? completedAt) - startedAt),
        durationMs: Math.round(completedAt - startedAt),
        redirects,
        truncated,
        cookieFlags: headerData.cookieFlags,
      };
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onExternalAbort);
      await (dispatcher as Dispatcher).close().catch(() => undefined);
    }
  }

  throw new ScanError("TOO_MANY_REDIRECTS");
}
