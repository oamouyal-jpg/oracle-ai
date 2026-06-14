import { prisma } from "../lib/prisma.js";
import type { AppLocale } from "../lib/locale.js";
import { getOperatorName } from "../lib/operatorLearning.js";
import { apiStr } from "../lib/apiLocale.js";

const OPEN_STATUSES = ["PENDING", "IN_PROGRESS", "PARTIAL", "DELAYED", "RESCHEDULED"] as const;

export type TaskReminderPayload = {
  taskId: string;
  title: string;
  body: string;
  url: string;
  dueDate: string | null;
  scheduledAt: string | null;
  reminderAt: string;
  overdue: boolean;
};

export async function listDueTaskReminders(userId: string) {
  const now = new Date();
  const tasks = await prisma.task.findMany({
    where: {
      userId,
      status: { in: [...OPEN_STATUSES] },
      reminderAt: { not: null, lte: now },
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      scheduledAt: true,
      reminderAt: true,
      reminderSentAt: true,
    },
    orderBy: { reminderAt: "asc" },
    take: 20,
  });

  return tasks.filter((t) => {
    if (!t.reminderAt) return false;
    if (!t.reminderSentAt) return true;
    return t.reminderSentAt.getTime() < t.reminderAt.getTime();
  });
}

export async function buildTaskReminderPayloads(
  userId: string,
  locale: AppLocale = "en"
): Promise<TaskReminderPayload[]> {
  const [tasks, operatorName] = await Promise.all([
    listDueTaskReminders(userId),
    getOperatorName(userId),
  ]);

  const now = Date.now();

  return tasks.map((task) => {
    const overdue = task.dueDate ? task.dueDate.getTime() < now : false;
    const dueToday =
      task.dueDate != null &&
      task.dueDate.toDateString() === new Date().toDateString();

    let body: string;
    if (overdue) {
      body = apiStr("taskReminderOverdue", locale, { task: task.title });
    } else if (dueToday) {
      body = apiStr("taskReminderDueToday", locale, { task: task.title });
    } else if (task.scheduledAt) {
      body = apiStr("taskReminderScheduled", locale, { task: task.title });
    } else {
      body = apiStr("taskReminderGeneric", locale, { task: task.title });
    }

    return {
      taskId: task.id,
      title: apiStr("taskReminderTitle", locale, { name: operatorName }),
      body,
      url: "/tasks",
      dueDate: task.dueDate?.toISOString() ?? null,
      scheduledAt: task.scheduledAt?.toISOString() ?? null,
      reminderAt: task.reminderAt!.toISOString(),
      overdue,
    };
  });
}

export async function acknowledgeTaskReminder(userId: string, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId },
  });
  if (!task) throw new Error("Task not found");
  await prisma.task.update({
    where: { id: taskId },
    data: { reminderSentAt: new Date() },
  });
}

export async function getUpcomingDeadlineTasks(userId: string, limit = 5) {
  const now = new Date();
  return prisma.task.findMany({
    where: {
      userId,
      status: { in: [...OPEN_STATUSES] },
      dueDate: { not: null, gte: now },
    },
    orderBy: { dueDate: "asc" },
    take: limit,
    include: { mission: { select: { id: true, title: true } } },
  });
}
