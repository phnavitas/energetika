import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { Tanusito } from './modell';

/**
 * Tanúsítói profil: a tanúsító adatai a felhasználóhoz (fiókhoz, belépés nélkül a böngészőhöz) kötve.
 * Névjegyzéki szám: „TÉ 11-0296” (épületenergetikai tanúsító) vagy „SZÉS6 11-0296” (épületenergetikai szakértő).
 * Szám nélkül: legfeljebb 1 projekt, és nincs XML / PDF dokumentálás.
 */
export type JogTipus = 'TÉ' | 'SZÉS6';
export const JOG_TIPUSOK: { ertek: JogTipus; nev: string }[] = [
  { ertek: 'TÉ', nev: 'TÉ – épületenergetikai tanúsító' },
  { ertek: 'SZÉS6', nev: 'SZÉS6 – épületenergetikai szakértő' },
];
const MINTA = /^(TÉ|SZÉS6)\s*(\d{2}-\d{4,5})$/i;
const SZAM = /^\d{2}-\d{4,5}$/;

export const szamFormaOk = (szam: string) => SZAM.test(szam.trim());
export function jogBont(j: string): { tipus: JogTipus; szam: string } {
  const m = j.trim().match(MINTA);
  if (m) return { tipus: m[1]!.toUpperCase() === 'TÉ' ? 'TÉ' : 'SZÉS6', szam: m[2]! };
  const sz = j.replace(/^(TÉ|SZÉS6)\s*/i, '').trim();
  return { tipus: /^SZÉS6/i.test(j) ? 'SZÉS6' : 'TÉ', szam: sz };
}
export const jogOsszerak = (tipus: JogTipus, szam: string) => (szam.trim() ? `${tipus} ${szam.trim()}` : '');
/** Érvényes kamarai számmal rendelkezik-e (ez nyitja a korlátlan projektet és a dokumentálást). */
export const jogosult = (t: Tanusito | null | undefined) => !!t && MINTA.test(t.jogosultsag.trim());

export const uresTanusito = (): Tanusito => ({ nev: '', jogosultsag: '', email: '', telefon: '', kamara: 'MEK' });

const HELYI = 'ekm-profil';
export function helyiProfil(): Tanusito | null {
  try {
    const s = localStorage.getItem(HELYI) ?? localStorage.getItem('ekm-tanusito');
    const t = s ? JSON.parse(s) : null;
    return t && typeof t.nev === 'string' ? t : null;
  } catch { return null; }
}
export function helyiProfilMent(t: Tanusito) { try { localStorage.setItem(HELYI, JSON.stringify(t)); } catch { /* privát mód */ } }

export interface ProfilAllapot { profil: Tanusito | null; jogosult: boolean; szerkeszt: () => void; }
export const ProfilKontextus = createContext<ProfilAllapot>({ profil: null, jogosult: false, szerkeszt: () => {} });
export const useProfil = () => useContext(ProfilKontextus);

export const ZAR_SZOVEG = 'Kamarai tanúsítói (TÉ) vagy szakértői (SZÉS6) szám nélkül a dokumentálás (XML, PDF) nem érhető el.';
