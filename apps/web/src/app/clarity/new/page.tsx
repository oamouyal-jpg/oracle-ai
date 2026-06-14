"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { SpeechInputButton } from "@/components/speech/SpeechInputButton";
import { api } from "@/lib/api";
import { appendVoiceTranscript } from "@/hooks/useSpeech";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export default function NewClarityIssuePage() {
  const { t, speechLang } = useLocale();
  const router = useRouter();
  const [rawInput, setRawInput] = useState("");
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (rawInput.trim().length < 12) return;
    setLoading(true);
    setError(null);
    try {
      const issue = await api.createClarityIssue({ rawInput: rawInput.trim() });
      router.push(`/clarity/${issue.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.couldNotCreate"));
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/clarity"
        className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("clarity.title")}
      </Link>

      <header>
        <h1 className="text-2xl font-light text-zinc-50 glow-text">{t("clarity.newIssue")}</h1>
        <p className="mt-2 text-sm text-zinc-500">{t("clarity.subtitle")}</p>
      </header>

      <GlassCard glow className="space-y-4">
        <div className="flex gap-2 items-start">
          <textarea
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder={listening ? t("chat.listening") : t("clarity.brainDumpPlaceholder")}
            rows={10}
            disabled={loading}
            className="min-h-[240px] flex-1 resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-base leading-relaxed text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-indigo-400/40"
          />
          <SpeechInputButton
            className="h-10 w-10 shrink-0 rounded-xl"
            lang={speechLang}
            title={t("speech.voiceInput")}
            disabled={loading}
            onTranscript={(chunk, isFinal) => {
              setListening(!isFinal);
              setRawInput((prev) => appendVoiceTranscript(prev, chunk, isFinal));
            }}
          />
        </div>
        {error ? <p className="text-sm text-rose-300/90">{error}</p> : null}
        <button
          type="button"
          disabled={loading || rawInput.trim().length < 12}
          onClick={() => void submit()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500/40 py-3 text-sm font-medium text-indigo-50 disabled:opacity-40"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("clarity.analyzing")}
            </>
          ) : (
            t("clarity.startClarity")
          )}
        </button>
      </GlassCard>
    </div>
  );
}
