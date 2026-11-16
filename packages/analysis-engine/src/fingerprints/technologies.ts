import type {
  Evidence,
  EvidenceStrength,
  TechnologyDetection,
  TechnologyCategory,
} from "@vibetrace/shared-types";
import type { DocumentFacts } from "../document.js";

export type TechSource =
  | "html"
  | "scriptSrc"
  | "stylesheetHref"
  | "meta"
  | "metaGenerator"
  | "header"
  | "classTokens"
  | "inlineCss"
  | "jsonLd"
  | "inlineScripts"
  | "links";

export interface TechRule {
  id: string;
  source: TechSource;
  headerName?: string;
  pattern: RegExp;
  strength: EvidenceStrength;
  weight: number;
  title: string;
  description: string;
}

export interface VersionRule {
  source: TechSource;
  headerName?: string;
  pattern: RegExp;
}

export interface TechnologyDefinition {
  id: string;
  name: string;
  category: TechnologyCategory;
  description: string;
  website: string;
  rules: TechRule[];
  versionRules?: VersionRule[];
}

const rule = (
  id: string,
  source: TechSource,
  pattern: RegExp,
  strength: EvidenceStrength,
  weight: number,
  title: string,
  description: string,
  headerName?: string,
): TechRule => ({ id, source, pattern, strength, weight, title, description, headerName });

export const TECHNOLOGY_REGISTRY: TechnologyDefinition[] = [
  {
    id: "react",
    name: "React",
    category: "ui-library",
    description: "A JavaScript library for building component-based user interfaces.",
    website: "https://react.dev",
    rules: [
      rule(
        "react-script",
        "scriptSrc",
        /(?:^|[/@._-])react(?:-dom)?(?:[.@/_-]|$)/i,
        "moderate",
        30,
        "React script reference",
        "A script URL contains a React or React DOM runtime artifact.",
      ),
      rule(
        "react-root",
        "html",
        /data-reactroot\b/i,
        "strong",
        45,
        "React root marker",
        "The HTML contains React's data-reactroot marker.",
      ),
      rule(
        "react-inline",
        "inlineScripts",
        /__REACT_DEVTOOLS_GLOBAL_HOOK__|ReactDOM\.(?:hydrate|createRoot)|react\.createElement/i,
        "moderate",
        24,
        "React runtime pattern",
        "An inline script references a recognizable React runtime API.",
      ),
    ],
  },
  {
    id: "nextjs",
    name: "Next.js",
    category: "meta-framework",
    description: "A React framework for server rendering and full-stack web applications.",
    website: "https://nextjs.org",
    rules: [
      rule(
        "next-assets",
        "html",
        /\/_next\//i,
        "strong",
        45,
        "Next.js build path",
        "The document references Next.js's /_next/ build asset path.",
      ),
      rule(
        "next-data",
        "html",
        /__NEXT_DATA__/i,
        "strong",
        48,
        "Next.js data payload",
        "The page contains the __NEXT_DATA__ hydration payload.",
      ),
      rule(
        "next-header",
        "header",
        /next\.js/i,
        "strong",
        52,
        "Next.js server header",
        "An HTTP response header identifies Next.js.",
        "x-powered-by",
      ),
    ],
    versionRules: [
      {
        source: "header",
        headerName: "x-powered-by",
        pattern: /Next\.js\s*([\d.]+)/i,
      },
    ],
  },
  {
    id: "vue",
    name: "Vue",
    category: "ui-library",
    description: "A progressive JavaScript framework for building user interfaces.",
    website: "https://vuejs.org",
    rules: [
      rule(
        "vue-scope",
        "html",
        /data-v-[a-f0-9]{5,}/i,
        "moderate",
        28,
        "Vue scoped-style marker",
        "Scoped style attributes use Vue's data-v-* naming convention.",
      ),
      rule(
        "vue-inline",
        "inlineScripts",
        /__VUE__|createApp\s*\(|\bVue\.createApp\b/i,
        "moderate",
        26,
        "Vue runtime pattern",
        "An inline script references a recognizable Vue runtime API.",
      ),
      rule(
        "vue-script",
        "scriptSrc",
        /(?:^|[/@._-])vue(?:-router)?(?:[.@/_-]|$)/i,
        "moderate",
        28,
        "Vue script reference",
        "A script URL contains a Vue runtime artifact.",
      ),
    ],
  },
  {
    id: "angular",
    name: "Angular",
    category: "framework",
    description: "A TypeScript-first application framework maintained by Google.",
    website: "https://angular.dev",
    rules: [
      rule(
        "angular-version",
        "html",
        /\bng-version=["'][^"']+["']/i,
        "strong",
        55,
        "Angular version attribute",
        "The application root exposes an ng-version attribute.",
      ),
      rule(
        "angular-attrs",
        "html",
        /_nghost-|_ngcontent-|ng-server-context/i,
        "moderate",
        32,
        "Angular renderer attributes",
        "The document contains Angular renderer or SSR attributes.",
      ),
    ],
    versionRules: [
      {
        source: "html",
        pattern: /\bng-version=["']([^"']+)["']/i,
      },
    ],
  },
  {
    id: "svelte",
    name: "Svelte",
    category: "framework",
    description: "A compiler-first UI framework that emits highly optimized JavaScript.",
    website: "https://svelte.dev",
    rules: [
      rule(
        "sveltekit",
        "html",
        /__sveltekit|data-sveltekit-/i,
        "strong",
        48,
        "SvelteKit marker",
        "The page contains SvelteKit hydration or navigation markers.",
      ),
      rule(
        "svelte-hash",
        "html",
        /class=["'][^"']*\bsvelte-[a-z0-9]{4,}/i,
        "moderate",
        26,
        "Svelte scoped class",
        "The markup contains Svelte's hashed scoped-style class names.",
      ),
    ],
  },
  {
    id: "astro",
    name: "Astro",
    category: "meta-framework",
    description: "A content-focused web framework that ships minimal client JavaScript.",
    website: "https://astro.build",
    rules: [
      rule(
        "astro-markers",
        "html",
        /astro-island|data-astro-cid|astro-slot|data-astro-transition/i,
        "strong",
        46,
        "Astro island markers",
        "The document contains Astro island or scoped-style markers.",
      ),
      rule(
        "astro-assets",
        "scriptSrc",
        /\/_astro\//i,
        "strong",
        40,
        "Astro asset path",
        "A script or module URL uses Astro's /_astro/ asset directory.",
      ),
      rule(
        "astro-generator",
        "metaGenerator",
        /astro/i,
        "strong",
        52,
        "Astro generator metadata",
        "The document's generator metadata names Astro.",
      ),
    ],
    versionRules: [{ source: "metaGenerator", pattern: /Astro\s+v?([\d.]+)/i }],
  },
  {
    id: "wordpress",
    name: "WordPress",
    category: "cms",
    description: "A widely deployed open-source content management system.",
    website: "https://wordpress.org",
    rules: [
      rule(
        "wp-assets",
        "html",
        /\/wp-content\/|\/wp-includes\//i,
        "strong",
        38,
        "WordPress asset paths",
        "The document references WordPress core or content paths.",
      ),
      rule(
        "wp-generator",
        "metaGenerator",
        /wordpress/i,
        "strong",
        55,
        "WordPress generator metadata",
        "The generator meta tag names WordPress.",
      ),
      rule(
        "wp-json",
        "html",
        /\/wp-json\/?(?:["'?\s]|$)/i,
        "moderate",
        24,
        "WordPress REST route",
        "The page references the WordPress REST API.",
      ),
    ],
    versionRules: [{ source: "metaGenerator", pattern: /WordPress\s+([\d.]+)/i }],
  },
  {
    id: "shopify",
    name: "Shopify",
    category: "ecommerce",
    description: "A hosted ecommerce platform and storefront system.",
    website: "https://www.shopify.com",
    rules: [
      rule(
        "shopify-cdn",
        "html",
        /cdn\.shopify\.(?:com|net)/i,
        "strong",
        44,
        "Shopify CDN",
        "Assets are loaded from Shopify's CDN.",
      ),
      rule(
        "shopify-theme",
        "html",
        /Shopify\.theme|shopify-section|shopify-payment-button/i,
        "strong",
        42,
        "Shopify storefront object",
        "The page exposes a Shopify storefront or section marker.",
      ),
      rule(
        "shopify-header",
        "header",
        /.+/,
        "strong",
        55,
        "Shopify request header",
        "The response includes an x-shopid header.",
        "x-shopid",
      ),
    ],
  },
  {
    id: "webflow",
    name: "Webflow",
    category: "cms",
    description: "A visual website builder with hosted publishing and CMS features.",
    website: "https://webflow.com",
    rules: [
      rule(
        "webflow-data",
        "html",
        /data-wf-(?:site|page|domain)/i,
        "strong",
        55,
        "Webflow site attributes",
        "The document contains Webflow's data-wf-* site markers.",
      ),
      rule(
        "webflow-generator",
        "metaGenerator",
        /webflow/i,
        "strong",
        55,
        "Webflow generator metadata",
        "The generator meta tag names Webflow.",
      ),
      rule(
        "webflow-runtime",
        "scriptSrc",
        /webflow/i,
        "moderate",
        26,
        "Webflow runtime",
        "A script URL references Webflow runtime assets.",
      ),
      rule(
        "webflow-cdn",
        "html",
        /website-files\.com/i,
        "moderate",
        22,
        "Webflow asset CDN",
        "Assets are loaded from Webflow's website-files.com CDN.",
      ),
    ],
  },
  {
    id: "wix",
    name: "Wix",
    category: "cms",
    description: "A hosted website builder and business application platform.",
    website: "https://www.wix.com",
    rules: [
      rule(
        "wix-cdn",
        "html",
        /static\.wixstatic\.com/i,
        "strong",
        42,
        "Wix asset CDN",
        "Assets are loaded from Wix's static.wixstatic.com CDN.",
      ),
      rule(
        "wix-generator",
        "metaGenerator",
        /wix/i,
        "strong",
        55,
        "Wix generator metadata",
        "The generator meta tag names Wix.",
      ),
      rule(
        "wix-runtime",
        "html",
        /wix-code|wix-image|wix-viewer-model/i,
        "moderate",
        28,
        "Wix runtime markers",
        "The page contains Wix viewer or runtime markers.",
      ),
    ],
  },
  {
    id: "framer",
    name: "Framer",
    category: "cms",
    description: "A visual site builder with hosted publishing and AI-assisted features.",
    website: "https://www.framer.com",
    rules: [
      rule(
        "framer-generator",
        "metaGenerator",
        /framer/i,
        "strong",
        55,
        "Framer generator metadata",
        "The generator meta tag names Framer.",
      ),
      rule(
        "framer-data",
        "html",
        /data-framer-(?:name|app|component|page)/i,
        "strong",
        48,
        "Framer DOM markers",
        "The document contains Framer component or page attributes.",
      ),
      rule(
        "framer-cdn",
        "html",
        /framerusercontent\.com/i,
        "moderate",
        28,
        "Framer content CDN",
        "Assets are loaded from Framer's content CDN.",
      ),
    ],
  },
  {
    id: "vite",
    name: "Vite",
    category: "build",
    description: "A frontend build tool and development server.",
    website: "https://vite.dev",
    rules: [
      rule(
        "vite-client",
        "scriptSrc",
        /\/@vite\/client|\/vite\/client/i,
        "strong",
        50,
        "Vite development client",
        "A script URL references the Vite development client.",
      ),
      rule(
        "vite-marker",
        "html",
        /__vite__|vite\/modulepreload/i,
        "strong",
        42,
        "Vite runtime marker",
        "The document contains a Vite runtime or modulepreload marker.",
      ),
    ],
  },
  {
    id: "tailwind",
    name: "Tailwind CSS",
    category: "styling",
    description: "A utility-first CSS framework.",
    website: "https://tailwindcss.com",
    rules: [
      rule(
        "tailwind-runtime",
        "inlineCss",
        /--tw-(?:ring|shadow|translate|rotate|scale|gradient|blur|brightness)/i,
        "strong",
        44,
        "Tailwind CSS variables",
        "Inline CSS defines Tailwind's --tw-* runtime custom properties.",
      ),
      rule(
        "tailwind-classes",
        "classTokens",
        /\b(?:sm|md|lg|xl|2xl):(?:flex|grid|hidden|block|p-|m-|text-|bg-|w-|h-|gap-)|\b(?:flex|grid|hidden)\s+(?:items-|justify-|gap-)/,
        "moderate",
        20,
        "Tailwind utility class patterns",
        "Class attributes use responsive utility patterns characteristic of Tailwind.",
      ),
      rule(
        "tailwind-asset",
        "stylesheetHref",
        /tailwind/i,
        "weak",
        16,
        "Tailwind stylesheet name",
        "A stylesheet URL contains the name 'tailwind'.",
      ),
    ],
  },
  {
    id: "bootstrap",
    name: "Bootstrap",
    category: "styling",
    description: "A component and CSS framework.",
    website: "https://getbootstrap.com",
    rules: [
      rule(
        "bootstrap-asset",
        "html",
        /bootstrap(?:\.bundle)?(?:\.min)?\.(?:css|js)/i,
        "strong",
        45,
        "Bootstrap asset",
        "The document references a Bootstrap CSS or JavaScript asset.",
      ),
      rule(
        "bootstrap-grid",
        "classTokens",
        /\bcol-(?:sm|md|lg|xl|xxl)-\d{1,2}\b/i,
        "weak",
        14,
        "Bootstrap grid classes",
        "Markup uses Bootstrap's responsive grid class convention.",
      ),
    ],
  },
  {
    id: "nodejs",
    name: "Node.js",
    category: "backend",
    description: "Server-side JavaScript runtime; usually inferred from backend headers.",
    website: "https://nodejs.org",
    rules: [
      rule(
        "node-express",
        "header",
        /express|node(?:\.js)?/i,
        "moderate",
        38,
        "Node.js-backed server header",
        "An x-powered-by header identifies Express or Node.js.",
        "x-powered-by",
      ),
      rule(
        "node-server",
        "header",
        /node(?:\.js)?/i,
        "weak",
        14,
        "Node.js server header",
        "The Server header mentions Node.js.",
        "server",
      ),
    ],
  },
  {
    id: "php",
    name: "PHP",
    category: "backend",
    description: "A server-side scripting language commonly used by CMS platforms.",
    website: "https://www.php.net",
    rules: [
      rule(
        "php-header",
        "header",
        /php/i,
        "strong",
        50,
        "PHP server header",
        "An x-powered-by header identifies PHP.",
        "x-powered-by",
      ),
      rule(
        "php-extension",
        "html",
        /\.php(?:["'?#]|\s|$)/i,
        "weak",
        12,
        "PHP URL extension",
        "A referenced URL ends in .php.",
      ),
    ],
    versionRules: [{ source: "header", headerName: "x-powered-by", pattern: /PHP\/([\d.]+)/i }],
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    category: "cdn",
    description: "A CDN, DNS and edge security platform.",
    website: "https://www.cloudflare.com",
    rules: [
      rule(
        "cf-ray",
        "header",
        /.+/,
        "strong",
        65,
        "Cloudflare ray header",
        "The response includes a Cloudflare cf-ray header.",
        "cf-ray",
      ),
      rule(
        "cf-server",
        "header",
        /cloudflare/i,
        "moderate",
        38,
        "Cloudflare server header",
        "The Server header identifies Cloudflare.",
        "server",
      ),
      rule(
        "cf-cache",
        "header",
        /.+/,
        "moderate",
        25,
        "Cloudflare cache header",
        "The response includes a Cloudflare cache-status header.",
        "cf-cache-status",
      ),
    ],
  },
  {
    id: "vercel",
    name: "Vercel",
    category: "hosting",
    description: "A frontend cloud platform and hosting provider.",
    website: "https://vercel.com",
    rules: [
      rule(
        "vercel-id",
        "header",
        /.+/,
        "strong",
        62,
        "Vercel request header",
        "The response includes an x-vercel-id header.",
        "x-vercel-id",
      ),
      rule(
        "vercel-server",
        "header",
        /vercel/i,
        "moderate",
        32,
        "Vercel server header",
        "The Server header identifies Vercel.",
        "server",
      ),
      rule(
        "vercel-html",
        "html",
        /_vercel\/insights|vercel\.live/i,
        "weak",
        18,
        "Vercel asset marker",
        "The document references a Vercel analytics or live-preview asset.",
      ),
    ],
  },
  {
    id: "netlify",
    name: "Netlify",
    category: "hosting",
    description: "A web hosting and deployment platform.",
    website: "https://www.netlify.com",
    rules: [
      rule(
        "netlify-request",
        "header",
        /.+/,
        "strong",
        62,
        "Netlify request header",
        "The response includes an x-nf-request-id header.",
        "x-nf-request-id",
      ),
      rule(
        "netlify-server",
        "header",
        /netlify/i,
        "moderate",
        32,
        "Netlify server header",
        "The Server header identifies Netlify.",
        "server",
      ),
      rule(
        "netlify-functions",
        "html",
        /\/\.netlify\/functions\//i,
        "weak",
        18,
        "Netlify function path",
        "The document references a Netlify Functions endpoint.",
      ),
    ],
  },
];

export interface TechDetectionContext {
  facts: DocumentFacts;
  headers: Record<string, string>;
  hostname: string;
}

function sourceValue(rule: TechRule, context: TechDetectionContext): string {
  const { facts, headers } = context;
  switch (rule.source) {
    case "html":
      return facts.rawHtml;
    case "scriptSrc":
      return facts.scriptFacts.map((script) => script.src ?? "").join("\n");
    case "stylesheetHref":
      return facts.stylesheets.map((sheet) => sheet.href).join("\n");
    case "meta":
      return Object.entries(facts.meta)
        .map(([key, value]) => `${key}=${value}`)
        .join("\n");
    case "metaGenerator":
      return facts.generator ?? "";
    case "header":
      return rule.headerName ? (headers[rule.headerName.toLowerCase()] ?? "") : "";
    case "classTokens":
      return facts.classTokens.join(" ");
    case "inlineCss":
      return facts.inlineStyles.join("\n");
    case "jsonLd":
      return facts.jsonLd.join("\n");
    case "inlineScripts":
      return facts.inlineScriptSamples.join("\n");
    case "links":
      return facts.links.map((link) => link.href).join("\n");
  }
}

export function sanitizeObserved(value: string, max = 220): string {
  let cleaned = value.replace(/\s+/g, " ").trim();
  cleaned = cleaned.replace(/https?:\/\/[^\s"'<>]+/gi, (raw) => {
    try {
      const url = new URL(raw);
      return `${url.origin}${url.pathname}`;
    } catch {
      return raw;
    }
  });
  return cleaned.slice(0, max);
}

function confidenceFromWeights(weights: number[]): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return 0;
  return Math.round(Math.min(98, 100 * (1 - Math.exp(-total / 38))));
}

export function detectTechnologies(context: TechDetectionContext): TechnologyDetection[] {
  const detections: TechnologyDetection[] = [];

  for (const definition of TECHNOLOGY_REGISTRY) {
    const evidence: Evidence[] = [];
    for (const candidate of definition.rules) {
      const value = sourceValue(candidate, context);
      if (!value) continue;
      candidate.pattern.lastIndex = 0;
      const match = candidate.pattern.exec(value);
      if (!match) continue;
      evidence.push({
        id: `${definition.id}-${candidate.id}`,
        title: candidate.title,
        description: candidate.description,
        category: "technology_signature",
        strength: candidate.strength,
        weight: candidate.weight,
        source: candidate.source,
        observed: sanitizeObserved(match[0] || value),
      });
    }

    if (evidence.length === 0) continue;
    let version: string | undefined;
    for (const versionRule of definition.versionRules ?? []) {
      const fakeRule: TechRule = {
        id: "version",
        source: versionRule.source,
        headerName: versionRule.headerName,
        pattern: versionRule.pattern,
        strength: "weak",
        weight: 0,
        title: "",
        description: "",
      };
      const value = sourceValue(fakeRule, context);
      versionRule.pattern.lastIndex = 0;
      const match = versionRule.pattern.exec(value);
      if (match?.[1]) {
        version = match[1].slice(0, 30);
        break;
      }
    }

    detections.push({
      id: definition.id,
      name: definition.name,
      category: definition.category,
      description: definition.description,
      website: definition.website,
      confidence: confidenceFromWeights(evidence.map((item) => item.weight)),
      version,
      evidence,
    });
  }

  const byId = new Map(detections.map((item) => [item.id, item]));
  const addInference = (
    fromId: string,
    toId: string,
    title: string,
    description: string,
    weight: number,
  ) => {
    const source = byId.get(fromId);
    const target = byId.get(toId);
    const definition = TECHNOLOGY_REGISTRY.find((item) => item.id === toId);
    if (!source || !definition) return;
    const inference: Evidence = {
      id: `${toId}-inferred-${fromId}`,
      title,
      description,
      category: "technology_signature",
      strength: "moderate",
      weight,
      source: "Inferred dependency",
      observed: `Inferred because ${source.name} was detected.`,
    };
    if (target) {
      if (!target.evidence.some((item) => item.id === inference.id)) {
        target.evidence.push(inference);
        target.confidence = confidenceFromWeights(target.evidence.map((item) => item.weight));
      }
      return;
    }
    detections.push({
      id: definition.id,
      name: definition.name,
      category: definition.category,
      description: definition.description,
      website: definition.website,
      confidence: confidenceFromWeights([weight]),
      evidence: [inference],
    });
  };

  addInference(
    "nextjs",
    "react",
    "React dependency inferred from Next.js",
    "Next.js is built on React; this is an inferred dependency, not an independent runtime observation.",
    20,
  );
  addInference(
    "wordpress",
    "php",
    "PHP dependency inferred from WordPress",
    "WordPress requires PHP; this is an inferred runtime dependency.",
    18,
  );

  return detections.sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name));
}

export function technologyRegistryMetadata() {
  return TECHNOLOGY_REGISTRY.map((definition) => ({
    id: definition.id,
    name: definition.name,
    category: definition.category,
    description: definition.description,
    website: definition.website,
    detectionMethods: definition.rules.map((item) => item.title),
  }));
}
