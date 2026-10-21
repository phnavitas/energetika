/**
 * Pecsét nélküli alaprajzok (pl. típusalaprajz-mintalapok): a lépték becslése a méretláncokból, és a helyiségek
 * automatikus felismerése a falak közötti zárt terekből.
 */
import type { Lap, Szoveg } from './kinyeres';
import { raszterEpit, type Raszter } from './raszter';
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
export function meretaranyKotabol(sz: Szoveg[], utvonalak?: Lap['utvonalak']): number | null {
  // elsődlegesen a méretvonal ferde jeleiből (a két jel közti távolság a felirat értéke)
  if (utvonalak) { const M = meretaranyJelekbol(sz, utvonalak); if (M && M >= 50 && M <= 1000) return M; }
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

/** A méretláncok ferde (45°-os) határjelei: a felirat két oldalán a legközelebbi jelek távolsága = a felirat értéke. */
function meretaranyJelekbol(sz: Szoveg[], utvonalak: Lap['utvonalak']): number | null {
  const jelek: [number, number][] = [];
  for (const u of utvonalak) {
    if (u.muvelet === 'fill') continue;
    for (const p of u.pontok) for (let i = 0; i + 3 < p.length; i += 2) {
      const dx = p[i + 2]! - p[i]!, dy = p[i + 3]! - p[i + 1]!; const l = Math.hypot(dx, dy);
      if (l < 1.5 || l > 8) continue;
      const sz2 = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI) % 90; if (sz2 < 30 || sz2 > 60) continue;
      jelek.push([(p[i]! + p[i + 2]!) / 2, (p[i + 1]! + p[i + 3]!) / 2]);
    }
  }
  if (jelek.length < 6) return null;
  const aranyok: number[] = [];
  for (const t of sz) {
    const v = kotaErtek(t.s); if (v === null || v < 0.5) continue;
    const th = t.szog * Math.PI / 180; const fugg = Math.abs(Math.cos(th)) < 0.5;
    const cx = t.x + Math.cos(th) * t.szel / 2, cy = t.y - Math.sin(th) * t.szel / 2;
    // a méretvonal a felirat alatt (vízszintesnél), ill. mellette (függőlegesnél), legfeljebb ~1,5 betűmagasságra
    const sor = jelek.filter(([x, y]) => (fugg ? Math.abs(x - cx) < t.meret * 1.6 : Math.abs(y - cy) < t.meret * 1.6));
    const menti = (q: [number, number]) => (fugg ? q[1] - cy : q[0] - cx);
    let bal = -Infinity, jobb = Infinity;
    for (const q of sor) { const d = menti(q); if (d < 0 && d > bal) bal = d; if (d > 0 && d < jobb) jobb = d; }
    if (!Number.isFinite(bal) || !Number.isFinite(jobb)) continue;
    const d = jobb - bal; if (d < t.szel * 0.8) continue;
    aranyok.push(v / d);
  }
  if (aranyok.length < 4) return null;
  const rek = new Map<number, number[]>();
  for (const a of aranyok) { const r = Math.round(Math.log(a) / 0.03); (rek.get(r) ?? rek.set(r, []).get(r)!).push(a); }
  let best = 0, bestK = 0;
  for (const [r] of rek) { const n = (rek.get(r - 1)?.length ?? 0) + rek.get(r)!.length + (rek.get(r + 1)?.length ?? 0); if (n > best) { best = n; bestK = r; } }
  if (best < 3) return null;
  const l = [...(rek.get(bestK - 1) ?? []), ...rek.get(bestK)!, ...(rek.get(bestK + 1) ?? [])].sort((a, b) => a - b);
  return Math.round(l[Math.floor(l.length / 2)]! / PT_M);
}

/**
 * Pecsét nélküli lapon a falakkal körbezárt terek (≥ 2 m²) mint helyiségek: a lap sarkaiból indított elárasztás
 * a külső teret jelöli, a raszter a zárt zsebeket külső térré nyilvánítaná – ezeket gyűjtjük ki.
 */
export function automatikusHelyisegek(lap: Lap, mPerPt: number, kep?: SzurkeKep): TervHelyiseg[] {
  const sarkok = [{ x: 1, y: 1 }, { x: lap.szel - 1, y: lap.mag - 1 }];
  const px = 0.05;
  const r = raszterEpit(lap, mPerPt, sarkok, { px, resZaras: 3.0, vastagVonalFal: 0.05, ...(kep ? { szinKep: kep } : {}) }, 1);
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
    if (szel || A < 1 || A > 120) continue;
    // befoglaló téglalap kitöltöttsége: a helyiség zömök (≥ 45%), a rajzok közti „zseb” szabálytalan, hosszú
    let bx0 = w, by0 = h, bx1 = 0, by1 = 0;
    for (const q of komp) { const x = q % w, y = (q / w) | 0; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
    const kitolt = komp.length / ((bx1 - bx0 + 1) * (by1 - by0 + 1));
    const nyulank = Math.max(bx1 - bx0 + 1, by1 - by0 + 1) / Math.min(bx1 - bx0 + 1, by1 - by0 + 1);
    // színezett (lakáshoz tartozó) tér alakra nem szűrendő (L alakú előtér); a fehér zseb csak zömök lehet
    let szinezett = false;
    if (kep) {
      const g: number[] = [];
      for (let t = 0; t < komp.length; t += Math.max(1, Math.floor(komp.length / 200))) { const q = komp[t]!; const ix = Math.round((r.x0 + ((q % w) + 0.5) * px / mPerPt) * kep.ptPx), iy = Math.round((r.y0 + (((q / w) | 0) + 0.5) * px / mPerPt) * kep.ptPx); if (ix >= 0 && iy >= 0 && ix < kep.w && iy < kep.h) g.push(kep.adat[iy * kep.w + ix]!); }
      g.sort((a, b) => a - b); szinezett = g.length > 0 && osztalyFv(kep)(g[Math.floor(g.length / 2)]!) !== 3 && g[Math.floor(g.length / 2)]! >= 120;
    }
    if (!szinezett && (kitolt < 0.45 || nyulank > 8)) continue;
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

export interface SzurkeKep { w: number; h: number; ptPx: number; adat: Uint8Array; /** Árnyalathatárok: [vonal|sötét, sötét|világos, világos|fehér]. */ hatar?: [number, number, number] }

/**
 * Az árnyalatosztályok határai a kép hisztogramjából: a fehér (≥ 252) alatti, vonalnál (< 120) világosabb képpontok
 * két leggyakoribb, egymástól legalább 6 szintre eső értéke a sötét- és világosszürke; a határ a kettő között.
 */
export function arnyalatHatarok(k: SzurkeKep): [number, number, number] {
  const hist = new Uint32Array(256);
  for (let i = 0; i < k.adat.length; i++) hist[k.adat[i]!]++;
  const feher = 252;
  let p1 = -1; for (let v = 120; v < feher; v++) if (p1 < 0 || hist[v]! > hist[p1]!) p1 = v;
  let p2 = -1; for (let v = 120; v < feher; v++) if (Math.abs(v - p1) >= 6 && (p2 < 0 || hist[v]! > hist[p2]!)) p2 = v;
  if (p1 < 0) return [120, 230, feher];
  if (p2 < 0 || hist[p2]! < hist[p1]! * 0.05) return [120, feher - 1, feher];
  const [s, vil] = p1 < p2 ? [p1, p2] : [p2, p1];
  return [120, Math.round((s + vil) / 2), Math.min(feher, Math.round((vil + 255) / 2))];
}
const osztalyFv = (k: SzurkeKep) => { const [a, b, c] = k.hatar ?? [120, 230, 252]; return (v: number) => (v < a ? 0 : v <= b ? 1 : v < c ? 2 : 3); };

/**
 * Lakások a színezésből: a renderelt kép árnyalatosztályai (sötét- és világosszürke) a falakon, vonalakon át
 * összenőve adják a lakásfoltokat – egy lakás egy összefüggő, egyszínű folt; a szomszédos lakások eltérő árnyalatúak,
 * a lépcsőház, folyosó fehér. A felismert helyiségek a foltjukhoz tartoznak; az x-szel áthúzott akna kimarad.
 * A foltnak a helyiségekkel le nem fedett része (előtér, fürdő, kamra – a sűrűn tagolt rész) egy összevont tételként
 * kerül a lakáshoz, hogy a lakás alapterülete teljes legyen.
 */
export function lakasCsoportok(r: Raszter, hs: TervHelyiseg[], lap: Lap, kep: SzurkeKep): { egysegek: string[]; info: Record<string, { nev?: string; db: number; A: number }>; kiegeszito: TervHelyiseg[] } {
  const { w, h, px } = r; const N = w * h;
  const ptx = (x: number) => r.x0 + (x + 0.5) * px / r.mPerPt, pty = (y: number) => r.y0 + (y + 0.5) * px / r.mPerPt;
  const g = (x: number, y: number) => { const ix = Math.round(ptx(x) * kep.ptPx), iy = Math.round(pty(y) * kep.ptPx); return ix >= 0 && iy >= 0 && ix < kep.w && iy < kep.h ? kep.adat[iy * kep.w + ix]! : 255; };
  // árnyalatosztály: 1 sötétszürke, 2 világosszürke, 3 fehér, 0 vonal / fal (később kitöltve)
  const o = new Uint8Array(N);
  const oszt = osztalyFv(kep);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (r.fal[i]) continue; o[i] = oszt(g(x, y)); }
  // a falak és vonalak (0) feltöltése a szomszédos osztállyal – a falvastagság feléig (≈ 0,35 m)
  for (let it = 0, n = Math.max(2, Math.round(0.35 / px)); it < n; it++) {
    const uj = o.slice();
    for (let i = 0; i < N; i++) { if (o[i]) continue; const x = i % w; for (const q of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) if (q >= 0 && q < N && o[q]) { uj[i] = o[q]!; break; } }
    o.set(uj);
  }
  // x-szel áthúzott helyiség: két, a befoglaló téglalapot átlósan átszelő vonal
  const bb = hs.map(() => [Infinity, Infinity, -Infinity, -Infinity]);
  for (let i = 0; i < N; i++) { const c = r.cimke[i]!; if (c < 2) continue; const b = bb[c - 2]!; const X = ptx(i % w), Y = pty((i / w) | 0); if (X < b[0]!) b[0] = X; if (Y < b[1]!) b[1] = Y; if (X > b[2]!) b[2] = X; if (Y > b[3]!) b[3] = Y; }
  const athuzott = bb.map((b) => {
    const bw = b[2]! - b[0]!, bh = b[3]! - b[1]!; if (!(bw > 0 && bh > 0)) return false;
    let atlo = 0;
    for (const u of lap.utvonalak) {
      if (u.muvelet === 'fill' || u.bbox[0] < b[0]! - 1 || u.bbox[1] < b[1]! - 1 || u.bbox[2] > b[2]! + 1 || u.bbox[3] > b[3]! + 1) continue;
      for (const p of u.pontok) for (let i = 0; i + 3 < p.length; i += 2) { const dx = Math.abs(p[i + 2]! - p[i]!), dy = Math.abs(p[i + 3]! - p[i + 1]!); if (dx >= 0.6 * bw && dy >= 0.6 * bh) atlo++; }
    }
    return atlo >= 2;
  });
  // lakásfoltok: azonos (szürke) osztályú összefüggő tartományok
  const folt = new Int32Array(N); const foltok: { cellak: number; osztaly: number }[] = [{ cellak: 0, osztaly: 0 }];
  for (let i = 0; i < N; i++) {
    if (folt[i] || (o[i] !== 1 && o[i] !== 2)) continue;
    const id = foltok.length; const k = o[i]!; const sor = [i]; folt[i] = id;
    for (let t = 0; t < sor.length; t++) { const q = sor[t]!, x = q % w; for (const n of [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, q - w, q + w]) if (n >= 0 && n < N && !folt[n] && o[n] === k) { folt[n] = id; sor.push(n); } }
    foltok.push({ cellak: sor.length, osztaly: k });
  }
  // helyiség → folt (a helyiség celláinak többsége szerint)
  const szavaz = hs.map(() => new Map<number, number>());
  for (let i = 0; i < N; i++) { const c = r.cimke[i]!; if (c < 2 || !folt[i]) continue; const m = szavaz[c - 2]!; m.set(folt[i]!, (m.get(folt[i]!) ?? 0) + 1); }
  const helyFolt = szavaz.map((m, k) => { if (athuzott[k]) return 0; let best = 0, bn = 0; for (const [f, n] of m) if (n > bn) { bn = n; best = f; } return best; });
  // a foltok (lakások), olvasási sorrendben; 15 m² alatti folt nem lakás
  const lakasFoltok = foltok.map((f, id) => ({ id, ...f })).filter((f) => f.id > 0 && f.cellak * px * px >= 15);
  const kozep = new Map<number, [number, number, number]>();
  for (let i = 0; i < N; i++) { const f = folt[i]!; if (!f) continue; const c = kozep.get(f) ?? [0, 0, 0]; c[0] += i % w; c[1] += (i / w) | 0; c[2]++; kozep.set(f, c); }
  lakasFoltok.sort((a, b) => { const ka = kozep.get(a.id)!, kb = kozep.get(b.id)!; return Math.round(pty(ka[1] / ka[2]) / 60) - Math.round(pty(kb[1] / kb[2]) / 60) || ka[0] / ka[2] - kb[0] / kb[2]; });
  const egysegek: string[] = []; const info: Record<string, { nev?: string; db: number; A: number }> = {}; const kiegeszito: TervHelyiseg[] = [];
  lakasFoltok.forEach((f, idx) => {
    const nev = `${idx + 1}. lakás`;
    const tagok = hs.map((_h, k) => k).filter((k) => helyFolt[k] === f.id);
    if (!tagok.length) return;
    egysegek.push(nev);
    let A = 0; for (const k of tagok) { hs[k]!.egyseg = nev; A += r.helyisegek[k]?.A ?? hs[k]!.A; }
    // a folt helyiségekkel le nem fedett, nem fal része: előtér, fürdő, kamra (összevonva)
    let maradek = 0, mx = 0, my = 0;
    for (let i = 0; i < N; i++) if (folt[i] === f.id && !r.fal[i] && r.cimke[i]! < 2) { maradek++; mx += i % w; my += (i / w) | 0; }
    const Am = Math.round(maradek * px * px * 100) / 100;
    let db = tagok.length;
    if (Am >= 1) {
      kiegeszito.push({ nev: `Előtér, fürdő, egyéb (${nev})`, A: Am, x: ptx(mx / maradek), y: pty(my / maradek), forras: 'pecset', kulter: false, egyseg: nev });
      A += Am; db++;
    }
    info[nev] = { nev: `${db} tétel`, db, A: Math.round(A * 100) / 100 };
  });
  return { egysegek, info, kiegeszito };
}
