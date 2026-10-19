import { useState } from 'preact/hooks';
import { pvgis, gepeszet as T, type EpuletEredmeny } from '@mag/index';
import { Mezo, Szam, Szoveg, Valaszto, sz } from '../ui';
import { ujId, napelemPvgisBemenet, type Projekt, type NapelemUI } from '../modell';
import * as C from '../gepeszetCimkek';

type Modosit = (fn: (p: Projekt) => void) => void;

const HONAPOK = ['jan', 'feb', 'márc', 'ápr', 'máj', 'jún', 'júl', 'aug', 'szept', 'okt', 'nov', 'dec'];
const AZIMUT = [
  { ertek: '0', nev: 'Dél (0°)' }, { ertek: '-45', nev: 'Délkelet (−45°)' }, { ertek: '45', nev: 'Délnyugat (+45°)' },
  { ertek: '-90', nev: 'Kelet (−90°)' }, { ertek: '90', nev: 'Nyugat (+90°)' }, { ertek: '-135', nev: 'Északkelet (−135°)' },
  { ertek: '135', nev: 'Északnyugat (+135°)' }, { ertek: '180', nev: 'Észak (180°)' },
];

/** PVGIS-lekérés a saját Worker proxyn át (a PVGIS API böngészőből közvetlenül nem hívható). */
async function pvgisLeker(be: pvgis.PvgisBemenet): Promise<pvgis.PvgisEredmeny> {
  const q = new URLSearchParams({ lat: be.lat.toFixed(4), lon: be.lon.toFixed(4), peakpower: String(be.kWp), loss: String(be.veszteseg), angle: String(be.hajlasszog), aspect: String(be.azimut), mountingplace: be.elhelyezes });
  let v: Response;
  try { v = await fetch(`/api/pvgis?${q}`); } catch { throw new Error('A PVGIS-szolgáltatás nem érhető el. Ellenőrizd a hálózatot, vagy töltsd be a PVGIS weboldalán letöltött JSON-fájlt.'); }
  const tipus = v.headers.get('content-type') ?? '';
  if (!tipus.includes('json')) throw new Error('A PVGIS-lekérés csak a telepített oldalon működik (szerveroldali proxy). Itt a PVGIS weboldaláról letöltött JSON-fájlt töltheted be.');
  const j = await v.json();
  if (!v.ok) throw new Error((j as { hiba?: string }).hiba ?? `PVGIS hiba (${v.status})`);
  return pvgis.pvgisFeldolgoz(j, be, v.headers.get('x-pvgis-url') ?? 'https://re.jrc.ec.europa.eu/api/v5_3/PVcalc');
}

export function NapelemSzakasz({ p, modosit, eredmeny }: { p: Projekt; modosit: Modosit; eredmeny: EpuletEredmeny | null }) {
  const gp = p.gepeszet;
  const k = p.meta.koordinata;
  const [geoAllapot, setGeoAllapot] = useState<string | null>(null);
  const ossz = gp.napelem.reduce((s, n) => s + n.kWp, 0);
  const cim = [p.meta.irsz, p.meta.telepules, p.meta.kozterulet && [p.meta.kozterulet, p.meta.kozteruletJelleg, p.meta.hazszam].filter(Boolean).join(' ')].filter(Boolean).join(', ');

  async function geokod() {
    setGeoAllapot('Keresés…');
    try {
      const v = await fetch(`/api/geokod?${new URLSearchParams({ q: cim || p.meta.telepules })}`);
      if (!(v.headers.get('content-type') ?? '').includes('json')) throw new Error('A címkereső csak a telepített oldalon működik; add meg kézzel a koordinátát.');
      const j = await v.json() as { lat?: number; lon?: number; nev?: string; hiba?: string };
      if (!v.ok || j.lat === undefined || j.lon === undefined) throw new Error(j.hiba ?? 'A címet nem találtam.');
      modosit((q) => { q.meta.koordinata = { lat: Math.round(j.lat! * 1e5) / 1e5, lon: Math.round(j.lon! * 1e5) / 1e5, forras: `OpenStreetMap Nominatim: ${j.nev}` }; });
      setGeoAllapot(`Találat: ${j.nev}`);
    } catch (e) { setGeoAllapot((e as Error).message); }
  }

  return (
    <section class="szakasz">
      <h2>Napelem</h2>
      <p class="halk">A termelés teljes egészében exportáltként számít, és súlyozott értékével csökkenti az összesített energetikai jellemzőt (14.7). 20 kWp-ig használható a 13.1. táblázat (egyszerűsített módszer); bármekkora teljesítményre a részletes módszer (13.2.2) a PVGIS-szel, amelynek havi termelési és besugárzási adatai igazolásként a projektben és a jegyzőkönyvben maradnak.</p>

      <div class="kartya" style="margin-bottom:16px">
        <h3 style="margin-bottom:8px">Az épület helye</h3>
        <div class="racs">
          <Mezo cim="Földrajzi szélesség"><Szam ertek={k?.lat} egyseg="°" valt={(v) => modosit((q) => { q.meta.koordinata = { lat: v, lon: q.meta.koordinata?.lon ?? 19, forras: 'kézi megadás' }; })} /></Mezo>
          <Mezo cim="Földrajzi hosszúság"><Szam ertek={k?.lon} egyseg="°" valt={(v) => modosit((q) => { q.meta.koordinata = { lat: q.meta.koordinata?.lat ?? 47, lon: v, forras: 'kézi megadás' }; })} /></Mezo>
          <div style="display:flex;align-items:flex-end"><button class="gomb" onClick={geokod} disabled={!cim && !p.meta.telepules}>Koordináta a címből</button></div>
        </div>
        <p class="halkabb" style="margin-top:6px">{geoAllapot ?? (k?.forras ? `Forrás: ${k.forras}` : 'A PVGIS-hez kell; a címből vagy kézzel adható meg.')}</p>
      </div>

      <div style="display:flex;flex-direction:column;gap:16px">
        {gp.napelem.map((n, i) => (
          <NapelemKartya key={n.id} p={p} n={n} W={eredmeny?.napelem[i]?.W} tobbMint20={ossz > 20}
            m={(fn) => modosit((q) => fn(q.gepeszet.napelem[i]!))}
            torol={() => modosit((q) => { q.gepeszet.napelem.splice(i, 1); })} />
        ))}
      </div>
      <div class="gombsor" style="margin-top:12px">
        <button class="gomb" onClick={() => modosit((q) => { q.gepeszet.napelem.push({ id: ujId(), nev: q.gepeszet.napelem.length ? `Napelem ${q.gepeszet.napelem.length + 1}` : 'Napelem', kWp: 4, tajolas: 'D', hajlasszog: 30, azimut: 0, veszteseg: 14, elhelyezes: 'building', modszer: ossz + 4 > 20 ? 'pvgis' : 'tabla' }); })}>Napelem hozzáadása</button>
        {gp.napelem.length > 0 && <span class="halkabb">Összesen {sz(ossz, 2)} kWp{ossz > 20 ? ' – 20 kWp fölött csak részletes módszer (PVGIS) használható' : ''}</span>}
        {eredmeny && eredmeny.indikatorok.celonkent.export.nren > 0 && (
          <span class="halk">Az összesített energetikai jellemzőt {sz(eredmeny.indikatorok.celonkent.export.nren / eredmeny.indikatorok.AN, 1)} kWh/m²a-val csökkenti.</span>
        )}
      </div>
    </section>
  );
}

function NapelemKartya({ p, n, W, tobbMint20, m, torol }: { p: Projekt; n: NapelemUI; W: number | undefined; tobbMint20: boolean; m: (fn: (n: NapelemUI) => void) => void; torol: () => void }) {
  const [allapot, setAllapot] = useState<string | null>(null);
  const [tolt, setTolt] = useState(false);
  const modszer = n.modszer ?? 'tabla';
  const be = napelemPvgisBemenet(p, n);
  const ervenyes = be ? pvgis.pvgisErvenyes(n.pvgis, be) : false;
  const pv = n.pvgis;

  async function leker() {
    if (!be) return;
    setTolt(true); setAllapot(null);
    try { const e = await pvgisLeker(be); m((x) => { x.pvgis = e; }); setAllapot(null); }
    catch (e) { setAllapot((e as Error).message); }
    finally { setTolt(false); }
  }

  async function fajlbol(f: File | undefined) {
    if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      const fb = pvgis.pvgisBemenetFajlbol(j);
      const e = pvgis.pvgisFeldolgoz(j, fb, `PVGIS weboldal, letöltött fájl: ${f.name}`);
      m((x) => { x.kWp = fb.kWp; x.hajlasszog = fb.hajlasszog; x.azimut = fb.azimut; x.veszteseg = fb.veszteseg; x.elhelyezes = fb.elhelyezes; x.pvgis = e; x.modszer = 'pvgis'; });
      const k = p.meta.koordinata;
      setAllapot(k && (Math.abs(k.lat - fb.lat) >= 1e-3 || Math.abs(k.lon - fb.lon) >= 1e-3)
        ? `A fájl helye (${fb.lat}, ${fb.lon}) eltér a projekt koordinátájától – igazítsd a projektet, vagy kérd le újra.`
        : null);
    } catch (err) { setAllapot((err as Error).message); }
  }

  return (
    <div class="kartya gep-kartya">
      <div class="gep-fej">
        <div style="flex:1;min-width:200px"><Szoveg ertek={n.nev} valt={(v) => m((x) => { x.nev = v; })} /></div>
        <button class="gomb halk-gomb" onClick={torol}>Törlés</button>
      </div>
      <div class="racs">
        <Mezo cim="Számítási módszer">
          <Valaszto ertek={modszer} valt={(v) => m((x) => { x.modszer = v; if (v === 'pvgis') { x.azimut ??= x.tajolas === 'D' ? 0 : x.tajolas === 'DK_DNy' ? -45 : -90; x.veszteseg ??= 14; x.elhelyezes ??= 'building'; } })}
            opciok={[{ ertek: 'tabla', nev: '13.1. táblázat (egyszerűsített, ≤ 20 kWp)' }, { ertek: 'pvgis', nev: 'PVGIS (részletes módszer, 13.2.2)' }]} />
        </Mezo>
        <Mezo cim="Beépített teljesítmény"><Szam ertek={n.kWp} egyseg="kWp" valt={(v) => m((x) => { x.kWp = v; })} /></Mezo>
        <Mezo cim="Hajlásszög"><Szam ertek={n.hajlasszog} egyseg="°" valt={(v) => m((x) => { x.hajlasszog = Math.min(Math.max(v, 0), 90); })} /></Mezo>
        {modszer === 'tabla'
          ? <Mezo cim="Tájolás (13.1. táblázat)"><Valaszto ertek={n.tajolas} valt={(v) => m((x) => { x.tajolas = v; })} opciok={C.opciok(C.PV_TAJOLAS_NEV)} /></Mezo>
          : <>
            <Mezo cim="Azimut" sugo="0° = dél, −90° = kelet, +90° = nyugat">
              <div class="egyseg">
                <Szam ertek={n.azimut ?? 0} egyseg="°" valt={(v) => m((x) => { x.azimut = Math.min(Math.max(Math.round(v), -180), 180); const t = pvgis.tablaTajolas(x.azimut); if (t) x.tajolas = t; })} />
                <select aria-label="Égtáj" value={AZIMUT.some((a) => Number(a.ertek) === n.azimut) ? String(n.azimut) : ''} onChange={(e) => { const v = Number((e.target as HTMLSelectElement).value); m((x) => { x.azimut = v; const t = pvgis.tablaTajolas(v); if (t) x.tajolas = t; }); }}>
                  <option value="">Égtáj…</option>
                  {AZIMUT.map((a) => <option value={a.ertek}>{a.nev}</option>)}
                </select>
              </div>
            </Mezo>
            <Mezo cim="Rendszerveszteség" sugo="PVGIS alapérték 14% (kábel, inverter, szennyeződés)"><Szam ertek={n.veszteseg ?? 14} egyseg="%" valt={(v) => m((x) => { x.veszteseg = Math.min(Math.max(v, 0), 50); })} /></Mezo>
            <Mezo cim="Elhelyezés"><Valaszto ertek={n.elhelyezes ?? 'building'} valt={(v) => m((x) => { x.elhelyezes = v; })} opciok={[{ ertek: 'building', nev: 'Tetőre, homlokzatra szerelt (épülethez kötött)' }, { ertek: 'free', nev: 'Szabadon álló (átszellőzött)' }]} /></Mezo>
          </>}
      </div>

      {modszer === 'tabla' && (
        <p class="halkabb" style="margin-top:8px">
          {tobbMint20 ? <span style="color:var(--hiba)">Az összteljesítmény 20 kWp fölött van: a 13.1. táblázat nem alkalmazható, válts PVGIS-re. </span> : null}
          Fajlagos termelés a 13.1. táblázatból: {sz(T.napelemTermeles(1, n.tajolas, n.hajlasszog), 0)} kWh/kWp. Éves termelés: <strong>{sz(W, 0)} kWh/a</strong>.
        </p>
      )}

      {modszer === 'pvgis' && (
        <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px">
          <div class="gombsor">
            <button class="gomb fo" onClick={leker} disabled={!be || tolt}>{tolt ? 'Lekérés…' : pv ? 'PVGIS újralekérése' : 'PVGIS lekérése'}</button>
            <label class="gomb" style="cursor:pointer">PVGIS JSON-fájl betöltése<input type="file" accept="application/json,.json" style="display:none" onChange={(e) => { const t = e.target as HTMLInputElement; fajlbol(t.files?.[0]).then(() => { t.value = ''; }); }} /></label>
            {be && <a class="halkabb" href="https://re.jrc.ec.europa.eu/pvg_tools/hu/" target="_blank" rel="noopener">PVGIS weboldal</a>}
            {!be && <span class="jel rossz">Előbb add meg az épület koordinátáit.</span>}
            {pv && <span class={`jel ${ervenyes ? 'jo' : 'rossz'}`}>{ervenyes ? 'Érvényes lekérés' : 'Elavult: a bemenetek megváltoztak'}</span>}
          </div>
          {allapot && <p class="jel rossz">{allapot}</p>}
          {pv && <PvgisIgazolas pv={pv} />}
        </div>
      )}
    </div>
  );
}

/** A PVGIS-lekérés igazoló adatai: bemenetek, meteorológiai forrás, havi termelés és besugárzás, veszteségek. */
export function PvgisIgazolas({ pv }: { pv: pvgis.PvgisEredmeny }) {
  const b = pv.bemenet;
  const maxE = Math.max(...pv.havi.map((h) => h.E_m), 1);
  return (
    <details class="pvgis-igazolas" open>
      <summary>
        <strong>{sz(pv.ossz.E_y, 0)} kWh/év</strong> ({sz(pv.ossz.E_y / b.kWp, 0)} kWh/kWp) · besugárzás a modulsíkban {sz(pv.ossz.H_y, 0)} kWh/m²·év
      </summary>
      <dl class="mutatok" style="margin:8px 0">
        <dt>Hely</dt><dd>{sz(pv.hely.lat, 4)}° É, {sz(pv.hely.lon, 4)}° K{pv.hely.magassag !== null ? `, ${sz(pv.hely.magassag, 0)} m tszf.` : ''}</dd>
        <dt>Meteorológiai adatbázis</dt><dd>{pv.meteo.sugarzasDb ?? '–'}{pv.meteo.evTol ? `, ${pv.meteo.evTol}–${pv.meteo.evIg}` : ''}{pv.meteo.horizont === null ? '' : pv.meteo.horizont ? ', terepárnyékolással' : ', terepárnyékolás nélkül'}</dd>
        <dt>Rendszer</dt><dd>{sz(b.kWp, 2)} kWp, {pv.modul.technologia ?? 'kristályos Si'}, dőlés {b.hajlasszog}°, azimut {b.azimut}°, {b.elhelyezes === 'free' ? 'szabadon álló' : 'épületre szerelt'}, veszteség {sz(b.veszteseg, 0)}%</dd>
        {pv.ossz.l_total !== null && <><dt>Veszteségek</dt><dd>beesési szög {sz(pv.ossz.l_aoi, 1)}%, spektrális {sz(pv.ossz.l_spec, 1)}%, hőmérséklet és besugárzás {sz(pv.ossz.l_tg, 1)}%, összesen {sz(pv.ossz.l_total, 1)}%</dd></>}
        <dt>Lekérve</dt><dd>{new Date(pv.lekerve).toLocaleString('hu-HU')}</dd>
      </dl>
      <div class="tabla-gorgeto">
        <table class="tabla pvgis-tabla">
          <thead><tr><th>Hónap</th><th class="szam">Termelés E<sub>m</sub> [kWh]</th><th class="szam">Besugárzás H(i)<sub>m</sub> [kWh/m²]</th><th class="szam">Szórás [kWh]</th><th aria-hidden="true"></th></tr></thead>
          <tbody>
            {pv.havi.map((h, i) => (
              <tr>
                <td>{HONAPOK[i]}</td><td class="szam">{sz(h.E_m, 0)}</td><td class="szam">{sz(h.H_m, 1)}</td><td class="szam">{sz(h.SD_m, 0)}</td>
                <td style="width:30%"><span class="sav-mini" style={`width:${(h.E_m / maxE) * 100}%`} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td>Év</td><td class="szam">{sz(pv.ossz.E_y, 0)}</td><td class="szam">{sz(pv.ossz.H_y, 0)}</td><td class="szam">{sz(pv.ossz.SD_y, 0)}</td><td /></tr></tfoot>
        </table>
      </div>
      <p class="halkabb" style="margin-top:4px">Forrás: {pvgis.PVGIS_FORRAS}. {pv.url.startsWith('http') ? <a href={pv.url} target="_blank" rel="noopener">Lekérdezés URL</a> : pv.url}</p>
    </details>
  );
}
