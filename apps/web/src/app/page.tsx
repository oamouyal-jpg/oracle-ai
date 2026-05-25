"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, AlertTriangle } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { QuickCheckIn } from "@/components/alignment/QuickCheckIn";
import { api, type DashboardData } from "@/lib/api";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { localizeMissionTitle } from "@/lib/i18n/localizeContent";

export default function CommandCenter() {
  const { t, locale } = useLocale();
  const [data, setData] = useState<DashboardData | null>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    Promise.all([api.dashboard(), api.insights()])
      .then(([d, i]) => {
        setData(d);
        setInsights([
          ...(d.alignmentRecommendations ?? []),
          ...(d.frictionInsights ?? []),
          ...i.proactivePrompts,
        ]);
      })
      .catch(() => setError(t("common.connectApiError")));
  }, [refreshKey, locale]);

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t("dashboard.title")}
          subtitle={t("dashboard.subtitle")}
        />
        <GlassCard className="border-amber-500/30">
          <p className="text-amber-200/90">{error}</p>
          <p className="text-sm text-zinc-500 mt-2">{t("common.setupHint")}</p>
        </GlassCard>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-indigo-300 text-sm tracking-widest uppercase"
        >
          {t("common.loading")}
        </motion.div>
      </div>
    );
  }

  const { stats, missions, topTasks, briefing, stressAreas, lifeMap } = data;

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("dashboard.title")}
        subtitle={t("dashboard.subtitleOverview")}
        action={
          <Link
            href="/briefing"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-200 text-sm hover:bg-indigo-500/30 transition"
          >
            <Sparkles className="h-4 w-4" />
            {t("dashboard.dailyBriefing")}
          </Link>
        }
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="grid grid-cols-2 md:grid-cols-5 gap-4"
      >
        <StatCard
          label={t("dashboard.lifeAlignment")}
          value={stats.alignmentScore != null ? `${stats.alignmentScore}` : t("common.dash")}
        />
        <StatCard label={t("dashboard.activeMissions")} value={stats.activeMissions} />
        <StatCard label={t("dashboard.pendingTasks")} value={stats.pendingTasks} />
        <StatCard label={t("dashboard.doneToday")} value={stats.completedToday} />
        <StatCard label={t("dashboard.momentum")} value={`${stats.momentum}%`} />
      </motion.div>

      <QuickCheckIn onSubmitted={() => setRefreshKey((k) => k + 1)} />

      {stats.isLifeMovingForward === false && (
        <GlassCard className="border-amber-500/25">
          <p className="text-sm text-amber-200/90">
            {t("dashboard.alignmentStalling")}{" "}
            <Link href="/alignment" className="text-amber-300 underline">
              {t("dashboard.viewAlignment")}
            </Link>
          </p>
        </GlassCard>
      )}

      {briefing?.strategicGuidance && (
        <GlassCard glow delay={0.1}>
          <p className="text-xs uppercase tracking-widest text-indigo-400 mb-2">
            {t("dashboard.oracleGuidance")}
          </p>
          <p className="text-lg text-zinc-100 leading-relaxed glow-text">
            {briefing.strategicGuidance}
          </p>
        </GlassCard>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <GlassCard className="lg:col-span-2" delay={0.15}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-zinc-300 uppercase tracking-wider">
              {t("dashboard.activeMissions")}
            </h2>
            <Link
              href="/missions"
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              {t("common.viewAll")} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <motion.div className="space-y-3">
            {missions.map((m) => (
              <Link key={m.id} href={`/missions`}>
                <div className="group rounded-xl p-4 bg-white/[0.02] border border-white/5 hover:border-indigo-500/30 transition">
                  <motion.div className="flex justify-between items-start gap-4">
                    <div>
                      <p className="font-medium text-zinc-100">
                        {localizeMissionTitle(m.title, locale)}
                      </p>
                      {m.domain && (
                        <p className="text-xs text-zinc-500 mt-0.5">{m.domain.name}</p>
                      )}
                    </div>
                    <ProgressRing
                      value={m.progress}
                      size={48}
                      stroke={3}
                      color={m.domain?.color ?? "#6366f1"}
                    />
                  </motion.div>
                  <div className="mt-2 h-1 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all"
                      style={{ width: `${m.progress}%` }}
                    />
                  </div>
                </div>
              </Link>
            ))}
          </motion.div>
        </GlassCard>

        <GlassCard delay={0.2}>
          <h2 className="text-sm font-medium text-zinc-300 uppercase tracking-wider mb-4">
            {t("dashboard.priorityActions")}
          </h2>
          <ul className="space-y-2">
            {topTasks.slice(0, 6).map((task) => (
              <li
                key={task.id}
                className="text-sm text-zinc-300 py-2 border-b border-white/5 last:border-0 flex justify-between gap-2"
              >
                <span className="truncate">{task.title}</span>
                <span className="text-indigo-400 shrink-0">{task.priority}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/tasks"
            className="mt-4 block text-center text-xs text-cyan-400 hover:text-cyan-300"
          >
            {t("dashboard.manageTasks")}
          </Link>
        </GlassCard>
      </div>

      {insights.length > 0 && (
        <GlassCard delay={0.25}>
          <h2 className="text-sm font-medium text-zinc-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            {t("dashboard.strategicPrompts")}
          </h2>
          <ul className="space-y-2">
            {insights.slice(0, 4).map((p, i) => (
              <li key={i} className="text-sm text-zinc-400 pl-4 border-l-2 border-indigo-500/40">
                {p}
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      {stressAreas.length > 0 && (
        <GlassCard className="border-amber-500/20" delay={0.3}>
          <h2 className="text-sm font-medium text-amber-200/80 uppercase tracking-wider mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {t("dashboard.stressAreas")}
          </h2>
          <p className="text-sm text-zinc-400">{stressAreas.join(" · ")}</p>
        </GlassCard>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Link href="/debrief">
          <GlassCard className="hover:border-indigo-500/40 transition cursor-pointer h-full">
            <p className="text-indigo-300 text-xs uppercase tracking-widest">
              {t("dashboard.tonight")}
            </p>
            <p className="text-xl font-light text-zinc-100 mt-1">
              {t("dashboard.nightDebrief")}
            </p>
            <p className="text-sm text-zinc-500 mt-2">{t("dashboard.nightDebriefDesc")}</p>
          </GlassCard>
        </Link>
        <Link href="/execute">
          <GlassCard className="hover:border-cyan-500/40 transition cursor-pointer h-full">
            <p className="text-cyan-300 text-xs uppercase tracking-widest">
              {t("dashboard.focus")}
            </p>
            <p className="text-xl font-light text-zinc-100 mt-1">
              {t("dashboard.executionMode")}
            </p>
            <p className="text-sm text-zinc-500 mt-2">{t("dashboard.executionModeDesc")}</p>
          </GlassCard>
        </Link>
      </div>

      <GlassCard delay={0.35}>
        <h2 className="text-sm font-medium text-zinc-300 uppercase tracking-wider mb-4">
          {t("dashboard.domainHealth")}
        </h2>
        <div className="flex flex-wrap gap-4">
          {lifeMap.domainHealth.map((d) => (
            <motion.div key={d.name} className="flex flex-col items-center gap-1">
              <ProgressRing value={d.progress} size={56} color={d.color} />
              <span className="text-xs text-zinc-500">{d.name}</span>
            </motion.div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-light text-zinc-50 tracking-tight glow-text">{title}</h1>
        <p className="text-zinc-500 mt-1">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <GlassCard>
      <p className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="text-2xl font-light text-zinc-100 mt-1">{value}</p>
    </GlassCard>
  );
}
