import { useMemo, useState } from 'preact/hooks';
import { nyilaszaroSablon as NS, FUTES_SZETTEK, HMV_SZETTEK, SZELLOZES_SZETTEK } from '@mag/index';
import { Mezo, Szam, Szoveg, Valaszto, sz } from '../ui';
import { ujId, SZEREP_NEV, type Projekt, type Szerep } from '../modell';
import { anyag } from '../katalogus';
import { SZIG_VALASZTEK } from '../tipologiaRetegek';
import {
  alapIntezkedesek, beruhazas, ertekel, mennyiseg, szamol, vastagsagGorbe, annuitas,
  type FelujitasBeallitas, type Intezkedes, type Allapot, type Ertekeles,
} from '../felujitas';
import { ALAP_ARAK, ALAP_PENZUGY, EGYSEGAR, EGYSEGAR_FORRAS, ARAK_DATUM } from '../felujitasArak';

type Modosit = (fn: (p: Projekt) => void) => void;
const Ft = (x: number | null | undefined) => (x === null || x === undefined || !Number.isFinite(x) ? '–' : `${Math.round(x).toLocaleString('hu-HU')} Ft`);
const egysegar = (kod: string) => EGYSEGAR[kod]?.ertek ?? 0;

export function alapBeallitas(p: Projekt): FelujitasBeallitas {
  return { arak: { ...ALAP_ARAK }, penzugy: { ...ALAP_PENZUGY }, intezkedesek: alapIntezkedesek(p, (k) => egysegar(k)) };
}

export function FelujitasLepes({ p, modosit }: { p: Projekt; modosit: Modosit }) {
  const b = p.felujitas;
  if (!b) {
    return (
      <section class="szakasz">
        <h2>Felújítás-elemző</h2>
        <p class="halk" style="margin-bottom:12px">A jelenlegi állapotot alapul véve intézkedésenként és csomagban kiszámolja a beruházási költséget, az éves energiaköltség-megtakarítást, a megtérülést, a nettó jelenértéket és az energetikai besorolás változását – a teljes 9/2023 ÉKM számítással. Az intézkedéseket a projekt meglévő szerkezeteiből javasolja.</p>
        <button class="gomb fo" onClick={() => modosit((q) => { q.felujitas = alapBeallitas(q); })}>Felújítási elemzés indítása</button>
      </section>
    );
  }
  return <Elemzo p={p} b={b} modosit={modosit} />;
}

function Elemzo({ p, b, modosit }: { p: Projekt; b: FelujitasBeallitas; modosit: Modosit }) {
  const mb = (fn: (x: FelujitasBeallitas) => void) => modosit((q) => fn(q.felujitas!));
  const alap = useMemo(() => szamol(p, b.arak), [p, b.arak]);
  const egyenkent = useMemo(() => (alap.koltseg ? b.intezkedesek.map((m) => ertekel(p, alap, [m], b)) : []), [p, alap, b]);
  const aktivak = b.intezkedesek.filter((m) => m.aktiv);
  const csomag = useMemo(() => (alap.koltseg && aktivak.length ? ertekel(p, alap, aktivak, b) : null), [p, alap, b]);
  const [nyitott, setNyitott] = useState<string | null>(null);

  if (alap.hiba || !alap.e || !alap.koltseg) {
    return <section class="szakasz"><h2>Felújítás-elemző</h2><div class="hiba-doboz">A jelenlegi állapot nem számolható: {alap.hiba}</div></section>;
  }
  const AN = alap.e.indikatorok.AN;

  return (
    <>
      <section class="szakasz">
        <h2>Jelenlegi állapot</h2>
        <div class="kartya" style="display:flex;gap:28px;flex-wrap:wrap">
          <div><p class="halkabb">Összesített energetikai jellemző</p><h2>{sz(alap.e.indikatorok.fajlagos.EnrenFajl, 1)} kWh/m²a</h2><p class="halkabb">{alap.e.besorolas.energetikai} osztály</p></div>
          <div><p class="halkabb">Nettó fűtési igény</p><h2>{sz(alap.e.qFnet, 1)} kWh/m²a</h2></div>
          <div><p class="halkabb">Éves energiaköltség (becslés)</p><h2>{Ft(alap.koltseg.osszes)}</h2><p class="halkabb">{sz(alap.koltseg.osszes / AN, 0)} Ft/m²</p></div>
          <div><p class="halkabb">CO₂</p><h2>{sz(alap.e.indikatorok.osszes.CO2, 0)} kg/a</h2></div>
        </div>
        <div class="tabla-gorgeto" style="margin-top:8px">
          <table class="tabla" style="max-width:640px">
            <thead><tr><th>Energiahordozó</th><th class="szam">Mennyiség</th><th class="szam">Éves költség</th></tr></thead>
            <tbody>{alap.koltseg.tetelek.map((t) => <tr><td>{t.nev}</td><td class="szam">{sz(t.kWh, 0)} kWh</td><td class="szam">{Ft(t.Ft)}</td></tr>)}</tbody>
          </table>
        </div>
        <p class="halkabb" style="margin-top:6px">A költség a tanúsítási módszer szabványos használati feltételeivel számolt végenergiából adódik (20 °C, szabványos HMV-igény, átlagos éghajlat), nem a tényleges számlákból; a valós fogyasztás a használattól függően eltérhet.</p>
      </section>

      <section class="szakasz">
        <h2>Intézkedések</h2>
        <p class="halk">Mindegyik intézkedés hatását önmagában is kiszámolja a program; a bejelölt intézkedések együtt alkotják a felújítási csomagot (a csomag hatása nem egyenlő az egyenkénti hatások összegével). Az egységárak nettók; a megtérülés a bruttó (ÁFA-s) beruházással számol.</p>
        <div class="tabla-gorgeto">
          <table class="tabla felujitas-tabla">
            <thead><tr><th>Csomagban</th><th>Intézkedés</th><th class="szam">Mennyiség</th><th class="szam">Beruházás (bruttó)</th><th class="szam">Megtakarítás/év</th><th class="szam">Ep után</th><th class="szam">Megtérülés</th><th class="szam">Nettó jelenérték</th><th></th></tr></thead>
            <tbody>
              {b.intezkedesek.map((m, i) => {
                const r = egyenkent[i];
                const q = mennyiseg(p, m);
                return <>
                  <tr>
                    <td><input type="checkbox" aria-label="Csomagban" checked={m.aktiv} onChange={(e) => mb((x) => { x.intezkedesek[i]!.aktiv = (e.target as HTMLInputElement).checked; })} /></td>
                    <td style="min-width:220px"><button class="link-gomb" aria-expanded={nyitott === m.id} onClick={() => setNyitott(nyitott === m.id ? null : m.id)}>{m.nev}</button></td>
                    <td class="szam">{sz(q.ertek, q.egyseg === 'db' ? 0 : 1)} {q.egyseg}</td>
                    <td class="szam">{Ft(r?.Ibrutto)}</td>
                    <td class="szam">{Ft(r?.megtakaritas)}</td>
                    <td class="szam">{r?.allapot.e ? `${sz(r.allapot.e.indikatorok.fajlagos.EnrenFajl, 1)} (${r.allapot.e.besorolas.energetikai})` : '–'}</td>
                    <td class="szam">{r ? (r.megterules === null ? 'nem térül meg' : `${sz(r.megterules, 1)} év`) : '–'}</td>
                    <td class="szam" style={r && r.npv < 0 ? 'color:var(--hiba)' : ''}>{Ft(r?.npv)}</td>
                    <td><button class="gomb halk-gomb" onClick={() => mb((x) => { x.intezkedesek.splice(i, 1); })}>Törlés</button></td>
                  </tr>
                  {nyitott === m.id && <tr class="reszlet-sor"><td colSpan={9}><IntezkedesSzerkeszto p={p} m={m} alap={alap} b={b} r={r} mm={(fn) => mb((x) => fn(x.intezkedesek[i]!))} /></td></tr>}
                </>;
              })}
            </tbody>
          </table>
        </div>
        <div class="gombsor" style="margin-top:12px">
          <select value="" aria-label="Intézkedés hozzáadása" onChange={(e) => {
            const v = (e.target as HTMLSelectElement).value;
            if (!v) return;
            mb((x) => { const u = ujIntezkedes(p, v); if (u) x.intezkedesek.push(u); });
            (e.target as HTMLSelectElement).value = '';
          }}>
            <option value="">Intézkedés hozzáadása…</option>
            <optgroup label="Hőszigetelés">{(['fal', 'padlas', 'teto', 'pincefodem', 'padlo'] as Szerep[]).map((s) => <option value={`szig:${s}`}>{SZEREP_NEV[s]}</option>)}</optgroup>
            <optgroup label="Nyílászárók">{NS.NYILASZARO_SABLONOK.filter((s) => s.korszak[1] >= 2026).map((s) => <option value={`ny:${s.kod}`}>{s.nev}</option>)}</optgroup>
            <optgroup label="Fűtés">{FUTES_SZETTEK.map((s) => <option value={`futes:${s.kod}`}>{s.nev}</option>)}</optgroup>
            <optgroup label="Használati melegvíz">{HMV_SZETTEK.map((s) => <option value={`hmv:${s.kod}`}>{s.nev}</option>)}</optgroup>
            <optgroup label="Szellőzés">{SZELLOZES_SZETTEK.map((s) => <option value={`szell:${s.kod}`}>{s.nev}</option>)}</optgroup>
            <optgroup label="Egyéb"><option value="napelem">Napelem</option><option value="legzaras">Légtömörség javítása</option></optgroup>
          </select>
          <button class="gomb halk-gomb" onClick={() => mb((x) => { x.intezkedesek = alapIntezkedesek(p, (k) => egysegar(k)); })}>Javasolt intézkedések visszaállítása</button>
        </div>
      </section>

      {csomag && <CsomagEredmeny alap={alap} r={csomag} b={b} AN={AN} />}

      <section class="szakasz">
        <h2>Árak és pénzügyi feltételek</h2>
        <p class="halk">Alapértékek: {ARAK_DATUM}. Az energiaárak bruttók. Saját ajánlat vagy számla alapján írd át őket.</p>
        <div class="racs">
          <Mezo cim="Földgáz, rezsicsökkentett sáv" sugo={`Sávhatár: ${sz(b.arak.gazSavHatar, 0)} kWh/év`}><Szam ertek={b.arak.gazSav} egyseg="Ft/kWh" valt={(v) => mb((x) => { x.arak.gazSav = v; })} /></Mezo>
          <Mezo cim="Földgáz sávhatár"><Szam ertek={b.arak.gazSavHatar} egyseg="kWh/év" valt={(v) => mb((x) => { x.arak.gazSavHatar = v; })} /></Mezo>
          <Mezo cim="Földgáz a sáv felett"><Szam ertek={b.arak.gazFelett} egyseg="Ft/kWh" valt={(v) => mb((x) => { x.arak.gazFelett = v; })} /></Mezo>
          <Mezo cim="Gáz alap- és rendszerhasználati díj"><Szam ertek={b.arak.gazAlapdij} egyseg="Ft/év" valt={(v) => mb((x) => { x.arak.gazAlapdij = v; })} /></Mezo>
          <Mezo cim="Villamos energia, rezsicsökkentett sáv"><Szam ertek={b.arak.villSav} egyseg="Ft/kWh" valt={(v) => mb((x) => { x.arak.villSav = v; })} /></Mezo>
          <Mezo cim="Villamos sávhatár"><Szam ertek={b.arak.villSavHatar} egyseg="kWh/év" valt={(v) => mb((x) => { x.arak.villSavHatar = v; })} /></Mezo>
          <Mezo cim="Villamos a sáv felett"><Szam ertek={b.arak.villFelett} egyseg="Ft/kWh" valt={(v) => mb((x) => { x.arak.villFelett = v; })} /></Mezo>
          <Mezo cim="H-tarifa (hőszivattyús fűtés)"><Szam ertek={b.arak.villH} egyseg="Ft/kWh" valt={(v) => mb((x) => { x.arak.villH = v; })} /></Mezo>
          <Mezo cim="H-tarifa alkalmazása"><Valaszto ertek={b.arak.hTarifa ? 'igen' : 'nem'} valt={(v) => mb((x) => { x.arak.hTarifa = v === 'igen'; })} opciok={[{ ertek: 'igen', nev: 'Hőszivattyús fűtésre igen' }, { ertek: 'nem', nev: 'Nem' }]} /></Mezo>
          <Mezo cim="Távhő"><Szam ertek={b.arak.tavho} egyseg="Ft/kWh" valt={(v) => mb((x) => { x.arak.tavho = v; })} /></Mezo>
          <Mezo cim="Tűzifa, pellet"><Szam ertek={b.arak.tuzifa} egyseg="Ft/kWh" valt={(v) => mb((x) => { x.arak.tuzifa = v; })} /></Mezo>
          <Mezo cim="Napelemes többlet visszavásárlása"><Szam ertek={b.arak.pvExport} egyseg="Ft/kWh" valt={(v) => mb((x) => { x.arak.pvExport = v; })} /></Mezo>
          <Mezo cim="Napelemes termelés önfogyasztási aránya"><Szam ertek={Math.round(b.arak.pvOnfogyasztas * 100)} egyseg="%" valt={(v) => mb((x) => { x.arak.pvOnfogyasztas = Math.min(Math.max(v, 0), 100) / 100; })} /></Mezo>
          <Mezo cim="Kalkulációs kamatláb"><Szam ertek={b.penzugy.kamat} egyseg="%/év" valt={(v) => mb((x) => { x.penzugy.kamat = v; })} /></Mezo>
          <Mezo cim="Energiaár-emelkedés"><Szam ertek={b.penzugy.energiaArNovekedes} egyseg="%/év" valt={(v) => mb((x) => { x.penzugy.energiaArNovekedes = v; })} /></Mezo>
          <Mezo cim="Vizsgált időszak"><Szam ertek={b.penzugy.idoszak} egyseg="év" valt={(v) => mb((x) => { x.penzugy.idoszak = Math.max(1, Math.round(v)); })} /></Mezo>
          <Mezo cim="ÁFA"><Szam ertek={b.penzugy.afa} egyseg="%" valt={(v) => mb((x) => { x.penzugy.afa = v; })} /></Mezo>
        </div>
        <details class="halkabb" style="margin-top:8px"><summary style="cursor:pointer">Az alapértékek forrásai</summary><p style="margin-top:6px;white-space:pre-line">{b.arak.forras}{'\n'}{EGYSEGAR_FORRAS}</p></details>
        <div class="gombsor" style="margin-top:8px"><button class="gomb halk-gomb" onClick={() => mb((x) => { x.arak = { ...ALAP_ARAK }; x.penzugy = { ...ALAP_PENZUGY }; })}>Alapértékek visszaállítása</button></div>
      </section>
    </>
  );
}

function ujIntezkedes(p: Projekt, v: string): Intezkedes | null {
  const [t, k] = v.split(':') as [string, string | undefined];
  if (t === 'szig' && k) {
    const sz0 = k as Szerep;
    const alap = alapIntezkedesek(p, (x) => egysegar(x)).find((m) => m.tipus === 'szigeteles' && m.szerep === sz0);
    return alap ?? { id: ujId(), tipus: 'szigeteles', nev: `${SZEREP_NEV[sz0]} hőszigetelése`, aktiv: false, szerep: sz0, retegrendIds: p.retegrendek.filter((r) => r.szerep === sz0).map((r) => r.id), anyagId: 'eps80_feher', dCm: 10, arAlap: egysegar(`${sz0}_alap`), arCm: egysegar(`${sz0}_cm`) };
  }
  if (t === 'ny' && k) { const s = NS.NYILASZARO_SABLONOK.find((x) => x.kod === k)!; return { id: ujId(), tipus: 'nyilaszaro', nev: `Ablakcsere: ${s.nev}`, aktiv: false, sablonKod: k, arM2: egysegar(k.includes('3r') ? 'ablak_3r' : 'ablak_2r'), csakAblak: true }; }
  if (t === 'futes' && k) return { id: ujId(), tipus: 'futes', nev: FUTES_SZETTEK.find((s) => s.kod === k)!.nev, aktiv: false, szettKod: k, ar: egysegar(k.startsWith('hsz') ? 'hoszivattyu' : k.startsWith('pellet') ? 'pellet_kazan' : 'kondenz_kazan') };
  if (t === 'hmv' && k) return { id: ujId(), tipus: 'hmv', nev: HMV_SZETTEK.find((s) => s.kod === k)!.nev, aktiv: false, szettKod: k, ar: egysegar(k.includes('napkollektor') ? 'napkollektor' : 'hmv_tarolo') };
  if (t === 'szell' && k) return { id: ujId(), tipus: 'szellozes', nev: SZELLOZES_SZETTEK.find((s) => s.kod === k)!.nev, aktiv: false, szettKod: k, ar: egysegar('hrv') };
  if (t === 'napelem') return { id: ujId(), tipus: 'napelem', nev: 'Napelem', aktiv: false, kWp: 5, arKWp: egysegar('napelem_kwp'), hajlasszog: 35, tajolas: 'D' };
  if (t === 'legzaras') return { id: ujId(), tipus: 'legzaras', nev: 'Légtömörség javítása (tömítés, csatlakozások)', aktiv: false, ar: egysegar('legzaras') };
  return null;
}

function IntezkedesSzerkeszto({ p, m, alap, b, r, mm }: { p: Projekt; m: Intezkedes; alap: Allapot; b: FelujitasBeallitas; r: Ertekeles | undefined; mm: (fn: (m: Intezkedes) => void) => void }) {
  const gorbe = useMemo(() => (m.tipus === 'szigeteles' ? vastagsagGorbe(p, alap, m, b) : null), [p, alap, b, m]);
  return (
    <div style="display:flex;flex-direction:column;gap:10px;padding:6px 0">
      <div class="racs">
        <Mezo cim="Megnevezés" szeles><Szoveg ertek={m.nev} valt={(v) => mm((x) => { x.nev = v; })} /></Mezo>
        {m.tipus === 'szigeteles' && <>
          <Mezo cim="Hőszigetelő anyag">
            <select value={m.anyagId} onChange={(e) => mm((x) => { (x as typeof m).anyagId = (e.target as HTMLSelectElement).value; })}>
              {SZIG_VALASZTEK.map((id) => <option value={id}>{anyag(id)?.nev ?? id} (λ {sz(anyag(id)?.lambda, 3)})</option>)}
            </select>
          </Mezo>
          <Mezo cim="Vastagság"><Szam ertek={m.dCm} egyseg="cm" valt={(v) => mm((x) => { (x as typeof m).dCm = Math.max(1, v); })} /></Mezo>
          <Mezo cim="Alapköltség (anyag + munka, vastagságtól független)" sugo="Ragasztó, háló, dübel, vakolat, állvány, munkadíj; nettó"><Szam ertek={m.arAlap} egyseg="Ft/m²" valt={(v) => mm((x) => { (x as typeof m).arAlap = v; })} /></Mezo>
          <Mezo cim="Hőszigetelés ára centiméterenként" sugo="Nettó"><Szam ertek={m.arCm} egyseg="Ft/m²/cm" valt={(v) => mm((x) => { (x as typeof m).arCm = v; })} /></Mezo>
          <Mezo cim="Érintett szerkezetek" szeles>
            <div style="display:flex;flex-direction:column;gap:2px">
              {p.retegrendek.filter((x) => x.szerep === m.szerep).map((x) => (
                <label class="jelolo"><input type="checkbox" checked={m.retegrendIds.includes(x.id)} onChange={(e) => mm((y) => { const l = new Set((y as typeof m).retegrendIds); if ((e.target as HTMLInputElement).checked) l.add(x.id); else l.delete(x.id); (y as typeof m).retegrendIds = [...l]; })} /> {x.nev}</label>
              ))}
            </div>
          </Mezo>
        </>}
        {m.tipus === 'nyilaszaro' && <>
          <Mezo cim="Új nyílászáró"><Valaszto ertek={m.sablonKod} valt={(v) => mm((x) => { (x as typeof m).sablonKod = v; })} opciok={NS.NYILASZARO_SABLONOK.map((s) => ({ ertek: s.kod, nev: s.nev }))} /></Mezo>
          <Mezo cim="Egységár beépítve" sugo="Nettó, bontással és beépítéssel"><Szam ertek={m.arM2} egyseg="Ft/m²" valt={(v) => mm((x) => { (x as typeof m).arM2 = v; })} /></Mezo>
          <Mezo cim="Ajtók"><Valaszto ertek={m.csakAblak ? 'nem' : 'igen'} valt={(v) => mm((x) => { (x as typeof m).csakAblak = v === 'nem'; })} opciok={[{ ertek: 'nem', nev: 'Csak az ablakok cseréje' }, { ertek: 'igen', nev: 'Az ajtók is' }]} /></Mezo>
        </>}
        {(m.tipus === 'futes' || m.tipus === 'hmv' || m.tipus === 'szellozes' || m.tipus === 'legzaras') && (
          <Mezo cim="Beruházási költség" sugo="Nettó, beépítve"><Szam ertek={m.ar} egyseg="Ft" valt={(v) => mm((x) => { (x as { ar: number }).ar = v; })} /></Mezo>
        )}
        {m.tipus === 'napelem' && <>
          <Mezo cim="Teljesítmény"><Szam ertek={m.kWp} egyseg="kWp" valt={(v) => mm((x) => { (x as typeof m).kWp = v; })} /></Mezo>
          <Mezo cim="Fajlagos ár" sugo="Nettó, beépítve"><Szam ertek={m.arKWp} egyseg="Ft/kWp" valt={(v) => mm((x) => { (x as typeof m).arKWp = v; })} /></Mezo>
          <Mezo cim="Hajlásszög"><Szam ertek={m.hajlasszog} egyseg="°" valt={(v) => mm((x) => { (x as typeof m).hajlasszog = v; })} /></Mezo>
          <Mezo cim="Tájolás"><Valaszto ertek={m.tajolas} valt={(v) => mm((x) => { (x as typeof m).tajolas = v; })} opciok={[{ ertek: 'D', nev: 'Dél' }, { ertek: 'DK_DNy', nev: 'Délkelet / délnyugat' }, { ertek: 'K_Ny', nev: 'Kelet / nyugat' }]} /></Mezo>
        </>}
      </div>
      {r && <p class="halkabb">Nettó beruházás {Ft(beruhazas(p, m))}, éves annuitás {Ft(annuitas(r.Ibrutto, b.penzugy))}, egyszerű megtérülés {r.egyszeru ? `${sz(r.egyszeru, 1)} év` : '–'}.</p>}
      {gorbe && <VastagsagAbra g={gorbe} aktiv={m.tipus === 'szigeteles' ? m.dCm : 0} />}
    </div>
  );
}

/** Nettó jelenérték a hőszigetelés vastagságának függvényében (az Excel adattáblájának megfelelője). */
function VastagsagAbra({ g, aktiv }: { g: { d: number; npv: number; I: number; S: number }[]; aktiv: number }) {
  const W = 520, H = 170, P = 34;
  const max = Math.max(...g.map((x) => x.npv), 0), min = Math.min(...g.map((x) => x.npv), 0);
  const x = (d: number) => P + ((d - g[0]!.d) / (g.at(-1)!.d - g[0]!.d)) * (W - 2 * P);
  const y = (v: number) => H - P / 2 - ((v - min) / Math.max(max - min, 1)) * (H - P);
  const legjobb = g.reduce((a, b) => (b.npv > a.npv ? b : a));
  return (
    <figure style="margin:0">
      <svg viewBox={`0 0 ${W} ${H}`} style="width:100%;max-width:560px" role="img" aria-label={`Nettó jelenérték a vastagság függvényében; legkedvezőbb ${legjobb.d} cm`}>
        <line x1={P} x2={W - P} y1={y(0)} y2={y(0)} stroke="var(--vonal)" />
        <polyline fill="none" stroke="var(--hideg)" stroke-width="2" points={g.map((p) => `${x(p.d)},${y(p.npv)}`).join(' ')} />
        {g.map((p) => <circle cx={x(p.d)} cy={y(p.npv)} r={p.d === legjobb.d ? 4.5 : 2.5} fill={p.d === legjobb.d ? 'var(--megfelel)' : 'var(--hideg)'}><title>{p.d} cm: NPV {Math.round(p.npv).toLocaleString('hu-HU')} Ft</title></circle>)}
        {g.map((p) => <text x={x(p.d)} y={H - 2} text-anchor="middle" font-size="10" fill="var(--tus-3)">{p.d}</text>)}
        <line x1={x(aktiv)} x2={x(aktiv)} y1={8} y2={H - P / 2} stroke="var(--meleg)" stroke-dasharray="3 3" />
      </svg>
      <figcaption class="halkabb">Nettó jelenérték a vastagság (cm) függvényében. Legkedvezőbb: <strong>{legjobb.d} cm</strong> ({Math.round(legjobb.npv).toLocaleString('hu-HU')} Ft); szaggatott vonal: a választott vastagság.</figcaption>
    </figure>
  );
}

function CsomagEredmeny({ alap, r, b, AN }: { alap: Allapot; r: Ertekeles; b: FelujitasBeallitas; AN: number }) {
  const e0 = alap.e!, e1 = r.allapot.e;
  if (!e1 || !r.allapot.koltseg) return <section class="szakasz"><h2>Felújítási csomag</h2><div class="hiba-doboz">{r.allapot.hiba}</div></section>;
  return (
    <section class="szakasz">
      <h2>Felújítási csomag</h2>
      <div class="kartya" style="display:flex;gap:28px;flex-wrap:wrap">
        <div><p class="halkabb">Beruházás</p><h2>{Ft(r.Ibrutto)}</h2><p class="halkabb">nettó {Ft(r.I)} · {sz(r.Ibrutto / AN, 0)} Ft/m²</p></div>
        <div><p class="halkabb">Energetikai jellemző</p><h2>{sz(e0.indikatorok.fajlagos.EnrenFajl, 1)} → {sz(e1.indikatorok.fajlagos.EnrenFajl, 1)}</h2><p class="halkabb">{e0.besorolas.energetikai} → {e1.besorolas.energetikai} · −{sz((1 - e1.indikatorok.fajlagos.EnrenFajl / e0.indikatorok.fajlagos.EnrenFajl) * 100, 0)}%</p></div>
        <div><p class="halkabb">Éves energiaköltség</p><h2>{Ft(alap.koltseg!.osszes)} → {Ft(r.allapot.koltseg.osszes)}</h2><p class="halkabb">megtakarítás {Ft(r.megtakaritas)}/év</p></div>
        <div><p class="halkabb">Megtérülés (diszkontált)</p><h2>{r.megterules === null ? 'nem térül meg' : `${sz(r.megterules, 1)} év`}</h2><p class="halkabb">egyszerű: {r.egyszeru ? `${sz(r.egyszeru, 1)} év` : '–'}</p></div>
        <div><p class="halkabb">Nettó jelenérték ({b.penzugy.idoszak} év)</p><h2 style={r.npv < 0 ? 'color:var(--hiba)' : ''}>{Ft(r.npv)}</h2><p class="halkabb">annuitás {Ft(annuitas(r.Ibrutto, b.penzugy))}/év</p></div>
        <div><p class="halkabb">CO₂-csökkenés</p><h2>{sz(e0.indikatorok.osszes.CO2 - e1.indikatorok.osszes.CO2, 0)} kg/a</h2></div>
      </div>
      <p class="halkabb" style="margin-top:8px">Követelmények a felújítás után: q {e1.kovetelmeny.qmMegfelel ? 'megfelel' : 'nem felel meg'} ({sz(e1.qm, 3)} ≤ {sz(e1.kovetelmeny.qmMax, 3)} W/m³K), jelentős felújítás szintje {e1.kovetelmeny.jelentosFelujitas.teljesul ? 'teljesül' : 'nem teljesül'}, közel nulla szint {e1.kovetelmeny.kozelNulla.teljesul ? 'teljesül' : 'nem teljesül'}. A nettó jelenérték {b.penzugy.kamat}% kamatlábbal és évi {b.penzugy.energiaArNovekedes}% energiaár-emelkedéssel számolt.</p>
    </section>
  );
}
