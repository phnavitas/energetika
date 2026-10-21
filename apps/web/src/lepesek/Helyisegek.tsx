import { epuletfizika } from '@mag/index';
import { Mezo, Szam, Szoveg, Valaszto, sz } from '../ui';
import { ujId, type Projekt, type HelyisegKategoria } from '../modell';

type Modosit = (fn: (p: Projekt) => void) => void;

const KATEGORIAK: { ertek: HelyisegKategoria; nev: string }[] = [
  { ertek: 'kondicionalt', nev: 'Fűtött (lakószoba, fürdő, WC, közlekedő, előtér)' },
  { ertek: 'erosen_kapcsolt', nev: 'Lakótéren belüli fűtetlen (kamra, tároló, gardrób)' },
  { ertek: 'gyengen_kapcsolt', nev: 'Fűtetlen tér (garázs, padlás, pince, külső tároló)' },
];

/** Besorolás javaslata a helyiség nevéből (5.1. táblázat); a felhasználó felülírhatja. */
export function kategoriaJavaslat(nev: string): HelyisegKategoria | null {
  const n = nev.toLowerCase();
  if (/garázs|garazs|padlás|padlas|pince|kazánház|kazanhaz|műhely|muhely|szín\b|fáskamra|faskamra/.test(n)) return 'gyengen_kapcsolt';
  if (/kamra|tároló|tarolo|gardrób|gardrob|spájz|spajz|éléskamra/.test(n)) return 'erosen_kapcsolt';
  if (/wc|közlekedő|kozlekedo|előtér|eloter|folyosó|folyoso|lépcső|lepcso|szoba|nappali|konyha|étkező|etkezo|fürdő|furdo|háló|halo|dolgozó|mosókonyha|háztartási/.test(n)) return 'kondicionalt';
  return null;
}

export function HelyisegekLepes({ p, modosit }: { p: Projekt; modosit: Modosit }) {
  const futott = p.helyisegek.filter((h) => h.kategoria !== 'gyengen_kapcsolt');
  const AN = futott.reduce((s, h) => s + h.A, 0);
  const V = futott.reduce((s, h) => s + h.A * h.h, 0);
  const uj = () => modosit((q) => { q.helyisegek.push({ id: ujId(), nev: '', kategoria: 'kondicionalt', A: 0, h: q.helyisegek.at(-1)?.h ?? 2.7 }); });

  return (
    <>
      <section class="szakasz">
        <h2>Helyiségek</h2>
        <p class="halk">A hasznos alapterület és a fűtött térfogat a helyiségekből adódik. Az 5.1. táblázat szerint a lakótéren belüli fűtetlen helyiségek (kamra, tároló) beleszámítanak, a fűtetlen terek (garázs, padlás, pince) nem: ezek a határolásnál fűtetlen térként (b tényezővel) jelennek meg. A besorolást a program a névből javasolja.</p>
        <div class="tabla-gorgeto">
          <table class="tabla">
            <thead><tr><th>Helyiség</th><th>Besorolás</th><th class="szam">Alapterület</th><th class="szam">Belmagasság</th><th class="szam">Térfogat</th><th></th></tr></thead>
            <tbody>
              {(() => {
                // tervből átvett helyiségek: szintenként, azon belül lakásonként csoportosítva, részösszegekkel
                const csoportos = p.helyisegek.some((h) => h.szint || h.egyseg);
                const sor = (h: Projekt['helyisegek'][number], i: number) => (
                <tr>
                  <td style="min-width:200px"><Szoveg ertek={h.nev} hely="pl. Nappali" valt={(v) => modosit((q) => { const x = q.helyisegek[i]!; const regi = kategoriaJavaslat(x.nev); x.nev = v; const uj = kategoriaJavaslat(v); if (uj && (!x.nev || regi === x.kategoria || !regi)) x.kategoria = uj; })} /></td>
                  <td style="min-width:200px"><Valaszto cimke="Besorolás" ertek={h.kategoria} valt={(v) => modosit((q) => { q.helyisegek[i]!.kategoria = v; })} opciok={KATEGORIAK} /></td>
                  <td style="width:130px"><Szam cimke="Alapterület" ertek={h.A} egyseg="m²" valt={(v) => modosit((q) => { q.helyisegek[i]!.A = v; })} /></td>
                  <td style="width:120px"><Szam cimke="Belmagasság" ertek={h.h} egyseg="m" valt={(v) => modosit((q) => { q.helyisegek[i]!.h = v; })} /></td>
                  <td class="szam">{sz(h.A * h.h, 1)} m³</td>
                  <td><button class="gomb halk-gomb" aria-label={`${h.nev || 'Helyiség'} törlése`} onClick={() => modosit((q) => { q.helyisegek.splice(i, 1); })}>Törlés</button></td>
                </tr>
                );
                if (!csoportos) return p.helyisegek.map(sor);
                const An = (l: { h: Projekt['helyisegek'][number] }[]) => l.filter(({ h }) => h.kategoria !== 'gyengen_kapcsolt').reduce((s0, { h }) => s0 + h.A, 0);
                const szintek = [...new Set(p.helyisegek.map((h) => h.szint ?? 'Szint nélkül'))];
                return szintek.flatMap((szn) => {
                  const lista = p.helyisegek.map((h, i) => ({ h, i })).filter(({ h }) => (h.szint ?? 'Szint nélkül') === szn);
                  const egysegek = [...new Set(lista.map(({ h }) => h.egyseg ?? '–'))];
                  return [
                    <tr class="csoport-fej"><td colSpan={2}><strong>{szn}</strong> <span class="halkabb">{egysegek.filter((e) => e !== '–').length ? `${egysegek.filter((e) => e !== '–').length} egység · ` : ''}{lista.length} helyiség</span></td><td class="szam"><strong>{sz(An(lista), 2)} m²</strong></td><td colSpan={3}></td></tr>,
                    ...egysegek.flatMap((eg) => {
                      const el = lista.filter(({ h }) => (h.egyseg ?? '–') === eg);
                      return [
                        ...(egysegek.length > 1 || eg !== '–' ? [<tr class="csoport-al"><td colSpan={2}>{eg === '–' ? 'Egyéb' : eg}</td><td class="szam">{sz(An(el), 2)} m²</td><td colSpan={3}></td></tr>] : []),
                        ...el.map(({ h, i }) => sor(h, i)),
                      ];
                    }),
                  ];
                });
              })()}
            </tbody>
            <tfoot><tr><td colSpan={2}>Hasznos alapterület és fűtött térfogat</td><td class="szam">{sz(AN, 2)} m²</td><td></td><td class="szam">{sz(V, 1)} m³</td><td></td></tr></tfoot>
          </table>
        </div>
        <div class="gombsor" style="margin-top:12px">
          <button class="gomb" onClick={uj}>Helyiség hozzáadása</button>
          {!p.helyisegek.length && <span class="halkabb">Később a PDF tervekből is beolvashatók lesznek.</span>}
        </div>
      </section>

      <section class="szakasz">
        <h2>Légzárás és hőtárolás</h2>
        <p class="halk">A tömítetlenségből adódó légcsere (2. függ. 2.4.) és a hőtároló képesség (6.5. táblázat) a havi mérleg bemenete.</p>
        <div class="racs">
          <Mezo cim="Nyílászárók légzárása">
            <Valaszto ertek={p.zona.legzaras} valt={(v) => modosit((q) => { q.zona.legzaras = v; })} opciok={[
              { ertek: 'gyenge', nev: 'Gyenge – vetemedett, tömítetlen' },
              { ertek: 'kozepes', nev: 'Közepes – jól illeszkedő, tömítés nélkül' },
              { ertek: 'jo', nev: 'Jó – körbefutó gyári tömítés' },
              { ertek: 'kivalo', nev: 'Kiváló – légtömörség-méréssel igazolt' },
            ]} />
          </Mezo>
          <Mezo cim="Nyitható nyílások">
            <Valaszto ertek={p.zona.elhelyezes} valt={(v) => modosit((q) => { q.zona.elhelyezes = v; })} opciok={[{ ertek: 'egy_homlokzat', nev: 'Egy homlokzaton' }, { ertek: 'tobb_homlokzat', nev: 'Több homlokzaton vagy szellőzőkürtő' }]} />
          </Mezo>
          <Mezo cim="Szélnek kitett helyzet">
            <Valaszto ertek={p.zona.szelnekKitett ? 'igen' : 'nem'} valt={(v) => modosit((q) => { q.zona.szelnekKitett = v === 'igen'; })} opciok={[{ ertek: 'nem', nev: 'Szélvédett' }, { ertek: 'igen', nev: 'Szélnek kitett, kiemelkedő épület' }]} />
          </Mezo>
          <Mezo cim="Hőtároló képesség" sugo={p.zona.cmEffFajl ? `Részletes számításból: ${p.zona.cmEffFajl} kJ/m²K` : undefined}>
            <Valaszto ertek={p.zona.hotarolo} valt={(v) => modosit((q) => { q.zona.hotarolo = v; q.zona.cmEffFajl = undefined; })} opciok={Object.entries(epuletfizika.HOTAROLO_KEPESSEG).map(([k, v]) => ({ ertek: k as keyof typeof epuletfizika.HOTAROLO_KEPESSEG, nev: `${v.megnevezes} (${v.ertek} kJ/m²K)` }))} />
          </Mezo>
          <Mezo cim="Fűtés programozása" sugo="Lakóépületnél σF = 0,95, ha programozható és az időállandó 24 óránál kisebb.">
            <Valaszto ertek={p.zona.futesProgramozhato ? 'igen' : 'nem'} valt={(v) => modosit((q) => { q.zona.futesProgramozhato = v === 'igen'; })} opciok={[{ ertek: 'nem', nev: 'Nincs automatikával programozva' }, { ertek: 'igen', nev: 'Automatikával programozható' }]} />
          </Mezo>
        </div>
      </section>
    </>
  );
}
