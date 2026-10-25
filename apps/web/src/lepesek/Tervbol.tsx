import { useEffect, useMemo, useState } from 'preact/hooks';
import { ujId as ujIdT, type Projekt, type HelyisegKategoria } from '../modell';
const sz2 = (x: number) => x.toLocaleString('hu-HU', { maximumFractionDigits: 1 });
import { Szam, Valaszto, sz, MindJelolo } from '../ui';
import { kategoriaJavaslat } from './Helyisegek';
import { anyag } from '../katalogus';
import { pecsetKinyer, type PecsetAdat } from '../terv/pecset';
import { HomlokzatEllenorzes } from './TervHomlokzat';
import type { SzurkeKep } from '../terv/autohelyiseg';
import { pdfLapok, alaprajzFeldolgoz, metszetFeldolgoz, eszakJavitas, eszakJavitasMent, type TervLap, type AlaprajzFeldolgozas } from '../terv/elemzes';
import { egtaj, szintekCimbol, szintNev } from '../terv/alaprajz';
import { tervAtvesz, type AtvettNyilas, type AtvettHelyiseg } from '../terv/atvetel';
import { MintaLakasok } from './MintaLakasok';

type Modosit = (f: (q: Projekt) => void) => void;

const KATEGORIAK: { ertek: HelyisegKategoria; nev: string }[] = [
  { ertek: 'kondicionalt', nev: 'Fűtött' },
  { ertek: 'erosen_kapcsolt', nev: 'Fűtetlen, lakótéren belüli' },
  { ertek: 'gyengen_kapcsolt', nev: 'Fűtetlen tér (b tényezővel)' },
];
const FAJTA_NEV = { ablak: 'Ablak', erkelyajto: 'Erkélyajtó', bejarati_ajto: 'Bejárati ajtó', bejarati_uvegajto: 'Bejárati ajtó (üvegezett)', garazskapu: 'Garázskapu', belso_ajto: 'Belső ajtó', falfulke: 'Falfülke (nem nyílászáró)' } as const;
const IRANY_SZIN: Record<number, string> = { 0: '#C2410C', 90: '#2E6DB4', 180: '#15803D', 270: '#A21CAF' };
const IRANY_NEV: Record<number, string> = { 0: 'lapon fent', 90: 'lapon jobbra', 180: 'lapon lent', 270: 'lapon balra' };
const norm = (d: number) => ((Math.round(d * 10) / 10) % 360 + 360) % 360;

/** Egy alaprajz kijelölései: átvett egységek, kizárt helyiségek, besorolás-felülírás, kizárt nyílások. */
interface Kijeloles { egysegek: Set<string>; kizartH: Set<number>; kat: Record<number, HelyisegKategoria>; kizartNy: Set<number>; mindFutott?: boolean }

/** Alapértelmezett kijelölés a felismerésből (minden egység; a csak jegyzékben szereplő sorok nélkül). */
function alapKijeloles(al: AlaprajzFeldolgozas): Kijeloles {
  const vanPecset = al.e.helyisegek.some((h) => h.forras === 'pecset');
  const kizartH = new Set(al.auto ? al.e.helyisegek.map((h, i) => (al.e.egysegek.length && h.egyseg ? -1 : i)).filter((i) => i >= 0) : vanPecset ? al.e.helyisegek.map((h, i) => (h.forras === 'jegyzek' ? i : -1)).filter((i) => i >= 0) : []);
  return { egysegek: new Set(al.e.egysegek), kizartH, kat: {}, kizartNy: new Set() };
}

/** Egy alaprajz átvehető helyiségei (külső falakkal) és nyílászárói a kijelölés szerint. */
function atvetelReszek(al: AlaprajzFeldolgozas, k: Kijeloles): { helyisegek: AtvettHelyiseg[]; nyilasok: AtvettNyilas[] } {
  const hs = al.e.helyisegek;
  const egysegben = (i: number) => !al.e.egysegek.length || !hs[i]!.egyseg || k.egysegek.has(hs[i]!.egyseg!);
  const valasztott = hs.map((h, i) => egysegben(i) && !h.kulter && !k.kizartH.has(i));
  const kategoria = (i: number): HelyisegKategoria => k.kat[i] ?? (k.mindFutott ? 'kondicionalt' : kategoriaJavaslat(hs[i]!.nev) ?? 'kondicionalt');
  const ri = (i: number) => al.magHelyisegek.indexOf(hs[i]!);
  const falak = (i: number) => { const x = ri(i); return !al.r || x < 0 ? [] : al.r.helyisegek[x]!.szakaszok.filter((s) => s.tul === 'kulso' && s.hossz >= 0.3); };
  const kiv = hs.map((h, i) => ({ h, i })).filter(({ i }) => valasztott[i]);
  const index = new Map(kiv.map(({ i }, j) => [i, j]));
  const helyisegek = kiv.map(({ h, i }) => ({
    kod: h.kod, nev: h.nev, burkolat: h.burkolat, A: h.A, kategoria: kategoria(i), egyseg: h.egyseg ? (al.e.egysegInfo[h.egyseg]?.nev ?? h.egyseg) : undefined, falak: falak(i).map((f) => ({ irany: f.irany, hossz: f.hossz, ...(f.talaj ? { talaj: true } : {}) })),
    // fal fűtetlen (gyengén kapcsolt) helyiség felé, pl. garázs
    futetlenFalak: (() => { const x = ri(i); if (!al.r || x < 0) return []; return al.r.helyisegek[x]!.szakaszok.filter((s) => typeof s.tul === 'number' && s.hossz >= 0.3).flatMap((s) => {
      const mi = hs.indexOf(al.magHelyisegek[s.tul as number]!); return mi >= 0 && valasztott[mi] && kategoria(mi) === 'gyengen_kapcsolt' && kategoria(i) !== 'gyengen_kapcsolt' ? [{ hossz: s.hossz, fele: hs[mi]!.nev }] : []; }); })(),
  }));
  const nyilasok = al.nyilasok.map((n, kk) => ({ n, kk })).filter(({ n }) => n.kulso && n.helyiseg !== null && n.irany !== null)
    .map(({ n, kk }) => ({ n, kk, hi: hs.indexOf(al.magHelyisegek[n.helyiseg!]!) }))
    .filter(({ hi, kk }) => hi >= 0 && valasztott[hi] && !k.kizartNy.has(kk))
    .map(({ n, hi }): AtvettNyilas => ({ fajta: n.fajta as AtvettNyilas['fajta'], szel: n.szel, mag: n.mag, pm: n.pm, helyiseg: index.get(hi)!, irany: n.irany! }));
  return { helyisegek, nyilasok };
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
    return !(typeof a === 'object' && atvetelReszek(a, { ...(kijelolesek[i] ?? alapKijeloles(a)), mindFutott }).helyisegek.some((h) => h.kategoria !== 'gyengen_kapcsolt'));
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
      try { ered = alaprajzFeldolgoz(lapok[kov]!.lap, undefined, lapok[kov]!.szurke); } catch (e) { ered = (e as Error).message; }
      setElemzesek((x) => ({ ...x, [kov]: ered }));
    }, 40);
    return () => window.clearTimeout(t);
  }, [lapok, elemzesek]);
  const keszElemzes = aIdx >= 0 && typeof elemzesek[aIdx] === 'object' ? elemzesek[aIdx] as AlaprajzFeldolgozas : null;
  const kezi = useMemo(() => (aLap && meretarany ? alaprajzFeldolgoz(aLap.lap, meretarany, aLap.szurke) : null), [aLap, meretarany]);
  const al = kezi ?? keszElemzes;
  // kézi méretarány: új felismerés – a lap kijelölése újraindul
  useEffect(() => { if (kezi) setKijelolesek((m) => { const u = { ...m }; delete u[aIdx]; return u; }); }, [kezi]);
  const kijeloles = (i: number, a: AlaprajzFeldolgozas): Kijeloles => ({ ...(kijelolesek[i] ?? alapKijeloles(a)), mindFutott });
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
    return al.r.helyisegek[ri]!.szakaszok.filter((s) => s.tul === 'kulso' && s.hossz >= 0.3);
  };
  const nyilasok = (al?.nyilasok ?? []).map((n, k) => ({ n, k })).filter(({ n }) => n.kulso && n.helyiseg !== null && n.irany !== null)
    .map(({ n, k }) => ({ n, k, hi: helyisegek.indexOf(al!.magHelyisegek[n.helyiseg!]!) }))
    .filter(({ hi }) => hi >= 0 && valasztott[hi]);
  const belsoAjtok = (al?.nyilasok ?? []).filter((n) => !n.kulso).length;
  const eszakFelismert = (a: AlaprajzFeldolgozas | null | undefined) => (a?.e.eszak ? norm(a.e.eszak.szog + eszakJavitas(a.e.eszak.alairas)) : 0);
  const eszakLap = (i: number, a: AlaprajzFeldolgozas | null | undefined) => eszakKulon[i] ?? eszakKozos ?? eszakFelismert(a);
  const eszakSz = eszakLap(aIdx, al);
  const kulonE = aIdx in eszakKulon;
  const setEszak = (v: number) => { if (kulonE) setEszakKulon((x) => ({ ...x, [aIdx]: v })); else setEszakKozos(v); };

  // homlokzatonkénti összesítés
  const iranyok = [0, 90, 180, 270].map((ir) => ({
    ir, t: egtaj(ir, eszakSz),
    hossz: helyisegek.reduce((s, _h, i) => s + (valasztott[i] ? falak(i).filter((f) => f.irany === ir).reduce((q, f) => q + f.hossz, 0) : 0), 0),
    db: nyilasok.filter(({ n, k }) => n.irany === ir && !kizartNy.has(k)).length,
  }));

  /** Közös átvétel: egy alaprajz a megadott kijelöléssel, szintekkel, padló/tető beállítással. */
  function egyAtvetel(q: Projekt, a: AlaprajzFeldolgozas, k: Kijeloles, o: { csere: boolean; padloAt: boolean; tetoAt: boolean; eszak: number; szintek: string[]; fajl?: string }): string[] {
    // terepszint alatti szint (pince, alagsor): a feltételes rétegrendek (pincefal, pincepadló) is átkerülnek
    const terepAlatt = o.szintek.includes('P');
    const blokkok = (me?.blokkok ?? []).filter((b) => rrKi[b.rr.kod] || (terepAlatt && b.becsles.feltetel === 'terepAlatt'));
    const { helyisegek: hs, nyilasok: ny } = atvetelReszek(a, k);
    return tervAtvesz(q, {
      helyisegek: hs, retegrendek: blokkok, nyilasok: ny,
      eszakSzog: o.eszak, belmagassag: bm ?? 2.7, szintszam: szintszam ?? 1, csere: o.csere, padloAt: o.padloAt, tetoAt: o.tetoAt,
      ...(mintaFajta === 'blokkos' ? { alapFalSablon: 'fal_blokk_kohosalak' } : {}),
      forras: [o.fajl, mLap?.fajl].filter(Boolean).join(', '), szintek: o.szintek,
      ...(terepAlatt ? { terepAlatt: true, ...(pinceMelyseg ? { terepMelyseg: pinceMelyseg } : {}) } : {}),
    }).uzenetek;
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
    modosit((q) => {
      sor.forEach(({ l, i }, n) => {
        const a = elemzesek[i] as AlaprajzFeldolgozas;
        // a megnyitott lapnál a kézi kijelölés, a többinél az alapértelmezett
        const k = i === aIdx ? kj : kijeloles(i, a);
        const sz = lapSzintek(i);
        const u = egyAtvetel(q, a, k, { csere: n === 0 ? csere : false, padloAt: !!futott.length && sz.includes(futott[0]!), tetoAt: !!futott.length && sz.includes(futott.at(-1)!), eszak: eszakLap(i, a), szintek: sz, fajl: l.fajl });
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
        if (fod && pinceFutott > 0.5) {
          const uj = Math.max(0, Math.round(((fod.A ?? 0) - pinceFutott) * 100) / 100);
          uz.push(`Pince feletti födém: ${sz2(fod.A ?? 0)} m² (földszint, fűtött) − ${sz2(pinceFutott)} m² (pince, fűtött) = ${sz2(uj)} m².`);
          if (uj > 0) fod.A = uj; else q.feluletek = q.feluletek.filter((f) => f !== fod);
        }
      }
      // szintkülönbségek: ami egy szinten túlnyúlik a felette lévőn, annak a teteje lapostető; ami az alatta lévőn, annak az alja konzol/árkád feletti födém
      const sorrend = futott.filter((x) => szintA.has(x));
      const rr = (kod: string) => q.retegrendek.find((r) => r.tervbol && r.kovetelmenyKod === kod);
      const lapos = rr('lapostető'), arkad = rr('arkadfodem');
      sorrend.forEach((s0, j) => {
        const A = szintA.get(s0)!;
        const fol = j < sorrend.length - 1 ? szintA.get(sorrend[j + 1]!)! : null;
        const ala = j > 0 ? szintA.get(sorrend[j - 1]!)! : null;
        if (fol !== null && A - fol > 1) {
          const dA = Math.round((A - fol) * 100) / 100;
          q.feluletek.push({ id: ujIdT(), nev: `Lapostető – ${szintNev(s0)} felett (felső szinten túlnyúló rész)`, fajta: 'opak', retegrendId: lapos?.id, hatar: 'kulso', A: dA, tajolas: null, hajlasszog: 0, chi: 0.1 });
          uz.push(`${szintNev(s0)}: ${sz2(dA)} m² nyúlik túl a felette lévő szinten → lapostető${lapos ? ` (${lapos.nev})` : ' – a metszeten nincs lapostető-rétegrend, a Határolás lépésben válassz'}. A terület a helyiségek nettó alapterületének különbsége – a tényleges tetőfelülettel ellenőrizd.`);
        }
        if (ala !== null && A - ala > 1) {
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
          {al.e.figyelmeztetesek.filter((f) => !(al.e.eszak && eszakJavitas(al.e.eszak.alairas) !== 0 && /északjel irányát/.test(f))).map((f) => <div class="figyelmeztetes" style="margin-bottom:8px">{f}</div>)}
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
            <svg viewBox={nezet.join(' ')} style="display:block;width:100%;height:auto;background:#fff" role="img" aria-label="Az alaprajz a felismert elemekkel">
              <image href={aLap.kep} x={0} y={0} width={aLap.lap.szel} height={aLap.lap.mag} />
              {helyisegek.map((h, i) => valasztott[i] && falak(i).map((f) => (
                <path d={f.pontok.map(([x, y]) => `M${(x - 0.45).toFixed(1)} ${(y - 0.45).toFixed(1)}h0.9v0.9h-0.9z`).join('')} fill={IRANY_SZIN[f.irany]} />
              )))}
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
              {nyilasok.map(({ n, k }) => (
                <g opacity={kizartNy.has(k) ? 0.3 : 1}>
                  <rect x={n.x - 9} y={n.y - 4} width={18} height={8} rx={1.5} fill={n.fajta === 'ablak' ? '#0EA5E9' : n.fajta === 'erkelyajto' ? '#6366F1' : n.fajta === 'garazskapu' ? '#475569' : '#B45309'} opacity={0.85} />
                  <text x={n.x} y={n.y + 2.2} font-size={5.5} text-anchor="middle" fill="#fff" font-family="system-ui">{Math.round(n.szel * 100)}×{Math.round(n.mag * 100)}</text>
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
            {[0, 90, 180, 270].map((ir) => <span class="halkabb"><span style={`display:inline-block;width:10px;height:10px;border-radius:2px;background:${IRANY_SZIN[ir]};margin-right:4px`} />{IRANY_NEV[ir]} → {egtaj(ir, eszakSz)}</span>)}
          </div>

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
                    <td class="szam">{Math.round(n.szel * 100)} × {Math.round(n.mag * 100)} cm</td>
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
                const A = be.reduce((s, { n }) => s + n.szel * n.mag, 0);
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
  if (d.hrsz) q.meta.hrsz = d.hrsz;
  if (d.cim) { q.meta.irsz = d.cim.irsz; q.meta.telepules = d.cim.telepules; q.meta.kozterulet = d.cim.kozterulet; q.meta.kozteruletJelleg = d.cim.jelleg || q.meta.kozteruletJelleg; q.meta.hazszam = d.cim.hazszam; }
  else if (d.helyszin && !q.meta.telepules) q.meta.telepules = d.helyszin;
}
