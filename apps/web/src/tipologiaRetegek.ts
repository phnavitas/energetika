/**
 * A TABULA tipológia szöveges rétegrendjeinek leképezése a beépített anyagkatalógusra: a felvett szerkezet valódi
 * rétegekből áll (anyag, vastagság, λ). Ahol a forrás anyagára nincs ellenőrizhető λ (B30 blokk, régi hőszigetelő
 * falazóblokk, habüveg), azt a réteget a forrás U-értékéből visszaszámolt egyenértékű λ-val vesszük fel, és ezt a
 * réteg neve jelzi. A kiszellőztetett légrés feletti rétegek (cserép, léc, alátéthéjazat) nem számítanak.
 */
import type { tipologia as TP } from '@mag/index';
import { ujId, retegrendSzamitas, retegrendAutoNev, SZEREP_ALAP, type Retegrend, type RetegUI, type Szerep } from './modell';

export const TIP_SZEREP: Record<Exclude<TP.TipologiaSzerep, 'ablak' | 'ajto'>, Szerep> = {
  fal: 'fal', padlasfodem: 'padlas', 'magastető': 'teto', 'lapostető': 'teto', padlo_talajon: 'padlo', pince_feletti_fodem: 'pincefodem',
};

/** Hőszigetelő anyag alapértelmezése szerkezetenként (a felületen cserélhető). */
export const SZIG_ALAP: Record<Szerep, string> = {
  fal: 'eps80_feher', padlas: 'asvanyiyapot_lemez_padlas', teto: 'asvanyiyapot_szarufa', pincefodem: 'eps100_feher', padlo: 'eps100_feher', belso: 'eps80_feher',
};
export const SZIG_VALASZTEK = ['eps80_feher', 'eps80_grafit', 'eps100_feher', 'eps100_grafit', 'xps_labazati', 'kozetgyapot_homlokzati', 'uveggyapot_tekercs', 'asvanyiyapot_szarufa', 'asvanyiyapot_lemez_padlas', 'pir_alu', 'pir_uvegfatyol', 'celluloz_befujt', 'kender', 'fagyapot_heraklith', 'multipor'];

type Lekepezes = { anyagId: string; dCm?: number } | { szamolt: true } | { szig: true } | null;

/** Egy forrásbeli réteg anyaga. null: kimarad (pl. fagerenda, cserép). */
export function retegLekepez(szerep: TP.TipologiaSzerep, nev: string, regi: boolean): Lekepezes {
  const n = nev.toLowerCase();
  if (/cserép|lécezés|alátét/.test(n)) return null;
  if (/gerenda/.test(n) && !/között/.test(n)) return null;
  if (/vízszigetelés/.test(n)) return { anyagId: 'bitumenes_lemez', dCm: 0.5 };
  if (/párazáró/.test(n)) return { anyagId: 'pe_folia', dCm: 0.02 };
  if (/vakolat/.test(n)) return { anyagId: regi ? 'mesz_vakolat' : 'meszcement_vakolat' };
  if (/tömör tégla|téglaboltozat/.test(n)) return { anyagId: 'tomor_tegla_falazat' };
  if (/vályog/.test(n)) return { anyagId: 'valyog_1600' };
  if (/b30|b 30/.test(n) || n === 'falazóblokk') return { anyagId: 'tt_b_30_falazat' };
  if (/hőszigetelő (kerámia )?falazóblokk/.test(n)) return { anyagId: 'tt_porotherm_30_n_f' };
  if (/habüveg/.test(n)) return { anyagId: 'tt_habuveg_400_kg_m3' };
  if (/linóleum/.test(n)) return { anyagId: 'tt_linoleum' };
  if (/pir/.test(n)) return { anyagId: 'pir_alu' };
  if (/kőzetgyapot|ásványgyapot|polisztirol|hőszigetelés/.test(n)) return { szig: true };
  if (/gipszkarton/.test(n)) return { anyagId: 'gipszkarton_rb' };
  if (/lejtés/.test(n)) return { anyagId: 'beton_2200' };
  if (/aljzatbeton/.test(n)) return { anyagId: 'esztrich_cement' };
  if (/vasbeton/.test(n)) return { anyagId: 'vasbeton_2300' };
  if (/kavics/.test(n)) return { anyagId: 'kavics_homok' };
  if (/salak/.test(n)) return { anyagId: 'salak_feltoltes' };
  if (/agyag|döngölt/.test(n)) return { anyagId: 'foldfeltoltes' };
  if (/nád/.test(n)) return { anyagId: 'nad' };
  if (/parketta/.test(n)) return { anyagId: 'parketta' };
  if (/deszk|hajópadló/.test(n)) return { anyagId: 'puhafa' };
  if (/kerámia burkolat/.test(n)) return { anyagId: 'keramia' };
  return { szamolt: true };
}

/** A szigetelés felhasználói beállítása (anyag, vastagság); üres: a forrás szerinti. */
export interface SzigBeallitas { anyagId?: string; dCm?: number }

/** Forrásbeli hőszigetelő réteg anyaga a megnevezés alapján. */
function szigAnyag(szerep: Szerep, nev: string): string {
  const n = nev.toLowerCase();
  if (/kőzetgyapot/.test(n)) return szerep === 'fal' ? 'kozetgyapot_homlokzati' : 'asvanyiyapot_lemez_padlas';
  if (/szarufák között/.test(n)) return 'asvanyiyapot_szarufa';
  if (/fagerendák között/.test(n)) return 'uveggyapot_tekercs';
  if (/ásványgyapot/.test(n)) return szerep === 'teto' ? 'asvanyiyapot_szarufa' : 'asvanyiyapot_lemez_padlas';
  if (/polisztirol/.test(n)) return szerep === 'fal' ? 'eps80_feher' : 'eps100_feher';
  return SZIG_ALAP[szerep];
}

/** A szerkezet rétegei: a „meglévő …” réteg helyére az eredeti állapot rétegei kerülnek. */
export function tipologiaRetegek(t: TP.TipologiaTipus, sz0: TP.TipologiaSzerkezet): TP.TipologiaSzerkezet['retegek'] {
  // „Nincs változás”: a felújítási változat rétegek nélkül az eredeti szerkezetet jelenti.
  if (!sz0.retegek.length) return t.szerkezetek.find((x) => x.szerep === sz0.szerep)?.retegek ?? [];
  const ki: TP.TipologiaSzerkezet['retegek'] = [];
  for (const r of sz0.retegek) {
    if (/^meglévő/i.test(r.nev)) {
      const eredeti = t.szerkezetek.find((x) => x.szerep === sz0.szerep);
      if (eredeti) ki.push(...eredeti.retegek);
    } else ki.push(r);
  }
  return ki;
}

function retegekEpit(t: TP.TipologiaTipus, sz0: TP.TipologiaSzerkezet, szig?: SzigBeallitas, lambdaSzamolt = 1): (RetegUI & { szamolt?: boolean })[] {
  const szerep = TIP_SZEREP[sz0.szerep as keyof typeof TIP_SZEREP];
  const regi = (t.korszak[1] ?? 9999) < 1945;
  const felujitas = sz0.retegek.some((r) => /^meglévő/i.test(r.nev));
  const eredetiDb = felujitas ? t.szerkezetek.find((x) => x.szerep === sz0.szerep)?.retegek.length ?? 0 : 0;
  const ki: (RetegUI & { szamolt?: boolean })[] = [];
  tipologiaRetegek(t, sz0).forEach((x, i) => {
    const l = retegLekepez(sz0.szerep, x.nev, regi);
    if (!l) return;
    const d = x.dCm ?? ('dCm' in l ? l.dCm : undefined);
    if (!d) return;
    if ('szig' in l) {
      const uj = !felujitas || i >= eredetiDb;
      ki.push({ id: ujId(), anyagId: uj && szig?.anyagId ? szig.anyagId : szigAnyag(szerep, x.nev), dCm: uj && szig?.dCm ? szig.dCm : d });
    } else if ('szamolt' in l) {
      ki.push({ id: ujId(), nev: `${x.nev} – egyenértékű λ a forrás eredeti U-értékéből visszaszámolva`, dCm: d, lambda: lambdaSzamolt, szamolt: true });
    } else ki.push({ id: ujId(), anyagId: l.anyagId, dCm: d });
  });
  return ki;
}

/** Ismeretlen anyagú réteg (pl. B30 blokk) egyenértékű λ-ja: az eredeti állapot U-ja a forrás szerinti legyen. */
function kalibraltLambda(t: TP.TipologiaTipus, szerepT: TP.TipologiaSzerep): number | null {
  const eredeti = t.szerkezetek.find((x) => x.szerep === szerepT);
  if (!eredeti) return null;
  const szerep = TIP_SZEREP[szerepT as keyof typeof TIP_SZEREP];
  const ret = retegekEpit(t, eredeti, undefined, 1e9);
  const i = ret.findIndex((x) => x.szamolt);
  if (i < 0) return null;
  const R0 = 1 / retegrendSzamitas({ id: 'x', nev: '', szerep, ...SZEREP_ALAP[szerep], retegek: ret }).U;
  const Rkell = 1 / eredeti.U - R0;
  return Rkell > 0.01 ? Math.round((ret[i]!.dCm / 100 / Rkell) * 1000) / 1000 : null;
}

/** Valódi rétegekből álló rétegrend a tipológiai szerkezetből; a szigetelés anyaga és vastagsága felülírható. */
export function tipologiaRetegrend(t: TP.TipologiaTipus, sz0: TP.TipologiaSzerkezet, cimke: string, szig?: SzigBeallitas): { r: Retegrend; Uszamolt: number; visszaszamolt: boolean } {
  const szerep = TIP_SZEREP[sz0.szerep as keyof typeof TIP_SZEREP];
  const lam = kalibraltLambda(t, sz0.szerep);
  const ret = retegekEpit(t, sz0, szig, lam ?? 0.5);
  const visszaszamolt = ret.some((x) => x.szamolt);
  const r: Retegrend = { id: ujId(), nev: '', nevKezi: true, szerep, ...SZEREP_ALAP[szerep], retegek: ret.map(({ szamolt: _s, ...x }) => x) };
  r.nev = `${retegrendAutoNev(r)} (${cimke})`;
  return { r, Uszamolt: retegrendSzamitas(r).U, visszaszamolt };
}
