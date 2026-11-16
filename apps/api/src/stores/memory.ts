import type { StoredScan, StoredScanPatch, ScanStore } from "./types.js";

export interface MemoryStoreOptions {
  historyLimit: number;
  retentionHours: number;
}

export class MemoryScanStore implements ScanStore {
  private readonly scans = new Map<string, StoredScan>();
  private readonly historyLimit: number;
  private readonly retentionMs: number;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(options: MemoryStoreOptions) {
    this.historyLimit = options.historyLimit;
    this.retentionMs = options.retentionHours * 60 * 60 * 1000;
    this.cleanupTimer = setInterval(
      () => {
        void this.purgeExpired();
      },
      10 * 60 * 1000,
    );
    this.cleanupTimer.unref?.();
  }

  private purgeInMemory(): number {
    const cutoff = Date.now() - this.retentionMs;
    let removed = 0;
    for (const [id, scan] of this.scans) {
      if (new Date(scan.createdAt).getTime() < cutoff) {
        this.scans.delete(id);
        removed += 1;
      }
    }
    while (this.scans.size > this.historyLimit) {
      const oldest = this.scans.keys().next().value as string | undefined;
      if (!oldest) break;
      this.scans.delete(oldest);
      removed += 1;
    }
    return removed;
  }

  async create(scan: StoredScan): Promise<StoredScan> {
    this.purgeInMemory();
    this.scans.set(scan.id, structuredClone(scan));
    return structuredClone(scan);
  }

  async get(id: string): Promise<StoredScan | undefined> {
    this.purgeInMemory();
    const scan = this.scans.get(id);
    return scan ? structuredClone(scan) : undefined;
  }

  async getByShareToken(token: string): Promise<StoredScan | undefined> {
    this.purgeInMemory();
    for (const scan of this.scans.values()) {
      if (scan.shareToken === token) return structuredClone(scan);
    }
    return undefined;
  }

  async update(id: string, patch: StoredScanPatch): Promise<StoredScan | undefined> {
    const existing = this.scans.get(id);
    if (!existing) return undefined;
    const next = { ...existing, ...patch };
    this.scans.set(id, next);
    return structuredClone(next);
  }

  async list(limit: number): Promise<StoredScan["summary"][]> {
    this.purgeInMemory();
    return [...this.scans.values()]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, Math.max(1, Math.min(limit, this.historyLimit)))
      .map((scan) => scan.summary);
  }

  async delete(id: string): Promise<boolean> {
    return this.scans.delete(id);
  }

  async clear(): Promise<number> {
    const count = this.scans.size;
    this.scans.clear();
    return count;
  }

  async purgeExpired(): Promise<number> {
    return this.purgeInMemory();
  }

  async close(): Promise<void> {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cleanupTimer = null;
  }
}
