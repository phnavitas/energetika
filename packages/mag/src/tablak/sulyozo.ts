/**
 * 9/2023. (V. 25.) ÉKM rendelet 7. melléklet 2. pont – A fűtőértéken számított végsőenergia-igény súlyozó tényezői.
 * fCO2: g/kWh. A távhő/távhűtés értéke a 8. § (1) szerinti adatszolgáltatás hiányában alkalmazandó (szolgáltatói
 * érték az e-epites.hu-n, évente március 15-ig).
 */

export type Energiahordozo =
  | 'fosszilis_szilard' | 'fosszilis_folyekony' | 'fosszilis_gaz'
  | 'bio_szilard' | 'bio_szilard_korszeru' | 'bio_folyekony' | 'bio_gaz'
  | 'villamos' | 'tavho' | 'tavhutes' | 'hulladekho'
  | 'nap_pv' | 'nap_termikus' | 'szel' | 'kornyezeti_ho'
  | 'export_halozat' | 'export_nem_szabalyozott';

export interface Sulyozo { fnren: number; fren: number; ftot: number; fCO2: number; megnevezes: string; }

export const SULYOZO: Readonly<Record<Energiahordozo, Sulyozo>> = {
  fosszilis_szilard: { megnevezes: 'Fosszilis tüzelőanyag, szilárd', fnren: 1.1, fren: 0, ftot: 1.1, fCO2: 456 },
  fosszilis_folyekony: { megnevezes: 'Fosszilis tüzelőanyag, folyékony', fnren: 1.1, fren: 0, ftot: 1.1, fCO2: 308 },
  fosszilis_gaz: { megnevezes: 'Fosszilis tüzelőanyag, gáz', fnren: 1.1, fren: 0, ftot: 1.1, fCO2: 297 },
  bio_szilard: { megnevezes: 'Bio tüzelőanyag, szilárd', fnren: 0.6, fren: 0.6, ftot: 1.2, fCO2: 40 },
  /** 7. melléklet 3. pont szerinti korszerű berendezések (ErP 2015/1189, 2015/1185, ill. 55/2016 NFM). */
  bio_szilard_korszeru: { megnevezes: 'Bio tüzelőanyag, szilárd (7. melléklet 3. pont szerinti berendezés)', fnren: 0.2, fren: 1.0, ftot: 1.2, fCO2: 40 },
  bio_folyekony: { megnevezes: 'Bio tüzelőanyag, folyékony', fnren: 0.5, fren: 1, ftot: 1.5, fCO2: 70 },
  bio_gaz: { megnevezes: 'Bio tüzelőanyag, gáz', fnren: 0.4, fren: 1, ftot: 1.4, fCO2: 83 },
  villamos: { megnevezes: 'Villamos energia', fnren: 2.3, fren: 0.3, ftot: 2.6, fCO2: 455 },
  tavho: { megnevezes: 'Távhő (alapérték)', fnren: 1.38, fren: 0, ftot: 1.38, fCO2: 374 },
  tavhutes: { megnevezes: 'Távhűtés (alapérték)', fnren: 1.38, fren: 0, ftot: 1.38, fCO2: 374 },
  hulladekho: { megnevezes: 'Hulladékhő', fnren: 0, fren: 0, ftot: 0, fCO2: 0 },
  nap_pv: { megnevezes: 'Napenergia, PV villamos energia', fnren: 0, fren: 1, ftot: 1, fCO2: 74 },
  nap_termikus: { megnevezes: 'Napenergia, termikus', fnren: 0, fren: 1, ftot: 1, fCO2: 25 },
  szel: { megnevezes: 'Szél', fnren: 0, fren: 1, ftot: 1, fCO2: 12 },
  kornyezeti_ho: { megnevezes: 'Környezeti hő (geo-, aero-, hidrotermikus)', fnren: 0, fren: 1, ftot: 1, fCO2: 27 },
  export_halozat: { megnevezes: 'Exportált villamos energia – hálózatba', fnren: 2.3, fren: 0.3, ftot: 2.6, fCO2: 455 },
  export_nem_szabalyozott: { megnevezes: 'Exportált villamos energia – nem szabályozott fogyasztóknak', fnren: 2.3, fren: 0.3, ftot: 2.6, fCO2: 455 },
};

/** 2. függ. 3.1. táblázat – energiahordozó → Ffé/éh. */
export function futoertekEgeshoArany(e: Energiahordozo): number {
  switch (e) {
    case 'fosszilis_gaz': return 0.9;
    case 'fosszilis_folyekony': return 0.94;
    case 'fosszilis_szilard': return 0.96;
    case 'bio_szilard': case 'bio_szilard_korszeru': return 0.93;
    // Bio folyékony/gáz: a 3.1. táblázat csak „fa, biomassza” sort ad – ellenőrizendő; addig 0,93.
    case 'bio_folyekony': case 'bio_gaz': return 0.93;
    default: return 1.0;
  }
}
