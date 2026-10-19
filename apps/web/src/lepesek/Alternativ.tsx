import { useMemo } from 'preact/hooks';
import { Mezo, Szam, sz } from '../ui';
import type { Projekt } from '../modell';
import { ALT_NEV, URLAP, alapAlternativ, alapBeruhazas, alternativVizsgalat, REF_BERUHAZAS_ALAP, type AltKod, type AlternativBeallitas, type AltEredmeny } from '../alternativ';

type Modosit = (fn: (p: Projekt) => void) => void;
const Ft = (x: number | null | undefined) => (x === null || x === undefined || !Number.isFinite(x) ? '–' : `${Math.round(x).toLocaleString('hu-HU')} Ft`);
const IN = ({ e }: { e: boolean | null }) => e === null ? <span class="halkabb">–</span> : <span class={`jel ${e ? 'jo' : 'rossz'}`}>{e ? 'igen' : 'nem'}</span>;

export function AlternativLepes({ p, modosit }: { p: Projekt; modosit: Modosit }) {
  const b = p.alternativ;
  if (!b) {
    return (
      <section class="szakasz">
        <h2>Alternatív rendszerek vizsgálata</h2>
        <p class="halk" style="margin-bottom:12px">Új épület építésénél és meglévő épület jelentős felújításánál a 9/2023. (V. 25.) ÉKM rendelet 5. §-a szerint dokumentáltan vizsgálni kell az alternatív rendszerek (megújuló alapú decentralizált ellátás, kapcsolt energiatermelés, tömb- és távfűtés, hőszivattyú) alkalmazásának lehetőségét műszaki, környezetvédelmi és gazdasági szempontból, a 4. melléklet szerint. A program a változatokat a teljes számítással értékeli, és kitölti a 4.1–4.7. űrlapokat.</p>
        <button class="gomb fo" onClick={() => modosit((q) => { q.alternativ = alapAlternativ(q); })}>Vizsgálat indítása</button>
      </section>
    );
  }
  return <Vizsgalat p={p} b={b} modosit={modosit} />;
}

function Vizsgalat({ p, b, modosit }: { p: Projekt; b: AlternativBeallitas; modosit: Modosit }) {
  const mb = (fn: (x: AlternativBeallitas) => void) => modosit((q) => fn(q.alternativ!));
  const v = useMemo(() => alternativVizsgalat(p, b), [p, b]);
  if (!v.ref || !v.terv) return <section class="szakasz"><h2>Alternatív rendszerek vizsgálata</h2><div class="hiba-doboz">A projekt még nem számolható.</div></section>;
  const alkalmas = v.valtozatok.filter((x) => x.muszakiAlkalmas);
  return (
    <>
      <section class="szakasz">
        <h2>Összefoglaló</h2>
        <p class="halk">Viszonyítási alap (4. melléklet 2.9): az azonos geometriájú és határolású épület a referencia épülettechnikai rendszerrel (kondenzációs gázkazán fűtésre és HMV-re, 5. melléklet), természetes szellőzéssel: <strong>{sz(v.ref.EnrenFajl, 1)} kWh/m²a</strong>. A tervezett rendszerekkel: {sz(v.terv.indikatorok.fajlagos.EnrenFajl, 1)} kWh/m²a.</p>
        <div class="tabla-gorgeto">
          <table class="tabla">
            <thead><tr><th>Alternatív rendszer</th><th class="szam">Ep [kWh/m²a]</th><th>Műszaki-környezeti</th><th class="szam">Beruházási többlet</th><th class="szam">Üzemköltség-csökkenés</th><th class="szam">Egyszerű megtérülés</th><th>Gazdaságos (≤ 10 év)</th></tr></thead>
            <tbody>
              {v.valtozatok.map((x) => (
                <tr>
                  <td>{ALT_NEV[x.kod]}</td>
                  <td class="szam">{x.EnrenFajl === null ? '–' : sz(x.EnrenFajl, 1)}</td>
                  <td><IN e={x.muszakiAlkalmas} /></td>
                  <td class="szam">{x.muszakiAlkalmas ? Ft(x.beruhazasKulonbseg) : '–'}</td>
                  <td class="szam">{x.muszakiAlkalmas ? `${Ft(x.uzemKulonbseg)}/év` : '–'}</td>
                  <td class="szam">{x.muszakiAlkalmas ? (x.megterules === null ? 'nem térül meg' : `${sz(x.megterules, 1)} év`) : '–'}</td>
                  <td><IN e={x.gazdasagos} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p class="halkabb" style="margin-top:8px">{alkalmas.length ? `Műszaki-környezeti szempontból alkalmas: ${alkalmas.map((x) => ALT_NEV[x.kod].replace(/^\d\.\d /, '')).join(', ')}.` : 'Egyik vizsgált változat sem alkalmas műszaki-környezeti szempontból.'} Az üzemköltség az energiaárakból (Felújítás lépés árai, ennek hiányában a 2026-os alapértékek) számolt éves energiaköltség-különbség a referencia rendszerhez képest, karbantartás nélkül.</p>
        <div class="racs" style="margin-top:8px">
          <Mezo cim="A referencia rendszer beruházási költsége (g.2)" sugo="Kondenzációs gázkazán + indirekt HMV-tároló, nettó; alapérték a felújítási egységárakból"><Szam ertek={b.refBeruhazas ?? REF_BERUHAZAS_ALAP()} egyseg="Ft" valt={(x) => mb((y) => { y.refBeruhazas = x; })} /></Mezo>
        </div>
      </section>
      {v.valtozatok.map((x) => <Urlap kod={x.kod} r={x} b={b} mb={mb} />)}
    </>
  );
}

function Urlap({ kod, r, b, mb }: { kod: AltKod; r: AltEredmeny; b: AlternativBeallitas; mb: (fn: (x: AlternativBeallitas) => void) => void }) {
  const a = b.valtozatok[kod] ?? { vizsgalt: true, valaszok: {} };
  const ma = (fn: (x: NonNullable<AlternativBeallitas['valtozatok'][AltKod]>) => void) => mb((y) => { y.valtozatok[kod] ??= { vizsgalt: true, valaszok: {} }; fn(y.valtozatok[kod]!); });
  return (
    <section class="szakasz">
      <h2>{ALT_NEV[kod]}</h2>
      {kod === 'szolaris' && (
        <div class="racs" style="margin-bottom:8px">
          <Mezo cim="Napkollektor bruttó felülete" sugo="Síkkollektor, dél, 45°; 0 = nincs"><Szam ertek={a.kollektorM2 ?? 0} egyseg="m²" valt={(x) => ma((y) => { y.kollektorM2 = x; })} /></Mezo>
          <Mezo cim="Napelem teljesítménye" sugo="13.1. táblázat, dél, 35°; 0 = nincs"><Szam ertek={a.pvKWp ?? 0} egyseg="kWp" valt={(x) => ma((y) => { y.pvKWp = x; })} /></Mezo>
        </div>
      )}
      {kod === 'hoszivattyu' && (
        <div class="racs" style="margin-bottom:8px">
          <Mezo cim="Forrásoldal">
            <select value={a.hszForras ?? 'levego_viz'} onChange={(e) => ma((y) => { y.hszForras = (e.target as HTMLSelectElement).value as 'levego_viz'; })}>
              <option value="levego_viz">Levegő-víz hőszivattyú</option>
              <option value="talaj_viz">Talaj-víz hőszivattyú (szonda)</option>
            </select>
          </Mezo>
        </div>
      )}
      <div class="tabla-gorgeto">
        <table class="tabla urlap-tabla">
          <thead><tr><th style="width:52px">Sor</th><th>Megnevezés</th><th style="width:280px">Érték</th></tr></thead>
          <tbody>
            {URLAP[kod].map((s) => (
              <tr>
                <td>{s.kod}</td>
                <td>{s.nev}{s.egyseg ? ` [${s.egyseg}]` : ''}</td>
                <td>
                  {s.tipus === 'szamolt' ? <strong>{r.szamolt[s.kod] ?? '–'}</strong>
                    : s.tipus === 'in' ? (
                      <select value={a.valaszok[s.kod] ?? ''} onChange={(e) => ma((y) => { y.valaszok[s.kod] = (e.target as HTMLSelectElement).value; })}>
                        <option value="">–</option><option value="I">igen</option><option value="N">nem</option>
                      </select>
                    ) : <input type="text" value={a.valaszok[s.kod] ?? ''} onInput={(e) => ma((y) => { y.valaszok[s.kod] = (e.target as HTMLInputElement).value; })} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {r.hiba && <p class="halkabb" style="margin-top:6px">{r.hiba}</p>}
      {r.muszakiAlkalmas && (
        <div class="tabla-gorgeto" style="margin-top:8px">
          <table class="tabla urlap-tabla">
            <thead><tr><th style="width:52px">Sor</th><th>4.6–4.7 Összehasonlítás és gazdaságossági vizsgálat</th><th style="width:280px">Érték</th></tr></thead>
            <tbody>
              <tr><td>f.1</td><td>Nem megújuló primerenergia-igény alternatív ellátással [kWh/m²a]</td><td><strong>{sz(r.EnrenFajl, 1)}</strong></td></tr>
              <tr><td>g.1</td><td>Az alternatív ellátás beruházási költsége (nettó)</td><td><Szam ertek={a.beruhazas ?? alapBeruhazas(kod, a)} egyseg="Ft" valt={(x) => ma((y) => { y.beruhazas = x; })} /></td></tr>
              <tr><td>g.3</td><td>Beruházási költségkülönbség a referencia rendszerhez</td><td><strong>{Ft(r.beruhazasKulonbseg)}</strong></td></tr>
              <tr><td>g.4</td><td>Éves üzemeltetési költségkülönbség (energiaköltség)</td><td><strong>{Ft(r.uzemKulonbseg)}/év</strong></td></tr>
              <tr><td>g.5</td><td>Egyszerű megtérülési idő</td><td><strong>{r.megterules === null ? 'nem térül meg' : `${sz(r.megterules, 1)} év`}</strong></td></tr>
              <tr><td>g.6</td><td>Gazdaságossági szempontból célszerű (≤ 10 év, 3.6)</td><td><IN e={r.gazdasagos} /></td></tr>
            </tbody>
          </table>
        </div>
      )}
      <Mezo cim="Megjegyzés, indoklás" szeles><textarea rows={2} style="width:100%" value={a.megjegyzes ?? ''} onInput={(e) => ma((y) => { y.megjegyzes = (e.target as HTMLTextAreaElement).value; })} /></Mezo>
    </section>
  );
}
