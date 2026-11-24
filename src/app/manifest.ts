import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lexi — Oxford 3000 Kelime Atölyesi",
    short_name: "Lexi",
    description:
      "Oxford 3000 kelimelerini aralıklı tekrar ve çoklu Türkçe anlamlarla kendi hızında öğren.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f7f3",
    theme_color: "#6152ce",
    lang: "tr",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
