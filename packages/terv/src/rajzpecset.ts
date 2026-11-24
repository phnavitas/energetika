/**
 * A rajzpecsét (tervlap feliratmezője: tervező, építtető, rajzszám, méretarány, dátum…) és a lapkeret felismerése –
 * ezek vonalai, cellái nem falak, nem helyiségek, nem a hőburok részei.
 */
import type { Lap } from './kinyeres';

/** A rajzpecsét tipikus mezőnevei (kisbetűs, ékezetes). */
const KULCS: [string, RegExp][] = [
  ['rajzszam', /rajz\s*sz(á|a)m|rajzsz\.|tervsz(á|a)m|tervlapsz/],
  ['meretarany', /m(é|e)retar(á|a)ny|l(é|e)pt(é|e)k/],
  ['tervezo', /tervez(ő|o)|(é|e)p(í|i)t(é|e)sz\s*tervez|szakt(á|a)rs|munkat(á|a)rs/],
  ['epitteto', /(é|e)p(í|i)ttet(ő|o)|beruh(á|a)z(ó|o)|megrendel(ő|o)/],
  ['munka', /munka\s*(megnevez|sz(á|a)m)|munkasz|projekt\s*(neve|sz)|t(á|a)rgy\s*:/],
  ['hrsz', /helyrajzi\s*sz|hrsz/],
  ['datum', /d(á|a)tum|kelt\s*:/],
  ['fazis', /enged(é|e)lyez(é|e)si|kivitel(i|ez)|egyszer(ű|u)s(í|i)tett|bejelent(é|e)si|tervf(á|a)zis|tervez(é|e)si\s*f(á|a)zis/],
  ['rajzcim', /rajz\s*(megnevez|tartalm|c(í|i)m)|tervlap\s*c(í|i)m/],
  ['alairas', /al(á|a)(í|i)r(á|a)s|jogosults(á|a)g|kamarai/],
  ['szakag', /szak(á|a)g|tervr(é|e)sz/],
];

/** A rajzpecsét befoglalója (pt), vagy null. Legalább 3 különböző mezőnév egy tömör csoportban. */
export function rajzpecsetTeglalap(lap: Lap): [number, number, number, number] | null {
  const jel = lap.szovegek.flatMap((t) => {
    const s = t.s.toLowerCase(); const k = KULCS.filter(([, re]) => re.test(s)).map(([n]) => n);
    return k.length && t.s.trim().length <= 60 ? [{ t, k }] : [];
  });
  if (jel.length < 3) return null;
  // egyszeres kapcsolású csoportok (≤ 90 pt)
  const cs = jel.map((_, i) => i); const g = (i: number): number => (cs[i] === i ? i : (cs[i] = g(cs[i]!)));
  const kp = (t: Lap['szovegek'][number]) => [t.x + t.szel / 2, t.y] as const;
  for (let i = 0; i < jel.length; i++) for (let j = i + 1; j < jel.length; j++) {
    const a = jel[i]!.t, b = jel[j]!.t;
    const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.szel, b.x + b.szel)), dy = Math.abs(kp(a)[1] - kp(b)[1]);
    if (Math.hypot(dx, dy) <= 90) cs[g(i)] = g(j);
  }
  const csop = new Map<number, typeof jel>(); jel.forEach((x, i) => { const r = g(i); csop.set(r, [...(csop.get(r) ?? []), x]); });
  let leg: typeof jel | null = null; let legN = 0;
  for (const c of csop.values()) { const n = new Set(c.flatMap((x) => x.k)).size; if (n > legN) { legN = n; leg = c; } }
  if (!leg || legN < 3) return null;
  let x0 = Math.min(...leg.map((x) => x.t.x)), x1 = Math.max(...leg.map((x) => x.t.x + x.t.szel));
  let y0 = Math.min(...leg.map((x) => x.t.y - x.t.meret)), y1 = Math.max(...leg.map((x) => x.t.y + x.t.meret * 0.3));
  const W = lap.szel, H = lap.mag;
  // a pecsét táblázatának vonalai: a feliratcsoportot metsző / érintő vízszintes és függőleges vonalakkal bővítve
  // (a lapkeret nélkül), amíg a terület a lap 30 %-a alatt marad
  const vonal = lap.utvonalak.filter((u) => {
    const w = u.bbox[2] - u.bbox[0], h = u.bbox[3] - u.bbox[1];
    return u.muvelet !== 'none' && (w < 1.5 || h < 1.5) && w < 0.6 * W && h < 0.6 * H && !keretE(u.bbox, W, H);
  });
  // a pecsét a lap szélén áll: jobb oldali oszlop – balra nem nőhet a feliratoknál messzebb; alsó sáv – felfelé nem
  const jobb = x1 > 0.8 * W, also = y1 > 0.8 * H, bal = x0 < 0.2 * W;
  const korlat: [number, number, number, number] = [jobb ? x0 - 30 : bal ? 0 : x0 - 30, also ? y0 - 30 : y0 - 30, bal && !jobb ? x1 + 30 : jobb ? W : x1 + 30, also ? H : y1 + 30];
  if (!jobb && !also && !bal) return [x0 - 8, y0 - 8, x1 + 8, y1 + 8];
  let b: [number, number, number, number] = [x0 - 4, y0 - 4, x1 + 4, y1 + 4];
  for (let kor = 0; kor < 12; kor++) {
    let n: [number, number, number, number] = [...b];
    for (const u of vonal) {
      const q = u.bbox; if (q[2] < b[0] - 2 || q[0] > b[2] + 2 || q[3] < b[1] - 2 || q[1] > b[3] + 2) continue;
      if (q[0] < korlat[0] || q[1] < korlat[1] || q[2] > korlat[2] || q[3] > korlat[3]) continue;
      n = [Math.min(n[0], q[0]), Math.min(n[1], q[1]), Math.max(n[2], q[2]), Math.max(n[3], q[3])];
    }
    if ((n[2] - n[0]) * (n[3] - n[1]) > 0.3 * W * H) break;
    if (n.every((v, i) => Math.abs(v - b[i]!) < 0.01)) break;
    b = n;
  }
  if ((b[2] - b[0]) * (b[3] - b[1]) > 0.3 * W * H) return null;
  return [b[0] - 2, b[1] - 2, b[2] + 2, b[3] + 2];
}

/**
 * A lap a rajzpecsét vonalai / kitöltései és a lapkeret nélkül (a feliratok maradnak – a méretarány, a lapcím onnan is
 * olvasható). Lapkeret: a lap ≥ 70 %-án átfutó, a lapszélhez 6 %-on belül eső vízszintes / függőleges vonal.
 */
export function keretE(b: [number, number, number, number], W: number, H: number): boolean {
  const w = b[2] - b[0], h = b[3] - b[1];
  if (w >= 0.7 * W && h < 0.06 * H && (b[1] < 0.06 * H || b[3] > 0.94 * H)) return true;
  if (h >= 0.7 * H && w < 0.06 * W && (b[0] < 0.06 * W || b[2] > 0.94 * W)) return true;
  // a teljes lapot körülfogó keret-téglalap
  return w >= 0.85 * W && h >= 0.85 * H;
}

export function pecsetKeretNelkul(lap: Lap, pt?: [number, number, number, number] | null): Lap {
  const p = pt === undefined ? rajzpecsetTeglalap(lap) : pt;
  const W = lap.szel, H = lap.mag;
  const benne = (b: [number, number, number, number]) => !!p && b[0] >= p[0] && b[2] <= p[2] && b[1] >= p[1] && b[3] <= p[3];
  const ut = lap.utvonalak.filter((u) => !keretE(u.bbox, W, H) && !benne(u.bbox));
  return ut.length === lap.utvonalak.length ? lap : { ...lap, utvonalak: ut };
}
