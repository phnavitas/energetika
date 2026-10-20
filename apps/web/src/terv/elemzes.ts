/**
 * A tervlapok teljes feldolgozása: PDF megnyitása pdf.js-szel (böngészőben, munkaszál nélkül), lapok szerepének
 * felismerése, alaprajz (helyiségek, északjel, raszter, külső falak, nyílászárók) és metszet (rétegrendek, szintek).
 */
import { lapKinyer, type Lap } from './kinyeres';
import { alaprajzElemez, type AlaprajzEredmeny, type TervHelyiseg } from './alaprajz';
import { raszterEpit, type Raszter } from './raszter';
import { kotaEllenoriz } from './kota';
import { nyilasFeliratok, nyilasokHozzarendel, type TervNyilas } from './nyilaszarok';
import { retegrendBlokkok, szerepBecsles, retegekEpit, szintekKeres, type TervRetegrend, type SzerepBecsles, type TervRetegUI, type SzintEredmeny } from './metszet';
import { ujId } from '../modell';

export interface TervLap {
  fajl: string; oldal: number;
  szerep: 'alaprajz' | 'metszet' | 'egyeb';
  cim: string;
  lap: Lap;
  /** Előnézeti kép (JPEG dataURL) és mérete pixelben. */
  kep: string; kepSzel: number; kepMag: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfJs = any;
let pdfjsBetoltve: Promise<PdfJs> | null = null;
async function pdfjsBetolt(): Promise<PdfJs> {
  pdfjsBetoltve ??= (async () => {
    const pdfjs = await import('pdfjs-dist');
    // a munkaszálat a fő szálon futtatjuk (egyfájlos előnézetben és szigorú CSP mellett is működik)
    const g = globalThis as unknown as { pdfjsWorker?: unknown };
    g.pdfjsWorker ??= await import('pdfjs-dist/build/pdf.worker.min.mjs');
    return pdfjs;
  })();
  return pdfjsBetoltve;
}

export function lapSzerep(lap: Lap): { szerep: TervLap['szerep']; cim: string } {
  const sz = lap.szovegek.map((t) => t.s).join(' \n ');
  const cim = lap.szovegek.filter((t) => t.meret >= 12 && /alaprajz|metszet|homlokzat|helyszínrajz|tetőfelülnézet/i.test(t.s)).map((t) => t.s.trim())[0] ?? '';
  if (/metszet/i.test(cim)) return { szerep: 'metszet', cim };
  if (/alaprajz/i.test(cim)) return { szerep: 'alaprajz', cim };
  if (/rétegrend/i.test(sz) && /[±+]\d,\d{2}/.test(sz)) return { szerep: 'metszet', cim: cim || 'Metszet' };
  if (/\d+[,.]\d{2}\s*m(²|2)/.test(sz)) return { szerep: 'alaprajz', cim: cim || 'Alaprajz' };
  return { szerep: 'egyeb', cim: cim || 'Egyéb lap' };
}

export async function pdfLapok(f: File, kepSzel = 2000): Promise<TervLap[]> {
  const pdfjs = await pdfjsBetolt();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await f.arrayBuffer()), verbosity: 0, isEvalSupported: false }).promise;
  const ki: TervLap[] = [];
  for (let n = 1; n <= Math.min(doc.numPages, 30); n++) {
    const page = await doc.getPage(n);
    const lap = await lapKinyer(pdfjs, page);
    const vp0 = page.getViewport({ scale: 1 });
    const scale = Math.min(3, kepSzel / vp0.width);
    const vp = page.getViewport({ scale });
    const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const ctx = c.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp, canvas: c }).promise;
    const { szerep, cim } = lapSzerep(lap);
    ki.push({ fajl: f.name, oldal: n, szerep, cim, lap, kep: c.toDataURL('image/jpeg', 0.82), kepSzel: c.width, kepMag: c.height });
    page.cleanup();
  }
  await doc.destroy();
  return ki;
}

export interface AlaprajzFeldolgozas {
  e: AlaprajzEredmeny;
  /** A raszter magjai: a pecséttel rendelkező, nem külső terű helyiségek (a raszter-indexek ehhez igazodnak). */
  magHelyisegek: TervHelyiseg[];
  r: Raszter | null;
  nyilasok: TervNyilas[];
}

export function alaprajzFeldolgoz(lap: Lap, meretarany?: number): AlaprajzFeldolgozas {
  const e = alaprajzElemez(lap);
  if (meretarany && meretarany > 0) { e.meretarany = meretarany; e.mPerPt = (25.4 / 72) / 1000 * meretarany; }
  const magHelyisegek = e.helyisegek.filter((h) => h.forras === 'pecset' && !h.kulter);
  if (!e.mPerPt || !magHelyisegek.length) return { e, magHelyisegek, r: null, nyilasok: [] };
  const r = raszterEpit(lap, e.mPerPt, magHelyisegek.map((h) => h.mutato ?? h));
  kotaEllenoriz(r, lap.szovegek);
  const nyilasok = nyilasokHozzarendel(nyilasFeliratok(lap.szovegek), r);
  return { e, magHelyisegek, r, nyilasok };
}

export interface MetszetFeldolgozas {
  blokkok: { rr: TervRetegrend; becsles: SzerepBecsles; retegek: TervRetegUI[] }[];
  szintek: SzintEredmeny;
}

export function metszetFeldolgoz(lap: Lap): MetszetFeldolgozas {
  const b = retegrendBlokkok(lap.szovegek);
  return {
    blokkok: b.map((rr) => { const becsles = szerepBecsles(rr, b); return { rr, becsles, retegek: retegekEpit(rr, becsles, ujId) }; }),
    szintek: szintekKeres(lap.szovegek),
  };
}

// ——— északjel-javítások megjegyzése (alakonként) ———

const JAVITAS_KULCS = 'ekm-eszakjel-javitas-v2';
/** Ismert irodai északjelek: az alak ujjlenyomata → a becsült iránytól való elteres (fok). */
const ISMERT: Record<string, number> = {
  // (a PH Navitas jelénél az alakbecslés helyes iránya ellenőrzött – nincs szükség javításra)
};
export function eszakJavitas(alairas: string | undefined): number {
  if (!alairas) return 0;
  try { const t = JSON.parse(localStorage.getItem(JAVITAS_KULCS) ?? '{}') as Record<string, number>; if (alairas in t) return t[alairas]!; } catch { /* nincs tároló */ }
  return ISMERT[alairas] ?? 0;
}
export function eszakJavitasMent(alairas: string | undefined, elteres: number) {
  if (!alairas) return;
  try { const t = JSON.parse(localStorage.getItem(JAVITAS_KULCS) ?? '{}') as Record<string, number>; t[alairas] = ((elteres % 360) + 360) % 360; localStorage.setItem(JAVITAS_KULCS, JSON.stringify(t)); } catch { /* nincs tároló */ }
}
