"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  AlertTriangle,
  Shield,
  ChevronRight,
  Pencil,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { VoiceInput } from "@/components/speech/VoiceInput";
import { VoiceTextarea } from "@/components/speech/VoiceTextarea";
import { ProgressRing } from "@/components/ui/ProgressRing";
import {
  api,
  type MissionTrackerDetail,
  type TradingDailyInput,
} from "@/lib/api";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import {
  localizeMissionStatus,
  localizeMissionTitle,
  tradingRulesFallback,
} from "@/lib/i18n/localizeContent";

type Tab = "overview" | "updates" | "trading";

export default function MissionDetailPage() {
  const { t, locale } = useLocale();
  const params = useParams();
  const id = params.id as string;
  const [mission, setMission] = useState<MissionTrackerDetail | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [updateText, setUpdateText] = useState("");
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [tradingResponses, setTradingResponses] = useState<Record<string, string>>({});
  const [tradingMetrics, setTradingMetrics] = useState<Partial<TradingDailyInput>>({
    followedRules: true,
    tradedFromCalm: true,
    revengeTrade: false,
    overtraded: false,
    contractsUsed: 1,
    instrument: "MNQ",
  });
  const [weeklyReport, setWeeklyReport] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);

  const load = () => api.missionTracker(id).then(setMission).catch(console.error);

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    api.tradingQuestions().then((r) => setQuestions(r.questions)).catch(() => {});
  }, [locale]);

  useEffect(() => {
    if (mission?.missionType === "TRADING") setTab("trading");
  }, [mission?.missionType]);

  useEffect(() => {
    if (mission && !editingTitle) setTitleDraft(mission.title);
  }, [mission?.title, editingTitle]);

  const runAiReview = async () => {
    setLoading(true);
    try {
      const { mission: m } = await api.missionAiReview(id);
      setMission(m);
    } finally {
      setLoading(false);
    }
  };

  const saveTitle = async () => {
    const trimmed = titleDraft.trim();
    if (!mission) return;
    if (!trimmed) {
      setTitleError(t("common.couldNotCreate"));
      return;
    }
    if (trimmed === mission.title) {
      setEditingTitle(false);
      setTitleError(null);
      return;
    }
    setLoading(true);
    setTitleError(null);
    try {
      await api.updateMission(id, { title: trimmed });
      setEditingTitle(false);
      await load();
    } catch (e) {
      setTitleError(e instanceof Error ? e.message : t("common.couldNotCreate"));
    } finally {
      setLoading(false);
    }
  };

  const postUpdate = async (type: "DAILY" | "WEEKLY" = "DAILY") => {
    if (!updateText.trim()) return;
    setLoading(true);
    try {
      await api.postMissionUpdate(id, updateText, type);
      setUpdateText("");
      load();
    } finally {
      setLoading(false);
    }
  };

  const submitTrading = async () => {
    setLoading(true);
    try {
      await api.submitTradingDaily(id, {
        responses: tradingResponses,
        ...tradingMetrics,
        contractsUsed: tradingMetrics.contractsUsed ?? 1,
      });
      load();
    } finally {
      setLoading(false);
    }
  };

  const loadWeekly = async () => {
    setLoading(true);
    try {
      const r = await api.tradingWeeklyReport(id);
      setWeeklyReport(r.report);
    } finally {
      setLoading(false);
    }
  };

  if (!mission) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-zinc-500">
        {t("missionDetail.loading")}
      </div>
    );
  }

  const isTrading = mission.missionType === "TRADING";
  const rules =
    (mission.tradingConfig?.rules as string[] | undefined) ?? tradingRulesFallback(locale);
  const latestLog = mission.tradingLogs?.[0];

  const tabKeys: Tab[] = isTrading
    ? ["overview", "updates", "trading"]
    : ["overview", "updates"];

  const tradingCheckboxes: { key: keyof TradingDailyInput; label: string }[] = [
    { key: "followedRules", label: t("missionDetail.followedRules") },
    { key: "tradedFromCalm", label: t("missionDetail.tradedCalm") },
    { key: "revengeTrade", label: t("missionDetail.revengeTrade") },
    { key: "overtraded", label: t("missionDetail.overtraded") },
    { key: "respectedStop", label: t("missionDetail.respectedStop") },
  ];

  return (
    <div className="space-y-8 max-w-4xl">
      <Link
        href="/missions"
        className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300"
      >
        <ArrowLeft className="h-4 w-4" /> {t("missionDetail.back")}
      </Link>

      <header className="flex flex-wrap gap-6 justify-between items-start">
        <div>
          {isTrading && (
            <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 inline-flex items-center gap-1 mb-2">
              <Shield className="h-3 w-3" /> {t("missionDetail.tradingBadge")}
            </span>
          )}
          {editingTitle ? (
            <div className="space-y-2 max-w-xl">
              <VoiceInput
                value={titleDraft}
                onChange={setTitleDraft}
                placeholder={t("missions.missionTitle")}
                className="w-full rounded-xl glass px-4 py-2 text-2xl font-light text-zinc-50 focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void saveTitle();
                  if (e.key === "Escape") {
                    setEditingTitle(false);
                    setTitleDraft(mission.title);
                    setTitleError(null);
                  }
                }}
                autoFocus
              />
              {titleError ? (
                <p className="text-sm text-rose-300/90">{titleError}</p>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void saveTitle()}
                  disabled={loading || !titleDraft.trim()}
                  className="px-4 py-2 rounded-xl bg-indigo-500/30 text-indigo-100 text-sm disabled:opacity-40"
                >
                  {t("common.save")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingTitle(false);
                    setTitleDraft(mission.title);
                    setTitleError(null);
                  }}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl border border-white/10 text-zinc-400 text-sm"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <h1 className="text-3xl font-light text-zinc-50 glow-text">
                {localizeMissionTitle(mission.title, locale)}
              </h1>
              <button
                type="button"
                title={t("missions.editTitle")}
                onClick={() => {
                  setTitleDraft(mission.title);
                  setEditingTitle(true);
                  setTitleError(null);
                }}
                className="mt-1.5 p-1.5 rounded-lg text-zinc-600 hover:text-indigo-300 hover:bg-indigo-500/10 border border-transparent hover:border-indigo-500/30 transition"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          )}
          <p className="text-zinc-500 mt-2">{localizeMissionStatus(mission.status, locale)}</p>
        </div>
        <ProgressRing
          value={mission.progress}
          size={80}
          color={isTrading ? "#22d3ee" : "#6366f1"}
        />
      </header>

      <div className="flex gap-2 flex-wrap">
        {tabKeys.map((tabKey) => (
          <button
            key={tabKey}
            type="button"
            onClick={() => setTab(tabKey)}
            className={`px-4 py-2 rounded-xl text-sm capitalize ${
              tab === tabKey
                ? "bg-indigo-500/30 border border-indigo-400/40 text-indigo-100"
                : "text-zinc-500 border border-white/5"
            }`}
          >
            {t(`missionDetail.tabs.${tabKey}`)}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-4">
          <GlassCard glow>
            <div className="flex justify-between items-start gap-4">
              <p className="text-xs uppercase tracking-widest text-indigo-400">
                {t("missionDetail.aiReview")}
              </p>
              <button
                type="button"
                onClick={runAiReview}
                disabled={loading}
                className="flex items-center gap-1 text-xs text-indigo-300 hover:text-indigo-100"
              >
                <Sparkles className="h-4 w-4" />
                {loading ? t("common.analyzing") : t("missionDetail.runAiReview")}
              </button>
            </div>
            {mission.aiNotes && (
              <p className="text-zinc-200 leading-relaxed mt-3">{mission.aiNotes}</p>
            )}
            {mission.aiStrategy && (
              <p className="text-sm text-zinc-400 mt-3 border-t border-white/5 pt-3">
                {mission.aiStrategy}
              </p>
            )}
          </GlassCard>

          <div className="grid md:grid-cols-2 gap-4">
            <GlassCard>
              <h3 className="text-xs uppercase text-zinc-500 mb-2">
                {t("missionDetail.whyItMatters")}
              </h3>
              <p className="text-sm text-zinc-300">
                {mission.whyItMatters ?? mission.purpose ?? t("common.dash")}
              </p>
            </GlassCard>
            <GlassCard>
              <h3 className="text-xs uppercase text-zinc-500 mb-2">
                {t("missionDetail.desiredOutcome")}
              </h3>
              <p className="text-sm text-zinc-300">
                {mission.desiredOutcome ?? t("common.dash")}
              </p>
            </GlassCard>
          </div>

          <GlassCard>
            <h3 className="text-xs uppercase text-zinc-500 mb-2">
              {t("missionDetail.emotionalDifficulty")}
            </h3>
            <div className="h-2 rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-amber-500/80"
                style={{ width: `${mission.emotionalResistance ?? 0}%` }}
              />
            </div>
            <p className="text-xs text-zinc-600 mt-1">
              {mission.emotionalResistance ?? 0}/100
            </p>
          </GlassCard>

          {mission.risks && mission.risks.length > 0 && (
            <GlassCard className="border-amber-500/20">
              <h3 className="text-xs uppercase text-amber-400 mb-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {t("missionDetail.risks")}
              </h3>
              <ul className="text-sm text-zinc-400 space-y-1">
                {mission.risks.map((r) => (
                  <li key={r}>· {r}</li>
                ))}
              </ul>
            </GlassCard>
          )}

          {mission.blockers.length > 0 && (
            <GlassCard>
              <h3 className="text-xs uppercase text-zinc-500 mb-2">
                {t("missionDetail.blockers")}
              </h3>
              <ul className="text-sm text-amber-200/70 space-y-1">
                {mission.blockers.map((b) => (
                  <li key={b}>— {b}</li>
                ))}
              </ul>
            </GlassCard>
          )}

          {mission.nextActions && mission.nextActions.length > 0 && (
            <GlassCard>
              <h3 className="text-xs uppercase text-cyan-400 mb-2">
                {t("clarity.currentMove")}
              </h3>
              <p className="text-sm text-zinc-300">→ {mission.nextActions[0]}</p>
            </GlassCard>
          )}

          {mission.weeklyReview && (
            <GlassCard>
              <h3 className="text-xs uppercase text-zinc-500 mb-2">
                {t("missionDetail.weeklyReview")}
              </h3>
              <p className="text-sm text-zinc-300">{mission.weeklyReview}</p>
            </GlassCard>
          )}
        </div>
      )}

      {tab === "updates" && (
        <div className="space-y-4">
          <GlassCard>
            <h3 className="text-sm text-zinc-300 mb-3">{t("missionDetail.updateTitle")}</h3>
            <VoiceTextarea
              value={updateText}
              onChange={setUpdateText}
              rows={4}
              disabled={loading}
              placeholder={t("missionDetail.updatePlaceholder")}
              className="w-full rounded-xl glass p-4 text-zinc-100 placeholder:text-zinc-600 resize-none focus:outline-none"
            />
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={() => postUpdate("DAILY")}
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-indigo-500/30 text-indigo-100 text-sm"
              >
                {t("missionDetail.logDaily")}
              </button>
              <button
                type="button"
                onClick={() => postUpdate("WEEKLY")}
                disabled={loading}
                className="px-4 py-2 rounded-xl border border-white/10 text-zinc-400 text-sm"
              >
                {t("missionDetail.weeklyReviewBtn")}
              </button>
            </div>
          </GlassCard>

          {mission.updates?.map((u) => (
            <GlassCard key={u.id}>
              <div className="flex justify-between text-xs text-zinc-500 mb-2">
                <span className="uppercase">
                  {u.updateType === "WEEKLY"
                    ? t("missionDetail.weeklyReviewBtn")
                    : t("missionDetail.logDaily")}
                </span>
                <span>{new Date(u.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-sm text-zinc-300">{u.content}</p>
              {u.aiAnalysis && (
                <p className="text-sm text-indigo-300/80 mt-3 border-t border-white/5 pt-3">
                  {u.aiAnalysis}
                </p>
              )}
            </GlassCard>
          ))}
        </div>
      )}

      {tab === "trading" && isTrading && (
        <div className="space-y-4">
          <GlassCard className="border-cyan-500/20">
            <h3 className="text-xs uppercase text-cyan-400 mb-3">
              {t("missionDetail.tradingRules")}
            </h3>
            <ul className="text-sm text-zinc-400 space-y-2">
              {rules.map((r) => (
                <li key={r} className="flex gap-2">
                  <ChevronRight className="h-4 w-4 text-cyan-500 shrink-0" />
                  {r}
                </li>
              ))}
            </ul>
            <p className="text-xs text-amber-200/60 mt-4">
              {t("missionDetail.tradingDisclaimer")}
            </p>
          </GlassCard>

          {latestLog && (
            <GlassCard glow>
              <h3 className="text-xs uppercase text-zinc-500 mb-3">
                {t("missionDetail.latestScores")}
              </h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <Score label={t("missionDetail.discipline")} value={latestLog.disciplineScore} />
                <Score
                  label={t("missionDetail.executionScore")}
                  value={latestLog.executionScore}
                />
                <Score label={t("missionDetail.riskControl")} value={latestLog.riskControlScore} />
              </div>
              {latestLog.aiDailyReport && (
                <p className="text-sm text-zinc-300 mt-4 leading-relaxed">
                  {latestLog.aiDailyReport}
                </p>
              )}
            </GlassCard>
          )}

          <GlassCard>
            <h3 className="text-sm text-indigo-300 mb-4">{t("missionDetail.todayLog")}</h3>
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <label className="text-xs text-zinc-500">
                {t("missionDetail.contracts")}
                <input
                  type="number"
                  min={0}
                  max={1}
                  value={tradingMetrics.contractsUsed ?? 1}
                  onChange={(e) =>
                    setTradingMetrics({
                      ...tradingMetrics,
                      contractsUsed: Math.min(1, Number(e.target.value)),
                    })
                  }
                  className="w-full mt-1 rounded-lg glass px-3 py-2 text-zinc-100"
                />
              </label>
              <label className="text-xs text-zinc-500">
                {t("missionDetail.instrument")}
                <select
                  value={tradingMetrics.instrument ?? "MNQ"}
                  onChange={(e) =>
                    setTradingMetrics({ ...tradingMetrics, instrument: e.target.value })
                  }
                  className="w-full mt-1 rounded-lg glass px-3 py-2 text-zinc-100"
                >
                  <option value="MNQ">MNQ</option>
                  <option value="MES">MES</option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-4 mb-6">
              {tradingCheckboxes.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm text-zinc-400">
                  <input
                    type="checkbox"
                    checked={Boolean(tradingMetrics[key])}
                    onChange={(e) =>
                      setTradingMetrics({
                        ...tradingMetrics,
                        [key]: e.target.checked,
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>

            <div className="space-y-4">
              {questions.map((q) => (
                <div key={q}>
                  <p className="text-sm text-zinc-300 mb-1">{q}</p>
                  <VoiceTextarea
                    value={tradingResponses[q] ?? ""}
                    onChange={(val) => setTradingResponses({ ...tradingResponses, [q]: val })}
                    rows={2}
                    disabled={loading}
                    className="w-full rounded-xl glass p-3 text-sm text-zinc-100 resize-none focus:outline-none"
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={submitTrading}
              disabled={loading}
              className="mt-4 w-full py-3 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-100"
            >
              {loading
                ? t("missionDetail.generatingReport")
                : t("missionDetail.submitTrading")}
            </button>
          </GlassCard>

          <GlassCard>
            <button
              type="button"
              onClick={loadWeekly}
              disabled={loading}
              className="text-sm text-indigo-300 hover:text-indigo-100"
            >
              {t("missionDetail.weeklyReport")}
            </button>
            {weeklyReport && (
              <p className="text-sm text-zinc-300 mt-4 leading-relaxed whitespace-pre-wrap">
                {weeklyReport}
              </p>
            )}
          </GlassCard>
        </div>
      )}
    </div>
  );
}

function Score({ label, value }: { label: string; value: number | null }) {
  const { t } = useLocale();
  return (
    <div>
      <p className="text-2xl font-light text-cyan-300">{value ?? t("common.dash")}</p>
      <p className="text-[10px] uppercase text-zinc-600">{label}</p>
    </div>
  );
}
