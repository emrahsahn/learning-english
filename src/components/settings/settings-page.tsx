"use client";

import { useCallback, useRef, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { LoadingState, StorageError } from "@/components/data-boundary";
import { useLearningData } from "@/lib/storage/repository";
import { BackupPanel } from "./backup-panel";
import { BrowserStorage } from "./browser-storage";
import { Preferences } from "./preferences";
import { SourcesSection } from "./sources-section";
import { VocabularyImport } from "./vocabulary-import";
import type { RunOperation } from "./shared";

export function SettingsPage() {
  const { data, loading, error } = useLearningData();
  const [operation, setOperation] = useState<string | null>(null);
  const operationLock = useRef(false);
  const runOperation: RunOperation = useCallback(async <T,>(label: string, action: () => Promise<T>): Promise<T> => {
    if (operationLock.current) throw new Error("Başka bir işlem sürüyor. Tamamlanmasını bekleyip yeniden dene.");
    operationLock.current = true;
    setOperation(label);
    try { return await action(); }
    finally { operationLock.current = false; setOperation(null); }
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <StorageError message={error} />;
  if (!data) return <StorageError message="Tarayıcı verileri okunamadı. Sayfayı yeniden açmayı dene." />;
  const busy = operation !== null;

  return <div className="min-w-0 space-y-6">
    <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div><p className="eyebrow">Ayarlar · Senin öğrenme alanın</p><h1 className="page-title mt-3">Ritmin, kütüphanen,<br /><span className="text-primary">kontrolün.</span></h1><p className="page-subtitle mt-3">Kendine uygun bir tempo seç. Kaynaklarını tanı, emeğini yedekle. Her değişiklik senin kararınla.</p></div>
      <span className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border bg-card px-3.5 py-2 text-[11px] text-muted-foreground"><LockKeyhole className="size-3.5 text-primary" aria-hidden="true" />Bu cihaz · bu tarayıcı</span>
    </header>
    <nav aria-label="Ayarlar bölümleri" className="surface flex flex-wrap gap-2 p-2.5">{[
      ["preferences", "Öğrenme tercihleri"], ["vocabulary-import", "Kelime listesi"], ["backups", "Yedekler"], ["browser-storage", "Depolama"], ["sources", "Kaynaklar & lisanslar"],
    ].map(([id, label]) => <a key={id} href={`#${id}`} className="rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground focus-visible:outline-2 focus-visible:outline-ring">{label}</a>)}</nav>
    <div role="status" aria-live="polite" aria-atomic="true" className={operation ? "rounded-xl border border-primary/20 bg-secondary px-4 py-3 text-xs text-secondary-foreground" : "sr-only"}>{operation ?? "Bekleyen işlem yok."}</div>
    {data.vocabulary.length === 0 && <p className="rounded-2xl border border-primary/15 bg-secondary/50 px-5 py-4 text-xs leading-relaxed text-secondary-foreground">Kütüphanen henüz boş. Tercihlerini hemen kaydedebilir, aşağıdan resmî PDF’ni veya kendi kelime dosyanı içe aktarabilir ya da mevcut yedeğini geri yükleyebilirsin.</p>}
    <Preferences key={JSON.stringify(data.settings)} settings={data.settings} busy={busy} runOperation={runOperation} />
    <VocabularyImport data={data} busy={busy} runOperation={runOperation} />
    <BackupPanel data={data} busy={busy} runOperation={runOperation} />
    <BrowserStorage busy={busy} runOperation={runOperation} />
    <SourcesSection />
  </div>;
}
