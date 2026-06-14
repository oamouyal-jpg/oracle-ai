import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { resolveUserId } from "../lib/user.js";
import { requestLocale } from "../lib/requestLocale.js";
import {
  getOrCreateDailyOracleLine,
  regenerateDailyOracleLine,
} from "../services/dailyOracleLine.js";

export const dailyOracleRouter = Router();

dailyOracleRouter.get("/today", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const locale = requestLocale(req);
  const line = await getOrCreateDailyOracleLine(userId, locale);
  res.json(line);
}));

dailyOracleRouter.post("/regenerate", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const locale = requestLocale(req);
  const line = await regenerateDailyOracleLine(userId, locale);
  res.json(line);
}));
