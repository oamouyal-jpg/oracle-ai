"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { VoiceTextarea } from "@/components/speech/VoiceTextarea";
import { CurrentStateCard } from "@/components/state/CurrentStateCard";
import { NextSafeActionCard } from "@/components/state/NextSafeActionCard";
import { api, type JournalEntryWithState, type StateDetectionResult } from "@/lib/api";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export default function JournalPage() {
  const { t } = useLocale();
  const [entries, setEntries] = useState<JournalEntryWithState[]>([]);
  const [content, setContent] = useState("");
  const [mood, setMood] = useState(5);
  const [lastState, setLastState] = useState<StateDetectionResult | null>(null);

  const load = () => api.journal().then(setEntries).catch(console.error);

  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    if (!content.trim()) return;
    const result = await api.createJournal({ content: content.trim(), mood, runStateDetection: true });
    setLastState(result.stateDetection);
    setContent("");
    load();
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <header>
        <h1 className="text-3xl font-light text-zinc-50 glow-text">{t("journal.title")}</h1>
        <p className="text-zinc-500 mt-1">{t("journal.subtitle")}</p>
      </header>

      <GlassCard>
        <label className="text-xs uppercase tracking-widest text-zinc-500">
          {t("journal.moodRange", { n: mood })}
        </label>
        <input
          type="range"
          min={1}
          max={10}
          value={mood}
          onChange={(e) => setMood(Number(e.target.value))}
          className="w-full mt-2 accent-indigo-500"
        />
        <VoiceTextarea
          value={content}
          onChange={setContent}
          rows={5}
          placeholder={t("journal.placeholder")}
          wrapperClassName="mt-4"
          className="rounded-xl bg-white/5 border border-white/10 p-4 text-zinc-100 placeholder:text-zinc-600 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
        />
        <button
          type="button"
          onClick={submit}
          className="mt-4 px-6 py-2 rounded-xl bg-indigo-500/30 border border-indigo-400/40 text-indigo-100 text-sm"
        >
          {t("journal.saveEntry")}
        </button>
      </GlassCard>

      {lastState ? (
        <div className="space-y-4">
          <CurrentStateCard snapshot={lastState.snapshot} t={t} />
          <NextSafeActionCard action={lastState.snapshot.suggestedAction} t={t} />
        </div>
      ) : null}

      <div className="space-y-4">
        {entries.map((e) => (
          <GlassCard key={e.id}>
            <div className="flex justify-between text-xs text-zinc-500 mb-2">
              <span>{new Date(e.createdAt).toLocaleString()}</span>
              <div className="flex gap-2">
                {e.latestState ? (
                  <span className="text-violet-400/90">
                    {e.latestState.detectedState.replace(/_/g, " ").toLowerCase()}
                  </span>
                ) : null}
                {e.mood != null && (
                  <span>{t("journal.moodEntry", { n: e.mood })}</span>
                )}
              </div>
            </div>
            <p className="text-sm text-zinc-300 whitespace-pre-wrap">{e.content}</p>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
