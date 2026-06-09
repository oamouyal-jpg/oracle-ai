import { prisma } from "../lib/prisma.js";
import { createChatCompletion } from "../lib/openai.js";
import type { AppLocale } from "../lib/locale.js";
import { localeAiInstruction } from "../lib/locale.js";
import { rememberInsights } from "../lib/operatorLearning.js";
import { parseStrategicProfile } from "../lib/operatorLearning.js";

export type OnboardingQuestion = {
  id: string;
  question: string;
  placeholder: string;
};

const OFFLINE_QUESTIONS: Record<AppLocale, OnboardingQuestion[]> = {
  en: [
    {
      id: "priorities",
      question: "What are the 2–3 biggest priorities in your life right now?",
      placeholder: "e.g. career transition, health, family, relocation…",
    },
    {
      id: "challenges",
      question: "What challenges or friction do you face most often?",
      placeholder: "e.g. procrastination, overwhelm, financial stress…",
    },
    {
      id: "strengths",
      question: "What are your core strengths when you are at your best?",
      placeholder: "e.g. strategic thinking, discipline, creativity…",
    },
    {
      id: "triggers",
      question: "What situations tend to knock you off track emotionally?",
      placeholder: "e.g. uncertainty, conflict, too many open loops…",
    },
    {
      id: "vision",
      question: "What does a well-run life look like for you in 12 months?",
      placeholder: "Describe outcomes across work, health, relationships…",
    },
  ],
  he: [
    {
      id: "priorities",
      question: "מהן 2–3 העדיפויות הגדולות בחיים שלך כרגע?",
      placeholder: "למשל מעבר קריירה, בריאות, משפחה, מעבר דירה…",
    },
    {
      id: "challenges",
      question: "אילו אתגרים או חיכוכים אתה נתקל בהם הכי הרבה?",
      placeholder: "למשל דחיינות, עומס, לחץ כספי…",
    },
    {
      id: "strengths",
      question: "מהן החוזקות המרכזיות שלך כשאתה במיטבך?",
      placeholder: "למשל חשיבה אסטרטגית, משמעת, יצירתיות…",
    },
    {
      id: "triggers",
      question: "אילו מצבים נוטים להוציא אותך ממסלול רגשית?",
      placeholder: "למשל אי-ודאות, קונפליקט, יותר מדי פתוחים…",
    },
    {
      id: "vision",
      question: "איך נראים חיים מנוהלים היטב עבורך בעוד 12 חודשים?",
      placeholder: "תאר תוצאות בעבודה, בריאות, מערכות יחסים…",
    },
  ],
  fr: [
    {
      id: "priorities",
      question: "Quelles sont vos 2–3 priorités majeures en ce moment ?",
      placeholder: "ex. transition de carrière, santé, famille, déménagement…",
    },
    {
      id: "challenges",
      question: "Quels défis ou frictions rencontrez-vous le plus souvent ?",
      placeholder: "ex. procrastination, surcharge, stress financier…",
    },
    {
      id: "strengths",
      question: "Quelles sont vos forces quand vous êtes au meilleur de vous-même ?",
      placeholder: "ex. pensée stratégique, discipline, créativité…",
    },
    {
      id: "triggers",
      question: "Quelles situations vous déstabilisent émotionnellement ?",
      placeholder: "ex. incertitude, conflit, trop de dossiers ouverts…",
    },
    {
      id: "vision",
      question: "À quoi ressemble une vie bien pilotée pour vous dans 12 mois ?",
      placeholder: "Décrivez travail, santé, relations…",
    },
  ],
};

export async function generateOnboardingQuestions(
  operatorName: string,
  locale: AppLocale
): Promise<OnboardingQuestion[]> {
  const aiResult = await createChatCompletion({
    model: "gpt-4o-mini",
    temperature: 0.6,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are Oracle, a life operating system onboarding assistant.
${localeAiInstruction(locale)}
Generate exactly 5 onboarding questions to understand ${operatorName}'s life context.
Return JSON: { "questions": [{ "id": "short_snake_case", "question": "...", "placeholder": "hint for answer" }] }
Cover: current priorities, main challenges, strengths, emotional triggers, 12-month vision.
Keep questions warm, direct, and specific to building personalized life guidance.`,
      },
      {
        role: "user",
        content: `Operator name: ${operatorName}. Generate onboarding questions.`,
      },
    ],
  });

  if (!aiResult.ok) {
    return OFFLINE_QUESTIONS[locale] ?? OFFLINE_QUESTIONS.en;
  }

  try {
    const raw = JSON.parse(aiResult.completion.choices[0]?.message?.content ?? "{}") as {
      questions?: OnboardingQuestion[];
    };
    const questions = (raw.questions ?? [])
      .filter((q) => q.id && q.question?.trim())
      .slice(0, 5)
      .map((q) => ({
        id: String(q.id).trim(),
        question: String(q.question).trim(),
        placeholder: String(q.placeholder ?? "").trim() || "…",
      }));
    if (questions.length >= 4) return questions;
  } catch {
    /* offline fallback */
  }

  return OFFLINE_QUESTIONS[locale] ?? OFFLINE_QUESTIONS.en;
}

export async function completeOnboarding(
  userId: string,
  operatorName: string,
  answers: Record<string, string>,
  locale: AppLocale
): Promise<void> {
  const entries = Object.entries(answers)
    .map(([k, v]) => [k, v.trim()] as const)
    .filter(([, v]) => v.length >= 2);

  const aiResult = await createChatCompletion({
    model: "gpt-4o-mini",
    temperature: 0.5,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Analyze onboarding answers for ${operatorName}. ${localeAiInstruction(locale)}
Return JSON: {
  "summary": "2-3 sentence operator background for Oracle to reference",
  "strengths": ["string"],
  "triggers": ["string"],
  "patterns": ["string"],
  "insights": [{ "content": "string", "category": "strength|trigger|pattern|trait|friction" }]
}`,
      },
      {
        role: "user",
        content: JSON.stringify({ operatorName, answers: Object.fromEntries(entries) }, null, 2),
      },
    ],
  });

  let summary = `${operatorName} is setting up Oracle as their life operating system.`;
  let strengths: string[] = [];
  let triggers: string[] = [];
  let patterns: string[] = [];
  let insights: { content: string; category: "strength" | "trigger" | "pattern" | "trait" | "friction" }[] =
    [];

  if (aiResult.ok) {
    try {
      const raw = JSON.parse(aiResult.completion.choices[0]?.message?.content ?? "{}") as {
        summary?: string;
        strengths?: string[];
        triggers?: string[];
        patterns?: string[];
        insights?: { content: string; category: string }[];
      };
      if (raw.summary?.trim()) summary = raw.summary.trim();
      strengths = (raw.strengths ?? []).map(String).filter(Boolean);
      triggers = (raw.triggers ?? []).map(String).filter(Boolean);
      patterns = (raw.patterns ?? []).map(String).filter(Boolean);
      insights = (raw.insights ?? [])
        .filter((i) => i.content?.trim())
        .map((i) => ({
          content: i.content.trim(),
          category: (["strength", "trigger", "pattern", "trait", "friction"].includes(i.category)
            ? i.category
            : "trait") as "strength" | "trigger" | "pattern" | "trait" | "friction",
        }));
    } catch {
      /* use offline extraction below */
    }
  }

  if (strengths.length === 0 && answers.strengths) {
    strengths = answers.strengths
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (triggers.length === 0 && answers.triggers) {
    triggers = answers.triggers
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const profile = {
    patterns,
    strengths: strengths.length > 0 ? strengths : ["Self-awareness", "Commitment to growth"],
    triggers: triggers.length > 0 ? triggers : ["Uncertainty"],
    learnedTraits: [],
  };

  await prisma.user.update({
    where: { id: userId },
    data: {
      onboardingComplete: true,
      onboardingContext: { summary, answers: Object.fromEntries(entries), completedAt: new Date().toISOString() },
      strategicProfile: profile,
    },
  });

  if (insights.length > 0) {
    await rememberInsights(userId, insights);
  } else {
    for (const [, answer] of entries) {
      if (answer.length >= 12) {
        await rememberInsights(userId, [{ content: answer.slice(0, 280), category: "trait" }]);
      }
    }
  }

  // Refresh consolidated profile from memories
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user) parseStrategicProfile(user.strategicProfile);
}
