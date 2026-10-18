/**
 * Gépészeti szettek – a leggyakoribb hazai lakóépületi rendszerkombinációk a 9/2023 ÉKM számítási módszer
 * 8–9. fejezetének egyszerűsített (ErP hatályán kívüli, táblázati) értékeivel. A szett csak a választásokat rögzíti;
 * minden szám a táblázatokból jön a projekt rendszer-alapterületére interpolálva. Ha a tényleges berendezés ErP
 * adatlappal rendelkezik, a hőtermelőt 'kazan_erp' / 'hoszivattyu_erp' típusra kell váltani (8.3.1.1, 8.3.2.1).
 */
import { szabalyozasiTenyezo, type FutesiAlrendszer, type HmvRendszer } from './rendszerek.js';

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
}

const F = '9/2023 ÉKM számítási módszer, 1. függelék 8–9. fejezet táblázatai (egyszerűsített módszer)';

export const GEPESZETI_SZETTEK: readonly GepeszetiSzett[] = [
  {
    kod: 'gaz_kondenz_radiator',
    hmvNev: 'Kondenzációs gázkazán, indirekt tároló',
    nev: 'Kondenzációs gázkazán + radiátor 55/45 + indirekt HMV tároló',
    leiras: 'Fűtött téren belüli kondenzációs kazán, kétcsöves radiátoros fűtés termosztatikus szelepekkel, fordulatszám-szabályozott szivattyú; HMV indirekt tárolóval, cirkuláció nélkül.',
    futes: {
      hotermelo: { tipus: 'kazan_tabla', kazan: 'kondenzacios', hely: 'belul', energiahordozo: 'fosszilis_gaz' },
      szabalyozas: { valasztas: { alap: 'ref_helyiseg_pi', holeado: { tipus: 'szabad', hofok: '55/45', hatarolo: 'kulsofali' }, helyiseg: 'termosztatikus', beszabalyozas: { csovek: 'ketcsoves', mod: 'statikus_csoportos_nelkul', holeadokTobbMint10: false } } },
      elosztas: { hely: 'belul', elore: 55, vissza: 45 }, tarolo: null, szivattyu: 'fordulatszam_szabad_10K',
    },
    hmv: { hotermelo: { tipus: 'kazan_tabla', kazan: 'kondenzacios', energiahordozo: 'fosszilis_gaz' }, tarolo: { tipus: 'indirekt', hely: 'belul' }, elosztas: { cirkulacio: false, hely: 'belul' }, cirkSzivattyu: null },
    jellemzoEpuletek: ['csaladi_haz', 'kockahaz_felujitott', 'uj_epulet'],
    forras: F,
  },
  {
    kod: 'gaz_kond_kombi',
    hmvNev: 'Kondenzációs kombikazán, átfolyós',
    nev: 'Kondenzációs gáz kombikazán (átfolyós HMV) + radiátor 55/45',
    leiras: 'Lakásonkénti vagy családi házas kondenzációs kombikazán, átfolyós HMV készítéssel (V < 2 l), termosztatikus szelepek.',
    futes: {
      hotermelo: { tipus: 'kazan_tabla', kazan: 'kondenzacios', hely: 'belul', energiahordozo: 'fosszilis_gaz' },
      szabalyozas: { valasztas: { alap: 'ref_helyiseg_pi', holeado: { tipus: 'szabad', hofok: '55/45', hatarolo: 'kulsofali' }, helyiseg: 'termosztatikus', beszabalyozas: { csovek: 'ketcsoves', mod: 'statikus_csoportos_nelkul', holeadokTobbMint10: false } } },
      elosztas: { hely: 'belul', elore: 55, vissza: 45 }, tarolo: null, szivattyu: 'fordulatszam_szabad_10K',
    },
    hmv: { hotermelo: { tipus: 'kazan_tabla', kazan: 'kond_kombi_AF', energiahordozo: 'fosszilis_gaz' }, tarolo: null, elosztas: { cirkulacio: false, hely: 'belul' }, cirkSzivattyu: null },
    jellemzoEpuletek: ['tegla_tarsashaz', 'blokkos_tarsashaz', 'csaladi_haz'],
    forras: F,
  },
  {
    kod: 'gaz_hagyomanyos_regi',
    hmvNev: 'Gázüzemű bojler',
    nev: 'Régi állandó hőmérsékletű gázkazán + radiátor 90/70 + gázbojler',
    leiras: 'Meglévő épületek tipikus régi rendszere: állandó hőmérsékletű kazán, szabályozás nélküli radiátorok, beszabályozás nélkül, állandó fordulatú szivattyú; HMV gázüzemű bojlerrel.',
    futes: {
      hotermelo: { tipus: 'kazan_tabla', kazan: 'allando', hely: 'belul', energiahordozo: 'fosszilis_gaz' },
      szabalyozas: { valasztas: { alap: 'nincs', holeado: { tipus: 'szabad', hofok: '90/70', hatarolo: 'kulsofali' }, helyiseg: 'nincs', beszabalyozas: { csovek: 'ketcsoves', mod: 'nincs', holeadokTobbMint10: false } } },
      elosztas: { hely: 'belul', elore: 90, vissza: 70 }, tarolo: null, szivattyu: 'allando_szabad_20K',
    },
    hmv: { hotermelo: { tipus: 'egyeb', kod: 'gaz_bojler' }, tarolo: { tipus: 'gaz_bojler', hely: 'belul' }, elosztas: { cirkulacio: false, hely: 'belul' }, cirkSzivattyu: null },
    jellemzoEpuletek: ['kockahaz', 'parasztház', 'polgari_berhaz'],
    forras: F,
  },
  {
    kod: 'hsz_levego_viz_padlo',
    hmvNev: 'Levegő-víz hőszivattyú, indirekt tároló',
    nev: 'Levegő-víz hőszivattyú + padlófűtés 35/28 + HMV hőszivattyúval',
    leiras: 'Levegő-víz hőszivattyú (táblázati εF = 0,30), nedves fektetésű padlófűtés helyiségenkénti termosztatikus zónaszelepekkel; HMV ugyanazzal a hőszivattyúval indirekt tárolóban.',
    futes: {
      hotermelo: { tipus: 'hoszivattyu_tabla', forras: 'levego_viz', hofok: '35/28' },
      szabalyozas: { valasztas: { alap: 'ref_helyiseg_pi', holeado: { tipus: 'beagyazott', rendszer: 'padlo_nedves', hatarolo: 'min_szig' }, helyiseg: 'termosztatikus', beszabalyozas: { csovek: 'ketcsoves', mod: 'statikus_csoportos_dinamikus', holeadokTobbMint10: false } } },
      elosztas: { hely: 'belul', elore: 35, vissza: 28 }, tarolo: null, szivattyu: 'fordulatszam_beagyazott_7K',
    },
    hmv: { hotermelo: { tipus: 'elektromos_tabla', kod: 'hsz_levego' }, tarolo: { tipus: 'indirekt', hely: 'belul' }, elosztas: { cirkulacio: false, hely: 'belul' }, cirkSzivattyu: null },
    jellemzoEpuletek: ['uj_epulet', 'csaladi_haz'],
    forras: F,
  },
  {
    kod: 'hsz_levego_viz_radiator',
    hmvNev: 'Levegő-víz hőszivattyú, indirekt tároló',
    nev: 'Levegő-víz hőszivattyú + radiátor 55/45 + HMV hőszivattyúval',
    leiras: 'Felújításoknál jellemző: meglévő radiátorok 55/45 °C-on, levegő-víz hőszivattyú (táblázati εF = 0,37).',
    futes: {
      hotermelo: { tipus: 'hoszivattyu_tabla', forras: 'levego_viz', hofok: '55/45' },
      szabalyozas: { valasztas: { alap: 'ref_helyiseg_pi', holeado: { tipus: 'szabad', hofok: '55/45', hatarolo: 'kulsofali' }, helyiseg: 'termosztatikus', beszabalyozas: { csovek: 'ketcsoves', mod: 'statikus_csoportos_nelkul', holeadokTobbMint10: false } } },
      elosztas: { hely: 'belul', elore: 55, vissza: 45 }, tarolo: null, szivattyu: 'fordulatszam_szabad_10K',
    },
    hmv: { hotermelo: { tipus: 'elektromos_tabla', kod: 'hsz_levego' }, tarolo: { tipus: 'indirekt', hely: 'belul' }, elosztas: { cirkulacio: false, hely: 'belul' }, cirkSzivattyu: null },
    jellemzoEpuletek: ['kockahaz_felujitott', 'csaladi_haz'],
    forras: F,
  },
  {
    kod: 'tavho_panel_egycsoves',
    hmvNev: 'Távhő, cirkulációval',
    nev: 'Távhő + egycsöves radiátoros fűtés + távhős HMV cirkulációval',
    leiras: 'Panelos lakótelepek jellemző rendszere: távhő-hőközpont, egycsöves (nem felújított) 90/70 radiátoros fűtés, termosztatikus szelepek, elosztás a pincében (fűtött téren kívül); HMV távhőről cirkulációval.',
    futes: {
      hotermelo: { tipus: 'tavho', hokozpontokSzama: 1 },
      szabalyozas: { valasztas: { alap: 'nincs', holeado: { tipus: 'szabad', hofok: '90/70', egycsoves: true, hatarolo: 'kulsofali' }, helyiseg: 'termosztatikus', beszabalyozas: { csovek: 'egycsoves', mod: 'statikus' } } },
      elosztas: { hely: 'kivul', elore: 90, vissza: 70 }, tarolo: null, szivattyu: 'allando_szabad_20K',
    },
    hmv: { hotermelo: { tipus: 'tavho', hokozpontokSzama: 1 }, tarolo: null, elosztas: { cirkulacio: true, hely: 'kivul' }, cirkSzivattyu: 'ismeretlen' },
    jellemzoEpuletek: ['panel'],
    forras: F,
  },
  {
    kod: 'gazkonvektor_villanybojler',
    hmvNev: 'Villanybojler, nappali áram',
    nev: 'Gázkonvektorok + elektromos (nappali áramú) villanybojler',
    leiras: 'Régi lakásokban gyakori: kombinált szabályozású hagyományos gázkonvektorok külső falnál, HMV nappali árammal működő villanybojlerrel.',
    futes: {
      hotermelo: { tipus: 'egyeb', kod: 'gazkonvektor_kombinalt' },
      szabalyozas: { kozvetlen: 1.2, forras: '1. függ. 8.14. táblázat – gázkonvektor saját termosztatikus szabályozással, külső falnál' },
      elosztas: { hely: 'nincs', elore: 0, vissza: 0 }, tarolo: null, szivattyu: null,
    },
    hmv: { hotermelo: { tipus: 'elektromos_tabla', kod: 'atfolyos_tarolo' }, tarolo: { tipus: 'el_nappali', hely: 'belul' }, elosztas: { cirkulacio: false, hely: 'belul' }, cirkSzivattyu: null },
    jellemzoEpuletek: ['tegla_tarsashaz', 'kockahaz', 'polgari_berhaz'],
    forras: F,
  },
  {
    kod: 'tuzifa_kazan_radiator',
    hmvNev: 'Villanybojler, csúcson kívüli áram',
    nev: 'Tűzifa (hasábfa) kazán szabályozóval + radiátor 70/55 + villanybojler',
    leiras: 'Vidéki családi házak: hasábfa tüzelésű kazán, kézi radiátorszelepek, HMV csúcson kívüli árammal működő villanybojlerrel.',
    futes: {
      hotermelo: { tipus: 'szilard_kazan', kazan: 'tuzifa', energiahordozo: 'bio_szilard' },
      szabalyozas: { valasztas: { alap: 'nincs', holeado: { tipus: 'szabad', hofok: '70/55', hatarolo: 'kulsofali' }, helyiseg: 'kezi', beszabalyozas: { csovek: 'ketcsoves', mod: 'nincs', holeadokTobbMint10: false } } },
      elosztas: { hely: 'belul', elore: 70, vissza: 55 }, tarolo: null, szivattyu: 'allando_szabad_15K',
    },
    hmv: { hotermelo: { tipus: 'elektromos_tabla', kod: 'atfolyos_tarolo' }, tarolo: { tipus: 'el_csucson_kivul', hely: 'belul' }, elosztas: { cirkulacio: false, hely: 'belul' }, cirkSzivattyu: null },
    jellemzoEpuletek: ['kockahaz', 'parasztház', 'csaladi_haz'],
    forras: F,
  },
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
