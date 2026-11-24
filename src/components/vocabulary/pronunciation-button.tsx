"use client";
import { useCallback, useEffect, useImperativeHandle, useRef, useState, useSyncExternalStore, type Ref } from "react";
import { Volume2, VolumeX, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Settings } from "@/types";

const subscribeSpeech = () => () => {};
const speechSnapshot = () => typeof window !== "undefined" && "speechSynthesis" in window;
const serverSpeechSnapshot = () => false;

export interface PronunciationButtonHandle {
  speak: () => void;
}

export interface SpeakWordOptions {
  audioUrl?: string;
  settings?: Settings;
  silent?: boolean;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
}

export function speakWord(word: string, options: SpeakWordOptions = {}): { cancel: () => void } {
  const { audioUrl, settings, silent = false, onStart, onEnd, onError } = options;
  const reportError = (message: string) => {
    onEnd?.();
    if (!silent) {
      if (onError) onError(message);
      else toast.error(message);
    }
  };

  if (typeof window === "undefined") {
    return { cancel: () => {} };
  }

  const speechAvailable = "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
  if (!audioUrl && !speechAvailable) {
    reportError("Bu tarayıcı sesli telaffuzu desteklemiyor.");
    return { cancel: () => {} };
  }

  if (audioUrl) {
    const el = new Audio(audioUrl);
    let cancelled = false;
    el.onplay = () => {
      if (!cancelled) onStart?.();
    };
    el.onended = () => {
      if (!cancelled) onEnd?.();
    };
    el.onerror = () => {
      if (!cancelled) reportError("Ses yüklenemedi.");
    };
    void el.play().catch(() => {
      if (!cancelled) reportError("Ses oynatılamadı.");
    });
    return {
      cancel: () => {
        cancelled = true;
        el.pause();
        el.onplay = null;
        el.onended = null;
        el.onerror = null;
      },
    };
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = settings?.voiceAccent ?? "en-GB";
  const voices = window.speechSynthesis.getVoices();
  utterance.voice = voices.find(v => v.lang === utterance.lang) ?? voices.find(v => v.lang.startsWith("en")) ?? null;
  if (!utterance.voice && voices.length) {
    reportError("İngilizce ses paketi bulunamadı. Cihazına İngilizce konuşma sesi ekle.");
    return { cancel: () => {} };
  }
  utterance.rate = settings?.speechRate ?? 0.85;
  let cancelled = false;
  utterance.onstart = () => {
    if (!cancelled) onStart?.();
  };
  utterance.onend = () => {
    if (!cancelled) onEnd?.();
  };
  utterance.onerror = event => {
    if (cancelled) return;
    if (event.error === "canceled" || event.error === "interrupted") {
      onEnd?.();
      return;
    }
    reportError("Telaffuz oynatılamadı.");
  };
  window.speechSynthesis.speak(utterance);
  return {
    cancel: () => {
      cancelled = true;
      window.speechSynthesis.cancel();
    },
  };
}

export function PronunciationButton({
  word,
  audioUrl,
  settings,
  autoPlay = false,
  className,
  ref,
}: {
  word: string;
  audioUrl?: string;
  settings?: Settings;
  autoPlay?: boolean;
  className?: string;
  ref?: Ref<PronunciationButtonHandle>;
}) {
  const speechSupported = useSyncExternalStore(subscribeSpeech, speechSnapshot, serverSpeechSnapshot);
  const supported = !!audioUrl || speechSupported;
  const [playing, setPlaying] = useState(false);
  const activePlayback = useRef<{ cancel: () => void } | null>(null);
  const didAutoPlay = useRef(false);

  const speak = useCallback((options?: { silent?: boolean }) => {
    activePlayback.current?.cancel();
    activePlayback.current = speakWord(word, {
      audioUrl,
      settings,
      silent: options?.silent,
      onStart: () => setPlaying(true),
      onEnd: () => setPlaying(false),
    });
  }, [word, audioUrl, settings]);

  useImperativeHandle(ref, () => ({ speak: () => speak() }), [speak]);

  useEffect(() => {
    return () => {
      activePlayback.current?.cancel();
      activePlayback.current = null;
    };
  }, [audioUrl]);

  useEffect(() => {
    if (!autoPlay || !supported || didAutoPlay.current) return;
    const timer = window.setTimeout(() => {
      if (didAutoPlay.current) return;
      didAutoPlay.current = true;
      speak({ silent: true });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [autoPlay, supported, speak]);

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-lg"
      className={className}
      onClick={() => speak()}
      aria-label={`${word} telaffuzunu dinle`}
      title={audioUrl ? "Ses kaydı" : "Cihazın İngilizce metin-konuşma sesi"}
    >
      {playing ? <Loader2 className="animate-spin" /> : supported ? <Volume2 /> : <VolumeX />}
    </Button>
  );
}
