"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCheck, Flame, ListChecks } from "lucide-react";
import { EmptyDataset, LoadingState, StorageError } from "@/components/data-boundary";
import { Button } from "@/components/ui/button";
import { calculateStats } from "@/lib/learning/statistics";
import { useLearningData } from "@/lib/storage/repository";
import { ActivityChart, LevelProgress, StreakHeatmap, VocabularyDonut } from "./charts";
import { count, percent, PeriodSummary, StatusMetrics } from "./summary";
import { WordHistory } from "./word-list";

export function StatisticsOverview() {
  const [period, setPeriod] = useState<30 | 90>(30);
  const { data, loading, error } = useLearningData();
  if (loading) return <LoadingState />;
  if (error) return <StorageError message={error} />;
  if (!data || data.vocabulary.length === 0) return <EmptyDataset />;

  const stats = calculateStats(data);
  const activity = period === 30 ? stats.monthly : stats.activity;
  const records = activity.reduce((sum, day) => sum + day.total, 0);

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">İstatistikler · Kendi ritmin</p>
          <h1 className="page-title mt-3">Emeğinin izleri.</h1>
          <p className="page-subtitle mt-3">Her tekrar, her yeni kelime; öğrenme yolculuğunun gerçek bir parçası. Burada yalnızca kendi çalışma kayıtların var.</p>
        </div>
        <Button asChild variant="outline" className="h-10 w-fit rounded-xl px-4"><Link href="/learn">Bir adım daha at<ArrowUpRight aria-hidden="true" /></Link></Button>
      </header>

      <div className="surface flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6">
        <p className="text-xs leading-relaxed text-muted-foreground">İçe aktarılan gerçek liste: <strong className="font-medium text-foreground">{count(stats.total)} kelime</strong><span className="mx-2" aria-hidden="true">·</span>Uzun vadeli hedef: <strong className="font-medium text-foreground">3.000 kelime</strong></p>
        <p className="text-[11px] text-muted-foreground">Liste tamamlanma oranı: <span className="font-medium text-primary">{percent(stats.completion)}</span></p>
      </div>

      <StatusMetrics stats={stats} />

      <section className="surface min-w-0 p-5 sm:p-7" aria-labelledby="activity-title">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="eyebrow">Öğrenmenin ritmi</p>
            <h2 id="activity-title" className="mt-2 text-xl font-medium tracking-tight">Günlük çalışma</h2>
            <p className="mt-1 text-xs text-muted-foreground">Seçili dönemde {count(records)} çalışma kaydı</p>
          </div>
          <div className="flex w-fit gap-1 rounded-xl bg-muted p-1" role="group" aria-label="Günlük aktivite dönemi">
            {([30, 90] as const).map(value => <Button key={value} variant={period === value ? "secondary" : "ghost"} className="h-8 rounded-lg px-4 text-xs" aria-pressed={period === value} onClick={() => setPeriod(value)}>Son {value} gün</Button>)}
          </div>
        </div>
        <ActivityChart key={period} days={activity} />
      </section>

      <div className="grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-3">
        <PeriodSummary title="Haftalık özet" days={stats.weekly} />
        <PeriodSummary title="Aylık özet" days={stats.monthly} />
        <section className="surface min-w-0 p-5 sm:p-6" aria-labelledby="quiz-title">
          <div className="flex items-center justify-between gap-3"><h2 id="quiz-title" className="text-base font-medium tracking-tight">Test başarın</h2><ListChecks className="size-4 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" /></div>
          <p className="mt-1 text-[11px] text-muted-foreground">Tüm kayıtlı test yanıtlarına göre</p>
          {stats.quizSuccess === null ? (
            <div className="py-6">
              <p className="text-xl font-medium tracking-tight">Henüz test yanıtı yok</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">İlk testini çözdüğünde doğru yanıt oranını burada göreceksin. Henüz bir başarı yüzdesi hesaplanamaz.</p>
              <Link href="/practice" className="mt-4 inline-flex items-center gap-1.5 rounded-sm text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">İlk pratiğine başla<ArrowUpRight className="size-3.5" aria-hidden="true" /></Link>
            </div>
          ) : (
            <>
              <div className="mt-5 flex items-center gap-3"><CheckCheck className="size-5 text-chart-2" aria-hidden="true" /><p className="text-3xl font-medium tracking-tight tabular-nums">{percent(stats.quizSuccess)}</p><span className="text-[11px] text-muted-foreground">doğru yanıt</span></div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Testlerde doğru yanıt oranı" aria-valuemin={0} aria-valuemax={100} aria-valuenow={stats.quizSuccess} aria-valuetext={`${stats.quizTotal} yanıttan ${stats.quizCorrect} doğru`}><div className="h-full rounded-full bg-chart-2" style={{ width: `${stats.quizSuccess}%` }} /></div>
              <dl className="mt-5 grid grid-cols-3 gap-2 text-[11px]">
                {[{ label: "Yanıt", value: stats.quizTotal }, { label: "Doğru", value: stats.quizCorrect }, { label: "Yanlış", value: stats.quizTotal - stats.quizCorrect }].map(item => <div key={item.label} className="flex flex-col"><dt className="order-2 mt-1 text-muted-foreground">{item.label}</dt><dd className="order-1 text-lg font-medium tabular-nums">{count(item.value)}</dd></div>)}
              </dl>
            </>
          )}
        </section>
      </div>

      <section className="surface min-w-0 p-5 sm:p-7" aria-labelledby="streak-title">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div><p className="eyebrow">Devam etmenin gücü</p><h2 id="streak-title" className="mt-2 text-xl font-medium tracking-tight">90 günlük çalışma takvimi</h2><p className="mt-1 text-xs text-muted-foreground">Seri, bugünden veya dünden geriye doğru kesintisiz çalışma günlerini sayar.</p></div>
          <div className="flex items-center gap-3 rounded-2xl bg-secondary px-4 py-3 text-secondary-foreground"><Flame className="size-5" strokeWidth={1.7} aria-hidden="true" /><div><p className="text-xl font-medium tabular-nums">{count(stats.streak)} <span className="text-xs font-normal">gün</span></p><p className="text-[10px]">Güncel seri</p></div></div>
        </div>
        <StreakHeatmap days={stats.activity} streak={stats.streak} />
      </section>

      <div className="grid min-w-0 gap-5 md:grid-cols-2">
        <section className="surface min-w-0 p-5 sm:p-7" aria-labelledby="stats-distribution-title">
          <h2 id="stats-distribution-title" className="text-lg font-medium tracking-tight">Kütüphanenin görünümü</h2>
          <p className="mt-1 text-xs text-muted-foreground">Hedefe değil, gerçek içe aktarılmış kelime sayısına göre</p>
          <VocabularyDonut stats={stats} />
        </section>
        <section className="surface min-w-0 p-5 sm:p-7" aria-labelledby="stats-level-title">
          <h2 id="stats-level-title" className="text-lg font-medium tracking-tight">CEFR seviye ilerlemesi</h2>
          <p className="mt-1 mb-6 text-xs text-muted-foreground">A1’den B2’ye; her seviyenin kendi kelime sayısına göre</p>
          <LevelProgress levels={stats.levels} />
        </section>
      </div>

      <div className="grid min-w-0 gap-5 md:grid-cols-2">
        <WordHistory kind="recent" words={stats.recent} snapshot={data} />
        <WordHistory kind="difficult" words={stats.forgotten} snapshot={data} />
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">Günler tarayıcının yerel takvimine göre gösterilir. Grafiklerde çalışma kaydı bulunmayan günler sıfırdır; örnek veri kullanılmaz. İlerlemen yalnızca bu tarayıcıdaki kayıtlardan hesaplanır.</p>
    </div>
  );
}
