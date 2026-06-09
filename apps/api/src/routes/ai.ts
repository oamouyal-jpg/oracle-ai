import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { resolveUserId } from "../lib/user.js";
import { requestLocale } from "../lib/requestLocale.js";
import { chatWithOracle, prioritizeTasks } from "../services/ai.js";
import { getOpenAIStatus } from "../lib/openai.js";
import {
  buildOperatorLearningContext,
  getOperatorName,
  learnFromChatMessage,
} from "../lib/operatorLearning.js";

export const aiRouter = Router();

aiRouter.get("/status", (_req, res) => {
  res.json(getOpenAIStatus());
});

aiRouter.delete("/chat/history", async (req, res) => {
  const userId = await resolveUserId(req.headers["x-user-id"] as string);
  await prisma.chatMessage.deleteMany({ where: { userId } });
  res.status(204).send();
});

aiRouter.post("/chat", async (req, res) => {
  const userId = await resolveUserId(req.headers["x-user-id"] as string);
  const { message } = z.object({ message: z.string().min(1) }).parse(req.body);

  const history = await prisma.chatMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  const { reply, source, offlineReason } = await chatWithOracle(
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

  await learnFromChatMessage(userId, message).catch(() => {});

  res.json({ reply, source, offlineReason });
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
  const result = await prioritizeTasks(userId, requestLocale(req));
  res.json(result);
});

aiRouter.get("/insights", async (req, res) => {
  const userId = await resolveUserId(req.headers["x-user-id"] as string);
  const [memories, debriefs, emotional, learning, operatorName] = await Promise.all([
    prisma.aIMemory.findMany({
      where: { userId },
      orderBy: { importance: "desc" },
      take: 8,
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
    buildOperatorLearningContext(userId),
    getOperatorName(userId),
  ]);

  const prompts: string[] = [];
  const { patterns, triggers } = learning.strategicProfile;

  if (patterns.length > 0) {
    prompts.push(`${operatorName}, I've noticed: ${patterns[0]}`);
  }
  if (triggers.length > 0) {
    prompts.push(`When ${triggers[0].toLowerCase()} hits, protect your focus before adding new commitments.`);
  }
  if (debriefs[0]?.patternDetected) {
    prompts.unshift(`${operatorName}, from your last debrief: ${debriefs[0].patternDetected}`);
  }

  if (prompts.length === 0) {
    prompts.push(
      `${operatorName}, set your name in profile so Oracle can personalize advice as patterns emerge.`,
      "You perform best with structured mornings — log reflections to help Oracle learn your rhythm.",
      "Financial and admin tasks tend to slip when emotional load is high — batch them in low-resistance windows."
    );
  }

  res.json({
    operatorName,
    proactivePrompts: prompts.slice(0, 5),
    memories: memories.map((m) => m.content),
    patterns: learning.strategicProfile.patterns,
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
