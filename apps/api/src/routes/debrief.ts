import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { resolveUserId } from "../lib/user.js";
import { requestLocale } from "../lib/requestLocale.js";
import { analyzeNightDebrief } from "../services/ai.js";
import { getDebriefQuestions } from "../lib/debriefQuestions.js";

export const debriefRouter = Router();

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function asResponseMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(value)) {
    if (typeof val === "string") out[key] = val;
  }
  return out;
}

async function findTodayDebrief(userId: string) {
  const today = startOfDay();
  return prisma.nightDebrief.findFirst({
    where: { userId, date: { gte: today } },
    orderBy: { date: "desc" },
  });
}

async function saveTodayResponses(userId: string, responses: Record<string, string>) {
  const today = startOfDay();
  const existing = await findTodayDebrief(userId);

  if (existing) {
    return prisma.nightDebrief.update({
      where: { id: existing.id },
      data: { responses: responses as Prisma.InputJsonValue },
    });
  }

  return prisma.nightDebrief.create({
    data: {
      userId,
      date: today,
      responses: responses as Prisma.InputJsonValue,
    },
  });
}

debriefRouter.get("/questions", (req, res) => {
  res.json(getDebriefQuestions(requestLocale(req)));
});

debriefRouter.get("/today", async (req, res) => {
  const userId = await resolveUserId(req);
  const debrief = await findTodayDebrief(userId);
  res.json(debrief);
});

debriefRouter.post("/answer", async (req, res) => {
  const userId = await resolveUserId(req);
  const body = z
    .object({
      key: z.string().min(1),
      answer: z.string().min(1),
      finalize: z.boolean().optional(),
    })
    .parse(req.body);

  const existing = await findTodayDebrief(userId);
  const responses = {
    ...asResponseMap(existing?.responses),
    [body.key]: body.answer.trim(),
  };

  if (!body.finalize) {
    const debrief = await saveTodayResponses(userId, responses);
    return res.json(debrief);
  }

  const locale = requestLocale(req);
  const analysis = await analyzeNightDebrief(userId, responses, locale);
  const today = startOfDay();

  const debrief = existing
    ? await prisma.nightDebrief.update({
        where: { id: existing.id },
        data: {
          responses: responses as Prisma.InputJsonValue,
          ...analysis,
          behavioralNotes: analysis.behavioralNotes as Prisma.InputJsonValue,
          tomorrowPlan: analysis.tomorrowPlan as Prisma.InputJsonValue,
        },
      })
    : await prisma.nightDebrief.create({
        data: {
          userId,
          date: today,
          responses: responses as Prisma.InputJsonValue,
          ...analysis,
          behavioralNotes: analysis.behavioralNotes as Prisma.InputJsonValue,
          tomorrowPlan: analysis.tomorrowPlan as Prisma.InputJsonValue,
        },
      });

  if (analysis.patternDetected) {
    await prisma.aIMemory.create({
      data: {
        userId,
        category: "pattern",
        content: analysis.patternDetected,
        importance: 70,
      },
    });
  }

  res.json(debrief);
});

debriefRouter.post("/submit", async (req, res) => {
  const userId = await resolveUserId(req);
  const { responses } = z
    .object({ responses: z.record(z.string()) })
    .parse(req.body);

  const locale = requestLocale(req);
  const analysis = await analyzeNightDebrief(userId, responses, locale);
  const today = startOfDay();
  const existing = await findTodayDebrief(userId);

  const debrief = existing
    ? await prisma.nightDebrief.update({
        where: { id: existing.id },
        data: {
          responses: responses as Prisma.InputJsonValue,
          ...analysis,
          behavioralNotes: analysis.behavioralNotes as Prisma.InputJsonValue,
          tomorrowPlan: analysis.tomorrowPlan as Prisma.InputJsonValue,
        },
      })
    : await prisma.nightDebrief.create({
        data: {
          userId,
          date: today,
          responses: responses as Prisma.InputJsonValue,
          ...analysis,
          behavioralNotes: analysis.behavioralNotes as Prisma.InputJsonValue,
          tomorrowPlan: analysis.tomorrowPlan as Prisma.InputJsonValue,
        },
      });

  if (analysis.patternDetected) {
    await prisma.aIMemory.create({
      data: {
        userId,
        category: "pattern",
        content: analysis.patternDetected,
        importance: 70,
      },
    });
  }

  res.json(debrief);
});

debriefRouter.get("/history", async (req, res) => {
  const userId = await resolveUserId(req);
  const debriefs = await prisma.nightDebrief.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  res.json(debriefs);
});
