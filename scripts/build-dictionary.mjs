// The dictionary output is a modified FreeDict work: GPL-2.0-or-later.
// This converter and its corresponding source are supplied with the app.
import { XMLParser } from "fast-xml-parser";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
const source = "public/data/freedict-eng-tur-0.3.src.tar.xz";
const xml = execFileSync("tar",["-xJOf",source,"eng-tur/eng-tur.tei"],{maxBuffer:50*1024*1024,encoding:"utf8"});
const doc=new XMLParser({ignoreAttributes:false,trimValues:true,processEntities:true}).parse(xml);
const entries=doc.TEI.text.body.entry;
const array=x=>Array.isArray(x)?x:x?[x]:[];
const text=x=>typeof x==="string"?x:x?.["#text"]??"";
const dictionary={};
for(const entry of entries) {
  const headings=array(entry.form).flatMap(f=>array(f.orth)).map(text).filter(Boolean);
  const translations=array(entry.sense).flatMap(s=>array(s.cit)).filter(c=>c["@_type"]==="trans").flatMap(c=>array(c.quote)).map(text).map(s=>s.trim()).filter(s=>s && s.length<500);
  for(const word of headings) { const key=word.toLowerCase(); dictionary[key]=[...new Set([...(dictionary[key]??[]),...translations])]; }
}
fs.writeFileSync("public/data/eng-tr-dictionary.json",JSON.stringify({license:"GPL-2.0-or-later",source:"FreeDict eng-tur 0.3 / gtksozluk2",sourceUrl:"https://download.freedict.org/dictionaries/eng-tur/0.3/",credits:["Mehmet Ali Vardar","Michael Bunk","FreeDict contributors"],modifications:"TEI converted to a normalized JSON headword/translation index; no Oxford membership or CEFR data included.",entries:dictionary}));
console.log("General dictionary headwords:",Object.keys(dictionary).length);
