"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { SpeechInputButton } from "@/components/speech/SpeechInputButton";
import { SpeakButton } from "@/components/speech/SpeakButton";
import { api, type ChatMessage } from "@/lib/api";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export default function ChatPage() {
  const { t, speechLang } = useLocale();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [voiceHint, setVoiceHint] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const appendVoice = (chunk: string, isFinal: boolean) => {
    if (!chunk) return;
    setVoiceHint(!isFinal);
    setInput((prev) => {
      if (!isFinal) {
        const base = prev.replace(/\s*\[…\]$/, "");
        return `${base}${base && !base.endsWith(" ") ? " " : ""}${chunk} […]`;
      }
      const base = prev.replace(/\s*\[…\]$/, "").trimEnd();
      return `${base}${base ? " " : ""}${chunk}`;
    });
  };

  useEffect(() => {
    api.chatHistory().then(setMessages).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput("");
    setMessages((m) => [
      ...m,
      {
        id: `t-${Date.now()}`,
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      },
    ]);
    setLoading(true);
    try {
      const { reply } = await api.chat(text);
      setMessages((m) => [
        ...m,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: reply,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-3xl">
      <header className="mb-6">
        <h1 className="text-3xl font-light text-zinc-50 glow-text">{t("chat.title")}</h1>
        <p className="text-zinc-500 mt-1">{t("chat.subtitle")}</p>
      </header>

      <GlassCard className="flex-1 flex flex-col min-h-0 mb-4 overflow-hidden">
        <div className="flex-1 overflow-y-auto scrollbar-thin space-y-4 p-1">
          {messages.length === 0 && (
            <p className="text-zinc-500 text-sm text-center py-12">
              {t("chat.askPlaceholder")}
            </p>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={
                msg.role === "user"
                  ? "ml-8 text-right"
                  : "mr-8 border-l-2 border-indigo-500/40 pl-4"
              }
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-[10px] uppercase tracking-widest text-zinc-600">
                  {msg.role === "user" ? t("common.you") : t("common.oracle")}
                </p>
                {msg.role === "assistant" && (
                  <SpeakButton
                    text={msg.content}
                    label={t("common.listen")}
                    lang={speechLang}
                    stopLabel={t("common.stop")}
                  />
                )}
              </div>
              <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                {msg.content}
              </p>
            </div>
          ))}
          {loading && (
            <p className="text-indigo-400/60 text-sm animate-pulse">{t("chat.thinking")}</p>
          )}
          <div ref={bottomRef} />
        </div>
      </GlassCard>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex gap-2 items-center"
      >
        <SpeechInputButton
          onTranscript={appendVoice}
          disabled={loading}
          lang={speechLang}
        />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={voiceHint ? t("chat.listening") : t("chat.placeholder")}
          className="flex-1 rounded-2xl glass px-5 py-3 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-5 rounded-2xl bg-indigo-500/30 border border-indigo-400/40 text-indigo-100 hover:bg-indigo-500/40 disabled:opacity-50"
        >
          <Send className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
