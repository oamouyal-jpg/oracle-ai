import { Router } from "express";
import { resolveUserId } from "../lib/user.js";
import { requestLocale } from "../lib/requestLocale.js";
import { buildMorningNotification } from "../services/morningNotification.js";

export const notificationsRouter = Router();

notificationsRouter.get("/morning", async (req, res) => {
  const userId = await resolveUserId(req);
  const locale = requestLocale(req);
  const payload = await buildMorningNotification(userId, locale);
  res.json(payload);
});
