import type { Metadata } from "next";
import { SettingsPage } from "@/components/settings/settings-page";

export const metadata: Metadata = {
  title: "Ayarlar",
  description: "Öğrenme tercihlerin, güvenli kelime içe aktarma, kişisel yedekler ve kaynak lisansları.",
};

export default function Page() {
  return <SettingsPage />;
}
