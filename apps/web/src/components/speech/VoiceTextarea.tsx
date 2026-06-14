"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { SpeechInputButton } from "./SpeechInputButton";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type Props = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange"
> & {
  value: string;
  onChange: (value: string) => void;
  lang?: string;
  wrapperClassName?: string;
};

export function VoiceTextarea({
  value,
  onChange,
  lang,
  wrapperClassName,
  className,
  placeholder,
  disabled,
  ...rest
}: Props) {
  const { t, speechLang } = useLocale();
  const [listening, setListening] = useState(false);

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
}
