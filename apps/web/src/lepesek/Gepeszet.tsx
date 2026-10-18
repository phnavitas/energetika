import { GEPESZETI_SZETTEK, type EpuletEredmeny } from '@mag/index';
import { Mezo, Szam, sz } from '../ui';
import { vanErpHotermelo, type Projekt } from '../modell';

type Modosit = (fn: (p: Projekt) => void) => void;

// Azonos HMV-beállítású szettek egyszer jelenjenek meg.
const HMV_OPCIOK = GEPESZETI_SZETTEK.filter((s, i, t) => t.findIndex((x) => JSON.stringify(x.hmv) === JSON.stringify(s.hmv)) === i);
const hmvAzonos = (a: string, b: string) => {
  const x = GEPESZETI_SZETTEK.find((s) => s.kod === a), y = GEPESZETI_SZETTEK.find((s) => s.kod === b);
  return !!x && !!y && JSON.stringify(x.hmv) === JSON.stringify(y.hmv);
};
function hmvLeiras(s: (typeof GEPESZETI_SZETTEK)[number]) {
  const h = s.hmv;
  const tarolo = h.tarolo ? `tároló a fűtött téren ${h.tarolo.hely === 'belul' ? 'belül' : 'kívül'}` : 'tároló nélkül';
  const eloszt = `elosztás ${h.elosztas.cirkulacio ? 'cirkulációval' : 'cirkuláció nélkül'}, fűtött téren ${h.elosztas.hely === 'belul' ? 'belül' : 'kívül'}`;
  return `${tarolo[0]!.toUpperCase()}${tarolo.slice(1)}; ${eloszt}.`;
}

export function GepeszetLepes({ p, modosit, eredmeny }: { p: Projekt; modosit: Modosit; eredmeny: EpuletEredmeny | null }) {
  const f = eredmeny?.rendszerek.find((r) => r.cel === 'futes');
  const h = eredmeny?.rendszerek.find((r) => r.cel === 'hmv');
  return (
    <>
      <section class="szakasz">
        <h2>Fűtés</h2>
        <p class="halk">Válaszd ki a rendszert; a veszteségeket és segédenergiát a program a 8. fejezet táblázataiból számolja a rendszer alapterületére. Ha a hőtermelőnek van ErP adatlapja, add meg a szezonális hatásfokát – ez pontosabb a táblázati értéknél.</p>
        <div class="szettek">
          {GEPESZETI_SZETTEK.map((s) => (
            <button class="szett" aria-pressed={p.gepeszet.futesSzett === s.kod} onClick={() => modosit((q) => { q.gepeszet.futesSzett = s.kod; q.gepeszet.futesErpEta = null; })}>
              <h3>{s.nev}</h3>
              <p>{s.leiras}</p>
            </button>
          ))}
        </div>
        <div class="racs" style="margin-top:16px">
          {vanErpHotermelo(p.gepeszet.futesSzett, 'futes') && (
            <Mezo cim="Szezonális hatásfok ηs (ErP adatlap)" sugo="Üresen hagyva a táblázati teljesítménytényező érvényes. Hőszivattyúnál εF = 1 / (2,5 · ηs).">
              <Szam ertek={p.gepeszet.futesErpEta ? p.gepeszet.futesErpEta * 100 : undefined} egyseg="%" valt={(v) => modosit((q) => { q.gepeszet.futesErpEta = v > 0 ? v / 100 : null; })} />
            </Mezo>
          )}
        </div>
        {f && (
          <dl class="mutatok kartya" style="margin-top:16px">
            <dt>Nettó fűtési igény</dt><dd>{sz(f.reszletek.QFnetFR, 0)} kWh/a</dd>
            <dt>Szabályozási tényező εF,szab</dt><dd>{sz(f.reszletek.epszilonSzab, 3)}</dd>
            <dt>Elosztási veszteség</dt><dd>{sz(f.reszletek.qSzall, 2)} kWh/m²a</dd>
            <dt>Hőtermelő teljesítménytényezője εF</dt><dd>{sz(f.reszletek.epszilonF, 3)}</dd>
            <dt>Villamos segédenergia</dt><dd>{sz(f.reszletek.WFveg, 0)} kWh/a</dd>
            {f.tetelek.map((t) => <><dt>{t.megnevezes}</dt><dd>{sz(t.Q, 0)} kWh/a</dd></>)}
          </dl>
        )}
      </section>

      <section class="szakasz">
        <h2>Használati melegvíz</h2>
        <p class="halk">A nettó HMV igény lakóépületre kötelezően {p.meta.kategoria === 'csaladi_haz' ? 25 : 30} kWh/m²a (2. függ. 2.2. táblázat).</p>
        <div class="szettek">
          {HMV_OPCIOK.map((s) => (
            <button class="szett" aria-pressed={hmvAzonos(p.gepeszet.hmvSzett, s.kod)} onClick={() => modosit((q) => { q.gepeszet.hmvSzett = s.kod; q.gepeszet.hmvErpEta = null; })}>
              <h3>{s.hmvNev}</h3>
              <p>{hmvLeiras(s)}</p>
            </button>
          ))}
        </div>
        <div class="racs" style="margin-top:16px">
          {vanErpHotermelo(p.gepeszet.hmvSzett, 'hmv') && (
            <Mezo cim="Vízmelegítési hatásfok ηwh (ErP adatlap)" sugo="Elektromos készüléknél εHMV = 1 / (2,5 · ηwh).">
              <Szam ertek={p.gepeszet.hmvErpEta ? p.gepeszet.hmvErpEta * 100 : undefined} egyseg="%" valt={(v) => modosit((q) => { q.gepeszet.hmvErpEta = v > 0 ? v / 100 : null; })} />
            </Mezo>
          )}
        </div>
        {h && (
          <dl class="mutatok kartya" style="margin-top:16px">
            <dt>Nettó HMV igény</dt><dd>{sz(h.reszletek.QHMVnet, 0)} kWh/a</dd>
            <dt>Tárolási veszteség</dt><dd>{sz((h.reszletek.tarArany ?? 0) * 100, 1)} %</dd>
            <dt>Elosztási veszteség</dt><dd>{sz((h.reszletek.szallArany ?? 0) * 100, 1)} %</dd>
            <dt>Teljesítménytényező εHMV</dt><dd>{sz(h.reszletek.epszilonHMV, 3)}</dd>
            {h.tetelek.map((t) => <><dt>{t.megnevezes}</dt><dd>{sz(t.Q, 0)} kWh/a</dd></>)}
          </dl>
        )}
      </section>
    </>
  );
}
