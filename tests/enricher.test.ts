import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { acceptedTranslations, maskWord, matchingContext } from "@/lib/quiz";
import { wordSchema } from "@/lib/storage/schema";
import { applyDictionaryEnrichment } from "@/lib/vocabulary/enricher";
import type { VocabularyWord } from "@/types";

describe("multi-sense enrichment and schema", () => {
  it("enriches headwords with multiple senses, examples, and Turkish meanings", () => {
    const base: VocabularyWord[] = [
      {
        id: "bill-noun",
        word: "bill",
        cefrLevel: "A1",
        partOfSpeech: "noun, verb",
        turkishMeaning: "",
        pronunciation: "",
      },
    ];

    const enriched = applyDictionaryEnrichment(base, {
      dictionary: { entries: { bill: ["layiha"] } },
      examples: { entries: {} },
      wiktionary: {
        entries: [
          {
            word: "bill",
            entries: [
              {
                pos: "noun",
                pronunciation: "/bɪl/",
                turkish: ["fatura", "hesap"],
                sense: "",
                sourceUrl: "https://en.wiktionary.org/wiki/bill",
              },
            ],
          },
        ],
      },
      glossary: { entries: {} },
      authoredSenses: {
        entries: {
          bill: [
            {
              pos: "noun",
              meaning: "fatura; hesap",
              exampleSentence: "Could you bring us the bill, please?",
              exampleTranslation: "Bize hesabı getirebilir misiniz lütfen?",
            },
            {
              pos: "noun",
              meaning: "yasa tasarısı",
              exampleSentence: "Parliament voted on the new bill yesterday.",
              exampleTranslation: "Meclis dün yeni yasa tasarısını oyladı.",
            },
            {
              pos: "verb",
              meaning: "fatura kesmek",
              exampleSentence: "They will bill us at the end of the month.",
              exampleTranslation: "Ay sonunda bize fatura kesecekler.",
            },
          ],
        },
      },
    });

    expect(enriched).toHaveLength(1);
    const word = enriched[0];
    expect(word.turkishMeaning).toBe("fatura; yasa tasarısı; fatura kesmek; hesap");
    expect(word.pronunciation).toBe("/bɪl/");
    expect(word.exampleSentence).toBe("Could you bring us the bill, please?");
    expect(word.senses).toHaveLength(3);
    expect(acceptedTranslations(word)).toEqual(
      expect.arrayContaining(["fatura", "hesap", "yasa tasarısı", "fatura kesmek"]),
    );
    expect(matchingContext(word)?.sentence).toBe("Could you bring us the bill, please?");
    expect(() => wordSchema.parse(word)).not.toThrow();
  });

  it("avoids falling back to wrong part-of-speech Wiktionary entries when authored/FreeDict exists", () => {
    const base: VocabularyWord[] = [
      {
        id: "fine-adjective",
        word: "fine",
        cefrLevel: "A1",
        partOfSpeech: "adjective",
        turkishMeaning: "",
        pronunciation: "",
      },
    ];

    const enriched = applyDictionaryEnrichment(base, {
      dictionary: { entries: { fine: ["iyi", "güzel", "ince"] } },
      examples: { entries: {} },
      wiktionary: {
        entries: [
          {
            word: "fine",
            entries: [
              {
                pos: "noun",
                pronunciation: "/faɪn/",
                turkish: ["cerime"],
                sense: "penalty",
                sourceUrl: "https://en.wiktionary.org/wiki/fine",
              },
            ],
          },
        ],
      },
      glossary: { entries: {} },
    });

    expect(enriched[0].turkishMeaning).toBe("iyi; güzel; ince");
    expect(enriched[0].pronunciation).toBe("/faɪn/");
  });

  it("validates the integrated dataset has multi-sense and quiz-ready context coverage for every word", () => {
    const filePath = path.resolve("public/data/oxford-3000-words.json");
    const words = z.array(wordSchema).length(2980).parse(JSON.parse(fs.readFileSync(filePath, "utf8")));
    const missingCtx: string[] = [];
    const missingTr: string[] = [];
    const missingSenses: string[] = [];
    const unmasked: string[] = [];

    for (const w of words) {
      if (acceptedTranslations(w).length === 0) missingTr.push(w.word);
      if (!w.senses || w.senses.length === 0) missingSenses.push(w.word);
      const ctx = matchingContext(w);
      if (!ctx) {
        missingCtx.push(w.word);
      } else if (maskWord(ctx.sentence, w.word) === ctx.sentence) {
        unmasked.push(w.word);
      }
    }

    expect(missingCtx).toEqual([]);
    expect(missingTr).toEqual([]);
    expect(missingSenses).toEqual([]);
    expect(unmasked).toEqual([]);
  }, 15000);
});

