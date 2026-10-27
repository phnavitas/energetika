/**
 * Számítási jegyzőkönyv PDF-ben (pdfmake, a böngészőben). Az e-tanúsítás XML CalculationsPdfFileContent mezőjébe is
 * ez kerül base64-ben. A pdfmake csak a jegyzőkönyv készítésekor töltődik be.
 */
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { kovetelmeny, sulyozo, klima, epuletfizika, profilok, hoszukseglet as H, type EpuletEredmeny, type RendszerEredmeny, type NyilaszaroElem } from '@mag/index';
import {
  retegrendSzamitas, nyilaszaroAdatok, nyilaszaroGeometria, FOTO_KATEGORIAK, kovetelmenyNev, szabalyozasErtek, hoszuksegletBemenet,
  SZEREP_NEV, type Atalakitas, type Projekt, chiErvenyes } from './modell';
import { anyag } from './katalogus';
import { haviMerlegSvg, savokSvg, uErtekSvg, retegrendSvg } from './jegyzokonyvAbrak';
import { MAG_VERZIO } from './tarolo-tipusok';
import { alternativVizsgalat, ALT_NEV, URLAP } from './alternativ';

const SZOFTVER = `ÉKM energetikai számító ${MAG_VERZIO}`;
const MODSZER = '9/2023. (V. 25.) ÉKM rendelet; számítási módszer: kormany.hu, 2023.07.27.; 176/2008. (VI. 30.) Korm. rendelet';

const f = (x: number | null | undefined, t = 2) => (x === null || x === undefined || Number.isNaN(x) ? '–' : x.toLocaleString('hu-HU', { minimumFractionDigits: t, maximumFractionDigits: t }));
const MIN_NEV: Record<kovetelmeny.Minosites, string> = { kivalo: 'kiváló', jo: 'jó', kozepes: 'közepes', gyenge: 'gyenge', rossz: 'rossz' };
const OSZTALYOK = ['A+++', 'A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
/** Energiaosztály-skála színei (zöldtől pirosig), mint a képernyőn. */
const OSZTALY_SZIN = ['#14693B', '#1E7A46', '#2F8F4E', '#4AA145', '#7DB33A', '#B5BE2E', '#D9B526', '#E39A22', '#E07B21', '#D65A22', '#C63D24', '#A92A25', '#842022'];

const SZIN = { tus: '#1D2B33', halk: '#4B5A61', halkabb: '#75848A', vonal: '#C9D1CF', vonal2: '#E1E6E4', jo: '#2F8F5B', rossz: '#C2362F', kiemel: '#E7EEF7' };

/** Fejezetszámláló: a jegyzőkönyv fejezetei és alfejezetei folyamatosan számozódnak. */
class Szamozo { f = 0; a = 0; fejezet() { this.f++; this.a = 0; return `${this.f}.`; } alfejezet() { this.a++; return `${this.f}.${this.a}.`; } }
let SZ = new Szamozo();

/** Fejezetcím vonallal: a fejezet tartalma vizuálisan a címhez kötődik. */
function cim(szoveg: string, szint: 1 | 2 = 1): Content {
  if (szint === 1) {
    return {
      stack: [
        { text: [{ text: SZ.fejezet() + '  ', color: SZIN.halkabb }, szoveg], style: 'h1' },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.8, lineColor: SZIN.tus }] },
      ],
      margin: [0, 14, 0, 6], headlineLevel: 1,
    } as Content;
  }
  return { text: [{ text: SZ.alfejezet() + '  ', color: SZIN.halkabb }, szoveg], style: 'h2', margin: [0, 8, 0, 3], headlineLevel: 1 };
}

/** Rövid magyarázó sor (képlet, forrás) a táblázatok alatt. */
const megj = (t: string | Content[]): Content => ({ text: t, fontSize: 7, color: SZIN.halk, margin: [0, -4, 0, 6] } as Content);

function adatsor(sorok: [string, string | Content][], bal = 190): Content {
  return {
    table: { widths: [bal, '*'], body: sorok.map(([a, b]) => [{ text: a, color: SZIN.halk }, typeof b === 'string' ? { text: b } : b]) },
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

export async function jegyzokonyvPdf(p: Projekt, e: EpuletEredmeny, atal: Atalakitas, opt: { helyisegLista?: boolean; retegrendAbra?: boolean } = {}): Promise<Uint8Array> {
  const pdfMake = (await import('pdfmake/build/pdfmake')).default;
  const vfs = (await import('pdfmake/build/vfs_fonts')).default as unknown as Record<string, string>;
  pdfMake.vfs = vfs;

  const m = p.meta, g = atal.geometria, ind = e.indikatorok, k = e.kovetelmeny;
  // energiahordozó neve: távhőnél a szolgáltató által közölt súlyozó tényezőkkel (9/2023 ÉKM 8. § (1))
  const th = p.gepeszet.tavho;
  const ehNev = (eh: string, reszletes = false) => eh === 'tavho' && th
    ? `Távhő – ${th.szolgaltato}${th.rendszer ? `, ${th.rendszer}` : ''}${reszletes ? ` (szolgáltatói adat: fnren ${f(th.fnren, 3)}, fren ${f(th.fren, 3)}, fCO₂ ${f(th.fCO2, 1)} g/kWh)` : ''}`
    : sulyozo.SULYOZO[eh as keyof typeof sulyozo.SULYOZO].megnevezes;
  const cimSzoveg = [m.irsz, m.telepules, m.kozterulet ? [m.kozterulet, m.kozteruletJelleg, m.hazszam].filter(Boolean).join(' ') : ''].filter(Boolean).join(', ') || '–';
  const datum = new Date().toLocaleDateString('hu-HU');
  const tartalom: Content[] = [];
  SZ = new Szamozo();
  const z = atal.bemenet?.zonak[0], zr = e.zonak[0];
  const HO = ['jan', 'feb', 'márc', 'ápr', 'máj', 'jún', 'júl', 'aug', 'szept', 'okt', 'nov', 'dec'];
  const fotok = p.fotok ?? [];
  const cimlap = fotok.find((x) => x.kategoria === 'CoverPhoto');

  // --- Összesítő (1. oldal) ------------------------------------------------------------------
  // csoportosított, tömör adatblokk: címke-oszlop + érték, csoportfejléccel
  const csoport = (cim0: string, sorok: [string, string | Content][]): Content => ({
    stack: [
      { text: cim0.toUpperCase(), fontSize: 6.5, bold: true, color: SZIN.halkabb, characterSpacing: 0.4, margin: [0, 0, 0, 1] },
      { table: { widths: [78, '*'], body: sorok.map(([x, y]) => [{ text: x, color: SZIN.halk }, typeof y === 'string' ? { text: y } : y]) }, layout: { defaultBorder: false, paddingTop: () => 0.6, paddingBottom: () => 0.6, paddingLeft: () => 0, paddingRight: () => 4 }, fontSize: 8 },
    ],
    margin: [0, 0, 0, 5],
  } as Content);
  const tanusitoSor = [p.tanusito.nev, p.tanusito.jogosultsag, p.tanusito.email, p.tanusito.telefon].filter(Boolean).join(' · ') || '–';
  const tervezoSor = [m.tervezo, m.tervezoNy].filter(Boolean).join(' · ') || '–';
  const QFnetOssz = e.zonak.reduce((t, zz) => t + zz.QFnetEv, 0);
  tartalom.push({
    columns: [
      {
        width: '*',
        stack: [
          { text: 'Energetikai számítás', style: 'cim' },
          { text: m.nev || 'Névtelen projekt', fontSize: 12, bold: true, margin: [0, 2, 0, 6] },
          {
            columns: [
              { width: '*', stack: [
                csoport('Épület', [
                  ['Cím', `${cimSzoveg}${m.hrsz ? ` · hrsz. ${m.hrsz}` : ''}`],
                  ['Rendeltetés', m.rendeltetes === 'egyeb' ? 'Egyéb rendeltetés' : m.kategoria === 'csaladi_haz' ? 'Lakóépület, családi ház' : 'Lakóépület'],
                  ['Építés éve, szint', `${m.epitesiEv}${m.nyilaszaroCsereEv ? ` (nyílászárócsere ${m.nyilaszaroCsereEv})` : ''} · ${m.szintek} szint`],
                  ['AN / V / A/V', `${f(g.AN)} m² · ${f(g.V)} m³ · ${f(e.aV, 3)} m²/m³`],
                ]),
                csoport('Szereplők', [
                  ['Megrendelő', m.megrendelo || '–'],
                  ['Tervező', tervezoSor],
                  ['Tanúsító', tanusitoSor],
                ]),
              ] },
              { width: 170, stack: [
                csoport('Számítás', [
                  ['Követelményszint', m.kovetelmenySzint === 'kozel_nulla' ? 'Közel nulla (2. mell.)' : m.kovetelmenySzint === 'jelentos_felujitas' ? 'Jelentős felújítás (3. mell.)' : 'Meglévő épület'],
                  ['Dátum', datum],
                ]),
              ] },
            ],
            columnGap: 10,
          },
        ],
      },
      ...(cimlap ? [{ width: 150, image: cimlap.dataUrl, fit: [150, 112] as [number, number], margin: [10, 0, 0, 0] } as Content] : []),
    ],
  });

  const besor = e.besorolas;
  // színes osztályskála (SVG), nyíllal jelölve az Ep és a CO₂ szerinti besorolás
  const skalaSvg = (() => {
    const sorM = 13, W = 250, fej = 12;
    const H = fej + OSZTALYOK.length * sorM;
    const yOf = (o: string) => fej + OSZTALYOK.indexOf(o) * sorM;
    const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
    svg += `<text x="160" y="8" font-size="7" font-weight="bold" fill="${SZIN.halkabb}">Ep</text><text x="207" y="8" font-size="7" font-weight="bold" fill="${SZIN.halkabb}">CO2</text>`;
    OSZTALYOK.forEach((o, i) => {
      const y = fej + i * sorM, w = 58 + i * 6;
      svg += `<rect x="0" y="${y}" width="${w}" height="${sorM - 1.5}" fill="${OSZTALY_SZIN[i]}"/><polygon points="${w},${y} ${w + 5},${y + (sorM - 1.5) / 2} ${w},${y + sorM - 1.5}" fill="${OSZTALY_SZIN[i]}"/>`;
      svg += `<text x="5" y="${y + 8.6}" font-size="8" font-weight="bold" fill="#FFFFFF">${esc(o)}</text>`;
    });
    const jel = (x: number, o: string, t: string) => {
      const y = yOf(o), h = sorM - 1.5, c = y + h / 2;
      return `<polygon points="${x},${c} ${x + 6},${y} ${x + 44},${y} ${x + 44},${y + h} ${x + 6},${y + h}" fill="${SZIN.tus}"/><text x="${x + 9}" y="${y + 8.6}" font-size="7.5" font-weight="bold" fill="#FFFFFF">${esc(t)}</text>`;
    };
    if (OSZTALYOK.includes(besor.energetikai)) svg += jel(152, besor.energetikai, `${besor.energetikai} ${f(besor.energetikaiSzazalek, 0)}%`);
    if (OSZTALYOK.includes(besor.CO2)) svg += jel(200, besor.CO2, `${besor.CO2} ${f(besor.CO2Szazalek, 0)}%`);
    return svg + '</svg>';
  })();
  tartalom.push({
    columns: [
      { width: 250, svg: skalaSvg } as Content,
      {
        width: '*', margin: [12, 0, 0, 0],
        stack: [
          { text: `${besor.energetikai} – a követelmény ${f(besor.energetikaiSzazalek, 1)}%-a`, fontSize: 13, bold: true, margin: [0, 0, 0, 1] },
          { text: `CO₂ szerint: ${besor.CO2} (${f(besor.CO2Szazalek, 1)}%) · közel nulla követelmény ${e.kovetelmeny.kozelNulla.teljesul ? 'teljesül' : 'nem teljesül'}`, fontSize: 8, color: SZIN.halk, margin: [0, 0, 0, 6] },
          csoport('Fő mutatók', [
            ['Ep', `${f(ind.fajlagos.EnrenFajl)} kWh/m²a (≤ ${f(k.EnrenMax)})`],
            ['CO₂', `${f(ind.fajlagos.ECO2Fajl)} kg/m²a (≤ ${f(k.ECO2Max)})`],
            ['q', `${f(e.qm, 3)} W/m³K (≤ ${f(k.qmMax, 3)})`],
          ]),
          csoport('Nettó fűtési energiaigény', [
            ['Fajlagos', `${f(e.qFnet, 1)} kWh/m²a`],
            ['Összes', `${f(QFnetOssz, 0)} kWh/a (${f(QFnetOssz / 1000, 1)} MWh/a)`],
          ]),
        ],
      },
    ],
    margin: [0, 6, 0, 6],
  });
  tartalom.push(tabla(['Mutató', 'Számított', 'Követelmény', 'Referencia', ''], [
            ['Összesített energetikai jellemző Ep [kWh/m²a]', f(ind.fajlagos.EnrenFajl), f(k.EnrenMax), f(e.referenciaEpulet.teljes ? e.referenciaEpulet.EnrenFajl : kovetelmeny.REFERENCIA_LAKO.EnrenFajl), megfelel(k.EnrenMegfelel)],
            ['Fajlagos CO₂-kibocsátás [kg/m²a]', f(ind.fajlagos.ECO2Fajl), f(k.ECO2Max), f(e.referenciaEpulet.teljes ? e.referenciaEpulet.ECO2Fajl : kovetelmeny.REFERENCIA_LAKO.ECO2Fajl), megfelel(k.ECO2Megfelel)],
            ['Fajlagos hőveszteség-tényező q [W/m³K] (3.4.)', f(e.qm, 3), f(k.qmMax, 3), '–', megfelel(k.qmMegfelel)],
            ['Nyári hővédelmi mutató (3.5.)', e.nyariHovedelem.mutato === null ? 'nem kell' : f(e.nyariHovedelem.mutato, 3), f(kovetelmeny.NYARI_HOVEDELEM.megengedettAtlag, 2), '–', megfelel(e.nyariHovedelem.megfelel)],
            ['Szerkezetek elemi követelménye (2.4.)', `${e.szerkezetek.filter((s) => s.megfelel === false).length} hibás`, '0', '–', megfelel(e.szerkezetek.every((s) => s.megfelel !== false))],
          ], ['*', 48, 52, 48, 56], [1, 2, 3]));

  // --- Határoló szerkezetek ------------------------------------------------------------------
  tartalom.push(cim('Határoló szerkezetek'));
  tartalom.push(cim('Rétegrendek (rétegtervi U, 1. függ. 4. fejezet)', 2));
  for (const r of p.retegrendek) {
    let er: ReturnType<typeof retegrendSzamitas> | null = null;
    try { er = retegrendSzamitas(r); } catch { /* hiányos */ }
    const kn = kovetelmenyNev(r.kovetelmenyKod);
    const fel = p.feluletek.find((x) => x.retegrendId === r.id);
    const chi = fel ? chiErvenyes(p, fel) : 0;
    const blokk: Content[] = [{
      columns: [
        { text: r.nev, bold: true, fontSize: 8.5 },
        { text: [...new Set([SZEREP_NEV[r.szerep], kn?.megnevezes ?? '–'])].join(' · '), color: SZIN.halk, fontSize: 7.5, alignment: 'right' },
      ], margin: [0, 4, 0, 2],
    }];
    if (!er) { tartalom.push({ stack: [...blokk, { text: 'Hiányos rétegrend – nem számolható.', color: SZIN.rossz }] }); continue; }
    const retegTabla = tabla(['#', 'Réteg (belülről kifelé)', 'd [cm]', 'λ [W/mK]', 'R [m²K/W]'], [
      ...r.retegek.map((x, i) => {
        const a = anyag(x.anyagId);
        return [String(i + 1), x.nev ?? a?.nev ?? '–', f(x.dCm, 1), x.lambda !== undefined ? `${f(x.lambda, 3)}${a ? ' (kézi)' : ''}` : a?.lambda !== undefined ? f(a.lambda, 3) : x.legreteg ? 'légréteg' : 'R', f(er!.retegR[i], 3)];
      }),
      ['', { text: `Rsi + Rse = ${f(er.Rsi)} + ${f(er.Rse)}`, color: SZIN.halk }, '', '', f(er.Rsi + er.Rse, 3)],
    ], [14, '*', 40, 45, 50], [2, 3, 4]);
    if (opt.retegrendAbra) {
      const svg = retegrendSvg(r.retegek.map((x, i) => ({ dCm: x.dCm, R: er!.retegR[i] ?? 0, sraffozas: anyag(x.anyagId)?.sraffozas, legreteg: !!x.legreteg })), er.Rsi, er.Rse, 20, -13, 170, 92, r.szerep === 'padlo' || r.kovetelmenyKod === 'talajjal_erintkezo_fal');
      blokk.push({ columns: [{ width: '*', stack: [retegTabla] }, { width: 170, svg, margin: [8, 0, 0, 0] }] } as Content);
    } else blokk.push(retegTabla);
    const min = kn?.ertekelesiSor ? kovetelmeny.szerkezetMinosites(kn.ertekelesiSor, er.U) : null;
    blokk.push(megj([
      { text: `U = 1/ΣR = ${f(er.U, 3)} W/m²K`, bold: true, color: SZIN.tus },
      er.dU ? ` (ΔU = ${f(er.dU, 4)})` : '',
      kn ? ` · Umax = ${f(kn.Umax, 3)}: ` : '', kn ? { text: er.U <= kn.Umax + 1e-9 ? 'megfelel' : 'nem felel meg', color: er.U <= kn.Umax + 1e-9 ? SZIN.jo : SZIN.rossz } : '',
      ` · χ = ${f(chi * 100, 0)}%, eredő U = ${f(er.U * (1 + chi), 3)} W/m²K`,
      min ? ` · minősítés: ${MIN_NEV[min]}` : '',
    ]));
    tartalom.push({ stack: blokk, unbreakable: true });
  }

  tartalom.push(cim('Nyílászárók (2. függ. 4.16–4.18 képlet)', 2));
  tartalom.push(tabla(['Típus', 'Méret [cm]', 'Aü / Ak [m²]', 'lkü [m]', 'Ug / Uk', 'Ψ', 'g', 'U [W/m²K]', 'Umax'], p.nyilaszarok.map((n) => {
    const d = nyilaszaroAdatok(n);
    const kn = kovetelmenyNev(n.kovetelmenyKod);
    let geo: ReturnType<typeof nyilaszaroGeometria> | null = null;
    try { geo = n.komponens ? nyilaszaroGeometria(n) : null; } catch { /* */ }
    const k2 = n.komponens;
    return [
      { text: [n.nev, k2?.kapcsoltResMm ? { text: ` (kapcsolt, ${k2.kapcsoltResMm} mm)`, color: SZIN.halk } : !k2 ? { text: ' (gyártói Uw)', color: SZIN.halk } : ''] },
      `${f(n.szelesseg * 100, 0)} × ${f(n.magassag * 100, 0)}`,
      geo ? `${f(geo.Aü, 2)} / ${f(geo.Ak, 2)}` : `${f(d.Au, 2)} / ${f(d.A - d.Au, 2)}`,
      geo ? f(geo.lkü + (geo.lmü ?? 0), 2) : '–',
      k2 ? `${f(k2.Ug, 1)} / ${f(k2.Uk, 1)}` : '–',
      k2 ? f(k2.psi, 3) : '–', f(n.gn), { text: f(d.U, 3), bold: true, alignment: 'right' }, kn ? f(kn.Umax, 2) : '–',
    ];
  }), ['*', 48, 52, 32, 40, 30, 26, 40, 30], [1, 2, 3, 4, 5, 6, 7, 8]));
  tartalom.push(megj('Uw = (Aü·Uü + Ak·Uk + lkü·Ψkü + lmü·Ψmü) / A; kapcsolt szárnyú ablaknál 1/U = 1/U₁ − Rsi + Rl − Rse + 1/U₂ (4.17). Társított árnyékolóval a fűtési U a 4.18 képlet szerint.'));

  if (z) {
    tartalom.push(cim('Transzmissziós hőveszteség elemenként (6.1–6.7 képlet)', 2));
    let sD = 0, sX = 0, sT = 0;
    const katH = new Map<string, number>();
    // azonos szerkezet, tájolás, U, χ és határ: egy sor (felület és H összegezve)
    const csop = new Map<string, { el: (typeof z.elemek)[number]; db: number; A: number; H: number; Hb: number }>();
    for (const el of z.elemek) {
      const nev = ('szerkezet' in el && el.szerkezet) || el.nev;
      const taj = el.tipus === 'nyilaszaro' || el.tipus === 'opak' ? el.tajolas ?? '' : '';
      const k = el.tipus === 'opak' ? `o|${nev}|${taj}|${el.U.toFixed(4)}|${el.chi}|${JSON.stringify(el.hatar)}`
        : el.tipus === 'nyilaszaro' ? `n|${nev}|${taj}|${(el.UFutes ?? el.U).toFixed(4)}|${JSON.stringify(el.hatar)}` : `x|${csop.size}`;
      const A = el.tipus === 'opak' || el.tipus === 'nyilaszaro' ? el.A : 0;
      const db = el.tipus === 'nyilaszaro' ? el.darab ?? 1 : 1;
      const H = el.tipus === 'opak' ? el.A * el.U * (1 + el.chi) : el.tipus === 'nyilaszaro' ? el.A * (el.UFutes ?? el.U) : 0;
      const x = csop.get(k);
      if (x) { x.db += db; x.A += A; x.H += H; } else csop.set(k, { el, db, A, H, Hb: 0 });
    }
    const TR = { opak: 0, talaj: 1, nyilaszaro: 2 } as Record<string, number>, TAJ = ['É', 'ÉK', 'K', 'DK', 'D', 'DNy', 'Ny', 'ÉNy'];
    const kulcs = (el: (typeof z.elemek)[number]) => [TR[el.tipus] ?? 3, ('szerkezet' in el && el.szerkezet) || el.nev, el.tipus === 'opak' || el.tipus === 'nyilaszaro' ? TAJ.indexOf(el.tajolas ?? '') : -1] as const;
    const rendezett = [...csop.values()].sort((a, b) => { const x = kulcs(a.el), y = kulcs(b.el); return x[0] - y[0] || String(x[1]).localeCompare(String(y[1]), 'hu', { numeric: true }) || x[2] - y[2]; });
    const sorok = rendezett.map(({ el: el0, db, A: Aossz, H: Hossz }) => {
      const el = el0.tipus === 'opak' || el0.tipus === 'nyilaszaro' ? { ...el0, A: Aossz } : el0;
      let A = '–', U = '–', chi = '–', b = '1', H = 0;
      if (el.tipus === 'opak') { A = f(el.A, 2); U = f(el.U, 3); chi = f(el.chi, 2); H = Hossz; }
      else if (el.tipus === 'nyilaszaro') { A = f(el.A, 2); U = f(el.UFutes ?? el.U, 3); H = Hossz; }
      else if (el.tipus === 'talaj') { A = f(el.A, 2); U = `${f(el.UT, 3)} UT`; chi = `P·Ψ ${f(el.P * el.psiPF, 1)}`; H = el.A * el.UT + el.P * el.psiPF + (el.pinceFal ? el.pinceFal.z * el.P * el.pinceFal.UTpf : 0); }
      else if (el.tipus === 'vonal') { A = `${f(el.l, 1)} m`; U = `Ψ ${f(el.psi, 3)}`; H = el.l * el.psi; }
      else { A = `${el.db} db`; U = `χ ${f(el.chi, 3)}`; H = el.chi * el.db; }
      const hatar = el.tipus === 'talaj' ? null : el.hatar;
      let bt = 1;
      if (hatar && hatar.tipus === 'futetlen') bt = epuletfizika.bErtek(hatar.b, 0);
      else if (hatar && hatar.tipus === 'futetlen_b') bt = hatar.bTel;
      if (hatar && hatar.tipus !== 'kulso') b = f(bt, 2);
      if (el.tipus === 'talaj') { sT += H; b = 'talaj'; } else if (hatar?.tipus === 'kulso') sD += H; else sX += bt * H;
      {
        const Hv = H * (el.tipus === 'talaj' ? 1 : bt);
        const kod = 'kovetelmenyKod' in el ? el.kovetelmenyKod ?? '' : '';
        const add = (k0: string, v: number) => katH.set(k0, (katH.get(k0) ?? 0) + v);
        if (el.tipus === 'opak') { const ch = Hv * el.chi / (1 + el.chi); add(/fal/.test(kod) ? 'Falak' : /also|arkad|padlo/.test(kod) ? 'Padló, alsó födém' : /fodem|teto|tető/.test(kod) ? 'Tetők, felső födémek' : 'Egyéb opak', Hv - ch); add('Hőhidak (χ, Ψ)', ch); }
        else if (el.tipus === 'nyilaszaro') add(/ajto|kapu/.test(kod) ? 'Ajtók, kapuk' : 'Ablakok, üvegezett szerkezetek', Hv);
        else if (el.tipus === 'talaj') add('Talajjal érintkező szerkezetek', Hv);
        else add('Hőhidak (χ, Ψ)', Hv);
      }
      const taj = el.tipus === 'nyilaszaro' ? el.tajolas ?? 'vízsz.' : el.tipus === 'opak' ? el.tajolas ?? '' : '';
      const nev = ('szerkezet' in el && el.szerkezet) || el.nev;
      const tobb = el.tipus === 'nyilaszaro' ? ` · ${db} db` : db > 1 ? ` · ${db} felület` : '';
      return [{ text: [nev, taj || tobb ? { text: `${taj ? ` · ${taj}` : ''}${tobb}`, color: SZIN.halk } : ''] }, A, U, chi, b, f(H * (el.tipus === 'talaj' ? 1 : bt), 2)];
    });
    tartalom.push(tabla(['Elem', 'A [m²] / l', 'U [W/m²K]', 'χ', 'b (tél)', 'H [W/K]'], [
      ...sorok,
      [{ text: `HtrD = ${f(sD, 1)} · HtrX = ${f(sX, 1)} · HtrT = ${f(sT, 1)} W/K`, color: SZIN.halk, colSpan: 5 }, '', '', '', '', { text: f(sD + sX + sT, 1), bold: true, alignment: 'right' }],
    ] as TableCell[][], ['*', 55, 55, 50, 38, 48], [1, 2, 3, 4, 5]));
    tartalom.push(megj(`HtrD = Σ A·U·(1+χ) külső levegő felé; HtrX = Σ b·A·U·(1+χ) fűtetlen tér felé (b havonta, itt a téli érték); HtrT a talajjal érintkező szerkezeteké (6.5–6.6), az évi középhőmérséklettel (${f(klima.KULSO_HOMERSEKLET_EVES, 1)} °C) számolva.`));
    {
      const Hsz = zr?.havi[0]?.Hszell ?? 0;
      const KAT = ['Falak', 'Ablakok, üvegezett szerkezetek', 'Ajtók, kapuk', 'Tetők, felső födémek', 'Padló, alsó födém', 'Talajjal érintkező szerkezetek', 'Hőhidak (χ, Ψ)', 'Egyéb opak'];
      const SZINEK = ['#3E6E8E', '#5B9BC2', '#8FB3C9', '#6D8F5A', '#A3B86C', '#B08B57', '#C2362F', '#9AA5AA'];
      const sor = KAT.map((n, i) => ({ nev: n, ertek: katH.get(n) ?? 0, szin: SZINEK[i] })).filter((x) => x.ertek > 0.05);
      if (Hsz > 0) sor.push({ nev: 'Szellőzés (Hszell, fűtési)', ertek: Hsz, szin: '#E3A72F' });
      tartalom.push({ stack: [{ text: 'Hőveszteség-tényező megoszlása [W/K]', bold: true, fontSize: 8.5, margin: [0, 4, 0, 3] }, { svg: savokSvg(sor, 'W/K', 515, 1) }], unbreakable: true, margin: [0, 0, 0, 6] } as Content);
    }
  }

  tartalom.push(cim('Szerkezetek követelményellenőrzése (1. melléklet)', 2));
  {
    // azonos szerkezet, tájolás és U: egy sor felület- és darabszám-összeggel
    const m = new Map<string, { s: (typeof e.szerkezetek)[number]; A: number; db: number }>();
    for (const s of e.szerkezetek) {
      const k = [s.szerkezet ?? s.nev, s.tajolas ?? '', s.Uelemi.toFixed(4), s.U.toFixed(4), s.kovetelmenyKod].join('|');
      const x = m.get(k); if (x) { x.A += s.A; x.db += s.darab ?? 1; } else m.set(k, { s, A: s.A, db: s.darab ?? 1 });
    }
    const sorok = [...m.values()].sort((a, b) => (a.s.tipus === 'nyilaszaro' ? 1 : 0) - (b.s.tipus === 'nyilaszaro' ? 1 : 0) || (a.s.szerkezet ?? a.s.nev).localeCompare(b.s.szerkezet ?? b.s.nev, 'hu', { numeric: true }) || ['É', 'ÉK', 'K', 'DK', 'D', 'DNy', 'Ny', 'ÉNy'].indexOf(a.s.tajolas ?? '') - ['É', 'ÉK', 'K', 'DK', 'D', 'DNy', 'Ny', 'ÉNy'].indexOf(b.s.tajolas ?? ''));
    tartalom.push(tabla(['Szerkezet', 'Tájolás', 'Db', 'A [m²]', 'U rétegt.', 'Umax', 'U eredő', 'Minősítés', ''], sorok.map(({ s, A, db }) => [s.szerkezet ?? s.nev, s.tajolas ?? '–', String(db), f(A, 1), f(s.Uelemi, 3), s.Umax !== null ? f(s.Umax, 3) : '–', Math.abs(s.U - s.Uelemi) > 5e-4 ? f(s.U, 3) : '–', s.minosites ? MIN_NEV[s.minosites] : '–', megfelel(s.megfelel)]), ['*', 30, 22, 38, 42, 40, 38, 40, 50], [2, 3, 4, 5, 6]));
    // ábra: szerkezetenként (típusonként) a legnagyobb rétegtervi U a követelményhez képest
    const uSor = new Map<string, { nev: string; U: number; Umax: number | null }>();
    for (const { s: x } of sorok) { const n = x.szerkezet ?? x.nev; const v = uSor.get(n); if (!v || x.Uelemi > v.U) uSor.set(n, { nev: n, U: x.Uelemi, Umax: x.Umax }); }
    if (uSor.size) {
      tartalom.push({ stack: [{ text: 'Rétegtervi U a megengedett értékhez képest [W/m²K]', bold: true, fontSize: 8.5, margin: [0, 4, 0, 3] }, { svg: uErtekSvg([...uSor.values()]) }], unbreakable: true, margin: [0, 0, 0, 6] } as Content);
    }
  }
  tartalom.push(megj('Az elemi követelményt (1. melléklet) a rétegtervi U-ra ellenőrizzük; az eredő U a csatlakozási hőhidakkal (χ) növelt, talajjal érintkező szerkezetnél az egyenértékű érték – a minősítés (176/2008 4. melléklet) ehhez készül.'));

  // --- Energiamérleg -------------------------------------------------------------------------
  if (z && zr) {
    tartalom.push(cim('Zóna és energiamérleg'));
    const HszellF = zr.havi[0]?.Hszell ?? 0;
    tartalom.push(cim('Zóna alapadatai', 2));
    tartalom.push(adatsor([
      ['Zóna', `${z.nev} – ${p.meta.rendeltetes === 'egyeb' ? `egyéb rendeltetés: ${profilok.profil(p.meta.profil)?.nev ?? ''} (2. függ. 2.1.)` : 'lakóépület'}, θF = ${z.thetaF} °C, θH = ${z.thetaH} °C`],
      ['AN, V', `${f(z.AN)} m², ${f(z.V)} m³`],
      ['Légcsere', `nszüks = ${f(z.nSzuks)} 1/h, nfilt = ${f(z.nfilt)} 1/h${z.gepiSzellozes ? `, gépi szellőzés ηr = ${f(z.gepiSzellozes.etaR * 100, 0)}%` : ''}: Hszell = ${f(HszellF, 1)} W/K (6.10${z.gepiSzellozes ? ', 6.13–6.16' : ''})`],
      ['Belső hőnyereség', `qb = ${f(z.qb, 1)} W/m² (6.26)`],
      ['Effektív hőtároló képesség', `Cm,eff = ${f(zr.CmEff, 0)} kJ/K (${f(zr.CmEff / z.AN, 0)} kJ/m²K), τ = ${f(zr.havi[0]?.tau, 1)} h, a = ${f(zr.havi[0]?.a, 2)} (6.34, 6.39)`],
    ], 150));

    // Szoláris nyereség nyílászárónként (6.27–6.28)
    const ablakok = z.elemek.filter((x): x is NyilaszaroElem => x.tipus === 'nyilaszaro' && x.hatar.tipus === 'kulso');
    if (ablakok.length) {
      tartalom.push(cim('Passzív szoláris nyereség nyílászárónként', 2));
      const futesHo = zr.havi.map((h) => h.QFnet > 0);
      let sF = 0, sE = 0;
      const egy = new Map<string, { el: NyilaszaroElem; db: number; Au: number; QF: number; QE: number }>();
      for (const el of ablakok) {
        const Au = el.Au ?? el.A * (1 - (el.keretarany ?? 0.3));
        let QF = 0, QE = 0;
        for (let i = 0; i < 12; i++) {
          const q = Au * epuletfizika.F_UVEGEZES_BEESESI * el.gn * (el.Farny?.[i] ?? 1) * klima.sugarzasiHozam(el.tajolas, el.hajlasszog, i);
          QE += q; if (futesHo[i]) QF += q;
        }
        const k = [el.szerkezet ?? el.nev, el.tajolas ?? '', el.hajlasszog, el.gn, JSON.stringify(el.Farny ?? null)].join('|');
        const x = egy.get(k);
        if (x) { x.db += el.darab ?? 1; x.Au += Au; x.QF += QF; x.QE += QE; } else egy.set(k, { el, db: el.darab ?? 1, Au, QF, QE });
      }
      const TAJ2 = ['É', 'ÉK', 'K', 'DK', 'D', 'DNy', 'Ny', 'ÉNy'];
      const sorok = [...egy.values()].sort((a, b) => (a.el.szerkezet ?? a.el.nev).localeCompare(b.el.szerkezet ?? b.el.nev, 'hu', { numeric: true }) || TAJ2.indexOf(a.el.tajolas ?? '') - TAJ2.indexOf(b.el.tajolas ?? '')).map(({ el, db, Au, QF, QE }) => {
        sF += QF; sE += QE;
        const Fatl = el.Farny ? el.Farny.reduce((s2, x) => s2 + x, 0) / 12 : 1;
        return [`${el.szerkezet ?? el.nev} · ${db} db`, el.tajolas ?? 'vízsz.', `${el.hajlasszog}°`, f(Au, 2), f(el.gn), f(Fatl, 2), f(QF, 0), f(QE, 0)];
      });
      tartalom.push(tabla(['Nyílászáró', 'Tájolás', 'Hajlás', 'Aü [m²]', 'g', 'F (átl.)', 'Qsd fűtési [kWh]', 'Qsd éves [kWh]'], [
        ...sorok,
        [{ text: 'Összesen', bold: true }, '', '', '', '', '', { text: f(sF, 0), bold: true, alignment: 'right' }, { text: f(sE, 0), bold: true, alignment: 'right' }],
      ] as TableCell[][], ['*', 40, 34, 40, 28, 36, 60, 56], [3, 4, 5, 6, 7]));
      {
        const TJ = ['É', 'ÉK', 'K', 'DK', 'D', 'DNy', 'Ny', 'ÉNy', 'vízsz.'];
        const tq = new Map<string, number>();
        for (const x of egy.values()) { const t = x.el.tajolas ?? 'vízsz.'; tq.set(t, (tq.get(t) ?? 0) + x.QF); }
        const sorT = TJ.filter((t) => tq.has(t)).map((t) => ({ nev: t === 'vízsz.' ? 'vízszintes' : t, ertek: tq.get(t)!, szin: '#E3A72F' }));
        if (sorT.length > 1) tartalom.push({ stack: [{ text: 'Szoláris nyereség a fűtési hónapokban, tájolásonként [kWh]', bold: true, fontSize: 8.5, margin: [0, 2, 0, 3] }, { svg: savokSvg(sorT, 'kWh') }], unbreakable: true, margin: [0, 0, 0, 6] } as Content);
      }
      tartalom.push(megj(`Qsd = Σ Aü · 0,9 · g · F · Gs (Gs a 2. függ. havi sugárzási hozama a tájolás és hajlásszög szerint). Fűtési hónapok: ${HO.filter((_, i) => futesHo[i]).join(', ')}. A hasznosított nyereség (Σ η·Qsd) ${f(zr.QsdHasznositott, 0)} kWh/a.`));
    }

    tartalom.push(cim('Havi energiamérleg – fűtés (6.7–6.40 képlet)', 2));
    tartalom.push({ stack: [{ svg: haviMerlegSvg(zr.havi) }], unbreakable: true, margin: [0, 0, 0, 6] } as Content);
    tartalom.push(tabla(['Hónap', 'θe [°C]', 'Qtr', 'Qszell', 'Qveszt', 'Qsd', 'Qb', 'γ', 'η', 'QF,net'],
      [...zr.havi.map((h, i) => [HO[i]!, f(h.thetaE, 1), f(h.Qtr, 0), f(h.Qszell, 0), f(h.Qveszt, 0), f(h.Qsd, 0), f(h.Qb, 0), f(h.gamma, 2), f(h.eta, 3), f(h.QFnet, 0)]),
        [{ text: 'Év', bold: true }, '', f(zr.havi.reduce((s2, h) => s2 + h.Qtr, 0), 0), f(zr.havi.reduce((s2, h) => s2 + h.Qszell, 0), 0), '', f(zr.havi.reduce((s2, h) => s2 + h.Qsd, 0), 0), f(zr.havi.reduce((s2, h) => s2 + h.Qb, 0), 0), '', '', { text: f(zr.QFnetEv, 0), bold: true, alignment: 'right' }]],
      [30, 32, '*', '*', '*', '*', '*', 28, 32, '*'], [1, 2, 3, 4, 5, 6, 7, 8, 9]));
    tartalom.push(megj(`Energiák kWh-ban. Qveszt = σ·(Qtr + Qszell); γ = (Qsd + Qb)/Qveszt; QF,net = Qveszt − η·(Qsd + Qb). Éves nettó fűtési energiaigény ${f(zr.QFnetEv, 0)} kWh/a = ${f(zr.qFnet, 1)} kWh/m²a.${zr.QHnetEv ? ` Nettó hűtési igény ${f(zr.QHnetEv, 0)} kWh/a.` : ''}`));

    tartalom.push(cim('Fajlagos hőveszteség-tényező (6.53 képlet)', 2));
    const tel = [10, 11, 0, 1, 2];
    let ossz = 0, dt = 0;
    const qSorok = tel.map((i) => {
      const h = zr.havi[i]!;
      const tag = (h.Qtr - h.eta * h.Qsd) / (z.thetaF - h.thetaE);
      ossz += tag; dt += klima.HONAP_ORAK[i]!;
      return [HO[i]!, f(klima.HONAP_ORAK[i]!, 0), f(h.Qtr, 0), f(h.eta, 3), f(h.Qsd, 0), f(z.thetaF - h.thetaE, 1), f(tag, 2)];
    });
    tartalom.push({ stack: [
      tabla(['Hónap', 'Δt [h]', 'Qtr [kWh]', 'η', 'Qsd [kWh]', 'θF − θe [K]', '(Qtr − η·Qsd)/(θF − θe)'], [
        ...qSorok,
        [{ text: 'Σ', bold: true }, f(dt, 0), '', '', '', '', { text: f(ossz, 2), bold: true, alignment: 'right' }],
      ] as TableCell[][], [36, 40, '*', 36, '*', 56, 100], [1, 2, 3, 4, 5, 6]),
      { text: [`q = 1000 / (V · ΣΔt) · Σ = 1000 / (${f(z.V, 1)} · ${f(dt, 0)}) · ${f(ossz, 2)} = `, { text: `${f(zr.q, 3)} W/m³K`, bold: true }, ` · követelmény (A/V = ${f(e.aV, 3)}): ${f(k.qmMax, 3)} W/m³K: `, { text: k.qmMegfelel ? 'megfelel' : 'nem felel meg', bold: true, color: k.qmMegfelel ? SZIN.jo : SZIN.rossz }], margin: [0, 0, 0, 6] },
    ], unbreakable: true });

    tartalom.push(cim('Nyári túlmelegedés kockázata (1. melléklet 2.)', 2));
    const ny = e.nyariHovedelem;
    tartalom.push(adatsor([
      ['Nem északi tájolású üvegezett felület', `${f(ny.erintettFelulet, 2)} m² (tokkülméret szerint), aránya AN-hez ${f(ny.arany * 100, 1)}%`],
      ['Vizsgálati küszöb', `${f(kovetelmeny.NYARI_HOVEDELEM.kuszobArany * 100, 0)}% – ${ny.mutato === null ? 'alatta marad, a mutatót nem kell számítani' : 'meghaladja, a mutató számítandó'}`],
      ...(ny.mutato !== null ? [['Σ(Aü·0,9·g·gárny·F) / ΣAü', { text: [`${f(ny.mutato, 3)} ≤ ${f(kovetelmeny.NYARI_HOVEDELEM.megengedettAtlag, 2)}: `, { text: ny.megfelel ? 'megfelel' : 'nem felel meg', bold: true, color: ny.megfelel ? SZIN.jo : SZIN.rossz }] }] as [string, Content]] : []),
    ], 160));
  }

  // --- Épülettechnikai rendszerek -----------------------------------------------------------
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
    tartalom.push(tabla(['Végenergia tétel', 'Energiahordozó', 'Q [kWh/a]'], r.tetelek.map((t) => [t.megnevezes, ehNev(t.energiahordozo), f(t.Q, 0)]), ['*', 150, 60], [2]));
  });
  const hmvR = e.rendszerek.find((r) => r.cel === 'hmv');
  if (hmvR) {
    tartalom.push(cim('Használati melegvíz', 2));
    tartalom.push(adatsor(reszlet(hmvR, [['QHMVnet', 'Nettó HMV igény [kWh/a]', 0], ['epszilonHMV', 'Teljesítménytényező εHMV', 3], ['QTar', 'Tárolási veszteség [kWh/a]', 0], ['QSzall', 'Elosztási veszteség [kWh/a]', 0], ['Wcirk', 'Cirkuláció segédenergia [kWh/a]', 0]])));
    tartalom.push(tabla(['Végenergia tétel', 'Energiahordozó', 'Q [kWh/a]'], hmvR.tetelek.map((t) => [t.megnevezes, ehNev(t.energiahordozo), f(t.Q, 0)]), ['*', 150, 60], [2]));
  }
  const szR = e.rendszerek.find((r) => r.cel === 'szellozes');
  if (szR) {
    tartalom.push(cim('Gépi szellőzés', 2));
    tartalom.push(adatsor(reszlet(szR, [['V', 'Friss levegő [m³/h]', 0], ['uzemora', 'Üzemidő [h/a]', 0], ['Wvent', 'Ventilátor villamos energia [kWh/a]', 0]])));
  }
  const hutesR = e.rendszerek.filter((r) => r.cel === 'hutes');
  if (hutesR.length) {
    tartalom.push(cim('Hűtés (11.1–11.3 képlet)', 2));
    tartalom.push(adatsor([['Zóna nettó hűtési igénye (6.8)', `${f(zr?.QHnetEv, 0)} kWh/a (${f((zr?.QHnetEv ?? 0) / g.AN, 1)} kWh/m²a)`]], 150));
    tartalom.push(tabla(['Rendszer', 'QH,net [kWh/a]', 'cH', 'εH,szab', 'SEER', 'εH', 'Végenergia [kWh/a]'], hutesR.map((r) => [
      r.nev, f(r.reszletek.QHnet, 0), f(r.reszletek.cH, 2), f(r.reszletek.eSzab, 3), r.reszletek.SEER ? f(r.reszletek.SEER, 2) : 'passzív', r.reszletek.epsH ? f(r.reszletek.epsH, 3) : '–',
      f(r.tetelek.reduce((s2, t) => s2 + t.Q, 0), 0),
    ]), ['*', 55, 30, 40, 35, 35, 60], [1, 2, 3, 4, 5, 6]));
    tartalom.push(megj('QH,vég = QH,net · cH · εH,szab · εH,száll · εH, ahol εH = 1/SEER és egyszerűsített módszernél εH,száll = 1. Passzív talajhőcserélőnél 1 kWh segédenergia 10 kWh nettó hűtési igényt fedez (11.1.2).'));
  }
  const vilR = e.rendszerek.find((r) => r.cel === 'vilagitas');
  if (vilR) {
    tartalom.push(cim('Beépített világítás (12.1–12.2 képlet)', 2));
    tartalom.push(adatsor(reszlet(vilR, [['P', 'Fajlagos névleges teljesítmény P [W/m²]', 2], ['Fszab', 'Szabályozási tényező Fszab (12.5.)', 3], ['wFajl', 'Fajlagos energiaigény [kWh/m²a]', 2], ['W', 'Éves villamos energia WV [kWh/a]', 0]])));
    tartalom.push(megj('WV = (Ffe · P · Fszab · (tnappal · Fnappal + téjjel) / 1000 + wvész + wstandby) · A; P = MV / (FH · ηvil). Lakóépületnél nem számítható be.'));
  }
  if (e.referenciaEpulet.teljes) {
    tartalom.push(cim('Referenciaépület (5. melléklet)', 2));
    tartalom.push(adatsor([
      ['Határolók', 'azonos geometria; U = 1. melléklet 1.1. elemi követelmény, talajon fekvő padló UT = 0,3, fűtésre g = 0,55, üvegezési arány tájolásonként ≤ 50% (tetőn ≤ 30%)'],
      ['Rendszerek', 'kondenzációs gázkazán 55/45 °C, radiátor, termosztatikus szelep; HMV gázkazán indirekt tárolóval; gépi szellőzésnél 50% hővisszanyerés; hűtésnél 6/12 °C fan-coil, referencia SEER; világítás: nem dimmelhető LED, parabolatükrös lámpatest, kézi kapcsolás'],
      ['Enren,REF / ECO2,REF', `${f(e.referenciaEpulet.EnrenFajl)} kWh/m²a / ${f(e.referenciaEpulet.ECO2Fajl)} kg/m²a`],
    ], 120));
  }
  if (e.napelem.length) {
    tartalom.push(cim('Napelem (exportáltként elszámolva, 14.7)', 2));
    tartalom.push(tabla(['Mező', 'kWp', 'Tájolás / azimut', 'Hajlásszög', 'Módszer', 'Termelés [kWh/a]'], p.gepeszet.napelem.map((n, i) => [
      n.nev, f(n.kWp, 2), n.modszer === 'pvgis' ? `${n.azimut ?? 0}°` : n.tajolas.replace('_', '/'), `${n.hajlasszog}°`,
      n.modszer === 'pvgis' ? 'PVGIS (13.2.2)' : '13.1. táblázat', f(e.napelem[i]?.W, 0),
    ]), ['*', 36, 60, 46, 70, 64], [1, 3, 5]));
    for (const n of p.gepeszet.napelem) {
      const pv = n.modszer === 'pvgis' ? n.pvgis : undefined;
      if (!pv) continue;
      const b = pv.bemenet;
      tartalom.push({ stack: [
        { text: `${n.nev} – PVGIS igazoló adatok`, bold: true, margin: [0, 4, 0, 2] },
        megj(`Hely: ${f(pv.hely.lat, 4)}° É, ${f(pv.hely.lon, 4)}° K${pv.hely.magassag !== null ? `, ${f(pv.hely.magassag, 0)} m` : ''} · adatbázis: ${pv.meteo.sugarzasDb ?? '–'} ${pv.meteo.evTol ?? ''}–${pv.meteo.evIg ?? ''}${pv.meteo.horizont ? ', terepárnyékolással' : ''} · ${f(b.kWp, 2)} kWp, dőlés ${b.hajlasszog}°, azimut ${b.azimut}°, ${b.elhelyezes === 'free' ? 'szabadon álló' : 'épületre szerelt'}, rendszerveszteség ${f(b.veszteseg, 0)}%${pv.ossz.l_total !== null ? `, összes veszteség ${f(pv.ossz.l_total, 1)}%` : ''} · lekérve ${new Date(pv.lekerve).toLocaleDateString('hu-HU')}`),
        tabla(['', ...HO, 'Év'], [
          ['Em [kWh]', ...pv.havi.map((h) => f(h.E_m, 0)), { text: f(pv.ossz.E_y, 0), bold: true, alignment: 'right' }],
          ['H(i)m [kWh/m²]', ...pv.havi.map((h) => f(h.H_m, 0)), f(pv.ossz.H_y, 0)],
        ] as TableCell[][], [52, ...HO.map(() => '*'), 34], Array.from({ length: 13 }, (_, i) => i + 1)),
        megj(`Forrás: PVGIS 5.3 (EU JRC) PVcalc. ${pv.url.startsWith('http') ? pv.url : pv.url}`),
      ], unbreakable: true });
    }
  }

  // --- 5. Indikátorok -------------------------------------------------------------------------
  tartalom.push(cim('Primerenergia és CO₂-kibocsátás'));
  tartalom.push(cim('Felhasználási célonként', 2));
  const CEL: [keyof typeof ind.celonkent, string][] = [['futes', 'Fűtés'], ['hmv', 'Használati melegvíz'], ['szellozes', 'Szellőzés'], ['hutes', 'Hűtés'], ['vilagitas', 'Világítás'], ['export', 'Exportált energia (levonandó)']];
  tartalom.push(tabla(['Cél', 'Enren [kWh/a]', 'Eren [kWh/a]', 'Etot [kWh/a]', 'CO₂ [kg/a]'],
    [...CEL.filter(([c]) => ind.celonkent[c].tot !== 0).map(([c, n]) => [n, f(ind.celonkent[c].nren, 0), f(ind.celonkent[c].ren, 0), f(ind.celonkent[c].tot, 0), f(ind.celonkent[c].CO2, 0)]),
      [{ text: 'Összesen', bold: true }, { text: f(ind.osszes.nren, 0), bold: true, alignment: 'right' }, { text: f(ind.osszes.ren, 0), bold: true, alignment: 'right' }, { text: f(ind.osszes.tot, 0), bold: true, alignment: 'right' }, { text: f(ind.osszes.CO2, 0), bold: true, alignment: 'right' }]],
    ['*', 70, 70, 70, 70], [1, 2, 3, 4]));
  {
    const sorC = CEL.filter(([c]) => c !== 'export' && ind.celonkent[c].tot > 0).map(([c, n]) => ({ nev: n, ertek: ind.celonkent[c].tot / g.AN, resz: [[ind.celonkent[c].nren / g.AN, '#3E6E8E'], [ind.celonkent[c].ren / g.AN, '#6FAF5A']] as [number, string][] }));
    if (sorC.length) {
      tartalom.push({ stack: [{ text: 'Primerenergia felhasználási célonként [kWh/m²a] – nem megújuló (kék) és megújuló (zöld) rész', bold: true, fontSize: 8.5, margin: [0, 2, 0, 3] }, { svg: savokSvg(sorC, 'kWh/m²a', 515, 1) }], unbreakable: true, margin: [0, 0, 0, 6] } as Content);
    }
  }
  tartalom.push(cim('Végenergia energiahordozónként', 2));
  tartalom.push(tabla(['Energiahordozó', 'Végenergia [kWh/a]', 'Fajlagos [kWh/m²a]'], Object.entries(ind.vegenergia).filter(([, Q]) => (Q ?? 0) > 0).map(([eh, Q]) => [ehNev(eh, true), f(Q, 0), f((Q ?? 0) / g.AN, 2)]), ['*', 90, 90], [1, 2]));
  const rf = e.rendszerErtekeles;
  tartalom.push(cim('Rendszerek értékelése a referencia rendszerhez képest (5. melléklet)', 2));
  tartalom.push(tabla(['Rendszer', 'Enren [kWh/a]', 'Referencia [kWh/a]', 'Arány', 'Minősítés'], [
    ...(rf.futes ? [['Fűtés', f(rf.futes.Enren, 0), f(rf.futes.EnrenRef, 0), `${f(rf.futes.szazalek, 0)}%`, MIN_NEV[rf.futes.minosites]]] : []),
    ...(rf.hmv ? [['Használati melegvíz', f(rf.hmv.Enren, 0), f(rf.hmv.EnrenRef, 0), `${f(rf.hmv.szazalek, 0)}%`, MIN_NEV[rf.hmv.minosites]]] : []),
  ], ['*', 70, 80, 45, 60], [1, 2, 3]));

  // --- 6. Hőszükséglet ------------------------------------------------------------------------
  try {
    const hb = hoszuksegletBemenet(p);
    if (hb.bemenet.helyisegek.some((h) => h.elemek.length)) {
      const hr = H.helyisegHoszukseglet(hb.bemenet);
      tartalom.push(cim('Helyiségenkénti tervezési hőszükséglet (MSZ EN 12831 szerkezetű számítás)'));
      tartalom.push({ text: `θe = ${f(hb.bemenet.thetaE, 0)} °C · n50 = ${f(hb.bemenet.n50, 1)} 1/h · ${H.HSZ_FORRAS}. Nem része a 9/2023 ÉKM szerinti energetikai számításnak.`, fontSize: 7.5, color: SZIN.halk, margin: [0, 0, 0, 6] });
      // a helyiségenkénti lista csak kifejezett kérésre (nagy épületnél több oldal); alapból csak az összesítés
      if (!opt.helyisegLista) tartalom.push(adatsor([['Helyiségek', `${hr.helyisegek.length} db`], ['ΦT / ΦV / ΦRH', `${f(hr.PhiT, 0)} / ${f(hr.PhiV, 0)} / ${f(hr.PhiRH, 0)} W`], ['Összes hőszükséglet ΦHL', `${f(hr.osszesen / 1000, 2)} kW`]], 150));
      else tartalom.push(tabla(['Helyiség', 'A [m²]', 'θint [°C]', 'ΦT [W]', 'ΦV [W]', 'ΦRH [W]', 'ΦHL [W]', 'W/m²'],
        [...hr.helyisegek.map((h) => [h.nev, f(h.A, 1), f(h.thetaInt, 0), f(h.PhiT, 0), f(h.PhiV, 0), f(h.PhiRH, 0), f(h.PhiHL, 0), f(h.fajlagos, 0)]),
          [{ text: 'Összesen', bold: true }, '', '', f(hr.PhiT, 0), f(hr.PhiV, 0), f(hr.PhiRH, 0), { text: f(hr.osszesen, 0), bold: true, alignment: 'right' }, '']],
        ['*', 40, 42, 45, 45, 45, 50, 35], [1, 2, 3, 4, 5, 6, 7]));
    }
  } catch { /* hiányos hőszükséglet-adatok: kimarad */ }

  // --- Alternatív rendszerek ----------------------------------------------------------------
  if (p.alternativ) {
    const av = alternativVizsgalat(p, p.alternativ);
    if (av.ref) {
      tartalom.push(cim('Alternatív rendszerek vizsgálata (9/2023 ÉKM 5. §, 4. melléklet)'));
      tartalom.push(megj(`Viszonyítás (2.9): az azonos geometriájú és határolású épület a referencia épülettechnikai rendszerrel: ${f(av.ref.EnrenFajl, 1)} kWh/m²a. Gazdaságossági feltétel (3.6): egyszerű megtérülés ≤ 10 év. Üzemköltség: éves energiaköltség-különbség a referencia rendszerhez.`));
      tartalom.push(tabla(['Alternatív rendszer', 'Ep [kWh/m²a]', 'Műszaki-körny.', 'Ber. többlet [Ft]', 'Üzemk.-csökk. [Ft/év]', 'Megtérülés', 'Gazdaságos'],
        av.valtozatok.map((x) => [ALT_NEV[x.kod], x.EnrenFajl === null ? '–' : f(x.EnrenFajl, 1), x.muszakiAlkalmas === null ? '–' : x.muszakiAlkalmas ? 'igen' : 'nem',
          x.muszakiAlkalmas ? f(x.beruhazasKulonbseg, 0) : '–', x.muszakiAlkalmas && x.uzemKulonbseg !== null ? f(x.uzemKulonbseg, 0) : '–',
          x.muszakiAlkalmas ? (x.megterules === null ? 'nem térül meg' : `${f(x.megterules, 1)} év`) : '–', x.gazdasagos === null ? '–' : x.gazdasagos ? 'igen' : 'nem']),
        ['*', 48, 48, 60, 64, 52, 46], [1, 3, 4, 5]));
      for (const x of av.valtozatok) {
        const a0 = p.alternativ.valtozatok[x.kod];
        const sorok = URLAP[x.kod].map((u) => [u.kod, `${u.nev}${u.egyseg ? ` [${u.egyseg}]` : ''}`, u.tipus === 'szamolt' ? x.szamolt[u.kod] ?? '–' : u.tipus === 'in' ? ({ I: 'igen', N: 'nem' } as Record<string, string>)[a0?.valaszok[u.kod] ?? ''] ?? '–' : a0?.valaszok[u.kod] || '–']);
        if (x.muszakiAlkalmas) sorok.push(['f.1', 'Nem megújuló primerenergia-igény alternatív ellátással [kWh/m²a]', f(x.EnrenFajl, 1)], ['f.2', 'Ugyanez referencia rendszerrel [kWh/m²a]', f(av.ref.EnrenFajl, 1)],
          ['g.1', 'Beruházási költség (nettó) [Ft]', f(x.beruhazas, 0)], ['g.3', 'Különbség a referenciához [Ft]', f(x.beruhazasKulonbseg, 0)], ['g.4', 'Üzemeltetési költségkülönbség [Ft/év]', x.uzemKulonbseg === null ? '–' : f(x.uzemKulonbseg, 0)],
          ['g.5', 'Egyszerű megtérülési idő [év]', x.megterules === null ? 'nem térül meg' : f(x.megterules, 1)], ['g.6', 'Gazdaságossági szempontból célszerű', x.gazdasagos ? 'igen' : 'nem']);
        tartalom.push({ stack: [
          { text: ALT_NEV[x.kod], bold: true, margin: [0, 4, 0, 2] },
          tabla(['Sor', 'Megnevezés', 'Érték'], sorok, [26, '*', 120], []),
          ...(a0?.megjegyzes || x.hiba ? [megj([a0?.megjegyzes ?? '', x.hiba ? ` ${x.hiba}` : ''].join(''))] : []),
        ], unbreakable: true });
      }
    }
  }

  // --- Hőhidak (MSZ EN ISO 10211) -------------------------------------------------------------
  const hidak = (p.hohidak ?? []).filter((h) => h.eredmeny);
  if (hidak.length) {
    tartalom.push(cim('Hőhidak – kétdimenziós számítás (MSZ EN ISO 10211)'));
    tartalom.push({ text: p.hohidMod === 'psi' ? 'A számítás a hőhidakat részletesen, vonalmenti Ψ · l taggal veszi figyelembe (a felületek χ korrekciója nélkül).' : 'A számítás a hőhidakat az egyszerűsített χ módszerrel veszi figyelembe; az alábbi Ψ értékek tájékoztató, ellenőrző számítások.', fontSize: 7.5, color: SZIN.halk, margin: [0, 0, 0, 4] });
    const { hohidTartalom } = await import('./hohid/pdf');
    for (const h of hidak) tartalom.push(...hohidTartalom(h, (t) => cim(t, 2)));
  }

  // --- 7. Megjegyzések ------------------------------------------------------------------------
  const fw = [...new Map(e.figyelmeztetesek.map((x) => [x.kod + x.uzenet, x])).values()];
  if (fw.length) {
    tartalom.push(cim('Megjegyzések, alkalmazott értelmezések'));
    tartalom.push({ ul: fw.map((x) => ({ text: [x.uzenet, { text: ` (${x.forras})`, color: SZIN.halkabb }] })), fontSize: 7.5, color: SZIN.halk });
  }

  // --- Fotódokumentáció ----------------------------------------------------------------------
  if (fotok.length) {
    const fotoCim = cim('Fotódokumentáció');
    for (let i = 0; i < fotok.length; i += 2) {
      const sor: Content = {
        columns: fotok.slice(i, i + 2).map((x) => ({
          width: 250,
          stack: [
            { image: x.dataUrl, fit: [250, 180] },
            { text: [FOTO_KATEGORIAK.find((c) => c.ertek === x.kategoria)?.nev ?? '', x.megjegyzes ? { text: ` – ${x.megjegyzes}`, color: SZIN.halk } : ''], fontSize: 7.5, margin: [0, 3, 0, 0] },
          ],
        })) as Content[],
        columnGap: 15, margin: [0, 0, 0, 10],
      } as Content;
      // A fejezetcím az első képsorral együtt marad.
      tartalom.push(i === 0 ? { stack: [fotoCim, sor], unbreakable: true } : { stack: [sor], unbreakable: true });
    }
  }

  const dd: TDocumentDefinitions = {
    pageSize: 'A4', pageMargins: [40, 46, 40, 42],
    info: { title: `Energetikai számítás – ${m.nev}`, author: p.tanusito.nev || undefined, creator: SZOFTVER, subject: 'Energetikai számítás' },
    header: (oldal) => (oldal === 1 ? null : { columns: [{ text: m.nev, color: SZIN.halkabb }, { text: cimSzoveg, color: SZIN.halkabb, alignment: 'right' }], fontSize: 7, margin: [40, 24, 40, 0] }),
    footer: (oldal, osszes) => ({ columns: [{ text: `${SZOFTVER} · ${MODSZER}`, color: SZIN.halkabb }, { text: `${oldal} / ${osszes}`, alignment: 'right', color: SZIN.halkabb, width: 40 }], fontSize: 6.5, margin: [40, 16, 40, 0] }),
    content: tartalom,
    // Cím ne maradjon egyedül a lap alján: az oldal alsó 14%-ában kezdődő cím új oldalra kerül.
    pageBreakBefore: (n) => n.headlineLevel === 1 && (n.startPosition?.verticalRatio ?? 0) > 0.86,
    styles: {
      cim: { fontSize: 16, bold: true, color: SZIN.tus },
      h1: { fontSize: 11.5, bold: true, color: SZIN.tus },
      h2: { fontSize: 9.5, bold: true, color: SZIN.tus },
    },
    defaultStyle: { font: 'Roboto', fontSize: 8, color: SZIN.tus, lineHeight: 1.12 },
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
