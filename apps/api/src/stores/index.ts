import type { AppConfig } from "../config.js";
import { MemoryScanStore } from "./memory.js";
import { PrismaScanStore } from "./prisma.js";
import type { ScanStore } from "./types.js";

export async function createScanStore(config: AppConfig): Promise<ScanStore> {
  if (config.storageDriver === "prisma") {
    if (!config.databaseUrl) {
      throw new Error("DATABASE_URL is required when STORAGE_DRIVER=prisma.");
    }
    return PrismaScanStore.create(config.databaseUrl, config.retentionHours);
  }
  return new MemoryScanStore({
    historyLimit: config.historyLimit,
    retentionHours: config.retentionHours,
  });
}

export type { ScanStore, StoredScan, StoredScanPatch } from "./types.js";
export { summaryFromReport, emptySummary } from "./types.js";
