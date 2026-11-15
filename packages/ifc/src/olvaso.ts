/**
 * IFC-olvasó: az IFC-fájl épületelemei (szintek, falak, födémek, tetők, pillérek, gerendák, lépcsők, korlátok,
 * nyílászárók, terek, burkolatok…) a mennyiségeikkel. Forrás elemenként:
 * - az IFC mennyiség-készletei (BaseQuantities / Qto_* / ArchiCADQuantities stb.) változatlanul (`q`, készlet.név → érték, m / m² / m³);
 * - a geometriából számolt térfogat és befoglaló doboz (`geom`) – minden elemre, a készletektől függetlenül (ellenőrzés,
 *   és ahol a fájl nem tartalmaz mennyiségeket);
 * - anyag / rétegrend (`retegek`), szint, típusnév, gazdaelem (nyílászáró → fal / födém) kapcsolatok.
 * A web-ifc IfcAPI-t a hívó adja (böngészőben és node-ban is), inicializálva.
 */
import * as W from 'web-ifc';

export interface IfcSzint { id: number; nev: string; z: number }
export interface IfcReteg { anyag: string; vastag?: number }
export interface IfcElem {
  id: number; guid: string;
  /** IFC entitás (pl. IFCWALLSTANDARDCASE) és a predefinált típus (pl. FLOOR, ROOF), ha van */
  tipus: string; altipus?: string;
  nev?: string; leiras?: string; tipusNev?: string;
  szint?: number;
  retegek?: IfcReteg[];
  /** mennyiség-készletek: "készlet.mennyiség" → érték (SI: m, m², m³, db) */
  q: Record<string, number>;
  /** tulajdonság-készletek egyszerű értékei: "készlet.tulajdonság" → érték */
  p: Record<string, string | number | boolean>;
  /** a geometriából: térfogat (m³; nyitott felületnél pontatlan), a teljes felület (F, m²), a vízszintes vetületek összege (Fv, m² – zárt testnél az alapterület kétszerese) és befoglaló doboz (m, a modell koordinátáiban) */
  geom?: { V: number; F: number; Fv: number; min: [number, number, number]; max: [number, number, number] };
  /** nyílászáró / nyílás: a gazdaelem (fal, födém); fal: a benne lévő nyílások (IfcOpeningElement) */
  gazda?: number; nyilasok?: number[];
  /** nyílászáró: a kitöltött nyílás */ nyilas?: number;
}
export interface IfcModell { schema: string; hossz: number; szintek: IfcSzint[]; elemek: IfcElem[] }

/** A beolvasott elemtípusok (az épület elemei és a terek – a geometria nélküli segédelemek nem). */
const TIPUSOK: [number, string][] = [
  [W.IFCWALL, 'IFCWALL'], [W.IFCWALLSTANDARDCASE, 'IFCWALLSTANDARDCASE'], [W.IFCCURTAINWALL, 'IFCCURTAINWALL'],
  [W.IFCSLAB, 'IFCSLAB'], [W.IFCROOF, 'IFCROOF'], [W.IFCCOLUMN, 'IFCCOLUMN'], [W.IFCBEAM, 'IFCBEAM'],
  [W.IFCSTAIR, 'IFCSTAIR'], [W.IFCSTAIRFLIGHT, 'IFCSTAIRFLIGHT'], [W.IFCRAMP, 'IFCRAMP'], [W.IFCRAILING, 'IFCRAILING'],
  [W.IFCWINDOW, 'IFCWINDOW'], [W.IFCDOOR, 'IFCDOOR'], [W.IFCOPENINGELEMENT, 'IFCOPENINGELEMENT'],
  [W.IFCSPACE, 'IFCSPACE'], [W.IFCCOVERING, 'IFCCOVERING'], [W.IFCFOOTING, 'IFCFOOTING'], [W.IFCPILE, 'IFCPILE'],
  [W.IFCMEMBER, 'IFCMEMBER'], [W.IFCPLATE, 'IFCPLATE'], [W.IFCCHIMNEY, 'IFCCHIMNEY'], [W.IFCBUILDINGELEMENTPROXY, 'IFCBUILDINGELEMENTPROXY'],
];

const ert = (v: any): any => (v && typeof v === 'object' && 'value' in v ? v.value : v);
const szoveg = (v: any): string | undefined => { const x = ert(v); return typeof x === 'string' ? dekodol(x) : undefined; };
/** STEP \X2\…\X0\ (UTF-16 hex) és \X\.. kódolás feloldása */
function dekodol(s: string): string {
  return s.replace(/\\X2\\([0-9A-F]+)\\X0\\/gi, (_, h: string) => { let o = ''; for (let i = 0; i + 3 < h.length; i += 4) o += String.fromCharCode(parseInt(h.slice(i, i + 4), 16)); return o; })
    .replace(/\\X\\([0-9A-F]{2})/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
}

/** A hosszegység (m-ben): az IFCUNITASSIGNMENT LENGTHUNIT SI-előtagja (MILLI → 0,001), alapértelmezés 1. */
function hosszEgyseg(api: W.IfcAPI, m: number): number {
  const ids = api.GetLineIDsWithType(m, W.IFCSIUNIT);
  for (let i = 0; i < ids.size(); i++) {
    const u = api.GetLine(m, ids.get(i));
    if (ert(u.UnitType) !== 'LENGTHUNIT') continue;
    const pre = ert(u.Prefix);
    return pre === 'MILLI' ? 0.001 : pre === 'CENTI' ? 0.01 : pre === 'DECI' ? 0.1 : 1;
  }
  const cu = api.GetLineIDsWithType(m, W.IFCCONVERSIONBASEDUNIT);
  for (let i = 0; i < cu.size(); i++) { const u = api.GetLine(m, cu.get(i)); if (ert(u.UnitType) === 'LENGTHUNIT' && /foot|feet/i.test(szoveg(u.Name) ?? '')) return 0.3048; }
  return 1;
}

function lista(api: W.IfcAPI, m: number, t: number): number[] { const v = api.GetLineIDsWithType(m, t); const o: number[] = []; for (let i = 0; i < v.size(); i++) o.push(v.get(i)); return o; }

export function ifcBeolvas(api: W.IfcAPI, adat: Uint8Array, opciok: { geometria?: boolean } = {}): IfcModell {
  const m = api.OpenModel(adat, { COORDINATE_TO_ORIGIN: false });
  try {
    const schema = api.GetModelSchema(m) ?? '';
    const L = hosszEgyseg(api, m);
    // szintek
    const szintek: IfcSzint[] = lista(api, m, W.IFCBUILDINGSTOREY).map((id) => { const s = api.GetLine(m, id); return { id, nev: szoveg(s.Name) ?? szoveg(s.LongName) ?? `Szint ${id}`, z: (Number(ert(s.Elevation)) || 0) * L }; }).sort((a, b) => a.z - b.z);
    // elemek
    const elemek = new Map<number, IfcElem>();
    for (const [t, nev] of TIPUSOK) for (const id of lista(api, m, t)) {
      if (elemek.has(id)) continue;
      const e = api.GetLine(m, id);
      elemek.set(id, { id, guid: szoveg(e.GlobalId) ?? '', tipus: nev, ...(ert(e.PredefinedType) && ert(e.PredefinedType) !== 'NOTDEFINED' ? { altipus: String(ert(e.PredefinedType)) } : {}),
        ...(szoveg(e.Name) ? { nev: szoveg(e.Name) } : {}), ...(szoveg(e.Description) ? { leiras: szoveg(e.Description) } : {}),
        ...(nev === 'IFCSPACE' && szoveg(e.LongName) ? { leiras: szoveg(e.LongName) } : {}), q: {}, p: {} });
    }
    // szint: térbeli tartalmazás (és a terek / aggregált részek a szülőjükön keresztül)
    for (const r of lista(api, m, W.IFCRELCONTAINEDINSPATIALSTRUCTURE)) {
      const rel = api.GetLine(m, r); const sz = ert(rel.RelatingStructure);
      for (const x of rel.RelatedElements ?? []) { const e = elemek.get(ert(x)); if (e && szintek.some((s) => s.id === sz)) e.szint = sz; }
    }
    for (const r of lista(api, m, W.IFCRELAGGREGATES)) {
      const rel = api.GetLine(m, r); const sz = ert(rel.RelatingObject);
      for (const x of rel.RelatedObjects ?? []) { const e = elemek.get(ert(x)); if (!e || e.szint !== undefined) continue; if (szintek.some((s) => s.id === sz)) e.szint = sz; else { const sz2 = elemek.get(sz)?.szint; if (sz2 !== undefined) e.szint = sz2; } }
    }
    // tulajdonság- és mennyiség-készletek
    for (const r of lista(api, m, W.IFCRELDEFINESBYPROPERTIES)) {
      const rel = api.GetLine(m, r); const pd = api.GetLine(m, ert(rel.RelatingPropertyDefinition)); if (!pd) continue;
      const kn = szoveg(pd.Name) ?? '?';
      const celok = (rel.RelatedObjects ?? []).map((x: any) => elemek.get(ert(x))).filter(Boolean) as IfcElem[]; if (!celok.length) continue;
      if (pd.Quantities) for (const qh of pd.Quantities) {
        const q = api.GetLine(m, ert(qh)); if (!q) continue;
        const qn = szoveg(q.Name) ?? '?';
        const v = ert(q.LengthValue) ?? ert(q.AreaValue) ?? ert(q.VolumeValue) ?? ert(q.CountValue) ?? ert(q.WeightValue);
        if (typeof v !== 'number') continue;
        const sk = q.LengthValue !== undefined && q.LengthValue !== null ? L : q.AreaValue !== undefined && q.AreaValue !== null ? L * L : q.VolumeValue !== undefined && q.VolumeValue !== null ? L * L * L : 1;
        for (const c of celok) c.q[`${kn}.${qn}`] = v * sk;
      }
      if (pd.HasProperties) for (const ph of pd.HasProperties) {
        const p = api.GetLine(m, ert(ph)); if (!p || p.NominalValue === undefined) continue;
        const v = ert(p.NominalValue); if (v === null || v === undefined || typeof v === 'object') continue;
        for (const c of celok) c.p[`${kn}.${szoveg(p.Name) ?? '?'}`] = typeof v === 'string' ? dekodol(v) : v;
      }
    }
    // típus (IfcRelDefinesByType) – típusnév és a típuson lévő tulajdonságok nélkül
    for (const r of lista(api, m, W.IFCRELDEFINESBYTYPE)) {
      const rel = api.GetLine(m, r); const t = api.GetLine(m, ert(rel.RelatingType)); const tn = szoveg(t?.Name);
      if (tn) for (const x of rel.RelatedObjects ?? []) { const e = elemek.get(ert(x)); if (e) e.tipusNev = tn; }
    }
    // anyag / rétegrend
    for (const r of lista(api, m, W.IFCRELASSOCIATESMATERIAL)) {
      const rel = api.GetLine(m, r); const retegek = anyagRetegek(api, m, ert(rel.RelatingMaterial), L);
      if (retegek.length) for (const x of rel.RelatedObjects ?? []) { const e = elemek.get(ert(x)); if (e && !e.retegek) e.retegek = retegek; }
    }
    // nyílások: fal ← nyílás (IfcRelVoidsElement), nyílás ← nyílászáró (IfcRelFillsElement)
    const nyilasGazda = new Map<number, number>();
    for (const r of lista(api, m, W.IFCRELVOIDSELEMENT)) {
      const rel = api.GetLine(m, r); const g = ert(rel.RelatingBuildingElement), ny = ert(rel.RelatedOpeningElement);
      nyilasGazda.set(ny, g); const ge = elemek.get(g); if (ge) (ge.nyilasok ??= []).push(ny);
      const ne = elemek.get(ny); if (ne) ne.gazda = g;
    }
    for (const r of lista(api, m, W.IFCRELFILLSELEMENT)) {
      const rel = api.GetLine(m, r); const ny = ert(rel.RelatingOpeningElement), e = elemek.get(ert(rel.RelatedBuildingElement));
      if (e) { e.nyilas = ny; const g = nyilasGazda.get(ny); if (g !== undefined) e.gazda = g; }
    }
    // a nyílás szintje a gazdáé
    for (const e of elemek.values()) if (e.szint === undefined && e.gazda !== undefined) { const g = elemek.get(e.gazda); if (g?.szint !== undefined) e.szint = g.szint; }
    // ablak / ajtó méretei
    for (const e of elemek.values()) if (e.tipus === 'IFCWINDOW' || e.tipus === 'IFCDOOR') {
      const l = api.GetLine(m, e.id);
      const sz = Number(ert(l.OverallWidth)), ma = Number(ert(l.OverallHeight));
      if (sz > 0) e.q['IFC.OverallWidth'] = sz * L; if (ma > 0) e.q['IFC.OverallHeight'] = ma * L;
    }
    // geometria: térfogat és befoglaló doboz (web-ifc: a geometria méterben, a skálázással)
    if (opciok.geometria !== false) {
      const meshFv = (fm: W.FlatMesh) => {
        const e = elemek.get(fm.expressID); if (!e) return;
        let V = 0, F = 0, Fv = 0; const mn: [number, number, number] = [Infinity, Infinity, Infinity], mx: [number, number, number] = [-Infinity, -Infinity, -Infinity];
        for (let g = 0; g < fm.geometries.size(); g++) {
          const pg = fm.geometries.get(g); const geo = api.GetGeometry(m, pg.geometryExpressID);
          const vd = api.GetVertexArray(geo.GetVertexData(), geo.GetVertexDataSize()), ix = api.GetIndexArray(geo.GetIndexData(), geo.GetIndexDataSize());
          const T = pg.flatTransformation;
          const pont = (k: number): [number, number, number] => { const x = vd[k * 6]!, y = vd[k * 6 + 1]!, z = vd[k * 6 + 2]!; return [T[0]! * x + T[4]! * y + T[8]! * z + T[12]!, T[1]! * x + T[5]! * y + T[9]! * z + T[13]!, T[2]! * x + T[6]! * y + T[10]! * z + T[14]!]; };
          for (let k = 0; k < vd.length / 6; k++) { const p = pont(k); for (let a = 0; a < 3; a++) { if (p[a]! < mn[a]!) mn[a] = p[a]!; if (p[a]! > mx[a]!) mx[a] = p[a]!; } }
          for (let t = 0; t + 2 < ix.length; t += 3) { const a = pont(ix[t]!), b = pont(ix[t + 1]!), c = pont(ix[t + 2]!); V += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6; const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; const ny = u[2]! * w[0]! - u[0]! * w[2]!; F += Math.hypot(u[1]! * w[2]! - u[2]! * w[1]!, ny, u[0]! * w[1]! - u[1]! * w[0]!) / 2; Fv += Math.abs(ny) / 2; }
          geo.delete?.();
        }
        // (web-ifc: Y felfelé – a befoglaló dobozt [x, y(vízszintes), z(függőleges)] sorrendbe fordítjuk)
        if (!Number.isFinite(mn[0])) return;
        e.geom = { V: Math.abs(V), F, Fv, min: [mn[0], -mx[2], mn[1]], max: [mx[0], -mn[2], mx[1]] };
      };
      api.StreamAllMeshes(m, meshFv);
      // (a terek geometriáját az alapértelmezett bejárás kihagyja)
      try { api.StreamAllMeshesWithTypes(m, [W.IFCSPACE], meshFv); } catch { /* */ }
    }
    return { schema, hossz: L, szintek, elemek: [...elemek.values()] };
  } finally { api.CloseModel(m); }
}

/** Anyag / rétegrend (IfcMaterial, IfcMaterialLayerSet(Usage), IfcMaterialList, IfcMaterialConstituentSet, IfcMaterialProfileSet). */
function anyagRetegek(api: W.IfcAPI, m: number, id: number, L: number): IfcReteg[] {
  const x = api.GetLine(m, id); if (!x) return [];
  const t = String(api.GetNameFromTypeCode(x.type)).toUpperCase();
  if (t === 'IFCMATERIAL') return [{ anyag: szoveg(x.Name) ?? '?' }];
  if (t === 'IFCMATERIALLAYERSETUSAGE') return anyagRetegek(api, m, ert(x.ForLayerSet), L);
  if (t === 'IFCMATERIALLAYERSET') return (x.MaterialLayers ?? []).map((h: any) => { const l = api.GetLine(m, ert(h)); const a = l?.Material ? api.GetLine(m, ert(l.Material)) : null; return { anyag: szoveg(a?.Name) ?? szoveg(l?.Name) ?? '?', vastag: (Number(ert(l?.LayerThickness)) || 0) * L }; });
  if (t === 'IFCMATERIALLIST') return (x.Materials ?? []).flatMap((h: any) => anyagRetegek(api, m, ert(h), L));
  if (t === 'IFCMATERIALCONSTITUENTSET') return (x.MaterialConstituents ?? []).flatMap((h: any) => { const c = api.GetLine(m, ert(h)); return c?.Material ? anyagRetegek(api, m, ert(c.Material), L) : []; });
  if (t === 'IFCMATERIALPROFILESETUSAGE') return anyagRetegek(api, m, ert(x.ForProfileSet), L);
  if (t === 'IFCMATERIALPROFILESET') return (x.MaterialProfiles ?? []).flatMap((h: any) => { const p = api.GetLine(m, ert(h)); return p?.Material ? anyagRetegek(api, m, ert(p.Material), L) : []; });
  return [];
}
