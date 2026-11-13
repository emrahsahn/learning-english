import type { VocabularyWord, WordSense } from "@/types";

export interface ContextExampleEntry {
  meaning: string;
  pos: string;
  sentence: string;
  translation: string;
}

export interface WiktionarySenseEntry {
  sense?: string;
  gloss?: string;
  turkish?: string[];
  examples?: string[];
}

export interface WiktionaryPosEntry {
  pos: string;
  pronunciation: string;
  turkish: string[];
  sense: string;
  sourceUrl: string;
  senses?: WiktionarySenseEntry[];
}

export interface WiktionaryLexiconData {
  entries: {
    word: string;
    entries: WiktionaryPosEntry[];
  }[];
}

export interface EnrichmentSources {
  dictionary: { entries: Record<string, string[]> };
  examples: { entries: Record<string, ContextExampleEntry> };
  wiktionary: WiktionaryLexiconData;
  glossary: { entries: Record<string, string> };
  authoredSenses?: { entries: Record<string, WordSense[]> };
}

const OXFORD_POS_MAP: Record<string, string[]> = {
  noun: ["noun", "proper noun"],
  verb: ["verb"],
  adjective: ["adjective"],
  adverb: ["adverb"],
  preposition: ["preposition"],
  conjunction: ["conjunction"],
  pronoun: ["pronoun"],
  determiner: ["determiner", "article"],
  "indefinite article": ["article", "determiner"],
  "definite article": ["article", "determiner"],
  exclamation: ["interjection"],
  number: ["numeral", "number"],
};

const BRITISH_TO_AMERICAN_ALIASES: Record<string, string> = {
  aeroplane: "airplane",
  analyse: "analyze",
  apologise: "apologize",
  behaviour: "behavior",
  catalogue: "catalog",
  centre: "center",
  cheque: "check",
  colour: "color",
  criticise: "criticize",
  defence: "defense",
  dialogue: "dialog",
  emphasise: "emphasize",
  favour: "favor",
  favourite: "favorite",
  flavour: "flavor",
  grey: "gray",
  honour: "honor",
  humour: "humor",
  jewellery: "jewelry",
  kilometre: "kilometer",
  labour: "labor",
  licence: "license",
  litre: "liter",
  metre: "meter",
  mum: "mom",
  neighbour: "neighbor",
  neighbourhood: "neighborhood",
  organise: "organize",
  practise: "practice",
  programme: "program",
  pyjamas: "pajamas",
  realise: "realize",
  recognise: "recognize",
  rumour: "rumor",
  theatre: "theater",
  traveller: "traveler",
  tyre: "tire",
};

function parseOxfordPos(posText: string): string[] {
  const result: string[] = [];
  for (const part of posText.split(/[,/]/)) {
    const key = part.trim().toLowerCase();
    if (!key) continue;
    for (const mapped of OXFORD_POS_MAP[key] ?? [key]) {
      if (!result.includes(mapped)) result.push(mapped);
    }
  }
  return result;
}

function summarizeMeanings(senses: WordSense[], maxItems = 5): string {
  const seen = new Set<string>();
  const picked: string[] = [];
  const pushItem = (raw: string) => {
    const clean = raw.trim();
    const norm = clean.toLocaleLowerCase("tr");
    if (!clean || seen.has(norm)) return;
    seen.add(norm);
    picked.push(clean);
  };

  for (const sense of senses) {
    const first = sense.meaning.split(/[;,]/)[0];
    if (first) pushItem(first);
  }
  if (picked.length < maxItems) {
    for (const sense of senses) {
      for (const seg of sense.meaning.split(/[;,]/)) {
        if (picked.length >= maxItems) break;
        pushItem(seg);
      }
    }
  }
  return picked.join("; ");
}

function expandAcceptedTranslations(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    for (const piece of raw.split(/[;,]/)) {
      const trimmed = piece.trim();
      const plain = trimmed.replace(/\s*\([^)]*\)/g, "").trim();
      for (const candidate of [trimmed, plain]) {
        const key = candidate.toLocaleLowerCase("tr");
        if (!candidate || seen.has(key)) continue;
        seen.add(key);
        out.push(candidate);
      }
    }
  }
  return out;
}

/**
 * Enrich canonical vocabulary headwords with multi-sense Turkish meanings, IPA
 * pronunciation, example sentences, accepted translations, and attribution.
 */
export function applyDictionaryEnrichment(
  words: VocabularyWord[],
  sources: EnrichmentSources,
): VocabularyWord[] {
  const { dictionary, examples, wiktionary, glossary, authoredSenses } = sources;
  const wikiMap = new Map(wiktionary.entries.map((entry) => [entry.word.toLowerCase(), entry.entries]));
  const authoredMap = authoredSenses?.entries ?? {};

  return words.map((word) => {
    const key = word.word.toLowerCase();
    const aliasKey = BRITISH_TO_AMERICAN_ALIASES[key];
    const example = examples.entries[key];
    const allowedPos = parseOxfordPos(word.partOfSpeech);
    const primaryPos = example?.pos ?? allowedPos[0] ?? word.partOfSpeech.split(", ")[0];

    const wikiRows = wikiMap.get(key) ?? (aliasKey ? wikiMap.get(aliasKey) : undefined) ?? [];
    const matchedWikiRows = wikiRows.filter((row) => allowedPos.includes(row.pos));
    const wikiPrimary =
      matchedWikiRows.find((row) => row.pos === primaryPos && row.turkish.length) ??
      matchedWikiRows.find((row) => row.turkish.length) ??
      (!glossary.entries[key] && !dictionary.entries[key]?.length
        ? wikiRows.find((row) => row.turkish.length)
        : undefined);

    const pronunciation =
      matchedWikiRows.find((row) => row.pos === primaryPos && row.pronunciation)?.pronunciation ??
      matchedWikiRows.find((row) => row.pronunciation)?.pronunciation ??
      wikiRows.find((row) => row.pronunciation)?.pronunciation ??
      "";

    const curatedSenses = authoredMap[key] ?? (aliasKey ? authoredMap[aliasKey] : undefined);
    const wikiPosTr = matchedWikiRows.flatMap((row) => row.turkish ?? []);

    if (curatedSenses && curatedSenses.length > 0) {
      const meaningSummary = summarizeMeanings(curatedSenses);
      const accepted = expandAcceptedTranslations([
        ...curatedSenses.map((s) => s.meaning),
        ...(glossary.entries[key] ? [glossary.entries[key]] : []),
        ...wikiPosTr.slice(0, 6),
      ]);
      const primarySense = curatedSenses[0];
      return {
        ...word,
        turkishMeaning: meaningSummary,
        pronunciation,
        exampleSentence: primarySense.exampleSentence,
        ...(primarySense.exampleTranslation ? { exampleTranslation: primarySense.exampleTranslation } : {}),
        senses: curatedSenses,
        acceptedTranslations: accepted,
        dictionarySource: wikiPrimary?.sourceUrl
          ? `Özgün çoklu anlamlar (CC0) + ${wikiPrimary.sourceUrl} (Wiktionary, CC BY-SA 4.0)`
          : "Özgün çoklu anlamlar ve örnekler (CC0)",
      };
    }

    const freeDictTranslations = (dictionary.entries[key] ?? [])
      .map((t) => t.replace(/\.$/, "").trim())
      .filter((t) => t.length <= 100 && !/[().]/.test(t));
    const translations = wikiPosTr.length > 0
      ? [...new Set(wikiPosTr)]
      : wikiPrimary?.turkish.length
        ? wikiPrimary.turkish
        : freeDictTranslations;

    const fallbackSenses: WordSense[] = [];
    for (const row of matchedWikiRows) {
      for (const s of row.senses ?? []) {
        if (s.turkish?.length && s.examples?.length && fallbackSenses.length < 4) {
          fallbackSenses.push({
            pos: row.pos,
            meaning: s.turkish.slice(0, 3).join("; "),
            exampleSentence: s.examples[0],
          });
        }
      }
    }
    if (example && fallbackSenses.length === 0) {
      fallbackSenses.push({
        pos: example.pos,
        meaning: example.meaning,
        exampleSentence: example.sentence,
        exampleTranslation: example.translation,
      });
    }

    const authored = example?.meaning ?? glossary.entries[key];
    const meaning = authored ?? translations.slice(0, 3).join("; ") ?? "";
    const accepted = expandAcceptedTranslations([
      ...(authored ? [authored] : []),
      ...translations.slice(0, 8),
      ...fallbackSenses.map((s) => s.meaning),
    ]);

    return {
      ...word,
      turkishMeaning: meaning,
      pronunciation,
      acceptedTranslations: accepted,
      dictionarySource: authored
        ? "Özgün Türkçe karşılık (CC0)"
        : wikiPrimary?.turkish.length
          ? `${wikiPrimary.sourceUrl} (Wiktionary, CC BY-SA 4.0)`
          : meaning
            ? "FreeDict eng-tur 0.3 (GPL-2.0-or-later)"
            : undefined,
      ...(example
        ? { exampleSentence: example.sentence, exampleTranslation: example.translation }
        : fallbackSenses[0]
          ? { exampleSentence: fallbackSenses[0].exampleSentence }
          : {}),
      ...(fallbackSenses.length > 0 ? { senses: fallbackSenses } : {}),
    };
  });
}

