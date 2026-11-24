# Lexi — Oxford 3000

Türkçe arayüzlü, açık kaynaklı ve yerel öncelikli (local-first) İngilizce kelime öğrenme uygulaması. Next.js App Router, TypeScript, React, Tailwind CSS, shadcn/ui, Lucide, Recharts ve Dexie/IndexedDB ile geliştirilmiştir. Üyelik, şifre kapısı veya harici veritabanı gerektirmez; tarayıcıda doğrudan açılır.

## Öne çıkan özellikler

- **Hazır Amerikan Oxford 3000 kelime seti:** İlk açılışta `public/data/oxford-3000-words.json` içindeki **2.980 kelimelik** entegre Amerikan Oxford 3000 veri seti, çoklu Türkçe anlamlar, IPA telaffuzları ve özgün İngilizce/Türkçe örnek cümlelerle otomatik olarak yüklenir.
- **Aralıklı tekrar (SM-2 esinli) öğrenme akışı:** Öğrenme kartlarında anlamı açma, kendini değerlendirme, kart üzerinden favorilere ekleme, klavye kısayolları ve isteğe bağlı otomatik telaffuz (auto-pronunciation) desteği bulunur.
- **Esnek pratik ve quiz havuzları:** Seçmeli, yazılı, cümle tamamlama, dinleme ve karma quiz modları sunulur. Quizlerde çalışılacak kelime havuzunu filtreleyebilir (ör. seviye, favoriler, çalışılanlar) ve her cevabı atomik olarak kaydedebilirsin.
- **Kendi kelime listeni içe aktarma:** Ayarlar bölümünden kendi PDF veya doğrulanmış JSON kelime listeni önizleyerek kütüphanene aktarabilirsin.
- **PWA (kurulabilir uygulama) desteği:** Mobil ve masaüstü tarayıcılardan ana ekrana/uygulama olarak kurulabilir.
- **Gerçek geçmişe dayalı istatistikler ve yerel kalıcılık:** Dashboard ve İstatistikler yalnızca gerçek öğrenme ve quiz geçmişinden hesaplanır; tüm veriler tarayıcının IndexedDB deposunda saklanır ve JSON olarak yedeklenip geri yüklenebilir.

## Yerelde çalıştır

Node.js 24 ile doğrulandı. Herhangi bir `.env` dosyası veya ortam değişkeni gerekmez:

```bash
npm ci
npm run dev
```

Terminalde gösterilen adresi (varsayılan olarak `http://localhost:3000`) aç. Şifre veya giriş ekranı olmadan doğrudan çalışma alanı yüklenir.

## İlk çalışma

1. Uygulamayı ilk kez açtığında entegre 2.980 kelimelik Amerikan Oxford 3000 veri seti otomatik olarak IndexedDB'ye yüklenir; ek bir kurulum gerekmez.
2. İstersen **Ayarlar → Kelime listesi** bölümünden kendi PDF (ör. resmî Oxford 3000 PDF'si) veya JSON kelime dosyanı seçip önizleyerek içe aktarabilirsin. Önizleme verileri hemen kaydetmez; kaydetme işlemini ayrıca onaylarsın.
3. **Öğren** sayfasında kartları klavye kısayollarıyla veya ekrandan yönetebilir, kelimeleri doğrudan kart üzerinden favorilere ekleyebilir ve Ayarlar'dan otomatik telaffuzu açabilirsin. Her değerlendirme bir sonraki tekrar tarihini hesaplar. Varsayılan günlük hedef (10 yeni kelime ve 15 tekrar) Ayarlar'dan değiştirilebilir.
4. **Pratik** sayfasında seçmeli, yazılı, cümle, dinleme veya karma quiz başlatabilir; kelime havuzu filtreleriyle yalnızca belirli bir alt kümeyle çalışabilirsin. Her cevap ayrı ve atomik olarak saklanır.
5. **Dashboard** ve **İstatistikler** gerçek geçmişten hesaplanır. Bir kelimeye bakmak veya favorilemek onu öğrenilmiş yapmaz; öğrenilmiş sayılması tekrarlı başarılı hatırlama gerektirir.

## Veri seti ve açık kaynak lisans atıfları

Entegre `public/data/oxford-3000-words.json` dosyası, Amerikan Oxford 3000 kapsamında **2.980 benzersiz kelime** içerir. Her kayıt; CEFR seviyesi, sözcük türü, çoklu Türkçe anlamlar, IPA telaffuzu ve özgün örnek cümle/çeviri yapısını destekler. Tarayıcı metin-konuşma (Web Speech API) özelliği seslendirme için kullanılır; cihazda İngilizce ses paketi gerektirebilir.

Çeviri, sözlük ve zenginleştirme kaynakları:

- [FreeDict eng-tur 0.3](https://download.freedict.org/dictionaries/eng-tur/0.3/): Genel İngilizce–Türkçe sözlük, **GPL-2.0-or-later** lisansı. Mehmet Ali Vardar/gtksozluk2, Michael Bunk ve FreeDict katkıcıları. Kaynak arşivi, lisans dosyası (`public/data/LICENSE-GPL-2.0.txt`) ve dönüştürücü `public/data/` altında sağlanır.
- [Wiktionary](https://en.wiktionary.org/wiki/Wiktionary:Copyrights), [Kaikki](https://kaikki.org/dictionary/English/) ve Wiktextract: Kısa anlam ve IPA verileri **CC BY-SA 4.0** lisansı (`public/data/LICENSE-CC-BY-SA-4.0.txt`); kelime başına atıflar ve lisans bilgisi korunur.
- Özgün Türkçe çoklu anlamlar ve örnek cümleler **CC0 1.0** olarak sağlanır; Oxford University Press'in resmî Türkçe çevirileri değildir ve OUP ile bağlantı veya onay yoktur.

## Kalıcılık ve yedekleme

İlerleme, kelimeler, favoriler, quiz cevapları, çalışma geçmişi ve tercihler **IndexedDB** içinde saklanır. Büyük veri için `localStorage` kullanılmaz; yalnızca tema tercihi `next-themes` tarafından orada tutulabilir.

Veri **cihaz + tarayıcı profili + site adresine** özeldir. Yerel önizleme, Vercel adresi ve özel alan adı ayrı tarayıcı depoları kullanır. Tarayıcı/site verisini temizlemek, profili silmek veya özel sekme kullanmak ilerlemeyi sıfırlayabilir. "Kalıcı depolama iste" yardımcı olur ama yedek yerine geçmez.

**Ayarlar → Yedekler → JSON dışa aktar** tüm kelime kütüphanesini ve çalışma geçmişini tek bir JSON dosyasında indirir. Yeni cihazda veya farklı bir adreste aynı JSON dosyasını seçip doğrulamayı kontrol ederek geri yükleyebilirsin. Geri yükleme mevcut tarayıcı verilerini değiştirir; bozuk, yinelenen veya eksik referanslı dosyalar işlem başlamadan reddedilir.

## GitHub ve Vercel yayını

Uygulama tamamen istemci/Next.js statik-dinamik standart akışıyla çalışır; herhangi bir `.env` dosyası, `SITE_PASSWORD`, Supabase veya harici API anahtarı gerekmez.

1. Depoyu GitHub'a yükle (`.gitignore` kurallarıyla `private-data`, `.env.local`, `node_modules`, `.next` ve test çıktıları dışarıda tutulur).
2. [Vercel New Project](https://vercel.com/new) üzerinden GitHub reposunu içe aktar.
3. Framework Preset olarak **Next.js** ve Root Directory olarak proje kökünü seç. Varsayılan `npm ci` ve `npm run build` komutları uygundur; build adımı PDF worker dosyasını kurulu bağımlılıktan otomatik hazırlar.
4. Ortam değişkeni eklemeden **Deploy** butonuna bas.

## Mimari

```text
src/app/(workspace)/      Dashboard, öğrenme, tekrar, pratik, gezgin, favoriler, istatistik, ayarlar
src/components/           UI, uygulama kabuğu ve öğrenme bileşenleri
src/types/                Kelime, ilerleme, quiz, ayar ve yedek tipleri
src/lib/learning/         SM-2 esinli zamanlama, günlük oturumlar, gerçek istatistikler
src/lib/quiz/             Soru üretimi, kelime havuzu filtreleri, seçenek kontrolü ve doğrulama
src/lib/storage/          Repository arayüzü, Dexie/IndexedDB adaptörü, doğrulama ve atomik işlemler
src/lib/vocabulary/       Entegre Oxford 3000 yükleyici, PDF/JSON içe aktarma ve sözlük eşleştirme
public/data/              Entegre Oxford 3000 veri seti, lisanslı sözlükler ve özgün örnekler
scripts/                  PDF denetimi, sözlük dönüştürücüleri ve asset hazırlama betikleri
```

Repository arayüzü ileride isteğe bağlı olarak bir uzak veritabanı adaptörüyle değiştirilebilecek şekilde ayrıştırılmıştır; mevcut uygulama sunucusuz, tamamen yerel tarayıcı deposuyla çalışır.

## Doğrulama komutları

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm audit --omit=dev
```

Gerçek tarayıcı uçtan uca (E2E) testleri:

```bash
npx playwright install chromium
npm run test:e2e
```
