import fs from "node:fs";
import crypto from "node:crypto";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { entriesToWords, extractEntries, type PdfTextItem } from "../src/lib/vocabulary/pdf-parser";
const filename = process.argv[2];
if (!filename) throw new Error("Usage: npx tsx scripts/check-oxford.mts <official-pdf>");
const bytes=fs.readFileSync(filename);
const pdf=await getDocument({data:new Uint8Array(bytes),useSystemFonts:true}).promise;
const pages:PdfTextItem[][]=[];
for(let i=1;i<=pdf.numPages;i++) { const page=await pdf.getPage(i); const c=await page.getTextContent(); pages.push(c.items.filter(item=>"str" in item) as PdfTextItem[]); }
const entries=extractEntries(pages);
const words=entriesToWords(entries);
console.log(JSON.stringify({sha256:crypto.createHash("sha256").update(bytes).digest("hex"),pages:pdf.numPages,rows:entries.length,unique:words.length,levels:words.reduce((acc,w)=>({...acc,[w.cefrLevel]:(acc[w.cefrLevel]??0)+1}),{} as Record<string,number>),first:entries.slice(0,3),last:entries.slice(-3)},null,2));
if(process.env.PRIVATE_OUTPUT) fs.writeFileSync(process.env.PRIVATE_OUTPUT,JSON.stringify(words));
await pdf.loadingTask.destroy();
