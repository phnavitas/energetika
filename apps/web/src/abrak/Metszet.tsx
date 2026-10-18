/**
 * Rétegrend metszet: a rétegek arányos vastagsággal, szabványos jellegű sraffozással, rajta az állandósult
 * hőmérséklet-lefutás (hideg → meleg színátmenet) és a 0 °C-os sík helye.
 */
import { useState } from 'preact/hooks';
import { anyag, type Sraffozas } from '../katalogus';
import { homersekletLefutas, type Retegrend } from '../modell';
import { sz } from '../ui';

const W = 600, H = 300, BAL = 58, JOBB = 58, FENT = 30, LENT = 62;

function Mintak() {
  const s = 'var(--sraff)';
  return (
    <defs>
      <pattern id="p-falazat" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="7" stroke={s} stroke-width="1" />
      </pattern>
      <pattern id="p-beton" width="14" height="14" patternUnits="userSpaceOnUse">
        <circle cx="3" cy="4" r="0.9" fill={s} /><circle cx="10" cy="9" r="0.9" fill={s} /><circle cx="6" cy="12" r="0.6" fill={s} />
        <path d="M9 2 l2.5 3.5 h-5z" fill="none" stroke={s} stroke-width="0.7" />
      </pattern>
      <pattern id="p-hoszigeteles_hab" width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill="var(--sraff-hab)" opacity="0.45" />
        <path d="M0 8 L8 0 M0 0 L8 8" stroke={s} stroke-width="0.4" opacity="0.6" />
      </pattern>
      <pattern id="p-hoszigeteles_szalas" width="12" height="10" patternUnits="userSpaceOnUse">
        <rect width="12" height="10" fill="var(--sraff-hab)" opacity="0.3" />
        <path d="M0 5 Q3 0 6 5 T12 5" fill="none" stroke={s} stroke-width="0.8" />
      </pattern>
      <pattern id="p-vakolat" width="5" height="5" patternUnits="userSpaceOnUse">
        <circle cx="1.5" cy="1.5" r="0.55" fill={s} /><circle cx="4" cy="3.8" r="0.45" fill={s} />
      </pattern>
      <pattern id="p-fa" width="16" height="12" patternUnits="userSpaceOnUse">
        <path d="M0 3 Q8 0 16 3 M0 8 Q8 5 16 8" fill="none" stroke={s} stroke-width="0.7" />
      </pattern>
      <pattern id="p-burkolat" width="4" height="10" patternUnits="userSpaceOnUse">
        <line x1="2" y1="0" x2="2" y2="10" stroke={s} stroke-width="0.6" />
      </pattern>
      <linearGradient id="g-ho" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="var(--meleg)" /><stop offset="1" stop-color="var(--hideg)" />
      </linearGradient>
    </defs>
  );
}

export function Metszet(p: { r: Retegrend; thetaI?: number; thetaE?: number; kijelolt?: string | null; jelol?: (id: string | null) => void }) {
  const thetaI = p.thetaI ?? 20, thetaE = p.thetaE ?? -13;
  const [hover, setHover] = useState<number | null>(null);
  if (!p.r.retegek.length) {
    return <div class="metszet halk" style="padding:40px 0;text-align:center">Adj hozzá rétegeket – a metszet és a hőmérséklet-lefutás itt jelenik meg.</div>;
  }
  let lef: ReturnType<typeof homersekletLefutas>;
  try { lef = homersekletLefutas(p.r, thetaI, thetaE); } catch (e) {
    return <div class="hiba-doboz">{(e as Error).message}</div>;
  }

  // Vékony rétegek is látszódjanak: minimum 6 px, a maradék arányosan.
  const teljes = W - BAL - JOBB;
  const d = p.r.retegek.map((x) => x.dCm);
  const ossz = d.reduce((a, b) => a + b, 0);
  const minPx = 6;
  const vekonyak = d.filter((x) => (x / ossz) * teljes < minPx).length;
  const maradek = teljes - vekonyak * minPx;
  const vastagOssz = d.filter((x) => (x / ossz) * teljes >= minPx).reduce((a, b) => a + b, 0);
  const szel = d.map((x) => ((x / ossz) * teljes < minPx ? minPx : (x / vastagOssz) * maradek));
  const xPoz: number[] = [BAL];
  szel.forEach((w, i) => xPoz.push(xPoz[i]! + w));

  const tMin = Math.min(thetaE, ...lef.pontok.map((q) => q.theta)) - 2;
  const tMax = Math.max(thetaI, ...lef.pontok.map((q) => q.theta)) + 2;
  const y = (t: number) => FENT + ((tMax - t) / (tMax - tMin)) * (H - FENT - LENT);
  const vonal = [`M 8 ${y(thetaI)}`, `L ${BAL} ${y(lef.pontok[0]!.theta)}`, ...lef.pontok.map((q, i) => `L ${xPoz[i]} ${y(q.theta)}`), `L ${W - 8} ${y(thetaE)}`].join(' ');

  // 0 °C metszéspont
  let fagyX: number | null = null;
  for (let i = 0; i < lef.pontok.length - 1; i++) {
    const a = lef.pontok[i]!.theta, b = lef.pontok[i + 1]!.theta;
    if (a >= 0 && b < 0) fagyX = xPoz[i]! + ((a - 0) / (a - b)) * (xPoz[i + 1]! - xPoz[i]!);
  }

  return (
    <div class="metszet" style="position:relative">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Rétegrend metszet: ${p.r.retegek.length} réteg, felületi hőmérséklet belül ${sz(lef.thetaSi, 1)} °C`}>
        <Mintak />
        {/* belső / külső tér */}
        <rect x="0" y={FENT} width={BAL} height={H - FENT - LENT} fill="var(--meleg)" opacity="0.07" />
        <rect x={W - JOBB} y={FENT} width={JOBB} height={H - FENT - LENT} fill="var(--hideg)" opacity="0.08" />
        <text x={BAL / 2} y={H - LENT + 20} text-anchor="middle" font-size="13" fill="var(--tus-2)">belül</text>
        <text x={W - JOBB / 2} y={H - LENT + 20} text-anchor="middle" font-size="13" fill="var(--tus-2)">{p.r.kulsoOldal === 'futetlen' ? 'fűtetlen' : 'kívül'}</text>
        <text x={BAL / 2} y={FENT - 10} text-anchor="middle" font-size="13" fill="var(--meleg)" font-weight="650">{sz(thetaI, 0)} °C</text>
        <text x={W - JOBB / 2} y={FENT - 10} text-anchor="middle" font-size="13" fill="var(--hideg)" font-weight="650">{sz(thetaE, 0)} °C</text>

        {p.r.retegek.map((x, i) => {
          const a = anyag(x.anyagId);
          const sraff: Sraffozas = x.legreteg ? 'legreteg' : a?.sraffozas ?? 'vakolat';
          const kij = p.kijelolt === x.id || hover === i;
          return (
            <g onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => p.jelol?.(x.id)} style="cursor:pointer">
              <rect x={xPoz[i]} y={FENT} width={szel[i]} height={H - FENT - LENT} fill="var(--lap)" />
              {sraff === 'folia'
                ? <rect x={xPoz[i]! + szel[i]! / 2 - 1.5} y={FENT} width="3" height={H - FENT - LENT} fill="var(--sraff)" />
                : sraff !== 'legreteg' && <rect x={xPoz[i]} y={FENT} width={szel[i]} height={H - FENT - LENT} fill={`url(#p-${sraff})`} />}
              <rect x={xPoz[i]} y={FENT} width={szel[i]} height={H - FENT - LENT} fill={kij ? 'var(--hideg)' : 'none'} fill-opacity="0.12" stroke="var(--tus)" stroke-width={kij ? 1.6 : 0.8} />
              {szel[i]! >= 14 && <text x={xPoz[i]! + szel[i]! / 2} y={H - LENT + 20} text-anchor="middle" font-size="13" fill="var(--tus-2)">{i + 1}</text>}
              {szel[i]! >= 40 && <text x={xPoz[i]! + szel[i]! / 2} y={H - LENT + 37} text-anchor="middle" font-size="12" fill="var(--tus-3)">{sz(x.dCm, x.dCm < 1 ? 1 : 0)} cm</text>}
            </g>
          );
        })}

        {fagyX !== null && (
          <g>
            <line x1={fagyX} x2={fagyX} y1={FENT} y2={H - LENT} stroke="var(--hideg)" stroke-dasharray="3 3" stroke-width="1" />
            <text x={fagyX} y={H - LENT + 54} text-anchor="middle" font-size="12" fill="var(--hideg)">0 °C</text>
          </g>
        )}
        <path d={vonal} fill="none" stroke="url(#g-ho)" stroke-width="2.5" stroke-linejoin="round" />
        {lef.pontok.map((q, i) => <circle cx={xPoz[i]} cy={y(q.theta)} r="3" fill="var(--lap)" stroke="var(--tus)" stroke-width="1.2" />)}
      </svg>
      {hover !== null && (() => {
        const x = p.r.retegek[hover]!;
        const a = anyag(x.anyagId);
        const t0 = lef.pontok[hover]!.theta, t1 = lef.pontok[hover + 1]!.theta;
        return (
          <div class="tooltip" style={`left:${((xPoz[hover]! + szel[hover]! / 2) / W) * 100}%;top:${(FENT / H) * 100}%`}>
            {x.nev ?? a?.nev}, {sz(x.dCm, 1)} cm, R = {sz(lef.eredmeny.retegR[hover], 3)} m²K/W, {sz(t0, 1)} … {sz(t1, 1)} °C
          </div>
        );
      })()}
    </div>
  );
}
