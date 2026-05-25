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
    return `IMPORTANT: The user's interface language is Hebrew. Write ALL user-facing text (analysis, guidance, reports, recommendations, JSON string values meant for the user) in modern Israeli Hebrew. Keep JSON keys in English. Be natural and clear in Hebrew.`;
  }
  if (locale === "fr") {
    return `IMPORTANT: The user's interface language is French. Write ALL user-facing text (analysis, guidance, reports, recommendations, JSON string values meant for the user) in clear modern French. Keep JSON keys in English. Use natural French phrasing.`;
  }
  return "Write user-facing text in English.";
}
