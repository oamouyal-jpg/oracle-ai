import { prisma } from "../lib/prisma.js";
import { buildOperatorLearningContext } from "../lib/operatorLearning.js";

export type CognitiveProfile = {
  operatorName: string;
  summary: string;
  beliefs: { values: string[]; stableValues: { name: string; description: string | null }[] };
  knowledge: { strengths: string[]; triggers: string[]; memoryCount: number };
  goals: { activeMissions: number; clarityIssues: number; financeGoals: number };
  patterns: { name: string; description: string | null; count: number }[];
  relationships: { count: number; highlights: string[] };
  learning: { topics: number; readyCount: number };
  health: { recentLogs: number; avgMood: number | null };
  creativity: { activeIdeas: number };
  research: { openQueries: number };
  blindSpots: string[];
  moduleCounts: Record<string, number>;
};

export async function getCognitiveProfile(userId: string): Promise<CognitiveProfile> {
  const ctx = await buildOperatorLearningContext(userId);
  const [
    values,
    patterns,
    missionCount,
    clarityCount,
    rels,
    relCount,
    learning,
    healthLogs,
    financeCount,
    creativeCount,
    researchCount,
    memoryCount,
  ] = await Promise.all([
    prisma.stableValue.findMany({ where: { userId }, take: 12 }),
    prisma.userPattern.findMany({ where: { userId }, orderBy: { occurrenceCount: "desc" }, take: 8 }),
    prisma.mission.count({ where: { userId, status: "ACTIVE" } }),
    prisma.clarityIssue.count({ where: { userId, status: { in: ["ACTIVE", "CLARIFYING"] } } }),
    prisma.relationship.findMany({ where: { userId }, orderBy: { importance: "desc" }, take: 5 }),
    prisma.relationship.count({ where: { userId } }),
    prisma.learningTopic.findMany({ where: { userId } }),
    prisma.healthLog.findMany({
      where: { userId, loggedAt: { gte: new Date(Date.now() - 14 * 86400000) } },
      orderBy: { loggedAt: "desc" },
      take: 30,
    }),
    prisma.financeGoal.count({ where: { userId, status: "ACTIVE" } }),
    prisma.creativeIdea.count({ where: { userId, status: { in: ["SPARK", "DEVELOPING"] } } }),
    prisma.researchItem.count({ where: { userId, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.aIMemory.count({ where: { userId } }),
  ]);

  const moodLogs = healthLogs.filter((h) => h.kind === "MOOD" && h.value != null);
  const avgMood =
    moodLogs.length > 0
      ? Math.round(moodLogs.reduce((s, h) => s + (h.value ?? 0), 0) / moodLogs.length)
      : null;

  const blindSpots: string[] = [];
  if (learning.filter((t) => t.proficiency < 40 && t.readyToLearn).length > 0) {
    blindSpots.push("Learning gaps flagged — review Learning tab");
  }
  if (rels.length === 0) blindSpots.push("No key relationships mapped yet");
  if (ctx.strategicProfile.triggers.length > 0) {
    blindSpots.push(`Recurring triggers: ${ctx.strategicProfile.triggers.slice(0, 2).join(", ")}`);
  }

  const summary = [
    `${ctx.operatorName}'s operating picture:`,
    `${missionCount} active missions, ${clarityCount} clarity issues, ${memoryCount} stored memories.`,
    ctx.strategicProfile.patterns.length
      ? `Patterns: ${ctx.strategicProfile.patterns.slice(0, 3).join("; ")}`
      : "Patterns still forming from your activity.",
  ].join(" ");

  return {
    operatorName: ctx.operatorName,
    summary,
    beliefs: {
      values: ctx.strategicProfile.strengths,
      stableValues: values.map((v) => ({ name: v.valueName, description: v.description })),
    },
    knowledge: {
      strengths: ctx.strategicProfile.strengths,
      triggers: ctx.strategicProfile.triggers,
      memoryCount,
    },
    goals: {
      activeMissions: missionCount,
      clarityIssues: clarityCount,
      financeGoals: financeCount,
    },
    patterns: patterns.map((p) => ({
      name: p.patternName,
      description: p.description,
      count: p.occurrenceCount,
    })),
    relationships: {
      count: relCount,
      highlights: rels.map((r) => r.name),
    },
    learning: {
      topics: learning.length,
      readyCount: learning.filter((t) => t.readyToLearn).length,
    },
    health: { recentLogs: healthLogs.length, avgMood },
    creativity: { activeIdeas: creativeCount },
    research: { openQueries: researchCount },
    blindSpots,
    moduleCounts: {
      knowledge: await prisma.knowledgeItem.count({ where: { userId } }),
      learning: learning.length,
      relationships: rels.length,
      health: healthLogs.length,
      finance: financeCount,
      creativity: creativeCount,
      research: researchCount,
    },
  };
}

export async function getDevelopHub(userId: string) {
  const [profile, user, recentKnowledge, learningTopics, relationships, healthLogs, financeGoals, ideas, research] =
    await Promise.all([
      getCognitiveProfile(userId),
      prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { knowledgeInterests: true } }),
      prisma.knowledgeItem.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.learningTopic.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: 10 }),
      prisma.relationship.findMany({ where: { userId }, orderBy: { importance: "desc" }, take: 10 }),
      prisma.healthLog.findMany({ where: { userId }, orderBy: { loggedAt: "desc" }, take: 10 }),
      prisma.financeGoal.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: 10 }),
      prisma.creativeIdea.findMany({
        where: { userId, status: { in: ["SPARK", "DEVELOPING"] } },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
      prisma.researchItem.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: 10 }),
    ]);

  return {
    profile,
    knowledgeInterests: Array.isArray(user.knowledgeInterests)
      ? (user.knowledgeInterests as unknown[]).filter((x): x is string => typeof x === "string")
      : [],
    knowledge: recentKnowledge,
    learning: learningTopics,
    relationships,
    health: healthLogs,
    finance: financeGoals,
    creativity: ideas,
    research,
  };
}
