/**
 * A hőburok térbeli (axonometrikus) ábrája: szintenként a hőburok-körvonal a szintmagassággal kihúzva, a homlokzati
 * nyílászárókkal. Egérrel (érintéssel) forgatható. Csak szemléltetés – a számítás a körvonal éleiből és a feliratokból megy.
 */
import { useState } from 'preact/hooks';

export interface Burok3DSzint {
  nev: string;
  /** Körvonalak méterben (x jobbra, y lefelé a lapon). */
  poligonok: [number, number][][];
  z0: number; h: number;
  nyilasok: { x: number; y: number; szel: number; mag: number; pm: number }[];
}

type P3 = [number, number, number];

export function Burok3D({ szintek, eszakSzog }: { szintek: Burok3DSzint[]; eszakSzog: number }) {
  const [forg, setForg] = useState(-35);
  const [dol, setDol] = useState(32);
  const [huz, setHuz] = useState<{ x: number; y: number; f: number; d: number } | null>(null);
  if (!szintek.length || !szintek.some((s) => s.poligonok.length)) return null;
  // középpont
  const pts = szintek.flatMap((s) => s.poligonok.flat());
  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  const a = (forg * Math.PI) / 180, t = (dol * Math.PI) / 180;
  const vet = ([x, y, z]: P3): [number, number, number] => {
    const X = (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a);
    const Y = (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a); // mélység (a néző felé nő)
    return [X, -z * Math.cos(t) + Y * Math.sin(t), Y * Math.cos(t) + z * Math.sin(t)];
  };
  type Lap = { pts: [number, number][]; mely: number; szin: string; vonal: string; atl?: number };
  const lapok: Lap[] = [];
  const fenyIrany = [-0.5, -0.7]; // a lap síkjában (bal felülről)
  for (const s of szintek) {
    for (const p of s.poligonok) {
      const z1 = s.z0 + s.h;
      // falak
      for (let i = 0; i < p.length; i++) {
        const A = p[i]!, B = p[(i + 1) % p.length]!;
        const q: P3[] = [[A[0], A[1], s.z0], [B[0], B[1], s.z0], [B[0], B[1], z1], [A[0], A[1], z1]];
        const v = q.map(vet);
        const dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy) || 1;
        const fe = Math.max(0, (dy / l) * fenyIrany[0]! + (-dx / l) * fenyIrany[1]!);
        const g = Math.round(205 + fe * 40);
        lapok.push({ pts: v.map((w) => [w[0], w[1]]), mely: v.reduce((m, w) => m + w[2], 0) / 4, szin: `rgb(${g},${g - 6},${g - 18})`, vonal: '#8B7E66' });
        // nyílászárók erre az élre
        for (const n of s.nyilasok) {
          const tt = ((n.x - A[0]) * dx + (n.y - A[1]) * dy) / (l * l);
          const dist = Math.abs((n.x - A[0]) * dy - (n.y - A[1]) * dx) / l;
          if (tt < 0 || tt > 1 || dist > 2.5) continue;
          const h0 = Math.min(Math.max(n.pm, 0), s.h - 0.3), h1 = Math.min(h0 + n.mag, s.h);
          const t0 = Math.max(0, tt - n.szel / 2 / l), t1 = Math.min(1, tt + n.szel / 2 / l);
          const e = 0.03; // a fal elé
          const nx = (dy / l) * e, ny = (-dx / l) * e;
          const w: P3[] = [[A[0] + dx * t0 + nx, A[1] + dy * t0 + ny, s.z0 + h0], [A[0] + dx * t1 + nx, A[1] + dy * t1 + ny, s.z0 + h0], [A[0] + dx * t1 + nx, A[1] + dy * t1 + ny, s.z0 + h1], [A[0] + dx * t0 + nx, A[1] + dy * t0 + ny, s.z0 + h1]];
          const wv = w.map(vet);
          lapok.push({ pts: wv.map((u) => [u[0], u[1]]), mely: wv.reduce((m, u) => m + u[2], 0) / 4 + 0.01, szin: '#7DB7E8', vonal: '#2F6FA8' });
        }
      }
      // födém (felülnézet)
      const fv = p.map(([x, y]) => vet([x, y, z1]));
      lapok.push({ pts: fv.map((w) => [w[0], w[1]]), mely: fv.reduce((m, w) => m + w[2], 0) / fv.length - 0.5, szin: '#EDE9FE', vonal: '#7C3AED', atl: 0.85 });
    }
  }
  lapok.sort((x, y) => x.mely - y.mely);
  const xs = lapok.flatMap((l) => l.pts.map((p) => p[0])), ys = lapok.flatMap((l) => l.pts.map((p) => p[1]));
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = Math.max(maxX - minX, maxY - minY) * 0.06;
  // északjel a lap síkjában: az eszakSzog a lapon felfelé mért irány
  const er = (eszakSzog * Math.PI) / 180, ex = Math.sin(er), ey = -Math.cos(er);
  const e0 = vet([cx, cy, 0]), e1 = vet([cx + ex * 3, cy + ey * 3, 0]);
  return (
    <div class="kartya" style="padding:8px">
      <div class="gombsor" style="justify-content:space-between;align-items:center">
        <strong>Hőburok térben</strong>
        <span class="halkabb" style="font-size:12px">Húzással forgatható · {szintek.length} szint · lila: födém / tető, kék: nyílászárók</span>
      </div>
      <svg viewBox={`${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}`} style="width:100%;height:auto;max-height:520px;touch-action:none;cursor:grab;background:#FAFAF9"
        onPointerDown={(e) => { (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId); setHuz({ x: e.clientX, y: e.clientY, f: forg, d: dol }); }}
        onPointerMove={(e) => { if (!huz) return; setForg(huz.f + (e.clientX - huz.x) * 0.5); setDol(Math.max(5, Math.min(85, huz.d - (e.clientY - huz.y) * 0.3))); }}
        onPointerUp={() => setHuz(null)}>
        {lapok.map((l) => <polygon points={l.pts.map((p) => p.join(',')).join(' ')} fill={l.szin} fill-opacity={l.atl ?? 1} stroke={l.vonal} stroke-width={0.04} stroke-linejoin="round" />)}
        <line x1={e0[0]} y1={e0[1]} x2={e1[0]} y2={e1[1]} stroke="#B91C1C" stroke-width={0.15} />
        <text x={e1[0]} y={e1[1]} font-size={1.2} fill="#B91C1C" font-weight="700" font-family="system-ui">É</text>
      </svg>
    </div>
  );
}
