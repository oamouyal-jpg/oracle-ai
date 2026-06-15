"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Moon, ChevronRight, Sparkles, Check } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { VoiceTextarea } from "@/components/speech/VoiceTextarea";
import { api, type DebriefQuestions, type NightDebrief } from "@/lib/api";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { localizeApiPhrase } from "@/lib/i18n/localizeContent";

type Phase = "intro" | "questions" | "analysis";

const SECTION_KEYS: (keyof DebriefQuestions)[] = [
  "execution",
  "emotional",
  "relationships",
  "health",
  "awareness",
];

function buildSteps(questions: DebriefQuestions) {
  return SECTION_KEYS.flatMap((sectionKey) =>
    questions[sectionKey].map((question, questionIndex) => ({
      sectionKey,
      questionIndex,
      question,
      responseKey: `${sectionKey}_${questionIndex}`,
    }))
  );
}

function firstOpenStepIndex(steps: ReturnType<typeof buildSteps>, saved: Record<string, string>) {
  const idx = steps.findIndex((step) => !saved[step.responseKey]?.trim());
  return idx === -1 ? steps.length - 1 : idx;
}

export default function NightDebriefPage() {
  const { t, locale } = useLocale();
  const [phase, setPhase] = useState<Phase>("intro");
  const [questions, setQuestions] = useState<DebriefQuestions | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [result, setResult] = useState<NightDebrief | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [resumeHint, setResumeHint] = useState(false);

  const steps = useMemo(() => (questions ? buildSteps(questions) : []), [questions]);

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
        const flat = buildSteps(q);
        const saved = (today?.responses ?? {}) as Record<string, string>;

        if (today?.aiAssessment) {
          setResult(today);
          setPhase("analysis");
          return;
        }

        if (Object.keys(saved).length > 0) {
          setResponses(saved);
          const resumeAt = firstOpenStepIndex(flat, saved);
          setStepIndex(resumeAt);
          setResumeHint(resumeAt > 0);
          setPhase("questions");
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

  const currentStep = steps[stepIndex];
  const currentSection = sections.find((s) => s.key === currentStep?.sectionKey);
  const isLastStep = stepIndex >= steps.length - 1;

  const saveAndNext = async () => {
    if (!currentStep || !currentAnswer.trim()) return;

    setBusy(true);
    try {
      const debrief = await api.saveDebriefAnswer({
        key: currentStep.responseKey,
        answer: currentAnswer.trim(),
        finalize: isLastStep,
      });

      const updated = {
        ...responses,
        [currentStep.responseKey]: currentAnswer.trim(),
      };
      setResponses(updated);
      setCurrentAnswer("");
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);

      if (isLastStep) {
        setResult(debrief);
        setPhase("analysis");
        return;
      }

      setStepIndex(stepIndex + 1);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  if (phase === "intro") {
    const savedCount = Object.values(responses).filter(Boolean).length;
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
          <p className="text-zinc-400 leading-relaxed mb-6">{t("debrief.chamberDesc")}</p>
          <p className="text-sm text-zinc-500 mb-10">{t("debrief.quickNote")}</p>
          {savedCount > 0 ? (
            <button
              type="button"
              onClick={() => {
                setStepIndex(firstOpenStepIndex(steps, responses));
                setPhase("questions");
              }}
              className="px-8 py-3 rounded-2xl bg-indigo-500/30 border border-indigo-400/40 text-indigo-100 hover:bg-indigo-500/40 transition"
            >
              {t("debrief.resume")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPhase("questions")}
              className="px-8 py-3 rounded-2xl bg-indigo-500/30 border border-indigo-400/40 text-indigo-100 hover:bg-indigo-500/40 transition"
            >
              {t("debrief.begin")}
            </button>
          )}
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
          <p className="text-zinc-100 leading-relaxed">
            {localizeApiPhrase(result.aiAssessment ?? "", locale)}
          </p>
        </GlassCard>

        {result.behavioralNotes?.length > 0 && (
          <GlassCard>
            <h2 className="text-xs uppercase tracking-widest text-zinc-500 mb-3">
              {t("debrief.behavioralNotes")}
            </h2>
            <ul className="space-y-2">
              {result.behavioralNotes.map((n) => (
                <li key={n} className="text-sm text-zinc-400 border-l-2 border-indigo-500/30 pl-3">
                  {localizeApiPhrase(n, locale)}
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
            <p className="text-sm text-zinc-300 mb-4">
              {localizeApiPhrase(plan.executionStrategy, locale)}
            </p>
            <p className="text-sm text-indigo-200 mb-4">
              {localizeApiPhrase(plan.focusRecommendation, locale)}
            </p>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-zinc-600 text-xs uppercase mb-2">{t("debrief.priorities")}</p>
                <ul className="text-zinc-400 space-y-1">
                  {plan.topPriorities?.map((p) => (
                    <li key={p}>· {localizeApiPhrase(p, locale)}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-zinc-600 text-xs uppercase mb-2">{t("debrief.warnings")}</p>
                <ul className="text-amber-200/70 space-y-1">
                  {plan.emotionalWarnings?.map((w) => (
                    <li key={w}>· {localizeApiPhrase(w, locale)}</li>
                  ))}
                </ul>
              </div>
            </div>
          </GlassCard>
        )}
      </div>
    );
  }

  if (!currentStep) return null;

  const progress = ((stepIndex + 1) / steps.length) * 100;

  return (
    <div className="min-h-[80vh] flex flex-col max-w-2xl mx-auto">
      <div className="mb-8">
        <div className="h-0.5 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500"
            animate={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 gap-2">
          <p className="text-xs text-zinc-600 uppercase tracking-widest">
            {currentSection?.label} · {t("debrief.questionOf", { n: stepIndex + 1, total: steps.length })}
          </p>
          {savedFlash ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
              <Check className="h-3 w-3" /> {t("debrief.saved")}
            </span>
          ) : resumeHint && stepIndex > 0 ? (
            <span className="text-[10px] text-indigo-400/80">{t("debrief.resumed")}</span>
          ) : null}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep.responseKey}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="flex-1 flex flex-col"
        >
          <h2 className="text-2xl font-light text-zinc-100 leading-snug mb-8">
            {currentStep.question}
          </h2>
          <VoiceTextarea
            value={currentAnswer}
            onChange={setCurrentAnswer}
            placeholder={t("debrief.reflectPlaceholder")}
            rows={5}
            disabled={busy}
            className="flex-1 w-full rounded-2xl glass p-5 text-zinc-100 placeholder:text-zinc-600 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
          />
          <button
            type="button"
            onClick={() => void saveAndNext()}
            disabled={!currentAnswer.trim() || busy}
            className="mt-6 flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-500/30 border border-indigo-400/40 text-indigo-100 disabled:opacity-40 hover:bg-indigo-500/40 transition"
          >
            {busy
              ? isLastStep
                ? t("common.analyzing")
                : t("debrief.saving")
              : isLastStep
                ? t("debrief.finish")
                : t("common.continue")}
            <ChevronRight className="h-4 w-4" />
          </button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
