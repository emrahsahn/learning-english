import { Scale } from "lucide-react";
import { SectionHeading, SourceLink } from "./shared";

export function SourcesSection() {
  return <section id="sources" className="surface min-w-0 scroll-mt-24 p-5 sm:p-7" aria-labelledby="sources-title">
    <SectionHeading id="sources-title" icon={Scale} eyebrow="05 · Kaynaklar & haklar" title="Kaynağı açık, sınırları net." description="Kelime listesinin, çevirilerin ve örneklerin kaynakları farklıdır. Açık lisanslı bir sözlük, Oxford listesinin yeniden dağıtımına izin vermez." />
    <div className="grid min-w-0 gap-5 sm:grid-cols-2">
      <div className="min-w-0 space-y-3 rounded-2xl border bg-background/50 p-4 sm:p-5">
        <h3 className="text-sm font-medium">Oxford University Press</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">Oxford 3000 ve CEFR bilgileri resmî PDF’den, kullanıcının kendi dosyasıyla okunur. Telifli liste uygulamada paketlenmez. OUP ile bağlantımız, ortaklığımız veya onayımız yoktur; özel erişim telif/lisans izni anlamına gelmez.</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2"><SourceLink href="https://www.oxfordlearnersdictionaries.com/wordlists/oxford3000-5000">Resmî Oxford kelime listeleri</SourceLink><SourceLink href="https://global.oup.com/terms/">OUP kullanım koşulları</SourceLink></div>
      </div>
      <div className="min-w-0 space-y-3 rounded-2xl border bg-background/50 p-4 sm:p-5">
        <h3 className="text-sm font-medium">FreeDict eng–tur 0.3 <span className="mt-1 block text-[10px] font-normal text-muted-foreground">GPL-2.0-or-later · GPL v2 veya sonrası</span></h3>
        <p className="text-xs leading-relaxed text-muted-foreground">Genel İngilizce–Türkçe sözlük; kaynak gtksozluk2 / FreeDict. Mehmet Ali Vardar, Michael Bunk ve FreeDict katkıcıları. TEI kaynağı normalize edilmiş JSON başlık/çeviri dizinine dönüştürülür; Oxford üyeliği veya CEFR etiketi içermez. Çeviriler tek tek insan denetiminden geçmiş değildir.</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2"><SourceLink href="https://download.freedict.org/dictionaries/eng-tur/0.3/">FreeDict resmî kaynak</SourceLink><SourceLink href="https://www.gnu.org/licenses/old-licenses/gpl-2.0.html">GPL v2 lisans metni</SourceLink><SourceLink href="/data/LICENSE-GPL-2.0.txt" download>Yerel lisans metnini indir</SourceLink><SourceLink href="/data/freedict-eng-tur-0.3.src.tar.xz" download>Karşılık gelen kaynak arşivini indir</SourceLink><SourceLink href="/data/build-dictionary.mjs" download>Dönüştürücü kaynak kodunu indir</SourceLink></div>
      </div>
      <div className="min-w-0 space-y-3 rounded-2xl border bg-background/50 p-4 sm:p-5">
        <h3 className="text-sm font-medium">Özgün çoklu anlamlar ve örnek cümleler <span className="mt-1 block text-[10px] font-normal text-muted-foreground">CC0 1.0</span></h3>
        <p className="text-xs leading-relaxed text-muted-foreground">Kelime başına birden fazla Türkçe anlam, tür bilgisi, özgün İngilizce örnek cümle ve Türkçe çevirileri bu proje için sıfırdan CC0 ile hazırlanmıştır. Oxford’dan kopyalanmış cümle içermez.</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2"><SourceLink href="https://creativecommons.org/publicdomain/zero/1.0/">CC0 açıklaması</SourceLink><SourceLink href="https://creativecommons.org/publicdomain/zero/1.0/legalcode">CC0 lisans metni</SourceLink></div>
      </div>
      <div className="min-w-0 space-y-3 rounded-2xl border bg-background/50 p-4 sm:p-5">
        <h3 className="text-sm font-medium">Wiktionary zenginleştirmesi <span className="mt-1 block text-[10px] font-normal text-muted-foreground">CC BY-SA 4.0</span></h3>
        <p className="text-xs leading-relaxed text-muted-foreground">Wiktionary katkıcıları, Kaikki ve Wiktextract kaynaklarından sözcük türüne göre kısa Türkçe karşılıklar ve IPA eşleştirilir. Oxford seviyeleri bu sözlükte bulunmaz. Kelime başına kaynak bağlantıları korunur; örnek alıntılar veya ses kayıtları kopyalanmaz. Anlam kapsamı FreeDict ve özgün Türkçe karşılıklarla tamamlanır; bağımsız uzman denetimi yapılmamıştır.</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2"><SourceLink href="https://en.wiktionary.org/wiki/Wiktionary:Copyrights">Wiktionary telif politikası</SourceLink><SourceLink href="https://kaikki.org/dictionary/English/">Kaikki / Wiktextract</SourceLink><SourceLink href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</SourceLink><SourceLink href="/data/LICENSE-CC-BY-SA-4.0.txt" download>Yerel lisans metnini indir</SourceLink><SourceLink href="/data/build-wiktionary.mjs" download>Dönüştürücü kaynak kodu</SourceLink></div>
      </div>
    </div>
    <p className="mt-5 border-t pt-4 text-[11px] leading-relaxed text-muted-foreground">Kendi dosyanı içe aktarmak veya kişisel yedek oluşturmak yayınlama hakkı vermez. Özellikle Oxford içeriğini taşıyan yedekleri herkese açık depolara, sitelere veya paylaşım bağlantılarına yükleme.</p>
  </section>;
}
