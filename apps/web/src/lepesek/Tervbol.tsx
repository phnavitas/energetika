import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Projekt, HelyisegKategoria } from '../modell';
import { Szam, Valaszto, sz } from '../ui';
import { kategoriaJavaslat } from './Helyisegek';
import { anyag } from '../katalogus';
import { pecsetKinyer, type PecsetAdat } from '../terv/pecset';
import type { SzurkeKep } from '../terv/autohelyiseg';
import { pdfLapok, alaprajzFeldolgoz, metszetFeldolgoz, eszakJavitas, eszakJavitasMent, type TervLap } from '../terv/elemzes';
import { egtaj } from '../terv/alaprajz';
import { tervAtvesz, type AtvettNyilas } from '../terv/atvetel';
import { MintaLakasok } from './MintaLakasok';

type Modosit = (f: (q: Projekt) => void) => void;

const KATEGORIAK: { ertek: HelyisegKategoria; nev: string }[] = [
  { ertek: 'kondicionalt', nev: 'Fűtött' },
  { ertek: 'erosen_kapcsolt', nev: 'Fűtetlen, lakótéren belüli' },
  { ertek: 'gyengen_kapcsolt', nev: 'Fűtetlen tér (b tényezővel)' },
];
const FAJTA_NEV = { ablak: 'Ablak', erkelyajto: 'Erkélyajtó', bejarati_ajto: 'Bejárati ajtó', garazskapu: 'Garázskapu', belso_ajto: 'Belső ajtó' } as const;
const IRANY_SZIN: Record<number, string> = { 0: '#C2410C', 90: '#2E6DB4', 180: '#15803D', 270: '#A21CAF' };
const IRANY_NEV: Record<number, string> = { 0: 'lapon fent', 90: 'lapon jobbra', 180: 'lapon lent', 270: 'lapon balra' };
const norm = (d: number) => ((Math.round(d * 10) / 10) % 360 + 360) % 360;

export function TervbolLepes({ p, modosit, ugrik }: { p: Projekt; modosit: Modosit; ugrik: (n: 'helyisegek' | 'hatarolas' | 'retegrendek') => void }) {
  const [lapok, setLapok] = useState<TervLap[]>([]);
  const [folyamat, setFolyamat] = useState<string | null>(null);
  const [hiba, setHiba] = useState<string | null>(null);
  const [aIdx, setAIdx] = useState(-1);
  const [mIdx, setMIdx] = useState(-1);
  const [meretarany, setMeretarany] = useState<number | undefined>(undefined);
  const [eszak, setEszak] = useState<number | null>(null);
  const [egysegek, setEgysegek] = useState<Set<string>>(new Set());
  const [kizartH, setKizartH] = useState<Set<number>>(new Set());
  const [kat, setKat] = useState<Record<number, HelyisegKategoria>>({});
  const [rrKi, setRrKi] = useState<Record<string, boolean>>({});
  const [bm, setBm] = useState<number | undefined>(undefined);
  const [szintszam, setSzintszam] = useState<number | undefined>(undefined);
  const [kizartNy, setKizartNy] = useState<Set<number>>(new Set());
  const [csere, setCsere] = useState(true);
  const [kesz, setKesz] = useState<string[] | null>(null);
  const [nagyit, setNagyit] = useState(true);
  const [pecsetBe, setPecsetBe] = useState(true);
  const [padloAt, setPadloAt] = useState(true);
  const [tetoAt, setTetoAt] = useState(true);
  const [mintaFajta, setMintaFajta] = useState<'panel' | 'blokkos' | null>(null);

  async function betolt(fajlok: FileList | File[] | null, alaprajzOldal?: number, szurkeFelulir?: SzurkeKep) {
    if (!fajlok?.length) return;
    setHiba(null); setKesz(null);
    const uj: TervLap[] = [];
    try {
      for (const f of Array.from(fajlok)) {
        if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { setHiba(`${f.name}: csak PDF tervlap olvasható be.`); continue; }
        setFolyamat(`${f.name} feldolgozása…`);
        const ll = await pdfLapok(f);
        // beépített mintalap: a színezés a pdf.js-ben színátmenetként jelenik meg – az előre elkészített, egyszínű árnyalatkép
        if (szurkeFelulir && alaprajzOldal !== undefined) for (const l of ll) if (l.oldal === alaprajzOldal) l.szurke = szurkeFelulir;
        uj.push(...ll);
      }
    } catch (e) { setHiba(`A PDF nem olvasható: ${(e as Error).message}`); }
    setFolyamat(null);
    if (!uj.length) return;
    const osszes = [...lapok, ...uj];
    setLapok(osszes);
    if (alaprajzOldal !== undefined) { const i = osszes.findIndex((l, k) => k >= lapok.length && l.oldal === alaprajzOldal); if (i >= 0) setAIdx(i); }
    else if (aIdx < 0) setAIdx(osszes.findIndex((l) => l.szerep === 'alaprajz'));
    if (mIdx < 0) setMIdx(osszes.findIndex((l) => l.szerep === 'metszet'));
  }

  /** Beépített típusalaprajz-mintalap (panel / blokkos): előre feldolgozott lakásadatok, kattintásos lakásválasztás. */
  function mintalap(fajta: 'panel' | 'blokkos') {
    setLapok([]); setAIdx(-1); setMIdx(-1); setKesz(null); setHiba(null); setMintaFajta(fajta);
  }

  const aLap = aIdx >= 0 ? lapok[aIdx] : undefined;
  const mLap = mIdx >= 0 ? lapok[mIdx] : undefined;
  const al = useMemo(() => (aLap ? alaprajzFeldolgoz(aLap.lap, meretarany, aLap.szurke) : null), [aLap, meretarany]);
  const me = useMemo(() => (mLap ? metszetFeldolgoz(mLap.lap) : null), [mLap]);
  const pecset = useMemo<PecsetAdat | null>(() => { const l = aLap ?? mLap; if (!l) return null; const d = pecsetKinyer(l.lap.szovegek); return Object.keys(d).length ? d : null; }, [aLap, mLap]);

  // alapértékek a felismerésből
  useEffect(() => {
    if (!al) return;
    const e = al.e.eszak;
    setEszak(e ? norm(e.szog + eszakJavitas(e.alairas)) : 0);
    setEgysegek(new Set(al.e.egysegek.slice(0, 1)));
    // ha van helyiségpecsét, a csak a jegyzékben szereplő sorok (párjuk nincs a rajzon) alapból nem kerülnek át
    const vanPecset = al.e.helyisegek.some((h) => h.forras === 'pecset');
    // automatikusan felismert helyiségek (típusalaprajz): alapból egy sincs kijelölve – a lakás helyiségeire kattintva
    // típusalaprajz: ha a színezésből lakások jöttek, a lakáshoz nem tartozó terek (lépcsőház, folyosó, akna) kimaradnak
    setKizartH(new Set(al.auto ? al.e.helyisegek.map((h, i) => (al.e.egysegek.length && h.egyseg ? -1 : i)).filter((i) => i >= 0) : vanPecset ? al.e.helyisegek.map((h, i) => (h.forras === 'jegyzek' ? i : -1)).filter((i) => i >= 0) : []));
    setKat({}); setKizartNy(new Set());
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
  const kategoria = (i: number): HelyisegKategoria => kat[i] ?? kategoriaJavaslat(helyisegek[i]!.nev) ?? 'kondicionalt';
  const falak = (i: number) => {
    const ri = raszterIdx(i); if (!al?.r || ri < 0) return [];
    return al.r.helyisegek[ri]!.szakaszok.filter((s) => s.tul === 'kulso' && s.hossz >= 0.3);
  };
  const nyilasok = (al?.nyilasok ?? []).map((n, k) => ({ n, k })).filter(({ n }) => n.kulso && n.helyiseg !== null && n.irany !== null)
    .map(({ n, k }) => ({ n, k, hi: helyisegek.indexOf(al!.magHelyisegek[n.helyiseg!]!) }))
    .filter(({ hi }) => hi >= 0 && valasztott[hi]);
  const belsoAjtok = (al?.nyilasok ?? []).filter((n) => !n.kulso).length;
  const eszakSz = eszak ?? 0;

  // homlokzatonkénti összesítés
  const iranyok = [0, 90, 180, 270].map((ir) => ({
    ir, t: egtaj(ir, eszakSz),
    hossz: helyisegek.reduce((s, _h, i) => s + (valasztott[i] ? falak(i).filter((f) => f.irany === ir).reduce((q, f) => q + f.hossz, 0) : 0), 0),
    db: nyilasok.filter(({ n, k }) => n.irany === ir && !kizartNy.has(k)).length,
  }));

  function atvesz() {
    if (!al) return;
    const kivalasztott = helyisegek.map((h, i) => ({ h, i })).filter(({ i }) => valasztott[i]);
    const index = new Map(kivalasztott.map(({ i }, j) => [i, j]));
    const blokkok = (me?.blokkok ?? []).filter((b) => rrKi[b.rr.kod]);
    let uzenetek: string[] = [];
    modosit((q) => {
      uzenetek = tervAtvesz(q, {
        helyisegek: kivalasztott.map(({ h, i }) => ({ kod: h.kod, nev: h.nev, burkolat: h.burkolat, A: h.A, kategoria: kategoria(i), falak: falak(i).map((f) => ({ irany: f.irany, hossz: f.hossz })),
          // fal fűtetlen (gyengén kapcsolt) helyiség felé, pl. garázs
          futetlenFalak: (() => { const ri = raszterIdx(i); if (!al.r || ri < 0) return []; return al.r.helyisegek[ri]!.szakaszok.filter((s) => typeof s.tul === 'number' && s.hossz >= 0.3).flatMap((s) => {
            const mi = helyisegek.indexOf(al.magHelyisegek[s.tul as number]!); return mi >= 0 && valasztott[mi] && kategoria(mi) === 'gyengen_kapcsolt' && kategoria(i) !== 'gyengen_kapcsolt' ? [{ hossz: s.hossz, fele: helyisegek[mi]!.nev }] : []; }); })() })),
        retegrendek: blokkok,
        nyilasok: nyilasok.filter(({ k }) => !kizartNy.has(k)).map(({ n, hi }): AtvettNyilas => ({ fajta: n.fajta as AtvettNyilas['fajta'], szel: n.szel, mag: n.mag, pm: n.pm, helyiseg: index.get(hi)!, irany: n.irany! })),
        eszakSzog: eszakSz, belmagassag: bm ?? 2.7, szintszam: szintszam ?? 1, csere, padloAt, tetoAt, ...(mintaFajta === 'blokkos' ? { alapFalSablon: 'fal_blokk_kohosalak' } : {}),
        forras: [aLap?.fajl, mLap?.fajl].filter(Boolean).join(', '),
      }).uzenetek;
    });
    if (pecset && pecsetBe) modosit((q) => pecsetAtvesz(q, pecset));
    if (al.e.eszak) eszakJavitasMent(al.e.eszak.alairas, eszakSz - al.e.eszak.szog);
    setKesz(uzenetek);
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
          {lapok.length > 0 && <button class="gomb halk-gomb semleges" onClick={() => { setLapok([]); setAIdx(-1); setMIdx(-1); setKesz(null); }}>Lapok törlése</button>}
          {folyamat && <span class="halk" role="status">{folyamat}</span>}
        </div>
        {hiba && <div class="hiba-doboz" style="margin-top:12px">{hiba}</div>}
        {lapok.length > 0 && (
          <div class="racs" style="margin-top:16px">
            <label class="mezo"><span>Alaprajz</span>
              <select value={aIdx} onChange={(e) => { setAIdx(Number((e.target as HTMLSelectElement).value)); setMeretarany(undefined); }}>
                <option value={-1}>– nincs –</option>
                {lapok.map((l, i) => <option value={i}>{l.fajl} · {l.oldal}. oldal{l.cim ? ` · ${l.cim}` : ''}</option>)}
              </select>
            </label>
            <label class="mezo"><span>Metszet</span>
              <select value={mIdx} onChange={(e) => setMIdx(Number((e.target as HTMLSelectElement).value))}>
                <option value={-1}>– nincs –</option>
                {lapok.map((l, i) => <option value={i}>{l.fajl} · {l.oldal}. oldal{l.cim ? ` · ${l.cim}` : ''}</option>)}
              </select>
            </label>
          </div>
        )}
      </section>

      {mintaFajta && <MintaLakasok fajta={mintaFajta} modosit={modosit} ugrik={ugrik} />}

      {al && aLap && (
        <section class="szakasz">
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
              {ej && <small class="halkabb">{ej.forras === 'betu' ? 'Az „É” / „N” betűs északjelből.' : eszakJavitas(ej.alairas) !== 0 ? 'Ismert északjel: a korábban rögzített iránnyal. Ellenőrizd az előnézeten (piros nyíl).' : 'Az északjel alakjából – ellenőrizd az előnézeten (piros nyíl), a javítást a program ehhez a jelhez megjegyzi.'}</small>}
            </div>
            {al.e.egysegek.length > 1 && (
              <div class="mezo szeles"><span>Lakások / egységek (a helyiségszámozás szerint)</span>
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
              <thead><tr><th></th><th>Kód</th><th>Helyiség</th><th>Besorolás</th><th class="szam">Terület</th><th>Külső fal (nettó)</th><th>Ellenőrzés</th></tr></thead>
              <tbody>
                {helyisegek.map((h, i) => {
                  if (!egysegben(i)) return null;
                  const ri = raszterIdx(i); const R = ri >= 0 ? al.r?.helyisegek[ri] : undefined;
                  const fl = falak(i);
                  const megj: string[] = [];
                  if (h.kulter) megj.push('külső tér – nem kerül át');
                  if (h.forras === 'jegyzek') megj.push('csak a jegyzékben: helye a rajzon nem ismert');
                  if (h.jegyzekA !== undefined && Math.abs(h.jegyzekA - h.A) > 0.011) megj.push(`jegyzék: ${sz(h.jegyzekA)} m²`);
                  if (R?.szivarog) megj.push('a helyiség körvonala nem zárt – a külső falakat ellenőrizd');
                  return (
                    <tr style={valasztott[i] ? '' : 'opacity:.55'}>
                      <td><input type="checkbox" aria-label={`${h.nev} átvétele`} disabled={h.kulter} checked={valasztott[i]} onChange={(e) => { const s = new Set(kizartH); if ((e.target as HTMLInputElement).checked) s.delete(i); else s.add(i); setKizartH(s); }} /></td>
                      <td>{h.kod ?? '–'}</td>
                      <td>{h.nev}{h.burkolat && <span class="halkabb"> · {h.burkolat}</span>}</td>
                      <td style="min-width:190px">{!h.kulter && <Valaszto cimke="Besorolás" ertek={kategoria(i)} opciok={KATEGORIAK} valt={(v) => setKat({ ...kat, [i]: v })} />}</td>
                      <td class="szam">{sz(h.A)} m²</td>
                      <td>{fl.length ? fl.map((f) => <span style="white-space:nowrap;margin-right:8px"><span style={`color:${IRANY_SZIN[f.irany]}`}>■</span> {egtaj(f.irany, eszakSz)} {sz(f.hossz)} m</span>) : <span class="halkabb">–</span>}</td>
                      <td class="halkabb">{megj.join('; ')}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr><td colSpan={4}>Átvett helyiségek</td><td class="szam">{sz(helyisegek.reduce((s, h, i) => s + (valasztott[i] ? h.A : 0), 0))} m²</td><td colSpan={2}>{iranyok.filter((x) => x.hossz > 0).map((x) => `${x.t} ${sz(x.hossz)} m`).join(' · ')}</td></tr></tfoot>
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
          </table>
          <div class="tabla-gorgeto">
            <table class="tabla">
              <thead><tr><th></th><th>Fajta</th><th class="szam">Szélesség × magasság</th><th class="szam">Mellvéd</th><th>Helyiség</th><th>Égtáj</th></tr></thead>
              <tbody>
                {nyilasok.map(({ n, k, hi }) => (
                  <tr style={kizartNy.has(k) ? 'opacity:.55' : ''}>
                    <td><input type="checkbox" aria-label="Átvétel" checked={!kizartNy.has(k)} onChange={(e) => { const s = new Set(kizartNy); if ((e.target as HTMLInputElement).checked) s.delete(k); else s.add(k); setKizartNy(s); }} /></td>
                    <td>{FAJTA_NEV[n.fajta]}</td>
                    <td class="szam">{Math.round(n.szel * 100)} × {Math.round(n.mag * 100)} cm</td>
                    <td class="szam">{n.pm === null ? '–' : `${Math.round(n.pm * 100)} cm`}</td>
                    <td>{helyisegek[hi]?.kod} {helyisegek[hi]?.nev}{kategoria(hi) === 'gyengen_kapcsolt' && <small class="halkabb" style="display:block">fűtetlen tér – nem kerül a hőburokba</small>}</td>
                    <td>{egtaj(n.irany!, eszakSz)}</td>
                  </tr>
                ))}
              </tbody>
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
            <label><input type="checkbox" checked={padloAt} onChange={(e) => setPadloAt((e.target as HTMLInputElement).checked)} /> Talajon fekvő padló (földszinti lakás, szint)</label>
            <label><input type="checkbox" checked={tetoAt} onChange={(e) => setTetoAt((e.target as HTMLInputElement).checked)} /> Padlásfödém / tető (legfelső szint)</label>
          </div>
          <div class="gombsor">
            <button class="gomb fo" disabled={!valasztott.some(Boolean)} onClick={atvesz}>Átvétel a projektbe</button>
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
