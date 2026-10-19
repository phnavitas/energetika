/**
 * Számítási jegyzőkönyv PDF-ben (pdfmake, a böngészőben). Az e-tanúsítás XML CalculationsPdfFileContent mezőjébe is
 * ez kerül base64-ben. A pdfmake csak a jegyzőkönyv készítésekor töltődik be.
 */
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { kovetelmeny, sulyozo, hoszukseglet as H, type EpuletEredmeny, type RendszerEredmeny } from '@mag/index';
import {
  retegrendSzamitas, nyilaszaroAdatok, feluletNettoA, kovetelmenyNev, szabalyozasErtek, hoszuksegletBemenet,
  SZEREP_NEV, HATAR_NEV, type Atalakitas, type Projekt,
} from './modell';
import { anyag } from './katalogus';
import { MAG_VERZIO } from './tarolo-tipusok';

const SZOFTVER = `ÉKM energetikai számító ${MAG_VERZIO}`;
const MODSZER = '9/2023. (V. 25.) ÉKM rendelet; számítási módszer: kormany.hu, 2023.07.27.; 176/2008. (VI. 30.) Korm. rendelet';

const f = (x: number | null | undefined, t = 2) => (x === null || x === undefined || Number.isNaN(x) ? '–' : x.toLocaleString('hu-HU', { minimumFractionDigits: t, maximumFractionDigits: t }));
const MIN_NEV: Record<kovetelmeny.Minosites, string> = { kivalo: 'kiváló', jo: 'jó', kozepes: 'közepes', gyenge: 'gyenge', rossz: 'rossz' };
const OSZTALYOK = ['A+++', 'A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

const SZIN = { tus: '#1D2B33', halk: '#4B5A61', halkabb: '#75848A', vonal: '#C9D1CF', vonal2: '#E1E6E4', jo: '#2F8F5B', rossz: '#C2362F', kiemel: '#E7EEF7' };

function cim(szoveg: string, szint: 1 | 2 = 1): Content {
  return szint === 1
    ? { text: szoveg, style: 'h1', margin: [0, 14, 0, 6], headlineLevel: 1 }
    : { text: szoveg, style: 'h2', margin: [0, 10, 0, 4], headlineLevel: 1 };
}

function adatsor(sorok: [string, string | Content][]): Content {
  return {
    table: { widths: [190, '*'], body: sorok.map(([a, b]) => [{ text: a, color: SZIN.halk }, typeof b === 'string' ? { text: b } : b]) },
    layout: 'noBorders', margin: [0, 0, 0, 4],
  };
}

function tabla(fej: string[], sorok: (string | TableCell)[][], szelessegek?: (string | number)[], jobbra: number[] = []): Content {
  const fejCellak = fej.map((t, i) => ({ text: t, bold: true, color: SZIN.halk, fontSize: 7.5, alignment: jobbra.includes(i) ? 'right' : 'left' } as TableCell));
  const body = sorok.map((s) => s.map((c, i) => (typeof c === 'string' ? ({ text: c, alignment: jobbra.includes(i) ? 'right' : 'left' } as TableCell) : c)));
  return {
    table: { headerRows: 1, widths: szelessegek ?? fej.map(() => '*'), body: [fejCellak, ...body] },
    layout: {
      hLineWidth: (i: number) => (i === 1 ? 0.8 : 0.4), vLineWidth: () => 0,
      hLineColor: (i: number) => (i === 1 ? SZIN.vonal : SZIN.vonal2), paddingTop: () => 2.5, paddingBottom: () => 2.5,
    },
    fontSize: 8, margin: [0, 0, 0, 8],
  };
}

const megfelel = (ok: boolean | null) => (ok === null ? { text: '–' } : { text: ok ? 'megfelel' : 'nem felel meg', color: ok ? SZIN.jo : SZIN.rossz, bold: true });

export async function jegyzokonyvPdf(p: Projekt, e: EpuletEredmeny, atal: Atalakitas): Promise<Uint8Array> {
  const pdfMake = (await import('pdfmake/build/pdfmake')).default;
  const vfs = (await import('pdfmake/build/vfs_fonts')).default as unknown as Record<string, string>;
  pdfMake.vfs = vfs;

  const m = p.meta, g = atal.geometria, ind = e.indikatorok, k = e.kovetelmeny;
  const cimSzoveg = [m.irsz, m.telepules, m.kozterulet ? [m.kozterulet, m.kozteruletJelleg, m.hazszam].filter(Boolean).join(' ') : ''].filter(Boolean).join(', ') || '–';
  const datum = new Date().toLocaleDateString('hu-HU');
  const tartalom: Content[] = [];

  // --- 1. Összesítő ---------------------------------------------------------------------------
  tartalom.push({ text: 'Energetikai számítás – jegyzőkönyv', style: 'cim' });
  tartalom.push({ text: m.nev || 'Névtelen projekt', fontSize: 12, bold: true, margin: [0, 2, 0, 10] });
  tartalom.push(adatsor([
    ['Épület címe', `${cimSzoveg}${m.hrsz ? ` · hrsz. ${m.hrsz}` : ''}`],
    ['Megrendelő', m.megrendelo || '–'],
    ['Tanúsító / tervező', [p.tanusito.nev, p.tanusito.jogosultsag, p.tanusito.email, p.tanusito.telefon].filter(Boolean).join(' · ') || '–'],
    ['Rendeltetés', m.kategoria === 'csaladi_haz' ? 'Lakóépület, családi ház' : 'Lakóépület'],
    ['Építés éve, szintek', `${m.epitesiEv}, ${m.szintek} szint`],
    ['Követelményszint', m.kovetelmenySzint === 'kozel_nulla' ? 'Közel nulla energiaigényű épület (2. melléklet)' : m.kovetelmenySzint === 'jelentos_felujitas' ? 'Jelentős felújítás (3. melléklet)' : 'Meglévő épület'],
    ['Dátum', datum],
  ]));

  const besor = e.besorolas;
  tartalom.push({
    columns: [
      {
        width: 120,
        stack: OSZTALYOK.map((o) => ({
          table: { widths: ['*'], body: [[{ text: o, bold: o === besor.energetikai, color: o === besor.energetikai ? '#FFFFFF' : SZIN.halk, fillColor: o === besor.energetikai ? SZIN.tus : SZIN.vonal2, fontSize: o === besor.energetikai ? 10 : 7.5, margin: [6, 1, 0, 1] }]] },
          layout: 'noBorders', margin: [0, 0, OSZTALYOK.indexOf(o) * 2, 1.5],
        } as Content)),
      },
      {
        width: '*', margin: [16, 0, 0, 0],
        stack: [
          { text: `${besor.energetikai} – a követelmény ${f(besor.energetikaiSzazalek, 1)}%-a`, fontSize: 14, bold: true, margin: [0, 0, 0, 8] },
          tabla(['Mutató', 'Számított', 'Követelmény', 'Referencia', ''], [
            ['Összesített energetikai jellemző Ep [kWh/m²a]', f(ind.fajlagos.EnrenFajl), f(k.EnrenMax), f(kovetelmeny.REFERENCIA_LAKO.EnrenFajl), megfelel(k.EnrenMegfelel)],
            ['Fajlagos CO₂-kibocsátás [kg/m²a]', f(ind.fajlagos.ECO2Fajl), f(k.ECO2Max), f(kovetelmeny.REFERENCIA_LAKO.ECO2Fajl), megfelel(k.ECO2Megfelel)],
            ['Fajlagos hőveszteség-tényező q [W/m³K]', f(e.qm, 3), f(k.qmMax, 3), '–', megfelel(k.qmMegfelel)],
            ['Nyári hővédelmi mutató', e.nyariHovedelem.mutato === null ? `nem kell (${f(e.nyariHovedelem.arany, 3)})` : f(e.nyariHovedelem.mutato, 3), f(kovetelmeny.NYARI_HOVEDELEM.megengedettAtlag, 2), '–', megfelel(e.nyariHovedelem.megfelel)],
          ], ['*', 50, 55, 50, 58], [1, 2, 3]),
          adatsor([
            ['CO₂ szerinti besorolás', `${besor.CO2} (${f(besor.CO2Szazalek, 1)}%)`],
            ['Hasznos alapterület AN', `${f(g.AN)} m²`],
            ['Fűtött térfogat V', `${f(g.V)} m³`],
            ['Felület/térfogat arány', `${f(e.aV, 3)} m²/m³`],
            ['Nettó fűtési energiaigény', `${f(e.qFnet, 1)} kWh/m²a`],
            ['Közel nulla követelmény', e.kovetelmeny.kozelNulla.teljesul ? 'teljesül' : 'nem teljesül'],
          ]),
        ],
      },
    ],
    margin: [0, 6, 0, 0],
  });

  // --- 2. Szerkezetek -------------------------------------------------------------------------
  tartalom.push({ text: '', pageBreak: 'after' });
  tartalom.push(cim('Határoló szerkezetek – rétegrendek'));
  for (const r of p.retegrendek) {
    let er: ReturnType<typeof retegrendSzamitas> | null = null;
    try { er = retegrendSzamitas(r); } catch { /* hiányos */ }
    const kn = kovetelmenyNev(r.kovetelmenyKod);
    const fel = p.feluletek.find((x) => x.retegrendId === r.id);
    const chi = fel?.chi ?? 0;
    tartalom.push({ text: r.nev, style: 'h2', margin: [0, 8, 0, 2], headlineLevel: 1 });
    tartalom.push({ text: `${SZEREP_NEV[r.szerep]} · követelmény: ${kn?.megnevezes ?? '–'}`, color: SZIN.halk, fontSize: 8, margin: [0, 0, 0, 4] });
    if (!er) { tartalom.push({ text: 'Hiányos rétegrend – nem számolható.', color: SZIN.rossz }); continue; }
    tartalom.push(tabla(['#', 'Réteg (belülről kifelé)', 'd [cm]', 'λ [W/mK]', 'R [m²K/W]'], r.retegek.map((x, i) => {
      const a = anyag(x.anyagId);
      return [String(i + 1), x.nev ?? a?.nev ?? '–', f(x.dCm, 1), x.lambda !== undefined ? f(x.lambda, 3) : a?.lambda !== undefined ? f(a.lambda, 3) : x.legreteg ? 'légréteg' : 'R', f(er!.retegR[i], 3)];
    }), [14, '*', 45, 50, 55], [2, 3, 4]));
    const min = kn?.ertekelesiSor ? kovetelmeny.szerkezetMinosites(kn.ertekelesiSor, er.U) : null;
    tartalom.push(adatsor([
      ['Rsi / Rse', `${f(er.Rsi)} / ${f(er.Rse)} m²K/W`],
      ['Rétegtervi U', `${f(er.U, 3)} W/m²K${er.dU ? ` (korrekció ΔU = ${f(er.dU, 4)})` : ''}`],
      ['Megengedett érték', kn ? `${f(kn.Umax, 3)} W/m²K – ${er.U <= kn.Umax + 1e-9 ? 'megfelel' : 'NEM felel meg'}` : '–'],
      ['Hőhidasság', `χ = ${f(chi * 100, 0)}%, eredő U = ${f(er.U * (1 + chi), 3)} W/m²K`],
      ['Minősítés (176/2008, 4. melléklet)', min ? MIN_NEV[min] : '–'],
    ]));
  }

  tartalom.push(cim('Nyílászárók'));
  tartalom.push(tabla(['Típus', 'Méret [cm]', 'Ug', 'Uk', 'Ψ', 'g', 'U [W/m²K]', 'Megengedett'], p.nyilaszarok.map((n) => {
    const d = nyilaszaroAdatok(n);
    const kn = kovetelmenyNev(n.kovetelmenyKod);
    return [n.nev, `${f(n.szelesseg * 100, 0)} × ${f(n.magassag * 100, 0)}`, n.komponens ? f(n.komponens.Ug) : 'kézi', n.komponens ? f(n.komponens.Uk) : '–', n.komponens ? f(n.komponens.psi, 3) : '–', f(n.gn), f(d.U, 3), kn ? f(kn.Umax, 2) : '–'];
  }), ['*', 55, 28, 28, 30, 28, 45, 50], [1, 2, 3, 4, 5, 6, 7]));

  tartalom.push(cim('Határoló felületek'));
  tartalom.push(tabla(['Felület', 'Szerkezet', 'Határ', 'Tájolás', 'A [m²]', 'U [W/m²K]', 'χ'], p.feluletek.map((x) => {
    const r = p.retegrendek.find((y) => y.id === x.retegrendId);
    const n = p.nyilaszarok.find((y) => y.id === x.nyilaszaroId);
    let U = '–';
    try { U = r ? f(retegrendSzamitas(r).U, 3) : n ? f(nyilaszaroAdatok(n).U, 3) : '–'; } catch { /* */ }
    const el = atal.bemenet?.zonak[0]?.elemek.find((y) => y.nev === x.nev);
    if (x.fajta === 'padlo' && el && el.tipus === 'talaj') U = `${f(el.UT, 3)} (UT)`;
    return [x.nev, r?.nev ?? n?.nev ?? '–', HATAR_NEV[x.hatar] ?? x.hatar, x.tajolas ?? '–', f(x.fajta === 'padlo' ? x.A ?? 0 : feluletNettoA(p, x), 2), U, x.chi !== undefined ? f(x.chi, 2) : '–'];
  }), ['*', '*', 70, 34, 40, 50, 24], [4, 5, 6]));
  const szk = e.szerkezetek;
  tartalom.push(cim('Szerkezetek követelményellenőrzése', 2));
  tartalom.push(tabla(['Elem', 'U [W/m²K]', 'Megengedett', 'Minősítés', ''], szk.map((s) => [s.nev, f(s.U, 3), s.Umax !== null ? f(s.Umax, 3) : '–', s.minosites ? MIN_NEV[s.minosites] : '–', megfelel(s.megfelel)]), ['*', 50, 55, 55, 60], [1, 2]));

  // --- 3. Energiamérleg -----------------------------------------------------------------------
  tartalom.push({ text: '', pageBreak: 'after' });
  tartalom.push(cim('Zóna és havi energiamérleg'));
  const z = atal.bemenet?.zonak[0], zr = e.zonak[0];
  if (z && zr) {
    tartalom.push(adatsor([
      ['Zóna', `${z.nev} – lakóépület, θF = ${z.thetaF} °C, θH = ${z.thetaH} °C`],
      ['Légcsere', `nszüks = ${f(z.nSzuks)} 1/h, nfilt = ${f(z.nfilt)} 1/h${z.gepiSzellozes ? `, gépi szellőzés ηr = ${f(z.gepiSzellozes.etaR * 100, 0)}%` : ''}`],
      ['Belső hőnyereség', `${f(z.qb, 1)} W/m²`],
      ['Effektív hőtároló képesség', `${f(zr.CmEff, 0)} kJ/K`],
      ['Nettó fűtési igény', `${f(zr.QFnetEv, 0)} kWh/a (${f(zr.qFnet, 1)} kWh/m²a)`],
      ['Hasznosított passzív szoláris nyereség', `${f(zr.QsdHasznositott, 0)} kWh/a`],
    ]));
    const HO = ['jan', 'feb', 'márc', 'ápr', 'máj', 'jún', 'júl', 'aug', 'szept', 'okt', 'nov', 'dec'];
    tartalom.push(tabla(['Hónap', 'θe [°C]', 'Qtr [kWh]', 'Qszell [kWh]', 'Qveszt [kWh]', 'Qsd [kWh]', 'Qb [kWh]', 'η', 'QF,net [kWh]'],
      zr.havi.map((h, i) => [HO[i]!, f(h.thetaE, 1), f(h.Qtr, 0), f(h.Qszell, 0), f(h.Qveszt, 0), f(h.Qsd, 0), f(h.Qb, 0), f(h.eta, 3), f(h.QFnet, 0)]),
      [32, 34, '*', '*', '*', '*', '*', 32, '*'], [1, 2, 3, 4, 5, 6, 7, 8]));
  }

  // --- 4. Gépészet ----------------------------------------------------------------------------
  tartalom.push(cim('Épülettechnikai rendszerek'));
  const reszlet = (r: RendszerEredmeny, sorok: [string, string, number][]) => sorok.filter(([kk]) => r.reszletek[kk] !== undefined).map(([kk, n, t]) => [n, f(r.reszletek[kk], t)] as [string, string]);
  const futesR = e.rendszerek.filter((r) => r.cel === 'futes');
  p.gepeszet.futes.forEach((a, i) => {
    const r = futesR[i];
    if (!r) return;
    tartalom.push(cim(`Fűtés – ${a.nev}${p.gepeszet.futes.length > 1 ? ` (lefedés ${f((a.lefedes ?? 1) * 100, 0)}%)` : ''}`, 2));
    let eszab = '–'; try { eszab = f(szabalyozasErtek(a.szabalyozas), 3); } catch { /* */ }
    tartalom.push(adatsor([
      ...reszlet(r, [['QFnetFR', 'Fedezett nettó fűtési igény [kWh/a]', 0], ['epszilonF', 'Hőtermelő teljesítménytényezője εF', 3]]),
      ['Szabályozás εF,szab', eszab],
      ['Elosztás', a.elosztas.hely === 'nincs' ? 'nincs' : `fűtött téren ${a.elosztas.hely === 'belul' ? 'belül' : 'kívül'}, ${a.elosztas.elore}/${a.elosztas.vissza} °C`],
      ...reszlet(r, [['qSzall', 'Elosztási veszteség [kWh/m²a]', 2], ['QTar', 'Tárolási veszteség [kWh/a]', 0], ['WFveg', 'Villamos segédenergia [kWh/a]', 0]]),
    ]));
    tartalom.push(tabla(['Végenergia tétel', 'Energiahordozó', 'Q [kWh/a]'], r.tetelek.map((t) => [t.megnevezes, sulyozo.SULYOZO[t.energiahordozo].megnevezes, f(t.Q, 0)]), ['*', 150, 60], [2]));
  });
  const hmvR = e.rendszerek.find((r) => r.cel === 'hmv');
  if (hmvR) {
    tartalom.push(cim('Használati melegvíz', 2));
    tartalom.push(adatsor(reszlet(hmvR, [['QHMVnet', 'Nettó HMV igény [kWh/a]', 0], ['epszilonHMV', 'Teljesítménytényező εHMV', 3], ['QTar', 'Tárolási veszteség [kWh/a]', 0], ['QSzall', 'Elosztási veszteség [kWh/a]', 0], ['Wcirk', 'Cirkuláció segédenergia [kWh/a]', 0]])));
    tartalom.push(tabla(['Végenergia tétel', 'Energiahordozó', 'Q [kWh/a]'], hmvR.tetelek.map((t) => [t.megnevezes, sulyozo.SULYOZO[t.energiahordozo].megnevezes, f(t.Q, 0)]), ['*', 150, 60], [2]));
  }
  const szR = e.rendszerek.find((r) => r.cel === 'szellozes');
  if (szR) {
    tartalom.push(cim('Gépi szellőzés', 2));
    tartalom.push(adatsor(reszlet(szR, [['V', 'Friss levegő [m³/h]', 0], ['uzemora', 'Üzemidő [h/a]', 0], ['Wvent', 'Ventilátor villamos energia [kWh/a]', 0]])));
  }
  if (e.napelem.length) {
    tartalom.push(cim('Napelem (exportáltként elszámolva, 13.1 és 14.7)', 2));
    tartalom.push(tabla(['Mező', 'kWp', 'Tájolás', 'Hajlásszög', 'Termelés [kWh/a]'], p.gepeszet.napelem.map((n, i) => [n.nev, f(n.kWp, 2), n.tajolas.replace('_', '/'), `${n.hajlasszog}°`, f(e.napelem[i]?.W, 0)]), ['*', 40, 60, 50, 70], [1, 3, 4]));
  }

  // --- 5. Indikátorok -------------------------------------------------------------------------
  tartalom.push(cim('Primerenergia és CO₂ felhasználási célonként'));
  const CEL: [keyof typeof ind.celonkent, string][] = [['futes', 'Fűtés'], ['hmv', 'Használati melegvíz'], ['szellozes', 'Szellőzés'], ['hutes', 'Hűtés'], ['vilagitas', 'Világítás'], ['export', 'Exportált energia (levonandó)']];
  tartalom.push(tabla(['Cél', 'Enren [kWh/a]', 'Eren [kWh/a]', 'Etot [kWh/a]', 'CO₂ [kg/a]'],
    [...CEL.filter(([c]) => ind.celonkent[c].tot !== 0).map(([c, n]) => [n, f(ind.celonkent[c].nren, 0), f(ind.celonkent[c].ren, 0), f(ind.celonkent[c].tot, 0), f(ind.celonkent[c].CO2, 0)]),
      [{ text: 'Összesen', bold: true }, { text: f(ind.osszes.nren, 0), bold: true, alignment: 'right' }, { text: f(ind.osszes.ren, 0), bold: true, alignment: 'right' }, { text: f(ind.osszes.tot, 0), bold: true, alignment: 'right' }, { text: f(ind.osszes.CO2, 0), bold: true, alignment: 'right' }]],
    ['*', 70, 70, 70, 70], [1, 2, 3, 4]));
  tartalom.push(tabla(['Energiahordozó', 'Végenergia [kWh/a]', 'Fajlagos [kWh/m²a]'], Object.entries(ind.vegenergia).filter(([, Q]) => (Q ?? 0) > 0).map(([eh, Q]) => [sulyozo.SULYOZO[eh as keyof typeof sulyozo.SULYOZO].megnevezes, f(Q, 0), f((Q ?? 0) / g.AN, 2)]), ['*', 90, 90], [1, 2]));
  const rf = e.rendszerErtekeles;
  tartalom.push(cim('Épülettechnikai rendszerek értékelése (176/2008, 5. melléklet)', 2));
  tartalom.push(tabla(['Rendszer', 'Enren [kWh/a]', 'Referencia [kWh/a]', 'Arány', 'Minősítés'], [
    ...(rf.futes ? [['Fűtés', f(rf.futes.Enren, 0), f(rf.futes.EnrenRef, 0), `${f(rf.futes.szazalek, 0)}%`, MIN_NEV[rf.futes.minosites]]] : []),
    ...(rf.hmv ? [['Használati melegvíz', f(rf.hmv.Enren, 0), f(rf.hmv.EnrenRef, 0), `${f(rf.hmv.szazalek, 0)}%`, MIN_NEV[rf.hmv.minosites]]] : []),
  ], ['*', 70, 80, 45, 60], [1, 2, 3]));

  // --- 6. Hőszükséglet ------------------------------------------------------------------------
  try {
    const hb = hoszuksegletBemenet(p);
    if (hb.bemenet.helyisegek.some((h) => h.elemek.length)) {
      const hr = H.helyisegHoszukseglet(hb.bemenet);
      tartalom.push({ text: '', pageBreak: 'after' });
      tartalom.push(cim('Helyiségenkénti tervezési hőszükséglet (MSZ EN 12831 szerkezetű számítás)'));
      tartalom.push({ text: `θe = ${f(hb.bemenet.thetaE, 0)} °C · n50 = ${f(hb.bemenet.n50, 1)} 1/h · ${H.HSZ_FORRAS}. Nem része a 9/2023 ÉKM szerinti energetikai számításnak.`, fontSize: 7.5, color: SZIN.halk, margin: [0, 0, 0, 6] });
      tartalom.push(tabla(['Helyiség', 'A [m²]', 'θint [°C]', 'ΦT [W]', 'ΦV [W]', 'ΦRH [W]', 'ΦHL [W]', 'W/m²'],
        [...hr.helyisegek.map((h) => [h.nev, f(h.A, 1), f(h.thetaInt, 0), f(h.PhiT, 0), f(h.PhiV, 0), f(h.PhiRH, 0), f(h.PhiHL, 0), f(h.fajlagos, 0)]),
          [{ text: 'Összesen', bold: true }, '', '', f(hr.PhiT, 0), f(hr.PhiV, 0), f(hr.PhiRH, 0), { text: f(hr.osszesen, 0), bold: true, alignment: 'right' }, '']],
        ['*', 40, 42, 45, 45, 45, 50, 35], [1, 2, 3, 4, 5, 6, 7]));
    }
  } catch { /* hiányos hőszükséglet-adatok: kimarad */ }

  // --- 7. Megjegyzések ------------------------------------------------------------------------
  const fw = [...new Map(e.figyelmeztetesek.map((x) => [x.kod + x.uzenet, x])).values()];
  if (fw.length) {
    tartalom.push(cim('Megjegyzések, alkalmazott értelmezések', 2));
    tartalom.push({ ul: fw.map((x) => ({ text: [x.uzenet, { text: ` (${x.forras})`, color: SZIN.halkabb }] })), fontSize: 7.5, color: SZIN.halk });
  }

  const dd: TDocumentDefinitions = {
    pageSize: 'A4', pageMargins: [40, 52, 40, 48],
    info: { title: `Energetikai számítás – ${m.nev}`, author: p.tanusito.nev || undefined, creator: SZOFTVER, subject: 'Számítási jegyzőkönyv' },
    header: (oldal) => (oldal === 1 ? null : { columns: [{ text: m.nev, color: SZIN.halkabb }, { text: cimSzoveg, color: SZIN.halkabb, alignment: 'right' }], fontSize: 7, margin: [40, 24, 40, 0] }),
    footer: (oldal, osszes) => ({ columns: [{ text: `${SZOFTVER} · ${MODSZER}`, color: SZIN.halkabb }, { text: `${oldal} / ${osszes}`, alignment: 'right', color: SZIN.halkabb, width: 40 }], fontSize: 6.5, margin: [40, 16, 40, 0] }),
    content: tartalom,
    // Cím ne maradjon egyedül a lap alján: az oldal alsó 14%-ában kezdődő cím új oldalra kerül.
    pageBreakBefore: (n) => n.headlineLevel === 1 && (n.startPosition?.verticalRatio ?? 0) > 0.86,
    styles: {
      cim: { fontSize: 18, bold: true, color: SZIN.tus },
      h1: { fontSize: 12, bold: true, color: SZIN.tus },
      h2: { fontSize: 9.5, bold: true, color: SZIN.tus },
    },
    defaultStyle: { font: 'Roboto', fontSize: 8.5, color: SZIN.tus, lineHeight: 1.15 },
  };
  return new Promise((ok, hiba) => {
    try { pdfMake.createPdf(dd).getBuffer((b: Uint8Array) => ok(new Uint8Array(b))); } catch (err) { hiba(err); }
  });
}

export function base64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}
