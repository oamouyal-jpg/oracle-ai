"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Sparkles, ChevronRight, CalendarDays, Trash2, ListTodo } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { api, checkApiHealth, type ClarityIssueListItem } from "@/lib/api";
import { useLocale } from "@/lib/i18n/LocaleProvider";

function statusLabel(status: string, t: (k: string) => string) {
  switch (status) {
    case "CLARIFYING":
      return t("clarity.statusClarifying");
    case "ACTIVE":
      return t("clarity.statusActive");
    case "COMPLETED":
      return t("clarity.statusCompleted");
    case "PAUSED":
      return t("clarity.statusPaused");
    case "ARCHIVED":
      return t("clarity.statusArchived");
    default:
      return status;
  }
}

export default function ClarityListPage() {
  const { t } = useLocale();
  const [issues, setIssues] = useState<ClarityIssueListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadIssues = () => {
    api
      .clarityIssues()
      .then(setIssues)
      .catch((e) => setError(e instanceof Error ? e.message : t("common.couldNotLoad")));
  };

  useEffect(() => {
    checkApiHealth().then(setApiOnline);
    loadIssues();
  }, [t]);

  const deleteIssue = async (issueId: string) => {
    const confirmed = window.confirm(
      `${t("clarity.deleteConfirm")}\n\n${t("clarity.deleteConfirmBody")}`
    );
    if (!confirmed) return;
    setDeletingId(issueId);
    try {
      await api.deleteClarityIssue(issueId);
      setIssues((prev) => prev.filter((issue) => issue.id !== issueId));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.couldNotCreate"));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-indigo-300/90">
          <Sparkles className="h-5 w-5" />
          <span className="text-xs font-medium uppercase tracking-[0.2em]">{t("clarity.title")}</span>
        </div>
        <h1 className="font-light text-3xl text-zinc-50 glow-text">{t("clarity.tagline")}</h1>
        <p className="text-sm leading-relaxed text-zinc-500">{t("clarity.subtitle")}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href="/clarity/week/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-400/40 bg-violet-500/25 px-4 py-2.5 text-sm text-violet-100"
          >
            <CalendarDays className="h-4 w-4" />
            {t("clarity.weekPlanCta")}
          </Link>
          <Link
            href="/clarity/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-400/40 bg-indigo-500/25 px-4 py-2.5 text-sm text-indigo-100"
          >
            <Plus className="h-4 w-4" />
            {t("clarity.newIssue")}
          </Link>
        </div>
      </header>

      {apiOnline === false && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200/90">
          {t("common.apiOffline")}
        </p>
      )}

      {error && (
        <GlassCard className="border-rose-500/30">
          <p className="text-sm text-rose-200/90">{error}</p>
        </GlassCard>
      )}

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {t("clarity.activeIssues")}
        </h2>

        {issues.length === 0 && !error ? (
          <GlassCard>
            <p className="text-sm text-zinc-400">{t("clarity.noIssues")}</p>
          </GlassCard>
        ) : (
          issues.map((issue) => (
            <GlassCard key={issue.id} className="transition-colors hover:border-indigo-400/30">
              <div className="flex items-start justify-between gap-3">
                <Link href={`/clarity/${issue.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-medium text-zinc-100">{issue.title}</p>
                  {issue.mode === "WEEK_PLAN" ? (
                    <span className="mt-1 inline-block rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-violet-300/90">
                      {t("clarity.weekPlanBadge")}
                    </span>
                  ) : null}
                  {issue.northStar ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500">
                      {issue.northStar}
                    </p>
                  ) : issue.aiSummary ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500">
                      {issue.aiSummary}
                    </p>
                  ) : null}
                    {issue.currentStepTitle ? (
                      <p className="mt-2 text-xs text-indigo-300/80">
                        → {issue.currentStepTitle}
                      </p>
                    ) : null}
                    {issue.taskProgress?.hasTasks && issue.taskProgress.total > 0 ? (
                      <p className="mt-2 text-xs text-emerald-300/80">
                        {t("clarity.tasksLinked")
                          .replace("{done}", String(issue.taskProgress.done))
                          .replace("{total}", String(issue.taskProgress.total))}
                      </p>
                    ) : null}
                  </Link>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                      {statusLabel(issue.status, t)}
                    </span>
                    {issue.taskProgress?.hasTasks ? (
                      <Link
                        href="/tasks"
                        className="rounded-lg border border-emerald-500/25 p-1.5 text-emerald-300/80 hover:bg-emerald-500/10"
                        aria-label={t("clarity.openTasks")}
                      >
                        <ListTodo className="h-3.5 w-3.5" />
                      </Link>
                    ) : null}
                    <Link href={`/clarity/${issue.id}`} className="text-zinc-600">
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  <button
                    type="button"
                    aria-label={t("clarity.deleteIssue")}
                    disabled={deletingId === issue.id}
                    onClick={() => void deleteIssue(issue.id)}
                    className="rounded-lg border border-rose-500/20 p-1.5 text-rose-300/80 hover:bg-rose-500/10 disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </GlassCard>
          ))
        )}
      </section>
    </div>
  );
}
