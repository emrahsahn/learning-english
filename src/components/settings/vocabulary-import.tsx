"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { BookCheck, FileJson, FileUp, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { repository } from "@/lib/storage/repository";
import { importOxfordPdf, importVocabularyJson, loadIntegratedVocabulary, type ImportPreview } from "@/lib/vocabulary/importer";
import { OXFORD_PDF_URL } from "@/lib/vocabulary/pdf-parser";
import type { Snapshot } from "@/types";
import { errorMessage, InlineError, SectionHeading, SourceLink, type RunOperation } from "./shared";

type PendingList = { preview: ImportPreview; kind: "pdf" | "json"; filename: string };
const number = (value: number) => value.toLocaleString("tr-TR");

export function VocabularyImport({ data, busy, runOperation }: { data: Snapshot; busy: boolean; runOperation: RunOperation }) {
  const [pending, setPending] = useState<PendingList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const working = useRef(false);

  async function selectFile(event: ChangeEvent<HTMLInputElement>, kind: PendingList["kind"]) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy || working.current) return;
    working.current = true;
    setError(null);
    setPending(null);
    setProgress("Dosya kontrol ediliyor…");
    try {
      const preview = await runOperation("Kelime listesi hazırlanıyor…", async () => {
        const limit = (kind === "pdf" ? 10 : 30) * 1024 * 1024;
        if (file.size === 0) throw new Error("Seçilen dosya boş.");
        if (file.size > limit) throw new Error(`${kind === "pdf" ? "PDF" : "Kelime JSON’u"} en fazla ${kind === "pdf" ? 10 : 30} MB olabilir.`);
        return kind === "pdf" ? importOxfordPdf(file, setProgress) : importVocabularyJson(file);
      });
      setPending({ preview, kind, filename: file.name });
    } catch (cause) {
      const message = errorMessage(cause);
      setError(message);
      toast.error(message);
    } finally { working.current = false; setProgress(""); }
  }

  async function loadSystemList() {
    if (busy || working.current) return;
    working.current = true;
    setError(null);
    setPending(null);
    setProgress("Yerleşik kelime listesi yükleniyor…");
    try {
      const preview = await runOperation("Yerleşik kelime listesi hazırlanıyor…", () => loadIntegratedVocabulary());
      setPending({ preview, kind: "pdf", filename: "American_Oxford_3000.pdf (Sistem yerleşik)" });
    } catch (cause) {
      const message = errorMessage(cause);
      setError(message);
      toast.error(message);
    } finally { working.current = false; setProgress(""); }
  }

  const previewIds = new Set(pending?.preview.words.map(word => word.id));
  const removedCount = pending ? data.vocabulary.filter(word => !previewIds.has(word.id)).length : 0;
  const hasHistory = data.reviews.length > 0 || data.quizzes.length > 0 || data.progress.some(item => item.reviewCount > 0);
  const blocked = hasHistory && removedCount > 0;

  async function confirmList() {
    if (!pending || busy || working.current || blocked) return;
    working.current = true;
    setError(null);
    try {
      await runOperation("Kelime listen tarayıcıya kaydediliyor…", () => repository.importVocabulary(pending.preview.words, pending.preview.metadata));
      setPending(null);
      toast.success(`${number(pending.preview.words.length)} kelime bu tarayıcıya kaydedildi.`);
    } catch (cause) {
      const message = errorMessage(cause);
      setError(message);
      toast.error(message);
    } finally { working.current = false; }
  }

  return <section id="vocabulary-import" className="surface min-w-0 scroll-mt-24 p-5 sm:p-7" aria-labelledby="vocabulary-import-title">
    <SectionHeading id="vocabulary-import-title" icon={FileUp} eyebrow="02 · Kendi kütüphanen" title="Listenle başla, güvenle içe aktar." description="Dosya seçmek hiçbir verini değiştirmez. Önce kaynağı ve kapsamı incele; yalnızca açık onayınla tarayıcıya kaydedilir." />
    <div className="mb-4 flex flex-col justify-between gap-4 rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:flex-row sm:items-center sm:p-5">
      <div className="min-w-0 space-y-1">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <BookCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
          Sistemin Yerleşik Kelime Listesi (data/American_Oxford_3000.pdf)
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {data.vocabulary.length > 0 && data.dataset?.source === "data/American_Oxford_3000.pdf"
            ? `Şu anda ${number(data.vocabulary.length)} benzersiz kelime ve Türkçe karşılıkları tarayıcında yüklü.`
            : "data/American_Oxford_3000.pdf kaynağından çıkarılmış 2.980 benzersiz kelime ve Türkçe karşılıkları doğrudan yüklenebilir."}
        </p>
      </div>
      <Button type="button" variant="outline" disabled={busy} onClick={() => void loadSystemList()} className="h-10 shrink-0 rounded-xl bg-card px-4 text-xs">
        <RefreshCw className="mr-1.5 size-3.5" aria-hidden="true" />
        {data.vocabulary.length > 0 ? "Yerleşik listeyi yenile" : "Yerleşik listeyi yükle"}
      </Button>
    </div>
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <div className="min-w-0 rounded-2xl border border-primary/20 bg-secondary/30 p-4 sm:p-5">
        <p className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="size-4 text-primary" aria-hidden="true" />Resmî Oxford 3000 PDF</p>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Denetlenen resmî sürümler desteklenir: <strong className="font-medium text-foreground">American_Oxford_3000.pdf (3.003 satır → 2.980 kelime)</strong> ve <strong className="font-medium text-foreground">The_Oxford_3000.pdf (3.004 satır → 2.981 kelime)</strong>. SHA-256 özeti ve ayrıştırma sayıları doğrulanır; sayıyı doldurmak için kelime eklenmez.</p>
        <div className="mt-4"><SourceLink href={OXFORD_PDF_URL}>Oxford’un resmî PDF’sini aç</SourceLink></div>
        <ol className="mt-4 list-inside list-decimal space-y-1.5 text-[11px] leading-relaxed text-muted-foreground"><li>Resmî bağlantıyı yeni sekmede açıp PDF’yi indir.</li><li>İndirdiğin The_Oxford_3000.pdf dosyasını burada seç.</li><li>Önizlemeyi kontrol et ve kaydetmeyi ayrıca onayla.</li></ol>
        <div className="mt-5 space-y-2"><Label htmlFor="oxford-pdf" className="text-xs">Resmî PDF dosyası seç</Label><Input id="oxford-pdf" type="file" accept=".pdf,application/pdf" disabled={busy} onChange={event => void selectFile(event, "pdf")} aria-describedby="oxford-pdf-limit" className="h-auto min-h-11 rounded-xl bg-card p-2.5 text-xs file:mr-2 file:text-xs" /><p id="oxford-pdf-limit" className="text-[10px] text-muted-foreground">En fazla 10 MB · farklı veya güncellenmiş PDF sürümleri kabul edilmez.</p></div>
      </div>
      <div className="min-w-0 rounded-2xl border bg-background/50 p-4 sm:p-5">
        <p className="flex items-center gap-2 text-sm font-medium"><FileJson className="size-4 text-muted-foreground" aria-hidden="true" />Kendi kelime JSON’un</p>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Kullanım hakkına sahip olduğun kelimeleri bir JSON dizisi olarak ekleyebilirsin. Yapısı doğrulanır; <strong className="font-medium text-foreground">resmî Oxford listesi olarak doğrulanmaz</strong>. Bu bir ilerleme yedeği değildir.</p>
        <details className="mt-4 text-xs"><summary className="cursor-pointer rounded-sm text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">Kelime dosyasının alanlarını göster</summary><p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">Aşağıdaki metin yalnızca yapı açıklamasıdır; örnek Oxford kelimeleri içermez ve doğrudan JSON dosyası değildir.</p><pre className="mt-3 max-w-full overflow-x-auto rounded-xl border bg-card p-3 text-[10px] leading-6">{`Kök: kelime nesnelerinden oluşan JSON dizisi []
Zorunlu alanlar:
  id: benzersiz metin (1–180 karakter)
  word: benzersiz kelime (1–100 karakter)
  cefrLevel: "A1" | "A2" | "B1" | "B2"
  partOfSpeech: metin
  turkishMeaning: metin (bilinmiyorsa "")
  pronunciation: IPA metni (bilinmiyorsa "")
İsteğe bağlı:
  audioUrl: HTTPS URL
  exampleSentence, exampleTranslation: metin
  synonyms, antonyms: metin dizisi
  acceptedTranslations: metin dizisi
  dictionarySource: kaynak açıklaması
En fazla 10.000 kelime; kimlikler sabit kalmalı.`}</pre></details>
        <div className="mt-5 space-y-2"><Label htmlFor="vocabulary-json" className="text-xs">Kelime JSON dosyası seç (yedek değil)</Label><Input id="vocabulary-json" type="file" accept=".json,application/json" disabled={busy} onChange={event => void selectFile(event, "json")} aria-describedby="vocabulary-json-limit" className="h-auto min-h-11 rounded-xl bg-card p-2.5 text-xs file:mr-2 file:text-xs" /><p id="vocabulary-json-limit" className="text-[10px] text-muted-foreground">En fazla 30 MB · tek bir kelime dizisi.</p></div>
      </div>
    </div>
    <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">Bu uygulama Oxford University Press ile bağlantılı değildir; OUP tarafından desteklenmez. Sitenin özel veya şifreli olması lisans izni sağlamaz. Telifli Oxford kelime listesi site paketinde dağıtılmaz; kaynağın kullanım koşullarına uymalısın.</p>
    {progress && <p role="status" aria-live="polite" className="mt-5 rounded-xl bg-secondary px-4 py-3 text-xs text-secondary-foreground">{progress}</p>}
    <div className="mt-5"><InlineError message={error} /></div>
    {pending && <div className="mt-5 min-w-0 rounded-2xl border border-primary/25 p-4 sm:p-5" aria-labelledby="import-preview-title">
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="eyebrow">Önizleme · Henüz kaydedilmedi</p><h3 id="import-preview-title" className="mt-2 break-words text-base font-medium">{pending.filename}</h3></div><span className={`rounded-full px-3 py-1.5 text-[10px] font-medium ${pending.preview.metadata.verified ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"}`}>{pending.preview.metadata.verified ? "Resmî PDF · özet doğrulandı" : "Kullanıcı JSON’u · doğrulanmamış kaynak"}</span></div>
      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">{[
        { label: "Basılı satır", value: pending.preview.report.printedRows === null ? "Uygulanmaz" : number(pending.preview.report.printedRows) },
        { label: "Kanonik kelime", value: number(pending.preview.report.uniqueWords) },
        { label: "Türkçe anlam", value: `${number(pending.preview.report.withMeaning)} / ${number(pending.preview.words.length)}` },
        { label: "IPA / telaffuz", value: `${number(pending.preview.report.withPronunciation)} / ${number(pending.preview.words.length)}` },
        { label: "Örnek cümle", value: `${number(pending.preview.report.withExamples)} / ${number(pending.preview.words.length)}` },
      ].map(item => <div key={item.label} className="min-w-0 rounded-xl bg-background p-3"><dt className="text-[10px] text-muted-foreground">{item.label}</dt><dd className="mt-1 text-sm font-medium tabular-nums">{item.value}</dd></div>)}</dl>
      <div className="mt-4 rounded-xl bg-background p-3"><p className="text-[10px] font-medium">SHA-256 · {pending.preview.metadata.verified ? "Denetlenen resmî dosyayla eşleşti" : "Yalnızca dosya özeti; kaynak doğrulaması değil"}</p><code className="mt-2 block break-all text-[10px] leading-relaxed text-muted-foreground">{pending.preview.metadata.digest}</code></div>
      <ul className="mt-4 list-disc space-y-2 pl-4 text-[11px] leading-relaxed text-muted-foreground">{(pending.kind === "pdf" ? pending.preview.report.notes : ["Kullanıcı JSON’u yalnızca kelime şemasına ve benzersiz kimlik/başlıklara göre doğrulandı; resmî Oxford kaynağı veya lisans izni doğrulanmadı.", "Anlam, IPA ve örnek kapsamı dosyada bulunan alanlardan hesaplandı. İçerik otomatik olarak zenginleştirilmedi."]).map(note => <li key={note}>{note}</li>)}</ul>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">Eksik anlam, IPA ve örnek alanları uydurulmaz. Sözlük eşleştirmesi ve örnekler tam kapsama garantisi vermez.</p>
      <div className="mt-5 flex items-start gap-2 rounded-xl border border-chart-3/30 bg-chart-3/10 p-3 text-xs leading-relaxed"><TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><div><p>Bu liste mevcut kelime listesinin yerini alır. Ortak kimliklere ait ilerleme korunur. Önce yedek almanı öneririz.</p><p className="mt-2">Öğrenme geçmişi varsa eski kelimeler listeden çıkarılamaz. {removedCount > 0 ? `Önizleme mevcut ${number(removedCount)} kelime kimliğini içermiyor.${blocked ? " Bu nedenle kaydetme engellendi." : " Bu kelimeler ve onlara ait ilerleme kayıtları kaldırılır."}` : "Önizleme mevcut kelime kimliklerini koruyor."}</p></div></div>
      <div className="mt-5 flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => { setPending(null); setError(null); }} className="h-10 rounded-xl">Önizlemeyi iptal et</Button><Button disabled={busy || blocked} onClick={() => void confirmList()} className="h-10 max-w-full rounded-xl px-4 text-xs sm:text-sm">Listeyi tarayıcıma kaydet</Button></div>
    </div>}
  </section>;
}
