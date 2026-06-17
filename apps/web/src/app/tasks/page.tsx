"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { VoiceInput } from "@/components/speech/VoiceInput";
import { TaskScheduleEditor } from "@/components/tasks/TaskScheduleEditor";
import {
  api,
  type FocusFollowUp,
  type FocusTasksResult,
  type Task,
  type TaskStatus,
  type ClarityTasksBundle,
  type ClarityIssueMode,
} from "@/lib/api";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import {
  localizeApiPhrase,
  localizeMissionTitle,
  localizeTaskStatus,
  localizeTaskTitle,
} from "@/lib/i18n/localizeContent";
import { formatTaskDueLabel } from "@/lib/taskScheduling";

export default function TasksPage() {
  const { t, locale } = useLocale();
  const [menu, setMenu] = useState<FocusTasksResult | null>(null);
  const [clarityPlans, setClarityPlans] = useState<ClarityTasksBundle[]>([]);
  const [recentClosed, setRecentClosed] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [replenishMsg, setReplenishMsg] = useState<string | null>(null);
  const [progressDrafts, setProgressDrafts] = useState<Record<string, string>>({});
  const [submittingFollowUp, setSubmittingFollowUp] = useState<string | null>(null);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());

  const primaryStatuses = useMemo(
    (): { value: TaskStatus; label: string; activeClass: string; idleClass: string }[] => [
      {
        value: "COMPLETED",
        label: t("tasks.statusDone"),
        activeClass: "bg-emerald-500/25 border-emerald-400/50 text-emerald-100",
        idleClass: "border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/15",
      },
      {
        value: "PARTIAL",
        label: t("tasks.statusPartial"),
        activeClass: "bg-cyan-500/25 border-cyan-400/50 text-cyan-100",
        idleClass: "border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/15",
      },
    ],
    [t]
  );

  const secondaryStatuses = useMemo(
    (): { value: TaskStatus; label: string; color: string }[] => [
      { value: "IN_PROGRESS", label: t("tasks.statusInProgress"), color: "text-indigo-300" },
      { value: "SKIPPED", label: t("tasks.statusSkipped"), color: "text-zinc-400" },
      { value: "DELAYED", label: t("tasks.statusDelayed"), color: "text-amber-300" },
      { value: "RESCHEDULED", label: t("tasks.statusReschedule"), color: "text-indigo-300" },
    ],
    [t]
  );

  const followUpByTask = useMemo(() => {
    const map = new Map<string, FocusFollowUp>();
    for (const f of menu?.followUps ?? []) map.set(f.taskId, f);
    for (const f of menu?.recentFollowUps ?? []) map.set(f.taskId, f);
    return map;
  }, [menu]);

  const applyTaskLists = (
    result: FocusTasksResult,
    all: Task[],
    plans: ClarityTasksBundle[]
  ) => {
    setMenu(result);
    setClarityPlans(plans);
    const closedIds = new Set(result.recentFollowUps.map((f) => f.taskId));
    setRecentClosed(all.filter((task) => closedIds.has(task.id)));
  };

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [result, all, plans] = await Promise.all([
        api.focusTasks(),
        api.tasks(),
        api.clarityTasks(),
      ]);
      applyTaskLists(result, all, plans);
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

  const applyOptimisticStatus = (id: string, status: TaskStatus) => {
    if (isClosed(status)) {
      const fromFocus = menu?.tasks.find((tk) => tk.id === id);
      setMenu((prev) =>
        prev ? { ...prev, tasks: prev.tasks.filter((tk) => tk.id !== id) } : prev
      );
      setClarityPlans((prev) =>
        prev
          .map((p) => ({ ...p, tasks: p.tasks.filter((tk) => tk.id !== id) }))
          .filter((p) => p.tasks.length > 0)
      );
      if (fromFocus) {
        setRecentClosed((prev) =>
          prev.some((r) => r.id === id) ? prev : [{ ...fromFocus, status }, ...prev]
        );
      }
    } else {
      setMenu((prev) =>
        prev
          ? { ...prev, tasks: prev.tasks.map((tk) => (tk.id === id ? { ...tk, status } : tk)) }
          : prev
      );
      setClarityPlans((prev) =>
        prev.map((p) => ({
          ...p,
          tasks: p.tasks.map((tk) => (tk.id === id ? { ...tk, status } : tk)),
        }))
      );
      setRecentClosed((prev) => prev.map((tk) => (tk.id === id ? { ...tk, status } : tk)));
    }
  };

  const setStatus = async (id: string, status: TaskStatus) => {
    setUpdatingStatusId(id);
    applyOptimisticStatus(id, status);
    try {
      const result = await api.updateTask(id, { status });
      if (result.replenished?.created) notify(t("tasks.replenished"));
      else notify(t("tasks.statusUpdated"));
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : t("tasks.loadError"));
      await load();
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const toggleTaskExpanded = (taskId: string) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const saveSchedule = async (
    taskId: string,
    data: {
      title?: string;
      dueDate: string | null;
      scheduledAt: string | null;
      reminderAt: string | null;
    }
  ) => {
    await api.updateTask(taskId, data);
    setEditingScheduleId(null);
    await load();
  };

  const createTask = async (data: {
    title?: string;
    dueDate: string | null;
    scheduledAt: string | null;
    reminderAt: string | null;
  }) => {
    if (!data.title) return;
    await api.createTask({
      title: data.title,
      dueDate: data.dueDate ?? undefined,
      scheduledAt: data.scheduledAt ?? undefined,
      reminderAt: data.reminderAt ?? undefined,
      aiGenerated: false,
    });
    setShowCreateTask(false);
    notify(t("tasks.taskAdded"));
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
      const [result, all, plans] = await Promise.all([
        api.refreshFocusTasks(),
        api.tasks(),
        api.clarityTasks(),
      ]);
      applyTaskLists(result, all, plans);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const isClosed = (s: TaskStatus) =>
    s === "COMPLETED" || s === "SKIPPED" || s === "CANCELLED";

  const renderFollowUp = (task: Task, followUp?: FocusFollowUp) => {
    if (!followUp || task.status === "CANCELLED") return null;
    const busy = submittingFollowUp === task.id;

    return (
      <div
        className="mt-3 ml-8 p-3 rounded-lg bg-violet-500/5 border border-violet-500/15 space-y-2"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
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
          <VoiceInput
            value={progressDrafts[task.id] ?? ""}
            onChange={(val) =>
              setProgressDrafts((prev) => ({ ...prev, [task.id]: val }))
            }
            placeholder={t("tasks.progressPlaceholder")}
            disabled={busy}
            wrapperClassName="flex-1 min-w-0"
            className="w-full min-w-0 px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-sm text-zinc-200 placeholder:text-zinc-600"
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

  const renderStatusActions = (task: Task, clarityMeta?: { locked: boolean }) => {
    if (clarityMeta?.locked) return null;
    const busy = updatingStatusId === task.id;

    return (
      <div className="mt-3 ml-8 space-y-2">
        <div className="flex flex-wrap gap-2">
          {primaryStatuses.map((s) => {
            const active = task.status === s.value;
            return (
              <button
                key={s.value}
                type="button"
                disabled={busy}
                onClick={() => void setStatus(task.id, s.value)}
                className={`min-h-10 flex-1 min-w-[7rem] rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-40 ${
                  active ? s.activeClass : s.idleClass
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              setEditingScheduleId(editingScheduleId === task.id ? null : task.id)
            }
            className="text-[10px] px-2.5 py-1.5 rounded-lg border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 disabled:opacity-40"
          >
            {t("tasks.scheduleBtn")}
          </button>
          {secondaryStatuses.map((s) => {
            const active = task.status === s.value;
            return (
              <button
                key={s.value}
                type="button"
                disabled={busy}
                onClick={() => void setStatus(task.id, s.value)}
                className={`text-[10px] px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-40 ${
                  active
                    ? "bg-white/10 border-white/30 text-zinc-100"
                    : `border-white/10 hover:bg-white/5 ${s.color}`
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTaskRow = (
    task: Task,
    rank?: number,
    assisted = false,
    clarityMeta?: {
      issueId: string;
      mode: ClarityIssueMode;
      isCurrent: boolean;
      locked: boolean;
    }
  ) => {
    const followUp = followUpByTask.get(task.id);
    const closed = isClosed(task.status);
    const open = !closed;
    const expanded = expandedTaskIds.has(task.id);
    const showDetails = open || expanded || task.status === "PARTIAL";
    const due = formatTaskDueLabel(task.dueDate, t, locale);
    const scheduled = task.scheduledAt
      ? `${t("tasks.scheduled")}: ${new Date(task.scheduledAt).toLocaleString(locale, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}`
      : null;

    return (
      <li key={task.id} className="py-4 first:pt-0 last:pb-0">
        <div
          className={`flex flex-wrap items-start gap-3 justify-between ${closed ? "cursor-pointer" : ""}`}
          onClick={closed ? () => toggleTaskExpanded(task.id) : undefined}
          onKeyDown={
            closed
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleTaskExpanded(task.id);
                  }
                }
              : undefined
          }
          role={closed ? "button" : undefined}
          tabIndex={closed ? 0 : undefined}
        >
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-start gap-2">
              {rank != null && (
                <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs flex items-center justify-center font-mono">
                  {rank}
                </span>
              )}
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className={
                      closed && !expanded ? "text-zinc-500 line-through" : "text-zinc-100"
                    }
                  >
                    {localizeTaskTitle(task.title, locale)}
                  </p>
                  {assisted && (
                    <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-violet-500/30 text-violet-300/90">
                      {t("tasks.assistedBadge")}
                    </span>
                  )}
                  {clarityMeta && (
                    <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-emerald-500/30 text-emerald-300/90">
                      {clarityMeta.mode === "WEEK_PLAN"
                        ? clarityMeta.isCurrent
                          ? t("tasks.weekPlanCurrent")
                          : t("tasks.weekPlanBadge")
                        : clarityMeta.isCurrent
                          ? t("tasks.weekPlanCurrent")
                          : t("tasks.clarityBadge")}
                    </span>
                  )}
                  {clarityMeta?.locked && open && (
                    <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-zinc-600/40 text-zinc-500">
                      {t("tasks.weekPlanLocked")}
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
                {(due || scheduled) && (
                  <div className="mt-1 flex flex-wrap gap-2">
                    {due ? (
                      <span
                        className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${
                          due.overdue
                            ? "border-rose-500/40 text-rose-300"
                            : due.dueToday
                              ? "border-amber-500/40 text-amber-300"
                              : "border-zinc-600 text-zinc-500"
                        }`}
                      >
                        {due.text}
                      </span>
                    ) : null}
                    {scheduled ? (
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-indigo-500/30 text-indigo-300/90">
                        {scheduled}
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
            {assisted && task.description && showDetails && (
              <div className="mt-2 ml-8 p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/15">
                <p className="text-[10px] uppercase tracking-wide text-indigo-400/80 mb-1">
                  {t("tasks.guidance")}
                </p>
                <p className="text-sm text-zinc-300 leading-relaxed">{task.description}</p>
              </div>
            )}
            {clarityMeta && task.description && showDetails && !assisted && (
              <div className="mt-2 ml-8 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
                <p className="text-[10px] uppercase tracking-wide text-emerald-400/80 mb-1">
                  {t("tasks.guidance")}
                </p>
                <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">
                  {task.description}
                </p>
              </div>
            )}
            {renderFollowUp(task, followUp)}
            {showDetails && editingScheduleId === task.id ? (
              <div className="mt-3 ml-8" onClick={(e) => e.stopPropagation()}>
                <TaskScheduleEditor
                  task={task}
                  t={t}
                  onSave={(data) => saveSchedule(task.id, data)}
                  onCancel={() => setEditingScheduleId(null)}
                />
              </div>
            ) : null}
            {task.completionNote && showDetails ? (
              <p className="mt-2 ml-8 text-xs leading-relaxed text-zinc-500 whitespace-pre-line">
                {task.completionNote}
              </p>
            ) : null}
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
        <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          {renderStatusActions(task, clarityMeta ? { locked: clarityMeta.locked } : undefined)}
        </div>
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

      <GlassCard>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-medium text-zinc-300">{t("tasks.addTask")}</h2>
          <button
            type="button"
            onClick={() => setShowCreateTask(!showCreateTask)}
            className="text-xs text-indigo-300 hover:text-indigo-100"
          >
            {showCreateTask ? t("common.cancel") : "+"}
          </button>
        </div>
        {showCreateTask ? (
          <TaskScheduleEditor
            createMode
            t={t}
            onSave={createTask}
            onCancel={() => setShowCreateTask(false)}
          />
        ) : (
          <p className="text-xs text-zinc-600">{t("tasks.newTaskPlaceholder")}</p>
        )}
      </GlassCard>

      {clarityPlans.length > 0 && (
        <section>
          <div className="mb-3">
            <h2 className="text-lg font-medium text-zinc-100">{t("tasks.fromClarity")}</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{t("tasks.fromClaritySubtitle")}</p>
          </div>
          {clarityPlans.map((plan) => (
            <div key={plan.issueId} className="mb-6">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="font-medium text-zinc-200">{plan.issueTitle}</p>
                  <span className="mt-1 inline-block rounded-full border border-indigo-400/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-indigo-300/90">
                    {plan.mode === "WEEK_PLAN" ? t("tasks.weekPlanBadge") : t("tasks.clarityBadge")}
                  </span>
                </div>
                <Link
                  href={`/clarity/${plan.issueId}`}
                  className="text-xs text-indigo-300 hover:text-indigo-100"
                >
                  {t("tasks.openInClarity")} →
                </Link>
              </div>
              <GlassCard glow>
                <ul className="divide-y divide-white/5">
                  {plan.tasks.map((task) =>
                    renderTaskRow(task, undefined, false, {
                      issueId: plan.issueId,
                      mode: plan.mode,
                      isCurrent: true,
                      locked: false,
                    })
                  )}
                </ul>
              </GlassCard>
            </div>
          ))}
        </section>
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
    </div>
  );
}
