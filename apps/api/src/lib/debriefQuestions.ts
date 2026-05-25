import type { AppLocale } from "./locale.js";

export type DebriefQuestions = {
  execution: string[];
  emotional: string[];
  relationships: string[];
  health: string[];
  awareness: string[];
};

const en: DebriefQuestions = {
  execution: [
    "What did you accomplish today?",
    "What important tasks were avoided?",
    "What moved your life forward?",
  ],
  emotional: [
    "How was your emotional state today?",
    "What triggered stress or anxiety?",
    "Did you react emotionally or stay grounded?",
    "What consumed mental energy?",
  ],
  relationships: [
    "Did you communicate well today?",
    "Did you create connection or tension?",
    "Were there unhealthy patterns?",
  ],
  health: [
    "How was your sleep quality?",
    "Did you exercise?",
    "How was nutrition and focus?",
    "How is your nervous system state?",
  ],
  awareness: [
    "What are you avoiding?",
    "What truth are you resisting?",
    "What pattern repeated today?",
    "What made you proud today?",
  ],
};

const he: DebriefQuestions = {
  execution: [
    "מה השגת היום?",
    "אילו משימות חשובות דחית?",
    "מה הזיז את חייך קדימה?",
  ],
  emotional: [
    "איך היה מצב הרוח שלך היום?",
    "מה עורר מתח או חרדה?",
    "הגבת ברגש או נשארת מבוסס?",
    "מה צרך אנרגיה מנטלית?",
  ],
  relationships: [
    "האם תקשרת טוב היום?",
    "יצרת קשר או מתח?",
    "היו דפוסים לא בריאים?",
  ],
  health: [
    "איך הייתה איכות השינה?",
    "האם התאמנת?",
    "איך היו התזונה והריכוז?",
    "מה מצב מערכת העצבים?",
  ],
  awareness: [
    "מה אתה נמנע ממנו?",
    "איזו אמת אתה מתנגד אליה?",
    "איזה דפוס חזר היום?",
    "מה גרם לך גאווה היום?",
  ],
};

const fr: DebriefQuestions = {
  execution: [
    "Qu'avez-vous accompli aujourd'hui ?",
    "Quelles tâches importantes avez-vous évitées ?",
    "Qu'est-ce qui a fait avancer votre vie ?",
  ],
  emotional: [
    "Comment était votre état émotionnel aujourd'hui ?",
    "Qu'est-ce qui a déclenché stress ou anxiété ?",
    "Avez-vous réagi émotionnellement ou êtes-vous resté ancré ?",
    "Qu'est-ce qui a consommé votre énergie mentale ?",
  ],
  relationships: [
    "Avez-vous bien communiqué aujourd'hui ?",
    "Avez-vous créé du lien ou de la tension ?",
    "Y avait-il des schémas malsains ?",
  ],
  health: [
    "Comment était la qualité de votre sommeil ?",
    "Avez-vous fait de l'exercice ?",
    "Comment étaient nutrition et concentration ?",
    "Quel est l'état de votre système nerveux ?",
  ],
  awareness: [
    "Qu'évitez-vous ?",
    "Quelle vérité résistez-vous ?",
    "Quel schéma s'est répété aujourd'hui ?",
    "De quoi êtes-vous fier aujourd'hui ?",
  ],
};

const byLocale: Record<AppLocale, DebriefQuestions> = { en, he, fr };

export function getDebriefQuestions(locale: AppLocale): DebriefQuestions {
  return byLocale[locale] ?? en;
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
