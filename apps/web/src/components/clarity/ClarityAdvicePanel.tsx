"use client";

import { useRef, useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { VoiceTextarea, type VoiceTextareaHandle } from "@/components/speech/VoiceTextarea";
import { SpeakButton } from "@/components/speech/SpeakButton";
import { api, type ClarityStep } from "@/lib/api";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type ClarityAdvicePanelProps = {
  issueId: string;
  step: ClarityStep | null;
  mission?: { id: string; title: string } | null;
  disabled?: boolean;
};

export function ClarityAdvicePanel({
  issueId,
  step,
  mission,
  disabled,
}: ClarityAdvicePanelProps) {
  const { t, speechLang } = useLocale();
  const voiceRef = useRef<VoiceTextareaHandle>(null);
  const [question, setQuestion] = useState("");
  const [advice, setAdvice] = useState<string | null>(null);
  const [scopeLabel, setScopeLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!step && !mission) return null;

  const ask = async () => {
    if (!question.trim() || loading) return;
    voiceRef.current?.stopListening();
    setLoading(true);
    setError(null);
    try {
      const result = await api.clarityAdvice(issueId, {
        question: question.trim(),
        stepId: step?.id,
        taskId: step?.linkedTaskId ?? undefined,
        missionId: mission?.id,
      });
      setAdvice(result.advice);
      setScopeLabel(result.scopeLabel);
      setQuestion("");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.couldNotCreate"));
    } finally {
      setLoading(false);
    }
  };

  const scopeParts = [
    step ? `${t("clarity.adviceScopeStep")}: ${step.title}` : null,
    mission ? `${t("clarity.adviceScopeMission")}: ${mission.title}` : null,
  ].filter(Boolean);

  return (
    <GlassCard className="space-y-3 border-cyan-500/20 bg-cyan-950/10">
      <div className="flex items-center gap-2 text-cyan-300">
        <MessageCircle className="h-4 w-4 shrink-0" />
        <p className="text-xs font-semibold uppercase tracking-wider">
          {t("clarity.askAdvice")}
        </p>
      </div>
      {scopeParts.length > 0 ? (
        <p className="text-[11px] text-zinc-500">{scopeParts.join(" · ")}</p>
      ) : null}
      <VoiceTextarea
        ref={voiceRef}
        value={question}
        onChange={setQuestion}
        placeholder={t("clarity.advicePlaceholder")}
        rows={3}
        disabled={disabled || loading}
        className="resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none"
      />
      <button
        type="button"
        disabled={disabled || loading || !question.trim()}
        onClick={() => void ask()}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/15 py-2.5 text-sm text-cyan-100 disabled:opacity-40"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {loading ? t("clarity.adviceLoading") : t("clarity.adviceSubmit")}
      </button>
      {error ? <p className="text-xs text-rose-300/90">{error}</p> : null}
      {advice ? (
        <div className="rounded-xl border border-cyan-500/15 bg-black/25 p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-wider text-cyan-400/80">
              {scopeLabel ?? t("clarity.adviceTitle")}
            </p>
            <SpeakButton
              text={advice}
              label={t("common.listen")}
              stopLabel={t("speech.stopSpeaking")}
              lang={speechLang}
            />
          </div>
          <p className="text-sm leading-relaxed text-zinc-200 whitespace-pre-wrap">{advice}</p>
        </div>
      ) : null}
    </GlassCard>
  );
}
