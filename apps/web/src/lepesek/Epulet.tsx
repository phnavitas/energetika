import { useState } from 'preact/hooks';
import { panel, epuletfizika, tipologia as TP } from '@mag/index';
import { Mezo, Szoveg, Szam, Valaszto, sz } from '../ui';
import { ujId, type Projekt } from '../modell';
import { tipologiaRetegrend, SZIG_VALASZTEK, type SzigBeallitas } from '../tipologiaRetegek';
import { anyag } from '../katalogus';

type Modosit = (fn: (p: Projekt) => void) => void;

const CSOPORTOK = [
  { ertek: 'csaladi_haz', nev: 'Családi ház (TABULA HU)', elerheto: true },
  { ertek: 'paraszthaz', nev: 'Hagyományos parasztház, vályog (TABULA HU)', elerheto: true },
  { ertek: 'tarsashaz', nev: 'Társasház, hagyományos technológia (TABULA HU)', elerheto: true },
  { ertek: 'polgari', nev: 'Polgári bérház, 1945 előtt (TABULA HU)', elerheto: true },
  { ertek: 'nagy_tarsashaz', nev: 'Nagy társasház, nem panel (TABULA HU, 2006 után)', elerheto: true },
  { ertek: 'panel', nev: 'Panelház (9/2023 ÉKM 2. függ. 4.6. táblázat)', elerheto: true },
  { ertek: 'sorhaz', nev: 'Sorház, ikerház', elerheto: false },
] as const;

export function EpuletLepes({ p, modosit }: { p: Projekt; modosit: Modosit }) {
  const m = p.meta;
  const [csoport, setCsoport] = useState<string>(m.kategoria === 'csaladi_haz' ? 'csaladi_haz' : 'tarsashaz');
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
          <Mezo rovid cim="Irányítószám"><Szoveg ertek={m.irsz} valt={(v) => modosit((q) => { q.meta.irsz = v; })} /></Mezo>
          <Mezo cim="Település"><Szoveg ertek={m.telepules} valt={(v) => modosit((q) => { q.meta.telepules = v; })} /></Mezo>
          <Mezo cim="Közterület"><Szoveg ertek={m.kozterulet} valt={(v) => modosit((q) => { q.meta.kozterulet = v; })} /></Mezo>
          <Mezo rovid cim="Házszám"><Szoveg ertek={m.hazszam} valt={(v) => modosit((q) => { q.meta.hazszam = v; })} /></Mezo>
          <Mezo rovid cim="Helyrajzi szám"><Szoveg ertek={m.hrsz} valt={(v) => modosit((q) => { q.meta.hrsz = v; })} /></Mezo>
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

      <details class="szakasz osszecsukhato" open={m.kovetelmenySzint !== 'kozel_nulla'}>
        <summary><h2>Meglévő épület: tipikus szerkezetek</h2>{m.kovetelmenySzint === 'kozel_nulla' && <span class="halkabb">új épületnél nem szükséges – kattints a megnyitáshoz</span>}</summary>
        <p class="halk">Az építés éve alapján javasolt szerkezetek, amelyeket a rétegrendeknél és a nyílászáróknál tovább szerkeszthetsz. Panelházakra a rendelet 2. függelékének 4.6. táblázata, a többi épületcsoportra a magyar TABULA lakóépület-tipológia (BME, 2014) a forrás.</p>
        <div class="racs">
          <Mezo cim="Épületcsoport">
            <select value={csoport} onChange={(e) => setCsoport((e.target as HTMLSelectElement).value)}>
              {CSOPORTOK.map((c) => <option value={c.ertek} disabled={!c.elerheto}>{c.nev}{c.elerheto ? '' : ' – forrás szükséges'}</option>)}
            </select>
          </Mezo>
        </div>
        {csoport !== 'panel' ? <TipologiaValaszto csoport={csoport as TP.TipologiaCsoport} ev={m.epitesiEv} modosit={modosit} /> : <div class="racs" style="margin-top:12px">
          <Mezo cim="Házgyár és gyártási időszak" sugo={tipusok.length ? `${tipusok.length} típus illik ${m.epitesiEv}-hez` : 'Az építés évéhez nincs illő panel típus'}>
            <select value={panelId} onChange={(e) => setPanelId((e.target as HTMLSelectElement).value)}>
              <option value="">Válassz…</option>
              {tipusok.map((t) => <option value={t.id}>{t.uzem}, {t.gyartasKezdete}–{t.gyartasVege ?? ''} ({t.hoszigeteles}, {t.vastagsag.hoszigeteles} mm)</option>)}
            </select>
          </Mezo>
          <Mezo cim="Utólagos hőszigetelés">
            <Valaszto ertek={String(kieg)} valt={(v) => setKieg(Number(v))} opciok={panel.KIEGESZITO_HOSZIGETELES_CM.map((c) => ({ ertek: String(c), nev: c === 0 ? 'Nincs' : `${c} cm` }))} />
          </Mezo>
        </div>}
        {csoport === 'panel' && valasztott && (
          <div class="kartya" style="margin-top:16px;display:flex;justify-content:space-between;gap:16px;align-items:center;flex-wrap:wrap">
            <div>
              <h3>U = {sz(valasztott.U[panel.KIEGESZITO_HOSZIGETELES_CM.indexOf(kieg as 0)], 3)} W/m²K</h3>
              <p class="halkabb">Az elemen belüli hőhidakkal, a csatlakozási hőhidak nélkül. Példák: {panel.PANEL_UZEM_LAKOTELEPEK[valasztott.uzem]}</p>
            </div>
            <button class="gomb fo" onClick={betolt}>Homlokzati fal felvétele</button>
          </div>
        )}
      </details>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// TABULA tipológia

const SZEREP_FELIRAT: Record<TP.TipologiaSzerep, string> = { fal: 'Homlokzati fal', padlasfodem: 'Padlásfödém', 'magastető': 'Magastető, tetőtér', 'lapostető': 'Lapostető', padlo_talajon: 'Talajon fekvő padló', pince_feletti_fodem: 'Pince feletti födém', ablak: 'Ablak', ajto: 'Bejárati ajtó' };

/** A szerkezet új hőszigetelő rétegének forrás szerinti vastagsága (ha van). */
function szigForras(sz0: TP.TipologiaSzerkezet): number | null {
  const r = sz0.retegek.find((x) => /kőzetgyapot|ásványgyapot|polisztirol|hőszigetelés|pir/i.test(x.nev) && x.dCm);
  return r?.dCm ?? null;
}

/** Tipológiai szerkezet felvétele: opak szerkezet valódi rétegekkel, nyílászáró kézi Uw-vel. */
function tipologiaFelvetel(q: Projekt, t: TP.TipologiaTipus, valtozat: string, sz0: TP.TipologiaSzerkezet, szig?: SzigBeallitas) {
  const cimke = `${t.kod.replace('HU.N.', '')}, ${TP.VALTOZAT_NEV[valtozat as keyof typeof TP.VALTOZAT_NEV]}`;
  if (sz0.szerep === 'ablak' || sz0.szerep === 'ajto') {
    const ablak = sz0.szerep === 'ablak';
    q.nyilaszarok.push({
      id: ujId(), nev: `${ablak ? 'Ablak' : 'Bejárati ajtó'} – ${sz0.leiras} (${cimke})`, kovetelmenyKod: ablak ? 'ablak_fa_pvc' : 'ajto',
      szelesseg: ablak ? 1.2 : 1.0, magassag: ablak ? 1.5 : 2.1, uwKezi: sz0.U, keretarany: ablak ? (t.korszak[1] !== null && t.korszak[1] < 1990 ? 0.25 : 0.3) : undefined,
      gn: ablak ? sz0.g ?? (sz0.U >= 2.5 ? 0.75 : sz0.U >= 1.3 ? 0.6 : 0.5) : 0,
    } as Projekt['nyilaszarok'][number]);
    return;
  }
  q.retegrendek.push(tipologiaRetegrend(t, sz0, cimke, szig).r);
}

function TipologiaValaszto({ csoport, ev, modosit }: { csoport: TP.TipologiaCsoport; ev: number; modosit: Modosit }) {
  const tipusok = TP.tipusokCsoportban(csoport, ev);
  const [kod, setKod] = useState<string>('');
  const [valtozat, setValtozat] = useState<string>('eredeti');
  const [felveve, setFelveve] = useState<string[]>([]);
  const [szigek, setSzigek] = useState<Record<string, SzigBeallitas>>({});
  const t = (tipusok.find((x) => x.tipus.kod === kod) ?? tipusok[0])?.tipus;
  if (!t) return <p class="halk" style="margin-top:12px">Ehhez a csoporthoz nincs forrásadat.</p>;
  const valtozatok = ['eredeti', ...t.valtozatok.map((v) => v.szint)];
  const v = valtozatok.includes(valtozat) ? valtozat : 'eredeti';
  const szerkezetek = v === 'eredeti' ? t.szerkezetek : t.valtozatok.find((x) => x.szint === v)!.szerkezetek;
  const kulcs = (x: TP.TipologiaSzerkezet) => `${t.kod}|${v}|${x.szerep}|${x.leiras}`;
  const felvesz = (lista: TP.TipologiaSzerkezet[]) => { modosit((q) => { for (const x of lista) tipologiaFelvetel(q, t, v, x, szigek[kulcs(x)]); }); setFelveve((f) => [...f, ...lista.map(kulcs)]); };
  const cimke = `${t.kod.replace('HU.N.', '')}, ${TP.VALTOZAT_NEV[v as keyof typeof TP.VALTOZAT_NEV]}`;
  const illik = tipusok.find((x) => x.tipus.kod === t.kod)?.illik;
  return (
    <div style="margin-top:12px;display:flex;flex-direction:column;gap:12px">
      <div class="racs">
        <Mezo cim="Típus" sugo={illik ? `Illik az építés évéhez (${ev})` : `Nem illik az építés évéhez (${ev})`}>
          <select value={t.kod} onChange={(e) => setKod((e.target as HTMLSelectElement).value)}>
            {tipusok.map(({ tipus, illik: i }) => <option value={tipus.kod}>{i ? '★ ' : ''}{tipus.nev} ({tipus.korszak[0] ?? '…'}–{tipus.korszak[1] ?? 'napjainkig'})</option>)}
          </select>
        </Mezo>
        <Mezo cim="Állapot">
          <Valaszto ertek={v} valt={setValtozat} opciok={valtozatok.map((x) => ({ ertek: x, nev: TP.VALTOZAT_NEV[x as keyof typeof TP.VALTOZAT_NEV] }))} />
        </Mezo>
      </div>
      <p class="halkabb">{t.leiras}</p>
      <div class="tabla-gorgeto">
        <table class="tabla">
          <thead><tr><th>Szerkezet</th><th>Leírás, rétegek</th><th>Hőszigetelés</th><th class="szam">U forrás / rétegekből</th><th>Forrás</th><th></th></tr></thead>
          <tbody>
            {szerkezetek.map((x) => (
              <tr>
                <td>{SZEREP_FELIRAT[x.szerep]}</td>
                <td style="min-width:220px">{x.leiras}{x.retegek.length > 0 && <div class="halkabb">{x.retegek.map((r) => `${r.nev}${r.dCm ? ` ${String(r.dCm).replace('.', ',')} cm` : ''}`).join(' · ')}</div>}{x.megjegyzes && <div class="halkabb" style="color:var(--figyel)">{x.megjegyzes}</div>}</td>
                <td style="min-width:200px">{(() => {
                  const d0 = szigForras(x);
                  if (d0 === null || x.szerep === 'ablak' || x.szerep === 'ajto') return <span class="halkabb">–</span>;
                  const b = szigek[kulcs(x)] ?? {};
                  const sz1 = (u: SzigBeallitas) => setSzigek((o) => ({ ...o, [kulcs(x)]: { ...b, ...u } }));
                  const alap = tipologiaRetegrend(t, x, cimke).r.retegek.find((r) => SZIG_VALASZTEK.includes(r.anyagId ?? ''))?.anyagId;
                  return (
                    <div style="display:flex;flex-direction:column;gap:4px">
                      <select aria-label="Hőszigetelés anyaga" value={b.anyagId ?? alap ?? ''} disabled={felveve.includes(kulcs(x))} onChange={(e) => sz1({ anyagId: (e.target as HTMLSelectElement).value })}>
                        {SZIG_VALASZTEK.map((id) => <option value={id}>{anyag(id)?.nev ?? id}</option>)}
                      </select>
                      <Szam cimke="Hőszigetelés vastagsága" ertek={b.dCm ?? d0} egyseg="cm" valt={(n) => sz1({ dCm: n > 0 ? n : undefined })} />
                    </div>
                  );
                })()}</td>
                <td class="szam">{sz(x.U, 2)}{(() => {
                  if (x.szerep === 'ablak' || x.szerep === 'ajto') return x.g !== undefined && <div class="halkabb">g {sz(x.g, 2)}</div>;
                  try { const e = tipologiaRetegrend(t, x, cimke, szigek[kulcs(x)]); const elter = Math.abs(e.Uszamolt - x.U) / x.U > 0.2; return <div class="halkabb" style={elter ? 'color:var(--figyel)' : ''} title={elter ? 'Jelentős eltérés a forrástól: a forrás rétegrendje hiányos (pl. fagerendák) vagy más λ-val számolt; ellenőrizd a rétegeket' : e.visszaszamolt ? 'Egy réteg λ-ja a forrás eredeti U-értékéből visszaszámolt' : 'A katalógus λ-értékeiből'}>{sz(e.Uszamolt, 2)}{e.visszaszamolt ? '*' : ''}{elter ? ' !' : ''}</div>; } catch { return null; }
                })()}</td>
                <td class="halkabb" style="min-width:120px">{x.forras.replace('tabula_hu_2014', 'TABULA HU brosúra').replace('tabula_calc_db', 'TABULA adatbázis')}</td>
                <td><button class="gomb" disabled={felveve.includes(kulcs(x))} onClick={() => felvesz([x])}>{felveve.includes(kulcs(x)) ? 'Felvéve' : 'Felvétel'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div class="gombsor">
        <button class="gomb fo" onClick={() => felvesz(szerkezetek.filter((x) => !felveve.includes(kulcs(x))))}>Összes felvétele</button>
        <span class="halkabb">Az opak szerkezetek valódi rétegekkel kerülnek a rétegrendek közé: anyag, vastagság és λ a beépített katalógusból, a hőszigetelés anyaga és vastagsága itt is állítható. A forrás és a rétegekből számolt U közti eltérést a katalógus λ-értékei okozzák. *: egy réteg anyagára (pl. B30 blokk, régi hőszigetelő blokk) nincs ellenőrizhető λ, ezért a forrás eredeti U-értékéből visszaszámolt egyenértékű λ-t kap. A nyílászárók gyártói (kézi) Uw-vel kerülnek be; a felületeket a Határolásnál kell hozzájuk rendelni.</span>
      </div>
    </div>
  );
}
