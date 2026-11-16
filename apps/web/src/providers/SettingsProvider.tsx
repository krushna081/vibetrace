import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyTheme,
  readSettings,
  resetApiClient,
  resolveTheme,
  writeSettings,
  type AppSettings,
  type ThemePreference,
} from "../lib/settings.js";

interface SettingsContextValue {
  settings: AppSettings;
  resolvedTheme: "dark" | "light";
  revision: number;
  updateSettings: (patch: Partial<AppSettings>) => void;
  setTheme: (theme: ThemePreference) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }): ReactNode {
  const [settings, setSettings] = useState<AppSettings>(() => readSettings());
  const [revision, setRevision] = useState(0);
  const resolvedTheme = resolveTheme(settings.theme);

  useEffect(() => {
    applyTheme(settings.theme);
    if (settings.theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [settings.theme]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      const previousApi = current.apiBaseUrl;
      writeSettings(next);
      applyTheme(next.theme);
      if (next.apiBaseUrl !== previousApi) resetApiClient();
      return next;
    });
    setRevision((value) => value + 1);
  }, []);

  const setTheme = useCallback(
    (theme: ThemePreference) => updateSettings({ theme }),
    [updateSettings],
  );

  const value = useMemo(
    () => ({ settings, resolvedTheme, revision, updateSettings, setTheme }),
    [settings, resolvedTheme, revision, updateSettings, setTheme],
  );

  // Keep the module-level client in sync if another tab changes the API base.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== "vibetrace:settings" || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as Partial<AppSettings>;
        setSettings((current) => ({
          ...current,
          apiBaseUrl:
            typeof parsed.apiBaseUrl === "string" ? parsed.apiBaseUrl : current.apiBaseUrl,
          theme:
            parsed.theme === "light" || parsed.theme === "dark" || parsed.theme === "system"
              ? parsed.theme
              : current.theme,
          aiConsent: parsed.aiConsent === true,
        }));
        resetApiClient();
        setRevision((value) => value + 1);
      } catch {
        // Ignore malformed cross-tab values.
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used inside SettingsProvider.");
  return context;
}
