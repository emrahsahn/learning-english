"use client";

import Link from "next/link";
import { ArrowUpRight, BookOpenCheck, RotateCcw } from "lucide-react";
import { PronunciationButton } from "@/components/vocabulary/pronunciation-button";
import type { Snapshot, VocabularyWord } from "@/types";
import { count } from "./summary";

export function WordHistory({ words, snapshot, kind }: { words: VocabularyWord[]; snapshot: Snapshot; kind: "recent" | "difficult" }) {
  const difficult = kind === "difficult";
  const progress = new Map(snapshot.progress.map(item => [item.wordId, item]));
  const Icon = difficult ? RotateCcw : BookOpenCheck;

  return (
    <section className="surface flex min-w-0 flex-col p-5 sm:p-6" aria-label={difficult ? "Zorlandığın kelimeler" : "Yakın zamanda çalışılan öğrenilmiş kelimeler"}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-medium tracking-tight">{difficult ? "Zorlandığın kelimeler" : "Öğrendiğin kelimeler"}</h2>
        <Icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{difficult ? "Geçmiş hata sayısına göre; şu anki durumun değişmiş olabilir." : "Öğrenildi durumundaki kelimeler, son tekrar tarihine göre."}</p>
      {words.length > 0 ? (
        <ul className="mt-4 divide-y">
          {words.map(word => {
            const record = progress.get(word.id);
            return (
              <li key={word.id} className="flex items-center justify-between gap-3 py-3.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span lang="en" className="break-words text-sm font-medium">{word.word}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">{word.cefrLevel}</span>
                  </div>
                  <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">{word.turkishMeaning}</p>
                  {difficult ? (
                    <p className="mt-1.5 text-[10px] text-muted-foreground">{count(record?.incorrectCount ?? 0)} hatalı yanıt</p>
                  ) : record?.lastReviewDate && (
                    <time dateTime={record.lastReviewDate} className="mt-1.5 block text-[10px] text-muted-foreground">Son tekrar: {new Date(record.lastReviewDate).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}</time>
                  )}
                </div>
                <PronunciationButton word={word.word} audioUrl={word.audioUrl} settings={snapshot.settings} className="size-8 shrink-0 rounded-full border-transparent bg-muted/60" />
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-3 py-10 text-center">
          <span className="mb-4 flex size-11 items-center justify-center rounded-full bg-muted"><Icon className="size-5 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" /></span>
          <p className="text-sm font-medium">{difficult ? "Henüz hata kaydı yok" : "İlk kelimen için yer hazır"}</p>
          <p className="mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground">{difficult ? "Hatalı yanıt verdiğin kelimeler burada listelenecek. Henüz çalışmadıysan bu, hepsini bildiğin anlamına gelmez." : "Öğrenildi aşamasına ulaşan kelimelerin burada görünecek. Küçük tekrarlar, kalıcı adımlar."}</p>
        </div>
      )}
      <Link href={difficult ? "/review" : "/explorer"} className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-sm pt-4 text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">
        {difficult ? "Tekrar alanına git" : "Kütüphaneyi keşfet"}<ArrowUpRight className="size-3.5" aria-hidden="true" />
      </Link>
    </section>
  );
}
