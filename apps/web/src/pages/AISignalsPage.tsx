import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  Copy,
  ExternalLink,
  Fingerprint,
  ShieldQuestion,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Alert, Badge, Button, Card, Progress, ScoreRing, Spinner } from "@vibetrace/design-system";
import { ReportGate } from "../components/report/ReportFrame.js";
import { EvidenceGrid, MetricGrid, InfoNote } from "../components/report/Metrics.js";
import { ErrorPanel } from "../components/ErrorPanel.js";
import { useHealth } from "../hooks/use-api.js";
import { useSettings } from "../providers/SettingsProvider.js";
import { useToast } from "../providers/ToastProvider.js";
import { getApiClient } from "../lib/settings.js";
import { copyText } from "../lib/export.js";
import { describeError } from "../lib/errors.js";

function ExplainPanel({ scanId }: { scanId: string }): ReactNode {
  const { health } = useHealth();
  const { settings } = useSettings();
  const { toast } = useToast();
  const [explanation, setExplanation] = useState<Awaited<
    ReturnType<ReturnType<typeof getApiClient>["explainWithAI"]>
  > | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [confirming, setConfirming] = useState(false);

  const providerEnabled = Boolean(health?.ai.enabled);

  const run = async () => {
    setConfirming(false);
    setLoading(true);
    setError(null);
    try {
      const result = await getApiClient().explainWithAI(scanId);
      setExplanation(result);
      toast({ tone: "success", title: "Narrative explanation generated" });
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  if (!providerEnabled) {
    return (
      <Card style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Wand2 size={14} style={{ color: "var(--vt-text-faint)" }} aria-hidden="true" />
          <h2 style={{ margin: 0, fontSize: 13 }}>Optional AI narrative</h2>
          <Badge>disabled on this API</Badge>
        </div>
        <p style={{ margin: "7px 0 0", fontSize: 12, color: "var(--vt-text-muted)" }}>
          The deterministic forensic analysis above does not require an external AI provider. If one
          is configured server-side, you can opt in to a narrative summary here. Nothing is sent to
          a provider automatically.
        </p>
      </Card>
    );
  }

  return (
    <Card
      style={{
        padding: "16px 18px",
        borderColor: "color-mix(in srgb, var(--vt-lime) 34%, var(--vt-border))",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Wand2 size={14} style={{ color: "var(--vt-lime)" }} aria-hidden="true" />
          <h2 style={{ margin: 0, fontSize: 13 }}>Optional AI narrative</h2>
          <Badge tone="lime">{health?.ai.provider}</Badge>
        </div>
        {!explanation ? (
          settings.aiConsent ? (
            <Button
              size="sm"
              variant="primary"
              loading={loading}
              onClick={() => setConfirming(true)}
            >
              <Wand2 size={13} aria-hidden="true" /> Generate explanation
            </Button>
          ) : (
            <Link to="/settings" className="vt-button vt-button--secondary vt-button--sm">
              Enable AI consent <ArrowRight size={13} aria-hidden="true" />
            </Link>
          )
        ) : null}
      </div>

      <p style={{ margin: "7px 0 0", fontSize: 12, color: "var(--vt-text-muted)" }}>
        Sends a bounded report summary — scores, classification, failed checks, technologies and
        limitations — to the operator-configured provider. Raw HTML, response headers, cookies and
        credentials are never included. The output is labelled as AI-generated and is not a new
        measurement or an authorship claim.
      </p>

      {confirming ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid var(--vt-border-strong)",
            borderRadius: 8,
            background: "var(--vt-black)",
          }}
        >
          <p style={{ margin: 0, fontSize: 12 }}>
            Send this report summary to <strong>{health?.ai.provider}</strong> for a narrative
            explanation? This is a separate network request from the scan itself.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <Button size="sm" variant="primary" onClick={() => void run()}>
              Send summary
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 12,
            color: "var(--vt-text-muted)",
            fontSize: 12,
          }}
        >
          <Spinner label="Generating explanation" /> Waiting for the configured provider…
        </div>
      ) : null}

      {error ? (
        <div style={{ marginTop: 12 }}>
          <ErrorPanel
            error={error}
            showSettings={false}
            onRetry={() => setConfirming(true)}
            title="Narrative generation failed"
          />
        </div>
      ) : null}

      {explanation ? (
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", gap: 5 }}>
              <Badge tone="cyan">{explanation.provider}</Badge>
              <Badge>{explanation.model}</Badge>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                void copyText(explanation.explanation)
                  .then(() => toast({ tone: "success", title: "Explanation copied" }))
                  .catch((err: unknown) =>
                    toast({
                      tone: "error",
                      title: "Copy failed",
                      message: describeError(err).message,
                    }),
                  );
              }}
            >
              <Copy size={13} aria-hidden="true" /> Copy
            </Button>
          </div>
          <div
            style={{
              marginTop: 8,
              padding: "12px 14px",
              border: "1px solid var(--vt-border)",
              borderRadius: 6,
              background: "var(--vt-black)",
              color: "var(--vt-text-muted)",
              fontSize: 13,
              whiteSpace: "pre-wrap",
              lineHeight: 1.7,
            }}
          >
            {explanation.explanation}
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 10, color: "var(--vt-text-faint)" }}>
            {explanation.disclaimer} Generated {new Date(explanation.generatedAt).toLocaleString()}.
          </p>
        </div>
      ) : null}
    </Card>
  );
}

export function AISignalsPage(): ReactNode {
  return (
    <ReportGate page="AI signals">
      {(report) => {
        const ai = report.ai;
        const positiveWeight = ai.evidence.reduce((sum, item) => sum + item.weight, 0);
        const contradictionWeight = ai.contradictions.reduce((sum, item) => sum + item.weight, 0);
        return (
          <div style={{ display: "grid", gap: 16 }}>
            <Card raised style={{ padding: "clamp(18px, 4vw, 26px)" }}>
              <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
                <div style={{ justifySelf: "center" }}>
                  <ScoreRing
                    value={ai.signalScore}
                    label="AI signal index"
                    caption="not a probability"
                    size={132}
                    thickness={7}
                  />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    <Badge
                      tone={
                        ai.classification === "strong"
                          ? "lime"
                          : ai.classification === "moderate"
                            ? "amber"
                            : ai.classification === "mixed"
                              ? "red"
                              : "neutral"
                      }
                    >
                      {ai.label}
                    </Badge>
                    <Badge tone="cyan">
                      {ai.confidence} confidence · {ai.confidenceScore}%
                    </Badge>
                    <Badge>
                      {ai.evidence.length} supporting · {ai.contradictions.length} contradicting
                    </Badge>
                  </div>
                  <h2
                    style={{
                      margin: "10px 0 0",
                      fontSize: "clamp(21px, 3.4vw, 30px)",
                      lineHeight: 1.1,
                      letterSpacing: "-0.03em",
                    }}
                  >
                    {ai.classification === "insufficient"
                      ? "No reliable AI-development fingerprint was observed."
                      : ai.classification === "mixed"
                        ? "Signals conflict or are too weak to classify."
                        : ai.classification === "strong"
                          ? "Strong, builder-specific AI-development signals were observed."
                          : ai.classification === "moderate"
                            ? "Moderate AI-development signals were observed."
                            : "Weak, circumstantial AI-development signals were observed."}
                  </h2>
                  <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--vt-text-muted)" }}>
                    {ai.summary}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 12 }}>
                    <div style={{ minWidth: 160, flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 10,
                          color: "var(--vt-text-faint)",
                        }}
                      >
                        <span
                          className="vt-mono"
                          style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}
                        >
                          Evidence confidence
                        </span>
                        <span>{ai.confidenceScore}%</span>
                      </div>
                      <Progress
                        value={ai.confidenceScore}
                        label="Evidence confidence"
                        className="mt-2"
                      />
                    </div>
                    <div style={{ minWidth: 160, flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 10,
                          color: "var(--vt-text-faint)",
                        }}
                      >
                        <span
                          className="vt-mono"
                          style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}
                        >
                          Positive weight
                        </span>
                        <span>{positiveWeight}</span>
                      </div>
                      <Progress
                        value={Math.min(100, positiveWeight)}
                        label="Positive evidence weight"
                        className="mt-2"
                      />
                    </div>
                    <div style={{ minWidth: 160, flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 10,
                          color: "var(--vt-text-faint)",
                        }}
                      >
                        <span
                          className="vt-mono"
                          style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}
                        >
                          Contradicting weight
                        </span>
                        <span>{contradictionWeight}</span>
                      </div>
                      <Progress
                        value={Math.min(100, contradictionWeight)}
                        label="Contradicting evidence weight"
                        className="mt-2"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Alert tone="warn" title="How to read this page">
              This is a heuristic evidence index, not a calibrated probability and not authorship
              detection. AI-assisted code often leaves no reliable frontend fingerprint. A weak or
              insufficient result does not mean AI was not used; it means the observable page did
              not supply discriminating evidence.
            </Alert>

            <MetricGrid metrics={ai.metrics} />

            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  marginBottom: 8,
                }}
              >
                <h2 style={{ margin: 0, fontSize: 15 }}>Supporting evidence</h2>
                <span
                  className="vt-mono"
                  style={{ fontSize: 9, color: "var(--vt-text-faint)", letterSpacing: "0.08em" }}
                >
                  {ai.evidence.length} OBSERVATIONS
                </span>
              </div>
              <EvidenceGrid evidence={ai.evidence} />
            </div>

            {ai.contradictions.length ? (
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    marginBottom: 8,
                  }}
                >
                  <h2 style={{ margin: 0, fontSize: 15 }}>Contradicting evidence</h2>
                  <span
                    className="vt-mono"
                    style={{ fontSize: 9, color: "var(--vt-text-faint)", letterSpacing: "0.08em" }}
                  >
                    REDUCES THE INDEX
                  </span>
                </div>
                <EvidenceGrid evidence={ai.contradictions} />
              </div>
            ) : null}

            {ai.builderFingerprints.length ? (
              <div>
                <h2 style={{ margin: "0 0 8px", fontSize: 15 }}>Builder fingerprints</h2>
                <div className="evidence-grid">
                  {ai.builderFingerprints.map((fingerprint) => (
                    <div key={fingerprint.id} className="vt-card" style={{ padding: "14px 16px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <Fingerprint
                            size={14}
                            style={{ color: "var(--vt-lime)" }}
                            aria-hidden="true"
                          />
                          <span style={{ fontSize: 13, fontWeight: 650 }}>{fingerprint.name}</span>
                        </div>
                        <Badge tone={fingerprint.confidence >= 70 ? "lime" : "amber"}>
                          {fingerprint.confidence}%
                        </Badge>
                      </div>
                      <p
                        className="vt-mono"
                        style={{
                          margin: "5px 0 0",
                          fontSize: 9,
                          letterSpacing: "0.06em",
                          color: "var(--vt-text-faint)",
                          textTransform: "uppercase",
                        }}
                      >
                        {fingerprint.kind}
                      </p>
                      <ul
                        style={{
                          margin: "8px 0 0",
                          paddingLeft: 16,
                          fontSize: 12,
                          color: "var(--vt-text-muted)",
                        }}
                      >
                        {fingerprint.evidenceTitles.map((title) => (
                          <li key={title}>{title}</li>
                        ))}
                      </ul>
                      <p style={{ margin: "8px 0 0", fontSize: 10, color: "var(--vt-text-faint)" }}>
                        {fingerprint.caveat}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {ai.insufficientEvidenceNotes.length ? (
              <Card style={{ padding: "16px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <ShieldQuestion
                    size={14}
                    style={{ color: "var(--vt-amber)" }}
                    aria-hidden="true"
                  />
                  <h2 style={{ margin: 0, fontSize: 13 }}>Why the evidence may be insufficient</h2>
                </div>
                <ul
                  style={{
                    margin: "8px 0 0",
                    paddingLeft: 18,
                    fontSize: 12,
                    color: "var(--vt-text-muted)",
                  }}
                >
                  {ai.insufficientEvidenceNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </Card>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-2">
              <Card style={{ padding: "16px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <AlertTriangle
                    size={14}
                    style={{ color: "var(--vt-amber)" }}
                    aria-hidden="true"
                  />
                  <h2 style={{ margin: 0, fontSize: 13 }}>Limitations</h2>
                </div>
                <ul
                  style={{
                    margin: "8px 0 0",
                    paddingLeft: 18,
                    fontSize: 12,
                    color: "var(--vt-text-muted)",
                  }}
                >
                  {ai.limitations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </Card>
              <Card style={{ padding: "16px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <Sparkles size={14} style={{ color: "var(--vt-lime)" }} aria-hidden="true" />
                  <h2 style={{ margin: 0, fontSize: 13 }}>What to verify next</h2>
                </div>
                <ul
                  style={{
                    margin: "8px 0 0",
                    paddingLeft: 18,
                    fontSize: 12,
                    color: "var(--vt-text-muted)",
                  }}
                >
                  {ai.recommendations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </Card>
            </div>

            <Card style={{ padding: "0" }}>
              <details>
                <summary
                  style={{ padding: "14px 18px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
                >
                  <BrainCircuit
                    size={14}
                    style={{ display: "inline", marginRight: 7, color: "var(--vt-lime)" }}
                    aria-hidden="true"
                  />
                  Methodology for this classification
                </summary>
                <div
                  style={{ padding: "0 18px 16px", color: "var(--vt-text-muted)", fontSize: 12 }}
                >
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {report.scores.aiSignals.methodology.map((item) => (
                      <li key={item} style={{ marginBottom: 5 }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div style={{ marginTop: 10 }}>
                    <InfoNote>
                      Thresholds: strong requires adjusted index ≥ 40 plus a strong builder signal;
                      moderate ≥ 24; weak ≥ 7; contradictions ≥ 75% of positive weight yield mixed.
                      No positive evidence yields insufficient (or mixed when contradictions exist).
                    </InfoNote>
                  </div>
                  <p style={{ margin: "10px 0 0" }}>
                    Compare this report against another scan or read the full{" "}
                    <Link to="/methodology#ai-signals" style={{ color: "var(--vt-lime)" }}>
                      AI signal methodology{" "}
                      <ExternalLink size={10} style={{ display: "inline" }} aria-hidden="true" />
                    </Link>
                    .
                  </p>
                </div>
              </details>
            </Card>

            <ExplainPanel scanId={report.scan.id} />
          </div>
        );
      }}
    </ReportGate>
  );
}
