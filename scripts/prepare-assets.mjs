import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
const target=resolve("public/pdf.worker.min.mjs");
mkdirSync(dirname(target),{recursive:true});
copyFileSync(resolve("node_modules/pdfjs-dist/build/pdf.worker.min.mjs"),target);
console.log("PDF worker prepared locally (no CDN dependency).");
