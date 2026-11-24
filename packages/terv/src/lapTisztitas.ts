/**
 * LAPTISZTÍTÁS – a felismerés előtti lépés (2026-11-24, Balázs: „Beolvasáskor különítsd el: lapkeret, tervpecsét,
 * északjel, járda burkolatok, külső méretvonalak, növényzet, egyéb külső vonalak – ezeket ki kell venni a felismerésből,
 * mert zavart okoznak, tehát még előtte lépésként”).
 *
 * Az alaprajzi lap elemeit osztályokba sorolja; a felismerés (fal, helyiség, burok) csak az épület osztályt kapja, a
 * lapképen a többi helye kitakarva. Az épület helyét a tervező saját jelei adják: a külső méretláncok – a ház körül
 * futó láncok szélső jelei közti téglalap (az „épületdoboz”), a helyiségpecsétekkel bővítve. Ezen kívül:
 *   - méretvonal: a lánc vonala, határjelei (vonalka, pont), a méretsegédvonalak és a méretszámok;
 *   - növényzet: görbe (Bézier) útvonal – fa, bokor, cserje, sövény;
 *   - burkolat: kitöltés, mintás felület, sűrű párhuzamos vonalcsalád (járda, térkő, terasz burkolata);
 *   - külső: minden más vonal és felirat a dobozon kívül (telekhatár, kerítés, közmű, utcanév, jelmagyarázat).
 * A lapkeret, a rajzpecsét és az északjel mindenhol (a dobozon belül is) kimarad.
 */
import type { Lap } from './kinyeres';
import { rajzpecsetTeglalap, keretE } from './rajzpecset';
import { eszakjelKeres } from './alaprajz';
import { meretlancok } from './meretlanc';

export type LapOsztaly = 'epulet' | 'keret' | 'pecset' | 'eszakjel' | 'meretvonal' | 'novenyzet' | 'burkolat' | 'kulso';
export type Doboz = [number, number, number, number];

export interface LapTisztitas {
  /** útvonalanként (lap.utvonalak indexe) az osztály */
  utvonal: LapOsztaly[];
  /** feliratonként (lap.szovegek indexe) */
  szoveg: LapOsztaly[];
  /** az épület dobozai (pt) – null: nincs elég külső lánc, a dobozon kívüli rész nem különíthető el */
  doboz: Doboz | null;
  pecset: Doboz | null;
  eszakjel: Doboz | null;
}

const atfed = (a: Doboz, b: Doboz) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
const benne = (a: Doboz, b: Doboz) => a[0] >= b[0] && a[2] <= b[2] && a[1] >= b[1] && a[3] <= b[3];

/**
 * Az épületdoboz a méretláncokból: a vízszintes láncok közül a leghosszabbnak legalább 40 %-át elérők szélső jelei adják az
 * x-, a függőlegeseké az y-kiterjedést; a doboz a helyiségpecsétekre (pecsetPontok) 1 m-rel bővül. Null, ha nincs mindkét
 * irányban lánc.
 */
export function epuletDoboz(lap: Lap, mPt: number, pecsetPontok: [number, number][] = []): Doboz | null {
  const L = meretlancok(lap, mPt).map((l) => ({ fg: l.fuggo, c: l.c, a: l.jelek[0]!, b: l.jelek[l.jelek.length - 1]! })).filter((l) => (l.b - l.a) * mPt >= 2);
  const v = L.filter((l) => !l.fg), f = L.filter((l) => l.fg);
  if (!v.length || !f.length) return null;
  const vMax = Math.max(...v.map((l) => l.b - l.a)), fMax = Math.max(...f.map((l) => l.b - l.a));
  const vh = v.filter((l) => l.b - l.a >= 0.4 * vMax), fh = f.filter((l) => l.b - l.a >= 0.4 * fMax);
  let d: Doboz = [Math.min(...vh.map((l) => l.a)), Math.min(...fh.map((l) => l.a)), Math.max(...vh.map((l) => l.b)), Math.max(...fh.map((l) => l.b))];
  // (a láncok vonala a házon kívül fut: ha egy hosszú vízszintes lánc a dobozon belül esik, az belső lánc – nem baj)
  const m1 = 1 / mPt;
  for (const [x, y] of pecsetPontok) d = [Math.min(d[0], x - m1), Math.min(d[1], y - m1), Math.max(d[2], x + m1), Math.max(d[3], y + m1)];
  if ((d[2] - d[0]) * mPt < 3 || (d[3] - d[1]) * mPt < 3) return null;
  return d;
}

/**
 * A lap elemeinek osztályozása. mPt: a lap léptéke (m/pt); pecsetPontok: a helyiségpecsétek helye (pt) – a dobozt
 * bővítik. A doboz körüli tűrés 0,5 m (vakolat, hőszigetelés, párkány, lábazat).
 */
export function lapOsztalyozas(lap: Lap, mPt: number, pecsetPontok: [number, number][] = []): LapTisztitas {
  const W = lap.szel, H = lap.mag;
  const pr = rajzpecsetTeglalap(lap);
  const utvonal: LapOsztaly[] = lap.utvonalak.map(() => 'epulet');
  const szoveg: LapOsztaly[] = lap.szovegek.map(() => 'epulet');
  // 1) lapkeret, rajzpecsét
  lap.utvonalak.forEach((u, i) => { if (keretE(u.bbox, W, H)) utvonal[i] = 'keret'; else if (pr && benne(u.bbox, pr)) utvonal[i] = 'pecset'; });
  lap.szovegek.forEach((t, i) => { if (pr && t.x >= pr[0] && t.x <= pr[2] && t.y >= pr[1] && t.y <= pr[3]) szoveg[i] = 'pecset'; });
  // 2) épületdoboz
  const d0 = epuletDoboz(lap, mPt, pecsetPontok);
  const tur = 0.5 / mPt;
  const doboz: Doboz | null = d0 ? [d0[0] - tur, d0[1] - tur, d0[2] + tur, d0[3] + tur] : null;
  // 3) északjel (a dobozon kívül; a pecsétben lévőt a pecsét viszi)
  let eszak: Doboz | null = null;
  const ej = eszakjelKeres(lap, pr ? [pr] : []);
  if (ej) {
    const r = Math.max(ej.meret, 20); const e: Doboz = [ej.x - r, ej.y - r, ej.x + r, ej.y + r];
    if (!doboz || !atfed(e, doboz)) {
      eszak = e;
      lap.utvonalak.forEach((u, i) => { if (utvonal[i] === 'epulet' && benne(u.bbox, e)) utvonal[i] = 'eszakjel'; });
      lap.szovegek.forEach((t, i) => { if (szoveg[i] === 'epulet' && t.x >= e[0] && t.x <= e[2] && t.y >= e[1] && t.y <= e[3]) szoveg[i] = 'eszakjel'; });
    }
  }
  // 4) méretvonalak: a lánc vonala (a lánc mentén, rajta fekvő szakaszok), határjelei, a méretsegédvonalak (a jeleknél
  // a láncra merőleges szakaszok, a lánc és az épületdoboz között) és a méretszámok
  const lancok = meretlancok(lap, mPt);
  const lancSzakasz = (u: (typeof lap.utvonalak)[number]): boolean => {
    for (const l of lancok) {
      const a = l.jelek[0]! - 2, b = l.jelek[l.jelek.length - 1]! + 2;
      const [x0, y0, x1, y1] = u.bbox;
      const [m0, m1, k0, k1] = l.fuggo ? [y0, y1, x0, x1] : [x0, x1, y0, y1];
      if (m0 < a - 1 || m1 > b + 1) continue;
      // a lánc vonala: vékony, a lánc vonalán fekszik (± 0,8 pt); határjele: rövid (≤ 4 pt hosszában, ≤ 8 pt keresztben),
      // a vonalat keresztezi – a vonallal egybeeső falél (kitöltés, vastag) nem
      if (u.muvelet === 'fill') continue;
      if (k1 - k0 <= 1.2 && Math.abs((k0 + k1) / 2 - l.c) <= 0.8) return true;
      if (m1 - m0 <= 4 && k1 - k0 <= 8 && k0 <= l.c + 0.5 && k1 >= l.c - 0.5) return true;
      // méretsegédvonal: keresztben hosszú, hosszában pontszerű, egy jel helyén, a lánc vonalától indul
      if (m1 - m0 <= 1 && l.jelek.some((j) => Math.abs(j - (m0 + m1) / 2) <= 1) && (Math.abs(k0 - l.c) <= 6 || Math.abs(k1 - l.c) <= 6)) {
        // (a dobozba nem ér be mélyen – a falsíkig fut)
        if (!doboz) return true;
        const kb = l.fuggo ? [doboz[0], doboz[2]] : [doboz[1], doboz[3]];
        if (k1 <= kb[0]! + 2 / mPt * 0.5 || k0 >= kb[1]! - 2 / mPt * 0.5) return true;
      }
    }
    return false;
  };
  lap.utvonalak.forEach((u, i) => { if (utvonal[i] === 'epulet' && lancSzakasz(u)) utvonal[i] = 'meretvonal'; });
  // a méretszámok: a lánc vonalától legfeljebb 2 betűmagasságra, a lánc hosszán belül álló szám
  lap.szovegek.forEach((t, i) => {
    if (szoveg[i] !== 'epulet' || !/^\d[\d,.]*$/.test(t.s.trim())) return;
    const h = t.meret || 2; const fg = Math.abs(Math.cos((t.szog * Math.PI) / 180)) < 0.5;
    const cx = t.x + (fg ? 0 : t.szel / 2), cy = t.y - (fg ? t.szel / 2 : 0);
    for (const l of lancok) { if (l.fuggo !== fg) continue; const [menti, ker] = fg ? [cy, cx] : [cx, cy];
      if (menti >= l.jelek[0]! - 2 && menti <= l.jelek[l.jelek.length - 1]! + 2 && Math.abs(ker - l.c) <= 2.2 * h) { szoveg[i] = 'meretvonal'; return; } }
  });
  // 5) a dobozon kívül: növényzet, burkolat, egyéb külső
  if (doboz) {
    const kint = (b: Doboz) => !atfed(b, doboz);
    // sűrű párhuzamos vonalcsalád (burkolat, sraff): a dobozon kívüli egyenes szakaszok irány szerint; egy szakasz a
    // családé, ha legalább 4 vele párhuzamos (± 2°), hasonló hosszú (± 30 %), egymástól ≤ 1,2 m-re lévő társa van
    type Sz = { i: number; a: number; L: number; mx: number; my: number };
    const sz: Sz[] = [];
    lap.utvonalak.forEach((u, i) => {
      if (utvonal[i] !== 'epulet' || !kint(u.bbox) || u.gorbe) return;
      for (const p of u.pontok) for (let k = 0; k + 3 < p.length; k += 2) { const dx = p[k + 2]! - p[k]!, dy = p[k + 3]! - p[k + 1]!; const L = Math.hypot(dx, dy); if (L * mPt < 0.2) continue; sz.push({ i, a: ((Math.atan2(dy, dx) * 180) / Math.PI + 180) % 180, L, mx: (p[k]! + p[k + 2]!) / 2, my: (p[k + 1]! + p[k + 3]!) / 2 }); }
    });
    const csalad = new Set<number>(); const t12 = 1.2 / mPt;
    for (const s of sz) {
      let n = 0;
      for (const q of sz) { if (q === s || q.i === s.i && q.mx === s.mx) continue; const da = Math.abs(q.a - s.a); if (Math.min(da, 180 - da) > 2 || Math.abs(q.L - s.L) > 0.3 * s.L || Math.hypot(q.mx - s.mx, q.my - s.my) > t12 + s.L / 2) continue; if (++n >= 4) break; }
      if (n >= 4) csalad.add(s.i);
    }
    lap.utvonalak.forEach((u, i) => {
      if (utvonal[i] !== 'epulet' || !kint(u.bbox)) return;
      utvonal[i] = u.gorbe ? 'novenyzet' : u.muvelet === 'fill' || u.minta || csalad.has(i) ? 'burkolat' : 'kulso';
    });
    lap.szovegek.forEach((t, i) => { if (szoveg[i] === 'epulet' && (t.x > doboz[2] || t.x + t.szel < doboz[0] || t.y > doboz[3] + (t.meret || 2) || t.y < doboz[1])) szoveg[i] = 'kulso'; });
  }
  return { utvonal, szoveg, doboz, pecset: pr, eszakjel: eszak };
}

/**
 * A lap a felismeréshez: a lapkeret, a pecsét, az északjel, a dobozon kívüli növényzet, burkolat és külső vonalak
 * nélkül. A méretláncok maradnak – a nyílások szélét, a falvastagságot a felismerés a láncokból is olvassa (a lapképen a
 * dobozon kívüli láncok így is kitakarva). A feliratok – az északjel betűje kivételével – maradnak: a pecsét
 * méretaránya, a helyiségjegyzék, a lakásjelek a dobozon kívül is adatot hordoznak (a vonalakkal ellentétben nem
 * zavarják a fal- és helyiségfelismerést).
 */
export function tisztaLap(lap: Lap, t: LapTisztitas, _mPt?: number): Lap {
  return { ...lap,
    utvonalak: lap.utvonalak.filter((_, i) => t.utvonal[i] === 'epulet' || t.utvonal[i] === 'meretvonal'),
    szovegek: lap.szovegek.filter((_, i) => t.szoveg[i] !== 'eszakjel') };
}
