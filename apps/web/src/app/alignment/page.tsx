"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Target,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  Brain,
  ArrowRight,
  Layers,
  Sparkles,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { QuickCheckIn } from "@/components/alignment/QuickCheckIn";
import { api, type AlignmentDashboard } from "@/lib/api";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { localizeApiPhrase, localizeMissionTitle } from "@/lib/i18n/localizeContent";

export default function AlignmentPage() {
  const { t, locale } = useLocale();
  const [data, setData] = useState<AlignmentDashboard | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = () => api.alignment().then(setData).catch(console.error);

  const refreshAnalysis = async () => {
    setRefreshing(true);
    try {
      const next = await api.recalculateAlignment();
      setData(next);
    } finally {
      setRefreshing(false);
    }
  };

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
  const plan = alignment.aiPlan;

  return (
    <div className="space-y-8 max-w-4xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-indigo-400 mb-2">
            {t("alignment.engineLabel")}
          </p>
          <h1 className="text-3xl font-light text-zinc-50 glow-text">{t("alignment.headline")}</h1>
          <p className="text-zinc-500 mt-2">{t("alignment.tagline")}</p>
        </div>
        <button
          type="button"
          onClick={refreshAnalysis}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-500/20 px-4 py-2 text-sm text-indigo-200 transition hover:bg-indigo-500/30 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? t("alignment.refreshing") : t("alignment.refreshAnalysis")}
        </button>
      </header>

      <Link href="/chat">
        <GlassCard glow className="border-indigo-500/30 transition hover:border-indigo-400/50 cursor-pointer">
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
              {(plan?.personalAnalysis || alignment.aiAssessment) && (
                <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
                  {localizeApiPhrase(
                    plan?.personalAnalysis ?? alignment.aiAssessment ?? "",
                    locale
                  )}
                </p>
              )}
              <p className="text-xs text-indigo-400 mt-3 flex items-center gap-1">
                {t("alignment.goToChat")} <ArrowRight className="h-3 w-3" />
              </p>
            </div>
          </div>
        </GlassCard>
      </Link>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric
          href="/missions"
          label={t("alignment.meaningfulProgress")}
          value={alignment.meaningfulProgress}
        />
        <Metric
          href="/tasks"
          label={t("alignment.execution")}
          value={alignment.executionConsistency}
        />
        <Metric
          href="/journal"
          label={t("alignment.emotionalStability")}
          value={alignment.emotionalStability}
        />
        <Metric
          href="/missions"
          label={t("alignment.overload")}
          value={alignment.overloadScore}
          warn
        />
      </div>

      {plan && (
        <div className="grid md:grid-cols-3 gap-4">
          <PlanCard
            title={t("alignment.progressActions")}
            icon={Target}
            items={plan.progressActions}
            href="/tasks"
            linkLabel={t("alignment.goToTasks")}
            locale={locale}
          />
          <PlanCard
            title={t("alignment.selfDevelopment")}
            icon={Brain}
            items={plan.selfDevelopment}
            href="/journal"
            linkLabel={t("alignment.goToJournal")}
            locale={locale}
          />
          <PlanCard
            title={t("alignment.structuralActions")}
            icon={Layers}
            items={plan.structuralActions}
            href="/debrief"
            linkLabel={t("alignment.goToDebrief")}
            locale={locale}
          />
        </div>
      )}

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
        <Link href="/tasks">
          <GlassCard className="transition hover:border-indigo-500/40 cursor-pointer h-full">
            <h2 className="text-sm uppercase tracking-widest text-indigo-400 mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              {t("alignment.recommendations")}
            </h2>
            <ul className="space-y-2">
              {alignment.recommendations.map((r) => (
                <li key={r} className="text-sm text-zinc-300 pl-3 border-l-2 border-indigo-500/40">
                  {localizeApiPhrase(r, locale)}
                </li>
              ))}
            </ul>
          </GlassCard>
        </Link>
      )}

      {frictionInsights.length > 0 && (
        <Link href="/tasks">
          <GlassCard className="border-amber-500/20 transition hover:border-amber-500/40 cursor-pointer">
            <h2 className="text-sm uppercase tracking-widest text-amber-400 mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> {t("alignment.friction")}
            </h2>
            <ul className="text-sm text-amber-200/80 space-y-2">
              {frictionInsights.map((f) => (
                <li key={f}>· {localizeApiPhrase(f, locale)}</li>
              ))}
            </ul>
          </GlassCard>
        </Link>
      )}

      {patterns.length > 0 && (
        <Link href="/journal">
          <GlassCard className="transition hover:border-white/20 cursor-pointer">
            <h2 className="text-sm uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4" /> {t("alignment.patterns")}
            </h2>
            <ul className="text-sm text-zinc-400 space-y-2">
              {patterns.map((p) => (
                <li key={p}>· {localizeApiPhrase(p, locale)}</li>
              ))}
            </ul>
          </GlassCard>
        </Link>
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
  href,
}: {
  label: string;
  value: number;
  warn?: boolean;
  href: string;
}) {
  return (
    <Link href={href} className="block h-full">
      <GlassCard className="py-3 text-center h-full transition hover:border-indigo-500/40 hover:bg-white/[0.03] cursor-pointer">
        <p
          className={`text-2xl font-light ${warn && value > 60 ? "text-amber-400" : "text-zinc-100"}`}
        >
          {value}
        </p>
        <p className="text-[10px] uppercase tracking-widest text-zinc-600 mt-1">{label}</p>
      </GlassCard>
    </Link>
  );
}

function PlanCard({
  title,
  icon: Icon,
  items,
  href,
  linkLabel,
  locale,
}: {
  title: string;
  icon: typeof Target;
  items: string[];
  href: string;
  linkLabel: string;
  locale: import("@/lib/i18n/messages").Locale;
}) {
  return (
    <Link href={href} className="block h-full">
      <GlassCard className="h-full transition hover:border-indigo-500/40 hover:bg-white/[0.03] cursor-pointer">
        <h3 className="text-xs uppercase tracking-widest text-indigo-400 mb-3 flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
        </h3>
        <ul className="space-y-2 text-sm text-zinc-300">
          {items.map((item) => (
            <li key={item} className="pl-3 border-l-2 border-indigo-500/30">
              {localizeApiPhrase(item, locale)}
            </li>
          ))}
        </ul>
        <p className="text-xs text-indigo-400/80 mt-4 flex items-center gap-1">
          {linkLabel} <ArrowRight className="h-3 w-3" />
        </p>
      </GlassCard>
    </Link>
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
