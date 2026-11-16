import { z } from "zod";

export const SCAN_STATUSES = [
  "queued",
  "running",
  "completed",
  "partially_completed",
  "failed",
] as const;
export type ScanStatus = (typeof SCAN_STATUSES)[number];

export const SCAN_MODES = ["remote", "snapshot"] as const;
export type ScanMode = (typeof SCAN_MODES)[number];

export const SCAN_CLIENTS = ["web", "extension", "api"] as const;
export type ScanClient = (typeof SCAN_CLIENTS)[number];

export const AI_CLASSIFICATIONS = ["strong", "moderate", "weak", "mixed", "insufficient"] as const;
export type AIClassification = (typeof AI_CLASSIFICATIONS)[number];

export const AI_CLASSIFICATION_LABELS: Record<AIClassification, string> = {
  strong: "Strong AI-assisted development signals",
  moderate: "Moderate AI-assisted development signals",
  weak: "Weak AI-assisted development signals",
  mixed: "Mixed or inconclusive evidence",
  insufficient: "Insufficient evidence",
};

export const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const EVIDENCE_CATEGORIES = [
  "strong_builder",
  "moderate_pattern",
  "weak_circumstantial",
  "contradictory",
  "technology_signature",
] as const;
export type EvidenceCategory = (typeof EVIDENCE_CATEGORIES)[number];

export const EVIDENCE_STRENGTHS = ["strong", "moderate", "weak"] as const;
export type EvidenceStrength = (typeof EVIDENCE_STRENGTHS)[number];

export const CHECK_STATUSES = ["pass", "warn", "fail", "info", "unavailable"] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];

export const TECH_CATEGORIES = [
  "framework",
  "meta-framework",
  "ui-library",
  "styling",
  "backend",
  "hosting",
  "cdn",
  "cms",
  "ecommerce",
  "analytics",
  "build",
] as const;
export type TechnologyCategory = (typeof TECH_CATEGORIES)[number];

export const SCORE_IDS = [
  "aiSignals",
  "technologyConfidence",
  "codeQuality",
  "security",
  "performance",
  "accessibility",
  "seo",
] as const;
export type ScoreId = (typeof SCORE_IDS)[number];

export const SECTION_IDS = [
  "codeQuality",
  "security",
  "performance",
  "seo",
  "accessibility",
] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export const SNAPSHOT_LIMITS = {
  htmlBytes: 600_000,
  scriptSources: 300,
  stylesheetHrefs: 150,
  metaEntries: 80,
} as const;

// ---------------------------------------------------------------------------
// Core building blocks
// ---------------------------------------------------------------------------

export const EvidenceSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.enum(EVIDENCE_CATEGORIES),
  strength: z.enum(EVIDENCE_STRENGTHS),
  weight: z.number().min(0).max(100),
  source: z.string(),
  observed: z.string().max(600).optional(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const MetricSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.union([z.string(), z.number(), z.null()]),
  unit: z.string().optional(),
  measured: z.boolean(),
  note: z.string().optional(),
});
export type Metric = z.infer<typeof MetricSchema>;

export const CheckResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  status: z.enum(CHECK_STATUSES),
  basis: z.enum(["measured", "heuristic"]),
  weight: z.number().min(0),
  detail: z.string(),
  evidence: z.array(z.string()).max(20),
  recommendation: z.string().optional(),
});
export type CheckResult = z.infer<typeof CheckResultSchema>;

export const CategoryScoreSchema = z.object({
  score: z.number().min(0).max(100).nullable(),
  grade: z.string().nullable(),
  coverage: z.number().min(0).max(100),
  earned: z.number().min(0),
  possible: z.number().min(0),
  explanation: z.string(),
  methodology: z.array(z.string()),
  missing: z.array(z.string()),
  checks: z.array(CheckResultSchema),
});
export type CategoryScore = z.infer<typeof CategoryScoreSchema>;

export const TechnologyDetectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(TECH_CATEGORIES),
  confidence: z.number().min(0).max(100),
  description: z.string(),
  website: z.string().optional(),
  version: z.string().optional(),
  evidence: z.array(EvidenceSchema),
});
export type TechnologyDetection = z.infer<typeof TechnologyDetectionSchema>;

export const BuilderFingerprintSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["ai-native", "website-builder", "hosting-platform"]),
  confidence: z.number().min(0).max(100),
  evidenceTitles: z.array(z.string()),
  caveat: z.string(),
});
export type BuilderFingerprint = z.infer<typeof BuilderFingerprintSchema>;

export const AIScoreSummarySchema = z.object({
  signalScore: z.number().min(0).max(100).nullable(),
  label: z.string(),
  classification: z.enum(AI_CLASSIFICATIONS),
  confidence: z.enum(CONFIDENCE_LEVELS),
  confidenceScore: z.number().min(0).max(100),
  explanation: z.string(),
  methodology: z.array(z.string()),
  missing: z.array(z.string()),
});
export type AIScoreSummary = z.infer<typeof AIScoreSummarySchema>;

export const AISignalReportSchema = z.object({
  classification: z.enum(AI_CLASSIFICATIONS),
  label: z.string(),
  signalScore: z.number().min(0).max(100).nullable(),
  confidence: z.enum(CONFIDENCE_LEVELS),
  confidenceScore: z.number().min(0).max(100),
  summary: z.string(),
  evidence: z.array(EvidenceSchema),
  contradictions: z.array(EvidenceSchema),
  builderFingerprints: z.array(BuilderFingerprintSchema),
  insufficientEvidenceNotes: z.array(z.string()),
  limitations: z.array(z.string()),
  recommendations: z.array(z.string()),
  metrics: z.array(MetricSchema),
});
export type AISignalReport = z.infer<typeof AISignalReportSchema>;

export const TechnologyConfidenceSchema = z.object({
  score: z.number().min(0).max(100).nullable(),
  label: z.string(),
  detectedCount: z.number().int().min(0),
  coverage: z.number().min(0).max(100),
  explanation: z.string(),
  methodology: z.array(z.string()),
  missing: z.array(z.string()),
});
export type TechnologyConfidence = z.infer<typeof TechnologyConfidenceSchema>;

export const SectionReportSchema = z.object({
  id: z.enum(SECTION_IDS),
  title: z.string(),
  summary: z.string(),
  score: CategoryScoreSchema,
  metrics: z.array(MetricSchema),
  limitations: z.array(z.string()),
});
export type SectionReport = z.infer<typeof SectionReportSchema>;

export const SourceProfileSchema = z.object({
  htmlBytes: z.number().min(0),
  htmlTruncated: z.boolean(),
  scriptCount: z.number().min(0),
  externalScriptCount: z.number().min(0),
  inlineScriptCount: z.number().min(0),
  stylesheetCount: z.number().min(0),
  imageCount: z.number().min(0),
  nodeCount: z.number().min(0),
  maxDepth: z.number().min(0),
  thirdPartyDomains: z.array(z.string()).max(100),
  metaGenerator: z.string().nullable(),
  comments: z.number().min(0),
  duplicateIds: z.number().min(0),
  sourceMaps: z.array(z.string()).max(50),
  repeatedStructures: z.array(z.object({ signature: z.string(), count: z.number() })).max(20),
  limitations: z.array(z.string()),
});
export type SourceProfile = z.infer<typeof SourceProfileSchema>;

export const RecommendationSchema = z.object({
  id: z.string(),
  title: z.string(),
  detail: z.string(),
  area: z.enum(["security", "performance", "accessibility", "seo", "quality", "ai"]),
  priority: z.enum(["high", "medium", "low"]),
});
export type Recommendation = z.infer<typeof RecommendationSchema>;

export const ScanReportSchema = z.object({
  schemaVersion: z.literal("1.0"),
  engineVersion: z.string(),
  generatedAt: z.string(),
  scan: z.object({
    id: z.string(),
    url: z.string(),
    finalUrl: z.string().nullable(),
    domain: z.string(),
    mode: z.enum(SCAN_MODES),
    client: z.enum(SCAN_CLIENTS),
    status: z.enum(["completed", "partially_completed"]),
    httpStatus: z.number().int().nullable(),
    createdAt: z.string(),
    completedAt: z.string(),
    durationMs: z.number().min(0),
    title: z.string().nullable(),
    language: z.string().nullable(),
    generator: z.string().nullable(),
    server: z.string().nullable(),
    contentType: z.string().nullable(),
  }),
  overview: z.object({
    title: z.string().nullable(),
    description: z.string().nullable(),
    language: z.string().nullable(),
    generator: z.string().nullable(),
    server: z.string().nullable(),
    httpStatus: z.number().int().nullable(),
    contentType: z.string().nullable(),
    finalUrl: z.string().nullable(),
    technologySummary: z.array(z.string()),
    builderSummary: z.array(z.string()),
    keyFindings: z.array(z.string()),
  }),
  ai: AISignalReportSchema,
  technologies: z.array(TechnologyDetectionSchema),
  source: SourceProfileSchema,
  sections: z.object({
    codeQuality: SectionReportSchema,
    security: SectionReportSchema,
    performance: SectionReportSchema,
    seo: SectionReportSchema,
    accessibility: SectionReportSchema,
  }),
  scores: z.object({
    aiSignals: AIScoreSummarySchema,
    technologyConfidence: TechnologyConfidenceSchema,
    codeQuality: CategoryScoreSchema,
    security: CategoryScoreSchema,
    performance: CategoryScoreSchema,
    accessibility: CategoryScoreSchema,
    seo: CategoryScoreSchema,
  }),
  recommendations: z.array(RecommendationSchema),
  limitations: z.array(z.string()),
  partialReason: z.string().nullable(),
});
export type ScanReport = z.infer<typeof ScanReportSchema>;

// ---------------------------------------------------------------------------
// Extension page snapshot
// ---------------------------------------------------------------------------

export const PageSnapshotSchema = z.object({
  url: z.string().url().max(2048),
  title: z.string().max(500),
  lang: z.string().max(40),
  meta: z.record(z.string()).refine((v) => Object.keys(v).length <= SNAPSHOT_LIMITS.metaEntries, {
    message: "Too many meta entries",
  }),
  html: z.string().max(SNAPSHOT_LIMITS.htmlBytes),
  scriptSources: z.array(z.string().max(2048)).max(SNAPSHOT_LIMITS.scriptSources),
  stylesheetHrefs: z.array(z.string().max(2048)).max(SNAPSHOT_LIMITS.stylesheetHrefs),
  dom: z.object({
    nodeCount: z.number().int().min(0),
    maxDepth: z.number().int().min(0),
    headingLevels: z.array(z.number().int().min(1).max(6)).max(200),
    imageCount: z.number().int().min(0),
    imagesWithAlt: z.number().int().min(0),
    imageSources: z.array(z.string().max(2048)).max(250),
    inputCount: z.number().int().min(0),
    labeledInputCount: z.number().int().min(0),
    buttonCount: z.number().int().min(0),
    unnamedButtonCount: z.number().int().min(0),
    linkCount: z.number().int().min(0),
    unnamedLinkCount: z.number().int().min(0),
    duplicateIds: z.number().int().min(0),
    inlineStyleCount: z.number().int().min(0),
    inlineScriptCount: z.number().int().min(0),
    semanticElements: z.array(z.string()).max(20),
    classSignatureSamples: z.array(z.string().max(300)).max(100),
    inlineScriptSamples: z.array(z.string().max(2000)).max(30),
    htmlComments: z.array(z.string().max(500)).max(30),
    jsonLdSamples: z.array(z.string().max(4000)).max(10),
  }),
  timing: z
    .object({
      ttfbMs: z.number().min(0).optional(),
      domContentLoadedMs: z.number().min(0).optional(),
      loadMs: z.number().min(0).optional(),
      firstContentfulPaintMs: z.number().min(0).optional(),
      resourceCount: z.number().int().min(0).optional(),
      scriptBytes: z.number().min(0).optional(),
      styleBytes: z.number().min(0).optional(),
      imageBytes: z.number().min(0).optional(),
      transferSize: z.number().min(0).optional(),
      decodedBodySize: z.number().min(0).optional(),
      thirdPartyOrigins: z.array(z.string().max(300)).max(50).optional(),
    })
    .optional(),
  capturedAt: z.string(),
});
export type PageSnapshot = z.infer<typeof PageSnapshotSchema>;

// ---------------------------------------------------------------------------
// API contracts
// ---------------------------------------------------------------------------

export const CreateScanRequestSchema = z
  .object({
    url: z.string().trim().url("A valid absolute URL is required.").max(2048),
    mode: z.enum(SCAN_MODES).default("remote"),
    client: z.enum(SCAN_CLIENTS).default("web"),
    snapshot: PageSnapshotSchema.optional(),
  })
  .superRefine((value, ctx) => {
    let parsed: URL;
    try {
      parsed = new URL(value.url);
    } catch {
      return;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["url"],
        message: "Only http and https URLs can be analyzed.",
      });
    }
    if (value.mode === "snapshot" && !value.snapshot) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["snapshot"],
        message: "Snapshot mode requires a page snapshot.",
      });
    }
    if (value.snapshot && value.snapshot.url !== value.url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["snapshot", "url"],
        message: "Snapshot URL must match the scan URL.",
      });
    }
  });
export type CreateScanRequest = z.infer<typeof CreateScanRequestSchema>;

export const ScanProgressSchema = z.object({
  stage: z.string(),
  percent: z.number().min(0).max(100),
  message: z.string().optional(),
});
export type ScanProgress = z.infer<typeof ScanProgressSchema>;

export const ScanStatusInfoSchema = z.object({
  id: z.string(),
  status: z.enum(SCAN_STATUSES),
  progress: ScanProgressSchema,
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .nullable(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
});
export type ScanStatusInfo = z.infer<typeof ScanStatusInfoSchema>;

export const ScanSummarySchema = z.object({
  id: z.string(),
  url: z.string(),
  domain: z.string(),
  mode: z.enum(SCAN_MODES),
  client: z.enum(SCAN_CLIENTS),
  status: z.enum(SCAN_STATUSES),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
  durationMs: z.number().nullable(),
  aiClassification: z.enum(AI_CLASSIFICATIONS).nullable(),
  aiLabel: z.string().nullable(),
  technologyCount: z.number().int().min(0),
  technologyNames: z.array(z.string()),
  securityScore: z.number().nullable(),
  performanceScore: z.number().nullable(),
  shared: z.boolean(),
});
export type ScanSummary = z.infer<typeof ScanSummarySchema>;

export const ShareReportResponseSchema = z.object({
  token: z.string(),
  path: z.string(),
  createdAt: z.string(),
});
export type ShareReportResponse = z.infer<typeof ShareReportResponseSchema>;

export const HealthResponseSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  version: z.string(),
  uptimeSeconds: z.number(),
  storage: z.string(),
  ai: z.object({ enabled: z.boolean(), provider: z.string() }),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const TechnologyRegistryEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(TECH_CATEGORIES),
  description: z.string(),
  website: z.string(),
  detectionMethods: z.array(z.string()),
});
export type TechnologyRegistryEntry = z.infer<typeof TechnologyRegistryEntrySchema>;

export const FingerprintRegistryEntrySchema = z.object({
  id: z.string(),
  builder: z.string(),
  kind: z.enum(["ai-native", "website-builder", "hosting-platform", "source-pattern"]),
  category: z.enum(EVIDENCE_CATEGORIES),
  strength: z.enum(EVIDENCE_STRENGTHS),
  title: z.string(),
  description: z.string(),
  source: z.string(),
  caveat: z.string(),
});
export type FingerprintRegistryEntry = z.infer<typeof FingerprintRegistryEntrySchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
  requestId: z.string(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export function apiEnvelope<T extends z.ZodTypeAny>(schema: T) {
  return z.object({ data: schema });
}

export const CreateScanResponseSchema = apiEnvelope(
  z.object({
    id: z.string(),
    status: z.enum(SCAN_STATUSES),
    progress: ScanProgressSchema,
    statusUrl: z.string(),
    reportUrl: z.string(),
    requestId: z.string(),
  }),
);

export const ScanListResponseSchema = apiEnvelope(
  z.object({ scans: z.array(ScanSummarySchema), total: z.number() }),
);

export const TechnologiesResponseSchema = apiEnvelope(
  z.object({ technologies: z.array(TechnologyRegistryEntrySchema) }),
);
export const FingerprintsResponseSchema = apiEnvelope(
  z.object({ fingerprints: z.array(FingerprintRegistryEntrySchema) }),
);

export const SharedReportResponseSchema = apiEnvelope(
  z.object({
    report: ScanReportSchema,
    sharedAt: z.string(),
  }),
);

export const AIExplanationRequestSchema = z.object({
  consent: z.literal(true),
});
export const AIExplanationResponseSchema = apiEnvelope(
  z.object({
    explanation: z.string(),
    provider: z.string(),
    model: z.string(),
    generatedAt: z.string(),
    disclaimer: z.string(),
  }),
);
