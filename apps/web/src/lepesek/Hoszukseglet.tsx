import { useMemo, useState } from 'preact/hooks';
import { hoszukseglet as H } from '@mag/index';
import { Mezo, Szam, Valaszto, sz } from '../ui';
import { ujId, hoszuksegletBemenet, hszAlapertek, hszUres, HSZ_ALAP, SZEREP_NEV, retegrendSzamitas, type Projekt, type Helyiseg, type HelyisegHsz } from '../modell';

type Modosit = (fn: (p: Projekt) => void) => void;

const VEDETTSEG_NEV: Record<H.Vedettseg, string> = { nincs: 'Védtelen (szeles, nyílt terep)', mersekelt: 'Mérsékelten védett (beépített környezet)', eros: 'Erősen védett (városközpont)' };
const NYILAS_NEV: Record<H.NyilasSzam, string> = { tobb: 'Több homlokzaton', egy: 'Egy homlokzaton', nincs: 'Nincs külső nyílás' };

export function HoszuksegletLepes({ p, modosit }: { p: Projekt; modosit: Modosit }) {
  const be = { ...HSZ_ALAP, ...p.hoszukseglet };
  const [nyitott, setNyitott] = useState<string | null>(null);
  const { eredmeny, hibak, osszevetes } = useMemo(() => {
    const b = hoszuksegletBemenet(p);
    return { eredmeny: H.helyisegHoszukseglet(b.bemenet), hibak: b.hibak, osszevetes: b.osszevetes };
  }, [p]);
  const mb = (fn: (b: typeof be) => void) => modosit((q) => { q.hoszukseglet = { ...HSZ_ALAP, ...q.hoszukseglet }; fn(q.hoszukseglet); });
  const mh = (id: string, fn: (h: HelyisegHsz, hely: Helyiseg) => void) => modosit((q) => { const h = q.helyisegek.find((x) => x.id === id)!; h.hsz ??= hszUres(); fn(h.hsz, h); });
  const falak = p.retegrendek.filter((r) => r.szerep === 'fal');
  const max = Math.max(1, ...eredmeny.helyisegek.map((h) => h.PhiHL));
  const futott = p.helyisegek.filter((h) => h.kategoria !== 'gyengen_kapcsolt');
  const elteres = (a: number, b: number) => (b > 0 ? Math.abs(a - b) / b : a > 0 ? 1 : 0);

  return (
    <>
      <section class="szakasz">
        <h2>Méretezési alapadatok</h2>
        <p class="halk">Nem része a 9/2023 ÉKM szerinti energetikai számításnak. Az alapértékek a szabvány tájékoztató mellékletéből és a hazai tervezői gyakorlatból valók; a nemzeti melléklet szerinti értékeket ellenőrizd.</p>
        <div class="racs">
          <Mezo cim="Külső méretezési hőmérséklet θe" sugo="Hazai gyakorlatban jellemzően −15 °C"><Szam ertek={be.thetaE} egyseg="°C" valt={(v) => mb((b) => { b.thetaE = v; })} /></Mezo>
          <Mezo cim="Légtömörség n50" sugo="Légtömörség-mérésből; új épületnél 1,5–3, passzívháznál ≤ 0,6"><Szam ertek={be.n50} egyseg="1/h" valt={(v) => mb((b) => { b.n50 = v; })} /></Mezo>
          <Mezo cim="Szél elleni védettség"><Valaszto ertek={be.vedettseg} valt={(v) => mb((b) => { b.vedettseg = v; })} opciok={(Object.keys(VEDETTSEG_NEV) as H.Vedettseg[]).map((k) => ({ ertek: k, nev: VEDETTSEG_NEV[k] }))} /></Mezo>
          <Mezo cim="Talajvíz" ><Valaszto ertek={be.Gw > 1 ? 'kozel' : 'tavol'} valt={(v) => mb((b) => { b.Gw = v === 'kozel' ? 1.15 : 1; })} opciok={[{ ertek: 'tavol', nev: 'Mélyebben, mint 1 m (Gw = 1,0)' }, { ertek: 'kozel', nev: '1 m-en belül (Gw = 1,15)' }]} /></Mezo>
          <Mezo cim="Felfűtési többlet" sugo="Szakaszos fűtésnél; folyamatos üzemnél 0"><Szam ertek={be.fRH} egyseg="W/m²" valt={(v) => mb((b) => { b.fRH = v; })} /></Mezo>
        </div>
        {p.gepeszet.szellozes && <p class="halkabb" style="margin-top:8px">Gépi szellőzés hővisszanyeréssel (ηr = {sz(p.gepeszet.szellozes.etaR * 100, 0)}%): a minimális légcserét a befúvás fedezi, (1 − ηr) arányban terhelve.</p>}
      </section>

      <section class="szakasz">
        <h2>Helyiségek</h2>
        <p class="halk">Add meg helyiségenként a külső fal hosszát, és jelöld, ha a helyiség padlás alatt vagy talajon fekszik. A nyílászárók a Határolás lépésből jönnek (ahol helyiséghez vannak rendelve), és levonódnak a falból.</p>
        {!falak.length && <div class="figyelmeztetes" style="margin-bottom:12px">Nincs homlokzati fal rétegrend. Előbb vegyél fel egyet a Rétegrendek lépésben.</div>}
        <div class="tabla-gorgeto">
          <table class="tabla hsz-tabla">
            <thead>
              <tr><th>Helyiség</th><th class="szam">θint</th><th class="szam">Külső fal</th><th>Padlás / tető</th><th>Talaj</th><th class="szam">ΦT</th><th class="szam">ΦV</th><th class="szam">Hőszükséglet</th><th class="szam">W/m²</th><th></th></tr>
            </thead>
            <tbody>
              {futott.map((h) => {
                const hz = h.hsz ?? hszUres();
                const r = eredmeny.helyisegek.find((x) => x.id === h.id);
                const alap = hszAlapertek(h.nev);
                const nyitva = nyitott === h.id;
                const hossz = hz.kulsoFalak.reduce((s, x) => s + x.hossz, 0);
                return (
                  <>
                    <tr class={nyitva ? 'nyitott' : ''}>
                      <td><button class="link-gomb" aria-expanded={nyitva} onClick={() => setNyitott(nyitva ? null : h.id)}>{h.nev}</button><small class="halkabb" style="display:block">{sz(h.A, 1)} m²</small></td>
                      <td class="szam" style="width:96px"><Szam cimke={`${h.nev} belső hőmérséklet`} ertek={hz.theta ?? alap.theta} egyseg="°C" valt={(v) => mh(h.id, (x) => { x.theta = v; })} /></td>
                      <td class="szam" style="width:110px">
                        {hz.kulsoFalak.length <= 1
                          ? <Szam cimke={`${h.nev} külső fal hossza`} ertek={hossz} egyseg="m" valt={(v) => mh(h.id, (x) => {
                            if (!x.kulsoFalak.length) { if (!falak[0]) return; x.kulsoFalak.push({ id: ujId(), retegrendId: falak[0].id, hossz: v }); } else x.kulsoFalak[0]!.hossz = v;
                            if (v === 0) x.kulsoFalak = [];
                          })} />
                          : <span>{sz(hossz, 2)} m</span>}
                      </td>
                      <td><label class="jelolo"><input type="checkbox" aria-label={`${h.nev} padlás alatt`} checked={hz.padlas} onChange={(e) => mh(h.id, (x) => { x.padlas = (e.target as HTMLInputElement).checked; })} /></label></td>
                      <td><label class="jelolo"><input type="checkbox" aria-label={`${h.nev} talajon`} checked={hz.padlo} onChange={(e) => mh(h.id, (x) => { x.padlo = (e.target as HTMLInputElement).checked; })} /></label></td>
                      <td class="szam">{sz(r?.PhiT, 0)}</td>
                      <td class="szam">{sz(r?.PhiV, 0)}</td>
                      <td class="szam hsz-oszlop">
                        <span class="hsz-sav" style={`width:${((r?.PhiHL ?? 0) / max) * 100}%`} aria-hidden="true" />
                        <strong>{sz(r?.PhiHL, 0)} W</strong>
                      </td>
                      <td class="szam">{sz(r?.fajlagos, 0)}</td>
                      <td><button class="gomb halk-gomb semleges" onClick={() => setNyitott(nyitva ? null : h.id)}>{nyitva ? 'Bezár' : 'Részletek'}</button></td>
                    </tr>
                    {nyitva && (
                      <tr class="hsz-reszlet"><td colSpan={10}>
                        <Reszletek h={h} p={p} r={r} mh={(fn) => mh(h.id, fn)} />
                      </td></tr>
                    )}
                  </>
                );
              })}
            </tbody>
            <tfoot>
              <tr><td>Összesen</td><td /><td class="szam">{sz(osszevetes.falHelyisegek, 1)} m²</td><td class="szam">{sz(osszevetes.padlasHelyisegek, 1)} m²</td><td class="szam">{sz(osszevetes.padloHelyisegek, 1)} m²</td>
                <td class="szam">{sz(eredmeny.PhiT, 0)}</td><td class="szam">{sz(eredmeny.PhiV, 0)}</td><td class="szam"><strong>{sz(eredmeny.osszesen / 1000, 2)} kW</strong></td>
                <td class="szam">{sz(eredmeny.osszesen / Math.max(1, futott.reduce((s, h) => s + h.A, 0)), 0)}</td><td /></tr>
            </tfoot>
          </table>
        </div>
        {hibak.map((x) => <div class="figyelmeztetes" style="margin-top:8px">{x}</div>)}
        {eredmeny.figyelmeztetesek.map((f) => <div class="figyelmeztetes" style="margin-top:8px">{f.uzenet}</div>)}
      </section>

      <section class="szakasz">
        <h2>Összevetés a határolással</h2>
        <p class="halk">A helyiségekhez rendelt felületek összege és az energetikai számítás határoló felületei. Nagy eltérés esetén valamelyik helyiségnél hiányzik vagy kétszer szerepel egy felület.</p>
        <div class="tabla-gorgeto"><table class="tabla" style="max-width:640px">
          <thead><tr><th>Szerkezet</th><th class="szam">Helyiségekben</th><th class="szam">Határolásban</th><th></th></tr></thead>
          <tbody>
            {([['Homlokzati fal (nettó)', osszevetes.falHelyisegek, osszevetes.falHatarolas], ['Padlásfödém / tető', osszevetes.padlasHelyisegek, osszevetes.padlasHatarolas], ['Talajon fekvő padló', osszevetes.padloHelyisegek, osszevetes.padloHatarolas]] as const).map(([n, a, b]) => (
              <tr><td>{n}</td><td class="szam">{sz(a, 1)} m²</td><td class="szam">{sz(b, 1)} m²</td>
                <td>{b === 0 && a === 0 ? '–' : elteres(a, b) <= 0.05 ? <span class="jel jo">egyezik</span> : <span class="jel figy">{sz(elteres(a, b) * 100, 0)}% eltérés</span>}</td></tr>
            ))}
          </tbody>
        </table></div>
        <p class="halkabb" style="margin-top:8px">A hőszükséglet a helyiségek összege ({sz(eredmeny.osszesen / 1000, 2)} kW); a hőtermelő méretezéséhez ez felső becslés, mert az egyidejűséget nem veszi figyelembe.</p>
      </section>
    </>
  );
}

function Reszletek({ h, p, r, mh }: { h: Helyiseg; p: Projekt; r: H.HelyisegHszEredmeny | undefined; mh: (fn: (x: HelyisegHsz, h: Helyiseg) => void) => void }) {
  const hz = h.hsz ?? hszUres();
  const alap = hszAlapertek(h.nev);
  const falak = p.retegrendek.filter((x) => x.szerep === 'fal');
  const tobbiek = p.helyisegek.filter((x) => x.id !== h.id);
  const ablakok = p.feluletek.filter((f) => f.fajta === 'nyilaszaro' && f.helyisegId === h.id);
  const belsoU = p.retegrendek.find((x) => x.szerep === 'belso');
  let alapU = 1.5;
  if (belsoU) { try { alapU = Number(retegrendSzamitas(belsoU).U.toFixed(3)); } catch { /* */ } }
  return (
    <div class="hsz-reszletek">
      <div class="racs">
        <Mezo cim="Minimális légcsere nmin" sugo={`Alapérték (${alap.tipus}): ${String(alap.nmin).replace('.', ',')} 1/h`}><Szam ertek={hz.nmin ?? alap.nmin} egyseg="1/h" valt={(v) => mh((x) => { x.nmin = v; })} /></Mezo>
        <Mezo cim="Külső nyílások"><Valaszto ertek={hz.nyilasok ?? 'auto'} valt={(v) => mh((x) => { x.nyilasok = v === 'auto' ? undefined : v as H.NyilasSzam; })} opciok={[{ ertek: 'auto', nev: 'A nyílászárók alapján' }, ...(Object.keys(NYILAS_NEV) as H.NyilasSzam[]).map((k) => ({ ertek: k, nev: NYILAS_NEV[k] }))]} /></Mezo>
      </div>

      <h3 style="margin:14px 0 6px">Külső falak</h3>
      {hz.kulsoFalak.map((f, i) => (
        <div class="gombsor" style="margin-bottom:6px">
          <div style="min-width:260px;flex:1"><Valaszto cimke="Fal rétegrendje" ertek={f.retegrendId} valt={(v) => mh((x) => { x.kulsoFalak[i]!.retegrendId = v; })} opciok={falak.map((x) => ({ ertek: x.id, nev: x.nev }))} /></div>
          <div style="width:130px"><Szam cimke="Hossz" ertek={f.hossz} egyseg="m" valt={(v) => mh((x) => { x.kulsoFalak[i]!.hossz = v; })} /></div>
          <span class="halkabb">{sz(f.hossz * h.h, 1)} m² bruttó</span>
          <button class="gomb halk-gomb" onClick={() => mh((x) => { x.kulsoFalak.splice(i, 1); })}>Törlés</button>
        </div>
      ))}
      {falak[0] && <button class="gomb" onClick={() => mh((x) => { x.kulsoFalak.push({ id: ujId(), retegrendId: falak[0]!.id, hossz: 0 }); })}>Külső falszakasz</button>}
      <p class="halkabb" style="margin-top:6px">Nyílászárók ebben a helyiségben: {ablakok.length ? ablakok.map((f) => `${f.nev}${(f.darab ?? 1) > 1 ? ` ×${f.darab}` : ''}`).join(', ') : 'nincs hozzárendelve (Határolás lépés, „Helyiség” oszlop)'}.</p>

      <h3 style="margin:14px 0 6px">Eltérő hőmérsékletű szomszédos helyiségek</h3>
      {hz.szomszedok.map((s, i) => (
        <div class="gombsor" style="margin-bottom:6px">
          <div style="min-width:220px;flex:1"><Valaszto cimke="Szomszéd" ertek={s.helyisegId} valt={(v) => mh((x) => { x.szomszedok[i]!.helyisegId = v; })} opciok={tobbiek.map((x) => ({ ertek: x.id, nev: `${x.nev}${x.kategoria === 'gyengen_kapcsolt' ? ' (fűtetlen)' : ` (${sz(x.hsz?.theta ?? hszAlapertek(x.nev).theta, 0)} °C)`}` }))} /></div>
          <div style="width:120px"><Szam cimke="Felület" ertek={s.A} egyseg="m²" valt={(v) => mh((x) => { x.szomszedok[i]!.A = v; })} /></div>
          <div style="width:140px"><Szam cimke="U" ertek={s.U} egyseg="W/m²K" valt={(v) => mh((x) => { x.szomszedok[i]!.U = v; })} /></div>
          <button class="gomb halk-gomb" onClick={() => mh((x) => { x.szomszedok.splice(i, 1); })}>Törlés</button>
        </div>
      ))}
      {tobbiek[0] && <button class="gomb" onClick={() => mh((x) => { x.szomszedok.push({ id: ujId(), helyisegId: tobbiek[0]!.id, A: 8, U: alapU }); })}>Szomszéd hozzáadása</button>}

      {r && (
        <dl class="gep-eredmeny" style="margin-top:14px">
          <div><dt>Külső</dt><dd>{sz(r.HTie, 2)}<span> W/K</span></dd></div>
          <div><dt>Fűtetlen tér</dt><dd>{sz(r.HTiue, 2)}<span> W/K</span></dd></div>
          <div><dt>Talaj</dt><dd>{sz(r.HTig, 2)}<span> W/K</span></dd></div>
          <div><dt>Szomszéd</dt><dd>{sz(r.HTij, 2)}<span> W/K</span></dd></div>
          <div><dt>Infiltráció</dt><dd>{sz(r.Vinf, 1)}<span> m³/h</span></dd></div>
          <div><dt>Minimális légcsere</dt><dd>{sz(r.Vmin, 1)}<span> m³/h</span></dd></div>
          <div><dt>Számított légáram</dt><dd>{sz(r.Vszamitott, 1)}<span> m³/h</span></dd></div>
        </dl>
      )}
      <p class="halkabb" style="margin-top:6px">{SZEREP_NEV.fal}: U a rétegrendből, a határolásban megadott hőhídtényezővel (χ) növelve. Talaj: az egész padló egyenértékű U-ja (MSZ EN ISO 13370), fg1 = 1,45, fg2 = (θint − θm,e)/(θint − θe).</p>
    </div>
  );
}
