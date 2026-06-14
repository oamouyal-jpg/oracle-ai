"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { VoiceTextarea } from "@/components/speech/VoiceTextarea";
import { CurrentStateCard } from "@/components/state/CurrentStateCard";
import { PatternMatchCard } from "@/components/state/PatternMatchCard";
import { NextSafeActionCard } from "@/components/state/NextSafeActionCard";
import { ValuesCheckCard } from "@/components/state/ValuesCheckCard";
import { KnownFactsVsAssumptions } from "@/components/state/KnownFactsVsAssumptions";
import { api, type StateDetectionResult, type StateSnapshot } from "@/lib/api";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export default function StateCheckPage() {
  const { t } = useLocale();
  const [rawInput, setRawInput] = useState("");
  const [result, setResult] = useState<StateDetectionResult | null>(null);
  const [history, setHistory] = useState<StateSnapshot[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(() => {
    return api.stateSnapshots(8).then(setHistory).catch(() => undefined);
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const submit = async () => {
    if (rawInput.trim().length < 8) return;
    setBusy(true);
    setError(null);
    try {
      const detection = await api.runStateCheck({ rawInput: rawInput.trim() });
      setResult(detection);
      setRawInput("");
      await loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.couldNotCreate"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      <header>
        <h1 className="text-2xl font-light text-zinc-50 glow-text">{t("stateCheck.title")}</h1>
        <p className="mt-2 text-sm text-zinc-500">{t("stateCheck.subtitle")}</p>
      </header>

      <GlassCard glow className="space-y-4">
        <p className="text-xs text-zinc-500">{t("stateCheck.promptHint")}</p>
        <VoiceTextarea
          value={rawInput}
          onChange={setRawInput}
          placeholder={t("stateCheck.placeholder")}
          rows={5}
          disabled={busy}
          className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500/40"
        />
        <button
          type="button"
          disabled={busy || rawInput.trim().length < 8}
          onClick={() => void submit()}
          className="w-full rounded-xl bg-violet-500/35 py-2.5 text-sm text-violet-50 disabled:opacity-40"
        >
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("stateCheck.analyzing")}
            </span>
          ) : (
            t("stateCheck.submit")
          )}
        </button>
      </GlassCard>

      {error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200/90">{error}</p>
      ) : null}

      {result ? (
        <div className="space-y-4">
          <CurrentStateCard snapshot={result.snapshot} t={t} />
          <KnownFactsVsAssumptions
            knownFacts={result.snapshot.knownFacts}
            assumptions={result.snapshot.assumptions}
            t={t}
          />
          {result.pattern ? <PatternMatchCard pattern={result.pattern} t={t} /> : null}
          <ValuesCheckCard
            currentImpulse={result.snapshot.currentImpulse}
            stableValueConflict={result.snapshot.stableValueConflict}
            valuesAligned={result.snapshot.valuesAligned}
            stableValueName={result.stableValues[0]?.valueName}
            t={t}
          />
          <NextSafeActionCard action={result.snapshot.suggestedAction} t={t} />
          {result.snapshot.triggers.length > 0 ? (
            <GlassCard>
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">{t("stateCheck.triggersDetected")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {result.snapshot.triggers.map((trigger) => (
                  <span
                    key={trigger}
                    className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-400"
                  >
                    {trigger}
                  </span>
                ))}
              </div>
            </GlassCard>
          ) : null}
        </div>
      ) : null}

      {history.length > 0 ? (
        <div className="space-y-3 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {t("stateCheck.recentChecks")}
          </p>
          {history.map((snap) => (
            <GlassCard key={snap.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-zinc-200">
                    {snap.detectedStateLabel ?? snap.detectedState}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{snap.rawInput}</p>
                </div>
                <div className="text-right text-[10px] text-zinc-600 shrink-0">
                  <p>{t("stateCheck.risk")} {snap.decisionRisk}/10</p>
                  {snap.delayMajorDecisions ? (
                    <p className="text-amber-400/80">{t("stateCheck.delayed")}</p>
                  ) : null}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      ) : null}
    </div>
  );
}
