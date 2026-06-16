"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Heart,
  Plus,
  X,
  Check,
  LifeBuoy,
  Eye,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { VoiceTextarea } from "@/components/speech/VoiceTextarea";
import {
  api,
  type InnerGrowth,
  type InnerSession,
  type StableValue,
} from "@/lib/api";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type Tab = "checkin" | "growth" | "self";

const EXAMPLE_KEYS = [
  "innerOs.example1",
  "innerOs.example2",
  "innerOs.example3",
  "innerOs.example4",
] as const;

export default function InnerOsPage() {
  const { t } = useLocale();
  const [tab, setTab] = useState<Tab>("checkin");

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-16">
      <header>
        <h1 className="text-2xl font-light text-zinc-50 glow-text">{t("innerOs.title")}</h1>
        <p className="mt-2 text-sm text-zinc-500">{t("innerOs.subtitle")}</p>
      </header>

      <div className="flex gap-1 rounded-xl border border-white/10 bg-black/20 p-1">
        {(
          [
            ["checkin", t("innerOs.tabCheckIn")],
            ["growth", t("innerOs.tabGrowth")],
            ["self", t("innerOs.tabHealthySelf")],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              tab === id ? "bg-violet-500/30 text-violet-50" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "checkin" ? <CheckInTab t={t} /> : null}
      {tab === "growth" ? <GrowthTab t={t} /> : null}
      {tab === "self" ? <HealthySelfTab t={t} /> : null}

      <p className="pt-2 text-center text-[10px] leading-relaxed text-zinc-600">
        {t("innerOs.safetyNote")}
      </p>
    </div>
  );
}

/* ─── Check-in ─── */

function CheckInTab({ t }: { t: (key: string) => string }) {
  const [rawInput, setRawInput] = useState("");
  const [session, setSession] = useState<InnerSession | null>(null);
  const [history, setHistory] = useState<InnerSession[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(() => {
    return api.innerSessions(8).then(setHistory).catch(() => undefined);
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const submit = async () => {
    if (rawInput.trim().length < 8) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.innerCheckIn(rawInput.trim());
      setSession(result.session);
      setRawInput("");
      await loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not check in.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <GlassCard glow className="space-y-4">
        <p className="text-xs text-zinc-500">{t("innerOs.promptHint")}</p>
        <VoiceTextarea
          value={rawInput}
          onChange={setRawInput}
          placeholder={t("innerOs.placeholder")}
          rows={5}
          disabled={busy}
          className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500/40"
        />
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setRawInput(t(k))}
              className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-zinc-500 hover:text-zinc-300"
            >
              {t(k)}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={busy || rawInput.trim().length < 8}
          onClick={() => void submit()}
          className="w-full rounded-xl bg-violet-500/35 py-2.5 text-sm text-violet-50 disabled:opacity-40"
        >
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("innerOs.analyzing")}
            </span>
          ) : (
            t("innerOs.submit")
          )}
        </button>
      </GlassCard>

      {error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200/90">
          {error}
        </p>
      ) : null}

      {session ? (
        <SessionView session={session} t={t} onUpdate={setSession} />
      ) : null}

      {history.length > 0 ? (
        <div className="space-y-3 pt-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {t("innerOs.recentSessions")}
          </p>
          {history.map((s) => (
            <GlassCard key={s.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-200">
                    {s.patternName ?? s.patternCategoryLabel}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{s.rawInput}</p>
                </div>
                <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-zinc-400">
                  {s.primaryDriverLabel}
                </span>
              </div>
            </GlassCard>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SessionView({
  session,
  t,
  onUpdate,
}: {
  session: InnerSession;
  t: (key: string) => string;
  onUpdate: (s: InnerSession) => void;
}) {
  const [answers, setAnswers] = useState<string[]>(
    session.reflectionQuestions.map(() => "")
  );
  const [reflecting, setReflecting] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const submitReflection = async () => {
    if (answers.every((a) => !a.trim())) return;
    setReflecting(true);
    try {
      const res = await api.innerReflect(session.id, answers);
      onUpdate(res.session);
    } catch {
      /* ignore */
    } finally {
      setReflecting(false);
    }
  };

  const toggleAction = async () => {
    setActionBusy(true);
    try {
      const res = await api.innerActionDone(session.id, !session.freedomActionDone);
      onUpdate(res.session);
    } catch {
      /* ignore */
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {session.professionalSupportSuggested ? (
        <div className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-950/30 px-3 py-3">
          <LifeBuoy className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p className="text-sm text-amber-100/90">{t("innerOs.support")}</p>
        </div>
      ) : null}

      {session.oracleReflection ? (
        <GlassCard glow className="space-y-2 border-violet-500/25">
          <div className="flex items-center gap-2 text-violet-300">
            <Sparkles className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-wider">{t("innerOs.mirror")}</p>
          </div>
          <p className="text-sm leading-relaxed text-zinc-200">{session.oracleReflection}</p>
        </GlassCard>
      ) : null}

      <GlassCard className="space-y-3">
        <div className="flex items-center gap-2 text-zinc-400">
          <Eye className="h-4 w-4" />
          <p className="text-xs font-semibold uppercase tracking-wider">{t("innerOs.driving")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-violet-500/20 px-3 py-1 text-sm text-violet-100">
            {session.primaryDriverLabel}
          </span>
          {session.secondaryDriverLabel ? (
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">
              + {session.secondaryDriverLabel}
            </span>
          ) : null}
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">
            {session.patternName ?? session.patternCategoryLabel}
          </span>
        </div>
        <p className="text-[11px] italic text-zinc-600">{t("innerOs.mayIndicate")}</p>
        {session.possibleRootCause ? (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">{t("innerOs.rootCause")}</p>
            <p className="mt-1 text-sm text-zinc-300">{session.possibleRootCause}</p>
          </div>
        ) : null}
        {session.triggers.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {session.triggers.map((trigger) => (
              <span
                key={trigger}
                className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-400"
              >
                {trigger}
              </span>
            ))}
          </div>
        ) : null}
      </GlassCard>

      {session.feelings.length > 0 || session.facts.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <GlassCard className="space-y-2 border-rose-500/20">
            <p className="text-[10px] uppercase tracking-wide text-rose-300/80">{t("innerOs.feelings")}</p>
            <ul className="space-y-1 text-sm text-zinc-300">
              {session.feelings.map((f) => (
                <li key={f}>· {f}</li>
              ))}
              {session.feelings.length === 0 ? <li className="text-zinc-600">—</li> : null}
            </ul>
          </GlassCard>
          <GlassCard className="space-y-2 border-sky-500/20">
            <p className="text-[10px] uppercase tracking-wide text-sky-300/80">{t("innerOs.facts")}</p>
            <ul className="space-y-1 text-sm text-zinc-300">
              {session.facts.map((f) => (
                <li key={f}>· {f}</li>
              ))}
              {session.facts.length === 0 ? <li className="text-zinc-600">—</li> : null}
            </ul>
          </GlassCard>
        </div>
      ) : null}

      {session.currentStateTraits.length > 0 || session.comparisonSummary ? (
        <GlassCard className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            {t("innerOs.comparison")}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <p className="text-[10px] uppercase tracking-wide text-amber-300/70">{t("innerOs.currentState")}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {session.currentStateTraits.map((tr) => (
                  <span key={tr} className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-100/80">
                    {tr}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/10 p-3">
              <p className="text-[10px] uppercase tracking-wide text-emerald-300/80">{t("innerOs.healthyState")}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {session.healthyStateTraits.map((tr) => (
                  <span key={tr} className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-100/90">
                    {tr}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {session.comparisonSummary ? (
            <p className="text-sm leading-relaxed text-zinc-300">{session.comparisonSummary}</p>
          ) : null}
        </GlassCard>
      ) : null}

      {session.reflectionQuestions.length > 0 ? (
        <GlassCard className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            {t("innerOs.reflection")}
          </p>
          <p className="text-[11px] text-zinc-600">{t("innerOs.reflectionHint")}</p>
          {session.reflectionInsight ? (
            <div className="rounded-lg border border-violet-500/20 bg-violet-950/10 p-3">
              <p className="text-[10px] uppercase tracking-wide text-violet-300/80">{t("innerOs.insight")}</p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-200">{session.reflectionInsight}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {session.reflectionQuestions.map((q, i) => (
                <div key={q} className="space-y-1.5">
                  <p className="text-sm text-zinc-300">{q}</p>
                  <textarea
                    value={answers[i] ?? ""}
                    onChange={(e) =>
                      setAnswers((prev) => {
                        const next = [...prev];
                        next[i] = e.target.value;
                        return next;
                      })
                    }
                    rows={2}
                    className="w-full resize-none rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500/40"
                  />
                </div>
              ))}
              <button
                type="button"
                disabled={reflecting || answers.every((a) => !a.trim())}
                onClick={() => void submitReflection()}
                className="rounded-xl bg-violet-500/30 px-4 py-2 text-sm text-violet-50 disabled:opacity-40"
              >
                {reflecting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("innerOs.analyzing")}
                  </span>
                ) : (
                  t("innerOs.saveReflection")
                )}
              </button>
            </div>
          )}
        </GlassCard>
      ) : null}

      {session.freedomAction ? (
        <GlassCard className="space-y-3 border-emerald-500/25">
          <p className="text-[10px] uppercase tracking-wide text-emerald-300/80">{t("innerOs.freedomAction")}</p>
          <p className="text-sm leading-relaxed text-zinc-200">{session.freedomAction}</p>
          <button
            type="button"
            disabled={actionBusy}
            onClick={() => void toggleAction()}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition-colors ${
              session.freedomActionDone
                ? "bg-emerald-500/30 text-emerald-50"
                : "border border-white/10 text-zinc-300 hover:text-zinc-100"
            }`}
          >
            <Check className="h-4 w-4" />
            {session.freedomActionDone ? t("innerOs.done") : t("innerOs.markDone")}
          </button>
        </GlassCard>
      ) : null}
    </div>
  );
}

/* ─── Growth ─── */

function GrowthTab({ t }: { t: (key: string) => string }) {
  const [growth, setGrowth] = useState<InnerGrowth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .innerGrowth()
      .then(setGrowth)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-10 text-zinc-500">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!growth || growth.totalSessions === 0) {
    return (
      <GlassCard className="py-8 text-center">
        <p className="text-sm text-zinc-500">{t("innerOs.noData")}</p>
      </GlassCard>
    );
  }

  const scoreRows: [string, { value: number; trend: number }][] = [
    [t("innerOs.scoreEmotionalRegulation"), growth.scores.emotionalRegulation],
    [t("innerOs.scoreSelfAwareness"), growth.scores.selfAwareness],
    [t("innerOs.scoreHealthyDecision"), growth.scores.healthyDecision],
    [t("innerOs.scoreFreedom"), growth.scores.freedom],
    [t("innerOs.scoreConsistency"), { value: growth.consistencyScore, trend: 0 }],
  ];

  return (
    <div className="space-y-4">
      {growth.trends.length > 0 ? (
        <GlassCard glow className="space-y-2 border-violet-500/25">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">
            {t("innerOs.trends")}
          </p>
          <ul className="space-y-1.5 text-sm text-zinc-300">
            {growth.trends.map((tr) => (
              <li key={tr}>· {tr}</li>
            ))}
          </ul>
        </GlassCard>
      ) : null}

      <GlassCard className="space-y-3">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            {t("innerOs.scoresTitle")}
          </p>
          <p className="text-[10px] text-zinc-600">{t("innerOs.scoresHint")}</p>
        </div>
        <div className="space-y-3">
          {scoreRows.map(([label, score]) => (
            <div key={label}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-zinc-400">{label}</span>
                <span className="inline-flex items-center gap-1 text-zinc-300">
                  {score.value}
                  {score.trend > 2 ? (
                    <TrendingUp className="h-3 w-3 text-emerald-400" />
                  ) : score.trend < -2 ? (
                    <TrendingDown className="h-3 w-3 text-rose-400" />
                  ) : null}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500/70 to-emerald-400/70"
                  style={{ width: `${score.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {growth.topDrivers.length > 0 ? (
        <GlassCard className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            {t("innerOs.commonStates")}
          </p>
          <div className="space-y-2">
            {growth.topDrivers.map((d) => (
              <div key={d.driver} className="flex items-center justify-between text-sm">
                <span className="text-zinc-300">{d.label}</span>
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-zinc-400">
                  {d.count}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      ) : null}

      {growth.repeatingPatterns.length > 0 ? (
        <GlassCard className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            {t("innerOs.repeatingPatterns")}
          </p>
          <div className="flex flex-wrap gap-2">
            {growth.repeatingPatterns.map((p) => (
              <span
                key={p.category}
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300"
              >
                {p.label} · {p.count}
              </span>
            ))}
          </div>
        </GlassCard>
      ) : null}
    </div>
  );
}

/* ─── Healthy Self ─── */

function HealthySelfTab({ t }: { t: (key: string) => string }) {
  const [values, setValues] = useState<StableValue[]>([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    return api.innerValues().then(setValues).catch(() => undefined);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api.createInnerValue({ valueName: name.trim(), description: desc.trim() || undefined });
      setName("");
      setDesc("");
      await load();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api.deleteInnerValue(id);
      await load();
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-4">
      <GlassCard className="space-y-2">
        <div className="flex items-center gap-2 text-violet-300">
          <Heart className="h-4 w-4" />
          <p className="text-xs font-semibold uppercase tracking-wider">{t("innerOs.healthySelfTitle")}</p>
        </div>
        <p className="text-xs leading-relaxed text-zinc-500">{t("innerOs.healthySelfHint")}</p>
      </GlassCard>

      <GlassCard className="space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("innerOs.valueNamePlaceholder")}
          className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500/40"
        />
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder={t("innerOs.valueDescPlaceholder")}
          className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500/40"
        />
        <button
          type="button"
          disabled={busy || !name.trim()}
          onClick={() => void add()}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-500/30 px-4 py-2 text-sm text-violet-50 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
          {t("innerOs.addValue")}
        </button>
      </GlassCard>

      {values.length === 0 ? (
        <GlassCard className="py-6 text-center">
          <p className="text-sm text-zinc-500">{t("innerOs.noValues")}</p>
        </GlassCard>
      ) : (
        <div className="space-y-2">
          {values.map((v) => (
            <GlassCard key={v.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-200">{v.valueName}</p>
                {v.description ? (
                  <p className="mt-0.5 text-xs text-zinc-500">{v.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void remove(v.id)}
                aria-label={t("innerOs.deleteValue")}
                className="shrink-0 rounded-lg p-1 text-zinc-500 hover:text-rose-300"
              >
                <X className="h-4 w-4" />
              </button>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
