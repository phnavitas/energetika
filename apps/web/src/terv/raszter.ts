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
  return v >= 0.03 && v <= 0.35 && hossz >= 0.5;
}

/** Sokszögek kitöltése páros-páratlan szabállyal a rácsra. */
function poliRajzol(m: Uint8Array, w: number, h: number, polik: number[][], tr: (x: number, y: number) => [number, number]) {
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
      for (let x = a; x <= b; x++) m[y * w + x] = 1;
    }
  }
  // vékony (1 px alatti) sávok se maradjanak ki: a csúcsokat is jelöljük
  for (const [ax, ay] of el) { const x = Math.round(ax), y = Math.round(ay); if (x >= 0 && y >= 0 && x < w && y < h) m[y * w + x] = 1; }
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
  for (const u of lap.utvonalak) {
    if (u.bbox[2] < x0 || u.bbox[0] > x1 || u.bbox[3] < y0 || u.bbox[1] > y1) continue;
    if (!falKitoltes(u, mPerPt, maxFal)) continue;
    poliRajzol(fal, w, h, u.pontok, tr);
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
      const zomok = sor.length * px * px < 1.2 && Math.min(bx1 - bx0 + 1, by1 - by0 + 1) * px > 0.35;
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
  const helyisegek = magok.map(() => ({ A: 0, szak: new Map<string, { n: number; v: number; ny: number; pontok: [number, number][] }>() }));
  const iranyok: [number, number, number][] = [[0, -1, 0], [1, 0, 90], [0, 1, 180], [-1, 0, 270]];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = helyCimke[y * w + x]!; if (c < 2) continue;
    const H = helyisegek[c - 2]!; H.A += px * px;
    for (const [dx, dy, ir] of iranyok) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx; if (!gat[ni] && helyCimke[ni] !== 1) continue;
      let tul: 'kulso' | number | 'ismeretlen' = 'ismeretlen'; let lep = 0; let atNyilas = false; let sajat = 0;
      let qx = nx, qy = ny;
      while (lep <= maxLep && qx >= 0 && qy >= 0 && qx < w && qy < h) {
        const qi = qy * w + qx;
        if (nyilas[qi]) atNyilas = true;
        if (!gat[qi]) {
          const t = helyCimke[qi]!;
          // hajszálrés a falrétegek között, ill. a saját helyiség benyúlása (ablakfülke a könyöklő mögött)
          if (t === 0 || (t === c && sajat++ < 12)) { qx += dx; qy += dy; lep++; continue; }
          tul = t === 1 ? 'kulso' : t !== c ? t - 2 : 'ismeretlen'; break;
        }
        qx += dx; qy += dy; lep++;
      }
      if (lep > maxLep) tul = 'ismeretlen';
      const kulcs = `${ir}|${tul}`;
      const s = H.szak.get(kulcs) ?? { n: 0, v: 0, ny: 0, pontok: [] };
      s.n++; s.v += lep * px; if (atNyilas) s.ny++; s.pontok.push([x0 + (x + 0.5) / ptPx, y0 + (y + 0.5) / ptPx]);
      H.szak.set(kulcs, s);
    }
  }
  return {
    w, h, px, x0, y0, mPerPt, fal, cimke: helyCimke,
    nyilas,
    helyisegek: helyisegek.map((H, k) => ({
      A: H.A, szivarog: szivarog[k]!,
      szakaszok: [...H.szak.entries()].map(([k, s]) => { const [ir, t] = k.split('|'); return { irany: Number(ir), tul: t === 'kulso' ? 'kulso' : t === 'ismeretlen' ? 'ismeretlen' : Number(t), hossz: s.n * px, nyilasHossz: s.ny * px, vastagsag: s.v / s.n, pontok: s.pontok } as FalSzakasz; })
        .filter((s) => s.hossz >= 0.1).sort((a, b) => b.hossz - a.hossz),
    })),
  };
}
