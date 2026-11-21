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
  // nagyítás, mozgatás, kijelölés
  const lapPont = (ev: { clientX: number; clientY: number }) => { const r = svg.getBoundingClientRect(); return [vb[0]! + (ev.clientX - r.left) / r.width * vb[2]!, vb[1]! + (ev.clientY - r.top) / r.height * vb[3]!] as [number, number]; };
  svg.addEventListener('wheel', (ev) => { ev.preventDefault(); const [x, y] = lapPont(ev); const f = ev.deltaY > 0 ? 1.15 : 1 / 1.15; vb = [x - (x - vb[0]!) * f, y - (y - vb[1]!) * f, vb[2]! * f, vb[3]! * f]; vbAllit(); }, { passive: false });
  let le: { x: number; y: number; vb: number[] } | null = null, mozgott = false;
  svg.addEventListener('pointerdown', (ev) => { le = { x: ev.clientX, y: ev.clientY, vb: [...vb] }; mozgott = false; svg.setPointerCapture(ev.pointerId); });
  svg.addEventListener('pointermove', (ev) => { if (!le) return; const dx = ev.clientX - le.x, dy = ev.clientY - le.y; if (Math.hypot(dx, dy) > 4) mozgott = true; if (!mozgott) return; svg.style.cursor = 'grabbing'; const r = svg.getBoundingClientRect(); vb = [le.vb[0]! - dx / r.width * le.vb[2]!, le.vb[1]! - dy / r.height * le.vb[3]!, le.vb[2]!, le.vb[3]!]; vbAllit(); });
  svg.addEventListener('pointerup', (ev) => {
    svg.style.cursor = 'grab'; const kat = le && !mozgott; le = null; if (!kat) return;
    const [x, y] = lapPont(ev);
    // (helyiség csak akkor, ha a ponton nincs más elem – a fal, nyílás elöl)
    const t = elemekPontban(e.elemAlakok.filter((a) => mutat.has(a.tipus)), lap, x, y);
    const a = t.find((q) => q.tipus !== 'ter') ?? t[0];
    kiv = a?.id ?? null; rajzol(); opc.onKijeloles?.(kiv, a);
  });
  svg.addEventListener('dblclick', () => alap());
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => alap()) : null; ro?.observe(gyoker);
  rajzol(true);
  return {
    lapra: (i) => { lap = i; rajzol(true); },
    kijelol: (id) => { kiv = id; const a = id ? e.elemAlakok.find((x) => x.id === id) : undefined; if (a && a.lap !== lap) { lap = a.lap; rajzol(true); } else rajzol(); },
    megszuntet: () => { ro?.disconnect(); gyoker.remove(); },
  };
}
