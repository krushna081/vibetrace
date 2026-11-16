import { DEFAULT_SETTINGS, type ExtensionSettings, type LastScan } from "./messages.js";

const SETTINGS_KEY = "vibetrace:extension:settings";
const LAST_SCAN_KEY = "vibetrace:extension:last-scan";

export function normalizeUrl(value: string, kind: "api" | "web"): string | null {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    if (kind === "api") {
      return url
        .toString()
        .replace(/\/+$/, "")
        .replace(/\/api\/v1$/, "");
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function normalizeSettings(input: Partial<ExtensionSettings>): ExtensionSettings | null {
  const apiBaseUrl = normalizeUrl(input.apiBaseUrl ?? DEFAULT_SETTINGS.apiBaseUrl, "api");
  const webBaseUrl = normalizeUrl(input.webBaseUrl ?? DEFAULT_SETTINGS.webBaseUrl, "web");
  if (!apiBaseUrl || !webBaseUrl) return null;
  return { apiBaseUrl, webBaseUrl };
}

async function readStorage<T>(key: string): Promise<T | null> {
  const result = await chrome.storage.local.get(key);
  return (result[key] as T | undefined) ?? null;
}

export async function getSettings(): Promise<ExtensionSettings> {
  const stored = await readStorage<Partial<ExtensionSettings>>(SETTINGS_KEY);
  return normalizeSettings(stored ?? {}) ?? { ...DEFAULT_SETTINGS };
}

export async function saveSettings(settings: ExtensionSettings): Promise<ExtensionSettings> {
  const normalized = normalizeSettings(settings);
  if (!normalized) throw new Error("Invalid extension settings.");
  await chrome.storage.local.set({ [SETTINGS_KEY]: normalized });
  return normalized;
}

export async function getLastScan(): Promise<LastScan | null> {
  return readStorage<LastScan>(LAST_SCAN_KEY);
}

export async function setLastScan(scan: LastScan): Promise<void> {
  await chrome.storage.local.set({ [LAST_SCAN_KEY]: scan });
}

export async function clearLastScan(): Promise<void> {
  await chrome.storage.local.remove(LAST_SCAN_KEY);
}
