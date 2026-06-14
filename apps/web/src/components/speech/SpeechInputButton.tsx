"use client";

import { useRef } from "react";
import { Mic, MicOff } from "lucide-react";
import { clsx } from "clsx";
import { mergeVoiceIntoField, useSpeechRecognition } from "@/hooks/useSpeech";

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  onListeningChange?: (listening: boolean) => void;
  disabled?: boolean;
  className?: string;
  title?: string;
  lang?: string;
};

export function SpeechInputButton({
  value,
  onValueChange,
  onListeningChange,
  disabled,
  className,
  title = "Voice input",
  lang,
}: Props) {
  const prefixRef = useRef("");

  const { listening, supported, error, toggle, stop } = useSpeechRecognition({
    lang,
    onTranscript: (sessionText, isFinal) => {
      onValueChange(mergeVoiceIntoField(prefixRef.current, sessionText));
      onListeningChange?.(!isFinal);
      if (isFinal) {
        prefixRef.current = mergeVoiceIntoField(prefixRef.current, sessionText);
      }
    },
  });

  if (!supported) return null;

  const handleToggle = () => {
    if (listening) {
      stop();
      onListeningChange?.(false);
      return;
    }
    prefixRef.current = value.trimEnd();
    onListeningChange?.(true);
    toggle();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        title={listening ? "Stop listening" : title}
        aria-label={listening ? "Stop listening" : title}
        className={clsx(
          "flex items-center justify-center rounded-2xl border transition-all disabled:opacity-40",
          listening
            ? "bg-rose-500/25 border-rose-400/50 text-rose-200 animate-pulse"
            : "bg-white/5 border-white/10 text-zinc-400 hover:text-zinc-200 hover:bg-white/10",
          className ?? "h-12 w-12"
        )}
      >
        {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
      </button>
      {error && (
        <p className="absolute right-0 top-full mt-1 z-10 w-48 text-[10px] text-amber-300 bg-zinc-900/95 border border-amber-500/30 rounded-lg px-2 py-1">
          {error}
        </p>
      )}
    </div>
  );
}
