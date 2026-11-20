/// <reference lib="webworker" />
// PDF-lapok beolvasása (vektoros tartalom, előnézeti és szürkekép) háttérszálon: a pdf.js nagy lapon több GB átmeneti
// adatot (műveletlista, rajzolt útvonalak) hoz létre, amelyet a fő szál szemétgyűjtése csak jóval később szabadítana
// fel – a munkaszál leállításával azonnal felszabadul.
import { pdfLapok } from '@terv/elemzes';

self.onmessage = async (e: MessageEvent<{ id: number; f: File; kepSzel: number }>) => {
  const { id, f, kepSzel } = e.data;
  const post = (m: unknown, t?: Transferable[]) => (self as unknown as Worker).postMessage(m, t ?? []);
  // (OffscreenCanvas nélkül a fő szálon olvasunk)
  if (typeof OffscreenCanvas === 'undefined' || typeof FileReader === 'undefined') { post({ id, nincs: true }); return; }
  try {
    const lapok = await pdfLapok(f, kepSzel, (k, o) => post({ id, halad: [k, o] }));
    // a képpuffereket átadjuk (nem másoljuk)
    const t = new Set<ArrayBuffer>();
    for (const l of lapok) for (const k of [l.tinta, l.szurke]) if (k?.adat?.buffer instanceof ArrayBuffer) t.add(k.adat.buffer);
    post({ id, lapok }, [...t]);
  } catch (err) { post({ id, hiba: (err as Error).message ?? String(err) }); }
};
