"use client";

import { useRef, useState, type FormEvent } from "react";
import { useTheme } from "next-themes";
import { Check, SlidersHorizontal, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { repository } from "@/lib/storage/repository";
import { settingsSchema } from "@/lib/storage/schema";
import { LEVELS, type Settings } from "@/types";
import { errorMessage, InlineError, SectionHeading, type RunOperation } from "./shared";

const selectClass = "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

export function Preferences({ settings, busy, runOperation }: { settings: Settings; busy: boolean; runOperation: RunOperation }) {
  const [draft, setDraft] = useState({
    newWordsPerDay: String(settings.newWordsPerDay), reviewsPerDay: String(settings.reviewsPerDay), quizLength: String(settings.quizLength),
    preferredLevel: settings.preferredLevel, voiceAccent: settings.voiceAccent, speechRate: String(settings.speechRate),
  });
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const { theme, setTheme } = useTheme();
  const dirty = draft.newWordsPerDay !== String(settings.newWordsPerDay) || draft.reviewsPerDay !== String(settings.reviewsPerDay) || draft.quizLength !== String(settings.quizLength) || draft.preferredLevel !== settings.preferredLevel || draft.voiceAccent !== settings.voiceAccent || draft.speechRate !== String(settings.speechRate);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || submitting.current) return;
    submitting.current = true;
    setError(null);
    try {
      const value = settingsSchema.parse({ id: "preferences", ...draft, newWordsPerDay: Number(draft.newWordsPerDay), reviewsPerDay: Number(draft.reviewsPerDay), quizLength: Number(draft.quizLength), speechRate: Number(draft.speechRate) });
      await runOperation("Tercihlerin kaydediliyor…", () => repository.saveSettings(value));
      toast.success("Öğrenme tercihlerin bu tarayıcıya kaydedildi.");
    } catch (cause) {
      const message = errorMessage(cause);
      setError(message);
      toast.error(message);
    } finally { submitting.current = false; }
  }

  return <section id="preferences" className="surface scroll-mt-24 p-5 sm:p-7" aria-labelledby="preferences-title">
    <SectionHeading id="preferences-title" icon={SlidersHorizontal} eyebrow="01 · Kendi ritmin" title="Az ama düzenli. Sana göre." description="Günlük hedeflerini ve pratik tercihlerini belirle. Kelime listesi henüz yüklenmemiş olsa da tercihlerini kaydedebilirsin." />
    <form onSubmit={save} noValidate className="space-y-6" aria-describedby={error ? "preferences-error" : undefined}>
      <fieldset disabled={busy} className="space-y-6">
        <legend className="sr-only">Öğrenme tercihleri</legend>
        <div className="grid gap-5 sm:grid-cols-3">
          {([
            { name: "newWordsPerDay", label: "Günlük yeni kelime", max: 100, help: "1–100 kelime / gün" },
            { name: "reviewsPerDay", label: "Günlük tekrar hedefi", max: 200, help: "1–200 kelime / gün" },
            { name: "quizLength", label: "Test uzunluğu", max: 50, help: "1–50 soru / test" },
          ] as const).map(field => <div key={field.name} className="space-y-2.5"><Label htmlFor={field.name} className="text-xs">{field.label}</Label><Input id={field.name} name={field.name} type="number" inputMode="numeric" min={1} max={field.max} step={1} required value={draft[field.name]} onChange={event => setDraft(previous => ({ ...previous, [field.name]: event.target.value }))} aria-describedby={`${field.name}-help`} className="h-11 rounded-xl bg-background px-3 tabular-nums" /><p id={`${field.name}-help`} className="text-[10px] text-muted-foreground">{field.help}</p></div>)}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2.5"><Label htmlFor="preferredLevel" className="text-xs">Tercih edilen CEFR seviyesi</Label><select id="preferredLevel" name="preferredLevel" className={selectClass} value={draft.preferredLevel} onChange={event => setDraft(previous => ({ ...previous, preferredLevel: event.target.value as Settings["preferredLevel"] }))}><option value="all">Tüm seviyeler</option>{LEVELS.map(level => <option key={level} value={level}>{level}</option>)}</select><p className="text-[10px] text-muted-foreground">Öğrenme ve pratik için seviye tercihin.</p></div>
          <div className="space-y-2.5"><Label htmlFor="appearance" className="text-xs">Görünüm</Label><select id="appearance" className={selectClass} value={theme ?? "system"} onChange={event => setTheme(event.target.value)}><option value="system">Sistem tercihi</option><option value="light">Aydınlık</option><option value="dark">Karanlık</option></select><p className="text-[10px] text-muted-foreground">Anında uygulanır; görünüm JSON yedeğine dahil değildir.</p></div>
        </div>
        <div className="rounded-2xl border bg-background/50 p-4 sm:p-5">
          <p className="mb-4 flex items-center gap-2 text-xs font-medium"><Volume2 className="size-4 text-primary" aria-hidden="true" />Telaffuz tercihlerin</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2.5"><Label htmlFor="voiceAccent" className="text-xs">İngilizce aksanı</Label><select id="voiceAccent" name="voiceAccent" className={selectClass} value={draft.voiceAccent} onChange={event => setDraft(previous => ({ ...previous, voiceAccent: event.target.value as Settings["voiceAccent"] }))}><option value="en-GB">Britanya İngilizcesi · en-GB</option><option value="en-US">Amerikan İngilizcesi · en-US</option></select></div>
            <div className="space-y-2.5"><Label htmlFor="speechRate" className="text-xs">Konuşma hızı</Label><Input id="speechRate" name="speechRate" type="number" min={0.5} max={1.5} step={0.05} required value={draft.speechRate} onChange={event => setDraft(previous => ({ ...previous, speechRate: event.target.value }))} aria-describedby="speechRate-help" className="h-11 rounded-xl bg-background px-3 tabular-nums" /><p id="speechRate-help" className="text-[10px] text-muted-foreground">0,5–1,5× · 1× doğal hız</p></div>
          </div>
          <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground">Sesler cihazının tarayıcısına bağlıdır; seçilen aksan her cihazda bulunmayabilir. Bu tercihler tarayıcının sesli okuması içindir; varsa kayıtlı ses dosyası değişmez.</p>
        </div>
      </fieldset>
      <InlineError id="preferences-error" message={error} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5"><p className="text-[11px] text-muted-foreground">{dirty ? "Kaydedilmemiş değişikliklerin var." : "Kayıtlı öğrenme tercihlerin gösteriliyor."}</p><Button type="submit" disabled={busy} className="h-10 rounded-xl px-4"><Check aria-hidden="true" />Tercihleri kaydet</Button></div>
    </form>
  </section>;
}
