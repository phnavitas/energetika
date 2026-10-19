/**
 * Kortipikus nyílászáró-sablonok meglévő és új épületekhez. Az elemek értékei a 9/2023 ÉKM számítási módszer
 * 2. függelékének 4.1–4.4. táblázatából valók; a korszakhoz rendelés és a keret-/osztószélesség tervezői becslés
 * (ellenőrizendő, termékadat vagy helyszíni felmérés felülírja). Kapcsolt szárnyú ablakoknál a 4.17 képlet.
 */
export interface NyilaszaroSablon {
  kod: string;
  nev: string;
  leiras: string;
  korszak: [number, number];
  anyag: 'fa' | 'pvc' | 'fem';
  /** Egyhéjú: üvegezés- és keretkód a 4.1./4.2. táblázatból. */
  uveg: string;
  keret: string;
  tavtarto: 'fem' | 'fejlett' | 'nincs';
  keretMm: number;
  osztoMm: number;
  oszlop: number;
  sor: number;
  /** Kapcsolt (kéthéjú) szerkezet: a két szárny közti légrés [mm]. */
  kapcsoltResMm?: number;
}

export const NYILASZARO_SABLONOK: readonly NyilaszaroSablon[] = [
  { kod: 'fa_egyretegu', nev: 'Egyszerű fa ablak, egy üvegréteg', leiras: 'Egyrétegű üvegezés, fa keret, osztott szárnyak. Régi lakóházak, melléképületek.', korszak: [1850, 1960], anyag: 'fa', uveg: 'egyreteg', keret: 'fa_50', tavtarto: 'nincs', keretMm: 90, osztoMm: 110, oszlop: 2, sor: 1 },
  { kod: 'fa_kapcsolt_gereb', nev: 'Kapcsolt gerébtokos fa ablak', leiras: 'Két egyrétegű üvegezésű szárny, kb. 50 mm légréssel (4.17). Polgári házak, kockaházak.', korszak: [1900, 1985], anyag: 'fa', uveg: 'egyreteg', keret: 'fa_50', tavtarto: 'nincs', keretMm: 100, osztoMm: 120, oszlop: 2, sor: 1, kapcsoltResMm: 50 },
  { kod: 'fa_egyesitett', nev: 'Egyesített szárnyú fa ablak (panel)', leiras: 'Két egyrétegű üvegezésű, összefogott szárny, kb. 30 mm légréssel (4.17). Panel- és blokkházak 1965–1990.', korszak: [1960, 1992], anyag: 'fa', uveg: 'egyreteg', keret: 'fa_50', tavtarto: 'nincs', keretMm: 90, osztoMm: 110, oszlop: 2, sor: 1, kapcsoltResMm: 30 },
  { kod: 'fem_regi', nev: 'Alumínium ablak, termikus elválasztás nélkül', leiras: 'Bevonat nélküli kétrétegű üvegezés, fém távtartó. Középületek, lépcsőházak 1970–2000.', korszak: [1965, 2000], anyag: 'fem', uveg: 'ketreteg_bevonat_nelkul', keret: 'fem_0', tavtarto: 'fem', keretMm: 70, osztoMm: 90, oszlop: 2, sor: 1 },
  { kod: 'fa_hoszig_90', nev: 'Fa ablak hőszigetelő üveggel (90-es évek)', leiras: '4-12-4 bevonat nélküli hőszigetelő üveg, 68–70 mm fa keret, fém távtartó.', korszak: [1985, 2000], anyag: 'fa', uveg: 'ketreteg_bevonat_nelkul', keret: 'fa_70', tavtarto: 'fem', keretMm: 110, osztoMm: 130, oszlop: 2, sor: 1 },
  { kod: 'pvc_3_90', nev: 'Műanyag ablak, 3 kamrás (1995–2005)', leiras: '4-12-4 egy low-e bevonattal (ε = 0,15), fém távtartó.', korszak: [1993, 2005], anyag: 'pvc', uveg: 'ketreteg_lowe_015', keret: 'pvc_3', tavtarto: 'fem', keretMm: 115, osztoMm: 140, oszlop: 1, sor: 1 },
  { kod: 'pvc_5_2005', nev: 'Műanyag ablak, 5 kamrás, argonos low-e üveg', leiras: '4-16-4 low-e argon (Ug 1,2), fém távtartó. A 2005–2015 közötti cserék jellemző ablaka.', korszak: [2003, 2016], anyag: 'pvc', uveg: 'ketreteg_lowe_argon', keret: 'pvc_5', tavtarto: 'fem', keretMm: 120, osztoMm: 145, oszlop: 1, sor: 1 },
  { kod: 'fa_iv78_2005', nev: 'Fa ablak IV78, argonos low-e üveg', leiras: '80 mm fa keret, 4-16-4 low-e argon, fém távtartó.', korszak: [2003, 2016], anyag: 'fa', uveg: 'ketreteg_lowe_argon', keret: 'fa_80', tavtarto: 'fem', keretMm: 120, osztoMm: 145, oszlop: 1, sor: 1 },
  { kod: 'alu_termikus', nev: 'Alumínium ablak, erős termikus elválasztással', leiras: '4-16-4 low-e argon, fejlett távtartó.', korszak: [2005, 2035], anyag: 'fem', uveg: 'ketreteg_lowe_argon', keret: 'fem_eros', tavtarto: 'fejlett', keretMm: 100, osztoMm: 130, oszlop: 1, sor: 1 },
  { kod: 'pvc_3r', nev: 'Műanyag ablak, többkamrás, háromrétegű üveg', leiras: 'Két low-e bevonatos, argonos háromrétegű üvegezés, fejlett (meleg peremű) távtartó. Új és közel nulla épületek.', korszak: [2014, 2035], anyag: 'pvc', uveg: 'haromreteg_lowe_argon', keret: 'pvc_tobb', tavtarto: 'fejlett', keretMm: 120, osztoMm: 150, oszlop: 1, sor: 1 },
  { kod: 'fa_3r', nev: 'Fa ablak, háromrétegű üveg', leiras: '100 mm fa keret, két low-e háromrétegű argonos üvegezés, fejlett távtartó.', korszak: [2014, 2035], anyag: 'fa', uveg: 'haromreteg_lowe_argon', keret: 'fa_100', tavtarto: 'fejlett', keretMm: 125, osztoMm: 150, oszlop: 1, sor: 1 },
];

export const SABLON_FORRAS = '2. függ. 4.1–4.4. táblázat; korszak és keretszélesség: tervezői becslés, ellenőrizendő';

/** Az adott évhez illő sablonok (a korszak közepéhez közelebbiek előre). */
export function ajanlottSablonok(ev: number): NyilaszaroSablon[] {
  return NYILASZARO_SABLONOK.filter((s) => ev >= s.korszak[0] && ev <= s.korszak[1])
    .sort((a, b) => Math.abs(ev - (a.korszak[0] + a.korszak[1]) / 2) - Math.abs(ev - (b.korszak[0] + b.korszak[1]) / 2));
}
