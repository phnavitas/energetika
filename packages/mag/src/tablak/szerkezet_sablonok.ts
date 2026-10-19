/**
 * Szerkezetsablonok: a leggyakoribb hazai rétegrendek a kiegészítő rétegekkel (vakolatok, ragasztó, hőszigetelés,
 * fóliák). Minden réteg a beépített anyagkatalógus egy tételére hivatkozik (forrás ott); a vastagságok tipikus
 * tervezői alapértékek, felvétel után szabadon módosíthatók.
 */
export type SablonSzerep = 'fal' | 'padlas' | 'teto' | 'pincefodem' | 'padlo' | 'belso';
export interface SzerkezetSablon {
  kod: string; szerep: SablonSzerep; csoport: string; nev: string; leiras?: string;
  /** Belülről kifelé (padlónál felülről lefelé). */
  retegek: { anyagId: string; dCm: number }[];
}

const vak = { anyagId: 'meszcement_vakolat', dCm: 1.5 };
const ragaszto = { anyagId: 'ragasztotapasz', dCm: 0.5 };
const nemes = { anyagId: 'nemesvakolat', dCm: 0.2 };
const etics = (szig: string, d: number) => [ragaszto, { anyagId: szig, dCm: d }, ragaszto, nemes];

export const SZERKEZET_SABLONOK: readonly SzerkezetSablon[] = [
  // --- Homlokzati falak ---
  { kod: 'fal_tomor_tegla', szerep: 'fal', csoport: 'Tégla falazat', nev: 'Kisméretű tömör tégla 38 cm, hőszigetelés nélkül', retegek: [vak, { anyagId: 'tomor_tegla_falazat', dCm: 38 }, { anyagId: 'meszcement_vakolat', dCm: 2 }] },
  { kod: 'fal_tomor_tegla_eps', szerep: 'fal', csoport: 'Tégla falazat', nev: 'Kisméretű tömör tégla 38 cm + 15 cm grafitos EPS', retegek: [vak, { anyagId: 'tomor_tegla_falazat', dCm: 38 }, ...etics('eps80_grafit', 15)] },
  { kod: 'fal_tegla_kozetgyapot', szerep: 'fal', csoport: 'Tégla falazat', nev: 'Kisméretű tömör tégla 25 cm + 15 cm kőzetgyapot', retegek: [vak, { anyagId: 'tomor_tegla_falazat', dCm: 25 }, ...etics('kozetgyapot_homlokzati', 15)] },
  { kod: 'fal_vazkeramia_38', szerep: 'fal', csoport: 'Vázkerámia falazat', nev: 'Porotherm 38 N+F, hőszigetelés nélkül', retegek: [vak, { anyagId: 'porotherm_38_nf_m25', dCm: 38 }, { anyagId: 'meszcement_vakolat', dCm: 2 }, nemes] },
  { kod: 'fal_vazkeramia_30_eps', szerep: 'fal', csoport: 'Vázkerámia falazat', nev: 'Porotherm 30 N+F + 15 cm grafitos EPS', retegek: [vak, { anyagId: 'porotherm_30_nf_neo', dCm: 30 }, ...etics('eps80_grafit', 15)] },
  { kod: 'fal_vazkeramia_38_eps', szerep: 'fal', csoport: 'Vázkerámia falazat', nev: 'Porotherm 38 N+F + 10 cm grafitos EPS', retegek: [vak, { anyagId: 'porotherm_38_nf_m25', dCm: 38 }, ...etics('eps80_grafit', 10)] },
  { kod: 'fal_leiertherm_38_eps', szerep: 'fal', csoport: 'Vázkerámia falazat', nev: 'Leiertherm 38 N+F + 12 cm EPS', retegek: [vak, { anyagId: 'leiertherm_38_nf', dCm: 38 }, ...etics('eps80_feher', 12)] },
  { kod: 'fal_xtherm_44', szerep: 'fal', csoport: 'Vázkerámia falazat', nev: 'Porotherm 44 X-therm (hőszigetelő falazat, kiegészítő hőszigetelés nélkül)', retegek: [vak, { anyagId: 'porotherm_44_xtherm_rapid', dCm: 44 }, { anyagId: 'hoszigetelo_vakolat', dCm: 3 }, nemes] },
  { kod: 'fal_ytong_375', szerep: 'fal', csoport: 'Pórusbeton falazat', nev: 'Ytong Classic 37,5 cm, kiegészítő hőszigetelés nélkül', retegek: [{ anyagId: 'gipsz_vakolat', dCm: 1 }, { anyagId: 'ytong_classic_375', dCm: 37.5 }, { anyagId: 'meszcement_vakolat', dCm: 1 }, nemes] },
  { kod: 'fal_ytong_30_eps', szerep: 'fal', csoport: 'Pórusbeton falazat', nev: 'Ytong 30 cm + 10 cm grafitos EPS', retegek: [{ anyagId: 'gipsz_vakolat', dCm: 1 }, { anyagId: 'ytong_p2_05_30', dCm: 30 }, ...etics('eps80_grafit', 10)] },
  { kod: 'fal_ytong_multipor', szerep: 'fal', csoport: 'Pórusbeton falazat', nev: 'Ytong 30 cm + 14 cm Multipor', retegek: [{ anyagId: 'gipsz_vakolat', dCm: 1 }, { anyagId: 'ytong_p2_05_30', dCm: 30 }, ...etics('multipor', 14)] },
  { kod: 'fal_silka_kozetgyapot', szerep: 'fal', csoport: 'Mészhomoktégla falazat', nev: 'Silka mészhomok 17,5 cm + 20 cm kőzetgyapot', retegek: [{ anyagId: 'gipsz_vakolat', dCm: 1 }, { anyagId: 'meszhomok_silka_1800', dCm: 17.5 }, ...etics('kozetgyapot_homlokzati', 20)] },
  { kod: 'fal_vasbeton_eps', szerep: 'fal', csoport: 'Vasbeton fal', nev: 'Monolit vasbeton 20 cm + 15 cm grafitos EPS', retegek: [{ anyagId: 'gipsz_vakolat', dCm: 1 }, { anyagId: 'vasbeton_2300', dCm: 20 }, ...etics('eps80_grafit', 15)] },
  { kod: 'fal_zsaluko_eps', szerep: 'fal', csoport: 'Vasbeton fal', nev: 'Leier zsaluelem betonnal 25 cm + 15 cm EPS', retegek: [vak, { anyagId: 'zsalufal_leier_beton', dCm: 25 }, ...etics('eps80_feher', 15)] },
  { kod: 'fal_konnyu_fa', szerep: 'fal', csoport: 'Könnyűszerkezet', nev: 'Favázas könnyűszerkezet: 15 cm üveggyapot vázkitöltés + 6 cm fagyapot', leiras: 'A favázat a hőszigetelés homogénnek veszi: a váz hatását χ-vel vagy kézi ΔU-val kell figyelembe venni.', retegek: [{ anyagId: 'gipszkarton_rb', dCm: 1.25 }, { anyagId: 'pe_folia', dCm: 0.02 }, { anyagId: 'osb', dCm: 1.5 }, { anyagId: 'uveggyapot_tekercs', dCm: 15 }, { anyagId: 'osb', dCm: 1.5 }, { anyagId: 'fagyapot_heraklith', dCm: 6 }, { anyagId: 'nemesvakolat', dCm: 0.5 }] },
  { kod: 'fal_konnyu_fa_eps', szerep: 'fal', csoport: 'Könnyűszerkezet', nev: 'Favázas könnyűszerkezet: 15 cm ásványgyapot + 10 cm grafitos EPS', leiras: 'A favázat a hőszigetelés homogénnek veszi: a váz hatását χ-vel vagy kézi ΔU-val kell figyelembe venni.', retegek: [{ anyagId: 'gipszkarton_rb', dCm: 1.25 }, { anyagId: 'pe_folia', dCm: 0.02 }, { anyagId: 'osb', dCm: 1.5 }, { anyagId: 'asvanyiyapot_szarufa', dCm: 15 }, { anyagId: 'osb', dCm: 1.5 }, ...etics('eps80_grafit', 10)] },
  { kod: 'fal_clt', szerep: 'fal', csoport: 'Könnyűszerkezet', nev: 'CLT tömörfa panel 10 cm + 16 cm kőzetgyapot', retegek: [{ anyagId: 'clt', dCm: 10 }, ...etics('kozetgyapot_homlokzati', 16)] },
  { kod: 'fal_valyog', szerep: 'fal', csoport: 'Hagyományos fal', nev: 'Vályogfal 50 cm, mészvakolattal', retegek: [{ anyagId: 'mesz_vakolat', dCm: 2 }, { anyagId: 'valyog_1600', dCm: 50 }, { anyagId: 'mesz_vakolat', dCm: 2 }] },
  { kod: 'fal_termeszko', szerep: 'fal', csoport: 'Hagyományos fal', nev: 'Terméskő (mészkő) fal 50 cm', retegek: [{ anyagId: 'mesz_vakolat', dCm: 2 }, { anyagId: 'termeszko_meszko', dCm: 50 }, { anyagId: 'mesz_vakolat', dCm: 2 }] },
  // --- Padlásfödém ---
  { kod: 'padlas_vasbeton_asvanygyapot', szerep: 'padlas', csoport: 'Padlásfödém', nev: 'Vasbeton födém 16 cm + 25 cm ásványgyapot', retegek: [{ anyagId: 'gipsz_vakolat', dCm: 1 }, { anyagId: 'vasbeton_2300', dCm: 16 }, { anyagId: 'pe_folia', dCm: 0.02 }, { anyagId: 'asvanyiyapot_lemez_padlas', dCm: 25 }] },
  { kod: 'padlas_vasbeton_eps', szerep: 'padlas', csoport: 'Padlásfödém', nev: 'Vasbeton födém 16 cm + 20 cm EPS, járható', retegek: [{ anyagId: 'gipsz_vakolat', dCm: 1 }, { anyagId: 'vasbeton_2300', dCm: 16 }, { anyagId: 'pe_folia', dCm: 0.02 }, { anyagId: 'eps100_feher', dCm: 20 }, { anyagId: 'osb', dCm: 2.2 }] },
  { kod: 'padlas_fagerendas', szerep: 'padlas', csoport: 'Padlásfödém', nev: 'Fagerendás födém, agyagtapasztással + 20 cm ásványgyapot', leiras: 'A fagerendákat a számítás nem tartalmazza (homogén rétegek).', retegek: [{ anyagId: 'mesz_vakolat', dCm: 2 }, { anyagId: 'nad', dCm: 1.5 }, { anyagId: 'puhafa', dCm: 2.4 }, { anyagId: 'foldfeltoltes', dCm: 8 }, { anyagId: 'asvanyiyapot_lemez_padlas', dCm: 20 }] },
  // --- Tető ---
  { kod: 'teto_szarufa_asvany', szerep: 'teto', csoport: 'Magastető, beépített tetőtér', nev: 'Szarufák között 20 cm + alatta 5 cm ásványgyapot, gipszkarton', leiras: 'A szarufákat a számítás nem tartalmazza: hatásukat χ-vel kell figyelembe venni. A kiszellőztetett légrés feletti rétegek nem számítanak.', retegek: [{ anyagId: 'gipszkarton_rb', dCm: 1.25 }, { anyagId: 'pe_folia', dCm: 0.02 }, { anyagId: 'asvanyiyapot_szarufa', dCm: 5 }, { anyagId: 'asvanyiyapot_szarufa', dCm: 20 }] },
  { kod: 'teto_lapos_eps', szerep: 'teto', csoport: 'Lapostető', nev: 'Vasbeton lapostető + 25 cm EPS 100', retegek: [{ anyagId: 'gipsz_vakolat', dCm: 1 }, { anyagId: 'vasbeton_2300', dCm: 20 }, { anyagId: 'beton_2200', dCm: 5 }, { anyagId: 'bitumenes_lemez', dCm: 0.4 }, { anyagId: 'eps100_feher', dCm: 25 }, { anyagId: 'bitumenes_lemez', dCm: 1 }] },
  { kod: 'teto_lapos_pir', szerep: 'teto', csoport: 'Lapostető', nev: 'Vasbeton lapostető + 16 cm PIR', retegek: [{ anyagId: 'gipsz_vakolat', dCm: 1 }, { anyagId: 'vasbeton_2300', dCm: 20 }, { anyagId: 'bitumenes_lemez', dCm: 0.4 }, { anyagId: 'pir_alu', dCm: 16 }, { anyagId: 'bitumenes_lemez', dCm: 1 }] },
  // --- Pincefödém ---
  { kod: 'pince_vasbeton_also', szerep: 'pincefodem', csoport: 'Pince feletti födém', nev: 'Vasbeton födém + alsó 12 cm kőzetgyapot', retegek: [{ anyagId: 'keramia', dCm: 1 }, { anyagId: 'esztrich_cement', dCm: 5 }, { anyagId: 'eps100_feher', dCm: 3 }, { anyagId: 'vasbeton_2300', dCm: 18 }, { anyagId: 'kozetgyapot_homlokzati', dCm: 12 }] },
  // --- Padló ---
  { kod: 'padlo_eps', szerep: 'padlo', csoport: 'Talajon fekvő padló', nev: 'Aljzatbeton 6 cm + 12 cm EPS 100, burkolattal', retegek: [{ anyagId: 'keramia', dCm: 1 }, { anyagId: 'esztrich_cement', dCm: 6 }, { anyagId: 'pe_folia', dCm: 0.02 }, { anyagId: 'eps100_feher', dCm: 12 }, { anyagId: 'bitumenes_lemez', dCm: 0.5 }, { anyagId: 'beton_2400', dCm: 10 }] },
  { kod: 'padlo_xps', szerep: 'padlo', csoport: 'Talajon fekvő padló', nev: 'Aljzatbeton 6 cm + 15 cm XPS, parkettával', retegek: [{ anyagId: 'parketta', dCm: 1.5 }, { anyagId: 'esztrich_cement', dCm: 6 }, { anyagId: 'pe_folia', dCm: 0.02 }, { anyagId: 'xps_labazati', dCm: 15 }, { anyagId: 'bitumenes_lemez', dCm: 0.5 }, { anyagId: 'beton_2400', dCm: 10 }] },
  { kod: 'padlo_szigeteletlen', szerep: 'padlo', csoport: 'Talajon fekvő padló', nev: 'Régi aljzatbeton, hőszigetelés nélkül', retegek: [{ anyagId: 'keramia', dCm: 1 }, { anyagId: 'esztrich_cement', dCm: 5 }, { anyagId: 'bitumenes_lemez', dCm: 0.5 }, { anyagId: 'beton_2200', dCm: 10 }] },
  // --- Fűtetlen tér felé ---
  { kod: 'belso_tegla', szerep: 'belso', csoport: 'Fűtetlen tér felé', nev: 'Porotherm 30 N+F, kétoldalt vakolva', retegek: [vak, { anyagId: 'porotherm_30_nf_neo', dCm: 30 }, vak] },
  { kod: 'belso_tegla_eps', szerep: 'belso', csoport: 'Fűtetlen tér felé', nev: 'Tömör tégla 25 cm + 8 cm EPS a fűtetlen oldalon', retegek: [vak, { anyagId: 'tomor_tegla_falazat', dCm: 25 }, ...etics('eps80_feher', 8)] },
];
