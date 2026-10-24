/**
 * Távhőszolgáltatók által közzétett súlyozó tényezők (9/2023 ÉKM 8. § (1)). A beépített lista a szolgáltatói oldalak
 * 2026. 02. 16-i állapota (2025. évi adatok); az /api/tavho végpont havonta frissített értékeket ad.
 * Ha a szolgáltató nem végezte el a 8. melléklet szerinti számítást, a 7. melléklet alapértéke (1,38 / 0 / 374) érvényes.
 */
import type { TavhoSulyozo } from './modell';
import { TAVHO_KIOLVASOTT } from './tavhoKiolvasott';

export interface TavhoRendszer { szolgaltato: string; telepules: string; rendszer: string; fnren: number; fren: number; fCO2: number | null; adatEv?: number | null; forras: string; frissitve?: string | null; eepites?: { szolgaltatoId: number; dokId: number; dokEv: number } }

export const TAVHO_ALAP = { fnren: 1.38, fren: 0, fCO2: 374 } as const;

export const TAVHO_BEEPITETT: TavhoRendszer[] = [
  { szolgaltato: 'Veolia – Tata', telepules: 'Tata', rendszer: 'Tata Városi rendszer', fnren: 0.85, fren: 1.056, fCO2: 211.428, adatEv: 2025, forras: 'https://tavho.veolia.hu/tata/primerenergiatenyezo-tata', frissitve: '2026.02.16' },
  { szolgaltato: 'Veolia – Tata', telepules: 'Tata', rendszer: 'Tata Gesztenye fasor (alapérték)', fnren: 1.38, fren: 0, fCO2: 374, forras: 'https://tavho.veolia.hu/tata/primerenergiatenyezo-tata', frissitve: '2026.02.16' },
  { szolgaltato: 'BAKONY-TÁVHŐ Kft.', telepules: 'Ajka', rendszer: 'Ajka', fnren: 0.149, fren: 0.547, fCO2: 30.369, adatEv: 2025, forras: 'https://tavho.veolia.hu/bakonytavho_kft/epuletek-energetikai-bakonytavho', frissitve: '2026.02.16' },
  { szolgaltato: 'NÁNÁSHŐ Kft.', telepules: 'Hajdúnánás', rendszer: 'Hajdúnánás', fnren: 1.143, fren: 0.006, fCO2: 305.955, adatEv: 2025, forras: 'https://tavho.veolia.hu/nanasho_kft/epuletek-energetikai-nanasho', frissitve: '2026.02.16' },
  { szolgaltato: 'Veolia – Dorog', telepules: 'Dorog', rendszer: 'Dorog (alapérték)', fnren: 1.38, fren: 0, fCO2: 374, forras: 'https://tavho.veolia.hu/dorog/epuletenergetika-dorog', frissitve: '2026.02.16' },
  // e-építés távhő-lekérdező (tanúsító által ellenőrizve, 2026.10.24)
  // a szkennelt e-építés adatszolgáltatások kézzel kiolvasott sorai (tavhoKiolvasott.ts)
  ...Object.entries(TAVHO_KIOLVASOTT).flatMap(([dok, d]) => d.elavult ? [] : d.sorok.filter((r) => r.fCO2 !== null).map((r): TavhoRendszer => ({
    szolgaltato: d.szolgaltato, telepules: r.telepules, rendszer: r.rendszer, fnren: r.fnren, fren: r.fren, fCO2: r.fCO2, adatEv: d.adatEv,
    forras: `https://www.e-epites.hu/e-tanusitas/tavho/nyilvanos/download?id=${dok}`, frissitve: d.kelt, eepites: { szolgaltatoId: d.szolgaltatoId, dokId: Number(dok), dokEv: Number(d.kelt.slice(0, 4)) },
  }))),
];

/** Az online (havonta frissülő) lista; hiba esetén a beépített. */
export async function tavhoLista(friss = false): Promise<{ lista: TavhoRendszer[]; online: boolean; lekerve?: string; hibak?: string[] }> {
  try {
    const v = await fetch(`/api/tavho${friss ? '?friss=1' : ''}`);
    if (!v.ok) throw new Error(String(v.status));
    const j = await v.json() as { lekerve: string; rendszerek: TavhoRendszer[]; hibak: string[] };
    if (!j.rendszerek?.length) throw new Error('üres');
    const online = j.rendszerek.map((r) => ({ ...r, rendszer: r.rendszer || r.telepules }));
    // az online forrásban nem szereplő szolgáltatók beépített sorai megmaradnak
    const vanOnline = new Set(online.map((r) => r.szolgaltato));
    const lista = [...online, ...TAVHO_BEEPITETT.filter((r) => !vanOnline.has(r.szolgaltato))].sort((a, b) => a.telepules.localeCompare(b.telepules, 'hu'));
    return { lista, online: true, lekerve: j.lekerve, hibak: j.hibak };
  } catch {
    return { lista: TAVHO_BEEPITETT, online: false };
  }
}

export const tavhoSulyozobol = (r: TavhoRendszer): TavhoSulyozo => ({
  szolgaltato: r.szolgaltato, rendszer: r.rendszer, fnren: r.fnren, fren: r.fren, fCO2: r.fCO2 ?? TAVHO_ALAP.fCO2,
  ...(r.adatEv ? { adatEv: r.adatEv } : {}), forras: r.forras, ...(r.frissitve ? { frissitve: r.frissitve } : {}),
  ...(r.eepites ? { eepites: r.eepites } : {}),
});

// ---------------------------------------------------------------------------------------------
// e-építés (Lechner) távhőszolgáltatói nyilvántartás – a worker proxyn át, a PDF-et a böngésző olvassa ki

import type { TavhoPdfEredmeny } from './tavhoPdf';

export const EEPITES_DOK = (id: number) => `https://www.e-epites.hu/e-tanusitas/tavho/nyilvanos/download?id=${id}`;
export interface EepitesSzolgaltato {
  id: number; rovidNev: string; teljesNev: string; szekhely: string; dokId: number | null; reszletek: string;
  telepulesek: string[]; dokumentumok: { ev: number; id: number; nev: string }[];
}

export async function eepitesKeres(p: { telepules?: string; szolgaltato?: string }, friss = false): Promise<EepitesSzolgaltato[]> {
  const q = new URLSearchParams({ telepules: p.telepules ?? '', szolgaltato: p.szolgaltato ?? '', ...(friss ? { friss: '1' } : {}) });
  let v: Response;
  try { v = await fetch(`/api/tavho/keres?${q}`); } catch { throw new Error('Az e-építés lekérdezés nem érhető el (hálózati hiba).'); }
  const ct = v.headers.get('content-type') ?? '';
  if (!ct.includes('json')) throw new Error('Az e-építés lekérdezés csak a telepített (online) változatban érhető el.');
  const j = await v.json() as { szolgaltatok?: EepitesSzolgaltato[]; hiba?: string };
  if (!v.ok || !j.szolgaltatok) throw new Error(j.hiba ?? `HTTP ${v.status}`);
  return j.szolgaltatok;
}

/** A legutóbbi (legmagasabb évű) adatszolgáltatás. */
export const legutobbiDok = (s: EepitesSzolgaltato) => [...s.dokumentumok].sort((a, b) => b.ev - a.ev || b.id - a.id)[0] ?? (s.dokId ? { ev: 0, id: s.dokId, nev: '' } : null);

export async function eepitesPdf(dokId: number, halad?: (s: string) => void, ocrMindenkepp = false): Promise<TavhoPdfEredmeny> {
  const { tavhoSorRendben } = await import('./tavhoPdf');
  const k = TAVHO_KIOLVASOTT[dokId];
  if (k && !ocrMindenkepp) return { adatEv: k.adatEv, szkennelt: true, forras: 'kezi', ...(k.elavult ? { elavult: k.elavult } : {}), sorok: k.sorok.map((r) => ({ ...r, ellenorzott: tavhoSorRendben(r) })) };
  const v = await fetch(`/api/tavho/pdf?id=${dokId}`);
  if (!v.ok || !(v.headers.get('content-type') ?? '').includes('pdf')) throw new Error(`A dokumentum nem tölthető le (HTTP ${v.status}).`);
  const adat = await v.arrayBuffer();
  const { tavhoPdfOlvas } = await import('./tavhoPdf');
  const r = await tavhoPdfOlvas(adat.slice(0));
  if (!r.szkennelt) return { ...r, forras: 'szoveg' };
  halad?.('szkennelt dokumentum – szövegfelismerés…');
  const { tavhoOcr } = await import('./tavhoOcr');
  const o = await tavhoOcr(adat, halad);
  return { adatEv: k?.adatEv ?? null, sorok: o.sorok, szkennelt: true, forras: 'ocr', ...(o.tnm ? { elavult: '7/2006 TNM szerinti adatszolgáltatás – 9/2023 ÉKM szerinti tényező nincs, a 7. melléklet alapértéke érvényes.' } : {}) };
}
