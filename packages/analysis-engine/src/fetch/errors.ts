export type ScanErrorCode =
  | "INVALID_URL"
  | "UNSUPPORTED_PROTOCOL"
  | "CREDENTIALS_NOT_ALLOWED"
  | "BLOCKED_HOSTNAME"
  | "BLOCKED_ADDRESS"
  | "BLOCKED_PORT"
  | "DNS_RESOLUTION_FAILED"
  | "TOO_MANY_REDIRECTS"
  | "INVALID_REDIRECT"
  | "RESPONSE_TOO_LARGE"
  | "UNSUPPORTED_CONTENT_TYPE"
  | "FETCH_TIMEOUT"
  | "FETCH_FAILED"
  | "SCAN_ABORTED";

const PUBLIC_MESSAGES: Record<ScanErrorCode, string> = {
  INVALID_URL: "The URL is not valid.",
  UNSUPPORTED_PROTOCOL: "Only HTTP and HTTPS URLs are supported.",
  CREDENTIALS_NOT_ALLOWED: "URLs containing usernames or passwords are not allowed.",
  BLOCKED_HOSTNAME: "That hostname is not allowed for security reasons.",
  BLOCKED_ADDRESS:
    "The target resolves to a non-public network address. VibeTrace only scans public websites.",
  BLOCKED_PORT: "The URL uses a port that is not allowed for external scans.",
  DNS_RESOLUTION_FAILED: "The hostname could not be resolved.",
  TOO_MANY_REDIRECTS: "The website redirected too many times.",
  INVALID_REDIRECT: "The website returned an invalid redirect.",
  RESPONSE_TOO_LARGE: "The website response exceeded the allowed size limit.",
  UNSUPPORTED_CONTENT_TYPE: "The URL did not return an HTML document.",
  FETCH_TIMEOUT: "The website did not respond before the scan timeout.",
  FETCH_FAILED: "The website could not be reached.",
  SCAN_ABORTED: "The scan was cancelled.",
};

export class ScanError extends Error {
  readonly code: ScanErrorCode;
  readonly publicMessage: string;
  readonly cause?: unknown;

  constructor(code: ScanErrorCode, internalMessage?: string, cause?: unknown) {
    super(internalMessage ?? PUBLIC_MESSAGES[code]);
    this.name = "ScanError";
    this.code = code;
    this.publicMessage = PUBLIC_MESSAGES[code];
    this.cause = cause;
  }
}

export function toScanError(error: unknown): ScanError {
  if (error instanceof ScanError) return error;
  if (error instanceof Error && error.name === "TimeoutError") {
    return new ScanError("FETCH_TIMEOUT", error.message, error);
  }
  if (error instanceof Error && error.name === "AbortError") {
    return new ScanError("SCAN_ABORTED", error.message, error);
  }
  return new ScanError(
    "FETCH_FAILED",
    error instanceof Error ? error.message : "Unknown fetch failure",
    error,
  );
}
