import { useState } from 'preact/hooks';
import { kovetelmeny, type ZonaEredmeny } from '@mag/index';
import { sz } from '../ui';

// A skála színei szemléltetők (zöldtől a vörösig), nem a tanúsítvány hivatalos színkódjai.
const SZINEK = ['#1E7A46', '#2F8F4E', '#4AA145', '#7DB33A', '#B5BE2E', '#D9B526', '#E39A22', '#E07B21', '#D65A22', '#C63D24', '#A92A25', '#842022'];

export function Osztalyskala({ osztaly, szazalek, cim }: { osztaly: string; szazalek: number; cim: string }) {
  const H = kovetelmeny.BESOROLAS_HATAROK;
  return (
    <figure style="margin:0">
      <figcaption class="halkabb" style="margin-bottom:8px">{cim}</figcaption>
      <div class="skala" role="img" aria-label={`${cim}: ${osztaly} osztály, a követelmény ${sz(szazalek, 1)}%-a`}>
        {H.map((h, i) => {
          const elozo = i === 0 ? null : H[i - 1]!.felsoHatar;
          const tartomany = i === 0 ? '≤ 0%' : h.felsoHatar === Infinity ? `> ${elozo}%` : `${elozo}–${h.felsoHatar}%`;
          return (
            <div class="skala-sor">
              <div class="skala-sav-hely"><div class="skala-sav" style={`background:${SZINEK[i]};width:${30 + i * 6.3}%`}>{h.osztaly}</div></div>
              <span class="skala-tartomany">{tartomany}</span>
              {h.osztaly === osztaly ? <span class="skala-jel">{sz(szazalek, 1)}%</span> : <span />}
            </div>
          );
        })}
      </div>
    </figure>
  );
}

const HONAPOK = ['jan', 'feb', 'márc', 'ápr', 'máj', 'jún', 'júl', 'aug', 'szept', 'okt', 'nov', 'dec'];

/** Havi hőmérleg: veszteség és hasznosított nyereség oszlopai, a különbség a nettó fűtési igény. */
export function HaviMerleg({ z }: { z: ZonaEredmeny }) {
  const [hover, setHover] = useState<number | null>(null);
  const [tablazat, setTablazat] = useState(false);
  const W = 640, H = 250, BAL = 48, LENT = 28, FENT = 24;
  const adat = z.havi.map((h) => ({ veszt: Math.max(h.Qveszt, 0), nyer: Math.min(h.eta * h.Qnyer, Math.max(h.Qveszt, 0)), QF: h.QFnet }));
  const max = Math.max(...adat.map((d) => d.veszt), 1);
  const lepes = Math.pow(10, Math.floor(Math.log10(max)));
  const tetej = Math.ceil(max / lepes) * lepes;
  const y = (v: number) => FENT + (1 - v / tetej) * (H - FENT - LENT);
  const sav = (W - BAL - 8) / 12;
  const bw = Math.min(14, sav / 2 - 3);

  return (
    <figure style="margin:0">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px;flex-wrap:wrap">
        <div class="gombsor" style="font-size:13px">
          <span class="jelolo"><span class="minta-negyzet" style="background:var(--hideg);border:0" />Hőveszteség (Qveszt)</span>
          <span class="jelolo"><span class="minta-negyzet" style="background:var(--meleg);border:0" />Hasznosított nyereség (η·Qnyer)</span>
        </div>
        <button class="gomb halk-gomb" onClick={() => setTablazat(!tablazat)}>{tablazat ? 'Diagram' : 'Táblázat'}</button>
      </div>
      {tablazat ? (
        <table class="tabla">
          <thead><tr><th>Hónap</th><th class="szam">Qveszt</th><th class="szam">Qnyer</th><th class="szam">η</th><th class="szam">QF,net</th></tr></thead>
          <tbody>{z.havi.map((h, i) => <tr><td>{HONAPOK[i]}</td><td class="szam">{sz(h.Qveszt, 1)}</td><td class="szam">{sz(h.Qnyer, 1)}</td><td class="szam">{sz(h.eta * 100, 1)}%</td><td class="szam">{sz(h.QFnet, 1)}</td></tr>)}</tbody>
          <tfoot><tr><td>Év</td><td /><td /><td /><td class="szam">{sz(z.QFnetEv, 0)} kWh</td></tr></tfoot>
        </table>
      ) : (
        <div style="position:relative">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Havi hőmérleg; éves nettó fűtési igény ${sz(z.QFnetEv, 0)} kWh`} style="width:100%;height:auto">
            {[0, 0.5, 1].map((t) => (
              <g>
                <line x1={BAL} x2={W - 4} y1={y(tetej * t)} y2={y(tetej * t)} stroke="var(--vonal-2)" />
                <text x={BAL - 6} y={y(tetej * t) + 4} text-anchor="end" font-size="11" fill="var(--tus-3)">{sz(tetej * t, 0)}</text>
              </g>
            ))}
            <text x={4} y={11} font-size="11" fill="var(--tus-3)">kWh/hó</text>
            {adat.map((d, i) => {
              const x0 = BAL + i * sav + sav / 2;
              return (
                <g onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  <rect x={x0 - sav / 2} y={FENT} width={sav} height={H - FENT - LENT} fill={hover === i ? 'var(--vonal-2)' : 'transparent'} />
                  <path d={oszlop(x0 - bw - 1, y(d.veszt), bw, y(0))} fill="var(--hideg)" />
                  <path d={oszlop(x0 + 1, y(d.nyer), bw, y(0))} fill="var(--meleg)" />
                  <text x={x0} y={H - 8} text-anchor="middle" font-size="11" fill="var(--tus-2)">{HONAPOK[i]}</text>
                </g>
              );
            })}
            <line x1={BAL} x2={W - 4} y1={y(0)} y2={y(0)} stroke="var(--tus-3)" />
          </svg>
          {hover !== null && (
            <div class="tooltip" style={`left:${((BAL + hover * sav + sav / 2) / W) * 100}%;top:${(y(adat[hover]!.veszt) / H) * 100}%`}>
              {HONAPOK[hover]}: veszteség {sz(adat[hover]!.veszt, 0)} kWh, hasznosított nyereség {sz(adat[hover]!.nyer, 0)} kWh, fűtési igény {sz(adat[hover]!.QF, 0)} kWh
            </div>
          )}
        </div>
      )}
    </figure>
  );
}

function oszlop(x: number, yTop: number, w: number, yAlap: number) {
  const h = Math.max(yAlap - yTop, 0);
  const r = Math.min(4, h, w / 2);
  if (h <= 0) return '';
  return `M${x} ${yAlap} V${yTop + r} Q${x} ${yTop} ${x + r} ${yTop} H${x + w - r} Q${x + w} ${yTop} ${x + w} ${yTop + r} V${yAlap} Z`;
}
