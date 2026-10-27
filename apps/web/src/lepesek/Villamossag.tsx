/**
 * Villamosság: beépített világítás (9/2023 ÉKM 1. függ. 12.1, lakóépületnél tájékoztató – az energiamérlegbe nem számítható be),
 * napelemek (13.2), egyéb villamos fogyasztók tételesen, és az éves villamos mérleg (tájékoztató önellátási arány).
 */
import { profilok, type EpuletEredmeny } from '@mag/index';
import { Mezo, Szam, Szoveg, Valaszto, sz } from '../ui';
import { ujId, type Projekt, type VillamosUI, type VillamosFogyaszto } from '../modell';
import { NapelemSzakasz } from './Napelem';

type Modosit = (fn: (p: Projekt) => void) => void;

/** 12.1. táblázat – fényhasznosítás [lm/W]. */
export const FENYFORRAS = [
  { kod: 'izzo', nev: 'Normál izzólámpa', FH: 15 }, { kod: 'halogen', nev: 'Halogén izzólámpa', FH: 20 }, { kod: 'fenycso', nev: 'Fénycső', FH: 75 },
  { kod: 'kompakt', nev: 'Kompakt fénycső', FH: 70 }, { kod: 'higany', nev: 'Higanylámpa', FH: 50 }, { kod: 'femhalogen', nev: 'Fémhalogén lámpa', FH: 87 }, { kod: 'led', nev: 'LED', FH: 120 },
] as const;
/** 12.2. táblázat – fényforrás (lámpatest) hatásfoka. */
export const LAMPATEST = [{ kod: 'parabola', nev: 'Üvegburás, parabolatükrös', eta: 0.5 }, { kod: 'opal', nev: 'Opál burás', eta: 0.3 }, { kod: 'led', nev: 'LED (minden változat)', eta: 0.5 }] as const;
/** 12.3. táblázat – a fényerő szabályozhatósága. */
export const FFE = [{ kod: 'nem', nev: 'Nem dimmelhető', Ffe: 1 }, { kod: 'halogen', nev: 'Dimmelhető halogén', Ffe: 0.9 }, { kod: 'fenycso', nev: 'Dimmelhető fénycső', Ffe: 0.8 }, { kod: 'led', nev: 'Dimmelhető LED', Ffe: 0.7 }] as const;
/** 12.7. táblázat – a természetes megvilágítás szerepe a homlokzati üvegezési arány szerint. */
export const fnappal = (arany: number | null) => (arany === null || arany <= 0 ? 1 : arany > 0.8 ? 0.35 : arany >= 0.4 ? 0.45 : 0.55);

/** Tipikus háztartási fogyasztók – tervezői becslés (átlagos teljesítményfelvétel × üzemidő), termékadattal pontosítandó. */
export const FOGYASZTO_MINTAK: Omit<VillamosFogyaszto, 'id'>[] = [
  { nev: 'Hűtő-fagyasztó (átlagos felvétel)', kategoria: 'háztartási gép', teljesitmenyW: 20, oraNap: 24, napEv: 365, darab: 1 },
  { nev: 'Mosógép (60 °C-os program)', kategoria: 'háztartási gép', teljesitmenyW: 1000, oraNap: 1, napEv: 200, darab: 1 },
  { nev: 'Mosogatógép', kategoria: 'háztartási gép', teljesitmenyW: 1000, oraNap: 1, napEv: 250, darab: 1 },
  { nev: 'Hőszivattyús szárítógép', kategoria: 'háztartási gép', teljesitmenyW: 700, oraNap: 1.5, napEv: 100, darab: 1 },
  { nev: 'Indukciós főzőlap', kategoria: 'főzés', teljesitmenyW: 1500, oraNap: 1, napEv: 365, darab: 1 },
  { nev: 'Elektromos sütő', kategoria: 'főzés', teljesitmenyW: 2000, oraNap: 0.5, napEv: 150, darab: 1 },
  { nev: 'Televízió', kategoria: 'szórakoztatás, IT', teljesitmenyW: 100, oraNap: 4, napEv: 365, darab: 1 },
  { nev: 'Számítógép, laptop', kategoria: 'szórakoztatás, IT', teljesitmenyW: 60, oraNap: 4, napEv: 365, darab: 1 },
  { nev: 'Router, készenléti fogyasztás', kategoria: 'szórakoztatás, IT', teljesitmenyW: 10, oraNap: 24, napEv: 365, darab: 1 },
  { nev: 'Elektromos autó töltése (7,4 kW)', kategoria: 'e-mobilitás', teljesitmenyW: 7400, oraNap: 1.5, napEv: 200, darab: 1 },
  { nev: 'Kerti világítás, kapunyitó', kategoria: 'kültér', teljesitmenyW: 60, oraNap: 4, napEv: 365, darab: 1 },
];

export const fogyasztoKWh = (f: VillamosFogyaszto) => (f.teljesitmenyW * f.oraNap * f.napEv * f.darab) / 1000;

/** Homlokzati üvegezési arány: függőleges külső nyílászárók / homlokzati falak bruttó felülete. */
export function uvegezesiArany(p: Projekt): number | null {
  const falak = p.feluletek.filter((f) => f.fajta === 'opak' && f.hatar === 'kulso' && (f.hajlasszog ?? 90) === 90 && p.retegrendek.find((r) => r.id === f.retegrendId)?.szerep === 'fal');
  const Afal = falak.reduce((a, f) => a + (f.A ?? 0), 0);
  if (Afal <= 0) return null;
  const Any = p.feluletek.filter((f) => f.fajta === 'nyilaszaro' && f.hatar === 'kulso' && (f.hajlasszog ?? 90) === 90).reduce((a, f) => { const n = p.nyilaszarok.find((x) => x.id === f.nyilaszaroId); return a + (n ? n.szelesseg * n.magassag * (f.darab ?? 1) : 0); }, 0);
  return Any / Afal;
}

export interface VilagitasBeallitas { fenyforras: string; lampatest: string; ffe: string; MV: number; tNappal: number; tEjjel: number; standby: boolean }
const VIL_ALAP: VilagitasBeallitas = { fenyforras: 'led', lampatest: 'led', ffe: 'nem', MV: 100, tNappal: 300, tEjjel: 1000, standby: false };

/** 12.1–12.2: WV = (Ffe · P · Fszab · (tnappal · Fnappal + téjjel) / 1000 + wvész + wstandby) · A; lakóépületnél Fszab = 1 (Fkihaszn = 0). */
export function vilagitasKWh(b: VilagitasBeallitas, A: number, Fnappal: number) {
  const FH = FENYFORRAS.find((x) => x.kod === b.fenyforras)?.FH ?? 120;
  const eta = LAMPATEST.find((x) => x.kod === b.lampatest)?.eta ?? 0.5;
  const Ffe = FFE.find((x) => x.kod === b.ffe)?.Ffe ?? 1;
  const P = b.MV / (FH * eta);
  const W = (Ffe * P * 1 * (b.tNappal * Fnappal + b.tEjjel) / 1000 + (b.standby ? 1.5 : 0)) * A;
  return { P, W };
}

export function VillamossagLepes({ p, modosit, eredmeny }: { p: Projekt; modosit: Modosit; eredmeny: EpuletEredmeny | null }) {
  const v: VillamosUI = p.gepeszet.villamos ?? { fogyasztok: [] };
  const vil = { ...VIL_ALAP, ...((v as { vilagitasBeall?: Partial<VilagitasBeallitas> }).vilagitasBeall ?? {}) };
  const mv = (fn: (x: VillamosUI & { vilagitasBeall?: Partial<VilagitasBeallitas> }) => void) => modosit((q) => { q.gepeszet.villamos ??= { fogyasztok: [] }; fn(q.gepeszet.villamos); });
  const mvil = (fn: (b: VilagitasBeallitas) => void) => mv((x) => { const b = { ...VIL_ALAP, ...(x.vilagitasBeall ?? {}) }; fn(b); x.vilagitasBeall = b; });
  const AN = eredmeny?.indikatorok.AN ?? p.helyisegek.reduce((a, h) => a + h.A, 0);
  const arany = uvegezesiArany(p);
  const Fn = fnappal(arany);
  const egyeb = p.meta.rendeltetes === 'egyeb';
  const pr = egyeb ? profilok.profil(p.meta.profil) ?? profilok.PROFILOK[1]! : null;
  const vilR = eredmeny?.rendszerek.find((r) => r.cel === 'vilagitas');
  const vk = egyeb ? { P: vilR?.reszletek.P ?? 0, W: vilR?.reszletek.W ?? 0 } : vilagitasKWh(vil, AN, Fn);
  const vb = p.gepeszet.villamos?.vilagitasBeall ?? {};
  const mvb = (fn: (b: NonNullable<VillamosUI['vilagitasBeall']>) => void) => mv((x) => { x.vilagitasBeall ??= {}; fn(x.vilagitasBeall); });
  const fogy = v.fogyasztok.reduce((a, f) => a + fogyasztoKWh(f), 0);
  const gepeszetW = (eredmeny?.indikatorok.vegenergia.villamos ?? 0) - (egyeb ? vk.W : 0);
  const pv = eredmeny?.napelem.reduce((a, n) => a + n.W, 0) ?? 0;
  const ossz = gepeszetW + vk.W + fogy;
  const ff = (id: string, fn: (f: VillamosFogyaszto) => void) => mv((x) => { const f = x.fogyasztok.find((y) => y.id === id); if (f) fn(f); });

  return (
    <>
      <section class="szakasz">
        <h2>Beépített világítás {egyeb && pr ? <span class="jel jo" style="font-size:14px;margin-left:8px">beszámít az Ep-be</span> : <span class="jel rossz" style="font-size:14px;margin-left:8px">lakóépületnél nem számít bele</span>}</h2>
        {egyeb && pr ? (<>
        <p class="halk">Egyéb rendeltetésnél a beépített világítás energiafelhasználása <strong>beszámít</strong> az összesített energetikai jellemzőbe (1. függ. 12.1, egyszerűsített módszer). A referenciaépületben nem dimmelhető LED, parabolatükrös lámpatest és kézi kapcsolás szerepel (5. melléklet).</p>
        <div class="racs">
          <Mezo cim="Fényforrás" sugo="12.1. táblázat"><Valaszto ertek={vb.fenyforras ?? 'led'} valt={(x) => mvb((b) => { b.fenyforras = x; })} opciok={FENYFORRAS.map((x) => ({ ertek: x.kod, nev: `${x.nev} (${x.FH} lm/W)` }))} /></Mezo>
          <Mezo cim="Lámpatest" sugo="12.2. táblázat"><Valaszto ertek={vb.lampatest ?? 'led'} valt={(x) => mvb((b) => { b.lampatest = x; })} opciok={LAMPATEST.map((x) => ({ ertek: x.kod, nev: `${x.nev} (η = ${String(x.eta).replace('.', ',')})` }))} /></Mezo>
          <Mezo cim="Fényerő-szabályozhatóság" sugo="12.3. táblázat"><Valaszto ertek={vb.ffe ?? 'nem'} valt={(x) => mvb((b) => { b.ffe = x; })} opciok={FFE.map((x) => ({ ertek: x.kod, nev: `${x.nev} (Ffe = ${String(x.Ffe).replace('.', ',')})` }))} /></Mezo>
          <Mezo cim="Kapcsolás, szabályozás" sugo="12.5. táblázat"><Valaszto ertek={vb.szabalyozas ?? 'kezi'} valt={(x) => mvb((b) => { b.szabalyozas = x as profilok.FszabKod; })} opciok={Object.entries(profilok.FSZAB).map(([k, x]) => ({ ertek: k, nev: x.nev }))} /></Mezo>
          <Mezo cim="Üzemórák – épülettípus" sugo="12.6. táblázat"><Valaszto ertek={vb.vilTipus ?? pr.vilTipus} valt={(x) => mvb((b) => { b.vilTipus = x as profilok.VilagitasTipus; })} opciok={Object.entries(profilok.UZEMORA).map(([k, x]) => ({ ertek: k, nev: `${x.nev} (${x.tnappal} + ${x.tejjel} h/év)` }))} /></Mezo>
          <Mezo cim="Kihasználtsági mutató" sugo="12.4. táblázat"><Valaszto ertek={vb.kihaszn ?? pr.kihaszn} valt={(x) => mvb((b) => { b.kihaszn = x as profilok.KihasznTipus; })} opciok={Object.entries(profilok.FKIHASZN).map(([k, x]) => ({ ertek: k, nev: `${x.nev} (${String(x.F).replace('.', ',')})` }))} /></Mezo>
          <div class="mezo"><span>Megvilágítás MV</span><small>{pr.MV} lx – {pr.nev} (2. függ. 2.1.)</small></div>
          <div class="mezo"><span>Vész- és készenléti fogyasztás</span>
            <label><input type="checkbox" checked={!!vb.vesz} onChange={(e) => mvb((b) => { b.vesz = (e.target as HTMLInputElement).checked; })} /> vészvilágítás (1 kWh/m²év)</label>
            <label><input type="checkbox" checked={!!vb.standby} onChange={(e) => mvb((b) => { b.standby = (e.target as HTMLInputElement).checked; })} /> vezérlés stand-by (1,5 kWh/m²év)</label>
          </div>
        </div>
        <table class="tabla" style="max-width:640px;margin-top:12px"><tbody>
          <tr><td>Homlokzati üvegezési arány → Fnappal (12.7)</td><td class="szam">{arany === null ? '–' : `${sz(arany * 100, 0)}%`} → {sz(Fn, 2)}</td></tr>
          <tr><td>Fajlagos névleges teljesítmény P = MV / (FH · η) (12.2)</td><td class="szam">{sz(vk.P, 2)} W/m²</td></tr>
          <tr><td>Szabályozási tényező Fszab (12.5)</td><td class="szam">{sz(vilR?.reszletek.Fszab ?? 0, 3)}</td></tr>
          <tr><td><strong>Világítás éves villamosenergia-igénye (12.1) – beszámít</strong></td><td class="szam"><strong>{eredmeny ? `${sz(vk.W, 0)} kWh/év` : 'számítás után'}</strong></td></tr>
        </tbody></table>
        </>) : (<>
        <div class="hiba-doboz" style="margin-bottom:10px;font-size:15px"><strong>Lakóépületnél a beépített világítás NEM számít bele az energetikai számításba</strong> – sem az összesített energetikai jellemzőbe (Ep), sem a CO₂-kibocsátásba, sem a besorolásba (9/2023 ÉKM 1. függelék 12. fejezet). Az itt megadott adatok csak tájékoztatók.</div>
        <p class="halk">Az alábbi számítás a rendelet 12.1 egyszerűsített módszerével készül, tájékoztatásul – a villamos mérleghez és a napelem méretezéséhez. Lakóépületre a rendelet nem ad megvilágítási és üzemóra-értéket (2.1., 12.6. táblázat), ezek tervezői feltételezések.</p>
        <div class="racs">
          <Mezo cim="Fényforrás" sugo="12.1. táblázat"><Valaszto ertek={vil.fenyforras} valt={(x) => mvil((b) => { b.fenyforras = x; })} opciok={FENYFORRAS.map((x) => ({ ertek: x.kod, nev: `${x.nev} (${x.FH} lm/W)` }))} /></Mezo>
          <Mezo cim="Lámpatest" sugo="12.2. táblázat"><Valaszto ertek={vil.lampatest} valt={(x) => mvil((b) => { b.lampatest = x; })} opciok={LAMPATEST.map((x) => ({ ertek: x.kod, nev: `${x.nev} (η = ${String(x.eta).replace('.', ',')})` }))} /></Mezo>
          <Mezo cim="Szabályozhatóság" sugo="12.3. táblázat"><Valaszto ertek={vil.ffe} valt={(x) => mvil((b) => { b.ffe = x; })} opciok={FFE.map((x) => ({ ertek: x.kod, nev: `${x.nev} (Ffe = ${String(x.Ffe).replace('.', ',')})` }))} /></Mezo>
          <Mezo cim="Megvilágítás MV" sugo="Lakóépületre a 2.1. táblázat nem ad értéket (feltételezés)"><Szam ertek={vil.MV} egyseg="lx" valt={(x) => mvil((b) => { b.MV = Math.max(0, x); })} /></Mezo>
          <Mezo cim="Nappali üzemóra" sugo="Feltételezés"><Szam ertek={vil.tNappal} egyseg="h/év" valt={(x) => mvil((b) => { b.tNappal = Math.max(0, x); })} /></Mezo>
          <Mezo cim="Éjszakai üzemóra" sugo="Feltételezés"><Szam ertek={vil.tEjjel} egyseg="h/év" valt={(x) => mvil((b) => { b.tEjjel = Math.max(0, x); })} /></Mezo>
          <div class="mezo"><span>Készenléti fogyasztás</span><label><input type="checkbox" checked={vil.standby} onChange={(e) => mvil((b) => { b.standby = (e.target as HTMLInputElement).checked; })} /> vezérlés stand-by (1,5 kWh/m²év)</label></div>
        </div>
        <table class="tabla" style="max-width:640px;margin-top:12px"><tbody>
          <tr><td>Homlokzati üvegezési arány → Fnappal (12.7)</td><td class="szam">{arany === null ? '–' : `${sz(arany * 100, 0)}%`} → {sz(Fn, 2)}</td></tr>
          <tr><td>Fajlagos névleges teljesítmény P = MV / (FH · η) (12.2)</td><td class="szam">{sz(vk.P, 2)} W/m²</td></tr>
          <tr><td>Nettó alapterület</td><td class="szam">{sz(AN, 1)} m²</td></tr>
          <tr><td><strong>Világítás éves villamosenergia-igénye (12.1, tájékoztató)</strong></td><td class="szam"><strong>{sz(vk.W, 0)} kWh/év</strong></td></tr>
        </tbody></table>
        </>)}
      </section>

      <NapelemSzakasz p={p} modosit={modosit} eredmeny={eredmeny} />

      <section class="szakasz">
        <h2>Egyéb villamos fogyasztók</h2>
        <p class="halk">A rendelet által nem szabályozott fogyasztók (háztartási gépek, főzés, IT, e-mobilitás, kültér). A tanúsítvány indikátoraiba nem számítanak be; a villamos mérleghez és a napelemes önellátás becsléséhez valók. A mintaértékek tipikus becslések – termékadattal pontosítsd.</p>
        {v.fogyasztok.length > 0 && (
          <div class="tabla-gorgeto"><table class="tabla">
            <thead><tr><th>Megnevezés</th><th>Kategória</th><th class="szam">Teljesítmény</th><th class="szam">Üzemidő</th><th class="szam">Nap / év</th><th class="szam">Db</th><th class="szam">Éves</th><th></th></tr></thead>
            <tbody>{v.fogyasztok.map((f) => (
              <tr>
                <td style="min-width:200px"><Szoveg ertek={f.nev} valt={(x) => ff(f.id, (y) => { y.nev = x; })} /></td>
                <td style="min-width:130px"><Szoveg ertek={f.kategoria} valt={(x) => ff(f.id, (y) => { y.kategoria = x; })} /></td>
                <td style="width:110px"><Szam cimke="Teljesítmény" ertek={f.teljesitmenyW} egyseg="W" valt={(x) => ff(f.id, (y) => { y.teljesitmenyW = Math.max(0, x); })} /></td>
                <td style="width:110px"><Szam cimke="Üzemidő" ertek={f.oraNap} egyseg="h/nap" valt={(x) => ff(f.id, (y) => { y.oraNap = Math.min(24, Math.max(0, x)); })} /></td>
                <td style="width:80px"><Szam cimke="Nap per év" ertek={f.napEv} valt={(x) => ff(f.id, (y) => { y.napEv = Math.min(366, Math.max(0, Math.round(x))); })} /></td>
                <td style="width:64px"><Szam cimke="Darab" ertek={f.darab} valt={(x) => ff(f.id, (y) => { y.darab = Math.max(0, Math.round(x)); })} /></td>
                <td class="szam">{sz(fogyasztoKWh(f), 0)} kWh</td>
                <td><button class="gomb halk-gomb" onClick={() => mv((x) => { x.fogyasztok = x.fogyasztok.filter((y) => y.id !== f.id); })}>Törlés</button></td>
              </tr>
            ))}</tbody>
            <tfoot><tr><td colSpan={6}>Összesen</td><td class="szam">{sz(fogy, 0)} kWh/év</td><td /></tr></tfoot>
          </table></div>
        )}
        <div class="gombsor" style="margin-top:10px">
          <select value="" aria-label="Fogyasztó hozzáadása mintából" onChange={(e) => { const i = Number((e.target as HTMLSelectElement).value); const m = FOGYASZTO_MINTAK[i]; if (m) mv((x) => { x.fogyasztok.push({ ...m, id: ujId() }); }); }}>
            <option value="">Fogyasztó hozzáadása mintából…</option>
            {FOGYASZTO_MINTAK.map((m, i) => <option value={String(i)}>{m.nev} (~{sz(fogyasztoKWh({ ...m, id: '' }), 0)} kWh/év)</option>)}
          </select>
          <button class="gomb" onClick={() => mv((x) => { x.fogyasztok.push({ id: ujId(), nev: 'Fogyasztó', kategoria: 'egyéb', teljesitmenyW: 100, oraNap: 1, napEv: 365, darab: 1 }); })}>Üres sor</button>
          <button class="gomb halk-gomb semleges" disabled={v.fogyasztok.length > 0} onClick={() => mv((x) => { x.fogyasztok.push(...FOGYASZTO_MINTAK.slice(0, 9).map((m) => ({ ...m, id: ujId() }))); })}>Tipikus háztartás betöltése</button>
        </div>
      </section>

      <section class="szakasz">
        <h2>Éves villamos mérleg (tájékoztató)</h2>
        <table class="tabla" style="max-width:640px"><tbody>
          <tr><td>Épületgépészet (fűtés, HMV, szellőzés, hűtés, segédenergia) – a tanúsítvány része</td><td class="szam">{sz(gepeszetW, 0)} kWh/év</td></tr>
          <tr><td>Beépített világítás (12.1{egyeb ? ', a tanúsítvány része' : ', tájékoztató'})</td><td class="szam">{sz(vk.W, 0)} kWh/év</td></tr>
          <tr><td>Egyéb fogyasztók</td><td class="szam">{sz(fogy, 0)} kWh/év</td></tr>
          <tr><td><strong>Villamosenergia-igény összesen</strong></td><td class="szam"><strong>{sz(ossz, 0)} kWh/év</strong></td></tr>
          <tr><td>Napelemes termelés (13.2)</td><td class="szam">{sz(pv, 0)} kWh/év</td></tr>
          <tr><td>Termelés / igény</td><td class="szam">{ossz > 0 ? `${sz((pv / ossz) * 100, 0)}%` : '–'}</td></tr>
        </tbody></table>
        <p class="halkabb" style="margin-top:6px">Egyszerűsített módszernél a napelemes termelés teljes egészében exportáltként számolódik el (1. függ. 13.1), az épület villamosenergia-igénye hálózatról vételezett. Az arány az éves összegek viszonya, nem az egyidejű önfogyasztás.</p>
      </section>
    </>
  );
}
