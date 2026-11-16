import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, Moon, Sun, X } from "lucide-react";
import { Logo } from "./Logo.js";
import { ApiStatus } from "./ApiStatus.js";
import { useSettings } from "../providers/SettingsProvider.js";
import { getApiClient } from "../lib/settings.js";

const NAV = [
  { to: "/scan", label: "Scanner" },
  { to: "/history", label: "History" },
  { to: "/methodology", label: "Methodology" },
] as const;

function navStyle(active: boolean): React.CSSProperties {
  return {
    padding: "7px 10px",
    borderRadius: 6,
    color: active ? "var(--vt-text)" : "var(--vt-text-muted)",
    background: active ? "var(--vt-graphite)" : "transparent",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: active ? 600 : 500,
  };
}

export function Header(): ReactNode {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { resolvedTheme, setTheme } = useSettings();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <header
      data-app-header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        borderBottom: "1px solid var(--vt-border)",
        background: "color-mix(in srgb, var(--vt-void) 88%, transparent)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}
    >
      <div
        className="container-page"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          minHeight: "var(--vt-header-height)",
        }}
      >
        <Logo />

        <nav aria-label="Primary" style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <div className="hidden items-center gap-0.5 md:flex">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} style={({ isActive }) => navStyle(isActive)}>
                {item.label}
              </NavLink>
            ))}
            <a
              href={`${getApiClient().apiBase}/docs`}
              target="_blank"
              rel="noreferrer"
              style={navStyle(false)}
            >
              API
            </a>
          </div>

          <div
            style={{ width: 1, height: 22, margin: "0 10px", background: "var(--vt-border)" }}
            className="hidden md:block"
          />
          <div className="hidden md:flex" style={{ marginRight: 4 }}>
            <ApiStatus />
          </div>

          <button
            type="button"
            className="vt-button vt-button--ghost vt-button--icon"
            aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} theme`}
            title={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} theme`}
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          >
            {resolvedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <Link
            to="/scan"
            className="vt-button vt-button--primary vt-button--sm hidden sm:inline-flex"
            style={{ marginLeft: 6 }}
          >
            New scan
          </Link>

          <button
            type="button"
            className="vt-button vt-button--ghost vt-button--icon md:hidden"
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </nav>
      </div>

      {open ? (
        <div
          id="mobile-nav"
          className="md:hidden"
          style={{
            borderTop: "1px solid var(--vt-border)",
            background: "var(--vt-panel)",
            padding: "12px clamp(16px, 4vw, 40px) 18px",
          }}
        >
          <nav aria-label="Mobile" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                style={({ isActive }) => ({
                  ...navStyle(isActive),
                  padding: "10px 12px",
                })}
              >
                {item.label}
              </NavLink>
            ))}
            <Link to="/scan" className="vt-button vt-button--primary" style={{ marginTop: 10 }}>
              New scan
            </Link>
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--vt-border)" }}>
              <ApiStatus />
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
