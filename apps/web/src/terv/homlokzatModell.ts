/**
 * Alaprajz + homlokzat összevetése: a homlokzati nézet (fal-réteg sziluettje) az alaprajz homlokzati falaihoz illesztve
 * (vízszintesen a nyílászárók szélessége és egymáshoz viszonyított helyzete, függőlegesen a nyílások mellvédje szerint),
 * és ebből a falszakasz tényleges magassága a szint padlója és mennyezete között – oromfalnál, térdfalnál, eltérő
 * párkánymagasságnál is a rajz szerint.
 */
import type { TervNyilas } from './nyilaszarok';
import type { HomlokzatKeret } from './homlokzat';
import type { NezetOszlopok } from './homlokzatProfil';

/** Egy homlokzati nézet: a fal-sziluett oszlopai, a benne felismert nyílászárókeretek, a lépték és (ha a címből ismert) az égtáj. */
export interface HomlokzatNezetAdat { ny: NezetOszlopok; keretek: HomlokzatKeret[]; mPerPt: number; az?: number }

const SZT = 0.12;
const szogKul = (a: number, b: number) => { const d = Math.abs((((a - b) % 360) + 360) % 360); return Math.min(d, 360 - d); };

interface Illesztes { v: HomlokzatNezetAdat; o: number; y0: number; tam: number }

export interface FalMagassagModell {
  /** Az illesztett homlokzatok (alaprajzi irány → illesztés) száma. */
  db: number;
  /** Az illesztések szövegesen (ellenőrzéshez). */
  leiras: string[];
  /** A falszakasz átlagos magassága (m) a [zf, zc] szintsávban, ha a homlokzaton (≥ 60 %-ban) látszik; különben null. */
  magassag(irany: number, pontok: [number, number][], zf: number, zc: number): number | null;
}

/**
 * `nyilasok`: az alaprajz nyílásai (a feliratos, mellvédes nyílások rögzítik a függőleges helyzetet), `mPerPt` az
 * alaprajz léptéke, `zf` a lap padlószintje (m, ±0,00-hoz), `nezetek` a homlokzati rajzok nézetei.
 */
export function falMagassagModell(nyilasok: TervNyilas[], mPerPt: number, eszakSzog: number, nezetek: HomlokzatNezetAdat[], zf: number, falak: { irany: number; pontok: [number, number][] }[] = []): FalMagassagModell {
  const kulso = nyilasok.filter((n) => n.kulso && n.irany !== null && n.fajta !== 'falfulke' && n.szel > 0.3);
  const s = (t: number, x: number, y: number) => { const r = t * Math.PI / 180; return (-Math.cos(r) * x - Math.sin(r) * y) * mPerPt; };
  const iranyok = [...new Set(kulso.map((n) => n.irany!))];
  // minden (nézet, alaprajzi irány) párra a legjobb illesztés: a keretek szélessége és egymáshoz viszonyított helyzete
  // (a nézet címe – égtája – csak egyenlő egyezésnél dönt: a címek elírása, hiánya nem akadály)
  const jeloltek: Illesztes[] = [];
  for (const ir of iranyok) {
    const sajat = kulso.filter((n) => n.irany === ir);
    for (const v of nezetek) {
      const e = (k: HomlokzatKeret) => (k.x0 + k.x1) / 2 * v.mPerPt;
      let leg: Illesztes | null = null;
      for (const n of sajat) for (const k of v.keretek) {
        if (Math.abs(k.szel - n.szel) > SZT) continue;
        const c = e(k) - s(ir, n.x, n.y);
        const parok: { n: TervNyilas; k: HomlokzatKeret }[] = [];
        for (const m of sajat) { const q = v.keretek.find((q) => Math.abs(q.szel - m.szel) <= SZT && Math.abs(e(q) - s(ir, m.x, m.y) - c) <= 0.25); if (q) parok.push({ n: m, k: q }); }
        const cimJo = v.az === undefined || szogKul(ir - eszakSzog, v.az) <= 60;
        if (parok.length < 2) continue;
        // függőleges helyzet: a keret alja = padló + mellvéd (ajtó: 0). Többszintes homlokzaton minden szint kerete jelölt:
        // a párok szerinti lehetséges ±0,00-szintek közül az, amelyikkel a legtöbb nyílás egyezik, egyenlőség esetén a fal
        // sziluettjének aljához (a terephez) legközelebbi
        const jel: number[][] = parok.map(({ n: m }) => { const pm = m.pm ?? (m.mag >= 1.9 ? 0 : null); if (pm === null) return []; return v.keretek.filter((q) => Math.abs(q.szel - m.szel) <= SZT && Math.abs(e(q) - s(ir, m.x, m.y) - c) <= 0.25).map((q) => q.y1 + (zf + pm) / v.mPerPt); });
        const minden = jel.flat(); if (!minden.length) continue;
        let alja = -Infinity; for (let q = 0; q < v.ny.alja.length; q++) { const a = v.ny.alja[q]!; if (!Number.isNaN(a) && a > alja) alja = a; }
        let y0 = minden[0]!, egyezo = 0, tav = Infinity;
        for (const y of minden) {
          const db = jel.filter((l) => l.some((z) => Math.abs(z - y) * v.mPerPt <= 0.3)).length;
          const d = Math.abs(y - alja) * v.mPerPt;
          if (db > egyezo || (db === egyezo && d < tav)) { egyezo = db; y0 = y; tav = d; }
        }
        if (egyezo < 2) continue;
        // a homlokzat az irány falait lefedi-e (a falak oszlopaiban van fal-sziluett)
        const fl = falak.filter((f) => f.irany === ir);
        let L = 0, Lf = 0;
        for (const f of fl) {
          const ss = f.pontok.map(([x, y]) => s(ir, x, y)); if (!ss.length) continue;
          const xa = (Math.min(...ss) + c) / v.mPerPt, xb = (Math.max(...ss) + c) / v.mPerPt;
          const ca = Math.floor((xa - v.ny.x0) / v.ny.dx), cb = Math.ceil((xb - v.ny.x0) / v.ny.dx);
          for (let q = ca; q <= cb; q++) { L++; if (q >= 0 && q < v.ny.teto.length && !Number.isNaN(v.ny.teto[q]!)) Lf++; }
        }
        const fed = L ? Lf / L : 1;
        if (fed < 0.7) continue;
        const tam = egyezo + 3 * fed + (cimJo ? 0.5 : 0);
        if (leg && tam <= leg.tam) continue;
        leg = { v, o: c, y0, tam };
      }
      if (leg) jeloltek.push({ ...leg, ...{ ir } } as Illesztes & { ir: number });
    }
  }
  // mohó hozzárendelés: egy nézet egy irányhoz, egy irány egy nézethez (a legtöbb egyezés előbb)
  const ill = new Map<number, Illesztes>(); const foglalt = new Set<HomlokzatNezetAdat>();
  for (const j of (jeloltek as (Illesztes & { ir: number })[]).sort((a2, b2) => b2.tam - a2.tam)) {
    if (ill.has(j.ir) || foglalt.has(j.v)) continue;
    ill.set(j.ir, j); foglalt.add(j.v);
  }
  return {
    db: ill.size,
    leiras: [...ill.entries()].map(([ir, v]) => `${ir}→${v.v.az ?? '?'}@${Math.round(v.v.ny.bb[0])},${Math.round(v.v.ny.bb[1])} tám ${v.tam.toFixed(1)}`),
    magassag(irany, pontok, zf0, zc) {
      let il = ill.get(irany);
      if (!il) { let d = 11; for (const [ir, v] of ill) { const dd = szogKul(ir, irany); if (dd < d) { d = dd; il = v; } } }
      if (!il || !pontok.length) return null;
      const ss = pontok.map(([x, y]) => s(irany, x, y)); const s0 = Math.min(...ss), s1 = Math.max(...ss);
      const ny = il.v.ny; const mE = il.v.mPerPt; const xa = (s0 + il.o) / mE, xb = (s1 + il.o) / mE;
      const ca = Math.max(0, Math.floor((xa - ny.x0) / ny.dx)), cb = Math.min(ny.teto.length - 1, Math.ceil((xb - ny.x0) / ny.dx));
      const ossz = Math.max(1, Math.ceil((xb - xa) / ny.dx));
      let db = 0, sum = 0;
      for (let c = ca; c <= cb; c++) {
        const t = ny.teto[c]!, a = ny.alja[c]!; if (Number.isNaN(t)) continue;
        const zt = (il.y0 - t) * mE, za = (il.y0 - a) * mE;
        // a fal alja a lábazatnál (külön rétegen) rajzolódhat: a szint padlójáig számítjuk, ha 0,8 m-en belül van
        const also = za <= zf0 + 0.8 ? zf0 : za;
        sum += Math.max(0, Math.min(zt, zc) - also); db++;
      }
      return db >= 0.6 * ossz ? Math.round((sum / db) * 100) / 100 : null;
    },
  };
}
