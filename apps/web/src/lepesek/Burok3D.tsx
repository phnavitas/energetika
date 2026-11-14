/**
 * A hőburok térbeli ábrája: szintenként a hőburok-körvonal a szintmagassággal kihúzva, a homlokzati nyílászárókkal,
 * a legalsó szint padlójával és a legfelső szint födémjével / tetőjével. CAD-szerű kezelés: bal gombos húzás – forgatás,
 * jobb vagy középső gombos (ill. Shift + bal) húzás – mozgatás, görgő – nagyítás a kurzor körül, dupla kattintás –
 * alapnézet. A lépték a forgatástól nem függ (a kép nem „ugrál”). Kijelölés módban a síkra kattintva kiírja, milyen
 * határoló szerkezet (réteg), melyik szinten, milyen tájolású és mekkora.
 * Csak szemléltetés – a számítás a körvonal éleiből és a feliratokból megy.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

export interface Burok3DSzint {
  nev: string;
  /** Körvonalak méterben (x jobbra, y lefelé a lapon). */
  poligonok: [number, number][][];
  z0: number; h: number;
  nyilasok: { x: number; y: number; szel: number; mag: number; pm: number }[];
  /** Tetőtér (a metszetből): a tető hajlása (°), a térdfal és a padlásfödém (belmagasság) magassága a szint padlójától (m). */
  teto?: { hajlas: number; terdfal: number; belmag: number };
  /** Oromzatok a homlokzatokról: lapirány (0/90/180/270) → oromszélesség (m). */
  orom?: Record<number, number>;
  /** Belső méretnél: körvonalanként, élenként a belső falak csatlakozási szakaszai [t0, t1] (levonódnak). */
  csatl?: [number, number][][][];
  /** Körvonalanként, élenként: mi van a fal túloldalán (szakaszok [t0, t1, fajta]). */
  kornyezet?: [number, number, 'kulso' | 'futetlen' | 'szomszed' | 'belso'][][][];
  /** Terepszint alatti szint (pince): a falai talajjal érintkeznek. */
  talaj?: boolean;
  /** A homlokzati rajz szerinti falmagasság élenként ([poligon][él], m; null: a szint magassága) – térdfal, eltérő párkány. */
  falMag?: (number | null)[][];
  /** (Ellenőrzéshez) a körvonalak lapkoordinátában és a forráslap. */
  forras?: { fajl: string; oldal: number; pt: [number, number][][] };
}

type P3 = [number, number, number];
type Tipus = 'fal' | 'futetlen' | 'szomszed' | 'talaj' | 'nyilas' | 'teto' | 'padlo' | 'fodem' | 'csatl';
interface Sik { tipus: Tipus; pts: P3[]; n: P3; szint: string; info: string; terulet: number; /** tetőrács-cella (körvonal nélkül rajzolva) */ cella?: boolean; /** a hasáb (szint-körvonal) sorszáma */ grp: number; /** a falhoz tartozó nyílászárónál a fal síkjának sorszáma */ fal?: number }

const TIPUS_NEV: Record<Tipus, string> = { futetlen: 'Fal fűtetlen tér felé', szomszed: 'Fal szomszéd épület felé', talaj: 'Talajjal érintkező fal', csatl: 'Belső fal csatlakozása (levonva)', fal: 'Külső fal', nyilas: 'Nyílászáró', teto: 'Födém / tető (legfelső szint)', padlo: 'Padló (legalsó szint)', fodem: 'Közbenső födém' };
const EGTAJ = ['É', 'ÉK', 'K', 'DK', 'D', 'DNy', 'Ny', 'ÉNy'];
const sz = (v: number, t = 2) => v.toLocaleString('hu-HU', { minimumFractionDigits: t, maximumFractionDigits: t });

/** Függőleges sokszög területe (a normális irányából nézve). */
function normTer(q: P3[], nx: number, ny: number): number {
  // vetítés a fal síkjára: vízszintes koordináta a fal mentén (−ny, nx), függőleges z
  const u = q.map((p) => [p[0] * -ny + p[1] * nx, p[2]] as [number, number]);
  return u.reduce((t, [x, y], i) => { const [x2, y2] = u[(i + 1) % u.length]!; return t + x * y2 - x2 * y; }, 0) / 2;
}
/** Sokszög vágása félsíkkal (f(p) ≥ 0 marad) – Sutherland–Hodgman. */
function vag(p: [number, number][], f: (q: [number, number]) => number): [number, number][] {
  const ki: [number, number][] = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!, b = p[(i + 1) % p.length]!; const fa = f(a), fb = f(b);
    if (fa >= 0) ki.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); ki.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return ki;
}
/** Három pont síkjának normálisa (egységvektor). */
function normalis(q: P3[]): P3 {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < q.length; i++) { const a = q[i]!, b = q[(i + 1) % q.length]!; nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]); }
  const l = Math.hypot(nx, ny, nz) || 1; return [nx / l, ny / l, nz / l];
}
export { tetoGeo } from '@terv/teto';
import { tetoGeo } from '@terv/teto';

/**
 * A 3D modell síkjai (falak, nyílászárók, csatlakozó belső falak, tető / födém, padló) világkoordinátában (m) – a
 * rajzolás és a modellből számolt felületek közös alapja.
 */
export function modellSikok(szintek: Burok3DSzint[], eszakSzog: number) {
    const sikok: Sik[] = [];
    // tájolás: a kifelé mutató normális lapirányszöge (felfelé 0°, óramutató szerint) az északjelhez képest
    const tajol = (nx: number, ny: number) => { const b = (Math.atan2(nx, -ny) * 180) / Math.PI; const az = (((b - eszakSzog) % 360) + 360) % 360; return EGTAJ[Math.round(az / 45) % 8]!; };
    const zMin = Math.min(...szintek.map((s) => s.z0)), zMax = Math.max(...szintek.map((s) => s.z0 + s.h));
    const hasabok: { cx: number; cy: number; z0: number; bb: [number, number, number, number] }[] = [];
    for (const s of szintek) {
      const z1 = s.z0 + s.h;
      // a nyílászáró egyetlen élhez tartozik: a legközelebbihez, amelynek a hosszára esik (sarok közelében két él is
      // ≤ 2,5 m-re van – ott korábban mindkettőn megjelent)
      const nyEl = s.nyilasok.map((n) => {
        let leg: string | null = null, d0 = Infinity;
        s.poligonok.forEach((p, pi) => { for (let i = 0; i < p.length; i++) {
          const A = p[i]!, B = p[(i + 1) % p.length]!; const dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy); if (l < 0.05) continue;
          const tt = ((n.x - A[0]) * dx + (n.y - A[1]) * dy) / (l * l); if (tt < 0 || tt > 1) continue;
          // (csak külső tér felé néző szakasz – ahol a nyílás meg is jelenik)
          if (!s.talaj && s.kornyezet?.[pi]?.[i]?.some(([a0, a1, f]) => tt >= a0 && tt <= a1 && f !== 'kulso')) continue;
          const d = Math.abs((n.x - A[0]) * dy - (n.y - A[1]) * dx) / l; if (d < d0) { d0 = d; leg = `${pi}|${i}`; }
        } });
        return leg;
      });
      s.poligonok.forEach((p, pi) => {
        const grp = hasabok.length; hasabok.push({ cx: p.reduce((t, q) => t + q[0], 0) / p.length, cy: p.reduce((t, q) => t + q[1], 0) / p.length, z0: s.z0, bb: [Math.min(...p.map((q) => q[0])), Math.min(...p.map((q) => q[1])), Math.max(...p.map((q) => q[0])), Math.max(...p.map((q) => q[1]))] });
        const A0 = p.reduce((t, [x, y], i) => { const [x2, y2] = p[(i + 1) % p.length]!; return t + x * y2 - x2 * y; }, 0) / 2;
        const tg = s.teto ? tetoGeo(p, s.teto, s.orom) : null;
        const el = Math.sign(A0) || 1;
        for (let i = 0; i < p.length; i++) {
          const A = p[i]!, B = p[(i + 1) % p.length]!;
          const dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy); if (l < 0.05) continue;
          const nx = (el * dy) / l, ny = (-el * dx) / l; // kifelé
          const tj = tajol(nx, ny);
          const falI = sikok.length;
          if (tg) {
            // tetőtéri fal: a felső éle a tetőmagasságot követi (térdfal → ferde → padlásfödém), töréspontokkal
            // a felső él töréspontjai: sűrű mintavétel, majd az egyenes szakaszok összevonása
            const N = Math.max(2, Math.ceil(l / 0.25)); const ts0 = Array.from({ length: N + 1 }, (_, k) => k / N);
            const hs = ts0.map((u) => tg.H([A[0] + dx * u, A[1] + dy * u]));
            const ts = ts0.filter((_, k) => k === 0 || k === N || Math.abs(hs[k - 1]! - 2 * hs[k]! + hs[k + 1]!) > 1e-3);
            const felso: P3[] = ts.map((u) => { const q: [number, number] = [A[0] + dx * u, A[1] + dy * u]; return [q[0], q[1], s.z0 + tg.H(q)]; });
            const pts: P3[] = [[A[0], A[1], s.z0], [B[0], B[1], s.z0], ...felso.reverse()];
            const hMax = Math.max(...felso.map((q) => q[2] - s.z0)), hMin = Math.min(...felso.map((q) => q[2] - s.z0));
            const ef = tg.elek.find((e) => Math.abs(e.a[0] - A[0]) < 1e-6 && Math.abs(e.a[1] - A[1]) < 1e-6)?.fajta;
            const fajta = ef === 'kiugro' ? 'teljes szintmagasságú kiugrás' : ef === 'orom' ? 'oromfal' : hMax - hMin < 0.05 ? (hMax >= s.teto!.belmag - 0.05 ? 'teljes magasságú fal' : 'térdfal') : 'ferde felső élű fal';
            sikok.push({ tipus: 'fal', pts, n: [nx, ny, 0], szint: s.nev, info: `${tj} tájolású · ${fajta} · ${sz(l)} m, ${sz(hMin)}–${sz(hMax)} m magas`, terulet: pts.length ? Math.abs(normTer(pts, nx, ny)) : l * s.h, grp });
          } else
          {
            // a fal darabjai a belső falak csatlakozásai között; a csatlakozások külön (levont) síkok
            const cs = (s.csatl?.[pi]?.[i] ?? []).slice().sort((u, w) => u[0] - w[0]);
            const levon = cs.reduce((t0, [u0, u1]) => t0 + (u1 - u0) * l, 0);
            const pont = (u: number): [number, number] => [A[0] + dx * u, A[1] + dy * u];
            // (a homlokzat szerinti falmagasság – térdfal, alacsonyabb párkány – ha az élre van ilyen)
            const hE = s.falMag?.[pi]?.[i] ?? s.h, zE = s.z0 + hE;
            const darab = (u0: number, u1: number, tip: Tipus, info: string) => { const P = pont(u0), Q = pont(u1); sikok.push({ tipus: tip, pts: [[P[0], P[1], s.z0], [Q[0], Q[1], s.z0], [Q[0], Q[1], zE], [P[0], P[1], zE]], n: [nx, ny, 0], szint: s.nev, info, terulet: (u1 - u0) * l * hE, grp }); };
            const info = `${tj} tájolású · ${sz(l)} × ${sz(s.h)} m${levon > 0 ? ` · nettó hossz ${sz(l - levon)} m (belső falak: −${sz(levon)} m)` : ''}`;
            // a fal fajtája a túloldal szerint (külső tér / fűtetlen tér / szomszéd épület / talaj), szakaszonként
            const kr = s.talaj ? [[0, 1, 'talaj'] as [number, number, string]] : (s.kornyezet?.[pi]?.[i] ?? [[0, 1, 'kulso']]);
            const fajtaT = (u0: number, u1: number): [number, number, Tipus][] => kr.filter(([a0, a1]) => a1 > u0 && a0 < u1).map(([a0, a1, f]) => [Math.max(a0, u0), Math.min(a1, u1), f === 'kulso' ? 'fal' : (f as Tipus)]);
            const falDarab = (u0: number, u1: number) => { for (const [v0, v1, tp] of fajtaT(u0, u1)) if (v1 - v0 > 1e-6 && (tp as string) !== 'belso') darab(v0, v1, tp, tp === 'fal' ? info : `${TIPUS_NEV[tp]} · ${tj} · ${sz((v1 - v0) * l)} × ${sz(s.h)} m`); };
            let u = 0;
            for (const [u0, u1] of cs) { if (u0 > u) falDarab(u, u0); darab(u0, u1, 'csatl', `${tj} oldali külső falhoz csatlakozó belső fal · ${sz((u1 - u0) * l)} m széles`); u = u1; }
            if (u < 1) falDarab(u, 1);
          }
          const falJ = sikok.length;
          for (const [ni, n] of s.nyilasok.entries()) {
            if (nyEl[ni] !== `${pi}|${i}`) continue;
            const tt = ((n.x - A[0]) * dx + (n.y - A[1]) * dy) / (l * l);
            // a nyílást tartalmazó faldarab (a fal a belső falak csatlakozásainál és a környezet szerint darabolt): a
            // rajzolási sorrendben ennek a darabnak a mélysége után jön
            const darabI = (() => { for (let j = falI; j < falJ; j++) { const q = sikok[j]!.pts; const u0 = ((q[0]![0] - A[0]) * dx + (q[0]![1] - A[1]) * dy) / (l * l), u1 = ((q[1]![0] - A[0]) * dx + (q[1]![1] - A[1]) * dy) / (l * l); if (tt >= Math.min(u0, u1) - 1e-6 && tt <= Math.max(u0, u1) + 1e-6) return j; } return falI; })();
            const dist = Math.abs((n.x - A[0]) * dy - (n.y - A[1]) * dx) / l;
            if (tt < 0 || tt > 1 || dist > 2.5) continue;
            // csak külső tér felé néző falszakaszon (a fűtetlen tér felé nyíló ajtó más határolás)
            if (!s.talaj && s.kornyezet?.[pi]?.[i]?.some(([a0, a1, f]) => tt >= a0 && tt <= a1 && f !== 'kulso')) continue;
            const hFal = tg ? Math.min(tg.H([A[0] + dx * tt, A[1] + dy * tt]), s.h) : s.h;
            const h0 = Math.min(Math.max(n.pm, 0), hFal - 0.3), h1 = Math.min(h0 + n.mag, hFal);
            const t0 = Math.max(0, tt - n.szel / 2 / l), t1 = Math.min(1, tt + n.szel / 2 / l);
            const e = 0.04, ex = nx * e, ey = ny * e;
            sikok.push({
              tipus: 'nyilas',
              pts: [[A[0] + dx * t0 + ex, A[1] + dy * t0 + ey, s.z0 + h0], [A[0] + dx * t1 + ex, A[1] + dy * t1 + ey, s.z0 + h0], [A[0] + dx * t1 + ex, A[1] + dy * t1 + ey, s.z0 + h1], [A[0] + dx * t0 + ex, A[1] + dy * t0 + ey, s.z0 + h1]],
              n: [nx, ny, 0], szint: s.nev, info: `${tj} tájolású · ${Math.round(n.szel * 100)} × ${Math.round(n.mag * 100)} cm${n.pm > 0 ? ` · mellvéd ${sz(n.pm)} m` : ''}`, terulet: n.szel * n.mag, grp, fal: darabI,
            });
          }
        }
        const Ab = Math.abs(A0);
        const felso = Math.abs(z1 - zMax) < 0.01, also = Math.abs(s.z0 - zMin) < 0.01;
        if (tg && s.teto) {
          // tetőfelület: 0,5 m-es rács a körvonalon belül, a cellák sarkain a tetőmagassággal (ferde tető / padlásfödém)
          const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]); const c = 0.5;
          for (let x = Math.floor(Math.min(...xs) / c) * c; x < Math.max(...xs); x += c) for (let y = Math.floor(Math.min(...ys) / c) * c; y < Math.max(...ys); y += c) {
            let q = vag(p, (u) => u[0] - x); q = vag(q, (u) => x + c - u[0]); q = vag(q, (u) => u[1] - y); q = vag(q, (u) => y + c - u[1]);
            if (q.length < 3) continue;
            const pts3 = q.map((u) => [u[0], u[1], s.z0 + tg.H(u)] as P3);
            let nn = normalis(pts3); if (nn[2] < 0) nn = [-nn[0], -nn[1], -nn[2]];
            const Av = Math.abs(q.reduce((t0, [x1, y1], i) => { const [x2, y2] = q[(i + 1) % q.length]!; return t0 + x1 * y2 - x2 * y1; }, 0) / 2);
            const ferde = nn[2] < 0.995;
            sikok.push({ tipus: 'teto', pts: pts3, n: nn, szint: s.nev, info: ferde ? `ferde tető · ${Math.round(s.teto.hajlas)}° hajlás (térdfal ${sz(s.teto.terdfal)} m)` : `padlásfödém · ${sz(s.teto.belmag)} m magasan`, terulet: ferde ? Av / Math.max(0.2, nn[2]) : Av, grp, cella: true });
          }
        } else
        sikok.push({ tipus: felso ? 'teto' : 'fodem', pts: p.map(([x, y]) => [x, y, z1] as P3), n: [0, 0, 1], szint: s.nev, info: `vízszintes · ${sz(Ab, 1)} m² (a körvonalon belül)`, terulet: Ab, grp });
        if (also) sikok.push({ tipus: 'padlo', pts: p.map(([x, y]) => [x, y, s.z0] as P3).reverse(), n: [0, 0, -1], szint: s.nev, info: `vízszintes · ${sz(Ab, 1)} m² (a körvonalon belül)`, terulet: Ab, grp });
      });
    }
    const pts = sikok.flatMap((x) => x.pts);
    const kozep: P3 = pts.length ? [(Math.min(...pts.map((p) => p[0])) + Math.max(...pts.map((p) => p[0]))) / 2, (Math.min(...pts.map((p) => p[1])) + Math.max(...pts.map((p) => p[1]))) / 2, (zMin + zMax) / 2] : [0, 0, 0];
    const R = Math.max(5, ...pts.map((p) => Math.hypot(p[0] - kozep[0], p[1] - kozep[1], p[2] - kozep[2])));
    return { sikok, kozep, R, hasabok };
}

/** A modell felületei összesítve: típusonként, a falak és nyílászárók tájolásonként is (m²). */
export function modellOsszesites(szintek: Burok3DSzint[], eszakSzog: number) {
  const { sikok } = modellSikok(szintek, eszakSzog);
  const ki: { tipus: Record<string, number>; falTaj: Record<string, number>; nyilasTaj: Record<string, number> } = { tipus: {}, falTaj: {}, nyilasTaj: {} };
  for (const x of sikok) {
    ki.tipus[x.tipus] = (ki.tipus[x.tipus] ?? 0) + x.terulet;
    const tj = x.info.split(' ')[0]!;
    if (x.tipus === 'fal') ki.falTaj[tj] = (ki.falTaj[tj] ?? 0) + x.terulet;
    if (x.tipus === 'nyilas') ki.nyilasTaj[tj] = (ki.nyilasTaj[tj] ?? 0) + x.terulet;
  }
  (ki as any).szintek = szintek.map((x) => ({ nev: x.nev, z0: x.z0, h: x.h, db: x.poligonok.length, A: x.poligonok.reduce((t, p) => t + Math.abs(p.reduce((u, [a, b], i) => { const [c, d] = p[(i + 1) % p.length]!; return u + a * d - c * b; }, 0) / 2), 0), K: x.poligonok.reduce((t, p) => t + p.reduce((u, a, i) => { const b = p[(i + 1) % p.length]!; return u + Math.hypot(b[0] - a[0], b[1] - a[1]); }, 0), 0) }));
  return ki;
}

const KAMERA = 3;
export function Burok3D({ szintek, eszakSzog, magassag = 560, meretMod, onMeretMod }: { szintek: Burok3DSzint[]; eszakSzog: number; magassag?: number; meretMod?: 'belso' | 'kulso'; onMeretMod?: (m: 'belso' | 'kulso') => void }) {
  const [forg, setForg] = useState(-35);
  const [dol, setDol] = useState(30);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<[number, number]>([0, 0]);
  const [huz, setHuz] = useState<{ x: number; y: number; f: number; d: number; p: [number, number]; mod: 'forgat' | 'mozgat'; mozdult: number } | null>(null);
  const [kijelolMod, setKijelolMod] = useState(false);
  const [kijelolt, setKijelolt] = useState<number | null>(null);
  const [lathato, setLathato] = useState<Record<Tipus, boolean>>({ futetlen: true, szomszed: true, talaj: true, fal: true, nyilas: true, teto: true, padlo: true, fodem: false, csatl: true });
  const svgRef = useRef<SVGSVGElement>(null);

  // a síkok (világkoordinátában, m): falak, nyílászárók, padló, födém / tető
  const { sikok, kozep, R, hasabok } = useMemo(() => modellSikok(szintek, eszakSzog), [szintek, eszakSzog]);

  // görgetés: nagyítás a kurzor körül (nem passzív figyelő, hogy a lap ne görögjön)
  useEffect(() => {
    const el = svgRef.current; if (!el) return;
    const kezel = (e: WheelEvent) => {
      e.preventDefault();
      const ctm = el.getScreenCTM(); if (!ctm) return;
      const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
      const f = Math.exp(-e.deltaY * 0.0015);
      setZoom((z) => { const uj = Math.max(0.2, Math.min(25, z * f)); const k = uj / z; setPan(([px, py]) => [pt.x - (pt.x - px) / k, pt.y - (pt.y - py) / k]); return uj; });
    };
    el.addEventListener('wheel', kezel, { passive: false });
    return () => el.removeEventListener('wheel', kezel);
  }, []);

  if (!sikok.length) return null;
  const a = (forg * Math.PI) / 180, t = (dol * Math.PI) / 180;
  // nézet: x jobbra, y lefelé a képernyőn, mélység a néző felé nő
  const vet = ([x, y, z]: P3): P3 => {
    const X = (x - kozep[0]) * Math.cos(a) - (y - kozep[1]) * Math.sin(a);
    const Y = (x - kozep[0]) * Math.sin(a) + (y - kozep[1]) * Math.cos(a);
    const Z = z - kozep[2];
    const mely = Y * Math.cos(t) + Z * Math.sin(t);
    // perspektíva: a néző a modell középpontjától 3 R-re; a középpont síkjában a lépték változatlan
    const f = KAMERA * R / Math.max(0.2 * R, KAMERA * R - mely);
    return [X * f, (-Z * Math.cos(t) + Y * Math.sin(t)) * f, mely];
  };
  // a fény iránya (világkoordinátában: bal-elöl-fent) és a néző iránya
  const feny: P3 = (() => { const v: P3 = [-0.45, 0.55, 0.7]; const l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l]; })();
  const nezo: P3 = [Math.sin(a) * Math.cos(t), Math.cos(a) * Math.cos(t), Math.sin(t)];
  const ALAP: Record<Tipus, [number, number, number]> = { futetlen: [190, 205, 170], szomszed: [200, 190, 210], talaj: [170, 150, 125], csatl: [120, 113, 108], fal: [226, 218, 200], nyilas: [120, 178, 228], teto: [196, 120, 92], padlo: [150, 150, 145], fodem: [205, 195, 230] };
  // rajzolási sorrend (festő-algoritmus hasábonként): a hasábok a talajon mért mélységük, egymás fölött alulról
  // felfelé; a hasábon belül: hátsó falak, padló, első falak (a nyílászáróikkal), végül a felső födém / tető
  const felulrol = t >= 0;
  // egymás fölötti (alaprajzban átfedő) hasábok egy „toronyba”: a torony mélysége közös, benne alulról felfelé
  const torony = hasabok.map((_, i) => i);
  const gyoker = (i: number): number => (torony[i] === i ? i : (torony[i] = gyoker(torony[i]!)));
  hasabok.forEach((h, i) => hasabok.forEach((g, j) => { if (j > i && h.bb[0] < g.bb[2] && g.bb[0] < h.bb[2] && h.bb[1] < g.bb[3] && g.bb[1] < h.bb[3] && Math.abs(h.z0 - g.z0) > 0.01) torony[gyoker(i)] = gyoker(j); }));
  const tm = new Map<number, number[]>(); hasabok.forEach((h, i) => { const k = gyoker(i); const d = vet([h.cx, h.cy, kozep[2]])[2]; tm.set(k, [...(tm.get(k) ?? []), d]); });
  const hasabMely = hasabok.map((_, i) => { const l = tm.get(gyoker(i))!; return l.reduce((a2, b2) => a2 + b2, 0) / l.length; });
  type Rajz = { i: number; pts: [number, number][]; mely: number; szin: string; atl: number; vonal: string; kulcs: [number, number, number, number]; cella?: boolean };
  const rajz: Rajz[] = [];
  sikok.forEach((s, i) => {
    if (!lathato[s.tipus]) return;
    const v = s.pts.map(vet);
    const elol = s.n[0] * nezo[0] + s.n[1] * nezo[1] + s.n[2] * nezo[2] > 0;
    const fe = Math.max(0, s.n[0] * feny[0] + s.n[1] * feny[1] + s.n[2] * feny[2]);
    const k = elol ? 0.72 + 0.32 * fe : 0.9;
    const [r0, g0, b0] = ALAP[s.tipus];
    const szin = `rgb(${Math.min(255, Math.round(r0 * k))},${Math.min(255, Math.round(g0 * k))},${Math.min(255, Math.round(b0 * k))})`;
    const atl = s.tipus === 'teto' || s.tipus === 'fodem' ? 0.94 : s.tipus === 'nyilas' ? 0.92 : elol ? 1 : 0.55;
    const mely = v.reduce((m, w) => m + w[2], 0) / v.length;
    const falElol = s.tipus === 'nyilas' && s.fal !== undefined ? (() => { const f = sikok[s.fal!]!; return f.n[0] * nezo[0] + f.n[1] * nezo[1] > 0; })() : elol;
    const kat = s.tipus === 'teto' || s.tipus === 'fodem' ? (felulrol ? 3 : 0) : s.tipus === 'padlo' ? (felulrol ? 1 : 3) : falElol ? 2 : 0;
    // nyílászáró a saját fala után: a fal mélységével, kicsivel utána
    const m2 = s.tipus === 'nyilas' && s.fal !== undefined ? sikok[s.fal]!.pts.map(vet).reduce((m, w) => m + w[2], 0) / 4 + 1e-4 : mely;
    rajz.push({ i, pts: v.map((w) => [w[0], w[1]]), mely, szin, atl: s.cella ? 1 : atl, cella: s.cella, vonal: s.tipus === 'nyilas' ? '#2F6FA8' : s.tipus === 'teto' ? '#7C2D12' : '#6B5E45', kulcs: [Math.round(hasabMely[s.grp]! * 100) / 100, felulrol ? hasabok[s.grp]!.z0 : -hasabok[s.grp]!.z0, kat, m2] });
  });
  rajz.sort((x, y) => x.kulcs[0] - y.kulcs[0] || x.kulcs[1] - y.kulcs[1] || x.kulcs[2] - y.kulcs[2] || x.kulcs[3] - y.kulcs[3]);
  // nyílászárók: a festő-sorrend a homorú alaprajznál tévedhet (egy hátrébb lévő faldarab rájuk rajzolódik) – sugárvizsgálat
  // a néző pontjától: amelyik nyílást semmilyen nem átlátszó (elöl lévő fal, tető, padló) sík nem takar, az a végére kerül
  {
    const D = KAMERA * R; const szem: P3 = [kozep[0] + nezo[0] * D, kozep[1] + nezo[1] * D, kozep[2] + nezo[2] * D];
    const takaro = sikok.map((f, j) => ({ f, j })).filter(({ f }) => lathato[f.tipus] && f.tipus !== 'nyilas' && (f.tipus === 'teto' || f.tipus === 'fodem' || f.tipus === 'padlo' || f.n[0] * nezo[0] + f.n[1] * nezo[1] + f.n[2] * nezo[2] > 0));
    const benne = (q: P3[], n: P3, X: P3) => {
      // a sík legnagyobb normális-összetevőjét elhagyva 2D-ben
      const k = Math.abs(n[0]) >= Math.abs(n[1]) && Math.abs(n[0]) >= Math.abs(n[2]) ? 0 : Math.abs(n[1]) >= Math.abs(n[2]) ? 1 : 2;
      const u = k === 0 ? 1 : 0, v = k === 2 ? 1 : 2; let bent = false;
      for (let i = 0, j = q.length - 1; i < q.length; j = i++) { const a1 = q[i]!, b1 = q[j]!; if ((a1[v] > X[v]) !== (b1[v] > X[v]) && X[u] < ((b1[u] - a1[u]) * (X[v] - a1[v])) / (b1[v] - a1[v]) + a1[u]) bent = !bent; }
      return bent;
    };
    const lathatoNy = new Set<number>();
    for (const r0 of rajz) {
      const w = sikok[r0.i]!; if (w.tipus !== 'nyilas') continue;
      const c: P3 = [0, 1, 2].map((d) => w.pts.reduce((m, q) => m + q[d]!, 0) / w.pts.length) as P3;
      const d: P3 = [c[0] - szem[0], c[1] - szem[1], c[2] - szem[2]];
      const takart = takaro.some(({ f }) => {
        const nd = f.n[0] * d[0] + f.n[1] * d[1] + f.n[2] * d[2]; if (Math.abs(nd) < 1e-9) return false;
        const p0 = f.pts[0]!; const tt = (f.n[0] * (p0[0] - szem[0]) + f.n[1] * (p0[1] - szem[1]) + f.n[2] * (p0[2] - szem[2])) / nd;
        if (!(tt > 1e-4 && tt < 1 - 1e-3)) return false;
        return benne(f.pts, f.n, [szem[0] + d[0] * tt, szem[1] + d[1] * tt, szem[2] + d[2] * tt]);
      });
      if (!takart) lathatoNy.add(r0.i);
    }
    if (lathatoNy.size) { const elol = rajz.filter((x) => !lathatoNy.has(x.i)), vege = rajz.filter((x) => lathatoNy.has(x.i)); rajz.length = 0; rajz.push(...elol, ...vege); }
  }
  // talaj: négyzetrács a legalsó szint alatt, rajta az északjel
  const zMin = Math.min(...szintek.map((s) => s.z0));
  const rr = R * 1.3, lep = Math.max(1, Math.round(rr / 8)), rac: [P3, P3][] = [];
  for (let u = -rr; u <= rr + 1e-9; u += lep) { rac.push([[kozep[0] + u, kozep[1] - rr, zMin], [kozep[0] + u, kozep[1] + rr, zMin]]); rac.push([[kozep[0] - rr, kozep[1] + u, zMin], [kozep[0] + rr, kozep[1] + u, zMin]]); }
  const er = (eszakSzog * Math.PI) / 180, ex = Math.sin(er), ey = -Math.cos(er);
  const e0 = vet([kozep[0] - rr * 0.8, kozep[1] + rr * 0.8, zMin]), e1 = vet([kozep[0] - rr * 0.8 + ex * R * 0.35, kozep[1] + rr * 0.8 + ey * R * 0.35, zMin]);
  // rögzített lépték: a befoglaló gömb sugara szerint (forgatáskor nem változik)
  const vw = (2.3 * R) / zoom, vh = vw * 0.62;
  const vb = `${pan[0] - vw / 2} ${pan[1] - vh / 2} ${vw} ${vh}`;
  const svgPont = (cx: number, cy: number) => { const el = svgRef.current; const ctm = el?.getScreenCTM(); return ctm ? new DOMPoint(cx, cy).matrixTransform(ctm.inverse()) : null; };
  const ks = kijelolt !== null ? sikok[kijelolt] : null;
  const vonVast = vw / 900;
  return (
    <div style="position:relative">
      <svg ref={svgRef} viewBox={vb} preserveAspectRatio="xMidYMid meet" aria-label="A hőburok térben" style={`width:100%;height:${magassag}px;display:block;touch-action:none;cursor:${huz ? (huz.mod === 'mozgat' ? 'move' : 'grabbing') : kijelolMod ? 'pointer' : 'grab'};background:linear-gradient(#F8FAFC,#EEF2F6);border-radius:8px`}
        onContextMenu={(e) => e.preventDefault()}
        onDblClick={() => { setForg(-35); setDol(30); setZoom(1); setPan([0, 0]); }}
        onPointerDown={(e) => { (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId); setHuz({ x: e.clientX, y: e.clientY, f: forg, d: dol, p: pan, mod: e.button === 1 || e.button === 2 || e.shiftKey ? 'mozgat' : 'forgat', mozdult: 0 }); }}
        onPointerMove={(e) => {
          if (!huz) return;
          const dx = e.clientX - huz.x, dy = e.clientY - huz.y; const moz = Math.max(huz.mozdult, Math.abs(dx) + Math.abs(dy));
          if (huz.mod === 'forgat') { setForg(huz.f + dx * 0.4); setDol(Math.max(-10, Math.min(89, huz.d + dy * 0.3))); }
          else { const p0 = svgPont(huz.x, huz.y), p1 = svgPont(e.clientX, e.clientY); if (p0 && p1) setPan([huz.p[0] - (p1.x - p0.x), huz.p[1] - (p1.y - p0.y)]); }
          if (moz !== huz.mozdult) setHuz({ ...huz, mozdult: moz });
        }}
        onPointerUp={(e) => {
          if (huz && huz.mozdult < 4 && kijelolMod) {
            // kattintás: a kurzor alatti (legfelül rajzolt) sík
            const tg = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-sik]'); const i = tg ? Number(tg.getAttribute('data-sik')) : NaN;
            setKijelolt(Number.isFinite(i) && i !== kijelolt ? i : null);
          }
          setHuz(null);
        }}>
        {rac.map(([p, q]) => { const u = vet(p), w = vet(q); return <line x1={u[0]} y1={u[1]} x2={w[0]} y2={w[1]} stroke="#CBD5E1" stroke-width={vonVast * 0.8} />; })}
        {rajz.map((r) => (
          <polygon data-sik={r.i} points={r.pts.map((p) => p.join(',')).join(' ')} fill={r.i === kijelolt ? '#F97316' : r.szin} fill-opacity={r.i === kijelolt ? 0.85 : r.atl} stroke={r.i === kijelolt ? '#C2410C' : r.cella ? r.szin : r.vonal} stroke-width={r.i === kijelolt ? vonVast * 3 : r.cella ? vonVast * 0.6 : vonVast * 1.1} stroke-linejoin="round" />
        ))}
        <line x1={e0[0]} y1={e0[1]} x2={e1[0]} y2={e1[1]} stroke="#B91C1C" stroke-width={vonVast * 3} stroke-linecap="round" />
        <text x={e1[0]} y={e1[1]} font-size={vw / 40} fill="#B91C1C" font-weight="700" font-family="system-ui">É</text>
      </svg>
      <div style="position:absolute;right:10px;top:10px;display:flex;flex-direction:column;gap:4px;background:rgba(255,255,255,.92);border:1px solid #E5E7EB;border-radius:8px;padding:8px 10px;font-size:12px">
        {meretMod && onMeretMod && (
          <div role="group" aria-label="Méretezés" style="display:flex;gap:4px;margin-bottom:4px">
            {(['belso', 'kulso'] as const).map((mm) => <button aria-pressed={meretMod === mm} onClick={() => onMeretMod(mm)} style={`padding:3px 10px;font:600 12px system-ui;border:1px solid #D1D5DB;border-radius:6px;cursor:pointer;${meretMod === mm ? 'background:#1F2937;color:#fff' : 'background:#fff;color:#374151'}`}>{mm === 'belso' ? 'Belső méret' : 'Külső méret'}</button>)}
          </div>
        )}
        <label class="jelolo" style="font-weight:600"><input type="checkbox" checked={kijelolMod} onChange={(e) => { setKijelolMod((e.target as HTMLInputElement).checked); setKijelolt(null); }} /> Kijelölés</label>
        {(['fal', 'futetlen', 'szomszed', 'talaj', 'csatl', 'nyilas', 'teto', 'padlo', 'fodem'] as Tipus[]).filter((tp) => (tp !== 'csatl' || szintek.some((x) => x.csatl)) && (!['futetlen', 'szomszed', 'talaj'].includes(tp) || sikok.some((x) => x.tipus === tp))).map((tp) => (
          <label class="jelolo"><input type="checkbox" checked={lathato[tp]} onChange={(e) => setLathato({ ...lathato, [tp]: (e.target as HTMLInputElement).checked })} /> <span style={`display:inline-block;width:10px;height:10px;border-radius:2px;background:rgb(${ALAP[tp].join(',')})`} /> {TIPUS_NEV[tp].replace(/ \(.*\)/, '')}</label>
        ))}
      </div>
      {(() => {
        // a modell felületei összesítve (ellenőrzéshez)
        const ossz = (t: Tipus) => sikok.filter((x) => x.tipus === t).reduce((a2, x) => a2 + x.terulet, 0);
        const fal = ossz('fal'), ny = ossz('nyilas');
        return (
          <div class="halkabb" style="position:absolute;right:10px;bottom:10px;background:rgba(255,255,255,.92);border:1px solid #E5E7EB;border-radius:8px;padding:6px 10px;font-size:12px;line-height:1.5">
            <strong>A modell felületei</strong> ({meretMod === 'kulso' ? 'külső' : 'belső'} méret)<br />
            Külső fal: {sz(fal, 1)} m² − nyílás {sz(ny, 1)} m² = <strong>{sz(fal - ny, 1)} m²</strong><br />
            {ossz('futetlen') > 0 && <>Fal fűtetlen tér felé: {sz(ossz('futetlen'), 1)} m²<br /></>}
            {ossz('szomszed') > 0 && <>Fal szomszéd épület felé: {sz(ossz('szomszed'), 1)} m²<br /></>}
            {ossz('talaj') > 0 && <>Talajjal érintkező fal: {sz(ossz('talaj'), 1)} m²<br /></>}
            {ossz('csatl') > 0 && <>Belső fal csatlakozás (levonva): {sz(ossz('csatl'), 1)} m²<br /></>}
            Tető / felső födém: {sz(ossz('teto'), 1)} m² · Padló: {sz(ossz('padlo'), 1)} m²
          </div>
        );
      })()}
      {ks && (
        <div role="status" style="position:absolute;left:10px;bottom:10px;max-width:60%;background:#fff;border:2px solid #F97316;border-radius:8px;padding:8px 12px;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
          <div style="font-weight:700">{TIPUS_NEV[ks.tipus]}</div>
          <div>{ks.szint} · {ks.info}</div>
          <div class="halkabb">Felület: {sz(ks.terulet, 2)} m²</div>
        </div>
      )}
      <div class="halkabb" style="position:absolute;left:10px;bottom:10px;font-size:11px;background:rgba(255,255,255,.85);padding:2px 6px;border-radius:4px" hidden={!!ks}>
        Bal gomb: forgatás · jobb / középső gomb vagy Shift: mozgatás · görgő: nagyítás · dupla kattintás: alapnézet{kijelolMod ? ' · kattintás: sík kijelölése' : ''}
      </div>
    </div>
  );
}
