import type { ScanReport } from "@vibetrace/shared-types";
import type { AppConfig } from "../config.js";
import { ServiceError } from "./errors.js";

export interface AIExplanation {
  explanation: string;
  provider: string;
  model: string;
  generatedAt: string;
  disclaimer: string;
}

const DISCLAIMER =
  "AI-generated explanation. It summarizes existing VibeTrace findings and is not a new forensic measurement, authorship determination or probability.";

function buildPrompt(report: ScanReport): string {
  const failedChecks = Object.values(report.sections)
    .flatMap((section) =>
      section.score.checks
        .filter((check) => check.status === "fail" || check.status === "warn")
        .map((check) => `${section.title} / ${check.title} [${check.status}]: ${check.detail}`),
    )
    .slice(0, 20);

  return [
    "You are writing a concise technical explanation for a website-forensics report.",
    "Use ONLY the findings below. Do not invent evidence, measurements, vulnerabilities or authorship claims.",
    "Never describe the AI signal index as a probability. Be explicit about uncertainty and missing data.",
    "Return plain text under 350 words with three short sections: What was observed, What it means, What to do next.",
    "",
    `URL: ${report.scan.finalUrl ?? report.scan.url}`,
    `Scan mode: ${report.scan.mode}`,
    `AI classification: ${report.ai.label} (confidence ${report.ai.confidence}, signal index ${report.ai.signalScore ?? "not available"})`,
    `AI evidence: ${report.ai.evidence.map((item) => `${item.title}: ${item.description}`).join(" | ") || "none"}`,
    `Builder fingerprints: ${report.ai.builderFingerprints.map((item) => item.name).join(", ") || "none"}`,
    `Technologies: ${report.technologies.map((item) => `${item.name} (${item.confidence}%)`).join(", ") || "none"}`,
    `Scores: security=${report.scores.security.score ?? "n/a"}, performance=${report.scores.performance.score ?? "n/a"}, accessibility=${report.scores.accessibility.score ?? "n/a"}, SEO=${report.scores.seo.score ?? "n/a"}, code quality=${report.scores.codeQuality.score ?? "n/a"}`,
    `Findings needing attention: ${failedChecks.join(" | ") || "none"}`,
    `Limitations: ${report.limitations.join(" ")}`,
  ].join("\n");
}

export class AIService {
  private readonly config: AppConfig["ai"];

  constructor(config: AppConfig["ai"]) {
    this.config = config;
  }

  get enabled(): boolean {
    return Boolean(this.config.provider !== "disabled" && this.config.baseUrl && this.config.model);
  }

  get provider(): string {
    return this.config.provider;
  }

  private assertConfigured(): void {
    if (!this.enabled) {
      throw new ServiceError(
        503,
        "AI_DISABLED",
        "The optional AI explanation provider is not configured on this server.",
      );
    }
  }

  async explain(report: ScanReport): Promise<AIExplanation> {
    this.assertConfigured();
    const provider = this.config.provider;
    const baseUrl = this.config.baseUrl!.replace(/\/$/, "");
    const prompt = buildPrompt(report);

    let endpoint: string;
    let headers: Record<string, string> = { "content-type": "application/json" };
    let body: unknown;
    if (provider === "ollama") {
      endpoint = `${baseUrl}/api/generate`;
      body = {
        model: this.config.model,
        prompt,
        stream: false,
        options: { temperature: 0.1, num_predict: 500 },
      };
    } else {
      endpoint = `${baseUrl}/chat/completions`;
      headers = {
        ...headers,
        ...(this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {}),
      };
      body = {
        model: this.config.model,
        temperature: 0.1,
        max_tokens: 600,
        messages: [
          {
            role: "system",
            content:
              "Explain supplied forensic findings without inventing evidence or determining authorship.",
          },
          { role: "user", content: prompt },
        ],
      };
    }

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new ServiceError(
        502,
        "AI_PROVIDER_UNAVAILABLE",
        "The configured AI provider could not be reached.",
      );
    }

    if (!response.ok) {
      throw new ServiceError(
        502,
        "AI_PROVIDER_ERROR",
        `The configured AI provider returned HTTP ${response.status}.`,
      );
    }

    let payload: any;
    try {
      payload = await response.json();
    } catch {
      throw new ServiceError(502, "AI_PROVIDER_INVALID", "The AI provider returned invalid JSON.");
    }

    const explanationRaw =
      provider === "ollama" ? payload?.response : payload?.choices?.[0]?.message?.content;
    if (typeof explanationRaw !== "string" || explanationRaw.trim().length === 0) {
      throw new ServiceError(
        502,
        "AI_PROVIDER_INVALID",
        "The AI provider returned an empty explanation.",
      );
    }

    return {
      explanation: explanationRaw.trim().slice(0, 6000),
      provider,
      model: this.config.model!,
      generatedAt: new Date().toISOString(),
      disclaimer: DISCLAIMER,
    };
  }
}
