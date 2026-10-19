import { useState } from 'preact/hooks';
import { ujId, FOTO_KATEGORIAK, type Foto, type FotoKategoria, type Projekt } from '../modell';

type Modosit = (fn: (p: Projekt) => void) => void;
const MAX_PX = 1280;
const MINOSEG = 0.78;

/** Kép betöltése és tömörítése JPEG-be (a hosszabbik oldal legfeljebb MAX_PX). */
export async function fotoTomorit(f: File): Promise<{ dataUrl: string; szel: number; mag: number }> {
  const bm = await createImageBitmap(f);
  const k = Math.min(1, MAX_PX / Math.max(bm.width, bm.height));
  const szel = Math.round(bm.width * k), mag = Math.round(bm.height * k);
  const c = document.createElement('canvas');
  c.width = szel; c.height = mag;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, szel, mag);
  ctx.drawImage(bm, 0, 0, szel, mag);
  bm.close();
  return { dataUrl: c.toDataURL('image/jpeg', MINOSEG), szel, mag };
}

const kbMeret = (d: string) => Math.round((d.length - d.indexOf(',') - 1) * 0.75 / 1024);

export function FotokSzakasz({ p, modosit }: { p: Projekt; modosit: Modosit }) {
  const fotok = p.fotok ?? [];
  const [hiba, setHiba] = useState('');
  const [tolt, setTolt] = useState(false);
  const vanCimlap = fotok.some((f) => f.kategoria === 'CoverPhoto');

  async function hozzaad(lista: FileList | null) {
    if (!lista?.length) return;
    setHiba(''); setTolt(true);
    try {
      const ujak: Foto[] = [];
      let elsoCimlap = !vanCimlap;
      for (const f of Array.from(lista)) {
        if (!f.type.startsWith('image/')) { setHiba(`„${f.name}” nem kép.`); continue; }
        try {
          const t = await fotoTomorit(f);
          ujak.push({ id: ujId(), kategoria: elsoCimlap ? 'CoverPhoto' : 'Facade', megjegyzes: f.name.replace(/\.[^.]+$/, ''), ...t });
          elsoCimlap = false;
        } catch { setHiba(`„${f.name}” nem olvasható (HEIC képet előbb JPEG-be kell menteni).`); }
      }
      if (ujak.length) modosit((q) => { (q.fotok ??= []).push(...ujak); });
    } finally { setTolt(false); }
  }

  const m = (id: string, fn: (f: Foto) => void) => modosit((q) => { const f = q.fotok?.find((x) => x.id === id); if (f) fn(f); });
  const osszKb = fotok.reduce((s, f) => s + kbMeret(f.dataUrl), 0);

  return (
    <section class="szakasz">
      <h2>Fotók</h2>
      <p class="halk" style="margin-bottom:12px">A címlapfotó a tanúsítványra és a jegyzőkönyvre kerül; minden fotó bekerül az e-tanúsítás XML-be a kiválasztott kategóriával. A képeket a program {MAX_PX} px-re tömöríti.</p>
      <label class={`foto-feltolto${tolt ? ' tolt' : ''}`}
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={(e) => { e.preventDefault(); hozzaad(e.dataTransfer?.files ?? null); }}>
        <input type="file" accept="image/*" multiple capture="environment" onChange={(e) => { const t = e.target as HTMLInputElement; hozzaad(t.files).then(() => { t.value = ''; }); }} />
        <strong>{tolt ? 'Feldolgozás…' : 'Fotó csatolása'}</strong>
        <span class="halkabb">Kattints, húzd ide, vagy telefonon fényképezz</span>
      </label>
      {hiba && <p class="jel rossz" style="margin-top:8px">{hiba}</p>}
      {fotok.length > 0 && <>
        <div class="foto-racs">
          {fotok.map((f) => (
            <figure class="foto">
              <img src={f.dataUrl} alt={f.megjegyzes || FOTO_KATEGORIAK.find((k) => k.ertek === f.kategoria)?.nev} loading="lazy" />
              <figcaption>
                <select aria-label="Kategória" value={f.kategoria} onChange={(e) => {
                  const v = (e.target as HTMLSelectElement).value as FotoKategoria;
                  modosit((q) => { for (const x of q.fotok ?? []) { if (x.id === f.id) x.kategoria = v; else if (v === 'CoverPhoto' && x.kategoria === 'CoverPhoto') x.kategoria = 'Facade'; } });
                }}>
                  {FOTO_KATEGORIAK.map((k) => <option value={k.ertek}>{k.nev}</option>)}
                </select>
                <input aria-label="Megjegyzés" placeholder="Megjegyzés" value={f.megjegyzes ?? ''} onInput={(e) => m(f.id, (x) => { x.megjegyzes = (e.target as HTMLInputElement).value; })} />
                <div class="foto-lab">
                  <span class="halkabb">{f.szel} × {f.mag} · {kbMeret(f.dataUrl)} kB</span>
                  <button class="gomb halk-gomb" onClick={() => modosit((q) => { q.fotok = q.fotok?.filter((x) => x.id !== f.id); })}>Törlés</button>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
        <p class="halkabb" style="margin-top:8px">{fotok.length} fotó, összesen {osszKb} kB{!vanCimlap ? ' · nincs címlapfotó kijelölve' : ''}{osszKb > 4000 ? ' · sok fotó lassítja a mentést, érdemes válogatni' : ''}</p>
      </>}
    </section>
  );
}
