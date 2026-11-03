import { useEffect, useMemo, useState } from 'preact/hooks';
import { ujId as ujIdT, type Projekt, type HelyisegKategoria } from '../modell';
const sz2 = (x: number) => x.toLocaleString('hu-HU', { maximumFractionDigits: 1 });
import { Szam, Valaszto, sz, MindJelolo } from '../ui';
import { kategoriaJavaslat } from './Helyisegek';
import { anyag } from '../katalogus';
import { pecsetKinyer, type PecsetAdat } from '../terv/pecset';
import { HomlokzatEllenorzes } from './TervHomlokzat';
import type { SzurkeKep } from '../terv/autohelyiseg';
import { eltolas, fedettArany } from '../terv/fedes';
import { burokAuto, burokFalak, burokMeres, nyilasEl, bennE, type Poligon } from '../terv/burok';
import type { TervNyilas } from '../terv/nyilaszarok';
import { pdfLapok, alaprajzFeldolgoz, metszetFeldolgoz, eszakJavitas, eszakJavitasMent, type TervLap, type AlaprajzFeldolgozas } from '../terv/elemzes';
import { egtaj, jegyzekenKivul, szintekCimbol, szintNev } from '../terv/alaprajz';
import { tervAtvesz, type AtvettNyilas, type AtvettHelyiseg } from '../terv/atvetel';
import { MintaLakasok } from './MintaLakasok';
import { Burok3D, type Burok3DSzint } from './Burok3D';
import { homlokzatRajzok, mertMagassagok, eszakHomlokzatbol, tetoAblakokHomlokzatrol, oromSzelessegek, type HomlokzatRajz, type MertMagassag } from '../terv/homlokzatIllesztes';
import type { Lap } from '../terv/kinyeres';

type Modosit = (f: (q: Projekt) => void) => void;

const KATEGORIAK: { ertek: HelyisegKategoria; nev: string }[] = [
  { ertek: 'kondicionalt', nev: 'Fűtött' },
  { ertek: 'erosen_kapcsolt', nev: 'Fűtetlen, lakótéren belüli' },
  { ertek: 'gyengen_kapcsolt', nev: 'Fűtetlen tér (b tényezővel)' },
];
const FAJTA_NEV = { ablak: 'Ablak', erkelyajto: 'Erkélyajtó', bejarati_ajto: 'Bejárati ajtó', bejarati_uvegajto: 'Bejárati ajtó (üvegezett)', garazskapu: 'Garázskapu', belso_ajto: 'Belső ajtó', falfulke: 'Falfülke (nem nyílászáró)', fuggonyfal: 'Függönyfal, üvegfal' } as const;
const IRANY_SZIN: Record<number, string> = { 0: '#C2410C', 90: '#2E6DB4', 180: '#15803D', 270: '#A21CAF' };
const IRANY_NEV: Record<number, string> = { 0: 'lapon fent', 90: 'lapon jobbra', 180: 'lapon lent', 270: 'lapon balra' };
const norm = (d: number) => ((Math.round(d * 10) / 10) % 360 + 360) % 360;

/** Egy alaprajz kijelölései: átvett egységek, kizárt helyiségek, besorolás-felülírás, kizárt nyílások. */
interface Kijeloles { egysegek: Set<string>; kizartH: Set<number>; kat: Record<number, HelyisegKategoria>; kizartNy: Set<number>; mindFutott?: boolean;
  /** Ismeretlen túloldalú falszakaszok, amelyeket a felhasználó külső falnak jelölt („raszterindex|szakaszindex”). */
  ismKulso?: Set<string>;
  /** A felhasználó által szerkesztett hőburok-körvonal (pt): ha megadott, a homlokzati falak és a külső nyílászárók ebből. */
  burok?: Poligon[] }

/** A kijelölt fűtött (nem gyengén kapcsolt) helyiségek raszterindexei. */
function futottRiK(al: AlaprajzFeldolgozas, k: Kijeloles): Set<number> {
  const hs = al.e.helyisegek;
  const egysegben = (i: number) => !al.e.egysegek.length || !hs[i]!.egyseg || k.egysegek.has(hs[i]!.egyseg!);
  const ki = new Set<number>();
  hs.forEach((h, i) => {
    if (!egysegben(i) || h.kulter || k.kizartH.has(i)) return;
    if ((k.kat[i] ?? (k.mindFutott ? 'kondicionalt' : kategoriaJavaslat(h.nev) ?? 'kondicionalt')) === 'gyengen_kapcsolt') return;
    const x = al.magHelyisegek.indexOf(h); if (x >= 0) ki.add(x);
  });
  return ki;
}
/** A raszterhelyiségek pecsétpontjai (pt). */
const pecsetPontok = (al: AlaprajzFeldolgozas) => new Map(al.magHelyisegek.map((h, i) => [i, { x: h.x, y: h.y }] as [number, { x: number; y: number }]));

/** Alapértelmezett kijelölés a felismerésből (minden egység; a csak jegyzékben szereplő sorok nélkül). */
function alapKijeloles(al: AlaprajzFeldolgozas): Kijeloles {
  const vanPecset = al.e.helyisegek.some((h) => h.forras === 'pecset');
  const kizartH = new Set(al.auto ? al.e.helyisegek.map((h, i) => (al.e.egysegek.length && h.egyseg ? -1 : i)).filter((i) => i >= 0) : vanPecset ? al.e.helyisegek.map((h, i) => (h.forras === 'jegyzek' ? i : -1)).filter((i) => i >= 0) : []);
  // a helyiségjegyzékből hiányzó, kód nélküli pecsét (pl. kívül álló tároló, hulladéktároló), ha a pecsétek nagy része (≥ 70 %) a jegyzékben szerepel
  for (const i of jegyzekenKivul(al.e.helyisegek)) kizartH.add(i);
  return { egysegek: new Set(al.e.egysegek), kizartH, kat: {}, kizartNy: new Set() };
}

/** A külső nyílászárók: szerkesztett hőburoknál a körvonal közelében (≤ 1,3 m) lévők, az él irányával. */
function burokNyilasok(al: AlaprajzFeldolgozas, k: Kijeloles) {
  const l = al.nyilasok.map((n, kk) => ({ n, kk }));
  if (!al.r) return l.filter(({ n }) => n.kulso && n.helyiseg !== null && n.irany !== null);
  if (!k.burok) {
    // felismert burok: a raszter szerinti külső nyílások, és a falhoz nem rendelt, a burkon kívül 1,5 m-en belül írt feliratok
    const fut0 = futottRiK(al, k), ab = burokAutoTar(al.r, fut0), pp0 = pecsetPontok(al), r0 = al.r;
    const alap = l.filter(({ n }) => n.kulso && n.helyiseg !== null && n.irany !== null);
    if (!ab.length) return alap;
    const koz = (x: number, y: number) => [...pp0.entries()].filter(([ri, q]) => fut0.has(ri) && ab.some((p) => bennE(p, q.x, q.y))).sort((u, v) => Math.hypot(u[1].x - x, u[1].y - y) - Math.hypot(v[1].x - x, v[1].y - y))[0]?.[0] ?? null;
    return alap.concat((al.arvaFeliratok ?? []).flatMap((f, j) => {
      if (ab.some((p) => bennE(p, f.x, f.y))) return [];
      const ir = nyilasEl(r0, ab, f.x, f.y, 1.5); if (ir === null) return [];
      const h = koz(f.x, f.y); if (h === null) return [];
      const ajto = (f.pm === null || f.pm <= 0.05) && f.mag >= 2;
      return [{ n: { szel: f.szel, mag: f.mag, pm: f.pm, x: f.x, y: f.y, helyiseg: h, irany: ir, kulso: true, fajta: (ajto ? 'erkelyajto' : 'ablak') as TervNyilas['fajta'] }, kk: 10000 + j }];
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
    if (!kint && !n.kulso) return [];
    const ir = nyilasEl(r, b, n.x, n.y, kint ? 2.5 : 1.5); if (ir === null) return [];
    const h = n.helyiseg !== null && fut.has(n.helyiseg) ? n.helyiseg : kozeli(n.x, n.y); if (h === null) return [];
    return [{ n: { ...n, irany: ir, kulso: true, helyiseg: h }, kk }];
  }).concat((al.arvaFeliratok ?? []).flatMap((f, j) => {
    // falhoz nem rendelt felirat a burok mentén: nyílászáróként (mellvéd nélkül, legalább 2 m magas: erkélyajtó)
    if (b.some((p) => bennE(p, f.x, f.y))) return [];
    const ir = nyilasEl(r, b, f.x, f.y, 2.5); if (ir === null) return [];
    const h = kozeli(f.x, f.y); if (h === null) return [];
    const ajto = (f.pm === null || f.pm <= 0.05) && f.mag >= 2;
    return [{ n: { szel: f.szel, mag: f.mag, pm: f.pm, x: f.x, y: f.y, helyiseg: h, irany: ir, kulso: true, fajta: (ajto ? 'erkelyajto' : 'ablak') as TervNyilas['fajta'] }, kk: 10000 + j }];
  }));
}

/** A homlokzati rajzokból becsült északirány alaprajzonként gyorstárazva. */
const eszakHomGy = new WeakMap<object, number | null>();
/** Homlokzati rajzok (keretekkel) lapcsoportonként gyorstárazva. */
const homlokzatGy = new WeakMap<object, Map<number, HomlokzatRajz[]>>();
/** `M`: tartalék lépték (az alaprajzé), ha a homlokzati lapon nincs, vagy hibás a léptékfelirat. */
function homlokzatRajzTar(lapok: Lap[], M?: number | null): HomlokzatRajz[] {
  return lapok.flatMap((l) => {
    let m = homlokzatGy.get(l); if (!m) { m = new Map(); homlokzatGy.set(l, m); }
    const k = M ?? 0; let v = m.get(k);
    if (!v) { try { v = homlokzatRajzok(l, M ?? undefined); } catch { v = []; } m.set(k, v); }
    return v;
  });
}

/** Automatikus hőburok rasztertől és fűtött halmaztól függően gyorstárazva. */
const burokAutoGy = new WeakMap<object, Map<string, Poligon[]>>();
function burokAutoTar(r: NonNullable<AlaprajzFeldolgozas['r']>, fut: Set<number>): Poligon[] {
  let m = burokAutoGy.get(r); if (!m) { m = new Map(); burokAutoGy.set(r, m); }
  const kulcs = [...fut].sort((a, b) => a - b).join(',');
  let v = m.get(kulcs); if (!v) { v = burokAuto(r, fut); m.set(kulcs, v); }
  return v;
}

/** Automatikus hőburok lapokra gyorstárazva (a 3D ábrához). */
const burok3dTar = new Map<string, Poligon[]>();
function burok3dCache(i: number, r: NonNullable<AlaprajzFeldolgozas['r']>, fut: Set<number>): Poligon[] {
  const kulcs = `${i}|${r.w}x${r.h}|${[...fut].sort((a, b) => a - b).join(',')}`;
  let v = burok3dTar.get(kulcs); if (!v) { v = burokAuto(r, fut); burok3dTar.set(kulcs, v); }
  return v;
}
/** A burok menti nyílászárók a megadott körvonalhoz (pt). */
function burokNyilasokPt(al: AlaprajzFeldolgozas, k: Kijeloles, b: Poligon[]) {
  if (!b.length) return [];
  return burokNyilasok(al, { ...k, burok: b }).map(({ n }) => n);
}

/** Egy alaprajz átvehető helyiségei (külső falakkal) és nyílászárói a kijelölés szerint. */
function atvetelReszek(al: AlaprajzFeldolgozas, k: Kijeloles, mert?: Map<TervNyilas, MertMagassag>): { helyisegek: AtvettHelyiseg[]; nyilasok: AtvettNyilas[]; ri: number[] } {
  const hs = al.e.helyisegek;
  const egysegben = (i: number) => !al.e.egysegek.length || !hs[i]!.egyseg || k.egysegek.has(hs[i]!.egyseg!);
  const valasztott = hs.map((h, i) => egysegben(i) && !h.kulter && !k.kizartH.has(i));
  const kategoria = (i: number): HelyisegKategoria => k.kat[i] ?? (k.mindFutott ? 'kondicionalt' : kategoriaJavaslat(hs[i]!.nev) ?? 'kondicionalt');
  const ri = (i: number) => al.magHelyisegek.indexOf(hs[i]!);
  const bf = k.burok && al.r ? burokFalak(al.r, k.burok, futottRiK(al, k), pecsetPontok(al)) : null;
  const falak = (i: number) => { const x = ri(i); if (bf) return x < 0 ? [] : (bf.get(x) ?? []).filter((f) => f.hossz >= 0.3); return !al.r || x < 0 ? [] : al.r.helyisegek[x]!.szakaszok.filter((s, j) => ((s.tul === 'kulso' && !s.szomszed) || (s.tul === 'ismeretlen' && !!k.ismKulso?.has(`${x}|${j}`))) && s.hossz >= 0.3); };
  const kiv = hs.map((h, i) => ({ h, i })).filter(({ i }) => valasztott[i]);
  const index = new Map(kiv.map(({ i }, j) => [i, j]));
  const helyisegek = kiv.map(({ h, i }) => ({
    kod: h.kod, nev: h.nev, burkolat: h.burkolat, A: h.A, kategoria: kategoria(i), egyseg: h.egyseg ? (al.e.egysegInfo[h.egyseg]?.nev ?? h.egyseg) : undefined, falak: falak(i).map((f) => ({ irany: f.irany, hossz: f.hossz, ...("talaj" in f && f.talaj ? { talaj: true } : {}) })),
    // fal fűtetlen (gyengén kapcsolt) helyiség felé, pl. garázs
    futetlenFalak: (() => { const x = ri(i); if (!al.r || x < 0) return []; return al.r.helyisegek[x]!.szakaszok.filter((s) => typeof s.tul === 'number' && s.hossz >= 0.3).flatMap((s) => {
      const mi = hs.indexOf(al.magHelyisegek[s.tul as number]!); return mi >= 0 && valasztott[mi] && kategoria(mi) === 'gyengen_kapcsolt' && kategoria(i) !== 'gyengen_kapcsolt' ? [{ hossz: s.hossz, fele: hs[mi]!.nev }] : []; }); })(),
  }));
  const nyilasok = burokNyilasok(al, k)
    .map(({ n, kk }) => ({ n, kk, hi: hs.indexOf(al.magHelyisegek[n.helyiseg!]!) }))
    .filter(({ hi, kk }) => hi >= 0 && valasztott[hi] && !k.kizartNy.has(kk))
    .map(({ n, hi }): AtvettNyilas => {
      // méretfelirat nélküli nyílás: a magasság a homlokzatról (vagy becsült); padlóig érő → erkélyajtó
      const m = n.mert ? mert?.get(n) ?? { mag: n.szel >= 1.6 ? 2.4 : 1.5 } : null;
      if (m) return { fajta: m.mag >= 2 ? 'erkelyajto' : 'ablak', szel: n.szel, mag: m.mag, pm: m.mag >= 2 ? 0 : 0.9, helyiseg: index.get(hi)!, irany: n.irany! };
      return { fajta: n.fajta as AtvettNyilas['fajta'], szel: n.szel, mag: n.mag, pm: n.pm, helyiseg: index.get(hi)!, irany: n.irany! };
    });
  return { helyisegek, nyilasok, ri: kiv.map(({ i }) => ri(i)) };
}

/** A beolvasott, de még át nem vett alaprajz-lapok száma (a lépés elhagyásakor figyelmeztetéshez). */
export const tervbolFuggo = { lapok: 0 };

export function TervbolLepes({ p, modosit, ugrik }: { p: Projekt; modosit: Modosit; ugrik: (n: 'helyisegek' | 'hatarolas' | 'retegrendek') => void }) {
  const [lapok, setLapok] = useState<TervLap[]>([]);
  const [folyamat, setFolyamat] = useState<string | null>(null);
  const [hiba, setHiba] = useState<string | null>(null);
  const [aIdx, setAIdx] = useState(-1);
  const [mIdx, setMIdx] = useState(-1);
  const [meretarany, setMeretarany] = useState<number | undefined>(undefined);
  // északjel: alapból egy közös érték minden laphoz (ha egyszer beállítottad), laponként külön is felülírható
  const [eszakKozos, setEszakKozos] = useState<number | null>(null);
  const [eszakKulon, setEszakKulon] = useState<Record<number, number>>({});
  // laponként megjegyzett kijelölések (egységek, helyiségek, besorolás, nyílások) – lapozáskor és átvételkor is ezek érvényesek
  const [kijelolesek, setKijelolesek] = useState<Record<number, Kijeloles>>({});
  // „minden fűtött” kapcsoló: az összes lap minden helyisége fűtött (a kézi besorolás felülírja)
  const [mindFutott, setMindFutott] = useState(false);
  // számított épületrész (bővítés, épületrész-tanúsítvány): csak az itt megadott kódkezdetű helyiségek kerülnek át,
  // a többi (pl. a meglévő épület) fűtött szomszédként viselkedik – a közös fal nem hőátadó felület
  const [reszKod, setReszKod] = useState('');
  const reszElotagok = reszKod.split(/[,;\s]+/).map((x) => x.trim().toLowerCase().replace(/[^a-z0-9]/g, '')).filter(Boolean);
  const reszKizar = (a: AlaprajzFeldolgozas): number[] => !reszElotagok.length ? [] : a.e.helyisegek.map((h, i) => {
    const k = (h.kod ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return h.kulter || reszElotagok.some((e) => k.startsWith(e)) ? -1 : i;
  }).filter((i) => i >= 0);
  const kjVeg = (i: number, a: AlaprajzFeldolgozas): Kijeloles => {
    const k = kijelolesek[i] ?? alapKijeloles(a); const rk = reszKizar(a);
    return { ...k, kizartH: rk.length ? new Set([...k.kizartH, ...rk]) : k.kizartH, mindFutott };
  };
  const [rrKi, setRrKi] = useState<Record<string, boolean>>({});
  const [bm, setBm] = useState<number | undefined>(undefined);
  const [szintszam, setSzintszam] = useState<number | undefined>(undefined);
  const [csere, setCsere] = useState(true);
  const [kesz, setKesz] = useState<string[] | null>(null);
  const [nagyit, setNagyit] = useState(true);
  const [pecsetBe, setPecsetBe] = useState(true);
  const [padloAt, setPadloAt] = useState(true);
  const [tetoAt, setTetoAt] = useState(true);
  const [mintaFajta, setMintaFajta] = useState<'panel' | 'blokkos' | null>(null);
  /** Lapindex → az alaprajz által ábrázolt szintek (alapból a lap címéből). */
  const [szintKi, setSzintKi] = useState<Record<number, string[]>>({});
  const [atvett, setAtvett] = useState<Set<number>>(new Set());
  /** Lapindex → a háttérben elkészült alaprajz-feldolgozás (vagy hibaüzenet). */
  const [elemzesek, setElemzesek] = useState<Record<number, AlaprajzFeldolgozas | string>>({});
  /** Lapindex → kimarad-e az „Összes átvétele” műveletből (alapból a pince kimarad). */
  const [kihagyLap, setKihagyLap] = useState<Record<number, boolean>>({});
  const [osszesFut, setOsszesFut] = useState(false);
  /** PDF-betöltés haladása (0–1) és felirata. */
  const [halad, setHalad] = useState<{ arany: number; szoveg: string } | null>(null);

  async function betolt(fajlok: FileList | File[] | null, alaprajzOldal?: number, szurkeFelulir?: SzurkeKep) {
    if (!fajlok?.length) return;
    setHiba(null); setKesz(null);
    const uj: TervLap[] = [];
    try {
      const fl = Array.from(fajlok);
      for (const [fi, f] of fl.entries()) {
        if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { setHiba(`${f.name}: csak PDF tervlap olvasható be.`); continue; }
        setFolyamat(`${f.name} beolvasása…`);
        const ll = await pdfLapok(f, 2000, (k, o) => setHalad({ arany: (fi + (o ? k / o : 0)) / fl.length, szoveg: `${fi + 1}. / ${fl.length} fájl beolvasása: ${f.name}${o > 1 ? ` (${k}/${o}. oldal)` : ''}` }));
        // beépített mintalap: a színezés a pdf.js-ben színátmenetként jelenik meg – az előre elkészített, egyszínű árnyalatkép
        if (szurkeFelulir && alaprajzOldal !== undefined) for (const l of ll) if (l.oldal === alaprajzOldal) l.szurke = szurkeFelulir;
        uj.push(...ll);
      }
    } catch (e) { setHiba(`A PDF nem olvasható: ${(e as Error).message}`); }
    setFolyamat(null); setHalad(null);
    if (!uj.length) return;
    const osszes = [...lapok, ...uj];
    setLapok(osszes);
    if (alaprajzOldal !== undefined) { const i = osszes.findIndex((l, k) => k >= lapok.length && l.oldal === alaprajzOldal); if (i >= 0) setAIdx(i); }
    else if (aIdx < 0) { const nemPince = osszes.findIndex((l) => l.szerep === 'alaprajz' && !szintekCimbol(l.cim).includes('P')); setAIdx(nemPince >= 0 ? nemPince : osszes.findIndex((l) => l.szerep === 'alaprajz')); }
    if (mIdx < 0) setMIdx(osszes.findIndex((l) => l.szerep === 'metszet'));
  }

  /** Beépített típusalaprajz-mintalap (panel / blokkos): előre feldolgozott lakásadatok, kattintásos lakásválasztás. */
  function mintalap(fajta: 'panel' | 'blokkos') {
    setLapok([]); setAIdx(-1); setMIdx(-1); setKesz(null); setHiba(null); setMintaFajta(fajta); setElemzesek({}); setKijelolesek({}); setAtvett(new Set()); setEszakKozos(null); setEszakKulon({});
  }

  const aLap = aIdx >= 0 ? lapok[aIdx] : undefined;
  const lapSzintek = (i: number) => szintKi[i] ?? szintekCimbol(lapok[i]?.cim ?? '');
  const alaprajzLapok = lapok.map((l, i) => ({ l, i })).filter(({ l }) => l.szerep === 'alaprajz');
  const homlokzatLapok = useMemo(() => lapok.map((l, i) => ({ l, i })).filter(({ l }) => l.szerep === 'homlokzat'), [lapok]);
  /** Kimarad-e a lap az „Összes átvétele” műveletből (alapból a pince). */
  /** A pinceszint alapból kimarad – kivéve, ha van fűtött helyisége (pl. pincei lépcsőház, előtér, gépészet). */
  const kimarad = (i: number) => {
    if (kihagyLap[i] !== undefined) return kihagyLap[i]!;
    if (!lapSzintek(i).includes('P')) return false;
    const a = elemzesek[i];
    return !(typeof a === 'object' && atvetelReszek(a, kjVeg(i, a)).helyisegek.some((h) => h.kategoria !== 'gyengen_kapcsolt'));
  };
  // át nem vett, átvételre jelölt alaprajzok: a lépés elhagyása / az oldal bezárása előtt figyelmeztetünk
  tervbolFuggo.lapok = alaprajzLapok.filter(({ i }) => !atvett.has(i) && !kimarad(i)).length;
  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => { if (tervbolFuggo.lapok > 0) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', f);
    return () => { window.removeEventListener('beforeunload', f); tervbolFuggo.lapok = 0; };
  }, []);
  const SZINT_SOR = ['P', 'F', '1', '2', '3', '4', '5', 'T'];
  // a fűtött szintek (a pince nélkül) közül a legalsót ábrázoló lapnál padló, a legfelsőnél padlásfödém / tető
  useEffect(() => {
    if (aIdx < 0) return;
    const futott = [...new Set(alaprajzLapok.flatMap(({ i }) => lapSzintek(i)).filter((x) => x !== 'P'))].sort((a, b) => SZINT_SOR.indexOf(a) - SZINT_SOR.indexOf(b));
    const sajat = lapSzintek(aIdx);
    if (!futott.length || !sajat.length) return;
    setPadloAt(sajat.includes(futott[0]!)); setTetoAt(sajat.includes(futott.at(-1)!));
  }, [aIdx, lapok.length, JSON.stringify(szintKi)]);
  const mLap = mIdx >= 0 ? lapok[mIdx] : undefined;
  // háttérfeldolgozás: a feltöltött alaprajzok egymás után (a felület két lap között frissül)
  useEffect(() => {
    const kov = lapok.findIndex((l, i) => l.szerep === 'alaprajz' && elemzesek[i] === undefined);
    if (kov < 0) return;
    const t = window.setTimeout(() => {
      let ered: AlaprajzFeldolgozas | string;
      try { ered = alaprajzFeldolgoz(lapok[kov]!.lap, undefined, lapok[kov]!.szurke, lapok[kov]!.tinta); } catch (e) { ered = (e as Error).message; }
      setElemzesek((x) => ({ ...x, [kov]: ered }));
    }, 40);
    return () => window.clearTimeout(t);
  }, [lapok, elemzesek]);
  const keszElemzes = aIdx >= 0 && typeof elemzesek[aIdx] === 'object' ? elemzesek[aIdx] as AlaprajzFeldolgozas : null;
  const kezi = useMemo(() => (aLap && meretarany ? alaprajzFeldolgoz(aLap.lap, meretarany, aLap.szurke, aLap.tinta) : null), [aLap, meretarany]);
  const al = kezi ?? keszElemzes;
  // kézi méretarány: új felismerés – a lap kijelölése újraindul
  useEffect(() => { if (kezi) setKijelolesek((m) => { const u = { ...m }; delete u[aIdx]; return u; }); }, [kezi]);
  const kijeloles = (i: number, a: AlaprajzFeldolgozas): Kijeloles => kjVeg(i, a);
  const kj: Kijeloles = al ? kijeloles(aIdx, al) : { egysegek: new Set(), kizartH: new Set(), kat: {}, kizartNy: new Set() };
  const { egysegek, kizartH, kat, kizartNy } = kj;
  const kjMod = (fn: (k: Kijeloles) => Kijeloles) => { if (!al) return; const a = al, i = aIdx; setKijelolesek((m) => ({ ...m, [i]: fn(m[i] ?? alapKijeloles(a)) })); };
  const setEgysegek = (v: Set<string>) => kjMod((k) => ({ ...k, egysegek: v }));
  const setKizartH = (v: Set<number> | ((e: Set<number>) => Set<number>)) => kjMod((k) => ({ ...k, kizartH: typeof v === 'function' ? v(k.kizartH) : v }));
  const setKat = (v: Record<number, HelyisegKategoria>) => kjMod((k) => ({ ...k, kat: v }));
  const setKizartNy = (v: Set<number>) => kjMod((k) => ({ ...k, kizartNy: v }));
  // lapozás az alaprajzok között (‹ › gomb, ←/→ billentyű)
  const lapoz = (d: number) => {
    const l = alaprajzLapok.map(({ i }) => i); if (!l.length) return;
    const j = l.indexOf(aIdx); const uj = l[((j < 0 ? 0 : j + d) + l.length) % l.length]!;
    setAIdx(uj); setMeretarany(undefined);
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'ArrowRight') { lapoz(1); e.preventDefault(); } else if (e.key === 'ArrowLeft') { lapoz(-1); e.preventDefault(); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });
  const me = useMemo(() => (mLap ? metszetFeldolgoz(mLap.lap) : null), [mLap]);
  /** A terepszint alatti (pince) padló mélysége a metszet szintjeleiből: terepszint (vagy ±0,00) − legalsó padlószint. */
  const pinceMelyseg = (() => {
    const sz = me?.szintek; if (!sz) return undefined;
    const lista = sz.padlo.length ? sz.padlo : sz.szintek; if (!lista.length) return undefined;
    const also = Math.min(...lista), t = sz.terepszint ?? 0;
    return also < t - 1 ? Math.round((t - also) * 100) / 100 : undefined;
  })();
  const pecset = useMemo<PecsetAdat | null>(() => { const l = aLap ?? mLap; if (!l) return null; const d = pecsetKinyer(l.lap.szovegek); return Object.keys(d).length ? d : null; }, [aLap, mLap]);

  // alapértékek a felismerésből
  useEffect(() => {
    if (!al) return;
    // ha van helyiségpecsét, a csak a jegyzékben szereplő sorok (párjuk nincs a rajzon) alapból nem kerülnek át;
    // típusalaprajznál a lakáshoz nem tartozó terek (lépcsőház, folyosó, akna) kimaradnak
  }, [al]);
  useEffect(() => {
    if (!me) return;
    setRrKi(Object.fromEntries(me.blokkok.map((b) => [b.rr.kod, !!b.becsles.szerep && !b.becsles.kihagy])));
    setBm(me.szintek.belmagassag[0]); setSzintszam(me.szintek.szintszam);
  }, [me]);

  const helyisegek = al?.e.helyisegek ?? [];
  const raszterIdx = (i: number) => (al ? al.magHelyisegek.indexOf(helyisegek[i]!) : -1);
  const egysegben = (i: number) => !al?.e.egysegek.length || !helyisegek[i]!.egyseg || egysegek.has(helyisegek[i]!.egyseg!);
  const valasztott = helyisegek.map((h, i) => egysegben(i) && !h.kulter && !kizartH.has(i));
  const kategoria = (i: number): HelyisegKategoria => kat[i] ?? (mindFutott ? 'kondicionalt' : kategoriaJavaslat(helyisegek[i]!.nev) ?? 'kondicionalt');
  const falak = (i: number) => {
    const ri = raszterIdx(i); if (!al?.r || ri < 0) return [];
    return al.r.helyisegek[ri]!.szakaszok.filter((s, j) => ((s.tul === 'kulso' && !s.szomszed) || (s.tul === 'ismeretlen' && !!kj.ismKulso?.has(`${ri}|${j}`))) && s.hossz >= 0.3);
  };
  // hőburok-körvonal: a felismert (fűtött helyiségek összevonva), vagy a felhasználó által szerkesztett
  const futottKulcs = al ? [...futottRiK(al, kj)].sort((a, b) => a - b).join(',') : '';
  const burokFelismert = useMemo(() => (al?.r ? burokAutoTar(al.r, futottRiK(al, kj)) : []), [al, futottKulcs]);
  const [burokVazlat, setBurokVazlat] = useState<Poligon[] | null>(null);
  const [burokSzerk, setBurokSzerk] = useState(false);
  const [huz, setHuz] = useState<{ p: number; v: number } | null>(null);
  /** Kézi hőburok-rajzolás: a lerakott pontok (pt); null: nincs rajzolás. */
  const [rajzol, setRajzol] = useState<[number, number][] | null>(null);
  const burok = burokVazlat ?? kj.burok ?? burokFelismert;
  // a körvonal élei a valódi falsávhoz illesztve: belső sík, hossz, vastagság (a rajzolt / felismert vonal csak irány)
  const burokMert = useMemo(() => (al?.r && !burokVazlat ? burokMeres(al.r, burok) : []), [al, burok, burokVazlat]);
  const burokMent = (b: Poligon[] | undefined) => kjMod((k) => { const u = { ...k }; if (b) u.burok = b; else delete u.burok; return u; });
  const nyilasok = (al ? burokNyilasok(al, kj) : []).map(({ n, kk }) => ({ n, k: kk }))
    .map(({ n, k }) => ({ n, k, hi: helyisegek.indexOf(al!.magHelyisegek[n.helyiseg!]!) }))
    .filter(({ hi }) => hi >= 0 && valasztott[hi]);
  const belsoAjtok = (al?.nyilasok ?? []).filter((n) => !n.kulso).length;
  // északjel nélküli lap: a homlokzati rajzokból (címbeli égtáj + nyílások helyzete), ha egyértelmű
  const eszakHom = (a: AlaprajzFeldolgozas | null | undefined): number | null => {
    if (!a || a.e.eszak || !a.e.mPerPt || !homlokzatLapok.length) return null;
    if (eszakHomGy.has(a)) return eszakHomGy.get(a)!;
    let v: number | null = null; try { v = eszakHomlokzatbol(a.nyilasok, a.e.mPerPt, homlokzatRajzTar(homlokzatLapok.map(({ l }) => l.lap), a.e.meretarany)); } catch { v = null; }
    eszakHomGy.set(a, v); return v;
  };
  const eszakFelismert = (a: AlaprajzFeldolgozas | null | undefined) => (a?.e.eszak ? norm(a.e.eszak.szog + eszakJavitas(a.e.eszak.alairas)) : eszakHom(a) ?? 0);
  const eszakLap = (i: number, a: AlaprajzFeldolgozas | null | undefined) => eszakKulon[i] ?? eszakKozos ?? eszakFelismert(a);
  const eszakSz = eszakLap(aIdx, al);
  const kulonE = aIdx in eszakKulon;
  const setEszak = (v: number) => { if (kulonE) setEszakKulon((x) => ({ ...x, [aIdx]: v })); else setEszakKozos(v); };
  // hőburok-ellenőrzés: ahol a felismerés nem egyértelmű – grafikus jelölés és választási lehetőség
  type Problema = { tipus: 'nyitott' | 'reszleges' | 'ismeretlen' | 'szomszed'; i: number; szoveg: string; pontok?: [number, number][]; kulcsok?: string[]; szomszed?: number; hossz?: number };
  const problemak: Problema[] = [];
  if (al?.r) {
    helyisegek.forEach((h, i) => {
      if (!valasztott[i] || kategoria(i) === 'gyengen_kapcsolt') return;
      const ri = raszterIdx(i); if (ri < 0) return;
      const R = al.r!.helyisegek[ri]!;
      if (R.szivarog) problemak.push({ tipus: 'nyitott', i, szoveg: `${h.nev}: a körvonal nem zárt – a fűtött tér határa bizonytalan` });
      else if (h.A > 3 && R.A < 0.6 * h.A && R.szakaszok.some((sg) => sg.tul === 'kulso')) problemak.push({ tipus: 'reszleges', i, szoveg: `${h.nev}: a rajzból csak ${sz(R.A, 1)} m² ismerhető fel a ${sz(h.A, 1)} m²-ből (pl. lépcső, berendezés tagolja) – a külső falak hiányosak lehetnek` });
      // helyiségenként összevonva: az ismeretlen túloldalú szakaszok együtt, a ki nem jelölt szomszédok szomszédonként
      // csak a hőburok szempontjából érdekes ismeretlen szakasz: a túloldalán 1,5 m-en belül külső tér kezdődik (az épület szélén van)
      const rr = al.r!;
      const kulsoKozel = (sg: (typeof R.szakaszok)[number]) => {
        const [dx, dy] = sg.irany === 0 ? [0, -1] : sg.irany === 90 ? [1, 0] : sg.irany === 180 ? [0, 1] : [-1, 0];
        const minta = sg.pontok.filter((_, q) => q % Math.max(1, Math.floor(sg.pontok.length / 6)) === 0);
        let db = 0;
        for (const [x, y] of minta) {
          for (let t = 0.2; t <= 1.5; t += 0.1) {
            const xi = Math.floor(((x + dx * t / rr.mPerPt) - rr.x0) * rr.mPerPt / rr.px), yi = Math.floor(((y + dy * t / rr.mPerPt) - rr.y0) * rr.mPerPt / rr.px);
            if (xi < 0 || yi < 0 || xi >= rr.w || yi >= rr.h) { db++; break; }
            const c = rr.cimke[yi * rr.w + xi]!;
            if (c === 1) { db++; break; }
            if (c >= 2) break;
          }
        }
        return db >= Math.max(1, minta.length / 2);
      };
      const ism = R.szakaszok.map((sg, j) => ({ sg, j })).filter(({ sg }) => sg.tul === 'ismeretlen' && sg.hossz >= 0.3 && kulsoKozel(sg));
      const ismH = ism.reduce((t, { sg }) => t + sg.hossz, 0);
      if (ismH >= 1) problemak.push({ tipus: 'ismeretlen', i, kulcsok: ism.map(({ j }) => `${ri}|${j}`), pontok: ism.flatMap(({ sg }) => sg.pontok), hossz: ismH, szoveg: `${h.nev}: ${sz(ismH, 2)} m fal, a túloldala nem ismerhető fel (${[...new Set(ism.map(({ sg }) => egtaj(sg.irany, eszakSz)))].join(', ')})` });
      const szomsz = new Map<number, { h: number; p: [number, number][] }>();
      for (const sg of R.szakaszok) {
        if (sg.hossz < 0.3 || typeof sg.tul !== 'number') continue;
        const mi = helyisegek.indexOf(al.magHelyisegek[sg.tul]!);
        if (mi < 0 || valasztott[mi] || helyisegek[mi]!.kulter) continue;
        const x = szomsz.get(mi) ?? { h: 0, p: [] }; x.h += sg.hossz; x.p.push(...sg.pontok); szomsz.set(mi, x);
      }
      for (const [mi, x] of szomsz) if (x.h >= 0.5) problemak.push({ tipus: 'szomszed', i, szomszed: mi, pontok: x.p, hossz: x.h, szoveg: `${h.nev}: ${sz(x.h, 2)} m fal a ki nem jelölt „${helyisegek[mi]!.nev}” felé – fűtött vagy fűtetlen tér?` });
    });
  }
  const setIsmKulso = (kulcsok: string[], be: boolean) => kjMod((k) => { const x = new Set(k.ismKulso ?? []); for (const kk of kulcsok) { if (be) x.add(kk); else x.delete(kk); } return { ...k, ismKulso: x }; });
  const ismBe = (pr: Problema) => !!pr.kulcsok?.length && pr.kulcsok.every((kk) => kj.ismKulso?.has(kk));

  // homlokzatonkénti összesítés
  const iranyok = [0, 90, 180, 270].map((ir) => ({
    ir, t: egtaj(ir, eszakSz),
    hossz: helyisegek.reduce((s, _h, i) => s + (valasztott[i] ? falak(i).filter((f) => f.irany === ir).reduce((q, f) => q + f.hossz, 0) : 0), 0),
    db: nyilasok.filter(({ n, k }) => n.irany === ir && !kizartNy.has(k)).length,
  }));

  /** Közös átvétel: egy alaprajz a megadott kijelöléssel, szintekkel, padló/tető beállítással. */
  /** A homlokzatokon látszó oromzatok szélessége alaprajzi irányonként (0/90/180/270). */
  function oromok(eszak: number, M?: number): Record<number, number> {
    const ki: Record<number, number> = {};
    if (!me?.tetoter) return ki;
    for (const { l } of homlokzatLapok) {
      let lista: { az: number; orom: number }[] = []; try { lista = oromSzelessegek(l.lap, me.tetoter.hajlas, M); } catch { lista = []; }
      for (const x of lista) { const ir = (Math.round(norm(x.az + eszak) / 90) * 90) % 360; ki[ir] = Math.max(ki[ir] ?? 0, x.orom); }
    }
    return ki;
  }
  /** Tetőtéri alaprajz: a falhoz nem rendelt, fűtött helyiségen belül írt ablakméret-feliratok (tetősík ablak). */
  function tetoAblakok(a: AlaprajzFeldolgozas, hs: ReturnType<typeof atvetelReszek>['helyisegek'], k: Kijeloles, eszak: number) {
    const r = a.r; if (!r) return [];
    const { ri } = atvetelReszek(a, k);
    // a felirat a ferde tetősíkban lévő ablaké, ha nincs külső falhoz rendelve (falhoz nem köthető, vagy belső
    // „fülkeként” / belső nyílásként felismert) és ablakméretű
    const jelolt = [...(a.arvaFeliratok ?? []), ...a.nyilasok.filter((n) => !n.kulso && (n.fajta === 'falfulke' || n.fajta === 'ablak'))];
    const alaprajzrol = jelolt.flatMap((f) => {
      if (f.szel < 0.4 || f.szel > 1.6 || f.mag < 0.6 || f.mag > 1.8) return [];
      // a felirat a tetőtéri homlokzat mentén (a tetőpárkány vetületében, kívül vagy belül): a legközelebbi, külső falú
      // átvett helyiség (≤ 2,5 m)
      let hi = -1, tav: Record<number, number> = {}, leg = 2.5;
      ri.forEach((x, j) => {
        if (x < 0 || !hs[j]) return;
        const t: Record<number, number> = {}; let m = Infinity;
        for (const sg of r.helyisegek[x]!.szakaszok) if (sg.tul === 'kulso') for (const q of sg.pontok) { const d = Math.hypot(q[0] - f.x, q[1] - f.y) * r.mPerPt; if (d < (t[sg.irany] ?? Infinity)) t[sg.irany] = d; if (d < m) m = d; }
        if (m < leg) { leg = m; hi = j; tav = t; }
      });
      if (hi < 0) return [];
      return [{ helyiseg: hi, szel: f.szel, mag: f.mag, tav }];
    });
    if (!me?.tetoter || me.tetoter.terdfal === null || me.tetoter.padlo === null) return alaprajzrol;
    // a homlokzatokról azonosítva (a térdfal teteje feletti keretek): darabszám és tájolás a homlokzat szerint, a méret
    // az alaprajzi felirat szerint, ha van azonos szélességű; a homlokzat irányában a legtöbb külső fallal bíró
    // tetőtéri helyiséghez. Homlokzati találat híján az alaprajzi feliratok.
    const kuszob = me.tetoter.padlo + me.tetoter.terdfal + 0.1;
    const hom = homlokzatLapok.flatMap(({ l }) => { try { return tetoAblakokHomlokzatrol(l.lap, kuszob, me.tetoter!.hajlas, a.e.meretarany ?? undefined); } catch { return []; } });
    const homRes = hom.flatMap((t) => {
      const ir = (Math.round(norm(t.az + eszak) / 90) * 90) % 360;
      let hi = -1, leg = 0;
      ri.forEach((x, j) => { if (x < 0 || !hs[j]) return; const L = r.helyisegek[x]!.szakaszok.filter((sg) => sg.tul === 'kulso' && sg.irany === ir).reduce((q, sg) => q + sg.hossz, 0); if (L > leg) { leg = L; hi = j; } });
      const fel = alaprajzrol.find((x) => Math.abs(x.szel - t.szel) <= 0.1);
      return hi < 0 ? [] : [{ helyiseg: hi, szel: fel?.szel ?? t.szel, mag: fel?.mag ?? t.hossz, irany: ir }];
    });
    return homRes.length ? homRes : alaprajzrol;
  }

  function egyAtvetel(q: Projekt, a: AlaprajzFeldolgozas, k: Kijeloles, o: { csere: boolean; padloAt: boolean; tetoAt: boolean; eszak: number; szintek: string[]; fajl?: string }): string[] {
    // terepszint alatti szint (pince, alagsor): a feltételes rétegrendek (pincefal, pincepadló) is átkerülnek
    const terepAlatt = o.szintek.includes('P');
    // tetőtéri alaprajz (a legfelső szint tetőtér): a metszet tetőhajlása és térdfala szerint ferde tető + térdfal
    const tetoterLap = o.szintek.includes('T') && o.tetoAt && me?.szintek.belmagassag.length ? true : false;
    const extraUz: string[] = [];
    const blokkok = (me?.blokkok ?? []).filter((b) => rrKi[b.rr.kod] || (terepAlatt && b.becsles.feltetel === 'terepAlatt'));
    // méretfelirat nélküli nyílások magassága a homlokzati lapokról (a lap szintjének sorszáma alulról)
    const szintSor = [...new Set(alaprajzLapok.flatMap(({ i }) => lapSzintek(i)))].sort((x, y) => SZINT_SOR.indexOf(x) - SZINT_SOR.indexOf(y));
    const mert = a.r && a.e.mPerPt && a.nyilasok.some((n) => n.mert) ? mertMagassagok(a.nyilasok, a.e.mPerPt, o.eszak, homlokzatRajzTar(homlokzatLapok.map(({ l }) => l.lap), a.e.meretarany), Math.max(0, szintSor.indexOf(o.szintek[0] ?? 'F')), szintSor.length) : undefined;
    const { helyisegek: hs, nyilasok: ny } = atvetelReszek(a, k, mert);
    // szomszédos épülethez csatlakozó (zártsorú, ikres) falak: nem homlokzati falak – az átvételből kimaradnak
    if (a.r) {
      const { ri: riL } = atvetelReszek(a, k);
      const szh = riL.reduce((t, x) => t + (x < 0 ? 0 : a.r!.helyisegek[x]!.szakaszok.filter((sg) => sg.tul === 'kulso' && sg.szomszed).reduce((q, sg) => q + sg.hossz, 0)), 0);
      if (szh >= 0.3) extraUz.push(`Szomszédos épülethez csatlakozó fal: ${String(Math.round(szh * 100) / 100).replace('.', ',')} m (a rajzon „szomszédos épület” / „zártsorú” felirat a fal mögött) – nem homlokzati fal, nem került át; ha a szomszéd fűtetlen, a Határolás lépésben vedd fel.`);
    }
    const mertDb = ny.length && mert ? [...mert.values()] : [];
    if (mertDb.length) {
      const h = mertDb.filter((x) => x.forras === 'homlokzat').length, sz = mertDb.filter((x) => x.forras === 'szelesseg').length, b = mertDb.filter((x) => x.forras === 'becsult').length;
      extraUz.push(`${mertDb.length} méretfelirat nélküli nyílás: szélesség az alaprajzról mérve; magasság ${[h ? `${h} a homlokzatról (helyzet szerint)` : '', sz ? `${sz} a homlokzat azonos szélességű kereteiből` : '', b ? `${b} becsült (1,50 / 2,40 m)` : ''].filter(Boolean).join(', ')} – ellenőrizd a Határolás lépésben.`);
    }
    return tervAtvesz(q, {
      helyisegek: hs, retegrendek: blokkok, nyilasok: ny,
      eszakSzog: o.eszak, belmagassag: (tetoterLap ? me?.tetoter?.belmagassag ?? me?.szintek.belmagassag.at(-1) : undefined) ?? bm ?? 2.7, szintszam: szintszam ?? 1, csere: o.csere, padloAt: o.padloAt, tetoAt: o.tetoAt,
      ...(tetoterLap && me?.tetoter ? { tetoter: { ...me.tetoter, orom: oromok(o.eszak, a.e.meretarany ?? undefined) }, tetoablakok: tetoAblakok(a, hs, k, o.eszak) } : {}),
      ...(mintaFajta === 'blokkos' ? { alapFalSablon: 'fal_blokk_kohosalak' } : {}),
      forras: [o.fajl, mLap?.fajl].filter(Boolean).join(', '), szintek: o.szintek,
      ...(terepAlatt ? { terepAlatt: true, ...(pinceMelyseg ? { terepMelyseg: pinceMelyseg } : {}) } : {}),
    }).uzenetek.concat(extraUz);
  }

  function atvesz() {
    if (!al) return;
    let uzenetek: string[] = [];
    modosit((q) => { uzenetek = egyAtvetel(q, al, kj, { csere, padloAt, tetoAt, eszak: eszakSz, szintek: lapSzintek(aIdx), fajl: aLap?.fajl }); });
    if (pecset && pecsetBe) modosit((q) => pecsetAtvesz(q, pecset));
    if (al.e.eszak) eszakJavitasMent(al.e.eszak.alairas, eszakSz - al.e.eszak.szog);
    setKesz(uzenetek);
    setAtvett((x) => new Set([...x, aIdx]));
    // a következő alaprajz alapból a meglévők mellé kerül
    setCsere(false);
  }

  /** Minden feldolgozott, átvételre jelölt alaprajz egy lépésben, szintsorrendben (az első a választott módon, a többi hozzáadva). */
  function osszesAtvesz() {
    const sor = alaprajzLapok.filter(({ i }) => !kimarad(i) && typeof elemzesek[i] === 'object')
      .sort((x, y) => SZINT_SOR.indexOf(lapSzintek(x.i)[0] ?? 'F') - SZINT_SOR.indexOf(lapSzintek(y.i)[0] ?? 'F'));
    if (!sor.length) return;
    setOsszesFut(true);
    const futott = [...new Set(sor.flatMap(({ i }) => lapSzintek(i)).filter((x) => x !== 'P'))].sort((a, b) => SZINT_SOR.indexOf(a) - SZINT_SOR.indexOf(b));
    const uz: string[] = [];
    const szintA = new Map<string, number>();
    // laponként: a projektbe került helyiségek helye (szintenként azonos sorrendben) a szintek egymásra vetítéséhez
    const lapAdat: { a: AlaprajzFeldolgozas; sz: string[]; reszek: ReturnType<typeof atvetelReszek>; kezd: number; felIds: Set<string> }[] = [];
    modosit((q) => {
      sor.forEach(({ l, i }, n) => {
        const a = elemzesek[i] as AlaprajzFeldolgozas;
        // a megnyitott lapnál a kézi kijelölés, a többinél az alapértelmezett
        const k = i === aIdx ? kj : kijeloles(i, a);
        const sz = lapSzintek(i);
        const elotteF = new Set(q.feluletek.map((f) => f.id));
        const u = egyAtvetel(q, a, k, { csere: n === 0 ? csere : false, padloAt: !!futott.length && sz.includes(futott[0]!), tetoAt: !!futott.length && sz.includes(futott.at(-1)!), eszak: eszakLap(i, a), szintek: sz, fajl: l.fajl });
        { const reszek = atvetelReszek(a, k); lapAdat.push({ a, sz, reszek, kezd: q.helyisegek.length - reszek.helyisegek.length * Math.max(1, sz.length), felIds: new Set(q.feluletek.filter((f) => !elotteF.has(f.id)).map((f) => f.id)) }); }
        uz.push(`${l.cim || l.fajl}: ${atvetelReszek(a, k).helyisegek.length} helyiség${sz.length > 1 ? ` × ${sz.length} szint` : ''}`, ...u.filter((x) => !/azonos felület összevonva/.test(x)));
        for (const s0 of sz) if (s0 !== 'P') szintA.set(s0, (szintA.get(s0) ?? 0) + atvetelReszek(a, k).helyisegek.filter((h) => h.kategoria !== 'gyengen_kapcsolt').reduce((t, h) => t + h.A, 0));
      });
      // pince feletti födém: a földszint fűtött területe − a pince fűtött területe (a fűtött pincerész feletti födém nem hőburok)
      const pinceLap = alaprajzLapok.find(({ i }) => lapSzintek(i).includes('P') && typeof elemzesek[i] === 'object');
      if (pinceLap) {
        const pa = elemzesek[pinceLap.i] as AlaprajzFeldolgozas;
        const pk = pinceLap.i === aIdx ? kj : kijeloles(pinceLap.i, pa);
        const pinceFutott = atvetelReszek(pa, pk).helyisegek.filter((h) => h.kategoria !== 'gyengen_kapcsolt').reduce((t, h) => t + h.A, 0);
        const fod = q.feluletek.find((f) => /^Födém – fűtetlen (pince|garázs) felett/.test(f.nev) && f.hatar !== 'kulso');
        // helyiségenként: a földszint alaprajzát a pincéére vetítve, ami fűtött pincehelyiség felett van, az nem hőburok –
        // a földszint padlója akár pincefödém, akár (rétegrend híján) talajon fekvő padlóként került át
        const fsz = lapAdat.find((x) => x.sz.includes('F')), pl = lapAdat.find((x) => x.sz.includes('P'));
        const fszH = fsz ? fsz.reszek.helyisegek.map((h, j) => ({ h, j, hz: q.helyisegek[fsz.kezd + fsz.sz.indexOf('F') * fsz.reszek.helyisegek.length + j]?.hsz })) : [];
        // a földszint (rétegrend híján) talajon fekvő padlóként átvett felülete(i)
        const talajF = fsz ? q.feluletek.filter((f) => fsz.felIds.has(f.id) && f.fajta === 'padlo' && /^Talajon fekvő padló/.test(f.nev)) : [];
        const el = (fod || talajF.length) && fsz?.a.r && pl?.a.r ? eltolas(fsz.a.r, pl.a.r) : null;
        if (fsz && pl && el && pinceFutott > 0.5) {
          const fut = new Set(pl.reszek.ri.filter((v, j) => v >= 0 && pl.reszek.helyisegek[j]!.kategoria !== 'gyengen_kapcsolt'));
          let uj = 0, fedettA = 0, elotte = 0;
          for (const { h, j, hz } of fszH) {
            if (h.kategoria === 'gyengen_kapcsolt') continue;
            const ri = fsz.reszek.ri[j]!;
            const fedett = ri >= 0 ? fedettArany(fsz.a.r!, ri, pl.a.r!, fut, el) : 0;
            if (fod && hz?.padloFeluletId === fod.id) {
              const Ar = Math.round(h.A * (1 - fedett) * 100) / 100; elotte += h.A;
              if (Ar < 0.5 || fedett > 0.95) { hz.padlo = false; delete hz.padloFeluletId; delete hz.padloA; } else { if (fedett > 0.05) hz.padloA = Ar; uj += Ar; }
            } else if (talajF.length) fedettA += h.A * (fedett > 0.95 ? 1 : fedett);
          }
          if (fod) {
            uj = Math.round(uj * 100) / 100;
            uz.push(`Pince feletti födém: a földszint helyiségei közül a fűtött pincehelyiségek (${sz2(pinceFutott)} m²) felett lévő rész nem hőburok → ${sz2(elotte)} m² helyett ${sz2(uj)} m² (az alaprajzok egymásra vetítéséből).`);
            if (uj > 0) fod.A = uj; else q.feluletek = q.feluletek.filter((f) => f !== fod);
          }
          if (talajF.length && fedettA > 0.5) {
            // a fűtött pince feletti rész nem talajon fekvő padló: a földszinti padló(k) területe ennyivel kisebb,
            // a kitett kerület a megmaradó terület arányában (közelítés – a Határolás lépésben pontosítható)
            const ossz = talajF.reduce((t, f) => t + (f.A ?? 0), 0);
            for (const f of talajF) {
              const A0 = f.A ?? 0, A = Math.max(0, Math.round((A0 - fedettA * A0 / ossz) * 100) / 100);
              if (A < 0.5) { q.feluletek = q.feluletek.filter((x) => x !== f); continue; }
              if (f.padlo && A0 > 0) f.padlo.P = Math.round(f.padlo.P * A / A0 * 100) / 100;
              f.A = A;
            }
            uz.push(`Pince feletti padló: a földszint ${sz2(fedettA)} m²-e fűtött pincehelyiségek felett van – nem talajon fekvő padló (az alaprajzok egymásra vetítéséből); a földszinti talajon fekvő padló ${sz2(ossz)} m² helyett ${sz2(Math.max(0, ossz - fedettA))} m².`);
          }
        } else if (fod && pinceFutott > 0.5) {
          const uj = Math.max(0, Math.round(((fod.A ?? 0) - pinceFutott) * 100) / 100);
          uz.push(`Pince feletti födém: ${sz2(fod.A ?? 0)} m² (földszint, fűtött) − ${sz2(pinceFutott)} m² (pince, fűtött) = ${sz2(uj)} m².`);
          if (uj > 0) fod.A = uj; else q.feluletek = q.feluletek.filter((f) => f !== fod);
        }
      }
      // szintkülönbségek: ami egy szinten túlnyúlik a felette lévőn, annak a teteje lapostető; ami az alatta lévőn, annak az alja konzol/árkád feletti födém
      const sorrend = futott.filter((x) => szintA.has(x));
      const rr = (kod: string) => q.retegrendek.find((r) => r.tervbol && r.kovetelmenyKod === kod);
      // árkád-rétegrend híján az alulról szigetelt (alsó zárófödém) rétegrend
      const lapos = rr('lapostető'), arkad = rr('arkadfodem') ?? rr('also_zarofodem');
      // helyiségenként, a szomszédos szint alaprajzára vetítve: ami felett / alatt nincs fűtött tér
      const lapja = (s0: string) => lapAdat.find((x) => x.sz.includes(s0));
      const futottRi = (x: (typeof lapAdat)[number]) => new Set(x.reszek.ri.filter((v, j) => v >= 0 && x.reszek.helyisegek[j]!.kategoria !== 'gyengen_kapcsolt'));
      const vetit = (s0: string, mas: string, fel: boolean): { db: number; A: number } | null => {
        const x = lapja(s0), y = lapja(mas);
        if (!x || !y || x === y || !x.a.r || !y.a.r) return null;
        const el = eltolas(x.a.r, y.a.r);
        if (!el) return null;
        const fut = futottRi(y), si = x.sz.indexOf(s0), nk = x.reszek.helyisegek.length;
        const fel0 = { id: ujIdT() }; let A = 0, db = 0;
        x.reszek.helyisegek.forEach((h, j) => {
          const ri = x.reszek.ri[j]!;
          if (ri < 0 || h.kategoria === 'gyengen_kapcsolt') return;
          const nyitott = 1 - fedettArany(x.a.r!, ri, y.a.r!, fut, el);
          const Ar = Math.round(h.A * nyitott * 100) / 100;
          if (nyitott < 0.05 || Ar < 0.5) return;
          const hz = q.helyisegek[x.kezd + si * nk + j]?.hsz;
          if (!hz) return;
          if (fel) { hz.padlas = true; hz.padlasA = Ar; hz.padlasFeluletId = fel0.id; } else { hz.padlo = true; hz.padloA = Ar; hz.padloFeluletId = fel0.id; }
          A += Ar; db++;
        });
        if (A > 1) {
          if (fel) {
            q.feluletek.push({ id: fel0.id, nev: `Lapostető – ${szintNev(s0)} felett (a felső szint alaprajzán kívül eső rész)`, fajta: 'opak', retegrendId: lapos?.id, hatar: 'kulso', A: Math.round(A * 100) / 100, tajolas: null, hajlasszog: 0, chi: 0.1 });
            uz.push(`${szintNev(s0)}: ${db} helyiség (${sz2(A)} m²) felett nincs fűtött tér a(z) ${szintNev(mas)} alaprajzán → lapostető${lapos ? ` (${lapos.nev})` : ' – a metszeten nincs lapostető-rétegrend, a Határolás lépésben válassz'}.`);
          } else {
            q.feluletek.push({ id: fel0.id, nev: `Födém – ${szintNev(s0)} alatt, külső levegő felett (konzol, árkád)`, fajta: 'opak', retegrendId: arkad?.id, hatar: 'kulso', A: Math.round(A * 100) / 100, tajolas: null, hajlasszog: 0, chi: 0.1 });
            uz.push(`${szintNev(s0)}: ${db} helyiség (${sz2(A)} m²) alatt nincs fűtött tér a(z) ${szintNev(mas)} alaprajzán → árkád / konzol feletti födém${arkad ? ` (${arkad.nev})` : ' – a metszeten nincs ilyen rétegrend, a Határolás lépésben válassz'}.`);
          }
        }
        return { db, A };
      };
      sorrend.forEach((s0, j) => {
        const fv = j < sorrend.length - 1 ? vetit(s0, sorrend[j + 1]!, true) : undefined;
        const av = j > 0 ? vetit(s0, sorrend[j - 1]!, false) : undefined;
        const A = szintA.get(s0)!;
        const fol = j < sorrend.length - 1 ? szintA.get(sorrend[j + 1]!)! : null;
        const ala = j > 0 ? szintA.get(sorrend[j - 1]!)! : null;
        if (fv === null && fol !== null && A - fol > 1) {
          const dA = Math.round((A - fol) * 100) / 100;
          q.feluletek.push({ id: ujIdT(), nev: `Lapostető – ${szintNev(s0)} felett (felső szinten túlnyúló rész)`, fajta: 'opak', retegrendId: lapos?.id, hatar: 'kulso', A: dA, tajolas: null, hajlasszog: 0, chi: 0.1 });
          uz.push(`${szintNev(s0)}: ${sz2(dA)} m² nyúlik túl a felette lévő szinten → lapostető${lapos ? ` (${lapos.nev})` : ' – a metszeten nincs lapostető-rétegrend, a Határolás lépésben válassz'}. A terület a helyiségek nettó alapterületének különbsége – a tényleges tetőfelülettel ellenőrizd.`);
        }
        if (av === null && ala !== null && A - ala > 1) {
          const dA = Math.round((A - ala) * 100) / 100;
          q.feluletek.push({ id: ujIdT(), nev: `Födém – ${szintNev(s0)} alatt, külső levegő felett (konzol, árkád)`, fajta: 'opak', retegrendId: arkad?.id, hatar: 'kulso', A: dA, tajolas: null, hajlasszog: 0, chi: 0.1 });
          uz.push(`${szintNev(s0)}: ${sz2(dA)} m² nyúlik túl az alatta lévő szinten → árkád / konzol feletti födém${arkad ? ` (${arkad.nev})` : ' – a metszeten nincs ilyen rétegrend, a Határolás lépésben válassz'}.`);
        }
      });
    });
    if (pecset && pecsetBe) modosit((q) => pecsetAtvesz(q, pecset));
    setAtvett((x) => new Set([...x, ...sor.map(({ i }) => i)]));
    setKesz([...new Set(uz)]); setCsere(false); setOsszesFut(false);
  }

  const vb = al?.r ? [al.r.x0, al.r.y0, al.r.w * al.r.px / al.r.mPerPt, al.r.h * al.r.px / al.r.mPerPt] : aLap ? [0, 0, aLap.lap.szel, aLap.lap.mag] : [0, 0, 1, 1];
  const nezet = nagyit ? vb : aLap ? [0, 0, aLap.lap.szel, aLap.lap.mag] : vb;
  // a fogópontok mérete képernyő-pixelben ~ (a nézet szélessége ~900 px-en)
  const fogo = (nezet[2] ?? 900) / 900;
  const nyilHossz = nezet[2]! * 0.05;
  const ej = al?.e.eszak;
  const ejX = ej && ej.x > nezet[0]! && ej.x < nezet[0]! + nezet[2]! && ej.y > nezet[1]! && ej.y < nezet[1]! + nezet[3]! ? ej.x : nezet[0]! + nezet[2]! - nyilHossz * 1.6;
  const ejY = ej && ejX === ej.x ? ej.y : nezet[1]! + nyilHossz * 1.6;
  const rad = eszakSz * Math.PI / 180;

  return (
    <>
      <section class="szakasz">
        <h2>Tervlapok</h2>
        <p class="halk">Tölts fel PDF tervlapokat (vektoros, rajzolóprogramból exportált – nem szkennelt). A program felismeri az alaprajzot és a metszetet, és kiolvassa a helyiségeket, az északjelet, a rétegrendeket, a szintmagasságokat, a külső falakat és a nyílászárókat. Átvétel előtt minden adat ellenőrizhető és javítható. A fájl nem kerül fel a szerverre: a feldolgozás a böngészőben történik.</p>
        <div class="gombsor">
          <button class={`gomb${mintaFajta === 'panel' ? ' aktiv-gomb' : ''}`} onClick={() => mintalap('panel')}>Panel típusalaprajzok</button>
          <button class={`gomb${mintaFajta === 'blokkos' ? ' aktiv-gomb' : ''}`} onClick={() => mintalap('blokkos')}>Blokkos típusalaprajzok</button>
          <label class="gomb fo" style="cursor:pointer">PDF tervlapok kiválasztása<input type="file" accept="application/pdf,.pdf" multiple style="display:none" onChange={(e) => { const t = e.target as HTMLInputElement; setMintaFajta(null); void betolt(t.files).then(() => { t.value = ''; }); }} /></label>
          {lapok.length > 0 && <button class="gomb halk-gomb semleges" onClick={() => { setLapok([]); setAIdx(-1); setMIdx(-1); setKesz(null); setElemzesek({}); setKijelolesek({}); setAtvett(new Set()); setEszakKozos(null); setEszakKulon({}); }}>Lapok törlése</button>}
          {folyamat && !halad && <span class="halk" role="status">{folyamat}</span>}
        </div>
        {halad && <div class="halad" role="status"><progress value={halad.arany} max={1} /><span>{Math.round(halad.arany * 100)}% · {halad.szoveg}</span></div>}
        {!halad && alaprajzLapok.some(({ i }) => elemzesek[i] === undefined) && (() => { const kesz = alaprajzLapok.filter(({ i }) => elemzesek[i] !== undefined).length; const kov = alaprajzLapok.find(({ i }) => elemzesek[i] === undefined)!; return <div class="halad" role="status"><progress value={kesz} max={alaprajzLapok.length} /><span>Alaprajzok feldolgozása: {kesz} / {alaprajzLapok.length} kész · most: {kov.l.cim || kov.l.fajl}</span></div>; })()}
        {hiba && <div class="hiba-doboz" style="margin-top:12px">{hiba}</div>}
        {lapok.length > 0 && (
          <div class="racs" style="margin-top:16px">
            <label class="mezo"><span>Alaprajz</span>
              <select value={aIdx} onChange={(e) => { setAIdx(Number((e.target as HTMLSelectElement).value)); setMeretarany(undefined); }}>
                <option value={-1}>– nincs –</option>
                {lapok.map((l, i) => <option value={i}>{l.fajl} · {l.oldal}. oldal{l.cim ? ` · ${l.cim}` : ''}</option>)}
              </select>
            </label>
            <label class="mezo"><span>Metszet{me && <small class="jel jo" style="margin-left:8px">feldolgozva · {me.blokkok.length} rétegrend · {me.szintek.szintszam} szint</small>}</span>
              <select value={mIdx} onChange={(e) => setMIdx(Number((e.target as HTMLSelectElement).value))}>
                <option value={-1}>– nincs –</option>
                {lapok.map((l, i) => <option value={i}>{l.fajl} · {l.oldal}. oldal{l.cim ? ` · ${l.cim}` : ''}</option>)}
              </select>
            </label>
          </div>
        )}
        {alaprajzLapok.length > 0 && (
          <div style="margin-top:16px">
            <label class="mezo" style="max-width:520px;margin-bottom:8px" title="Bővítés, épületrész: csak a megadott kódkezdetű helyiségek kerülnek át (pl. „TF, TE, TT”); a többi fűtött szomszéd, a közös fal nem hőátadó">
              <span>Számított épületrész – helyiségkódok kezdete (üresen: az egész épület)</span>
              <input type="text" aria-label="Számított épületrész helyiségkódjai" value={reszKod} placeholder="pl. TF, TE, TT" onInput={(e) => setReszKod((e.target as HTMLInputElement).value)} />
            </label>
            <span class="halkabb">Alaprajzok és szintek – egy alaprajz több azonos szintet is ábrázolhat (pl. 1. és 2. emelet); a helyiségek szintenként, a falak és nyílászárók a szintek számával szorozva kerülnek át</span>
            {(() => { const v = alaprajzLapok.filter(({ i }) => !atvett.has(i)); return v.length > 1 && <div style="margin-top:4px"><MindJelolo db={v.filter(({ i }) => !kimarad(i)).length} ossz={v.length} szoveg="mind átvételre / egyik sem" valt={(be) => { const k = { ...kihagyLap }; for (const { i } of v) k[i] = !be; setKihagyLap(k); }} /></div>; })()}
            <table class="tabla" style="margin-top:4px">
              <tbody>
                {alaprajzLapok.map(({ l, i }) => (
                  <tr style={i === aIdx ? 'background:var(--kijelolt)' : ''}>
                    <td><button class="link-gomb" onClick={() => { setAIdx(i); setMeretarany(undefined); }}>{l.cim || l.fajl}</button></td>
                    <td>
                      <span class="gombsor" style="gap:4px">
                        {SZINT_SOR.map((k) => { const be = lapSzintek(i).includes(k); return (
                          <button class={`gomb kis-gomb${be ? ' fo' : ''}`} title={szintNev(k)} onClick={() => setSzintKi({ ...szintKi, [i]: be ? lapSzintek(i).filter((x) => x !== k) : [...lapSzintek(i), k].sort((a, b) => SZINT_SOR.indexOf(a) - SZINT_SOR.indexOf(b)) })}>{k === 'P' ? 'Pince' : k === 'F' ? 'Fszt.' : k === 'T' ? 'Tt.' : `${k}.`}</button>
                        ); })}
                      </span>
                    </td>
                    <td class="halkabb" style="white-space:nowrap">{(() => {
                      const el = elemzesek[i];
                      if (el === undefined) return <span class="jel figy">feldolgozás…</span>;
                      if (typeof el === 'string') return <span class="jel rossz" title={el}>hiba</span>;
                      const hsz = el.e.helyisegek.filter((h) => h.forras === 'pecset' && !h.kulter).length;
                      const lak = el.e.egysegek.length;
                      return <span class="jel jo">feldolgozva · {hsz} helyiség{lak ? ` · ${lak} egység` : ''}</span>;
                    })()}</td>
                    <td class="halkabb" style="white-space:nowrap">{atvett.has(i) ? <span class="jel jo">átvéve</span> : <label class="jelolo" style="font-size:12px"><input type="checkbox" checked={!kimarad(i)} onChange={(e) => setKihagyLap({ ...kihagyLap, [i]: !(e.target as HTMLInputElement).checked })} /> átvételre</label>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(() => {
              // szintenként: a kijelölt (átvételre jelölt) lapok fűtött / lakótéren belüli helyiségei lakásonként
              const sorok: { szint: string; lap: string; egyseg: string; A: number }[] = [];
              for (const { l, i } of alaprajzLapok) {
                const a = elemzesek[i]; if (typeof a !== 'object' || kimarad(i)) continue;
                const k = i === aIdx ? kj : kijeloles(i, a);
                const hs = atvetelReszek(a, k).helyisegek.filter((h) => h.kategoria !== 'gyengen_kapcsolt');
                const szk = lapSzintek(i).length ? lapSzintek(i) : ['?'];
                for (const sz0 of szk) for (const h of hs) sorok.push({ szint: sz0, lap: l.cim || l.fajl, egyseg: (h.egyseg ?? 'Egyéb').replace(/ · (földszint|pince|tetőtér|\d+\. emelet)/, ''), A: h.A });
              }
              if (!sorok.length) return null;
              const szintek = [...new Set(sorok.map((x) => x.szint))].sort((a, b) => SZINT_SOR.indexOf(a) - SZINT_SOR.indexOf(b));
              const ossz = sorok.reduce((s0, x) => s0 + x.A, 0);
              return (
                <div class="kartya" style="margin-top:12px;padding:10px 12px">
                  <strong>Hasznos alapterület szintenként</strong> <span class="halkabb">(az átvételre jelölt lapok fűtött és lakótéren belüli helyiségei, a kijelölés szerint)</span>
                  <table class="tabla" style="margin-top:6px">
                    <tbody>
                      {szintek.map((szn) => {
                        const l = sorok.filter((x) => x.szint === szn);
                        const egys = [...new Set(l.map((x) => x.egyseg))];
                        return (
                          <tr>
                            <td style="white-space:nowrap"><strong>{szn === '?' ? 'Szint nélkül' : szintNev(szn)}</strong></td>
                            <td class="halkabb">
                              <details><summary>{egys.length} egység · {l.length} helyiség · {[...new Set(l.map((x) => x.lap))].join(', ')}</summary>
                                {egys.map((e) => <div style="display:flex;justify-content:space-between;gap:12px;max-width:420px"><span>{e}</span><span>{sz(l.filter((x) => x.egyseg === e).reduce((s0, x) => s0 + x.A, 0))} m²</span></div>)}
                              </details>
                            </td>
                            <td class="szam"><strong>{sz(l.reduce((s0, x) => s0 + x.A, 0))} m²</strong></td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot><tr><td colSpan={2}>Összesen ({szintek.length} szint)</td><td class="szam">{sz(ossz)} m²</td></tr></tfoot>
                  </table>
                </div>
              );
            })()}
            <div class="gombsor" style="margin-top:8px">
              <button class="gomb fo" disabled={osszesFut || alaprajzLapok.some(({ i }) => elemzesek[i] === undefined) || !alaprajzLapok.some(({ i }) => !kimarad(i) && !atvett.has(i))} onClick={osszesAtvesz}>
                {alaprajzLapok.some(({ i }) => elemzesek[i] === undefined) ? `Feldolgozás… (${alaprajzLapok.filter(({ i }) => elemzesek[i] !== undefined).length} / ${alaprajzLapok.length})` : `Összes kijelölt alaprajz átvétele (${alaprajzLapok.filter(({ i }) => !kimarad(i)).length} lap)`}
              </button>
              <span class="halkabb">{csere && !atvett.size ? 'A projekt meglévő helyiségei, felületei és nyílászárói helyére kerülnek (Felülírás – lent módosítható).' : 'A meglévők mellé kerülnek.'} A megnyitott lapnál a kézi kijelölés, a többinél az összes egység és helyiség.</span>
            </div>
          </div>
        )}
      </section>

      {aLap && !al && elemzesek[aIdx] === undefined && <section class="szakasz"><p class="halk" role="status">A(z) „{aLap.cim || aLap.fajl}” alaprajz feldolgozása folyamatban…</p></section>}
      {aLap && typeof elemzesek[aIdx] === 'string' && <section class="szakasz"><div class="hiba-doboz">A(z) „{aLap.cim || aLap.fajl}” alaprajz nem dolgozható fel: {elemzesek[aIdx] as string}</div></section>}

      {mintaFajta && <MintaLakasok fajta={mintaFajta} modosit={modosit} ugrik={ugrik} />}

      {al && aLap && (
        <section class="szakasz">
          {alaprajzLapok.length > 1 && (() => {
            const j = alaprajzLapok.findIndex(({ i }) => i === aIdx);
            return (
              <div class="lapozo" role="navigation" aria-label="Alaprajzok lapozása">
                <button class="gomb" onClick={() => lapoz(-1)} title="Előző alaprajz (←)">‹</button>
                <strong>{j + 1} / {alaprajzLapok.length}</strong>
                <span>{aLap.cim || aLap.fajl}</span>
                <span class="halkabb">{lapSzintek(aIdx).map(szintNev).join(', ')}{atvett.has(aIdx) ? ' · átvéve' : ''}</span>
                <button class="gomb" onClick={() => lapoz(1)} title="Következő alaprajz (→)">›</button>
                <label class="jelolo" style="margin-left:auto" title="Az összes lap minden helyisége fűtött (a soronként átállított besorolás megmarad)">
                  <input type="checkbox" checked={mindFutott} onChange={(e) => setMindFutott((e.target as HTMLInputElement).checked)} /> Minden helyiség fűtött
                </label>
              </div>
            );
          })()}
          <h2>1. Helyiségek és tájolás</h2>
          <p class="halk">A helyiségpecsétekből (kód, név, burkolat, terület) és a helyiségjegyzékből. A színes vonalak a felismert külső falszakaszok a helyiségek belső (nettó) síkján, homlokzati irány szerint; a jelölők a nyílászárók.</p>
          {al.e.figyelmeztetesek.filter((f) => !(al.e.eszak && eszakJavitas(al.e.eszak.alairas) !== 0 && /északjel irányát/.test(f)) && !(/Északjelet nem találtam/.test(f) && eszakHom(al) !== null)).map((f) => <div class="figyelmeztetes" style="margin-bottom:8px">{f}</div>)}
          <div class="racs" style="margin-bottom:12px">
            <label class="mezo"><span>Méretarány 1 :</span><Szam ertek={al.e.meretarany ?? undefined} valt={(v) => setMeretarany(v)} /></label>
            <div class="mezo"><span>Észak iránya (a lap felfelé irányától, óramutató szerint)</span>
              <div class="gombsor" style="gap:6px">
                <Szam ertek={eszakSz} egyseg="°" valt={(v) => setEszak(norm(v))} />
                <button class="gomb" title="Megfordítás" onClick={() => setEszak(norm(eszakSz + 180))}>180°</button>
                <button class="gomb" onClick={() => setEszak(norm(eszakSz - 45))}>−45°</button>
                <button class="gomb" onClick={() => setEszak(norm(eszakSz + 45))}>+45°</button>
              </div>
              <label class="halkabb" style="display:flex;gap:6px;align-items:center;font-size:13px"><input type="checkbox" checked={kulonE} onChange={(e) => { const be = (e.target as HTMLInputElement).checked; setEszakKulon((x) => { const y = { ...x }; if (be) y[aIdx] = eszakSz; else delete y[aIdx]; return y; }); }} /> Ennél a lapnál külön érték{!kulonE && eszakKozos !== null ? ' (most: közös, minden lapra érvényes)' : ''}</label>
              {!ej && eszakKozos === null && !kulonE && eszakHom(al) !== null && <small class="halkabb">Északjel nincs a lapon: az irányt a homlokzati rajzokból becsültem (a címükben szereplő égtáj és a nyílások helyzete szerint) – ellenőrizd.</small>}
              {ej && eszakKozos === null && !kulonE && <small class="halkabb">{ej.forras === 'betu' ? 'Az „É” / „N” betűs északjelből.' : eszakJavitas(ej.alairas) !== 0 ? 'Ismert északjel: a korábban rögzített iránnyal. Ellenőrizd az előnézeten (piros nyíl).' : 'Az északjel alakjából – ellenőrizd az előnézeten (piros nyíl), a javítást a program ehhez a jelhez megjegyzi.'}</small>}
            </div>
            {al.e.egysegek.length > 1 && (
              <div class="mezo szeles"><span>Lakások / egységek (a helyiségszámozás szerint)
                  <span class="gombsor" style="display:inline-flex;gap:4px;margin-left:8px">
                    <button class="gomb halk-gomb semleges" onClick={() => setEgysegek(new Set(al.e.egysegek))}>Mind</button>
                    {[...new Set(al.e.egysegek.map((eg) => al.e.egysegInfo[eg]?.epulet).filter((x): x is string => !!x))].map((ep) => <button class="gomb halk-gomb semleges" onClick={() => setEgysegek(new Set(al.e.egysegek.filter((eg) => al.e.egysegInfo[eg]?.epulet === ep)))}>{ep} épület</button>)}
                    <button class="gomb halk-gomb semleges" onClick={() => setEgysegek(new Set())}>Egyik sem</button>
                  </span>
                </span>
                <table class="tabla" style="max-width:640px">
                  <tbody>
                    {al.e.egysegek.map((eg) => { const inf = al.e.egysegInfo[eg]!; return (
                      <tr>
                        <td style="width:28px"><input type="checkbox" aria-label={`${eg} átvétele`} checked={egysegek.has(eg)} onChange={(e) => { const s = new Set(egysegek); if ((e.target as HTMLInputElement).checked) s.add(eg); else s.delete(eg); setEgysegek(s); }} /></td>
                        <td>{inf.epulet && <span class="halkabb">{inf.epulet} épület · </span>}<strong>{eg}</strong>{inf.nev && <span class="halk"> · {inf.nev}</span>}</td>
                        <td class="szam">{inf.db} helyiség</td>
                        <td class="szam">{sz(inf.A)} m²</td>
                        <td><button class="gomb halk-gomb semleges" onClick={() => setEgysegek(new Set([eg]))}>Csak ez</button></td>
                      </tr>
                    ); })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div class="kartya" style="padding:0;overflow:auto;max-height:80vh">
            <svg viewBox={nezet.join(' ')} style={`display:block;width:100%;height:auto;background:#fff;${burokSzerk || rajzol ? 'touch-action:none;' : ''}${rajzol ? 'cursor:crosshair' : ''}`} role="img" aria-label="Az alaprajz a felismert elemekkel"
              onPointerMove={(e) => {
                if (!huz) return;
                const svg = e.currentTarget as SVGSVGElement; const m = svg.getScreenCTM(); if (!m) return;
                const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
                setBurokVazlat((b) => { const u = (b ?? burok).map((q) => q.map((v) => [...v] as [number, number])); u[huz.p]![huz.v] = [Math.round(pt.x * 10) / 10, Math.round(pt.y * 10) / 10]; return u; });
              }}
              onClick={(e) => {
                if (!rajzol) return;
                const svg = e.currentTarget as SVGSVGElement; const m = svg.getScreenCTM(); if (!m) return;
                const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
                const p0 = rajzol[0];
                // az első pontra kattintva (vagy dupla kattintással) a körvonal bezárul
                if (p0 && rajzol.length >= 3 && Math.hypot(pt.x - p0[0], pt.y - p0[1]) < 12 * fogo) { burokMent([...(kj.burok ?? burokFelismert), rajzol]); setRajzol(null); return; }
                setRajzol([...rajzol, [Math.round(pt.x * 10) / 10, Math.round(pt.y * 10) / 10]]);
              }}
              onDblClick={() => { if (rajzol && rajzol.length >= 3) { burokMent([...(kj.burok ?? burokFelismert), rajzol]); setRajzol(null); } }}
              onPointerUp={() => { if (huz) { if (burokVazlat) burokMent(burokVazlat); setBurokVazlat(null); setHuz(null); } }}
              onPointerLeave={() => { if (huz) { if (burokVazlat) burokMent(burokVazlat); setBurokVazlat(null); setHuz(null); } }}>
              <image href={aLap.kep} x={0} y={0} width={aLap.lap.szel} height={aLap.lap.mag} />
              {helyisegek.map((h, i) => valasztott[i] && falak(i).map((f) => (
                <path d={f.pontok.map(([x, y]) => `M${(x - 0.45).toFixed(1)} ${(y - 0.45).toFixed(1)}h0.9v0.9h-0.9z`).join('')} fill={IRANY_SZIN[f.irany]} />
              )))}
              {/* hőburok-problémák: piros – ismeretlen túloldal, sárga – ki nem jelölt szomszéd, piros kör – nyitott / részleges körvonal */}
              {problemak.map((pr) => pr.pontok ? (
                <path d={pr.pontok.map(([x, y]) => `M${(x - 1.6).toFixed(1)} ${(y - 1.6).toFixed(1)}h3.2v3.2h-3.2z`).join('')} fill={pr.tipus === 'ismeretlen' ? (ismBe(pr) ? '#16A34A' : '#DC2626') : '#F59E0B'} opacity={0.75}><title>{pr.szoveg}</title></path>
              ) : (() => { const h = helyisegek[pr.i]!; const pt = h.mutato ?? h; const c = pr.tipus === 'nyitott' ? '#DC2626' : '#F97316'; return <g><circle cx={pt.x} cy={pt.y} r={18} fill={c} fill-opacity={0.15} stroke={c} stroke-width={2.5} stroke-dasharray="5 3" /><text x={pt.x + 16} y={pt.y - 12} font-size={16} font-weight="800" fill={c} font-family="system-ui">!</text><title>{pr.szoveg}</title></g>; })())}
              {helyisegek.map((h, i) => {
                const pt = h.mutato ?? h; const ki = !valasztott[i];
                const valt = () => setKizartH((elozo) => { const s = new Set(elozo); if (s.has(i)) s.delete(i); else s.add(i); return s; });
                return (
                  <g opacity={ki ? 0.35 : 1} style="cursor:pointer" onClick={valt}>
                    <title>{h.nev}{ki ? ' – kattintással kijelölöd' : ' – kattintással kiveszed'}</title>
                    {al.auto && <circle cx={pt.x} cy={pt.y} r={7} fill="transparent" />}
                    <circle cx={pt.x} cy={pt.y} r={al.auto ? 4 : 3} fill={ki ? '#888' : '#2E6DB4'} />
                    {h.mutato && <line x1={h.x} y1={h.y} x2={pt.x} y2={pt.y} stroke="#2E6DB4" stroke-width={0.6} stroke-dasharray="2 1" />}
                  </g>
                );
              })}
              {/* hőburok: vastag vonal; szerkesztéskor a csúcsok húzhatók, az élfelezőkkel új pont szúrható be, dupla kattintás törli a csúcsot */}
              {burok.map((q, pi) => (
                <g>
                  {/* a vonal a nagyítástól függetlenül vastag (képernyő-pixelben): fehér kontúr + lila */}
                  <polygon points={q.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke="#fff" stroke-width={10} vector-effect="non-scaling-stroke" stroke-linejoin="round" pointer-events="none" opacity={0.9} />
                  <polygon points={q.map(([x, y]) => `${x},${y}`).join(' ')} fill="#7C3AED" fill-opacity={0.1} stroke="#7C3AED" stroke-width={kj.burok ? 7 : 6} vector-effect="non-scaling-stroke" stroke-linejoin="round" pointer-events="none" />
                  {burokSzerk && q.map(([x, y], vi) => { const [x2, y2] = q[(vi + 1) % q.length]!; return (
                    <rect x={(x + x2) / 2 - 5 * fogo} y={(y + y2) / 2 - 5 * fogo} width={10 * fogo} height={10 * fogo} fill="#fff" stroke="#7C3AED" stroke-width={2} vector-effect="non-scaling-stroke" style="cursor:copy"
                      onPointerDown={(e) => { e.stopPropagation(); (e.currentTarget as SVGGraphicsElement).ownerSVGElement?.setPointerCapture?.(e.pointerId); const u = burok.map((z) => z.map((v) => [...v] as [number, number])); u[pi]!.splice(vi + 1, 0, [(x + x2) / 2, (y + y2) / 2]); setBurokVazlat(u); setHuz({ p: pi, v: vi + 1 }); }}>
                      <title>Új pont beszúrása (húzd)</title>
                    </rect>
                  ); })}
                  {burokSzerk && q.map(([x, y], vi) => (
                    <circle cx={x} cy={y} r={7 * fogo} fill="#7C3AED" stroke="#fff" stroke-width={2} vector-effect="non-scaling-stroke" style="cursor:move"
                      onPointerDown={(e) => { e.stopPropagation(); (e.currentTarget as SVGGraphicsElement).ownerSVGElement?.setPointerCapture?.(e.pointerId); setHuz({ p: pi, v: vi }); }}
                      onDblClick={(e) => { e.stopPropagation(); if (q.length <= 3) return; burokMent(burok.map((z, zi) => (zi === pi ? z.filter((_, j) => j !== vi) : z))); }}>
                      <title>Húzd a pontot; dupla kattintás: pont törlése</title>
                    </circle>
                  ))}
                </g>
              ))}
              {/* mért belső falsíkok: zöld szaggatott = fal megtalálva; piros = ennél az élnél nincs falsáv (a hossz bizonytalan) */}
              {burokMert.flat().filter((e) => e.rajzolt >= 0.8).map((e) => {
                const [a, b2] = e.belso; const mx = (a[0] + b2[0]) / 2, my = (a[1] + b2[1]) / 2; const jo = e.lefedett >= 0.3;
                const fugg = Math.abs(b2[1] - a[1]) > Math.abs(b2[0] - a[0]);
                return (
                  <g pointer-events="none">
                    <line x1={a[0]} y1={a[1]} x2={b2[0]} y2={b2[1]} stroke={jo ? '#059669' : '#DC2626'} stroke-width={2.5} vector-effect="non-scaling-stroke" stroke-dasharray="6 4" />
                    <text x={mx} y={my} transform={fugg ? `rotate(-90 ${mx} ${my})` : undefined} dy={-4 * fogo} font-size={10 * fogo} text-anchor="middle" fill={jo ? '#065F46' : '#B91C1C'} font-family="system-ui" font-weight="600" paint-order="stroke" stroke="#fff" stroke-width={3 * fogo}>
                      {sz(e.hossz)} m{e.vastag !== null ? ` · ${Math.round(e.vastag * 100)} cm` : ' · nincs fal'}
                    </text>
                  </g>
                );
              })}
              {rajzol && rajzol.length > 0 && (
                <g pointer-events="none">
                  <polyline points={rajzol.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke="#7C3AED" stroke-width={5} vector-effect="non-scaling-stroke" stroke-dasharray="8 5" />
                  {rajzol.map(([x, y], i) => <circle cx={x} cy={y} r={(i === 0 ? 9 : 6) * fogo} fill={i === 0 ? '#fff' : '#7C3AED'} stroke="#7C3AED" stroke-width={2} vector-effect="non-scaling-stroke" />)}
                </g>
              )}
              {nyilasok.map(({ n, k }) => (
                <g opacity={kizartNy.has(k) ? 0.3 : 1}>
                  <rect x={n.x - 9} y={n.y - 4} width={18} height={8} rx={1.5} fill={n.fajta === 'ablak' ? '#0EA5E9' : n.fajta === 'erkelyajto' ? '#6366F1' : n.fajta === 'garazskapu' ? '#475569' : '#B45309'} opacity={0.85} />
                  <text x={n.x} y={n.y + 2.2} font-size={5.5} text-anchor="middle" fill="#fff" font-family="system-ui">{Math.round(n.szel * 100)}×{n.mag > 0 ? Math.round(n.mag * 100) : n.mert ? '?' : 'belm.'}</text>
                </g>
              ))}
              <g transform={`translate(${ejX} ${ejY})`}>
                <circle r={nyilHossz * 0.75} fill="#fff" stroke="#B91C1C" stroke-width={nyilHossz * 0.04} opacity={0.9} />
                <line x1={0} y1={0} x2={Math.sin(rad) * nyilHossz * 0.7} y2={-Math.cos(rad) * nyilHossz * 0.7} stroke="#B91C1C" stroke-width={nyilHossz * 0.08} />
                <text x={Math.sin(rad) * nyilHossz * 0.95} y={-Math.cos(rad) * nyilHossz * 0.95 + nyilHossz * 0.12} font-size={nyilHossz * 0.35} text-anchor="middle" fill="#B91C1C" font-weight="700" font-family="system-ui">É</text>
              </g>
            </svg>
          </div>
          <div class="gombsor" style="margin:8px 0 16px;gap:16px;flex-wrap:wrap">
            <button class="gomb halk-gomb semleges" onClick={() => setNagyit(!nagyit)}>{nagyit ? 'Teljes lap' : 'Nagyítás az épületre'}</button>
            <button class={`gomb halk-gomb${burokSzerk ? '' : ' semleges'}`} aria-pressed={burokSzerk} onClick={() => { setBurokSzerk(!burokSzerk); if (!burokSzerk) setNagyit(true); }}>{burokSzerk ? 'Hőburok szerkesztése kész' : 'Hőburok szerkesztése'}</button>
            {kj.burok && <button class="gomb halk-gomb semleges" onClick={() => burokMent(undefined)}>Hőburok: vissza a felismertre</button>}
            <button class={`gomb halk-gomb${rajzol ? '' : ' semleges'}`} aria-pressed={!!rajzol} onClick={() => { if (rajzol) setRajzol(null); else { setRajzol([]); setBurokSzerk(false); setNagyit(true); } }}>{rajzol ? 'Rajzolás megszakítása' : 'Hőburok rajzolása'}</button>
            {rajzol && <span class="figyelmeztetes" style="margin:0">Kattints a hőburok sarokpontjaira a hőszigetelt fal külső síkján körbe; az első pontra kattintva (vagy dupla kattintással) a körvonal bezárul.</span>}
            {!burok.length && !rajzol && <span class="figyelmeztetes" style="margin:0">Zárt fűtött körvonalat nem ismertem fel ezen a lapon – a „Hőburok rajzolása” gombbal rajzold meg (ebből számolom a homlokzati falakat és a 3D nézetet).</span>}
            <span class="halkabb"><span style="display:inline-block;width:22px;height:6px;background:#7C3AED;vertical-align:middle;margin-right:4px;border-radius:2px" />hőburok {kj.burok ? '(szerkesztett – a homlokzati falak és a külső nyílászárók ebből)' : '(felismert)'}</span>
            <span class="halkabb"><span style="display:inline-block;width:18px;border-top:3px dashed #059669;vertical-align:middle;margin-right:4px" />mért belső falsík (hossz · vastagság)</span>
            {[0, 90, 180, 270].map((ir) => <span class="halkabb"><span style={`display:inline-block;width:10px;height:10px;border-radius:2px;background:${IRANY_SZIN[ir]};margin-right:4px`} />{IRANY_NEV[ir]} → {egtaj(ir, eszakSz)}</span>)}
          </div>
          {(() => {
              // hőburok térben: minden átvételre jelölt alaprajz körvonala a szintje szerint, a lapok eltolását a falak illesztése adja
              const sor = alaprajzLapok.filter(({ i }) => !kimarad(i) && typeof elemzesek[i] === 'object' && (elemzesek[i] as AlaprajzFeldolgozas).r);
              if (!sor.length) return <div class="kartya halkabb" style="margin:0 0 16px;padding:10px 12px"><strong>Hőburok térben (3D)</strong> – a 3D nézethez a lap léptéke és a felismert falak kellenek (add meg a méretarányt).</div>;
              const alap = (elemzesek[sor[0]!.i] as AlaprajzFeldolgozas).r!;
              const emelet = (bm ?? 2.7) + 0.35;
              const szint3: Burok3DSzint[] = [];
              const jelen = [...new Set(sor.flatMap(({ i }) => (lapSzintek(i).length ? lapSzintek(i) : ['F'])))].sort((x, y) => SZINT_SOR.indexOf(x) - SZINT_SOR.indexOf(y));
              const nulla = jelen.indexOf('F') >= 0 ? jelen.indexOf('F') : jelen.findIndex((x) => x !== 'P');
              for (const { i } of sor) {
                const a = elemzesek[i] as AlaprajzFeldolgozas, r = a.r!, k = kijeloles(i, a);
                const el = i === sor[0]!.i ? { dx: 0, dy: 0 } : eltolas(alap, r) ?? { dx: 0, dy: 0 };
                const m = (x: number, y: number): [number, number] => [(x - el.dx) * r.mPerPt, (y - el.dy) * r.mPerPt];
                const pol = (k.burok ?? burok3dCache(i, r, futottRiK(a, k))).map((q) => q.map(([x, y]) => m(x, y)));
                const ny = burokNyilasokPt(a, k, pol.length ? (k.burok ?? burok3dCache(i, r, futottRiK(a, k))) : []).map((n) => { const [x, y] = m(n.x, n.y); return { x, y, szel: n.szel, mag: n.mag, pm: n.pm ?? 0 }; });
                const szk = lapSzintek(i).length ? lapSzintek(i) : ['F'];
                for (const sz0 of szk) {
                  const sorszam = jelen.indexOf(sz0) - Math.max(0, nulla);
                  szint3.push({ nev: szintNev(sz0), poligonok: pol, z0: sorszam * emelet, h: emelet - 0.35, nyilasok: ny });
                }
              }
              const vanPol = szint3.some((x) => x.poligonok.length);
              return <details class="kartya" open style="margin:0 0 16px;padding:10px 12px"><summary style="cursor:pointer"><strong>Hőburok térben (3D)</strong> <span class="halkabb">– a lapok hőburok-körvonala szintenként, a nyílászárókkal</span></summary><div style="margin-top:8px">{vanPol ? <Burok3D szintek={szint3} eszakSzog={eszakSz} /> : <div class="halkabb">Még nincs hőburok-körvonal – a fenti alaprajzon a „Hőburok rajzolása” gombbal megrajzolhatod.</div>}</div></details>;
          })()}
          {problemak.length > 0 && (
            <details class="kartya" open style="margin-bottom:16px">
              <summary style="cursor:pointer"><strong>Hőburok-ellenőrzés</strong> <span class="jel figy">{problemak.length} bizonytalan hely</span> <span class="halkabb">– a rajzon jelölve: <span style="color:#DC2626">■</span> ismeretlen túloldal, <span style="color:#F59E0B">■</span> ki nem jelölt szomszéd, <span style="color:#DC2626">◌</span> nyitott / <span style="color:#F97316">◌</span> részlegesen felismert körvonal</span></summary>
              <table class="tabla" style="margin-top:8px">
                <tbody>{problemak.map((pr) => (
                  <tr>
                    <td style="width:16px"><span style={`color:${pr.tipus === 'szomszed' ? '#F59E0B' : pr.tipus === 'reszleges' ? '#F97316' : ismBe(pr) ? '#16A34A' : '#DC2626'}`}>{pr.pontok ? '■' : '◌'}</span></td>
                    <td>{pr.szoveg}</td>
                    <td style="white-space:nowrap;text-align:right">
                      {pr.tipus === 'ismeretlen' && pr.kulcsok && <label class="jelolo" style="font-size:12px"><input type="checkbox" checked={ismBe(pr)} onChange={(e) => setIsmKulso(pr.kulcsok!, (e.target as HTMLInputElement).checked)} /> külső falként számít</label>}
                      {pr.tipus === 'szomszed' && pr.szomszed !== undefined && <>
                        <button class="gomb halk-gomb" onClick={() => { const m = pr.szomszed!; setKizartH((e) => { const x = new Set(e); x.delete(m); return x; }); setKat({ ...kat, [m]: 'kondicionalt' }); }}>fűtött – kijelölöm</button>{' '}
                        <button class="gomb halk-gomb" onClick={() => { const m = pr.szomszed!; setKizartH((e) => { const x = new Set(e); x.delete(m); return x; }); setKat({ ...kat, [m]: 'gyengen_kapcsolt' }); }}>fűtetlen tér felé</button>
                      </>}
                      {(pr.tipus === 'nyitott' || pr.tipus === 'reszleges') && <span class="halkabb" style="font-size:12px">a homlokzati falat a Határolás lépésben ellenőrizd</span>}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
              <p class="halkabb" style="margin-top:6px">A fűtetlen tér felé jelölt szomszéd fala b-tényezővel kerül a számításba; a ki nem jelölt szomszéd felé eső fal egyébként kimarad (azonos hőmérsékletűnek veszi).</p>
            </details>
          )}

          <div class="tabla-gorgeto">
            <table class="tabla">
              <thead><tr><th>{(() => { const v = helyisegek.map((h, i) => (egysegben(i) && !h.kulter ? i : -1)).filter((i) => i >= 0); return <MindJelolo db={v.filter((i) => !kizartH.has(i)).length} ossz={v.length} valt={(be) => setKizartH((e) => { const s = new Set(e); for (const i of v) { if (be) s.delete(i); else s.add(i); } return s; })} />; })()}</th><th>Kód</th><th>Helyiség</th><th>Besorolás</th><th class="szam">Terület</th><th>Külső fal (nettó)</th><th>Ellenőrzés</th></tr></thead>
              <tbody>
                {(() => { let elozo: string | null | undefined = null; return helyisegek.map((h, i) => {
                  if (!egysegben(i)) return null;
                  // lakásonként (egységenként) csoportosítva, a csoport fejében a kijelölt helyiségek területével
                  const ujCsoport = (h.egyseg ?? '') !== elozo; elozo = h.egyseg ?? '';
                  const csoportFej = ujCsoport && al.e.egysegek.length > 0 ? (() => {
                    const tagok = helyisegek.map((x, j) => ({ x, j })).filter(({ x, j }) => (x.egyseg ?? '') === (h.egyseg ?? '') && egysegben(j));
                    const A = tagok.filter(({ j }) => valasztott[j] && kategoria(j) !== 'gyengen_kapcsolt').reduce((s0, { x }) => s0 + x.A, 0);
                    const inf = h.egyseg ? al.e.egysegInfo[h.egyseg] : undefined;
                    return <tr class="csoport-fej"><td colSpan={4}><strong>{h.egyseg ? (inf?.nev ?? h.egyseg) : 'Egység nélkül (külső terek, jegyzéksorok)'}</strong> <span class="halkabb">{h.egyseg} · {tagok.length} helyiség</span></td><td class="szam"><strong>{sz(A)} m²</strong></td><td colSpan={2}></td></tr>;
                  })() : null;
                  const ri = raszterIdx(i); const R = ri >= 0 ? al.r?.helyisegek[ri] : undefined;
                  const fl = falak(i);
                  const megj: string[] = [];
                  if (h.kulter) megj.push('külső tér – nem kerül át');
                  if (h.forras === 'jegyzek') megj.push('csak a jegyzékben: helye a rajzon nem ismert');
                  if (h.jegyzekA !== undefined && Math.abs(h.jegyzekA - h.A) > 0.011) megj.push(`jegyzék: ${sz(h.jegyzekA)} m²`);
                  if (R?.szivarog) megj.push('a helyiség körvonala nem zárt – a külső falakat ellenőrizd');
                  return (<>
                    {csoportFej}
                    <tr style={valasztott[i] ? '' : 'opacity:.55'}>
                      <td><input type="checkbox" aria-label={`${h.nev} átvétele`} disabled={h.kulter} checked={valasztott[i]} onChange={(e) => { const s = new Set(kizartH); if ((e.target as HTMLInputElement).checked) s.delete(i); else s.add(i); setKizartH(s); }} /></td>
                      <td>{h.kod ?? '–'}</td>
                      <td>{h.nev}{h.burkolat && <span class="halkabb"> · {h.burkolat}</span>}</td>
                      <td style="min-width:190px">{!h.kulter && <Valaszto cimke="Besorolás" ertek={kategoria(i)} opciok={KATEGORIAK} valt={(v) => setKat({ ...kat, [i]: v })} />}</td>
                      <td class="szam">{sz(h.A)} m²</td>
                      <td>{fl.length ? fl.map((f) => <span style="white-space:nowrap;margin-right:8px"><span style={`color:${IRANY_SZIN[f.irany]}`}>■</span> {egtaj(f.irany, eszakSz)} {sz(f.hossz)} m</span>) : <span class="halkabb">–</span>}</td>
                      <td class="halkabb">{megj.join('; ')}</td>
                    </tr>
                  </>);
                }); })()}
              </tbody>
              <tfoot><tr><td colSpan={4}>Átvett helyiségek: {valasztott.filter(Boolean).length} db</td><td class="szam">{sz(helyisegek.reduce((s, h, i) => s + (valasztott[i] ? h.A : 0), 0))} m²</td><td colSpan={2}>{iranyok.filter((x) => x.hossz > 0).map((x) => `${x.t} ${sz(x.hossz)} m`).join(' · ')}</td></tr></tfoot>
            </table>
          </div>
        </section>
      )}

      {me && (
        <section class="szakasz">
          <h2>2. Rétegrendek és szintek a metszetből</h2>
          <p class="halk">A rétegrend-feliratok rétegei a katalógus anyagaira képezve. A kimaradó rétegeket (festés, talaj, feltöltés, átszellőztetett tetőfedés) a program indokkal jelzi; a katalógusban nem szereplő anyagnál a λ-t a Rétegrendek lépésben kell megadni.</p>
          {me.szintek.figyelmeztetes.map((f) => <div class="figyelmeztetes" style="margin-bottom:8px">{f}</div>)}
          <div class="racs" style="margin-bottom:16px">
            <label class="mezo"><span>Fűtött szintek száma</span><Szam ertek={szintszam} valt={setSzintszam} /></label>
            <label class="mezo"><span>Belmagasság</span><Szam ertek={bm} egyseg="m" valt={setBm} /></label>
            <div class="mezo"><span>Szintmagasság-jelek</span><span class="halk">{me.szintek.szintek.map((v) => (v > 0 ? '+' : v === 0 ? '±' : '') + sz(v)).join(' · ')}</span></div>
          </div>
          {(() => { const v = me.blokkok.filter((b) => b.becsles.szerep); return v.length > 1 && <div style="margin-bottom:8px"><MindJelolo db={v.filter((b) => rrKi[b.rr.kod]).length} ossz={v.length} szoveg="mind átvételre / egyik sem" valt={(be) => { const k = { ...rrKi }; for (const b of v) k[b.rr.kod] = be; setRrKi(k); }} /></div>; })()}
          {me.blokkok.map((b) => (
            <div class="kartya" style="margin-bottom:10px">
              <label style="display:flex;gap:8px;align-items:baseline;font-weight:600">
                <input type="checkbox" checked={!!rrKi[b.rr.kod]} disabled={!b.becsles.szerep} onChange={(e) => setRrKi({ ...rrKi, [b.rr.kod]: (e.target as HTMLInputElement).checked })} />
                {b.rr.kod} {b.rr.cim}
                <span class="halkabb" style="font-weight:400">{b.becsles.szerep ? { fal: 'külső fal', padlas: 'padlásfödém', teto: 'tető', pincefodem: 'pincefödém', padlo: 'talajon fekvő padló', belso: 'belső szerkezet' }[b.becsles.szerep] : 'nem hőburok'}</span>
              </label>
              {b.becsles.kihagy && <p class="halkabb" style="margin:4px 0 0 24px">{b.becsles.kihagy}</p>}
              <table class="tabla" style="margin-top:6px">
                <tbody>
                  {b.retegek.map((r) => (
                    <tr style={r.kimarad ? 'opacity:.5' : ''}>
                      <td style="width:45%">{r.forras}</td>
                      <td>{r.kimarad ? <span class="halkabb">kimarad – {r.kimarad}</span> : r.legreteg ? `légréteg (${r.legreteg === 'zart' ? 'zárt' : 'átszellőztetett'})` : r.anyagId ? (anyag(r.anyagId)?.nev ?? r.anyagId) : <span style="color:var(--figyel)">nincs a katalógusban – λ megadandó</span>}
                        {r.megjegyzes && <small class="halkabb" style="display:block">{r.megjegyzes}</small>}</td>
                      <td class="szam">{r.kimarad ? '' : `${sz(r.dCm)} cm`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      )}

      {al && (
        <section class="szakasz">
          <h2>3–4. Külső falak és nyílászárók</h2>
          <p class="halk">A homlokzati falfelület a helyiségek külső falának nettó (belső síkon mért) hossza × belmagasság, homlokzatonként. A nyílászárók a nyílásméret-feliratokból (szélesség / magasság, „pm” mellvédmagasság) a falnyíláshoz és a helyiséghez rendelve; a belső ajtók ({belsoAjtok} db) nem kerülnek át.</p>
          <table class="tabla" style="margin-bottom:16px">
            <thead><tr><th>Homlokzat</th><th>Égtáj</th><th class="szam">Falhossz</th><th class="szam">Falfelület (bruttó)</th><th class="szam">Nyílászáró</th></tr></thead>
            <tbody>{iranyok.filter((x) => x.hossz > 0 || x.db > 0).map((x) => (
              <tr><td><span style={`color:${IRANY_SZIN[x.ir]}`}>■</span> {IRANY_NEV[x.ir]}</td><td>{x.t}</td><td class="szam">{sz(x.hossz)} m</td><td class="szam">{sz(x.hossz * (bm ?? 2.7))} m²</td><td class="szam">{x.db} db</td></tr>
            ))}</tbody>
            <tfoot><tr><td colSpan={2}>Összesen (egy szint)</td><td class="szam">{sz(iranyok.reduce((s, x) => s + x.hossz, 0))} m</td><td class="szam">{sz(iranyok.reduce((s, x) => s + x.hossz, 0) * (bm ?? 2.7))} m²</td><td class="szam">{iranyok.reduce((s, x) => s + x.db, 0)} db</td></tr></tfoot>
          </table>
          <div class="tabla-gorgeto">
            <table class="tabla">
              <thead><tr><th><MindJelolo db={nyilasok.filter(({ k }) => !kizartNy.has(k)).length} ossz={nyilasok.length} valt={(be) => setKizartNy(be ? new Set() : new Set(nyilasok.map(({ k }) => k)))} /></th><th>Fajta</th><th class="szam">Szélesség × magasság</th><th class="szam">Mellvéd</th><th>Helyiség</th><th>Égtáj</th><th class="szam">Db</th></tr></thead>
              <tbody>
                {(() => {
                  // azonos fajta, méret, mellvéd, helyiség és égtáj: egy sor darabszámmal
                  const csop = new Map<string, { n: (typeof nyilasok)[number]['n']; hi: number; ks: number[] }>();
                  for (const { n, k, hi } of nyilasok) { const kk = `${n.fajta}|${n.szel}|${n.mag}|${n.pm}|${hi}|${n.irany}`; const c = csop.get(kk); if (c) c.ks.push(k); else csop.set(kk, { n, hi, ks: [k] }); }
                  const szSz = aIdx >= 0 ? Math.max(1, lapSzintek(aIdx).length) : 1;
                  return [...csop.values()].map(({ n, hi, ks }) => { const ki = ks.every((k) => kizartNy.has(k)); return (
                  <tr style={ki ? 'opacity:.55' : ''}>
                    <td><input type="checkbox" aria-label="Átvétel" checked={!ki} onChange={(e) => { const s = new Set(kizartNy); for (const k of ks) { if ((e.target as HTMLInputElement).checked) s.delete(k); else s.add(k); } setKizartNy(s); }} /></td>
                    <td>{FAJTA_NEV[n.fajta]}</td>
                    <td class="szam">{Math.round(n.szel * 100)} × {n.mag > 0 ? `${Math.round(n.mag * 100)} cm` : 'belmagasság'}</td>
                    <td class="szam">{n.pm === null ? '–' : `${Math.round(n.pm * 100)} cm`}</td>
                    <td>{helyisegek[hi]?.kod} {helyisegek[hi]?.nev}{kategoria(hi) === 'gyengen_kapcsolt' && <small class="halkabb" style="display:block">fűtetlen tér – nem kerül a hőburokba</small>}</td>
                    <td>{egtaj(n.irany!, eszakSz)}</td>
                    <td class="szam">{ks.length}{szSz > 1 && <span class="halkabb"> × {szSz} szint</span>}</td>
                  </tr>
                  ); });
                })()}
              </tbody>
              {nyilasok.length > 0 && (() => {
                const be = nyilasok.filter(({ k }) => !kizartNy.has(k)); const szSz = aIdx >= 0 ? Math.max(1, lapSzintek(aIdx).length) : 1;
                const A = be.reduce((s, { n }) => s + n.szel * (n.mag > 0 ? n.mag : bm ?? 2.7), 0);
                return <tfoot><tr><td colSpan={6}>Átvételre jelölt: {be.length} / {nyilasok.length} db · {sz(A, 2)} m²{szSz > 1 ? ` – ${szSz} szinttel: ${be.length * szSz} db · ${sz(A * szSz, 2)} m²` : ''}</td><td class="szam">{be.length * szSz}</td></tr></tfoot>;
              })()}
            </table>
          </div>
        </section>
      )}

      {pecset && (
        <section class="szakasz">
          <h2>Rajzpecsét</h2>
          <p class="halk">A tervlap szövegmezőjéből felismert adatok. Átvételkor a projekt neve, címe, helyrajzi száma és a megrendelő (építtető) kitöltődik.</p>
          <table class="tabla" style="max-width:760px">
            <tbody>
              {([['Projekt', pecset.projekt], ['Terv neve', pecset.tervNev], ['Építés helyszíne', pecset.helyszin], ['Helyrajzi szám', pecset.hrsz], ['±0,00 szint', pecset.szint], ['Építtető', pecset.epitteto], ['Megrendelő', pecset.megrendelo], ['Tervező iroda', pecset.iroda], ['Felelős tervező', [pecset.tervezo, pecset.tervezoNy].filter(Boolean).join(', ')], ['Terv típusa', pecset.tervTipus], ['Dátum', pecset.datum], ['Lépték', pecset.leptek]] as const)
                .filter(([, v]) => v).map(([k, v]) => <tr><td class="halkabb" style="width:180px">{k}</td><td>{v}</td></tr>)}
              {pecset.cim && <tr><td class="halkabb">Cím bontva</td><td>{pecset.cim.irsz} · {pecset.cim.telepules} · {pecset.cim.kozterulet} {pecset.cim.jelleg} {pecset.cim.hazszam}</td></tr>}
            </tbody>
          </table>
          <label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" checked={pecsetBe} onChange={(e) => setPecsetBe((e.target as HTMLInputElement).checked)} /> A projekt adataiba (név, cím, hrsz, megrendelő) átveszem</label>
        </section>
      )}

      {al && (
        <section class="szakasz">
          <h2>Átvétel</h2>
          <p class="halk">Létrejönnek a helyiségek (a hőszükséglethez helyiségenkénti külső falhosszal), a kijelölt rétegrendek, a homlokzati falak tájolás szerint, a talajon fekvő padló, a padlásfödém, a nyílászáró-típusok és -felületek. Az ablaktípus az építési év szerinti kortipikus műanyag ablak – a Nyílászárók lépésben pontosítható.</p>
          <fieldset style="border:1px solid var(--vonal);border-radius:8px;padding:10px 12px;margin:0 0 12px;display:flex;flex-direction:column;gap:6px">
            <legend class="halkabb" style="padding:0 6px">A projekt meglévő adatai ({p.helyisegek.length} helyiség, {p.feluletek.length} határoló felület, {p.nyilaszarok.length} nyílászáró-típus)</legend>
            <label><input type="radio" name="atvetelMod" checked={csere} onChange={() => setCsere(true)} /> <strong>Felülírás</strong> – az eddigi helyiségek, határoló felületek, nyílászárók és a korábban tervből átvett rétegrendek törlődnek, helyettük az újak kerülnek be</label>
            <label><input type="radio" name="atvetelMod" checked={!csere} onChange={() => setCsere(false)} /> <strong>Hozzáadás</strong> – a meglévők mellé olvassa be (pl. másik szint, másik lakás); az azonos rétegrendek, nyílászáró-típusok nem duplikálódnak, az azonos tájolású falfelületek összegződnek</label>
          </fieldset>
          <div class="gombsor" style="gap:18px;margin-bottom:10px">
            <label><input type="checkbox" checked={padloAt} onChange={(e) => setPadloAt((e.target as HTMLInputElement).checked)} /> Legalsó padló (talajon fekvő, ill. fűtetlen pince / garázs feletti födém)</label>
            <label><input type="checkbox" checked={tetoAt} onChange={(e) => setTetoAt((e.target as HTMLInputElement).checked)} /> Padlásfödém / tető (legfelső szint)</label>
          </div>
          <div class="gombsor">
            {alaprajzLapok.length > 1 && <button class="gomb fo" disabled={osszesFut || alaprajzLapok.some(({ i }) => elemzesek[i] === undefined)} onClick={osszesAtvesz}>Összes kijelölt alaprajz átvétele ({alaprajzLapok.filter(({ i }) => !kimarad(i)).length} lap)</button>}
            <button class={`gomb${alaprajzLapok.length > 1 ? '' : ' fo'}`} disabled={!valasztott.some(Boolean)} onClick={atvesz}>{alaprajzLapok.length > 1 ? `Csak ez a lap: ${aLap?.cim || aLap?.fajl}` : 'Átvétel a projektbe'}</button>
          </div>
          {kesz && (
            <div class="kartya" style="margin-top:12px" role="status">
              <strong>Átvéve.</strong> {kesz.map((u) => <p class="halkabb">{u}</p>)}
              <div class="gombsor" style="margin-top:8px">
                <button class="gomb" onClick={() => ugrik('helyisegek')}>Helyiségek</button>
                <button class="gomb" onClick={() => ugrik('retegrendek')}>Rétegrendek</button>
                <button class="gomb" onClick={() => ugrik('hatarolas')}>Határolás</button>
              </div>
            </div>
          )}
        </section>
      )}
      {homlokzatLapok.length > 0 && <HomlokzatEllenorzes p={p} lapok={homlokzatLapok} />}
    </>
  );
}

/** A rajzpecsét adatai a projekt alapadataiba. */
function pecsetAtvesz(q: Projekt, d: PecsetAdat) {
  const epulet = /"([A-Za-zÁÉ0-9]{1,3})"\s*épület/.exec(d.tervNev ?? '')?.[1];
  if (d.projekt) q.meta.nev = `${d.projekt}${d.cim?.telepules ? ` – ${d.cim.telepules}` : ''}${epulet ? `, „${epulet}” épület` : ''}`;
  const megr = d.epitteto ?? d.megrendelo; if (megr) q.meta.megrendelo = megr;
  if (d.tervezo) { q.meta.tervezo = d.tervezo; q.meta.tervezoNy = d.tervezoNy; }
  if (d.hrsz) q.meta.hrsz = d.hrsz;
  if (d.cim) { q.meta.irsz = d.cim.irsz; q.meta.telepules = d.cim.telepules; q.meta.kozterulet = d.cim.kozterulet; q.meta.kozteruletJelleg = d.cim.jelleg || q.meta.kozteruletJelleg; q.meta.hazszam = d.cim.hazszam; }
  else if (d.helyszin && !q.meta.telepules) q.meta.telepules = d.helyszin;
}
