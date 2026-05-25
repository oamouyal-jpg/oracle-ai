"use client";

import { Volume2, VolumeX } from "lucide-react";
import { clsx } from "clsx";
import { useSpeechSynthesis } from "@/hooks/useSpeech";

type Props = {
  text: string;
  className?: string;
  label?: string;
  lang?: string;
  stopLabel?: string;
};

export function SpeakButton({
  text,
  className,
  label = "Listen",
  lang,
  stopLabel = "Stop",
}: Props) {
  const { toggle, speaking, supported } = useSpeechSynthesis(lang);

  if (!supported || !text.trim()) return null;

  return (
    <button
      type="button"
      onClick={() => toggle(text)}
      title={speaking ? "Stop speaking" : label}
      aria-label={speaking ? "Stop speaking" : label}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs border transition-all",
        speaking
          ? "bg-cyan-500/20 border-cyan-400/40 text-cyan-200"
          : "bg-white/5 border-white/10 text-zinc-500 hover:text-zinc-300",
        className
      )}
    >
      {speaking ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
      {speaking ? stopLabel : label}
    </button>
  );
}
