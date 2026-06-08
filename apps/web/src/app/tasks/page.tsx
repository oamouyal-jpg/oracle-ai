"use client";

import { useEffect, useMemo, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { api, type Task, type TaskStatus } from "@/lib/api";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import {
  localizeApiPhrase,
  localizeMissionTitle,
  localizeTaskStatus,
  localizeTaskTitle,
} from "@/lib/i18n/localizeContent";

export default function TasksPage() {
  const { t, locale } = useLocale();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [prioritizeMsg, setPrioritizeMsg] = useState<string | null>(null);

  const statuses = useMemo(
    (): { value: TaskStatus; label: string; color: string }[] => [
      { value: "COMPLETED", label: t("tasks.statusDone"), color: "text-emerald-400" },
      { value: "PARTIAL", label: t("tasks.statusPartial"), color: "text-cyan-400" },
      { value: "SKIPPED", label: t("tasks.statusSkipped"), color: "text-zinc-500" },
      { value: "DELAYED", label: t("tasks.statusDelayed"), color: "text-amber-400" },
      { value: "RESCHEDULED", label: t("tasks.statusReschedule"), color: "text-indigo-400" },
    ],
    [t]
  );

  const load = () => api.tasks().then(setTasks).catch(console.error);

  useEffect(() => {
    load();
  }, [locale]);

  const setStatus = async (id: string, status: TaskStatus) => {
    await api.updateTask(id, { status });
    load();
  };

  const runPrioritize = async () => {
    const r = await api.prioritize();
    setPrioritizeMsg(r.recommendation);
    const order = new Map(r.orderedTaskIds.map((taskId, i) => [taskId, i]));
    setTasks((prev) =>
      [...prev].sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99))
    );
  };

  const isDone = (s: TaskStatus) =>
    s === "COMPLETED" || s === "PARTIAL" || s === "CANCELLED";

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light text-zinc-50 glow-text">{t("tasks.title")}</h1>
          <p className="text-zinc-500 mt-1">{t("tasks.subtitleLong")}</p>
        </div>
        <button
          type="button"
          onClick={runPrioritize}
          className="px-4 py-2 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-200 text-sm hover:bg-indigo-500/30"
        >
          {t("tasks.prioritize")}
        </button>
      </header>

      {prioritizeMsg && (
        <GlassCard glow>
          <p className="text-sm text-indigo-200">{localizeApiPhrase(prioritizeMsg, locale)}</p>
        </GlassCard>
      )}

      <GlassCard>
        <ul className="divide-y divide-white/5">
          {tasks.map((task) => (
            <li key={task.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start gap-3 justify-between">
                <div className="flex-1 min-w-[200px]">
                  <p
                    className={
                      isDone(task.status) ? "text-zinc-500 line-through" : "text-zinc-100"
                    }
                  >
                    {localizeTaskTitle(task.title, locale)}
                  </p>
                  {task.mission && (
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {localizeMissionTitle(task.mission.title, locale)}
                    </p>
                  )}
                  <div className="flex gap-3 mt-1 text-[10px] text-zinc-600">
                    {task.emotionalDifficulty != null && (
                      <span>
                        {t("tasks.difficulty")} {task.emotionalDifficulty}
                      </span>
                    )}
                    {task.estimatedEffort != null && (
                      <span>
                        {t("tasks.effort")} {task.estimatedEffort}
                      </span>
                    )}
                    <span className="uppercase">
                      {localizeTaskStatus(task.status, locale)}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-indigo-400 font-mono">{task.priority}</span>
              </div>
              {!isDone(task.status) && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {statuses.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setStatus(task.id, s.value)}
                      className={`text-[10px] px-2 py-1 rounded-lg border border-white/10 hover:bg-white/5 ${s.color}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </GlassCard>
    </div>
  );
}
