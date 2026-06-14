import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler.js";
import { prisma } from "../lib/prisma.js";
import { resolveUserId } from "../lib/user.js";
import { requestLocale } from "../lib/requestLocale.js";
import { HttpError } from "../lib/errors.js";
import { asStringArray } from "../lib/arrays.js";
import {
  formatPattern,
  formatSnapshot,
  getLatestSnapshot,
  listSnapshots,
  runStateDetection,
} from "../services/stateDetectionEngine.js";

export const stateCheckRouter = Router();

function idParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0]! : value;
}

stateCheckRouter.get("/", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  res.json(await listSnapshots(userId, limit));
}));

stateCheckRouter.get("/latest", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  res.json({ snapshot: await getLatestSnapshot(userId) });
}));

stateCheckRouter.get("/patterns", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const patterns = await prisma.userPattern.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
  res.json(patterns.map(formatPattern));
}));

stateCheckRouter.get("/values", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const values = await prisma.stableValue.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
  res.json(
    values.map((v) => ({
      id: v.id,
      valueName: v.valueName,
      description: v.description,
      examples: asStringArray(v.examples),
      updatedAt: v.updatedAt,
    }))
  );
}));

stateCheckRouter.post("/values", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const body = z
    .object({
      valueName: z.string().min(1),
      description: z.string().optional(),
      examples: z.array(z.string()).optional(),
    })
    .parse(req.body);

  const value = await prisma.stableValue.create({
    data: {
      userId,
      valueName: body.valueName.trim(),
      description: body.description?.trim(),
      examples: body.examples ?? [],
    },
  });

  res.status(201).json({
    id: value.id,
    valueName: value.valueName,
    description: value.description,
    examples: asStringArray(value.examples),
    updatedAt: value.updatedAt,
  });
}));

stateCheckRouter.post("/", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const locale = requestLocale(req);
  const body = z
    .object({
      rawInput: z.string().min(8),
      issueId: z.string().optional(),
    })
    .parse(req.body);

  const result = await runStateDetection(userId, body.rawInput.trim(), locale, {
    issueId: body.issueId,
  });
  res.status(201).json(result);
}));

stateCheckRouter.get("/:id", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const snap = await prisma.stateSnapshot.findFirst({
    where: { id: idParam(req.params.id), userId },
    include: { matchedPattern: true },
  });
  if (!snap) throw new HttpError(404, "Snapshot not found");
  res.json(formatSnapshot(snap));
}));

stateCheckRouter.patch("/decisions/:id", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const { userFinalChoice } = z.object({ userFinalChoice: z.string().min(1) }).parse(req.body);
  const existing = await prisma.majorDecisionLog.findFirst({
    where: { id: idParam(req.params.id), userId },
  });
  if (!existing) throw new HttpError(404, "Decision log not found");

  const updated = await prisma.majorDecisionLog.update({
    where: { id: existing.id },
    data: { userFinalChoice: userFinalChoice.trim() },
  });
  res.json(updated);
}));
