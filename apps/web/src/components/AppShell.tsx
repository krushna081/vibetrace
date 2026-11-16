import { Outlet } from "react-router-dom";
import type { ReactNode } from "react";
import { Header } from "./Header.js";
import { Footer } from "./Footer.js";

export function AppShell(): ReactNode {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <a className="vt-skip-link" href="#main-content">
        Skip to content
      </a>
      <Header />
      <main
        id="main-content"
        className="container-page"
        style={{ flex: 1, paddingBlock: "28px 0" }}
      >
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export function ReportShell(): ReactNode {
  return (
    <div
      className="print-shell"
      style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}
    >
      <a className="vt-skip-link" href="#main-content">
        Skip to content
      </a>
      <Header />
      <main
        id="main-content"
        className="container-page"
        style={{ flex: 1, paddingBlock: "28px 0" }}
      >
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
