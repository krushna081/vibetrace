import type { ScanReport } from "@vibetrace/shared-types";
import { ArrowUpRight, Fingerprint, ShieldCheck, Zap } from "lucide-react";
import { Badge, Button } from "@vibetrace/design-system";
import type { ReactNode } from "react";

function classificationTone(
  classification: ScanReport["ai"]["classification"],
): "lime" | "amber" | "cyan" | "neutral" {
  if (classification === "strong") return "lime";
  if (classification === "moderate") return "amber";
  if (classification === "mixed") return "cyan";
  return "neutral";
}

function scoreText(score: number | null): string {
  return score === null ? "—" : String(Math.round(score));
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}): ReactNode {
  return (
    <div className="ext-stat">
      <span className="ext-stat-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="ext-stat-value">{value}</span>
      <span className="ext-stat-label">{label}</span>
    </div>
  );
}

export function ResultSummary({
  report,
  onOpenReport,
  compact = false,
}: {
  report: ScanReport;
  onOpenReport: () => void;
  compact?: boolean;
}): ReactNode {
  const findings = report.overview.keyFindings.slice(0, compact ? 2 : 4);
  return (
    <div className="ext-result">
      <div className="ext-result-head">
        <div>
          <div className="ext-eyebrow">AI-builder evidence</div>
          <div className="ext-result-label">{report.ai.label}</div>
        </div>
        <Badge tone={classificationTone(report.ai.classification)}>
          {report.ai.classification}
        </Badge>
      </div>

      <p className="ext-result-summary">{report.ai.summary}</p>

      <div className="ext-result-stats">
        <Stat
          label="Security"
          value={scoreText(report.scores.security.score)}
          icon={<ShieldCheck size={13} />}
        />
        <Stat
          label="Performance"
          value={scoreText(report.scores.performance.score)}
          icon={<Zap size={13} />}
        />
        <Stat
          label="Tech found"
          value={String(report.technologies.length)}
          icon={<Fingerprint size={13} />}
        />
      </div>

      <div className="ext-index-note">
        <span>
          Evidence index <strong>{report.scores.aiSignals.signalScore ?? "—"}/100</strong> ·{" "}
          {report.ai.confidence} confidence
        </span>
        <span className="ext-index-caveat">Not a probability or authorship proof.</span>
      </div>

      {findings.length ? (
        <ul className="ext-findings">
          {findings.map((finding) => (
            <li key={finding}>{finding}</li>
          ))}
        </ul>
      ) : null}

      {report.partialReason ? (
        <p className="ext-partial">Partial scan: {report.partialReason}</p>
      ) : null}

      <div className="ext-result-actions">
        <Button
          variant="primary"
          size="sm"
          onClick={onOpenReport}
          leadingIcon={<ArrowUpRight size={14} />}
        >
          Open full report
        </Button>
        <span className="ext-result-meta">
          {report.technologies.length} technologies · {report.recommendations.length} fixes
        </span>
      </div>
    </div>
  );
}
