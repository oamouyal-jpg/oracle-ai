"use client";

import { clsx } from "clsx";
import { Languages } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { LOCALES } from "@/lib/i18n/messages";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, t } = useLocale();

  return (
    <div className={clsx("flex flex-col gap-2", className)}>
      <p className="text-[10px] text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
        <Languages className="h-3 w-3" />
        {t("language.label")}
      </p>
      <div className="flex flex-col gap-1 rounded-lg border border-white/10 overflow-hidden text-xs">
        {LOCALES.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code)}
            className={clsx(
              "w-full px-2 py-1.5 text-start transition-colors",
              locale === code
                ? "bg-indigo-500/30 text-indigo-100"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
            )}
          >
            {t(`language.${code}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
