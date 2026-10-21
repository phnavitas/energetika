/**
 * Bejelentkezés, iroda, projektlista és irodai könyvtár nézetei (csak adatbázis-kapcsolattal).
 */
import { createContext } from 'preact';
import { useContext, useEffect, useState } from 'preact/hooks';
import { Mezo, Szam, Szoveg, Valaszto, sz } from './ui';
import { SRAFFOZASOK, type Sraffozas } from './katalogus';
import { ujId, SZEREP_NEV, type Projekt, type Tanusito } from './modell';
import { JOG_TIPUSOK, jogOsszerak, szamFormaOk, type JogTipus } from './profil';
import * as t from './tarolo';

// ---------------------------------------------------------------------------------------------
// Közös állapot a lépések számára

export interface Konyvtar { anyagok: t.IrodaiAnyag[]; retegrendek: t.KonyvtarRetegrend[]; nyilaszarok: t.KonyvtarNyilaszaro[]; szettek: t.IrodaiSzett[]; }
export interface TavoliAllapot { iroda: t.Iroda; konyvtar: Konyvtar; frissit: () => Promise<void>; }
export const TavoliKontextus = createContext<TavoliAllapot | null>(null);
export const useTavoli = () => useContext(TavoliKontextus);

export async function konyvtarBetolt(irodaId: string): Promise<Konyvtar> {
  const [anyagok, retegrendek, nyilaszarok, szettek] = await Promise.all([t.irodaiAnyagok(irodaId), t.konyvtarRetegrendek(irodaId), t.konyvtarNyilaszarok(irodaId), t.irodaiSzettek(irodaId)]);
  return { anyagok, retegrendek, nyilaszarok, szettek };
}

const datum = (s: string) => new Date(s).toLocaleString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Gomb, ami a művelet idejére letiltja magát, és a hibát a megadott helyre írja. */
function useMuvelet() {
  const [fut, setFut] = useState(false);
  const [hiba, setHiba] = useState<string | null>(null);
  async function futtat(fn: () => Promise<unknown>) {
    setFut(true); setHiba(null);
    try { await fn(); } catch (e) { setHiba((e as Error).message); } finally { setFut(false); }
  }
  return { fut, hiba, setHiba, futtat };
}

// ---------------------------------------------------------------------------------------------
// Belépés

export function Belepes({ helyi }: { helyi: () => void }) {
  const [email, setEmail] = useState('');
  const [jelszo, setJelszo] = useState('');
  const [mod, setMod] = useState<'belepes' | 'regisztracio' | 'link'>('belepes');
  const [uzenet, setUzenet] = useState<string | null>(null);
  const [tnev, setTnev] = useState('');
  const [kamara, setKamara] = useState<'MEK' | 'MMK'>('MEK');
  const [jtipus, setJtipus] = useState<JogTipus>('TÉ');
  const [szam, setSzam] = useState('');
  const [szamNelkul, setSzamNelkul] = useState(false);
  const { fut, hiba, futtat } = useMuvelet();

  function kuld(e: Event) {
    e.preventDefault();
    setUzenet(null);
    futtat(async () => {
      if (mod === 'belepes') await t.belepesJelszoval(email, jelszo);
      else if (mod === 'regisztracio') {
        if (jelszo.length < 8) throw new Error('A jelszó legyen legalább 8 karakter.');
        if (!tnev.trim()) throw new Error('Add meg a tanúsító nevét.');
        if (!szamNelkul && !szamFormaOk(szam)) throw new Error('Add meg a kamarai névjegyzéki számot (pl. 11-0296), vagy jelöld, hogy még nincs.');
        const azonnal = await t.regisztracio(email, jelszo, { nev: tnev.trim(), kamara, jogosultsag: szamNelkul ? '' : jogOsszerak(jtipus, szam) });
        if (!azonnal) setUzenet(`Megerősítő levelet küldtünk ide: ${email}. A levélben lévő linkre kattintva lépsz be.`);
      } else {
        await t.belepesiLink(email);
        setUzenet(`Belépési linket küldtünk ide: ${email}. A link egyszer használható.`);
      }
    });
  }

  return (
    <div class="belepes-keret">
      <form class="belepes kartya" onSubmit={kuld}>
        <div>
          <h1>Energetikai számítás</h1>
          <p class="halk" style="margin-top:6px">9/2023 ÉKM, lakóépület. Lépj be az irodád projektjeihez és könyvtárához.</p>
        </div>
        <div class="fulek" role="tablist">
          {([['belepes', 'Belépés'], ['regisztracio', 'Új fiók'], ['link', 'Belépési link']] as const).map(([k, n]) => (
            <button type="button" role="tab" aria-selected={mod === k} onClick={() => { setMod(k); setUzenet(null); }}>{n}</button>
          ))}
        </div>
        <Mezo cim="E-mail cím"><input type="email" required autoComplete="email" value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} /></Mezo>
        {mod !== 'link' && (
          <Mezo cim="Jelszó" sugo={mod === 'regisztracio' ? 'Legalább 8 karakter.' : undefined}>
            <input type="password" required autoComplete={mod === 'belepes' ? 'current-password' : 'new-password'} value={jelszo} onInput={(e) => setJelszo((e.target as HTMLInputElement).value)} />
          </Mezo>
        )}
        {mod === 'regisztracio' && (
          <ProfilMezok nev={tnev} setNev={setTnev} kamara={kamara} setKamara={setKamara} tipus={jtipus} setTipus={setJtipus} szam={szam} setSzam={setSzam} szamNelkul={szamNelkul} setSzamNelkul={setSzamNelkul} />
        )}
        {hiba && <div class="hiba-doboz" role="alert">{hiba}</div>}
        {uzenet && <div class="siker-doboz" role="status">{uzenet}</div>}
        <button class="gomb fo" type="submit" disabled={fut}>
          {fut ? 'Folyamatban…' : mod === 'belepes' ? 'Belépés' : mod === 'regisztracio' ? 'Fiók létrehozása' : 'Link küldése'}
        </button>
        <button type="button" class="gomb halk-gomb semleges" onClick={helyi}>Folytatás belépés nélkül (csak ezen a gépen)</button>
      </form>
    </div>
  );
}

/** Tanúsítói adatok a regisztrációhoz és a profil pótlásához: név, kamara, jogosultság, névjegyzéki szám. */
function ProfilMezok(p: { nev: string; setNev: (v: string) => void; kamara: 'MEK' | 'MMK'; setKamara: (v: 'MEK' | 'MMK') => void; tipus: JogTipus; setTipus: (v: JogTipus) => void; szam: string; setSzam: (v: string) => void; szamNelkul: boolean; setSzamNelkul: (v: boolean) => void }) {
  return (
    <fieldset class="profil-mezok">
      <legend>Tanúsítói adatok</legend>
      <Mezo cim="Tanúsító neve"><input type="text" required value={p.nev} onInput={(e) => p.setNev((e.target as HTMLInputElement).value)} /></Mezo>
      <div class="racs">
        <Mezo cim="Kamara"><select value={p.kamara} onChange={(e) => p.setKamara((e.target as HTMLSelectElement).value as 'MEK')}><option value="MEK">Magyar Építész Kamara</option><option value="MMK">Magyar Mérnöki Kamara</option></select></Mezo>
        <Mezo cim="Jogosultság"><select value={p.tipus} disabled={p.szamNelkul} onChange={(e) => p.setTipus((e.target as HTMLSelectElement).value as JogTipus)}>{JOG_TIPUSOK.map((j) => <option value={j.ertek}>{j.nev}</option>)}</select></Mezo>
        <Mezo rovid cim="Névjegyzéki szám"><input type="text" placeholder="00-0000" required={!p.szamNelkul} disabled={p.szamNelkul} value={p.szam} onInput={(e) => p.setSzam((e.target as HTMLInputElement).value)} /></Mezo>
      </div>
      <label class="jelolo"><input type="checkbox" checked={p.szamNelkul} onChange={(e) => p.setSzamNelkul((e.target as HTMLInputElement).checked)} /> Még nincs kamarai számom</label>
      {p.szamNelkul && <p class="halkabb" style="color:var(--figyel)">Szám nélkül legfeljebb 1 projekt hozható létre, és az XML / PDF dokumentálás nem érhető el. A szám később a Tanúsítói profilban pótolható.</p>}
    </fieldset>
  );
}

/** Belépés után, ha a fióknak még nincs tanúsítói profilja (pl. belépési linkkel jött létre): kötelező kitöltés. */
export function ProfilKitoltes({ felhasznalo, kesz, kilep }: { felhasznalo: t.Felhasznalo; kesz: (p: Tanusito) => void; kilep: () => void }) {
  const [nev, setNev] = useState('');
  const [kamara, setKamara] = useState<'MEK' | 'MMK'>('MEK');
  const [tipus, setTipus] = useState<JogTipus>('TÉ');
  const [szam, setSzam] = useState('');
  const [szamNelkul, setSzamNelkul] = useState(false);
  const { fut, hiba, futtat } = useMuvelet();
  return (
    <div class="belepes-keret">
      <form class="belepes kartya" onSubmit={(e) => { e.preventDefault(); futtat(async () => {
        if (!nev.trim()) throw new Error('Add meg a tanúsító nevét.');
        if (!szamNelkul && !szamFormaOk(szam)) throw new Error('Add meg a kamarai névjegyzéki számot (pl. 11-0296), vagy jelöld, hogy még nincs.');
        const pr: Tanusito = { nev: nev.trim(), kamara, jogosultsag: szamNelkul ? '' : jogOsszerak(tipus, szam), email: felhasznalo.email ?? '', telefon: '' };
        await t.profilMent(pr); kesz(pr);
      }); }}>
        <div>
          <h1>Tanúsítói profil</h1>
          <p class="halk" style="margin-top:6px">A tanúsító adatai a fiókodhoz tartoznak, és minden projektedbe innen kerülnek.</p>
        </div>
        <ProfilMezok nev={nev} setNev={setNev} kamara={kamara} setKamara={setKamara} tipus={tipus} setTipus={setTipus} szam={szam} setSzam={setSzam} szamNelkul={szamNelkul} setSzamNelkul={setSzamNelkul} />
        {hiba && <div class="hiba-doboz" role="alert">{hiba}</div>}
        <button class="gomb fo" type="submit" disabled={fut}>{fut ? 'Mentés…' : 'Tovább'}</button>
        <button type="button" class="gomb halk-gomb semleges" onClick={kilep}>Kilépés</button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Első iroda

export function IrodaLetrehozas({ felhasznalo, kesz, kilep }: { felhasznalo: t.Felhasznalo; kesz: (id: string) => void; kilep: () => void }) {
  const [nev, setNev] = useState('');
  const { fut, hiba, futtat } = useMuvelet();
  return (
    <div class="belepes-keret">
      <form class="belepes kartya" onSubmit={(e) => { e.preventDefault(); futtat(async () => kesz(await t.irodaLetrehoz(nev))); }}>
        <div>
          <h1>Iroda létrehozása</h1>
          <p class="halk" style="margin-top:6px">A projektek és a saját könyvtár (anyagok, rétegrendek, nyílászárók) az irodához tartoznak, a tagok közösen látják őket.</p>
        </div>
        <Mezo cim="Iroda neve"><input type="text" required value={nev} placeholder="pl. PH Navitas Kft." onInput={(e) => setNev((e.target as HTMLInputElement).value)} /></Mezo>
        {hiba && <div class="hiba-doboz" role="alert">{hiba}</div>}
        <button class="gomb fo" type="submit" disabled={fut || !nev.trim()}>{fut ? 'Létrehozás…' : 'Iroda létrehozása'}</button>
        <p class="halkabb">Ha egy meglévő irodába hívtak meg, nem kell újat létrehoznod: a meghívó a {felhasznalo.email} címmel való első belépéskor érvényesül. Ha most kaptad, lépj ki és be újra.</p>
        <button type="button" class="gomb halk-gomb semleges" onClick={kilep}>Kilépés</button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Projektek

export function ProjektekNezet({ iroda, aktivId, megnyit, ujProjekt, frissitKulcs }: {
  iroda: t.Iroda; aktivId: string | null; frissitKulcs: number;
  megnyit: (id: string) => Promise<void>; ujProjekt: (honnan: 'aktualis' | 'ures' | 'minta') => Promise<void>;
}) {
  const [lista, setLista] = useState<t.ProjektSor[] | null>(null);
  const [kereses, setKereses] = useState('');
  const [torlendo, setTorlendo] = useState<string | null>(null);
  const { fut, hiba, futtat } = useMuvelet();
  const betolt = () => futtat(async () => setLista(await t.projektLista(iroda.id)));
  useEffect(() => { betolt(); }, [iroda.id, frissitKulcs]);

  const sz_ = kereses.trim().toLowerCase();
  const szurt = (lista ?? []).filter((x) => !sz_ || x.nev.toLowerCase().includes(sz_) || (x.cim ?? '').toLowerCase().includes(sz_));

  return (
    <div style="display:flex;flex-direction:column;gap:16px">
      <div class="gombsor">
        <button class="gomb fo" disabled={fut} onClick={() => futtat(() => ujProjekt('ures'))}>Új üres projekt</button>
        <button class="gomb" disabled={fut} onClick={() => futtat(() => ujProjekt('aktualis'))}>A szerkesztett projekt mentése újként</button>
        <button class="gomb" disabled={fut} onClick={() => futtat(() => ujProjekt('minta'))}>Mintaprojekt</button>
        <span style="flex:1" />
        <input type="search" aria-label="Keresés" placeholder="Keresés név vagy cím szerint" value={kereses} onInput={(e) => setKereses((e.target as HTMLInputElement).value)} style="max-width:280px" />
      </div>
      {hiba && <div class="hiba-doboz" role="alert">{hiba}</div>}
      {lista === null ? <p class="halk">Betöltés…</p> : !lista.length ? (
        <div class="kartya halk">Az irodában még nincs mentett projekt. Az aktuálisan szerkesztett projektet a fenti gombbal mentheted el.</div>
      ) : (
        <div class="tabla-gorgeto">
          <table class="tabla projekt-tabla">
            <thead><tr><th>Projekt</th><th>Cím</th><th class="szam">AN</th><th class="szam">Enren</th><th>Osztály</th><th>Módosítva</th><th></th></tr></thead>
            <tbody>
              {szurt.map((x) => (
                <tr aria-current={x.id === aktivId ? 'true' : undefined}>
                  <td><button class="link-gomb" onClick={() => futtat(() => megnyit(x.id))}>{x.nev}</button>{x.id === aktivId && <span class="halkabb"> · megnyitva</span>}</td>
                  <td class="halk">{x.cim ?? '–'}</td>
                  <td class="szam">{x.osszesito ? `${sz(x.osszesito.AN, 1)} m²` : '–'}</td>
                  <td class="szam">{x.osszesito?.Enren != null ? sz(x.osszesito.Enren, 1) : '–'}</td>
                  <td>{x.osszesito?.osztaly ? <span class="osztaly-cimke">{x.osszesito.osztaly}</span> : <span class="halkabb">vázlat</span>}</td>
                  <td class="halkabb" style="white-space:nowrap">{datum(x.modositva)}</td>
                  <td style="white-space:nowrap;text-align:right">
                    {torlendo === x.id ? (
                      <span class="gombsor" style="justify-content:flex-end">
                        <button class="gomb veszely" disabled={fut} onClick={() => futtat(async () => { await t.projektTorol(x.id); setTorlendo(null); setLista(await t.projektLista(iroda.id)); })}>Végleges törlés</button>
                        <button class="gomb halk-gomb semleges" onClick={() => setTorlendo(null)}>Mégse</button>
                      </span>
                    ) : <button class="gomb halk-gomb" disabled={x.id === aktivId} title={x.id === aktivId ? 'A megnyitott projekt nem törölhető' : undefined} onClick={() => setTorlendo(x.id)}>Törlés</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!szurt.length && <p class="halk" style="padding:12px 8px">Nincs találat.</p>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Iroda: tagok, meghívók

const SZEREP_NEV_IRODA: Record<t.Szerep, string> = { tulajdonos: 'Tulajdonos', admin: 'Adminisztrátor', tag: 'Tag' };

export function IrodaNezet({ iroda, felhasznalo, irodak, valt, ujIroda, frissitIrodak }: {
  iroda: t.Iroda; felhasznalo: t.Felhasznalo; irodak: t.Iroda[];
  valt: (id: string) => void; ujIroda: (id: string) => void; frissitIrodak: () => Promise<void>;
}) {
  const [tagok, setTagok] = useState<t.Tag[]>([]);
  const [meghivok, setMeghivok] = useState<t.Meghivo[]>([]);
  const [email, setEmail] = useState('');
  const [szerep, setSzerep] = useState<'admin' | 'tag'>('tag');
  const [nev, setNev] = useState(iroda.nev);
  const [ujNev, setUjNev] = useState('');
  const [kilepes, setKilepes] = useState(false);
  const { fut, hiba, futtat } = useMuvelet();
  const admin = iroda.szerep !== 'tag';

  const betolt = () => futtat(async () => {
    setTagok(await t.tagok(iroda.id));
    setMeghivok(admin ? await t.meghivok(iroda.id) : []);
  });
  useEffect(() => { setNev(iroda.nev); betolt(); }, [iroda.id]);

  return (
    <div style="display:flex;flex-direction:column;gap:0">
      {hiba && <div class="hiba-doboz" role="alert" style="margin-bottom:16px">{hiba}</div>}
      <section class="szakasz">
        <h2>Iroda</h2>
        <p class="halk">A projektek és a könyvtár az irodához tartoznak. Több irodád is lehet; ha van, itt válthatsz közöttük.</p>
        <div class="racs">
          <Mezo cim="Iroda neve">{admin ? <Szoveg ertek={nev} valt={setNev} /> : <input type="text" value={nev} disabled />}</Mezo>
          {irodak.length > 1 && <Mezo cim="Aktív iroda"><Valaszto ertek={iroda.id} valt={valt} opciok={irodak.map((i) => ({ ertek: i.id, nev: i.nev }))} /></Mezo>}
        </div>
        {admin && nev.trim() !== iroda.nev && (
          <div class="gombsor" style="margin-top:12px"><button class="gomb fo" disabled={fut || !nev.trim()} onClick={() => futtat(async () => { await t.irodaAtnevez(iroda.id, nev); await frissitIrodak(); })}>Név mentése</button></div>
        )}
      </section>

      <section class="szakasz">
        <h2>Tagok</h2>
        <p class="halk">Tag: projekteket és könyvtárat szerkeszthet. Adminisztrátor: ezen felül tagokat hívhat meg és távolíthat el.</p>
        <table class="tabla">
          <thead><tr><th>E-mail</th><th>Szerepkör</th><th></th></tr></thead>
          <tbody>
            {tagok.map((x) => (
              <tr>
                <td>{x.email ?? '–'}{x.felhasznaloId === felhasznalo.id && <span class="halkabb"> · te</span>}</td>
                <td>
                  {admin && x.szerep !== 'tulajdonos' && x.felhasznaloId !== felhasznalo.id
                    ? <Valaszto cimke="Szerepkör" ertek={x.szerep as 'admin' | 'tag'} valt={(v) => futtat(async () => { await t.tagSzerep(iroda.id, x.felhasznaloId, v); setTagok(await t.tagok(iroda.id)); })} opciok={[{ ertek: 'tag', nev: 'Tag' }, { ertek: 'admin', nev: 'Adminisztrátor' }]} />
                    : SZEREP_NEV_IRODA[x.szerep]}
                </td>
                <td style="text-align:right">
                  {admin && x.szerep !== 'tulajdonos' && x.felhasznaloId !== felhasznalo.id && (
                    <button class="gomb halk-gomb" disabled={fut} onClick={() => futtat(async () => { await t.tagEltavolit(iroda.id, x.felhasznaloId); setTagok(await t.tagok(iroda.id)); })}>Eltávolítás</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {admin && (
        <section class="szakasz">
          <h2>Meghívás</h2>
          <p class="halk">A meghívott ezzel az e-mail címmel regisztrál vagy lép be, és a megerősített címmel automatikusan bekerül az irodába. Levelet a program nem küld, a címet neked kell elküldened neki.</p>
          <form class="gombsor" onSubmit={(e) => { e.preventDefault(); futtat(async () => { await t.meghiv(iroda.id, email, szerep); setEmail(''); setMeghivok(await t.meghivok(iroda.id)); }); }}>
            <input type="email" required aria-label="Meghívott e-mail címe" placeholder="kollega@iroda.hu" value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} style="max-width:280px" />
            <Valaszto cimke="Szerepkör" ertek={szerep} valt={setSzerep} opciok={[{ ertek: 'tag', nev: 'Tag' }, { ertek: 'admin', nev: 'Adminisztrátor' }]} />
            <button class="gomb fo" type="submit" disabled={fut}>Meghívás</button>
          </form>
          {meghivok.length > 0 && (
            <table class="tabla" style="margin-top:12px">
              <thead><tr><th>Függő meghívó</th><th>Szerepkör</th><th>Létrehozva</th><th></th></tr></thead>
              <tbody>{meghivok.map((m) => (
                <tr><td>{m.email}</td><td>{SZEREP_NEV_IRODA[m.szerep]}</td><td class="halkabb">{datum(m.letrehozva)}</td>
                  <td style="text-align:right"><button class="gomb halk-gomb" onClick={() => futtat(async () => { await t.meghivoTorol(iroda.id, m.email); setMeghivok(await t.meghivok(iroda.id)); })}>Visszavonás</button></td></tr>
              ))}</tbody>
            </table>
          )}
        </section>
      )}

      <section class="szakasz">
        <h2>Új iroda</h2>
        <form class="gombsor" onSubmit={(e) => { e.preventDefault(); futtat(async () => { const id = await t.irodaLetrehoz(ujNev); setUjNev(''); ujIroda(id); }); }}>
          <input type="text" required aria-label="Új iroda neve" placeholder="Iroda neve" value={ujNev} onInput={(e) => setUjNev((e.target as HTMLInputElement).value)} style="max-width:280px" />
          <button class="gomb" type="submit" disabled={fut || !ujNev.trim()}>Létrehozás</button>
        </form>
        {iroda.szerep !== 'tulajdonos' && (
          <div style="margin-top:16px">
            {kilepes ? (
              <div class="gombsor">
                <span class="halk">Kilépés után az iroda projektjeit nem éred el.</span>
                <button class="gomb veszely" disabled={fut} onClick={() => futtat(async () => { await t.tagEltavolit(iroda.id, felhasznalo.id); await frissitIrodak(); })}>Kilépés az irodából</button>
                <button class="gomb halk-gomb semleges" onClick={() => setKilepes(false)}>Mégse</button>
              </div>
            ) : <button class="gomb halk-gomb" onClick={() => setKilepes(true)}>Kilépés ebből az irodából…</button>}
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Irodai könyvtár

type Ful = 'anyagok' | 'retegrendek' | 'nyilaszarok' | 'szettek';

const URES_ANYAG = (): Omit<t.IrodaiAnyag, 'id'> => ({ nev: '', kategoria: 'Hőszigetelés', sraffozas: 'hoszigeteles_hab', lambda: undefined, forras: '', forrasTipus: 'termekadat', ellenorzott: false });

export function KonyvtarNezet({ p, modosit, ugrik }: { p: Projekt; modosit: (fn: (q: Projekt) => void) => void; ugrik: (lepes: 'retegrendek' | 'nyilaszarok' | 'gepeszet') => void }) {
  const tv = useTavoli()!;
  const [ful, setFul] = useState<Ful>('anyagok');
  const [uj, setUj] = useState<(Omit<t.IrodaiAnyag, 'id'> & { id?: string; rMod?: boolean }) | null>(null);
  const [torlendo, setTorlendo] = useState<string | null>(null);
  const [jelzes, setJelzes] = useState<string | null>(null);
  const { fut, hiba, futtat } = useMuvelet();
  const k = tv.konyvtar;

  function retegrendBe(r: t.KonyvtarRetegrend) {
    const id = ujId();
    modosit((q) => {
      q.retegrendek.push({ ...structuredClone(r.adat), id, retegek: r.adat.retegek.map((x) => ({ ...x, id: ujId() })) });
      const ism = new Set((q.anyagok ?? []).map((a) => a.id));
      q.anyagok = [...(q.anyagok ?? []), ...r.anyagok.filter((a) => !ism.has(a.id))];
    });
    setJelzes(`„${r.nev}” bekerült a projekt rétegrendjei közé.`);
  }
  function nyilaszaroBe(n: t.KonyvtarNyilaszaro) {
    modosit((q) => { q.nyilaszarok.push({ ...structuredClone(n.adat), id: ujId() }); });
    setJelzes(`„${n.nev}” bekerült a projekt nyílászáró-típusai közé.`);
  }

  const anyagHasznalva = (kod: string) => p.retegrendek.some((r) => r.retegek.some((x) => x.anyagId === kod));
  const kategoriak = [...new Set(['Hőszigetelés', 'Falazat', 'Beton', 'Vakolat', 'Burkolat', 'Fa', 'Fólia', 'Szigetelés', ...k.anyagok.map((a) => a.kategoria)])];

  return (
    <div style="display:flex;flex-direction:column;gap:16px">
      <div class="fulek" role="tablist">
        {([['anyagok', `Anyagok (${k.anyagok.length})`], ['retegrendek', `Rétegrendek (${k.retegrendek.length})`], ['nyilaszarok', `Nyílászárók (${k.nyilaszarok.length})`], ['szettek', `Gépészeti szettek (${k.szettek.length})`]] as const).map(([f, n]) => (
          <button role="tab" aria-selected={ful === f} onClick={() => { setFul(f); setJelzes(null); setTorlendo(null); }}>{n}</button>
        ))}
      </div>
      {hiba && <div class="hiba-doboz" role="alert">{hiba}</div>}
      {jelzes && <div class="siker-doboz" role="status">{jelzes}</div>}

      {ful === 'anyagok' && (
        <>
          <p class="halk" style="max-width:70ch">Az iroda saját anyagai, forrással. A rétegrend-építőben az „Irodai könyvtár” csoportban jelennek meg. A projekt a használt anyagok másolatát is megőrzi, így egy későbbi módosítás vagy törlés nem írja át utólag a régi számításokat.</p>
          {k.anyagok.length > 0 && (
            <div class="tabla-gorgeto"><table class="tabla">
              <thead><tr><th>Anyag</th><th>Kategória</th><th class="szam">λ [W/mK]</th><th class="szam">μ</th><th>Forrás</th><th></th></tr></thead>
              <tbody>{k.anyagok.map((a) => (
                <tr>
                  <td>{a.nev}{a.ellenorzott ? '' : <small class="ellenorizendo">ellenőrizendő</small>}</td>
                  <td class="halk">{a.kategoria}</td>
                  <td class="szam">{a.lambda !== undefined ? sz(a.lambda, 3) : a.R ? `R ${sz(a.R.R, 3)} / ${sz(a.R.d * 100, 0)} cm` : '–'}</td>
                  <td class="szam">{a.mu !== undefined ? sz(a.mu, 0) : '–'}</td>
                  <td class="halkabb">{t.FORRAS_TIPUS_NEV[a.forrasTipus]}{a.forras ? `: ${a.forras}` : ''}</td>
                  <td style="white-space:nowrap;text-align:right">
                    {torlendo === a.id ? (
                      <span class="gombsor" style="justify-content:flex-end">
                        <button class="gomb veszely" disabled={fut} onClick={() => futtat(async () => { await t.anyagTorol(a.id); setTorlendo(null); await tv.frissit(); })}>Törlés</button>
                        <button class="gomb halk-gomb semleges" onClick={() => setTorlendo(null)}>Mégse</button>
                      </span>
                    ) : (
                      <>
                        <button class="gomb halk-gomb semleges" onClick={() => setUj({ ...a, rMod: !!a.R })}>Szerkesztés</button>
                        <button class="gomb halk-gomb" onClick={() => setTorlendo(a.id)} title={anyagHasznalva(a.id) ? 'A megnyitott projekt használja; a projekt a másolatát megtartja.' : undefined}>Törlés</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
          {uj ? (
            <form class="kartya" style="display:flex;flex-direction:column;gap:14px" onSubmit={(e) => {
              e.preventDefault();
              futtat(async () => {
                if (!uj.rMod && !(uj.lambda! > 0)) throw new Error('Add meg a hővezetési tényezőt.');
                if (uj.rMod && !(uj.R && uj.R.R > 0 && uj.R.d > 0)) throw new Error('Add meg a termék hővezetési ellenállását és vastagságát.');
                const { rMod, ...a } = uj;
                await t.anyagMent(tv.iroda.id, rMod ? { ...a, lambda: undefined } : { ...a, R: undefined });
                setUj(null); await tv.frissit();
              });
            }}>
              <h3>{uj.id ? 'Anyag szerkesztése' : 'Új anyag'}</h3>
              <div class="racs">
                <Mezo cim="Megnevezés" szeles><Szoveg ertek={uj.nev} valt={(v) => setUj((u) => u && ({ ...u, nev: v }))} hely="pl. Gyártó Termék EPS 80 grafitos" /></Mezo>
                <Mezo cim="Kategória">
                  <input type="text" list="anyag-kategoriak" value={uj.kategoria} onInput={(e) => setUj((u) => u && ({ ...u, kategoria: (e.target as HTMLInputElement).value }))} />
                  <datalist id="anyag-kategoriak">{kategoriak.map((x) => <option value={x} />)}</datalist>
                </Mezo>
                <Mezo cim="Sraffozás a metszeten"><Valaszto ertek={uj.sraffozas} valt={(v: Sraffozas) => setUj((u) => u && ({ ...u, sraffozas: v }))} opciok={SRAFFOZASOK.map((s) => ({ ertek: s.kod, nev: s.nev }))} /></Mezo>
                <Mezo cim="Megadás módja">
                  <Valaszto ertek={uj.rMod ? 'R' : 'lambda'} valt={(v) => setUj((u) => u && ({ ...u, rMod: v === 'R' }))} opciok={[{ ertek: 'lambda', nev: 'Hővezetési tényező (λ)' }, { ertek: 'R', nev: 'Termék hővezetési ellenállása (R)' }]} />
                </Mezo>
                {uj.rMod ? (
                  <>
                    <Mezo cim="R" sugo="Pl. üreges falazóblokk teljesítménynyilatkozata szerint"><Szam ertek={uj.R?.R} egyseg="m²K/W" valt={(v) => setUj((u) => u && ({ ...u, R: { R: v, d: u.R?.d ?? 0.3 } }))} /></Mezo>
                    <Mezo cim="Ehhez tartozó vastagság"><Szam ertek={uj.R ? uj.R.d * 100 : undefined} egyseg="cm" valt={(v) => setUj((u) => u && ({ ...u, R: { R: u.R?.R ?? 0, d: v / 100 } }))} /></Mezo>
                  </>
                ) : (
                  <Mezo cim="Tervezési λ" sugo="A teljesítménynyilatkozat λD értéke, szükség esetén nedvesség- és öregedési korrekcióval."><Szam ertek={uj.lambda} egyseg="W/mK" valt={(v) => setUj((u) => u && ({ ...u, lambda: v }))} /></Mezo>
                )}
                <Mezo cim="Páradiffúziós ellenállási szám μ"><Szam ertek={uj.mu} valt={(v) => setUj((u) => u && ({ ...u, mu: v }))} /></Mezo>
                <Mezo cim="Forrás típusa"><Valaszto ertek={uj.forrasTipus} valt={(v) => setUj((u) => u && ({ ...u, forrasTipus: v }))} opciok={(Object.keys(t.FORRAS_TIPUS_NEV) as t.ForrasTipus[]).filter((x) => x !== 'rendelet').map((x) => ({ ertek: x, nev: t.FORRAS_TIPUS_NEV[x] }))} /></Mezo>
                <Mezo cim="Forrás hivatkozása" szeles><Szoveg ertek={uj.forras} valt={(v) => setUj((u) => u && ({ ...u, forras: v }))} hely="pl. Teljesítménynyilatkozat sz. 0123-CPR-2024, 2024.03." /></Mezo>
                <label class="jelolo szeles"><input type="checkbox" checked={uj.ellenorzott} onChange={(e) => setUj((u) => u && ({ ...u, ellenorzott: (e.target as HTMLInputElement).checked }))} /> Az értéket a forrásdokumentummal ellenőriztem</label>
              </div>
              <div class="gombsor">
                <button class="gomb fo" type="submit" disabled={fut || !uj.nev.trim() || !uj.forras.trim()}>Mentés</button>
                <button type="button" class="gomb halk-gomb semleges" onClick={() => setUj(null)}>Mégse</button>
                {!uj.forras.trim() && <span class="halkabb">A forrás hivatkozása kötelező.</span>}
              </div>
            </form>
          ) : <div class="gombsor"><button class="gomb" onClick={() => setUj(URES_ANYAG())}>Új anyag</button></div>}
        </>
      )}

      {ful === 'retegrendek' && (
        <>
          <p class="halk" style="max-width:70ch">Rétegrendet a Rétegrendek lépésben menthetsz ide a „Mentés a könyvtárba” gombbal. Innen bármelyik projektbe bemásolható, és ott szabadon módosítható.</p>
          {!k.retegrendek.length ? <div class="kartya halk">Még nincs mentett rétegrend. <button class="link-gomb" onClick={() => ugrik('retegrendek')}>Ugrás a Rétegrendek lépésre</button></div> : (
            <table class="tabla">
              <thead><tr><th>Rétegrend</th><th>Szerkezet</th><th class="szam">U [W/m²K]</th><th class="szam">Rétegek</th><th></th></tr></thead>
              <tbody>{k.retegrendek.map((r) => (
                <tr>
                  <td>{r.nev}</td><td class="halk">{SZEREP_NEV[r.szerep]}</td><td class="szam">{sz(r.U, 3)}</td><td class="szam">{r.adat.retegek.length}</td>
                  <td style="white-space:nowrap;text-align:right">
                    {torlendo === r.id ? (
                      <span class="gombsor" style="justify-content:flex-end">
                        <button class="gomb veszely" disabled={fut} onClick={() => futtat(async () => { await t.konyvtarRetegrendTorol(r.id); setTorlendo(null); await tv.frissit(); })}>Törlés</button>
                        <button class="gomb halk-gomb semleges" onClick={() => setTorlendo(null)}>Mégse</button>
                      </span>
                    ) : (
                      <>
                        <button class="gomb" onClick={() => retegrendBe(r)}>Projektbe</button>
                        <button class="gomb halk-gomb" onClick={() => setTorlendo(r.id)}>Törlés</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </>
      )}

      {ful === 'szettek' && (
        <>
          <p class="halk" style="max-width:70ch">Az iroda bevált gépészeti beállításai: fűtési rendszer(ek), HMV és szellőzés. A Gépészet lépésben a „Mentés irodai szettként” gombbal kerülnek ide, és ott a „Szett választása” alatt jelennek meg.</p>
          {!k.szettek.length ? <div class="kartya halk">Még nincs irodai szett. <button class="link-gomb" onClick={() => ugrik('gepeszet')}>Ugrás a Gépészet lépésre</button></div> : (
            <table class="tabla">
              <thead><tr><th>Szett</th><th>Fűtés</th><th>Szellőzés</th><th></th></tr></thead>
              <tbody>{k.szettek.map((s) => (
                <tr>
                  <td>{s.nev}{s.leiras && <small class="halkabb" style="display:block">{s.leiras}</small>}</td>
                  <td class="halk">{s.futes.map((f) => f.nev).join(' + ')}</td>
                  <td class="halk">{s.szellozes ? `hővisszanyerő ${Math.round(s.szellozes.etaR * 100)}%` : '–'}</td>
                  <td style="white-space:nowrap;text-align:right">
                    {torlendo === s.id ? (
                      <span class="gombsor" style="justify-content:flex-end">
                        <button class="gomb veszely" disabled={fut} onClick={() => futtat(async () => { await t.szettTorol(s.id); setTorlendo(null); await tv.frissit(); })}>Törlés</button>
                        <button class="gomb halk-gomb semleges" onClick={() => setTorlendo(null)}>Mégse</button>
                      </span>
                    ) : <button class="gomb halk-gomb" onClick={() => setTorlendo(s.id)}>Törlés</button>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </>
      )}

      {ful === 'nyilaszarok' && (
        <>
          <p class="halk" style="max-width:70ch">Gyakran használt ablak- és ajtótípusok. A Nyílászárók lépésben a „Mentés a könyvtárba” gombbal kerülnek ide.</p>
          {!k.nyilaszarok.length ? <div class="kartya halk">Még nincs mentett nyílászáró. <button class="link-gomb" onClick={() => ugrik('nyilaszarok')}>Ugrás a Nyílászárók lépésre</button></div> : (
            <table class="tabla">
              <thead><tr><th>Típus</th><th class="szam">Méret</th><th class="szam">U [W/m²K]</th><th></th></tr></thead>
              <tbody>{k.nyilaszarok.map((n) => (
                <tr>
                  <td>{n.nev}</td><td class="szam">{sz(n.adat.szelesseg * 100, 0)} × {sz(n.adat.magassag * 100, 0)} cm</td><td class="szam">{sz(n.Uw, 2)}</td>
                  <td style="white-space:nowrap;text-align:right">
                    {torlendo === n.id ? (
                      <span class="gombsor" style="justify-content:flex-end">
                        <button class="gomb veszely" disabled={fut} onClick={() => futtat(async () => { await t.konyvtarNyilaszaroTorol(n.id); setTorlendo(null); await tv.frissit(); })}>Törlés</button>
                        <button class="gomb halk-gomb semleges" onClick={() => setTorlendo(null)}>Mégse</button>
                      </span>
                    ) : (
                      <>
                        <button class="gomb" onClick={() => nyilaszaroBe(n)}>Projektbe</button>
                        <button class="gomb halk-gomb" onClick={() => setTorlendo(n.id)}>Törlés</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}

/** „Mentés a könyvtárba” gomb a Rétegrendek és Nyílászárók lépéshez. */
export function KonyvtarbaGomb({ mentes, nev }: { mentes: (irodaId: string) => Promise<void>; nev: string }) {
  const tv = useTavoli();
  const { fut, hiba, futtat } = useMuvelet();
  const [kesz, setKesz] = useState(false);
  useEffect(() => setKesz(false), [nev]);
  if (!tv) return null;
  return (
    <>
      <button class="gomb" disabled={fut || kesz} onClick={() => futtat(async () => { await mentes(tv.iroda.id); await tv.frissit(); setKesz(true); })}>
        {kesz ? 'Elmentve a könyvtárba' : 'Mentés a könyvtárba'}
      </button>
      {hiba && <span class="halkabb" role="alert" style="color:var(--hiba)">{hiba}</span>}
    </>
  );
}
