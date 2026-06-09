import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { resolveUserId } from "../lib/user.js";
import { requestLocale } from "../lib/requestLocale.js";
import {
  processReflection,
  computeLifeAlignment,
  getAlignmentDashboard,
  recalculateMissionMomentums,
} from "../services/alignmentEngine.js";

export const alignmentRouter = Router();

alignmentRouter.get("/", async (req, res) => {
  const userId = await resolveUserId(req);
  const locale = requestLocale(req);
  const data = await getAlignmentDashboard(userId, locale);
  res.json(data);
});

alignmentRouter.post("/recalculate", async (req, res) => {
  const userId = await resolveUserId(req);
  const locale = requestLocale(req);
  await recalculateMissionMomentums(userId);
  const alignment = await computeLifeAlignment(userId, locale);
  const data = await getAlignmentDashboard(userId, locale);
  res.json(data);
});

alignmentRouter.post("/reflect", async (req, res) => {
  const userId = await resolveUserId(req);
  const body = z
    .object({
      content: z.string().min(1),
      mood: z.number().min(1).max(10).optional(),
      energy: z.number().min(1).max(10).optional(),
    })
    .parse(req.body);

  const locale = requestLocale(req);
  const reflection = await processReflection(
    userId,
    body.content,
    body.mood,
    body.energy,
    locale
  );
  const alignment = await computeLifeAlignment(userId, locale);
  res.status(201).json({ reflection, alignment: alignment.snapshot });
});

alignmentRouter.get("/reflections", async (req, res) => {
  const userId = await resolveUserId(req);
  const reflections = await prisma.reflection.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  res.json(reflections);
});
