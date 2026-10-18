import { useState } from 'preact/hooks';
import { kovetelmeny } from '@mag/index';
import { Metszet } from '../abrak/Metszet';
import { useTavoli, KonyvtarbaGomb } from '../fiok';
import { retegrendKonyvtarba } from '../tarolo';
import { anyagLista, anyag, beepitett } from '../katalogus';
import { Mezo, Szam, Szoveg, Valaszto, sz, kov } from '../ui';
import { ujId, retegrendSzamitas, retegrendVastagsag, SZEREP_ALAP, SZEREP_NEV, kovetelmenyNev, type Projekt, type Retegrend, type Szerep } from '../modell';

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
    modosit((q) => { q.retegrendek.push({ id, nev: `Új ${SZEREP_NEV[szerep].toLowerCase()}`, szerep, ...SZEREP_ALAP[szerep], retegek: [] }); });
    setAktivId(id);
  }
  const m = (fn: (r: Retegrend) => void) => modosit((q) => fn(q.retegrendek[idx]!));
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
        <div class="lista" role="list">
          {p.retegrendek.map((x) => {
            const o = osszegzes(x);
            return (
              <button aria-pressed={x.id === aktivId} onClick={() => setAktivId(x.id)}>
                <span class="lista-cim">{x.nev}</span>
                <span class="lista-al"><span>{SZEREP_NEV[x.szerep]}</span><span>{o.e ? `U ${sz(o.e.U, 3)}` : 'hiányos'}</span></span>
              </button>
            );
          })}
          {!p.retegrendek.length && <p class="halk" style="padding:12px">Még nincs rétegrend.</p>}
        </div>
        <Mezo cim="Új rétegrend">
          <select value="" onChange={(e) => { const v = (e.target as HTMLSelectElement).value; if (v.startsWith('k:')) konyvtarbol(v.slice(2)); else if (v) uj(v as Szerep); }}>
            <option value="">Szerkezet kiválasztása…</option>
            <optgroup label="Üres rétegrend">
              {(Object.keys(SZEREP_NEV) as Szerep[]).map((s) => <option value={s}>{SZEREP_NEV[s]}</option>)}
            </optgroup>
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

  return (
    <div style="display:flex;flex-direction:column;gap:16px">
      <div class="racs">
        <Mezo cim="Megnevezés" szeles><Szoveg ertek={r.nev} valt={(v) => m((x) => { x.nev = v; })} /></Mezo>
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

      {o.hiba && <div class="hiba-doboz">{o.hiba}</div>}
      {o.e?.figyelmeztetesek.map((f) => <div class="figyelmeztetes">{f.uzenet}<small>{f.forras}</small></div>)}

      <div class="tabla-gorgeto">
        <table class="tabla retegek-tabla">
          <thead><tr><th></th><th>Réteg (belülről kifelé)</th><th class="szam">Vastagság</th><th class="szam">λ</th><th class="szam">R</th><th></th></tr></thead>
          <tbody>
            {r.retegek.map((x, i) => {
              const a = anyag(x.anyagId);
              const R = o.e?.retegR[i];
              const sajat = !x.anyagId;
              return (
                <tr style={kijelolt === x.id ? 'background:var(--kijelolt)' : ''} onFocusIn={() => jelol(x.id)}>
                  <td>{i + 1}</td>
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
                  </td>
                  <td style="width:130px"><Szam cimke="Vastagság" ertek={x.dCm} egyseg="cm" valt={(v) => m((q) => { q.retegek[i]!.dCm = v; })} /></td>
                  <td style="width:120px" class="szam">
                    {x.lambda !== undefined
                      ? <Szam cimke="Hővezetési tényező" ertek={x.lambda} egyseg="W/mK" valt={(v) => m((q) => { q.retegek[i]!.lambda = v; })} />
                      : x.R !== undefined ? <Szam cimke="Hővezetési ellenállás" ertek={x.R} egyseg="m²K/W" valt={(v) => m((q) => { q.retegek[i]!.R = v; })} />
                      : a?.lambda ? sz(a.lambda, 3) : a?.R ? <span class="halkabb">termék R</span> : '–'}
                  </td>
                  <td class="szam">{R !== undefined ? sz(R, 3) : '–'}</td>
                  <td style="white-space:nowrap">
                    <button class="gomb halk-gomb" aria-label="Feljebb" disabled={i === 0} onClick={() => m((q) => { const [t] = q.retegek.splice(i, 1); q.retegek.splice(i - 1, 0, t!); })}>↑</button>
                    <button class="gomb halk-gomb" aria-label="Lejjebb" disabled={i === r.retegek.length - 1} onClick={() => m((q) => { const [t] = q.retegek.splice(i, 1); q.retegek.splice(i + 1, 0, t!); })}>↓</button>
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
