/**
 * A teljes épületmodell 3D nézete (three.js): falak (nyílásokkal kivágva), terek padlója, födémek; a hőburok elemei
 * kiemelve. Forgatás: bal egérgomb húzása; mozgatás: jobb gomb / Shift; nagyítás: görgő.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { falFelulet, type EpuletModell, type Fal, type BurokSzerep } from '@terv/epulet';

const SZIN = {
  fal: 0xd8d2c4, falKulso: 0xc9bfa8, burok: 0xe8833a, futetlen: 0x5b9bd5, szomszed: 0x9ca3af, talaj: 0x8b6b4a,
  nyilas: 0x7fb7e6, padloFutott: 0xf3e3b5, padloFutetlen: 0xd5e3f0, padloKulter: 0xcfe8c5, fodem: 0xb8b0d8, teto: 0xb5643f,
};
const burokSzin = (b: BurokSzerep) => (b === 'kulso' ? SZIN.burok : b === 'futetlen' ? SZIN.futetlen : b === 'szomszed' ? SZIN.szomszed : b === 'talaj' ? SZIN.talaj : null);

/** Fal hasábjai a nyílások kivágásával (a fal hossza mentén szakaszokra bontva). */
function falDarabok(f: Fal, ny: { t: number; szel: number; mag: number; pm: number }[]): { t0: number; t1: number; z0: number; z1: number }[] {
  const L = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
  const h = f.h;
  const lyuk = ny.map((n) => ({ t0: Math.max(0, n.t - n.szel / 2), t1: Math.min(L, n.t + n.szel / 2), z0: Math.max(0, n.pm), z1: Math.min(h, n.pm + n.mag) })).filter((x) => x.t1 > x.t0 + 0.01).sort((a, b) => a.t0 - b.t0);
  const ki: { t0: number; t1: number; z0: number; z1: number }[] = [];
  let t = 0;
  for (const q of lyuk) {
    if (q.t0 > t) ki.push({ t0: t, t1: q.t0, z0: 0, z1: h });
    if (q.z0 > 0.01) ki.push({ t0: q.t0, t1: q.t1, z0: 0, z1: q.z0 });
    if (q.z1 < h - 0.01) ki.push({ t0: q.t0, t1: q.t1, z0: q.z1, z1: h });
    t = Math.max(t, q.t1);
  }
  if (t < L) ki.push({ t0: t, t1: L, z0: 0, z1: h });
  return ki;
}

export function Epulet3D({ modell, magassag = 600 }: { modell: EpuletModell; magassag?: number }) {
  const hely = useRef<HTMLDivElement>(null);
  const [csakBurok, setCsakBurok] = useState(false);
  const [szintLathato, setSzintLathato] = useState<Record<string, boolean>>({});
  const [kijelolt, setKijelolt] = useState<string | null>(null);
  const lathato = (sz: string) => szintLathato[sz] !== false;

  // összesítés: falfelületek hőburok-szerep szerint, terek kategóriánként
  const osszeg = useMemo(() => {
    const bm = new Map(modell.szintek.map((s) => [s.id, s.belmag]));
    const ny = new Map<string, number>(); for (const n of modell.nyilasok) ny.set(n.fal, (ny.get(n.fal) ?? 0) + n.szel * n.mag);
    const o: Record<string, { A: number; ny: number }> = {};
    for (const f of modell.falak) { const k = f.burok ?? (f.kulso ? 'kulsoNem' : 'belso'); const x = (o[k] ??= { A: 0, ny: 0 }); x.A += falFelulet(f, bm.get(f.szint) ?? f.h); x.ny += ny.get(f.id) ?? 0; }
    return o;
  }, [modell]);

  useEffect(() => {
    const el = hely.current; if (!el) return;
    const w = el.clientWidth || 800, h = magassag;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(w, h); renderer.setClearColor(0xf7f7f5);
    el.innerHTML = ''; el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a80, 0.9));
    const nap = new THREE.DirectionalLight(0xffffff, 0.9); nap.position.set(-30, 40, 50); scene.add(nap);
    // modell → three: x = x, y = z (fel), z = y (a lap y lefelé – a néző felé)
    const grp = new THREE.Group(); scene.add(grp);
    const nyFal = new Map<string, typeof modell.nyilasok>(); for (const n of modell.nyilasok) nyFal.set(n.fal, [...(nyFal.get(n.fal) ?? []), n]);
    const anyag = new Map<number, THREE.MeshLambertMaterial>();
    const mat = (c: number, atl = 1) => { const k = c * 10 + Math.round(atl * 9); let m = anyag.get(k); if (!m) { m = new THREE.MeshLambertMaterial({ color: c, transparent: atl < 1, opacity: atl, side: THREE.DoubleSide }); anyag.set(k, m); } return m; };
    const kattinthato: THREE.Object3D[] = [];
    for (const f of modell.falak) {
      if (!lathato(f.szint)) continue;
      const bsz = burokSzin(f.burok);
      if (csakBurok && bsz === null) continue;
      const dx = f.b[0] - f.a[0], dy = f.b[1] - f.a[1], L = Math.hypot(dx, dy); if (L < 0.05) continue;
      const szin = bsz ?? (f.kulso ? SZIN.falKulso : SZIN.fal);
      const ny = (nyFal.get(f.id) ?? []);
      if (f.profil && f.profil.length >= 2) {
        // ferde / tört felső élű fal (tetőtér): síkidom a fal hosszán, a nyílások lyukként, falvastagságnyi kihúzással
        const off = f.h - Math.max(...f.profil.map((q) => q.z));
        const sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(L, 0), ...f.profil.slice().reverse().map((q) => new THREE.Vector2(q.t * L, q.z + off))]);
        for (const n of ny) { const t0 = Math.max(0.01, n.t - n.szel / 2), t1 = Math.min(L - 0.01, n.t + n.szel / 2), z0 = Math.max(0.01, n.pm), z1 = n.pm + n.mag; if (t1 > t0 + 0.05 && z1 > z0 + 0.05) sh.holes.push(new THREE.Path([new THREE.Vector2(t0, z0), new THREE.Vector2(t1, z0), new THREE.Vector2(t1, z1), new THREE.Vector2(t0, z1)])); }
        const g = new THREE.ExtrudeGeometry(sh, { depth: f.vastag, bevelEnabled: false }); g.translate(0, 0, -f.vastag / 2);
        const m = new THREE.Mesh(g, mat(szin, kijelolt && kijelolt !== f.id ? 0.55 : 1));
        m.position.set(f.a[0], f.z0, f.a[1]); m.rotation.y = -Math.atan2(dy, dx);
        m.userData = { id: f.id }; grp.add(m); kattinthato.push(m);
      } else
      for (const d of falDarabok(f, ny)) {
        const g = new THREE.BoxGeometry(d.t1 - d.t0, d.z1 - d.z0, f.vastag);
        const m = new THREE.Mesh(g, mat(szin, kijelolt && kijelolt !== f.id ? 0.55 : 1));
        const tm = (d.t0 + d.t1) / 2;
        m.position.set(f.a[0] + (dx / L) * tm, f.z0 + (d.z0 + d.z1) / 2, f.a[1] + (dy / L) * tm);
        m.rotation.y = -Math.atan2(dy, dx);
        m.userData = { id: f.id }; grp.add(m); kattinthato.push(m);
      }
      // nyílászárók (üveg)
      for (const n of ny) {
        const g = new THREE.BoxGeometry(n.szel, n.mag, Math.max(0.04, f.vastag * 0.3));
        const m = new THREE.Mesh(g, mat(SZIN.nyilas, 0.55));
        m.position.set(f.a[0] + (dx / L) * n.t, f.z0 + n.pm + n.mag / 2, f.a[1] + (dy / L) * n.t);
        m.rotation.y = -Math.atan2(dy, dx); grp.add(m);
      }
    }
    // terek padlója
    for (const t of modell.terek) {
      if (!lathato(t.szint) || csakBurok) continue;
      const sz0 = modell.szintek.find((s) => s.id === t.szint); if (!sz0) continue;
      for (const p of t.poligonok) {
        if (p.length < 3) continue;
        const sh = new THREE.Shape(p.map(([x, y]) => new THREE.Vector2(x, y)));
        const g = new THREE.ShapeGeometry(sh); g.rotateX(Math.PI / 2);
        const m = new THREE.Mesh(g, mat(t.kategoria === 'futott' ? SZIN.padloFutott : t.kategoria === 'futetlen' ? SZIN.padloFutetlen : SZIN.padloKulter));
        m.position.y = sz0.z0 + 0.02; m.userData = { id: t.id }; grp.add(m); kattinthato.push(m);
      }
    }
    // födémek (tető / legalsó padló) körvonallal, áttetszően
    for (const fd of modell.fodemek) {
      const sz = fd.folott ?? fd.alatt; if (sz && !lathato(sz)) continue;
      if (fd.burok !== 'teto' && fd.burok !== 'padlo') continue;
      for (const p of fd.poligonok) {
        if (p.length < 3) continue;
        const sh = new THREE.Shape(p.map(([x, y]) => new THREE.Vector2(x, y)));
        const g = new THREE.ExtrudeGeometry(sh, { depth: fd.vastag, bevelEnabled: false }); g.rotateX(Math.PI / 2);
        const m = new THREE.Mesh(g, mat(fd.burok === 'teto' ? SZIN.teto : SZIN.fodem, fd.burok === 'teto' ? 0.35 : 0.5));
        m.position.y = fd.burok === 'teto' ? fd.z + fd.vastag : fd.z; grp.add(m);
      }
    }
    // kamera a modell befoglalójához
    const bb = new THREE.Box3().setFromObject(grp); const c = bb.getCenter(new THREE.Vector3()); const R = Math.max(5, bb.getSize(new THREE.Vector3()).length() / 2);
    const cam = new THREE.PerspectiveCamera(40, w / h, 0.1, R * 20);
    cam.position.set(c.x - R * 1.2, c.y + R * 1.0, c.z + R * 1.6); cam.lookAt(c);
    const ctl = new OrbitControls(cam, renderer.domElement); ctl.target.copy(c); ctl.update();
    let fut = true; const loop = () => { if (!fut) return; renderer.render(scene, cam); requestAnimationFrame(loop); }; loop();
    // kattintás: elem kijelölése
    const ray = new THREE.Raycaster(); let le: [number, number] | null = null;
    const down = (e: PointerEvent) => { le = [e.clientX, e.clientY]; };
    const up = (e: PointerEvent) => {
      if (!le || Math.hypot(e.clientX - le[0], e.clientY - le[1]) > 4) return;
      const rr = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - rr.left) / rr.width) * 2 - 1, -((e.clientY - rr.top) / rr.height) * 2 + 1), cam);
      const hit = ray.intersectObjects(kattinthato)[0]; setKijelolt(hit ? (hit.object.userData.id as string) : null);
    };
    renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('pointerup', up);
    (globalThis as { __epulet3dKep?: () => string }).__epulet3dKep = () => renderer.domElement.toDataURL('image/png');
    return () => { fut = false; ctl.dispose(); renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointerup', up); renderer.dispose(); grp.traverse((o) => { if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose(); }); };
  }, [modell, csakBurok, szintLathato, kijelolt, magassag]);

  const info = (() => {
    if (!kijelolt) return null;
    const f = modell.falak.find((x) => x.id === kijelolt);
    const tNev = (o: Fal['bal']) => (o.fajta === 'ter' ? modell.terek.find((t) => t.id === o.ter)?.nev ?? o.ter : ({ kulso: 'külső tér', talaj: 'talaj', szomszed: 'szomszéd épület', futetlen: 'fűtetlen tér', ismeretlen: 'ismeretlen' } as const)[o.fajta]);
    if (f) return `Fal · ${f.hossz.toFixed(2)} m × ${f.profil ? `${Math.min(...f.profil.map((q) => q.z)).toFixed(2)}–${Math.max(...f.profil.map((q) => q.z)).toFixed(2)}` : (f.belsoMag ?? f.h).toFixed(2)} m${f.jelleg ? ` (${({ terdfal: 'térdfal', oromfal: 'oromfal', parkany: 'alacsonyabb párkány', ferde: 'ferde felső élű' } as const)[f.jelleg]})` : ''}, ${Math.round(f.vastag * 100)} cm · ${tNev(f.bal)} | ${tNev(f.jobb)}${f.burok ? ` · hőburok: ${({ kulso: 'külső fal', futetlen: 'fűtetlen tér felé', szomszed: 'szomszéd felé', talaj: 'talajjal érintkező' } as const)[f.burok]}` : ''}`;
    const t = modell.terek.find((x) => x.id === kijelolt);
    if (t) return `${t.kod ? t.kod + ' ' : ''}${t.nev} · ${t.A.toFixed(2)} m² · belmagasság ${t.belmag.toFixed(2)} m · ${({ futott: 'fűtött', futetlen: 'fűtetlen', kulter: 'kültér' } as const)[t.kategoria]}`;
    return null;
  })();
  const fm = (v: number) => v.toLocaleString('hu-HU', { maximumFractionDigits: 1 });
  return (
    <div>
      <div class="gombsor" style="gap:8px;flex-wrap:wrap;align-items:center;padding:8px 10px">
        <label class="jelolo"><input type="checkbox" checked={csakBurok} onChange={(e) => setCsakBurok((e.target as HTMLInputElement).checked)} /> csak a hőburok elemei</label>
        {modell.szintek.map((s) => <label class="jelolo"><input type="checkbox" checked={lathato(s.id)} onChange={(e) => setSzintLathato((x) => ({ ...x, [s.id]: (e.target as HTMLInputElement).checked }))} /> {s.nev}</label>)}
        <span class="halkabb" style="font-size:12px">
          <span style={`display:inline-block;width:10px;height:10px;background:#E8833A;margin:0 4px 0 8px`} />külső fal (hőburok)
          <span style={`display:inline-block;width:10px;height:10px;background:#5B9BD5;margin:0 4px 0 8px`} />fűtetlen felé
          <span style={`display:inline-block;width:10px;height:10px;background:#9CA3AF;margin:0 4px 0 8px`} />szomszéd felé
          <span style={`display:inline-block;width:10px;height:10px;background:#D8D2C4;margin:0 4px 0 8px`} />belső fal
        </span>
      </div>
      <div ref={hely} style={`width:100%;height:${magassag}px`} />
      <div class="halkabb" style="font-size:12px;padding:6px 10px">
        {info ?? 'Kattints egy falra vagy helyiségre a részletekért.'}<br />
        {modell.szintek.length} szint · {modell.terek.length} tér · {modell.falak.length} fal · {modell.nyilasok.length} nyílászáró ·
        hőburok-fal (belső sík × belmagasság): külső {fm(osszeg.kulso?.A ?? 0)} m² (nyílás {fm(osszeg.kulso?.ny ?? 0)}), fűtetlen felé {fm(osszeg.futetlen?.A ?? 0)} m², szomszéd felé {fm(osszeg.szomszed?.A ?? 0)} m²
      </div>
    </div>
  );
}
