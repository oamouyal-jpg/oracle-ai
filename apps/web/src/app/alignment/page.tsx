"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, Target, AlertTriangle, TrendingUp } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { QuickCheckIn } from "@/components/alignment/QuickCheckIn";
import { api, type AlignmentDashboard } from "@/lib/api";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { localizeMissionTitle } from "@/lib/i18n/localizeContent";

export default function AlignmentPage() {
  const { t, locale } = useLocale();
  const [data, setData] = useState<AlignmentDashboard | null>(null);

  const load = () => api.alignment().then(setData).catch(console.error);

  useEffect(() => {
    load();
  }, [locale]);

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-zinc-500">
        {t("alignment.loading")}
      </div>
    );
  }

  const { alignment, missions, patterns, frictionInsights, isLifeMovingForward } = data;

  return (
    <div className="space-y-8 max-w-4xl">
      <header>
        <p className="text-xs uppercase tracking-[0.25em] text-indigo-400 mb-2">
          {t("alignment.engineLabel")}
        </p>
        <h1 className="text-3xl font-light text-zinc-50 glow-text">{t("alignment.headline")}</h1>
        <p className="text-zinc-500 mt-2">{t("alignment.tagline")}</p>
      </header>

      <GlassCard glow className="border-indigo-500/30">
        <div className="flex flex-wrap items-center gap-8">
          <ProgressRing
            value={alignment.alignmentScore}
            size={100}
            color={isLifeMovingForward ? "#22c55e" : "#f59e0b"}
            label={`${alignment.alignmentScore}`}
          />
          <div className="flex-1 min-w-[200px]">
            <p
              className={`text-lg font-medium ${
                isLifeMovingForward ? "text-emerald-300" : "text-amber-300"
              }`}
            >
              {isLifeMovingForward
                ? t("alignment.movingForward")
                : t("alignment.needsAttention")}
            </p>
            {alignment.aiAssessment && (
              <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
                {alignment.aiAssessment}
              </p>
            )}
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label={t("alignment.meaningfulProgress")} value={alignment.meaningfulProgress} />
        <Metric label={t("alignment.execution")} value={alignment.executionConsistency} />
        <Metric label={t("alignment.emotionalStability")} value={alignment.emotionalStability} />
        <Metric label={t("alignment.overload")} value={alignment.overloadScore} warn />
      </div>

      <QuickCheckIn onSubmitted={load} />

      <GlassCard>
        <h2 className="text-sm uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" /> {t("alignment.missionMomentum")}
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {missions.map((m) => (
            <Link
              key={m.id}
              href={`/missions/${m.id}`}
              className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-indigo-500/30 transition"
            >
              <p className="text-sm text-zinc-200 font-medium">
                {localizeMissionTitle(m.title, locale)}
              </p>
              <div className="flex gap-4 mt-3 text-center">
                <MiniScore label={t("alignment.momentum")} value={m.momentumScore} />
                <MiniScore label={t("alignment.stable")} value={m.stabilityScore} />
                <MiniScore label={t("alignment.resistance")} value={m.resistanceScore} />
              </div>
            </Link>
          ))}
        </div>
      </GlassCard>

      {alignment.recommendations.length > 0 && (
        <GlassCard>
          <h2 className="text-sm uppercase tracking-widest text-indigo-400 mb-3">
            {t("alignment.recommendations")}
          </h2>
          <ul className="space-y-2">
            {alignment.recommendations.map((r) => (
              <li key={r} className="text-sm text-zinc-300 pl-3 border-l-2 border-indigo-500/40">
                {r}
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      {frictionInsights.length > 0 && (
        <GlassCard className="border-amber-500/20">
          <h2 className="text-sm uppercase tracking-widest text-amber-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> {t("alignment.friction")}
          </h2>
          <ul className="text-sm text-amber-200/80 space-y-2">
            {frictionInsights.map((f) => (
              <li key={f}>· {f}</li>
            ))}
          </ul>
        </GlassCard>
      )}

      {patterns.length > 0 && (
        <GlassCard>
          <h2 className="text-sm uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4" /> {t("alignment.patterns")}
          </h2>
          <ul className="text-sm text-zinc-400 space-y-2">
            {patterns.map((p) => (
              <li key={p}>· {p}</li>
            ))}
          </ul>
        </GlassCard>
      )}

      <Link
        href="/missions"
        className="inline-flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300"
      >
        <Target className="h-4 w-4" /> {t("alignment.openMissions")}
      </Link>
    </div>
  );
}

function Metric({
  label,
  value,
  warn,
}: {
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <GlassCard className="py-3 text-center">
      <p
        className={`text-2xl font-light ${warn && value > 60 ? "text-amber-400" : "text-zinc-100"}`}
      >
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-widest text-zinc-600 mt-1">{label}</p>
    </GlassCard>
  );
}

function MiniScore({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-lg text-cyan-300">{value}</p>
      <p className="text-[9px] uppercase text-zinc-600">{label}</p>
    </div>
  );
}
