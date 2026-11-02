/**
 * Méretfelirat nélküli (alaprajzon mért szélességű) nyílások magassága a homlokzatról: a homlokzati rajz
 * nyílászárókereteit a homlokzat címe szerinti égtájon az alaprajz azonos irányú homlokzatának nyílásaihoz illesztjük
 * (egy vízszintes eltolás, amelynél a legtöbb szélesség és helyzet egyezik), és a mért nyílás helyén álló keret
 * magasságát vesszük. Több szint keretei egymás felett: a szint sorszáma szerint alulról.
 */
import type { Lap } from './kinyeres';
import type { TervNyilas } from './nyilaszarok';
import { homlokzatIrany, keretek, vonalIndex, type HomlokzatKeret } from './homlokzat';

/** Szélességtűrés az illesztésnél: az alaprajzi falnyílás és a homlokzati tok mérete eltérhet (tokbeépítés, takarás). */
const SZT = 0.2;
const AZ: Record<string, number> = { 'É': 0, 'ÉK': 45, 'K': 90, 'DK': 135, 'D': 180, 'DNy': 225, 'Ny': 270, 'ÉNy': 315 };
const szogKul = (a: number, b: number) => { const d = Math.abs((((a - b) % 360) + 540) % 360 - 180); return d; };

export interface HomlokzatRajz { az: number; mPerPt: number; keretek: HomlokzatKeret[] }

/** Egy homlokzati lap rajzai (címenként) a kereteikkel. */
export function homlokzatRajzok(lap: Lap): HomlokzatRajz[] {
  const ix = vonalIndex(lap); if (!ix) return [];
  const cimek = lap.szovegek.flatMap((t) => { if (!/homlokzat/i.test(t.s)) return []; const ir = homlokzatIrany(t.s); return ir ? [{ x: t.x, y: t.y, az: AZ[ir]! }] : []; });
  if (!cimek.length) return [];
  const ki = cimek.map((c) => ({ az: c.az, mPerPt: ix.mPerPt, keretek: [] as HomlokzatKeret[] }));
  for (const k of keretek(ix)) {
    let leg = -1, pont = Infinity;
    cimek.forEach((c, i) => { const dy = c.y - k.y1; if (dy < 0) return; const p = dy + 0.5 * Math.abs(c.x - (k.x0 + k.x1) / 2); if (p < pont) { pont = p; leg = i; } });
    if (leg >= 0) ki[leg]!.keretek.push(k);
  }
  return ki.filter((r) => r.keretek.length);
}

export interface MertMagassag { mag: number; takart: boolean; /** homlokzat: helyzet szerint illesztett keret; szelesseg: azonos szélességű keretek leggyakoribb magassága; becsult: alapérték */ forras: 'homlokzat' | 'szelesseg' | 'becsult' }

/**
 * A mért (mag = 0) nyílások magassága. `nyilasok`: az alaprajz összes külső nyílása (a feliratosak is – ezek segítik
 * az illesztést), `mPerPt` az alaprajz léptéke, `eszakSzog` az északjel, `szint` / `szintDb` a lap szintjének
 * sorszáma alulról és a szintek száma.
 */
export function mertMagassagok(nyilasok: TervNyilas[], mPerPt: number, eszakSzog: number, rajzok: HomlokzatRajz[], szint = 0, szintDb = 1): Map<TervNyilas, MertMagassag> {
  const ki = new Map<TervNyilas, MertMagassag>();
  const kulso = nyilasok.filter((n) => n.kulso && n.irany !== null && n.fajta !== 'falfulke');
  // vetület a homlokzat síkjára, a homlokzat felé néző szemlélő bal→jobb irányában (m)
  const s = (n: TervNyilas) => { const t = n.irany! * Math.PI / 180; return (-Math.cos(t) * n.x - Math.sin(t) * n.y) * mPerPt; };
  const e = (rz: HomlokzatRajz, k: HomlokzatKeret) => (k.x0 + k.x1) / 2 * rz.mPerPt;
  // rajzonként a hozzá legjobban illeszkedő alaprajzi homlokzat (lapirány): az északjel és a homlokzat címe 45° körül
  // kétértelmű lehet („keleti” az ÉK-i homlokzat), ezért a ±60°-on belüli irányok közül a legtöbb egyezés dönt
  for (const rz of rajzok) {
    let legjobb: { o: number; tam: number; sajat: TervNyilas[] } | null = null;
    for (const ir of [0, 90, 180, 270]) {
      if (szogKul(ir - eszakSzog, rz.az) > 60) continue;
      const sajat = kulso.filter((n) => n.irany === ir);
      if (!sajat.some((n) => n.mert)) continue;
      const jel: number[] = [];
      for (const n of sajat) for (const k of rz.keretek) if (Math.abs(k.szel - n.szel) <= SZT) jel.push(e(rz, k) - s(n));
      for (const c of jel) {
        const t = sajat.filter((n) => rz.keretek.some((k) => Math.abs(k.szel - n.szel) <= SZT && Math.abs(e(rz, k) - s(n) - c) <= 0.25)).length;
        if (!legjobb || t > legjobb.tam) legjobb = { o: c, tam: t, sajat };
      }
    }
    if (!legjobb || legjobb.tam < 2) continue;
    const { o, sajat } = legjobb;
    for (const n of sajat) {
      if (!n.mert || ki.has(n)) continue;
      const jo = rz.keretek.filter((k) => Math.abs(e(rz, k) - (s(n) + o)) <= 0.4 && Math.abs(k.szel - n.szel) <= 0.3).sort((a, b) => b.y1 - a.y1);
      if (!jo.length) continue;
      const k = jo.length === szintDb ? jo[szint]! : jo.length === 1 ? jo[0]! : jo.reduce((a, b) => (Math.abs(b.szel - n.szel) < Math.abs(a.szel - n.szel) ? b : a));
      ki.set(n, { mag: k.mag, takart: k.takart, forras: 'homlokzat' });
    }
  }
  // tartalék: az azonos (± 8 cm) szélességű keretek leggyakoribb magassága – előbb az azonos égtájú rajzokon, aztán bárhol;
  // ha nincs ilyen keret, alapérték (1,6 m feletti szélesség: padlóig érő üvegezés 2,40 m, egyébként ablak 1,50 m)
  for (const n of kulso) {
    if (!n.mert || ki.has(n)) continue;
    const gyak = (rk: HomlokzatRajz[]) => { const m = new Map<number, number>(); for (const r of rk) for (const k of r.keretek) if (Math.abs(k.szel - n.szel) <= 0.08) { const h = Math.round(k.mag * 20) / 20; m.set(h, (m.get(h) ?? 0) + 1); } return [...m.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0]; };
    const h = gyak(rajzok.filter((r) => szogKul(n.irany! - eszakSzog, r.az) <= 60)) ?? gyak(rajzok);
    ki.set(n, h !== undefined ? { mag: h, takart: false, forras: 'szelesseg' } : { mag: n.szel >= 1.6 ? 2.4 : 1.5, takart: false, forras: 'becsult' });
  }
  return ki;
}

/**
 * Északjel nélküli alaprajz: az észak iránya a homlokzati rajzokból. A címükben égtájat viselő homlokzatok
 * nyílászárókereteit minden szóba jöhető északirány (45°-onként) mellett az alaprajz megfelelő homlokzatának
 * nyílásaihoz illesztjük (szélesség és egymáshoz viszonyított helyzet); az az irány, amelynél a legtöbb nyílás
 * egyezik. Csak egyértelmű győztes esetén ad eredményt (≥ 4 egyezés, a második legjobb legfeljebb kétharmada).
 */
export function eszakHomlokzatbol(nyilasok: TervNyilas[], mPerPt: number, rajzok: HomlokzatRajz[]): number | null {
  const kulso = nyilasok.filter((n) => n.kulso && n.irany !== null && n.fajta !== 'falfulke' && n.szel > 0.3);
  if (!rajzok.length || kulso.length < 4) return null;
  const s = (n: TervNyilas) => { const t = n.irany! * Math.PI / 180; return (-Math.cos(t) * n.x - Math.sin(t) * n.y) * mPerPt; };
  const e = (rz: HomlokzatRajz, k: HomlokzatKeret) => (k.x0 + k.x1) / 2 * rz.mPerPt;
  const pont = (eszak: number) => {
    let ossz = 0;
    for (const rz of rajzok) {
      const sajat = kulso.filter((n) => szogKul(n.irany! - eszak, rz.az) <= 22.5);
      if (sajat.length < 2) continue;
      let leg = 0;
      for (const n of sajat) for (const k of rz.keretek) {
        if (Math.abs(k.szel - n.szel) > SZT) continue;
        const c = e(rz, k) - s(n);
        const t = sajat.filter((m) => rz.keretek.some((q) => Math.abs(q.szel - m.szel) <= SZT && Math.abs(e(rz, q) - s(m) - c) <= 0.25)).length;
        if (t > leg) leg = t;
      }
      ossz += leg;
    }
    return ossz;
  };
  const ered = [0, 45, 90, 135, 180, 225, 270, 315].map((sz) => ({ sz, p: pont(sz) })).sort((a, b) => b.p - a.p);
  return ered[0]!.p >= 4 && ered[1]!.p <= (2 / 3) * ered[0]!.p ? ered[0]!.sz : null;
}
