import { motion } from "framer-motion";
import {
  Accessibility,
  ArrowRight,
  BrainCircuit,
  Chrome,
  Fingerprint,
  Gauge,
  GitCompareArrows,
  Layers3,
  LockKeyhole,
  ScanLine,
  ShieldCheck,
  Sparkles,
  SquareTerminal,
  TextSearch,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, Terminal, TerminalLine } from "@vibetrace/design-system";
import { ScanForm } from "../components/ScanForm.js";
import { usePageTitle } from "../hooks/use-api.js";

const fade = {
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
};

const SIGNALS = [
  {
    icon: BrainCircuit,
    title: "AI development signals",
    body: "Weighted evidence from builder markers, framework defaults, generated comments and source patterns — with contradictions surfaced, not hidden.",
    to: "/methodology#ai-signals",
  },
  {
    icon: Fingerprint,
    title: "Technology intelligence",
    body: "Inspectable fingerprints across frameworks, hosts, analytics, CMSs and infrastructure. Every detection carries confidence and evidence.",
    to: "/methodology#technology",
  },
  {
    icon: ShieldCheck,
    title: "Passive security posture",
    body: "HTTPS, headers, cookie attributes, mixed content and exposed configuration patterns observed without exploit attempts.",
    to: "/methodology#security",
  },
  {
    icon: Gauge,
    title: "Performance evidence",
    body: "Server-side fetch timing and response measurements. Browser metrics stay unavailable unless the extension supplies real navigation timing.",
    to: "/methodology#performance",
  },
  {
    icon: Sparkles,
    title: "Code quality structure",
    body: "Source shape, script weight, duplication, comments and structural signals — analyzed from markup, never republished as raw source.",
    to: "/methodology#quality",
  },
  {
    icon: Accessibility,
    title: "Accessibility markup",
    body: "Automated checks for detectable issues such as alt text, labels, heading order and landmarks, with honest coverage limits.",
    to: "/methodology#accessibility",
  },
  {
    icon: TextSearch,
    title: "SEO foundations",
    body: "Canonical metadata, crawl hints, structured data and robots/sitemap probes — bounded, single-request checks.",
    to: "/methodology#seo",
  },
];

const REFUSALS = [
  "Claim a probability that a site was built with AI.",
  "Identify an author, team, or model behind a page.",
  "Call a static markup scan a full security audit.",
  "Present browser-only metrics as server measurements.",
  "Invent a score when coverage is too low to support one.",
  "Return a borrowed template full of invented statistics.",
];

export function LandingPage(): React.ReactNode {
  usePageTitle("Website forensics for AI-era builds");

  return (
    <div>
      <section
        className="technical-grid"
        style={{
          position: "relative",
          marginTop: -28,
          paddingTop: 54,
          paddingBottom: 42,
          overflow: "hidden",
        }}
      >
        <div className="hero-glow" />
        <div
          style={{ position: "relative" }}
          className="grid gap-9 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center"
        >
          <motion.div {...fade}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
              <Badge tone="lime">
                <span className="live-dot" aria-hidden="true" /> Evidence-first analysis
              </Badge>
              <Badge>Web + Chrome extension</Badge>
            </div>
            <h1
              className="text-balance"
              style={{
                margin: 0,
                fontSize: "clamp(38px, 7.2vw, 68px)",
                lineHeight: 0.98,
                letterSpacing: "-0.055em",
                fontWeight: 650,
              }}
            >
              Read the signals.
              <br />
              <span style={{ color: "var(--vt-lime)" }}>Verify the vibe.</span>
            </h1>
            <p
              style={{
                maxWidth: 590,
                margin: "18px 0 0",
                color: "var(--vt-text-muted)",
                fontSize: "clamp(14px, 1.8vw, 17px)",
                lineHeight: 1.65,
              }}
            >
              VibeTrace inspects public websites for AI-development fingerprints, technology
              choices, passive security posture, performance evidence, code structure, SEO and
              accessibility. Every score is traceable to observations — and every limitation is
              written down.
            </p>

            <div style={{ maxWidth: 640, marginTop: 24 }}>
              <ScanForm variant="hero" />
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 18px", marginTop: 16 }}>
              {[
                { icon: LockKeyhole, text: "SSRF-guarded fetches" },
                { icon: ScanLine, text: "No cookies forwarded" },
                { icon: GitCompareArrows, text: "Compare two scans" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <span
                    key={item.text}
                    className="vt-mono"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 10,
                      color: "var(--vt-text-faint)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    <Icon size={12} aria-hidden="true" /> {item.text}
                  </span>
                );
              })}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          >
            <Terminal
              title="vibetrace / analysis pipeline"
              footer="Observed behavior, not a sample scan result."
            >
              <TerminalLine prompt="$" tone="lime">
                vibetrace inspect &lt;public-url&gt;
              </TerminalLine>
              <TerminalLine prompt="01" tone="muted">
                url guard{" "}
                <span style={{ color: "var(--vt-text-faint)" }}>
                  · scheme, DNS, public IP, port
                </span>
              </TerminalLine>
              <TerminalLine prompt="02" tone="muted">
                safe fetch{" "}
                <span style={{ color: "var(--vt-text-faint)" }}>
                  · redirects revalidated, size + time caps
                </span>
              </TerminalLine>
              <TerminalLine prompt="03" tone="muted">
                fingerprint{" "}
                <span style={{ color: "var(--vt-text-faint)" }}>
                  · headers, assets, DOM, source patterns
                </span>
              </TerminalLine>
              <TerminalLine prompt="04" tone="muted">
                score{" "}
                <span style={{ color: "var(--vt-text-faint)" }}>
                  · coverage-aware, weighted checks
                </span>
              </TerminalLine>
              <TerminalLine prompt="05" tone="muted">
                report{" "}
                <span style={{ color: "var(--vt-text-faint)" }}>
                  · evidence, contradictions, limits
                </span>
              </TerminalLine>
              <div
                style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--vt-border)" }}
              >
                <TerminalLine prompt=">" tone="lime">
                  report ready
                  <span
                    aria-hidden="true"
                    style={{
                      display: "inline-block",
                      width: 7,
                      height: 12,
                      marginLeft: 6,
                      background: "var(--vt-lime)",
                      verticalAlign: "-2px",
                      animation: "live-pulse 1.6s steps(2) infinite",
                    }}
                  />
                </TerminalLine>
              </div>
            </Terminal>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
              <div className="vt-card" style={{ padding: "10px 12px" }}>
                <span
                  className="vt-mono"
                  style={{
                    fontSize: 9,
                    letterSpacing: "0.1em",
                    color: "var(--vt-text-faint)",
                    textTransform: "uppercase",
                  }}
                >
                  Output
                </span>
                <p style={{ margin: "4px 0 0", fontSize: 12 }}>
                  Validated JSON + print-ready report
                </p>
              </div>
              <div className="vt-card" style={{ padding: "10px 12px" }}>
                <span
                  className="vt-mono"
                  style={{
                    fontSize: 9,
                    letterSpacing: "0.1em",
                    color: "var(--vt-text-faint)",
                    textTransform: "uppercase",
                  }}
                >
                  Storage
                </span>
                <p style={{ margin: "4px 0 0", fontSize: 12 }}>
                  Memory by default, PostgreSQL optional
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <motion.section {...fade} className="page-section" style={{ paddingTop: 44 }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 22,
          }}
        >
          <div style={{ maxWidth: 640 }}>
            <span className="vt-eyebrow">Seven independent lenses</span>
            <h2
              style={{
                margin: "10px 0 0",
                fontSize: "clamp(25px, 4vw, 38px)",
                lineHeight: 1.08,
                letterSpacing: "-0.04em",
              }}
            >
              One scan. Separate scores.
              <br />
              No composite illusion.
            </h2>
            <p style={{ margin: "10px 0 0", color: "var(--vt-text-muted)", fontSize: 14 }}>
              A security score is not a quality score. An AI signal index is not a trust score. Each
              category is computed from its own checks, with its own coverage.
            </p>
          </div>
          <Link to="/methodology" className="vt-button vt-button--secondary vt-button--sm">
            Read the methodology <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(250px, 100%), 1fr))",
            gap: 10,
          }}
        >
          {SIGNALS.map((signal) => {
            const Icon = signal.icon;
            return (
              <Link
                key={signal.title}
                to={signal.to}
                className="vt-card"
                style={{
                  padding: "18px 18px 16px",
                  textDecoration: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  minHeight: 172,
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
                >
                  <span
                    style={{
                      display: "grid",
                      placeItems: "center",
                      width: 32,
                      height: 32,
                      border: "1px solid var(--vt-border)",
                      borderRadius: 7,
                      background: "var(--vt-graphite)",
                      color: "var(--vt-lime)",
                    }}
                  >
                    <Icon size={15} aria-hidden="true" />
                  </span>
                  <ArrowRight
                    size={13}
                    style={{ color: "var(--vt-text-faint)" }}
                    aria-hidden="true"
                  />
                </div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 650 }}>{signal.title}</h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: "var(--vt-text-muted)",
                    lineHeight: 1.6,
                  }}
                >
                  {signal.body}
                </p>
              </Link>
            );
          })}
          <Link
            to="/methodology"
            className="vt-card"
            style={{
              padding: "18px",
              textDecoration: "none",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              borderStyle: "dashed",
              minHeight: 172,
            }}
          >
            <Layers3 size={18} style={{ color: "var(--vt-lime)" }} aria-hidden="true" />
            <div>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 650 }}>Full methodology</h3>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--vt-text-muted)" }}>
                Formulas, weights, classifier thresholds and fetch protections.
              </p>
            </div>
          </Link>
        </div>
      </motion.section>

      <motion.section {...fade} className="page-section" style={{ paddingTop: 8 }}>
        <div className="vt-card vt-card-raised" style={{ padding: "clamp(22px, 4vw, 38px)" }}>
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <span className="vt-eyebrow">What this is not</span>
              <h2
                style={{
                  margin: "10px 0 0",
                  fontSize: "clamp(24px, 4vw, 34px)",
                  lineHeight: 1.1,
                  letterSpacing: "-0.04em",
                }}
              >
                Calibrated curiosity.
                <br />
                Not confident fiction.
              </h2>
              <p style={{ color: "var(--vt-text-muted)", fontSize: 14, maxWidth: 480 }}>
                AI-assisted development often leaves no reliable frontend fingerprint. VibeTrace
                treats that as a finding, not a failure. You get observed signals, contradictions,
                coverage and explicit uncertainty.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
                <Link
                  to="/methodology#ai-signals"
                  className="vt-button vt-button--primary vt-button--sm"
                >
                  How AI detection works <ArrowRight size={14} aria-hidden="true" />
                </Link>
                <Link to="/privacy" className="vt-button vt-button--ghost vt-button--sm">
                  Data handling
                </Link>
              </div>
            </div>
            <div>
              <div
                className="vt-mono"
                style={{
                  fontSize: 9,
                  letterSpacing: "0.12em",
                  color: "var(--vt-text-faint)",
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                VibeTrace refuses to
              </div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
                {REFUSALS.map((item, index) => (
                  <li
                    key={item}
                    style={{
                      display: "flex",
                      gap: 10,
                      padding: "9px 11px",
                      border: "1px solid var(--vt-border)",
                      borderRadius: 6,
                      background: "var(--vt-black)",
                      color: "var(--vt-text-muted)",
                      fontSize: 12,
                    }}
                  >
                    <span className="vt-mono" style={{ color: "var(--vt-red)", fontSize: 10 }}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section {...fade} className="page-section" style={{ paddingTop: 8 }}>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="vt-card" style={{ padding: "24px" }}>
            <span className="vt-eyebrow">Browser-side analysis</span>
            <h2 style={{ margin: "10px 0 0", fontSize: 24, letterSpacing: "-0.03em" }}>
              Analyze the page you are already on.
            </h2>
            <p style={{ color: "var(--vt-text-muted)", fontSize: 13 }}>
              The MV3 extension reads a sanitized snapshot of the current tab: meta tags, script and
              stylesheet references, structural counts and safe inline samples. It never reads
              passwords, form values, cookies or browsing history. The same backend and engine
              produce the report.
            </p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
              <Badge tone="cyan">
                <Chrome size={11} aria-hidden="true" /> Manifest V3
              </Badge>
              <Badge>Optional host access</Badge>
              <Badge>Snapshot mode</Badge>
            </div>
            <Link
              to="/methodology#extension"
              className="vt-button vt-button--secondary vt-button--sm"
              style={{ marginTop: 16 }}
            >
              Extension architecture <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          <div className="vt-card" style={{ padding: "24px" }}>
            <span className="vt-eyebrow">Evidence at every layer</span>
            <h2 style={{ margin: "10px 0 0", fontSize: 24, letterSpacing: "-0.03em" }}>
              Reports you can audit.
            </h2>
            <p style={{ color: "var(--vt-text-muted)", fontSize: 13 }}>
              Expand any check to see its basis, weight, observed evidence and recommendation.
              Export the validated JSON, copy a summary, print to PDF, or opt in to a revocable
              public link. Compare two scans side by side with historical scores kept separate.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 6,
                marginTop: 14,
              }}
            >
              {["JSON", "PDF", "Share", "Copy", "Compare", "History"].map((item) => (
                <span
                  key={item}
                  className="vt-mono"
                  style={{
                    padding: "7px 8px",
                    border: "1px solid var(--vt-border)",
                    borderRadius: 4,
                    textAlign: "center",
                    fontSize: 9,
                    color: "var(--vt-text-muted)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section {...fade} className="page-section" style={{ paddingTop: 12 }}>
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            border: "1px solid var(--vt-border-strong)",
            borderRadius: 14,
            background: "linear-gradient(135deg, var(--vt-panel-raised), var(--vt-panel))",
            padding: "clamp(24px, 5vw, 48px)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: "auto 0 -50% 0",
              height: 320,
              background:
                "radial-gradient(ellipse at center, var(--vt-lime-glow), transparent 65%)",
              pointerEvents: "none",
            }}
          />
          <div style={{ position: "relative", maxWidth: 620, margin: "0 auto" }}>
            <span className="vt-eyebrow" style={{ justifyContent: "center" }}>
              Start with one public URL
            </span>
            <h2
              style={{
                margin: "10px 0 0",
                fontSize: "clamp(26px, 4.6vw, 42px)",
                lineHeight: 1.06,
                letterSpacing: "-0.045em",
              }}
            >
              See what the page reveals.
              <br />
              See what it does not.
            </h2>
            <p style={{ margin: "10px 0 20px", color: "var(--vt-text-muted)", fontSize: 14 }}>
              No account, no credit card, no fabricated benchmark. A live scan against the target
              you choose.
            </p>
            <ScanForm variant="card" />
          </div>
        </div>
      </motion.section>

      <section style={{ paddingBottom: 36 }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            justifyContent: "center",
            color: "var(--vt-text-faint)",
          }}
        >
          {[
            { icon: SquareTerminal, text: "OpenAPI v1" },
            { icon: LockKeyhole, text: "No credential forwarding" },
            { icon: Chrome, text: "MV3 extension" },
            { icon: GitCompareArrows, text: "Scan comparison" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <span
                key={item.text}
                className="vt-mono"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 9,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                <Icon size={11} aria-hidden="true" /> {item.text}
              </span>
            );
          })}
        </div>
      </section>
    </div>
  );
}
