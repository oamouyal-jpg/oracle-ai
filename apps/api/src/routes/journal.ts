import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler.js";
import { prisma } from "../lib/prisma.js";
import { resolveUserId } from "../lib/user.js";
import { requestLocale } from "../lib/requestLocale.js";
import { runStateDetection } from "../services/stateDetectionEngine.js";

export const journalRouter = Router();

journalRouter.get("/", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const entries = await prisma.journalEntry.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      stateSnapshots: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  res.json(
    entries.map((e) => ({
      ...e,
      latestState: e.stateSnapshots[0]
        ? {
            detectedState: e.stateSnapshots[0].detectedState,
            emotionalIntensity: e.stateSnapshots[0].emotionalIntensity,
            decisionRisk: e.stateSnapshots[0].decisionRisk,
            delayMajorDecisions: e.stateSnapshots[0].delayMajorDecisions,
          }
        : null,
    }))
  );
}));

journalRouter.post("/", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const locale = requestLocale(req);
  const body = z
    .object({
      content: z.string().min(1),
      mood: z.number().min(1).max(10).optional(),
      tags: z.array(z.string()).optional(),
      runStateDetection: z.boolean().optional(),
    })
    .parse(req.body);

  const entry = await prisma.journalEntry.create({
    data: {
      userId,
      content: body.content,
      mood: body.mood,
      tags: body.tags ?? [],
    },
  });

  if (body.mood) {
    await prisma.emotionalLog.create({
      data: {
        userId,
        level: body.mood * 10,
        label: body.mood >= 7 ? "positive" : body.mood <= 4 ? "low" : "neutral",
        notes: body.content.slice(0, 200),
      },
    });
  }

  let stateDetection = null;
  if (body.runStateDetection !== false && body.content.trim().length >= 12) {
    stateDetection = await runStateDetection(userId, body.content.trim(), locale, {
      journalEntryId: entry.id,
    });
  }

  res.status(201).json({ entry, stateDetection });
}));
