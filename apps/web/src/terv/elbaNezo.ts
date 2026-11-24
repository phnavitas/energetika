/**
 * Kész lapnézet az ELBA-nak: a tervlap képe a modellelemek alakjával – kattintásra az elem kijelölése (a 3D-nézet és a
 * lista felé `onKijeloles`), kívülről `kijelol(id)`-vel a rajzon kiemelés (és a lapra ugrás). Keret nélküli DOM + SVG,
 * függőség nélkül; görgővel nagyít, húzással mozgat, dupla kattintásra visszaáll.
 */
import { elemekPontban, type ElemAlak } from '@terv/forrasAlak';

export interface LapNezoBemenet {
  elemAlakok: ElemAlak[];
  lapKepek: { kep: string; kepSzel: number; kepMag: number; szel: number; mag: number }[];
  lapok: { fajl: string; oldal: number; cim: string; szerep: string }[];
}

export interface LapNezo {
  /** A megjelenített lap (lapindex). */
  lapra(lap: number): void;
  /** Elem kiemelése a rajzon (és a lapjára ugrás); null: kijelölés törlése. */
  kijelol(id: string | null): void;
  megszuntet(): void;
}

const SZIN: Record<ElemAlak['tipus'], string> = { fal: '#DC2626', nyilas: '#2563EB', ter: '#16A34A', fodem: '#6B7280', piller: '#C026D3', gerenda: '#EA580C' };
const NEV: Record<ElemAlak['tipus'], string> = { fal: 'fal', nyilas: 'nyílászáró', ter: 'helyiség', fodem: 'födém', piller: 'pillér', gerenda: 'gerenda' };

export function lapNezo(hely: HTMLElement, e: LapNezoBemenet, opc: { lap?: number; onKijeloles?: (id: string | null, alak?: ElemAlak) => void; mutat?: ElemAlak['tipus'][] } = {}): LapNezo {
  const NS = 'http://www.w3.org/2000/svg';
  const mutat = new Set(opc.mutat ?? ['fal', 'nyilas', 'ter', 'piller', 'gerenda']);
  const lapok = [...new Set(e.elemAlakok.map((a) => a.lap))].sort((a, b) => a - b);
  let lap = opc.lap ?? lapok[0] ?? 0, kiv: string | null = null;
  const gyoker = document.createElement('div');
  gyoker.style.cssText = 'position:relative;width:100%;height:100%;min-height:300px;overflow:hidden;background:#fff;font:13px system-ui,sans-serif;touch-action:none';
  const sav = document.createElement('div');
  sav.style.cssText = 'position:absolute;left:8px;top:8px;z-index:2;display:flex;gap:6px;align-items:center;background:rgba(255,255,255,.92);border:1px solid #d1d5db;border-radius:6px;padding:4px 6px';
  const valaszto = document.createElement('select');
  for (const i of lapok) { const o = document.createElement('option'); o.value = String(i); const l = e.lapok[i]; o.textContent = l ? `${l.cim || l.fajl}${l.oldal > 1 ? ` (${l.oldal}. old.)` : ''}` : `${i + 1}. lap`; valaszto.append(o); }
  valaszto.onchange = () => { lap = Number(valaszto.value); rajzol(true); };
  const cimke = document.createElement('span'); cimke.style.color = '#374151';
  sav.append(valaszto, cimke);
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%'); svg.style.cssText = 'display:block;cursor:grab';
  gyoker.append(sav, svg); hely.append(gyoker);
  let vb = [0, 0, 1, 1];
  const vbAllit = () => svg.setAttribute('viewBox', vb.join(' '));
  const alap = () => { const k = e.lapKepek[lap]; if (!k) return; const r = gyoker.getBoundingClientRect(); const ar = r.width && r.height ? r.width / r.height : k.szel / k.mag; const w = Math.max(k.szel, k.mag * ar), h = w / ar; vb = [(k.szel - w) / 2, (k.mag - h) / 2, w, h]; vbAllit(); };
  const rajzol = (ujLap = false) => {
    if (ujLap) sajat = false;
    svg.replaceChildren(); const k = e.lapKepek[lap]; if (!k) return;
    valaszto.value = String(lap);
    const img = document.createElementNS(NS, 'image'); img.setAttribute('href', k.kep); img.setAttribute('x', '0'); img.setAttribute('y', '0'); img.setAttribute('width', String(k.szel)); img.setAttribute('height', String(k.mag)); svg.append(img);
    for (const a of e.elemAlakok) {
      if (a.lap !== lap || (!mutat.has(a.tipus) && a.id !== kiv)) continue;
      const ki = a.id === kiv;
      for (const p of a.poligonok) {
        const pg = document.createElementNS(NS, 'polygon'); pg.setAttribute('points', p.map((q) => q.join(',')).join(' '));
        pg.setAttribute('fill', ki ? 'rgba(249,115,22,.35)' : a.tipus === 'ter' ? 'rgba(22,163,74,.06)' : SZIN[a.tipus] + '22');
        pg.setAttribute('stroke', ki ? '#F97316' : SZIN[a.tipus]); pg.setAttribute('stroke-width', ki ? '3' : '0.8'); pg.setAttribute('vector-effect', 'non-scaling-stroke');
        pg.style.pointerEvents = 'none'; svg.append(pg);
      }
    }
    const a = kiv ? e.elemAlakok.find((x) => x.id === kiv) : undefined;
    cimke.textContent = a ? `${NEV[a.tipus]} · ${a.id}${a.szint ? ` · ${a.szint}` : ''}` : '';
    if (ujLap) alap(); else vbAllit();
  };
  // nagyítás, mozgatás, kijelölés – a lapkoordináták mindig a képernyő-mátrixból (getScreenCTM: a preserveAspectRatio-t is tudja)
  let sajat = false; // a felhasználó nagyított / mozgatott: méretváltozáskor ezt a nézetet tartjuk meg
  const inv = () => svg.getScreenCTM()?.inverse() ?? null;
  const pontM = (m: DOMMatrix | null, cx: number, cy: number): [number, number] | null => { if (!m) return null; const q = new DOMPoint(cx, cy).matrixTransform(m); return [q.x, q.y]; };
  const lapPont = (ev: { clientX: number; clientY: number }) => pontM(inv(), ev.clientX, ev.clientY) ?? [vb[0]!, vb[1]!];
  /** f-szeres nézetméret az (x, y) lappont körül, a b nézetből; a lapnál 3×-nál távolabb és 1/80-nál közelebb nem */
  const nagyit = (f: number, x: number, y: number, b = vb) => {
    const k = e.lapKepek[lap]; const max = k ? Math.max(k.szel, k.mag) * 3 : Infinity, min = k ? Math.max(k.szel, k.mag) / 80 : 0;
    const w = Math.min(max, Math.max(min, b[2]! * f)), q = w / b[2]!;
    vb = [x - (x - b[0]!) * q, y - (y - b[1]!) * q, b[2]! * q, b[3]! * q]; sajat = true; vbAllit();
  };
  svg.addEventListener('wheel', (ev) => {
    ev.preventDefault(); const [x, y] = lapPont(ev);
    // folytonos lépés (a touchpad apró lépései is simák); sor- / oldalegységű görgőnél átváltva
    const dy = ev.deltaY * (ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? svg.clientHeight || 600 : 1);
    nagyit(Math.exp(Math.max(-400, Math.min(400, dy)) * (ev.ctrlKey && Math.abs(dy) < 50 ? 0.01 : 0.0015)), x, y);
  }, { passive: false });
  const ujjak = new Map<number, { x: number; y: number }>();
  let le: { x: number; y: number; vb: number[]; m: DOMMatrix | null } | null = null, mozgott = false;
  let csip: { d: number; mx: number; my: number; vb: number[]; m: DOMMatrix | null } | null = null;
  const ket = () => { const [a, b] = [...ujjak.values()] as [{ x: number; y: number }, { x: number; y: number }]; return { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; };
  svg.addEventListener('pointerdown', (ev) => {
    ujjak.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); svg.setPointerCapture(ev.pointerId);
    if (ujjak.size === 2) { csip = { ...ket(), vb: [...vb], m: inv() }; le = null; mozgott = true; return; }
    le = { x: ev.clientX, y: ev.clientY, vb: [...vb], m: inv() }; mozgott = false;
  });
  svg.addEventListener('pointermove', (ev) => {
    if (ujjak.has(ev.pointerId)) ujjak.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (csip && ujjak.size === 2) {
      // csippentés: a kezdő középpont lappontja az aktuális középpont alá kerül, a nagyítás az ujjak távolságának aránya
      const k = ket(), p0 = pontM(csip.m, csip.mx, csip.my), p1 = pontM(csip.m, k.mx, k.my); if (!p0 || !p1) return;
      nagyit(csip.d / Math.max(1, k.d), p0[0], p0[1], [csip.vb[0]! - (p1[0] - p0[0]), csip.vb[1]! - (p1[1] - p0[1]), csip.vb[2]!, csip.vb[3]!]); return;
    }
    if (!le) return; const dx = ev.clientX - le.x, dy = ev.clientY - le.y; if (Math.hypot(dx, dy) > 4) mozgott = true; if (!mozgott) return;
    svg.style.cursor = 'grabbing';
    const p0 = pontM(le.m, le.x, le.y), p1 = pontM(le.m, ev.clientX, ev.clientY); if (!p0 || !p1) return;
    vb = [le.vb[0]! - (p1[0] - p0[0]), le.vb[1]! - (p1[1] - p0[1]), le.vb[2]!, le.vb[3]!]; sajat = true; vbAllit();
  });
  const fel = (ev: PointerEvent) => { ujjak.delete(ev.pointerId); if (ujjak.size < 2) csip = null; };
  svg.addEventListener('pointercancel', (ev) => { fel(ev); le = null; });
  svg.addEventListener('pointerup', (ev) => {
    fel(ev); svg.style.cursor = 'grab'; const kat = le && !mozgott; le = null; if (!kat) return;
    const [x, y] = lapPont(ev);
    // (helyiség csak akkor, ha a ponton nincs más elem – a fal, nyílás elöl)
    const t = elemekPontban(e.elemAlakok.filter((a) => mutat.has(a.tipus)), lap, x, y);
    const a = t.find((q) => q.tipus !== 'ter') ?? t[0];
    kiv = a?.id ?? null; rajzol(); opc.onKijeloles?.(kiv, a);
  });
  svg.addEventListener('dblclick', () => { sajat = false; alap(); });
  // Méretváltozáskor: amíg a felhasználó nem nagyított, a teljes lap; utána a nézet közepe és mértéke (lap-egység / képpont) marad.
  let meret = [0, 0];
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
    const r = gyoker.getBoundingClientRect(); if (!r.width || !r.height) return;
    const [w0, h0] = meret; meret = [r.width, r.height]; if (w0 === r.width && h0 === r.height) return;
    if (!sajat || !w0 || !h0) { alap(); return; }
    const s = vb[2]! / w0, cx = vb[0]! + vb[2]! / 2, cy = vb[1]! + vb[3]! / 2, w = r.width * s, h = r.height * s;
    vb = [cx - w / 2, cy - h / 2, w, h]; vbAllit();
  }) : null; ro?.observe(gyoker);
  rajzol(true);
  return {
    lapra: (i) => { lap = i; rajzol(true); },
    kijelol: (id) => { kiv = id; const a = id ? e.elemAlakok.find((x) => x.id === id) : undefined; if (a && a.lap !== lap) { lap = a.lap; rajzol(true); } else rajzol(); },
    megszuntet: () => { ro?.disconnect(); gyoker.remove(); },
  };
}
