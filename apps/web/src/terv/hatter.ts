// Alaprajz-felismerés háttérszálon (Web Worker); minden laphoz új munkaszál, amely a végén leáll (a közbenső adatok
// felszabadulnak). Ha a worker nem indítható (pl. tartalombiztonsági szabály), szinkron tartalék.
import AlaprajzWorker from './alaprajz.worker?worker&inline';
import OlvasoWorker from './olvaso.worker?worker';
import { alaprajzFeldolgoz, pdfLapok, type AlaprajzFeldolgozas, type TervLap } from '@terv/elemzes';

let workerHibas = false;
let sorszam = 0;

export async function alaprajzFeldolgozHatter(args: Parameters<typeof alaprajzFeldolgoz>, halad?: (szoveg: string) => void): Promise<AlaprajzFeldolgozas> {
  const szinkron = () => alaprajzFeldolgoz(args[0], args[1], args[2], args[3], args[4], args[5], halad);
  if (workerHibas || typeof Worker === 'undefined') return szinkron();
  let w: Worker;
  try { w = new AlaprajzWorker(); } catch { workerHibas = true; return szinkron(); }
  const id = ++sorszam;
  return new Promise<AlaprajzFeldolgozas>((ok, hiba) => {
    let kesz = false, elindult = false;
    const vege = () => { kesz = true; w.terminate(); };
    w.onmessage = (e: MessageEvent<{ id: number; a?: AlaprajzFeldolgozas; hiba?: string; halad?: string }>) => {
      if (e.data.id !== id || kesz) return;
      if (e.data.halad !== undefined) { elindult = true; halad?.(e.data.halad); return; }
      vege();
      if (e.data.a) ok(e.data.a); else hiba(new Error(e.data.hiba ?? 'A feldolgozás nem sikerült.'));
    };
    // a worker nem indult el / összeomlott: szinkron tartalék (indítási hibánál a további lapokra is)
    // (ha már dolgozott és közben állt le – pl. elfogyott a memória –, nem ismételjük a fő szálon: hibaüzenet)
    w.onerror = (ev) => {
      if (kesz) return; vege(); ev.preventDefault?.();
      if (elindult) { hiba(new Error('A lap feldolgozása közben elfogyott a memória vagy hiba történt – a lap túl nagy / túl részletes (próbáld kisebb részletre vágott PDF-fel).')); return; }
      workerHibas = true; try { ok(szinkron()); } catch (e) { hiba(e as Error); }
    };
    try { w.postMessage({ id, args }); } catch { vege(); try { ok(szinkron()); } catch (e) { hiba(e as Error); } }
  });
}

let olvasoHibas = false;

/**
 * PDF-fájl lapjainak beolvasása háttérszálon (fájlonként új munkaszál, amely a végén leáll – a pdf.js átmeneti adatai
 * így azonnal felszabadulnak). Ha a munkaszál nem indítható / nem támogatott (OffscreenCanvas nélkül, egyfájlos
 * előnézetben), vagy hibával áll le, a fő szálon olvasunk.
 */
export async function pdfLapokHatter(f: File, kepSzel = 2000, halad?: (kesz: number, ossz: number) => void): Promise<TervLap[]> {
  const fo = () => pdfLapok(f, kepSzel, halad);
  if (olvasoHibas || typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return fo();
  let w: Worker;
  try { w = new OlvasoWorker(); } catch { olvasoHibas = true; return fo(); }
  const id = ++sorszam;
  return new Promise<TervLap[]>((ok, hiba) => {
    let kesz = false, elindult = false;
    const vege = () => { kesz = true; w.terminate(); };
    const tartalek = (vegleges: boolean) => { vege(); if (vegleges) olvasoHibas = true; fo().then(ok, hiba); };
    w.onmessage = (e: MessageEvent<{ id: number; lapok?: TervLap[]; hiba?: string; halad?: [number, number]; nincs?: boolean }>) => {
      if (e.data.id !== id || kesz) return;
      if (e.data.halad) { elindult = true; halad?.(e.data.halad[0], e.data.halad[1]); return; }
      if (e.data.nincs) { tartalek(true); return; }
      if (e.data.lapok) { vege(); ok(e.data.lapok); return; }
      // (hiba a munkaszálon – pl. a pdf.js ott nem tud megjeleníteni valamit –: a fő szálon újra)
      tartalek(false);
    };
    w.onerror = (ev) => { if (kesz) return; ev.preventDefault?.(); tartalek(!elindult); };
    try { w.postMessage({ id, f, kepSzel }); } catch { tartalek(true); }
  });
}
