"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { clsx } from "clsx";
import { SpeechInputButton, type SpeechInputHandle } from "./SpeechInputButton";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export type VoiceTextareaHandle = {
  stopListening: () => void;
};

type Props = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange"
> & {
  value: string;
  onChange: (value: string) => void;
  lang?: string;
  wrapperClassName?: string;
};

export const VoiceTextarea = forwardRef<VoiceTextareaHandle, Props>(function VoiceTextarea(
  { value, onChange, lang, wrapperClassName, className, placeholder, disabled, ...rest },
  ref
) {
  const { t, speechLang } = useLocale();
  const [listening, setListening] = useState(false);
  const micRef = useRef<SpeechInputHandle>(null);

  useImperativeHandle(
    ref,
    () => ({
      stopListening: () => micRef.current?.stop(),
    }),
    []
  );

  useEffect(() => {
    return () => micRef.current?.stop();
  }, []);

  return (
    <div className={clsx("flex gap-2 items-start", wrapperClassName)}>
      <textarea
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={listening ? t("chat.listening") : placeholder}
        disabled={disabled}
        className={clsx("flex-1 min-w-0", className)}
      />
      <SpeechInputButton
        ref={micRef}
        className="h-10 w-10 shrink-0 rounded-xl"
        lang={lang ?? speechLang}
        title={t("speech.voiceInput")}
        value={value}
        onValueChange={onChange}
        onListeningChange={setListening}
        disabled={disabled}
      />
    </div>
  );
});
