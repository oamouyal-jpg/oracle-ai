import type { Request } from "express";
import { parseLocale, type AppLocale } from "./locale.js";

export function requestLocale(req: Pick<Request, "headers">): AppLocale {
  return parseLocale(req.headers["x-locale"]);
}
