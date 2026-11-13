import { describe, it, expect } from "vitest";
import { buildSession, defaultProgress, isDue, localDate, scheduleReview } from "@/lib/learning/scheduler";
import { calculateStats } from "@/lib/learning/statistics";
import { backupSchema } from "@/lib/storage/schema";
import { DEFAULT_SETTINGS, type Snapshot, type VocabularyWord } from "@/types";
const now = new Date("2026-11-13T12:00:00Z");
const word = (id: string, level: VocabularyWord["cefrLevel"] = "A1"): VocabularyWord => ({ id, word: id, cefrLevel: level, partOfSpeech: "noun", turkishMeaning: "", pronunciation: "" });
const empty = (): Snapshot => ({ vocabulary: [], progress: [], reviews: [], quizzes: [], settings: DEFAULT_SETTINGS, dataset: null });
describe("SM-2 scheduling", () => {
  it("starts at 1 day, then 6, then longer; mastery needs repeated recall", () => {
    let p = defaultProgress("apple");
    p = scheduleReview(p, "good", now); expect(p.intervalDays).toBe(1); expect(p.status).toBe("learning");
    p = scheduleReview(p, "good", now); expect(p.intervalDays).toBe(6);
    p = scheduleReview(p, "good", now); expect(p.intervalDays).toBeGreaterThan(6); expect(p.status).toBe("learned"); expect(p.correctCount).toBe(3);
  });
  it("forgotten learned words lose mastery and return after 10 minutes", () => {
    let p = defaultProgress("apple"); for(let i=0;i<3;i++) p = scheduleReview(p, "good", now);
    p = scheduleReview(p, "again", now); expect(p.status).toBe("learning"); expect(p.repetitions).toBe(0); expect(p.incorrectCount).toBe(1);
    expect(Date.parse(p.nextReviewDate!) - now.getTime()).toBe(600000); expect(isDue(p, new Date(now.getTime()+600001))).toBe(true);
  });
  it("clamps ease/confidence/difficulty", () => { let p = defaultProgress("x"); for(let i=0;i<100;i++) p = scheduleReview(p, "again", now); expect(p.easeFactor).toBe(1.3); expect(p.confidence).toBe(0); expect(p.difficulty).toBe(1); });
  it("keeps favorites during reviews", () => expect(scheduleReview({...defaultProgress("a"),favorite:true}, "good", now).favorite).toBe(true));
  it("caps long-term intervals at a year so dates remain valid", () => { let p=defaultProgress("a"); for(let i=0;i<100;i++) p=scheduleReview(p,"good",now); expect(p.intervalDays).toBe(365); expect(Number.isFinite(Date.parse(p.nextReviewDate!))).toBe(true); });
});
describe("daily sessions", () => {
  it("prioritizes oldest overdue and obeys daily review goal", () => { const s = empty(); s.vocabulary = [word("b"),word("a")]; s.progress = ["a","b"].map((id,i)=>({...defaultProgress(id),status:"learning",nextReviewDate:new Date(now.getTime()-(i+1)*86400000).toISOString()})); s.settings = {...DEFAULT_SETTINGS,reviewsPerDay:1}; expect(buildSession(s,"review",now).map(w=>w.id)).toEqual(["b"]); });
  it("gradually introduces A1 first and does not count favorites as studied", () => { const s=empty(); s.vocabulary=[word("advanced","B2"),word("basic")]; s.progress=[{...defaultProgress("basic"),favorite:true}]; s.settings={...DEFAULT_SETTINGS,newWordsPerDay:1}; expect(buildSession(s,"learn",now)[0].id).toBe("basic"); });
  it("deducts already introduced words from today's new quota",()=> { const s=empty(); s.vocabulary=[word("a"),word("b")]; s.settings={...DEFAULT_SETTINGS,newWordsPerDay:1}; s.reviews=[{id:"1",wordId:"a",timestamp:now.toISOString(),localDate:localDate(now),rating:"good",source:"learn",wasNew:true,correct:true}]; expect(buildSession(s,"learn",now)).toHaveLength(0); });
});
describe("real statistics", () => {
  it("empty history is zero, not sample data", () => { const stats=calculateStats(empty(),now); expect(stats.learned).toBe(0); expect(stats.streak).toBe(0); expect(stats.quizSuccess).toBeNull(); expect(stats.activity.every(d=>d.total===0)).toBe(true); });
  it("yesterday's streak remains valid until today is over",()=>{ const s=empty(); const yesterday=new Date(now); yesterday.setDate(yesterday.getDate()-1); s.reviews=[{id:"1",wordId:"x",timestamp:yesterday.toISOString(),localDate:localDate(yesterday),rating:"good",source:"learn",wasNew:true,correct:true}]; expect(calculateStats(s,now).streak).toBe(1); });
});
describe("backups", () => {
  it("rejects corrupt references and duplicates before replacing any data",()=>{ const s=empty(); s.vocabulary=[word("a"),word("a")]; expect(backupSchema.safeParse({...s,format:"oxford-personal-backup",version:1,exportedAt:now.toISOString()}).success).toBe(false); });
  it("accepts an empty well-formed backup",()=>expect(backupSchema.safeParse({...empty(),format:"oxford-personal-backup",version:1,exportedAt:now.toISOString()}).success).toBe(true));
  it("rejects fabricated progress counters without supporting history",()=>{ const s=empty(); s.vocabulary=[word("a")]; s.progress=[{...defaultProgress("a"),status:"learned",reviewCount:3,correctCount:3,repetitions:3,confidence:100}]; expect(backupSchema.safeParse({...s,format:"oxford-personal-backup",version:1,exportedAt:now.toISOString()}).success).toBe(false); });
});
