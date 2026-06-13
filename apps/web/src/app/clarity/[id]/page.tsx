"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Target,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { api, type ClarityIssueDetail, type ClarityStep } from "@/lib/api";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export default function ClarityIssuePage() {
  const { t } = useLocale();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [issue, setIssue] = useState<ClarityIssueDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [planOpen, setPlanOpen] = useState(false);
  const [clarifyAnswer, setClarifyAnswer] = useState("");
  const [checkInText, setCheckInText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    return api
      .clarityIssue(id)
      .then(setIssue)
      .catch((e) => setError(e instanceof Error ? e.message : t("common.couldNotLoad")));
  }, [id, t]);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  const currentQuestion =
    issue?.status === "CLARIFYING" && issue.pendingQuestions.length > 0
      ? issue.pendingQuestions[0]
      : null;

  const submitClarify = async () => {
    if (!clarifyAnswer.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.clarifyIssue(id, clarifyAnswer.trim());
      setIssue(updated);
      setClarifyAnswer("");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.couldNotCreate"));
    } finally {
      setBusy(false);
    }
  };

  const completeStep = async (step: ClarityStep) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.completeClarityStep(id, step.id);
      setIssue(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.couldNotCreate"));
    } finally {
      setBusy(false);
    }
  };

  const skipStep = async (step: ClarityStep) => {
    setBusy(true);
    try {
      const updated = await api.skipClarityStep(id, step.id);
      setIssue(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.couldNotCreate"));
    } finally {
      setBusy(false);
    }
  };

  const submitCheckIn = async () => {
    if (!checkInText.trim()) return;
    setBusy(true);
    try {
      const updated = await api.clarityCheckIn(id, checkInText.trim());
      setIssue(updated);
      setCheckInText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.couldNotCreate"));
    } finally {
      setBusy(false);
    }
  };

  const promote = async () => {
    setBusy(true);
    try {
      const result = await api.promoteClarityIssue(id);
      setIssue(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.couldNotCreate"));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-zinc-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <p className="text-rose-300/90">{error ?? t("common.couldNotLoad")}</p>
        <Link href="/clarity" className="text-sm text-indigo-300">
          ← {t("clarity.title")}
        </Link>
      </div>
    );
  }

  const step = issue.currentStep;

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      <Link
        href="/clarity"
        className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("clarity.title")}
      </Link>

      <header>
        <h1 className="text-2xl font-light leading-snug text-zinc-50 glow-text">{issue.title}</h1>
        {issue.aiSummary ? (
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">{issue.aiSummary}</p>
        ) : null}
      </header>

      {error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200/90">
          {error}
        </p>
      ) : null}

      {currentQuestion ? (
        <GlassCard glow className="space-y-4 border-indigo-400/20">
          <p className="text-xs uppercase tracking-wider text-indigo-300/80">
            {t("clarity.statusClarifying")}
          </p>
          <p className="text-base leading-relaxed text-zinc-100">{currentQuestion}</p>
          <p className="text-xs text-zinc-500">{t("clarity.clarifyPrompt")}</p>
          <textarea
            value={clarifyAnswer}
            onChange={(e) => setClarifyAnswer(e.target.value)}
            placeholder={t("clarity.clarifyPlaceholder")}
            rows={4}
            className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none"
          />
          <button
            type="button"
            disabled={busy || !clarifyAnswer.trim()}
            onClick={() => void submitClarify()}
            className="w-full rounded-xl bg-indigo-500/35 py-2.5 text-sm text-indigo-50 disabled:opacity-40"
          >
            {t("clarity.submitAnswer")}
          </button>
        </GlassCard>
      ) : null}

      {issue.outcome ? (
        <GlassCard className="border-amber-500/20 bg-amber-950/10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/70">
            {t("clarity.northStar")}
          </p>
          <p className="mt-2 font-display text-lg leading-snug text-amber-50/95">
            {issue.outcome.northStarStatement}
          </p>
          {issue.outcome.primaryGoal ? (
            <p className="mt-3 text-xs text-zinc-500">
              <span className="text-zinc-400">Primary: </span>
              {issue.outcome.primaryGoal}
            </p>
          ) : null}
        </GlassCard>
      ) : null}

      {step ? (
        <GlassCard glow className="space-y-4">
          <div className="flex items-center gap-2 text-indigo-300/90">
            <Target className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-wider">{t("clarity.currentMove")}</p>
          </div>
          <p className="text-xl font-medium leading-snug text-zinc-50">{step.title}</p>
          {step.description ? (
            <p className="text-sm leading-relaxed text-zinc-400">{step.description}</p>
          ) : null}
          {step.whyThisNow ? (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">{t("clarity.whyNow")}</p>
              <p className="mt-1 text-sm text-zinc-300">{step.whyThisNow}</p>
            </div>
          ) : null}
          {step.prepareNotes ? (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">{t("clarity.prepare")}</p>
              <p className="mt-1 text-sm text-zinc-400">{step.prepareNotes}</p>
            </div>
          ) : null}
          {step.completionCriteria ? (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-emerald-400/80">
                {t("clarity.completion")}
              </p>
              <p className="mt-1 text-sm text-emerald-100/90">{step.completionCriteria}</p>
            </div>
          ) : null}
          <p className="text-xs text-zinc-600">
            {t("clarity.difficulty")}: {step.difficulty}/10
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={busy}
              onClick={() => void completeStep(step)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600/30 py-2.5 text-sm text-emerald-100 disabled:opacity-40"
            >
              <CheckCircle2 className="h-4 w-4" />
              {t("clarity.markComplete")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void skipStep(step)}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-zinc-400"
            >
              {t("clarity.skipStep")}
            </button>
          </div>
        </GlassCard>
      ) : issue.status === "COMPLETED" ? (
        <GlassCard className="border-emerald-500/25 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400/80" />
          <p className="mt-2 text-sm text-emerald-100/90">{t("clarity.statusCompleted")}</p>
        </GlassCard>
      ) : null}

      {issue.constraints.length > 0 ? (
        <GlassCard>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {t("clarity.constraints")}
          </p>
          <ul className="space-y-2">
            {issue.constraints.map((c) => (
              <li
                key={c.id}
                className="border-s-2 border-rose-500/40 ps-3 text-sm text-zinc-400"
              >
                <span className="text-[10px] uppercase text-zinc-600">{c.type}</span>
                <p>{c.description}</p>
              </li>
            ))}
          </ul>
        </GlassCard>
      ) : null}

      {issue.steps.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() => setPlanOpen(!planOpen)}
            className="flex w-full items-center justify-between rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-400"
          >
            {planOpen ? t("clarity.fullPlan") : t("clarity.collapsedPlan")}
            {planOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {planOpen ? (
            <ul className="mt-2 space-y-2">
              {issue.steps.map((s) => (
                <li
                  key={s.id}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    s.status === "CURRENT"
                      ? "border-indigo-400/40 bg-indigo-950/30 text-zinc-100"
                      : s.status === "COMPLETED" || s.status === "SKIPPED"
                        ? "border-white/5 text-zinc-600 line-through"
                        : "border-white/5 text-zinc-500"
                  }`}
                >
                  {s.title}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {issue.status === "ACTIVE" || issue.status === "COMPLETED" ? (
        <GlassCard className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {t("clarity.checkIn")}
          </p>
          <textarea
            value={checkInText}
            onChange={(e) => setCheckInText(e.target.value)}
            placeholder={t("clarity.checkInPlaceholder")}
            rows={3}
            className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none"
          />
          <button
            type="button"
            disabled={busy || !checkInText.trim()}
            onClick={() => void submitCheckIn()}
            className="w-full rounded-xl border border-white/10 py-2 text-sm text-zinc-300 disabled:opacity-40"
          >
            {t("clarity.submitCheckIn")}
          </button>
          {issue.checkIns[0]?.suggestedNextAction ? (
            <p className="text-xs text-indigo-300/80">{issue.checkIns[0].suggestedNextAction}</p>
          ) : null}
        </GlassCard>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-2">
        {issue.promotedMissionId ? (
          <Link
            href={`/missions/${issue.promotedMissionId}`}
            className="rounded-full border border-indigo-400/30 px-4 py-2 text-xs text-indigo-200"
          >
            {t("clarity.viewMission")}
          </Link>
        ) : issue.outcome ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void promote()}
            className="rounded-full border border-white/10 px-4 py-2 text-xs text-zinc-400"
          >
            {t("clarity.promote")}
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            await api.updateClarityIssue(id, { status: "PAUSED" });
            router.push("/clarity");
          }}
          className="rounded-full border border-white/10 px-4 py-2 text-xs text-zinc-500"
        >
          {t("clarity.pause")}
        </button>
      </div>
    </div>
  );
}
