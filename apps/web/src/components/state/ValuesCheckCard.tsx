"use client";

import { Scale } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

type ValuesCheckCardProps = {
  currentImpulse: string | null;
  stableValueConflict: string | null;
  valuesAligned: boolean | null;
  stableValueName?: string;
  t: (key: string) => string;
};

export function ValuesCheckCard({
  currentImpulse,
  stableValueConflict,
  valuesAligned,
  stableValueName,
  t,
}: ValuesCheckCardProps) {
  if (!currentImpulse && !stableValueConflict) return null;

  return (
    <GlassCard className="space-y-4 border-amber-500/20">
      <div className="flex items-center gap-2 text-amber-300">
        <Scale className="h-4 w-4" />
        <p className="text-xs font-semibold uppercase tracking-wider">{t("stateCheck.valuesCheck")}</p>
      </div>
      {currentImpulse ? (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">{t("stateCheck.currentImpulse")}</p>
          <p className="mt-1 text-sm text-zinc-200">{currentImpulse}</p>
        </div>
      ) : null}
      {stableValueConflict || stableValueName ? (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">{t("stateCheck.stableValue")}</p>
          <p className="mt-1 text-sm text-amber-100/90">{stableValueConflict ?? stableValueName}</p>
        </div>
      ) : null}
      {valuesAligned !== null && valuesAligned !== undefined ? (
        <p className={`text-sm font-medium ${valuesAligned ? "text-emerald-300" : "text-rose-300"}`}>
          {valuesAligned ? t("stateCheck.valuesAligned") : t("stateCheck.valuesMisaligned")}
        </p>
      ) : null}
    </GlassCard>
  );
}
