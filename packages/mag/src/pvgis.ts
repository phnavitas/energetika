/**
 * PVGIS 5.3 (EU JRC) PVcalc válasz feldolgozása – a napelemes termelés részletes módszere (1. függ. 13.2.2:
 * „a termelt energia mennyisége … meghatározható a tervezői gyakorlatban elfogadott szoftverekkel is”).
 * A lekérés eredményét igazolásként változatlanul eltároljuk: bemenő adatok, meteorológiai adatbázis és
 * időszak, havi termelés és havi besugárzás a modulsíkban.
 */
export const PVGIS_FORRAS = 'PVGIS 5.3 (EU JRC), PVcalc – 1. függ. 13.2.2 részletes módszer';

export interface PvgisBemenet {
  lat: number; lon: number; kWp: number;
  /** Rendszerveszteség [%] (PVGIS alapérték 14). */
  veszteseg: number;
  /** Dőlésszög [°] a vízszinteshez. */
  hajlasszog: number;
  /** Azimut [°]: 0 = dél, −90 = kelet, +90 = nyugat (PVGIS „aspect”). */
  azimut: number;
  elhelyezes: 'building' | 'free';
}

export interface PvgisHonap { honap: number; E_m: number; H_m: number; SD_m: number | null }

export interface PvgisEredmeny {
  bemenet: PvgisBemenet;
  lekerve: string;
  url: string;
  hely: { lat: number; lon: number; magassag: number | null };
  meteo: { sugarzasDb: string | null; evTol: number | null; evIg: number | null; horizont: boolean | null };
  modul: { technologia: string | null; kWp: number | null; veszteseg: number | null };
  havi: PvgisHonap[];
  ossz: { E_y: number; H_y: number | null; SD_y: number | null; l_aoi: number | null; l_spec: number | null; l_tg: number | null; l_total: number | null };
}

const n = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : typeof x === 'string' && x.trim() !== '' && Number.isFinite(Number(x)) ? Number(x) : null);
type Obj = Record<string, unknown>;
const o = (x: unknown): Obj => (x && typeof x === 'object' ? x as Obj : {});

/** A PVGIS JSON válaszának ellenőrzése és tárolható alakra hozása. Hibás szerkezetnél kivételt dob. */
export function pvgisFeldolgoz(json: unknown, bemenet: PvgisBemenet, url: string, lekerve = new Date().toISOString()): PvgisEredmeny {
  const j = o(json);
  const be = o(j.inputs), ki = o(j.outputs);
  const haviNyers = o(ki.monthly).fixed;
  const osszNyers = o(o(ki.totals).fixed);
  if (!Array.isArray(haviNyers) || haviNyers.length !== 12) throw new Error('A PVGIS válaszában nincs 12 havi adat (outputs.monthly.fixed).');
  const havi = haviNyers.map((h, i): PvgisHonap => {
    const x = o(h);
    const E = n(x.E_m), H = n(x['H(i)_m']);
    if (E === null || H === null) throw new Error(`A PVGIS válaszából hiányzik a(z) ${i + 1}. hónap termelése vagy besugárzása.`);
    return { honap: n(x.month) ?? i + 1, E_m: E, H_m: H, SD_m: n(x.SD_m) };
  });
  const E_y = n(osszNyers.E_y) ?? havi.reduce((s, h) => s + h.E_m, 0);
  const loc = o(be.location), met = o(be.meteo_data), mod = o(be.pv_module);
  return {
    bemenet, lekerve, url,
    hely: { lat: n(loc.latitude) ?? bemenet.lat, lon: n(loc.longitude) ?? bemenet.lon, magassag: n(loc.elevation) },
    meteo: { sugarzasDb: typeof met.radiation_db === 'string' ? met.radiation_db : null, evTol: n(met.year_min), evIg: n(met.year_max), horizont: typeof met.use_horizon === 'boolean' ? met.use_horizon : null },
    modul: { technologia: typeof mod.technology === 'string' ? mod.technology : null, kWp: n(mod.peak_power), veszteseg: n(mod.system_loss) },
    havi,
    ossz: { E_y, H_y: n(osszNyers['H(i)_y']), SD_y: n(osszNyers.SD_y), l_aoi: n(osszNyers.l_aoi), l_spec: n(osszNyers.l_spec), l_tg: n(osszNyers.l_tg), l_total: n(osszNyers.l_total) },
  };
}

/** Érvényes-e még a tárolt lekérés a jelenlegi bemenetekre (koordináta 0,001°, egyéb értékek pontosan). */
export function pvgisErvenyes(e: PvgisEredmeny | undefined, b: PvgisBemenet): boolean {
  if (!e) return false;
  const a = e.bemenet;
  return Math.abs(a.lat - b.lat) < 1e-3 && Math.abs(a.lon - b.lon) < 1e-3 && a.kWp === b.kWp && a.veszteseg === b.veszteseg
    && a.hajlasszog === b.hajlasszog && a.azimut === b.azimut && a.elhelyezes === b.elhelyezes;
}

/** Tájolás azimutból a 13.1. táblázat oszlopához (összevetéshez). */
export function tablaTajolas(azimut: number): 'D' | 'DK_DNy' | 'K_Ny' | null {
  const a = Math.abs(azimut);
  if (a <= 22.5) return 'D';
  if (a <= 67.5) return 'DK_DNy';
  if (a <= 112.5) return 'K_Ny';
  return null;
}

/** A PVGIS weboldaláról letöltött JSON-fájl bemenő adatai (a lekérés paraméterei a fájlból). */
export function pvgisBemenetFajlbol(json: unknown): PvgisBemenet {
  const be = o(o(json).inputs);
  const loc = o(be.location), ms = o(o(be.mounting_system).fixed), mod = o(be.pv_module);
  const lat = n(loc.latitude), lon = n(loc.longitude), kWp = n(mod.peak_power), veszteseg = n(mod.system_loss);
  const hajlasszog = n(o(ms.slope).value), azimut = n(o(ms.azimuth).value);
  if (lat === null || lon === null || kWp === null || veszteseg === null || hajlasszog === null || azimut === null) {
    throw new Error('A fájl nem PVGIS „Grid connected” (PVcalc) JSON-eredmény, vagy hiányoznak belőle a bemenő adatok.');
  }
  const tipus = typeof ms.type === 'string' ? ms.type : '';
  return { lat, lon, kWp, veszteseg, hajlasszog, azimut, elhelyezes: /free/i.test(tipus) ? 'free' : 'building' };
}
