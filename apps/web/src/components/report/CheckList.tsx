import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Info, MinusCircle, XCircle } from "lucide-react";
import type { CheckResult, CheckStatus, SectionReport } from "@vibetrace/shared-types";
import { Badge, Card, EmptyState } from "@vibetrace/design-system";

const STATUS_META: Record<
  CheckStatus,
  {
    label: string;
    tone: "lime" | "amber" | "red" | "cyan" | "neutral";
    color: string;
    icon: typeof CheckCircle2;
  }
> = {
  pass: { label: "Pass", tone: "lime", color: "var(--vt-lime)", icon: CheckCircle2 },
  warn: { label: "Warn", tone: "amber", color: "var(--vt-amber)", icon: AlertTriangle },
  fail: { label: "Fail", tone: "red", color: "var(--vt-red)", icon: XCircle },
  info: { label: "Info", tone: "cyan", color: "var(--vt-cyan)", icon: Info },
  unavailable: {
    label: "Unavailable",
    tone: "neutral",
    color: "var(--vt-text-faint)",
    icon: MinusCircle,
  },
};

const FILTERS: Array<{ value: "all" | CheckStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "pass", label: "Pass" },
  { value: "warn", label: "Warn" },
  { value: "fail", label: "Fail" },
  { value: "info", label: "Info" },
  { value: "unavailable", label: "Unavailable" },
];

function CheckRow({ check }: { check: CheckResult }): ReactNode {
  const meta = STATUS_META[check.status];
  const Icon = meta.icon;
  return (
    <details className="check-entry">
      <summary className="check-entry-summary">
        <span style={{ color: meta.color, display: "inline-flex", marginTop: 1 }}>
          <Icon size={17} aria-hidden="true" />
          <span className="vt-visually-hidden">{meta.label}</span>
        </span>
        <span style={{ minWidth: 0 }}>
          <span
            style={{ display: "block", color: "var(--vt-text)", fontSize: 13, fontWeight: 600 }}
          >
            {check.title}
          </span>
          <span
            style={{ display: "block", marginTop: 2, color: "var(--vt-text-muted)", fontSize: 12 }}
          >
            {check.detail}
          </span>
        </span>
        <span
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 5,
          }}
        >
          <Badge tone={meta.tone}>{meta.label}</Badge>
          <Badge>{check.basis}</Badge>
          <Badge>w {check.weight}</Badge>
          <ChevronDown size={14} className="check-chevron" aria-hidden="true" />
        </span>
      </summary>
      <div style={{ padding: "10px 0 4px 29px" }}>
        {check.evidence.length ? (
          <div style={{ marginBottom: check.recommendation ? 10 : 0 }}>
            <span
              className="vt-mono"
              style={{
                fontSize: 9,
                letterSpacing: "0.1em",
                color: "var(--vt-text-faint)",
                textTransform: "uppercase",
              }}
            >
              Observed evidence
            </span>
            <ul
              style={{
                margin: "5px 0 0",
                paddingLeft: 16,
                color: "var(--vt-text-muted)",
                fontSize: 12,
              }}
            >
              {check.evidence.map((item, index) => (
                <li key={`${item}-${index}`} style={{ overflowWrap: "anywhere" }}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {check.recommendation ? (
          <div
            style={{
              marginTop: 8,
              padding: "9px 11px",
              borderLeft: "2px solid var(--vt-lime)",
              borderRadius: "0 6px 6px 0",
              background: "var(--vt-lime-glow)",
              color: "var(--vt-text-muted)",
              fontSize: 12,
            }}
          >
            <strong style={{ color: "var(--vt-text)" }}>Recommendation: </strong>
            {check.recommendation}
          </div>
        ) : null}
      </div>
    </details>
  );
}

export function CheckList({
  section,
  showFilters = false,
  initialFilter = "all",
}: {
  section: SectionReport;
  showFilters?: boolean;
  initialFilter?: "all" | CheckStatus;
}): ReactNode {
  const [filter, setFilter] = useState<"all" | CheckStatus>(initialFilter);
  const counts = useMemo(() => {
    const result: Record<string, number> = { all: section.score.checks.length };
    for (const status of ["pass", "warn", "fail", "info", "unavailable"] as const) {
      result[status] = section.score.checks.filter((check) => check.status === status).length;
    }
    return result;
  }, [section]);

  const visible = section.score.checks.filter(
    (check) => filter === "all" || check.status === filter,
  );

  return (
    <Card>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "14px 18px",
          borderBottom: "1px solid var(--vt-border)",
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 650 }}>Checks & evidence</h3>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--vt-text-muted)" }}>
            Weights are fixed per check. Warnings earn half weight; failures earn none.
          </p>
        </div>
        {showFilters ? (
          <div
            style={{ display: "flex", flexWrap: "wrap", gap: 4 }}
            role="group"
            aria-label="Filter checks by status"
          >
            {FILTERS.map((item) => {
              const active = filter === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFilter(item.value)}
                  aria-pressed={active}
                  className="vt-mono"
                  style={{
                    padding: "4px 8px",
                    border: "1px solid",
                    borderColor: active ? "var(--vt-lime)" : "var(--vt-border)",
                    borderRadius: 4,
                    background: active ? "var(--vt-lime-glow)" : "transparent",
                    color: active ? "var(--vt-lime)" : "var(--vt-text-muted)",
                    fontSize: 9,
                    letterSpacing: "0.06em",
                    cursor: "pointer",
                    textTransform: "uppercase",
                  }}
                >
                  {item.label} {counts[item.value] ?? 0}
                </button>
              );
            })}
          </div>
        ) : (
          <span
            className="vt-mono"
            style={{ fontSize: 9, color: "var(--vt-text-faint)", letterSpacing: "0.08em" }}
          >
            {section.score.checks.length} CHECKS
          </span>
        )}
      </div>
      {visible.length ? (
        <div style={{ padding: "0 18px" }}>
          {visible.map((check) => (
            <CheckRow key={check.id} check={check} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No checks match this filter"
          description="Choose a different status to inspect the available observations."
        />
      )}
    </Card>
  );
}

export function SectionMethodology({ section }: { section: SectionReport }): ReactNode {
  return (
    <details className="vt-card" style={{ padding: 0, marginTop: 14 }}>
      <summary
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "13px 18px",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <ChevronDown size={14} className="check-chevron" aria-hidden="true" /> Methodology, coverage
        & missing data
      </summary>
      <div style={{ padding: "0 18px 16px", color: "var(--vt-text-muted)", fontSize: 12 }}>
        <p style={{ margin: "0 0 8px" }}>{section.score.explanation}</p>
        <ul style={{ margin: "0 0 10px", paddingLeft: 16 }}>
          {section.score.methodology.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        {section.score.missing.length ? (
          <>
            <span
              className="vt-mono"
              style={{
                fontSize: 9,
                letterSpacing: "0.1em",
                color: "var(--vt-text-faint)",
                textTransform: "uppercase",
              }}
            >
              Not measured
            </span>
            <ul style={{ margin: "5px 0 0", paddingLeft: 16 }}>
              {section.score.missing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        ) : null}
        {section.limitations.length ? (
          <div style={{ marginTop: 10 }}>
            <span
              className="vt-mono"
              style={{
                fontSize: 9,
                letterSpacing: "0.1em",
                color: "var(--vt-text-faint)",
                textTransform: "uppercase",
              }}
            >
              Section limitations
            </span>
            <ul style={{ margin: "5px 0 0", paddingLeft: 16 }}>
              {section.limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </details>
  );
}
