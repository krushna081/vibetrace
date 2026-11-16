import { useEffect, useState } from "react";
import type {
  ScanProgress,
  ScanReport,
  ScanStatusInfo,
  ScanSummary,
} from "@vibetrace/shared-types";
import type { ClientHealth, ScanDetail } from "@vibetrace/api-client";
import { getApiClient } from "../lib/settings.js";
import { loadReport, primeReport } from "../lib/report-cache.js";
import { useSettings } from "../providers/SettingsProvider.js";

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

export function usePageTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · VibeTrace`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

export interface HealthState {
  health: ClientHealth | null;
  loading: boolean;
  error: unknown;
  checkedAt: number | null;
}

export function useHealth(pollMs = 45_000): HealthState {
  const { revision } = useSettings();
  const [health, setHealth] = useState<HealthState["health"]>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;

    const check = async () => {
      try {
        const next = await getApiClient().health();
        if (cancelled) return;
        setHealth(next);
        setError(null);
        setCheckedAt(Date.now());
      } catch (err) {
        if (cancelled) return;
        setHealth(null);
        setError(err);
        setCheckedAt(Date.now());
      } finally {
        if (!cancelled) {
          setLoading(false);
          timer = window.setTimeout(check, pollMs);
        }
      }
    };

    setLoading(true);
    void check();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pollMs, revision]);

  return { health, loading, error, checkedAt };
}

export interface HistoryState {
  scans: ScanSummary[];
  loading: boolean;
  error: unknown;
  total: number;
  refresh: () => void;
  remove: (id: string) => Promise<void>;
  clear: () => Promise<number>;
}

export function useHistory(limit = 100): HistoryState {
  const { revision } = useSettings();
  const [scans, setScans] = useState<ScanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getApiClient()
      .listScans(limit)
      .then((result) => {
        if (cancelled) return;
        setScans(result.scans);
        setTotal(result.total);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [limit, refreshKey, revision]);

  const remove = async (id: string) => {
    await getApiClient().deleteScan(id);
    setScans((current) => current.filter((scan) => scan.id !== id));
    setTotal((current) => Math.max(0, current - 1));
  };

  const clear = async () => {
    const deleted = await getApiClient().clearScans();
    setScans([]);
    setTotal(0);
    return deleted;
  };

  return {
    scans,
    loading,
    error,
    total,
    refresh: () => setRefreshKey((value) => value + 1),
    remove,
    clear,
  };
}

export interface ScanSessionState {
  id: string;
  detail: ScanDetail | null;
  status: ScanStatusInfo | null;
  progress: ScanProgress;
  report: ScanReport | null;
  error: unknown;
  loading: boolean;
  pollError: unknown;
  refresh: () => void;
  startedAt: number;
}

export function useScanSession(id: string | undefined): ScanSessionState {
  const { revision } = useSettings();
  const [detail, setDetail] = useState<ScanDetail | null>(null);
  const [status, setStatus] = useState<ScanStatusInfo | null>(null);
  const [progress, setProgress] = useState<ScanProgress>({ stage: "Loading", percent: 0 });
  const [report, setReport] = useState<ScanReport | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [pollError, setPollError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [startedAt, setStartedAt] = useState(() => Date.now());

  useEffect(() => {
    if (!id) {
      setError(new Error("A scan id is required."));
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPollError(null);
    setReport(null);
    setDetail(null);
    setStatus(null);
    setProgress({ stage: "Loading", percent: 0 });
    setStartedAt(Date.now());

    const run = async () => {
      const client = getApiClient();
      try {
        const [nextDetail, nextStatus] = await Promise.all([
          client.getScan(id),
          client.getScanStatus(id),
        ]);
        if (cancelled) return;
        setDetail(nextDetail);
        setStatus(nextStatus);
        setProgress(nextStatus.progress);
        setStartedAt(new Date(nextStatus.createdAt).getTime() || Date.now());

        if (nextStatus.status === "failed") {
          setError(
            new Error(nextStatus.error?.message ?? "The scan failed before a report was produced."),
          );
          setLoading(false);
          return;
        }

        if (
          nextStatus.status === "completed" ||
          nextStatus.status === "partially_completed" ||
          nextDetail.reportReady
        ) {
          const nextReport = await client.getReport(id);
          if (cancelled) return;
          primeReport(nextReport);
          setReport(nextReport);
          setLoading(false);
          return;
        }

        setLoading(false);

        for (;;) {
          await delay(1_300, controller.signal);
          if (cancelled || controller.signal.aborted) return;
          let polled: ScanStatusInfo;
          try {
            polled = await client.getScanStatus(id);
          } catch (err) {
            if (cancelled) return;
            setPollError(err);
            return;
          }
          if (cancelled) return;
          setStatus(polled);
          setProgress(polled.progress);

          if (polled.status === "failed") {
            setError(new Error(polled.error?.message ?? "The scan failed."));
            return;
          }
          if (polled.status === "completed" || polled.status === "partially_completed") {
            try {
              const nextReport = await client.getReport(id);
              if (cancelled) return;
              primeReport(nextReport);
              setReport(nextReport);
            } catch (err) {
              if (!cancelled) setError(err);
            }
            return;
          }
        }
      } catch (err) {
        if (cancelled) return;
        setError(err);
        setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [id, refreshKey, revision]);

  return {
    id: id ?? "",
    detail,
    status,
    progress,
    report,
    error,
    loading,
    pollError,
    refresh: () => {
      setRefreshKey((value) => value + 1);
      setLoading(true);
    },
    startedAt,
  };
}

export interface ReportState {
  report: ScanReport | null;
  loading: boolean;
  error: unknown;
  refresh: () => void;
}

export function useReport(id: string | undefined): ReportState {
  const { revision } = useSettings();
  const [report, setReport] = useState<ScanReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!id) {
      setError(new Error("A scan id is required."));
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadReport(id, { force: refreshKey > 0 })
      .then((next) => {
        if (cancelled) return;
        setReport(next);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, refreshKey, revision]);

  return {
    report,
    loading,
    error,
    refresh: () => setRefreshKey((value) => value + 1),
  };
}
