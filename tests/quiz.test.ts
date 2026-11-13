import { describe, expect, it } from "vitest";
import {
  acceptedTranslations, generateQuiz, getQuizAvailability, gradeAnswer,
  maskWord, matchingContext, normalizeEnglish, normalizeTurkish, QUESTION_TYPES,
  type QuizConfig, type QuizQuestion,
} from "../src/lib/quiz";
import type { VocabularyWord } from "../src/types";

function word(text: string, meaning = "", extra: Partial<VocabularyWord> = {}): VocabularyWord {
  return { id: text, word: text, turkishMeaning: meaning, cefrLevel: "A1", partOfSpeech: "noun", pronunciation: "", ...extra };
}
const vocabulary = [
  word("apple", "elma", { exampleSentence: "An apple fell from the tree.", exampleTranslation: "Ağaçtan bir elma düştü." }),
  word("book", "kitap", { exampleSentence: "The book is on the desk." }),
  word("chair", "sandalye", { exampleSentence: "She sat on the chair." }),
  word("door", "kapı", { exampleSentence: "Please close the door." }),
  word("egg", "yumurta", { exampleSentence: "There is an egg in the bowl." }),
  word("flower", "çiçek", { exampleSentence: "This flower smells nice." }),
  word("garden", "bahçe", { exampleSentence: "The garden is outside." }),
  word("house", "ev", { exampleSentence: "Their house is small." }),
  word("island", "ada", { exampleSentence: "We visited the island." }),
  word("jacket", "ceket", { exampleSentence: "I need my jacket." }),
];
const config = (extra: Partial<QuizConfig> = {}): QuizConfig => ({
  type: "mixed", length: 10, level: "all", listeningAvailable: true,
  sessionId: "quiz-one", seed: "repeatable", ...extra,
});
const question = (type: QuizQuestion["type"], answers: string[]): QuizQuestion => ({
  id: "question", wordId: "word", word: "word", type, prompt: "Question",
  answer: answers[0], acceptedAnswers: answers,
});

describe("strict answer normalization", () => {
  it("handles Turkish dotted/dotless I, punctuation and whitespace", () => {
    expect(normalizeTurkish("  IŞIK,\n  KAYNAĞI! ")).toBe("ışık kaynağı");
    expect(normalizeTurkish("İSTANBUL")).toBe("istanbul");
    expect(gradeAnswer(question("en-tr-write", ["ışık kaynağı"]), "IŞIK — KAYNAĞI!")).toBe(true);
  });
  it("uses NFC for canonically equivalent Turkish text", () => {
    expect(normalizeTurkish("c\u0327ic\u0327ek")).toBe("çiçek");
    expect(gradeAnswer(question("en-tr-write", ["çiçek"]), "C\u0327İC\u0327EK")).toBe(true);
  });
  it("splits primary and optional translations and deduplicates normalized alternatives", () => {
    const target = word("bright", "parlak; aydınlık, zeki", {
      acceptedTranslations: ["PARLAK!", "ışıklı", "  ", "zeki; akıllı"],
    });
    expect(acceptedTranslations(target)).toEqual(["parlak", "aydınlık", "zeki", "ışıklı", "akıllı"]);
    const generated = generateQuiz([target], config({ type: "en-tr-write", length: 1 })).questions[0];
    expect(gradeAnswer(generated, "AYDINLIK!")).toBe(true);
    expect(gradeAnswer(generated, "akıllı")).toBe(true);
  });
  it("never accepts an arbitrary substring, broad fuzzy match, or missing Turkish diacritics", () => {
    const q = question("en-tr-write", ["ışık kaynağı", "aydınlık"]);
    for (const response of ["ışık", "kaynağı", "çok aydınlık", "aydınlı", "isik kaynagi", "ışik kaynağı", "", "!!!"]) {
      expect(gradeAnswer(q, response), response).toBe(false);
    }
  });
  it("lowercases English but requires the entire word or phrase", () => {
    expect(normalizeEnglish("  TAKE\nOFF ")).toBe("take off");
    const q = question("blank", ["take off"]);
    expect(gradeAnswer(q, "Take OFF")).toBe(true);
    expect(gradeAnswer(q, "take")).toBe(false);
    expect(gradeAnswer(q, "take off now")).toBe(false);
    expect(gradeAnswer(question("listening", ["can't"]), "cant")).toBe(false);
  });
});

describe("real, exact-word sentence eligibility", () => {
  it("only uses the example belonging to the target word", () => {
    expect(matchingContext(word("cat", "kedi", { exampleSentence: "The dog ran." }))).toBeUndefined();
    expect(matchingContext(word("cat"))).toBeUndefined();
    const result = generateQuiz([word("cat"), word("dog", "köpek", { exampleSentence: "The dog ran." })], config({ type: "blank" }));
    expect(result.questions.map(q => q.word)).toEqual(["dog"]);
  });
  it("matches case-insensitively at full-word boundaries, not inflections or substrings", () => {
    const valid = word("cat", "kedi", { exampleSentence: "The CAT, a cat, slept." });
    expect(matchingContext(valid)?.sentence).toBe("The CAT, a cat, slept.");
    expect(maskWord(valid.exampleSentence!, valid.word)).toBe("The ____, a ____, slept.");
    for (const sentence of ["Cats sleep.", "We concatenate strings.", "A bobcat sleeps.", "cat_name", "cat2", "écat"]) {
      expect(matchingContext(word("cat", "kedi", { exampleSentence: sentence })), sentence).toBeUndefined();
    }
  });
  it("escapes regex metacharacters and supports full phrases and Unicode words", () => {
    expect(maskWord("We use C++ today.", "C++")).toBe("We use ____ today.");
    expect(matchingContext(word("C++", "", { exampleSentence: "We use C+ today." }))).toBeUndefined();
    expect(maskWord("Please take off your coat.", "take off")).toBe("Please ____ your coat.");
    expect(matchingContext(word("take off", "", { exampleSentence: "We take office calls." }))).toBeUndefined();
    expect(maskWord("Meet at the CAFÉ.", "café")).toBe("Meet at the ____.");
    expect(maskWord("A (test) works.", "(test)")).toBe("A ____ works.");
  });
  it("masks every occurrence and keeps full context only for feedback", () => {
    const target = word("cat", "kedi", { exampleSentence: "A cat watched another CAT.", exampleTranslation: "Bir kedi başka bir kediyi izledi." });
    const q = generateQuiz([target], config({ type: "blank", length: 1 })).questions[0];
    expect(q.prompt).toBe("A ____ watched another ____.");
    expect(q.prompt.toLowerCase()).not.toContain("cat");
    expect(q.context).toEqual({ sentence: target.exampleSentence, translation: target.exampleTranslation });
    expect(q.promptContext).toBe(target.exampleTranslation);
  });
  it("never manufactures a sentence when data is absent or mismatched", () => {
    const inputs = [word("book", "kitap"), word("cat", "kedi", { exampleSentence: "Cats sleep." })];
    for (const type of ["blank", "sentence"] as const) {
      const result = generateQuiz(inputs, config({ type }));
      expect(result.questions).toHaveLength(0);
      expect(result.availability[type]).toBe(0);
    }
  });
});

describe("written contextual equivalents", () => {
  it("accepts known English equivalents for a shared Turkish meaning", () => {
    const result = generateQuiz([word("large", "büyük"), word("big", "büyük")], config({ type: "tr-en-write", length: 2 }));
    for (const q of result.questions) { expect(gradeAnswer(q, "large")).toBe(true); expect(gradeAnswer(q, "big")).toBe(true); expect(gradeAnswer(q, "huge")).toBe(false); }
  });
  it("adds Turkish context so grammatical sentence alternatives are not arbitrary", () => {
    const target = word("bread", "ekmek", { exampleSentence: "We buy bread every day.", exampleTranslation: "Her gün ekmek alırız." });
    const q = generateQuiz([target], config({ type: "blank", length: 1 })).questions[0];
    expect(q.promptContext).toBe("Her gün ekmek alırız."); expect(q.prompt).not.toContain("bread");
  });
});

describe("unambiguous multiple choice", () => {
  const semanticPool = [
    word("fast", "hızlı; çabuk"),
    word("quick", "süratli", { acceptedTranslations: ["ÇABUK!"] }),
    word("rapid", "seri", { acceptedTranslations: ["hızlı"] }),
    word("slow", "yavaş"), word("heavy", "ağır"), word("quiet", "sessiz"),
  ];
  it.each(["en-tr-choice", "tr-en-choice"] as const)("excludes overlapping primary and accepted meanings in %s", type => {
    const result = generateQuiz(semanticPool, config({ type, length: 50 }));
    const q = result.questions.find(item => item.word === "fast")!;
    expect(q).toBeDefined();
    expect(q.options).toHaveLength(4);
    if (type === "en-tr-choice") {
      expect(q.options).not.toContain("süratli");
      expect(q.options).not.toContain("seri");
    } else {
      expect(q.options).not.toContain("quick");
      expect(q.options).not.toContain("rapid");
    }
    expect(q.options!.filter(option => gradeAnswer(q, option))).toHaveLength(1);
  });
  it("deduplicates options by normalized Turkish form, including punctuation", () => {
    const inputs = [word("home", "ev"), word("house", "EV!"), word("book", "kitap"), word("door", "kapı"), word("chair", "sandalye")];
    const result = generateQuiz(inputs, config({ type: "en-tr-choice" }));
    for (const q of result.questions) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options!.map(normalizeTurkish)).size).toBe(4);
      expect(q.options!.filter(option => gradeAnswer(q, option))).toHaveLength(1);
    }
  });
  it("also prevents known English synonyms from creating sentence ambiguity", () => {
    const inputs = [
      word("fast", "hızlı", { partOfSpeech: "adjective", exampleSentence: "It is fast.", synonyms: ["quick"] }),
      word("quick", "süratli", { partOfSpeech: "adjective" }),
      word("slow", "yavaş"), word("heavy", "ağır"), word("quiet", "sessiz"),
    ];
    const q = generateQuiz(inputs, config({ type: "sentence" })).questions[0];
    expect(q.options).toHaveLength(4);
    expect(q.options).not.toContain("quick");
    expect(q.prompt).toBe("It is ____.");
  });
  it("never downgrades a three-option choice question to written or repeats an option", () => {
    const inputs = vocabulary.slice(0, 3);
    for (const type of ["en-tr-choice", "tr-en-choice", "sentence"] as const) {
      const result = generateQuiz(inputs, config({ type, length: 5 }));
      expect(result.questions).toHaveLength(0);
      expect(result.availability[type]).toBe(0);
      expect(result.notices[0]).toContain("0 farklı kelimeden");
    }
    expect(generateQuiz(inputs, config({ type: "blank", length: 5 })).questions).toHaveLength(3);
  });
  it("does not use unknown meanings as unverifiable translation distractors", () => {
    const inputs = [word("apple", "elma", { exampleSentence: "We ate an apple." }), word("book"), word("chair"), word("door")];
    expect(generateQuiz(inputs, config({ type: "tr-en-choice" })).questions).toHaveLength(0);
    expect(generateQuiz(inputs, config({ type: "en-tr-choice" })).questions).toHaveLength(0);
    // The genuine English sentence still supports four distinct English options.
    expect(generateQuiz(inputs, config({ type: "sentence" })).questions[0].options).toHaveLength(4);
  });
  it("removes overlaps between distractors as well as with the correct answer", () => {
    const inputs = [word("apple", "elma"), word("home", "ev"), word("house", "konut; ev"), word("book", "kitap"), word("chair", "sandalye")];
    const q = generateQuiz(inputs, config({ type: "tr-en-choice" })).questions.find(item => item.word === "apple")!;
    expect(q.options).toHaveLength(4);
    expect(q.options!.includes("home") && q.options!.includes("house")).toBe(false);
  });
});

describe("availability and balanced, reproducible sessions", () => {
  it.each(QUESTION_TYPES)("generates the requested mode %s without hidden fallback", type => {
    const result = generateQuiz(vocabulary, config({ type, length: 4 }));
    expect(result.questions).toHaveLength(4);
    expect(result.questions.every(q => q.type === type)).toBe(true);
    expect(new Set(result.questions.map(q => q.wordId)).size).toBe(4);
  });
  it("skips every translation mode when no meaning exists", () => {
    const inputs = [word("cat", "", { exampleSentence: "A cat sleeps." })];
    const availability = getQuizAvailability(inputs, { level: "all", listeningAvailable: true });
    for (const type of ["en-tr-choice", "tr-en-choice", "en-tr-write", "tr-en-write"] as const) expect(availability[type]).toBe(0);
    expect(availability.blank).toBe(1);
    expect(availability.listening).toBe(1);
    expect(availability.mixed).toBe(1);
    expect(generateQuiz(inputs, config()).questions).toHaveLength(1);
  });
  it("allows optional accepted translations to supply a missing primary meaning", () => {
    const target = word("bright", "", { acceptedTranslations: ["parlak"] });
    const q = generateQuiz([target], config({ type: "en-tr-write", length: 1 })).questions[0];
    expect(q.answer).toBe("parlak");
  });
  it("does not confuse punctuation-only values with a usable meaning", () => {
    const target = word("word", ";, !!!", { acceptedTranslations: ["...", " "] });
    expect(acceptedTranslations(target)).toEqual([]);
    expect(getQuizAvailability([target], { level: "all", listeningAvailable: false }).mixed).toBe(0);
  });
  it("includes listening only when the caller confirms English speech availability", () => {
    const disabled = generateQuiz(vocabulary, config({ listeningAvailable: false }));
    expect(disabled.availability.listening).toBe(0);
    expect(disabled.questions.some(q => q.type === "listening")).toBe(false);
    expect(disabled.notices.join(" ")).toContain("Dinleme");
    const listening = generateQuiz(vocabulary, config({ type: "listening", length: 4 }));
    for (const q of listening.questions) {
      expect(q.prompt).toBe("Duyduğun İngilizce kelimeyi yaz.");
      expect(q.prompt.toLowerCase()).not.toContain(q.answer.toLowerCase());
      expect(q.promptContext).toBeUndefined();
    }
  });
  it("does not reveal the English answer or full English sentence in Turkish prompts", () => {
    const q = generateQuiz(vocabulary, config({ type: "tr-en-write", length: 1 })).questions[0];
    expect(q.prompt).not.toBe(q.answer);
    expect(q.promptContext).toBeUndefined();
    expect(q.context?.sentence).toContain(q.word);
  });
  it("balances available modes in mixed sessions when enough words support all modes", () => {
    const result = generateQuiz(vocabulary, config({ length: 7 }));
    expect(new Set(result.questions.map(q => q.type))).toEqual(new Set(QUESTION_TYPES));
    expect(new Set(result.questions.map(q => q.wordId)).size).toBe(7);
  });
  it("uses rare sentence opportunities before the common written modes", () => {
    const inputs = vocabulary.map((item, i) => i === 0 ? item : { ...item, exampleSentence: undefined });
    const result = generateQuiz(inputs, config({ length: 5, listeningAvailable: false }));
    expect(result.questions.some(q => q.wordId === "apple" && ["blank", "sentence"].includes(q.type))).toBe(true);
    expect(new Set(result.questions.map(q => q.wordId)).size).toBe(5);
  });
  it("filters both targets and choices to the selected level", () => {
    const inputs = [...vocabulary.slice(0, 3), word("advanced", "ileri", { cefrLevel: "B2" })];
    const result = generateQuiz(inputs, config({ type: "en-tr-choice", level: "A1" }));
    expect(result.questions).toHaveLength(0);
    expect(generateQuiz(inputs, config({ type: "en-tr-write", level: "B2" })).questions.map(q => q.word)).toEqual(["advanced"]);
  });
  it("never repeats a word ID or normalized English headword", () => {
    const inputs = [...vocabulary, { ...vocabulary[0], id: "duplicate", word: "APPLE" }, { ...vocabulary[1], word: "different" }];
    const result = generateQuiz(inputs, config({ length: 50 }));
    expect(result.questions).toHaveLength(vocabulary.length);
    expect(new Set(result.questions.map(q => q.wordId)).size).toBe(result.questions.length);
    expect(new Set(result.questions.map(q => normalizeEnglish(q.word))).size).toBe(result.questions.length);
  });
  it("is pure and deterministic; supplied session IDs isolate question IDs", () => {
    const before = structuredClone(vocabulary);
    const first = generateQuiz(vocabulary, config());
    expect(generateQuiz(vocabulary, config())).toEqual(first);
    expect(vocabulary).toEqual(before);
    const second = generateQuiz(vocabulary, config({ sessionId: "quiz-two" }));
    expect(new Set([...first.questions, ...second.questions].map(q => q.id)).size).toBe(20);
  });
  it("reports exact eligibility and shortens sessions without synthetic questions", () => {
    const result = generateQuiz(vocabulary.slice(0, 2), config({ type: "en-tr-write", length: 5 }));
    expect(result.questions).toHaveLength(2);
    expect(result.availability["en-tr-write"]).toBe(2);
    expect(result.availability).toEqual(getQuizAvailability(vocabulary.slice(0, 2), config()));
    expect(result.notices.join(" ")).toContain("5 soru istendi");
    expect(result.notices.join(" ")).toContain("2 farklı kelimeden");
    expect(generateQuiz([], config()).questions).toHaveLength(0);
  });
  it("bounds invalid or excessive requested lengths", () => {
    expect(generateQuiz(vocabulary, config({ length: -1 })).questions).toHaveLength(0);
    expect(generateQuiz(vocabulary, config({ length: Number.NaN })).questions).toHaveLength(0);
    expect(generateQuiz(vocabulary, config({ length: Infinity })).questions).toHaveLength(0);
    expect(generateQuiz(vocabulary, config({ length: 2.9 })).questions).toHaveLength(2);
    expect(generateQuiz(vocabulary, config({ length: 1000 })).requestedLength).toBe(50);
  });
  it("indexes alternate equivalents as well as primary meanings without crossing level filters", () => {
    const inputs = [word("big", "büyük"), word("large", "iri", { acceptedTranslations: ["BÜYÜK!"] }), word("huge", "büyük", { cefrLevel: "B2" })];
    const q = generateQuiz(inputs, config({ type: "tr-en-write", level: "A1", length: 2 })).questions.find(item => item.word === "big")!;
    expect(gradeAnswer(q, "large")).toBe(true);
    expect(gradeAnswer(q, "huge")).toBe(false);
  });
  it("prepares a 3000-word test-only library without quadratic normalization", () => {
    // Synthetic scalability fixture only; these labels are never application vocabulary.
    const inputs = Array.from({ length: 3000 }, (_, index) => word(`test-word-${index}`, `deneme karşılığı ${index}`));
    const start = performance.now();
    const availability = getQuizAvailability(inputs, { level: "all", listeningAvailable: false });
    const result = generateQuiz(inputs, config({ length: 50, listeningAvailable: false }));
    expect(availability.mixed).toBe(3000);
    expect(result.questions).toHaveLength(50);
    expect(new Set(result.questions.map(q => q.wordId)).size).toBe(50);
    expect(performance.now() - start).toBeLessThan(5000);
  }, 10000);
});
