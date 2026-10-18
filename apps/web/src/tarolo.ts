/**
 * Adatréteg: Supabase (bejelentkezés, irodák, projektek, irodai könyvtár).
 * Ha a VITE_SUPABASE_URL / VITE_SUPABASE_KEY nincs megadva (pl. egyfájlos előnézet), a program helyi módban fut.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Anyag, Sraffozas } from './katalogus';
import { hibaSzoveg, MAG_VERZIO, type Felhasznalo, type Iroda, type Szerep, type Tag, type Meghivo, type Osszesito, type ProjektSor, type BetoltottProjekt, type MentesEredmeny, type ForrasTipus, type IrodaiAnyag, type KonyvtarRetegrend, type KonyvtarNyilaszaro, type IrodaiSzett } from './tarolo-tipusok';
export * from './tarolo-tipusok';
import type { Gepeszet, NyilaszaroTipus, Projekt, Retegrend } from './modell';

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KULCS = import.meta.env.VITE_SUPABASE_KEY as string | undefined;

export const sb: SupabaseClient | null = URL_ && KULCS ? createClient(URL_, KULCS, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
export const tavoliElerheto = !!sb;

function kell(): SupabaseClient {
  if (!sb) throw new Error('Az adatbázis nincs beállítva (helyi mód).');
  return sb;
}

function dob(error: unknown): never { throw new Error(hibaSzoveg(error)); }

// ---------------------------------------------------------------------------------------------
// Bejelentkezés


export async function munkamenet(): Promise<Felhasznalo | null> {
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user ?? null;
}
export function authFigyel(cb: (f: Felhasznalo | null) => void) {
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange((_e, s) => cb(s?.user ?? null));
  return () => data.subscription.unsubscribe();
}
export async function belepesJelszoval(email: string, jelszo: string) {
  const { error } = await kell().auth.signInWithPassword({ email: email.trim(), password: jelszo });
  if (error) dob(error);
}
/** Igaz, ha azonnal be is lépett (nincs e-mail megerősítés), hamis, ha megerősítő levelet küldött. */
export async function regisztracio(email: string, jelszo: string): Promise<boolean> {
  const { data, error } = await kell().auth.signUp({ email: email.trim(), password: jelszo, options: { emailRedirectTo: location.origin + location.pathname } });
  if (error) dob(error);
  return !!data.session;
}
export async function belepesiLink(email: string) {
  const { error } = await kell().auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: true } });
  if (error) dob(error);
}
export async function kilepes() { await kell().auth.signOut(); }

// ---------------------------------------------------------------------------------------------
// Iroda


export async function meghivokElfogadasa(): Promise<number> {
  const { data, error } = await kell().rpc('meghivok_elfogadasa');
  if (error) dob(error);
  return data as number;
}
export async function irodak(f: Felhasznalo): Promise<Iroda[]> {
  const { data, error } = await kell().from('szervezet_tag').select('szerep, szervezet(id, nev)').eq('felhasznalo_id', f.id);
  if (error) dob(error);
  return (data ?? []).map((r) => {
    const s = r.szervezet as unknown as { id: string; nev: string };
    return { id: s.id, nev: s.nev, szerep: r.szerep as Szerep };
  }).sort((a, b) => a.nev.localeCompare(b.nev, 'hu'));
}
export async function irodaLetrehoz(nev: string): Promise<string> {
  const { data, error } = await kell().rpc('szervezet_letrehoz', { p_nev: nev });
  if (error) dob(error);
  return data as string;
}
export async function irodaAtnevez(id: string, nev: string) {
  const { error } = await kell().from('szervezet').update({ nev: nev.trim() }).eq('id', id);
  if (error) dob(error);
}
export async function tagok(irodaId: string): Promise<Tag[]> {
  const { data, error } = await kell().from('szervezet_tag').select('felhasznalo_id, email, szerep').eq('szervezet_id', irodaId).order('csatlakozott');
  if (error) dob(error);
  return (data ?? []).map((r) => ({ felhasznaloId: r.felhasznalo_id, email: r.email, szerep: r.szerep as Szerep }));
}
export async function tagSzerep(irodaId: string, felhasznaloId: string, szerep: 'admin' | 'tag') {
  const { error } = await kell().from('szervezet_tag').update({ szerep }).eq('szervezet_id', irodaId).eq('felhasznalo_id', felhasznaloId);
  if (error) dob(error);
}
export async function tagEltavolit(irodaId: string, felhasznaloId: string) {
  const { error } = await kell().rpc('tag_eltavolit', { p_szervezet: irodaId, p_felhasznalo: felhasznaloId });
  if (error) dob(error);
}
export async function meghivok(irodaId: string): Promise<Meghivo[]> {
  const { data, error } = await kell().from('szervezet_meghivo').select('email, szerep, letrehozva').eq('szervezet_id', irodaId).order('letrehozva');
  if (error) dob(error);
  return (data ?? []) as Meghivo[];
}
export async function meghiv(irodaId: string, email: string, szerep: 'admin' | 'tag') {
  const { error } = await kell().from('szervezet_meghivo').upsert({ szervezet_id: irodaId, email: email.trim().toLowerCase(), szerep });
  if (error) dob(error);
}
export async function meghivoTorol(irodaId: string, email: string) {
  const { error } = await kell().from('szervezet_meghivo').delete().eq('szervezet_id', irodaId).eq('email', email);
  if (error) dob(error);
}

// ---------------------------------------------------------------------------------------------
// Projektek


function cimSzoveg(p: Projekt) {
  const m = p.meta;
  return [m.irsz, m.telepules, [m.kozterulet, m.kozteruletJelleg, m.hazszam].filter(Boolean).join(' ')].filter(Boolean).join(', ') || null;
}

export async function projektLista(irodaId: string): Promise<ProjektSor[]> {
  const { data, error } = await kell().from('projekt').select('id, nev, cim, statusz, osszesito, verzio, modositva').eq('szervezet_id', irodaId).order('modositva', { ascending: false }).limit(500);
  if (error) dob(error);
  return (data ?? []) as ProjektSor[];
}
export async function projektBetolt(id: string): Promise<BetoltottProjekt> {
  const { data, error } = await kell().from('projekt').select('id, szervezet_id, verzio, dokumentum, modositva').eq('id', id).single();
  if (error) dob(error);
  return { id: data.id, irodaId: data.szervezet_id, verzio: data.verzio, dokumentum: data.dokumentum as Projekt, modositva: data.modositva };
}
export async function projektUj(irodaId: string, p: Projekt, o: Osszesito | null): Promise<{ id: string; verzio: number; modositva: string }> {
  const { data, error } = await kell().from('projekt')
    .insert({ szervezet_id: irodaId, nev: p.meta.nev || 'Névtelen projekt', cim: cimSzoveg(p), dokumentum: p, dokumentum_verzio: p.verzio, osszesito: o })
    .select('id, verzio, modositva').single();
  if (error) dob(error);
  return data;
}
/** Feltételes mentés: csak akkor ír, ha a szerveren még a várt verzió van. */
export async function projektMent(id: string, vartVerzio: number, p: Projekt, o: Osszesito | null): Promise<MentesEredmeny> {
  const { data, error } = await kell().from('projekt')
    .update({ nev: p.meta.nev || 'Névtelen projekt', cim: cimSzoveg(p), dokumentum: p, dokumentum_verzio: p.verzio, osszesito: o, statusz: o?.osztaly ? 'szamitva' : 'vazlat' })
    .eq('id', id).eq('verzio', vartVerzio).select('verzio, modositva');
  if (error) dob(error);
  if (data && data.length) return { ok: true, verzio: data[0]!.verzio, modositva: data[0]!.modositva };
  const { data: van } = await kell().from('projekt').select('verzio').eq('id', id).maybeSingle();
  return { ok: false, ok2: van ? 'utkozes' : 'torolve' };
}
export async function projektTorol(id: string) {
  const { error } = await kell().from('projekt').delete().eq('id', id);
  if (error) dob(error);
}
export async function szamitasRogzit(projektId: string, projektVerzio: number, bemenet: unknown, eredmeny: unknown, figyelmeztetesek: unknown) {
  const { error } = await kell().from('szamitas').insert({
    projekt_id: projektId, projekt_verzio: projektVerzio, modszer_verzio: 'EKM-2023.07.27', mag_verzio: MAG_VERZIO,
    bemenet, eredmeny, figyelmeztetesek,
  });
  if (error) dob(error);
}

// ---------------------------------------------------------------------------------------------
// Irodai könyvtár



interface AnyagSor { kod: string; nev: string; kategoria: string; sraffozas: Sraffozas; lambda: number | null; mu: number | null; r_termek: number | null; d_termek: number | null; forras: ForrasTipus; forras_hivatkozas: string; ellenorzott: boolean; megjegyzes: string | null; }

export async function irodaiAnyagok(irodaId: string): Promise<IrodaiAnyag[]> {
  const { data, error } = await kell().from('anyag').select('kod, nev, kategoria, sraffozas, lambda, mu, r_termek, d_termek, forras, forras_hivatkozas, ellenorzott, megjegyzes').eq('szervezet_id', irodaId).order('nev');
  if (error) dob(error);
  return ((data ?? []) as AnyagSor[]).map((r) => ({
    id: r.kod, nev: r.nev, kategoria: r.kategoria, sraffozas: r.sraffozas,
    lambda: r.lambda ?? undefined, mu: r.mu ?? undefined,
    R: r.r_termek && r.d_termek ? { R: Number(r.r_termek), d: Number(r.d_termek) } : undefined,
    forras: r.forras_hivatkozas, forrasTipus: r.forras, ellenorzott: r.ellenorzott, megjegyzes: r.megjegyzes ?? undefined, irodai: true,
  })).map((a) => ({ ...a, lambda: a.lambda !== undefined ? Number(a.lambda) : undefined, mu: a.mu !== undefined ? Number(a.mu) : undefined }));
}
export async function anyagMent(irodaId: string, a: Omit<IrodaiAnyag, 'id'> & { id?: string }) {
  const sor = {
    szervezet_id: irodaId, nev: a.nev.trim(), kategoria: a.kategoria.trim(), sraffozas: a.sraffozas,
    lambda: a.lambda ?? null, mu: a.mu ?? null, r_termek: a.R?.R ?? null, d_termek: a.R?.d ?? null,
    forras: a.forrasTipus, forras_hivatkozas: a.forras.trim(), ellenorzott: a.ellenorzott, megjegyzes: a.megjegyzes ?? null,
  };
  const q = a.id ? kell().from('anyag').update(sor).eq('kod', a.id) : kell().from('anyag').insert(sor);
  const { error } = await q;
  if (error) dob(error);
}
export async function anyagTorol(kod: string) {
  const { error } = await kell().from('anyag').delete().eq('kod', kod);
  if (error) dob(error);
}


export async function konyvtarRetegrendek(irodaId: string): Promise<KonyvtarRetegrend[]> {
  const { data, error } = await kell().from('retegrend').select('id, nev, szerep, u_ertek, adat, anyagok, forras_hivatkozas').eq('szervezet_id', irodaId).order('nev');
  if (error) dob(error);
  return (data ?? []).map((r) => ({ id: r.id, nev: r.nev, szerep: r.szerep, U: r.u_ertek === null ? null : Number(r.u_ertek), adat: r.adat as Retegrend, anyagok: (r.anyagok ?? []) as Anyag[], forras: r.forras_hivatkozas }));
}
export async function retegrendKonyvtarba(irodaId: string, r: Retegrend, anyagok: Anyag[], U: number | null, forras = '') {
  const { error } = await kell().from('retegrend').insert({
    szervezet_id: irodaId, nev: r.nev, szerep: r.szerep, kovetelmeny_kod: r.kovetelmenyKod, u_ertek: U, adat: r, anyagok, forras_hivatkozas: forras,
  });
  if (error) dob(error);
}
export async function konyvtarRetegrendTorol(id: string) {
  const { error } = await kell().from('retegrend').delete().eq('id', id);
  if (error) dob(error);
}
export async function konyvtarNyilaszarok(irodaId: string): Promise<KonyvtarNyilaszaro[]> {
  const { data, error } = await kell().from('nyilaszaro_tipus').select('id, nev, kovetelmeny_kod, uw, adat, forras_hivatkozas').eq('szervezet_id', irodaId).order('nev');
  if (error) dob(error);
  return (data ?? []).map((r) => ({ id: r.id, nev: r.nev, kovetelmenyKod: r.kovetelmeny_kod, Uw: r.uw === null ? null : Number(r.uw), adat: r.adat as NyilaszaroTipus, forras: r.forras_hivatkozas }));
}
export async function nyilaszaroKonyvtarba(irodaId: string, n: NyilaszaroTipus, Uw: number | null, forras = '') {
  const { error } = await kell().from('nyilaszaro_tipus').insert({ szervezet_id: irodaId, nev: n.nev, kovetelmeny_kod: n.kovetelmenyKod, uw: Uw, adat: n, forras_hivatkozas: forras });
  if (error) dob(error);
}
export async function konyvtarNyilaszaroTorol(id: string) {
  const { error } = await kell().from('nyilaszaro_tipus').delete().eq('id', id);
  if (error) dob(error);
}

// Gépészeti szettek: a gepeszeti_szett.futes mezőben { alrendszerek, szellozes }, a hmv mezőben a HMV rendszer.
export async function irodaiSzettek(irodaId: string): Promise<IrodaiSzett[]> {
  const { data, error } = await kell().from('gepeszeti_szett').select('id, nev, leiras, futes, hmv').eq('szervezet_id', irodaId).order('nev');
  if (error) dob(error);
  return (data ?? []).map((r) => {
    const f = (r.futes ?? {}) as { alrendszerek?: IrodaiSzett['futes']; szellozes?: IrodaiSzett['szellozes'] };
    return { id: r.id, nev: r.nev, leiras: r.leiras ?? '', futes: f.alrendszerek ?? [], hmv: r.hmv as IrodaiSzett['hmv'], szellozes: f.szellozes ?? null };
  }).filter((x) => x.futes.length && x.hmv);
}
export async function szettMent(irodaId: string, nev: string, leiras: string, g: Gepeszet) {
  const { error } = await kell().from('gepeszeti_szett').insert({
    szervezet_id: irodaId, kod: crypto.randomUUID(), nev: nev.trim(), leiras: leiras.trim() || null,
    futes: { alrendszerek: g.futes, szellozes: g.szellozes }, hmv: g.hmv, forras: 'felhasznaloi', forras_hivatkozas: '',
  });
  if (error) dob(error);
}
export async function szettTorol(id: string) {
  const { error } = await kell().from('gepeszeti_szett').delete().eq('id', id);
  if (error) dob(error);
}
