import { useState } from 'preact/hooks';
import { Mezo, Szoveg, Valaszto } from '../ui';
import type { Tanusito } from '../modell';
import { JOG_TIPUSOK, jogBont, jogOsszerak, szamFormaOk, jogosult } from '../profil';


/**
 * Tanúsítói profil szerkesztése. A kamarai névjegyzéket automatikusan nem kérdezzük le: a MÉK keresője csak űrlapos HTML,
 * az MMK oldala tiltja az automatizált lekérést. A felület a névjegyzék keresőjét nyitja meg, és rögzíti
 * az ellenőrzés eredményét (dátum, állapot, lejárat).
 */
export function TanusitoSzakasz({ t, valt }: { t: Tanusito; valt: (fn: (x: Tanusito) => void) => void }) {
  const mt = valt;
  const jb = jogBont(t.jogosultsag);
  const szamOk = !jb.szam || szamFormaOk(jb.szam);
  const szam = jb.szam;
  const cim = t.cim ?? { iranyitoszam: '', telepules: '', kozterulet: '', kozteruletJelleg: '', hazszam: '' };
  const mc = (k: keyof typeof cim, v: string) => mt((x) => { x.cim = { ...cim, ...x.cim, [k]: v }; });
  const kereso = t.kamara === 'MMK'
    ? `https://www.mmk.hu/kereses/tagok?${new URLSearchParams({ nev: t.nev, kamarai_szam: szam })}`
    : 'https://eugyintezes.mekon.hu/index.php?u=nevjegyzek';
  const ell = t.ellenorzes;
  const lejart = ell?.lejarat ? new Date(ell.lejarat.replace(/\./g, '-')) < new Date() : false;

  return (
    <section class="szakasz">
      <h2>Tanúsító adatai</h2>
      <p class="halk">A profilhoz kötött adatok minden projektedbe és az e-tanúsítás XML tanúsítói blokkjába kerülnek. Az épületenergetikai tanúsítói (TÉ) és szakértői (SZÉS6) jogosultságot a Magyar Építész Kamara vagy a Magyar Mérnöki Kamara névjegyzéke tartja nyilván. Szám nélkül legfeljebb 1 projekt hozható létre, és nincs XML / PDF dokumentálás.</p>
      <div class="racs">
        <Mezo cim="Név"><Szoveg ertek={t.nev} valt={(v) => mt((x) => { x.nev = v; delete x.ellenorzes; })} /></Mezo>
        <Mezo cim="Kamara"><Valaszto ertek={t.kamara ?? 'MEK'} valt={(v) => mt((x) => { x.kamara = v; delete x.ellenorzes; })} opciok={[{ ertek: 'MEK', nev: 'Magyar Építész Kamara' }, { ertek: 'MMK', nev: 'Magyar Mérnöki Kamara' }]} /></Mezo>
        <Mezo cim="Jogosultság"><Valaszto ertek={jb.tipus} valt={(v) => mt((x) => { x.jogosultsag = jogOsszerak(v, jogBont(x.jogosultsag).szam); delete x.ellenorzes; })} opciok={JOG_TIPUSOK} /></Mezo>
        <Mezo rovid cim="Névjegyzéki szám" sugo={szamOk ? (szam ? undefined : 'nincs megadva') : 'Formátum: 11-0296'}>
          <Szoveg ertek={szam} hely="00-0000" valt={(v) => mt((x) => { x.jogosultsag = jogOsszerak(jogBont(x.jogosultsag).tipus, v); delete x.ellenorzes; })} />
        </Mezo>
        <Mezo cim="E-mail"><Szoveg ertek={t.email} valt={(v) => mt((x) => { x.email = v; })} /></Mezo>
        <Mezo cim="Telefon"><Szoveg ertek={t.telefon} valt={(v) => mt((x) => { x.telefon = v; })} /></Mezo>
        <Mezo rovid cim="Irányítószám"><Szoveg ertek={cim.iranyitoszam} valt={(v) => mc('iranyitoszam', v)} /></Mezo>
        <Mezo cim="Település"><Szoveg ertek={cim.telepules} valt={(v) => mc('telepules', v)} /></Mezo>
        <Mezo cim="Közterület"><Szoveg ertek={cim.kozterulet} valt={(v) => mc('kozterulet', v)} /></Mezo>
        <Mezo rovid cim="Jelleg"><Szoveg ertek={cim.kozteruletJelleg} hely="utca" valt={(v) => mc('kozteruletJelleg', v)} /></Mezo>
        <Mezo rovid cim="Házszám"><Szoveg ertek={cim.hazszam} valt={(v) => mc('hazszam', v)} /></Mezo>
      </div>

      <div class="kartya" style="margin-top:12px;display:flex;flex-direction:column;gap:8px">
        <div class="gombsor">
          <strong>Névjegyzéki ellenőrzés</strong>
          {ell
            ? <span class={`jel ${ell.aktiv && !lejart ? 'jo' : 'rossz'}`}>{ell.aktiv && !lejart ? 'Aktív' : lejart ? 'Lejárt' : 'Nem aktív'} – ellenőrizve {new Date(ell.datum).toLocaleDateString('hu-HU')}{ell.lejarat ? `, lejár ${ell.lejarat}` : ''}</span>
            : <span class="halkabb">Még nincs ellenőrizve.</span>}
        </div>
        <p class="halkabb">A kamarák névjegyzéke nem kérdezhető le automatikusan (a MÉK keresője csak űrlapként működik, az MMK oldala tiltja a gépi lekérdezést). Nyisd meg a keresőt, keress a névre vagy a számra, majd rögzítsd, mit láttál: a TÉ sor mellett „(aktív)” és a lejárat dátuma szerepel.</p>
        <div class="gombsor">
          <a class="gomb" href={kereso} target="_blank" rel="noopener">{t.kamara === 'MMK' ? 'MMK névjegyzék megnyitása' : 'MÉK névjegyzék megnyitása'}</a>
          <ElLenorzesRogzites onRogzit={(aktiv, lejarat) => mt((x) => { x.ellenorzes = { datum: new Date().toISOString(), aktiv, lejarat: lejarat || undefined, forras: kereso }; })} />
        </div>
      </div>

    </section>
  );
}

function ElLenorzesRogzites({ onRogzit }: { onRogzit: (aktiv: boolean, lejarat: string) => void }) {
  const [nyitva, setNyitva] = useState(false);
  const [lejarat, setLejarat] = useState('');
  if (!nyitva) return <button class="gomb" onClick={() => setNyitva(true)}>Ellenőrzés eredményének rögzítése</button>;
  return (
    <span class="gombsor">
      <input type="text" aria-label="Jogosultság lejárata" placeholder="Lejárat, pl. 2030.08.05" value={lejarat} onInput={(e) => setLejarat((e.target as HTMLInputElement).value)} style="max-width:200px" />
      <button class="gomb fo" onClick={() => { onRogzit(true, lejarat.trim()); setNyitva(false); }}>Aktív</button>
      <button class="gomb" onClick={() => { onRogzit(false, lejarat.trim()); setNyitva(false); }}>Nem aktív / nem található</button>
      <button class="gomb halk-gomb semleges" onClick={() => setNyitva(false)}>Mégse</button>
    </span>
  );
}

/** A projektbe a profilból kerülő tanúsítói adatok rövid összefoglalója. */
export function TanusitoOsszegzes({ t, szerkeszt }: { t: Tanusito | null; szerkeszt: () => void }) {
  return (
    <section class="szakasz">
      <h2>Tanúsító</h2>
      <div class="kartya" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <div>
          {t?.nev ? <strong>{t.nev}</strong> : <span class="jel rossz">Nincs tanúsítói profil</span>}
          <div class="halkabb">{t?.jogosultsag || 'kamarai szám nélkül'}{t?.kamara ? ` · ${t.kamara === 'MMK' ? 'Magyar Mérnöki Kamara' : 'Magyar Építész Kamara'}` : ''}{t?.ellenorzes ? ` · névjegyzékben ${t.ellenorzes.aktiv ? 'aktív' : 'nem aktív'} (${new Date(t.ellenorzes.datum).toLocaleDateString('hu-HU')})` : ''}</div>
          {!jogosult(t) && <div class="halkabb" style="color:var(--figyel)">Szám nélkül: legfeljebb 1 projekt, XML és PDF dokumentálás nélkül.</div>}
        </div>
        <button class="gomb" onClick={szerkeszt}>Tanúsítói profil szerkesztése</button>
      </div>
    </section>
  );
}
