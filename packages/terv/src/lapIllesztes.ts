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

export type IllModszer = 'referencia' | 'tengely' | 'lanc' | 'geometria' | 'szint' | null;
/** szint: a függőlegesen illesztett nézetek (z = a − y · mPt a lapon) – metszeten, homlokzaton. */
export interface LapIllesztesEredmeny { modszer: IllModszer; reszlet: string; szint?: I.SzintNezet[] }
export interface IllBeLap { lap: Lap; szerep: string; cim?: string; fajl?: string }

const lepteke = (lap: Lap): { M: number | null; mPt: number } => { const M = meretaranyKeres(lap.szovegek, lap.utvonalak); return { M, mPt: (25.4 / 72 / 1000) * (M ?? 100) }; };

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
  const elso = lapok.map((l, i): LapIllesztesEredmeny => {
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
      // 3) geometria – csak ahol a negatív kontroll (másik minta alaprajzával) szerint a módszer megkülönböztet
      // (2026-11-24, 12 minta, saját / idegen): helyszín-kontúr ≥ 0,95 → 8 / 12 saját, 0 / 132 idegen (0,8-nál 17 %
      // idegen is „illeszkedett”); feliratos homlokzat, ha a látható sarkok ≥ 95 %-a egyezik → 7 / 24, 1 / 264
      // (sarok nélkül 30 % idegen). A metszet szélessége (47 % idegen) és a falsík-minta (idegen is 1,0) nem bizonyít:
      // metszetet csak tengelyjel / méretlánc illeszt.
      if (l.szerep === 'helyszinrajz' && konturM.length) { const r = I.helyszinIllesztes(l.lap, konturM, d.mPt); if (r && r.talalat >= 0.95) return { modszer: 'geometria', reszlet: `a kontúr a helyszínrajzon (${Math.round(r.talalat * 100)} %)` }; }
      if (l.szerep === 'homlokzat' && konturM.length) { const r = I.homlokzatCimesIllesztes(l.lap, d.mPt, konturM, eszak ?? 0, homlokzatCimek(l.lap)).filter((q) => q.sarok >= 0.95); if (r.length) return { modszer: 'geometria', reszlet: `${r.length} feliratos nézet (szélesség, sarkok)` }; }
    } catch { /* */ }
    return { modszer: null, reszlet: '' };
  });
  // 4) SZINTJELEK – metszet, homlokzat: függőleges illesztés, az épülethez kötve (negatív kontroll, 12 minta, saját / idegen):
  //    ≥ 2 közös szint az alaprajzok szintfeliratival → 13 / 53, 4 / 583 idegen; ≥ 8 közös szint a projekt többi
  //    metszetével / homlokzatával → 32 / 53, 0 / 583 idegen. (A ±0,00 körüli, 10 cm alatti szintek nem számítanak.)
  const alapSzint = alapok.flatMap((a) => I.szintjelek(lapok[a]!.lap).map((q) => q.z));
  const nez = lapok.map((l, i) => (['metszet', 'homlokzat'].includes(l.szerep) ? I.szintNezetek(l.lap, adat[i]!.M) : []));
  nez.forEach((n, i) => { if (n.length && elso[i]!.modszer) elso[i]!.szint = n; });
  for (let kor = 0; kor < 3; kor++) {
    let valt = false;
    lapok.forEach((l, i) => {
      if (elso[i]!.modszer || !nez[i]!.length) return;
      const Z = nez[i]!.flatMap((n) => n.z);
      const kA = I.szintKozos(Z, alapSzint);
      // (a projekt többi metszetének / homlokzatának szintjei – a negatív kontroll ezt mérte: ≥ 8 közös szint idegen
      // projekt lapjával 0 / 583 –, nem csak a már illesztetteké: így a tengelyjel és lánc nélküli lapcsoport is illeszkedik)
      const illZ = lapok.flatMap((_, j) => (j !== i ? nez[j]!.flatMap((n) => n.z) : []));
      const kL = I.szintKozos(Z, illZ);
      if (kA >= 2 || kL >= 8) { elso[i] = { modszer: 'szint', reszlet: `magasság: ${nez[i]!.length} nézet szintjelekkel; ${kA >= 2 ? `${kA} közös szint az alaprajzzal` : `${kL} közös szint a projekt többi lapjával`}`, szint: nez[i] }; valt = true; }
    });
    if (!valt) break;
  }
  return elso;
}

/** A referencia alaprajz: a legtöbb tengelyjelű (egyezésnél az első) alaprajzi lap. */
export function referenciaLap(lapok: IllBeLap[]): number {
  let leg = -1, db = -1;
  lapok.forEach((l, i) => { if (l.szerep !== 'alaprajz') return; let n = 0; try { n = I.tengelyjelek(l.lap, lepteke(l.lap).mPt).length; } catch { n = 0; } if (n > db) { db = n; leg = i; } });
  return leg;
}
