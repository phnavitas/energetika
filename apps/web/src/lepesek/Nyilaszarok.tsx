import { useState } from 'preact/hooks';
import { epuletfizika, kovetelmeny, nyilaszaroSablon as NS } from '@mag/index';
import { UVEGEZESEK, KERETEK, ARNYEKOLOK } from '../katalogus';
import { useTavoli, KonyvtarbaGomb } from '../fiok';
import { nyilaszaroKonyvtarba } from '../tarolo';
import { Mezo, Szam, Szoveg, Valaszto, sz, kov } from '../ui';
import {
  ujId, nyilaszaroAdatok, nyilaszaroGeometria, psiTablabol, sablonbolNyilaszaro, kovetelmenyNev,
  type Projekt, type NyilaszaroTipus, type NyilaszaroKomponens,
} from '../modell';

type Modosit = (fn: (p: Projekt) => void) => void;

const TIPUSOK = [
  { ertek: 'ablak_fa_pvc', nev: 'Ablak, erkélyajtó – fa vagy PVC keret' },
  { ertek: 'ablak_fem', nev: 'Ablak, erkélyajtó – fém keret' },
  { ertek: 'tetosik_ablak', nev: 'Tetősík ablak' },
  { ertek: 'ajto', nev: 'Bejárati vagy fűtetlen tér felé nyíló ajtó' },
  { ertek: 'kapu', nev: 'Kapu' },
] as const;

const REDONY_DR: Record<string, number> = { redony: epuletfizika.ARNYEKOLO_TOBBLET_ELLENALLAS[1].dR[0] };
const TAVTARTO = [{ ertek: 'fem', nev: 'Fém (alumínium) távtartó' }, { ertek: 'fejlett', nev: 'Fejlett (műanyag, „meleg peremű”) távtartó' }, { ertek: 'nincs', nev: 'Nincs (egyrétegű üveg)' }] as const;
const LEC_PSI = [
  { psi: 0.07, nev: 'Low-e kétrétegű, fém léc, > 2 mm' }, { psi: 0.04, nev: 'Low-e kétrétegű, fém léc, > 4 mm / műanyag > 2 mm' },
  { psi: 0.02, nev: 'Low-e kétrétegű, műanyag léc, > 4 mm' }, { psi: 0.03, nev: 'Bevonat nélküli kétrétegű, fém léc, > 2 mm' },
  { psi: 0.01, nev: 'Háromrétegű, léc egy rétegben, > 4 mm' },
];

function kortipikusEv(p: Projekt) { return p.meta.nyilaszaroCsereEv ?? p.meta.epitesiEv; }

export function NyilaszarokLepes({ p, modosit }: { p: Projekt; modosit: Modosit }) {
  const [aktivId, setAktivId] = useState<string | null>(p.nyilaszarok[0]?.id ?? null);
  const [sablonNyitva, setSablonNyitva] = useState<'uj' | 'csere' | null>(null);
  const idx = p.nyilaszarok.findIndex((n) => n.id === aktivId);
  const n = p.nyilaszarok[idx];
  const m = (fn: (n: NyilaszaroTipus) => void) => modosit((q) => fn(q.nyilaszarok[idx]!));
  const tv = useTavoli();

  function sablonValaszt(s: NS.NyilaszaroSablon) {
    if (sablonNyitva === 'csere' && n) {
      m((x) => { const uj = sablonbolNyilaszaro(s, x); Object.keys(x).forEach((k) => delete (x as unknown as Record<string, unknown>)[k]); Object.assign(x, uj); });
    } else {
      const id = ujId();
      modosit((q) => { q.nyilaszarok.push(sablonbolNyilaszaro(s, { id, szelesseg: 1.2, magassag: 1.5, kovetelmenyKod: 'ablak_fa_pvc' })); });
      setAktivId(id);
    }
    setSablonNyitva(null);
  }

  return (
    <>
      <section class="kartya" style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap;margin-bottom:16px">
        <div style="flex:1;min-width:260px">
          <h3>Nyílászárók kora</h3>
          <p class="halkabb" style="margin-top:4px">Ebből ajánl kortipikus ablakot a program. Építés éve: {p.meta.epitesiEv}.</p>
        </div>
        <Mezo cim="Nyílászárócsere éve" sugo="Üresen: az építés éve"><Szam ertek={p.meta.nyilaszaroCsereEv} valt={(v) => modosit((q) => { q.meta.nyilaszaroCsereEv = v > 1800 ? Math.round(v) : undefined; })} /></Mezo>
        <button class="gomb fo" onClick={() => setSablonNyitva('uj')}>Kortipikus ablak hozzáadása</button>
      </section>
      {sablonNyitva && <SablonValaszto ev={kortipikusEv(p)} csere={sablonNyitva === 'csere'} valaszt={sablonValaszt} bezar={() => setSablonNyitva(null)} />}

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
          <button class="gomb" onClick={() => {
            const id = ujId();
            modosit((q) => { q.nyilaszarok.push(sablonbolNyilaszaro(NS.NYILASZARO_SABLONOK.find((s) => s.kod === 'pvc_3r')!, { id, szelesseg: 1.2, magassag: 1.5, kovetelmenyKod: 'ablak_fa_pvc' })); });
            setAktivId(id);
          }}>Üres (új építésű) ablak</button>
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
        {n ? <Szerkeszto n={n} m={m} sablonCsere={() => setSablonNyitva('csere')} torol={() => { modosit((q) => { q.nyilaszarok.splice(idx, 1); }); setAktivId(null); }} /> : <div class="kartya halk">Válassz típust, vagy vegyél fel újat.</div>}
      </div>
    </>
  );
}

function SablonValaszto({ ev, csere, valaszt, bezar }: { ev: number; csere: boolean; valaszt: (s: NS.NyilaszaroSablon) => void; bezar: () => void }) {
  const ajanlott = NS.ajanlottSablonok(ev);
  const tobbi = NS.NYILASZARO_SABLONOK.filter((s) => !ajanlott.includes(s));
  const kartya = (s: NS.NyilaszaroSablon, kiemelt: boolean) => {
    const pr = sablonbolNyilaszaro(s, { id: 'x', szelesseg: 1.2, magassag: 1.5, kovetelmenyKod: 'ablak_fa_pvc' });
    return (
      <button class={`szett${kiemelt ? ' ajanlott' : ''}`} onClick={() => valaszt(s)}>
        <h3>{s.nev}</h3>
        <p>{s.leiras}</p>
        <p class="halkabb">{s.korszak[0]}–{s.korszak[1] >= 2030 ? 'napjainkig' : s.korszak[1]} · U ≈ {sz(nyilaszaroAdatok(pr).U, 2)} W/m²K (120 × 150 cm)</p>
      </button>
    );
  };
  return (
    <section class="szakasz" style="padding-top:0">
      <div class="gombsor" style="justify-content:space-between;margin-bottom:8px">
        <h2>{csere ? 'A kijelölt típus cseréje sablonra' : 'Kortipikus ablak'}</h2>
        <button class="gomb halk-gomb semleges" onClick={bezar}>Bezár</button>
      </div>
      <p class="halk" style="margin-bottom:12px">Az elemek értékei a 2. függelék 4.1–4.4. táblázatából valók; a korszakhoz rendelés és a keretszélességek tervezői becslések, helyszíni felmérés vagy termékadat felülírja. {csere ? 'A méret és az árnyékoló megmarad.' : ''}</p>
      {ajanlott.length > 0 && <>
        <h3 style="margin-bottom:8px">Ajánlott {ev}-hoz</h3>
        <div class="szettek" style="margin-bottom:16px">{ajanlott.map((s) => kartya(s, true))}</div>
      </>}
      <h3 style="margin-bottom:8px">További típusok</h3>
      <div class="szettek">{tobbi.map((s) => kartya(s, false))}</div>
    </section>
  );
}

function AblakAbra({ n }: { n: NyilaszaroTipus }) {
  if (!n.komponens) return null;
  const g = nyilaszaroGeometria(n);
  const k = n.komponens;
  const W = n.szelesseg, H = n.magassag;
  const sk = 180 / Math.max(W, H);
  const kv = k.keretMm / 1000, ov = (k.osztoMm ?? 2 * k.keretMm) / 1000;
  const nx = Math.max(1, k.oszlop ?? 1), ny = Math.max(1, k.sor ?? 1);
  const mezok: { x: number; y: number }[] = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) mezok.push({ x: kv + i * (g.mezoSzel + ov), y: kv + j * (g.mezoMag + ov) });
  return (
    <svg viewBox={`-6 -6 ${W * sk + 12} ${H * sk + 22}`} width={W * sk + 12} role="img" aria-label={`Ablak ${nx} × ${ny} mezővel`} class="ablak-abra">
      <rect x={0} y={0} width={W * sk} height={H * sk} class="ablak-keret" />
      {mezok.map((m) => (
        <g>
          <rect x={m.x * sk} y={m.y * sk} width={g.mezoSzel * sk} height={g.mezoMag * sk} class={k.kapcsoltResMm ? 'ablak-uveg kapcsolt' : 'ablak-uveg'} />
          {k.lec && Array.from({ length: k.lec.fuggoleges }, (_, i) => <line x1={(m.x + (g.mezoSzel * (i + 1)) / (k.lec!.fuggoleges + 1)) * sk} x2={(m.x + (g.mezoSzel * (i + 1)) / (k.lec!.fuggoleges + 1)) * sk} y1={m.y * sk} y2={(m.y + g.mezoMag) * sk} class="ablak-lec" />)}
          {k.lec && Array.from({ length: k.lec.vizszintes }, (_, i) => <line y1={(m.y + (g.mezoMag * (i + 1)) / (k.lec!.vizszintes + 1)) * sk} y2={(m.y + (g.mezoMag * (i + 1)) / (k.lec!.vizszintes + 1)) * sk} x1={m.x * sk} x2={(m.x + g.mezoSzel) * sk} class="ablak-lec" />)}
        </g>
      ))}
      <text x={(W * sk) / 2} y={H * sk + 14} text-anchor="middle" class="ablak-felirat">{sz(W * 100, 0)} × {sz(H * 100, 0)} cm · üveg {sz((g.Aü / g.A) * 100, 0)}%</text>
    </svg>
  );
}

function Szerkeszto({ n, m, torol, sablonCsere }: { n: NyilaszaroTipus; m: (fn: (n: NyilaszaroTipus) => void) => void; torol: () => void; sablonCsere: () => void }) {
  const d = nyilaszaroAdatok(n);
  const k = kovetelmenyNev(n.kovetelmenyKod);
  const megfelel = k ? d.U <= k.Umax + 1e-9 : null;
  const minosites = k?.ertekelesiSor ? kovetelmeny.szerkezetMinosites(k.ertekelesiSor, d.U) : null;
  const komp = n.komponens;
  const mod = !komp ? 'kezi' : komp.kapcsoltResMm ? 'kapcsolt' : 'egyheju';
  const mk = (fn: (c: NyilaszaroKomponens) => void) => m((x) => { fn(x.komponens!); if (!x.komponens!.psiKezi) { const ps = psiTablabol(x.komponens!); if (ps !== null) x.komponens!.psi = ps; } });
  const sablon = NS.NYILASZARO_SABLONOK.find((s) => s.kod === n.sablonKod);
  const g = komp ? nyilaszaroGeometria(n) : null;

  return (
    <div style="display:flex;flex-direction:column;gap:16px">
      <div class="racs">
        <Mezo cim="Megnevezés" szeles><Szoveg ertek={n.nev} valt={(v) => m((x) => { x.nev = v; })} /></Mezo>
        <Mezo cim="Típus"><Valaszto ertek={n.kovetelmenyKod} valt={(v) => m((x) => { x.kovetelmenyKod = v; })} opciok={TIPUSOK} /></Mezo>
        <Mezo cim="Szélesség (tokkülméret)"><Szam ertek={n.szelesseg} egyseg="m" valt={(v) => m((x) => { x.szelesseg = v; })} /></Mezo>
        <Mezo cim="Magasság (tokkülméret)"><Szam ertek={n.magassag} egyseg="m" valt={(v) => m((x) => { x.magassag = v; })} /></Mezo>
      </div>

      <div class="kartya ablak-osszegzes">
        <AblakAbra n={n} />
        <div style="flex:1;min-width:220px;display:flex;flex-direction:column;gap:10px">
          <div class="u-ertek"><strong>{sz(d.U, 3)}</strong><span>W/m²K {mod === 'kapcsolt' ? '(4.17, kapcsolt)' : mod === 'egyheju' ? '(4.16)' : '(teljesítménynyilatkozat)'}</span></div>
          <dl class="mutatok">
            <dt>Felület / üvegezett felület</dt><dd>{sz(d.A, 2)} / {sz(d.Au, 2)} m²</dd>
            {n.arnyekolo && <><dt>Fűtési U árnyékolóval (4.18)</dt><dd>{sz(d.UFutes, 3)} W/m²K</dd></>}
            {sablon && <><dt>Kiinduló sablon</dt><dd>{sablon.nev}</dd></>}
          </dl>
          <div style="display:flex;flex-direction:column;gap:4px">
            {k && <span class={`jel ${megfelel ? 'jo' : 'rossz'}`}>{megfelel ? 'Megfelel' : 'Nem felel meg'}: U ≤ {kov(k.Umax)} W/m²K</span>}
            {minosites && <span class="halkabb">Minősítés: {({ kivalo: 'kiváló', jo: 'jó', kozepes: 'közepes', gyenge: 'gyenge', rossz: 'rossz' } as const)[minosites]}</span>}
          </div>
        </div>
      </div>

      <section>
        <div class="gombsor" style="margin-bottom:12px">
          <Valaszto cimke="Számítás módja" ertek={mod} valt={(v) => m((x) => {
            if (v === 'kezi') { x.uwKezi = Number(d.U.toFixed(2)); delete x.komponens; return; }
            x.komponens ??= sablonbolNyilaszaro(NS.NYILASZARO_SABLONOK.find((s) => s.kod === 'pvc_5_2005')!, x).komponens!;
            if (v === 'kapcsolt') { x.komponens.kapcsoltResMm ??= 50; } else delete x.komponens.kapcsoltResMm;
            delete x.uwKezi;
          })} opciok={[{ ertek: 'egyheju', nev: 'Részletes számítás összetevőkből (4.16)' }, { ertek: 'kapcsolt', nev: 'Kapcsolt szárnyú, kéthéjú ablak (4.17)' }, { ertek: 'kezi', nev: 'Teljesítménynyilatkozat szerinti Uw' }]} />
          <button class="gomb" onClick={sablonCsere}>Kortipikus sablon betöltése</button>
        </div>
        {komp ? <>
          <div class="gep-racs">
            <fieldset class="gep-csoport"><legend>Üvegezés</legend><div class="gep-mezok">
              <Mezo cim={mod === 'kapcsolt' ? 'Üvegezés (szárnyanként)' : 'Típus'} sugo="2. függ. 4.1. táblázat">
                <select onChange={(e) => { const u = UVEGEZESEK.find((x) => x.kod === (e.target as HTMLSelectElement).value); if (u) { mk((c) => { c.Ug = u.Ug; c.uvegKod = u.kod; if (u.kod === 'egyreteg') c.tavtarto = 'nincs'; else if (c.tavtarto === 'nincs') c.tavtarto = 'fem'; }); m((x) => { x.gn = mod === 'kapcsolt' && u.kod === 'egyreteg' ? 0.75 : u.gn; }); } }}>
                  <option value="" selected={!komp.uvegKod}>Egyedi (termékadat)</option>
                  {UVEGEZESEK.map((u) => <option value={u.kod} selected={komp.uvegKod === u.kod}>{u.megnevezes} (Ug {String(u.Ug).replace('.', ',')})</option>)}
                </select>
              </Mezo>
              <div class="gep-ket">
                <Mezo cim="Ug"><Szam ertek={komp.Ug} egyseg="W/m²K" valt={(v) => mk((c) => { c.Ug = v; c.uvegKod = undefined; })} /></Mezo>
                <Mezo cim="g (merőleges)"><Szam ertek={n.gn} valt={(v) => m((x) => { x.gn = v; })} /></Mezo>
              </div>
              <Mezo cim="Távtartó"><Valaszto ertek={komp.tavtarto ?? 'fem'} valt={(v) => mk((c) => { c.tavtarto = v; })} opciok={TAVTARTO} /></Mezo>
              {mod === 'kapcsolt' && <Mezo cim="Légrés a szárnyak között" sugo={`Rl = ${sz(d.Rl ?? 0, 2)} m²K/W (4.2. táblázat)`}><Szam ertek={komp.kapcsoltResMm} egyseg="mm" valt={(v) => mk((c) => { c.kapcsoltResMm = Math.max(v, 1); })} /></Mezo>}
            </div></fieldset>

            <fieldset class="gep-csoport"><legend>Keret, tok</legend><div class="gep-mezok">
              <Mezo cim="Keret anyaga" sugo="2. függ. 4.2. táblázat">
                <select onChange={(e) => { const u = KERETEK.find((x) => x.kod === (e.target as HTMLSelectElement).value); if (u) mk((c) => { c.Uk = u.Uk; c.keretKod = u.kod; }); }}>
                  <option value="" selected={!komp.keretKod}>Egyedi (termékadat)</option>
                  {KERETEK.map((u) => <option value={u.kod} selected={komp.keretKod === u.kod}>{u.megnevezes} (Uk {String(u.Uk).replace('.', ',')})</option>)}
                </select>
              </Mezo>
              <div class="gep-ket">
                <Mezo cim="Uk"><Szam ertek={komp.Uk} egyseg="W/m²K" valt={(v) => mk((c) => { c.Uk = v; c.keretKod = undefined; })} /></Mezo>
                <Mezo cim="Tok + szárny nézetszélessége"><Szam ertek={komp.keretMm} egyseg="mm" valt={(v) => mk((c) => { c.keretMm = v; })} /></Mezo>
              </div>
              <Mezo cim="Ψ keret–üveg" sugo={komp.psiKezi ? 'Kézi érték' : '4.3. táblázat a keret, az üvegezés és a távtartó szerint'}>
                <div class="egyseg">
                  <Szam ertek={komp.psi} egyseg="W/mK" valt={(v) => m((x) => { x.komponens!.psi = v; x.komponens!.psiKezi = true; })} />
                  {komp.psiKezi && <button class="gomb halk-gomb semleges" onClick={() => mk((c) => { c.psiKezi = false; })}>táblázatból</button>}
                </div>
              </Mezo>
            </div></fieldset>

            <fieldset class="gep-csoport"><legend>Osztás</legend><div class="gep-mezok">
              <div class="gep-ket">
                <Mezo cim="Mezők vízszintesen"><Szam ertek={komp.oszlop ?? 1} valt={(v) => mk((c) => { c.oszlop = Math.max(1, Math.round(v)); })} /></Mezo>
                <Mezo cim="Mezők függőlegesen"><Szam ertek={komp.sor ?? 1} valt={(v) => mk((c) => { c.sor = Math.max(1, Math.round(v)); })} /></Mezo>
              </div>
              {((komp.oszlop ?? 1) > 1 || (komp.sor ?? 1) > 1) && <Mezo cim="Tokosztó / szárnytalálkozás szélessége"><Szam ertek={komp.osztoMm ?? 2 * komp.keretMm} egyseg="mm" valt={(v) => mk((c) => { c.osztoMm = v; })} /></Mezo>}
              <label class="jelolo"><input type="checkbox" checked={!!komp.lec} onChange={(e) => mk((c) => { c.lec = (e.target as HTMLInputElement).checked ? { fuggoleges: 1, vizszintes: 1, psi: 0.04 } : undefined; })} /> Üvegosztó léc az üvegben</label>
              {komp.lec && <>
                <div class="gep-ket">
                  <Mezo cim="Függőleges léc / mező"><Szam ertek={komp.lec.fuggoleges} valt={(v) => mk((c) => { c.lec!.fuggoleges = Math.max(0, Math.round(v)); })} /></Mezo>
                  <Mezo cim="Vízszintes léc / mező"><Szam ertek={komp.lec.vizszintes} valt={(v) => mk((c) => { c.lec!.vizszintes = Math.max(0, Math.round(v)); })} /></Mezo>
                </div>
                <Mezo cim="Ψ léc–üveg" sugo="2. függ. 4.4. táblázat"><Valaszto ertek={String(komp.lec.psi)} valt={(v) => mk((c) => { c.lec!.psi = Number(v); })} opciok={LEC_PSI.map((x) => ({ ertek: String(x.psi), nev: `${x.nev} – ${String(x.psi).replace('.', ',')}` }))} /></Mezo>
              </>}
            </div></fieldset>
          </div>

          {g && (
            <div class="tabla-gorgeto" style="margin-top:12px">
              <table class="tabla" style="max-width:640px">
                <thead><tr><th>4.16 képlet tagjai</th><th class="szam">Méret</th><th class="szam">Tényező</th><th class="szam">Hőveszteség [W/K]</th></tr></thead>
                <tbody>
                  <tr><td>Üvegezés Aü · Uü</td><td class="szam">{sz(g.Aü, 3)} m²</td><td class="szam">{sz(g.Uü, 2)} W/m²K</td><td class="szam">{sz(g.Aü * g.Uü, 3)}</td></tr>
                  <tr><td>Keret Ak · Uk</td><td class="szam">{sz(g.Ak, 3)} m²</td><td class="szam">{sz(g.Uk, 2)} W/m²K</td><td class="szam">{sz(g.Ak * g.Uk, 3)}</td></tr>
                  <tr><td>Üvegperem lkü · Ψ</td><td class="szam">{sz(g.lkü, 2)} m</td><td class="szam">{sz(g.psiKü, 3)} W/mK</td><td class="szam">{sz(g.lkü * g.psiKü, 3)}</td></tr>
                  {g.lmü ? <tr><td>Üvegosztó léc lmü · Ψ</td><td class="szam">{sz(g.lmü, 2)} m</td><td class="szam">{sz(g.psiMü, 3)} W/mK</td><td class="szam">{sz(g.lmü * (g.psiMü ?? 0), 3)}</td></tr> : null}
                </tbody>
                <tfoot>
                  <tr><td>{mod === 'kapcsolt' ? 'Egy szárny U-ja' : 'Uw'} = Σ / A</td><td class="szam">{sz(g.A, 3)} m²</td><td /><td class="szam">{sz(d.Uegy ?? d.U, 3)} W/m²K</td></tr>
                  {mod === 'kapcsolt' && <tr><td colSpan={3}>Kapcsolt: 1 / (1/U₁ − Rsi + Rl − Rse + 1/U₂)</td><td class="szam">{sz(d.U, 3)} W/m²K</td></tr>}
                </tfoot>
              </table>
            </div>
          )}
        </> : (
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
