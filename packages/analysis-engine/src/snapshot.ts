import type { PageSnapshot } from "@vibetrace/shared-types";
import { parse } from "node-html-parser";
import type { DocumentFacts } from "./document.js";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Defense in depth. The content script already strips active content, but an
 * API payload must never be trusted to be inert. Remove executable elements,
 * event handlers and script-bearing URL schemes before analysis.
 */
function sanitizeBodyHtml(raw: string): string {
  if (!raw.trim()) return "";
  const root = parse(`<body>${raw}</body>`, { comment: false });
  for (const element of root.querySelectorAll(
    "script,iframe,frame,frameset,object,embed,applet,style,link,meta,base,svg,math",
  )) {
    element.remove();
  }
  for (const element of root.querySelectorAll("*")) {
    for (const name of Object.keys(element.attributes)) {
      const lower = name.toLowerCase();
      if (/^on/i.test(lower) || lower === "srcdoc" || lower === "style") {
        element.removeAttribute(name);
        continue;
      }
      if (lower === "srcset") {
        element.removeAttribute(name);
        continue;
      }
      if (
        lower === "href" ||
        lower === "src" ||
        lower === "action" ||
        lower === "formaction" ||
        lower === "poster" ||
        lower === "background" ||
        lower === "xlink:href"
      ) {
        const value = (element.getAttribute(name) ?? "").trim();
        if (/^(?:javascript|vbscript|data):/i.test(value)) element.removeAttribute(name);
      }
    }
  }
  return root.querySelector("body")?.innerHTML ?? "";
}

/**
 * Rebuild a parseable document from a privacy-preserving extension snapshot.
 * The body HTML is already sanitized by the content script: form values,
 * textarea contents, cookies, storage and unrelated page text are removed.
 * This function applies a second sanitizer because it processes remote input.
 */
export function buildSnapshotHtml(snapshot: PageSnapshot): string {
  const metas = Object.entries(snapshot.meta)
    .slice(0, 80)
    .map(([name, content]) => `<meta name="${escapeHtml(name)}" content="${escapeHtml(content)}">`)
    .join("\n");
  const scripts = snapshot.scriptSources
    .filter(Boolean)
    .slice(0, 120)
    .map((src) => `<script src="${escapeHtml(src)}"></script>`)
    .join("\n");
  const styles = snapshot.stylesheetHrefs
    .filter(Boolean)
    .slice(0, 80)
    .map((href) => `<link rel="stylesheet" href="${escapeHtml(href)}">`)
    .join("\n");

  return [
    "<!doctype html>",
    `<html lang="${escapeHtml(snapshot.lang)}">`,
    "<head>",
    `<meta charset="utf-8">`,
    `<title>${escapeHtml(snapshot.title)}</title>`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    metas,
    scripts,
    styles,
    "</head>",
    `<body>${sanitizeBodyHtml(snapshot.html)}</body>`,
    "</html>",
  ].join("\n");
}

/**
 * Overlay facts that exist only in the live browser DOM (sanitized counts,
 * timing and samples). The same analyzers and scoring engine consume these.
 */
export function mergeSnapshotFacts(facts: DocumentFacts, snapshot: PageSnapshot): void {
  facts.title = snapshot.title || facts.title;
  facts.lang = snapshot.lang || facts.lang;
  facts.meta = { ...facts.meta, ...snapshot.meta };
  facts.generator = snapshot.meta.generator ?? facts.generator;
  facts.description = snapshot.meta.description ?? facts.description;
  facts.canonical = snapshot.meta.canonical ?? facts.canonical;
  facts.robots = snapshot.meta.robots ?? facts.robots;
  facts.viewport = snapshot.meta.viewport ?? facts.viewport;

  facts.scriptFacts = [
    ...facts.scriptFacts,
    ...snapshot.scriptSources
      .filter((src) => !facts.scriptFacts.some((script) => script.src === src))
      .map((src) => ({
        src,
        inline: "",
        type: "",
        async: false,
        defer: false,
        inHead: false,
      })),
  ];
  facts.stylesheets = [
    ...facts.stylesheets,
    ...snapshot.stylesheetHrefs
      .filter((href) => !facts.stylesheets.some((sheet) => sheet.href === href))
      .map((href) => ({ href, media: "" })),
  ];

  facts.nodeCount = Math.max(facts.nodeCount, snapshot.dom.nodeCount);
  facts.maxDepth = Math.max(facts.maxDepth, snapshot.dom.maxDepth);
  facts.duplicateIds = Math.max(facts.duplicateIds, snapshot.dom.duplicateIds);
  facts.inlineStyleAttributes = Math.max(
    facts.inlineStyleAttributes,
    snapshot.dom.inlineStyleCount,
  );
  facts.inlineScriptSamples = snapshot.dom.inlineScriptSamples.slice();
  facts.comments = snapshot.dom.htmlComments.slice();
  facts.htmlComments = Math.max(facts.htmlComments, facts.comments.length);
  facts.classAttributes = snapshot.dom.classSignatureSamples.slice();
  facts.classTokens = snapshot.dom.classSignatureSamples.flatMap((value) => value.split(/\s+/));
  facts.jsonLd = snapshot.dom.jsonLdSamples.slice();
  facts.semanticElements = snapshot.dom.semanticElements.slice();
  facts.tabindexPositive = 0;
  facts.targetBlankUnsafe = 0;
  if (snapshot.dom.headingLevels.length > 0 && facts.headings.length === 0) {
    facts.headings = snapshot.dom.headingLevels.map((level) => ({ level, text: "" }));
  }
  if (snapshot.dom.imageSources.length > 0 && facts.images.length === 0) {
    facts.images = snapshot.dom.imageSources.map((src) => ({
      src,
      altPresent: false,
      alt: null,
      loading: null,
      width: null,
      height: null,
    }));
  }
  facts.repeatedStructures = facts.repeatedStructures.length ? facts.repeatedStructures : [];
  facts.externalDomains = [
    ...new Set([...facts.externalDomains, ...(snapshot.timing?.thirdPartyOrigins ?? [])]),
  ];
  facts.inlineScriptBytes = Math.max(
    facts.inlineScriptBytes,
    snapshot.dom.inlineScriptSamples.reduce(
      (sum, item) => sum + new TextEncoder().encode(item).length,
      0,
    ),
  );
}
