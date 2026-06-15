import type { AppLocale } from "./locale.js";

type DomainRow = {
  name: string;
  slug: string;
  currentState: string | null;
  goals: unknown;
  activeIssues: unknown;
  aiObservations?: string | null;
};

const domainNames: Record<AppLocale, Record<string, string>> = {
  en: {
    health: "Health",
    relationships: "Relationships",
    business: "Business",
    money: "Money",
    mental: "Mental State",
    projects: "Projects",
    purpose: "Purpose",
  },
  he: {
    health: "בריאות",
    relationships: "מערכות יחסים",
    business: "עסקים",
    money: "כסף",
    mental: "מצב נפשי",
    projects: "פרויקטים",
    purpose: "תכלית",
  },
  fr: {
    health: "Santé",
    relationships: "Relations",
    business: "Business",
    money: "Argent",
    mental: "État mental",
    projects: "Projets",
    purpose: "Sens",
  },
};

const currentStates: Record<AppLocale, Record<string, string>> = {
  en: {
    "Active development": "Active development",
    on_track: "On track",
    active: "Active development",
    needs_attention: "Needs attention",
  },
  he: {
    "Active development": "בפיתוח פעיל",
    on_track: "במסלול",
    active: "מתקדם",
    needs_attention: "דורש טיפול",
  },
  fr: {
    "Active development": "En cours",
    on_track: "Sur la bonne voie",
    active: "En cours",
    needs_attention: "À surveiller",
  },
};

const issues: Record<AppLocale, Record<string, string>> = {
  en: {
    "Needs focused attention": "Needs focused attention",
    "No completed tasks yet": "No completed tasks yet",
  },
  he: {
    "Needs focused attention": "צריך להתמקד כאן",
    "No completed tasks yet": "עדיין לא סיימת אף משימה",
  },
  fr: {
    "Needs focused attention": "Mérite votre attention",
    "No completed tasks yet": "Aucune tâche terminée pour l'instant",
  },
};

const goalTemplates: Record<AppLocale, { pattern: RegExp; template: (domain: string) => string }> = {
  en: {
    pattern: /^Strengthen (.+) foundation$/i,
    template: (d) => `Strengthen ${d} foundation`,
  },
  he: {
    pattern: /^Strengthen (.+) foundation$/i,
    template: (d) => `חיזוק יסודות ${d}`,
  },
  fr: {
    pattern: /^Strengthen (.+) foundation$/i,
    template: (d) => `Renforcer les fondations : ${d}`,
  },
};

export const TRADING_RULES_BY_LOCALE: Record<AppLocale, string[]> = {
  en: [
    "Start with 1 micro contract only",
    "Trade only one instrument at first (MNQ or MES)",
    "Track emotional state before and after each trade",
    "Track whether trades followed the system",
    "Track rule violations, revenge trades, and hesitation",
    "Track setup quality and daily risk limits",
    "Progress measured by discipline, not profit",
  ],
  he: [
    "התחל עם חוזה מיקרו אחד בלבד",
    "סחור במכשיר אחד בהתחלה (MNQ או MES)",
    "עקוב אחר מצב רגשי לפני ואחרי כל עסקה",
    "עקוב האם העסקאות עקבו אחר המערכת",
    "עקוב אחר הפרות כללים, מסחר נקמה והיסוס",
    "עקוב אחר איכות סטאפ ומגבלות סיכון יומיות",
    "התקדמות נמדדת במשמעת, לא ברווח",
  ],
  fr: [
    "Commencez avec 1 seul micro contrat",
    "Ne tradez qu'un instrument au début (MNQ ou MES)",
    "Suivez l'état émotionnel avant et après chaque trade",
    "Vérifiez si les trades ont suivi le système",
    "Suivez les violations, trades de revanche et hésitations",
    "Suivez la qualité des setups et les limites de risque",
    "Le progrès se mesure par la discipline, pas le profit",
  ],
};

const englishDomainByName: Record<string, string> = {
  Health: "health",
  Relationships: "relationships",
  Business: "business",
  Money: "money",
  "Mental State": "mental",
  Projects: "projects",
  Purpose: "purpose",
};

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed.map(String) : [v];
    } catch {
      return [v];
    }
  }
  return [];
}

export function localizeDomainName(slug: string, locale: AppLocale, fallback?: string): string {
  return domainNames[locale][slug] ?? domainNames.en[slug] ?? fallback ?? slug;
}

function localizeGoal(goal: string, locale: AppLocale): string {
  const { pattern, template } = goalTemplates[locale];
  const m = goal.match(pattern);
  if (!m) return goal;
  const enName = m[1];
  const slug = englishDomainByName[enName];
  const domainLabel = slug
    ? localizeDomainName(slug, locale, enName)
    : enName;
  return template(domainLabel);
}

export function localizeDomain<T extends DomainRow>(domain: T, locale: AppLocale): T {
  const goals = asStringArray(domain.goals);
  const activeIssues = asStringArray(domain.activeIssues);
  return {
    ...domain,
    name: localizeDomainName(domain.slug, locale, domain.name),
    currentState: domain.currentState
      ? currentStates[locale][domain.currentState] ??
        currentStates.en[domain.currentState] ??
        domain.currentState
      : domain.currentState,
    goals: goals.map((g) => localizeGoal(g, locale)),
    activeIssues: activeIssues.map(
      (i) => issues[locale][i] ?? issues.en[i] ?? i
    ),
  };
}

export function localizeDomains<T extends DomainRow>(domains: T[], locale: AppLocale): T[] {
  return domains.map((d) => localizeDomain(d, locale));
}

export function getTradingRules(locale: AppLocale): string[] {
  return TRADING_RULES_BY_LOCALE[locale] ?? TRADING_RULES_BY_LOCALE.en;
}
