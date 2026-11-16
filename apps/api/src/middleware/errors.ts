import type { FastifyError, FastifyInstance } from "fastify";
import { ServiceError } from "../services/errors.js";

export function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler<FastifyError | ServiceError>((error, request, reply) => {
    const statusCode =
      error instanceof ServiceError
        ? error.statusCode
        : typeof error.statusCode === "number" && error.statusCode >= 400
          ? error.statusCode
          : 500;
    const requestId = request.id;

    if (statusCode >= 500) {
      request.log.error({ err: error, requestId }, "Unhandled API error");
    }

    const isRateLimit =
      statusCode === 429 || error.code === "FST_ERR_RATE_LIMIT" || error.code === "RATE_LIMITED";

    const code =
      error instanceof ServiceError
        ? error.code
        : isRateLimit
          ? "RATE_LIMITED"
          : statusCode === 413
            ? "PAYLOAD_TOO_LARGE"
            : statusCode === 400
              ? "BAD_REQUEST"
              : statusCode === 404
                ? "NOT_FOUND"
                : "INTERNAL_ERROR";

    const message =
      error instanceof ServiceError
        ? error.message
        : isRateLimit
          ? "Too many requests. Please wait before trying again."
          : statusCode === 413
            ? "The request body is too large."
            : statusCode < 500
              ? error.message
              : "An unexpected server error occurred.";

    reply.status(statusCode).send({
      error: {
        code,
        message,
        ...(error instanceof ServiceError && error.details !== undefined
          ? { details: error.details }
          : {}),
      },
      requestId,
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: {
        code: "NOT_FOUND",
        message: `No route matches ${request.method} ${request.url}.`,
      },
      requestId: request.id,
    });
  });
}
