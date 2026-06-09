import type { Domain } from "@/lib/api";

import { translate, type Locale } from "./messages";



const ENGLISH_DOMAIN_SLUG: Record<string, string> = {

  Health: "health",

  Relationships: "relationships",

  Business: "business",

  Money: "money",

  "Mental State": "mental",

  Projects: "projects",

  Purpose: "purpose",

};



const STATE_KEYS: Record<string, string> = {

  "Active development": "catalog.state.activeDevelopment",

};



const ISSUE_KEYS: Record<string, string> = {

  "Needs focused attention": "catalog.issues.needsAttention",

};



const MISSION_STATUS_KEYS: Record<string, string> = {

  ACTIVE: "catalog.missionStatus.ACTIVE",

  PAUSED: "catalog.missionStatus.PAUSED",

  COMPLETED: "catalog.missionStatus.COMPLETED",

  ARCHIVED: "catalog.missionStatus.ARCHIVED",

};



const TASK_STATUS_KEYS: Record<string, string> = {

  PENDING: "catalog.taskStatus.PENDING",

  IN_PROGRESS: "catalog.taskStatus.IN_PROGRESS",

  COMPLETED: "catalog.taskStatus.COMPLETED",

  PARTIAL: "catalog.taskStatus.PARTIAL",

  SKIPPED: "catalog.taskStatus.SKIPPED",

  DELAYED: "catalog.taskStatus.DELAYED",

  RESCHEDULED: "catalog.taskStatus.RESCHEDULED",

  CANCELLED: "catalog.taskStatus.CANCELLED",

};



const API_PHRASE_KEYS: Record<string, string> = {

  "You are overloaded. Consider reducing active missions.": "catalog.phrases.insightOverloaded",

  "You perform best after exercise and structured mornings.":

    "catalog.phrases.insightMorningExercise",

  "Financial tasks tend to be avoided when emotionally stressed.":

    "catalog.phrases.insightFinancialAvoid",

  "Avoids financial tasks when emotionally stressed": "catalog.phrases.memoryFinancialAvoid",

  "Performs best after exercise and structured mornings": "catalog.phrases.memoryMorningExercise",

  "Reduce active missions. You are overloaded.": "catalog.phrases.recReduceMissions",

  "Focus on practical structure today, not emotional rumination.":

    "catalog.phrases.recPracticalStructure",

  "One high-leverage action beats ten low-value tasks.": "catalog.phrases.recHighLeverage",

  "Productivity improves after structured mornings": "catalog.phrases.patternMorning",

  "Financial tasks avoided after emotional conflict": "catalog.phrases.patternFinancialConflict",

  "Too many active missions": "catalog.phrases.frictionTooManyMissions",

  "Cognitive overload": "catalog.phrases.frictionOverload",

  "Repeated task avoidance": "catalog.phrases.frictionAvoidance",

  "Your biggest priority today is reducing uncertainty around the house. Avoid emotionally driven decisions. Focus on practical structure. One completed administrative task will lower cognitive load significantly.":

    "catalog.phrases.briefingGuidance",

};



const SEED_MISSION_KEYS: Record<string, string> = {

  "Relocate from Australia to Israel": "catalog.seedMissions.relocate",

  "Build Agentis": "catalog.seedMissions.agentis",

  "Improve emotional regulation": "catalog.seedMissions.emotional",

  "Organize property and finances": "catalog.seedMissions.finances",

  "Return to Futures Trading Safely": "catalog.seedMissions.trading",

};



export function localizeDomainName(

  slug: string | undefined,

  fallbackName: string,

  locale: Locale

): string {

  if (slug) {

    const key = `catalog.domains.${slug}`;

    const translated = translate(locale, key);

    if (translated !== key) return translated;

  }

  const slugFromName = ENGLISH_DOMAIN_SLUG[fallbackName];

  if (slugFromName) {

    const key = `catalog.domains.${slugFromName}`;

    const translated = translate(locale, key);

    if (translated !== key) return translated;

  }

  return fallbackName;

}



export function localizeDomain(domain: Domain, locale: Locale): Domain {

  const name = localizeDomainName(domain.slug, domain.name, locale);

  return {

    ...domain,

    name,

    currentState: domain.currentState

      ? localizePhrase(domain.currentState, locale, STATE_KEYS)

      : domain.currentState,

    goals: domain.goals.map((g) => localizeGoal(g, locale)),

    activeIssues: domain.activeIssues.map((i) =>

      localizePhrase(i, locale, ISSUE_KEYS)

    ),

  };

}



export function localizeGoal(goal: string, locale: Locale): string {

  const m = goal.match(/^Strengthen (.+) foundation$/i);

  if (!m) return goal;

  const enName = m[1];

  const slug = ENGLISH_DOMAIN_SLUG[enName];

  const domainLabel = slug

    ? localizeDomainName(slug, enName, locale)

    : enName;

  return translate(locale, "catalog.goalStrength", { name: domainLabel });

}



export function localizePhrase(

  text: string,

  locale: Locale,

  keyMap: Record<string, string>

): string {

  const key = keyMap[text];

  if (!key) return text;

  const translated = translate(locale, key);

  return translated !== key ? translated : text;

}



export function localizeMissionStatus(status: string, locale: Locale): string {

  return localizePhrase(status, locale, MISSION_STATUS_KEYS);

}



export function localizeTaskStatus(status: string, locale: Locale): string {

  return localizePhrase(status, locale, TASK_STATUS_KEYS);

}



export function localizeMissionTitle(title: string, locale: Locale): string {

  const key = SEED_MISSION_KEYS[title];

  if (!key) return title;

  const translated = translate(locale, key);

  return translated !== key ? translated : title;

}



export function localizeApiPhrase(text: string, locale: Locale): string {

  if (locale === "en") return text;

  const key = API_PHRASE_KEYS[text.trim()];

  if (!key) return text;

  const translated = translate(locale, key);

  return translated !== key ? translated : text;

}



export function localizeTaskTitle(title: string, locale: Locale): string {

  const blockMatch = title.match(/^20-min block: advance (.+)$/);
  if (blockMatch) {
    return translate(locale, "catalog.taskTemplates.block20Advance", {
      mission: localizeMissionTitle(blockMatch[1], locale),
    });
  }

  const clearMatch = title.match(/^Clear one blocker on (.+)$/);
  if (clearMatch) {
    return translate(locale, "catalog.taskTemplates.clearBlocker", {
      mission: localizeMissionTitle(clearMatch[1], locale),
    });
  }

  const planMatch = title.match(/^Plan next step: (.+)$/);

  if (planMatch) {

    return translate(locale, "catalog.taskTemplates.planNext", {

      mission: localizeMissionTitle(planMatch[1], locale),

    });

  }

  const reviewMatch = title.match(/^Review blockers for (.+)$/);

  if (reviewMatch) {

    return translate(locale, "catalog.taskTemplates.reviewBlockers", {

      mission: localizeMissionTitle(reviewMatch[1], locale),

    });

  }

  if (title === "20-min execution block") {

    const translated = translate(locale, "catalog.taskTemplates.executionBlock");

    return translated !== "catalog.taskTemplates.executionBlock" ? translated : title;

  }

  return localizeApiPhrase(title, locale);

}



export function tradingRulesFallback(locale: Locale): string[] {

  return [

    translate(locale, "catalog.tradingRules.0"),

    translate(locale, "catalog.tradingRules.1"),

    translate(locale, "catalog.tradingRules.2"),

    translate(locale, "catalog.tradingRules.3"),

    translate(locale, "catalog.tradingRules.4"),

    translate(locale, "catalog.tradingRules.5"),

    translate(locale, "catalog.tradingRules.6"),

  ];

}


