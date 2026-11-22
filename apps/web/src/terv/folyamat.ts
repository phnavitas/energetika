/**
 * A tervlapokból az épületmodellig vezető folyamat UI-független része (a Tervből lépés és az ELBA közös kódja).
 * A Tervbol.tsx-ből kiemelve; a felhasználói döntések (kijelölés, szintek, északjel) bemenetként érkeznek.
 */
import { ujId as ujIdT, retegrendSzamitas, type Projekt, type HelyisegKategoria, type Szerep as RrSzerep, SZEREP_ALAP } from '../modell';
import { anyag } from '../katalogus';
import { pecsetKinyer, type PecsetAdat } from '@terv/pecset';
import type { SzurkeKep } from '@terv/autohelyiseg';
import { eltolas, fedettArany } from '@terv/fedes';
import { raszterFalPlusz } from './aiJavitas';
import { burokAuto, burokFalak, burokMeres, burokTomeg, burokTomegKezi, csatlakozasok, elKornyezet, kulsoSikra, kulsoSraff, nyilasEl, bennE, type Poligon } from '@terv/burok';
import type { TervNyilas } from '@terv/nyilaszarok';
import { pdfLapok, alaprajzFeldolgoz, metszetFeldolgoz, eszakJavitas, eszakJavitasMent, type TervLap, type AlaprajzFeldolgozas } from '@terv/elemzes';
import { egtaj, eszakjelKeres, jegyzekenKivul, pecsetBelmagassag, jegyzekSorok, szintekCimbol, szintJelekbol, szintNev, meretaranyKeres } from '@terv/alaprajz';
import { tervAtvesz, type AtvettNyilas, type AtvettHelyiseg } from './atvetel';
import type { Raszter, FalSzakasz } from '@terv/raszter';
import { homlokzatSziluettek, laposTetoSavok, magastetoLatszik, type HomlokzatSziluett, type TetoSav } from '@terv/tetoReszek';
import { homlokzatMellvedek, homlokzatElteresek, homlokzatRajzok, mertMagassagok, eszakHomlokzatbol, tetoAblakokHomlokzatrol, oromSzelessegek, type HomlokzatRajz, type MertMagassag } from '@terv/homlokzatIllesztes';
import { nezetOszlopok } from '@terv/homlokzatProfil';
import { tetoFelulnezet, type TetoFelulnezet } from '@terv/tetoFelulnezet';
import { metszetElemek, ferdeTetoHossz, ereszKiallasok, ereszKiallas, belmagassagSavok, szintJelekLapokrol, attikaGeometria, type BelmagSavok } from '@terv/metszetGeom';
import { helyisegMagassagok, type HelyisegMagassag } from '@terv/magassag';
import { epuletModell, type EpuletModell, type ModellReteg, type ModellRetegrend, type LapBemenet, type Szint as EpSzint, type TerKategoria } from '@terv/epulet';
import { falMagassagModell, type HomlokzatNezetAdat } from '@terv/homlokzatModell';
import { vonalIndex, keretek, homlokzatIrany, homlokzatCimek } from '@terv/homlokzat';
import type { Lap } from '@terv/kinyeres';
import { kategoriaJavaslat } from './kategoria';
import { tetoGeo } from '@terv/teto';
import { homlokzatiKapuk, type HomlokzatiKapu } from '@terv/homlokzatKapu';
const homKapuGy = new WeakMap<object, HomlokzatiKapu[]>();

export const AZ_TAJ: Record<string, number> = { 'É': 0, 'ÉK': 45, 'K': 90, 'DK': 135, 'D': 180, 'DNy': 225, 'Ny': 270, 'ÉNy': 315 };
export function kulterRaszter(al: AlaprajzFeldolgozas, k: Kijeloles): Set<number> {
  const ki = new Set<number>();
  for (const i of k.kulterH ?? []) { const ri = al.magHelyisegek.indexOf(al.e.helyisegek[i]!); if (ri >= 0) ki.add(ri); }
  return ki;
}
export const norm = (d: number) => ((Math.round(d * 10) / 10) % 360 + 360) % 360;

/** Egy alaprajz kijelölései: átvett egységek, kizárt helyiségek, besorolás-felülírás, kizárt nyílások. */
export interface Kijeloles { egysegek: Set<string>; kizartH: Set<number>; kat: Record<number, HelyisegKategoria>; kizartNy: Set<number>; mindFutott?: boolean;
  /** Más szint jegyzéktételéhez kötött rajzi helyiség: a helyiség (falai, nyílásai) marad, a jegyzék szerinti adata nem (terület 0). */
  masJegyzek?: Set<number>;
  /** A felhasználó által kültérnek jelölt helyiségek (pl. nyitott terasz, átjáró): nem kerülnek át, a feléjük eső fal külső fal. */
  kulterH?: Set<number>;
  /** A számított épületrészen kívüli (részkód szerint kizárt) helyiségek: a fűtetlen közülük (raktár, garázs) felé eső fal fal fűtetlen tér felé. */
  reszKizart?: Set<number>;
  /** Ismeretlen túloldalú falszakaszok, amelyeket a felhasználó külső falnak jelölt („raszterindex|szakaszindex”). */
  ismKulso?: Set<string>;
  /** A felhasználó által szerkesztett hőburok-körvonal (pt): ha megadott, a homlokzati falak és a külső nyílászárók ebből. */
  burok?: Poligon[];
  /** Belsőnek felismert, a felhasználó által külsőnek (homlokzati nyílásnak) jelölt nyílások (al.nyilasok indexe). */
  kulsoNy?: Set<number>;
  /** Falhoz nem köthető nyílásfeliratok, amelyeket a felhasználó külső nyílásként átvesz (al.arvaFeliratok indexe). */
  arvaBe?: Set<number>;
  /** Felirat nélküli (becsült méretű) tetősík ablakok kézzel megadott mérete (al.tetoablakok indexe → [szél, mag] m). */
  taMeret?: Record<number, [number, number]>;
  /** Nyílászárók kézzel átírt mérete (al.nyilasok indexe, 10000–19999: al.arvaFeliratok, ≥ 20000: al.modellAjtok – a 3D modellben kijelölve, a listában
   *  átírva): szélesség, magasság, mellvéd (m). */
  nyMeret?: Record<number, { szel: number; mag: number; pm: number | null; athidalo?: 'monolit' | 'eloregyartott' }>;
  /** Kézzel felvett helyiségek (pecsét nélküli zárt terület, pl. lépcső) – a lap újrafelismerésekor magként. */
  plusz?: { x: number; y: number; nev: string }[];
  /** Kézi falsávok (pt; pl. az AI-ellenőrzés javaslatára a PDF két párhuzamos vonala közti sáv) – a raszter falaihoz adva. */
  falPlusz?: Poligon[] }

const falPluszGy = new WeakMap<AlaprajzFeldolgozas, { kulcs: string; a: AlaprajzFeldolgozas }>();
/** Az elemzés a kézi falsávokkal (Kijeloles.falPlusz) – a raszter (és a 3D-s raszter) falai közé (változatlannál ugyanaz). */
export function falPluszAlkalmaz(a: AlaprajzFeldolgozas, savok?: Poligon[]): AlaprajzFeldolgozas {
  if (!savok?.length || !a.r) return a;
  const kulcs = JSON.stringify(savok), c = falPluszGy.get(a); if (c?.kulcs === kulcs) return c.a;
  const b: AlaprajzFeldolgozas = { ...a, r: raszterFalPlusz(a.r, savok), ...(a.r3d ? { r3d: raszterFalPlusz(a.r3d, savok) } : {}) };
  const lap = elemzesLap.get(a); if (lap) elemzesLap.set(b, lap);
  falPluszGy.set(a, { kulcs, a: b });
  return b;
}

const nyMeretGy = new WeakMap<AlaprajzFeldolgozas, { kulcs: string; a: AlaprajzFeldolgozas }>();
/** Az elemzés a kézzel átírt nyílásméretekkel (változatlan elemzésnél ugyanaz az objektum – a gyorsítótárak miatt). */
export function nyilasMeretAlkalmaz(a: AlaprajzFeldolgozas, m?: Kijeloles['nyMeret']): AlaprajzFeldolgozas {
  if (!m || !Object.keys(m).length) return a;
  const kulcs = JSON.stringify(m), c = nyMeretGy.get(a); if (c?.kulcs === kulcs) return c.a;
  const ir = (n: TervNyilas, x: { szel: number; mag: number; pm: number | null; athidalo?: 'monolit' | 'eloregyartott' }): TervNyilas => {
    // (csak az áthidaló választása: a méret marad a felismert)
    if (x.szel === n.szel && x.mag === n.mag && x.pm === n.pm && x.athidalo) return { ...n, athidalo: x.athidalo };
    const { mert: _m, ...u } = n; void _m;
    return { ...u, szel: x.szel, mag: x.mag, pm: x.pm, kezi: true, ...(x.athidalo ? { athidalo: x.athidalo } : {}) } as TervNyilas;
  };
  const b: AlaprajzFeldolgozas = { ...a, nyilasok: a.nyilasok.map((n, i) => (m[i] ? ir(n, m[i]!) : n)),
    ...(a.modellAjtok ? { modellAjtok: a.modellAjtok.map((n, j) => (m[20000 + j] ? ir(n, m[20000 + j]!) : n)) } : {}),
    // (a falhoz nem rendelt, a hőburok mentén átvett feliratok is – a 3D-ben és a listában 10000 + index)
    ...(a.arvaFeliratok ? { arvaFeliratok: a.arvaFeliratok.map((f, j) => (m[10000 + j] ? { ...f, szel: m[10000 + j]!.szel, mag: m[10000 + j]!.mag, pm: m[10000 + j]!.pm } : f)) } : {}) };
  const lap = elemzesLap.get(a); if (lap) elemzesLap.set(b, lap);
  nyMeretGy.set(a, { kulcs, a: b });
  return b;
}

/** A kijelölt fűtött (nem gyengén kapcsolt) helyiségek raszterindexei. */
export function futottRiK(al: AlaprajzFeldolgozas, k: Kijeloles): Set<number> {
  const hs = al.e.helyisegek;
  const egysegben = (i: number) => !al.e.egysegek.length || !hs[i]!.egyseg || k.egysegek.has(hs[i]!.egyseg!);
  const ki = new Set<number>();
  hs.forEach((h, i) => {
    if (!egysegben(i) || h.kulter || k.kizartH.has(i) || k.kulterH?.has(i)) return;
    if ((k.kat[i] ?? (k.mindFutott ? 'kondicionalt' : kategoriaJavaslat(h.nev, h.A) ?? 'kondicionalt')) === 'gyengen_kapcsolt') return;
    const x = al.magHelyisegek.indexOf(h); if (x >= 0) ki.add(x);
  });
  return ki;
}
/** A raszterhelyiségek pecsétpontjai (pt). */
export const pecsetPontok = (al: AlaprajzFeldolgozas) => new Map(al.magHelyisegek.map((h, i) => [i, { x: h.x, y: h.y }] as [number, { x: number; y: number }]));

/** Ismeretlen túloldalú falszakasz az épület szélén: a túloldalán 1,5 m-en belül külső tér (vagy a lap széle) kezdődik. */
export function kulsoKozelE(rr: Raszter, sg: FalSzakasz, nincsHely = 0): boolean {
  const [dx, dy] = sg.irany === 0 ? [0, -1] : sg.irany === 90 ? [1, 0] : sg.irany === 180 ? [0, 1] : [-1, 0];
  const minta = sg.pontok.filter((_, q) => q % Math.max(1, Math.floor(sg.pontok.length / 6)) === 0);
  let db = 0;
  for (const [x, y] of minta) {
    // `nincsHely` > 0: a túloldalon ennyi méteren belül nincs helyiség (a rajz körüli méretláncok, sraffozás, színezés
    // miatt a külső tér elárasztása nem ér a falig, de a fal mögött nincs épületrész)
    const vT = Math.max(1.5, nincsHely);
    for (let t = 0.2; t <= vT + 1e-9; t += 0.1) {
      const xi = Math.floor(((x + dx! * t / rr.mPerPt) - rr.x0) * rr.mPerPt / rr.px), yi = Math.floor(((y + dy! * t / rr.mPerPt) - rr.y0) * rr.mPerPt / rr.px);
      if (xi < 0 || yi < 0 || xi >= rr.w || yi >= rr.h) { db++; break; }
      const c = rr.cimke[yi * rr.w + xi]!;
      if (c === 1 && t <= 1.5) { db++; break; }
      if (c >= 2) break;
      if (nincsHely && t + 0.1 > vT) db++;
    }
  }
  return db >= Math.max(1, minta.length / 2);
}

/** Alapértelmezett kijelölés a felismerésből (minden egység; a csak jegyzékben szereplő sorok nélkül). */
export function alapKijeloles(al: AlaprajzFeldolgozas): Kijeloles {
  const vanPecset = al.e.helyisegek.some((h) => h.forras === 'pecset');
  const kizartH = new Set(al.leiras ? [] : al.auto ? al.e.helyisegek.map((h, i) => (al.e.egysegek.length && h.egyseg ? -1 : i)).filter((i) => i >= 0) : vanPecset ? al.e.helyisegek.map((h, i) => (h.forras === 'jegyzek' ? i : -1)).filter((i) => i >= 0) : []);
  // a helyiségjegyzékből hiányzó, kód nélküli pecsét (pl. kívül álló tároló, hulladéktároló), ha a pecsétek nagy része (≥ 70 %) a jegyzékben szerepel
  for (const i of jegyzekenKivul(al.e.helyisegek)) kizartH.add(i);
  // a meglévő (nem tervezett) épület helyiségei („Meglévő épület / Raktár”): szomszéd épület, alapból nem számít
  al.e.helyisegek.forEach((h, i) => { if (/\bmegl[ée]v[őo]\s+(?:épület|epulet|ép\.)/i.test(h.nev)) kizartH.add(i); });
  // pecsét nélküli (automatikusan felismert) alaprajz: az épület szélén álló, ismeretlen túloldalú falak (a rajz körüli
  // sraffozás, színezés miatt nem ér el a külső tér) alapból külső falként számítanak – a Hőburok-ellenőrzésben kivehetők
  const ismKulso = new Set<string>();
  if (al.auto && al.r) al.r.helyisegek.forEach((R, ri) => R.szakaszok.forEach((sg, j) => { if (sg.tul === 'ismeretlen' && sg.hossz >= 0.3 && kulsoKozelE(al.r!, sg, 4)) ismKulso.add(`${ri}|${j}`); }));
  return { egysegek: new Set(al.e.egysegek), kizartH, kat: {}, kizartNy: new Set(), ...(ismKulso.size ? { ismKulso } : {}) };
}

/** A külső nyílászárók: szerkesztett hőburoknál a körvonal közelében (≤ 1,3 m) lévők, az él irányával. */
export const BEJARATI_H = /el[őo]szoba|el[őo]t[ée]r|sz[ée]lfog[óo]|bej[áa]rat|^\s*esz\b/i;
export function burokNyilasok(al: AlaprajzFeldolgozas, k: Kijeloles) {
  const l = al.nyilasok.map((n, kk) => ({ n, kk }));
  if (!al.r) return l.filter(({ n }) => n.kulso && n.helyiseg !== null && n.irany !== null);
  if (!k.burok) {
    // felismert burok: a raszter szerinti külső nyílások, és a falhoz nem rendelt, a burkon kívül 1,5 m-en belül írt feliratok
    const fut0 = futottRiK(al, k), ab = burokAutoTar(al.r, fut0), pp0 = pecsetPontok(al), r0 = al.r;
    // (a felhasználó által külsőnek jelölt, belsőként felismert nyílás is – ablak, ha mellvédes, különben erkélyajtó)
    const alap = l.filter(({ n, kk }) => (n.kulso || k.kulsoNy?.has(kk)) && n.helyiseg !== null && n.irany !== null)
      .map(({ n, kk }) => (n.kulso ? { n, kk } : { n: { ...n, kulso: true, fajta: (n.pm !== null && n.pm > 0.05 ? 'ablak' : n.mag >= 1.9 ? 'erkelyajto' : 'ablak') as TervNyilas['fajta'] }, kk }));
    if (!ab.length) return alap;
    const koz = (x: number, y: number) => [...pp0.entries()].filter(([ri, q]) => fut0.has(ri) && ab.some((p) => bennE(p, q.x, q.y))).sort((u, v) => Math.hypot(u[1].x - x, u[1].y - y) - Math.hypot(v[1].x - x, v[1].y - y))[0]?.[0] ?? null;
    return alap.concat((al.arvaFeliratok ?? []).flatMap((f, j) => {
      // a burkon belül írt (falhoz nem rendelt) felirat a burok éle mentén (≤ 1 m), ha a fal túloldalán (≤ 3 m) külső tér
      // pecsétje (terasz, előlépcső) áll: bejárat a külső fal belső oldalára írt nyílásmérettel
      const bent = ab.some((p) => bennE(p, f.x, f.y));
      // a felhasználó külső nyílásként átveszi: a legközelebbi burokél (≤ 5 m) és a legközelebbi fűtött helyiség
      if (k.arvaBe?.has(j)) {
        const ir = nyilasEl(r0, ab, f.x, f.y, 5), h = koz(f.x, f.y); if (ir === null || h === null) return [];
        const ajto = (f.pm === null || f.pm <= 0.05) && f.mag >= 2;
        return [{ n: { szel: f.szel, mag: f.mag, pm: f.pm, x: f.x, y: f.y, helyiseg: h, irany: ir, kulso: true, fajta: (ajto ? 'erkelyajto' : 'ablak') as TervNyilas['fajta'], iranyTipp: true }, kk: 10000 + j }];
      }
      if (bent && !al.e.helyisegek.some((h) => h.kulter && h.forras === 'pecset' && !ab.some((p) => bennE(p, h.x, h.y)) && Math.hypot(h.x - f.x, h.y - f.y) * (al.e.mPerPt ?? 0) <= 3)) return [];
      const ir = nyilasEl(r0, ab, f.x, f.y, bent ? 1.0 : 1.5); if (ir === null) return [];
      const h = koz(f.x, f.y); if (h === null) return [];
      // (belül írt felirat: csak a külső nyílás nélküli bejárati helyiségben – előszoba, szélfogó, előtér –, a többiben belső
      // ajtó / nyílás felirata)
      if (bent && (alap.some(({ n }) => n.helyiseg === h) || !BEJARATI_H.test(al.magHelyisegek[h]?.nev ?? ''))) return [];
      const ajto = (f.pm === null || f.pm <= 0.05) && f.mag >= 2;
      return [{ n: { szel: f.szel, mag: f.mag, pm: f.pm, x: f.x, y: f.y, helyiseg: h, irany: ir, kulso: true, fajta: (ajto ? 'erkelyajto' : 'ablak') as TervNyilas['fajta'], iranyTipp: true }, kk: 10000 + j }];
    }));
  }
  const r = al.r, b = k.burok;
  const fut = futottRiK(al, k), pp = pecsetPontok(al);
  // helyiség nélküli nyílás: a legközelebbi, a burkon belüli fűtött helyiség pecsétje
  const kozeli = (x: number, y: number) => [...pp.entries()].filter(([ri, q]) => fut.has(ri) && b.some((p) => bennE(p, q.x, q.y))).sort((u, v) => Math.hypot(u[1].x - x, u[1].y - y) - Math.hypot(v[1].x - x, v[1].y - y))[0]?.[0] ?? null;
  return l.flatMap(({ n, kk }) => {
    if (n.fajta === 'belso_ajto' && !n.kulso) return [];
    // a burkon kívül írt felirat (homlokzati nyílás) 2,5 m-ig, belül csak a raszter szerint is külső nyílás, 1,5 m-ig
    const kint = !b.some((p) => bennE(p, n.x, n.y));
    if (!kint && !n.kulso && !k.kulsoNy?.has(kk)) return [];
    const ir = nyilasEl(r, b, n.x, n.y, kint ? 2.5 : 1.5); if (ir === null) return [];
    const h = n.helyiseg !== null && fut.has(n.helyiseg) ? n.helyiseg : kozeli(n.x, n.y); if (h === null) return [];
    return [{ n: { ...n, irany: ir, kulso: true, helyiseg: h }, kk }];
  }).concat((al.arvaFeliratok ?? []).flatMap((f, j) => {
    // falhoz nem rendelt felirat a burok mentén: nyílászáróként (mellvéd nélkül, legalább 2 m magas: erkélyajtó)
    if (b.some((p) => bennE(p, f.x, f.y))) return [];
    const ir = nyilasEl(r, b, f.x, f.y, 2.5); if (ir === null) return [];
    const h = kozeli(f.x, f.y); if (h === null) return [];
    const ajto = (f.pm === null || f.pm <= 0.05) && f.mag >= 2;
    return [{ n: { szel: f.szel, mag: f.mag, pm: f.pm, x: f.x, y: f.y, helyiseg: h, irany: ir, kulso: true, fajta: (ajto ? 'erkelyajto' : 'ablak') as TervNyilas['fajta'], iranyTipp: true }, kk: 10000 + j }];
  }));
}

/** A homlokzati rajzokból becsült északirány alaprajzonként gyorstárazva. */
export const eszakHomGy = new WeakMap<object, number | null>();
/** Homlokzati rajzok (keretekkel) lapcsoportonként gyorstárazva. */
export const homlokzatGy = new WeakMap<object, Map<number, HomlokzatRajz[]>>();
/** `M`: tartalék lépték (az alaprajzé), ha a homlokzati lapon nincs, vagy hibás a léptékfelirat. */
/** Homlokzati nézetek (fal-réteg sziluett oszloponként, a benne lévő nyílászárókeretekkel) – a falmagasság-modellhez. */
export const nezetGy = new WeakMap<object, Map<number, HomlokzatNezetAdat[]>>();
export function homlokzatNezetTar(lapok: Lap[], M?: number | null): HomlokzatNezetAdat[] {
  return lapok.flatMap((l, li) => {
    let m = nezetGy.get(l); if (!m) { m = new Map(); nezetGy.set(l, m); }
    const k = M ?? 0; let v = m.get(k);
    if (!v) {
      try {
        const ix = vonalIndex(l, M ?? undefined);
        const rz = homlokzatRajzTar([l], M);
        const ker = ix ? keretek(ix) : [];
        v = ix ? nezetOszlopok(l, ix.mPerPt).map((ny) => {
          const kk = ker.filter((q) => (q.x0 + q.x1) / 2 >= ny.bb[0] && (q.x0 + q.x1) / 2 <= ny.bb[2] && (q.y0 + q.y1) / 2 >= ny.bb[1] - 2 && (q.y0 + q.y1) / 2 <= ny.bb[3] + 2);
          const r = rz.map((x) => ({ x, db: x.keretek.filter((q) => (q.x0 + q.x1) / 2 >= ny.bb[0] && (q.x0 + q.x1) / 2 <= ny.bb[2]).length })).sort((a, c) => c.db - a.db)[0];
          // ablak nélküli nézet égtája: a hozzá legközelebbi (alatta / fölötte, vízszintesen átfedő) homlokzat-cím
          const cim = r && r.db ? null : homlokzatCimek(l).flatMap((t) => { const ir = t.t; const dx = t.x < ny.bb[0] ? ny.bb[0] - t.x : t.x > ny.bb[2] ? t.x - ny.bb[2] : 0; const dy = t.y > ny.bb[3] ? t.y - ny.bb[3] : t.y < ny.bb[1] ? ny.bb[1] - t.y : 0; return [{ az: AZ_TAJ[ir]!, d: dy + 2 * dx }]; }).sort((a, c) => a.d - c.d)[0];
          const az = r && r.db ? r.x.az : cim && cim.d * ix.mPerPt < 8 ? cim.az : undefined;
          return { ny, keretek: kk, mPerPt: ix.mPerPt, lap: li, ...(az !== undefined ? { az } : {}) };
        }).filter((x) => x.keretek.length >= 2 || x.az !== undefined) : [];
      } catch { v = []; }
      m.set(k, v);
    }
    return v;
  });
}
/** A homlokzati nézetek tetősziluettje (lapostetős szárnyak keresése) – laponként, hajlásonként és léptékenként tárolva. */
const sziluettGy = new WeakMap<Lap, Map<string, HomlokzatSziluett[]>>();
function sziluettTar(lapok: Lap[], hajlasok: number[], M?: number | null): HomlokzatSziluett[] {
  return lapok.flatMap((l) => {
    let m = sziluettGy.get(l); if (!m) { m = new Map(); sziluettGy.set(l, m); }
    const k = `${hajlasok.join(',')}|${M ?? 0}`; let v = m.get(k);
    if (!v) { try { v = homlokzatSziluettek(l, hajlasok, M ?? undefined); } catch { v = []; } m.set(k, v); }
    return v;
  });
}
export function homlokzatRajzTar(lapok: Lap[], M?: number | null): HomlokzatRajz[] {
  return lapok.flatMap((l) => {
    let m = homlokzatGy.get(l); if (!m) { m = new Map(); homlokzatGy.set(l, m); }
    const k = M ?? 0; let v = m.get(k);
    if (!v) { try { v = homlokzatRajzok(l, M ?? undefined); } catch { v = []; } m.set(k, v); }
    return v;
  });
}

/** Automatikus hőburok rasztertől és fűtött halmaztól függően gyorstárazva. */
export const burokAutoGy = new WeakMap<object, Map<string, Poligon[]>>();
export function burokAutoTar(r: NonNullable<AlaprajzFeldolgozas['r']>, fut: Set<number>): Poligon[] {
  let m = burokAutoGy.get(r); if (!m) { m = new Map(); burokAutoGy.set(r, m); }
  const kulcs = [...fut].sort((a, b) => a - b).join(',');
  let v = m.get(kulcs); if (!v) { v = burokAuto(r, fut); m.set(kulcs, v); }
  return v;
}

/**
 * A alakú ház (a tető a padlóig fut): az alaprajz körvonala a tetőtéri belső térnek csak egy része (a rajz a 1,9 m-es
 * vonalig, ill. a vágási magasságban metszett tetőig zár). A körvonal szélessége (W, a gerincre merőlegesen) és a metszet
 * belső gerincmagassága, hajlása adja a tető magasságát a körvonal szélén – ez a tetőtér térdfala. A helyiségek átlagos
 * belmagassága a teljes fűtött keresztmetszet (a padlótól a tetőig, a körvonalon túli alacsony sávokkal) a körvonal
 * szélességével osztva – így a fűtött térfogat a valódi.
 */
export function padloigTetoter(r: NonNullable<AlaprajzFeldolgozas['r']>, fut: Set<number>, pt: { terdfal: number; gerinc: number }, hajlas: number): { terdfal: number; belmag: number; W: number } | null {
  const pol = burokAutoTar(r, fut); const pp = pol.flat(); if (pp.length < 3) return null;
  // a legkisebb szélesség (fokonként forgatva)
  let W = Infinity;
  for (let d = 0; d < 180; d++) { const c = Math.cos(d * Math.PI / 180), s0 = Math.sin(d * Math.PI / 180); let lo = Infinity, hi = -Infinity; for (const [x, y] of pp) { const v = x * c + y * s0; if (v < lo) lo = v; if (v > hi) hi = v; } W = Math.min(W, (hi - lo) * r.mPerPt); }
  const tg = Math.tan(hajlas * Math.PI / 180); if (!(W > 1) || !(tg > 0)) return null;
  const t = Math.min(pt.gerinc, Math.max(pt.terdfal, pt.gerinc - (W / 2) * tg));
  // a teljes belső szélesség a padlón (a tetősík a térdfaltól a padlóig ér le): Wp; keresztmetszet: Wp·t0 + (Wp/2)²·tg
  const Wp = W + 2 * Math.max(0, t - pt.terdfal) / tg;
  const A = Wp * pt.terdfal + (Wp / 2) * (Wp / 2) * tg;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return { terdfal: r2(t), belmag: r2(Math.min(pt.gerinc, A / W)), W: r2(W) };
}

/** A lap megnevező feliratainak helye (≥ 4 betű): ezekben a zsebekben nem fűtött tér van (padlás, tároló). */
export const nevFeliratok = (lap: Lap) => lap.szovegek.filter((t) => /\p{L}{4,}/u.test(t.s)).flatMap((t) => [{ x: t.x, y: t.y }, { x: t.x + Math.cos(t.szog * Math.PI / 180) * t.szel / 2, y: t.y - Math.sin(t.szog * Math.PI / 180) * t.szel / 2 }]);
/** A raszterhelyiségek pecsét szerinti területe és pontja (a kifolyt rész levágásához). */
export const vartTer = (a: AlaprajzFeldolgozas) => (a.auto ? [] : a.magHelyisegek.map((h, ri) => ({ ri, A: h.A, x: (h.mutato ?? h).x, y: (h.mutato ?? h).y })));
/** Automatikus hőburok lapokra gyorstárazva (a 3D ábrához). */
export const burok3dTar = new Map<string, Poligon[]>();
export function burok3dCache(i: number, r: NonNullable<AlaprajzFeldolgozas['r']>, fut: Set<number>, lap?: Lap, a?: AlaprajzFeldolgozas, belso = false): Poligon[] {
  const kulcs = `${i}|${r.w}x${r.h}|${a?.r3d === r ? 'v' : ''}|${[...fut].sort((a, b) => a - b).join(',')}|${belso ? 'b' : 'k'}`;
  // belső méret: a helyiségek széle (a fal belső síkja); külső méret: a fal / hőszigetelés külső síkja
  let v = burok3dTar.get(kulcs); if (!v) { v = belso ? burokAuto(r, fut, lap ? nevFeliratok(lap) : undefined, a ? vartTer(a) : undefined) : burokTomeg(r, fut, lap ? nevFeliratok(lap) : undefined, a ? vartTer(a) : undefined); burok3dTar.set(kulcs, v); }
  return v;
}
/** Az elemzés forráslapja (a burok-zsebek megnevező feliratához). */
export const elemzesLap = new WeakMap<AlaprajzFeldolgozas, Lap>();
/** Felismert (nem szerkesztett) buroknál a homlokzati falak a 3D modell burkából: a körvonal (külső sík) mentén, a fal
 * belső síkján mért hosszal, a csatlakozó belső falak nélkül, csak a külső tér felé néző szakaszok (a fűtetlen / szomszéd
 * felé eső falak külön). Gyorstárazva. */
export type BurokFalAuto = { falak: Map<number, { irany: number; hossz: number; pontok?: [number, number][] }[]>; futetlen: Map<number, number> };
export const burokFalGy = new WeakMap<AlaprajzFeldolgozas, Map<string, BurokFalAuto>>();
export function burokFalakAuto(a: AlaprajzFeldolgozas, k: Kijeloles): BurokFalAuto | null {
  // (ugyanaz a raszter, mint a 3D-ben: a vektoros falú, ha van)
  const r = a.r3d ?? a.r; if (!r || !a.r) return null;
  const fut = futottRiK(a, k), kulcs = [...fut].sort((x, y) => x - y).join(',');
  let gy = burokFalGy.get(a); if (!gy) { gy = new Map(); burokFalGy.set(a, gy); }
  if (gy.has(kulcs)) return gy.get(kulcs)!;
  const lap = elemzesLap.get(a);
  const pol = burokAuto(r, fut, lap ? nevFeliratok(lap) : undefined, vartTer(a));
  const v: BurokFalAuto = { falak: new Map(), futetlen: new Map() };
  if (pol.length) {
    // az épületmodell (egy szint) hőburokfalai: a fal belső síkja a csatlakozó belső falak nélkül; a külső tér felé
    // nézők homlokzati falként (a lap szerinti iránnyal, a magassághoz a belső sík végpontjaival), a fűtetlen tér felé
    // nézők (a modellben nem szereplő fűtetlen tér, ill. fűtetlen helyiség felé) külön
    const { kategoria, adat } = lapKategoriak(a, k), mpp = a.r.mPerPt;
    const md = epuletModell([{ lap: 0, a, szintek: [{ id: 'F', nev: 'F', kod: 'F', z0: 0, h: 3, belmag: 2.7 }], m: (x, y) => [x * mpp, y * mpp], kategoria, adat, burokPol: pol, burokR: r }]);
    for (const f of md.falak) {
      const fr = f.forras; if (!fr) continue;
      const L = Math.round(Math.max(0, f.sikHossz - (f.csatlakozas ?? 0)) * 100) / 100; if (!(L > 0)) continue;
      if ((f.burok === 'kulso' || f.burok === 'talaj') && fr.pt && fr.irany !== undefined) { const l = v.falak.get(fr.ri) ?? []; l.push({ irany: fr.irany, hossz: L, pontok: fr.pt }); v.falak.set(fr.ri, l); }
      else if (f.burok === 'futetlen') v.futetlen.set(fr.ri, (v.futetlen.get(fr.ri) ?? 0) + L);
    }
  }
  gy.set(kulcs, v); return v;
}
/**
 * Tetőtér: a ferde tetősík vízszintes vetülete az épületmodellből (a tetőtér helyiségeinek pontonkénti magassága a
 * metszet szerinti hajlással, térdfallal és padlásfödém-magassággal), a tetőtér fűtött alapterületének arányában,
 * fő irányonként. Hiba vagy hiányzó burok esetén üres (a régi, eresz menti számítás marad).
 */
export function ferdeModell(a: AlaprajzFeldolgozas, k: Kijeloles, tt: { hajlas: number; terdfal: number | null; belmagassag?: number | null }, orom: Record<number, number>, bmAlap: number): { ferdeArany?: Record<number, number> } {
  try {
    const r = a.r3d ?? a.r; if (!r || !a.r || tt.terdfal === null || k.burok) return {};
    const fut = futottRiK(a, k), lap = elemzesLap.get(a);
    const pol = burokAuto(r, fut, lap ? nevFeliratok(lap) : undefined, vartTer(a)); if (!pol.length) return {};
    const { kategoria, adat, pecsetTerek } = lapKategoriak(a, k), mpp = a.r.mPerPt, belmag = tt.belmagassag ?? bmAlap;
    const md = epuletModell([{ lap: 0, a, szintek: [{ id: 'T', nev: 'T', kod: 'T', z0: 0, h: belmag + 0.35, belmag }], m: (x, y) => [x * mpp, y * mpp], kategoria, adat, pecsetTerek, burokPol: pol, burokR: r, tetoter: { hajlas: tt.hajlas, terdfal: tt.terdfal, belmag, orom } }]);
    const A = md.terek.filter((t) => t.kategoria === 'futott').reduce((q, t) => q + t.A, 0); if (!(A > 0)) return {};
    const fa: Record<number, number> = {};
    for (const v of md.vizszintes) if (v.fajta === 'ferde' && v.irany !== undefined) { const ax = (Math.round(v.irany / 90) * 90) % 360; fa[ax] = (fa[ax] ?? 0) + v.Avet / A; }
    return Object.keys(fa).length ? { ferdeArany: fa } : {};
  } catch { return {}; }
}
/** Egy alaprajz helyiségeinek modellbeli kategóriája (fűtött / fűtetlen / kültéri) és adatai a kijelölés szerint. */
export function lapKategoriak(a: AlaprajzFeldolgozas, k: Kijeloles) {
  const hs = a.e.helyisegek;
  const egysegben = (j: number) => !a.e.egysegek.length || !hs[j]!.egyseg || k.egysegek.has(hs[j]!.egyseg!);
  const kategoria = new Map<number, TerKategoria>(), adat = new Map<number, { kod?: string; nev: string; A?: number; burkolat?: string }>();
  const pecsetTerek: { kod?: string; nev: string; A: number; burkolat?: string; kategoria: TerKategoria }[] = [];
  hs.forEach((h, j) => {
    if (!egysegben(j) || k.kizartH.has(j)) return;
    const kt: TerKategoria = h.kulter || k.kulterH?.has(j) ? 'kulter' : (k.kat[j] ?? (k.mindFutott ? 'kondicionalt' : kategoriaJavaslat(h.nev, h.A) ?? 'kondicionalt')) === 'gyengen_kapcsolt' ? 'futetlen' : 'futott';
    const ri = a.magHelyisegek.indexOf(h);
    // (a rajzon helyiséghez nem köthető, jegyzékbeli tér: körvonal nélkül – a vízszintes elemekhez a szint átlaga szerint)
    if (ri < 0) { if (kt !== 'kulter' && (h.hasznosA ?? h.A)) pecsetTerek.push({ kod: h.kod, nev: h.nev, A: h.hasznosA ?? h.A, burkolat: h.burkolat, kategoria: kt }); return; }
    kategoria.set(ri, kt); adat.set(ri, k.masJegyzek?.has(j) ? { nev: `Helyiség ${ri + 1}`, A: 0 } : { kod: h.kod, nev: h.nev, A: h.hasznosA ?? h.A, burkolat: h.burkolat });
  });
  // (a felirattal azonosított, de a modellből kizárt – szomszéd, más szint, egységen kívüli – terek; a többi felirat
  // nélküli terület a rajzon: lépcső-, légtér)
  const kizart = new Set(hs.map((h) => a.magHelyisegek.indexOf(h)).filter((ri) => ri >= 0 && !kategoria.has(ri)));
  return { kategoria, adat, pecsetTerek, kizart };
}
/** A 3D hőburok nyílászárói (a megadott körvonal csak akkor számít, ha a burok szerkesztett – egyébként az átvétel készlete). */
export function burokNyilasokPt(al: AlaprajzFeldolgozas, k: Kijeloles, b: Poligon[]) {
  if (!b.length) return [];
  // mint az átvételnél: csak a kiválasztott (átvett), hőburkon belüli helyiségek nem kizárt nyílásai
  const hs = al.e.helyisegek;
  // (a fűtetlen, gyengén kapcsolt helyiség – pl. garázs – nyílászárói nem a hőburok részei)
  const kat = (i: number): HelyisegKategoria => k.kat[i] ?? (k.mindFutott ? 'kondicionalt' : kategoriaJavaslat(hs[i]!.nev, hs[i]!.A) ?? 'kondicionalt');
  const valasztott = (i: number) => i >= 0 && (!al.e.egysegek.length || !hs[i]!.egyseg || k.egysegek.has(hs[i]!.egyseg!)) && !hs[i]!.kulter && !k.kizartH.has(i) && !k.kulterH?.has(i) && kat(i) !== 'gyengen_kapcsolt';
  // felismert (nem szerkesztett) buroknál ugyanaz a nyílászáró-készlet, mint az átvételnél; a mért magassághoz az eredeti nyílás
  return burokNyilasok(al, k.burok ? k : { ...k, burok: undefined })
    .filter(({ n, kk }) => n.helyiseg !== null && n.helyiseg !== undefined && valasztott(hs.indexOf(al.magHelyisegek[n.helyiseg]!)) && !k.kizartNy.has(kk))
    .map(({ n, kk }) => ({ ...n, eredeti: kk < 10000 ? al.nyilasok[kk] : undefined }));
}

/** Egy alaprajz átvehető helyiségei (külső falakkal) és nyílászárói a kijelölés szerint. */
export function atvetelReszek(al: AlaprajzFeldolgozas, k: Kijeloles, mert?: Map<TervNyilas, MertMagassag>, falMag?: (s: FalSzakasz, ri: number) => number | null, burokFal = true): { helyisegek: AtvettHelyiseg[]; nyilasok: AtvettNyilas[]; ri: number[] } {
  const hs = al.e.helyisegek;
  const egysegben = (i: number) => !al.e.egysegek.length || !hs[i]!.egyseg || k.egysegek.has(hs[i]!.egyseg!);
  const valasztott = hs.map((h, i) => egysegben(i) && !h.kulter && !k.kizartH.has(i) && !k.kulterH?.has(i));
  const kategoria = (i: number): HelyisegKategoria => k.kat[i] ?? (k.mindFutott ? 'kondicionalt' : kategoriaJavaslat(hs[i]!.nev, hs[i]!.A) ?? 'kondicionalt');
  const ri = (i: number) => al.magHelyisegek.indexOf(hs[i]!);
  const kulterRi = kulterRaszter(al, k);
  // (tetőtéri lapon nem: ott a térdfal / oromfal a metszet szerint, a helyiségek falszakaszaiból)
  const bfA = !k.burok && burokFal ? burokFalakAuto(al, k) : null;
  const bf = k.burok && al.r ? burokFalak(al.r, k.burok, futottRiK(al, k), pecsetPontok(al)) : bfA?.falak ?? null;
  // (felismert burok: a talajjal érintkező rész aránya irányonként a helyiség raszteres falszakaszaiból)
  const talajOszt = (x: number, l: { irany: number; hossz: number }[]) => {
    if (k.burok || !al.r) return l;
    const sz = al.r.helyisegek[x]!.szakaszok.filter((sg) => sg.tul === 'kulso');
    return l.flatMap((f) => { const e = sz.filter((sg) => sg.irany === f.irany), o = e.reduce((t, sg) => t + sg.hossz, 0), tj = e.filter((sg) => sg.talaj).reduce((t, sg) => t + sg.hossz, 0);
      if (!(tj > 0) || !(o > 0)) return [f]; const q = Math.min(1, tj / o);
      return [...(q < 1 ? [{ ...f, hossz: Math.round(f.hossz * (1 - q) * 100) / 100 }] : []), { ...f, hossz: Math.round(f.hossz * q * 100) / 100, talaj: true }]; });
  };
  const falak = (i: number) => { const x = ri(i); if (bf) return x < 0 ? [] : talajOszt(x, bf.get(x) ?? []).filter((f) => f.hossz >= 0.3); return !al.r || x < 0 ? [] : al.r.helyisegek[x]!.szakaszok.filter((s, j) => ((s.tul === 'kulso' && !s.szomszed) || (s.tul === 'ismeretlen' && !!k.ismKulso?.has(`${x}|${j}`)) || (typeof s.tul === 'number' && kulterRi.has(s.tul))) && s.hossz >= 0.3); };
  const kiv = hs.map((h, i) => ({ h, i })).filter(({ i }) => valasztott[i]);
  const index = new Map(kiv.map(({ i }, j) => [i, j]));
  const helyisegek = kiv.map(({ h, i }) => ({
    ...(k.masJegyzek?.has(i) ? { nev: `Helyiség ${ri(i) + 1} (a(z) ${h.kod ?? ''} ${h.nev} más szint jegyzéktétele)`, A: 0 } : { kod: h.kod, nev: h.nev, burkolat: h.burkolat, A: h.hasznosA ?? h.A, ...(h.hasznosA ? { teljesA: h.A } : {}) }), kategoria: kategoria(i), egyseg: h.egyseg ? (al.e.egysegInfo[h.egyseg]?.nev ?? h.egyseg) : undefined, falak: falak(i).map((f) => { const m0 = falMag && 'pontok' in f ? falMag(f as FalSzakasz, ri(i)) : null, m = m0 !== null && (m0 >= (burokFal ? 2.2 : 1) || (f as { terd?: boolean }).terd) ? m0 : null; /* nem tetőtéri lapon 2,2 m alatt (térdfal nélkül) nem a fűtött helyiség fala, hanem mellvéd, terasz, pergola; tetőtéren 1 m (mint a 3D-ben) */ return { irany: f.irany, hossz: f.hossz, ...("talaj" in f && f.talaj ? { talaj: true } : {}), ...(m !== null ? { magassag: m } : {}), ...((f as { terd?: boolean }).terd && m !== null ? { terd: true } : {}) }; }),
    // fal fűtetlen (gyengén kapcsolt) helyiség felé, pl. garázs
    futetlenFalak: (() => { const x = ri(i); if (!al.r || x < 0) return [];
      const l = al.r.helyisegek[x]!.szakaszok.filter((s) => typeof s.tul === 'number' && s.hossz >= 0.3).flatMap((s) => {
        const mi = hs.indexOf(al.magHelyisegek[s.tul as number]!); return mi >= 0 && (valasztott[mi] || !!k.reszKizart?.has(mi)) && !hs[mi]!.kulter && kategoria(mi) === 'gyengen_kapcsolt' && kategoria(i) !== 'gyengen_kapcsolt' ? [{ hossz: s.hossz, fele: hs[mi]!.nev }] : []; });
      // (felismert burok: a burok mentén fűtetlen tér felé eső, a helyiségszakaszokból hiányzó rész – pl. pecsét nélküli
      // csarnok, raktár)
      const ff = bfA?.futetlen.get(x) ?? 0, mar = ff - l.reduce((t, f) => t + f.hossz, 0);
      return kategoria(i) !== 'gyengen_kapcsolt' && mar >= 0.3 ? [...l, { hossz: Math.round(mar * 100) / 100, fele: 'fűtetlen tér' }] : l; })(),
  }));
  const nyilasok = burokNyilasok(al, k)
    .map(({ n, kk }) => ({ n, kk, hi: hs.indexOf(al.magHelyisegek[n.helyiseg!]!) }))
    .filter(({ hi, kk }) => hi >= 0 && valasztott[hi] && !k.kizartNy.has(kk))
    .map(({ n, hi }): AtvettNyilas => {
      // méretfelirat nélküli nyílás: a magasság a homlokzatról (vagy becsült); padlóig érő → erkélyajtó
      const m = n.mert ? mert?.get(n) ?? { mag: n.szel >= 1.6 ? 2.4 : 1.5 } : null;
      const tp = n.iranyTipp ? { iranyTipp: true } : {};
      if (m) return { fajta: m.mag >= 2 ? 'erkelyajto' : 'ablak', szel: n.szel, mag: m.mag, pm: m.mag >= 2 ? 0 : 0.9, helyiseg: index.get(hi)!, irany: n.irany!, ...tp };
      return { fajta: n.fajta as AtvettNyilas['fajta'], szel: n.szel, mag: n.mag, pm: n.pm, helyiseg: index.get(hi)!, irany: n.irany!, ...tp };
    });
  // fűtött és fűtetlen (gyengén kapcsolt) helyiség közti ajtó: a fűtetlen tér felé eső falból vonódik le
  const futetlenNy = al.nyilasok.flatMap((n): AtvettNyilas[] => {
    if (n.kulso || n.fajta !== 'belso_ajto' || n.helyiseg === null || n.masik === undefined || !(n.mag > 0)) return [];
    const a = hs.indexOf(al.magHelyisegek[n.helyiseg]!), b = hs.indexOf(al.magHelyisegek[n.masik]!);
    if (a < 0 || b < 0 || !valasztott[a] || !valasztott[b]) return [];
    const ga = kategoria(a) === 'gyengen_kapcsolt', gb = kategoria(b) === 'gyengen_kapcsolt';
    if (ga === gb) return [];
    const [fi, ui] = ga ? [b, a] : [a, b];
    return [{ fajta: 'bejarati_ajto', szel: n.szel, mag: n.mag, pm: n.pm, helyiseg: index.get(fi)!, irany: n.irany ?? 0, fele: hs[ui]!.nev }];
  });
  return { helyisegek, nyilasok: [...nyilasok, ...futetlenNy], ri: kiv.map(({ i }) => ri(i)) };
}

/** A beolvasott, de még át nem vett alaprajz-lapok száma (a lépés elhagyásakor figyelmeztetéshez). */
export const tervbolFuggo = { lapok: 0 };

export const homMagGy = new WeakMap<AlaprajzFeldolgozas, Map<string, any>>();
/** A metszetlapok belmagasság-sávjai és a helyiségenkénti belmagasság (gyorstár). */
export const belmagSavGy = new WeakMap<Lap, BelmagSavok[]>();
export const tetoFelulGy = new WeakMap<Lap, TetoFelulnezet | null>();
export const szobaMagGy = new WeakMap<AlaprajzFeldolgozas, Map<string, HelyisegMagassag | null>>();

/** A Tervből lépés felhasználói döntései és bemenetei (a komponens getterekkel adja át – a záradékok híváskor olvassák). */
export interface FolyamatAllapot {
  readonly lapok: TervLap[];
  readonly elemzesek: Record<number, AlaprajzFeldolgozas | string>;
  readonly kijelolesek: Record<number, Kijeloles>;
  readonly szintKi: Record<number, string[]>;
  readonly kihagyLap: Record<number, boolean>;
  readonly eszakKulon: Record<number, number>;
  readonly eszakKozos: number | null;
  readonly futottValasz: Record<string, boolean>;
  readonly mindFutott: boolean;
  readonly reszKod: string;
  readonly bm: number | undefined;
  readonly me: MetszetAdat | null;
  readonly terdfalKezi: number | undefined;
  readonly homlokzatLapok: { l: TervLap; i: number }[];
  /** A teljes épületmodell kézi paraméterei (a 3D nézetben állíthatók). */
  readonly modellKezi?: ModellKezi;
}
/** A teljes épületmodell kézzel felülírt paraméterei. */
export interface ModellKezi {
  /** Tetőhajlás (fok); 0: lapostető (nincs magastető). */
  hajlas?: number;
  /** Ereszkiállás (m). */
  kiallas?: number;
  /** Ereszkiállás oldalanként (lapirány: 0 fel, 90 jobbra, 180 le, 270 balra; m) – a nagyobb érték a tetőt az oldal fölé
   *  (fedett terasz, bejárat) is kiterjeszti. */
  kiallasOldal?: Record<number, number>;
  /** Végenként (lapirány: 0 fel, 90 jobbra, 180 le, 270 balra): true = oromfal, false = konty. */
  orom?: Record<number, boolean>;
  /** Szintenkénti belmagasság (m), szintkód szerint. */
  belmag?: Record<string, number>;
  /** Lapostetős sáv a legfelső szint körvonalának oldalairól (lapirány: 0 fent, 90 jobbra, 180 lent, 270 balra): a sáv
   *  szélessége (m); 0 = azon az oldalon nincs lapostető. A felismert sávot az adott oldalon felülírja. */
  lapos?: Record<number, number>;
  /** Az oldalhoz érő sáv teteje: féltető (hajlás, fok; a lejtés lapiránya) vagy null: lapostető (a felismertet felülírja). */
  felteto?: Record<number, { hajlas: number; lejt: number } | null>;
}
export type MetszetAdat = NonNullable<ReturnType<typeof metszetFeldolgoz>>;

export const SZINT_SOR = ['P', 'F', '1', '2', '3', '4', '5', 'T'];
export const kerdesKulcs = (nev: string) => nev.toLowerCase().replace(/\s*\([^)]*\)\s*/g, ' ').replace(/[^\p{L}\s-]/gu, '').replace(/\s+/g, ' ').trim();
/** A számított épületrész helyiségkód-előtagjai („A, B1” → [„a”, „b1”]). */
export const reszElotagokKodbol = (reszKod: string) => reszKod.split(/[,;\s]+/).map((x) => x.trim().toLowerCase().replace(/[^a-z0-9]/g, '')).filter(Boolean);

/** Felhasználói döntések nélküli (alapértelmezett) állapot a lapokból – pl. az ELBA-hoz. A belmagasság a metszetből, ennek híján a
 * helyiségpecsétekből (mint a Tervből lépésben). */
export function alapAllapot(lapok: TervLap[], elemzesek: Record<number, AlaprajzFeldolgozas | string>, me: MetszetAdat | null, tovabbi: Partial<FolyamatAllapot> = {}): FolyamatAllapot {
  return { lapok, elemzesek, kijelolesek: {}, szintKi: {}, kihagyLap: {}, eszakKulon: {}, eszakKozos: null, futottValasz: {}, mindFutott: false, reszKod: '', bm: me?.szintek.belmagassag[0] ?? pecsetBelmagassag(lapok.filter((l) => l.szerep === 'alaprajz')), me,
    terdfalKezi: undefined, homlokzatLapok: lapok.map((l, i) => ({ l, i })).filter(({ l }) => l.szerep === 'homlokzat'), ...tovabbi };
}

/**
 * A lapok közti összefüggések (szintek, kijelölés, északjel, homlokzati falmagasság, oromzat) és a teljes épületmodell.
 * A Tervből lépés ugyanezeket a záradékokat használja.
 */
export function tervFolyamat(S: FolyamatAllapot) {
  const alaprajzLapok = () => S.lapok.map((l, i) => ({ l, i })).filter(({ l }) => l.szerep === 'alaprajz');
  const reszKizar = (a: AlaprajzFeldolgozas): number[] => { const reszElotagok = reszElotagokKodbol(S.reszKod); return !reszElotagok.length ? [] : a.e.helyisegek.map((h, i) => {
    const k = (h.kod ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return h.kulter || reszElotagok.some((e) => k.startsWith(e)) ? -1 : i;
  }).filter((i) => i >= 0); };
  /**
   * Más szint helyiségei a lap helyiségjegyzékében (a jegyzék gyakran minden lapon az összes szint helyiségeit sorolja):
   * az azonos kódú és nevű (kód híján azonos nevű), ±5 % területű tétel két szint lapján – annak a szintnek a helyisége,
   * ahol a rajzon a területéhez illő helyiség tartozik hozzá; ha egyiken sem (vagy mindkettőn), ahol a kódja a lapon
   * megtalált helyiségek kódjaihoz közelebb esik. A másik lapon kimarad.
   */
  function masSzintKizar(i: number, a: AlaprajzFeldolgozas): number[] {
    const sz0 = lapSzintek(i).join(',');
    const masok = S.lapok.flatMap((l, i2) => (i2 !== i && l.szerep === 'alaprajz' && typeof S.elemzesek[i2] === 'object' && lapSzintek(i2).join(',') !== sz0 ? [S.elemzesek[i2] as AlaprajzFeldolgozas] : []));
    if (!masok.length) return [];
    const nv = (x: { nev: string }) => x.nev.trim().toLowerCase();
    // a rajzi helyiség illeszkedése (a raszter-terület eltérése a jegyzékétől; nincs rajzi helyiség: 1)
    const illik = (b: AlaprajzFeldolgozas, h: AlaprajzFeldolgozas['e']['helyisegek'][number]) => { const ri = b.magHelyisegek.indexOf(h); const rA = ri >= 0 ? b.r?.helyisegek[ri]?.A : undefined; return rA && h.A > 0 ? Math.abs(rA - h.A) / h.A : 1; };
    const kodSzam = (k?: string) => { const m = k?.match(/\d+/g); return m ? Number(m.join('')) : NaN; };
    const elotag = (k?: string) => (k ?? '').replace(/[^A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű]/g, '').toUpperCase();
    // a lapon megtalált (a rajzhoz illő) helyiségek közül az azonos kód-előtagúak száma, ill. a kódszám távolsága
    const elotagDb = (b: AlaprajzFeldolgozas, kod?: string) => { const e = elotag(kod); return e ? b.e.helyisegek.filter((x) => illik(b, x) <= 0.3 && elotag(x.kod) === e).length : 0; };
    const tav = (b: AlaprajzFeldolgozas, kod?: string) => { const n = kodSzam(kod); let d = Infinity; if (Number.isNaN(n)) return d; for (const x of b.e.helyisegek) if (illik(b, x) <= 0.3 && elotag(x.kod) === elotag(kod)) { const v = Math.abs(kodSzam(x.kod) - n); if (v < d) d = v; } return d; };
    const ki: number[] = [];
    a.e.helyisegek.forEach((h, j) => {
      if (!h.kod) return;
      const egyezik = (x: typeof h) => x.kod === h.kod && nv(x) === nv(h) && Math.abs(x.A - h.A) <= 0.05 * Math.max(x.A, h.A, 0.1);
      for (const b of masok) {
        const x = b.e.helyisegek.find(egyezik); if (!x) continue;
        // melyik szint helyisége: 1. ahol a kód előtagja (pl. FS / EM) a megtalált helyiségeké, 2. ahol a rajzon a
        // területéhez illő helyiség tartozik hozzá, 3. ahol a kódszáma a megtalált helyiségekéhez közelebb esik
        const ea = elotagDb(a, h.kod), eb = elotagDb(b, h.kod);
        const fa = illik(a, h) <= 0.3, fb = illik(b, x) <= 0.3;
        // (az előtag csak akkor szintjelölő, ha az egyik lapon nincs ilyen előtagú rajzi helyiség – pl. lakásjel („L01-…”)
        // mindkét szinten van)
        const masik = ea !== eb && (ea === 0 || eb === 0) ? eb > ea : fa !== fb ? fb : tav(b, h.kod) < tav(a, h.kod);
        if (masik) { ki.push(j); break; }
      }
    });
    return ki;
  }
  const kjVeg = (i: number, a: AlaprajzFeldolgozas): Kijeloles => {
    const k = S.kijelolesek[i] ?? alapKijeloles(a); const rk = reszKizar(a), msz = masSzintKizar(i, a);
    const kat = { ...k.kat };
    a.e.helyisegek.forEach((h, j) => { if (kat[j] === undefined && S.futottValasz[kerdesKulcs(h.nev)] && kategoriaJavaslat(h.nev, h.A) === 'gyengen_kapcsolt') kat[j] = 'kondicionalt'; });
    // (más szint jegyzéktétele: rajzi helyiség nélkül kimarad, rajzi helyiséggel a helyiség marad, az adata nem)
    const mszKi = msz.filter((j) => a.magHelyisegek.indexOf(a.e.helyisegek[j]!) < 0), mszR = msz.filter((j) => !mszKi.includes(j));
    const kiz = [...rk, ...mszKi];
    // berajzolt gépkocsi pecsét nélküli tere (garázsnak vett): ha van homlokzati rajz, de a kapunyílás a homlokzaton nem
    // látszik (a magassága nem a homlokzatról jön), kültéri (fedett) beálló – nem helyiség
    const beallo = beallok(i, a, k);
    // (a körvonala nagy részén fal nélküli – nyitott – tér alapból kültér, amíg a felhasználó be nem sorolja)
    for (const [j, h] of a.e.helyisegek.entries()) if (h.nyitott && k.kat[j] === undefined && !k.kulterH?.has(j) && !k.kizartH.has(j)) beallo.push(j);
    return { ...k, kat, kizartH: kiz.length ? new Set([...k.kizartH, ...kiz]) : k.kizartH, mindFutott: S.mindFutott, ...(rk.length ? { reszKizart: new Set(rk) } : {}), ...(mszR.length ? { masJegyzek: new Set(mszR) } : {}),
      ...(beallo.length ? { kulterH: new Set([...(k.kulterH ?? []), ...beallo]) } : {}) };
  };
  /** A berajzolt gépkocsi szerint felvett terek (helyiségindex), amelyek kapuja a homlokzaton nem látszik: kültéri beálló. */
  const beallok = (i: number, a: AlaprajzFeldolgozas, k: Kijeloles): number[] => {
    const gk = a.e.helyisegek.map((h, j) => (h.gepkocsi && !k.kulterH?.has(j) && k.kat[j] === undefined ? j : -1)).filter((j) => j >= 0);
    if (!gk.length || !S.homlokzatLapok.length) return [];
    const mm = mert3d(i, a);
    // a homlokzati rajzokon a kapu (szekcionált / lamellás panelsor) – a kapunyíláshoz illő (± 0,6 m) szélességgel
    const homKapuk = S.homlokzatLapok.flatMap(({ l }) => { let v = homKapuGy.get(l.lap); if (!v) { const M = meretaranyKeres(l.lap.szovegek, l.lap.utvonalak) ?? a.e.meretarany ?? 100; try { v = homlokzatiKapuk(l.lap, (25.4 / 72) / 1000 * M); } catch { v = []; } homKapuGy.set(l.lap, v); } return v; });
    return gk.filter((j) => { const ri = a.magHelyisegek.indexOf(a.e.helyisegek[j]!); const kapu = a.nyilasok.find((n) => n.helyiseg === ri && n.fajta === 'garazskapu');
      if (!kapu) return true;
      if (kapu.mert && mm?.get(kapu)?.forras === 'homlokzat') return false;
      return !homKapuk.some((q) => Math.abs(q.szel - kapu.szel) <= 0.6 && q.mag >= 1.8 && q.mag <= 3.2); });
  };
  // (a címben szint nélküli alaprajz – „UTCASZINTI ALAPRAJZ” – szintje a helyiségek szintjeleiből)
  const lapSzintek0 = (i: number) => {
    const c = szintekCimbol(S.lapok[i]?.cim ?? ''); if (c.length) return c;
    const a = S.elemzesek[i], l = S.lapok[i];
    return typeof a === 'object' && l?.szerep === 'alaprajz' && l.lap ? szintJelekbol(l.lap.szovegek, a.e.helyisegek) : [];
  };
  // a metszeten a tető a földszinti padlóig fut (A alakú ház, a tető alatt nincs szintmagas külső fal): az egyetlen
  // terepszint feletti alaprajzi szint tetőtér (a lapon kézzel átállítható)
  const padloigT = (i: number) => {
    if (!S.me?.padloigTeto || S.lapok[i]?.szerep !== 'alaprajz') return false;
    const sz = lapSzintek0(i); if (sz.length > 1 || (sz.length === 1 && sz[0] !== 'F')) return false;
    const felso = new Set(alaprajzLapok().flatMap(({ i: j }) => (typeof S.elemzesek[j] === 'object' ? lapSzintek0(j) : [])).filter((x) => x !== 'P'));
    return [...felso].every((x) => x === 'F');
  };
  const lapSzintek = (i: number) => {
    if (S.szintKi[i]) return S.szintKi[i]!;
    return padloigT(i) ? ['T'] : lapSzintek0(i);
  };
  /** Kimarad-e a lap az „Összes átvétele” műveletből (alapból a pince). */
  /** A pinceszint alapból kimarad – kivéve, ha van fűtött helyisége (pl. pincei lépcsőház, előtér, gépészet). */
  const kimarad = (i: number) => {
    if (S.kihagyLap[i] !== undefined) return S.kihagyLap[i]!;
    // (a pince a cím / kézi szint szerint – az A alakú háznál átírt tetőtér nem lehet pince, és a metszet itt még
    // nem kell: a Tervből lépés a metszet feldolgozása előtt is kérdezi)
    if (!(S.szintKi[i] ?? lapSzintek0(i)).includes('P')) return false;
    const a = S.elemzesek[i];
    return !(typeof a === 'object' && atvetelReszek(a, kjVeg(i, a)).helyisegek.some((h) => h.kategoria !== 'gyengen_kapcsolt'));
  };
  // északjel nélküli lap: a homlokzati rajzokból (címbeli égtáj + nyílások helyzete), ha egyértelmű
  const eszakHomSajat = (a: AlaprajzFeldolgozas | null | undefined): number | null => {
    if (!a || (a.e.eszak && !a.e.eszak.bizonytalan) || !a.e.mPerPt || !S.homlokzatLapok.length) return null;
    if (eszakHomGy.has(a)) return eszakHomGy.get(a)!;
    let v: number | null = null; try { v = eszakHomlokzatbol(a.nyilasok, a.e.mPerPt, homlokzatRajzTar(S.homlokzatLapok.map(({ l }) => l.lap), a.e.meretarany)); } catch { v = null; }
    eszakHomGy.set(a, v); return v;
  };
  // ha ezen a lapon nem egyértelmű, egy másik alaprajzi lapé (az alaprajzok egymásra tolással illeszkednek: közös a tájolásuk)
  const eszakHom = (a: AlaprajzFeldolgozas | null | undefined): number | null => {
    const v = eszakHomSajat(a); if (v !== null || !a || (a.e.eszak && !a.e.eszak.bizonytalan)) return v;
    for (const { i } of alaprajzLapok()) { const b = S.elemzesek[i]; if (typeof b !== 'object' || !b || b === a) continue; const eb = (b as AlaprajzFeldolgozas).e.eszak; if (a.e.eszak && eb && Math.abs(((a.e.eszak.szog - eb.szog + 540) % 360) - 180) > 5) continue; const w = eszakHomSajat(b as AlaprajzFeldolgozas); if (w !== null) return w; }
    return null;
  };
  // a helyszínrajz (biztos) északjele – az alaprajzzal azonos állású rajzon (ld. lent)
  let eszakHsGy: number | null | undefined;
  const eszakHelyszin = (): number | null => {
    if (eszakHsGy !== undefined) return eszakHsGy;
    eszakHsGy = null;
    for (const l of S.lapok) { if (l.szerep !== 'egyeb' || !/helysz[íi]nrajz/i.test(l.cim)) continue;
      let e: ReturnType<typeof eszakjelKeres> = null; try { e = eszakjelKeres(l.lap); } catch { e = null; }
      if (e && !e.bizonytalan) { eszakHsGy = norm(e.szog); break; } }
    return eszakHsGy;
  };
  // a bizonytalan (betű nélküli alakból becsült) északjel helyett a homlokzatokból adódó irány, ha az egyértelmű;
  // északjel nélküli alaprajznál a helyszínrajz északjele, ha a homlokzatok (címbeli égtáj) szerinti iránytól legfeljebb
  // 45°-kal tér el (a homlokzatok elnevezése a fő égtájakra kerekít; a helyszínrajz nincs elforgatva az alaprajzhoz képest)
  const eszakFelismert = (a: AlaprajzFeldolgozas | null | undefined) => {
    if (a?.e.eszak && !(a.e.eszak.bizonytalan && eszakHom(a) !== null)) return norm(a.e.eszak.szog + eszakJavitas(a.e.eszak.alairas));
    const h = eszakHom(a);
    if (h !== null && !a?.e.eszak) { const hs = eszakHelyszin(); if (hs !== null && Math.abs(((hs - h + 540) % 360) - 180) <= 45) return hs; }
    return h ?? (a?.e.eszak ? norm(a.e.eszak.szog + eszakJavitas(a.e.eszak.alairas)) : 0);
  };
  const eszakLap = (i: number, a: AlaprajzFeldolgozas | null | undefined) => S.eszakKulon[i] ?? S.eszakKozos ?? eszakFelismert(a);
  // a homlokzati falmagasság-illesztés (lapindex + paraméterek szerint gyorsítótárazva – a 3D minden rajzolásakor kell)
  // a 3D nézethez: méretfelirat nélküli nyílások homlokzatról mért magassága (lapszintenként, gyorsítótárazva)
  const mert3d = (i: number, a: AlaprajzFeldolgozas): Map<TervNyilas, MertMagassag> | undefined => {
    if (!a.r || !a.e.mPerPt || !S.homlokzatLapok.length || !a.nyilasok.some((n) => n.mert)) return undefined;
    const szk = lapSzintek(i).length ? lapSzintek(i) : ['F'], eszak = eszakLap(i, a);
    const szintSor = [...new Set(alaprajzLapok().flatMap(({ i: j }) => lapSzintek(j)))].sort((x, y) => SZINT_SOR.indexOf(x) - SZINT_SOR.indexOf(y));
    const kulcs = `mert|${szk.join(',')}|${eszak}|${S.homlokzatLapok.length}|${szintSor.join(',')}`;
    let gy = homMagGy.get(a); if (!gy) { gy = new Map(); homMagGy.set(a, gy); }
    if (gy.has(kulcs)) return gy.get(kulcs);
    let v: Map<TervNyilas, MertMagassag> | undefined;
    try { v = mertMagassagok(a.nyilasok, a.e.mPerPt, eszak, homlokzatRajzTar(S.homlokzatLapok.map(({ l }) => l.lap), a.e.meretarany), Math.max(0, szintSor.indexOf(szk[0]!)), szintSor.length); } catch { v = undefined; }
    gy.set(kulcs, v); return v;
  };
  // a teljes modellhez: a feliratos ablakok homlokzat szerinti, az alaprajzitól eltérő mellvédmagassága
  const mellved3d = (i: number, a: AlaprajzFeldolgozas): Map<TervNyilas, number> | undefined => {
    if (!a.e.mPerPt || !S.homlokzatLapok.length) return undefined;
    const szk = lapSzintek(i).length ? lapSzintek(i) : ['F'], eszak = eszakLap(i, a);
    const szintSor = [...new Set(alaprajzLapok().flatMap(({ i: j }) => lapSzintek(j)))].sort((x, y) => SZINT_SOR.indexOf(x) - SZINT_SOR.indexOf(y));
    const kulcs = `mellved|${szk.join(',')}|${eszak}|${S.homlokzatLapok.length}|${szintSor.join(',')}`;
    let gy = homMagGy.get(a); if (!gy) { gy = new Map(); homMagGy.set(a, gy); }
    if (gy.has(kulcs)) return gy.get(kulcs);
    let v: Map<TervNyilas, number> | undefined;
    try { v = homlokzatMellvedek(a.nyilasok, a.e.mPerPt, eszak, S.homlokzatLapok.map(({ l }) => l.lap), a.e.meretarany ?? undefined, Math.max(0, szintSor.indexOf(szk[0]!)), szintSor.length); } catch { v = undefined; }
    gy.set(kulcs, v); return v;
  };
  // a teljes modellhez: a homlokzattal nem egyező feliratos ablakok / erkélyajtók (ellenőrzésre)
  const homElteres3d = (i: number, a: AlaprajzFeldolgozas): Map<TervNyilas, { szel: number; mag: number } | null> | undefined => {
    if (!a.e.mPerPt || !S.homlokzatLapok.length) return undefined;
    const eszak = eszakLap(i, a), szintDb = new Set(alaprajzLapok().flatMap(({ i: j }) => lapSzintek(j))).size || 1, kulcs = `elteres|${eszak}|${S.homlokzatLapok.length}|${szintDb}`;
    let gy = homMagGy.get(a); if (!gy) { gy = new Map(); homMagGy.set(a, gy); }
    if (gy.has(kulcs)) return gy.get(kulcs);
    let v: Map<TervNyilas, { szel: number; mag: number } | null> | undefined;
    try { v = homlokzatElteresek(a.nyilasok, a.e.mPerPt, eszak, S.homlokzatLapok.map(({ l }) => l.lap), a.e.meretarany ?? undefined, szintDb); } catch { v = undefined; }
    gy.set(kulcs, v); return v;
  };
  // a metszet(ek) rétegrendjei anyagokkal, hőtechnikai jellemzőkkel (BIM / ELBA)
  const modellRetegrendek = (): ModellRetegrend[] => {
    const mLi = S.lapok.findIndex((l) => l.szerep === 'metszet');
    return (S.me?.blokkok ?? []).map((b) => {
      const retegek: ModellReteg[] = b.retegek.filter((r) => r.dCm > 0).map((r) => {
        const a = anyag(r.anyagId);
        return { leiras: r.forras, vastag: Math.round(r.dCm * 10) / 1000,
          ...(a ? { anyag: { id: a.id, nev: a.nev, kategoria: a.kategoria, sraffozas: a.sraffozas, ...(r.lambda ?? a.lambda ? { lambda: r.lambda ?? a.lambda } : {}), ...(a.mu !== undefined ? { mu: a.mu } : {}), ...(a.R ? { R: a.R } : {}) } } : {}),
          ...(r.legreteg ? { legreteg: r.legreteg } : {}), ...(r.borda ? { borda: { szelCm: r.borda.szelCm, tavCm: r.borda.tavCm, ...(r.borda.anyagId ? { anyagId: r.borda.anyagId } : {}) } } : {}),
          ...(r.kimarad ? { kimarad: r.kimarad } : {}) };
      });
      let U: number | undefined;
      try { const sz = b.becsles.szerep; if (sz) U = Math.round(retegrendSzamitas({ id: b.rr.kod, nev: b.rr.cim, szerep: sz as RrSzerep, kovetelmenyKod: b.becsles.kovetelmenyKod, hoaramIrany: b.becsles.hoaramIrany, kulsoOldal: b.becsles.kulsoOldal, retegek: b.retegek.filter((r) => !r.kimarad) }).U * 1000) / 1000; } catch { U = undefined; }
      return { kod: b.rr.kod, cim: b.rr.cim, szerep: b.becsles.szerep, hoburok: b.becsles.kihagy ?? true, ...(b.becsles.kovetelmenyKod ? { kovetelmeny: b.becsles.kovetelmenyKod } : {}),
        hoaramIrany: b.becsles.hoaramIrany, kulsoOldal: b.becsles.kulsoOldal, retegek, ...(U !== undefined && Number.isFinite(U) ? { U } : {}),
        ...(mLi >= 0 ? { forras: { lap: mLi, x: b.rr.x, y: b.rr.y } } : {}) };
    });
  };
  const homMag3d = (i: number, a: AlaprajzFeldolgozas, szk: string[], eszak: number) => {
    const kulcs = `${szk.join(',')}|${eszak}|${S.bm}|${S.homlokzatLapok.length}|${(S.me?.szintek.padlo ?? []).join(',')}|${S.me?.tetoter?.belmagassag ?? ''}`;
    let m = homMagGy.get(a); if (!m) { m = new Map(); homMagGy.set(a, m); }
    if (!m.has(kulcs)) { let v: ReturnType<typeof homMagModell> = null; try { v = homMagModell(a, szk, eszak, szk.includes('T') && !!S.me?.szintek.belmagassag.length); } catch { v = null; } m.set(kulcs, v); }
    void i; return m.get(kulcs) ?? null;
  };
  /**
   * Hőburokfal (nem tetőtéri szint) homlokzat szerinti magassága élenként: alacsonyabb párkány / attika (≥ 1 m, a
   * szintnél érdemben alacsonyabb), tetőablakos helyiség lejtés felőli térdfala (0,3–1,5 m, ennek híján az alapértelmezett).
   * A, B: a fal (belső) síkjának végpontjai a lapon (pt), nx, ny: kifelé mutató egységnormális. null: a szint magassága.
   */
  const elMagFv = (i: number, a: AlaprajzFeldolgozas, r: Raszter, el: { dx: number; dy: number }, sor: { i: number }[], alap: Raszter, szk: string[], emelet: number, belso: boolean, polPt: [number, number][][], hm0?: ReturnType<typeof homMag3d>) => {
    let hm = hm0 === undefined ? homMag3d(i, a, szk, eszakLap(i, a)) : hm0;
    // az illesztés ezen a lapon nem sikerült (kevés homlokzati nyílás): az alaplap illesztése, a lap eltolásával
    let lapra = (p: [number, number]): [number, number] => p;
    const a0 = S.elemzesek[sor[0]!.i] as AlaprajzFeldolgozas;
    if (!hm && i !== sor[0]!.i && Math.abs(alap.mPerPt / r.mPerPt - 1) < 0.02 && eszakLap(sor[0]!.i, a0) === eszakLap(i, a)) {
      const h0 = homMag3d(sor[0]!.i, a0, szk, eszakLap(sor[0]!.i, a0));
      if (h0) { hm = h0; const k0 = r.mPerPt / alap.mPerPt; lapra = ([x, y]) => [(x - el.dx) * k0, (y - el.dy) * k0]; }
    }
    // tetőablakos helyiség (a jel az alaprajzon): a tetősík közvetlenül a helyiség fölött – a lejtés felőli
    // külső fala térdfal (a homlokzat szerinti, ennek híján az alapértelmezett térdfal-magasság)
    const ar = a.r, tab = a.tetoablakok ?? [];
    const terdfalE = (A: [number, number], B: [number, number], nx: number, ny: number, irany: number) => {
      // metszettel a szint belmagassága ismert (a tetőablak lehet fénycsatornás, sík mennyezetű helyiségben is) – kivéve, ha a
      // metszeten tetőtér (ferde tető alatti helyiség) van
      if (!ar || !tab.length || (S.me?.szintek.belmagassag.length && !S.me.tetoter)) return false;
      // a fal mögötti helyiség: a fal közepétől befelé 0,5–2 m-re az első helyiségpixel (a külső méretű körvonal
      // a falvastagságon, a belső közelében rajzi vonal – pl. eresz – lehet)
      const ptPx = ar.mPerPt / ar.px; let h = -1;
      for (const dm of [0.5, 0.8, 1.2, 1.6, 2.0]) {
        const d = dm / ar.mPerPt, cx = (A[0] + B[0]) / 2 - nx * d, cy = (A[1] + B[1]) / 2 - ny * d;
        const gx = Math.round((cx - ar.x0) * ptPx), gy = Math.round((cy - ar.y0) * ptPx);
        if (gx < 0 || gy < 0 || gx >= ar.w || gy >= ar.h) continue;
        const c = ar.cimke[gy * ar.w + gx]!; if (c >= 2) { h = c - 2; break; }
      }
      if (h < 0) return false;
      return tab.some((t) => t.helyiseg === h && Math.abs(((t.irany - irany + 540) % 360) - 180) <= 30);
    };
    const terdAlap = S.me?.tetoter?.terdfal ?? S.terdfalKezi ?? S.me?.tetoter?.terdfalTipp ?? 0.9;
    if (!(hm?.felso || tab.length)) return null;
    const hh = belso ? emelet - 0.35 : emelet;
    return (A: [number, number], B: [number, number], nx: number, ny: number): number | null => {
      const dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy);
      // lapirány (0 = fel, 90 = jobbra), a tengelyhez ±2°-on belül igazítva
      let irany = ((Math.atan2(nx, -ny) * 180) / Math.PI + 360) % 360;
      const t90 = Math.round(irany / 90) * 90; if (Math.abs(irany - t90) <= 2) irany = t90 % 360;
      if (terdfalE(A, B, nx, ny, irany)) {
        const v = hm?.felso ? hm.mod.magassag(irany, [lapra(A), lapra([(A[0] + B[0]) / 2, (A[1] + B[1]) / 2]), lapra(B)], hm.zf, hm.zc) : null;
        // térdfal: 0,3–1,5 m a homlokzat szerint, ennek híján az alapértelmezett. Magasabb érték itt a homlokzat
        // falként (falréteg kitöltéssel) rajzolt tetősíkja – a tetőablakok helye mutatja, hogy a fal fölött tető van
        return v !== null && v >= 0.3 && v <= 1.5 ? v : Math.min(terdAlap, hh);
      }
      if (!hm?.felso) return null;
      // visszahúzott fal (loggia, bemélyedés): a homlokzat az előtte lévő elemet (mellvéd, korlát) mutatja
      const ux = dx / l, uy = dy / l, sA = A[0] * ux + A[1] * uy, dA = A[0] * nx + A[1] * ny, tol = 0.05 / r.mPerPt;
      const elotte = polPt.some((q2) => q2.some(([x, y]) => { const s0 = x * ux + y * uy; return s0 >= sA - tol && s0 <= sA + l + tol && (x * nx + y * ny - dA) * r.mPerPt > 0.6; }));
      if (elotte) return null;
      const v = hm.mod.magassag(irany, [lapra(A), lapra([(A[0] + B[0]) / 2, (A[1] + B[1]) / 2]), lapra(B)], hm.zf, hm.zc);
      // csak az érdemben alacsonyabb (alacsonyabb párkány, attika) számít; a magasabbat a szint határolja.
      // 2,2 m alatt (nem tetőtéri lapon, tetőablakos térdfal nélkül) nem a fűtött helyiség fala: a homlokzat alacsonyabb
      // vonala mellvéd, terasz, pergola, áthidaló gerenda (Tb-barlang: a terasz fa áthidalója 1,4 m-es „térdfal” lett);
      // fűtött helyiség belmagassága ennél kisebb nem lehet
      return v !== null && v < hh - 0.15 && v >= (szk.includes('T') ? 1 : 2.2) ? v : null;
    };
  };
  /** A homlokzatokon látszó oromzatok szélessége alaprajzi irányonként (0/90/180/270). */
  function oromok(eszak: number, M?: number, kontyNelkul = false): Record<number, number> {
    const ki: Record<number, number> = {};
    // (a felirat nélküli, rajzból mért hajlás csak a teljes modell tetőjéhez)
    const hj = S.me?.tetoter?.hajlas ?? (kontyNelkul ? S.me?.tetoHajlas : undefined);
    if (!hj) return ki;
    const konty = new Set<number>();
    for (const { l } of S.homlokzatLapok) {
      let lista: { az: number; orom: number; kontyOldal?: boolean }[] = []; try { lista = oromSzelessegek(l.lap, hj, M, { kontyNelkul }); } catch { lista = []; }
      for (const x of lista) { const ir = (Math.round(norm(x.az + eszak) / 90) * 90) % 360; ki[ir] = Math.max(ki[ir] ?? 0, x.orom); if (x.kontyOldal) konty.add(ir); }
    }
    // a kontyolt tetőt oldalról (trapéz) mutató homlokzatra merőleges homlokzatokon a háromszög a kontylap, nem oromzat
    for (const ir of konty) for (const m of [(ir + 90) % 360, (ir + 270) % 360]) ki[m] = 0;
    // a felülnézet (helyszínrajz, tetőfelülnézet) dönt: a gerincvég élgerinc-párral kontyolt, szabad végén oromzat –
    // irányonként, ha az adott irányban minden vég egyforma
    const fv = tetoFelulVegek(eszak);
    if (fv) for (const [ir, f] of fv) { if (f === 'konty') ki[ir] = 0; else ki[ir] = Math.max(ki[ir] ?? 0, 99); }
    return ki;
  }
  /**
   * A tetőforma a felülnézetből: a helyszínrajz / tetőfelülnézet összefüggő tetői közül az, amelyik méretben az alaprajzi
   * épülethez illik (a szomszéd épületek tetői kimaradnak); a végek iránya az alaprajz lapirányában (0 = fel, órajárás
   * szerint). Null, ha nincs felülnézet, nem illeszthető, vagy nincs egyértelmű vég.
   */
  function tetoFelulVegek(eszak: number): Map<number, 'konty' | 'orom'> | null {
    // az épület alaprajzi kiterjedése (m): az alaprajzok helyiségeinek befoglalója
    let W = 0, H = 0;
    for (const { i } of alaprajzLapok()) { const a = S.elemzesek[i]; if (typeof a !== 'object' || !a?.r) continue; const r = a.r;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let y = 0; y < r.h; y += 2) for (let x = 0; x < r.w; x += 2) if (r.cimke[y * r.w + x]! >= 2) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 > x0) { W = Math.max(W, (x1 - x0) * r.px); H = Math.max(H, (y1 - y0) * r.px); } }
    if (!(W > 3 && H > 3)) return null;
    const meret = [W, H].sort((p, q) => q - p);
    for (const l of S.lapok) {
      if (!/helysz[íi]nrajz|tet[őo] ?fel[üu]ln[ée]zet|tet[őo]felülnézet/i.test(l.cim ?? '')) continue;
      let t: TetoFelulnezet | null | undefined = tetoFelulGy.get(l.lap);
      if (t === undefined) { try { t = tetoFelulnezet(l.lap); } catch { t = null; } tetoFelulGy.set(l.lap, t); }
      const M = meretaranyKeres(l.lap.szovegek, l.lap.utvonalak); if (!t || !M) continue;
      const mPt = (25.4 / 72 / 1000) * M;
      // (a tetővonalak befoglalója az ereszig ér – az alaprajzi kiterjedésnél ereszkiállással nagyobb)
      let leg = null as { c: number; hiba: number } | null;
      t.csoportok.forEach((b, c) => { const m = [(b.x1 - b.x0) * mPt, (b.y1 - b.y0) * mPt].sort((p, q) => q - p); const hiba = Math.max(Math.abs(m[0]! - meret[0]! - 0.8) / meret[0]!, Math.abs(m[1]! - meret[1]! - 0.8) / meret[1]!); if (hiba <= 0.2 && (!leg || hiba < leg.hiba)) leg = { c, hiba }; });
      if (!leg) continue;
      const legC = leg.c;
      const eszakHs = (() => { let e: ReturnType<typeof eszakjelKeres> = null; try { e = eszakjelKeres(l.lap); } catch { e = null; } return e && !e.bizonytalan ? norm(e.szog) : null; })();
      const ki = new Map<number, 'konty' | 'orom'>(), vegyes = new Set<number>();
      for (const v of t.vegek) { if (v.csoport !== legC) continue;
        const lapIr = (v.irany + 90) % 360; // (a lapon: 0 = fel, órajárás szerint)
        const ir = (Math.round(norm(eszakHs === null ? lapIr : lapIr - eszakHs + eszak) / 90) * 90) % 360;
        if (ki.has(ir) && ki.get(ir) !== v.fajta) vegyes.add(ir); ki.set(ir, v.fajta); }
      for (const ir of vegyes) ki.delete(ir);
      if (ki.size) return ki;
    }
    return null;
  }
  /**
   * A felülnézet (helyszínrajz, tetőfelülnézet) méretben illeszkedő tetőcsoportjának vonalai a modell lapirányában (m):
   * a felülnézeti lap a két északjel szerint elforgatva, a csoport közepe az origó – a magastető ereszvonalának
   * kereséséhez (az illesztés eltolása a magastető építésekor, a födém körvonalához).
   */
  function tetoFelulAdat(eszak: number): { sz: [number, number, number, number][]; W: number; H: number } | null {
    let W = 0, H = 0;
    for (const { i } of alaprajzLapok()) { const a = S.elemzesek[i]; if (typeof a !== 'object' || !a?.r) continue; const r = a.r;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let y = 0; y < r.h; y += 2) for (let x = 0; x < r.w; x += 2) if (r.cimke[y * r.w + x]! >= 2) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 > x0) { W = Math.max(W, (x1 - x0) * r.px); H = Math.max(H, (y1 - y0) * r.px); } }
    if (!(W > 3 && H > 3)) return null;
    const meret = [W, H].sort((p, q) => q - p);
    for (const l of S.lapok) {
      if (!/helysz[íi]nrajz|tet[őo] ?fel[üu]ln[ée]zet|tet[őo]felülnézet/i.test(l.cim ?? '')) continue;
      let t: TetoFelulnezet | null | undefined = tetoFelulGy.get(l.lap);
      if (t === undefined) { try { t = tetoFelulnezet(l.lap); } catch { t = null; } tetoFelulGy.set(l.lap, t); }
      const M = meretaranyKeres(l.lap.szovegek, l.lap.utvonalak); if (!t || !M) continue;
      const mPt = (25.4 / 72 / 1000) * M;
      let leg = null as { c: number; hiba: number } | null;
      t.csoportok.forEach((b, c) => { const m = [(b.x1 - b.x0) * mPt, (b.y1 - b.y0) * mPt].sort((p, q) => q - p); const hiba = Math.max(Math.abs(m[0]! - meret[0]! - 0.8) / meret[0]!, Math.abs(m[1]! - meret[1]! - 0.8) / meret[1]!); if (hiba <= 0.2 && (!leg || hiba < leg.hiba)) leg = { c, hiba }; });
      if (!leg) continue;
      const b = t.csoportok[(leg as { c: number }).c]!;
      const eszakHs = (() => { let e: ReturnType<typeof eszakjelKeres> = null; try { e = eszakjelKeres(l.lap); } catch { e = null; } return e && !e.bizonytalan ? norm(e.szog) : null; })();
      // (a felülnézeti lap iránya a modell lapirányába: az óramutató szerint eszak − eszakHs fokkal)
      const th = ((eszakHs === null ? 0 : eszak - eszakHs) * Math.PI) / 180, co = Math.cos(th), si = Math.sin(th);
      const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, mg = 4 / mPt;
      const P = (x: number, y: number): [number, number] => { const dx = (x - cx) * mPt, dy = (y - cy) * mPt; return [dx * co - dy * si, dx * si + dy * co]; };
      const sz: [number, number, number, number][] = [];
      for (const u of l.lap.utvonalak) {
        if (u.muvelet === 'none' || u.bbox[2] < b.x0 - mg || u.bbox[0] > b.x1 + mg || u.bbox[3] < b.y0 - mg || u.bbox[1] > b.y1 + mg) continue;
        for (const p of u.pontok) for (let k = 0; k + 3 < p.length; k += 2) { const L = Math.hypot(p[k + 2]! - p[k]!, p[k + 3]! - p[k + 1]!) * mPt; if (L < 0.5) continue; sz.push([...P(p[k]!, p[k + 1]!), ...P(p[k + 2]!, p[k + 3]!)]); }
      }
      if (sz.length < 4) continue;
      return { sz, W: (b.x1 - b.x0) * mPt, H: (b.y1 - b.y0) * mPt };
    }
    return null;
  }
  /**
   * Alaprajz + homlokzat: a homlokzati nézetek illesztése a lap homlokzati falaihoz – a legfelső fűtött szinten a
   * falmagasság (oromfal, térdfal, eltérő párkány); az átvétel és a 3D modell közös alapja.
   */
  function homMagModell(a: AlaprajzFeldolgozas, szintekO: string[], eszak: number, tetoterLap: boolean) {
      if (!a.r || !a.e.mPerPt || !S.homlokzatLapok.length) return null;
      const szintSor = [...new Set(alaprajzLapok().flatMap(({ i }) => lapSzintek(i)))].sort((x, y) => SZINT_SOR.indexOf(x) - SZINT_SOR.indexOf(y));
      const nz = homlokzatNezetTar(S.homlokzatLapok.map(({ l }) => l.lap), a.e.meretarany); if (!nz.length) return null;
      const fut = szintSor.filter((x) => x !== 'P'); const idx = Math.max(0, fut.indexOf(szintekO.find((x) => x !== 'P') ?? 'F'));
      const padlok = (S.me?.szintek.padlo ?? []).filter((v) => v > -1);
      const zf = padlok[idx] ?? idx * ((S.bm ?? 2.7) + 0.35);
      const zc = zf + (tetoterLap ? S.me?.tetoter?.belmagassag ?? S.bm ?? 2.6 : S.bm ?? 2.7);
      const felso = szintekO.includes(fut[fut.length - 1] ?? 'F');
      const fl = a.r.helyisegek.flatMap((H, ri) => H.szakaszok.filter((sg) => sg.tul === 'kulso' && sg.hossz >= 0.3).map((sg) => ({ irany: sg.irany, pontok: sg.pontok, h: ri })));
      // az épület alaprajzi kiterjedése irányonként (a falpixelek vetülete, ritkítva)
      const r0 = a.r; const kit = new Map<number, [number, number] | null>();
      const kiterjedes = (ir: number) => {
        if (kit.has(ir)) return kit.get(ir)!;
        const t = ir * Math.PI / 180, c = -Math.cos(t), sn = -Math.sin(t); let lo = Infinity, hi = -Infinity;
        for (let y = 0; y < r0.h; y += 3) for (let x = 0; x < r0.w; x += 3) if (r0.fal[y * r0.w + x]) { const px = r0.x0 + (x + 0.5) * r0.px / r0.mPerPt, py = r0.y0 + (y + 0.5) * r0.px / r0.mPerPt; const v = (c * px + sn * py) * a.e.mPerPt!; if (v < lo) lo = v; if (v > hi) hi = v; }
        const e: [number, number] | null = lo < hi ? [lo, hi] : null; kit.set(ir, e); return e;
      };
      const mod = falMagassagModell(a.nyilasok, a.e.mPerPt, eszak, nz, zf, fl, kiterjedes); if (!mod.db) return null;
      return { mod, zf, zc, felso, fl };
  }
  /**
   * Eltérő belmagasságú épületrészek (csarnok + fejépület) egyszintes épületnél: a metszet belmagasság-sávjai az alaprajz
   * fűtött helyiségeire illesztve (raszterindex → belmagasság). Többszintes épületnél, ill. egyértelmű illesztés híján null.
   */
  function szobaMagassag(i: number, a: AlaprajzFeldolgozas): HelyisegMagassag | null {
    if (!a.r || !S.me) return null;
    const szintek = new Set(alaprajzLapok().filter(({ i: j }) => !kimarad(j)).flatMap(({ i: j }) => lapSzintek(j)).filter((x) => x !== 'P'));
    if (szintek.size > 1 || (S.me.szintek.szintszam ?? 1) > 2) return null;
    const ms = S.lapok.filter((l) => l.szerep === 'metszet').flatMap((l) => { let v = belmagSavGy.get(l.lap); if (!v) { try { v = belmagassagSavok(l.lap); } catch { v = []; } belmagSavGy.set(l.lap, v); } return v; });
    // (csak ha az épületrészek belmagassága valóban eltér a szint belmagasságától: legalább egy sáv ≥ 1 m-rel magasabb)
    if (!ms.some((m) => m.savok.some((q) => q.h >= (S.bm ?? 2.7) + 1))) return null;
    const fut = futottRiK(a, kjVeg(i, a)); const kulcs = [...fut].sort((x, y) => x - y).join(',');
    let gy = szobaMagGy.get(a); if (!gy) { gy = new Map(); szobaMagGy.set(a, gy); }
    if (gy.has(kulcs)) return gy.get(kulcs)!;
    let v: HelyisegMagassag | null = null; try { v = helyisegMagassagok(a.r, ms, [...fut]); } catch { v = null; }
    if (v && new Set(v.magassag.values()).size < 2) v = null;
    gy.set(kulcs, v); return v;
  }
  // teljes épületmodell (IFC-szerű): szintek, terek, falak, nyílászárók, födémek – a hőburok jelölve
  const epuletModellApp = (eszakSz?: number): EpuletModell | null => {
    const me = S.me;
    const sor = alaprajzLapok().filter(({ i }) => !kimarad(i) && typeof S.elemzesek[i] === 'object' && (S.elemzesek[i] as AlaprajzFeldolgozas).r);
    if (!sor.length) return null;
    const alap = (S.elemzesek[sor[0]!.i] as AlaprajzFeldolgozas).r!;
    if (eszakSz === undefined) eszakSz = eszakLap(sor[0]!.i, S.elemzesek[sor[0]!.i] as AlaprajzFeldolgozas);
    const emelet = (S.bm ?? 2.7) + 0.35, MK = S.modellKezi ?? {};
    const jelen = [...new Set(sor.flatMap(({ i }) => (lapSzintek(i).length ? lapSzintek(i) : ['F'])))].sort((x, y) => SZINT_SOR.indexOf(x) - SZINT_SOR.indexOf(y));
    const nulla = jelen.indexOf('F') >= 0 ? jelen.indexOf('F') : jelen.findIndex((x) => x !== 'P');
    // szintmagasság: kézi belmagasság + 0,35 m födém, különben az egységes emeletmagasság; a szintek alja ebből halmozva
    const szintH = (sz0: string) => (MK.belmag?.[sz0] !== undefined ? MK.belmag[sz0]! + 0.35 : emelet);
    const szintZ = (sz0: string) => { const j = jelen.indexOf(sz0), n0 = Math.max(0, nulla); let z = 0;
      if (j >= n0) for (let q = n0; q < j; q++) z += szintH(jelen[q]!); else for (let q = j; q < n0; q++) z -= szintH(jelen[q]!);
      return Math.round(z * 100) / 100; };
    const be: LapBemenet[] = sor.map(({ i }) => {
      const a = S.elemzesek[i] as AlaprajzFeldolgozas, r = a.r!, k = kjVeg(i, a);
      const el = i === sor[0]!.i ? { dx: 0, dy: 0 } : eltolas(alap, r) ?? { dx: 0, dy: 0 };
      const { kategoria, adat, pecsetTerek, kizart } = lapKategoriak(a, k);
      const szk = lapSzintek(i).length ? lapSzintek(i) : ['F'];
      // tetőtér (metszetből): hajlás, térdfal, padlásfödém
      const tt0 = me?.tetoter ? { hajlas: me.tetoter.hajlas, terdfal: me.tetoter.terdfal ?? 0.9, belmag: me.tetoter.belmagassag ?? (S.bm ?? 2.6) } : undefined;
      // (A alakú ház: a térdfal a tető magassága az alaprajz körvonalán)
      const pT = tt0 && me?.padloigTeto && szk.includes('T') ? padloigTetoter(r, futottRiK(a, k), me.padloigTeto, tt0.hajlas) : null;
      const tt = tt0 && pT ? { ...tt0, terdfal: pT.terdfal } : tt0;
      const szintek: EpSzint[] = szk.map((sz0) => ({ id: sz0, nev: szintNev(sz0), kod: sz0, z0: szintZ(sz0), h: szintH(sz0), belmag: MK.belmag?.[sz0] ?? (sz0 === 'T' && tt ? tt.belmag : S.bm ?? 2.7) }));
      const m = (x: number, y: number): [number, number] => [(x - el.dx) * r.mPerPt, (y - el.dy) * r.mPerPt];
      // a fűtött terek hőburka: ugyanaz, mint a 3D-ben és az átvételben (belső sík)
      // (kézzel szerkesztett hőburok: a falak és a födémek / a tető abból – a fűtetlen terek tömegével együtt)
      const burokPol = k.burok ?? burok3dCache(i, a.r3d ?? r, futottRiK(a, k), S.lapok[i]?.lap, a, true);
      const tomegPol = k.burok ? burokTomegKezi(r, k.burok, new Set([...kategoria.entries()].filter(([, kt]) => kt !== 'kulter' && kt !== 'futott').map(([ri]) => ri))) : undefined;
      // hőburokfalak magassága: tetőtéren a tetősíkok szerinti profil, a legfelső szinten a homlokzat (párkány, térdfal)
      let elMag: ReturnType<typeof elMagFv> | undefined, tg: ReturnType<typeof tetoGeo>[] | undefined;
      const falMagassag: LapBemenet['falMagassag'] = (sz0, w) => {
        if (sz0.kod === 'T' && tt) {
          if (!tg) { const orom = oromok(eszakSz, a.e.meretarany ?? undefined); tg = (burokPol ?? []).map((q) => tetoGeo(q.map(([x, y]) => m(x, y)), tt, orom)); }
          // a fal belső síkját tartalmazó körvonal (a középpontja a körvonal élén)
          const mx = (w.A[0] + w.B[0]) / 2, my = (w.A[1] + w.B[1]) / 2;
          let leg = -1, d0 = 0.3;
          (burokPol ?? []).forEach((q, pi) => q.forEach((P, j) => { const [ax, ay] = m(...P), [bx, by] = m(...q[(j + 1) % q.length]!); const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy; if (L2 < 1e-6) return; const t = Math.max(0, Math.min(1, ((mx - ax) * dx + (my - ay) * dy) / L2)); const d = Math.hypot(ax + dx * t - mx, ay + dy * t - my); if (d < d0) { d0 = d; leg = pi; } }));
          const g = leg >= 0 ? tg[leg] : undefined; if (!g) return null;
          const l = Math.hypot(w.B[0] - w.A[0], w.B[1] - w.A[1]), N = Math.max(2, Math.ceil(l / 0.25));
          const ts0 = Array.from({ length: N + 1 }, (_, q) => q / N), hs = ts0.map((u) => g.H([w.A[0] + (w.B[0] - w.A[0]) * u, w.A[1] + (w.B[1] - w.A[1]) * u]));
          const profil = ts0.flatMap((u, q) => (q === 0 || q === N || Math.abs(hs[q - 1]! - 2 * hs[q]! + hs[q + 1]!) > 1e-3 ? [{ t: u, z: hs[q]! }] : []));
          const zMax = Math.max(...profil.map((q) => q.z)), zMin = Math.min(...profil.map((q) => q.z));
          if (zMin >= tt.belmag - 0.01) return null;
          if (zMax - zMin < 0.05) return { belsoMag: zMin, jelleg: 'terdfal' };
          return { profil, jelleg: g.elek.some((e) => e.fajta === 'orom' && Math.abs((e.a[0] - mx) * e.ny - (e.a[1] - my) * e.nx) < 0.3 && Math.abs((e.a[0] - mx) * e.nx + (e.a[1] - my) * e.ny) < 0.3) ? 'oromfal' : 'ferde' };
        }
        if (sz0.kod === 'T') return null;
        if (elMag === undefined) elMag = elMagFv(i, a, r, el, sor, alap, szk, emelet, true, burokPol ?? [], undefined);
        if (!elMag) return null;
        const [A, B] = w.pt; if (Math.hypot(B[0] - A[0], B[1] - A[1]) * r.mPerPt < 0.3) return null;
        const v = elMag(A, B, Math.sin((w.irany * Math.PI) / 180), -Math.cos((w.irany * Math.PI) / 180));
        return v === null ? null : { belsoMag: v, jelleg: v < 1.6 ? 'terdfal' : 'parkany' };
      };
      const mellved = mellved3d(i, a), homElteres = homElteres3d(i, a);
      return { lap: i, a, szintek, m, kategoria, adat, pecsetTerek, kizart, ...(mellved?.size ? { mellved } : {}), ...(homElteres?.size ? { homElteres } : {}), ...(S.lapok[i]?.lap ? { rajz: S.lapok[i]!.lap } : {}), ...(k.ismKulso ? { ismKulso: k.ismKulso } : {}), falMagassag, ...(tt && szk.includes('T') ? { tetoter: { ...tt, orom: oromok(eszakSz, a.e.meretarany ?? undefined) } } : {}),
        ...(burokPol ? { burokPol, burokR: k.burok ? r : a.r3d ?? r } : {}), ...(tomegPol ? { tomegPol } : {}) };
    });
    // födémek rétegrendje a metszetlapok vízszintes sávjaiból
    const mE = S.lapok.flatMap((l, li) => (l.szerep === 'metszet' ? [{ li, e: metszetElemek(l.lap) }] : []));
    const fodemSav = mE.flatMap(({ li, e }) => e.savok.map((q) => ({ ...q, lap: li })));
    // magastető: a metszet hajlása, a homlokzatok oromzatai, az ereszkiállás a metszetekből
    const M0 = be[0] ? (be[0].a as AlaprajzFeldolgozas).e.meretarany ?? undefined : undefined;
    // (csak ha a metszeteken a hajlásszögű ferde vonalak összesen ≥ 4 m – a szögfelirat egymagában lépcső, lejtés is lehet)
    // (szögfelirat nélkül a metszet ferde tetővonalaiból mért hajlás)
    const hj = me?.tetoter?.hajlas ?? me?.tetoHajlas;
    const ferde = hj ? S.lapok.filter((l) => l.szerep === 'metszet').reduce((t, l) => t + ferdeTetoHossz(l.lap, hj), 0) : 0;
    // ereszkiállás a metszetekből (a ferde tetővonal alsó vége – a fal külső síkja); ennek híján becsült
    const kiallas = hj ? ereszKiallas(mE.flatMap(({ li, e }) => ereszKiallasok(S.lapok[li]!.lap, hj, e.mPt))) : undefined;
    // (a teljes modell magastetőjénél a kontylap nem oromfal – a Navitherm tetőterénél egyelőre a régi szabály)
    // (kézi paraméterek: hajlás – 0 = lapostető –, ereszkiállás, végenként oromfal / konty)
    const orom0 = (hj && ferde >= 4) || MK.hajlas ? oromok(eszakSz, M0, true) : undefined;
    const oromK = orom0 && MK.orom ? { ...orom0, ...Object.fromEntries(Object.entries(MK.orom).map(([ir, v]) => [ir, v ? 99 : 0])) } : orom0;
    let hajlas = MK.hajlas !== undefined ? MK.hajlas : hj && ferde >= 4 ? hj : undefined; const kiall = MK.kiallas ?? kiallas;
    // lapostetős szárnyak a homlokzatok tetősziluettjéből (a legfelső szint körvonalának sávjai, modellkoordinátában)
    // (csak ha a metszet rétegrendjei közt lapostető is van – a homlokzaton a lejjebb fekvő nyeregtetős szárny gerince
    // is vízszintes plató)
    const vanLaposRr = (me?.blokkok ?? []).some((b) => b.becsles.kovetelmenyKod === 'lapostető' && !b.becsles.kihagy);
    // (lapostetős rétegrendnél, ha legalább két homlokzati nézet tetősziluettjén sehol sem látszik a hajlás – se kontylap,
    // se oromzat, se tetősík –, a metszet ferde vonalai mást – lépcsőt, rámpát, féltetőt – mutatnak: nincs magastető)
    if (hajlas && MK.hajlas === undefined && vanLaposRr && S.homlokzatLapok.length) {
      const sz = sziluettTar(S.homlokzatLapok.map(({ l }) => l.lap), [hajlas], M0);
      if (sz.length >= 2 && !magastetoLatszik(sz, hajlas)) hajlas = undefined;
    }
    // (kézzel: oldalanként a sáv szélessége – a felismert sávot azon az oldalon felülírja)
    const fel = be.slice().sort((p, q) => Math.max(...q.szintek.map((x) => x.z0)) - Math.max(...p.szintek.map((x) => x.z0)))[0];
    const felPol = fel ? (fel.tomegPol ?? fel.burokPol ?? []).slice().sort((p, q) => q.length - p.length)[0] : undefined;
    const fa = fel?.a as AlaprajzFeldolgozas | undefined;
    type Sav = TetoSav;
    let lapos: Sav[] = [];
    if (hajlas && vanLaposRr && fel && fa?.e.mPerPt && felPol && S.homlokzatLapok.length) {
      const sz = sziluettTar(S.homlokzatLapok.map(({ l }) => l.lap), [hajlas], M0);
      let v: Sav[] = []; try { v = laposTetoSavok(sz, felPol, fa.e.mPerPt, eszakSz, [hajlas], fa.nyilasok); } catch { v = []; }
      const mx = (v0: number) => fel.m(v0, 0)[0], my = (v0: number) => fel.m(0, v0)[1];
      lapos = v.map((q) => {
        const [a0, b0] = q.tengely === 'x' ? [mx(q.a), mx(q.b)] : [my(q.a), my(q.b)];
        const f = q.felteto, [c0, c1] = f ? (q.tengely === 'x' ? [my(f.c0), my(f.c1)] : [mx(f.c0), mx(f.c1)]) : [0, 0];
        return { tengely: q.tengely, a: Math.min(a0, b0), b: Math.max(a0, b0), ...(f ? { felteto: { ...f, c0: Math.min(c0, c1), c1: Math.max(c0, c1) } } : {}),
          ...(q.foTeto !== undefined ? { foTeto: q.tengely === 'x' ? mx(q.foTeto) : my(q.foTeto) } : {}) };
      });
    }
    if (hajlas && fel && felPol) {
      // (az oldalhoz érő sáv kifelé 2 m-rel túlnyúlik: a födém körvonala a hőburokénál kijjebb lehet)
      const P = felPol.map(([x, y]) => fel.m(x, y)), xs = P.map((q) => q[0]), ys = P.map((q) => q[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const oldal = (q: Sav) => (q.tengely === 'x' ? (Math.abs(q.a - x0) <= 0.6 ? 270 : Math.abs(q.b - x1) <= 0.6 ? 90 : -1) : Math.abs(q.a - y0) <= 0.6 ? 0 : Math.abs(q.b - y1) <= 0.6 ? 180 : -1);
      if (MK.lapos) lapos = lapos.filter((q) => MK.lapos![oldal(q)] === undefined);
      lapos = lapos.map((q) => {
        const o = oldal(q), f = q.felteto;
        // (a féltető-tartomány is: ha a körvonal szélénél ér véget, azon túl)
        const [m0, m1] = q.tengely === 'x' ? [y0, y1] : [x0, x1];
        const f2 = f ? { ...f, c0: Math.abs(f.c0 - m0) <= 0.6 ? f.c0 - 2 : f.c0, c1: Math.abs(f.c1 - m1) <= 0.6 ? f.c1 + 2 : f.c1 } : undefined;
        const q2 = f2 ? { ...q, felteto: f2 } : q;
        return o === 270 || o === 0 ? { ...q2, a: q.a - 2 } : o === 90 || o === 180 ? { ...q2, b: q.b + 2 } : q2;
      });
    }
    const laposOldal = MK.lapos && Object.values(MK.lapos).some((w) => w > 0) ? MK.lapos : undefined;
    // az eresz és a gerinc a szintjelekből (metszet, homlokzat) – a párosítás a magastető építésekor, a födém külső
    // körvonalával (kézi kiállásnál nem)
    const szintJelek = hajlas && MK.kiallas === undefined ? szintJelekLapokrol(S.lapok.filter((l) => l.szerep === 'metszet' || l.szerep === 'homlokzat').map((l) => ({ lap: l.lap, homlokzat: l.szerep === 'homlokzat' }))) : [];
    const felul = hajlas ? tetoFelulAdat(eszakSz) : null;
    const teto = hajlas ? { hajlas, orom: oromK, ...(felul ? { felul: felul.sz } : {}), ...(MK.kiallasOldal && Object.keys(MK.kiallasOldal).length ? { kiallasOldal: MK.kiallasOldal } : {}), ...(kiall ? { kiallas: kiall } : {}), ...(MK.kiallas !== undefined ? { kiallasKezi: true } : {}), ...(szintJelek.length ? { szintJelek } : {}), ...(lapos.length ? { lapos } : {}), ...(laposOldal ? { laposOldal } : {}), ...(MK.felteto ? { feltetoOldal: MK.felteto } : {}) } : undefined;
    // a metszet külsőfal-rétegrendjei (a fal hőszigetelése, ha az alaprajzon nem falként rajzolt)
    const kulsoFalRetegrend = (me?.blokkok ?? []).filter((b) => b.becsles.szerep === 'fal' && !b.becsles.kihagy).map((b) => ({ kod: b.rr.kod,
      retegek: b.retegek.filter((r) => !r.kimarad && r.dCm > 0).map((r) => ({ leiras: r.forras, vastag: r.dCm / 100, szigeteles: /hőszigetel/i.test(anyag(r.anyagId)?.kategoria ?? '') || /hőszigetel|\beps\b|\bxps\b|kőzetgyapot|üveggyapot/i.test(r.forras) })) }))
      .filter((x) => x.retegek.length >= 2);
    // attika a metszetek geometriájából (lapostetőnél; a legtöbb jelöltet adó metszet)
    const attika = S.lapok.flatMap((l) => (l.szerep === 'metszet' ? [attikaGeometria(l.lap)] : [])).filter((x): x is NonNullable<typeof x> => !!x).sort((p, q) => q.db - p.db)[0] ?? null;
    const md = epuletModell(be, { fodemSavok: fodemSav, metszetElemek: mE.flatMap(({ li, e }) => e.kisElemek.map((q) => ({ ...q, lap: li }))), ...(teto ? { teto } : {}), ...(attika ? { attika } : {}), ...(kulsoFalRetegrend.length ? { kulsoFalRetegrend } : {}) });
    const rr = modellRetegrendek();
    // a falak (jelmagyarázat szerinti) katalógusanyagai
    const anyagok: Record<string, NonNullable<ModellReteg['anyag']>> = {};
    for (const f of md.falak) for (const id of [f.anyag?.anyagId, ...(f.retegek ?? []).map((x) => x.anyagId)]) {
      const a = id && !anyagok[id] ? anyag(id) : undefined;
      if (a) anyagok[a.id] = { id: a.id, nev: a.nev, kategoria: a.kategoria, sraffozas: a.sraffozas, ...(a.lambda !== undefined ? { lambda: a.lambda } : {}), ...(a.mu !== undefined ? { mu: a.mu } : {}), ...(a.R ? { R: a.R } : {}) };
    }
    return { ...md, ...(rr.length ? { retegrendek: rr } : {}), ...(Object.keys(anyagok).length ? { anyagok } : {}) };
  };
  return { reszKizar, masSzintKizar, kjVeg, lapSzintek, kimarad, eszakHomSajat, eszakHom, eszakFelismert, eszakLap, mert3d, homMag3d, elMagFv, oromok, homMagModell, szobaMagassag, epuletModell: epuletModellApp };
}
