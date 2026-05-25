"use client";

import { useEffect, useState, useCallback } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { api, type Mission, type Task } from "@/lib/api";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { localizeDomainName, localizeMissionTitle } from "@/lib/i18n/localizeContent";

const BLOCK_SECONDS = 20 * 60;

export default function ExecutePage() {
  const { t, locale } = useLocale();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [selectedMission, setSelectedMission] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(BLOCK_SECONDS);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    api.missions("ACTIVE").then(setMissions).catch(console.error);
  }, [locale]);

  useEffect(() => {
    if (!selectedMission) return;
    api.tasks({ missionId: selectedMission }).then((taskList) => {
      setTasks(taskList.filter((x) => x.status !== "COMPLETED"));
      setActiveTask(taskList.find((x) => x.status !== "COMPLETED") ?? null);
    });
  }, [selectedMission]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setRunning(false);
          return BLOCK_SECONDS;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const formatTime = useCallback((s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }, []);

  const mission = missions.find((m) => m.id === selectedMission);

  if (!selectedMission) {
    return (
      <div className="space-y-8 max-w-xl mx-auto text-center">
        <h1 className="text-3xl font-light text-zinc-50 glow-text">{t("execute.title")}</h1>
        <p className="text-zinc-500">{t("execute.pickSubtitle")}</p>
        <div className="space-y-3">
          {missions.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedMission(m.id)}
              className="w-full text-left p-4 rounded-2xl glass hover:border-cyan-500/40 transition border border-white/5"
            >
              <p className="text-zinc-100 font-medium">{localizeMissionTitle(m.title, locale)}</p>
              <p className="text-xs text-zinc-500 mt-1">
                {m.domain
                  ? localizeDomainName(m.domain.slug, m.domain.name, locale)
                  : ""}
              </p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center">
      <p className="text-xs uppercase tracking-[0.3em] text-cyan-400/80 mb-2">
        {t("execute.modeLabel")}
      </p>
      <h1 className="text-2xl font-light text-zinc-100 mb-8 text-center max-w-md">
        {mission ? localizeMissionTitle(mission.title, locale) : ""}
      </h1>

      <div className="text-7xl font-extralight text-cyan-300 tabular-nums mb-8 glow-text">
        {formatTime(secondsLeft)}
      </div>

      {activeTask && (
        <GlassCard className="max-w-md text-center mb-8">
          <p className="text-xs text-zinc-500 uppercase mb-2">{t("execute.currentBlock")}</p>
          <p className="text-lg text-zinc-100">{activeTask.title}</p>
        </GlassCard>
      )}

      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => setRunning(!running)}
          className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-100"
        >
          {running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          {running ? t("execute.pause") : t("execute.start")}
        </button>
        <button
          type="button"
          onClick={() => {
            setSecondsLeft(BLOCK_SECONDS);
            setRunning(false);
          }}
          className="p-3 rounded-2xl border border-white/10 text-zinc-400 hover:text-zinc-200"
          aria-label={t("execute.reset")}
        >
          <RotateCcw className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={async () => {
            if (activeTask) {
              await api.updateTask(activeTask.id, { status: "COMPLETED" });
              const next = tasks.find(
                (task) => task.id !== activeTask.id && task.status !== "COMPLETED"
              );
              setActiveTask(next ?? null);
            }
            setSecondsLeft(BLOCK_SECONDS);
          }}
          className="px-6 py-3 rounded-2xl border border-emerald-500/30 text-emerald-300 text-sm"
        >
          {t("execute.completeBlock")}
        </button>
      </div>

      <button
        type="button"
        onClick={() => setSelectedMission(null)}
        className="mt-12 text-sm text-zinc-600 hover:text-zinc-400"
      >
        {t("execute.exit")}
      </button>
    </div>
  );
}
