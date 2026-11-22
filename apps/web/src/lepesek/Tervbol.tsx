import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { aiToken, aiTokenMent, svgKivagatPng, aiEllenoriz, type AiValasz } from '../terv/aiEllenorzes';
import { zipPdfek } from '../terv/zipPdf';
import { ujId as ujIdT, type Projekt, type HelyisegKategoria, type Szerep as RrSzerep, SZEREP_ALAP } from '../modell';
const sz2 = (x: number) => x.toLocaleString('hu-HU', { maximumFractionDigits: 1 });
import { Szam, Valaszto, sz, MindJelolo } from '../ui';
import { kategoriaJavaslat } from './Helyisegek';
import { anyag, anyagLista } from '../katalogus';
import { pecsetKinyer, type PecsetAdat } from '@terv/pecset';
import { HomlokzatEllenorzes } from './TervHomlokzat';
import type { SzurkeKep } from '@terv/autohelyiseg';
import { eltolas, fedettArany } from '@terv/fedes';
import { burokAuto, burokFalak, burokMeres, burokTomeg, csatlakozasok, elKornyezet, kulsoSikra, kulsoSraff, nyilasEl, bennE, type Poligon } from '@terv/burok';
import type { TervNyilas } from '@terv/nyilaszarok';
import { pdfLapok, alaprajzFeldolgoz, metszetFeldolgoz, eszakJavitas, eszakJavitasMent, type TervLap, type AlaprajzFeldolgozas } from '@terv/elemzes';
import { egtaj, jegyzekenKivul, pecsetBelmagassag, jegyzekSorok, szintekCimbol, szintNev } from '@terv/alaprajz';
import { tervAtvesz, type AtvettNyilas, type AtvettHelyiseg } from '../terv/atvetel';
import { poliRajzol, type Raszter, type FalSzakasz } from '@terv/raszter';
import { MintaLakasok } from './MintaLakasok';
import { Burok3D, modellOsszesites, tetoGeo, type Burok3DSzint } from './Burok3D';
import { homlokzatRajzok, mertMagassagok, eszakHomlokzatbol, tetoAblakokHomlokzatrol, oromSzelessegek, type HomlokzatRajz, type MertMagassag } from '@terv/homlokzatIllesztes';
import { nezetOszlopok } from '@terv/homlokzatProfil';
import { Epulet3D } from './Epulet3D';
import { zartsagEllenoriz } from '@terv/zartsag';
import { metszetElemek, ferdeTetoHossz, ereszKiallasok, ereszKiallas } from '@terv/metszetGeom';
import { epuletModell, type EpuletModell, type LapBemenet, type Szint as EpSzint, type TerKategoria } from '@terv/epulet';
import { falMagassagModell, type HomlokzatNezetAdat } from '@terv/homlokzatModell';
import { vonalIndex, keretek, homlokzatIrany, homlokzatCimek } from '@terv/homlokzat';
import type { Lap } from '@terv/kinyeres';

type Modosit = (f: (q: Projekt) => void) => void;

const KATEGORIAK: { ertek: HelyisegKategoria; nev: string }[] = [
  { ertek: 'kondicionalt', nev: 'Fűtött' },
  { ertek: 'erosen_kapcsolt', nev: 'Fűtetlen, lakótéren belüli' },
  { ertek: 'gyengen_kapcsolt', nev: 'Fűtetlen tér (b tényezővel)' },
];
const FAJTA_NEV = { ablak: 'Ablak', erkelyajto: 'Erkélyajtó', bejarati_ajto: 'Bejárati ajtó', bejarati_uvegajto: 'Bejárati ajtó (üvegezett)', garazskapu: 'Garázskapu', belso_ajto: 'Belső ajtó', falfulke: 'Falfülke (nem nyílászáró)', fuggonyfal: 'Függönyfal, üvegfal' } as const;
/** Megjeleníthető felismerési rétegek (az alaprajz fölött, külön-külön kapcsolhatók). */
type RetegKulcs = 'burok' | 'helyiseg' | 'fal' | 'nyilas' | 'padlo' | 'fodem' | 'teto' | 'tetoablak';
const RETEGEK: { k: RetegKulcs; nev: string; szin: string }[] = [
  { k: 'burok', nev: 'Hőburok', szin: '#F97316' },
  { k: 'helyiseg', nev: 'Helyiségek', szin: '#2563EB' },
  { k: 'fal', nev: 'Falak', szin: '#B91C1C' },
  { k: 'nyilas', nev: 'Ablakok, ajtók', szin: '#0EA5E9' },
  { k: 'padlo', nev: 'Padló', szin: '#15803D' },
  { k: 'fodem', nev: 'Födém', szin: '#7C3AED' },
  { k: 'teto', nev: 'Tető', szin: '#92400E' },
  { k: 'tetoablak', nev: 'Tetőablakok', szin: '#DB2777' },
];
const KAT_NEV: Record<string, string> = { kondicionalt: 'fűtött', erosen_kapcsolt: 'erősen kapcsolt', gyengen_kapcsolt: 'fűtetlen' };
/** Helyiségenként váltakozó színek (a szomszédos darabok megkülönböztethetők). */
type Szerep = 'futott' | 'erosen' | 'futetlen' | 'szomszed' | 'kulter';
const SZEREPEK: { ertek: Szerep; nev: string; szin: string }[] = [
  { ertek: 'futott', nev: 'Fűtött', szin: '#F97316' },
  { ertek: 'erosen', nev: 'Fűtetlen, lakótéren belüli', szin: '#FBBF24' },
  { ertek: 'futetlen', nev: 'Fűtetlen tér (b tényezővel)', szin: '#3B82F6' },
  { ertek: 'szomszed', nev: 'Szomszéd épület / nem számított', szin: '#9CA3AF' },
  { ertek: 'kulter', nev: 'Kültér', szin: '#22C55E' },
];
const SZEREP_SZIN = Object.fromEntries(SZEREPEK.map((x) => [x.ertek, x.szin])) as Record<Szerep, string>;
/**
 * A rajzon helyiségként fel nem ismert terület (a kattintott ponttól elárasztva, fal és nyílás nélkül) melletti, bizonytalan
 * túloldalú falszakaszok kulcsai („raszterindex|szakaszindex”) – ezek jelölhetők külső falnak (a terület kültér).
 */
function teruletKulcsok(r: Raszter, cx: number, cy: number): string[] {
  const { w, h } = r; const T = new Uint8Array(w * h); const sor = [cy * w + cx]; T[sor[0]!] = 1;
  for (let k = 0; k < sor.length && sor.length < 600000; k++) {
    const q = sor[k]!, x = q % w;
    for (const n of [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, q - w, q + w]) if (n >= 0 && n < w * h && !T[n] && r.cimke[n] === 0 && !r.fal[n] && !r.nyilas[n]) { T[n] = 1; sor.push(n); }
  }
  // a terület 0,8 m-rel tágítva (a fal vastagságán át a helyiség felőli szakaszpontokig)
  const R = Math.max(1, Math.round(0.8 / r.px)); const A = new Uint8Array(w * h), B = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) { let utolso = -1e9; for (let x = 0; x < w; x++) { if (T[y * w + x]) utolso = x; if (x - utolso <= R) A[y * w + x] = 1; } utolso = 1e9; for (let x = w - 1; x >= 0; x--) { if (T[y * w + x]) utolso = x; if (utolso - x <= R) A[y * w + x] = 1; } }
  for (let x = 0; x < w; x++) { let utolso = -1e9; for (let y = 0; y < h; y++) { if (A[y * w + x]) utolso = y; if (y - utolso <= R) B[y * w + x] = 1; } utolso = 1e9; for (let y = h - 1; y >= 0; y--) { if (A[y * w + x]) utolso = y; if (utolso - y <= R) B[y * w + x] = 1; } }
  const ptPx = r.mPerPt / r.px; const ki: string[] = [];
  r.helyisegek.forEach((H, ri) => H.szakaszok.forEach((sg, j) => {
    if (sg.tul !== 'ismeretlen' || sg.hossz < 0.3) return;
    const be = sg.pontok.filter(([x, y]) => { const gx = Math.floor((x - r.x0) * ptPx), gy = Math.floor((y - r.y0) * ptPx); return gx >= 0 && gy >= 0 && gx < w && gy < h && B[gy * w + gx]; }).length;
    if (be >= Math.max(1, 0.5 * sg.pontok.length)) ki.push(`${ri}|${j}`);
  }));
  return ki;
}
/** A kültérnek jelölt helyiségek raszterindexei (a feléjük eső fal külső fal). */
const HELY_SZINEK = ['#2563EB', '#16A34A', '#DC2626', '#9333EA', '#EA580C', '#0891B2', '#CA8A04', '#DB2777', '#4F46E5', '#65A30D'];
const NYILAS_SZIN: Record<string, string> = { ablak: '#0EA5E9', erkelyajto: '#6366F1', bejarati_ajto: '#B45309', bejarati_uvegajto: '#B45309', garazskapu: '#475569', fuggonyfal: '#06B6D4', belso_ajto: '#9CA3AF', falfulke: '#9CA3AF' };
const hexRgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
/**
 * A raszter egy rétege képként (átlátszó, halvány kitöltés + erős körvonal): `szin(k)` a rácspont színe (null: üres).
 * A kép a lap koordinátáiban: bal felső sarka (x0, y0), mérete w·px/mPerPt × h·px/mPerPt pt.
 */
function raszterReteg(r: Raszter, szin: (k: number) => string | null): string {
  try {
    const c = document.createElement('canvas'); c.width = r.w; c.height = r.h;
    const ctx = c.getContext('2d'); if (!ctx) return '';
    const kep = ctx.createImageData(r.w, r.h); const d = kep.data;
    const gy = new Map<string, [number, number, number]>();
    const sz = new Array<string | null>(r.w * r.h);
    for (let k = 0; k < r.w * r.h; k++) sz[k] = szin(k);
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
      const k = y * r.w + x; const s = sz[k]; if (!s) continue;
      let rgb = gy.get(s); if (!rgb) { rgb = hexRgb(s); gy.set(s, rgb); }
      const hatar = x === 0 || y === 0 || x === r.w - 1 || y === r.h - 1 || sz[k - 1] !== s || sz[k + 1] !== s || sz[k - r.w] !== s || sz[k + r.w] !== s;
      d[k * 4] = rgb[0]; d[k * 4 + 1] = rgb[1]; d[k * 4 + 2] = rgb[2]; d[k * 4 + 3] = hatar ? 235 : 60;
    }
    ctx.putImageData(kep, 0, 0);
    return c.toDataURL('image/png');
  } catch { return ''; }
}
/** Sokszög területe (pt² → m²). */
const poligonTerulet = (q: [number, number][], mPerPt: number) => Math.abs(q.reduce((t, [x, y], i) => { const [x2, y2] = q[(i + 1) % q.length]!; return t + x * y2 - x2 * y; }, 0)) / 2 * mPerPt * mPerPt;

const IRANY_SZIN: Record<number, string> = { 0: '#A16207', 90: '#2E6DB4', 180: '#15803D', 270: '#A21CAF' };
const IRANY_NEV: Record<number, string> = { 0: 'lapon fent', 90: 'lapon jobbra', 180: 'lapon lent', 270: 'lapon balra' };
import { alaprajzFeldolgozHatter, pdfLapokHatter } from '../terv/hatter';
import { elemAlakok } from '@terv/forrasAlak';
import { AZ_TAJ, kulterRaszter, norm, futottRiK, padloigTetoter, pecsetPontok, kulsoKozelE, alapKijeloles, BEJARATI_H, burokNyilasok, eszakHomGy, homlokzatGy, nezetGy, homlokzatNezetTar, homlokzatRajzTar, burokAutoGy, burokAutoTar, nevFeliratok, vartTer, burok3dTar, burok3dCache, elemzesLap, burokFalGy, burokFalakAuto, ferdeModell, lapKategoriak, burokNyilasokPt, atvetelReszek, tervbolFuggo, homMagGy, type Kijeloles, type BurokFalAuto , tervFolyamat, SZINT_SOR, kerdesKulcs, nyilasMeretAlkalmaz, type ModellKezi } from '../terv/folyamat';
export { tervbolFuggo } from '../terv/folyamat';

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
  const F = tervFolyamat({ get lapok() { return lapok; }, get elemzesek() { return elemzesek; }, get kijelolesek() { return kijelolesek; }, get szintKi() { return szintKi; }, get kihagyLap() { return kihagyLap; },
    get eszakKulon() { return eszakKulon; }, get eszakKozos() { return eszakKozos; }, get futottValasz() { return futottValasz; }, get mindFutott() { return mindFutott; }, get reszKod() { return reszKod; },
    get bm() { return bm; }, get me() { try { return me; } catch { return null; } /* (a metszet a render későbbi részén áll elő – előtte nincs) */ }, get terdfalKezi() { return terdfalKezi; }, get homlokzatLapok() { return homlokzatLapok; }, get modellKezi() { return modellKezi; } });
  const { reszKizar, masSzintKizar, kjVeg, lapSzintek, kimarad, eszakHomSajat, eszakHom, eszakFelismert, eszakLap, mert3d, homMag3d, elMagFv, oromok, homMagModell, szobaMagassag } = F;
  void eszakHomSajat; void eszakHom; void reszKizar; void masSzintKizar;
  // beolvasáskor eldöntendő kérdések: a fűtetlennek javasolt helyiségek (garázs, pince, padlás…) fűtöttek-e, és a
  // szomszédos épület fűtött-e – a válasz minden lapra érvényes (a soronkénti kézi besorolás elsőbbséget élvez)
  const [futottValasz, setFutottValasz] = useState<Record<string, boolean>>({});
  const [szomszedFutott, setSzomszedFutott] = useState(true);
  /** Átvétel előtti kérdések modális ablaka: a megerősítés után futó átvétel. */
  const [kerdesAblak, setKerdesAblak] = useState<null | 'osszes' | 'egy'>(null);
  /** Átvétel előtt: ha van eldöntendő kérdés, modális ablakban (a képernyő közepén) kérdezünk, különben azonnal. */
  const kerdezveAtvesz = (mi: 'osszes' | 'egy') => { if (eldontendoKerdesek()) setKerdesAblak(mi); else if (mi === 'osszes') osszesAtvesz(); else atvesz(); };
  const [rrKi, setRrKi] = useState<Record<string, boolean>>({});
  /** A felhasználó által megadott szerep (a nem hőburokként azonosított rétegrend is beolvasható). */
  const [rrSzerep, setRrSzerep] = useState<Record<string, RrSzerep>>({});
  /** Rétegenkénti kézi javítás a beolvasáskor (rétegrendkód → rétegindex): átvétel be/ki, anyag, vastagság. */
  type RetegKezi = { be?: boolean; anyagId?: string; leg?: boolean; dCm?: number };
  const anyagKategoriak = useMemo(() => [...new Set(anyagLista().map((a) => a.kategoria))], []);
  const [rrRetegKezi, setRrRetegKezi] = useState<Record<string, Record<number, RetegKezi>>>({});
  const retegKeziAllit = (kod: string, j: number, v: RetegKezi) => setRrRetegKezi((m) => ({ ...m, [kod]: { ...(m[kod] ?? {}), [j]: { ...(m[kod]?.[j] ?? {}), ...v } } }));
  /** A beolvasott réteg a kézi javítással. */
  const retegKezivel = <T extends { kimarad?: string; anyagId?: string; dCm: number; legreteg?: 'zart' | 'intenziv'; nev?: string; lambda?: number }>(kod: string, j: number, r: T): T => {
    const k = rrRetegKezi[kod]?.[j]; if (!k) return r;
    const u: T = { ...r };
    if (k.be === false) u.kimarad = 'kézzel kizárva'; else if (k.be === true) delete u.kimarad;
    if (k.leg) { delete u.anyagId; delete u.lambda; u.legreteg = 'zart'; u.nev = 'Zárt légréteg'; }
    else if (k.anyagId) { u.anyagId = k.anyagId; delete u.legreteg; delete u.lambda; delete u.nev; }
    if (k.dCm !== undefined) u.dCm = k.dCm;
    return u;
  };
  const [bm, setBm] = useState<number | undefined>(undefined);
  const [szintszam, setSzintszam] = useState<number | undefined>(undefined);
  const [csere, setCsere] = useState(true);
  const [kesz, setKesz] = useState<string[] | null>(null);
  const [nagyit, setNagyit] = useState(true);
  /** A bekapcsolt felismerési rétegek (ellenőrzéshez). */
  const [retegek, setRetegek] = useState<Set<RetegKulcs>>(new Set(['burok', 'helyiseg']));
  /** A rajzon kattintással kiválasztott helyiség (a helyiséglistában kiemelve). */
  const [kivH, setKivH] = useState<number | null>(null);
  useEffect(() => setKivH(null), [aIdx]);
  /** Az alaprajz-ablak nézete: 2D (a rajz a felismert elemekkel) vagy 3D (a hőburok térben). */
  const [nezet3d, setNezet3d] = useState(false);
  // a 2D / 3D nézet görgetéskor a képernyő tetején marad (a listák alatta görgethetők, a nyílás, fal rákattintással ellenőrizhető)
  const [rogzit, setRogzit0] = useState(() => { try { return localStorage.getItem('ekm-nezo-rogzit') !== '0'; } catch { return true; } });
  // (keskenyebb képernyőn az eredménysáv a lap tetején ragad: a rögzített nézet alatta)
  useEffect(() => {
    const allit = () => { const e = document.querySelector('.eredmenysav') as HTMLElement | null; const cs = e ? getComputedStyle(e) : null;
      const m = e && cs && cs.position === 'sticky' && cs.flexDirection === 'row' ? e.getBoundingClientRect().height : 0;
      document.documentElement.style.setProperty('--fejlec-mag', `${Math.round(m)}px`); };
    allit(); window.addEventListener('resize', allit); const t = window.setInterval(allit, 2000);
    return () => { window.removeEventListener('resize', allit); window.clearInterval(t); };
  }, []);
  const setRogzit = (v: boolean) => { setRogzit0(v); try { localStorage.setItem('ekm-nezo-rogzit', v ? '1' : '0'); } catch { /* */ } };
  /** A 3D modell méretezése: belső (alap – a fal belső síkjai, belmagasság) vagy külső (a hőszigetelés külső síkja, szintmagasság). */
  // a 3D modellben / a listában / a 2D rajzon kijelölt nyílászáró (lap, al.nyilasok-index)
  const [kivNy, setKivNy] = useState<{ lap: number; ny: number } | null>(null);
  /** a teljes 3D modell (a kijelölt nyílás áthidalójához – a modell a nézet felett épül) */
  const epMdRef = useRef<EpuletModell | null>(null);
  const [meretMod, setMeretMod] = useState<'belso' | 'kulso'>(() => { try { return localStorage.getItem('ekm-meretmod') === 'kulso' ? 'kulso' : 'belso'; } catch { return 'belso'; } });
  useEffect(() => { try { localStorage.setItem('ekm-meretmod', meretMod); } catch { /* */ } }, [meretMod]);
  const retegValt = (k: RetegKulcs) => setRetegek((x) => { const y = new Set(x); if (y.has(k)) y.delete(k); else y.add(k); return y; });
  const [pecsetBe, setPecsetBe] = useState(true);
  const [padloAt, setPadloAt] = useState(true);
  const [tetoAt, setTetoAt] = useState(true);
  const [mintaFajta, setMintaFajta] = useState<'panel' | 'blokkos' | null>(null);
  /** Lapindex → az alaprajz által ábrázolt szintek (alapból a lap címéből). */
  const [szintKi, setSzintKi] = useState<Record<number, string[]>>({});
  const [atvett, setAtvett] = useState<Set<number>>(new Set());
  /** Lapindex → a háttérben elkészült alaprajz-feldolgozás (vagy hibaüzenet). */
  const [elemzesekNyers, setElemzesek] = useState<Record<number, AlaprajzFeldolgozas | string>>({});
  // az elemzések a kézzel átírt nyílásméretekkel (Kijeloles.nyMeret) – a lista, a 2D és a 3D nézet, az átvétel is ezt látja
  const elemzesek = useMemo(() => {
    const o: Record<number, AlaprajzFeldolgozas | string> = {};
    for (const [k, v] of Object.entries(elemzesekNyers)) o[Number(k)] = typeof v === 'string' ? v : nyilasMeretAlkalmaz(v, kijelolesek[Number(k)]?.nyMeret);
    return o;
  }, [elemzesekNyers, kijelolesek]);
  // a lakásonkénti / épületszintű jegyzék a másik szint helyiségeit is felsorolja: a más alaprajzlapon pecséttel
  // szereplő (kódú, ill. kód nélkül azonos nevű és területű) sor nem „csak a jegyzékben” szereplő helyiség – a
  // figyelmeztetés számából kimarad (csak a kiírásban; az elemzés objektuma változatlan)
  const lapFigy = useMemo(() => {
    const kn = (q?: string) => (q ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const nt = (h: { nev: string; A: number }) => `${h.nev.toLowerCase().trim()}|${h.A.toFixed(2)}`;
    const pecsetKod = new Map<number, Set<string>>();
    for (const [k, v] of Object.entries(elemzesek)) if (typeof v === 'object') pecsetKod.set(Number(k), new Set(v.e.helyisegek.filter((h) => h.forras === 'pecset').map((h) => (h.kod ? kn(h.kod) : nt(h)))));
    const ki = new Map<number, string[]>();
    for (const [k, v] of Object.entries(elemzesek)) {
      if (typeof v !== 'object') continue;
      const figy = [...v.e.figyelmeztetesek]; ki.set(Number(k), figy);
      const fi = figy.findIndex((x) => /helyiség csak a jegyzékben szerepel/.test(x)); if (fi < 0) continue;
      const mas = (h: { kod?: string; nev: string; A: number }) => [...pecsetKod].some(([j, s]) => j !== Number(k) && ((!!h.kod && s.has(kn(h.kod))) || s.has(nt(h))));
      const db = Number(/^(\d+)/.exec(figy[fi]!)?.[1] ?? 0), le = v.e.helyisegek.filter((h) => h.forras === 'jegyzek' && mas(h)).length;
      if (!le) continue;
      if (db - le > 0) figy[fi] = figy[fi]!.replace(/^\d+/, String(db - le)); else figy.splice(fi, 1);
    }
    return ki;
  }, [elemzesek]);
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
      // (ZIP-ben érkező tervlapok: a .pdf bejegyzések kibontva)
      const fl: File[] = [];
      for (const f of Array.from(fajlok)) {
        if (/\.zip$/i.test(f.name) || f.type === 'application/zip' || f.type === 'application/x-zip-compressed') {
          setFolyamat(`${f.name} kibontása…`);
          try { const pp = await zipPdfek(f); if (!pp.length) setHiba(`${f.name}: a ZIP-ben nincs PDF.`); fl.push(...pp); }
          catch (e) { setHiba(`${f.name}: a ZIP nem bontható ki (${(e as Error)?.message ?? e}).`); }
        } else fl.push(f);
      }
      for (const [fi, f] of fl.entries()) {
        if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { setHiba(`${f.name}: csak PDF tervlap olvasható be.`); continue; }
        setFolyamat(`${f.name} beolvasása…`);
        const ll = await pdfLapokHatter(f, 2000, (k, o) => setHalad({ arany: (fi + (o ? k / o : 0)) / fl.length, szoveg: `${fi + 1}. / ${fl.length} fájl beolvasása: ${f.name}${o > 1 ? ` (${k}/${o}. oldal)` : ''}` }));
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
  const alaprajzLapok = lapok.map((l, i) => ({ l, i })).filter(({ l }) => l.szerep === 'alaprajz');
  const homlokzatLapok = useMemo(() => lapok.map((l, i) => ({ l, i })).filter(({ l }) => l.szerep === 'homlokzat'), [lapok]);
  // át nem vett, átvételre jelölt alaprajzok: a lépés elhagyása / az oldal bezárása előtt figyelmeztetünk
  tervbolFuggo.lapok = alaprajzLapok.filter(({ i }) => !atvett.has(i) && !kimarad(i)).length;
  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => { if (tervbolFuggo.lapok > 0) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', f);
    return () => { window.removeEventListener('beforeunload', f); tervbolFuggo.lapok = 0; };
  }, []);
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
  // a műszaki leírás(ok) helyiséglistája – a helyiségpecsét nélküli alaprajzhoz
  const leirasJegyzek = useMemo(() => lapok.filter((l) => l.szerep === 'leiras').flatMap((l) => jegyzekSorok(l.lap.szovegek)), [lapok]);
  // (háttérszálon – a felület közben él, a haladás és az eltelt idő látszik)
  const [elemzesHalad, setElemzesHalad] = useState<{ lap: number; szoveg: string; kezd: number } | null>(null);
  const [, setOra] = useState(0);
  useEffect(() => { if (!elemzesHalad) return; const t = window.setInterval(() => setOra((x) => x + 1), 1000); return () => window.clearInterval(t); }, [elemzesHalad?.lap]);
  const futoElemzes = useRef<TervLap | null>(null);
  const lapokRef = useRef(lapok); lapokRef.current = lapok;
  useEffect(() => {
    const kov = lapok.findIndex((l, i) => l.szerep === 'alaprajz' && elemzesek[i] === undefined);
    if (kov < 0) { setElemzesHalad(null); return; }
    const l = lapok[kov]!;
    if (futoElemzes.current === l) return; // (már fut – az újrarajzolás nem indítja újra)
    futoElemzes.current = l;
    setElemzesHalad({ lap: kov, szoveg: 'indul', kezd: Date.now() });
    // (az eredmény csak akkor kerül be, ha a lap közben nem változott – törlés, csere)
    const ervenyes = () => lapokRef.current[kov] === l;
    alaprajzFeldolgozHatter([l.lap, undefined, l.szurke, l.tinta, leirasJegyzek, kijelolesek[kov]?.plusz], (szoveg) => setElemzesHalad((h) => (h && h.lap === kov ? { ...h, szoveg } : h)))
      .then((ered) => { if (futoElemzes.current === l) futoElemzes.current = null; if (!ervenyes()) return; elemzesLap.set(ered, l.lap); setElemzesek((x) => ({ ...x, [kov]: ered })); },
        (e: Error) => { if (futoElemzes.current === l) futoElemzes.current = null; if (!ervenyes()) return; setElemzesek((x) => ({ ...x, [kov]: e.message })); });
  }, [lapok, elemzesek]);
  const keszElemzes = aIdx >= 0 && typeof elemzesek[aIdx] === 'object' ? elemzesek[aIdx] as AlaprajzFeldolgozas : null;
  const kezi = useMemo(() => (aLap && meretarany ? alaprajzFeldolgoz(aLap.lap, meretarany, aLap.szurke, aLap.tinta, leirasJegyzek) : null), [aLap, meretarany, leirasJegyzek]);
  const al = kezi ?? keszElemzes;
  // kézi méretarány: új felismerés – a lap kijelölése újraindul
  useEffect(() => { if (kezi) setKijelolesek((m) => { const u = { ...m }; delete u[aIdx]; return u; }); }, [kezi]);
  const kijeloles = (i: number, a: AlaprajzFeldolgozas): Kijeloles => kjVeg(i, a);
  /** Pecsét nélküli zárt terület (pl. lépcső) felvétele fűtött helyiségként: a lap újrafelismerése a kattintott ponttal
   *  mint helyiségmaggal (a meglévő helyiségek sorszáma nem változik – az új a lista végére kerül). */
  const pluszFelvesz = (nev: string, x: number, y: number) => {
    const l = lapok[aIdx]; if (!l || l.szerep !== 'alaprajz') return;
    const pl = [...(kijelolesek[aIdx]?.plusz ?? []), { x, y, nev }];
    let ered: AlaprajzFeldolgozas; try { ered = alaprajzFeldolgoz(l.lap, meretarany, l.szurke, l.tinta, leirasJegyzek, pl); } catch { return; }
    elemzesLap.set(ered, l.lap);
    const uj = ered.e.helyisegek.length - 1;
    setElemzesek((x0) => ({ ...x0, [aIdx]: ered }));
    setKijelolesek((m) => { const k0 = m[aIdx] ?? alapKijeloles(ered); const kz = new Set(k0.kizartH); kz.delete(uj); return { ...m, [aIdx]: { ...k0, kizartH: kz, plusz: pl, kat: { ...k0.kat, [uj]: 'kondicionalt' } } }; });
  };
  const kj: Kijeloles = al ? kijeloles(aIdx, al) : { egysegek: new Set(), kizartH: new Set(), kat: {}, kizartNy: new Set() };
  const { egysegek, kizartH, kat, kizartNy } = kj;
  const kjMod = (fn: (k: Kijeloles) => Kijeloles) => { if (!al) return; const a = al, i = aIdx; setKijelolesek((m) => ({ ...m, [i]: fn(m[i] ?? alapKijeloles(a)) })); };
  const kjModLap = (i: number, fn: (k: Kijeloles) => Kijeloles) => { const a = elemzesekNyers[i]; if (!a || typeof a === 'string') return; setKijelolesek((m) => ({ ...m, [i]: fn(m[i] ?? alapKijeloles(a)) })); };
  /** Nyílásméret kézi átírása (m); null: vissza a felismertre. */
  const nyMeretAllit = (lap: number, ny: number, x: { szel: number; mag: number; pm: number | null; athidalo?: 'monolit' | 'eloregyartott' } | null) => kjModLap(lap, (k) => {
    const m = { ...(k.nyMeret ?? {}) }; if (x) m[ny] = x; else delete m[ny]; return { ...k, nyMeret: m };
  });
  /** A kijelölt nyílás (az átírt mérettel) és a felismert eredetije. */
  const kivNyAdat = (() => {
    if (!kivNy) return null; const a = elemzesek[kivNy.lap], a0 = elemzesekNyers[kivNy.lap]; if (!a || typeof a === 'string' || !a0 || typeof a0 === 'string') return null;
    const vesz = (x: AlaprajzFeldolgozas): TervNyilas | undefined => (kivNy.ny >= 20000 ? x.modellAjtok?.[kivNy.ny - 20000] : kivNy.ny >= 10000 ? x.arvaFeliratok?.[kivNy.ny - 10000] as TervNyilas | undefined : x.nyilasok[kivNy.ny]);
    const n = vesz(a), n0 = vesz(a0);
    // (az áthidaló a teljes modell szerint – csak a koszorús szint teherhordó falában)
    const mn = epMdRef.current?.nyilasok.find((q) => q.forras?.lap === kivNy.lap && q.forras?.ny === kivNy.ny);
    return n && n0 ? { n, n0, kezi: !!kijelolesek[kivNy.lap]?.nyMeret?.[kivNy.ny], ...(mn?.athidalo ? { athidalo: mn.athidalo } : {}) } : null;
  })();
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
  // tetőtéri alaprajz (a lap címe „Tetőtér…”) és a metszeten szögfelirat nélküli, de rajzolt magastető: tetőtér a
  // metszet ferde tetővonalaiból mért hajlással (a térdfal a kérdésre adott válaszból)
  const ttLap = lapok.some((l) => l.szerep === 'alaprajz' && szintekCimbol(l.cim ?? '').includes('T'));
  const me0 = useMemo(() => {
    const m = mLap ? metszetFeldolgoz(mLap.lap) : null;
    if (m && !m.tetoter && m.tetoHajlas && ttLap) return { ...m, tetoter: { hajlas: m.tetoHajlas, terdfal: null, terdfalTipp: null, belmagassag: null, padlo: m.szintek.padlo.at(-1) ?? null } };
    return m;
  }, [mLap, ttLap]);
  /** A térdfal magassága kézzel (az átvételi kérdésben), ha a metszeten nincs térdfal-felirat. */
  const [terdfalKezi, setTerdfalKezi] = useState<number | undefined>(undefined);
  /** A teljes épületmodell kézi paraméterei (tetőhajlás, ereszkiállás, oromfal / konty, szintenkénti belmagasság). */
  const [modellKezi, setModellKezi] = useState<ModellKezi>({});
  const [parNyitva, setParNyitva] = useState(false);
  const [modell3d, setModell3d] = useState<'teljes' | 'burok'>('teljes');
  /** A felhasználó szerint a legfelső szint nem tetőtér (a kérdés nem jelenik meg újra). */
  const [nemTetoter, setNemTetoter] = useState(false);
  // a metszet tetőtér-adatai a kézi térdfallal: felirat > kézi (a kérdésre adott válasz); megadás nélkül a térdfal nem
  // ismert – a tetőtér falai teljes belmagasságúak (a becsült érték csak javaslat a kérdésben)
  const me = useMemo(() => (me0?.tetoter ? { ...me0, tetoter: { ...me0.tetoter, terdfal: me0.tetoter.terdfal ?? terdfalKezi ?? null } } : me0), [me0, terdfalKezi]);
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
    setRrRetegKezi({}); setRrKi(Object.fromEntries(me.blokkok.map((b) => [b.rr.kod, !!b.becsles.szerep && !b.becsles.kihagy])));
    setBm(me.szintek.belmagassag[0]); setSzintszam(me.szintek.szintszam);
  }, [me]);
  // metszet (belmagasság) nélkül a helyiségpecsétek belmagassága („bm: 2,90 m”), ha egységes – kézi érték felülírja
  useEffect(() => {
    if (me?.szintek.belmagassag.length) return;
    const v = pecsetBelmagassag(lapok.filter((l) => l.szerep === 'alaprajz'));
    if (v !== undefined) setBm((b) => b ?? v);
  }, [lapok, me]);

  const helyisegek = al?.e.helyisegek ?? [];
  const raszterIdx = (i: number) => (al ? al.magHelyisegek.indexOf(helyisegek[i]!) : -1);
  const egysegben = (i: number) => !al?.e.egysegek.length || !helyisegek[i]!.egyseg || egysegek.has(helyisegek[i]!.egyseg!);
  const valasztott = helyisegek.map((h, i) => egysegben(i) && !h.kulter && !kizartH.has(i) && !kj.kulterH?.has(i));
  const kategoria = (i: number): HelyisegKategoria => kat[i] ?? (mindFutott ? 'kondicionalt' : kategoriaJavaslat(helyisegek[i]!.nev, helyisegek[i]!.A) ?? 'kondicionalt');
  const kulterRiC = al ? kulterRaszter(al, kj) : new Set<number>();
  const falak = (i: number) => {
    const ri = raszterIdx(i); if (!al?.r || ri < 0) return [];
    return al.r.helyisegek[ri]!.szakaszok.filter((s, j) => ((s.tul === 'kulso' && !s.szomszed) || (s.tul === 'ismeretlen' && !!kj.ismKulso?.has(`${ri}|${j}`)) || (typeof s.tul === 'number' && kulterRiC.has(s.tul))) && s.hossz >= 0.3);
  };
  /** A helyiség szerepe a hőburokban: fűtött, fűtetlen (lakótéren belüli / b-tényezős), szomszéd épület (nem számított), kültér. */
  const szerep = (i: number): Szerep => (helyisegek[i]?.kulter || kj.kulterH?.has(i) ? 'kulter' : !egysegben(i) || kizartH.has(i) ? 'szomszed' : kategoria(i) === 'kondicionalt' ? 'futott' : kategoria(i) === 'erosen_kapcsolt' ? 'erosen' : 'futetlen');
  const setSzerep = (i: number, v: Szerep) => { kjMod((k) => {
    const kizart = new Set(k.kizartH), kulter = new Set(k.kulterH ?? []), kt = { ...k.kat };
    kizart.delete(i); kulter.delete(i);
    if (v === 'szomszed') kizart.add(i); else if (v === 'kulter') kulter.add(i);
    else kt[i] = v === 'futott' ? 'kondicionalt' : v === 'erosen' ? 'erosen_kapcsolt' : 'gyengen_kapcsolt';
    return { ...k, kizartH: kizart, kulterH: kulter, kat: kt };
  }); };
  /** A rajzon kattintással megnyitott besorolás-menü (a rajz-konténerhez viszonyított helyen). */
  const [menu, setMenu] = useState<{ i: number; x: number; y: number; kulcsok?: string[]; px?: number; py?: number } | null>(null);
  useEffect(() => setMenu(null), [aIdx]);
  // hőburok-körvonal: a felismert (fűtött helyiségek összevonva), vagy a felhasználó által szerkesztett
  const futottKulcs = al ? [...futottRiK(al, kj)].sort((a, b) => a - b).join(',') : '';
  // a megjelenített (és szerkesztésre átadott) hőburok a fal külső síkján: hőszigetelés külső felülete / vastag fal külső síkja
  const burokFelismert = useMemo(() => (al?.r ? burokTomeg(al.r, futottRiK(al, kj), aLap ? nevFeliratok(aLap.lap) : undefined, vartTer(al)) : []), [al, futottKulcs]);
  const [burokVazlat, setBurokVazlat] = useState<Poligon[] | null>(null);
  const [burokSzerk, setBurokSzerk] = useState(false);
  /** Húzás: a p. körvonal v. pontja; `el`: a v → v+1 él párhuzamos eltolása (a kezdőpont és az eredeti körvonal). */
  const [huz, setHuz] = useState<{ p: number; v: number; el?: { kezd: [number, number]; orig: Poligon[] } } | null>(null);
  /** Húzás végén egy másik pontra ejtett pont: összevonás kérdése (a mentés a válaszig vár). */
  const [osszevon, setOsszevon] = useState<{ b: Poligon[]; p: number; v: number; w: number } | null>(null);
  /** Húzás közben a fogott pont / él (kiemeléshez és az összevonáshoz). */
  const huzIdo = useRef(0);
  const [fogas, setFogas] = useState<{ x: number; y: number; tipus: 'pont' | 'el' } | null>(null);
  /** Kézi hőburok-rajzolás: a lerakott pontok (pt); null: nincs rajzolás. */
  const [rajzol, setRajzol] = useState<[number, number][] | null>(null);
  const burok = burokVazlat ?? osszevon?.b ?? kj.burok ?? burokFelismert;
  // a körvonal élei a valódi falsávhoz illesztve: belső sík, hossz, vastagság (a rajzolt / felismert vonal csak irány)
  const burokMert = useMemo(() => (al?.r && !burokVazlat ? burokMeres(al.r, burok) : []), [al, burok, burokVazlat]);
  try { (globalThis as any).__burokMert = () => ({ felismert: burokFelismert, burok, mert: burokMert }); } catch { /* */ }
  // ÖNELLENŐRZÉS (Balázs, 2026-11-22: „olyan algoritmus a végén, ami nagyrészt jól ismeri fel az épületet"): a felismerés
  // a végén megvizsgálja a saját eredményét – ami gyanús, az itt, helyével együtt, ellenőrzésre jelölve
  const onellenorzes = useMemo(() => {
    const ki: { szoveg: string; sulyos: boolean }[] = [];
    if (!al?.r) return ki;
    const r = al.r;
    // 1. hőburok fal nélkül
    const nf = burokMert.flat().filter((e) => e.rajzolt >= 0.8 && e.lefedett < 0.3);
    const nfL = nf.reduce((t, e) => t + e.rajzolt, 0), osszL = burokMert.flat().reduce((t, e) => t + e.rajzolt, 0);
    if (nfL >= 1) ki.push({ sulyos: nfL >= 0.1 * osszL || nf.some((e) => e.rajzolt >= 3), szoveg: `A hőburok ${sz(nfL, 1)} m-en fal nélkül fut (${nf.length} él, piros a rajzon) – a hőburok ott a rajz vonalai (méretvonal, telekhatár, keret) mentén mehet: húzd a falra, vagy rajzold újra.` });
    // 2. a hőburok a lap szélén / keretén
    const lw = (aLap?.lap.szel ?? 0), lh = (aLap?.lap.mag ?? 0);
    if (lw > 0 && burok.some((q) => q.some(([x, y]) => x < 0.03 * lw || x > 0.97 * lw || y < 0.03 * lh || y > 0.97 * lh)))
      ki.push({ sulyos: true, szoveg: 'A hőburok a lap széléig / a rajzkeretig ér – a felismerés kifolyt a rajzból (északjel, keret, szövegmező is benne lehet).' });
    // 3. helyiségek: a rajzi terület (raszter) és a felirat eltérése
    const elt: string[] = [];
    helyisegek.forEach((h, i) => { if (h.kulter) return; const ri = raszterIdx(i); if (ri < 0) { if (szerep(i) === 'futott') elt.push(`${h.nev} (nincs a rajzon)`); return; }
      const Ar = r.helyisegek[ri]!.A; if (Math.abs(Ar - h.A) > Math.max(1, 0.2 * h.A)) elt.push(`${h.nev} ${sz(h.A, 1)} → ${sz(Ar, 1)} m²`); });
    if (elt.length) ki.push({ sulyos: elt.length >= 3, szoveg: `${elt.length} helyiség rajzi területe érdemben eltér a feliratától (a fal / nyílás felismerése ott hibás lehet): ${elt.slice(0, 6).join('; ')}${elt.length > 6 ? ' …' : ''}.` });
    // 4. lépték: a lapra írt és a méretláncok szerinti eltér
    if ((al.e.figyelmeztetesek ?? []).some((f) => /kicsinyítve|nagyítva|méretláncokból kalibrálva/.test(f))) ki.push({ sulyos: false, szoveg: 'A lépték a méretláncokból kalibrálva (a lapra írt eltér, vagy nincs) – egy ismert méreten érdemes ellenőrizni.' });
    return ki;
  }, [al, burok, burokMert, helyisegek, kj]);
  const [aiTokenAll, setAiTokenAll] = useState(() => !!aiToken());
  const [aiTokenBe, setAiTokenBe] = useState('');
  const [ai, setAi] = useState<{ fut: boolean; valasz?: AiValasz | null; nyers?: string; hiba?: string; kiv?: { nezet: [number, number, number, number]; W: number; H: number } } | null>(null);
  useEffect(() => setAi(null), [aIdx]);
  const aiFuttat = async () => {
    const svg = document.querySelector('svg[aria-label="Az alaprajz a felismert elemekkel"]') as SVGSVGElement | null;
    if (!svg || !al?.r || !burok.length) { setAi({ fut: false, hiba: 'Nincs rajz / hőburok az ellenőrzéshez.' }); return; }
    setAi({ fut: true });
    try {
      const xs = burok.flat().map((q) => q[0]), ys = burok.flat().map((q) => q[1]), m = 3 / al.r.mPerPt;
      const x0 = Math.min(...xs) - m, y0 = Math.min(...ys) - m, x1 = Math.max(...xs) + m, y1 = Math.max(...ys) + m;
      const kn: [number, number, number, number] = [x0, y0, x1 - x0, y1 - y0];
      const kep = await svgKivagatPng(svg, kn);
      // (a kép mérete – mint az svgKivagatPng-ben: a hosszabbik oldal 1600 képpont –; az AI „hely” képpontjai ebben)
      const ar = kn[2] / kn[3]; const kiv = { nezet: kn, W: ar >= 1 ? 1600 : Math.round(1600 * ar), H: ar >= 1 ? Math.round(1600 / ar) : 1600 };
      const kontextus = { jelzesek: onellenorzes.map((j) => j.szoveg), helyisegek: helyisegek.map((h, i) => ({ nev: h.nev, A: h.A, rajzon: raszterIdx(i) >= 0 ? Math.round(al.r!.helyisegek[raszterIdx(i)]!.A * 10) / 10 : null, futott: szerep(i) === 'futott' })) };
      const v = await aiEllenoriz(kep, kontextus);
      setAi({ fut: false, ...v, kiv });
    } catch (e) { setAi({ fut: false, hiba: `AI-ellenőrzés: ${(e as Error)?.message ?? e}` }); }
  };
  const burokMent = (b: Poligon[] | undefined) => kjMod((k) => { const u = { ...k }; if (b) u.burok = b; else delete u.burok; return u; });
  // húzás vége: ha a pont egy másik pontra került (fogási távolságon belül), kérdés: összevonjuk-e a kettőt
  const huzVege = () => {
    if (!huz) return;
    huzIdo.current = Date.now(); // a felengedés utáni „click” ne nyissa meg a helyiség-menüt
    const b = burokVazlat;
    setBurokVazlat(null); setHuz(null);
    if (!b) return;
    const f = fogas; setFogas(null);
    if (huz.el) { burokMent(b); return; }
    const q = b[huz.p]!; const [x, y] = q[huz.v]!;
    // másik pontra fogva (vagy ugyanoda ejtve): összevonás kérdése
    const w = q.findIndex(([x2, y2], j) => j !== huz.v && Math.hypot(x2 - x, y2 - y) < (f?.tipus === 'pont' ? 1e-3 : 3 * fogo));
    if (w >= 0 && q.length > 3) { setOsszevon({ b, p: huz.p, v: huz.v, w }); return; }
    burokMent(b);
  };
  const nyilasok = (al ? burokNyilasok(al, kj) : []).map(({ n, kk }) => ({ n, k: kk }))
    .map(({ n, k }) => ({ n, k, hi: helyisegek.indexOf(al!.magHelyisegek[n.helyiseg!]!) }))
    .filter(({ hi }) => hi >= 0 && valasztott[hi]);

  // felismerési rétegek: a raszter helyiségei (kategória szerinti színnel) és falai képként; a födém / tető / padló
  // a hőburok-körvonal; a tetőablakok a ferde tetősíkhoz rendelhető (falhoz nem kötött) ablakfeliratok
  const katKulcs = helyisegek.map((_, i) => szerep(i)).join(',');
  const helyisegKep = useMemo(() => {
    if (!al?.r || !retegek.has('helyiseg')) return '';
    // a helyiségek területe a hőburokbeli szerepük színével (fűtött, fűtetlen, szomszéd épület, kültér)
    const r = al.r; const szinek = al.magHelyisegek.map((h) => { const i = helyisegek.indexOf(h); return i < 0 ? null : SZEREP_SZIN[szerep(i)]; });
    // a fűtött (és lakótéren belüli) helyiség a hőburkon kívül nem látszik: a burokon túlra elárasztott rész (pl. a
    // bejárati fülke, ahová a felismerés a helyiséget kiengedte) nem a helyiség (Balázs, 2026-11-21: „hogy nyúlhat túl a
    // helyiség a fűtött burkon? ez alapszabály”)
    const benn = burok.length ? new Uint8Array(r.w * r.h) : null;
    if (benn) { const ptPx = r.mPerPt / r.px; poliRajzol(benn, r.w, r.h, burok.map((q) => q.flat()), (x, y) => [(x - r.x0) * ptPx, (y - r.y0) * ptPx]); }
    const burokban = al.magHelyisegek.map((h) => { const i = helyisegek.indexOf(h); return i >= 0 && (szerep(i) === 'futott' || szerep(i) === 'erosen'); });
    return raszterReteg(r, (k) => { const c = r.cimke[k]!; if (c < 2) return null; if (benn && burokban[c - 2] && !benn[k]) return null; return szinek[c - 2] ?? null; });
  }, [al, katKulcs, retegek.has('helyiseg'), burok]);
  const nyilasKep = useMemo(() => (al?.r && (retegek.has('nyilas') || retegek.has('helyiseg')) ? raszterReteg(al.r, (k) => (al.r!.nyilas[k] ? '#0EA5E9' : null)) : ''), [al, retegek.has('nyilas') || retegek.has('helyiseg')]);
  // falak pirossal; a külső sraffozott felület (járda, térkő, kavics – nem fal) szürkével
  // a kiválasztott helyiség kiemelése (sárga kitöltés, erős körvonal)
  const kivKep = useMemo(() => { if (!al?.r || kivH === null) return ''; const ri = al.magHelyisegek.indexOf(helyisegek[kivH]!); if (ri < 0) return ''; return raszterReteg(al.r, (k) => (al.r!.cimke[k] === ri + 2 ? '#F59E0B' : null)); }, [al, kivH]);
  const falKep = useMemo(() => { if (!al?.r || !retegek.has('fal')) return ''; const sr = kulsoSraff(al.r); return raszterReteg(al.r, (k) => (al.r!.fal[k] ? (sr[k] ? '#6B7280' : '#B91C1C') : null)); }, [al, retegek.has('fal')]);
  const tetoterLapE = aIdx >= 0 && lapSzintek(aIdx).includes('T') && !!me?.tetoter;
  // (az alaprajzon jellel rajzolt tetősík ablakok – bármely lapon; ezek híján tetőtéri lapon a falhoz nem köthető feliratok)
  const tetoablakJeloltek = (al?.r && al.tetoablakok?.length ? al.tetoablakok : al?.r && tetoterLapE ? [...(al.arvaFeliratok ?? []), ...al.nyilasok.filter((n) => !n.kulso && (n.fajta === 'falfulke' || n.fajta === 'ablak'))] : [])
    .filter((f) => f.szel >= 0.4 && f.szel <= 1.6 && f.mag >= 0.6 && f.mag <= 1.8)
    .filter((f, i, l) => l.findIndex((g) => Math.hypot(g.x - f.x, g.y - f.y) * (al?.r?.mPerPt ?? 0.035) < 0.5) === i);
  const belsoAjtok = (al?.nyilasok ?? []).filter((n) => !n.kulso).length;
  // eltérő belmagasságú épületrészek (a metszetből) – a helyiséglistában jelezve
  const szmLap = al && aIdx >= 0 && !lapSzintek(aIdx).includes('T') ? szobaMagassag(aIdx, al) : null;
  const eszakSz = eszakLap(aIdx, al);
  /** A 3D modell szintjei (a hőburok-körvonal szintenként, a választott méretezéssel) – a 3D nézethez és a modellből számolt felületekhez. */
  const modellSzintek = (mod: 'belso' | 'kulso'): Burok3DSzint[] | null => {
              const sor = alaprajzLapok.filter(({ i }) => !kimarad(i) && typeof elemzesek[i] === 'object' && (elemzesek[i] as AlaprajzFeldolgozas).r);
              if (!sor.length) return null;
              const alap = (elemzesek[sor[0]!.i] as AlaprajzFeldolgozas).r!;
              const emelet = (bm ?? 2.7) + 0.35;
              const szint3: Burok3DSzint[] = [];
              const jelen = [...new Set(sor.flatMap(({ i }) => (lapSzintek(i).length ? lapSzintek(i) : ['F'])))].sort((x, y) => SZINT_SOR.indexOf(x) - SZINT_SOR.indexOf(y));
              const nulla = jelen.indexOf('F') >= 0 ? jelen.indexOf('F') : jelen.findIndex((x) => x !== 'P');
              for (const { i } of sor) {
                const a = elemzesek[i] as AlaprajzFeldolgozas, r = a.r!, k = kijeloles(i, a);
                const el = i === sor[0]!.i ? { dx: 0, dy: 0 } : eltolas(alap, r) ?? { dx: 0, dy: 0 };
                const m = (x: number, y: number): [number, number] => [(x - el.dx) * r.mPerPt, (y - el.dy) * r.mPerPt];
                const belso = mod === 'belso';
                const r3 = a.r3d ?? r;
                // a szerkesztett hőburok a 3D-ben is: külső méretnél a körvonal, belső méretnél a mért belső falsíkok
                // eltérő belmagasságú épületrészek: magasságonként külön hasáb (a fűtött helyiségek csoportjainak burka)
                const szm3 = !k.burok && !lapSzintek(i).includes('T') ? szobaMagassag(i, a) : null;
                if (szm3) {
                  const fut = futottRiK(a, k);
                  const blokkok: { hv: number; pol: [number, number][][] }[] = [];
                  for (const hv of [...new Set([...fut].map((x) => szm3.magassag.get(x)).filter((v): v is number => v !== undefined))].sort((x, y) => y - x)) {
                    const cs = new Set([...fut].filter((x) => szm3.magassag.get(x) === hv));
                    const pp = burok3dCache(i, r3, cs, lapok[i]?.lap, a, belso); if (!pp.length) continue;
                    const pol2 = pp.map((q) => q.map(([x, y]) => m(x, y)));
                    const ny2 = burokNyilasokPt(a, k, pp).map((n) => { const [x, y] = m(n.x, n.y); return { x, y, szel: n.szel, mag: n.mag > 0 ? n.mag : n.szel >= 1.6 ? 2.4 : 1.5, pm: n.pm ?? 0 }; });
                    // (az alacsonyabb rész magasabb rész felé eső fala nem külső fal: ott a két rész csatlakozik)
                    const kozos = (A: [number, number], B: [number, number]) => blokkok.some((bl) => bl.pol.some((q) => q.some((P, j) => { const Q = q[(j + 1) % q.length]!;
                      const dx = Q[0] - P[0], dy = Q[1] - P[1], L = Math.hypot(dx, dy); if (L < 0.3) return false;
                      const d = (X: [number, number]) => Math.abs((X[0] - P[0]) * dy - (X[1] - P[1]) * dx) / L, t = (X: [number, number]) => ((X[0] - P[0]) * dx + (X[1] - P[1]) * dy) / (L * L);
                      return d(A) < 0.6 && d(B) < 0.6 && Math.min(1, Math.max(t(A), t(B))) - Math.max(0, Math.min(t(A), t(B))) > 0.6 * Math.hypot(B[0] - A[0], B[1] - A[1]) / L; })));
                    const korny = blokkok.length ? pol2.map((q) => q.map((P, j) => (kozos(P, q[(j + 1) % q.length]!) ? [[0, 1, 'belso' as const]] : [[0, 1, 'kulso' as const]]) as [number, number, 'kulso' | 'belso'][])) : undefined;
                    blokkok.push({ hv, pol: pol2 });
                    szint3.push({ nev: `${szintNev(lapSzintek(i)[0] ?? 'F')} – ${String(hv).replace('.', ',')} m belmagasságú rész`, poligonok: pol2, z0: 0, h: belso ? hv : hv + 0.35, nyilasok: ny2, ...(korny ? { kornyezet: korny } : {}), ...(lapok[i] ? { forras: { fajl: lapok[i]!.fajl, oldal: lapok[i]!.oldal, pt: pp } } : {}) });
                  }
                  continue;
                }
                const polPt = k.burok
                  ? (belso ? burokMeres(r, k.burok).map((l, pi) => (l.length === k.burok![pi]!.length ? l.map((e) => e.belso[0]) : k.burok![pi]!)) : k.burok)
                  : burok3dCache(i, r3, futottRiK(a, k), lapok[i]?.lap, a, belso);
                const pol = polPt.map((q) => q.map(([x, y]) => m(x, y)));
                // belső méretnél: a belső falak csatlakozása a külső falhoz (levonódik a külső fal felületéből)
                const csatl = belso ? csatlakozasok(r3, polPt) : undefined;
                  const kornyezet = k.burok ? undefined : elKornyezet(r3, polPt, futottRiK(a, k));
                // méretfelirat nélküli nyílás: a magasság a homlokzatról (vagy becsült) – mint az átvételnél
                const mert3 = mert3d(i, a);
                const ny = burokNyilasokPt(a, k, pol.length ? polPt : []).map((n) => {
                  const [x, y] = m(n.x, n.y);
                  const mm = n.mert ? (n.eredeti && mert3?.get(n.eredeti)) || { mag: n.szel >= 1.6 ? 2.4 : 1.5 } : null;
                  if (mm) return { x, y, szel: n.szel, mag: mm.mag, pm: mm.mag >= 2 ? 0 : 0.9 };
                  // felirat nélküli függönyfal: a szint teljes (belső) magasságában, mint az átvételnél
                  if (n.fajta === 'fuggonyfal' && !(n.mag > 0)) return { x, y, szel: n.szel, mag: belso ? emelet - 0.35 : emelet, pm: 0 };
                  return { x, y, szel: n.szel, mag: n.mag, pm: n.pm ?? 0 };
                });
                const szk = lapSzintek(i).length ? lapSzintek(i) : ['F'];
                for (const sz0 of szk) {
                  const sorszam = jelen.indexOf(sz0) - Math.max(0, nulla);
                  // tetőtér: a metszetből a hajlás, a térdfal és a padlásfödém (belmagasság) – a 3D-ben a tetősíkok töréseivel
                  const tt = sz0 === 'T' && me?.tetoter ? { hajlas: me.tetoter.hajlas, terdfal: me.tetoter.terdfal ?? 0.9, belmag: me.tetoter.belmagassag ?? (bm ?? 2.6) } : undefined;
                  // belső méret: a falmagasság a belmagasság (a födém vastagsága kimarad); külső méret: teljes szintmagasság
                  // homlokzat szerinti falmagasság élenként (a legfelső fűtött szinten, tetőtéri geometria nélkül)
                  let falMag: (number | null)[][] | undefined;
                  let plusz3: typeof ny = [];
                  if (!tt) {
                    const hm = homMag3d(i, a, szk, eszakLap(i, a));
                    // a homlokzaton látszó, az alaprajzon nem jelölt nyílások (mint az átvételnél) – a falszakasz közepén
                    if (hm && pol.length) {
                      const fut = futottRiK(a, k);
                      try {
                        type Fl = { irany: number; pontok: [number, number][]; h: number };
                        plusz3 = (hm.mod.pluszNyilasok((hm.fl as Fl[]).map((f) => ({ ...f, h: f })), hm.zf, hm.zc) as { h: Fl; szel: number; mag: number; pm: number }[]).filter((q) => fut.has(q.h.h)).map((q) => {
                          const P = q.h.pontok, c = P[Math.floor(P.length / 2)]!, c0 = P[Math.max(0, Math.floor(P.length / 2) - 1)]!;
                          const [x, y] = m((c[0] + c0[0]) / 2, (c[1] + c0[1]) / 2);
                          return { x, y, szel: q.szel, mag: q.mag, pm: q.pm };
                        });
                      } catch { plusz3 = []; }
                    }
                    const elMag = elMagFv(i, a, r, el, sor, alap, szk, emelet, belso, polPt, hm);
                    if (elMag) {
                      falMag = polPt.map((q) => {
                        const A2 = q.reduce((t, [x, y], j) => { const [x2, y2] = q[(j + 1) % q.length]!; return t + x * y2 - x2 * y; }, 0);
                        const e0 = Math.sign(A2) || 1;
                        return q.map((A, j) => {
                          const B = q[(j + 1) % q.length]!; const dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy);
                          if (l * r.mPerPt < 0.3) return null;
                          return elMag(A, B, (e0 * dy) / l, (-e0 * dx) / l);
                        });
                      });
                      if (!falMag.some((x) => x.some((v) => v !== null))) falMag = undefined;
                    }
                  }
                  szint3.push({ nev: szintNev(sz0), poligonok: pol, ...(falMag ? { falMag } : {}), z0: sorszam * emelet, h: tt ? tt.belmag : belso ? emelet - 0.35 : emelet, nyilasok: plusz3.length ? [...ny, ...plusz3] : ny, ...(csatl ? { csatl } : {}), ...(kornyezet ? { kornyezet } : {}), ...(sz0 === 'P' ? { talaj: true } : {}), ...(tt ? { teto: tt, orom: oromok(eszakSz, a.e.meretarany ?? undefined) } : {}), ...(lapok[i] ? { forras: { fajl: lapok[i]!.fajl, oldal: lapok[i]!.oldal, pt: polPt } } : {}) });
                }
              }
    return szint3;
  };
  // ellenőrzéshez (regresszió): a modell felületei mindkét méretezéssel, igény szerint lekérdezhetők
  /**
   * Külső méretes számítás: az átvett (belső méretű) határoló felületek a 3D modell külső / belső arányával –
   * falak tájolásonként, padló, födém, tető típusonként. A nyílászárók nem változnak.
   */
  const kulsoMeretre = (q: Projekt, uj: Set<string>): string | null => {
    const b0 = modellSzintek('belso'), k0 = modellSzintek('kulso'); if (!b0 || !k0) return null;
    const B = modellOsszesites(b0, eszakSz), K = modellOsszesites(k0, eszakSz);
    const ar = (k?: number, b?: number) => (k && b && b > 0.5 ? Math.min(1.6, Math.max(0.8, k / b)) : null);
    const falOssz = ar(K.tipus.fal, B.tipus.fal);
    let db = 0;
    for (const f of q.feluletek) {
      if (!uj.has(f.id) || f.fajta === 'nyilaszaro') continue;
      const fuggo = (f.hajlasszog ?? 90) >= 75;
      const x = f.fajta === 'padlo' ? ar(K.tipus.padlo, B.tipus.padlo) : fuggo ? (f.tajolas && f.hatar === 'kulso' ? ar(K.falTaj[f.tajolas], B.falTaj[f.tajolas]) ?? falOssz : falOssz) : ar(K.tipus.teto, B.tipus.teto);
      if (!x || Math.abs(x - 1) < 0.002) continue;
      if (f.meret) { f.meret = { ...f.meret, hossz: Math.round(f.meret.hossz * x * 100) / 100 }; f.A = Math.round(f.meret.hossz * f.meret.magassag * 100) / 100; }
      else if (typeof f.A === 'number') f.A = Math.round(f.A * x * 100) / 100;
      db++;
    }
    return db ? `Külső méret: ${db} határoló felület a hőburok külső síkja szerint (a 3D modell külső/belső arányával; falak tájolásonként) – a belső méretre a 2D/3D nézet „Belső méret” gombjával válthatsz.` : null;
  };
  // teljes épületmodell (IFC-szerű): a közös folyamatból, az aktuális lap északi irányával
  const epuletModellApp = (): EpuletModell | null => F.epuletModell(eszakSz);
  try { (globalThis as any).__epulet = epuletModellApp; } catch { /* */ }
  try { (globalThis as any).__elemzesek = () => ({ lapok, elemzesek, kijelolesek, futott: (i: number) => { const a = elemzesek[i]; return typeof a === 'object' ? [...futottRiK(a, kijeloles(i, a))] : []; }, nevF: (i: number) => nevFeliratok(lapok[i]!.lap) }); } catch { /* */ }
  try { (globalThis as any).__szobaMag = () => alaprajzLapok.map(({ i }) => { const a = elemzesek[i]; if (typeof a !== 'object') return null; const v = szobaMagassag(i, a); return v ? { lap: i, tengely: v.tengely, hatarok: v.hatarok, savok: v.savok, helyisegek: [...v.magassag.entries()].map(([ri, h]) => [a.magHelyisegek[ri]?.kod, a.magHelyisegek[ri]?.nev, h]) } : null; }); } catch { /* */ }
  // a 3D-ben kijelölt elem (fal, nyílás, tér) – a 2D rajzon kiemelve (alakja a forráslapon)
  const [kivElem, setKivElem] = useState<string | null>(null);
  const epMd = useMemo(() => { if (!nezet3d || modell3d !== 'teljes') return null; try { return epuletModellApp(); } catch { return null; } }, [nezet3d, modell3d, elemzesek, kijelolesek, bm, lapok, modellKezi]); // eslint-disable-line react-hooks/exhaustive-deps
  epMdRef.current = epMd;
  try { (globalThis as any).__burok3d = () => ({ belso: modellSzintek('belso'), kulso: modellSzintek('kulso') }); } catch { /* */ }
  try { (globalThis as any).__modell3d = () => ({ belso: (() => { const x = modellSzintek('belso'); return x ? modellOsszesites(x, eszakSz) : null; })(), kulso: (() => { const x = modellSzintek('kulso'); return x ? modellOsszesites(x, eszakSz) : null; })() }); } catch { /* */ }
  // az átvételkor ténylegesen használt tetőablakok (homlokzatról azonosítva, ennek híján az alaprajzi feliratokból)
  const tetoablakSzoveg = useMemo(() => {
    if (!al?.r || !tetoterLapE || !retegek.has('tetoablak')) return `${tetoablakJeloltek.length} felirat`;
    try { const t = tetoAblakok(al, atvetelReszek(al, kj).helyisegek, kj, eszakSz); const hom = t.some((x) => 'irany' in x); return `${t.length} db átvéve${hom ? ' (homlokzat szerint)' : ''} · ${tetoablakJeloltek.length} felirat`; } catch { return `${tetoablakJeloltek.length} felirat`; }
  }, [al, kj, eszakSz, tetoterLapE, retegek.has('tetoablak'), tetoablakJeloltek.length]);
  const korvonalA = al?.r ? burok.reduce((t, q) => t + poligonTerulet(q, al.r!.mPerPt), 0) : 0;
  const retegDb: Record<RetegKulcs, string> = {
    burok: kj.burok ? 'szerkesztett' : `${burok.length} körvonal`,
    helyiseg: `${valasztott.filter(Boolean).length} / ${helyisegek.filter((h) => !h.kulter).length}`,
    fal: al?.r ? `${sz(helyisegek.reduce((t, _, i) => t + (valasztott[i] ? falak(i).reduce((q, f) => q + f.hossz, 0) : 0), 0), 1)} m külső` : '–',
    nyilas: `${nyilasok.filter(({ k }) => !kizartNy.has(k)).length} db`,
    padlo: padloAt && burok.length ? `≈ ${sz(korvonalA, 1)} m²` : 'nem ezen a lapon',
    fodem: tetoAt && !tetoterLapE && burok.length ? `≈ ${sz(korvonalA, 1)} m²` : 'nem ezen a lapon',
    teto: tetoAt && tetoterLapE && burok.length ? `≈ ${sz(korvonalA, 1)} m² vetület` : 'nem ezen a lapon',
    tetoablak: tetoterLapE ? tetoablakSzoveg : al?.tetoablakok?.length ? `${al.tetoablakok.length} db (jel az alaprajzon)` : 'nem tetőtéri lap',
  };
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
      const kulsoKozel = (sg: FalSzakasz) => kulsoKozelE(rr, sg);
      const ism = R.szakaszok.map((sg, j) => ({ sg, j })).filter(({ sg }) => sg.tul === 'ismeretlen' && sg.hossz >= 0.3 && kulsoKozel(sg));
      const ismH = ism.reduce((t, { sg }) => t + sg.hossz, 0);
      if (ismH >= 1) problemak.push({ tipus: 'ismeretlen', i, kulcsok: ism.map(({ j }) => `${ri}|${j}`), pontok: ism.flatMap(({ sg }) => sg.pontok), hossz: ismH, szoveg: `${h.nev}: ${sz(ismH, 2)} m fal, a túloldala nem ismerhető fel (${[...new Set(ism.map(({ sg }) => egtaj(sg.irany, eszakSz)))].join(', ')})` });
      const szomsz = new Map<number, { h: number; p: [number, number][] }>();
      for (const sg of R.szakaszok) {
        if (sg.hossz < 0.3 || typeof sg.tul !== 'number') continue;
        const mi = helyisegek.indexOf(al.magHelyisegek[sg.tul]!);
        if (mi < 0 || valasztott[mi] || helyisegek[mi]!.kulter || kj.kulterH?.has(mi)) continue;
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
    // a hőburok éleinek mért hossza a belső síkon saroktól sarokig (a csatlakozó belső falak mögött is folytonosan)
    sarok: burokMert.some((p) => p.length) ? burokMert.flat().filter((e) => e.irany === ir).reduce((q, e) => q + e.hossz, 0) : null,
    db: nyilasok.filter(({ n, k }) => n.irany === ir && !kizartNy.has(k)).length,
  }));

  /** Közös átvétel: egy alaprajz a megadott kijelöléssel, szintekkel, padló/tető beállítással. */
  /** Tetőtéri alaprajz: a falhoz nem rendelt, fűtött helyiségen belül írt ablakméret-feliratok (tetősík ablak). */
  /** A homlokzatokon látszó tetősík ablakok (a térdfal teteje feletti keretek) – metszet szerinti tetőtérnél. */
  function tetoHom(a: AlaprajzFeldolgozas) {
    if (!me?.tetoter || me.tetoter.terdfal === null || me.tetoter.padlo === null) return [];
    const kuszob = me.tetoter.padlo + me.tetoter.terdfal + 0.1;
    return homlokzatLapok.flatMap(({ l }) => { try { return tetoAblakokHomlokzatrol(l.lap, kuszob, me.tetoter!.hajlas, a.e.meretarany ?? undefined); } catch { return []; } });
  }
  /**
   * Tetőtéri alaprajz: a külső falhoz kötött ablakfelirat, amely a homlokzaton látszó tetősík ablakokkal azonos
   * szélességű, és a térdfal fölé nyúlik – a tetősík ablak felirata (a méretét adja), nem falnyílás. A lap nyílásainak
   * indexei (legfeljebb a homlokzati tetősík ablakok számáig).
   */
  function tetoterFeliratAblakok(a: AlaprajzFeldolgozas): number[] {
    const tt = me?.tetoter; if (!tt || tt.terdfal === null) return [];
    const hom = tetoHom(a); if (!hom.length) return [];
    const szelek = [...new Set(hom.map((t) => t.szel))];
    const ki = a.nyilasok.flatMap((n, j) => (n.kulso && n.fajta === 'ablak' && !n.mert && n.mag >= 0.6 && n.mag <= 1.8 && szelek.some((w) => Math.abs(w - n.szel) <= 0.015) && (n.pm ?? 0.9) + n.mag > tt.terdfal! + 0.1 ? [j] : []));
    return ki.length <= hom.length ? ki : [];
  }
  function tetoAblakok(a: AlaprajzFeldolgozas, hs: ReturnType<typeof atvetelReszek>['helyisegek'], k: Kijeloles, eszak: number) {
    const r = a.r; if (!r) return [];
    const { ri } = atvetelReszek(a, k);
    // az alaprajzon jellel (áthúzott keret) rajzolt tetősík ablakok: hely, méret, lejtésirány a jelből és a feliratából
    const jelbol = (a.tetoablakok ?? []).flatMap((t, ti) => { const j = ri.indexOf(t.helyiseg); const km = k.taMeret?.[ti]; return j >= 0 && hs[j] ? [{ helyiseg: j, szel: km?.[0] ?? t.szel, mag: km?.[1] ?? t.mag, irany: t.irany, ...(t.hajlas ? { hajlas: t.hajlas } : {}) }] : []; });
    if (jelbol.length) return jelbol;
    // a felirat a ferde tetősíkban lévő ablaké, ha nincs külső falhoz rendelve (falhoz nem köthető, vagy belső
    // „fülkeként” / belső nyílásként felismert) és ablakméretű
    const tfa = new Set(tetoterFeliratAblakok(a));
    const jelolt = [...(a.arvaFeliratok ?? []), ...a.nyilasok.filter((n, j) => (!n.kulso && (n.fajta === 'falfulke' || n.fajta === 'ablak')) || tfa.has(j))];
    const alaprajzrol = jelolt.flatMap((f) => {
      if (f.szel < 0.4 || f.szel > 1.6 || f.mag < 0.6 || f.mag > 1.8) return [];
      // (mellvéd nélküli négyzetes „felirat” – „66 / 66” – a méretlánc egymás alatti két száma, nem ablak)
      if (Math.abs(f.szel - f.mag) < 0.005 && f.pm === null) return [];
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
    const hom = tetoHom(a); let parNelkul = 0;
    const homRes = hom.flatMap((t) => {
      const ir = (Math.round(norm(t.az + eszak) / 90) * 90) % 360;
      let hi = -1, leg = 0;
      ri.forEach((x, j) => { if (x < 0 || !hs[j]) return; const L = r.helyisegek[x]!.szakaszok.filter((sg) => sg.tul === 'kulso' && sg.irany === ir).reduce((q, sg) => q + sg.hossz, 0); if (L > leg) { leg = L; hi = j; } });
      const fel = alaprajzrol.filter((x) => Math.abs(x.szel - t.szel) <= 0.1).sort((x, y) => Math.abs(x.szel - t.szel) - Math.abs(y.szel - t.szel))[0];
      if (!fel) parNelkul++;
      return hi < 0 ? [] : [{ helyiseg: hi, szel: fel?.szel ?? t.szel, mag: fel?.mag ?? t.hossz, irany: ir }];
    });
    // a homlokzati keretek többségének nincs azonos szélességű alaprajzi felirata, az alaprajzon viszont van legalább két
    // tetőablak-felirat: a homlokzati keretek mást (szellőzőt, padlásablakot) jelölnek – az alaprajzi feliratok döntenek
    if (alaprajzrol.length >= 2 && parNelkul > homRes.length / 2) return alaprajzrol;
    return homRes.length ? homRes : alaprajzrol;
  }

  /** Az elemzés lapindexe (a kézi méretarányú újrafelismerésnél az aktuális lap). */
  const lapIndex = (a: AlaprajzFeldolgozas) => Object.keys(elemzesek).map(Number).find((k2) => elemzesek[k2] === a) ?? aIdx;
  function egyAtvetel(q: Projekt, a: AlaprajzFeldolgozas, k: Kijeloles, o: { csere: boolean; padloAt: boolean; tetoAt: boolean; eszak: number; szintek: string[]; fajl?: string }): string[] {
    // terepszint alatti szint (pince, alagsor): a feltételes rétegrendek (pincefal, pincepadló) is átkerülnek
    const terepAlatt = o.szintek.includes('P');
    // tetőtéri alaprajz (a legfelső szint tetőtér): a metszet tetőhajlása és térdfala szerint ferde tető + térdfal
    const tetoterLap = o.szintek.includes('T') && o.tetoAt && me?.szintek.belmagassag.length ? true : false;
    const extraUz: string[] = [];
    // A alakú ház: a térdfal a tető magassága az alaprajz körvonalán, a helyiségek belmagassága a valódi fűtött
    // keresztmetszet szerinti átlag (a metszet tetőtér-adata erre a lapra így módosul)
    const pT = tetoterLap && me?.padloigTeto && me.tetoter && a.r ? padloigTetoter(a.r, futottRiK(a, k), me.padloigTeto, me.tetoter.hajlas) : null;
    const ttL = pT && me?.tetoter ? { ...me.tetoter, terdfal: pT.terdfal } : me?.tetoter;
    if (pT && me?.padloigTeto) extraUz.push(`A metszeten a tető a padlóig fut le (A alakú ház, a tető alatt nincs szintmagas külső fal): a szintet tetőtérként vettem – ${sz(me.tetoter?.hajlas ?? 0, 0)}° hajlás, a tér a ${sz(me.padloigTeto.gerinc, 2)} m-es belső gerincig nyitott. Az alaprajz körvonala (${sz(pT.W, 2)} m széles) a tető ${sz(pT.terdfal, 2)} m-es magasságában zár: ez a térdfal; a helyiségek átlagos belmagassága ${sz(pT.belmag, 2)} m (a fűtött térfogat a teljes tetőtéri keresztmetszet szerint). Az alapterületbe az 1,9 m-nél magasabb rész számít. Ha a szint nem tetőtér, a lap szintjét állítsd át.`);
    // (tetőtéren a falon el nem férő ablakfelirat a tetősík ablaké: nem falnyílás)
    if (tetoterLap) { const tfa = tetoterFeliratAblakok(a); if (tfa.length) { k = { ...k, kizartNy: new Set([...k.kizartNy, ...tfa]) }; extraUz.push(`Tetőtér: ${tfa.length} ablakfelirat a homlokzaton látszó tetősík ablakokkal azonos szélességű és a térdfal fölé nyúlik – a tetősík ablak méreteként vettem, nem falnyílásként.`); } }
    // a kézzel megadott szerep felülírja a becslést (és a „nem hőburok” kihagyást)
    const blokkok = (me?.blokkok ?? []).filter((b) => rrKi[b.rr.kod] || (terepAlatt && b.becsles.feltetel === 'terepAlatt'))
      .map((b) => ({ ...b, retegek: b.retegek.map((r, j) => retegKezivel(b.rr.kod, j, r)) }))
      .map((b) => { const sz0 = rrSzerep[b.rr.kod]; return sz0 ? { ...b, becsles: { szerep: sz0, ...SZEREP_ALAP[sz0] } } : b; });
    // méretfelirat nélküli nyílások magassága a homlokzati lapokról (a lap szintjének sorszáma alulról)
    const szintSor = [...new Set(alaprajzLapok.flatMap(({ i }) => lapSzintek(i)))].sort((x, y) => SZINT_SOR.indexOf(x) - SZINT_SOR.indexOf(y));
    const mert = a.r && a.e.mPerPt && a.nyilasok.some((n) => n.mert) ? mertMagassagok(a.nyilasok, a.e.mPerPt, o.eszak, homlokzatRajzTar(homlokzatLapok.map(({ l }) => l.lap), a.e.meretarany), Math.max(0, szintSor.indexOf(o.szintek[0] ?? 'F')), szintSor.length) : undefined;
    // alaprajz + homlokzat: a homlokzati nézetek illesztése a lap homlokzati falaihoz – a legfelső fűtött szinten a falmagasság
    // (oromfal, térdfal, eltérő párkány), minden szinten az alaprajzon nem jelölt, a homlokzaton látszó nyílások
    const hModell = homMagModell(a, o.szintek, o.eszak, tetoterLap);
    // tetőablakos helyiség metszet nélkül: a lejtés felőli külső fal térdfal (mint a 3D-ben) – homlokzat szerint 0,3–1,5 m,
    // ennek híján az alapértelmezett / megadott térdfal-magasság
    const tab = !tetoterLap && (!me?.szintek.belmagassag.length || me.tetoter) ? a.tetoablakok ?? [] : [];
    const terdE = (sg: FalSzakasz, x: number) => tab.some((t) => t.helyiseg === x && Math.abs(((t.irany - sg.irany + 540) % 360) - 180) <= 30);
    const hmag = (sg: FalSzakasz) => (hModell?.felso ? hModell.mod.magassag(sg.irany, sg.pontok, hModell.zf, hModell.zc) : null);
    const falMag = hModell?.felso || tab.length ? (sg: FalSzakasz, x: number) => {
      if (terdE(sg, x)) { const v = hmag(sg); (sg as { terd?: boolean }).terd = true; return me?.tetoter?.terdfal ?? (v !== null && v >= 0.3 && v <= 1.5 ? v : terdfalKezi ?? me?.tetoter?.terdfalTipp ?? 0.9); }
      return hmag(sg);
    } : undefined;
    // eltérő belmagasságú épületrészek (csarnok + fejépület): a helyiség falai és térfogata a metszet szerinti belmagassággal
    const szm = tetoterLap ? null : szobaMagassag(lapIndex(a), a);
    const falMag2 = szm ? (sg: FalSzakasz, x: number) => falMag?.(sg, x) ?? szm.magassag.get(x) ?? null : falMag;
    const { helyisegek: hs, nyilasok: ny0, ri: riL } = atvetelReszek(a, k, mert, falMag2, !tetoterLap);
    if (szm) {
      hs.forEach((h, j) => { const v = szm.magassag.get(riL[j]!); if (v === undefined) return; h.belmagassag = v; for (const f of h.falak) if (f.magassag === undefined) f.magassag = v; });
      const cs = [...new Set(szm.magassag.values())].sort((x, y) => x - y);
      extraUz.push(`Eltérő belmagasságú épületrészek a metszetből: ${cs.map((v) => `${String(v).replace('.', ',')} m (${hs.filter((h) => h.belmagassag === v).length} helyiség)`).join(', ')} – a helyiségek falmagassága és térfogata ennek megfelelő; ellenőrizd a Helyiségek lépésben.`);
    }
    // a homlokzaton látszó, az alaprajzon nem jelölt nyílások (a helyiség a homlokzati falszakasza szerint)
    const plusz = hModell ? hModell.mod.pluszNyilasok(hModell.fl, hModell.zf, hModell.zc).flatMap((q): AtvettNyilas[] => {
      const hi = riL.indexOf(q.h); if (hi < 0) return [];
      return [{ fajta: q.mag >= 1.9 ? (q.pm < 0.1 ? 'erkelyajto' : 'ablak') : 'ablak', szel: q.szel, mag: q.mag, pm: q.pm, helyiseg: hi, irany: q.irany }];
    }) : [];
    const pluszUz = plusz.length ? [`${plusz.length} nyílás a homlokzati rajzról (az alaprajzon nem jelölt, a homlokzaton látszó nyílászáró a falszakasz helyiségéhez) – ellenőrizd.`] : [];
    const ny = [...ny0, ...plusz];
    // szomszédos épülethez csatlakozó (zártsorú, ikres) falak: nem homlokzati falak – fűtött szomszédnál kimaradnak,
    // fűtetlennél fal fűtetlen tér felé
    let szomszedH = 0;
    if (a.r) {
      const { ri: riL } = atvetelReszek(a, k);
      const szh = riL.reduce((t, x) => t + (x < 0 ? 0 : a.r!.helyisegek[x]!.szakaszok.filter((sg) => sg.tul === 'kulso' && sg.szomszed).reduce((q, sg) => q + sg.hossz, 0)), 0);
      if (szh >= 0.3) { szomszedH = szh; extraUz.push(`Szomszédos épülethez csatlakozó fal: ${String(Math.round(szh * 100) / 100).replace('.', ',')} m (a rajzon „szomszédos épület” / „zártsorú” felirat a fal mögött) – ${szomszedFutott ? 'fűtött szomszéd: nem hőátadó felület, nem került át' : 'fűtetlen szomszéd: fal fűtetlen tér felé (b-tényezővel)'}.`); }
    }
    // falhoz nem rendelt nyílásfeliratok, amelyek nem kerültek át (a burok mentén nem helyezhetők el)
    if (a.arvaFeliratok?.length) {
      const atvett = new Set(burokNyilasok(a, k).map(({ kk }) => kk));
      // (csak a homlokzati nyílásra utaló: a burkon kívül vagy a burok élén – a belül írt belső ajtófelirat nem)
      const ab0 = a.r ? burokAutoTar(a.r, futottRiK(a, k)) : [];
      const kimaradt = a.arvaFeliratok.filter((f, j) => !atvett.has(10000 + j) && a.r && ab0.length && (!ab0.some((p) => bennE(p, f.x, f.y)) ? nyilasEl(a.r, ab0, f.x, f.y, 2.5) !== null : nyilasEl(a.r, ab0, f.x, f.y, 1.0) !== null));
      if (kimaradt.length) extraUz.push(`${kimaradt.length} nyílásfelirat (${[...new Set(kimaradt.map((f) => `${Math.round(f.szel * 100)}×${Math.round(f.mag * 100)}`))].join(', ')}) nem köthető falnyíláshoz, és a hőburok mentén sem helyezhető el: nem került át. Ha homlokzati nyílás, add hozzá a Határolás lépésben.`);
    }
    // tetőablakos helyiség metszet nélkül: a 3D modellben a lejtés felőli fal térdfal
    if (a.tetoablakok?.length && (!me?.szintek.belmagassag.length || me.tetoter) && !tetoterLap) extraUz.push(`Tetőablakos helyiség ${me?.szintek.belmagassag.length ? 'a ferde tető alatt' : 'metszet nélkül'}: a lejtés felőli külső falat térdfalnak vettem (magassága ${me?.tetoter?.terdfal ? 'a metszetről' : 'a homlokzatról'}, ennek híján ${String(me?.tetoter?.terdfal ?? terdfalKezi ?? me?.tetoter?.terdfalTipp ?? 0.9).replace('.', ',')} m) – ellenőrizd a falmagasságot az „Ellenőrizendő” részben.`);
    const mertDb = ny.length && mert ? [...mert.values()] : [];
    if (mertDb.length) {
      const h = mertDb.filter((x) => x.forras === 'homlokzat').length, sz = mertDb.filter((x) => x.forras === 'szelesseg').length, b = mertDb.filter((x) => x.forras === 'becsult').length;
      extraUz.push(`${mertDb.length} méretfelirat nélküli nyílás: szélesség az alaprajzról mérve; magasság ${[h ? `${h} a homlokzatról (helyzet szerint)` : '', sz ? `${sz} a homlokzat azonos szélességű kereteiből` : '', b ? `${b} becsült (1,50 / 2,40 m)` : ''].filter(Boolean).join(', ')} – ellenőrizd a Határolás lépésben.`);
    }
    return tervAtvesz(q, {
      helyisegek: hs, retegrendek: blokkok, nyilasok: ny,
      eszakSzog: o.eszak, belmagassag: (pT ? pT.belmag : tetoterLap ? me?.tetoter?.belmagassag ?? me?.szintek.belmagassag.at(-1) : undefined) ?? bm ?? 2.7, szintszam: szintszam ?? 1, csere: o.csere, padloAt: o.padloAt, tetoAt: o.tetoAt,
      ...(!szomszedFutott && szomszedH >= 0.3 ? { szomszedFutetlen: szomszedH } : {}),
      ...(tetoterLap && ttL ? { tetoter: { ...ttL, orom: oromok(o.eszak, a.e.meretarany ?? undefined), ...ferdeModell(a, k, ttL, oromok(o.eszak, a.e.meretarany ?? undefined), bm ?? 2.6) }, tetoablakok: tetoAblakok(a, hs, k, o.eszak) } : a.tetoablakok?.length ? { tetoablakok: tetoAblakok(a, hs, k, o.eszak) } : {}),
      ...(mintaFajta === 'blokkos' ? { alapFalSablon: 'fal_blokk_kohosalak' } : {}),
      forras: [o.fajl, mLap?.fajl].filter(Boolean).join(', '), szintek: o.szintek,
      ...(terepAlatt ? { terepAlatt: true, ...(pinceMelyseg ? { terepMelyseg: pinceMelyseg } : {}) } : {}),
    }).uzenetek.concat(extraUz, pluszUz);
  }

  function atvesz() {
    if (!al) return;
    let uzenetek: string[] = [];
    modosit((q) => { const elotte = new Set(q.feluletek.map((f) => f.id)); uzenetek = egyAtvetel(q, al, kj, { csere, padloAt, tetoAt, eszak: eszakSz, szintek: lapSzintek(aIdx), fajl: aLap?.fajl }); if (meretMod === 'kulso') { const m = kulsoMeretre(q, new Set(q.feluletek.filter((f) => !elotte.has(f.id)).map((f) => f.id))); if (m) uzenetek.push(m); } });
    if (pecset && pecsetBe) modosit((q) => pecsetAtvesz(q, pecset));
    if (al.e.eszak) eszakJavitasMent(al.e.eszak.alairas, eszakSz - al.e.eszak.szog);
    setKesz(uzenetek);
    setAtvett((x) => new Set([...x, aIdx]));
    // a következő alaprajz alapból a meglévők mellé kerül
    setCsere(false);
  }

  /** Minden feldolgozott, átvételre jelölt alaprajz egy lépésben, szintsorrendben (az első a választott módon, a többi hozzáadva). */
  /** Beolvasáskor eldöntendő kérdések (minden átvételre jelölt lapra): fűtetlennek javasolt helyiségek, szomszédos épület. */
  function eldontendoKerdesek() {
    const jel = new Map<string, { nev: string; A: number }>();
    let szomszed = 0;
    for (const { i } of alaprajzLapok) {
      const a = elemzesek[i]; if (typeof a !== 'object' || kimarad(i)) continue;
      const k = kjVeg(i, a);
      a.e.helyisegek.forEach((h, j) => {
        if (h.kulter || k.kizartH.has(j) || kategoriaJavaslat(h.nev, h.A) !== 'gyengen_kapcsolt') return;
        const kk = kerdesKulcs(h.nev); const x = jel.get(kk) ?? { nev: h.nev.replace(/\s*\([^)]*\)/g, ''), A: 0 }; x.A += h.A; jel.set(kk, x);
      });
      if (a.r) for (const x of atvetelReszek(a, k).ri) if (x >= 0) szomszed += a.r.helyisegek[x]!.szakaszok.filter((sg) => sg.tul === 'kulso' && sg.szomszed).reduce((q, sg) => q + sg.hossz, 0);
    }
    // a belmagasság a metszetből nem olvasható (nincs metszet, vagy a szintjelekből nem adódik – pl. csarnok)
    const bmHiany = alaprajzLapok.length > 0 && !(me?.szintek.belmagassag.length);
    // tetőtér: a metszeten ferde tető van, és a legfelső alaprajzi szint padlója a tetőtéri padló magasságában – de a lap
    // nincs tetőtérnek jelölve; ill. a tetőtéri lapnál a térdfal nem olvasható a metszetről (nincs „térdfal” felirat)
    const tt0 = me0?.tetoter;
    const atvett = alaprajzLapok.filter(({ i }) => typeof elemzesek[i] === 'object' && !kimarad(i));
    const vanT = atvett.some(({ i }) => lapSzintek(i).includes('T'));
    let felsoLap: { i: number; sz: string } | null = null;
    if (tt0 && !vanT && !nemTetoter && tt0.padlo !== null) {
      const szintek = [...new Set(atvett.flatMap(({ i }) => lapSzintek(i)).filter((x) => x !== 'P'))].sort((a, b) => SZINT_SOR.indexOf(a) - SZINT_SOR.indexOf(b));
      const felso = szintek.at(-1); const poz = szintek.length - 1; const padlo = me0?.szintek.padlo.filter((v) => v > -1)[poz];
      const lap = felso ? atvett.find(({ i }) => lapSzintek(i).includes(felso)) : undefined;
      if (felso && lap && poz >= 1 && padlo !== undefined && Math.abs(padlo - tt0.padlo) <= 0.5) felsoLap = { i: lap.i, sz: felso };
    }
    const terdfalKerdes = !!tt0 && tt0.terdfal === null && (vanT || !!felsoLap);
    if (!jel.size && szomszed < 0.3 && !bmHiany && !felsoLap && !terdfalKerdes) return null;
    return (
      <div role="group" aria-label="Eldöntendő a beolvasáshoz">
        <table class="tabla" style="margin-top:6px"><tbody>
          {[...jel.entries()].map(([kk, x]) => (
            <tr>
              <td>{x.nev} <span class="halkabb">({sz(x.A)} m²)</span> – a hőburok része (fűtött)?</td>
              <td style="white-space:nowrap">
                <label class="jelolo"><input type="radio" name={`fv-${kk}`} checked={!futottValasz[kk]} onChange={() => setFutottValasz({ ...futottValasz, [kk]: false })} /> fűtetlen</label>{' '}
                <label class="jelolo"><input type="radio" name={`fv-${kk}`} checked={!!futottValasz[kk]} onChange={() => setFutottValasz({ ...futottValasz, [kk]: true })} /> fűtött</label>
              </td>
            </tr>
          ))}
          {felsoLap && (
            <tr>
              <td>A metszeten ferde tető van ({sz(tt0!.hajlas, 0)}°), és a(z) „{lapok[felsoLap.i]?.cim || lapok[felsoLap.i]?.fajl}” szint padlója a tetőtéri padló magasságában – tetőtér (ferde tető alatti szint, térdfallal)?</td>
              <td style="white-space:nowrap">
                <button class="gomb halk-gomb" onClick={() => { const f = felsoLap!; setSzintKi({ ...szintKi, [f.i]: [...lapSzintek(f.i).filter((x) => x !== f.sz), 'T'] }); }}>igen, tetőtér</button>{' '}
                <button class="gomb halk-gomb semleges" onClick={() => setNemTetoter(true)}>nem</button>
              </td>
            </tr>
          )}
          {terdfalKerdes && (
            <tr>
              <td>A térdfal magasságát a metszeten nem találtam („térdfal” felirat nincs){tt0!.terdfalTipp ? ` – javaslat a szintjelekből (eresz / koszorú): ${sz(tt0!.terdfalTipp, 2)} m` : ''}. Add meg (a tetőtéri padlótól a tetősík és a külső fal metszéséig) – üresen hagyva a tetőtér falai teljes belmagasságúak.</td>
              <td style="white-space:nowrap"><input type="number" step="0.01" min="0" max="3" aria-label="Térdfal magassága (m)" style="width:90px" placeholder={String(tt0!.terdfalTipp ?? 0.9).replace('.', ',')} value={terdfalKezi ?? ''} onInput={(e) => { const t = (e.target as HTMLInputElement).value.trim(); const v = Number(t.replace(',', '.')); setTerdfalKezi(t && v >= 0 ? v : undefined); }} /> m{tt0!.terdfalTipp ? <> <button class="gomb kis-gomb halk-gomb" onClick={() => setTerdfalKezi(tt0!.terdfalTipp!)}>javaslat</button></> : null}</td>
            </tr>
          )}
          {bmHiany && (
            <tr>
              <td>A belmagasságot nem tudtam kiolvasni a metszetből{me ? '' : ' (nincs metszet)'} – add meg (csarnoknál a fal belső magassága, pl. az eresz alsó síkjáig).</td>
              <td style="white-space:nowrap"><input type="number" step="0.01" min="1.5" max="20" aria-label="Belmagasság (m)" style="width:90px" value={bm ?? 2.7} onInput={(e) => { const v = Number((e.target as HTMLInputElement).value.replace(',', '.')); if (v > 0) setBm(v); }} /> m</td>
            </tr>
          )}
          {szomszed >= 0.3 && (
            <tr>
              <td>Szomszédos épülethez csatlakozó fal ({sz(szomszed)} m) – a szomszéd épület fűtött?</td>
              <td style="white-space:nowrap">
                <label class="jelolo"><input type="radio" name="szomszed" checked={szomszedFutott} onChange={() => setSzomszedFutott(true)} /> fűtött (nem hőátadó)</label>{' '}
                <label class="jelolo"><input type="radio" name="szomszed" checked={!szomszedFutott} onChange={() => setSzomszedFutott(false)} /> fűtetlen</label>
              </td>
            </tr>
          )}
        </tbody></table>
      </div>
    );
  }

  function osszesAtvesz() {
    // (szint nélküli című lap – „ALAPRAJZ” – földszintként, ha egyértelmű: ez az egyetlen szint nélküli lap, és
    // más lap nem földszint; több szint nélküli lapnál a szintet a felhasználó jelöli)
    const szintNelkuli = alaprajzLapok.filter(({ i }) => !kimarad(i) && typeof elemzesek[i] === 'object' && !lapSzintek(i).length);
    const vanF = alaprajzLapok.some(({ i }) => lapSzintek(i).includes('F'));
    const lapSzintekE = (i: number) => (lapSzintek(i).length ? lapSzintek(i) : szintNelkuli.length === 1 && !vanF ? ['F'] : []);
    const sor = alaprajzLapok.filter(({ i }) => !kimarad(i) && typeof elemzesek[i] === 'object')
      .sort((x, y) => SZINT_SOR.indexOf(lapSzintekE(x.i)[0] ?? 'F') - SZINT_SOR.indexOf(lapSzintekE(y.i)[0] ?? 'F'));
    if (!sor.length) return;
    setOsszesFut(true);
    const futott = [...new Set(sor.flatMap(({ i }) => lapSzintekE(i)).filter((x) => x !== 'P'))].sort((a, b) => SZINT_SOR.indexOf(a) - SZINT_SOR.indexOf(b));
    const uz: string[] = [];
    const szintA = new Map<string, number>();
    // laponként: a projektbe került helyiségek helye (szintenként azonos sorrendben) a szintek egymásra vetítéséhez
    const lapAdat: { a: AlaprajzFeldolgozas; sz: string[]; reszek: ReturnType<typeof atvetelReszek>; kezd: number; felIds: Set<string> }[] = [];
    modosit((q) => {
      const elotteMind = new Set(q.feluletek.map((f) => f.id));
      sor.forEach(({ l, i }, n) => {
        const a = elemzesek[i] as AlaprajzFeldolgozas;
        // a megnyitott lapnál a kézi kijelölés, a többinél az alapértelmezett
        const k = i === aIdx ? kj : kijeloles(i, a);
        const sz = lapSzintekE(i);
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
      // az épületmodell konzol-arányai helyiségenként (lap|szint|raszterindex → a tér alapterületének hányada)
      let kmTar: Map<string, number> | null | undefined;
      const konzolModell = () => {
        if (kmTar !== undefined) return kmTar;
        try {
          const md = epuletModellApp(); if (!md) return (kmTar = null);
          const T = new Map(md.terek.map((t) => [t.id, t])); kmTar = new Map();
          for (const v of md.vizszintes) { if (v.fajta !== 'konzol') continue; const t = T.get(v.ter); if (!t || t.forras.ri < 0 || !(t.A > 0)) continue; const k2 = `${t.forras.lap}|${t.szint}|${t.forras.ri}`; kmTar.set(k2, (kmTar.get(k2) ?? 0) + v.Avet / t.A); }
          return kmTar;
        } catch { return (kmTar = null); }
      };
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
          // (a külső levegő feletti rész – konzol, árkád – az épületmodellből: a szomszédos szintek helyiségei, a modellen
          // kívüli épülettömeg és a fűtetlen terek szerint; modell híján a raszterek egymásra vetítéséből)
          const km = !fel ? konzolModell() : null, li = km ? Object.keys(elemzesek).map(Number).find((k2) => elemzesek[k2] === x.a) : undefined;
          const nyitott = km && li !== undefined ? km.get(`${li}|${s0}|${ri}`) ?? 0 : 1 - fedettArany(x.a.r!, ri, y.a.r!, fut, el);
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
      if (meretMod === 'kulso') { const m = kulsoMeretre(q, new Set(q.feluletek.filter((f) => !elotteMind.has(f.id)).map((f) => f.id))); if (m) uz.push(m); }
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
          <label class="gomb fo" style="cursor:pointer">PDF tervlapok (vagy ZIP) kiválasztása<input type="file" accept="application/pdf,.pdf,.zip,application/zip" multiple style="display:none" onChange={(e) => { const t = e.target as HTMLInputElement; setMintaFajta(null); void betolt(t.files).then(() => { t.value = ''; }); }} /></label>
          {lapok.length > 0 && <button class="gomb halk-gomb semleges" onClick={() => { setLapok([]); setAIdx(-1); setMIdx(-1); setKesz(null); setElemzesek({}); setKijelolesek({}); setAtvett(new Set()); setEszakKozos(null); setEszakKulon({}); }}>Lapok törlése</button>}
          {folyamat && !halad && <span class="halk" role="status">{folyamat}</span>}
        </div>
        {halad && <div class="halad" role="status"><progress value={halad.arany} max={1} /><span>{Math.round(halad.arany * 100)}% · {halad.szoveg}</span></div>}
        {!halad && alaprajzLapok.some(({ i }) => elemzesek[i] === undefined) && (() => { const kesz = alaprajzLapok.filter(({ i }) => elemzesek[i] !== undefined).length; const kov = alaprajzLapok.find(({ i }) => elemzesek[i] === undefined)!;
          const mp = elemzesHalad && elemzesHalad.lap === kov.i ? Math.round((Date.now() - elemzesHalad.kezd) / 1000) : 0;
          return <div class="halad" role="status"><progress value={kesz} max={alaprajzLapok.length} /><span>Alaprajzok feldolgozása: {kesz} / {alaprajzLapok.length} kész · most: {kov.l.cim || kov.l.fajl}{elemzesHalad && elemzesHalad.lap === kov.i ? <> · {elemzesHalad.szoveg} · {mp} s{mp >= 30 ? ' (nagy, részletes lap – a feldolgozás tovább tarthat, a program nem fagyott le)' : ''}</> : null}</span></div>; })()}
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
              <button class="gomb fo" disabled={osszesFut || alaprajzLapok.some(({ i }) => elemzesek[i] === undefined) || !alaprajzLapok.some(({ i }) => !kimarad(i) && !atvett.has(i))} onClick={() => kerdezveAtvesz('osszes')}>
                {alaprajzLapok.some(({ i }) => elemzesek[i] === undefined) ? `Feldolgozás… (${alaprajzLapok.filter(({ i }) => elemzesek[i] !== undefined).length} / ${alaprajzLapok.length})` : `Összes kijelölt alaprajz átvétele (${alaprajzLapok.filter(({ i }) => !kimarad(i)).length} lap)`}
              </button>
              <span class="halkabb">{csere && !atvett.size ? 'A projekt meglévő helyiségei, felületei és nyílászárói helyére kerülnek (Felülírás – lent módosítható).' : 'A meglévők mellé kerülnek.'} A megnyitott lapnál a kézi kijelölés, a többinél az összes egység és helyiség.</span>
            </div>
          </div>
        )}
      </section>

      {kerdesAblak && (
        <div class="modal-hatter">
          <div class="modal" role="dialog" aria-modal="true" aria-label="Eldöntendő az átvételhez">
            <h2>Eldöntendő az átvételhez</h2>
            {eldontendoKerdesek()}
            <div class="gombsor">
              <button class="gomb halk-gomb semleges" onClick={() => setKerdesAblak(null)}>Mégse</button>
              <button class="gomb fo" onClick={() => { const mi = kerdesAblak; setKerdesAblak(null); if (mi === 'osszes') osszesAtvesz(); else atvesz(); }}>Átvétel</button>
            </div>
          </div>
        </div>
      )}
      {kesz && (
        <div class="modal-hatter">
          <div class="modal" role="dialog" aria-modal="true" aria-label="Átvétel eredménye">
            <h2>Átvéve</h2>
            <div role="status">{kesz.map((u) => <p class="halkabb">{u}</p>)}</div>
            <div class="gombsor">
              <button class="gomb" onClick={() => ugrik('helyisegek')}>Helyiségek</button>
              <button class="gomb" onClick={() => ugrik('retegrendek')}>Rétegrendek</button>
              <button class="gomb" onClick={() => ugrik('hatarolas')}>Határolás</button>
              <button class="gomb fo" onClick={() => setKesz(null)}>Rendben</button>
            </div>
          </div>
        </div>
      )}
      {aLap && !al && elemzesek[aIdx] === undefined && <section class="szakasz"><p class="halk" role="status">A(z) „{aLap.cim || aLap.fajl}” alaprajz feldolgozása folyamatban…</p></section>}
      {aLap && typeof elemzesek[aIdx] === 'string' && <section class="szakasz"><div class="hiba-doboz">A(z) „{aLap.cim || aLap.fajl}” alaprajz nem dolgozható fel: {elemzesek[aIdx] as string}</div></section>}

      {mintaFajta && <MintaLakasok fajta={mintaFajta} modosit={modosit} ugrik={ugrik} />}

      {al && aLap && (
          <div class={rogzit ? 'nezo-rogzitett' : undefined}>
          <div style="position:relative;margin-bottom:8px">
            {/* 2D / 3D nézetváltó a bal felső sarokban */}
            <div role="group" aria-label="Nézet" style="position:absolute;left:10px;top:10px;z-index:3;display:flex;border:1px solid #D1D5DB;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
              {(['2D', '3D'] as const).map((n) => (
                <button aria-pressed={(n === '3D') === nezet3d} onClick={() => setNezet3d(n === '3D')} style={`font:700 20px/1 system-ui;padding:8px 14px;border:0;cursor:pointer;${(n === '3D') === nezet3d ? 'background:#1F2937;color:#fff' : 'background:rgba(255,255,255,.95);color:#374151'}`}>{n}</button>
              ))}
            </div>
            {nezet3d ? (
              (() => {
                const valto = (
                  <div role="group" aria-label="3D modell" style="position:absolute;left:110px;top:10px;z-index:3;display:flex;border:1px solid #D1D5DB;border-radius:8px;overflow:hidden">
                    {([['teljes', 'Épületmodell'], ['burok', 'Hőburok (számítás)']] as const).map(([k0, nev]) => <button aria-pressed={modell3d === k0} onClick={() => setModell3d(k0)} style={`font:600 13px system-ui;padding:9px 12px;border:0;cursor:pointer;${modell3d === k0 ? 'background:#1F2937;color:#fff' : 'background:rgba(255,255,255,.95);color:#374151'}`}>{nev}</button>)}
                  </div>
                );
                if (modell3d === 'teljes') {
                  const md = epMd;
                  if (!md || !md.falak.length) return <div class="kartya halkabb" style="padding:60px 16px 16px">{valto}A 3D modellhez a lap léptéke és a felismert falak kellenek (add meg a méretarányt).</div>;
                  const hibak = (() => { try { return zartsagEllenoriz(md); } catch { return []; } })();
                  return <div class="kartya" style="padding:56px 0 0;overflow:hidden;position:relative">{valto}<Epulet3D modell={md} hibak={hibak} kivNy={kivNy} onNyilas={(f) => { setKivNy(f); if (f && f.lap !== aIdx && f.lap >= 0) setAIdx(f.lap); }} onElem={(id) => { setKivElem(id); const e = id ? elemAlakok(md).find((x) => x.id === id) : undefined; if (e && e.lap !== aIdx) setAIdx(e.lap); }} magassag={Math.round(Math.min(760, Math.max(rogzit ? 300 : 420, (typeof window !== 'undefined' ? window.innerHeight : 800) * (rogzit ? 0.5 : 0.7))))} />{kivNyAdat && <NyilasMeretSzerk adat={kivNyAdat} allit={(x) => nyMeretAllit(kivNy!.lap, kivNy!.ny, x)} bezar={() => setKivNy(null)} />}
                    {hibak.length > 0 && (
                      <div role="status" style="margin:0;padding:10px 14px;border-top:1px solid #FCA5A5;background:#FEF2F2">
                        <strong style="color:#B91C1C">A modell nem zárt – a beolvasás itt hiányos ({hibak.length} hely, a 3D-ben pirossal jelölve):</strong>
                        <ul style="margin:6px 0 0 18px;padding:0;font-size:13px">{hibak.slice(0, 12).map((h) => <li>{h.leiras} <span class="halkabb">({h.szint ? `${szintNev(h.szint)}, ` : ''}x {String(Math.round(h.hely[0] * 10) / 10).replace('.', ',')} m, y {String(Math.round(h.hely[1] * 10) / 10).replace('.', ',')} m)</span></li>)}</ul>
                        {hibak.length > 12 && <div class="halkabb" style="font-size:13px">… és még {hibak.length - 12} hely.</div>}
                      </div>
                    )}
                    {/* parametrikus javítás: a felismert tető és szintmagasságok felülírása – a modell és a mennyiségek újraszámolódnak */}
                    {(() => {
                      const mt = md.magasteto, MK = modellKezi;
                      const szam = (t: string) => { const v = Number(t.trim().replace(',', '.')); return t.trim() && Number.isFinite(v) ? v : undefined; };
                      const allit = (fn: (k: ModellKezi) => ModellKezi) => setModellKezi((k) => fn({ ...k }));
                      const VEG: [number, string][] = [[0, 'fent'], [90, 'jobbra'], [180, 'lent'], [270, 'balra']];
                      const inp = 'width:80px';
                      return (
                        <details style="margin:0;padding:10px 14px;border-top:1px solid #E5E7EB" open={parNyitva} onToggle={(e) => setParNyitva((e.currentTarget as HTMLDetailsElement).open)}>
                          <summary style="cursor:pointer;font-weight:600">Modell paraméterei (kézi javítás){Object.keys(MK).length ? ' – módosítva' : ''}</summary>
                          <div style="display:flex;flex-wrap:wrap;gap:10px 18px;margin-top:8px;font-size:14px;align-items:center">
                            <label>Tetőhajlás: <input type="number" step="1" min="0" max="75" style={inp} aria-label="Tetőhajlás (fok)" placeholder={mt ? String(Math.round(mt.hajlas * 10) / 10).replace('.', ',') : 'lapos'} value={MK.hajlas ?? ''} onInput={(e) => { const v = szam((e.target as HTMLInputElement).value); allit((k) => { if (v === undefined) delete k.hajlas; else k.hajlas = Math.max(0, Math.min(75, v)); return k; }); }} /> ° <span class="halkabb">(0 = lapostető)</span></label>
                            {(mt || (MK.hajlas ?? 0) > 0) && <label>Ereszkiállás: <input type="number" step="0.05" min="0" max="3" style={inp} aria-label="Ereszkiállás (m)" placeholder={mt ? String(mt.kiallas).replace('.', ',') : '0,5'} value={MK.kiallas ?? ''} onInput={(e) => { const v = szam((e.target as HTMLInputElement).value); allit((k) => { if (v === undefined) delete k.kiallas; else k.kiallas = Math.max(0, Math.min(3, v)); return k; }); }} /> m</label>}
                            {(mt || (MK.hajlas ?? 0) > 0) && <span style="display:inline-flex;flex-wrap:wrap;align-items:center;gap:4px">Kiállás oldalanként (a rajzon; nagyobb értékkel a tető a terasz / bejárat fölé is kiterjed):{VEG.map(([ir, nev]) => (
                              <label style="margin-left:8px">{nev} <input type="number" step="0.05" min="0" max="8" style="width:64px" aria-label={`Ereszkiállás, ${nev} (m)`} placeholder={mt ? String(MK.kiallas ?? mt.kiallas).replace('.', ',') : '0,5'} value={MK.kiallasOldal?.[ir] ?? ''} onInput={(e) => { const v = szam((e.target as HTMLInputElement).value); allit((k) => { const o = { ...(k.kiallasOldal ?? {}) }; if (v === undefined) delete o[ir]; else o[ir] = Math.max(0, Math.min(8, v)); if (Object.keys(o).length) k.kiallasOldal = o; else delete k.kiallasOldal; return k; }); }} /> m</label>
                            ))}</span>}
                            {(mt || (MK.hajlas ?? 0) > 0) && <span style="display:inline-flex;flex-wrap:wrap;align-items:center;gap:4px">Tetővégek (a rajzon):{VEG.map(([ir, nev]) => (
                              <label style="margin-left:8px">{nev} <select style="width:auto;display:inline-block" aria-label={`Tetővég ${nev}`} value={MK.orom?.[ir] === undefined ? '' : MK.orom[ir] ? 'orom' : 'konty'} onChange={(e) => { const v = (e.target as HTMLSelectElement).value; allit((k) => { const o = { ...(k.orom ?? {}) }; if (v === '') delete o[ir]; else o[ir] = v === 'orom'; if (Object.keys(o).length) k.orom = o; else delete k.orom; return k; }); }}>
                                <option value="">felismert</option><option value="konty">konty</option><option value="orom">oromfal</option>
                              </select></label>
                            ))}</span>}
                            {(mt || MK.lapos) && (() => {
                              // a lapostetős / féltetős sávok oldalanként: szélesség a legfelső födém körvonalától (a felismert /
                              // érvényes érték), a sáv teteje (lapos vagy féltető – hajlás, lejtés iránya)
                              const ft = md.fodemek.filter((f) => f.alatt === (mt?.szint ?? md.szintek[md.szintek.length - 1]?.id) && f.id.startsWith('FT')).flatMap((f) => f.poligonok.flat());
                              const sav: Record<number, { w: number; f?: { hajlas: number; lejt: number } }> = {};
                              if (mt?.laposSav && ft.length) {
                                const x0 = Math.min(...ft.map((q) => q[0])), x1 = Math.max(...ft.map((q) => q[0])), y0 = Math.min(...ft.map((q) => q[1])), y1 = Math.max(...ft.map((q) => q[1]));
                                for (const q of mt.laposSav) {
                                  const f = q.felteto ? { hajlas: q.felteto.hajlas, lejt: q.felteto.lejt } : undefined;
                                  if (q.tengely === 'x') { if (q.a <= x0 + 0.6) sav[270] = { w: q.b - x0, f }; else if (q.b >= x1 - 0.6) sav[90] = { w: x1 - q.a, f }; }
                                  else if (q.a <= y0 + 0.6) sav[0] = { w: q.b - y0, f }; else if (q.b >= y1 - 0.6) sav[180] = { w: y1 - q.a, f };
                                }
                              }
                              const tizes = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');
                              return <div style="flex-basis:100%;display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px">
                                <span>Lapostetős / féltetős sáv (a rajzon, a födém szélétől):</span>
                                {VEG.map(([ir, nev]) => {
                                  const ervenyes = sav[ir], kezi = MK.felteto?.[ir], felt = kezi === undefined ? ervenyes?.f : kezi ?? undefined;
                                  const lejtok: [number, string][] = ir === 90 || ir === 270 ? [[0, 'fel'], [180, 'le']] : [[90, 'jobbra'], [270, 'balra']];
                                  const allitF = (v: { hajlas: number; lejt: number } | null | undefined) => allit((k) => { const o = { ...(k.felteto ?? {}) }; if (v === undefined) delete o[ir]; else o[ir] = v; if (Object.keys(o).length) k.felteto = o; else delete k.felteto; return k; });
                                  return <span style="display:inline-flex;align-items:center;gap:4px">{nev}
                                    <input type="number" step="0.1" min="0" max="100" style="width:64px" aria-label={`Lapostetős sáv szélessége, ${nev} (m)`} placeholder={ervenyes ? tizes(ervenyes.w) : '–'} value={MK.lapos?.[ir] ?? ''} onInput={(e) => { const v = szam((e.target as HTMLInputElement).value); allit((k) => { const o = { ...(k.lapos ?? {}) }; if (v === undefined) delete o[ir]; else o[ir] = Math.max(0, Math.min(100, v)); if (Object.keys(o).length) k.lapos = o; else delete k.lapos; return k; }); }} /> m
                                    {(ervenyes || (MK.lapos?.[ir] ?? 0) > 0) && <select style="width:auto;display:inline-block" aria-label={`A sáv teteje, ${nev}`} value={kezi === undefined ? '' : kezi ? 'felteto' : 'lapos'} onChange={(e) => { const v = (e.target as HTMLSelectElement).value; allitF(v === '' ? undefined : v === 'lapos' ? null : { hajlas: felt?.hajlas ?? 10, lejt: felt?.lejt ?? lejtok[1]![0] }); }}>
                                      <option value="">felismert ({ervenyes?.f ? `féltető ${tizes(ervenyes.f.hajlas)}°` : 'lapos'})</option><option value="lapos">lapostető</option><option value="felteto">féltető</option>
                                    </select>}
                                    {kezi && <><input type="number" step="1" min="1" max="45" style="width:56px" aria-label={`Féltető hajlása, ${nev} (fok)`} value={kezi.hajlas} onInput={(e) => { const v = szam((e.target as HTMLInputElement).value); if (v !== undefined && v > 0) allitF({ ...kezi, hajlas: Math.min(45, v) }); }} />° lejt
                                      <select style="width:auto;display:inline-block" aria-label={`Féltető lejtése, ${nev}`} value={String(kezi.lejt)} onChange={(e) => allitF({ ...kezi, lejt: Number((e.target as HTMLSelectElement).value) })}>{lejtok.map(([l, n]) => <option value={String(l)}>{n}</option>)}</select></>}
                                  </span>;
                                })}
                              </div>;
                            })()}
                            {md.szintek.filter((sz) => sz.kod !== 'T' || !mt).map((sz) => (
                              <label>{szintNev(sz.id)} belmagassága: <input type="number" step="0.05" min="1.8" max="15" style={inp} aria-label={`${szintNev(sz.id)} belmagassága (m)`} placeholder={String(sz.belmag).replace('.', ',')} value={MK.belmag?.[sz.id] ?? ''} onInput={(e) => { const v = szam((e.target as HTMLInputElement).value); allit((k) => { const b = { ...(k.belmag ?? {}) }; if (v === undefined || v < 1.8) delete b[sz.id]; else b[sz.id] = Math.min(15, v); if (Object.keys(b).length) k.belmag = b; else delete k.belmag; return k; }); }} /> m</label>
                            ))}
                            {Object.keys(MK).length > 0 && <button class="gomb kis-gomb halk-gomb" onClick={() => setModellKezi({})}>vissza a felismertre</button>}
                          </div>
                          {mt?.oromElvetve && <div role="status" style="font-size:13px;margin-top:6px;color:#B45309">A kért oromfal ezen az alaprajzon nem állítható elő szabályos tetőfelülettel – kontyolt tetőt számoltam.</div>}
                          {(() => { const el = md.nyilasok.filter((n) => n.pmAlaprajz !== undefined); const cm = (v: number) => (Math.round(v * 100) / 100).toFixed(2).replace('.', ',');
                            return el.length > 0 && <div role="status" style="font-size:13px;margin-top:6px;color:#B45309">A homlokzat szerint {el.length} ablak mellvédmagassága eltér az alaprajzi feliratétól – a modell a homlokzatét veszi: {(() => { const cs = new Map<string, number>(); for (const n of el) { const k = `${Math.round(n.szel * 100)}/${Math.round(n.mag * 100)} (${szintNev(n.szint)}): ${cm(n.pmAlaprajz!)} → ${cm(n.pm)} m`; cs.set(k, (cs.get(k) ?? 0) + 1); }
                              const l = [...cs].map(([k, db]) => (db > 1 ? `${db} × ${k}` : k)); return l.slice(0, 8).join('; ') + (l.length > 8 ? ' …' : ''); })()}.</div>; })()}
                          {(() => { const el = md.nyilasok.filter((n) => n.homlokzat !== undefined); if (!el.length) return null; const cm = (v: number) => String(Math.round(v * 100));
                            const cs = new Map<string, { db: number; n: (typeof el)[number] }>(); for (const n of el) { const h = n.homlokzat; const k = `${cm(n.szel)}/${cm(n.mag)} ${n.fajta === 'ablak' ? 'ablak' : 'erkélyajtó'} (${szintNev(n.szint)}): ${h ? `a homlokzaton ${cm(h.szel)}/${cm(h.mag)}` : 'a homlokzaton nincs a helyén keret'}`; const c = cs.get(k); if (c) c.db++; else cs.set(k, { db: 1, n }); }
                            return <div role="status" style="font-size:13px;margin-top:6px;color:#B45309">A homlokzati rajz szerint {el.length} nyílászáró mérete vagy helye nem egyezik az alaprajzi feliratával – ellenőrizd (kattintásra kijelöli): {[...cs].slice(0, 10).map(([k, { db, n }], j) => <>{j > 0 && '; '}<a href="#" onClick={(e) => { e.preventDefault(); if (n.forras) { setKivNy({ lap: n.forras.lap, ny: n.forras.ny }); if (n.forras.lap !== aIdx && n.forras.lap >= 0) setAIdx(n.forras.lap); } }}>{db > 1 ? `${db} × ` : ''}{k}</a></>)}{cs.size > 10 ? ' …' : ''}.</div>; })()}
                          <div class="halkabb" style="font-size:13px;margin-top:6px">A körvonal (falak, födémek, tető alaprajza) a 2D nézetben a „Hőburok szerkesztése” gombbal javítható: pont húzása, beszúrása (kattintás az élre), törlése (dupla kattintás), él eltolása (a fehér négyzet húzása).</div>
                        </details>
                      );
                    })()}</div>;
                }
                const szint3 = modellSzintek(meretMod);
                if (!szint3) return <div class="kartya halkabb" style="padding:60px 16px 16px">A 3D nézethez a lap léptéke és a felismert falak kellenek (add meg a méretarányt).</div>;
                const vanPol = szint3.some((x) => x.poligonok.length);
                return <div class="kartya" style="padding:0;overflow:hidden;position:relative">{valto}{vanPol ? <Burok3D szintek={szint3} eszakSzog={eszakSz} meretMod={meretMod} onMeretMod={setMeretMod} magassag={Math.round(Math.min(760, Math.max(rogzit ? 300 : 420, (typeof window !== 'undefined' ? window.innerHeight : 800) * (rogzit ? 0.5 : 0.72))))} /> : <div class="halkabb" style="padding:60px 16px 16px">Még nincs hőburok-körvonal – a 2D nézetben a „Hőburok rajzolása” gombbal megrajzolhatod.</div>}</div>;
            })()
            ) : (
            <div class="kartya" style={`padding:0;overflow:auto;max-height:${rogzit ? 52 : 80}vh;position:relative`}>
              {osszevon && (
                <div role="alertdialog" aria-label="Pontok összevonása" style="position:sticky;top:8px;left:8px;z-index:6;display:inline-flex;gap:10px;align-items:center;margin:8px;background:#fff;border:1px solid #F97316;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.18);padding:8px 12px">
                  <strong>Két pont egymáson – összevonjam?</strong>
                  <button class="gomb" onClick={() => { const { b, p: pi, v } = osszevon; burokMent(b.map((z, zi) => (zi === pi ? z.filter((_, j) => j !== v) : z))); setOsszevon(null); }}>Igen, egyesítsd</button>
                  <button class="gomb halk-gomb" onClick={() => { burokMent(osszevon.b); setOsszevon(null); }}>Nem</button>
                </div>
              )}
              {menu && menu.i === -1 && menu.kulcsok && (
                <div role="menu" aria-label="Fel nem ismert terület besorolása" style={`position:absolute;left:${Math.max(4, menu.x + 8)}px;top:${menu.y + 8}px;z-index:5;background:#fff;border:1px solid #D1D5DB;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.18);padding:6px;min-width:260px`} onClick={(e) => e.stopPropagation()}>
                  <div style="font-weight:700;padding:4px 8px 6px">Helyiségként fel nem ismert terület {menu.kulcsok.length > 0 && <span class="halkabb" style="font-weight:400;display:block">{menu.kulcsok.length} bizonytalan falszakasz mellette</span>}</div>
                  {menu.px !== undefined && ([['Lépcső', 'Lépcső – fűtött helyiségként felveszem'], ['Helyiség', 'Egyéb fűtött helyiségként felveszem']] as const).map(([nev, cimke]) => (
                    <button role="menuitem" class="link-gomb" key={nev} style="display:flex;align-items:center;gap:8px;width:100%;text-align:left;padding:6px 8px;border-radius:6px"
                      onClick={() => { const p = { x: menu.px!, y: menu.py! }; setMenu(null); pluszFelvesz(nev, p.x, p.y); }}><span style={`display:inline-block;width:14px;height:14px;border-radius:3px;background:${SZEREP_SZIN.futott}`} /> {cimke}</button>
                  ))}
                  {menu.kulcsok.length > 0 && ([['kulter', 'Kültér – a mellette lévő falak külső falak', '#22C55E', true], ['nem', 'Fűtött / szomszéd tér – nem hőátadó fal', '#9CA3AF', false]] as const).map(([k0, nev, szin, be]) => {
                    const aktiv = be === menu.kulcsok!.every((kk) => kj.ismKulso?.has(kk));
                    return <button role="menuitemradio" aria-checked={aktiv} class="link-gomb" key={k0} style={`display:flex;align-items:center;gap:8px;width:100%;text-align:left;padding:6px 8px;border-radius:6px;${aktiv ? 'background:#F3F4F6;font-weight:700' : ''}`}
                      onClick={() => { setIsmKulso(menu.kulcsok!, be); setMenu(null); }}><span style={`display:inline-block;width:14px;height:14px;border-radius:3px;background:${szin}`} /> {nev}</button>;
                  })}
                </div>
              )}
              {menu && menu.i >= 0 && helyisegek[menu.i] && (
                <div role="menu" aria-label={`${helyisegek[menu.i]!.nev} besorolása`} style={`position:absolute;left:${Math.max(4, menu.x + 8)}px;top:${menu.y + 8}px;z-index:5;background:#fff;border:1px solid #D1D5DB;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.18);padding:6px;min-width:230px`} onClick={(e) => e.stopPropagation()}>
                  <div style="font-weight:700;padding:4px 8px 6px">{helyisegek[menu.i]!.kod ? `${helyisegek[menu.i]!.kod} ` : ''}{helyisegek[menu.i]!.nev} <span class="halkabb" style="font-weight:400">· {sz(helyisegek[menu.i]!.A)} m²</span></div>
                  {SZEREPEK.map((o) => (
                    <button role="menuitemradio" aria-checked={szerep(menu.i) === o.ertek} class="link-gomb" style={`display:flex;align-items:center;gap:8px;width:100%;text-align:left;padding:6px 8px;border-radius:6px;${szerep(menu.i) === o.ertek ? 'background:#F3F4F6;font-weight:700' : ''}`}
                      onClick={() => { setSzerep(menu.i, o.ertek); setMenu(null); }}>
                      <span style={`display:inline-block;width:14px;height:14px;border-radius:3px;background:${o.szin}`} /> {o.nev}
                    </button>
                  ))}
                </div>
              )}
              <svg viewBox={nezet.join(' ')} style={`display:block;width:100%;height:auto;background:#fff;${burokSzerk || rajzol ? 'touch-action:none;' : ''}${rajzol ? 'cursor:crosshair' : ''}`} role="img" aria-label="Az alaprajz a felismert elemekkel"
                onPointerMove={(e) => {
                  if (!huz) return;
                  const svg = e.currentTarget as SVGSVGElement; const m = svg.getScreenCTM(); if (!m) return;
                  const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
                  // fogás: a képernyőn 14 px-en belüli másik pontra pontosan rá, különben a közeli élre (merőleges vetítéssel)
                  const fr = 14 / Math.max(1e-6, Math.hypot(m.a, m.b));
                  if (huz.el) {
                    // él eltolása a normálisa mentén; fogás: a más pontokon átmenő párhuzamos egyenesre
                    const q0 = huz.el.orig[huz.p]!, A = q0[huz.v]!, B = q0[(huz.v + 1) % q0.length]!;
                    const L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1, n: [number, number] = [-(B[1] - A[1]) / L, (B[0] - A[0]) / L];
                    let d = (pt.x - huz.el.kezd[0]) * n[0] + (pt.y - huz.el.kezd[1]) * n[1], cel: { x: number; y: number; tipus: 'pont' | 'el' } | null = null, dMin = fr;
                    huz.el.orig.forEach((q, pi) => q.forEach(([x, y], vi) => {
                      if (pi === huz.p && (vi === huz.v || vi === (huz.v + 1) % q0.length)) return;
                      const dd = (x - A[0]) * n[0] + (y - A[1]) * n[1]; if (Math.abs(dd - d) < dMin) { dMin = Math.abs(dd - d); cel = { x, y, tipus: 'pont' }; }
                    }));
                    if (cel) d = ((cel as { x: number }).x - A[0]) * n[0] + ((cel as { y: number }).y - A[1]) * n[1]; else d = Math.round(d * 10) / 10;
                    setFogas(cel);
                    const u = huz.el.orig.map((q) => q.map((v) => [...v] as [number, number]));
                    // a két végpont a szomszédos élek egyenesén csúszik (a szomszéd élek iránya marad); párhuzamos szomszédnál a normális mentén
                    const nn = q0.length, e: [number, number] = [(B[0] - A[0]) / L, (B[1] - A[1]) / L];
                    for (const [vi, wi] of [[huz.v, (huz.v - 1 + nn) % nn], [(huz.v + 1) % nn, (huz.v + 2) % nn]] as const) {
                      const P = q0[vi]!, W = q0[wi]!, s0: [number, number] = [P[0] + n[0] * d, P[1] + n[1] * d];
                      const g: [number, number] = [W[0] - P[0], W[1] - P[1]], det = e[0] * g[1] - e[1] * g[0];
                      let np = s0;
                      if (Math.abs(det) > 1e-6 * Math.hypot(g[0], g[1])) { const t = ((P[0] - s0[0]) * g[1] - (P[1] - s0[1]) * g[0]) / det; np = [s0[0] + e[0] * t, s0[1] + e[1] * t]; }
                      u[huz.p]![vi] = [Math.round(np[0] * 100) / 100, Math.round(np[1] * 100) / 100];
                    }
                    setBurokVazlat(u); return;
                  }
                  const alap = burokVazlat ?? burok;
                  let cel: { x: number; y: number; tipus: 'pont' | 'el' } | null = null, dMin = fr;
                  alap.forEach((q, pi) => q.forEach(([x, y], vi) => { if (pi === huz.p && vi === huz.v) return; const d = Math.hypot(x - pt.x, y - pt.y); if (d < dMin) { dMin = d; cel = { x, y, tipus: 'pont' }; } }));
                  if (!cel) {
                    dMin = fr;
                    alap.forEach((q, pi) => q.forEach(([x, y], vi) => {
                      const vj = (vi + 1) % q.length; const [x2, y2] = q[vj]!;
                      if (pi === huz.p && (vi === huz.v || vj === huz.v)) return; // a húzott pont saját élei nem
                      const dx = x2 - x, dy = y2 - y, L2 = dx * dx + dy * dy; if (L2 < 1e-9) return;
                      const t = Math.max(0, Math.min(1, ((pt.x - x) * dx + (pt.y - y) * dy) / L2));
                      const px = x + dx * t, py = y + dy * t, d = Math.hypot(px - pt.x, py - pt.y);
                      if (d < dMin) { dMin = d; cel = { x: px, y: py, tipus: 'el' }; }
                    }));
                  }
                  setFogas(cel);
                  const uj: [number, number] = cel ? [(cel as { x: number }).x, (cel as { y: number }).y] : [Math.round(pt.x * 10) / 10, Math.round(pt.y * 10) / 10];
                  setBurokVazlat((b) => { const u = (b ?? burok).map((q) => q.map((v) => [...v] as [number, number])); u[huz.p]![huz.v] = uj; return u; });
                }}
                onClick={(e) => {
                  if (Date.now() - huzIdo.current < 400) return;
                  const svg = e.currentTarget as SVGSVGElement; const m = svg.getScreenCTM(); if (!m) return;
                  const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
                  if (!rajzol) {
                    // kattintás a rajzon: a helyiség, amelybe esik, kiemelve a helyiséglistában
                    const r = al.r; if (!r) return;
                    const cx = Math.floor((pt.x - r.x0) * r.mPerPt / r.px), cy = Math.floor((pt.y - r.y0) * r.mPerPt / r.px);
                    const c = cx >= 0 && cy >= 0 && cx < r.w && cy < r.h ? r.cimke[cy * r.w + cx]! : 0;
                    const i = c >= 2 ? helyisegek.indexOf(al.magHelyisegek[c - 2]!) : -1;
                    setKivH(i >= 0 && i !== kivH ? i : null);
                    // besorolás-menü a kattintás helyén (a rajz-konténerhez viszonyítva); a lap nem görgetődik
                    const kont = (svg.parentElement as HTMLElement | null); const kr = kont?.getBoundingClientRect();
                    const hely = kont && kr ? { x: e.clientX - kr.left + kont.scrollLeft, y: e.clientY - kr.top + kont.scrollTop } : null;
                    if (i >= 0 && hely) setMenu({ i, ...hely });
                    // helyiségként fel nem ismert, zárt (vagy félig zárt) terület: a mellette lévő bizonytalan falak külső falként
                    else if ((c === 0 || (c === 1 && burok.some((p) => bennE(p, pt.x, pt.y)))) && hely && cx >= 0 && cy >= 0 && cx < r.w && cy < r.h && !r.fal[cy * r.w + cx]) {
                      // (a hőburkon belüli, a külső térhez szivárgó vagy zárt, pecsét nélküli terület is – pl. lépcső)
                      const kulcsok = c === 0 ? teruletKulcsok(r, cx, cy) : [];
                      setMenu({ i: -1, kulcsok, px: pt.x, py: pt.y, ...hely });
                    } else setMenu(null);
                    // a helyiséglista sora kiemelve; csak a lista saját görgetősávja mozdul (a lap nem ugrik)
                    if (i >= 0) setTimeout(() => { const sor = document.getElementById(`hs-sor-${i}`); const g = sor?.closest('.tabla-gorgeto') as HTMLElement | null; if (sor && g && g.scrollHeight > g.clientHeight) g.scrollTop = Math.max(0, sor.offsetTop - g.clientHeight / 2); }, 30);
                    return;
                  }
                  const p0 = rajzol[0];
                  // az első pontra kattintva (vagy dupla kattintással) a körvonal bezárul
                  if (p0 && rajzol.length >= 3 && Math.hypot(pt.x - p0[0], pt.y - p0[1]) < 12 * fogo) { burokMent([...(kj.burok ?? burokFelismert), rajzol]); setRajzol(null); return; }
                  setRajzol([...rajzol, [Math.round(pt.x * 10) / 10, Math.round(pt.y * 10) / 10]]);
                }}
                onDblClick={() => { if (rajzol && rajzol.length >= 3) { burokMent([...(kj.burok ?? burokFelismert), rajzol]); setRajzol(null); } }}
                onPointerUp={() => huzVege()}
                onPointerLeave={() => huzVege()}>
                <image href={aLap.kep} x={0} y={0} width={aLap.lap.szel} height={aLap.lap.mag} />
                {al.r && (retegek.size > 0 || kivH !== null) && (() => {
                  const r = al.r; const W = r.w * r.px / r.mPerPt, H = r.h * r.px / r.mPerPt; const m = 1 / r.mPerPt;
                  const korv = (minta: string, szin: string) => burok.map((q) => <polygon points={q.map(([x, y]) => `${x},${y}`).join(' ')} fill={`url(#${minta})`} stroke={szin} stroke-width={3} vector-effect="non-scaling-stroke" stroke-dasharray="10 4" />);
                  return (
                    <g pointer-events="none">
                      <defs>
                        <pattern id="rt-padlo" width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width={8} height={8} fill="#15803D" fill-opacity={0.08} /><line x1={0} y1={0} x2={0} y2={8} stroke="#15803D" stroke-width={1.6} stroke-opacity={0.45} /></pattern>
                        <pattern id="rt-fodem" width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width={8} height={8} fill="#7C3AED" fill-opacity={0.08} /><line x1={0} y1={0} x2={0} y2={8} stroke="#7C3AED" stroke-width={1.6} stroke-opacity={0.45} /></pattern>
                        <pattern id="rt-teto" width={10} height={10} patternUnits="userSpaceOnUse"><rect width={10} height={10} fill="#92400E" fill-opacity={0.08} /><line x1={0} y1={5} x2={10} y2={5} stroke="#92400E" stroke-width={1.6} stroke-opacity={0.45} /></pattern>
                      </defs>
                      {retegek.has('padlo') && padloAt && korv('rt-padlo', '#15803D')}
                      {retegek.has('fodem') && tetoAt && !tetoterLapE && korv('rt-fodem', '#7C3AED')}
                      {retegek.has('teto') && tetoAt && tetoterLapE && korv('rt-teto', '#92400E')}
                      {kivH !== null && kivKep && <image href={kivKep} x={r.x0} y={r.y0} width={W} height={H} preserveAspectRatio="none" style="image-rendering:pixelated" />}
                    {retegek.has('helyiseg') && helyisegKep && <image href={helyisegKep} x={r.x0} y={r.y0} width={W} height={H} preserveAspectRatio="none" style="image-rendering:pixelated" />}
                      {(retegek.has('nyilas') || retegek.has('helyiseg')) && nyilasKep && <image href={nyilasKep} x={r.x0} y={r.y0} width={W} height={H} preserveAspectRatio="none" style="image-rendering:pixelated" />}
                      {retegek.has('fal') && falKep && <image href={falKep} x={r.x0} y={r.y0} width={W} height={H} preserveAspectRatio="none" style="image-rendering:pixelated" />}
                      {retegek.has('helyiseg') && helyisegek.map((h, i) => {
                        if (h.kulter) return null; const pt = h.mutato ?? h; const ri = raszterIdx(i);
                        const Ar = ri >= 0 ? r.helyisegek[ri]!.A : null; const c = ri >= 0 ? SZEREP_SZIN[szerep(i)] : '#111827';
                        return (
                          <text x={pt.x} y={pt.y - 6 * fogo} font-size={9 * fogo} text-anchor="middle" fill={c} font-family="system-ui" font-weight="700" paint-order="stroke" stroke="#fff" stroke-width={3 * fogo}>
                            {h.nev} · {sz(h.hasznosA ?? h.A, 2)} m²{szerep(i) !== 'futott' ? ` · ${SZEREPEK.find((o) => o.ertek === szerep(i))!.nev.toLowerCase()}` : ''}{Ar !== null && Math.abs(Ar - h.A) > Math.max(0.5, 0.1 * h.A) ? ` (rajzon ${sz(Ar, 1)})` : ''}{ri < 0 ? ' (helye nem ismert)' : ''}
                          </text>
                        );
                      })}
                      {retegek.has('nyilas') && al.nyilasok.map((n) => {
                        const ki = nyilasok.find((x) => x.n === n); const atvesz = !!ki && !kizartNy.has(ki.k);
                        const c = atvesz ? NYILAS_SZIN[n.fajta] ?? '#0EA5E9' : '#9CA3AF';
                        const vizsz = n.irany === 0 || n.irany === 180 || (n.irany === null && n.fal === 'v');
                        const v = 0.3 * m; // legalább 0,3 m vastag keret a fal irányára merőlegesen
                        let [x0, y0, x1, y1] = n.hely ?? (vizsz ? [n.x - n.szel * m / 2, n.y - v / 2, n.x + n.szel * m / 2, n.y + v / 2] : [n.x - v / 2, n.y - n.szel * m / 2, n.x + v / 2, n.y + n.szel * m / 2]);
                        if (vizsz && y1 - y0 < v) { const c0 = (y0 + y1) / 2; y0 = c0 - v / 2; y1 = c0 + v / 2; }
                        if (!vizsz && x1 - x0 < v) { const c0 = (x0 + x1) / 2; x0 = c0 - v / 2; x1 = c0 + v / 2; }
                        // ferde falban a nyílás is ferde: a legközelebbi (1,5 m-en belüli) burokél irányába forgatva
                        const kx = (x0 + x1) / 2, ky = (y0 + y1) / 2; let fordit = 0;
                        { let leg = 1.5 * m; for (const q of burok) for (let k = 0; k < q.length; k++) { const A = q[k]!, B = q[(k + 1) % q.length]!; const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy); if (L < 1e-6) continue; const t = Math.max(0, Math.min(1, ((kx - A[0]) * dx + (ky - A[1]) * dy) / (L * L))); const d = Math.hypot(A[0] + dx * t - kx, A[1] + dy * t - ky); if (d < leg) { leg = d; const sz0 = (Math.atan2(dy, dx) * 180) / Math.PI; const r90 = ((sz0 % 90) + 90) % 90; fordit = r90 > 3 && r90 < 87 ? (r90 > 45 ? r90 - 90 : r90) : 0; } } }
                        if (fordit) { const w = n.szel * m, hh = v; x0 = kx - (vizsz ? w : hh) / 2; x1 = kx + (vizsz ? w : hh) / 2; y0 = ky - (vizsz ? hh : w) / 2; y1 = ky + (vizsz ? hh : w) / 2; }
                        return (
                          <g transform={fordit ? `rotate(${fordit} ${kx} ${ky})` : undefined}>
                            <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill={c} fill-opacity={0.22} stroke={c} stroke-width={2} vector-effect="non-scaling-stroke" stroke-dasharray={n.mert || !n.hely ? '4 3' : undefined} />
                            {!atvesz && <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={c} stroke-width={1.5} vector-effect="non-scaling-stroke" />}
                            <text x={(x0 + x1) / 2} y={vizsz ? (n.irany === 0 ? y0 - 3 * fogo : y1 + 9 * fogo) : (y0 + y1) / 2} dx={vizsz ? 0 : (n.irany === 270 ? -4 * fogo : 4 * fogo)} font-size={8 * fogo} text-anchor={vizsz ? 'middle' : n.irany === 270 ? 'end' : 'start'} fill={c} font-family="system-ui" font-weight="600" paint-order="stroke" stroke="#fff" stroke-width={2.5 * fogo}>
                              {Math.round(n.szel * 100)}×{n.mag > 0 ? Math.round(n.mag * 100) : '?'}{atvesz ? '' : n.kulso ? ' (kizárva)' : ' (belső)'}{(ki?.n ?? n).iranyTipp && atvesz ? ' · tájolás?' : ''}
                            </text>
                          </g>
                        );
                      })}
                      {retegek.has('tetoablak') && tetoablakJeloltek.map((f) => (
                        <g>
                          <rect x={f.x - f.szel * m / 2} y={f.y - f.mag * m / 2} width={f.szel * m} height={f.mag * m} fill="#DB2777" fill-opacity={0.2} stroke="#DB2777" stroke-width={2} vector-effect="non-scaling-stroke" />
                          <text x={f.x} y={f.y - f.mag * m / 2 - 3 * fogo} font-size={8 * fogo} text-anchor="middle" fill="#DB2777" font-family="system-ui" font-weight="600" paint-order="stroke" stroke="#fff" stroke-width={2.5 * fogo}>tetőablak {Math.round(f.szel * 100)}×{Math.round(f.mag * 100)}</text>
                        </g>
                      ))}
                    </g>
                  );
                })()}
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
                {(retegek.has('burok') || rajzol || huz) && burok.map((q, pi) => (
                  <g>
                    {/* a vonal a nagyítástól függetlenül vastag (képernyő-pixelben): fehér kontúr + lila */}
                    {(() => {
                      // a megjelenített sík a méretezés szerint: belső méret – a fal belső síkja (mért), külső – a körvonal; szerkesztéskor mindig a körvonal
                      const belsoQ = meretMod === 'belso' && !burokSzerk && !rajzol && !huz && burokMert[pi]?.length === q.length ? burokMert[pi]!.map((e) => e.belso[0]) : null;
                      const pts = (belsoQ ?? q).map(([x, y]) => `${x},${y}`).join(' ');
                      return <>
                        {belsoQ && <polygon points={q.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke="#F97316" stroke-width={1.5} vector-effect="non-scaling-stroke" stroke-dasharray="4 3" pointer-events="none" opacity={0.6} />}
                        <polygon points={pts} fill="none" stroke="#fff" stroke-width={10} vector-effect="non-scaling-stroke" stroke-linejoin="round" pointer-events="none" opacity={0.9} />
                        <polygon points={pts} fill="#F97316" fill-opacity={0.08} stroke="#F97316" stroke-width={kj.burok ? 7 : 6} vector-effect="non-scaling-stroke" stroke-linejoin="round" pointer-events="none" />
                      </>;
                    })()}
                    {burokSzerk && q.map(([x, y], vi) => { const [x2, y2] = q[(vi + 1) % q.length]!; return (
                      <line x1={x} y1={y} x2={x2} y2={y2} stroke="#F97316" stroke-opacity={0.001} stroke-width={16} vector-effect="non-scaling-stroke" style="cursor:copy"
                        onPointerDown={(e) => {
                          // élre kattintás: új pont a kattintás helyén (az élre vetítve); lenyomva tartva rögtön húzható
                          e.stopPropagation();
                          const svg = (e.currentTarget as SVGGraphicsElement).ownerSVGElement; const m = svg?.getScreenCTM(); if (!svg || !m) return;
                          svg.setPointerCapture?.(e.pointerId);
                          const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
                          const dx = x2 - x, dy = y2 - y, L2 = dx * dx + dy * dy || 1;
                          const t = Math.min(0.98, Math.max(0.02, ((pt.x - x) * dx + (pt.y - y) * dy) / L2));
                          const u = burok.map((z) => z.map((v) => [...v] as [number, number]));
                          u[pi]!.splice(vi + 1, 0, [Math.round((x + dx * t) * 10) / 10, Math.round((y + dy * t) * 10) / 10]);
                          setBurokVazlat(u); setHuz({ p: pi, v: vi + 1 });
                        }}>
                        <title>Kattints az élre: új pont beszúrása (lenyomva tartva húzható)</title>
                      </line>
                    ); })}
                    {burokSzerk && !huz && q.map(([x, y], vi) => { const [x2, y2] = q[(vi + 1) % q.length]!; const L = Math.hypot(x2 - x, y2 - y); if (L < 24 * fogo) return null;
                      const a = 4.5 * fogo, fugg = Math.abs(y2 - y) > Math.abs(x2 - x); return (
                      <rect x={(x + x2) / 2 - a} y={(y + y2) / 2 - a} width={2 * a} height={2 * a} fill="#fff" stroke="#F97316" stroke-width={2} vector-effect="non-scaling-stroke" style={`cursor:${fugg ? 'ew-resize' : 'ns-resize'}`}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          const svg = (e.currentTarget as SVGGraphicsElement).ownerSVGElement; const m = svg?.getScreenCTM(); if (!svg || !m) return;
                          svg.setPointerCapture?.(e.pointerId);
                          const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
                          setHuz({ p: pi, v: vi, el: { kezd: [pt.x, pt.y], orig: burok.map((z) => z.map((v) => [...v] as [number, number])) } });
                        }}>
                        <title>Húzd: az él párhuzamos eltolása (a szomszédos élek követik)</title>
                      </rect>
                    ); })}
                    {burokSzerk && q.map(([x, y], vi) => (
                      <circle cx={x} cy={y} r={7 * fogo} fill="#F97316" stroke="#fff" stroke-width={2} vector-effect="non-scaling-stroke" style="cursor:move"
                        onPointerDown={(e) => { e.stopPropagation(); (e.currentTarget as SVGGraphicsElement).ownerSVGElement?.setPointerCapture?.(e.pointerId); setHuz({ p: pi, v: vi }); }}
                        onDblClick={(e) => { e.stopPropagation(); if (q.length <= 3) return; burokMent(burok.map((z, zi) => (zi === pi ? z.filter((_, j) => j !== vi) : z))); }}>
                        <title>Húzd a pontot; dupla kattintás: pont törlése</title>
                      </circle>
                    ))}
                  </g>
                ))}
                {huz && fogas && <circle cx={fogas.x} cy={fogas.y} r={13 * fogo} fill="none" stroke={fogas.tipus === 'pont' ? '#DC2626' : '#2563EB'} stroke-width={2.5} vector-effect="non-scaling-stroke" pointer-events="none" />}
                {/* mért belső falsíkok: zöld szaggatott = fal megtalálva; piros = ennél az élnél nincs falsáv (a hossz bizonytalan) */}
                {retegek.has('burok') && burokMert.flatMap((l, pi) => l.map((e) => ({ e, q: burok[pi]! }))).filter(({ e }) => e.rajzolt >= 0.8).map(({ e, q }) => {
                  const kulsoM = meretMod === 'kulso';
                  const [a, b2] = kulsoM ? [q[e.i]!, q[(e.i + 1) % q.length]!] : e.belso; const mx = (a[0] + b2[0]) / 2, my = (a[1] + b2[1]) / 2; const jo = e.lefedett >= 0.3;
                  const fugg = Math.abs(b2[1] - a[1]) > Math.abs(b2[0] - a[0]);
                  return (
                    <g pointer-events="none">
                      <line x1={a[0]} y1={a[1]} x2={b2[0]} y2={b2[1]} stroke={jo ? '#059669' : '#DC2626'} stroke-width={2.5} vector-effect="non-scaling-stroke" stroke-dasharray="6 4" />
                      <text x={mx} y={my} transform={fugg ? `rotate(-90 ${mx} ${my})` : undefined} dy={-4 * fogo} font-size={10 * fogo} text-anchor="middle" fill={jo ? '#065F46' : '#B91C1C'} font-family="system-ui" font-weight="600" paint-order="stroke" stroke="#fff" stroke-width={3 * fogo}>
                        {sz(kulsoM ? e.rajzolt : e.hossz)} m{e.vastag !== null ? ` · ${Math.round(e.vastag * 100)} cm` : ' · nincs fal'}
                      </text>
                    </g>
                  );
                })}
                {rajzol && rajzol.length > 0 && (
                  <g pointer-events="none">
                    <polyline points={rajzol.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke="#F97316" stroke-width={5} vector-effect="non-scaling-stroke" stroke-dasharray="8 5" />
                    {rajzol.map(([x, y], i) => <circle cx={x} cy={y} r={(i === 0 ? 9 : 6) * fogo} fill={i === 0 ? '#fff' : '#F97316'} stroke="#F97316" stroke-width={2} vector-effect="non-scaling-stroke" />)}
                  </g>
                )}
                {!retegek.has('nyilas') && nyilasok.map(({ n, k }) => (
                  <g opacity={kizartNy.has(k) ? 0.3 : 1} style="cursor:pointer" onClick={(e) => { e.stopPropagation(); setKivNy(kivNy?.lap === aIdx && kivNy.ny === k ? null : { lap: aIdx, ny: k }); }}>
                    {kivNy?.lap === aIdx && kivNy.ny === k && <rect x={n.x - 13} y={n.y - 8} width={26} height={16} rx={3} fill="none" stroke="#F97316" stroke-width={3} vector-effect="non-scaling-stroke" />}
                    <rect x={n.x - 9} y={n.y - 4} width={18} height={8} rx={1.5} fill={n.fajta === 'ablak' ? '#0EA5E9' : n.fajta === 'erkelyajto' ? '#6366F1' : n.fajta === 'garazskapu' ? '#475569' : '#B45309'} opacity={0.85} />
                    <text x={n.x} y={n.y + 2.2} font-size={5.5} text-anchor="middle" fill="#fff" font-family="system-ui">{Math.round(n.szel * 100)}×{n.mag > 0 ? Math.round(n.mag * 100) : n.mert ? '?' : 'belm.'}</text>
                  </g>
                ))}
                <g transform={`translate(${ejX} ${ejY})`}>
                  {/* (a kör átlátszó: alatta a terv saját északjele is látszik) */}
                  <circle r={nyilHossz * 0.75} fill={ej && ejX === ej.x ? 'none' : '#fff'} stroke="#B91C1C" stroke-width={nyilHossz * 0.04} opacity={0.9} />
                  <line x1={0} y1={0} x2={Math.sin(rad) * nyilHossz * 0.7} y2={-Math.cos(rad) * nyilHossz * 0.7} stroke="#B91C1C" stroke-width={nyilHossz * 0.08} />
                  <text x={Math.sin(rad) * nyilHossz * 0.95} y={-Math.cos(rad) * nyilHossz * 0.95 + nyilHossz * 0.12} font-size={nyilHossz * 0.35} text-anchor="middle" fill="#B91C1C" font-weight="700" font-family="system-ui">É</text>
                </g>
                {/* az AI-ellenőrzés által megjelölt helyek (a kivágat képpontjaiból lapkoordinátába) */}
                {ai?.valasz && ai.kiv && (ai.valasz.hibak ?? []).map((h, j) => {
                  if (!Array.isArray(h.hely) || h.hely.length !== 4 || !h.hely.every((v) => Number.isFinite(v))) return null;
                  const { nezet: kn, W, H } = ai.kiv!; const tx = (x: number) => kn[0] + (x / W) * kn[2], ty = (y: number) => kn[1] + (y / H) * kn[3];
                  const xa = tx(Math.min(h.hely[0]!, h.hely[2]!)), xb = tx(Math.max(h.hely[0]!, h.hely[2]!)), ya = ty(Math.min(h.hely[1]!, h.hely[3]!)), yb = ty(Math.max(h.hely[1]!, h.hely[3]!));
                  return (
                    <g style="pointer-events:none">
                      <rect x={xa} y={ya} width={Math.max(xb - xa, 4 * fogo)} height={Math.max(yb - ya, 4 * fogo)} fill="rgba(220,38,38,0.08)" stroke="#DC2626" stroke-width={3} stroke-dasharray="8 5" vector-effect="non-scaling-stroke" />
                      <circle cx={xa} cy={ya} r={11 * fogo} fill="#DC2626" />
                      <text x={xa} y={ya + 4.5 * fogo} font-size={13 * fogo} text-anchor="middle" fill="#fff" font-weight="700" font-family="system-ui">{j + 1}</text>
                    </g>
                  );
                })}
                {kivElem && epMd && elemAlakok(epMd).filter((e) => e.id === kivElem && e.lap === aIdx).flatMap((e) => e.poligonok.map((p) => <polygon points={p.map((q) => q.join(',')).join(' ')} fill="rgba(249,115,22,.25)" stroke="#F97316" stroke-width={3} vector-effect="non-scaling-stroke" pointer-events="none" />))}
              </svg>
            </div>
            )}
          </div>
          </div>
      )}
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
          {!nezet3d && <div class="gombsor" role="group" aria-label="Felismert elemek megjelenítése" style="margin:0 0 8px;gap:6px;flex-wrap:wrap;align-items:center">
            <strong style="font-size:13px;margin-right:4px">Felismert elemek a rajzon:</strong>
            {RETEGEK.map((rt) => (
              <button class={`gomb halk-gomb${retegek.has(rt.k) ? '' : ' semleges'}`} aria-pressed={retegek.has(rt.k)} onClick={() => retegValt(rt.k)} title={retegDb[rt.k]}>
                <span style={`display:inline-block;width:12px;height:12px;border:2px solid ${rt.szin};background:${rt.szin}33;border-radius:2px;vertical-align:-2px;margin-right:5px`} />
                {rt.nev} <span class="halkabb" style="font-weight:400">· {retegDb[rt.k]}</span>
              </button>
            ))}
            <button class="gomb halk-gomb semleges" onClick={() => setRetegek(new Set(RETEGEK.map((x) => x.k)))}>Mind</button>
            {retegek.has('helyiseg') && <span class="halkabb" style="font-size:12px;display:inline-flex;gap:10px;flex-wrap:wrap;margin-left:6px" aria-label="Helyiségek színe">{SZEREPEK.map((o) => <span><span style={`display:inline-block;width:10px;height:10px;border-radius:2px;background:${o.szin};vertical-align:-1px;margin-right:4px`} />{o.nev}</span>)} · kattints egy helyiségre a besoroláshoz</span>}
            <button class="gomb halk-gomb semleges" onClick={() => setRetegek(new Set())}>Egyik sem</button>
          </div>}
          {!nezet3d && [...retegek].some((k) => k !== 'burok') && <div class="halkabb" style="font-size:12px;margin:-2px 0 8px">Falak: piros – fal, szürke – külső sraffozott felület (járda, térkő, kavics), nem fal. Helyiségek: a hőburokbeli szerepük színével (fűtött, fűtetlen, szomszéd épület, kültér – kattintással állítható); a felirat mellett zárójelben a rajzon felismert terület, ha eltér a pecséttől. Nyílások: szaggatott keret – méretfelirat nélkül mért, vagy falnyíláshoz nem köthető; áthúzott – nem kerül át.</div>}
          <div class="gombsor" style="margin:8px 0 16px;gap:16px;flex-wrap:wrap">
            <button class={`gomb halk-gomb${rogzit ? '' : ' semleges'}`} aria-pressed={rogzit} onClick={() => setRogzit(!rogzit)} title="A 2D / 3D nézet görgetéskor a képernyő tetején marad">{rogzit ? 'Nézet rögzítve fent' : 'Nézet rögzítése fent'}</button>
            <button class="gomb halk-gomb semleges" onClick={() => setNagyit(!nagyit)}>{nagyit ? 'Teljes lap' : 'Nagyítás az épületre'}</button>
            <span style="display:inline-flex;gap:4px;align-items:center" title="A hőburok síkja a rajzon és a számításban (a 3D nézet kapcsolójával együtt vált): belső méret – a fal belső síkja, külső méret – a fal / hőszigetelés külső síkja.">
              {(['belso', 'kulso'] as const).map((mm) => <button aria-pressed={meretMod === mm} onClick={() => setMeretMod(mm)} style={`padding:3px 10px;font:600 12px system-ui;border:1px solid #D1D5DB;border-radius:6px;cursor:pointer;${meretMod === mm ? 'background:#1F2937;color:#fff' : 'background:#fff;color:#374151'}`}>{mm === 'belso' ? 'Belső méret' : 'Külső méret'}</button>)}
            </span>
            <button class={`gomb halk-gomb${burokSzerk ? '' : ' semleges'}`} aria-pressed={burokSzerk} onClick={() => { setBurokSzerk(!burokSzerk); if (!burokSzerk) setNagyit(true); }}>{burokSzerk ? 'Hőburok szerkesztése kész' : 'Hőburok szerkesztése'}</button>
            {kj.burok && <button class="gomb halk-gomb semleges" onClick={() => burokMent(undefined)}>Hőburok: vissza a felismertre</button>}
            <button class={`gomb halk-gomb${rajzol ? '' : ' semleges'}`} aria-pressed={!!rajzol} onClick={() => { if (rajzol) setRajzol(null); else { setRajzol([]); setBurokSzerk(false); setNagyit(true); } }}>{rajzol ? 'Rajzolás megszakítása' : 'Hőburok rajzolása'}</button>
            {rajzol && <span class="figyelmeztetes" style="margin:0">Kattints a hőburok sarokpontjaira a hőszigetelt fal külső síkján körbe; az első pontra kattintva (vagy dupla kattintással) a körvonal bezárul.</span>}
            {!burok.length && !rajzol && <span class="figyelmeztetes" style="margin:0">Zárt fűtött körvonalat nem ismertem fel ezen a lapon – a „Hőburok rajzolása” gombbal rajzold meg (ebből számolom a homlokzati falakat és a 3D nézetet).</span>}
            <span class="halkabb"><span style="display:inline-block;width:22px;height:6px;background:#F97316;vertical-align:middle;margin-right:4px;border-radius:2px" />hőburok {meretMod === 'belso' && !burokSzerk ? 'a fal belső síkján (szaggatott: külső sík)' : 'a fal külső síkján'} {kj.burok ? '(szerkesztett – a homlokzati falak és a külső nyílászárók ebből)' : '(felismert)'}</span>
            <span class="halkabb" title="A hőburok minden élénél a program megkeresi a valódi falsávot, és a fal belső síkján méri a hosszt (a sarkoknál a szomszédos belső síkok metszéspontjáig) és a falvastagságot. Zöld: a falsáv megvan; piros: az élnél nincs fal a rajzon (a hossz bizonytalan)."><span style="display:inline-block;width:18px;border-top:3px dashed #059669;vertical-align:middle;margin-right:4px" />mért falsík ({meretMod === 'kulso' ? 'külső' : 'belső'}): hossz · falvastagság (<span style="color:#DC2626">piros: nincs falsáv</span>)</span>
            {[0, 90, 180, 270].map((ir) => <span class="halkabb"><span style={`display:inline-block;width:10px;height:10px;border-radius:2px;background:${IRANY_SZIN[ir]};margin-right:4px`} />{IRANY_NEV[ir]} → {egtaj(ir, eszakSz)}</span>)}
          </div>
          <h2>1. Helyiségek és tájolás</h2>
          <p class="halk">A helyiségpecsétekből (kód, név, burkolat, terület) és a helyiségjegyzékből. A színes vonalak a felismert külső falszakaszok a helyiségek belső (nettó) síkján, homlokzati irány szerint; a jelölők a nyílászárók.</p>
          {onellenorzes.length > 0 && (
            <div role="status" style={`margin-bottom:10px;padding:8px 10px;border-radius:6px;border:1px solid ${onellenorzes.some((j) => j.sulyos) ? '#FCA5A5' : '#FCD34D'};background:${onellenorzes.some((j) => j.sulyos) ? '#FEF2F2' : '#FFFBEB'}`}>
              <strong>Önellenőrzés – ellenőrizd:</strong>
              <ul style="margin:4px 0 0 18px;padding:0">{onellenorzes.map((j) => <li style={j.sulyos ? 'color:#991B1B' : ''}>{j.szoveg}</li>)}</ul>
              <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:8px;align-items:center">
                {aiTokenAll ? (
                  <button class="gomb halk-gomb" disabled={ai?.fut} onClick={() => void aiFuttat()} title="A rajz hőburok körüli kivágata (szövegmező nélkül) a felismert eredménnyel egy képfelismerő modellnek; a válasz itt jelenik meg.">{ai?.fut ? 'AI-ellenőrzés fut…' : 'AI-ellenőrzés (kép a felismeréssel)'}</button>
                ) : (
                  <span class="halkabb" style="display:inline-flex;gap:6px;align-items:center"><label style="display:inline-flex;gap:6px;align-items:center">AI-token: <input type="password" size={22} value={aiTokenBe} onInput={(e) => setAiTokenBe((e.target as HTMLInputElement).value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && aiTokenBe.trim()) { aiTokenMent(aiTokenBe.trim()); setAiTokenAll(true); setAiTokenBe(''); } }} /></label>
                    <button class="gomb halk-gomb" disabled={!aiTokenBe.trim()} onClick={() => { aiTokenMent(aiTokenBe.trim()); setAiTokenAll(true); setAiTokenBe(''); }}>Mentés</button></span>
                )}
                {aiTokenAll && <button class="link-gomb halkabb" onClick={() => { aiTokenMent(''); setAiTokenAll(false); }}>token törlése</button>}
              </div>
              {ai?.hiba && <div class="hiba-doboz" style="margin-top:6px">{ai.hiba}</div>}
              {ai?.valasz && (
                <div style="margin-top:8px;font-size:15px;line-height:1.45"><strong>AI:</strong> {ai.valasz.rendben ? 'a felismerés rendben van.' : `${ai.valasz.hibak?.length ?? 0} hiba (a rajzon számozott piros keret jelöli a helyét)`}{ai.valasz.epulet?.teto ? ` · tető: ${ai.valasz.epulet.teto}` : ''}
                  <ol style="margin:4px 0 0 22px;padding:0">{(ai.valasz.hibak ?? []).map((h) => <li style="margin:3px 0">{h.leiras}{h.javaslat ? <><br /><span style="color:#374151">→ {h.javaslat}</span></> : ''}</li>)}</ol></div>
              )}
              {ai?.nyers && <pre style="white-space:pre-wrap;font-size:14px">{ai.nyers}</pre>}
              {ai && !ai.fut && !ai.hiba && !ai.valasz && !ai.nyers && <div class="hiba-doboz" style="margin-top:6px">Az AI-ellenőrzés nem adott értelmezhető választ – próbáld újra.</div>}
            </div>
          )}
          {(lapFigy.get(aIdx) ?? al.e.figyelmeztetesek).filter((f) => !(al.e.eszak && eszakJavitas(al.e.eszak.alairas) !== 0 && /északjel irányát/.test(f)) && !(/Északjelet nem találtam/.test(f) && eszakHom(al) !== null)).map((f) => <div class="figyelmeztetes" style="margin-bottom:8px">{f}</div>)}
          {(() => {
            // bizonytalan helyzetek, amelyekről a felhasználó dönt
            const cm = (v: number) => Math.round(v * 100);
            const hNev = (h: number | null) => (h !== null ? al.magHelyisegek[h]?.nev ?? '' : '');
            const gyanus = al.nyilasok.map((n, kk) => ({ n, kk })).filter(({ n, kk }) => n.helyiseg !== null && n.irany !== null && n.fajta !== 'falfulke' &&
              (kj.kulsoNy?.has(kk) || (!n.kulso && (n.oldalBizonytalan || (n.pm !== null && n.pm >= 0.3)))));
            const ab0 = al.r ? burokAutoTar(al.r, futottRiK(al, kj)) : [];
            const atvett = new Set(burokNyilasok(al, kj).map(({ kk }) => kk));
            const arvak = (al.arvaFeliratok ?? []).map((f, j) => ({ f, j })).filter(({ f, j }) => kj.arvaBe?.has(j) || (!atvett.has(10000 + j) && !!al.r && ab0.length > 0 &&
              (!ab0.some((p) => bennE(p, f.x, f.y)) ? nyilasEl(al.r, ab0, f.x, f.y, 2.5) !== null : nyilasEl(al.r, ab0, f.x, f.y, 1.0) !== null)));
            const terdE = !!al.tetoablakok?.length && (!me?.szintek.belmagassag.length || !!me?.tetoter) && !lapSzintek(aIdx).includes('T');
            const taBecs = (al.tetoablakok ?? []).map((t, ti) => ({ t, ti })).filter(({ t }) => t.becsult);
            if (!gyanus.length && !arvak.length && !terdE && !taBecs.length) return null;
            const valt = (mezo: 'kulsoNy' | 'arvaBe', i: number, be: boolean) => kjMod((k) => { const x = new Set(k[mezo] ?? []); if (be) x.add(i); else x.delete(i); return { ...k, [mezo]: x }; });
            return (
              <div class="kartya" style="margin-bottom:12px;border-color:#F59E0B">
                <h3 style="margin-top:0">Ellenőrizendő – döntsd el</h3>
                <p class="halk" style="margin-top:0">A felismerés ezeknél nem egyértelmű; a választás azonnal érvényes (2D, 3D és átvétel).</p>
                {gyanus.length > 0 && <>
                  <strong>Belsőnek vett nyílások</strong> <span class="halkabb">– mellvédes (ablakszerű), vagy a túloldala nem azonosítható</span>
                  <table class="tabla" style="max-width:640px;margin:4px 0 10px"><tbody>
                    {gyanus.map(({ n, kk }) => { const kulso = !!kj.kulsoNy?.has(kk); return (
                      <tr>
                        <td>{cm(n.szel)}×{cm(n.mag)}{n.pm !== null ? <span class="halkabb"> · pm {String(n.pm).replace('.', ',')}</span> : null}</td>
                        <td>{hNev(n.helyiseg)}</td>
                        <td>{n.oldalBizonytalan ? <span class="halkabb">túloldal ismeretlen</span> : <span class="halkabb">belső ablak?</span>}</td>
                        <td style="white-space:nowrap">
                          <label class="jelolo" style="display:inline-flex;margin-right:14px"><input type="radio" name={`ny${kk}`} checked={!kulso} onChange={() => valt('kulsoNy', kk, false)} /> belső</label>
                          <label class="jelolo" style="display:inline-flex"><input type="radio" name={`ny${kk}`} checked={kulso} onChange={() => valt('kulsoNy', kk, true)} /> külső (homlokzati)</label>
                        </td>
                      </tr>); })}
                  </tbody></table>
                </>}
                {arvak.length > 0 && <>
                  <strong>Falhoz nem köthető nyílásfeliratok</strong> <span class="halkabb">– a hőburok mentén</span>
                  <table class="tabla" style="max-width:640px;margin:4px 0 10px"><tbody>
                    {arvak.map(({ f, j }) => (
                      <tr>
                        <td>{cm(f.szel)}×{cm(f.mag)}{f.pm !== null ? <span class="halkabb"> · pm {String(f.pm).replace('.', ',')}</span> : null}</td>
                        <td><label class="jelolo"><input type="checkbox" checked={!!kj.arvaBe?.has(j)} onChange={(e) => valt('arvaBe', j, (e.target as HTMLInputElement).checked)} /> külső nyílásként átveszem (a legközelebbi homlokzati falra)</label></td>
                      </tr>))}
                  </tbody></table>
                </>}
                {terdE && <div style="margin:4px 0 10px">
                  <strong>Térdfal</strong> <span class="halkabb">– tetőablakos helyiség metszet nélkül: a lejtés felőli külső fal térdfal</span><br />
                  <label>Térdfal magassága: <input type="number" step="0.01" min="0" max="3" aria-label="Térdfal magassága (m)" style="width:90px" placeholder="0,9" value={terdfalKezi ?? ''} onInput={(e) => { const t = (e.target as HTMLInputElement).value.trim(); const v = Number(t.replace(',', '.')); setTerdfalKezi(t && v >= 0 ? v : undefined); }} /> m</label>
                  <span class="halkabb"> (üresen: a homlokzatról, ennek híján 0,9 m)</span>
                </div>}
                {taBecs.length > 0 && <>
                  <strong>Tetősík ablakok méretfelirat nélkül</strong> <span class="halkabb">– a rajzolt keretből becsült méret; add meg a konszignáció szerint</span>
                  <table class="tabla" style="max-width:640px;margin:4px 0 4px"><tbody>
                    {taBecs.map(({ t, ti }) => { const km = kj.taMeret?.[ti]; const be = (i: 0 | 1, e: Event) => { const v = Number((e.target as HTMLInputElement).value.replace(',', '.')); kjMod((k) => { const m = { ...(k.taMeret ?? {}) }; const reg = m[ti] ?? [t.szel, t.mag]; const uj: [number, number] = [reg[0], reg[1]]; if (v > 0) uj[i] = v / 100; m[ti] = uj; return { ...k, taMeret: m }; }); }; return (
                      <tr>
                        <td>{hNev(t.helyiseg)}</td>
                        <td style="white-space:nowrap"><input type="number" min="20" max="300" step="1" aria-label="Szélesség (cm)" style="width:70px" value={cm(km?.[0] ?? t.szel)} onChange={(e) => be(0, e)} /> × <input type="number" min="20" max="300" step="1" aria-label="Magasság (cm)" style="width:70px" value={cm(km?.[1] ?? t.mag)} onChange={(e) => be(1, e)} /> cm</td>
                      </tr>); })}
                  </tbody></table>
                </>}
              </div>
            );
          })()}
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
              <EszakOsszevetes kep={aLap?.kep} lapSzel={aLap?.lap.szel ?? 0} lapMag={aLap?.lap.mag ?? 0} jel={ej ?? null} szog={eszakSz} />
              {(!ej || ej.bizonytalan) && eszakKozos === null && !kulonE && eszakHom(al) !== null && <small class="halkabb">{ej ? 'Az északjel alakja nem egyértelmű' : 'Északjel nincs a lapon'}: az irányt a homlokzati rajzokból becsültem (a címükben szereplő égtáj és a nyílások helyzete szerint){eszakHomSajat(al) === null ? ', egy másik alaprajzi lap illesztése alapján (ezen a lapon a homlokzatok nem illeszthetők)' : ''} – ellenőrizd.</small>}
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
                  { const v = szmLap && ri >= 0 ? szmLap.magassag.get(ri) : undefined; if (v !== undefined) megj.push(`belmagasság a metszetből: ${String(v).replace('.', ',')} m`); }
                  return (<>
                    {csoportFej}
                    <tr id={`hs-sor-${i}`} style={`${valasztott[i] ? '' : 'opacity:.55;'}${kivH === i ? 'background:#FEF3C7;outline:2px solid #F59E0B;outline-offset:-2px' : ''}`} onClick={() => setKivH(kivH === i ? null : i)}>
                      <td onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`${h.nev} átvétele`} disabled={h.kulter} checked={valasztott[i]} onChange={(e) => { if ((e.target as HTMLInputElement).checked) setSzerep(i, kategoria(i) === 'kondicionalt' ? 'futott' : kategoria(i) === 'erosen_kapcsolt' ? 'erosen' : 'futetlen'); else setSzerep(i, 'szomszed'); }} /></td>
                      <td>{h.kod ?? '–'}</td>
                      <td>{h.nev}{h.burkolat && <span class="halkabb"> · {h.burkolat}</span>}</td>
                      <td style="min-width:210px" onClick={(e) => e.stopPropagation()}>{!h.kulter && <div style="display:flex;align-items:center;gap:6px"><span aria-hidden="true" style={`flex:none;display:inline-block;width:12px;height:12px;border-radius:3px;background:${SZEREP_SZIN[szerep(i)]}`} /><Valaszto cimke="Besorolás" ertek={szerep(i)} opciok={SZEREPEK} valt={(v) => setSzerep(i, v as Szerep)} /></div>}</td>
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
          {(() => { const v = me.blokkok; return v.length > 1 && <div style="margin-bottom:8px"><MindJelolo db={v.filter((b) => rrKi[b.rr.kod]).length} ossz={v.length} szoveg="mind átvételre / egyik sem" valt={(be) => { const k = { ...rrKi }; for (const b of v) k[b.rr.kod] = be; setRrKi(k); }} /></div>; })()}
          {me.blokkok.map((b) => (
            <div class="kartya rr-tomor" style="margin-bottom:6px">
              <div class="rr-fej">
                <label style="display:flex;gap:8px;align-items:baseline">
                  <input type="checkbox" checked={!!rrKi[b.rr.kod]} onChange={(e) => { const be = (e.target as HTMLInputElement).checked; setRrKi({ ...rrKi, [b.rr.kod]: be }); if (be && !b.becsles.szerep && !rrSzerep[b.rr.kod]) setRrSzerep({ ...rrSzerep, [b.rr.kod]: 'belso' }); }} />
                  {b.rr.kod} {b.rr.cim}
                </label>
                <select aria-label={`${b.rr.kod} szerepe`} value={rrSzerep[b.rr.kod] ?? b.becsles.szerep ?? ''} onChange={(e) => { const v = (e.target as HTMLSelectElement).value as RrSzerep | ''; const u = { ...rrSzerep }; if (v) u[b.rr.kod] = v; else delete u[b.rr.kod]; setRrSzerep(u); if (v) setRrKi({ ...rrKi, [b.rr.kod]: true }); }} style="font-size:13px">
                  {!b.becsles.szerep && <option value="">nem hőburok – válassz szerepet a beolvasáshoz</option>}
                  {(Object.entries({ fal: 'külső fal', padlas: 'padlásfödém', teto: 'tető', pincefodem: 'pincefödém', padlo: 'talajon fekvő padló', belso: 'belső szerkezet' }) as [RrSzerep, string][]).map(([k2, n]) => <option value={k2}>{n}{b.becsles.szerep === k2 && !rrSzerep[b.rr.kod] ? ' (felismert)' : ''}</option>)}
                </select>
                {rrSzerep[b.rr.kod] && rrSzerep[b.rr.kod] !== b.becsles.szerep && <span class="jel">kézzel megadva</span>}
              </div>
              {b.becsles.kihagy && !rrSzerep[b.rr.kod] && <p class="halkabb" style="margin:2px 0 0 24px">{b.becsles.kihagy}{rrKi[b.rr.kod] ? ' – bepipálva: rétegrendként beolvasva (a felületekhez nem rendeli; szerepet választva igen).' : ''}</p>}
              <table class="tabla">
                <tbody>
                  {b.retegek.map((r0, j) => {
                    // a felismert réteg a kézi javítással: a kimaradó réteg visszapipálható, az anyag legördülőből
                    // választható (a fel nem ismert is), a vastagság átírható
                    const r = retegKezivel(b.rr.kod, j, r0), kezi = !!rrRetegKezi[b.rr.kod]?.[j];
                    return (
                    <tr style={r.kimarad ? 'opacity:.6' : ''}>
                      <td style="width:20px"><input type="checkbox" aria-label={`${r.forras} – réteg átvétele`} checked={!r.kimarad} onChange={(e) => retegKeziAllit(b.rr.kod, j, { be: (e.target as HTMLInputElement).checked })} /></td>
                      <td style="width:45%">{r.forras}</td>
                      <td>{r.kimarad ? <span class="halkabb">kimarad – {r.kimarad}</span>
                        : <select aria-label={`${r.forras} – anyag`} style={!r.anyagId && !r.legreteg ? 'border-color:var(--figyel)' : ''} value={r.legreteg ? '_leg' : r.anyagId ?? ''} onChange={(e) => { const v = (e.target as HTMLSelectElement).value; if (v === '_leg') retegKeziAllit(b.rr.kod, j, { leg: true, anyagId: undefined }); else if (v) retegKeziAllit(b.rr.kod, j, { anyagId: v, leg: false }); }}>
                          {!r.anyagId && !r.legreteg && <option value="">nincs a katalógusban – válassz anyagot</option>}
                          {r.legreteg && r.legreteg !== 'zart' && <option value="_leg">légréteg (átszellőztetett)</option>}
                          {anyagKategoriak.map((k) => <optgroup label={k}>{anyagLista().filter((a) => a.kategoria === k).map((a) => <option value={a.id}>{a.nev}</option>)}</optgroup>)}
                          <optgroup label="Egyéb"><option value="_leg">Zárt légréteg</option></optgroup>
                        </select>}
                        {kezi && <span class="jel" style="margin-left:6px">kézzel</span>}
                        {r.megjegyzes && <small class="halkabb" style="display:block">{r.megjegyzes}</small>}</td>
                      <td class="szam" style="width:84px">{r.kimarad ? '' : <Szam ertek={r.dCm} egyseg="cm" valt={(v) => retegKeziAllit(b.rr.kod, j, { dCm: v ?? 0 })} />}</td>
                    </tr>); })}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      )}

      {al && (
        <section class="szakasz">
          <h2>3–4. Külső falak és nyílászárók</h2>
          <p class="halk">A homlokzati falfelület a helyiségek külső falának nettó (belső síkon mért, a befutó belső falak vastagsága nélküli) hossza × a figyelembe vett magasság (belmagasság), homlokzatonként; „saroktól sarokig”: a hőburok belső síkja megszakítás nélkül. A nyílászárók a nyílásméret-feliratokból (szélesség / magasság, „pm” mellvédmagasság) a falnyíláshoz és a helyiséghez rendelve; a belső ajtók ({belsoAjtok} db) nem kerülnek át.</p>
          <table class="tabla" style="margin-bottom:16px">
            <thead><tr><th>Homlokzat</th><th>Égtáj</th><th class="szam">Falhossz</th><th class="szam">Saroktól sarokig</th><th class="szam">Magasság</th><th class="szam">Falfelület (bruttó)</th><th class="szam">Nyílászáró</th></tr></thead>
            <tbody>{iranyok.filter((x) => x.hossz > 0 || x.db > 0).map((x) => (
              <tr><td><span style={`color:${IRANY_SZIN[x.ir]}`}>■</span> {IRANY_NEV[x.ir]}</td><td>{x.t}</td><td class="szam">{sz(x.hossz)} m</td><td class="szam halkabb">{x.sarok !== null ? `${sz(x.sarok)} m` : '–'}</td><td class="szam">{sz(bm ?? 2.7)} m</td><td class="szam">{sz(x.hossz * (bm ?? 2.7))} m²</td><td class="szam">{x.db} db</td></tr>
            ))}</tbody>
            <tfoot><tr><td colSpan={2}>Összesen (egy szint)</td><td class="szam">{sz(iranyok.reduce((s, x) => s + x.hossz, 0))} m</td><td class="szam halkabb">{iranyok.some((x) => x.sarok !== null) ? `${sz(iranyok.reduce((s, x) => s + (x.sarok ?? 0), 0))} m` : '–'}</td><td class="szam">{sz(bm ?? 2.7)} m</td><td class="szam">{sz(iranyok.reduce((s, x) => s + x.hossz, 0) * (bm ?? 2.7))} m²</td><td class="szam">{iranyok.reduce((s, x) => s + x.db, 0)} db</td></tr></tfoot>
          </table>
          <div class="tabla-gorgeto">
            <table class="tabla">
              <thead><tr><th><MindJelolo db={nyilasok.filter(({ k }) => !kizartNy.has(k)).length} ossz={nyilasok.length} valt={(be) => setKizartNy(be ? new Set() : new Set(nyilasok.map(({ k }) => k)))} /></th><th>Fajta</th><th class="szam">Szélesség × magasság</th><th class="szam">Mellvéd</th><th>Helyiség</th><th>Égtáj</th><th class="szam">Db</th></tr></thead>
              <tbody>
                {(() => {
                  // azonos fajta, méret, mellvéd, helyiség és égtáj: egy sor darabszámmal
                  const csop = new Map<string, { n: (typeof nyilasok)[number]['n']; hi: number; ks: number[] }>();
                  for (const { n, k, hi } of nyilasok) { const kk = `${n.fajta}|${n.szel}|${n.mag}|${n.pm}|${hi}|${n.irany}|${n.iranyTipp ? 't' : ''}`; const c = csop.get(kk); if (c) c.ks.push(k); else csop.set(kk, { n, hi, ks: [k] }); }
                  const szSz = aIdx >= 0 ? Math.max(1, lapSzintek(aIdx).length) : 1;
                  return [...csop.values()].map(({ n, hi, ks }) => { const ki = ks.every((k) => kizartNy.has(k)); const kiv = kivNy?.lap === aIdx && ks.includes(kivNy.ny); return (<>
                  <tr style={`${ki ? 'opacity:.55;' : ''}${kiv ? 'background:#FFEDD5;box-shadow:inset 3px 0 0 #F97316;' : ''}cursor:pointer`} title="Kattintás: kijelölés (a 3D modellben és a rajzon is), a méret átírható" onClick={(e) => { if ((e.target as HTMLElement).tagName === 'INPUT') return; setKivNy(kiv ? null : { lap: aIdx, ny: ks[0]! }); }}>
                    <td><input type="checkbox" aria-label="Átvétel" checked={!ki} onChange={(e) => { const s = new Set(kizartNy); for (const k of ks) { if ((e.target as HTMLInputElement).checked) s.delete(k); else s.add(k); } setKizartNy(s); }} /></td>
                    <td>{FAJTA_NEV[n.fajta]}</td>
                    <td class="szam">{Math.round(n.szel * 100)} × {n.mag > 0 ? `${Math.round(n.mag * 100)} cm` : 'belmagasság'}</td>
                    <td class="szam">{n.pm === null ? '–' : `${Math.round(n.pm * 100)} cm`}</td>
                    <td>{helyisegek[hi]?.kod} {helyisegek[hi]?.nev}{kategoria(hi) === 'gyengen_kapcsolt' && <small class="halkabb" style="display:block">fűtetlen tér – nem kerül a hőburokba</small>}</td>
                    <td>{egtaj(n.irany!, eszakSz)}{n.iranyTipp && <small class="jel" style="margin-left:6px;background:#FEF3C7;color:#92400E" title="A nyílás nem köthető egyértelműen falhoz: a tájolás a legközelebbi homlokzati fal alapján becsült – ellenőrizd.">becsült</small>}</td>
                    <td class="szam">{ks.length}{szSz > 1 && <span class="halkabb"> × {szSz} szint</span>}{n.kezi && <small class="jel" style="margin-left:6px;background:#FFEDD5;color:#9A3412">átírt</small>}</td>
                  </tr>
                  {kiv && kivNyAdat && kivNy!.ny < 20000 && <tr><td colSpan={7} style="background:#FFF7ED"><NyilasMeretSzerk adat={kivNyAdat} allit={(x) => nyMeretAllit(kivNy!.lap, kivNy!.ny, x)} bezar={() => setKivNy(null)} beagyazott /></td></tr>}
                  </>); });
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
          <h2 id="tervbol-atvetel">Átvétel</h2>
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
            {alaprajzLapok.length > 1 && <button class="gomb fo" disabled={osszesFut || alaprajzLapok.some(({ i }) => elemzesek[i] === undefined)} onClick={() => kerdezveAtvesz('osszes')}>Összes kijelölt alaprajz átvétele ({alaprajzLapok.filter(({ i }) => !kimarad(i)).length} lap)</button>}
            <button class={`gomb${alaprajzLapok.length > 1 ? '' : ' fo'}`} disabled={!valasztott.some(Boolean)} onClick={() => kerdezveAtvesz('egy')}>{alaprajzLapok.length > 1 ? `Csak ez a lap: ${aLap?.cim || aLap?.fajl}` : 'Átvétel a projektbe'}</button>
          </div>

        </section>
      )}
      {homlokzatLapok.length > 0 && <HomlokzatEllenorzes p={p} lapok={homlokzatLapok} />}
      {/* átvételi sáv: görgetéskor is a képernyő alján – a fő művelet mindig kéznél */}
      {al && aLap && (() => {
        const fut = alaprajzLapok.some(({ i }) => elemzesek[i] === undefined);
        const db = alaprajzLapok.filter(({ i }) => !kimarad(i)).length;
        const tobb = alaprajzLapok.length > 1;
        return (
          <div class="atvetel-sav" role="region" aria-label="Átvétel">
            <span class="halk">{fut ? `Feldolgozás folyamatban (${alaprajzLapok.filter(({ i }) => elemzesek[i] !== undefined).length} / ${alaprajzLapok.length})…` : tobb ? `${db} kijelölt alaprajz átvételre kész` : `Az alaprajz átvételre kész`}{atvett.size ? ` · ${atvett.size} lap már átvéve` : ''}</span>
            <a href="#tervbol-atvetel" class="halkabb" onClick={(e) => { e.preventDefault(); document.getElementById('tervbol-atvetel')?.scrollIntoView({ behavior: 'smooth' }); }}>beállítások (felülírás / hozzáadás)</a>
            {tobb ? <button class="gomb fo nagy" disabled={osszesFut || fut} onClick={() => kerdezveAtvesz('osszes')}>Átvétel a projektbe ({db} lap)</button>
              : <button class="gomb fo nagy" disabled={!valasztott.some(Boolean)} onClick={() => kerdezveAtvesz('egy')}>Átvétel a projektbe</button>}
          </div>
        );
      })()}
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

/** A kijelölt nyílászáró méretének kézi átírása (cm-ben): szélesség, magasság, mellvéd – a 3D modell, a 2D rajz és az átvétel is ezt használja. */
function NyilasMeretSzerk({ adat, allit, bezar, beagyazott }: { adat: { n: TervNyilas; n0: TervNyilas; kezi: boolean; athidalo?: 'monolit' | 'eloregyartott' }; allit: (x: { szel: number; mag: number; pm: number | null; athidalo?: 'monolit' | 'eloregyartott' } | null) => void; bezar: () => void; beagyazott?: boolean }) {
  const { n, n0, kezi } = adat;
  const cm = (v: number) => Math.round(v * 100);
  const mag0 = n.mag > 0 ? n.mag : n.szel >= 1.6 ? 2.4 : 1.5, pm0 = n.pm ?? (mag0 >= 1.9 ? 0 : 0.9);
  const ir = (mezo: 'szel' | 'mag' | 'pm', v: string) => {
    const x = Number(v.replace(',', '.')); if (!Number.isFinite(x) || x < 0 || x > 1200) return;
    const u = { szel: n.szel, mag: mag0, pm: pm0 as number | null, ...(n.athidalo ? { athidalo: n.athidalo } : {}), [mezo]: x / 100 };
    if (u.szel < 0.1 || u.mag < 0.1) return;
    allit(u);
  };
  const mezo = (cimke: string, ertek: number, k: 'szel' | 'mag' | 'pm') => (
    <label style="display:inline-flex;gap:4px;align-items:center;font-size:13px">{cimke}
      <input type="number" step="1" min="0" value={cm(ertek)} style="width:72px" onChange={(e) => ir(k, (e.target as HTMLInputElement).value)} /> cm</label>
  );
  return (
    <div style={`display:flex;gap:14px;align-items:center;flex-wrap:wrap;${beagyazott ? 'padding:4px 0' : 'padding:8px 10px;border-top:1px solid #E5E7EB;background:#FFF7ED'}`}>
      <strong style="font-size:13px">Kijelölt nyílászáró</strong>
      {mezo('Szélesség', n.szel, 'szel')}{mezo('Magasság', mag0, 'mag')}{mezo('Mellvéd', pm0, 'pm')}
      <span class="halkabb" style="font-size:12px">felismert: {cm(n0.szel)} × {n0.mag > 0 ? cm(n0.mag) : '?'} cm{n0.pm !== null ? `, mellvéd ${cm(n0.pm)} cm` : ''}{n0.mert ? ' (felirat nélkül mért)' : ''}</span>
      {adat.athidalo && <label style="display:inline-flex;gap:4px;align-items:center;font-size:13px" title="Monolit: a koszorú a nyílás felső síkjáig lejön; előregyártott: kiváltó áthidaló (az ELBA ezt hozza létre)">Áthidaló
        <select value={n.athidalo ?? adat.athidalo} onChange={(e) => allit({ szel: n.szel, mag: n.mag, pm: n.pm, athidalo: (e.target as HTMLSelectElement).value as 'monolit' | 'eloregyartott' })}>
          <option value="eloregyartott">előregyártott kiváltó</option><option value="monolit">monolit (koszorúval)</option>
        </select>{!n.athidalo && <span class="halkabb" style="font-size:12px">(a metszet szerint)</span>}</label>}
      {kezi && <button class="gomb halk-gomb semleges" onClick={() => allit(null)}>Vissza a felismertre</button>}
      <button class="gomb halk-gomb semleges" onClick={bezar}>Kijelölés vége</button>
    </div>
  );
}

/** A terv saját északjele (kivágás a lapról) és mellette a számításban használt északi irány – egyben ellenőrizhető. */
function EszakOsszevetes({ kep, lapSzel, lapMag, jel, szog }: { kep: string | undefined; lapSzel: number; lapMag: number; jel: { x: number; y: number; meret: number; bbox?: [number, number, number, number] } | null; szog: number }) {
  const rad = (szog * Math.PI) / 180, sx = Math.sin(rad), sy = -Math.cos(rad);
  const nyil = (r: number, szin: string, vast: number) => (
    <g>
      <line x1={-sx * r * 0.55} y1={-sy * r * 0.55} x2={sx * r * 0.7} y2={sy * r * 0.7} stroke={szin} stroke-width={vast} stroke-linecap="round" />
      <polygon points={`${sx * r * 0.9},${sy * r * 0.9} ${sx * r * 0.62 - sy * r * 0.13},${sy * r * 0.62 + sx * r * 0.13} ${sx * r * 0.62 + sy * r * 0.13},${sy * r * 0.62 - sx * r * 0.13}`} fill={szin} />
    </g>
  );
  const bb = jel ? jel.bbox ?? [jel.x - jel.meret / 2, jel.y - jel.meret / 2, jel.x + jel.meret / 2, jel.y + jel.meret / 2] : null;
  const s = bb ? Math.max(bb[2] - bb[0], bb[3] - bb[1]) * 1.5 : 0, cx = bb ? (bb[0] + bb[2]) / 2 : 0, cy = bb ? (bb[1] + bb[3]) / 2 : 0;
  const egtaj = (az: number) => ['É', 'K', 'D', 'Ny'].map((t, i) => { const a = ((az + i * 90) * Math.PI) / 180; return <text x={50 + Math.sin(a) * 40} y={50 - Math.cos(a) * 40 + 4} font-size={11} text-anchor="middle" fill={i === 0 ? '#B91C1C' : '#64748B'} font-weight={i === 0 ? 700 : 400} font-family="system-ui">{t}</text>; });
  return (
    <div style="display:flex;gap:10px;align-items:flex-start;margin:6px 0">
      <figure style="margin:0;text-align:center">
        {kep && bb ? (
          <svg width={110} height={110} viewBox={`${cx - s / 2} ${cy - s / 2} ${s} ${s}`} style="border:1px solid #CBD5E1;border-radius:6px;background:#fff">
            <image href={kep} x={0} y={0} width={lapSzel} height={lapMag} />
            <g transform={`translate(${cx} ${cy})`} opacity={0.75}>{nyil(s * 0.5, '#B91C1C', s * 0.02)}</g>
          </svg>
        ) : <div style="width:110px;height:110px;border:1px dashed #CBD5E1;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;color:#64748B;text-align:center">nincs északjel a lapon</div>}
        <figcaption class="halkabb" style="font-size:11px">a terv északjele{kep && bb ? ' + a felvett irány' : ''}</figcaption>
      </figure>
      <figure style="margin:0;text-align:center">
        <svg width={110} height={110} viewBox="0 0 100 100" style="border:1px solid #CBD5E1;border-radius:6px;background:#fff">
          <circle cx={50} cy={50} r={30} fill="none" stroke="#E2E8F0" />
          {egtaj(szog)}
          <g transform="translate(50 50)">{nyil(32, '#B91C1C', 3)}</g>
        </svg>
        <figcaption class="halkabb" style="font-size:11px">a számításban: {Math.round(szog)}°</figcaption>
      </figure>
    </div>
  );
}
