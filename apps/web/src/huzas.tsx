/**
 * Egyszerű húzd-és-ejtsd sorrendezés listákhoz és táblázatsorokhoz (HTML5 drag and drop), billentyűzetes
 * alternatívával: a fogantyún a ↑/↓ nyíl egy hellyel mozgat.
 */
import type { JSX } from 'preact';

let huzott: { csoport: string; id: string } | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function huzasProps(csoport: string, id: string, athelyez: (id: string, celId: string) => void): any {
  return {
    onDragOver: (e: DragEvent) => { if (huzott?.csoport === csoport && huzott.id !== id) { e.preventDefault(); (e.currentTarget as HTMLElement).classList.add('huzas-cel'); } },
    onDragLeave: (e: DragEvent) => (e.currentTarget as HTMLElement).classList.remove('huzas-cel'),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).classList.remove('huzas-cel');
      if (huzott?.csoport === csoport && huzott.id !== id) athelyez(huzott.id, id);
      huzott = null;
    },
    'data-huzas': csoport,
    'data-id': id,
  } as JSX.HTMLAttributes<HTMLElement>;
}

/** A sor fogantyúja: ezt megfogva húzható a sor; fókuszban a nyilakkal mozgatható. */
export function Fogantyu({ cimke, fel, le, csoport, id }: { cimke: string; fel: () => void; le: () => void; csoport?: string; id?: string }) {
  return (
    <span class="fogantyu" role="button" tabIndex={0} draggable aria-label={`${cimke || 'Elem'} áthelyezése (húzás vagy fel/le nyíl)`} title="Húzd a sorrend módosításához"
      onDragStart={(e) => {
        const sor = (e.currentTarget as HTMLElement).closest('[data-huzas]') as HTMLElement | null;
        const cs = csoport ?? sor?.dataset.huzas ?? '';
        huzott = { csoport: cs, id: id ?? sor?.dataset.id ?? '' };
        e.dataTransfer?.setData('text/plain', cimke);
        if (sor && e.dataTransfer) e.dataTransfer.setDragImage(sor, 16, 16);
        sor?.classList.add('huzas-forras');
      }}
      onDragEnd={(e) => { (e.currentTarget as HTMLElement).closest('[data-huzas]')?.classList.remove('huzas-forras'); huzott = null; }}
      onKeyDown={(e) => { if (e.key === 'ArrowUp') { e.preventDefault(); fel(); } if (e.key === 'ArrowDown') { e.preventDefault(); le(); } }}>
      <svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true"><g fill="currentColor"><circle cx="2" cy="3" r="1.4" /><circle cx="8" cy="3" r="1.4" /><circle cx="2" cy="8" r="1.4" /><circle cx="8" cy="8" r="1.4" /><circle cx="2" cy="13" r="1.4" /><circle cx="8" cy="13" r="1.4" /></g></svg>
    </span>
  );
}
