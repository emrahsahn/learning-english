import { describe, it, expect } from "vitest";
import { entriesToWords, extractEntries, type PdfTextItem } from "@/lib/vocabulary/pdf-parser";
const item=(str:string,x:number,y:number):PdfTextItem=>({str,transform:[1,0,0,1,x,y],fontName:"test"});
describe("PDF normalization",()=>{
  it("splits printed variants but deduplicates homographs and chooses lowest CEFR",()=>{const words=entriesToWords([{heading:"a, an",specification:"indefinite article A1"},{heading:"light (from the sun/a lamp)",specification:"n. A1"},{heading:"light (not heavy)",specification:"adj. A2"}]);expect(words.map(w=>w.word)).toEqual(["a","an","light"]);expect(words[2].cefrLevel).toBe("A1");expect(words[2].partOfSpeech).toBe("noun, adjective");});
  it("does not manufacture words to reach a target count",()=>expect(entriesToWords([{heading:"book",specification:"n. A1, v. A2"}])).toHaveLength(1));
  it("keeps a headword named number and joins continuation levels",()=>{const entries=extractEntries([[item("number n. A1",42.5,790),item("book n. A1,",42.5,780),item("v. A2",42.5,769)]]);expect(entries).toHaveLength(2);expect(entries[0].heading).toBe("number");expect(entries[1].specification).toContain("v. A2");});
  it("retains top-of-page entries while excluding footer copyright",()=>expect(extractEntries([[item("abandon v. B2",42.5,790),item("© Oxford University Press",42.5,29)]])).toHaveLength(1));
  it("handles trademarks and explicit noun punctuation",()=>{const words=entriesToWords([{heading:"Wi-Fi™",specification:"n. A2"},{heading:"per cent",specification:"noun., adj. A2"}]);expect(words.find(w=>w.word==="Wi-Fi")?.id).toBe("ox-wi-fi");expect(words.find(w=>w.word==="per cent")?.partOfSpeech).toBe("noun, adjective");});
});
