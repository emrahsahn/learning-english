import type { Metadata } from "next";
import { LearningSession } from "@/components/learning/learning-session";

export const metadata: Metadata = {
  title: "Yeni Kelimeler Öğren | Lexi",
  description: "Kendi kelime kütüphanenden günlük hedefine uygun İngilizce kelimeler öğren.",
};

export default function LearnPage() {
  return <LearningSession mode="learn" />;
}
