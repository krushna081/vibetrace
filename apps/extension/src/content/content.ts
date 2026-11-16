import type { ContentCollectRequest, ContentCollectResponse } from "../lib/messages.js";
import { collectPageSnapshot } from "./collect.js";

const READY_FLAG = "__vibetraceContentReady";

declare global {
  interface Window {
    __vibetraceContentReady?: boolean;
  }
}

if (!window[READY_FLAG]) {
  window[READY_FLAG] = true;

  chrome.runtime.onMessage.addListener(
    (message: unknown, _sender, sendResponse: (response: ContentCollectResponse) => void) => {
      const request = message as Partial<ContentCollectRequest> | null;
      if (!request || request.type !== "VIBETRACE_COLLECT") return false;
      try {
        const snapshot = collectPageSnapshot();
        sendResponse({ ok: true, snapshot });
      } catch (error) {
        sendResponse({
          ok: false,
          error: {
            code: "SNAPSHOT_FAILED",
            message: error instanceof Error ? error.message : "Unable to capture this page.",
          },
        });
      }
      return false;
    },
  );
}
