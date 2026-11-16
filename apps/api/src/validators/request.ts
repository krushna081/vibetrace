import type { z } from "zod";
import { ServiceError } from "../services/errors.js";

export function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ServiceError(400, "VALIDATION_ERROR", "The request body is invalid.", {
      issues: parsed.error.issues.slice(0, 20).map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }
  return parsed.data;
}

export function parseParams<T extends z.ZodTypeAny>(schema: T, params: unknown): z.infer<T> {
  const parsed = schema.safeParse(params);
  if (!parsed.success) {
    throw new ServiceError(400, "INVALID_PARAMETERS", "The request parameters are invalid.");
  }
  return parsed.data;
}

export function parseQuery<T extends z.ZodTypeAny>(schema: T, query: unknown): z.infer<T> {
  const parsed = schema.safeParse(query);
  if (!parsed.success) {
    throw new ServiceError(400, "INVALID_QUERY", "The query parameters are invalid.", {
      issues: parsed.error.issues.slice(0, 10),
    });
  }
  return parsed.data;
}
