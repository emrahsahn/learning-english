import { LEVELS, type Snapshot } from "@/types";
import { dailyCounts, isDue, localDate } from "./scheduler";
export function calculateStats(snapshot: Snapshot, now = new Date()) {
  const progress = new Map(snapshot.progress.map(p => [p.wordId, p]));
  const learned = snapshot.vocabulary.filter(w => progress.get(w.id)?.status === "learned");
  const learning = snapshot.vocabulary.filter(w => progress.get(w.id)?.status === "learning");
  const due = snapshot.vocabulary.filter(w => isDue(progress.get(w.id), now));
  const days = new Set(snapshot.reviews.map(e => e.localDate));
  let streak = 0;
  const cursor = new Date(now);
  if (!days.has(localDate(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(localDate(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
  const activity = Array.from({ length: 90 }, (_, i) => {
    const date = new Date(now); date.setDate(date.getDate() - (89 - i));
    const day = localDate(date); const events = snapshot.reviews.filter(e => e.localDate === day);
    return { date: day, label: date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" }), newWords: new Set(events.filter(e => e.wasNew).map(e => e.wordId)).size, reviews: events.filter(e => !e.wasNew).length, total: events.length, correct: events.filter(e => e.correct).length };
  });
  const quizAnswers = snapshot.quizzes.flatMap(q => q.answers);
  const quizCorrect = quizAnswers.filter(a => a.correct).length;
  const forgotten = snapshot.vocabulary.filter(w => (progress.get(w.id)?.incorrectCount ?? 0) > 0).sort((a, b) => progress.get(b.id)!.incorrectCount - progress.get(a.id)!.incorrectCount).slice(0, 8);
  const recent = [...learned].sort((a, b) => (progress.get(b.id)?.lastReviewDate ?? "").localeCompare(progress.get(a.id)?.lastReviewDate ?? "")).slice(0, 5);
  const dayIndex = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
  const dayWord = snapshot.vocabulary.length ? [...snapshot.vocabulary].sort((a,b) => a.id.localeCompare(b.id))[Math.abs(dayIndex) % snapshot.vocabulary.length] : null;
  return { total: snapshot.vocabulary.length, learned: learned.length, learning: learning.length, new: snapshot.vocabulary.length - learned.length - learning.length, due: due.length, completion: snapshot.vocabulary.length ? learned.length / snapshot.vocabulary.length * 100 : 0, streak, today: dailyCounts(snapshot, now), activity, weekly: activity.slice(-7), monthly: activity.slice(-30), quizTotal: quizAnswers.length, quizCorrect, quizSuccess: quizAnswers.length ? quizCorrect / quizAnswers.length * 100 : null, forgotten, recent, dayWord, levels: LEVELS.map(level => ({ level, total: snapshot.vocabulary.filter(w => w.cefrLevel === level).length, learned: learned.filter(w => w.cefrLevel === level).length, learning: learning.filter(w => w.cefrLevel === level).length })) };
}
