import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Projekt, HohidUI } from '../modell';
import { chiErvenyes } from '../modell';
import { Mezo, Szam, Szoveg, Valaszto, sz } from '../ui';
import { HOHID_SABLONOK, sablon, alapParameterek, type Parameter } from '../hohid/katalogus';
import { hohidSzamolHatter, ujHohid, projektParameterek, javasoltHossz, ajanlott, type HohidSzamitas } from '../hohid/projekt';
import { geometriaRajz, izotermRajz } from '../hohid/rajz';

type Modosit = (f: (q: Projekt) => void) => void;

function Ikon({ kod }: { kod: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const s = sablon(kod); if (s && ref.current) geometriaRajz(ref.current, s.epit(alapParameterek(s)).geometria, 220, false); }, [kod]);
  return <canvas ref={ref} aria-hidden="true" style="display:block;width:100%;border-radius:6px" />;
}

function letolt(nev: string, adat: Blob) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(adat); a.download = nev; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function HohidakLepes({ p, modosit }: { p: Projekt; modosit: Modosit }) {
  const hidak = p.hohidak ?? [];
  const [aktiv, setAktiv] = useState<string | null>(hidak[0]?.id ?? null);
  const [katalog, setKatalog] = useState(!hidak.length);
  const aj = ajanlott(p);
  const h = hidak.find((x) => x.id === aktiv) ?? null;
  const mod = p.hohidMod ?? 'chi';
  const osszPsiL = hidak.filter((x) => x.szamit && x.eredmeny && !x.padloId).reduce((a, x) => a + (x.meretrendszer === 'kulso' ? x.eredmeny!.psiE : x.eredmeny!.psiI) * x.hossz, 0);

  function uj(kod: string) {
    const x = ujHohid(p, kod);
    modosit((q) => { (q.hohidak ??= []).push(x); });
    setAktiv(x.id); setKatalog(false);
  }
  async function pdf(lista: HohidUI[]) {
    const { hohidPdf } = await import('../hohid/pdf');
    const b = await hohidPdf(p, lista);
    letolt(`hohid_${(p.meta.nev || 'projekt').replace(/[^\p{L}\d]+/gu, '_')}.pdf`, new Blob([b as BlobPart], { type: 'application/pdf' }));
  }

  return (
    <>
      <section class="szakasz">
        <h2>Hőhidak a számításban</h2>
        <p class="halk">Egyszerűsített módszernél a felületek χ tényezője (6.1. táblázat) veszi figyelembe a hőhidakat. Részletes módszernél a χ helyett az itt számított vonalmenti Ψ · l tagok kerülnek a fajlagos hőveszteség-tényezőbe (MSZ EN ISO 10211, 14683). Vegyes módban a kijelölt felületeken a Ψ · l, a többin továbbra is a χ számít. A padlóhoz rendelt lábazati csomópont Ψ-je minden módban a padló–fal csatlakozás Ψ-jét adja.</p>
        <div class="gombsor" style="gap:18px">
          <label><input type="radio" name="hhmod" checked={mod === 'chi'} onChange={() => modosit((q) => { q.hohidMod = 'chi'; })} /> Egyszerűsített (χ a határoló felületeken)</label>
          <label><input type="radio" name="hhmod" checked={mod === 'vegyes'} onChange={() => modosit((q) => { q.hohidMod = 'vegyes'; })} /> Vegyes (felületenként χ vagy Ψ · l)</label>
          <label><input type="radio" name="hhmod" checked={mod === 'psi'} onChange={() => modosit((q) => { q.hohidMod = 'psi'; })} /> Részletes (csak Ψ · l)</label>
        </div>
        {mod !== 'chi' && <p class="halkabb" style="margin-top:8px">A számításba vett vonalmenti hőhidak összesen: Σ Ψ·l = <strong>{sz(osszPsiL, 2)} W/K</strong>{mod === 'psi' ? '. A felületek χ értéke ilyenkor nem számít – ügyelj, hogy minden lényeges csomópont (sarkok, födémcsatlakozások, nyílászáró-beépítések, attika) szerepeljen.' : '.'}</p>}
        {mod === 'vegyes' && (
          <div style="margin-top:10px">
            <p class="halkabb" style="margin-bottom:6px">Jelöld be azokat a felületeket, amelyek csatlakozási hőhídjait a csomópont-számítás fedi le – ezeknél a χ nem számít. Vigyázz a kettős számításra: egy bejelöletlen felület χ-je és egy rá vonatkozó Ψ·l egyszerre is bekerül.</p>
            <div class="tabla-gorgeto"><table class="tabla">
              <thead><tr><th>Felület</th><th class="szam">Felület, m²</th><th class="szam">χ (táblázat)</th><th>χ helyett Ψ·l</th><th class="szam">Érvényes χ</th></tr></thead>
              <tbody>{p.feluletek.filter((f) => f.fajta === 'opak').map((f) => (
                <tr>
                  <td>{f.nev}</td><td class="szam">{sz(f.A ?? (f.meret ? f.meret.hossz * f.meret.magassag : 0), 2)}</td><td class="szam">{sz(f.chi ?? 0, 2)}</td>
                  <td><input type="checkbox" aria-label={`${f.nev}: χ helyett Ψ`} checked={!!f.chiPsi} onChange={(e) => modosit((q) => { q.feluletek.find((x) => x.id === f.id)!.chiPsi = (e.target as HTMLInputElement).checked; })} /></td>
                  <td class="szam">{sz(chiErvenyes(p, f), 2)}</td>
                </tr>
              ))}</tbody>
            </table></div>
          </div>
        )}
      </section>

      <section class="szakasz">
        <h2>Csomópontok</h2>
        {hidak.length > 0 && (
          <div class="tabla-gorgeto"><table class="tabla">
            <thead><tr><th>Csomópont</th><th class="szam">Ψ</th><th class="szam">Hossz</th><th class="szam">Ψ·l</th><th class="szam">θsi,min / fRsi</th><th>Számításba</th><th></th></tr></thead>
            <tbody>{hidak.map((x) => { const psi = x.eredmeny ? (x.meretrendszer === 'kulso' ? x.eredmeny.psiE : x.eredmeny.psiI) : null; return (
              <tr style={x.id === aktiv ? 'background:var(--kijelolt)' : ''}>
                <td><button class="link-gomb" onClick={() => { setAktiv(x.id); setKatalog(false); }}>{x.nev}</button></td>
                <td class="szam">{psi !== null ? `${sz(psi, 3)} W/mK` : '–'}</td>
                <td class="szam">{x.padloId ? <span class="halkabb">padló Ψ</span> : `${sz(x.hossz, 2)} m`}</td>
                <td class="szam">{psi !== null && !x.padloId ? `${sz(psi * x.hossz, 2)} W/K` : '–'}</td>
                <td class="szam">{x.eredmeny ? `${sz(x.eredmeny.thetaSiMin, 1)} °C / ${sz(x.eredmeny.fRsi, 2)}` : '–'}</td>
                <td><input type="checkbox" aria-label={`${x.nev} számításba`} checked={x.szamit} onChange={(e) => modosit((q) => { q.hohidak!.find((y) => y.id === x.id)!.szamit = (e.target as HTMLInputElement).checked; })} /></td>
                <td><button class="gomb halk-gomb" onClick={() => { modosit((q) => { q.hohidak = q.hohidak!.filter((y) => y.id !== x.id); }); if (aktiv === x.id) setAktiv(null); }}>Törlés</button></td>
              </tr>
            ); })}</tbody>
          </table></div>
        )}
        <p class="halkabb" style="margin-top:8px">A katalógus csomópontjai a svájci BFE Wärmebrückenkatalog (2002) táblázataival validáltak (erkélylemez, attika, lapostető, előtető, belső szigetelésű födém- és falcsatlakozás: ±0,04 W/mK-en belül).</p>
        <div class="gombsor" style="margin-top:12px">
          <button class="gomb fo" onClick={() => setKatalog(!katalog)}>{katalog ? 'Katalógus bezárása' : 'Új hőhíd a katalógusból'}</button>
          {hidak.some((x) => x.eredmeny) && <button class="gomb" onClick={() => void pdf(hidak.filter((x) => x.eredmeny))}>Összes hőhíd PDF-ben</button>}
        </div>
        {katalog && (
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin-top:14px">
            {HOHID_SABLONOK.map((s) => (
              <button class="kartya" style="text-align:left;cursor:pointer;display:flex;flex-direction:column;gap:6px;padding:10px" onClick={() => uj(s.kod)}>
                <Ikon kod={s.kod} />
                <strong>{s.nev}{aj.has(s.kod) && <span class="jel jo" style="margin-left:6px;font-size:11px">ajánlott</span>}</strong>
                <span class="halkabb">{s.leiras}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {h && <Szerkeszto key={h.id} p={p} h={h} modosit={modosit} pdf={() => void pdf([h])} />}
    </>
  );
}

function Szerkeszto({ p, h, modosit, pdf }: { p: Projekt; h: HohidUI; modosit: Modosit; pdf: () => void }) {
  const s = sablon(h.sablon)!;
  const mh = (fn: (x: HohidUI) => void) => modosit((q) => { const x = q.hohidak!.find((y) => y.id === h.id); if (x) fn(x); });
  const param = { ...alapParameterek(s), ...h.param };
  const kulcs = JSON.stringify([h.sablon, param, h.thetaI, h.thetaE]);
  const [sz2, setSz2] = useState<HohidSzamitas | null>(null);
  const [szamol, setSzamol] = useState(false);
  // késleltetett újraszámítás paraméterváltozáskor
  useEffect(() => {
    setSzamol(true);
    let el = false;
    const t = setTimeout(() => {
      hohidSzamolHatter(h).then((r) => {
        if (el) return;
        setSzamol(false); setSz2(r);
        if (r && JSON.stringify(r.eredmeny) !== JSON.stringify(h.eredmeny)) mh((x) => { x.eredmeny = r.eredmeny; });
      }).catch(() => { if (!el) setSzamol(false); });
    }, 250);
    return () => { el = true; clearTimeout(t); };
  }, [kulcs]);
  const geo = useMemo(() => s.epit(param).geometria, [kulcs]);
  const gRef = useRef<HTMLCanvasElement>(null), iRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (gRef.current) geometriaRajz(gRef.current, geo, 420); }, [geo]);
  useEffect(() => { if (iRef.current && sz2) izotermRajz(iRef.current, sz2.csomopont.geometria, sz2.mf, h.thetaI, h.thetaE, 420); }, [sz2]);
  const csoportok = [...new Set(s.parameterek.map((q) => q.csoport ?? ''))];
  const jh = javasoltHossz(p, s);
  const e = sz2?.eredmeny ?? h.eredmeny;
  const psi = e ? (h.meretrendszer === 'kulso' ? e.psiE : e.psiI) : null;
  // függvényként (nem komponensként) hívva: így újrarajzoláskor nem jön létre új komponenstípus, a mező nem veszti el a fókuszt
  const paramMezo = (q: Parameter) => {
    const v = param[q.kulcs]!; const cm = q.egyseg === 'm';
    return <><span title={q.nev}>{q.nev}</span><Szam cimke={q.nev} ertek={cm ? Math.round(v * 1000) / 10 : v} egyseg={cm ? 'cm' : q.egyseg} valt={(u) => mh((x) => { const w = cm ? u / 100 : u; x.param = { ...x.param, [q.kulcs]: Math.min(q.max, Math.max(q.min, w)) }; })} /></>;
  };
  return (
    <section class="szakasz">
      <div class="gombsor" style="justify-content:space-between;align-items:baseline;margin-bottom:4px">
        <h2>{h.nev}</h2>
        <button class="gomb halk-gomb semleges" onClick={() => { const r = projektParameterek(p, s); mh((x) => { x.param = r.param; }); }}>Paraméterek a projekt szerkezeteiből</button>
      </div>
      <p class="halk" style="margin-bottom:10px">{s.leiras}</p>
      <div class="hohid-fo">
        {/* bal panel: tömör adatmegadás, alatta az eredmény – az ábrák magasságáig, ha hosszabb, görgethető */}
        <div class="hohid-panel"><div class="hohid-panel-belso">
          <div class="hh-gorgeto">
          <div class="hh-param">
            <span>Megnevezés</span><Szoveg ertek={h.nev} valt={(v) => mh((x) => { x.nev = v; })} />
            <span>Belső hőmérséklet θi</span><Szam cimke="Belső hőmérséklet" ertek={h.thetaI} egyseg="°C" valt={(v) => mh((x) => { x.thetaI = v; })} />
            <span>Külső hőmérséklet θe</span><Szam cimke="Külső hőmérséklet" ertek={h.thetaE} egyseg="°C" valt={(v) => mh((x) => { x.thetaE = v; })} />
          </div>
          {csoportok.map((c) => (
            <div class="hh-csoport">
              <div class="hh-csoport-cim">{c || 'Paraméterek'}</div>
              <div class="hh-param">{s.parameterek.filter((q) => (q.csoport ?? '') === c).map((q) => paramMezo(q))}</div>
            </div>
          ))}
          </div>
          <div class="hh-csoport hh-eredmeny-blokk">
            <div class="hh-csoport-cim">Eredmény {szamol && <span class="halkabb">– számítás…</span>}</div>
            {e && <table class="tabla hh-eredmeny">
              <tbody>
                <tr><td>L2D</td><td class="szam">{sz(e.L2D, 4)} W/mK</td></tr>
                {e.karimak.map((k) => <tr><td>{k.nev}: U {sz(k.U, 3)} · l {sz(h.meretrendszer === 'kulso' ? k.lKulso : k.lBelso, 2)} m</td><td class="szam">{sz(k.U * (h.meretrendszer === 'kulso' ? k.lKulso : k.lBelso), 4)}</td></tr>)}
                <tr><td><strong>Ψ{h.meretrendszer === 'kulso' ? 'e (külső méret)' : 'i (belső méret)'}</strong></td><td class="szam"><strong>{sz(psi!, 3)} W/mK</strong></td></tr>
                <tr><td>Ψ{h.meretrendszer === 'kulso' ? 'i' : 'e'}</td><td class="szam">{sz(h.meretrendszer === 'kulso' ? e.psiI : e.psiE, 3)} W/mK</td></tr>
                <tr><td>θsi,min / fRsi</td><td class="szam">{sz(e.thetaSiMin, 1)} °C / {sz(e.fRsi, 3)}</td></tr>
              </tbody>
            </table>}
            {e && e.fRsi < 0.75 && <div class="figyelmeztetes" style="margin-top:6px;font-size:13px">fRsi &lt; 0,75: penészedés, felületi páralecsapódás veszélye (MSZ EN ISO 13788).</div>}
          </div>
        </div></div>
        <figure class="kartya hohid-abra"><canvas ref={gRef} role="img" aria-label="A csomópont geometriája" /><figcaption class="halkabb">Geometria, anyagok</figcaption></figure>
        <figure class="kartya hohid-abra"><canvas ref={iRef} role="img" aria-label="Izotermás hőmérséklet-eloszlás" /><figcaption class="halkabb">Izotermák (Rsi = 0,25)</figcaption></figure>
      </div>

      <div class="racs" style="margin-top:14px">
        <Mezo cim="Méretrendszer" sugo="A program a felületeket belső (nettó) méretből számítja – ehhez a belső méretrendszerű Ψ illik">
          <Valaszto ertek={h.meretrendszer} valt={(v) => mh((x) => { x.meretrendszer = v; })} opciok={[{ ertek: 'belso', nev: 'Belső (Ψi)' }, { ertek: 'kulso', nev: 'Külső (Ψe)' }]} />
        </Mezo>
        {s.csoport === 'labazat' && (
          <Mezo cim="Átvitel a padlóhoz" sugo="A választott talajon fekvő padló padló–fal csatlakozási Ψ-je ebből a számításból adódik (a padló kerületével szorozva), külön vonalmenti tagként nem kerül be">
            <Valaszto ertek={h.padloId ?? ''} valt={(v) => mh((x) => { x.padloId = v || undefined; })} opciok={[{ ertek: '', nev: 'Nincs (vonalmenti tag)' }, ...p.feluletek.filter((f) => f.fajta === 'padlo').map((f) => ({ ertek: f.id, nev: f.nev }))]} />
          </Mezo>
        )}
        {!h.padloId && <Mezo cim="Hossz a projektben" sugo={jh ? `Javaslat: ${sz(jh.hossz, 2)} m (${jh.leiras})` : 'A csomópont hossza az épületben'}>
          <div class="egyseg"><Szam ertek={h.hossz} egyseg="m" valt={(v) => mh((x) => { x.hossz = Math.max(0, v); })} />{jh && <button class="gomb halk-gomb" onClick={() => mh((x) => { x.hossz = jh.hossz; })}>javaslat</button>}</div>
        </Mezo>}
        <div class="mezo"><span>Átvitel</span>
          <label><input type="checkbox" checked={h.szamit} onChange={(ev) => mh((x) => { x.szamit = (ev.target as HTMLInputElement).checked; })} /> Számításba veszem{h.padloId ? '' : ' (részletes / vegyes módban)'}</label>
          {psi !== null && !h.padloId && <small>Ψ·l = {sz(psi * h.hossz, 2)} W/K</small>}
          {h.padloId && <small>a padló Ψ padló–fal értéke: {psi !== null ? sz(psi, 3) : '–'} W/mK</small>}
        </div>
      </div>
      <div class="gombsor" style="margin-top:10px">
        <button class="gomb" disabled={!sz2} onClick={() => iRef.current?.toBlob((b) => b && letolt(`${h.nev}_izoterma.png`, b))}>Izotermás ábra (PNG)</button>
        <button class="gomb" disabled={!e} onClick={pdf}>Hőhíd-jegyzőkönyv (PDF)</button>
      </div>
      {s.csoport === 'labazat' && <p class="halkabb" style="margin-top:6px">Talajmodell (MSZ EN ISO 10211): λtalaj = 2,0 W/mK, a modell az épületen belül B'/2, kívül és lefelé 2,5·B' kiterjedésű; az ábra a csomópont környezetét mutatja. Ψ = L2D − Ufal·hfal − U0·B'/2, ahol U0 a padló MSZ EN ISO 13370 szerinti alapértéke (peremszigetelés nélkül – azt a 2D modell tartalmazza, ezért a padlónál ne adj meg külön peremszigetelést).</p>}
      <p class="halkabb" style="margin-top:6px">Ψ: Rsi = 0,13, Rse = 0,04 m²K/W, adiabatikus vágósíkok (MSZ EN ISO 10211). Az izotermás ábra Rsi = 0,25 m²K/W-mal (felületi hőmérséklet-vizsgálat) készül; 1 °C-onkénti izotermák, a piros pont a legalacsonyabb belső felületi hőmérséklet.</p>
    </section>
  );
}
