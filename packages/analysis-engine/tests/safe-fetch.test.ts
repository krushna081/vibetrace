import { describe, expect, it, vi } from "vitest";
import type { Response as UndiciResponse } from "undici";
import { safeFetch, type SafeFetchImplementation } from "../src/fetch/safe-fetch.js";
import type { HostResolver } from "../src/fetch/url-guard.js";

const resolver: HostResolver = async () => [{ address: "93.184.216.34", family: 4 }];

function html(body: string, status = 200, headers: Record<string, string> = {}): UndiciResponse {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", ...headers },
  }) as unknown as UndiciResponse;
}

function redirect(location: string, status = 302): UndiciResponse {
  return new Response(null, { status, headers: { location } }) as unknown as UndiciResponse;
}

describe("safeFetch", () => {
  it("fetches a validated public URL and strips sensitive response headers", async () => {
    const fetchImpl = vi.fn<SafeFetchImplementation>(async () =>
      html("<html><title>OK</title></html>", 200, {
        "set-cookie": "session=secret; Secure; HttpOnly; SameSite=Lax",
        "x-frame-options": "DENY",
        "content-length": "30",
      }),
    );

    const result = await safeFetch("https://example.com/page", { fetchImpl, resolver });

    expect(result.status).toBe(200);
    expect(result.text).toContain("<title>OK</title>");
    expect(result.headers["set-cookie"]).toBeUndefined();
    expect(result.headers["x-frame-options"]).toBe("DENY");
    expect(result.cookieFlags).toEqual({
      count: 1,
      allSecure: true,
      allHttpOnly: true,
      allSameSite: true,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const init = fetchImpl.mock.calls[0]?.[1] as Record<string, unknown>;
    const headers = init.headers as Record<string, string>;
    expect(headers.cookie).toBeUndefined();
    expect(headers.authorization).toBeUndefined();
    expect(init.redirect).toBe("manual");
  });

  it("blocks a redirect to a private address before following it", async () => {
    const fetchImpl = vi.fn<SafeFetchImplementation>(async () =>
      redirect("http://127.0.0.1/latest/meta-data"),
    );
    await expect(safeFetch("https://example.com/", { fetchImpl, resolver })).rejects.toMatchObject({
      code: "BLOCKED_ADDRESS",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("blocks a redirect to a localhost hostname", async () => {
    const fetchImpl = vi.fn<SafeFetchImplementation>(async () =>
      redirect("http://localhost/admin"),
    );
    await expect(safeFetch("https://example.com/", { fetchImpl, resolver })).rejects.toMatchObject({
      code: "BLOCKED_HOSTNAME",
    });
  });

  it("revalidates every redirect hop and records the chain", async () => {
    const fetchImpl = vi
      .fn<SafeFetchImplementation>()
      .mockResolvedValueOnce(redirect("https://example.com/step-2"))
      .mockResolvedValueOnce(redirect("/final", 307))
      .mockResolvedValueOnce(html("<html><title>final</title></html>"));

    const result = await safeFetch("https://example.com/start", { fetchImpl, resolver });
    expect(result.requestUrl).toBe("https://example.com/start");
    expect(result.finalUrl).toBe("https://example.com/final");
    expect(result.redirects).toEqual(["https://example.com/step-2", "https://example.com/final"]);
  });

  it("rejects redirect loops", async () => {
    const fetchImpl = vi.fn<SafeFetchImplementation>(async () =>
      redirect("https://example.com/loop"),
    );
    await expect(
      safeFetch("https://example.com/loop", { fetchImpl, resolver }),
    ).rejects.toMatchObject({ code: "TOO_MANY_REDIRECTS" });
  });

  it("enforces the redirect limit", async () => {
    const fetchImpl = vi.fn<SafeFetchImplementation>(async (input) =>
      redirect(input.includes("a") ? "https://example.com/b" : "https://example.com/c"),
    );
    await expect(
      safeFetch("https://example.com/a", { fetchImpl, resolver, maxRedirects: 1 }),
    ).rejects.toMatchObject({ code: "TOO_MANY_REDIRECTS" });
  });

  it("rejects non-HTML responses", async () => {
    const fetchImpl = vi.fn<SafeFetchImplementation>(
      async () =>
        new Response('{"secret":true}', {
          status: 200,
          headers: { "content-type": "application/json" },
        }) as unknown as UndiciResponse,
    );
    await expect(
      safeFetch("https://example.com/api", { fetchImpl, resolver }),
    ).rejects.toMatchObject({
      code: "UNSUPPORTED_CONTENT_TYPE",
    });
  });

  it("respects maxBytes and supports explicit truncation", async () => {
    const fetchImpl = vi.fn<SafeFetchImplementation>(async () =>
      html("<html><body>0123456789</body></html>"),
    );
    await expect(
      safeFetch("https://example.com/", { fetchImpl, resolver, maxBytes: 8 }),
    ).rejects.toMatchObject({ code: "RESPONSE_TOO_LARGE" });

    const truncated = await safeFetch("https://example.com/", {
      fetchImpl,
      resolver,
      maxBytes: 8,
      truncate: true,
    });
    expect(truncated.truncated).toBe(true);
    expect(truncated.bodyBytes).toBe(8);
  });

  it("times out slow requests with a safe error", async () => {
    const fetchImpl = vi.fn<SafeFetchImplementation>(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          const signal = init.signal as AbortSignal;
          signal.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        }),
    );
    await expect(
      safeFetch("https://example.com/slow", { fetchImpl, resolver, timeoutMs: 25 }),
    ).rejects.toMatchObject({ code: "FETCH_TIMEOUT" });
  });

  it("honours an externally aborted scan", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn<SafeFetchImplementation>();
    await expect(
      safeFetch("https://example.com/", { fetchImpl, resolver, signal: controller.signal }),
    ).rejects.toMatchObject({ code: "SCAN_ABORTED" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
