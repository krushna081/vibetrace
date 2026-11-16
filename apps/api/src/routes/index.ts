import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config.js";
import type { ScanController } from "../controllers/scan-controller.js";
import type { MetaController } from "../controllers/meta-controller.js";

export function registerRoutes(
  app: FastifyInstance,
  config: AppConfig,
  scans: ScanController,
  meta: MetaController,
): void {
  app.get("/", async (_request, reply) => reply.redirect("/api/v1/docs"));

  app.get("/api/v1/health", meta.health);

  app.post(
    "/api/v1/scans",
    {
      config: { rateLimit: { max: config.createRateLimitMax, timeWindow: config.rateLimitWindow } },
    },
    scans.create,
  );
  app.get("/api/v1/scans", scans.list);
  app.delete("/api/v1/scans", scans.clear);

  app.get("/api/v1/scans/:id", scans.get);
  app.delete("/api/v1/scans/:id", scans.remove);
  app.get("/api/v1/scans/:id/status", scans.status);
  app.get("/api/v1/scans/:id/report", scans.report);
  app.post("/api/v1/scans/:id/share", scans.share);
  app.delete("/api/v1/scans/:id/share", scans.unshare);
  app.post(
    "/api/v1/scans/:id/explain",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    scans.explain,
  );

  app.get(
    "/api/v1/public/reports/:token",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    scans.shared,
  );

  app.get("/api/v1/technologies", meta.technologies);
  app.get("/api/v1/fingerprints", meta.fingerprints);
  app.get("/api/v1/openapi.json", meta.openapi);
  app.get("/api/v1/docs", meta.docs);
}
