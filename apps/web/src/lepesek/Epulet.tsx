import { useState } from 'preact/hooks';
import { panel, epuletfizika } from '@mag/index';
import { Mezo, Szoveg, Szam, Valaszto, sz } from '../ui';
import { ujId, type Projekt } from '../modell';

type Modosit = (fn: (p: Projekt) => void) => void;

const CSOPORTOK = [
  { ertek: 'panel', nev: 'Panelház (házgyári vasbeton szendvicspanel)', elerheto: true },
  { ertek: 'kockahaz', nev: 'Kockaház (1960–80)', elerheto: false },
  { ertek: 'blokkos', nev: 'Blokkos társasház', elerheto: false },
  { ertek: 'parasztház', nev: 'Hagyományos parasztház', elerheto: false },
  { ertek: 'polgari', nev: 'Polgári bérház', elerheto: false },
] as const;

export function EpuletLepes({ p, modosit }: { p: Projekt; modosit: Modosit }) {
  const m = p.meta;
  const [csoport, setCsoport] = useState<string>('panel');
  const [panelId, setPanelId] = useState<string>('');
  const [kieg, setKieg] = useState<number>(0);
  const tipusok = panel.PANEL_TIPUSOK.filter((t) => m.epitesiEv >= t.gyartasKezdete - 1 && m.epitesiEv <= (t.gyartasVege ?? 1995) + 1);
  const valasztott = panel.PANEL_TIPUSOK.find((t) => t.id === panelId);

  function betolt() {
    if (!valasztott) return;
    const U = valasztott.U[panel.KIEGESZITO_HOSZIGETELES_CM.indexOf(kieg as 0)]!;
    const R = 1 / U - 0.13 - 0.04;
    const vastagsag = parseFloat(valasztott.vastagsag.teljes) / 10 + kieg;
    modosit((q) => {
      q.meta.epulettipus = valasztott.id;
      q.retegrendek.push({
        id: ujId(), nev: `Panel – ${valasztott.uzem} ${valasztott.gyartasKezdete}–${valasztott.gyartasVege ?? ''}${kieg ? `, +${kieg} cm utólagos hőszigetelés` : ''}`,
        szerep: 'fal', kovetelmenyKod: 'homlokzati_fal', hoaramIrany: 'vizszintes', kulsoOldal: 'kulso',
        retegek: [{ id: ujId(), nev: `Vasbeton szendvicspanel – 2. függ. 4.6. táblázat, U = ${U} W/m²K`, dCm: vastagsag, R }],
      });
    });
  }

  return (
    <>
      <section class="szakasz">
        <h2>Az épület</h2>
        <p class="halk">A tanúsítvány fejlécéhez és a követelményszint megállapításához.</p>
        <div class="racs">
          <Mezo cim="Megnevezés" szeles><Szoveg ertek={m.nev} valt={(v) => modosit((q) => { q.meta.nev = v; })} /></Mezo>
          <Mezo cim="Megrendelő"><Szoveg ertek={m.megrendelo} valt={(v) => modosit((q) => { q.meta.megrendelo = v; })} /></Mezo>
          <Mezo cim="Irányítószám"><Szoveg ertek={m.irsz} valt={(v) => modosit((q) => { q.meta.irsz = v; })} /></Mezo>
          <Mezo cim="Település"><Szoveg ertek={m.telepules} valt={(v) => modosit((q) => { q.meta.telepules = v; })} /></Mezo>
          <Mezo cim="Közterület"><Szoveg ertek={m.kozterulet} valt={(v) => modosit((q) => { q.meta.kozterulet = v; })} /></Mezo>
          <Mezo cim="Házszám"><Szoveg ertek={m.hazszam} valt={(v) => modosit((q) => { q.meta.hazszam = v; })} /></Mezo>
          <Mezo cim="Helyrajzi szám"><Szoveg ertek={m.hrsz} valt={(v) => modosit((q) => { q.meta.hrsz = v; })} /></Mezo>
        </div>
      </section>

      <section class="szakasz">
        <h2>Rendeltetés és követelmény</h2>
        <p class="halk">Lakóépületre a referenciaérték rögzített (95 kWh/m²a, 25 kg/m²a); a HMV nettó igényt a rendeltetés határozza meg.</p>
        <div class="racs">
          <Mezo cim="Épülettípus" sugo={`HMV nettó igény: ${epuletfizika.HMV_LAKO[m.kategoria]} kWh/m²a (2. függ. 2.2.)`}>
            <Valaszto ertek={m.kategoria} valt={(v) => modosit((q) => { q.meta.kategoria = v; })} opciok={[{ ertek: 'csaladi_haz', nev: 'Családi ház' }, { ertek: 'egyeb_lakoepulet', nev: 'Egyéb lakóépület (társasház, lakás)' }]} />
          </Mezo>
          <Mezo cim="Követelményszint">
            <Valaszto ertek={m.kovetelmenySzint} valt={(v) => modosit((q) => { q.meta.kovetelmenySzint = v; })} opciok={[
              { ertek: 'kozel_nulla', nev: 'Új épület – közel nulla (2. melléklet)' },
              { ertek: 'jelentos_felujitas', nev: 'Jelentős felújítás (3. melléklet)' },
              { ertek: 'meglevo', nev: 'Meglévő épület tanúsítása' },
            ]} />
          </Mezo>
          <Mezo cim="Építés éve"><Szam ertek={m.epitesiEv} valt={(v) => modosit((q) => { q.meta.epitesiEv = Math.round(v); })} lepes={1} /></Mezo>
          <Mezo cim="Szintek száma"><Szam ertek={m.szintek} valt={(v) => modosit((q) => { q.meta.szintek = Math.max(1, Math.round(v)); })} lepes={1} min={1} /></Mezo>
        </div>
      </section>

      <section class="szakasz">
        <h2>Meglévő épület: tipikus szerkezetek</h2>
        <p class="halk">Az építés éve alapján javasolt szerkezetek, amelyeket a rétegrendeknél tovább szerkeszthetsz. Jelenleg a panelos épületekhez van hivatalos forrás (2. függelék 4.6. táblázat); a többi épülettípushoz forrást kell választani.</p>
        <div class="racs">
          <Mezo cim="Épületcsoport">
            <select value={csoport} onChange={(e) => setCsoport((e.target as HTMLSelectElement).value)}>
              {CSOPORTOK.map((c) => <option value={c.ertek} disabled={!c.elerheto}>{c.nev}{c.elerheto ? '' : ' – forrás szükséges'}</option>)}
            </select>
          </Mezo>
          <Mezo cim="Házgyár és gyártási időszak" sugo={tipusok.length ? `${tipusok.length} típus illik ${m.epitesiEv}-hez` : 'Az építés évéhez nincs illő panel típus'}>
            <select value={panelId} onChange={(e) => setPanelId((e.target as HTMLSelectElement).value)}>
              <option value="">Válassz…</option>
              {tipusok.map((t) => <option value={t.id}>{t.uzem}, {t.gyartasKezdete}–{t.gyartasVege ?? ''} ({t.hoszigeteles}, {t.vastagsag.hoszigeteles} mm)</option>)}
            </select>
          </Mezo>
          <Mezo cim="Utólagos hőszigetelés">
            <Valaszto ertek={String(kieg)} valt={(v) => setKieg(Number(v))} opciok={panel.KIEGESZITO_HOSZIGETELES_CM.map((c) => ({ ertek: String(c), nev: c === 0 ? 'Nincs' : `${c} cm` }))} />
          </Mezo>
        </div>
        {valasztott && (
          <div class="kartya" style="margin-top:16px;display:flex;justify-content:space-between;gap:16px;align-items:center;flex-wrap:wrap">
            <div>
              <h3>U = {sz(valasztott.U[panel.KIEGESZITO_HOSZIGETELES_CM.indexOf(kieg as 0)], 3)} W/m²K</h3>
              <p class="halkabb">Az elemen belüli hőhidakkal, a csatlakozási hőhidak nélkül. Példák: {panel.PANEL_UZEM_LAKOTELEPEK[valasztott.uzem]}</p>
            </div>
            <button class="gomb fo" onClick={betolt}>Homlokzati fal felvétele</button>
          </div>
        )}
      </section>
    </>
  );
}
