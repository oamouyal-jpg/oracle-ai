export type AppLocale = "en" | "he" | "fr";

export function parseLocale(header?: string | string[]): AppLocale {
  const raw = Array.isArray(header) ? header[0] : header;
  if (raw === "he" || raw === "he-IL") return "he";
  if (raw === "fr" || raw === "fr-FR") return "fr";
  return "en";
}

/** Appended to AI system prompts based on UI language. */
export function localeAiInstruction(locale: AppLocale): string {
  if (locale === "he") {
    return `IMPORTANT: The user's app is in Hebrew. Write ALL user-facing text in natural Israeli Hebrew — as a native speaker would say it, not translated from English. Short, clear sentences. Keep JSON keys in English. Avoid anglicisms and stiff literal phrasing (e.g. never "כוכב צפון", "יישור חיים", "מומנטום").`;
  }
  if (locale === "fr") {
    return `IMPORTANT: The user's app is in French. Write ALL user-facing text in natural modern French — as a native would write it, not word-for-word from English. Clear, direct tone. Keep JSON keys in English. Avoid stiff calques (e.g. not "étoile polaire", not "alignement de vie").`;
  }
  return "Write user-facing text in English.";
}
