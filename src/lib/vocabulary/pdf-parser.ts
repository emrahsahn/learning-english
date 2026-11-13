import { LEVELS, type CefrLevel, type VocabularyWord } from "@/types";
export const OXFORD_PDF_URL = "https://www.oxfordlearnersdictionaries.com/external/pdf/wordlists/oxford-3000-5000/The_Oxford_3000.pdf";
export interface PdfTextItem { str: string; transform: number[]; fontName: string; }
export interface PrintedEntry { heading: string; specification: string; }
const POS = /\s+(?:n\.|noun\.|v\.|adj\.|adv\.|prep\.|pron\.|det\.|conj\.|exclam\.|modal v\.|auxiliary v\.|indefinite article|definite article|ordinal number|number|linking v\.)/;
export function extractEntries(pages: PdfTextItem[][]): PrintedEntry[] {
  const result: PrintedEntry[] = [];
  for (const items of pages) {
    const rows = new Map<string, PdfTextItem[]>();
    for (const item of items) {
      if (!item.str.trim() || item.transform[5] < 40) continue;
      const column = Math.max(0, Math.min(3, Math.floor((item.transform[4] - 42.5 + 1) / 130.4)));
      const key = `${column}:${Math.round(item.transform[5] * 2) / 2}`;
      const row = rows.get(key) ?? []; row.push(item); rows.set(key, row);
    }
    const ordered = [...rows].sort(([a],[b]) => Number(a.split(":")[0]) - Number(b.split(":")[0]) || Number(b.split(":")[1]) - Number(a.split(":")[1]));
    let pending: PrintedEntry | null = null;
    for (const [, row] of ordered) {
      row.sort((a,b) => a.transform[4]-b.transform[4]);
      const line = row.map(i=>i.str).join(" ").replace(/\s+([,.)])/g,"$1").replace(/\(\s+/g,"(").replace(/\s+/g," ").trim();
      const pos = POS.exec(line);
      if (pos && pos.index > 0 && !/\b[AB][12]\b/.test(line.slice(0, pos.index)) && !/^(?:n\.|noun\.|v\.|adj\.|adv\.|prep\.|pron\.|det\.|conj\.|exclam\.|[AB][12]\b)/.test(line)) {
        if (pending) result.push(pending);
        pending = { heading: line.slice(0,pos.index).trim(), specification: line.slice(pos.index).trim() };
      } else if (pending && /\b[AB][12]\b/.test(line)) pending.specification += ` ${line}`;
    }
    if (pending) result.push(pending);
  }
  return result.filter(e => /\b(?:A1|A2|B1|B2)\b/.test(e.specification));
}
const POS_NAMES: Record<string,string> = { "n.":"noun", "noun.":"noun", "v.":"verb", "adj.":"adjective", "adv.":"adverb", "prep.":"preposition", "pron.":"pronoun", "det.":"determiner", "conj.":"conjunction", "exclam.":"exclamation" };
export function entriesToWords(entries: PrintedEntry[]): VocabularyWord[] {
  const words = new Map<string,VocabularyWord>();
  for(const entry of entries) {
    const levels = entry.specification.match(/\b(?:A1|A2|B1|B2)\b/g) as CefrLevel[] | null;
    if (!levels?.length) continue;
    const level = [...levels].sort((a,b)=>LEVELS.indexOf(a)-LEVELS.indexOf(b))[0];
    const posTokens = entry.specification.match(/\b(?:n\.|noun\.|v\.|adj\.|adv\.|prep\.|pron\.|det\.|conj\.|exclam\.)/g) ?? [];
    const pos = [...new Set(posTokens.map(p=>POS_NAMES[p]))].join(", ") || entry.specification.replace(/\b[AB][12]\b/g,"").replace(/[,\s]+$/g,"").trim();
    // Printed homograph numbers are labels, not distinct vocabulary headwords.
    const heading = entry.heading.replace(/[™®]/g, "").replace(/\s*\([^)]*\)/g, "").replace(/\s*\d+\b/g, "").replace(/\s+([.'’-])/g,"$1").replace(/([’'-])\s+/g,"$1").trim();
    for (const variant of heading.split(/,\s*/)) {
      const spelling = variant.replace(/\s+/g," ").trim();
      if(!spelling || !/^[a-zA-Z][a-zA-Z\s.'’()-]*$/.test(spelling)) throw new Error(`PDF başlığı okunamadı: ${entry.heading}`);
      const key = spelling.toLowerCase();
      const previous = words.get(key);
      if(previous) {
        if(LEVELS.indexOf(level)<LEVELS.indexOf(previous.cefrLevel)) previous.cefrLevel=level;
        previous.partOfSpeech = [...new Set([...previous.partOfSpeech.split(", "), ...pos.split(", ")])].join(", ");
      } else words.set(key,{ id:`ox-${key.replace(/\s+/g,"-")}`,word:spelling,cefrLevel:level,partOfSpeech:pos,turkishMeaning:"",pronunciation:"" });
    }
  }
  return [...words.values()].sort((a,b)=>a.word.localeCompare(b.word,"en"));
}
