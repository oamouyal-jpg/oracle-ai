import { prisma } from "../lib/prisma.js";
import { parseLocale, type AppLocale } from "../lib/locale.js";
import { apiStr } from "../lib/apiLocale.js";
import { getOperatorName } from "../lib/operatorLearning.js";
import { sendPush, pushConfigured, type PushPayload } from "../lib/push.js";
import { buildMorningNotification } from "./morningNotification.js";
import { buildTaskReminderPayloads } from "./taskReminders.js";
import { getActiveFocusTasks } from "./focusTasks.js";

const OPEN_STATUSES = ["PENDING", "IN_PROGRESS", "PARTIAL", "DELAYED", "RESCHEDULED"] as const;

type LocalParts = { hour: number; minute: number; date: string; minutesOfDay: number };

/** Local wall-clock for a user's timezone (IANA). Falls back to UTC. */
export function localParts(timezone: string | null | undefined, now = new Date()): LocalParts {
  const timeZone = timezone || "UTC";
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
  }
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  return {
    hour,
    minute,
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutesOfDay: hour * 60 + minute,
  };
}

/** Quiet hours, supports wrap-around (e.g. 22 → 7). Equal start/end = no quiet hours. */
export function isQuietHour(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

type Nudge = {
  kind: "MORNING" | "TASK" | "OVERDUE";
  dedupeKey: string;
  taskId?: string;
  payload: PushPayload;
};

async function countOverdue(userId: string): Promise<number> {
  return prisma.task.count({
    where: {
      userId,
      status: { in: [...OPEN_STATUSES] },
      dueDate: { not: null, lt: new Date() },
    },
  });
}

type SchedulableUser = {
  id: string;
  locale: string;
  timezone: string | null;
  morningHour: number;
  morningMinute: number;
  quietHoursStart: number;
  quietHoursEnd: number;
};

/** Builds the list of nudges a user should receive right now (before dedup). */
export async function computeNudges(user: SchedulableUser, now = new Date()): Promise<Nudge[]> {
  const locale = parseLocale(user.locale);
  const parts = localParts(user.timezone, now);
  const quiet = isQuietHour(parts.hour, user.quietHoursStart, user.quietHoursEnd);
  const nudges: Nudge[] = [];

  // 1. Morning priority digest — once per local day, within a 3h window after the chosen time.
  const morningStart = user.morningHour * 60 + user.morningMinute;
  if (
    !quiet &&
    parts.minutesOfDay >= morningStart &&
    parts.minutesOfDay < morningStart + 180
  ) {
    const m = await buildMorningNotification(user.id, locale);
    nudges.push({
      kind: "MORNING",
      dedupeKey: `morning:${parts.date}`,
      payload: { title: m.title, body: m.body, url: m.url, tag: "oracle-morning" },
    });
  }

  // 2. Due / overdue task reminders (skip during quiet hours).
  if (!quiet) {
    const reminders = await buildTaskReminderPayloads(user.id, locale);
    for (const r of reminders) {
      nudges.push({
        kind: "TASK",
        dedupeKey: `task:${r.taskId}:${r.reminderAt}`,
        taskId: r.taskId,
        payload: { title: r.title, body: r.body, url: r.url, tag: `task-${r.taskId}` },
      });
    }
  }

  // 3. Afternoon overdue sweep — once per local day if anything is overdue.
  if (!quiet && parts.hour >= 14) {
    const overdue = await countOverdue(user.id);
    if (overdue > 0) {
      const name = await getOperatorName(user.id);
      nudges.push({
        kind: "OVERDUE",
        dedupeKey: `overdue:${parts.date}`,
        payload: {
          title: apiStr("nudgeOverdueTitle", locale, { name }),
          body: apiStr("nudgeOverdueBody", locale, { count: overdue }),
          url: "/tasks",
          tag: "oracle-overdue",
        },
      });
    }
  }

  return nudges;
}

/**
 * Iterates eligible users and delivers due nudges via web push.
 * Dedup is enforced by NotificationLog's unique (userId, dedupeKey).
 */
export async function runScheduler(now = new Date()) {
  if (!pushConfigured()) {
    return { skipped: "push-not-configured", users: 0, sent: 0 };
  }

  const users = await prisma.user.findMany({
    where: {
      proactiveEnabled: true,
      pushEnabled: true,
      pushSubscriptions: { some: {} },
    },
    include: { pushSubscriptions: true },
  });

  let sent = 0;

  for (const user of users) {
    let nudges: Nudge[] = [];
    try {
      nudges = await computeNudges(user, now);
    } catch (err) {
      console.warn(`[Oracle] computeNudges failed for ${user.id}:`, (err as Error)?.message);
      continue;
    }

    for (const nudge of nudges) {
      // Atomic dedup: if the log row already exists, this throws and we skip.
      try {
        await prisma.notificationLog.create({
          data: {
            userId: user.id,
            kind: nudge.kind,
            dedupeKey: nudge.dedupeKey,
            title: nudge.payload.title,
            body: nudge.payload.body,
            url: nudge.payload.url ?? null,
          },
        });
      } catch {
        continue; // already delivered
      }

      let delivered = false;
      for (const sub of user.pushSubscriptions) {
        const result = await sendPush(sub, nudge.payload);
        if (result === "ok") delivered = true;
        else if (result === "gone") {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      }

      if (delivered) sent += 1;
      if (nudge.taskId) {
        await prisma.task
          .update({ where: { id: nudge.taskId }, data: { reminderSentAt: new Date() } })
          .catch(() => {});
      }
    }
  }

  return { users: users.length, sent };
}

/* ─── In-app "Right now" snapshot ─── */

export type ProactiveSnapshot = {
  topAction: { kind: string; title: string; detail: string | null; url: string } | null;
  overdueCount: number;
  dueTodayCount: number;
  focusCount: number;
};

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

export async function getProactiveSnapshot(
  userId: string,
  locale: AppLocale = "en"
): Promise<ProactiveSnapshot> {
  const now = new Date();
  const [overdue, dueToday, focusTasks, currentStep] = await Promise.all([
    prisma.task.findMany({
      where: { userId, status: { in: [...OPEN_STATUSES] }, dueDate: { not: null, lt: now } },
      orderBy: { dueDate: "asc" },
      take: 10,
      select: { id: true, title: true },
    }),
    prisma.task.findMany({
      where: {
        userId,
        status: { in: [...OPEN_STATUSES] },
        dueDate: { gte: now, lte: endOfToday() },
      },
      orderBy: { dueDate: "asc" },
      take: 10,
      select: { id: true, title: true },
    }),
    getActiveFocusTasks(userId),
    prisma.clarityStep.findFirst({
      where: { status: "CURRENT", issue: { userId, status: { in: ["ACTIVE", "CLARIFYING"] } } },
      orderBy: { priorityOrder: "asc" },
      include: { issue: { select: { id: true, title: true } } },
    }),
  ]);

  let topAction: ProactiveSnapshot["topAction"] = null;
  if (overdue[0]) {
    topAction = {
      kind: "OVERDUE",
      title: overdue[0].title,
      detail: apiStr("nudgeOverdueBody", locale, { count: overdue.length }),
      url: "/tasks",
    };
  } else if (dueToday[0]) {
    topAction = { kind: "DUE_TODAY", title: dueToday[0].title, detail: null, url: "/tasks" };
  } else if (focusTasks[0]) {
    topAction = {
      kind: "FOCUS",
      title: focusTasks[0].title,
      detail: focusTasks[0].description ?? null,
      url: "/tasks",
    };
  } else if (currentStep) {
    topAction = {
      kind: "CLARITY",
      title: currentStep.title,
      detail: currentStep.issue?.title ?? null,
      url: currentStep.issue ? `/clarity/${currentStep.issue.id}` : "/clarity",
    };
  }

  return {
    topAction,
    overdueCount: overdue.length,
    dueTodayCount: dueToday.length,
    focusCount: focusTasks.length,
  };
}
