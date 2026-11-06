/**
 * Homlokzati nézet geometriája rétegzett PDF-ből (ArchiCAD): a fal-réteg kitöltött felületeinek uniója nézetenként a
 * homlokzat látható falfelülete (a nyílászárókkal együtt – bruttó), a tető-réteg a tetősík, a terep / lábazat réteg az
 * alsó határ. Nézetenként: szélesség, falmagasság-profil a szélesség mentén, bruttó falfelület (m²).
 */
import type { Lap, Utvonal } from './kinyeres';
import { poliRajzol } from './raszter';

export interface HomlokzatNezet {
  /** A nézet befoglalója a lapon (pt). */
  bb: [number, number, number, number];
  /** A falfelület szélessége és bruttó felülete (m, m²) – a kitöltött fal-réteg felületek uniója. */
  szel: number; A: number;
  /** Falmagasság (m) a szélesség mentén 0,25 m-enként (a fal alsó és felső éle közt, nyílásokkal együtt). */
  profil: number[];
  /** A tető-réteg felső éle (gerinc) és alsó éle (eresz) a fal aljához mérve (m), ha van. */
  gerinc?: number; eresz?: number;
}

const FAL = /\bfal\b|fal-szerk|falak|főfal|fal,|tartószerkezet|pillér|homlokzati hőszig|hőszigetelés/i;
const NEM_FAL = /válaszfal|csempe|burkolat|támfal|kerítés|lábazat|terep|tető|héj|födém/i;
const TETO = /tető|héj|ácsszerk|roof|fedél|fedés/i;

const falE = (u: Utvonal) => !!u.reteg && FAL.test(u.reteg) && !NEM_FAL.test(u.reteg) && u.muvelet !== 'stroke' && u.muvelet !== 'none';
const tetoE = (u: Utvonal) => !!u.reteg && TETO.test(u.reteg);

export function homlokzatNezetek(lap: Lap, mPerPt: number): HomlokzatNezet[] {
  const falak = lap.utvonalak.filter(falE);
  if (!falak.length) return [];
  // nézetek: a fal-felületek befoglalóinak 1,5 m-en belül egymásba érő csoportjai
  const tav = 1.5 / mPerPt; const n = falak.length; const sz = falak.map((_, i) => i);
  const gy = (i: number): number => (sz[i] === i ? i : (sz[i] = gy(sz[i]!)));
  const sorrend = falak.map((u, i) => ({ i, x0: u.bbox[0] })).sort((a, b) => a.x0 - b.x0);
  for (let a = 0; a < n; a++) {
    const A = falak[sorrend[a]!.i]!.bbox;
    for (let b = a + 1; b < n; b++) {
      const B = falak[sorrend[b]!.i]!.bbox; if (B[0] > A[2] + tav) break;
      if (B[1] <= A[3] + tav && A[1] <= B[3] + tav) sz[gy(sorrend[a]!.i)] = gy(sorrend[b]!.i);
    }
  }
  const cs = new Map<number, Utvonal[]>(); falak.forEach((u, i) => { const g = gy(i); cs.set(g, [...(cs.get(g) ?? []), u]); });
  const teto = lap.utvonalak.filter(tetoE);
  const ki: HomlokzatNezet[] = [];
  const px = 0.05; // m / rácspont
  for (const l of cs.values()) {
    const bb: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const u of l) { bb[0] = Math.min(bb[0], u.bbox[0]); bb[1] = Math.min(bb[1], u.bbox[1]); bb[2] = Math.max(bb[2], u.bbox[2]); bb[3] = Math.max(bb[3], u.bbox[3]); }
    const wM = (bb[2] - bb[0]) * mPerPt, hM = (bb[3] - bb[1]) * mPerPt;
    if (wM < 3 || hM < 1.5 || wM * hM < 15) continue;
    const w = Math.ceil(wM / px) + 1, h = Math.ceil(hM / px) + 1; const M = new Uint8Array(w * h);
    const tr = (x: number, y: number): [number, number] => [(x - bb[0]) * mPerPt / px, (y - bb[1]) * mPerPt / px];
    for (const u of l) poliRajzol(M, w, h, u.pontok, tr);
    let db = 0; const profil: number[] = []; const lepes = Math.max(1, Math.round(0.25 / px));
    for (let x = 0; x < w; x++) { let c = 0; for (let y = 0; y < h; y++) if (M[y * w + x]) c++; db += c; if (x % lepes === 0) profil.push(Math.round(c * px * 100) / 100); }
    const A = Math.round(db * px * px * 10) / 10;
    // a nézethez tartozó tető: a befoglaló fölött / körül átfedő tető-elemek
    const t = teto.filter((u) => u.bbox[2] > bb[0] && u.bbox[0] < bb[2] && u.bbox[3] > bb[1] - 15 / mPerPt && u.bbox[1] < bb[3]);
    const alja = bb[3];
    const tf = t.reduce((a, u) => Math.min(a, u.bbox[1]), Infinity), ta = t.reduce((a, u) => Math.max(a, u.bbox[3]), -Infinity);
    const gerinc = t.length ? Math.round((alja - tf) * mPerPt * 100) / 100 : undefined;
    const eresz = t.length ? Math.round((alja - ta) * mPerPt * 100) / 100 : undefined;
    ki.push({ bb, szel: Math.round(wM * 100) / 100, A, profil, ...(gerinc !== undefined ? { gerinc, eresz } : {}) });
  }
  return ki.sort((a, b) => a.bb[1] - b.bb[1] || a.bb[0] - b.bb[0]);
}

/** Egy homlokzati nézet oszloponként: a fal-réteg legfelső és legalsó pontja (lap-y, pt; NaN: nincs fal az oszlopban). */
export interface NezetOszlopok { bb: [number, number, number, number]; x0: number; dx: number; teto: Float32Array; alja: Float32Array }

/** A nézetek oszlopprofilja (≈ 5 cm-es oszlopok) – a homlokzat és az alaprajz összevetéséhez. */
export function nezetOszlopok(lap: Lap, mPerPt: number): NezetOszlopok[] {
  const px = 0.05, ki: NezetOszlopok[] = [];
  for (const v of homlokzatNezetek(lap, mPerPt)) {
    const bb = v.bb; const wM = (bb[2] - bb[0]) * mPerPt, hM = (bb[3] - bb[1]) * mPerPt;
    const w = Math.ceil(wM / px) + 1, h = Math.ceil(hM / px) + 1; const M = new Uint8Array(w * h);
    const tr = (x: number, y: number): [number, number] => [(x - bb[0]) * mPerPt / px, (y - bb[1]) * mPerPt / px];
    for (const u of lap.utvonalak) if (falE(u) && u.bbox[0] >= bb[0] - 1 && u.bbox[2] <= bb[2] + 1 && u.bbox[1] >= bb[1] - 1 && u.bbox[3] <= bb[3] + 1) poliRajzol(M, w, h, u.pontok, tr);
    const teto = new Float32Array(w).fill(NaN), alja = new Float32Array(w).fill(NaN);
    for (let x = 0; x < w; x++) {
      let a = -1, b = -1; for (let y = 0; y < h; y++) if (M[y * w + x]) { if (a < 0) a = y; b = y; }
      if (a >= 0) { teto[x] = bb[1] + (a * px) / mPerPt; alja[x] = bb[1] + ((b + 1) * px) / mPerPt; }
    }
    ki.push({ bb, x0: bb[0], dx: px / mPerPt, teto, alja });
  }
  return ki;
}
