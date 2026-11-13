import type { Metadata } from "next";
import { Explorer } from "@/components/vocabulary/explorer";

export const metadata: Metadata = {
  title: "Kelimeleri Keşfet | Lexi",
  description: "İngilizce ve Türkçe ara; kelimelerini seviye, tür ve öğrenme durumuna göre keşfet.",
};

export default function ExplorerPage() {
  return <Explorer />;
}
