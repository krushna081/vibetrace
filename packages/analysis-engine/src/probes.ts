import type { SafeFetchImplementation } from "./fetch/safe-fetch.js";
import { safeFetch } from "./fetch/safe-fetch.js";
import type { HostResolver } from "./fetch/url-guard.js";
import type { DocumentFacts } from "./document.js";
import type { AssetProbe, ProbeSummary, SeoProbe } from "./types.js";

const JS_TYPES = [
  "application/javascript",
  "text/javascript",
  "application/x-javascript",
  "application/ecmascript",
  "text/plain",
  "application/json",
];
const CSS_TYPES = ["text/css", "text/plain"];
const MAP_TYPES = ["application/json", "text/plain", "application/octet-stream"];
const TEXT_TYPES = ["text/plain", "text/html", "application/xml", "text/xml"];

export interface ProbeOptions {
  resolver?: HostResolver;
  fetchImpl?: SafeFetchImplementation;
  allowedPorts?: number[];
  maxAssetProbes?: number;
  assetMaxBytes?: number;
  signal?: AbortSignal;
}

function sameOrigin(candidate: string, originUrl: string): boolean {
  try {
    const a = new URL(candidate);
    const b = new URL(originUrl);
    return a.origin === b.origin;
  } catch {
    return false;
  }
}

function withoutQuery(value: string): string {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return value.slice(0, 500);
  }
}

function errorLabel(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code: unknown }).code);
  }
  return error instanceof Error ? error.name : "UNKNOWN";
}

function extractMapUrls(text: string, chunk: string): string[] {
  const output = new Set<string>();
  const pattern =
    chunk === "js"
      ? /\/\/[#@]\s*sourceMappingURL=(\S+)/g
      : /\/\*[#@]\s*sourceMappingURL=(\S+?)\s*\*\//g;
  for (const match of text.matchAll(pattern)) {
    if (match[1]) output.add(match[1].slice(0, 2048));
  }
  return [...output];
}

function selectAssets(facts: DocumentFacts, finalUrl: string, limit: number) {
  const scripts = [
    ...new Set(
      facts.scriptFacts
        .map((script) => script.src)
        .filter(
          (src): src is string =>
            typeof src === "string" && src.length > 0 && sameOrigin(src, finalUrl),
        ),
    ),
  ];
  const styles = [
    ...new Set(
      facts.stylesheets
        .map((sheet) => sheet.href)
        .filter((href) => Boolean(href) && sameOrigin(href, finalUrl)),
    ),
  ];

  const selected: { url: string; kind: "script" | "stylesheet" }[] = [];
  for (let index = 0; index < Math.max(scripts.length, styles.length); index += 1) {
    if (scripts[index] && selected.length < limit) {
      selected.push({ url: scripts[index]!, kind: "script" });
    }
    if (styles[index] && selected.length < limit) {
      selected.push({ url: styles[index]!, kind: "stylesheet" });
    }
    if (selected.length >= limit) break;
  }
  return selected;
}

async function probeAsset(
  asset: { url: string; kind: "script" | "stylesheet" },
  options: ProbeOptions,
): Promise<AssetProbe> {
  try {
    const result = await safeFetch(asset.url, {
      maxBytes: options.assetMaxBytes ?? 400_000,
      timeoutMs: 4_000,
      maxRedirects: 2,
      allowedPorts: options.allowedPorts,
      resolver: options.resolver,
      fetchImpl: options.fetchImpl,
      allowedContentTypes: asset.kind === "script" ? JS_TYPES : CSS_TYPES,
      truncate: true,
      signal: options.signal,
    });
    const sourceMapUrls = extractMapUrls(result.text, asset.kind === "script" ? "js" : "css").map(
      (url) => {
        try {
          return new URL(url, asset.url).toString();
        } catch {
          return url;
        }
      },
    );
    return {
      url: withoutQuery(asset.url),
      kind: asset.kind,
      status: result.status,
      bytes: result.bodyBytes,
      encodedBytes: result.headers["content-length"]
        ? Number(result.headers["content-length"]) || result.bodyBytes
        : result.bodyBytes,
      compressed: Boolean(result.headers["content-encoding"]),
      cacheControl: result.headers["cache-control"] ?? null,
      sourceMapUrls,
      error: null,
      measured: true,
    };
  } catch (error) {
    return {
      url: withoutQuery(asset.url),
      kind: asset.kind,
      status: null,
      bytes: null,
      encodedBytes: null,
      compressed: null,
      cacheControl: null,
      sourceMapUrls: [],
      error: errorLabel(error),
      measured: false,
    };
  }
}

async function verifySourceMap(mapUrl: string, options: ProbeOptions): Promise<string | null> {
  try {
    const result = await safeFetch(mapUrl, {
      maxBytes: 40_000,
      timeoutMs: 3_000,
      maxRedirects: 1,
      allowedPorts: options.allowedPorts,
      resolver: options.resolver,
      fetchImpl: options.fetchImpl,
      allowedContentTypes: MAP_TYPES,
      truncate: true,
      signal: options.signal,
    });
    const looksJson = /^\s*[\])}'{]/.test(result.text);
    return result.status >= 200 && result.status < 300 && looksJson
      ? `verified:${withoutQuery(mapUrl)}`
      : `declared:${withoutQuery(mapUrl)}`;
  } catch {
    return null;
  }
}

async function probeSeo(finalUrl: string, options: ProbeOptions): Promise<SeoProbe> {
  const origin = new URL(finalUrl).origin;
  const robotsUrl = `${origin}/robots.txt`;
  const errors: string[] = [];
  let robotsStatus: number | null = null;
  let robotsText = "";
  try {
    const result = await safeFetch(robotsUrl, {
      maxBytes: 64_000,
      timeoutMs: 3_000,
      maxRedirects: 2,
      allowedPorts: options.allowedPorts,
      resolver: options.resolver,
      fetchImpl: options.fetchImpl,
      allowedContentTypes: TEXT_TYPES,
      truncate: true,
      signal: options.signal,
    });
    robotsStatus = result.status;
    robotsText = result.text;
  } catch (error) {
    errors.push(`robots.txt: ${errorLabel(error)}`);
  }

  const robotsAccessible = robotsStatus !== null && robotsStatus >= 200 && robotsStatus < 300;
  const declaredSitemaps = [...robotsText.matchAll(/^\s*sitemap:\s*(\S+)\s*$/gim)]
    .map((match) => match[1])
    .filter((value): value is string => Boolean(value))
    .slice(0, 3);
  const disallowAll =
    /^\s*disallow:\s*\/\s*$/im.test(robotsText) && !/^\s*allow:\s*\//im.test(robotsText);
  const sitemapUrl = declaredSitemaps[0] ?? `${origin}/sitemap.xml`;

  let sitemapStatus: number | null = null;
  try {
    const result = await safeFetch(sitemapUrl, {
      maxBytes: 128_000,
      timeoutMs: 3_000,
      maxRedirects: 2,
      allowedPorts: options.allowedPorts,
      resolver: options.resolver,
      fetchImpl: options.fetchImpl,
      allowedContentTypes: TEXT_TYPES,
      truncate: true,
      signal: options.signal,
    });
    sitemapStatus = result.status;
  } catch (error) {
    errors.push(`sitemap: ${errorLabel(error)}`);
  }

  return {
    robotsUrl: withoutQuery(robotsUrl),
    robotsStatus,
    robotsAccessible,
    sitemapUrl: withoutQuery(sitemapUrl),
    sitemapStatus,
    sitemapAccessible: sitemapStatus !== null && sitemapStatus >= 200 && sitemapStatus < 300,
    disallowAll,
    errors,
  };
}

export async function collectPageEvidence(
  facts: DocumentFacts,
  finalUrl: string,
  options: ProbeOptions,
): Promise<ProbeSummary> {
  const maxAssets = Math.min(8, Math.max(0, options.maxAssetProbes ?? 4));
  const selected = selectAssets(facts, finalUrl, maxAssets);

  const [assetSettled, seo] = await Promise.all([
    Promise.allSettled(selected.map((asset) => probeAsset(asset, options))),
    probeSeo(finalUrl, options).catch((error) => {
      const empty: SeoProbe = {
        robotsUrl: `${new URL(finalUrl).origin}/robots.txt`,
        robotsStatus: null,
        robotsAccessible: false,
        sitemapUrl: `${new URL(finalUrl).origin}/sitemap.xml`,
        sitemapStatus: null,
        sitemapAccessible: false,
        disallowAll: false,
        errors: [errorLabel(error)],
      };
      return empty;
    }),
  ]);

  const assets = assetSettled
    .map((result) => (result.status === "fulfilled" ? result.value : null))
    .filter((value): value is AssetProbe => Boolean(value));

  const declaredMaps = new Set<string>();
  for (const mapUrl of facts.sourceMapDeclarations) {
    try {
      declaredMaps.add(new URL(mapUrl, finalUrl).toString());
    } catch {
      // Ignore malformed declarations.
    }
  }
  for (const asset of assets) {
    for (const mapUrl of asset.sourceMapUrls) declaredMaps.add(mapUrl);
  }

  const verifiedMaps: string[] = [];
  const toVerify = [...declaredMaps].slice(0, 2);
  const mapResults = await Promise.allSettled(
    toVerify.map((mapUrl) => verifySourceMap(mapUrl, options)),
  );
  for (const result of mapResults) {
    if (result.status === "fulfilled" && result.value) verifiedMaps.push(result.value);
  }
  for (const mapUrl of declaredMaps) {
    if (!toVerify.includes(mapUrl)) verifiedMaps.push(`declared:${withoutQuery(mapUrl)}`);
  }

  const failedAssets = assets.filter((asset) => !asset.measured).length;
  const errors: string[] = [...seo.errors];
  if (failedAssets > 0) errors.push(`${failedAssets} asset probe(s) failed`);

  return {
    assets,
    sourceMaps: [...new Set(verifiedMaps)].slice(0, 10),
    seo,
    errors,
  };
}
