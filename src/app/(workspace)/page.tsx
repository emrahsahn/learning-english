import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard";

export const metadata: Metadata = {
  title: "Genel bakış",
  description: "Kendi kelime kütüphanen, günlük hedeflerin ve gerçek öğrenme ilerlemen.",
};

export default function HomePage() {
  return <Dashboard />;
}
