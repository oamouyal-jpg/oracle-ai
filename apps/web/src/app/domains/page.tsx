"use client";

import { useEffect, useMemo, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { api, type Domain } from "@/lib/api";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { localizeDomain } from "@/lib/i18n/localizeContent";

export default function DomainsPage() {
  const { t, locale } = useLocale();
  const [domains, setDomains] = useState<Domain[]>([]);

  useEffect(() => {
    api.domains().then(setDomains).catch(console.error);
  }, [locale]);

  const localized = useMemo(
    () => domains.map((d) => localizeDomain(d, locale)),
    [domains, locale]
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-light text-zinc-50 glow-text">{t("domains.pageTitle")}</h1>
        <p className="text-zinc-500 mt-1">{t("domains.pageSubtitle")}</p>
      </header>

      {localized.length === 0 ? (
        <p className="text-zinc-500 text-sm">{t("common.loading")}</p>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {localized.map((d, i) => (
            <GlassCard key={d.id} delay={i * 0.05} glow={d.progress < 45}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-2xl">{d.icon}</span>
                  <h2 className="text-lg font-medium text-zinc-100 mt-2">{d.name}</h2>
                  <p className="text-sm text-zinc-500 mt-1">
                    {d.currentState ?? t("common.dash")}
                  </p>
                </div>
                <ProgressRing value={d.progress} size={56} color={d.color} />
              </div>
              {d.goals.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/5">
                  <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">
                    {t("domains.goals")}
                  </p>
                  <ul className="text-sm text-zinc-400 space-y-1">
                    {d.goals.map((g) => (
                      <li key={g}>· {g}</li>
                    ))}
                  </ul>
                </div>
              )}
              {d.activeIssues.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {d.activeIssues.map((issue) => (
                    <span
                      key={issue}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-200/80 border border-amber-500/20"
                    >
                      {issue}
                    </span>
                  ))}
                </div>
              )}
              {d.aiObservations && (
                <p className="mt-3 text-xs text-indigo-300/80 italic">{d.aiObservations}</p>
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
