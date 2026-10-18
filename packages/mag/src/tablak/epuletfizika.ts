/**
 * Épületfizikai táblázatok – 9/2023 ÉKM számítási módszer, 1. függelék (4–6. fejezet)
 * és 2. függelék (2., 4. pont).
 */

export type HoaramIrany = 'felfele' | 'vizszintes' | 'lefele';

/** 1. függ. 4.1. táblázat – Felületi hőátadási ellenállások [m²K/W] (MSZ EN ISO 6946). */
export const RSI: Readonly<Record<HoaramIrany, number>> = { felfele: 0.1, vizszintes: 0.13, lefele: 0.17 };
export const RSE = 0.04;

/** 1. függ. 4.2. táblázat – Zárt légrétegek hővezetési ellenállása [m²K/W]; vastagság mm. Közbenső: lineáris interpoláció. */
export const ZART_LEGRETEG = {
  vastagsagMm: [0, 5, 7, 10, 15, 25, 50, 100, 300],
  felfele: [0, 0.11, 0.13, 0.15, 0.16, 0.16, 0.16, 0.16, 0.16],
  vizszintes: [0, 0.11, 0.13, 0.15, 0.17, 0.18, 0.18, 0.18, 0.18],
  lefele: [0, 0.11, 0.13, 0.15, 0.17, 0.19, 0.21, 0.22, 0.23],
} as const;

/** 1. függ. 4.1.6 – légüreg korrekció ΔU'' szintjei. Általános esetben az 1. szint. */
export const LEGUREG_KORREKCIO = { szint0: 0, szint1: 0.01, szint2: 0.04 } as const;

/** 1. függ. 4.3. táblázat – Árnyékoló szerkezetek légáteresztési osztálya (beth mm). */
export function arnyekoloLegateresztesiOsztaly(beth: number, alsoOldalsoNulla = false): 1 | 2 | 3 | 4 | 5 {
  if (beth <= 3 && alsoOldalsoNulla) return 5;
  if (beth >= 35) return 1;
  if (beth >= 15) return 2;
  if (beth >= 8) return 3;
  // A forrás 4. osztálynál „beth ≥ 8”-at ír, ami a 3. osztállyal ütközik – értelemszerűen beth < 8.
  return 4;
}

/** 1. függ. 4.4. táblázat – Többlet hővezetési ellenállás, ha Rárny ismert [m²K/W]. */
export function tobbletEllenallas(osztaly: 1 | 2 | 3 | 4 | 5, Rarny: number): number {
  switch (osztaly) {
    case 1: return 0.08;
    case 2: return 0.25 * Rarny + 0.09;
    case 3: return 0.55 * Rarny + 0.11;
    case 4: return 0.8 * Rarny + 0.14;
    case 5: return 0.95 * Rarny + 0.17;
  }
}

/** 1. függ. 4.5. táblázat – Zárt árnyékoló többlet ellenállása, ha Rárny nem ismert. Oszlopok: 1–2., 3., 4–5. osztály. */
export const ARNYEKOLO_TOBBLET_ELLENALLAS = [
  { kod: 'alu_redony', megnevezes: 'Alumínium redőny', Rarny: 0.01, dR: [0.09, 0.12, 0.15] },
  { kod: 'fa_muanyag_redony', megnevezes: 'Fa vagy műanyag redőny habkitöltés nélküli lamellákkal', Rarny: 0.1, dR: [0.12, 0.16, 0.22] },
  { kod: 'habos_redony', megnevezes: 'Redőny habkitöltéses lamellákkal', Rarny: 0.15, dR: [0.13, 0.19, 0.26] },
  { kod: 'fa_lamella', megnevezes: '25–30 mm-es fa lamellák', Rarny: 0.2, dR: [0.14, 0.22, 0.3] },
] as const;

/** 1. függ. 4.6. táblázat – Talajok hőtechnikai adatai. Ismeretlen talaj: 2. típus. */
export const TALAJ = {
  1: { megnevezes: 'Agyag, iszap', lambda: 1.5, c: 3.0e6 },
  2: { megnevezes: 'Homok, kavics', lambda: 2.0, c: 2.0e6 },
  3: { megnevezes: 'Homogén kő', lambda: 3.5, c: 2.0e6 },
} as const;

/** 1. függ. 6.1. táblázat – Csatlakozási hőhidak hatását kifejező χ korrekciós tényező (UR = U·(1+χ)). */
export type Hohidassag = 'gyengen' | 'kozepesen' | 'erosen';
export const HOHID_KORREKCIO = {
  kulso_fal_kulso_szig: { gyengen: 0.15, kozepesen: 0.2, erosen: 0.3 },
  kulso_fal_egyeb: { gyengen: 0.25, kozepesen: 0.3, erosen: 0.4 },
  lapostet: { gyengen: 0.1, kozepesen: 0.15, erosen: 0.2 },
  beepitett_tetoter: { gyengen: 0.1, kozepesen: 0.15, erosen: 0.2 },
  padlasfodem: 0.1,
  arkadfodem: 0.1,
  pincefodem_belul_szig: 0.2,
  pincefodem_alul_szig: 0.1,
  futott_futetlen_fal_es_futott_pince_fal: 0.05,
} as const;

/** 1. függ. 6.2. táblázat – Hőhidak fajlagos hossza (fm/m²) szerinti besorolás határai: [gyengén felső, közepesen felső]. */
export const HOHID_BESOROLAS = {
  kulso_fal: [0.8, 1.0],
  lapostet: [0.2, 0.3],
  beepitett_tetoter: [0.4, 0.5],
} as const;

export function hohidassagBesorolas(tipus: keyof typeof HOHID_BESOROLAS, fajlagosHossz: number): Hohidassag {
  const [g, k] = HOHID_BESOROLAS[tipus];
  if (fajlagosHossz < g) return 'gyengen';
  if (fajlagosHossz <= k) return 'kozepesen';
  return 'erosen';
}

/** 1. függ. 6.3. táblázat – Gyengén kapcsolt fűtetlen terek b módosító tényezői. Okt–ápr: btél, máj–szept: bnyár. */
export const B_TENYEZO = {
  padlas: { megnevezes: 'Padlástérrel határos födém vagy fal', tel: 0.9, nyar: 0.0 },
  pince: { megnevezes: 'Zárt, fűtetlen pincével határos födém vagy fal', tel: 0.5, nyar: 1.5 },
  melygarazs: { megnevezes: 'Zárt, fűtetlen mélygarázzsal határos födém vagy fal', tel: 0.8, nyar: 0.8 },
  garazs: { megnevezes: 'Zárt, fűtetlen garázzsal határos födém vagy fal', tel: 0.9, nyar: 0.9 },
  futetlen_helyiseg: { megnevezes: 'Fűtetlen / hűtés nélküli helyiséggel határos födém vagy fal', tel: 0.5, nyar: 0.5 },
  futetlen_lepcsohaz: { megnevezes: 'Fűtetlen, külső homlokzattal rendelkező lépcsőházzal határos fal', tel: 0.7, nyar: 0.7 },
  napter_egyretegu: { megnevezes: 'Naptérrel/fűtetlen átriummal határos fal, egyrétegű üvegezés', tel: 0.8, nyar: 0.0 },
  napter_ketretegu: { megnevezes: 'Naptérrel/fűtetlen átriummal határos fal, kétrétegű üvegezés', tel: 0.7, nyar: 0.0 },
  napter_hoszigetelo: { megnevezes: 'Naptérrel/fűtetlen átriummal határos fal, hőszigetelő üvegezés', tel: 0.5, nyar: 0.0 },
} as const;
export type BTenyezoKod = keyof typeof B_TENYEZO;

/** Hónapindex (0..11) → téli (okt–ápr) vagy nyári (máj–szept) b érték. */
export function bErtek(kod: BTenyezoKod, honap: number): number {
  const b = B_TENYEZO[kod];
  return honap >= 4 && honap <= 8 ? b.nyar : b.tel;
}

/**
 * 1. függ. 6.4. táblázat – Padló-fal csatlakozási hőhíd Ψp,f [W/mK].
 * Sor: vakolatlan falazat egyenértékű λ (>0,45 | 0,15–0,45 | <0,15) × külső fal külső oldali megszakítatlan hőszigeteléssel / nélkül.
 * Oszlop: lábazati fal (hőszigeteletlen | csak terepszintig hőszig. | terepszint alatt 0,5 m-ig hőszig.) × padló (szigeteletlen | szigetelt).
 * Hőszigetelt: legalább egy R = 1,25 m²K/W hővezetési ellenállású réteg.
 */
export type FalazatLambda = 'nagy' | 'kozepes' | 'kicsi';
export type LabazatSzigeteles = 'nincs' | 'terepszintig' | 'terepszint_alatt_05m';
const PSI_PF: Readonly<Record<FalazatLambda, Readonly<Record<'szig' | 'nincs', readonly number[]>>>> = {
  nagy: { szig: [0.25, 0.45, 0.1, 0.25, 0.05, 0.15], nincs: [0.15, 0.3, 0.2, 0.25, 0.25, 0.2] },
  kozepes: { szig: [0.15, 0.2, 0.05, 0.15, 0.05, 0.1], nincs: [0.1, 0.15, 0.1, 0.15, 0.1, 0.15] },
  kicsi: { szig: [0.1, 0.15, 0.05, 0.1, 0.05, 0.05], nincs: [0.05, 0.1, 0.05, 0.1, 0.05, 0.1] },
};
export function falazatLambdaKategoria(lambda: number): FalazatLambda {
  if (lambda > 0.45) return 'nagy';
  if (lambda >= 0.15) return 'kozepes';
  return 'kicsi';
}
export function psiPadloFal(p: { falazatLambda: number; kulsoFalSzigetelt: boolean; labazat: LabazatSzigeteles; padloSzigetelt: boolean }): number {
  const sor = PSI_PF[falazatLambdaKategoria(p.falazatLambda)][p.kulsoFalSzigetelt ? 'szig' : 'nincs'];
  const oszlop = { nincs: 0, terepszintig: 2, terepszint_alatt_05m: 4 }[p.labazat] + (p.padloSzigetelt ? 1 : 0);
  return sor[oszlop]!;
}

/** 1. függ. 6.5. táblázat – Hőtároló képesség alapértékei Cm,eff/AN [kJ/m²K]. */
export const HOTAROLO_KEPESSEG = {
  konnyu: { ertek: 95, megnevezes: 'Könnyű épület' },
  kozepes: { ertek: 190, megnevezes: 'Közepesen nehéz épület' },
  nehez: { ertek: 280, megnevezes: 'Nehéz épület' },
  nagyon_nehez: { ertek: 560, megnevezes: 'Nagyon nehéz épület' },
} as const;

/** 1. függ. 6.7.1 és 6.8.1 – a hasznosítási tényező referencia értékei havi módszernél. */
export const HASZNOSITAS = { a0: 1.0, tau0: 15 } as const;

/** 1. függ. 6.3.1 – keretarány alapértékek és a beesési szög korrekció. */
export const KERETARANY = { altalanos: 0.3, regi_1990_elott: 0.25, felulvilagito_telikert: 0.1, kismeretu_05m2_alatt: 0.5 } as const;
export const F_UVEGEZES_BEESESI = 0.9;

// ---------------------------------------------------------------------------------------------
// 2. függelék 2. pont – profiladatok

/** 2. függ. 2.1. táblázat – lakóépület (kötelező). */
export const PROFIL_LAKO = {
  napiOra: 24,
  evesNap: 365,
  thetaFutes: 20,
  thetaHutes: 26,
  nSzuks: 0.5,
  qb: 5,
} as const;

/** 2. függ. 2.2. táblázat – HMV nettó hőigény lakóépületre [kWh/m²év] (kötelező). */
export const HMV_LAKO = { csaladi_haz: 25, egyeb_lakoepulet: 30 } as const;

/** 2. függ. 2.3. táblázat – éjszakai szellőztetés légcsereszám növekménye nyáron. */
export const EJSZAKAI_SZELLOZES = { egy_homlokzat: 3, tobb_homlokzat: 6 } as const;
/** 1. függ. 6.2.3 – béjjel egyszerűsített érték. */
export const B_EJJEL = 1.5;

/** 2. függ. 2.4. táblázat – tömítetlenségből származó légcsere növekedés nfilt [1/h].
 * A „szélvédett” oszlop a forrásban összevont cella: minden szintszámra ugyanaz az érték. */
export type Legzaras = 'gyenge' | 'kozepes' | 'jo' | 'kivalo';
export type NyilasElhelyezes = 'egy_homlokzat' | 'tobb_homlokzat';
export type SzintSzam = '1-2' | '3-6' | '7-';
const NFILT_TABLA = {
  gyenge: { egy_homlokzat: { szelvedett: 0.2, szelnek_kitett: { '1-2': 0.35, '3-6': 0.4, '7-': 0.6 } },
            tobb_homlokzat: { szelvedett: 0.4, szelnek_kitett: { '1-2': 0.65, '3-6': 0.75, '7-': 1.0 } } },
  kozepes: { egy_homlokzat: { szelvedett: 0.05, szelnek_kitett: { '1-2': 0.1, '3-6': 0.15, '7-': 0.25 } },
             tobb_homlokzat: { szelvedett: 0.1, szelnek_kitett: { '1-2': 0.2, '3-6': 0.25, '7-': 0.4 } } },
} as const;
export function nfilt(p: { legzaras: Legzaras; elhelyezes: NyilasElhelyezes; szintek?: SzintSzam; szelnekKitett?: boolean }): number {
  if (p.legzaras === 'kivalo') return 0.0; // MSZ EN ISO 9972 mérés szükséges (n50/q50 feltételek)
  if (p.legzaras === 'jo') return p.elhelyezes === 'egy_homlokzat' ? 0.03 : 0.06;
  const t = NFILT_TABLA[p.legzaras][p.elhelyezes];
  return p.szelnekKitett ? t.szelnek_kitett[p.szintek ?? '1-2'] : t.szelvedett;
}

/** 2. függ. 2.5. táblázat – szakaszos fűtés σF, lakóépület. */
export function sigmaFLako(programozhato: boolean, tau: number): number {
  if (!programozhato) return 1.0;
  return tau > 24 ? 1.0 : 0.95;
}
/** 2. függ. 2.6. táblázat – szakaszos hűtés σH. */
export const SIGMA_H = { rovidebb_2_nap: 1.0, min_2_nap: 0.8 } as const;

/** 2. függ. 3.1. táblázat – fűtőérték/égéshő hányadosa Ffé/éh. */
export const FUTOERTEK_EGESHO = { foldgaz: 0.9, biomassza: 0.93, szen: 0.96, olaj: 0.94, nem_egheto: 1.0 } as const;

// ---------------------------------------------------------------------------------------------
// 2. függelék 4. pont – tájékoztató műszaki adatok (meglévő épületekhez, termékadat hiányában)

/** 4.1. táblázat – üvegezések. */
export const UVEGEZES_TAJEKOZTATO = [
  { kod: 'egyreteg', megnevezes: 'Egyrétegű üvegezés (4 mm float)', Ug: 5.8, gn: 0.85, lowe: false },
  { kod: 'ketreteg_bevonat_nelkul', megnevezes: 'Kétrétegű (4-12-4) bevonat nélkül', Ug: 2.9, gn: 0.75, lowe: false },
  { kod: 'ketreteg_lowe_015', megnevezes: 'Kétrétegű (4-12-4) egy low-e bevonattal (ε=0,15)', Ug: 1.6, gn: 0.7, lowe: true },
  { kod: 'ketreteg_lowe_argon', megnevezes: 'Kétrétegű (4-16-4) low-e (ε<0,05), argon', Ug: 1.2, gn: 0.59, lowe: true },
  { kod: 'ketreteg_reflektiv', megnevezes: 'Reflektív kétrétegű hővédő (g=0,32), argon', Ug: 1.1, gn: 0.32, lowe: true },
  { kod: 'haromreteg_lowe_argon', megnevezes: 'Háromrétegű (4-12-4-12-4) két low-e, argon', Ug: 0.8, gn: 0.55, lowe: true },
] as const;

/** 4.2. táblázat – keretek Uk [W/m²K]. */
export const KERET_TAJEKOZTATO = [
  { kod: 'pvc_2', megnevezes: 'Műanyag (kétkamrás)', Uk: 2.2, anyag: 'pvc' },
  { kod: 'pvc_3', megnevezes: 'Műanyag (háromkamrás)', Uk: 2.0, anyag: 'pvc' },
  { kod: 'pvc_4', megnevezes: 'Műanyag (négykamrás)', Uk: 1.6, anyag: 'pvc' },
  { kod: 'pvc_5', megnevezes: 'Műanyag (ötkamrás)', Uk: 1.3, anyag: 'pvc' },
  { kod: 'pvc_tobb', megnevezes: 'Műanyag (többkamrás)', Uk: 1.0, anyag: 'pvc' },
  { kod: 'fa_50', megnevezes: 'Fa (50 mm)', Uk: 2.2, anyag: 'fa' },
  { kod: 'fa_70', megnevezes: 'Fa (70 mm)', Uk: 2.0, anyag: 'fa' },
  { kod: 'fa_80', megnevezes: 'Fa (80 mm)', Uk: 1.8, anyag: 'fa' },
  { kod: 'fa_100', megnevezes: 'Fa (100 mm)', Uk: 1.6, anyag: 'fa' },
  { kod: 'fa_150', megnevezes: 'Fa (150 mm)', Uk: 1.2, anyag: 'fa' },
  { kod: 'fem_0', megnevezes: 'Fém (termikus elválasztás nélkül)', Uk: 5.8, anyag: 'fem' },
  { kod: 'fem_gyenge', megnevezes: 'Fém (gyenge termikus elválasztás)', Uk: 3.3, anyag: 'fem' },
  { kod: 'fem_kozepes', megnevezes: 'Fém (közepes termikus elválasztás)', Uk: 2.6, anyag: 'fem' },
  { kod: 'fem_eros', megnevezes: 'Fém (erős termikus elválasztás)', Uk: 2.0, anyag: 'fem' },
] as const;

/** 4.3. táblázat – keret–üvegezés Ψk,ü [W/mK]. Kulcs: keret (fa_pvc | fem_termikus | fem_nelkul) × üvegezés (lowe | bevonat_nelkul) × távtartó (fem | fejlett). */
export const PSI_KERET_UVEG = {
  fa_pvc: { lowe: { fem: 0.08, fejlett: 0.06 }, bevonat_nelkul: { fem: 0.06, fejlett: 0.05 } },
  fem_termikus: { lowe: { fem: 0.11, fejlett: 0.08 }, bevonat_nelkul: { fem: 0.08, fejlett: 0.06 } },
  fem_nelkul: { lowe: { fem: 0.05, fejlett: 0.04 }, bevonat_nelkul: { fem: 0.02, fejlett: 0.01 } },
} as const;

/** 4.5. táblázat – mobil árnyékolók gárny [–]; null: a forrás szerint nem értelmezett. */
export const ARNYEKOLO_G = [
  { kod: 'spaletta', megnevezes: 'Spaletta', belul: null, kivul: 0.15 },
  { kod: 'redony', megnevezes: 'Redőny', belul: null, kivul: 0.1 },
  { kod: 'reluxa_vilagos', megnevezes: 'Reluxa, világos', belul: 0.45, kivul: 0.15 },
  { kod: 'reluxa_sotet', megnevezes: 'Reluxa, sötét', belul: 0.8, kivul: 0.35 },
  { kod: 'textil_vilagos', megnevezes: 'Textil roló, világos', belul: 0.55, kivul: 0.35 },
  { kod: 'textil_sotet', megnevezes: 'Textil roló, sötét', belul: 0.85, kivul: 0.6 },
  { kod: 'rolo_reflexiv', megnevezes: 'Roló reflexív (alu) bevonattal', belul: 0.2, kivul: 0.1 },
  { kod: 'fuggony_vilagos', megnevezes: 'Függöny, világos', belul: 0.8, kivul: null },
  { kod: 'fuggony_sotet', megnevezes: 'Függöny, sötét', belul: 0.95, kivul: null },
] as const;
