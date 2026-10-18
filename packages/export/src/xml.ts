/**
 * e-tanúsítás feltöltési fájl (UploadRequest) generálása.
 *
 * FONTOS: a Lechner Tudásközpont XSD-je nincs a birtokunkban. A szerkezet és a kódértékek kizárólag egy
 * ténylegesen elfogadott WinWatt 9.54 exportból származnak. Minden olyan kódnál, amelyet a mintában nem
 * láttunk (pl. földgáz energiahordozó, közepes szerkezetminősítés), a generátor HIBÁT dob ahelyett, hogy
 * kitalálna egy értéket. Az XSD beszerzése után ezek a táblák kiegészítendők.
 */
import type { EpuletEredmeny } from '../../mag/src/epulet.js';
import { U_KOVETELMENYEK, MINOSITES_XML, type Minosites } from '../../mag/src/tablak/kovetelmeny.js';
import { SULYOZO } from '../../mag/src/tablak/sulyozo.js';

export class XmlKodHianyzik extends Error {
  constructor(public mezo: string, public ertek: string) {
    super(`Az e-tanúsítás XML kódja nem ismert: ${mezo} = „${ertek}”. Az XSD beszerzéséig ez az eset nem exportálható.`);
  }
}

export interface Cim { iranyitoszam: string; telepules: string; kozterulet: string; kozteruletJelleg: string; }

export interface TanusitasAdatok {
  megrendelo: string;
  epuletCim: Cim & { epulet: string; lepcsohaz: string; emelet: string; ajto: string };
  hrsz: string;
  /** XML CertIssueReason – a mintában látott érték: 'Other'. */
  tanusitasOka: 'Other';
  /** A mintában: 'ResidentialBuilding'. */
  rendeltetes: 'ResidentialBuilding';
  /** A mintában: 'SingleFamilyDetachedHome'. */
  epuletKategoria: 'SingleFamilyDetachedHome';
  epitesiEv: number;
  vedett: false;
  szintekSzama: number;
  kozforgalmu: boolean;
  kozTulajdon: boolean;
  onalloRendeltetesiEgyseg: boolean;
  tanusito: { nev: string; cim: Cim & { hazszam: string }; telefon: string; email: string; jogosultsag: string };
  szoftver: string;
  helysziniSzemle: string; // ÉÉÉÉ-HH-NN
  /** A mintában látott kategóriák. */
  fotok: { kategoria: 'CoverPhoto' | 'Facade' | 'CharacteristicOpeningStructure' | 'HeatGeneratorAndHeatStorageSituation' | 'CharacteristicHeatExchanger'; jpegBase64: string }[];
  /** A számítási jegyzőkönyv PDF (base64). */
  jegyzokonyvPdfBase64: string;
  /** Alternatív rendszerek a mintában látott kóddal. */
  alternativEnergiak: 'HeatPump'[];
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const k2 = (x: number) => x.toFixed(2);
/** U-érték: legfeljebb 3 tizedes, záró nullák nélkül (a mintában: 0.229, 0.15, 1.4). */
const u3 = (x: number) => String(Number(x.toFixed(3)));
const t1 = (x: number) => x.toFixed(1);

function el(nev: string, tartalom: string | number | boolean): string {
  return `<${nev}>${typeof tartalom === 'string' ? esc(tartalom) : String(tartalom)}</${nev}>`;
}
function blokk(nev: string, ...gyerek: string[]): string {
  return `<${nev}>${gyerek.join('')}</${nev}>`;
}

function minositesKod(m: Minosites | null, mezo: string): string {
  if (!m) throw new XmlKodHianyzik(mezo, 'nincs minősítés');
  const kod = MINOSITES_XML[m];
  if (!kod) throw new XmlKodHianyzik(mezo, m);
  return kod;
}

/** Energiahordozó → XML elemnév; csak a mintában ténylegesen előforduló nevek. */
const FORRAS_XML = {
  halozatiVillamos: 'NetworkElectricity',
  kornyezetiHo: 'EnvironmentalHeat',
  aktivMegujulo: 'ActiveRenewablePrimaryEnergy',
  helybenTermelt: 'LocallyProduced',
  tavolbanTermelt: 'ProducedRemotely',
  passzivMegujulo: 'PassiveRenewablePrimaryEnergy',
  nemMegujulo: 'NonRenewablePrimaryEnergy',
  co2: 'CarbonDioxideEmissions',
  futesiIgeny: 'AnnualHeatingEnergyNeeds',
} as const;

export function feltoltesiXml(e: EpuletEredmeny, a: TanusitasAdatok, geometria: { AN: number; V: number }): string {
  const ind = e.indikatorok;

  // Az XML-ben nem ábrázolható végenergia-hordozók: a mintában csak villamos és környezeti hő szerepel.
  for (const [eh, Q] of Object.entries(ind.vegenergia)) {
    if ((Q ?? 0) > 0 && eh !== 'villamos' && eh !== 'kornyezeti_ho') throw new XmlKodHianyzik('EnergySources', eh);
  }
  for (const cel of ['szellozes', 'hutes', 'vilagitas'] as const) {
    if (ind.celonkent[cel].tot > 0) throw new XmlKodHianyzik('UsageTarget', cel);
  }
  // Exportált (napelemes) energia: a mintában nem szerepel, a kódját az XSD-ből kell átvenni.
  if (ind.celonkent.export.tot !== 0) throw new XmlKodHianyzik('ExportedEnergy', 'napelem');

  // Határoló szerkezetek: követelmény-típusonként, azon belül minősítésenként felülettel súlyozott U és összes felület.
  const csoportok = new Map<string, Map<Minosites, { AU: number; A: number }>>();
  for (const s of e.szerkezetek) {
    if (!s.kovetelmenyKod) continue;
    const k = U_KOVETELMENYEK.find((x) => x.kod === s.kovetelmenyKod);
    if (!k) continue;
    if (!k.xmlKod) throw new XmlKodHianyzik('TypeOfStructure', k.megnevezes);
    const g = csoportok.get(k.kod) ?? new Map();
    const m = s.minosites!;
    const v = g.get(m) ?? { AU: 0, A: 0 };
    v.AU += s.U * s.A; v.A += s.A;
    g.set(m, v);
    csoportok.set(k.kod, g);
  }
  const minositesSorrend: Minosites[] = ['kivalo', 'jo', 'kozepes', 'gyenge', 'rossz'];
  const szerkezetXml = U_KOVETELMENYEK.filter((k) => csoportok.has(k.kod)).map((k) => {
    const g = csoportok.get(k.kod)!;
    const minosegek = minositesSorrend.filter((m) => g.has(m)).map((m) => {
      const v = g.get(m)!;
      return blokk('EnergeticQuality', el('Quality', minositesKod(m, `${k.xmlKod}.Quality`)), el('U', u3(v.AU / v.A)), el('Dimension', t1(v.A)));
    });
    return blokk('BoundaryAndOpeningStructure', el('TypeOfStructure', k.xmlKod!), blokk('EnergeticQualities', ...minosegek));
  });

  const kn = e.kovetelmeny.kozelNulla, jf = e.kovetelmeny.jelentosFelujitas;
  const rf = e.rendszerErtekeles;
  const m = ind.megujulo;
  const f = ind.celonkent.futes, h = ind.celonkent.hmv;
  const AN = ind.AN;

  // Felhasználási célonkénti bontás energiahordozónként (Heating / HotWater).
  const celVeg = (cel: 'futes' | 'hmv', eh: string) => e.rendszerek.filter((r) => r.cel === cel).flatMap((r) => r.tetelek).filter((t) => t.energiahordozo === eh).reduce((s, t) => s + t.Q, 0) / AN;
  const fVill = celVeg('futes', 'villamos'), hVill = celVeg('hmv', 'villamos');
  const fKorny = celVeg('futes', 'kornyezeti_ho'), hKorny = celVeg('hmv', 'kornyezeti_ho');
  const ketCel = (nev: string, fv: number, hv: number) => blokk(nev, ...(fv > 0 ? [el('Heating', k2(fv))] : []), ...(hv > 0 ? [el('HotWater', k2(hv))] : []));

  const x = [
    '<?xml version="1.0"?>\n',
    '<UploadRequest xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
    blokk('Header', el('EnergyClassification', e.besorolas.energetikai), el('Co2Emission', e.besorolas.CO2)),
    blokk('BuildingData',
      el('ClientName', a.megrendelo),
      blokk('BuildingAddress', el('ZipCode', a.epuletCim.iranyitoszam), el('SettlementName', a.epuletCim.telepules), el('StreetName', a.epuletCim.kozterulet), el('StreetType', a.epuletCim.kozteruletJelleg), el('Building', a.epuletCim.epulet), el('Staircase', a.epuletCim.lepcsohaz), el('Floor', a.epuletCim.emelet), el('DoorNumber', a.epuletCim.ajto)),
      el('TopographicalNumber', a.hrsz),
      el('CertIssueReason', a.tanusitasOka),
      el('BuildingPurpose', a.rendeltetes),
      el('YearOfConstruct', a.epitesiEv),
      el('HeritageOrLocalProtection', a.vedett ? (() => { throw new XmlKodHianyzik('HeritageOrLocalProtection', 'védett'); })() : 'NotProtected'),
      el('UsefulFloorArea', k2(geometria.AN)),
      el('ConditionedVolume', k2(geometria.V)),
      el('NumberOfFloors', a.szintekSzama),
      el('BuildingAreaToVolumeRatio', k2(e.aV)),
      el('HasPublicTraffic', a.kozforgalmu),
      el('IsPublicProperty', a.kozTulajdon),
      el('IsFunctionalUnit', a.onalloRendeltetesiEgyseg),
    ),
    blokk('EfficiencyCategories',
      el('BuildingCategory', a.epuletKategoria),
      el('IsMajorRenovationFulfilled', jf.teljesul),
      el('IsZeroEmissionFulfilled', kn.teljesul),
      el('IsSummerHeatProtectionFulfilled', e.nyariHovedelem.megfelel),
      el('RenewableEnergyUsage', k2(m.aktivMegujulo)),
      blokk('CurrentValues',
        blokk('SummariesEnergyRating', el('Value', k2(ind.fajlagos.EnrenFajl)), el('Percentage', Math.round(e.besorolas.energetikaiSzazalek))),
        blokk('Co2', el('Value', k2(ind.fajlagos.ECO2Fajl)), el('Percentage', Math.round(e.besorolas.CO2Szazalek))),
        blokk('HeatLossFactor', el('Value', k2(e.qm))),
      ),
      blokk('MajorRenovationRequirementLevel', blokk('SummariesEnergyRating', el('Value', k2(jf.EnrenMax))), blokk('HeatLossFactor', el('Value', k2(jf.qmMax)))),
      blokk('NearZeroEnergyBuildingRequirementLevel', blokk('SummariesEnergyRating', el('Value', k2(kn.EnrenMax))), blokk('Co2', el('Value', k2(kn.ECO2Max))), blokk('HeatLossFactor', el('Value', k2(kn.qmMax)))),
    ),
    blokk('CertifierDetails',
      el('Name', a.tanusito.nev),
      blokk('Address', el('ZipCode', a.tanusito.cim.iranyitoszam), el('SettlementName', a.tanusito.cim.telepules), el('StreetName', a.tanusito.cim.kozterulet), el('StreetType', a.tanusito.cim.kozteruletJelleg), el('HouseNumber', a.tanusito.cim.hazszam)),
      el('PhoneNumber', a.tanusito.telefon), el('Email', a.tanusito.email), el('EligibilityNumber', a.tanusito.jogosultsag), el('SoftwareAndVersion', a.szoftver),
    ),
    blokk('Validity', el('SiteInspectionDate', a.helysziniSzemle)),
    blokk('BoundaryAndOpeningStructures', ...szerkezetXml),
    blokk('BuildingServicesSystemEnergeticQuality',
      el('HeatingSystem', minositesKod(rf.futes?.minosites ?? null, 'HeatingSystem')),
      el('HotWaterSupplySystem', minositesKod(rf.hmv?.minosites ?? null, 'HotWaterSupplySystem')),
    ),
    blokk('EnergyConsumptionByUse', blokk('CalculatedEnergyUse', blokk('EnergySources',
      ...([
        [FORRAS_XML.halozatiVillamos, m.halozatiVillamos], [FORRAS_XML.kornyezetiHo, m.kornyezetiHo], [FORRAS_XML.aktivMegujulo, m.aktivMegujulo],
        [FORRAS_XML.helybenTermelt, m.helybenTermelt], [FORRAS_XML.tavolbanTermelt, m.tavolbanTermelt], [FORRAS_XML.passzivMegujulo, m.passzivMegujulo],
        [FORRAS_XML.nemMegujulo, ind.fajlagos.EnrenFajl], [FORRAS_XML.co2, ind.fajlagos.ECO2Fajl], [FORRAS_XML.futesiIgeny, e.qFnet],
      ] as const).filter(([, v]) => v > 0).map(([n, v]) => blokk(n, el('CurrentEnergyConsumption', k2(v)))),
    ))),
    blokk('UsingAlternativeEnergy', blokk('AlternativeEnergies', ...a.alternativEnergiak.map((x) => el('AlternativeEnergy', x)))),
    blokk('EnergyConsumptionByUseWithExportEnergy', blokk('UsageTarget', blokk('ByEnergySources',
      ...(fVill + hVill > 0 ? [ketCel('NetworkElectricity', fVill, hVill)] : []),
      ...(fKorny + hKorny > 0 ? [ketCel('EnvironmentalHeat', fKorny, hKorny)] : []),
      ketCel('ActiveRenewablePrimaryEnergy', f.ren / AN, h.ren / AN),
      ...(fKorny + hKorny > 0 ? [ketCel('LocallyProduced', fKorny, hKorny)] : []),
      ketCel('ProducedRemotely', fVill * SULYOZO.villamos.fren, hVill * SULYOZO.villamos.fren),
      ...(m.passzivMegujulo > 0 ? [ketCel('PassiveRenewablePrimaryEnergy', m.passzivMegujulo, 0)] : []),
      ketCel('NonRenewablePrimaryEnergy', f.nren / AN, h.nren / AN),
      ketCel('CarbonDioxideEmissions', f.CO2 / AN, h.CO2 / AN),
    ))),
    blokk('Photos', ...a.fotok.map((p) => blokk('Photo', el('Category', p.kategoria), el('Content', p.jpegBase64)))),
    el('CalculationsPdfFileContent', a.jegyzokonyvPdfBase64),
    '</UploadRequest>',
  ];
  return x.join('');
}
