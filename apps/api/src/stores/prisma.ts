import type { ScanSummary } from "@vibetrace/shared-types";
import { emptySummary, type StoredScan, type StoredScanPatch, type ScanStore } from "./types.js";

/** Loaded dynamically so the default memory-mode install does not require Prisma. */
async function loadPrisma(databaseUrl: string): Promise<any> {
  const moduleName = "@prisma/client";
  let module: any;
  try {
    module = await import(moduleName);
  } catch (error) {
    throw new Error(
      "STORAGE_DRIVER=prisma requires @prisma/client and a generated client. Install prisma and @prisma/client, run `pnpm db:generate`, then restart the API.",
      { cause: error },
    );
  }
  const PrismaClient = module.PrismaClient ?? module.default?.PrismaClient;
  if (!PrismaClient) throw new Error("The installed @prisma/client does not export PrismaClient.");
  return new PrismaClient({ datasources: { db: { url: databaseUrl } } });
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function rowToScan(row: any): StoredScan {
  const createdAt = new Date(row.createdAt).toISOString();
  return {
    id: row.id,
    url: row.url,
    domain: row.domain,
    mode: row.mode,
    client: row.client,
    status: row.status,
    progress: parseJson(row.progress, { stage: "Queued", percent: 0 }),
    error: parseJson(row.error, null),
    createdAt,
    startedAt: row.startedAt ? new Date(row.startedAt).toISOString() : null,
    completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
    durationMs: row.durationMs ?? null,
    report: parseJson(row.report, null),
    summary:
      parseJson<ScanSummary | null>(row.summary, null) ??
      emptySummary({
        id: row.id,
        url: row.url,
        domain: row.domain,
        mode: row.mode,
        client: row.client,
        status: row.status,
        createdAt,
      }),
    shareToken: row.shareToken ?? null,
    sharedAt: row.sharedAt ? new Date(row.sharedAt).toISOString() : null,
  };
}

export class PrismaScanStore implements ScanStore {
  private constructor(
    private readonly prisma: any,
    private readonly retentionHours: number,
  ) {}

  static async create(databaseUrl: string, retentionHours: number): Promise<PrismaScanStore> {
    const prisma = await loadPrisma(databaseUrl);
    const store = new PrismaScanStore(prisma, retentionHours);
    return store;
  }

  async create(scan: StoredScan): Promise<StoredScan> {
    const row = await this.prisma.scan.create({
      data: {
        id: scan.id,
        url: scan.url,
        domain: scan.domain,
        mode: scan.mode,
        client: scan.client,
        status: scan.status,
        progress: scan.progress,
        error: scan.error ?? undefined,
        createdAt: new Date(scan.createdAt),
        startedAt: scan.startedAt ? new Date(scan.startedAt) : null,
        completedAt: scan.completedAt ? new Date(scan.completedAt) : null,
        durationMs: scan.durationMs,
        report: scan.report ?? undefined,
        summary: scan.summary,
        shareToken: scan.shareToken,
        sharedAt: scan.sharedAt ? new Date(scan.sharedAt) : null,
      },
    });
    return rowToScan(row);
  }

  async get(id: string): Promise<StoredScan | undefined> {
    const row = await this.prisma.scan.findUnique({ where: { id } });
    return row ? rowToScan(row) : undefined;
  }

  async getByShareToken(token: string): Promise<StoredScan | undefined> {
    const row = await this.prisma.scan.findUnique({ where: { shareToken: token } });
    return row ? rowToScan(row) : undefined;
  }

  async update(id: string, patch: StoredScanPatch): Promise<StoredScan | undefined> {
    const data: Record<string, unknown> = {};
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.progress !== undefined) data.progress = patch.progress;
    if (patch.error !== undefined) data.error = patch.error;
    if (patch.startedAt !== undefined)
      data.startedAt = patch.startedAt ? new Date(patch.startedAt) : null;
    if (patch.completedAt !== undefined)
      data.completedAt = patch.completedAt ? new Date(patch.completedAt) : null;
    if (patch.durationMs !== undefined) data.durationMs = patch.durationMs;
    if (patch.report !== undefined) data.report = patch.report;
    if (patch.summary !== undefined) data.summary = patch.summary;
    if (patch.shareToken !== undefined) data.shareToken = patch.shareToken;
    if (patch.sharedAt !== undefined)
      data.sharedAt = patch.sharedAt ? new Date(patch.sharedAt) : null;

    try {
      const row = await this.prisma.scan.update({ where: { id }, data });
      return rowToScan(row);
    } catch {
      return undefined;
    }
  }

  async list(limit: number) {
    const rows = await this.prisma.scan.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.max(1, Math.min(limit, 500)),
      select: { summary: true },
    });
    return rows.map((row: any) => parseJson(row.summary, {}));
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.scan.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async clear(): Promise<number> {
    const result = await this.prisma.scan.deleteMany({});
    return result.count ?? 0;
  }

  async purgeExpired(): Promise<number> {
    const cutoff = new Date(Date.now() - this.retentionHours * 60 * 60 * 1000);
    const result = await this.prisma.scan.deleteMany({ where: { createdAt: { lt: cutoff } } });
    return result.count ?? 0;
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
