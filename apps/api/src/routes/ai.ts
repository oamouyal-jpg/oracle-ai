import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { resolveUserId } from "../lib/user.js";
import { requestLocale } from "../lib/requestLocale.js";
import { chatWithOracle, prioritizeTasks } from "../services/ai.js";

export const aiRouter = Router();

aiRouter.post("/chat", async (req, res) => {
  const userId = await resolveUserId(req.headers["x-user-id"] as string);
  const { message } = z.object({ message: z.string().min(1) }).parse(req.body);

  const history = await prisma.chatMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  const reply = await chatWithOracle(
    userId,
    message,
    history.map((h) => ({ role: h.role, content: h.content })),
    requestLocale(req)
  );

  await prisma.chatMessage.createMany({
    data: [
      { userId, role: "user", content: message },
      { userId, role: "assistant", content: reply },
    ],
  });

  res.json({ reply });
});

aiRouter.get("/chat/history", async (req, res) => {
  const userId = await resolveUserId(req.headers["x-user-id"] as string);
  const messages = await prisma.chatMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  res.json(messages);
});

aiRouter.post("/prioritize", async (req, res) => {
  const userId = await resolveUserId(req.headers["x-user-id"] as string);
  const result = await prioritizeTasks(userId);
  res.json(result);
});

aiRouter.get("/insights", async (req, res) => {
  const userId = await resolveUserId(req.headers["x-user-id"] as string);
  const [memories, debriefs, emotional] = await Promise.all([
    prisma.aIMemory.findMany({
      where: { userId },
      orderBy: { importance: "desc" },
      take: 5,
    }),
    prisma.nightDebrief.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 7,
    }),
    prisma.emotionalLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 14,
    }),
  ]);

  const prompts = [
    "You are overloaded. Consider reducing active missions.",
    "You perform best after exercise and structured mornings.",
    "Financial tasks tend to be avoided when emotionally stressed.",
  ];

  if (debriefs[0]?.patternDetected) {
    prompts.unshift(debriefs[0].patternDetected);
  }

  res.json({
    proactivePrompts: prompts,
    memories: memories.map((m) => m.content),
    emotionalTrend: emotional.map((e) => ({ level: e.level, date: e.createdAt })),
    recentScores: debriefs[0]
      ? {
          focus: debriefs[0].focusScore,
          emotional: debriefs[0].emotionalScore,
          execution: debriefs[0].executionScore,
          alignment: debriefs[0].alignmentScore,
          energy: debriefs[0].energyScore,
        }
      : null,
  });
});
