/**
 * A teljes épületmodell 3D nézete – a közös 3D-motorral (az ELBA is ezt használja): falak (nyílásokkal kivágva), terek
 * padlója, födémek, tető, pillérek, alapozás; a hőburok elemei kiemelhetők. Forgatás: bal egérgomb húzása; mozgatás:
 * jobb / középső gomb vagy Shift; nagyítás: görgő (a kurzor felé).
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { falFelulet, type EpuletModell, type Fal, type BurokSzerep } from '@terv/epulet';
import type { ZartsagHiba } from '@terv/zartsag';
import { nezoNyit, type Nezo, type Elem3D, type Megjelenes, type TipusBeall } from '../nezo3d/motor';
import { epuletElemek, zartsagJelolok, EPULET_TIPUSOK, type EpuletForras } from '../nezo3d/epuletElemek';

/** Hőburok szerinti színek. */
const SZIN = {
  fal: 0xd8d2c4, falKulso: 0xc9bfa8, burok: 0xe8833a, futetlen: 0x5b9bd5, szomszed: 0x9ca3af, talaj: 0x8b6b4a,
  nyilas: 0x7fb7e6, padloFutott: 0xf3e3b5, padloFutetlen: 0xd5e3f0, padloKulter: 0xcfe8c5, fodem: 0xb8b0d8, piller: 0x8a8f99, teto: 0xb5643f,
};
const BEALL_KULCS = 'ekm-3d-tipus-v1';
const beallOlvas = (): TipusBeall => { try { return JSON.parse(localStorage.getItem(BEALL_KULCS) ?? '{}') as TipusBeall; } catch { return {}; } };
const burokSzin = (b: BurokSzerep | undefined) => (b === 'kulso' ? SZIN.burok : b === 'futetlen' ? SZIN.futetlen : b === 'szomszed' ? SZIN.szomszed : b === 'talaj' ? SZIN.talaj : null);

/** Hőburok szerinti színezés, ill. „csak a hőburok elemei” – elemenként. */
function hoburokMegj(e: Elem3D, hoburok: boolean, csakBurok: boolean): Megjelenes | null {
  const a = e.adat as EpuletForras | undefined; if (!a) return null;
  if (csakBurok) {
    if (a.fajta === 'fal' && burokSzin(a.fal.burok) === null) return { mod: 'rejtett' };
    if (a.fajta === 'nyilas' && burokSzin(a.fal.burok) === null) return { mod: 'rejtett' };
    if (a.fajta === 'ter') return { mod: 'rejtett' };
  }
  if (!hoburok) return null;
  switch (a.fajta) {
    case 'fal': return { szin: burokSzin(a.fal.burok) ?? (a.fal.kulso ? SZIN.falKulso : SZIN.fal), atl: 1 };
    case 'nyilas': return e.tipus === 'uveg' ? { szin: SZIN.nyilas, atl: 0.55 } : { szin: SZIN.nyilas, atl: 1 };
    case 'ter': return { szin: a.kategoria === 'futott' ? SZIN.padloFutott : a.kategoria === 'futetlen' ? SZIN.padloFutetlen : SZIN.padloKulter, atl: 1 };
    case 'tetoter': return { szin: SZIN.teto, atl: 0.45 };
    case 'teto': return { szin: SZIN.teto, atl: 0.85 };
    case 'lapos': return { szin: SZIN.teto, atl: 0.6 };
    case 'koszoru': case 'gerenda': return { szin: SZIN.piller, atl: 0.9 };
    case 'piller': return { szin: SZIN.piller, atl: 0.95 };
    case 'alapozas': return { szin: 0x9aa0a6, atl: 0.9 };
    case 'fodem': return a.burok === 'teto' ? { szin: SZIN.teto, atl: 0.35 } : { szin: SZIN.fodem, atl: 0.5 };
  }
  return null;
}

export type NyilasForras = { lap: number; ny: number };
export function Epulet3D({ modell, magassag = 600, kivNy, onNyilas, onElem, hibak }: { modell: EpuletModell; magassag?: number;
  /** Kattintással kijelölt elem (fal, nyílás, tér) azonosítója – a 2D rajzon kiemeléshez. */
  onElem?: (id: string | null) => void;
  /** A zártság-ellenőrzés hibái: piros jelölés a modellben (hiányzó fal, rés, tetőhézag, fedetlen rész). */
  hibak?: ZartsagHiba[];
  /** A kijelölt nyílászáró (forrása: lap és nyílásindex) – kiemelve; kattintásra onNyilas. */
  kivNy?: NyilasForras | null; onNyilas?: (f: NyilasForras | null) => void }) {
  const hely = useRef<HTMLDivElement>(null);
  const nezo = useRef<Nezo | null>(null);
  const [csakBurok, setCsakBurok] = useState(false);
  const [szintLathato, setSzintLathato] = useState<Record<string, boolean>>({});
  const [kijelolt, setKijelolt] = useState<string | null>(null);
  /** Színezés: anyag szerint (alap) vagy hőburok-szerep szerint; röntgen (áttetsző) az átlátszóság fokával; csak a kijelölt. */
  const [szinezes, setSzinezes] = useState<'anyag' | 'hoburok'>('anyag');
  const [rontgen, setRontgen] = useState(false);
  const [atl, setAtl] = useState(0.18);
  const [csakKij, setCsakKij] = useState(false);
  /** Vízszintes metszés (a vágósík magassága, m; null: nincs), környezeti árnyékolás, párhuzamos vetítés, típusonkénti megjelenés. */
  const [metsz, setMetsz] = useState<number | null>(null);
  const [ao, setAo] = useState(true);
  const [orto, setOrto] = useState(false);
  const [tipusB, setTipusB] = useState<TipusBeall>(() => beallOlvas());
  const tipusAllit = (t: string, v: { szin?: number; atl?: number } | null) => setTipusB((x) => { const u = { ...x }; if (v === null) delete u[t]; else u[t] = { ...u[t], ...v }; try { localStorage.setItem(BEALL_KULCS, JSON.stringify(u)); } catch { /* */ } return u; });
  const zTart = useMemo(() => { const z0 = Math.min(...modell.szintek.map((q) => q.z0)), z1 = Math.max(...modell.szintek.map((q) => q.z0 + q.h)); return [z0 - 1, z1 + 4] as const; }, [modell]);
  const lathato = (sz: string) => szintLathato[sz] !== false;

  // összesítés: falfelületek hőburok-szerep szerint, terek kategóriánként
  const osszeg = useMemo(() => {
    const bm = new Map(modell.szintek.map((s) => [s.id, s.belmag]));
    const ny = new Map<string, number>(); for (const n of modell.nyilasok) ny.set(n.fal, (ny.get(n.fal) ?? 0) + n.szel * n.mag);
    const o: Record<string, { A: number; ny: number }> = {};
    for (const f of modell.falak) { const k = f.burok ?? (f.kulso ? 'kulsoNem' : 'belso'); const x = (o[k] ??= { A: 0, ny: 0 }); x.A += falFelulet(f, bm.get(f.szint) ?? f.h); x.ny += ny.get(f.id) ?? 0; }
    return o;
  }, [modell]);

  // a motor egyszer indul; a többi hatás csak állapotot állít rajta (a geometria csak a modell változásakor épül újra)
  const hivas = useRef({ onElem, onNyilas }); hivas.current = { onElem, onNyilas };
  useEffect(() => {
    const el = hely.current; if (!el) return;
    const n = nezoNyit(el, { tipusok: EPULET_TIPUSOK, tipusBeall: tipusB, arnyekolas: ao, duplaKijelol: false,
      onKatt: (id, e) => { setKijelolt(id); hivas.current.onElem?.(id);
        const a = e?.adat as EpuletForras | undefined; hivas.current.onNyilas?.(a?.fajta === 'nyilas' ? a.forras ?? null : null); } });
    nezo.current = n;
    (globalThis as { __epulet3dKep?: () => string }).__epulet3dKep = () => n.kep();
    return () => { n.bezar(); nezo.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // (a hívó minden rajzoláskor új hibalistát ad – a geometria csak a tartalom változásakor épül újra)
  const hibaJel = JSON.stringify((hibak ?? []).map((x) => [x.fajta, x.szint, x.hely, x.a, x.b]));
  useEffect(() => { nezo.current?.elemek(epuletElemek(modell), zartsagJelolok(modell, hibak ?? [])); }, [modell, hibaJel]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { nezo.current?.megjelenes(szinezes === 'anyag' && !csakBurok ? null : (e) => hoburokMegj(e, szinezes === 'hoburok', csakBurok)); }, [modell, szinezes, csakBurok]);
  useEffect(() => {
    const ids = new Set<string>(); if (kijelolt) ids.add(kijelolt);
    if (kivNy) for (const n of modell.nyilasok) if (n.forras && n.forras.lap === kivNy.lap && n.forras.ny === kivNy.ny) ids.add(n.id);
    nezo.current?.kijelol(ids);
  }, [modell, kijelolt, kivNy?.lap, kivNy?.ny]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { nezo.current?.rontgen(rontgen, atl); }, [rontgen, atl]);
  useEffect(() => { nezo.current?.csakKijelolt(csakKij); }, [csakKij]);
  useEffect(() => { nezo.current?.metszes(metsz); }, [metsz]);
  useEffect(() => { nezo.current?.arnyekolas(ao); }, [ao]);
  useEffect(() => { nezo.current?.parhuzamos(orto); }, [orto]);
  useEffect(() => { nezo.current?.szintek(szintLathato); }, [szintLathato]);
  useEffect(() => { nezo.current?.tipusBeall(szinezes === 'anyag' ? tipusB : {}); }, [tipusB, szinezes]);

  const info = (() => {
    if (!kijelolt) return null;
    const f = modell.falak.find((x) => x.id === kijelolt);
    const tNev = (o: Fal['bal']) => (o.fajta === 'ter' ? modell.terek.find((t) => t.id === o.ter)?.nev ?? o.ter : ({ kulso: 'külső tér', talaj: 'talaj', szomszed: 'szomszéd épület', futetlen: 'fűtetlen tér', belso: 'felirat nélküli belső tér', ismeretlen: 'ismeretlen' } as const)[o.fajta]);
    if (f) return `Fal · ${f.hossz.toFixed(2)} m × ${f.profil ? `${Math.min(...f.profil.map((q) => q.z)).toFixed(2)}–${Math.max(...f.profil.map((q) => q.z)).toFixed(2)}` : (f.belsoMag ?? f.h).toFixed(2)} m${f.jelleg ? ` (${({ terdfal: 'térdfal', oromfal: 'oromfal', parkany: 'alacsonyabb párkány', ferde: 'ferde felső élű' } as const)[f.jelleg]})` : ''}, ${Math.round(f.vastag * 100)} cm · ${tNev(f.bal)} | ${tNev(f.jobb)}${f.burok ? ` · hőburok: ${({ kulso: 'külső fal', futetlen: 'fűtetlen tér felé', szomszed: 'szomszéd felé', talaj: 'talajjal érintkező' } as const)[f.burok]}` : ''}`;
    const n = modell.nyilasok.find((x) => x.id === kijelolt);
    if (n) return `Nyílászáró · ${Math.round(n.szel * 100)} × ${Math.round(n.mag * 100)} cm, mellvéd ${Math.round(n.pm * 100)} cm · ${n.fajta.replace('_', ' ')}${onNyilas ? ' – a mérete a nyílászárók listájában átírható' : ''}`;
    const t = modell.terek.find((x) => x.id === kijelolt);
    if (t) return `${t.kod ? t.kod + ' ' : ''}${t.nev} · ${t.A.toFixed(2)} m² · belmagasság ${t.belmag.toFixed(2)} m · ${({ futott: 'fűtött', futetlen: 'fűtetlen', kulter: 'kültér' } as const)[t.kategoria]}`;
    return null;
  })();
  const fm = (v: number) => v.toLocaleString('hu-HU', { maximumFractionDigits: 1 });
  // a magastető felülete (a háromszögek valós, ferde területe) és a legalsó padló területe
  const tetoA = (modell.magasteto?.haromszogek ?? []).reduce((t, [a, b, c]) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    return t + Math.hypot(u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!) / 2; }, 0);
  const polA = (p: [number, number][]) => Math.abs(p.reduce((q, a, i) => { const b = p[(i + 1) % p.length]!; return q + a[0] * b[1] - b[0] * a[1]; }, 0) / 2);
  const padloA = modell.fodemek.filter((f) => f.alatt === null).reduce((t, f) => t + f.poligonok.reduce((s, p) => s + polA(p), 0), 0);
  const laposA = (modell.magasteto?.lapos ?? []).reduce((t, p) => t + polA(p), 0);
  return (
    <div>
      <div class="gombsor" style="gap:8px;flex-wrap:wrap;align-items:center;padding:8px 10px">
        <span class="gombsor" style="gap:0" role="group" aria-label="Színezés">
          <button class={`gomb kis-gomb${szinezes === 'anyag' ? ' fo' : ''}`} onClick={() => setSzinezes('anyag')}>Anyag szerint</button>
          <button class={`gomb kis-gomb${szinezes === 'hoburok' ? ' fo' : ''}`} onClick={() => setSzinezes('hoburok')}>Hőburok szerint</button>
        </span>
        <label class="jelolo"><input type="checkbox" checked={rontgen} onChange={(e) => setRontgen((e.target as HTMLInputElement).checked)} /> röntgen</label>
        <input type="range" min="0.04" max="0.7" step="0.02" value={atl} disabled={!rontgen} aria-label="Röntgen átlátszóság" title="Röntgen: az elemek átlátszósága" style="width:90px"
          onInput={(e) => setAtl(Number((e.target as HTMLInputElement).value))} />
        <label class="jelolo" title="Csak a kijelölt elem látszik (kattints egy elemre)"><input type="checkbox" checked={csakKij} onChange={(e) => setCsakKij((e.target as HTMLInputElement).checked)} /> csak a kijelölt</label>
        <label class="jelolo"><input type="checkbox" checked={csakBurok} onChange={(e) => setCsakBurok((e.target as HTMLInputElement).checked)} /> csak a hőburok elemei</label>
        <label class="jelolo" title="Vízszintes vágósík: a sík fölötti rész nem látszik (3D alaprajz)"><input type="checkbox" checked={metsz !== null}
          onChange={(e) => setMetsz((e.target as HTMLInputElement).checked ? Math.min(...modell.szintek.map((q) => q.z0)) + 1.2 : null)} /> metszés</label>
        {metsz !== null && <>
          <select aria-label="Metszés a szinten" value="" onChange={(e) => { const v = (e.target as HTMLSelectElement).value; const sz0 = modell.szintek.find((q) => q.id === v); if (sz0) setMetsz(Math.round((sz0.z0 + 1.2) * 100) / 100); }} style="width:auto">
            <option value="">szint…</option>{modell.szintek.map((q) => <option value={q.id}>{q.nev} (+1,2 m)</option>)}
          </select>
          <input type="range" min={zTart[0]} max={zTart[1]} step="0.05" value={metsz} aria-label="A vágósík magassága" style="width:110px" onInput={(e) => setMetsz(Number((e.target as HTMLInputElement).value))} />
          <span class="halkabb" style="font-size:12px">{metsz.toFixed(2).replace('.', ',')} m</span>
        </>}
        <label class="jelolo" title="Környezeti árnyékolás: a sarkok, csatlakozások finoman sötétednek"><input type="checkbox" checked={ao} onChange={(e) => setAo((e.target as HTMLInputElement).checked)} /> árnyékolás</label>
        <label class="jelolo" title="Párhuzamos (axonometrikus) vetítés"><input type="checkbox" checked={orto} onChange={(e) => setOrto((e.target as HTMLInputElement).checked)} /> párhuzamos vetítés</label>
        {modell.szintek.map((s) => <label class="jelolo"><input type="checkbox" checked={lathato(s.id)} onChange={(e) => setSzintLathato((x) => ({ ...x, [s.id]: (e.target as HTMLInputElement).checked }))} /> {s.nev}</label>)}
        <span class="halkabb" style="font-size:12px">
          {(szinezes === 'anyag'
            ? [['#F1EDE4', 'fal'], ['#744A2C', 'tető'], ['#9AA0A6', 'alapozás'], ['#30343A', 'nyílászáró'], ['#F97316', 'kijelölt']]
            : [['#E8833A', 'külső fal (hőburok)'], ['#5B9BD5', 'fűtetlen felé'], ['#9CA3AF', 'szomszéd felé'], ['#D8D2C4', 'belső fal']]).map(([c, t]) => (
            <><span style={`display:inline-block;width:10px;height:10px;background:${c};border:1px solid #9ca3af;margin:0 4px 0 8px`} />{t}</>))}
        </span>
      </div>
      {szinezes === 'anyag' && <details style="padding:0 10px 6px;font-size:12px">
        <summary class="halkabb">Megjelenés típusonként (szín, átlátszóság – ebben a böngészőben megjegyezve)</summary>
        <table class="tabla" style="width:auto;margin-top:4px"><tbody>
          {EPULET_TIPUSOK.map(({ kulcs: k, nev, szin: alap, atl: atl0 }) => { const b = tipusB[k]; const hex = '#' + (b?.szin ?? alap).toString(16).padStart(6, '0'); return (
            <tr><td>{nev}</td>
              <td><input type="color" value={hex} aria-label={`${nev} színe`} onInput={(e) => tipusAllit(k, { szin: parseInt((e.target as HTMLInputElement).value.slice(1), 16) })} /></td>
              <td><input type="range" min="0.1" max="1" step="0.05" value={b?.atl ?? atl0 ?? 1} aria-label={`${nev} átlátszatlansága`} style="width:100px" onInput={(e) => tipusAllit(k, { atl: Number((e.target as HTMLInputElement).value) })} /></td>
              <td>{b && <button class="gomb kis-gomb halk-gomb" onClick={() => tipusAllit(k, null)}>alap</button>}</td></tr>); })}
        </tbody></table>
      </details>}
      <div ref={hely} style={`width:100%;height:${magassag}px`} />
      <div class="halkabb" style="font-size:12px;padding:6px 10px">
        {info ?? 'Kattints egy falra, nyílászáróra vagy helyiségre a részletekért (dupla kattintás egy elemen: ráközelít, üres helyen: alapnézet).'}<br />
        {modell.szintek.length} szint · {modell.terek.length} tér · {modell.falak.length} fal · {modell.nyilasok.length} nyílászáró ·
        hőburok-fal (belső sík × belmagasság): külső {fm(osszeg.kulso?.A ?? 0)} m² (nyílás {fm(osszeg.kulso?.ny ?? 0)}), fűtetlen felé {fm(osszeg.futetlen?.A ?? 0)} m², szomszéd felé {fm(osszeg.szomszed?.A ?? 0)} m²
        {padloA > 0 && <> · alsó födém (külső méret) {fm(padloA)} m²</>}{tetoA > 0 && <> · magastető {fm(tetoA)} m² ({String(Math.round((modell.magasteto?.hajlas ?? 0) * 10) / 10).replace('.', ',')}°)</>}{laposA > 0 && <> · lapostető {fm(laposA)} m²</>}
      </div>
    </div>
  );
}
