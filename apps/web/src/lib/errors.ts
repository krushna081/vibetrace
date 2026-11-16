import { ApiClientError } from "@vibetrace/api-client";

export interface DescribedError {
  title: string;
  message: string;
  code?: string;
  requestId?: string;
}

export function describeError(error: unknown): DescribedError {
  if (error instanceof ApiClientError) {
    if (error.isNetworkError) {
      return {
        title: "API unreachable",
        message: error.message,
        code: error.code,
      };
    }
    if (error.isTimeout) {
      return { title: "Request timed out", message: error.message, code: error.code };
    }
    return {
      title:
        error.status === 429
          ? "Rate limited"
          : error.status === 404
            ? "Not found"
            : error.status >= 500
              ? "Server error"
              : "Request failed",
      message: error.message,
      code: error.code,
      requestId: error.requestId,
    };
  }
  if (error instanceof Error) {
    return { title: "Something went wrong", message: error.message };
  }
  return { title: "Something went wrong", message: "An unexpected error occurred." };
}
