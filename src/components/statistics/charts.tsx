"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { count, dateLabel, percent, safePercentage, type ActivityDay, type LearningStats } from "./summary";

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  color: "var(--popover-foreground)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
  boxShadow: "var(--surface-shadow)",
};

export function ActivityChart({ days, compact = false }: { days: ActivityDay[]; compact?: boolean }) {
  const total = days.reduce((sum, day) => sum + day.total, 0);
  const newWords = days.reduce((sum, day) => sum + day.newWords, 0);
  const reviews = days.reduce((sum, day) => sum + day.reviews, 0);
  const height = compact ? 224 : 280;

  return (
    <figure className="min-w-0" aria-label={`Son ${days.length} günün günlük çalışma grafiği`}>
      <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-2"><span className="size-2 rounded-full bg-chart-1" aria-hidden="true" />Yeni kelime</span>
        <span className="inline-flex items-center gap-2"><span className="size-2 rounded-full bg-chart-2" aria-hidden="true" />Tekrar kaydı</span>
      </div>
      <div className="w-full min-w-0" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 320, height }}>
          <BarChart data={days} accessibilityLayer margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap={days.length > 7 ? "25%" : "42%"}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
            <XAxis dataKey="date" tickFormatter={value => dateLabel(String(value))} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} tickMargin={12} minTickGap={25} interval={days.length <= 7 ? 0 : "preserveStartEnd"} />
            <YAxis allowDecimals={false} domain={[0, (max: number) => Math.max(1, max)]} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickFormatter={count} width={30} axisLine={false} tickLine={false} />
            <ChartTooltip cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }} contentStyle={tooltipStyle} itemStyle={{ color: "var(--popover-foreground)" }} labelStyle={{ color: "var(--foreground)", marginBottom: 6 }} labelFormatter={label => dateLabel(String(label), true)} formatter={value => count(Number(value))} />
            <Bar dataKey="newWords" name="Yeni kelime" fill="var(--chart-1)" maxBarSize={28} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="reviews" name="Tekrar kaydı" fill="var(--chart-2)" maxBarSize={28} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-4 text-xs leading-relaxed text-muted-foreground">
        {total === 0
          ? `Son ${days.length} günde henüz çalışma kaydı yok. İlk oturumun burada görünecek.`
          : `Son ${days.length} gün: ${count(newWords)} yeni kelime, ${count(reviews)} tekrar ve toplam ${count(total)} çalışma kaydı.`}
        {!compact && " Aynı kelimenin birden fazla tekrarı ayrı kayıt sayılır."}
      </figcaption>
      <details className="mt-3 text-xs text-muted-foreground">
        <summary className="w-fit cursor-pointer rounded-sm py-1 underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring">Günlük verileri tablo olarak gör</summary>
        <div className="mt-3 max-h-72 overflow-auto rounded-xl border">
          <table className="w-full text-left text-xs tabular-nums">
            <caption className="sr-only">Grafikteki günlük çalışma kayıtları</caption>
            <thead className="sticky top-0 bg-muted text-foreground">
              <tr><th scope="col" className="p-3 font-medium">Tarih</th><th scope="col" className="p-3 font-medium">Yeni</th><th scope="col" className="p-3 font-medium">Tekrar</th><th scope="col" className="p-3 font-medium">Toplam</th></tr>
            </thead>
            <tbody>{days.map(day => <tr key={day.date} className="border-t"><th scope="row" className="p-3 font-normal"><time dateTime={day.date}>{dateLabel(day.date)}</time></th><td className="p-3">{count(day.newWords)}</td><td className="p-3">{count(day.reviews)}</td><td className="p-3">{count(day.total)}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

export function VocabularyDonut({ stats }: { stats: LearningStats }) {
  const segments = [
    { name: "Öğrenildi", value: stats.learned, color: "var(--chart-2)" },
    { name: "Öğreniliyor", value: stats.learning, color: "var(--chart-1)" },
    { name: "Yeni", value: stats.new, color: "var(--muted)" },
  ];

  return (
    <figure className="min-w-0" aria-label="İçe aktarılan kelimelerin öğrenme dağılımı">
      <div className="relative h-[208px] w-full min-w-0">
        {stats.total > 0 && (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 280, height: 208 }}>
            <PieChart accessibilityLayer>
              <Pie data={segments.filter(segment => segment.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={70} outerRadius={88} paddingAngle={2} stroke="var(--card)" strokeWidth={3} isAnimationActive={false}>
                {segments.filter(segment => segment.value > 0).map(segment => <Cell key={segment.name} fill={segment.color} />)}
              </Pie>
              <ChartTooltip contentStyle={tooltipStyle} itemStyle={{ color: "var(--popover-foreground)" }} formatter={value => `${count(Number(value))} kelime`} />
            </PieChart>
          </ResponsiveContainer>
        )}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
          <span className="text-3xl font-medium tracking-tight tabular-nums">{percent(stats.completion)}</span>
          <span className="mt-1 text-[11px] text-muted-foreground">öğrenildi</span>
        </div>
      </div>
      <dl className="mt-1 space-y-2.5">
        {segments.map(segment => (
          <div key={segment.name} className="flex items-center justify-between gap-3 text-xs">
            <dt className="flex items-center gap-2 text-muted-foreground"><span className="size-2 rounded-full" style={{ backgroundColor: segment.color }} aria-hidden="true" />{segment.name}</dt>
            <dd className="font-medium tabular-nums">{count(segment.value)}</dd>
          </div>
        ))}
      </dl>
      <figcaption className="mt-5 border-t pt-4 text-[11px] leading-relaxed text-muted-foreground">
        İçe aktarılan {count(stats.total)} kelimenin {count(stats.learned)} tanesi öğrenildi ({percent(stats.completion)}). Tekrarı gelen kelimeler bu durumların içinde yer alır.
      </figcaption>
    </figure>
  );
}

export function LevelProgress({ levels }: { levels: LearningStats["levels"] }) {
  return (
    <div className="min-w-0 space-y-5">
      {levels.map(item => {
        const learned = safePercentage(item.learned, item.total);
        const learning = safePercentage(item.learning, item.total);
        const label = `${item.level}: ${item.total} kelimeden ${item.learned} öğrenildi, ${item.learning} öğreniliyor`;
        return (
          <div key={item.level}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="rounded-md bg-muted px-2 py-1 text-[11px] font-semibold">{item.level}</span>
              <span className="text-[11px] text-muted-foreground tabular-nums"><span className="font-medium text-foreground">{count(item.learned)}</span> / {count(item.total)} · {percent(learned)}</span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={label} title={label}>
              <div className="h-full bg-chart-2" style={{ width: `${learned}%` }} />
              <div className="h-full bg-chart-1" style={{ width: `${learning}%` }} />
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">{item.total === 0 ? "Bu seviyede içe aktarılmış kelime yok." : `${count(item.learning)} öğreniliyor · ${count(item.total - item.learned - item.learning)} yeni`}</p>
          </div>
        );
      })}
      <p className="flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-chart-2" aria-hidden="true" />Öğrenildi</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-chart-1" aria-hidden="true" />Öğreniliyor</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-muted" aria-hidden="true" />Yeni</span>
      </p>
    </div>
  );
}

export function StreakHeatmap({ days, streak }: { days: ActivityDay[]; streak: number }) {
  const max = Math.max(1, ...days.map(day => day.total));
  const activeDays = days.filter(day => day.total > 0).length;
  const first = days[0];
  const offset = first ? (new Date(`${first.date}T12:00:00`).getDay() + 6) % 7 : 0;
  const columns = Math.ceil((offset + days.length) / 7);
  const weekdayLabels = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

  return (
    <figure className="min-w-0" aria-label="Son 90 günün çalışma takvimi">
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-[300px] gap-3">
          <div className="grid shrink-0 grid-rows-7 gap-1.5 text-[9px] text-muted-foreground" aria-hidden="true">
            {weekdayLabels.map(label => <span key={label} className="flex h-4 items-center">{label}</span>)}
          </div>
          <TooltipProvider delayDuration={150}>
            <div className="grid flex-1 grid-flow-col grid-rows-7 gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.max(1, columns)}, minmax(0, 1fr))` }}>
              {Array.from({ length: offset }, (_, i) => <span key={`offset-${i}`} aria-hidden="true" />)}
              {days.map(day => {
                const intensity = day.total === 0 ? 0 : Math.ceil((day.total / max) * 4);
                const label = `${dateLabel(day.date, true)}: ${count(day.total)} çalışma kaydı, ${count(day.newWords)} yeni kelime, ${count(day.reviews)} tekrar`;
                return (
                  <Tooltip key={day.date}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="h-4 w-full rounded-[3px] border border-border/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        style={{ backgroundColor: intensity === 0 ? "var(--muted)" : `color-mix(in srgb, var(--chart-1) ${25 + intensity * 18}%, var(--card))` }}
                        aria-label={label}
                        title={label}
                      />
                    </TooltipTrigger>
                    <TooltipContent><span>{label}</span></TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[10px] text-muted-foreground">
        <span>{first && dateLabel(first.date)} — {days.length > 0 && dateLabel(days[days.length - 1].date)}</span>
        <span className="inline-flex items-center gap-1.5" aria-hidden="true">Az{[0, 1, 2, 3, 4].map(intensity => <span key={intensity} className="size-2.5 rounded-[2px]" style={{ backgroundColor: intensity === 0 ? "var(--muted)" : `color-mix(in srgb, var(--chart-1) ${25 + intensity * 18}%, var(--card))` }} />)}Çok</span>
      </div>
      <figcaption className="mt-5 text-xs leading-relaxed text-muted-foreground">
        Son {days.length} günde {count(activeDays)} aktif gün. Güncel serin {count(streak)} gün.
        {activeDays === 0 ? " Henüz çalışma kaydı yok." : " Her kare bir günü gösterir; tarih ve kayıt sayısı üzerine gelince veya klavyeyle odaklanınca görünür."}
      </figcaption>
    </figure>
  );
}
