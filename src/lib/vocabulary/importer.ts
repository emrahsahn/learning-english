"use client";
import { z } from "zod";
import { wordSchema } from "@/lib/storage/schema";
import { applyDictionaryEnrichment, type ContextExampleEntry, type WiktionaryLexiconData } from "./enricher";
import { entriesToWords, extractEntries, OXFORD_PDF_URL, type PdfTextItem } from "./pdf-parser";
import type { DatasetMetadata, VocabularyWord, WordSense } from "@/types";

export const OFFICIAL_PDF_SHA256 = "61a2201c44b390ec579365b4ca805f6ab536bd7b2cb61c78bc599d43b5958112";
export const AMERICAN_PDF_SHA256 = "aa53effa243e555f717cd8ea23607f1556ab5f5408c766b6e6a36a856c8cacc3";
export const INTEGRATED_DATA_URL = "/data/oxford-3000-words.json";

const VERIFIED_PDF_SPECS: Record<string, { rows: number; words: number; source: string }> = {
  [OFFICIAL_PDF_SHA256]: { rows: 3004, words: 2981, source: OXFORD_PDF_URL },
  [AMERICAN_PDF_SHA256]: { rows: 3003, words: 2980, source: "data/American_Oxford_3000.pdf" },
};

export interface ImportPreview {
  words: VocabularyWord[];
  metadata: DatasetMetadata;
  report: {
    printedRows: number | null;
    uniqueWords: number;
    withMeaning: number;
    withPronunciation: number;
    withExamples: number;
    notes: string[];
  };
}

export async function digestBytes(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, "0")).join("");
}

async function enrichWords(words: VocabularyWord[]): Promise<VocabularyWord[]> {
  const responses = await Promise.all(
    ["eng-tr-dictionary.json", "context-examples.json", "wiktionary-lexicon.json", "authored-glossary.json", "authored-senses.json"].map((name) =>
      fetch(`/data/${name}`),
    ),
  );
  if (responses.slice(0, 4).some((r) => !r.ok)) {
    throw new Error("Açık lisanslı sözlük yüklenemedi. Site kilitli mi veya bağlantı kesildi mi?");
  }
  const dictionary: { entries: Record<string, string[]> } = await responses[0].json();
  const examples: { entries: Record<string, ContextExampleEntry> } = await responses[1].json();
  const wiktionary: WiktionaryLexiconData = await responses[2].json();
  const glossary: { entries: Record<string, string> } = await responses[3].json();
  const authoredSenses: { entries: Record<string, WordSense[]> } = responses[4].ok
    ? await responses[4].json()
    : { entries: {} };
  return applyDictionaryEnrichment(words, { dictionary, examples, wiktionary, glossary, authoredSenses });
}

function report(words: VocabularyWord[], metadata: DatasetMetadata, printedRows: number | null): ImportPreview {
  return {
    words,
    metadata,
    report: {
      printedRows,
      uniqueWords: words.length,
      withMeaning: words.filter((w) => !!w.turkishMeaning).length,
      withPronunciation: words.filter((w) => !!w.pronunciation).length,
      withExamples: words.filter((w) => !!w.exampleSentence).length,
      notes: [
        "Oxford 3000 bir liste adıdır. Basılı eş yazımlı başlıklar birleştirilir; a/an gibi basılı varyantlar ayrılır. Sayıyı tamamlamak için kelime eklenmez.",
        "Birden fazla CEFR etiketi varsa en düşük düzey gösterilir; sözcük türleri korunur.",
        "Sözlük anlamları farklı kaynaklardan gelir ve insan tarafından tek tek denetlenmiş değildir. Eksik alanlar uydurulmaz.",
      ],
    },
  };
}

export async function importOxfordPdf(file: File, onProgress?: (message: string) => void): Promise<ImportPreview> {
  if (file.size > 10 * 1024 * 1024) throw new Error("PDF en fazla 10 MB olabilir.");
  const bytes = await file.arrayBuffer();
  const digest = await digestBytes(bytes);
  const spec = VERIFIED_PDF_SPECS[digest];
  if (!spec) {
    throw new Error(
      "Bu PDF denetlenen resmî Oxford 3000 sürümüyle aynı değil. Resmî bağlantıdan The_Oxford_3000.pdf veya American_Oxford_3000.pdf dosyasını seç. Güncellenmiş bir sürümse yeniden kaynak denetimi gerekir; yalnızca kelime sayısına bakıp doğrulanmış sayılmaz.",
    );
  }
  onProgress?.("PDF tarayıcında okunuyor…");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
  try {
    const pdf = await task.promise;
    const pages: PdfTextItem[][] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      onProgress?.(`PDF okunuyor: ${i} / ${pdf.numPages}`);
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.filter((item) => "str" in item) as PdfTextItem[]);
    }
    const entries = extractEntries(pages);
    const words = entriesToWords(entries);
    if (entries.length !== spec.rows || words.length !== spec.words) {
      throw new Error(`PDF ayrıştırma doğrulaması başarısız (${entries.length} satır / ${words.length} başlık). Verilerin kaydedilmedi.`);
    }
    onProgress?.("Türkçe sözlük eşleştiriliyor…");
    const enriched = await enrichWords(words);
    return report(
      enriched,
      { id: "dataset", source: spec.source, importedAt: new Date().toISOString(), count: enriched.length, digest, verified: true },
      entries.length,
    );
  } finally {
    await task.destroy();
  }
}

export async function importVocabularyJson(file: File): Promise<ImportPreview> {
  if (file.size > 30 * 1024 * 1024) throw new Error("Kelime JSON'u en fazla 30 MB olabilir.");
  const text = await file.text();
  const value: unknown = JSON.parse(text);
  if (!Array.isArray(value)) {
    throw new Error("Kelime dosyası bir JSON dizisi olmalı. İlerleme yedekleri için Geri yükle bölümünü kullan.");
  }
  const words = z.array(wordSchema).min(1).max(10000).parse(value);
  if (new Set(words.map((w) => w.id)).size !== words.length || new Set(words.map((w) => w.word.toLowerCase())).size !== words.length) {
    throw new Error("Yinelenen kelime başlıkları veya kimlikler var.");
  }
  return report(
    words,
    {
      id: "dataset",
      source: `Kullanıcı JSON içe aktarımı: ${file.name}`,
      importedAt: new Date().toISOString(),
      count: words.length,
      digest: await digestBytes(new TextEncoder().encode(text).buffer as ArrayBuffer),
      verified: false,
    },
    null,
  );
}

/**
 * Fetch and validate the pre-extracted integrated Oxford 3000 (American English)
 * word list generated from `data/American_Oxford_3000.pdf`.
 */
export async function loadIntegratedVocabulary(): Promise<ImportPreview> {
  const response = await fetch(INTEGRATED_DATA_URL);
  if (!response.ok) {
    throw new Error("Sistemin yerleşik kelime listesi yüklenemedi.");
  }
  const value: unknown = await response.json();
  if (!Array.isArray(value)) {
    throw new Error("Sistem kelime listesi geçersiz biçimde.");
  }
  const words = z.array(wordSchema).min(1).max(10000).parse(value);
  if (new Set(words.map((w) => w.id)).size !== words.length || new Set(words.map((w) => w.word.toLowerCase())).size !== words.length) {
    throw new Error("Sistem kelime listesinde yinelenen kayıtlar var.");
  }
  return report(
    words,
    {
      id: "dataset",
      source: "data/American_Oxford_3000.pdf",
      importedAt: new Date().toISOString(),
      count: words.length,
      digest: AMERICAN_PDF_SHA256,
      verified: true,
    },
    3003,
  );
}
