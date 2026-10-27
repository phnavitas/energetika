import { render } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { epuletSzamitas, hoszukseglet, type EpuletEredmeny } from '@mag/index';
import { atalakit, anyagPillanatkep, projektMigral, hoszuksegletBemenet, retegrendHibak, nyilaszaroHibak, feluletHibak, type Projekt } from './modell';
import { mintaProjekt, uresProjekt } from './minta';
import { irodaiAnyagokBeallit, projektAnyagokBeallit } from './katalogus';
import { sz } from './ui';
import { EpuletLepes } from './lepesek/Epulet';
import { HelyisegekLepes } from './lepesek/Helyisegek';
import { RetegrendekLepes } from './lepesek/Retegrendek';
import { NyilaszarokLepes } from './lepesek/Nyilaszarok';
import { HatarolasLepes } from './lepesek/Hatarolas';
import { GepeszetLepes } from './lepesek/Gepeszet';
import { VillamossagLepes } from './lepesek/Villamossag';
import { EredmenyLepes } from './lepesek/Eredmeny';
import { HoszuksegletLepes } from './lepesek/Hoszukseglet';
import { HohidakLepes } from './lepesek/Hohidak';
import { FelujitasLepes } from './lepesek/Felujitas';
import { AlternativLepes } from './lepesek/Alternativ';
import { TervbolLepes, tervbolFuggo } from './lepesek/Tervbol';
import { projektFajlba } from './letoltes';
import { ProfilKitoltes, Belepes, IrodaLetrehozas, IrodaNezet, KonyvtarNezet, ProjektekNezet, TavoliKontextus, konyvtarBetolt, type Konyvtar, type TavoliAllapot } from './fiok';
import * as t from './tarolo';
import { ProfilKontextus, helyiProfil, helyiProfilMent, jogosult as jogosultFv, uresTanusito, ZAR_SZOVEG } from './profil';
import { TanusitoSzakasz } from './lepesek/Tanusito';
import type { Tanusito } from './modell';
import './stilus.css';

const KULCS = 'ekm-projekt-v1';
const KAPCSOLAT_KULCS = 'ekm-kapcsolat-v1';
const HELYI_KULCS = 'ekm-helyi-mod';
const IRODA_KULCS = 'ekm-iroda';

const olvas = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const ir = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); return true; } catch { return false; /* privát mód vagy betelt */ } };

function betolt(): Projekt {
  const s = olvas(KULCS);
  if (s) { try { return projektMigral(JSON.parse(s)); } catch { /* sérült */ } }
  return mintaProjekt();
}

/** A szerveren tárolt projekthez tartozó helyi állapot. `piszkos`: van el nem mentett módosítás. */
interface Kapcsolat { id: string; irodaId: string; verzio: number; modositva: string; piszkos: boolean; }
type MentesAllapot = { a: 'mentve' } | { a: 'varakozik' } | { a: 'mentes' } | { a: 'hiba'; uzenet: string } | { a: 'utkozes' } | { a: 'torolve' };

type LepesKod = 'epulet' | 'terv' | 'helyisegek' | 'retegrendek' | 'nyilaszarok' | 'hatarolas' | 'hohidak' | 'hoszukseglet' | 'gepeszet' | 'villamossag' | 'eredmeny' | 'alternativ' | 'felujitas' | 'tanusitvany';
type Fazis = 'Adatfelvétel' | 'Szerkezetek' | 'Gépészet' | 'Értékelés és tanúsítvány';
type Nezet = LepesKod | 'projektek' | 'konyvtar' | 'iroda' | 'profil';
const LEPESEK: { kod: LepesKod; nev: string; leiras: string; fazis: Fazis; opcionalis?: boolean }[] = [
  { kod: 'epulet', nev: 'Épület', leiras: 'Alapadatok, rendeltetés, követelményszint és meglévő épületnél a tipikus szerkezetek.', fazis: 'Adatfelvétel' },
  { kod: 'terv', nev: 'Tervből', leiras: 'Alaprajz és metszet PDF-ből: helyiségek, tájolás, rétegrendek, szintek, külső falak és nyílászárók felismerése, ellenőrzés után átvétel.', fazis: 'Adatfelvétel', opcionalis: true },
  { kod: 'helyisegek', nev: 'Helyiségek', leiras: 'A helyiségekből adódik a hasznos alapterület és a fűtött térfogat; később ebből készül a helyiségenkénti hőveszteség-számítás is.', fazis: 'Szerkezetek' },
  { kod: 'retegrendek', nev: 'Rétegrendek', leiras: 'Építsd fel a szerkezeteket rétegenként. A metszet és az U-érték minden módosításra frissül.', fazis: 'Szerkezetek' },
  { kod: 'nyilaszarok', nev: 'Nyílászárók', leiras: 'Ablak- és ajtótípusok összetevőkből vagy teljesítménynyilatkozat szerinti Uw-ből.', fazis: 'Szerkezetek' },
  { kod: 'hatarolas', nev: 'Határolás', leiras: 'Melyik szerkezet mekkora felületen, milyen tájolással és milyen tér felé határol.', fazis: 'Szerkezetek' },
  { kod: 'hohidak', nev: 'Hőhidak', leiras: 'Katalógus-csomópontok kétdimenziós hőhíd-számítása (MSZ EN ISO 10211): Ψ, felületi hőmérséklet, izotermás ábra; a Ψ·l átvihető a számításba.', fazis: 'Szerkezetek', opcionalis: true },
  { kod: 'hoszukseglet', nev: 'Hőszükséglet', leiras: 'Helyiségenkénti tervezési hőszükséglet (MSZ EN 12831) a hőleadók és a hőtermelő méretezéséhez.', fazis: 'Gépészet', opcionalis: true },
  { kod: 'gepeszet', nev: 'Gépészet', leiras: 'Fűtési és melegvíz-rendszer a leggyakoribb beállításokkal, ErP adatlappal pontosítható.', fazis: 'Gépészet' },
  { kod: 'villamossag', nev: 'Villamosság', leiras: 'Beépített világítás a rendelet módszerével (lakóépületnél tájékoztató), napelemek, egyéb villamos fogyasztók és az éves villamos mérleg.', fazis: 'Gépészet', opcionalis: true },
  { kod: 'eredmeny', nev: 'Eredmény', leiras: 'Besorolás, követelmények, havi mérleg és energiafelhasználás.', fazis: 'Értékelés és tanúsítvány' },
  { kod: 'alternativ', nev: 'Alternatív rendszerek', leiras: 'Az alternatív energiaellátási rendszerek vizsgálata (9/2023 ÉKM 5. §, 4. melléklet): műszaki-környezeti és gazdasági alkalmasság.', fazis: 'Értékelés és tanúsítvány', opcionalis: true },
  { kod: 'felujitas', nev: 'Felújítás', leiras: 'Felújítási intézkedések költsége, megtakarítása, megtérülése és hatása a besorolásra.', fazis: 'Értékelés és tanúsítvány', opcionalis: true },
  { kod: 'tanusitvany', nev: 'Tanúsítvány', leiras: 'A tanúsító adatai, fotók, a feltöltési XML és a számítási jegyzőkönyv.', fazis: 'Értékelés és tanúsítvány' },
];
const EGYEB_NEZET: Record<'projektek' | 'konyvtar' | 'iroda' | 'profil', { nev: string; leiras: string }> = {
  profil: { nev: 'Tanúsítói profil', leiras: 'A tanúsító adatai a fiókodhoz kötve; minden projektedbe innen kerülnek.' },
  projektek: { nev: 'Projektek', leiras: 'Az iroda mentett projektjei. A megnyitott projekt minden módosítása automatikusan mentődik.' },
  konyvtar: { nev: 'Irodai könyvtár', leiras: 'Saját anyagok forrással, bevált rétegrendek és nyílászárók, amelyeket bármelyik projektbe átvehetsz.' },
  iroda: { nev: 'Iroda', leiras: 'Az iroda neve, tagjai és a meghívók.' },
};

function osszesito(e: EpuletEredmeny | null, AN: number): t.Osszesito {
  return { AN, Enren: e?.indikatorok.fajlagos.EnrenFajl ?? null, osztaly: e?.besorolas.energetikai ?? null, co2Osztaly: e?.besorolas.CO2 ?? null, qm: e?.qm ?? null };
}

function App() {
  const [p, setPNyers] = useState<Projekt>(betolt);
  // Visszavonás / újra: a projekt korábbi állapotai (gyors egymás utáni módosítások – pl. gépelés – egy lépésnek számítanak)
  const mult = useRef<Projekt[]>([]);
  const jovo = useRef<Projekt[]>([]);
  const utolsoMod = useRef(0);
  const [, setElozmenyJel] = useState(0);
  /** Új projekt betöltése: az előzmények törlődnek. */
  const setP = (x: Projekt) => { mult.current = []; jovo.current = []; utolsoMod.current = 0; setElozmenyJel((v) => v + 1); setPNyers(x); };
  const [nezet, setNezetNyers] = useState<Nezet>('eredmeny');
  // a Tervből lépésben beolvasott, de át nem vett tervlapok elvesznek a lépés elhagyásakor – előbb rákérdezünk
  const [elhagyKerdes, setElhagyKerdes] = useState<Nezet | null>(null);
  const setNezet = (n: Nezet) => { if (nezet === 'terv' && n !== 'terv' && tervbolFuggo.lapok > 0) { setElhagyKerdes(n); return; } setElhagyKerdes(null); setNezetNyers(n); };
  const fajl = useRef<HTMLInputElement>(null);
  const [ujMegerosit, setUjMegerosit] = useState(false);
  const [uzenet, setUzenet] = useState<string | null>(null);

  // --- Fiók és iroda
  const [helyiMod, setHelyiMod] = useState(() => !t.tavoliElerheto || olvas(HELYI_KULCS) === '1');
  const [felh, setFelh] = useState<t.Felhasznalo | null | undefined>(t.tavoliElerheto ? undefined : null);
  const [irodak, setIrodak] = useState<t.Iroda[] | null>(null);
  const [irodaId, setIrodaId] = useState<string | null>(() => olvas(IRODA_KULCS));
  const [konyvtar, setKonyvtar] = useState<Konyvtar>({ anyagok: [], retegrendek: [], nyilaszarok: [], szettek: [] });
  const [fiokHiba, setFiokHiba] = useState<string | null>(null);
  const [projektLista, setProjektLista] = useState(0);
  const tavoli = t.tavoliElerheto && !helyiMod;

  // --- Tanúsítói profil (fiókhoz, belépés nélkül a böngészőhöz kötve)
  const [profil, setProfil] = useState<Tanusito | null | undefined>(() => (tavoli ? undefined : helyiProfil() ?? uresTanusito()));
  const profilIdozito = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!tavoli) { setProfil(helyiProfil() ?? uresTanusito()); return; }
    if (!felh) { setProfil(undefined); return; }
    t.profilBetolt().then(setProfil, (e) => { setFiokHiba(`A tanúsítói profil nem tölthető be (${(e as Error).message}). Futtasd a 20261021000001_tanusito_profil.sql migrációt.`); setProfil(helyiProfil() ?? uresTanusito()); });
  }, [felh?.id, tavoli]);
  const profilValt = (fn: (x: Tanusito) => void) => setProfil((elozo) => {
    const n = structuredClone(elozo ?? uresTanusito()); fn(n);
    window.clearTimeout(profilIdozito.current);
    profilIdozito.current = window.setTimeout(() => { if (tavoli) t.profilMent(n).catch((e) => setFiokHiba(`A profil mentése nem sikerült: ${(e as Error).message}`)); else helyiProfilMent(n); }, 700);
    return n;
  });
  const jogosult = jogosultFv(profil);

  useEffect(() => {
    if (!t.tavoliElerheto) return;
    t.munkamenet().then(setFelh, () => setFelh(null));
    return t.authFigyel((f) => setFelh((elozo) => (elozo?.id === f?.id ? elozo : f)));
  }, []);

  async function irodakFrissit(f = felh) {
    if (!f) return;
    try {
      const l = await t.irodak(f);
      setIrodak(l);
      setIrodaId((id) => (l.some((i) => i.id === id) ? id : l[0]?.id ?? null));
    } catch (e) { setFiokHiba((e as Error).message); setIrodak((x) => x ?? []); }
  }
  useEffect(() => {
    if (!felh || !tavoli) { setIrodak(null); return; }
    t.meghivokElfogadasa().catch(() => 0).then(() => irodakFrissit(felh));
  }, [felh?.id, tavoli]);

  const iroda = irodak?.find((i) => i.id === irodaId) ?? null;
  useEffect(() => { ir(IRODA_KULCS, irodaId); }, [irodaId]);

  async function konyvtarFrissit() {
    if (!iroda) return;
    try {
      const k = await konyvtarBetolt(iroda.id);
      irodaiAnyagokBeallit(k.anyagok);
      setKonyvtar(k);
    } catch (e) { setFiokHiba((e as Error).message); }
  }
  useEffect(() => {
    irodaiAnyagokBeallit([]);
    setKonyvtar({ anyagok: [], retegrendek: [], nyilaszarok: [], szettek: [] });
    if (iroda && tavoli) konyvtarFrissit();
  }, [iroda?.id, tavoli]);

  // --- Szerveres projekt és automatikus mentés
  const [kapcsolat, setKapcsolatAllapot] = useState<Kapcsolat | null>(() => { try { return JSON.parse(olvas(KAPCSOLAT_KULCS) ?? 'null'); } catch { return null; } });
  const kapcsolatRef = useRef(kapcsolat);
  const setKapcsolat = (k: Kapcsolat | null) => { kapcsolatRef.current = k; setKapcsolatAllapot(k); ir(KAPCSOLAT_KULCS, k ? JSON.stringify(k) : null); };
  const [mentes, setMentes] = useState<MentesAllapot>({ a: 'mentve' });
  const pRef = useRef(p);
  pRef.current = p;
  const folyamatban = useRef<Promise<void> | null>(null);
  const idozito = useRef<number | undefined>(undefined);

  // A kapcsolat csak az aktív irodában érvényes; más irodában helyi projektként marad.
  const aktivKapcsolat = tavoli && kapcsolat && iroda && kapcsolat.irodaId === iroda.id ? kapcsolat : null;

  const modosit = (fn: (q: Projekt) => void, elozmeny = true) => {
    setPNyers((elozo) => {
      // a fotók (nagy base64 adatok) nem klónozódnak minden lépésnél – csak a lista
      const n = { ...structuredClone({ ...elozo, fotok: undefined }), fotok: elozo.fotok?.map((f) => ({ ...f })) } as Projekt;
      if (!n.fotok) delete n.fotok;
      fn(n); anyagPillanatkep(n);
      // érdemi változás nélküli hívás (pl. effektből, mezőelhagyáskor) nem kerül az előzmények közé
      if (JSON.stringify({ ...n, fotok: undefined }) === JSON.stringify({ ...elozo, fotok: undefined }) && (n.fotok?.length ?? 0) === (elozo.fotok?.length ?? 0)) return elozo;
      const most = Date.now();
      if (!elozmeny) return n;
      if (most - utolsoMod.current > 800 || !mult.current.length) { mult.current.push(elozo); if (mult.current.length > 80) mult.current.shift(); }
      utolsoMod.current = most;
      jovo.current = [];
      return n;
    });
    setElozmenyJel((v) => v + 1);
    const k = kapcsolatRef.current;
    if (k && !k.piszkos) setKapcsolat({ ...k, piszkos: true });
  };

  // A böngésző tárhelye ~5 MB: ha a fotókkal nem fér el, a helyi vázlat fotók nélkül marad (a fiókba mentés és a projektfájl tartalmazza őket).
  // A projekt tanúsítói adatai a profilból jönnek.
  useEffect(() => {
    if (profil && JSON.stringify(profil) !== JSON.stringify(p.tanusito)) modosit((q) => { q.tanusito = structuredClone(profil); }, false);
  }, [profil, p.tanusito]);
  // Magyarázó szövegek: egy sorra rövidítve, kattintásra nyílnak (részletezés csak kérésre).
  useEffect(() => {
    for (const el of document.querySelectorAll<HTMLElement>('.munka .szakasz > p.halk, .munka > header p')) {
      if (el.classList.contains('nyitva')) continue;
      el.classList.toggle('tobb', el.scrollHeight > el.clientHeight + 2);
    }
  });
  useEffect(() => {
    const kat = (ev: MouseEvent) => { const el = (ev.target as HTMLElement).closest?.('p.tobb'); if (el) el.classList.toggle('nyitva'); };
    document.addEventListener('click', kat);
    return () => document.removeEventListener('click', kat);
  }, []);
  useEffect(() => { if (!ir(KULCS, JSON.stringify(p)) && p.fotok?.length) ir(KULCS, JSON.stringify({ ...p, fotok: [] })); }, [p]);

  projektAnyagokBeallit(p.anyagok);
  const { atal, e, hiba } = useMemo(() => {
    const atal = atalakit(p);
    let e: EpuletEredmeny | null = null, hiba: string | null = null;
    if (atal.bemenet) { try { e = epuletSzamitas(atal.bemenet); } catch (err) { hiba = (err as Error).message; } }
    return { atal, e, hiba };
  }, [p, konyvtar]);
  const hibak = hiba ? [...atal.hibak, hiba] : atal.hibak;
  const eRef = useRef({ e, AN: atal.geometria.AN });
  eRef.current = { e, AN: atal.geometria.AN };

  function elozmenyLep(irany: -1 | 1) {
    const honnan = irany < 0 ? mult.current : jovo.current, hova = irany < 0 ? jovo.current : mult.current;
    const cel = honnan.pop();
    if (!cel) return;
    hova.push(pRef.current);
    utolsoMod.current = 0;
    setPNyers(cel); setElozmenyJel((v) => v + 1);
    const k = kapcsolatRef.current;
    if (k && !k.piszkos) setKapcsolat({ ...k, piszkos: true });
  }
  /** Kézi mentés: irodai projektnél azonnal a szerverre, helyi projektnél .json fájlba. */
  async function kezMentes() {
    if (aktivKapcsolat) { window.clearTimeout(idozito.current); if (kapcsolatRef.current?.piszkos) await ment(); else setMentes({ a: 'mentve' }); }
    else { const h = await projektFajlba(pRef.current); setUzenet(h ?? 'Projekt fájlba mentve.'); }
  }
  useEffect(() => {
    const f = (ev: KeyboardEvent) => {
      if (!(ev.ctrlKey || ev.metaKey) || ev.altKey) return;
      const t0 = ev.target as HTMLElement | null;
      const k = ev.key.toLowerCase();
      if (k === 's') { ev.preventDefault(); kezMentes(); return; }
      if (t0?.tagName === 'TEXTAREA' || t0?.isContentEditable) return;
      if (k === 'z' && !ev.shiftKey) { ev.preventDefault(); (t0 as HTMLInputElement | null)?.blur?.(); elozmenyLep(-1); }
      else if (k === 'y' || (k === 'z' && ev.shiftKey)) { ev.preventDefault(); (t0 as HTMLInputElement | null)?.blur?.(); elozmenyLep(1); }
    };
    addEventListener('keydown', f);
    return () => removeEventListener('keydown', f);
  });

  async function ment(): Promise<void> {
    while (folyamatban.current) await folyamatban.current;
    const k = kapcsolatRef.current;
    if (!k || !k.piszkos) return;
    const kuldott = pRef.current;
    setMentes({ a: 'mentes' });
    const munka = (async () => {
      try {
        const r = await t.projektMent(k.id, k.verzio, kuldott, osszesito(eRef.current.e, eRef.current.AN));
        if (r.ok) {
          setKapcsolat({ ...kapcsolatRef.current!, verzio: r.verzio, modositva: r.modositva, piszkos: pRef.current !== kuldott });
          setMentes({ a: 'mentve' });
        } else setMentes({ a: r.ok2 });
      } catch (err) { setMentes({ a: 'hiba', uzenet: (err as Error).message }); }
    })();
    folyamatban.current = munka;
    await munka;
    folyamatban.current = null;
  }

  useEffect(() => {
    if (!aktivKapcsolat?.piszkos || mentes.a === 'utkozes' || mentes.a === 'torolve' || mentes.a === 'hiba') return;
    setMentes((m) => (m.a === 'mentes' ? m : { a: 'varakozik' }));
    window.clearTimeout(idozito.current);
    idozito.current = window.setTimeout(() => { ment(); }, 1200);
    return () => window.clearTimeout(idozito.current);
  }, [p, aktivKapcsolat?.piszkos, aktivKapcsolat?.verzio]);

  // Bezáráskor figyelmeztet, ha van el nem mentett módosítás.
  useEffect(() => {
    const f = (ev: BeforeUnloadEvent) => { if (kapcsolatRef.current?.piszkos) { ev.preventDefault(); ev.returnValue = ''; } };
    addEventListener('beforeunload', f);
    return () => removeEventListener('beforeunload', f);
  }, []);

  // Újratöltés vagy irodaváltás után: ha a szerveren újabb verzió van és helyben nincs módosítás, a szerverit töltjük be.
  useEffect(() => {
    if (!aktivKapcsolat) return;
    t.projektBetolt(aktivKapcsolat.id).then((b) => {
      const k = kapcsolatRef.current!;
      if (b.verzio === k.verzio) return;
      if (!k.piszkos) { setP(projektMigral(b.dokumentum)); setKapcsolat({ ...k, verzio: b.verzio, modositva: b.modositva }); }
      else setMentes({ a: 'utkozes' });
    }, () => setMentes({ a: 'torolve' }));
  }, [aktivKapcsolat?.id]);

  async function projektMegnyit(id: string) {
    if (kapcsolatRef.current?.piszkos) await ment();
    const b = await t.projektBetolt(id);
    setP(projektMigral(b.dokumentum));
    setKapcsolat({ id: b.id, irodaId: b.irodaId, verzio: b.verzio, modositva: b.modositva, piszkos: false });
    setMentes({ a: 'mentve' });
    setNezet('epulet');
  }
  async function ujTavoliProjekt(honnan: 'aktualis' | 'ures' | 'minta') {
    if (!iroda) return;
    if (!jogosult && felh && (await t.sajatProjektSzam(felh)) >= 1) throw new Error('Kamarai tanúsítói vagy szakértői szám nélkül legfeljebb 1 projekt hozható létre. A számot a Tanúsítói profilban adhatod meg.');
    if (kapcsolatRef.current?.piszkos) await ment();
    const dok = honnan === 'aktualis' ? pRef.current : honnan === 'minta' ? mintaProjekt() : uresProjekt();
    const ujE = honnan === 'aktualis' ? eRef.current : { e: null, AN: 0 };
    const r = await t.projektUj(iroda.id, dok, osszesito(ujE.e, ujE.AN));
    setP(dok);
    setKapcsolat({ id: r.id, irodaId: iroda.id, verzio: r.verzio, modositva: r.modositva, piszkos: false });
    setMentes({ a: 'mentve' });
    setProjektLista((x) => x + 1);
    setNezet(honnan === 'ures' ? 'epulet' : 'eredmeny');
  }
  async function utkozesBetolt() {
    const k = kapcsolatRef.current!;
    const b = await t.projektBetolt(k.id);
    setP(projektMigral(b.dokumentum));
    setKapcsolat({ ...k, verzio: b.verzio, modositva: b.modositva, piszkos: false });
    setMentes({ a: 'mentve' });
  }
  async function utkozesFelulir() {
    const k = kapcsolatRef.current!;
    const b = await t.projektBetolt(k.id);
    setKapcsolat({ ...k, verzio: b.verzio, piszkos: true });
    setMentes({ a: 'varakozik' });
    await ment();
  }
  async function torolveUjkent() {
    setKapcsolat(null);
    await ujTavoliProjekt('aktualis');
  }
  async function rogzit(): Promise<string> {
    if (!aktivKapcsolat || !atal.bemenet || !e) return '';
    if (kapcsolatRef.current?.piszkos) await ment();
    const k = kapcsolatRef.current!;
    await t.szamitasRogzit(k.id, k.verzio, atal.bemenet, e, e.figyelmeztetesek);
    return `A számítás rögzítve az irodai adatbázisban (projektverzió ${k.verzio}, ${new Date().toLocaleString('hu-HU')}).`;
  }

  async function kilep() {
    if (kapcsolatRef.current?.piszkos) await ment();
    await t.kilepes();
    setKapcsolat(null);
    setIrodak(null);
    setNezet('eredmeny');
  }
  function helyibe() { ir(HELYI_KULCS, '1'); setHelyiMod(true); }
  function belepesre() { ir(HELYI_KULCS, null); setHelyiMod(false); }

  // --- Belépés / iroda kapuk
  if (tavoli) {
    if (felh === undefined) return <div class="belepes-keret"><p class="halk">Betöltés…</p></div>;
    if (felh === null) return <Belepes helyi={helyibe} />;
    if (profil === undefined) return <div class="belepes-keret"><p class="halk">Profil betöltése…</p></div>;
    if (profil === null) return <ProfilKitoltes felhasznalo={felh} kesz={setProfil} kilep={kilep} />;
    if (irodak === null) return <div class="belepes-keret"><p class="halk">Irodák betöltése…</p></div>;
    if (!irodak.length) return <IrodaLetrehozas felhasznalo={felh} kilep={kilep} kesz={async (id) => { setIrodaId(id); await irodakFrissit(); setNezet('projektek'); }} />;
  }

  let hszOsszeg: number | null = null;
  try { const hb = hoszuksegletBemenet(p); hszOsszeg = hb.bemenet.helyisegek.some((h) => h.elemek.length) ? hoszukseglet.helyisegHoszukseglet(hb.bemenet).osszesen : null; } catch { /* hiányos */ }
  const rrHiba = retegrendHibak(p).length, nyHiba = nyilaszaroHibak(p).length, fHiba = feluletHibak(atal.hibak).length;
  const allapot: Record<LepesKod, string> = {
    epulet: p.meta.telepules || 'nincs cím',
    terv: 'PDF alaprajz, metszet',
    helyisegek: `${p.helyisegek.length} helyiség, ${sz(atal.geometria.AN, 1)} m²`,
    retegrendek: `${p.retegrendek.length} rétegrend${rrHiba ? ` · ${rrHiba} hiányos` : ''}`,
    nyilaszarok: `${p.nyilaszarok.length} típus${nyHiba ? ` · ${nyHiba} hiányos` : ''}`,
    hatarolas: `${p.feluletek.length} felület${fHiba ? ` · ${fHiba} hiányos` : ''}`,
    hohidak: p.hohidak?.length ? `${p.hohidak.length} csomópont${p.hohidMod === 'psi' ? ', Ψ-mód' : ''}` : (p.hohidMod === 'psi' ? 'Ψ-mód' : 'χ-tényezővel'),
    hoszukseglet: hszOsszeg !== null ? `${sz(hszOsszeg / 1000, 1)} kW` : '–',
    gepeszet: e ? 'kiválasztva' : '–',
    villamossag: p.gepeszet.napelem.length ? `${sz(p.gepeszet.napelem.reduce((a, n) => a + n.kWp, 0), 1)} kWp napelem` : `${p.gepeszet.villamos?.fogyasztok.length ?? 0} fogyasztó`,
    eredmeny: e ? `${e.besorolas.energetikai} osztály` : 'hiányos adatok',
    alternativ: p.alternativ ? 'vizsgálva' : 'nincs vizsgálat',
    felujitas: p.felujitas ? `${p.felujitas.intezkedesek.filter((m) => m.aktiv).length} intézkedés` : 'nincs elemzés',
    tanusitvany: !profil?.nev ? 'tanúsító hiányzik' : jogosult ? profil.nev : 'kamarai szám nélkül',
  };
  /** Lépésenkénti készültség: kesz / hiany (kötelező, de hiányos) / figy (kész, de nem felel meg) / null (opcionális, nincs mit jelezni). */
  const kesz: Record<LepesKod, 'kesz' | 'hiany' | 'figy' | null> = {
    epulet: p.meta.nev && p.meta.telepules ? 'kesz' : 'hiany',
    terv: null,
    helyisegek: atal.geometria.AN > 0 ? 'kesz' : 'hiany',
    retegrendek: p.retegrendek.length && !rrHiba ? 'kesz' : 'hiany',
    nyilaszarok: p.nyilaszarok.length && !nyHiba ? 'kesz' : 'hiany',
    hatarolas: p.feluletek.length && !fHiba ? 'kesz' : 'hiany',
    hohidak: p.hohidak?.length ? 'kesz' : null,
    hoszukseglet: hszOsszeg !== null ? 'kesz' : null,
    gepeszet: e ? 'kesz' : 'hiany',
    villamossag: p.gepeszet.napelem.length || p.gepeszet.villamos?.fogyasztok.length ? 'kesz' : null,
    eredmeny: !e ? 'hiany' : e.kovetelmeny.qmMegfelel && e.kovetelmeny.EnrenMegfelel && e.kovetelmeny.ECO2Megfelel !== false && !e.szerkezetek.some((x) => x.megfelel === false) ? 'kesz' : 'figy',
    alternativ: p.alternativ ? 'kesz' : null,
    felujitas: p.felujitas ? 'kesz' : null,
    tanusitvany: jogosult && e ? 'kesz' : 'hiany',
  };
  const KESZ_JEL = { kesz: '✓', hiany: '!', figy: '!' } as const;
  const lepesIdx = LEPESEK.findIndex((l) => l.kod === nezet);
  const fej = lepesIdx >= 0 ? LEPESEK[lepesIdx]! : EGYEB_NEZET[nezet as keyof typeof EGYEB_NEZET];

  function fajlBetolt(ev: Event) {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (!f) return;
    f.text().then((s) => {
      try {
        const nyers = JSON.parse(s) as Projekt;
        if (!nyers.meta || !Array.isArray(nyers.helyisegek)) throw new Error();
        const uj = projektMigral(nyers);
        setP(uj); setKapcsolat(null); setUzenet(tavoli ? 'Projekt megnyitva fájlból. Az irodába a Projektek oldalon mentheted el.' : null);
      } catch { setUzenet('A fájl nem projektfájl. A „Projekt mentése fájlba” gombbal mentett .json fájlt nyiss meg.'); }
    });
    (ev.target as HTMLInputElement).value = '';
  }

  const tavoliAllapot: TavoliAllapot | null = tavoli && iroda ? { iroda, konyvtar, frissit: konyvtarFrissit } : null;

  const mentesSzoveg = !tavoli ? null
    : !aktivKapcsolat ? 'Nincs az irodában mentve'
    : mentes.a === 'mentes' ? 'Mentés…'
    : mentes.a === 'varakozik' ? 'Módosítva'
    : mentes.a === 'hiba' ? 'Mentés sikertelen'
    : mentes.a === 'utkozes' ? 'Ütközés'
    : mentes.a === 'torolve' ? 'Törölve a szerverről'
    : `Mentve ${new Date(aktivKapcsolat.modositva).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}`;
  const mentesOsztaly = mentes.a === 'hiba' || mentes.a === 'utkozes' || mentes.a === 'torolve' ? 'rossz' : !aktivKapcsolat ? 'figy' : mentes.a === 'mentve' ? 'jo' : 'folyik';

  return (
    <ProfilKontextus.Provider value={{ profil: profil ?? null, jogosult, szerkeszt: () => setNezet('profil') }}>
    <TavoliKontextus.Provider value={tavoliAllapot}>
      <div class="keret">
        <nav class="oldalsav" aria-label="Lépések">
          <div class="cim-blokk">
            <h1>Energetikai számítás</h1>
            <p>9/2023 ÉKM, {p.meta.rendeltetes === 'egyeb' ? 'egyéb rendeltetés' : 'lakóépület'}</p>
          </div>
          {tavoli && (
            <button class={`projekt-gomb${nezet === 'projektek' ? ' aktiv' : ''}`} onClick={() => setNezet('projektek')}>
              <span class="halkabb">Megnyitott projekt</span>
              <strong>{p.meta.nev || 'Névtelen projekt'}</strong>
              <span class={`jel ${mentesOsztaly}`}>{mentesSzoveg}</span>
            </button>
          )}
          <ol class="lepesek">
            {LEPESEK.map((l, n) => (
              <>
                {(n === 0 || LEPESEK[n - 1]!.fazis !== l.fazis) && <li class="fazis" aria-hidden="true">{l.fazis}</li>}
                <li>
                  <button aria-current={l.kod === nezet ? 'step' : undefined} onClick={() => setNezet(l.kod)} title={l.opcionalis ? 'Opcionális lépés' : undefined}>
                    <span class={`szam${kesz[l.kod] ? ` k-${kesz[l.kod]}` : ''}`}>{kesz[l.kod] ? KESZ_JEL[kesz[l.kod]!] : n + 1}</span>
                    <span>{l.nev}</span>
                    <span class="allapot">{l.opcionalis && !kesz[l.kod] ? `opcionális · ${allapot[l.kod]}` : allapot[l.kod]}</span>
                  </button>
                </li>
              </>
            ))}
          </ol>
          {tavoli && (
            <ul class="lepesek masodlagos">
              {(['projektek', 'konyvtar', 'iroda'] as const).map((k) => (
                <li><button aria-current={nezet === k ? 'page' : undefined} onClick={() => setNezet(k)}><span class="szam" aria-hidden="true">·</span><span>{EGYEB_NEZET[k].nev}</span></button></li>
              ))}
            </ul>
          )}
          <div class="oldalsav-lab">
            <button class={`gomb profil-gomb${nezet === 'profil' ? ' aktiv' : ''}`} onClick={() => setNezet('profil')}>
              <span>Tanúsítói profil</span>
              <span class={`jel ${jogosult ? 'jo' : 'figy'}`}>{jogosult ? profil!.jogosultsag : 'szám nélkül'}</span>
            </button>
            {!tavoli && (
              ujMegerosit ? (
                <div class="kartya" style="padding:10px;display:flex;flex-direction:column;gap:8px">
                  <span class="halkabb">A jelenlegi projekt elvész, ha nem mentetted fájlba.</span>
                  <div class="gombsor">
                    <button class="gomb fo" onClick={() => { setP(uresProjekt()); setNezet('epulet'); setUjMegerosit(false); }}>Üres projekt indítása</button>
                    <button class="gomb halk-gomb semleges" onClick={() => setUjMegerosit(false)}>Mégse</button>
                  </div>
                </div>
              ) : <button class="gomb" onClick={() => { if (!jogosult) { setUzenet('Kamarai szám nélkül legfeljebb 1 projekt lehet: a mostanit szerkesztheted. A számot a Tanúsítói profilban adhatod meg.'); return; } setUjMegerosit(true); }}>Új projekt</button>
            )}
            {!tavoli && <button class="gomb" onClick={() => setP(mintaProjekt())}>Minta betöltése</button>}
            <button class="gomb" onClick={() => fajl.current?.click()}>Projekt megnyitása fájlból</button>
            <input ref={fajl} type="file" accept="application/json,.json" hidden onChange={fajlBetolt} />
            {uzenet && <span class="halkabb" role="alert">{uzenet}</span>}
            {tavoli && felh && (
              <div class="fiok-sor">
                <span class="halkabb" title={felh.email ?? ''}>{felh.email}<br />{iroda?.nev}</span>
                <button class="gomb halk-gomb semleges" onClick={kilep}>Kilépés</button>
              </div>
            )}
            {!tavoli && t.tavoliElerheto && <button class="gomb halk-gomb semleges" onClick={belepesre}>Belépés az irodai fiókba</button>}
          </div>
        </nav>

        <main class="munka">
          {elhagyKerdes && (
            <div class="figyelmeztetes sav" role="alertdialog" aria-label="Beolvasott tervlapok">
              <span>{tervbolFuggo.lapok} beolvasott tervlapot még nem vettél át a projektbe. Ha elhagyod a lapot, a beolvasás és a kijelölések elvesznek. Biztosan elhagyod?</span>
              <span class="gombsor">
                <button class="gomb" onClick={() => setElhagyKerdes(null)}>Maradok, átveszem</button>
                <button class="gomb halk-gomb semleges" onClick={() => { tervbolFuggo.lapok = 0; const n = elhagyKerdes; setElhagyKerdes(null); setNezetNyers(n); }}>Elhagyom</button>
              </span>
            </div>
          )}
          {tavoli && mentes.a === 'utkozes' && (
            <div class="figyelmeztetes sav">
              <span>A projektet közben valaki más is módosította. Melyik változat maradjon?</span>
              <span class="gombsor">
                <button class="gomb" onClick={utkozesBetolt}>Az övé (az enyém elvész)</button>
                <button class="gomb" onClick={utkozesFelulir}>Az enyém (az övé elvész)</button>
              </span>
            </div>
          )}
          {tavoli && mentes.a === 'torolve' && (
            <div class="figyelmeztetes sav">
              <span>Ezt a projektet közben törölték az irodából. A szerkesztett változat még itt van.</span>
              <button class="gomb" onClick={torolveUjkent}>Mentés új projektként</button>
            </div>
          )}
          {tavoli && mentes.a === 'hiba' && (
            <div class="hiba-doboz sav"><span>A mentés nem sikerült: {mentes.uzenet}</span><button class="gomb" onClick={() => { setMentes({ a: 'varakozik' }); ment(); }}>Újra</button></div>
          )}
          {fiokHiba && tavoli && <div class="hiba-doboz sav"><span>{fiokHiba}</span><button class="gomb halk-gomb semleges" onClick={() => setFiokHiba(null)}>Bezárás</button></div>}
          <header>
            <div>
              <h1>{fej.nev}</h1>
              <p class="halk">{fej.leiras}</p>
            </div>
            {tavoli && <span class={`mentes-pirula ${mentesOsztaly}`} role="status" aria-live="polite">{mentesSzoveg}</span>}
            <div class="gombsor eszkozsor">
              <button class="gomb halk-gomb semleges" disabled={!mult.current.length} title="Visszavonás (Ctrl+Z)" aria-label="Visszavonás" onClick={() => elozmenyLep(-1)}>↶</button>
              <button class="gomb halk-gomb semleges" disabled={!jovo.current.length} title="Újra (Ctrl+Y vagy Ctrl+Shift+Z)" aria-label="Újra" onClick={() => elozmenyLep(1)}>↷</button>
              <button class="gomb halk-gomb semleges" title={aktivKapcsolat ? 'Mentés az irodába most (Ctrl+S)' : 'Projekt mentése .json fájlba (Ctrl+S)'} onClick={kezMentes}>Mentés</button>
            </div>
            {lepesIdx >= 0 && (
              <div class="gombsor">
                {lepesIdx > 0 && <button class="gomb" onClick={() => setNezet(LEPESEK[lepesIdx - 1]!.kod)}>Vissza</button>}
                {lepesIdx < LEPESEK.length - 1 && <button class="gomb fo" onClick={() => setNezet(LEPESEK[lepesIdx + 1]!.kod)}>Tovább: {LEPESEK[lepesIdx + 1]!.nev}</button>}
              </div>
            )}
          </header>
          {tavoli && !aktivKapcsolat && nezet === 'projektek' && (
            <div class="figyelmeztetes" style="margin-bottom:16px">A most szerkesztett projekt ({p.meta.nev || 'névtelen'}) még nincs az irodában. Ha megnyitsz egy másikat, ez csak fájlba mentve marad meg. Az „A szerkesztett projekt mentése újként” gombbal felveheted.</div>
          )}
          {nezet === 'epulet' && <EpuletLepes p={p} modosit={modosit} />}
          {nezet === 'terv' && <TervbolLepes p={p} modosit={modosit} ugrik={setNezet} />}
          {nezet === 'helyisegek' && <HelyisegekLepes p={p} modosit={modosit} />}
          {nezet === 'retegrendek' && <RetegrendekLepes p={p} modosit={modosit} />}
          {nezet === 'nyilaszarok' && <NyilaszarokLepes p={p} modosit={modosit} />}
          {nezet === 'hatarolas' && <HatarolasLepes p={p} modosit={modosit} eredmeny={e} />}
          {nezet === 'hohidak' && <HohidakLepes p={p} modosit={modosit} />}
          {nezet === 'hoszukseglet' && <HoszuksegletLepes p={p} modosit={modosit} />}
          {nezet === 'gepeszet' && <GepeszetLepes p={p} modosit={modosit} eredmeny={e} />}
          {nezet === 'villamossag' && <VillamossagLepes p={p} modosit={modosit} eredmeny={e} />}
          {nezet === 'eredmeny' && <EredmenyLepes p={p} e={e} g={atal.geometria} atal={atal} hibak={hibak} modosit={modosit} rogzit={aktivKapcsolat ? rogzit : undefined} />}
          {nezet === 'alternativ' && <AlternativLepes p={p} modosit={modosit} />}
          {nezet === 'felujitas' && <FelujitasLepes p={p} modosit={modosit} />}
          {nezet === 'tanusitvany' && <EredmenyLepes resz="tanusitvany" p={p} e={e} g={atal.geometria} atal={atal} hibak={hibak} modosit={modosit} rogzit={aktivKapcsolat ? rogzit : undefined} />}
          {lepesIdx >= 0 && (
            <footer class="lap-lab">
              {lepesIdx > 0 ? <button class="gomb" onClick={() => { setNezet(LEPESEK[lepesIdx - 1]!.kod); window.scrollTo(0, 0); }}>← {LEPESEK[lepesIdx - 1]!.nev}</button> : <span />}
              {lepesIdx < LEPESEK.length - 1 && <button class="gomb fo" onClick={() => { setNezet(LEPESEK[lepesIdx + 1]!.kod); window.scrollTo(0, 0); }}>Tovább: {LEPESEK[lepesIdx + 1]!.nev} →</button>}
            </footer>
          )}
          {nezet === 'profil' && profil && (
            <>
              {!jogosult && <div class="figyelmeztetes" style="margin-bottom:12px">{ZAR_SZOVEG} Szám nélkül legfeljebb 1 projekt hozható létre.</div>}
              <TanusitoSzakasz t={profil} valt={profilValt} />
            </>
          )}
          {nezet === 'projektek' && iroda && <ProjektekNezet iroda={iroda} aktivId={aktivKapcsolat?.id ?? null} megnyit={projektMegnyit} ujProjekt={ujTavoliProjekt} frissitKulcs={projektLista} />}
          {nezet === 'konyvtar' && tavoliAllapot && <KonyvtarNezet p={p} modosit={modosit} ugrik={setNezet} />}
          {nezet === 'iroda' && iroda && felh && irodak && (
            <IrodaNezet iroda={iroda} felhasznalo={felh} irodak={irodak} valt={setIrodaId}
              ujIroda={async (id) => { setIrodaId(id); await irodakFrissit(); }} frissitIrodak={() => irodakFrissit()} />
          )}
        </main>

        <aside class="eredmenysav" aria-live="polite" aria-label="Élő eredmény">
          <div>
            <p class="halkabb">Összesített energetikai jellemző</p>
            <div class="foszam"><strong>{e ? sz(e.indikatorok.fajlagos.EnrenFajl, 1) : '–'}</strong><span>kWh/m²a</span></div>
            {e && <p class="halk" style="margin-top:6px">{e.besorolas.energetikai} osztály, a követelmény {sz(e.besorolas.energetikaiSzazalek, 0)}%-a</p>}
          </div>
          {e ? (
            <>
              <dl class="mutatok">
                <dt>Nettó fűtési igény</dt><dd>{sz(e.qFnet, 1)} kWh/m²a · {sz(e.zonak.reduce((t, z) => t + z.QFnetEv, 0) / 1000, 1)} MWh/a</dd>
                <dt>Fajlagos hőveszteség-tényező</dt><dd>{sz(e.qm, 3)} W/m³K</dd>
                <dt>CO₂-kibocsátás</dt><dd>{sz(e.indikatorok.fajlagos.ECO2Fajl, 1)} kg/m²a</dd>
                <dt>Hasznos alapterület</dt><dd>{sz(atal.geometria.AN, 1)} m²</dd>
                <dt>Felület/térfogat arány</dt><dd>{sz(e.aV, 3)}</dd>
              </dl>
              <div style="display:flex;flex-direction:column;gap:6px">
                <span class={`jel ${e.kovetelmeny.qmMegfelel ? 'jo' : 'rossz'}`}>q ≤ {sz(e.kovetelmeny.qmMax, 3)} W/m³K</span>
                <span class={`jel ${e.kovetelmeny.EnrenMegfelel ? 'jo' : 'rossz'}`}>Enren ≤ {sz(e.kovetelmeny.EnrenMax, 1)} kWh/m²a</span>
                {e.kovetelmeny.ECO2Max !== null && <span class={`jel ${e.kovetelmeny.ECO2Megfelel ? 'jo' : 'rossz'}`}>CO₂ ≤ {sz(e.kovetelmeny.ECO2Max, 0)} kg/m²a</span>}
                {e.szerkezetek.some((s) => s.megfelel === false) && <span class="jel rossz">Elemi U-követelmény nem teljesül</span>}
                {e.figyelmeztetesek.length > 0 && <span class="jel figy">{new Set(e.figyelmeztetesek.map((f) => f.kod + f.uzenet)).size} figyelmeztetés</span>}
              </div>
            </>
          ) : (
            <div style="display:flex;flex-direction:column;gap:6px">{hibak.slice(0, 4).map((h) => <span class="halkabb">{h}</span>)}</div>
          )}
        </aside>
      </div>
    </TavoliKontextus.Provider>
    </ProfilKontextus.Provider>
  );
}

render(<App />, document.getElementById('app')!);
