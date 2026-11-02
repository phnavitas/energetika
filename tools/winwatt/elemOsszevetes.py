"""Elemszintű összevetés: a WinWatt-projektfájlból kinyert elemlista (minta/mNN_elemek.json) és a Navitherm tervből
felismert projektje (PJ könyvtár, mNN.json): falhossz, falmagasság, nyílásfelület égtájanként."""
import sys,json,glob,re
import os
PJ=os.environ.get('PJ','/root/wwteszt/proj/')
MINTA=os.path.join(os.path.dirname(os.path.abspath(__file__)),'minta')
MAP={os.path.basename(f)[:3]:[f] for f in sorted(glob.glob(MINTA+'/m*_elemek.json'))}
# egy tervlapon több tanúsítvány (sorház A/B/C lakás): a terv projektje a lakások együttesével vethető össze
for fo,al in {'m08':['m09','m10']}.items():
  if fo in MAP:
    for a in al:
      if a in MAP: MAP[fo]+=MAP.pop(a)
EG={0:'É',45:'ÉK',90:'K',135:'DK',180:'D',225:'DNy',270:'Ny',315:'ÉNy'}
NY=re.compile(r'ablak|ajtó|nyílászáró|függöny|kapu|üveg|bejárat|terasz',re.I)
FAL=re.compile(r'fal|falazat',re.I)
for m,z in MAP.items():
  e=[x for f in z for x in json.load(open(f))['elemek']]
  if not os.path.exists(f'{PJ}{m}.json'): continue
  fal=[x for x in e if x['dol']==90 and FAL.search(x['nev']) and not NY.search(x['nev']) and not re.search('fűtött tér|pince|terepszint',x['nev'],re.I)]
  # nyílászáró: a tetősík ablak (ferde) is; a „tetőterasz” nevű födém nem
  ny=[x for x in e if x['dol']>=30 and NY.search(x['nev']) and not re.match(r'FÖ|PA|TE\b',x['nev']) and not re.search('födém|tetőterasz',x['nev'],re.I)]
  p=json.load(open(f'{PJ}{m}.json'))
  NYT={n['id']:n for n in p['nyilaszarok']}
  for s in p['feluletek']:
    if s['fajta']=='nyilaszaro': n=NYT[s['nyilaszaroId']]; s['A']=n['szelesseg']*n['magassag']*s.get('darab',1)
  mf=[s for s in p['feluletek'] if s['nev'].startswith('Homlokzati fal')]
  mny=[s for s in p['feluletek'] if s['fajta']=='nyilaszaro' and s.get('hatar')=='kulso']
  WL=sum(x['L']*x['db'] for x in fal); WA=sum(x['A']-x['ny'] for x in fal); WNY=sum(x['A'] for x in ny)
  ML=sum(s['meret']['hossz'] for s in mf); MA=sum(s['A'] for s in mf); MNY=sum(s['A'] for s in mny)
  pct=lambda a,b: f"{(b-a)/a*100:+.1f}%" if a else '-'
  print(f"== {m}")
  print(f"  falhossz  WW {WL:7.1f}  mi {ML:7.1f}  {pct(WL,ML)}   magasság WW {sorted({x['H'] for x in fal})} mi {sorted({s['meret']['magassag'] for s in mf})}")
  print(f"  nettó fal WW {WA:7.1f}  mi {MA-MNY:7.1f}  {pct(WA,MA-MNY)}")
  print(f"  nyílás    WW {WNY:7.1f}  mi {MNY:7.1f}  {pct(WNY,MNY)}   db WW {sum(x['db'] for x in ny)} mi {sum(s.get('darab',1) for s in mny)}")
  o={}
  for x in ny: o.setdefault(EG.get(x['az'],x['az']),[0,0])[0]+=x['A']
  for s in mny: o.setdefault(s.get('tajolas') or '?',[0,0])[1]+=s['A']
  # tájolás-egyezés: az égtájanként közös felület a kisebbik összfelülethez viszonyítva (az összfelület eltérését nem bünteti)
  kozos=sum(min(a,b) for a,b in o.values()); kisebb=min(WNY,MNY)
  print(f"  tájolás-egyezés {kozos/kisebb*100:5.1f}%" if kisebb else "  tájolás-egyezés -")
  print('   ', '  '.join(f"{k}: {a:.1f}/{b:.1f}" for k,(a,b) in sorted(o.items(),key=lambda kv:str(kv[0]))))
