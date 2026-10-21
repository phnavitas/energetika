/**
 * Pecsét nélküli alaprajzok (pl. típusalaprajz-mintalapok): a lépték becslése a méretláncokból, és a helyiségek
 * automatikus felismerése a falak közötti zárt terekből.
 */
import type { Lap, Szoveg } from './kinyeres';
import { raszterEpit } from './raszter';
import type { TervHelyiseg } from './alaprajz';

const PT_M = (25.4 / 72) / 1000;

/** Méretlánc-szám: „3,45” (m) vagy „25” (cm). */
function kotaErtek(s: string): number | null {
  const t = s.trim();
  if (/^\d{1,2},\d{2}$/.test(t)) return Number(t.replace(',', '.'));
  if (/^\d{1,3}$/.test(t)) { const v = Number(t); return v >= 5 && v <= 120 ? v / 100 : null; }
  return null;
}

/**
 * A lépték becslése: egy méretlánc egymás melletti számainak középpont-távolsága a két érték összegének fele.
 * Soronként (azonos irány, azonos keresztkoordináta) párosít, és a leggyakoribb arányt (hisztogram) adja.
 */
export function meretaranyKotabol(sz: Szoveg[]): number | null {
  const k = sz.map((t) => ({ t, v: kotaErtek(t.s) })).filter((x): x is { t: Szoveg; v: number } => x.v !== null);
  const geo = (t: Szoveg) => { const th = t.szog * Math.PI / 180; const dir = [Math.cos(th), -Math.sin(th)]; return { dir, cx: t.x + dir[0]! * t.szel / 2, cy: t.y + dir[1]! * t.szel / 2 }; };
  const sorok = new Map<string, { menti: number; v: number; meret: number }[]>();
  for (const { t, v } of k) {
    const g = geo(t); const fugg = Math.abs(g.dir[0]!) < 0.5;
    const kereszt = fugg ? g.cx : g.cy, menti = fugg ? g.cy : g.cx;
    const kulcs = `${fugg ? 'f' : 'v'}|${Math.round(kereszt / 1.5)}`;
    (sorok.get(kulcs) ?? sorok.set(kulcs, []).get(kulcs)!).push({ menti, v, meret: t.meret });
  }
  const aranyok: number[] = [];
  for (const s of sorok.values()) {
    s.sort((a, b) => a.menti - b.menti);
    for (let i = 0; i + 1 < s.length; i++) {
      const d = s[i + 1]!.menti - s[i]!.menti; if (d <= s[i]!.meret * 0.8) continue;
      aranyok.push((s[i]!.v + s[i + 1]!.v) / 2 / d);
    }
  }
  if (aranyok.length < 4) return null;
  // log-hisztogram, 4%-os rekeszek; a legsűrűbb rekesz és két szomszédja átlaga
  const rek = new Map<number, number[]>();
  for (const a of aranyok) { const r = Math.round(Math.log(a) / 0.04); (rek.get(r) ?? rek.set(r, []).get(r)!).push(a); }
  let best = 0, bestK = 0;
  for (const [r] of rek) { const n = (rek.get(r - 1)?.length ?? 0) + rek.get(r)!.length + (rek.get(r + 1)?.length ?? 0); if (n > best) { best = n; bestK = r; } }
  if (best < 3) return null;
  const l = [...(rek.get(bestK - 1) ?? []), ...rek.get(bestK)!, ...(rek.get(bestK + 1) ?? [])].sort((a, b) => a - b);
  const mPerPt = l[Math.floor(l.length / 2)]!;
  return Math.round(mPerPt / PT_M);
}

/**
 * Pecsét nélküli lapon a falakkal körbezárt terek (≥ 2 m²) mint helyiségek: a lap sarkaiból indított elárasztás
 * a külső teret jelöli, a raszter a zárt zsebeket külső térré nyilvánítaná – ezeket gyűjtjük ki.
 */
export function automatikusHelyisegek(lap: Lap, mPerPt: number): TervHelyiseg[] {
  const sarkok = [{ x: 1, y: 1 }, { x: lap.szel - 1, y: lap.mag - 1 }];
  const px = 0.05;
  const r = raszterEpit(lap, mPerPt, sarkok, { px, resZaras: 3.0, vastagVonalFal: 0.05 }, 1);
  const { w, h, cimke } = r;
  const latott = new Uint8Array(w * h);
  const ki: TervHelyiseg[] = [];
  for (let i = 0; i < w * h; i++) {
    if (cimke[i] !== 1 || latott[i]) continue;
    const komp: number[] = [i]; latott[i] = 1; let szel = false;
    for (let k = 0; k < komp.length; k++) {
      const q = komp[k]!, x = q % w, y = (q / w) | 0;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) szel = true;
      for (const n of [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, q - w, q + w]) if (n >= 0 && n < w * h && cimke[n] === 1 && !latott[n]) { latott[n] = 1; komp.push(n); }
    }
    const A = komp.length * px * px;
    if (szel || A < 2 || A > 120) continue;
    // befoglaló téglalap kitöltöttsége: a helyiség zömök (≥ 45%), a rajzok közti „zseb” szabálytalan, hosszú
    let bx0 = w, by0 = h, bx1 = 0, by1 = 0;
    for (const q of komp) { const x = q % w, y = (q / w) | 0; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
    const kitolt = komp.length / ((bx1 - bx0 + 1) * (by1 - by0 + 1));
    const nyulank = Math.max(bx1 - bx0 + 1, by1 - by0 + 1) / Math.min(bx1 - bx0 + 1, by1 - by0 + 1);
    if (kitolt < 0.45 || nyulank > 8) continue;
    // belső pont: a komponens súlypontjához legközelebbi saját pixel
    let sx = 0, sy = 0; for (const q of komp) { sx += q % w; sy += (q / w) | 0; }
    sx /= komp.length; sy /= komp.length;
    let leg = komp[0]!, ld = Infinity;
    for (const q of komp) { const d = (q % w - sx) ** 2 + (((q / w) | 0) - sy) ** 2; if (d < ld) { ld = d; leg = q; } }
    const x = r.x0 + ((leg % w) + 0.5) * px / mPerPt, y = r.y0 + (((leg / w) | 0) + 0.5) * px / mPerPt;
    ki.push({ nev: `Helyiség ${ki.length + 1}`, A: Math.round(A * 100) / 100, x, y, forras: 'pecset', kulter: false });
  }
  // olvasási sorrend: fentről lefelé, balról jobbra
  ki.sort((a, b) => Math.round(a.y / 20) - Math.round(b.y / 20) || a.x - b.x);
  ki.forEach((hz, i) => { hz.nev = `Helyiség ${i + 1}`; });
  return ki;
}
