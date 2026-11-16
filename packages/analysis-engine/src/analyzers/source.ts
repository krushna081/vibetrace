import type { SourceProfile } from "@vibetrace/shared-types";
import type { AnalyzerContext } from "../types.js";

export function buildSourceProfile(context: AnalyzerContext): SourceProfile {
  const { facts } = context;
  const externalScripts = facts.scriptFacts.filter((script) => Boolean(script.src)).length;
  const inlineScripts = facts.scriptFacts.filter((script) => Boolean(script.inline)).length;

  const mapValues = new Set<string>();
  for (const value of context.probes.sourceMaps) mapValues.add(value);
  for (const value of facts.sourceMapDeclarations) {
    const already = [...mapValues].some((existing) => existing.endsWith(value));
    if (!already) mapValues.add(`declared:${value}`);
  }

  const limitations = [
    "Only the initial HTML document and a small, configurable sample of same-origin assets were inspected.",
    "Raw script contents, cookies, form values and storage are never included in reports.",
    "External bundles, authenticated areas and resources blocked by the server are not inspected unless explicitly reachable.",
  ];
  if (context.mode === "snapshot") {
    limitations.push(
      "Snapshot mode receives sanitized DOM structure and counts from the extension rather than the complete original HTML.",
    );
  }
  if (context.response.truncated) {
    limitations.push(
      "At least one downloaded response was truncated at the configured size limit.",
    );
  }

  return {
    htmlBytes: context.response.bodyBytes,
    htmlTruncated: context.response.truncated,
    scriptCount: facts.scriptFacts.length,
    externalScriptCount: externalScripts,
    inlineScriptCount: inlineScripts,
    stylesheetCount: facts.stylesheets.length,
    imageCount: context.snapshot?.dom.imageCount ?? facts.images.length,
    nodeCount: context.snapshot?.dom.nodeCount ?? facts.nodeCount,
    maxDepth: context.snapshot?.dom.maxDepth ?? facts.maxDepth,
    thirdPartyDomains: facts.externalDomains.slice(0, 100),
    metaGenerator: facts.generator,
    comments: context.snapshot?.dom.htmlComments.length ?? facts.comments.length,
    duplicateIds: context.snapshot?.dom.duplicateIds ?? facts.duplicateIds,
    sourceMaps: [...mapValues].slice(0, 20),
    repeatedStructures: facts.repeatedStructures.slice(0, 8),
    limitations,
  };
}
