import type { PageSnapshot } from "@vibetrace/shared-types";

const MAX_HTML_CHARS = 480_000;
const MAX_TEXT = 140;
const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);
const SKIP_TAGS = new Set([
  "script",
  "style",
  "noscript",
  "template",
  "iframe",
  "frame",
  "frameset",
  "object",
  "embed",
  "svg",
  "math",
  "canvas",
  "video",
  "audio",
  "link",
  "meta",
  "base",
  "title",
]);
const TEXT_TAGS = new Set([
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "a",
  "button",
  "label",
  "legend",
  "summary",
  "th",
  "caption",
]);
const DATA_ATTRIBUTE_ALLOW =
  /^data-(?:wf|react|next|nuxt|svelte|astro|v-|server|framework|builder|component|theme|framer|gsap|shopify|webflow|wix|elementor|drupal|wp|ai)/i;
const SEMANTIC_TAGS = [
  "article",
  "section",
  "nav",
  "main",
  "header",
  "footer",
  "aside",
  "dialog",
  "details",
  "figure",
  "search",
  "hgroup",
] as const;
const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [
    /(?:api[_-]?key|secret|token|password|passwd|authorization|bearer)\s*[:=]\s*["']?[A-Za-z0-9_\-./+=]{8,}["']?/gi,
    "[redacted-secret]",
  ],
  [/\bsk-[A-Za-z0-9_-]{16,}\b/g, "[redacted-key]"],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, "[redacted-token]"],
  [/\bAKIA[0-9A-Z]{16}\b/g, "[redacted-key]"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, "[redacted-jwt]"],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]"],
];

function scrub(value: string, max: number): string {
  let result = value;
  for (const [pattern, replacement] of SECRET_PATTERNS)
    result = result.replace(pattern, replacement);
  return result.replace(/\s+/g, " ").trim().slice(0, max);
}

function scrubCode(value: string, max: number): string {
  let result = value;
  for (const [pattern, replacement] of SECRET_PATTERNS)
    result = result.replace(pattern, replacement);
  return result.slice(0, max);
}

function sanitizeUrl(raw: string, allowSchemes = ["http:", "https:"]): string | null {
  if (!raw || raw.startsWith("data:") || raw.startsWith("blob:")) return null;
  try {
    const url = new URL(raw, document.baseURI);
    if (!allowSchemes.includes(url.protocol)) return null;
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString().slice(0, 2048);
  } catch {
    return null;
  }
}

function sanitizeHref(raw: string): string | null {
  if (!raw) return null;
  if (raw.startsWith("#")) return "#";
  return sanitizeUrl(raw, ["http:", "https:"]);
}

function allowedMetaKey(key: string): boolean {
  return (
    /^(description|generator|viewport|robots|theme-color|application-name|keywords|color-scheme|referrer|framework|build|next-head-count)$/i.test(
      key,
    ) ||
    /^(og|twitter|article|profile):[a-z0-9:_-]+$/i.test(key) ||
    /(?:framework|generator|builder|platform|cms)/i.test(key)
  );
}

function collectMeta(): Record<string, string> {
  const meta: Record<string, string> = {};
  for (const element of Array.from(document.querySelectorAll("meta"))) {
    const key = (
      element.getAttribute("name") ??
      element.getAttribute("property") ??
      element.getAttribute("http-equiv") ??
      ""
    )
      .trim()
      .toLowerCase();
    const content = element.getAttribute("content") ?? "";
    if (!key || !content || !allowedMetaKey(key)) continue;
    if (Object.keys(meta).length >= 80) break;
    meta[key] = scrub(content, 500);
  }
  return meta;
}

function collectSkeleton(): string {
  const body = document.body;
  if (!body) return "";
  const parts: string[] = [];
  let size = 0;

  const append = (value: string): boolean => {
    if (size + value.length > MAX_HTML_CHARS) return false;
    parts.push(value);
    size += value.length;
    return true;
  };

  const renderElement = (element: Element, depth: number): void => {
    if (depth > 90) return;
    const tag = element.tagName.toLowerCase();
    if (SKIP_TAGS.has(tag)) return;

    if (size >= MAX_HTML_CHARS) return;

    const attributes: string[] = [];
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on") || name === "style" || name === "srcdoc") continue;
      if (name === "value" || name === "checked" || name === "selected" || name === "placeholder") {
        continue;
      }
      if (name === "href") {
        const href = sanitizeHref(attribute.value);
        if (href) attributes.push(`href="${escapeAttribute(href)}"`);
        continue;
      }
      if (name === "src" || name === "poster" || name === "action" || name === "formaction") {
        if (tag === "img") {
          const src = sanitizeUrl(attribute.value);
          if (src) attributes.push(`src="${escapeAttribute(src)}"`);
        }
        continue;
      }
      if (name === "srcset") continue;
      if (name === "class") {
        attributes.push(`class="${escapeAttribute(scrub(attribute.value, 240))}"`);
        continue;
      }
      if (
        name === "id" ||
        name === "role" ||
        name === "alt" ||
        name === "for" ||
        name === "type" ||
        name === "lang" ||
        name === "width" ||
        name === "height" ||
        name === "loading" ||
        name === "target" ||
        name === "rel" ||
        name === "aria-label" ||
        name === "aria-labelledby" ||
        name === "aria-describedby" ||
        name === "aria-hidden" ||
        name === "aria-expanded" ||
        name === "aria-controls" ||
        name === "aria-current" ||
        name === "role" ||
        name === "contenteditable" ||
        name === "dir" ||
        name === "title"
      ) {
        attributes.push(`${name}="${escapeAttribute(scrub(attribute.value, 200))}"`);
        continue;
      }
      if (name.startsWith("aria-") || DATA_ATTRIBUTE_ALLOW.test(name)) {
        attributes.push(`${name}="${escapeAttribute(scrub(attribute.value, 160))}"`);
      }
    }

    const open = `<${tag}${attributes.length ? ` ${attributes.join(" ")}` : ""}>`;
    if (!append(open)) return;

    if (tag === "img") return;
    if (VOID_TAGS.has(tag)) return;

    if (TEXT_TAGS.has(tag)) {
      const text = scrub(element.textContent ?? "", MAX_TEXT);
      if (text) append(escapeText(text));
    } else if (tag === "input") {
      // No value, name or autocomplete payload is copied.
    }

    for (const child of Array.from(element.children)) {
      if (size >= MAX_HTML_CHARS) break;
      renderElement(child, depth + 1);
    }
    append(`</${tag}>`);
  };

  for (const child of Array.from(body.children)) renderElement(child, 0);
  return parts.join("");
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function collectDomFacts(): PageSnapshot["dom"] {
  const elements = Array.from(document.getElementsByTagName("*"));
  const allIds = elements.map((element) => element.id).filter((id) => id.length > 0);
  const seen = new Set<string>();
  let duplicateIds = 0;
  for (const id of allIds) {
    if (seen.has(id)) duplicateIds += 1;
    else seen.add(id);
  }

  const maxDepth = (() => {
    let max = 0;
    const stack: Array<{ element: Element; depth: number }> = [
      { element: document.documentElement, depth: 0 },
    ];
    while (stack.length) {
      const item = stack.pop()!;
      max = Math.max(max, item.depth);
      for (const child of Array.from(item.element.children)) {
        stack.push({ element: child, depth: item.depth + 1 });
      }
    }
    return max;
  })();

  const headingLevels = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6"))
    .slice(0, 200)
    .map((element) => Number(element.tagName.slice(1)));

  const images = Array.from(document.querySelectorAll("img"));
  const imageSources = images
    .map((image) => sanitizeUrl(image.currentSrc || image.getAttribute("src") || ""))
    .filter((src): src is string => Boolean(src))
    .slice(0, 250);

  const controls = Array.from(
    document.querySelectorAll<HTMLElement>("input:not([type=hidden]), select, textarea"),
  );
  const labeledInputs = controls.filter((control) => {
    if (control.getAttribute("aria-label") || control.getAttribute("aria-labelledby")) return true;
    if (control.id && document.querySelector(`label[for="${cssEscape(control.id)}"]`)) return true;
    return Boolean(control.closest("label"));
  });

  const buttons = Array.from(document.querySelectorAll<HTMLElement>("button"));
  const unnamedButtons = buttons.filter((button) => {
    if (button.getAttribute("aria-label") || button.getAttribute("aria-labelledby")) return false;
    if (button.getAttribute("title")) return false;
    return !(button.textContent ?? "").trim();
  });

  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"));
  const unnamedLinks = links.filter((link) => {
    if (link.getAttribute("aria-label") || link.getAttribute("aria-labelledby")) return false;
    if (link.getAttribute("title")) return false;
    if ((link.textContent ?? "").trim()) return false;
    return !Array.from(link.querySelectorAll("img[alt]")).some((img) =>
      Boolean(img.getAttribute("alt")?.trim()),
    );
  });

  const classSamples = new Set<string>();
  for (const element of elements) {
    const value = element.getAttribute("class");
    if (value) classSamples.add(value.slice(0, 300));
    if (classSamples.size >= 100) break;
  }

  const semanticElements = SEMANTIC_TAGS.filter((tag) => document.querySelector(tag) !== null);

  const comments: string[] = [];
  const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_COMMENT);
  const marker =
    /(generated|generator|framework|next|nuxt|astro|wordpress|wp-content|shopify|webflow|wix|squarespace|framer|ai|v0|lovable|bolt|cursor|replit|built)/i;
  while (walker.nextNode() && comments.length < 30) {
    const value = (walker.currentNode.nodeValue ?? "").trim();
    if (value && marker.test(value)) comments.push(scrub(value, 500));
  }

  const inlineScriptSamples: string[] = [];
  const scriptMarker =
    /(__NEXT_DATA__|__NUXT__|webpack|vite|react|vue|svelte|astro|tailwind|shadcn|framer|webflow|wix|shopify|dataLayer|gtag|generated|generator|cursor|lovable|bolt|v0|replit|claude|chatgpt|copilot|openai|anthropic|builder|ai[-_ ]?generated)/i;
  for (const script of Array.from(document.querySelectorAll("script:not([src])"))) {
    if (inlineScriptSamples.length >= 20) break;
    const text = script.textContent ?? "";
    if (!text.trim()) continue;
    const match = scriptMarker.exec(text);
    if (!match) continue;
    const start = Math.max(0, match.index - 240);
    inlineScriptSamples.push(scrubCode(text.slice(start, start + 1_200), 1_500));
  }

  const jsonLdSamples = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    .slice(0, 10)
    .map((script) => scrubCode(script.textContent ?? "", 3_000))
    .filter(Boolean);

  return {
    nodeCount: elements.length + 1,
    maxDepth,
    headingLevels,
    imageCount: images.length,
    imagesWithAlt: images.filter((image) => image.hasAttribute("alt")).length,
    imageSources,
    inputCount: controls.length,
    labeledInputCount: labeledInputs.length,
    buttonCount: buttons.length,
    unnamedButtonCount: unnamedButtons.length,
    linkCount: links.length,
    unnamedLinkCount: unnamedLinks.length,
    duplicateIds,
    inlineStyleCount: document.querySelectorAll("[style]").length,
    inlineScriptCount: document.querySelectorAll("script:not([src])").length,
    semanticElements,
    classSignatureSamples: Array.from(classSamples),
    inlineScriptSamples,
    htmlComments: comments,
    jsonLdSamples,
  };
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
  return value.replace(/["\\]/g, "\\$&");
}

function collectTiming(): PageSnapshot["timing"] {
  const navigation = performance.getEntriesByType("navigation")[0] as
    PerformanceNavigationTiming | undefined;
  const paints = performance.getEntriesByType("paint") as PerformanceEntry[];
  const fcp = paints.find((entry) => entry.name === "first-contentful-paint");
  const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  const origin = location.origin;
  const thirdParty = new Set<string>();
  let scriptBytes = 0;
  let styleBytes = 0;
  let imageBytes = 0;

  for (const resource of resources) {
    if (resource.initiatorType === "script") scriptBytes += resource.transferSize || 0;
    if (resource.initiatorType === "link" || resource.initiatorType === "css") {
      styleBytes += resource.transferSize || 0;
    }
    if (resource.initiatorType === "img") imageBytes += resource.transferSize || 0;
    try {
      const url = new URL(resource.name);
      if (url.origin !== origin && (url.protocol === "http:" || url.protocol === "https:")) {
        thirdParty.add(url.origin);
      }
    } catch {
      // Ignore malformed or data: resource names.
    }
  }

  const timing: NonNullable<PageSnapshot["timing"]> = {
    resourceCount: resources.length,
    thirdPartyOrigins: Array.from(thirdParty).slice(0, 50),
  };
  if (navigation) {
    if (navigation.responseStart > 0) timing.ttfbMs = Math.max(0, navigation.responseStart);
    if (navigation.domContentLoadedEventEnd > 0) {
      timing.domContentLoadedMs = Math.max(0, navigation.domContentLoadedEventEnd);
    }
    if (navigation.loadEventEnd > 0) timing.loadMs = Math.max(0, navigation.loadEventEnd);
    if (navigation.transferSize > 0) timing.transferSize = navigation.transferSize;
    if (navigation.decodedBodySize > 0) timing.decodedBodySize = navigation.decodedBodySize;
  }
  if (fcp) timing.firstContentfulPaintMs = Math.max(0, fcp.startTime);
  if (scriptBytes > 0) timing.scriptBytes = scriptBytes;
  if (styleBytes > 0) timing.styleBytes = styleBytes;
  if (imageBytes > 0) timing.imageBytes = imageBytes;
  return timing;
}

/**
 * Read-only, privacy-bounded snapshot of the active page. It never reads
 * form values, passwords, cookies, storage, history or keystrokes, and it
 * does not modify the page. The skeleton strips unrelated text, styles,
 * scripts and all event handlers.
 */
export function collectPageSnapshot(): PageSnapshot {
  if (!/^https?:$/.test(location.protocol)) {
    throw new Error("Only HTTP and HTTPS pages can be analyzed.");
  }
  const scriptSources = Array.from(document.querySelectorAll("script[src]"))
    .map((script) => sanitizeUrl(script.getAttribute("src") ?? ""))
    .filter((src): src is string => Boolean(src))
    .slice(0, 300);
  const stylesheetHrefs = Array.from(document.querySelectorAll('link[rel~="stylesheet"][href]'))
    .map((link) => sanitizeUrl(link.getAttribute("href") ?? ""))
    .filter((href): href is string => Boolean(href))
    .slice(0, 150);

  return {
    url: sanitizeUrl(location.href) ?? location.origin,
    title: scrub(document.title, 500),
    lang: (document.documentElement.lang || "").slice(0, 40),
    meta: collectMeta(),
    html: collectSkeleton(),
    scriptSources,
    stylesheetHrefs,
    dom: collectDomFacts(),
    timing: collectTiming(),
    capturedAt: new Date().toISOString(),
  };
}
