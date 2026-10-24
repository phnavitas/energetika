/**
 * Egyéb (nem lakó) rendeltetésű épületek számítási profiljai – 9/2023 ÉKM számítási módszer
 *   2. függelék 2.1. táblázat (használati idő, hőmérséklet, szellőzési térfogatáram, megvilágítás, belső hőnyereség),
 *   2. függelék 2.2. táblázat (HMV hőigény), 2.5. táblázat (szakaszos fűtés σF),
 *   1. függelék 12.4–12.6. táblázat (világítás: kihasználtsági mutató, szabályozás, üzemórák).
 * A 2.1. táblázat a lakóépületeken kívül „ajánlott” értékeket ad; a WC/mosdó, alárendelt helyiség és közlekedő sor
 * („fő funkció szerint”) zónaszintű, ezért épületprofilként nem választható.
 */

export type VilagitasTipus = 'iroda' | 'oktatas' | 'korhaz' | 'hotel' | 'etterem' | 'sport' | 'kereskedelmi' | 'uzem';
export type KihasznTipus = 'muzeum' | 'konyvtar' | 'uzem' | 'hotel_etterem' | 'szinhaz' | 'iroda' | 'oktatas' | 'korhaz' | 'sportcsarnok' | 'konferencia' | 'nincs';
export type HmvTipus = 'irodahaz' | 'korhaz' | 'iskola' | 'kereskedelmi' | 'ipari' | 'hotel_egyszeru' | 'hotel_luxus' | 'etterem' | 'nyugdijas' | 'laktanya' | 'sport' | 'menza' | 'szauna' | 'labor' | 'fitnesz';

export interface HasznalatiProfil {
  kod: string;
  nev: string;
  /** Napi használati idő [h/nap]. */
  napiH: number;
  /** Éves használati napok száma [nap/év]. */
  napEv: number;
  /** Havi használati órák (ha a havi megoszlás markánsan eltér, pl. oktatás); egyébként egyenletes. */
  haviH?: readonly number[];
  thetaF: number;
  thetaH: number;
  /** Szükséges szellőzési térfogatáram üzemidőben, alapterületre [m³/(m²h)]. */
  VLTfajl: number;
  /** Megvilágítás [lx] (új épületre, korszerűsített rendszerre). */
  MV: number;
  /** Belső hőnyereség, napi átlag [W/m²]. */
  qb: number;
  /** Javasolt 12.6. (üzemórák) és 12.4. (kihasználtság) sor, valamint 2.2. HMV-sor – a tervező módosíthatja. */
  vilTipus: VilagitasTipus;
  kihaszn: KihasznTipus;
  hmv: HmvTipus;
}

const OKTATAS_HAVI = [220, 220, 220, 220, 220, 220, 0, 0, 220, 220, 220, 220] as const; // szept.–jún. 22 nap × 10 h, júl.–aug. 0
const ELOADO_HAVI = [154, 154, 154, 154, 154, 154, 0, 0, 154, 154, 154, 154] as const; // 22 nap × 7 h

/** 2. függelék 2.1. táblázat. */
export const PROFILOK: readonly HasznalatiProfil[] = [
  { kod: 'kis_iroda', nev: 'Kis iroda (1–5 fő)', napiH: 11, napEv: 250, thetaF: 20, thetaH: 26, VLTfajl: 4, MV: 500, qb: 7, vilTipus: 'iroda', kihaszn: 'iroda', hmv: 'irodahaz' },
  { kod: 'nagy_iroda', nev: 'Nagy iroda (> 5 fő)', napiH: 11, napEv: 250, thetaF: 20, thetaH: 26, VLTfajl: 6, MV: 500, qb: 8, vilTipus: 'iroda', kihaszn: 'iroda', hmv: 'irodahaz' },
  { kod: 'targyalo', nev: 'Tárgyaló', napiH: 11, napEv: 250, thetaF: 20, thetaH: 26, VLTfajl: 15, MV: 500, qb: 8, vilTipus: 'iroda', kihaszn: 'konferencia', hmv: 'irodahaz' },
  { kod: 'osztalyterem', nev: 'Osztályterem, óvodai csoportszoba', napiH: 10, napEv: 220, haviH: OKTATAS_HAVI, thetaF: 20, thetaH: 26, VLTfajl: 10, MV: 300, qb: 9, vilTipus: 'oktatas', kihaszn: 'oktatas', hmv: 'iskola' },
  { kod: 'bolcsode', nev: 'Bölcsődei csoportszoba', napiH: 12, napEv: 220, thetaF: 23, thetaH: 26, VLTfajl: 10, MV: 300, qb: 9, vilTipus: 'oktatas', kihaszn: 'oktatas', hmv: 'iskola' },
  { kod: 'eloado', nev: 'Előadó', napiH: 7, napEv: 220, haviH: ELOADO_HAVI, thetaF: 20, thetaH: 26, VLTfajl: 30, MV: 500, qb: 19, vilTipus: 'oktatas', kihaszn: 'szinhaz', hmv: 'iskola' },
  { kod: 'aruhaz', nev: 'Kereskedelmi egység / áruház', napiH: 12, napEv: 300, thetaF: 20, thetaH: 26, VLTfajl: 4, MV: 300, qb: 9, vilTipus: 'kereskedelmi', kihaszn: 'nincs', hmv: 'kereskedelmi' },
  { kod: 'aruhaz_hutopult', nev: 'Kereskedelmi egység hűtőpultokkal', napiH: 12, napEv: 300, thetaF: 20, thetaH: 26, VLTfajl: 4, MV: 300, qb: -2, vilTipus: 'kereskedelmi', kihaszn: 'nincs', hmv: 'kereskedelmi' },
  { kod: 'hotelszoba', nev: 'Hotelszoba', napiH: 11, napEv: 365, thetaF: 20, thetaH: 26, VLTfajl: 3, MV: 200, qb: 5, vilTipus: 'hotel', kihaszn: 'hotel_etterem', hmv: 'hotel_egyszeru' },
  { kod: 'menza', nev: 'Menza', napiH: 7, napEv: 250, thetaF: 20, thetaH: 26, VLTfajl: 18, MV: 200, qb: 12, vilTipus: 'etterem', kihaszn: 'hotel_etterem', hmv: 'menza' },
  { kod: 'etterem', nev: 'Étterem', napiH: 14, napEv: 300, thetaF: 20, thetaH: 26, VLTfajl: 18, MV: 200, qb: 14, vilTipus: 'etterem', kihaszn: 'hotel_etterem', hmv: 'etterem' },
  { kod: 'fozokonyha', nev: 'Főzőkonyha', napiH: 13, napEv: 300, thetaF: 20, thetaH: 26, VLTfajl: 90, MV: 500, qb: 77, vilTipus: 'etterem', kihaszn: 'hotel_etterem', hmv: 'etterem' },
  { kod: 'konyhai_elokeszito', nev: 'Konyhai előkészítő', napiH: 13, napEv: 300, thetaF: 20, thetaH: 26, VLTfajl: 15, MV: 300, qb: 10, vilTipus: 'etterem', kihaszn: 'hotel_etterem', hmv: 'etterem' },
  { kod: 'raktar', nev: 'Raktár, logisztikai tér', napiH: 24, napEv: 365, thetaF: 12, thetaH: 28, VLTfajl: 1, MV: 150, qb: 2, vilTipus: 'uzem', kihaszn: 'uzem', hmv: 'ipari' },
  { kod: 'szerverszoba', nev: 'Szerverszoba', napiH: 24, napEv: 365, thetaF: 20, thetaH: 26, VLTfajl: 1.3, MV: 500, qb: 76, vilTipus: 'uzem', kihaszn: 'uzem', hmv: 'irodahaz' },
  { kod: 'szinhaz_nezoter', nev: 'Színház / mozi nézőtér', napiH: 4, napEv: 250, thetaF: 20, thetaH: 26, VLTfajl: 40, MV: 200, qb: 12, vilTipus: 'kereskedelmi', kihaszn: 'szinhaz', hmv: 'kereskedelmi' },
  { kod: 'szinhaz_eloter', nev: 'Színház / mozi előtér', napiH: 4, napEv: 250, thetaF: 20, thetaH: 26, VLTfajl: 25, MV: 300, qb: 6, vilTipus: 'kereskedelmi', kihaszn: 'szinhaz', hmv: 'kereskedelmi' },
  { kod: 'szinpad', nev: 'Színházi színpad', napiH: 10, napEv: 250, thetaF: 20, thetaH: 26, VLTfajl: 0.3, MV: 1000, qb: 0, vilTipus: 'kereskedelmi', kihaszn: 'szinhaz', hmv: 'kereskedelmi' },
  { kod: 'kongresszus', nev: 'Kongresszusi központ, kiállítócsarnok', napiH: 9, napEv: 150, thetaF: 20, thetaH: 26, VLTfajl: 7, MV: 300, qb: 8, vilTipus: 'kereskedelmi', kihaszn: 'konferencia', hmv: 'kereskedelmi' },
  { kod: 'muzeum', nev: 'Múzeumi kiállítótér', napiH: 8, napEv: 250, thetaF: 20, thetaH: 26, VLTfajl: 2, MV: 200, qb: 3, vilTipus: 'kereskedelmi', kihaszn: 'muzeum', hmv: 'kereskedelmi' },
  { kod: 'konyvtar_olvaso', nev: 'Könyvtár – olvasóterem', napiH: 12, napEv: 300, thetaF: 20, thetaH: 26, VLTfajl: 8, MV: 500, qb: 9, vilTipus: 'oktatas', kihaszn: 'konyvtar', hmv: 'irodahaz' },
  { kod: 'konyvtar_polc', nev: 'Könyvtár – szabadpolcos', napiH: 12, napEv: 300, thetaF: 20, thetaH: 26, VLTfajl: 2, MV: 200, qb: 4, vilTipus: 'oktatas', kihaszn: 'konyvtar', hmv: 'irodahaz' },
  { kod: 'tornaterem', nev: 'Tornaterem, sportcsarnok (nézőtér nélkül)', napiH: 15, napEv: 250, thetaF: 20, thetaH: 26, VLTfajl: 3, MV: 300, qb: 3, vilTipus: 'sport', kihaszn: 'sportcsarnok', hmv: 'sport' },
  { kod: 'fitness', nev: 'Fitness terem', napiH: 15, napEv: 365, thetaF: 18, thetaH: 26, VLTfajl: 12, MV: 300, qb: 16, vilTipus: 'sport', kihaszn: 'sportcsarnok', hmv: 'fitnesz' },
  { kod: 'parkolo_magan', nev: 'Parkolóház (irodai, magán)', napiH: 11, napEv: 250, thetaF: 20, thetaH: 26, VLTfajl: 8, MV: 75, qb: 0, vilTipus: 'uzem', kihaszn: 'uzem', hmv: 'irodahaz' },
  { kod: 'parkolo_nyilvanos', nev: 'Parkolóház (nyilvános)', napiH: 15, napEv: 365, thetaF: 20, thetaH: 26, VLTfajl: 8, MV: 75, qb: 0, vilTipus: 'uzem', kihaszn: 'uzem', hmv: 'irodahaz' },
  { kod: 'eu_folyoso', nev: 'Folyosók (egészségügyi)', napiH: 24, napEv: 365, thetaF: 20, thetaH: 26, VLTfajl: 10, MV: 125, qb: 4, vilTipus: 'korhaz', kihaszn: 'korhaz', hmv: 'korhaz' },
  { kod: 'orvosi', nev: 'Orvosi helyiség, terápia', napiH: 10, napEv: 250, thetaF: 20, thetaH: 26, VLTfajl: 10, MV: 500, qb: 7, vilTipus: 'korhaz', kihaszn: 'korhaz', hmv: 'korhaz' },
];

export const profil = (kod: string | undefined) => PROFILOK.find((p) => p.kod === kod);

/** Havi használati órák (a haviH vagy napiH · napEv / 365 · napok). */
export function haviHasznalatiOrak(p: HasznalatiProfil): number[] {
  const napok = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return p.haviH ? [...p.haviH] : napok.map((n) => (p.napiH * p.napEv * n) / 365);
}
export const evesHasznalatiOra = (p: HasznalatiProfil) => haviHasznalatiOrak(p).reduce((a, x) => a + x, 0);

/** 2. függelék 2.2. táblázat – HMV hőigény [kWh / egység / nap]. */
export const HMV_EGYEB: Readonly<Record<HmvTipus, { nev: string; kWh: number; egyseg: string }>> = {
  irodahaz: { nev: 'Irodaház', kWh: 0.4, egyseg: 'fő' },
  korhaz: { nev: 'Kórházi hálóterem', kWh: 6, egyseg: 'ágy' },
  iskola: { nev: 'Iskola, óvoda, bölcsőde', kWh: 0.4, egyseg: 'fő' },
  kereskedelmi: { nev: 'Kereskedelmi', kWh: 1, egyseg: 'dolgozó' },
  ipari: { nev: 'Ipari épület (zuhanyzással)', kWh: 1.8, egyseg: 'dolgozó' },
  hotel_egyszeru: { nev: 'Hotel (egyszerű)', kWh: 2, egyseg: 'ágy' },
  hotel_luxus: { nev: 'Hotel (luxus)', kWh: 5, egyseg: 'ágy' },
  etterem: { nev: 'Étterem', kWh: 1.1, egyseg: 'szék' },
  nyugdijas: { nev: 'Nyugdíjasotthon', kWh: 2.3, egyseg: 'fő' },
  laktanya: { nev: 'Laktanya', kWh: 1.8, egyseg: 'fő' },
  sport: { nev: 'Sportlétesítmény', kWh: 1.8, egyseg: 'fő' },
  menza: { nev: 'Menza', kWh: 0.4, egyseg: 'adag' },
  szauna: { nev: 'Szaunatér', kWh: 2.8, egyseg: 'fő' },
  labor: { nev: 'Labor', kWh: 0.4, egyseg: 'fő' },
  fitnesz: { nev: 'Fitnesztér', kWh: 1.5, egyseg: 'fő' },
};

/** 2. függelék 2.5. táblázat – szakaszos fűtés σF egyéb rendeltetésnél (hétköznap éjjel és hétvégén csökkentett hőmérséklet). */
export function sigmaFEgyeb(programozhato: boolean, tau: number): number {
  if (!programozhato) return 1.0;
  return tau > 24 ? 0.95 : 0.9;
}

/** 1. függelék 12.4. táblázat – kihasználtsági mutató. A 12.4. táblázatban nem szereplő funkció: 0 (nincs). */
export const FKIHASZN: Readonly<Record<KihasznTipus, { nev: string; F: number }>> = {
  muzeum: { nev: 'Múzeum', F: 0 }, konyvtar: { nev: 'Könyvtár', F: 0 }, uzem: { nev: 'Üzem', F: 0 }, hotel_etterem: { nev: 'Hotel, étterem', F: 0 },
  szinhaz: { nev: 'Színház, auditórium', F: 0 }, iroda: { nev: 'Iroda', F: 0.2 }, oktatas: { nev: 'Oktatási intézmény', F: 0.2 }, korhaz: { nev: 'Kórház', F: 0.2 },
  sportcsarnok: { nev: 'Sportcsarnok', F: 0.3 }, konferencia: { nev: 'Konferenciaterem, kiállítóterem', F: 0.5 }, nincs: { nev: 'A 12.4. táblázatban nem szereplő funkció', F: 0 },
};

/** 1. függelék 12.5. táblázat – Fszab a kihasználtsági mutató (0,0 … 1,0, 0,1-es lépés) függvényében. */
export const FSZAB = {
  kezi: { nev: 'Kézi be- és kikapcsolás', F: [1, 1, 1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0] },
  auto_be_dimm: { nev: 'Automatikus bekapcsolás / dimmelhető', F: [1, 0.975, 0.975, 0.95, 0.85, 0.65, 0.55, 0.45, 0.35, 0.25, 0] },
  auto_be_ki: { nev: 'Automatikus be- és kikapcsolás', F: [1, 0.95, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0] },
  kezi_be_dimm: { nev: 'Kézi bekapcsolás / dimmelhető', F: [1, 0.95, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0] },
  kezi_be_auto_ki: { nev: 'Kézi bekapcsolás, automatikus kikapcsolás', F: [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0] },
} as const;
export type FszabKod = keyof typeof FSZAB;

/** 12.5. táblázat, lineáris interpoláció a kihasználtsági mutató szerint. */
export function fszab(kod: FszabKod, Fkihaszn: number): number {
  const t = FSZAB[kod].F;
  const x = Math.min(Math.max(Fkihaszn, 0), 1) * 10;
  const i = Math.min(Math.floor(x), 9);
  return t[i]! + (t[i + 1]! - t[i]!) * (x - i);
}

/** 1. függelék 12.6. táblázat – évi üzemórák [h/év]. */
export const UZEMORA: Readonly<Record<VilagitasTipus, { nev: string; tnappal: number; tejjel: number }>> = {
  iroda: { nev: 'Irodaépület', tnappal: 2250, tejjel: 250 },
  oktatas: { nev: 'Oktatási épület', tnappal: 1800, tejjel: 200 },
  korhaz: { nev: 'Kórház', tnappal: 3000, tejjel: 2000 },
  hotel: { nev: 'Hotel', tnappal: 3000, tejjel: 2000 },
  etterem: { nev: 'Étterem', tnappal: 1250, tejjel: 1250 },
  sport: { nev: 'Sportközpont', tnappal: 2000, tejjel: 2000 },
  kereskedelmi: { nev: 'Kereskedelmi egység', tnappal: 3000, tejjel: 2000 },
  uzem: { nev: 'Üzem', tnappal: 2500, tejjel: 1500 },
};

/** 1. függelék 12.1–12.3. és 12.7. táblázat. */
export const FENYHASZNOSITAS = { izzo: 15, halogen: 20, fenycso: 75, kompakt: 70, higany: 50, femhalogen: 87, led: 120 } as const;
export const LAMPATEST_ETA = { parabola: 0.5, opal: 0.3, led: 0.5 } as const;
export const FFE = { nem: 1, halogen: 0.9, fenycso: 0.8, led: 0.7 } as const;
export const fnappal = (uvegezesiArany: number | null) => (uvegezesiArany === null || uvegezesiArany <= 0 ? 1 : uvegezesiArany > 0.8 ? 0.35 : uvegezesiArany >= 0.4 ? 0.45 : 0.55);

/**
 * 5. melléklet – referencia hűtőgép SEER (léghűtéses / vízhűtéses komfort folyadékhűtő, teljesítménysáv szerint).
 */
export function referenciaSEER(tipus: 'leg' | 'viz', kW: number): number {
  if (tipus === 'leg') return kW < 400 ? 3.8 : 4.1;
  return kW < 400 ? 5.1 : kW < 1500 ? 5.88 : 6.33;
}
