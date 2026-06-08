import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { resolveUserId } from "../lib/user.js";
import { recalculateMissionMomentums } from "../services/alignmentEngine.js";
import { requestLocale } from "../lib/requestLocale.js";
import {
  ensureFocusQueue,
  replenishFocusQueue,
  submitFocusFollowUp,
} from "../services/focusTasks.js";

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
  const userId = await resolveUserId(req.headers["x-user-id"] as string);
  const locale = requestLocale(req);
  const result = await ensureFocusQueue(userId, locale);
  res.json(result);
});

tasksRouter.post("/focus/refresh", async (req, res) => {
  const userId = await resolveUserId(req.headers["x-user-id"] as string);
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

tasksRouter.get("/", async (req, res) => {
  const userId = await resolveUserId(req.headers["x-user-id"] as string);
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
  const userId = await resolveUserId(req.headers["x-user-id"] as string);
  const body = z
    .object({
      title: z.string().min(1),
      description: z.string().optional(),
      missionId: z.string().optional(),
      priority: z.number().optional(),
      dueDate: z.string().datetime().optional(),
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
  const userId = await resolveUserId(req.headers["x-user-id"] as string);
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
  const userId = await resolveUserId(req.headers["x-user-id"] as string);
  const body = z
    .object({
      title: z.string().optional(),
      status: z.enum(taskStatuses).optional(),
      priority: z.number().optional(),
      completionNote: z.string().optional(),
      dueDate: z.string().datetime().optional(),
    })
    .parse(req.body);

  const data: Record<string, unknown> = { ...body };
  if (body.status === "COMPLETED") {
    data.completedAt = new Date();
  }
  if (body.dueDate) data.dueDate = new Date(body.dueDate);

  const result = await prisma.task.updateMany({
    where: { id: req.params.id, userId },
    data,
  });
  if (result.count === 0) return res.status(404).json({ error: "Not found" });

  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
    include: { mission: { select: { id: true, title: true } } },
  });

  if (task?.missionId) await recalculateMissionMomentums(userId);

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
  const userId = await resolveUserId(req.headers["x-user-id"] as string);
  const result = await prisma.task.deleteMany({
    where: { id: req.params.id, userId },
  });
  if (result.count === 0) return res.status(404).json({ error: "Not found" });
  res.status(204).send();
});
