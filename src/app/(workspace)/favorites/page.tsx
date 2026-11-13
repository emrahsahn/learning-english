import type { Metadata } from "next";
import { Explorer } from "@/components/vocabulary/explorer";

export const metadata: Metadata = {
  title: "Favori Kelimelerim | Lexi",
  description: "Kaydettiğin İngilizce kelimeleri kişisel favori koleksiyonunda yeniden keşfet.",
};

export default function FavoritesPage() {
  return <Explorer favoritesOnly />;
}
