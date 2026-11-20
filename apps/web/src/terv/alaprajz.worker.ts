/// <reference lib="webworker" />
// Az alaprajz felismerése háttérszálon: a felület közben nem akad meg (haladást küld), és a feldolgozás közbenső
// adatai (raszterváltozatok) a munkaszál leállításával felszabadulnak – nagy lapon így nem fogy el a memória.
import { alaprajzFeldolgoz } from '@terv/elemzes';

self.onmessage = (e: MessageEvent<{ id: number; args: Parameters<typeof alaprajzFeldolgoz> }>) => {
  const { id, args } = e.data;
  const post = (m: unknown) => (self as unknown as Worker).postMessage(m);
  try {
    const [lap, M, szurke, tinta, jegyzek, plusz] = args;
    const a = alaprajzFeldolgoz(lap, M, szurke, tinta, jegyzek, plusz, (szoveg) => post({ id, halad: szoveg }));
    post({ id, a });
  } catch (err) { post({ id, hiba: (err as Error).message }); }
};
