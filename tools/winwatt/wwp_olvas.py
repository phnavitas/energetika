"""WinWatt projektfájl (8.x) elemkinyerés (heurisztikus): [hossz, magasság, felület, nyílásfelület, U] f32 (felület = darab × hossz × magasság), utána f32, azimut u16, dőlés u16. Használat: python3 wwp_olvas.py <projektfájl>"""
import sys,struct,re,json
def nev_elotte(b,i):
  # a legközelebbi megelőző „2d 01 ll 00 nn 00 <utf8>” szerkezetnév
  j=b.rfind(b'\x2d\x01',max(0,i-400),i)
  while j>=0:
    l,n=struct.unpack_from('<HH',b,j+2)
    if 0<n<80 and n+2<=l:
      try: return b[j+6:j+6+n].decode('utf-8')
      except: pass
    j=b.rfind(b'\x2d\x01',max(0,i-400),j)
  return None
def elemek(b):
  out=[]
  for i in range(0,len(b)-28):
    L,H,A,N,U=struct.unpack_from('<5f',b,i)
    if not (0.05<L<300 and 0.05<H<30 and A>0.01 and 0<=U<10 and -0.01<=N<=A+0.01): continue
    k=round(A/(L*H))
    if k<1 or k>60 or abs(A-k*L*H)>0.003*A+0.002: continue
    az,dl=struct.unpack_from('<HH',b,i+24)
    if az>=360 or dl>180: continue
    out.append(dict(off=i,L=round(L,3),H=round(H,3),db=k,A=round(A,3),ny=round(N,3),U=round(U,3),az=az,dol=dl,nev=(nev_elotte(b,i) or '').rstrip('\x00')))
  return out
if __name__=='__main__':
  for e in elemek(open(sys.argv[1],'rb').read()): print(hex(e['off']),e['nev'],e['L'],e['H'],e['A'],e['ny'],e['U'],e['az'],e['dol'])
