/**
 * Homlokzati tervlapok: a felismert nyílászárók összevetése a projekt (jellemzően alaprajzból átvett) nyílászáróival
 * tájolásonként – darab, felület és méretlista. Csak ellenőrzés: a projektet nem módosítja.
 */
import { useMemo, useState } from 'preact/hooks';
import { klima } from '@mag/index';
import type { TervLap } from '../terv/elemzes';
import { homlokzatElemez, homlokzatIrany, type HomlokzatEredmeny } from '../terv/homlokzat';
import { sz } from '../ui';
import type { Projekt } from '../modell';

type Tajolas = (typeof klima.TAJOLASOK)[number];
const TOL = 0.05; // méretegyezés tűrése [m]

export function HomlokzatEllenorzes({ p, lapok }: { p: Projekt; lapok: { l: TervLap; i: number }[] }) {
  const elemzes = useMemo(() => lapok.map(({ l }) => { try { return homlokzatElemez(l.lap); } catch (e) { return { irany: null, mPerPt: null, ablakok: [], panelA: 0, uvegSzin: null, keretSzin: null, figyelmeztetesek: [`Hiba: ${(e as Error).message}`] } as HomlokzatEredmeny; } }), [lapok]);
  const [irany, setIrany] = useState<Record<number, Tajolas | ''>>({});
  const [szorzo, setSzorzo] = useState<Record<number, number>>({});
  const [nyitva, setNyitva] = useState<string | null>(null);

  const lapIrany = (k: number) => (irany[lapok[k]!.i] ?? homlokzatIrany(lapok[k]!.l.cim) ?? '') as Tajolas | '';
  const lapSzorzo = (k: number) => szorzo[lapok[k]!.i] ?? 1;

  // projekt: külső, üvegezett nyílászárók tájolásonként (tokméret, darab)
  const proj = new Map<string, { szel: number; mag: number; db: number; nev: string }[]>();
  for (const f of p.feluletek) {
    if (f.fajta !== 'nyilaszaro' || f.hatar !== 'kulso' || !f.tajolas) continue;
    const n = p.nyilaszarok.find((x) => x.id === f.nyilaszaroId);
    if (!n || (n.gn ?? 0) <= 0 || (f.hajlasszog ?? 90) < 60) continue;
    const l = proj.get(f.tajolas) ?? []; l.push({ szel: n.szelesseg, mag: n.magassag, db: f.darab ?? 1, nev: n.nev }); proj.set(f.tajolas, l);
  }
  const hom = new Map<string, { szel: number; mag: number; db: number; takart: number }[]>();
  elemzes.forEach((e, k) => {
    const t = lapIrany(k); if (!t) return;
    const l = hom.get(t) ?? [];
    for (const a of e.ablakok) l.push({ szel: a.szel, mag: a.mag, db: lapSzorzo(k), takart: a.takart ? lapSzorzo(k) : 0 });
    hom.set(t, l);
  });
  const iranyok = klima.TAJOLASOK.filter((t) => proj.has(t) || hom.has(t));
  const ossz = (l: { szel: number; mag: number; db: number }[] | undefined) => ({ db: (l ?? []).reduce((s, x) => s + x.db, 0), A: (l ?? []).reduce((s, x) => s + x.db * x.szel * x.mag, 0) });

  /** Méretcsoportok összevetése (±5 cm). */
  function meretek(t: string) {
    const cs: { szel: number; mag: number; proj: number; hom: number; takart: number; nevek: Set<string> }[] = [];
    const keres = (szel: number, mag: number) => cs.find((c) => Math.abs(c.szel - szel) <= TOL && Math.abs(c.mag - mag) <= TOL);
    for (const x of proj.get(t) ?? []) { const c = keres(x.szel, x.mag) ?? (cs.push({ szel: x.szel, mag: x.mag, proj: 0, hom: 0, takart: 0, nevek: new Set() }), cs.at(-1)!); c.proj += x.db; c.nevek.add(x.nev); }
    // takart (becsült magasságú) ablaknál a magasság tűrése nagyobb: a legközelebbi azonos szélességű csoport
    const keresT = (szel: number, mag: number) => cs.filter((c) => Math.abs(c.szel - szel) <= TOL && Math.abs(c.mag - mag) <= 0.15).sort((a, b) => Math.abs(a.mag - mag) - Math.abs(b.mag - mag))[0];
    for (const x of hom.get(t) ?? []) { const c = (x.takart ? keresT(x.szel, x.mag) : keres(x.szel, x.mag)) ?? (cs.push({ szel: x.szel, mag: x.mag, proj: 0, hom: 0, takart: 0, nevek: new Set() }), cs.at(-1)!); c.hom += x.db; c.takart += x.takart; }
    return cs.sort((a, b) => b.szel * b.mag - a.szel * a.mag);
  }
  const elt = (a: number, b: number) => (b > 0 ? (a - b) / b * 100 : null);
  // tájolás-ellenőrzés: ha a projekt tájolásait elforgatva sokkal jobban egyeznek a homlokzati felületek, az északjel gyanús
  const forgatas = (() => {
    const T = klima.TAJOLASOK, hA = (t: string) => ossz(hom.get(t)).A, pA = (t: string) => ossz(proj.get(t)).A;
    const homT = T.filter((t) => hom.has(t)); if (homT.length < 2) return null;
    const hiba = (lep: number) => homT.reduce((s, t) => s + Math.abs(pA(T[(T.indexOf(t) + lep + 8) % 8]!) - hA(t)), 0);
    const h0 = hiba(0); let leg = 0;
    for (let l = 1; l < 8; l++) if (hiba(l) < hiba(leg)) leg = l;
    return leg !== 0 && hiba(leg) < 0.6 * h0 ? (leg <= 4 ? leg * 45 : (leg - 8) * 45) : null;
  })();

  return (
    <section class="szakasz">
      <h2>Homlokzatok – nyílászárók ellenőrzése</h2>
      <p class="halk">A homlokzati lapokon a program a színezett üvegfelületekből és a körbefutó keretsávokból ismeri fel a nyílászárókat (tokkülméret), és tájolásonként összeveti a projektben lévő külső, üvegezett nyílászárókkal. A korlát vagy attika mögé bukó ablakok magassága becsült. Ha egy homlokzat a rajzon takart (pl. ikerépület egymás felé néző oldala, vagy azonos épületrész), a „szorzó” adja meg, hány ilyen homlokzat van.</p>
      <div class="tabla-gorgeto">
        <table class="tabla">
          <thead><tr><th>Homlokzati lap</th><th>Tájolás</th><th class="szam" title="Azonos, a rajzon nem látható homlokzatok száma">Szorzó</th><th class="szam">Nyílászáró</th><th class="szam">Felület</th><th class="szam" title="Keretszínű tömör panelek: jellemzően fém homlokzatburkolat, tömör ajtólap">Keretszínű panel</th><th>Megjegyzés</th></tr></thead>
          <tbody>{elemzes.map((e, k) => (
            <tr>
              <td>{lapok[k]!.l.cim || lapok[k]!.l.fajl}</td>
              <td><select aria-label="Tájolás" value={lapIrany(k)} onChange={(ev) => { const v = (ev.target as HTMLSelectElement).value as Tajolas; setIrany((x) => ({ ...x, [lapok[k]!.i]: v })); }}>
                <option value="">–</option>{klima.TAJOLASOK.map((t) => <option value={t}>{t}</option>)}
              </select></td>
              <td style="width:70px"><input type="number" min={0} step={1} value={lapSzorzo(k)} style="width:60px" onInput={(ev) => { const v = Math.max(0, Math.round(Number((ev.target as HTMLInputElement).value) || 0)); setSzorzo((x) => ({ ...x, [lapok[k]!.i]: v })); }} /></td>
              <td class="szam">{e.ablakok.length} db</td>
              <td class="szam">{sz(e.ablakok.reduce((s, a) => s + a.szel * a.mag, 0), 1)} m²</td>
              <td class="szam">{sz(e.panelA, 1)} m²</td>
              <td class="halkabb">{e.figyelmeztetesek.join(' ')}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <h3 style="margin:16px 0 8px">Összevetés tájolásonként</h3>
      {forgatas !== null && <div class="figyelmeztetes" style="margin-bottom:8px">A projekt nyílászárói tájolásonként jóval jobban egyeznének a homlokzatokkal, ha a tájolásuk {forgatas > 0 ? '+' : ''}{forgatas}°-kal el lenne forgatva – ellenőrizd az északjel irányát (Tervből: „Észak iránya”), illetve a homlokzati lapok tájolását.</div>}
      <div class="tabla-gorgeto">
        <table class="tabla">
          <thead><tr><th>Tájolás</th><th class="szam">Projekt db</th><th class="szam">Homlokzat db</th><th class="szam">Projekt m²</th><th class="szam">Homlokzat m²</th><th class="szam">Eltérés</th><th /></tr></thead>
          <tbody>{iranyok.map((t) => {
            const a = ossz(proj.get(t)), b = ossz(hom.get(t)); const e = elt(a.A, b.A);
            return (<>
              <tr>
                <td>{t}</td><td class="szam">{a.db}</td><td class="szam">{hom.has(t) ? b.db : '–'}</td>
                <td class="szam">{sz(a.A, 1)}</td><td class="szam">{hom.has(t) ? sz(b.A, 1) : <span class="halkabb">nincs homlokzati lap</span>}</td>
                <td class="szam">{e === null ? '–' : <span class={`jel ${Math.abs(e) <= 10 ? 'jo' : Math.abs(e) <= 25 ? 'figy' : 'rossz'}`}>{e > 0 ? '+' : ''}{sz(e, 0)}%</span>}</td>
                <td><button class="link-gomb" onClick={() => setNyitva(nyitva === t ? null : t)}>{nyitva === t ? 'bezár' : 'méretek'}</button></td>
              </tr>
              {nyitva === t && (
                <tr><td colSpan={7}>
                  <table class="tabla" style="margin:4px 0 8px">
                    <thead><tr><th>Méret (sz × m)</th><th class="szam">Projekt</th><th class="szam">Homlokzat</th><th>Projekt-típus</th></tr></thead>
                    <tbody>{meretek(t).map((c) => (
                      <tr style={c.proj !== c.hom ? 'background:var(--figy-hatter, #fff6e0)' : ''}>
                        <td>{sz(c.szel * 100, 0)} × {sz(c.mag * 100, 0)} cm</td>
                        <td class="szam">{c.proj || '–'}</td>
                        <td class="szam">{c.hom || '–'}{c.takart ? <span class="halkabb" title="ebből takart, becsült magasságú"> ({c.takart} takart)</span> : ''}</td>
                        <td class="halkabb">{[...c.nevek].join(', ')}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </td></tr>
              )}
            </>);
          })}
          {(() => { const a = ossz([...proj.values()].flat()), b = ossz([...hom.values()].flat()); const e = elt(a.A, b.A); return (
            <tr style="font-weight:600"><td>Összesen</td><td class="szam">{a.db}</td><td class="szam">{b.db}</td><td class="szam">{sz(a.A, 1)}</td><td class="szam">{sz(b.A, 1)}</td><td class="szam">{e === null ? '–' : `${e > 0 ? '+' : ''}${sz(e, 0)}%`}</td><td /></tr>
          ); })()}
          </tbody>
        </table>
      </div>
      <p class="halkabb" style="margin-top:8px">Projekt: a Határolás lépés külső, üvegezett, függőleges nyílászárói (tetősík ablak nélkül), darabszámmal. Homlokzat: a felismert nyílászárók × szorzó. Az eltérés a projekt felületének a homlokzatihoz mért aránya.</p>
    </section>
  );
}
