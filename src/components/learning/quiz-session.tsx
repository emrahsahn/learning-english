"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import {
  ArrowRight, BookOpen, Check, CheckCircle2, Headphones, Languages,
  ListChecks, Loader2, PenLine, RotateCcw, ShieldCheck, Shuffle,
  Target, Volume2, X, XCircle, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { recordQuizAnswer } from "@/lib/storage/repository";
import {
  filterPoolWordIds, generateQuiz, getQuizAvailability, gradeAnswer,
  QUESTION_TYPES, QUIZ_LABELS, QUIZ_POOL_LABELS, QUIZ_POOLS,
  type QuizGeneration, type QuizPool, type QuizQuestion,
} from "@/lib/quiz";
import { LEVELS, type QuizAnswer, type QuizResult, type QuizType, type Settings, type Snapshot } from "@/types";

const MODES: { type: QuizType; icon: LucideIcon; description: string }[] = [
  { type: "mixed", icon: Shuffle, description: "Uygun türler arasında dengeli, tekrarsız pratik." },
  { type: "en-tr-choice", icon: Languages, description: "İngilizce kelimenin Türkçe karşılığını seç." },
  { type: "tr-en-choice", icon: Languages, description: "Türkçe anlamdan İngilizce kelimeyi bul." },
  { type: "blank", icon: PenLine, description: "Gerçek örnek cümlede eksik İngilizce kelimeyi yaz." },
  { type: "sentence", icon: ListChecks, description: "Gerçek örnek cümleyi dört seçenekten tamamla." },
  { type: "en-tr-write", icon: PenLine, description: "Türkçe karşılığı seçenek olmadan hatırla." },
  { type: "tr-en-write", icon: PenLine, description: "Türkçe anlamın İngilizce karşılığını yaz." },
  { type: "listening", icon: Headphones, description: "İngilizce sesi dinle, duyduğun kelimeyi yaz." },
];
type SpeechStatus = "unsupported" | "no-english-voice" | "ready";
function speechStatus(): SpeechStatus {
  if (typeof window === "undefined" || !("speechSynthesis" in window)
    || typeof window.SpeechSynthesisUtterance !== "function") return "unsupported";
  return window.speechSynthesis.getVoices().some(voice => /^en(?:[-_]|$)/i.test(voice.lang))
    ? "ready" : "no-english-voice";
}
function subscribeToSpeech(notify: () => void): () => void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return () => {};
  window.speechSynthesis.addEventListener("voiceschanged", notify);
  window.speechSynthesis.getVoices();
  return () => window.speechSynthesis.removeEventListener("voiceschanged", notify);
}
function serverSpeechStatus(): SpeechStatus { return "unsupported"; }

/** The word must never be placed in this button's DOM, title or accessible label. */
function ListenButton({ word, settings, available }: { word: string; settings: Settings; available: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = useRef<SpeechSynthesisUtterance | null>(null);
  useEffect(() => () => {
    current.current = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);
  function speak() {
    if (speechStatus() !== "ready") {
      setError("İngilizce konuşma sesi kullanılamıyor. Cihazının ses ayarlarını kontrol et.");
      return;
    }
    const speech = window.speechSynthesis;
    const englishVoices = speech.getVoices().filter(voice => /^en(?:[-_]|$)/i.test(voice.lang));
    const voice = englishVoices.find(item => item.lang.toLowerCase() === settings.voiceAccent.toLowerCase()) ?? englishVoices[0];
    if (!voice) { setError("İngilizce konuşma sesi bulunamadı."); return; }
    current.current = null;
    speech.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = settings.speechRate;
    current.current = utterance;
    setError(null);
    setPlaying(true);
    utterance.onend = () => { if (current.current === utterance) setPlaying(false); };
    utterance.onerror = () => {
      if (current.current !== utterance) return;
      setPlaying(false);
      setError("Ses oynatılamadı. Soruyu yeniden dinlemeyi dene; yanıt kaydedilmedi.");
    };
    try { speech.speak(utterance); }
    catch {
      setPlaying(false);
      setError("Ses oynatılamadı. Soruyu yeniden dinlemeyi dene.");
    }
  }
  return <div className="space-y-3">
    <Button type="button" variant="secondary" className="h-16 gap-3 rounded-2xl px-7 text-base" onClick={speak} disabled={!available} aria-label="Soruyu dinle">
      {playing ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Volume2 className="size-5" aria-hidden="true" />}
      Soruyu dinle
    </Button>
    <p className="text-xs text-muted-foreground">İhtiyaç duydukça tekrar dinleyebilirsin.</p>
    {!available && <p role="alert" className="text-sm text-destructive">İngilizce ses artık kullanılamıyor. Ses paketini kontrol et veya oturumu sonlandır.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}

interface Session {
  meta: Omit<QuizResult, "finishedAt" | "answers">;
  generation: QuizGeneration;
  index: number;
  answers: QuizAnswer[];
  feedback: QuizAnswer | null;
  finished: boolean;
  aborted: boolean;
}
function Context({ question }: { question: QuizQuestion }) {
  if (!question.context) return null;
  return <div className="mt-5 border-t pt-5">
    <p className="eyebrow mb-2">Kelimeni bağlamda gör</p>
    <p lang="en" className="leading-relaxed">{question.context.sentence}</p>
    {question.context.translation && <p lang="tr" className="mt-2 text-sm leading-relaxed text-muted-foreground">{question.context.translation}</p>}
  </div>;
}
function SettingSelect({ id, label, value, onChange, children }: {
  id: string; label: string; value: string; onChange: (value: string) => void; children: React.ReactNode;
}) {
  return <div className="space-y-2">
    <label htmlFor={id} className="text-sm font-medium">{label}</label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="h-12 w-full rounded-xl bg-background"><SelectValue /></SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  </div>;
}

export function QuizSession({ data }: { data: Snapshot }) {
  const [type, setType] = useState<QuizType>("mixed");
  const [length, setLength] = useState(Math.min(50, Math.max(1, data.settings.quizLength)));
  const [level, setLevel] = useState<Settings["preferredLevel"]>(data.settings.preferredLevel);
  const [pool, setPool] = useState<QuizPool>("all");
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  // This lock is set before any await or render, and held until feedback is advanced.
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const answerInput = useRef<HTMLInputElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const status = useSyncExternalStore(subscribeToSpeech, speechStatus, serverSpeechStatus);
  const listeningAvailable = status === "ready";
  const levelWords = useMemo(
    () => level === "all" ? data.vocabulary : data.vocabulary.filter(word => word.cefrLevel === level),
    [data.vocabulary, level],
  );
  const poolCounts = useMemo(() => {
    const now = new Date();
    return Object.fromEntries(
      QUIZ_POOLS.map(item => [item, filterPoolWordIds(levelWords, data.progress, item, now).size]),
    ) as Record<QuizPool, number>;
  }, [levelWords, data.progress]);
  const availability = useMemo(
    () => getQuizAvailability(data.vocabulary, { level, pool, progress: data.progress, listeningAvailable }),
    [data.vocabulary, data.progress, level, pool, listeningAvailable],
  );
  const question = session && !session.finished ? session.generation.questions[session.index] : null;
  useEffect(() => {
    if (!question) return;
    if (session?.feedback) nextButton.current?.focus();
    else answerInput.current?.focus();
  }, [question?.id, session?.feedback, question]);

  function updateSession(value: Session | null) {
    sessionRef.current = value;
    setSession(value);
  }
  function start() {
    if (saving || (sessionRef.current && !sessionRef.current.finished)) return;
    setStartError(null);
    try {
      const id = crypto.randomUUID();
      const generation = generateQuiz(data.vocabulary, {
        type, length, level, pool, progress: data.progress, listeningAvailable, sessionId: id, seed: id,
      });
      if (!generation.questions.length) {
        setStartError("Bu ayarlarla uygun soru bulunamadı. Türü, seviyeyi veya kelime havuzunu değiştir; anlam ve örnek cümleleri kütüphaneden tamamlayabilirsin.");
        return;
      }
      busy.current = false;
      setDraft("");
      setSaveError(null);
      setConfirmExit(false);
      updateSession({ meta: { id, type, startedAt: new Date().toISOString() }, generation,
        index: 0, answers: [], feedback: null, finished: false, aborted: false });
    } catch {
      setStartError("Quiz başlatılamadı. Tarayıcını ve kelime verilerini kontrol edip yeniden dene.");
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const current = sessionRef.current;
    if (!current || current.finished || current.feedback || busy.current || !draft.trim() || !question) return;
    const active = current.generation.questions[current.index];
    if (active.id !== question.id || current.answers.some(answer => answer.questionId === active.id)) return;
    busy.current = true;
    setSaving(true);
    setSaveError(null);
    const answer: QuizAnswer = {
      questionId: active.id, wordId: active.wordId, answer: draft.trim(),
      correct: gradeAnswer(active, draft), timestamp: new Date().toISOString(),
    };
    try {
      await recordQuizAnswer(current.meta, answer);
      updateSession({ ...current, answers: [...current.answers, answer], feedback: answer });
    } catch (error) {
      busy.current = false;
      setSaveError(`Yanıt kaydedilemedi. Sonraki soruya geçilmedi. ${error instanceof Error ? error.message : "Tarayıcı depolamasını kontrol et."} Aynı yanıtı yeniden gönderebilirsin.`);
    } finally {
      setSaving(false);
    }
  }
  function next() {
    const current = sessionRef.current;
    if (!current || !current.feedback || saving || !question || current.generation.questions[current.index].id !== question.id) return;
    const finished = current.index + 1 >= current.generation.questions.length;
    updateSession({ ...current, feedback: null, index: finished ? current.index : current.index + 1, finished });
    busy.current = false;
    setDraft("");
    setSaveError(null);
  }
  function abort() {
    const current = sessionRef.current;
    if (!current || saving || current.finished || (busy.current && !current.feedback)) return;
    updateSession({ ...current, finished: true, aborted: true });
    busy.current = false;
    setConfirmExit(false);
  }
  function backToSetup() {
    if (saving) return;
    updateSession(null);
    busy.current = false;
    setDraft("");
    setSaveError(null);
    setStartError(null);
  }

  if (session?.finished) {
    const correct = session.answers.filter(answer => answer.correct).length;
    const incorrect = session.answers.filter(answer => !answer.correct);
    const percent = session.answers.length ? Math.round(correct / session.answers.length * 100) : null;
    return <div className="mx-auto max-w-4xl space-y-6 animate-card">
      <section className="surface learning-focus p-7 md:p-10">
        <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Target className="size-7" /></div>
        <p className="eyebrow">{session.aborted ? "Dilediğin zaman devam edebilirsin" : "Bir pratik daha, bir adım ileri"}</p>
        <h1 className="page-title mt-3">{session.aborted ? "Oturum sonlandırıldı." : "Pratiğin tamamlandı."}</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {session.answers.length} / {session.generation.questions.length} soruyu yanıtladın. {session.answers.length ? "Yanıtların ve tekrar planın zaten kaydedildi; sonlandırma bunları silmez." : "Henüz yanıt verilmedi; ilerleme kaydı oluşturulmadı."}
        </p>
        <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[ ["Kaydedilen yanıt", session.answers.length], ["Doğru", correct], ["Yanlış", incorrect.length], ["Başarı", percent === null ? "—" : `%${percent}`] ].map(([label, value]) =>
            <div key={label} className="rounded-2xl border bg-card/80 p-4"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-2 text-3xl font-medium tracking-tight">{value}</dd></div>)}
        </dl>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button className="h-12 rounded-xl px-5" onClick={start}><RotateCcw /> Aynı ayarlarla yeniden başla</Button>
          <Button variant="outline" className="h-12 rounded-xl px-5" onClick={backToSetup}>Pratiği düzenle</Button>
        </div>
        {startError && <p role="alert" className="mt-4 text-sm text-destructive">{startError}</p>}
      </section>
      <section className="surface p-6 md:p-8">
        <h2 className="text-lg font-semibold">{incorrect.length ? "Bir sonraki tekrarda odaklan" : "Yanlış yanıtlanan kelime yok"}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{incorrect.length ? "Bu kelimeler tekrar planına işlendi. Önce doğru yanıtı ve varsa gerçek bağlamını gözden geçir." : session.answers.length ? "Bu oturumda yanıtladığın tüm kelimeleri doğru hatırladın." : "Yeni bir pratikle başlayabilirsin."}</p>
        {incorrect.length > 0 && <ul className="mt-5 divide-y">
          {incorrect.map(answer => {
            const item = session.generation.questions.find(q => q.id === answer.questionId)!;
            return <li key={answer.questionId} className="py-5 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2"><h3 lang="en" className="text-xl font-medium">{item.word}</h3><span className="text-xs text-muted-foreground">{QUIZ_LABELS[item.type]}</span></div>
              <p className="mt-2 text-sm text-muted-foreground">Yanıtın: <span className="text-destructive">{answer.answer}</span></p>
              <p className="mt-1 text-sm">Doğru yanıt: <span className="font-semibold text-primary">{item.answer}</span></p>
              <Context question={item} />
            </li>;
          })}
        </ul>}
      </section>
    </div>;
  }

  if (session && question) {
    const feedback = session.feedback;
    const englishPrompt = question.type !== "tr-en-choice" && question.type !== "tr-en-write" && question.type !== "listening";
    const turkishAnswer = question.type === "en-tr-choice" || question.type === "en-tr-write";
    return <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="eyebrow">Odak zamanı</p><h1 className="mt-1 text-xl font-medium">{QUIZ_LABELS[session.meta.type]}</h1></div>
        <Button variant="ghost" className="gap-2 text-muted-foreground" disabled={saving} onClick={() => setConfirmExit(true)}><X /> Oturumu sonlandır</Button>
      </div>
      {confirmExit && <section role="alertdialog" aria-labelledby="quiz-exit-title" aria-describedby="quiz-exit-description" className="surface p-5">
        <h2 id="quiz-exit-title" className="font-semibold">Pratiğe ara vermek ister misin?</h2>
        <p id="quiz-exit-description" className="mt-2 text-sm text-muted-foreground">{session.answers.length} yanıt zaten kaydedildi ve tekrar planına işlendi. Yanıtlanmamış sorular kaydedilmez.</p>
        <div className="mt-4 flex gap-3"><Button variant="outline" onClick={() => setConfirmExit(false)}>Devam et</Button><Button variant="destructive" onClick={abort} disabled={saving}>Sonlandır</Button></div>
      </section>}
      {session.generation.notices.length > 0 && <div className="rounded-2xl border bg-secondary/40 p-4 text-xs leading-relaxed text-muted-foreground">{session.generation.notices.map(note => <p key={note}>{note}</p>)}</div>}
      <section className="surface overflow-hidden">
        <div className="border-b px-6 py-5 md:px-9">
          <div className="mb-3 flex justify-between gap-3 text-xs text-muted-foreground"><span>Soru {session.index + 1} / {session.generation.questions.length}</span><span>{session.answers.length} yanıt kaydedildi</span></div>
          <Progress value={session.answers.length / session.generation.questions.length * 100} aria-label="Kaydedilen quiz yanıtları" />
        </div>
        <div className="learning-focus px-6 py-9 md:px-9 md:py-12">
          <p className="eyebrow">{QUIZ_LABELS[question.type]}</p>
          <h2 id="quiz-question" lang={englishPrompt ? "en" : "tr"} className={`mt-5 break-words font-medium tracking-tight ${question.type === "blank" || question.type === "sentence" || question.type === "listening" ? "text-2xl leading-relaxed md:text-3xl" : "text-4xl md:text-5xl"}`}>{question.prompt}</h2>
          {question.promptContext && <p lang={question.type === "blank" || question.type === "sentence" ? "tr" : "en"} className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{question.promptContext}</p>}
          {question.type === "listening" && <div className="mt-7"><ListenButton key={question.id} word={question.word} settings={data.settings} available={listeningAvailable} /></div>}
        </div>
        <form className="px-6 pb-7 pt-6 md:px-9" onSubmit={submit} aria-labelledby="quiz-question" aria-busy={saving}>
          {question.options ? <fieldset disabled={saving || !!feedback}>
            <legend className="mb-4 text-sm font-medium">Doğru karşılığı seç</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {question.options.map((option, index) => {
                const isCorrect = !!feedback && gradeAnswer(question, option);
                const isWrong = !!feedback && draft === option && !isCorrect;
                return <label key={option} className={`relative flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50 ${isCorrect ? "border-primary bg-primary/10" : isWrong ? "border-destructive bg-destructive/10" : draft === option ? "border-primary bg-secondary" : "bg-card hover:border-primary/40"}`}>
                  <input type="radio" name="quiz-option" className="sr-only" value={option} checked={draft === option} onChange={() => setDraft(option)} />
                  <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold">{isCorrect ? <Check className="size-4 text-primary" /> : String.fromCharCode(65 + index)}</span>
                  <span lang={turkishAnswer ? "tr" : "en"} className="break-words text-sm font-medium">{option}</span>
                </label>;
              })}
            </div>
          </fieldset> : <div className="space-y-3">
            <label htmlFor="quiz-answer" className="text-sm font-medium">{turkishAnswer ? "Türkçe karşılığını yaz" : "İngilizce kelimeyi yaz"}</label>
            <Input key={question.id} ref={answerInput} id="quiz-answer" value={draft} onChange={event => setDraft(event.target.value)} disabled={saving || !!feedback} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={2000} lang={turkishAnswer ? "tr" : "en"} placeholder="Yanıtın" className="h-14 rounded-xl bg-background px-4 text-lg md:text-lg" aria-describedby={saveError ? "quiz-save-error" : undefined} />
            <p className="text-xs leading-relaxed text-muted-foreground">{turkishAnswer ? "Kayıtlı alternatif anlamlar kabul edilir. Yaklaşık veya kısmi yanıtlar doğru sayılmaz." : "Büyük/küçük harf önemli değil. Kelimenin veya ifadenin tamamını yaz."}</p>
          </div>}
          {saveError && <p id="quiz-save-error" role="alert" className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm leading-relaxed text-destructive">{saveError}</p>}
          {!feedback && <Button type="submit" disabled={saving || !draft.trim()} className="mt-6 h-12 w-full rounded-xl px-6 sm:w-auto">{saving ? <><Loader2 className="animate-spin" /> Yanıt kaydediliyor</> : <><Check /> {saveError ? "Kaydetmeyi yeniden dene" : "Yanıtı kontrol et"}</>}</Button>}
          {feedback && <div className={`mt-6 rounded-2xl border p-5 ${feedback.correct ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"}`} role="status" aria-live="polite">
            <div className="flex items-center gap-2 font-semibold">{feedback.correct ? <CheckCircle2 className="size-5 text-primary" /> : <XCircle className="size-5 text-destructive" />}{feedback.correct ? "Doğru hatırladın." : "Bu kelimeyi birlikte pekiştirelim."}</div>
            <p className="mt-3 text-sm">Doğru yanıt: <strong lang={turkishAnswer ? "tr" : "en"} className="text-primary">{question.answer}</strong></p>
            {question.acceptedAnswers.length > 1 && <p className="mt-2 text-xs text-muted-foreground">Kabul edilen karşılıklar: {question.acceptedAnswers.join(" · ")}</p>}
            {!feedback.correct && <p className="mt-2 text-sm text-muted-foreground">Yanıtın: {feedback.answer}</p>}
            <Context question={question} />
            <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 shrink-0" /> Yanıtın ve tekrar planın birlikte kaydedildi.</p>
          </div>}
          {feedback && <Button type="button" ref={nextButton} onClick={next} className="mt-5 h-12 w-full rounded-xl px-6 sm:w-auto">{session.index + 1 === session.generation.questions.length ? "Sonuçları gör" : "Sonraki soru"}<ArrowRight /></Button>}
        </form>
      </section>
      <p className="text-center text-xs leading-relaxed text-muted-foreground">Hız değil, hatırlamak önemli. Her kelime bu oturumda yalnızca bir kez sorulur.</p>
    </div>;
  }

  const currentAvailability = availability[type];
  const lengthOptions = Array.from(new Set([5, 10, 15, 20, 30, 50, length])).sort((a, b) => a - b);
  return <div className="space-y-8 animate-card">
    <header className="flex flex-wrap items-end justify-between gap-5">
      <div><p className="eyebrow">Bilgini aktif hatırlamaya dönüştür</p><h1 className="page-title mt-3">Küçük bir pratik.<br />Kalıcı bir öğrenme.</h1><p className="page-subtitle mt-4">Kendi kelimelerinle çalış. Anlam, cümle ve dinlemeyi bir araya getir; her yanıt bir sonraki tekrarını şekillendirsin.</p></div>
      <div className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3"><BookOpen className="size-5 text-primary" /><div><p className="text-lg font-medium">{data.vocabulary.length.toLocaleString("tr-TR")}</p><p className="text-xs text-muted-foreground">kütüphanendeki kelime</p></div></div>
    </header>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="surface p-6 md:p-8">
        <fieldset><legend className="text-lg font-semibold">Nasıl pratik yapmak istersin?</legend><p className="mb-6 mt-2 text-sm text-muted-foreground">Her türün altında, seçili seviye ve havuzda uygun olan farklı kelime sayısı var.</p>
          <div className="grid gap-3 md:grid-cols-2">
            {MODES.map(({ type: mode, icon: Icon, description }) => {
              const count = availability[mode];
              return <label key={mode} className={`relative flex cursor-pointer gap-3 rounded-2xl border p-4 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50 ${type === mode ? "border-primary bg-secondary/60" : "bg-background/40 hover:border-primary/40"} ${!count ? "opacity-60" : ""}`}>
                <input type="radio" className="sr-only" name="quiz-type" value={mode} checked={type === mode} disabled={!count} onChange={() => { setType(mode); setStartError(null); }} />
                <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${type === mode ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}><Icon className="size-4" aria-hidden="true" /></div>
                <div className="min-w-0"><p className="text-sm font-semibold leading-relaxed">{QUIZ_LABELS[mode]}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p><p className={`mt-3 text-xs font-medium ${count ? "text-primary" : "text-muted-foreground"}`}>{count ? `${count} uygun kelime` : "Şu an kullanılamıyor"}</p></div>
              </label>;
            })}
          </div>
        </fieldset>
      </section>
      <aside className="space-y-5">
        <section className="surface learning-focus p-6">
          <p className="eyebrow">Kendi ritmini seç</p><h2 className="mt-2 text-lg font-semibold">Pratik planın</h2>
          <div className="mt-6 space-y-5">
            <SettingSelect id="quiz-pool" label="Kelime havuzu" value={pool} onChange={value => { setPool(value as QuizPool); setStartError(null); }}>{QUIZ_POOLS.map(item => <SelectItem key={item} value={item}>{QUIZ_POOL_LABELS[item]} ({poolCounts[item].toLocaleString("tr-TR")})</SelectItem>)}</SettingSelect>
            <SettingSelect id="quiz-level" label="Kelime seviyesi" value={level} onChange={value => { setLevel(value as Settings["preferredLevel"]); setStartError(null); }}><SelectItem value="all">Tüm seviyeler</SelectItem>{LEVELS.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SettingSelect>
            <SettingSelect id="quiz-length" label="Soru sayısı" value={String(length)} onChange={value => setLength(Number(value))}>{lengthOptions.map(item => <SelectItem key={item} value={String(item)}>{item} soru</SelectItem>)}</SettingSelect>
          </div>
          <div className="mt-6 rounded-xl border bg-card/80 p-4"><p className="text-sm font-medium">{Math.min(length, currentAvailability)} farklı kelimeyle pratik</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{currentAvailability < length ? `${length} soru istedin; seçili ayarlarda yalnızca ${currentAvailability} uygun kelime var. Tekrar soru veya başka türe gizli geçiş yapılmaz.` : "Aynı kelime iki kez sorulmaz. Yanıtlar tek tek kaydedilir."}</p></div>
          <Button onClick={start} disabled={!currentAvailability} className="mt-5 h-12 w-full rounded-xl">Pratiğe başla <ArrowRight /></Button>
          {startError && <p role="alert" className="mt-4 text-sm text-destructive">{startError}</p>}
          {!currentAvailability && <p role="status" className="mt-4 text-xs leading-relaxed text-muted-foreground">Türü, seviyeyi veya kelime havuzunu değiştir. Anlam ve gerçek örnek cümleleri kütüphaneden tamamlayabilirsin.</p>}
        </section>
        <section className="rounded-2xl border px-5 py-5 text-xs leading-relaxed text-muted-foreground">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground"><ShieldCheck className="size-4 text-primary" /> Yalnızca gerçek verilerinle</h2>
          <ul className="space-y-3"><li>Çeviri için kayıtlı Türkçe anlam gerekir. Yazılı yanıtta kayıtlı alternatifler de kabul edilir.</li><li>Cümle soruları, kelimenin tamamını içeren gerçek örneklerle hazırlanır; örnek uydurulmaz.</li><li>Seçmeli sorularda dört farklı, anlamları çakışmayan seçenek gerekir.</li><li>{status === "ready" ? "İngilizce cihaz sesi hazır. Dinleme karmaya dahil edilebilir." : status === "unsupported" ? "Tarayıcı konuşma sentezini desteklemiyor; dinleme kapalı." : "İngilizce cihaz sesi bulunamadı. Ses paketi yüklenince dinleme açılır."}</li></ul>
          {type === "mixed" && <p className="mt-4 border-t pt-4">Karmada kullanılabilen türler: {QUESTION_TYPES.filter(mode => availability[mode]).map(mode => QUIZ_LABELS[mode]).join(", ") || "Henüz yok"}.</p>}
        </section>
      </aside>
    </div>
  </div>;
}
