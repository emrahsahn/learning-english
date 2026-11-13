import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { z } from "zod";
import { wordSchema } from "../src/lib/storage/schema";
import { applyDictionaryEnrichment } from "../src/lib/vocabulary/enricher";
import { entriesToWords, extractEntries, type PdfTextItem } from "../src/lib/vocabulary/pdf-parser";

const PDF_PATH = path.resolve(process.argv[2] ?? "data/American_Oxford_3000.pdf");
const DATA_OUTPUT_PATH = path.resolve("data/oxford-3000-words.json");
const PUBLIC_OUTPUT_PATH = path.resolve("public/data/oxford-3000-words.json");

async function main() {
  const bytes = fs.readFileSync(PDF_PATH);
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  const pdf = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;

  try {
    const pages: PdfTextItem[][] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.filter((item) => "str" in item) as PdfTextItem[]);
    }

    const entries = extractEntries(pages);
    const words = entriesToWords(entries);

    if (entries.length !== 3003 || words.length !== 2980) {
      throw new Error(`Beklenmeyen ayrıştırma sonucu: ${entries.length} satır / ${words.length} kelime`);
    }

    const dictionary = JSON.parse(fs.readFileSync("public/data/eng-tr-dictionary.json", "utf8"));
    const examples = JSON.parse(fs.readFileSync("public/data/context-examples.json", "utf8"));
    const wiktionary = JSON.parse(fs.readFileSync("public/data/wiktionary-lexicon.json", "utf8"));
    const glossary = JSON.parse(fs.readFileSync("public/data/authored-glossary.json", "utf8"));
    const authoredSenses = JSON.parse(fs.readFileSync("public/data/authored-senses.json", "utf8"));

    const enriched = applyDictionaryEnrichment(words, { dictionary, examples, wiktionary, glossary, authoredSenses });
    const missingMeanings = enriched.filter((w) => !w.turkishMeaning.trim());
    if (missingMeanings.length > 0) {
      throw new Error(
        `Türkçe anlamı eksik kelimeler var (${missingMeanings.length}): ${missingMeanings.map((w) => w.word).join(", ")}`,
      );
    }
    const missingExamples = enriched.filter((w) => !w.exampleSentence?.trim());
    if (missingExamples.length > 0) {
      throw new Error(
        `Örnek cümlesi eksik kelimeler var (${missingExamples.length}): ${missingExamples.slice(0, 15).map((w) => w.word).join(", ")}`,
      );
    }

    const validated = z.array(wordSchema).length(2980).parse(enriched);
    const serialized = `${JSON.stringify(validated, null, 2)}\n`;

    fs.mkdirSync(path.dirname(DATA_OUTPUT_PATH), { recursive: true });
    fs.mkdirSync(path.dirname(PUBLIC_OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(DATA_OUTPUT_PATH, serialized, "utf8");
    fs.writeFileSync(PUBLIC_OUTPUT_PATH, serialized, "utf8");

    const withPronunciation = validated.filter((w) => !!w.pronunciation.trim()).length;
    const withExamples = validated.filter((w) => !!w.exampleSentence?.trim()).length;
    const withSenses = validated.filter((w) => (w.senses?.length ?? 0) > 0).length;
    const withMultiSenses = validated.filter((w) => (w.senses?.length ?? 0) >= 2).length;
    const levels = validated.reduce<Record<string, number>>((acc, w) => {
      acc[w.cefrLevel] = (acc[w.cefrLevel] ?? 0) + 1;
      return acc;
    }, {});

    console.log(
      JSON.stringify(
        {
          pdf: path.relative(process.cwd(), PDF_PATH),
          sha256,
          pages: pdf.numPages,
          printedRows: entries.length,
          uniqueWords: validated.length,
          withMeaning: validated.length - missingMeanings.length,
          withPronunciation,
          withExamples,
          withSenses,
          withMultiSenses,
          levels,
          outputs: [
            path.relative(process.cwd(), DATA_OUTPUT_PATH),
            path.relative(process.cwd(), PUBLIC_OUTPUT_PATH),
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    await pdf.loadingTask.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
