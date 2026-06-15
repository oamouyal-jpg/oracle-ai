import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { resolveUserId } from "../lib/user.js";
import { recalculateMissionMomentums } from "../services/alignmentEngine.js";
import { recalculateDomainHealth } from "../services/domainHealthEngine.js";
import { requestLocale } from "../lib/requestLocale.js";
import {
  ensureFocusQueue,
  replenishFocusQueue,
  submitFocusFollowUp,
} from "../services/focusTasks.js";
import { getClarityTasksForUser } from "../services/clarityTaskSync.js";
import { completeCurrentStep, skipCurrentStep } from "../services/clarityEngine.js";

const taskStatuses = [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "PARTIAL",
  "SKIPPED",
  "DELAYED",
  "RESCHEDULED",
  "CANCELLED",
] as const;

export const tasksRouter = Router();

tasksRouter.get("/focus", async (req, res) => {
  const userId = await resolveUserId(req);
  const locale = requestLocale(req);
  const result = await ensureFocusQueue(userId, locale);
  res.json(result);
});

tasksRouter.post("/focus/refresh", async (req, res) => {
  const userId = await resolveUserId(req);
  const locale = requestLocale(req);

  await prisma.task.updateMany({
    where: {
      userId,
      aiGenerated: true,
      status: { in: ["PENDING", "IN_PROGRESS"] },
    },
    data: { status: "CANCELLED" },
  });

  const result = await ensureFocusQueue(userId, locale);
  res.json(result);
});

tasksRouter.get("/clarity", async (req, res) => {
  const userId = await resolveUserId(req);
  const bundles = await getClarityTasksForUser(userId);
  res.json(bundles);
});

tasksRouter.get("/week-plan", async (req, res) => {
  const userId = await resolveUserId(req);
  const bundles = await getClarityTasksForUser(userId);
  res.json(bundles);
});

tasksRouter.get("/", async (req, res) => {
  const userId = await resolveUserId(req);
  const status = req.query.status as string | undefined;
  const missionId = req.query.missionId as string | undefined;

  const tasks = await prisma.task.findMany({
    where: {
      userId,
      ...(status ? { status: status as (typeof taskStatuses)[number] } : {}),
      ...(missionId ? { missionId } : {}),
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    include: { mission: { select: { id: true, title: true } } },
  });
  res.json(tasks);
});

tasksRouter.post("/", async (req, res) => {
  const userId = await resolveUserId(req);
  const body = z
    .object({
      title: z.string().min(1),
      description: z.string().optional(),
      missionId: z.string().optional(),
      priority: z.number().optional(),
      dueDate: z.string().datetime().optional(),
      scheduledAt: z.string().datetime().optional(),
      reminderAt: z.string().datetime().optional(),
      recurring: z.boolean().optional(),
      aiGenerated: z.boolean().optional(),
      energyCost: z.number().optional(),
      estimatedEffort: z.number().optional(),
      emotionalDifficulty: z.number().optional(),
    })
    .parse(req.body);

  const task = await prisma.task.create({
    data: {
      userId,
      title: body.title,
      description: body.description,
      missionId: body.missionId,
      priority: body.priority ?? 50,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
      reminderAt: body.reminderAt ? new Date(body.reminderAt) : undefined,
      recurring: body.recurring ?? false,
      aiGenerated: body.aiGenerated ?? false,
      energyCost: body.energyCost ?? 30,
      estimatedEffort: body.estimatedEffort ?? 30,
      emotionalDifficulty: body.emotionalDifficulty ?? 30,
    },
    include: { mission: { select: { id: true, title: true } } },
  });
  res.status(201).json(task);
});

tasksRouter.post("/:id/follow-up", async (req, res) => {
  const userId = await resolveUserId(req);
  const locale = requestLocale(req);
  const body = z.object({ progress: z.string().min(2) }).parse(req.body);

  try {
    const result = await submitFocusFollowUp(userId, req.params.id, body.progress, locale);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Follow-up failed";
    if (message === "Task not found") return res.status(404).json({ error: message });
    if (message === "Progress update too short") return res.status(400).json({ error: message });
    throw err;
  }
});

tasksRouter.patch("/:id", async (req, res) => {
  const userId = await resolveUserId(req);
  const body = z
    .object({
      title: z.string().optional(),
      status: z.enum(taskStatuses).optional(),
      priority: z.number().optional(),
      completionNote: z.string().optional(),
      dueDate: z.union([z.string().datetime(), z.null()]).optional(),
      scheduledAt: z.union([z.string().datetime(), z.null()]).optional(),
      reminderAt: z.union([z.string().datetime(), z.null()]).optional(),
    })
    .parse(req.body);

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.status !== undefined) data.status = body.status;
  if (body.priority !== undefined) data.priority = body.priority;
  if (body.completionNote !== undefined) data.completionNote = body.completionNote;
  if (body.dueDate !== undefined) {
    data.dueDate = body.dueDate === null ? null : new Date(body.dueDate);
  }
  if (body.scheduledAt !== undefined) {
    data.scheduledAt = body.scheduledAt === null ? null : new Date(body.scheduledAt);
  }
  if (body.reminderAt !== undefined) {
    data.reminderAt = body.reminderAt === null ? null : new Date(body.reminderAt);
    data.reminderSentAt = null;
  }
  if (body.status === "COMPLETED") {
    data.completedAt = new Date();
  }

  const linkedStep = await prisma.clarityStep.findFirst({
    where: {
      linkedTaskId: req.params.id,
      issue: { userId },
    },
  });

  if (
    linkedStep &&
    body.status === "COMPLETED" &&
    linkedStep.status === "CURRENT"
  ) {
    try {
      await completeCurrentStep(linkedStep.issueId, linkedStep.id, userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Step sync failed";
      if (message !== "Only the current step can be completed") throw err;
    }
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: { mission: { select: { id: true, title: true } } },
    });
    return res.json({ task, replenished: null });
  }

  if (
    linkedStep &&
    body.status === "SKIPPED" &&
    linkedStep.status === "CURRENT"
  ) {
    try {
      await skipCurrentStep(linkedStep.issueId, linkedStep.id, userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Step sync failed";
      if (message !== "Only the current step can be skipped") throw err;
    }
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: { mission: { select: { id: true, title: true } } },
    });
    return res.json({ task, replenished: null });
  }

  const result = await prisma.task.updateMany({
    where: { id: req.params.id, userId },
    data,
  });
  if (result.count === 0) return res.status(404).json({ error: "Not found" });

  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
    include: { mission: { select: { id: true, title: true } } },
  });

  if (task?.missionId) {
    await recalculateMissionMomentums(userId);
    await recalculateDomainHealth(userId);
  }

  const locale = requestLocale(req);
  let replenished = null;
  if (
    body.status &&
    ["COMPLETED", "SKIPPED"].includes(body.status) &&
    task?.aiGenerated
  ) {
    replenished = await replenishFocusQueue(userId, locale);
  }

  res.json({ task, replenished });
});

tasksRouter.delete("/:id", async (req, res) => {
  const userId = await resolveUserId(req);
  const result = await prisma.task.deleteMany({
    where: { id: req.params.id, userId },
  });
  if (result.count === 0) return res.status(404).json({ error: "Not found" });
  res.status(204).send();
});
