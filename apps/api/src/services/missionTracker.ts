import { prisma } from "../lib/prisma.js";
import { asStringArray } from "../lib/arrays.js";
import { createChatCompletion } from "../lib/openai.js";

const MISSION_COACH_PERSONA = `You are Oracle Mission Tracker — a strategic life coach tracking long-term missions.
You are direct, supportive, and focused on process over outcomes.
You identify avoidance, emotional resistance, and misalignment.
You never shame. You challenge constructively.`;

const TRADING_COACH_PERSONA = `You are Oracle Trading Coach — a strict but supportive discipline coach for futures trading.
CRITICAL RULES FOR YOUR BEHAVIOR:
- NEVER encourage gambling, revenge trading, over-leverage, or increasing size to recover losses.
- ALWAYS prioritize: process, discipline, emotional stability, and controlled growth over profit.
- Reinforce micro contracts only (1 contract max when re-entering).
- Treat rule violations seriously but without harsh judgment.
- Progress is measured by discipline and emotional control, NOT by P&L.
- If the trader shows revenge trading or emotional trading patterns, call it out clearly and recommend pausing.
- Act like a professional risk manager and performance psychologist combined.`;

export const TRADING_DAILY_QUESTIONS = [
  "Did you follow your rules today?",
  "Did you trade from calm or emotion?",
  "What setup did you take?",
  "Did you overtrade?",
  "Did you respect your stop?",
  "What did you learn?",
  "What needs improvement tomorrow?",
];

export const DEFAULT_TRADING_RULES = [
  "Start with 1 micro contract only",
  "Trade only one instrument at first (MNQ or MES)",
  "Track emotional state before and after each trade",
  "Track whether trades followed the system",
  "Track rule violations, revenge trades, and hesitation",
  "Track setup quality and daily risk limits",
  "Progress measured by discipline, not profit",
];

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

async function getMissionContext(missionId: string, userId: string) {
  const mission = await prisma.mission.findFirst({
    where: { id: missionId, userId },
    include: {
      domain: true,
      updates: { orderBy: { createdAt: "desc" }, take: 14 },
      tradingLogs: { orderBy: { createdAt: "desc" }, take: 14 },
      tasks: { where: { status: { not: "COMPLETED" } }, take: 10 },
    },
  });
  if (!mission) throw new Error("Mission not found");

  return {
    mission,
    summary: {
      title: mission.title,
      type: mission.missionType,
      whyItMatters: mission.whyItMatters ?? mission.purpose,
      desiredOutcome: mission.desiredOutcome,
      status: mission.status,
      progress: mission.progress,
      blockers: asStringArray(mission.blockers),
      risks: asStringArray(mission.risks),
      nextActions: asStringArray(mission.nextActions),
      emotionalDifficulty: mission.emotionalResistance,
      aiNotes: mission.aiNotes,
      recentUpdates: mission.updates.map((u) => ({
        type: u.updateType,
        content: u.content,
        date: u.createdAt,
      })),
      tradingLogs: mission.tradingLogs.map((l) => ({
        date: l.date,
        scores: {
          discipline: l.disciplineScore,
          execution: l.executionScore,
          risk: l.riskControlScore,
        },
        violations: asStringArray(l.ruleViolations),
        revengeTrade: l.revengeTrade,
      })),
    },
  };
}

export async function generateMissionAiReview(missionId: string, userId: string) {
  const { mission, summary } = await getMissionContext(missionId, userId);
  const persona =
    mission.missionType === "TRADING" ? TRADING_COACH_PERSONA : MISSION_COACH_PERSONA;

  const response = await createChatCompletion({
    model: "gpt-4o-mini",
    temperature: 0.65,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `${persona}
Return JSON: { aiNotes, aiStrategy, progressRecommendation (0-100), nextActions (string[]), weeklyReview, riskWarnings (string[]), encouragement (string) }`,
      },
      { role: "user", content: JSON.stringify(summary, null, 2) },
    ],
  });

  if (!response.ok) {
    return mockMissionReview(mission.missionType === "TRADING", summary);
  }

  const raw = response.completion.choices[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(raw);
  } catch {
    return mockMissionReview(mission.missionType === "TRADING", summary);
  }
}

export async function analyzeDailyUpdate(
  missionId: string,
  userId: string,
  content: string,
  updateType: "DAILY" | "WEEKLY"
) {
  const { mission, summary } = await getMissionContext(missionId, userId);

  const response = await createChatCompletion({
    model: "gpt-4o-mini",
    temperature: 0.6,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `${MISSION_COACH_PERSONA}
Analyze this ${updateType} mission update. Return JSON: { aiAnalysis (paragraph), suggestedProgress (0-100), patternDetected (string|null), nextFocus (string) }`,
      },
      {
        role: "user",
        content: JSON.stringify({ mission: summary, newUpdate: content }),
      },
    ],
  });

  if (!response.ok) {
    return {
      aiAnalysis: `Logged ${updateType.toLowerCase()} progress. Stay focused on next actions. Emotional difficulty remains a factor — protect structure.`,
      suggestedProgress: Math.min(mission.progress + 2, 100),
    };
  }

  const raw = response.completion.choices[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(raw);
  } catch {
    return {
      aiAnalysis: "Update recorded. Continue executing next actions with discipline.",
      suggestedProgress: mission.progress,
    };
  }
}

export async function processTradingDailyLog(
  missionId: string,
  userId: string,
  responses: Record<string, string>,
  metrics: {
    emotionalBefore?: number;
    emotionalAfter?: number;
    followedRules?: boolean;
    tradedFromCalm?: boolean;
    setupQuality?: number;
    instrument?: string;
    contractsUsed?: number;
    ruleViolations?: string[];
    revengeTrade?: boolean;
    hesitation?: boolean;
    overtraded?: boolean;
    respectedStop?: boolean;
    dailyRisk?: string;
    maxLoss?: string;
    lessonsLearned?: string;
  }
) {
  const { mission, summary } = await getMissionContext(missionId, userId);
  if (mission.missionType !== "TRADING") {
    throw new Error("Not a trading mission");
  }

  const today = startOfDay();

  const response = await createChatCompletion({
    model: "gpt-4o-mini",
    temperature: 0.55,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `${TRADING_COACH_PERSONA}
Analyze today's trading session. Return JSON:
{
  disciplineScore (0-100),
  executionScore (0-100),
  riskControlScore (0-100),
  aiDailyReport (strategic paragraph — process-focused, no profit hype),
  emotionalPattern (string),
  nextImprovementTarget (string),
  shouldPauseTrading (boolean),
  warnings (string[])
}`,
      },
      {
        role: "user",
        content: JSON.stringify({
          mission: summary,
          todayResponses: responses,
          metrics,
          tradingRules: mission.tradingConfig ?? DEFAULT_TRADING_RULES,
        }),
      },
    ],
  });

  if (!response.ok) {
    const mock = mockTradingReport(responses, metrics);
    const log = await prisma.tradingDailyLog.upsert({
      where: { missionId_date: { missionId, date: today } },
      create: {
        missionId,
        userId,
        date: today,
        responses,
        ...metrics,
        ruleViolations: metrics.ruleViolations ?? [],
        disciplineScore: mock.scores.disciplineScore,
        executionScore: mock.scores.executionScore,
        riskControlScore: mock.scores.riskControlScore,
        aiDailyReport: mock.report,
      },
      update: {
        responses,
        ...metrics,
        ruleViolations: metrics.ruleViolations ?? [],
        disciplineScore: mock.scores.disciplineScore,
        executionScore: mock.scores.executionScore,
        riskControlScore: mock.scores.riskControlScore,
        aiDailyReport: mock.report,
      },
    });
    return { log, ...mock };
  }

  const raw = response.completion.choices[0]?.message?.content ?? "{}";
  const analysis = JSON.parse(raw) as {
    disciplineScore: number;
    executionScore: number;
    riskControlScore: number;
    aiDailyReport: string;
    nextImprovementTarget?: string;
    shouldPauseTrading?: boolean;
    warnings?: string[];
  };

  const log = await prisma.tradingDailyLog.upsert({
    where: { missionId_date: { missionId, date: today } },
    create: {
      missionId,
      userId,
      date: today,
      responses,
      ...metrics,
      ruleViolations: metrics.ruleViolations ?? [],
      disciplineScore: analysis.disciplineScore,
      executionScore: analysis.executionScore,
      riskControlScore: analysis.riskControlScore,
      aiDailyReport: analysis.aiDailyReport,
    },
    update: {
      responses,
      ...metrics,
      ruleViolations: metrics.ruleViolations ?? [],
      disciplineScore: analysis.disciplineScore,
      executionScore: analysis.executionScore,
      riskControlScore: analysis.riskControlScore,
      aiDailyReport: analysis.aiDailyReport,
    },
  });

  if (analysis.nextImprovementTarget) {
    await prisma.mission.update({
      where: { id: missionId },
      data: {
        aiNotes: analysis.aiDailyReport,
        lastAiReviewAt: new Date(),
      },
    });
  }

  return {
    log,
    ...analysis,
    scores: {
      discipline: analysis.disciplineScore,
      execution: analysis.executionScore,
      risk: analysis.riskControlScore,
    },
  };
}

export async function generateWeeklyTradingReport(missionId: string, userId: string) {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const logs = await prisma.tradingDailyLog.findMany({
    where: { missionId, userId, createdAt: { gte: weekAgo } },
    orderBy: { date: "asc" },
  });

  const { summary } = await getMissionContext(missionId, userId);

  const response = await createChatCompletion({
    model: "gpt-4o-mini",
    temperature: 0.6,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `${TRADING_COACH_PERSONA}
Generate weekly trading performance report focused on DISCIPLINE not profit.
Return JSON: { report (full narrative), avgDiscipline, avgExecution, avgRiskControl, emotionalPatterns (string[]), topViolations (string[]), nextWeekFocus (string), sizingRecommendation (string — must stay micro) }`,
      },
      { role: "user", content: JSON.stringify({ mission: summary, weekLogs: logs }) },
    ],
  });

  if (!response.ok) {
    return {
      report: mockWeeklyTradingReport(logs),
      logsCount: logs.length,
    };
  }

  const raw = response.completion.choices[0]?.message?.content ?? "{}";
  return { ...JSON.parse(raw), logsCount: logs.length };
}

function mockMissionReview(isTrading: boolean, summary: unknown) {
  if (isTrading) {
    return {
      aiNotes:
        "Re-entry phase requires emotional regulation above all. One micro contract only until 10 disciplined sessions.",
      aiStrategy:
        "Track every session by rules followed, not P&L. Pause immediately after revenge trade impulse.",
      progressRecommendation: 35,
      nextActions: [
        "Complete pre-trade emotional check",
        "Log today's session with honesty",
        "Review rule violations before tomorrow",
      ],
      weeklyReview:
        "Focus on process consistency. No size increases until emotional stability is proven over 2 weeks.",
      riskWarnings: [
        "Avoid trading after high stress",
        "No size increases to recover losses",
      ],
      encouragement: "Discipline compounds. One clean session at a time.",
    };
  }
  return {
    aiNotes: "Mission progressing but blockers need direct attention this week.",
    aiStrategy: "Break next actions into 20-minute blocks. Reduce parallel missions.",
    progressRecommendation: 45,
    nextActions: ["Complete one high-leverage blocker task", "Daily 5-min progress log"],
    weeklyReview: "Maintain momentum on practical execution over planning.",
    riskWarnings: ["Avoidance pattern on admin tasks"],
    encouragement: "Structure creates clarity. Keep moving.",
  };
}

function mockTradingReport(
  responses: Record<string, string>,
  metrics: { revengeTrade?: boolean; followedRules?: boolean }
) {
  const revenge = metrics.revengeTrade ?? false;
  const followed = metrics.followedRules ?? true;
  return {
    scores: {
      disciplineScore: followed && !revenge ? 72 : 45,
      executionScore: followed ? 68 : 40,
      riskControlScore: revenge ? 35 : 70,
    },
    report: revenge
      ? "Rule violation detected: emotional/revenge trading pattern. Recommend pausing tomorrow and reviewing triggers. Process reset required before next session."
      : followed
        ? "Solid discipline focus today. You followed rules and traded with structure. Continue micro size. Tomorrow: pre-trade calm check and one quality setup only."
        : "Mixed session. Review which rules were broken and why. Progress is measured by discipline — tighten process before considering any size change.",
    emotionalPattern: revenge ? "Revenge/emotional risk elevated" : "Stable with room to improve",
    nextImprovementTarget: "Pre-trade emotional grounding ritual",
    shouldPauseTrading: revenge,
    warnings: revenge ? ["Do not increase size", "Consider 24h pause"] : [],
  };
}

function mockWeeklyTradingReport(
  logs: { disciplineScore: number | null; revengeTrade: boolean }[]
) {
  const avgD =
    logs.length > 0
      ? Math.round(
          logs.reduce((s, l) => s + (l.disciplineScore ?? 0), 0) / logs.length
        )
      : 0;
  return `Weekly discipline average: ${avgD}/100. ${
    logs.some((l) => l.revengeTrade)
      ? "Revenge trading appeared this week — enforce pause protocol."
      : "Process tracking on track. Stay at micro size."
  } Next week: one instrument, one contract, emotional check before every session.`;
}
