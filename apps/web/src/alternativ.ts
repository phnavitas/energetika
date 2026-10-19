/**
 * Alternatív rendszerek vizsgálata – 9/2023. (V. 25.) ÉKM rendelet 5. § és 4. melléklet.
 * Új épületnél és jelentős felújításnál dokumentáltan vizsgálni kell az alternatív rendszerek (megújuló alapú
 * decentralizált ellátás, kapcsolt energiatermelés, tömb- és távfűtés/-hűtés, hőszivattyú) alkalmazhatóságát:
 *  – műszaki-környezeti szempontból (4. mell. 2.9): alkalmas, ha az épület fajlagos nem megújuló primerenergia-igénye
 *    kisebb, mint az azonos geometriájú és határolású, referencia épülettechnikai rendszerű épületé;
 *  – gazdasági szempontból (3.1–3.6): alkalmas, ha a referencia rendszerhez mért beruházási többletköltség és az
 *    üzemeltetési költségkülönbség alapján az egyszerű megtérülési idő tíz éven belüli.
 * A változatokat a program a projekt másolatán a teljes számítással értékeli; a 4.1–4.7. űrlapok kérdéseire a
 * tervező válaszol (a számítható sorokat a program tölti ki).
 */
import { epuletSzamitas, type EpuletEredmeny } from '@mag/index';
import { atalakit, futesSzettbol, hmvSzettbol, ujId, type Projekt } from './modell';
import { energiaKoltseg, type EnergiaArak } from './felujitas';
import { ALAP_ARAK, EGYSEGAR } from './felujitasArak';

export type AltKod = 'szolaris' | 'biomassza' | 'kapcsolt' | 'tavho' | 'hoszivattyu';

export const ALT_NEV: Record<AltKod, string> = {
  szolaris: '4.1 Szoláris rendszerek (napkollektor, napelem)',
  biomassza: '4.2 Biomassza alapú ellátás',
  kapcsolt: '4.3 Kapcsolt hő- és villamosenergia-termelés',
  tavho: '4.4 Tömb- és távfűtés/-hűtés',
  hoszivattyu: '4.5 Hőszivattyús ellátás',
};

/** A 4.1–4.5. űrlapok sorai: kód, megnevezés, válasz típusa; „szamolt”: a program tölti ki. */
export const URLAP: Record<AltKod, { kod: string; nev: string; tipus: 'in' | 'szoveg' | 'szam' | 'szamolt'; egyseg?: string }[]> = {
  szolaris: [
    { kod: 'a.1', nev: 'Energiagyűjtésre számításba vehető határoló felületek mérete, tájolása, dőlése', tipus: 'szoveg' },
    { kod: 'a.2', nev: 'A felületek alkalmasak energiagyűjtő elemek elhelyezésére', tipus: 'in' },
    { kod: 'a.3', nev: 'A benapozás akadálytalan (terep, növényzet, épületek)', tipus: 'in' },
    { kod: 'a.5', nev: 'A HMV-energiaigény szoláris lefedési aránya', tipus: 'szamolt', egyseg: '%' },
    { kod: 'a.6', nev: 'Kiegészítő ellátás energiahordozója', tipus: 'szamolt' },
    { kod: 'a.7', nev: 'Nem megújuló primerenergia-igény', tipus: 'szamolt', egyseg: 'kWh/m²a' },
    { kod: 'a.8', nev: 'Szoláris hűtés villamos segédenergia-igénye', tipus: 'szoveg', egyseg: 'kWh/a' },
    { kod: 'a.9', nev: 'A napelemes rendszer szigetüzemben működtethető', tipus: 'in' },
    { kod: 'a.10', nev: 'A napelemes rendszer hálózatra köthető', tipus: 'in' },
    { kod: 'a.11', nev: 'A napelemes rendszer éves villamosenergia-termelése', tipus: 'szamolt', egyseg: 'kWh/a' },
    { kod: 'a.12', nev: 'Az épület éves villamosenergia-igénye', tipus: 'szamolt', egyseg: 'kWh/a' },
    { kod: 'a.13', nev: 'Az a.12 tartalmazza a berendezések (háztartási gépek) igényét', tipus: 'in' },
    { kod: 'a.14', nev: 'Szoláris rendszer műszaki-környezeti szempontból alkalmazható', tipus: 'szamolt' },
  ],
  biomassza: [
    { kod: 'b.1', nev: 'A tüzelőanyag szállítási távolsága', tipus: 'szoveg', egyseg: 'km' },
    { kod: 'b.2', nev: 'Automatikus üzemű hőtermelő berendezés beszerezhető', tipus: 'in' },
    { kod: 'b.3', nev: 'Tüzelőanyag-tárolási hely biztosítható', tipus: 'in' },
    { kod: 'b.5', nev: 'Személyes kiszolgálás gyakorisága', tipus: 'szoveg' },
    { kod: 'b.6', nev: 'Nem megújuló primerenergia-igény', tipus: 'szamolt', egyseg: 'kWh/m²a' },
    { kod: 'b.7', nev: 'Biomassza alapú ellátás műszaki-környezeti szempontból alkalmazható', tipus: 'szamolt' },
  ],
  kapcsolt: [
    { kod: 'c.1', nev: 'Rendelkezésre álló energiahordozó', tipus: 'szoveg' },
    { kod: 'c.2', nev: 'Lefedési arány', tipus: 'szoveg', egyseg: '%' },
    { kod: 'c.3', nev: 'Kiegészítő ellátás energiahordozója', tipus: 'szoveg' },
    { kod: 'c.4', nev: 'Az épületen belül hasznosítható villamosenergia-hányad', tipus: 'szoveg', egyseg: '%' },
    { kod: 'c.5', nev: 'A hálózatra csatlakozás feltételei adottak', tipus: 'in' },
    { kod: 'c.6', nev: 'A berendezések az épületen belül elhelyezhetők', tipus: 'in' },
    { kod: 'c.7', nev: 'Nem megújuló primerenergia-igény (részletes számításból, MSZ EN 15316-4-4)', tipus: 'szam', egyseg: 'kWh/m²a' },
    { kod: 'c.8', nev: 'Kapcsolt energiatermelés műszaki-környezeti szempontból alkalmazható', tipus: 'szamolt' },
  ],
  tavho: [
    { kod: 'd.1', nev: 'A legközelebbi hálózat távolsága a telekhatártól', tipus: 'szoveg', egyseg: 'm' },
    { kod: 'd.2', nev: 'A forrásoldal és a hálózat kapacitása elegendő', tipus: 'in' },
    { kod: 'd.3', nev: 'A hőhordozó paraméterei megfelelnek a tervezett rendszernek', tipus: 'in' },
    { kod: 'd.4', nev: 'Nem megújuló primerenergia-igény (a szolgáltató súlyozó tényezőjével)', tipus: 'szamolt', egyseg: 'kWh/m²a' },
    { kod: 'd.5', nev: 'Tömb- és távfűtés műszaki-környezeti szempontból alkalmazható', tipus: 'szamolt' },
  ],
  hoszivattyu: [
    { kod: 'e.1', nev: 'Fűtési üzemmódra lehetséges forrásoldal', tipus: 'szamolt' },
    { kod: 'e.2', nev: 'A geológiai adatok forrása (talajszondánál)', tipus: 'szoveg' },
    { kod: 'e.3', nev: 'Lefedési arány', tipus: 'szamolt', egyseg: '%' },
    { kod: 'e.4', nev: 'Kiegészítő ellátás energiahordozója', tipus: 'szamolt' },
    { kod: 'e.5', nev: 'Nem megújuló primerenergia-igény', tipus: 'szamolt', egyseg: 'kWh/m²a' },
    { kod: 'e.6', nev: 'Hőszivattyús ellátás műszaki-környezeti szempontból alkalmazható', tipus: 'szamolt' },
  ],
};

/** A feltételes lépések (a.4, b.4): ha ezek bármelyike „nem”, a változat műszakilag kizárt. */
const FELTETEL: Partial<Record<AltKod, string[]>> = { szolaris: ['a.2', 'a.3'], biomassza: ['b.2', 'b.3'], kapcsolt: ['c.5', 'c.6'], tavho: ['d.2', 'd.3'] };

export interface AltBeallitas {
  vizsgalt: boolean;
  valaszok: Record<string, string>;
  /** Változatparaméterek: kollektorfelület, napelem kWp, hőszivattyú forrásoldala. */
  kollektorM2?: number; pvKWp?: number; hszForras?: 'levego_viz' | 'talaj_viz';
  /** Beruházási költség (nettó Ft); üres: alapérték. */
  beruhazas?: number;
  megjegyzes?: string;
}
export interface AlternativBeallitas { valtozatok: Partial<Record<AltKod, AltBeallitas>>; refBeruhazas?: number }

export function alapAlternativ(p: Projekt): AlternativBeallitas {
  const v = (valaszok: Record<string, string>, x: Partial<AltBeallitas> = {}): AltBeallitas => ({ vizsgalt: true, valaszok, ...x });
  return {
    valtozatok: {
      szolaris: v({ 'a.1': 'Tetőfelület, dél–délnyugati tájolás, ~35° dőlés (ellenőrizendő)', 'a.2': 'I', 'a.3': 'I', 'a.9': 'N', 'a.10': 'I', 'a.13': 'N' }, { kollektorM2: Math.max(4, Math.round(p.helyisegek.reduce((s, h) => s + h.A, 0) / 25)), pvKWp: 5 }),
      biomassza: v({ 'b.1': '< 50', 'b.2': 'I', 'b.3': 'I', 'b.5': 'hetente (pellettartály utántöltése, hamuzás)' }),
      kapcsolt: v({ 'c.1': 'földgáz', 'c.5': 'N', 'c.6': 'N' }, { megjegyzes: 'Családi ház léptékében mikro-CHP gazdaságosan jellemzően nem alkalmazható; részletes számítás (MSZ EN 15316-4-4) nem készült.' }),
      tavho: v({ 'd.1': 'nincs hálózat a közelben', 'd.2': 'N', 'd.3': 'N' }),
      hoszivattyu: v({ 'e.2': 'levegő-víz rendszernél nem szükséges' }, { hszForras: 'levego_viz' }),
    },
  };
}

// ---------------------------------------------------------------------------------------------

export interface AltEredmeny {
  kod: AltKod;
  e: EpuletEredmeny | null;
  hiba: string | null;
  EnrenFajl: number | null;
  /** Számolt űrlapsorok. */
  szamolt: Record<string, string>;
  muszakiFeltetel: boolean;
  muszakiAlkalmas: boolean | null;
  koltsegAlt: number | null;
  beruhazas: number;
  beruhazasKulonbseg: number;
  uzemKulonbseg: number | null;
  megterules: number | null;
  gazdasagos: boolean | null;
}

function valtozatProjekt(p: Projekt, kod: AltKod, b: AltBeallitas): Projekt | null {
  const q = structuredClone(p);
  // A változatok a referencia épülethez mérendők: a tervezett gépi szellőzés, napelem és hűtés nélkül.
  q.gepeszet.szellozes = null; q.gepeszet.napelem = []; q.gepeszet.hutes = [];
  const f0 = q.gepeszet.futes[0];
  const alacsony = f0 ? f0.elosztas.elore <= 40 || ('valasztas' in f0.szabalyozas && f0.szabalyozas.valasztas.holeado.tipus === 'beagyazott') : false;
  switch (kod) {
    case 'szolaris':
      // A referencia rendszer (kondenzációs gázkazán fűtésre és HMV-re) kiegészítve szoláris rendszerrel.
      q.gepeszet.futes = [futesSzettbol('gaz_kondenz_radiator')];
      if (alacsony) q.gepeszet.futes[0]!.elosztas = { ...f0!.elosztas };
      q.gepeszet.hmv = hmvSzettbol('kond_kazan_indirekt');
      if (b.kollektorM2) q.gepeszet.hmv.napkollektor = { tipus: 'sik', felulet: b.kollektorM2, hajlasszog: 45, tajolasFok: 0 };
      if (b.pvKWp) q.gepeszet.napelem.push({ id: ujId(), nev: 'Napelem (alternatív változat)', kWp: b.pvKWp, tajolas: 'D', hajlasszog: 35, modszer: 'tabla' });
      return q;
    case 'biomassza':
      q.gepeszet.futes = [futesSzettbol('pellet_kazan_radiator')];
      if (alacsony) q.gepeszet.futes[0]!.elosztas = { ...f0!.elosztas };
      q.gepeszet.hmv = { ...hmvSzettbol('kond_kazan_indirekt'), hotermelo: { tipus: 'szilard', kazan: 'pellet', energiahordozo: 'bio_szilard' } };
      return q;
    case 'tavho':
      q.gepeszet.futes = [futesSzettbol('tavho_ketcsoves')];
      q.gepeszet.hmv = hmvSzettbol('tavho_cirk');
      return q;
    case 'hoszivattyu': {
      const forras = b.hszForras ?? 'levego_viz';
      const szett = forras === 'talaj_viz' ? 'hsz_talaj_viz_padlo' : alacsony ? 'hsz_levego_viz_padlo' : 'hsz_levego_viz_radiator';
      const uj = futesSzettbol(szett);
      if (forras === 'talaj_viz' && !alacsony) (uj.hotermelo as { hofok: string }).hofok = '55/45';
      q.gepeszet.futes = [uj];
      q.gepeszet.hmv = hmvSzettbol(forras === 'talaj_viz' ? 'hsz_talaj_indirekt' : 'hsz_levego_indirekt');
      return q;
    }
    default: return null;
  }
}

function szamolProjekt(q: Projekt): { e: EpuletEredmeny | null; hiba: string | null; V: number } {
  const t = atalakit(q);
  if (!t.bemenet) return { e: null, hiba: t.hibak[0] ?? 'nem számolható', V: t.geometria.V };
  try { return { e: epuletSzamitas(t.bemenet), hiba: null, V: t.geometria.V }; } catch (err) { return { e: null, hiba: (err as Error).message, V: t.geometria.V }; }
}

const EH_NEV: Record<string, string> = { fosszilis_gaz: 'földgáz', villamos: 'villamos energia', tavho: 'távhő', bio_szilard: 'biomassza', bio_szilard_korszeru: 'biomassza' };

/** Alapértelmezett nettó beruházási költségek (Ft) a felújítás-elemző egységáraiból. */
export function alapBeruhazas(kod: AltKod, b: AltBeallitas): number {
  const ar = (k: string) => EGYSEGAR[k]?.ertek ?? 0;
  switch (kod) {
    case 'szolaris': return (b.kollektorM2 ? ar('napkollektor') : 0) + (b.pvKWp ?? 0) * ar('napelem_kwp') + ar('kondenz_kazan') + ar('hmv_tarolo');
    case 'biomassza': return ar('pellet_kazan') + ar('hmv_tarolo');
    case 'tavho': return 1500000;
    case 'hoszivattyu': return (b.hszForras === 'talaj_viz' ? 2 : 1) * ar('hoszivattyu');
    default: return 0;
  }
}
export const REF_BERUHAZAS_ALAP = (): number => (EGYSEGAR.kondenz_kazan?.ertek ?? 0) + (EGYSEGAR.hmv_tarolo?.ertek ?? 0);

export function alternativVizsgalat(p: Projekt, beall: AlternativBeallitas, arak: EnergiaArak = p.felujitas?.arak ?? ALAP_ARAK): { ref: { EnrenFajl: number; koltseg: number } | null; terv: EpuletEredmeny | null; valtozatok: AltEredmeny[] } {
  const terv = szamolProjekt(p);
  if (!terv.e) return { ref: null, terv: null, valtozatok: [] };
  const refE = terv.e.referenciaEpulet;
  // A referencia rendszer üzemköltsége: kondenzációs gázkazán fűtésre és HMV-re (5. melléklet 2.) a tervezett épület igényeivel.
  const refProj = structuredClone(p);
  refProj.gepeszet.futes = [futesSzettbol('gaz_kondenz_radiator')];
  refProj.gepeszet.hmv = hmvSzettbol('kond_kazan_indirekt');
  refProj.gepeszet.szellozes = null; refProj.gepeszet.napelem = []; refProj.gepeszet.hutes = [];
  const refSz = szamolProjekt(refProj);
  const refKoltseg = refSz.e ? energiaKoltseg(refSz.e, arak, refSz.V).osszes : 0;
  const refBer = beall.refBeruhazas ?? REF_BERUHAZAS_ALAP();

  const valtozatok = (Object.keys(ALT_NEV) as AltKod[]).map((kod): AltEredmeny => {
    const b = beall.valtozatok[kod] ?? { vizsgalt: false, valaszok: {} };
    const feltetel = (FELTETEL[kod] ?? []).every((k) => b.valaszok[k] !== 'N');
    const szamolt: Record<string, string> = {};
    let e: EpuletEredmeny | null = null, hiba: string | null = null, EnrenFajl: number | null = null, koltseg: number | null = null;
    if (kod === 'kapcsolt') {
      const v = Number(String(b.valaszok['c.7'] ?? '').replace(',', '.'));
      EnrenFajl = Number.isFinite(v) && v > 0 ? v : null;
      if (EnrenFajl === null) hiba = 'Részletes számítás nélkül (MSZ EN 15316-4-4) nem értékelhető; az eredmény a c.7 sorba írható.';
    } else if (feltetel) {
      const q = valtozatProjekt(p, kod, b)!;
      const r = szamolProjekt(q);
      e = r.e; hiba = r.hiba;
      if (e) { EnrenFajl = e.indikatorok.fajlagos.EnrenFajl; koltseg = energiaKoltseg(e, arak, r.V).osszes; }
    } else hiba = 'A feltételes kérdésre adott „nem” válasz miatt a változat kizárt.';

    const f = (x: number, t = 1) => x.toLocaleString('hu-HU', { maximumFractionDigits: t, minimumFractionDigits: t });
    if (e) {
      const hmv = e.rendszerek.find((r) => r.cel === 'hmv');
      const futes = e.rendszerek.filter((r) => r.cel === 'futes');
      if (kod === 'szolaris') {
        const koll = hmv?.tetelek.find((t) => t.energiahordozo === 'nap_termikus')?.Q ?? 0;
        szamolt['a.5'] = hmv?.reszletek.Qleadott ? f((koll / hmv.reszletek.Qleadott) * 100, 0) : '0';
        szamolt['a.6'] = EH_NEV[hmv?.tetelek[0]?.energiahordozo ?? ''] ?? hmv?.tetelek[0]?.energiahordozo ?? '–';
        szamolt['a.7'] = f(EnrenFajl!);
        szamolt['a.11'] = f(e.napelem.reduce((s, n) => s + n.W, 0), 0);
        szamolt['a.12'] = f(e.indikatorok.vegenergia.villamos ?? 0, 0);
      }
      if (kod === 'biomassza') szamolt['b.6'] = f(EnrenFajl!);
      if (kod === 'tavho') szamolt['d.4'] = f(EnrenFajl!);
      if (kod === 'hoszivattyu') {
        szamolt['e.1'] = b.hszForras === 'talaj_viz' ? 'talaj (függőleges szonda)' : 'külső levegő';
        szamolt['e.3'] = '100';
        szamolt['e.4'] = 'nincs (monovalens); a HMV is hőszivattyúval';
        szamolt['e.5'] = f(EnrenFajl!);
      }
      void futes;
    }
    const muszakiAlkalmas = !b.vizsgalt ? null : EnrenFajl === null ? (feltetel ? null : false) : feltetel && EnrenFajl < refE.EnrenFajl;
    const iKod = { szolaris: 'a.14', biomassza: 'b.7', kapcsolt: 'c.8', tavho: 'd.5', hoszivattyu: 'e.6' }[kod];
    szamolt[iKod] = muszakiAlkalmas === null ? '–' : muszakiAlkalmas ? 'I' : 'N';

    const beruhazas = b.beruhazas ?? alapBeruhazas(kod, b);
    const beruhazasKulonbseg = beruhazas - refBer;
    const uzemKulonbseg = koltseg === null ? null : refKoltseg - koltseg;
    let megterules: number | null = null;
    if (uzemKulonbseg !== null) megterules = beruhazasKulonbseg <= 0 ? 0 : uzemKulonbseg > 0 ? beruhazasKulonbseg / uzemKulonbseg : null;
    const gazdasagos = muszakiAlkalmas ? (megterules !== null && megterules <= 10) : null;
    return { kod, e, hiba, EnrenFajl, szamolt, muszakiFeltetel: feltetel, muszakiAlkalmas, koltsegAlt: koltseg, beruhazas, beruhazasKulonbseg, uzemKulonbseg, megterules, gazdasagos };
  });
  return { ref: { EnrenFajl: refE.EnrenFajl, koltseg: refKoltseg }, terv: terv.e, valtozatok };
}
