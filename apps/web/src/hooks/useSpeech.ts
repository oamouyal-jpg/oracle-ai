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

export function useSpeechRecognition(options: {
  onTranscript: (text: string, isFinal: boolean) => void;
  lang?: string;
}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognition | null>(null);
  const onTranscriptRef = useRef(options.onTranscript);
  onTranscriptRef.current = options.onTranscript;

  useEffect(() => {
    setSupported(speechRecognitionSupported());
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (!speechRecognitionSupported()) {
      setError("Voice input is not supported in this browser. Try Chrome or Edge.");
      return;
    }
    setError(null);
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = options.lang ?? "en-US";

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        const t = r[0]?.transcript ?? "";
        if (r.isFinal) final += t;
        else interim += t;
      }
      if (final) onTranscriptRef.current(final.trim(), true);
      else if (interim) onTranscriptRef.current(interim.trim(), false);
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error !== "aborted") {
        setError(e.error === "not-allowed" ? "Microphone permission denied." : "Voice input failed.");
      }
      setListening(false);
    };

    rec.onend = () => setListening(false);

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
