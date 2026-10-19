/**
 * Épülettechnikai rendszerek táblázatai – 9/2023 ÉKM számítási módszer, 1. függelék 8–13. fejezet
 * (egyszerűsített módszer). Fajlagos értékek rendszer-alapterületre (Arszr) vetítve; köztes értéknél lineáris
 * interpoláció. `null`: a forrásban üres cella (lásd interpolacio.ts).
 */

const A_KAZAN = [100, 150, 200, 300, 500, 750, 1000, 1500, 2500, 5000, 10000] as const;
const A_ELOSZTAS = [100, 150, 200, 300, 500, 501] as const; // „> 500” sor: 500 felett állandó
const A_SZIV = A_KAZAN;

// --- 8.3 Hőtermelők -----------------------------------------------------------------------------

/** 8.1. táblázat – fűtött téren KÍVÜL elhelyezett folyékony/gáz tüzelésű kazánok εF és WF,term/Arszr [kWh/m²év]. */
export const KAZAN_KIVUL = {
  forras: '1. függ. 8.1. táblázat',
  A: A_KAZAN,
  allando: [1.38, 1.33, 1.3, 1.27, 1.23, 1.21, 1.2, 1.18, 1.16, 1.14, 1.13],
  alacsony: [1.14, 1.13, 1.12, 1.12, 1.11, 1.1, 1.1, 1.09, 1.09, 1.08, 1.08],
  kondenzacios: [1.05, 1.05, 1.04, 1.04, 1.03, 1.03, 1.02, 1.02, 1.02, 1.01, 1.01],
  segedenergia: [0.79, 0.66, 0.58, 0.48, 0.38, 0.31, 0.27, 0.23, 0.18, 0.13, 0.09],
} as const;

/** 8.2. táblázat – fűtött téren BELÜL elhelyezett kazánok. A forrásban az alacsony hőm. és kondenzációs oszlop csak
 * 100 m²-nél ad értéket, az alacsony hőm. oszlop fejléce is hibás („[kWh/m²év]”). */
export const KAZAN_BELUL = {
  forras: '1. függ. 8.2. táblázat',
  A: A_KAZAN,
  allando: [1.3, 1.24, 1.21, 1.18, 1.15, null, null, null, null, null, null],
  alacsony: [1.08, null, null, null, null, null, null, null, null, null, null],
  kondenzacios: [1.01, null, null, null, null, null, null, null, null, null, null],
  segedenergia: [0.79, 0.66, 0.58, 0.48, 0.38, 0.31, 0.27, 0.23, 0.18, 0.13, 0.09],
} as const;

/** 8.3. táblázat – szilárd és biomassza kazánok εF. */
export const SZILARD_KAZAN_EPSZILON_F = { vegyes: 1.85, tuzifa: 1.75, pellet: 1.1, faelgazosito: 1.2 } as const;
/** 8.4. táblázat – szilárd és biomassza kazánok segédenergiája [kWh/m²év]; a 9.6. táblázat azonos. */
export const SZILARD_KAZAN_SEGED = {
  forras: '1. függ. 8.4. táblázat',
  A: [100, 150, 200, 300, 500],
  vegyes: [0, 0, 0, 0, 0],
  tuzifa_faelgazosito: [0.19, 0.13, 0.1, 0.07, 0.04],
  pellet: [1.96, 1.84, 1.78, 1.71, 1.65],
} as const;

/** 8.5. táblázat – elektromos hőszivattyúk εF (ErP hatályán kívül). Kulcs: hőforrás × fűtővíz. */
export const HOSZIVATTYU_EPSZILON_F = {
  viz_viz: { '55/45': 0.23, '35/28': 0.19 },
  talaj_viz: { '55/45': 0.27, '35/28': 0.23 },
  levego_viz: { '55/45': 0.37, '35/28': 0.3 },
  tavozo_levego_viz: { '55/45': 0.3, '35/28': 0.24 },
  levego_levego: 0.4,
} as const;
/** 8.6. táblázat – földgáz üzemű hőszivattyú, levegő/víz 45/40 °C. */
export const GAZ_HOSZIVATTYU_EPSZILON_F = 0.58;

/** 8.3.3 – távhő: εF = 1,01; segédenergia hőközpontonként 215 kWh/év. */
export const TAVHO_FUTES = { epszilonF: 1.01, segedenergiaHokozpontonkentKWh: 215 } as const;

/** 8.7. táblázat – egyéb (egyedi, elektromos) fűtőberendezések εF. */
export const EGYEB_FUTES_EPSZILON_F = [
  { kod: 'el_hosugarzo', megnevezes: 'Elektromos hősugárzó, elektromos fűtőfilm', eF: 1.0, energiahordozo: 'villamos' },
  { kod: 'el_kazan', megnevezes: 'Elektromos kazán', eF: 1.11, energiahordozo: 'villamos' },
  { kod: 'el_hotarolos', megnevezes: 'Elektromos hőtárolós kályha', eF: 1.03, energiahordozo: 'villamos' },
  { kod: 'cserepkalyha', megnevezes: 'Fatüzelésű cserépkályha', eF: 1.6, energiahordozo: 'bio_szilard' },
  { kod: 'kandallo_zart', megnevezes: 'Kandalló (zárt, hagyományos)', eF: 1.8, energiahordozo: 'bio_szilard' },
  { kod: 'kalyha', megnevezes: 'Egyedi fűtés kályhával', eF: 1.9, energiahordozo: 'bio_szilard' },
  { kod: 'kandallo_nyitott', megnevezes: 'Kandalló (nyitott, hagyományos)', eF: 4.0, energiahordozo: 'bio_szilard' },
  { kod: 'gazkonvektor_szab_nelkul', megnevezes: 'Gázkonvektor hőmérsékletszabályozó nélkül vagy csak folyamatos szabályozással', eF: 1.4, energiahordozo: 'fosszilis_gaz' },
  { kod: 'gazkonvektor_kombinalt', megnevezes: 'Gázkonvektor kombinált hőmérsékletszabályozással, hagyományos', eF: 1.32, energiahordozo: 'fosszilis_gaz' },
  { kod: 'gazkonvektor_nyilt_89', megnevezes: 'Gázkonvektor, nyílt égésterű, gravitációs kéménybe kötött, csökkentett terhelésen ≥ 89%', eF: 1.12, energiahordozo: 'fosszilis_gaz' },
  { kod: 'gazkonvektor_kulsofali_93', megnevezes: 'Gázkonvektor, külsőfali, csökkentett terhelésen ≥ 93%', eF: 1.07, energiahordozo: 'fosszilis_gaz' },
] as const;

// --- 8.5 Hőelosztás ----------------------------------------------------------------------------

/** Méretezési hőfoklépcsők; az interpolációhoz a közepes vízhőmérséklet és 20 °C különbségét használjuk
 * („közepes hőmérsékletkülönbségre viszonyított lineáris interpoláció”). */
export const HOFOKLEPCSOK = ['90/70', '70/55', '55/45', '35/28'] as const;
export type Hofoklepcso = (typeof HOFOKLEPCSOK)[number];
export function kozepesHomersekletKulonbseg(elore: number, vissza: number, helyiseg = 20): number {
  return (elore + vissza) / 2 - helyiseg;
}

/** 8.8. táblázat – hőelosztás fajlagos vesztesége, vízszintes vezetékek fűtött téren KÍVÜL [kWh/m²év]. */
export const ELOSZTAS_KIVUL = {
  forras: '1. függ. 8.8. táblázat',
  A: A_ELOSZTAS,
  '90/70': [13.8, 10.3, 8.5, 6.8, 5.4, 4.6],
  '70/55': [10.3, 7.7, 6.3, 5.0, 3.9, 3.4],
  '55/45': [7.8, 5.8, 4.8, 3.7, 2.9, 2.5],
  '35/28': [4.0, 2.9, 2.3, 1.8, 1.3, 1.1],
} as const;
/** 8.9. táblázat – hőelosztás fajlagos vesztesége, vízszintes vezetékek fűtött téren BELÜL [kWh/m²év]. */
export const ELOSZTAS_BELUL = {
  forras: '1. függ. 8.9. táblázat',
  A: A_ELOSZTAS,
  '90/70': [4.1, 3.6, 3.3, 3.0, 2.8, 2.7],
  '70/55': [2.9, 2.5, 2.3, 2.1, 2.0, 1.9],
  '55/45': [2.1, 1.8, 1.6, 1.5, 1.4, 1.3],
  '35/28': [0.7, 0.6, 0.6, 0.5, 0.5, 0.5],
} as const;

// --- 8.6 Szabályozás ---------------------------------------------------------------------------

/** 8.10. és 8.11. táblázat – alapértékek εF,szab,0 (szabad és beágyazott fűtőfelület azonos). */
export const SZAB_ALAP = {
  nincs: { megnevezes: 'Szabályozás nélkül vagy központi előremenő-hőm. szabályozással, helyiségszabályozás nélkül', ertek: 1.149 },
  ref_helyiseg_p: { megnevezes: 'Szabályozás referencia helyiségre (P-szabályozó vagy ismeretlen)', ertek: 1.083 },
  ref_helyiseg_pi: { megnevezes: 'Referencia helyiség PI-szabályozó / központi előremenő + helyiségenkénti szabályozás', ertek: 1.042 },
  optimalizalt: { megnevezes: 'Optimalizációs funkcióval (jelenlétérzékelő, adaptív)', ertek: 1.03 },
} as const;
/** 8.10. táblázat korrekciók – szabad fűtőfelületek. */
export const SZAB_SZABAD = {
  hofoklepcso_ketcsoves: { '90/70': 0.036, '70/55': 0.021, '55/45': 0.015, '45/35': 0.012 },
  hofoklepcso_egycsoves: { '90/70': 0.048, '70/55': 0.036 },
  ventilatoros_radiator: 0.0,
  hatarolo: { belsofali: 0.039, kulsofali: 0.009, uveg_elott_hotukor_nelkul: 0.051, uveg_elott_hotukorrel: 0.036 },
} as const;
/** 8.11. táblázat korrekciók – beágyazott fűtőfelületek. */
export const SZAB_BEAGYAZOTT = {
  rendszer: { padlo_nedves: 0.021, padlo_szaraz: 0.012, padlo_vekony: 0.006, fal: 0.045, mennyezet: 0.063 },
  hatarolo: { min_szig_nelkul: 0.042, min_szig: 0.015, min_szig_100_szazalekkal_jobb: 0.003 },
} as const;
/** 8.10./8.11. Korrekció 3 – helyiségenkénti szabályozás. */
export const SZAB_HELYISEG = { nincs: 0, kezi: -0.03, termosztatikus: -0.06, halozatba_integralt: -0.072 } as const;
/** 8.12. táblázat – beszabályozás. Kétcsöves: [max. 10 hőleadó, 10 felett]. */
export const SZAB_BESZABALYOZAS = {
  egycsoves: { nincs: 0.042, statikus: 0.024, dinamikus: 0.018, dinamikus_terhelesfuggo_visszatero: 0.012, dinamikus_terhelesfuggo_hofoklepcso: 0.006 },
  ketcsoves: {
    nincs: [0.036, 0.036],
    statikus_csoportos_nelkul: [0.018, 0.024],
    statikus_csoportos_statikus: [0.012, 0.018],
    statikus_csoportos_dinamikus: [0.006, 0.012],
    dinamikus_fuetestenkent: [0.0, 0.0],
  },
} as const;
/** 8.13. táblázat – villamos fűtés εF,szab. */
export const SZAB_VILLAMOS = {
  kulso_fal: { kozvetlen_p: 1.066, kozvetlen_pi: 1.042, hotarolos_nincs: 1.161, hotarolos_p: 1.089, hotarolos_pid: 1.066 },
  belso_fal: { kozvetlen_p: 1.089, kozvetlen_pi: 1.066, hotarolos_nincs: 1.185, hotarolos_p: 1.113, hotarolos_pid: 1.089 },
} as const;
/** 8.14. táblázat – közvetlen helyiséglevegő-fűtés εF,szab. */
export const SZAB_LEVEGO = {
  gazkonvektor_termosztat_kulso: 1.2,
  gazkonvektor_termosztat_belso: 1.24,
  gazkonvektor_magasabb_rendu_kulso: 1.12,
  kalyha_kandallo: 1.2,
  legfutes_alacsony: 1.066,
  legfutes_pi_pid: 1.042,
} as const;

// --- 8.7 Hőtárolás, 8.8 szivattyúk -------------------------------------------------------------

/** 8.15. táblázat – fűtési puffertároló fajlagos vesztesége és segédenergiája [kWh/m²év]. Szilárd/biomassza: veszteség × 2,6. */
export const FUTES_TAROLO = {
  forras: '1. függ. 8.15. táblázat',
  A: A_KAZAN,
  belul_55_45: [0.3, 0.2, 0.2, 0.1, null, null, 0.0, null, null, null, null],
  belul_35_28: [0.1, null, null, 0.0, null, null, null, null, null, null, null],
  kivul_55_45: [2.6, 1.9, 1.5, 1.1, 0.7, 0.5, 0.4, 0.3, 0.2, 0.2, 0.2],
  kivul_35_28: [1.4, 1.0, 0.8, 0.6, 0.4, 0.3, 0.2, 0.2, 0.1, 0.1, 0.1],
  segedenergia: [0.63, 0.43, 0.34, 0.24, 0.16, 0.12, 0.1, 0.08, 0.07, 0.06, 0.05],
  szilardSzorzo: 2.6,
} as const;

/** 8.16. táblázat – fűtési keringtetés fajlagos villamos segédenergiája [kWh/m²év]. */
export const FUTES_SZIVATTYU = {
  forras: '1. függ. 8.16. táblázat',
  A: A_SZIV,
  fordulatszam_szabad_20K: [1.69, 1.12, 0.86, 0.61, 0.42, 0.33, 0.28, 0.23, 0.2, 0.17, 0.16],
  fordulatszam_szabad_15K: [1.85, 1.24, 0.95, 0.68, 0.48, 0.38, 0.33, 0.28, 0.24, 0.22, 0.2],
  fordulatszam_szabad_10K: [1.98, 1.35, 1.06, 0.78, 0.57, 0.47, 0.42, 0.37, 0.33, 0.3, 0.28],
  fordulatszam_beagyazott_7K: [3.52, 2.4, 1.88, 1.39, 1.01, 0.83, 0.74, 0.65, 0.58, 0.53, 0.5],
  allando_szabad_20K: [2.02, 1.42, 1.11, 0.81, 0.57, 0.45, 0.39, 0.33, 0.28, 0.24, 0.22],
  allando_szabad_15K: [2.22, 1.56, 1.24, 0.91, 0.65, 0.52, 0.46, 0.39, 0.34, 0.3, 0.28],
  allando_szabad_10K: [2.38, 1.71, 1.38, 1.04, 0.78, 0.64, 0.58, 0.51, 0.46, 0.42, 0.4],
  allando_beagyazott_7K: [4.22, 3.03, 2.44, 1.85, 1.38, 1.14, 1.02, 0.9, 0.81, 0.74, 0.7],
  epm_EEI_023: [1.44, 0.9, 0.67, 0.46, 0.31, 0.24, 0.2, 0.16, 0.14, 0.12, 0.11],
  epm_EEI_017: [1.28, 0.75, 0.55, 0.36, 0.23, 0.18, 0.14, 0.11, 0.1, 0.09, 0.08],
} as const;
/** 8.17. táblázat – fan coil ventilátor segédenergia, egész éves üzem [kWh/m²év]. */
export const FANCOIL_SEGED = { padlon_oldalfali_mennyezet_alatti: 2.0, almennyezeti: 2.4, legcsatornazhato: 2.8, negy_iranyban_fuvo: 4.4 } as const;

// --- 9. HMV ------------------------------------------------------------------------------------

/** 9.3. táblázat – HMV havi részarány lakóépületre [%] (részletes számításhoz). */
export const HMV_HAVI_ARANY = [9.09, 9.22, 8.84, 8.8, 8.5, 7.66, 6.87, 6.95, 7.92, 8.41, 8.7, 9.04] as const;

/** 9.4. táblázat – kazánüzemű HMV εHMV és segédenergia [kWh/m²év]. Kombikazán: ÁF = átfolyós (V<2 l), KT = kis tárolós (2<V<10 l). */
export const HMV_KAZAN = {
  forras: '1. függ. 9.4. táblázat',
  A: A_KAZAN,
  allando: [1.82, 1.71, 1.64, 1.56, 1.46, 1.4, 1.36, 1.31, 1.26, 1.21, 1.17],
  alacsony: [1.21, 1.19, 1.18, 1.17, 1.15, 1.14, 1.14, 1.13, 1.12, 1.11, 1.1],
  kondenzacios: [1.17, 1.15, 1.14, 1.13, 1.12, 1.11, 1.1, 1.1, 1.09, 1.08, 1.08],
  kombi_AF: [1.27, 1.22, 1.2, 1.17, 1.15, null, null, null, null, null, null],
  kombi_KT: [1.41, 1.32, 1.27, 1.22, 1.18, null, null, null, null, null, null],
  kond_kombi_AF: [1.23, 1.19, 1.16, 1.14, 1.11, null, null, null, null, null, null],
  kond_kombi_KT: [1.36, 1.28, 1.24, 1.19, 1.15, null, null, null, null, null, null],
  seged_kombi: [0.2, 0.19, 0.18, 0.17, 0.17, null, null, null, null, null, null],
  seged_mas: [0.3, 0.24, 0.21, 0.17, 0.13, 0.11, 0.1, 0.084, 0.069, 0.054, 0.044],
} as const;
/** 9.5. táblázat – szilárd/biomassza HMV εHMV. Segédenergia: 9.6. táblázat = 8.4. táblázat. */
export const HMV_SZILARD_EPSZILON = { vegyes: 2.0, tuzifa: 1.9, pellet: 1.2, faelgazosito: 1.3 } as const;
/** 9.7. táblázat – elektromos HMV εHMV (ErP hatályán kívül). */
export const HMV_ELEKTROMOS_EPSZILON = {
  futopatron: 1.0,
  atfolyos_tarolo: 1.0,
  hsz_levego: 0.45,
  hsz_viz: 0.34,
  hsz_talaj: 0.38,
  hsz_tavozo_levego: 0.38,
  hsz_hovisszanyero_06: 0.4,
  hsz_hovisszanyero_08: 0.42,
  hsz_pince_levego: 0.33,
} as const;
/** 9.8. táblázat – egyéb HMV készítők. */
export const HMV_EGYEB = {
  gaz_bojler: { eHMV: 1.22, seged: 0, energiahordozo: 'fosszilis_gaz' },
  atfolyos_gaz: { eHMV: 1.3, seged: 0, energiahordozo: 'fosszilis_gaz' },
  szilard_furdohenger: { eHMV: 2.0, seged: 0, energiahordozo: 'bio_szilard' },
} as const;
/** 9.3.4 – távhő HMV: εHMV = 1,01; segédenergia hőközpontonként 265 kWh/év. */
export const TAVHO_HMV = { epszilon: 1.01, segedenergiaHokozpontonkentKWh: 265 } as const;

/** 9.9. és 9.10. táblázat – HMV tárolás vesztesége a nettó HMV igény %-ában. */
export const HMV_TAROLO = {
  forras: '1. függ. 9.9.–9.10. táblázat',
  A_belul: [100, 150, 200, 300, 500, 501],
  belul: {
    indirekt: [24, 17, 14, 10, 7, 5],
    el_csucson_kivul: [20, 16, 14, 12, 8, 6],
    el_nappali: [13, 10, 8, 7, 6, 5],
    gaz_bojler: [78, 66, 58, 51, 43, 35],
  },
  A_kivul: A_KAZAN,
  kivul: {
    indirekt: [28, 21, 16, 12, 9, 6, 5, 4, 4, 3, 2],
    el_csucson_kivul: [24, 20, 16, 14, 10, 8, 8, 7, 6, 5, 4],
    el_nappali: [16, 12, 10, 8, 6, 5, 4, 4, 3, 2, 2],
    gaz_bojler: [97, 80, 69, 61, 53, 49, 46, 40, 32, 26, 22],
  },
} as const;

/** 9.11. táblázat – HMV elosztás vesztesége a nettó HMV igény %-ában. „Cirkuláció nélkül” oszlop csak 100 m²-nél kitöltött. */
export const HMV_ELOSZTAS = {
  forras: '1. függ. 9.11. táblázat',
  A: [100, 150, 200, 300, 500, 750, 751],
  cirk_kivul: [28, 22, 19, 17, 14, 13, 13],
  cirk_belul: [24, 19, 17, 15, 13, 12, 12],
  nincs_cirk_kivul: [13, null, null, null, null, null, null],
  nincs_cirk_belul: [10, null, null, null, null, null, null],
} as const;

/** 9.12. táblázat – cirkulációs szivattyú segédenergia [kWh/m²év]. */
export const HMV_CIRK_SZIVATTYU = {
  forras: '1. függ. 9.12. táblázat',
  A: [100, 150, 200, 300, 500, 750, 1000, 1500, 2500, 5000, 5001],
  ismeretlen: [1.14, 0.82, 0.66, 0.49, 0.34, 0.27, 0.22, 0.18, 0.14, 0.11, 0.1],
  EEI_023: [1.06, 0.73, 0.55, 0.38, 0.26, 0.2, 0.16, 0.13, 0.11, 0.09, 0.08],
  EEI_017: [0.98, 0.65, 0.44, 0.33, 0.22, 0.17, 0.13, 0.11, 0.1, 0.08, 0.07],
} as const;

/** 9.13 képlet – napkollektoros szolárköri szivattyú [kWh/év]: 2·(25 + 2·Akoll). */
export const szolarSzivattyu = (Akoll: number) => 2 * (25 + 2 * Akoll);

/** 9.7 képlet – napkollektor teljesítménycsökkentő tényező; αm hajlásszög [°], γm tájolás [°] (K = -90, D = 0, Ny = +90). */
export function kollektorK(alfa: number, gamma: number): number {
  return (9.88e-9 * alfa ** 2 - 1.18e-6 * alfa) * gamma ** 2 + (-4.99e-8 * alfa ** 2 + 9.25e-6 * alfa) * gamma + (-1.17e-4 * alfa ** 2 + 9.11e-3 * alfa + 0.821);
}

/** 9.1. és 9.2. táblázat – kollektortermelés ideális tájolásnál [kWh/év]; sor: bruttó kollektorfelület [m²], oszlop: rendszer-alapterület [m²]. */
export const KOLLEKTOR_A_RENDSZER = [40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 200, 250, 300] as const;
export const KOLLEKTOR_FELULET = [1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 10] as const;
export const KOLLEKTOR_SIK: readonly (readonly number[])[] = [
  [725, 779, 817, 845, 867, 884, 898, 908, 917, 924, 930, 936, 957, 971, 980],
  [844, 944, 1006, 1053, 1089, 1119, 1142, 1160, 1175, 1187, 1198, 1207, 1245, 1268, 1284],
  [911, 1054, 1159, 1230, 1283, 1326, 1362, 1388, 1411, 1430, 1446, 1461, 1517, 1553, 1578],
  [963, 1123, 1265, 1373, 1451, 1510, 1558, 1595, 1626, 1653, 1676, 1696, 1775, 1826, 1861],
  [1036, 1224, 1395, 1547, 1687, 1796, 1888, 1948, 1999, 2043, 2081, 2115, 2250, 2337, 2397],
  [1089, 1295, 1485, 1661, 1822, 1971, 2109, 2206, 2296, 2367, 2423, 2472, 2672, 2803, 2893],
  [1138, 1349, 1554, 1745, 1925, 2093, 2247, 2377, 2499, 2599, 2686, 2765, 3046, 3227, 3352],
  [1184, 1398, 1608, 1813, 2005, 2187, 2361, 2502, 2634, 2758, 2875, 2979, 3374, 3610, 3775],
  [1231, 1445, 1658, 1868, 2072, 2264, 2448, 2605, 2750, 2883, 3008, 3126, 3645, 3956, 4165],
  [1291, 1539, 1752, 1968, 2178, 2387, 2590, 2762, 2924, 3077, 3223, 3360, 4014, 4518, 4848],
];
export const KOLLEKTOR_VAKUUM: readonly (readonly number[])[] = [
  [904, 982, 1025, 1057, 1081, 1100, 1116, 1127, 1137, 1145, 1152, 1159, 1183, 1198, 1208],
  [1023, 1166, 1268, 1326, 1367, 1399, 1426, 1446, 1463, 1477, 1489, 1500, 1541, 1568, 1585],
  [1096, 1279, 1424, 1539, 1620, 1668, 1708, 1738, 1763, 1785, 1803, 1820, 1883, 1924, 1951],
  [1145, 1356, 1535, 1681, 1808, 1902, 1964, 2006, 2041, 2071, 2097, 2119, 2209, 2266, 2305],
  [1225, 1454, 1669, 1875, 2046, 2196, 2332, 2432, 2515, 2579, 2623, 2661, 2814, 2912, 2979],
  [1271, 1532, 1762, 1980, 2192, 2390, 2558, 2693, 2813, 2927, 3022, 3101, 3359, 3506, 3608],
  [1289, 1581, 1838, 2069, 2290, 2504, 2713, 2883, 3028, 3164, 3281, 3392, 3842, 4053, 4194],
  [1303, 1603, 1890, 2144, 2376, 2599, 2815, 3002, 3182, 3345, 3484, 3617, 4201, 4554, 4741],
  [1311, 1619, 1916, 2199, 2451, 2683, 2908, 3101, 3286, 3463, 3634, 3790, 4462, 4963, 5248],
  [1320, 1639, 1949, 2248, 2541, 2813, 3063, 3270, 3467, 3655, 3835, 4007, 4866, 5525, 6048],
];

/** 9.5 képlet: Qkoll,max (9.1./9.2. táblázat, kétirányú lineáris interpoláció a táblázat határain belül) · k (9.7). */
export function kollektorTermeles(tipus: 'sik' | 'vakuum', Akoll: number, Arszr: number, alfa: number, gamma: number): { Qkoll: number; Qmax: number; k: number; tablanKivul: boolean } {
  const tab = tipus === 'sik' ? KOLLEKTOR_SIK : KOLLEKTOR_VAKUUM;
  const hely = (x: number, sor: readonly number[]) => {
    const v = Math.min(Math.max(x, sor[0]!), sor[sor.length - 1]!);
    let i = 0;
    while (i < sor.length - 2 && v > sor[i + 1]!) i++;
    return { i, t: (v - sor[i]!) / (sor[i + 1]! - sor[i]!) };
  };
  const tablanKivul = Akoll < KOLLEKTOR_FELULET[0] || Akoll > KOLLEKTOR_FELULET[KOLLEKTOR_FELULET.length - 1]! || Arszr < KOLLEKTOR_A_RENDSZER[0] || Arszr > KOLLEKTOR_A_RENDSZER[KOLLEKTOR_A_RENDSZER.length - 1]!;
  const r = hely(Akoll, KOLLEKTOR_FELULET), c = hely(Arszr, KOLLEKTOR_A_RENDSZER);
  const q = (i: number, j: number) => tab[i]![j]!;
  const Qmax = (1 - r.t) * ((1 - c.t) * q(r.i, c.i) + c.t * q(r.i, c.i + 1)) + r.t * ((1 - c.t) * q(r.i + 1, c.i) + c.t * q(r.i + 1, c.i + 1));
  const k = kollektorK(alfa, gamma);
  return { Qkoll: Qmax * k, Qmax, k, tablanKivul };
}

// --- 11. Hűtés, 13. napelem --------------------------------------------------------------------

// (A hűtés táblázatai: tablak/hutes.ts.)

/** 13.1. táblázat – napelemek fajlagos éves termelése [kWh/kWp], ≤ 20 kWp. */
export const PV_HAJLASSZOG = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90] as const;
export const PV_TERMELES = {
  K_Ny: [942, 934, 917, 892, 858, 812, 755, 688, 611, 527],
  DK_DNy: [942, 988, 1020, 1030, 1020, 988, 940, 873, 787, 686],
  D: [942, 1010, 1050, 1080, 1080, 1050, 1010, 935, 842, 727],
} as const;

// --- 10. Szellőzés ------------------------------------------------------------------------------

/** 10.2. táblázat – MISC: szellőztetés hatékonysága, légcsatorna-szivárgás, járulékos infiltráció. */
export const SZELL_MISC = { legcsatornas: 1.1, legcsatorna_nelkuli: 1.21 } as const;
/** 10.3. táblázat – CTRL: térfogatáram szabályozása. */
export const SZELL_CTRL = { kezi: 1.0, idozitos: 1.2, kozponti_igeny: 1.5, helyi_igeny: 2.0 } as const;
/** 10.4. táblázat – x: nemlinearitási kitevő a motor és vezérlés szerint. */
export const SZELL_X = { egyfokozatu: 1.0, ketfokozatu: 1.2, haromfokozatu: 1.5, fokozatmentes: 2.0 } as const;
/** 10.8. táblázat – ventilátor összhatásfoka (2010 előtti érték, pontosabb adat hiányában). */
export function ventilatorHatasfok(V: number): number { return V >= 10000 ? 0.7 : V >= 1000 ? 0.55 : 0.4; }
export const SZELL_FORRAS = '9/2023 ÉKM számítási módszer, 1. függelék 10.1.4–10.1.5, 10.2.–10.4. és 10.8. táblázat';

/** 13.1 képlet és 13.1. táblázat – napelem éves termelése [kWh/év]; tájolás: K/Ny, DK/DNy, D (É felé nem ad értéket a táblázat). */
export function napelemTermeles(kWp: number, tajolas: 'K_Ny' | 'DK_DNy' | 'D', hajlasszog: number): number {
  const y = PV_TERMELES[tajolas];
  const h = Math.min(Math.max(hajlasszog, 0), 90);
  const i = Math.min(Math.floor(h / 10), 8);
  const t = (h - PV_HAJLASSZOG[i]!) / 10;
  return kWp * (y[i]! + (y[i + 1]! - y[i]!) * t);
}
