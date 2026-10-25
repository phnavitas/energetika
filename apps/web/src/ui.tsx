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
export function Szam(p: { ertek: number | undefined; valt: (v: number) => void; egyseg?: string; lepes?: number; min?: number; cimke?: string }) {
  const [szerk, setSzerk] = useState<string | null>(null);
  const megj = p.ertek === undefined || Number.isNaN(p.ertek) ? '' : String(Number(p.ertek.toFixed(6))).replace('.', ',');
  const input = (
    <input
      type="text" inputMode="decimal" aria-label={p.cimke} class="szammezo"
      value={szerk ?? megj}
      onFocus={() => setSzerk(megj)}
      onBlur={() => setSzerk(null)}
      onInput={(e) => {
        const t = (e.target as HTMLInputElement).value;
        setSzerk(t);
        const v = parseFloat(t.replace(/\s/g, '').replace(',', '.'));
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
