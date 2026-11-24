/**
 * KÖZÖS 3D-MOTOR (Navitherm és ELBA). Keretrendszer-független: egy dobozba rajzol, elemlistát kap, és a megjelenést
 * (színezés, röntgen, metszés, vetítés, árnyékolás, kijelölés, szintek, típusonkénti szín/átlátszóság) hívásokkal
 * állítják. A geometria csak `elemek()`-kor épül; a többi hívás csak az anyagokat cseréli – gyors.
 *
 * Koordináták: three.js (y fel). Az épületmodell (x, y lefelé a lapon, z fel) → (x, z, y); az IFC (z fel) → (x, z, −y).
 *
 * Balázs (2026-11-21): „Alapból tömör, fehér háttérrel … kapcsolóval röntgen-átlátszó, szintje állítható, és a kijelölés
 * látszik, vagy csak a mutasd a kijelölteket. Mindkét alkalmazásban hasonlóan” – majd: „nem lenne jobb ugyanazt
 * használni mindkettőhöz? Akkor egy fejlesztés”.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export { THREE };

/** Egy test a jelenetben. */
export interface Elem3D {
  /** Kijelölési azonosító; több test is viselheti (az ablak kerete és üvege, a sávalap falszakaszai). null: nem kattintható. */
  id: string | null;
  /** Megjelenési típus (a típusonkénti beállítás kulcsa): fal, teto, nyilaszaro, uveg, fodem, padlo, alapozas, piller, ter … */
  tipus: string;
  szint?: string | null;
  /** Világkoordinátás geometria (y fel). */
  geo: THREE.BufferGeometry;
  /** Saját (a modellből jövő) szín – a típus alapszíne helyett. */
  szin?: number;
  /** Alap átlátszatlanság (pl. üveg 0,92). */
  atl?: number;
  /** Élvonal (alap: igen). */
  el?: boolean;
  /** A „szülő” azonosító (a nyílászáróé a fal): „csak a kijelölt” módban együtt látszanak. */
  szulo?: string;
  /** Tetszőleges adat a hívónak (pl. a nyílás forrása, hőburok-szerep). */
  adat?: unknown;
  /** Előrehozás a szem felé (m, nézeti térben): az IFC-ben a falréteg (vakolat, hőszigetelés) gyakran nincs kivágva a
   *  nyílásnál, és eltakarná az ablakot – így az ablak a saját falán „átlátszik”, a távolabbi falak mögött nem. */
  elore?: number;
}
/** A hívó felülírása elemenként (külső színezés, szűrés). */
export interface Megjelenes {
  szin?: number;
  atl?: number;
  /** 'szellem': alig látszik és nem kattintható; 'rejtett': nem látszik. */
  mod?: 'eles' | 'szellem' | 'rejtett';
}
export interface TipusLeiras { kulcs: string; nev: string; szin: number; atl?: number }
export type TipusBeall = Record<string, { szin?: number; atl?: number } | undefined>;
export interface KameraAllas { p: [number, number, number]; t: [number, number, number]; zoom?: number; orto?: boolean }
export interface NezoOpciok {
  tipusok: TipusLeiras[];
  tipusBeall?: TipusBeall;
  /** Külső színezés / szűrés (pl. hőburok vagy besorolás szerint). null: nincs felülírás. */
  megjelenes?: ((e: Elem3D) => Megjelenes | null) | null;
  /** Kattintás (mozdulat nélkül). ctrl: Ctrl/⌘/Shift lenyomva (többes kijelölés). */
  onKatt?: (id: string | null, e: Elem3D | null, opc: { ctrl: boolean }) => void;
  /** Kattintás egy jelölőre (userData.jelolo: a jelölő sorszáma) – pl. a zártsági hiba leírásához. */
  onJelolo?: (i: number) => void;
  /** Dupla kattintás után (az elemre közelítettünk, ill. üres helyen a teljes nézetre). */
  onDupla?: (id: string | null, e: Elem3D | null) => void;
  /** A kijelölés színe. */
  kijSzin?: number;
  kamera?: KameraAllas | null;
  arnyekolas?: boolean;
  /** A dupla kattintás magától kijelöl és ráközelít (alap: igen). */
  duplaKijelol?: boolean;
}
export interface Nezo {
  /** Új elemlista (a kamera marad). jelolok: mindenen átütő jelölések (pl. zártsági hibák); a userData.jelolo sorszámú kattintható (onJelolo). */
  elemek(l: Elem3D[], jelolok?: THREE.Object3D[]): void;
  /** A megjelenés újraszámolása (pl. a `megjelenes` függvény mögötti állapot változott). */
  frissit(): void;
  megjelenes(f: ((e: Elem3D) => Megjelenes | null) | null): void;
  kijelol(ids: Iterable<string>, ra?: boolean): void;
  kijeloltek(): string[];
  rontgen(be: boolean, atl?: number): void;
  csakKijelolt(be: boolean): void;
  /** Vízszintes metszés: a sík magassága (m, világ-y) vagy null. */
  metszes(y: number | null): void;
  parhuzamos(be: boolean): void;
  arnyekolas(be: boolean): void;
  /** Szintek láthatósága (a hiányzó kulcs: látható). */
  szintek(lathato: Record<string, boolean>): void;
  tipusBeall(t: TipusBeall): void;
  /** A kamera ráillesztése a megadott azonosítókra (üres / hiányzó: minden élesen látható elemre). */
  illeszt(ids?: Iterable<string> | null): void;
  kamera(): KameraAllas;
  kameraBeall(k: KameraAllas): void;
  /** Befoglaló (világ, y fel) – azonosítóra vagy az egészre. */
  doboz(id?: string | null): THREE.Box3;
  kep(): string;
  elemLista(): readonly Elem3D[];
  bezar(): void;
}

const EL_SZIN = 0x3c3c3c;
const SZELLEM = 0.07;

export function nezoNyit(doboz: HTMLElement, opc: NezoOpciok): Nezo {
  const kijSzin = opc.kijSzin ?? 0xf97316;
  const tipusok = new Map(opc.tipusok.map((t) => [t.kulcs, t]));
  let tipusB: TipusBeall = opc.tipusBeall ?? {};
  let megj = opc.megjelenes ?? null;
  let rtg = false, rtgAtl = 0.2, csakKij = false, vagY: number | null = null, orto = !!opc.kamera?.orto, ao = opc.arnyekolas !== false;
  let szintL: Record<string, boolean> = {};
  const kij = new Set<string>();

  const meretek = () => [Math.max(1, doboz.clientWidth || 800), Math.max(1, doboz.clientHeight || 500)] as const;
  let [w, h] = meretek();
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(w, h); renderer.setClearColor(0xffffff);
  renderer.domElement.style.display = 'block'; renderer.domElement.style.touchAction = 'none';
  doboz.innerHTML = ''; doboz.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  // két irányból eső fény + égbolt: a szomszédos, eltérő irányú lapok más árnyalatot kapnak – nem olvadnak össze
  scene.add(new THREE.HemisphereLight(0xffffff, 0x7d7d76, 0.75));
  const nap = new THREE.DirectionalLight(0xffffff, 0.85); nap.position.set(-30, 45, 50); scene.add(nap);
  const nap2 = new THREE.DirectionalLight(0xffffff, 0.3); nap2.position.set(40, 20, -35); scene.add(nap2);
  const grp = new THREE.Group(); scene.add(grp);
  const atut = new THREE.Group(); scene.add(atut); // a kijelölés mindenen átütő rétege
  const jelGrp = new THREE.Group(); scene.add(jelGrp);

  let lista: Elem3D[] = [];
  let hal: { e: Elem3D; m: THREE.Mesh; el: THREE.LineSegments | null }[] = [];
  let kattinthato: THREE.Mesh[] = [];
  let R = 10; const C = new THREE.Vector3();

  // kamerák: perspektivikus és párhuzamos; az OrbitControls a mindenkori aktívat mozgatja
  const pcam = new THREE.PerspectiveCamera(40, w / h, 0.05, 2000);
  const ocam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 4000);
  let cam: THREE.PerspectiveCamera | THREE.OrthographicCamera = orto ? ocam : pcam;
  const ctl = new OrbitControls(cam, renderer.domElement);
  ctl.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };
  ctl.zoomToCursor = true; ctl.screenSpacePanning = true;
  // a középső gomb ne indítson automatikus görgetést (a lap ne mozduljon alatta)
  const kozep = (e: MouseEvent) => { if (e.button === 1) e.preventDefault(); };
  renderer.domElement.addEventListener('mousedown', kozep); renderer.domElement.addEventListener('auxclick', kozep);
  renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

  const anyagok = new Map<string, THREE.Material>();
  /** a csúcsok előrehozása a szem felé (nézeti térben, m) */
  const elorehoz = (m: THREE.Material, d: number) => {
    if (!d) return;
    m.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>',
      `#include <project_vertex>\n  gl_Position = projectionMatrix * vec4( mvPosition.xyz + normalize( -mvPosition.xyz ) * ${d.toFixed(3)}, 1.0 );`); };
    m.customProgramCacheKey = () => `elore${d.toFixed(3)}`;
  };
  const anyag = (c: number, o: number, d = 0) => {
    const k = `${c}|${o.toFixed(3)}|${d}`; let m = anyagok.get(k);
    if (!m) { m = new THREE.MeshLambertMaterial({ color: c, transparent: o < 1, opacity: o, side: THREE.DoubleSide, depthWrite: o >= 1,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }); elorehoz(m, d); anyagok.set(k, m); }
    return m;
  };
  const elAnyagok = new Map<string, THREE.LineBasicMaterial>();
  const elAnyag = (o: number, d = 0) => { const k = `${o.toFixed(3)}|${d}`; let m = elAnyagok.get(k);
    if (!m) { m = new THREE.LineBasicMaterial({ color: EL_SZIN, transparent: true, opacity: o, depthWrite: false }); elorehoz(m, d); elAnyagok.set(k, m); } return m; };
  const atutAnyag = new THREE.MeshBasicMaterial({ color: kijSzin, transparent: true, opacity: 0.38, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
  const atutEl = new THREE.LineBasicMaterial({ color: 0xc2410c, transparent: true, opacity: 0.95, depthTest: false });

  /** Az elem állapota: látszik-e, kattintható-e, milyen színnel / átlátszósággal. */
  const allapot = (e: Elem3D) => {
    const k = !!e.id && kij.has(e.id);
    const mj = megj ? megj(e) : null;
    if (e.szint && szintL[e.szint] === false) return null;
    if (mj?.mod === 'rejtett' && !k) return null;
    if (csakKij && kij.size && !k && !(e.szulo && kij.has(e.szulo)) && !(e.id && kijSzulok.has(e.id))) return null;
    const t = tipusok.get(e.tipus), b = tipusB[e.tipus];
    const szin = k ? kijSzin : mj?.szin ?? b?.szin ?? e.szin ?? t?.szin ?? 0xcccccc;
    let o = mj?.atl ?? b?.atl ?? e.atl ?? t?.atl ?? 1;
    const szellem = mj?.mod === 'szellem' && !k;
    if (szellem) o = SZELLEM; else if (k) o = 1; else if (rtg) o = Math.min(o, rtgAtl);
    return { szin, o, k, szellem, kattint: !!e.id && !szellem && o > 0.02 };
  };
  let kijSzulok = new Set<string>();

  function alkalmaz() {
    kijSzulok = new Set(lista.filter((e) => e.id && kij.has(e.id) && e.szulo).map((e) => e.szulo!));
    kattinthato = [];
    for (const x of atut.children.slice()) atut.remove(x);
    for (const q of hal) {
      const a = allapot(q.e);
      if (!a || a.o <= 0.005) { q.m.visible = false; continue; }
      q.m.visible = true; q.m.material = anyag(a.szin, a.o, q.e.elore ?? 0);
      if (q.el) { q.el.visible = !a.szellem; q.el.material = elAnyag(rtg ? 0.22 : a.o < 1 ? 0.25 : 0.5, q.e.elore ?? 0); }
      if (a.kattint) kattinthato.push(q.m);
      if (a.k) { const m2 = new THREE.Mesh(q.m.geometry, atutAnyag); m2.renderOrder = 20; atut.add(m2);
        if (q.el) { const e2 = new THREE.LineSegments(q.el.geometry, atutEl); e2.renderOrder = 21; atut.add(e2); } }
    }
    kell();
  }

  function elemek(l: Elem3D[], jelolok?: THREE.Object3D[]) {
    for (const q of hal) { q.m.geometry.dispose(); q.el?.geometry.dispose(); }
    grp.clear(); jelGrp.clear(); hal = []; lista = l;
    for (const e of l) {
      const m = new THREE.Mesh(e.geo); m.userData = { elem: e };
      let el: THREE.LineSegments | null = null;
      const db = (e.geo.index ? e.geo.index.count : e.geo.getAttribute('position')?.count ?? 0) / 3;
      if (e.el !== false && db > 0 && db < 6000) { el = new THREE.LineSegments(new THREE.EdgesGeometry(e.geo, 25), elAnyag(0.5)); m.add(el); }
      grp.add(m); hal.push({ e, m, el });
    }
    for (const j of jelolok ?? []) { j.renderOrder = 30; jelGrp.add(j); }
    const bb = new THREE.Box3().setFromObject(grp);
    if (!bb.isEmpty()) { bb.getCenter(C); R = Math.max(3, bb.getSize(new THREE.Vector3()).length() / 2); }
    ocam.far = R * 40 + 100; pcam.far = R * 30 + 100; pcam.updateProjectionMatrix();
    alkalmaz();
  }

  // --- kamera -------------------------------------------------------------------------------------------------
  const irany = () => cam.position.clone().sub(ctl.target).normalize();
  function orthoKeret(felMag: number) {
    const a = w / h; ocam.left = -felMag * a; ocam.right = felMag * a; ocam.top = felMag; ocam.bottom = -felMag; ocam.zoom = 1; ocam.updateProjectionMatrix();
  }
  const tav = () => Math.max(R * 4, 30);
  /** a középpont és sugár a képbe: perspektivikusban a távolság, párhuzamosban a keret mérete */
  function ra(c: THREE.Vector3, r: number, ir?: THREE.Vector3, k = 1.15) {
    const d = ir ?? irany();
    ctl.target.copy(c);
    // (keskeny dobozban a vízszintes látószög a szűkebb)
    const fel = THREE.MathUtils.degToRad(pcam.fov / 2), felV = Math.min(fel, Math.atan(Math.tan(fel) * (w / h)));
    if (cam === pcam) { const dist = (r * k) / Math.sin(felV); pcam.position.copy(c.clone().add(d.multiplyScalar(dist))); pcam.near = Math.max(0.02, dist / 500); pcam.updateProjectionMatrix(); }
    else { orthoKeret((r * k * 0.95) / Math.min(1, w / h)); ocam.position.copy(c.clone().add(d.multiplyScalar(tav()))); }
    ctl.update(); kell();
  }
  function alapNezet() { ra(C, R, new THREE.Vector3(-1.2, 1.0, 1.6).normalize(), 0.8); }
  function valt(o: boolean) {
    if (o === (cam === ocam)) return;
    const d = irany(), t = ctl.target.clone();
    if (o) { const dist = pcam.position.distanceTo(t); orthoKeret(dist * Math.tan(THREE.MathUtils.degToRad(pcam.fov / 2))); ocam.position.copy(t.clone().add(d.multiplyScalar(tav()))); cam = ocam; }
    else { const fel = ocam.top / ocam.zoom; const dist = fel / Math.tan(THREE.MathUtils.degToRad(pcam.fov / 2)); pcam.position.copy(t.clone().add(d.multiplyScalar(dist))); cam = pcam; }
    ctl.object = cam; ctl.update(); kompozitor(); kell();
  }
  function kameraBe(k: KameraAllas) {
    if (!!k.orto !== (cam === ocam)) { cam = k.orto ? ocam : pcam; ctl.object = cam; }
    ctl.target.set(...k.t); cam.position.set(...k.p);
    if (cam === ocam) { orthoKeret(k.zoom ?? R); }
    ctl.update();
  }

  // --- rajzolás (csak ha kell: mozgás, állapotváltozás) -------------------------------------------------------
  let composer: EffectComposer | null = null;
  function kompozitor() {
    composer?.dispose(); composer = null;
    if (!ao || rtg) return;
    try {
      composer = new EffectComposer(renderer); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h);
      composer.addPass(new RenderPass(scene, cam));
      const g = new GTAOPass(scene, cam, w, h); g.blendIntensity = 0.85;
      g.updateGtaoMaterial({ radius: Math.max(0.6, R * 0.04), distanceExponent: 1, thickness: 1, scale: 1, samples: 12 }); composer.addPass(g);
      composer.addPass(new OutputPass());
    } catch { composer = null; }
  }
  let kerve = false, el = true;
  // mozgatás közben gyors rajzolás (GTAO nélkül); az utolsó mozdulat után ~180 ms-mal jön a teljes minőségű kép.
  // (a görgős nagyítás eseményenként küld start/end-et → az időzítő zárja le)
  let mozog = false, csend: ReturnType<typeof setTimeout> | null = null;
  ctl.addEventListener('start', () => { mozog = true; if (csend) { clearTimeout(csend); csend = null; } });
  ctl.addEventListener('end', () => { if (csend) clearTimeout(csend); csend = setTimeout(() => { csend = null; mozog = false; kell(); }, 180); });
  function rajzol() { kerve = false; if (!el) return;
    // (a kijelölés átütő rétege és a jelölők a GTAO normál/mélység menetéből kimaradnak)
    if (composer && !mozog) { atut.visible = false; jelGrp.visible = false; composer.render(); atut.visible = true; jelGrp.visible = true;
      renderer.autoClear = false; renderer.clearDepth(); renderer.render(atut, cam); renderer.render(jelGrp, cam); renderer.autoClear = true; }
    else renderer.render(scene, cam);
  }
  function kell() { if (!kerve) { kerve = true; requestAnimationFrame(rajzol); } }
  ctl.addEventListener('change', kell);

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
    const [w2, h2] = meretek(); if (w2 === w && h2 === h) return; w = w2; h = h2;
    renderer.setSize(w, h); pcam.aspect = w / h; pcam.updateProjectionMatrix();
    const fel = ocam.top; orthoKeret(fel); composer?.setSize(w, h); kell();
  }) : null;
  ro?.observe(doboz);

  // --- kattintás -----------------------------------------------------------------------------------------------
  const ray = new THREE.Raycaster();
  const talal = (ev: MouseEvent) => {
    const rr = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((ev.clientX - rr.left) / rr.width) * 2 - 1, -((ev.clientY - rr.top) / rr.height) * 2 + 1), cam);
    const hit = ray.intersectObjects(kattinthato, false).find((x) => vagY === null || x.point.y <= vagY + 1e-3);
    return hit ? (hit.object.userData.elem as Elem3D) : null;
  };
  let le: [number, number] | null = null;
  const down = (e: PointerEvent) => { le = [e.clientX, e.clientY]; };
  const up = (e: PointerEvent) => {
    if (!le || e.button !== 0 || Math.hypot(e.clientX - le[0], e.clientY - le[1]) > 4) { le = null; return; }
    le = null;
    // a jelölők (mindenen átütnek) elsőbbséget kapnak
    if (opc.onJelolo && jelGrp.children.length) {
      const rr = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - rr.left) / rr.width) * 2 - 1, -((e.clientY - rr.top) / rr.height) * 2 + 1), cam);
      const jh = ray.intersectObjects(jelGrp.children, true).find((h) => typeof h.object.userData.jelolo === 'number');
      if (jh) { opc.onJelolo(jh.object.userData.jelolo as number); return; }
    }
    const x = talal(e); opc.onKatt?.(x?.id ?? null, x, { ctrl: e.ctrlKey || e.metaKey || e.shiftKey });
  };
  const dupla = (ev: MouseEvent) => {
    const x = talal(ev);
    if (!x?.id) { alapNezet(); opc.onDupla?.(null, null); return; }
    if (opc.duplaKijelol !== false) { kij.clear(); kij.add(x.id); alkalmaz(); }
    illeszt([x.id]); opc.onDupla?.(x.id, x);
  };
  renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('pointerup', up);
  renderer.domElement.addEventListener('dblclick', dupla);

  function doboz3(id?: string | null) {
    const bb = new THREE.Box3();
    for (const q of hal) if (id == null ? q.m.visible : q.e.id === id) bb.expandByObject(q.m);
    return bb;
  }
  function illeszt(ids?: Iterable<string> | null) {
    const t = ids ? new Set(ids) : null, bb = new THREE.Box3();
    for (const q of hal) { if (t ? !(q.e.id && t.has(q.e.id)) : !q.m.visible || (q.m.material as THREE.Material).opacity <= SZELLEM + 1e-3) continue; bb.expandByObject(q.m); }
    if (bb.isEmpty()) return;
    const c = bb.getCenter(new THREE.Vector3()), r = Math.max(t ? 1.2 : 3, bb.getSize(new THREE.Vector3()).length() / 2);
    ra(c, r, undefined, t ? 1.3 : 0.8);
  }

  if (opc.kamera) kameraBe(opc.kamera); else { orthoKeret(R); }
  (globalThis as { __nezo3d?: unknown }).__nezo3d = null; // (próbákhoz: a legutóbb nyitott nézet – lent állítjuk)
  kompozitor();

  const api: Nezo = {
    elemek(l, j) { const elso = !hal.length && !opc.kamera; elemek(l, j); if (elso) alapNezet(); kompozitor(); kell(); },
    frissit: alkalmaz,
    megjelenes(f) { megj = f; alkalmaz(); },
    kijelol(ids, r) { kij.clear(); for (const i of ids) kij.add(i); alkalmaz(); if (r && kij.size) illeszt(kij); },
    kijeloltek: () => [...kij],
    rontgen(be, a) { const v = rtg !== be; rtg = be; if (a !== undefined) rtgAtl = a; alkalmaz(); if (v) kompozitor(); kell(); },
    csakKijelolt(be) { csakKij = be; alkalmaz(); },
    metszes(y) { vagY = y; renderer.clippingPlanes = y === null ? [] : [new THREE.Plane(new THREE.Vector3(0, -1, 0), y)]; kell(); },
    parhuzamos: valt,
    arnyekolas(be) { ao = be; kompozitor(); kell(); },
    szintek(l) { szintL = { ...l }; alkalmaz(); },
    tipusBeall(t) { tipusB = t ?? {}; alkalmaz(); },
    illeszt,
    kameraBeall(k) { kameraBe(k); kompozitor(); kell(); },
    kamera: () => ({ p: cam.position.toArray() as [number, number, number], t: ctl.target.toArray() as [number, number, number], orto: cam === ocam, ...(cam === ocam ? { zoom: ocam.top / ocam.zoom } : {}) }),
    doboz: doboz3,
    kep() { rajzol(); return renderer.domElement.toDataURL('image/png'); },
    elemLista: () => lista,
    bezar() { el = false; if (csend) clearTimeout(csend); ro?.disconnect(); composer?.dispose(); ctl.dispose();
      renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointerup', up); renderer.domElement.removeEventListener('dblclick', dupla);
      for (const q of hal) { q.m.geometry.dispose(); q.el?.geometry.dispose(); }
      for (const m of anyagok.values()) m.dispose(); for (const m of elAnyagok.values()) m.dispose();
      renderer.dispose(); try { renderer.forceContextLoss(); } catch { /* */ } },
  };
  (globalThis as { __nezo3d?: unknown }).__nezo3d = api;
  return api;
}
