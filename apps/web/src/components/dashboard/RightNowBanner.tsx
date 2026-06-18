"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Flame, Target } from "lucide-react";
import { api, type ProactiveSnapshot } from "@/lib/api";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { localizeTaskTitle } from "@/lib/i18n/localizeContent";

const KIND_LABEL: Record<string, string> = {
  OVERDUE: "rightNow.kindOverdue",
  DUE_TODAY: "rightNow.kindDueToday",
  FOCUS: "rightNow.kindFocus",
  CLARITY: "rightNow.kindClarity",
};

export function RightNowBanner() {
  const { t, locale } = useLocale();
  const [snap, setSnap] = useState<ProactiveSnapshot | null>(null);

  useEffect(() => {
    api.proactiveSnapshot().then(setSnap).catch(() => setSnap(null));
  }, []);

  if (!snap) return null;
  const { topAction, overdueCount, dueTodayCount } = snap;
  if (!topAction && overdueCount === 0 && dueTodayCount === 0) return null;

  const urgent = topAction?.kind === "OVERDUE";

  return (
    <div
      className={`rounded-2xl border p-4 ${
        urgent
          ? "border-rose-400/30 bg-gradient-to-br from-rose-500/10 to-orange-500/5"
          : "border-emerald-400/25 bg-gradient-to-br from-emerald-500/10 to-teal-500/5"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={`flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] ${
            urgent ? "text-rose-300/90" : "text-emerald-300/90"
          }`}
        >
          {urgent ? <Flame className="h-3 w-3" /> : <Target className="h-3 w-3" />}
          {t("rightNow.title")}
        </span>
        <div className="flex items-center gap-1.5">
          {overdueCount > 0 && (
            <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] text-rose-200">
              {t("rightNow.overdueAlert", { count: overdueCount })}
            </span>
          )}
          {dueTodayCount > 0 && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-200">
              {t("rightNow.dueTodayAlert", { count: dueTodayCount })}
            </span>
          )}
        </div>
      </div>

      {topAction ? (
        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-zinc-400">{t(KIND_LABEL[topAction.kind] ?? "rightNow.kindFocus")}</p>
            <p className="truncate text-base font-light text-zinc-50">
              {localizeTaskTitle(topAction.title, locale)}
            </p>
            {topAction.detail ? (
              <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{topAction.detail}</p>
            ) : null}
          </div>
          <Link
            href={topAction.url}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition ${
              urgent
                ? "bg-rose-500/20 border border-rose-400/40 text-rose-100 hover:bg-rose-500/30"
                : "bg-emerald-500/20 border border-emerald-400/40 text-emerald-100 hover:bg-emerald-500/30"
            }`}
          >
            {t("rightNow.act")}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <p className="mt-2 text-sm text-zinc-400">{t("rightNow.allClear")}</p>
      )}
    </div>
  );
}
