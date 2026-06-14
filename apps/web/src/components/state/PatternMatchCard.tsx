"use client";

import { GitBranch } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import type { UserPattern } from "@/lib/api";

type PatternMatchCardProps = {
  pattern: UserPattern;
  t: (key: string) => string;
};

export function PatternMatchCard({ pattern, t }: PatternMatchCardProps) {
  return (
    <GlassCard className="space-y-3 border-indigo-500/20">
      <div className="flex items-center gap-2 text-indigo-300">
        <GitBranch className="h-4 w-4" />
        <p className="text-xs font-semibold uppercase tracking-wider">{t("stateCheck.patternMatch")}</p>
      </div>
      <p className="text-sm text-zinc-200">
        {t("stateCheck.patternIntro")} <span className="text-indigo-200">{pattern.patternName}</span>.
      </p>
      {pattern.description ? (
        <p className="text-sm text-zinc-400">{pattern.description}</p>
      ) : null}
      {pattern.knownTriggers.length > 0 ? (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">{t("stateCheck.knownTriggers")}</p>
          <ul className="mt-1 space-y-1">
            {pattern.knownTriggers.slice(0, 4).map((trigger) => (
              <li key={trigger} className="text-sm text-zinc-400">• {trigger}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {pattern.typicalBehaviors.length > 0 ? (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">{t("stateCheck.commonBehavior")}</p>
          <p className="mt-1 text-sm text-zinc-400">{pattern.typicalBehaviors[0]}</p>
        </div>
      ) : null}
      {pattern.helpfulInterventions.length > 0 ? (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-emerald-400/80">{t("stateCheck.whatHelpedBefore")}</p>
          <p className="mt-1 text-sm text-emerald-100/90">{pattern.helpfulInterventions[0]}</p>
        </div>
      ) : null}
    </GlassCard>
  );
}
