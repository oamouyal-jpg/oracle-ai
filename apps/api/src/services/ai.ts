import { prisma } from "../lib/prisma.js";
import { asStringArray } from "../lib/arrays.js";
import { createChatCompletion } from "../lib/openai.js";
import type { AppLocale } from "../lib/locale.js";
import {
  buildOperatorLearningContext,
  buildOracleSystemPrompt,
} from "../lib/operatorLearning.js";
import { buildOfflineChatReply, parseChatContext } from "../lib/offlineStrategist.js";

async function buildContext(userId: string): Promise<string> {
  const [learning, domains, missions, tasks, lastDebrief] = await Promise.all([
    buildOperatorLearningContext(userId),
    prisma.domain.findMany({ where: { userId }, take: 12 }),
    prisma.mission.findMany({
      where: { userId, status: "ACTIVE" },
      orderBy: { priorityScore: "desc" },
      take: 8,
      include: { domain: true },
    }),
    prisma.task.findMany({
      where: { userId, status: { in: ["PENDING", "IN_PROGRESS"] } },
      orderBy: { priority: "desc" },
      take: 15,
    }),
    prisma.nightDebrief.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return JSON.stringify(
    {
      operator: learning,
      domains: domains.map((d) => ({
        name: d.name,
        state: d.currentState,
        progress: d.progress,
        issues: asStringArray(d.activeIssues),
      })),
      activeMissions: missions.map((m) => ({
        title: m.title,
        priority: m.priorityScore,
        blockers: asStringArray(m.blockers),
        progress: m.progress,
        domain: m.domain?.name,
      })),
      pendingTasks: tasks.map((t) => ({
        title: t.title,
        priority: t.priority,
        due: t.dueDate,
      })),
      lastDebriefInsight: lastDebrief?.aiAssessment,
      tomorrowPlan: lastDebrief?.tomorrowPlan,
    },
    null,
    2
  );
}

export type ChatOracleResult = {
  reply: string;
  source: "openai" | "offline";
  offlineReason?: string;
};

export async function chatWithOracle(
  userId: string,
  message: string,
  history: { role: string; content: string }[] = [],
  locale: AppLocale = "en"
): Promise<ChatOracleResult> {
  const [context, learning] = await Promise.all([
    buildContext(userId),
    buildOperatorLearningContext(userId),
  ]);
  const parsedContext = parseChatContext(context);
  const systemPrompt = buildOracleSystemPrompt(
    learning.operatorName,
    learning,
    locale,
    `CHAT RULES:
- Answer the user's EXACT question first — in the opening sentence.
- Do not give the same generic "highest leverage action" speech every time.
- Never repeat phrasing from your previous replies in this thread.
- Use life data only when it helps answer what they asked.
- If the question is narrow, give a narrow answer.`
  );

  const liveData = JSON.stringify(
    {
      domains: parsedContext.domains,
      activeMissions: parsedContext.activeMissions,
      pendingTasks: parsedContext.pendingTasks,
      lastDebriefInsight: parsedContext.lastDebriefInsight,
    },
    null,
    2
  );

  const aiResult = await createChatCompletion({
    model: "gpt-4o-mini",
    temperature: 0.9,
    presence_penalty: 0.35,
    frequency_penalty: 0.25,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Here is my current life data (reference only when useful):\n${liveData}`,
      },
      {
        role: "assistant",
        content: `Understood, ${learning.operatorName}. I'll answer each question specifically.`,
      },
      ...history.slice(-12).map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
      { role: "user", content: message },
    ],
  });

  if (!aiResult.ok) {
    return {
      reply: buildOfflineChatReply({
        name: learning.operatorName,
        message,
        patterns: learning.strategicProfile.patterns,
        profile: learning.strategicProfile,
        context: parsedContext,
        history,
        locale,
      }),
      source: "offline",
      offlineReason: aiResult.reason,
    };
  }

  return {
    reply:
      aiResult.completion.choices[0]?.message?.content ??
      "I'm processing your situation. Try again in a moment.",
    source: "openai",
  };
}

export async function generateDailyBriefing(
  userId: string,
  locale: AppLocale = "en"
): Promise<{
  topPriorities: string[];
  emotionalObservation: string;
  focusRecommendation: string;
  reminders: string[];
  missionProgress: string;
  strategicGuidance: string;
  fullContent: string;
}> {
  const [context, learning] = await Promise.all([
    buildContext(userId),
    buildOperatorLearningContext(userId),
  ]);
  const systemPrompt = buildOracleSystemPrompt(
    learning.operatorName,
    learning,
    locale,
    `Generate a morning strategic briefing as JSON with keys: topPriorities (string[]), emotionalObservation, focusRecommendation, reminders (string[]), missionProgress, strategicGuidance, fullContent (narrative paragraph combining all). Address ${learning.operatorName} by name in fullContent.`
  );

  const aiResult = await createChatCompletion({
    model: "gpt-4o-mini",
    temperature: 0.6,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      { role: "user", content: `Context:\n${context}` },
    ],
  });

  if (!aiResult.ok) {
    return mockDailyBriefing(learning.operatorName);
  }

  const raw = aiResult.completion.choices[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(raw) as ReturnType<typeof generateDailyBriefing> extends Promise<infer T> ? T : never;
  } catch {
    return mockDailyBriefing(learning.operatorName);
  }
}

export async function analyzeNightDebrief(
  userId: string,
  responses: Record<string, string>,
  locale: AppLocale = "en"
): Promise<{
  focusScore: number;
  emotionalScore: number;
  executionScore: number;
  alignmentScore: number;
  energyScore: number;
  aiAssessment: string;
  behavioralNotes: string[];
  tomorrowPlan: {
    topPriorities: string[];
    missionCritical: string[];
    emotionalWarnings: string[];
    focusRecommendation: string;
    recoverySuggestions: string[];
    executionStrategy: string;
  };
  patternDetected: string;
}> {
  const [context, learning] = await Promise.all([
    buildContext(userId),
    buildOperatorLearningContext(userId),
  ]);
  const systemPrompt = buildOracleSystemPrompt(
    learning.operatorName,
    learning,
    locale,
    "Analyze the nightly debrief. Return JSON: focusScore, emotionalScore, executionScore, alignmentScore, energyScore (0-100 each), aiAssessment (strategic paragraph addressing the operator by name), behavioralNotes (string[]), tomorrowPlan { topPriorities, missionCritical, emotionalWarnings, focusRecommendation, recoverySuggestions, executionStrategy }, patternDetected."
  );

  const aiResult = await createChatCompletion({
    model: "gpt-4o-mini",
    temperature: 0.65,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: `Life context:\n${context}\n\nDebrief responses:\n${JSON.stringify(responses, null, 2)}`,
      },
    ],
  });

  if (!aiResult.ok) {
    return mockNightAnalysis(responses);
  }

  const raw = aiResult.completion.choices[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(raw);
  } catch {
    return mockNightAnalysis(responses);
  }
}

export async function prioritizeTasks(userId: string): Promise<{
  recommendation: string;
  orderedTaskIds: string[];
  insights: string[];
}> {
  const tasks = await prisma.task.findMany({
    where: { userId, status: { in: ["PENDING", "IN_PROGRESS"] } },
    include: { mission: true },
  });

  const sorted = [...tasks].sort((a, b) => b.priority - a.priority);
  const offlineFallback = {
    recommendation:
      "Focus on highest-impact practical actions first. Reduce active missions if overloaded.",
    orderedTaskIds: sorted.map((t) => t.id),
    insights: [
      "You perform best with structured mornings.",
      "Avoid financial tasks when emotionally stressed.",
    ],
  };

  const aiResult = await createChatCompletion({
    model: "gpt-4o-mini",
    temperature: 0.5,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Return JSON: recommendation (string), orderedTaskIds (string[] matching input ids), insights (string[]). Prioritize by leverage, urgency, emotional cost, mission alignment.`,
      },
      { role: "user", content: JSON.stringify(tasks) },
    ],
  });

  if (!aiResult.ok) {
    return offlineFallback;
  }

  const raw = aiResult.completion.choices[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(raw);
  } catch {
    return {
      recommendation: "Execute one high-leverage task at a time.",
      orderedTaskIds: tasks.map((t) => t.id),
      insights: [],
    };
  }
}

function mockDailyBriefing(name: string) {
  return {
    topPriorities: [
      "Reduce uncertainty around housing and relocation logistics",
      "Complete one high-impact business task for Agentis",
      "Protect energy: structured morning, one workout block",
    ],
    emotionalObservation:
      "You tend toward rumination when multiple domains feel unstable. Ground in practical structure before major decisions.",
    focusRecommendation:
      "Practical execution over emotional processing today. 20-minute focused blocks.",
    reminders: [
      "Avoid emotionally driven decisions on relocation",
      "Financial organization deferred 3 days — address one item",
    ],
    missionProgress:
      "Relocation mission at 35%. Business build at 52%. Relationship repair needs intentional communication.",
    strategicGuidance:
      "Your biggest priority today is reducing uncertainty around the house. Avoid emotionally driven decisions. Focus on practical structure. One completed administrative task will lower cognitive load significantly.",
    fullContent: `Good morning, ${name}. Your biggest priority today is reducing uncertainty around the house. Avoid emotionally driven decisions. Focus on practical structure. Complete one relocation admin task and one Agentis execution block. Protect your nervous system with movement and boundaries on mental bandwidth drains.`,
  };
}

function mockNightAnalysis(_responses: Record<string, string>) {
  return {
    focusScore: 72,
    emotionalScore: 68,
    executionScore: 65,
    alignmentScore: 70,
    energyScore: 62,
    aiAssessment:
      "You handled emotional uncertainty better today and avoided panic-driven reactions. However, financial organization and relocation planning are still being postponed. Your emotional state improved significantly after structure and connection. Tomorrow should prioritize practical execution over emotional rumination.",
    behavioralNotes: [
      "Avoidance pattern on financial tasks when stressed",
      "Improved regulation after structured activity",
      "Relationship domain received adequate attention",
    ],
    tomorrowPlan: {
      topPriorities: [
        "One relocation admin task (30 min max)",
        "Agentis: single deliverable completion",
        "Morning structure before reactive mode",
      ],
      missionCritical: ["Housing uncertainty reduction", "Income stabilization check"],
      emotionalWarnings: [
        "Don't make relocation decisions from anxiety",
        "Limit rumination — set 15-min worry window only",
      ],
      focusRecommendation: "Practical blocks before 2pm. Protect deep work morning.",
      recoverySuggestions: ["Sleep by 11pm", "10-min evening walk", "No screens 30min before bed"],
      executionStrategy:
        "Three 25-minute execution blocks. One domain only per block. Close the day with tomorrow's top 3 written.",
    },
    patternDetected: "Postponement of financial/admin tasks under emotional load",
  };
}
