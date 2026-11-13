# Lexi — Oxford 3000

Türkçe arayüzlü, tek kişilik İngilizce kelime öğrenme uygulaması. Next.js App Router, TypeScript, React, Tailwind CSS, shadcn/ui, Lucide, Recharts ve Dexie/IndexedDB kullanır. Üyelik, ödeme veya çok kullanıcılı sistem yoktur.

## Yerelde aç

Node.js 24 ile doğrulandı. Proje klasöründe:

```bash
npm ci
npm run dev
```

Terminalde gösterilen adresi aç. Normalde `http://localhost:3000`; bu çalışma sırasında 3000 başka bir uygulama tarafından kullanıldığı için önizleme `http://localhost:3001` adresinde çalışıyor.

Geliştirmede SITE_PASSWORD tanımlanmadıysa doğrudan önizleme açılır. Şifre kapısını yerelde de kullanmak için `.env.example` dosyasını `.env.local` adıyla kopyala, SITE_PASSWORD değerine uzun ve benzersiz bir şifre yaz, sunucuyu yeniden başlat. Şifreyi NEXT_PUBLIC_ önekli bir değişkene koyma.

## İlk çalışma

1. Ayarlar → Kelime listesi bölümüne git. Resmî [The_Oxford_3000.pdf](https://www.oxfordlearnersdictionaries.com/external/pdf/wordlists/oxford-3000-5000/The_Oxford_3000.pdf) dosyasını indir. Yerel kişisel kopya `private-data/The_Oxford_3000.pdf` içinde de bulunabilir; bu klasör Git ve dağıtım dışında tutulur.
2. PDF'yi seç. SHA-256 kaynak denetimini, satır sayısını ve anlam/IPA/örnek kapsamını önizle. Önizleme verileri kaydetmez; listeyi kaydet düğmesini ayrıca onayla.
3. Öğren sayfasında anlamı aç ve kendini değerlendir. Her kayıt tekrar tarihini hesaplar. Varsayılan hedef 10 yeni kelime ve 15 tekrar; Ayarlar'dan değiştirilebilir.
4. Pratik sayfasında seçmeli, yazılı, cümle, dinleme veya karma quiz seç. Her cevap ayrı ve atomik olarak saklanır. Cümle türleri yalnızca gerçekten örneği bulunan kelimeleri kullanır.
5. Dashboard ve İstatistikler gerçek geçmişten hesaplanır. Bir kelimeye bakmak veya favorilemek onu öğrenilmiş yapmaz; öğrenilmiş sayılması tekrarlı başarılı hatırlama gerektirir.

## Veri sayısı ve kaynaklar

“Oxford 3000” liste adıdır. Denetlenen resmî 11 sayfalık PDF 3.004 basılı başlık satırı içerir. Aynı yazımlı başlıklar ve anlam açıklamaları birleştirildiğinde, a/an gibi basılı varyantlar ayrıldığında **2.981 benzersiz yazım** kalır. Eksik sayıyı tamamlamak için kelime üretilmez. Bir başlığın birden fazla CEFR etiketi varsa en düşük seviye gösterilir; sözcük türleri korunur. Bu temsil için dağılım A1: 900, A2: 793, B1: 690, B2: 598. Tamamlanma oranının paydası içe aktardığın gerçek listedir.

Doğrulanan PDF SHA-256:

```text
61a2201c44b390ec579365b4ca805f6ab536bd7b2cb61c78bc599d43b5958112
```

Farklı PDF sürümleri sessizce doğrulanmış kabul edilmez. Resmî dosya değişirse parser ve kaynak kontrolünün yeniden denetlenmesi gerekir. Kendi doğrulanmış kelime JSON dizin de içe aktarılabilir; bu dosyalar otomatik olarak “resmî Oxford” etiketi almaz.

Mevcut eşleştirmede 2.981 başlığın tamamında Türkçe karşılık, 2.971'inde kaynaklı IPA ve 103'ünde özgün İngilizce/Türkçe örnek bulunur. Anlamlar bağımsız dil uzmanı tarafından tek tek denetlenmiş değildir. Eksik IPA, örnek, eş/zıt anlam veya ses kaydı uydurulmaz. Ses kaydı yoksa tarayıcının İngilizce metin-konuşma sesi kullanılır; cihazda İngilizce ses paketi gerektirebilir.

Oxford başlık/CEFR verisi yayımlanan uygulama paketinde bulunmaz; kullanıcının PDF'sinden kendi tarayıcısına aktarılır. Özel repo ve site şifresi yeniden dağıtım izni anlamına gelmez. OUP ile bağlantı veya onay yoktur. Oxford içeriğini taşıyan kişisel yedekleri yayımlama.

Çeviri ve zenginleştirme kaynakları:

- [FreeDict eng-tur 0.3](https://download.freedict.org/dictionaries/eng-tur/0.3/): genel İngilizce–Türkçe sözlük, GPL-2.0-or-later. Mehmet Ali Vardar/gtksozluk2, Michael Bunk ve FreeDict katkıcıları. Kaynak arşivi, lisans ve JSON dönüştürücü `public/data/` altında sağlanır.
- [Wiktionary](https://en.wiktionary.org/wiki/Wiktionary:Copyrights), [Kaikki](https://kaikki.org/dictionary/English/) ve Wiktextract: kısa anlam/IPA verileri CC BY-SA 4.0; kelime başına atıflar ve lisans korunur. Ses medyası veya dış eserlerden alıntılar kopyalanmaz.
- Özgün Türkçe kısa karşılıklar ve 103 kısa öğrenme örneği CC0 1.0 olarak ayrı dosyalardadır. Oxford'un resmî Türkçe çevirileri değildir.

## Kalıcılık ve yedek

İlerleme, kelimeler, favoriler, quiz cevapları, geçmiş ve tercihler **IndexedDB** içinde saklanır. Büyük veri için localStorage kullanılmaz; yalnızca tema tercihi next-themes tarafından orada tutulabilir.

Veri **cihaz + tarayıcı profili + site adresine** özeldir. Yerel önizleme, Vercel adresi ve özel alan adı farklı depolardır. Tarayıcı/site verisini temizlemek, profil kaybetmek veya özel sekme kullanmak ilerlemeyi kaybettirebilir. “Kalıcı depolama iste” yardımcı olur ama yedek değildir.

Ayarlar → Yedekler → JSON dışa aktar tüm kelime ve geçmişi içerir. Yeni cihazda veya Vercel adresinde aynı JSON'u seç, doğrulamayı kontrol et ve geri yüklemeyi onayla. Geri yükleme mevcut tarayıcı verilerini değiştirir; önce mevcut veriyi yedekle. Bozuk/yinelenen/eksik referanslı dosyalar işlem başlamadan reddedilir. Yedekler şifreli değildir; özel tut.

## Manuel GitHub → Vercel yayını

Scaffold kurulum aracı yerel Git deposunu bir başlangıç commit'iyle oluşturdu. Yeni uygulama özellikleri henüz commitlenmedi; push veya bulut yayını yapılmadı. Bu adımlar senin manuel kontrolünde.

1. GitHub'da **private** bir repository oluştur. GitHub Desktop veya kendi Git araçlarınla bu proje klasörünü yükle. `.gitignore` kurallarını koru: `private-data`, `.env.local`, `node_modules`, `.next` ve test çıktıları yüklenmemeli. `.env.example` boş örnek olarak yüklenebilir. Kişisel yedeklerini repository'ye koyma.
2. [Vercel New Project](https://vercel.com/new) üzerinden GitHub reposunu içe aktar. Framework Preset **Next.js**, Root Directory proje kökü. Varsayılan `npm ci` / `npm run build` akışı uygundur; `prebuild` benzeri elle PDF indirme veya sözlük üretme gerekmez. Build scripti PDF worker'ını kurulu bağımlılıktan hazırlar.
3. Environment Variables kısmına **SITE_PASSWORD** ekle. En az 16 karakterlik benzersiz bir şifre kullan. Production ve gerekiyorsa Preview ortamlarını seç. Secret'ı koda veya NEXT_PUBLIC_ değişkenine yazma. Sonradan değiştirirsen yeniden deploy et.
4. Deploy'a bas. Şifre eksikse üretim sitesi kapalı kalır. Giriş denemeleri için uygulama içi sınır yalnızca sunucu örneği bazlıdır; güçlü şifre kullan ve gerekirse Vercel Firewall'dan `/api/unlock` yoluna hız sınırı ekle.
5. Canlı adresi aç: önce şifre kapısını kontrol et, PDF'yi içe aktar veya yerel JSON yedeğini geri yükle. Bir kelime çalış, favorile, quiz çöz, sekmeyi kapatıp yeniden aç ve kayıtların durduğunu doğrula. İkinci cihazda senkronizasyon bekleme; JSON yedeği ile taşı.

Supabase veya ek API anahtarı gerekmez. Sunucu çalışma anında kalıcı dosya sistemi kullanmaz. Şifre kapısı, sunucuda imzalanmış süreli HttpOnly çerez kullanır; kullanıcı hesabı değildir.

## Mimari

```text
src/app/(workspace)/      Dashboard, öğrenme, tekrar, pratik, gezgin, favoriler, istatistik, ayarlar
src/components/          UI, uygulama kabuğu ve öğrenme bileşenleri
src/types/               Kelime, ilerleme, quiz, ayar ve yedek tipleri
src/lib/learning/        SM-2 esinli zamanlama, günlük oturumlar, gerçek istatistikler
src/lib/quiz/            Soru üretimi, bağlam, seçenek kontrolü ve cevap doğrulama
src/lib/storage/         Repository arayüzü, Dexie adaptörü, doğrulama ve atomik işlemler
src/lib/vocabulary/      Kaynak doğrulama, PDF/JSON içe aktarma ve sözlük eşleştirme
src/proxy.ts             Site erişim kapısı
src/app/api/             Giriş/çıkış; service-role veya kullanıcı sistemi yok
public/data/             Ayrı, lisanslı sözlük ve özgün örnek verileri
private-data/            Kişisel Oxford kaynağı/testler; Git ve dağıtım dışında
scripts/                 PDF denetimi, sözlük dönüştürücüleri ve erişim testi
```

Repository arayüzü daha sonra uzak veritabanı adaptörüyle değiştirilebilir. Böyle bir geçişte cihazlar arası erişim ve güvenlik ayrıca tasarlanmalıdır; mevcut uygulama bulut senkronizasyonu iddia etmez.

## Kontroller

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm audit --omit=dev
node scripts/check-access.mjs
```

Erişim testi, üretim derlemesinden sonra 3002/3003 portlarında geçici test sunucuları açar; test şifresi gerçek kullanıcı secret'ı değildir. Test sonunda bu sunucular kapatılır.

Gerçek tarayıcı testleri:

```bash
npx playwright install chromium
OXFORD_E2E_PDF="$PWD/private-data/The_Oxford_3000.pdf" npm run test:e2e
```

İkinci komut Git Bash içindir. `OXFORD_E2E_PDF` değişkenine kendi indirdiğin resmî PDF'nin tam yolunu ver; dosya test paketinde dağıtılmaz. E2E yapılandırması `http://localhost:3001` adresini kullanır; sunucu açık değilse bu portta otomatik başlatır. Böylece 3000 portundaki başka bir uygulamaya yanlışlıkla bağlanılmaz. Test fixture'ları canlı uygulamaya örnek ilerleme eklemez; ayrı tarayıcı bağlamları kullanılır. Tam kütüphaneyle karma quiz açılışı/başlatma, tanımlık anlamları ve mobil/koyu görünüm de denetlenir.

Son yerel doğrulamada lint, TypeScript, 58 birim testi, üretim derlemesi ve üretim şifre kapısı kontrolleri geçti. Gerçek IndexedDB kullanan 13 Chromium uçtan uca testinin tamamı geçti; atlanan veya yeniden deneyerek geçen test yok. PDF önizleme/kaydetme, öğrenme kayıtları ve çift tıklama koruması, favoriler, doğru/yanlış quiz cevapları, yedek geri yükleme ve bozuk yedek reddi, tercihler, gerçek istatistikler ve 390 px mobil/koyu görünüm denetlendi. Bu koşuda tam kütüphaneyle Pratik sayfası yaklaşık 1,95 saniyede açıldı ve karma quiz yaklaşık 1,13 saniyede başladı; süreler cihaz ve bağlantıya göre değişir. Çalışma zamanı, hydration veya geçersiz grafik boyutu hatası yakalanmadı. Vercel'de canlı yayın henüz yapılmadığı için canlı ortam kontrolü manuel yayın sonrasına aittir.
