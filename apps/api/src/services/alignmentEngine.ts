import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { asStringArray } from "../lib/arrays.js";
import { createChatCompletion } from "../lib/openai.js";
import { localeAiInstruction, type AppLocale } from "../lib/locale.js";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function buildUserContext(userId: string) {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 14);

  const [missions, tasks, reflections, debriefs, emotional, memories, updates] =
    await Promise.all([
      prisma.mission.findMany({
        where: { userId, status: { in: ["ACTIVE", "PAUSED"] } },
        include: { updates: { take: 5, orderBy: { createdAt: "desc" } } },
      }),
      prisma.task.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: 40,
      }),
      prisma.reflection.findMany({
        where: { userId, createdAt: { gte: weekAgo } },
        orderBy: { createdAt: "desc" },
        take: 20,
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
      prisma.aIMemory.findMany({
        where: { userId },
        orderBy: { importance: "desc" },
        take: 15,
      }),
      prisma.missionUpdate.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
    ]);

  const taskStats = {
    completed: tasks.filter((t) => t.status === "COMPLETED").length,
    partial: tasks.filter((t) => t.status === "PARTIAL").length,
    skipped: tasks.filter((t) => t.status === "SKIPPED").length,
    delayed: tasks.filter((t) => t.status === "DELAYED").length,
    pending: tasks.filter((t) => t.status === "PENDING" || t.status === "IN_PROGRESS")
      .length,
  };

  return { missions, tasks, reflections, debriefs, emotional, memories, updates, taskStats };
}

export function computeMissionMomentum(
  mission: {
    progress: number;
    emotionalResistance: number;
    updates: { createdAt: Date }[];
    tasks?: { status: string; updatedAt: Date }[];
  },
  recentReflections: { momentumSignal: number | null; missionId?: string }[]
) {
  const now = Date.now();
  const recentUpdates = mission.updates.filter(
    (u) => now - u.createdAt.getTime() < 7 * 86400000
  ).length;
  const updateBoost = Math.min(recentUpdates * 8, 24);
  const completionPct = mission.progress;
  const resistanceScore = mission.emotionalResistance;
  const stabilityScore = Math.max(
    0,
    Math.min(100, 70 - resistanceScore * 0.3 + updateBoost * 0.5)
  );
  const momentumScore = Math.min(
    100,
    Math.round(completionPct * 0.45 + updateBoost + stabilityScore * 0.25)
  );

  return { momentumScore, completionPct, stabilityScore, resistanceScore };
}

export async function processReflection(
  userId: string,
  content: string,
  mood?: number,
  energy?: number,
  locale: AppLocale = "en"
) {
  const ctx = await buildUserContext(userId);

  let extracted: Record<string, unknown>;
  const reflectionResponse = await createChatCompletion({
    model: "gpt-4o-mini",
    temperature: 0.65,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You analyze natural-language life reflections. Progress is NOT just task checkboxes.
Extract JSON: {
  actualProgress (0-100 subjective forward movement today),
  emotionalState (string),
  resistance (0-100),
  momentumSignal (0-100),
  avoidance (string|null),
  alignmentSignal (0-100),
  aiAnalysis (supportive strategic paragraph),
  detectedPatterns (string[]),
  frictionAlert (string|null)
}
Be conversational, intelligent, non-judgmental. Detect intelligent procrastination and false busyness.
${localeAiInstruction(locale)}`,
      },
      {
        role: "user",
        content: JSON.stringify({
          reflection: content,
          mood,
          energy,
          context: {
            missions: ctx.missions.map((m) => m.title),
            taskStats: ctx.taskStats,
            recentReflections: ctx.reflections.slice(0, 3).map((r) => r.content),
          },
        }),
      },
    ],
  });

  if (!reflectionResponse) {
    extracted = mockReflectionExtract(content);
  } else {
    extracted = JSON.parse(reflectionResponse.choices[0]?.message?.content ?? "{}");
  }

  const reflection = await prisma.reflection.create({
    data: {
      userId,
      content,
      mood,
      energy,
      extracted: extracted as Prisma.InputJsonValue,
      actualProgress: Number(extracted.actualProgress) || undefined,
      emotionalState: String(extracted.emotionalState ?? ""),
      resistance: Number(extracted.resistance) || undefined,
      momentumSignal: Number(extracted.momentumSignal) || undefined,
      avoidance: extracted.avoidance ? String(extracted.avoidance) : undefined,
      alignmentSignal: Number(extracted.alignmentSignal) || undefined,
      aiAnalysis: String(extracted.aiAnalysis ?? ""),
    },
  });

  const patterns = asStringArray(extracted.detectedPatterns);
  for (const p of patterns) {
    await prisma.aIMemory.create({
      data: { userId, category: "pattern", content: p, importance: 75 },
    });
  }
  if (extracted.frictionAlert) {
    await prisma.aIMemory.create({
      data: {
        userId,
        category: "friction",
        content: String(extracted.frictionAlert),
        importance: 85,
      },
    });
  }

  await recalculateMissionMomentums(userId);
  return reflection;
}

export async function recalculateMissionMomentums(userId: string) {
  const missions = await prisma.mission.findMany({
    where: { userId, status: "ACTIVE" },
    include: { updates: true, tasks: true },
  });
  const today = startOfDay();

  for (const mission of missions) {
    const scores = computeMissionMomentum(mission, []);
    await prisma.mission.update({
      where: { id: mission.id },
      data: scores,
    });
    await prisma.missionMomentumSnapshot.upsert({
      where: { missionId_date: { missionId: mission.id, date: today } },
      create: {
        missionId: mission.id,
        userId,
        date: today,
        ...scores,
      },
      update: scores,
    });
  }
}

export async function computeLifeAlignment(userId: string, locale: AppLocale = "en") {
  const ctx = await buildUserContext(userId);
  const today = startOfDay();

  const avgMomentum =
    ctx.missions.length > 0
      ? ctx.missions.reduce((s, m) => s + m.momentumScore, 0) / ctx.missions.length
      : 50;

  const recentReflectionAlignment =
    ctx.reflections.length > 0
      ? ctx.reflections.reduce((s, r) => s + (r.alignmentSignal ?? 50), 0) /
        ctx.reflections.length
      : 50;

  const overloadScore = Math.min(
    100,
    ctx.missions.filter((m) => m.status === "ACTIVE").length * 12 +
      ctx.taskStats.pending * 2
  );

  const skippedRatio =
    ctx.tasks.length > 0
      ? (ctx.taskStats.skipped + ctx.taskStats.delayed) / ctx.tasks.length
      : 0;

  let alignmentData: Record<string, unknown>;

  const alignmentResponse = await createChatCompletion({
    model: "gpt-4o-mini",
    temperature: 0.6,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are Oracle Life Alignment Engine. Core question: "Is the user's life genuinely moving forward?"
NOT just task completion. Evaluate alignment, drift, overload, meaningful progress, execution consistency, emotional stability.
Detect friction: repeated delays, abandoned missions, planning without execution, emotional avoidance, overcommitment.
Return JSON: {
  alignmentScore, driftScore, overloadScore, meaningfulProgress, executionConsistency, emotionalStability (all 0-100),
  frictionAreas (string[]), patterns (string[]), recommendations (string[]),
  aiAssessment (paragraph), isLifeMovingForward (boolean)
}
${localeAiInstruction(locale)}`,
      },
      {
        role: "user",
        content: JSON.stringify({ ...ctx, avgMomentum, recentReflectionAlignment, skippedRatio }),
      },
    ],
  });

  if (!alignmentResponse) {
    alignmentData = mockAlignment(ctx, avgMomentum, overloadScore);
  } else {
    alignmentData = JSON.parse(alignmentResponse.choices[0]?.message?.content ?? "{}");
  }

  const snapshot = await prisma.alignmentSnapshot.upsert({
    where: { userId_date: { userId, date: today } },
    create: {
      userId,
      date: today,
      alignmentScore: Number(alignmentData.alignmentScore) || 55,
      driftScore: Number(alignmentData.driftScore) || 30,
      overloadScore: Number(alignmentData.overloadScore) || overloadScore,
      meaningfulProgress: Number(alignmentData.meaningfulProgress) || 50,
      executionConsistency: Number(alignmentData.executionConsistency) || 50,
      emotionalStability: Number(alignmentData.emotionalStability) || 55,
      frictionAreas: asStringArray(alignmentData.frictionAreas),
      patterns: asStringArray(alignmentData.patterns),
      recommendations: asStringArray(alignmentData.recommendations),
      aiAssessment: String(alignmentData.aiAssessment ?? ""),
    },
    update: {
      alignmentScore: Number(alignmentData.alignmentScore) || 55,
      driftScore: Number(alignmentData.driftScore) || 30,
      overloadScore: Number(alignmentData.overloadScore) || overloadScore,
      meaningfulProgress: Number(alignmentData.meaningfulProgress) || 50,
      executionConsistency: Number(alignmentData.executionConsistency) || 50,
      emotionalStability: Number(alignmentData.emotionalStability) || 55,
      frictionAreas: asStringArray(alignmentData.frictionAreas),
      patterns: asStringArray(alignmentData.patterns),
      recommendations: asStringArray(alignmentData.recommendations),
      aiAssessment: String(alignmentData.aiAssessment ?? ""),
    },
  });

  for (const p of asStringArray(alignmentData.patterns)) {
    await prisma.aIMemory.create({
      data: { userId, category: "pattern", content: p, importance: 80 },
    }).catch(() => {});
  }

  return { snapshot, ...alignmentData };
}

export async function getAlignmentDashboard(userId: string) {
  const today = startOfDay();
  let snapshot = await prisma.alignmentSnapshot.findFirst({
    where: { userId, date: { gte: today } },
  });
  if (!snapshot) {
    const result = await computeLifeAlignment(userId);
    snapshot = result.snapshot;
  }

  const [missions, momentumHistory, reflections, patterns, frictions] = await Promise.all([
    prisma.mission.findMany({
      where: { userId, status: "ACTIVE" },
      orderBy: { momentumScore: "desc" },
      include: { domain: true },
    }),
    prisma.missionMomentumSnapshot.findMany({
      where: { userId, date: { gte: new Date(Date.now() - 14 * 86400000) } },
      orderBy: { date: "asc" },
    }),
    prisma.reflection.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.aIMemory.findMany({
      where: { userId, category: "pattern" },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.aIMemory.findMany({
      where: { userId, category: "friction" },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const momentumTrend = momentumHistory.reduce(
    (acc, s) => {
      const key = s.missionId;
      if (!acc[key]) acc[key] = [];
      acc[key].push({
        date: s.date.toISOString(),
        momentum: s.momentumScore,
        stability: s.stabilityScore,
        resistance: s.resistanceScore,
      });
      return acc;
    },
    {} as Record<string, { date: string; momentum: number; stability: number; resistance: number }[]>
  );

  const emotionalTrend = await prisma.emotionalLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 14,
  });

  const alignment = {
    ...snapshot,
    frictionAreas: asStringArray(snapshot.frictionAreas),
    patterns: asStringArray(snapshot.patterns),
    recommendations: asStringArray(snapshot.recommendations),
  };

  return {
    alignment,
    missions: missions.map((m) => ({
      id: m.id,
      title: m.title,
      progress: m.progress,
      momentumScore: m.momentumScore,
      stabilityScore: m.stabilityScore,
      resistanceScore: m.resistanceScore,
      domain: m.domain?.name,
      color: m.domain?.color,
    })),
    momentumTrend,
    reflections,
    patterns: patterns.map((p) => p.content),
    frictionInsights: frictions.map((f) => f.content),
    emotionalTrend: emotionalTrend.map((e) => ({
      level: e.level,
      date: e.createdAt,
    })),
    isLifeMovingForward:
      snapshot.alignmentScore >= 55 && snapshot.meaningfulProgress >= 50,
  };
}

function mockReflectionExtract(content: string) {
  const lower = content.toLowerCase();
  const avoidance = lower.includes("avoid") ? content.slice(0, 120) : null;
  return {
    actualProgress: lower.includes("managed") || lower.includes("progress") ? 65 : 40,
    emotionalState: lower.includes("calm") ? "grounded" : lower.includes("chaos") ? "chaotic" : "mixed",
    resistance: lower.includes("avoid") ? 70 : 35,
    momentumSignal: lower.includes("organized") || lower.includes("forward") ? 60 : 45,
    avoidance,
    alignmentSignal: 55,
    aiAnalysis:
      "Reflection logged. Real progress includes emotional wins and partial movement — not only completed tasks. " +
      (avoidance ? "Avoidance detected: address one small concrete step tomorrow." : "Maintain structure and momentum."),
    detectedPatterns: avoidance ? ["Task avoidance when emotionally taxed"] : [],
    frictionAlert: lower.includes("plan") && !lower.includes("done")
      ? "You may be trapped in planning without execution. Reduce scope."
      : null,
  };
}

function mockAlignment(
  ctx: Awaited<ReturnType<typeof buildUserContext>>,
  avgMomentum: number,
  overloadScore: number
) {
  return {
    alignmentScore: Math.round(avgMomentum * 0.6 + 25),
    driftScore: ctx.missions.length > 5 ? 65 : 35,
    overloadScore,
    meaningfulProgress: Math.round(avgMomentum),
    executionConsistency: 100 - Math.min(80, ctx.taskStats.skipped * 15),
    emotionalStability: 58,
    frictionAreas:
      overloadScore > 60
        ? ["Too many active missions", "Cognitive overload"]
        : ctx.taskStats.skipped > 2
          ? ["Repeated task avoidance"]
          : [],
    patterns: [
      "Productivity improves after structured mornings",
      "Financial tasks avoided after emotional conflict",
    ],
    recommendations: [
      overloadScore > 60
        ? "Reduce active missions. You are overloaded."
        : "Focus on practical structure today, not emotional rumination.",
      "One high-leverage action beats ten low-value tasks.",
    ],
    aiAssessment:
      "Life alignment is moderate. Checkbox completion alone does not indicate forward movement. Focus on reducing uncertainty in your highest-impact mission while protecting nervous system stability.",
    isLifeMovingForward: avgMomentum >= 50,
  };
}
