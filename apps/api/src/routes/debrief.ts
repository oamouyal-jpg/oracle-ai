import { Router } from "express";
import { z } from "zod";
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

debriefRouter.get("/questions", (req, res) => {
  res.json(getDebriefQuestions(requestLocale(req)));
});

debriefRouter.get("/today", async (req, res) => {
  const userId = await resolveUserId(req);
  const today = startOfDay();
  const debrief = await prisma.nightDebrief.findFirst({
    where: { userId, date: { gte: today } },
  });
  res.json(debrief);
});

debriefRouter.post("/submit", async (req, res) => {
  const userId = await resolveUserId(req);
  const { responses } = z
    .object({ responses: z.record(z.string()) })
    .parse(req.body);

  const analysis = await analyzeNightDebrief(userId, responses, requestLocale(req));
  const today = startOfDay();

  const debrief = await prisma.nightDebrief.upsert({
    where: { userId_date: { userId, date: today } },
    create: {
      userId,
      date: today,
      responses,
      ...analysis,
    },
    update: {
      responses,
      ...analysis,
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
