import { useState } from 'preact/hooks';
import type { EpuletEredmeny } from '@mag/index';
import { feltoltesiXml, XmlKodHianyzik } from '@export/xml';
import { Osztalyskala, HaviMerleg } from '../abrak/Eredmenyabrak';
import { Mezo, Szoveg, sz, kov } from '../ui';
import type { Atalakitas, Geometria, Projekt } from '../modell';
import { jegyzokonyvPdf, base64 } from '../jegyzokonyv';
import { sulyozo } from '@mag/index';
import { TanusitoOsszegzes } from './Tanusito';
import { useProfil, ZAR_SZOVEG } from '../profil';
import { FotokSzakasz } from './Fotok';

type Modosit = (fn: (p: Projekt) => void) => void;
const MIN: Record<string, string> = { kivalo: 'kiváló', jo: 'jó', kozepes: 'közepes', gyenge: 'gyenge', rossz: 'rossz' };

import { letolt, projektFajlba } from '../letoltes';

export function EredmenyLepes({ p, e, g, atal, hibak, modosit, rogzit, resz = 'eredmeny' }: { resz?: 'eredmeny' | 'tanusitvany'; p: Projekt; e: EpuletEredmeny | null; g: Geometria; atal: Atalakitas; hibak: string[]; modosit: Modosit; rogzit?: () => Promise<string> }) {
  const [pdfFut, setPdfFut] = useState(false);
  const [xmlHiba, setXmlHiba] = useState<string | null>(null);
  const [rogzitve, setRogzitve] = useState<string | null>(null);
  const pr = useProfil();
  if (resz === 'tanusitvany') {
    return (
      <>
        <TanusitoOsszegzes t={pr.profil} szerkeszt={pr.szerkeszt} />
        <FotokSzakasz p={p} modosit={modosit} />
        {e ? TANUSITVANY() : <section class="szakasz"><h2>Tanúsítvány</h2><div class="hiba-doboz">A kiadáshoz előbb a számításnak hiánytalannak kell lennie – lásd az Eredmény lépést.</div></section>}
      </>
    );
  }
  if (!e) {
    return (
      <section class="szakasz">
        <h2>Még nem számolható</h2>
        <p class="halk" style="margin-bottom:12px">A számításhoz ezek hiányoznak:</p>
        {hibak.map((h) => <div class="hiba-doboz" style="margin-bottom:6px">{h}</div>)}
      </section>
    );
  }
  const k = e.kovetelmeny;
  const ind = e.indikatorok;
  const sor = (nev: string, ertek: string, max: string, ok: boolean | null) => (
    <tr><td>{nev}</td><td class="szam">{ertek}</td><td class="szam">{max}</td><td>{ok === null ? '–' : <span class={`jel ${ok ? 'jo' : 'rossz'}`}>{ok ? 'Megfelel' : 'Nem felel meg'}</span>}</td></tr>
  );

  async function xml() {
    setXmlHiba(null);
    if (!pr.jogosult) { setXmlHiba(ZAR_SZOVEG); return; }
    if (p.meta.rendeltetes === 'egyeb') { setXmlHiba('Egyéb (nem lakó) rendeltetésű épület e-tanúsítás XML-je még nem készíthető: a rendeltetés és épületkategória XSD-kódjait a Lechner-féle sémából még nem ellenőriztük. A számítási jegyzőkönyv (PDF) elkészíthető.'); return; }
    try {
      setPdfFut(true);
      const pdf = base64(await jegyzokonyvPdf(p, e!, atal));
      setPdfFut(false);
      const x = feltoltesiXml(e!, {
        megrendelo: p.meta.megrendelo,
        epuletCim: { iranyitoszam: p.meta.irsz, telepules: p.meta.telepules, kozterulet: p.meta.kozterulet, kozteruletJelleg: p.meta.kozteruletJelleg, epulet: '-', lepcsohaz: '-', emelet: '-', ajto: p.meta.hazszam || '-' },
        hrsz: p.meta.hrsz, tanusitasOka: 'Other', rendeltetes: 'ResidentialBuilding', epuletKategoria: 'SingleFamilyDetachedHome',
        epitesiEv: p.meta.epitesiEv, vedett: false, szintekSzama: p.meta.szintek, kozforgalmu: false, kozTulajdon: false, onalloRendeltetesiEgyseg: false,
        tanusito: { nev: p.tanusito.nev, cim: p.tanusito.cim ?? { iranyitoszam: '', telepules: '', kozterulet: '', kozteruletJelleg: '', hazszam: '' }, telefon: p.tanusito.telefon, email: p.tanusito.email, jogosultsag: p.tanusito.jogosultsag },
        szoftver: 'ÉKM energetikai számító 0.3 (fejlesztői előnézet)', helysziniSzemle: new Date().toISOString().slice(0, 10),
        fotok: (p.fotok ?? []).map((f) => ({ kategoria: f.kategoria, jpegBase64: f.dataUrl.slice(f.dataUrl.indexOf(',') + 1) })), jegyzokonyvPdfBase64: pdf, alternativEnergiak: e!.rendszerek.some((r) => r.tetelek.some((t) => t.energiahordozo === 'kornyezeti_ho')) ? ['HeatPump'] : [],
      }, { AN: g.AN, V: g.V });
      letolt('tanusitvany-elonezet.xml', x, 'application/xml').then(setXmlHiba);
      setRogzitve(null);
      rogzit?.().then(setRogzitve, (err: Error) => setXmlHiba(`Az XML elkészült, de a számítás rögzítése nem sikerült: ${err.message}`));
    } catch (err) {
      setPdfFut(false);
      setXmlHiba(err instanceof XmlKodHianyzik ? err.message : `Hiba: ${(err as Error).message}`);
    }
  }

  function TANUSITVANY() {
    return (
      <section class="szakasz">
        <h2>Tanúsítvány</h2>
        <p class="halk">A feltöltési fájlhoz a tanúsító adatai, a fotók és a számítási jegyzőkönyv kell; a jegyzőkönyvet a program elkészíti és az XML-be is beágyazza. Az XML jelenleg előnézet: a szerkezete egy elfogadott WinWatt-exportot követ, a Lechner XSD-vel még nem ellenőrzött.</p>
        <div class="gombsor">
          <button class="gomb fo" disabled={pdfFut || !pr.jogosult} title={pr.jogosult ? undefined : ZAR_SZOVEG} onClick={xml}>{pr.jogosult ? '' : '🔒 '}XML előnézet letöltése</button>
          <button class="gomb" disabled={pdfFut || !pr.jogosult} title={pr.jogosult ? undefined : ZAR_SZOVEG} onClick={async () => {
            setXmlHiba(null); setPdfFut(true);
            try { const b = await jegyzokonyvPdf(p, e!, atal); setXmlHiba(await letolt(`${(p.meta.nev || 'projekt').replace(/[^\p{L}\p{N} _-]/gu, '')}-jegyzokonyv.pdf`, b, 'application/pdf')); }
            catch (err) { setXmlHiba(`A jegyzőkönyv nem készült el: ${(err as Error).message}`); }
            finally { setPdfFut(false); }
          }}>{pr.jogosult ? '' : '🔒 '}{pdfFut ? 'Jegyzőkönyv készül…' : 'Számítási jegyzőkönyv (PDF)'}</button>
          <button class="gomb" onClick={() => projektFajlba(p).then(setXmlHiba)}>Projekt mentése fájlba</button>
        </div>
        {!pr.jogosult && <p class="halkabb" style="margin-top:8px;color:var(--figyel)">{ZAR_SZOVEG} <button class="link-gomb" onClick={pr.szerkeszt}>Szám megadása a profilban</button></p>}
        {xmlHiba && <div class="hiba-doboz" style="margin-top:12px">{xmlHiba}</div>}
        {rogzitve && <div class="siker-doboz" style="margin-top:12px">{rogzitve}</div>}
      </section>
    );
  }

  return (
    <>
      <section class="szakasz">
        <div class="ket-kartya">
          <div class="kartya"><Osztalyskala cim="Összesített energetikai jellemző szerinti besorolás" osztaly={e.besorolas.energetikai} szazalek={e.besorolas.energetikaiSzazalek} /></div>
          <div class="kartya"><Osztalyskala cim="Fajlagos CO₂-kibocsátás szerinti besorolás" osztaly={e.besorolas.CO2} szazalek={e.besorolas.CO2Szazalek} /></div>
        </div>
        <p class="halkabb" style="margin-top:8px">A százalék a közel nulla energiaigényű követelményértékhez viszonyít (176/2008 Korm. r. 3. melléklet). A színek szemléltetők.</p>
      </section>

      <section class="szakasz">
        <h2>Követelmények</h2>
        <p class="halk">Közel nulla szint: 2. melléklet. Jelentős felújítás: 3. melléklet. A felület/térfogat arány {sz(e.aV, 3)} m²/m³.</p>
        <table class="tabla">
          <thead><tr><th>Mutató</th><th class="szam">Számított</th><th class="szam">Megengedett</th><th>Eredmény</th></tr></thead>
          <tbody>
            {sor('Fajlagos hőveszteség-tényező q [W/m³K]', sz(e.qm, 3), sz(k.qmMax, 3), k.qmMegfelel)}
            {sor('Összesített energetikai jellemző [kWh/m²a]', sz(ind.fajlagos.EnrenFajl, 2), sz(k.EnrenMax, 2), k.EnrenMegfelel)}
            {e.referenciaEpulet.teljes && <tr><td colSpan={4} class="halkabb">Egyéb rendeltetés: a követelmény az 5. melléklet szerinti referenciaépületből adódik – E<sub>nren,REF</sub> = {sz(e.referenciaEpulet.EnrenFajl, 2)} kWh/m²a, E<sub>CO2,REF</sub> = {sz(e.referenciaEpulet.ECO2Fajl, 2)} kg/m²a; közel nulla: 80%-a (2. melléklet 2.3, 3.3), jelentős felújítás: 100%-a (3. melléklet 2.4).</td></tr>}
            {sor('Fajlagos CO₂-kibocsátás [kg/m²a]', sz(ind.fajlagos.ECO2Fajl, 2), k.ECO2Max !== null ? sz(k.ECO2Max, 2) : '–', k.ECO2Megfelel)}
            {sor('Nyári hővédelem (mutató)', e.nyariHovedelem.mutato === null ? 'nem kell vizsgálni' : sz(e.nyariHovedelem.mutato, 3), e.nyariHovedelem.mutato === null ? `üvegezés ≤ 8% AN` : '0,300', e.nyariHovedelem.megfelel)}
          </tbody>
        </table>
      </section>

      <section class="szakasz">
        <h2>Havi hőmérleg</h2>
        <p class="halk">Nettó fűtési igény {sz(e.qFnet, 2)} kWh/m²a ({sz(e.zonak[0]!.QFnetEv, 0)} kWh/a). Az időállandó {sz(e.zonak[0]!.havi[0]!.tau, 1)} óra.</p>
        <div class="kartya"><HaviMerleg z={e.zonak[0]!} /></div>
      </section>

      <section class="szakasz">
        <h2>Energiafelhasználás</h2>
        <div class="tabla-gorgeto">
          <table class="tabla">
            <thead><tr><th>Felhasználás</th><th class="szam">Nem megújuló</th><th class="szam">Megújuló</th><th class="szam">CO₂</th><th>Rendszerminősítés</th></tr></thead>
            <tbody>
              <tr><td>Fűtés</td><td class="szam">{sz(ind.celonkent.futes.nren / ind.AN)}</td><td class="szam">{sz(ind.celonkent.futes.ren / ind.AN)}</td><td class="szam">{sz(ind.celonkent.futes.CO2 / ind.AN)}</td><td>{e.rendszerErtekeles.futes ? `${MIN[e.rendszerErtekeles.futes.minosites]} (${sz(e.rendszerErtekeles.futes.szazalek, 1)}%)` : '–'}</td></tr>
              <tr><td>Használati melegvíz</td><td class="szam">{sz(ind.celonkent.hmv.nren / ind.AN)}</td><td class="szam">{sz(ind.celonkent.hmv.ren / ind.AN)}</td><td class="szam">{sz(ind.celonkent.hmv.CO2 / ind.AN)}</td><td>{e.rendszerErtekeles.hmv ? `${MIN[e.rendszerErtekeles.hmv.minosites]} (${sz(e.rendszerErtekeles.hmv.szazalek, 1)}%)` : '–'}</td></tr>
              {ind.celonkent.szellozes.tot !== 0 && <tr><td>Gépi szellőzés</td><td class="szam">{sz(ind.celonkent.szellozes.nren / ind.AN)}</td><td class="szam">{sz(ind.celonkent.szellozes.ren / ind.AN)}</td><td class="szam">{sz(ind.celonkent.szellozes.CO2 / ind.AN)}</td><td>–</td></tr>}
              {ind.celonkent.hutes.tot !== 0 && <tr><td>Hűtés</td><td class="szam">{sz(ind.celonkent.hutes.nren / ind.AN)}</td><td class="szam">{sz(ind.celonkent.hutes.ren / ind.AN)}</td><td class="szam">{sz(ind.celonkent.hutes.CO2 / ind.AN)}</td><td>{e.rendszerErtekeles.hutes ? `${MIN[e.rendszerErtekeles.hutes.minosites]} (${sz(e.rendszerErtekeles.hutes.szazalek, 1)}%)` : '–'}</td></tr>}
              {ind.celonkent.vilagitas.tot !== 0 && <tr><td>Beépített világítás</td><td class="szam">{sz(ind.celonkent.vilagitas.nren / ind.AN)}</td><td class="szam">{sz(ind.celonkent.vilagitas.ren / ind.AN)}</td><td class="szam">{sz(ind.celonkent.vilagitas.CO2 / ind.AN)}</td><td>{e.rendszerErtekeles.vilagitas ? `${MIN[e.rendszerErtekeles.vilagitas.minosites]} (${sz(e.rendszerErtekeles.vilagitas.szazalek, 1)}%)` : '–'}</td></tr>}
              {ind.celonkent.export.tot !== 0 && <tr><td>Napelem – exportált energia (levonás)</td><td class="szam">−{sz(ind.celonkent.export.nren / ind.AN)}</td><td class="szam">−{sz(ind.celonkent.export.ren / ind.AN)}</td><td class="szam">−{sz(ind.celonkent.export.CO2 / ind.AN)}</td><td>–</td></tr>}
            </tbody>
            <tfoot><tr><td>Összesen [kWh/m²a, kg/m²a]</td><td class="szam">{sz(ind.fajlagos.EnrenFajl)}</td><td class="szam">{sz(ind.fajlagos.ErenFajl)}</td><td class="szam">{sz(ind.fajlagos.ECO2Fajl)}</td><td /></tr></tfoot>
          </table>
        </div>
      </section>

      {e.napelem.length > 0 && <NapelemEredmeny p={p} e={e} />}

      <section class="szakasz">
        <h2>Szerkezetek</h2>
        <div class="tabla-gorgeto">
          <table class="tabla">
            <thead><tr><th>Szerkezet</th><th class="szam">Felület</th><th class="szam">U rétegtervi</th><th class="szam">Követelmény</th><th class="szam">U eredő</th><th>Minősítés</th></tr></thead>
            <tbody>{e.szerkezetek.map((s) => (
              <tr><td>{s.nev}</td><td class="szam">{sz(s.A, 1)} m²</td><td class="szam">{sz(s.Uelemi, 3)}</td><td class="szam">{s.Umax !== null ? kov(s.Umax) : '–'}</td><td class="szam halkabb">{Math.abs(s.U - s.Uelemi) > 5e-4 ? sz(s.U, 3) : '–'}</td><td>{s.megfelel === false ? <span class="jel rossz">Nem felel meg</span> : s.minosites ? MIN[s.minosites] : '–'}</td></tr>
            ))}</tbody>
          </table>
        </div>
        <p class="halkabb" style="margin-top:8px">A követelményt a rétegtervi U-ra ellenőrizzük. Az eredő U falaknál és födémeknél a csatlakozási hőhidakkal (χ) növelt, padlónál a talaj hatását is tartalmazó egyenértékű érték; a minősítés ehhez készül.</p>
      </section>

      {e.figyelmeztetesek.length > 0 && (
        <section class="szakasz">
          <h2>Figyelmeztetések</h2>
          <p class="halk">Forráshiányok és értelmezések, amelyeket a tanúsítvány előtt érdemes átnézni.</p>
          <div style="display:flex;flex-direction:column;gap:6px">
            {[...new Map(e.figyelmeztetesek.map((f) => [f.kod + f.uzenet, f])).values()].map((f) => <div class="figyelmeztetes">{f.uzenet}<small>{f.forras}</small></div>)}
          </div>
        </section>
      )}

    </>
  );
}

const HO = ['jan', 'feb', 'márc', 'ápr', 'máj', 'jún', 'júl', 'aug', 'szept', 'okt', 'nov', 'dec'];

/** Napelemek összefoglalója: termelés, módszer, fajlagos hozam, levonás hatása, a saját villamos fogyasztás fedezettsége. */
function NapelemEredmeny({ p, e }: { p: Projekt; e: EpuletEredmeny }) {
  const ind = e.indikatorok;
  const W = e.napelem.reduce((s, n) => s + n.W, 0);
  const kWp = p.gepeszet.napelem.reduce((s, n) => s + n.kWp, 0);
  const villamos = ind.vegenergia.villamos ?? 0;
  const fe = sulyozo.SULYOZO.export_halozat, ft = sulyozo.SULYOZO.nap_pv;
  const EnrenNelkul = ind.fajlagos.EnrenFajl + ind.celonkent.export.nren / ind.AN;
  const havi = Array.from({ length: 12 }, (_, i) => p.gepeszet.napelem.reduce((s, n) => s + (n.modszer === 'pvgis' && n.pvgis ? n.pvgis.havi[i]!.E_m : 0), 0));
  const vanHavi = havi.some((x) => x > 0);
  const maxH = Math.max(...havi, 1);
  return (
    <section class="szakasz">
      <h2>Napelem</h2>
      <div class="kartya" style="display:flex;gap:28px;flex-wrap:wrap;margin-bottom:12px">
        <div><p class="halkabb">Beépített teljesítmény</p><h2>{sz(kWp, 2)} kWp</h2></div>
        <div><p class="halkabb">Éves termelés</p><h2>{sz(W, 0)} kWh/a</h2><p class="halkabb">{sz(W / Math.max(kWp, 1e-9), 0)} kWh/kWp · {sz(W / ind.AN, 1)} kWh/m²a</p></div>
        <div><p class="halkabb">Az épület villamos végenergiája</p><h2>{sz(villamos, 0)} kWh/a</h2><p class="halkabb">a termelés ennek {villamos > 0 ? sz((W / villamos) * 100, 0) : '–'}%-a</p></div>
        <div><p class="halkabb">Összesített energetikai jellemző</p><h2>{sz(EnrenNelkul, 1)} → {sz(ind.fajlagos.EnrenFajl, 1)}</h2><p class="halkabb">napelem nélkül → napelemmel, kWh/m²a</p></div>
        <div><p class="halkabb">CO₂-csökkenés</p><h2>{sz(ind.celonkent.export.CO2, 0)} kg/a</h2><p class="halkabb">{sz(ind.celonkent.export.CO2 / ind.AN, 1)} kg/m²a</p></div>
      </div>
      <div class="tabla-gorgeto">
        <table class="tabla">
          <thead><tr><th>Mező</th><th class="szam">kWp</th><th>Tájolás, dőlés</th><th>Módszer</th><th class="szam">Termelés</th><th class="szam">Fajlagos</th></tr></thead>
          <tbody>
            {p.gepeszet.napelem.map((n, i) => (
              <tr>
                <td>{n.nev}</td><td class="szam">{sz(n.kWp, 2)}</td>
                <td>{n.modszer === 'pvgis' ? `azimut ${n.azimut ?? 0}°` : n.tajolas.replace('_', '/')}, {n.hajlasszog}°</td>
                <td>{n.modszer === 'pvgis' ? `PVGIS 5.3${n.pvgis?.meteo.sugarzasDb ? ` (${n.pvgis.meteo.sugarzasDb})` : ''}, 13.2.2` : '13.1. táblázat (egyszerűsített)'}</td>
                <td class="szam">{sz(e.napelem[i]?.W, 0)} kWh/a</td>
                <td class="szam">{sz((e.napelem[i]?.W ?? 0) / Math.max(n.kWp, 1e-9), 0)} kWh/kWp</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {vanHavi && (
        <div class="kartya pv-havi" style="margin-top:12px" role="img" aria-label="Havi napelemes termelés a PVGIS szerint">
          {havi.map((x, i) => (
            <div class="pv-oszlop"><span class="pv-ertek">{sz(x, 0)}</span><span class="pv-sav" style={`height:${(x / maxH) * 100}%`} /><span class="halkabb">{HO[i]}</span></div>
          ))}
        </div>
      )}
      <p class="halkabb" style="margin-top:8px">Elszámolás: a teljes termelés exportáltként számít (1. függ. 13.1, 14.7): levonás = W · (f<sub>exp</sub> − f<sub>PV</sub>), nem megújuló primerenergiára {sz(fe.fnren - ft.fnren, 1)}, CO₂-re {sz((fe.fCO2 - ft.fCO2) / 1000, 3)} kg/kWh súlyozással (7. melléklet). {vanHavi ? 'A havi bontás csak a PVGIS-szel számolt mezőket tartalmazza.' : ''}</p>
    </section>
  );
}
