import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { Terminal } from "lucide-react";
import { Logo } from "./Logo.js";

const columns = [
  {
    title: "Product",
    links: [
      { to: "/scan", label: "Scanner" },
      { to: "/history", label: "Scan history" },
      { to: "/methodology", label: "Methodology" },
    ],
  },
  {
    title: "Report areas",
    links: [
      { to: "/methodology#ai-signals", label: "AI signal detection" },
      { to: "/methodology#security", label: "Passive security" },
      { to: "/methodology#performance", label: "Performance" },
    ],
  },
  {
    title: "Legal & trust",
    links: [
      { to: "/privacy", label: "Privacy policy" },
      { to: "/methodology#ssrf", label: "Fetch protections" },
      { to: "/settings", label: "Settings" },
    ],
  },
] as const;

export function Footer(): ReactNode {
  return (
    <footer
      data-app-footer
      style={{
        marginTop: "clamp(40px, 7vw, 80px)",
        borderTop: "1px solid var(--vt-border)",
        background: "var(--vt-black)",
      }}
    >
      <div className="container-page" style={{ paddingBlock: "42px 26px" }}>
        <div
          className="grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]"
          style={{ gap: 28 }}
        >
          <div>
            <Logo />
            <p
              style={{
                margin: "14px 0 0",
                maxWidth: 330,
                color: "var(--vt-text-muted)",
                fontSize: 13,
              }}
            >
              Evidence-first website forensics for AI-era builds. Analyze public pages, inspect the
              signals, and read the limitations before drawing conclusions.
            </p>
            <p
              className="vt-mono"
              style={{
                margin: "16px 0 0",
                fontSize: 10,
                letterSpacing: "0.08em",
                color: "var(--vt-text-faint)",
              }}
            >
              NO ACCOUNTS · NO COOKIE FORWARDING · OPT-IN SHARING
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <h2
                className="vt-mono"
                style={{
                  margin: 0,
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--vt-text-faint)",
                }}
              >
                {column.title}
              </h2>
              <ul
                style={{
                  listStyle: "none",
                  margin: "12px 0 0",
                  padding: 0,
                  display: "grid",
                  gap: 8,
                }}
              >
                {column.links.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to} className="link-quiet" style={{ fontSize: 13 }}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            marginTop: 36,
            paddingTop: 18,
            borderTop: "1px solid var(--vt-border)",
            color: "var(--vt-text-faint)",
            fontSize: 11,
          }}
        >
          <span className="vt-mono">© {new Date().getFullYear()} VibeTrace · v0.1.0</span>
          <span
            className="vt-mono"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Terminal size={12} aria-hidden="true" /> Self-hostable analysis engine · shared web +
            extension pipeline
          </span>
        </div>
      </div>
    </footer>
  );
}
