import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { isOpenAIAuthError } from "../lib/openai.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (res.headersSent) return;

  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validation failed",
      details: err.flatten(),
    });
    return;
  }

  if (isOpenAIAuthError(err)) {
    res.status(503).json({
      error:
        "OpenAI API key is invalid. Update OPENAI_API_KEY in apps/api/.env or remove it to use offline mode.",
    });
    return;
  }

  const message = err instanceof Error ? err.message : "Internal server error";
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code?: string }).code)
      : undefined;

  console.error("[API]", message, code ?? "", err);

  res.status(500).json({
    error: message,
    ...(process.env.NODE_ENV !== "production" && err instanceof Error
      ? { stack: err.stack }
      : {}),
  });
}
