import type { Metadata } from "next";
import { StatisticsOverview } from "@/components/statistics/overview";

export const metadata: Metadata = {
  title: "İstatistikler",
  description: "Günlük çalışma kayıtların, öğrenme serin ve kelime seviyelerine göre ilerlemen.",
};

export default function StatisticsPage() {
  return <StatisticsOverview />;
}
