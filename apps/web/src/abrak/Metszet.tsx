/**
 * Rétegrend metszet: a rétegek arányos vastagsággal, DIN 1356-1 / MSZ jellegű anyagjelöléssel, rajta az állandósult
 * hőmérséklet-lefutás (hideg → meleg színátmenet) és a 0 °C-os sík helye.
 *
 * Falnál (vízszintes hőáram) a rétegek függőlegesek: belül balra, kívül jobbra. Födémnél, padlónál, tetőnél a rétegek
 * vízszintesek, ahogy a metszeten: felfelé irányuló hőáramnál (födém, tető) a belső tér alul, lefelé irányulónál
 * (padló, pincefödém) felül.
 *
 * Anyagjelölés: falazat 45°-os vonalkázás; beton kavicsjel; vasbeton kettős vonalkázás; szálas hőszigetelés egy hullám
 * a teljes rétegvastagságban (a szélein felváltva hurok, középen keresztező vonalak); EPS cikcakk a vastagságban, XPS
 * kettős (kereszt) ferde vonalkázás; vakolat,
 * habarcs pontozás; fa évgyűrű-vonalak a réteg mentén; fólia, lemez vastag vonal; burkolat a rétegre merőleges osztás;
 * talaj, feltöltés ferde vonalkázás ponttal; légréteg üres.
 */
import { useState } from 'preact/hooks';
import { anyag, type Sraffozas } from '../katalogus';
import { homersekletLefutas, type Retegrend } from '../modell';
import { sz } from '../ui';

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
      <pattern id="p-vasbeton" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="8" stroke={s} stroke-width="0.9" /><line x1="2.2" y1="0" x2="2.2" y2="8" stroke={s} stroke-width="0.9" />
      </pattern>
      <pattern id="p-vakolat" width="5" height="5" patternUnits="userSpaceOnUse">
        <circle cx="1.5" cy="1.5" r="0.55" fill={s} /><circle cx="4" cy="3.8" r="0.45" fill={s} />
      </pattern>
      <pattern id="p-xps" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="9" stroke={s} stroke-width="0.8" /><line x1="0" y1="0" x2="9" y2="0" stroke={s} stroke-width="0.8" />
      </pattern>
      <pattern id="p-talaj" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="12" stroke={s} stroke-width="0.8" /><circle cx="6" cy="6" r="0.7" fill={s} />
      </pattern>
      <linearGradient id="g-ho-v" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="var(--meleg)" /><stop offset="1" stop-color="var(--hideg)" />
      </linearGradient>
      <linearGradient id="g-ho-f" x1="0" x2="0" y1="1" y2="0">
        <stop offset="0" stop-color="var(--meleg)" /><stop offset="1" stop-color="var(--hideg)" />
      </linearGradient>
      <linearGradient id="g-ho-l" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="var(--meleg)" /><stop offset="1" stop-color="var(--hideg)" />
      </linearGradient>
    </defs>
  );
}

/** Téglalap a képernyőn. */
type Tegl = { x: number; y: number; w: number; h: number };

/**
 * A réteg irányához igazodó jelölés útvonala (szálas / hab hőszigetelés, fa, burkolat), null: mintával töltött réteg.
 * `fugg`: a réteg függőleges (fal) – a réteg hossza függőleges, a vastagsága vízszintes.
 */
export function retegJel(sraff: Sraffozas | 'xps', t: Tegl, fugg: boolean): string | null {
  // helyi koordináták: u a réteg mentén, v a vastagságban
  const L = fugg ? t.h : t.w, D = fugg ? t.w : t.h;
  const pt = (u: number, v: number) => (fugg ? `${(t.x + v).toFixed(1)} ${(t.y + u).toFixed(1)}` : `${(t.x + u).toFixed(1)} ${(t.y + D - v).toFixed(1)}`);
  if (D < 3) return null;
  if (sraff === 'hoszigeteles_szalas') {
    // szálas hőszigetelés (DIN 1356-1 / MSZ): a két szélen felváltva körívek (csepp alak); egy csepp két nyakából a
    // vonalak a szemközti oldal szomszédos cseppjeihez futnak, a csepp előtt keresztezve egymást – egy hullám a teljes
    // vastagságban
    const R = D * 0.2, s = D * 0.2, g = Math.PI / 2; // a nyak a két szomszédos csepp érintési pontján: a vonalak ott találkoznak, nem kereszteznek
    let p = '';
    for (let k = -1; (k - 1) * s < L + R; k++) {
      const also = k % 2 === 0; const cu = k * s, cv = also ? R : D - R, be = also ? 1 : -1;
      // a ferde vonal pontosan fél osztásnyit lép (meredek): az egyik oldalon a csepp hátsó nyakán be, elsőn ki, a
      // másikon fordítva – így a vonalak a csepp előtt keresztezik egymást
      const elore = Math.atan2(be * Math.cos(g), Math.sin(g)), hatra = Math.atan2(be * Math.cos(g), -Math.sin(g)), aSzel = Math.atan2(-be, 0);
      const aBe = also ? hatra : elore, aKi = also ? elore : hatra;
      const n = (v: number) => ((v % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      let d = n(aKi - aBe); if (!(n(aSzel - aBe) <= d)) d -= 2 * Math.PI;
      for (let i = 0; i <= 20; i++) { const a = aBe + (d * i) / 20; p += `${p ? ' L' : 'M'} ${pt(cu + R * Math.cos(a), cv + R * Math.sin(a))}`; }
    }
    return p;
  }
  if (sraff === 'xps') {
    // extrudált polisztirol: kettős (kereszt) ferde vonalkázás
    return null;
  }
  if (sraff === 'hoszigeteles_hab') {
    // cikcakk a teljes vastagságban
    const lep = Math.max(4, Math.min(D * 0.8, 24));
    let p = `M ${pt(0, 0.5)}`;
    for (let u = lep / 2, i = 1; u <= L + lep / 2; u += lep / 2, i++) p += ` L ${pt(u, i % 2 ? D - 0.5 : 0.5)}`;
    return p;
  }
  if (sraff === 'fa') {
    // évgyűrűk a réteg mentén (hosszmetszet): enyhén hullámzó párhuzamos vonalak
    const db = Math.max(1, Math.min(4, Math.floor(D / 5)));
    let p = '';
    for (let k = 1; k <= db; k++) { const v = (D * k) / (db + 1); p += ` M ${pt(0, v)}`; for (let u = 0; u < L; u += 16) p += ` Q ${pt(u + 8, v + (k % 2 ? 1.6 : -1.6))} ${pt(u + 16, v)}`; }
    return p;
  }
  if (sraff === 'burkolat') {
    // a rétegre merőleges osztás (lapok, hézagok)
    let p = '';
    for (let u = 8; u < L; u += 12) p += ` M ${pt(u, 0)} L ${pt(u, D)}`;
    return p;
  }
  return null;
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

  // tájolás: fal – függőleges rétegek; födém / tető (felfelé) – vízszintes, belül alul; padló (lefelé) – vízszintes, belül felül
  const fugg = p.r.hoaramIrany === 'vizszintes';
  const belulAlul = p.r.hoaramIrany === 'felfele';
  const W = 600, H = fugg ? 300 : 380;
  // falnál a rétegsáv vízszintesen BAL..W-JOBB és függőlegesen FENT..H-LENT; vízszintes rétegeknél a mélység függőleges
  const BAL = fugg ? 58 : 96, JOBB = fugg ? 58 : 110, FENT = fugg ? 30 : 46, LENT = fugg ? 62 : 46;
  const teljes = fugg ? W - BAL - JOBB : H - FENT - LENT;

  // Vékony rétegek is látszódjanak: minimum 6 px, a maradék arányosan.
  const d = p.r.retegek.map((x) => x.dCm);
  const ossz = d.reduce((a, b) => a + b, 0) || 1;
  const minPx = 6;
  const vekonyak = d.filter((x) => (x / ossz) * teljes < minPx).length;
  const maradek = teljes - vekonyak * minPx;
  const vastagOssz = d.filter((x) => (x / ossz) * teljes >= minPx).reduce((a, b) => a + b, 0) || 1;
  const szel = d.map((x) => ((x / ossz) * teljes < minPx ? minPx : (x / vastagOssz) * maradek));
  // mélység (px) a belső felülettől
  const mely: number[] = [0];
  szel.forEach((w, i) => mely.push(mely[i]! + w));

  const tMin = Math.min(thetaE, ...lef.pontok.map((q) => q.theta)) - 2;
  const tMax = Math.max(thetaI, ...lef.pontok.map((q) => q.theta)) + 2;
  // a sáv a mélység mentén: [m0, m1] → képernyő-téglalap; a hőmérséklet a sáv keresztirányában
  const sav = (m0: number, m1: number): Tegl => fugg
    ? { x: BAL + m0, y: FENT, w: m1 - m0, h: H - FENT - LENT }
    : belulAlul ? { x: BAL, y: H - LENT - m1, w: W - BAL - JOBB, h: m1 - m0 } : { x: BAL, y: FENT + m0, w: W - BAL - JOBB, h: m1 - m0 };
  const hoKoord = (t: number) => (fugg ? FENT + ((tMax - t) / (tMax - tMin)) * (H - FENT - LENT) : BAL + ((t - tMin) / (tMax - tMin)) * (W - BAL - JOBB));
  const pont = (m: number, t: number): [number, number] => (fugg ? [BAL + m, hoKoord(t)] : [hoKoord(t), belulAlul ? H - LENT - m : FENT + m]);
  // a belső és a külső levegő hőmérséklete a sávon kívül, a rajz szélén
  const levBel: [number, number] = fugg ? [8, hoKoord(thetaI)] : [hoKoord(thetaI), belulAlul ? H - 8 : 8];
  const levKul: [number, number] = fugg ? [W - 8, hoKoord(thetaE)] : [hoKoord(thetaE), belulAlul ? 8 : H - 8];
  const vonal = [`M ${levBel.join(' ')}`, `L ${pont(0, lef.pontok[0]!.theta).join(' ')}`, ...lef.pontok.map((q, i) => `L ${pont(mely[i]!, q.theta).join(' ')}`), `L ${levKul.join(' ')}`].join(' ');

  // 0 °C metszéspont (mélység px)
  let fagyM: number | null = null;
  for (let i = 0; i < lef.pontok.length - 1; i++) {
    const a = lef.pontok[i]!.theta, b = lef.pontok[i + 1]!.theta;
    if (a >= 0 && b < 0) fagyM = mely[i]! + ((a - 0) / (a - b)) * (mely[i + 1]! - mely[i]!);
  }
  const talajos = p.r.szerep === 'padlo';
  const kulsoNev = p.r.kulsoOldal === 'futetlen' ? (p.r.szerep === 'padlas' ? 'padlás' : 'fűtetlen') : talajos ? 'talaj' : 'kívül';
  const levag = (t: Tegl): Tegl => { const x0 = Math.max(0, t.x), y0 = Math.max(0, t.y); return { x: x0, y: y0, w: Math.min(W, t.x + t.w) - x0, h: Math.min(H, t.y + t.h) - y0 }; };
  const zb = levag(sav(-1000, 0)), zk = levag(sav(teljes, teljes + 1000));
  const grad = fugg ? 'g-ho-v' : belulAlul ? 'g-ho-f' : 'g-ho-l';

  return (
    <div class="metszet" style="position:relative">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Rétegrend metszet: ${p.r.retegek.length} réteg, felületi hőmérséklet belül ${sz(lef.thetaSi, 1)} °C`}>
        <Mintak />
        {/* belső / külső tér */}
        <rect x={zb.x} y={zb.y} width={zb.w} height={zb.h} fill="var(--meleg)" opacity="0.07" />
        <rect x={zk.x} y={zk.y} width={zk.w} height={zk.h} fill={talajos ? 'url(#p-talaj)' : 'var(--hideg)'} opacity={talajos ? 0.45 : 0.08} />
        {fugg ? <>
          <text x={BAL / 2} y={H - LENT + 20} text-anchor="middle" font-size="13" fill="var(--tus-2)">belül</text>
          <text x={W - JOBB / 2} y={H - LENT + 20} text-anchor="middle" font-size="13" fill="var(--tus-2)">{kulsoNev}</text>
          <text x={BAL / 2} y={FENT - 10} text-anchor="middle" font-size="13" fill="var(--meleg)" font-weight="650">{sz(thetaI, 0)} °C</text>
          <text x={W - JOBB / 2} y={FENT - 10} text-anchor="middle" font-size="13" fill="var(--hideg)" font-weight="650">{sz(thetaE, 0)} °C</text>
        </> : <>
          <text x={8} y={zb.y + zb.h / 2 + 5} font-size="13" fill="var(--tus-2)">belül <tspan fill="var(--meleg)" font-weight="650">{sz(thetaI, 0)} °C</tspan></text>
          <text x={8} y={zk.y + zk.h / 2 + 5} font-size="13" fill="var(--tus-2)">{kulsoNev} <tspan fill="var(--hideg)" font-weight="650">{sz(thetaE, 0)} °C</tspan></text>
        </>}

        {p.r.retegek.map((x, i) => {
          const a = anyag(x.anyagId);
          const nev = a?.nev ?? x.nev ?? '';
          const vasbeton = a?.sraffozas === 'beton' && /vasbeton|vb\.|monolit/i.test(nev);
          const talaj = /kavics|homok|zúzott|talaj|feltöltés/i.test(nev);
          const xps = /xps|extrud/i.test(nev);
          const sraff: Sraffozas = x.legreteg ? 'legreteg' : a?.sraffozas ?? (/gyapot|cellul|szálas/i.test(nev) ? 'hoszigeteles_szalas' : /szigetel|eps|xps|pir/i.test(nev) ? 'hoszigeteles_hab' : 'vakolat');
          const kij = p.kijelolt === x.id || hover === i;
          const t = sav(mely[i]!, mely[i + 1]!);
          const jel = vasbeton || talaj || xps ? null : retegJel(sraff, t, fugg);
          const minta = vasbeton ? 'vasbeton' : talaj ? 'talaj' : xps ? 'xps' : sraff;
          const vastagPx = fugg ? t.w : t.h;
          return (
            <g onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => p.jelol?.(x.id)} style="cursor:pointer">
              <rect x={t.x} y={t.y} width={t.w} height={t.h} fill="var(--lap)" />
              <clipPath id={`mz-${i}`}><rect x={t.x} y={t.y} width={t.w} height={t.h} /></clipPath>
              {sraff === 'folia'
                ? (fugg ? <rect x={t.x + t.w / 2 - 1.5} y={t.y} width="3" height={t.h} fill="var(--sraff)" /> : <rect x={t.x} y={t.y + t.h / 2 - 1.5} width={t.w} height="3" fill="var(--sraff)" />)
                : jel ? (
                  <g clip-path={`url(#mz-${i})`}>
                    {sraff.startsWith('hoszigeteles') && <rect x={t.x} y={t.y} width={t.w} height={t.h} fill="var(--sraff-hab)" opacity="0.18" />}
                    <path d={jel} fill="none" stroke="var(--sraff)" stroke-width={sraff.startsWith('hoszigeteles') ? 0.9 : 0.7} />
                  </g>
                )
                : sraff !== 'legreteg' && <rect x={t.x} y={t.y} width={t.w} height={t.h} fill={`url(#p-${minta})`} />}
              <rect x={t.x} y={t.y} width={t.w} height={t.h} fill={kij ? 'var(--hideg)' : 'none'} fill-opacity="0.12" stroke="var(--tus)" stroke-width={kij ? 1.6 : 0.8} />
              {fugg ? <>
                {vastagPx >= 14 && <text x={t.x + t.w / 2} y={H - LENT + 20} text-anchor="middle" font-size="13" fill="var(--tus-2)">{i + 1}</text>}
                {vastagPx >= 40 && <text x={t.x + t.w / 2} y={H - LENT + 37} text-anchor="middle" font-size="12" fill="var(--tus-3)">{sz(x.dCm, x.dCm < 1 ? 1 : 0)} cm</text>}
              </> : vastagPx >= 11 && <>
                <text x={BAL - 8} y={t.y + t.h / 2 + 4} text-anchor="end" font-size="12" fill="var(--tus-2)">{i + 1}</text>
                <text x={W - JOBB + 8} y={t.y + t.h / 2 + 4} font-size="12" fill="var(--tus-3)">{sz(x.dCm, x.dCm < 1 ? 1 : 0)} cm</text>
              </>}
            </g>
          );
        })}

        {fagyM !== null && (() => {
          const [fx, fy] = pont(fagyM, 0);
          return fugg ? (
            <g>
              <line x1={fx} x2={fx} y1={FENT} y2={H - LENT} stroke="var(--hideg)" stroke-dasharray="3 3" stroke-width="1" />
              <text x={fx} y={H - LENT + 54} text-anchor="middle" font-size="12" fill="var(--hideg)">0 °C</text>
            </g>
          ) : (
            <g>
              <line x1={BAL} x2={W - JOBB} y1={fy} y2={fy} stroke="var(--hideg)" stroke-dasharray="3 3" stroke-width="1" />
              <text x={W - JOBB + 56} y={fy + 4} font-size="12" fill="var(--hideg)">0 °C</text>
            </g>
          );
        })()}
        <path d={vonal} fill="none" stroke={`url(#${grad})`} stroke-width="2.5" stroke-linejoin="round" />
        {lef.pontok.map((q, i) => { const [cx, cy] = pont(mely[i]!, q.theta); return <circle cx={cx} cy={cy} r="3" fill="var(--lap)" stroke="var(--tus)" stroke-width="1.2" />; })}
      </svg>
      {hover !== null && (() => {
        const x = p.r.retegek[hover]!;
        const a = anyag(x.anyagId);
        const t0 = lef.pontok[hover]!.theta, t1 = lef.pontok[hover + 1]!.theta;
        const t = sav(mely[hover]!, mely[hover + 1]!);
        return (
          <div class="tooltip" style={`left:${((t.x + t.w / 2) / W) * 100}%;top:${(t.y / H) * 100}%`}>
            {x.nev ?? a?.nev}, {sz(x.dCm, 1)} cm, R = {sz(lef.eredmeny.retegR[hover], 3)} m²K/W, {sz(t0, 1)} … {sz(t1, 1)} °C
          </div>
        );
      })()}
    </div>
  );
}
