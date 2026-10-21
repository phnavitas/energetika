"""Típusalaprajz-mintalapok fix adatai: lakások (összefüggő szürke terület), helyiségek, külső falak, nyílászárók."""
import sys, json, re, numpy as np
from PIL import Image
from scipy import ndimage as nd
import pymupdf as fitz

nev = sys.argv[1]
a = np.array(Image.open(f'{nev}-2.pgm')).astype(np.int16)
H, W = a.shape
DPI = 300; PT = DPI / 72
PX = 72 / DPI * 0.3528e-3 * 200          # m/képpont 1:200-nál (méretláncokkal ellenőrizve: 3,45 / 3,60 m ±1,5 cm)
K = 2                                     # a falvonalak vastagítása miatti korrekció (képpont / oldal)
dark = a < 128
wall = nd.binary_opening(dark, structure=np.ones((5, 5)))
osztaly = {'D': (a >= 200) & (a <= 225), 'L': (a >= 236) & (a <= 251)}
grey_all = osztaly['D'] | osztaly['L']

# --- helyiségek és lakások
szoba = np.zeros(a.shape, np.int32); lakas_of_szoba = [0]; lak = np.zeros(a.shape, np.int32); lakasok = []
for cls, m in osztaly.items():
    c = nd.binary_closing(m, structure=np.ones((5, 5))) & ~wall
    rl, rn = nd.label(c, structure=np.ones((3, 3)))
    rs = nd.sum(np.ones_like(rl), rl, index=np.arange(1, rn + 1))
    keep = np.zeros(rn + 1, bool); keep[1:] = rs * PX * PX >= 0.5
    c = keep[rl]
    g = nd.binary_dilation(c, structure=np.ones((25, 25)))
    gl, gn = nd.label(g, structure=np.ones((3, 3)))
    for i in range(1, gn + 1):
        mm = (gl == i) & c
        if mm.sum() * PX * PX < 15: continue
        lakasok.append({'osztaly': cls}); li = len(lakasok)
        lak[mm] = li
        for r in np.unique(rl[mm]):
            if r == 0: continue
            rm = rl == r
            sl_ = nd.find_objects(rm.astype(int))[0]
            sy = slice(max(sl_[0].start - 8, 0), sl_[0].stop + 8); sx = slice(max(sl_[1].start - 8, 0), sl_[1].stop + 8)
            # feliratok, vonalak okozta lyukak és csipkék eltüntetése a helyiségen belül
            sub = nd.binary_fill_holes(nd.binary_closing(rm[sy, sx], structure=np.ones((9, 9)))) & ~wall[sy, sx]
            szoba[sy, sx][sub & (szoba[sy, sx] == 0)] = len(lakas_of_szoba); lakas_of_szoba.append(li)

# --- épület-körvonal (külső tér): 4-szeres kicsinyítéssel zárás
s = 4
wl, wn = nd.label(wall)
ws = nd.sum(np.ones_like(wl), wl, index=np.arange(1, wn + 1))
nagyfal = np.zeros(wn + 1, bool); nagyfal[1:] = ws >= 600
kis = (nagyfal[wl] | (szoba > 0))[::s, ::s]
zart = nd.binary_closing(kis, structure=np.ones((25, 25)), iterations=1)
zart = nd.binary_fill_holes(zart)
kulso = ~np.kron(zart, np.ones((s, s), bool))[:H, :W]

# --- helyiségenkénti terület (K képpont korrekcióval) és külső falhossz oldalanként
IRANY = {0: (-1, 0), 90: (0, 1), 180: (1, 0), 270: (0, -1)}   # lapirány (fent=0, jobbra=90…) → (dy, dx)
nsz = len(lakas_of_szoba)
terulet = np.zeros(nsz); falpx = np.zeros((nsz, 4)); falszakasz = [[[] for _ in range(4)] for _ in range(nsz)]
for idx in range(1, nsz):
    m = szoba == idx
    sl = nd.find_objects(m.astype(int))[0]
    y0, y1 = max(sl[0].start - 50, 0), min(sl[0].stop + 50, H); x0, x1 = max(sl[1].start - 50, 0), min(sl[1].stop + 50, W)
    mm = m[y0:y1, x0:x1]; ww = wall[y0:y1, x0:x1]; kk = kulso[y0:y1, x0:x1]; other = szoba[y0:y1, x0:x1] > 0
    t = mm.copy()
    for _ in range(K): t = nd.binary_dilation(t, structure=np.ones((3, 3))) & (mm | ww)
    terulet[idx] = t.sum() * PX * PX
    for j, (irany, (dy, dx)) in enumerate(IRANY.items()):
        hatar = mm & ~np.roll(mm, (-dy, -dx), axis=(0, 1))   # a szomszéd irányban nem a helyiség
        ys, xs = np.nonzero(hatar)
        for y, x in zip(ys, xs):
            for k in range(1, 61):
                yy, xx = y + dy * k, x + dx * k
                if not (0 <= yy < mm.shape[0] and 0 <= xx < mm.shape[1]) or other[yy, xx]: break
                if kk[yy, xx]:
                    if k >= 1: falpx[idx, j] += 1; falszakasz[idx][j].append((y + y0, x + x0))
                    break

# --- nyílászáró-feliratok (PDF szöveg)
d = fitz.open(f'/root/ekm/apps/web/src/mintak/tipusalaprajz_{nev}.pdf'); pg = d[1]
sorok = []
for b in pg.get_text('dict')['blocks']:
    for l in b.get('lines', []):
        txt = ''.join(sp['text'] for sp in l['spans']).strip()
        bx = l['bbox']; cx, cy = (bx[0] + bx[2]) / 2, (bx[1] + bx[3]) / 2
        dr = (round(l['dir'][0]), round(l['dir'][1]))
        sorok.append({'t': txt, 'x': cx, 'y': cy, 'dir': dr, 'b': bx})
pm_minta = re.compile(r'^(?:P|pm)\s*(\d{2,3})$', re.I)
szam_minta = re.compile(r'^(\d{2,3})$')
pmek = [s_ for s_ in sorok if pm_minta.match(s_['t'])]
szamok = [s_ for s_ in sorok if szam_minta.match(s_['t']) and int(s_['t']) >= 50]
hasznalt = set()
feliratok = []
def par(kozel, dr):
    up = (dr[1], -dr[0])
    kozel.sort(key=lambda s_: -(s_['x'] * up[0] + s_['y'] * up[1]))   # felső sor elöl
    return int(kozel[0]['t']), int(kozel[1]['t'])
for p in pmek:
    v = abs(p['dir'][0]) == 1                       # a „pm” sor iránya: vízszintes → x mentén fedjenek át
    def atfed(s_):
        a0, a1 = (s_['b'][0], s_['b'][2]) if v else (s_['b'][1], s_['b'][3])
        b0, b1 = (p['b'][0], p['b'][2]) if v else (p['b'][1], p['b'][3])
        return min(a1, b1) - max(a0, b0) > -1
    meroleges = lambda s_: abs(s_['y'] - p['y']) if v else abs(s_['x'] - p['x'])
    kozel = sorted([s_ for s_ in szamok if id(s_) not in hasznalt and atfed(s_) and meroleges(s_) < 20], key=meroleges)[:2]
    if len(kozel) < 2: continue
    for s_ in kozel: hasznalt.add(id(s_))
    szel, mag = par(kozel, kozel[0]['dir'])
    feliratok.append({'szel': szel, 'mag': mag, 'pm': int(pm_minta.match(p['t']).group(1)), 'x': (kozel[0]['x'] + kozel[1]['x']) / 2, 'y': (kozel[0]['y'] + kozel[1]['y']) / 2})
# P nélküli párok (ajtók): két egymás melletti szám, a második ≥ 200 (magasság)
for s1 in szamok:
    if id(s1) in hasznalt: continue
    jel = [s2 for s2 in szamok if s2 is not s1 and id(s2) not in hasznalt and s2['dir'] == s1['dir'] and abs(s2['x'] - s1['x']) + abs(s2['y'] - s1['y']) < 9]
    if not jel: continue
    s2 = min(jel, key=lambda s_: abs(s_['x'] - s1['x']) + abs(s_['y'] - s1['y']))
    szel, mag = par([s1, s2], s1['dir'])
    if mag < 230 or szel > 200: continue
    hasznalt.add(id(s1)); hasznalt.add(id(s2))
    feliratok.append({'szel': szel, 'mag': mag, 'pm': None, 'x': (s1['x'] + s2['x']) / 2, 'y': (s1['y'] + s2['y']) / 2})

# --- feliratok hozzárendelése a legközelebbi külső falszakaszhoz
pontok = []
for idx in range(1, nsz):
    for j in range(4):
        for (y, x) in falszakasz[idx][j][::3]: pontok.append((y, x, idx, j))
P_ = np.array([(p_[0], p_[1]) for p_ in pontok], float)
nyilasok = []
for f in feliratok:
    fy, fx = f['y'] * PT, f['x'] * PT
    dd = np.hypot(P_[:, 0] - fy, P_[:, 1] - fx); i = int(np.argmin(dd))
    if dd[i] > 60: continue
    _, _, idx, j = pontok[i]
    fajta = 'ablak' if f['pm'] is not None and f['pm'] > 0 else 'erkelyajto'
    nyilasok.append({'szoba': idx, 'irany': list(IRANY)[j], 'fajta': fajta, 'szel': f['szel'] / 100, 'mag': f['mag'] / 100, 'pm': f['pm'] / 100 if f['pm'] is not None else None})

# --- lakások összeállítása, sorszám: épületenként (fentről lefelé, balról jobbra)
ep_lab, _ = nd.label(~kulso)
ki = []
for li, L in enumerate(lakasok, 1):
    m = lak == li
    ys, xs = np.nonzero(m)
    ep = int(np.bincount(ep_lab[ys, xs]).argmax())
    szobak = [i for i in range(1, nsz) if lakas_of_szoba[i] == li]
    szobak.sort(key=lambda i: -terulet[i])
    hely = []
    for n_, i in enumerate(szobak):
        hely.append({'nev': f'Helyiség {n_ + 1}', 'A': round(float(terulet[i]), 2),
                     'falak': [{'irany': ir, 'hossz': round(float((falpx[i, j] + 2 * K) * PX), 2)} for j, ir in enumerate(IRANY) if falpx[i, j] > 20]})
    ny = [dict(n, helyiseg=szobak.index(n['szoba'])) for n in nyilasok if n['szoba'] in szobak]
    for n in ny: del n['szoba']
    ki.append({'ep': ep, 'cy': float(ys.mean()), 'cx': float(xs.mean()), 'x0': int(xs.min()), 'y0': int(ys.min()), 'x1': int(xs.max()), 'y1': int(ys.max()),
               'A': round(sum(h['A'] for h in hely), 2), 'helyisegek': hely, 'nyilasok': ny, 'li': li})
epk = {}
for L in ki: epk.setdefault(L['ep'], []).append(L)
sorrend = sorted(epk, key=lambda e: (np.mean([L['cx'] for L in epk[e]]) > W / 2, min(L['y0'] for L in epk[e])))
vegso = []
for e_n, e in enumerate(sorrend, 1):
    for L in sorted(epk[e], key=lambda L: (L['cy'] // 150, L['cx'])):
        vegso.append(L)
terkep = np.zeros(a.shape, np.uint8)
for n_, L in enumerate(vegso, 1):
    terkep[nd.binary_dilation(lak == L['li'], structure=np.ones((9, 9)))] = n_
    L['n'] = n_; L['epulet'] = sorrend.index(L['ep']) + 1
# a mintalap szürke képének méretére (2 képpont / pt)
kw, kh = round(W * 144 / 300), round(H * 144 / 300)
Image.fromarray(terkep).resize((kw, kh), Image.NEAREST).save(f'tipusalaprajz_{nev}_lakasok.png', optimize=True)
s_ = 144 / 300
out = {'forras': f'tipusalaprajz_{nev}.pdf, 2. oldal (1:200)', 'lakasok': [
    {'n': L['n'], 'epulet': L['epulet'], 'A': L['A'], 'doboz': [round(L['x0'] * s_), round(L['y0'] * s_), round(L['x1'] * s_), round(L['y1'] * s_)],
     'kozep': [round(L['cx'] * s_), round(L['cy'] * s_)], 'helyisegek': L['helyisegek'], 'nyilasok': L['nyilasok']} for L in vegso]}
json.dump(out, open(f'tipusalaprajz_{nev}.json', 'w'), ensure_ascii=False, indent=0)
print(len(vegso), 'lakás', len(feliratok), 'felirat', len(nyilasok), 'külső nyílás')
for L in vegso:
    print(L['n'], 'ép', L['epulet'], L['A'], 'm²', len(L['helyisegek']), 'hely', 'falak', {ir: round(sum(f['hossz'] for h in L['helyisegek'] for f in h['falak'] if f['irany'] == ir), 2) for ir in IRANY}, 'nyílások', [(n['fajta'][0], int(n['szel']*100), int(n['mag']*100), n['irany']) for n in L['nyilasok']])
# --- ellenőrző kép
dbg = np.stack([a, a, a], -1).astype(np.uint8)
dbg[kulso] = (dbg[kulso] * 0.6 + np.array([255, 230, 180]) * 0.4).astype(np.uint8)
for idx in range(1, nsz):
    for j in range(4):
        for (y, x) in falszakasz[idx][j]: dbg[max(y-3,0):y+3, max(x-3,0):x+3] = (220, 0, 0)
for f in feliratok:
    y, x = int(f['y'] * PT), int(f['x'] * PT); dbg[y-8:y+8, x-8:x+8] = (0, 0, 255) if f['pm'] is not None else (0, 160, 0)
Image.fromarray(dbg).resize((W // 2, H // 2)).save(f'{nev}_dbg.png')
if len(sys.argv) > 2:
    for f in feliratok:
        if f['x'] < 240 and f['y'] < 250: print('F', round(f['x']), round(f['y']), f['szel'], f['mag'], f['pm'])
if len(sys.argv) > 2:
    for f in feliratok:
        if f['x'] < 240 and f['y'] < 250:
            fy, fx = f['y'] * PT, f['x'] * PT
            dd = np.hypot(P_[:, 0] - fy, P_[:, 1] - fx); i = int(np.argmin(dd))
            print('N', round(fx), round(fy), pontok[i], round(dd[i]))
if len(sys.argv) > 2:
    print('szoba8 lakas', lakas_of_szoba[8], 'szoba3', lakas_of_szoba[3], 'szoba1', lakas_of_szoba[1], [ (L['n'], L['li']) for L in vegso][:5])
    print([n for n in nyilasok if n['szoba'] in (1,2,3,8)])
