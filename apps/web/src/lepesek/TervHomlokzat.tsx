/**
 * Homlokzati tervlapok: a felismert nyílászárók összevetése a projekt (jellemzően alaprajzból átvett) nyílászáróival
 * égtáj, szint és épület szerint csoportosítva, szűrhetően – darab, felület és méretlista. Csak ellenőrzés: a projektet
 * nem módosítja.
 */
import { useMemo, useState } from 'preact/hooks';
import { klima } from '@mag/index';
import type { TervLap } from '../terv/elemzes';
import { homlokzatElemez, homlokzatIrany, type HomlokzatEredmeny } from '../terv/homlokzat';
import { sz } from '../ui';
import type { Projekt } from '../modell';

type Tajolas = (typeof klima.TAJOLASOK)[number];
const TOL = 0.05; // méretegyezés tűrése [m]
const ISM = '?';

interface Tetel { hom: boolean; taj: string; szint: string; epulet: string; szel: number; mag: number; db: number; takart: number; nev?: string }

/** Szintnév → sorrend (pince, földszint, emeletek, tetőtér). */
function szintSorrend(s: string): number {
  if (/pince/i.test(s)) return -1;
  if (/földszint|fszt/i.test(s)) return 0;
  const m = /(\d+)\.\s*emelet/i.exec(s); if (m) return Number(m[1]);
  if (/tetőtér/i.test(s)) return 50;
  return 99;
}

export function HomlokzatEllenorzes({ p, lapok }: { p: Projekt; lapok: { l: TervLap; i: number }[] }) {
  const elemzes = useMemo(() => lapok.map(({ l }) => { try { return homlokzatElemez(l.lap); } catch (e) { return { irany: null, mPerPt: null, ablakok: [], panelA: 0, uvegSzin: null, keretSzin: null, figyelmeztetesek: [`Hiba: ${(e as Error).message}`] } as HomlokzatEredmeny; } }), [lapok]);
  const [irany, setIrany] = useState<Record<number, Tajolas | ''>>({});
  const [szorzo, setSzorzo] = useState<Record<number, number>>({});
  const [tombNev, setTombNev] = useState<Record<number, string>>({});
  const [nyitva, setNyitva] = useState<string | null>(null);
  const [szuro, setSzuro] = useState({ taj: '', szint: '', epulet: '' });
  const [bontas, setBontas] = useState({ szint: true, epulet: true });

  const lapIrany = (k: number) => (irany[lapok[k]!.i] ?? homlokzatIrany(lapok[k]!.l.cim) ?? '') as Tajolas | '';
  const lapSzorzo = (k: number) => szorzo[lapok[k]!.i] ?? 1;

  // ——— projekt oldal: külső, üvegezett, függőleges nyílászárók; szint a felület szintlistájából vagy a helyiségből, épület a helyiség egységéből
  const tetelek: Tetel[] = [];
  const epuletEbbol = (hId?: string) => {
    const h = p.helyisegek.find((x) => x.id === hId);
    const e = h?.egyseg && /^(\S{1,3}) épület/.exec(h.egyseg)?.[1];
    return e ?? (h && /\(([A-ZÁÉ]{1,2})\.[^)]*\)/.exec(h.nev)?.[1]) ?? ISM;
  };
  for (const f of p.feluletek) {
    if (f.fajta !== 'nyilaszaro' || f.hatar !== 'kulso' || !f.tajolas) continue;
    const n = p.nyilaszarok.find((x) => x.id === f.nyilaszaroId);
    if (!n || (n.gn ?? 0) <= 0 || (f.hajlasszog ?? 90) < 60) continue;
    const h = p.helyisegek.find((x) => x.id === f.helyisegId);
    const szintek = f.szintek?.length ? f.szintek : [h?.szint ?? ISM];
    for (const s of szintek) tetelek.push({ hom: false, taj: f.tajolas, szint: s, epulet: epuletEbbol(f.helyisegId), szel: n.szelesseg, mag: n.magassag, db: (f.darab ?? 1) / szintek.length, takart: 0, nev: n.nev });
  }
  const projSzintek = [...new Set(tetelek.map((t) => t.szint).filter((s) => s !== ISM && szintSorrend(s) >= 0))].sort((a, b) => szintSorrend(a) - szintSorrend(b));
  const projEpuletek = [...new Set(tetelek.map((t) => t.epulet).filter((e) => e !== ISM))].sort();

  // ——— homlokzat oldal: szint az ablakok felső élének magasságából (szintenként csoportosítva), épület a vízszintes tömbökből
  const tetok = elemzes.flatMap((e) => e.ablakok.filter((a) => a.z !== null).map((a) => a.z! + a.mag)).sort((a, b) => a - b);
  const szintHatar: number[] = []; // a csoportok közötti határok
  for (let i = 1; i < tetok.length; i++) if (tetok[i]! - tetok[i - 1]! > 1.2) szintHatar.push((tetok[i]! + tetok[i - 1]!) / 2);
  const homSzintNev = (zTeto: number | null) => {
    if (zTeto === null) return ISM;
    const idx = szintHatar.filter((h) => zTeto > h).length;
    return szintHatar.length + 1 === projSzintek.length ? projSzintek[idx]! : `${idx + 1}. ablaksor (alulról)`;
  };
  const tombok = elemzes.map((e) => {
    // ablakközéppontok x szerint; 4 m-nél nagyobb hézag új tömb
    const xs = e.ablakok.map((a) => (a.bbox[0] + a.bbox[2]) / 2).sort((a, b) => a - b);
    const hezag: { h: number; x: number }[] = [];
    for (let i = 1; i < xs.length; i++) { const h = (xs[i]! - xs[i - 1]!) * (e.mPerPt ?? 0); if (h > 4) hezag.push({ h, x: (xs[i]! + xs[i - 1]!) / 2 }); }
    // legfeljebb annyi tömb, ahány épület a projektben van: a legnagyobb hézagok választanak el
    const max = Math.max(0, projEpuletek.length - 1);
    return hezag.sort((a, b) => b.h - a.h).slice(0, max).map((x) => x.x).sort((a, b) => a - b);
  });
  const tombAlap = (k: number) => { const n = tombok[k]!.length + 1; return lapSzorzo(k) > 1 ? projEpuletek.slice(0, lapSzorzo(k)).join('+') : n === projEpuletek.length ? projEpuletek.join(',') : ''; };
  const tombCimkek = (k: number) => (tombNev[lapok[k]!.i] ?? tombAlap(k)).split(',').map((s) => s.trim());
  elemzes.forEach((e, k) => {
    const t = lapIrany(k); if (!t) return;
    const cimkek = tombCimkek(k);
    for (const a of e.ablakok) {
      const ti = tombok[k]!.filter((h) => (a.bbox[0] + a.bbox[2]) / 2 > h).length;
      // egyetlen „A+B” címke: a lap összes ablakára (takart azonos homlokzat)
      const ep = (cimkek.length === 1 && cimkek[0]!.includes('+') ? cimkek[0] : cimkek[ti]) || ISM;
      // „A+B”: a rajzon takart, azonos homlokzat(ok) – a szorzó a tömbök között oszlik meg
      const reszek = ep.includes('+') ? ep.split('+') : [ep];
      const db = lapSzorzo(k) / reszek.length;
      for (const r of reszek) tetelek.push({ hom: true, taj: t, szint: homSzintNev(a.z === null ? null : a.z + a.mag), epulet: r, szel: a.szel, mag: a.mag, db, takart: a.takart ? db : 0 });
    }
  });

  // ——— szűrés, csoportosítás
  const szurt = tetelek.filter((t) => (!szuro.taj || t.taj === szuro.taj) && (!szuro.szint || t.szint === szuro.szint) && (!szuro.epulet || t.epulet === szuro.epulet));
  const kulcs = (t: Tetel) => [t.taj, bontas.szint ? t.szint : '', bontas.epulet ? t.epulet : ''].join('|');
  const csoportok = new Map<string, Tetel[]>();
  for (const t of szurt) { const k = kulcs(t); const l = csoportok.get(k) ?? []; l.push(t); csoportok.set(k, l); }
  const sorok = [...csoportok.entries()].sort((a, b) => {
    const [ta, sa, ea] = a[0].split('|'), [tb, sb, eb] = b[0].split('|');
    return klima.TAJOLASOK.indexOf(ta as Tajolas) - klima.TAJOLASOK.indexOf(tb as Tajolas) || szintSorrend(sa!) - szintSorrend(sb!) || ea!.localeCompare(eb!);
  });
  const ossz = (l: Tetel[], hom: boolean) => { const x = l.filter((t) => t.hom === hom); return { db: x.reduce((s, t) => s + t.db, 0), A: x.reduce((s, t) => s + t.db * t.szel * t.mag, 0) }; };
  const elt = (a: number, b: number) => (b > 0 ? (a - b) / b * 100 : null);
  const kerek = (x: number) => (Math.abs(x - Math.round(x)) < 0.01 ? String(Math.round(x)) : sz(x, 1));

  /** Méretcsoportok összevetése (±5 cm; takart ablaknál a magasság ±15 cm). */
  function meretek(l: Tetel[]) {
    const cs: { szel: number; mag: number; proj: number; hom: number; takart: number; nevek: Set<string> }[] = [];
    const keres = (szel: number, mag: number) => cs.find((c) => Math.abs(c.szel - szel) <= TOL && Math.abs(c.mag - mag) <= TOL);
    const keresT = (szel: number, mag: number) => cs.filter((c) => Math.abs(c.szel - szel) <= TOL && Math.abs(c.mag - mag) <= 0.15).sort((a, b) => Math.abs(a.mag - mag) - Math.abs(b.mag - mag))[0];
    const uj = (x: Tetel) => (cs.push({ szel: x.szel, mag: x.mag, proj: 0, hom: 0, takart: 0, nevek: new Set() }), cs.at(-1)!);
    for (const x of l.filter((t) => !t.hom)) { const c = keres(x.szel, x.mag) ?? uj(x); c.proj += x.db; if (x.nev) c.nevek.add(x.nev); }
    for (const x of l.filter((t) => t.hom)) { const c = (x.takart ? keresT(x.szel, x.mag) : keres(x.szel, x.mag)) ?? uj(x); c.hom += x.db; c.takart += x.takart; }
    return cs.sort((a, b) => b.szel * b.mag - a.szel * a.mag);
  }

  // tájolás-ellenőrzés: ha a projekt tájolásait elforgatva sokkal jobban egyeznek a homlokzati felületek, az északjel gyanús
  const forgatas = (() => {
    const T = klima.TAJOLASOK;
    const A = (hom: boolean, t: string) => ossz(tetelek.filter((x) => x.taj === t), hom).A;
    const homT = T.filter((t) => tetelek.some((x) => x.hom && x.taj === t)); if (homT.length < 2) return null;
    const hiba = (lep: number) => homT.reduce((s, t) => s + Math.abs(A(false, T[(T.indexOf(t) + lep + 8) % 8]!) - A(true, t)), 0);
    const h0 = hiba(0); let leg = 0;
    for (let l = 1; l < 8; l++) if (hiba(l) < hiba(leg)) leg = l;
    return leg !== 0 && hiba(leg) < 0.6 * h0 ? (leg <= 4 ? leg * 45 : (leg - 8) * 45) : null;
  })();

  const opciok = (f: (t: Tetel) => string, rend?: (a: string, b: string) => number) => [...new Set(tetelek.map(f))].sort(rend);
  const tajOpc = opciok((t) => t.taj, (a, b) => klima.TAJOLASOK.indexOf(a as Tajolas) - klima.TAJOLASOK.indexOf(b as Tajolas));
  const szintOpc = opciok((t) => t.szint, (a, b) => szintSorrend(a) - szintSorrend(b) || a.localeCompare(b));
  const epOpc = opciok((t) => t.epulet);
  const ism = (s: string) => (s === ISM ? 'ismeretlen' : s);

  return (
    <section class="szakasz">
      <h2>Homlokzatok – nyílászárók ellenőrzése</h2>
      <p class="halk">A homlokzati lapokon a program a színezett üvegfelületekből és a körbefutó keretsávokból ismeri fel a nyílászárókat (tokkülméret), és égtáj, szint és épület szerint összeveti a projektben lévő külső, üvegezett nyílászárókkal. A korlát vagy attika mögé bukó ablakok magassága becsült („takart”). A homlokzati szint az ablakok felső élének magasságából, az épület a homlokzat vízszintes tömbjeiből adódik – a tömbök nevét (balról jobbra, vesszővel) lapoként megadhatod; a rajzon takart, azonos homlokzatnál a szorzó és a „+” jel (pl. „A+B”) adja meg, mely épületekre vonatkozik.</p>
      <div class="tabla-gorgeto">
        <table class="tabla">
          <thead><tr><th>Homlokzati lap</th><th>Tájolás</th><th class="szam" title="Azonos, a rajzon nem látható homlokzatok száma">Szorzó</th><th title="A homlokzat tömbjei balról jobbra, vesszővel (pl. „A,B”); takart azonos homlokzatnál „A+B”">Épület(ek)</th><th class="szam">Nyílászáró</th><th class="szam">Felület</th><th class="szam" title="Keretszínű tömör panelek: jellemzően fém homlokzatburkolat, tömör ajtólap">Keretszínű panel</th><th>Megjegyzés</th></tr></thead>
          <tbody>{elemzes.map((e, k) => (
            <tr>
              <td>{lapok[k]!.l.cim || lapok[k]!.l.fajl}</td>
              <td><select aria-label="Tájolás" value={lapIrany(k)} onChange={(ev) => { const v = (ev.target as HTMLSelectElement).value as Tajolas; setIrany((x) => ({ ...x, [lapok[k]!.i]: v })); }}>
                <option value="">–</option>{klima.TAJOLASOK.map((t) => <option value={t}>{t}</option>)}
              </select></td>
              <td style="width:70px"><input type="number" min={0} step={1} value={lapSzorzo(k)} style="width:60px" onInput={(ev) => { const v = Math.max(0, Math.round(Number((ev.target as HTMLInputElement).value) || 0)); setSzorzo((x) => ({ ...x, [lapok[k]!.i]: v })); }} /></td>
              <td style="width:110px"><input type="text" value={tombCimkek(k).join(',')} placeholder={`${tombok[k]!.length + 1} tömb`} style="width:90px" onChange={(ev) => { const v = (ev.target as HTMLInputElement).value; setTombNev((x) => ({ ...x, [lapok[k]!.i]: v })); }} /><small class="halkabb" style="display:block">{tombok[k]!.length + 1} tömb</small></td>
              <td class="szam">{e.ablakok.length} db</td>
              <td class="szam">{sz(e.ablakok.reduce((s, a) => s + a.szel * a.mag, 0), 1)} m²</td>
              <td class="szam">{sz(e.panelA, 1)} m²</td>
              <td class="halkabb">{e.figyelmeztetesek.join(' ')}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <h3 style="margin:16px 0 8px">Összevetés</h3>
      {forgatas !== null && <div class="figyelmeztetes" style="margin-bottom:8px">A projekt nyílászárói égtájanként jóval jobban egyeznének a homlokzatokkal, ha a tájolásuk {forgatas > 0 ? '+' : ''}{forgatas}°-kal el lenne forgatva – ellenőrizd az északjel irányát (Tervből: „Észak iránya”, kb. {forgatas > 0 ? '+' : ''}{forgatas}°), illetve a homlokzati lapok tájolását.</div>}
      <div class="gombsor" style="gap:12px;margin-bottom:8px;align-items:flex-end">
        <label class="mezo"><span>Égtáj</span><select value={szuro.taj} onChange={(e) => setSzuro({ ...szuro, taj: (e.target as HTMLSelectElement).value })}><option value="">Mind</option>{tajOpc.map((o) => <option value={o}>{o}</option>)}</select></label>
        <label class="mezo"><span>Szint</span><select value={szuro.szint} onChange={(e) => setSzuro({ ...szuro, szint: (e.target as HTMLSelectElement).value })}><option value="">Mind</option>{szintOpc.map((o) => <option value={o}>{ism(o)}</option>)}</select></label>
        <label class="mezo"><span>Épület</span><select value={szuro.epulet} onChange={(e) => setSzuro({ ...szuro, epulet: (e.target as HTMLSelectElement).value })}><option value="">Mind</option>{epOpc.map((o) => <option value={o}>{ism(o)}</option>)}</select></label>
        <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" checked={bontas.szint} onChange={(e) => setBontas({ ...bontas, szint: (e.target as HTMLInputElement).checked })} /> szintenként</label>
        <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" checked={bontas.epulet} onChange={(e) => setBontas({ ...bontas, epulet: (e.target as HTMLInputElement).checked })} /> épületenként</label>
      </div>
      <div class="tabla-gorgeto">
        <table class="tabla">
          <thead><tr><th>Égtáj</th>{bontas.szint && <th>Szint</th>}{bontas.epulet && <th>Épület</th>}<th class="szam">Projekt db</th><th class="szam">Homlokzat db</th><th class="szam">Projekt m²</th><th class="szam">Homlokzat m²</th><th class="szam">Eltérés</th><th /></tr></thead>
          <tbody>{sorok.map(([k, l]) => {
            const [taj, szint, ep] = k.split('|');
            const a = ossz(l, false), b = ossz(l, true); const e = elt(a.A, b.A);
            const oszlop = 7 + (bontas.szint ? 1 : 0) + (bontas.epulet ? 1 : 0);
            return (<>
              <tr>
                <td>{taj}</td>{bontas.szint && <td>{ism(szint!)}</td>}{bontas.epulet && <td>{ism(ep!)}</td>}
                <td class="szam">{kerek(a.db)}</td><td class="szam">{b.db ? kerek(b.db) : '–'}</td>
                <td class="szam">{sz(a.A, 1)}</td><td class="szam">{b.db ? sz(b.A, 1) : '–'}</td>
                <td class="szam">{e === null ? '–' : <span class={`jel ${Math.abs(e) <= 10 ? 'jo' : Math.abs(e) <= 25 ? 'figy' : 'rossz'}`}>{e > 0 ? '+' : ''}{sz(e, 0)}%</span>}</td>
                <td><button class="link-gomb" onClick={() => setNyitva(nyitva === k ? null : k)}>{nyitva === k ? 'bezár' : 'méretek'}</button></td>
              </tr>
              {nyitva === k && (
                <tr><td colSpan={oszlop}>
                  <table class="tabla" style="margin:4px 0 8px">
                    <thead><tr><th>Méret (sz × m)</th><th class="szam">Projekt</th><th class="szam">Homlokzat</th><th>Projekt-típus</th></tr></thead>
                    <tbody>{meretek(l).map((c) => (
                      <tr style={Math.abs(c.proj - c.hom) > 0.01 ? 'background:var(--figy-hatter, #fff6e0)' : ''}>
                        <td>{sz(c.szel * 100, 0)} × {sz(c.mag * 100, 0)} cm</td>
                        <td class="szam">{c.proj ? kerek(c.proj) : '–'}</td>
                        <td class="szam">{c.hom ? kerek(c.hom) : '–'}{c.takart ? <span class="halkabb" title="ebből takart, becsült magasságú"> ({kerek(c.takart)} takart)</span> : ''}</td>
                        <td class="halkabb">{[...c.nevek].join(', ')}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </td></tr>
              )}
            </>);
          })}
          {(() => { const a = ossz(szurt, false), b = ossz(szurt, true); const e = elt(a.A, b.A); return (
            <tr style="font-weight:600"><td colSpan={1 + (bontas.szint ? 1 : 0) + (bontas.epulet ? 1 : 0)}>Összesen{szuro.taj || szuro.szint || szuro.epulet ? ' (szűrve)' : ''}</td><td class="szam">{kerek(a.db)}</td><td class="szam">{kerek(b.db)}</td><td class="szam">{sz(a.A, 1)}</td><td class="szam">{sz(b.A, 1)}</td><td class="szam">{e === null ? '–' : `${e > 0 ? '+' : ''}${sz(e, 0)}%`}</td><td /></tr>
          ); })()}
          </tbody>
        </table>
      </div>
      <p class="halkabb" style="margin-top:8px">Projekt: a Határolás lépés külső, üvegezett, függőleges nyílászárói (tetősík ablak nélkül), darabszámmal; a több azonos szintre együtt átvett nyílászárók szintenként elosztva. Homlokzat: a felismert nyílászárók × szorzó. A falfülkéket a tervből átvétel nem veszi nyílászárónak. Az eltérés a projekt felületének a homlokzatihoz mért aránya.</p>
    </section>
  );
}
