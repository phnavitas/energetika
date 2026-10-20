/**
 * Hőhíd-ábrák vásznon: csomópont-geometria (anyagszínekkel) és izotermás hőmérséklet-eloszlás
 * (színskála + 1 °C-onkénti izotermák, 5 °C-onként felirattal, a legalacsonyabb belső felületi hőmérséklet jelölve).
 */
import { izotermak, type Geometria, type Megoldas } from './szamito';

interface Nezet { s: number; ox: number; oy: number; W: number; H: number }
function nezet(g: Geometria, W: number, margo = 28): Nezet {
  const s = (W - 2 * margo) / (g.x1 - g.x0);
  const H = Math.round((g.y1 - g.y0) * s + 2 * margo + 30);
  return { s, ox: margo - g.x0 * s, oy: margo - g.y0 * s, W, H };
}
const px = (n: Nezet, x: number) => n.ox + x * n.s, py = (n: Nezet, y: number) => n.oy + y * n.s;

/** Kék → türkiz → zöld → sárga → piros skála, 0..1. */
export function homSzin(t: number): string {
  const c = [[49, 54, 149], [69, 117, 180], [116, 173, 209], [171, 217, 233], [224, 243, 248], [254, 224, 144], [253, 174, 97], [244, 109, 67], [215, 48, 39]];
  const u = Math.min(1, Math.max(0, t)) * (c.length - 1); const i = Math.min(c.length - 2, Math.floor(u)), f = u - i;
  const a = c[i]!, b = c[i + 1]!;
  return `rgb(${Math.round(a[0]! + (b[0]! - a[0]!) * f)},${Math.round(a[1]! + (b[1]! - a[1]!) * f)},${Math.round(a[2]! + (b[2]! - a[2]!) * f)})`;
}

function kontur(ctx: CanvasRenderingContext2D, g: Geometria, n: Nezet) {
  ctx.strokeStyle = 'rgba(20,20,20,0.75)'; ctx.lineWidth = 0.8;
  for (const e of g.elemek) { if (e.anyag === 'belso' || e.anyag === 'kulso') continue; ctx.strokeRect(px(n, e.x0), py(n, e.y0), (e.x1 - e.x0) * n.s, (e.y1 - e.y0) * n.s); }
}
function zonaFelirat(ctx: CanvasRenderingContext2D, g: Geometria, n: Nezet, thetaI?: number, thetaE?: number) {
  ctx.font = '600 12px system-ui, sans-serif';
  // mintavételezés: a legfelső (utolsó) lefedő elem dönt; a zóna a tőle legtávolabbi idegen ponttól legmesszebb eső mintánál kap feliratot
  const N = 36, pts: { x: number; y: number; z: string }[] = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = g.x0 + (i + 0.5) / N * (g.x1 - g.x0), y = g.y0 + (j + 0.5) / N * (g.y1 - g.y0);
    let z = ''; for (const e of g.elemek) if (x >= e.x0 && x <= e.x1 && y >= e.y0 && y <= e.y1) z = e.anyag;
    pts.push({ x, y, z });
  }
  for (const z of ['belso', 'kulso'] as const) {
    let best: { x: number; y: number } | null = null, bd = -1;
    for (const a of pts) { if (a.z !== z) continue; let d = Infinity; for (const b of pts) if (b.z !== z) d = Math.min(d, (a.x - b.x) ** 2 + (a.y - b.y) ** 2); if (d > bd) { bd = d; best = a; } }
    if (!best) continue;
    const e = { x0: best.x, x1: best.x, y0: best.y, y1: best.y };
    ctx.fillStyle = z === 'belso' ? '#9a3412' : '#1e3a8a';
    const txt = z === 'belso' ? `belső${thetaI !== undefined ? ` ${thetaI} °C` : ''}` : `külső${thetaE !== undefined ? ` ${thetaE} °C` : ''}`;
    const w = ctx.measureText(txt).width;
    const x = Math.min(Math.max(px(n, (e.x0 + e.x1) / 2) - w / 2, 4), n.W - w - 4), y = Math.min(Math.max(py(n, (e.y0 + e.y1) / 2), 16), n.H - 36);
    ctx.fillText(txt, x, y);
  }
}

/** A csomópont geometriája anyagszínekkel (paraméterező nézet és katalógus-ikon). */
export function geometriaRajz(cv: HTMLCanvasElement, g: Geometria, W = 520, felirat = true) {
  const n = nezet(g, W, felirat ? 28 : 6);
  const d = window.devicePixelRatio || 1;
  cv.width = W * d; cv.height = (felirat ? n.H : n.H - 30) * d; cv.style.width = '100%'; cv.style.maxWidth = `${W}px`;
  const ctx = cv.getContext('2d')!; ctx.scale(d, d);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, n.H);
  for (const e of g.elemek) {
    ctx.fillStyle = e.anyag === 'belso' ? '#FFF7ED' : e.anyag === 'kulso' ? '#EFF6FF' : g.anyagok[e.anyag]!.szin;
    ctx.fillRect(px(n, e.x0), py(n, e.y0), (e.x1 - e.x0) * n.s, (e.y1 - e.y0) * n.s);
  }
  kontur(ctx, g, n);
  if (felirat) {
    zonaFelirat(ctx, g, n);
    // jelmagyarázat
    ctx.font = '11px system-ui, sans-serif'; let x = 8; const y = n.H - 12;
    for (const a of Object.values(g.anyagok)) {
      ctx.fillStyle = a.szin; ctx.fillRect(x, y - 9, 10, 10); ctx.strokeStyle = '#333'; ctx.strokeRect(x, y - 9, 10, 10);
      ctx.fillStyle = '#333'; const t = `${a.nev} λ=${a.lambda.toLocaleString('hu-HU', { maximumFractionDigits: 3 })}`; ctx.fillText(t, x + 14, y); x += ctx.measureText(t).width + 26;
      if (x > W - 120) break;
    }
  }
}

/** Izotermás ábra (a megoldás hőmérsékletmezője). */
export function izotermRajz(cv: HTMLCanvasElement, g: Geometria, m: Megoldas, thetaI: number, thetaE: number, W = 640) {
  const n = nezet(g, W);
  const d = Math.max(1, window.devicePixelRatio || 1);
  cv.width = W * d; cv.height = n.H * d; cv.style.width = '100%'; cv.style.maxWidth = `${W}px`;
  const ctx = cv.getContext('2d')!; ctx.scale(d, d);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, n.H);
  const nx = m.xs.length - 1;
  for (let k = 0; k < m.T.length; k++) {
    const i = k % nx, j = (k / nx) | 0; const t = m.tipus[k]!;
    if (t === -1) continue;
    ctx.fillStyle = t === -2 ? '#FFF7ED' : t === -3 ? '#EFF6FF' : homSzin((m.T[k]! - thetaE) / (thetaI - thetaE));
    ctx.fillRect(px(n, m.xs[i]!), py(n, m.ys[j]!), (m.xs[i + 1]! - m.xs[i]!) * n.s + 0.6, (m.ys[j + 1]! - m.ys[j]!) * n.s + 0.6);
  }
  kontur(ctx, g, n);
  const lo = Math.ceil(thetaE), hi = Math.floor(thetaI);
  const szintek: number[] = []; for (let v = lo; v <= hi; v++) szintek.push(v);
  for (const iz of izotermak(m, szintek)) {
    const fo = iz.szint % 5 === 0;
    ctx.strokeStyle = fo ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.35)'; ctx.lineWidth = fo ? 1.2 : 0.6;
    ctx.beginPath();
    for (const [a, b, c, e] of iz.szakaszok) { ctx.moveTo(px(n, a), py(n, b)); ctx.lineTo(px(n, c), py(n, e)); }
    ctx.stroke();
    if (fo && iz.szakaszok.length) {
      const s = iz.szakaszok[Math.floor(iz.szakaszok.length / 2)]!;
      ctx.font = '600 10.5px system-ui, sans-serif'; const txt = `${iz.szint} °C`; const w = ctx.measureText(txt).width;
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(px(n, s[0]) - w / 2 - 2, py(n, s[1]) - 8, w + 4, 11);
      ctx.fillStyle = '#111'; ctx.fillText(txt, px(n, s[0]) - w / 2, py(n, s[1]) + 1);
    }
  }
  // legalacsonyabb belső felületi hőmérséklet
  ctx.fillStyle = '#B91C1C'; ctx.beginPath(); ctx.arc(px(n, m.hely[0]), py(n, m.hely[1]), 4.5, 0, Math.PI * 2); ctx.fill();
  zonaFelirat(ctx, g, n, thetaI, thetaE);
  // színskála
  const sx = 8, sy = n.H - 20, sw = Math.min(260, W - 200);
  for (let k = 0; k < sw; k++) { ctx.fillStyle = homSzin(k / sw); ctx.fillRect(sx + k, sy, 1, 8); }
  ctx.fillStyle = '#333'; ctx.font = '10.5px system-ui, sans-serif';
  ctx.fillText(`${thetaE} °C`, sx, sy - 3); const t2 = `${thetaI} °C`; ctx.fillText(t2, sx + sw - ctx.measureText(t2).width, sy - 3);
  ctx.fillStyle = '#B91C1C'; ctx.fillText(`● θsi,min = ${m.thetaSiMin.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} °C`, sx + sw + 14, sy + 8);
}
