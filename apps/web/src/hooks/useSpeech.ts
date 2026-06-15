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

/** Collapse stutter repeats (e.g. "math math math" → "math"). */
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

  if (s.length > 6) {
    for (let split = Math.floor(s.length / 2); split >= 4; split--) {
      const head = s.slice(0, split).trim();
      const tail = s.slice(split).trim();
      if (tail === head || tail.startsWith(`${head} `)) {
        s = head;
        break;
      }
    }
  }

  return s;
}

/**
 * Join finalized speech with a new chunk.
 * Mobile Chrome often sends cumulative text ("hello" → "hello world") — don't stack.
 */
export function joinSpeechParts(prior: string, chunk: string): string {
  const a = normalizeSpeechSession(prior);
  const c = normalizeSpeechSession(chunk);
  if (!c) return a;
  if (!a) return c;

  const aL = a.toLowerCase();
  const cL = c.toLowerCase();

  if (aL === cL) return a;
  if (cL.startsWith(aL)) return c;
  if (aL.endsWith(cL)) return a;

  return normalizeSpeechSession(`${a} ${c}`);
}

/** Fixed prefix (typed before mic) + full spoken session so far. */
export function mergeVoiceIntoField(prefix: string, sessionText: string): string {
  const base = prefix.trimEnd();
  const session = normalizeSpeechSession(sessionText);
  if (!session) return base;
  return base ? `${base} ${session}` : session;
}

function extractLastChunk(event: SpeechRecognitionEvent): {
  text: string;
  isFinal: boolean;
} | null {
  if (event.results.length === 0) return null;
  const last = event.results[event.results.length - 1];
  if (!last) return null;
  const text = (last[0]?.transcript ?? "").trim();
  if (!text) return null;
  return { text, isFinal: last.isFinal };
}

export function useSpeechRecognition(options: {
  onTranscript: (sessionText: string, isFinal: boolean) => void;
  lang?: string;
}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<SpeechRecognition | null>(null);
  const activeRef = useRef(false);
  const onTranscriptRef = useRef(options.onTranscript);
  /** Finalized phrases this mic session (across auto-restarts). */
  const committedRef = useRef("");
  /** Current in-progress phrase — replaced each interim, not appended. */
  const liveRef = useRef("");
  const lastEmittedRef = useRef("");

  onTranscriptRef.current = options.onTranscript;

  useEffect(() => {
    setSupported(speechRecognitionSupported());
  }, []);

  const emitSession = useCallback((isFinal: boolean) => {
    const session = liveRef.current
      ? joinSpeechParts(committedRef.current, liveRef.current)
      : committedRef.current;
    if (!session || session === lastEmittedRef.current) return;
    lastEmittedRef.current = session;
    onTranscriptRef.current(session, isFinal);
  }, []);

  const resetSession = useCallback(() => {
    committedRef.current = "";
    liveRef.current = "";
    lastEmittedRef.current = "";
  }, []);

  const stop = useCallback(() => {
    activeRef.current = false;
    const rec = recRef.current;
    recRef.current = null;
    if (rec) {
      rec.onend = null;
      rec.onresult = null;
      rec.onerror = null;
      try {
        if (typeof rec.abort === "function") rec.abort();
        else rec.stop();
      } catch {
        /* already stopped */
      }
    }
    setListening(false);
    resetSession();
  }, [resetSession]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") stop();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [stop]);

  const bindRecognition = useCallback(
    (rec: SpeechRecognition) => {
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = options.lang ?? "en-US";

      rec.onresult = (event: SpeechRecognitionEvent) => {
        const chunk = extractLastChunk(event);
        if (!chunk) return;

        if (chunk.isFinal) {
          committedRef.current = joinSpeechParts(committedRef.current, chunk.text);
          liveRef.current = "";
          emitSession(true);
        } else {
          liveRef.current = chunk.text;
          emitSession(false);
        }
      };

      rec.onerror = (e: SpeechRecognitionErrorEvent) => {
        if (e.error === "aborted") return;
        if (e.error !== "no-speech") {
          setError(
            e.error === "not-allowed"
              ? "Microphone permission denied."
              : "Voice input failed."
          );
        }
        activeRef.current = false;
        setListening(false);
        resetSession();
      };

      rec.onend = () => {
        if (!activeRef.current) {
          setListening(false);
          return;
        }
        try {
          rec.start();
        } catch {
          activeRef.current = false;
          setListening(false);
        }
      };
    },
    [emitSession, options.lang, resetSession]
  );

  const start = useCallback(() => {
    if (!speechRecognitionSupported()) {
      setError("Voice input is not supported in this browser. Try Chrome or Edge.");
      return;
    }
    setError(null);
    resetSession();
    activeRef.current = true;

    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new Ctor();
    bindRecognition(rec);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }, [bindRecognition, resetSession]);

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
