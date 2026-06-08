import type { AppLocale } from "./locale.js";
import type { StrategicProfile } from "./operatorLearning.js";

type MissionCtx = {
  title: string;
  priority: number;
  blockers: string[];
  progress: number;
  domain?: string;
};

type TaskCtx = { title: string; priority: number; due?: string | null };
type DomainCtx = { name: string; state?: string | null; progress: number; issues: string[] };

export type ParsedChatContext = {
  activeMissions: MissionCtx[];
  pendingTasks: TaskCtx[];
  domains: DomainCtx[];
  lastDebriefInsight?: string;
  tomorrowPlan?: unknown;
};

export function parseChatContext(contextJson: string): ParsedChatContext {
  try {
    const raw = JSON.parse(contextJson) as Record<string, unknown>;
    return {
      activeMissions: Array.isArray(raw.activeMissions)
        ? (raw.activeMissions as MissionCtx[])
        : [],
      pendingTasks: Array.isArray(raw.pendingTasks) ? (raw.pendingTasks as TaskCtx[]) : [],
      domains: Array.isArray(raw.domains) ? (raw.domains as DomainCtx[]) : [],
      lastDebriefInsight:
        typeof raw.lastDebriefInsight === "string" ? raw.lastDebriefInsight : undefined,
      tomorrowPlan: raw.tomorrowPlan,
    };
  } catch {
    return { activeMissions: [], pendingTasks: [], domains: [] };
  }
}

type Intent =
  | "greeting"
  | "overwhelm"
  | "priority"
  | "mission"
  | "money"
  | "relationship"
  | "health"
  | "decision"
  | "procrastination"
  | "tomorrow"
  | "feeling"
  | "thanks"
  | "follow_up"
  | "default";

function matches(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

function detectIntent(
  message: string,
  ctx: ParsedChatContext,
  history: { role: string; content: string }[]
): Intent {
  const lower = message.toLowerCase().trim();
  const compact = lower.replace(/[^\p{L}\p{N}\s]/gu, "");

  if (matches(compact, [/^(hi|hello|hey|shalom|שלום|בוקר טוב|ערב טוב)\b/u, /^מה קורה/u, /^מה נשמע/u])) {
    return "greeting";
  }
  if (matches(compact, [/\b(thanks|thank you|תודה)\b/u])) return "thanks";
  if (
    matches(compact, [
      /\b(overwhelm|stressed|stress|anxious|anxiety|too much|burnout)\b/u,
      /לחץ|עומס|מוצף|חרדה|לחוץ|עייף מדי/u,
    ])
  ) {
    return "overwhelm";
  }
  if (
    matches(compact, [
      /\b(priority|priorities|focus|what should i|what do i do|first thing|top task)\b/u,
      /מה לעשות|עדיפות|על מה להתמקד|מה קודם/u,
    ])
  ) {
    return "priority";
  }
  if (matches(compact, [/\b(procrastinat|avoid|delay|put off|stuck)\b/u, /דחיינות|דוחה|נמנע|תקוע/u])) {
    return "procrastination";
  }
  if (matches(compact, [/\b(tomorrow|next week|this week|tonight)\b/u, /מחר|השבוע|הערב/u])) {
    return "tomorrow";
  }
  if (matches(compact, [/\b(feel|feeling|mood|sad|happy|frustrat)\b/u, /מרגיש|תחושה|מצב רוח/u])) {
    return "feeling";
  }
  if (matches(compact, [/\b(should i|worth it|decide|decision|choice)\b/u, /כדאי|להחליט|החלטה|לבחור/u])) {
    return "decision";
  }
  if (matches(compact, [/\b(money|finance|financial|tax|budget|debt)\b/u, /כסף|פיננסי|מיסים|תקציב|חוב/u])) {
    return "money";
  }
  if (
    matches(compact, [
      /\b(relationship|partner|wife|husband|family|friend)\b/u,
      /זוגיות|בן זוג|בת זוג|משפחה|קשר/u,
    ])
  ) {
    return "relationship";
  }
  if (matches(compact, [/\b(tired|sleep|energy|workout|exercise|health)\b/u, /עייף|שינה|אנרגיה|ספורט|בריאות/u])) {
    return "health";
  }

  for (const m of ctx.activeMissions) {
    const words = m.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    if (words.some((w) => compact.includes(w))) return "mission";
  }
  for (const d of ctx.domains) {
    const words = d.name.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    if (words.some((w) => compact.includes(w))) return "mission";
  }

  if (
    history.length >= 2 &&
    compact.length < 40 &&
    matches(compact, [/^(yes|no|why|how|more|ok|okay|explain|really)\b/u, /^(כן|לא|למה|איך|עוד|בסדר)\b/u])
  ) {
    return "follow_up";
  }

  return "default";
}

function topMission(ctx: ParsedChatContext): MissionCtx | undefined {
  return ctx.activeMissions[0];
}

function topTask(ctx: ParsedChatContext): TaskCtx | undefined {
  return ctx.pendingTasks[0];
}

function matchedMission(message: string, ctx: ParsedChatContext): MissionCtx | undefined {
  const lower = message.toLowerCase();
  return ctx.activeMissions.find((m) => {
    const words = m.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    return words.some((w) => lower.includes(w));
  });
}

function pickVariant<T>(items: T[], seed: string): T {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash + seed.charCodeAt(i) * (i + 1)) % items.length;
  return items[hash]!;
}

function patternNote(patterns: string[], locale: AppLocale): string {
  if (patterns.length === 0) return "";
  const slice = patterns.slice(0, 2).join("; ");
  if (locale === "he") return ` שמתי לב בעבר: ${slice}.`;
  if (locale === "fr") return ` J'ai noté auparavant : ${slice}.`;
  return ` I've noticed before: ${slice}.`;
}

function quoteSnippet(message: string, max = 60): string {
  const t = message.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export function buildOfflineChatReply(params: {
  name: string;
  message: string;
  patterns: string[];
  profile: StrategicProfile;
  context: ParsedChatContext;
  history: { role: string; content: string }[];
  locale: AppLocale;
}): string {
  const { name, message, patterns, context, history, locale } = params;
  const intent = detectIntent(message, context, history);
  const mission = topMission(context);
  const task = topTask(context);
  const specific = matchedMission(message, context);
  const note = patternNote(patterns, locale);
  const snippet = quoteSnippet(message);

  const en = (lines: string[]) => lines.join("\n\n");
  const he = (lines: string[]) => lines.join("\n\n");
  const fr = (lines: string[]) => lines.join("\n\n");

  switch (intent) {
    case "greeting": {
      if (locale === "he") {
        return he([
          `שלום ${name}.`,
          mission
            ? `אני רואה ש"${mission.title}" דורשת תשומת לב (${mission.progress}% התקדמות).`
            : "ספר לי מה על הפרק היום — החלטה, עומס, או משימה ספציפית?",
          task ? `אם תרצה נקודת פתיחה: "${task.title}".` : "מה השאלה המרכזית שלך עכשיו?",
        ]);
      }
      if (locale === "fr") {
        return fr([
          `Bonjour ${name}.`,
          mission
            ? `Je vois que « ${mission.title} » demande de l'attention (${mission.progress} %).`
            : "Dites-moi ce qui est le plus urgent — décision, surcharge ou tâche précise ?",
          task ? `Pour commencer : « ${task.title} ».` : "Quelle est votre question principale ?",
        ]);
      }
      return en([
        `Hey ${name}.`,
        mission
          ? `I see "${mission.title}" needs attention (${mission.progress}% progress).`
          : "Tell me what's on deck — a decision, overload, or a specific task?",
        task ? `If you want a starting point: "${task.title}".` : "What's your main question right now?",
      ]);
    }

    case "overwhelm": {
      const count = context.activeMissions.length;
      if (locale === "he") {
        return he([
          `${name}, יש לך ${count} משימות פעילות — זה מרגיש כמו עומס קוגניטיבי.${note}`,
          "צמצם ל-3 מיקודים השבוע. אל תפתור הכל היום.",
          task
            ? `פעולה אחת שתוריד לחץ: "${task.title}" — 20 דקות בלבד.`
            : "בחר פעולה אחת קטנה שתוריד אי-ודאות — גם 15 דקות מספיקות.",
        ]);
      }
      if (locale === "fr") {
        return fr([
          `${name}, ${count} missions actives — charge cognitive élevée.${note}`,
          "Réduisez à 3 priorités cette semaine. Pas tout aujourd'hui.",
          task
            ? `Une action qui soulage : « ${task.title} » — 20 minutes.`
            : "Choisissez une petite action qui réduit l'incertitude.",
        ]);
      }
      return en([
        `${name}, you're running ${count} active missions — that's real cognitive load.${note}`,
        "Shrink to 3 focus areas this week. You don't solve everything today.",
        task
          ? `One action that lowers pressure: "${task.title}" — 20 minutes only.`
          : "Pick one small action that reduces uncertainty — even 15 minutes counts.",
      ]);
    }

    case "priority": {
      const items = context.pendingTasks.slice(0, 3);
      if (locale === "he") {
        return he([
          `${name}, לפי הנתונים שלך עכשיו:`,
          items.length
            ? items.map((t, i) => `${i + 1}. ${t.title}${t.due ? ` (עד ${t.due})` : ""}`).join("\n")
            : "אין משימות פתוחות — הגדר משימה אחת קונקרטית למשימה החשובה ביותר.",
          mission
            ? `המינוף הגבוה: קדם את "${mission.title}" לפני שתפתח עוד תחומים.`
            : "התמקד בתחום אחד עד שיש התקדמות מדידה.",
        ]);
      }
      if (locale === "fr") {
        return fr([
          `${name}, selon vos données :`,
          items.length
            ? items.map((t, i) => `${i + 1}. ${t.title}`).join("\n")
            : "Aucune tâche ouverte — créez-en une liée à votre mission principale.",
          mission ? `Levier max : avancez « ${mission.title} » avant d'ouvrir d'autres fronts.` : "Un domaine à la fois.",
        ]);
      }
      return en([
        `${name}, based on your current data:`,
        items.length
          ? items.map((t, i) => `${i + 1}. ${t.title}${t.due ? ` (due ${t.due})` : ""}`).join("\n")
          : "No open tasks — create one concrete step on your top mission.",
        mission
          ? `Highest leverage: advance "${mission.title}" before opening new fronts.`
          : "Stay on one domain until you have measurable progress.",
      ]);
    }

    case "mission": {
      const m = specific ?? mission;
      if (!m) {
        return buildOfflineChatReply({ ...params, message: "what should I focus on" });
      }
      const blockers =
        m.blockers.length > 0 ? m.blockers.slice(0, 2).join("; ") : "no blockers logged yet";
      if (locale === "he") {
        return he([
          `${name}, לגבי "${m.title}" (${m.progress}%):`,
          `חסמים: ${blockers}.`,
          pickVariant(
            [
              `הצעד הבא: משימה אחת של 25 דקות שמזיזה את המדד — לא תכנון נוסף.`,
              `שאל: מה אני נמנע מלעשות כאן? זה לרוב הצעד האמיתי.`,
              `תעדכן התקדמות היום — גם 10% משנה את המומנטום.`,
            ],
            message
          ),
        ]);
      }
      if (locale === "fr") {
        return fr([
          `${name}, sur « ${m.title} » (${m.progress} %) :`,
          `Blocages : ${blockers}.`,
          pickVariant(
            [
              `Prochain pas : une tâche de 25 min qui fait bouger la jauge.`,
              `Demandez-vous : qu'est-ce que j'évite ici ?`,
              `Notez un progrès aujourd'hui — même 10 % change la dynamique.`,
            ],
            message
          ),
        ]);
      }
      return en([
        `${name}, on "${m.title}" (${m.progress}%):`,
        `Blockers: ${blockers}.`,
        pickVariant(
          [
            `Next step: one 25-minute task that moves the needle — not more planning.`,
            `Ask: what am I avoiding here? That's usually the real step.`,
            `Log progress today — even 10% shifts momentum.`,
          ],
          message
        ),
      ]);
    }

    case "money": {
      const fin = context.domains.find((d) => /financ|money|כסף/i.test(d.name));
      if (locale === "he") {
        return he([
          `${name}, לגבי "${snippet}":${note}`,
          fin
            ? `תחום ${fin.name} ב-${fin.progress}% — ${fin.issues[0] ?? "אין חסמים מתועדים"}.`
            : "כסף ואדמין נוטים להידחות כשיש עומס רגשי.",
          "חסום 30 דקות השבוע לפעולה פיננסית אחת — לא לפתור הכל.",
        ]);
      }
      if (locale === "fr") {
        return fr([
          `${name}, sur « ${snippet} » :${note}`,
          fin ? `Domaine ${fin.name} à ${fin.progress} %.` : "L'admin financier glisse sous charge émotionnelle.",
          "Bloquez 30 min cette semaine pour une seule action financière.",
        ]);
      }
      return en([
        `${name}, on "${snippet}":${note}`,
        fin
          ? `Domain ${fin.name} at ${fin.progress}% — ${fin.issues[0] ?? "no logged issues"}.`
          : "Money and admin tasks slip when emotional load is high.",
        "Block 30 minutes this week for one financial action — not everything at once.",
      ]);
    }

    case "relationship": {
      const rel = context.domains.find((d) => /relation|family|זוג|משפחה/i.test(d.name));
      if (locale === "he") {
        return he([
          `${name}, שאלת על קשרים — "${snippet}".`,
          rel ? `${rel.name}: ${rel.state ?? "ללא סטטוס"} (${rel.progress}%).` : "",
          "פעולה אחת השבוע: שיחה מכוונת 20 דקות — לא ויכוח, לא פתרון מלא.",
        ].filter(Boolean));
      }
      if (locale === "fr") {
        return fr([
          `${name}, sur les relations — « ${snippet} ».`,
          rel ? `${rel.name} : ${rel.progress} %.` : "",
          "Une action : conversation intentionnelle de 20 min — pas un débat complet.",
        ].filter(Boolean));
      }
      return en([
        `${name}, on relationships — "${snippet}".`,
        rel ? `${rel.name}: ${rel.state ?? "no state"} (${rel.progress}%).` : "",
        "One action this week: one intentional 20-minute conversation — not a full debate.",
      ].filter(Boolean));
    }

    case "health": {
      if (locale === "he") {
        return he([
          `${name}, אנרגיה ושינה משפיעים על כל שאר ההחלטות.${note}`,
          "היום: תנועה 20 דקות + שעת שינה קבועה.",
          task ? `אחרי זה — רק "${task.title}" — לא הכל יחד.` : "אחרי זה — משימה אחת בלבד.",
        ]);
      }
      if (locale === "fr") {
        return fr([
          `${name}, énergie et sommeil conditionnent tout le reste.${note}`,
          "Aujourd'hui : 20 min de mouvement + heure de coucher fixe.",
          task ? `Ensuite seulement : « ${task.title} ».` : "Ensuite : une seule tâche.",
        ]);
      }
      return en([
        `${name}, energy and sleep shape every other decision.${note}`,
        "Today: 20 minutes movement + fixed bedtime.",
        task ? `Then — only "${task.title}" — not everything at once.` : "Then — one task only.",
      ]);
    }

    case "decision": {
      if (locale === "he") {
        return he([
          `${name}, לגבי "${snippet}":`,
          "מסגרת: (1) מה ההשלכה בעוד שבוע? (2) מה אתה נמנע לראות? (3) מה הפעולה הקטנה ביותר לבדיקה?",
          mission
            ? `האם זה מקדם את "${mission.title}" או מפזר אותך?`
            : "האם זה מצמצם אי-ודאות או מוסיף עומס?",
        ]);
      }
      if (locale === "fr") {
        return fr([
          `${name}, sur « ${snippet} » :`,
          "Cadre : impact dans une semaine ? qu'évitez-vous de voir ? plus petit test possible ?",
          mission ? `Est-ce que ça fait avancer « ${mission.title} » ?` : "Réduit-il l'incertitude ?",
        ]);
      }
      return en([
        `${name}, on "${snippet}":`,
        "Framework: (1) Impact in one week? (2) What are you avoiding seeing? (3) Smallest test action?",
        mission
          ? `Does this advance "${mission.title}" or scatter you?`
          : "Does this reduce uncertainty or add load?",
      ]);
    }

    case "procrastination": {
      const step = task?.title ?? mission?.title ?? "one concrete step";
      if (locale === "he") {
        return he([
          `${name}, דחיינות לרוב מגינה עליך מפחד, לא מעצלנות.${note}`,
          `כלל 20 דקות: התחל "${step}" — טיימר, בלי שלמות.`,
          "אחרי 20 דקות תחליט אם להמשיך — לרוב המומנטום כבר שם.",
        ]);
      }
      if (locale === "fr") {
        return fr([
          `${name}, la procrastination protège souvent de la peur.${note}`,
          `Règle des 20 min : commencez « ${step} » — minuteur, pas la perfection.`,
          "Après 20 min, décidez si vous continuez.",
        ]);
      }
      return en([
        `${name}, procrastination usually protects you from fear, not laziness.${note}`,
        `20-minute rule: start "${step}" — timer on, no perfection.`,
        "After 20 minutes, decide whether to continue — momentum often kicks in.",
      ]);
    }

    case "tomorrow": {
      const plan = context.tomorrowPlan as { topPriorities?: string[] } | undefined;
      const priorities = plan?.topPriorities?.slice(0, 3);
      if (locale === "he") {
        return he([
          `${name}, תכנון למחר:`,
          priorities?.length
            ? priorities.map((p, i) => `${i + 1}. ${p}`).join("\n")
            : task
              ? `1. ${task.title}\n2. בלוק בוקר מוגן\n3. סגירת יום עם 3 עדיפויות`
              : "1. משימה אחת קונקרטית\n2. בלוק בוקר\n3. סגירת יום",
          context.lastDebriefInsight ? `מהדיבריף האחרון: ${context.lastDebriefInsight.slice(0, 120)}…` : "",
        ].filter(Boolean));
      }
      if (locale === "fr") {
        return fr([
          `${name}, pour demain :`,
          priorities?.length
            ? priorities.map((p, i) => `${i + 1}. ${p}`).join("\n")
            : task
              ? `1. ${task.title}\n2. Bloc matin protégé\n3. Clôture avec 3 priorités`
              : "1. Une tâche concrète\n2. Bloc matin\n3. Clôture",
        ]);
      }
      return en([
        `${name}, for tomorrow:`,
        priorities?.length
          ? priorities.map((p, i) => `${i + 1}. ${p}`).join("\n")
          : task
            ? `1. ${task.title}\n2. Protected morning block\n3. End-of-day top 3`
            : "1. One concrete task\n2. Morning block\n3. End-of-day close",
        context.lastDebriefInsight ? `From last debrief: ${context.lastDebriefInsight.slice(0, 120)}…` : "",
      ].filter(Boolean));
    }

    case "feeling": {
      if (locale === "he") {
        return he([
          `${name}, שמעתי: "${snippet}".${note}`,
          "רגשות הם נתונים — לא פקודות. מה הפחד או הצורך שמתחת?",
          task
            ? `פעולה מכוונת אחת היום: "${task.title}".`
            : "פעולה מכוונת אחת היום — קטנה, מדידה.",
        ]);
      }
      if (locale === "fr") {
        return fr([
          `${name}, j'entends : « ${snippet} ».${note}`,
          "Les émotions sont des données — pas des ordres. Quelle peur ou besoin dessous ?",
          task ? `Une action ciblée : « ${task.title} ».` : "Une petite action mesurable aujourd'hui.",
        ]);
      }
      return en([
        `${name}, I hear: "${snippet}".${note}`,
        "Feelings are data — not commands. What fear or need is underneath?",
        task ? `One aligned action today: "${task.title}".` : "One small measurable action today.",
      ]);
    }

    case "thanks": {
      if (locale === "he") return `בכיף, ${name}. אני כאן כשתצטרך לפרק את הצעד הבא.`;
      if (locale === "fr") return `Avec plaisir, ${name}. Je suis là pour le prochain pas.`;
      return `Anytime, ${name}. I'm here when you need the next step broken down.`;
    }

    case "follow_up": {
      const lastAssistant = [...history].reverse().find((h) => h.role === "assistant");
      const lastUser = [...history].reverse().find((h) => h.role === "user");
      if (locale === "he") {
        return he([
          `${name}, ממשיכים מהנקודה הקודמת.`,
          lastAssistant ? `אמרתי: ${lastAssistant.content.slice(0, 100)}…` : "",
          `עכשיו אתה שואל "${snippet}" —`,
          task
            ? `הצעד המעשי: "${task.title}" עכשיו, לא מחר.`
            : "תן לי פרט אחד נוסף ואכוון אותך לצעד ספציפי.",
        ].filter(Boolean));
      }
      if (locale === "fr") {
        return fr([
          `${name}, on continue.`,
          lastUser ? `Vous aviez dit : « ${lastUser.content.slice(0, 80)}… »` : "",
          `Maintenant : « ${snippet} » —`,
          task ? `Pas concret : « ${task.title} » maintenant.` : "Un détail de plus pour cibler l'action.",
        ].filter(Boolean));
      }
      return en([
        `${name}, picking up from before.`,
        lastAssistant ? `I said: ${lastAssistant.content.slice(0, 100)}…` : "",
        `Now you're asking "${snippet}" —`,
        task ? `Concrete step: "${task.title}" now, not tomorrow.` : "Give me one more detail and I'll target a specific step.",
      ].filter(Boolean));
    }

    default: {
      const domain = context.domains[0];
      if (locale === "he") {
        return he([
          `${name}, לגבי "${snippet}":${note}`,
          mission ? `בהקשר של "${mission.title}" (${mission.domain ?? "ללא תחום"}).` : "",
          domain ? `תחום ${domain.name} ב-${domain.progress}%.` : "",
          pickVariant(
            [
              task ? `הצעד הראשון: "${task.title}" — 25 דקות.` : "הגדר משימה אחת מדידה להיום.",
              "מה תרוויח אם תסיים את זה השבוע? התשובה מגלה את העדיפות האמיתית.",
              "פרק לשלושה: מה ידוע, מה חסר, מה הפעולה הקטנה ביותר עכשיו.",
            ],
            message + intent
          ),
        ].filter(Boolean));
      }
      if (locale === "fr") {
        return fr([
          `${name}, sur « ${snippet} » :${note}`,
          mission ? `Dans le contexte de « ${mission.title} ».` : "",
          pickVariant(
            [
              task ? `Premier pas : « ${task.title} » — 25 min.` : "Une tâche mesurable aujourd'hui.",
              "Que gagnez-vous en finissant cette semaine ?",
              "Trois parties : connu, manquant, plus petite action.",
            ],
            message
          ),
        ].filter(Boolean));
      }
      return en([
        `${name}, on "${snippet}":${note}`,
        mission ? `In the context of "${mission.title}" (${mission.domain ?? "general"}).` : "",
        domain ? `Domain ${domain.name} at ${domain.progress}%.` : "",
        pickVariant(
          [
            task ? `First step: "${task.title}" — 25 minutes.` : "Define one measurable task for today.",
            "What do you gain if this is done this week? That reveals the real priority.",
            "Break into three: what's known, what's missing, smallest action now.",
          ],
          message + intent
        ),
      ].filter(Boolean));
    }
  }
}
