/**
 * A metszet rajzolatából (rétegzett PDF: a fal- / tartószerkezet-réteg átmetszett kitöltései) kiolvasott geometria.
 * Térdfal: a födémsávra (vízszintes, ≥ 3 m széles, 12–60 cm vastag kitöltés) a széléhez közel (≤ 1,2 m) ráálló, felül
 * szabadon végződő (fölötte nincs födém) függőleges falkitöltés magassága – a tetőtéri padló és a tetősík / koszorú közt.
 */
import type { Lap, Utvonal } from './kinyeres';

const FAL = /\bfal\b|fal-szerk|falak|főfal|fal,|tartószerkezet|pillér|\bvb\b|födém/i;
const NEM = /válasz|burkolat|csempe|bútor|terep|magasság|méretez|felirat|környezet/i;
const EPULET = /épület|egyéb szerkezeti/i;

export function terdfalGeometria(lap: Lap, mPerPt: number): number | null {
  // kitöltés, vagy (a csak vonallal rajzoló irodáknál, pl. „_ÉPÜLET” réteg) zárt körvonal
  const zartE = (u: Utvonal) => u.pontok.some((p) => p.length >= 8 && Math.hypot(p[0]! - p[p.length - 2]!, p[1]! - p[p.length - 1]!) < 0.5) || u.zart.some(Boolean);
  const fills = lap.utvonalak.filter((u) => !!u.reteg && (FAL.test(u.reteg) || EPULET.test(u.reteg)) && !NEM.test(u.reteg) && u.muvelet !== 'none' && (u.muvelet !== 'stroke' || zartE(u)));
  if (!fills.length) return null;
  const m = (v: number) => v * mPerPt;
  const fodem = fills.filter((u) => m(u.bbox[2] - u.bbox[0]) >= 3 && m(u.bbox[3] - u.bbox[1]) >= 0.12 && m(u.bbox[3] - u.bbox[1]) <= 0.6);
  // függőleges falkitöltések, az egymásra rakott darabok (koszorú, falazat) oszlopba fűzve
  const fd = fills.filter((u) => { const w = m(u.bbox[2] - u.bbox[0]); return w >= 0.1 && w <= 0.8 && m(u.bbox[3] - u.bbox[1]) >= 0.1; })
    .map((u) => [...u.bbox] as [number, number, number, number]).sort((a, b) => a[0] - b[0] || a[3] - b[3]);
  const osz: [number, number, number, number][] = [];
  for (const b of fd) {
    const o = osz.find((c) => Math.min(c[2], b[2]) - Math.max(c[0], b[0]) > 0.5 * Math.min(c[2] - c[0], b[2] - b[0]) && (Math.abs(c[1] - b[3]) <= 0.05 / mPerPt || Math.abs(b[1] - c[3]) <= 0.05 / mPerPt || (b[1] < c[3] && b[3] > c[1])));
    if (o) { o[0] = Math.min(o[0], b[0]); o[1] = Math.min(o[1], b[1]); o[2] = Math.max(o[2], b[2]); o[3] = Math.max(o[3], b[3]); } else osz.push(b);
  }
  const jel: number[] = [];
  for (const c of osz) {
    const h = m(c[3] - c[1]); if (h < 0.3 || h > 2.2) continue;
    const cx = (c[0] + c[2]) / 2;
    // a fal alja a födém tetején, a födém széléhez közel
    const f = fodem.find((s) => Math.abs(s.bbox[1] - c[3]) <= 0.08 / mPerPt && cx >= s.bbox[0] - 1.2 / mPerPt && cx <= s.bbox[2] + 1.2 / mPerPt && (m(Math.abs(cx - s.bbox[0])) <= 1.2 || m(Math.abs(cx - s.bbox[2])) <= 1.2));
    if (!f) continue;
    // fölötte (0,5 m-en belül) nincs födém – a fal a tetőbe fut, nem a következő szint födémjébe
    if (fodem.some((s) => s !== f && s.bbox[3] <= c[1] + 0.05 / mPerPt && s.bbox[3] >= c[1] - 0.5 / mPerPt && s.bbox[0] <= cx && s.bbox[2] >= cx)) continue;
    jel.push(Math.round(h * 100) / 100);
  }
  if (!jel.length) return null;
  jel.sort((a, b) => a - b);
  return jel[Math.floor((jel.length - 1) / 2)]!;
}

export type { Utvonal };
