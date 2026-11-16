export interface ApiClientErrorOptions {
  status: number;
  code: string;
  message: string;
  requestId?: string;
  details?: unknown;
  cause?: unknown;
}

/** Normalized error raised for transport, HTTP, schema, and timeout failures. */
export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly details?: unknown;

  constructor(options: ApiClientErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = "ApiClientError";
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.details = options.details;
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }

  get isTimeout(): boolean {
    return this.code === "CLIENT_TIMEOUT";
  }
}

export const CLIENT_ERROR_CODES = {
  network: "NETWORK_ERROR",
  timeout: "CLIENT_TIMEOUT",
  invalidResponse: "INVALID_RESPONSE",
  unknown: "UNKNOWN_ERROR",
} as const;
