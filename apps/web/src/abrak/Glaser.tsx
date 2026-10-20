import type { GlaserEredmeny } from '../paradiffuzio';
import { sz } from '../ui';

/**
 * Glaser-diagram a szerkezet vastagsága mentén: telítési gőznyomás (psat) és tényleges parciális gőznyomás (p);
 * a kondenzációs sík(ok) jelölve. Rétegek háttérsávokkal.
 */
export function GlaserAbra({ g, sdSkala = false }: { g: GlaserEredmeny; sdSkala?: boolean }) {
  const W = 640, H = 260, bal = 52, jobb = 14, fent = 14, lent = 34;
  const xMax = sdSkala ? g.sdOssz : g.pontok.at(-1)!.x;
  const pMax = Math.max(...g.pontok.map((t) => t.psat), g.pi) * 1.08;
  const X = (t: { x: number; sd: number }) => bal + ((sdSkala ? t.sd : t.x) / Math.max(xMax, 1e-9)) * (W - bal - jobb);
  const Y = (p: number) => fent + (1 - p / pMax) * (H - fent - lent);
  const ut = (k: 'psat' | 'p') => g.pontok.map((t, i) => `${i ? 'L' : 'M'}${X(t).toFixed(1)} ${Y(t[k]).toFixed(1)}`).join('');
  // réteghatárok
  const hatarok: { x: number; sd: number }[] = [{ x: 0, sd: 0 }];
  for (const r of g.retegek) { const e = hatarok.at(-1)!; hatarok.push({ x: e.x + r.dCm, sd: e.sd + r.sd }); }
  const lepes = pMax > 2500 ? 500 : pMax > 1200 ? 250 : 100;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style="width:100%;height:auto;display:block" role="img" aria-label="Glaser-diagram: telítési és tényleges gőznyomás a szerkezetben">
      {g.retegek.map((r, i) => (
        <g>
          <rect x={X(hatarok[i]!)} y={fent} width={Math.max(0, X(hatarok[i + 1]!) - X(hatarok[i]!))} height={H - fent - lent} fill={i % 2 ? 'var(--vonal-2)' : 'transparent'} opacity={0.6}><title>{`${r.nev}: d = ${sz(r.dCm, 1)} cm, μ = ${sz(r.mu, 0)}, sd = ${sz(r.sd, 2)} m`}</title></rect>
          <line x1={X(hatarok[i]!)} x2={X(hatarok[i]!)} y1={fent} y2={H - lent} stroke="var(--vonal)" stroke-width={1} />
          {(i === 0 || X(hatarok[i]!) - X(hatarok[i - 1]!) > 18) && <text x={X(hatarok[i]!)} y={H - lent + 12} font-size={9.5} text-anchor="middle" fill="var(--tus-3)">{sz(sdSkala ? hatarok[i]!.sd : hatarok[i]!.x, sdSkala ? 2 : 1)}</text>}
        </g>
      ))}
      {Array.from({ length: Math.floor(pMax / lepes) + 1 }, (_, k) => k * lepes).map((p) => (
        <g><line x1={bal} x2={W - jobb} y1={Y(p)} y2={Y(p)} stroke="var(--vonal-2)" stroke-width={0.6} /><text x={bal - 6} y={Y(p) + 3.5} font-size={10} text-anchor="end" fill="var(--tus-3)">{p}</text></g>
      ))}
      <text x={12} y={fent + (H - fent - lent) / 2} font-size={10} fill="var(--tus-3)" transform={`rotate(-90 12 ${fent + (H - fent - lent) / 2})`} text-anchor="middle">gőznyomás [Pa]</text>
      <text x={(bal + W - jobb) / 2} y={H - 6} font-size={10} fill="var(--tus-3)" text-anchor="middle">{sdSkala ? `egyenértékű légrétegvastagság sd [m] – összesen ${sz(g.sdOssz, 2)} m` : `vastagság [cm] – belső oldal bal, külső jobb`}</text>
      <text x={X(hatarok.at(-1)!)} y={H - lent + 12} font-size={9.5} text-anchor="end" fill="var(--tus-3)">{sz(sdSkala ? hatarok.at(-1)!.sd : hatarok.at(-1)!.x, sdSkala ? 2 : 1)}</text>
      <path d={ut('psat')} fill="none" stroke="#C2410C" stroke-width={2} />
      <path d={ut('p')} fill="none" stroke="#2E6DB4" stroke-width={2} />
      {g.kondenzacio.map((k) => {
        const t = g.pontok.reduce((m, u) => (Math.abs(u.sd - k.sd) < Math.abs(m.sd - k.sd) ? u : m));
        return <g><line x1={X(t)} x2={X(t)} y1={fent} y2={H - lent} stroke="#B91C1C" stroke-width={1.5} stroke-dasharray="4 3" /><circle cx={X(t)} cy={Y(t.psat)} r={4} fill="#B91C1C" /></g>;
      })}
      <g font-size={10.5}>
        <line x1={W - 200} x2={W - 184} y1={fent + 8} y2={fent + 8} stroke="#C2410C" stroke-width={2} /><text x={W - 180} y={fent + 11.5} fill="var(--tus-2)">telítési gőznyomás psat</text>
        <line x1={W - 200} x2={W - 184} y1={fent + 24} y2={fent + 24} stroke="#2E6DB4" stroke-width={2} /><text x={W - 180} y={fent + 27.5} fill="var(--tus-2)">parciális gőznyomás p</text>
      </g>
    </svg>
  );
}
