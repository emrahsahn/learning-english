"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ArrowDownAZ, ArrowRight, Bookmark, BookOpen, ChevronLeft, ChevronRight, Clock3, Search, SlidersHorizontal, X } from "lucide-react";
import { EmptyDataset, LoadingState, StorageError } from "@/components/data-boundary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_LABELS, WordDetail, partOfSpeechLabel } from "@/components/vocabulary/word-detail";
import { isDue } from "@/lib/learning/scheduler";
import { useLearningData } from "@/lib/storage/repository";
import { LEVELS } from "@/types";

const PAGE_SIZE = 50;
const POS_FILTERS = [
  { value: "noun", label: "İsim" },
  { value: "verb", label: "Fiil" },
  { value: "adjective", label: "Sıfat" },
  { value: "adverb", label: "Zarf" },
];
const STATUS_FILTERS = [
  { value: "new", label: "Yeni" },
  { value: "learning", label: "Öğreniliyor" },
  { value: "learned", label: "Öğrenildi" },
  { value: "unlearned", label: "Henüz öğrenilmedi" },
  { value: "due", label: "Tekrar zamanı" },
  { value: "favorite", label: "Favoriler" },
];

export function Explorer({ favoritesOnly = false }: { favoritesOnly?: boolean }) {
  const { data, loading, error, minute } = useLearningData();
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const [partOfSpeech, setPartOfSpeech] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("asc");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const progressMap = useMemo(() => new Map(data?.progress.map(item => [item.wordId, item]) ?? []), [data?.progress]);
  const baseWords = useMemo(() => data?.vocabulary.filter(word => !favoritesOnly || progressMap.get(word.id)?.favorite) ?? [], [data?.vocabulary, favoritesOnly, progressMap]);
  const filteredWords = useMemo(() => {
    const englishQuery = query.trim().toLocaleLowerCase("en");
    const turkishQuery = query.trim().toLocaleLowerCase("tr");
    const now = new Date(minute * 60000);
    const posLabel = POS_FILTERS.find(item => item.value === partOfSpeech)?.label;
    return baseWords.filter(word => {
      const progress = progressMap.get(word.id);
      if (query.trim() && !word.word.toLocaleLowerCase("en").includes(englishQuery) && !word.turkishMeaning.toLocaleLowerCase("tr").includes(turkishQuery)) return false;
      if (level !== "all" && word.cefrLevel !== level) return false;
      if (posLabel && !partOfSpeechLabel(word.partOfSpeech).split(" · ").includes(posLabel)) return false;
      if (status === "due") return isDue(progress, now);
      if (status === "favorite") return !!progress?.favorite;
      if (status === "unlearned") return progress?.status !== "learned";
      return status === "all" || (progress?.status ?? "new") === status;
    }).sort((a, b) => (sort === "asc" ? 1 : -1) * (a.word.localeCompare(b.word, "en", { sensitivity: "base" }) || a.id.localeCompare(b.id)));
  }, [baseWords, query, level, partOfSpeech, status, sort, progressMap, minute]);

  if (loading) return <LoadingState />;
  if (error) return <StorageError message={error} />;
  if (!data) return <StorageError message="Öğrenme verileri okunamadı." />;
  if (data.vocabulary.length === 0) return <EmptyDataset />;

  const pageCount = Math.max(1, Math.ceil(filteredWords.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const offset = (currentPage - 1) * PAGE_SIZE;
  const visibleWords = filteredWords.slice(offset, offset + PAGE_SIZE);
  const selectedWord = data.vocabulary.find(word => word.id === selectedId);
  const dueCount = baseWords.filter(word => isDue(progressMap.get(word.id))).length;
  const learnedCount = baseWords.filter(word => progressMap.get(word.id)?.status === "learned").length;
  const hasFilters = !!query || level !== "all" || partOfSpeech !== "all" || status !== "all";

  function resetFilters() {
    setQuery(""); setLevel("all"); setPartOfSpeech("all"); setStatus("all"); setSort("asc"); setPage(1);
  }

  return (
    <div className="space-y-7">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-primary uppercase">
            {favoritesOnly ? <Bookmark className="size-4" aria-hidden="true" /> : <BookOpen className="size-4" aria-hidden="true" />}
            {favoritesOnly ? "Kişisel koleksiyonun" : "Kelime kütüphanen"}
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{favoritesOnly ? "Favori kelimelerim" : "Kelimeleri keşfet"}</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">{favoritesOnly ? "Yeniden dönmek istediğin kelimeler, tek bir yerde." : "Bir kelime, yeni bir kapı. Ara, keşfet ve kendi kelime dünyanı genişlet."}</p>
        </div>
        <Button asChild variant="outline" className="h-11 rounded-xl px-4"><Link href={favoritesOnly ? "/explorer" : "/learn"}>{favoritesOnly ? "Tüm kelimeler" : "Öğrenmeye başla"}<ArrowRight /></Link></Button>
      </header>

      <dl className="grid grid-cols-3 gap-3 sm:gap-4">
        {[
          { title: favoritesOnly ? "Favori kelime" : "Toplam kelime", value: baseWords.length, icon: favoritesOnly ? Bookmark : BookOpen },
          { title: "Öğrenildi", value: learnedCount, icon: ArrowDownAZ },
          { title: "Tekrar zamanı", value: dueCount, icon: Clock3 },
        ].map(item => <div key={item.title} className="rounded-2xl border bg-card p-4 sm:p-5"><dt className="flex items-center gap-2 text-xs text-muted-foreground"><item.icon className="hidden size-4 text-primary sm:block" aria-hidden="true" />{item.title}</dt><dd className="mt-2 text-2xl font-semibold tabular-nums sm:text-3xl">{item.value.toLocaleString("tr-TR")}</dd></div>)}
      </dl>

      {favoritesOnly && baseWords.length === 0 ? (
        <section className="rounded-3xl border border-dashed bg-card px-6 py-16 text-center">
          <Bookmark className="mx-auto mb-5 size-10 text-primary/50" aria-hidden="true" />
          <h2 className="text-xl font-semibold">Henüz favori kelimen yok</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">Kelime ayrıntısını açıp “Favorilere ekle” düğmesine dokun. Kaydettiğin kelimeler burada seni bekler.</p>
          <Button asChild className="mt-6 h-11 rounded-xl px-5"><Link href="/explorer">Kelimeleri keşfet<ArrowRight /></Link></Button>
        </section>
      ) : (
        <>
          <section aria-label="Kelime arama ve filtreler" className="space-y-5 rounded-3xl border bg-card p-5 sm:p-6">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input aria-label="İngilizce kelime veya Türkçe anlam ara" placeholder="İngilizce kelime veya Türkçe anlam ara…" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} className="h-12 rounded-xl bg-background pr-12 pl-12 text-base" />
              {query && <Button variant="ghost" size="icon" className="absolute top-1/2 right-2 -translate-y-1/2" aria-label="Aramayı temizle" onClick={() => { setQuery(""); setPage(1); }}><X /></Button>}
            </div>
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="CEFR seviyesi">
              <span className="mr-2 text-xs font-medium text-muted-foreground">Seviye</span>
              {["all", ...LEVELS].map(value => <Button key={value} variant={level === value ? "default" : "outline"} className="h-9 min-w-12 rounded-lg px-3" aria-pressed={level === value} onClick={() => { setLevel(value); setPage(1); }}>{value === "all" ? "Tümü" : value}</Button>)}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2"><span id="pos-filter-label" className="text-xs font-medium text-muted-foreground">Kelime türü</span><Select value={partOfSpeech} onValueChange={value => { setPartOfSpeech(value); setPage(1); }}><SelectTrigger aria-labelledby="pos-filter-label" className="h-11 w-full rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tüm kelime türleri</SelectItem>{POS_FILTERS.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><span id="status-filter-label" className="text-xs font-medium text-muted-foreground">Öğrenme durumu</span><Select value={status} onValueChange={value => { setStatus(value); setPage(1); }}><SelectTrigger aria-labelledby="status-filter-label" className="h-11 w-full rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tüm durumlar</SelectItem>{STATUS_FILTERS.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><span id="sort-label" className="text-xs font-medium text-muted-foreground">Sıralama</span><Select value={sort} onValueChange={value => { setSort(value); setPage(1); }}><SelectTrigger aria-labelledby="sort-label" className="h-11 w-full rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="asc">A → Z</SelectItem><SelectItem value="desc">Z → A</SelectItem></SelectContent></Select></div>
            </div>
          </section>

          <div className="flex items-center justify-between gap-3">
            <p role="status" aria-live="polite" className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">{filteredWords.length.toLocaleString("tr-TR")}</span> kelime bulundu{filteredWords.length > 0 && <span className="hidden sm:inline"> · {offset + 1}–{Math.min(offset + PAGE_SIZE, filteredWords.length)} gösteriliyor</span>}</p>
            {hasFilters && <Button variant="ghost" className="text-xs text-muted-foreground" onClick={resetFilters}><SlidersHorizontal />Filtreleri sıfırla</Button>}
          </div>

          {visibleWords.length === 0 ? (
            <section className="rounded-3xl border border-dashed bg-card px-6 py-14 text-center">
              <Search className="mx-auto mb-4 size-9 text-muted-foreground" aria-hidden="true" />
              <h2 className="text-xl font-semibold">Bu aramada kelime bulunamadı</h2>
              <p className="mt-3 text-sm text-muted-foreground">Başka bir kelime dene veya filtreleri genişlet. Çevirisi olmayan kelimeler yalnızca İngilizce aranabilir.</p>
              <Button variant="outline" className="mt-5 h-10 rounded-xl" onClick={resetFilters}>Filtreleri temizle</Button>
            </section>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visibleWords.map(word => {
                const progress = progressMap.get(word.id);
                const due = isDue(progress);
                return <button key={word.id} type="button" className="group flex min-w-0 flex-col rounded-2xl border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transform-none" aria-label={`${word.word} kelime ayrıntısını aç`} onClick={event => { openerRef.current = event.currentTarget; setSelectedId(word.id); }}>
                  <div className="mb-4 flex items-center justify-between gap-2"><Badge variant="secondary" className="bg-primary/10 text-primary">{word.cefrLevel}</Badge><div className="flex items-center gap-2">{due && <Clock3 className="size-4 text-primary" aria-label="Tekrar zamanı" />}{progress?.favorite && <Bookmark className="size-4 fill-primary/15 text-primary" aria-label="Favori" />}</div></div>
                  <h2 lang="en" className="break-words text-xl font-semibold tracking-tight transition-colors group-hover:text-primary">{word.word}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{partOfSpeechLabel(word.partOfSpeech)}</p>
                  <p className={`mt-3 line-clamp-2 text-sm leading-relaxed ${word.turkishMeaning.trim() ? "text-foreground/80" : "text-muted-foreground italic"}`}>{word.turkishMeaning.trim() || "Türkçe anlam eklenmemiş"}</p>
                  <div className="mt-auto flex items-center justify-between gap-2 pt-5"><span className="text-xs text-muted-foreground">{STATUS_LABELS[progress?.status ?? "new"]}</span><ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary motion-reduce:transform-none" aria-hidden="true" /></div>
                </button>;
              })}
            </div>
          )}

          {filteredWords.length > 0 && <nav aria-label="Kelime sayfaları" className="flex flex-wrap items-center justify-between gap-3 border-t pt-5"><p className="text-xs text-muted-foreground">Sayfa {currentPage} / {pageCount} · Sayfada en fazla {PAGE_SIZE} kelime</p><div className="flex items-center gap-2"><Button variant="outline" className="h-10 rounded-xl" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft />Önceki</Button><Button variant="outline" className="h-10 rounded-xl" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Sonraki<ChevronRight /></Button></div></nav>}
        </>
      )}

      <Dialog open={!!selectedWord} onOpenChange={open => { if (!open) setSelectedId(null); }}>
        <DialogContent showCloseButton={false} className="max-h-[85svh] overflow-y-auto rounded-3xl p-6 sm:max-w-xl sm:p-8" onCloseAutoFocus={event => { event.preventDefault(); openerRef.current?.focus(); }}>
          <DialogTitle className="sr-only">{selectedWord?.word} kelime ayrıntısı</DialogTitle>
          <DialogDescription className="sr-only">Anlam, telaffuz, öğrenme geçmişi ve favori ayarları.</DialogDescription>
          <div className="flex justify-end"><DialogClose asChild><Button variant="ghost" size="icon" aria-label="Kelime ayrıntısını kapat"><X /></Button></DialogClose></div>
          {selectedWord && <WordDetail key={selectedWord.id} word={selectedWord} progress={progressMap.get(selectedWord.id)} settings={data.settings} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
