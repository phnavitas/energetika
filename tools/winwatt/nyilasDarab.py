"""Nyílászárók darabonkénti összevetése: a WinWatt-elemlista (minta/mNN_elemek.json) és a Navitherm tervből felismert
projektje (PJ/mNN.json). Méret szerint (5 cm-re kerekítve, szélesség × magasság) darabszám, és a különbség tételesen:
melyik méretből hány darab hiányzik / több nálunk; tájolással."""
import os, re, json, glob, sys
from collections import Counter
PJ = os.environ.get('PJ', '/root/wwteszt/proj/')
MINTA = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'minta')
MAP = {os.path.basename(f)[:3]: [f] for f in sorted(glob.glob(MINTA + '/m*_elemek.json'))}
for fo, al in {'m08': ['m09', 'm10']}.items():
  if fo in MAP:
    for a in al:
      if a in MAP: MAP[fo] += MAP.pop(a)
EG = {0: 'É', 45: 'ÉK', 90: 'K', 135: 'DK', 180: 'D', 225: 'DNy', 270: 'Ny', 315: 'ÉNy'}
NY = re.compile(r'ablak|ajtó|nyílászáró|függöny|kapu|üveg|bejárat|terasz', re.I)
k5 = lambda v: round(v * 20) / 20
csak = sys.argv[1:]
for m, z in MAP.items():
  if csak and m not in csak: continue
  if not os.path.exists(f'{PJ}{m}.json'): continue
  e = [x for f in z for x in json.load(open(f))['elemek']]
  ny = [x for x in e if x['dol'] >= 30 and NY.search(x['nev']) and not re.match(r'FÖ|PA|TE\b', x['nev']) and not re.search('födém|tetőterasz', x['nev'], re.I)]
  p = json.load(open(f'{PJ}{m}.json'))
  NYT = {n['id']: n for n in p['nyilaszarok']}
  ww, mi = Counter(), Counter()
  wwT, miT = {}, {}
  for x in ny:
    # WinWatt: L × H, db; a szélesség és magasság sorrendje a mérethez kötött
    kk = (k5(x['L']), k5(x['H'])); ww[kk] += x['db']; wwT.setdefault(kk, Counter())[EG.get(x['az'], x['az'])] += x['db']
  for s in p['feluletek']:
    if s['fajta'] != 'nyilaszaro': continue
    n = NYT[s['nyilaszaroId']]; kk = (k5(n['szelesseg']), k5(n['magassag'])); db = s.get('darab', 1)
    mi[kk] += db; miT.setdefault(kk, Counter())[s.get('tajolas') or '?'] += db
  print(f'== {m}  WW {sum(ww.values())} db {sum(k[0]*k[1]*v for k,v in ww.items()):.1f} m²  ·  mi {sum(mi.values())} db {sum(k[0]*k[1]*v for k,v in mi.items()):.1f} m²')
  # tételes párosítás: azonos méret; utána a maradékból a ≤ 15 cm-rel eltérő méretpárok (méreteltérés, nem hiány)
  maradW, maradM = ww.copy(), mi.copy()
  for kk in list(maradW):
    c = min(maradW[kk], maradM[kk]); maradW[kk] -= c; maradM[kk] -= c
  elteres = []
  for a in sorted([k for k in maradW if maradW[k] > 0], key=lambda q: -q[0] * q[1]):
    for b in sorted([k for k in maradM if maradM[k] > 0], key=lambda q: abs(q[0] - a[0]) + abs(q[1] - a[1])):
      if abs(b[0] - a[0]) <= 0.15 and abs(b[1] - a[1]) <= 0.15:
        c = min(maradW[a], maradM[b]); elteres.append((a, b, c)); maradW[a] -= c; maradM[b] -= c
        if not maradW[a]: break
  ossz = lambda C: sum(k[0] * k[1] * v for k, v in C.items() if v > 0)
  print(f'  egyező {sum(min(ww[k], mi[k]) for k in ww)} db · méreteltérés {sum(c for *_, c in elteres)} db · hiányzik {sum(v for v in maradW.values() if v > 0)} db ({ossz(maradW):.2f} m²) · több {sum(v for v in maradM.values() if v > 0)} db ({ossz(maradM):.2f} m²)')
  for a, b, c in elteres: print(f'    méret: WW {int(a[0]*100)}×{int(a[1]*100)} ↔ mi {int(b[0]*100)}×{int(b[1]*100)}  {c} db')
  for kk, v in maradW.items():
    if v > 0: print(f'    HIÁNYZIK {v} db {int(kk[0]*100)}×{int(kk[1]*100)} [{" ".join(f"{a}:{b}" for a, b in wwT[kk].items())}]')
  for kk, v in maradM.items():
    if v > 0: print(f'    TÖBB     {v} db {int(kk[0]*100)}×{int(kk[1]*100)} [{" ".join(f"{a}:{b}" for a, b in miT[kk].items())}]')
  if not os.environ.get('TETEL'): continue
  for kk in sorted(set(ww) | set(mi), key=lambda q: -q[0] * q[1]):
    a, b = ww[kk], mi[kk]
    jel = '' if a == b else (f'  hiányzik {a-b} db ({(a-b)*kk[0]*kk[1]:.2f} m²)' if a > b else f'  több {b-a} db ({(b-a)*kk[0]*kk[1]:.2f} m²)')
    t = lambda T: ' '.join(f'{k}:{v}' for k, v in sorted((T.get(kk) or {}).items()))
    print(f'  {int(kk[0]*100):4d}×{int(kk[1]*100):<4d} WW {a:3d} [{t(wwT):18s}]  mi {b:3d} [{t(miT):18s}]{jel}')
