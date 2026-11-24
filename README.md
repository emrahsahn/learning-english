# Lexi — Oxford 3000 Kelime Atölyesi

![Next.js 16](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs)
![React 19](https://img.shields.io/badge/React-19-149eca?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript)
![Tailwind CSS 4](https://img.shields.io/badge/Tailwind_CSS-4-06b6d4?style=flat-square&logo=tailwindcss)
![IndexedDB](https://img.shields.io/badge/Storage-IndexedDB_(Dexie)-f59e0b?style=flat-square)
![PWA](https://img.shields.io/badge/PWA-Installable-6152ce?style=flat-square)

Türkçe arayüzlü, açık kaynaklı ve yerel öncelikli (**local-first**) İngilizce kelime öğrenme uygulaması. Üyelik, giriş ekranı, şifre veya harici veritabanı gerektirmez; tarayıcıda doğrudan açılır ve tüm öğrenme verilerini cihazının kendi deposunda (**IndexedDB**) saklar.

---

## Öne Çıkan Özellikler

- **Yerleşik 2.980 Kelimelik Oxford 3000 (A1–B2) Veri Seti:** İlk açılışta `public/data/oxford-3000-words.json` içindeki Amerikan Oxford 3000 kelime listesi; çoklu Türkçe anlamlar, IPA telaffuzlar ve özgün İngilizce/Türkçe örnek cümlelerle otomatik olarak yüklenir.
- **Aralıklı Tekrar (SM-2 Esinli) Öğrenme ve Tekrar:** Günlük yeni kelime ve tekrar hedefleriyle öğrenme akışı, kart üzerinden doğrudan **Favorilere ekleme**, tam **klavye kısayolları** ve Ayarlar'dan açılabilen **otomatik telaffuz** (`autoSpeak`).
- **8 Quiz Türü ve 5 Kelime Havuzu Filtresi:**
  - **Türler:** İngilizce → Türkçe (seçmeli / yazılı), Türkçe → İngilizce (seçmeli / yazılı), cümlede boşluk doldurma, cümle tamamlama, dinleme (Web Speech API) ve karma pratik.
  - **Kelime Havuzları:** `Tüm kelimeler`, `Öğreniliyor`, `Tekrar zamanı gelenler`, `Favorilerim` ve `Zorlandıklarım`. Az sayıda kelime içeren havuzlarda bile çoktan seçmeli şıklar aynı CEFR seviyesinden anlam çakışması olmadan oluşturulur.
- **Kelime Gezgini, Favoriler ve Gerçek İstatistikler:** CEFR seviyesi, sözcük türü ve öğrenme durumuna göre arama/filtreleme; 90 günlük çalışma takvimi, grafikler ve yalnızca gerçek çalışma/quiz kayıtlarından hesaplanan ilerleme metrikleri.
- **Yerel Kalıcılık ve Güvenli Yedekleme:** Tüm veriler tarayıcının IndexedDB deposunda tutulur. **Ayarlar → Yedekler** üzerinden JSON dışa aktarabilir, şema doğrulamalı geri yükleme yapabilir veya kendi PDF / JSON kelime listeni içe aktarabilirsin.
- **PWA ve Tema Desteği:** Masaüstü ve mobil tarayıcılardan uygulama olarak yüklenebilir (`manifest.webmanifest`), açık/koyu/sistem temasını destekler.

---

## Klavye Kısayolları (Öğrenme & Tekrar Kartları)

| Tuş | İşlev |
| :--- | :--- |
| `Space` / `Enter` | Anlamı göster; değerlendirme kaydedildikten sonra sonraki kelimeye geç |
| `1` / `2` / `3` | Anlam açıkken sırasıyla **Tekrar et**, **Zorlandım**, **Hatırladım** olarak değerlendir |
| `F` | Kelimeyi favorilere ekle / çıkar |
| `S` veya `R` | İngilizce telaffuzu seslendir |
| `H` | Anlam kapalıyken İngilizce cümle ipucunu aç / kapat |

---

## Teknoloji Yığını

| Katman | Teknoloji |
| :--- | :--- |
| Çatı & Arayüz | Next.js 16 (App Router), React 19, TypeScript 5 |
| Tasarım & Bileşenler | Tailwind CSS 4, shadcn/ui, Radix UI, Lucide Icons, Sonner |
| Yerel Veritabanı & Doğrulama | Dexie (IndexedDB), Zod |
| Grafikler & PDF | Recharts, `pdfjs-dist` |
| Test | Vitest (birim testleri), Playwright (E2E testleri) |

---

## Hızlı Başlangıç

Node.js 24 ile doğrulandı. Herhangi bir `.env` dosyası, API anahtarı veya veritabanı kurulumu gerekmez:

```bash
git clone https://github.com/emrahsahn/learning-english.git
cd learning-english
npm ci
npm run dev
```

Tarayıcıda terminalde gösterilen adresi (varsayılan `http://localhost:3000`) aç. Uygulama ilk açılışta entegre 2.980 kelimeyi tarayıcına otomatik olarak yükler.

---

## Vercel ile Tek Tıkla Yayınlama

Uygulama tamamen istemci ve standart Next.js App Router akışıyla çalışır; hiçbir ortam değişkeni veya harici servis gerektirmez:

1. [Vercel New Project](https://vercel.com/new) üzerinden GitHub reposunu içe aktar.
2. Framework Preset olarak **Next.js** ve Root Directory olarak proje kökünü bırak.
3. Varsayılan `npm ci` ve `npm run build` komutlarıyla **Deploy** butonuna bas.

---

## Kalıcılık ve Yedekleme

İlerleme, kelimeler, favoriler, quiz cevapları, çalışma geçmişi ve tercihler **IndexedDB** içinde saklanır. Büyük veri için `localStorage` kullanılmaz; yalnızca tema tercihi `next-themes` tarafından tutulur.

Veri **cihaz + tarayıcı profili + site adresine** özeldir. Cihaz veya tarayıcı değiştirmek istediğinde **Ayarlar → Yedekler → JSON dışa aktar** ile tüm verini tek dosyada indirebilir, yeni ortamda **Tam yedek JSON dosyası seç** üzerinden geri yükleyebilirsin. Bozuk, yinelenen veya tutarsız yedek dosyaları işlem başlamadan reddedilir.

---

## Proje Yapısı

```text
src/
├── app/
│   ├── (workspace)/      Dashboard, öğrenme, tekrar, pratik, gezgin, favoriler, istatistik, ayarlar
│   ├── icon.svg          Uygulama ve PWA vektör ikonu
│   ├── layout.tsx        Kök düzen, fontlar, tema ve PWA viewport/metadata ayarları
│   └── manifest.ts       Web App Manifest tanımı
├── components/           UI, uygulama kabuğu, öğrenme kartları, quiz, istatistik ve ayarlar
├── lib/
│   ├── learning/         SM-2 esinli zamanlama, günlük oturumlar, gerçek istatistikler
│   ├── quiz/             Soru üretimi, kelime havuzu filtreleri, seçenek kontrolü ve puanlama
│   ├── storage/          Repository arayüzü, Dexie/IndexedDB adaptörü ve Zod şemaları
│   └── vocabulary/       Entegre Oxford 3000 yükleyici, PDF/JSON içe aktarma ve sözlük eşleştirme
└── types/                Kelime, ilerleme, quiz, ayar ve yedek tipleri
public/data/              Entegre Oxford 3000 veri seti, lisanslı sözlükler ve özgün örnekler
scripts/                  PDF denetimi, sözlük dönüştürücüleri ve asset hazırlama betikleri
tests/                    Vitest birim testleri ve Playwright E2E testleri
```

---

## Test ve Doğrulama Komutları

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Uçtan uca (E2E) tarayıcı testleri:

```bash
npx playwright install chromium
npm run test:e2e
```

---

## Veri Kaynakları ve Lisans Atıfları

Entegre `public/data/oxford-3000-words.json` dosyası, Amerikan Oxford 3000 kapsamında **2.980 benzersiz kelime** içerir. Seslendirme için tarayıcının yerleşik metin-konuşma (Web Speech API) özelliği kullanılır; cihazda İngilizce ses paketi gerektirebilir.

- **[FreeDict eng-tur 0.3](https://download.freedict.org/dictionaries/eng-tur/0.3/):** Genel İngilizce–Türkçe sözlük (**GPL-2.0-or-later**). Mehmet Ali Vardar/gtksozluk2, Michael Bunk ve FreeDict katkıcıları. Kaynak arşivi, lisans metni (`public/data/LICENSE-GPL-2.0.txt`) ve dönüştürücü `public/data/` altında yer alır.
- **[Wiktionary](https://en.wiktionary.org/wiki/Wiktionary:Copyrights), [Kaikki](https://kaikki.org/dictionary/English/) ve Wiktextract:** Kısa anlam ve IPA verileri (**CC BY-SA 4.0**, `public/data/LICENSE-CC-BY-SA-4.0.txt`); kelime başına kaynak atıfları korunur.
- **Özgün Türkçe Anlamlar ve Örnek Cümleler:** **CC0 1.0** olarak sağlanır. Oxford University Press'in resmî Türkçe çevirileri değildir; bu projenin Oxford University Press ile herhangi bir bağlantısı veya onayı yoktur.
