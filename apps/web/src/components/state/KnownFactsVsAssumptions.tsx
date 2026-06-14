"use client";

import { GlassCard } from "@/components/ui/GlassCard";

type KnownFactsVsAssumptionsProps = {
  knownFacts: string[];
  assumptions: string[];
  t: (key: string) => string;
};

export function KnownFactsVsAssumptions({ knownFacts, assumptions, t }: KnownFactsVsAssumptionsProps) {
  if (knownFacts.length === 0 && assumptions.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {knownFacts.length > 0 ? (
        <GlassCard className="border-sky-500/20">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-400/90">
            {t("stateCheck.knownFacts")}
          </p>
          <ul className="mt-3 space-y-2">
            {knownFacts.map((fact) => (
              <li key={fact} className="text-sm text-zinc-300 leading-relaxed">
                • {fact}
              </li>
            ))}
          </ul>
        </GlassCard>
      ) : null}
      {assumptions.length > 0 ? (
        <GlassCard className="border-rose-500/20">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-400/90">
            {t("stateCheck.assumptions")}
          </p>
          <ul className="mt-3 space-y-2">
            {assumptions.map((item) => (
              <li key={item} className="text-sm text-zinc-400 leading-relaxed">
                • {item}
              </li>
            ))}
          </ul>
        </GlassCard>
      ) : null}
    </div>
  );
}
