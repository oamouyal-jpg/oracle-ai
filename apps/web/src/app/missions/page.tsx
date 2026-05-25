"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, TrendingUp, Shield, Trash2 } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { api, checkApiHealth, type Mission, type CreateMissionInput } from "@/lib/api";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import {
  localizeDomainName,
  localizeMissionStatus,
  localizeMissionTitle,
} from "@/lib/i18n/localizeContent";

export default function MissionTrackerPage() {
  const { t, locale } = useLocale();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateMissionInput>({
    title: "",
    whyItMatters: "",
    desiredOutcome: "",
    missionType: "GENERAL",
  });

  const load = () =>
    api
      .missions()
      .then(setMissions)
      .catch((e) => {
        setCreateError(e instanceof Error ? e.message : t("common.couldNotLoad"));
      });

  useEffect(() => {
    checkApiHealth().then(setApiOnline);
    load();
  }, [locale]);

  const remove = async (id: string, title: string) => {
    if (!confirm(t("common.confirmDeleteMission", { title }))) return;
    setCreateError(null);
    try {
      await api.deleteMission(id);
      load();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : t("common.couldNotDelete"));
    }
  };

  const create = async () => {
    if (!form.title.trim()) return;
    setCreateError(null);
    try {
      await api.createMission({
        ...form,
        title: form.title.trim(),
        whyItMatters: form.whyItMatters?.trim() || undefined,
        desiredOutcome: form.desiredOutcome?.trim() || undefined,
      });
      setForm({
        title: "",
        whyItMatters: "",
        desiredOutcome: "",
        missionType: "GENERAL",
      });
      setShowCreate(false);
      load();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : t("common.couldNotCreate"));
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light text-zinc-50 glow-text">{t("missions.title")}</h1>
          <p className="text-zinc-500 mt-1">{t("missions.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/30 border border-indigo-400/40 text-indigo-100 text-sm"
        >
          <Plus className="h-4 w-4" />
          {t("missions.newMission")}
        </button>
      </header>

      {apiOnline === false && (
        <p className="text-sm text-amber-300 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
          {t("common.apiOffline")}
        </p>
      )}

      {showCreate && (
        <GlassCard glow>
          <h2 className="text-sm uppercase tracking-widest text-indigo-400 mb-4">
            {t("missions.createMission")}
          </h2>
          {createError && (
            <p className="text-sm text-amber-300 mb-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              {createError}
            </p>
          )}
          <div className="space-y-3">
            <input
              placeholder={t("missions.missionTitle")}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-xl glass px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
            />
            <textarea
              placeholder={t("missions.whyItMatters")}
              value={form.whyItMatters}
              onChange={(e) => setForm({ ...form, whyItMatters: e.target.value })}
              rows={2}
              className="w-full rounded-xl glass px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:outline-none resize-none"
            />
            <textarea
              placeholder={t("missions.desiredOutcome")}
              value={form.desiredOutcome}
              onChange={(e) => setForm({ ...form, desiredOutcome: e.target.value })}
              rows={2}
              className="w-full rounded-xl glass px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:outline-none resize-none"
            />
            <select
              value={form.missionType}
              onChange={(e) =>
                setForm({
                  ...form,
                  missionType: e.target.value as "GENERAL" | "TRADING",
                })
              }
              className="w-full rounded-xl glass px-4 py-3 text-zinc-100 bg-transparent focus:outline-none"
            >
              <option value="GENERAL">{t("common.general")}</option>
              <option value="TRADING">{t("common.trading")}</option>
            </select>
            <button
              type="button"
              onClick={create}
              className="px-6 py-2 rounded-xl bg-indigo-500/40 text-indigo-100 text-sm"
            >
              {t("common.create")}
            </button>
          </div>
        </GlassCard>
      )}

      <div className="grid gap-4">
        {missions.map((m, i) => (
          <GlassCard key={m.id} delay={i * 0.04} glow={m.missionType === "TRADING"}>
            <div className="flex flex-wrap gap-6 justify-between items-start">
              <Link href={`/missions/${m.id}`} className="flex-1 min-w-[200px]">
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {m.missionType === "TRADING" && (
                      <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                        <Shield className="h-3 w-3" /> {t("common.tradingBadge")}
                      </span>
                    )}
                    <span className="text-xs text-zinc-500">
                      {t("common.status")}: {localizeMissionStatus(m.status, locale)}
                    </span>
                  </div>
                  <h2 className="text-xl font-medium text-zinc-100">
                    {localizeMissionTitle(m.title, locale)}
                  </h2>
                  {(m.whyItMatters || m.purpose) && (
                    <p className="text-sm text-zinc-400 mt-2 line-clamp-2">
                      {m.whyItMatters ?? m.purpose}
                    </p>
                  )}
                  {m.nextActions && m.nextActions.length > 0 && (
                    <p className="text-xs text-indigo-300/80 mt-2">
                      {t("common.next")}: {m.nextActions[0]}
                    </p>
                  )}
                </div>
              </Link>
              <div className="flex items-center gap-3">
                <Link href={`/missions/${m.id}`} className="flex items-center gap-4">
                  <ProgressRing
                    value={m.progress}
                    size={56}
                    color={m.missionType === "TRADING" ? "#22d3ee" : "#6366f1"}
                  />
                  <TrendingUp className="h-5 w-5 text-zinc-600" />
                </Link>
                <button
                  type="button"
                  title={t("missions.deleteMission")}
                  onClick={() => void remove(m.id, m.title)}
                  className="p-2 rounded-lg text-zinc-600 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
