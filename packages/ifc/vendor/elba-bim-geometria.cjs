/* ============================================================================
   ELBA — BIM GEOMETRIA
   ----------------------------------------------------------------------------
   Az IFC-ből HÁROMSZÖGEKET csinál, elemenként. Ez teszi lehetővé, hogy a
   párosítás eredménye a MODELLEN látszódjon: mit soroltunk be és mit nem.

   MIÉRT ÍRJUK MAGUNK: a kész IFC-nézők (web-ifc, IFC.js) 5-7 MB WebAssembly-t
   húznak be, és teljes geometriai motort futtatnak — nekünk viszont csak a
   HÁROMSZÖGEK kellenek, azok pedig az Archicad exportjában készen állnak.
   Ez a modell 589 test-ábrázolásból, 78 000 lapból és 136 000 pontból áll:
   sima adatátalakítás, nem geometria-számítás.

   MIT TUD ÉS MIT NEM
     · IfcFacetedBrep és IfcShellBasedSurfaceModel — ezekből áll az Archicad
       exportjának 95%-a. A lapok síkbeli sokszögek: 4 csúcsig legyezővel, fölötte
       fülvágással háromszögeljük (a homorú lap is helyes).
     · IfcMappedItem — az ismétlődő tárgyak (bútor, nyílászáró) egy közös
       ábrázolásra hivatkoznak, saját elhelyezéssel.
     · IfcExtrudedAreaSolid — igen (2026-10-04): téglalap, kör és tetszőleges
       (törtvonalas / ívekkel összetett) profil, ferde iránnyal is; a nyílásokat
       nem vágjuk ki. Az Archicad alap IFC-fordítója a falat, födémet így adja.

   PONTOSSÁG: a modell koordinátái tengerszint felettiek is lehetnek
   (a mintában 89 méter), ami float32-ben már látható remegést okoz. Ezért a
   befoglaló KÖZÉPPONTJÁT kivonjuk, és onnan nézzük a házat.

   KIMENET (átadható pufferek, hogy a workerből ingyen jöjjön át):
     { eltolas:[x,y,z], meret:r,
       elemek:[{gid, kezd, db, szin}],    // melyik elem hol van, és mi a valódi színe
       poz:Float32Array,  norm:Float32Array }
   ========================================================================== */
(function(gyoker){
'use strict';

const O=gyoker.ElbaBimOlvaso;

function tipus(R,id){ const a=R.tS[id]; return a===undefined?null:R.sz.slice(a,R.tE[id]); }

/* --- 4×4 mátrix, oszlopfolytonos ------------------------------------------ */
function egyseg(){ return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; }
function szoroz(a,b){                      // a·b
  const k=new Array(16);
  for(let i=0;i<4;i++) for(let j=0;j<4;j++){
    let s=0; for(let n=0;n<4;n++) s+=a[n*4+j]*b[i*4+n];
    k[i*4+j]=s; }
  return k;
}
function pontra(m,x,y,z){
  return [m[0]*x+m[4]*y+m[8]*z+m[12],
          m[1]*x+m[5]*y+m[9]*z+m[13],
          m[2]*x+m[6]*y+m[10]*z+m[14]];
}
const kereszt=(a,b)=>[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
function egysegre(v){ const h=Math.hypot(v[0],v[1],v[2])||1; return [v[0]/h,v[1]/h,v[2]/h]; }

/* IfcAxis2Placement3D → mátrix. Az Axis a Z, a RefDirection az X; az Y a
   kettő keresztszorzata. Ha hiányoznak, a világ tengelyei érvényesek. */
function helyzetMatrix(R,id,H){
  const p=O._bont(R,id);
  let O0=[0,0,0], Z=[0,0,1], X=[1,0,0];
  if(p[0]&&p[0].r){ const c=O._bont(R,p[0].r)[0];
    if(Array.isArray(c)) O0=[(c[0]||0)*H,(c[1]||0)*H,(c[2]||0)*H]; }
  if(p[1]&&p[1].r){ const d=O._bont(R,p[1].r)[0]; if(Array.isArray(d)) Z=egysegre([d[0]||0,d[1]||0,d[2]||0]); }
  if(p[2]&&p[2].r){ const d=O._bont(R,p[2].r)[0]; if(Array.isArray(d)) X=egysegre([d[0]||0,d[1]||0,d[2]||0]); }
  /* X-et merőlegesítjük Z-re (Gram–Schmidt), különben ferde lesz a doboz. */
  const vet=X[0]*Z[0]+X[1]*Z[1]+X[2]*Z[2];
  X=egysegre([X[0]-vet*Z[0], X[1]-vet*Z[1], X[2]-vet*Z[2]]);
  const Y=kereszt(Z,X);
  return [X[0],X[1],X[2],0, Y[0],Y[1],Y[2],0, Z[0],Z[1],Z[2],0, O0[0],O0[1],O0[2],1];
}
/* IfcLocalPlacement lánc — a gyerek a szülő rendszerében van megadva. */
function elhelyezes(R,id,H,gyorsito,melyseg){
  if(!id) return egyseg();
  if(gyorsito.has(id)) return gyorsito.get(id);
  if((melyseg||0)>24) return egyseg();
  const t=tipus(R,id);
  let m=egyseg();
  if(t==='IFCLOCALPLACEMENT'){
    const p=O._bont(R,id);
    const sajat=(p[1]&&p[1].r)?helyzetMatrix(R,p[1].r,H):egyseg();
    const szulo=(p[0]&&p[0].r)?elhelyezes(R,p[0].r,H,gyorsito,(melyseg||0)+1):egyseg();
    m=szoroz(szulo,sajat);
  } else if(t==='IFCAXIS2PLACEMENT3D'){ m=helyzetMatrix(R,id,H); }
  gyorsito.set(id,m);
  return m;
}
/* IfcCartesianTransformationOperator3D — a MappedItem célhelye. */
function transzMatrix(R,id,H){
  const p=O._bont(R,id);
  const ir=r=>{ if(!r||!r.r) return null; const d=O._bont(R,r.r)[0];
    return Array.isArray(d)?egysegre([d[0]||0,d[1]||0,d[2]||0]):null; };
  let X=ir(p[0])||[1,0,0], Y=ir(p[1])||null, Z=ir(p[4])||null;
  let O0=[0,0,0];
  if(p[2]&&p[2].r){ const c=O._bont(R,p[2].r)[0];
    if(Array.isArray(c)) O0=[(c[0]||0)*H,(c[1]||0)*H,(c[2]||0)*H]; }
  const s=(typeof p[3]==='number'&&p[3])?p[3]:1;
  if(!Z) Z=Y?kereszt(X,Y):[0,0,1];
  if(!Y) Y=kereszt(Z,X);
  return [X[0]*s,X[1]*s,X[2]*s,0, Y[0]*s,Y[1]*s,Y[2]*s,0, Z[0]*s,Z[1]*s,Z[2]*s,0, O0[0],O0[1],O0[2],1];
}

/* --- lapok begyűjtése ----------------------------------------------------- */
/* Egy IfcPolyLoop pontjai világkoordinátában, háromszögelve.
   A négyszögnél és a háromszögnél a legyező is helyes. A NAGYOBB lap viszont
   gyakran homorú (L alakú vagy kivágott födém, csorba sarok): a legyező ott a
   lapon KÍVÜL eső háromszögeket rajzol, és a bemélyedést „átvágja" (2026-10-04,
   Balázs: „a negatív saroknál geom probléma van"). Ezért 4 csúcs fölött
   fülvágással háromszögelünk, a lap síkjára vetítve. */
function haromszogel2D(q){
  /* q: [[x,y],…] — visszaad: indexhármasok. Fülvágás (ear clipping). */
  const n=q.length, ki=[];
  let ter=0; for(let i=0;i<n;i++){ const a=q[i], b=q[(i+1)%n]; ter+=a[0]*b[1]-b[0]*a[1]; }
  const idx=[]; for(let i=0;i<n;i++) idx.push(i);
  if(ter<0) idx.reverse();                       // óramutatóval ellentétes körüljárás
  const ker=(a,b,c)=>(q[b][0]-q[a][0])*(q[c][1]-q[a][1])-(q[b][1]-q[a][1])*(q[c][0]-q[a][0]);
  const benne=(p,a,b,c)=>{ const d1=ker(a,b,p), d2=ker(b,c,p), d3=ker(c,a,p);
    return d1>=-1e-12&&d2>=-1e-12&&d3>=-1e-12; };
  let vedo=0;
  while(idx.length>3&&vedo<n*n){
    vedo++; let vagott=false;
    for(let i=0;i<idx.length;i++){
      const a=idx[(i+idx.length-1)%idx.length], b=idx[i], c=idx[(i+1)%idx.length];
      if(ker(a,b,c)<=1e-14) continue;              // homorú csúcs
      let ures=true;
      for(const j of idx){ if(j===a||j===b||j===c) continue;
        if(benne(j,a,b,c)){ ures=false; break; } }
      if(!ures) continue;
      ki.push(ter<0?[c,b,a]:[a,b,c]); idx.splice(i,1); vagott=true; break;
    }
    if(!vagott) break;                             // elfajult lap — a maradék legyezővel
  }
  if(idx.length>=3) for(let i=1;i+1<idx.length;i++)
    ki.push(ter<0?[idx[i+1],idx[i],idx[0]]:[idx[0],idx[i],idx[i+1]]);
  return ki;
}
function hurok(R,id,m,H,ki){
  const p=O._bont(R,id);
  const lista=p[0]; if(!Array.isArray(lista)||lista.length<3) return;
  const pt=[];
  for(const c of lista){ if(!c||!c.r) continue;
    const q=O._bont(R,c.r)[0]; if(!Array.isArray(q)) continue;
    const v=pontra(m,(q[0]||0)*H,(q[1]||0)*H,(q[2]||0)*H);
    const e=pt[pt.length-1];
    if(e&&Math.abs(e[0]-v[0])<1e-9&&Math.abs(e[1]-v[1])<1e-9&&Math.abs(e[2]-v[2])<1e-9) continue;
    pt.push(v); }
  if(pt.length>3){ const a=pt[0], z=pt[pt.length-1];
    if(Math.abs(a[0]-z[0])<1e-9&&Math.abs(a[1]-z[1])<1e-9&&Math.abs(a[2]-z[2])<1e-9) pt.pop(); }
  if(pt.length<3) return;
  const tri=(a,b,c)=>{
    const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]], v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
    const n=egysegre(kereszt(u,v));
    ki.poz.push(a[0],a[1],a[2], b[0],b[1],b[2], c[0],c[1],c[2]);
    ki.norm.push(n[0],n[1],n[2], n[0],n[1],n[2], n[0],n[1],n[2]); };
  if(pt.length<=4){ for(let i=1;i+1<pt.length;i++) tri(pt[0],pt[i],pt[i+1]); return; }
  /* Newell-normális → a domináns tengelyt elhagyva síkba vetítünk. */
  let nx=0,ny=0,nz=0;
  for(let i=0;i<pt.length;i++){ const a=pt[i], b=pt[(i+1)%pt.length];
    nx+=(a[1]-b[1])*(a[2]+b[2]); ny+=(a[2]-b[2])*(a[0]+b[0]); nz+=(a[0]-b[0])*(a[1]+b[1]); }
  const ax=Math.abs(nx), ay=Math.abs(ny), az=Math.abs(nz);
  const q=pt.map(v=>az>=ax&&az>=ay?[v[0],v[1]]:(ax>=ay?[v[1],v[2]]:[v[2],v[0]]));
  for(const [a,b,c] of haromszogel2D(q)) tri(pt[a],pt[b],pt[c]);
}
/* --- EXTRÚDÁLT TEST (IfcExtrudedAreaSolid) ---------------------------------
   2026-10-04: az Archicad alap IFC-fordítója (nem az ELBA-beállítás) a falat, a
   födémet, a gerendát „SweptSolid"-ként adja: profil + irány + mélység. Eddig ezek
   kimaradtak a nézetből (Ruff, Győrújbarát: az elemek nagy része). A profilt a
   síkban sokszöggé alakítjuk, az alját és a tetejét fülvágással, az oldalát
   négyszögekből rakjuk össze. A nyílásokat nem vágjuk ki (a besorolás
   láthatóságához nem kell). */
function pont2D(R,id,H){ const q=O._bont(R,id)[0]; return Array.isArray(q)?[(q[0]||0)*H,(q[1]||0)*H]:null; }
function helyzet2Dm(R,id,H){                       // IfcAxis2Placement2D → [ox,oy,cx,cy]
  if(!id) return [0,0,1,0];
  const p=O._bont(R,id); let o=[0,0], c=1, sn=0;
  if(p[0]&&p[0].r){ const v=pont2D(R,p[0].r,H); if(v) o=v; }
  if(p[1]&&p[1].r){ const d=O._bont(R,p[1].r)[0]; if(Array.isArray(d)){ const h=Math.hypot(d[0]||0,d[1]||0)||1; c=(d[0]||0)/h; sn=(d[1]||0)/h; } }
  return [o[0],o[1],c,sn];
}
function gorbePontok(R,id,H,m){                    // görbe → 2D pontsor (ív: húr)
  if((m||0)>8||!id) return [];
  const t=tipus(R,id), p=O._bont(R,id);
  if(t==='IFCPOLYLINE'){ const ki=[]; for(const c of (p[0]||[])) if(c&&c.r){ const v=pont2D(R,c.r,H); if(v) ki.push(v); } return ki; }
  if(t==='IFCCOMPOSITECURVE'){ const ki=[];
    for(const sg of (p[0]||[])){ if(!sg||!sg.r) continue; const q=O._bont(R,sg.r);
      let l=gorbePontok(R,q[2]&&q[2].r,H,(m||0)+1); if(q[1]===false||q[1]==='.F.') l=l.slice().reverse();
      for(const v of l){ const e=ki[ki.length-1]; if(!e||Math.hypot(e[0]-v[0],e[1]-v[1])>1e-9) ki.push(v); } }
    return ki; }
  if(t==='IFCTRIMMEDCURVE'){ const ki=[];
    const pt=x=>{ for(const y of (Array.isArray(x)?x:[])) if(y&&y.r&&tipus(R,y.r)==='IFCCARTESIANPOINT') return pont2D(R,y.r,H); return null; };
    const a=pt(p[1]), b=pt(p[2]);
    const alap=p[0]&&p[0].r, at=alap?tipus(R,alap):null;
    if(at==='IFCCIRCLE'&&a&&b){                     // ív: közbülső pontok a körön
      const cp=O._bont(R,alap); const [ox,oy]=helyzet2Dm(R,cp[0]&&cp[0].r,H); const r=(cp[1]||0)*H;
      let a1=Math.atan2(a[1]-oy,a[0]-ox), a2=Math.atan2(b[1]-oy,b[0]-ox);
      const egyir=!(p[3]===false||p[3]==='.F.');
      if(egyir){ while(a2<=a1) a2+=2*Math.PI; } else { while(a2>=a1) a2-=2*Math.PI; }
      const n=Math.max(2,Math.ceil(Math.abs(a2-a1)/(Math.PI/12)));
      for(let i=0;i<=n;i++){ const u=a1+(a2-a1)*i/n; ki.push([ox+r*Math.cos(u),oy+r*Math.sin(u)]); }
      return ki; }
    if(a) ki.push(a); if(b) ki.push(b);
    if(!ki.length&&alap) return gorbePontok(R,alap,H,(m||0)+1);
    return ki; }
  return [];
}
function profilPontok(R,id,H){
  const t=tipus(R,id), p=O._bont(R,id);
  let pts=[], hely=null;
  if(t==='IFCRECTANGLEPROFILEDEF'||t==='IFCRECTANGLEHOLLOWPROFILEDEF'){
    const x=(p[3]||0)*H/2, y=(p[4]||0)*H/2; pts=[[-x,-y],[x,-y],[x,y],[-x,y]]; hely=p[2]&&p[2].r; }
  else if(t==='IFCCIRCLEPROFILEDEF'||t==='IFCCIRCLEHOLLOWPROFILEDEF'){
    const r=(p[3]||0)*H; for(let i=0;i<16;i++){ const u=i*Math.PI/8; pts.push([r*Math.cos(u),r*Math.sin(u)]); } hely=p[2]&&p[2].r; }
  else if(t==='IFCARBITRARYCLOSEDPROFILEDEF'||t==='IFCARBITRARYPROFILEDEFWITHVOIDS'){
    pts=gorbePontok(R,p[2]&&p[2].r,H,0); }
  else return null;
  if(pts.length>1){ const a=pts[0], z=pts[pts.length-1]; if(Math.hypot(a[0]-z[0],a[1]-z[1])<1e-9) pts.pop(); }
  if(pts.length<3) return null;
  if(hely){ const [ox,oy,c,sn]=helyzet2Dm(R,hely,H); pts=pts.map(([x,y])=>[ox+c*x-sn*y, oy+sn*x+c*y]); }
  return pts;
}
function haromszogKi(ki,a,b,c){
  const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]], v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
  const n=egysegre(kereszt(u,v));
  ki.poz.push(a[0],a[1],a[2], b[0],b[1],b[2], c[0],c[1],c[2]);
  ki.norm.push(n[0],n[1],n[2], n[0],n[1],n[2], n[0],n[1],n[2]);
}
function extrudalt(R,id,m,H,ki){
  const p=O._bont(R,id);
  const pts=p[0]&&p[0].r?profilPontok(R,p[0].r,H):null; if(!pts) return;
  const mm=(p[1]&&p[1].r)?szoroz(m,helyzetMatrix(R,p[1].r,H)):m;
  let d=[0,0,1]; if(p[2]&&p[2].r){ const q=O._bont(R,p[2].r)[0]; if(Array.isArray(q)) d=egysegre([q[0]||0,q[1]||0,q[2]||0]); }
  const h=(typeof p[3]==='number'?p[3]:0)*H; if(!h) return;
  const also=pts.map(([x,y])=>pontra(mm,x,y,0)), felso=pts.map(([x,y])=>pontra(mm,x+d[0]*h,y+d[1]*h,d[2]*h));
  const tri=haromszogel2D(pts);
  for(const [a,b,c] of tri){ haromszogKi(ki,felso[a],felso[b],felso[c]); haromszogKi(ki,also[c],also[b],also[a]); }
  /* az oldalak: a körüljárás iránya szerint kifelé néző normálissal */
  let ter=0; for(let i=0;i<pts.length;i++){ const a=pts[i], b=pts[(i+1)%pts.length]; ter+=a[0]*b[1]-b[0]*a[1]; }
  for(let i=0;i<pts.length;i++){ const j=(i+1)%pts.length;
    if(ter>=0){ haromszogKi(ki,also[i],also[j],felso[j]); haromszogKi(ki,also[i],felso[j],felso[i]); }
    else { haromszogKi(ki,also[j],also[i],felso[i]); haromszogKi(ki,also[j],felso[i],felso[j]); } }
}
function lapok(R,id,m,H,ki,melyseg){
  if((melyseg||0)>12) return;
  const t=tipus(R,id); if(!t) return;
  const p=O._bont(R,id);
  if(t==='IFCFACE'||t==='IFCFACESURFACE'){
    for(const b of (p[0]||[])){ if(!b||!b.r) continue;
      const bt=tipus(R,b.r);
      /* A BELSŐ határok (lyukak) kimaradnak: a nézethez nem kell lyuk, és
         legyezővel úgysem lehetne helyesen kivágni. */
      if(bt==='IFCFACEBOUND') continue;
      const bp=O._bont(R,b.r);
      if(bp[0]&&bp[0].r&&tipus(R,bp[0].r)==='IFCPOLYLOOP') hurok(R,bp[0].r,m,H,ki);
    }
    return;
  }
  if(t==='IFCCLOSEDSHELL'||t==='IFCOPENSHELL'){
    for(const f of (p[0]||[])) if(f&&f.r) lapok(R,f.r,m,H,ki,(melyseg||0)+1);
    return;
  }
  if(ki.stilus&&ki.szin===null&&ki.stilus.has(id)) ki.szin=ki.stilus.get(id);
  if(t==='IFCFACETEDBREP'||t==='IFCADVANCEDBREP'||t==='IFCFACEBASEDSURFACEMODEL'){
    if(p[0]&&p[0].r) lapok(R,p[0].r,m,H,ki,(melyseg||0)+1);
    else for(const sh of (p[0]||[])) if(sh&&sh.r) lapok(R,sh.r,m,H,ki,(melyseg||0)+1);
    return;
  }
  if(t==='IFCSHELLBASEDSURFACEMODEL'){
    for(const sh of (p[0]||[])) if(sh&&sh.r) lapok(R,sh.r,m,H,ki,(melyseg||0)+1);
    return;
  }
  if(t==='IFCMAPPEDITEM'){
    /* A közös ábrázolás a saját rendszerében van; előbb a forrás origója,
       aztán a célhely transzformációja. */
    const forras=p[0]&&p[0].r, cel=p[1]&&p[1].r;
    if(!forras) return;
    const fp=O._bont(R,forras);
    const eredet=(fp[0]&&fp[0].r)?helyzetMatrix(R,fp[0].r,H):egyseg();
    const cm=cel?transzMatrix(R,cel,H):egyseg();
    const m2=szoroz(szoroz(m,cm),eredet);
    if(fp[1]&&fp[1].r) abrazolas(R,fp[1].r,m2,H,ki,(melyseg||0)+1);
    return;
  }
  if(t==='IFCEXTRUDEDAREASOLID'){ extrudalt(R,id,m,H,ki); return; }
  if(t==='IFCBOOLEANCLIPPINGRESULT'||t==='IFCBOOLEANRESULT'){
    /* A kivonást nem végezzük el: az ELSŐ operandust rajzoljuk. A nézetben
       ettől néhány lyuk zárva marad — a besorolás láthatóságát nem érinti.
       A lánc lehet hosszú (Győrújbarát: 24 egymásba ágyazott kivonás egy
       aljzatrétegen), ezért ciklussal megyünk le, nem a mélységkorlátos
       rekurzióval. */
    let x=p[1]&&p[1].r, lep=0;
    while(x&&lep<200){ const tx=tipus(R,x); if(tx!=='IFCBOOLEANCLIPPINGRESULT'&&tx!=='IFCBOOLEANRESULT') break;
      const q=O._bont(R,x); x=q[1]&&q[1].r; lep++; }
    if(x) lapok(R,x,m,H,ki,(melyseg||0)+1);
    return;
  }
}
function abrazolas(R,id,m,H,ki,melyseg){
  const t=tipus(R,id);
  const p=O._bont(R,id);
  if(t==='IFCSHAPEREPRESENTATION'){
    const fajta=p[2];
    if(fajta==='Curve2D'||fajta==='Annotation2D'||fajta==='GeometricCurveSet') return;
    for(const it of (p[3]||[])) if(it&&it.r) lapok(R,it.r,m,H,ki,(melyseg||0)+1);
    return;
  }
  if(t==='IFCPRODUCTDEFINITIONSHAPE'){
    for(const r of (p[2]||[])) if(r&&r.r) abrazolas(R,r.r,m,H,ki,(melyseg||0)+1);
    return;
  }
}

/* --- FELÜLETI SZÍNEK ------------------------------------------------------
   Az Archicad kiírja a felületek valódi színét: IfcStyledItem → stílus-
   hozzárendelés → IfcSurfaceStyle → IfcSurfaceStyleRendering → IfcColourRgb.
   Ebben a modellben 50 felület és 4366 stílus-hivatkozás van, tehát a
   „színezett modell" nem találgatás, hanem a terv saját anyagszínei.
   Elemenként az ELSŐ színezett testet vesszük: egy falréteg, egy ajtótok
   egyszínű, tehát ez pontos; a ritka többszínű testnél a domináns szín nyer. */
function szinTerkep(R){
  const t=id=>tipus(R,id);
  const rgb=id=>{ const p=O._bont(R,id);
    return [parseFloat(p[1]),parseFloat(p[2]),parseFloat(p[3])]; };
  /* rendering → szín */
  const rend=new Map();
  for(const id of R.idLista){
    if(t(id)!=='IFCSURFACESTYLERENDERING') continue;
    const p=O._bont(R,id);
    if(p[0]&&p[0].r&&t(p[0].r)==='IFCCOLOURRGB') rend.set(id,rgb(p[0].r));
  }
  /* felület-stílus → szín */
  const felulet=new Map();
  for(const id of R.idLista){
    if(t(id)!=='IFCSURFACESTYLE') continue;
    for(const x of (O._bont(R,id)[2]||[])) if(x&&x.r&&rend.has(x.r)){ felulet.set(id,rend.get(x.r)); break; }
  }
  /* hozzárendelés → szín */
  const hozza=new Map();
  for(const id of R.idLista){
    if(t(id)!=='IFCPRESENTATIONSTYLEASSIGNMENT') continue;
    for(const x of (O._bont(R,id)[0]||[])) if(x&&x.r&&felulet.has(x.r)){ hozza.set(id,felulet.get(x.r)); break; }
  }
  /* geometriai elem → szín */
  const ki=new Map();
  for(const id of R.idLista){
    if(t(id)!=='IFCSTYLEDITEM') continue;
    const p=O._bont(R,id);
    const cel=p[0]&&p[0].r; if(!cel) continue;
    for(const x of (p[1]||[])){ if(!x||!x.r) continue;
      const c=hozza.get(x.r)||felulet.get(x.r);
      if(c){ ki.set(cel,c); break; } }
  }
  return ki;
}
/* --- fő menet ------------------------------------------------------------- */
const TERMEK=/^IFC(WALL|SLAB|BEAM|COLUMN|COVERING|ROOF|DOOR|WINDOW|STAIR|RAMP|RAILING|PLATE|MEMBER|CURTAINWALL|FOOTING|PILE|BUILDINGELEMENT|FURNISHINGELEMENT|FLOWTERMINAL|DISTRIBUTIONELEMENT|FLOWSEGMENT|FLOWFITTING|TRANSPORTELEMENT|ELEMENTASSEMBLY|DISCRETEACCESSORY|CHIMNEY|SHADINGDEVICE)/;

function epit(sz,opciok){
  opciok=opciok||{};
  const halad=opciok.halad||function(){};
  const H=opciok.hosszSzorzo||0.001;
  const kellenek=opciok.gidk?new Set(opciok.gidk):null;
  halad('geometria',5,'Rekordok…');
  const R=opciok.R||O._rekordok(sz);
  const gyorsito=new Map();
  const elemek=[], poz=[], norm=[];
  const ki={poz,norm,stilus:szinTerkep(R),szin:null};
  const n=R.idLista.length;
  let db=0;
  halad('geometria',15,'Testek háromszögelése…');
  for(let i=0;i<n;i++){
    const id=R.idLista[i];
    const t=tipus(R,id);
    if(!t||!TERMEK.test(t)||/TYPE$|STYLE$/.test(t)) continue;
    const p=O._bont(R,id);
    const gid=typeof p[0]==='string'?p[0]:null;
    if(!gid) continue;
    if(kellenek&&!kellenek.has(gid)) continue;
    const rep=p[6]&&p[6].r; if(!rep) continue;
    const kezd=poz.length/3;
    ki.szin=null;
    const m=elhelyezes(R,(p[5]&&p[5].r)||0,H,gyorsito,0);
    abrazolas(R,rep,m,H,ki,0);
    const hossz=poz.length/3-kezd;
    if(hossz>0) elemek.push({gid,kezd,db:hossz,szin:ki.szin});
    if((++db&255)===0) halad('geometria',15+Math.round(80*i/n),'Testek háromszögelése…');
  }
  halad('geometria',96,'Középre igazítás…');
  /* Középre húzás: a float32 a tengerszint feletti koordinátáktól remegne. */
  let x0=1/0,x1=-1/0,y0=1/0,y1=-1/0,z0=1/0,z1=-1/0;
  for(let i=0;i<poz.length;i+=3){
    if(poz[i]<x0)x0=poz[i]; if(poz[i]>x1)x1=poz[i];
    if(poz[i+1]<y0)y0=poz[i+1]; if(poz[i+1]>y1)y1=poz[i+1];
    if(poz[i+2]<z0)z0=poz[i+2]; if(poz[i+2]>z1)z1=poz[i+2];
  }
  if(!isFinite(x0)){ x0=x1=y0=y1=z0=z1=0; }
  const kx=(x0+x1)/2, ky=(y0+y1)/2, kz=(z0+z1)/2;
  const P=new Float32Array(poz.length), N=new Float32Array(norm.length);
  for(let i=0;i<poz.length;i+=3){
    P[i]=poz[i]-kx; P[i+1]=poz[i+1]-ky; P[i+2]=poz[i+2]-kz;
  }
  N.set(norm);
  const meret=Math.max(x1-x0,y1-y0,z1-z0)||1;
  halad('geometria',100,'Kész.');
  return {eltolas:[kx,ky,kz], meret, elemek, poz:P, norm:N,
          statisztika:{elem:elemek.length, haromszog:P.length/9}};
}

/* MÉRTÉKEK A TESTBŐL (2026-10-04, Balázs: „minden elemnél, ha mennyiségek
   nincsenek bekapcsolva, akkor méretek alapján számoljon"). Az IFC-ben nincs
   mennyiség (IfcElementQuantity), de a test megvan: a háromszögekből
     · térfogat (előjeles tetraéder-összeg),
     · felső / alsó / oldalsó felület (a normális iránya szerint), a felső
       felület vízszintes vetülete,
     · magasság (z kiterjedés), alaprajzi hossz és szélesség (a csúcsok fő
       iránya szerint — ferde falnál, gerendánál is).
   A kivonások (nyílások) nincsenek levonva: ez BRUTTÓ mennyiség. */
function mertekek(sz,opciok){
  opciok=opciok||{};
  const g=epit(sz,{R:opciok.R,hosszSzorzo:opciok.hosszSzorzo,gidk:opciok.gidk});
  const P=g.poz, ki={};
  for(const el of g.elemek){
    let V=0, Af=0, Aa=0, Ao=0, Av=0, z0=1/0, z1=-1/0;
    let sx=0, sy=0, n=0;
    for(let i=el.kezd;i<el.kezd+el.db;i+=3){
      const ax=P[i*3],ay=P[i*3+1],az=P[i*3+2], bx=P[i*3+3],by=P[i*3+4],bz=P[i*3+5], cx=P[i*3+6],cy=P[i*3+7],cz=P[i*3+8];
      const ux=bx-ax,uy=by-ay,uz=bz-az, vx=cx-ax,vy=cy-ay,vz=cz-az;
      const nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx;
      const A2=Math.hypot(nx,ny,nz); if(!(A2>1e-12)) continue;
      const A=A2/2, cz2=nz/A2;
      V+=(ax*(by*cz-bz*cy)-ay*(bx*cz-bz*cx)+az*(bx*cy-by*cx))/6;
      if(cz2>0.5){ Af+=A; Av+=A*cz2; } else if(cz2<-0.5) Aa+=A; else Ao+=A;
      for(const [x,y,z] of [[ax,ay,az],[bx,by,bz],[cx,cy,cz]]){ sx+=x; sy+=y; n++; if(z<z0)z0=z; if(z>z1)z1=z; }
    }
    if(!n) continue;
    /* alaprajzi fő irány (kovariancia) */
    const mx=sx/n, my=sy/n; let cxx=0,cyy=0,cxy=0;
    for(let i=el.kezd;i<el.kezd+el.db;i++){ const x=P[i*3]-mx, y=P[i*3+1]-my; cxx+=x*x; cyy+=y*y; cxy+=x*y; }
    const fi=0.5*Math.atan2(2*cxy,cxx-cyy), ex=Math.cos(fi), ey=Math.sin(fi);
    let l0=1/0,l1=-1/0,w0=1/0,w1=-1/0;
    for(let i=el.kezd;i<el.kezd+el.db;i++){ const x=P[i*3]-mx, y=P[i*3+1]-my;
      const l=x*ex+y*ey, w=-x*ey+y*ex; if(l<l0)l0=l; if(l>l1)l1=l; if(w<w0)w0=w; if(w>w1)w1=w; }
    const r=v=>Math.round(v*10000)/10000;
    ki[el.gid]={V:r(Math.abs(V)), felso:r(Af), also:r(Aa), oldal:r(Ao), vetulet:r(Av),
      magassag:r(z1-z0), hossz:r(l1-l0), szel:r(w1-w0)};
  }
  return ki;
}
/* ---------------------------------------------------------------------------
   TETŐ ELEMZÉSE A HÁROMSZÖGEKBŐL (2026-10-12, Balázs: „kontyolt a tető. Ezt el
   kellene tudni dönteni valahogyan… A vápát is tudnunk kellene valahonnan,
   élszarut is a modellből" és „számítás sorba be tudjuk tölteni a
   tetőszakaszokat? Elba számításnál a fő tető és listasorok felvétele a
   csatolt ábra szerint van").

   1. SÍKOK: a tetőtestek felfelé néző háromszögei normális + síktávolság szerint.
      Csak a legfelső héj marad (a héjalás alatti rétegek, a test alja kiesik).
   2. ÉLEK: minden sík határvonalán megnézzük, mi van a túloldalon:
        · másik tetősík, és a két sík DOMBORÚAN találkozik → vízszintes: GERINC,
          ferde: ÉL (élszarufa);
        · másik tetősík, HOMORÚAN → VÁPA;
        · semmi: vízszintes a sík alján → ERESZ, ferde → OROM (szegély),
          vízszintes a sík tetején → falcsatlakozás (félnyereg teteje).
   3. SZAKASZOK az ELBA ábrája szerint: minden gerinc egy nyeregtető-szakasz. A
      FŐ TETŐ a legnagyobb fesztávú (az ELBA leírása: „Fő tetőrésznek a
      legnagyobb fesztávolságú tetőrészt kell venni"). A gerinc két végén:
      kontysík → kontyolt vég, szabad → oromfalas vég, másik tetőrész →
      csatlakozás. A többi szakasz a tetőszakasz-lista sora: fesztáv,
      kiállás, végződés, hány vápával csatlakozik.
   A hosszak és felületek valós (ferde) méretek, méterben. A koordináták a
   háromszögelés saját (középre húzott) rendszerében vannak — csak különbségeket
   használunk.
   --------------------------------------------------------------------------- */
function tetoBontas(haromszogek,opc){
  opc=opc||{};
  const EPS=0.03;
  const T=[];
  for(const h of haromszogek){
    const [a,b,c]=h;
    const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2], vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
    let nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx; const L=Math.hypot(nx,ny,nz);
    if(!(L>1e-9)) continue; nx/=L; ny/=L; nz/=L;
    if(nz<0.26) continue;                                   // csak a felfelé néző (≤ 75°) lapok
    T.push({a,b,c,n:[nx,ny,nz],A:L/2,d:nx*a[0]+ny*a[1]+nz*a[2]});
  }
  /* --- síkok --- */
  const bennT=(t,x,y,tol)=>{                                // alaprajzi pont a háromszögben (tűréssel)
    const s=(p,q,r)=>(q[0]-p[0])*(y-p[1])-(q[1]-p[1])*(x-p[0]);
    const o=(t.b[0]-t.a[0])*(t.c[1]-t.a[1])-(t.b[1]-t.a[1])*(t.c[0]-t.a[0]); if(Math.abs(o)<1e-12) return false;
    const sg=o>0?1:-1;
    const e=[[t.a,t.b],[t.b,t.c],[t.c,t.a]];
    for(const [p,q] of e){ const l=Math.hypot(q[0]-p[0],q[1]-p[1])||1; if(sg*s(p,q)/l < -(tol||0)) return false; }
    return true;
  };
  const sikok=[];
  for(const t of T){
    let s=sikok.find(s=>s.n[0]*t.n[0]+s.n[1]*t.n[1]+s.n[2]*t.n[2]>0.998&&Math.abs(s.d-t.d)<0.04);
    if(!s){ s={n:t.n,d:t.d,tri:[],A:0}; sikok.push(s); }
    /* ugyanaz a lap kétszer (a tető és a rétege is hordozza): egyszer számít */
    const cx=(t.a[0]+t.b[0]+t.c[0])/3, cy=(t.a[1]+t.b[1]+t.c[1])/3;
    if(s.tri.some(u=>bennT(u,cx,cy,-0.005))) continue;
    s.tri.push(t); s.A+=t.A;
  }
  const zIn=(s,x,y)=>(s.d-s.n[0]*x-s.n[1]*y)/s.n[2];
  for(const s of sikok){
    let x0=1/0,x1=-1/0,y0=1/0,y1=-1/0,z0=1/0,z1=-1/0;
    for(const t of s.tri) for(const p of [t.a,t.b,t.c]){ if(p[0]<x0)x0=p[0]; if(p[0]>x1)x1=p[0]; if(p[1]<y0)y0=p[1]; if(p[1]>y1)y1=p[1]; if(p[2]<z0)z0=p[2]; if(p[2]>z1)z1=p[2]; }
    Object.assign(s,{x0,x1,y0,y1,z0,z1});
    s.benne=(x,y,tol)=>x>=s.x0-0.05&&x<=s.x1+0.05&&y>=s.y0-0.05&&y<=s.y1+0.05&&s.tri.some(t=>bennT(t,x,y,tol));
  }
  /* a legfelső héj: amit egy másik sík nagyrészt felülről takar, az alatta lévő réteg */
  /* a lapos részek (< 3°: lapostető, terasz, a gerinc fedőlemeze) nem a magastetőé */
  let kint=sikok.filter(s=>s.A>=0.05&&s.n[2]<Math.cos(3*Math.PI/180));
  kint=kint.filter(s=>{ let fedett=0;
    for(const t of s.tri){ const cx=(t.a[0]+t.b[0]+t.c[0])/3, cy=(t.a[1]+t.b[1]+t.c[1])/3, z=zIn(s,cx,cy);
      if(kint.some(o=>o!==s&&o.benne(cx,cy,0.001)&&zIn(o,cx,cy)>z+EPS)) fedett+=t.A; }
    return fedett<0.5*s.A; });
  if(!kint.length) return null;
  kint.sort((a,b)=>b.A-a.A);
  kint.forEach((s,i)=>{ s.i=i; s.doles=Math.acos(Math.min(1,s.n[2]))*180/Math.PI;
    const h=Math.hypot(s.n[0],s.n[1]); s.le=h>1e-6?[s.n[0]/h,s.n[1]/h]:[0,0]; });
  /* --- határélek: egyszer szereplő élek, a belső (T-csatlakozású) darabok nélkül --- */
  const q=x=>Math.round(x*1000), kk=p=>q(p[0])+','+q(p[1])+','+q(p[2]);
  const elek=[];
  for(const s of kint){
    const cnt=new Map();
    for(const t of s.tri) for(const [p,r] of [[t.a,t.b],[t.b,t.c],[t.c,t.a]]){
      const a=kk(p),b=kk(r), k=a<b?a+'|'+b:b+'|'+a; const v=cnt.get(k)||{p,r,db:0}; v.db++; cnt.set(k,v); }
    for(const v of cnt.values()){ if(v.db!==1) continue;
      const p=v.p, r=v.r, L=Math.hypot(r[0]-p[0],r[1]-p[1],r[2]-p[2]); if(L<0.02) continue;
      const dx=r[0]-p[0], dy=r[1]-p[1], dh=Math.hypot(dx,dy); if(dh<1e-6) continue;
      const m=[(p[0]+r[0])/2,(p[1]+r[1])/2,(p[2]+r[2])/2];
      let u=[-dy/dh,dx/dh];                                  // a sík belseje felé mutató merőleges
      const e1=s.benne(m[0]+u[0]*EPS,m[1]+u[1]*EPS,0.001), e2=s.benne(m[0]-u[0]*EPS,m[1]-u[1]*EPS,0.001);
      if(e1===e2) continue;                                  // belső él (mindkét oldal sík) vagy elfajult
      if(!e1) u=[-u[0],-u[1]];
      elek.push({s,p,r,m,u,L,vizsz:Math.abs(r[2]-p[2])<0.02});
    }
  }
  const ki={eresz:0,gerinc:0,el:0,vapa:0,orom:0,falcsatl:0,egyeb:0};
  for(const e of elek){
    const s=e.s, kx=e.m[0]-e.u[0]*EPS, ky=e.m[1]-e.u[1]*EPS;
    const j=kint.find(o=>o!==s&&o.benne(kx,ky,0.002)&&Math.abs(zIn(o,e.m[0],e.m[1])-e.m[2])<EPS);
    e.j=j||null;
    if(j){
      const px=e.m[0]+e.u[0]*0.2, py=e.m[1]+e.u[1]*0.2;
      const domboru=zIn(j,px,py)>zIn(s,px,py);
      e.tip=domboru?(e.vizsz?'gerinc':'el'):'vapa';
      ki[e.tip]+=e.L/2;                                      // a szomszéd is beszámolja a felét
    } else {
      if(e.vizsz&&Math.abs(e.m[2]-s.z0)<EPS) e.tip='eresz';
      else if(e.vizsz&&Math.abs(e.m[2]-s.z1)<EPS) e.tip='falcsatl';
      else if(!e.vizsz){ const dx=e.r[0]-e.p[0], dy=e.r[1]-e.p[1], dh=Math.hypot(dx,dy);
        e.tip=Math.abs((dx*s.le[0]+dy*s.le[1])/dh)>0.95?'orom':'egyeb'; }
      else e.tip='egyeb';
      ki[e.tip]+=e.L;
    }
  }
  const felulet=kint.reduce((a,s)=>a+s.A,0), vetulet=kint.reduce((a,s)=>a+s.A*s.n[2],0);
  /* --- szakaszok: gerincvonalak (egyenes, azonos magasság, összeérő darabok) --- */
  const gerincDb=elek.filter(e=>e.tip==='gerinc'&&e.j&&(e.s.le[0]*e.j.le[0]+e.s.le[1]*e.j.le[1])<-0.9);
  const vonalak=[];
  for(const e of gerincDb){
    const dx=e.r[0]-e.p[0], dy=e.r[1]-e.p[1], dh=Math.hypot(dx,dy), t=[dx/dh,dy/dh];
    let v=vonalak.find(v=>Math.abs(v.z-e.m[2])<EPS&&Math.abs(v.t[0]*t[1]-v.t[1]*t[0])<0.02
      &&Math.abs((e.m[0]-v.o[0])*v.t[1]-(e.m[1]-v.o[1])*v.t[0])<EPS);
    if(!v){ v={z:e.m[2],t,o:[e.p[0],e.p[1]],s0:1/0,s1:-1/0,sikok:new Set(),db:[]}; vonalak.push(v); }
    for(const p of [e.p,e.r]){ const sp=(p[0]-v.o[0])*v.t[0]+(p[1]-v.o[1])*v.t[1]; if(sp<v.s0)v.s0=sp; if(sp>v.s1)v.s1=sp; }
    v.sikok.add(e.s); v.sikok.add(e.j); v.db.push(e);
  }
  const fut=(s,zfel)=>{ const tg=Math.tan(s.doles*Math.PI/180); return tg>1e-6?(zfel-s.z0)/tg:0; };
  const szakaszok=[];
  for(const v of vonalak){
    const hossz=v.s1-v.s0; if(hossz<0.05) continue;
    const lejtok=[...v.sikok];
    /* két oldal: a lejtésirány a gerinc normálisa szerint (+ / −) */
    const nrm=[-v.t[1],v.t[0]];
    const old=[lejtok.filter(s=>s.le[0]*nrm[0]+s.le[1]*nrm[1]>0), lejtok.filter(s=>s.le[0]*nrm[0]+s.le[1]*nrm[1]<0)];
    if(!old[0].length||!old[1].length) continue;
    const futas=old.map(l=>Math.max(...l.map(s=>fut(s,v.z))));
    const W=futas[0]+futas[1];
    const doles=lejtok.reduce((a,s)=>a+s.doles*s.A,0)/lejtok.reduce((a,s)=>a+s.A,0);
    const vegek=[];
    for(const [sp,ir] of [[v.s0,-1],[v.s1,1]]){
      const P=[v.o[0]+v.t[0]*sp, v.o[1]+v.t[1]*sp], kif=[v.t[0]*ir,v.t[1]*ir];
      const konty=kint.find(s=>!v.sikok.has(s)&&(s.le[0]*kif[0]+s.le[1]*kif[1])>0.9
        &&Math.abs(zIn(s,P[0],P[1])-v.z)<EPS&&s.benne(P[0]+kif[0]*EPS,P[1]+kif[1]*EPS,0.003));
      if(konty){ vegek.push({tip:'konty',sik:konty,futas:fut(konty,v.z)}); continue; }
      const tul=kint.some(s=>s.benne(P[0]+kif[0]*0.05,P[1]+kif[1]*0.05,0.001));
      vegek.push({tip:tul?'csatl':'orom'});
    }
    const L=hossz+vegek.reduce((a,x)=>a+(x.tip==='konty'?x.futas:0),0);
    const sajat=new Set(lejtok); for(const x of vegek) if(x.sik) sajat.add(x.sik);
    szakaszok.push({tipus:'NYEREG',gerinc:hossz,z:v.z,W,L,doles,vegek,sikok:sajat,lejtok:new Set(lejtok)});
  }
  /* félnyereg: a sík teteje szabad vízszintes él (falhoz fut), és nem része nyeregnek */
  for(const s of kint){
    if(szakaszok.some(x=>x.lejtok.has(s))) continue;
    const fent=elek.filter(e=>e.s===s&&e.tip==='falcsatl');
    const gh=fent.reduce((a,e)=>a+e.L,0); if(gh<0.5) continue;
    const W=fut(s,s.z1);
    szakaszok.push({tipus:'FELNYEREG',gerinc:gh,z:s.z1,W,L:gh,doles:s.doles,vegek:[{tip:'orom'},{tip:'orom'}],sikok:new Set([s]),lejtok:new Set([s])});
  }
  const eredm={sikDb:kint.length, sikok:kint.slice(0,30).map(s=>({A:+s.A.toFixed(2),doles:+s.doles.toFixed(1)})),
    felulet:+felulet.toFixed(2), vetulet:+vetulet.toFixed(2),
    elek:Object.fromEntries(Object.entries(ki).map(([k,v])=>[k,+v.toFixed(2)])),
    dolesszog:+(kint.reduce((a,s)=>a+s.doles*s.A,0)/felulet).toFixed(1)};
  if(!szakaszok.length){
    /* sátortető vagy egyetlen sík: nincs gerinc — a fő tető a befoglaló, négy kontyal */
    eredm.fo=null; eredm.szakaszok=[]; eredm.tipusNev=kint.length>=3?'sátortető (gerinc nélkül)':'egy síkú tető';
    return eredm;
  }
  szakaszok.sort((a,b)=>(b.W-a.W)>0.05?1:((a.W-b.W)>0.05?-1:b.L-a.L));
  const fo=szakaszok[0];
  const kontyDb=x=>x.vegek.filter(v=>v.tip==='konty').length;
  const vegz=k=>k===2?'KETOLDALI_KONTY':(k===1?'KONTYOLT':'OROMFALAS');
  eredm.fo={tipus:fo.tipus, szel:+fo.W.toFixed(3), hossz:+fo.L.toFixed(3), doles:+fo.doles.toFixed(1),
    vegzodes:vegz(kontyDb(fo)), gerinc:+fo.gerinc.toFixed(3), vegek:fo.vegek.map(v=>v.tip)};
  /* a vápák vonalai (összeérő, egyenes darabok egy vonal) */
  const vapak=elek.filter(e=>e.tip==='vapa');
  eredm.szakaszok=[];
  let becsles=fo.L*fo.W/Math.cos(fo.doles*Math.PI/180);
  for(const x of szakaszok.slice(1)){
    const k=kontyDb(x);
    const VEGZ=k>=1?1:0;
    /* KIÁLLÁS a fő tető szélétől. Nyeregnél az ELBA a gerincet így számolja:
       fesztáv/2 + kiállás − fesztáv/2·(kontyolt) — ebből visszafelé. Félnyeregnél
       (falhoz támaszkodó félnyereg) a fal menti, felső él hossza. */
    const H= x.tipus==='NYEREG' ? x.gerinc - x.W/2 + x.W/2*VEGZ : x.gerinc;
    if(!(H>0.2)) continue;
    /* vápák: egyik oldala a szakaszé, a másik nem */
    const vv=vapak.filter(e=>(x.sikok.has(e.s)!==x.sikok.has(e.j)));
    const vonal=[]; for(const e of vv){ const dx=e.r[0]-e.p[0], dy=e.r[1]-e.p[1], dh=Math.hypot(dx,dy)||1, t=[dx/dh,dy/dh];
      if(!vonal.some(w=>Math.abs(w.t[0]*t[1]-w.t[1]*t[0])<0.03&&Math.abs((e.m[0]-w.m[0])*w.t[1]-(e.m[1]-w.m[1])*w.t[0])<0.05)) vonal.push({t,m:e.m}); }
    const vapaDb=Math.min(2,vonal.length);
    const vapaHossz=vv.reduce((a,e)=>a+e.L/2,0);
    const foHoz=[...x.sikok].some(s=>elek.some(e=>e.s===s&&e.j&&fo.sikok.has(e.j)&&!x.sikok.has(e.j)))||[...x.sikok].some(s=>fo.sikok.has(s));
    const csat= x.tipus==='NYEREG' ? (vapaDb===2?'NY2':(vapaDb===1?'NY1':'NY3')) : (vapaDb>=1?'FNY1':'FNY0');
    eredm.szakaszok.push({tipus:x.tipus, szel:+x.W.toFixed(3), kiallas:+H.toFixed(3), doles:+x.doles.toFixed(1),
      vegzodes:VEGZ?'KONTYOLT':'OROMFALAS', csatlakozas:csat, foHoz:foHoz?'FO':'MELLEK',
      gerinc:+x.gerinc.toFixed(3), vapaDb, vapaHossz:+vapaHossz.toFixed(2)});
    becsles+=x.W*H/Math.cos(x.doles*Math.PI/180);
  }
  eredm.becsultFelulet=+becsles.toFixed(2);
  eredm.elteres=felulet>0?+((becsles-felulet)/felulet*100).toFixed(1):null;
  const t=eredm.fo;
  eredm.tipusNev=(t.tipus==='FELNYEREG'?'félnyereg':(t.vegzodes==='KETOLDALI_KONTY'?'kontyolt':(t.vegzodes==='KONTYOLT'?'egyoldalon kontyolt nyereg':'nyereg')))
    +(eredm.szakaszok.length?` + ${eredm.szakaszok.length} tetőszakasz`:'')+(ki.vapa>0.3?', vápás':'');
  return eredm;
}
/* BEFOGLALÓ DOBOZOK elemenként (közös, középre húzott rendszerben) — a
   hőhídmegszakító keresése ebből látja, mi van egy fal ALATT. */
function dobozok(sz,opciok){
  opciok=opciok||{};
  const g=epit(sz,{R:opciok.R,hosszSzorzo:opciok.hosszSzorzo,gidk:opciok.gidk});
  const P=g.poz, ki={};
  /* vilag: a középre húzás nélkül (a modell saját koordinátáiban) */
  const kx=opciok.vilag?g.eltolas[0]:0, ky=opciok.vilag?g.eltolas[1]:0, kz=opciok.vilag?g.eltolas[2]:0;
  for(const el of g.elemek){
    let d=ki[el.gid]; if(!d) d=ki[el.gid]={x0:1/0,x1:-1/0,y0:1/0,y1:-1/0,z0:1/0,z1:-1/0};
    for(let i=el.kezd;i<el.kezd+el.db;i++){ const x=P[i*3]+kx,y=P[i*3+1]+ky,z=P[i*3+2]+kz;
      if(x<d.x0)d.x0=x; if(x>d.x1)d.x1=x; if(y<d.y0)d.y0=y; if(y>d.y1)d.y1=y; if(z<d.z0)d.z0=z; if(z>d.z1)d.z1=z; }
  }
  return ki;
}
/* A TERV ±0,00 MAGASSÁGA a modell koordinátáiban: a szintek elhelyezésének
   magassága mínusz a szint „Elevation" értéke (az ±0-hoz mért). A modell lehet
   tengerszint feletti koordinátákban is (Naszály: ~89 m) — ezért kell. */
function szintNulla(sz,opciok){
  opciok=opciok||{};
  const R=opciok.R||O._rekordok(sz), H=opciok.hosszSzorzo||0.001, gy=new Map(), l=[];
  for(const s of (opciok.szintek||[])){
    if(s.id==null||s.magassag==null) continue;
    const p=O._bont(R,s.id); const ref=p[5]&&p[5].r; if(!ref) continue;
    const m=elhelyezes(R,ref,H,gy,0); l.push(m[14]-s.magassag);
  }
  if(!l.length) return null;
  l.sort((a,b)=>a-b); return l[Math.floor(l.length/2)];
}
/* A modell tetőtesteiből (gidk) — a háromszögelés és a bontás egyben. */
function tetoElemzes(sz,opciok){
  opciok=opciok||{};
  if(!opciok.gidk||!opciok.gidk.length) return null;
  const g=epit(sz,{R:opciok.R,hosszSzorzo:opciok.hosszSzorzo,gidk:opciok.gidk});
  const P=g.poz, h=[];
  for(const el of g.elemek) for(let i=el.kezd;i<el.kezd+el.db;i+=3)
    h.push([[P[i*3],P[i*3+1],P[i*3+2]],[P[i*3+3],P[i*3+4],P[i*3+5]],[P[i*3+6],P[i*3+7],P[i*3+8]]]);
  return tetoBontas(h,opciok);
}

gyoker.ElbaBimGeometria={epit, mertekek, tetoElemzes, tetoBontas, dobozok, szintNulla, _haromszogel2D:haromszogel2D};
})(typeof self!=='undefined'?self:(typeof globalThis!=='undefined'?globalThis:this));
if(typeof module!=='undefined'&&module.exports) module.exports=(typeof self!=='undefined'?self:globalThis).ElbaBimGeometria;
