"use client";

import { EmptyDataset, LoadingState, StorageError } from "@/components/data-boundary";
import { QuizSession } from "@/components/learning/quiz-session";
import { useLearningData } from "@/lib/storage/repository";

export default function PracticePage() {
  const { data, loading, error } = useLearningData();
  if (loading) return <LoadingState />;
  if (error) return <StorageError message={error} />;
  if (!data) return <StorageError message="Öğrenme verileri okunamadı; kayıt yapmadan pratik başlatılmayacak." />;
  if (!data.vocabulary.length) return <EmptyDataset />;
  return <QuizSession data={data} />;
}
