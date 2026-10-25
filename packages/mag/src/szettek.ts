/**
 * Gépészeti szettek – a leggyakoribb hazai lakóépületi rendszerkombinációk a 9/2023 ÉKM számítási módszer
 * 8–9. fejezetének egyszerűsített (ErP hatályán kívüli, táblázati) értékeivel. A szett csak a választásokat rögzíti;
 * minden szám a táblázatokból jön a projekt rendszer-alapterületére interpolálva. Ha a tényleges berendezés ErP
 * adatlappal rendelkezik, a hőtermelőt 'kazan_erp' / 'hoszivattyu_erp' típusra kell váltani (8.3.1.1, 8.3.2.1).
 */
import { szabalyozasiTenyezo, type FutesiAlrendszer, type HmvRendszer, type SzellozesRendszer, type HutesRendszer } from './rendszerek.js';
import * as T from './tablak/gepeszet.js';

type SzabValasztas = Parameters<typeof szabalyozasiTenyezo>[0];

export interface FutesSablon extends Omit<FutesiAlrendszer, 'nev' | 'Arszr' | 'epszilonSzab'> {
  /** Vizes rendszer: a 8.10.–8.12. táblázat választásai; egyéb: közvetlen εF,szab (8.13./8.14.). */
  szabalyozas: { valasztas: SzabValasztas } | { kozvetlen: number; forras: string };
}
export type HmvSablon = Omit<HmvRendszer, 'nev' | 'Arszr' | 'AN' | 'qHMV'>;

export interface GepeszetiSzett {
  kod: string;
  nev: string;
  leiras: string;
  /** A HMV-rész rövid neve (a fűtéstől külön választható). */
  hmvNev: string;
  futes: FutesSablon;
  hmv: HmvSablon;
  jellemzoEpuletek: string[];
  forras: string;
  futesKod?: string;
  hmvKod?: string;
}

const F = '9/2023 ÉKM számítási módszer, 1. függelék 8–9. fejezet táblázatai (egyszerűsített módszer)';

// ---------------------------------------------------------------------------------------------
// Részrendszerenkénti szettek: a fűtés, a HMV, a szellőzés és a hűtés egymástól függetlenül választható.

export interface ReszSzett<T> { kod: string; nev: string; leiras: string; adat: T; jellemzoEpuletek: string[]; forras: string }

const radiator = (hofok: '90/70' | '70/55' | '55/45', helyiseg: 'termosztatikus' | 'kezi' | 'nincs', alap: SzabValasztas['alap'] = 'ref_helyiseg_pi'): SzabValasztas =>
  ({ alap, holeado: { tipus: 'szabad', hofok, hatarolo: 'kulsofali' }, helyiseg, beszabalyozas: { csovek: 'ketcsoves', mod: helyiseg === 'termosztatikus' ? 'statikus_csoportos_nelkul' : 'nincs', holeadokTobbMint10: false } } as SzabValasztas);
const padlo: SzabValasztas = { alap: 'ref_helyiseg_pi', holeado: { tipus: 'beagyazott', rendszer: 'padlo_nedves', hatarolo: 'min_szig' }, helyiseg: 'termosztatikus', beszabalyozas: { csovek: 'ketcsoves', mod: 'statikus_csoportos_dinamikus', holeadokTobbMint10: false } } as SzabValasztas;
const kondKazan = { tipus: 'kazan_tabla', kazan: 'kondenzacios', hely: 'belul', energiahordozo: 'fosszilis_gaz' } as const;

export const FUTES_SZETTEK: readonly ReszSzett<FutesSablon>[] = [
  { kod: 'gaz_kondenz_radiator', nev: 'Kondenzációs gázkazán + radiátor 55/45', leiras: 'Fűtött téren belüli kondenzációs kazán (kombi is), kétcsöves radiátoros fűtés termosztatikus szelepekkel, fordulatszám-szabályozott szivattyú.',
    adat: { hotermelo: kondKazan, szabalyozas: { valasztas: radiator('55/45', 'termosztatikus') }, elosztas: { hely: 'belul', elore: 55, vissza: 45 }, tarolo: null, szivattyu: 'fordulatszam_szabad_10K' }, jellemzoEpuletek: ['csaladi_haz', 'tarsashaz', 'felujitott'], forras: F },
  { kod: 'gaz_kondenz_padlo', nev: 'Kondenzációs gázkazán + padlófűtés 35/28', leiras: 'Kondenzációs kazán nedves fektetésű padlófűtéssel, helyiségenkénti termosztatikus zónaszelepekkel.',
    adat: { hotermelo: kondKazan, szabalyozas: { valasztas: padlo }, elosztas: { hely: 'belul', elore: 35, vissza: 28 }, tarolo: null, szivattyu: 'fordulatszam_beagyazott_7K' }, jellemzoEpuletek: ['uj_epulet', 'csaladi_haz'], forras: F },
  { kod: 'gaz_alacsony_radiator', nev: 'Alacsony hőmérsékletű gázkazán + radiátor 70/55', leiras: '1990–2010 között jellemző alacsony hőmérsékletű (nem kondenzációs) kazán, termosztatikus szelepek.',
    adat: { hotermelo: { tipus: 'kazan_tabla', kazan: 'alacsony', hely: 'belul', energiahordozo: 'fosszilis_gaz' }, szabalyozas: { valasztas: radiator('70/55', 'termosztatikus') }, elosztas: { hely: 'belul', elore: 70, vissza: 55 }, tarolo: null, szivattyu: 'allando_szabad_15K' }, jellemzoEpuletek: ['csaladi_haz', 'tarsashaz'], forras: F },
  { kod: 'gaz_hagyomanyos_regi', nev: 'Régi állandó hőmérsékletű gázkazán + radiátor 90/70', leiras: 'Meglévő épületek tipikus régi rendszere: állandó hőmérsékletű kazán, szabályozás nélküli radiátorok, beszabályozás nélkül, állandó fordulatú szivattyú.',
    adat: { hotermelo: { tipus: 'kazan_tabla', kazan: 'allando', hely: 'belul', energiahordozo: 'fosszilis_gaz' }, szabalyozas: { valasztas: radiator('90/70', 'nincs', 'nincs') }, elosztas: { hely: 'belul', elore: 90, vissza: 70 }, tarolo: null, szivattyu: 'allando_szabad_20K' }, jellemzoEpuletek: ['kockahaz', 'paraszthaz', 'polgari'], forras: F },
  { kod: 'hsz_levego_viz_padlo', nev: 'Levegő-víz hőszivattyú + padlófűtés 35/28', leiras: 'Levegő-víz hőszivattyú (táblázati εF), nedves fektetésű padlófűtés helyiségenkénti termosztatikus zónaszelepekkel. ErP adatlap esetén az adatlapos változat pontosabb.',
    adat: { hotermelo: { tipus: 'hoszivattyu_tabla', forras: 'levego_viz', hofok: '35/28' }, szabalyozas: { valasztas: padlo }, elosztas: { hely: 'belul', elore: 35, vissza: 28 }, tarolo: null, szivattyu: 'fordulatszam_beagyazott_7K' }, jellemzoEpuletek: ['uj_epulet', 'csaladi_haz'], forras: F },
  { kod: 'hsz_levego_viz_radiator', nev: 'Levegő-víz hőszivattyú + radiátor 55/45', leiras: 'Felújításoknál jellemző: meglévő radiátorok 55/45 °C-on, levegő-víz hőszivattyú (táblázati εF).',
    adat: { hotermelo: { tipus: 'hoszivattyu_tabla', forras: 'levego_viz', hofok: '55/45' }, szabalyozas: { valasztas: radiator('55/45', 'termosztatikus') }, elosztas: { hely: 'belul', elore: 55, vissza: 45 }, tarolo: null, szivattyu: 'fordulatszam_szabad_10K' }, jellemzoEpuletek: ['felujitott', 'csaladi_haz'], forras: F },
  { kod: 'hsz_talaj_viz_padlo', nev: 'Talajszondás (talaj-víz) hőszivattyú + padlófűtés 35/28', leiras: 'Talajhőt hasznosító hőszivattyú (táblázati εF), padlófűtés helyiségenkénti szabályozással.',
    adat: { hotermelo: { tipus: 'hoszivattyu_tabla', forras: 'talaj_viz', hofok: '35/28' }, szabalyozas: { valasztas: padlo }, elosztas: { hely: 'belul', elore: 35, vissza: 28 }, tarolo: null, szivattyu: 'fordulatszam_beagyazott_7K' }, jellemzoEpuletek: ['uj_epulet', 'csaladi_haz'], forras: F },
  { kod: 'hsz_levego_levego', nev: 'Levegő-levegő hőszivattyú (split klíma fűtésre)', leiras: 'Beltéri egységek közvetlen helyiséglevegő-fűtéssel. A szabályozási tényező a 8.14. táblázat léghevítés PI/PID sorával számolt (tervezői megfeleltetés).',
    adat: { hotermelo: { tipus: 'hoszivattyu_levego_levego' }, szabalyozas: { kozvetlen: T.SZAB_LEVEGO.legfutes_pi_pid, forras: '1. függ. 8.14. táblázat – léghevítés PI/PID szabályozással' }, elosztas: { hely: 'nincs', elore: 0, vissza: 0 }, tarolo: null, szivattyu: null }, jellemzoEpuletek: ['csaladi_haz', 'tarsashaz'], forras: F },
  { kod: 'tavho_panel_egycsoves', nev: 'Távhő + egycsöves radiátoros fűtés 90/70', leiras: 'Panelos lakótelepek nem felújított rendszere: távhő-hőközpont, egycsöves radiátoros fűtés, termosztatikus szelepek, elosztás a pincében (fűtött téren kívül).',
    adat: { hotermelo: { tipus: 'tavho', hokozpontokSzama: 1 }, szabalyozas: { valasztas: { alap: 'nincs', holeado: { tipus: 'szabad', hofok: '90/70', egycsoves: true, hatarolo: 'kulsofali' }, helyiseg: 'termosztatikus', beszabalyozas: { csovek: 'egycsoves', mod: 'statikus' } } as SzabValasztas }, elosztas: { hely: 'kivul', elore: 90, vissza: 70 }, tarolo: null, szivattyu: 'allando_szabad_20K' }, jellemzoEpuletek: ['panel'], forras: F },
  { kod: 'tavho_ketcsoves', nev: 'Távhő + kétcsöves radiátoros fűtés 70/55 (felújított)', leiras: 'Felújított panel vagy társasház: kétcsöves átalakítás, termosztatikus szelepek, beszabályozás, elosztás fűtött téren kívül.',
    adat: { hotermelo: { tipus: 'tavho', hokozpontokSzama: 1 }, szabalyozas: { valasztas: radiator('70/55', 'termosztatikus') }, elosztas: { hely: 'kivul', elore: 70, vissza: 55 }, tarolo: null, szivattyu: 'fordulatszam_szabad_10K' }, jellemzoEpuletek: ['panel', 'tarsashaz'], forras: F },
  { kod: 'tavho_padlo', nev: 'Távhő + padlófűtés 35/28', leiras: 'Távhő-hőközpont (vagy lakáshőközpont) keverőköre nedves fektetésű padlófűtéssel, helyiségenkénti termosztatikus zónaszelepekkel, fordulatszám-szabályozott szivattyúval. Elosztás fűtött téren belül – ha a vezetékek fűtetlen pincében futnak, állítsd „kívül”-re.',
    adat: { hotermelo: { tipus: 'tavho', hokozpontokSzama: 1 }, szabalyozas: { valasztas: padlo }, elosztas: { hely: 'belul', elore: 35, vissza: 28 }, tarolo: null, szivattyu: 'fordulatszam_beagyazott_7K' }, jellemzoEpuletek: ['uj_epulet', 'tarsashaz'], forras: F },
  { kod: 'gazkonvektor_kombinalt', nev: 'Hagyományos gázkonvektorok', leiras: 'Régi lakásokban gyakori: kombinált szabályozású hagyományos gázkonvektorok külső falnál.',
    adat: { hotermelo: { tipus: 'egyeb', kod: 'gazkonvektor_kombinalt' }, szabalyozas: { kozvetlen: T.SZAB_LEVEGO.gazkonvektor_termosztat_kulso, forras: '1. függ. 8.14. táblázat – gázkonvektor saját termosztatikus szabályozással, külső falnál' }, elosztas: { hely: 'nincs', elore: 0, vissza: 0 }, tarolo: null, szivattyu: null }, jellemzoEpuletek: ['tarsashaz', 'kockahaz', 'polgari'], forras: F },
  { kod: 'gazkonvektor_korszeru', nev: 'Korszerű külsőfali gázkonvektorok (≥ 93%)', leiras: 'Zárt égésterű, külsőfali gázkonvektorok magasabb rendű szabályozással.',
    adat: { hotermelo: { tipus: 'egyeb', kod: 'gazkonvektor_kulsofali_93' }, szabalyozas: { kozvetlen: T.SZAB_LEVEGO.gazkonvektor_magasabb_rendu_kulso, forras: '1. függ. 8.14. táblázat – gázkonvektor magasabb rendű szabályozással, külső falnál' }, elosztas: { hely: 'nincs', elore: 0, vissza: 0 }, tarolo: null, szivattyu: null }, jellemzoEpuletek: ['tarsashaz', 'polgari'], forras: F },
  { kod: 'tuzifa_kazan_radiator', nev: 'Tűzifa (hasábfa) kazán + radiátor 70/55', leiras: 'Vidéki családi házak: hasábfa tüzelésű kazán, kézi radiátorszelepek.',
    adat: { hotermelo: { tipus: 'szilard_kazan', kazan: 'tuzifa', energiahordozo: 'bio_szilard' }, szabalyozas: { valasztas: radiator('70/55', 'kezi', 'nincs') }, elosztas: { hely: 'belul', elore: 70, vissza: 55 }, tarolo: null, szivattyu: 'allando_szabad_15K' }, jellemzoEpuletek: ['kockahaz', 'paraszthaz', 'csaladi_haz'], forras: F },
  { kod: 'pellet_kazan_radiator', nev: 'Pelletkazán + radiátor 70/55', leiras: 'Automatikus adagolású pelletkazán, termosztatikus szelepek.',
    adat: { hotermelo: { tipus: 'szilard_kazan', kazan: 'pellet', energiahordozo: 'bio_szilard' }, szabalyozas: { valasztas: radiator('70/55', 'termosztatikus') }, elosztas: { hely: 'belul', elore: 70, vissza: 55 }, tarolo: null, szivattyu: 'fordulatszam_szabad_10K' }, jellemzoEpuletek: ['csaladi_haz'], forras: F },
  { kod: 'vegyes_kazan_radiator', nev: 'Vegyes tüzelésű kazán (szén/fa) + radiátor 90/70', leiras: 'Régi vegyes tüzelésű kazán, kézi szelepek, szabályozás nélkül. Az energiahordozó szénre van állítva; fánál bio szilárdra kell váltani.',
    adat: { hotermelo: { tipus: 'szilard_kazan', kazan: 'vegyes', energiahordozo: 'fosszilis_szilard' }, szabalyozas: { valasztas: radiator('90/70', 'kezi', 'nincs') }, elosztas: { hely: 'belul', elore: 90, vissza: 70 }, tarolo: null, szivattyu: 'allando_szabad_20K' }, jellemzoEpuletek: ['kockahaz', 'paraszthaz'], forras: F },
  { kod: 'cserepkalyha', nev: 'Fatüzelésű cserépkályha', leiras: 'Egyedi helyiségfűtés cserépkályhával.',
    adat: { hotermelo: { tipus: 'egyeb', kod: 'cserepkalyha' }, szabalyozas: { kozvetlen: T.SZAB_LEVEGO.kalyha_kandallo, forras: '1. függ. 8.14. táblázat – kályha, kandalló' }, elosztas: { hely: 'nincs', elore: 0, vissza: 0 }, tarolo: null, szivattyu: null }, jellemzoEpuletek: ['paraszthaz', 'kockahaz'], forras: F },
  { kod: 'el_kozvetlen', nev: 'Elektromos közvetlen fűtés (fűtőpanel, fűtőfilm)', leiras: 'Közvetlen villamos fűtés külső fal mentén, elektronikus (PI) termosztáttal.',
    adat: { hotermelo: { tipus: 'egyeb', kod: 'el_hosugarzo' }, szabalyozas: { kozvetlen: T.SZAB_VILLAMOS.kulso_fal.kozvetlen_pi, forras: '1. függ. 8.13. táblázat – közvetlen villamos fűtés PI szabályozással, külső falnál' }, elosztas: { hely: 'nincs', elore: 0, vissza: 0 }, tarolo: null, szivattyu: null }, jellemzoEpuletek: ['tarsashaz', 'nyaralo'], forras: F },
];

export const HMV_SZETTEK: readonly ReszSzett<HmvSablon>[] = [
  { kod: 'kond_kazan_indirekt', nev: 'Kondenzációs gázkazán, indirekt tároló', leiras: 'Fűtött téren belüli indirekt tároló, cirkuláció nélkül.',
    adat: { hotermelo: { tipus: 'kazan_tabla', kazan: 'kondenzacios', energiahordozo: 'fosszilis_gaz' }, tarolo: { tipus: 'indirekt', hely: 'belul' }, elosztas: { cirkulacio: false, hely: 'belul' }, cirkSzivattyu: null }, jellemzoEpuletek: ['csaladi_haz'], forras: F },
  { kod: 'kond_kombi', nev: 'Kondenzációs kombikazán, átfolyós', leiras: 'Átfolyós HMV készítés kombikazánnal (V < 2 l), tároló nélkül.',
    adat: { hotermelo: { tipus: 'kazan_tabla', kazan: 'kond_kombi_AF', energiahordozo: 'fosszilis_gaz' }, tarolo: null, elosztas: { cirkulacio: false, hely: 'belul' }, cirkSzivattyu: null }, jellemzoEpuletek: ['tarsashaz', 'csaladi_haz'], forras: F },
  { kod: 'kond_kazan_napkollektor', nev: 'Kondenzációs gázkazán + síkkollektor (4 m², dél, 45°)', leiras: 'Indirekt (szolár) tároló, két síkkollektor; a kollektorhozam a 9.5./9.7. táblázatból.',
    adat: { hotermelo: { tipus: 'kazan_tabla', kazan: 'kondenzacios', energiahordozo: 'fosszilis_gaz' }, tarolo: { tipus: 'indirekt', hely: 'belul' }, elosztas: { cirkulacio: false, hely: 'belul' }, cirkSzivattyu: null, napkollektor: { tipus: 'sik', felulet: 4, hajlasszog: 45, tajolasFok: 0 } }, jellemzoEpuletek: ['csaladi_haz'], forras: F },
  { kod: 'gaz_bojler', nev: 'Gázüzemű bojler (tárolós)', leiras: 'Gázüzemű tárolós vízmelegítő.',
    adat: { hotermelo: { tipus: 'egyeb', kod: 'gaz_bojler' }, tarolo: { tipus: 'gaz_bojler', hely: 'belul' }, elosztas: { cirkulacio: false, hely: 'belul' }, cirkSzivattyu: null }, jellemzoEpuletek: ['kockahaz', 'polgari'], forras: F },
  { kod: 'atfolyos_gaz', nev: 'Gázüzemű átfolyós vízmelegítő („cirkó” nélküli átfolyós)', leiras: 'Tároló nélküli gázüzemű átfolyós vízmelegítő.',
    adat: { hotermelo: { tipus: 'egyeb', kod: 'atfolyos_gaz' }, tarolo: null, elosztas: { cirkulacio: false, hely: 'belul' }, cirkSzivattyu: null }, jellemzoEpuletek: ['tarsashaz', 'polgari'], forras: F },
  { kod: 'hsz_levego_indirekt', nev: 'Levegő-víz hőszivattyú, indirekt tároló', leiras: 'A fűtési hőszivattyú készíti a HMV-t indirekt tárolóban.',
    adat: { hotermelo: { tipus: 'elektromos_tabla', kod: 'hsz_levego' }, tarolo: { tipus: 'indirekt', hely: 'belul' }, elosztas: { cirkulacio: false, hely: 'belul' }, cirkSzivattyu: null }, jellemzoEpuletek: ['uj_epulet', 'csaladi_haz'], forras: F },
  { kod: 'hsz_talaj_indirekt', nev: 'Talaj-víz hőszivattyú, indirekt tároló', leiras: 'Talajszondás hőszivattyú készíti a HMV-t indirekt tárolóban.',
    adat: { hotermelo: { tipus: 'elektromos_tabla', kod: 'hsz_talaj' }, tarolo: { tipus: 'indirekt', hely: 'belul' }, elosztas: { cirkulacio: false, hely: 'belul' }, cirkSzivattyu: null }, jellemzoEpuletek: ['uj_epulet'], forras: F },
  { kod: 'villanybojler_vezerelt', nev: 'Villanybojler, csúcson kívüli (vezérelt) áram', leiras: 'Elektromos tárolós vízmelegítő éjszakai/vezérelt árammal.',
    adat: { hotermelo: { tipus: 'elektromos_tabla', kod: 'atfolyos_tarolo' }, tarolo: { tipus: 'el_csucson_kivul', hely: 'belul' }, elosztas: { cirkulacio: false, hely: 'belul' }, cirkSzivattyu: null }, jellemzoEpuletek: ['kockahaz', 'paraszthaz', 'csaladi_haz'], forras: F },
  { kod: 'villanybojler_nappali', nev: 'Villanybojler, nappali áram', leiras: 'Elektromos tárolós vízmelegítő folyamatos (nappali) árammal.',
    adat: { hotermelo: { tipus: 'elektromos_tabla', kod: 'atfolyos_tarolo' }, tarolo: { tipus: 'el_nappali', hely: 'belul' }, elosztas: { cirkulacio: false, hely: 'belul' }, cirkSzivattyu: null }, jellemzoEpuletek: ['tarsashaz', 'polgari'], forras: F },
  { kod: 'tavho_cirk', nev: 'Távhő, cirkulációval', leiras: 'Központi HMV távhőről, cirkuláció fűtött téren kívül.',
    adat: { hotermelo: { tipus: 'tavho', hokozpontokSzama: 1 }, tarolo: null, elosztas: { cirkulacio: true, hely: 'kivul' }, cirkSzivattyu: 'ismeretlen' }, jellemzoEpuletek: ['panel'], forras: F },
];

/** Gépi szellőzés szettek. A hővisszanyerési hatásfok és az SPI jellemző termékadat (nem rendeleti táblázati érték): a tényleges adatlap szerint kell átírni. */
export interface SzellozesSablon { etaR: number; uzemArany: number; ventilator: SzellozesRendszer['ventilator']; segedKWh?: number }
const SZ_F = '9/2023 ÉKM 1. függ. 10.1.4 (10.17 képlet, 10.2.–10.4. táblázat); ηr és SPI jellemző termékadat – adatlap szerint ellenőrizendő';
export const SZELLOZES_SZETTEK: readonly ReszSzett<SzellozesSablon>[] = [
  { kod: 'kozponti_hv', nev: 'Központi hővisszanyerős szellőzés, légcsatornás (ηr 80%)', leiras: 'Ellenáramú lemezes hőcserélő, EC ventilátorok, fokozatmentes, kézi fokozatválasztás.',
    adat: { etaR: 0.8, uzemArany: 1, ventilator: { mod: 'erp', SPI: 0.00035, misc: 'legcsatornas', ctrl: 'kezi', x: 'fokozatmentes' } }, jellemzoEpuletek: ['uj_epulet', 'csaladi_haz'], forras: SZ_F },
  { kod: 'kozponti_hv_igeny', nev: 'Központi hővisszanyerős szellőzés, igény szerinti (CO₂/pára) vezérlés (ηr 85%)', leiras: 'Légcsatornás rendszer központi igény szerinti szabályozással.',
    adat: { etaR: 0.85, uzemArany: 1, ventilator: { mod: 'erp', SPI: 0.0003, misc: 'legcsatornas', ctrl: 'kozponti_igeny', x: 'fokozatmentes' } }, jellemzoEpuletek: ['uj_epulet'], forras: SZ_F },
  { kod: 'passzivhaz_hv', nev: 'Passzívház minőségű hővisszanyerős szellőzés (ηr 90%)', leiras: 'Minősített passzívház-szellőztető, alacsony SPI, igény szerinti vezérlés.',
    adat: { etaR: 0.9, uzemArany: 1, ventilator: { mod: 'erp', SPI: 0.00025, misc: 'legcsatornas', ctrl: 'kozponti_igeny', x: 'fokozatmentes' } }, jellemzoEpuletek: ['uj_epulet'], forras: SZ_F },
  { kod: 'decentralizalt_hv', nev: 'Decentralizált (falba épített) hővisszanyerős szellőzők (ηr 70%)', leiras: 'Légcsatorna nélküli, helyiségenkénti reverzibilis vagy páros egységek.',
    adat: { etaR: 0.7, uzemArany: 1, ventilator: { mod: 'erp', SPI: 0.0002, misc: 'legcsatorna_nelkuli', ctrl: 'kezi', x: 'haromfokozatu' } }, jellemzoEpuletek: ['felujitott', 'tarsashaz'], forras: SZ_F },
  { kod: 'elszivo_hv_nelkul', nev: 'Központi elszívó szellőzés hővisszanyerés nélkül', leiras: 'Légcsatornás elszívás, utánpótlás légbevezetőkön; a szellőzési hőveszteség nem csökken (ηr = 0).',
    adat: { etaR: 0, uzemArany: 1, ventilator: { mod: 'erp', SPI: 0.00025, misc: 'legcsatornas', ctrl: 'kezi', x: 'ketfokozatu' } }, jellemzoEpuletek: ['tarsashaz'], forras: SZ_F },
];

/** Hűtési szettek – minden érték a 11.1–11.3. táblázatból. */
export type HutesSablon = Omit<HutesRendszer, 'nev'>;
const H_F = '9/2023 ÉKM számítási módszer, 1. függelék 11.1–11.3. táblázat';
export const HUTES_SZETTEK: readonly ReszSzett<HutesSablon>[] = [
  { kod: 'split', nev: 'Split / multi-split klíma (közvetlen elpárologtatás)', leiras: 'Kompresszoros léghűtés, SEER 2,5 (11.2.), cH 1,45, εH,szab 1,13. Adatlapos SEER-rel pontosítható.',
    adat: { gep: { tipus: 'tabla', kod: 'split' }, cH: 'direkt_elparologtato', szab: 'direkt' }, jellemzoEpuletek: ['csaladi_haz', 'tarsashaz'], forras: H_F },
  { kod: 'hsz_fancoil', nev: 'Reverzibilis levegő-víz hőszivattyú + fan-coil 7/12', leiras: 'Léghűtéses kompakt folyadékhűtőként számolva (SEER 3,0), fan-coil 6/12 °C: cH 1,25, εH,szab 1,13.',
    adat: { gep: { tipus: 'tabla', kod: 'leghutes_folyadekhuto' }, cH: 'fancoil_6_12', szab: 'viz_6_12' }, jellemzoEpuletek: ['uj_epulet', 'csaladi_haz'], forras: H_F },
  { kod: 'hsz_padlohutes', nev: 'Reverzibilis levegő-víz hőszivattyú + padlóhűtés 18/20', leiras: 'Léghűtéses folyadékhűtőként számolva (SEER 3,0); a cH a táblázat 16/18 °C-os sora (legközelebbi), εH,szab 1,1 (padlóhűtés).',
    adat: { gep: { tipus: 'tabla', kod: 'leghutes_folyadekhuto' }, cH: 'klimagerenda_16_18', szab: 'viz_18_20' }, jellemzoEpuletek: ['uj_epulet', 'csaladi_haz'], forras: H_F },
  { kod: 'talaj_hsz_padlohutes', nev: 'Talaj-víz hőszivattyú aktív hűtéssel + padlóhűtés', leiras: 'SEER 5,0 (11.2.), cH a 16/18 °C-os sor szerint, εH,szab 1,1.',
    adat: { gep: { tipus: 'tabla', kod: 'talajho_viz_hsz' }, cH: 'klimagerenda_16_18', szab: 'viz_18_20' }, jellemzoEpuletek: ['uj_epulet'], forras: H_F },
  { kod: 'passziv_talaj', nev: 'Passzív hűtés talajszondáról (hőszivattyú nélkül) + padlóhűtés', leiras: '11.1.2: 1 kWh keringtetési segédenergia 10 kWh nettó hűtési igényt fedez.',
    adat: { gep: { tipus: 'passziv_talaj' }, cH: 'klimagerenda_16_18', szab: 'viz_18_20' }, jellemzoEpuletek: ['uj_epulet'], forras: H_F },
];

/** Teljes rendszer-kombinációk (a korábbi szettek; az irodai adatbázis és a régi projektek ezekre hivatkoznak). */
const kombi = (kod: string, futesKod: string, hmvKod: string, nev: string, leiras: string, jellemzoEpuletek: string[]): GepeszetiSzett => {
  const f = FUTES_SZETTEK.find((x) => x.kod === futesKod)!, h = HMV_SZETTEK.find((x) => x.kod === hmvKod)!;
  return { kod, nev, leiras, hmvNev: h.nev, futes: f.adat, hmv: h.adat, jellemzoEpuletek, forras: F, futesKod, hmvKod };
};
export const GEPESZETI_SZETTEK: readonly GepeszetiSzett[] = [
  kombi('gaz_kondenz_radiator', 'gaz_kondenz_radiator', 'kond_kazan_indirekt', 'Kondenzációs gázkazán + radiátor 55/45 + indirekt HMV tároló', 'Fűtött téren belüli kondenzációs kazán, kétcsöves radiátoros fűtés termosztatikus szelepekkel; HMV indirekt tárolóval, cirkuláció nélkül.', ['csaladi_haz', 'kockahaz_felujitott', 'uj_epulet']),
  kombi('gaz_kond_kombi', 'gaz_kondenz_radiator', 'kond_kombi', 'Kondenzációs gáz kombikazán (átfolyós HMV) + radiátor 55/45', 'Lakásonkénti vagy családi házas kondenzációs kombikazán, átfolyós HMV készítéssel, termosztatikus szelepek.', ['tegla_tarsashaz', 'blokkos_tarsashaz', 'csaladi_haz']),
  kombi('gaz_hagyomanyos_regi', 'gaz_hagyomanyos_regi', 'gaz_bojler', 'Régi állandó hőmérsékletű gázkazán + radiátor 90/70 + gázbojler', 'Meglévő épületek tipikus régi rendszere, HMV gázüzemű bojlerrel.', ['kockahaz', 'parasztház', 'polgari_berhaz']),
  kombi('hsz_levego_viz_padlo', 'hsz_levego_viz_padlo', 'hsz_levego_indirekt', 'Levegő-víz hőszivattyú + padlófűtés 35/28 + HMV hőszivattyúval', 'Levegő-víz hőszivattyú padlófűtéssel; HMV ugyanazzal a hőszivattyúval indirekt tárolóban.', ['uj_epulet', 'csaladi_haz']),
  kombi('hsz_levego_viz_radiator', 'hsz_levego_viz_radiator', 'hsz_levego_indirekt', 'Levegő-víz hőszivattyú + radiátor 55/45 + HMV hőszivattyúval', 'Felújításoknál jellemző: meglévő radiátorok 55/45 °C-on.', ['kockahaz_felujitott', 'csaladi_haz']),
  kombi('tavho_panel_egycsoves', 'tavho_panel_egycsoves', 'tavho_cirk', 'Távhő + egycsöves radiátoros fűtés + távhős HMV cirkulációval', 'Panelos lakótelepek jellemző rendszere.', ['panel']),
  kombi('tavho_padlo', 'tavho_padlo', 'tavho_cirk', 'Távhő + padlófűtés 35/28 + távhős HMV cirkulációval', 'Új társasház távhőről: padlófűtés keverőkörrel, központi HMV cirkulációval.', ['uj_epulet', 'tarsashaz']),
  kombi('gazkonvektor_villanybojler', 'gazkonvektor_kombinalt', 'villanybojler_nappali', 'Gázkonvektorok + elektromos (nappali áramú) villanybojler', 'Régi lakásokban gyakori kombináció.', ['tegla_tarsashaz', 'kockahaz', 'polgari_berhaz']),
  kombi('tuzifa_kazan_radiator', 'tuzifa_kazan_radiator', 'villanybojler_vezerelt', 'Tűzifa (hasábfa) kazán + radiátor 70/55 + villanybojler', 'Vidéki családi házak: hasábfa tüzelésű kazán, HMV csúcson kívüli árammal.', ['kockahaz', 'parasztház', 'csaladi_haz']),
];

/** Szettből számítható fűtési alrendszer a projekt adataival. */
export function szettbolFutes(szett: GepeszetiSzett, p: { nev?: string; Arszr: number; lefedes?: number }): FutesiAlrendszer {
  const { szabalyozas, ...tobbi } = szett.futes;
  const epszilonSzab = 'valasztas' in szabalyozas ? szabalyozasiTenyezo(szabalyozas.valasztas).epszilon : szabalyozas.kozvetlen;
  return { ...tobbi, nev: p.nev ?? szett.nev, Arszr: p.Arszr, lefedes: p.lefedes, epszilonSzab };
}

/** Szettből számítható HMV rendszer (lakóépületnél a qHMV a 2. függ. 2.2. táblázatból kötelező). */
export function szettbolHmv(szett: GepeszetiSzett, p: { nev?: string; Arszr: number; AN: number; qHMV: number }): HmvRendszer {
  return { ...szett.hmv, nev: p.nev ?? szett.nev, Arszr: p.Arszr, AN: p.AN, qHMV: p.qHMV };
}
