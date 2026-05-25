"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Moon, ChevronRight, Sparkles } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { api, type DebriefQuestions, type NightDebrief } from "@/lib/api";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type Phase = "intro" | "questions" | "analysis";

const SECTION_KEYS: (keyof DebriefQuestions)[] = [
  "execution",
  "emotional",
  "relationships",
  "health",
  "awareness",
];

export default function NightDebriefPage() {
  const { t, locale } = useLocale();
  const [phase, setPhase] = useState<Phase>("intro");
  const [questions, setQuestions] = useState<DebriefQuestions | null>(null);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [result, setResult] = useState<NightDebrief | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const sections = useMemo(
    () =>
      SECTION_KEYS.map((key) => ({
        key,
        label: t(`debrief.sections.${key}`),
      })),
    [t]
  );

  useEffect(() => {
    Promise.all([api.debriefQuestions(), api.debriefToday()])
      .then(([q, today]) => {
        setQuestions(q);
        if (today?.aiAssessment) {
          setResult(today);
          setPhase("analysis");
        }
      })
      .catch(console.error);
  }, [locale]);

  if (!questions && phase !== "analysis") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-zinc-500">
        {t("debrief.loading")}
      </div>
    );
  }

  const currentSection = sections[sectionIndex];
  const currentQuestions = questions?.[currentSection.key] ?? [];
  const currentQuestion = currentQuestions[questionIndex];
  const responseKey = `${currentSection.key}_${questionIndex}`;

  const saveAndNext = () => {
    const updated = { ...responses, [responseKey]: currentAnswer };
    setResponses(updated);
    setCurrentAnswer("");

    if (questionIndex < currentQuestions.length - 1) {
      setQuestionIndex(questionIndex + 1);
      return;
    }
    if (sectionIndex < sections.length - 1) {
      setSectionIndex(sectionIndex + 1);
      setQuestionIndex(0);
      return;
    }
    submitDebrief(updated);
  };

  const submitDebrief = async (finalResponses: Record<string, string>) => {
    setSubmitting(true);
    try {
      const debrief = await api.submitDebrief(finalResponses);
      setResult(debrief);
      setPhase("analysis");
    } finally {
      setSubmitting(false);
    }
  };

  if (phase === "intro") {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-lg"
        >
          <Moon className="h-12 w-12 text-indigo-400 mx-auto mb-6 opacity-80" />
          <p className="text-xs uppercase tracking-[0.3em] text-indigo-400/80 mb-4">
            {t("debrief.modeLabel")}
          </p>
          <h1 className="text-4xl font-light text-zinc-50 glow-text mb-4">
            {t("debrief.chamberTitle")}
          </h1>
          <p className="text-zinc-400 leading-relaxed mb-10">{t("debrief.chamberDesc")}</p>
          <button
            type="button"
            onClick={() => setPhase("questions")}
            className="px-8 py-3 rounded-2xl bg-indigo-500/30 border border-indigo-400/40 text-indigo-100 hover:bg-indigo-500/40 transition"
          >
            {t("debrief.begin")}
          </button>
        </motion.div>
      </div>
    );
  }

  if (phase === "analysis" && result) {
    const scores = [
      { label: t("debrief.scores.focus"), value: result.focusScore },
      { label: t("debrief.scores.emotional"), value: result.emotionalScore },
      { label: t("debrief.scores.execution"), value: result.executionScore },
      { label: t("debrief.scores.alignment"), value: result.alignmentScore },
      { label: t("debrief.scores.energy"), value: result.energyScore },
    ];

    const plan = result.tomorrowPlan;

    return (
      <div className="space-y-8 max-w-3xl mx-auto pb-16">
        <header className="text-center pt-4">
          <Sparkles className="h-8 w-8 text-indigo-400 mx-auto mb-3" />
          <h1 className="text-2xl font-light text-zinc-50">{t("debrief.assessmentTitle")}</h1>
        </header>

        <div className="grid grid-cols-5 gap-3">
          {scores.map((s) => (
            <GlassCard key={s.label} className="text-center py-4">
              <p className="text-[10px] uppercase tracking-widest text-zinc-500">{s.label}</p>
              <p className="text-2xl font-light text-indigo-300 mt-1">
                {s.value ?? t("common.dash")}
              </p>
            </GlassCard>
          ))}
        </div>

        <GlassCard glow>
          <p className="text-zinc-100 leading-relaxed">{result.aiAssessment}</p>
        </GlassCard>

        {result.behavioralNotes?.length > 0 && (
          <GlassCard>
            <h2 className="text-xs uppercase tracking-widest text-zinc-500 mb-3">
              {t("debrief.behavioralNotes")}
            </h2>
            <ul className="space-y-2">
              {result.behavioralNotes.map((n) => (
                <li key={n} className="text-sm text-zinc-400 border-l-2 border-indigo-500/30 pl-3">
                  {n}
                </li>
              ))}
            </ul>
          </GlassCard>
        )}

        {plan && (
          <GlassCard className="border-cyan-500/20">
            <h2 className="text-xs uppercase tracking-widest text-cyan-400 mb-4">
              {t("debrief.tomorrowPlan")}
            </h2>
            <p className="text-sm text-zinc-300 mb-4">{plan.executionStrategy}</p>
            <p className="text-sm text-indigo-200 mb-4">{plan.focusRecommendation}</p>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-zinc-600 text-xs uppercase mb-2">{t("debrief.priorities")}</p>
                <ul className="text-zinc-400 space-y-1">
                  {plan.topPriorities?.map((p) => (
                    <li key={p}>· {p}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-zinc-600 text-xs uppercase mb-2">{t("debrief.warnings")}</p>
                <ul className="text-amber-200/70 space-y-1">
                  {plan.emotionalWarnings?.map((w) => (
                    <li key={w}>· {w}</li>
                  ))}
                </ul>
              </div>
            </div>
          </GlassCard>
        )}
      </div>
    );
  }

  const progress =
    ((sectionIndex * 10 + questionIndex) /
      (sections.length * 10 + (currentQuestions.length || 1))) *
    100;

  return (
    <div className="min-h-[80vh] flex flex-col max-w-2xl mx-auto">
      <div className="mb-8">
        <div className="h-0.5 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500"
            animate={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <p className="text-xs text-zinc-600 mt-2 uppercase tracking-widest">
          {currentSection.label} · {questionIndex + 1} / {currentQuestions.length}
        </p>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={responseKey}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="flex-1 flex flex-col"
        >
          <h2 className="text-2xl font-light text-zinc-100 leading-snug mb-8">
            {currentQuestion}
          </h2>
          <textarea
            value={currentAnswer}
            onChange={(e) => setCurrentAnswer(e.target.value)}
            placeholder={t("debrief.reflectPlaceholder")}
            rows={6}
            className="flex-1 w-full rounded-2xl glass p-5 text-zinc-100 placeholder:text-zinc-600 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
          />
          <button
            type="button"
            onClick={saveAndNext}
            disabled={!currentAnswer.trim() || submitting}
            className="mt-6 flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-500/30 border border-indigo-400/40 text-indigo-100 disabled:opacity-40 hover:bg-indigo-500/40 transition"
          >
            {submitting ? t("common.analyzing") : t("common.continue")}
            <ChevronRight className="h-4 w-4" />
          </button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
