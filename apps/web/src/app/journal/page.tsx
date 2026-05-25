"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { SpeechInputButton } from "@/components/speech/SpeechInputButton";
import { api, type JournalEntry } from "@/lib/api";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export default function JournalPage() {
  const { t, speechLang } = useLocale();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [content, setContent] = useState("");
  const [mood, setMood] = useState(5);

  const load = () => api.journal().then(setEntries).catch(console.error);

  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    if (!content.trim()) return;
    await api.createJournal({ content: content.trim(), mood });
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
        <div className="flex gap-2 items-start mt-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            placeholder={t("journal.placeholder")}
            className="flex-1 rounded-xl bg-white/5 border border-white/10 p-4 text-zinc-100 placeholder:text-zinc-600 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
          />
          <SpeechInputButton
            className="h-10 w-10 shrink-0 rounded-xl"
            lang={speechLang}
            onTranscript={(chunk, isFinal) => {
              if (!chunk) return;
              setContent((prev) => {
                const base = prev.replace(/\s*\[…\]$/, "").trimEnd();
                if (!isFinal) return `${base}${base ? " " : ""}${chunk} […]`;
                return `${base}${base ? " " : ""}${chunk}`;
              });
            }}
          />
        </div>
        <button
          type="button"
          onClick={submit}
          className="mt-4 px-6 py-2 rounded-xl bg-indigo-500/30 border border-indigo-400/40 text-indigo-100 text-sm"
        >
          {t("journal.saveEntry")}
        </button>
      </GlassCard>

      <div className="space-y-4">
        {entries.map((e) => (
          <GlassCard key={e.id}>
            <div className="flex justify-between text-xs text-zinc-500 mb-2">
              <span>{new Date(e.createdAt).toLocaleString()}</span>
              {e.mood != null && (
                <span>{t("journal.moodEntry", { n: e.mood })}</span>
              )}
            </div>
            <p className="text-sm text-zinc-300 whitespace-pre-wrap">{e.content}</p>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
