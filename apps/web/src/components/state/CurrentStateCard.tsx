"use client";

import { AlertTriangle, Activity } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import type { StateSnapshot } from "@/lib/api";

type CurrentStateCardProps = {
  snapshot: StateSnapshot;
  t: (key: string) => string;
};

export function CurrentStateCard({ snapshot, t }: CurrentStateCardProps) {
  const label =
    snapshot.detectedStateLabel ??
    snapshot.detectedState.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <GlassCard glow className="space-y-4 border-violet-500/25">
      <div className="flex items-center gap-2 text-violet-300">
        <Activity className="h-4 w-4" />
        <p className="text-xs font-semibold uppercase tracking-wider">{t("stateCheck.currentState")}</p>
      </div>
      <div>
        <p className="text-xl font-medium text-zinc-50">{label}</p>
        {snapshot.secondaryStateLabel ? (
          <p className="mt-1 text-sm text-zinc-500">
            + {snapshot.secondaryStateLabel}
          </p>
        ) : null}
      </div>
      {"stateConfidence" in snapshot && snapshot.stateConfidence ? (
        <p className="text-xs text-zinc-500">
          {t("stateCheck.confidence")}: {snapshot.stateConfidence}%
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Metric label={t("stateCheck.emotionalIntensity")} value={snapshot.emotionalIntensity} warn={snapshot.emotionalIntensity >= 7} />
        <Metric label={t("stateCheck.decisionRisk")} value={snapshot.decisionRisk} warn={snapshot.decisionRisk >= 7} />
      </div>
      {snapshot.aiReasoningSummary ? (
        <p className="text-sm leading-relaxed text-zinc-300">{snapshot.aiReasoningSummary}</p>
      ) : null}
      {snapshot.delayMajorDecisions ? (
        <div className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-950/30 px-3 py-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
          <p className="text-sm text-amber-100/90">
            {t("stateCheck.delayWarning").replace(
              "{hours}",
              String(snapshot.delayHours ?? 24)
            )}
          </p>
        </div>
      ) : null}
    </GlassCard>
  );
}

function Metric({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${warn ? "border-rose-500/30 bg-rose-950/20" : "border-white/10 bg-white/[0.02]"}`}>
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`text-lg font-medium ${warn ? "text-rose-200" : "text-zinc-200"}`}>{value}/10</p>
    </div>
  );
}
