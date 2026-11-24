/// <reference lib="webworker" />
// A tervlapok illesztése háttérszálon (tengelyjel → méretlánc → geometria): a felület közben nem akad meg.
// 1) a lapok egyenként érkeznek (a másolás így nem akasztja meg a fő szálat), 2) a referencia alaprajz kiválasztása →
// a fő szál visszaküldi a hozzá tartozó feldolgozást, 3) itt készül a hőburok-kontúr és az illesztés.
import { lapokIllesztese, referenciaLap, type IllBeLap } from '@terv/lapIllesztes';
import type { AlaprajzFeldolgozas } from '@terv/elemzes';
import { burokFelismertSik } from './folyamat';

let lapok: IllBeLap[] = [];
let ref = -1;
const post = (m: unknown) => (self as unknown as Worker).postMessage(m);
self.onmessage = (e: MessageEvent<{ id: number; i?: number; lap?: IllBeLap; kesz?: boolean; a?: AlaprajzFeldolgozas; fut?: number[]; eszak?: number | null }>) => {
  const d = e.data;
  try {
    if (d.lap && d.i !== undefined) { lapok[d.i] = d.lap; return; }
    if (d.kesz) { ref = referenciaLap(lapok); post({ id: d.id, ref }); return; }
    const a = d.a; if (!a) { post({ id: d.id, e: lapokIllesztese(lapok, ref, null, [], d.eszak ?? null) }); return; }
    let kontur: [number, number][][] = [];
    try { kontur = a.r ? (burokFelismertSik(a.r, new Set(d.fut ?? []), lapok[ref]?.lap, a, false) as [number, number][][]) : []; } catch { kontur = []; }
    post({ id: d.id, e: lapokIllesztese(lapok, ref, a.r3d ?? a.r ?? null, kontur, d.eszak ?? null) });
  } catch (err) { post({ id: d.id, hiba: (err as Error).message }); }
};
