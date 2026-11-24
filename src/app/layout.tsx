import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f7f3" },
    { media: "(prefers-color-scheme: dark)", color: "#131725" },
  ],
};

export const metadata: Metadata = {
  applicationName: "Lexi",
  title: {
    default: "Lexi — Oxford 3000",
    template: "%s | Lexi — Oxford 3000",
  },
  description:
    "Oxford 3000 kelimelerini kendi hızında öğren, tekrar et ve İngilizce kelime dağarcığını adım adım geliştir. Kişisel kelime atölyen Lexi.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Lexi",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="tr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
