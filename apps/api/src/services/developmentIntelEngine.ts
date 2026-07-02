import { prisma } from "../lib/prisma.js";
import { Prisma } from "@prisma/client";
import { createChatCompletion } from "../lib/openai.js";
import {
  buildOperatorLearningContext,
  buildOracleSystemPrompt,
  rememberInsight,
} from "../lib/operatorLearning.js";
import type { AppLocale } from "../lib/locale.js";
import { generateKnowledgeItems } from "./hdosAiEngine.js";

const STALE_MS = 20 * 60 * 60 * 1000;

export type DevelopmentSnapshot = {
  blindSpots: string[];
  knowledgePulse: { title: string; summary: string; uncertainty?: string };
  learningOpportunity: { topic: string; reason: string; nextStep: string };
  worldviewNote: string;
  assessedAt: string;
};

function parseSnapshot(raw: unknown): DevelopmentSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (!Array.isArray(s.blindSpots) || !s.knowledgePulse || !s.learningOpportunity) return null;
  const pulse = s.knowledgePulse as Record<string, unknown>;
  const learn = s.learningOpportunity as Record<string, unknown>;
  return {
    blindSpots: (s.blindSpots as unknown[]).filter((x): x is string => typeof x === "string"),
    knowledgePulse: {
      title: String(pulse.title ?? ""),
      summary: String(pulse.summary ?? ""),
      uncertainty: pulse.uncertainty ? String(pulse.uncertainty) : undefined,
    },
    learningOpportunity: {
      topic: String(learn.topic ?? ""),
      reason: String(learn.reason ?? ""),
      nextStep: String(learn.nextStep ?? ""),
    },
    worldviewNote: String(s.worldviewNote ?? ""),
    assessedAt: String(s.assessedAt ?? new Date().toISOString()),
  };
}

export async function getDevelopmentSnapshot(userId: string): Promise<DevelopmentSnapshot | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { cognitiveSnapshot: true },
  });
  return parseSnapshot(user?.cognitiveSnapshot);
}

function isStale(at: Date | null | undefined, now = new Date()): boolean {
  if (!at) return true;
  return now.getTime() - at.getTime() > STALE_MS;
}

/** AI assessment: blind spots, knowledge pulse, learning opportunity, worldview expansion. */
export async function assessDevelopmentIntel(
  userId: string,
  locale: AppLocale = "en"
): Promise<DevelopmentSnapshot> {
  const [
    learning,
    user,
    missions,
    clarity,
    journals,
    memories,
    knowledgeItems,
    learningTopics,
    relationships,
    healthLogs,
    financeGoals,
    research,
  ] = await Promise.all([
    buildOperatorLearningContext(userId),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { knowledgeInterests: true },
    }),
    prisma.mission.findMany({ where: { userId, status: "ACTIVE" }, take: 6 }),
    prisma.clarityIssue.findMany({
      where: { userId, status: { in: ["ACTIVE", "CLARIFYING"] } },
      take: 5,
    }),
    prisma.journalEntry.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { content: true, mood: true },
    }),
    prisma.aIMemory.findMany({
      where: { userId },
      orderBy: { importance: "desc" },
      take: 12,
      select: { content: true, category: true },
    }),
    prisma.knowledgeItem.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { title: true, summary: true },
    }),
    prisma.learningTopic.findMany({ where: { userId }, take: 8 }),
    prisma.relationship.findMany({ where: { userId }, take: 5 }),
    prisma.healthLog.findMany({
      where: { userId, loggedAt: { gte: new Date(Date.now() - 14 * 86400000) } },
      take: 10,
    }),
    prisma.financeGoal.findMany({ where: { userId, status: "ACTIVE" }, take: 5 }),
    prisma.researchItem.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: { query: true },
    }),
  ]);

  const interests = Array.isArray(user.knowledgeInterests)
    ? (user.knowledgeInterests as unknown[]).filter((x): x is string => typeof x === "string")
    : [];

  const system = buildOracleSystemPrompt(
    learning.operatorName,
    learning,
    locale,
    `You are Oracle's Development Intelligence Engine — the living cognitive model of this human.

Assess deeply (not superficially):
- Blind spots: gaps between stated goals and behavior, unexamined assumptions, ignored life domains, intellectual stagnation, relationship neglect, contradictions in values vs actions, what they avoid thinking about, biases in their worldview
- Knowledge pulse: one insight that genuinely broadens their worldview today — connect ideas across disciplines, indicate uncertainty, avoid outrage/clickbait
- Learning opportunity: what they likely misunderstand, forgot, or are ready to learn next — with one concrete next step
- Worldview note: one sentence connecting an idea from a different field to their current life

Be specific to their data. Never diagnose. Never manipulate. Optimise for understanding and growth.

Return JSON:
{
  "blindSpots": ["..."],
  "knowledgePulse": { "title": "...", "summary": "...", "uncertainty": "..." },
  "learningOpportunity": { "topic": "...", "reason": "...", "nextStep": "..." },
  "worldviewNote": "..."
}`
  );

  const context = [
    `Knowledge interests: ${interests.join(", ") || "none set"}`,
    `Active missions: ${missions.map((m) => m.title).join("; ") || "none"}`,
    `Clarity issues: ${clarity.map((c) => c.title).join("; ") || "none"}`,
    `Patterns: ${learning.strategicProfile.patterns.join("; ") || "forming"}`,
    `Triggers: ${learning.strategicProfile.triggers.join("; ") || "none"}`,
    `Strengths: ${learning.strategicProfile.strengths.join("; ") || "none"}`,
    `Recent journal: ${journals.map((j) => j.content.slice(0, 150)).join(" | ") || "none"}`,
    `Top memories: ${memories.map((m) => m.content.slice(0, 100)).join("; ") || "none"}`,
    `Recent knowledge: ${knowledgeItems.map((k) => k.title).join("; ") || "none yet"}`,
    `Learning topics: ${learningTopics.map((t) => `${t.topic} (${t.proficiency}%)`).join("; ") || "none"}`,
    `Relationships mapped: ${relationships.length}`,
    `Health logs (14d): ${healthLogs.length}`,
    `Finance goals: ${financeGoals.map((f) => f.title).join("; ") || "none"}`,
    `Research queries: ${research.map((r) => r.query).join("; ") || "none"}`,
  ].join("\n");

  const result = await createChatCompletion({
    model: "gpt-4o-mini",
    temperature: 0.55,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: context },
    ],
  });

  let snapshot: DevelopmentSnapshot;
  if (result.ok) {
    const raw = JSON.parse(result.completion.choices[0]?.message?.content ?? "{}") as Record<string, unknown>;
    snapshot = {
      blindSpots: Array.isArray(raw.blindSpots)
        ? (raw.blindSpots as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 6)
        : [],
      knowledgePulse: {
        title: String((raw.knowledgePulse as Record<string, unknown>)?.title ?? "Today's insight"),
        summary: String((raw.knowledgePulse as Record<string, unknown>)?.summary ?? ""),
        uncertainty: (raw.knowledgePulse as Record<string, unknown>)?.uncertainty
          ? String((raw.knowledgePulse as Record<string, unknown>).uncertainty)
          : undefined,
      },
      learningOpportunity: {
        topic: String((raw.learningOpportunity as Record<string, unknown>)?.topic ?? "Adaptive learning"),
        reason: String((raw.learningOpportunity as Record<string, unknown>)?.reason ?? ""),
        nextStep: String((raw.learningOpportunity as Record<string, unknown>)?.nextStep ?? "Review Learning tab"),
      },
      worldviewNote: String(raw.worldviewNote ?? ""),
      assessedAt: new Date().toISOString(),
    };
  } else {
    snapshot = fallbackSnapshot(learning.operatorName, interests, missions.length, relationships.length);
  }

  if (snapshot.blindSpots.length === 0) {
    snapshot.blindSpots = fallbackSnapshot(learning.operatorName, interests, missions.length, relationships.length).blindSpots;
  }
  if (!snapshot.knowledgePulse.summary) {
    snapshot.knowledgePulse.summary =
      interests.length > 0
        ? `Your interest in ${interests[0]} hasn't been explored recently — Oracle can generate a fresh perspective.`
        : "Add topics you're curious about so Oracle can broaden your worldview proactively.";
  }

  return snapshot;
}

function fallbackSnapshot(
  name: string,
  interests: string[],
  missionCount: number,
  relCount: number
): DevelopmentSnapshot {
  const blindSpots: string[] = [];
  if (interests.length === 0) blindSpots.push(`${name}, you haven't told Oracle what topics fascinate you — knowledge can't expand in the dark`);
  if (relCount === 0) blindSpots.push("Key relationships aren't mapped — conflict patterns and communication blind spots stay invisible");
  if (missionCount > 4) blindSpots.push("Many active missions may hide which one actually moves your life forward");
  if (blindSpots.length === 0) blindSpots.push("Patterns are forming — keep journaling so Oracle can detect what you avoid examining");

  return {
    blindSpots,
    knowledgePulse: {
      title: "Intellectual cross-pollination",
      summary: "The best insights often come from connecting an unrelated field to your current challenge — tell Oracle what you're curious about.",
      uncertainty: "Without your stated interests, recommendations stay generic.",
    },
    learningOpportunity: {
      topic: "Metacognition under pressure",
      reason: "Understanding how you think when overloaded improves every other domain",
      nextStep: "Complete one clarity step before adding new commitments",
    },
    worldviewNote: "Attention is finite — what you choose to learn shapes who you become.",
    assessedAt: new Date().toISOString(),
  };
}

async function persistKnowledgePulse(userId: string, pulse: DevelopmentSnapshot["knowledgePulse"]) {
  const recent = await prisma.knowledgeItem.findFirst({
    where: { userId, title: pulse.title },
    orderBy: { createdAt: "desc" },
  });
  if (recent && Date.now() - recent.createdAt.getTime() < STALE_MS) return recent;

  return prisma.knowledgeItem.create({
    data: {
      userId,
      title: pulse.title,
      summary: pulse.summary,
      source: "Oracle development intelligence",
      uncertainty: pulse.uncertainty ?? null,
      tags: ["auto", "daily-pulse"],
      relevance: 85,
    },
  });
}

async function persistLearningOpportunity(
  userId: string,
  opp: DevelopmentSnapshot["learningOpportunity"]
) {
  const existing = await prisma.learningTopic.findFirst({
    where: { userId, topic: { equals: opp.topic, mode: "insensitive" } },
  });
  if (existing) {
    return prisma.learningTopic.update({
      where: { id: existing.id },
      data: {
        readyToLearn: true,
        nextStep: opp.nextStep,
        notes: opp.reason,
      },
    });
  }
  return prisma.learningTopic.create({
    data: {
      userId,
      topic: opp.topic,
      proficiency: 35,
      readyToLearn: true,
      nextStep: opp.nextStep,
      notes: opp.reason,
    },
  });
}

/** Full cycle: assess, expand knowledge, update learning, store snapshot. */
export async function runDevelopmentCycle(
  userId: string,
  locale: AppLocale = "en",
  opts?: { force?: boolean }
): Promise<DevelopmentSnapshot> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { cognitiveSnapshotAt: true, cognitiveSnapshot: true },
  });

  if (!opts?.force && user?.cognitiveSnapshotAt && !isStale(user.cognitiveSnapshotAt)) {
    const cached = parseSnapshot(user.cognitiveSnapshot);
    if (cached) return cached;
  }

  const snapshot = await assessDevelopmentIntel(userId, locale);

  await Promise.all([
    prisma.user.update({
      where: { id: userId },
      data: {
        cognitiveSnapshot: snapshot as unknown as Prisma.InputJsonValue,
        cognitiveSnapshotAt: new Date(),
      },
    }),
    persistKnowledgePulse(userId, snapshot.knowledgePulse),
    persistLearningOpportunity(userId, snapshot.learningOpportunity),
    ...snapshot.blindSpots.slice(0, 3).map((b) =>
      rememberInsight(userId, b.slice(0, 200), "pattern", 70).catch(() => {})
    ),
  ]);

  // Also generate additional knowledge from interests if stale
  const latestKnowledge = await prisma.knowledgeItem.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  if (!latestKnowledge || isStale(latestKnowledge.createdAt)) {
    await generateKnowledgeItems(userId, locale).catch(() => {});
  }

  return snapshot;
}

/** Refresh if snapshot is older than 20h. Returns current snapshot. */
export async function ensureDevelopmentFresh(
  userId: string,
  locale: AppLocale = "en"
): Promise<DevelopmentSnapshot | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { cognitiveSnapshotAt: true, cognitiveSnapshot: true },
  });
  if (!isStale(user?.cognitiveSnapshotAt)) {
    return parseSnapshot(user?.cognitiveSnapshot);
  }
  try {
    return await runDevelopmentCycle(userId, locale);
  } catch (err) {
    console.warn(`[Oracle] development cycle failed for ${userId}:`, (err as Error)?.message);
    return parseSnapshot(user?.cognitiveSnapshot);
  }
}
