"use client";

import { Compass } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { getVisionContent } from "@/lib/content/visionSections";

export default function VisionPage() {
  const { locale } = useLocale();
  const { pageTitle, pageSubtitle, paradox, sections } = getVisionContent(locale);

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-12">
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-indigo-300/80">
          <Compass className="h-3.5 w-3.5" />
          Oracle
        </div>
        <h1 className="text-3xl font-light leading-tight text-zinc-50 glow-text md:text-4xl">
          {pageTitle}
        </h1>
        <p className="text-base leading-relaxed text-zinc-400">{pageSubtitle}</p>
      </header>

      <GlassCard glow className="border-indigo-400/20 bg-gradient-to-br from-indigo-500/10 to-violet-500/5">
        <p className="text-sm leading-relaxed text-indigo-100/90 italic">{paradox}</p>
      </GlassCard>

      <div className="space-y-4">
        {sections.map((section, i) => (
          <div key={section.id} id={section.id} className="scroll-mt-24">
            <GlassCard>
            <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-indigo-300/70">
              {String(i + 1).padStart(2, "0")} · {section.title}
            </h2>
            <div className="mt-3 space-y-3">
              {section.paragraphs.map((p) => (
                <p key={p.slice(0, 40)} className="text-sm leading-relaxed text-zinc-300">
                  {p}
                </p>
              ))}
              {section.bullets?.length ? (
                <ul className="space-y-2 ps-4">
                  {section.bullets.map((b) => (
                    <li
                      key={b.slice(0, 40)}
                      className="text-sm leading-relaxed text-zinc-400 list-disc marker:text-indigo-400/60"
                    >
                      {b}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            </GlassCard>
          </div>
        ))}
      </div>
    </div>
  );
}
