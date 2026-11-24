import { z } from "zod";
const finite = z.number().finite();
const iso = z.string().datetime({ offset: true });
export const senseSchema = z.object({
  pos: z.string().max(100).optional(),
  meaning: z.string().min(1).max(500),
  exampleSentence: z.string().min(1).max(2000),
  exampleTranslation: z.string().max(2000).optional(),
});

export const wordSchema = z.object({
  id: z.string().min(1).max(180), word: z.string().min(1).max(100), cefrLevel: z.enum(["A1", "A2", "B1", "B2"]), partOfSpeech: z.string().max(200),
  turkishMeaning: z.string().max(2000), pronunciation: z.string().max(300), audioUrl: z.string().url().refine(url => url.startsWith("https://"), "Ses URL'si HTTPS olmalı").optional(),
  exampleSentence: z.string().max(2000).optional(), exampleTranslation: z.string().max(2000).optional(), senses: z.array(senseSchema).max(20).optional(), synonyms: z.array(z.string().max(100)).max(100).optional(), antonyms: z.array(z.string().max(100)).max(100).optional(), acceptedTranslations: z.array(z.string().max(500)).max(100).optional(), dictionarySource: z.string().max(500).optional(),
});
const progressSchema = z.object({ wordId: z.string(), status: z.enum(["new", "learning", "learned"]), lastReviewDate: iso.nullable(), nextReviewDate: iso.nullable(), reviewCount: finite.int().min(0), correctCount: finite.int().min(0), incorrectCount: finite.int().min(0), difficulty: finite.min(0).max(1), confidence: finite.min(0).max(100), easeFactor: finite.min(1.3).max(3), intervalDays: finite.int().min(0), repetitions: finite.int().min(0), favorite: z.boolean() });
export const settingsSchema = z.object({ id: z.literal("preferences"), newWordsPerDay: finite.int().min(1).max(100), reviewsPerDay: finite.int().min(1).max(200), quizLength: finite.int().min(1).max(50), preferredLevel: z.enum(["all", "A1", "A2", "B1", "B2"]), voiceAccent: z.enum(["en-GB", "en-US"]), speechRate: finite.min(0.5).max(1.5), autoSpeak: z.boolean().optional().default(false) });
const eventSchema = z.object({ id: z.string(), wordId: z.string(), timestamp: iso, localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), rating: z.enum(["again", "hard", "good"]), source: z.enum(["learn", "review", "quiz"]), wasNew: z.boolean(), correct: z.boolean(), quizId: z.string().optional() });
const answerSchema = z.object({ questionId: z.string(), wordId: z.string(), answer: z.string().max(2000), correct: z.boolean(), timestamp: iso });
export const quizSchema = z.object({ id: z.string(), type: z.enum(["en-tr-choice", "tr-en-choice", "blank", "sentence", "en-tr-write", "tr-en-write", "listening", "mixed"]), startedAt: iso, finishedAt: iso, answers: z.array(answerSchema).max(50) });
export const backupSchema = z.object({ format: z.literal("oxford-personal-backup"), version: z.literal(1), exportedAt: iso, vocabulary: z.array(wordSchema).max(10000), progress: z.array(progressSchema).max(10000), reviews: z.array(eventSchema).max(500000), quizzes: z.array(quizSchema).max(50000), settings: settingsSchema, dataset: z.object({ id: z.literal("dataset"), source: z.string(), importedAt: iso, count: finite.int().min(0), digest: z.string(), verified: z.boolean() }).nullable() }).superRefine((data, ctx) => {
  const unique = (ids: string[], label: string) => { if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: `${label}: yinelenen kayıtlar var.` }); };
  unique(data.vocabulary.map(w => w.id), "Kelimeler"); unique(data.vocabulary.map(w => w.word.toLowerCase()), "Kelime başlıkları"); unique(data.progress.map(p => p.wordId), "İlerleme"); unique(data.reviews.map(e => e.id), "Geçmiş"); unique(data.quizzes.map(q => q.id), "Quiz");
  const ids = new Set(data.vocabulary.map(w => w.id));
  if (data.progress.some(p => !ids.has(p.wordId)) || data.reviews.some(e => !ids.has(e.wordId)) || data.quizzes.some(q => q.answers.some(a => !ids.has(a.wordId)))) ctx.addIssue({ code: "custom", message: "Yedek, listede olmayan kelimelere referans veriyor." });
  if (data.dataset && data.dataset.count !== data.vocabulary.length) ctx.addIssue({ code: "custom", message: "Veri seti sayısı uyuşmuyor." });
  const activity = new Map<string, { total: number; correct: number; incorrect: number }>();
  for (const event of data.reviews) { const row = activity.get(event.wordId) ?? { total: 0, correct: 0, incorrect: 0 }; row.total++; if (event.correct) row.correct++; else row.incorrect++; activity.set(event.wordId, row); }
  const progresses = new Map(data.progress.map(p => [p.wordId, p]));
  if ([...activity.keys()].some(id => !progresses.has(id)) || data.progress.some(p => {
    const row = activity.get(p.wordId) ?? { total: 0, correct: 0, incorrect: 0 };
    return p.reviewCount !== row.total || p.correctCount !== row.correct || p.incorrectCount !== row.incorrect || p.repetitions > p.reviewCount
      || (p.reviewCount === 0 && (p.status !== "new" || p.lastReviewDate !== null || p.nextReviewDate !== null))
      || (p.reviewCount > 0 && (p.status === "new" || !p.lastReviewDate || !p.nextReviewDate))
      || (p.status === "learned" && (p.repetitions < 3 || p.confidence < 65));
  })) ctx.addIssue({ code: "custom", message: "İlerleme sayaçları veya öğrenme durumu gerçek tekrar geçmişiyle uyuşmuyor." });
});
