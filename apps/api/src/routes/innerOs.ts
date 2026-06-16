import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler.js";
import { prisma } from "../lib/prisma.js";
import { resolveUserId } from "../lib/user.js";
import { requestLocale } from "../lib/requestLocale.js";
import { HttpError } from "../lib/errors.js";
import { asStringArray } from "../lib/arrays.js";
import {
  getInnerGrowth,
  listInnerSessions,
  runInnerCheckIn,
  setFreedomActionDone,
  submitInnerReflection,
} from "../services/innerOsEngine.js";

export const innerOsRouter = Router();

function idParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0]! : value;
}

innerOsRouter.get(
  "/sessions",
  asyncHandler(async (req, res) => {
    const userId = await resolveUserId(req);
    const limit = Math.min(Number(req.query.limit) || 20, 60);
    res.json(await listInnerSessions(userId, limit));
  })
);

innerOsRouter.get(
  "/growth",
  asyncHandler(async (req, res) => {
    const userId = await resolveUserId(req);
    res.json(await getInnerGrowth(userId));
  })
);

innerOsRouter.get(
  "/values",
  asyncHandler(async (req, res) => {
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
  })
);

innerOsRouter.post(
  "/values",
  asyncHandler(async (req, res) => {
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
  })
);

innerOsRouter.delete(
  "/values/:id",
  asyncHandler(async (req, res) => {
    const userId = await resolveUserId(req);
    const existing = await prisma.stableValue.findFirst({
      where: { id: idParam(req.params.id), userId },
    });
    if (!existing) throw new HttpError(404, "Value not found");
    await prisma.stableValue.delete({ where: { id: existing.id } });
    res.status(204).end();
  })
);

innerOsRouter.post(
  "/check-in",
  asyncHandler(async (req, res) => {
    const userId = await resolveUserId(req);
    const locale = requestLocale(req);
    const body = z.object({ rawInput: z.string().min(8) }).parse(req.body);
    const result = await runInnerCheckIn(userId, body.rawInput.trim(), locale);
    res.status(201).json(result);
  })
);

innerOsRouter.post(
  "/sessions/:id/reflect",
  asyncHandler(async (req, res) => {
    const userId = await resolveUserId(req);
    const locale = requestLocale(req);
    const body = z.object({ answers: z.array(z.string()) }).parse(req.body);
    try {
      const result = await submitInnerReflection(userId, idParam(req.params.id), body.answers, locale);
      res.json(result);
    } catch (err) {
      if (err instanceof Error && err.message === "Session not found") {
        throw new HttpError(404, "Session not found");
      }
      throw err;
    }
  })
);

innerOsRouter.patch(
  "/sessions/:id/action",
  asyncHandler(async (req, res) => {
    const userId = await resolveUserId(req);
    const body = z.object({ done: z.boolean() }).parse(req.body);
    try {
      const result = await setFreedomActionDone(userId, idParam(req.params.id), body.done);
      res.json(result);
    } catch (err) {
      if (err instanceof Error && err.message === "Session not found") {
        throw new HttpError(404, "Session not found");
      }
      throw err;
    }
  })
);
