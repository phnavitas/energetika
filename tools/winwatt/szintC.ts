/**
 * WinWatt-összevetés – C szint: a gépészeti táblázati értékek (8.–9. fejezet) a rendszer-alapterület szerint,
 * a WinWatt által kiírt rendszerleírás alapján. Futtatás: npx tsx tools/winwatt/szintC.ts
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as T from '../../packages/mag/src/tablak/gepeszet.js';
import { interpolal } from '../../packages/mag/src/interpolacio.js';

const DIR = join(import.meta.dirname, 'minta');
type Oszl = { A: readonly number[] } & Record<string, unknown>;
const ip = (t: Oszl, k: string, A: number) => interpolal({ forras: k, x: t.A as number[], y: t[k] as (number | null)[] } as never, A);
const hofok = (sorok: Record<string, number>, e: number, v: number) => {
  const p = T.HOFOKLEPCSOK.map((h) => { const [a, b] = h.split('/').map(Number) as [number, number]; return { d: T.kozepesHomersekletKulonbseg(a, b), y: sorok[h]! }; }).sort((a, b) => a.d - b.d);
  return interpolal({ forras: 'hőfok', x: p.map((x) => x.d), y: p.map((x) => x.y) }, T.kozepesHomersekletKulonbseg(e, v));
};

for (const f of readdirSync(DIR).filter((x) => x.endsWith('.json')).sort()) {
  const ww = JSON.parse(readFileSync(join(DIR, f), 'utf8'));
  const sorok: string[] = [];
  for (const r of ww.rendszerek as { rendszer: string; alnev?: string; ertekek: Record<string, number[]>; szoveg: string[] }[]) {
    const AN = r.ertekek.AN?.[0]; if (!AN) continue;
    const sz = r.szoveg.join('\n');
    const cmp = (nev: string, wwv: number | undefined, mi: number | null, tur = 0.015) => {
      if (wwv === undefined || mi === null) return;
      const jo = Math.abs(mi - wwv) <= Math.max(tur, Math.abs(wwv) * 0.02);
      sorok.push(`  ${jo ? ' ' : '←'} ${r.rendszer}${r.alnev ? ' ' + r.alnev : ''} · ${nev}: WW ${wwv}  mi ${mi.toFixed(3)}  (A ${AN})`);
    };
    if (r.rendszer === 'Fűtési rendszer') {
      const m = /Elosztó vezetékek a fűtött téren (belül|kívül), vízhőmérséklet (\d+)\/(\d+)/.exec(sz);
      if (m) {
        const t = (m[1] === 'belül' ? T.ELOSZTAS_BELUL : T.ELOSZTAS_KIVUL) as unknown as Oszl;
        const s = Object.fromEntries(T.HOFOKLEPCSOK.map((h) => [h, ip(t, h, AN)]));
        cmp(`qF,száll (${m[1]} ${m[2]}/${m[3]})`, r.ertekek['qF,száll']?.[0], hofok(s, +m[2]!, +m[3]!));
      }
      const sv = /EEI=0,(17|23)/.exec(sz) ? `epm_EEI_0${/EEI=0,(17|23)/.exec(sz)![1]}`
        : /Fordulatszám szabályozású szivattyú, hőlépcső (\d+) K/.exec(sz) ? (() => { const k = /hőlépcső (\d+) K/.exec(sz)![1]; return k === '7' ? 'fordulatszam_beagyazott_7K' : `fordulatszam_szabad_${k}K`; })()
        : /Állandó fordulatszámú szivattyú, hőlépcső (\d+) K/.exec(sz) ? (() => { const k = /hőlépcső (\d+) K/.exec(sz)![1]; return k === '7' ? 'allando_beagyazott_7K' : `allando_szabad_${k}K`; })() : null;
      if (sv) cmp(`wF,sziv (${sv})`, r.ertekek['wF,sziv']?.[0], ip(T.FUTES_SZIVATTYU as unknown as Oszl, sv, AN));
      const tm = /Elhelyezés a fűtött téren (belül|kívül), vízhőmérséklet (\d+)\/(\d+)/.exec(sz);
      if (tm) {
        const t = T.FUTES_TAROLO as unknown as Oszl; const hely = tm[1] === 'belül' ? 'belul' : 'kivul';
        const y55 = ip(t, `${hely}_55_45`, AN), y35 = ip(t, `${hely}_35_28`, AN);
        const d55 = T.kozepesHomersekletKulonbseg(55, 45), d35 = T.kozepesHomersekletKulonbseg(35, 28), d = T.kozepesHomersekletKulonbseg(+tm[2]!, +tm[3]!);
        cmp(`qF,tár (${tm[1]} ${tm[2]}/${tm[3]})`, r.ertekek['qF,tár']?.[0], y35 + ((y55 - y35) * (d - d35)) / (d55 - d35));
        cmp('wF,tár', r.ertekek['wF,tár']?.[0], ip(t, 'segedenergia', AN));
      }
      // 8.2: QF,vég = (QF,net·εszab + (qszáll + qtár)·AN)·εF → a kiírt (kerekített) εF-fel
      const e = r.ertekek; const Qn = e['QF,net,FR']?.[0], es = e['εF,szab']?.[0], eF = e['εF']?.[0], Qv = e['QF,vég']?.[0];
      if (Qn !== undefined && es !== undefined && eF !== undefined && Qv) {
        const be = Qn * es + ((e['qF,száll']?.[0] ?? 0) + (e['qF,tár']?.[0] ?? 0)) * AN;
        sorok.push(`    ${r.rendszer}${r.alnev ? ' ' + r.alnev : ''} · 8.2: leadott ${be.toFixed(0)} kWh → εF = ${(Qv / be).toFixed(4)} (kiírva ${eF})`);
        const szab = [0, 1, 2, 3, 4].map((i) => e[`εF,szab,${i}`]?.[0]);
        if (szab.every((x) => x !== undefined)) cmp('εF,szab = Σ tagok', es, szab.reduce((a, x) => a! + x!, 0)!, 0.0015);
      }
    }
    if (r.rendszer === 'Melegvíz-termelő rendszer') {
      const m = /Elosztó vezetékek a fűtött téren (belül|kívül), (cirkulációval|cirkuláció nélkül)/.exec(sz);
      if (m) cmp(`qHMV,v (${m[1]}, ${m[2]})`, r.ertekek['qHMV,v']?.[0], ip(T.HMV_ELOSZTAS as unknown as Oszl, `${m[2] === 'cirkulációval' ? 'cirk' : 'nincs_cirk'}_${m[1] === 'belül' ? 'belul' : 'kivul'}`, AN), 0.15);
      const c = /cirkulációval EEI=0\.(17|23)/.exec(sz);
      if (c) cmp(`wHMV,száll (EEI 0,${c[1]})`, r.ertekek['wHMV,száll']?.[0], ip(T.HMV_CIRK_SZIVATTYU as unknown as Oszl, `EEI_0${c[1]}`, AN));
      const t = /Elhelyezés a fűtött tér(?:ben|en kívül), indirekt fűtésű tároló/.exec(sz);
      if (t) {
        const bel = /fűtött térben/.test(t[0]); const tt = T.HMV_TAROLO;
        const mi = interpolal({ forras: 'HMV tároló', x: (bel ? tt.A_belul : tt.A_kivul) as unknown as number[], y: (bel ? tt.belul.indirekt : tt.kivul.indirekt) as unknown as number[] }, AN);
        cmp(`qHMV,t (indirekt, ${bel ? 'belül' : 'kívül'})`, r.ertekek['qHMV,t']?.[0], mi, 0.15);
      }
    }
  }
  console.log(`=== ${f}\n${sorok.join('\n')}`);
}
