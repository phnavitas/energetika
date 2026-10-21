import { useEffect, useRef, useState } from 'preact/hooks';
import type { Projekt } from '../modell';
import { tervAtvesz } from '../terv/atvetel';
import { egtaj } from '../terv/alaprajz';
import { Szam, sz } from '../ui';
import panelAdat from '../mintak/tipusalaprajz_panel.json';
import blokkosAdat from '../mintak/tipusalaprajz_blokkos.json';
import panelKepUrl from '../mintak/tipusalaprajz_panel_szurke.png?url';
import blokkosKepUrl from '../mintak/tipusalaprajz_blokkos_szurke.png?url';
import panelTerkepUrl from '../mintak/tipusalaprajz_panel_lakasok.png?url';
import blokkosTerkepUrl from '../mintak/tipusalaprajz_blokkos_lakasok.png?url';

type Modosit = (fn: (p: Projekt) => void) => void;

/**
 * Beépített típusalaprajz-mintalap: a lakások fix adatai (tools/mintalap/lakasok.py állítja elő a PDF 2. oldalából):
 * lakás = egy összefüggő szürke színezett terület (az x-szel áthúzott aknák nélkül); helyiségenként nettó terület
 * és külső falhossz lapirány szerint; nyílászárók a feliratok (szélesség / magasság, parapet) alapján.
 */
interface MintaLakas {
  n: number; epulet: number; A: number; doboz: number[]; kozep: number[];
  helyisegek: { nev: string; A: number; falak: { irany: number; hossz: number }[] }[];
  nyilasok: { irany: number; fajta: 'ablak' | 'erkelyajto'; szel: number; mag: number; pm: number | null; helyiseg: number }[];
}
const ADAT = { panel: panelAdat as { forras: string; lakasok: MintaLakas[] }, blokkos: blokkosAdat as { forras: string; lakasok: MintaLakas[] } };
const KEP = { panel: panelKepUrl, blokkos: blokkosKepUrl };
const TERKEP = { panel: panelTerkepUrl, blokkos: blokkosTerkepUrl };
const IRANY_NEV: Record<number, string> = { 0: 'lapon fent', 90: 'lapon jobbra', 180: 'lapon lent', 270: 'lapon balra' };
const norm = (x: number) => ((x % 360) + 360) % 360;

export function MintaLakasok({ fajta, modosit, ugrik }: { fajta: 'panel' | 'blokkos'; modosit: Modosit; ugrik: (n: 'helyisegek' | 'hatarolas' | 'retegrendek') => void }) {
  const adat = ADAT[fajta];
  const [val, setVal] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [eszak, setEszak] = useState(0);
  const [bm, setBm] = useState(fajta === 'panel' ? 2.6 : 2.7);
  const [padloAt, setPadloAt] = useState(false);
  const [tetoAt, setTetoAt] = useState(false);
  const [csere, setCsere] = useState(true);
  const [kesz, setKesz] = useState<string[] | null>(null);
  const terkep = useRef<{ w: number; h: number; d: Uint8ClampedArray } | null>(null);
  const fedo = useRef<HTMLCanvasElement>(null);
  const [meret, setMeret] = useState<{ w: number; h: number } | null>(null);

  // lakástérkép (képpontonként a lakás sorszáma) a kattintáshoz és a kiemeléshez
  useEffect(() => {
    setVal(null); setKesz(null); terkep.current = null; setMeret(null);
    const img = new Image(); img.src = TERKEP[fajta];
    img.decode().then(() => {
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const x = c.getContext('2d')!; x.drawImage(img, 0, 0);
      terkep.current = { w: c.width, h: c.height, d: x.getImageData(0, 0, c.width, c.height).data };
      setMeret({ w: c.width, h: c.height });
    }).catch(() => {});
  }, [fajta]);

  // kiemelés: kiválasztott és egér alatti lakás színezése
  useEffect(() => {
    const t = terkep.current, c = fedo.current;
    if (!t || !c) return;
    c.width = t.w; c.height = t.h;
    const x = c.getContext('2d')!;
    const kep = x.createImageData(t.w, t.h);
    for (let i = 0; i < t.w * t.h; i++) {
      const n = t.d[i * 4]!;
      if (!n) continue;
      const o = i * 4;
      if (n === val) { kep.data[o] = 46; kep.data[o + 1] = 109; kep.data[o + 2] = 180; kep.data[o + 3] = 120; }
      else if (n === hover) { kep.data[o] = 46; kep.data[o + 1] = 109; kep.data[o + 2] = 180; kep.data[o + 3] = 55; }
    }
    x.putImageData(kep, 0, 0);
  }, [val, hover, meret]);

  function lakasAlatt(ev: MouseEvent): number | null {
    const t = terkep.current; if (!t) return null;
    const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    const px = Math.floor(((ev.clientX - r.left) / r.width) * t.w), py = Math.floor(((ev.clientY - r.top) / r.height) * t.h);
    if (px < 0 || py < 0 || px >= t.w || py >= t.h) return null;
    return t.d[(py * t.w + px) * 4]! || null;
  }

  const L = val !== null ? adat.lakasok.find((l) => l.n === val) ?? null : null;
  const oldalak = [0, 90, 180, 270].map((ir) => ({
    ir, t: egtaj(ir, eszak),
    hossz: L ? L.helyisegek.reduce((s, h) => s + h.falak.filter((f) => f.irany === ir).reduce((q, f) => q + f.hossz, 0), 0) : 0,
    db: L ? L.nyilasok.filter((n) => n.irany === ir).length : 0,
  }));

  function atvesz() {
    if (!L) return;
    let uz: string[] = [];
    modosit((q) => {
      uz = tervAtvesz(q, {
        helyisegek: L.helyisegek.map((h) => ({ nev: h.nev, A: h.A, kategoria: 'kondicionalt', falak: h.falak })),
        retegrendek: [],
        nyilasok: L.nyilasok.map((n) => ({ fajta: n.fajta, szel: n.szel, mag: n.mag, pm: n.pm, helyiseg: n.helyiseg, irany: n.irany })),
        eszakSzog: eszak, belmagassag: bm, szintszam: 1, csere, padloAt, tetoAt,
        ...(fajta === 'blokkos' ? { alapFalSablon: 'fal_blokk_kohosalak' } : {}),
        forras: `${adat.forras}, ${L.n}. lakás`,
      }).uzenetek;
      if (!q.meta.nev) q.meta.nev = `${fajta === 'panel' ? 'Panel' : 'Blokkos'} típuslakás – ${L.n}. lakás`;
    });
    setKesz(uz);
  }

  return (
    <section class="szakasz">
      <h2>{fajta === 'panel' ? 'Panel' : 'Blokkos'} típusalaprajzok – válassz lakást</h2>
      <p class="halk">Kattints a lakásra. Egy lakás = egy összefüggő szürke színezett terület összes helyisége, az x-szel áthúzott aknák nélkül. A lakások adatai (helyiségek nettó területe, külső falhosszak, nyílászárók) a mintalap méretláncaival ellenőrzött, előre feldolgozott adatok.</p>
      <div class="minta-keret">
        <div class="minta-lap" onMouseMove={(e) => setHover(lakasAlatt(e))} onMouseLeave={() => setHover(null)} onClick={(e) => { const n = lakasAlatt(e); if (n) { setVal(n); setKesz(null); } }}
          style={hover ? 'cursor:pointer' : ''} role="img" aria-label="Típusalaprajz-lap, a lakások kattintással választhatók">
          <img src={KEP[fajta]} alt="" draggable={false} />
          <canvas ref={fedo} />
          {meret && adat.lakasok.map((l) => (
            <span class={`minta-szam${l.n === val ? ' aktiv' : ''}`} style={`left:${(l.kozep[0]! / meret.w) * 100}%;top:${(l.kozep[1]! / meret.h) * 100}%`}>{l.n}</span>
          ))}
        </div>

        <div class="minta-panel">
          {!L ? (
            <div class="kartya halk">
              {adat.lakasok.length} lakás a lapon. Kattints egy lakásra a rajzon – utána jelennek meg a helyiségei, a külső falai és a nyílászárói.
            </div>
          ) : (
            <>
              <div class="kartya">
                <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
                  <h3>{L.n}. lakás</h3>
                  <strong>{sz(L.A, 2)} m²</strong>
                </div>
                <p class="halkabb">{L.epulet}. épülettípus · {L.helyisegek.length} helyiség · {L.nyilasok.length} nyílászáró</p>
                <table class="tabla" style="margin-top:8px">
                  <thead><tr><th>Helyiség</th><th class="szam">Terület</th><th>Külső fal</th></tr></thead>
                  <tbody>
                    {L.helyisegek.map((h, i) => (
                      <tr>
                        <td style="white-space:nowrap">{h.nev}</td>
                        <td class="szam">{sz(h.A, 2)} m²</td>
                        <td class="halkabb">{h.falak.map((f) => `${egtaj(f.irany, eszak)} ${sz(f.hossz, 2)} m`).join(', ') || '–'}{L.nyilasok.some((n) => n.helyiseg === i) ? ` · ${L.nyilasok.filter((n) => n.helyiseg === i).map((n) => `${n.fajta === 'ablak' ? 'ablak' : 'erkélyajtó'} ${Math.round(n.szel * 100)}×${Math.round(n.mag * 100)}`).join(', ')}` : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div class="kartya" style="display:flex;flex-direction:column;gap:10px">
                <div class="mezo">
                  <span>Észak iránya a lapon</span>
                  <div class="gombsor">
                    {[[0, '↑ fent'], [90, '→ jobbra'], [180, '↓ lent'], [270, '← balra']].map(([sz0, nv]) => (
                      <button class={`gomb${eszak === sz0 ? ' fo' : ''}`} onClick={() => setEszak(sz0 as number)}>{nv}</button>
                    ))}
                    <span class="egyseg" style="max-width:110px"><Szam cimke="Észak iránya, fok" ertek={eszak} valt={(v) => setEszak(norm(v))} /><em>°</em></span>
                  </div>
                </div>
                <table class="tabla">
                  <thead><tr><th>Homlokzat</th><th>Égtáj</th><th class="szam">Falhossz</th><th class="szam">Nyílászáró</th></tr></thead>
                  <tbody>{oldalak.filter((o) => o.hossz > 0 || o.db).map((o) => <tr><td>{IRANY_NEV[o.ir]}</td><td>{o.t}</td><td class="szam">{sz(o.hossz, 2)} m</td><td class="szam">{o.db} db</td></tr>)}</tbody>
                </table>
                <div class="racs">
                  <label class="mezo"><span>Belmagasság</span><span class="egyseg"><Szam ertek={bm} valt={setBm} /><em>m</em></span></label>
                </div>
                <label class="jelolo"><input type="checkbox" checked={padloAt} onChange={(e) => setPadloAt((e.target as HTMLInputElement).checked)} /> Talajon fekvő padló (földszinti lakás)</label>
                <label class="jelolo"><input type="checkbox" checked={tetoAt} onChange={(e) => setTetoAt((e.target as HTMLInputElement).checked)} /> Padlásfödém / tető (legfelső szint)</label>
                <div class="jelolo" style="flex-wrap:wrap;gap:12px">
                  <label class="jelolo"><input type="radio" name="mintaMod" checked={csere} onChange={() => setCsere(true)} /> Felülírás</label>
                  <label class="jelolo"><input type="radio" name="mintaMod" checked={!csere} onChange={() => setCsere(false)} /> Hozzáadás</label>
                </div>
                <button class="gomb fo" onClick={atvesz}>{L.n}. lakás átvétele a projektbe</button>
                {fajta === 'panel' && <p class="halkabb">A panel külső falának rétegrendjét az Épület lépés panel-típusválasztójával (2. függ. 4.6. táblázat) vedd fel.</p>}
              </div>
            </>
          )}
          {kesz && (
            <div class="siker-doboz">
              Átvéve. {kesz.map((u) => <div class="halkabb">{u}</div>)}
              <div class="gombsor" style="margin-top:8px">
                <button class="gomb" onClick={() => ugrik('helyisegek')}>Helyiségek</button>
                <button class="gomb" onClick={() => ugrik('retegrendek')}>Rétegrendek</button>
                <button class="gomb" onClick={() => ugrik('hatarolas')}>Határolás</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
