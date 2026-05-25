import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler.js";
import { prisma } from "../lib/prisma.js";
import { asStringArray } from "../lib/arrays.js";
import { resolveUserId } from "../lib/user.js";
import { requestLocale } from "../lib/requestLocale.js";
import { getTradingQuestions } from "../lib/tradingQuestions.js";
import { getTradingRules, localizeDomain } from "../lib/contentLocale.js";
import {
  DEFAULT_TRADING_RULES,
  generateMissionAiReview,
  analyzeDailyUpdate,
  processTradingDailyLog,
  generateWeeklyTradingReport,
} from "../services/missionTracker.js";

export const missionsRouter = Router();

function formatMission(m: Record<string, unknown>) {
  return {
    ...m,
    blockers: asStringArray(m.blockers),
    risks: asStringArray(m.risks),
    nextActions: asStringArray(m.nextActions),
    momentumScore: m.momentumScore ?? 0,
    stabilityScore: m.stabilityScore ?? 50,
    resistanceScore: m.resistanceScore ?? 0,
  };
}

missionsRouter.get("/", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req.headers["x-user-id"] as string);
  const status = req.query.status as string | undefined;
  const type = req.query.type as string | undefined;
  const missions = await prisma.mission.findMany({
    where: {
      userId,
      ...(status ? { status: status as "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED" } : {}),
      ...(type ? { missionType: type as "GENERAL" | "TRADING" } : {}),
    },
    orderBy: { priorityScore: "desc" },
    include: {
      domain: true,
      _count: { select: { tasks: true, updates: true, tradingLogs: true } },
    },
  });
  const locale = requestLocale(req);
  res.json(
    missions.map((m) => {
      const row = m as Record<string, unknown> & {
        domain?: { slug: string; name: string; color: string };
      };
      const formatted = formatMission(row);
      if (row.domain) {
        formatted.domain = localizeDomain(row.domain, locale);
      }
      return formatted;
    })
  );
}));

missionsRouter.post("/", asyncHandler(async (req, res) => {
    const userId = await resolveUserId(req.headers["x-user-id"] as string);
    const schema = z.object({
      title: z.string().min(1),
      purpose: z.string().optional(),
      whyItMatters: z.string().optional(),
      desiredOutcome: z.string().optional(),
      domainId: z.string().optional(),
      missionType: z.enum(["GENERAL", "TRADING"]).optional(),
      priorityScore: z.number().optional(),
      deadline: z.string().datetime().optional(),
      blockers: z.array(z.string()).optional(),
      risks: z.array(z.string()).optional(),
      nextActions: z.array(z.string()).optional(),
      emotionalResistance: z.number().optional(),
      estimatedImpact: z.number().optional(),
      tradingConfig: z.record(z.unknown()).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    const body = parsed.data;

    const purpose = body.purpose?.trim() || undefined;
    const whyItMatters =
      body.whyItMatters?.trim() || purpose || undefined;
    const desiredOutcome = body.desiredOutcome?.trim() || undefined;

    const isTrading = body.missionType === "TRADING";

    const mission = await prisma.mission.create({
      data: {
        userId,
        title: body.title.trim(),
        purpose,
        whyItMatters,
        desiredOutcome,
        domainId: body.domainId?.trim() || undefined,
        missionType: body.missionType ?? "GENERAL",
        priorityScore: body.priorityScore ?? 50,
        deadline: body.deadline ? new Date(body.deadline) : undefined,
        blockers: body.blockers ?? [],
        risks: body.risks ?? [],
        nextActions: body.nextActions ?? [],
        emotionalResistance: body.emotionalResistance ?? (isTrading ? 70 : 0),
        estimatedImpact: body.estimatedImpact ?? 50,
        tradingConfig: isTrading
          ? {
              rules: DEFAULT_TRADING_RULES,
              maxContracts: 1,
              instruments: ["MNQ", "MES"],
              ...body.tradingConfig,
            }
          : undefined,
      },
      include: { domain: true },
    });
    res.status(201).json(formatMission(mission as Record<string, unknown>));
}));

missionsRouter.get("/trading/questions", (req, res) => {
  const locale = requestLocale(req);
  res.json({
    questions: getTradingQuestions(locale),
    rules: getTradingRules(locale),
  });
});

missionsRouter.get("/:id", async (req, res) => {
  const userId = await resolveUserId(req.headers["x-user-id"] as string);
  const mission = await prisma.mission.findFirst({
    where: { id: req.params.id, userId },
    include: {
      domain: true,
      tasks: { orderBy: { priority: "desc" } },
      updates: { orderBy: { createdAt: "desc" }, take: 30 },
      tradingLogs: { orderBy: { date: "desc" }, take: 30 },
    },
  });
  if (!mission) return res.status(404).json({ error: "Not found" });
  res.json(formatMission(mission as Record<string, unknown>));
});

missionsRouter.patch("/:id", async (req, res) => {
  const userId = await resolveUserId(req.headers["x-user-id"] as string);
  const body = z
    .object({
      title: z.string().optional(),
      purpose: z.string().optional(),
      whyItMatters: z.string().optional(),
      desiredOutcome: z.string().optional(),
      status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]).optional(),
      priorityScore: z.number().optional(),
      progress: z.number().min(0).max(100).optional(),
      blockers: z.array(z.string()).optional(),
      risks: z.array(z.string()).optional(),
      nextActions: z.array(z.string()).optional(),
      aiStrategy: z.string().optional(),
      aiNotes: z.string().optional(),
      weeklyReview: z.string().optional(),
      emotionalResistance: z.number().optional(),
    })
    .parse(req.body);

  const result = await prisma.mission.updateMany({
    where: { id: req.params.id, userId },
    data: body,
  });
  if (result.count === 0) return res.status(404).json({ error: "Not found" });
  const mission = await prisma.mission.findUnique({
    where: { id: req.params.id },
    include: { domain: true },
  });
  res.json(formatMission(mission as Record<string, unknown>));
});

missionsRouter.post("/:id/updates", async (req, res) => {
  const userId = await resolveUserId(req.headers["x-user-id"] as string);
  const { content, updateType } = z
    .object({
      content: z.string().min(1),
      updateType: z.enum(["DAILY", "WEEKLY"]).optional(),
    })
    .parse(req.body);

  const mission = await prisma.mission.findFirst({
    where: { id: req.params.id, userId },
  });
  if (!mission) return res.status(404).json({ error: "Not found" });

  const type = updateType ?? "DAILY";
  const analysis = await analyzeDailyUpdate(req.params.id, userId, content, type);

  const update = await prisma.missionUpdate.create({
    data: {
      missionId: req.params.id,
      userId,
      updateType: type,
      content,
      progressSnapshot: analysis.suggestedProgress ?? mission.progress,
      aiAnalysis: analysis.aiAnalysis,
    },
  });

  if (analysis.suggestedProgress != null) {
    await prisma.mission.update({
      where: { id: req.params.id },
      data: { progress: analysis.suggestedProgress },
    });
  }

  res.status(201).json({ update, analysis });
});

missionsRouter.post("/:id/ai-review", async (req, res) => {
  const userId = await resolveUserId(req.headers["x-user-id"] as string);
  const mission = await prisma.mission.findFirst({
    where: { id: req.params.id, userId },
  });
  if (!mission) return res.status(404).json({ error: "Not found" });

  const review = await generateMissionAiReview(req.params.id, userId);

  const updated = await prisma.mission.update({
    where: { id: req.params.id },
    data: {
      aiNotes: review.aiNotes,
      aiStrategy: review.aiStrategy,
      progress: review.progressRecommendation ?? mission.progress,
      nextActions: review.nextActions ?? [],
      weeklyReview: review.weeklyReview,
      lastAiReviewAt: new Date(),
    },
    include: { domain: true, updates: { take: 5, orderBy: { createdAt: "desc" } } },
  });

  res.json({ mission: formatMission(updated as Record<string, unknown>), review });
});

missionsRouter.get("/:id/trading/today", async (req, res) => {
  const userId = await resolveUserId(req.headers["x-user-id"] as string);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const log = await prisma.tradingDailyLog.findFirst({
    where: { missionId: req.params.id, userId, date: { gte: today } },
  });
  res.json(log);
});

missionsRouter.post("/:id/trading/daily", async (req, res) => {
  const userId = await resolveUserId(req.headers["x-user-id"] as string);
  const body = z
    .object({
      responses: z.record(z.string()),
      emotionalBefore: z.number().min(1).max(10).optional(),
      emotionalAfter: z.number().min(1).max(10).optional(),
      followedRules: z.boolean().optional(),
      tradedFromCalm: z.boolean().optional(),
      setupQuality: z.number().min(1).max(10).optional(),
      instrument: z.string().optional(),
      contractsUsed: z.number().optional(),
      ruleViolations: z.array(z.string()).optional(),
      revengeTrade: z.boolean().optional(),
      hesitation: z.boolean().optional(),
      overtraded: z.boolean().optional(),
      respectedStop: z.boolean().optional(),
      dailyRisk: z.string().optional(),
      maxLoss: z.string().optional(),
      lessonsLearned: z.string().optional(),
    })
    .parse(req.body);

  const result = await processTradingDailyLog(
    req.params.id,
    userId,
    body.responses,
    body
  );
  res.json(result);
});

missionsRouter.get("/:id/trading/weekly", async (req, res) => {
  const userId = await resolveUserId(req.headers["x-user-id"] as string);
  const report = await generateWeeklyTradingReport(req.params.id, userId);
  res.json(report);
});

missionsRouter.delete("/:id", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req.headers["x-user-id"] as string);
  const result = await prisma.mission.deleteMany({
    where: { id: req.params.id, userId },
  });
  if (result.count === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.status(204).send();
}));
