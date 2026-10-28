import { useState } from 'preact/hooks';
import { epuletfizika, kovetelmeny, nyilaszaroSablon as NS } from '@mag/index';
import { UVEGEZESEK, KERETEK, ARNYEKOLOK, AJTO_KAPU_SABLONOK, type AjtoKapuSablon } from '../katalogus';
import { useTavoli, KonyvtarbaGomb } from '../fiok';
import { nyilaszaroKonyvtarba } from '../tarolo';
import { Mezo, Szam, Szoveg, Valaszto, sz, kov, OsszesTorles } from '../ui';
import {
  ujId, fuggonyfalTipus, nyilaszaroAdatok, nyilaszaroGeometria, psiTablabol, sablonbolNyilaszaro, kovetelmenyNev,
  type Projekt, type NyilaszaroTipus, type NyilaszaroKomponens, type NyilaszaroCsoport, nyilaszaroHibak } from '../modell';

type Modosit = (fn: (p: Projekt) => void) => void;

const TIPUSOK = [
  { ertek: 'ablak_fa_pvc', nev: 'Ablak, erkélyajtó – fa vagy PVC keret' },
  { ertek: 'ablak_fem', nev: 'Ablak, erkélyajtó – fém keret' },
  { ertek: 'tetosik_ablak', nev: 'Tetősík ablak' },
  { ertek: 'ajto', nev: 'Bejárati vagy fűtetlen tér felé nyíló ajtó' },
  { ertek: 'kapu', nev: 'Kapu' },
  { ertek: 'fuggonyfal', nev: 'Függönyfal, homlokzati üvegfal' },
] as const;

const REDONY_DR: Record<string, number> = { redony: epuletfizika.ARNYEKOLO_TOBBLET_ELLENALLAS[1].dR[0] };
const TAVTARTO = [{ ertek: 'fem', nev: 'Fém (alumínium) távtartó' }, { ertek: 'fejlett', nev: 'Fejlett (műanyag, „meleg peremű”) távtartó' }, { ertek: 'nincs', nev: 'Nincs (egyrétegű üveg)' }] as const;
const LEC_PSI = [
  { psi: 0.07, nev: 'Low-e kétrétegű, fém léc, > 2 mm' }, { psi: 0.04, nev: 'Low-e kétrétegű, fém léc, > 4 mm / műanyag > 2 mm' },
  { psi: 0.02, nev: 'Low-e kétrétegű, műanyag léc, > 4 mm' }, { psi: 0.03, nev: 'Bevonat nélküli kétrétegű, fém léc, > 2 mm' },
  { psi: 0.01, nev: 'Háromrétegű, léc egy rétegben, > 4 mm' },
];

function kortipikusEv(p: Projekt) { return p.meta.nyilaszaroCsereEv ?? p.meta.epitesiEv; }


type Kij = { t: 'cs' | 'e'; id: string } | null;
type M = (fn: (n: NyilaszaroTipus) => void) => void;

/** A csoport tagjainál eltérő közös jellemzők. */
function elteroKozos(tagok: NyilaszaroTipus[]): string[] {
  const jel: [string, (n: NyilaszaroTipus) => unknown][] = [
    ['típus', (n) => n.kovetelmenyKod], ['számítási mód', (n) => (!n.komponens ? 'k' : n.komponens.kapcsoltResMm ? 'c' : 'e')],
    ['Ug', (n) => n.komponens?.Ug], ['g', (n) => n.gn], ['távtartó', (n) => n.komponens?.tavtarto], ['Uk', (n) => n.komponens?.Uk],
    ['keretszélesség', (n) => n.komponens?.keretMm], ['Ψ', (n) => n.komponens?.psi], ['Uw (kézi)', (n) => n.uwKezi], ['árnyékoló', (n) => n.arnyekolo?.kod ?? ''],
  ];
  return jel.filter(([, f]) => new Set(tagok.map((t) => JSON.stringify(f(t) ?? null))).size > 1).map(([nev]) => nev);
}

export function NyilaszarokLepes({ p, modosit }: { p: Projekt; modosit: Modosit }) {
  const csoportok = p.nyilaszaroCsoportok ?? [];
  const [kij, setKij] = useState<Kij>(csoportok[0] ? { t: 'cs', id: csoportok[0].id } : p.nyilaszarok[0] ? { t: 'e', id: p.nyilaszarok[0].id } : null);
  const [sablonNyitva, setSablonNyitva] = useState<'uj' | 'csere' | null>(null);
  const [ajtoNyitva, setAjtoNyitva] = useState(false);
  const n = kij?.t === 'e' ? p.nyilaszarok.find((x) => x.id === kij.id) : undefined;
  const cs = kij?.t === 'cs' ? csoportok.find((x) => x.id === kij.id) : undefined;
  const m: M = (fn) => modosit((q) => { const x = q.nyilaszarok.find((y) => y.id === n?.id); if (x) fn(x); });
  const mcs: M = (fn) => modosit((q) => { for (const x of q.nyilaszarok) if (x.csoportId === cs?.id) fn(x); });
  const tv = useTavoli();
  const celCsoport = cs?.id ?? n?.csoportId;

  function felvesz(t: NyilaszaroTipus) {
    modosit((q) => { q.nyilaszarok.push({ ...t, ...(celCsoport ? { csoportId: celCsoport } : {}) }); });
    setKij({ t: 'e', id: t.id });
  }
  function sablonValaszt(s: NS.NyilaszaroSablon) {
    if (sablonNyitva === 'csere' && (n || cs)) {
      const csere = (x: NyilaszaroTipus) => { const megtart = { nev: x.nev, csoportId: x.csoportId }; const uj = sablonbolNyilaszaro(s, x); Object.keys(x).forEach((k) => delete (x as unknown as Record<string, unknown>)[k]); Object.assign(x, uj, cs || megtart.csoportId ? { nev: megtart.nev } : {}, megtart.csoportId ? { csoportId: megtart.csoportId } : {}); };
      (cs ? mcs : m)(csere);
    } else {
      felvesz(sablonbolNyilaszaro(s, { id: ujId(), szelesseg: 1.2, magassag: 1.5, kovetelmenyKod: 'ablak_fa_pvc' }));
    }
    setSablonNyitva(null);
  }
  function ajtoValaszt(t: AjtoKapuSablon) {
    const kapu = t.fajta === 'kapu';
    let csId = celCsoport;
    if (!csId) {
      const nev = kapu ? 'Garázskapuk' : 'Bejárati ajtók';
      const meglevo = csoportok.find((c) => c.nev === nev);
      csId = meglevo?.id ?? ujId();
      if (!meglevo) modosit((q) => { (q.nyilaszaroCsoportok ??= []).push({ id: csId!, nev }); });
    }
    const id = ujId();
    modosit((q) => { q.nyilaszarok.push({ id, nev: `${kapu ? 'Garázskapu' : 'Bejárati ajtó'} – ${t.nev.charAt(0).toLowerCase()}${t.nev.slice(1)}`, kovetelmenyKod: t.fajta, szelesseg: kapu ? 2.5 : 1.0, magassag: kapu ? 2.25 : 2.1, uwKezi: t.U, gn: 0, sablonKod: t.kod, csoportId: csId }); });
    setKij({ t: 'e', id }); setAjtoNyitva(false);
  }

  const elemGomb = (x: NyilaszaroTipus, tag: boolean) => {
    const d = nyilaszaroAdatok(x);
    return (
      <button aria-pressed={kij?.t === 'e' && kij.id === x.id} onClick={() => setKij({ t: 'e', id: x.id })} style={tag ? 'padding-left:26px' : ''}>
        <span class="lista-cim">{x.nev}</span>
        <span class="lista-al"><span>{sz(x.szelesseg * 100, 0)} × {sz(x.magassag * 100, 0)} cm</span><span>U {sz(d.U, 2)}</span></span>
      </button>
    );
  };
  const csoportNelkul = p.nyilaszarok.filter((x) => !x.csoportId || !csoportok.some((c) => c.id === x.csoportId));

  return (
    <>
      {(() => { const h = nyilaszaroHibak(p); return h.length > 0 && <div class="hiba-doboz" style="margin-bottom:12px"><strong>{h.length} nyílászáró-típus hiányos</strong> – amíg nem javítod, az energetikai számítás nem fut le:
        <ul style="margin:6px 0 0 18px">{h.map((x) => <li><button class="link-gomb" onClick={() => setKij({ t: 'e', id: x.id })}>{x.nev}</button>: {x.hiba}</li>)}</ul></div>; })()}
      <div style="margin-bottom:12px"><ArnyekoloMind p={p} modosit={modosit} /></div>
      <section class="kartya" style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap;margin-bottom:16px">
        <div style="flex:1;min-width:260px">
          <h3>Nyílászárók kora</h3>
          <p class="halkabb" style="margin-top:4px">Ebből ajánl kortipikus ablakot a program. Építés éve: {p.meta.epitesiEv}.</p>
        </div>
        <Mezo cim="Nyílászárócsere éve" sugo="Üresen: az építés éve"><Szam ertek={p.meta.nyilaszaroCsereEv} valt={(v) => modosit((q) => { q.meta.nyilaszaroCsereEv = v > 1800 ? Math.round(v) : undefined; })} /></Mezo>
        <button class="gomb fo" onClick={() => setSablonNyitva('uj')}>Kortipikus ablak hozzáadása</button>
        <button class="gomb" onClick={() => setAjtoNyitva(!ajtoNyitva)}>Ajtó, garázskapu hozzáadása</button>
      </section>
      {sablonNyitva && <SablonValaszto ev={kortipikusEv(p)} csere={sablonNyitva === 'csere'} csoport={!!cs} valaszt={sablonValaszt} bezar={() => setSablonNyitva(null)} />}
      {ajtoNyitva && <AjtoKapuValaszto valaszt={ajtoValaszt} bezar={() => setAjtoNyitva(false)} />}

      <div class="ketoszlop">
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="lista">
            {csoportok.map((c) => {
              const tagok = p.nyilaszarok.filter((x) => x.csoportId === c.id);
              const U = tagok.map((x) => nyilaszaroAdatok(x).U);
              return <>
                <button aria-pressed={kij?.t === 'cs' && kij.id === c.id} onClick={() => setKij({ t: 'cs', id: c.id })} style="background:var(--hatter, transparent)">
                  <span class="lista-cim">▾ {c.nev}</span>
                  <span class="lista-al"><span>{tagok.length} típus · közös beállítások</span><span>{U.length ? (Math.min(...U) === Math.max(...U) ? `U ${sz(U[0], 2)}` : `U ${sz(Math.min(...U), 2)}–${sz(Math.max(...U), 2)}`) : ''}</span></span>
                </button>
                {tagok.map((x) => elemGomb(x, true))}
              </>;
            })}
            {csoportNelkul.length > 0 && csoportok.length > 0 && <div class="halkabb" style="padding:8px 12px;border-bottom:1px solid var(--vonal-2)">Csoport nélkül</div>}
            {csoportNelkul.map((x) => elemGomb(x, csoportok.length > 0))}
            {!p.nyilaszarok.length && !csoportok.length && <p class="halk" style="padding:12px">Még nincs nyílászáró-típus.</p>}
          </div>
          <div><OsszesTorles db={p.nyilaszarok.length} mit="nyílászáró-típust" megjegyzes="A határolás nyílászáró-sorai is törlődnek." torol={() => { modosit((q) => { q.nyilaszarok = []; q.nyilaszaroCsoportok = []; q.feluletek = q.feluletek.filter((f) => f.fajta !== 'nyilaszaro'); }); setKij(null); }} /></div>
          <div class="gombsor">
            <button class="gomb" onClick={() => { const id = ujId(); modosit((q) => { (q.nyilaszaroCsoportok ??= []).push({ id, nev: `Csoport ${(q.nyilaszaroCsoportok?.length ?? 0) + 1}` }); }); setKij({ t: 'cs', id }); }}>Új csoport</button>
            <button class="gomb" onClick={() => felvesz(sablonbolNyilaszaro(NS.NYILASZARO_SABLONOK.find((s) => s.kod === 'pvc_3r')!, { id: ujId(), szelesseg: 1.2, magassag: 1.5, kovetelmenyKod: 'ablak_fa_pvc' }))}>Üres (új építésű) ablak</button>
            <button class="gomb" title="Schüco FW 50+: Uf 1,5 W/m²K, háromrétegű üvegezés Ug 0,6 – átírható" onClick={() => felvesz(fuggonyfalTipus(ujId(), 4, 2.7))}>Függönyfal (Schüco FW 50+)</button>
          </div>
          {tv && tv.konyvtar.nyilaszarok.length > 0 && (
            <Mezo cim="Irodai könyvtárból">
              <select value="" onChange={(e) => {
                const k = tv.konyvtar.nyilaszarok.find((x) => x.id === (e.target as HTMLSelectElement).value);
                if (k) felvesz({ ...structuredClone(k.adat), id: ujId() });
              }}>
                <option value="">Típus kiválasztása…</option>
                {tv.konyvtar.nyilaszarok.map((k) => <option value={k.id}>{k.nev} (U {sz(k.Uw, 2)})</option>)}
              </select>
            </Mezo>
          )}
        </div>
        {cs ? <CsoportSzerkeszto p={p} cs={cs} modosit={modosit} mcs={mcs} kijelol={(id) => setKij({ t: 'e', id })} sablonCsere={() => setSablonNyitva('csere')}
                torol={() => { modosit((q) => { q.nyilaszaroCsoportok = (q.nyilaszaroCsoportok ?? []).filter((c) => c.id !== cs.id); for (const x of q.nyilaszarok) if (x.csoportId === cs.id) delete x.csoportId; }); setKij(null); }} />
          : n ? <Szerkeszto p={p} n={n} m={m} csoportok={csoportok} csoportNyit={(id) => setKij({ t: 'cs', id })} sablonCsere={() => setSablonNyitva('csere')} torol={() => { modosit((q) => { q.nyilaszarok = q.nyilaszarok.filter((x) => x.id !== n.id); }); setKij(null); }} />
          : <div class="kartya halk">Válassz csoportot vagy típust, vagy vegyél fel újat.</div>}
      </div>
    </>
  );
}

const ABLAK_KODOK = new Set(['ablak_fa_pvc', 'ablak_fem', 'tetosik_ablak', 'fuggonyfal']);
/** Üvegezett (ablak, erkélyajtó, tetősík ablak) típus-e – az árnyékoló ezekre értelmes. */
export const ablakTipusE = (n: NyilaszaroTipus) => ABLAK_KODOK.has(n.kovetelmenyKod ?? '') && (n.gn ?? 0) > 0;

/** Társított árnyékoló beállítása minden árnyékoló nélküli ablaktípusra (a hűtési igényhez és a nyári hővédelemhez). */
export function ArnyekoloMind({ p, modosit }: { p: Projekt; modosit: Modosit }) {
  const [kod, setKod] = useState('redony');
  const hasznalt = new Set(p.feluletek.map((f) => f.nyilaszaroId).filter(Boolean));
  const nelkul = p.nyilaszarok.filter((n) => ablakTipusE(n) && !n.arnyekolo && hasznalt.has(n.id));
  if (!nelkul.length) return null;
  return (
    <div class="figyelmeztetes" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
      <span style="flex:1;min-width:260px">{nelkul.length} beépített ablaktípusnak nincs társított árnyékolója – nyáron a teljes napsugárzással számol (hűtési igény, nyári hővédelem). Ha a terv szerint van:</span>
      <select value={kod} aria-label="Árnyékoló" onChange={(e) => setKod((e.target as HTMLSelectElement).value)}>
        {ARNYEKOLOK.map((a) => <option value={a.kod}>{a.megnevezes} ({a.kivul !== null ? `kívül ${a.kivul}` : `belül ${a.belul}`})</option>)}
      </select>
      <button class="gomb" onClick={() => modosit((q) => {
        const a = ARNYEKOLOK.find((x) => x.kod === kod)!;
        for (const n of q.nyilaszarok) if (ablakTipusE(n) && !n.arnyekolo) n.arnyekolo = { kod, dR: REDONY_DR[kod] ?? 0, garnyH: a.kivul ?? a.belul ?? 1 };
      })}>Beállítás mind a {nelkul.length} típusra</button>
    </div>
  );
}

function AjtoKapuValaszto({ valaszt, bezar }: { valaszt: (t: AjtoKapuSablon) => void; bezar: () => void }) {
  return (
    <section class="szakasz" style="padding-top:0">
      <div class="gombsor" style="justify-content:space-between;margin-bottom:8px">
        <h2>Ajtó, garázskapu</h2>
        <button class="gomb halk-gomb semleges" onClick={bezar}>Bezár</button>
      </div>
      <p class="halk" style="margin-bottom:12px">Beépített szerkezetre vonatkozó U-értékek (garázskapuknál 5000 × 2125 mm-es, üvegezés nélküli kapura). Követelmény (9/2023 ÉKM 1. mell.): ajtó U ≤ 1,4, kapu U ≤ 1,8 W/m²K. A „becslés” jelű értékeket termékadattal pontosítsd.</p>
      {(['kapu', 'ajto'] as const).map((fj) => <>
        <h3 style="margin-bottom:8px">{fj === 'kapu' ? 'Garázskapuk' : 'Bejárati ajtók'}</h3>
        <div class="szettek" style="margin-bottom:16px">{AJTO_KAPU_SABLONOK.filter((t) => t.fajta === fj).map((t) => (
          <button class="szett" onClick={() => valaszt(t)}>
            <h3>{t.nev}</h3><p>{t.leiras}</p>
            <p class="halkabb">U = {kov(t.U)} W/m²K · {t.forras}</p>
          </button>
        ))}</div>
      </>)}
    </section>
  );
}

function SablonValaszto({ ev, csere, csoport, valaszt, bezar }: { ev: number; csere: boolean; csoport?: boolean; valaszt: (s: NS.NyilaszaroSablon) => void; bezar: () => void }) {
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
        <h2>{csere ? (csoport ? 'A csoport minden típusa sablonra' : 'A kijelölt típus cseréje sablonra') : 'Kortipikus ablak'}</h2>
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

function AblakAbra({ n, max = 180, felirat = true }: { n: NyilaszaroTipus; max?: number; felirat?: boolean }) {
  if (!n.komponens) {
    const sk0 = max / Math.max(n.szelesseg, n.magassag), W0 = n.szelesseg * sk0, H0 = n.magassag * sk0;
    const kapu = n.kovetelmenyKod === 'kapu';
    return (
      <svg viewBox={`-6 -6 ${W0 + 12} ${H0 + (felirat ? 22 : 12)}`} width={W0 + 12} role="img" aria-label={kapu ? 'Kapu' : 'Ajtó vagy ablak'} class="ablak-abra">
        <rect x={0} y={0} width={W0} height={H0} class="ablak-keret" />
        {kapu ? Array.from({ length: 4 }, (_, i) => <line x1={4} x2={W0 - 4} y1={(H0 * (i + 1)) / 5} y2={(H0 * (i + 1)) / 5} class="ablak-lec" />)
          : n.kovetelmenyKod === 'ajto' ? <circle cx={W0 * 0.82} cy={H0 * 0.52} r={Math.max(2, W0 * 0.03)} class="ablak-lec" /> : <rect x={W0 * 0.1} y={H0 * 0.1} width={W0 * 0.8} height={H0 * 0.8} class="ablak-uveg" />}
        {felirat && <text x={W0 / 2} y={H0 + 14} text-anchor="middle" class="ablak-felirat">{sz(n.szelesseg * 100, 0)} × {sz(n.magassag * 100, 0)} cm</text>}
      </svg>
    );
  }
  const g = nyilaszaroGeometria(n);
  const k = n.komponens;
  const W = n.szelesseg, H = n.magassag;
  const sk = max / Math.max(W, H);
  const kv = k.keretMm / 1000, ov = (k.osztoMm ?? 2 * k.keretMm) / 1000;
  const nx = Math.max(1, k.oszlop ?? 1), ny = Math.max(1, k.sor ?? 1);
  const mezok: { x: number; y: number }[] = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) mezok.push({ x: kv + i * (g.mezoSzel + ov), y: kv + j * (g.mezoMag + ov) });
  return (
    <svg viewBox={`-6 -6 ${W * sk + 12} ${H * sk + (felirat ? 22 : 12)}`} width={W * sk + 12} role="img" aria-label={`Ablak ${nx} × ${ny} mezővel`} class="ablak-abra">
      <rect x={0} y={0} width={W * sk} height={H * sk} class="ablak-keret" />
      {mezok.map((m) => (
        <g>
          <rect x={m.x * sk} y={m.y * sk} width={g.mezoSzel * sk} height={g.mezoMag * sk} class={k.kapcsoltResMm ? 'ablak-uveg kapcsolt' : 'ablak-uveg'} />
          {k.lec && Array.from({ length: k.lec.fuggoleges }, (_, i) => <line x1={(m.x + (g.mezoSzel * (i + 1)) / (k.lec!.fuggoleges + 1)) * sk} x2={(m.x + (g.mezoSzel * (i + 1)) / (k.lec!.fuggoleges + 1)) * sk} y1={m.y * sk} y2={(m.y + g.mezoMag) * sk} class="ablak-lec" />)}
          {k.lec && Array.from({ length: k.lec.vizszintes }, (_, i) => <line y1={(m.y + (g.mezoMag * (i + 1)) / (k.lec!.vizszintes + 1)) * sk} y2={(m.y + (g.mezoMag * (i + 1)) / (k.lec!.vizszintes + 1)) * sk} x1={m.x * sk} x2={(m.x + g.mezoSzel) * sk} class="ablak-lec" />)}
        </g>
      ))}
      {felirat && <text x={(W * sk) / 2} y={H * sk + 14} text-anchor="middle" class="ablak-felirat">{sz(W * 100, 0)} × {sz(H * 100, 0)} cm · üveg {sz((g.Aü / g.A) * 100, 0)}%</text>}
    </svg>
  );
}


/** A csoportban közösen állítható jellemzők: típus, számítási mód, üvegezés, keret, kézi Uw, árnyékoló. */
function KozosBeallitasok({ n, m, sablonCsere }: { n: NyilaszaroTipus; m: M; sablonCsere: () => void }) {
  const d = nyilaszaroAdatok(n);
  const komp = n.komponens;
  const mod = !komp ? 'kezi' : komp.kapcsoltResMm ? 'kapcsolt' : 'egyheju';
  const mk = (fn: (c: NyilaszaroKomponens) => void) => m((x) => { if (!x.komponens) return; fn(x.komponens); if (!x.komponens.psiKezi) { const ps = psiTablabol(x.komponens); if (ps !== null) x.komponens.psi = ps; } });
  return (
    <>
      <section>
        <div class="gombsor" style="margin-bottom:12px">
          <Valaszto cimke="Típus" ertek={n.kovetelmenyKod} valt={(v) => m((x) => { x.kovetelmenyKod = v; })} opciok={TIPUSOK} />
          <Valaszto cimke="Számítás módja" ertek={mod} valt={(v) => m((x) => {
            if (v === 'kezi') { x.uwKezi = Number(nyilaszaroAdatok(x).U.toFixed(2)); delete x.komponens; return; }
            x.komponens ??= sablonbolNyilaszaro(NS.NYILASZARO_SABLONOK.find((s) => s.kod === 'pvc_5_2005')!, x).komponens!;
            if (v === 'kapcsolt') { x.komponens.kapcsoltResMm ??= 50; } else delete x.komponens.kapcsoltResMm;
            delete x.uwKezi;
          })} opciok={[{ ertek: 'egyheju', nev: 'Részletes számítás összetevőkből (4.16)' }, { ertek: 'kapcsolt', nev: 'Kapcsolt szárnyú, kéthéjú ablak (4.17)' }, { ertek: 'kezi', nev: 'Teljesítménynyilatkozat szerinti Uw' }]} />
          <button class="gomb" onClick={sablonCsere}>Kortipikus sablon betöltése</button>
        </div>
        {komp ? (
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
              <Mezo cim="Távtartó" sugo={komp.psiKezi ? 'A Ψ kézi értékre van állítva – a távtartó váltása visszaállítja a táblázati értékre' : `Ψ = ${sz(komp.psi, 2)} W/mK (4.3. táblázat)`}><Valaszto ertek={komp.tavtarto ?? 'fem'} valt={(v) => mk((c) => { c.tavtarto = v; c.psiKezi = false; })} opciok={TAVTARTO} /></Mezo>
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

          </div>
        ) : (
          <div class="racs">
            {(n.kovetelmenyKod === 'ajto' || n.kovetelmenyKod === 'kapu') && (
              <Mezo cim={n.kovetelmenyKod === 'kapu' ? 'Kaputípus' : 'Ajtótípus'} szeles sugo="Beépített szerkezetre vonatkozó U (termékadat felülírja)">
                <select onChange={(e) => { const t = AJTO_KAPU_SABLONOK.find((x) => x.kod === (e.target as HTMLSelectElement).value); if (t) m((x) => { x.uwKezi = t.U; x.sablonKod = t.kod; x.kovetelmenyKod = t.fajta; x.gn = 0; }); }}>
                  <option value="" selected={!AJTO_KAPU_SABLONOK.some((t) => t.kod === n.sablonKod)}>Egyedi (termékadat)</option>
                  {AJTO_KAPU_SABLONOK.filter((t) => t.fajta === n.kovetelmenyKod).map((t) => <option value={t.kod} selected={n.sablonKod === t.kod}>{t.nev} – U {kov(t.U)}{t.becsles ? ' (becslés)' : ''}</option>)}
                </select>
              </Mezo>
            )}
            <Mezo cim="Uw"><Szam ertek={n.uwKezi} egyseg="W/m²K" valt={(v) => m((x) => { x.uwKezi = v; x.sablonKod = undefined; })} /></Mezo>
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
    </>
  );
}

function CsoportSzerkeszto({ p, cs, modosit, mcs, kijelol, sablonCsere, torol }: { p: Projekt; cs: NyilaszaroCsoport; modosit: Modosit; mcs: M; kijelol: (id: string) => void; sablonCsere: () => void; torol: () => void }) {
  const tagok = p.nyilaszarok.filter((x) => x.csoportId === cs.id);
  const elso = tagok[0];
  const elter = elteroKozos(tagok);
  const mt = (id: string, fn: (x: NyilaszaroTipus) => void) => modosit((q) => { const x = q.nyilaszarok.find((y) => y.id === id); if (x) fn(x); });
  const db = (id: string) => p.feluletek.filter((f) => f.fajta === 'nyilaszaro' && f.nyilaszaroId === id).reduce((a, f) => a + (f.darab ?? 1), 0);
  return (
    <div style="display:flex;flex-direction:column;gap:16px">
      <div class="racs">
        <Mezo cim="Csoport neve" szeles><Szoveg ertek={cs.nev} valt={(v) => modosit((q) => { const c = q.nyilaszaroCsoportok?.find((x) => x.id === cs.id); if (c) c.nev = v; })} /></Mezo>
      </div>
      {elso ? <>
        <div class="kartya" style="padding:12px 14px">
          <strong>Közös jellemzők</strong> <span class="halkabb">– a csoport mind a {tagok.length} típusára egyszerre érvényes; a méret és az osztás típusonként a lenti táblázatban állítható.</span>
          {elter.length > 0 && <div class="figyelmeztetes" style="margin-top:8px">A tagoknál eltér: {elter.join(', ')}. Az itt megadott érték mindegyikre átíródik (a mezők az első típus értékét mutatják).</div>}
        </div>
        <KozosBeallitasok n={elso} m={mcs} sablonCsere={sablonCsere} />
        <section>
          <h3 style="margin-bottom:8px">Típusok a csoportban</h3>
          <div class="tabla-gorgeto" style="overflow-x:auto"><table class="tabla">
            <thead><tr><th>Ábra</th><th>Megnevezés</th><th class="szam">Szélesség</th><th class="szam">Magasság</th><th class="szam">Felület / üveg</th><th class="szam">U</th><th class="szam">Beépítve</th><th></th></tr></thead>
            <tbody>{tagok.map((x) => { const d = nyilaszaroAdatok(x); return (
              <tr>
                <td style="width:60px" title={x.komponens ? `${x.komponens.oszlop ?? 1} × ${x.komponens.sor ?? 1} mező` : ''}><AblakAbra n={x} max={44} felirat={false} /></td>
                <td style="min-width:130px"><Szoveg ertek={x.nev} valt={(v) => mt(x.id, (y) => { y.nev = v; })} /></td>
                <td style="width:88px"><Szam cimke="Szélesség" ertek={x.szelesseg} egyseg="m" valt={(v) => mt(x.id, (y) => { y.szelesseg = v; })} /></td>
                <td style="width:88px"><Szam cimke="Magasság" ertek={x.magassag} egyseg="m" valt={(v) => mt(x.id, (y) => { y.magassag = v; })} /></td>
                <td class="szam">{sz(d.A, 2)} / {sz(d.Au, 2)} m²</td>
                <td class="szam"><strong>{sz(d.U, 2)}</strong></td>
                <td class="szam">{db(x.id)} db</td>
                <td style="white-space:nowrap">
                  <button class="gomb halk-gomb semleges" onClick={() => kijelol(x.id)}>Részletek</button>
                  <button class="gomb halk-gomb semleges" onClick={() => { const id = ujId(); modosit((q) => { const y = q.nyilaszarok.find((z) => z.id === x.id); if (y) q.nyilaszarok.push({ ...structuredClone(y), id, nev: `${y.nev} (másolat)` }); }); }}>Másolat</button>
                </td>
              </tr>
            ); })}</tbody>
          </table></div>
          <div class="gombsor" style="margin-top:10px">
            <button class="gomb" onClick={() => { const id = ujId(); modosit((q) => { const y = q.nyilaszarok.find((z) => z.id === elso.id); if (y) q.nyilaszarok.push({ ...structuredClone(y), id, nev: `${y.nev.replace(/\s*\d+\s*[×x]\s*\d+.*$/, '')} új méret` }); }); }}>Új méret a csoportba</button>
            <span style="flex:1" />
            <button class="gomb halk-gomb" onClick={torol}>Csoport megszüntetése (a típusok megmaradnak)</button>
          </div>
        </section>
      </> : (
        <div class="kartya halk">A csoport üres. Vegyél fel típust (a kijelölt csoportba kerül), vagy egy típus „Csoport” mezőjében rendeld ide.
          <div class="gombsor" style="margin-top:10px"><button class="gomb halk-gomb" onClick={torol}>Csoport törlése</button></div>
        </div>
      )}
    </div>
  );
}

function Szerkeszto({ p, n, m, torol, sablonCsere, csoportok, csoportNyit }: { p: Projekt; n: NyilaszaroTipus; m: M; torol: () => void; sablonCsere: () => void; csoportok: NyilaszaroCsoport[]; csoportNyit: (id: string) => void }) {
  const d = nyilaszaroAdatok(n);
  const k = kovetelmenyNev(n.kovetelmenyKod);
  const megfelel = k ? d.U <= k.Umax + 1e-9 : null;
  const minosites = k?.ertekelesiSor ? kovetelmeny.szerkezetMinosites(k.ertekelesiSor, d.U) : null;
  const komp = n.komponens;
  const mod = !komp ? 'kezi' : komp.kapcsoltResMm ? 'kapcsolt' : 'egyheju';
  const mk = (fn: (c: NyilaszaroKomponens) => void) => m((x) => { fn(x.komponens!); if (!x.komponens!.psiKezi) { const ps = psiTablabol(x.komponens!); if (ps !== null) x.komponens!.psi = ps; } });
  const sablon = NS.NYILASZARO_SABLONOK.find((s) => s.kod === n.sablonKod);
  const ajtoSablon = AJTO_KAPU_SABLONOK.find((s) => s.kod === n.sablonKod);
  const g = komp ? nyilaszaroGeometria(n) : null;
  const cs = csoportok.find((c) => c.id === n.csoportId);
  void p;

  return (
    <div style="display:flex;flex-direction:column;gap:16px">
      <div class="racs">
        <Mezo cim="Megnevezés" szeles><Szoveg ertek={n.nev} valt={(v) => m((x) => { x.nev = v; })} /></Mezo>
        <Mezo cim="Csoport"><Valaszto ertek={n.csoportId ?? ''} valt={(v) => m((x) => { if (v) x.csoportId = v; else delete x.csoportId; })} opciok={[{ ertek: '', nev: 'Csoport nélkül' }, ...csoportok.map((c) => ({ ertek: c.id, nev: c.nev }))]} /></Mezo>
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
            {ajtoSablon && <><dt>Típus</dt><dd>{ajtoSablon.nev}{ajtoSablon.becsles ? ' (becslés)' : ''}</dd></>}
          </dl>
          <div style="display:flex;flex-direction:column;gap:4px">
            {k && <span class={`jel ${megfelel ? 'jo' : 'rossz'}`}>{megfelel ? 'Megfelel' : 'Nem felel meg'}: U ≤ {kov(k.Umax)} W/m²K</span>}
            {minosites && <span class="halkabb">Minősítés: {({ kivalo: 'kiváló', jo: 'jó', kozepes: 'közepes', gyenge: 'gyenge', rossz: 'rossz' } as const)[minosites]}</span>}
          </div>
        </div>
      </div>

      {cs ? (
        <div class="kartya" style="padding:12px 14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <span style="flex:1;min-width:240px">A közös jellemzők (típus, üvegezés, keret, Ψ, árnyékoló) a <strong>{cs.nev}</strong> csoport tetején állíthatók: {komp ? `Ug ${kov(komp.Ug)}, Uk ${kov(komp.Uk)}, keret ${komp.keretMm} mm, g ${kov(n.gn)}` : `Uw ${kov(n.uwKezi ?? 0)}`}{n.arnyekolo ? `, árnyékoló: ${ARNYEKOLOK.find((a) => a.kod === n.arnyekolo!.kod)?.megnevezes ?? n.arnyekolo.kod}` : ''}.</span>
          <button class="gomb" onClick={() => csoportNyit(cs.id)}>Csoport beállításai</button>
        </div>
      ) : <KozosBeallitasok n={n} m={m} sablonCsere={sablonCsere} />}

      {komp && <>
        <div class="gep-racs">
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
      </>}
      <div class="gombsor"><KonyvtarbaGomb nev={n.nev + n.szelesseg + n.magassag} mentes={(irodaId) => nyilaszaroKonyvtarba(irodaId, n, d.U)} /><span style="flex:1" /><button class="gomb halk-gomb" onClick={torol}>Típus törlése</button></div>
    </div>
  );
}
