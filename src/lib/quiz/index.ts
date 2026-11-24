import { isDue } from "@/lib/learning/scheduler";
import type { CefrLevel, QuizType, VocabularyWord, WordProgress } from "@/types";

export type QuestionType = Exclude<QuizType, "mixed">;
export type QuizPool = "all" | "learning" | "due" | "favorites" | "difficult";
export interface QuizContext {
  sentence: string;
  translation?: string;
}
export interface QuizQuestion {
  id: string;
  wordId: string;
  word: string;
  answer: string;
  acceptedAnswers: string[];
  options?: string[];
  type: QuestionType;
  prompt: string;
  /** Full context is for feedback, not for displaying before an answer. */
  context?: QuizContext;
  promptContext?: string;
}
export interface QuizFilter {
  level: CefrLevel | "all";
  listeningAvailable: boolean;
  pool?: QuizPool;
  progress?: readonly WordProgress[];
  now?: Date;
}
export interface QuizConfig extends QuizFilter {
  type: QuizType;
  length: number;
  /** Supplied by the caller: generation has no clock, browser or random side effects. */
  sessionId: string;
  seed: string;
}
export interface QuizGeneration {
  questions: QuizQuestion[];
  availability: Record<QuizType, number>;
  requestedLength: number;
  notices: string[];
}
export const QUESTION_TYPES: readonly QuestionType[] = [
  "en-tr-choice", "tr-en-choice", "blank", "sentence",
  "en-tr-write", "tr-en-write", "listening",
];
export const QUIZ_LABELS: Record<QuizType, string> = {
  "en-tr-choice": "İngilizce → Türkçe · Seçmeli",
  "tr-en-choice": "Türkçe → İngilizce · Seçmeli",
  blank: "Cümlede boşluk · Yazılı",
  sentence: "Cümle tamamlama · Seçmeli",
  "en-tr-write": "İngilizce → Türkçe · Yazılı",
  "tr-en-write": "Türkçe → İngilizce · Yazılı",
  listening: "Dinleme · İngilizce yazılı",
  mixed: "Karma pratik",
};
export const QUIZ_POOLS: readonly QuizPool[] = ["all", "learning", "due", "favorites", "difficult"];
export const QUIZ_POOL_LABELS: Record<QuizPool, string> = {
  all: "Tüm kelimeler",
  learning: "Öğreniliyor",
  due: "Tekrar zamanı gelenler",
  favorites: "Favorilerim",
  difficult: "Zorlandıklarım",
};

export function filterPoolWordIds(
  words: readonly VocabularyWord[],
  progress: readonly WordProgress[],
  pool: QuizPool,
  now = new Date(),
): Set<string> {
  if (pool === "all") return new Set(words.filter(word => word.id).map(word => word.id));
  const byId = new Map(progress.map(item => [item.wordId, item]));
  const matched = new Set<string>();
  for (const word of words) {
    if (!word.id) continue;
    const item = byId.get(word.id);
    if (pool === "learning" && item?.status === "learning") matched.add(word.id);
    else if (pool === "due" && isDue(item, now)) matched.add(word.id);
    else if (pool === "favorites" && item?.favorite === true) matched.add(word.id);
    else if (pool === "difficult" && item && (item.incorrectCount > 0 || (item.reviewCount > 0 && item.difficulty >= 0.55))) {
      matched.add(word.id);
    }
  }
  return matched;
}

export function normalizeTurkish(value: string): string {
  return value.normalize("NFC").toLocaleLowerCase("tr-TR")
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ").trim().normalize("NFC");
}
export function normalizeEnglish(value: string): string {
  return value.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
}
export function acceptedTranslations(word: VocabularyWord): string[] {
  const seen = new Set<string>();
  return [word.turkishMeaning, ...(word.senses?.map(sense => sense.meaning) ?? []), ...(word.acceptedTranslations ?? [])]
    .flatMap(value => value.split(/[;,]/))
    .map(value => value.trim().normalize("NFC"))
    .filter(value => {
      const key = normalizeTurkish(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
function fullWordPattern(word: string): RegExp | null {
  const text = word.trim().normalize("NFC");
  if (!text) return null;
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Unicode boundaries also handle words such as café and escaped terms such as C++.
  return new RegExp(`(?<![\\p{L}\\p{M}\\p{N}_])${escaped}(?![\\p{L}\\p{M}\\p{N}_])`, "giu");
}
export function matchingContext(word: VocabularyWord): QuizContext | undefined {
  const sentence = word.exampleSentence?.trim().normalize("NFC");
  const pattern = fullWordPattern(word.word);
  if (!sentence || !pattern?.test(sentence)) return undefined;
  return {
    sentence,
    ...(word.exampleTranslation?.trim() ? { translation: word.exampleTranslation.trim() } : {}),
  };
}
export function maskWord(sentence: string, word: string): string {
  const pattern = fullWordPattern(word);
  return pattern ? sentence.normalize("NFC").replace(pattern, "____") : sentence;
}
export function gradeAnswer(question: QuizQuestion, response: string): boolean {
  const normalize = question.type === "en-tr-choice" || question.type === "en-tr-write"
    ? normalizeTurkish : normalizeEnglish;
  const value = normalize(response);
  return !!value && question.acceptedAnswers.some(answer => normalize(answer) === value);
}

interface PreparedWord {
  source: VocabularyWord;
  english: string;
  translations: string[];
  primaryMeaning: string;
  meanings: Set<string>;
  synonyms: Set<string>;
  context?: QuizContext;
}
type Variant = Omit<QuizQuestion, "id">;
interface PreparedQuiz {
  words: PreparedWord[];
  variants: Map<string, Partial<Record<QuestionType, Variant>>>;
  availability: Record<QuizType, number>;
}
function overlaps(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  for (const key of left) if (right.has(key)) return true;
  return false;
}
function ambiguous(left: PreparedWord, right: PreparedWord): boolean {
  return left.english === right.english || overlaps(left.meanings, right.meanings)
    || left.synonyms.has(right.english) || right.synonyms.has(left.english);
}
function prepareWords(words: readonly VocabularyWord[], level: QuizFilter["level"]): PreparedWord[] {
  const ids = new Set<string>();
  const english = new Set<string>();
  return words.filter(word => level === "all" || word.cefrLevel === level).flatMap(source => {
    const key = normalizeEnglish(source.word);
    if (!key || !source.id || ids.has(source.id) || english.has(key)) return [];
    ids.add(source.id);
    english.add(key);
    const translations = acceptedTranslations(source);
    const meanings = new Set(translations.map(normalizeTurkish));
    return [{ source, english: key, translations,
      primaryMeaning: meanings.values().next().value ?? "", meanings,
      synonyms: new Set((source.synonyms ?? []).map(normalizeEnglish)),
      context: matchingContext(source),
    }];
  }).sort((a, b) => a.english < b.english ? -1 : a.english > b.english ? 1 : 0);
}
function choices(target: PreparedWord, pool: PreparedWord[], turkish: boolean, sentence = false): string[] | undefined {
  const chosen: PreparedWord[] = [target];
  const label = (word: PreparedWord) => turkish ? word.translations[0] : word.source.word.trim();
  if (!label(target)) return undefined;
  const labelKey = (word: PreparedWord) => turkish ? word.primaryMeaning : word.english;
  const labels = new Set([labelKey(target)]);
  // Prefer grammatical peers without fabricating sentence distractors or meanings.
  const candidates = sentence
    ? [...pool.filter(w => w.source.partOfSpeech === target.source.partOfSpeech),
      ...pool.filter(w => w.source.partOfSpeech !== target.source.partOfSpeech)] : pool;
  for (const candidate of candidates) {
    // Unknown meanings cannot be checked for ambiguity in a translation question.
    if (!sentence && !candidate.translations.length) continue;
    if (sentence && target.context && fullWordPattern(candidate.source.word)?.test(target.context.sentence)) continue;
    const key = labelKey(candidate);
    if (!key || labels.has(key) || chosen.some(word => ambiguous(word, candidate))) continue;
    labels.add(key);
    chosen.push(candidate);
    if (chosen.length === 4) return chosen.map(label);
  }
  return undefined;
}
function prepareQuiz(words: readonly VocabularyWord[], filter: QuizFilter): PreparedQuiz {
  const levelPool = prepareWords(words, filter.level);
  const pool = filter.pool ?? "all";
  const allowedIds = pool === "all"
    ? null
    : filterPoolWordIds(levelPool.map(word => word.source), filter.progress ?? [], pool, filter.now);
  const targetWords = allowedIds
    ? levelPool.filter(word => allowedIds.has(word.source.id))
    : levelPool;
  const variants: PreparedQuiz["variants"] = new Map();
  const availability: Record<QuizType, number> = {
    "en-tr-choice": 0, "tr-en-choice": 0, blank: 0, sentence: 0,
    "en-tr-write": 0, "tr-en-write": 0, listening: 0, mixed: 0,
  };
  if (!targetWords.length) return { words: targetWords, variants, availability };
  // Index every known equivalent once across the level pool. Re-normalizing the target translation inside
  // a full-pool filter for each word makes initial setup quadratic and blocks the UI.
  const equivalentsByMeaning = new Map<string, string[]>();
  for (const word of levelPool) {
    for (const meaning of word.meanings) {
      const equivalents = equivalentsByMeaning.get(meaning) ?? [];
      equivalents.push(word.source.word.trim());
      equivalentsByMeaning.set(meaning, equivalents);
    }
  }
  for (const word of targetWords) {
    const wordText = word.source.word.trim();
    const base = { wordId: word.source.id, word: wordText,
      ...(word.context ? { context: word.context } : {}) };
    const types: Partial<Record<QuestionType, Variant>> = {};
    // A written Turkish prompt can have several valid English equivalents.
    // Accept exact, known equivalent headwords rather than grading a synonym as wrong.
    const englishAnswers = [...new Set([wordText, ...(equivalentsByMeaning.get(word.primaryMeaning) ?? [])])];
    if (word.translations.length) {
      const turkish = { ...base, answer: word.translations[0], acceptedAnswers: word.translations,
        prompt: wordText, ...(word.context ? { promptContext: word.context.sentence } : {}) };
      const english = { ...base, answer: wordText, acceptedAnswers: englishAnswers, prompt: word.translations[0] };
      types["en-tr-write"] = { ...turkish, type: "en-tr-write" };
      types["tr-en-write"] = { ...english, type: "tr-en-write" };
      const trOptions = choices(word, levelPool, true);
      if (trOptions) types["en-tr-choice"] = { ...turkish, type: "en-tr-choice", options: trOptions };
      const enOptions = choices(word, levelPool, false);
      if (enOptions) types["tr-en-choice"] = { ...english, type: "tr-en-choice", options: enOptions };
    }
    if (word.context) {
      const masked = { ...base, answer: wordText, acceptedAnswers: englishAnswers,
        prompt: maskWord(word.context.sentence, wordText),
        ...(word.context.translation || word.translations[0] ? { promptContext: word.context.translation ?? `Türkçe ipucu: ${word.translations[0]}` } : {}) };
      types.blank = { ...masked, type: "blank" };
      const options = choices(word, levelPool, false, true);
      if (options) types.sentence = { ...masked, type: "sentence", options };
    }
    if (filter.listeningAvailable) {
      types.listening = { ...base, type: "listening", answer: wordText,
        acceptedAnswers: [wordText], prompt: "Duyduğun İngilizce kelimeyi yaz." };
    }
    for (const type of QUESTION_TYPES) if (types[type]) availability[type]++;
    if (Object.keys(types).length) {
      availability.mixed++;
      variants.set(word.source.id, types);
    }
  }
  return { words: targetWords, variants, availability };
}
export function getQuizAvailability(words: readonly VocabularyWord[], filter: QuizFilter): Record<QuizType, number> {
  return prepareQuiz(words, filter).availability;
}
function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++) state = Math.imul(state ^ seed.charCodeAt(i), 16777619);
  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function generateQuiz(words: readonly VocabularyWord[], config: QuizConfig): QuizGeneration {
  const prepared = prepareQuiz(words, config);
  const random = seededRandom(config.seed);
  const requestedLength = Number.isFinite(config.length) ? Math.max(0, Math.min(50, Math.floor(config.length))) : 0;
  const remaining = shuffled(prepared.words.filter(word => prepared.variants.has(word.source.id)), random);
  const questions: QuizQuestion[] = [];
  const used = Object.fromEntries(QUESTION_TYPES.map(type => [type, 0])) as Record<QuestionType, number>;
  const priority = shuffled(QUESTION_TYPES, random);
  while (questions.length < requestedLength && remaining.length) {
    let type: QuestionType;
    if (config.type === "mixed") {
      const counts = Object.fromEntries(QUESTION_TYPES.map(candidate => [candidate,
        remaining.filter(word => prepared.variants.get(word.source.id)?.[candidate]).length,
      ])) as Record<QuestionType, number>;
      // Balance modes, using scarce opportunities before flexible words consume them.
      const availableTypes = priority.filter(candidate => counts[candidate] > 0);
      if (!availableTypes.length) break;
      availableTypes.sort((a, b) => used[a] - used[b] || counts[a] - counts[b]);
      type = availableTypes[0];
    } else {
      type = config.type;
    }
    const index = remaining.findIndex(word => prepared.variants.get(word.source.id)?.[type]);
    if (index === -1) break;
    const [word] = remaining.splice(index, 1);
    const variant = prepared.variants.get(word.source.id)![type]!;
    questions.push({ ...variant, acceptedAnswers: [...variant.acceptedAnswers],
      id: `${config.sessionId}:question:${questions.length + 1}`,
      ...(variant.options ? { options: shuffled(variant.options, random) } : {}),
    });
    used[type]++;
  }
  const notices: string[] = [];
  if (questions.length < requestedLength) {
    notices.push(`${requestedLength} soru istendi; bu ayarlar için ${questions.length} farklı kelimeden uygun soru hazırlanabildi. Başka soru türüne geçilmedi.`);
  }
  if (config.type === "mixed") {
    const unavailable = QUESTION_TYPES.filter(type => !prepared.availability[type]);
    if (unavailable.length) notices.push(`Karmaya alınmayan türler: ${unavailable.map(type => QUIZ_LABELS[type]).join(", ")}.`);
  }
  return { questions, availability: prepared.availability, requestedLength, notices };
}
