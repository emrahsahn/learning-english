import { BookOpenCheck, Clock3, Layers3, Sprout } from "lucide-react";
import type { calculateStats } from "@/lib/learning/statistics";

export type LearningStats = ReturnType<typeof calculateStats>;
export type ActivityDay = LearningStats["activity"][number];

export function count(value: number) {
  return value.toLocaleString("tr-TR");
}

export function percent(value: number) {
  return `%${value.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`;
}

export function safePercentage(value: number, total: number) {
  return total > 0 ? Math.min(100, Math.max(0, (value / total) * 100)) : 0;
}

export function dateLabel(value: string, full = false) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: full ? "long" : "short",
    ...(full ? { year: "numeric" as const, weekday: "long" as const } : {}),
  });
}

export function StatusMetrics({ stats }: { stats: LearningStats }) {
  const items = [
    { label: "Öğrenildi", value: stats.learned, note: "Kalıcı öğrenme aşamasında", icon: BookOpenCheck, color: "var(--chart-2)" },
    { label: "Öğreniliyor", value: stats.learning, note: "Tekrarlarla güçleniyor", icon: Sprout, color: "var(--chart-1)" },
    { label: "Tekrar zamanı", value: stats.due, note: "Bugün veya daha önce vadesi dolan", icon: Clock3, color: "var(--chart-3)" },
    { label: "Yeni kelime", value: stats.new, note: "Henüz çalışılmadı", icon: Layers3, color: "var(--chart-4)" },
  ];

  return (
    <dl className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-4 md:gap-4" aria-label="Kelime durumları">
      {items.map(({ label, value, note, icon: Icon, color }) => (
        <div key={label} className="surface min-w-0 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
            <Icon className="size-4 shrink-0" style={{ color }} strokeWidth={1.7} aria-hidden="true" />
          </div>
          <dd className="text-3xl font-medium tracking-tight tabular-nums">{count(value)}</dd>
          <dd className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{note}</dd>
        </div>
      ))}
    </dl>
  );
}

export function GoalProgress({ label, current, goal }: { label: string; current: number; goal: number }) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{count(current)} <span className="font-normal text-muted-foreground">/ {count(goal)}</span></span>
      </div>
      {goal > 0 ? (
        <div
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={goal}
          aria-valuenow={Math.min(current, goal)}
          aria-valuetext={`${current} tamamlandı, günlük hedef ${goal}`}
          className="h-1.5 overflow-hidden rounded-full bg-primary/10"
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${safePercentage(current, goal)}%` }} />
        </div>
      ) : <p className="text-[11px] text-muted-foreground">Günlük hedef kapalı.</p>}
    </div>
  );
}

export function PeriodSummary({ title, days }: { title: string; days: ActivityDay[] }) {
  const totals = days.reduce((sum, day) => ({
    newWords: sum.newWords + day.newWords,
    reviews: sum.reviews + day.reviews,
    total: sum.total + day.total,
    active: sum.active + (day.total > 0 ? 1 : 0),
  }), { newWords: 0, reviews: 0, total: 0, active: 0 });

  return (
    <section className="surface min-w-0 p-5 sm:p-6" aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-medium tracking-tight">{title}</h2>
        <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">{count(totals.active)} aktif gün</span>
      </div>
      {days.length > 0 && <p className="mt-1 text-[11px] text-muted-foreground">{dateLabel(days[0].date)} – {dateLabel(days[days.length - 1].date)}</p>}
      <dl className="mt-6 grid grid-cols-3 gap-3">
        {[{ label: "Yeni kelime", value: totals.newWords }, { label: "Tekrar kaydı", value: totals.reviews }, { label: "Toplam kayıt", value: totals.total }].map(item => (
          <div key={item.label} className="flex flex-col">
            <dt className="order-2 mt-1 text-[11px] text-muted-foreground">{item.label}</dt>
            <dd className="order-1 text-2xl font-medium tracking-tight tabular-nums">{count(item.value)}</dd>
          </div>
        ))}
      </dl>
      {totals.total === 0 && <p className="mt-5 text-xs text-muted-foreground">Bu dönemde henüz çalışma kaydı yok.</p>}
    </section>
  );
}
