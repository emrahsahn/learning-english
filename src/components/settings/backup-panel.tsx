"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Download, HardDriveDownload, TriangleAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { downloadJson, repository } from "@/lib/storage/repository";
import { backupSchema } from "@/lib/storage/schema";
import type { Backup, Snapshot } from "@/types";
import { errorMessage, InlineError, RecordCounts, SectionHeading, type RunOperation } from "./shared";

export function BackupPanel({ data, busy, runOperation }: { data: Snapshot; busy: boolean; runOperation: RunOperation }) {
  const [pending, setPending] = useState<{ backup: Backup; filename: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const working = useRef(false);

  async function exportBackup() {
    if (busy || working.current) return;
    working.current = true;
    setError(null);
    try {
      await runOperation("Tam yedeğin hazırlanıyor…", async () => {
        const backup = await repository.exportBackup();
        downloadJson(backup, `kelime-yedegim-${backup.exportedAt.slice(0, 10)}.json`);
      });
      toast.success("Yedek için indirme isteği oluşturuldu. Dosyanın indirildiğini kontrol et.");
    } catch (cause) {
      const message = errorMessage(cause);
      setError(message);
      toast.error(message);
    } finally { working.current = false; }
  }

  async function selectBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy || working.current) return;
    working.current = true;
    setError(null);
    setRestoreError(null);
    setPending(null);
    try {
      const backup = await runOperation("Yedek şeması doğrulanıyor…", async () => {
        if (file.size === 0) throw new Error("Seçilen yedek dosyası boş.");
        if (file.size > 100 * 1024 * 1024) throw new Error("Yedek dosyası en fazla 100 MB olabilir.");
        const value: unknown = JSON.parse(await file.text());
        return backupSchema.parse(value);
      });
      setPending({ backup, filename: file.name });
    } catch (cause) {
      const message = errorMessage(cause);
      setError(message);
      toast.error(message);
    } finally { working.current = false; }
  }

  async function restoreBackup() {
    if (!pending || busy || working.current) return;
    working.current = true;
    setRestoreError(null);
    try {
      await runOperation("Onaylanan yedek geri yükleniyor…", () => repository.restoreBackup(pending.backup));
      setPending(null);
      toast.success("Yedek geri yüklendi; tarayıcı verilerin doğrulanan yedekle değiştirildi.");
    } catch (cause) {
      const message = errorMessage(cause);
      setRestoreError(message);
      toast.error(message);
    } finally { working.current = false; }
  }

  return <section id="backups" className="surface min-w-0 scroll-mt-24 p-5 sm:p-7" aria-labelledby="backups-title">
    <SectionHeading id="backups-title" icon={HardDriveDownload} eyebrow="03 · Emeğini koru" title="Bir dosya, bütün yolculuğun." description="Tam JSON yedeği kelimelerini, ilerlemeni, tekrar geçmişini, testlerini, öğrenme ayarlarını ve veri seti bilgisini birlikte taşır." />
    <RecordCounts vocabulary={data.vocabulary.length} progress={data.progress.length} reviews={data.reviews.length} quizzes={data.quizzes.length} />
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border bg-background/50 p-4 sm:p-5"><h3 className="text-sm font-medium">Tam yedeğimi indir</h3><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Yeni bir cihaza geçmeden veya liste değiştirmeden önce dışa aktar. İndirilen dosyayı güvenli bir yerde sakla.</p><Button variant="outline" disabled={busy} onClick={() => void exportBackup()} className="mt-4 h-10 rounded-xl px-4"><Download aria-hidden="true" />JSON yedeğini indir</Button></div>
      <div className="min-w-0 rounded-2xl border bg-background/50 p-4 sm:p-5"><h3 className="flex items-center gap-2 text-sm font-medium"><Upload className="size-4" aria-hidden="true" />Yedeğimi geri yükle</h3><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Yalnızca uygulamanın tam yedek formatı kabul edilir. Önce yapı ve kayıt ilişkileri doğrulanır, ardından onayın istenir.</p><div className="mt-4 space-y-2"><Label htmlFor="backup-json" className="text-xs">Tam yedek JSON dosyası seç</Label><Input id="backup-json" type="file" accept=".json,application/json" disabled={busy} onChange={event => void selectBackup(event)} aria-describedby="backup-limit" className="h-auto min-h-11 rounded-xl bg-card p-2.5 text-xs file:mr-2 file:text-xs" /><p id="backup-limit" className="text-[10px] text-muted-foreground">En fazla 100 MB · oxford-personal-backup · sürüm 1</p></div></div>
    </div>
    <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">Yedekler kişisel çalışma geçmişini ve telifli kelime verilerini içerebilir. Bunları herkese açık paylaşma veya yayımlama. Yedek almak, bu içerikleri yeniden dağıtma izni değildir. Görünüm tercihi ayrı saklanır.</p>
    <div className="mt-4"><InlineError message={error} /></div>
    <Dialog open={pending !== null} onOpenChange={open => { if (!open && !busy && !working.current) { setPending(null); setRestoreError(null); } }}>
      <DialogContent showCloseButton={false} className="max-h-[85dvh] overflow-y-auto rounded-2xl p-5 sm:max-w-xl sm:p-6" onEscapeKeyDown={event => { if (busy || working.current) event.preventDefault(); }} onInteractOutside={event => { if (busy || working.current) event.preventDefault(); }}>
        <DialogHeader><DialogTitle className="text-xl leading-tight">Tüm tarayıcı verilerini değiştirmek istiyor musun?</DialogTitle><DialogDescription>Bu işlem birleştirme yapmaz. Mevcut tüm kelimeler, ilerleme, tekrarlar, testler ve öğrenme ayarları silinerek seçilen yedekle değiştirilir.</DialogDescription></DialogHeader>
        {pending && <>
          <div className="min-w-0"><p className="break-words text-sm font-medium">{pending.filename}</p><p className="mt-1 text-[11px] text-muted-foreground">Şema doğrulandı · sürüm {pending.backup.version} · dışa aktarım: {new Date(pending.backup.exportedAt).toLocaleString("tr-TR")}</p></div>
          <div><p className="mb-2 text-xs font-medium">Yedekteki kayıtlar</p><RecordCounts vocabulary={pending.backup.vocabulary.length} progress={pending.backup.progress.length} reviews={pending.backup.reviews.length} quizzes={pending.backup.quizzes.length} /><p className="mt-2 text-[11px] text-muted-foreground">Öğrenme ayarları ve {pending.backup.dataset ? "veri seti bilgisi de geri yüklenir" : "boş veri seti bilgisi de uygulanır"}. Yapı doğrulaması kaynak lisansının doğrulanması değildir.</p></div>
          <p className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-xs leading-relaxed text-destructive"><TriangleAlert className="mr-1 inline size-4" aria-hidden="true" />Bu tarayıcıdaki mevcut {data.vocabulary.length.toLocaleString("tr-TR")} kelime, {data.progress.length.toLocaleString("tr-TR")} ilerleme, {data.reviews.length.toLocaleString("tr-TR")} tekrar ve {data.quizzes.length.toLocaleString("tr-TR")} test kaydının yerine yedek yazılacak. Geri alma düğmesi yok; önce mevcut verinin yedeğini indir.</p>
        </>}
        <InlineError message={restoreError} />
        <DialogFooter className="m-0 mt-1 rounded-none border-t bg-transparent px-0 pb-0 pt-4"><Button variant="outline" disabled={busy} onClick={() => { setPending(null); setRestoreError(null); }} className="h-auto min-h-10 rounded-xl py-2">Vazgeç, verilerimi koru</Button><Button variant="destructive" disabled={busy} onClick={() => void restoreBackup()} className="h-auto min-h-10 rounded-xl px-3 py-2 text-xs whitespace-normal">Onaylıyorum, tüm verilerimi yedekle değiştir</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
