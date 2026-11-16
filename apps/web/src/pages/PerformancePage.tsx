import { Link } from "react-router-dom";
import { Activity, Gauge, Timer } from "lucide-react";
import { Alert, Badge, Card } from "@vibetrace/design-system";
import { ReportGate, ReportSectionIntro } from "../components/report/ReportFrame.js";
import { CheckList, SectionMethodology } from "../components/report/CheckList.js";
import { MetricGrid, RecommendationList } from "../components/report/Metrics.js";

export function PerformancePage(): React.ReactNode {
  return (
    <ReportGate page="Performance">
      {(report) => {
        const section = report.sections.performance;
        const score = report.scores.performance;
        const measured = section.metrics.filter((metric) => metric.measured);
        const unavailable = section.metrics.filter((metric) => !metric.measured);
        const recommendations = report.recommendations.filter(
          (item) => item.area === "performance",
        );

        return (
          <div style={{ display: "grid", gap: 16 }}>
            <ReportSectionIntro
              eyebrow="Performance evidence"
              title="Measured where possible. Withheld where not."
              description={section.summary}
              score={score.score}
              coverage={score.coverage}
              grade={score.grade}
              icon={<Gauge size={12} aria-hidden="true" />}
            />

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)]">
              <Card style={{ padding: "16px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <Timer size={14} style={{ color: "var(--vt-lime)" }} aria-hidden="true" />
                  <h2 style={{ margin: 0, fontSize: 13 }}>What this scan can and cannot measure</h2>
                </div>
                <p style={{ margin: "7px 0 0", fontSize: 12, color: "var(--vt-text-muted)" }}>
                  Server-side timings describe this API's fetch path, including DNS, TLS and
                  transfer. They are not field Core Web Vitals and do not represent every user's
                  network or device. Browser-only metrics are marked unavailable unless a browser
                  extension snapshot supplies real navigation timing.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
                  <Badge tone="lime">{measured.length} measured</Badge>
                  <Badge>{unavailable.length} unavailable</Badge>
                  <Badge tone="cyan">
                    {section.score.checks.filter((check) => check.basis === "heuristic").length}{" "}
                    heuristic checks
                  </Badge>
                </div>
              </Card>
              <Card style={{ padding: "16px 18px" }}>
                <span
                  className="vt-mono"
                  style={{
                    fontSize: 9,
                    letterSpacing: "0.1em",
                    color: "var(--vt-text-faint)",
                    textTransform: "uppercase",
                  }}
                >
                  Coverage
                </span>
                <div
                  style={{ marginTop: 8, fontSize: 32, fontWeight: 650, color: "var(--vt-lime)" }}
                >
                  {Math.round(score.coverage)}%
                </div>
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--vt-text-muted)" }}>
                  of weighted performance checks were measurable. The score is suppressed below 40%
                  coverage.
                </p>
              </Card>
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                <Activity size={14} style={{ color: "var(--vt-cyan)" }} aria-hidden="true" />
                <h2 style={{ margin: 0, fontSize: 15 }}>Measurements</h2>
              </div>
              <MetricGrid metrics={section.metrics} />
            </div>

            <CheckList section={section} showFilters />

            {unavailable.length ? (
              <Alert tone="info" title="Unavailable metrics are not zeros">
                {unavailable.map((metric) => metric.label).join(", ")} could not be measured from
                this scan. They are excluded from earning points but still reduce coverage where the
                check carries weight.
              </Alert>
            ) : null}

            <SectionMethodology section={section} />

            <div>
              <h2 style={{ margin: "0 0 8px", fontSize: 15 }}>Performance recommendations</h2>
              <RecommendationList items={recommendations} />
            </div>

            <p
              className="vt-mono"
              style={{
                margin: 0,
                fontSize: 9,
                color: "var(--vt-text-faint)",
                letterSpacing: "0.04em",
              }}
            >
              No Lighthouse, CrUX or synthetic browser benchmark is implied. Read the{" "}
              <Link to="/methodology#performance" style={{ color: "var(--vt-lime)" }}>
                performance methodology
              </Link>
              .
            </p>
          </div>
        );
      }}
    </ReportGate>
  );
}
