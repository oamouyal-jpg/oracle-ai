"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Sparkles } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { api, type OnboardingQuestion } from "@/lib/api";
import { useAuth } from "@/lib/AuthProvider";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { getSession, setSession } from "@/lib/session";

export default function OnboardingPage() {
  const { t } = useLocale();
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [questions, setQuestions] = useState<OnboardingQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .onboardingQuestions()
      .then((res) => {
        if (res.complete) {
          router.replace("/");
          return;
        }
        setQuestions(res.questions);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [router]);

  const q = questions[index];
  const progress = questions.length > 0 ? ((index + 1) / questions.length) * 100 : 0;

  const saveAndNext = async () => {
    if (!q || !current.trim()) return;
    const updated = { ...answers, [q.id]: current.trim() };
    setAnswers(updated);
    setCurrent("");

    if (index < questions.length - 1) {
      setIndex(index + 1);
      return;
    }

    setSubmitting(true);
    try {
      await api.completeOnboarding(updated);
      const session = getSession();
      if (session) {
        setSession({
          ...session,
          user: { ...session.user, onboardingComplete: true },
        });
      }
      await refreshUser();
      router.replace("/");
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-500">
        {t("auth.onboardingLoading")}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="flex items-center gap-2 text-indigo-400 mb-6">
        <Sparkles className="h-5 w-5" />
        <span className="text-xs uppercase tracking-[0.3em]">Oracle</span>
      </div>
      <div className="w-full max-w-2xl mb-6">
        <div className="h-0.5 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500"
            animate={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-zinc-600 mt-2 uppercase tracking-widest">
          {t("auth.onboardingProgress", { current: index + 1, total: questions.length })}
        </p>
      </div>
      <GlassCard className="w-full max-w-2xl p-8">
        <p className="text-sm text-indigo-300/80 mb-2">
          {t("auth.onboardingGreeting", { name: user?.name ?? "" })}
        </p>
        <AnimatePresence mode="wait">
          {q && (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <h2 className="text-xl font-light text-zinc-100 leading-snug mb-6">{q.question}</h2>
              <textarea
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                placeholder={q.placeholder}
                rows={5}
                className="w-full rounded-2xl glass p-5 text-zinc-100 placeholder:text-zinc-600 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              />
              <button
                type="button"
                onClick={saveAndNext}
                disabled={!current.trim() || submitting}
                className="mt-6 flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-indigo-500/30 border border-indigo-400/40 text-indigo-100 disabled:opacity-40 hover:bg-indigo-500/40 transition"
              >
                {submitting
                  ? t("common.analyzing")
                  : index < questions.length - 1
                    ? t("common.continue")
                    : t("auth.finishOnboarding")}
                <ChevronRight className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>
    </div>
  );
}
