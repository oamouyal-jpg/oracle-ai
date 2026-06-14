"use client";

import { motion } from "framer-motion";
import { Sparkles, ArrowDown } from "lucide-react";
import type { DailyOracleLine } from "@/lib/api";

type Props = {
  line: DailyOracleLine;
  loading?: boolean;
  onContinue: () => void;
  t: (key: string) => string;
};

export function DailyOracleMoment({ line, loading, onContinue, t }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 py-12 bg-[#07070c]/95 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-lg flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-indigo-400/30 bg-indigo-500/10"
        >
          <Sparkles className="h-5 w-5 text-indigo-300" />
        </motion.div>

        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-indigo-300/80">
          {t("dailyOracle.label")}
        </p>

        {loading ? (
          <motion.p
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="mt-8 text-sm tracking-wide text-zinc-500"
          >
            {t("dailyOracle.generating")}
          </motion.p>
        ) : (
          <>
            <motion.h1
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.55 }}
              className="mt-6 font-display text-2xl font-light leading-snug text-zinc-50 glow-text sm:text-3xl"
            >
              {line.line}
            </motion.h1>
            {line.subline ? (
              <motion.p
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="mt-4 text-sm leading-relaxed text-zinc-400"
              >
                {line.subline}
              </motion.p>
            ) : null}
          </>
        )}

        <motion.button
          type="button"
          disabled={loading}
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.45 }}
          onClick={onContinue}
          className="mt-12 flex items-center gap-2 rounded-2xl border border-indigo-400/35 bg-indigo-500/20 px-8 py-3.5 text-sm text-indigo-100 transition hover:bg-indigo-500/30 disabled:opacity-40"
        >
          {t("dailyOracle.continue")}
          <ArrowDown className="h-4 w-4" />
        </motion.button>

        <p className="mt-6 text-[11px] text-zinc-600">{t("dailyOracle.hint")}</p>
      </div>
    </motion.div>
  );
}
