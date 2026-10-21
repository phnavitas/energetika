import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { GEPESZETI_SZETTEK, FUTES_SZETTEK, HMV_SZETTEK, SZELLOZES_SZETTEK, HUTES_SZETTEK, hutes as HT, gepeszet as T, szabalyozasiTenyezo, type EpuletEredmeny, type FutesiHotermelo, type HmvHotermelo, type RendszerEredmeny } from '@mag/index';
import { Mezo, Szam, Szoveg, Valaszto, sz } from '../ui';
import {
  ujId, futesSzettbol, hmvSzettbol, szellozesSzettbol, hutesSzettbol, erpFutes, erpHmv, szabalyozasErtek, szettNev,
  type Projekt, type Gepeszet, type FutesAlrendszerUI, type HmvUI, type SzellozesUI, type HutesUI,
} from '../modell';
import { TAVHO_ALAP, tavhoLista, tavhoSulyozobol, type TavhoRendszer } from '../tavho';
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

/** Részrendszer-szettek rácsa lenyitható gombbal. */
function SzettRacs({ cimke, lista, aktiv, valaszt, nyitva: kezdo = false }: { cimke: string; lista: readonly { kod: string; nev: string; leiras: string }[]; aktiv?: string | null; valaszt: (kod: string) => void; nyitva?: boolean }) {
  const [nyitva, setNyitva] = useState(kezdo);
  return (
    <div class="szett-sor">
      <button class="gomb" aria-expanded={nyitva} onClick={() => setNyitva(!nyitva)}>{nyitva ? 'Szettek elrejtése' : cimke}</button>
      {nyitva && (
        <div class="szettek" style="margin-top:8px">
          {lista.map((s) => (
            <button class="szett" aria-pressed={aktiv === s.kod} onClick={() => { valaszt(s.kod); setNyitva(false); }}>
              <h3>{s.nev}</h3>
              <p>{s.leiras}</p>
            </button>
          ))}
        </div>
      )}
    </div>
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
  const ANossz = p.helyisegek.filter((h) => h.kategoria !== 'gyengen_kapcsolt').reduce((s, h) => s + h.A, 0);
  const Vfutott = p.helyisegek.filter((h) => h.kategoria !== 'gyengen_kapcsolt').reduce((s, h) => s + h.A * h.h, 0);

  /** Szett alkalmazása; ha a mostani rendszerben ErP adatlapos érték van, és az új szettbe átvihető, rákérdez. */
  function szettAlkalmaz(cim: string, uj: Gepeszet) {
    const megtartva = structuredClone(uj);
    let atviheto = false;
    const h0 = gp.hmv.hotermelo;
    megtartva.futes.forEach((uf, i) => {
      const f0 = gp.futes[i]?.hotermelo;
      if (!f0 || (f0.tipus !== 'kazan_erp' && f0.tipus !== 'hoszivattyu_erp') || JSON.stringify(uf) === JSON.stringify(gp.futes[i])) return;
      const cel = erpFutes(uf.hotermelo, f0.etaS);
      if (cel.tipus === f0.tipus && JSON.stringify(cel) !== JSON.stringify(uf.hotermelo)) { uf.hotermelo = cel; atviheto = true; }
    });
    if (h0.tipus === 'erp' || h0.tipus === 'erp_elektromos') {
      const cel = erpHmv(megtartva.hmv.hotermelo, h0.etaWH);
      if (cel.tipus === h0.tipus && JSON.stringify(cel) !== JSON.stringify(megtartva.hmv.hotermelo)) { megtartva.hmv.hotermelo = cel; atviheto = true; }
    }
    if (atviheto) setKerdes({ cim, uj, megtartva });
    else { mg((g) => { Object.assign(g, uj); }); setSzettNyitva(false); }
  }
  function beepitettSzett(kod: string) {
    szettAlkalmaz(GEPESZETI_SZETTEK.find((s) => s.kod === kod)!.nev, { ...gp, futes: [futesSzettbol(kod)], hmv: hmvSzettbol(kod) });
  }
  /** Egy fűtési alrendszer cseréje szettre (az azonosító és a lefedés megmarad). */
  function futesSzett(i: number, kod: string) {
    const uj = structuredClone(gp);
    const f = futesSzettbol(kod);
    uj.futes[i] = { ...f, id: gp.futes[i]!.id, lefedes: gp.futes[i]!.lefedes };
    szettAlkalmaz(f.nev, uj);
  }
  function hmvSzett(kod: string) {
    const uj = structuredClone(gp);
    uj.hmv = hmvSzettbol(kod);
    szettAlkalmaz(HMV_SZETTEK.find((x) => x.kod === kod)!.nev, uj);
  }
  const hutesEredm = eredmeny?.rendszerek.filter((r) => r.cel === 'hutes') ?? [];
  const QHnet = eredmeny?.zonak[0]?.QHnetEv ?? 0;

  const aktivSzett = gp.futes.length === 1 ? GEPESZETI_SZETTEK.find((c) => (c.futesKod === gp.futes[0]!.szettKod || c.kod === gp.futes[0]!.szettKod) && (c.hmvKod === gp.hmv.szettKod || c.kod === gp.hmv.szettKod))?.kod ?? null : null;

  return (
    <>
      <section class="szakasz">
        <h2>Kiindulás</h2>
        <p class="halk">Gyors kezdéshez választhatsz teljes fűtés + HMV kombinációt, de a fűtés, a HMV, a szellőzés és a hűtés lent külön-külön is szettből tölthető. A szett csak kiindulópont: minden elem módosítható, és az eredmény azonnal frissül.</p>
        <div class="gombsor" style="margin-bottom:12px">
          <button class="gomb" aria-expanded={szettNyitva} onClick={() => setSzettNyitva(!szettNyitva)}>{szettNyitva ? 'Kombinációk elrejtése' : 'Teljes rendszer-kombináció'}</button>
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
            <FutesKartya key={f.id} f={f} AN={ANossz} tobb={gp.futes.length > 1} r={futesEredm[i]} szett={(kod) => futesSzett(i, kod)}
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
          <button class="gomb" onClick={() => mg((g) => {
            const uj = futesSzettbol('gaz_kondenz_radiator');
            uj.nev = 'Rendszer másik épületrészre';
            const fel = Math.round((ANossz / 2) * 10) / 10;
            if (g.futes.length === 1) { g.futes[0]!.terulet = Math.round((ANossz - fel) * 10) / 10; g.futes[0]!.lefedes = ANossz ? g.futes[0]!.terulet / ANossz : 1; }
            uj.terulet = fel; uj.lefedes = ANossz ? fel / ANossz : 0.5;
            g.futes.push(uj);
          })}>Rendszer másik épületrészre (alapterület szerint)</button>
          {gp.futes.length > 1 && <span class="halkabb">Lefedések összege: {sz(gp.futes.reduce((s, x) => s + (x.terulet && ANossz ? x.terulet / ANossz : x.lefedes ?? 1), 0) * 100, 0)}%{gp.futes.some((x) => x.terulet) ? ` · kiszolgált területek: ${sz(gp.futes.reduce((s, x) => s + (x.terulet ?? 0), 0), 1)} / ${sz(ANossz, 1)} m²` : ''}</span>}
        </div>
      </section>

      <section class="szakasz">
        <h2>Használati melegvíz</h2>
        <p class="halk">A nettó HMV igény lakóépületre kötelezően {p.meta.kategoria === 'csaladi_haz' ? 25 : 30} kWh/m²a (2. függ. 2.2. táblázat).</p>
        <HmvKartya h={gp.hmv} r={hmvEredm} m={(fn) => mg((g) => fn(g.hmv))} szett={hmvSzett} />
      </section>

      <section class="szakasz">
        <h2>Gépi szellőzés</h2>
        <p class="halk">Hővisszanyerős, állandó térfogatáramú szellőzés (6.12 és 10. fejezet). Lakóépületnél a friss levegő mennyisége kötelezően 0,5 1/h légcsere: {sz(0.5 * Vfutott, 0)} m³/h. Léghevítéses (légfűtéses) rendszer még nem számolható.</p>
        <div class="gombsor" style="margin-bottom:12px;align-items:flex-start">
          <SzettRacs cimke={gp.szellozes ? 'Szellőzési szett cseréje' : 'Gépi szellőzés hozzáadása szettből'} lista={SZELLOZES_SZETTEK} aktiv={gp.szellozes?.szettKod} valaszt={(kod) => mg((g) => { g.szellozes = szellozesSzettbol(kod); })} />
          {gp.szellozes && <button class="gomb halk-gomb" onClick={() => mg((g) => { g.szellozes = null; })}>Nincs gépi szellőzés</button>}
        </div>
        {gp.szellozes && <>
          <p class="halkabb" style="margin-bottom:8px">{szettNev(SZELLOZES_SZETTEK, gp.szellozes.szettKod) ? `Szett: ${szettNev(SZELLOZES_SZETTEK, gp.szellozes.szettKod)}. ` : 'Egyedi beállítás. '}A szettek ηr és SPI értéke jellemző termékadat, nem rendeleti táblázati érték: a tényleges berendezés adatlapja szerint írd át.</p>
          <SzellozesKartya s={gp.szellozes} r={szellEredm} m={(fn) => mg((g) => { fn(g.szellozes!); g.szellozes!.szettKod = undefined; })} />
        </>}
      </section>

      <section class="szakasz">
        <h2>Hűtés</h2>
        <p class="halk">Gépi hűtés a 11. fejezet egyszerűsített módszerével: QH,vég = QH,net · cH · εH,szab · εH (11.1), εH = 1/SEER. Hűtési rendszer felvételekor a zóna nettó hűtési igényét (6.8) is számolja a program.{gp.hutes?.length ? ` Nettó hűtési igény: ${sz(QHnet, 0)} kWh/a (${sz(QHnet / (eredmeny?.indikatorok.AN || 1), 1)} kWh/m²a).` : ''}</p>
        <div style="display:flex;flex-direction:column;gap:16px">
          {(gp.hutes ?? []).map((h, i) => (
            <HutesKartya key={h.id} h={h} tobb={(gp.hutes?.length ?? 0) > 1} r={hutesEredm[i]}
              m={(fn) => mg((g) => fn(g.hutes![i]!))}
              szett={(kod) => mg((g) => { g.hutes![i] = { ...hutesSzettbol(kod), id: h.id, lefedes: h.lefedes }; })}
              torol={() => mg((g) => { g.hutes!.splice(i, 1); if (g.hutes!.length === 1) delete g.hutes![0]!.lefedes; })} />
          ))}
        </div>
        <div style="margin-top:12px">
          <SzettRacs cimke={gp.hutes?.length ? 'További hűtési rendszer' : 'Hűtés hozzáadása szettből'} lista={HUTES_SZETTEK} valaszt={(kod) => mg((g) => {
            const uj = hutesSzettbol(kod);
            g.hutes ??= [];
            if (g.hutes.length === 1) g.hutes[0]!.lefedes = 0.5;
            if (g.hutes.length) uj.lefedes = Math.max(0, 1 - g.hutes.reduce((s, x) => s + (x.lefedes ?? 1), 0)) || 0.5;
            g.hutes.push(uj);
          })} />
        </div>
      </section>

      {(gp.futes.some((f) => f.hotermelo.tipus === 'tavho') || gp.hmv.hotermelo.tipus === 'tavho') && <TavhoSzakasz p={p} modosit={modosit} />}
      <section class="szakasz"><p class="halkabb">A napelemek és a többi villamos fogyasztó a <strong>Villamosság</strong> lépésben található.</p></section>
    </>
  );
}

// =============================================================================================
// Fűtési alrendszer

function FutesKartya({ f, tobb, r, m, torol, szett, AN }: { f: FutesAlrendszerUI; tobb: boolean; AN: number; r: RendszerEredmeny | undefined; m: (fn: (f: FutesAlrendszerUI) => void) => void; torol: () => void; szett: (kod: string) => void }) {
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
          <div style="width:150px" title="A zóna nettó fűtési igényéből fedezett hányad">
            <Mezo cim="Lefedés"><Szazalek cimke="Lefedés" ertek={f.terulet && AN ? f.terulet / AN : f.lefedes ?? 1} valt={(v) => m((x) => { x.lefedes = Math.min(Math.max(v, 0), 1); delete x.terulet; })} /></Mezo>
          </div>
        )}
        {tobb && (
          <div style="width:160px" title="Ha a rendszer egy épületrészt lát el: a kiszolgált alapterület">
            <Mezo cim="vagy kiszolgált terület"><Szam cimke="Kiszolgált alapterület" ertek={f.terulet} egyseg="m²" valt={(v) => m((x) => { if (v > 0) { x.terulet = v; x.lefedes = AN ? Math.min(v / AN, 1) : x.lefedes; } else delete x.terulet; })} /></Mezo>
          </div>
        )}
        {tobb && <button class="gomb halk-gomb" onClick={torol}>Eltávolítás</button>}
      </div>
      <div class="gep-szett">
        <span class="halkabb">{szettNev(FUTES_SZETTEK, f.szettKod, 'futesKod') ? `Szett: ${szettNev(FUTES_SZETTEK, f.szettKod, 'futesKod')}` : 'Egyedi beállítás'}</span>
        <SzettRacs cimke="Fűtési szett választása" lista={FUTES_SZETTEK} aktiv={f.szettKod} valaszt={szett} />
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

function HmvKartya({ h, r, m, szett }: { h: HmvUI; r: RendszerEredmeny | undefined; m: (fn: (h: HmvUI) => void) => void; szett: (kod: string) => void }) {
  const ht = h.hotermelo;
  const hset = (uj: HmvHotermelo) => m((x) => { x.hotermelo = uj; x.szettKod = undefined; });
  const hm = (fn: (h: Barmely) => void) => m((x) => { fn(x.hotermelo); x.szettKod = undefined; });
  const k = h.napkollektor;
  return (
    <div class="kartya gep-kartya">
      <div class="gep-szett">
        <span class="halkabb">{szettNev(HMV_SZETTEK, h.szettKod, 'hmvKod') ? `Szett: ${szettNev(HMV_SZETTEK, h.szettKod, 'hmvKod')}` : 'Egyedi beállítás'}</span>
        <SzettRacs cimke="HMV szett választása" lista={HMV_SZETTEK} aktiv={h.szettKod} valaszt={szett} />
      </div>
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
// Hűtés

const HUTOGEP_OPC = [
  ...Object.entries(HT.HUTOGEPEK).map(([k, g]) => ({ ertek: k, nev: `${g.nev} – SEER ${String(g.SEER).replace('.', ',')}` })),
  { ertek: 'seer', nev: 'Adatlap szerinti SEER' },
  { ertek: 'passziv_talaj', nev: 'Passzív hűtés talajhőcserélővel (hőszivattyú nélkül)' },
];

function HutesKartya({ h, tobb, r, m, szett, torol }: { h: HutesUI; tobb: boolean; r: RendszerEredmeny | undefined; m: (fn: (h: HutesUI) => void) => void; szett: (kod: string) => void; torol: () => void }) {
  const mm = (fn: (h: HutesUI) => void) => m((x) => { fn(x); x.szettKod = undefined; });
  const gepErtek = h.gep.tipus === 'tabla' ? h.gep.kod : h.gep.tipus;
  return (
    <div class="kartya gep-kartya">
      <div class="gep-fej">
        <div style="flex:1;min-width:200px"><Szoveg ertek={h.nev} valt={(v) => m((x) => { x.nev = v; })} /></div>
        {tobb && <div style="width:160px"><Mezo cim="Lefedés"><Szazalek cimke="Lefedés" ertek={h.lefedes ?? 1} valt={(v) => m((x) => { x.lefedes = Math.min(Math.max(v, 0), 1); })} /></Mezo></div>}
        <button class="gomb halk-gomb" onClick={torol}>Eltávolítás</button>
      </div>
      <div class="gep-szett">
        <span class="halkabb">{szettNev(HUTES_SZETTEK, h.szettKod) ? `Szett: ${szettNev(HUTES_SZETTEK, h.szettKod)}` : 'Egyedi beállítás'}</span>
        <SzettRacs cimke="Hűtési szett választása" lista={HUTES_SZETTEK} aktiv={h.szettKod} valaszt={szett} />
      </div>
      <div class="gep-racs">
        <Csoport cim="Hűtőgép (11.2. táblázat)">
          <Mezo cim="Típus">
            <Valaszto ertek={gepErtek} valt={(v) => mm((x) => {
              x.gep = v === 'seer' ? { tipus: 'seer', SEER: 4, energiahordozo: 'villamos' } : v === 'passziv_talaj' ? { tipus: 'passziv_talaj' } : { tipus: 'tabla', kod: v as HT.HutogepKod };
            })} opciok={HUTOGEP_OPC} />
          </Mezo>
          {h.gep.tipus === 'seer' && <>
            <Mezo cim="SEER (adatlap)" sugo="εH = 1 / SEER (11.3)"><Szam ertek={h.gep.SEER} valt={(v) => mm((x) => { (x.gep as { SEER: number }).SEER = v; })} /></Mezo>
            <Mezo cim="Energiahordozó"><Valaszto ertek={h.gep.energiahordozo} valt={(v) => mm((x) => { (x.gep as { energiahordozo: string }).energiahordozo = v; })} opciok={[{ ertek: 'villamos', nev: 'Villamos energia' }, { ertek: 'fosszilis_gaz', nev: 'Földgáz (gázmotoros hőszivattyú)' }]} /></Mezo>
          </>}
          {h.gep.tipus === 'passziv_talaj' && <p class="halkabb">11.1.2: 1 kWh keringtetési segédenergia 10 kWh nettó hűtési igényt fedez.</p>}
        </Csoport>
        <Csoport cim="Hőleadás és szabályozás">
          <Mezo cim="Hűtőközeg (11.1. táblázat, cH)"><Valaszto ertek={h.cH} valt={(v) => mm((x) => { x.cH = v; })} opciok={Object.entries(HT.HUTES_CH).map(([k, v]) => ({ ertek: k as HT.HutesChKod, nev: `${v.nev} – ${String(v.cH).replace('.', ',')}` }))} /></Mezo>
          <Mezo cim="Szabályozás (11.3. táblázat, εH,szab)"><Valaszto ertek={h.szab} valt={(v) => mm((x) => { x.szab = v; })} opciok={Object.entries(HT.HUTES_SZAB).map(([k, v]) => ({ ertek: k as HT.HutesSzabKod, nev: `${v.nev} – ${String(v.eps).replace('.', ',')}` }))} /></Mezo>
          <Mezo cim="Egyéb segédenergia" sugo="Csak ami a SEER-ben nincs benne (11.2); egyszerűsített esetben 0"><Szam ertek={h.segedKWh ?? 0} egyseg="kWh/a" valt={(v) => mm((x) => { x.segedKWh = v; })} /></Mezo>
        </Csoport>
      </div>
      <Eredmenysor r={r} kulcsok={[['QHnet', 'Fedezett nettó hűtési igény', 0, 'kWh/a'], ['SEER', 'SEER', 2, ''], ['cH', 'cH', 2, ''], ['eSzab', 'εH,szab', 3, '']]} />
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

// =============================================================================================
// Távhő: a szolgáltató által közzétett súlyozó tényezők (9/2023 ÉKM 8. § (1))

function TavhoSzakasz({ p, modosit }: { p: Projekt; modosit: Modosit }) {
  const t = p.gepeszet.tavho;
  const [lista, setLista] = useState<TavhoRendszer[] | null>(null);
  const [allapot, setAllapot] = useState<string>('');
  const betolt = (friss: boolean) => { setAllapot('lekérés…'); void tavhoLista(friss).then((r) => { setLista(r.lista); setAllapot(r.online ? `online lista, lekérve ${r.lekerve?.slice(0, 10) ?? ''}${r.hibak?.length ? ` (${r.hibak.length} forrás nem elérhető)` : ''}` : 'beépített lista (2026. 02. 16.) – az online forrás nem elérhető'); }); };
  useEffect(() => betolt(false), []);
  const kulcs = (r: TavhoRendszer) => `${r.szolgaltato}|${r.rendszer}`;
  const mt = (fn: (x: NonNullable<typeof t>) => void) => modosit((q) => { q.gepeszet.tavho ??= { szolgaltato: 'Egyéb szolgáltató', fnren: TAVHO_ALAP.fnren, fren: TAVHO_ALAP.fren, fCO2: TAVHO_ALAP.fCO2 }; fn(q.gepeszet.tavho); });
  return (
    <section class="szakasz">
      <h2>Távhő – súlyozó tényezők</h2>
      <p class="halk">A távhőszolgáltató évente (március 15-ig) közzéteszi a rendszerére számított nem megújuló és megújuló primerenergia-, valamint CO₂-tényezőt (9/2023 ÉKM 8. § (1), 8. melléklet). Ennek hiányában a 7. melléklet alapértéke érvényes: f<sub>nren</sub> = 1,38, f<sub>ren</sub> = 0, CO₂ = 374 g/kWh. A lista havonta frissül a szolgáltatói oldalakról; a többi szolgáltató értéke az <a href="https://www.e-epites.hu/e-tanusitas/tavho/nyilvanos/lekerdezes" target="_blank" rel="noopener">e-építés távhő-lekérdezőjében</a> található – ezt kézzel add meg.</p>
      <div class="racs">
        <Mezo cim="Szolgáltató, rendszer" szeles sugo={allapot}>
          <select onChange={(e) => {
            const v = (e.target as HTMLSelectElement).value;
            if (v === '') { modosit((q) => { delete q.gepeszet.tavho; }); return; }
            if (v === 'kezi') { mt((x) => { x.szolgaltato = 'Egyéb szolgáltató'; delete x.rendszer; delete x.forras; delete x.frissitve; }); return; }
            const r = lista?.find((x) => kulcs(x) === v); if (r) modosit((q) => { q.gepeszet.tavho = tavhoSulyozobol(r); });
          }}>
            <option value="" selected={!t}>Alapérték (7. melléklet) – nincs szolgáltatói adat</option>
            {(lista ?? []).map((r) => <option value={kulcs(r)} selected={!!t && `${t.szolgaltato}|${t.rendszer}` === kulcs(r)}>{r.telepules}: {r.rendszer} – nren {sz(r.fnren, 3)}, ren {sz(r.fren, 3)}, CO₂ {r.fCO2 === null ? '–' : sz(r.fCO2, 1)}</option>)}
            <option value="kezi" selected={!!t && !(lista ?? []).some((r) => `${t.szolgaltato}|${t.rendszer}` === kulcs(r))}>Egyéb szolgáltató – kézi megadás</option>
          </select>
        </Mezo>
        <div class="mezo"><span>Lista</span><button class="gomb" onClick={() => betolt(true)}>Frissítés most</button></div>
      </div>
      {t && (
        <div class="racs" style="margin-top:10px">
          <Mezo cim="Szolgáltató"><Szoveg ertek={t.szolgaltato} valt={(v) => mt((x) => { x.szolgaltato = v; })} /></Mezo>
          <Mezo cim="Rendszer"><Szoveg ertek={t.rendszer ?? ''} valt={(v) => mt((x) => { x.rendszer = v || undefined; })} /></Mezo>
          <Mezo cim="f nem megújuló (nren)"><Szam ertek={t.fnren} valt={(v) => mt((x) => { x.fnren = v; })} /></Mezo>
          <Mezo cim="f megújuló (ren)"><Szam ertek={t.fren} valt={(v) => mt((x) => { x.fren = v; })} /></Mezo>
          <Mezo cim="CO₂-tényező"><Szam ertek={t.fCO2} egyseg="g/kWh" valt={(v) => mt((x) => { x.fCO2 = v; })} /></Mezo>
          <div class="mezo"><span>Forrás</span><small>{t.forras ? <a href={t.forras} target="_blank" rel="noopener">szolgáltatói közzététel</a> : 'kézi'}{t.adatEv ? ` · ${t.adatEv}. évi adatok` : ''}{t.frissitve ? ` · frissítve ${t.frissitve}` : ''}</small></div>
        </div>
      )}
    </section>
  );
}
