/**
 * Beépített anyagkatalógus – a felület offline is ezt használja, és ebből készül az adatbázis seedje
 * (tools/seed-generalas.ts), így a két hely nem csúszhat szét.
 * Csak ellenőrizhető forrású érték kerül ide.
 */

export type Sraffozas = 'falazat' | 'beton' | 'hoszigeteles_hab' | 'hoszigeteles_szalas' | 'vakolat' | 'fa' | 'folia' | 'burkolat' | 'legreteg';

export const SRAFFOZASOK: { kod: Sraffozas; nev: string }[] = [
  { kod: 'falazat', nev: 'Falazat' },
  { kod: 'beton', nev: 'Beton, vasbeton' },
  { kod: 'hoszigeteles_hab', nev: 'Hőszigetelés, hab' },
  { kod: 'hoszigeteles_szalas', nev: 'Hőszigetelés, szálas' },
  { kod: 'vakolat', nev: 'Vakolat, habarcs' },
  { kod: 'fa', nev: 'Fa, faalapú' },
  { kod: 'folia', nev: 'Fólia, lemez' },
  { kod: 'burkolat', nev: 'Burkolat, lap' },
  { kod: 'legreteg', nev: 'Légréteg' },
];

export interface Anyag {
  /** Beépítettnél beszédes kód, irodai anyagnál az adatbázis-sor kódja. */
  id: string;
  nev: string;
  kategoria: string;
  sraffozas: Sraffozas;
  lambda?: number;
  mu?: number;
  /** Ismert hővezetési ellenállású termék (pl. üreges blokk) adott vastagságnál [m²K/W, m]. */
  R?: { R: number; d: number };
  forras: string;
  ellenorzott: boolean;
  megjegyzes?: string;
  /** Irodai könyvtárból származik (nem beépített). */
  irodai?: boolean;
}

const WW = 'WinWatt 9.54 jegyzőkönyv (Tarján, 2026.05.22.) – a tanúsító által alkalmazott érték, termékadattal ellenőrizendő';

export const ALAP_ANYAGOK: Anyag[] = [
  { id: 'vakolat_mc', nev: 'Mészcement vakolat', kategoria: 'Vakolat', sraffozas: 'vakolat', lambda: 0.81, forras: WW, ellenorzott: false },
  { id: 'vazkeramia_30', nev: 'Vázkerámia falazóblokk 30 cm', kategoria: 'Falazat', sraffozas: 'falazat', R: { R: 1.5228, d: 0.3 }, forras: WW, ellenorzott: false, megjegyzes: 'Ekvivalens λ = 0,197 W/mK (WinWatt)' },
  { id: 'eps_homlokzat', nev: 'EPS homlokzati hőszigetelés', kategoria: 'Hőszigetelés', sraffozas: 'hoszigeteles_hab', lambda: 0.038, mu: 40, forras: WW, ellenorzott: false },
  { id: 'ragaszto', nev: 'Ragasztótapasz', kategoria: 'Vakolat', sraffozas: 'vakolat', lambda: 0.84, mu: 15, forras: WW, ellenorzott: false },
  { id: 'vekonyvakolat', nev: 'Külső vékonyvakolat', kategoria: 'Vakolat', sraffozas: 'vakolat', lambda: 0.76, mu: 121, forras: WW, ellenorzott: false },
  { id: 'padloburkolat', nev: 'Padlóburkolat', kategoria: 'Burkolat', sraffozas: 'burkolat', lambda: 1.05, forras: WW, ellenorzott: false },
  { id: 'aljzatbeton', nev: 'Aljzatbeton', kategoria: 'Beton', sraffozas: 'beton', lambda: 1.4, mu: 40, forras: WW, ellenorzott: false },
  { id: 'eps100', nev: 'Austrotherm AT-N100 (EPS 100)', kategoria: 'Hőszigetelés', sraffozas: 'hoszigeteles_hab', lambda: 0.037, mu: 70, forras: WW, ellenorzott: false },
  { id: 'bitumen', nev: 'Bitumenes talajnedvesség elleni szigetelés', kategoria: 'Szigetelés', sraffozas: 'folia', lambda: 0.12, forras: WW, ellenorzott: false },
  { id: 'vasbeton', nev: 'Vasbeton', kategoria: 'Beton', sraffozas: 'beton', lambda: 1.55, forras: WW, ellenorzott: false },
  { id: 'gipszkarton', nev: 'Gipszkarton', kategoria: 'Burkolat', sraffozas: 'burkolat', lambda: 0.24, forras: WW, ellenorzott: false },
  { id: 'parazaro', nev: 'Párazáró fólia', kategoria: 'Fólia', sraffozas: 'folia', lambda: 0.17, forras: WW, ellenorzott: false },
  { id: 'asvanygyapot', nev: 'Szálas hőszigetelés (ásványgyapot)', kategoria: 'Hőszigetelés', sraffozas: 'hoszigeteles_szalas', lambda: 0.038, mu: 1.47, forras: WW, ellenorzott: false },
];
