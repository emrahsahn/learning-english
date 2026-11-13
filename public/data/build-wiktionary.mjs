// General dictionary data derived from Wiktionary: CC-BY-SA-4.0.
// The private input supplies lookup spellings ONLY, never public learner metadata.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { setImmediate as yieldToEventLoop } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INPUT = path.join(ROOT, "private-data", "oxford-personal.json");
const CACHE = path.join(ROOT, "private-data", "dictionary-cache");
const OUTPUT = path.join(ROOT, "public", "data", "wiktionary-lexicon.json");
const LICENSE = path.join(ROOT, "public", "data", "LICENSE-CC-BY-SA-4.0.txt");
const LICENSE_URL = "https://creativecommons.org/licenses/by-sa/4.0/";
const LICENSE_TEXT_URL = `${LICENSE_URL}legalcode.txt`;
const CONCURRENCY = 8;
const TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
const MAX_SECONDS = 1800;
const POS = {
  adj: "adjective", adv: "adverb", pron: "pronoun", prep: "preposition",
  conj: "conjunction", det: "determiner", num: "numeral", intj: "interjection",
  noun: "noun", verb: "verb", article: "article", name: "proper noun",
};
const NON_PRIMARY = new Set([
  "archaic", "obsolete", "dated", "rare", "dialectal", "historical", "form-of",
  "slang", "vulgar", "offensive", "derogatory", "informal", "childish", "pejorative",
]);
const BAD_EXAMPLE_RE = /\b(fuck|shit|coke|heroin|cocaine|porn|sex|penis|vagina|bitch|bastard|whore|slut|rectum|panties|ass|damn|hell|suck|nazi|rape|suicide|murder|kill myself|prostitute|drunk|alcoholic|marijuana|weed)\b/iu;
const ARCHAIC_WORD_RE = /\b(thou|thee|thy|thine|hath|doth|ye)\b/iu;
const STOP_TOKENS = new Set([
  "a", "an", "the", "to", "of", "in", "on", "at", "for", "with", "by", "or", "and",
  "from", "as", "is", "be", "that", "which", "one", "someone", "something", "anything",
  "person", "thing", "used", "being", "having", "make", "made", "act", "state",
]);
const NOISY_TURKISH_RE = /\b(müellif|sıskalık|vasi|tâciz|münakaşa|tevkif|cemiyet|kabilinden|avantür|regülasyon|cerime|muvakkat|malaka|argınlık|çelimsizlik|betik|ilkyaz|odluçöp|imek)\b/iu;

function normalizeWord(word) {
  return word.normalize("NFC").replace(/[\u2018\u2019\u02bc]/gu, "'").trim();
}
function text(value) {
  return typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";
}
function array(value) {
  return Array.isArray(value) ? value : [];
}
function sourceUrl(word) {
  return `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}`;
}
function lookupUrl(word) {
  // Verified on book, a, I, o'clock, ice cream and T-shirt. Single letters
  // repeat the letter in both directory levels; case is significant.
  const chars = [...word];
  return `https://kaikki.org/dictionary/English/meaning/${encodeURIComponent(chars[0])}/${encodeURIComponent(chars.slice(0, 2).join(""))}/${encodeURIComponent(word)}.jsonl`;
}
function isPrimary(value) {
  return !array(value?.tags).some(tag => NON_PRIMARY.has(tag));
}
function primarySenses(entry) {
  return array(entry.senses).filter(sense => isPrimary(sense) && !array(sense.form_of).length);
}
function pronunciation(entry) {
  return array(entry.sounds)
    .filter(sound => typeof sound.ipa === "string" && sound.ipa.trim())
    .map((sound, index) => {
      const tags = array(sound.tags);
      let score = tags.includes("Received-Pronunciation") ? 40
        : tags.some(tag => ["UK", "British", "Standard-British", "Southern-England"].includes(tag)) ? 30
        : tags.some(tag => ["US", "General-American"].includes(tag)) ? 0 : 20;
      if (!isPrimary(sound)) score -= 100;
      if (sound.ipa.startsWith("/")) score += 2;
      return { ipa: sound.ipa.trim(), score, index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.ipa ?? "";
}
function cleanTurkishTerm(rawTerm) {
  const word = text(rawTerm);
  if (!word || [...word].length >= 60 || /[\n\r<>\[\]{}|!?"]/u.test(rawTerm)) return "";
  if (/^[,;.:-]/.test(word) || /[,;]$/.test(word)) return "";
  if (word.split(/\s+/u).length > 5) return "";
  if (NOISY_TURKISH_RE.test(word)) return "";
  return word;
}
function translationGroups(translations, fallbackSense = "") {
  const groups = new Map();
  for (const translation of array(translations)) {
    if (translation.code !== "tr" || !isPrimary(translation)) continue;
    const word = cleanTurkishTerm(translation.word);
    if (!word) continue;
    const sense = text(translation.sense) || fallbackSense;
    // A translation explicitly for another phrase is not a stand-alone equivalent.
    if (/translations?\s+(?:below\s+)?(?:are|is)\s+of\b/iu.test(sense)) continue;
    const key = sense || `unsensed:${word.toLocaleLowerCase("tr")}`;
    if (!groups.has(key)) groups.set(key, { sense, turkish: [], seen: new Set() });
    const group = groups.get(key);
    const dedupKey = word.normalize("NFC").toLocaleLowerCase("tr");
    if (!group.seen.has(dedupKey) && group.turkish.length < 6) {
      group.seen.add(dedupKey);
      group.turkish.push(word);
    }
  }
  return [...groups.values()].map(({ sense, turkish }) => ({ sense, turkish }));
}
function isCleanExampleSentence(exampleText, targetWord) {
  const s = text(exampleText);
  if (!s || s.length < 14 || s.length > 135) return false;
  if (!/^[A-Z]/u.test(s) || !/[.!?]$/u.test(s)) return false;
  if (/[\u2003\t\n\[\]{}|\\]|--|\.\.\.|…|—/u.test(s)) return false;
  if (BAD_EXAMPLE_RE.test(s) || ARCHAIC_WORD_RE.test(s)) return false;
  const escaped = targetWord.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?<![\\p{L}\\p{M}\\p{N}_])${escaped}(?![\\p{L}\\p{M}\\p{N}_])`, "iu");
  return re.test(s);
}
function senseExamples(sense, targetWord) {
  const seen = new Set();
  const list = [];
  for (const ex of array(sense?.examples)) {
    // Only extract contributor-authored examples (type === "example"), never external quotations.
    if (ex?.type !== "example") continue;
    const s = text(ex.text);
    if (!isCleanExampleSentence(s, targetWord)) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    list.push(s);
    if (list.length >= 2) break;
  }
  return list;
}
function tokens(value) {
  return new Set((value.toLowerCase().match(/[a-z]{3,}/g) ?? []).filter(t => !STOP_TOKENS.has(t)));
}
function findBestMatchingSense(label, senses, targetWord) {
  const labelTokens = tokens(label);
  const labelLower = label.toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const sense of senses) {
    const gloss = text(array(sense.glosses)[0]);
    if (!gloss) continue;
    const examples = senseExamples(sense, targetWord);
    const glossTokens = tokens(gloss);
    let overlap = 0;
    for (const tok of labelTokens) if (glossTokens.has(tok)) overlap++;
    const exactMatch = labelLower && gloss.toLowerCase().includes(labelLower);
    const matched = exactMatch || overlap >= 2 || (labelTokens.size === 1 && overlap === 1);
    if (!matched) continue;
    const score = (exactMatch ? 100 : 0) + overlap * 10 + (examples.length ? 5 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = { gloss, examples };
    }
  }
  return best;
}
function extractEntrySenses(word, entry) {
  const senses = primarySenses(entry);
  const result = [];
  const seenKey = new Set();

  // 1. Nested sense-level translations already directly aligned with a gloss and examples
  for (const sense of senses) {
    const gloss = text(array(sense.glosses)[0]);
    const examples = senseExamples(sense, word);
    const nested = translationGroups(sense.translations, gloss);
    for (const group of nested) {
      if (!group.turkish.length) continue;
      const key = `${group.sense}|${group.turkish.join(",")}`;
      if (seenKey.has(key)) continue;
      seenKey.add(key);
      result.push({
        sense: group.sense || gloss,
        ...(gloss ? { gloss } : {}),
        turkish: group.turkish,
        ...(examples.length ? { examples } : {}),
      });
    }
  }

  // 2. Top-level translation groups aligned carefully with glosses + examples
  const topGroups = translationGroups(entry.translations);
  for (const group of topGroups) {
    if (!group.turkish.length) continue;
    const key = `${group.sense}|${group.turkish.join(",")}`;
    if (seenKey.has(key)) continue;
    seenKey.add(key);
    const matched = group.sense ? findBestMatchingSense(group.sense, senses, word) : null;
    result.push({
      sense: group.sense,
      ...(matched?.gloss ? { gloss: matched.gloss } : {}),
      turkish: group.turkish,
      ...(matched?.examples?.length ? { examples: matched.examples } : {}),
    });
  }

  // 3. Clean example-bearing English senses when no Turkish translation table matched them
  const usedExamples = new Set(result.flatMap(item => item.examples ?? []));
  for (const sense of senses) {
    const gloss = text(array(sense.glosses)[0]);
    if (!gloss) continue;
    const examples = senseExamples(sense, word).filter(ex => !usedExamples.has(ex));
    if (!examples.length) continue;
    examples.forEach(ex => usedExamples.add(ex));
    result.push({
      sense: "",
      gloss,
      turkish: [],
      examples,
    });
    if (result.length >= 10) break;
  }

  return result.slice(0, 10);
}
function parseBody(body) {
  return body.split(/\r?\n/u).filter(line => line.trim()).map(line => {
    const entry = JSON.parse(line);
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("Invalid JSONL entry");
    return entry;
  });
}
function spellingReference(word, rawEntries) {
  const references = [];
  for (const raw of rawEntries) {
    if (raw.lang_code !== "en" || typeof raw.word !== "string" || normalizeWord(raw.word) !== word) continue;
    for (const sense of primarySenses(raw)) {
      if (array(sense.form_of).length) continue;
      const match = text(array(sense.glosses)[0]).match(/^(?:.+ standard spelling of|Alternative (?:spelling|form) of) ([\p{L}\p{N}' -]+)\.$/u);
      if (!match) continue;
      const target = normalizeWord(match[1]);
      const structured = array(sense.alt_of).map(value => typeof value.word === "string" ? normalizeWord(value.word) : "");
      if (target !== word && (!structured.length || structured.includes(target))) {
        references.push({ target, pos: POS[raw.pos] ?? raw.pos });
      }
    }
  }
  const target = references[0]?.target;
  return target ? { target, poses: new Set(references.filter(value => value.target === target).map(value => value.pos)) } : null;
}
function extract(word, rawEntries) {
  const byPos = new Map();
  for (const raw of rawEntries) {
    if (raw.lang_code !== "en" || typeof raw.word !== "string" || normalizeWord(raw.word) !== word || typeof raw.pos !== "string") continue;
    const pos = POS[raw.pos] ?? raw.pos;
    const extractedSenses = extractEntrySenses(word, raw);
    const ipa = pronunciation(raw);
    const allTurkish = [];
    const seenTr = new Set();
    for (const s of extractedSenses) {
      for (const tr of s.turkish) {
        const k = tr.normalize("NFC").toLocaleLowerCase("tr");
        if (!seenTr.has(k)) {
          seenTr.add(k);
          allTurkish.push(tr);
        }
      }
    }
    const hasExamples = extractedSenses.some(s => (s.examples?.length ?? 0) > 0);
    if (!ipa && !allTurkish.length && !hasExamples) continue;

    const firstTurkishSense = extractedSenses.find(s => s.turkish.length > 0);
    const primaryTurkish = allTurkish.slice(0, 8);
    const primarySenseLabel = firstTurkishSense?.sense || firstTurkishSense?.gloss || text(array(primarySenses(raw)[0]?.glosses)[0]);

    const existing = byPos.get(pos);
    if (!existing) {
      byPos.set(pos, {
        pos,
        pronunciation: ipa,
        turkish: primaryTurkish,
        sense: primarySenseLabel,
        sourceUrl: sourceUrl(word),
        senses: extractedSenses,
        bestRank: (primarySenses(raw).length ? 100 : 0) + (allTurkish.length ? 20 : 0) + (hasExamples ? 10 : 0) + (ipa ? 1 : 0),
      });
    } else {
      // Merge across non-archaic homonyms of the same POS so secondary common meanings aren't dropped.
      if (!existing.pronunciation && ipa) existing.pronunciation = ipa;
      const mergedTurkish = [...existing.turkish];
      const existingTrKeys = new Set(mergedTurkish.map(t => t.normalize("NFC").toLocaleLowerCase("tr")));
      for (const tr of allTurkish) {
        const k = tr.normalize("NFC").toLocaleLowerCase("tr");
        if (!existingTrKeys.has(k) && mergedTurkish.length < 10) {
          existingTrKeys.add(k);
          mergedTurkish.push(tr);
        }
      }
      const rank = (primarySenses(raw).length ? 100 : 0) + (allTurkish.length ? 20 : 0) + (hasExamples ? 10 : 0) + (ipa ? 1 : 0);
      if (rank > existing.bestRank) {
        existing.bestRank = rank;
        if (primarySenseLabel) existing.sense = primarySenseLabel;
      }
      existing.turkish = mergedTurkish;
      const seenSenseKey = new Set(existing.senses.map(s => `${s.sense}|${s.gloss ?? ""}|${s.turkish.join(",")}`));
      for (const s of extractedSenses) {
        const k = `${s.sense}|${s.gloss ?? ""}|${s.turkish.join(",")}`;
        if (!seenSenseKey.has(k) && existing.senses.length < 12) {
          seenSenseKey.add(k);
          existing.senses.push(s);
        }
      }
    }
  }
  const entries = [...byPos.values()].map(({ bestRank: _rank, ...rest }) => {
    void _rank;
    return rest;
  });
  return { word, entries };
}
function publicDocument(results) {
  const entries = [...results.values()].filter(value => value.entries.length)
    .sort((a, b) => a.word.localeCompare(b.word, "en"));
  return {
    license: "CC-BY-SA-4.0",
    licenseUrl: LICENSE_URL,
    licenseFile: "LICENSE-CC-BY-SA-4.0.txt",
    attribution: ["Wiktionary contributors", "Kaikki.org", "Wiktextract (Tatu Ylonen and contributors)"],
    sourceUrl: "https://kaikki.org/dictionary/English/",
    extractionSourceUrl: "https://github.com/tatuylonen/wiktextract",
    sourceLinks: Object.fromEntries(entries.map(entry => [entry.word, sourceUrl(entry.word)])),
    modifications: "English headwords normalized to NFC and ASCII apostrophes, preserving source spelling and case. Extracted primary and secondary senses per part of speech, preferred British/RP IPA, deduplicated Turkish equivalents per sense, and contributor-authored example sentences (type='example') while omitting all external quotations, audio, and learner metadata.",
    generatedAt: new Date().toISOString(),
    entries,
  };
}
function save(results) {
  fs.writeFileSync(OUTPUT, `${JSON.stringify(publicDocument(results), null, 2)}\n`);
}
async function responseBody(response) {
  if (Number(response.headers.get("content-length")) > MAX_RESPONSE_BYTES) throw new Error("Response exceeds size bound");
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > MAX_RESPONSE_BYTES) throw new Error("Response exceeds size bound");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}
async function lookup(word, offline) {
  const url = lookupUrl(word);
  const cacheFile = path.join(CACHE, `${createHash("sha256").update(url).digest("hex")}.json`);
  let cached;
  if (fs.existsSync(cacheFile)) {
    try {
      const value = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
      if (value.url === url && [200, 404].includes(value.status) && typeof value.body === "string") {
        if (value.status === 200) parseBody(value.body);
        cached = value;
      }
    } catch { /* Corrupt cache is ignored; the network attempt remains bounded. */ }
  }
  if (cached) return { ...cached, fromCache: true };
  if (offline) throw new Error("No valid private cache (offline)");
  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Accept: "application/x-ndjson, text/plain", "User-Agent": "BoundedWiktionaryEnrichment/1.0" },
  });
  const body = await responseBody(response);
  if (![200, 404].includes(response.status)) throw new Error(`HTTP ${response.status}`);
  if (response.status === 200) parseBody(body);
  const record = { url, status: response.status, fetchedAt: new Date().toISOString(), body };
  fs.writeFileSync(cacheFile, JSON.stringify(record));
  return { ...record, fromCache: false };
}
async function ensureLicense(offline) {
  if (fs.existsSync(LICENSE)) {
    const existing = fs.readFileSync(LICENSE, "utf8");
    if (existing.length > 10_000 && existing.startsWith("Attribution-ShareAlike 4.0 International")) return "full legal text";
  }
  try {
    if (offline) throw new Error("Offline mode");
    const response = await fetch(LICENSE_TEXT_URL, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const body = await responseBody(response);
    if (!response.ok || !body.startsWith("Attribution-ShareAlike 4.0 International") || body.length < 10_000) throw new Error(`Invalid license text (HTTP ${response.status})`);
    fs.writeFileSync(LICENSE, body);
    return "full legal text";
  } catch (error) {
    fs.writeFileSync(LICENSE, `Creative Commons Attribution-ShareAlike 4.0 International (CC-BY-SA-4.0)\n\nLicense: ${LICENSE_URL}\nFull legal text: ${LICENSE_TEXT_URL}\n\nThe full license text could not be downloaded during this build. This file is a license pointer, not the full legal text. Attribution and modification details are included in wiktionary-lexicon.json.\n`);
    console.warn(`License fallback: ${error.message}`);
    return "pointer only";
  }
}
function report(words, results, outcomes, license, stopReason, started) {
  const covered = words.map(word => results.get(word)).filter(Boolean);
  const entries = covered.flatMap(value => value.entries);
  const hasIpa = value => value.entries.some(entry => entry.pronunciation);
  const hasTurkish = value => value.entries.some(entry => entry.turkish.length);
  const hasExamples = value => value.entries.some(entry => array(entry.senses).some(s => array(s.examples).length));
  const freedict = JSON.parse(fs.readFileSync(path.join(ROOT, "public", "data", "eng-tr-dictionary.json"), "utf8")).entries;
  const gaps = words.filter(word => !array(freedict[word.toLowerCase()]).some(value => text(value)));
  const counts = state => [...outcomes.values()].filter(value => value.state === state).length;
  const summary = {
    lookupWords: words.length, completed: outcomes.size,
    publishedWords: covered.filter(value => value.entries.length).length, posEntries: entries.length,
    wordsWithIpa: covered.filter(hasIpa).length,
    wordsWithTurkish: covered.filter(hasTurkish).length,
    wordsWithExamples: covered.filter(hasExamples).length,
    wordsWithBoth: covered.filter(value => hasIpa(value) && hasTurkish(value)).length,
    successfulResponses: counts("ok"), notFound: counts("not-found"), errors: counts("error"),
    noUsableEntries: counts("no-usable-entries"), notAttempted: words.length - outcomes.size,
    cachedResponses: [...outcomes.values()].filter(value => value.fromCache).length,
    spellingReferenceWords: [...outcomes.values()].filter(value => value.spellingTarget).length,
    spellingReferenceNotFound: [...outcomes.values()].filter(value => value.fallbackNotFound).length,
    freedictGaps: gaps.length,
    license, stopReason: stopReason || null, elapsedSeconds: Math.round((Date.now() - started) / 1000),
  };
  console.log("Final coverage (private selection diagnostics; not published):");
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}
function selfTest() {
  assert.equal(normalizeWord("o’clock"), "o'clock");
  assert.equal(normalizeWord("T-shirt"), "T-shirt");
  assert.equal(lookupUrl("a"), "https://kaikki.org/dictionary/English/meaning/a/a/a.jsonl");
  assert.equal(lookupUrl("I"), "https://kaikki.org/dictionary/English/meaning/I/I/I.jsonl");
  assert.ok(lookupUrl("ice cream").endsWith("/ice%20cream.jsonl"));
  assert.ok(lookupUrl("o'clock").includes("/o/o'/o'clock.jsonl"));
  const spellingOnly = { word: "colour", lang_code: "en", pos: "noun", senses: [{ glosses: ["Commonwealth and Ireland standard spelling of color."] }] };
  const reference = spellingReference("colour", [spellingOnly]);
  assert.equal(reference.target, "color");
  assert.deepEqual([...reference.poses], ["noun"]);
  const raw = { word: "book", lang_code: "en", pos: "noun", sounds: [
    { ipa: "/US/", tags: ["US"] }, { ipa: "/bʊk/", tags: ["Received-Pronunciation"] }, { audio: "excluded.ogg" },
  ], translations: [
    { code: "tr", word: "kitap", sense: "bound sheets of paper" },
    { code: "tr", word: "cilt", sense: "major division of a work" },
  ], senses: [
    { glosses: ["A collection of bound sheets of paper."], examples: [{ type: "example", text: "She opened the book to page 37." }, { type: "quotation", text: "EXCLUDED QUOTATION about book." }] },
    { glosses: ["A major division of a published work."], examples: [{ type: "example", text: "The first book contains five chapters." }] },
  ], cefrLevel: "A1", id: "private-id" };
  const result = extract("book", [raw, { ...raw, pos: "verb", translations: [{ code: "tr", word: "yer ayırtmak", sense: "reserve" }], senses: [{ glosses: ["To reserve for future use."], examples: [{ type: "example", text: "I want to book a hotel room." }] }] },
    { ...raw, pos: "verb", senses: [{ glosses: ["past of bake"], tags: ["form-of"] }], translations: [] },
    { ...raw, lang_code: "de" }, { ...raw, word: "Book" }]);
  assert.equal(result.entries.length, 2);
  assert.deepEqual(result.entries[0].turkish, ["kitap", "cilt"]);
  assert.equal(result.entries[0].pronunciation, "/bʊk/");
  assert.equal(result.entries[0].senses.length, 2);
  assert.deepEqual(result.entries[0].senses[0].examples, ["She opened the book to page 37."]);
  assert.equal(result.entries[1].sense, "reserve");
  const serialized = JSON.stringify(publicDocument(new Map([[result.word, result]])));
  assert.ok(!/cefrLevel|private-id|EXCLUDED QUOTATION|excluded\.ogg/u.test(serialized));
  assert.deepEqual(Object.keys(result.entries[0]), ["pos", "pronunciation", "turkish", "sense", "sourceUrl", "senses"]);
  console.log("Self-tests passed: multi-sense extraction, example matching, quotation exclusion, British IPA, and public-field whitelist.");
}
async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) { selfTest(); return; }
  let limit = Infinity;
  const offline = args.includes("--offline");
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--offline") continue;
    if (args[i] === "--limit") {
      limit = Number(args[++i]);
      if (!Number.isSafeInteger(limit) || limit <= 0) throw new Error("--limit requires a positive integer");
    } else throw new Error(`Unknown option: ${args[i]}`);
  }
  const started = Date.now();
  const input = JSON.parse(fs.readFileSync(INPUT, "utf8"));
  if (!Array.isArray(input) || input.some(value => typeof value?.word !== "string" || !normalizeWord(value.word))) throw new Error("Private input must be an array of objects with nonempty word strings");
  const words = [...new Set(input.map(value => normalizeWord(value.word)))].slice(0, limit);
  fs.mkdirSync(CACHE, { recursive: true });
  const results = new Map();
  const outcomes = new Map();
  const license = await ensureLicense(offline);
  console.log(`Starting ${words.length} lookups; concurrency=${CONCURRENCY}, timeout=${TIMEOUT_MS}ms, offline=${offline}.`);
  let next = 0;
  let consecutiveErrors = 0;
  let stopReason = "";
  const worker = async () => {
    while (next < words.length) {
      if (Date.now() - started >= MAX_SECONDS * 1000) stopReason ||= "Run deadline reached";
      if (stopReason) return;
      const word = words[next++];
      try {
        const response = await lookup(word, offline);
        const rawEntries = response.status === 200 ? parseBody(response.body) : [];
        let extracted = extract(word, rawEntries);
        let fromCache = response.fromCache;
        let spellingTarget = "";
        let fallbackNotFound = false;
        if (response.status === 200 && !extracted.entries.length) {
          const reference = spellingReference(word, rawEntries);
          if (reference) {
            const fallback = await lookup(reference.target, offline);
            fromCache &&= fallback.fromCache;
            fallbackNotFound = fallback.status === 404;
            if (fallback.status === 200) {
              const canonical = extract(reference.target, parseBody(fallback.body));
              extracted = { word, entries: canonical.entries.filter(entry => reference.poses.has(entry.pos)) };
              if (extracted.entries.length) spellingTarget = reference.target;
            }
          }
        }
        results.set(word, extracted);
        outcomes.set(word, { state: response.status === 404 ? "not-found" : extracted.entries.length ? "ok" : "no-usable-entries", fromCache, spellingTarget, fallbackNotFound });
        consecutiveErrors = 0;
      } catch (error) {
        outcomes.set(word, { state: "error", error: error.message, fromCache: false });
        console.warn(`Lookup failed: ${word}: ${error.message}`);
        consecutiveErrors++;
        if (!offline && consecutiveErrors >= 32) stopReason ||= "Stopped after 32 consecutive lookup failures";
      }
      if (outcomes.size % 500 === 0) {
        save(results);
        console.log(`Checkpoint ${outcomes.size}/${words.length}; published=${[...results.values()].filter(value => value.entries.length).length}.`);
      }
      if (outcomes.size % 16 === 0) await yieldToEventLoop();
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, words.length) }, worker));
  } finally {
    save(results);
  }
  const summary = report(words, results, outcomes, license, stopReason, started);
  if (summary.errors || summary.notAttempted) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
