import { useState } from 'preact/hooks';
import { epuletfizika, kovetelmeny } from '@mag/index';
import { UVEGEZESEK, KERETEK, ARNYEKOLOK } from '../katalogus';
import { useTavoli, KonyvtarbaGomb } from '../fiok';
import { nyilaszaroKonyvtarba } from '../tarolo';
import { Mezo, Szam, Szoveg, Valaszto, sz, kov } from '../ui';
import { ujId, nyilaszaroAdatok, kovetelmenyNev, type Projekt, type NyilaszaroTipus } from '../modell';

type Modosit = (fn: (p: Projekt) => void) => void;

const TIPUSOK = [
  { ertek: 'ablak_fa_pvc', nev: 'Ablak, erkélyajtó – fa vagy PVC keret' },
  { ertek: 'ablak_fem', nev: 'Ablak, erkélyajtó – fém keret' },
  { ertek: 'tetosik_ablak', nev: 'Tetősík ablak' },
  { ertek: 'ajto', nev: 'Bejárati vagy fűtetlen tér felé nyíló ajtó' },
  { ertek: 'kapu', nev: 'Kapu' },
] as const;

const REDONY_DR: Record<string, number> = { redony: epuletfizika.ARNYEKOLO_TOBBLET_ELLENALLAS[1].dR[0] };

export function NyilaszarokLepes({ p, modosit }: { p: Projekt; modosit: Modosit }) {
  const [aktivId, setAktivId] = useState<string | null>(p.nyilaszarok[0]?.id ?? null);
  const idx = p.nyilaszarok.findIndex((n) => n.id === aktivId);
  const n = p.nyilaszarok[idx];
  const m = (fn: (n: NyilaszaroTipus) => void) => modosit((q) => fn(q.nyilaszarok[idx]!));
  const tv = useTavoli();

  function uj() {
    const id = ujId();
    const ug = UVEGEZESEK[5], uk = KERETEK[4];
    modosit((q) => { q.nyilaszarok.push({ id, nev: 'Új ablak', kovetelmenyKod: 'ablak_fa_pvc', szelesseg: 1.2, magassag: 1.5, komponens: { keretMm: 80, Ug: ug.Ug, Uk: uk.Uk, psi: epuletfizika.PSI_KERET_UVEG.fa_pvc.lowe.fejlett }, gn: ug.gn }); });
    setAktivId(id);
  }

  return (
    <div class="ketoszlop">
      <div style="display:flex;flex-direction:column;gap:12px">
        <div class="lista">
          {p.nyilaszarok.map((x) => {
            const d = nyilaszaroAdatok(x);
            return (
              <button aria-pressed={x.id === aktivId} onClick={() => setAktivId(x.id)}>
                <span class="lista-cim">{x.nev}</span>
                <span class="lista-al"><span>{sz(x.szelesseg * 100, 0)} × {sz(x.magassag * 100, 0)} cm</span><span>U {sz(d.U, 2)}</span></span>
              </button>
            );
          })}
          {!p.nyilaszarok.length && <p class="halk" style="padding:12px">Még nincs nyílászáró-típus.</p>}
        </div>
        <button class="gomb" onClick={uj}>Nyílászáró-típus hozzáadása</button>
        {tv && tv.konyvtar.nyilaszarok.length > 0 && (
          <Mezo cim="Irodai könyvtárból">
            <select value="" onChange={(e) => {
              const k = tv.konyvtar.nyilaszarok.find((x) => x.id === (e.target as HTMLSelectElement).value);
              if (!k) return;
              const id = ujId();
              modosit((q) => { q.nyilaszarok.push({ ...structuredClone(k.adat), id }); });
              setAktivId(id);
            }}>
              <option value="">Típus kiválasztása…</option>
              {tv.konyvtar.nyilaszarok.map((k) => <option value={k.id}>{k.nev} (U {sz(k.Uw, 2)})</option>)}
            </select>
          </Mezo>
        )}
      </div>
      {n ? <Szerkeszto n={n} m={m} torol={() => { modosit((q) => { q.nyilaszarok.splice(idx, 1); }); setAktivId(null); }} /> : <div class="kartya halk">Válassz típust, vagy vegyél fel újat.</div>}
    </div>
  );
}

function Szerkeszto({ n, m, torol }: { n: NyilaszaroTipus; m: (fn: (n: NyilaszaroTipus) => void) => void; torol: () => void }) {
  const d = nyilaszaroAdatok(n);
  const k = kovetelmenyNev(n.kovetelmenyKod);
  const megfelel = k ? d.U <= k.Umax + 1e-9 : null;
  const minosites = k?.ertekelesiSor ? kovetelmeny.szerkezetMinosites(k.ertekelesiSor, d.U) : null;
  const komp = n.komponens;

  return (
    <div style="display:flex;flex-direction:column;gap:16px">
      <div class="racs">
        <Mezo cim="Megnevezés" szeles><Szoveg ertek={n.nev} valt={(v) => m((x) => { x.nev = v; })} /></Mezo>
        <Mezo cim="Típus"><Valaszto ertek={n.kovetelmenyKod} valt={(v) => m((x) => { x.kovetelmenyKod = v; })} opciok={TIPUSOK} /></Mezo>
        <Mezo cim="Szélesség (tokkülméret)"><Szam ertek={n.szelesseg} egyseg="m" valt={(v) => m((x) => { x.szelesseg = v; })} /></Mezo>
        <Mezo cim="Magasság (tokkülméret)"><Szam ertek={n.magassag} egyseg="m" valt={(v) => m((x) => { x.magassag = v; })} /></Mezo>
      </div>

      <div class="kartya" style="display:flex;gap:24px;flex-wrap:wrap;align-items:center">
        <div class="u-ertek"><strong>{sz(d.U, 3)}</strong><span>W/m²K</span></div>
        <dl class="mutatok" style="flex:1;min-width:220px">
          <dt>Felület / üvegezett felület</dt><dd>{sz(d.A, 2)} / {sz(d.Au, 2)} m²</dd>
          {n.arnyekolo && <><dt>Fűtési U árnyékolóval (4.18)</dt><dd>{sz(d.UFutes, 3)} W/m²K</dd></>}
        </dl>
        <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
          {k && <span class={`jel ${megfelel ? 'jo' : 'rossz'}`}>{megfelel ? 'Megfelel' : 'Nem felel meg'}: U ≤ {kov(k.Umax)} W/m²K</span>}
          {minosites && <span class="halkabb">Minősítés: {({ kivalo: 'kiváló', jo: 'jó', kozepes: 'közepes', gyenge: 'gyenge', rossz: 'rossz' } as const)[minosites]}</span>}
        </div>
      </div>

      <section>
        <div class="gombsor" style="margin-bottom:12px">
          <label class="jelolo"><input type="radio" checked={!!komp} onChange={() => m((x) => { x.komponens = { keretMm: 80, Ug: 0.8, Uk: 1.0, psi: 0.06 }; delete x.uwKezi; })} /> Számítás összetevőkből (4.16 képlet)</label>
          <label class="jelolo"><input type="radio" checked={!komp} onChange={() => m((x) => { x.uwKezi = d.U; delete x.komponens; })} /> Teljesítménynyilatkozat szerinti U<sub>w</sub></label>
        </div>
        {komp ? (
          <div class="racs">
            <Mezo cim="Üvegezés" sugo="2. függ. 4.1. táblázat – termékadat hiányában">
              <select onChange={(e) => { const u = UVEGEZESEK.find((x) => x.kod === (e.target as HTMLSelectElement).value); if (u) m((x) => { x.komponens!.Ug = u.Ug; x.gn = u.gn; }); }}>
                <option value="">Választás a táblázatból…</option>
                {UVEGEZESEK.map((u) => <option value={u.kod}>{u.megnevezes} (Ug {u.Ug}, g {u.gn})</option>)}
              </select>
            </Mezo>
            <Mezo cim="Ug"><Szam ertek={komp.Ug} egyseg="W/m²K" valt={(v) => m((x) => { x.komponens!.Ug = v; })} /></Mezo>
            <Mezo cim="Keret" sugo="2. függ. 4.2. táblázat">
              <select onChange={(e) => { const u = KERETEK.find((x) => x.kod === (e.target as HTMLSelectElement).value); if (u) m((x) => { x.komponens!.Uk = u.Uk; }); }}>
                <option value="">Választás a táblázatból…</option>
                {KERETEK.map((u) => <option value={u.kod}>{u.megnevezes} (Uk {u.Uk})</option>)}
              </select>
            </Mezo>
            <Mezo cim="Uk"><Szam ertek={komp.Uk} egyseg="W/m²K" valt={(v) => m((x) => { x.komponens!.Uk = v; })} /></Mezo>
            <Mezo cim="Keretszélesség (körben)"><Szam ertek={komp.keretMm} egyseg="mm" valt={(v) => m((x) => { x.komponens!.keretMm = v; })} /></Mezo>
            <Mezo cim="Ψ keret–üveg" sugo="2. függ. 4.3. táblázat: fa/PVC, low-e, fém távtartó 0,08; műanyag 0,06"><Szam ertek={komp.psi} egyseg="W/mK" valt={(v) => m((x) => { x.komponens!.psi = v; })} /></Mezo>
            <Mezo cim="g (merőleges)"><Szam ertek={n.gn} valt={(v) => m((x) => { x.gn = v; })} /></Mezo>
          </div>
        ) : (
          <div class="racs">
            <Mezo cim="Uw"><Szam ertek={n.uwKezi} egyseg="W/m²K" valt={(v) => m((x) => { x.uwKezi = v; })} /></Mezo>
            <Mezo cim="Keretarány" sugo="Alapérték 30%, 1990 előtti 25%, 0,5 m² alatt 50% (6.3.1)"><Szam ertek={n.keretarany ?? 0.3} valt={(v) => m((x) => { x.keretarany = v; })} /></Mezo>
            <Mezo cim="g (merőleges)"><Szam ertek={n.gn} valt={(v) => m((x) => { x.gn = v; })} /></Mezo>
          </div>
        )}
      </section>

      <section>
        <h3 style="margin-bottom:8px">Társított árnyékoló</h3>
        <div class="racs">
          <Mezo cim="Árnyékoló" sugo="Fűtésnél a többlet hőszigetelést (4.18), hűtésnél az árnyékolási tényezőt (2. függ. 4.5.) adja">
            <select value={n.arnyekolo?.kod ?? ''} onChange={(e) => {
              const kod = (e.target as HTMLSelectElement).value;
              const a = ARNYEKOLOK.find((x) => x.kod === kod);
              m((x) => { if (!a) delete x.arnyekolo; else x.arnyekolo = { kod, dR: REDONY_DR[kod] ?? 0, garnyH: a.kivul ?? a.belul ?? 1 }; });
            }}>
              <option value="">Nincs</option>
              {ARNYEKOLOK.map((a) => <option value={a.kod}>{a.megnevezes} ({a.kivul !== null ? `kívül ${a.kivul}` : `belül ${a.belul}`})</option>)}
            </select>
          </Mezo>
          {n.arnyekolo && <Mezo cim="Többlet ellenállás ΔR" sugo="4.4./4.5. táblázat; csak a fűtési energiaigényhez, az elemi követelményhez nem"><Szam ertek={n.arnyekolo.dR} egyseg="m²K/W" valt={(v) => m((x) => { x.arnyekolo!.dR = v; })} /></Mezo>}
        </div>
      </section>
      <div class="gombsor"><KonyvtarbaGomb nev={n.nev + n.szelesseg + n.magassag} mentes={(irodaId) => nyilaszaroKonyvtarba(irodaId, n, d.U)} /><span style="flex:1" /><button class="gomb halk-gomb" onClick={torol}>Típus törlése</button></div>
    </div>
  );
}
