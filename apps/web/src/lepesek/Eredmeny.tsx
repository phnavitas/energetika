import { useState } from 'preact/hooks';
import type { EpuletEredmeny } from '@mag/index';
import { feltoltesiXml, XmlKodHianyzik } from '@export/xml';
import { Osztalyskala, HaviMerleg } from '../abrak/Eredmenyabrak';
import { Mezo, Szoveg, sz, kov } from '../ui';
import type { Atalakitas, Geometria, Projekt } from '../modell';
import { jegyzokonyvPdf, base64 } from '../jegyzokonyv';

type Modosit = (fn: (p: Projekt) => void) => void;
const MIN: Record<string, string> = { kivalo: 'kiváló', jo: 'jó', kozepes: 'közepes', gyenge: 'gyenge', rossz: 'rossz' };

type Letoltes = { save: (r: { filename: string; data: string | Blob }) => Promise<unknown> };
declare global { interface Window { claude?: { use: (n: string) => Promise<unknown> } } }

/** Letöltés: megosztott artifact-nézetben a platform mentési párbeszédén át, helyben közvetlen fájlként. */
async function letolt(nev: string, tartalom: string | Uint8Array, tipus: string): Promise<string | null> {
  const adat = typeof tartalom === 'string' ? tartalom : new Blob([tartalom as BlobPart], { type: tipus });
  if (window.claude?.use) {
    const d = (await window.claude.use('downloads')) as Letoltes | null;
    if (d) {
      try { await d.save({ filename: nev, data: adat }); return null; } catch (e) {
        const kod = (e as { code?: string }).code;
        if (kod === 'declined') return null;
        if (kod === 'rejected_extension') return 'Ebben a megosztott nézetben ez a fájltípus nem menthető. Az XML-t a helyben futtatott alkalmazásból töltsd le.';
        return 'A mentés ebben a nézetben nem érhető el.';
      }
    }
  }
  const url = URL.createObjectURL(typeof adat === 'string' ? new Blob([adat], { type: tipus }) : adat);
  const a = document.createElement('a');
  a.href = url; a.download = nev; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return null;
}

export function EredmenyLepes({ p, e, g, atal, hibak, modosit, rogzit }: { p: Projekt; e: EpuletEredmeny | null; g: Geometria; atal: Atalakitas; hibak: string[]; modosit: Modosit; rogzit?: () => Promise<string> }) {
  const [pdfFut, setPdfFut] = useState(false);
  const [xmlHiba, setXmlHiba] = useState<string | null>(null);
  const [rogzitve, setRogzitve] = useState<string | null>(null);
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
    try {
      setPdfFut(true);
      const pdf = base64(await jegyzokonyvPdf(p, e!, atal));
      setPdfFut(false);
      const x = feltoltesiXml(e!, {
        megrendelo: p.meta.megrendelo,
        epuletCim: { iranyitoszam: p.meta.irsz, telepules: p.meta.telepules, kozterulet: p.meta.kozterulet, kozteruletJelleg: p.meta.kozteruletJelleg, epulet: '-', lepcsohaz: '-', emelet: '-', ajto: p.meta.hazszam || '-' },
        hrsz: p.meta.hrsz, tanusitasOka: 'Other', rendeltetes: 'ResidentialBuilding', epuletKategoria: 'SingleFamilyDetachedHome',
        epitesiEv: p.meta.epitesiEv, vedett: false, szintekSzama: p.meta.szintek, kozforgalmu: false, kozTulajdon: false, onalloRendeltetesiEgyseg: false,
        tanusito: { nev: p.tanusito.nev, cim: { iranyitoszam: '', telepules: '', kozterulet: '', kozteruletJelleg: '', hazszam: '' }, telefon: p.tanusito.telefon, email: p.tanusito.email, jogosultsag: p.tanusito.jogosultsag },
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
            </tbody>
            <tfoot><tr><td>Összesen [kWh/m²a, kg/m²a]</td><td class="szam">{sz(ind.fajlagos.EnrenFajl)}</td><td class="szam">{sz(ind.fajlagos.ErenFajl)}</td><td class="szam">{sz(ind.fajlagos.ECO2Fajl)}</td><td /></tr></tfoot>
          </table>
        </div>
      </section>

      <section class="szakasz">
        <h2>Szerkezetek</h2>
        <div class="tabla-gorgeto">
          <table class="tabla">
            <thead><tr><th>Szerkezet</th><th class="szam">Felület</th><th class="szam">U</th><th class="szam">Követelmény</th><th>Minősítés</th></tr></thead>
            <tbody>{e.szerkezetek.map((s) => (
              <tr><td>{s.nev}</td><td class="szam">{sz(s.A, 1)} m²</td><td class="szam">{sz(s.U, 3)}</td><td class="szam">{s.Umax !== null ? kov(s.Umax) : '–'}</td><td>{s.megfelel === false ? <span class="jel rossz">Nem felel meg</span> : s.minosites ? MIN[s.minosites] : '–'}</td></tr>
            ))}</tbody>
          </table>
        </div>
        <p class="halkabb" style="margin-top:8px">U: falaknál és födémeknél a csatlakozási hőhidakkal növelt eredő érték, padlónál a talaj hatását is tartalmazó egyenértékű érték. A követelményt a rétegtervi értékre ellenőrizzük.</p>
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

      <section class="szakasz">
        <h2>Tanúsítvány</h2>
        <p class="halk">A feltöltési fájlhoz a tanúsító adatai, a fotók és a számítási jegyzőkönyv kell; a jegyzőkönyvet a program elkészíti és az XML-be is beágyazza. Az XML jelenleg előnézet: a szerkezete egy elfogadott WinWatt-exportot követ, a Lechner XSD-vel még nem ellenőrzött.</p>
        <div class="racs" style="margin-bottom:12px">
          <Mezo cim="Tanúsító neve"><Szoveg ertek={p.tanusito.nev} valt={(v) => modosit((q) => { q.tanusito.nev = v; })} /></Mezo>
          <Mezo cim="Jogosultság száma"><Szoveg ertek={p.tanusito.jogosultsag} hely="TÉ 00-0000" valt={(v) => modosit((q) => { q.tanusito.jogosultsag = v; })} /></Mezo>
          <Mezo cim="E-mail"><Szoveg ertek={p.tanusito.email} valt={(v) => modosit((q) => { q.tanusito.email = v; })} /></Mezo>
          <Mezo cim="Telefon"><Szoveg ertek={p.tanusito.telefon} valt={(v) => modosit((q) => { q.tanusito.telefon = v; })} /></Mezo>
        </div>
        <div class="gombsor">
          <button class="gomb fo" disabled={pdfFut} onClick={xml}>XML előnézet letöltése</button>
          <button class="gomb" disabled={pdfFut} onClick={async () => {
            setXmlHiba(null); setPdfFut(true);
            try { const b = await jegyzokonyvPdf(p, e, atal); setXmlHiba(await letolt(`${(p.meta.nev || 'projekt').replace(/[^\p{L}\p{N} _-]/gu, '')}-jegyzokonyv.pdf`, b, 'application/pdf')); }
            catch (err) { setXmlHiba(`A jegyzőkönyv nem készült el: ${(err as Error).message}`); }
            finally { setPdfFut(false); }
          }}>{pdfFut ? 'Jegyzőkönyv készül…' : 'Számítási jegyzőkönyv (PDF)'}</button>
          <button class="gomb" onClick={() => letolt(`${(p.meta.nev || 'projekt').replace(/[^\p{L}\p{N} _-]/gu, '')}.json`, JSON.stringify(p, null, 1), 'application/json').then(setXmlHiba)}>Projekt mentése fájlba</button>
        </div>
        {xmlHiba && <div class="hiba-doboz" style="margin-top:12px">{xmlHiba}</div>}
        {rogzitve && <div class="siker-doboz" style="margin-top:12px">{rogzitve}</div>}
      </section>
    </>
  );
}
