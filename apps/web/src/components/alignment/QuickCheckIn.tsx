"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { VoiceTextarea } from "@/components/speech/VoiceTextarea";
import { SpeakButton } from "@/components/speech/SpeakButton";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export function QuickCheckIn({ onSubmitted }: { onSubmitted?: () => void }) {
  const { t, speechLang } = useLocale();
  const [text, setText] = useState("");
  const [mood, setMood] = useState(5);
  const [energy, setEnergy] = useState(5);
  const [loading, setLoading] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<string | null>(null);

  const submit = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    try {
      const { reflection } = await api.submitReflection(text.trim(), mood, energy);
      setLastAnalysis(reflection.aiAnalysis ?? null);
      setText("");
      onSubmitted?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassCard glow>
      <p className="text-xs uppercase tracking-widest text-indigo-400 mb-1">
        {t("reflection.title")}
      </p>
      <p className="text-sm text-zinc-500 mb-4">{t("reflection.subtitle")}</p>
      <VoiceTextarea
        value={text}
        onChange={setText}
        placeholder={t("reflection.placeholder")}
        rows={3}
        disabled={loading}
        className="rounded-xl glass p-4 text-sm text-zinc-100 placeholder:text-zinc-600 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
      />
      <div className="grid grid-cols-2 gap-4 mt-3">
        <label className="text-xs text-zinc-500">
          {t("reflection.moodLabel", { n: mood })}
          <input
            type="range"
            min={1}
            max={10}
            value={mood}
            onChange={(e) => setMood(Number(e.target.value))}
            className="w-full mt-1 accent-indigo-500"
          />
        </label>
        <label className="text-xs text-zinc-500">
          {t("reflection.energyLabel", { n: energy })}
          <input
            type="range"
            min={1}
            max={10}
            value={energy}
            onChange={(e) => setEnergy(Number(e.target.value))}
            className="w-full mt-1 accent-cyan-500"
          />
        </label>
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={loading || !text.trim()}
        className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-indigo-500/30 border border-indigo-400/40 text-indigo-100 text-sm disabled:opacity-50"
      >
        <Send className="h-4 w-4" />
        {loading ? "..." : t("reflection.logReflection")}
      </button>
      {lastAnalysis && (
        <div className="mt-4 border-t border-white/5 pt-3">
          <div className="flex justify-end mb-2">
            <SpeakButton
              text={lastAnalysis}
              label={t("reflection.readAnalysis")}
              lang={speechLang}
              stopLabel={t("common.stop")}
            />
          </div>
          <p className="text-sm text-indigo-200/90 leading-relaxed">{lastAnalysis}</p>
        </div>
      )}
    </GlassCard>
  );
}
