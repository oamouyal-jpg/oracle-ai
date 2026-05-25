import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { resolveUserId } from "../lib/user.js";
import { requestLocale } from "../lib/requestLocale.js";
import { generateDailyBriefing } from "../services/ai.js";

export const briefingRouter = Router();

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

briefingRouter.get("/today", async (req, res) => {
  const userId = await resolveUserId(req.headers["x-user-id"] as string);
  const today = startOfDay();

  let briefing = await prisma.dailyBriefing.findFirst({
    where: { userId, date: { gte: today } },
  });

  if (!briefing) {
    const generated = await generateDailyBriefing(userId, requestLocale(req));
    briefing = await prisma.dailyBriefing.create({
      data: {
        userId,
        date: today,
        ...generated,
      },
    });
  }

  res.json(briefing);
});

briefingRouter.post("/regenerate", async (req, res) => {
  const userId = await resolveUserId(req.headers["x-user-id"] as string);
  const today = startOfDay();
  const generated = await generateDailyBriefing(userId, requestLocale(req));

  const briefing = await prisma.dailyBriefing.upsert({
    where: {
      userId_date: { userId, date: today },
    },
    create: { userId, date: today, ...generated },
    update: generated,
  });

  res.json(briefing);
});
