import type { InnerDriver, InnerPatternCategory, InnerSession } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { createChatCompletion } from "../lib/openai.js";
import { asStringArray } from "../lib/arrays.js";
import type { AppLocale } from "../lib/locale.js";
import { localeAiInstruction } from "../lib/locale.js";

// Inner Operating System — a self-awareness mirror.
// It offers reflection, coaching, and motivation. It is NOT therapy, NOT
// diagnosis, NOT treatment. All observations are framed as possibilities.

const INNER_SYSTEM = `You are Oracle's Inner Operating System — a calm, intelligent mirror that helps people see what is driving their decisions.

Your purpose: increase self-awareness, emotional freedom, personal responsibility, and resilience. Help the user move from unconscious reaction to conscious choice.

Hard safety rules:
- You are NOT a therapist or psychologist. You do NOT diagnose mental health conditions or claim certainty.
- Frame everything as a possibility, tendency, or pattern — never a fact or label. Use phrasing like "this may indicate…", "this resembles…", "this appears similar to…".
- Never shame the user. Be warm, direct, human, and reflective — not clinical.
- If the input suggests crisis, self-harm, harming others, or severe distress, gently and warmly suggest reaching a mental-health professional or local emergency support, and set professionalSupportSuggested true.

What you do each check-in:
1. Identify the likely emotional driver behind the words (fear, anxiety, shame, loneliness, approval-seeking, addiction, avoidance, anger, jealousy, control, dependency, impulsivity, old conditioning — or calm/centered).
2. Name a possible behavioural pattern category and a short pattern name.
3. Offer a tentative possible root cause.
4. Separate feelings (subjective) from facts (objective).
5. Ask 3–5 deeper reflection questions.
6. Compare the current operating state with a healthier one.
7. Suggest ONE small, achievable freedom action.
8. Write a short reflective mirror response (2–4 sentences).

Respond ONLY with valid JSON. No markdown fences.`;

const DRIVERS: InnerDriver[] = [
  "CALM_CENTERED",
  "FEAR",
  "ANXIETY",
  "SHAME",
  "LONELINESS",
  "APPROVAL",
  "ADDICTION",
  "AVOIDANCE",
  "ANGER",
  "JEALOUSY",
  "CONTROL",
  "DEPENDENCY",
  "IMPULSIVITY",
  "CONDITIONING",
];

const CATEGORIES: InnerPatternCategory[] = [
  "GROUNDED",
  "FEAR_BASED",
  "AVOIDANCE",
  "RELATIONSHIP",
  "ADDICTION",
  "SELF_SABOTAGE",
  "CONTROL",
];

const DRIVER_LABELS: Record<InnerDriver, string> = {
  CALM_CENTERED: "Calm & centered",
  FEAR: "Fear",
  ANXIETY: "Anxiety",
  SHAME: "Shame",
  LONELINESS: "Loneliness",
  APPROVAL: "Need for approval",
  ADDICTION: "Addiction / craving",
  AVOIDANCE: "Avoidance",
  ANGER: "Anger",
  JEALOUSY: "Jealousy",
  CONTROL: "Need for control",
  DEPENDENCY: "Emotional dependency",
  IMPULSIVITY: "Impulsivity",
  CONDITIONING: "Old conditioning",
};

const CATEGORY_LABELS: Record<InnerPatternCategory, string> = {
  GROUNDED: "Grounded",
  FEAR_BASED: "Fear-based pattern",
  AVOIDANCE: "Avoidance pattern",
  RELATIONSHIP: "Relationship pattern",
  ADDICTION: "Addiction pattern",
  SELF_SABOTAGE: "Self-sabotage pattern",
  CONTROL: "Control pattern",
};

export function driverLabel(d: InnerDriver): string {
  return DRIVER_LABELS[d] ?? d;
}

export function categoryLabel(c: InnerPatternCategory): string {
  return CATEGORY_LABELS[c] ?? c;
}

const CRISIS_PATTERNS =
  /\b(suicide|suicidal|kill myself|end my life|want to die|hurt myself|harm myself|self[-\s]?harm|cutting myself|no reason to live|better off dead)\b/i;

type InnerAnalysisPayload = {
  primaryDriver: InnerDriver;
  secondaryDriver?: InnerDriver | null;
  patternCategory: InnerPatternCategory;
  patternName?: string | null;
  possibleRootCause?: string | null;
  triggers: string[];
  feelings: string[];
  facts: string[];
  reflectionQuestions: string[];
  currentStateTraits: string[];
  healthyStateTraits: string[];
  comparisonSummary: string;
  freedomAction: string;
  oracleReflection: string;
  professionalSupportSuggested: boolean;
  intensity: number;
  scores: {
    emotionalRegulation: number;
    selfAwareness: number;
    healthyDecision: number;
    freedom: number;
  };
};

function parseJson<T>(text: string): T | null {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

function clamp(n: unknown, fallback: number, min = 0, max = 100): number {
  const v = typeof n === "number" && !Number.isNaN(n) ? n : fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
}

function coerceDriver(raw: unknown, fallback: InnerDriver): InnerDriver {
  const u = String(raw ?? "").toUpperCase();
  return (DRIVERS.includes(u as InnerDriver) ? u : fallback) as InnerDriver;
}

function coerceCategory(raw: unknown, fallback: InnerPatternCategory): InnerPatternCategory {
  const u = String(raw ?? "").toUpperCase();
  return (CATEGORIES.includes(u as InnerPatternCategory) ? u : fallback) as InnerPatternCategory;
}

function strArray(raw: unknown, max = 8): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .slice(0, max);
}

// ─── Offline heuristic fallback ───

function offlineAnalysis(rawInput: string): InnerAnalysisPayload {
  const text = rawInput.toLowerCase();
  const has = (re: RegExp) => re.test(text);

  let primaryDriver: InnerDriver = "ANXIETY";
  let patternCategory: InnerPatternCategory = "FEAR_BASED";
  let patternName = "fear-based response";

  if (has(/\b(later|tomorrow|avoid|don'?t want to|procrastinat|put off|can'?t face|distract)\b/)) {
    primaryDriver = "AVOIDANCE";
    patternCategory = "AVOIDANCE";
    patternName = "avoidance pattern";
  } else if (has(/\b(reassur|does (he|she|they) (still )?love|are we ok|jealous|cheat|ignoring me|left on read|abandon)\b/)) {
    primaryDriver = "DEPENDENCY";
    patternCategory = "RELATIONSHIP";
    patternName = "reassurance-seeking pattern";
  } else if (has(/\b(drink|drunk|high|porn|gambl|bet|shopping|scroll|one more|binge|craving)\b/)) {
    primaryDriver = "ADDICTION";
    patternCategory = "ADDICTION";
    patternName = "dopamine-seeking pattern";
  } else if (has(/\b(give up|quit|pointless|never works|i always|i'?m a failure|hate myself|not good enough|perfect)\b/)) {
    primaryDriver = "SHAME";
    patternCategory = "SELF_SABOTAGE";
    patternName = "self-sabotage pattern";
  } else if (has(/\b(must|have to control|need to know|certain|can'?t stand not|micromanage|what if)\b/)) {
    primaryDriver = "CONTROL";
    patternCategory = "CONTROL";
    patternName = "need-for-certainty pattern";
  } else if (has(/\b(angry|furious|rage|how dare|unfair|resent|hate (him|her|them))\b/)) {
    primaryDriver = "ANGER";
    patternCategory = "FEAR_BASED";
    patternName = "anger-defensive response";
  } else if (has(/\b(alone|lonely|nobody|no one cares|isolated)\b/)) {
    primaryDriver = "LONELINESS";
    patternCategory = "RELATIONSHIP";
    patternName = "loneliness response";
  } else if (has(/\b(calm|grateful|clear|ready|at peace|content|hopeful)\b/)) {
    primaryDriver = "CALM_CENTERED";
    patternCategory = "GROUNDED";
    patternName = "grounded state";
  }

  const grounded = patternCategory === "GROUNDED";
  const intensity = grounded ? 3 : has(/\b(panic|can'?t breathe|desperate|terrified|now|immediately|urgent)\b/) ? 9 : 6;

  return {
    primaryDriver,
    secondaryDriver: null,
    patternCategory,
    patternName,
    possibleRootCause: grounded
      ? null
      : "This may connect to an old need to feel safe, accepted, or in control. Hold it lightly — it's a possibility, not a verdict.",
    triggers: [],
    feelings: grounded ? ["clarity", "steadiness"] : ["urgency", "discomfort"],
    facts: [],
    reflectionQuestions: grounded
      ? [
          "What helped you arrive at this clearer state?",
          "What would you like to protect about it?",
        ]
      : [
          "What are you afraid would happen if you did nothing right now?",
          "What feeling are you trying not to experience?",
          "What story are you telling yourself — and is there real evidence for it?",
          "When have you felt this before?",
        ],
    currentStateTraits: grounded ? ["calm", "acceptance"] : ["urgency", "fear of uncertainty"],
    healthyStateTraits: ["patience", "acceptance", "deliberate action"],
    comparisonSummary: grounded
      ? "You appear to be operating from a steady, conscious place. Keep choosing from here."
      : "Your current reaction appears driven by urgency and fear of uncertainty. A healthier response may involve accepting what you can't control and focusing on the next small action that's truly yours.",
    freedomAction: grounded
      ? "Note one decision you can make today from this calm state."
      : "Before acting, pause for one hour. Take a short walk or write the thought down without sending or doing anything.",
    oracleReflection: grounded
      ? "This reads as a grounded moment. Notice what it feels like to choose from here — that awareness is the work."
      : "This may be a moment where emotion is steering more than you'd like. Nothing here is a verdict about you — just a pattern worth seeing. The pause is where your freedom lives.",
    professionalSupportSuggested: false,
    intensity,
    scores: {
      emotionalRegulation: grounded ? 72 : 45,
      selfAwareness: 60,
      healthyDecision: grounded ? 70 : 48,
      freedom: grounded ? 70 : 50,
    },
  };
}

function buildHistoryBlock(recent: InnerSession[]): string {
  if (recent.length === 0) return "";
  const lines = recent.slice(0, 8).map((s) => {
    const when = s.createdAt.toISOString().slice(0, 10);
    return `- ${when}: driver=${s.primaryDriver}, pattern=${s.patternName ?? s.patternCategory}, triggers=${asStringArray(s.triggers).join("; ") || "—"}`;
  });
  return `\n\nRecurring themes from recent sessions (use to spot patterns the user can't easily see; reference gently):\n${lines.join("\n")}`;
}

function buildValuesBlock(values: { valueName: string; description: string | null }[]): string {
  if (values.length === 0) return "";
  const lines = values.map((v) => `- ${v.valueName}${v.description ? `: ${v.description}` : ""}`);
  return `\n\nThe user's chosen "healthy self" values (reference when comparing to a healthier state, and you may ask "which version of you is making this decision?"):\n${lines.join("\n")}`;
}

async function callInnerJson(
  userPrompt: string,
  locale: AppLocale
): Promise<{ data: InnerAnalysisPayload | null; source: "openai" | "offline" }> {
  const result = await createChatCompletion({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0.5,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: `${INNER_SYSTEM}\n${localeAiInstruction(locale)}` },
      { role: "user", content: userPrompt },
    ],
  });
  if (!result.ok) return { data: null, source: "offline" };
  const text = result.completion.choices[0]?.message?.content ?? "";
  return { data: parseJson<InnerAnalysisPayload>(text), source: "openai" };
}

function normalize(
  ai: InnerAnalysisPayload | null,
  fallback: InnerAnalysisPayload
): InnerAnalysisPayload {
  if (!ai) return fallback;
  return {
    primaryDriver: coerceDriver(ai.primaryDriver, fallback.primaryDriver),
    secondaryDriver: ai.secondaryDriver
      ? coerceDriver(ai.secondaryDriver, "CALM_CENTERED")
      : null,
    patternCategory: coerceCategory(ai.patternCategory, fallback.patternCategory),
    patternName: ai.patternName?.toString().trim() || fallback.patternName,
    possibleRootCause: ai.possibleRootCause?.toString().trim() || fallback.possibleRootCause,
    triggers: strArray(ai.triggers),
    feelings: strArray(ai.feelings),
    facts: strArray(ai.facts),
    reflectionQuestions: strArray(ai.reflectionQuestions, 5).length
      ? strArray(ai.reflectionQuestions, 5)
      : fallback.reflectionQuestions,
    currentStateTraits: strArray(ai.currentStateTraits, 6).length
      ? strArray(ai.currentStateTraits, 6)
      : fallback.currentStateTraits,
    healthyStateTraits: strArray(ai.healthyStateTraits, 6).length
      ? strArray(ai.healthyStateTraits, 6)
      : fallback.healthyStateTraits,
    comparisonSummary: ai.comparisonSummary?.toString().trim() || fallback.comparisonSummary,
    freedomAction: ai.freedomAction?.toString().trim() || fallback.freedomAction,
    oracleReflection: ai.oracleReflection?.toString().trim() || fallback.oracleReflection,
    professionalSupportSuggested: Boolean(ai.professionalSupportSuggested),
    intensity: clamp(ai.intensity, fallback.intensity, 1, 10),
    scores: {
      emotionalRegulation: clamp(ai.scores?.emotionalRegulation, fallback.scores.emotionalRegulation),
      selfAwareness: clamp(ai.scores?.selfAwareness, fallback.scores.selfAwareness),
      healthyDecision: clamp(ai.scores?.healthyDecision, fallback.scores.healthyDecision),
      freedom: clamp(ai.scores?.freedom, fallback.scores.freedom),
    },
  };
}

export type InnerSessionResult = {
  session: ReturnType<typeof formatInnerSession>;
  source: "openai" | "offline";
};

export function formatInnerSession(s: InnerSession) {
  return {
    id: s.id,
    rawInput: s.rawInput,
    primaryDriver: s.primaryDriver,
    primaryDriverLabel: driverLabel(s.primaryDriver),
    secondaryDriver: s.secondaryDriver,
    secondaryDriverLabel: s.secondaryDriver ? driverLabel(s.secondaryDriver) : null,
    patternCategory: s.patternCategory,
    patternCategoryLabel: categoryLabel(s.patternCategory),
    patternName: s.patternName,
    possibleRootCause: s.possibleRootCause,
    triggers: asStringArray(s.triggers),
    feelings: asStringArray(s.feelings),
    facts: asStringArray(s.facts),
    reflectionQuestions: asStringArray(s.reflectionQuestions),
    reflectionAnswers: asStringArray(s.reflectionAnswers),
    reflectionInsight: s.reflectionInsight,
    currentStateTraits: asStringArray(s.currentStateTraits),
    healthyStateTraits: asStringArray(s.healthyStateTraits),
    comparisonSummary: s.comparisonSummary,
    freedomAction: s.freedomAction,
    freedomActionDone: s.freedomActionDone,
    oracleReflection: s.oracleReflection,
    professionalSupportSuggested: s.professionalSupportSuggested,
    intensity: s.intensity,
    scores: {
      emotionalRegulation: s.emotionalRegulationScore,
      selfAwareness: s.selfAwarenessScore,
      healthyDecision: s.healthyDecisionScore,
      freedom: s.freedomScore,
    },
    createdAt: s.createdAt.toISOString(),
  };
}

export async function runInnerCheckIn(
  userId: string,
  rawInput: string,
  locale: AppLocale
): Promise<InnerSessionResult> {
  const [recent, values] = await Promise.all([
    prisma.innerSession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.stableValue.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 12,
    }),
  ]);

  const prompt = `A person checked in with the Inner Operating System. Read their words and return JSON with keys:
{
  "primaryDriver": "${DRIVERS.join("|")}",
  "secondaryDriver": "same set or null",
  "patternCategory": "${CATEGORIES.join("|")}",
  "patternName": "short phrase, e.g. 'reassurance-seeking pattern'",
  "possibleRootCause": "tentative, framed as a possibility",
  "triggers": ["..."],
  "feelings": ["subjective feelings"],
  "facts": ["objective, verifiable facts only"],
  "reflectionQuestions": ["3-5 deep questions"],
  "currentStateTraits": ["e.g. fear, urgency, need for certainty"],
  "healthyStateTraits": ["e.g. patience, acceptance, deliberate action"],
  "comparisonSummary": "compare current vs healthier operating state",
  "freedomAction": "ONE small achievable action",
  "oracleReflection": "warm reflective mirror, 2-4 sentences, possibilities not facts",
  "professionalSupportSuggested": boolean,
  "intensity": 1-10,
  "scores": { "emotionalRegulation": 0-100, "selfAwareness": 0-100, "healthyDecision": 0-100, "freedom": 0-100 }
}
${localeHintLine(locale)}${buildValuesBlock(values)}${buildHistoryBlock(recent)}

Their words:
${rawInput}`;

  const fallback = offlineAnalysis(rawInput);
  const { data, source } = await callInnerJson(prompt, locale);
  const analysis = normalize(data, fallback);

  // Safety override: crisis language always surfaces professional support.
  if (CRISIS_PATTERNS.test(rawInput)) {
    analysis.professionalSupportSuggested = true;
  }

  const created = await prisma.innerSession.create({
    data: {
      userId,
      rawInput: rawInput.trim(),
      primaryDriver: analysis.primaryDriver,
      secondaryDriver: analysis.secondaryDriver ?? null,
      patternCategory: analysis.patternCategory,
      patternName: analysis.patternName ?? null,
      possibleRootCause: analysis.possibleRootCause ?? null,
      triggers: analysis.triggers,
      feelings: analysis.feelings,
      facts: analysis.facts,
      reflectionQuestions: analysis.reflectionQuestions,
      reflectionAnswers: [],
      currentStateTraits: analysis.currentStateTraits,
      healthyStateTraits: analysis.healthyStateTraits,
      comparisonSummary: analysis.comparisonSummary,
      freedomAction: analysis.freedomAction,
      oracleReflection: analysis.oracleReflection,
      professionalSupportSuggested: analysis.professionalSupportSuggested,
      intensity: analysis.intensity,
      emotionalRegulationScore: analysis.scores.emotionalRegulation,
      selfAwarenessScore: analysis.scores.selfAwareness,
      healthyDecisionScore: analysis.scores.healthyDecision,
      freedomScore: analysis.scores.freedom,
    },
  });

  return { session: formatInnerSession(created), source };
}

function localeHintLine(locale: AppLocale): string {
  return localeAiInstruction(locale);
}

export async function submitInnerReflection(
  userId: string,
  sessionId: string,
  answers: string[],
  locale: AppLocale
): Promise<InnerSessionResult> {
  const session = await prisma.innerSession.findFirst({
    where: { id: sessionId, userId },
  });
  if (!session) throw new Error("Session not found");

  const cleaned = answers.map((a) => String(a ?? "").trim()).filter(Boolean);
  const questions = asStringArray(session.reflectionQuestions);

  let insight = "";
  let source: "openai" | "offline" = "offline";

  if (cleaned.length > 0) {
    const qa = questions
      .map((q, i) => `Q: ${q}\nA: ${cleaned[i] ?? "(skipped)"}`)
      .join("\n\n");
    const prompt = `The person answered reflection questions about a possible "${session.patternName ?? session.patternCategory}". Read their answers and return JSON:
{ "insight": "2-3 sentence reflective synthesis — warm, non-clinical, framed as a possibility; point gently to what their healthiest self might choose" }
${localeHintLine(locale)}

${qa}`;
    const result = await createChatCompletion({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0.55,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${INNER_SYSTEM}\n${localeAiInstruction(locale)}` },
        { role: "user", content: prompt },
      ],
    });
    if (result.ok) {
      const parsed = parseJson<{ insight?: string }>(
        result.completion.choices[0]?.message?.content ?? ""
      );
      insight = parsed?.insight?.toString().trim() ?? "";
      source = "openai";
    }
    if (!insight) {
      insight =
        "Naming this honestly is already a shift from reaction toward awareness. Notice which version of you wants to choose next — and let that one lead.";
    }
  }

  const updated = await prisma.innerSession.update({
    where: { id: session.id },
    data: {
      reflectionAnswers: cleaned,
      reflectionInsight: insight || session.reflectionInsight,
      // answering deepens self-awareness — nudge the indicator upward.
      selfAwarenessScore: Math.min(100, session.selfAwarenessScore + (cleaned.length > 0 ? 6 : 0)),
    },
  });

  return { session: formatInnerSession(updated), source };
}

export async function setFreedomActionDone(
  userId: string,
  sessionId: string,
  done: boolean
): Promise<InnerSessionResult> {
  const session = await prisma.innerSession.findFirst({
    where: { id: sessionId, userId },
  });
  if (!session) throw new Error("Session not found");

  const updated = await prisma.innerSession.update({
    where: { id: session.id },
    data: {
      freedomActionDone: done,
      freedomScore: done
        ? Math.min(100, session.freedomScore + 8)
        : session.freedomScore,
    },
  });
  return { session: formatInnerSession(updated), source: "offline" };
}

export async function listInnerSessions(userId: string, limit = 20) {
  const sessions = await prisma.innerSession.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 60),
  });
  return sessions.map(formatInnerSession);
}

// ─── Growth dashboard ───

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getInnerGrowth(userId: string) {
  const since = new Date(Date.now() - 60 * DAY_MS);
  const sessions = await prisma.innerSession.findMany({
    where: { userId, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
  });

  const totalSessions = sessions.length;

  const driverCounts = new Map<InnerDriver, number>();
  const categoryCounts = new Map<InnerPatternCategory, number>();
  const patternNameCounts = new Map<string, number>();
  const triggerCounts = new Map<string, number>();

  for (const s of sessions) {
    driverCounts.set(s.primaryDriver, (driverCounts.get(s.primaryDriver) ?? 0) + 1);
    categoryCounts.set(s.patternCategory, (categoryCounts.get(s.patternCategory) ?? 0) + 1);
    if (s.patternName) {
      const key = s.patternName.toLowerCase();
      patternNameCounts.set(key, (patternNameCounts.get(key) ?? 0) + 1);
    }
    for (const tRaw of asStringArray(s.triggers)) {
      const tkey = tRaw.toLowerCase();
      triggerCounts.set(tkey, (triggerCounts.get(tkey) ?? 0) + 1);
    }
  }

  const topDrivers = [...driverCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([driver, count]) => ({ driver, label: driverLabel(driver), count }));

  const repeatingPatterns = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([category, count]) => ({ category, label: categoryLabel(category), count }));

  const topTrigger = [...triggerCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

  // Score trend: average of first half vs second half of the window.
  const avg = (arr: number[]) =>
    arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

  const scoreFields = {
    emotionalRegulation: sessions.map((s) => s.emotionalRegulationScore),
    selfAwareness: sessions.map((s) => s.selfAwarenessScore),
    healthyDecision: sessions.map((s) => s.healthyDecisionScore),
    freedom: sessions.map((s) => s.freedomScore),
  };

  const scores = Object.fromEntries(
    Object.entries(scoreFields).map(([k, arr]) => {
      const mid = Math.floor(arr.length / 2);
      const firstHalf = arr.slice(0, mid);
      const secondHalf = arr.slice(mid);
      const current = avg(arr.length === 1 ? arr : secondHalf);
      const trend = arr.length >= 4 ? current - avg(firstHalf) : 0;
      return [k, { value: current, trend }];
    })
  ) as Record<
    "emotionalRegulation" | "selfAwareness" | "healthyDecision" | "freedom",
    { value: number; trend: number }
  >;

  // Human-readable trends ("reveal what the user can't easily see").
  const trends: string[] = [];
  if (topTrigger) {
    trends.push(
      `Over the last 60 days, "${topTrigger[0]}" has been your most common trigger (${topTrigger[1]} session${topTrigger[1] > 1 ? "s" : ""}).`
    );
  }
  const topPattern = [...patternNameCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topPattern && topPattern[1] >= 2) {
    trends.push(`"${topPattern[0]}" has appeared in ${topPattern[1]} sessions.`);
  }
  if (scores.healthyDecision.trend > 4) {
    trends.push("Your healthy-decision indicator is trending upward — conscious choice is growing.");
  } else if (scores.healthyDecision.trend < -4) {
    trends.push("Your healthy-decision indicator has dipped recently — worth gentle attention.");
  }
  const consistency = clamp(Math.min(100, totalSessions * 8), 0);

  return {
    totalSessions,
    topDrivers,
    repeatingPatterns,
    scores,
    consistencyScore: consistency,
    trends,
  };
}
