/**
 * A TERVLAPOK ILLESZTÉSE AZ ALAPRAJZHOZ – az alkalmazásban (2026-11-24, Balázs: „a többi rajzot is illeszteni kell,
 * utána értelmezhető”; „előbb a maradék illesztése”, majd a bekötés). Lapfajtánként a tervező saját jelei, ebben a
 * sorrendben: tengelyjelek → méretláncok → geometria (helyszínrajz: a kontúr mintaillesztése; homlokzat: felirat + észak
 * + szélesség; metszet: a metszésvonal menti szélesség, ill. a falsíkok mintája). A referencia az alaprajzi lap (a
 * legtöbb tengelyjelű); a koordináták a referencia lapjáról méterben (x · mPt).
 */
import type { Lap } from './kinyeres';
import type { Raszter } from './raszter';
import { meretaranyKeres } from './alaprajz';
import { meretlancok } from './meretlanc';
import { homlokzatCimek } from './homlokzat';
import * as I from './illesztes';

export type IllModszer = 'referencia' | 'tengely' | 'lanc' | 'geometria' | null;
export interface LapIllesztesEredmeny { modszer: IllModszer; reszlet: string }
export interface IllBeLap { lap: Lap; szerep: string; cim?: string; fajl?: string }

const lepteke = (lap: Lap): { M: number | null; mPt: number } => { const M = meretaranyKeres(lap.szovegek, lap.utvonalak); return { M, mPt: (25.4 / 72 / 1000) * (M ?? 100) }; };

/** A raszter falsíkjai az a→b vonal mentén (m, az a-tól): a falpixel-futások két vége. a, b: a lapon, pt-ben. */
export function falsikokRaszterbol(r: Raszter, a: [number, number], b: [number, number]): number[] {
  const mPt = r.mPerPt, L = Math.hypot(b[0] - a[0], b[1] - a[1]) * mPt; if (L < 0.5) return [];
  const n = Math.ceil(L / (r.px / 2)); const ki: number[] = []; let elozo = false;
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
    const gx = Math.floor(((x - r.x0) * mPt) / r.px), gy = Math.floor(((y - r.y0) * mPt) / r.px);
    const f = gx >= 0 && gy >= 0 && gx < r.w && gy < r.h && !!r.fal[gy * r.w + gx];
    if (f !== elozo) ki.push(t * L);
    elozo = f;
  }
  // (a 10 cm-nél keskenyebb futás – vonal, nem fal – kimarad)
  const sik: number[] = []; for (let i = 0; i + 1 < ki.length; i += 2) if (ki[i + 1]! - ki[i]! >= 0.1) sik.push(ki[i]!, ki[i + 1]!);
  return sik;
}

/**
 * lapok: a projekt összes lapja; ref: a referencia alaprajzi lap indexe; refR: a referencia raszterje (falak);
 * kontur: a ház külső körvonala a referencia lapján (pt); eszak: az alaprajz északja (fok) vagy null.
 */
export function lapokIllesztese(lapok: IllBeLap[], ref: number, refR: Raszter | null, kontur: [number, number][][], eszak: number | null): LapIllesztesEredmeny[] {
  const R = lapok[ref]!; const { mPt: refMPt } = refR ? { mPt: refR.mPerPt } : lepteke(R.lap);
  const konturM = kontur.map((p) => p.map(([x, y]) => [x * refMPt, y * refMPt] as [number, number]));
  const adat = lapok.map((l) => { const { M, mPt } = lepteke(l.lap); return { M, mPt, T: [] as I.Tengelyjel[], L: [] as { fg: boolean; J: number[] }[] }; });
  const kell = (i: number) => ['alaprajz', 'helyszinrajz', 'homlokzat', 'metszet', 'teto'].includes(lapok[i]!.szerep);
  lapok.forEach((l, i) => { if (!kell(i)) return; const d = adat[i]!; try { d.T = I.tengelyjelek(l.lap, i === ref ? refMPt : d.mPt); d.L = meretlancok(l.lap, i === ref ? refMPt : d.mPt).map((q) => ({ fg: q.fuggo, J: q.jelek.map((j) => j * (i === ref ? refMPt : d.mPt)) })).filter((q) => q.J[q.J.length - 1]! - q.J[0]! >= 3); } catch { /* */ } });
  const refT = adat[ref]!.T, refCs = [...new Set(refT.map((q) => q.csalad))];
  const alapok = lapok.map((l, i) => i).filter((i) => lapok[i]!.szerep === 'alaprajz');
  return lapok.map((l, i): LapIllesztesEredmeny => {
    if (i === ref) return { modszer: 'referencia', reszlet: 'ehhez illeszkedik a többi lap' };
    if (!kell(i)) return { modszer: null, reszlet: '' };
    const d = adat[i]!;
    try {
      // 1) tengelyjelek
      let t = 0, tdb = 0; for (const g of I.tengelyCsoportok(d.T)) { let leg = 0; for (const c of refCs) { const e = I.tengelyIllesztes(refT.filter((q) => q.csalad === c), g); if (e && e.db > leg) leg = e.db; } if (leg) { t++; tdb += leg; } }
      if (t) return { modszer: 'tengely', reszlet: `${t} nézet / tengelycsoport, ${tdb} közös tengely` };
      // 2) méretláncok (azonos teljes hossz, egyező belső jelek)
      let lc = 0; for (const q of d.L) { if (l.szerep !== 'helyszinrajz' && l.szerep !== 'alaprajz' && q.fg) continue; if (alapok.some((a) => adat[a]!.L.some((r) => { const m = I.lancEgyezes(r.J, q.J); return !!m && m.db >= 1 && m.pont >= 0.99; }))) lc++; }
      if (lc) return { modszer: 'lanc', reszlet: `${lc} egyező méretlánc` };
      // 3) geometria
      if (l.szerep === 'helyszinrajz' && konturM.length) { const r = I.helyszinIllesztes(l.lap, konturM, d.mPt); if (r && r.talalat >= 0.8) return { modszer: 'geometria', reszlet: `a kontúr a helyszínrajzon (${Math.round(r.talalat * 100)} %)` }; }
      if (l.szerep === 'homlokzat' && konturM.length) { const r = I.homlokzatCimesIllesztes(l.lap, d.mPt, konturM, eszak ?? 0, homlokzatCimek(l.lap)); if (r.length) return { modszer: 'geometria', reszlet: `${r.length} feliratos nézet (szélesség, sarkok)` }; }
      if (l.szerep === 'metszet' && refR) {
        const jelek = [...new Set(I.metszetJelek(l.lap).map((q) => q.jel))];
        for (const v of I.metszesVonalak(R.lap, jelek, refMPt)) {
          const sik = falsikokRaszterbol(refR, v.a, v.b);
          if (sik.length >= 2) { const W = sik[sik.length - 1]! - sik[0]!;
            for (const M of d.M ? [d.M] : [50, 100, 200]) { const mp = (25.4 / 72 / 1000) * M; if (I.homlokzatNezetek(l.lap, mp, true).some((n) => Math.abs(n.b - n.a - W) / W <= 0.08)) return { modszer: 'geometria', reszlet: `${v.betu}–${v.betu}: a metszésvonal menti szélesség` }; } }
          for (const M of d.M ? [d.M] : [50, 100]) { const r = I.falsikIllesztes(l.lap, (25.4 / 72 / 1000) * M, sik); if (r && r.db / r.N >= 0.7) return { modszer: 'geometria', reszlet: `${v.betu}–${v.betu}: falsíkok ${r.db}/${r.N}` }; }
        }
      }
    } catch { /* */ }
    return { modszer: null, reszlet: '' };
  });
}

/** A referencia alaprajz: a legtöbb tengelyjelű (egyezésnél az első) alaprajzi lap. */
export function referenciaLap(lapok: IllBeLap[]): number {
  let leg = -1, db = -1;
  lapok.forEach((l, i) => { if (l.szerep !== 'alaprajz') return; let n = 0; try { n = I.tengelyjelek(l.lap, lepteke(l.lap).mPt).length; } catch { n = 0; } if (n > db) { db = n; leg = i; } });
  return leg;
}
