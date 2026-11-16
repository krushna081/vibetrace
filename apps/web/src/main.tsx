import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@vibetrace/design-system/styles.css";
import "./styles.css";
import { App } from "./App.js";
import { SettingsProvider } from "./providers/SettingsProvider.js";
import { ToastProvider } from "./providers/ToastProvider.js";
import { AppErrorBoundary } from "./components/AppErrorBoundary.js";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element.");

createRoot(root).render(
  <StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <SettingsProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </SettingsProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>,
);
