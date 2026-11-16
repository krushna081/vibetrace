import type {
  BuilderFingerprint,
  Evidence,
  EvidenceCategory,
  EvidenceStrength,
  Metric,
} from "@vibetrace/shared-types";
import type { DocumentFacts } from "../document.js";
import type { TechnologyDetection } from "@vibetrace/shared-types";
import { sanitizeObserved } from "./technologies.js";

export type AIBuilderKind = "ai-native" | "website-builder" | "hosting-platform";

export interface BuilderDefinition {
  id: string;
  name: string;
  kind: AIBuilderKind;
  caveat: string;
}

export type AISource =
  | "html"
  | "metaGenerator"
  | "links"
  | "comments"
  | "inlineScripts"
  | "classTokens"
  | "hostname"
  | "sourceMaps"
  | "technologies"
  | "domStructure";

export interface AIFingerprintContext {
  facts: DocumentFacts;
  headers: Record<string, string>;
  hostname: string;
  technologies: TechnologyDetection[];
}

interface PatternMatch {
  kind: "pattern";
  source: AISource;
  pattern: RegExp;
}

interface CustomMatch {
  kind: "custom";
  detect: (context: AIFingerprintContext) => string | null;
}

export interface AIFingerprintRule {
  id: string;
  builderId: string | null;
  builderName: string;
  category: EvidenceCategory;
  strength: EvidenceStrength;
  weight: number;
  title: string;
  description: string;
  source: string;
  caveat?: string;
  match: PatternMatch | CustomMatch;
}

export const BUILDER_DEFINITIONS: BuilderDefinition[] = [
  {
    id: "lovable",
    name: "Lovable",
    kind: "ai-native",
    caveat:
      "Lovable is an AI-native application builder. Builder metadata indicates publishing through Lovable, but does not prove that every file or feature was AI-generated.",
  },
  {
    id: "bolt",
    name: "Bolt.new",
    kind: "ai-native",
    caveat:
      "Bolt is an AI-assisted development environment. A badge or generator marker identifies the publishing tool, not the origin of every line of code.",
  },
  {
    id: "v0",
    name: "v0",
    kind: "ai-native",
    caveat:
      "v0 is an AI-assisted UI generation tool. Its markers make AI assistance likely, but cannot establish authorship or the amount of human editing.",
  },
  {
    id: "replit",
    name: "Replit",
    kind: "ai-native",
    caveat:
      "Replit hosts hand-written and AI-assisted projects. A Replit hostname alone is a platform indicator, not proof that Replit Agent was used.",
  },
  {
    id: "framer",
    name: "Framer",
    kind: "website-builder",
    caveat:
      "Framer is a visual website builder with optional AI features. Detection of Framer does not show whether AI features were used.",
  },
  {
    id: "webflow",
    name: "Webflow",
    kind: "website-builder",
    caveat:
      "Webflow is a visual website builder with optional AI features. Detection of Webflow does not show whether AI features were used.",
  },
  {
    id: "wix",
    name: "Wix",
    kind: "website-builder",
    caveat:
      "Wix is a hosted website builder with optional AI features. Its presence is not evidence that AI generated the site.",
  },
];

const rule = (
  value: Omit<AIFingerprintRule, "builderName"> & { builderName?: string },
): AIFingerprintRule => ({
  ...value,
  builderName:
    value.builderName ??
    BUILDER_DEFINITIONS.find((builder) => builder.id === value.builderId)?.name ??
    "Generic source pattern",
});

function hostMatches(context: AIFingerprintContext, suffixes: string[]): string | null {
  const host = context.hostname.toLowerCase();
  return suffixes.find((suffix) => host === suffix || host.endsWith(`.${suffix}`)) ?? null;
}

function hasTechnology(context: AIFingerprintContext, id: string): TechnologyDetection | undefined {
  return context.technologies.find((technology) => technology.id === id);
}

export const AI_FINGERPRINT_REGISTRY: AIFingerprintRule[] = [
  // -----------------------------------------------------------------------
  // AI-native builders: strong, builder-specific evidence
  // -----------------------------------------------------------------------
  rule({
    id: "lovable-generator",
    builderId: "lovable",
    category: "strong_builder",
    strength: "strong",
    weight: 46,
    title: "Lovable generator metadata",
    description: "The page's generator metadata names Lovable, an AI-native application builder.",
    source: "meta generator",
    match: { kind: "pattern", source: "metaGenerator", pattern: /lovable/i },
  }),
  rule({
    id: "lovable-host",
    builderId: "lovable",
    category: "strong_builder",
    strength: "strong",
    weight: 42,
    title: "Lovable publishing hostname",
    description:
      "The scanned hostname is a Lovable publishing domain. This strongly associates the deployment with Lovable.",
    source: "hostname",
    match: {
      kind: "custom",
      detect: (context) =>
        hostMatches(context, ["lovable.app", "lovable.dev", "lovableproject.com"]),
    },
  }),
  rule({
    id: "lovable-badge",
    builderId: "lovable",
    category: "moderate_pattern",
    strength: "moderate",
    weight: 22,
    title: "Lovable badge or outbound link",
    description:
      "The page links to a Lovable property. This may be a publishing badge, but ordinary editorial links can look similar.",
    source: "page links",
    match: {
      kind: "custom",
      detect: (context) => {
        const link = context.facts.links.find((item) => {
          return (
            /lovable\.(?:app|dev)|lovableproject\.com/i.test(item.href) &&
            /lovable/i.test(item.text)
          );
        });
        return link?.href ?? null;
      },
    },
  }),
  rule({
    id: "bolt-generator",
    builderId: "bolt",
    category: "strong_builder",
    strength: "strong",
    weight: 40,
    title: "Bolt generator metadata",
    description: "The page's generator metadata names Bolt.",
    source: "meta generator",
    match: { kind: "pattern", source: "metaGenerator", pattern: /\bbolt\b/i },
  }),
  rule({
    id: "bolt-badge",
    builderId: "bolt",
    category: "moderate_pattern",
    strength: "moderate",
    weight: 22,
    title: "Bolt badge or outbound link",
    description:
      "A visible link points to Bolt.new with Bolt-related anchor text. A link alone does not establish how the site was built.",
    source: "page links",
    match: {
      kind: "custom",
      detect: (context) => {
        const link = context.facts.links.find(
          (item) => /bolt\.new/i.test(item.href) && /bolt/i.test(item.text),
        );
        return link?.href ?? null;
      },
    },
  }),
  rule({
    id: "bolt-comment",
    builderId: "bolt",
    category: "moderate_pattern",
    strength: "moderate",
    weight: 24,
    title: "Bolt build comment",
    description: "A source comment explicitly claims the page was built with Bolt.",
    source: "HTML comments",
    match: {
      kind: "pattern",
      source: "comments",
      pattern: /(?:built|made|generated)\s+(?:with|by)\s+bolt/i,
    },
  }),
  rule({
    id: "v0-generator",
    builderId: "v0",
    category: "strong_builder",
    strength: "strong",
    weight: 42,
    title: "v0 generator metadata",
    description: "The page's generator metadata names v0, an AI-assisted UI generator.",
    source: "meta generator",
    match: { kind: "pattern", source: "metaGenerator", pattern: /(?:^|\s)v0(?:\s|$)/i },
  }),
  rule({
    id: "v0-host",
    builderId: "v0",
    category: "strong_builder",
    strength: "strong",
    weight: 40,
    title: "v0 publishing hostname",
    description: "The scanned hostname is a v0 publishing domain.",
    source: "hostname",
    match: { kind: "custom", detect: (context) => hostMatches(context, ["v0.app", "v0.dev"]) },
  }),
  rule({
    id: "v0-badge",
    builderId: "v0",
    category: "moderate_pattern",
    strength: "moderate",
    weight: 18,
    title: "v0 badge or outbound link",
    description: "The page links to v0 with v0-related anchor text.",
    source: "page links",
    match: {
      kind: "custom",
      detect: (context) => {
        const link = context.facts.links.find(
          (item) => /v0\.(?:app|dev)/i.test(item.href) && /\bv0\b/i.test(item.text),
        );
        return link?.href ?? null;
      },
    },
  }),
  rule({
    id: "replit-host",
    builderId: "replit",
    category: "strong_builder",
    strength: "strong",
    weight: 34,
    title: "Replit publishing hostname",
    description:
      "The scanned hostname is a Replit deployment domain. Replit hosts both manual and AI-assisted projects.",
    source: "hostname",
    match: { kind: "custom", detect: (context) => hostMatches(context, ["replit.app", "repl.co"]) },
  }),
  rule({
    id: "replit-generator",
    builderId: "replit",
    category: "moderate_pattern",
    strength: "moderate",
    weight: 26,
    title: "Replit generator metadata",
    description: "The page's generator metadata names Replit.",
    source: "meta generator",
    match: { kind: "pattern", source: "metaGenerator", pattern: /replit/i },
  }),
  rule({
    id: "replit-comment",
    builderId: "replit",
    category: "moderate_pattern",
    strength: "moderate",
    weight: 20,
    title: "Replit build comment",
    description: "A source comment mentions building or generating the page with Replit.",
    source: "HTML comments",
    match: {
      kind: "pattern",
      source: "comments",
      pattern: /(?:built|made|generated)\s+(?:with|by)\s+replit/i,
    },
  }),

  // -----------------------------------------------------------------------
  // General website builders: useful fingerprints, weak AI evidence
  // -----------------------------------------------------------------------
  rule({
    id: "framer-builder",
    builderId: "framer",
    category: "weak_circumstantial",
    strength: "weak",
    weight: 7,
    title: "Framer website builder fingerprint",
    description:
      "Markers identify Framer as the publishing platform. Framer offers AI features, but this does not show they were used.",
    source: "builder metadata",
    match: {
      kind: "custom",
      detect: (context) => {
        if (hasTechnology(context, "framer")) return "Framer technology signature detected";
        return null;
      },
    },
  }),
  rule({
    id: "webflow-builder",
    builderId: "webflow",
    category: "weak_circumstantial",
    strength: "weak",
    weight: 6,
    title: "Webflow website builder fingerprint",
    description:
      "Markers identify Webflow as the publishing platform. It does not establish AI use.",
    source: "builder metadata",
    match: {
      kind: "custom",
      detect: (context) =>
        hasTechnology(context, "webflow") ? "Webflow technology signature detected" : null,
    },
  }),
  rule({
    id: "wix-builder",
    builderId: "wix",
    category: "weak_circumstantial",
    strength: "weak",
    weight: 5,
    title: "Wix website builder fingerprint",
    description: "Markers identify Wix as the publishing platform. It does not establish AI use.",
    source: "builder metadata",
    match: {
      kind: "custom",
      detect: (context) =>
        hasTechnology(context, "wix") ? "Wix technology signature detected" : null,
    },
  }),

  // -----------------------------------------------------------------------
  // Source-pattern indicators (generic, never sufficient alone)
  // -----------------------------------------------------------------------
  rule({
    id: "explicit-ai-claim",
    builderId: null,
    category: "moderate_pattern",
    strength: "moderate",
    weight: 20,
    title: "Explicit AI-generation statement",
    description:
      "Public source text or a comment explicitly states that AI generated or helped generate the site. Self-declarations are not independently verified.",
    source: "source comments",
    match: {
      kind: "pattern",
      source: "comments",
      pattern:
        /(?:generated|built|created|made)\s+(?:by|with)\s+(?:ai|an ai|artificial intelligence)|\bai[- ]generated\b/i,
    },
  }),
  rule({
    id: "assistant-artifact",
    builderId: null,
    category: "moderate_pattern",
    strength: "moderate",
    weight: 16,
    title: "AI coding assistant artifact",
    description:
      "A source comment references an AI coding assistant. Such comments can be boilerplate, documentation, or copied from a tutorial.",
    source: "source comments",
    match: {
      kind: "pattern",
      source: "comments",
      pattern: /generated (?:by|with) (?:github )?(?:copilot|cursor|claude|chatgpt)/i,
    },
  }),
  rule({
    id: "source-maps",
    builderId: null,
    category: "weak_circumstantial",
    strength: "weak",
    weight: 4,
    title: "Public source-map declarations",
    description:
      "The page exposes sourceMappingURL declarations. Source maps are common in many build pipelines and are only weak circumstantial evidence.",
    source: "source maps",
    match: {
      kind: "custom",
      detect: (context) =>
        context.facts.sourceMapDeclarations.length > 0
          ? `${context.facts.sourceMapDeclarations.length} declaration(s)`
          : null,
    },
  }),
  rule({
    id: "starter-defaults",
    builderId: null,
    category: "weak_circumstantial",
    strength: "weak",
    weight: 5,
    title: "Unedited framework starter defaults",
    description:
      "Default starter titles or logos remain in production. This suggests scaffolding, but does not indicate AI authorship.",
    source: "document metadata",
    match: {
      kind: "pattern",
      source: "html",
      pattern:
        /<title>\s*(?:Vite\s*\+\s*React|React App|My App|Untitled)\s*<\/title>|\/vite\.svg|\/react\.svg/i,
    },
  }),
  rule({
    id: "placeholder-copy",
    builderId: null,
    category: "weak_circumstantial",
    strength: "weak",
    weight: 4,
    title: "Placeholder copy in production",
    description:
      "Lorem ipsum placeholder text is present. This can indicate rapid scaffolding, but is not specific to AI tools.",
    source: "page HTML",
    match: { kind: "pattern", source: "html", pattern: /lorem ipsum/i },
  }),
  rule({
    id: "ui-component-signature",
    builderId: null,
    category: "weak_circumstantial",
    strength: "weak",
    weight: 4,
    title: "Generated UI component conventions",
    description:
      "The markup combines common shadcn/ui-style data-slot attributes with Tailwind theme classes. These conventions are widely used by human and AI developers.",
    source: "DOM class signatures",
    match: {
      kind: "custom",
      detect: (context) => {
        const html = context.facts.rawHtml;
        const classText = context.facts.classTokens.join(" ");
        return /data-slot=/i.test(html) &&
          /\b(?:bg-background|text-foreground|border-input)\b/.test(classText)
          ? "data-slot + theme utility classes"
          : null;
      },
    },
  }),
  rule({
    id: "repetitive-structure",
    builderId: null,
    category: "weak_circumstantial",
    strength: "weak",
    weight: 3,
    title: "Highly repetitive component structure",
    description:
      "Several DOM subtrees repeat with identical class signatures. Repetition can result from components, templating or AI generation and is weak evidence on its own.",
    source: "DOM structure",
    match: {
      kind: "custom",
      detect: (context) => {
        const top = context.facts.repeatedStructures[0];
        return top && top.count >= 8
          ? `${top.count} repeated nodes matching "${top.signature}"`
          : null;
      },
    },
  }),

  // -----------------------------------------------------------------------
  // Contradictory or complicating evidence
  // -----------------------------------------------------------------------
  rule({
    id: "traditional-cms",
    builderId: null,
    category: "contradictory",
    strength: "weak",
    weight: 7,
    title: "Traditional CMS fingerprint",
    description:
      "A conventional CMS (WordPress, Webflow, Wix or Framer) is a strong publishing-platform signature. It weakens an AI-native builder explanation, but AI tools can still edit themes or content inside a CMS.",
    source: "technology stack",
    match: {
      kind: "custom",
      detect: (context) => {
        const cms = context.technologies.find((item) =>
          ["wordpress", "webflow", "wix", "framer"].includes(item.id),
        );
        const aiBuilder = context.technologies.find((item) =>
          ["lovable", "bolt", "v0", "replit"].includes(item.id),
        );
        return cms && !aiBuilder ? `${cms.name} detected` : null;
      },
    },
  }),
  rule({
    id: "legacy-markup",
    builderId: null,
    category: "contradictory",
    strength: "weak",
    weight: 5,
    title: "Legacy HTML patterns",
    description:
      "Presentational legacy markup suggests a long-lived or manually maintained codebase. This is not proof of human authorship and does not rule out AI assistance.",
    source: "HTML source",
    match: {
      kind: "pattern",
      source: "html",
      pattern: /<(?:font|center|marquee)\b|\sbgcolor=|\scellpadding=/i,
    },
  }),
  rule({
    id: "conflicting-generators",
    builderId: null,
    category: "contradictory",
    strength: "weak",
    weight: 9,
    title: "Conflicting publishing signals",
    description:
      "Multiple competing publishing or builder signals are present. This makes a single-origin explanation less reliable and should be reviewed manually.",
    source: "technology stack",
    match: {
      kind: "custom",
      detect: (context) => {
        const builders = context.technologies.filter((item) =>
          ["wordpress", "webflow", "wix", "framer", "nextjs"].includes(item.id),
        );
        return builders.length >= 2
          ? `Competing signals: ${builders.map((item) => item.name).join(", ")}`
          : null;
      },
    },
  }),
];

export interface AISignalDetection {
  evidence: Evidence[];
  contradictions: Evidence[];
  builderFingerprints: BuilderFingerprint[];
  metrics: Metric[];
  rulesEvaluated: number;
  rulesMatched: number;
  repositoryLinks: string[];
}

function contextSource(ruleValue: AIFingerprintRule, context: AIFingerprintContext): string {
  if (ruleValue.match.kind === "custom") return "";
  switch (ruleValue.match.source) {
    case "html":
      return context.facts.rawHtml;
    case "metaGenerator":
      return context.facts.generator ?? "";
    case "links":
      return context.facts.links.map((link) => `${link.href} ${link.text}`).join("\n");
    case "comments":
      return context.facts.comments.join("\n");
    case "inlineScripts":
      return context.facts.inlineScriptSamples.join("\n");
    case "classTokens":
      return context.facts.classTokens.join(" ");
    case "sourceMaps":
      return context.facts.sourceMapDeclarations.join("\n");
    case "technologies":
      return context.technologies.map((item) => item.name).join("\n");
    case "hostname":
      return context.hostname;
    case "domStructure":
      return context.facts.repeatedStructures.map((item) => item.signature).join("\n");
  }
}

export function detectAISignals(context: AIFingerprintContext): AISignalDetection {
  const evidence: Evidence[] = [];
  const contradictions: Evidence[] = [];
  const matchedRules: AIFingerprintRule[] = [];

  for (const candidate of AI_FINGERPRINT_REGISTRY) {
    let observed: string | null = null;
    if (candidate.match.kind === "custom") {
      observed = candidate.match.detect(context);
    } else {
      const value = contextSource(candidate, context);
      if (value) {
        candidate.match.pattern.lastIndex = 0;
        const match = candidate.match.pattern.exec(value);
        observed = match ? match[0] : null;
      }
    }
    if (!observed) continue;
    matchedRules.push(candidate);

    const item: Evidence = {
      id: candidate.id,
      title: candidate.title,
      description: candidate.description,
      category: candidate.category,
      strength: candidate.strength,
      weight: candidate.weight,
      source: candidate.source,
      observed: sanitizeObserved(observed),
    };
    if (candidate.category === "contradictory") contradictions.push(item);
    else evidence.push(item);
  }

  const builderFingerprints: BuilderFingerprint[] = [];
  for (const builder of BUILDER_DEFINITIONS) {
    const matches = evidence.filter((item) => {
      const ruleValue = matchedRules.find((candidate) => candidate.id === item.id);
      return ruleValue?.builderId === builder.id;
    });
    if (matches.length === 0) continue;
    const weightSum = matches.reduce((sum, item) => sum + item.weight, 0);
    builderFingerprints.push({
      id: builder.id,
      name: builder.name,
      kind: builder.kind,
      confidence: Math.round(Math.min(98, 100 * (1 - Math.exp(-weightSum / 26)))),
      evidenceTitles: matches.map((item) => item.title),
      caveat: builder.caveat,
    });
  }
  builderFingerprints.sort((a, b) => b.confidence - a.confidence);

  const repositoryLinks = context.facts.links
    .map((link) => link.href)
    .filter((href) =>
      /^https?:\/\/(?:www\.)?(?:github\.com|gitlab\.com|bitbucket\.org)\//i.test(href),
    )
    .slice(0, 10);

  const metrics: Metric[] = [
    {
      id: "rules-evaluated",
      label: "Fingerprint rules evaluated",
      value: AI_FINGERPRINT_REGISTRY.length,
      measured: true,
    },
    {
      id: "rules-matched",
      label: "Fingerprint rules matched",
      value: matchedRules.length,
      measured: true,
    },
    {
      id: "source-map-declarations",
      label: "Source-map declarations observed",
      value: context.facts.sourceMapDeclarations.length,
      measured: true,
    },
    {
      id: "repository-links",
      label: "Public repository links observed",
      value: repositoryLinks.length,
      measured: true,
      note:
        repositoryLinks.length > 0
          ? "Links are metadata only; VibeTrace does not inspect repositories automatically."
          : undefined,
    },
    {
      id: "html-comments",
      label: "HTML comments inspected",
      value: context.facts.htmlComments,
      measured: true,
    },
  ];

  return {
    evidence,
    contradictions,
    builderFingerprints,
    metrics,
    rulesEvaluated: AI_FINGERPRINT_REGISTRY.length,
    rulesMatched: matchedRules.length,
    repositoryLinks,
  };
}

export function fingerprintRegistryMetadata() {
  return AI_FINGERPRINT_REGISTRY.map((item) => ({
    id: item.id,
    builder: item.builderName,
    kind:
      BUILDER_DEFINITIONS.find((builder) => builder.id === item.builderId)?.kind ??
      "source-pattern",
    category: item.category,
    strength: item.strength,
    title: item.title,
    description: item.description,
    source: item.source,
    caveat:
      item.caveat ??
      BUILDER_DEFINITIONS.find((builder) => builder.id === item.builderId)?.caveat ??
      "This is a heuristic indicator. It cannot establish who or what authored the code.",
  }));
}
