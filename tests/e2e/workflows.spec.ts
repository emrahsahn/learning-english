import { test as base, expect as playwrightExpect, type Locator, type Page } from "@playwright/test";
import type { DatasetMetadata, QuizResult, ReviewEvent, Settings, VocabularyWord, WordProgress } from "../../src/types";

const expect = playwrightExpect.configure({ timeout: 15_000 });
const ROOT = process.cwd();
const PDF = process.env.OXFORD_E2E_PDF ?? `${ROOT}/private-data/The_Oxford_3000.pdf`;
const DIGEST = "61a2201c44b390ec579365b4ca805f6ab536bd7b2cb61c78bc599d43b5958112";
const RESOURCES = ["eng-tr-dictionary.json", "context-examples.json", "wiktionary-lexicon.json", "authored-glossary.json"];

type Tables = {
  vocabulary: VocabularyWord[];
  progress: WordProgress[];
  reviews: ReviewEvent[];
  quizzes: QuizResult[];
  settings: Settings[];
  metadata: DatasetMetadata[];
};
type Diagnostic = { kind: string; message: string; url: string };

const test = base.extend<{ diagnostics: Diagnostic[]; library: Page }>({
  diagnostics: [async ({ page }, use, testInfo) => {
    const entries: Diagnostic[] = [];
    page.on("pageerror", error => entries.push({ kind: "pageerror", message: error.message, url: page.url() }));
    page.on("console", message => {
      if (["error", "warning"].includes(message.type())) {
        entries.push({ kind: message.type(), message: message.text(), url: page.url() });
      }
    });
    await use(entries);
    await testInfo.attach("browser-diagnostics.json", {
      body: JSON.stringify(entries, null, 2), contentType: "application/json",
    });
    const failures = entries.filter(entry => entry.kind !== "warning"
      || /hydrat|did not match|width.*(?:-1|greater than 0)|height.*(?:-1|greater than 0)/i.test(entry.message));
    expect.soft(failures, "No browser errors, hydration mismatches, or invalid chart dimensions").toEqual([]);
  }, { auto: true }],
  library: async ({ page }, use) => {
    await importOfficial(page);
    await use(page);
  },
});

test.use({ actionTimeout: 20_000, navigationTimeout: 45_000 });
test.beforeEach(async ({ baseURL }) => {
  test.setTimeout(120_000);
  expect(baseURL, "Never run against the unrelated port 3000 application").toBe("http://localhost:3001");
});

// Observation only: application UI owns every write. Abort on upgrade rather than
// accidentally creating a missing database from a test-side read.
async function tables(page: Page): Promise<Tables> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("lexi-oxford-personal");
      request.onupgradeneeded = () => {
        request.transaction?.abort();
        reject(new Error("Application database has not been initialized"));
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    try {
      const names = ["vocabulary", "progress", "reviews", "quizzes", "settings", "metadata"];
      const tx = db.transaction(names, "readonly");
      const complete = new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      const result = Object.fromEntries(await Promise.all(names.map(async name => {
        const values = await new Promise<unknown[]>((resolve, reject) => {
          const request = tx.objectStore(name).getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        return [name, values];
      })));
      await complete;
      return result;
    } finally { db.close(); }
  }) as Promise<Tables>;
}

function metric(scope: Page | Locator, label: string) {
  return scope.locator("dt").filter({ hasText: new RegExp(`^${label}$`) })
    .locator("xpath=ancestor::*[dd][1]/dd").first();
}

async function settings(page: Page) {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: /Ritmin, kütüphanen/ })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel("Resmî PDF dosyası seç")).toBeEnabled();
}

async function importOfficial(page: Page) {
  await settings(page);
  const before = await tables(page);
  const responses = RESOURCES.map(name => page.waitForResponse(response =>
    new URL(response.url()).pathname === `/data/${name}` && response.status() === 200,
  { timeout: 45_000 }));
  await page.getByLabel("Resmî PDF dosyası seç").setInputFiles(PDF);
  const preview = page.locator('[aria-labelledby="import-preview-title"]');
  await expect(preview).toBeVisible({ timeout: 45_000 });
  await Promise.all(responses);
  await expect(preview).toContainText("Önizleme · Henüz kaydedilmedi");
  await expect(preview).toContainText("Resmî PDF · özet doğrulandı");
  await expect(metric(preview, "Basılı satır")).toHaveText("3.004");
  await expect(metric(preview, "Kanonik kelime")).toHaveText("2.981");
  await expect(preview.locator("code")).toHaveText(DIGEST);
  expect(await tables(page), "Preview must not change any persisted data").toEqual(before);
  const meaning = await metric(preview, "Türkçe anlam").innerText();
  const ipa = await metric(preview, "IPA / telaffuz").innerText();
  const examples = await metric(preview, "Örnek cümle").innerText();
  await preview.getByRole("button", { name: "Listeyi tarayıcıma kaydet" }).click();
  await expect(preview).toBeHidden({ timeout: 20_000 });
  await expect.poll(async () => (await tables(page)).vocabulary.length).toBe(2981);
  const saved = await tables(page);
  expect(saved.metadata[0]).toMatchObject({ count: 2981, digest: DIGEST, verified: true });
  expect(new Set(saved.vocabulary.map(word => word.id)).size).toBe(2981);
  expect(new Set(saved.vocabulary.map(word => word.word.toLowerCase())).size).toBe(2981);
  const coverage = (count: number) => `${count.toLocaleString("tr-TR")} / 2.981`;
  expect(meaning).toBe(coverage(saved.vocabulary.filter(word => word.turkishMeaning.trim()).length));
  expect(ipa).toBe(coverage(saved.vocabulary.filter(word => word.pronunciation.trim()).length));
  expect(examples).toBe(coverage(saved.vocabulary.filter(word => word.exampleSentence?.trim()).length));
  expect(saved.vocabulary.filter(word => word.turkishMeaning.trim()).length).toBeGreaterThan(2500);
  expect(saved.vocabulary.filter(word => word.pronunciation.trim()).length).toBeGreaterThan(2000);
  expect(saved.vocabulary.find(word => word.word === "a")?.turkishMeaning).toContain("bir");
  expect(saved.vocabulary.find(word => word.word === "a")?.dictionarySource).toContain("CC0");
  expect(saved.vocabulary.find(word => word.word === "the")?.turkishMeaning).toContain("belirli tanımlık");
  return saved;
}

async function reveal(page: Page) {
  await page.getByRole("button", { name: "Anlamı ve örneği göster" }).click();
  await expect(page.getByRole("heading", { name: "Türkçe anlamı", exact: true })).toBeVisible();
}

async function rate(page: Page, label: "Zorlandım" | "Hatırladım") {
  await reveal(page);
  // Real rapid pointer clicks exercise the synchronous once-only save lock.
  await page.getByRole("button", { name: new RegExp(label) }).click({ clickCount: 2 });
  await expect(page.getByRole("status").filter({ hasText: `“${label}” kaydedildi` })).toBeVisible();
}

async function exportBytes(page: Page): Promise<Buffer> {
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON yedeğini indir" }).click();
  const download = await downloadEvent;
  expect(await download.failure()).toBeNull();
  expect(download.suggestedFilename()).toMatch(/^kelime-yedegim-\d{4}-\d{2}-\d{2}\.json$/);
  const stream = await download.createReadStream();
  if (!stream) throw new Error("Backup download has no readable stream");
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function assertCharts(page: Page) {
  const charts = page.locator(".recharts-surface");
  await expect.poll(() => charts.count()).toBeGreaterThanOrEqual(2);
  for (const chart of await charts.all()) {
    await expect(chart).toBeVisible();
    const bounds = await chart.boundingBox();
    expect(bounds?.width).toBeGreaterThan(0);
    expect(bounds?.height).toBeGreaterThan(0);
  }
}

async function noOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }))).toEqual({ viewport: 390, document: 390, body: 390 });
}

test("empty dashboard and settings defaults never fabricate progress", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /3.000 kelimelik yolculuk/ })).toBeVisible();
  await expect(page.getByText("Başlangıçta ilerlemen sıfırdır.", { exact: false })).toBeVisible();
  await expect(page.locator(".recharts-surface")).toHaveCount(0);
  const empty = await tables(page);
  expect(Object.values(empty).every(values => values.length === 0)).toBe(true);
  await page.getByRole("link", { name: "Kelime listemi içe aktar" }).click();
  await expect(page.getByLabel("Günlük yeni kelime", { exact: true })).toHaveValue("10");
  await expect(page.getByLabel("Günlük tekrar hedefi")).toHaveValue("15");
  await expect(page.getByLabel("Test uzunluğu")).toHaveValue("10");
  await expect(page.getByLabel("Tercih edilen CEFR seviyesi")).toHaveValue("all");
  await expect(page.getByLabel("İngilizce aksanı")).toHaveValue("en-GB");
  await expect(page.getByLabel("Konuşma hızı")).toHaveValue("0.85");
  expect(await tables(page)).toEqual(empty);
});

test("wrong PDF is rejected without populating an empty library", async ({ page }) => {
  await settings(page);
  const before = await tables(page);
  await page.getByLabel("Resmî PDF dosyası seç").setInputFiles({
    name: "not-oxford.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nNot the official Oxford PDF"),
  });
  await expect(page.locator("#vocabulary-import").getByRole("alert")).toContainText("denetlenen resmî Oxford 3000 sürümüyle aynı değil");
  await expect(page.getByRole("button", { name: "Listeyi tarayıcıma kaydet" })).toHaveCount(0);
  expect(await tables(page)).toEqual(before);
});

test("official PDF preview, explicit import, joined meanings and IPA have no study side effects", async ({ page }, testInfo) => {
  const imported = await importOfficial(page);
  expect(imported.progress).toEqual([]);
  expect(imported.reviews).toEqual([]);
  expect(imported.quizzes).toEqual([]);
  await testInfo.attach("official-import-coverage.json", {
    body: JSON.stringify({ raw: 3004, canonical: imported.vocabulary.length,
      meanings: imported.vocabulary.filter(word => word.turkishMeaning.trim()).length,
      ipa: imported.vocabulary.filter(word => word.pronunciation.trim()).length,
      examples: imported.vocabulary.filter(word => word.exampleSentence?.trim()).length,
      digest: imported.metadata[0].digest }), contentType: "application/json",
  });
  const word = imported.vocabulary.find(item => item.word === "apple");
  expect(word).toBeDefined();
  expect(word!.turkishMeaning).toContain("elma");
  expect(word!.pronunciation).not.toBe("");
  await page.goto("/explorer");
  await page.getByRole("textbox", { name: "İngilizce kelime veya Türkçe anlam ara" }).fill("apple");
  await page.getByRole("button", { name: "apple kelime ayrıntısını aç", exact: true }).click();
  const detail = page.getByRole("dialog", { name: "apple kelime ayrıntısı" });
  await expect(detail).toContainText(word!.turkishMeaning);
  await expect(detail).toContainText(word!.pronunciation);
  await page.getByRole("button", { name: "Kelime ayrıntısını kapat" }).click();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Bir kelime.*Bir adım ileri/ })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Kelime listeni tamamlamaya ilerleme" })).toHaveAttribute("aria-valuenow", "0");
  await expect(page.getByRole("progressbar", { name: "Kelime listeni tamamlamaya ilerleme" })).toHaveAttribute("aria-valuemax", "2981");
  await expect(page.getByRole("figure", { name: "Son 7 günün günlük çalışma grafiği" })).toContainText("henüz çalışma kaydı yok");
  await assertCharts(page);
  expect(await tables(page)).toEqual(imported);
  await page.goto("/review");
  await expect(page.getByRole("heading", { name: "Şimdilik tekrar bekleyen kelime yok" })).toBeVisible();
  await page.goto("/statistics");
  await expect(page.getByText("Henüz test yanıtı yok", { exact: true })).toBeVisible();
  await expect(page.getByRole("figure", { name: "Son 90 günün çalışma takvimi" })).toContainText("0 aktif gün");
  expect(await tables(page)).toEqual(imported);
});

test("wrong PDF cannot replace an imported library or its real learning history", async ({ library: page }) => {
  await page.goto("/learn");
  await rate(page, "Zorlandım");
  await settings(page);
  const before = await tables(page);
  await page.getByLabel("Resmî PDF dosyası seç").setInputFiles({
    name: "wrong-version.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nWrong version"),
  });
  await expect(page.locator("#vocabulary-import").getByRole("alert")).toContainText("sürümüyle aynı değil");
  expect(await tables(page)).toEqual(before);
  await page.reload();
  await expect(page.getByLabel("Resmî PDF dosyası seç")).toBeEnabled();
  expect(await tables(page)).toEqual(before);
});

test("learn reveal, hard and good ratings save once, retain the static queue and persist on reload", async ({ library: page }) => {
  const initial = await tables(page);
  const levels = ["A1", "A2", "B1", "B2"];
  const queue = [...initial.vocabulary].sort((a, b) => levels.indexOf(a.cefrLevel) - levels.indexOf(b.cefrLevel)
    || a.word.localeCompare(b.word, "en")).slice(0, 10);
  await page.goto("/learn");
  await expect(page.getByRole("heading", { name: queue[0].word, exact: true })).toBeVisible();
  await expect(metric(page, "Oturum planı")).toHaveText("10kelime");
  await expect(page.getByRole("button", { name: /Zorlandım/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sonraki kelime", exact: true })).toHaveCount(0);
  expect(await tables(page)).toEqual(initial);
  await reveal(page);
  const meaning = page.locator("section").filter({ has: page.getByRole("heading", { name: "Türkçe anlamı", exact: true }) }).last();
  await expect(meaning.getByText(queue[0].turkishMeaning, { exact: true })).toBeVisible();
  expect(await tables(page)).toEqual(initial);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${ROOT}/private-data/learning-card.png`, fullPage: true });
  await page.getByRole("button", { name: /Zorlandım/ }).click({ clickCount: 2 });
  await expect(page.getByRole("status").filter({ hasText: "“Zorlandım” kaydedildi" })).toBeVisible();
  await expect(page.getByRole("heading", { name: queue[0].word, exact: true })).toBeVisible();
  await expect(page.getByText("Kelime 1", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: /Zorlandım|Hatırladım/ })).toHaveCount(0);
  const hard = await tables(page);
  expect(hard.reviews).toHaveLength(1);
  expect(hard.reviews[0]).toMatchObject({ wordId: queue[0].id, rating: "hard", source: "learn", wasNew: true });
  expect(hard.progress[0]).toMatchObject({ wordId: queue[0].id, reviewCount: 1, correctCount: 1, confidence: 5 });
  await page.keyboard.press("2");
  expect((await tables(page)).reviews).toHaveLength(1);
  await page.getByRole("button", { name: "Sonraki kelime", exact: true }).click();
  await expect(page.getByRole("heading", { name: queue[1].word, exact: true })).toBeVisible();
  await expect(metric(page, "Oturum planı")).toHaveText("10kelime");
  await rate(page, "Hatırladım");
  const saved = await tables(page);
  expect(saved.reviews).toHaveLength(2);
  expect(saved.reviews.find(event => event.wordId === queue[1].id)).toMatchObject({ rating: "good", source: "learn", wasNew: true });
  expect(saved.progress.find(item => item.wordId === queue[1].id)).toMatchObject({ reviewCount: 1, confidence: 22, correctCount: 1 });
  await expect(page.getByRole("heading", { name: queue[1].word, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sonraki kelime", exact: true }).click();
  await expect(page.getByRole("heading", { name: queue[2].word, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: queue[2].word, exact: true })).toBeVisible();
  await expect(metric(page, "Oturum planı")).toHaveText("8kelime");
  expect(await tables(page)).toEqual(saved);
  await page.goto("/");
  await expect(page.getByRole("progressbar", { name: "Yeni kelime", exact: true })).toHaveAttribute("aria-valuenow", "2");
  await assertCharts(page);
  await page.screenshot({ path: `${ROOT}/private-data/homepage-filled.png`, fullPage: true });
});

test("explorer detail favorite survives reload without creating study events", async ({ library: page }) => {
  const before = await tables(page);
  await page.goto("/explorer");
  await page.getByRole("textbox", { name: "İngilizce kelime veya Türkçe anlam ara" }).fill("apple");
  await page.getByRole("button", { name: "apple kelime ayrıntısını aç", exact: true }).click();
  const detail = page.getByRole("dialog", { name: "apple kelime ayrıntısı" });
  await detail.getByRole("button", { name: "Favorilere ekle" }).click();
  await expect(detail.getByRole("button", { name: "Favorilerden çıkar" })).toHaveAttribute("aria-pressed", "true");
  expect((await tables(page)).progress).toEqual([expect.objectContaining({
    wordId: before.vocabulary.find(word => word.word === "apple")!.id,
    favorite: true, status: "new", reviewCount: 0, lastReviewDate: null, nextReviewDate: null,
  })]);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Kelimeleri keşfet", exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "İngilizce kelime veya Türkçe anlam ara" }).fill("apple");
  await page.getByRole("button", { name: "apple kelime ayrıntısını aç", exact: true }).click();
  await expect(detail.getByRole("button", { name: "Favorilerden çıkar" })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/favorites");
  await expect(metric(page, "Favori kelime")).toHaveText("1");
  await expect(page.getByRole("button", { name: "apple kelime ayrıntısını aç", exact: true })).toBeVisible();
  const after = await tables(page);
  expect(after.reviews).toEqual([]);
  expect(after.quizzes).toEqual([]);
  expect(after.vocabulary).toEqual(before.vocabulary);
});

test("full-library default mixed quiz opens and starts without blocking or creating study events", async ({ library: page }, testInfo) => {
  const before = await tables(page);
  const start = performance.now();
  await page.goto("/practice");
  const startButton = page.getByRole("button", { name: "Pratiğe başla" });
  await expect(startButton).toBeEnabled();
  await expect(page.getByRole("combobox", { name: "Kelime seviyesi" })).toContainText("Tüm seviyeler");
  await expect(page.getByRole("radio", { name: /Karma pratik/ })).toBeChecked();
  const setupMs = performance.now() - start;
  await startButton.click();
  await expect(page.locator("#quiz-question")).toBeVisible();
  await testInfo.attach("full-library-quiz-timing.json", {
    body: JSON.stringify({ words: before.vocabulary.length, setupMs: Math.round(setupMs), startMs: Math.round(performance.now() - start - setupMs) }), contentType: "application/json",
  });
  expect(await tables(page), "Starting a quiz without answering is not study activity").toEqual(before);
});

for (const correct of [false, true]) {
  test(`isolated written en→tr quiz: ${correct ? "actual stored correct answer" : "wrong answer"}, single submission and accurate summary`, async ({ library: page }) => {
    await settings(page);
    await page.getByLabel("Test uzunluğu").fill("1");
    await page.getByLabel("Tercih edilen CEFR seviyesi").selectOption("A1");
    await page.getByRole("button", { name: "Tercihleri kaydet" }).click();
    await expect.poll(async () => (await tables(page)).settings[0]).toMatchObject({ quizLength: 1, preferredLevel: "A1" });
    await page.goto("/practice");
    // The radio is intentionally sr-only; click its visible associated label.
    await page.getByText("İngilizce → Türkçe · Yazılı", { exact: true }).click();
    await expect(page.getByRole("radio", { name: /İngilizce → Türkçe · Yazılı/ })).toBeChecked();
    await expect(page.getByRole("combobox", { name: "Soru sayısı" })).toContainText("1 soru");
    await page.getByRole("button", { name: "Pratiğe başla" }).click();
    await expect(page.locator("#quiz-question")).toBeVisible();
    const prompt = (await page.locator("#quiz-question").innerText()).trim();
    const before = await tables(page);
    expect(before.reviews).toEqual([]);
    expect(before.quizzes).toEqual([]);
    const word = before.vocabulary.find(item => item.word === prompt);
    expect(word).toBeDefined();
    const answer = correct ? word!.turkishMeaning.split(/[;,]/)[0].trim() : "bu kesinlikle kayıtlı bir çeviri değildir xyz";
    expect(answer).not.toBe("");
    await page.getByRole("textbox", { name: "Türkçe karşılığını yaz" }).fill(answer);
    await page.getByRole("button", { name: "Yanıtı kontrol et" }).click({ clickCount: 2 });
    await expect(page.getByRole("status").filter({ hasText: correct ? "Doğru hatırladın." : "Bu kelimeyi birlikte pekiştirelim." })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Türkçe karşılığını yaz" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Yanıtı kontrol et" })).toHaveCount(0);
    const saved = await tables(page);
    expect(saved.quizzes).toHaveLength(1);
    expect(saved.quizzes[0]).toMatchObject({ type: "en-tr-write", answers: [expect.objectContaining({ wordId: word!.id, answer, correct })] });
    expect(saved.reviews).toHaveLength(1);
    expect(saved.reviews[0]).toMatchObject({ wordId: word!.id, rating: correct ? "good" : "again", source: "quiz", quizId: saved.quizzes[0].id });
    expect(saved.progress[0]).toMatchObject({ reviewCount: 1, correctCount: correct ? 1 : 0, incorrectCount: correct ? 0 : 1 });
    await page.getByRole("button", { name: "Sonuçları gör" }).click();
    await expect(page.getByRole("heading", { name: "Pratiğin tamamlandı." })).toBeVisible();
    await expect(metric(page, "Kaydedilen yanıt")).toHaveText("1");
    await expect(metric(page, "Doğru")).toHaveText(correct ? "1" : "0");
    await expect(metric(page, "Yanlış")).toHaveText(correct ? "0" : "1");
    await expect(metric(page, "Başarı")).toHaveText(correct ? "%100" : "%0");
    await page.reload();
    await expect(page.getByRole("button", { name: "Pratiğe başla" })).toBeVisible();
    expect(await tables(page)).toEqual(saved);
    await page.goto("/statistics");
    await expect(page.getByRole("progressbar", { name: "Testlerde doğru yanıt oranı" })).toHaveAttribute("aria-valuenow", correct ? "100" : "0");
    await expect(page.getByRole("progressbar", { name: "Testlerde doğru yanıt oranı" })).toHaveAttribute("aria-valuetext", `1 yanıttan ${correct ? 1 : 0} doğru`);
  });
}

test("export then real activity then confirmed UI restore rolls counts back; malformed backups lose nothing", async ({ library: page }) => {
  await page.goto("/learn");
  await rate(page, "Zorlandım");
  await settings(page);
  const baseline = await tables(page);
  expect(baseline.reviews).toHaveLength(1);
  const bytes = await exportBytes(page);
  const backup = JSON.parse(bytes.toString("utf8"));
  expect(backup).toMatchObject({ format: "oxford-personal-backup", version: 1, vocabulary: baseline.vocabulary,
    progress: baseline.progress, reviews: baseline.reviews, quizzes: baseline.quizzes,
    settings: expect.objectContaining({ newWordsPerDay: 10 }) });
  await page.goto("/learn");
  await rate(page, "Hatırladım");
  await settings(page);
  const changed = await tables(page);
  expect(changed.reviews).toHaveLength(2);
  expect(changed.progress).toHaveLength(2);
  await page.getByLabel("Günlük yeni kelime", { exact: true }).fill("7");
  await page.getByRole("button", { name: "Tercihleri kaydet" }).click();
  await expect.poll(async () => (await tables(page)).settings[0]?.newWordsPerDay).toBe(7);
  const beforeRestore = await tables(page);
  await page.getByLabel("Tam yedek JSON dosyası seç").setInputFiles({ name: "real-ui-export.json", mimeType: "application/json", buffer: bytes });
  const confirm = page.getByRole("dialog", { name: "Tüm tarayıcı verilerini değiştirmek istiyor musun?" });
  await expect(confirm).toBeVisible();
  await expect(metric(confirm, "Tekrar kaydı")).toHaveText("1");
  expect(await tables(page), "Selecting a backup must not restore before explicit confirmation").toEqual(beforeRestore);
  await confirm.getByRole("button", { name: "Vazgeç, verilerimi koru" }).click();
  expect(await tables(page)).toEqual(beforeRestore);
  await page.getByLabel("Tam yedek JSON dosyası seç").setInputFiles({ name: "real-ui-export.json", mimeType: "application/json", buffer: bytes });
  await confirm.getByRole("button", { name: "Onaylıyorum, tüm verilerimi yedekle değiştir" }).click();
  await expect(confirm).toBeHidden();
  const restored = await tables(page);
  expect(restored).toEqual({ ...baseline, settings: [backup.settings] });
  await expect(page.getByLabel("Günlük yeni kelime", { exact: true })).toHaveValue("10");
  await expect(metric(page.locator("#backups"), "Tekrar kaydı")).toHaveText("1");
  for (const [name, buffer] of [
    ["invalid-json.json", Buffer.from("{broken JSON")],
    ["invalid-schema.json", Buffer.from(JSON.stringify({ ...backup, version: 99 }))],
    ["broken-reference.json", Buffer.from(JSON.stringify({ ...backup, progress: [{ ...backup.progress[0], wordId: "not-in-the-real-vocabulary" }] }))],
  ] as const) {
    await page.getByLabel("Tam yedek JSON dosyası seç").setInputFiles({ name, mimeType: "application/json", buffer });
    await expect(page.locator("#backups").getByRole("alert")).toBeVisible();
    await expect(confirm).toBeHidden();
    expect(await tables(page), `${name} must be refused atomically`).toEqual(restored);
  }
  await page.reload();
  await expect(page.getByLabel("Tam yedek JSON dosyası seç")).toBeEnabled();
  expect(await tables(page)).toEqual(restored);
});

test("settings quota, level, quiz and speech preferences persist and invalid quota preserves saved values", async ({ page }) => {
  await settings(page);
  await page.getByLabel("Günlük yeni kelime", { exact: true }).fill("7");
  await page.getByLabel("Günlük tekrar hedefi").fill("23");
  await page.getByLabel("Test uzunluğu").fill("5");
  await page.getByLabel("Tercih edilen CEFR seviyesi").selectOption("A2");
  await page.getByLabel("İngilizce aksanı").selectOption("en-US");
  await page.getByLabel("Konuşma hızı").fill("0.75");
  await page.getByRole("button", { name: "Tercihleri kaydet" }).click();
  const expected = { id: "preferences", newWordsPerDay: 7, reviewsPerDay: 23,
    quizLength: 5, preferredLevel: "A2", voiceAccent: "en-US", speechRate: 0.75, autoSpeak: false };
  await expect.poll(async () => (await tables(page)).settings).toEqual([expected]);
  await page.reload();
  await expect(page.getByLabel("Günlük yeni kelime", { exact: true })).toHaveValue("7");
  await expect(page.getByLabel("Günlük tekrar hedefi")).toHaveValue("23");
  await expect(page.getByLabel("Test uzunluğu")).toHaveValue("5");
  await expect(page.getByLabel("Tercih edilen CEFR seviyesi")).toHaveValue("A2");
  await expect(page.getByLabel("İngilizce aksanı")).toHaveValue("en-US");
  await expect(page.getByLabel("Konuşma hızı")).toHaveValue("0.75");
  const saved = await tables(page);
  await page.getByLabel("Günlük yeni kelime", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Tercihleri kaydet" }).click();
  await expect(page.locator("#preferences").getByRole("alert")).toBeVisible();
  expect(await tables(page)).toEqual(saved);
  await page.reload();
  await expect(page.getByLabel("Günlük yeni kelime", { exact: true })).toHaveValue("7");
});

test("statistics tables and heatmap show only actual events, never viewing or favorite activity", async ({ library: page }) => {
  await page.goto("/statistics");
  const zero = await tables(page);
  await expect(page.getByText("Seçili dönemde 0 çalışma kaydı", { exact: true })).toBeVisible();
  await expect(page.getByRole("figure", { name: "Son 90 günün çalışma takvimi" })).toContainText("0 aktif gün");
  await page.goto("/learn");
  await rate(page, "Zorlandım");
  await page.getByRole("button", { name: "Sonraki kelime", exact: true }).click();
  await rate(page, "Hatırladım");
  const saved = await tables(page);
  expect(saved.reviews).toHaveLength(2);
  expect(saved.vocabulary).toEqual(zero.vocabulary);
  await page.goto("/statistics");
  await expect(page.getByText("Seçili dönemde 2 çalışma kaydı", { exact: true })).toBeVisible();
  const activity = page.getByRole("figure", { name: "Son 30 günün günlük çalışma grafiği" });
  await expect(activity).toContainText("2 yeni kelime, 0 tekrar ve toplam 2 çalışma kaydı");
  await activity.getByText("Günlük verileri tablo olarak gör", { exact: true }).click();
  const rows = await activity.locator("tbody tr").evaluateAll(elements => elements.map(row => ({
    date: row.querySelector("time")!.getAttribute("datetime"),
    values: [...row.querySelectorAll("td")].map(cell => Number(cell.textContent)),
  })));
  expect(rows).toHaveLength(30);
  const activeDate = saved.reviews[0].localDate;
  for (const row of rows) expect(row.values).toEqual(row.date === activeDate ? [2, 0, 2] : [0, 0, 0]);
  const status = page.locator('[aria-label="Kelime durumları"]');
  await expect(metric(status, "Öğrenildi")).toHaveText("0");
  await expect(metric(status, "Öğreniliyor")).toHaveText("2");
  await expect(metric(status, "Yeni kelime")).toHaveText("2.979");
  await expect(page.getByText("Henüz test yanıtı yok", { exact: true })).toBeVisible();
  const calendar = page.getByRole("figure", { name: "Son 90 günün çalışma takvimi" });
  await expect(calendar).toContainText("1 aktif gün");
  await expect(calendar.getByRole("button", { name: /: 2 çalışma kaydı, 2 yeni kelime, 0 tekrar/ })).toHaveCount(1);
  await expect(calendar.getByRole("button", { name: /: 0 çalışma kaydı, 0 yeni kelime, 0 tekrar/ })).toHaveCount(89);
  await page.getByRole("button", { name: "Son 90 gün", exact: true }).click();
  await expect(page.getByRole("figure", { name: "Son 90 günün günlük çalışma grafiği" })).toContainText("toplam 2 çalışma kaydı");
  await assertCharts(page);
  expect(await tables(page)).toEqual(saved);
});

test("390px mobile light and dark routes have usable charts and no document overflow", async ({ library: page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await settings(page);
  await page.getByLabel("Görünüm", { exact: true }).selectOption("light");
  await expect(page.locator("html")).toHaveClass(/light/);
  await noOverflow(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Bir kelime.*Bir adım ileri/ })).toBeVisible();
  await assertCharts(page);
  await noOverflow(page);
  await settings(page);
  await page.getByLabel("Görünüm", { exact: true }).selectOption("dark");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await noOverflow(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Bir kelime.*Bir adım ileri/ })).toBeVisible();
  await assertCharts(page);
  await noOverflow(page);
  await page.screenshot({ path: `${ROOT}/private-data/dark-mobile.png`, fullPage: true });
  // Check all other layouts before the known expensive full-library quiz setup.
  for (const route of ["/learn", "/explorer", "/statistics", "/practice"]) {
    await test.step(`Dark 390px layout: ${route}`, async () => {
      await page.goto(route);
      await expect(page.locator("main h1"), `${route} must finish loading within 15 seconds`).toBeVisible();
      await noOverflow(page);
      if (route === "/learn") {
        await reveal(page);
        await noOverflow(page);
      }
      if (route === "/statistics") await assertCharts(page);
    });
  }
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await noOverflow(page);
  const saved = await tables(page);
  expect(saved.progress).toEqual([]);
  expect(saved.reviews).toEqual([]);
  expect(saved.quizzes).toEqual([]);
});
