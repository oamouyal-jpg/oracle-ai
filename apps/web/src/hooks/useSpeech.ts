"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function speechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function speechSynthesisSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "speechSynthesis" in window;
}

/** Collapse stutter repeats from the speech engine (e.g. "hello hello hello"). */
export function normalizeSpeechSession(text: string): string {
  let s = text.replace(/\s+/g, " ").trim();
  if (!s) return "";

  const words = s.split(" ").filter(Boolean);
  const deduped: string[] = [];
  for (const w of words) {
    const prev = deduped[deduped.length - 1];
    if (!prev || w.toLowerCase() !== prev.toLowerCase()) deduped.push(w);
  }
  s = deduped.join(" ");

  // "hello world hello world" → "hello world"
  if (s.length > 6) {
    for (let split = Math.floor(s.length / 2); split >= 4; split--) {
      const head = s.slice(0, split).trim();
      const tail = s.slice(split).trim();
      if (tail === head || tail.startsWith(`${head} `) || tail.startsWith(head)) {
        s = head;
        break;
      }
    }
  }

  return s;
}

/**
 * Merge pre-mic text with the current listening session.
 * Session replaces in place while listening — never stack on itself.
 */
export function mergeVoiceIntoField(prefix: string, sessionText: string): string {
  const base = prefix.trimEnd();
  const session = normalizeSpeechSession(sessionText);
  if (!session) return base;
  if (!base) return session;

  const baseLower = base.toLowerCase();
  const sessionLower = session.toLowerCase();

  if (baseLower === sessionLower) return base;
  if (baseLower.endsWith(sessionLower)) return base;
  if (sessionLower.startsWith(baseLower)) {
    return session.slice(base.length).trimStart() ? session : base;
  }

  return `${base} ${session}`;
}

export function useSpeechRecognition(options: {
  onTranscript: (sessionText: string, isFinal: boolean) => void;
  lang?: string;
}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognition | null>(null);
  const onTranscriptRef = useRef(options.onTranscript);
  const committedRef = useRef("");
  const lastEmittedRef = useRef("");
  onTranscriptRef.current = options.onTranscript;

  useEffect(() => {
    setSupported(speechRecognitionSupported());
  }, []);

  const resetSession = useCallback(() => {
    committedRef.current = "";
    lastEmittedRef.current = "";
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
    resetSession();
  }, [resetSession]);

  const start = useCallback(() => {
    if (!speechRecognitionSupported()) {
      setError("Voice input is not supported in this browser. Try Chrome or Edge.");
      return;
    }
    setError(null);
    resetSession();

    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = options.lang ?? "en-US";

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        const part = (r[0]?.transcript ?? "").trim();
        if (!part) continue;
        if (r.isFinal) {
          committedRef.current = normalizeSpeechSession(
            `${committedRef.current} ${part}`.trim()
          );
        } else {
          interim = interim ? `${interim} ${part}` : part;
        }
      }

      const sessionText = normalizeSpeechSession(
        interim ? `${committedRef.current} ${interim}`.trim() : committedRef.current
      );
      const hasInterim = interim.length > 0;

      if (!sessionText || sessionText === lastEmittedRef.current) return;
      lastEmittedRef.current = sessionText;
      onTranscriptRef.current(sessionText, !hasInterim);
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error !== "aborted") {
        setError(e.error === "not-allowed" ? "Microphone permission denied." : "Voice input failed.");
      }
      setListening(false);
      resetSession();
    };

    rec.onend = () => {
      setListening(false);
      resetSession();
    };

    recRef.current = rec;
    rec.start();
    setListening(true);
  }, [options.lang, resetSession]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  return { listening, supported, error, start, stop, toggle };
}

export function useSpeechSynthesis(lang = "en-US") {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);
  const langRef = useRef(lang);
  langRef.current = lang;

  useEffect(() => {
    setSupported(speechSynthesisSupported());
    return () => {
      if (typeof window !== "undefined") window.speechSynthesis.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    if (typeof window !== "undefined") window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!speechSynthesisSupported() || !text.trim()) return;
      stop();
      const utter = new SpeechSynthesisUtterance(text.trim());
      utter.lang = langRef.current;
      utter.rate = 0.92;
      utter.pitch = 1;
      utter.onend = () => setSpeaking(false);
      utter.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(utter);
    },
    [stop]
  );

  const toggle = useCallback(
    (text: string) => {
      if (speaking) stop();
      else speak(text);
    },
    [speak, speaking, stop]
  );

  return { speak, stop, toggle, speaking, supported };
}
