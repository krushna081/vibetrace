import { Link } from "react-router-dom";
import { ArrowLeft, Radar } from "lucide-react";
import { Card, PageHeader } from "@vibetrace/design-system";
import { usePageTitle } from "../hooks/use-api.js";

export function NotFoundPage(): React.ReactNode {
  usePageTitle("Page not found");
  return (
    <div>
      <PageHeader
        eyebrow="404"
        title="This route left no trace."
        description="The page may have moved, the scan id may be invalid, or the link may be incomplete."
      />
      <Card raised style={{ padding: "clamp(24px, 5vw, 44px)", textAlign: "center" }}>
        <Radar size={34} style={{ color: "var(--vt-lime)" }} aria-hidden="true" />
        <p
          style={{
            margin: "14px auto 0",
            maxWidth: 480,
            color: "var(--vt-text-muted)",
            fontSize: 13,
          }}
        >
          Try the scanner, inspect stored scans, or read the scoring methodology. No fake dashboard
          will be rendered in place of the missing page.
        </p>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 8,
            marginTop: 18,
          }}
        >
          <Link to="/scan" className="vt-button vt-button--primary vt-button--sm">
            New scan
          </Link>
          <Link to="/history" className="vt-button vt-button--secondary vt-button--sm">
            Scan history
          </Link>
          <Link to="/" className="vt-button vt-button--ghost vt-button--sm">
            <ArrowLeft size={13} aria-hidden="true" /> Home
          </Link>
        </div>
      </Card>
    </div>
  );
}
