import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import type { AnalyzeOptions } from "@vibetrace/analysis-engine";
import { loadConfig, type AppConfig } from "./config.js";
import { createScanStore, type ScanStore } from "./stores/index.js";
import { ScanService } from "./services/scan-service.js";
import { AIService } from "./services/ai-service.js";
import { ScanController } from "./controllers/scan-controller.js";
import { MetaController } from "./controllers/meta-controller.js";
import { registerErrorHandling } from "./middleware/errors.js";
import { registerRoutes } from "./routes/index.js";

export interface BuildAppOptions {
  config?: AppConfig;
  store?: ScanStore;
  scanService?: ScanService;
  analyzeOptions?: Partial<AnalyzeOptions>;
  logger?: boolean;
}

function isAllowedOrigin(origin: string | undefined, config: AppConfig): boolean {
  if (!origin) return true;
  if (config.corsOrigins.includes("*")) return true;
  if (origin.startsWith("chrome-extension://")) return true;
  return config.corsOrigins.includes(origin);
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();
  const app = Fastify({
    logger:
      options.logger === false
        ? false
        : {
            level: config.logLevel,
            redact: {
              paths: [
                "req.headers.authorization",
                "req.headers.cookie",
                "res.headers.set-cookie",
                "*.apiKey",
                "*.password",
              ],
              censor: "[redacted]",
            },
            ...(config.nodeEnv === "development"
              ? {
                  transport: {
                    target: "pino-pretty",
                    options: {
                      colorize: true,
                      translateTime: "SYS:standard",
                      ignore: "pid,hostname",
                    },
                  },
                }
              : {}),
          },
    bodyLimit: 2_000_000,
    requestTimeout: 30_000,
    genReqId: (request) => {
      const incoming = request.headers["x-request-id"];
      if (typeof incoming === "string" && /^[A-Za-z0-9._-]{8,100}$/.test(incoming)) return incoming;
      return randomUUID();
    },
  });

  await app.register(cors, {
    origin: (origin, callback) => {
      callback(null, isAllowedOrigin(origin, config));
    },
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id", "Retry-After"],
    credentials: false,
    maxAge: 600,
  });

  await app.register(rateLimit, {
    global: true,
    max: config.rateLimitMax,
    timeWindow: config.rateLimitWindow,
    errorResponseBuilder: (request, context) => ({
      error: {
        code: "RATE_LIMITED",
        message: `Too many requests. Retry after ${context.after}.`,
      },
      requestId: request.id,
    }),
  });

  app.addHook("onSend", async (request, reply, payload) => {
    reply.header("x-request-id", request.id);
    reply.header("x-content-type-options", "nosniff");
    reply.header("referrer-policy", "no-referrer");
    reply.header("cache-control", "no-store");
    reply.header("permissions-policy", "camera=(), microphone=(), geolocation=()");
    reply.header(
      "content-security-policy",
      "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    );
    return payload;
  });

  const store = options.store ?? (await createScanStore(config));
  const scanService =
    options.scanService ??
    new ScanService({
      store,
      config,
      analyzeOptions: options.analyzeOptions,
      logger: app.log,
    });
  const aiService = new AIService(config.ai);
  const scanController = new ScanController(scanService, aiService);
  const metaController = new MetaController(config, scanService, aiService);

  registerErrorHandling(app);
  registerRoutes(app, config, scanController, metaController);

  app.addHook("onClose", async () => {
    await scanService.shutdown();
  });

  return app;
}
