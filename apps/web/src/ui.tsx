import type { ComponentChildren } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';

export function Mezo(p: { cim: string; sugo?: string; szeles?: boolean; rovid?: boolean; children: ComponentChildren }) {
  return (
    <label class={`mezo${p.szeles ? ' szeles' : ''}${p.rovid ? ' rovid' : ''}`}>
      <span>{p.cim}</span>
      {p.children}
      {p.sugo && <small>{p.sugo}</small>}
    </label>
  );
}

export function Szoveg(p: { ertek: string; valt: (v: string) => void; hely?: string }) {
  return <input type="text" value={p.ertek} placeholder={p.hely} onInput={(e) => p.valt((e.target as HTMLInputElement).value)} />;
}

/** Tizedesvesszős számmező: gépelés közben a beírt szöveget tartja, elhagyáskor magyar formára alakít. */
export function Szam(p: { ertek: number | undefined; valt: (v: number) => void; egyseg?: string; lepes?: number; min?: number; cimke?: string; /** csak kilépéskor / Enterre ír vissza (pl. származtatott összeg) */ kilepeskor?: boolean }) {
  const [szerk, setSzerk] = useState<string | null>(null);
  const megj = p.ertek === undefined || Number.isNaN(p.ertek) ? '' : String(Number(p.ertek.toFixed(6))).replace('.', ',');
  const ertelmez = (t: string) => parseFloat(t.replace(/\s/g, '').replace(',', '.'));
  const vegleges = (t: string) => { const v = ertelmez(t); if (!Number.isNaN(v) && t !== megj) p.valt(v); };
  const input = (
    <input
      type="text" inputMode="decimal" aria-label={p.cimke} class="szammezo"
      value={szerk ?? megj}
      onFocus={() => setSzerk(megj)}
      onBlur={(e) => { if (p.kilepeskor) vegleges((e.target as HTMLInputElement).value); setSzerk(null); }}
      onKeyDown={(e) => { if (p.kilepeskor && e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      onInput={(e) => {
        const t = (e.target as HTMLInputElement).value;
        setSzerk(t);
        if (p.kilepeskor) return;
        const v = ertelmez(t);
        if (!Number.isNaN(v) && (p.min === undefined || v >= p.min)) p.valt(v);
      }}
    />
  );
  return p.egyseg ? <div class="egyseg">{input}<em>{p.egyseg}</em></div> : input;
}

export function Valaszto<T extends string>(p: { ertek: T | undefined; valt: (v: T) => void; opciok: readonly { ertek: T; nev: string }[]; ures?: string; cimke?: string }) {
  return (
    <select aria-label={p.cimke} onChange={(e) => p.valt((e.target as HTMLSelectElement).value as T)}>
      {p.ures !== undefined && <option value="" selected={!p.ertek}>{p.ures}</option>}
      {p.opciok.map((o) => <option value={o.ertek} selected={o.ertek === p.ertek}>{o.nev}</option>)}
    </select>
  );
}

export const sz = (x: number | undefined | null, tizedes = 2) =>
  x === undefined || x === null || Number.isNaN(x) ? '–' : x.toLocaleString('hu-HU', { minimumFractionDigits: tizedes, maximumFractionDigits: tizedes });

/** Követelményérték kiírása tizedesvesszővel, felesleges nullák nélkül. */
export const kov = (x: number) => x.toLocaleString('hu-HU', { maximumFractionDigits: 3 });

/** Lista fejléce: mind / egyik sem jelölés (részleges kijelölésnél „–” állapot). */
export function MindJelolo(p: { db: number; ossz: number; valt: (be: boolean) => void; szoveg?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = p.db > 0 && p.db < p.ossz; }, [p.db, p.ossz]);
  const doboz = <input ref={ref} type="checkbox" title={p.db >= p.ossz ? 'Egyik sem' : 'Mind'} aria-label="Mind / egyik sem" disabled={!p.ossz} checked={p.ossz > 0 && p.db >= p.ossz} onChange={() => p.valt(p.db < p.ossz)} />;
  return p.szoveg ? <label class="jelolo" style="font-size:12px;font-weight:400">{doboz} {p.szoveg}</label> : doboz;
}

/** „Összes törlése” – kétlépéses megerősítéssel (a visszavonás is működik). */
export function OsszesTorles(p: { db: number; mit: string; torol: () => void; megjegyzes?: string }) {
  const [kerdes, setKerdes] = useState(false);
  if (!p.db) return null;
  return kerdes
    ? <span class="gombsor" style="display:inline-flex;gap:6px;align-items:center">
        <span class="halkabb">Törlöd mind a {p.db} {p.mit}?{p.megjegyzes ? ` ${p.megjegyzes}` : ''}</span>
        <button class="gomb veszely" onClick={() => { p.torol(); setKerdes(false); }}>Igen, törlés</button>
        <button class="gomb halk-gomb" onClick={() => setKerdes(false)}>Mégse</button>
      </span>
    : <button class="gomb halk-gomb" onClick={() => setKerdes(true)}>Összes törlése ({p.db})</button>;
}
