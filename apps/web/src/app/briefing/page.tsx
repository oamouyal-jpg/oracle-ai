"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Sun } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { SpeakButton } from "@/components/speech/SpeakButton";
import { api, type Briefing } from "@/lib/api";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { localizeApiPhrase } from "@/lib/i18n/localizeContent";
import type { Locale } from "@/lib/i18n/messages";

const BRIEFING_LOCALE_KEY = "oracle-briefing-locale";

export default function BriefingPage() {
  const { t, speechLang, locale } = useLocale();
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const storedLocale = localStorage.getItem(BRIEFING_LOCALE_KEY);
    const fetchBriefing = async () => {
      try {
        const b =
          storedLocale === locale
            ? await api.briefingToday()
            : await api.regenerateBriefing();
        if (!cancelled) {
          setBriefing(b);
          localStorage.setItem(BRIEFING_LOCALE_KEY, locale);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchBriefing();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const regenerate = async () => {
    setLoading(true);
    try {
      const b = await api.regenerateBriefing();
      setBriefing(b);
      localStorage.setItem(BRIEFING_LOCALE_KEY, locale);
    } finally {
      setLoading(false);
    }
  };

  const narrative =
    localizeApiPhrase(briefing?.fullContent ?? briefing?.strategicGuidance ?? "", locale) ||
    briefing?.fullContent ||
    briefing?.strategicGuidance ||
    "";

  if (!briefing) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-zinc-500">
        {t("briefing.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400/80 text-xs uppercase tracking-widest mb-2">
            <Sun className="h-4 w-4" />
            {t("briefing.morningProtocol")}
          </div>
          <h1 className="text-3xl font-light text-zinc-50 glow-text">{t("briefing.title")}</h1>
        </div>
        <button
          type="button"
          onClick={regenerate}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 border border-white/10"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {t("common.refresh")}
        </button>
      </header>

      <GlassCard glow>
        <div className="flex justify-end mb-3">
          <SpeakButton text={narrative} label={t("briefing.readBriefing")} lang={speechLang} />
        </div>
        <p className="text-lg leading-relaxed text-zinc-100">{narrative}</p>
      </GlassCard>

      <Section
        title={t("briefing.topPriorities")}
        items={briefing.topPriorities}
        locale={locale}
      />
      <GlassCard>
        <h2 className="text-xs uppercase tracking-widest text-indigo-400 mb-2">
          {t("briefing.emotionalRead")}
        </h2>
        <p className="text-zinc-300">
          {localizeApiPhrase(briefing.emotionalObservation, locale)}
        </p>
      </GlassCard>
      <GlassCard>
        <h2 className="text-xs uppercase tracking-widest text-cyan-400 mb-2">
          {t("briefing.focus")}
        </h2>
        <p className="text-zinc-300">
          {localizeApiPhrase(briefing.focusRecommendation, locale)}
        </p>
      </GlassCard>
      <GlassCard>
        <h2 className="text-xs uppercase tracking-widest text-zinc-500 mb-2">
          {t("briefing.missionProgress")}
        </h2>
        <p className="text-zinc-300">
          {localizeApiPhrase(briefing.missionProgress, locale)}
        </p>
      </GlassCard>
      <Section title={t("briefing.reminders")} items={briefing.reminders} locale={locale} />
    </div>
  );
}

function Section({
  title,
  items,
  locale,
}: {
  title: string;
  items: string[];
  locale: Locale;
}) {
  return (
    <GlassCard>
      <h2 className="text-xs uppercase tracking-widest text-zinc-500 mb-3">{title}</h2>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="text-sm text-zinc-300 pl-3 border-l-2 border-indigo-500/40">
            {localizeApiPhrase(item, locale)}
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}
