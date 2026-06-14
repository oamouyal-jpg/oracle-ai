import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { resolveUserId } from "../lib/user.js";
import { requestLocale } from "../lib/requestLocale.js";
import { buildMorningNotification } from "../services/morningNotification.js";
import {
  acknowledgeTaskReminder,
  buildTaskReminderPayloads,
} from "../services/taskReminders.js";

export const notificationsRouter = Router();

notificationsRouter.get("/morning", async (req, res) => {
  const userId = await resolveUserId(req);
  const locale = requestLocale(req);
  const payload = await buildMorningNotification(userId, locale);
  res.json(payload);
});

notificationsRouter.get("/task-reminders", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const locale = requestLocale(req);
  const reminders = await buildTaskReminderPayloads(userId, locale);
  res.json(reminders);
}));

notificationsRouter.post("/task-reminders/:taskId/ack", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const taskId = Array.isArray(req.params.taskId) ? req.params.taskId[0]! : req.params.taskId;
  await acknowledgeTaskReminder(userId, taskId);
  res.json({ ok: true });
}));
