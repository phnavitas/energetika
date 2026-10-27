import { useState } from 'preact/hooks';
import { kovetelmeny, szerkezetSablon as SS } from '@mag/index';
import { Metszet } from '../abrak/Metszet';
import { GlaserAbra } from '../abrak/Glaser';
import { glaser, muAlap, GLASER_ALAP, type GlaserFeltetel } from '../paradiffuzio';
import { useTavoli, KonyvtarbaGomb } from '../fiok';
import { retegrendKonyvtarba } from '../tarolo';
import { anyagLista, anyag, beepitett } from '../katalogus';
import { Mezo, Szam, Szoveg, Valaszto, sz, kov, OsszesTorles } from '../ui';
import { Fogantyu, huzasProps } from '../huzas';
import { ujId, retegrendSzamitas, retegrendVastagsag, retegrendAutoNev, SZEREP_ALAP, SZEREP_NEV, kovetelmenyNev, type Projekt, type Retegrend, type Szerep, retegrendHibak } from '../modell';

type Modosit = (fn: (p: Projekt) => void) => void;

const MINOSITES_NEV: Record<kovetelmeny.Minosites, string> = { kivalo: 'Kiváló', jo: 'Jó', kozepes: 'Közepes', gyenge: 'Gyenge', rossz: 'Rossz' };

function osszegzes(r: Retegrend) {
  try {
    const e = retegrendSzamitas(r);
    const k = kovetelmenyNev(r.kovetelmenyKod);
    const m = k?.ertekelesiSor ? kovetelmeny.szerkezetMinosites(k.ertekelesiSor, e.U) : null;
    return { e, k, m, hiba: null as string | null };
  } catch (err) {
    return { e: null, k: undefined, m: null, hiba: (err as Error).message };
  }
}

export function RetegrendekLepes({ p, modosit }: { p: Projekt; modosit: Modosit }) {
  const [aktivId, setAktivId] = useState<string | null>(p.retegrendek[0]?.id ?? null);
  const [kijeloltReteg, setKijeloltReteg] = useState<string | null>(null);
  const idx = p.retegrendek.findIndex((r) => r.id === aktivId);
  const r = p.retegrendek[idx];

  function uj(szerep: Szerep) {
    const id = ujId();
    modosit((q) => { q.retegrendek.push({ id, nev: SZEREP_NEV[szerep], nevKezi: false, szerep, ...SZEREP_ALAP[szerep], retegek: [] }); });
    setAktivId(id);
  }
  /** Módosítás után a kézzel nem átírt név a rétegekből frissül. */
  /** Szerkezet típus szerint: a sablon kiegészítő rétegeivel együtt jön létre, automatikus névvel. */
  function sablonbol(kod: string) {
    const t = SS.SZERKEZET_SABLONOK.find((x) => x.kod === kod);
    if (!t) return;
    const id = ujId();
    modosit((q) => {
      const r: Retegrend = { id, nev: '', nevKezi: false, szerep: t.szerep, ...SZEREP_ALAP[t.szerep], retegek: t.retegek.map((x) => ({ id: ujId(), anyagId: x.anyagId, dCm: x.dCm })) };
      r.nev = retegrendAutoNev(r);
      q.retegrendek.push(r);
    });
    setAktivId(id);
  }
  const m = (fn: (r: Retegrend) => void) => modosit((q) => { const x = q.retegrendek[idx]!; fn(x); if (x.nevKezi === false) x.nev = retegrendAutoNev(x); });
  const tv = useTavoli();

  function konyvtarbol(kid: string) {
    const k = tv?.konyvtar.retegrendek.find((x) => x.id === kid);
    if (!k) return;
    const id = ujId();
    modosit((q) => {
      q.retegrendek.push({ ...structuredClone(k.adat), id, retegek: k.adat.retegek.map((x) => ({ ...x, id: ujId() })) });
      const ism = new Set((q.anyagok ?? []).map((a) => a.id));
      q.anyagok = [...(q.anyagok ?? []), ...k.anyagok.filter((a) => !ism.has(a.id))];
    });
    setAktivId(id);
  }

  return (
    <div class="ketoszlop">
      <div style="display:flex;flex-direction:column;gap:12px">
        {(() => { const h = retegrendHibak(p); return h.length > 0 && <div class="hiba-doboz"><strong>{h.length} rétegrend hiányos</strong> – amíg nem javítod, az energetikai számítás nem fut le:
          <ul style="margin:6px 0 0 18px">{h.map((x) => <li><button class="link-gomb" onClick={() => setAktivId(x.id)}>{x.nev}</button>: {x.hiba}</li>)}</ul></div>; })()}
        <div class="lista" role="list">
          {p.retegrendek.map((x) => {
            const o = osszegzes(x);
            return (
              <button aria-pressed={x.id === aktivId} onClick={() => setAktivId(x.id)}>
                <span class="lista-cim">{x.nev}</span>
                <span class="lista-al"><span>{SZEREP_NEV[x.szerep]}</span><span title={o.hiba ?? undefined} style={o.e ? '' : 'color:var(--hiba);font-weight:600'}>{o.e ? `U ${sz(o.e.U, 3)}` : '⚠ hiányos'}{x.szerep !== 'padlo' && o.e && (glaser(x)?.kondenzacio.length ?? 0) > 0 ? ' · páralecsapódás' : ''}</span></span>
              </button>
            );
          })}
          {!p.retegrendek.length && <p class="halk" style="padding:12px">Még nincs rétegrend.</p>}
        </div>
        <div><OsszesTorles db={p.retegrendek.length} mit="rétegrendet" megjegyzes="A határoló felületek rétegrend nélkül maradnak." torol={() => { modosit((q) => { q.retegrendek = []; for (const f of q.feluletek) if (f.fajta !== 'nyilaszaro') delete f.retegrendId; }); setAktivId(null); }} /></div>
        <Mezo cim="Új szerkezet" sugo="A típus a kiegészítő rétegeivel (vakolat, ragasztó, hőszigetelés) jön létre; utána szabadon módosítható">
          <select value="" onChange={(e) => { const v = (e.target as HTMLSelectElement).value; if (v.startsWith('k:')) konyvtarbol(v.slice(2)); else if (v.startsWith('s:')) sablonbol(v.slice(2)); else if (v) uj(v as Szerep); }}>
            <option value="">Szerkezet típusa…</option>
            {(Object.keys(SZEREP_NEV) as Szerep[]).map((sz0) => (
              <optgroup label={SZEREP_NEV[sz0]}>
                {SS.SZERKEZET_SABLONOK.filter((t) => t.szerep === sz0).map((t) => <option value={`s:${t.kod}`}>{t.csoport}: {t.nev}</option>)}
                <option value={sz0}>Üres {SZEREP_NEV[sz0].toLowerCase()} (rétegek nélkül)</option>
              </optgroup>
            ))}
            {tv && tv.konyvtar.retegrendek.length > 0 && (
              <optgroup label="Irodai könyvtárból">
                {tv.konyvtar.retegrendek.map((k) => <option value={`k:${k.id}`}>{k.nev} (U {sz(k.U, 3)})</option>)}
              </optgroup>
            )}
          </select>
        </Mezo>
      </div>

      {r ? <Szerkeszto r={r} m={m} kijelolt={kijeloltReteg} jelol={setKijeloltReteg} torol={() => { modosit((q) => { q.retegrendek.splice(idx, 1); }); setAktivId(null); }} /> : (
        <div class="kartya halk">Válassz rétegrendet a listából, vagy vegyél fel újat.</div>
      )}
    </div>
  );
}

function Szerkeszto({ r, m, kijelolt, jelol, torol }: { r: Retegrend; m: (fn: (r: Retegrend) => void) => void; kijelolt: string | null; jelol: (id: string | null) => void; torol: () => void }) {
  const o = osszegzes(r);
  const megfelel = o.e && o.k ? o.e.U <= o.k.Umax + 1e-9 : null;
  const ANYAGOK = anyagLista();
  const kategoriak = [...new Set(ANYAGOK.filter((a) => !a.irodai).map((a) => a.kategoria))];
  const irodaiak = ANYAGOK.filter((a) => a.irodai);
  const retegAthelyez = (id: string, celId: string) => m((q) => {
    const i = q.retegek.findIndex((x) => x.id === id), j = q.retegek.findIndex((x) => x.id === celId);
    if (i < 0 || j < 0 || i === j) return;
    const [t] = q.retegek.splice(i, 1);
    q.retegek.splice(j, 0, t!);
  });

  return (
    <div style="display:flex;flex-direction:column;gap:16px">
      <div class="racs">
        <Mezo cim="Megnevezés" szeles sugo={r.nevKezi !== false ? undefined : 'Automatikus a rétegek alapján; átírható'}>
          <div class="egyseg">
            <Szoveg ertek={r.nev} valt={(v) => m((x) => { x.nev = v; x.nevKezi = true; })} />
            {r.nevKezi !== false && <button class="gomb halk-gomb" title="Név a rétegekből" onClick={() => m((x) => { x.nevKezi = false; })}>automatikus</button>}
          </div>
        </Mezo>
        <Mezo cim="Szerkezet">
          <Valaszto ertek={r.szerep} valt={(v) => m((x) => { Object.assign(x, { szerep: v, ...SZEREP_ALAP[v] }); })} opciok={(Object.keys(SZEREP_NEV) as Szerep[]).map((s) => ({ ertek: s, nev: SZEREP_NEV[s] }))} />
        </Mezo>
        <Mezo cim="Követelmény (1. melléklet 1.1.)" szeles>
          <Valaszto ertek={r.kovetelmenyKod} valt={(v) => m((x) => { x.kovetelmenyKod = v; })} opciok={kovetelmeny.U_KOVETELMENYEK.filter((k) => !['uvegezes', 'kulonleges_uvegezes', 'ablak_fa_pvc', 'ablak_fem', 'tetosik_ablak', 'ajto', 'kapu', 'ipari_ajto', 'felulvilagito', 'uvegteto', 'fuggonyfal'].includes(k.kod)).map((k) => ({ ertek: k.kod, nev: `${k.megnevezes} (U ≤ ${kov(k.Umax)})` }))} />
        </Mezo>
      </div>

      <div class="metszet-keret">
        <div class="metszet-fej">
          <div>
            <div class="u-ertek"><strong>{o.e ? sz(o.e.U, 3) : '–'}</strong><span>W/m²K rétegtervi hőátbocsátási tényező</span></div>
            <p class="halkabb" style="margin-top:4px">
              {sz(retegrendVastagsag(r), 1)} cm, R<sub>tot</sub> = {o.e ? sz(o.e.Rtot, 3) : '–'} m²K/W
              {o.e && o.e.dU > 0 ? `, ebből korrekció ΔU = ${sz(o.e.dU, 4)}` : ''}
            </p>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
            {o.k && megfelel !== null && <span class={`jel ${megfelel ? 'jo' : 'rossz'}`}>{megfelel ? 'Megfelel' : 'Nem felel meg'}: U ≤ {kov(o.k.Umax)} W/m²K</span>}
            {o.m && <span class="halkabb">Minősítés (176/2008, 4. melléklet): {MINOSITES_NEV[o.m]}</span>}
          </div>
        </div>
        <Metszet r={r} kijelolt={kijelolt} jelol={jelol} />
        <p class="halkabb" style="padding:4px 0 8px">Hőmérséklet-lefutás 20 °C belső és −13 °C külső hőmérsékletnél (6.55 képlet szerinti méretezési érték), állandósult állapotban.</p>
      </div>

      <Paradiffuzio r={r} />

      {o.hiba && <div class="hiba-doboz">{o.hiba}</div>}
      {o.e?.figyelmeztetesek.map((f) => <div class="figyelmeztetes">{f.uzenet}<small>{f.forras}</small></div>)}

      <div class="tabla-gorgeto">
        <table class="tabla retegek-tabla">
          <thead><tr><th aria-label="Sorrend"></th><th>Réteg (belülről kifelé)</th><th class="szam">Vastagság</th><th class="szam">λ</th><th class="szam">R</th><th class="szam" title="Páradiffúziós ellenállási szám (üres: katalógus / jellemző érték)">μ</th><th></th></tr></thead>
          <tbody>
            {r.retegek.map((x, i) => {
              const a = anyag(x.anyagId);
              // a réteg önmagában számolható-e (hiányzó λ, R, vastagság) – a hibás sor kiemelve
              const rHiba = (() => { if (!o.hiba) return null; try { retegrendSzamitas({ ...r, retegek: [x] }); return null; } catch (err) { return (err as Error).message; } })();
              const R = o.e?.retegR[i];
              const sajat = !x.anyagId;
              return (
                <tr style={rHiba ? 'box-shadow:inset 3px 0 0 var(--hiba)' : kijelolt === x.id ? 'background:var(--kijelolt)' : ''} onFocusIn={() => jelol(x.id)} {...huzasProps(`reteg-${r.id}`, x.id, retegAthelyez)}>
                  <td style="white-space:nowrap"><Fogantyu cimke={`${i + 1}. réteg`} fel={() => i > 0 && retegAthelyez(x.id, r.retegek[i - 1]!.id)} le={() => i < r.retegek.length - 1 && retegAthelyez(x.id, r.retegek[i + 1]!.id)} /> {i + 1}</td>
                  <td style="min-width:240px">
                    <select aria-label={`${i + 1}. réteg anyaga`} value={x.anyagId ?? (x.R !== undefined ? '_r' : x.legreteg ? '_leg' : '_sajat')} onChange={(e) => {
                      const v = (e.target as HTMLSelectElement).value;
                      m((q) => {
                        const t = q.retegek[i]!;
                        delete t.lambda; delete t.R; delete t.legreteg; delete t.nev;
                        if (v === '_sajat') { t.anyagId = undefined; t.nev = 'Saját anyag'; t.lambda = 1; }
                        else if (v === '_leg') { t.anyagId = undefined; t.nev = 'Zárt légréteg'; t.legreteg = 'zart'; }
                        else if (v === '_r') { t.anyagId = undefined; t.nev = 'Ismert ellenállású réteg'; t.R = 0.5; }
                        else t.anyagId = v;
                      });
                    }}>
                      {irodaiak.length > 0 && <optgroup label="Irodai könyvtár">{irodaiak.map((a) => <option value={a.id}>{a.nev}</option>)}</optgroup>}
                      {kategoriak.map((k) => <optgroup label={k}>{ANYAGOK.filter((a) => a.kategoria === k && !a.irodai).map((a) => <option value={a.id}>{a.nev}</option>)}</optgroup>)}
                      <optgroup label="Egyéb">
                        <option value="_sajat">Saját anyag (λ megadásával)</option>
                        <option value="_r">Ismert ellenállású réteg (R megadásával)</option>
                        <option value="_leg">Zárt légréteg (4.2. táblázat)</option>
                      </optgroup>
                    </select>
                    {sajat && x.nev !== undefined && <div style="margin-top:4px"><Szoveg ertek={x.nev} valt={(v) => m((q) => { q.retegek[i]!.nev = v; })} /></div>}
                    {a && !a.ellenorzott && <small class="halkabb ellenorizendo" title={a.forras}>ellenőrizendő érték</small>}
                    {rHiba && <small style="display:block;color:var(--hiba)">{rHiba}</small>}
                  </td>
                  <td style="width:130px"><Szam cimke="Vastagság" ertek={x.dCm} egyseg="cm" valt={(v) => m((q) => { q.retegek[i]!.dCm = v; })} /></td>
                  <td style="width:120px" class="szam">
                    {x.R !== undefined ? <Szam cimke="Hővezetési ellenállás" min={0.0001} ertek={x.R} egyseg="m²K/W" valt={(v) => m((q) => { q.retegek[i]!.R = v; })} />
                      : x.legreteg ? '–'
                      : (() => {
                        // katalógusanyagnál is átírható: a kézi λ felülírja a katalógus értékét (termék-R esetén az egyenértékű λ = d/R)
                        const katL = a?.lambda ?? (a?.R ? a.R.d / a.R.R : undefined);
                        const kezi = x.lambda !== undefined && x.anyagId !== undefined;
                        return <>
                          <Szam cimke="Hővezetési tényező" min={0.0001} ertek={x.lambda ?? (katL !== undefined ? Math.round(katL * 10000) / 10000 : undefined)} egyseg="W/mK"
                            valt={(v) => m((q) => { const t = q.retegek[i]!; if (katL !== undefined && x.anyagId && Math.abs(v - katL) < 5e-5) delete t.lambda; else t.lambda = v; })} />
                          {kezi && <small class="halkabb" style="display:block;text-align:right">kézi · katalógus {katL !== undefined ? sz(katL, 3) : '–'} <button class="link-gomb" onClick={() => m((q) => { delete q.retegek[i]!.lambda; })}>visszaállít</button></small>}
                          {!kezi && a?.R && <small class="halkabb" style="display:block;text-align:right">termék R {sz(a.R.R, 3)} / {sz(a.R.d * 100, 0)} cm</small>}
                        </>;
                      })()}
                  </td>
                  <td class="szam">{R !== undefined ? sz(R, 3) : '–'}</td>
                  <td style="width:96px" title={muAlap(x).forras}><Szam cimke="Páradiffúziós ellenállási szám" ertek={muAlap(x).mu} valt={(v) => m((q) => { q.retegek[i]!.mu = v > 0 ? v : undefined; })} /></td>
                  <td style="white-space:nowrap">
                    <button class="gomb halk-gomb" onClick={() => m((q) => { q.retegek.splice(i, 1); })}>Törlés</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div class="gombsor">
        <button class="gomb" onClick={() => m((q) => { q.retegek.push({ id: ujId(), anyagId: ANYAGOK[0]!.id, dCm: 1 }); })}>Réteg hozzáadása</button>
        <KonyvtarbaGomb nev={r.nev + r.retegek.length} mentes={(irodaId) => retegrendKonyvtarba(irodaId, r, r.retegek.map((x) => anyag(x.anyagId)).filter((a): a is NonNullable<typeof a> => !!a && !beepitett(a.id)).filter((a, i, l) => l.findIndex((b) => b.id === a.id) === i), o.e?.U ?? null)} />
        <span style="flex:1" />
        <button class="gomb halk-gomb" onClick={torol}>Rétegrend törlése</button>
      </div>

      <details>
        <summary class="halk" style="cursor:pointer">Részletek: felületi ellenállás és korrekciók</summary>
        <div class="racs" style="margin-top:12px">
          <Mezo cim="Külső felületi ellenállás" sugo={`Alapérték: ${o.e ? sz(o.e.Rse, 2) : '–'} m²K/W (4.1. táblázat; fűtetlen tér felé Rsi)`}>
            <Szam ertek={r.rseFelulbiralas} egyseg="m²K/W" valt={(v) => m((x) => { x.rseFelulbiralas = v; })} />
          </Mezo>
          <Mezo cim="Kézi korrekció ΔU" sugo="Pl. fordított tető, más programból átvett „rétegtervi módosító érték”">
            <Szam ertek={r.kezidU} egyseg="W/m²K" valt={(v) => m((x) => { x.kezidU = v; })} />
          </Mezo>
        </div>
      </details>
    </div>
  );
}

function Paradiffuzio({ r }: { r: Retegrend }) {
  const [f, setF] = useState<GlaserFeltetel>(GLASER_ALAP);
  const [sdSkala, setSdSkala] = useState(false);
  if (r.szerep === 'padlo') return <p class="halkabb">Páradiffúziós vizsgálat: talajon fekvő padlónál a Glaser-módszer nem alkalmazható (a külső oldal a talaj).</p>;
  const g = glaser(r, f);
  if (!g) return null;
  const allapot = g.kondenzacio.length === 0 ? 'jo' : g.g60 <= 0.5 ? 'figyel' : 'rossz';
  return (
    <details class="kartya" open={allapot !== 'jo' || undefined}>
      <summary style="cursor:pointer;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <strong>Páradiffúzió (Glaser)</strong>
        <span class={`jel ${allapot === 'jo' ? 'jo' : 'rossz'}`}>{allapot === 'jo' ? 'Nincs páralecsapódás a szerkezetben' : `Páralecsapódás várható: ${sz(g.gNap, 2)} g/m²·nap, 60 napra ${sz(g.g60 * 1000, 0)} g/m²`}</span>
        {(g.feluletiKondenzacio || g.penesz) && <span class="jel rossz">{g.feluletiKondenzacio ? 'Felületi páralecsapódás' : 'Penészveszély a belső felületen'}</span>}
      </summary>
      <div class="racs" style="margin:12px 0">
        <Mezo cim="Belső hőmérséklet"><Szam ertek={f.thetaI} egyseg="°C" valt={(v) => setF({ ...f, thetaI: v })} /></Mezo>
        <Mezo cim="Belső relatív páratartalom"><Szam ertek={Math.round(f.phiI * 100)} egyseg="%" valt={(v) => setF({ ...f, phiI: Math.min(100, Math.max(1, v)) / 100 })} /></Mezo>
        <Mezo cim="Külső hőmérséklet"><Szam ertek={f.thetaE} egyseg="°C" valt={(v) => setF({ ...f, thetaE: v })} /></Mezo>
        <Mezo cim="Külső relatív páratartalom"><Szam ertek={Math.round(f.phiE * 100)} egyseg="%" valt={(v) => setF({ ...f, phiE: Math.min(100, Math.max(1, v)) / 100 })} /></Mezo>
      </div>
      <GlaserAbra g={g} sdSkala={sdSkala} />
      <div class="gombsor" style="margin:6px 0 10px"><label><input type="checkbox" checked={sdSkala} onChange={(e) => setSdSkala((e.target as HTMLInputElement).checked)} /> Vízszintes tengely: egyenértékű légrétegvastagság (sd)</label></div>
      <table class="tabla" style="max-width:720px">
        <tbody>
          <tr><td>Belső / külső parciális gőznyomás</td><td class="szam">{sz(g.pi, 0)} / {sz(g.pe, 0)} Pa</td></tr>
          <tr><td>Összes egyenértékű légrétegvastagság, sd</td><td class="szam">{sz(g.sdOssz, 2)} m</td></tr>
          <tr><td>Belső felület hőmérséklete / a belső levegő harmatpontja</td><td class="szam">{sz(g.thetaSi, 1)} / {sz(g.harmatpontI, 1)} °C</td></tr>
          <tr><td>Felületi hőmérsékleti tényező fRsi (penészmentességhez legalább, φsi ≤ 80 %)</td><td class="szam">{sz(g.fRsi, 3)} ({sz(g.fRsiMin, 3)})</td></tr>
          {g.kondenzacio.map((k) => <tr><td>Kondenzációs sík a belső felülettől</td><td class="szam">{sz(k.x, 1)} cm – {sz(k.g, 2)} g/m²·nap</td></tr>)}
        </tbody>
      </table>
      <p class="halkabb" style="margin-top:8px">
        Állandósult állapotú Glaser-vizsgálat (MSZ EN ISO 13788 egyszerűsítés): psat a 13788 E.1 képletével, a gőznyomás-lefutás sd = μ·d szerint, kondenzációnál a telítési görbe alsó burka; δ₀ = 2·10⁻¹⁰ kg/(m·s·Pa). A méretezési állapot alapértéke a hazai gyakorlat (MSZ-04-140-2): belső 20 °C / 60 %, külső −2 °C / 90 %.
        {allapot === 'figyel' && ' A lecsapódó mennyiség kicsi (≤ 0,5 kg/m² a 60 napos téli időszakra); megengedhető, ha a nyári időszakban kiszárad – a havi mérleggel (MSZ EN ISO 13788) ellenőrizendő.'}
        {allapot === 'rossz' && ' A lecsapódó mennyiség jelentős: belső oldali párafékezés (párazáró) vagy külső oldali páranyitottabb réteg szükséges.'}
        {' '}A μ értékek – ahol a katalógus nem ad meg – anyagcsoport szerinti jellemző értékek (MSZ EN ISO 10456), a rétegtáblában felülírhatók.
      </p>
    </details>
  );
}
