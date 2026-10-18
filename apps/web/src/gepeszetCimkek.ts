/**
 * A gépészeti választások magyar megnevezései a felülethez (a táblázatkulcsok a számítómagban vannak).
 */
import { gepeszet as T, type FutesiHotermelo, type HmvHotermelo } from '@mag/index';
import type { Energiahordozo } from '@mag/tablak/sulyozo';

export const opciok = <K extends string>(r: Record<K, string>) => (Object.keys(r) as K[]).map((ertek) => ({ ertek, nev: r[ertek] }));

export const ENERGIAHORDOZO_TUZELO: Partial<Record<Energiahordozo, string>> = {
  fosszilis_gaz: 'Földgáz, PB-gáz',
  fosszilis_folyekony: 'Fűtőolaj',
  fosszilis_szilard: 'Szén',
  bio_gaz: 'Biogáz',
  bio_folyekony: 'Bio folyékony tüzelőanyag',
  bio_szilard: 'Tűzifa, pellet, apríték',
  bio_szilard_korszeru: 'Biomassza, 7. mell. 3. pont szerinti korszerű berendezésben',
  villamos: 'Villamos energia',
};

// --- Fűtés -------------------------------------------------------------------------------------

export type FutesHotermeloTipus = FutesiHotermelo['tipus'];
export const FUTES_HOTERMELO_NEV: Record<FutesHotermeloTipus, string> = {
  kazan_tabla: 'Gáz- vagy olajkazán (táblázati érték)',
  kazan_erp: 'Kazán ErP adatlappal (ηs)',
  hoszivattyu_tabla: 'Hőszivattyú (táblázati érték)',
  hoszivattyu_erp: 'Hőszivattyú ErP adatlappal (ηs)',
  hoszivattyu_scop: 'Hőszivattyú SCOP alapján',
  hoszivattyu_levego_levego: 'Levegő-levegő hőszivattyú (split klíma fűtésre)',
  szilard_kazan: 'Szilárd tüzelésű, biomassza kazán',
  tavho: 'Távhő',
  egyeb: 'Egyedi fűtőkészülék (kályha, konvektor, villanyfűtés)',
  kezi: 'Kézi megadás (részletes számításból)',
};
export function futesHotermeloAlap(t: FutesHotermeloTipus): FutesiHotermelo {
  switch (t) {
    case 'kazan_tabla': return { tipus: t, kazan: 'kondenzacios', hely: 'belul', energiahordozo: 'fosszilis_gaz' };
    case 'kazan_erp': return { tipus: t, energiahordozo: 'fosszilis_gaz', etaS: 0.93 };
    case 'hoszivattyu_tabla': return { tipus: t, forras: 'levego_viz', hofok: '35/28' };
    case 'hoszivattyu_erp': return { tipus: t, etaS: 1.5 };
    case 'hoszivattyu_scop': return { tipus: t, SCOP: 4 };
    case 'hoszivattyu_levego_levego': return { tipus: t };
    case 'szilard_kazan': return { tipus: t, kazan: 'pellet', energiahordozo: 'bio_szilard' };
    case 'tavho': return { tipus: t, hokozpontokSzama: 1 };
    case 'egyeb': return { tipus: t, kod: 'gazkonvektor_kombinalt' };
    case 'kezi': return { tipus: t, epszilon: 1, energiahordozo: 'fosszilis_gaz', segedKWh: 0, hoszivattyu: false };
  }
}
export const KAZAN_NEV = { kondenzacios: 'Kondenzációs', alacsony: 'Alacsony hőmérsékletű', allando: 'Állandó hőmérsékletű (régi)' } as const;
export const HSZ_FORRAS_NEV = { levego_viz: 'Levegő-víz', talaj_viz: 'Talaj-víz', viz_viz: 'Víz-víz', tavozo_levego_viz: 'Távozó levegő-víz' } as const;
export const SZILARD_NEV = { pellet: 'Pellet', faelgazosito: 'Faelgázosító', tuzifa: 'Hasábfa', vegyes: 'Vegyes tüzelésű' } as const;
export const HELY_NEV = { belul: 'Fűtött téren belül', kivul: 'Fűtött téren kívül' } as const;

export const SZAB_ALAP_NEV = Object.fromEntries(Object.entries(T.SZAB_ALAP).map(([k, v]) => [k, v.megnevezes])) as Record<keyof typeof T.SZAB_ALAP, string>;
export const SZABAD_HATAROLO_NEV: Record<keyof typeof T.SZAB_SZABAD.hatarolo, string> = {
  kulsofali: 'Külső fal mellett', belsofali: 'Belső fal mellett', uveg_elott_hotukor_nelkul: 'Üvegfelület előtt, hőtükör nélkül', uveg_elott_hotukorrel: 'Üvegfelület előtt, hőtükörrel',
};
export const BEAGYAZOTT_NEV: Record<keyof typeof T.SZAB_BEAGYAZOTT.rendszer, string> = {
  padlo_nedves: 'Padlófűtés, nedves fektetés', padlo_szaraz: 'Padlófűtés, száraz fektetés', padlo_vekony: 'Padlófűtés, vékonyrétegű', fal: 'Falfűtés', mennyezet: 'Mennyezetfűtés',
};
export const BEAGYAZOTT_HATAROLO_NEV: Record<keyof typeof T.SZAB_BEAGYAZOTT.hatarolo, string> = {
  min_szig: 'Minimális hőszigeteléssel', min_szig_100_szazalekkal_jobb: 'A minimálisnál 100%-kal jobb hőszigeteléssel', min_szig_nelkul: 'Minimális hőszigetelés nélkül',
};
export const HELYISEG_SZAB_NEV: Record<keyof typeof T.SZAB_HELYISEG, string> = {
  nincs: 'Nincs helyiségenkénti szabályozás', kezi: 'Kézi szelepek', termosztatikus: 'Termosztatikus szelepek / helyiségtermosztát', halozatba_integralt: 'Épületfelügyeleti rendszerbe integrált',
};
export const BESZAB_KETCSOVES_NEV: Record<keyof typeof T.SZAB_BESZABALYOZAS.ketcsoves, string> = {
  nincs: 'Beszabályozás nélkül', statikus_csoportos_nelkul: 'Statikus, csoportos beszabályozás nélkül', statikus_csoportos_statikus: 'Statikus, statikus csoportos beszabályozással',
  statikus_csoportos_dinamikus: 'Statikus, dinamikus csoportos beszabályozással', dinamikus_fuetestenkent: 'Dinamikus, fűtőtestenként',
};
export const BESZAB_EGYCSOVES_NEV: Record<keyof typeof T.SZAB_BESZABALYOZAS.egycsoves, string> = {
  nincs: 'Beszabályozás nélkül', statikus: 'Statikus', dinamikus: 'Dinamikus', dinamikus_terhelesfuggo_visszatero: 'Dinamikus, terhelésfüggő (visszatérő hőm.)', dinamikus_terhelesfuggo_hofoklepcso: 'Dinamikus, terhelésfüggő (hőfoklépcső)',
};
/** 8.13. és 8.14. táblázat közvetlen εF,szab értékei. */
export const KOZVETLEN_SZAB: { ertek: number; nev: string; forras: string }[] = [
  ...Object.entries(T.SZAB_LEVEGO).map(([k, v]) => ({ ertek: v, forras: '1. függ. 8.14. táblázat', nev: ({
    gazkonvektor_termosztat_kulso: 'Gázkonvektor saját termosztáttal, külső falnál', gazkonvektor_termosztat_belso: 'Gázkonvektor saját termosztáttal, belső falnál',
    gazkonvektor_magasabb_rendu_kulso: 'Gázkonvektor magasabb rendű szabályozással, külső falnál', kalyha_kandallo: 'Kályha, kandalló',
    legfutes_alacsony: 'Légfűtés, egyszerű szabályozás', legfutes_pi_pid: 'Légfűtés, PI/PID szabályozás',
  } as Record<string, string>)[k] ?? k })),
  ...(['kulso_fal', 'belso_fal'] as const).flatMap((fal) => Object.entries(T.SZAB_VILLAMOS[fal]).map(([k, v]) => ({ ertek: v, forras: '1. függ. 8.13. táblázat', nev: `Villamos fűtés, ${fal === 'kulso_fal' ? 'külső' : 'belső'} falnál – ${({
    kozvetlen_p: 'közvetlen, P-szabályozó', kozvetlen_pi: 'közvetlen, PI-szabályozó', hotarolos_nincs: 'hőtárolós, szabályozás nélkül', hotarolos_p: 'hőtárolós, P-szabályozó', hotarolos_pid: 'hőtárolós, PID-szabályozó',
  } as Record<string, string>)[k] ?? k}` }))),
];
export const SZIVATTYU_NEV: Record<Exclude<keyof typeof T.FUTES_SZIVATTYU, 'forras' | 'A'>, string> = {
  fordulatszam_szabad_20K: 'Fordulatszám-szabályozott, radiátor, 20 K', fordulatszam_szabad_15K: 'Fordulatszám-szabályozott, radiátor, 15 K', fordulatszam_szabad_10K: 'Fordulatszám-szabályozott, radiátor, 10 K',
  fordulatszam_beagyazott_7K: 'Fordulatszám-szabályozott, felületfűtés, 7 K',
  allando_szabad_20K: 'Állandó fordulatú, radiátor, 20 K', allando_szabad_15K: 'Állandó fordulatú, radiátor, 15 K', allando_szabad_10K: 'Állandó fordulatú, radiátor, 10 K', allando_beagyazott_7K: 'Állandó fordulatú, felületfűtés, 7 K',
  epm_EEI_023: 'Nagyhatékonyságú, EEI ≤ 0,23', epm_EEI_017: 'Nagyhatékonyságú, EEI ≤ 0,17',
};

// --- HMV ---------------------------------------------------------------------------------------

export type HmvHotermeloTipus = HmvHotermelo['tipus'];
export const HMV_HOTERMELO_NEV: Record<HmvHotermeloTipus, string> = {
  kazan_tabla: 'Gázkazán, kombikazán (táblázati érték)',
  erp: 'Vízmelegítő vagy kazán ErP adatlappal (ηwh)',
  elektromos_tabla: 'Villanybojler, hőszivattyú (táblázati érték)',
  erp_elektromos: 'Elektromos készülék, hőszivattyú ErP adatlappal (ηwh)',
  szilard: 'Szilárd tüzelésű, biomassza kazán',
  egyeb: 'Gázbojler, átfolyós gázvízmelegítő, fürdőhenger',
  tavho: 'Távhő',
  kezi: 'Kézi megadás',
};
export function hmvHotermeloAlap(t: HmvHotermeloTipus): HmvHotermelo {
  switch (t) {
    case 'kazan_tabla': return { tipus: t, kazan: 'kondenzacios', energiahordozo: 'fosszilis_gaz' };
    case 'erp': return { tipus: t, energiahordozo: 'fosszilis_gaz', etaWH: 0.85 };
    case 'elektromos_tabla': return { tipus: t, kod: 'hsz_levego' };
    case 'erp_elektromos': return { tipus: t, etaWH: 1.2, hoszivattyu: true };
    case 'szilard': return { tipus: t, kazan: 'pellet', energiahordozo: 'bio_szilard' };
    case 'egyeb': return { tipus: t, kod: 'gaz_bojler' };
    case 'tavho': return { tipus: t, hokozpontokSzama: 1 };
    case 'kezi': return { tipus: t, epszilon: 1, energiahordozo: 'villamos', segedKWh: 0, hoszivattyu: false };
  }
}
export const HMV_KAZAN_NEV = {
  kondenzacios: 'Kondenzációs kazán, indirekt tároló', alacsony: 'Alacsony hőmérsékletű kazán', allando: 'Állandó hőmérsékletű kazán',
  kond_kombi_AF: 'Kondenzációs kombikazán, átfolyós', kond_kombi_KT: 'Kondenzációs kombikazán, kis tárolós',
  kombi_AF: 'Kombikazán, átfolyós', kombi_KT: 'Kombikazán, kis tárolós',
} as const;
export const HMV_ELEKTROMOS_NEV: Record<keyof typeof T.HMV_ELEKTROMOS_EPSZILON, string> = {
  atfolyos_tarolo: 'Villanybojler, átfolyós vízmelegítő', futopatron: 'Fűtőpatron',
  hsz_levego: 'Levegő-víz hőszivattyú', hsz_talaj: 'Talaj-víz hőszivattyú', hsz_viz: 'Víz-víz hőszivattyú', hsz_tavozo_levego: 'Távozó levegős hőszivattyú',
  hsz_hovisszanyero_06: 'Hőszivattyú hővisszanyerővel (η = 0,6)', hsz_hovisszanyero_08: 'Hőszivattyú hővisszanyerővel (η = 0,8)', hsz_pince_levego: 'Pincelevegős hőszivattyú',
};
export const HMV_EGYEB_NEV: Record<keyof typeof T.HMV_EGYEB, string> = { gaz_bojler: 'Gázbojler (tárolós)', atfolyos_gaz: 'Átfolyós gázvízmelegítő (cirkó, „junkers”)', szilard_furdohenger: 'Fatüzelésű fürdőhenger' };
export const HMV_TAROLO_NEV: Record<keyof typeof T.HMV_TAROLO.belul, string> = {
  indirekt: 'Indirekt fűtésű tároló', el_csucson_kivul: 'Elektromos tároló, csúcson kívüli áram', el_nappali: 'Elektromos tároló, nappali áram', gaz_bojler: 'Gázüzemű bojler',
};
export const CIRK_NEV = { ismeretlen: 'Ismeretlen szivattyú', EEI_023: 'Nagyhatékonyságú, EEI ≤ 0,23', EEI_017: 'Nagyhatékonyságú, EEI ≤ 0,17' } as const;

/** Tájolás → kollektor γm [°] (K = −90, D = 0, Ny = +90). */
export const KOLLEKTOR_TAJOLAS = [
  { ertek: '-90', nev: 'Kelet' }, { ertek: '-45', nev: 'Délkelet' }, { ertek: '0', nev: 'Dél' }, { ertek: '45', nev: 'Délnyugat' }, { ertek: '90', nev: 'Nyugat' },
] as const;

// --- Szellőzés, napelem ------------------------------------------------------------------------

export const MISC_NEV: Record<keyof typeof T.SZELL_MISC, string> = { legcsatornas: 'Légcsatornás (központi) berendezés', legcsatorna_nelkuli: 'Légcsatorna nélküli (decentralizált) berendezés' };
export const CTRL_NEV: Record<keyof typeof T.SZELL_CTRL, string> = { kezi: 'Kézi vezérlés', idozitos: 'Időzítős vezérlés', kozponti_igeny: 'Központi igényvezérlés', helyi_igeny: 'Helyi igényvezérlés' };
export const X_NEV: Record<keyof typeof T.SZELL_X, string> = { egyfokozatu: 'Egyfokozatú, ki/be', ketfokozatu: 'Kétfokozatú', haromfokozatu: 'Háromfokozatú', fokozatmentes: 'Fokozatmentes (EC)' };
export const PV_TAJOLAS_NEV = { D: 'Dél', DK_DNy: 'Délkelet / Délnyugat', K_Ny: 'Kelet / Nyugat' } as const;
