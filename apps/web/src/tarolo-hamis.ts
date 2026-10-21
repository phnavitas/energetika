/**
 * Memóriabeli adatréteg a felület teszteléséhez (HAMIS=1 build). Ugyanazt az API-t adja, mint a tarolo.ts,
 * és a böngészőben window.__hamis alatt kívülről is állítható (pl. ütközés szimulálása).
 */
import type { Projekt, Retegrend, NyilaszaroTipus, Gepeszet } from './modell';
import type { Anyag } from './katalogus';
export * from './tarolo-tipusok';
import type * as T from './tarolo-tipusok';

const kesleltet = <X,>(x: X) => new Promise<X>((r) => setTimeout(() => r(structuredClone(x)), 120));
const most = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

const db = {
  felh: null as T.Felhasznalo | null,
  irodak: [] as { id: string; nev: string }[],
  tagok: [] as { irodaId: string; felhasznaloId: string; email: string; szerep: T.Szerep }[],
  meghivok: [] as { irodaId: string; email: string; szerep: 'admin' | 'tag'; letrehozva: string }[],
  projektek: [] as { id: string; irodaId: string; nev: string; cim: string | null; statusz: string; dokumentum: Projekt; osszesito: T.Osszesito | null; verzio: number; modositva: string }[],
  anyagok: [] as (T.IrodaiAnyag & { irodaId: string })[],
  retegrendek: [] as (T.KonyvtarRetegrend & { irodaId: string })[],
  nyilaszarok: [] as (T.KonyvtarNyilaszaro & { irodaId: string })[],
  szamitasok: [] as unknown[],
  szettek: [] as (T.IrodaiSzett & { irodaId: string })[],
  profil: null as import('./modell').Tanusito | null,
  sajatProjekt: 0,
  hivasok: [] as string[],
};
(window as unknown as { __hamis: typeof db }).__hamis = db;

let figyelo: ((f: T.Felhasznalo | null) => void) | null = null;
export const sb = null;
export const tavoliElerheto = true;
export const MAG_VERZIO = '0.3.0';
export { hibaSzoveg, FORRAS_TIPUS_NEV } from './tarolo-tipusok';
import { hibaSzoveg as hibaSzovegH } from './tarolo-tipusok';

export async function munkamenet() { return kesleltet(db.felh); }
export function authFigyel(cb: (f: T.Felhasznalo | null) => void) { figyelo = cb; return () => { figyelo = null; }; }
export async function belepesJelszoval(email: string, jelszo: string) {
  await kesleltet(0);
  if (jelszo !== 'jelszo123') throw new Error('Hibás e-mail cím vagy jelszó.');
  db.felh = { id: 'f1', email }; figyelo?.(db.felh);
}
export async function regisztracio(email: string, _j: string, profil?: { nev: string; kamara: string; jogosultsag: string }) { await kesleltet(0); if (profil) db.profil = { nev: profil.nev, kamara: profil.kamara as 'MEK', jogosultsag: profil.jogosultsag, email, telefon: '' }; return false; }
export async function belepesiLink() { await kesleltet(0); }
export async function kilepes() { db.felh = null; figyelo?.(null); }

export async function meghivokElfogadasa() { db.hivasok.push('meghivok'); return kesleltet(0); }
export async function irodak(f: T.Felhasznalo): Promise<T.Iroda[]> {
  return kesleltet(db.tagok.filter((t) => t.felhasznaloId === f.id).map((t) => ({ id: t.irodaId, nev: db.irodak.find((i) => i.id === t.irodaId)!.nev, szerep: t.szerep })));
}
export async function irodaLetrehoz(nev: string) {
  const id = uid(); db.irodak.push({ id, nev }); db.tagok.push({ irodaId: id, felhasznaloId: db.felh!.id, email: db.felh!.email!, szerep: 'tulajdonos' });
  return kesleltet(id);
}
export async function irodaAtnevez(id: string, nev: string) { db.irodak.find((i) => i.id === id)!.nev = nev; await kesleltet(0); }
export async function tagok(irodaId: string) { return kesleltet(db.tagok.filter((t) => t.irodaId === irodaId).map((t) => ({ felhasznaloId: t.felhasznaloId, email: t.email, szerep: t.szerep }))); }
export async function tagSzerep() { await kesleltet(0); }
export async function tagEltavolit(irodaId: string, f: string) { db.tagok = db.tagok.filter((t) => !(t.irodaId === irodaId && t.felhasznaloId === f)); await kesleltet(0); }
export async function meghivok(irodaId: string) { return kesleltet(db.meghivok.filter((m) => m.irodaId === irodaId)); }
export async function meghiv(irodaId: string, email: string, szerep: 'admin' | 'tag') { db.meghivok.push({ irodaId, email: email.trim().toLowerCase(), szerep, letrehozva: most() }); await kesleltet(0); }
export async function meghivoTorol(irodaId: string, email: string) { db.meghivok = db.meghivok.filter((m) => !(m.irodaId === irodaId && m.email === email)); await kesleltet(0); }

export async function projektLista(irodaId: string) { return kesleltet(db.projektek.filter((p) => p.irodaId === irodaId).sort((a, b) => b.modositva.localeCompare(a.modositva))); }
export async function projektBetolt(id: string) {
  const p = db.projektek.find((x) => x.id === id);
  if (!p) throw new Error('nincs');
  return kesleltet({ id, irodaId: p.irodaId, verzio: p.verzio, dokumentum: p.dokumentum, modositva: p.modositva });
}
export async function projektUj(irodaId: string, p: Projekt, o: T.Osszesito | null) {
  const sor = { id: uid(), irodaId, nev: p.meta.nev || 'Névtelen projekt', cim: p.meta.telepules || null, statusz: 'vazlat', dokumentum: structuredClone(p), osszesito: o, verzio: 1, modositva: most() };
  if (!/^(TÉ|SZÉS6) \d{2}-\d{4,5}$/.test(db.profil?.jogosultsag ?? '') && db.sajatProjekt >= 1) { await kesleltet(0); throw new Error(hibaSzovegH({ message: 'TANUSITO_SZAM_KELL' })); }
  db.projektek.push(sor); db.hivasok.push('uj'); db.sajatProjekt++;
  return kesleltet({ id: sor.id, verzio: 1, modositva: sor.modositva });
}
export async function projektMent(id: string, v: number, p: Projekt, o: T.Osszesito | null): Promise<T.MentesEredmeny> {
  await kesleltet(0);
  const sor = db.projektek.find((x) => x.id === id);
  if (!sor) return { ok: false, ok2: 'torolve' };
  if (sor.verzio !== v) return { ok: false, ok2: 'utkozes' };
  Object.assign(sor, { dokumentum: structuredClone(p), osszesito: o, nev: p.meta.nev, verzio: v + 1, modositva: most() });
  db.hivasok.push('ment');
  return { ok: true, verzio: sor.verzio, modositva: sor.modositva };
}
export async function projektTorol(id: string) { db.projektek = db.projektek.filter((p) => p.id !== id); await kesleltet(0); }
export async function szamitasRogzit(...a: unknown[]) { db.szamitasok.push(a); await kesleltet(0); }

export async function irodaiAnyagok(irodaId: string) { return kesleltet(db.anyagok.filter((a) => a.irodaId === irodaId)); }
export async function anyagMent(irodaId: string, a: Omit<T.IrodaiAnyag, 'id'> & { id?: string }) {
  if (a.id) Object.assign(db.anyagok.find((x) => x.id === a.id)!, a);
  else db.anyagok.push({ ...a, id: uid(), irodaId, irodai: true });
  await kesleltet(0);
}
export async function anyagTorol(kod: string) { db.anyagok = db.anyagok.filter((a) => a.id !== kod); await kesleltet(0); }
export async function konyvtarRetegrendek(irodaId: string) { return kesleltet(db.retegrendek.filter((r) => r.irodaId === irodaId)); }
export async function retegrendKonyvtarba(irodaId: string, r: Retegrend, anyagok: Anyag[], U: number | null) {
  db.retegrendek.push({ id: uid(), irodaId, nev: r.nev, szerep: r.szerep, U, adat: structuredClone(r), anyagok, forras: '' }); await kesleltet(0);
}
export async function konyvtarRetegrendTorol(id: string) { db.retegrendek = db.retegrendek.filter((r) => r.id !== id); await kesleltet(0); }
export async function konyvtarNyilaszarok(irodaId: string) { return kesleltet(db.nyilaszarok.filter((r) => r.irodaId === irodaId)); }
export async function nyilaszaroKonyvtarba(irodaId: string, n: NyilaszaroTipus, Uw: number | null) {
  db.nyilaszarok.push({ id: uid(), irodaId, nev: n.nev, kovetelmenyKod: n.kovetelmenyKod, Uw, adat: structuredClone(n), forras: '' }); await kesleltet(0);
}
export async function konyvtarNyilaszaroTorol(id: string) { db.nyilaszarok = db.nyilaszarok.filter((r) => r.id !== id); await kesleltet(0); }
export async function irodaiSzettek(irodaId: string) { return kesleltet(db.szettek.filter((x) => x.irodaId === irodaId)); }
export async function szettMent(irodaId: string, nev: string, leiras: string, g: Gepeszet) {
  db.szettek.push({ id: uid(), irodaId, nev, leiras, futes: structuredClone(g.futes), hmv: structuredClone(g.hmv), szellozes: structuredClone(g.szellozes) }); await kesleltet(0);
}
export async function szettTorol(id: string) { db.szettek = db.szettek.filter((x) => x.id !== id); await kesleltet(0); }

export async function profilBetolt() { return kesleltet(db.profil); }
export async function profilMent(t: import('./modell').Tanusito) { db.profil = structuredClone(t); db.hivasok.push('profil'); await kesleltet(0); }
export async function sajatProjektSzam() { return kesleltet(db.sajatProjekt); }
