"use client";
import { useEffect, useState, useRef, useSyncExternalStore } from "react";
const subscribeSpeech = () => () => {};
const speechSnapshot = () => typeof window !== "undefined" && "speechSynthesis" in window;
const serverSpeechSnapshot = () => false;
import { Volume2, VolumeX, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Settings } from "@/types";
export function PronunciationButton({ word, audioUrl, settings, className }: { word: string; audioUrl?: string; settings?: Settings; className?: string }) {
  const speechSupported = useSyncExternalStore(subscribeSpeech, speechSnapshot, serverSpeechSnapshot);
  const supported = !!audioUrl || speechSupported;
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => { return () => { audio.current?.pause(); if ("speechSynthesis" in window) window.speechSynthesis.cancel(); }; }, [audioUrl]);
  function speak() {
    if (!supported) { toast.error("Bu tarayıcı sesli telaffuzu desteklemiyor."); return; }
    if (audioUrl) { audio.current?.pause(); const el = new Audio(audioUrl); audio.current = el; setPlaying(true); el.onended = () => setPlaying(false); el.onerror = () => { setPlaying(false); toast.error("Ses yüklenemedi."); }; void el.play().catch(() => { setPlaying(false); toast.error("Ses oynatılamadı."); }); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = settings?.voiceAccent ?? "en-GB";
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find(v => v.lang === utterance.lang) ?? voices.find(v => v.lang.startsWith("en")) ?? null;
    if (!utterance.voice && voices.length) { toast.error("İngilizce ses paketi bulunamadı. Cihazına İngilizce konuşma sesi ekle."); return; }
    utterance.rate = settings?.speechRate ?? 0.85; utterance.onstart = () => setPlaying(true); utterance.onend = () => setPlaying(false); utterance.onerror = () => { setPlaying(false); toast.error("Telaffuz oynatılamadı."); }; window.speechSynthesis.speak(utterance);
  }
  return <Button variant="outline" size="icon-lg" className={className} onClick={speak} aria-label={`${word} telaffuzunu dinle`} title={audioUrl ? "Ses kaydı" : "Cihazın İngilizce metin-konuşma sesi"}>{playing ? <Loader2 className="animate-spin" /> : supported ? <Volume2 /> : <VolumeX />}</Button>;
}
