import type { AppLocale } from "./locale.js";

const en = [
  "Did you follow your rules today?",
  "Did you trade from calm or emotion?",
  "What setup did you take?",
  "Did you overtrade?",
  "Did you respect your stop?",
  "What did you learn?",
  "What needs improvement tomorrow?",
];

const he = [
  "האם עמדת בכללים היום?",
  "האם מסחרת מרוגע או מרגש?",
  "איזה סטאפ לקחת?",
  "האם מסחרת יותר מדי?",
  "האם כיבדת את הסטופ?",
  "מה למדת?",
  "מה צריך שיפור מחר?",
];

const fr = [
  "Avez-vous respecté vos règles aujourd'hui ?",
  "Avez-vous tradé avec calme ou émotion ?",
  "Quel setup avez-vous pris ?",
  "Avez-vous sur-tradé ?",
  "Avez-vous respecté votre stop ?",
  "Qu'avez-vous appris ?",
  "Qu'est-ce à améliorer demain ?",
];

export function getTradingQuestions(locale: AppLocale): string[] {
  if (locale === "he") return he;
  if (locale === "fr") return fr;
  return en;
}
