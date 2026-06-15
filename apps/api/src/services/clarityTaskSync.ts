import { prisma } from "../lib/prisma.js";
import type { ClarityIssueMode, Prisma } from "@prisma/client";

export type ClarityStepTaskInput = {
  title: string;
  description?: string | null;
  whyThisNow?: string | null;
  prepareNotes?: string | null;
  completionCriteria?: string | null;
  dueAt?: Date | null;
  urgency?: number;
};

export type ClarityTasksBundle = {
  issueId: string;
  issueTitle: string;
  mode: ClarityIssueMode;
  weekStartDate: string | null;
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: number;
    dueDate: string | null;
    scheduledAt: string | null;
    reminderAt: string | null;
    stepId: string;
    stepStatus: string;
    isCurrent: boolean;
  }>;
};

function morningReminderFor(due: Date): Date {
  const r = new Date(due);
  r.setHours(8, 0, 0, 0);
  if (r.getTime() <= Date.now()) {
    return new Date(Date.now() + 3600000);
  }
  return r;
}

export function buildClarityTaskDescription(s: ClarityStepTaskInput): string {
  return [
    s.description,
    s.whyThisNow ? `Why now: ${s.whyThisNow}` : "",
    s.prepareNotes ? `Start: ${s.prepareNotes}` : "",
    s.completionCriteria ? `Done when: ${s.completionCriteria}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function taskStatusForStep(
  stepStatus: "CURRENT" | "LOCKED" | "COMPLETED" | "SKIPPED"
): "IN_PROGRESS" | "PENDING" | "COMPLETED" | "SKIPPED" {
  if (stepStatus === "COMPLETED") return "COMPLETED";
  if (stepStatus === "SKIPPED") return "SKIPPED";
  if (stepStatus === "CURRENT") return "IN_PROGRESS";
  return "PENDING";
}

export async function createTaskForClarityStep(
  db: Prisma.TransactionClient | typeof prisma,
  userId: string,
  s: ClarityStepTaskInput,
  index: number,
  stepStatus: "CURRENT" | "LOCKED" | "COMPLETED" | "SKIPPED",
  mode: ClarityIssueMode = "SINGLE_ISSUE"
) {
  const status = taskStatusForStep(stepStatus);
  const dueAt = s.dueAt ?? null;
  const reminderAt = dueAt && mode === "WEEK_PLAN" ? morningReminderFor(dueAt) : null;
  const priority =
    mode === "WEEK_PLAN"
      ? Math.min(99, 70 + (s.urgency ?? 5))
      : Math.min(99, 88 - index * 4);

  return db.task.create({
    data: {
      userId,
      title: s.title,
      description: buildClarityTaskDescription(s),
      dueDate: dueAt ?? undefined,
      scheduledAt: dueAt ?? undefined,
      reminderAt: reminderAt ?? undefined,
      priority,
      aiGenerated: false,
      status,
      ...(status === "COMPLETED" ? { completedAt: new Date() } : {}),
    },
  });
}

export async function deleteLinkedTasksForIssue(
  db: Prisma.TransactionClient,
  issueId: string,
  userId: string
): Promise<void> {
  const existingSteps = await db.clarityStep.findMany({
    where: { issueId },
    select: { linkedTaskId: true },
  });
  const linkedTaskIds = existingSteps
    .map((s) => s.linkedTaskId)
    .filter((id): id is string => Boolean(id));
  if (linkedTaskIds.length > 0) {
    await db.task.deleteMany({ where: { id: { in: linkedTaskIds }, userId } });
  }
}

/** Create Task rows for clarity steps missing linkedTaskId (any issue mode). */
export async function backfillClarityIssueTasks(issueId: string, userId: string): Promise<number> {
  const issue = await prisma.clarityIssue.findFirst({
    where: { id: issueId, userId },
    include: { steps: { orderBy: { priorityOrder: "asc" } } },
  });
  if (!issue) return 0;

  let created = 0;
  for (const step of issue.steps) {
    if (step.linkedTaskId) continue;
    const task = await createTaskForClarityStep(
      prisma,
      userId,
      {
        title: step.title,
        description: step.description,
        whyThisNow: step.whyThisNow,
        prepareNotes: step.prepareNotes,
        completionCriteria: step.completionCriteria,
        dueAt: step.dueAt,
        urgency: 5,
      },
      step.priorityOrder,
      step.status as "CURRENT" | "LOCKED" | "COMPLETED" | "SKIPPED",
      issue.mode
    );
    await prisma.clarityStep.update({
      where: { id: step.id },
      data: { linkedTaskId: task.id },
    });
    created += 1;
  }
  return created;
}

export async function getClarityTasksForUser(userId: string): Promise<ClarityTasksBundle[]> {
  const issues = await prisma.clarityIssue.findMany({
    where: {
      userId,
      status: { in: ["ACTIVE", "CLARIFYING"] },
      steps: { some: {} },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      steps: { orderBy: { priorityOrder: "asc" } },
    },
  });

  const bundles: ClarityTasksBundle[] = [];

  for (const issue of issues) {
    const missing = issue.steps.some((s) => !s.linkedTaskId);
    if (missing) {
      await backfillClarityIssueTasks(issue.id, userId);
      const refreshed = await prisma.clarityIssue.findFirst({
        where: { id: issue.id },
        include: { steps: { orderBy: { priorityOrder: "asc" } } },
      });
      if (refreshed) issue.steps = refreshed.steps;
    }

    const taskIds = issue.steps
      .map((s) => s.linkedTaskId)
      .filter((id): id is string => Boolean(id));
    if (taskIds.length === 0) continue;

    const tasks = await prisma.task.findMany({ where: { id: { in: taskIds }, userId } });
    const taskById = new Map(tasks.map((t) => [t.id, t]));

    bundles.push({
      issueId: issue.id,
      issueTitle: issue.title,
      mode: issue.mode,
      weekStartDate: issue.weekStartDate?.toISOString() ?? null,
      tasks: issue.steps
        .filter((s) => s.linkedTaskId && taskById.has(s.linkedTaskId))
        .map((s) => {
          const task = taskById.get(s.linkedTaskId!)!;
          return {
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate?.toISOString() ?? null,
            scheduledAt: task.scheduledAt?.toISOString() ?? null,
            reminderAt: task.reminderAt?.toISOString() ?? null,
            stepId: s.id,
            stepStatus: s.status,
            isCurrent: s.status === "CURRENT",
          };
        }),
    });
  }

  return bundles;
}

export function clarityTaskProgress(steps: { status: string; linkedTaskId: string | null }[]) {
  const total = steps.length;
  const done = steps.filter((s) => s.status === "COMPLETED" || s.status === "SKIPPED").length;
  const hasTasks = steps.some((s) => Boolean(s.linkedTaskId));
  return { done, total, hasTasks };
}
