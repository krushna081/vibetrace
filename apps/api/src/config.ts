import { existsSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

for (const candidate of [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../../.env"),
  resolve(process.cwd(), ".env.local"),
]) {
  if (existsSync(candidate)) dotenv.config({ path: candidate, override: false, quiet: true });
}

const booleanFromString = z
  .string()
  .optional()
  .transform((value) =>
    value === undefined || value === "" ? true : /^(1|true|yes|on)$/i.test(value),
  );

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  PUBLIC_API_URL: z.string().default("http://localhost:8787"),
  WEB_BASE_URL: z.string().default("http://localhost:5173"),
  CORS_ORIGINS: z.string().default("http://localhost:5173,http://127.0.0.1:5173"),
  LOG_LEVEL: z.string().default("info"),
  SCAN_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(180_000).default(45_000),
  MAX_CONCURRENT_SCANS: z.coerce.number().int().min(1).max(20).default(2),
  SCAN_MAX_QUEUE: z.coerce.number().int().min(1).max(500).default(50),
  SCAN_MAX_HTML_BYTES: z.coerce.number().int().min(64_000).max(20_000_000).default(3_145_728),
  SCAN_MAX_REDIRECTS: z.coerce.number().int().min(0).max(20).default(5),
  SCAN_ALLOWED_PORTS: z.string().default("80,443"),
  SCAN_ASSET_PROBES: booleanFromString,
  SCAN_MAX_ASSET_PROBES: z.coerce.number().int().min(0).max(8).default(4),
  SCAN_ASSET_MAX_BYTES: z.coerce.number().int().min(16_384).max(2_000_000).default(524_288),
  SCAN_HISTORY_LIMIT: z.coerce.number().int().min(1).max(10_000).default(200),
  SCAN_RETENTION_HOURS: z.coerce.number().int().min(1).max(8_760).default(24),
  RATE_LIMIT_MAX: z.coerce.number().int().min(10).default(120),
  RATE_LIMIT_WINDOW: z.string().default("1 minute"),
  SCAN_CREATE_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
  STORAGE_DRIVER: z.enum(["memory", "prisma"]).default("memory"),
  DATABASE_URL: z.string().optional(),
  AI_PROVIDER: z.enum(["disabled", "ollama", "openai-compatible"]).default("disabled"),
  AI_BASE_URL: z.string().optional(),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
});

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig(overrides: NodeJS.ProcessEnv = process.env) {
  const parsed = EnvSchema.safeParse(overrides);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${detail}`);
  }
  const env = parsed.data;
  const allowedPorts = env.SCAN_ALLOWED_PORTS.split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0 && value <= 65535);
  if (allowedPorts.length === 0)
    throw new Error("SCAN_ALLOWED_PORTS must contain at least one port.");

  const allowedOrigins = env.CORS_ORIGINS.split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    nodeEnv: env.NODE_ENV,
    host: env.HOST,
    port: env.PORT,
    publicApiUrl: env.PUBLIC_API_URL.replace(/\/$/, ""),
    webBaseUrl: env.WEB_BASE_URL.replace(/\/$/, ""),
    corsOrigins: allowedOrigins,
    logLevel: env.LOG_LEVEL,
    scanTimeoutMs: env.SCAN_TIMEOUT_MS,
    maxConcurrentScans: env.MAX_CONCURRENT_SCANS,
    maxQueue: env.SCAN_MAX_QUEUE,
    maxHtmlBytes: env.SCAN_MAX_HTML_BYTES,
    maxRedirects: env.SCAN_MAX_REDIRECTS,
    allowedPorts,
    assetProbes: env.SCAN_ASSET_PROBES,
    maxAssetProbes: env.SCAN_MAX_ASSET_PROBES,
    assetMaxBytes: env.SCAN_ASSET_MAX_BYTES,
    historyLimit: env.SCAN_HISTORY_LIMIT,
    retentionHours: env.SCAN_RETENTION_HOURS,
    rateLimitMax: env.RATE_LIMIT_MAX,
    rateLimitWindow: env.RATE_LIMIT_WINDOW,
    createRateLimitMax: env.SCAN_CREATE_RATE_LIMIT_MAX,
    storageDriver: env.STORAGE_DRIVER,
    databaseUrl: env.DATABASE_URL,
    ai: {
      provider: env.AI_PROVIDER,
      baseUrl: env.AI_BASE_URL,
      apiKey: env.AI_API_KEY,
      model: env.AI_MODEL,
    },
  } as const;
}
