"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Sun } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { SpeakButton } from "@/components/speech/SpeakButton";
import { api, type Briefing } from "@/lib/api";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export default function BriefingPage() {
  const { t, speechLang, locale } = useLocale();
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(false);

  const load = () => api.briefingToday().then(setBriefing).catch(console.error);

  useEffect(() => {
    load();
  }, [locale]);

  const regenerate = async () => {
    setLoading(true);
    try {
      const b = await api.regenerateBriefing();
      setBriefing(b);
    } finally {
      setLoading(false);
    }
  };

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
          <SpeakButton
            text={briefing.fullContent ?? briefing.strategicGuidance}
            label={t("briefing.readBriefing")}
            lang={speechLang}
          />
        </div>
        <p className="text-lg leading-relaxed text-zinc-100">
          {briefing.fullContent ?? briefing.strategicGuidance}
        </p>
      </GlassCard>

      <Section title={t("briefing.topPriorities")} items={briefing.topPriorities} />
      <GlassCard>
        <h2 className="text-xs uppercase tracking-widest text-indigo-400 mb-2">
          {t("briefing.emotionalRead")}
        </h2>
        <p className="text-zinc-300">{briefing.emotionalObservation}</p>
      </GlassCard>
      <GlassCard>
        <h2 className="text-xs uppercase tracking-widest text-cyan-400 mb-2">
          {t("briefing.focus")}
        </h2>
        <p className="text-zinc-300">{briefing.focusRecommendation}</p>
      </GlassCard>
      <GlassCard>
        <h2 className="text-xs uppercase tracking-widest text-zinc-500 mb-2">
          {t("briefing.missionProgress")}
        </h2>
        <p className="text-zinc-300">{briefing.missionProgress}</p>
      </GlassCard>
      <Section title={t("briefing.reminders")} items={briefing.reminders} />
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <GlassCard>
      <h2 className="text-xs uppercase tracking-widest text-zinc-500 mb-3">{title}</h2>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="text-sm text-zinc-300 pl-3 border-l-2 border-indigo-500/40">
            {item}
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}
