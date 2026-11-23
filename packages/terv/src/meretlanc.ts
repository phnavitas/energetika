/**
 * MÉRETLÁNCOK (2026-11-23, Balázs: „Kellene valamilyen egész más megközelítésű algoritmus is … az alaprajz bizonytalan
 * felismerésű" – a hőburok amorf, ha a falfelismerés bizonytalan).
 *
 * A tervező a ház külső méreteit méretláncokkal pontosan megadja: a lánc határjelei (ferde vonalka, pont, merőleges
 * méretsegédvonal) a falsíkok, sarkok, nyílásszélek helyén állnak, a köztük lévő felirat a távolság. A láncot a
 * lépték-kalibrálás módszerével olvassuk: minden méterben írt felirathoz a méretvonala (a felirat mellett futó, vele
 * párhuzamos vonal) és a vonalat metsző jelek; a felirat két szomszédos jele közti távolság × lépték ≈ a felirat. Az
 * egy vonalon álló feliratok egy láncot adnak; a lánc határjelei a felirat-párokkal igazolt helyek.
 */
import type { Lap } from './kinyeres';

type Sz3 = [number, number, number]; // a..b a hossz mentén, c keresztben

export interface MeretLanc {
  /** függőleges lánc (a hossz menti koordináta y); különben vízszintes (x) */
  fuggo: boolean;
  /** a méretvonal helye keresztben (pt): vízszintes láncnál y, függőlegesnél x */
  c: number;
  /** az igazolt határjelek helye a hossz mentén (pt), növekvő */
  jelek: number[];
  /** a feliratok: a két határjel (a jelek indexei) és az érték (m) */
  tagok: { i: number; j: number; ertek: number }[];
}

function meterErtek(s: string): number | null {
  const t = s.trim();
  if (/^\d{1,3}[,.]\d{2}$/.test(t)) { const v = Number(t.replace(',', '.')); return v >= 0.05 ? v : null; }
  // „3,79⁵”, „3,795” (a felső indexes fél cm)
  if (/^\d{1,3}[,.]\d{3}$/.test(t)) { const v = Number(t.replace(',', '.')); return v >= 0.05 ? v : null; }
  // cm-ben írt falvastagság, kis méret („41”, „10”, „50”): csak a jel-pár hosszának egyezésével lesz tag
  if (/^\d{1,3}$/.test(t)) { const v = Number(t); return v >= 5 && v <= 250 ? v / 100 : null; }
  return null;
}

/**
 * A lap méretláncai (mPerPt: a lap valós léptéke). Csak a tengelyirányú (vízszintes / függőleges) láncok; a felirat
 * akkor tag, ha a két oldali legközelebbi jel-párja közül valamelyik ± max(2 cm, 1,5 %) pontossággal kiadja az értékét.
 */
export function meretlancok(lap: Lap, mPerPt: number): MeretLanc[] {
  const vizsz: Sz3[] = [], fugg: Sz3[] = [];
  const ferdek: [number, number][] = [];
  for (const u of lap.utvonalak) {
    if (u.muvelet === 'fill') continue;
    for (const p of u.pontok) for (let i = 0; i + 3 < p.length; i += 2) {
      const ax = p[i]!, ay = p[i + 1]!, bx = p[i + 2]!, by = p[i + 3]!;
      const dx = Math.abs(bx - ax), dy = Math.abs(by - ay), L = Math.hypot(dx, dy);
      if (dy < 0.2 && dx >= 1.2) vizsz.push([Math.min(ax, bx), Math.max(ax, bx), (ay + by) / 2]);
      else if (dx < 0.2 && dy >= 1.2) fugg.push([Math.min(ay, by), Math.max(ay, by), (ax + bx) / 2]);
      else if (L >= 1.2 && L <= 8 && dx > 0.35 * L && dy > 0.35 * L) ferdek.push([(ax + bx) / 2, (ay + by) / 2]);
    }
  }
  const racs = (l: Sz3[]) => { const m = new Map<number, Sz3[]>(); for (const s of l) { const k = Math.round(s[2]); (m.get(k) ?? m.set(k, []).get(k)!).push(s); } return m; };
  const vR = racs(vizsz), fR = racs(fugg);
  const kozel = (m: Map<number, Sz3[]>, c0: number, c1: number) => { const ki: Sz3[] = []; for (let k = Math.floor(c0); k <= Math.ceil(c1); k++) for (const s of m.get(k) ?? []) if (s[2] >= c0 && s[2] <= c1) ki.push(s); return ki; };
  // feliratonként: a méretvonal (c), a vonal jelei, és a felirat igazolt jel-párja
  type Tag = { fuggo: boolean; c: number; a: number; b: number; ertek: number; jelek: number[] };
  const tagok: Tag[] = [];
  for (const t of lap.szovegek) {
    const v = meterErtek(t.s); if (v === null) continue;
    const th = t.szog * Math.PI / 180; const fg = Math.abs(Math.cos(th)) < 0.5;
    if (!fg && Math.abs(Math.sin(th)) > 0.1) continue;
    const cx = t.x + Math.cos(th) * t.szel / 2, cy = t.y - Math.sin(th) * t.szel / 2;
    const [menti, kereszt] = fg ? [cy, cx] : [cx, cy];
    const h = t.meret || 2;
    const mvk = kozel(fg ? fR : vR, kereszt - 1.6 * h, kereszt + 1.6 * h).filter((l) => menti >= l[0] - 0.5 && menti <= l[1] + 0.5);
    if (!mvk.length) continue;
    mvk.sort((p, q) => Math.abs(p[2] - kereszt) - Math.abs(q[2] - kereszt));
    const c = mvk[0]![2];
    const egyvonal = kozel(fg ? fR : vR, c - 0.3, c + 0.3);
    const pos: number[] = [];
    const lancA = Math.min(...egyvonal.map((l) => l[0])), lancB = Math.max(...egyvonal.map((l) => l[1]));
    for (const l of egyvonal) pos.push(l[0], l[1]);
    for (const s of (fg ? vizsz : fugg)) { if (s[2] < lancA - 1 || s[2] > lancB + 1) continue; if (s[0] <= c + 0.6 && s[1] >= c - 0.6) pos.push(s[2]); }
    for (const [x, y] of ferdek) { const [a, cc] = fg ? [y, x] : [x, y]; if (Math.abs(cc - c) <= 0.8 && a >= lancA - 1 && a <= lancB + 1) pos.push(a); }
    pos.sort((p, q) => p - q);
    const egyedi: number[] = []; for (const p of pos) if (!egyedi.length || p - egyedi[egyedi.length - 1]! > 0.4) egyedi.push(p);
    const bal = egyedi.filter((p) => p < menti), jobb = egyedi.filter((p) => p > menti);
    // a felirat a két jele között áll: a legközelebbi bal / jobb jelek közül az a pár, amelynek hossza az értéket adja
    const tures = Math.max(0.02, 0.015 * v);
    let leg: [number, number] | null = null, legH = Infinity;
    for (const a of bal.slice(-4)) for (const b of jobb.slice(0, 4)) { const d = Math.abs((b - a) * mPerPt - v); if (d <= tures && d < legH) { legH = d; leg = [a, b]; } }
    // a kis méret (falvastagság) felirata a jelpárja mellé kerül, ha nem fér közé: a felirat 3 betűmagasságon belüli
    // szomszédos jelpárjai közül az egyező
    if (!leg) for (let k = 0; k + 1 < egyedi.length; k++) {
      const a = egyedi[k]!, b = egyedi[k + 1]!; if (Math.min(Math.abs(a - menti), Math.abs(b - menti)) > 3 * h + t.szel / 2) continue;
      const d = Math.abs((b - a) * mPerPt - v); if (d <= tures && d < legH) { legH = d; leg = [a, b]; }
    }
    if (!leg) continue;
    tagok.push({ fuggo: fg, c, a: leg[0], b: leg[1], ertek: v, jelek: egyedi });
  }
  // láncok: az azonos vonalon (± 0,5 pt) álló tagok
  const ki: MeretLanc[] = [];
  for (const fg of [false, true]) {
    const l = tagok.filter((t) => t.fuggo === fg).sort((p, q) => p.c - q.c);
    let i = 0;
    while (i < l.length) {
      let j = i + 1; while (j < l.length && l[j]!.c - l[j - 1]!.c <= 0.5) j++;
      const cs = l.slice(i, j);
      // a csoport összefüggő szakaszokra (a tagok egymáshoz érnek / átfednek) – egy vonalon több külön lánc is lehet
      cs.sort((p, q) => p.a - q.a);
      let k = 0;
      while (k < cs.length) {
        let m = k + 1, veg = cs[k]!.b;
        while (m < cs.length && cs[m]!.a <= veg + 0.5) { veg = Math.max(veg, cs[m]!.b); m++; }
        const resz = cs.slice(k, m);
        const jelek: number[] = []; for (const t of resz) jelek.push(t.a, t.b); jelek.sort((p, q) => p - q);
        const ej: number[] = []; for (const p of jelek) if (!ej.length || p - ej[ej.length - 1]! > 0.4) ej.push(p);
        const idx = (p: number) => ej.findIndex((q) => Math.abs(q - p) <= 0.4);
        ki.push({ fuggo: fg, c: resz.reduce((s, t) => s + t.c, 0) / resz.length, jelek: ej, tagok: resz.map((t) => ({ i: idx(t.a), j: idx(t.b), ertek: t.ertek })) });
        k = m;
      }
      i = j;
    }
  }
  return ki;
}
