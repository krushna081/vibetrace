import { lazy, Suspense, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { Spinner } from "@vibetrace/design-system";
import { AppShell } from "./components/AppShell.js";

const LandingPage = lazy(() =>
  import("./pages/LandingPage.js").then((module) => ({ default: module.LandingPage })),
);
const ScannerPage = lazy(() =>
  import("./pages/ScannerPage.js").then((module) => ({ default: module.ScannerPage })),
);
const ScanPage = lazy(() =>
  import("./pages/ScanPage.js").then((module) => ({ default: module.ScanPage })),
);
const AISignalsPage = lazy(() =>
  import("./pages/AISignalsPage.js").then((module) => ({ default: module.AISignalsPage })),
);
const TechnologyPage = lazy(() =>
  import("./pages/TechnologyPage.js").then((module) => ({ default: module.TechnologyPage })),
);
const SecurityPage = lazy(() =>
  import("./pages/SecurityPage.js").then((module) => ({ default: module.SecurityPage })),
);
const PerformancePage = lazy(() =>
  import("./pages/PerformancePage.js").then((module) => ({ default: module.PerformancePage })),
);
const QualityPage = lazy(() =>
  import("./pages/QualityPage.js").then((module) => ({ default: module.QualityPage })),
);
const HistoryPage = lazy(() =>
  import("./pages/HistoryPage.js").then((module) => ({ default: module.HistoryPage })),
);
const ComparePage = lazy(() =>
  import("./pages/ComparePage.js").then((module) => ({ default: module.ComparePage })),
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage.js").then((module) => ({ default: module.SettingsPage })),
);
const MethodologyPage = lazy(() =>
  import("./pages/MethodologyPage.js").then((module) => ({ default: module.MethodologyPage })),
);
const PrivacyPage = lazy(() =>
  import("./pages/PrivacyPage.js").then((module) => ({ default: module.PrivacyPage })),
);
const SharedReportPage = lazy(() =>
  import("./pages/SharedReportPage.js").then((module) => ({ default: module.SharedReportPage })),
);
const PrintPage = lazy(() =>
  import("./pages/PrintPage.js").then((module) => ({ default: module.PrintPage })),
);
const NotFoundPage = lazy(() =>
  import("./pages/NotFoundPage.js").then((module) => ({ default: module.NotFoundPage })),
);

function ScrollToTop(): null {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const id = decodeURIComponent(hash.slice(1));
      const timer = window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
      return () => window.clearTimeout(timer);
    }
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    return undefined;
  }, [pathname, hash]);
  return null;
}

function RouteFallback(): React.ReactNode {
  return (
    <div className="route-loading" role="status">
      <Spinner label="Loading page" />
      <span>Loading page</span>
    </div>
  );
}

export function App(): React.ReactNode {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<LandingPage />} />
            <Route path="/scan" element={<ScannerPage />} />
            <Route path="/scan/:id" element={<ScanPage />} />
            <Route path="/scan/:id/ai" element={<AISignalsPage />} />
            <Route path="/scan/:id/technology" element={<TechnologyPage />} />
            <Route path="/scan/:id/security" element={<SecurityPage />} />
            <Route path="/scan/:id/performance" element={<PerformancePage />} />
            <Route path="/scan/:id/quality" element={<QualityPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/methodology" element={<MethodologyPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/shared/:token" element={<SharedReportPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route path="/scan/:id/print" element={<PrintPage />} />
        </Routes>
      </Suspense>
    </>
  );
}
