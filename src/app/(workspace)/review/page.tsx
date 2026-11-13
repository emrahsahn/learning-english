import type { Metadata } from "next";
import { LearningSession } from "@/components/learning/learning-session";

export const metadata: Metadata = {
  title: "Kelime Tekrarı | Lexi",
  description: "Tekrar zamanı gelen İngilizce kelimelerini gerçek öğrenme geçmişine göre çalış.",
};

export default function ReviewPage() {
  return <LearningSession mode="review" />;
}
