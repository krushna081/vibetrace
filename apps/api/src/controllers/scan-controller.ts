import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { AIExplanationRequestSchema, CreateScanRequestSchema } from "@vibetrace/shared-types";
import type { ScanService } from "../services/scan-service.js";
import type { AIService } from "../services/ai-service.js";
import { parseBody, parseParams, parseQuery } from "../validators/request.js";

const IdParams = z.object({ id: z.string().uuid("A valid scan id is required.") });
const TokenParams = z.object({ token: z.string().min(20).max(80) });
const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export class ScanController {
  constructor(
    private readonly scans: ScanService,
    private readonly ai: AIService,
  ) {}

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    const input = parseBody(CreateScanRequestSchema, request.body);
    const scan = await this.scans.create(input);
    reply.status(202).send({
      data: {
        id: scan.id,
        status: scan.status,
        progress: scan.progress,
        statusUrl: `/api/v1/scans/${scan.id}/status`,
        reportUrl: `/api/v1/scans/${scan.id}/report`,
        requestId: request.id,
      },
    });
  };

  list = async (request: FastifyRequest, _reply: FastifyReply) => {
    const query = parseQuery(ListQuery, request.query);
    const scans = await this.scans.list(query.limit);
    return { data: { scans, total: scans.length } };
  };

  get = async (request: FastifyRequest, _reply: FastifyReply) => {
    const { id } = parseParams(IdParams, request.params);
    const scan = await this.scans.get(id);
    return {
      data: {
        scan: scan.summary,
        progress: scan.progress,
        error: scan.error,
        startedAt: scan.startedAt,
        sharedAt: scan.sharedAt,
        reportReady: Boolean(scan.report),
      },
    };
  };

  status = async (request: FastifyRequest, _reply: FastifyReply) => {
    const { id } = parseParams(IdParams, request.params);
    return { data: await this.scans.status(id) };
  };

  report = async (request: FastifyRequest, _reply: FastifyReply) => {
    const { id } = parseParams(IdParams, request.params);
    return { data: await this.scans.report(id) };
  };

  remove = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseParams(IdParams, request.params);
    await this.scans.remove(id);
    reply.status(204).send();
  };

  clear = async (_request: FastifyRequest, _reply: FastifyReply) => {
    const deleted = await this.scans.clearAll();
    return { data: { deleted } };
  };

  share = async (request: FastifyRequest, _reply: FastifyReply) => {
    const { id } = parseParams(IdParams, request.params);
    const share = await this.scans.share(id);
    return { data: share };
  };

  unshare = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseParams(IdParams, request.params);
    await this.scans.unshare(id);
    reply.status(204).send();
  };

  shared = async (request: FastifyRequest, _reply: FastifyReply) => {
    const { token } = parseParams(TokenParams, request.params);
    const result = await this.scans.getShared(token);
    return { data: result };
  };

  explain = async (request: FastifyRequest, _reply: FastifyReply) => {
    const { id } = parseParams(IdParams, request.params);
    parseBody(AIExplanationRequestSchema, request.body);
    const report = await this.scans.report(id);
    const explanation = await this.ai.explain(report);
    return { data: explanation };
  };
}
