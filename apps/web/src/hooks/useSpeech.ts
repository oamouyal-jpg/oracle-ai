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
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length === 0) return "";
  const out: string[] = [words[0]!];
  for (let i = 1; i < words.length; i++) {
    const w = words[i]!;
    const prev = out[out.length - 1]!;
    if (w.toLowerCase() !== prev.toLowerCase()) out.push(w);
  }
  return out.join(" ");
}

/** Merge text that existed before mic started with the current utterance session. */
export function mergeVoiceIntoField(prefix: string, sessionText: string): string {
  const base = prefix.trimEnd();
  const session = normalizeSpeechSession(sessionText);
  if (!session) return base;
  return base ? `${base} ${session}` : session;
}

/** @deprecated Use mergeVoiceIntoField with value/onValueChange on SpeechInputButton instead. */
export function appendVoiceTranscript(prev: string, chunk: string, isFinal: boolean): string {
  return mergeVoiceIntoField(prev.replace(/\s*\[…\]$/, "").trimEnd(), chunk);
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
  const lastSessionRef = useRef("");
  onTranscriptRef.current = options.onTranscript;

  useEffect(() => {
    setSupported(speechRecognitionSupported());
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
    lastSessionRef.current = "";
  }, []);

  const start = useCallback(() => {
    if (!speechRecognitionSupported()) {
      setError("Voice input is not supported in this browser. Try Chrome or Edge.");
      return;
    }
    setError(null);
    lastSessionRef.current = "";
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = options.lang ?? "en-US";

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let committed = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        const part = r[0]?.transcript ?? "";
        if (r.isFinal) committed += part;
        else interim += part;
      }
      const sessionText = normalizeSpeechSession(committed + interim);
      const hasInterim = interim.trim().length > 0;
      if (sessionText === lastSessionRef.current && hasInterim) return;
      lastSessionRef.current = sessionText;
      onTranscriptRef.current(sessionText, !hasInterim);
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error !== "aborted") {
        setError(e.error === "not-allowed" ? "Microphone permission denied." : "Voice input failed.");
      }
      setListening(false);
      lastSessionRef.current = "";
    };

    rec.onend = () => {
      setListening(false);
      lastSessionRef.current = "";
    };

    recRef.current = rec;
    rec.start();
    setListening(true);
  }, [options.lang]);

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
