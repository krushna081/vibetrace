import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientHealth } from "@vibetrace/api-client";
import type { ScanProgress, ScanReport, ScanStatusInfo } from "@vibetrace/shared-types";
import type {
  CaptureResult,
  ExtensionSettings,
  LastScan,
  TestConnectionResult,
} from "../lib/messages.js";
import {
  domainOf,
  errorMessage,
  findActiveTab,
  getScanSession,
  isAnalyzableUrl,
  loadSessionSettings,
  requestApiOrigin,
  sendRequest,
} from "../lib/extension-api.js";
import { normalizeSettings } from "../lib/settings.js";

export type ScanPhase = "idle" | "capturing" | "analyzing" | "done" | "error";

export interface ActiveSession {
  id: string;
  url: string;
  domain: string;
  createdAt: string;
  status: ScanStatusInfo["status"];
  progress: ScanProgress;
  error: string | null;
  report?: ScanReport;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function terminalSuccess(status: ScanStatusInfo["status"]): boolean {
  return status === "completed" || status === "partially_completed";
}

export function useExtension() {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [tab, setTab] = useState<chrome.tabs.Tab | null>(null);
  const [health, setHealth] = useState<ClientHealth | null>(null);
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [lastReport, setLastReport] = useState<ScanReport | null>(null);
  const [recent, setRecent] = useState<LastScan | null>(null);
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);

  const alive = useRef(true);
  const generation = useRef(0);
  const booted = useRef(false);

  const pollStatus = useCallback(async (id: string, run: number) => {
    let failures = 0;
    while (alive.current && generation.current === run) {
      try {
        const status = await sendRequest<ScanStatusInfo>({ type: "scan:status", id });
        if (!alive.current || generation.current !== run) return;
        failures = 0;
        setSession((previous) =>
          previous && previous.id === id
            ? {
                ...previous,
                status: status.status,
                progress: status.progress,
                error: status.error?.message ?? null,
              }
            : previous,
        );
        setRecent((previous) =>
          previous && previous.id === id ? { ...previous, status: status.status } : previous,
        );

        if (status.status === "failed") {
          setError(status.error?.message ?? "The analysis failed.");
          setPhase("error");
          return;
        }

        if (terminalSuccess(status.status)) {
          try {
            const result = await getScanSession(id, true);
            if (!alive.current || generation.current !== run) return;
            if (result.report) {
              setSession((previous) =>
                previous && previous.id === id
                  ? { ...previous, report: result.report, progress: status.progress }
                  : previous,
              );
              setLastReport(result.report);
            }
            setPhase("done");
          } catch (reportError) {
            setError(
              `The analysis finished but its report could not be loaded: ${errorMessage(reportError)}`,
            );
            setPhase("error");
          }
          return;
        }

        await sleep(1_200);
      } catch (statusError) {
        failures += 1;
        if (failures >= 3) {
          setError(`Lost contact with the analysis API: ${errorMessage(statusError)}`);
          setPhase("error");
          return;
        }
        await sleep(1_600);
      }
    }
  }, []);

  const refreshTab = useCallback(async () => {
    try {
      const current = await findActiveTab();
      if (alive.current) setTab(current);
    } catch {
      // The tab can disappear while Chrome is closing it.
    }
  }, []);

  const refreshHealth = useCallback(async () => {
    try {
      const next = await sendRequest<ClientHealth>({ type: "health" });
      if (alive.current) setHealth(next);
    } catch {
      if (alive.current) setHealth(null);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    if (booted.current) return;
    booted.current = true;

    void (async () => {
      try {
        const [{ settings: loadedSettings, health: loadedHealth, lastScan }, currentTab] =
          await Promise.all([loadSessionSettings(), findActiveTab().catch(() => null)]);
        if (!alive.current) return;
        setSettings(loadedSettings);
        setHealth(loadedHealth);
        setTab(currentTab);
        setRecent(lastScan);

        if (lastScan && (lastScan.status === "queued" || lastScan.status === "running")) {
          const run = ++generation.current;
          setSession({
            id: lastScan.id,
            url: lastScan.url,
            domain: lastScan.domain,
            createdAt: lastScan.createdAt,
            status: lastScan.status,
            progress: {
              stage: "Resuming",
              percent: lastScan.status === "queued" ? 8 : 42,
              message: "Reconnected to an analysis already in progress.",
            },
            error: null,
          });
          setPhase("analyzing");
          void pollStatus(lastScan.id, run);
        } else if (lastScan && terminalSuccess(lastScan.status)) {
          try {
            const report = await sendRequest<ScanReport>({ type: "scan:report", id: lastScan.id });
            if (alive.current) setLastReport(report);
          } catch {
            // The report may have disappeared after a server restart.
          }
        }
      } catch (startupError) {
        if (alive.current) setError(errorMessage(startupError));
      } finally {
        if (alive.current) setLoading(false);
      }
    })();

    const onActivated = () => void refreshTab();
    const onUpdated = (_tabId: number, changeInfo: { url?: string; status?: string }) => {
      if (changeInfo.url || changeInfo.status === "complete") void refreshTab();
    };
    const onFocus = () => void refreshTab();
    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.windows.onFocusChanged.addListener(onFocus);

    return () => {
      alive.current = false;
      generation.current += 1;
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.windows.onFocusChanged.removeListener(onFocus);
    };
  }, [pollStatus, refreshTab]);

  const startScan = useCallback(async () => {
    const target = tab ?? (await findActiveTab());
    if (!target?.id || !target.url) {
      setError("No active tab is available. Open a normal website and try again.");
      setPhase("error");
      return;
    }
    if (!isAnalyzableUrl(target.url)) {
      setError(
        "Chrome blocks extension access to this page. Open a normal public http(s) page and try again.",
      );
      setPhase("error");
      return;
    }

    const run = ++generation.current;
    setCapturing(true);
    setPhase("capturing");
    setError(null);
    setSession(null);
    setLastReport(null);

    try {
      const captured = await sendRequest<CaptureResult>({
        type: "capture",
        tabId: target.id,
        tabUrl: target.url,
      });
      if (!alive.current || generation.current !== run) return;

      const domain = domainOf(target.url);
      const createdAt = new Date().toISOString();
      setSession({
        id: captured.scan.id,
        url: target.url,
        domain,
        createdAt,
        status: captured.scan.status,
        progress: captured.scan.progress,
        error: null,
      });
      setRecent({
        id: captured.scan.id,
        url: target.url,
        domain,
        createdAt,
        status: captured.scan.status,
      });
      setCapturing(false);
      setPhase("analyzing");
      void pollStatus(captured.scan.id, run);
    } catch (captureError) {
      if (!alive.current || generation.current !== run) return;
      setCapturing(false);
      setError(errorMessage(captureError));
      setPhase("error");
    }
  }, [pollStatus, tab]);

  const saveSettings = useCallback(
    async (next: ExtensionSettings) => {
      const normalized = normalizeSettings(next);
      if (!normalized) throw new Error("Use absolute http(s) URLs without credentials.");
      await requestApiOrigin(normalized.apiBaseUrl);
      const saved = await sendRequest<ExtensionSettings>({
        type: "settings:set",
        settings: normalized,
      });
      setSettings(saved);
      await refreshHealth();
      return saved;
    },
    [refreshHealth],
  );

  const testConnection = useCallback(async (apiBaseUrl: string) => {
    const normalized = normalizeSettings({ apiBaseUrl, webBaseUrl: "http://localhost:5173" });
    if (!normalized) throw new Error("Use an absolute http(s) API URL without credentials.");
    await requestApiOrigin(normalized.apiBaseUrl);
    return sendRequest<TestConnectionResult>({
      type: "testConnection",
      apiBaseUrl: normalized.apiBaseUrl,
    });
  }, []);

  const openReport = useCallback(async (id: string) => {
    return sendRequest<{ url: string }>({ type: "openReport", id });
  }, []);

  const openWeb = useCallback(async (path = "/") => {
    return sendRequest<{ url: string }>({ type: "openWeb", path });
  }, []);

  const openSidePanel = useCallback(async () => {
    const target = tab ?? (await findActiveTab());
    if (!target?.windowId) throw new Error("No Chrome window is available.");
    await chrome.sidePanel.open({ windowId: target.windowId });
  }, [tab]);

  const busy = capturing || phase === "analyzing";
  const canAnalyze = Boolean(tab?.url && isAnalyzableUrl(tab.url));

  return {
    loading,
    settings,
    tab,
    health,
    session,
    recent,
    lastReport,
    phase,
    error,
    capturing,
    busy,
    canAnalyze,
    startScan,
    refreshTab,
    refreshHealth,
    saveSettings,
    testConnection,
    openReport,
    openWeb,
    openSidePanel,
    clearError: () => setError(null),
  };
}

export type ExtensionController = ReturnType<typeof useExtension>;
