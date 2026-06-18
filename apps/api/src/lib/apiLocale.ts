import type { AppLocale } from "./locale.js";

type Vars = Record<string, string | number>;

const S = {
  chatProcessing: {
    en: "I'm processing your situation. Try again in a moment.",
    he: "אני מעבד את המצב. נסה שוב בעוד רגע.",
    fr: "J'analyse votre situation. Réessayez dans un instant.",
  },
  morningTitle: {
    en: "Good morning, {name}",
    he: "בוקר טוב, {name}",
    fr: "Bonjour, {name}",
  },
  morningOracleTitle: {
    en: "Daily Oracle · {name}",
    he: "Oracle יומי · {name}",
    fr: "Oracle du jour · {name}",
  },
  morningFallback: {
    en: "Open Oracle and review your top priorities.",
    he: "פתח את Oracle ועבור על העדיפויות שלך.",
    fr: "Ouvrez Oracle et passez en revue vos priorités.",
  },
  morningTopTask: {
    en: "#1 task: {task}",
    he: "משימה #1: {task}",
    fr: "Tâche n°1 : {task}",
  },
  taskReminderTitle: {
    en: "Task reminder · {name}",
    he: "תזכורת משימה · {name}",
    fr: "Rappel tâche · {name}",
  },
  taskReminderOverdue: {
    en: "Overdue: \"{task}\" — schedule a 20-min block or reschedule.",
    he: "באיחור: \"{task}\" — קבע בלוק 20 דק׳ או תזמן מחדש.",
    fr: "En retard : « {task} » — bloquez 20 min ou reportez.",
  },
  taskReminderDueToday: {
    en: "Due today: \"{task}\" — time to execute or update Oracle.",
    he: "מגיע היום: \"{task}\" — זמן לבצע או לעדכן את Oracle.",
    fr: "Pour aujourd'hui : « {task} » — exécutez ou mettez Oracle à jour.",
  },
  taskReminderScheduled: {
    en: "Scheduled now: \"{task}\" — you blocked time for this.",
    he: "מתוזמן עכשיו: \"{task}\" — שמרת זמן לזה.",
    fr: "Prévu maintenant : « {task} » — vous avez réservé du temps.",
  },
  taskReminderGeneric: {
    en: "Reminder: \"{task}\" is waiting on you.",
    he: "תזכורת: \"{task}\" מחכה לך.",
    fr: "Rappel : « {task} » vous attend.",
  },
  focusBlock20Title: {
    en: "20-min block: advance {mission}",
    he: "בלוק 20 דק׳: קדם את {mission}",
    fr: "Bloc 20 min : avancer {mission}",
  },
  focusBlock20Desc: {
    en: "Set a timer for 20 minutes. Open only what you need for {mission}. One concrete output — email sent, doc filed, or decision written. Stop when the timer ends.",
    he: "הגדר טיימר ל-20 דקות. פתח רק מה שצריך עבור {mission}. תוצר אחד מוחשי — מייל שנשלח, מסמך שהוגש, או החלטה שנכתבה. עצור כשהטיימר מסתיים.",
    fr: "Lancez un minuteur de 20 minutes. N'ouvrez que ce dont vous avez besoin pour {mission}. Un livrable concret — e-mail envoyé, document déposé ou décision écrite. Arrêtez quand le minuteur sonne.",
  },
  focusClearBlockerTitle: {
    en: "Clear one blocker on {mission}",
    he: "נקה חסם אחד ב-{mission}",
    fr: "Lever un blocage sur {mission}",
  },
  focusClearBlockerDescWith: {
    en: 'Address: "{blocker}". Break into the smallest next step (5–15 min). Log what changed.',
    he: 'טפל ב: "{blocker}". פרק לצעד הקטן הבא (5–15 דק׳). רשום מה השתנה.',
    fr: 'Traitez : « {blocker} ». Décomposez en la plus petite prochaine étape (5–15 min). Notez ce qui a changé.',
  },
  focusClearBlockerDescWithout: {
    en: "Identify the single thing slowing {mission}. Write it in one sentence, then take one 15-minute action on it.",
    he: "זהה את הדבר היחיד שמאט את {mission}. כתוב במשפט אחד, ואז בצע פעולה של 15 דקות.",
    fr: "Identifiez ce qui ralentit {mission}. Écrivez-le en une phrase, puis agissez 15 minutes dessus.",
  },
  focusPlanTitle: {
    en: "Plan next step: {mission}",
    he: "תכנן צעד הבא: {mission}",
    fr: "Planifier la prochaine étape : {mission}",
  },
  focusPlanDesc: {
    en: "Write three bullets: what is done, what is stuck, what you will do in the next 24 hours. Then do bullet three immediately if it takes under 20 minutes.",
    he: "כתוב שלוש נקודות: מה הושלם, מה תקוע, מה תעשה ב-24 השעות הבאות. אם שלישית לוקחת פחות מ-20 דקות — עשה אותה מיד.",
    fr: "Notez trois points : ce qui est fait, ce qui bloque, ce que vous ferez dans les 24 h. Si le troisième prend moins de 20 min, faites-le tout de suite.",
  },
  prioritizeRecommendation: {
    en: "Focus on highest-impact practical actions first. Reduce active missions if overloaded.",
    he: "התמקד קודם בפעולות מעשיות בעלות השפעה גבוהה. הפחת משימות פעילות אם יש עומס.",
    fr: "Concentrez-vous d'abord sur les actions pratiques à fort impact. Réduisez les missions actives si vous êtes surchargé.",
  },
  prioritizeInsightMorning: {
    en: "You perform best with structured mornings.",
    he: "הביצועים הטובים ביותר שלך עם בוקר מובנה.",
    fr: "Vous performez mieux avec des matinées structurées.",
  },
  prioritizeInsightFinancial: {
    en: "Avoid financial tasks when emotionally stressed.",
    he: "הימנע ממשימות כספיות כשיש לחץ רגשי.",
    fr: "Évitez les tâches financières sous stress émotionnel.",
  },
  prioritizeFallback: {
    en: "Execute one high-leverage task at a time.",
    he: "בצע משימה אחת בעלת מינוף גבוה בכל פעם.",
    fr: "Exécutez une tâche à fort levier à la fois.",
  },
  nudgeOverdueTitle: {
    en: "{name}, don't let these slip",
    he: "{name}, אל תיתן לזה ליפול",
    fr: "{name}, ne laissez pas filer",
  },
  nudgeOverdueBody: {
    en: "{count} overdue — pick one and act for 10 minutes. Momentum beats perfection.",
    he: "{count} באיחור — בחר אחד ופעל 10 דקות. מומנטום מנצח שלמות.",
    fr: "{count} en retard — choisissez-en une et agissez 10 min. L'élan vaut mieux que la perfection.",
  },
  nudgeFocusTitle: {
    en: "Your next move · {name}",
    he: "המהלך הבא שלך · {name}",
    fr: "Votre prochain pas · {name}",
  },
  nudgeTestTitle: {
    en: "Oracle is watching your priorities",
    he: "Oracle עוקב אחרי העדיפויות שלך",
    fr: "Oracle veille sur vos priorités",
  },
  nudgeTestBody: {
    en: "Push notifications are on. Oracle will nudge you toward what matters — even when the app is closed.",
    he: "התראות פוש פעילות. Oracle יזכיר לך מה חשוב — גם כשהאפליקציה סגורה.",
    fr: "Les notifications push sont activées. Oracle vous orientera vers l'essentiel — même app fermée.",
  },
} as const satisfies Record<string, Record<AppLocale, string>>;

function fill(template: string, vars?: Vars): string {
  if (!vars) return template;
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
  }
  return out;
}

export function apiStr(
  key: keyof typeof S,
  locale: AppLocale,
  vars?: Vars
): string {
  const entry = S[key];
  const template = entry[locale] ?? entry.en;
  return fill(template, vars);
}

export function mockDailyBriefing(name: string, locale: AppLocale) {
  const content: Record<
    AppLocale,
    {
      topPriorities: string[];
      emotionalObservation: string;
      focusRecommendation: string;
      reminders: string[];
      missionProgress: string;
      strategicGuidance: string;
      fullContent: string;
    }
  > = {
    en: {
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
    },
    he: {
      topPriorities: [
        "הפחת אי-ודאות סביב דיור ולוגיסטיקת מעבר",
        "השלם משימת עסקים אחת בעלת השפעה עבור Agentis",
        "שמור על אנרגיה: בוקר מובנה, בלוק אימון אחד",
      ],
      emotionalObservation:
        "יש נטייה להרהור כשמספר תחומים מרגישים לא יציבים. עגן במבנה מעשי לפני החלטות גדולות.",
      focusRecommendation: "ביצוע מעשי היום במקום עיבוד רגשי. בלוקים ממוקדים של 20 דקות.",
      reminders: [
        "הימנע מהחלטות מונעות רגש על המעבר",
        "ארגון כספים נדחה 3 ימים — טפל בפריט אחד",
      ],
      missionProgress:
        "משימת המעבר ב-35%. בניית העסק ב-52%. תיקון מערכות יחסים דורש תקשורת מכוונת.",
      strategicGuidance:
        "העדיפות הגדולה היום היא הפחתת אי-ודאות סביב הבית. הימנע מהחלטות מונעות רגש. התמקד במבנה מעשי. משימה אדמיניסטרטיבית אחת שהושלמה תוריד משמעותית את העומס הקוגניטיבי.",
      fullContent: `בוקר טוב, ${name}. העדיפות הגדולה היום היא הפחתת אי-ודאות סביב הבית. הימנע מהחלטות מונעות רגש. התמקד במבנה מעשי. השלם משימת אדמין אחת למעבר ומשימת ביצוע אחת ל-Agentis. שמור על מערכת העצבים עם תנועה וגבולות על בזבוז קשב.`,
    },
    fr: {
      topPriorities: [
        "Réduire l'incertitude autour du logement et de la relocation",
        "Accomplir une tâche business à fort impact pour Agentis",
        "Protéger l'énergie : matinée structurée, un bloc d'entraînement",
      ],
      emotionalObservation:
        "Vous avez tendance à ruminer quand plusieurs domaines semblent instables. Ancrez-vous dans une structure pratique avant les grandes décisions.",
      focusRecommendation:
        "Exécution pratique plutôt que traitement émotionnel aujourd'hui. Blocs concentrés de 20 minutes.",
      reminders: [
        "Évitez les décisions émotionnelles sur la relocation",
        "Organisation financière reportée depuis 3 jours — traitez un point",
      ],
      missionProgress:
        "Mission relocation à 35 %. Construction business à 52 %. La relation nécessite une communication intentionnelle.",
      strategicGuidance:
        "Votre priorité majeure aujourd'hui est de réduire l'incertitude autour du logement. Évitez les décisions émotionnelles. Concentrez-vous sur une structure pratique. Une tâche administrative accomplie réduit fortement la charge cognitive.",
      fullContent: `Bonjour, ${name}. Votre priorité majeure aujourd'hui est de réduire l'incertitude autour du logement. Évitez les décisions émotionnelles. Concentrez-vous sur une structure pratique. Accomplissez une tâche admin de relocation et un bloc d'exécution Agentis. Protégez votre système nerveux avec du mouvement et des limites sur les fuites d'attention.`,
    },
  };
  return content[locale] ?? content.en;
}

export function mockNightAnalysis(locale: AppLocale) {
  const content: Record<
    AppLocale,
    {
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
    }
  > = {
    en: {
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
    },
    he: {
      focusScore: 72,
      emotionalScore: 68,
      executionScore: 65,
      alignmentScore: 70,
      energyScore: 62,
      aiAssessment:
        "התמודדת היום טוב יותר עם אי-ודאות רגשית והימנעת מתגובות מונעות פאניקה. עם זאת, ארגון כספים ותכנון מעבר עדיין נדחים. המצב הרגשי השתפר משמעותית אחרי מבנה וחיבור. מחר כדאי לתעדף ביצוע מעשי על פני הרהור רגשי.",
      behavioralNotes: [
        "דפוס הימנעות ממשימות כספיות תחת לחץ",
        "ויסות משופר אחרי פעילות מובנית",
        "תחום מערכות היחסים קיבל תשומת לב מספקת",
      ],
      tomorrowPlan: {
        topPriorities: [
          "משימת אדמין אחת למעבר (מקסימום 30 דק׳)",
          "Agentis: השלמת deliverable אחד",
          "מבנה בוקר לפני מצב תגובתי",
        ],
        missionCritical: ["הפחתת אי-ודאות דיור", "בדיקת ייצוב הכנסה"],
        emotionalWarnings: [
          "אל תקבל החלטות מעבר מחרדה",
          "הגבל הרהור — חלון דאגה של 15 דקות בלבד",
        ],
        focusRecommendation: "בלוקים מעשיים לפני 14:00. שמור על בוקר עבודה עמוקה.",
        recoverySuggestions: ["שינה עד 23:00", "הליכה ערב של 10 דק׳", "ללא מסכים 30 דק׳ לפני שינה"],
        executionStrategy:
          "שלושה בלוקי ביצוע של 25 דקות. תחום אחד בלבד לכל בלוק. סיים את היום עם 3 העדיפויות למחר.",
      },
      patternDetected: "דחיית משימות כספיות/אדמין תחת עומס רגשי",
    },
    fr: {
      focusScore: 72,
      emotionalScore: 68,
      executionScore: 65,
      alignmentScore: 70,
      energyScore: 62,
      aiAssessment:
        "Vous avez mieux géré l'incertitude émotionnelle aujourd'hui et évité les réactions de panique. Cependant, l'organisation financière et la planification de relocation sont encore reportées. Votre état émotionnel s'est nettement amélioré après structure et connexion. Demain, privilégiez l'exécution pratique plutôt que la rumination.",
      behavioralNotes: [
        "Évitement des tâches financières sous stress",
        "Meilleure régulation après activité structurée",
        "Le domaine relationnel a reçu une attention suffisante",
      ],
      tomorrowPlan: {
        topPriorities: [
          "Une tâche admin relocation (30 min max)",
          "Agentis : un livrable accompli",
          "Structure matinale avant le mode réactif",
        ],
        missionCritical: ["Réduction incertitude logement", "Vérification stabilisation revenus"],
        emotionalWarnings: [
          "Ne prenez pas de décisions relocation par anxiété",
          "Limitez la rumination — fenêtre d'inquiétude de 15 min seulement",
        ],
        focusRecommendation: "Blocs pratiques avant 14h. Protégez le matin de travail profond.",
        recoverySuggestions: [
          "Coucher avant 23h",
          "Marche du soir 10 min",
          "Pas d'écrans 30 min avant le coucher",
        ],
        executionStrategy:
          "Trois blocs d'exécution de 25 min. Un seul domaine par bloc. Clôturez avec le top 3 de demain écrit.",
      },
      patternDetected: "Report des tâches financières/admin sous charge émotionnelle",
    },
  };
  return content[locale] ?? content.en;
}

export function mockFollowUpQuestion(
  locale: AppLocale,
  vars: {
    operatorName: string;
    taskTitle: string;
    status: string;
    priorNote?: string | null;
    hoursOpen: number;
  }
): string {
  const { operatorName, taskTitle, status, priorNote, hoursOpen } = vars;
  const note = priorNote?.trim();
  const shortNote = note ? `${note.slice(0, 60)}…` : "";

  if (status === "COMPLETED") {
    if (note) {
      return locale === "he"
        ? `${operatorName}, השלמת את "${taskTitle}" — מה עבד? מה לחזור עליו?`
        : locale === "fr"
          ? `${operatorName}, vous avez terminé « ${taskTitle} » — qu'est-ce qui a fonctionné ?`
          : `${operatorName}, you completed "${taskTitle}" — what made it work? Anything to repeat?`;
    }
    return locale === "he"
      ? `מה התוצאה מ-"${taskTitle}"? שווה לרשום לפעם הבאה?`
      : locale === "fr"
        ? `Quel résultat pour « ${taskTitle} » ? À noter pour la prochaine fois ?`
        : `What outcome did you get from "${taskTitle}"? Worth noting for next time?`;
  }

  if (status === "PARTIAL" && !note) {
    return locale === "he"
      ? `"${taskTitle}" חלקי — איזה צעד ספציפי סוגר אותו?`
      : locale === "fr"
        ? `« ${taskTitle} » est partiel — quelle étape précise le termine ?`
        : `"${taskTitle}" is partial — what specific step closes it out?`;
  }

  if (status === "PARTIAL" && note) {
    return locale === "he"
      ? `דיווחת התקדמות חלקית ב-"${taskTitle}" (${shortNote}) — מה נשאר להשלמה?`
      : locale === "fr"
        ? `Progrès partiel sur « ${taskTitle} » (${shortNote}) — que reste-t-il ?`
        : `You reported partial progress on "${taskTitle}" (${shortNote}) — what's left to finish it?`;
  }

  if (status === "SKIPPED") {
    return locale === "he"
      ? `דילגת על "${taskTitle}" — מה באמת חסם? איך לשנות גודל?`
      : locale === "fr"
        ? `Vous avez sauté « ${taskTitle} » — qu'est-ce qui a bloqué ? Comment réduire la tâche ?`
        : `You skipped "${taskTitle}" — honestly, what blocked you? How should we resize this task?`;
  }

  if (status === "IN_PROGRESS" && note) {
    const clip = note.slice(0, 80) + (note.length > 80 ? "…" : "");
    return locale === "he"
      ? `${operatorName}, אמרת "${clip}" — כמה נשאר ב-"${taskTitle}"?`
      : locale === "fr"
        ? `${operatorName}, vous avez dit « ${clip} » — combien reste-t-il sur « ${taskTitle} » ?`
        : `${operatorName}, you said "${clip}" — how much is left on "${taskTitle}"?`;
  }

  if (status === "IN_PROGRESS") {
    return locale === "he"
      ? `עד כמה התקדמת ב-"${taskTitle}"? מה הצעד הבא המוחשי?`
      : locale === "fr"
        ? `Où en êtes-vous sur « ${taskTitle} » ? Quelle est la prochaine étape concrète ?`
        : `How far did you get on "${taskTitle}"? What's the next concrete step?`;
  }

  if (hoursOpen > 24) {
    return locale === "he"
      ? `"${taskTitle}" פתוחה כבר זמן. השלמת, התקדמת חלקית, או דילגת? מה קרה?`
      : locale === "fr"
        ? `« ${taskTitle} » est ouverte depuis longtemps. Terminée, partielle ou sautée ? Que s'est-il passé ?`
        : `"${taskTitle}" has been open a while. Did you complete it, make partial progress, or skip it? What happened?`;
  }

  return note
    ? locale === "he"
      ? `עדכון על "${taskTitle}" מאז ההערה האחרונה?`
      : locale === "fr"
        ? `Des nouvelles sur « ${taskTitle} » depuis votre dernière note ?`
        : `Any update on "${taskTitle}" since your last note?`
    : locale === "he"
      ? `התחלת את "${taskTitle}"? אם לא — מה חוסם?`
      : locale === "fr"
        ? `Avez-vous commencé « ${taskTitle} » ? Sinon, qu'est-ce qui bloque ?`
        : `Have you started "${taskTitle}" yet? If not, what's blocking you?`;
}

export function mockFollowUpAcknowledgment(
  locale: AppLocale,
  vars: { operatorName: string; taskTitle: string; done: boolean; partial: boolean; skipped: boolean; blocked: boolean }
): string {
  const { operatorName, taskTitle, done, partial, skipped, blocked } = vars;
  const prefix =
    locale === "he"
      ? `נרשם, ${operatorName}. `
      : locale === "fr"
        ? `Noté, ${operatorName}. `
        : `Logged, ${operatorName}. `;

  if (done) {
    return (
      prefix +
      (locale === "he"
        ? `סגירה חזקה ב-"${taskTitle}". רשום לקח אחד לפני שממשיכים.`
        : locale === "fr"
          ? `Belle clôture sur « ${taskTitle} ». Notez une leçon avant de continuer.`
          : `Strong close on "${taskTitle}". Capture one lesson before moving on.`)
    );
  }
  if (partial) {
    return (
      prefix +
      (locale === "he"
        ? `התקדמות חלקית נספרת — תזמן בלוק 20 דק׳ הבא על "${taskTitle}" בזמן שיש מומנטום.`
        : locale === "fr"
          ? `Le progrès partiel compte — planifiez le prochain bloc de 20 min sur « ${taskTitle} » tant que l'élan est là.`
          : `Partial progress counts — schedule the next 20-min block on "${taskTitle}" while momentum exists.`)
    );
  }
  if (skipped) {
    return (
      prefix +
      (locale === "he"
        ? `דילוג קורה — שם את החסם האמיתי ב-"${taskTitle}" כדי שנקטין את הצעד הבא.`
        : locale === "fr"
          ? `Les sauts arrivent — nommez le vrai blocage sur « ${taskTitle} » pour réduire la prochaine étape.`
          : `Skipping happens — name the real blocker on "${taskTitle}" so we can shrink the next step.`)
    );
  }
  if (blocked) {
    return (
      prefix +
      (locale === "he"
        ? `חיכוך נרשם. פרק את "${taskTitle}" לגרסה של 10 דקות שאפשר לעשות היום.`
        : locale === "fr"
          ? `Friction notée. Décomposez « ${taskTitle} » en version 10 minutes faisable aujourd'hui.`
          : `Friction noted. Break "${taskTitle}" into a 10-minute version you can do today.`)
    );
  }
  return (
    prefix +
    (locale === "he"
      ? `נרשם. מה הפעולה הבאה היחידה על "${taskTitle}" ב-24 השעות הבאות?`
      : locale === "fr"
        ? `Noté. Quelle est la prochaine action unique sur « ${taskTitle} » dans les 24 h ?`
        : `Noted. What's the single next action on "${taskTitle}" in the next 24 hours?`)
  );
}

type OracleContext = Record<string, unknown>;

function pickMissionTitle(ctx: OracleContext): string | null {
  const missions = ctx.activeMissions as { title?: string }[] | undefined;
  return missions?.[0]?.title ?? null;
}

function pickClarityTitle(ctx: OracleContext): string | null {
  const clarity = ctx.clarity as { title?: string }[] | undefined;
  return clarity?.[0]?.title ?? null;
}

export function mockDailyOracleLine(
  name: string,
  locale: AppLocale,
  ctx: OracleContext = {}
): { line: string; subline: string | null } {
  const mission = pickMissionTitle(ctx);
  const clarity = pickClarityTitle(ctx);
  const focus = mission ?? clarity;

  const templates: Record<
    AppLocale,
    { line: (n: string, f: string | null) => string; subline: string }
  > = {
    en: {
      line: (n, f) =>
        f
          ? `${n}, today isn't about doing everything — it's about unblocking "${f}".`
          : `${n}, one honest move today beats a perfect plan you'll postpone.`,
      subline: "Open your focus queue when you're ready — Oracle already prioritized.",
    },
    he: {
      line: (n, f) =>
        f
          ? `${n}, היום לא עושים הכל — היום מסירים חסם אחד ב-"${f}".`
          : `${n}, צעד אחד כנה היום עדיף על תוכנית מושלמת שידחו.`,
      subline: "כשתהיה מוכן — תור המיקוד כבר מחכה.",
    },
    fr: {
      line: (n, f) =>
        f
          ? `${n}, aujourd'hui ce n'est pas tout faire — c'est débloquer « ${f} ».`
          : `${n}, un geste honnête aujourd'hui vaut mieux qu'un plan parfait reporté.`,
      subline: "Quand vous voulez — la file focus est déjà priorisée.",
    },
  };

  const t = templates[locale] ?? templates.en;
  return { line: t.line(name, focus), subline: t.subline };
}
