/**
 * Mennyiségek elemenként, egységes névvel – az IFC mennyiség-készleteiből (BaseQuantities / Qto_…BaseQuantities,
 * IFC2x3 és IFC4 elnevezéssel), ha nincs, a geometriából (térfogat, befoglaló doboz). Minden értéknél a forrás is.
 * A kiírás: azonos kategóriájú, típusú és rétegrendű elemek összesítve.
 */
import type { IfcElem, IfcModell } from './olvaso';

export type Kategoria = 'fal' | 'fuggonyfal' | 'fodem' | 'alaplemez' | 'teto' | 'pillér' | 'gerenda' | 'lepcso' | 'korlat' | 'ablak' | 'ajto' | 'ter' | 'burkolat' | 'alap' | 'egyeb';
export type Forras = 'ifc' | 'geom';
export interface Ertek { v: number; forras: Forras }
export interface ElemMennyiseg {
  id: number; guid: string; kategoria: Kategoria; nev?: string; tipusNev?: string; szint?: string; retegrend?: string;
  hossz?: Ertek; vastag?: Ertek; magassag?: Ertek; szelesseg?: Ertek;
  /** fal: oldalfelület (egyik oldal), födém / tető: felület, nyílászáró: nyílásfelület, tér: alapterület */
  Abrutto?: Ertek; Anetto?: Ertek;
  Vbrutto?: Ertek; Vnetto?: Ertek;
  /** tér: kerület, falfelület */ kerulet?: Ertek; Afal?: Ertek;
}

function kategoria(e: IfcElem): Kategoria {
  switch (e.tipus) {
    case 'IFCWALL': case 'IFCWALLSTANDARDCASE': return 'fal';
    case 'IFCCURTAINWALL': return 'fuggonyfal';
    case 'IFCSLAB': return e.altipus === 'ROOF' ? 'teto' : e.altipus === 'BASESLAB' ? 'alaplemez' : 'fodem';
    case 'IFCROOF': return 'teto';
    case 'IFCCOLUMN': return 'pillér';
    case 'IFCBEAM': return 'gerenda';
    case 'IFCSTAIR': case 'IFCSTAIRFLIGHT': case 'IFCRAMP': return 'lepcso';
    case 'IFCRAILING': return 'korlat';
    case 'IFCWINDOW': return 'ablak';
    case 'IFCDOOR': return 'ajto';
    case 'IFCSPACE': return 'ter';
    case 'IFCCOVERING': return 'burkolat';
    case 'IFCFOOTING': case 'IFCPILE': return 'alap';
    default: return 'egyeb';
  }
}

/** Az első meglévő mennyiség a készletekből (a készlet neve mindegy: BaseQuantities, Qto_WallBaseQuantities…). */
function qk(e: IfcElem, ...nevek: string[]): Ertek | undefined {
  for (const n of nevek) for (const [k, v] of Object.entries(e.q)) {
    const [kesz, nev] = [k.slice(0, k.indexOf('.')), k.slice(k.indexOf('.') + 1)];
    if (nev === n && v > 0 && (/BaseQuantities|^Qto_|^IFC$/i.test(kesz))) return { v, forras: 'ifc' };
  }
  return undefined;
}
const g = (v: number | undefined): Ertek | undefined => (v !== undefined && Number.isFinite(v) && v > 0 ? { v, forras: 'geom' } : undefined);

export function elemMennyiseg(md: IfcModell, e: IfcElem): ElemMennyiseg {
  const k = kategoria(e);
  const szint = md.szintek.find((s) => s.id === e.szint)?.nev;
  const retegrend = e.retegek?.length ? e.retegek.map((r) => `${r.anyag}${r.vastag ? ` ${Math.round(r.vastag * 1000)}` : ''}`).join(' + ') : undefined;
  const o: ElemMennyiseg = { id: e.id, guid: e.guid, kategoria: k, ...(e.nev ? { nev: e.nev } : {}), ...(e.tipusNev ? { tipusNev: e.tipusNev } : {}), ...(szint ? { szint } : {}), ...(retegrend ? { retegrend } : {}) };
  const b = e.geom; const dx = b ? b.max[0] - b.min[0] : undefined, dy = b ? b.max[1] - b.min[1] : undefined, dz = b ? b.max[2] - b.min[2] : undefined;
  const retegV = e.retegek?.reduce((s, r) => s + (r.vastag ?? 0), 0) || undefined;
  const set = (kulcs: keyof ElemMennyiseg, ...x: (Ertek | undefined)[]) => { const v = x.find(Boolean); if (v) (o as any)[kulcs] = { v: Math.round(v.v * 1000) / 1000, forras: v.forras }; };
  if (k === 'fal') {
    // geometriából: a befoglaló doboz hosszabb vízszintes oldala (ferde falnál pontatlan), vastagság a rétegrendből
    const vastag = qk(e, 'Width') ?? (retegV ? { v: retegV, forras: 'ifc' as const } : undefined);
    set('vastag', vastag);
    set('magassag', qk(e, 'Height'), g(dz));
    set('hossz', qk(e, 'Length'), g(vastag && b ? (e.geom!.V / (vastag.v * (dz || 1))) : Math.max(dx ?? 0, dy ?? 0)));
    set('Abrutto', qk(e, 'GrossSideArea'));
    set('Anetto', qk(e, 'NetSideArea'), g(vastag && b ? b.V / vastag.v : undefined));
    set('Vbrutto', qk(e, 'GrossVolume')); set('Vnetto', qk(e, 'NetVolume'), g(b?.V));
  } else if (k === 'fodem' || k === 'alaplemez' || k === 'teto') {
    const vastag = qk(e, 'Width', 'Depth', 'Thickness') ?? (retegV ? { v: retegV, forras: 'ifc' as const } : undefined);
    set('vastag', vastag);
    set('Abrutto', qk(e, 'GrossArea')); set('Anetto', qk(e, 'NetArea'), g(vastag && b && b.V > 0 ? b.V / vastag.v : b ? b.F / 2 : undefined));
    set('kerulet', qk(e, 'Perimeter'));
    set('Vbrutto', qk(e, 'GrossVolume')); set('Vnetto', qk(e, 'NetVolume'), g(b?.V));
  } else if (k === 'ablak' || k === 'ajto') {
    set('szelesseg', qk(e, 'Width', 'OverallWidth'));
    set('magassag', qk(e, 'Height', 'OverallHeight'));
    const A = o.szelesseg && o.magassag ? { v: o.szelesseg.v * o.magassag.v, forras: o.szelesseg.forras } : undefined;
    set('Abrutto', qk(e, 'Area', 'GrossArea'), A);
  } else if (k === 'ter') {
    set('Abrutto', qk(e, 'GrossFloorArea')); set('Anetto', qk(e, 'NetFloorArea'), g(b ? b.Fv / 2 : undefined));
    set('magassag', qk(e, 'Height', 'FinishCeilingHeight', 'ClearHeight'), g(dz));
    set('kerulet', qk(e, 'NetPerimeter', 'GrossPerimeter')); set('Afal', qk(e, 'NetWallArea', 'GrossWallArea'));
    set('Vnetto', qk(e, 'NetVolume', 'GrossVolume'), g(b?.V));
  } else if (k === 'burkolat') {
    // vékony elem: a felület a geometria teljes felületének fele (a két oldal), a térfogat a vastagságból
    set('vastag', qk(e, 'Width', 'Thickness'), retegV ? { v: retegV, forras: 'ifc' } : undefined);
    set('Abrutto', qk(e, 'GrossArea')); set('Anetto', qk(e, 'NetArea'), g(b ? b.F / 2 : undefined));
    set('Vnetto', qk(e, 'NetVolume', 'GrossVolume'), g(o.vastag && o.Anetto ? o.vastag.v * o.Anetto.v : undefined));
  } else if (k === 'korlat') {
    set('hossz', qk(e, 'Length'), g(Math.max(dx ?? 0, dy ?? 0)));
    set('magassag', qk(e, 'Height'), g(dz));
  } else {
    set('hossz', qk(e, 'Length'), g(Math.max(dx ?? 0, dy ?? 0, dz ?? 0)));
    set('Abrutto', qk(e, 'GrossArea', 'GrossSurfaceArea', 'CrossSectionArea'));
    set('Vbrutto', qk(e, 'GrossVolume')); set('Vnetto', qk(e, 'NetVolume'), g(b?.V));
  }
  return o;
}

export interface KiirasSor { kategoria: Kategoria; tipus: string; retegrend?: string; db: number; hossz?: number; A?: number; V?: number; egyseg: 'm²' | 'm³' | 'db' | 'm' }
/**
 * Összesített kiírás: kategória × típus × rétegrend. Fal / födém / tető: nettó felület és nettó térfogat, nyílászáró:
 * darab és felület, tér: nettó alapterület, pillér / gerenda: hossz és térfogat.
 */
export function kiiras(md: IfcModell): KiirasSor[] {
  const m = new Map<string, KiirasSor>();
  for (const e of md.elemek) {
    if (e.tipus === 'IFCOPENINGELEMENT') continue;
    const q = elemMennyiseg(md, e);
    // típus: az IFC típusnév (a Revit-féle példányazonosító – „:123456” – nélkül), ennek híján a név sorszám nélkül
    const tipus = (q.tipusNev ?? q.nev ?? q.kategoria).replace(/:\d+$/, '').replace(/[-_ ]?\d+$/, '').trim() || q.kategoria;
    const kulcs = `${q.kategoria}|${q.kategoria === 'ter' ? '' : tipus}|${q.retegrend ?? ''}`;
    const s = m.get(kulcs) ?? { kategoria: q.kategoria, tipus: q.kategoria === 'ter' ? 'terek' : tipus, ...(q.retegrend ? { retegrend: q.retegrend } : {}), db: 0, egyseg: q.kategoria === 'ablak' || q.kategoria === 'ajto' ? 'db' : q.kategoria === 'pillér' || q.kategoria === 'gerenda' ? 'm³' : 'm²' };
    s.db++;
    const add = (k: 'hossz' | 'A' | 'V', v?: Ertek) => { if (v) s[k] = Math.round(((s[k] ?? 0) + v.v) * 1000) / 1000; };
    add('hossz', q.hossz); add('A', q.Anetto ?? q.Abrutto); add('V', q.Vnetto ?? q.Vbrutto);
    m.set(kulcs, s);
  }
  return [...m.values()].sort((a, b) => a.kategoria.localeCompare(b.kategoria) || a.tipus.localeCompare(b.tipus));
}
