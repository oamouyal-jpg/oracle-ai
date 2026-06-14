import { prisma } from "../lib/prisma.js";
import { asStringArray } from "../lib/arrays.js";
import { createChatCompletion } from "../lib/openai.js";
import type { AppLocale } from "../lib/locale.js";
import {
  buildOperatorLearningContext,
  buildOracleSystemPrompt,
} from "../lib/operatorLearning.js";
import { mockDailyOracleLine } from "../lib/apiLocale.js";

export type DailyOracleLineResult = {
  line: string;
  subline: string | null;
  source: "openai" | "offline";
};

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

async function buildDailyOracleContext(userId: string): Promise<Record<string, unknown>> {
  const [
    learning,
    missions,
    tasks,
    clarityIssues,
    lastState,
    pendingAgents,
    lastReflection,
  ] = await Promise.all([
    buildOperatorLearningContext(userId),
    prisma.mission.findMany({
      where: { userId, status: "ACTIVE" },
      orderBy: { priorityScore: "desc" },
      take: 5,
      include: { domain: true },
    }),
    prisma.task.findMany({
      where: { userId, status: { in: ["PENDING", "IN_PROGRESS"] } },
      orderBy: { priority: "desc" },
      take: 5,
    }),
    prisma.clarityIssue.findMany({
      where: { userId, status: { in: ["ACTIVE", "CLARIFYING"] } },
      orderBy: { updatedAt: "desc" },
      take: 3,
      include: {
        outcome: { select: { northStarStatement: true } },
        steps: { where: { status: "CURRENT" }, take: 1 },
      },
    }),
    prisma.stateSnapshot.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.actionExecutionQueue.findMany({
      where: {
        userId,
        status: { in: ["PENDING", "AWAITING_APPROVAL", "APPROVED"] },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    prisma.reflection.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    operatorName: learning.operatorName,
    patterns: learning.strategicProfile?.patterns ?? [],
    activeMissions: missions.map((m) => ({
      title: m.title,
      progress: m.progress,
      domain: m.domain?.name,
      blockers: asStringArray(m.blockers),
    })),
    focusTasks: tasks.map((t) => ({ title: t.title, priority: t.priority })),
    clarity: clarityIssues.map((i) => ({
      title: i.title,
      status: i.status,
      northStar: i.outcome?.northStarStatement,
      currentStep: i.steps[0]?.title,
    })),
    recentState: lastState
      ? {
          state: lastState.detectedState,
          intensity: lastState.emotionalIntensity,
          summary: lastState.aiReasoningSummary,
        }
      : null,
    oracleCanDo: pendingAgents.map((a) => ({
      title: a.actionTitle,
      status: a.status,
      integration: a.integrationTool,
    })),
    lastReflectionSnippet: lastReflection?.content?.slice(0, 200),
  };
}

export async function generateDailyOracleLine(
  userId: string,
  locale: AppLocale = "en"
): Promise<DailyOracleLineResult> {
  const [context, learning] = await Promise.all([
    buildDailyOracleContext(userId),
    buildOperatorLearningContext(userId),
  ]);

  const localeInstruction =
    locale === "he"
      ? "Write line and subline in Hebrew."
      : locale === "fr"
        ? "Write line and subline in French."
        : "Write line and subline in English.";

  const systemPrompt = buildOracleSystemPrompt(
    learning.operatorName,
    learning,
    locale,
    `Generate today's Daily Oracle — one clever, warm phrase for when ${learning.operatorName} opens the app. ${localeInstruction}

Return valid json only with keys:
- line (string, max 18 words): witty, specific to their situation — reference a mission, clarity issue, or state if relevant. Not generic motivational poster text.
- subline (string, max 14 words, optional): a grounded nudge — what to lean into today.

Tone: chief-of-staff who knows them. Clever, not cute. No emojis.`
  );

  const aiResult = await createChatCompletion({
    model: "gpt-4o-mini",
    temperature: 0.75,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Life context:\n${JSON.stringify(context, null, 2)}` },
    ],
  });

  if (!aiResult.ok) {
    const mock = mockDailyOracleLine(learning.operatorName, locale, context);
    return { ...mock, source: "offline" };
  }

  const raw = aiResult.completion.choices[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw) as { line?: string; subline?: string };
    const line = parsed.line?.trim();
    if (!line) {
      const mock = mockDailyOracleLine(learning.operatorName, locale, context);
      return { ...mock, source: "offline" };
    }
    return {
      line,
      subline: parsed.subline?.trim() || null,
      source: "openai",
    };
  } catch {
    const mock = mockDailyOracleLine(learning.operatorName, locale, context);
    return { ...mock, source: "offline" };
  }
}

export async function getOrCreateDailyOracleLine(
  userId: string,
  locale: AppLocale = "en"
): Promise<DailyOracleLineResult & { id: string; date: string }> {
  const today = startOfDay();

  const existing = await prisma.dailyOracleLine.findFirst({
    where: { userId, date: { gte: today } },
  });

  if (existing) {
    if (existing.locale !== locale) {
      return regenerateDailyOracleLine(userId, locale);
    }
    return {
      id: existing.id,
      date: existing.date.toISOString(),
      line: existing.line,
      subline: existing.subline,
      source: existing.source as "openai" | "offline",
    };
  }

  const generated = await generateDailyOracleLine(userId, locale);
  const row = await prisma.dailyOracleLine.create({
    data: {
      userId,
      date: today,
      line: generated.line,
      subline: generated.subline,
      locale,
      source: generated.source,
    },
  });

  return {
    id: row.id,
    date: row.date.toISOString(),
    line: row.line,
    subline: row.subline,
    source: row.source as "openai" | "offline",
  };
}

export async function regenerateDailyOracleLine(
  userId: string,
  locale: AppLocale = "en"
): Promise<DailyOracleLineResult & { id: string; date: string }> {
  const today = startOfDay();
  const generated = await generateDailyOracleLine(userId, locale);

  const row = await prisma.dailyOracleLine.upsert({
    where: { userId_date: { userId, date: today } },
    create: {
      userId,
      date: today,
      line: generated.line,
      subline: generated.subline,
      locale,
      source: generated.source,
    },
    update: {
      line: generated.line,
      subline: generated.subline,
      locale,
      source: generated.source,
    },
  });

  return {
    id: row.id,
    date: row.date.toISOString(),
    line: row.line,
    subline: row.subline,
    source: row.source as "openai" | "offline",
  };
}
