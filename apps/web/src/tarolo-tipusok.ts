/** Az adatréteg közös típusai (a valódi és a teszt-adatréteg is ezt használja). */
import type { User } from '@supabase/supabase-js';
import type { Anyag } from './katalogus';
import type { NyilaszaroTipus, Projekt, Retegrend } from './modell';

export const MAG_VERZIO = '0.3.0';

/** Supabase hibaüzenet magyarra, ahol ismert. */
export function hibaSzoveg(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  if (/Invalid login credentials/i.test(m)) return 'Hibás e-mail cím vagy jelszó.';
  if (/Email not confirmed/i.test(m)) return 'Az e-mail cím még nincs megerősítve. Nézd meg a postafiókodat.';
  if (/User already registered/i.test(m)) return 'Ezzel az e-mail címmel már van fiók. Lépj be, vagy kérj belépési linket.';
  if (/Password should be at least/i.test(m)) return 'A jelszó legyen legalább 8 karakter.';
  if (/rate limit|too many/i.test(m)) return 'Túl sok próbálkozás. Várj egy percet, és próbáld újra.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Nincs kapcsolat az adatbázissal. Ellenőrizd az internetkapcsolatot.';
  if (/row-level security/i.test(m)) return 'Ehhez nincs jogosultságod ebben az irodában.';
  return m;
}

export type Felhasznalo = Pick<User, 'id' | 'email'>;

export type Szerep = 'tulajdonos' | 'admin' | 'tag';
export interface Iroda { id: string; nev: string; szerep: Szerep; }
export interface Tag { felhasznaloId: string; email: string | null; szerep: Szerep; }
export interface Meghivo { email: string; szerep: 'admin' | 'tag'; letrehozva: string; }

export interface Osszesito { AN: number; Enren: number | null; osztaly: string | null; co2Osztaly: string | null; qm: number | null; }
export interface ProjektSor { id: string; nev: string; cim: string | null; statusz: string; osszesito: Osszesito | null; verzio: number; modositva: string; }

export type MentesEredmeny = { ok: true; verzio: number; modositva: string } | { ok: false; ok2: 'utkozes' | 'torolve' };

export type ForrasTipus = 'rendelet' | 'szabvany' | 'termekadat' | 'szakirodalom' | 'tanusitoi_ertek' | 'felhasznaloi';
export const FORRAS_TIPUS_NEV: Record<ForrasTipus, string> = {
  termekadat: 'Termékadat (teljesítménynyilatkozat)', szabvany: 'Szabvány', rendelet: 'Jogszabály',
  szakirodalom: 'Szakirodalom', tanusitoi_ertek: 'Tanúsítói gyakorlat', felhasznaloi: 'Saját felvitel',
};

export interface IrodaiAnyag extends Anyag { forrasTipus: ForrasTipus; }

export interface KonyvtarRetegrend { id: string; nev: string; szerep: Retegrend['szerep']; U: number | null; adat: Retegrend; anyagok: Anyag[]; forras: string; }
export interface BetoltottProjekt { id: string; irodaId: string; verzio: number; dokumentum: Projekt; modositva: string; }
export interface KonyvtarNyilaszaro { id: string; nev: string; kovetelmenyKod: string; Uw: number | null; adat: NyilaszaroTipus; forras: string; }
