/**
 * Az épület komplex indikátorai – 1. függelék 14. fejezet; súlyozó tényezők: rendelet 7. melléklet.
 */
import { SULYOZO, futoertekEgeshoArany, type Energiahordozo } from './tablak/sulyozo.js';
import type { RendszerEredmeny, VegenergiaTetel } from './rendszerek.js';

export interface CelIndikator {
  nren: number; ren: number; tot: number; CO2: number; // kWh/év, kg/év
}

export interface Indikatorok {
  AN: number;
  celonkent: { futes: CelIndikator; hmv: CelIndikator; szellozes: CelIndikator; hutes: CelIndikator; vilagitas: CelIndikator; export: CelIndikator };
  osszes: CelIndikator;
  fajlagos: { EnrenFajl: number; ErenFajl: number; EtotFajl: number; ECO2Fajl: number };
  /** Végenergia energiahordozónként [kWh/év] (fűtőértéken). */
  vegenergia: Partial<Record<Energiahordozo, number>>;
  /** Az e-tanúsítás XML EnergyConsumptionByUse blokkjához szükséges fajlagos értékek [kWh/m²év]. */
  megujulo: {
    halozatiVillamos: number;
    kornyezetiHo: number;
    aktivMegujulo: number;
    helybenTermelt: number;
    tavolbanTermelt: number;
    kozelbenTermelt: number;
    passzivMegujulo: number;
  };
}

const ures = (): CelIndikator => ({ nren: 0, ren: 0, tot: 0, CO2: 0 });

function sulyoz(t: VegenergiaTetel): CelIndikator {
  const f = SULYOZO[t.energiahordozo];
  const Q = t.jelleg === 'ho' ? t.Q * futoertekEgeshoArany(t.energiahordozo) : t.Q;
  return { nren: Q * f.fnren, ren: Q * f.fren, tot: Q * f.ftot, CO2: (Q * f.fCO2) / 1000 };
}

function hozzaad(a: CelIndikator, b: CelIndikator) {
  a.nren += b.nren; a.ren += b.ren; a.tot += b.tot; a.CO2 += b.CO2;
}

export function indikatorok(rendszerek: RendszerEredmeny[], AN: number, passzivSzolarisKWh = 0): Indikatorok {
  const celonkent = { futes: ures(), hmv: ures(), szellozes: ures(), hutes: ures(), vilagitas: ures(), export: ures() };
  const vegenergia: Partial<Record<Energiahordozo, number>> = {};
  let halozati = 0, korny = 0, helyben = 0;
  for (const r of rendszerek) {
    for (const t of r.tetelek) {
      const s = sulyoz(t);
      hozzaad(celonkent[r.cel], s);
      const Qfe = t.jelleg === 'ho' ? t.Q * futoertekEgeshoArany(t.energiahordozo) : t.Q;
      vegenergia[t.energiahordozo] = (vegenergia[t.energiahordozo] ?? 0) + Qfe;
      if (t.energiahordozo === 'villamos') halozati += Qfe;
      if (t.energiahordozo === 'kornyezeti_ho') korny += Qfe;
      if (t.energiahordozo === 'kornyezeti_ho' || t.energiahordozo === 'nap_termikus' || t.energiahordozo === 'nap_pv') helyben += Qfe;
    }
  }
  const osszes = ures();
  for (const k of ['futes', 'hmv', 'szellozes', 'hutes', 'vilagitas'] as const) hozzaad(osszes, celonkent[k]);
  // 14.1: exportált energia levonása (Eexp) – később a PV-modullal.
  osszes.nren -= celonkent.export.nren; osszes.ren -= celonkent.export.ren; osszes.tot -= celonkent.export.tot; osszes.CO2 -= celonkent.export.CO2;

  const tavolban = halozati * SULYOZO.villamos.fren;
  return {
    AN, celonkent, osszes, vegenergia,
    fajlagos: { EnrenFajl: osszes.nren / AN, ErenFajl: osszes.ren / AN, EtotFajl: osszes.tot / AN, ECO2Fajl: osszes.CO2 / AN },
    megujulo: {
      halozatiVillamos: halozati / AN,
      kornyezetiHo: korny / AN,
      aktivMegujulo: osszes.ren / AN,
      helybenTermelt: helyben / AN,
      tavolbanTermelt: tavolban / AN,
      kozelbenTermelt: 0,
      passzivMegujulo: passzivSzolarisKWh / AN,
    },
  };
}
