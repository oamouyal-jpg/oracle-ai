import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler.js";
import { prisma } from "../lib/prisma.js";
import { resolveUserId } from "../lib/user.js";
import { requestLocale } from "../lib/requestLocale.js";
import { parseLocale } from "../lib/locale.js";
import { apiStr } from "../lib/apiLocale.js";
import { getOperatorName } from "../lib/operatorLearning.js";
import { getVapidPublicKey, sendPush, pushConfigured } from "../lib/push.js";
import { buildMorningNotification } from "../services/morningNotification.js";
import {
  acknowledgeTaskReminder,
  buildTaskReminderPayloads,
} from "../services/taskReminders.js";
import {
  getProactiveSnapshot,
  runScheduler,
} from "../services/proactiveEngine.js";

export const notificationsRouter = Router();

function idParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0]! : value;
}

/* ─── Legacy foreground payloads (still used by the in-app poller) ─── */

notificationsRouter.get("/morning", async (req, res) => {
  const userId = await resolveUserId(req);
  const locale = requestLocale(req);
  res.json(await buildMorningNotification(userId, locale));
});

notificationsRouter.get(
  "/task-reminders",
  asyncHandler(async (req, res) => {
    const userId = await resolveUserId(req);
    const locale = requestLocale(req);
    res.json(await buildTaskReminderPayloads(userId, locale));
  })
);

notificationsRouter.post(
  "/task-reminders/:taskId/ack",
  asyncHandler(async (req, res) => {
    const userId = await resolveUserId(req);
    await acknowledgeTaskReminder(userId, idParam(req.params.taskId));
    res.json({ ok: true });
  })
);

/* ─── Web push: subscription + preferences ─── */

notificationsRouter.get("/vapid-public-key", (_req, res) => {
  res.json({ key: getVapidPublicKey(), configured: pushConfigured() });
});

notificationsRouter.post(
  "/subscribe",
  asyncHandler(async (req, res) => {
    const userId = await resolveUserId(req);
    const body = z
      .object({
        subscription: z.object({
          endpoint: z.string().url(),
          keys: z.object({ p256dh: z.string(), auth: z.string() }),
        }),
        timezone: z.string().optional(),
        locale: z.string().optional(),
        userAgent: z.string().optional(),
      })
      .parse(req.body);

    const { endpoint, keys } = body.subscription;

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: body.userAgent,
      },
      update: { userId, p256dh: keys.p256dh, auth: keys.auth, userAgent: body.userAgent },
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        pushEnabled: true,
        ...(body.timezone ? { timezone: body.timezone } : {}),
        ...(body.locale ? { locale: parseLocale(body.locale) } : {}),
      },
    });

    res.status(201).json({ ok: true });
  })
);

notificationsRouter.post(
  "/unsubscribe",
  asyncHandler(async (req, res) => {
    const userId = await resolveUserId(req);
    const body = z.object({ endpoint: z.string() }).parse(req.body);
    await prisma.pushSubscription.deleteMany({ where: { userId, endpoint: body.endpoint } });
    const remaining = await prisma.pushSubscription.count({ where: { userId } });
    if (remaining === 0) {
      await prisma.user.update({ where: { id: userId }, data: { pushEnabled: false } });
    }
    res.json({ ok: true });
  })
);

notificationsRouter.get(
  "/preferences",
  asyncHandler(async (req, res) => {
    const userId = await resolveUserId(req);
    const [user, subCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          pushEnabled: true,
          proactiveEnabled: true,
          timezone: true,
          locale: true,
          morningHour: true,
          morningMinute: true,
          quietHoursStart: true,
          quietHoursEnd: true,
        },
      }),
      prisma.pushSubscription.count({ where: { userId } }),
    ]);
    res.json({ ...user, subscriptions: subCount, pushSupported: pushConfigured() });
  })
);

notificationsRouter.patch(
  "/preferences",
  asyncHandler(async (req, res) => {
    const userId = await resolveUserId(req);
    const body = z
      .object({
        proactiveEnabled: z.boolean().optional(),
        timezone: z.string().optional(),
        locale: z.string().optional(),
        morningHour: z.number().int().min(0).max(23).optional(),
        morningMinute: z.number().int().min(0).max(59).optional(),
        quietHoursStart: z.number().int().min(0).max(23).optional(),
        quietHoursEnd: z.number().int().min(0).max(23).optional(),
      })
      .parse(req.body);

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(body.proactiveEnabled !== undefined ? { proactiveEnabled: body.proactiveEnabled } : {}),
        ...(body.timezone ? { timezone: body.timezone } : {}),
        ...(body.locale ? { locale: parseLocale(body.locale) } : {}),
        ...(body.morningHour !== undefined ? { morningHour: body.morningHour } : {}),
        ...(body.morningMinute !== undefined ? { morningMinute: body.morningMinute } : {}),
        ...(body.quietHoursStart !== undefined ? { quietHoursStart: body.quietHoursStart } : {}),
        ...(body.quietHoursEnd !== undefined ? { quietHoursEnd: body.quietHoursEnd } : {}),
      },
      select: {
        pushEnabled: true,
        proactiveEnabled: true,
        timezone: true,
        locale: true,
        morningHour: true,
        morningMinute: true,
        quietHoursStart: true,
        quietHoursEnd: true,
      },
    });
    res.json(updated);
  })
);

notificationsRouter.post(
  "/test",
  asyncHandler(async (req, res) => {
    const userId = await resolveUserId(req);
    const locale = requestLocale(req);
    const [subs, name] = await Promise.all([
      prisma.pushSubscription.findMany({ where: { userId } }),
      getOperatorName(userId),
    ]);
    if (subs.length === 0) {
      res.status(400).json({ error: "No push subscription. Enable notifications first." });
      return;
    }
    const payload = {
      title: apiStr("nudgeTestTitle", parseLocale(locale), { name }),
      body: apiStr("nudgeTestBody", parseLocale(locale)),
      url: "/",
      tag: "oracle-test",
    };
    let delivered = 0;
    for (const sub of subs) {
      const result = await sendPush(sub, payload);
      if (result === "ok") delivered += 1;
      else if (result === "gone") {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      }
    }
    res.json({ ok: delivered > 0, delivered });
  })
);

/* ─── In-app proactive snapshot for the "Right now" banner ─── */

notificationsRouter.get(
  "/proactive",
  asyncHandler(async (req, res) => {
    const userId = await resolveUserId(req);
    const locale = requestLocale(req);
    res.json(await getProactiveSnapshot(userId, locale));
  })
);

/* ─── External scheduler trigger (Render Cron Job / uptime ping) ─── */

notificationsRouter.post(
  "/run-scheduler",
  asyncHandler(async (req, res) => {
    const secret = process.env.SCHEDULER_SECRET;
    if (secret) {
      const provided = req.header("x-scheduler-secret");
      if (provided !== secret) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
    }
    const result = await runScheduler();
    res.json(result);
  })
);
