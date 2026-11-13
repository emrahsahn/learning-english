"use client";

import { WordSensesList } from "@/components/vocabulary/word-senses";

import { useRef, useState } from "react";
import { Bookmark, CalendarClock, Check, Loader2, Quote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PronunciationButton } from "@/components/vocabulary/pronunciation-button";
import { repository, useLearningData } from "@/lib/storage/repository";
import { isDue } from "@/lib/learning/scheduler";
import type { LearningStatus, Settings, VocabularyWord, WordProgress } from "@/types";

export const STATUS_LABELS: Record<LearningStatus, string> = {
  new: "Yeni", learning: "Öğreniliyor", learned: "Öğrenildi",
};

const POS_LABELS: Record<string, string> = {
  noun: "İsim", "n.": "İsim", n: "İsim",
  verb: "Fiil", "v.": "Fiil", v: "Fiil",
  adjective: "Sıfat", "adj.": "Sıfat", adj: "Sıfat",
  adverb: "Zarf", "adv.": "Zarf", adv: "Zarf",
  pronoun: "Zamir", preposition: "Edat", conjunction: "Bağlaç",
  determiner: "Belirleyici", exclamation: "Ünlem", "modal verb": "Kip fiili",
  "auxiliary verb": "Yardımcı fiil", number: "Sayı", article: "Tanımlık",
  "indefinite article": "Belirsiz tanımlık", "definite article": "Belirli tanımlık",
};

export function partOfSpeechLabel(value: string) {
  return value.trim().split(/[,;/]+/).map(part => {
    const normalized = part.trim().toLowerCase();
    return POS_LABELS[normalized] ?? part.trim();
  }).filter(Boolean).join(" · ") || "Kelime türü belirtilmemiş";
}

export function formatReviewDate(value: string | null | undefined) {
  if (!value) return "Henüz planlanmadı";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Tarih bilgisi yok";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(date);
}

export function WordDetail({ word, progress, settings }: {
  word: VocabularyWord;
  progress?: WordProgress;
  settings?: Settings;
}) {
  const { data } = useLearningData();
  const currentProgress = data?.progress.find(item => item.wordId === word.id) ?? progress;
  const favorite = currentProgress?.favorite ?? false;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const synonyms = word.synonyms?.filter(value => value.trim()) ?? [];
  const antonyms = word.antonyms?.filter(value => value.trim()) ?? [];

  async function toggleFavorite() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await repository.toggleFavorite(word.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Favori kaydedilemedi. Yeniden deneyin.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <article className="space-y-6 text-foreground">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="h-6 bg-primary/10 px-3 text-primary">{word.cefrLevel}</Badge>
        <Badge variant="outline" className="h-6">{partOfSpeechLabel(word.partOfSpeech)}</Badge>
        <Badge variant="secondary" className="h-6">{STATUS_LABELS[currentProgress?.status ?? "new"]}</Badge>
        {isDue(currentProgress) && <Badge variant="outline" className="h-6 border-primary/20 text-primary">Tekrar zamanı</Badge>}
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 lang="en" className="break-words font-heading text-4xl font-semibold tracking-tight sm:text-5xl">{word.word}</h2>
          <p lang="en" className="mt-3 font-mono text-sm text-muted-foreground">
            {word.pronunciation.trim() || "IPA telaffuz bilgisi eklenmemiş"}
          </p>
        </div>
        <PronunciationButton word={word.word} audioUrl={word.audioUrl} settings={settings ?? data?.settings} className="size-12 shrink-0 rounded-2xl border-primary/20 bg-primary/5 text-primary" />
      </div>

      <section className="rounded-2xl border border-primary/10 bg-primary/5 p-5">
        <h3 className="text-xs font-semibold tracking-widest text-primary uppercase">Türkçe anlamı</h3>
        <p className="mt-3 whitespace-pre-line text-xl leading-relaxed">
          {word.turkishMeaning.trim() || "Türkçe anlam henüz eklenmemiş."}
        </p>
        {!word.turkishMeaning.trim() && <p className="mt-2 text-sm text-muted-foreground">İçe aktarılan kaynakta çeviri bulunmuyor. Anlam tahmin edilmez.</p>}
      </section>

      {word.senses && word.senses.length > 0 ? (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Quote className="size-4 text-primary" aria-hidden="true" /> Farklı anlamlar ve örnek cümleler</h3>
          <WordSensesList senses={word.senses} />
        </section>
      ) : (word.exampleSentence?.trim() || word.exampleTranslation?.trim()) ? (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Quote className="size-4 text-primary" aria-hidden="true" /> Bağlam içinde</h3>
          <blockquote className="space-y-2 border-l-2 border-primary/25 pl-4">
            {word.exampleSentence?.trim() && <p lang="en" className="text-base leading-relaxed">{word.exampleSentence}</p>}
            {word.exampleTranslation?.trim() && <p className="leading-relaxed text-muted-foreground">{word.exampleTranslation}</p>}
          </blockquote>
        </section>
      ) : null}

      {(synonyms.length > 0 || antonyms.length > 0) && (
        <div className="grid gap-5 sm:grid-cols-2">
          {synonyms.length > 0 && <section><h3 className="mb-3 text-sm font-semibold">Eş anlamlılar</h3><div className="flex flex-wrap gap-2">{synonyms.map((value, index) => <Badge lang="en" variant="secondary" className="h-auto whitespace-normal py-1" key={`${value}-${index}`}>{value}</Badge>)}</div></section>}
          {antonyms.length > 0 && <section><h3 className="mb-3 text-sm font-semibold">Zıt anlamlılar</h3><div className="flex flex-wrap gap-2">{antonyms.map((value, index) => <Badge lang="en" variant="outline" className="h-auto whitespace-normal py-1" key={`${value}-${index}`}>{value}</Badge>)}</div></section>}
        </div>
      )}

      <section className="rounded-2xl border bg-muted/30 p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><CalendarClock className="size-4 text-primary" aria-hidden="true" /> Öğrenme geçmişi</h3>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Değerlendirme sayısı</dt><dd className="mt-1 font-medium">{currentProgress?.reviewCount ?? 0}</dd></div>
          <div><dt className="text-muted-foreground">Son çalışma</dt><dd className="mt-1 font-medium">{currentProgress?.lastReviewDate ? formatReviewDate(currentProgress.lastReviewDate) : "Henüz çalışılmadı"}</dd></div>
          <div className="sm:col-span-2"><dt className="text-muted-foreground">Sonraki tekrar</dt><dd className="mt-1 font-medium">{formatReviewDate(currentProgress?.nextReviewDate)}</dd></div>
        </dl>
      </section>

      <div className="space-y-3 border-t pt-5">
        <Button variant={favorite ? "secondary" : "outline"} className="h-11 rounded-xl px-4" aria-pressed={favorite} disabled={busy} onClick={() => void toggleFavorite()}>
          {busy ? <Loader2 className="animate-spin" /> : favorite ? <Check /> : <Bookmark />}
          {favorite ? "Favorilerden çıkar" : "Favorilere ekle"}
        </Button>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {word.dictionarySource?.trim() && <p className="break-words text-xs text-muted-foreground">Kaynak: {word.dictionarySource}</p>}
      </div>
    </article>
  );
}
