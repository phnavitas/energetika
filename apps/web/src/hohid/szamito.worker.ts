/// <reference lib="webworker" />
import { megold, type Geometria, type Peremfeltetel } from './szamito';

self.onmessage = (e: MessageEvent<{ id: number; g: Geometria; pfs: Peremfeltetel[]; cel: number }>) => {
  const { id, g, pfs, cel } = e.data;
  try {
    const ms = pfs.map((pf) => megold(g, pf, cel));
    (self as unknown as Worker).postMessage({ id, ms }, ms.flatMap((m) => [m.tipus.buffer, m.T.buffer]) as Transferable[]);
  } catch (err) { (self as unknown as Worker).postMessage({ id, hiba: (err as Error).message }); }
};
