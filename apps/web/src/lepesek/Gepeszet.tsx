import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { GEPESZETI_SZETTEK, gepeszet as T, szabalyozasiTenyezo, type EpuletEredmeny, type FutesiHotermelo, type HmvHotermelo, type RendszerEredmeny } from '@mag/index';
import { Mezo, Szam, Szoveg, Valaszto, sz } from '../ui';
import {
  ujId, futesSzettbol, hmvSzettbol, erpFutes, erpHmv, szabalyozasErtek,
  type Projekt, type Gepeszet, type FutesAlrendszerUI, type HmvUI, type SzellozesUI,
} from '../modell';
import * as C from '../gepeszetCimkek';
import { useTavoli } from '../fiok';
import { szettMent } from '../tarolo';

type Modosit = (fn: (p: Projekt) => void) => void;
type SzabValasztas = Parameters<typeof szabalyozasiTenyezo>[0];
// A hőtermelő-változatok mezőit típusonként szerkesztjük; a változat a `tipus` mezőből következik.
type Barmely = any; // eslint-disable-line @typescript-eslint/no-explicit-any

const szazalek = (x: number | undefined) => (x === undefined ? undefined : Math.round(x * 1000) / 10);

/** Számmező százalékban (a modell 0..1 közötti arányt tárol). */
function Szazalek({ ertek, valt, cimke }: { ertek: number | undefined; valt: (v: number) => void; cimke?: string }) {
  return <Szam cimke={cimke} ertek={szazalek(ertek)} egyseg="%" valt={(v) => valt(v / 100)} />;
}

function Csoport({ cim, children }: { cim: string; children: ComponentChildren }) {
  return (
    <fieldset class="gep-csoport">
      <legend>{cim}</legend>
      <div class="gep-mezok">{children}</div>
    </fieldset>
  );
}

function Eredmenysor({ r, kulcsok }: { r: RendszerEredmeny | undefined; kulcsok: [string, string, number, string][] }) {
  if (!r) return null;
  return (
    <dl class="gep-eredmeny">
      {kulcsok.map(([k, nev, tized, egys]) => r.reszletek[k] !== undefined && (
        <div><dt>{nev}</dt><dd>{sz(r.reszletek[k], tized)}{egys && <span> {egys}</span>}</dd></div>
      ))}
      {r.tetelek.map((t) => <div><dt>{t.megnevezes.replace(/^(Fűtés|HMV|Szellőzés) – /, '')}</dt><dd>{sz(t.Q, 0)}<span> kWh/a</span></dd></div>)}
    </dl>
  );
}

// =============================================================================================

export function GepeszetLepes({ p, modosit, eredmeny }: { p: Projekt; modosit: Modosit; eredmeny: EpuletEredmeny | null }) {
  const gp = p.gepeszet;
  const tv = useTavoli();
  const [kerdes, setKerdes] = useState<{ cim: string; uj: Gepeszet; megtartva: Gepeszet } | null>(null);
  const [szettNyitva, setSzettNyitva] = useState(false);
  const mg = (fn: (g: Gepeszet) => void) => modosit((q) => fn(q.gepeszet));

  const futesEredm = eredmeny?.rendszerek.filter((r) => r.cel === 'futes') ?? [];
  const hmvEredm = eredmeny?.rendszerek.find((r) => r.cel === 'hmv');
  const szellEredm = eredmeny?.rendszerek.find((r) => r.cel === 'szellozes');
  const Vfutott = p.helyisegek.filter((h) => h.kategoria !== 'gyengen_kapcsolt').reduce((s, h) => s + h.A * h.h, 0);

  /** Szett alkalmazása; ha a mostani rendszerben ErP adatlapos érték van, és az új szettbe átvihető, rákérdez. */
  function szettAlkalmaz(cim: string, uj: Gepeszet) {
    const megtartva = structuredClone(uj);
    let atviheto = false;
    const f0 = gp.futes[0]?.hotermelo, h0 = gp.hmv.hotermelo;
    if (f0 && (f0.tipus === 'kazan_erp' || f0.tipus === 'hoszivattyu_erp') && megtartva.futes[0]) {
      const cel = erpFutes(megtartva.futes[0].hotermelo, f0.etaS);
      if (cel.tipus === f0.tipus && JSON.stringify(cel) !== JSON.stringify(megtartva.futes[0].hotermelo)) { megtartva.futes[0].hotermelo = cel; atviheto = true; }
    }
    if (h0.tipus === 'erp' || h0.tipus === 'erp_elektromos') {
      const cel = erpHmv(megtartva.hmv.hotermelo, h0.etaWH);
      if (cel.tipus === h0.tipus && JSON.stringify(cel) !== JSON.stringify(megtartva.hmv.hotermelo)) { megtartva.hmv.hotermelo = cel; atviheto = true; }
    }
    if (atviheto) setKerdes({ cim, uj, megtartva });
    else { mg((g) => { Object.assign(g, uj); }); setSzettNyitva(false); }
  }
  function beepitettSzett(kod: string) {
    szettAlkalmaz(GEPESZETI_SZETTEK.find((s) => s.kod === kod)!.nev, { futes: [futesSzettbol(kod)], hmv: hmvSzettbol(kod), szellozes: gp.szellozes, napelem: gp.napelem });
  }

  const aktivSzett = gp.futes.length === 1 && gp.futes[0]!.szettKod && gp.hmv.szettKod === gp.futes[0]!.szettKod ? gp.futes[0]!.szettKod : null;

  return (
    <>
      <section class="szakasz">
        <h2>Kiindulás</h2>
        <p class="halk">Válassz egy szettet a leggyakoribb rendszerekből, majd lent állítsd be a tényleges berendezést. A szett csak kiindulópont: minden elem külön módosítható, és az eredmény azonnal frissül.</p>
        <div class="gombsor" style="margin-bottom:12px">
          <button class="gomb" aria-expanded={szettNyitva} onClick={() => setSzettNyitva(!szettNyitva)}>{szettNyitva ? 'Szettek elrejtése' : 'Szett választása'}</button>
          <span class="halk">{aktivSzett ? `Jelenleg: ${GEPESZETI_SZETTEK.find((s) => s.kod === aktivSzett)?.nev}` : 'Egyedi beállítás'}</span>
          {tv && <SzettMentes gp={gp} />}
        </div>
        {kerdes && (
          <div class="figyelmeztetes sav" role="alert">
            <span>A mostani rendszerben ErP adatlapos hatásfok van megadva. Átvegyem a(z) „{kerdes.cim}” szettbe, vagy a szett táblázati értékével számoljak?</span>
            <span class="gombsor">
              <button class="gomb fo" onClick={() => { mg((g) => { Object.assign(g, kerdes.megtartva); }); setKerdes(null); setSzettNyitva(false); }}>Adatlapos érték megtartása</button>
              <button class="gomb" onClick={() => { mg((g) => { Object.assign(g, kerdes.uj); }); setKerdes(null); setSzettNyitva(false); }}>Táblázati érték</button>
              <button class="gomb halk-gomb semleges" onClick={() => setKerdes(null)}>Mégse</button>
            </span>
          </div>
        )}
        {szettNyitva && (
          <>
            {tv && tv.konyvtar.szettek.length > 0 && (
              <>
                <h3 style="margin:8px 0">Irodai szettek</h3>
                <div class="szettek" style="margin-bottom:16px">
                  {tv.konyvtar.szettek.map((s) => (
                    <button class="szett" onClick={() => szettAlkalmaz(s.nev, { futes: structuredClone(s.futes).map((f) => ({ ...f, id: ujId() })), hmv: structuredClone(s.hmv), szellozes: structuredClone(s.szellozes), napelem: gp.napelem })}>
                      <h3>{s.nev}</h3>
                      <p>{s.leiras || `${s.futes.map((f) => f.nev).join(' + ')}${s.szellozes ? ', gépi szellőzés' : ''}`}</p>
                    </button>
                  ))}
                </div>
                <h3 style="margin:8px 0">Alapszettek</h3>
              </>
            )}
            <div class="szettek">
              {GEPESZETI_SZETTEK.map((s) => (
                <button class="szett" aria-pressed={aktivSzett === s.kod} onClick={() => beepitettSzett(s.kod)}>
                  <h3>{s.nev}</h3>
                  <p>{s.leiras}</p>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <section class="szakasz">
        <h2>Fűtés</h2>
        <p class="halk">A veszteségeket és a segédenergiát a program a 8. fejezet táblázataiból számolja a rendszer-alapterületre. Ha a hőtermelőnek van ErP adatlapja, válaszd az adatlapos változatot: az pontosabb a táblázati értéknél. Bivalens rendszernél (pl. hőszivattyú és kazán) vegyél fel több hőtermelőt, és add meg, mekkora részt fedeznek a fűtési igényből.</p>
        <div style="display:flex;flex-direction:column;gap:16px">
          {gp.futes.map((f, i) => (
            <FutesKartya key={f.id} f={f} tobb={gp.futes.length > 1} r={futesEredm[i]}
              m={(fn) => mg((g) => fn(g.futes[i]!))}
              torol={() => mg((g) => { g.futes.splice(i, 1); if (g.futes.length === 1) delete g.futes[0]!.lefedes; })} />
          ))}
        </div>
        <div class="gombsor" style="margin-top:12px">
          <button class="gomb" onClick={() => mg((g) => {
            const uj = futesSzettbol('gaz_kondenz_radiator');
            uj.nev = 'Kiegészítő hőtermelő';
            if (g.futes.length === 1) g.futes[0]!.lefedes = 0.8;
            uj.lefedes = Math.max(0, 1 - g.futes.reduce((s, x) => s + (x.lefedes ?? 1), 0)) || 0.2;
            g.futes.push(uj);
          })}>Kiegészítő hőtermelő (bivalens)</button>
          {gp.futes.length > 1 && <span class="halkabb">Lefedések összege: {sz(gp.futes.reduce((s, x) => s + (x.lefedes ?? 1), 0) * 100, 0)}%</span>}
        </div>
      </section>

      <section class="szakasz">
        <h2>Használati melegvíz</h2>
        <p class="halk">A nettó HMV igény lakóépületre kötelezően {p.meta.kategoria === 'csaladi_haz' ? 25 : 30} kWh/m²a (2. függ. 2.2. táblázat).</p>
        <HmvKartya h={gp.hmv} r={hmvEredm} m={(fn) => mg((g) => fn(g.hmv))} />
      </section>

      <section class="szakasz">
        <h2>Gépi szellőzés</h2>
        <p class="halk">Hővisszanyerős, állandó térfogatáramú szellőzés (6.12 és 10. fejezet). Lakóépületnél a friss levegő mennyisége kötelezően 0,5 1/h légcsere: {sz(0.5 * Vfutott, 0)} m³/h. Léghevítéses (légfűtéses) rendszer még nem számolható.</p>
        <label class="jelolo" style="margin-bottom:12px">
          <input type="checkbox" checked={!!gp.szellozes} onChange={(e) => mg((g) => {
            g.szellozes = (e.target as HTMLInputElement).checked
              ? { etaR: 0.8, uzemArany: 1, ventilator: { mod: 'erp', SPI: 0.00035, misc: 'legcsatornas', ctrl: 'kezi', x: 'fokozatmentes' } }
              : null;
          })} />
          Van gépi szellőzés hővisszanyeréssel
        </label>
        {gp.szellozes && <SzellozesKartya s={gp.szellozes} r={szellEredm} m={(fn) => mg((g) => fn(g.szellozes!))} />}
      </section>

      <section class="szakasz">
        <h2>Napelem</h2>
        <p class="halk">Egyszerűsített módszer 20 kWp-ig (13.1. táblázat). A termelés teljes egészében exportáltként számít, és súlyozott értékével csökkenti az összesített energetikai jellemzőt (14.7). Észak felé néző mezőt a táblázat nem kezel.</p>
        {gp.napelem.length > 0 && (
          <div class="tabla-gorgeto">
            <table class="tabla">
              <thead><tr><th>Megnevezés</th><th class="szam">Teljesítmény</th><th>Tájolás</th><th class="szam">Hajlásszög</th><th class="szam">Éves termelés</th><th></th></tr></thead>
              <tbody>
                {gp.napelem.map((n, i) => (
                  <tr>
                    <td style="min-width:160px"><Szoveg ertek={n.nev} valt={(v) => mg((g) => { g.napelem[i]!.nev = v; })} /></td>
                    <td style="width:130px"><Szam cimke="Teljesítmény" ertek={n.kWp} egyseg="kWp" valt={(v) => mg((g) => { g.napelem[i]!.kWp = v; })} /></td>
                    <td style="min-width:170px"><Valaszto cimke="Tájolás" ertek={n.tajolas} valt={(v) => mg((g) => { g.napelem[i]!.tajolas = v; })} opciok={C.opciok(C.PV_TAJOLAS_NEV)} /></td>
                    <td style="width:110px"><Szam cimke="Hajlásszög" ertek={n.hajlasszog} egyseg="°" valt={(v) => mg((g) => { g.napelem[i]!.hajlasszog = Math.min(Math.max(v, 0), 90); })} /></td>
                    <td class="szam">{sz(eredmeny?.napelem[i]?.W, 0)} kWh/a</td>
                    <td><button class="gomb halk-gomb" onClick={() => mg((g) => { g.napelem.splice(i, 1); })}>Törlés</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div class="gombsor" style="margin-top:12px">
          <button class="gomb" onClick={() => mg((g) => { g.napelem.push({ id: ujId(), nev: g.napelem.length ? `Napelem ${g.napelem.length + 1}` : 'Napelem', kWp: 4, tajolas: 'D', hajlasszog: 30 }); })}>Napelem hozzáadása</button>
          {eredmeny && eredmeny.indikatorok.celonkent.export.nren > 0 && (
            <span class="halk">Az összesített energetikai jellemzőt {sz(eredmeny.indikatorok.celonkent.export.nren / eredmeny.indikatorok.AN, 1)} kWh/m²a-val csökkenti.</span>
          )}
        </div>
      </section>
    </>
  );
}

// =============================================================================================
// Fűtési alrendszer

function FutesKartya({ f, tobb, r, m, torol }: { f: FutesAlrendszerUI; tobb: boolean; r: RendszerEredmeny | undefined; m: (fn: (f: FutesAlrendszerUI) => void) => void; torol: () => void }) {
  const h = f.hotermelo;
  const vizes = 'valasztas' in f.szabalyozas;
  let szabHiba: string | null = null, eSzab: number | null = null;
  try { eSzab = szabalyozasErtek(f.szabalyozas); } catch (e) { szabHiba = (e as Error).message; }
  const hset = (uj: FutesiHotermelo) => m((x) => { x.hotermelo = uj; x.szettKod = undefined; });
  const hm = (fn: (h: Barmely) => void) => m((x) => { fn(x.hotermelo); x.szettKod = undefined; });
  const kozv = 'kozvetlen' in f.szabalyozas ? f.szabalyozas : null;

  return (
    <div class="kartya gep-kartya">
      <div class="gep-fej">
        <div style="flex:1;min-width:200px"><Szoveg ertek={f.nev} valt={(v) => m((x) => { x.nev = v; })} /></div>
        {tobb && (
          <div style="width:160px" title="A zóna nettó fűtési igényéből fedezett hányad">
            <Mezo cim="Lefedés"><Szazalek cimke="Lefedés" ertek={f.lefedes ?? 1} valt={(v) => m((x) => { x.lefedes = Math.min(Math.max(v, 0), 1); })} /></Mezo>
          </div>
        )}
        {tobb && <button class="gomb halk-gomb" onClick={torol}>Eltávolítás</button>}
      </div>

      <div class="gep-racs">
        <Csoport cim="Hőtermelő">
          <Mezo cim="Típus"><Valaszto ertek={h.tipus} valt={(t) => hset(C.futesHotermeloAlap(t))} opciok={C.opciok(C.FUTES_HOTERMELO_NEV)} /></Mezo>
          {h.tipus === 'kazan_tabla' && <>
            <Mezo cim="Kazán"><Valaszto ertek={h.kazan} valt={(v) => hm((x) => { x.kazan = v; })} opciok={C.opciok(C.KAZAN_NEV)} /></Mezo>
            <Mezo cim="Elhelyezés"><Valaszto ertek={h.hely} valt={(v) => hm((x) => { x.hely = v; })} opciok={C.opciok(C.HELY_NEV)} /></Mezo>
            <Mezo cim="Tüzelőanyag"><Valaszto ertek={h.energiahordozo} valt={(v) => hm((x) => { x.energiahordozo = v; })} opciok={C.opciok({ fosszilis_gaz: 'Földgáz, PB-gáz', fosszilis_folyekony: 'Fűtőolaj', bio_gaz: 'Biogáz', bio_folyekony: 'Bio folyékony' })} /></Mezo>
          </>}
          {h.tipus === 'kazan_erp' && <>
            <Mezo cim="Szezonális hatásfok ηs" sugo="εF = 1 / ηs (8.3.1.1)"><Szazalek ertek={h.etaS} valt={(v) => hm((x) => { x.etaS = v; })} /></Mezo>
            <Mezo cim="Tüzelőanyag"><Valaszto ertek={h.energiahordozo} valt={(v) => hm((x) => { x.energiahordozo = v; })} opciok={C.opciok(C.ENERGIAHORDOZO_TUZELO as Record<string, string>)} /></Mezo>
          </>}
          {h.tipus === 'hoszivattyu_tabla' && <>
            <Mezo cim="Hőforrás"><Valaszto ertek={h.forras} valt={(v) => hm((x) => { x.forras = v; })} opciok={C.opciok(C.HSZ_FORRAS_NEV)} /></Mezo>
            <Mezo cim="Fűtővíz hőmérséklete"><Valaszto ertek={h.hofok} valt={(v) => hm((x) => { x.hofok = v; })} opciok={[{ ertek: '35/28', nev: '35/28 °C (felületfűtés)' }, { ertek: '55/45', nev: '55/45 °C (radiátor)' }]} /></Mezo>
          </>}
          {h.tipus === 'hoszivattyu_erp' && (
            <Mezo cim="Szezonális hatásfok ηs" sugo="εF = 1 / (2,5 · ηs) (8.3.2.1)"><Szazalek ertek={h.etaS} valt={(v) => hm((x) => { x.etaS = v; })} /></Mezo>
          )}
          {h.tipus === 'hoszivattyu_scop' && <Mezo cim="SCOP" sugo="εF = 1 / SCOP"><Szam ertek={h.SCOP} valt={(v) => hm((x) => { x.SCOP = v; })} /></Mezo>}
          {h.tipus === 'szilard_kazan' && <>
            <Mezo cim="Kazán"><Valaszto ertek={h.kazan} valt={(v) => hm((x) => { x.kazan = v; })} opciok={C.opciok(C.SZILARD_NEV)} /></Mezo>
            <Mezo cim="Tüzelőanyag"><Valaszto ertek={h.energiahordozo} valt={(v) => hm((x) => { x.energiahordozo = v; })} opciok={C.opciok({ bio_szilard: 'Tűzifa, pellet, apríték', bio_szilard_korszeru: 'Biomassza, korszerű berendezés (7. mell. 3.)', fosszilis_szilard: 'Szén' })} /></Mezo>
          </>}
          {h.tipus === 'tavho' && <Mezo cim="Hőközpontok száma"><Szam ertek={h.hokozpontokSzama ?? 1} valt={(v) => hm((x) => { x.hokozpontokSzama = Math.max(1, Math.round(v)); })} /></Mezo>}
          {h.tipus === 'egyeb' && <Mezo cim="Készülék"><Valaszto ertek={h.kod} valt={(v) => hm((x) => { x.kod = v; })} opciok={T.EGYEB_FUTES_EPSZILON_F.map((e) => ({ ertek: e.kod, nev: `${e.megnevezes} (εF = ${String(e.eF).replace('.', ',')})` }))} /></Mezo>}
          {h.tipus === 'kezi' && <>
            <Mezo cim="Teljesítménytényező εF"><Szam ertek={h.epszilon} valt={(v) => hm((x) => { x.epszilon = v; })} /></Mezo>
            <Mezo cim="Energiahordozó"><Valaszto ertek={h.energiahordozo} valt={(v) => hm((x) => { x.energiahordozo = v; })} opciok={C.opciok(C.ENERGIAHORDOZO_TUZELO as Record<string, string>)} /></Mezo>
            <Mezo cim="Segédenergia"><Szam ertek={h.segedKWh} egyseg="kWh/a" valt={(v) => hm((x) => { x.segedKWh = v; })} /></Mezo>
            <label class="jelolo"><input type="checkbox" checked={!!h.hoszivattyu} onChange={(e) => hm((x) => { x.hoszivattyu = (e.target as HTMLInputElement).checked; })} /> Hőszivattyú</label>
          </>}
        </Csoport>

        <Csoport cim="Hőleadás és szabályozás">
          <Mezo cim="Rendszer">
            <Valaszto ertek={vizes ? 'vizes' : 'kozvetlen'} valt={(v) => m((x) => {
              x.szabalyozas = v === 'vizes'
                ? { valasztas: { alap: 'ref_helyiseg_pi', holeado: { tipus: 'szabad', hofok: '55/45', hatarolo: 'kulsofali' }, helyiseg: 'termosztatikus', beszabalyozas: { csovek: 'ketcsoves', mod: 'statikus_csoportos_nelkul', holeadokTobbMint10: false } } }
                : { kozvetlen: C.KOZVETLEN_SZAB[0]!.ertek, forras: `${C.KOZVETLEN_SZAB[0]!.forras} – ${C.KOZVETLEN_SZAB[0]!.nev}` };
              x.szettKod = undefined;
            })} opciok={[{ ertek: 'vizes', nev: 'Vizes fűtés (radiátor, felületfűtés)' }, { ertek: 'kozvetlen', nev: 'Közvetlen fűtés (konvektor, kályha, villany, légfűtés)' }]} />
          </Mezo>
          {'valasztas' in f.szabalyozas
            ? <VizesSzab v={f.szabalyozas.valasztas} m={(fn) => m((x) => { fn((x.szabalyozas as { valasztas: SzabValasztas }).valasztas); x.szettKod = undefined; })} />
            : (
              <Mezo cim="Készülék és szabályozás (8.13./8.14. táblázat)">
                <select onChange={(e) => { const k = C.KOZVETLEN_SZAB[Number((e.target as HTMLSelectElement).value)]!; m((x) => { x.szabalyozas = { kozvetlen: k.ertek, forras: `${k.forras} – ${k.nev}` }; x.szettKod = undefined; }); }}>
                  {C.KOZVETLEN_SZAB.map((k, i) => <option value={i} selected={kozv?.forras ? kozv.forras.endsWith(k.nev) : k.ertek === kozv?.kozvetlen}>{k.nev} – {String(k.ertek).replace('.', ',')}</option>)}
                </select>
              </Mezo>
            )}
          <p class="gep-osszeg">{szabHiba ? <span style="color:var(--hiba)">{szabHiba}</span> : <>εF,szab = <strong>{sz(eSzab, 3)}</strong></>}</p>
        </Csoport>

        <Csoport cim="Elosztás, tárolás, szivattyú">
          <Mezo cim="Vezetékek">
            <Valaszto ertek={f.elosztas.hely} valt={(v) => m((x) => { x.elosztas.hely = v; if (v === 'nincs') { x.szivattyu = null; x.tarolo = null; } x.szettKod = undefined; })} opciok={[{ ertek: 'belul', nev: 'Fűtött téren belül' }, { ertek: 'kivul', nev: 'Fűtött téren kívül (pince, padlás)' }, { ertek: 'nincs', nev: 'Nincs elosztás (egyedi fűtés)' }]} />
          </Mezo>
          {f.elosztas.hely !== 'nincs' && <>
            <div class="gep-ket">
              <Mezo cim="Előremenő"><Szam ertek={f.elosztas.elore} egyseg="°C" valt={(v) => m((x) => { x.elosztas.elore = v; if (x.tarolo) x.tarolo.elore = v; x.szettKod = undefined; })} /></Mezo>
              <Mezo cim="Visszatérő"><Szam ertek={f.elosztas.vissza} egyseg="°C" valt={(v) => m((x) => { x.elosztas.vissza = v; if (x.tarolo) x.tarolo.vissza = v; x.szettKod = undefined; })} /></Mezo>
            </div>
            <Mezo cim="Puffertároló">
              <Valaszto ertek={f.tarolo ? f.tarolo.hely : 'nincs'} valt={(v) => m((x) => { x.tarolo = v === 'nincs' ? null : { hely: v as 'belul' | 'kivul', elore: x.elosztas.elore, vissza: x.elosztas.vissza }; x.szettKod = undefined; })} opciok={[{ ertek: 'nincs', nev: 'Nincs' }, { ertek: 'belul', nev: 'Fűtött téren belül' }, { ertek: 'kivul', nev: 'Fűtött téren kívül' }]} />
            </Mezo>
            <Mezo cim="Keringtető szivattyú">
              <Valaszto ertek={f.szivattyu ?? 'nincs'} valt={(v) => m((x) => { x.szivattyu = v === 'nincs' ? null : v as NonNullable<FutesAlrendszerUI['szivattyu']>; x.szettKod = undefined; })} opciok={[{ ertek: 'nincs', nev: 'Nincs (pl. kazánba épített)' }, ...C.opciok(C.SZIVATTYU_NEV)]} />
            </Mezo>
          </>}
        </Csoport>
      </div>

      <Eredmenysor r={r} kulcsok={[['epszilonF', 'εF hőtermelő', 3, ''], ['qSzall', 'Elosztási veszteség', 2, 'kWh/m²a'], ['WFveg', 'Segédenergia', 0, 'kWh/a']]} />
    </div>
  );
}

function VizesSzab({ v, m }: { v: SzabValasztas; m: (fn: (v: SzabValasztas) => void) => void }) {
  const ho = v.holeado;
  const besz = v.beszabalyozas;
  let tagok: number[] = [];
  try { tagok = szabalyozasiTenyezo(v).tagok; } catch { /* hibás kombináció */ }
  const t = (i: number) => (tagok[i] !== undefined ? ` (${tagok[i]! > 0 && i > 0 ? '+' : ''}${sz(tagok[i], 3)})` : '');
  return (
    <>
      <Mezo cim={`Központi szabályozás${t(0)}`}><Valaszto ertek={v.alap} valt={(x) => m((q) => { q.alap = x; })} opciok={C.opciok(C.SZAB_ALAP_NEV)} /></Mezo>
      <Mezo cim="Hőleadó">
        <Valaszto ertek={ho.tipus} valt={(x) => m((q) => {
          q.holeado = x === 'szabad' ? { tipus: 'szabad', hofok: '55/45', hatarolo: 'kulsofali' } : { tipus: 'beagyazott', rendszer: 'padlo_nedves', hatarolo: 'min_szig' };
          if (x === 'beagyazott' && q.beszabalyozas.csovek === 'egycsoves') q.beszabalyozas = { csovek: 'ketcsoves', mod: 'statikus_csoportos_dinamikus', holeadokTobbMint10: false };
        })} opciok={[{ ertek: 'szabad', nev: 'Radiátor, konvektor (szabad fűtőfelület)' }, { ertek: 'beagyazott', nev: 'Padló-, fal-, mennyezetfűtés' }]} />
      </Mezo>
      {ho.tipus === 'szabad' ? <>
        <Mezo cim={`Méretezési hőfoklépcső${t(1)}`}>
          <Valaszto ertek={ho.hofok} valt={(x) => m((q) => { (q.holeado as typeof ho).hofok = x; })} opciok={(ho.egycsoves ? (['90/70', '70/55'] as const) : (['90/70', '70/55', '55/45', '45/35'] as const)).map((x) => ({ ertek: x, nev: `${x} °C` }))} />
        </Mezo>
        <Mezo cim={`Elhelyezés${t(2)}`}><Valaszto ertek={ho.hatarolo} valt={(x) => m((q) => { (q.holeado as typeof ho).hatarolo = x; })} opciok={C.opciok(C.SZABAD_HATAROLO_NEV)} /></Mezo>
        <label class="jelolo"><input type="checkbox" checked={!!ho.ventilatoros} onChange={(e) => m((q) => { (q.holeado as typeof ho).ventilatoros = (e.target as HTMLInputElement).checked; })} /> Ventilátoros radiátor</label>
      </> : <>
        <Mezo cim={`Rendszer${t(1)}`}><Valaszto ertek={ho.rendszer} valt={(x) => m((q) => { (q.holeado as typeof ho).rendszer = x; })} opciok={C.opciok(C.BEAGYAZOTT_NEV)} /></Mezo>
        <Mezo cim={`Hőszigetelés a fűtőfelület mögött${t(2)}`}><Valaszto ertek={ho.hatarolo} valt={(x) => m((q) => { (q.holeado as typeof ho).hatarolo = x; })} opciok={C.opciok(C.BEAGYAZOTT_HATAROLO_NEV)} /></Mezo>
      </>}
      <Mezo cim={`Helyiségenkénti szabályozás${t(3)}`}><Valaszto ertek={v.helyiseg} valt={(x) => m((q) => { q.helyiseg = x; })} opciok={C.opciok(C.HELYISEG_SZAB_NEV)} /></Mezo>
      {ho.tipus === 'szabad' && (
        <Mezo cim="Csőhálózat">
          <Valaszto ertek={besz.csovek} valt={(x) => m((q) => {
            q.beszabalyozas = x === 'egycsoves' ? { csovek: 'egycsoves', mod: 'statikus' } : { csovek: 'ketcsoves', mod: 'statikus_csoportos_nelkul', holeadokTobbMint10: false };
            if (q.holeado.tipus === 'szabad') { q.holeado.egycsoves = x === 'egycsoves'; if (x === 'egycsoves' && !['90/70', '70/55'].includes(q.holeado.hofok)) q.holeado.hofok = '70/55'; }
          })} opciok={[{ ertek: 'ketcsoves', nev: 'Kétcsöves' }, { ertek: 'egycsoves', nev: 'Egycsöves' }]} />
        </Mezo>
      )}
      {besz.csovek === 'ketcsoves'
        ? <>
          <Mezo cim={`Beszabályozás${t(4)}`}><Valaszto ertek={besz.mod} valt={(x) => m((q) => { (q.beszabalyozas as typeof besz).mod = x; })} opciok={C.opciok(C.BESZAB_KETCSOVES_NEV)} /></Mezo>
          <label class="jelolo"><input type="checkbox" checked={besz.holeadokTobbMint10} onChange={(e) => m((q) => { (q.beszabalyozas as typeof besz).holeadokTobbMint10 = (e.target as HTMLInputElement).checked; })} /> Több mint 10 hőleadó</label>
        </>
        : <Mezo cim={`Beszabályozás${t(4)}`}><Valaszto ertek={besz.mod} valt={(x) => m((q) => { (q.beszabalyozas as typeof besz).mod = x; })} opciok={C.opciok(C.BESZAB_EGYCSOVES_NEV)} /></Mezo>}
    </>
  );
}

// =============================================================================================
// HMV

function HmvKartya({ h, r, m }: { h: HmvUI; r: RendszerEredmeny | undefined; m: (fn: (h: HmvUI) => void) => void }) {
  const ht = h.hotermelo;
  const hset = (uj: HmvHotermelo) => m((x) => { x.hotermelo = uj; x.szettKod = undefined; });
  const hm = (fn: (h: Barmely) => void) => m((x) => { fn(x.hotermelo); x.szettKod = undefined; });
  const k = h.napkollektor;
  return (
    <div class="kartya gep-kartya">
      <div class="gep-racs">
        <Csoport cim="Vízmelegítő">
          <Mezo cim="Típus"><Valaszto ertek={ht.tipus} valt={(t) => hset(C.hmvHotermeloAlap(t))} opciok={C.opciok(C.HMV_HOTERMELO_NEV)} /></Mezo>
          {ht.tipus === 'kazan_tabla' && <>
            <Mezo cim="Kazán"><Valaszto ertek={ht.kazan} valt={(v) => hm((x) => { x.kazan = v; })} opciok={C.opciok(C.HMV_KAZAN_NEV)} /></Mezo>
            <Mezo cim="Tüzelőanyag"><Valaszto ertek={ht.energiahordozo} valt={(v) => hm((x) => { x.energiahordozo = v; })} opciok={C.opciok({ fosszilis_gaz: 'Földgáz, PB-gáz', fosszilis_folyekony: 'Fűtőolaj', bio_gaz: 'Biogáz' })} /></Mezo>
          </>}
          {ht.tipus === 'erp' && <>
            <Mezo cim="Vízmelegítési hatásfok ηwh" sugo="εHMV = 1 / ηwh"><Szazalek ertek={ht.etaWH} valt={(v) => hm((x) => { x.etaWH = v; })} /></Mezo>
            <Mezo cim="Tüzelőanyag"><Valaszto ertek={ht.energiahordozo} valt={(v) => hm((x) => { x.energiahordozo = v; })} opciok={C.opciok(C.ENERGIAHORDOZO_TUZELO as Record<string, string>)} /></Mezo>
          </>}
          {ht.tipus === 'erp_elektromos' && <>
            <Mezo cim="Vízmelegítési hatásfok ηwh" sugo="εHMV = 1 / (2,5 · ηwh)"><Szazalek ertek={ht.etaWH} valt={(v) => hm((x) => { x.etaWH = v; })} /></Mezo>
            <label class="jelolo"><input type="checkbox" checked={ht.hoszivattyu} onChange={(e) => hm((x) => { x.hoszivattyu = (e.target as HTMLInputElement).checked; })} /> Hőszivattyú (környezeti hő)</label>
          </>}
          {ht.tipus === 'elektromos_tabla' && <Mezo cim="Készülék"><Valaszto ertek={ht.kod} valt={(v) => hm((x) => { x.kod = v; })} opciok={C.opciok(C.HMV_ELEKTROMOS_NEV)} /></Mezo>}
          {ht.tipus === 'szilard' && <>
            <Mezo cim="Kazán"><Valaszto ertek={ht.kazan} valt={(v) => hm((x) => { x.kazan = v; })} opciok={C.opciok(C.SZILARD_NEV)} /></Mezo>
            <Mezo cim="Tüzelőanyag"><Valaszto ertek={ht.energiahordozo} valt={(v) => hm((x) => { x.energiahordozo = v; })} opciok={C.opciok({ bio_szilard: 'Tűzifa, pellet, apríték', bio_szilard_korszeru: 'Biomassza, korszerű berendezés', fosszilis_szilard: 'Szén' })} /></Mezo>
          </>}
          {ht.tipus === 'egyeb' && <Mezo cim="Készülék"><Valaszto ertek={ht.kod} valt={(v) => hm((x) => { x.kod = v; })} opciok={C.opciok(C.HMV_EGYEB_NEV)} /></Mezo>}
          {ht.tipus === 'tavho' && <Mezo cim="Hőközpontok száma"><Szam ertek={ht.hokozpontokSzama ?? 1} valt={(v) => hm((x) => { x.hokozpontokSzama = Math.max(1, Math.round(v)); })} /></Mezo>}
          {ht.tipus === 'kezi' && <>
            <Mezo cim="Teljesítménytényező εHMV"><Szam ertek={ht.epszilon} valt={(v) => hm((x) => { x.epszilon = v; })} /></Mezo>
            <Mezo cim="Energiahordozó"><Valaszto ertek={ht.energiahordozo} valt={(v) => hm((x) => { x.energiahordozo = v; })} opciok={C.opciok(C.ENERGIAHORDOZO_TUZELO as Record<string, string>)} /></Mezo>
            <label class="jelolo"><input type="checkbox" checked={!!ht.hoszivattyu} onChange={(e) => hm((x) => { x.hoszivattyu = (e.target as HTMLInputElement).checked; })} /> Hőszivattyú</label>
          </>}
        </Csoport>

        <Csoport cim="Tárolás és elosztás">
          <Mezo cim="Tároló">
            <Valaszto ertek={h.tarolo ? h.tarolo.tipus : 'nincs'} valt={(v) => m((x) => { x.tarolo = v === 'nincs' ? null : { tipus: v as keyof typeof T.HMV_TAROLO.belul, hely: x.tarolo?.hely ?? 'belul' }; x.szettKod = undefined; })} opciok={[{ ertek: 'nincs', nev: 'Nincs (átfolyós)' }, ...C.opciok(C.HMV_TAROLO_NEV)]} />
          </Mezo>
          {h.tarolo && <Mezo cim="Tároló helye"><Valaszto ertek={h.tarolo.hely} valt={(v) => m((x) => { x.tarolo!.hely = v; x.szettKod = undefined; })} opciok={C.opciok(C.HELY_NEV)} /></Mezo>}
          <Mezo cim="Vezetékek"><Valaszto ertek={h.elosztas.hely} valt={(v) => m((x) => { x.elosztas.hely = v; x.szettKod = undefined; })} opciok={C.opciok(C.HELY_NEV)} /></Mezo>
          <label class="jelolo"><input type="checkbox" checked={h.elosztas.cirkulacio} onChange={(e) => m((x) => { const c = (e.target as HTMLInputElement).checked; x.elosztas.cirkulacio = c; x.cirkSzivattyu = c ? x.cirkSzivattyu ?? 'ismeretlen' : null; x.szettKod = undefined; })} /> Cirkuláció</label>
          {h.elosztas.cirkulacio && <Mezo cim="Cirkulációs szivattyú"><Valaszto ertek={h.cirkSzivattyu ?? 'ismeretlen'} valt={(v) => m((x) => { x.cirkSzivattyu = v; x.szettKod = undefined; })} opciok={C.opciok(C.CIRK_NEV)} /></Mezo>}
        </Csoport>

        <Csoport cim="Napkollektor">
          <Mezo cim="Kollektor">
            <Valaszto ertek={k ? k.tipus : 'nincs'} valt={(v) => m((x) => { x.napkollektor = v === 'nincs' ? undefined : { tipus: v as 'sik' | 'vakuum', felulet: x.napkollektor?.felulet ?? 4, hajlasszog: x.napkollektor?.hajlasszog ?? 45, tajolasFok: x.napkollektor?.tajolasFok ?? 0 }; })}
              opciok={[{ ertek: 'nincs', nev: 'Nincs' }, { ertek: 'sik', nev: 'Síkkollektor' }, { ertek: 'vakuum', nev: 'Vákuumcsöves' }]} />
          </Mezo>
          {k && <>
            <Mezo cim="Bruttó felület"><Szam ertek={k.felulet} egyseg="m²" valt={(v) => m((x) => { x.napkollektor!.felulet = v; })} /></Mezo>
            <div class="gep-ket">
              <Mezo cim="Hajlásszög"><Szam ertek={k.hajlasszog} egyseg="°" valt={(v) => m((x) => { x.napkollektor!.hajlasszog = Math.min(Math.max(v, 0), 90); })} /></Mezo>
              <Mezo cim="Tájolás"><Valaszto ertek={String(k.tajolasFok)} valt={(v) => m((x) => { x.napkollektor!.tajolasFok = Number(v); })} opciok={C.KOLLEKTOR_TAJOLAS} /></Mezo>
            </div>
            <p class="halkabb">Feltétel: csak a HMV-re segít rá, és a tároló legalább 50 l/m² kollektorfelület (9.2.1.1).</p>
          </>}
        </Csoport>
      </div>
      <Eredmenysor r={r} kulcsok={[['epszilonHMV', 'εHMV', 3, ''], ['QHMVnet', 'Nettó igény', 0, 'kWh/a'], ['QTar', 'Tárolási veszteség', 0, 'kWh/a'], ['QSzall', 'Elosztási veszteség', 0, 'kWh/a']]} />
    </div>
  );
}

// =============================================================================================
// Szellőzés

function SzellozesKartya({ s, r, m }: { s: SzellozesUI; r: RendszerEredmeny | undefined; m: (fn: (s: SzellozesUI) => void) => void }) {
  const v = s.ventilator;
  return (
    <div class="kartya gep-kartya">
      <div class="gep-racs">
        <Csoport cim="Hővisszanyerés">
          <Mezo cim="Hővisszanyerő hatásfoka ηr" sugo="A termék adatlapja szerinti érték"><Szazalek ertek={s.etaR} valt={(x) => m((q) => { q.etaR = Math.min(Math.max(x, 0), 0.95); })} /></Mezo>
          <Mezo cim="Üzemidő aránya" sugo="A fennmaradó időben természetes szellőzéssel számol (6.13–6.14)"><Szazalek ertek={s.uzemArany} valt={(x) => m((q) => { q.uzemArany = Math.min(Math.max(x, 0), 1); })} /></Mezo>
        </Csoport>
        <Csoport cim="Ventilátor">
          <Mezo cim="Adatforrás">
            <Valaszto ertek={v.mod} valt={(x) => m((q) => { q.ventilator = x === 'erp' ? { mod: 'erp', SPI: 0.00035, misc: 'legcsatornas', ctrl: 'kezi', x: 'fokozatmentes' } : { mod: 'nyomas', dp: 200, etaVent: null }; })}
              opciok={[{ ertek: 'erp', nev: 'ErP adatlap (SPI)' }, { ertek: 'nyomas', nev: 'Nyomásesés és ventilátor-hatásfok' }]} />
          </Mezo>
          {v.mod === 'erp' ? <>
            <Mezo cim="Fajlagos teljesítményfelvétel SPI" sugo="Az adatlapon W/(m³/h)-ban szerepel"><Szam ertek={v.SPI * 1000} egyseg="W/(m³/h)" valt={(x) => m((q) => { (q.ventilator as typeof v).SPI = x / 1000; })} /></Mezo>
            <Mezo cim="Kialakítás"><Valaszto ertek={v.misc} valt={(x) => m((q) => { (q.ventilator as typeof v).misc = x; })} opciok={C.opciok(C.MISC_NEV)} /></Mezo>
            <Mezo cim="Vezérlés"><Valaszto ertek={v.ctrl} valt={(x) => m((q) => { (q.ventilator as typeof v).ctrl = x; })} opciok={C.opciok(C.CTRL_NEV)} /></Mezo>
            <Mezo cim="Motor fokozatai"><Valaszto ertek={v.x} valt={(x) => m((q) => { (q.ventilator as typeof v).x = x; })} opciok={C.opciok(C.X_NEV)} /></Mezo>
          </> : <>
            <Mezo cim="Teljes nyomásesés (befúvó + elszívó)"><Szam ertek={v.dp} egyseg="Pa" valt={(x) => m((q) => { (q.ventilator as typeof v).dp = x; })} /></Mezo>
            <Mezo cim="Ventilátor-összhatásfok" sugo="Üresen: 10.8. táblázat (kis ventilátor 40%)">
              <Szam ertek={v.etaVent === null ? undefined : v.etaVent * 100} egyseg="%" valt={(x) => m((q) => { (q.ventilator as typeof v).etaVent = x > 0 ? x / 100 : null; })} />
            </Mezo>
          </>}
          <Mezo cim="Egyéb segédenergia"><Szam ertek={s.segedKWh ?? 0} egyseg="kWh/a" valt={(x) => m((q) => { q.segedKWh = x; })} /></Mezo>
        </Csoport>
      </div>
      <Eredmenysor r={r} kulcsok={[['V', 'Friss levegő', 0, 'm³/h'], ['uzemora', 'Üzemidő', 0, 'h/a']]} />
    </div>
  );
}

// =============================================================================================

function SzettMentes({ gp }: { gp: Gepeszet }) {
  const tv = useTavoli()!;
  const [nyitva, setNyitva] = useState(false);
  const [nev, setNev] = useState('');
  const [leiras, setLeiras] = useState('');
  const [allapot, setAllapot] = useState<string | null>(null);
  if (!nyitva) {
    return <>
      <button class="gomb" onClick={() => { setNyitva(true); setAllapot(null); }}>Mentés irodai szettként</button>
      {allapot && <span class="halkabb" role="status">{allapot}</span>}
    </>;
  }
  return (
    <form class="gombsor" style="flex-basis:100%" onSubmit={(e) => {
      e.preventDefault();
      setAllapot('Mentés…');
      const n = nev;
      szettMent(tv.iroda.id, nev, leiras, gp).then(() => tv.frissit()).then(() => { setAllapot(`„${n}” elmentve az irodai szettek közé.`); setNyitva(false); setNev(''); setLeiras(''); }, (err: Error) => setAllapot(err.message));
    }}>
      <input type="text" required placeholder="Szett neve" aria-label="Szett neve" value={nev} onInput={(e) => setNev((e.target as HTMLInputElement).value)} style="max-width:240px" />
      <input type="text" placeholder="Rövid leírás (nem kötelező)" aria-label="Leírás" value={leiras} onInput={(e) => setLeiras((e.target as HTMLInputElement).value)} style="max-width:300px" />
      <button class="gomb fo" type="submit" disabled={!nev.trim()}>Mentés</button>
      <button type="button" class="gomb halk-gomb semleges" onClick={() => setNyitva(false)}>Mégse</button>
      {allapot && <span class="halkabb">{allapot}</span>}
    </form>
  );
}
