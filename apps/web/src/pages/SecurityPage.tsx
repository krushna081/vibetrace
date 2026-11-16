import { Link } from "react-router-dom";
import { AlertTriangle, LockKeyhole, ShieldCheck } from "lucide-react";
import { Alert, Badge, Card } from "@vibetrace/design-system";
import { ReportGate, ReportSectionIntro } from "../components/report/ReportFrame.js";
import { CheckList, SectionMethodology } from "../components/report/CheckList.js";
import { MetricGrid, RecommendationList } from "../components/report/Metrics.js";

export function SecurityPage(): React.ReactNode {
  return (
    <ReportGate page="Security">
      {(report) => {
        const section = report.sections.security;
        const score = report.scores.security;
        const counts = {
          pass: score.checks.filter((check) => check.status === "pass").length,
          warn: score.checks.filter((check) => check.status === "warn").length,
          fail: score.checks.filter((check) => check.status === "fail").length,
          unavailable: score.checks.filter((check) => check.status === "unavailable").length,
        };
        const recommendations = report.recommendations.filter((item) => item.area === "security");
        return (
          <div style={{ display: "grid", gap: 16 }}>
            <ReportSectionIntro
              eyebrow="Passive security posture"
              title="Security configuration, not exploitation"
              description={section.summary}
              score={score.score}
              coverage={score.coverage}
              grade={score.grade}
              icon={<ShieldCheck size={12} aria-hidden="true" />}
            />

            <Alert tone="warn" title="Passive observation only">
              VibeTrace does not attempt exploitation, injection, authentication bypass, fuzzing or
              vulnerability discovery. It observes publicly visible configuration: HTTPS transport,
              response headers, cookie attributes, mixed content and exposed hints. Absence of a
              finding is not a clean security bill.
            </Alert>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Passed", value: counts.pass, tone: "lime" as const },
                { label: "Warnings", value: counts.warn, tone: "amber" as const },
                { label: "Failed", value: counts.fail, tone: "red" as const },
                { label: "Unavailable", value: counts.unavailable, tone: "neutral" as const },
              ].map((item) => (
                <Card key={item.label} style={{ padding: "14px 16px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span
                      className="vt-mono"
                      style={{
                        fontSize: 9,
                        letterSpacing: "0.1em",
                        color: "var(--vt-text-faint)",
                        textTransform: "uppercase",
                      }}
                    >
                      {item.label}
                    </span>
                    <Badge tone={item.tone}>{item.value}</Badge>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 22, fontWeight: 650 }}>{item.value}</div>
                </Card>
              ))}
            </div>

            <MetricGrid metrics={section.metrics} />
            <CheckList section={section} showFilters />
            <SectionMethodology section={section} />

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                <LockKeyhole size={14} style={{ color: "var(--vt-lime)" }} aria-hidden="true" />
                <h2 style={{ margin: 0, fontSize: 15 }}>Security recommendations</h2>
              </div>
              <RecommendationList items={recommendations} />
            </div>

            <Card style={{ padding: "14px 16px", borderLeft: "2px solid var(--vt-amber)" }}>
              <div style={{ display: "flex", gap: 9 }}>
                <AlertTriangle
                  size={15}
                  style={{ flex: "0 0 auto", color: "var(--vt-amber)", marginTop: 1 }}
                  aria-hidden="true"
                />
                <p style={{ margin: 0, fontSize: 12, color: "var(--vt-text-muted)" }}>
                  Header checks can be affected by CDNs and edge proxies. A missing header may be
                  injected upstream in production, and a present header may not apply to every
                  route. Scan each public surface you care about. Read the full{" "}
                  <Link to="/methodology#security" style={{ color: "var(--vt-lime)" }}>
                    security methodology
                  </Link>
                  .
                </p>
              </div>
            </Card>
          </div>
        );
      }}
    </ReportGate>
  );
}
