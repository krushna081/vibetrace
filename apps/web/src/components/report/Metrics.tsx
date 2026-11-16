import type { ReactNode } from "react";
import { Activity, AlertOctagon, CircleSlash2, Info } from "lucide-react";
import type { Evidence, Metric, Recommendation } from "@vibetrace/shared-types";
import { Badge, Card, EmptyState } from "@vibetrace/design-system";
import { formatNumber, titleCase } from "../../lib/format.js";

export function MetricGrid({ metrics }: { metrics: Metric[] }): ReactNode {
  if (metrics.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No metrics were produced"
          description="This section did not return measurable fields."
        />
      </Card>
    );
  }
  const sorted = [...metrics].sort((a, b) => Number(b.measured) - Number(a.measured));
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(min(180px, 100%), 1fr))",
        gap: 10,
      }}
    >
      {sorted.map((metric) => (
        <div
          key={metric.id}
          className="vt-card"
          style={{
            padding: "13px 14px",
            opacity: metric.measured ? 1 : 0.72,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span
              className="vt-mono"
              style={{
                fontSize: 9,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--vt-text-faint)",
              }}
            >
              {metric.label}
            </span>
            {!metric.measured ? <Badge>N/A</Badge> : null}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 7 }}>
            <span
              style={{
                fontSize: 22,
                fontWeight: 650,
                letterSpacing: "-0.02em",
                color: metric.measured ? "var(--vt-text)" : "var(--vt-text-faint)",
              }}
            >
              {metric.value === null
                ? "—"
                : typeof metric.value === "number"
                  ? formatNumber(metric.value)
                  : metric.value}
            </span>
            {metric.unit ? (
              <span className="vt-mono" style={{ fontSize: 10, color: "var(--vt-text-faint)" }}>
                {metric.unit}
              </span>
            ) : null}
          </div>
          {metric.note ? (
            <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--vt-text-faint)" }}>
              {metric.note}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

const STRENGTH_TONE = {
  strong: "lime",
  moderate: "amber",
  weak: "neutral",
} as const;

export function EvidenceCard({ evidence }: { evidence: Evidence }): ReactNode {
  return (
    <div
      className="vt-card"
      style={{
        padding: "13px 15px",
        borderLeft: `2px solid ${evidence.strength === "strong" ? "var(--vt-lime)" : evidence.strength === "moderate" ? "var(--vt-amber)" : "var(--vt-border-strong)"}`,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 650 }}>{evidence.title}</span>
        <div style={{ display: "flex", gap: 4 }}>
          <Badge tone={STRENGTH_TONE[evidence.strength]}>{evidence.strength}</Badge>
          <Badge>weight {evidence.weight}</Badge>
        </div>
      </div>
      <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--vt-text-muted)" }}>
        {evidence.description}
      </p>
      {evidence.observed ? (
        <div
          className="vt-mono"
          style={{
            marginTop: 8,
            padding: "6px 8px",
            border: "1px solid var(--vt-border)",
            borderRadius: 4,
            background: "var(--vt-black)",
            color: "var(--vt-text-faint)",
            fontSize: 10,
            overflowWrap: "anywhere",
            whiteSpace: "pre-wrap",
            maxHeight: 96,
            overflow: "auto",
          }}
        >
          {evidence.observed}
        </div>
      ) : null}
      <div
        className="vt-mono"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginTop: 8,
          fontSize: 9,
          color: "var(--vt-text-faint)",
          letterSpacing: "0.04em",
        }}
      >
        <span style={{ textTransform: "uppercase" }}>{titleCase(evidence.category)}</span>
        <span>SRC {evidence.source}</span>
      </div>
    </div>
  );
}

export function EvidenceGrid({ evidence }: { evidence: Evidence[] }): ReactNode {
  if (!evidence.length) {
    return (
      <Card>
        <EmptyState
          icon={<CircleSlash2 size={18} />}
          title="No evidence in this group"
          description="An absent signal is not proof of absence. Read the limitations before drawing conclusions."
        />
      </Card>
    );
  }
  return (
    <div className="evidence-grid">
      {[...evidence]
        .sort((a, b) => b.weight - a.weight)
        .map((item) => (
          <EvidenceCard key={item.id} evidence={item} />
        ))}
    </div>
  );
}

const PRIORITY_TONE = { high: "red", medium: "amber", low: "neutral" } as const;

export function RecommendationList({ items }: { items: Recommendation[] }): ReactNode {
  if (!items.length) {
    return (
      <Card>
        <EmptyState
          icon={<Activity size={18} />}
          title="No recommendations"
          description="No weighted check produced an actionable recommendation."
        />
      </Card>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((item) => (
        <div key={item.id} className="vt-card" style={{ padding: "12px 14px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
            <Badge tone={PRIORITY_TONE[item.priority]}>{item.priority}</Badge>
            <Badge>{item.area}</Badge>
            <span style={{ fontSize: 13, fontWeight: 650, marginLeft: 2 }}>{item.title}</span>
          </div>
          <p style={{ margin: "5px 0 0", color: "var(--vt-text-muted)", fontSize: 12 }}>
            {item.detail}
          </p>
        </div>
      ))}
    </div>
  );
}

export function LimitationsPanel({
  limitations,
  partialReason,
}: {
  limitations: string[];
  partialReason?: string | null;
}): ReactNode {
  return (
    <div
      style={{
        border: "1px solid var(--vt-border)",
        borderLeft: "2px solid var(--vt-amber)",
        borderRadius: 8,
        background: "var(--vt-panel)",
        padding: "15px 18px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <AlertOctagon size={15} style={{ color: "var(--vt-amber)" }} aria-hidden="true" />
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 650 }}>Read before interpreting</h3>
      </div>
      {partialReason ? (
        <p style={{ margin: "7px 0 0", color: "var(--vt-amber)", fontSize: 12 }}>{partialReason}</p>
      ) : null}
      {limitations.length ? (
        <ul
          style={{
            margin: "8px 0 0",
            paddingLeft: 18,
            color: "var(--vt-text-muted)",
            fontSize: 12,
          }}
        >
          {limitations.map((item) => (
            <li key={item} style={{ marginBottom: 4 }}>
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ margin: "7px 0 0", color: "var(--vt-text-muted)", fontSize: 12 }}>
          No additional limitations were recorded for this scan.
        </p>
      )}
    </div>
  );
}

export function InfoNote({ children }: { children: ReactNode }): ReactNode {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        padding: "10px 12px",
        border: "1px solid var(--vt-border)",
        borderRadius: 6,
        background: "var(--vt-panel-raised)",
        color: "var(--vt-text-muted)",
        fontSize: 12,
      }}
    >
      <Info
        size={14}
        style={{ flex: "0 0 auto", marginTop: 1, color: "var(--vt-cyan)" }}
        aria-hidden="true"
      />
      <div>{children}</div>
    </div>
  );
}
