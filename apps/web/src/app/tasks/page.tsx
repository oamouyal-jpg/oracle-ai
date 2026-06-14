"use client";

import { useEffect, useMemo, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  api,
  type FocusFollowUp,
  type FocusTasksResult,
  type Task,
  type TaskStatus,
} from "@/lib/api";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import {
  localizeApiPhrase,
  localizeMissionTitle,
  localizeTaskStatus,
  localizeTaskTitle,
} from "@/lib/i18n/localizeContent";

export default function TasksPage() {
  const { t, locale } = useLocale();
  const [menu, setMenu] = useState<FocusTasksResult | null>(null);
  const [otherTasks, setOtherTasks] = useState<Task[]>([]);
  const [recentClosed, setRecentClosed] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [replenishMsg, setReplenishMsg] = useState<string | null>(null);
  const [progressDrafts, setProgressDrafts] = useState<Record<string, string>>({});
  const [submittingFollowUp, setSubmittingFollowUp] = useState<string | null>(null);

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

  const followUpByTask = useMemo(() => {
    const map = new Map<string, FocusFollowUp>();
    for (const f of menu?.followUps ?? []) map.set(f.taskId, f);
    for (const f of menu?.recentFollowUps ?? []) map.set(f.taskId, f);
    return map;
  }, [menu]);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [result, all] = await Promise.all([api.focusTasks(), api.tasks()]);
      setMenu(result);
      const activeIds = new Set(result.tasks.map((task) => task.id));
      const closedIds = new Set(result.recentFollowUps.map((f) => f.taskId));
      setRecentClosed(all.filter((task) => closedIds.has(task.id)));
      setOtherTasks(
        all.filter(
          (task) =>
            !activeIds.has(task.id) &&
            !closedIds.has(task.id) &&
            !task.aiGenerated
        )
      );
    } catch (e) {
      console.error(e);
      setLoadError(e instanceof Error ? e.message : t("tasks.loadError"));
    } finally {
      setLoading(false);
    }
  };

  const FOCUS_LOCALE_KEY = "oracle-focus-locale";

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const storedLocale = localStorage.getItem(FOCUS_LOCALE_KEY);
      if (storedLocale !== locale) {
        try {
          await api.refreshFocusTasks();
          localStorage.setItem(FOCUS_LOCALE_KEY, locale);
        } catch (e) {
          console.error(e);
        }
      }
      if (!cancelled) await load();
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const notify = (msg: string) => {
    setReplenishMsg(msg);
    setTimeout(() => setReplenishMsg(null), 4000);
  };

  const setStatus = async (id: string, status: TaskStatus) => {
    const result = await api.updateTask(id, { status });
    if (result.replenished?.created) notify(t("tasks.replenished"));
    await load();
  };

  const submitFollowUp = async (taskId: string) => {
    const progress = progressDrafts[taskId]?.trim();
    if (!progress) return;
    setSubmittingFollowUp(taskId);
    try {
      const result = await api.submitTaskFollowUp(taskId, progress);
      setProgressDrafts((prev) => ({ ...prev, [taskId]: "" }));
      if (result.suggestedStatus) notify(t("tasks.statusUpdated"));
      if (result.replenished?.created) notify(t("tasks.replenished"));
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingFollowUp(null);
    }
  };

  const refreshMenu = async () => {
    setLoading(true);
    try {
      const result = await api.refreshFocusTasks();
      const all = await api.tasks();
      setMenu(result);
      const activeIds = new Set(result.tasks.map((task) => task.id));
      const closedIds = new Set(result.recentFollowUps.map((f) => f.taskId));
      setRecentClosed(all.filter((task) => closedIds.has(task.id)));
      setOtherTasks(
        all.filter(
          (task) =>
            !activeIds.has(task.id) &&
            !closedIds.has(task.id) &&
            !task.aiGenerated
        )
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const isClosed = (s: TaskStatus) =>
    s === "COMPLETED" || s === "SKIPPED" || s === "CANCELLED";

  const renderFollowUp = (task: Task, followUp?: FocusFollowUp) => {
    if (!followUp || isClosed(task.status)) return null;
    const busy = submittingFollowUp === task.id;

    return (
      <div className="mt-3 ml-8 p-3 rounded-lg bg-violet-500/5 border border-violet-500/15 space-y-2">
        <p className="text-[10px] uppercase tracking-wide text-violet-400/80">
          {t("tasks.followUp")}
        </p>
        <p className="text-sm text-violet-100/90 leading-relaxed">
          {localizeApiPhrase(followUp.question, locale)}
        </p>
        {followUp.priorNote && (
          <p className="text-xs text-zinc-500">
            <span className="text-zinc-400">{t("tasks.yourProgress")}: </span>
            {followUp.priorNote}
          </p>
        )}
        {followUp.lastOracleReply && (
          <p className="text-xs text-indigo-300/80">
            <span className="text-indigo-400">{t("tasks.oracleReply")}: </span>
            {localizeApiPhrase(followUp.lastOracleReply, locale)}
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <input
            type="text"
            value={progressDrafts[task.id] ?? ""}
            onChange={(e) =>
              setProgressDrafts((prev) => ({ ...prev, [task.id]: e.target.value }))
            }
            placeholder={t("tasks.progressPlaceholder")}
            className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-sm text-zinc-200 placeholder:text-zinc-600"
            onKeyDown={(e) => {
              if (e.key === "Enter") submitFollowUp(task.id);
            }}
          />
          <button
            type="button"
            disabled={busy || !progressDrafts[task.id]?.trim()}
            onClick={() => submitFollowUp(task.id)}
            className="shrink-0 px-3 py-2 rounded-lg bg-violet-500/20 border border-violet-500/40 text-violet-200 text-xs hover:bg-violet-500/30 disabled:opacity-40"
          >
            {busy ? "…" : t("tasks.submitProgress")}
          </button>
        </div>
      </div>
    );
  };

  const renderTaskRow = (task: Task, rank?: number, assisted = false) => {
    const followUp = followUpByTask.get(task.id);
    const open = !isClosed(task.status);

    return (
      <li key={task.id} className="py-4 first:pt-0 last:pb-0">
        <div className="flex flex-wrap items-start gap-3 justify-between">
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-start gap-2">
              {rank != null && (
                <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs flex items-center justify-center font-mono">
                  {rank}
                </span>
              )}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className={open ? "text-zinc-100" : "text-zinc-500 line-through"}>
                    {localizeTaskTitle(task.title, locale)}
                  </p>
                  {assisted && (
                    <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-violet-500/30 text-violet-300/90">
                      {t("tasks.assistedBadge")}
                    </span>
                  )}
                  {assisted && open && task.status === "PARTIAL" && (
                    <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-cyan-500/30 text-cyan-300/90">
                      {t("tasks.trackedUntilDone")}
                    </span>
                  )}
                </div>
                {task.mission && (
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {localizeMissionTitle(task.mission.title, locale)}
                  </p>
                )}
              </div>
            </div>
            {assisted && task.description && open && (
              <div className="mt-2 ml-8 p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/15">
                <p className="text-[10px] uppercase tracking-wide text-indigo-400/80 mb-1">
                  {t("tasks.guidance")}
                </p>
                <p className="text-sm text-zinc-300 leading-relaxed">{task.description}</p>
              </div>
            )}
            {renderFollowUp(task, followUp)}
            <div className="flex gap-3 mt-1 ml-8 text-[10px] text-zinc-600">
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
              <span className="uppercase">{localizeTaskStatus(task.status, locale)}</span>
            </div>
          </div>
          <span className="text-xs text-indigo-400 font-mono">
            {t("tasks.priorityLabel")} {task.priority}
          </span>
        </div>
        {open && (
          <div className="flex flex-wrap gap-1.5 mt-3 ml-8">
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
    );
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light text-zinc-50 glow-text">{t("tasks.title")}</h1>
          <p className="text-zinc-500 mt-1">{t("tasks.focusSubtitle")}</p>
        </div>
        <button
          type="button"
          onClick={refreshMenu}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-violet-500/20 border border-violet-500/40 text-violet-200 text-sm hover:bg-violet-500/30 disabled:opacity-50"
        >
          {t("tasks.refreshFocus")}
        </button>
      </header>

      {replenishMsg && (
        <GlassCard glow>
          <p className="text-sm text-emerald-300">{replenishMsg}</p>
        </GlassCard>
      )}

      {loadError && (
        <GlassCard className="border-rose-500/30">
          <p className="text-sm text-rose-200/90">{loadError}</p>
        </GlassCard>
      )}

      <section>
        <div className="mb-3">
          <h2 className="text-lg font-medium text-zinc-100">{t("tasks.focusTitle")}</h2>
        </div>

        <GlassCard glow>
          {loading ? (
            <p className="text-sm text-zinc-500 py-4">{t("tasks.loadingFocus")}</p>
          ) : menu && menu.tasks.length > 0 ? (
            <>
              {menu.overview && (
                <p className="text-sm text-indigo-200/90 mb-3">
                  {localizeApiPhrase(menu.overview, locale)}
                </p>
              )}
              {menu.prioritization?.insights?.length > 0 && (
                <ul className="text-xs text-zinc-500 mb-4 pb-4 border-b border-white/5 space-y-1">
                  {menu.prioritization.insights.map((insight) => (
                    <li key={insight}>• {localizeApiPhrase(insight, locale)}</li>
                  ))}
                </ul>
              )}
              <ul className="divide-y divide-white/5">
                {menu.tasks.map((task, i) => renderTaskRow(task, i + 1, true))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-zinc-500 py-4">{t("tasks.noMissions")}</p>
          )}
        </GlassCard>
      </section>

      {recentClosed.length > 0 && (
        <section>
          <h2 className="text-lg font-medium text-zinc-100 mb-3">{t("tasks.recentFocus")}</h2>
          <GlassCard>
            <ul className="divide-y divide-white/5">
              {recentClosed.map((task) => renderTaskRow(task, undefined, true))}
            </ul>
          </GlassCard>
        </section>
      )}

      {otherTasks.length > 0 && (
        <section>
          <h2 className="text-lg font-medium text-zinc-100 mb-3">{t("tasks.allTasks")}</h2>
          <GlassCard>
            <ul className="divide-y divide-white/5">
              {otherTasks.map((task) => renderTaskRow(task))}
            </ul>
          </GlassCard>
        </section>
      )}
    </div>
  );
}
