import { parse, type HTMLElement, type Node } from "node-html-parser";

export interface ScriptFact {
  src: string | null;
  inline: string;
  type: string;
  async: boolean;
  defer: boolean;
  inHead: boolean;
}

export interface StylesheetFact {
  href: string;
  media: string;
}

export interface ImageFact {
  src: string;
  altPresent: boolean;
  alt: string | null;
  loading: string | null;
  width: string | null;
  height: string | null;
}

export interface HeadingFact {
  level: number;
  text: string;
}

export interface InputFact {
  tag: string;
  type: string;
  id: string;
  name: string;
  hasLabel: boolean;
  ariaLabel: string;
  placeholder: string;
}

export interface ButtonFact {
  text: string;
  ariaLabel: string;
  title: string;
  hasAccessibleName: boolean;
}

export interface LinkFact {
  href: string;
  text: string;
  ariaLabel: string;
  rel: string;
  target: string;
  hasAccessibleName: boolean;
}

export interface FormFact {
  action: string;
  method: string;
  inputCount: number;
}

export interface DocumentFacts {
  rawHtml: string;
  root: HTMLElement;
  title: string;
  titleTagPresent: boolean;
  lang: string;
  dir: string;
  meta: Record<string, string>;
  generator: string | null;
  description: string | null;
  canonical: string | null;
  robots: string | null;
  viewport: string | null;
  charset: string | null;
  og: Record<string, string>;
  scriptFacts: ScriptFact[];
  stylesheets: StylesheetFact[];
  inlineStyles: string[];
  inlineStyleAttributes: number;
  inlineEventHandlers: number;
  images: ImageFact[];
  headings: HeadingFact[];
  inputs: InputFact[];
  buttons: ButtonFact[];
  links: LinkFact[];
  forms: FormFact[];
  jsonLd: string[];
  comments: string[];
  duplicateIds: number;
  idCount: number;
  nodeCount: number;
  maxDepth: number;
  tagHistogram: Record<string, number>;
  semanticElements: string[];
  repeatedStructures: { signature: string; count: number }[];
  classTokens: string[];
  classAttributes: string[];
  inlineScriptBytes: number;
  externalDomains: string[];
  tabindexPositive: number;
  targetBlankUnsafe: number;
  formsWithoutAction: number;
  hasDoctype: boolean;
  doctypeLegacy: boolean;
  responsiveMeta: boolean;
  htmlComments: number;
  sourceMapDeclarations: string[];
  inlineScriptSamples: string[];
}

function clean(value: unknown, max = 500): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function attrs(element: HTMLElement): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(element.attributes ?? {})) {
    result[key.toLowerCase()] = typeof value === "string" ? value : "";
  }
  return result;
}

function classListOf(element: HTMLElement): string[] {
  return (element.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
}

function inHead(element: HTMLElement): boolean {
  let current: Node | null = element;
  while (current) {
    const tag = (current as HTMLElement).tagName;
    if (tag === "head") return true;
    current = current.parentNode as Node | null;
  }
  return false;
}

function resolveAgainst(base: URL, raw: string): string {
  if (!raw) return "";
  try {
    return new URL(raw, base).toString();
  } catch {
    return raw;
  }
}

function hostOf(raw: string, base: URL): string | null {
  try {
    return new URL(raw, base).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Parse untrusted HTML into a bounded, normalized fact model. Raw script and
 * style content stays inside the engine; it is never copied into reports.
 */
export function extractDocumentFacts(html: string, baseUrl: string): DocumentFacts {
  const root = parse(html, {
    lowerCaseTagName: true,
    comment: false,
    blockTextElements: { script: true, style: true, pre: true, textarea: true },
  });
  const base = new URL(baseUrl);
  const meta: Record<string, string> = {};
  const og: Record<string, string> = {};

  for (const element of root.querySelectorAll("meta")) {
    const a = attrs(element);
    const name = (a.name ?? a.property ?? a.itemprop ?? a["http-equiv"] ?? "").toLowerCase();
    const content = a.content ?? "";
    if (!name) continue;
    if (name.startsWith("og:")) og[name] = content.slice(0, 1000);
    meta[name] = content.slice(0, 2000);
  }

  const titleElement = root.querySelector("title");
  const title = clean(titleElement?.text ?? og["og:title"] ?? "", 500);
  const lang =
    clean(root.querySelector("html")?.getAttribute("lang") ?? "", 40) ||
    clean(meta["content-language"] ?? "", 40);

  const scriptFacts: ScriptFact[] = [];
  const inlineStyles: string[] = [];
  const stylesheets: StylesheetFact[] = [];
  const jsonLd: string[] = [];
  const sourceMaps = new Set<string>();
  const scriptInlineSamples: string[] = [];

  for (const element of root.querySelectorAll("script")) {
    const a = attrs(element);
    const inline = element.text ?? "";
    const type = (a.type ?? "").toLowerCase();
    if (type === "application/ld+json") {
      if (jsonLd.length < 10) jsonLd.push(inline.slice(0, 4000));
      continue;
    }
    if (inline) {
      for (const match of inline.matchAll(/\/\/[#@]\s*sourceMappingURL=(\S+)/g)) {
        if (match[1]) sourceMaps.add(match[1].slice(0, 500));
      }
    }
    if (inline && scriptInlineSamples.length < 30 && scriptInlineSamples.join("").length < 20_000) {
      scriptInlineSamples.push(inline.slice(0, 2000));
    }
    scriptFacts.push({
      src: a.src ? resolveAgainst(base, a.src) : null,
      inline,
      type,
      async: "async" in a,
      defer: "defer" in a,
      inHead: inHead(element),
    });
  }

  for (const element of root.querySelectorAll("style")) {
    const css = element.text ?? "";
    inlineStyles.push(css);
    for (const match of css.matchAll(/\/\*[#@]\s*sourceMappingURL=(\S+?)\s*\*\//g)) {
      if (match[1]) sourceMaps.add(match[1].slice(0, 500));
    }
  }

  for (const element of root.querySelectorAll("link")) {
    const a = attrs(element);
    const rel = (a.rel ?? "").toLowerCase().split(/\s+/);
    if (rel.includes("stylesheet") && a.href) {
      stylesheets.push({
        href: resolveAgainst(base, a.href),
        media: clean(a.media ?? "", 100),
      });
    }
  }

  const ids: string[] = [];
  const classTokens: string[] = [];
  const classAttributes: string[] = [];
  const tagHistogram: Record<string, number> = {};
  const structureCounts = new Map<string, number>();
  const semantic = new Set<string>();
  let inlineStyleAttributes = 0;
  let inlineEventHandlers = 0;
  let tabindexPositive = 0;
  let nodeCount = 0;
  let maxDepth = 0;

  const walk = (node: Node, depth: number) => {
    nodeCount += 1;
    if (depth > maxDepth) maxDepth = depth;
    if (depth > 200 || nodeCount > 60_000) return;
    const element = node as HTMLElement;
    if (element.tagName) {
      const tag = element.tagName.toLowerCase();
      tagHistogram[tag] = (tagHistogram[tag] ?? 0) + 1;
      if (
        ["header", "nav", "main", "footer", "article", "section", "aside", "form"].includes(tag)
      ) {
        semantic.add(tag);
      }
      const a = attrs(element);
      if (a.id) ids.push(a.id);
      if (a.style) inlineStyleAttributes += 1;
      for (const key of Object.keys(a)) {
        if (/^on[a-z]+$/.test(key)) inlineEventHandlers += 1;
      }
      if (Number(a.tabindex) > 0) tabindexPositive += 1;
      const classes = classListOf(element);
      if (classes.length) {
        classTokens.push(...classes.slice(0, 30));
        classAttributes.push(classes.slice(0, 30).join(" ").slice(0, 300));
        const useful = classes
          .filter((token) => token.length <= 80)
          .slice(0, 4)
          .join(".");
        const signature = `${tag}${useful ? `.${useful}` : ""}`.slice(0, 300);
        if (tag !== "html" && tag !== "body") {
          structureCounts.set(signature, (structureCounts.get(signature) ?? 0) + 1);
        }
      }
    }
    for (const child of node.childNodes ?? []) walk(child, depth + 1);
  };
  walk(root, 0);

  const idFrequency = new Map<string, number>();
  for (const id of ids) idFrequency.set(id, (idFrequency.get(id) ?? 0) + 1);
  const duplicateIds = [...idFrequency.values()].filter((count) => count > 1).length;

  const repeatedStructures = [...structureCounts.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([signature, count]) => ({ signature, count }));

  const images: ImageFact[] = root.querySelectorAll("img").map((element) => {
    const a = attrs(element);
    const src = a.src ?? a["data-src"] ?? a.srcset?.split(",")[0]?.trim().split(/\s+/)[0] ?? "";
    return {
      src: src ? resolveAgainst(base, src) : "",
      altPresent: a.alt !== undefined,
      alt: a.alt !== undefined ? clean(a.alt, 300) : null,
      loading: a.loading ? clean(a.loading, 20) : null,
      width: a.width ? clean(a.width, 20) : null,
      height: a.height ? clean(a.height, 20) : null,
    };
  });

  const headings: HeadingFact[] = [];
  for (const element of root.querySelectorAll("h1, h2, h3, h4, h5, h6")) {
    const level = Number(element.tagName.toLowerCase().replace("h", "")) || 0;
    if (level >= 1 && level <= 6) {
      headings.push({ level, text: clean(element.text, 180) });
    }
  }

  const labelFors = new Set(
    root
      .querySelectorAll("label[for]")
      .map((element) => element.getAttribute("for") ?? "")
      .filter(Boolean),
  );
  const inputs: InputFact[] = [];
  for (const element of root.querySelectorAll("input, select, textarea")) {
    const a = attrs(element);
    const type = (
      a.type ?? (element.tagName.toLowerCase() === "input" ? "text" : "")
    ).toLowerCase();
    if (type === "hidden") continue;
    const id = a.id ?? "";
    const labelledBy = (a["aria-labelledby"] ?? "").split(/\s+/).filter(Boolean);
    const hasLabel =
      Boolean(a["aria-label"]?.trim()) ||
      (labelledBy.length > 0 && labelledBy.every((idPart) => ids.includes(idPart))) ||
      (id !== "" && labelFors.has(id)) ||
      Boolean(element.closest("label"));
    inputs.push({
      tag: element.tagName.toLowerCase(),
      type,
      id,
      name: a.name ?? "",
      hasLabel,
      ariaLabel: clean(a["aria-label"] ?? "", 200),
      placeholder: clean(a.placeholder ?? "", 200),
    });
  }

  const buttons: ButtonFact[] = [];
  for (const element of root.querySelectorAll(
    "button, [role=button], input[type=button], input[type=submit]",
  )) {
    const a = attrs(element);
    const text = clean(element.text || a.value || "", 240);
    const ariaLabel = clean(a["aria-label"] ?? "", 200);
    const title = clean(a.title ?? "", 200);
    const imgAlt = climbName(element);
    buttons.push({
      text,
      ariaLabel,
      title,
      hasAccessibleName: Boolean(text || ariaLabel || title || imgAlt),
    });
  }

  const links: LinkFact[] = [];
  let targetBlankUnsafe = 0;
  for (const element of root.querySelectorAll("a[href]")) {
    const a = attrs(element);
    const text = clean(element.text, 240);
    const ariaLabel = clean(a["aria-label"] ?? "", 200);
    const imgAlt = climbName(element);
    const rel = (a.rel ?? "").toLowerCase();
    const target = (a.target ?? "").toLowerCase();
    if (
      target === "_blank" &&
      !rel.split(/\s+/).includes("noopener") &&
      !rel.split(/\s+/).includes("noreferrer")
    ) {
      targetBlankUnsafe += 1;
    }
    links.push({
      href: resolveAgainst(base, a.href ?? ""),
      text,
      ariaLabel,
      rel,
      target,
      hasAccessibleName: Boolean(text || ariaLabel || imgAlt),
    });
  }

  const forms: FormFact[] = root.querySelectorAll("form").map((element) => {
    const a = attrs(element);
    return {
      action: a.action ? resolveAgainst(base, a.action) : "",
      method: (a.method ?? "get").toLowerCase(),
      inputCount: element.querySelectorAll("input, select, textarea, button").length,
    };
  });

  const comments = [...html.matchAll(/<!--([\s\S]*?)-->/g)]
    .map((match) => clean(match[1], 400))
    .filter((value) => value.length > 0)
    .slice(0, 40);

  const externalHosts = new Set<string>();
  const resourceUrls = [
    ...scriptFacts.map((script) => script.src),
    ...stylesheets.map((sheet) => sheet.href),
    ...images.map((image) => image.src),
  ].filter((value): value is string => Boolean(value));
  for (const resource of resourceUrls) {
    const host = hostOf(resource, base);
    if (host && host !== base.hostname) externalHosts.add(host);
  }

  const doctypeMatch = /^\s*<!doctype\s+([^>]+)>/i.exec(html);
  const hasDoctype = Boolean(doctypeMatch);
  const doctypeLegacy = Boolean(
    doctypeMatch && !/^html(\s|$)/i.test(doctypeMatch[1]?.trim() ?? ""),
  );
  const viewport = meta.viewport ?? null;
  const responsiveMeta = Boolean(viewport && /width\s*=\s*device-width/i.test(viewport));
  const inlineScriptBytes = scriptFacts.reduce(
    (sum, script) => sum + Buffer.byteLength(script.inline, "utf8"),
    0,
  );

  const charsetElement = root.querySelector("meta[charset]");
  const charsetMeta = charsetElement ? attrs(charsetElement).charset : null;

  return {
    rawHtml: html,
    root,
    title,
    titleTagPresent: Boolean(titleElement),
    lang,
    dir: clean(root.querySelector("html")?.getAttribute("dir") ?? "", 10),
    meta,
    generator: meta.generator ? clean(meta.generator, 300) : null,
    description: meta.description ? clean(meta.description, 1000) : null,
    canonical: meta.canonical ?? attrsOrNull(root.querySelector("link[rel=canonical]"), "href"),
    robots: meta.robots ? clean(meta.robots, 300) : null,
    viewport,
    charset: charsetMeta ?? meta["content-type"] ?? null,
    og,
    scriptFacts,
    stylesheets,
    inlineStyles,
    inlineStyleAttributes,
    inlineEventHandlers,
    images,
    headings,
    inputs,
    buttons,
    links,
    forms,
    jsonLd,
    comments,
    duplicateIds,
    idCount: ids.length,
    nodeCount,
    maxDepth,
    tagHistogram,
    semanticElements: [...semantic],
    repeatedStructures,
    classTokens,
    classAttributes,
    inlineScriptBytes,
    externalDomains: [...externalHosts].sort(),
    tabindexPositive,
    targetBlankUnsafe,
    formsWithoutAction: forms.filter((form) => !form.action).length,
    hasDoctype,
    doctypeLegacy,
    responsiveMeta,
    htmlComments: comments.length,
    sourceMapDeclarations: [...sourceMaps],
    inlineScriptSamples: scriptInlineSamples,
  };
}

function attrsOrNull(element: HTMLElement | null, name: string): string | null {
  if (!element) return null;
  const value = element.getAttribute(name);
  return value ? clean(value, 1000) : null;
}

function climbName(element: HTMLElement): string {
  const images = element.querySelectorAll("img[alt]");
  for (const image of images) {
    const alt = clean(image.getAttribute("alt") ?? "", 200);
    if (alt) return alt;
  }
  const labelled = element.querySelectorAll("[aria-label]");
  for (const item of labelled) {
    const label = clean(item.getAttribute("aria-label") ?? "", 200);
    if (label) return label;
  }
  return "";
}

export function absoluteHost(value: string, baseUrl: string): string | null {
  try {
    return new URL(value, baseUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}
