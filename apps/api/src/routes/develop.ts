import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { asyncHandler } from "../lib/asyncHandler.js";
import { prisma } from "../lib/prisma.js";
import { resolveUserId } from "../lib/user.js";
import { requestLocale } from "../lib/requestLocale.js";
import { getDevelopHub, getCognitiveProfile } from "../services/cognitiveProfileEngine.js";
import { getKnowledgeGraph, rebuildKnowledgeGraph } from "../services/knowledgeGraphEngine.js";
import {
  generateKnowledgeItems,
  generateLearningTopics,
  runResearchSynthesis,
  seedHdosModules,
} from "../services/hdosAiEngine.js";

export const developRouter = Router();

function idParam(v: string | string[]) {
  return Array.isArray(v) ? v[0]! : v;
}

developRouter.get("/hub", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  res.json(await getDevelopHub(userId, requestLocale(req)));
}));

developRouter.get("/profile", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  res.json(await getCognitiveProfile(userId));
}));

developRouter.post("/seed", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const locale = requestLocale(req);
  const seeded = await seedHdosModules(userId, locale);
  await rebuildKnowledgeGraph(userId).catch(() => {});
  res.json({ ok: true, seeded, hub: await getDevelopHub(userId, locale) });
}));

developRouter.post("/assess", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const locale = requestLocale(req);
  const { runDevelopmentCycle } = await import("../services/developmentIntelEngine.js");
  const snapshot = await runDevelopmentCycle(userId, locale, { force: true });
  res.json({ ok: true, snapshot, hub: await getDevelopHub(userId, locale) });
}));

developRouter.get("/graph", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  res.json(await getKnowledgeGraph(userId));
}));

developRouter.post("/graph/rebuild", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  res.json(await rebuildKnowledgeGraph(userId));
}));

developRouter.get("/knowledge", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  res.json(await prisma.knowledgeItem.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 }));
}));

developRouter.post("/knowledge/generate", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const body = z.object({ focus: z.string().min(1).max(500).optional() }).parse(req.body ?? {});
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { knowledgeInterests: true } });
  const interests = Array.isArray(user.knowledgeInterests)
    ? (user.knowledgeInterests as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  res.json(
    await generateKnowledgeItems(userId, requestLocale(req), { focus: body.focus, interests })
  );
}));

developRouter.patch("/knowledge/interests", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const body = z.object({ interests: z.array(z.string().min(1).max(120)).max(20) }).parse(req.body);
  await prisma.user.update({
    where: { id: userId },
    data: { knowledgeInterests: body.interests as Prisma.InputJsonValue },
  });
  res.json({ interests: body.interests });
}));

developRouter.post("/knowledge", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const body = z
    .object({
      title: z.string().min(1),
      summary: z.string().min(1),
      source: z.string().optional(),
      biasNote: z.string().optional(),
      uncertainty: z.string().optional(),
    })
    .parse(req.body);
  res.status(201).json(await prisma.knowledgeItem.create({ data: { userId, ...body } }));
}));

developRouter.delete("/knowledge/:id", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  await prisma.knowledgeItem.deleteMany({ where: { userId, id: idParam(req.params.id) } });
  res.json({ ok: true });
}));

developRouter.get("/learning", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  res.json(await prisma.learningTopic.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } }));
}));

developRouter.post("/learning/generate", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  res.json(await generateLearningTopics(userId, requestLocale(req)));
}));

developRouter.post("/learning", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const body = z
    .object({
      topic: z.string().min(1),
      proficiency: z.number().int().min(0).max(100).optional(),
      nextStep: z.string().optional(),
    })
    .parse(req.body);
  res.status(201).json(await prisma.learningTopic.create({ data: { userId, ...body } }));
}));

developRouter.patch("/learning/:id", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const body = z
    .object({
      proficiency: z.number().int().min(0).max(100).optional(),
      readyToLearn: z.boolean().optional(),
      nextStep: z.string().optional(),
    })
    .parse(req.body);
  const row = await prisma.learningTopic.updateMany({
    where: { userId, id: idParam(req.params.id) },
    data: body,
  });
  if (row.count === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(await prisma.learningTopic.findFirst({ where: { userId, id: idParam(req.params.id) } }));
}));

developRouter.get("/relationships", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  res.json(await prisma.relationship.findMany({ where: { userId }, orderBy: { importance: "desc" } }));
}));

developRouter.post("/relationships", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const body = z
    .object({
      name: z.string().min(1),
      role: z.string().optional(),
      notes: z.string().optional(),
      importance: z.number().int().min(0).max(100).optional(),
    })
    .parse(req.body);
  const row = await prisma.relationship.create({ data: { userId, ...body } });
  await rebuildKnowledgeGraph(userId).catch(() => {});
  res.status(201).json(row);
}));

developRouter.delete("/relationships/:id", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  await prisma.relationship.deleteMany({ where: { userId, id: idParam(req.params.id) } });
  res.json({ ok: true });
}));

developRouter.get("/health", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  res.json(await prisma.healthLog.findMany({ where: { userId }, orderBy: { loggedAt: "desc" }, take: 60 }));
}));

developRouter.post("/health", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const body = z
    .object({
      kind: z.enum(["SLEEP", "ENERGY", "EXERCISE", "MOOD", "NUTRITION", "OTHER"]),
      value: z.number().int().min(0).max(100).optional(),
      note: z.string().optional(),
    })
    .parse(req.body);
  res.status(201).json(await prisma.healthLog.create({ data: { userId, ...body } }));
}));

developRouter.get("/finance", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  res.json(await prisma.financeGoal.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } }));
}));

developRouter.post("/finance", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const body = z
    .object({
      title: z.string().min(1),
      targetAmount: z.number().optional(),
      currentAmount: z.number().optional(),
      notes: z.string().optional(),
    })
    .parse(req.body);
  res.status(201).json(await prisma.financeGoal.create({ data: { userId, ...body } }));
}));

developRouter.patch("/finance/:id", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const body = z
    .object({
      currentAmount: z.number().optional(),
      status: z.enum(["ACTIVE", "PAUSED", "COMPLETED"]).optional(),
    })
    .parse(req.body);
  await prisma.financeGoal.updateMany({ where: { userId, id: idParam(req.params.id) }, data: body });
  res.json(await prisma.financeGoal.findFirst({ where: { userId, id: idParam(req.params.id) } }));
}));

developRouter.get("/creativity", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  res.json(await prisma.creativeIdea.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } }));
}));

developRouter.post("/creativity", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const body = z.object({ title: z.string().min(1), description: z.string().optional() }).parse(req.body);
  const row = await prisma.creativeIdea.create({ data: { userId, ...body } });
  await rebuildKnowledgeGraph(userId).catch(() => {});
  res.status(201).json(row);
}));

developRouter.patch("/creativity/:id", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const body = z.object({ status: z.enum(["SPARK", "DEVELOPING", "DONE", "ARCHIVED"]).optional() }).parse(req.body);
  await prisma.creativeIdea.updateMany({ where: { userId, id: idParam(req.params.id) }, data: body });
  res.json(await prisma.creativeIdea.findFirst({ where: { userId, id: idParam(req.params.id) } }));
}));

developRouter.get("/research", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  res.json(await prisma.researchItem.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } }));
}));

developRouter.post("/research", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const body = z.object({ query: z.string().min(3) }).parse(req.body);
  res.status(201).json(await runResearchSynthesis(userId, body.query, requestLocale(req)));
}));
