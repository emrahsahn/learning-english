"use client";

import { WordSensesList } from "@/components/vocabulary/word-senses";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpenText, Flame, Layers3, RotateCcw, Sparkles } from "lucide-react";
import { EmptyDataset, LoadingState, StorageError } from "@/components/data-boundary";
import { Button } from "@/components/ui/button";
import { PronunciationButton } from "@/components/vocabulary/pronunciation-button";
import { ActivityChart, LevelProgress, VocabularyDonut } from "@/components/statistics/charts";
import { count, GoalProgress, percent, safePercentage, StatusMetrics } from "@/components/statistics/summary";
import { WordHistory } from "@/components/statistics/word-list";
import { calculateStats } from "@/lib/learning/statistics";
import { useLearningData } from "@/lib/storage/repository";

export function Dashboard() {
  const { data, loading, error } = useLearningData();
  if (loading) return <LoadingState />;
  if (error) return <StorageError message={error} />;
  if (!data || data.vocabulary.length === 0) return <EmptyDataset />;

  const now = new Date();
  const stats = calculateStats(data, now);
  const word = stats.dayWord;
  const targetProgress = safePercentage(stats.learned, stats.total);

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow">Öğrenme günlüğün</p>
        <time dateTime={now.toISOString()} className="text-xs text-muted-foreground">{now.toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" })}</time>
      </header>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <section className="surface learning-focus relative min-w-0 overflow-hidden p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-xs font-medium text-primary"><BookOpenText className="size-4" strokeWidth={1.7} aria-hidden="true" />Bugün kendine bir kelime kat.</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/10 bg-card/70 px-3 py-1.5 text-[11px] font-medium"><Flame className="size-3.5 text-chart-3" aria-hidden="true" />{count(stats.streak)} günlük seri</span>
          </div>
          <h1 className="page-title mt-7">Bir kelime.<br /><span className="text-primary">Bir adım ileri.</span></h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">Büyük bir kelime hazinesi, küçük ve düzenli adımlarla büyür. Bugünün adımını birlikte atalım.</p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Button asChild className="h-11 gap-3 rounded-xl px-5"><Link href="/learn">Öğrenmeye başla<ArrowRight aria-hidden="true" /></Link></Button>
            <Button asChild variant="outline" className="h-11 gap-2 rounded-xl bg-card/70 px-4"><Link href="/review"><RotateCcw aria-hidden="true" />Tekrar et{stats.due > 0 && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] tabular-nums">{count(stats.due)}</span>}</Link></Button>
            <Button asChild variant="ghost" className="h-11 gap-2 rounded-xl px-3"><Link href="/practice"><Layers3 aria-hidden="true" />Pratik yap</Link></Button>
          </div>
          <div className="mt-8 border-t border-primary/10 pt-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="eyebrow">Bugünkü hedeflerin</p>
              <span className="text-[11px] text-muted-foreground">{count(stats.today.total)} çalışma kaydı</span>
            </div>
            <div className="grid min-w-0 gap-5 sm:grid-cols-2">
              <GoalProgress label="Yeni kelime" current={stats.today.newWords} goal={data.settings.newWordsPerDay} />
              <GoalProgress label="Tekrar edilen kelime" current={stats.today.reviews} goal={data.settings.reviewsPerDay} />
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">Hedefler farklı kelime sayısıyla ölçülür; aynı kelimeyi tekrar çalışmak hedef sayısını artırmaz.</p>
          </div>
        </section>

        {word && (
          <section className="surface flex min-w-0 flex-col p-6 sm:p-7" aria-labelledby="day-word-title">
            <div className="flex items-center justify-between gap-3">
              <h2 id="day-word-title" className="eyebrow">Günün kelimesi</h2>
              <Sparkles className="size-4 text-chart-3" strokeWidth={1.7} aria-hidden="true" />
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-secondary px-2 py-1 text-[10px] font-semibold text-secondary-foreground">{word.cefrLevel}</span>
              {word.partOfSpeech && <span lang="en" className="text-[11px] text-muted-foreground">{word.partOfSpeech}</span>}
            </div>
            <div className="mt-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p lang="en" className="break-words font-heading text-4xl font-medium tracking-tight">{word.word}</p>
                {word.pronunciation && <p lang="en" className="mt-2 break-words font-mono text-xs text-muted-foreground">{word.pronunciation}</p>}
              </div>
              <PronunciationButton word={word.word} audioUrl={word.audioUrl} settings={data.settings} className="mt-1 shrink-0 rounded-full" />
            </div>
            <p className="mt-5 break-words text-base text-primary">{word.turkishMeaning}</p>
            {word.senses && word.senses.length > 0 ? (
              <div className="mt-5">
                <WordSensesList senses={word.senses} maxItems={2} compact />
              </div>
            ) : word.exampleSentence ? (
              <blockquote className="mt-6 border-l-2 border-primary/25 pl-4">
                <p lang="en" className="break-words text-sm leading-relaxed">{word.exampleSentence}</p>
                {word.exampleTranslation && <p className="mt-2 break-words text-xs leading-relaxed text-muted-foreground">{word.exampleTranslation}</p>}
              </blockquote>
            ) : <p className="mt-6 text-xs leading-relaxed text-muted-foreground">İçe aktarılan kayıtta örnek cümle bulunmuyor. Telaffuzunu dinleyip anlamını hatırlamayı deneyebilirsin.</p>}
            <div className="mt-auto pt-7">
              <p className="border-t pt-4 text-[10px] leading-relaxed text-muted-foreground">Kendi kütüphanenden seçildi. Kelimeyi görmek öğrenme kaydı oluşturmaz.</p>
              <Link href="/explorer" className="mt-3 inline-flex items-center gap-1.5 rounded-sm text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">Kelimeleri keşfet<ArrowUpRight className="size-3.5" aria-hidden="true" /></Link>
            </div>
          </section>
        )}
      </div>

      <StatusMetrics stats={stats} />

      <section className="surface flex min-w-0 flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6" aria-label="3.000 kelime hedefi ve içe aktarılan liste">
        <div className="min-w-0">
          <p className="eyebrow">Büyük resim</p>
          <h2 className="mt-2 text-lg font-medium tracking-tight">Oxford 3000. Her kelime bir adım.</h2>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Gerçekte içe aktarılan: <span className="font-medium text-foreground">{count(stats.total)} benzersiz kelime</span>. Oxford 3000 listenin adıdır; tamamlanma oranı kendi listene göre hesaplanır.</p>
        </div>
        <div className="w-full min-w-0 shrink-0 sm:w-48">
          <p className="mb-2 flex justify-between gap-2 text-xs tabular-nums"><span><strong className="font-medium">{count(stats.learned)}</strong><span className="text-muted-foreground"> / {count(stats.total)} öğrenildi</span></span><span className="font-medium text-primary">{percent(targetProgress)}</span></p>
          <div role="progressbar" aria-label="Kelime listeni tamamlamaya ilerleme" aria-valuemin={0} aria-valuemax={stats.total} aria-valuenow={stats.learned} aria-valuetext={`${stats.learned} kelime öğrenildi, listede ${stats.total} kelime var`} className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${targetProgress}%` }} /></div>
        </div>
      </section>

      <div className="grid min-w-0 gap-5 md:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <section className="surface min-w-0 p-5 sm:p-6" aria-labelledby="weekly-activity-title">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div><h2 id="weekly-activity-title" className="text-base font-medium tracking-tight">Küçük adımlar, düzenli ritim</h2><p className="mt-1 text-[11px] text-muted-foreground">Son 7 günün gerçek çalışma kayıtları</p></div>
            <Link href="/statistics" className="inline-flex items-center gap-1 rounded-sm text-[11px] font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">Tüm istatistikler<ArrowUpRight className="size-3.5" aria-hidden="true" /></Link>
          </div>
          <ActivityChart days={stats.weekly} compact />
        </section>
        <section className="surface min-w-0 p-5 sm:p-6" aria-labelledby="distribution-title">
          <h2 id="distribution-title" className="text-base font-medium tracking-tight">Kelime hazinen büyüyor</h2>
          <p className="mt-1 text-[11px] text-muted-foreground">İçe aktarılan listenin öğrenme dağılımı</p>
          <VocabularyDonut stats={stats} />
        </section>
      </div>

      <div className="grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-3">
        <section className="surface min-w-0 p-5 sm:p-6" aria-labelledby="level-title">
          <h2 id="level-title" className="text-base font-medium tracking-tight">Seviye seviye ilerle</h2>
          <p className="mt-1 mb-6 text-[11px] text-muted-foreground">CEFR seviyelerine göre kendi listen</p>
          <LevelProgress levels={stats.levels} />
        </section>
        <WordHistory kind="recent" words={stats.recent} snapshot={data} />
        <WordHistory kind="difficult" words={stats.forgotten.slice(0, 4)} snapshot={data} />
      </div>
    </div>
  );
}
