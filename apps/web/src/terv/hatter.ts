// Alaprajz-felismerés háttérszálon (Web Worker); minden laphoz új munkaszál, amely a végén leáll (a közbenső adatok
// felszabadulnak). Ha a worker nem indítható (pl. tartalombiztonsági szabály), szinkron tartalék.
import AlaprajzWorker from './alaprajz.worker?worker&inline';
import { alaprajzFeldolgoz, type AlaprajzFeldolgozas } from '@terv/elemzes';

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
