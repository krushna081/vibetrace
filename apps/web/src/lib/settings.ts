import { VibeTraceClient } from "@vibetrace/api-client";

export type ThemePreference = "dark" | "light" | "system";

export interface AppSettings {
  theme: ThemePreference;
  apiBaseUrl: string;
  aiConsent: boolean;
}

export const SETTINGS_KEY = "vibetrace:settings";

const envBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();

export const DEFAULT_API_BASE_URL =
  envBase && envBase.length > 0 ? envBase : "http://localhost:8787";

const DEFAULTS: AppSettings = {
  theme: "dark",
  apiBaseUrl: DEFAULT_API_BASE_URL,
  aiConsent: false,
};

export function normalizeApiBaseUrl(value: string): string | null {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    if (!url.hostname) return null;
    return trimmed.replace(/\/api\/v1$/, "");
  } catch {
    return null;
  }
}

export function readSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const theme =
      parsed.theme === "light" || parsed.theme === "dark" || parsed.theme === "system"
        ? parsed.theme
        : DEFAULTS.theme;
    const apiBaseUrl =
      typeof parsed.apiBaseUrl === "string"
        ? (normalizeApiBaseUrl(parsed.apiBaseUrl) ?? DEFAULTS.apiBaseUrl)
        : DEFAULTS.apiBaseUrl;
    return { theme, apiBaseUrl, aiConsent: parsed.aiConsent === true };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable (private mode / hardened browsers); settings stay in memory.
  }
}

export function systemPrefersLight(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches
  );
}

export function resolveTheme(preference: ThemePreference): "dark" | "light" {
  if (preference === "system") return systemPrefersLight() ? "light" : "dark";
  return preference;
}

export function applyTheme(preference: ThemePreference): void {
  const resolved = resolveTheme(preference);
  document.documentElement.dataset.theme = resolved;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", resolved === "light" ? "#f4f5ef" : "#050605");
}

let activeClient: VibeTraceClient | null = null;
let activeBaseUrl = "";

export function getApiClient(): VibeTraceClient {
  const settings = readSettings();
  if (!activeClient || activeBaseUrl !== settings.apiBaseUrl) {
    activeBaseUrl = settings.apiBaseUrl;
    activeClient = new VibeTraceClient({ baseUrl: settings.apiBaseUrl, timeoutMs: 30_000 });
  }
  return activeClient;
}

export function createClientFor(baseUrl: string): VibeTraceClient | null {
  const normalized = normalizeApiBaseUrl(baseUrl);
  if (!normalized) return null;
  return new VibeTraceClient({ baseUrl: normalized, timeoutMs: 15_000 });
}

export function resetApiClient(): void {
  activeClient = null;
  activeBaseUrl = "";
}
