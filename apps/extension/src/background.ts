import { ApiClientError, VibeTraceClient } from "@vibetrace/api-client";
import { PageSnapshotSchema } from "@vibetrace/shared-types";
import type {
  CaptureResult,
  ExtensionErrorPayload,
  ExtensionRequest,
  ExtensionResponse,
  TestConnectionResult,
} from "./lib/messages.js";
import {
  getLastScan,
  getSettings,
  normalizeUrl,
  saveSettings,
  setLastScan,
} from "./lib/settings.js";

async function clientFor(apiBaseUrl: string): Promise<VibeTraceClient> {
  return new VibeTraceClient({ baseUrl: apiBaseUrl, timeoutMs: 30_000 });
}

async function currentClient(): Promise<VibeTraceClient> {
  const settings = await getSettings();
  return clientFor(settings.apiBaseUrl);
}

function serializeError(error: unknown): ExtensionErrorPayload {
  if (error instanceof ApiClientError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof Error) {
    if (
      /Cannot access contents|Cannot access a chrome|Missing host permission|The extensions gallery cannot be scripted/i.test(
        error.message,
      )
    ) {
      return {
        code: "PAGE_ACCESS_DENIED",
        message:
          "Chrome blocks extension access to this page. Open a normal public http(s) page and try again.",
      };
    }
    if (/Frame with ID 0 was removed|No tab with id|The tab was closed/i.test(error.message)) {
      return {
        code: "TAB_UNAVAILABLE",
        message: "The tab was closed or navigated while capturing.",
      };
    }
    if (/Could not establish connection|Receiving end does not exist/i.test(error.message)) {
      return {
        code: "CONTENT_UNAVAILABLE",
        message: "The page did not accept the content script. Reload the page and try again.",
      };
    }
    return { code: "EXTENSION_ERROR", message: error.message };
  }
  return { code: "EXTENSION_ERROR", message: "An unexpected extension error occurred." };
}

async function setBadge(text: string, color: string): Promise<void> {
  try {
    await chrome.action.setBadgeText({ text });
    await chrome.action.setBadgeBackgroundColor({ color });
  } catch {
    // Badge updates are cosmetic.
  }
}

async function handleCapture(tabId: number, tabUrl: string): Promise<CaptureResult> {
  if (!Number.isInteger(tabId) || tabId < 0) throw new Error("A valid tab id is required.");
  if (!/^https?:\/\//i.test(tabUrl)) {
    throw new Error(
      "This page cannot be analyzed. Use a public http(s) page; chrome://, file:// and extension pages are blocked by Chrome.",
    );
  }

  await setBadge("…", "#b8ff42");

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"],
  });

  const response = (await chrome.tabs.sendMessage(tabId, {
    type: "VIBETRACE_COLLECT",
  })) as unknown;

  if (!response || typeof response !== "object" || !("ok" in response)) {
    throw new Error("The content script returned no snapshot.");
  }
  const content = response as { ok: boolean; snapshot?: unknown; error?: ExtensionErrorPayload };
  if (!content.ok) {
    throw new Error(content.error?.message ?? "The page snapshot could not be captured.");
  }

  const parsed = PageSnapshotSchema.safeParse(content.snapshot);
  if (!parsed.success) {
    throw new Error(
      `The page snapshot failed validation: ${parsed.error.issues[0]?.message ?? "unknown issue"}`,
    );
  }
  const snapshot = parsed.data;
  if (!snapshot.html.trim()) {
    throw new Error("No inspectable HTML was found on this page.");
  }

  const client = await currentClient();
  const created = await client.createScan({
    url: snapshot.url,
    mode: "snapshot",
    client: "extension",
    snapshot,
  });

  const domain = new URL(snapshot.url).hostname.replace(/^www\./, "");
  await setLastScan({
    id: created.id,
    url: snapshot.url,
    domain,
    createdAt: new Date().toISOString(),
    status: created.status,
  });
  await setBadge("…", "#b8ff42");

  return {
    scan: created,
    snapshot: {
      htmlBytes: new TextEncoder().encode(snapshot.html).length,
      nodeCount: snapshot.dom.nodeCount,
      scriptCount: snapshot.scriptSources.length,
      imageCount: snapshot.dom.imageCount,
    },
  };
}

async function handleMessage(message: ExtensionRequest): Promise<unknown> {
  switch (message.type) {
    case "settings:get":
      return getSettings();

    case "settings:set": {
      const normalized = await saveSettings(message.settings);
      return normalized;
    }

    case "health": {
      const client = await currentClient();
      return client.health();
    }

    case "testConnection": {
      const base = normalizeUrl(message.apiBaseUrl, "api");
      if (!base) throw new Error("The API URL must be an absolute http(s) URL.");
      const client = await clientFor(base);
      const health = await client.health();
      const result: TestConnectionResult = {
        health,
        checkedAt: new Date().toISOString(),
      };
      return result;
    }

    case "lastScan:get":
      return getLastScan();

    case "capture":
      return handleCapture(message.tabId, message.tabUrl);

    case "scan:status": {
      const client = await currentClient();
      const status = await client.getScanStatus(message.id);
      const last = await getLastScan();
      if (last && last.id === message.id) {
        await setLastScan({ ...last, status: status.status });
      }
      if (status.status === "completed" || status.status === "partially_completed") {
        await setBadge("✓", "#b8ff42");
      } else if (status.status === "failed") {
        await setBadge("!", "#ff6b6b");
      } else {
        await setBadge("…", "#b8ff42");
      }
      return status;
    }

    case "scan:detail": {
      const client = await currentClient();
      return client.getScan(message.id);
    }

    case "scan:report": {
      const client = await currentClient();
      return client.getReport(message.id);
    }

    case "openReport": {
      const settings = await getSettings();
      const url = `${settings.webBaseUrl}/scan/${encodeURIComponent(message.id)}`;
      await chrome.tabs.create({ url });
      return { url };
    }

    case "openWeb": {
      const settings = await getSettings();
      const path = message.path && message.path.startsWith("/") ? message.path : "/";
      const url = `${settings.webBaseUrl}${path}`;
      await chrome.tabs.create({ url });
      return { url };
    }

    default:
      throw new Error("Unknown extension request.");
  }
}

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse: (response: ExtensionResponse<unknown>) => void) => {
    const request = message as ExtensionRequest | null;
    if (!request || typeof request !== "object" || typeof request.type !== "string") {
      return false;
    }
    void handleMessage(request)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error: unknown) => sendResponse({ ok: false, error: serializeError(error) }));
    return true;
  },
);

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => undefined);
  void setBadge("", "#b8ff42");
});

chrome.commands?.onCommand.addListener((command) => {
  if (command !== "analyze-current-tab") return;
  void chrome.tabs.query({ active: true, currentWindow: true }).then(async (tabs) => {
    const tab = tabs[0];
    if (!tab?.id || !tab.url) return;
    try {
      await handleCapture(tab.id, tab.url);
    } catch {
      await setBadge("!", "#ff6b6b");
    }
  });
});
