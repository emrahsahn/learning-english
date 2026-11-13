import type { Rating, Settings, Snapshot, VocabularyWord, WordProgress } from "@/types";
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function defaultProgress(wordId: string): WordProgress {
  return { wordId, status: "new", lastReviewDate: null, nextReviewDate: null, reviewCount: 0, correctCount: 0, incorrectCount: 0, difficulty: 0.5, confidence: 0, easeFactor: 2.5, intervalDays: 0, repetitions: 0, favorite: false };
}
export function scheduleReview(previous: WordProgress, rating: Rating, now = new Date()): WordProgress {
  const quality = rating === "good" ? 5 : rating === "hard" ? 3 : 1;
  const ease = Math.max(1.3, Math.min(3, previous.easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  const repetitions = rating === "again" ? 0 : previous.repetitions + 1;
  const intervalDays = Math.min(365, rating === "again" ? 0 : rating === "hard" ? Math.max(1, Math.round(previous.intervalDays * 1.2)) : repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.max(1, Math.round(previous.intervalDays * ease)));
  const next = new Date(now);
  if (rating === "again") next.setMinutes(next.getMinutes() + 10);
  else next.setDate(next.getDate() + intervalDays);
  const confidence = Math.max(0, Math.min(100, previous.confidence + (rating === "good" ? 22 : rating === "hard" ? 5 : -28)));
  return {
    ...previous, status: repetitions >= 3 && confidence >= 65 ? "learned" : "learning",
    lastReviewDate: now.toISOString(), nextReviewDate: next.toISOString(),
    reviewCount: previous.reviewCount + 1, correctCount: previous.correctCount + (rating !== "again" ? 1 : 0), incorrectCount: previous.incorrectCount + (rating === "again" ? 1 : 0),
    difficulty: Math.max(0, Math.min(1, previous.difficulty + (rating === "good" ? -0.08 : rating === "hard" ? 0.03 : 0.15))),
    confidence, easeFactor: ease, intervalDays, repetitions,
  };
}
export function isDue(progress: WordProgress | undefined, now = new Date()): boolean {
  return !!progress?.nextReviewDate && new Date(progress.nextReviewDate).getTime() <= now.getTime();
}
export function dailyCounts(snapshot: Snapshot, now = new Date()) {
  const today = snapshot.reviews.filter(e => e.localDate === localDate(now));
  return { newWords: new Set(today.filter(e => e.wasNew).map(e => e.wordId)).size, reviews: new Set(today.filter(e => !e.wasNew).map(e => e.wordId)).size, total: today.length };
}
export function buildSession(snapshot: Snapshot, mode: "learn" | "review", now = new Date()): VocabularyWord[] {
  const progress = new Map(snapshot.progress.map(p => [p.wordId, p]));
  const counts = dailyCounts(snapshot, now);
  const settings: Settings = snapshot.settings;
  if (mode === "review") {
    const limit = Math.max(0, settings.reviewsPerDay - counts.reviews);
    return snapshot.vocabulary.filter(w => isDue(progress.get(w.id), now)).sort((a, b) => {
      const pa = progress.get(a.id)!, pb = progress.get(b.id)!;
      return new Date(pa.nextReviewDate!).getTime() - new Date(pb.nextReviewDate!).getTime() || pb.difficulty - pa.difficulty;
    }).slice(0, limit);
  }
  const limit = Math.max(0, settings.newWordsPerDay - counts.newWords);
  const levels = ["A1", "A2", "B1", "B2"];
  return snapshot.vocabulary.filter(w => (!progress.get(w.id) || progress.get(w.id)?.status === "new") && (settings.preferredLevel === "all" || w.cefrLevel === settings.preferredLevel)).sort((a, b) => levels.indexOf(a.cefrLevel) - levels.indexOf(b.cefrLevel) || a.word.localeCompare(b.word, "en")).slice(0, limit);
}
