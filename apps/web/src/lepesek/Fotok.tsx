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

  async function hozzaad(lista: FileList | null, kat?: FotoKategoria) {
    if (!lista?.length) return;
    setHiba(''); setTolt(true);
    try {
      const ujak: Foto[] = [];
      let elsoCimlap = !vanCimlap;
      for (const f of Array.from(lista)) {
        if (!f.type.startsWith('image/')) { setHiba(`„${f.name}” nem kép.`); continue; }
        try {
          const t = await fotoTomorit(f);
          ujak.push({ id: ujId(), kategoria: kat ?? (elsoCimlap ? 'CoverPhoto' : 'Facade'), megjegyzes: f.name.replace(/\.[^.]+$/, ''), ...t });
          if (!kat || kat === 'CoverPhoto') elsoCimlap = false;
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
      <FotoCheklista p={p} hozzaad={hozzaad} />
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

/**
 * A tanúsítvány kötelező fotódokumentációja – 176/2008. (VI. 30.) Korm. rendelet 6. § (2a): jellegzetes homlokzatok
 * (egy az összefoglaló lapra), jellemző hőleadó és szabályozása, jellemző ablak, hőtermelő / hőtároló beépítési helyzetben
 * (egész épületnél, távhő kivételével), megújuló energiás rendszerek (ha vannak).
 */
function FotoCheklista({ p, hozzaad }: { p: Projekt; hozzaad: (l: FileList | null, kat?: FotoKategoria) => Promise<void> }) {
  const fotok = p.fotok ?? [];
  const db = (k: FotoKategoria[]) => fotok.filter((f) => k.includes(f.kategoria)).length;
  const gep = JSON.stringify(p.gepeszet);
  const megujulo = p.gepeszet.napelem.length > 0 || /hoszivattyu":true|napkollektor|kornyezeti_ho|biomassza|napenergia/.test(gep);
  const tavho = !!p.gepeszet.tavho;
  const meglevo = p.meta.kovetelmenySzint === 'meglevo';
  const tetelek: { pont: string; nev: string; kat: FotoKategoria; van: number; kell: boolean; megj?: string }[] = [
    { pont: 'a)', nev: 'Címlapfotó (az összefoglaló lapra)', kat: 'CoverPhoto', van: db(['CoverPhoto']), kell: true },
    { pont: 'a)', nev: 'Jellegzetes homlokzatok', kat: 'Facade', van: db(['Facade', 'CoverPhoto']), kell: true, megj: 'minden jellegzetes homlokzatról' },
    { pont: 'b)', nev: 'Jellemző hőleadó és szabályozása', kat: 'CharacteristicHeatExchanger', van: db(['CharacteristicHeatExchanger']), kell: true },
    { pont: 'c)', nev: 'Jellemző ablak', kat: 'CharacteristicOpeningStructure', van: db(['CharacteristicOpeningStructure']), kell: true },
    { pont: 'd)', nev: 'Hőtermelő, hőtároló beépítési helyzetben', kat: 'HeatGeneratorAndHeatStorageSituation', van: db(['HeatGeneratorAndHeatStorageSituation']), kell: !tavho, megj: tavho ? 'távhőnél nem kell' : 'egész épület tanúsításakor' },
    { pont: 'e)', nev: 'Megújuló energiás rendszerek', kat: 'RenewableSystem', van: db(['RenewableSystem']), kell: megujulo, megj: megujulo ? 'a gépészetben van megújuló rendszer' : 'csak ha van ilyen rendszer' },
  ];
  const hiany = tetelek.filter((t) => t.kell && !t.van).length;
  return (
    <details class="kartya" open={meglevo || undefined} style="margin-bottom:12px">
      <summary style="cursor:pointer;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <strong>Kötelező fotódokumentáció</strong>
        <span class={`jel ${hiany ? 'rossz' : 'jo'}`}>{hiany ? `${hiany} hiányzik` : 'teljes'}</span>
        <span class="halkabb">176/2008. Korm. rendelet 6. § (2a){meglevo ? ' – meglévő épület tanúsítása' : ''}</span>
      </summary>
      <table class="tabla" style="margin-top:8px;max-width:760px">
        <tbody>{tetelek.map((t) => (
          <tr style={t.kell ? '' : 'opacity:.6'}>
            <td style="width:28px">{t.van ? <span class="jel jo">{t.van}</span> : t.kell ? <span class="jel rossz">0</span> : <span class="halkabb">–</span>}</td>
            <td><span class="halkabb">{t.pont}</span> {t.nev}{t.megj && <small class="halkabb" style="display:block">{t.megj}</small>}</td>
            <td style="text-align:right;white-space:nowrap">
              <label class="gomb halk-gomb" style="cursor:pointer">Fotó hozzáadása<input type="file" accept="image/*" multiple capture="environment" style="display:none" onChange={(e) => { const i = e.target as HTMLInputElement; hozzaad(i.files, t.kat).then(() => { i.value = ''; }); }} /></label>
            </td>
          </tr>
        ))}</tbody>
      </table>
    </details>
  );
}
