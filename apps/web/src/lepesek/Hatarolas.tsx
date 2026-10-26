import { useState } from 'preact/hooks';
import { klima } from '@mag/index';
import { Mezo, Szam, Szoveg, Valaszto, sz, kov, MindJelolo, OsszesTorles } from '../ui';
import type { EpuletEredmeny } from '@mag/index';
import { ujId, feluletNettoA, geometria, atlagBelmagassag, padloKerulet, padloPsi, chiErvenyes, azonosFeluletek, feluletekOsszevon, falhosszHelyisegekbol, nyilasNapnyereseg, CHI_VALASZTEK, HATAR_NEV, SZEREP_NEV, type Projekt, type HatarKod, type Felulet } from '../modell';
import { Fogantyu, huzasProps } from '../huzas';
import { ARNYEKOLOK } from '../katalogus';

type Modosit = (fn: (p: Projekt) => void) => void;

const HATAROK = (Object.keys(HATAR_NEV) as HatarKod[]).map((k) => ({ ertek: k, nev: HATAR_NEV[k] }));
const TAJOLASOK = klima.TAJOLASOK.map((t) => ({ ertek: t, nev: t }));
const HAJLAS = [{ ertek: '90', nev: 'Függőleges' }, { ertek: '60', nev: '60°' }, { ertek: '45', nev: '45°' }, { ertek: '30', nev: '30°' }, { ertek: '0', nev: 'Vízszintes' }];

export function HatarolasLepes({ p, modosit, eredmeny }: { p: Projekt; modosit: Modosit; eredmeny?: EpuletEredmeny | null }) {
  const g = geometria(p);
  const helyisegOpciok = p.helyisegek.map((h) => ({ ertek: h.id, nev: h.nev || 'névtelen' }));
  const fv = (id: string, fn: (f: Felulet) => void) => modosit((q) => { const f = q.feluletek.find((x) => x.id === id); if (f) fn(f); });
  const torol = (id: string) => modosit((q) => { q.feluletek = q.feluletek.filter((x) => x.id !== id && x.szuloId !== id).map((x) => x); });
  const opak = p.feluletek.filter((f) => f.fajta === 'opak');
  const nyMind = p.feluletek.filter((f) => f.fajta === 'nyilaszaro');
  // nyílászárók szűrése égtáj, szint, épület szerint (ellenőrzéshez)
  const [nySzuro, setNySzuro] = useState({ taj: '', szint: '', epulet: '' });
  const nySzint = (f: Felulet) => (f.szintek?.length ? f.szintek : [p.helyisegek.find((h) => h.id === f.helyisegId)?.szint ?? '']);
  const nyEpulet = (f: Felulet) => { const h = p.helyisegek.find((x) => x.id === f.helyisegId); return (h?.egyseg && /^(\S{1,3}) épület/.exec(h.egyseg)?.[1]) ?? (h && /\(([A-ZÁÉ]{1,2})\.[^)]*\)/.exec(h.nev)?.[1]) ?? ''; };
  const ny = nyMind.filter((f) => (!nySzuro.taj || f.tajolas === nySzuro.taj) && (!nySzuro.szint || nySzint(f).includes(nySzuro.szint)) && (!nySzuro.epulet || nyEpulet(f) === nySzuro.epulet));
  const nyOpc = (l: string[]) => [...new Set(l.filter(Boolean))].sort();
  const szintRend = (x: string) => (/pince/i.test(x) ? -1 : /földszint/i.test(x) ? 0 : /(\d+)\./.test(x) ? Number(/(\d+)\./.exec(x)![1]) : /tetőtér/i.test(x) ? 50 : 99);
  // szintszűrésnél a több szintre együtt átvett sor darabszámának és felületének csak az adott szintre eső része számít
  const nyResz = (f: Felulet) => (nySzuro.szint ? 1 / Math.max(1, nySzint(f).length) : 1);
  // azonos típusú és elhelyezésű (tájolás, dőlés, fal, árnyékolás) nyílászárók egy sorban, darabszám-összeggel;
  // a kibontott sorokban helyiségenként
  const [nyNyitva, setNyNyitva] = useState<Set<string>>(new Set());
  const nyCsoportok: { k: string; tagok: Felulet[] }[] = [];
  for (const f of ny) {
    const n = p.nyilaszarok.find((x) => x.id === f.nyilaszaroId);
    const k = [n ? `${n.szelesseg}|${n.magassag}` : '', f.nyilaszaroId ?? '', f.tajolas ?? '', f.hajlasszog ?? 90, f.szuloId ?? '', f.arnyekolas ?? 1].join('#');
    const c = nyCsoportok.find((x) => x.k === k); if (c) c.tagok.push(f); else nyCsoportok.push({ k, tagok: [f] });
  }
  nyCsoportok.sort((a, b) => {
    const na = p.nyilaszarok.find((x) => x.id === a.tagok[0]!.nyilaszaroId), nb = p.nyilaszarok.find((x) => x.id === b.tagok[0]!.nyilaszaroId);
    return (nb ? nb.szelesseg * nb.magassag : 0) - (na ? na.szelesseg * na.magassag : 0) || klima.TAJOLASOK.indexOf(a.tagok[0]!.tajolas ?? 'É') - klima.TAJOLASOK.indexOf(b.tagok[0]!.tajolas ?? 'É');
  });
  const padlok = p.feluletek.filter((f) => f.fajta === 'padlo');
  /** Felület áthelyezése a lista egy másik eleme elé (húzás) vagy egy hellyel (gombbal) – a saját fajtáján belül. */
  const athelyez = (id: string, celId: string) => modosit((q) => {
    const i = q.feluletek.findIndex((x) => x.id === id), j = q.feluletek.findIndex((x) => x.id === celId);
    if (i < 0 || j < 0 || i === j) return;
    const [t] = q.feluletek.splice(i, 1);
    q.feluletek.splice(q.feluletek.findIndex((x) => x.id === celId) + (i < j ? 1 : 0), 0, t!);
  });
  const lep = (id: string, irany: -1 | 1) => {
    const f = p.feluletek.find((x) => x.id === id)!;
    const lista = p.feluletek.filter((x) => x.fajta === f.fajta);
    const cel = lista[lista.indexOf(f) + irany];
    if (cel) athelyez(id, cel.id);
  };
  const retegrendOpciok = (padlo: boolean) => p.retegrendek.filter((r) => (r.szerep === 'padlo') === padlo).map((r) => ({ ertek: r.id, nev: r.nev }));

  return (
    <>
      <section class="szakasz">
        <h2>Falak, födémek, tetők</h2>
        <p class="halk">Bruttó felületet adj meg közvetlenül, vagy határoló hossz × magasság alapján (alapérték az átlagos belmagasság; a hossz a helyiségeknél megadott külső falhosszakból is átvehető). A hozzá rendelt nyílászárókat a program levonja. A sorok a fogantyúval áthúzhatók. A csatlakozási hőhidakat a 6.1. táblázat χ tényezője veszi figyelembe.</p>
        {p.hohidMod === 'psi' && <div class="figyelmeztetes" style="margin-top:8px">Részletes hőhíd-módszer van beállítva (Hőhidak lépés): a felületek χ értéke most nem számít, helyette a csomópontok Ψ·l tagjai.</div>}
        {p.hohidMod === 'vegyes' && p.feluletek.some((f) => f.chiPsi) && <div class="figyelmeztetes" style="margin-top:8px">Vegyes hőhíd-módszer (Hőhidak lépés): a „Ψ·l” jelölésű felületeken a χ nem számít, a többin igen.</div>}
        <div class="tabla-gorgeto">
          <table class="tabla">
            <thead><tr><th aria-label="Sorrend"></th><th>Megnevezés</th><th>Rétegrend</th><th>Határoló tér</th><th>Bruttó felület</th><th class="szam">Nettó</th><th>Hőhidasság</th></tr></thead>
            <tbody>
              {opak.map((f) => {
                const r = p.retegrendek.find((x) => x.id === f.retegrendId);
                const chiOpciok = CHI_VALASZTEK.filter((c) => !r || c.szerep === r.szerep || (r.szerep === 'teto' && c.szerep === 'teto'));
                return (
                  <tr {...huzasProps('opak', f.id, athelyez)}>
                    <td style="white-space:nowrap"><Fogantyu cimke={f.nev} fel={() => lep(f.id, -1)} le={() => lep(f.id, 1)} /><button class="sor-torol" title="Törlés" aria-label={`${f.nev} törlése`} onClick={() => torol(f.id)}>✕</button></td>
                    <td style="min-width:130px"><Szoveg ertek={f.nev} valt={(v) => fv(f.id, (x) => { x.nev = v; })} /></td>
                    <td style="min-width:160px"><Valaszto cimke="Rétegrend" ertek={f.retegrendId} ures="Válassz…" valt={(v) => fv(f.id, (x) => { x.retegrendId = v; })} opciok={retegrendOpciok(false)} /></td>
                    <td style="min-width:130px">{f.talajFal
                      ? <div title="Fűtött pince talajjal érintkező fala (4.27–4.28): az egyenértékű U a talaj hatásával, a padló mélysége szerint"><span class="halkabb" style="font-size:12px">Talaj (pincefal), mélység</span><Szam cimke="Mélység a terepszinttől" ertek={f.talajFal.z} egyseg="m" valt={(v) => fv(f.id, (x) => { x.talajFal = { z: Math.max(0.5, v) }; if (x.meret) { x.meret.magassag = Math.max(0.5, v); x.A = Math.round(x.meret.hossz * x.meret.magassag * 100) / 100; } })} /><button class="link-gomb" style="font-size:12px" onClick={() => fv(f.id, (x) => { delete x.talajFal; })}>külső levegő felé</button></div>
                      : <><Valaszto cimke="Határoló tér" ertek={f.hatar} valt={(v) => fv(f.id, (x) => { x.hatar = v; })} opciok={HATAROK} /><button class="link-gomb" style="font-size:12px" title="Fűtött pince talajjal érintkező fala" onClick={() => fv(f.id, (x) => { x.hatar = 'kulso'; x.talajFal = { z: x.meret?.magassag ?? 3 }; x.chi = 0; })}>talajjal érintkező</button></>}</td>
                    <td style="min-width:290px">
                      <div class="meret-mod">
                        <select aria-label="Felület megadása" value={f.meret ? 'meret' : 'A'} onChange={(e) => fv(f.id, (x) => {
                          if ((e.target as HTMLSelectElement).value === 'meret') { const h = falhosszHelyisegekbol(p, x.retegrendId) || Math.round(((x.A ?? 0) / atlagBelmagassag(p)) * 100) / 100; x.meret = { hossz: h, magassag: atlagBelmagassag(p) }; x.A = Math.round(h * x.meret.magassag * 100) / 100; }
                          else delete x.meret;
                        })}>
                          <option value="A">Felület</option>
                          <option value="meret">Hossz × magasság</option>
                        </select>
                        {f.meret ? <>
                          <Szam cimke="Határoló hossz" ertek={f.meret.hossz} egyseg="m" valt={(v) => fv(f.id, (x) => { x.meret!.hossz = v; x.A = Math.round(v * x.meret!.magassag * 100) / 100; })} />
                          <Szam cimke="Magasság (belmagasság)" ertek={f.meret.magassag} egyseg="m" valt={(v) => fv(f.id, (x) => { x.meret!.magassag = v; x.A = Math.round(x.meret!.hossz * v * 100) / 100; })} />
                          <span class="halkabb">= {sz(f.A, 2)} m²</span>
                          {falhosszHelyisegekbol(p, f.retegrendId) > 0 && Math.abs(falhosszHelyisegekbol(p, f.retegrendId) - f.meret.hossz) > 0.01 && (
                            <button class="link-gomb" onClick={() => fv(f.id, (x) => { x.meret!.hossz = falhosszHelyisegekbol(p, x.retegrendId); x.A = Math.round(x.meret!.hossz * x.meret!.magassag * 100) / 100; })}>hossz a helyiségekből: {sz(falhosszHelyisegekbol(p, f.retegrendId), 2)} m</button>
                          )}
                        </> : <Szam cimke="Bruttó felület" ertek={f.A} egyseg="m²" valt={(v) => fv(f.id, (x) => { x.A = v; })} />}
                      </div>
                    </td>
                    <td class="szam">{sz(feluletNettoA(p, f), 2)} m²</td>
                    <td style="min-width:170px">
                      <select aria-label="Hőhidasság" onChange={(e) => { const i = Number((e.target as HTMLSelectElement).value); fv(f.id, (x) => { x.chiKod = i; x.chi = CHI_VALASZTEK[i]!.ertek; }); }}>
                        <option value="" selected={f.chiKod === undefined && f.chi === undefined}>Válassz…</option>
                        {CHI_VALASZTEK.map((c, i) => ({ c, i })).filter(({ c }) => chiOpciok.includes(c)).map(({ c, i }) => (
                          <option value={String(i)} selected={f.chiKod !== undefined ? f.chiKod === i : f.chi === c.ertek && chiOpciok.findIndex((x) => x.ertek === c.ertek) === chiOpciok.indexOf(c)}>{c.nev} (χ = {kov(c.ertek)})</option>
                        ))}
                      </select>
                      {p.hohidMod && p.hohidMod !== 'chi' && chiErvenyes(p, f) === 0 && (f.chi ?? 0) > 0 && <small class="halkabb" style="display:block">χ nem számít – Ψ·l a Hőhidak lépésből</small>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {opak.length > 1 && <tfoot><tr><td /><td colSpan={3}>Összesen ({opak.length} felület)</td><td /><td class="szam">{sz(opak.reduce((s, f) => s + feluletNettoA(p, f), 0), 2)} m²</td><td /></tr></tfoot>}
          </table>
        </div>
        <button class="gomb" style="margin-top:12px" onClick={() => modosit((q) => {
          const rid = q.retegrendek.find((r) => r.szerep === 'fal')?.id;
          const h = falhosszHelyisegekbol(q, rid), m = atlagBelmagassag(q);
          q.feluletek.push({ id: ujId(), nev: 'Homlokzati fal', fajta: 'opak', retegrendId: rid, hatar: 'kulso', meret: { hossz: h, magassag: m }, A: Math.round(h * m * 100) / 100, chi: 0.2 });
        })}>Felület hozzáadása</button>
        <span style="margin-left:12px"><OsszesTorles db={opak.length + padlok.length} mit="határoló felületet (fal, födém, tető, talajon fekvő padló)" megjegyzes="A nyílászárók megmaradnak, fal nélkül." torol={() => modosit((q) => { const ids = new Set(q.feluletek.filter((f) => f.fajta !== 'nyilaszaro').map((f) => f.id)); q.feluletek = q.feluletek.filter((f) => f.fajta === 'nyilaszaro'); for (const f of q.feluletek) { if (f.szuloId && ids.has(f.szuloId)) delete f.szuloId; if (f.padlo?.falIds) { f.padlo.falIds = f.padlo.falIds.filter((x) => !ids.has(x)); if (!f.padlo.falIds.length) delete f.padlo.falIds; } } })} /></span>
      </section>

      <Osszesites p={p} modosit={modosit} />

      <section class="szakasz">
        <h2>Nyílászárók</h2>
        <p class="halk">A tájolás és a dőlés a havi sugárzási nyereséghez kell (2. függ. 1.6. táblázat). Ha a nyílászárót egy falhoz rendeled, a fal felületéből levonódik.</p>
        {nyMind.length > 5 && (
          <div class="gombsor" style="gap:12px;margin:8px 0;align-items:flex-end">
            <label class="mezo"><span>Égtáj</span><select value={nySzuro.taj} onChange={(e) => setNySzuro({ ...nySzuro, taj: (e.target as HTMLSelectElement).value })}><option value="">Mind</option>{klima.TAJOLASOK.filter((t) => nyMind.some((f) => f.tajolas === t)).map((t) => <option value={t}>{t}</option>)}</select></label>
            <label class="mezo"><span>Szint</span><select value={nySzuro.szint} onChange={(e) => setNySzuro({ ...nySzuro, szint: (e.target as HTMLSelectElement).value })}><option value="">Mind</option>{nyOpc(nyMind.flatMap(nySzint)).sort((a, b) => szintRend(a) - szintRend(b)).map((t) => <option value={t}>{t}</option>)}</select></label>
            <label class="mezo"><span>Épület</span><select value={nySzuro.epulet} onChange={(e) => setNySzuro({ ...nySzuro, epulet: (e.target as HTMLSelectElement).value })}><option value="">Mind</option>{nyOpc(nyMind.map(nyEpulet)).map((t) => <option value={t}>{t}</option>)}</select></label>
            <span class="halkabb">{ny.length} / {nyMind.length} sor · {sz(ny.reduce((s, f) => s + (f.darab ?? 1) * nyResz(f), 0), 0)} db · {sz(ny.reduce((s, f) => s + feluletNettoA(p, f) * nyResz(f), 0), 1)} m²{nySzuro.szint ? ' (a szintre eső rész)' : ''}</span>
          </div>
        )}
        <div class="tabla-gorgeto">
          <table class="tabla">
            <thead><tr><th aria-label="Kibontás és törlés"></th><th>Típus</th><th class="szam">Db</th><th>Tájolás</th><th>Dőlés</th><th>Falban</th><th>Helyiség</th><th class="szam">Felület</th><th>Árnyékoló</th><th class="szam" title="Fűtési idényre vonatkozó árnyékolási tényező: környező beépítés, erkély, előtető, növényzet (1 = nincs)">F<sub>árny</sub></th><th class="szam" title="Passzív szoláris nyereség Qsd = Au · 0,9 · gn · F · Gs">Napnyereség<br /><span class="halkabb">fűtési idény / év</span></th></tr></thead>
            <tbody>
              {nyCsoportok.map(({ k, tagok }) => {
                const f = tagok[0]!; const ids = new Set(tagok.map((x) => x.id));
                const fvCs = (fn: (x: Felulet) => void) => modosit((q) => { for (const x of q.feluletek) if (ids.has(x.id)) fn(x); });
                const nt = p.nyilaszarok.find((x) => x.id === f.nyilaszaroId);
                const ar = nt?.arnyekolo ? ARNYEKOLOK.find((a) => a.kod === nt.arnyekolo!.kod) : undefined;
                const napny = tagok.map((x) => { const n = nyilasNapnyereseg(p, x); return n ? { ideny: n.ideny * nyResz(x), ev: n.ev * nyResz(x) } : null; }).reduce<{ ideny: number; ev: number } | null>((a, x) => (x ? { ideny: (a?.ideny ?? 0) + x.ideny, ev: (a?.ev ?? 0) + x.ev } : a), null);
                const db = tagok.reduce((s2, x) => s2 + (x.darab ?? 1) * nyResz(x), 0);
                const nyitott = nyNyitva.has(k);
                const helyNev = (x: Felulet) => p.helyisegek.find((h) => h.id === x.helyisegId)?.nev;
                const helyek = [...new Set(tagok.map(helyNev).filter(Boolean))];
                return (<>
                  <tr>
                    <td style="white-space:nowrap">
                      <button class="sor-nyit" aria-expanded={nyitott} title={nyitott ? 'Helyiségek elrejtése' : 'Helyiségek megjelenítése'} onClick={() => setNyNyitva((x) => { const y = new Set(x); if (y.has(k)) y.delete(k); else y.add(k); return y; })}>{nyitott ? '▾' : '▸'}</button>
                      <button class="sor-torol" title={tagok.length > 1 ? `Törlés (mind a ${tagok.length} sor)` : 'Törlés'} aria-label="Törlés" onClick={() => modosit((q) => { q.feluletek = q.feluletek.filter((x) => !ids.has(x.id)); })}>✕</button>
                    </td>
                    <td style="min-width:150px"><Valaszto cimke="Típus" ertek={f.nyilaszaroId} ures="Válassz…" valt={(v) => fvCs((x) => { x.nyilaszaroId = v; })} opciok={p.nyilaszarok.map((n) => ({ ertek: n.id, nev: n.nev }))} /></td>
                    <td style="min-width:58px">{tagok.length === 1 && !nySzuro.szint
                      ? <Szam cimke="Darab" ertek={f.darab ?? 1} lepes={1} min={1} valt={(v) => fv(f.id, (x) => { x.darab = Math.max(1, Math.round(v)); })} />
                      : <span class="szam" style="display:block;text-align:right" title="A helyiségenkénti darabszám a kibontott sorokban módosítható">{sz(db, Number.isInteger(db) ? 0 : 1)}</span>}</td>
                    <td style="min-width:84px"><Valaszto cimke="Tájolás" ertek={f.tajolas ?? undefined} valt={(v) => fvCs((x) => { x.tajolas = v; })} opciok={TAJOLASOK} /></td>
                    <td style="min-width:124px"><Valaszto cimke="Dőlés" ertek={String(f.hajlasszog ?? 90)} valt={(v) => fvCs((x) => { x.hajlasszog = Number(v) as Felulet['hajlasszog']; })} opciok={HAJLAS} /></td>
                    <td style="min-width:120px"><Valaszto cimke="Szülő fal" ertek={f.szuloId} ures="Nincs levonás" valt={(v) => fvCs((x) => { x.szuloId = v || undefined; })} opciok={opak.map((o) => ({ ertek: o.id, nev: o.nev }))} /></td>
                    <td class="halkabb" style="min-width:90px">{helyek.length === 1 ? helyek[0] : helyek.length ? `${helyek.length} helyiség` : '–'}</td>
                    <td class="szam">{sz(tagok.reduce((s2, x) => s2 + feluletNettoA(p, x) * nyResz(x), 0), 2)} m²</td>
                    <td class="halkabb" style="min-width:64px">{ar ? ar.megnevezes : 'nincs'}</td>
                    <td style="width:64px"><Szam cimke="Árnyékolási tényező" ertek={f.arnyekolas ?? 1} lepes={0.05} min={0} valt={(v) => fvCs((x) => { x.arnyekolas = Math.min(1, Math.max(0, v)); if (x.arnyekolas === 1) delete x.arnyekolas; })} /></td>
                    <td class="szam" style="white-space:nowrap">{napny ? <>{sz(napny.ideny, 0)} / {sz(napny.ev, 0)} kWh</> : '–'}</td>
                  </tr>
                  {nyitott && tagok.map((x) => (
                    <tr class="alsor">
                      <td style="text-align:right"><button class="sor-torol" title="Törlés" aria-label={`${x.nev} törlése`} onClick={() => torol(x.id)}>✕</button></td>
                      <td colSpan={1} class="halkabb" style="padding-left:18px">{x.nev}{x.szintek?.length ? ` · ${x.szintek.join(' + ')}${x.szintek.length > 1 ? ` (a darabszám ${x.szintek.length} szint együtt)` : ''}` : ''}</td>
                      <td style="min-width:58px"><Szam cimke="Darab" ertek={x.darab ?? 1} lepes={1} min={1} valt={(v) => fv(x.id, (y) => { y.darab = Math.max(1, Math.round(v)); })} /></td>
                      <td colSpan={3} />
                      <td style="min-width:110px"><Valaszto cimke="Helyiség" ertek={x.helyisegId} ures="–" valt={(v) => fv(x.id, (y) => { y.helyisegId = v || undefined; })} opciok={helyisegOpciok} /></td>
                      <td class="szam halkabb">{sz(feluletNettoA(p, x), 2)} m²</td>
                      <td colSpan={3} />
                    </tr>
                  ))}
                </>);
              })}
            </tbody>
            {ny.length > 0 && (() => { const o = ny.map((f) => nyilasNapnyereseg(p, f)).reduce<{ ideny: number; ev: number }>((a, x) => ({ ideny: a.ideny + (x?.ideny ?? 0), ev: a.ev + (x?.ev ?? 0) }), { ideny: 0, ev: 0 }); return (
              <tfoot>
                <tr style="font-weight:600"><td colSpan={2}>Összesen{ny.length < nyMind.length || nySzuro.szint ? ' (szűrt)' : ''}</td><td class="szam">{sz(ny.reduce((s, f) => s + (f.darab ?? 1) * nyResz(f), 0), 0)} db</td><td colSpan={4} /><td class="szam">{sz(ny.reduce((s, f) => s + feluletNettoA(p, f) * nyResz(f), 0), 2)} m²</td><td colSpan={3} /></tr>
                <tr><td colSpan={10}>Passzív szoláris nyereség összesen (Q<sub>sd</sub> = A<sub>ü</sub> · 0,9 · g · F · G<sub>s</sub>, árnyékolással, hasznosítási tényező nélkül)</td><td class="szam" style="white-space:nowrap">{sz(o.ideny, 0)} / {sz(o.ev, 0)} kWh</td></tr>
                {eredmeny && (() => {
                  // fűtési idény (havi mérleg, ahol QF,net > 0): hőveszteség, szoláris nyereség és annak hasznosított része
                  const h = eredmeny.zonak.flatMap((z) => z.havi).filter((x) => x.QFnet > 0);
                  const veszt = h.reduce((a, x) => a + x.Qveszt, 0), qsd = h.reduce((a, x) => a + x.Qsd, 0), hasz = h.reduce((a, x) => a + x.eta * x.Qsd, 0);
                  return veszt > 0 ? (
                    <tr><td colSpan={11} class="halkabb">Fűtési hónapokban ({h.length} hó, QF,net &gt; 0): hőveszteség (transzmisszió + szellőzés) <strong>{sz(veszt, 0)} kWh</strong> · szoláris nyereség (g-vel) <strong>{sz(qsd, 0)} kWh</strong> ({sz((qsd / veszt) * 100, 0)}%) · ebből hasznosítható (η·Q<sub>sd</sub>) <strong>{sz(hasz, 0)} kWh</strong> ({sz((hasz / veszt) * 100, 0)}%)</td></tr>
                  ) : null;
                })()}
              </tfoot>
            ); })()}
          </table>
        </div>
        <button class="gomb" style="margin-top:12px" disabled={!p.nyilaszarok.length} onClick={() => modosit((q) => { q.feluletek.push({ id: ujId(), nev: 'Ablak', fajta: 'nyilaszaro', nyilaszaroId: q.nyilaszarok[0]?.id, hatar: 'kulso', darab: 1, tajolas: 'D', hajlasszog: 90 }); })}>Nyílászáró hozzáadása</button>
        <span style="margin-left:12px"><OsszesTorles db={nyMind.length} mit="nyílászáró-sort" torol={() => modosit((q) => { q.feluletek = q.feluletek.filter((f) => f.fajta !== 'nyilaszaro'); })} /></span>
        {!p.nyilaszarok.length && <span class="halkabb" style="margin-left:8px">Előbb vegyél fel nyílászáró-típust.</span>}
      </section>

      <section class="szakasz">
        <h2>Talajjal érintkező padló</h2>
        <p class="halk">Egyenértékű U-érték az MSZ EN ISO 13370 egyszerűsítésével (4.20–4.33 képlet): kitett kerület, csatlakozó fal vastagsága, perem-hőszigetelés. A padló-fal csatlakozás Ψ értékét a 6.4. táblázat adja.</p>
        <div style="display:flex;flex-direction:column;gap:12px">
          {padlok.map((f) => (
            <div class="kartya">
              <div class="racs">
                <Mezo cim="Megnevezés"><Szoveg ertek={f.nev} valt={(v) => fv(f.id, (x) => { x.nev = v; })} /></Mezo>
                <Mezo cim="Rétegrend"><Valaszto ertek={f.retegrendId} ures="Válassz…" valt={(v) => fv(f.id, (x) => { x.retegrendId = v; })} opciok={retegrendOpciok(true)} /></Mezo>
                <Mezo cim="Alapterület"><Szam ertek={f.A} egyseg="m²" valt={(v) => fv(f.id, (x) => { x.A = v; })} /></Mezo>
                <Mezo cim="Kitett kerület" sugo={f.padlo?.falIds?.length ? `A kijelölt külső falak hossza (${f.padlo.falIds.length} fal)` : 'Külső tér és fűtetlen tér felé'}>
                  {f.padlo?.falIds?.length
                    ? <div class="egyseg"><span class="szam-kijelzo">{sz(padloKerulet(p, f), 2)} m</span><button class="gomb halk-gomb" onClick={() => fv(f.id, (x) => { x.padlo!.P = padloKerulet(p, x); delete x.padlo!.falIds; })}>kézi</button></div>
                    : <Szam ertek={f.padlo?.P} egyseg="m" valt={(v) => fv(f.id, (x) => { x.padlo!.P = v; })} />}
                </Mezo>
                <Mezo cim="Csatlakozó fal vastagsága"><Szam ertek={f.padlo?.dfCm} egyseg="cm" valt={(v) => fv(f.id, (x) => { x.padlo!.dfCm = v; })} /></Mezo>
                <Mezo cim="Padló mélysége a terep alatt" sugo="±0,5 m-en belül: 0"><Szam ertek={f.padlo?.z} egyseg="m" valt={(v) => fv(f.id, (x) => { x.padlo!.z = v; })} /></Mezo>
                <Mezo cim="Perem-hőszigetelés">
                  <Valaszto ertek={f.padlo?.perem?.irany ?? 'nincs'} valt={(v) => fv(f.id, (x) => { x.padlo!.perem = v === 'nincs' ? undefined : { irany: v as 'vizszintes', D: x.padlo!.perem?.D ?? 0.5, dCm: x.padlo!.perem?.dCm ?? 10, R: x.padlo!.perem?.R ?? 2.5 }; })} opciok={[{ ertek: 'nincs', nev: 'Nincs' }, { ertek: 'fuggoleges', nev: 'Függőleges sáv a lábazaton' }, { ertek: 'vizszintes', nev: 'Vízszintes sáv a fal mentén' }]} />
                </Mezo>
                {f.padlo?.perem && <>
                  <Mezo cim={f.padlo.perem.irany === 'fuggoleges' ? 'Sáv mélysége a terep alatt' : 'Sáv szélessége'}><Szam ertek={f.padlo.perem.D} egyseg="m" valt={(v) => fv(f.id, (x) => { x.padlo!.perem!.D = v; })} /></Mezo>
                  <Mezo cim="Perem-hőszigetelés vastagsága"><Szam ertek={f.padlo.perem.dCm} egyseg="cm" valt={(v) => fv(f.id, (x) => { x.padlo!.perem!.dCm = v; })} /></Mezo>
                  <Mezo cim="Hővezetési ellenállása"><Szam ertek={f.padlo.perem.R} egyseg="m²K/W" valt={(v) => fv(f.id, (x) => { x.padlo!.perem!.R = v; })} /></Mezo>
                </>}
                {(() => { const pp = padloPsi(p, f); return pp.hohid
                  ? <Mezo cim="Ψ padló–fal csatlakozás" sugo={`A(z) „${pp.hohid.nev}” lábazati hőhíd-számításból (Hőhidak lépés)`}><div class="egyseg"><strong>{kov(pp.psi)}</strong><em>W/mK</em></div></Mezo>
                  : <Mezo cim="Ψ padló–fal csatlakozás" sugo="6.4. táblázat a falazat λ, a lábazat és a padló szigetelése szerint, vagy lábazati hőhíd-számításból (Hőhidak lépés)"><Szam ertek={f.padlo?.psiPF} egyseg="W/mK" valt={(v) => fv(f.id, (x) => { x.padlo!.psiPF = v; })} /></Mezo>; })()}
              </div>
              {(() => {
                const falak = opak.filter((o) => o.meret && o.hatar === 'kulso' && p.retegrendek.find((r) => r.id === o.retegrendId)?.szerep === 'fal');
                if (!falak.length) return <p class="halkabb" style="margin-top:8px">A kerület a külső falak hosszából is számolható, ha a homlokzati falakat „Hossz × magasság” módban adod meg.</p>;
                const kij = f.padlo?.falIds ?? [];
                return (
                  <fieldset class="fal-valaszto">
                    <legend>Kerület a földszinti külső falak hosszából {falak.length > 1 && <MindJelolo db={falak.filter((o) => kij.includes(o.id)).length} ossz={falak.length} szoveg="mind / egyik sem" valt={(be) => fv(f.id, (x) => { if (be) x.padlo!.falIds = falak.map((o) => o.id); else delete x.padlo!.falIds; })} />}</legend>
                    {falak.map((o) => (
                      <label class="jelolo"><input type="checkbox" checked={kij.includes(o.id)} onChange={(e) => fv(f.id, (x) => {
                        const l = new Set(x.padlo!.falIds ?? []);
                        if ((e.target as HTMLInputElement).checked) l.add(o.id); else l.delete(o.id);
                        x.padlo!.falIds = [...l];
                        if (!l.size) delete x.padlo!.falIds;
                      })} /> {o.nev} – {sz(o.meret!.hossz, 2)} m</label>
                    ))}
                    {p.meta.szintek > 1 && <span class="halkabb">Több szintnél csak a földszinti falszakaszokat jelöld ki.</span>}
                  </fieldset>
                );
              })()}
              <div class="gombsor" style="margin-top:12px;justify-content:flex-end"><button class="gomb halk-gomb" onClick={() => torol(f.id)}>Padló törlése</button></div>
            </div>
          ))}
        </div>
        <button class="gomb" style="margin-top:12px" onClick={() => modosit((q) => {
          const fal = q.retegrendek.find((r) => r.szerep === 'fal');
          q.feluletek.push({ id: ujId(), nev: 'Talajon fekvő padló', fajta: 'padlo', retegrendId: q.retegrendek.find((r) => r.szerep === 'padlo')?.id, hatar: 'kulso', A: geometria(q).AN, padlo: { P: 0, dfCm: fal ? fal.retegek.reduce((s, x) => s + x.dCm, 0) : 40, z: 0, psiPF: 0.15 } });
        })}>Padló hozzáadása</button>
        {!p.retegrendek.some((r) => r.szerep === 'padlo') && <span class="halkabb" style="margin-left:8px">Ehhez „{SZEREP_NEV.padlo}” rétegrend kell.</span>}
      </section>

      <section class="szakasz">
        <div class="kartya" style="display:flex;gap:32px;flex-wrap:wrap">
          <div><p class="halkabb">Lehűlő felület</p><h2>{sz(g.Alehulo, 1)} m²</h2></div>
          <div><p class="halkabb">Fűtött térfogat</p><h2>{sz(g.V, 1)} m³</h2></div>
          <div><p class="halkabb">Felület/térfogat arány</p><h2>{g.V > 0 ? sz(g.Alehulo / g.V, 3) : '–'} m²/m³</h2></div>
        </div>
      </section>
    </>
  );
}

/** Összesítés szerkezetenként (rétegrend × határ × tájolás): bruttó felület, levont nyílászárók, nettó; azonos felületek összevonása. */
function Osszesites({ p, modosit }: { p: Projekt; modosit: Modosit }) {
  const opak = p.feluletek.filter((f) => f.fajta === 'opak');
  if (!opak.length) return null;
  const csop = new Map<string, { rr: string; hatar: HatarKod; taj: string; db: number; brutto: number; levon: number; netto: number }>();
  for (const f of opak) {
    const k = `${f.retegrendId}|${f.hatar}|${f.tajolas ?? '-'}`;
    const rr = p.retegrendek.find((r) => r.id === f.retegrendId)?.nev ?? '–';
    const c = csop.get(k) ?? { rr, hatar: f.hatar, taj: f.tajolas ?? '–', db: 0, brutto: 0, levon: 0, netto: 0 };
    const netto = feluletNettoA(p, f);
    c.db++; c.brutto += f.A ?? 0; c.netto += netto; c.levon += (f.A ?? 0) - netto;
    csop.set(k, c);
  }
  const sorok = [...csop.values()];
  const azonos = azonosFeluletek(p);
  const kotetlen = p.feluletek.filter((f) => f.fajta === 'nyilaszaro' && !f.szuloId);
  const ossz = sorok.reduce((a, x) => ({ brutto: a.brutto + x.brutto, levon: a.levon + x.levon, netto: a.netto + x.netto }), { brutto: 0, levon: 0, netto: 0 });
  return (
    <section class="szakasz">
      <h2>Összesítés szerkezetenként</h2>
      <p class="halk">Az azonos rétegrendű, határú és tájolású felületek összesítve; a nettó felület a falhoz rendelt nyílászárók levonásával adódik.</p>
      <div class="tabla-gorgeto"><table class="tabla">
        <thead><tr><th>Rétegrend</th><th>Határoló tér</th><th>Tájolás</th><th class="szam">Felületek</th><th class="szam">Bruttó</th><th class="szam">Nyílászárók</th><th class="szam">Nettó</th></tr></thead>
        <tbody>{sorok.map((x) => (
          <tr><td>{x.rr}</td><td>{HATAR_NEV[x.hatar]}</td><td>{x.taj}</td><td class="szam">{x.db} db</td><td class="szam">{sz(x.brutto, 2)} m²</td><td class="szam">{x.levon > 0 ? `− ${sz(x.levon, 2)} m²` : '–'}</td><td class="szam">{sz(x.netto, 2)} m²</td></tr>
        ))}</tbody>
        <tfoot><tr><td colSpan={4}>Összesen</td><td class="szam">{sz(ossz.brutto, 2)} m²</td><td class="szam">− {sz(ossz.levon, 2)} m²</td><td class="szam">{sz(ossz.netto, 2)} m²</td></tr></tfoot>
      </table></div>
      {azonos.length > 0 && (
        <div class="gombsor" style="margin-top:10px">
          <button class="gomb" onClick={() => modosit((q) => { feluletekOsszevon(q); })}>Azonos felületek összevonása ({azonos.reduce((a, c) => a + c.length - 1, 0)} felület)</button>
          <span class="halkabb">Azonos szerkezet, határ, tájolás és hőhidasság; a hosszak (vagy felületek), padlónál a terület és a kerület, nyílászárónál a darabszám összegződik.</span>
        </div>
      )}
      {kotetlen.length > 0 && <div class="figyelmeztetes" style="margin-top:10px">{kotetlen.length} nyílászáró-felület nincs falhoz rendelve, így egyik falból sem vonódik le: {kotetlen.map((f) => f.nev).join(', ')}. A „Falban” oszlopban rendeld a megfelelő falhoz.</div>}
    </section>
  );
}
