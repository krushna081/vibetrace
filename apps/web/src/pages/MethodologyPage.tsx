import { Link } from "react-router-dom";
import { ArrowUpRight, BookOpen, Chrome, LockKeyhole, Scale } from "lucide-react";
import { SCORE_METHODOLOGIES } from "@vibetrace/scoring-engine";
import { Alert, Badge, Card, PageHeader } from "@vibetrace/design-system";
import { usePageTitle } from "../hooks/use-api.js";

const TOC = [
  ["principles", "Principles"],
  ["scores", "Scores & coverage"],
  ["ai-signals", "AI signals"],
  ["technology", "Technology"],
  ["security", "Security"],
  ["performance", "Performance"],
  ["quality", "Code quality"],
  ["accessibility", "Accessibility"],
  ["seo", "SEO"],
  ["ssrf", "Fetch protections"],
  ["extension", "Extension"],
  ["api", "API & exports"],
] as const;

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}): React.ReactNode {
  return (
    <section id={id} style={{ scrollMarginTop: 90, marginBottom: 20 }}>
      <Card style={{ padding: "clamp(18px, 3.5vw, 26px)" }}>
        <span className="vt-eyebrow">{eyebrow}</span>
        <h2
          style={{
            margin: "9px 0 0",
            fontSize: "clamp(20px, 2.8vw, 26px)",
            letterSpacing: "-0.03em",
            lineHeight: 1.15,
          }}
        >
          {title}
        </h2>
        <div
          style={{ marginTop: 10, color: "var(--vt-text-muted)", fontSize: 13, lineHeight: 1.75 }}
        >
          {children}
        </div>
      </Card>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }): React.ReactNode {
  return <p style={{ margin: "0 0 10px" }}>{children}</p>;
}

function List({ items }: { items: string[] }): React.ReactNode {
  return (
    <ul style={{ margin: "0 0 10px", paddingLeft: 18 }}>
      {items.map((item) => (
        <li key={item} style={{ marginBottom: 5 }}>
          {item}
        </li>
      ))}
    </ul>
  );
}

function Formula({ children }: { children: React.ReactNode }): React.ReactNode {
  return (
    <div
      className="vt-mono"
      style={{
        margin: "10px 0",
        padding: "11px 13px",
        border: "1px solid var(--vt-border)",
        borderRadius: 6,
        background: "var(--vt-black)",
        color: "var(--vt-text)",
        fontSize: 11,
        lineHeight: 1.8,
        overflowX: "auto",
      }}
    >
      {children}
    </div>
  );
}

export function MethodologyPage(): React.ReactNode {
  usePageTitle("Methodology");
  const updated = "15 November 2026";

  return (
    <div>
      <PageHeader
        eyebrow="Methodology"
        title="How VibeTrace reaches a finding."
        description="Every score, classifier threshold and fetch limit documented in one place. The goal is not certainty theatre: it is inspectable evidence with explicit uncertainty."
        actions={<Badge tone="lime">Engine 0.1.0</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
        <nav
          aria-label="Methodology contents"
          className="vt-card lg:sticky"
          style={{ padding: "12px 10px", top: 88 }}
        >
          <span
            className="vt-mono"
            style={{
              display: "block",
              padding: "0 8px 8px",
              fontSize: 9,
              letterSpacing: "0.12em",
              color: "var(--vt-text-faint)",
              textTransform: "uppercase",
            }}
          >
            Contents
          </span>
          <div style={{ display: "grid" }}>
            {TOC.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                style={{
                  padding: "5px 8px",
                  borderRadius: 4,
                  color: "var(--vt-text-muted)",
                  textDecoration: "none",
                  fontSize: 12,
                }}
              >
                {label}
              </a>
            ))}
          </div>
        </nav>

        <div style={{ minWidth: 0 }}>
          <Section
            id="principles"
            eyebrow="01 · Principles"
            title="Evidence first. Uncertainty visible."
          >
            <P>
              VibeTrace analyzes public web pages and sanitized browser snapshots using
              deterministic rules. It publishes seven independent signals: AI-development evidence,
              technology detection confidence, code quality, security, performance, accessibility
              and SEO. No global “website score” is computed, because collapsing unrelated
              dimensions hides the trade-offs and coverage gaps that matter.
            </P>
            <List
              items={[
                "Every displayed technology or AI signal must carry inspectable evidence. Visual vibes are not evidence.",
                "Unavailable checks are recorded as unavailable; they are never converted to zeros.",
                "A category score is withheld when fewer than 40% of its weighted checks are measurable.",
                "AI signal output is described as an index, not a probability. Authorship is never inferred.",
                "Raw HTML and full inline scripts are analyzed transiently and excluded from reports and shares.",
              ]}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              <Badge tone="cyan">
                <LockKeyhole size={10} aria-hidden="true" /> SSRF-guarded fetching
              </Badge>
              <Badge tone="cyan">
                <Scale size={10} aria-hidden="true" /> Coverage-aware scoring
              </Badge>
              <Badge tone="cyan">
                <BookOpen size={10} aria-hidden="true" /> Reproducible rules
              </Badge>
            </div>
          </Section>

          <Section
            id="scores"
            eyebrow="02 · Scoring model"
            title="Weighted checks, explicit coverage."
          >
            <P>{SCORE_METHODOLOGIES.category}</P>
            <Formula>
              score = round(earned / availableWeight × 100){"\n"}coverage = availableWeight /
              allScoredWeight × 100
            </Formula>
            <P>
              Grades follow fixed thresholds: A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, E ≥ 50, F &lt; 50. A
              grade is shown only when a score exists.
            </P>
            <P>
              A check marked <strong>pass</strong> earns its full weight, <strong>warn</strong>{" "}
              earns 50%, and <strong>fail</strong> earns 0%. <strong>Info</strong> and{" "}
              <strong>unavailable</strong> checks earn nothing; unavailable checks still count
              against coverage. Every check is labelled <strong>measured</strong> or{" "}
              <strong>heuristic</strong>.
            </P>
          </Section>

          <Section
            id="ai-signals"
            eyebrow="03 · AI signals"
            title="A weighted evidence index. Not a probability."
          >
            <P>{SCORE_METHODOLOGIES.ai}</P>
            <Formula>
              adjusted = max(0, positiveWeight − contradictions × 0.5){"\n"}strong: adjusted ≥ 40
              AND at least one strong builder-specific signal{"\n"}moderate: adjusted ≥ 24{"\n"}
              weak: adjusted ≥ 7{"\n"}mixed: contradictions ≥ 75% of positive weight
            </Formula>
            <P>
              Evidence is grouped into builder-specific markers, source-pattern observations and
              circumstantial signals. Contradictions are reported separately and reduce the index.
              Confidence reflects the breadth and independence of evidence, not the chance that AI
              was used.
            </P>
            <List
              items={[
                "AI-native builders (for example, tools that generate and publish sites) are stronger evidence than generic framework signatures.",
                "A generic website builder is not treated as proof of AI authorship.",
                "Missing or weak signals do not mean a site was hand-written; most AI-assisted code leaves no reliable frontend fingerprint.",
                "The report never names a model, author or team.",
              ]}
            />
            <Alert tone="warn" title="No authorship claims">
              This category answers “what AI-development signals are observable on this page?”. It
              cannot answer “who wrote this?” or “what percentage was AI-generated?”.
            </Alert>
          </Section>

          <Section
            id="technology"
            eyebrow="04 · Technology intelligence"
            title="Evidence-weighted detection confidence."
          >
            <P>{SCORE_METHODOLOGIES.technologyConfidence}</P>
            <Formula>confidence = min(98, round(100 × (1 − e^(−Σ evidence weights / 38))))</Formula>
            <P>
              Fingerprints are matched against response headers, asset URLs, inline markers, meta
              tags, DOM attributes and bounded library artifacts. Each detection lists its evidence
              and confidence. The aggregate is the arithmetic mean of detected technology
              confidences; coverage is the share at or above 50 confidence.
            </P>
            <P>
              Detection certainty is not a judgment of quality, security or modernity. Backend
              technologies without observable artifacts are usually missed.
            </P>
          </Section>

          <Section id="security" eyebrow="05 · Security" title="Passive configuration review.">
            <P>{SCORE_METHODOLOGIES.security}</P>
            <List
              items={[
                "HTTPS transport and redirect behavior",
                "Content-Security-Policy, HSTS, frame protection, MIME sniffing protection, referrer policy and permissions policy",
                "Cookie attributes visible in Set-Cookie response headers (summarized; cookies are never stored or forwarded)",
                "Mixed-content references and publicly visible exposed configuration patterns",
                "Server disclosure and other passive header hints",
              ]}
            />
            <P>
              No exploitation, payload injection, authentication bypass, fuzzing, port scanning of
              the host, or vulnerability verification occurs. A clean report is not a penetration
              test and does not prove the absence of vulnerabilities.
            </P>
          </Section>

          <Section
            id="performance"
            eyebrow="06 · Performance"
            title="Server-observed timing, not field data."
          >
            <P>{SCORE_METHODOLOGIES.performance}</P>
            <P>
              The analyzer records the server-side fetch duration, response size, redirect chain,
              asset probe results and, in extension snapshot mode, real
              `PerformanceNavigationTiming` values supplied by the browser. Estimates are never
              presented as measurements. Core Web Vitals (LCP, INP, CLS) are not inferred from
              markup.
            </P>
            <P>
              Results are specific to the API instance's network location and the time of the scan.
              CDN caching and regional routing can change them between runs.
            </P>
          </Section>

          <Section
            id="quality"
            eyebrow="07 · Code quality"
            title="Structural signals with bounded samples."
          >
            <P>
              The source analyzer computes structural facts: HTML size and truncation, node count,
              maximum nesting depth, script and stylesheet counts, inline script count, third-party
              domains, repeated structural signatures, duplicate IDs, comments and source maps.
              Short sanitized samples may be inspected in memory; the public report retains only
              structural facts and bounded evidence snippets.
            </P>
            <P>
              Repeated structures may reflect templating, a CMS, a component library or generated
              output. They are not evidence of authorship or a substitute for source-code review.
            </P>
          </Section>

          <Section
            id="accessibility"
            eyebrow="08 · Accessibility"
            title="Detectable markup issues only."
          >
            <P>{SCORE_METHODOLOGIES.accessibility}</P>
            <List
              items={[
                "Image alt attributes and empty-alt handling",
                "Form labels and accessible names for controls",
                "Heading order and presence of a primary heading",
                "Landmarks, language, document title and link naming",
                "Duplicate IDs and basic ARIA misuse where detectable",
              ]}
            />
            <P>
              Contrast, focus order, keyboard traps, motion preferences and screen-reader behavior
              require a rendered browser and human review. Automated results should be treated as a
              starting point, not a compliance certification.
            </P>
          </Section>

          <Section id="seo" eyebrow="09 · SEO" title="Metadata and crawl hints.">
            <P>{SCORE_METHODOLOGIES.seo}</P>
            <List
              items={[
                "Title, meta description, canonical URL and robots directives",
                "Heading hierarchy and indexable content markers",
                "Open Graph and structured-data presence",
                "robots.txt and sitemap.xml availability through single bounded requests",
              ]}
            />
            <P>
              No site crawling, backlink analysis, keyword research or ranking prediction is
              performed. Sitemap and robots probes validate availability, not every listed URL.
            </P>
          </Section>

          <Section id="ssrf" eyebrow="10 · Fetch security" title="Every outbound hop is validated.">
            <P>
              Scanning a user-supplied URL makes the server an SSRF risk. VibeTrace validates
              targets before any request and pins the resolved address for the connection:
            </P>
            <List
              items={[
                "Only http and https schemes are accepted; credentials in URLs are rejected.",
                "Hostnames such as localhost, metadata services, Kubernetes service names and internal-only suffixes are blocked.",
                "DNS is resolved first, then every answer is checked. Loopback, private, link-local, multicast, unspecified, documentation, NAT64, 6to4 and Teredo ranges are rejected; IPv4-mapped IPv6 is unwrapped.",
                "The validated IP is pinned for the actual connection through a custom undici DNS lookup, preventing DNS rebinding.",
                "Redirects are followed manually, with scheme, hostname, DNS and IP validation repeated on every hop.",
                "Only ports 80 and 443 are allowed by default; the allowlist is configurable.",
                "Response size, redirect count, asset probes, request duration and total scan duration are bounded.",
                "Cookies, authorization headers and credentials are never forwarded. Set-Cookie is summarized and stripped.",
              ]}
            />
            <Formula>
              default limits: 5 redirects · 3 MiB HTML · 4 asset probes · 45 s scan · ports 80,443
            </Formula>
            <P>
              Limits are enforced by the API configuration and can be tightened. They are documented
              in <code className="vt-mono">.env.example</code>.
            </P>
          </Section>

          <Section
            id="extension"
            eyebrow="11 · Browser extension"
            title="Minimum access, sanitized snapshot."
          >
            <P>
              The Chrome MV3 extension analyzes the active tab without asking for credentials. Its
              content script reads meta tags, script and stylesheet references, structural DOM
              counts, headings, image sources, labels, inline style/script samples and navigation
              timing. It excludes form values, password fields, cookies, local storage, session
              storage, browsing history and key events.
            </P>
            <List
              items={[
                "Manifest V3 service worker coordinates scans and API calls.",
                "Host access is optional and requested only for the tab you choose to analyze.",
                "The snapshot is capped at 600 KB of HTML and bounded sample arrays before transmission.",
                "The same API and analysis pipeline used by the web app produces the report; snapshot mode marks header-based checks unavailable.",
                "No page content is sent anywhere except the configured VibeTrace API.",
              ]}
            />
            <P>
              The extension opens completed reports on the website. It does not run background
              browsing analysis or collect history.
            </P>
          </Section>

          <Section
            id="api"
            eyebrow="12 · API & exports"
            title="Versioned, validated, and explicit."
          >
            <P>
              The API is versioned under <code className="vt-mono">/api/v1</code>. Scan creation
              returns 202 with a status URL; reports move through queued, running, completed,
              partially completed or failed. Requests are validated with shared Zod schemas, receive
              request IDs, are rate limited, and return a consistent error envelope.
            </P>
            <P>
              Reports are validated against the shared schema before storage. Exports include
              validated JSON, a plain-text summary, and browser print-to-PDF. Public sharing is
              opt-in and token-based; tokens are random, revocable, and exclude raw source. Shared
              reports do not expose private scan metadata beyond the report itself.
            </P>
            <P>
              OpenAPI: <code className="vt-mono">GET /api/v1/openapi.json</code> · interactive route
              index: <code className="vt-mono">GET /api/v1/docs</code>. The optional AI explanation
              endpoint is disabled unless configured and requires explicit consent from the client.
            </P>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              <Link to="/privacy" className="vt-button vt-button--secondary vt-button--sm">
                Privacy policy
              </Link>
              <a
                href="/api/v1/openapi.json"
                target="_blank"
                rel="noreferrer"
                className="vt-button vt-button--ghost vt-button--sm"
              >
                OpenAPI JSON <ArrowUpRight size={12} aria-hidden="true" />
              </a>
            </div>
          </Section>

          <p
            className="vt-mono"
            style={{
              margin: "2px 4px 22px",
              fontSize: 9,
              color: "var(--vt-text-faint)",
              letterSpacing: "0.06em",
            }}
          >
            METHODOLOGY VERSION 0.1.0 · LAST UPDATED {updated.toUpperCase()} ·{" "}
            <Link to="/privacy" style={{ color: "var(--vt-lime)" }}>
              DATA HANDLING
            </Link>
          </p>
          <p style={{ margin: "0 4px 24px", fontSize: 11, color: "var(--vt-text-faint)" }}>
            <Chrome size={11} style={{ display: "inline", marginRight: 4 }} aria-hidden="true" />
            Extension details reflect the bundled Manifest V3 build in this repository.
          </p>
        </div>
      </div>
    </div>
  );
}
