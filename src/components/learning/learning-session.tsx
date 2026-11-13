"use client";

import { WordSensesList } from "@/components/vocabulary/word-senses";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowRight, BookOpen, CalendarClock, Check, CheckCircle2, ChevronRight, Clock3, Eye, Flag, Loader2, RotateCcw, Sparkles, Target } from "lucide-react";
import { EmptyDataset, LoadingState, StorageError } from "@/components/data-boundary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PronunciationButton } from "@/components/vocabulary/pronunciation-button";
import { formatReviewDate, partOfSpeechLabel } from "@/components/vocabulary/word-detail";
import { buildSession, dailyCounts, isDue } from "@/lib/learning/scheduler";
import { repository, useLearningData } from "@/lib/storage/repository";
import type { Rating, Settings, Snapshot, VocabularyWord, WordProgress } from "@/types";

type Mode = "learn" | "review";
type SavedRating = { eventId: string; wordId: string; rating: Rating };
const RATING_OPTIONS: { value: Rating; label: string; description: string; key: string }[] = [
  { value: "again", label: "Tekrar et", description: "Hatırlayamadım", key: "1" },
  { value: "hard", label: "Zorlandım", description: "Biraz düşündüm", key: "2" },
  { value: "good", label: "Hatırladım", description: "Rahatça bildim", key: "3" },
];

function reviewOverview(snapshot: Snapshot, now = new Date()) {
  const vocabularyIds = new Set(snapshot.vocabulary.map(word => word.id));
  const progress = snapshot.progress.filter(item => vocabularyIds.has(item.wordId));
  const due = progress.filter(item => isDue(item, now)).length;
  const upcoming = progress.filter(item => item.nextReviewDate && new Date(item.nextReviewDate).getTime() > now.getTime()).sort((a, b) => new Date(a.nextReviewDate!).getTime() - new Date(b.nextReviewDate!).getTime())[0]?.nextReviewDate;
  return { due, upcoming };
}

export function LearningSession({ mode }: { mode: Mode }) {
  const { data, loading, error } = useLearningData();
  const [sessionNumber, setSessionNumber] = useState(0);
  if (loading) return <LoadingState />;
  if (error) return <StorageError message={error} />;
  if (!data) return <StorageError message="Öğrenme verileri okunamadı. Oturum başlatılmadı." />;
  if (data.vocabulary.length === 0) return <EmptyDataset />;

  // Only an explicit restart or a mode change creates a new queue. Live database
  // updates must not filter a successfully rated word out of the active session.
  return <ActiveSession key={`${mode}:${sessionNumber}`} mode={mode} snapshot={data} onRestart={() => setSessionNumber(number => number + 1)} />;
}

function ActiveSession({ mode, snapshot, onRestart }: { mode: Mode; snapshot: Snapshot; onRestart: () => void }) {
  const [plan] = useState(() => {
    const startedAt = new Date();
    return { words: buildSession(snapshot, mode, startedAt), startedAt: startedAt.toISOString() };
  });
  const [index, setIndex] = useState(0);
  const [savedRatings, setSavedRatings] = useState<SavedRating[]>([]);
  const [skippedIds, setSkippedIds] = useState<string[]>([]);
  const progressMap = useMemo(() => new Map(snapshot.progress.map(item => [item.wordId, item])), [snapshot.progress]);
  const onSaved = useCallback((record: SavedRating) => {
    setSavedRatings(previous => previous.some(item => item.eventId === record.eventId) ? previous : [...previous, record]);
  }, []);
  const counts = dailyCounts(snapshot);
  const overview = reviewOverview(snapshot);
  const target = mode === "learn" ? snapshot.settings.newWordsPerDay : snapshot.settings.reviewsPerDay;
  const completedToday = mode === "learn" ? counts.newWords : counts.reviews;
  const remaining = Math.max(0, target - completedToday);
  const word = plan.words[index];
  const finished = plan.words.length > 0 && !word;
  const completedCards = savedRatings.length + skippedIds.length;

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-primary uppercase">{mode === "learn" ? <Sparkles className="size-4" aria-hidden="true" /> : <RotateCcw className="size-4" aria-hidden="true" />}{mode === "learn" ? "Her gün küçük bir adım" : "Bilgini kalıcı hâle getir"}</p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{mode === "learn" ? "Yeni kelimeler öğren" : "Tekrar zamanı"}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{mode === "learn" ? "Dinle, anlamını keşfet ve kendi hızında ilerle." : "Zamanı gelen kelimeleri hatırla. Aralıklı tekrar, senin ritmine uyum sağlar."}</p>
        </div>
        <Button asChild variant="ghost" className="self-start text-muted-foreground sm:self-auto"><Link href="/explorer">Kelime kütüphanesi<ChevronRight /></Link></Button>
      </header>

      <dl className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-2xl border bg-card p-4 sm:p-5"><dt className="flex items-center gap-2 text-xs text-muted-foreground"><Target className="hidden size-4 text-primary sm:block" aria-hidden="true" />Günlük hedef</dt><dd className="mt-2 text-2xl font-semibold tabular-nums">{completedToday}<span className="text-base font-normal text-muted-foreground"> / {target}</span></dd></div>
        <div className="rounded-2xl border bg-card p-4 sm:p-5"><dt className="flex items-center gap-2 text-xs text-muted-foreground"><BookOpen className="hidden size-4 text-primary sm:block" aria-hidden="true" />Oturum planı</dt><dd className="mt-2 text-2xl font-semibold tabular-nums">{plan.words.length}<span className="ml-1 text-xs font-normal text-muted-foreground">kelime</span></dd></div>
        <div className="rounded-2xl border bg-card p-4 sm:p-5"><dt className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="hidden size-4 text-primary sm:block" aria-hidden="true" />Tekrar bekleyen</dt><dd className="mt-2 text-2xl font-semibold tabular-nums">{overview.due}</dd></div>
      </dl>

      {plan.words.length === 0 ? <SessionEmpty mode={mode} remaining={remaining} target={target} due={overview.due} upcoming={overview.upcoming} preferredLevel={snapshot.settings.preferredLevel} onRestart={onRestart} /> : finished ? (
        <section className="animate-in rounded-3xl border bg-card p-7 text-center fade-in duration-300 motion-reduce:animate-none sm:p-12" aria-labelledby="session-summary-title">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Flag className="size-8" aria-hidden="true" /></div>
          <p className="mb-2 text-xs font-semibold tracking-widest text-primary uppercase">Oturum tamamlandı</p>
          <h2 id="session-summary-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">{savedRatings.length > 0 ? "Bugün kendine bir şey kattın." : "Kelimeleri gözden geçirdin."}</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">Bu oturumda {plan.words.length} kartın sonuna geldin. {savedRatings.length} değerlendirme kaydedildi{skippedIds.length > 0 ? `, ${skippedIds.length} kart Türkçe anlamı olmadığı için değerlendirilmeden geçildi` : ""}. Bir oturum, tüm kelimelerin öğrenildiği anlamına gelmez.</p>
          <dl className="mx-auto mt-7 grid max-w-lg grid-cols-3 gap-3">
            {RATING_OPTIONS.map(option => <div key={option.value} className="rounded-2xl border bg-background p-4"><dt className="text-xs text-muted-foreground">{option.label}</dt><dd className="mt-2 text-2xl font-semibold tabular-nums">{savedRatings.filter(record => record.rating === option.value).length}</dd></div>)}
          </dl>
          <div className="mx-auto mt-6 max-w-lg rounded-2xl bg-primary/5 p-4 text-sm leading-relaxed">
            {remaining === 0 ? (target > 0 ? "Bugünkü hedefin tamamlandı. Kendine bir mola verebilirsin." : "Günlük hedefin şu anda sıfır. Yeni oturum için ayarlarını düzenleyebilirsin.") : `Bugünkü hedefinde ${remaining} kelime kaldı. Değerlendirmeden geçilen kartlar hedefe ve öğrenme ilerlemene eklenmez.`}
            {mode === "review" && <p className="mt-2 text-muted-foreground">Şu anda tekrar bekleyen {overview.due} kelime var.{overview.upcoming ? ` Sonraki tekrar: ${formatReviewDate(overview.upcoming)}.` : ""}</p>}
          </div>
          <div className="mt-7 flex flex-wrap justify-center gap-3"><Button className="h-11 rounded-xl px-5" onClick={onRestart}>Güncel planı aç<RotateCcw /></Button><Button asChild variant="outline" className="h-11 rounded-xl px-5"><Link href={mode === "learn" ? "/review" : "/learn"}>{mode === "learn" ? "Tekrarlarımı gör" : "Yeni kelime öğren"}<ArrowRight /></Link></Button><Button asChild variant="ghost" className="h-11"><Link href="/explorer">Kelimeleri keşfet</Link></Button></div>
          <p className="mt-6 text-xs text-muted-foreground">Oturum başlangıcı: {formatReviewDate(plan.startedAt)} · Yalnızca başarılı kayıtlar özete dahil edilir.</p>
        </section>
      ) : word ? (
        <div className="space-y-5">
          <div className="space-y-3"><div className="flex items-center justify-between gap-3 text-sm"><p className="font-medium">Kelime {index + 1} <span className="font-normal text-muted-foreground">/ {plan.words.length}</span></p><p className="text-xs text-muted-foreground" role="status" aria-live="polite">{savedRatings.length} kaydedildi{skippedIds.length > 0 ? ` · ${skippedIds.length} değerlendirilmedi` : ""}</p></div><Progress value={(completedCards / plan.words.length) * 100} className="h-1.5" aria-label="Oturumda tamamlanan kartlar" /></div>
          <LearningCard key={`${index}:${word.id}`} word={word} progress={progressMap.get(word.id)} settings={snapshot.settings} mode={mode} lastCard={index === plan.words.length - 1} onSaved={onSaved} onAdvance={skipped => { if (skipped) setSkippedIds(previous => previous.includes(word.id) ? previous : [...previous, word.id]); setIndex(index + 1); }} />
          <p className="flex items-center justify-center gap-2 text-center text-xs leading-relaxed text-muted-foreground"><CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />Kaydedilmeden kart ilerlemez. Türkçe anlamı olmayan kartlar değerlendirilmeden geçilebilir.</p>
        </div>
      ) : null}
    </div>
  );
}

function SessionEmpty({ mode, remaining, target, due, upcoming, preferredLevel, onRestart }: {
  mode: Mode; remaining: number; target: number; due: number; upcoming?: string | null;
  preferredLevel: Settings["preferredLevel"]; onRestart: () => void;
}) {
  const targetDone = remaining === 0;
  const title = targetDone ? (target === 0 ? "Günlük hedefin sıfır olarak ayarlı" : "Bugünkü hedefin tamamlandı") : mode === "review" ? "Şimdilik tekrar bekleyen kelime yok" : "Bu planda yeni kelime kalmadı";
  return <section className="rounded-3xl border bg-card p-7 text-center sm:p-12">
    <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">{targetDone ? <CheckCircle2 className="size-8" aria-hidden="true" /> : <CalendarClock className="size-8" aria-hidden="true" />}</div>
    <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
    <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">{targetDone ? (target === 0 ? "Çalışmaya başlamak için ayarlardan günlük kelime hedefini artırabilirsin." : "Bugünkü çalışmaların kaydedildi. Yeni bir günlük plan için yarın geri gelebilir veya kütüphaneni keşfedebilirsin.") : mode === "review" ? "Tekrar tarihleri, kaydettiğin değerlendirmelere göre belirlenir. Zamanı geldiğinde kelimeler burada görünür." : preferredLevel === "all" ? "Kütüphanendeki yeni kelimelerin tamamı çalışma planına alınmış. Tekrar oturumuyla devam edebilirsin." : `${preferredLevel} seviyesinde çalışılmamış kelime bulunmuyor. Ayarlardan tercih ettiğin seviyeyi değiştirebilirsin.`}</p>
    {mode === "review" && <div className="mx-auto mt-5 max-w-lg rounded-2xl bg-muted/40 p-4 text-sm"><p>Tekrar bekleyen: <strong>{due}</strong>{targetDone && due > 0 ? " · Günlük tekrar sınırına ulaştın." : ""}</p><p className="mt-2 text-muted-foreground">{upcoming ? `Sonraki tekrar: ${formatReviewDate(upcoming)}` : "Henüz geleceğe planlanmış bir tekrar yok."}</p></div>}
    <div className="mt-7 flex flex-wrap justify-center gap-3"><Button asChild className="h-11 rounded-xl px-5"><Link href={mode === "review" ? "/learn" : "/review"}>{mode === "review" ? "Yeni kelime öğren" : "Tekrara geç"}<ArrowRight /></Link></Button><Button asChild variant="outline" className="h-11 rounded-xl px-5"><Link href="/explorer">Kelimeleri keşfet</Link></Button><Button asChild variant="outline" className="h-11 rounded-xl px-5"><Link href="/settings">Hedef ve seviye ayarları</Link></Button></div>
    <Button variant="ghost" className="mt-4 text-xs text-muted-foreground" onClick={onRestart}><RotateCcw />Güncel planı yeniden kontrol et</Button>
  </section>;
}

function LearningCard({ word, progress, settings, mode, lastCard, onSaved, onAdvance }: {
  word: VocabularyWord; progress?: WordProgress; settings: Settings; mode: Mode;
  lastCard: boolean; onSaved: (record: SavedRating) => void; onAdvance: (skipped: boolean) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<Rating | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attemptedRating, setAttemptedRating] = useState<Rating | null>(null);
  const busyRef = useRef(false);
  const savedRef = useRef(false);
  const advancingRef = useRef(false);
  const eventIdRef = useRef<string | null>(null);
  const attemptedRatingRef = useRef<Rating | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const meaningId = useId();
  const hasMeaning = !!word.turkishMeaning.trim();

  const rate = useCallback(async (rating: Rating) => {
    if (!revealed || !hasMeaning || busyRef.current || savedRef.current || advancingRef.current) return;
    if (attemptedRatingRef.current && attemptedRatingRef.current !== rating) return;
    // This lock is synchronous: two clicks before React renders cannot write twice.
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      eventIdRef.current ??= crypto.randomUUID();
      attemptedRatingRef.current = rating;
      setAttemptedRating(rating);
      await repository.recordRating(word.id, rating, mode, eventIdRef.current);
      savedRef.current = true;
      setSaved(rating);
      onSaved({ eventId: eventIdRef.current, wordId: word.id, rating });
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : "Tarayıcıya yazılamadı.";
      setError(`Kayıt doğrulanamadı; kart ilerletilmedi. Aynı değerlendirmeyle yeniden deneyin. ${detail}`);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [revealed, hasMeaning, word.id, mode, onSaved]);

  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const element = event.target instanceof Element ? event.target : null;
      if (element?.closest("input, textarea, select, button, a, [contenteditable]:not([contenteditable='false']), [role='combobox'], [role='dialog']")) return;
      const option = RATING_OPTIONS.find(item => item.key === event.key);
      if (option && revealed && hasMeaning && !busyRef.current && !savedRef.current) {
        event.preventDefault();
        void rate(option.value);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [rate, revealed, hasMeaning]);

  function advance() {
    if (busyRef.current || advancingRef.current || (!savedRef.current && (!revealed || hasMeaning))) return;
    advancingRef.current = true;
    onAdvance(!savedRef.current);
  }

  return (
    <section className="animate-in overflow-hidden rounded-3xl border bg-card shadow-sm fade-in slide-in-from-bottom-3 duration-300 motion-reduce:animate-none" aria-labelledby={meaningId + "-word"}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4 sm:px-8"><div className="flex flex-wrap items-center gap-2"><Badge className="h-6 bg-primary/10 px-3 text-primary">{word.cefrLevel}</Badge><Badge variant="outline" className="h-6">{partOfSpeechLabel(word.partOfSpeech)}</Badge></div><span className="text-xs text-muted-foreground">{mode === "learn" ? "Yeni kelime" : `${progress?.reviewCount ?? 0} değerlendirme`}</span></div>
      <div className="px-6 py-9 sm:px-10 sm:py-12">
        <div className="flex flex-col items-center text-center"><p className="mb-4 text-xs font-semibold tracking-widest text-muted-foreground uppercase">İngilizce</p><h2 id={meaningId + "-word"} ref={headingRef} tabIndex={-1} lang="en" className="max-w-full break-words font-heading text-4xl font-semibold tracking-tight outline-none sm:text-6xl">{word.word}</h2><p lang="en" className="mt-4 font-mono text-sm text-muted-foreground">{word.pronunciation.trim() || "IPA telaffuz bilgisi eklenmemiş"}</p><div className="mt-5 flex items-center gap-3"><PronunciationButton word={word.word} audioUrl={word.audioUrl} settings={settings} className="size-12 rounded-2xl border-primary/20 bg-primary/5 text-primary" /><span className="text-xs text-muted-foreground">Telaffuzu dinle</span></div></div>
        {mode === "review" && <dl className="mt-7 grid gap-3 rounded-2xl bg-muted/30 p-4 text-xs sm:grid-cols-2"><div><dt className="text-muted-foreground">Son çalışma</dt><dd className="mt-1 font-medium">{progress?.lastReviewDate ? formatReviewDate(progress.lastReviewDate) : "Henüz çalışılmadı"}</dd></div><div><dt className="text-muted-foreground">Planlanan tekrar</dt><dd className="mt-1 font-medium">{formatReviewDate(progress?.nextReviewDate)}</dd></div></dl>}

        {!revealed ? (
          <div className="mt-8 text-center">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button className="h-12 rounded-xl px-7" aria-expanded={false} aria-controls={meaningId} onClick={() => setRevealed(true)}><Eye />Anlamı ve örneği göster</Button>
              {(word.exampleSentence?.trim() || (word.senses?.length ?? 0) > 0) && (
                <Button type="button" variant="outline" className="h-12 rounded-xl px-5" aria-expanded={hintOpen} onClick={() => setHintOpen(prev => !prev)}>
                  {hintOpen ? "Cümle ipucunu gizle" : "İngilizce cümle ipucu"}
                </Button>
              )}
            </div>
            {hintOpen && (
              <div className="mx-auto mt-4 max-w-xl rounded-2xl border border-primary/15 bg-muted/30 p-4 text-left">
                <p className="text-[11px] font-semibold tracking-wider text-primary uppercase">Bağlam ipucu (İngilizce)</p>
                <ul className="mt-2 space-y-2">
                  {(word.senses?.length ? word.senses.slice(0, 2).map(s => s.exampleSentence) : word.exampleSentence ? [word.exampleSentence] : []).map((sentence, idx) => (
                    <li key={idx} lang="en" className="text-sm leading-relaxed text-foreground">• {sentence}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-3 text-xs text-muted-foreground">İstersen önce İngilizce cümleden anlamı tahmin et, sonra cevabı aç.</p>
          </div>
        ) : (
          <div id={meaningId} className="animate-in mt-8 space-y-5 fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none">
            <section className="rounded-2xl border border-primary/10 bg-primary/5 p-5 sm:p-6"><h3 className="text-xs font-semibold tracking-widest text-primary uppercase">Türkçe anlamı</h3><p className="mt-3 whitespace-pre-line text-xl leading-relaxed sm:text-2xl">{word.turkishMeaning.trim() || "Türkçe anlam henüz eklenmemiş."}</p>{!hasMeaning && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Kaynakta çeviri bulunmuyor; anlam tahmin edilmez. Bu kartı değerlendirmeden geçebilirsin. Öğrenme kaydı oluşturulmaz ve günlük hedefe sayılmaz.</p>}</section>
            {word.senses && word.senses.length > 0 ? (
              <section className="space-y-3 rounded-2xl border p-4 sm:p-5">
                <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Sözlük anlamları ve örnek cümleler</h3>
                <WordSensesList senses={word.senses} />
              </section>
            ) : (word.exampleSentence?.trim() || word.exampleTranslation?.trim()) ? (
              <section className="space-y-2 rounded-2xl border p-5"><h3 className="mb-3 text-xs font-semibold tracking-widest text-muted-foreground uppercase">Örnek kullanım</h3>{word.exampleSentence?.trim() && <p lang="en" className="text-base leading-relaxed">{word.exampleSentence}</p>}{word.exampleTranslation?.trim() && <p className="text-sm leading-relaxed text-muted-foreground">{word.exampleTranslation}</p>}</section>
            ) : null}
            {(word.synonyms?.length || word.antonyms?.length) ? <div className="grid gap-4 sm:grid-cols-2">{[["Eş anlamlılar", word.synonyms], ["Zıt anlamlılar", word.antonyms]].map(([label, values]) => Array.isArray(values) && values.length > 0 ? <section key={String(label)} className="rounded-2xl border p-4"><h3 className="mb-3 text-xs font-semibold text-muted-foreground">{String(label)}</h3><div className="flex flex-wrap gap-2">{values.map(value => <Badge key={value} variant="secondary" lang="en">{value}</Badge>)}</div></section> : null)}</div> : null}
          </div>
        )}
      </div>

      {revealed && <div className="space-y-4 border-t bg-muted/20 px-5 py-5 sm:px-8">
        {saved ? <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 rounded-xl bg-primary/10 p-4 text-sm font-medium text-primary"><Check className="size-4" aria-hidden="true" />“{RATING_OPTIONS.find(option => option.value === saved)?.label}” kaydedildi. Tekrar planın güncellendi.</div> : <>
          <p className="text-center text-sm font-medium">{hasMeaning ? "Anlamını ne kadar hatırladın?" : "Anlam olmadan değerlendirme yapılamaz"}</p>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">{RATING_OPTIONS.map(option => <Button key={option.value} variant={option.value === "good" ? "default" : "outline"} className="h-auto min-h-20 flex-col gap-1 rounded-xl px-2 py-3 whitespace-normal sm:px-4" disabled={!hasMeaning || busy || (!!attemptedRating && attemptedRating !== option.value)} onClick={() => void rate(option.value)}><span className="flex items-center justify-center gap-1.5">{busy && attemptedRating === option.value ? <Loader2 className="size-4 animate-spin" /> : <kbd className={`hidden rounded border px-1 text-[10px] sm:inline ${option.value === "good" ? "border-primary-foreground/25 text-primary-foreground/75" : "text-muted-foreground"}`}>{option.key}</kbd>}{error && attemptedRating === option.value ? "Yeniden dene" : option.label}</span><span className={`text-[11px] font-normal ${option.value === "good" ? "text-primary-foreground/75" : "text-muted-foreground"}`}>{option.description}</span></Button>)}</div>
        </>}
        {error && <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm leading-relaxed text-destructive">{error}</p>}
        {(saved || !hasMeaning) && <div className="flex justify-end"><Button className="h-11 rounded-xl px-5" disabled={busy} onClick={advance}>{!hasMeaning ? "Değerlendirmeden geç" : lastCard ? "Oturum özetini gör" : "Sonraki kelime"}<ArrowRight /></Button></div>}
      </div>}
    </section>
  );
}
