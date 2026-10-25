import type { Projekt } from './modell';

type Letoltes = { save: (r: { filename: string; data: string | Blob }) => Promise<unknown> };
declare global { interface Window { claude?: { use: (n: string) => Promise<unknown> } } }

/** Letöltés: megosztott artifact-nézetben a platform mentési párbeszédén át, helyben közvetlen fájlként. */
export async function letolt(nev: string, tartalom: string | Uint8Array, tipus: string): Promise<string | null> {
  const adat = typeof tartalom === 'string' ? tartalom : new Blob([tartalom as BlobPart], { type: tipus });
  if (window.claude?.use) {
    const d = (await window.claude.use('downloads')) as Letoltes | null;
    if (d) {
      try { await d.save({ filename: nev, data: adat }); return null; } catch (e) {
        const kod = (e as { code?: string }).code;
        if (kod === 'declined') return null;
        if (kod === 'rejected_extension') return 'Ebben a megosztott nézetben ez a fájltípus nem menthető. Az XML-t a helyben futtatott alkalmazásból töltsd le.';
        return 'A mentés ebben a nézetben nem érhető el.';
      }
    }
  }
  const url = URL.createObjectURL(typeof adat === 'string' ? new Blob([adat], { type: tipus }) : adat);
  const a = document.createElement('a');
  a.href = url; a.download = nev; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return null;
}


/** A projekt mentése .json fájlba (a „Projekt megnyitása fájlból” ezt tölti vissza). */
export function projektFajlba(p: Projekt): Promise<string | null> {
  return letolt(`${(p.meta.nev || 'projekt').replace(/[^\p{L}\p{N} _-]/gu, '')}.json`, JSON.stringify(p, null, 1), 'application/json');
}
