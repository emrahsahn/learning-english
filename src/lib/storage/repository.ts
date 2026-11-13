"use client";
import Dexie, { type EntityTable } from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS, type Backup, type DatasetMetadata, type QuizAnswer, type QuizResult, type Rating, type ReviewEvent, type Settings, type Snapshot, type VocabularyWord, type WordProgress } from "@/types";
import { defaultProgress, localDate, scheduleReview } from "@/lib/learning/scheduler";
import { loadIntegratedVocabulary } from "@/lib/vocabulary/importer";
import { backupSchema, settingsSchema, wordSchema } from "./schema";

class LearningDatabase extends Dexie {
  vocabulary!: EntityTable<VocabularyWord, "id">;
  progress!: EntityTable<WordProgress, "wordId">;
  reviews!: EntityTable<ReviewEvent, "id">;
  quizzes!: EntityTable<QuizResult, "id">;
  settings!: EntityTable<Settings, "id">;
  metadata!: EntityTable<DatasetMetadata, "id">;
  constructor() {
    super("lexi-oxford-personal");
    this.version(1).stores({ vocabulary: "id,word,cefrLevel", progress: "wordId,status,nextReviewDate", reviews: "id,wordId,localDate,timestamp", quizzes: "id,finishedAt", settings: "id", metadata: "id" });
  }
}
export const database = new LearningDatabase();
// UI depends on this interface, not database tables. A remote adapter can implement it later.
export interface LearningRepository {
  snapshot(): Promise<Snapshot>;
  recordRating(wordId: string, rating: Rating, source: ReviewEvent["source"], eventId?: string, quizId?: string): Promise<void>;
  toggleFavorite(wordId: string): Promise<void>;
  saveSettings(settings: Settings): Promise<void>;
  importVocabulary(words: VocabularyWord[], metadata: DatasetMetadata): Promise<void>;
  exportBackup(): Promise<Backup>;
  restoreBackup(value: unknown): Promise<void>;
}
export const repository: LearningRepository = {
  async snapshot() {
    return database.transaction("r", database.tables, async () => {
      const [vocabulary, progress, reviews, quizzes, settings, dataset] = await Promise.all([database.vocabulary.toArray(), database.progress.toArray(), database.reviews.toArray(), database.quizzes.toArray(), database.settings.get("preferences"), database.metadata.get("dataset")]);
      return { vocabulary, progress, reviews, quizzes, settings: settings ?? DEFAULT_SETTINGS, dataset: dataset ?? null };
    });
  },
  async recordRating(wordId, rating, source, eventId = crypto.randomUUID(), quizId) {
    await database.transaction("rw", database.vocabulary, database.progress, database.reviews, async () => {
      if (await database.reviews.get(eventId)) return;
      if (!(await database.vocabulary.get(wordId))) throw new Error("Kelime bulunamadı.");
      const previous = await database.progress.get(wordId) ?? defaultProgress(wordId);
      const now = new Date();
      await database.progress.put(scheduleReview(previous, rating, now));
      await database.reviews.add({ id: eventId, wordId, timestamp: now.toISOString(), localDate: localDate(now), rating, source, wasNew: previous.reviewCount === 0, correct: rating !== "again", ...(quizId ? { quizId } : {}) });
    });
  },
  async toggleFavorite(wordId) {
    await database.transaction("rw", database.vocabulary, database.progress, async () => {
      if (!(await database.vocabulary.get(wordId))) throw new Error("Kelime bulunamadı.");
      const previous = await database.progress.get(wordId) ?? defaultProgress(wordId);
      await database.progress.put({ ...previous, favorite: !previous.favorite });
    });
  },
  async saveSettings(settings) { await database.settings.put(settingsSchema.parse(settings)); },
  async importVocabulary(words, metadata) {
    const validated = words.map(w => wordSchema.parse(w));
    if (new Set(validated.map(w => w.id)).size !== validated.length || new Set(validated.map(w => w.word.toLowerCase())).size !== validated.length) throw new Error("Yinelenen kelimeler var.");
    await database.transaction("rw", database.tables, async () => {
      const existing = await database.vocabulary.toArray();
      const ids = new Set(validated.map(w => w.id));
      const replacements = new Map(validated.map(w => [w.id, w]));
      const hasHistory = (await database.reviews.count()) > 0;
      if (existing.some(w => !ids.has(w.id)) && hasHistory) throw new Error("Bu liste çalışılmış kelimeleri kaldırıyor. Önce yedek al; yedek geri yükleme ile tam veri setini taşı.");
      if (hasHistory && existing.some(w => replacements.has(w.id) && replacements.get(w.id)!.word.toLowerCase() !== w.word.toLowerCase())) throw new Error("Çalışma geçmişi olan kelime kimlikleri başka kelimelere atanamaz. Mevcut ilerlemen değiştirilmedi.");
      await database.vocabulary.clear(); await database.vocabulary.bulkPut(validated);
      const progress = await database.progress.toArray();
      await database.progress.bulkDelete(progress.filter(p => !ids.has(p.wordId)).map(p => p.wordId));
      await database.metadata.put({ ...metadata, count: validated.length });
    });
  },
  async exportBackup() { return { ...await repository.snapshot(), format: "oxford-personal-backup", version: 1, exportedAt: new Date().toISOString() }; },
  async restoreBackup(value) {
    const data = backupSchema.parse(value);
    await database.transaction("rw", database.tables, async () => {
      for (const table of database.tables) await table.clear();
      await database.vocabulary.bulkPut(data.vocabulary); await database.progress.bulkPut(data.progress);
      await database.reviews.bulkPut(data.reviews); await database.quizzes.bulkPut(data.quizzes);
      await database.settings.put(data.settings); if (data.dataset) await database.metadata.put(data.dataset);
    });
  },
};
export async function recordQuizAnswer(quiz: Omit<QuizResult, "finishedAt" | "answers">, answer: QuizAnswer) {
  await database.transaction("rw", database.tables, async () => {
    const existing = await database.quizzes.get(quiz.id);
    if (existing?.answers.some(a => a.questionId === answer.questionId)) return;
    await repository.recordRating(answer.wordId, answer.correct ? "good" : "again", "quiz", answer.questionId, quiz.id);
    await database.quizzes.put({ ...quiz, finishedAt: answer.timestamp, answers: [...(existing?.answers ?? []), answer] });
  });
}
let seedingPromise: Promise<void> | null = null;

/**
 * Automatically seed the browser database on first launch with the integrated
 * Oxford 3000 word list extracted from `data/American_Oxford_3000.pdf` when no
 * vocabulary or dataset metadata exists yet.
 */
export async function ensureIntegratedVocabulary(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!seedingPromise) {
    seedingPromise = (async () => {
      const [vocabCount, existingDataset, sampleWord] = await Promise.all([
        database.vocabulary.count(),
        database.metadata.get("dataset"),
        database.vocabulary.toCollection().first(),
      ]);
      const needsSensesUpgrade =
        vocabCount > 0 &&
        existingDataset?.source === "data/American_Oxford_3000.pdf" &&
        (!sampleWord?.senses || sampleWord.senses.length === 0);

      if ((vocabCount > 0 || existingDataset) && !needsSensesUpgrade) return;

      const preview = await loadIntegratedVocabulary();
      await database.transaction("rw", database.vocabulary, database.metadata, async () => {
        const [txCount, txDataset, txSample] = await Promise.all([
          database.vocabulary.count(),
          database.metadata.get("dataset"),
          database.vocabulary.toCollection().first(),
        ]);
        const txNeedsUpgrade =
          txCount > 0 &&
          txDataset?.source === "data/American_Oxford_3000.pdf" &&
          (!txSample?.senses || txSample.senses.length === 0);
        if ((txCount > 0 || txDataset) && !txNeedsUpgrade) return;
        await database.vocabulary.clear();
        await database.vocabulary.bulkPut(preview.words);
        await database.metadata.put(preview.metadata);
      });
    })()
      .catch((err) => {
        console.warn("Yerleşik kelime listesi yüklenemedi:", err);
      })
      .finally(() => {
        seedingPromise = null;
      });
  }
  return seedingPromise;
}

const subscribeClock = (notify: () => void) => { const timer = window.setInterval(notify, 60000); return () => window.clearInterval(timer); };
const minuteSnapshot = () => Math.floor(Date.now() / 60000);
const serverMinuteSnapshot = () => 0;
export function useLearningData() {
  // Re-render time-based recommendations without re-querying or resetting active sessions.
  const minute = useSyncExternalStore(subscribeClock, minuteSnapshot, serverMinuteSnapshot);
  const result = useLiveQuery(async () => {
    try {
      await ensureIntegratedVocabulary();
      return { data: await repository.snapshot(), error: null };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e.message : "Tarayıcı veritabanı açılamadı." };
    }
  }, []);
  return { data: result?.data ?? null, loading: !result, error: result?.error ?? null, minute };
}
export function downloadJson(value: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
