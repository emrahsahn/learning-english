export type CefrLevel = "A1" | "A2" | "B1" | "B2";
export type LearningStatus = "new" | "learning" | "learned";
export type Rating = "again" | "hard" | "good";
export type QuizType = "en-tr-choice" | "tr-en-choice" | "blank" | "sentence" | "en-tr-write" | "tr-en-write" | "listening" | "mixed";
export interface WordSense {
  pos?: string;
  meaning: string;
  exampleSentence: string;
  exampleTranslation?: string;
}

export interface VocabularyWord {
  id: string;
  word: string;
  cefrLevel: CefrLevel;
  partOfSpeech: string;
  turkishMeaning: string;
  pronunciation: string;
  audioUrl?: string;
  exampleSentence?: string;
  exampleTranslation?: string;
  senses?: WordSense[];
  synonyms?: string[];
  antonyms?: string[];
  acceptedTranslations?: string[];
  dictionarySource?: string;
}
export interface WordProgress {
  wordId: string;
  status: LearningStatus;
  lastReviewDate: string | null;
  nextReviewDate: string | null;
  reviewCount: number;
  correctCount: number;
  incorrectCount: number;
  difficulty: number;
  confidence: number;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  favorite: boolean;
}
export interface ReviewEvent {
  id: string;
  wordId: string;
  timestamp: string;
  localDate: string;
  rating: Rating;
  source: "learn" | "review" | "quiz";
  wasNew: boolean;
  correct: boolean;
  quizId?: string;
}
export interface QuizAnswer {
  questionId: string;
  wordId: string;
  answer: string;
  correct: boolean;
  timestamp: string;
}
export interface QuizResult {
  id: string;
  type: QuizType;
  startedAt: string;
  finishedAt: string;
  answers: QuizAnswer[];
}
export interface Settings {
  id: "preferences";
  newWordsPerDay: number;
  reviewsPerDay: number;
  quizLength: number;
  preferredLevel: CefrLevel | "all";
  voiceAccent: "en-GB" | "en-US";
  speechRate: number;
}
export interface DatasetMetadata {
  id: "dataset";
  source: string;
  importedAt: string;
  count: number;
  digest: string;
  verified: boolean;
}
export interface Snapshot {
  vocabulary: VocabularyWord[];
  progress: WordProgress[];
  reviews: ReviewEvent[];
  quizzes: QuizResult[];
  settings: Settings;
  dataset: DatasetMetadata | null;
}
export interface Backup extends Snapshot {
  format: "oxford-personal-backup";
  version: 1;
  exportedAt: string;
}
export const DEFAULT_SETTINGS: Settings = {
  id: "preferences", newWordsPerDay: 10, reviewsPerDay: 15,
  quizLength: 10, preferredLevel: "all", voiceAccent: "en-GB", speechRate: 0.85,
};
export const LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2"];
