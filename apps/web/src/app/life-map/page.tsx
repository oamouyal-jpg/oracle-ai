"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { api, type DashboardData } from "@/lib/api";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { localizeMissionTitle } from "@/lib/i18n/localizeContent";

export default function LifeMapPage() {
  const { t, locale } = useLocale();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api.dashboard().then(setData).catch(console.error);
  }, [locale]);

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-zinc-500">
        {t("lifeMap.loading")}
      </div>
    );
  }

  const { lifeMap, stats, stressAreas, emotionalTrend } = data;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-light text-zinc-50 glow-text">{t("lifeMap.title")}</h1>
        <p className="text-zinc-500 mt-1">{t("lifeMap.vizSubtitle")}</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Metric label={t("lifeMap.momentum")} value={`${stats.momentum}%`} />
        <Metric label={t("lifeMap.missions")} value={stats.activeMissions} />
        <Metric label={t("lifeMap.tasks")} value={stats.pendingTasks} />
        <Metric label={t("lifeMap.doneToday")} value={stats.completedToday} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <GlassCard glow className="min-h-[320px]">
          <h2 className="text-xs uppercase tracking-widest text-indigo-400 mb-6">
            {t("lifeMap.missionConstellation")}
          </h2>
          <div className="relative h-64 flex items-center justify-center">
            {lifeMap.missionStatus.map((m, i) => {
              const angle = (i / lifeMap.missionStatus.length) * Math.PI * 2 - Math.PI / 2;
              const r = 100;
              const x = Math.cos(angle) * r;
              const y = Math.sin(angle) * r;
              return (
                <div
                  key={m.id}
                  className="absolute flex flex-col items-center"
                  style={{ transform: `translate(${x}px, ${y}px)` }}
                >
                  <ProgressRing value={m.progress} size={48} stroke={3} />
                  <p className="text-[10px] text-zinc-500 mt-1 max-w-[80px] text-center truncate">
                    {localizeMissionTitle(m.title, locale).split(" ").slice(0, 3).join(" ")}
                  </p>
                </div>
              );
            })}
            <div className="w-16 h-16 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-xs text-indigo-300">
              {t("common.youCenter")}
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className="text-xs uppercase tracking-widest text-cyan-400 mb-6">
            {t("lifeMap.domainHealth")}
          </h2>
          <div className="grid grid-cols-3 gap-6">
            {lifeMap.domainHealth.map((d) => (
              <div key={d.name} className="flex flex-col items-center">
                <ProgressRing value={d.progress} size={64} color={d.color} />
                <span className="text-xs text-zinc-500 mt-2">{d.name}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {stressAreas.length > 0 && (
        <GlassCard className="border-amber-500/20">
          <h2 className="text-xs uppercase text-amber-400 mb-2">{t("lifeMap.stressVectors")}</h2>
          <p className="text-zinc-400">{stressAreas.join(" · ")}</p>
        </GlassCard>
      )}

      {emotionalTrend && emotionalTrend.length > 0 && (
        <GlassCard>
          <h2 className="text-xs uppercase tracking-widest text-zinc-500 mb-4">
            {t("lifeMap.emotionalTrend")}
          </h2>
          <div className="flex items-end gap-2 h-24">
            {emotionalTrend.map((e, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-gradient-to-t from-indigo-600/40 to-indigo-400/80"
                style={{ height: `${(e.level / 100) * 100}%`, minHeight: 4 }}
                title={new Date(e.date).toLocaleDateString()}
              />
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <GlassCard>
      <p className="text-[10px] uppercase tracking-widest text-zinc-600">{label}</p>
      <p className="text-2xl font-light text-zinc-100 mt-1">{value}</p>
    </GlassCard>
  );
}
