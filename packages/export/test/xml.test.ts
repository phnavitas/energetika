/**
 * Az XML generátor tesztje a tarjáni WinWatt-exporthoz képest: azonos elemsorrend és azonos számértékek.
 * A személyes adatokat helyőrzők helyettesítik; a mintafájlból csak a tagnevek sorrendje van a repóban.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { epuletSzamitas } from '../../mag/src/index.js';
import { epulet, WW_QS } from '../../mag/test/tarjan-modell.js';
import { feltoltesiXml, XmlKodHianyzik, type TanusitasAdatok } from '../src/xml.js';

const minta = JSON.parse(readFileSync(new URL('./minta-szerkezet.json', import.meta.url), 'utf-8')) as { utvonalak: string[] };

function utvonalak(xml: string): string[] {
  const ki: string[] = [];
  const verem: string[] = [];
  for (const m of xml.matchAll(/<(\/?)([A-Za-z0-9]+)[^>]*>/g)) {
    if (m[0].startsWith('<?')) continue;
    if (m[1] === '/') verem.pop();
    else { verem.push(m[2]!); ki.push('/' + verem.join('/')); }
  }
  return ki;
}
function ertek(xml: string, ut: string): string | undefined {
  // az első egyező útvonal szöveges tartalma
  const verem: string[] = [];
  let utolsoNyito = -1;
  for (const m of xml.matchAll(/<(\/?)([A-Za-z0-9]+)[^>]*>/g)) {
    if (m[1] === '/') {
      if ('/' + verem.join('/') === ut && utolsoNyito >= 0) return xml.slice(utolsoNyito, m.index);
      verem.pop();
    } else { verem.push(m[2]!); utolsoNyito = m.index! + m[0].length; }
  }
  return undefined;
}

const adatok: TanusitasAdatok = {
  megrendelo: 'Megrendelő Kft',
  epuletCim: { iranyitoszam: '0000', telepules: 'Település', kozterulet: 'Minta', kozteruletJelleg: 'utca', epulet: '-', lepcsohaz: '-', emelet: '-', ajto: '1' },
  hrsz: '0000', tanusitasOka: 'Other', rendeltetes: 'ResidentialBuilding', epuletKategoria: 'SingleFamilyDetachedHome',
  epitesiEv: 2026, vedett: false, szintekSzama: 1, kozforgalmu: false, kozTulajdon: false, onalloRendeltetesiEgyseg: false,
  tanusito: { nev: 'Tanúsító', cim: { iranyitoszam: '0000', telepules: 'Település', kozterulet: 'Minta', kozteruletJelleg: 'utca', hazszam: '1.' }, telefon: '+36000000000', email: 'tanusito@example.hu', jogosultsag: 'TÉ 00-0000' },
  szoftver: 'EKM számítómag 0.1', helysziniSzemle: '2026-05-22',
  fotok: (['CoverPhoto', 'Facade', 'CharacteristicOpeningStructure', 'HeatGeneratorAndHeatStorageSituation', 'CharacteristicHeatExchanger'] as const).map((k) => ({ kategoria: k, jpegBase64: '/9j/' })),
  jegyzokonyvPdfBase64: 'JVBERi0xLjQK', alternativEnergiak: ['HeatPump'],
};

describe('e-tanúsítás XML (UploadRequest)', () => {
  const e = epuletSzamitas(epulet, { QsdFelulbiralas: { F1: WW_QS } });
  const xml = feltoltesiXml(e, adatok, { AN: 100.5, V: 267.33 });

  it('az elemsorrend megegyezik az elfogadott WinWatt-exporttal', () => {
    expect(utvonalak(xml)).toEqual(minta.utvonalak);
  });

  it('a számértékek a WinWatt-export értékeivel egyeznek', () => {
    const v = (u: string) => ertek(xml, '/UploadRequest' + u);
    expect(v('/Header/EnergyClassification')).toBe('A+');
    expect(v('/Header/Co2Emission')).toBe('A+');
    expect(v('/BuildingData/UsefulFloorArea')).toBe('100.50');
    expect(v('/BuildingData/BuildingAreaToVolumeRatio')).toBe('1.13');
    expect(v('/EfficiencyCategories/RenewableEnergyUsage')).toBe('62.71'); // WinWatt: 62.70 (kerekítés)
    expect(v('/EfficiencyCategories/CurrentValues/SummariesEnergyRating/Value')).toBe('51.04');
    expect(v('/EfficiencyCategories/CurrentValues/SummariesEnergyRating/Percentage')).toBe('67');
    expect(v('/EfficiencyCategories/CurrentValues/Co2/Value')).toBe('11.61');
    expect(v('/EfficiencyCategories/CurrentValues/HeatLossFactor/Value')).toBe('0.14');
    expect(v('/EfficiencyCategories/MajorRenovationRequirementLevel/SummariesEnergyRating/Value')).toBe('143.08');
    expect(v('/EfficiencyCategories/MajorRenovationRequirementLevel/HeatLossFactor/Value')).toBe('0.46');
    expect(v('/EfficiencyCategories/NearZeroEnergyBuildingRequirementLevel/HeatLossFactor/Value')).toBe('0.33');
    expect(v('/BuildingServicesSystemEnergeticQuality/HeatingSystem')).toBe('Excellent');
    expect(v('/EnergyConsumptionByUse/CalculatedEnergyUse/EnergySources/NetworkElectricity/CurrentEnergyConsumption')).toBe('22.19');
    expect(v('/EnergyConsumptionByUse/CalculatedEnergyUse/EnergySources/AnnualHeatingEnergyNeeds/CurrentEnergyConsumption')).toBe('40.07');
    expect(v('/EnergyConsumptionByUseWithExportEnergy/UsageTarget/ByEnergySources/NetworkElectricity/Heating')).toBe('13.82');
    expect(v('/EnergyConsumptionByUseWithExportEnergy/UsageTarget/ByEnergySources/NetworkElectricity/HotWater')).toBe('8.37');
    expect(v('/EnergyConsumptionByUseWithExportEnergy/UsageTarget/ByEnergySources/NonRenewablePrimaryEnergy/Heating')).toBe('31.79');
    expect(v('/EnergyConsumptionByUseWithExportEnergy/UsageTarget/ByEnergySources/CarbonDioxideEmissions/HotWater')).toBe('4.49');
  });

  it('a határoló szerkezetek csoportosítása: ablak Excellent 0.737 / 12.1 m², Good 0.862 / 13.8 m²', () => {
    const blokkok = [...xml.matchAll(/<EnergeticQuality><Quality>(\w+)<\/Quality><U>([\d.]+)<\/U><Dimension>([\d.]+)<\/Dimension>/g)].map((m) => m.slice(1).join(' '));
    expect(blokkok).toEqual(['Good 0.229 72.0', 'Good 0.15 100.5', 'Excellent 0.737 12.1', 'Good 0.862 13.8', 'Good 1.4 2.4', 'Excellent 0.157 100.5']);
  });

  it('ismeretlen XML-kódnál hibát dob, nem talál ki értéket (pl. földgáz)', () => {
    const gazos = { ...epulet, futes: [{ ...epulet.futes[0]!, hotermelo: { tipus: 'kazan_tabla' as const, kazan: 'kondenzacios' as const, hely: 'belul' as const, energiahordozo: 'fosszilis_gaz' as const } }] };
    const e2 = epuletSzamitas(gazos, { QsdFelulbiralas: { F1: WW_QS } });
    expect(() => feltoltesiXml(e2, adatok, { AN: 100.5, V: 267.33 })).toThrow(XmlKodHianyzik);
  });
});
