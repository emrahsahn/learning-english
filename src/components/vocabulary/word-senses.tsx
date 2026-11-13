"use client";

import { Badge } from "@/components/ui/badge";
import type { WordSense } from "@/types";

const POS_TR_LABELS: Record<string, string> = {
  noun: "isim",
  verb: "fiil",
  adjective: "sıfat",
  adverb: "zarf",
  preposition: "edat",
  conjunction: "bağlaç",
  pronoun: "zamir",
  determiner: "belirteç",
  article: "tanımlık",
  "indefinite article": "belirsiz tanımlık",
  "definite article": "belirli tanımlık",
  exclamation: "ünlem",
  interjection: "ünlem",
  number: "sayı",
  numeral: "sayı",
};

/** Maps an English POS tag to a concise Turkish label for sense badges. */
export function formatSensePos(pos?: string): string | null {
  const key = pos?.trim().toLowerCase();
  if (!key) return null;
  return POS_TR_LABELS[key] ?? key;
}

interface WordSensesListProps {
  senses: WordSense[];
  maxItems?: number;
  compact?: boolean;
}

/** Renders numbered dictionary senses paired with their English and Turkish example sentences. */
export function WordSensesList({ senses, maxItems, compact = false }: WordSensesListProps) {
  const visible = typeof maxItems === "number" ? senses.slice(0, maxItems) : senses;
  const remaining = senses.length - visible.length;

  return (
    <div className={compact ? "space-y-2.5" : "space-y-3"}>
      {visible.map((sense, index) => {
        const posLabel = formatSensePos(sense.pos);
        return (
          <div
            key={`${sense.pos ?? "sense"}-${index}-${sense.meaning}`}
            className={compact ? "rounded-xl border border-border/70 bg-background/60 p-3" : "rounded-xl border border-border/80 bg-muted/20 p-3.5 sm:p-4"}
          >
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {index + 1}
              </span>
              {posLabel && (
                <Badge variant="outline" className="text-[11px] font-medium">
                  {posLabel}
                </Badge>
              )}
              <span className={compact ? "text-sm font-medium text-foreground" : "text-base font-medium text-foreground"}>
                {sense.meaning}
              </span>
            </div>
            <blockquote className="mt-2.5 space-y-1 border-l-2 border-primary/30 pl-3">
              <p lang="en" className={compact ? "text-xs leading-relaxed text-foreground sm:text-sm" : "text-sm leading-relaxed text-foreground sm:text-base"}>
                {sense.exampleSentence}
              </p>
              {sense.exampleTranslation?.trim() && (
                <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  {sense.exampleTranslation}
                </p>
              )}
            </blockquote>
          </div>
        );
      })}
      {remaining > 0 && (
        <p className="text-xs text-muted-foreground">+{remaining} anlam ve örnek daha</p>
      )}
    </div>
  );
}

