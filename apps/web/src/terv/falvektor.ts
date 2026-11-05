/**
 * Vektoros falfelismerés: a fal a rajzon két párhuzamos vonal (a falsíkok) falvastagságnyi távolságra, köztük a fal
 * metszeti jele – színes / mintázatos kitöltés vagy a két vonal közé zárt sraffozás. Szögtől független (ferde fal
 * is), a méret a vonalak pontos helyéből adódik. A sáv a két vonal közös szakaszának azon részei, ahol a jel megvan.
 */
import type { Lap, Utvonal } from './kinyeres';

export interface FalSav {
  /** A sáv négy sarka (pt): a1 → a2 az egyik falsíkon, b2 → b1 a másikon. */
  pontok: [number, number][];
  /** Falvastagság (m). */
  vastag: number;
  /** Irány (fok, 0–180, lapirányban). */
  szog: number;
  /** A jel fajtája. */
  jel: 'kitoltes' | 'sraff';
}

type Sz = { x1: number; y1: number; x2: number; y2: number; u: Utvonal };

const feher = (s: string) => /^#(f[0-9a-f]){3}$/i.test(s);

function poliTerulet(p: number[]) { let a = 0; for (let i = 0; i + 3 < p.length; i += 2) a += p[i]! * p[i + 3]! - p[i + 2]! * p[i + 1]!; const n = p.length; if (n >= 6) a += p[n - 2]! * p[1]! - p[0]! * p[n - 1]!; return Math.abs(a / 2); }
function bennPoli(p: number[], x: number, y: number) {
  let be = false; const n = p.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) { const xi = p[2 * i]!, yi = p[2 * i + 1]!, xj = p[2 * j]!, yj = p[2 * j + 1]!; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) be = !be; }
  return be;
}

/**
 * Falsávok a lapon (vagy a megadott befoglalón belül). `mPerPt`: lépték (m / pt).
 */
export function falSavok(lap: Lap, mPerPt: number, bb?: [number, number, number, number]): FalSav[] { return falVektor(lap, mPerPt, bb).savok; }

/** Falsávok és a falsávok közti nyílások (ablak, ajtó: azonos falsíkpár két darabja közti rés, benne nyílászáró-rajzelemekkel). */
export function falVektor(lap: Lap, mPerPt: number, bb?: [number, number, number, number]): { savok: FalSav[]; nyilasok: [number, number][][] } {
  const benne = (u: Utvonal) => !bb || !(u.bbox[2] < bb[0] || u.bbox[0] > bb[2] || u.bbox[3] < bb[1] || u.bbox[1] > bb[3]);
  const hosszu: Sz[] = [], rovid: Sz[] = [];
  // kitöltött (nem fehér, vagy mintázatos) felületek: a fal metszeti jele
  const kit: { p: number[]; bb: [number, number, number, number] }[] = [];
  // fehér kitöltésű válaszfalmag: vékony (5–30 cm), hosszúkás (≥ 1 m és ≥ 4 × vastagság) kitöltés
  const fehérFalmag = (u: Utvonal) => u.pontok.length === 1 && (() => { const p = u.pontok[0]!; const A = poliTerulet(p) * mPerPt * mPerPt; let K = 0; for (let i = 0; i + 3 < p.length; i += 2) K += Math.hypot(p[i + 2]! - p[i]!, p[i + 3]! - p[i + 1]!); K = (K + Math.hypot(p[0]! - p[p.length - 2]!, p[1]! - p[p.length - 1]!)) * mPerPt; if (A <= 0 || K <= 0) return false; const v = 2 * A / K, L = K / 2 - v; return v >= 0.05 && v <= 0.3 && L >= Math.max(1, 4 * v); })();
  for (const u of lap.utvonalak) {
    if (!benne(u)) continue;
    const toltott = u.muvelet !== 'stroke';
    if (toltott && (u.minta || !feher(u.toltoSzin) || fehérFalmag(u))) {
      // nagy, zömök kitöltés (terep, burkolat, színezett helyiség) nem falmetszet: a „vastagsága” (2A/K) ≤ 0,9 m
      for (const p of u.pontok) {
        const A = poliTerulet(p) * mPerPt * mPerPt; let K = 0; for (let i = 0; i + 3 < p.length; i += 2) K += Math.hypot(p[i + 2]! - p[i]!, p[i + 3]! - p[i + 1]!); K *= mPerPt;
        // (a kis helyiség mintás / színezett padlókitöltése sem: a falmetszet ≤ 0,6 m vastag és ≥ 2,5 × olyan hosszú)
        if (A <= 0 || K <= 0 || 2 * A / K > 0.6 || K / 2 - 2 * A / K < 2.5 * (2 * A / K)) continue;
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (let i = 0; i + 1 < p.length; i += 2) { x0 = Math.min(x0, p[i]!); x1 = Math.max(x1, p[i]!); y0 = Math.min(y0, p[i + 1]!); y1 = Math.max(y1, p[i + 1]!); }
        kit.push({ p, bb: [x0, y0, x1, y1] });
      }
    }
    // a vonalak: a vonalas rajzelemek és a kitöltések körvonala is falsík lehet; a fehér vonal (takarás) nem
    if (u.muvelet !== 'fill' && feher(u.vonalSzin)) continue;
    for (const [pi, p] of u.pontok.entries()) {
      const n = p.length / 2;
      for (let i = 0; i < n; i++) {
        const j = i + 1; if (j >= n && !(u.zart[pi] || toltott)) break;
        const jj = j % n; if (jj === i) continue;
        const s: Sz = { x1: p[2 * i]!, y1: p[2 * i + 1]!, x2: p[2 * jj]!, y2: p[2 * jj + 1]!, u };
        const l = Math.hypot(s.x2 - s.x1, s.y2 - s.y1) * mPerPt;
        if (l >= 0.25) hosszu.push(s);
        if (l >= 0.02 && l < 1.0 && u.muvelet !== 'fill') rovid.push(s);
      }
    }
  }
  // burkolatminta (csempe, térkő, járólap): sok egybevágó, kis kitöltés egymás mellett – nem falmetszet
  {
    const kulcsK = (f: { p: number[] }) => { const A = poliTerulet(f.p) * mPerPt * mPerPt; let K = 0; const p = f.p; for (let i = 0; i + 3 < p.length; i += 2) K += Math.hypot(p[i + 2]! - p[i]!, p[i + 3]! - p[i + 1]!); return `${Math.round(A / 0.005)}|${Math.round(K * mPerPt / 0.04)}`; };
    const csop = new Map<string, number[]>(); kit.forEach((f, i) => { const k = kulcsK(f); const l = csop.get(k); if (l) l.push(i); else csop.set(k, [i]); });
    const minta = new Set<number>();
    for (const l of csop.values()) {
      if (l.length < 6) continue;
      for (const i of l) {
        const a = kit[i]!.bb; const cx = (a[0] + a[2]) / 2, cy = (a[1] + a[3]) / 2, d = 2.2 * Math.max(a[2] - a[0], a[3] - a[1]);
        let db = 0; for (const j of l) { if (j === i) continue; const b2 = kit[j]!.bb; if (Math.hypot((b2[0] + b2[2]) / 2 - cx, (b2[1] + b2[3]) / 2 - cy) <= d) db++; if (db >= 2) break; }
        if (db >= 2) minta.add(i);
      }
    }
    if (minta.size) { const m = kit.filter((_, i) => !minta.has(i)); kit.length = 0; kit.push(...m); }
  }
  // térbeli index: rövid szakaszok (sraff) és kitöltések
  const G = 0.5 / mPerPt; const rIdx = new Map<number, number[]>(), kIdx = new Map<number, number[]>();
  const kulcs = (gx: number, gy: number) => gx * 100003 + gy;
  rovid.forEach((s, k) => { const gx = Math.floor((s.x1 + s.x2) / 2 / G), gy = Math.floor((s.y1 + s.y2) / 2 / G); const kk = kulcs(gx, gy); const l = rIdx.get(kk); if (l) l.push(k); else rIdx.set(kk, [k]); });
  kit.forEach((f, k) => { for (let gx = Math.floor(f.bb[0] / G); gx <= Math.floor(f.bb[2] / G); gx++) for (let gy = Math.floor(f.bb[1] / G); gy <= Math.floor(f.bb[3] / G); gy++) { const kk = kulcs(gx, gy); const l = kIdx.get(kk); if (l) l.push(k); else kIdx.set(kk, [k]); } });
  const kitoltve = (x: number, y: number) => { for (const k of kIdx.get(kulcs(Math.floor(x / G), Math.floor(y / G))) ?? []) { const f = kit[k]!; if (x >= f.bb[0] && x <= f.bb[2] && y >= f.bb[1] && y <= f.bb[3] && bennPoli(f.p, x, y)) return true; } return false; };

  // irány szerinti csoportok (0,5°-os rekeszek)
  const szogOf = (s: Sz) => ((Math.atan2(s.y2 - s.y1, s.x2 - s.x1) * 180 / Math.PI) % 180 + 180) % 180;
  const rekesz = new Map<number, Sz[]>();
  for (const s of hosszu) { const k = Math.round(szogOf(s) * 2) % 360; const l = rekesz.get(k); if (l) l.push(s); else rekesz.set(k, [s]); }
  const ki: FalSav[] = [];
  // tollosztály (vonalvastagság + szín): a metszett fal síkjait a rajz egy (vagy néhány) tollal húzza – ahol a jeles
  // (kitöltött / sraffozott) falak síkjai is ezzel a tollal futnak, ott a jel nélküli (üres) vonalpár is fal
  const toll = (u: Utvonal) => (u.muvelet === 'fill' ? 'kit' : `${u.vastagsag.toFixed(2)}|${u.vonalSzin}`);
  const tollHossz = new Map<string, number>(), tollJel = new Map<string, number>();
  for (const s0 of hosszu) { const k = toll(s0.u); tollHossz.set(k, (tollHossz.get(k) ?? 0) + Math.hypot(s0.x2 - s0.x1, s0.y2 - s0.y1) * mPerPt); }
  const ures: { a: number; o0: number; o1: number; ca: number; cb: number; tk: string }[] = [];
  const LEPES = 0.05 / mPerPt; // a sáv menti mintavétel
  for (const [k, grp0] of rekesz) {
    const a = k / 2; const th = a * Math.PI / 180; const ux = Math.cos(th), uy = Math.sin(th), nx = -uy, ny = ux;
    // a ±0,5°-os szomszéd rekeszek vonalai is párok lehetnek
    const grp = [...grp0, ...(rekesz.get((k + 1) % 360) ?? []), ...(rekesz.get((k + 359) % 360) ?? [])];
    const pr = (s: Sz) => { const t1 = s.x1 * ux + s.y1 * uy, t2 = s.x2 * ux + s.y2 * uy; return { t0: Math.min(t1, t2), t1: Math.max(t1, t2), c: ((s.x1 + s.x2) / 2) * nx + ((s.y1 + s.y2) / 2) * ny, s }; };
    const A = grp0.map(pr), B = grp.map(pr).sort((p, q) => p.c - q.c);
    const cMin = 0.05 / mPerPt, cMax = 0.9 / mPerPt;
    for (const p of A) {
      // a partner a „pozitív” oldalon (így minden pár egyszer)
      let lo = 0, hi = B.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (B[m]!.c < p.c + cMin) lo = m + 1; else hi = m; }
      for (let j = lo; j < B.length && B[j]!.c <= p.c + cMax; j++) {
        const q = B[j]!; if (q.s === p.s) continue;
        const o0 = Math.max(p.t0, q.t0), o1 = Math.min(p.t1, q.t1);
        if ((o1 - o0) * mPerPt < 0.15) continue;
        const ca = p.c, cb = q.c, cm = (ca + cb) / 2, sz = cb - ca;
        // periodikus vonalsor (lépcsőfokok, parketta, burkolat, polc): a pár mindkét külső oldalán ugyanilyen távolságra újabb
        // párhuzamos vonal fut – nem fal
        { const tol2 = 0.015 / mPerPt; let mindket = 0;
          for (const c of [ca - sz, cb + sz]) { let lo2 = 0, hi2 = B.length; while (lo2 < hi2) { const m = (lo2 + hi2) >> 1; if (B[m]!.c < c - tol2) lo2 = m + 1; else hi2 = m; } for (let k2 = lo2; k2 < B.length && B[k2]!.c <= c + tol2; k2++) { const r2 = B[k2]!; if (Math.min(r2.t1, o1) - Math.max(r2.t0, o0) >= 0.5 * (o1 - o0)) { mindket++; break; } } }
          if (mindket === 2 && (globalThis as { PERIOD?: boolean }).PERIOD) continue; }
        // mintavétel a sáv mentén: kitöltés a sáv közepén, ill. a sávot átfogó sraffvonal
        const n = Math.max(1, Math.round((o1 - o0) / LEPES));
        const jel = new Uint8Array(n + 1); let kitDb = 0;
        for (let i = 0; i <= n; i++) {
          const t = o0 + (o1 - o0) * i / n;
          // két ponton (a sáv harmadainál) – a vékony vakolatréteg közepe sem esik ki
          const x = ux * t + nx * cm, y = uy * t + ny * cm;
          if (kitoltve(x, y)) { jel[i] = 1; kitDb++; }
        }
        const tol = Math.max(0.02 / mPerPt, 0.15 * sz); let srDb = 0;
        const latott = new Set<number>(); const merPoz: [number, number][] = [];
        const gx0 = Math.floor(Math.min(ux * o0 + nx * ca, ux * o1 + nx * ca, ux * o0 + nx * cb, ux * o1 + nx * cb) / G) - 1;
        const gx1 = Math.floor(Math.max(ux * o0 + nx * ca, ux * o1 + nx * ca, ux * o0 + nx * cb, ux * o1 + nx * cb) / G) + 1;
        const gy0 = Math.floor(Math.min(uy * o0 + ny * ca, uy * o1 + ny * ca, uy * o0 + ny * cb, uy * o1 + ny * cb) / G) - 1;
        const gy1 = Math.floor(Math.max(uy * o0 + ny * ca, uy * o1 + ny * ca, uy * o0 + ny * cb, uy * o1 + ny * cb) / G) + 1;
        if ((gx1 - gx0) * (gy1 - gy0) < 4000) for (let gx = gx0; gx <= gx1; gx++) for (let gy = gy0; gy <= gy1; gy++) for (const r of rIdx.get(kulcs(gx, gy)) ?? []) {
          if (latott.has(r)) continue; latott.add(r);
          const s = rovid[r]!;
          const e1 = s.x1 * nx + s.y1 * ny, e2 = s.x2 * nx + s.y2 * ny, f1 = s.x1 * ux + s.y1 * uy, f2 = s.x2 * ux + s.y2 * uy;
          const elo = Math.min(e1, e2), ehi = Math.max(e1, e2);
          // a sraffvonal a két falsík között fut, a végei a falsíkokon (a falmetszetre vágott minta)
          if (Math.abs(elo - ca) > tol || Math.abs(ehi - cb) > tol) continue;
          // a sraff ferde a falsíkhoz képest; a falsíkkal párhuzamos vagy pontosan merőleges vonal (burkolat-, csempe-, térkőrács
          // keresztvonala, lépcsőfok) nem sraff – a merőlegeshez közeli, de dőlt cikkcakk (ásványgyapot jele) igen
          const rel = (((Math.atan2(s.y2 - s.y1, s.x2 - s.x1) * 180 / Math.PI) - a) % 180 + 180) % 180;
          if (rel < 10 || rel > 170) continue;
          const meroleges = Math.abs(rel - 90) < 4;
          const fl = Math.min(f1, f2), fh = Math.max(f1, f2); if (fh < o0 - tol || fl > o1 + tol) continue;
          // a pontosan merőleges vonal (téglajel létrája, de csempe-, térkőrács is) csak sűrűn számít – lásd lent
          if (meroleges) { merPoz.push([Math.min(f1, f2), Math.max(f1, f2)]); continue; }
          srDb++;
          // a sraffvonal környezete (± 0,12 m a sáv mentén) jelzett
          const i0 = Math.max(0, Math.floor((fl - 0.12 / mPerPt - o0) / (o1 - o0) * n)), i1 = Math.min(n, Math.ceil((fh + 0.12 / mPerPt - o0) / (o1 - o0) * n));
          for (let i = i0; i <= i1; i++) jel[i] |= 2;
        }
        // merőleges „létra”: a fokok sűrűn (a közepes távolság ≤ a sávszélesség 60 %-a) – a négyzetes burkolatrács foka
        // a sávszélességnyire követik egymást
        if (merPoz.length >= 3) {
          merPoz.sort((p1, p2) => p1[0] - p2[0]);
          const tav = merPoz.slice(1).map((q, i) => q[0] - merPoz[i]![0]).filter((d) => d > 0.005 / mPerPt).sort((x, y) => x - y);
          if (tav.length && tav[tav.length >> 1]! <= 0.6 * sz) for (const [fl, fh] of merPoz) {
            srDb++;
            const i0 = Math.max(0, Math.floor((fl - 0.12 / mPerPt - o0) / (o1 - o0) * n)), i1 = Math.min(n, Math.ceil((fh + 0.12 / mPerPt - o0) / (o1 - o0) * n));
            for (let i = i0; i <= i1; i++) jel[i] |= 2;
          }
        }
        if (!kitDb && srDb < 2) {
          // jel nélküli vonalpár: azonos tollal húzott, falvastagságú (6–60 cm), legalább 0,3 m-es közös szakasz – a tollosztály
          // eldöntése után lehet fal
          const tk = toll(p.s.u);
          // (a periodikus vonalsor – parketta, burkolat, lépcső – nem fal: a pár valamelyik külső oldalán ugyanilyen
          // távolságra újabb párhuzamos vonal fut)
          const periodikus = () => { const tol2 = 0.015 / mPerPt; for (const c of [ca - sz, cb + sz]) { let lo2 = 0, hi2 = B.length; while (lo2 < hi2) { const m = (lo2 + hi2) >> 1; if (B[m]!.c < c - tol2) lo2 = m + 1; else hi2 = m; } for (let k2 = lo2; k2 < B.length && B[k2]!.c <= c + tol2; k2++) { const r2 = B[k2]!; if (Math.min(r2.t1, o1) - Math.max(r2.t0, o0) >= 0.5 * (o1 - o0)) return true; } } return false; };
          if (tk === toll(q.s.u) && tk !== 'kit' && sz * mPerPt >= 0.06 && sz * mPerPt <= 0.6 && (o1 - o0) * mPerPt >= 0.3 && !periodikus()) ures.push({ a, o0, o1, ca, cb, tk });
          continue;
        }
        { const tk = toll(p.s.u); if (tk === toll(q.s.u)) tollJel.set(tk, (tollJel.get(tk) ?? 0) + (o1 - o0) * mPerPt); }
        // a jelzett futamok (≥ 0,15 m) lesznek falsávok
        let i = 0;
        while (i <= n) {
          if (!jel[i]) { i++; continue; }
          let e = i; let fk = 0; while (e <= n && jel[e]) { if (jel[e]! & 1) fk++; e++; }
          const t0 = o0 + (o1 - o0) * i / n, t1 = o0 + (o1 - o0) * Math.min(n, e - 1) / n;
          if ((t1 - t0) * mPerPt >= 0.15) {
            const P = (t: number, c: number): [number, number] => [ux * t + nx * c, uy * t + ny * c];
            ki.push({ pontok: [P(t0, ca), P(t1, ca), P(t1, cb), P(t0, cb)], vastag: sz * mPerPt, szog: a, jel: fk > (e - i) / 2 ? 'kitoltes' : 'sraff' });
          }
          i = e;
        }
      }
    }
  }
  // a falsík-tollak: a vonalhosszuk legalább negyede jeles falpár része (és legalább 5 m)
  const sotet = (k: string) => { const m = /#(..)(..)(..)$/.exec(k); return !!m && (parseInt(m[1]!, 16) + parseInt(m[2]!, 16) + parseInt(m[3]!, 16)) / 3 < 100; };
  // (csak sötét toll: a világos-szürke vonalak burkolat-, parketta-, sraffrajzolatok)
  const falToll = new Set([...tollJel.entries()].filter(([k, l]) => sotet(k) && l >= 5 && l >= 0.25 * (tollHossz.get(k) ?? Infinity)).map(([k]) => k));
  if ((globalThis as { DBGTOLL?: boolean }).DBGTOLL) console.log('TOLL', [...tollHossz.entries()].map(([k, l]) => `${k}:${l.toFixed(0)}/${(tollJel.get(k) ?? 0).toFixed(0)}`).join(' '), [...falToll]);
  const uStat = new Map<string, number>();
  // (kikapcsolva: a tollosztály a parketta-, lépcső-, bútorvonalakat is falnak vette – helyette a falháló zárása kell)
  if ((globalThis as { TOLLFAL?: boolean }).TOLLFAL) for (const e of ures) {
    if (!falToll.has(e.tk)) continue;
    uStat.set(e.tk + '|' + Math.round((e.cb - e.ca) * mPerPt * 100), (uStat.get(e.tk + '|' + Math.round((e.cb - e.ca) * mPerPt * 100)) ?? 0) + (e.o1 - e.o0) * mPerPt);
    const th = e.a * Math.PI / 180; const ux = Math.cos(th), uy = Math.sin(th), nx = -uy, ny = ux;
    const P = (t: number, c: number): [number, number] => [ux * t + nx * c, uy * t + ny * c];
    ki.push({ pontok: [P(e.o0, e.ca), P(e.o1, e.ca), P(e.o1, e.cb), P(e.o0, e.cb)], vastag: (e.cb - e.ca) * mPerPt, szog: e.a, jel: 'sraff' });
  }
  if ((globalThis as { DBGTOLL?: boolean }).DBGTOLL) console.log('USTAT', [...uStat.entries()].sort((x, y) => y[1] - x[1]).slice(0, 25).map(([k, v]) => k + ':' + v.toFixed(0)).join(' '));
  const savok = halozat(ki, mPerPt);
  // nyílások: azonos falsíkpár (irány ±1°, mindkét falsík ±2 cm) egymást követő darabjai közti 0,3–3 m-es rés, ha a résben
  // legalább két rajzelem (tok, üvegezés, ajtólap, küszöb) van – az üres rés átjáró / falvég
  const nyilasok: [number, number][][] = [];
  const csop = new Map<string, { t0: number; t1: number; ca: number; cb: number; a: number }[]>();
  for (const f of savok) {
    if (f.vastag < 0.08) continue;
    const th = f.szog * Math.PI / 180; const ux = Math.cos(th), uy = Math.sin(th), nx = -uy, ny = ux;
    const t0 = f.pontok[0]![0] * ux + f.pontok[0]![1] * uy, t1 = f.pontok[1]![0] * ux + f.pontok[1]![1] * uy;
    const ca = f.pontok[0]![0] * nx + f.pontok[0]![1] * ny, cb = f.pontok[3]![0] * nx + f.pontok[3]![1] * ny;
    const k = `${Math.round(f.szog)}|${Math.round(ca * mPerPt / 0.04)}|${Math.round(cb * mPerPt / 0.04)}`;
    const l = csop.get(k); const e = { t0: Math.min(t0, t1), t1: Math.max(t0, t1), ca, cb, a: f.szog }; if (l) l.push(e); else csop.set(k, [e]);
  }
  const elemekBenne = (P: [number, number][]) => {
    let db = 0; const xs = P.map((q) => q[0]), ys = P.map((q) => q[1]);
    for (let gx = Math.floor(Math.min(...xs) / G); gx <= Math.floor(Math.max(...xs) / G); gx++) for (let gy = Math.floor(Math.min(...ys) / G); gy <= Math.floor(Math.max(...ys) / G); gy++)
      for (const r of rIdx.get(kulcs(gx, gy)) ?? []) { const q = rovid[r]!; const mx = (q.x1 + q.x2) / 2, my = (q.y1 + q.y2) / 2; if (bennPoli(P.flat(), mx, my)) db++; }
    return db;
  };
  for (const l of csop.values()) {
    l.sort((p, q) => p.t0 - q.t0);
    let veg = -Infinity, elozo: (typeof l)[number] | null = null;
    for (const e of l) {
      if (elozo && e.t0 > veg) {
        const g = (e.t0 - veg) * mPerPt;
        if (g >= 0.3 && g <= 3.0) {
          const th = e.a * Math.PI / 180; const ux = Math.cos(th), uy = Math.sin(th), nx = -uy, ny = ux;
          const P = (t: number, c: number): [number, number] => [ux * t + nx * c, uy * t + ny * c];
          const Q = [P(veg, e.ca), P(e.t0, e.ca), P(e.t0, e.cb), P(veg, e.cb)];
          // ajtónyi (≤ 1,3 m) rés mindig áthidalt (az ajtólap, nyitásív a falsávon kívül fut); a szélesebb csak rajzelemmel
          if (g <= 1.3 || elemekBenne(Q) >= 2) nyilasok.push(Q);
        }
      }
      if (e.t1 > veg) { veg = e.t1; elozo = e; }
    }
  }
  return { savok, nyilasok };
}

/** Két konvex négyszög metszi-e egymást (vagy `tav` pt-n belül vannak) – elválasztó tengelyekkel. */
function erint(a: [number, number][], b: [number, number][], tav: number): boolean {
  for (const P of [a, b]) for (let i = 0; i < 4; i++) {
    const p = P[i]!, q = P[(i + 1) % 4]!; const nx = -(q[1] - p[1]), ny = q[0] - p[0]; const l = Math.hypot(nx, ny) || 1;
    let amin = Infinity, amax = -Infinity, bmin = Infinity, bmax = -Infinity;
    for (const v of a) { const d = (v[0] * nx + v[1] * ny) / l; amin = Math.min(amin, d); amax = Math.max(amax, d); }
    for (const v of b) { const d = (v[0] * nx + v[1] * ny) / l; bmin = Math.min(bmin, d); bmax = Math.max(bmax, d); }
    if (amax + tav < bmin || bmax + tav < amin) return false;
  }
  return true;
}

/**
 * A falhálózat: az egymást érintő sávok összefüggő csoportjai. A kis, magányos csoport (bútor, lépcsőfok, jelkulcs) nem
 * fal – kivéve, ha egy megtartott fal egyenesébe esik (nyílások közti falpillér).
 */
function halozat(s: FalSav[], mPerPt: number): FalSav[] {
  const n = s.length; const G = 2 / mPerPt; const idx = new Map<number, number[]>();
  const bb = s.map((f) => { const xs = f.pontok.map((p) => p[0]), ys = f.pontok.map((p) => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as const; });
  bb.forEach((b, i) => { for (let gx = Math.floor(b[0] / G); gx <= Math.floor(b[2] / G); gx++) for (let gy = Math.floor(b[1] / G); gy <= Math.floor(b[3] / G); gy++) { const k = gx * 100003 + gy; const l = idx.get(k); if (l) l.push(i); else idx.set(k, [i]); } });
  const apa = Array.from({ length: n }, (_, i) => i); const gy = (i: number): number => { while (apa[i] !== i) { apa[i] = apa[apa[i]!]!; i = apa[i]!; } return i; };
  const tol = 0.02 / mPerPt;
  for (const l of idx.values()) for (let x = 0; x < l.length; x++) for (let y = x + 1; y < l.length; y++) {
    const i = l[x]!, j = l[y]!; if (gy(i) === gy(j)) continue;
    const A = bb[i]!, B = bb[j]!; if (A[2] + tol < B[0] || B[2] + tol < A[0] || A[3] + tol < B[1] || B[3] + tol < A[1]) continue;
    if (erint(s[i]!.pontok, s[j]!.pontok, tol)) apa[gy(i)] = gy(j);
  }
  const csop = new Map<number, number[]>(); for (let i = 0; i < n; i++) { const g = gy(i); const l = csop.get(g); if (l) l.push(i); else csop.set(g, [i]); }
  const tart = new Uint8Array(n);
  for (const l of csop.values()) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, hossz = 0;
    for (const i of l) { const b = bb[i]!; x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); const p = s[i]!.pontok; hossz += Math.hypot(p[1]![0] - p[0]![0], p[1]![1] - p[0]![1]) * mPerPt; }
    const kiterj = Math.max(x1 - x0, y1 - y0) * mPerPt;
    if (kiterj >= 2.5 && hossz >= 3) for (const i of l) tart[i] = 1;
  }
  // magányos falpillér: egy megtartott sáv egyenesébe esik (azonos irány, a két falsík ±3 cm-en belül), 4 m-en belül
  const egyenes = s.map((f) => { const th = f.szog * Math.PI / 180; const nx = -Math.sin(th), ny = Math.cos(th); const c1 = f.pontok[0]![0] * nx + f.pontok[0]![1] * ny, c2 = f.pontok[3]![0] * nx + f.pontok[3]![1] * ny; return [Math.min(c1, c2), Math.max(c1, c2)] as const; });
  const t3 = 0.03 / mPerPt, t4 = 4 / mPerPt;
  for (let i = 0; i < n; i++) {
    if (tart[i]) continue;
    const b = bb[i]!;
    for (let gx = Math.floor((b[0] - t4) / G); gx <= Math.floor((b[2] + t4) / G) && !tart[i]; gx++) for (let gyy = Math.floor((b[1] - t4) / G); gyy <= Math.floor((b[3] + t4) / G) && !tart[i]; gyy++)
      for (const j of idx.get(gx * 100003 + gyy) ?? []) {
        if (!tart[j] || Math.abs(s[j]!.szog - s[i]!.szog) > 1 && Math.abs(Math.abs(s[j]!.szog - s[i]!.szog) - 180) > 1) continue;
        // azonos falsíkok (a pillér a fal teljes vastagságában, vagy annak egy rétegében)
        const [a0, a1] = egyenes[i]!, [b0, b1] = egyenes[j]!;
        if (Math.abs(a0 - b0) <= t3 || Math.abs(a1 - b1) <= t3) { tart[i] = 2; break; }
      }
  }
  return s.filter((_, i) => tart[i]);
}
