import type { AppLocale } from "./locale.js";

export type DebriefQuestions = {
  execution: string[];
  emotional: string[];
  relationships: string[];
  health: string[];
  awareness: string[];
};

/** One short question per area — ~5 minutes total. */
const en: DebriefQuestions = {
  execution: ["What actually moved forward today?"],
  emotional: ["How did you feel — and what drained you?"],
  relationships: ["Any connection or tension worth noting?"],
  health: ["Sleep, body, energy — honest check-in?"],
  awareness: ["What are you avoiding or proud of today?"],
};

const he: DebriefQuestions = {
  execution: ["מה באמת התקדם היום?"],
  emotional: ["איך הרגשת — ומה ריקן אותך?"],
  relationships: ["קשר או מתח ששווה לציין?"],
  health: ["שינה, גוף, אנרגיה — בדיקה כנה?"],
  awareness: ["ממה אתה נמנע, או על מה אתה גאה היום?"],
};

const fr: DebriefQuestions = {
  execution: ["Qu'est-ce qui a vraiment avancé aujourd'hui ?"],
  emotional: ["Comment vous sentiez-vous — et qu'est-ce qui vous a vidé ?"],
  relationships: ["Un lien ou une tension à noter ?"],
  health: ["Sommeil, corps, énergie — bilan honnête ?"],
  awareness: ["Qu'évitez-vous ou de quoi êtes-vous fier aujourd'hui ?"],
};

const byLocale: Record<AppLocale, DebriefQuestions> = { en, he, fr };

export function getDebriefQuestions(locale: AppLocale): DebriefQuestions {
  return byLocale[locale] ?? en;
}

export const DEBRIEF_SECTION_KEYS = [
  "execution",
  "emotional",
  "relationships",
  "health",
  "awareness",
] as const satisfies readonly (keyof DebriefQuestions)[];

export function flattenDebriefQuestions(questions: DebriefQuestions) {
  return DEBRIEF_SECTION_KEYS.flatMap((sectionKey) =>
    questions[sectionKey].map((question, questionIndex) => ({
      sectionKey,
      questionIndex,
      question,
      responseKey: `${sectionKey}_${questionIndex}`,
    }))
  );
}

export const DEBRIEF_SECTION_LABELS: Record<
  AppLocale,
  Record<keyof DebriefQuestions, string>
> = {
  en: {
    execution: "Execution",
    emotional: "Emotional State",
    relationships: "Relationships",
    health: "Health & Energy",
    awareness: "Self-Awareness",
  },
  he: {
    execution: "ביצוע",
    emotional: "מצב רגשי",
    relationships: "מערכות יחסים",
    health: "בריאות ואנרגיה",
    awareness: "מודעות עצמית",
  },
  fr: {
    execution: "Exécution",
    emotional: "État émotionnel",
    relationships: "Relations",
    health: "Santé et énergie",
    awareness: "Conscience de soi",
  },
};
