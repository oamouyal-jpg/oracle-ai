import { prisma } from "./prisma.js";
import type { AppLocale } from "./locale.js";
import { localeAiInstruction } from "./locale.js";

export type StrategicProfile = {
  patterns: string[];
  strengths: string[];
  triggers: string[];
  learnedTraits: string[];
};

const DEFAULT_PROFILE: StrategicProfile = {
  patterns: [],
  strengths: ["Strategic thinking", "High ambition"],
  triggers: ["Uncertainty", "Overcommitment"],
  learnedTraits: [],
};

export function parseStrategicProfile(raw: unknown): StrategicProfile {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PROFILE };
  const p = raw as Record<string, unknown>;
  return {
    patterns: Array.isArray(p.patterns) ? p.patterns.map(String) : [],
    strengths: Array.isArray(p.strengths) ? p.strengths.map(String) : DEFAULT_PROFILE.strengths,
    triggers: Array.isArray(p.triggers) ? p.triggers.map(String) : DEFAULT_PROFILE.triggers,
    learnedTraits: Array.isArray(p.learnedTraits) ? p.learnedTraits.map(String) : [],
  };
}

export async function getOperatorName(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  const name = user?.name?.trim();
  return name && name.length > 0 ? name : "Operator";
}

export async function rememberInsight(
  userId: string,
  content: string,
  category: "pattern" | "friction" | "strength" | "trigger" | "trait",
  importance = 75
): Promise<void> {
  const normalized = content.trim();
  if (normalized.length < 8) return;

  const existing = await prisma.aIMemory.findFirst({
    where: {
      userId,
      content: { equals: normalized, mode: "insensitive" },
    },
  });
  if (existing) return;

  await prisma.aIMemory.create({
    data: { userId, category, content: normalized, importance },
  });

  await consolidateStrategicProfile(userId);
}

export async function rememberInsights(
  userId: string,
  items: { content: string; category: "pattern" | "friction" | "strength" | "trigger" | "trait"; importance?: number }[]
): Promise<void> {
  for (const item of items) {
    await rememberInsight(userId, item.content, item.category, item.importance ?? 75);
  }
}

export async function consolidateStrategicProfile(userId: string): Promise<StrategicProfile> {
  const [user, memories] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.aIMemory.findMany({
      where: { userId },
      orderBy: [{ importance: "desc" }, { createdAt: "desc" }],
      take: 40,
    }),
  ]);

  const current = parseStrategicProfile(user?.strategicProfile);
  const byCategory = (cat: string) =>
    memories.filter((m) => m.category === cat).map((m) => m.content);

  const profile: StrategicProfile = {
    patterns: uniqueStrings([...byCategory("pattern"), ...current.patterns]).slice(0, 12),
    strengths: uniqueStrings([...byCategory("strength"), ...current.strengths]).slice(0, 8),
    triggers: uniqueStrings([...byCategory("trigger"), ...byCategory("friction"), ...current.triggers]).slice(0, 8),
    learnedTraits: uniqueStrings([...byCategory("trait"), ...current.learnedTraits]).slice(0, 10),
  };

  await prisma.user.update({
    where: { id: userId },
    data: { strategicProfile: profile },
  });

  return profile;
}

function uniqueStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item.trim());
  }
  return out;
}

export async function buildOperatorLearningContext(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const name = user?.name?.trim() || "Operator";
  const profile = parseStrategicProfile(user?.strategicProfile);
  const onboardingContext =
    user?.onboardingContext &&
    typeof user.onboardingContext === "object" &&
    "summary" in (user.onboardingContext as object)
      ? String((user.onboardingContext as { summary?: string }).summary ?? "")
      : "";

  const memories = await prisma.aIMemory.findMany({
    where: { userId },
    orderBy: [{ importance: "desc" }, { createdAt: "desc" }],
    take: 15,
  });

  const reflections = await prisma.reflection.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { content: true, mood: true, aiAnalysis: true, createdAt: true },
  });

  return {
    operatorName: name,
    onboardingSummary: onboardingContext,
    strategicProfile: profile,
    learnedMemories: memories.map((m) => ({
      category: m.category,
      content: m.content,
      importance: m.importance,
    })),
    recentReflections: reflections,
  };
}

const SYSTEM_PERSONA = `You are Oracle — an AI life strategist and personal operating system.
You are calm, intelligent, emotionally aware, and strategically sharp.
You help the user organize chaos, reduce overwhelm, maintain momentum, and execute on what matters.
You are NOT cheesy, corporate, or judgmental. You challenge avoidance gently but directly.
You prioritize highest-leverage actions based on impact, emotional state, urgency, and long-term alignment.
Speak concisely. Use strategic language. Be a wise coach, not a passive chatbot.`;

export function buildOracleSystemPrompt(
  operatorName: string,
  learningContext: Awaited<ReturnType<typeof buildOperatorLearningContext>>,
  locale: AppLocale,
  extra?: string
): string {
  const { strategicProfile, learnedMemories, onboardingSummary } = learningContext;
  const backgroundBlock = onboardingSummary?.trim()
    ? `Onboarding background: ${onboardingSummary.trim()}`
    : "";
  const memoryBlock =
    learnedMemories.length > 0
      ? learnedMemories.map((m) => `- [${m.category}] ${m.content}`).join("\n")
      : "No stored patterns yet — observe and personalize from today's data.";

  return `${SYSTEM_PERSONA}

${localeAiInstruction(locale)}

OPERATOR PROFILE:
- Name: ${operatorName}
- Address ${operatorName} by their first name when natural (not every sentence).
- You have been learning ${operatorName} over time. Use known patterns to make advice specific, not generic.
${backgroundBlock ? `- ${backgroundBlock}` : ""}

Known strengths: ${strategicProfile.strengths.join("; ") || "—"}
Known triggers: ${strategicProfile.triggers.join("; ") || "—"}
Detected patterns: ${strategicProfile.patterns.join("; ") || "—"}
Learned traits: ${strategicProfile.learnedTraits.join("; ") || "—"}

Memory log (most important first):
${memoryBlock}

When you detect a NEW recurring pattern in this session, acknowledge it and tie advice to ${operatorName}'s history.
${extra ?? ""}`;
}

export async function learnFromChatMessage(userId: string, message: string): Promise<void> {
  const lower = message.toLowerCase();
  const insights: {
    content: string;
    category: "pattern" | "friction" | "trigger";
    importance?: number;
  }[] = [];

  if (/\b(avoid|procrastinat|put off|delay)\b/.test(lower)) {
    insights.push({
      category: "pattern",
      content: `Tends to avoid or delay when discussing: "${message.slice(0, 80)}..."`,
      importance: 70,
    });
  }
  if (/\b(stress|overwhelm|anxious|anxiety)\b/.test(lower)) {
    insights.push({
      category: "trigger",
      content: "Stress and overwhelm mentioned in conversation",
      importance: 72,
    });
  }
  if (/\b(money|finance|financial|tax)\b/.test(lower)) {
    insights.push({
      category: "pattern",
      content: "Financial topics are on their mind — may need structured admin blocks",
      importance: 68,
    });
  }

  if (insights.length > 0) {
    await rememberInsights(userId, insights);
  }
}
