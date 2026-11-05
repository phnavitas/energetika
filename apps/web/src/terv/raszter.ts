/**
 * Alaprajz raszteres geometriája (3–4. kör alapja): falmaszk a falmetszet-kitöltésekből, külső tér elárasztással,
 * helyiségtartományok a pecsétekből indított versengő elárasztással, és helyiségenként a határoló falszakaszok
 * irány és szomszéd szerint (külső tér / másik helyiség). A falak belső (nettó) síkján mér.
 */
import type { Lap, Utvonal } from './kinyeres';
import { tintaFal, type TintaKep } from './tinta';
import { falVektor } from './falvektor';

export interface RaszterBeallitas {
  /** Pixelméret méterben. */
  px?: number;
  /** A falmetszet legnagyobb vastagsága (m) – ennél vastagabb kitöltés nem fal (burkolat, terep). */
  maxFal?: number;
  /** Hajszálrések zárása (m). */
  ajtoZar?: number;
  /** A legszélesebb áthidalt nyílás (m) – két egy vonalba eső falszakasz között. */
  maxNyilas?: number;
  /** Egyszerűsített rajzhoz (típusalaprajz-mintalap): a falsávban lévő, legfeljebb ekkora (m) rések rajzelem nélkül is lezáródnak. */
  resZaras?: number;
  /** Egyszerűsített rajzhoz: a legalább ekkora (m) vonalvastagságú sötét vonalak is falak (vastag vonallal rajzolt fal). */
  vastagVonalFal?: number;
  /** A renderelt lap szürkeképe: a színezett (lakás-) foltok határa is elválasztja a tereket (pl. ajtó a lépcsőház felé). */
  szinKep?: { w: number; h: number; ptPx: number; adat: Uint8Array; hatar?: [number, number, number] };
  /** Külső térként felismert feliratok helye (terasz, erkély, lapostető, zöldtető…): az ott kezdődő zárt tér külső tér. */
  kulsoPontok?: { x: number; y: number }[];
  /** A renderelt lap szürkeképe (≈ 1,5 képpont / pt): a rajzstílustól független „tinta”-fal a vektoros fal mellé. */
  tinta?: TintaKep;
  /** Széles (≥ 2,5 m) nyílások – kapuk – méretfeliratai (pt, lapkoordináta; fal: 'v' vízszintes / 'f' függőleges fal):
   * a felirat melletti, a felirat szélességével egyező falrés áthidalódik (a 2,8 m-es általános áthidalásnál szélesebb is). */
  kapuk?: { x: number; y: number; szel: number; fal: 'v' | 'f' }[];
  /** Az ablaksor-szabály (egymás mellé sorolt ablakmodulok falnyílásként) – kikapcsolható változat az önellenőrzéshez. */
  ablaksor?: boolean;
}

export interface FalSzakasz {
  /** Lapirány: 0 = fel, 90 = jobbra, 180 = le, 270 = balra (a helyiségből kifelé mutató normális). */
  irany: number;
  /** 'kulso' | másik helyiség indexe | 'ismeretlen' */
  tul: 'kulso' | number | 'ismeretlen';
  /** Nettó hossz (m). */
  hossz: number;
  /** Méretláncból igazolt érték (m) és az eredeti, raszterből mért hossz – ha a kóta felülírta. */
  kota?: number; meres?: number;
  /** Ebből áthidalt nyílás (ablak, ajtó) előtti hossz (m). */
  nyilasHossz: number;
  /** Átlagos falvastagság (m) a túloldalig. */
  vastagsag: number;
  /** A szakasz pixelei (lapkoordinátában, pt) – megjelenítéshez és a nyílászárók hozzárendeléséhez. */
  pontok: [number, number][];
  /** Külső szakasznál: a fal mögött talaj (terep-/földsraffozás) van – terepszint alatti szintnél talajjal érintkező fal. */
  talaj?: boolean;
  /** Külső szakasznál: a fal mögött szomszédos épület áll („szomszédos épület”, „zártsorú”, „tűzfal” felirat) –
   * zártsorú / ikres csatlakozás, nem homlokzati fal. */
  szomszed?: boolean;
}

export interface Raszter {
  w: number; h: number; px: number;
  /** A rács bal felső sarka lapkoordinátában (pt) és a pt→m szorzó. */
  x0: number; y0: number; mPerPt: number;
  fal: Uint8Array;
  /** Falanyag-stílus azonosító pixelenként (0 = nincs). */
  stilus: Uint16Array;
  /** 0 = nincs, 1 = külső tér, 2+i = i. helyiség */
  cimke: Int32Array;
  /** Helyiségenként: terület (m²) és határoló falszakaszok. */
  /** Áthidalt nyílások maszkja. */
  nyilas: Uint8Array;
  /** Felirat nélküli, széles (2,8 m feletti) üvegezett falnyílások – függönyfal, üvegfal: két falvég közti, a fal
   *  síkjában futó párhuzamos vonalakkal (üvegezés, tok) kitöltött rés. Lapkoordináta (pt), hossz méterben. */
  uvegfalak: { x0: number; y0: number; x1: number; y1: number; hossz: number; fuggo: boolean; /** különálló ablakmodulok sora (a modulok feliratosak lehetnek) */ modulok?: boolean }[];
  helyisegek: { A: number; szivarog: boolean; szakaszok: FalSzakasz[] }[];
}

const feher = (s: string) => /^#(f[0-9a-f]){3}$/i.test(s);

function poliKerulet(p: number[]) { let k = 0; for (let i = 0; i + 3 < p.length; i += 2) k += Math.hypot(p[i + 2]! - p[i]!, p[i + 3]! - p[i + 1]!); return k; }
function poliTerulet(p: number[]) { let a = 0; for (let i = 0; i + 3 < p.length; i += 2) a += p[i]! * p[i + 3]! - p[i + 2]! * p[i + 1]!; return Math.abs(a / 2); }

/** Falmetszet-e a kitöltés: nem fehér, és a „vastagsága” (2A/K) falnyi. */
export function falKitoltes(u: Utvonal, mPerPt: number, maxFal = 0.9): boolean {
  if (u.muvelet === 'stroke') return false;
  let A = 0, K = 0;
  for (const p of u.pontok) { A += poliTerulet(p); K += poliKerulet(p); }
  if (K <= 0 || A <= 0) return false;
  const v = 2 * A / K * mPerPt;
  // mintázattal kitöltött felület (sraffozott falmetszet, de burkolatminta is lehet): csak vékony, hosszúkás sáv számít falnak
  if (u.minta) { const hossz = Math.max(u.bbox[2] - u.bbox[0], u.bbox[3] - u.bbox[1]) * mPerPt; return v >= 0.05 && v <= Math.min(maxFal, 0.6) && hossz >= 2.5 * v; }
  if (!feher(u.toltoSzin)) return v <= maxFal && v >= 0.004;
  // fehér kitöltés: a válaszfalak magja gyakran fehér – csak vékony, hosszúkás elem számít falnak
  // (a bútorok – szekrény, pult, kád – 0,5 m-nél mélyebbek vagy rövidek)
  const hossz = Math.max(u.bbox[2] - u.bbox[0], u.bbox[3] - u.bbox[1]) * mPerPt;
  // (a rövid falpillérek miatt itt csak 0,15 m; a bútorokat a rétegszomszédság-vizsgálat szűri ki)
  // (csarnok szendvicspanel-fala 0,6 m-ig, ha hosszú – a végeinek pillérbe futását a felhasználás helye vizsgálja)
  return v >= 0.03 && (v <= 0.35 ? hossz >= 0.15 : v <= 0.6 && hossz >= 2 && hossz >= 5 * v);
}

/** Sokszögek kitöltése páros-páratlan szabállyal a rácsra. */
export function poliRajzol(m: Uint8Array | Uint16Array, w: number, h: number, polik: number[][], tr: (x: number, y: number) => [number, number], ertek = 1) {
  const el: [number, number, number, number][] = [];
  let ymin = Infinity, ymax = -Infinity;
  for (const p of polik) {
    const n = p.length / 2; if (n < 3) continue;
    for (let i = 0; i < n; i++) {
      const [ax, ay] = tr(p[2 * i]!, p[2 * i + 1]!); const j = (i + 1) % n; const [bx, by] = tr(p[2 * j]!, p[2 * j + 1]!);
      el.push([ax, ay, bx, by]); ymin = Math.min(ymin, ay, by); ymax = Math.max(ymax, ay, by);
    }
  }
  const y0 = Math.max(0, Math.floor(ymin)), y1 = Math.min(h - 1, Math.ceil(ymax));
  const xs: number[] = [];
  for (let y = y0; y <= y1; y++) {
    const yc = y + 0.5; xs.length = 0;
    for (const [ax, ay, bx, by] of el) if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + (yc - ay) / (by - ay) * (bx - ax));
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = Math.max(0, Math.round(xs[k]!)), b = Math.min(w - 1, Math.round(xs[k + 1]!) - 1);
      for (let x = a; x <= b; x++) m[y * w + x] = ertek;
    }
  }
  // vékony (1 px alatti) sávok se maradjanak ki: a csúcsokat is jelöljük
  for (const [ax, ay] of el) { const x = Math.round(ax), y = Math.round(ay); if (x >= 0 && y >= 0 && x < w && y < h) m[y * w + x] = ertek; }
}

/** Négyzetes (sakktábla-távolságú) tágítás r pixellel – két menetben, sávosan. */
function tagit(m: Uint8Array, w: number, h: number, r: number): Uint8Array {
  if (r <= 0) return m.slice();
  const t = new Uint8Array(w * h), k = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let utolso = -Infinity;
    for (let x = 0; x < w; x++) { if (m[y * w + x]) utolso = x; if (x - utolso <= r) t[y * w + x] = 1; }
    utolso = Infinity;
    for (let x = w - 1; x >= 0; x--) { if (m[y * w + x]) utolso = x; if (utolso - x <= r) t[y * w + x] = 1; }
  }
  for (let x = 0; x < w; x++) {
    let utolso = -Infinity;
    for (let y = 0; y < h; y++) { if (t[y * w + x]) utolso = y; if (y - utolso <= r) k[y * w + x] = 1; }
    utolso = Infinity;
    for (let y = h - 1; y >= 0; y--) { if (t[y * w + x]) utolso = y; if (utolso - y <= r) k[y * w + x] = 1; }
  }
  return k;
}

/** Négyzetes szűkítés r pixellel (a tágítás duálisa). */
function szukit(m: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const neg = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) neg[i] = m[i] ? 0 : 1;
  const t = tagit(neg, w, h, r);
  for (let i = 0; i < w * h; i++) t[i] = t[i] ? 0 : 1;
  return t;
}

/**
 * A rács széléig kifutó (a homlokzaton „kiszivárgó”) helyiség – pl. üvegfal, oszlopok közti üvegezés, amelyet a rajz
 * vékony vonallal ábrázol: a gátat fokozatosan (0,3–1 m-rel, azaz ≤ 2 m-es réseket) tágítva újra elárasztjuk a pecséttől, és ha a tér
 * bezárul, a tágítás mértékéig visszanövesztjük. Elfogadjuk, ha a terület a pecsét szerinti 60–140 %-a.
 */
function szivargoPotlas(cimke: Int32Array, gat: Uint8Array, magok: { x: number; y: number; A?: number }[], w: number, h: number, px: number, tr: (x: number, y: number) => [number, number]) {
  const kifut = new Set<number>();
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) if (cimke[y * w + x]! >= 2) kifut.add(cimke[y * w + x]!);
  for (let y = 0; y < h; y++) for (const x of [0, w - 1]) if (cimke[y * w + x]! >= 2) kifut.add(cimke[y * w + x]!);
  for (const c of kifut) {
    const m = magok[c - 2]!; const A = m.A ?? 0; if (!(A >= 4)) continue;
    let [cx, cy] = tr(m.x, m.y); cx = Math.round(cx); cy = Math.round(cy);
    for (const Rm of [0.3, 0.6, 1.0]) {
      const R = Math.max(1, Math.round(Rm / px));
      const tg = tagit(gat, w, h, R);
      // a mag (vagy a legközelebbi szabad cella)
      let s = -1;
      for (let r = 0; r < 4 * R && s < 0; r++) for (let dy = -r; dy <= r && s < 0; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const i = y * w + x; if (!tg[i] && (cimke[i] === 0 || kifut.has(cimke[i]!))) { s = i; break; }
      }
      if (s < 0) break;
      const reg = new Uint8Array(w * h); const sor = [s]; reg[s] = 1; let szel = false; const maxN = 3 * A / (px * px);
      for (let k = 0; k < sor.length && !szel && sor.length < maxN; k++) {
        const q = sor[k]!, x = q % w, y = (q / w) | 0;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) { szel = true; break; }
        for (const n of [q - 1, q + 1, q - w, q + w]) if (!reg[n] && !tg[n] && (cimke[n] === 0 || kifut.has(cimke[n]!))) { reg[n] = 1; sor.push(n); }
      }
      if (szel || sor.length >= maxN) continue;
      // visszanövesztés legfeljebb R cellával, a gáton és más helyiségen át nem
      let front = sor.slice();
      for (let l = 0; l < R && front.length; l++) {
        const uj: number[] = [];
        for (const q of front) { const x = q % w; for (const n of [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, q - w, q + w]) if (n >= 0 && n < w * h && !reg[n] && !gat[n] && (cimke[n] === 0 || kifut.has(cimke[n]!))) { reg[n] = 1; uj.push(n); } }
        front = uj;
      }
      let n = 0; for (let i = 0; i < w * h; i++) if (reg[i]) n++;
      const Ak = n * px * px;
      if (Ak < 0.6 * A || Ak > 1.4 * A) continue;
      for (let i = 0; i < w * h; i++) { if (cimke[i] === c && !reg[i]) cimke[i] = 0; else if (reg[i]) cimke[i] = c; }
      break;
    }
  }
}

/** Többforrású szélességi elárasztás: a szabad (szabad[i] = 1) cellákat a legközelebbi címke kapja. */
function araszt(cimke: Int32Array, szabad: Uint8Array, w: number, h: number) {
  let sor: number[] = [];
  for (let i = 0; i < cimke.length; i++) if (cimke[i]) sor.push(i);
  while (sor.length) {
    const uj: number[] = [];
    for (const i of sor) {
      const x = i % w, y = (i / w) | 0, c = cimke[i]!;
      if (x > 0 && !cimke[i - 1] && szabad[i - 1]) { cimke[i - 1] = c; uj.push(i - 1); }
      if (x < w - 1 && !cimke[i + 1] && szabad[i + 1]) { cimke[i + 1] = c; uj.push(i + 1); }
      if (y > 0 && !cimke[i - w] && szabad[i - w]) { cimke[i - w] = c; uj.push(i - w); }
      if (y < h - 1 && !cimke[i + w] && szabad[i + w]) { cimke[i + w] = c; uj.push(i + w); }
    }
    sor = uj;
  }
}

/**
 * Egy homlokzati irány nettó hossza a fal belső síkján: a határpontok fő síkja (leggyakoribb mélység) és a síkon túli
 * (falba nyúló) fülkék számítanak; a síkon belül fekvő rövid szakaszok (a merőleges falak ablakfülkéinek oldala,
 * bútorok) nem. Egy másik, legalább 0,8 m hosszú párhuzamos síkszakasz (lépcsőzött homlokzat) is számít.
 * `mely`: [vetületi koordináta, kifelé növekvő mélység] pixelben.
 */
export function falsikHossz(mely: number[][], px: number): number {
  if (!mely.length) return 0;
  const gyak = new Map<number, number>();
  for (const [, d] of mely) gyak.set(d!, (gyak.get(d!) ?? 0) + 1);
  // fősík: a legbelső (helyiség felőli) mélység, amelyen legalább 0,45 m (ill. a pontok 10%-a) fekszik –
  // az ablakfülkék hátfala kijjebb van, ezért nem lehet fősík akkor sem, ha a fülke széles
  const min = Math.max(0.45 / px, mely.length * 0.1);
  const sorrend = [...gyak.entries()].sort((a, b) => a[0] - b[0]);
  const fo = (sorrend.find(([, n]) => n >= min) ?? [...gyak.entries()].sort((a, b) => b[1] - a[1])[0]!)[0];
  const tures = Math.max(1, Math.round(0.1 / px));
  const tart = new Set<number>();
  const tobbi: number[][] = [];
  for (const [v, d] of mely) { if (d! >= fo - tures) tart.add(v!); else tobbi.push([v!, d!]); }
  // a síkon belüli pontok összefüggő, azonos mélységű futamai: ≥ 0,8 m esetén külön homlokzatsík
  tobbi.sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!);
  let futam: number[][] = [];
  const zar = () => { if (futam.length && (futam.at(-1)![0]! - futam[0]![0]! + 1) * px >= 0.8) for (const [v] of futam) tart.add(v!); futam = []; };
  for (const p of tobbi) {
    const u = futam.at(-1);
    if (u && (p[0]! - u[0]! > 1 || Math.abs(p[1]! - futam[0]![1]!) > tures)) zar();
    if (!futam.length || p[0] !== futam.at(-1)![0]) futam.push(p);
  }
  zar();
  return tart.size * px;
}

/** Címkénkénti morfológiai nyitás négyzetes elemmel (fél-oldal r): a keskeny benyúlások kimaradnak. */
function nyitas(c: Int32Array, w: number, h: number, r: number): Uint8Array {
  const e1 = new Uint8Array(w * h), e2 = new Uint8Array(w * h), d1 = new Uint8Array(w * h), d2 = new Uint8Array(w * h);
  // erózió vízszintesen: azonos címkéjű futamok belseje
  for (let y = 0; y < h; y++) for (let x = 0; x < w;) { const v = c[y * w + x]!; let e = x; while (e < w && c[y * w + e] === v) e++; if (v >= 2) for (let q = x + r; q <= e - 1 - r; q++) e1[y * w + q] = 1; x = e; }
  for (let x = 0; x < w; x++) for (let y = 0; y < h;) { const i0 = y * w + x; if (!e1[i0]) { y++; continue; } const v = c[i0]!; let e = y; while (e < h && e1[e * w + x] && c[e * w + x] === v) e++; for (let q = y + r; q <= e - 1 - r; q++) e2[q * w + x] = 1; y = e; }
  // tágítás vissza, a címkén belül
  for (let y = 0; y < h; y++) for (let x = 0; x < w;) { const v = c[y * w + x]!; let e = x; while (e < w && c[y * w + e] === v) e++; if (v >= 2) { let utolso = -1e9; for (let q = x; q < e; q++) { if (e2[y * w + q]) utolso = q; if (q - utolso <= r) d1[y * w + q] = 1; } utolso = 1e9; for (let q = e - 1; q >= x; q--) { if (e2[y * w + q]) utolso = q; if (utolso - q <= r) d1[y * w + q] = 1; } } x = e; }
  for (let x = 0; x < w; x++) for (let y = 0; y < h;) { const v = c[y * w + x]!; let e = y; while (e < h && c[e * w + x] === v) e++; if (v >= 2) { let utolso = -1e9; for (let q = y; q < e; q++) { if (d1[q * w + x]) utolso = q; if (q - utolso <= r) d2[q * w + x] = 1; } utolso = 1e9; for (let q = e - 1; q >= y; q--) { if (d1[q * w + x]) utolso = q; if (utolso - q <= r) d2[q * w + x] = 1; } } y = e; }
  return d2;
}

/**
 * Raszter felépítése. `magok`: a helyiségpecsétek középpontjai (pt). A rács a magok köré, `margo` méterrel bővítve készül.
 */
export function raszterEpit(lap: Lap, mPerPt: number, magok: { x: number; y: number; A?: number }[], b: RaszterBeallitas = {}, margo = 6): Raszter {
  const px = b.px ?? 0.025, maxFal = b.maxFal ?? 0.9;
  const ptPx = mPerPt / px; // 1 pt hány pixel
  const kp = b.kulsoPontok ?? [];
  // a rács a pecsétek körül: legalább `margo`, nagy helyiségnél (a pecsét a terem közepén) a terület gyökével arányosan több
  const mg = (m: { A?: number }) => Math.min(40, Math.max(margo, Math.sqrt(m.A ?? 0) + 2)) / mPerPt;
  const pk = [...magok.map((m) => ({ x: m.x, y: m.y, d: mg(m) })), ...kp.map((m) => ({ x: m.x, y: m.y, d: margo / mPerPt }))];
  const x0 = Math.min(...pk.map((p) => p.x - p.d)), y0 = Math.min(...pk.map((p) => p.y - p.d)), x1 = Math.max(...pk.map((p) => p.x + p.d)), y1 = Math.max(...pk.map((p) => p.y + p.d));
  const w = Math.ceil((x1 - x0) * ptPx), h = Math.ceil((y1 - y0) * ptPx);
  const tr = (x: number, y: number): [number, number] => [(x - x0) * ptPx, (y - y0) * ptPx];
  const fal = new Uint8Array(w * h);
  const darabok: [number, number, number, number][] = [];
  // először a színes (nem fehér) falmetszet-kitöltések, aztán a fehér falmagok – utóbbi csak akkor fal, ha hosszanti
  // oldala színes falréteghez (vakolat, falazat, hőszigetelés) simul; a bútor, ajtólap fehér kitöltése nem ilyen
  // terepburkolat (kavicssáv, zúzottkő): sok apró „kő” elem a kitöltésben – nem fal, hanem külső tér
  const apro: [number, number][] = [];
  for (const u of lap.utvonalak) {
    if (u.muvelet !== 'stroke' || u.bbox[2] < x0 || u.bbox[0] > x1 || u.bbox[3] < y0 || u.bbox[1] > y1) continue;
    if (Math.max(u.bbox[2] - u.bbox[0], u.bbox[3] - u.bbox[1]) * mPerPt < 0.15) apro.push([(u.bbox[0] + u.bbox[2]) / 2, (u.bbox[1] + u.bbox[3]) / 2]);
  }
  const aproIdx = new Map<number, [number, number][]>(); const AR = 10;
  for (const q of apro) { const k = Math.floor(q[0] / AR) * 100000 + Math.floor(q[1] / AR); const l = aproIdx.get(k); if (l) l.push(q); else aproIdx.set(k, [q]); }
  const terepburkolat = (u: Utvonal) => {
    const [bx0, by0, bx1, by1] = u.bbox; const A = poliTerulet(u.pontok[0] ?? []) * mPerPt * mPerPt; if (A < 1) return false;
    let db = 0;
    for (let gx = Math.floor(bx0 / AR); gx <= Math.floor(bx1 / AR); gx++) for (let gy = Math.floor(by0 / AR); gy <= Math.floor(by1 / AR); gy++) for (const [cx, cy] of aproIdx.get(gx * 100000 + gy) ?? []) if (cx > bx0 && cx < bx1 && cy > by0 && cy < by1) db++;
    return db >= 10 && db / A >= 3;
  };
  const feherJeloltek: Utvonal[] = []; const sraffozott = new Set<Utvonal>();
  // falanyag-stílus térkép (kitöltésszín + sraffozottság): a fal azonosításához a sarkokban
  const stilus = new Uint16Array(w * h); const stilusId = new Map<string, number>();
  const stilusRajzol = (u: Utvonal, sraff: boolean) => { const k = `${u.toltoSzin}|${sraff}`; let id = stilusId.get(k); if (!id) { id = stilusId.size + 1; stilusId.set(k, id); } poliRajzol(stilus, w, h, u.pontok, tr, id); };
  for (const u of lap.utvonalak) {
    if (u.bbox[2] < x0 || u.bbox[0] > x1 || u.bbox[3] < y0 || u.bbox[1] > y1) continue;
    if (!falKitoltes(u, mPerPt, maxFal) || terepburkolat(u)) continue;
    if (feher(u.toltoSzin)) { feherJeloltek.push(u); continue; }
    poliRajzol(fal, w, h, u.pontok, tr); stilusRajzol(u, false);
    darabok.push(u.bbox);
  }
  if (b.vastagVonalFal) {
    // vastag (fal-) vonalak: a vonalvastagságnyi sávot rajzoljuk ki
    for (const u of lap.utvonalak) {
      if (u.muvelet !== 'stroke' || u.vastagsag * mPerPt < b.vastagVonalFal || feher(u.vonalSzin)) continue;
      // a lapkeret, rajzkeret hosszú vonalai nem falak
      if (Math.max(u.bbox[2] - u.bbox[0], u.bbox[3] - u.bbox[1]) * mPerPt > 18) continue;
      if (u.bbox[2] < x0 || u.bbox[0] > x1 || u.bbox[3] < y0 || u.bbox[1] > y1) continue;
      const r = Math.max(0.5, u.vastagsag * ptPx / 2);
      for (const p of u.pontok) for (let i = 0; i + 3 < p.length; i += 2) {
        const [ax, ay] = tr(p[i]!, p[i + 1]!), [bx, by] = tr(p[i + 2]!, p[i + 3]!);
        const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 2));
        for (let k = 0; k <= n; k++) {
          const cx = ax + (bx - ax) * k / n, cy = ay + (by - ay) * k / n;
          for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if (x >= 0 && y >= 0 && x < w && y < h && Math.abs(x + 0.5 - cx) <= r + 0.5 && Math.abs(y + 0.5 - cy) <= r + 0.5) fal[y * w + x] = 1;
        }
      }
      darabok.push(u.bbox);
    }
  }
  let sraffMod = false; let sraffMaszk: Uint8Array | null = null;
  // kitöltés nélkül, csak sraffozással rajzolt falak (pl. ArchiCAD PDF-export: a falréteg mintázata vékony ferde vonalak,
  // a falsík vonala külön szakasz): a sűrű, rövid, ferde vékony vonalak mezője a fal. Csak akkor, ha a kitöltésekből
  // alig van fal – a kitöltött falas rajzon a sraffozás amúgy is a falon belül van.
  {
    const sr = new Uint8Array(w * h); let db = 0; const srSzeg: [number, number, number, number, number, number, number][] = [];
    for (const u of lap.utvonalak) {
      if (u.muvelet !== 'stroke' || u.vastagsag > 0.35 || feher(u.vonalSzin)) continue;
      if (u.bbox[2] < x0 || u.bbox[0] > x1 || u.bbox[3] < y0 || u.bbox[1] > y1) continue;
      for (const p of u.pontok) for (let i = 0; i + 3 < p.length; i += 2) {
        const dx = p[i + 2]! - p[i]!, dy = p[i + 3]! - p[i + 1]!; const l = Math.hypot(dx, dy) * mPerPt;
        if (l < 0.02 || l > 0.8) continue;
        const sz = ((Math.atan2(dy, dx) * 180 / Math.PI) % 180 + 180) % 180;
        if (!((sz > 20 && sz < 70) || (sz > 110 && sz < 160))) continue;
        const [ax, ay] = tr(p[i]!, p[i + 1]!), [bx, by] = tr(p[i + 2]!, p[i + 3]!);
        const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 2));
        for (let k = 0; k <= n; k++) { const x = Math.round(ax + (bx - ax) * k / n), y = Math.round(ay + (by - ay) * k / n); if (x >= 0 && y >= 0 && x < w && y < h) sr[y * w + x] = 1; }
        db++;
        if (l >= 0.1) srSzeg.push([(p[i]! + p[i + 2]!) / 2 * mPerPt, (p[i + 1]! + p[i + 3]!) / 2 * mPerPt, sz, p[i]!, p[i + 1]!, p[i + 2]!, p[i + 3]!]);
      }
    }
    if (db > 200) {
      // a sraffvonalak jellemző (medián) távolsága: a párhuzamos szomszédig mért merőleges távolság
      // a sraffvonalak sávjának kitöltése vonalanként: a vonalat a párhuzamos szomszédjáig mért (≤ 0,3 m) távolság felével
      // vastagítjuk – a ritka (20–25 cm-es) falsraffozás is összefüggő sáv lesz, a magányos ferde vonal (méretjel) nem
      const RR = 0.5, idx = new Map<string, number[]>();
      srSzeg.forEach((q, i) => { const k = `${Math.floor(q[0] / RR)},${Math.floor(q[1] / RR)}`; const l = idx.get(k); if (l) l.push(i); else idx.set(k, [i]); });
      const zart = szukit(tagit(sr, w, h, Math.max(1, Math.round(0.05 / px))), w, h, Math.max(1, Math.round(0.05 / px)));
      srSzeg.forEach(([qx, qy, qs, ax, ay, bx, by], i) => {
        const nx = -Math.sin(qs * Math.PI / 180), ny = Math.cos(qs * Math.PI / 180);
        let leg = Infinity, bal = 0, jobb = 0;
        const L = Math.hypot(bx - ax, by - ay) * mPerPt;
        for (let gx = Math.floor(qx / RR) - 1; gx <= Math.floor(qx / RR) + 1; gx++) for (let gy = Math.floor(qy / RR) - 1; gy <= Math.floor(qy / RR) + 1; gy++)
          for (const j of idx.get(`${gx},${gy}`) ?? []) {
            if (j === i) continue; const q = srSzeg[j]!; if (Math.abs(q[2] - qs) > 5) continue;
            // a szomszéd a vonal hosszában is mellette fekszik (nem egy távoli folytatás)
            const tx = (q[0] - qx) * ny - (q[1] - qy) * nx; if (Math.abs(tx) > L) continue;
            const ds = (q[0] - qx) * nx + (q[1] - qy) * ny, d = Math.abs(ds); if (d > 0.01 && d < leg) leg = d;
            if (d > 0.01 && d <= 0.3) { if (ds > 0) jobb++; else bal++; }
          }
        // sraffmező belseje: mindkét oldalán van párhuzamos szomszéd (a két vonalból álló jel, bútor nem ilyen)
        if (!(leg <= 0.3) || !bal || !jobb) return;
        const fel = leg / 2 + 0.01;
        for (let o = -fel; o <= fel; o += px / 2) {
          const ox = nx * o / mPerPt, oy = ny * o / mPerPt;
          const [cx0, cy0] = tr(ax + ox, ay + oy), [cx1, cy1] = tr(bx + ox, by + oy);
          const n = Math.max(1, Math.ceil(Math.hypot(cx1 - cx0, cy1 - cy0) * 2));
          for (let k = 0; k <= n; k++) { const x = Math.round(cx0 + (cx1 - cx0) * k / n), y = Math.round(cy0 + (cy1 - cy0) * k / n); if (x >= 0 && y >= 0 && x < w && y < h) zart[y * w + x] = 1; }
        }
      });
      const tiszta = tagit(szukit(zart, w, h, 1), w, h, 1);
      let falPx = 0, srPx = 0;
      for (let i = 0; i < w * h; i++) { if (fal[i]) falPx++; if (tiszta[i]) srPx++; }
      if (srPx > 1.5 * falPx) {
        for (let i = 0; i < w * h; i++) if (tiszta[i]) fal[i] = 1;
        darabok.push([x0, y0, x1, y1]);
        sraffMod = true; sraffMaszk = tiszta;
      }
    }
  }
  // sraffozott fehér kitöltés (falazat, hőszigetelés metszeti mintázattal): a befoglalójában legalább 3 rövid, ferde
  // vonal – a bútor kitöltése nem sraffozott. Ezek a színes rétegekkel egyenrangú falrétegek.
  const reteg = new Uint8Array(w * h);
  // a sraffozott falréteg rétegzett fal: a nyílások közti rövid falpillér sem „bútor”
  if (sraffMaszk) for (let i = 0; i < w * h; i++) if (sraffMaszk[i]) reteg[i] = 1;
  {
    const SR = 8; const sraffIdx = new Map<number, [number, number, number, number][]>();
    for (const u of lap.utvonalak) {
      if (u.muvelet !== 'stroke' || u.bbox[2] < x0 || u.bbox[0] > x1 || u.bbox[3] < y0 || u.bbox[1] > y1) continue;
      for (const p of u.pontok) for (let i = 0; i + 3 < p.length; i += 2) {
        const dx = p[i + 2]! - p[i]!, dy = p[i + 3]! - p[i + 1]!; const l = Math.hypot(dx, dy);
        if (l < 0.5 || l * mPerPt > 1.5) continue;
        const sz = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI) % 90; if (sz < 10 || sz > 80) continue;
        const cx = (p[i]! + p[i + 2]!) / 2, cy = (p[i + 1]! + p[i + 3]!) / 2; const k = Math.floor(cx / SR) * 100000 + Math.floor(cy / SR);
        const szog = ((Math.atan2(dy, dx) * 180 / Math.PI) % 180 + 180) % 180;
        const lst = sraffIdx.get(k); if (lst) lst.push([cx, cy, szog, l]); else sraffIdx.set(k, [[cx, cy, szog, l]]);
      }
    }
    for (let k = feherJeloltek.length - 1; k >= 0; k--) {
      // sraffozás: legalább 3 párhuzamos ferde vonal, mindegyik a rövidebb oldal ≥ 40%-a (a bútor lekerekítése, letörése nem ilyen)
      const u = feherJeloltek[k]!; const [bx0, by0, bx1, by1] = u.bbox; const rov = Math.min(bx1 - bx0, by1 - by0);
      const szogek = new Map<number, number[]>();
      const vizsz = bx1 - bx0 >= by1 - by0;
      for (let gx = Math.floor(bx0 / SR); gx <= Math.floor(bx1 / SR); gx++) for (let gy = Math.floor(by0 / SR); gy <= Math.floor(by1 / SR); gy++)
        for (const [cx, cy, sz, l] of sraffIdx.get(gx * 100000 + gy) ?? []) if (cx > bx0 && cx < bx1 && cy > by0 && cy < by1 && l >= rov * 0.4) { const kk = Math.round(sz / 5); const t = szogek.get(kk) ?? []; t.push(vizsz ? cx : cy); szogek.set(kk, t); }
      if (Math.max(0, ...[...szogek.values()].map((t) => t.length)) < 3) continue;
      poliRajzol(fal, w, h, u.pontok, tr); poliRajzol(reteg, w, h, u.pontok, tr); stilusRajzol(u, true);
      darabok.push(u.bbox); sraffozott.add(u); feherJeloltek.splice(k, 1);
    }
  }
  const vanSzines = darabok.length > 0;
  // színes rétegek körvonala rasztervonalként (a 1 cm-es vakolat kitöltése a rácsban elveszhet, a körvonala nem)
  const korvonal = new Uint8Array(w * h);
  const vonalRajzol = (m: Uint8Array, ax: number, ay: number, bx: number, by: number) => {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 2));
    for (let k = 0; k <= n; k++) { const x = Math.round(ax + (bx - ax) * k / n), y = Math.round(ay + (by - ay) * k / n); if (x >= 0 && y >= 0 && x < w && y < h) m[y * w + x] = 1; }
  };
  for (const u of lap.utvonalak) {
    if (u.bbox[2] < x0 || u.bbox[0] > x1 || u.bbox[3] < y0 || u.bbox[1] > y1) continue;
    if ((feher(u.toltoSzin) && !sraffozott.has(u)) || !falKitoltes(u, mPerPt, maxFal)) continue;
    for (const p of u.pontok) for (let i = 0; i + 3 < p.length; i += 2) { const [ax, ay] = tr(p[i]!, p[i + 1]!), [bx, by] = tr(p[i + 2]!, p[i + 3]!); vonalRajzol(korvonal, ax, ay, bx, by); }
  }
  const kozelSzines = tagit(korvonal, w, h, 1);
  for (const u of feherJeloltek) {
    const vastagFeher = Math.min(u.bbox[2] - u.bbox[0], u.bbox[3] - u.bbox[1]) * mPerPt > 0.35;
    let ok = !vanSzines && !vastagFeher && Math.max(u.bbox[2] - u.bbox[0], u.bbox[3] - u.bbox[1]) * mPerPt >= 0.5;
    if (vanSzines || vastagFeher) {
      // a fehér elem körvonalának legalább 70%-a színes falréteg mellett fut (válaszfal mag: mindkét hosszanti oldala; a fal mellé tolt szekrény csak az egyik)
      let db = 0, jo = 0;
      const hosszIrany = u.bbox[2] - u.bbox[0] >= u.bbox[3] - u.bbox[1];
      for (const p of u.pontok) for (let i = 0; i + 3 < p.length; i += 2) {
        const [ax, ay] = tr(p[i]!, p[i + 1]!), [bx, by] = tr(p[i + 2]!, p[i + 3]!);
        // csak a hosszanti irányú élek számítanak (a falvégek, nyíláskávák nem)
        if ((Math.abs(bx - ax) >= Math.abs(by - ay)) !== hosszIrany) continue;
        const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 2));
        for (let k = 0; k <= n; k++) { const x = Math.round(ax + (bx - ax) * k / n), y = Math.round(ay + (by - ay) * k / n); if (x < 0 || y < 0 || x >= w || y >= h) continue; db++; if (kozelSzines[y * w + x]) jo++; }
      }
      ok = !vastagFeher && db > 0 && jo / db >= 0.7;
      if (!ok) {
        // fehér kitöltésű, falvastagságú (0,15–0,7 m), hosszú (≥ 2 m) panelsáv, amelynek mindkét vége pillérbe / falba fut
        // (csarnok szendvicspanel-fala a pillérek között)
        const [bx0, by0, bx1, by1] = u.bbox; const W = (bx1 - bx0) * mPerPt, H = (by1 - by0) * mPerPt;
        const v = Math.min(W, H), L = Math.max(W, H);
        if (v >= 0.15 && v <= 0.7 && L >= 2 && L >= 5 * v) {
          const fekvo = W >= H; const d = 0.3 / mPerPt;
          const falKozel = (cx: number, cy: number) => { for (let t = -d; t <= d; t += d / 6) { const [xx, yy] = fekvo ? tr(cx + t, cy) : tr(cx, cy + t); const xi = Math.round(xx), yi = Math.round(yy); if (xi >= 0 && yi >= 0 && xi < w && yi < h && fal[yi * w + xi]) return true; } return false; };
          const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
          ok = fekvo ? falKozel(bx0, cy) && falKozel(bx1, cy) : falKozel(cx, by0) && falKozel(cx, by1);
        }
      }
    }
      if (!ok) continue;
    poliRajzol(fal, w, h, u.pontok, tr); stilusRajzol(u, false);
    if (vanSzines) poliRajzol(reteg, w, h, u.pontok, tr);
    darabok.push(u.bbox);
  }
  // apró, elszigetelt kitöltések (bútor, oszlopjel) nem falak: csak a falhálózat nagy összefüggő részei maradnak
  {
    const komp = new Int32Array(w * h); const meret: number[] = [0];
    for (let i = 0; i < w * h; i++) {
      if (!fal[i] || komp[i]) continue;
      const id = meret.length; const sor = [i]; komp[i] = id;
      for (let k = 0; k < sor.length; k++) {
        const q = sor[k]!, x = q % w;
        for (const n of [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, q - w, q + w]) if (n >= 0 && n < w * h && fal[n] && !komp[n]) { komp[n] = id; sor.push(n); }
      }
      let bx0 = w, by0 = h, bx1 = 0, by1 = 0;
      for (const q of sor) { const x = q % w, y = (q / w) | 0; bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
      // zömök, kis folt (fotel, asztal, oszlopjel) – a vékony, hosszúkás darab (válaszfal) marad
      // (a nyílások közti rövid falpillér is kis folt, de rétegzett vagy hosszúkás – az marad)
      const oldalak = [bx1 - bx0 + 1, by1 - by0 + 1].sort((a, b) => a - b);
      const zomok = sor.length * px * px < 1.2 && oldalak[0]! * px > 0.35 && (oldalak[1]! / oldalak[0]! < 1.8 || oldalak[0]! * px > 0.65) && !sor.some((q) => reteg[q]);
      meret.push(zomok || sor.length * px * px < 0.05 ? 0 : sor.length);
    }
    for (let i = 0; i < w * h; i++) if (fal[i] && !meret[komp[i]!]) fal[i] = 0;
    for (let k = darabok.length - 1; k >= 0; k--) {
      const q = darabok[k]!; const [cx, cy] = tr((q[0] + q[2]) / 2, (q[1] + q[3]) / 2);
      const i = Math.min(h - 1, Math.max(0, Math.floor(cy))) * w + Math.min(w - 1, Math.max(0, Math.floor(cx)));
      if (!fal[i]) darabok.splice(k, 1);
    }
  }
  // vektoros falfelismerés (párhuzamos falsíkpár + metszeti jel): ha bekapcsolt, ez adja a falat és a nyílásokat
  const vek = (b as { vektorFal?: boolean }).vektorFal ?? !!(globalThis as { VEKTORFAL?: boolean }).VEKTORFAL;
  let vekNyilas: [number, number][][] = []; let vekAktiv = false;
  if (vek) {
    const v = falVektor(lap, mPerPt, [x0, y0, x1, y1]);
    // (ha a vektoros felismerés alig talál falat – pl. szkennelt lap –, marad a korábbi)
    const vA = v.savok.reduce((s2, f) => s2 + Math.hypot(f.pontok[1]![0] - f.pontok[0]![0], f.pontok[1]![1] - f.pontok[0]![1]) * mPerPt * f.vastag, 0);
    if (vA >= 2) {
    vekAktiv = true; fal.fill(0); darabok.length = 0;
    for (const f of v.savok) {
      poliRajzol(fal, w, h, [f.pontok.flat()], tr);
      // (a tengelyirányú sávok befoglalója a régi, tengelyirányú nyílás-áthidaláshoz; a ferdéké nem)
      if (Math.min(f.szog % 90, 90 - f.szog % 90) > 1) continue;
      const xs = f.pontok.map((q) => q[0]), ys = f.pontok.map((q) => q[1]);
      darabok.push([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]);
    }
    vekNyilas = v.nyilasok;
    }
  }
  // térbeli index a nyílásokban lévő rajzelemek (tok, üvegezés, küszöb, ajtólap) kereséséhez
  const RACS = 20; const index = new Map<number, Utvonal[]>();
  for (const u of lap.utvonalak) {
    if (u.bbox[2] < x0 || u.bbox[0] > x1 || u.bbox[3] < y0 || u.bbox[1] > y1) continue;
    if (Math.max(u.bbox[2] - u.bbox[0], u.bbox[3] - u.bbox[1]) * mPerPt > 4) continue;
    for (let gx = Math.floor(u.bbox[0] / RACS); gx <= Math.floor(u.bbox[2] / RACS); gx++) for (let gy = Math.floor(u.bbox[1] / RACS); gy <= Math.floor(u.bbox[3] / RACS); gy++) {
      const k = gx * 100000 + gy; const l = index.get(k); if (l) l.push(u); else index.set(k, [u]);
    }
  }
  const nyilasbanElemek = (r: [number, number, number, number]) => {
    const talalt = new Set<Utvonal>();
    for (let gx = Math.floor(r[0] / RACS); gx <= Math.floor(r[2] / RACS); gx++) for (let gy = Math.floor(r[1] / RACS); gy <= Math.floor(r[3] / RACS); gy++)
      for (const u of index.get(gx * 100000 + gy) ?? []) if (u.bbox[2] > r[0] + 0.3 && u.bbox[0] < r[2] - 0.3 && u.bbox[3] > r[1] + 0.3 && u.bbox[1] < r[3] - 0.3) talalt.add(u);
    return talalt.size;
  };
  // nyílások áthidalása: egy egyenesbe eső, azonos falsávba tartozó faldarabok közti rés (ablak, ajtó) lezárása,
  // ha a résben nyílászáró rajzeleme van (az üres rés átjáró, nem nyílás)
  const nyilas = new Uint8Array(w * h);
  if (vekAktiv) { const t = new Uint8Array(w * h); for (const q of vekNyilas) poliRajzol(t, w, h, [q.flat()], tr); for (let i = 0; i < w * h; i++) if (t[i] && !fal[i]) nyilas[i] = 1; }
  const maxRes = (b.maxNyilas ?? 2.8) / mPerPt, minHossz = 0.15 / mPerPt, maxV = maxFal / mPerPt;
  for (const fuggo of [false, true]) {
    // fuggo = false: vízszintes falak (x mentén hosszúak); true: függőlegesek – koordinátacserével ugyanaz a logika
    const d = darabok.map((q) => (fuggo ? [q[1], q[0], q[3], q[2]] : [...q]) as [number, number, number, number])
      .filter((q) => { const hz = q[2] - q[0], v = q[3] - q[1]; return v <= maxV && hz >= Math.max(2 * v, minHossz); })
      .sort((p, q) => p[0] - q[0]);
    for (let i = 0; i < d.length; i++) {
      const A = d[i]!; let legjobb: [number, number, number, number] | null = null; let res = Infinity;
      for (let j = 0; j < d.length; j++) {
        const B = d[j]!; if (B[0] < A[2] - 0.01 || B[0] - A[2] > maxRes || B[0] - A[2] >= res) continue;
        const atfed = Math.min(A[3], B[3]) - Math.max(A[1], B[1]);
        if (atfed < 0.7 * Math.min(A[3] - A[1], B[3] - B[1]) || atfed <= 0) continue;
        legjobb = B; res = B[0] - A[2];
      }
      if (!legjobb || res < 0.01) continue;
      const ya = Math.max(A[1], legjobb[1]), yb = Math.min(A[3], legjobb[3]);
      const resT: [number, number, number, number] = fuggo ? [ya, A[2], yb, legjobb[0]] : [A[2], ya, legjobb[0], yb];
      if (nyilasbanElemek(resT) < 2) continue;
      const t = fuggo ? (x: number, y: number) => tr(y, x) : tr;
      const [ax, ay] = t(A[2], ya), [bx, by] = t(legjobb[0], yb);
      for (let y = Math.max(0, Math.floor(Math.min(ay, by))); y <= Math.min(h - 1, Math.ceil(Math.max(ay, by)) - 1); y++)
        for (let x = Math.max(0, Math.floor(Math.min(ax, bx))); x <= Math.min(w - 1, Math.ceil(Math.max(ax, bx)) - 1); x++) if (!fal[y * w + x]) nyilas[y * w + x] = 1;
    }
  }
  // függönyfal / üvegfal: felirat nélküli, a nyílásnál szélesebb (2,8–15 m) elem – legalább két, egymáshoz közeli (≤ 0,12 m)
  // párhuzamos, tengelyirányú vonal (üvegezés, tok), amelynek mindkét vége falba fut, és közöttük nincs falkitöltés
  const uvegfalak: Raszter['uvegfalak'] = [];
  {
    const szegm: { fuggo: boolean; a: number; b: number; c: number }[] = []; // a..b a hossz mentén, c a keresztirányú helyzet (pt)
    for (const u of lap.utvonalak) {
      if (u.muvelet !== 'stroke' || u.bbox[2] < x0 || u.bbox[0] > x1 || u.bbox[3] < y0 || u.bbox[1] > y1) continue;
      for (const pl of u.pontok) for (let k = 0; k + 3 < pl.length; k += 2) {
        const ax = pl[k]!, ay = pl[k + 1]!, bx = pl[k + 2]!, by = pl[k + 3]!;
        const dx = Math.abs(bx - ax), dy = Math.abs(by - ay), L = Math.hypot(dx, dy) * mPerPt;
        if (L < maxRes * mPerPt || L > 15) continue;
        if (dy < 0.02 * dx) szegm.push({ fuggo: false, a: Math.min(ax, bx), b: Math.max(ax, bx), c: (ay + by) / 2 });
        else if (dx < 0.02 * dy) szegm.push({ fuggo: true, a: Math.min(ay, by), b: Math.max(ay, by), c: (ax + bx) / 2 });
      }
    }
    const falE = (h0: number, c: number, fuggo: boolean) => { const [xx, yy] = fuggo ? tr(c, h0) : tr(h0, c); const xi = Math.round(xx), yi = Math.round(yy); return xi >= 0 && yi >= 0 && xi < w && yi < h && !!fal[yi * w + xi]; };
    // a vég közelében (a végtől kifelé 0,35 m-ig, keresztirányban ±0,3 m-en belül) falkitöltés van
    const falVeg = (vegpont: number, irany: number, c: number, fuggo: boolean) => {
      for (let t = -0.05 / mPerPt; t <= 0.35 / mPerPt; t += 0.02 / mPerPt) for (let e = -0.3 / mPerPt; e <= 0.3 / mPerPt; e += 0.05 / mPerPt) if (falE(vegpont + irany * t, c + e, fuggo)) return true;
      return false;
    };
    const hasznalt = new Set<number>();
    szegm.forEach((S, i) => {
      if (hasznalt.has(i)) return;
      const tars = szegm.map((T, j) => ({ T, j })).filter(({ T, j }) => j !== i && T.fuggo === S.fuggo && Math.abs(T.c - S.c) <= 0.12 / mPerPt && Math.abs(T.c - S.c) > 0.004 / mPerPt
        && Math.min(T.b, S.b) - Math.max(T.a, S.a) >= 0.8 * Math.max(T.b - T.a, S.b - S.a));
      if (!tars.length) return;
      const csop = [S, ...tars.map((x) => x.T)];
      const a0 = Math.max(...csop.map((x) => x.a)), b0 = Math.min(...csop.map((x) => x.b));
      const c0 = Math.min(...csop.map((x) => x.c)), c1 = Math.max(...csop.map((x) => x.c)), cm = (c0 + c1) / 2;
      if ((b0 - a0) * mPerPt < maxRes * mPerPt) return;
      // mindkét vég falba fut, a sáv belseje nem fal
      if (!falVeg(a0, -1, cm, S.fuggo) || !falVeg(b0, 1, cm, S.fuggo)) return;
      // az üvegezés a fal síkjában fut: mindkét vége közelében keresztirányban ±0,2 m-en belül fal / pillér – a fal előtt
      // (0,3 m-nél messzebb) futó párkány-, pergola- vagy ereszvonal nem ilyen
      const egyvonalU = (veg: number, irany: number) => { for (let t = -0.05 / mPerPt; t <= 0.35 / mPerPt; t += 0.02 / mPerPt) for (let e = -0.2 / mPerPt; e <= 0.2 / mPerPt; e += 0.02 / mPerPt) if (falE(veg + irany * t, cm + e, S.fuggo)) return true; return false; };
      if (!egyvonalU(a0, -1) || !egyvonalU(b0, 1)) return;
      // a sávban nincs (vastag) fal: a vékony – legfeljebb 0,12 m-es – kitöltés maga az üvegezés / tok
      let falDb = 0, n = 0;
      for (let t = a0 + 0.3 / mPerPt; t < b0 - 0.3 / mPerPt; t += 0.1 / mPerPt) {
        n++; let v = 0;
        for (let e = -0.3 / mPerPt; e <= 0.3 / mPerPt; e += 0.01 / mPerPt) if (falE(t, cm + e, S.fuggo)) v++;
        if (v * 0.01 > 0.12) falDb++;
      }
      if (!n || falDb / n > 0.15) return;
      // sraffozott sáv (hőszigetelés, falréteg ferde vonalakkal) nem üvegezés
      {
        let ferde = 0; const m0 = 0.02 / mPerPt;
        const [bx0, by0, bx1, by1] = S.fuggo ? [c0 - m0, a0, c1 + m0, b0] : [a0, c0 - m0, b0, c1 + m0];
        for (const u of lap.utvonalak) {
          if (u.bbox[2] < bx0 || u.bbox[0] > bx1 || u.bbox[3] < by0 || u.bbox[1] > by1) continue;
          for (const pl of u.pontok) for (let k = 0; k + 3 < pl.length; k += 2) {
            const ax = pl[k]!, ay = pl[k + 1]!, bx = pl[k + 2]!, by = pl[k + 3]!;
            if (Math.min(ax, bx) < bx0 || Math.max(ax, bx) > bx1 || Math.min(ay, by) < by0 || Math.max(ay, by) > by1) continue;
            const dx = Math.abs(bx - ax), dy = Math.abs(by - ay), L = Math.hypot(dx, dy);
            if (L > 0 && dx > 0.3 * L && dy > 0.3 * L) ferde++;
          }
        }
        if (ferde > 3) return;
      }
      // a sáv mellett (±0,3 m) falvastagságú kitöltés fut végig (pl. mintázattal rajzolt fal fehér magja) → fal, nem üvegezés
      {
        const sav0 = c0 - 0.3 / mPerPt, sav1 = c1 + 0.3 / mPerPt, L = b0 - a0;
        const falSav = lap.utvonalak.some((u) => {
          if (u.muvelet === 'stroke' || u.muvelet === 'none') return false;
          const [ua0, uc0, ua1, uc1] = S.fuggo ? [u.bbox[1], u.bbox[0], u.bbox[3], u.bbox[2]] : u.bbox;
          const vastag = (uc1 - uc0) * mPerPt;
          return vastag >= 0.12 && vastag <= maxFal && uc1 > sav0 && uc0 < sav1 && Math.min(ua1, b0) - Math.max(ua0, a0) >= 0.8 * L;
        });
        if (falSav) return;
      }
      hasznalt.add(i); for (const x of tars) hasznalt.add(x.j);
      const [ax, ay] = S.fuggo ? [c0, a0] : [a0, c0], [bx, by] = S.fuggo ? [c1, b0] : [b0, c1];
      if (uvegfalak.some((g) => g.fuggo === S.fuggo && Math.abs((S.fuggo ? g.x0 : g.y0) - c0) < 0.4 / mPerPt && Math.min(S.fuggo ? g.y1 : g.x1, b0) - Math.max(S.fuggo ? g.y0 : g.x0, a0) > 0)) return;
      uvegfalak.push({ x0: ax, y0: ay, x1: bx, y1: by, hossz: (b0 - a0) * mPerPt, fuggo: S.fuggo });
      // a sáv lezárása (a helyiség ne folyjon ki rajta)
      const [px0, py0] = tr(ax, ay), [px1, py1] = tr(bx, by);
      const pad = Math.max(1, Math.round(0.03 / px));
      for (let y = Math.max(0, Math.floor(Math.min(py0, py1)) - pad); y <= Math.min(h - 1, Math.ceil(Math.max(py0, py1)) + pad); y++)
        for (let x = Math.max(0, Math.floor(Math.min(px0, px1)) - pad); x <= Math.min(w - 1, Math.ceil(Math.max(px0, px1)) + pad); x++) if (!fal[y * w + x]) nyilas[y * w + x] = 1;
    });
    // ablaksor: egymás mellé sorolt, egyenként keskeny ablakmodulok (tokvonal-párokkal), együtt ≥ 1,2 m, a sor mindkét vége
    // falba (pillérbe) fut, vagy ajtón át falba – pl. üvegezett homlokzat oszlopok között; bizonyíték: a mellvédfeliratok
    {
      const rov: { fuggo: boolean; a: number; b: number; c: number }[] = [];
      const jeloltek: { fuggo: boolean; a0: number; b0: number; c0: number; c1: number; n: number }[] = [];
      for (const u of lap.utvonalak) {
        if (u.muvelet !== 'stroke' || u.bbox[2] < x0 || u.bbox[0] > x1 || u.bbox[3] < y0 || u.bbox[1] > y1) continue;
        for (const pl of u.pontok) for (let k = 0; k + 3 < pl.length; k += 2) {
          const ax = pl[k]!, ay = pl[k + 1]!, bx = pl[k + 2]!, by = pl[k + 3]!;
          const dx = Math.abs(bx - ax), dy = Math.abs(by - ay), L = Math.hypot(dx, dy) * mPerPt;
          if (L < 0.3 || L > maxRes * mPerPt) continue;
          if (dy < 0.02 * dx) rov.push({ fuggo: false, a: Math.min(ax, bx), b: Math.max(ax, bx), c: (ay + by) / 2 });
          else if (dx < 0.02 * dy) rov.push({ fuggo: true, a: Math.min(ay, by), b: Math.max(ay, by), c: (ax + bx) / 2 });
        }
      }
      for (const fuggo of [false, true]) {
        const l = rov.filter((S) => S.fuggo === fuggo).sort((p, q) => p.c - q.c);
        // tokkal keretezett szakasz: van párja 4–120 mm-re, a hossz ≥ 80 %-án átfedve
        const keret = l.filter((S) => l.some((T) => T !== S && Math.abs(T.c - S.c) <= 0.12 / mPerPt && Math.abs(T.c - S.c) > 0.004 / mPerPt
          && Math.min(T.b, S.b) - Math.max(T.a, S.a) >= 0.8 * Math.max(T.b - T.a, S.b - S.a)));
        // keresztirányú sávok (≤ 0,15 m-es ugrásokkal), azon belül hossz menti futamok (≤ 0,35 m-es hézaggal)
        const savok: (typeof keret)[] = [];
        for (const S of keret) { const u = savok[savok.length - 1]; if (u && S.c - u[u.length - 1]!.c <= 0.15 / mPerPt) u.push(S); else savok.push([S]); }
        for (const sav of savok) {
          const f = [...sav].sort((p, q) => p.a - q.a);
          const futamok: (typeof f)[] = [];
          let akt: typeof f = [], veg = -Infinity;
          for (const S of f) { if (S.a - veg > 0.35 / mPerPt && akt.length) { futamok.push(akt); akt = []; } akt.push(S); veg = Math.max(akt.length > 1 ? veg : -Infinity, S.b); }
          if (akt.length) futamok.push(akt);
          // a modulsorok közti ajtó (≤ 2,5 m, a résben nyílászáró rajzelemével – pl. kifelé nyíló kétszárnyú ajtó íve) összeköti a futamokat
          for (let i = futamok.length - 2; i >= 0; i--) {
            const A = futamok[i]!, B = futamok[i + 1]!;
            const ab = Math.max(...A.map((x) => x.b)), ba = Math.min(...B.map((x) => x.a));
            if ((ba - ab) * mPerPt > 2.5) continue;
            const c0 = Math.min(...A.map((x) => x.c), ...B.map((x) => x.c)) - 1 / mPerPt, c1 = Math.max(...A.map((x) => x.c), ...B.map((x) => x.c)) + 1 / mPerPt;
            if (nyilasbanElemek(fuggo ? [c0, ab, c1, ba] : [ab, c0, ba, c1]) < 2) continue;
            futamok.splice(i, 2, [...A, ...B]);
          }
          for (const fu of futamok) {
            let a0 = Math.min(...fu.map((x) => x.a)), b0 = Math.max(...fu.map((x) => x.b));
            if ((b0 - a0) * mPerPt < 1.2 || (b0 - a0) * mPerPt > 30) continue;
            // legalább két modul (különálló elemek) – egy hosszú elem a fenti üvegfal-szabály dolga
            const kezd = new Set(fu.map((x) => Math.round(x.a * mPerPt * 10))); if (kezd.size < 2) continue;
            const c0 = Math.min(...fu.map((x) => x.c)), c1 = Math.max(...fu.map((x) => x.c)), cm = (c0 + c1) / 2;
            // ablak-bizonyíték: mellvédfelirat („pm 0”, „mv 90”) a sor mentén, a sávtól ≤ 1,5 m-re (a zuhanyfal, bútorsor nem ilyen)
            const pmT = lap.szovegek.filter((t) => /^(?:pm|ph|mv|p\.m\.?|mellvéd|parapet)\s*[.:=]?\s*[+-]?\d/i.test(t.s.trim())
              && (fuggo ? Math.abs(t.x - cm) : Math.abs(t.y - cm)) * mPerPt <= 1.5 && (fuggo ? t.y : t.x) >= a0 - 0.3 / mPerPt && (fuggo ? t.y : t.x) <= b0 + 0.3 / mPerPt);
            // a feliratok a sor hosszában eloszolva (2 m-es szakaszok legalább 40 %-ában) – nem egy keresztező fal feliratai
            const szakDb = new Set(pmT.map((t) => Math.floor(((fuggo ? t.y : t.x) - a0) * mPerPt))).size;
            // vagy nyílászáró-típusjel („AB-05A”, „AT-04”) a sor mellett (≤ 2 m), legalább 5 m-enként egy
            const kodDb = lap.szovegek.filter((t) => /^[A-Z]{1,3}\s*[-–]\s*\d{1,3}[A-Z]?$/.test(t.s.trim())
              && (fuggo ? Math.abs(t.x - cm) : Math.abs(t.y - cm)) * mPerPt <= 2 && (fuggo ? t.y : t.x) >= a0 - 0.5 / mPerPt && (fuggo ? t.y : t.x) <= b0 + 0.5 / mPerPt).length;
            const pmJo = pmT.length >= 2 && szakDb >= Math.max(2, 0.4 * (b0 - a0) * mPerPt / 2);
            if (!pmJo && kodDb < Math.max(1, Math.round((b0 - a0) * mPerPt / 5))) continue;
            // a sor végén ajtó (≤ 2,5 m rés, nyílászáró rajzelemével), utána fal: a sor az ajtón át a falig tart
            const kiterj = (veg: number, irany: number) => {
              if (falVeg(veg, irany, cm, fuggo)) return veg;
              for (let d = 0.4 / mPerPt; d <= 2.5 / mPerPt; d += 0.05 / mPerPt) {
                const v = veg + irany * d;
                if (!falE(v + irany * 0.1 / mPerPt, cm, fuggo) && !falVeg(v, irany, cm, fuggo)) continue;
                const [p0, p1] = [Math.min(veg, v), Math.max(veg, v)];
                if (nyilasbanElemek(fuggo ? [cm - 1 / mPerPt, p0, cm + 1 / mPerPt, p1] : [p0, cm - 1 / mPerPt, p1, cm + 1 / mPerPt]) < 2) return null;
                return v;
              }
              return null;
            };
            { const a1 = kiterj(a0, -1), b1 = kiterj(b0, 1); if (a1 === null || b1 === null) continue; a0 = a1; b0 = b1; }
            // a sor a fal síkjában fut: mindkét vége mögött egy vonalban (±10 cm) fal / pillér (a fal mellé állított bútorsor nem ilyen)
            const egyvonal = (veg: number, irany: number) => { for (let t = 0.02 / mPerPt; t <= 0.5 / mPerPt; t += 0.02 / mPerPt) for (let e = -0.1 / mPerPt; e <= 0.1 / mPerPt; e += 0.02 / mPerPt) if (falE(veg + irany * t, cm + e, fuggo)) return true; return false; };
            if (!egyvonal(a0, -1) || !egyvonal(b0, 1)) continue;
            if (!falVeg(a0, -1, cm, fuggo) || !falVeg(b0, 1, cm, fuggo)) continue;
            // a sávban nincs vastag falkitöltés
            let falDb = 0, n = 0;
            for (let t = a0 + 0.3 / mPerPt; t < b0 - 0.3 / mPerPt; t += 0.1 / mPerPt) {
              n++; let v = 0;
              for (let e = -0.3 / mPerPt; e <= 0.3 / mPerPt; e += 0.01 / mPerPt) if (falE(t, cm + e, fuggo)) v++;
              if (v * 0.01 > 0.12) falDb++;
            }
            if (!n || falDb / n > 0.3) continue;
            jeloltek.push({ fuggo, a0, b0, c0, c1, n: fu.length });
          }
        }
      }
      // átfedő, egymáshoz közeli (≤ 0,6 m) sorok közül a több elemből állót tartjuk meg (a fal menti bútor-, székvonal nem ablak)
      if (b.ablaksor === false) jeloltek.length = 0;
      jeloltek.sort((p, q) => q.n - p.n);
      for (const J of jeloltek) {
        const { fuggo, a0, b0, c0, c1 } = J;
        if (uvegfalak.some((g) => g.fuggo === fuggo && Math.abs((fuggo ? g.x0 : g.y0) - c0) < 0.6 / mPerPt && Math.min(fuggo ? g.y1 : g.x1, b0) - Math.max(fuggo ? g.y0 : g.x0, a0) > 0)) continue;
        const [ax, ay] = fuggo ? [c0, a0] : [a0, c0], [bx, by] = fuggo ? [c1, b0] : [b0, c1];
        uvegfalak.push({ x0: ax, y0: ay, x1: bx, y1: by, hossz: (b0 - a0) * mPerPt, fuggo, modulok: true });
        const [px0, py0] = tr(ax, ay), [px1, py1] = tr(bx, by);
        const pad = Math.max(1, Math.round(0.03 / px));
        for (let y = Math.max(0, Math.floor(Math.min(py0, py1)) - pad); y <= Math.min(h - 1, Math.ceil(Math.max(py0, py1)) + pad); y++)
          for (let x = Math.max(0, Math.floor(Math.min(px0, px1)) - pad); x <= Math.min(w - 1, Math.ceil(Math.max(px0, px1)) + pad); x++) if (!fal[y * w + x]) nyilas[y * w + x] = 1;
      }
    }
  }
  // falvégi nyílások: a fal vége és egy keresztező fal közti rés (pl. ajtó a sarokban), ha a résben ajtó/ablak rajzeleme van
  const maxVeg = 1.3 / mPerPt;
  for (const q of darabok) {
    const hz = q[2] - q[0], vt = q[3] - q[1];
    const vizsz = hz >= vt; const v = vizsz ? vt : hz, l = vizsz ? hz : vt;
    if (v > maxV || l < Math.max(2 * v, minHossz)) continue;
    for (const irany of [-1, 1]) {
      // a sáv közepén haladva a fal végétől a következő falpixelig
      const kozep = vizsz ? (q[1] + q[3]) / 2 : (q[0] + q[2]) / 2;
      const veg = vizsz ? (irany > 0 ? q[2] : q[0]) : (irany > 0 ? q[3] : q[1]);
      let talalt: number | null = null; let szabadVolt = false;
      for (let t = 0.5 / ptPx; t <= maxVeg; t += 0.5 / ptPx) {
        const pos = veg + irany * t;
        const [rx, ry] = vizsz ? tr(pos, kozep) : tr(kozep, pos);
        const xi = Math.round(rx), yi = Math.round(ry); if (xi < 0 || yi < 0 || xi >= w || yi >= h) break;
        const i = yi * w + xi;
        if (nyilas[i]) break; // már áthidalt
        if (fal[i]) { if (szabadVolt) talalt = pos; else { talalt = null; } if (szabadVolt) break; else continue; }
        szabadVolt = true;
      }
      if (talalt === null || Math.abs(talalt - veg) < 0.08 / mPerPt) continue;
      const a = Math.min(veg, talalt), b = Math.max(veg, talalt);
      const resT: [number, number, number, number] = vizsz ? [a, q[1], b, q[3]] : [q[0], a, q[2], b];
      if (nyilasbanElemek(resT) < 2) continue;
      const [ax, ay] = tr(resT[0], resT[1]), [bx, by] = tr(resT[2], resT[3]);
      for (let y = Math.max(0, Math.floor(ay)); y <= Math.min(h - 1, Math.ceil(by) - 1); y++)
        for (let x = Math.max(0, Math.floor(ax)); x <= Math.min(w - 1, Math.ceil(bx) - 1); x++) if (!fal[y * w + x]) nyilas[y * w + x] = 1;
    }
  }
  // tinta-fal: a lapképen falvastagságú tintasáv (mintával, sraffozással, vastag vonallal rajzolt fal is) – a vektoros
  // elemzés után, hogy a már felismert nyílások (ablakkeret, üvegfal: a zárás után tömör tintafolt) nyílások maradjanak
  let tintaDb = 0;
  if (b.tinta && !vekAktiv) {
    const t = tintaFal(b.tinta, x0, y0, ptPx, w, h, px, lap.szovegek);
    for (let i = 0; i < w * h; i++) if (t[i] && !fal[i] && !nyilas[i]) { fal[i] = 1; tintaDb++; }
  }
  if (b.szinKep) szinHatar(fal, w, h, b.szinKep.hatar ?? [150, 230, 252], (x, y) => { const k = b.szinKep!; const ix = Math.round((x0 + (x + 0.5) / ptPx) * k.ptPx), iy = Math.round((y0 + (y + 0.5) / ptPx) * k.ptPx); return ix >= 0 && iy >= 0 && ix < k.w && iy < k.h ? k.adat[iy * k.w + ix]! : 255; });
  // sraffozott falaknál a nyílások (ablak, ajtó) rajzeleme nem kitöltés – a falsávban lévő réseket zárjuk (≤ 2,7 m)
  const resM = b.resZaras ?? (vekAktiv ? 0 : sraffMod || tintaDb * px * px > 2 ? 2.7 : 0);
  // (sraffozott falnál a nyílások közti falpillér gyakran különálló folt – ott nem kell azonos falhálózat)
  if (resM) resZar(fal, nyilas, w, h, Math.round(resM / px), Math.round(0.6 / px), sraffMod && !b.resZaras ? new Int32Array(w * h).fill(1) : falKomponensek(fal, w, h), Math.max(2, Math.round(0.25 / px)), Math.round(0.18 / px), Math.round(1.2 / px));
  // feliratos széles nyílások (kapuk): a felirat 2,5 m-es környezetében az a falirányú rés, amelynek hossza a felirat
  // szélességével egyezik (±25 %) és mindkét végén fal van – a rés falvastagságnyi sávja áthidalódik
  for (const k of b.kapuk ?? []) {
    const [kx, ky] = tr(k.x, k.y); const L = k.szel / px, R = Math.round(2.5 / px);
    const vizsz = k.fal === 'v';
    const sorok: { s: number; a: number; e: number }[] = [];
    for (let d = -R; d <= R; d++) {
      const sorI = Math.round(vizsz ? ky : kx) + d; if (sorI < 0 || sorI >= (vizsz ? h : w)) continue;
      const n = vizsz ? w : h; const at = (q: number) => (vizsz ? fal[sorI * w + q] : fal[q * w + sorI]);
      const c = Math.round(vizsz ? kx : ky);
      // a felirat helyéről mindkét irányban az első falig
      let a = c, e = c;
      if (at(Math.max(0, Math.min(n - 1, c)))) continue;
      while (a > 0 && !at(a - 1) && c - a < L * 1.5) a--;
      while (e < n - 1 && !at(e + 1) && e - c < L * 1.5) e++;
      if (a <= 0 || e >= n - 1 || !at(a - 1) || !at(e + 1)) continue;
      const hossz = e - a + 1;
      if (hossz < L * 0.75 || hossz > L * 1.25) continue;
      sorok.push({ s: sorI, a, e });
    }
    // a falvastagság: egymást követő, azonos résű sorok (≤ 0,8 m)
    if (!sorok.length || sorok.length > Math.round(0.8 / px) * 3) continue;
    const t0 = sorok[0]!;
    const egy = sorok.filter((x) => Math.abs(x.a - t0.a) <= 3 && Math.abs(x.e - t0.e) <= 3);
    if (egy.length < 2 || egy.length > Math.round(0.8 / px)) continue;
    for (const x of egy) for (let q = x.a; q <= x.e; q++) { const i = vizsz ? x.s * w + q : q * w + x.s; if (!fal[i]) nyilas[i] = 1; }
  }
  const gat = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) gat[i] = fal[i] || nyilas[i] ? 1 : 0;
  // helyiségek: a pecsétekből indított versengő elárasztás a (hajszálrésekre kissé tágított) gáton belül
  const rAjto = Math.max(1, Math.round((b.ajtoZar ?? 0.05) / px));
  const tagitott = tagit(gat, w, h, rAjto);
  const szabadKicsi = tagitott.map((v) => 1 - v) as Uint8Array;
  const helyCimke = new Int32Array(w * h);
  magok.forEach((m, k) => {
    let [cx, cy] = tr(m.x, m.y); cx = Math.round(cx); cy = Math.round(cy);
    // ha a pecsét falra / bútorra esik, a legközelebbi szabad cella
    let legjobb = -1;
    for (let r = 0; r < 80 && legjobb < 0; r++) for (let dy = -r; dy <= r && legjobb < 0; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = y * w + x; if (szabadKicsi[i] && !helyCimke[i]) { legjobb = i; break; }
    }
    if (legjobb >= 0) helyCimke[legjobb] = 2 + k;
  });
  // a külső tér feliratai (fedett bejárat, terasz, lapostető) is versenyeznek az elárasztásban: a velük közös, falakkal
  // nem teljesen lezárt teret (nyitott oldalú fedett bejárat) nem nyelheti el a szomszédos helyiség
  const kpCimke = 2 + magok.length;
  kp.forEach((m) => {
    const [cx, cy] = tr(m.x, m.y).map(Math.round) as [number, number];
    let kesz = false;
    for (let r = 0; r < 40 && !kesz; r++) for (let dy = -r; dy <= r && !kesz; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = y * w + x; if (szabadKicsi[i] && !helyCimke[i]) { helyCimke[i] = kpCimke; kesz = true; break; }
    }
  });
  araszt(helyCimke, szabadKicsi, w, h);
  const kpTer = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (helyCimke[i] === kpCimke) { helyCimke[i] = 0; kpTer[i] = 1; }
  szivargoPotlas(helyCimke, gat, magok, w, h, px, tr);
  if (sraffMod) {
    // a rács széléig kifutó „helyiség” (pl. a pecsétje a külső térben van: fedett bejáró, kukatároló) a külső tér része
    const kifut = new Set<number>();
    for (let x = 0; x < w; x++) for (const y of [0, h - 1]) if (helyCimke[y * w + x]! >= 2) kifut.add(helyCimke[y * w + x]!);
    for (let y = 0; y < h; y++) for (const x of [0, w - 1]) if (helyCimke[y * w + x]! >= 2) kifut.add(helyCimke[y * w + x]!);
    if (kifut.size) for (let i = 0; i < w * h; i++) if (kifut.has(helyCimke[i]!)) helyCimke[i] = 0;
  }
  const szabad = gat.map((v) => 1 - v) as Uint8Array;
  // külső tér: ami a rács széléhez kapcsolódik, vagy nagyobb összefüggő szabad terület, és nem helyiség
  const kulsoMag = new Int32Array(w * h);
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) if (szabad[y * w + x] && !helyCimke[y * w + x]) kulsoMag[y * w + x] = 1;
  for (let y = 0; y < h; y++) for (const x of [0, w - 1]) if (szabad[y * w + x] && !helyCimke[y * w + x]) kulsoMag[y * w + x] = 1;
  const nemHely = new Uint8Array(w * h);
  // (a falak menti hajszálrés – a tágított gát sávja – nem vezeti a külső teret a helyiségek köré)
  for (let i = 0; i < w * h; i++) nemHely[i] = szabadKicsi[i] && !helyCimke[i] ? 1 : 0;
  // külső tér feliratai (lapostető, terasz…): a körülzárt terük is külső tér
  for (const m of kp) {
    const [cx, cy] = tr(m.x, m.y).map(Math.round) as [number, number];
    let kesz = false;
    for (let r = 0; r < 40 && !kesz; r++) for (let dy = -r; dy <= r && !kesz; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = y * w + x; if (nemHely[i]) { kulsoMag[i] = 1; kesz = true; break; }
    }
  }
  for (let i = 0; i < w * h; i++) if (kpTer[i] && nemHely[i]) kulsoMag[i] = 1;
  araszt(kulsoMag, nemHely, w, h);
  // a zseb egy áthidalt nyíláson (≤ 0,6 m) át legalább 0,3 m hosszan érintkezik-e pecsételt helyiséggel
  const nyilasonHelyiseg = (komp: number[]) => {
    const lepes = Math.round(0.6 / px); let db = 0;
    const be = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
    for (const q of komp) {
      const x = q % w, y = (q / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        let xx = x + dx, yy = y + dy;
        if (!be(xx, yy) || (!gat[yy * w + xx] && !helyCimke[yy * w + xx] && nemHely[yy * w + xx])) continue; // még a zseb
        // hajszálrés → áthidalt nyílás (≤ 0,6 m) → hajszálrés → helyiség
        for (let j = 0; j < 4 && be(xx, yy) && !gat[yy * w + xx] && !helyCimke[yy * w + xx]; j++) { xx += dx; yy += dy; }
        if (!be(xx, yy) || !nyilas[yy * w + xx]) continue;
        for (let k = 0; k < lepes && be(xx, yy) && nyilas[yy * w + xx]; k++) { xx += dx; yy += dy; }
        for (let j = 0; j < 4 && be(xx, yy) && !gat[yy * w + xx] && !helyCimke[yy * w + xx]; j++) { xx += dx; yy += dy; }
        if (be(xx, yy) && helyCimke[yy * w + xx]! >= 2) db++;
      }
    }
    return db * px >= 0.3;
  };
  // zárt, címkézetlen zsebek (pl. szegély és homlokzat közti járda): 3 m² felett külső tér
  const latott = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (!nemHely[i] || kulsoMag[i] || latott[i]) continue;
    const komp: number[] = [i]; latott[i] = 1;
    for (let k = 0; k < komp.length; k++) {
      const q = komp[k]!, x = q % w;
      for (const n of [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, q - w, q + w]) if (n >= 0 && n < w * h && nemHely[n] && !latott[n] && !kulsoMag[n]) { latott[n] = 1; komp.push(n); }
    }
    // (sraffozott falas rajzon a mag nélküli belső tér – közlekedő, akna – nem külső tér)
    // kivéve, ha áthidalt nyíláson (ajtó, a raszter által lezárt rés) át helyiséggel érintkezik: az a helyiség része
    // (pl. a folyosó pecsét nélküli szakasza) – alább a nyíláson át legjobban kapcsolódó helyiséghez kerül
      if (komp.length * px * px >= 3 && !sraffMod && !nyilasonHelyiseg(komp)) for (const q of komp) kulsoMag[q] = 1;
  }
  // visszanövesztés a falsíkig (a hajszálrés-tágítás miatt)
  for (let i = 0; i < w * h; i++) if (kulsoMag[i] && !helyCimke[i]) helyCimke[i] = 1;
  araszt(helyCimke, szabad, w, h);
  {
    // mag nélküli zsebek (a lépcső, a folyosó rajzelemei – korlát, fokok – miatt leválasztott részek): ahhoz a
    // helyiséghez tartoznak, amelyikkel a leghosszabb áthidalt réssel érintkeznek (a falon át nem)
    const latott2 = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      if (helyCimke[i] || !szabad[i] || latott2[i]) continue;
      const komp: number[] = [i]; latott2[i] = 1;
      for (let k = 0; k < komp.length; k++) {
        const q = komp[k]!, x = q % w;
        for (const n of [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, q - w, q + w]) if (n >= 0 && n < w * h && szabad[n] && !helyCimke[n] && !latott2[n]) { latott2[n] = 1; komp.push(n); }
      }
      if (komp.length * px * px < 0.3) continue;
      // a zsebet határoló nyílás-pixeleken át (legfeljebb ~0,6 m) melyik helyiség érhető el
      const szam = new Map<number, number>();
      const lepes = Math.round(0.6 / px);
      for (const q of komp) {
        const x = q % w, y = (q / w) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          let xx = x + dx, yy = y + dy, k = 0;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h || !nyilas[yy * w + xx]) continue;
          while (k < lepes && xx >= 0 && yy >= 0 && xx < w && yy < h && nyilas[yy * w + xx]) { xx += dx; yy += dy; k++; }
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const c = helyCimke[yy * w + xx]!;
          if (c >= 2) szam.set(c, (szam.get(c) ?? 0) + 1);
        }
      }
      let legjobb = 0, db = 0;
      for (const [c, n] of szam) if (n > db) { legjobb = c; db = n; }
      if (legjobb && db * px >= 0.3) for (const q of komp) helyCimke[q] = legjobb;
    }
  }
  const szivarog = magok.map(() => false);
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) { const c = helyCimke[y * w + x]!; if (c >= 2) szivarog[c - 2] = true; }
  for (let y = 0; y < h; y++) for (const x of [0, w - 1]) { const c = helyCimke[y * w + x]!; if (c >= 2) szivarog[c - 2] = true; }

  // falszakaszok: helyiségpixel, amelynek 4-szomszédja fal vagy külső tér; onnan a normális irányában a falon át
  // a sugár a falon túl a homlokzat menti sávokon (kavicsterítés, lábazat) is átmehet, ezért hosszabb a falvastagságnál
  const maxLep = Math.round(Math.max(2.5, maxFal * 2.5) / px);
  // a helyiségek „nyitása” (≈ 0,4 m-es négyzettel): az ablak- és ajtófülkék, bútorrések nem számítanak a falsík részének
  const nyitott = nyitas(helyCimke, w, h, Math.max(1, Math.round(0.2 / px)));
  const helyisegek = magok.map(() => ({ A: 0, szak: new Map<string, { n: number; v: number; ny: Set<number>; vet: Set<number>; mely: number[][]; pontok: [number, number][] }>() }));
  const iranyok: [number, number, number][] = [[0, -1, 0], [1, 0, 90], [0, 1, 180], [-1, 0, 270]];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = helyCimke[y * w + x]!; if (c < 2) continue;
    const H = helyisegek[c - 2]!; H.A += px * px;
    if (!nyitott[y * w + x]) continue;
    for (const [dx, dy, ir] of iranyok) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx; if (!gat[ni] && helyCimke[ni] !== 1 && !(helyCimke[ni] === c && !nyitott[ni])) continue;
      let tul: 'kulso' | number | 'ismeretlen' = 'ismeretlen'; let lep = 0; let atNyilas = false; let sajat = 0;
      let qx = nx, qy = ny;
      while (lep <= maxLep && qx >= 0 && qy >= 0 && qx < w && qy < h) {
        const qi = qy * w + qx;
        if (nyilas[qi]) atNyilas = true;
        if (!gat[qi]) {
          const t = helyCimke[qi]!;
          // hajszálrés a falrétegek között, ill. a saját helyiség benyúlása (ablakfülke a könyöklő mögött)
          if (t === 0 || (t === c && sajat++ < 28)) { qx += dx; qy += dy; lep++; continue; }
          tul = t === 1 ? 'kulso' : t !== c ? t - 2 : 'ismeretlen'; break;
        }
        qx += dx; qy += dy; lep++;
      }
      if (lep > maxLep) tul = 'ismeretlen';
      const kulcs = `${ir}|${tul}`;
      const s = H.szak.get(kulcs) ?? { n: 0, v: 0, ny: new Set<number>(), vet: new Set<number>(), mely: [] as number[][], pontok: [] };
      // a hossz a falra vetített kiterjedés: oszloponként (fel/le) ill. soronként (jobbra/balra) egyszer számít,
      // így a bútor, könyöklő, ablakfülke mögötti második határ nem duplázza a hosszt
      const vk = dx === 0 ? x : y;
      s.n++; s.v += lep * px; s.vet.add(vk); s.mely.push([vk, (dx === 0 ? y * dy : x * dx), y * w + x]); if (atNyilas) s.ny.add(vk); s.pontok.push([x0 + (x + 0.5) / ptPx, y0 + (y + 0.5) / ptPx]);
      H.szak.set(kulcs, s);
    }
  }
  return {
    w, h, px, x0, y0, mPerPt, fal, cimke: helyCimke, stilus,
    nyilas, uvegfalak,
    helyisegek: helyisegek.map((H, k) => ({
      A: H.A, szivarog: szivarog[k]!,
      szakaszok: [...H.szak.entries()].map(([k, s]) => { const [ir, t] = k.split('|'); return { irany: Number(ir), tul: t === 'kulso' ? 'kulso' : t === 'ismeretlen' ? 'ismeretlen' : Number(t), hossz: falsikHossz(s.mely, px), nyilasHossz: s.ny.size * px, vastagsag: s.v / s.n, pontok: s.pontok } as FalSzakasz; })
        .filter((s) => s.hossz >= 0.1).sort((a, b) => b.hossz - a.hossz),
    })),
  };
}

/**
 * Falsávon belüli rések zárása rajzelem nélkül: soronként (ill. oszloponként) a két falpixel közti, legfeljebb `maxRes`
 * hosszú rés jelölt; az azonos végpontú jelöltek egymás alatti sávja csak akkor zár, ha legfeljebb `maxSav` vastag
 * (falvastagságnyi) – a két fal közti helyiség (széles sáv) így nem záródik le.
 */
/** A falpixelek 8-szomszédos összefüggő komponensei (külön alaprajzok egy lapon). */
function falKomponensek(fal: Uint8Array, w: number, h: number): Int32Array {
  const komp = new Int32Array(w * h); let id = 0;
  for (let i = 0; i < w * h; i++) {
    if (!fal[i] || komp[i]) continue;
    id++; const sor = [i]; komp[i] = id;
    for (let k = 0; k < sor.length; k++) {
      const q = sor[k]!, x = q % w, y = (q / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx; if (fal[n] && !komp[n]) { komp[n] = id; sor.push(n); }
      }
    }
  }
  return komp;
}

function resZar(fal: Uint8Array, nyilas: Uint8Array, w: number, h: number, maxRes: number, maxSav: number, komp: Int32Array, minFut = 5, fokMin = Infinity, fokRes = 0) {
  for (const fuggo of [false, true]) {
    const W = fuggo ? h : w, H = fuggo ? w : h;
    const idx = (a: number, b: number) => (fuggo ? a * w + b : b * w + a);
    const jelolt = new Map<string, number[]>();
    for (let b = 0; b < H; b++) {
      let a = 0;
      while (a < W) {
        if (fal[idx(a, b)]) { a++; continue; }
        const k0 = a; while (a < W && !fal[idx(a, b)]) a++;
        const k1 = a; // [k0, k1) szabad
        if (k0 === 0 || k1 >= W || k1 - k0 > maxRes) continue;
        // a rés két oldalán a fal a rés irányában is folytatódik (egy vonalba eső falszakaszok); a keresztező vékony
        // válaszfal (néhány pixel) nem horgony – különben a sűrűn tagolt előtér, fürdő „lezáródna”
        let bal = 0; while (bal < minFut && k0 - 1 - bal >= 0 && fal[idx(k0 - 1 - bal, b)]) bal++;
        let jobb = 0; while (jobb < minFut && k1 + jobb < W && fal[idx(k1 + jobb, b)]) jobb++;
        if (bal < minFut || jobb < minFut) continue;
        // csak egy alaprajzon belül (a rés két oldala azonos falhálózat) – két szomszédos rajz közti köz nem nyílás
        if (komp[idx(k0 - 1, b)] !== komp[idx(k1, b)]) continue;
        const kulcs = `${k0}|${k1}`; (jelolt.get(kulcs) ?? jelolt.set(kulcs, []).get(kulcs)!).push(b);
      }
    }
    for (const [kulcs, sorok] of jelolt) {
      const [k0, k1] = kulcs.split('|').map(Number) as [number, number];
      sorok.sort((p, q) => p - q);
      const savok: [number, number][] = [];
      let i = 0;
      while (i < sorok.length) {
        let j = i; while (j + 1 < sorok.length && sorok[j + 1] === sorok[j]! + 1) j++;
        const vastag = j - i + 1;
        if (vastag <= maxSav && vastag >= 2) savok.push([sorok[i]!, sorok[j]!]);
        i = j + 1;
      }
      // lépcső: azonos fesztávú, sűrűn (≤ maxSav) egymást követő sávok legalább 1,2 m hosszú sora, benne legalább 3 fokmélységű (≥ 0,18 m)
      // (lépcsőfokok a lépcsőházfalak között) – nem falnyílások; az ablakkeret vonalai által tagolt vékony sávok igen
      const lepcso = new Set<number>();
      const fok = (k: number) => (savok[k]![1] - savok[k]![0] + 1) >= fokMin;
      for (let k = 0; k < savok.length; k++) {
        let m = k; while (m + 1 < savok.length && savok[m + 1]![0] - savok[m]![1] <= maxSav) m++;
        let db = 0; for (let q = k; q <= m; q++) if (fok(q)) db++;
        if (db >= 3 && savok[m]![1] - savok[k]![0] >= fokRes) for (let q = k; q <= m; q++) lepcso.add(q);
        k = m;
      }
      savok.forEach(([b0, b1], k) => { if (!lepcso.has(k)) for (let b = b0; b <= b1; b++) for (let a = k0; a < k1; a++) nyilas[idx(a, b)] = 1; });
    }
  }
}

/**
 * Színhatár mint fal: a cellák árnyalatosztálya (sötétszürke ≤ 230, világosszürke ≤ 251, fehér); a vonalak, feliratok
 * (sötét képpontok) cellái a szomszédos osztályt veszik át. Ahol két szomszédos cella osztálya eltér, ott fal van.
 */
function szinHatar(fal: Uint8Array, w: number, h: number, hatar: [number, number, number], szurke: (x: number, y: number) => number) {
  const osztaly = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (fal[i]) continue;
    const g = szurke(x, y);
    osztaly[i] = g < hatar[0] ? 0 : g <= hatar[1] ? 1 : g < hatar[2] ? 2 : 3;
  }
  for (let it = 0; it < 4; it++) {
    const uj = osztaly.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (osztaly[i] || fal[i]) continue;
      for (const n of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) if (n >= 0 && n < w * h && osztaly[n]) { uj[i] = osztaly[n]!; break; }
    }
    osztaly.set(uj);
  }
  const jelol: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; const a = osztaly[i]!; if (!a || fal[i]) continue;
    const jobb = x < w - 1 ? osztaly[i + 1]! : 0, le = y < h - 1 ? osztaly[i + w]! : 0;
    if ((jobb && jobb !== a && !fal[i + 1]) || (le && le !== a && !fal[i + w])) jelol.push(i);
  }
  for (const i of jelol) fal[i] = 1;
}
