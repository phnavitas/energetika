/**
 * Rajzstílustól független falfelismerés a kirenderelt lapképből („tinta”): ami a képen sötét / szürke, az tinta;
 * a feliratokat kitakarjuk, a sraffozás, téglaminta vonalai közét kitöltjük (zárás), a vékony vonalakat (bútor,
 * méretvonal, ajtóív) eltávolítjuk (nyitás), végül a 0,9 m-nél vastagabb foltokat (színezett padló, lépcső, terep)
 * kivonjuk. Ami marad: falvastagságú tintasávok – kitöltéssel, sraffozással, mintával vagy vastag vonallal rajzolt
 * falak egyaránt.
 */
import type { Szoveg } from './kinyeres';

export interface TintaKep { w: number; h: number; /** 1 pt hány képpont */ ptPx: number; adat: Uint8Array }

function tagit(m: Uint8Array, w: number, h: number, r: number): Uint8Array {
  if (r <= 0) return m.slice();
  const t = new Uint8Array(w * h), k = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let u = -Infinity;
    for (let x = 0; x < w; x++) { if (m[y * w + x]) u = x; if (x - u <= r) t[y * w + x] = 1; }
    u = Infinity;
    for (let x = w - 1; x >= 0; x--) { if (m[y * w + x]) u = x; if (u - x <= r) t[y * w + x] = 1; }
  }
  for (let x = 0; x < w; x++) {
    let u = -Infinity;
    for (let y = 0; y < h; y++) { if (t[y * w + x]) u = y; if (y - u <= r) k[y * w + x] = 1; }
    u = Infinity;
    for (let y = h - 1; y >= 0; y--) { if (t[y * w + x]) u = y; if (u - y <= r) k[y * w + x] = 1; }
  }
  return k;
}
const neg = (m: Uint8Array) => m.map((v) => (v ? 0 : 1)) as Uint8Array;
const szukit = (m: Uint8Array, w: number, h: number, r: number) => neg(tagit(neg(m), w, h, r));

/**
 * Falmaszk a raszter rácsán. `x0, y0`: a rács bal felső sarka (pt), `ptPx`: rácspont / pt, `px`: rácsméret (m).
 */
export function tintaFal(kep: TintaKep, x0: number, y0: number, ptPx: number, w: number, h: number, px: number, szovegek: Szoveg[], kuszob = 200): Uint8Array {
  const m = new Uint8Array(w * h);
  // mintavétel: a rácscella alá eső képpontok legsötétebbje (a vékony vonal se vesszen el)
  const k = kep.ptPx / ptPx; // képpont / rácspont
  const n = Math.max(1, Math.round(k));
  for (let gy = 0; gy < h; gy++) for (let gx = 0; gx < w; gx++) {
    const ix0 = Math.floor((x0 + gx / ptPx) * kep.ptPx), iy0 = Math.floor((y0 + gy / ptPx) * kep.ptPx);
    let min = 255;
    for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) {
      const ix = ix0 + dx, iy = iy0 + dy; if (ix < 0 || iy < 0 || ix >= kep.w || iy >= kep.h) continue;
      const v = kep.adat[iy * kep.w + ix]!; if (v < min) min = v;
    }
    if (min < kuszob) m[gy * w + gx] = 1;
  }
  // feliratok kitakarása (a szöveg sűrű tinta – zárás után falnak látszana)
  for (const t of szovegek) {
    const th = (t.szog * Math.PI) / 180, c = Math.cos(th), s = Math.sin(th);
    const pts = [[0, 0.25], [t.szel, 0.25], [t.szel, -1.05], [0, -1.05]].map(([a, b]) => [t.x + a! * c + b! * t.meret * s, t.y - a! * s + b! * t.meret * c]);
    const bx0 = Math.min(...pts.map((p) => p[0]!)), bx1 = Math.max(...pts.map((p) => p[0]!)), by0 = Math.min(...pts.map((p) => p[1]!)), by1 = Math.max(...pts.map((p) => p[1]!));
    for (let gy = Math.max(0, Math.floor((by0 - y0) * ptPx)); gy <= Math.min(h - 1, Math.ceil((by1 - y0) * ptPx)); gy++)
      for (let gx = Math.max(0, Math.floor((bx0 - x0) * ptPx)); gx <= Math.min(w - 1, Math.ceil((bx1 - x0) * ptPx)); gx++) m[gy * w + gx] = 0;
  }
  const R = (mm: number) => Math.max(1, Math.round(mm / px));
  // zárás: a sraffozás / minta vonalai közének kitöltése (≈ 12 cm-es résekig)
  let f = szukit(tagit(m, w, h, R(0.06)), w, h, R(0.06));
  // nyitás: a 9 cm-nél vékonyabb vonalak, apró jelek kiesnek
  f = tagit(szukit(f, w, h, R(0.045)), w, h, R(0.045));
  // a 0,9 m-nél vastagabb foltok (színezett padló, lépcső, terep, burkolat) nem falak
  const vastag = tagit(szukit(f, w, h, R(0.45)), w, h, R(0.45) + 1);
  for (let i = 0; i < w * h; i++) if (vastag[i]) f[i] = 0;
  // apró maradványok (≤ 0,15 m²): bútor, jel
  const lat = new Uint8Array(w * h); const min = 0.15 / (px * px);
  for (let i = 0; i < w * h; i++) {
    if (!f[i] || lat[i]) continue;
    const komp = [i]; lat[i] = 1;
    for (let q = 0; q < komp.length; q++) {
      const p = komp[q]!, x = p % w;
      for (const nb of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) if (nb >= 0 && nb < w * h && f[nb] && !lat[nb]) { lat[nb] = 1; komp.push(nb); }
    }
    if (komp.length < min) for (const p of komp) f[p] = 0;
  }
  return f;
}
