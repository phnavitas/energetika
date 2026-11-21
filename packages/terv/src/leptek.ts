/**
 * A LAP VALÓS LÉPTÉKE (2026-11-21, Balázs: „fel kell ismerni mindig a pdf valós léptékét, és aszerint számolni,
 * mint a mérhető pdf szerkesztőkön").
 *
 * A lapra írt „M = 1:100” a rajz léptéke a tervezéskor – ha a PDF-et kicsinyítve nyomtatták (pl. A3-as lap
 * „oldalhoz igazítva” A4-re), a valós lépték más. A mérhető PDF-szerkesztők ilyenkor egy ismert méreten
 * kalibrálnak; itt ugyanezt tesszük a méretláncokon, automatikusan:
 *
 *   minden méretszám („3,34”) a méretvonalán áll; a méretvonalat a méretsegédvonalak (rá merőleges vonalak),
 *   ill. a ferde határjelek metszik. A felirat két oldalán lévő metszéspontok minden párja egy-egy jelölt
 *   távolság – a helyes pár távolsága × lépték = a felirat értéke. A jelölt arányokra feliratonként egy
 *   szavazat jut (a párok között elosztva); a valós lépték a szavazatok csúcsa (a helyes pár minden
 *   feliratnál ott van, a téves párok szétszóródnak).
 *
 * Ha a kalibrált lépték biztos (elég felirat egyezik), és a lapra írttól eltér, a kalibrált érvényes.
 */
import type { Lap, Szoveg } from './kinyeres';

const PT_M = (25.4 / 72) / 1000;

/** Méterben írt méretszám: „3,34”, „15,00”, „0,90” (a cm-es egész számok – „300” – nem egyértelműek, kimaradnak). */
function meterErtek(s: string): number | null {
  const t = s.trim();
  if (!/^\d{1,3}[,.]\d{2}$/.test(t)) return null;
  const v = Number(t.replace(',', '.'));
  return v >= 0.3 ? v : null;
}

export interface LeptekKalibracio {
  /** a kalibrált méretarány (1:M) */
  M: number;
  /** hány felirat egyezik egy adott méretaránnyal (±1 %) – a lapra írt ellenőrzéséhez */
  tamogat: (M: number) => number;
  /** a csúcsba eső (egyező) feliratok száma */
  egyezo: number;
  /** a kiértékelt feliratok száma */
  osszes: number;
}

type Sz3 = [number, number, number]; // a..b a hossz mentén, c keresztben

/** A méretláncokból kalibrált lépték (null: kevés vagy ellentmondó méretlánc). */
export function leptekKalibral(sz: Szoveg[], utvonalak: Lap['utvonalak']): LeptekKalibracio | null {
  const vizsz: Sz3[] = [], fugg: Sz3[] = [];
  const ferdek: [number, number][] = [];
  for (const u of utvonalak) {
    if (u.muvelet === 'fill') continue;
    for (const p of u.pontok) for (let i = 0; i + 3 < p.length; i += 2) {
      const ax = p[i]!, ay = p[i + 1]!, bx = p[i + 2]!, by = p[i + 3]!;
      const dx = Math.abs(bx - ax), dy = Math.abs(by - ay), L = Math.hypot(dx, dy);
      if (dy < 0.2 && dx >= 1.5) vizsz.push([Math.min(ax, bx), Math.max(ax, bx), (ay + by) / 2]);
      else if (dx < 0.2 && dy >= 1.5) fugg.push([Math.min(ay, by), Math.max(ay, by), (ax + bx) / 2]);
      else if (L >= 1.5 && L <= 8 && dx > 0.5 * L * 0.7 && dy > 0.5 * L * 0.7) ferdek.push([(ax + bx) / 2, (ay + by) / 2]);
    }
  }
  // keresztirány szerinti rács a gyors kereséshez (1 pt-os rekeszek)
  const racs = (l: Sz3[]) => { const m = new Map<number, Sz3[]>(); for (const s of l) { const k = Math.round(s[2]); (m.get(k) ?? m.set(k, []).get(k)!).push(s); } return m; };
  const vR = racs(vizsz), fR = racs(fugg);
  const kozel = (m: Map<number, Sz3[]>, c0: number, c1: number) => { const ki: Sz3[] = []; for (let k = Math.floor(c0); k <= Math.ceil(c1); k++) for (const s of m.get(k) ?? []) if (s[2] >= c0 && s[2] <= c1) ki.push(s); return ki; };
  // a merőleges vonalak hossz menti rácsa (a keresztezés kereséséhez): a keresztirányú vonal a c helyén, a..b között
  const feliratok: number[][] = [];
  for (const t of sz) {
    const v = meterErtek(t.s); if (v === null) continue;
    const th = t.szog * Math.PI / 180; const fg = Math.abs(Math.cos(th)) < 0.5;
    if (!fg && Math.abs(Math.sin(th)) > 0.1) continue; // csak tengelyirányú felirat
    const cx = t.x + Math.cos(th) * t.szel / 2, cy = t.y - Math.sin(th) * t.szel / 2;
    const [menti, kereszt] = fg ? [cy, cx] : [cx, cy];
    const h = t.meret || 2;
    // méretvonal-jelöltek: párhuzamos, a felirat közepén átnyúló vonalak a felirat mellett (≤ 1,6 betűmagasság)
    const mvk = kozel(fg ? fR : vR, kereszt - 1.6 * h, kereszt + 1.6 * h).filter((l) => menti >= l[0] - 0.5 && menti <= l[1] + 0.5 && l[1] - l[0] >= 0.8 * t.szel);
    if (!mvk.length) continue;
    // a legközelebbi méretvonal (keresztben)
    mvk.sort((p, q) => Math.abs(p[2] - kereszt) - Math.abs(q[2] - kereszt));
    const c = mvk[0]![2];
    // ugyanazon a vonalon (± 0,3 pt) futó szakaszok együtt adják a méretvonalat (a lánc szakaszonként is rajzolható)
    const egyvonal = kozel(fg ? fR : vR, c - 0.3, c + 0.3);
    // metszéspontok: merőleges vonalak, amelyek a méretvonalat keresztezik / érintik; a méretvonal-szakaszok végei; ferde jelek
    const pos: number[] = [];
    const lancA = Math.min(...egyvonal.map((l) => l[0])), lancB = Math.max(...egyvonal.map((l) => l[1]));
    for (const l of egyvonal) pos.push(l[0], l[1]);
    for (const s of (fg ? vizsz : fugg)) {
      if (s[2] < lancA - 1 || s[2] > lancB + 1) continue;
      if (s[0] <= c + 0.6 && s[1] >= c - 0.6) pos.push(s[2]);
    }
    for (const [x, y] of ferdek) { const [a, cc] = fg ? [y, x] : [x, y]; if (Math.abs(cc - c) <= 0.8 && a >= lancA - 1 && a <= lancB + 1) pos.push(a); }
    pos.sort((p, q) => p - q);
    const egyedi: number[] = []; for (const p of pos) if (!egyedi.length || p - egyedi[egyedi.length - 1]! > 0.4) egyedi.push(p);
    const bal = egyedi.filter((p) => p < menti - 0.3 * t.szel), jobb = egyedi.filter((p) => p > menti + 0.3 * t.szel);
    if (!bal.length || !jobb.length) continue;
    // (a feliratot a két oldali legközelebbi néhány metszéspont fogja közre – messzebbi párok nem kellenek)
    const bk = bal.slice(-6), jk = jobb.slice(0, 6);
    const parok: number[] = [];
    for (const a of bk) for (const b of jk) { const d = b - a; if (d >= 0.8 * t.szel) parok.push(v / d); }
    if (!parok.length) continue;
    feliratok.push(parok);
  }
  const osszes = feliratok.length;
  if (osszes < 6) return null;
  // log-rekeszek (1 %); minden rekeszre: hány felirat (külön-külön) ad arányt a rekeszben vagy szomszédjában
  const R = (r: number) => Math.round(Math.log(r) / 0.01);
  const db = new Map<number, number>();
  for (const parok of feliratok) { const k = new Set<number>(); for (const r of parok) { const q = R(r); k.add(q - 1); k.add(q); k.add(q + 1); } for (const q of k) db.set(q, (db.get(q) ?? 0) + 1); }
  let best = 0, bestK = 0;
  for (const [k, n] of db) if (n > best || (n === best && Math.abs(k) < Math.abs(bestK))) { best = n; bestK = k; }
  // a csúcs pontos értéke: az egyező feliratok csúcshoz legközelebbi arányainak mediánja
  const kozepek: number[] = [];
  for (const parok of feliratok) { let leg: number | null = null; for (const r of parok) if (Math.abs(R(r) - bestK) <= 1 && (leg === null || Math.abs(Math.log(r) - bestK * 0.01) < Math.abs(Math.log(leg) - bestK * 0.01))) leg = r; if (leg !== null) kozepek.push(leg); }
  kozepek.sort((a, b) => a - b);
  const mPerPt = kozepek[Math.floor(kozepek.length / 2)]!;
  const tamogat = (M: number) => { const q = R(M * PT_M); return feliratok.filter((parok) => parok.some((r) => Math.abs(R(r) - q) <= 1)).length; };
  return { M: mPerPt / PT_M, egyezo: best, osszes, tamogat };
}

const gyorstar = new WeakMap<Szoveg[], number | null>();

/**
 * A lap valós méretaránya (1:M): a lapra írt („M=1:100”), ha a méretláncok nem cáfolják; a méretláncokból
 * kalibrált, ha a lapra írt nincs, vagy a rajz kicsinyítve / nagyítva került a lapra (a feliratok legalább
 * fele a kalibrálttal egyezik, a lapra írttal legfeljebb negyede).
 */
export function valosMeretarany(sz: Szoveg[], utvonalak: Lap['utvonalak'] | undefined, irt: number | null): number | null {
  if (!utvonalak) return irt;
  if (gyorstar.has(sz)) return gyorstar.get(sz)!;
  let M = irt;
  const k = leptekKalibral(sz, utvonalak);
  if (k && k.egyezo >= 5 && k.egyezo >= 0.5 * k.osszes) {
    const kal = Math.round(k.M * 10) / 10;
    if (!irt) M = kal;
    else if (Math.abs(k.M / irt - 1) > 0.03 && k.tamogat(irt) <= 0.25 * k.osszes) M = kal;
  }
  gyorstar.set(sz, M);
  return M;
}
