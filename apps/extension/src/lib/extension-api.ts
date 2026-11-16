import type { ClientHealth } from "@vibetrace/api-client";
import type {
  ExtensionRequest,
  ExtensionResponse,
  ExtensionSettings,
  LastScan,
  ScanSessionResult,
  TestConnectionResult,
} from "./messages.js";
import { normalizeSettings } from "./settings.js";

export class ExtensionRequestError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ExtensionRequestError";
    this.code = code;
  }
}

export async function sendRequest<T>(request: ExtensionRequest): Promise<T> {
  let response: ExtensionResponse<T> | undefined;
  try {
    response = (await chrome.runtime.sendMessage(request)) as ExtensionResponse<T> | undefined;
  } catch (error) {
    throw new ExtensionRequestError(
      "SERVICE_WORKER_UNAVAILABLE",
      error instanceof Error
        ? `The extension worker is unavailable: ${error.message}`
        : "The extension worker is unavailable.",
    );
  }
  if (!response) {
    throw new ExtensionRequestError("EMPTY_RESPONSE", "The extension worker returned no response.");
  }
  if (!response.ok) {
    throw new ExtensionRequestError(response.error.code, response.error.message);
  }
  return response.data;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "An unexpected extension error occurred.";
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function isAnalyzableUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    if (parsed.hostname === "chrome.google.com" && parsed.pathname.startsWith("/webstore"))
      return false;
    if (parsed.hostname === "chromewebstore.google.com") return false;
    return true;
  } catch {
    return false;
  }
}

export async function findActiveTab(): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] ?? null;
}

/**
 * Must be called synchronously from a click handler so Chrome preserves the
 * user gesture. It requests only the API origin, never page access.
 */
export async function requestApiOrigin(apiBaseUrl: string): Promise<void> {
  const normalized = normalizeSettings({
    apiBaseUrl,
    webBaseUrl: "http://localhost:5173",
  });
  if (!normalized) throw new Error("Enter an absolute http(s) API URL without credentials.");
  const origin = new URL(normalized.apiBaseUrl).origin;
  const granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
  if (!granted) {
    throw new Error(
      "Extension access to the API origin was not granted. Chrome cannot call that API until you allow it.",
    );
  }
}

export async function loadSessionSettings(): Promise<{
  settings: ExtensionSettings;
  health: ClientHealth | null;
  lastScan: LastScan | null;
}> {
  const [settings, lastScan] = await Promise.all([
    sendRequest<ExtensionSettings>({ type: "settings:get" }),
    sendRequest<LastScan | null>({ type: "lastScan:get" }),
  ]);
  let health: ClientHealth | null = null;
  try {
    health = await sendRequest<ClientHealth>({ type: "health" });
  } catch {
    health = null;
  }
  return { settings, health, lastScan };
}

export async function testApiConnection(apiBaseUrl: string): Promise<TestConnectionResult> {
  return sendRequest<TestConnectionResult>({ type: "testConnection", apiBaseUrl });
}

export async function getScanSession(
  id: string,
  includeReport: boolean,
): Promise<ScanSessionResult> {
  const status = await sendRequest<ScanSessionResult["status"]>({ type: "scan:status", id });
  if (includeReport && (status.status === "completed" || status.status === "partially_completed")) {
    const report = await sendRequest<NonNullable<ScanSessionResult["report"]>>({
      type: "scan:report",
      id,
    });
    return { status, report };
  }
  return { status };
}
