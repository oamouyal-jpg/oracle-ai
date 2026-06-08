"use client";

import { useEffect, useState, useCallback } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { api, type FocusTasksResult, type Mission, type Task } from "@/lib/api";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import {
  localizeApiPhrase,
  localizeDomainName,
  localizeMissionTitle,
  localizeTaskTitle,
} from "@/lib/i18n/localizeContent";

const BLOCK_SECONDS = 20 * 60;

const isOpen = (status: Task["status"]) =>
  status === "PENDING" ||
  status === "IN_PROGRESS" ||
  status === "PARTIAL" ||
  status === "DELAYED" ||
  status === "RESCHEDULED";

export default function ExecutePage() {
  const { t, locale } = useLocale();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [oracleMenu, setOracleMenu] = useState<FocusTasksResult | null>(null);
  const [selectedMission, setSelectedMission] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [oracleMode, setOracleMode] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(BLOCK_SECONDS);
  const [running, setRunning] = useState(false);

  const loadOracleMenu = useCallback(async () => {
    const result = await api.focusTasks();
    setOracleMenu(result);
    return result;
  }, []);

  useEffect(() => {
    Promise.all([api.missions("ACTIVE").then(setMissions), loadOracleMenu()]).catch(console.error);
  }, [locale, loadOracleMenu]);

  useEffect(() => {
    if (!selectedMission || oracleMode) return;
    api.tasks({ missionId: selectedMission }).then((taskList) => {
      const open = taskList.filter((x) => isOpen(x.status));
      setTasks(open);
      setActiveTask(open[0] ?? null);
    });
  }, [selectedMission, oracleMode]);

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

  const startOracleTask = (task: Task) => {
    setOracleMode(true);
    setActiveTask(task);
    setSelectedMission(task.missionId ?? null);
    setTasks(oracleMenu?.tasks.filter((x) => isOpen(x.status)) ?? [task]);
    setSecondsLeft(BLOCK_SECONDS);
    setRunning(false);
  };

  const exitExecution = () => {
    setSelectedMission(null);
    setOracleMode(false);
    setActiveTask(null);
    setRunning(false);
    setSecondsLeft(BLOCK_SECONDS);
    loadOracleMenu().catch(console.error);
  };

  const advanceAfterComplete = async () => {
    if (!activeTask) return;
    const result = await api.updateTask(activeTask.id, { status: "COMPLETED" });
    const menu = await loadOracleMenu();
    const next =
      result.replenished?.tasks[0] ??
      menu.tasks.find((task) => isOpen(task.status) && task.id !== activeTask.id) ??
      menu.tasks.find((task) => isOpen(task.status)) ??
      null;

    setSecondsLeft(BLOCK_SECONDS);
    setRunning(false);

    if (oracleMode && next) {
      setActiveTask(next);
      setSelectedMission(next.missionId ?? null);
      setTasks(menu.tasks.filter((x) => isOpen(x.status)));
    } else if (oracleMode) {
      exitExecution();
    } else {
      const remaining = tasks.filter(
        (task) => task.id !== activeTask.id && isOpen(task.status)
      );
      setTasks(remaining);
      setActiveTask(remaining[0] ?? null);
    }
  };

  const mission = missions.find((m) => m.id === selectedMission);
  const topOracleTask = oracleMenu?.tasks.find((task) => isOpen(task.status));

  if (!selectedMission && !oracleMode) {
    return (
      <div className="space-y-8 max-w-xl mx-auto text-center">
        <h1 className="text-3xl font-light text-zinc-50 glow-text">{t("execute.title")}</h1>
        <p className="text-zinc-500">{t("execute.pickSubtitle")}</p>

        {topOracleTask && (
          <GlassCard glow className="text-left">
            <p className="text-[10px] uppercase tracking-wide text-violet-400/80 mb-2">
              {t("execute.oraclePriority")}
            </p>
            {oracleMenu?.overview && (
              <p className="text-sm text-indigo-200/90 mb-3">
                {localizeApiPhrase(oracleMenu.overview, locale)}
              </p>
            )}
            <p className="text-lg text-zinc-100 font-medium">
              {localizeTaskTitle(topOracleTask.title, locale)}
            </p>
            {topOracleTask.description && (
              <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
                {topOracleTask.description}
              </p>
            )}
            <button
              type="button"
              onClick={() => startOracleTask(topOracleTask)}
              className="mt-4 w-full px-4 py-3 rounded-xl bg-violet-500/20 border border-violet-500/40 text-violet-100 hover:bg-violet-500/30"
            >
              {t("execute.startOracleTask")}
            </button>
          </GlassCard>
        )}

        <p className="text-xs text-zinc-600 uppercase tracking-wide">{t("execute.orPickMission")}</p>
        <div className="space-y-3">
          {missions.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setOracleMode(false);
                setSelectedMission(m.id);
              }}
              className="w-full text-left p-4 rounded-2xl glass hover:border-cyan-500/40 transition border border-white/5"
            >
              <p className="text-zinc-100 font-medium">{localizeMissionTitle(m.title, locale)}</p>
              <p className="text-xs text-zinc-500 mt-1">
                {m.domain ? localizeDomainName(m.domain.slug, m.domain.name, locale) : ""}
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
        {oracleMode ? t("execute.oracleModeLabel") : t("execute.modeLabel")}
      </p>
      <h1 className="text-2xl font-light text-zinc-100 mb-8 text-center max-w-md">
        {mission ? localizeMissionTitle(mission.title, locale) : activeTask?.title ?? ""}
      </h1>

      <div className="text-7xl font-extralight text-cyan-300 tabular-nums mb-8 glow-text">
        {formatTime(secondsLeft)}
      </div>

      {activeTask && (
        <GlassCard className="max-w-md text-center mb-8">
          <p className="text-xs text-zinc-500 uppercase mb-2">{t("execute.currentBlock")}</p>
          <p className="text-lg text-zinc-100">{localizeTaskTitle(activeTask.title, locale)}</p>
          {activeTask.description && (
            <p className="text-sm text-zinc-400 mt-3 leading-relaxed text-left">
              {activeTask.description}
            </p>
          )}
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
          onClick={() => advanceAfterComplete().catch(console.error)}
          className="px-6 py-3 rounded-2xl border border-emerald-500/30 text-emerald-300 text-sm"
        >
          {t("execute.completeBlock")}
        </button>
      </div>

      <button
        type="button"
        onClick={exitExecution}
        className="mt-12 text-sm text-zinc-600 hover:text-zinc-400"
      >
        {t("execute.exit")}
      </button>
    </div>
  );
}
