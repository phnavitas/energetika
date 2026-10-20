/**
 * Alaprajz raszteres geometriája (3–4. kör alapja): falmaszk a falmetszet-kitöltésekből, külső tér elárasztással,
 * helyiségtartományok a pecsétekből indított versengő elárasztással, és helyiségenként a határoló falszakaszok
 * irány és szomszéd szerint (külső tér / másik helyiség). A falak belső (nettó) síkján mér.
 */
import type { Lap, Utvonal } from './kinyeres';

export interface RaszterBeallitas {
  /** Pixelméret méterben. */
  px?: number;
  /** A falmetszet legnagyobb vastagsága (m) – ennél vastagabb kitöltés nem fal (burkolat, terep). */
  maxFal?: number;
  /** Hajszálrések zárása (m). */
  ajtoZar?: number;
  /** A legszélesebb áthidalt nyílás (m) – két egy vonalba eső falszakasz között. */
  maxNyilas?: number;
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
  if (!feher(u.toltoSzin)) return v <= maxFal && v >= 0.004;
  // fehér kitöltés: a válaszfalak magja gyakran fehér – csak vékony, hosszúkás elem számít falnak
  // (a bútorok – szekrény, pult, kád – 0,5 m-nél mélyebbek vagy rövidek)
  const hossz = Math.max(u.bbox[2] - u.bbox[0], u.bbox[3] - u.bbox[1]) * mPerPt;
  // (a rövid falpillérek miatt itt csak 0,15 m; a bútorokat a rétegszomszédság-vizsgálat szűri ki)
  return v >= 0.03 && v <= 0.35 && hossz >= 0.15;
}

/** Sokszögek kitöltése páros-páratlan szabállyal a rácsra. */
function poliRajzol(m: Uint8Array | Uint16Array, w: number, h: number, polik: number[][], tr: (x: number, y: number) => [number, number], ertek = 1) {
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
export function raszterEpit(lap: Lap, mPerPt: number, magok: { x: number; y: number }[], b: RaszterBeallitas = {}, margo = 6): Raszter {
  const px = b.px ?? 0.025, maxFal = b.maxFal ?? 0.9;
  const ptPx = mPerPt / px; // 1 pt hány pixel
  const xs = magok.map((m) => m.x), ys = magok.map((m) => m.y);
  const mPt = margo / mPerPt;
  const x0 = Math.min(...xs) - mPt, y0 = Math.min(...ys) - mPt, x1 = Math.max(...xs) + mPt, y1 = Math.max(...ys) + mPt;
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
  // sraffozott fehér kitöltés (falazat, hőszigetelés metszeti mintázattal): a befoglalójában legalább 3 rövid, ferde
  // vonal – a bútor kitöltése nem sraffozott. Ezek a színes rétegekkel egyenrangú falrétegek.
  const reteg = new Uint8Array(w * h);
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
      const szogek = new Map<number, number>();
      for (let gx = Math.floor(bx0 / SR); gx <= Math.floor(bx1 / SR); gx++) for (let gy = Math.floor(by0 / SR); gy <= Math.floor(by1 / SR); gy++)
        for (const [cx, cy, sz, l] of sraffIdx.get(gx * 100000 + gy) ?? []) if (cx > bx0 && cx < bx1 && cy > by0 && cy < by1 && l >= rov * 0.4) { const kk = Math.round(sz / 5); szogek.set(kk, (szogek.get(kk) ?? 0) + 1); }
      if (Math.max(0, ...szogek.values()) < 3) continue;
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
    let ok = !vanSzines && Math.max(u.bbox[2] - u.bbox[0], u.bbox[3] - u.bbox[1]) * mPerPt >= 0.5;
    if (vanSzines) {
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
      ok = db > 0 && jo / db >= 0.7;
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
  araszt(helyCimke, szabadKicsi, w, h);
  const szabad = gat.map((v) => 1 - v) as Uint8Array;
  // külső tér: ami a rács széléhez kapcsolódik, vagy nagyobb összefüggő szabad terület, és nem helyiség
  const kulsoMag = new Int32Array(w * h);
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) if (szabad[y * w + x] && !helyCimke[y * w + x]) kulsoMag[y * w + x] = 1;
  for (let y = 0; y < h; y++) for (const x of [0, w - 1]) if (szabad[y * w + x] && !helyCimke[y * w + x]) kulsoMag[y * w + x] = 1;
  const nemHely = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) nemHely[i] = szabad[i] && !helyCimke[i] ? 1 : 0;
  araszt(kulsoMag, nemHely, w, h);
  // zárt, címkézetlen zsebek (pl. szegély és homlokzat közti járda): 3 m² felett külső tér
  const latott = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (!nemHely[i] || kulsoMag[i] || latott[i]) continue;
    const komp: number[] = [i]; latott[i] = 1;
    for (let k = 0; k < komp.length; k++) {
      const q = komp[k]!, x = q % w;
      for (const n of [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, q - w, q + w]) if (n >= 0 && n < w * h && nemHely[n] && !latott[n] && !kulsoMag[n]) { latott[n] = 1; komp.push(n); }
    }
    if (komp.length * px * px >= 3) for (const q of komp) kulsoMag[q] = 1;
  }
  // visszanövesztés a falsíkig (a hajszálrés-tágítás miatt)
  for (let i = 0; i < w * h; i++) if (kulsoMag[i] && !helyCimke[i]) helyCimke[i] = 1;
  araszt(helyCimke, szabad, w, h);
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
    nyilas,
    helyisegek: helyisegek.map((H, k) => ({
      A: H.A, szivarog: szivarog[k]!,
      szakaszok: [...H.szak.entries()].map(([k, s]) => { const [ir, t] = k.split('|'); return { irany: Number(ir), tul: t === 'kulso' ? 'kulso' : t === 'ismeretlen' ? 'ismeretlen' : Number(t), hossz: falsikHossz(s.mely, px), nyilasHossz: s.ny.size * px, vastagsag: s.v / s.n, pontok: s.pontok } as FalSzakasz; })
        .filter((s) => s.hossz >= 0.1).sort((a, b) => b.hossz - a.hossz),
    })),
  };
}
