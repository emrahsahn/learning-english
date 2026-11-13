"use client";

import { useEffect, useRef, useState } from "react";
import { Database, Shield } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { errorMessage, InlineError, SectionHeading, type RunOperation } from "./shared";

type Persistence = "checking" | "granted" | "not-granted" | "unknown" | "unsupported";
const statusText: Record<Persistence, string> = {
  checking: "Depolama durumu kontrol ediliyor…",
  granted: "Kalıcı depolama izni verilmiş",
  "not-granted": "Kalıcı depolama izni verilmemiş",
  unknown: "Kalıcı depolama durumu belirlenemedi",
  unsupported: "Kalıcı depolama durumu bu tarayıcıda sorgulanamıyor",
};
function bytes(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return "Bilinmiyor";
  if (value < 1024 * 1024) return `${(value / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB`;
  return `${(value / (1024 * 1024 * 1024)).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} GB`;
}

export function BrowserStorage({ busy, runOperation }: { busy: boolean; runOperation: RunOperation }) {
  const [status, setStatus] = useState<Persistence>("checking");
  const [canRequest, setCanRequest] = useState(false);
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const requesting = useRef(false);

  useEffect(() => {
    let active = true;
    async function inspect() {
      const storage = navigator.storage;
      const [persistentResult, estimateResult] = await Promise.allSettled([
        typeof storage?.persisted === "function" ? storage.persisted() : Promise.resolve(null),
        typeof storage?.estimate === "function" ? storage.estimate() : Promise.resolve(null),
      ]);
      if (!active) return;
      setCanRequest(typeof storage?.persist === "function");
      setStatus(persistentResult.status === "rejected" ? "unknown" : persistentResult.value === null ? "unsupported" : persistentResult.value ? "granted" : "not-granted");
      if (estimateResult.status === "fulfilled") setEstimate(estimateResult.value);
      else setEstimateError("Lokal depolama tahmini alınamadı; bu, verilerinin silindiği anlamına gelmez.");
    }
    void inspect().catch(() => { if (active) setStatus("unknown"); });
    return () => { active = false; };
  }, []);

  async function requestPersistence() {
    if (busy || requesting.current || !canRequest || status === "granted") return;
    requesting.current = true;
    setError(null);
    try {
      const granted = await runOperation("Kalıcı depolama izni isteniyor…", async () => {
        if (typeof navigator.storage?.persist !== "function") throw new Error("Bu tarayıcı kalıcı depolama isteğini desteklemiyor.");
        return navigator.storage.persist();
      });
      setStatus(granted ? "granted" : "not-granted");
      if (granted) toast.success("Tarayıcı kalıcı depolama izni verdi. Yedek almaya devam et.");
      else toast.info("Tarayıcı kalıcı depolama izni vermedi. Normal depolama kullanılmaya devam ediyor; yedek al.");
      if (typeof navigator.storage?.estimate === "function") {
        try { setEstimate(await navigator.storage.estimate()); setEstimateError(null); }
        catch { setEstimateError("Güncel depolama tahmini alınamadı."); }
      }
    } catch (cause) {
      const message = errorMessage(cause);
      setError(message);
      toast.error(message);
    } finally { requesting.current = false; }
  }

  const usage = estimate?.usage;
  const quota = estimate?.quota;
  const percentage = usage !== undefined && quota !== undefined && quota > 0 ? Math.min(100, Math.max(0, usage / quota * 100)) : null;

  return <section id="browser-storage" className="surface scroll-mt-24 p-5 sm:p-7" aria-labelledby="browser-storage-title">
    <SectionHeading id="browser-storage-title" icon={Database} eyebrow="04 · Bu tarayıcıda" title="Verin yerel. Yedeğin senin elinde." description="Kelimelerin ve çalışma kayıtların IndexedDB’de, bu cihazın bu tarayıcı profilinde tutulur. Başka tarayıcıya veya cihaza otomatik eşitlenmez." />
    <div className="rounded-2xl border bg-background/50 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><p role="status" className="flex items-center gap-2 text-xs font-medium"><Shield className={`size-4 ${status === "granted" ? "text-chart-2" : "text-muted-foreground"}`} aria-hidden="true" />{statusText[status]}</p><Button variant="outline" disabled={busy || !canRequest || status === "granted" || status === "checking"} onClick={() => void requestPersistence()} className="h-10 rounded-xl px-4 text-xs">Kalıcı depolama izni iste</Button></div>
      <dl className="mt-5 grid grid-cols-2 gap-4"><div><dt className="text-[10px] text-muted-foreground">Site için tahmini kullanım</dt><dd className="mt-1 text-xl font-medium tabular-nums">{bytes(usage)}</dd></div><div><dt className="text-[10px] text-muted-foreground">Tarayıcının bildirdiği kota</dt><dd className="mt-1 text-xl font-medium tabular-nums">{bytes(quota)}</dd></div></dl>
      {percentage !== null && <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Site depolama kotasının tahmini kullanımı" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}><div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} /></div>}
      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">Tahmin, bu site adresinin toplam tarayıcı depolamasıdır; yalnızca kelime veritabanı değildir. Kota ayrılmış alan veya yedek garantisi değildir. {estimate === null && "Tarayıcı kullanım/kota bilgisini bildirmiyor."}</p>
    </div>
    <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Tarayıcı verilerini temizlemek, bu profili silmek veya cihazı kaybetmek öğrenme kayıtlarını kaybettirebilir. Kalıcı depolama izni otomatik alan temizliğine karşı yardımcı olur; senin yaptığın silmeyi önlemez ve yedek yerine geçmez. Tarayıcı isteği kabul edebilir veya reddedebilir.</p>
    {estimateError && <p className="mt-3 text-[11px] text-muted-foreground">{estimateError}</p>}
    <div className="mt-4"><InlineError message={error} /></div>
  </section>;
}
