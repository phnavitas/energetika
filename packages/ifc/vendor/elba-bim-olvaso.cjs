/* ============================================================================
   ELBA — BIM OLVASÓ  (IFC / STEP kivonatoló)
   ----------------------------------------------------------------------------
   Nyers IFC (ISO-10303-21) szövegből készít egy pár száz KB-os KIVONATOT:
   szintek, helyiségek (padlópoligonból!), elemek osztályozással, anyaggal,
   típusnévvel, rétegrenddel, tulajdonságokkal és a benne lévő mennyiségekkel.

   MIÉRT SAJÁT OLVASÓ, ÉS NEM web-ifc:
     A szerkezet, az osztályozás, az anyag és a tulajdonságok — vagyis minden,
     amiből a párosítás dolgozik — tiszta szövegfeldolgozás. Ehhez nem kell
     7 MB WASM. A geometria-motor (test-térfogat, 3D nézet) csak a 3. és a 4.
     fázisban kell, és akkor töltjük be, amikor a user tényleg kéri.

   HOL FUT: Web Workerben (elba-bim-worker.js hívja importScripts-szel), hogy a
     48 MB-os fájl feldolgozása ne fagyassza be a lapot. Node alatt is fut,
     hogy tesztelni lehessen.

   NEM CSINÁL: geometriát nem értékel ki (BREP, boolean). Az IfcSpace
     padlópoligonja kivétel — az egy sima polyline, és pont ez kell a
     helyiséglistához.
   ========================================================================== */
(function(gyoker){
'use strict';

/* KÜLTÉRI HELYISÉGNEVEK — EGY SZÓTÁR, KÉT HELYRŐL HASZNÁLVA.
   Az Archicad minden zónát INTERNAL-nak exportál, tehát a modellből nem derül ki,
   mi a terasz és mi a szoba; a névből tippelünk, és a felhasználó a listán
   felülbírálja. Ugyanezt a felismerést kéri a geometria-varázsló táblázat-importja
   is — az `ElbaBimOlvaso.KULTERI`-t olvassa, hogy ne legyen két, egymástól
   elcsúszó lista. Ha bővíted, itt bővítsd. */
const KULTERI_MINTA=/terasz|udvar|erk[eé]ly|loggia|be[aá]ll[oó]|kert|j[aá]rda|park|torn[aá]c|fedett|kocsibe/i;

/* LAKÁS (EGYSÉG) FELISMERÉSE — ÁLTALÁNOS SZABÁLYOK (2026-10-03, bővítve 10-04)
   Társasháznál a helyiség egy LAKÁS része, és a belső kiépítést lakásonként kell
   látni. Balázs: „olyan szabályokat alkoss, hogy nem csak ilyen felépítésű
   IFC-ket kell tudni beolvasni, de az alap törvényszerűségek hasonlóak lesznek".
   Ezért nem egy számozásra írjuk, hanem arra, ami MINDEN lakóházmodellben igaz:

   T1. A lakás HELYISÉGEK CSOPORTJA, saját azonosítóval. Az azonosítót a modell
       többféleképpen hordozhatja — ezeket ERŐSSÉG szerint nézzük:
         a) kifejezett mező a helyiségen („Lakás", „Lakásszám", „Unit Number",
            „Apartment", „Wohnung"…) — a tervező szándékosan töltötte ki;
         b) IFC-csoport (IfcZone / IfcGroup / IfcSpatialZone), amelynek a neve
            lakást mond és azonosítót is visel („A2 lakás", „Apartment 12");
         c) a helyiség neve maga mondja („Lakás 12 – nappali", „A2 lakás fürdő");
         d) HIERARCHIKUS helyiségszám, legalább három taggal: „A.02.07" =
            épületrész / lakás / helyiség → a lakás az utolsó tag nélkül;
         e) az Archicad dinamikus azonosítója („Belső tér - A.02").
       Helyiségenként a legerősebb meglévő forrás dönt.
   T2. A GYENGE forrást — amit nem kifejezetten lakásnak szántak: név nélküli
       IFC-csoport, „Department"/„Osztály" mező, kéttagú szám („12.03") — csak
       akkor fogadjuk el, ha a modellben SEMMILYEN erős forrás nem ad legalább
       két lakást, és a csoportjai lakásnak LÁTSZANAK (T3).
   T3. LAKÁSSZERŰ az a csoportosítás, ahol
         · legalább két, legalább kéthelyiséges csoport van,
         · nem a SZINT az (van szint, amelyen legalább két csoport osztozik —
           különben az előtag a szint száma: „01.03", „1.05.07"),
         · és ha a helyiségnevek felismerhetők, a csoportok közül legalább
           kettőben van lakóhelyiség (szoba, nappali, háló, konyha, étkező).
       A hierarchikus számot (d, e) is ezen a szűrőn engedjük át — egy
       „épület.szint.helyiség" számozás így nem lesz lakás.
   T4. KÖZÖS RÉSZ: ha egy csoport MINDEN helyisége közös jellegű (lépcsőház,
       közlekedő, folyosó, garázs, tároló, gépészet…), azt közösnek javasoljuk
       — a felhasználó a listán felülbírálja.
   T5. Ami egyikből sem jön ki, az nem lakás: inkább maradjon közös, mint hogy
       kitaláljunk egyet. A felhasználó a listán átnevez és közösnek jelöl.
   A döntés MODELL-szintű (`egysegDontes`), a forrását a kivonat megmondja
   (`egysegInfo`), a felület ki is írja. */
const EGYSEG_SZAM=/^\.?\s*([A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű]{0,3}\s*[-./_]?\s*\d{1,3}(?:\s*[-./_]\s*\d{1,3})*)\s*[-./_]\s*\d{1,3}[A-Za-z]?\s*$/;
const EGYSEG_MEZO=/^(lak[aá]s|lak[oó]egys[eé]g|egys[eé]g|apartment|appartement|apartman|flat|dwelling|unit|wohnung|wohneinheit|nutzungseinheit|WE)(\s*[-_]?\s*(sz[aá]ma?|sz\.|azonos[ií]t[oó](ja)?|jele?|neve?|n[eé]v|k[oó]d(ja)?|number|no\.?|nr\.?|id|name|nummer|bezeichnung))?$/i;
/* Gyenge mező: sokan ide írják a lakást (Revit „Department"), de lehet benne
   „Lakóépület" vagy „Kereskedelem" is — csak T3 után fogadjuk el. */
const EGYSEG_GYENGE_MEZO=/^(department|oszt[aá]ly|r[eé]szleg|abteilung|occupant|nutzer)$/i;
const LAKAS_SZO=/(lak[aá]s|lak[oó]egys[eé]g|apartment|appartement|apartman|\bflat\b|dwelling|wohnung|wohneinheit|\bWE\b|\bapt\.?(?=\s|\d|$))/i;
const AZON='([A-Za-zÁÉÍÓÖŐÚÜŰ]{0,3}\\s*[-./]?\\s*\\d{1,4}[A-Za-z]?)';
const NEV_KW_AZON=new RegExp('(?:^|[\\s,;:(/–-])(?:lak[aá]s|lak[oó]egys[eé]g|apartment|appartement|apartman|apt\\.?|flat|wohnung|whg\\.?|WE)\\s*(?:no\\.?|nr\\.?|sz\\.?|#)?\\s*[-:]?\\s*'+AZON+'(?![\\d.])','i');
const NEV_AZON_KW=new RegExp('(?:^|[\\s,;:(/–-])'+AZON+'\\s*\\.?\\s*(?:sz(?:ámú|\\.)\\s*)?(?:lak[aá]s|apartment|flat|wohnung)(?![a-zá-ű])','i');
/* helyiségtípusok (T3, T4) — magyar, angol, német */
const LAKO_HELY=/szoba|nappali|h[aá]l[oó]|[eé]tkez|konyha|gardr|living|bedroom|kitchen|dining|lounge|wohn|schlaf|zimmer|k[uü]che|essen/i;
const VIZES_HELY=/f[uü]rd[oő]|\bwc\b|zuhany|mosd[oó]|bath|toilet|shower|\bbad\b|dusche/i;
const KOZOS_HELY=/l[eé]pcs[oő]|k[oö]zleked[oő]|folyos[oó]|gar[aá]zs|t[aá]rol[oó]|g[eé]p[eé]sz|lift|felvon[oó]|hullad[eé]k|szem[eé]t|ker[eé]kp[aá]r|babakocsi|pince|akna|sz[aá]r[ií]t[oó]|mos[oó]konyha|k[oö]z[oö]ss[eé]gi|h[aá]zmester|port[aá]|sz[eé]lfog|stair|corridor|lobby|garage|storage|parking|plant room|technical|shaft|treppe|flur|keller|technik/i;
const tisztaKod=v=>String(v).replace(/\s+/g,'').replace(/^[-./]+|[-./]+$/g,'');
/* Egy helyiség minden jelöltje (a döntés modell-szintű, lásd egysegDontes). */
function egysegJeloltek(jel,psetek,nev,csoportok,leiras){
  const j=String(jel==null?'':jel).trim();
  const ki={};
  const mezo=re=>{ for(const x of (psetek||[])){ const mz=(x&&x.mezok)||{};
    for(const k of Object.keys(mz)){ const v=String(mz[k]==null?'':mz[k]).trim();
      if(v&&re.test(k.trim())) return v; } } return null; };
  /* a) kifejezett lakás-mező */
  const kif=mezo(EGYSEG_MEZO); if(kif) ki.tul=kif;
  const gy=mezo(EGYSEG_GYENGE_MEZO); if(gy) ki.oszt=gy;
  /* b) IFC-csoport: lakást mondó NÉV + azonosító (a „Lakások" kategória-zóna
     minden lakás helyiségét összefogja — az nem egy lakás, ezért kell az
     azonosító). A név nélküli, egyetlen csoport gyenge jelölt. */
  const gyenge=[];
  for(const c of (csoportok||[])){
    const szov=[c.nev,c.tipus,c.leiras,c.hosszu].filter(Boolean).join(' ');
    const nv=c.nev||c.hosszu||'';
    if(!nv) continue;
    if(LAKAS_SZO.test(szov)){
      const marad=nv.replace(new RegExp(LAKAS_SZO.source,'ig'),' ');
      if(/\d|(^|\s)[A-ZÁÉÍÓÖŐÚÜŰ]{1,3}(\s|$)/.test(marad)){ if(!ki.csoport) ki.csoport=nv.trim(); }
    } else gyenge.push(nv.trim());
  }
  if(gyenge.length===1) ki.csoportGy=gyenge[0];
  /* c) a helyiség neve mondja */
  for(const t of [nev,j,leiras]){ if(!t) continue;
    const m=NEV_KW_AZON.exec(' '+t)||NEV_AZON_KW.exec(' '+t);
    if(m){ ki.nevbol=tisztaKod(m[1]); break; } }
  /* d) hierarchikus helyiségszám */
  const tagok=j.replace(/^\./,'').split(/\s*[-./_]\s*/).filter(Boolean);
  ki.tagok=tagok.length;
  if(tagok.length>=3){ const m=EGYSEG_SZAM.exec(j); if(m) ki.szam3=m[1].replace(/\s+/g,''); }
  else if(tagok.length===2&&/\d/.test(tagok[1])) ki.szam2=tagok[0];
  /* e) Archicad dinamikus azonosító */
  for(const x of (psetek||[])){ const mz=(x&&x.mezok)||{};
    for(const k of Object.keys(mz)){ if(!/dinamikus\s*id/i.test(k)) continue;
      const d=/\s-\s*([A-Za-zÁÉÍÓÖŐÚÜŰ]{1,3}\s*[-.]?\s*\d{1,3})\s*$/.exec(String(mz[k]||''));
      if(d&&!ki.dyn) ki.dyn=d[1].replace(/\s+/g,''); } }
  return ki;
}
/* Az ERŐS források láncolata egy helyiségre (T1). A kéttagú számú helyiség
   („KA.11" közlekedő) a sablonból jövő dinamikus azonosítót sem kapja meg. */
function erosEgyseg(x){
  if(x.tul) return {kod:x.tul,f:'tul'};
  if(x.csoport) return {kod:x.csoport,f:'csoport'};
  if(x.nevbol) return {kod:x.nevbol,f:'nev'};
  if(x.tagok>=3) return x.szam3?{kod:x.szam3,f:'szam'}:null;
  if(x.tagok>=2) return null;
  if(x.dyn) return {kod:x.dyn,f:'dyn'};
  return null;
}
/* Egyetlen helyiség lakása — visszafelé kompatibilis belépési pont (a régebben
   beolvasott, `egysegForras` nélküli modellnél a felület ezzel számol). */
function egysegKod(jel,psetek,nev,csoportok){
  const e=erosEgyseg(egysegJeloltek(jel,psetek,nev,csoportok)); return e?e.kod:null;
}
const EGYSEG_FORRAS={tul:'a helyiség „Lakás" mezőjéből', csoport:'az IFC-csoportokból (zóna = lakás)',
  nev:'a helyiségnevekből („Lakás 12 …")', szam:'a helyiségszámból (épületrész.lakás.helyiség)',
  dyn:'az Archicad dinamikus azonosítójából', csoportGy:'az IFC-csoportokból (név alapján nem egyértelmű, de lakásszerűek)',
  oszt:'az „Osztály / Department" mezőből', szam2:'a kéttagú helyiségszám előtagjából (lakás.helyiség)'};
/* T3: lakásszerű-e egy csoportosítás. `cs`: kód → [helyiség]. */
function lakasSzeru(cs,mind){
  const nagy=[...cs.values()].filter(l=>l.length>=2);
  if(nagy.length<2) return {ok:false,miert:'kevesebb, mint két többhelyiséges csoport'};
  const perSzint=new Map();
  for(const [k,l] of cs) for(const h of l){ const s=h.szint||'';
    let x=perSzint.get(s); if(!x){ x=new Set(); perSzint.set(s,x); } x.add(k); }
  if(![...perSzint.values()].some(x=>x.size>=2)) return {ok:false,miert:'szintenként egy csoport — az a szint, nem lakás'};
  const nevek=mind.map(h=>String(h.nev||'')+' '+String(h.jel||''));
  const felism=nevek.filter(n=>LAKO_HELY.test(n)||VIZES_HELY.test(n)||KOZOS_HELY.test(n)).length;
  if(felism>=0.3*mind.length){
    const lako=nagy.filter(l=>l.some(h=>LAKO_HELY.test(String(h.nev||'')+' '+String(h.jel||'')))).length;
    if(lako<2) return {ok:false,miert:'a csoportokban nincs lakóhelyiség'};
  }
  return {ok:true};
}
/* MODELL-SZINTŰ DÖNTÉS. `H`: helyiségek `_j` jelöltekkel (egysegJeloltek).
   Beírja: h.egyseg, h.egysegForras ('nincs', ha közös), h.egysegKozos (T4).
   Visszaad: {forras, leiras, db, forrasok:{…}, elvetve:[…]}. */
function egysegDontes(H){
  const info={forrasok:{},elvetve:[]};
  const csop=(kulcsFn)=>{ const m=new Map(); for(const h of H){ const k=kulcsFn(h); if(!k) continue;
    if(!m.has(k)) m.set(k,[]); m.get(k).push(h); } return m; };
  /* 1. erős források, helyiségenként */
  for(const h of H){ const e=erosEgyseg(h._j||{}); h.egyseg=e?e.kod:null; h.egysegForras=e?e.f:'nincs'; }
  /* A számból és a dinamikus azonosítóból jött csoportosítást T3-mal ellenőrizzük:
     „épület.szint.helyiség" számozásnál az előtag a szint. */
  for(const f of ['szam','dyn']){
    const cs=csop(h=>h.egysegForras===f?h.egyseg:null); if(!cs.size) continue;
    const v=lakasSzeru(cs,H);
    if(!v.ok){ info.elvetve.push(EGYSEG_FORRAS[f]+' — '+v.miert);
      for(const l of cs.values()) for(const h of l){ h.egyseg=null; h.egysegForras='nincs'; } }
  }
  const lakasDb=()=>[...csop(h=>h.egyseg).values()].filter(l=>l.length>=2).length;
  /* 2. gyenge források — csak ha az erősek nem adnak két lakást */
  if(lakasDb()<2){
    for(const f of ['csoportGy','oszt','szam2']){
      const cs=csop(h=>(!h.egyseg&&h._j)?h._j[f]:null); if(!cs.size) continue;
      const v=lakasSzeru(cs,H);
      if(!v.ok){ info.elvetve.push(EGYSEG_FORRAS[f]+' — '+v.miert); continue; }
      for(const [k,l] of cs) for(const h of l){ h.egyseg=k; h.egysegForras=f; }
      break;
    }
  }
  /* 3. T4: csak közös jellegű helyiségekből álló csoport → közös javaslat */
  for(const l of csop(h=>h.egyseg).values()){
    const kozos=l.every(h=>{ const n=String(h.nev||'')+' '+String(h.jel||'');
      return KOZOS_HELY.test(n)&&!LAKO_HELY.test(n)&&!VIZES_HELY.test(n); });
    if(kozos) for(const h of l) h.egysegKozos=true;
  }
  for(const h of H) if(h.egyseg) info.forrasok[h.egysegForras]=(info.forrasok[h.egysegForras]||0)+1;
  const fo=Object.entries(info.forrasok).sort((a,b)=>b[1]-a[1])[0];
  info.forras=fo?fo[0]:null;
  info.leiras=fo?EGYSEG_FORRAS[fo[0]]:'nem találtam lakásra utaló adatot';
  info.db=lakasDb();
  return info;
}

/* ---------------------------------------------------------------------------
   1. STEP SZÖVEG → REKORDOK
   Egyetlen végigolvasás. A pontosvessző CSAK akkor rekordvég, ha nem
   aposztrófok között van — az IFC-ben a szövegekben simán lehet ';'.
   Rekordonként csak a HATÁROKAT tesszük el (id, típusnév, paraméterek eleje/vége),
   nem darabolunk fel 900 000 részstringre. Így 48 MB is elfér.
   ------------------------------------------------------------------------- */
function Rekordok(sz){
  const n=sz.length;
  /* Az azonosítók sűrűek és 1-től nőnek, ezért tömbbel indexelünk — ez
     nagyságrenddel gyorsabb, mint egy Map ennyi elemre. */
  let maxId=0;
  const tS=[], tE=[], pS=[], pE=[];      // típusnév és paraméterek határai, id szerint
  const idLista=[];
  let i=sz.indexOf('DATA;'); if(i<0) i=0; else i+=5;
  let sorEleje=i, idezet=false;
  for(; i<n; i++){
    const c=sz.charCodeAt(i);
    if(idezet){
      if(c===39){ if(sz.charCodeAt(i+1)===39) i++; else idezet=false; }
      continue;
    }
    if(c===39){ idezet=true; continue; }
    if(c!==59) continue;                 // ';'
    const veg=i;
    /* rekord: sorEleje … veg */
    let a=sorEleje;
    while(a<veg && sz.charCodeAt(a)<=32) a++;
    if(sz.charCodeAt(a)===35){           // '#'
      let b=a+1, id=0;
      for(; b<veg; b++){ const d=sz.charCodeAt(b)-48; if(d<0||d>9) break; id=id*10+d; }
      if(id>0 && sz.charCodeAt(b)===61){ // '='
        let t=b+1; while(t<veg && sz.charCodeAt(t)<=32) t++;
        let z=t; while(z<veg && sz.charCodeAt(z)!==40) z++;   // '('
        if(z<veg){
          if(id>maxId) maxId=id;
          tS[id]=t; tE[id]=z; pS[id]=z+1; pE[id]=veg-1;       // a záró ')' előtt
          idLista.push(id);
        }
      }
    }
    sorEleje=veg+1;
    if(sz.charCodeAt(sorEleje)===69 && sz.startsWith('ENDSEC;',sorEleje)) break;
  }
  return {sz,tS,tE,pS,pE,idLista,maxId};
}

/* Típusnév egy rekordhoz, nagybetűsen (az IFC-ben mindig az). */
function tipus(R,id){ const a=R.tS[id]; return a===undefined?null:R.sz.slice(a,R.tE[id]); }

/* ---------------------------------------------------------------------------
   2. PARAMÉTERLISTA
   Egy rekord paramétereit csak akkor bontjuk szét, amikor tényleg kell.
   Kimenet: tömb, ahol az elem
     {r:id}          – hivatkozás másik rekordra
     'szöveg'        – feloldott string
     szám            – szám
     {e:'ENUM'}      – .ENUM. érték
     null            – $ vagy *
     tömb            – beágyazott lista
   ------------------------------------------------------------------------- */
function bont(R,id){
  const sz=R.sz; let i=R.pS[id]; const veg=R.pE[id];
  if(i===undefined) return [];
  return lista(sz,i,veg).ki;
}
function lista(sz,i,veg){
  const ki=[];
  let jelenlegi=null, van=false;
  const zar=()=>{ if(van){ ki.push(jelenlegi); jelenlegi=null; van=false; } };
  while(i<veg){
    const c=sz.charCodeAt(i);
    if(c<=32){ i++; continue; }
    if(c===44){ zar(); i++; continue; }                 // ','
    if(c===40){                                          // '(' beágyazott lista
      let m=1, j=i+1, id2=false;
      while(j<veg&&m>0){ const d=sz.charCodeAt(j);
        if(id2){ if(d===39){ if(sz.charCodeAt(j+1)===39) j++; else id2=false; } }
        else if(d===39) id2=true;
        else if(d===40) m++;
        else if(d===41) m--;
        j++; }
      jelenlegi=lista(sz,i+1,j-1).ki; van=true; i=j; continue;
    }
    if(c===39){                                          // szöveg
      let j=i+1, nyers='';
      for(;;){ const d=sz.charCodeAt(j);
        if(d===39){ if(sz.charCodeAt(j+1)===39){ nyers+="'"; j+=2; continue; } j++; break; }
        if(isNaN(d)) break;
        nyers+=sz[j]; j++; }
      jelenlegi=szovegDekod(nyers); van=true; i=j; continue;
    }
    if(c===35){                                          // #hivatkozás
      let j=i+1, v=0;
      while(j<veg){ const d=sz.charCodeAt(j)-48; if(d<0||d>9) break; v=v*10+d; j++; }
      jelenlegi={r:v}; van=true; i=j; continue;
    }
    if(c===46){                                          // .ENUM.
      let j=i+1; while(j<veg&&sz.charCodeAt(j)!==46) j++;
      jelenlegi={e:sz.slice(i+1,j)}; van=true; i=j+1; continue;
    }
    if(c===36||c===42){ jelenlegi=null; van=true; i++; continue; }   // $ vagy *
    /* szám, vagy IFCMEASURE(…) alakú tipizált érték */
    let j=i;
    while(j<veg){ const d=sz.charCodeAt(j); if(d===44||d===41||d===40) break; j++; }
    if(sz.charCodeAt(j)===40){                           // TÍPUS(érték)
      let m=1,k=j+1,id3=false;
      while(k<veg&&m>0){ const d=sz.charCodeAt(k);
        if(id3){ if(d===39){ if(sz.charCodeAt(k+1)===39) k++; else id3=false; } }
        else if(d===39) id3=true; else if(d===40) m++; else if(d===41) m--;
        k++; }
      const belso=lista(sz,j+1,k-1).ki;
      jelenlegi=belso.length===1?belso[0]:belso; van=true; i=k; continue;
    }
    const t=sz.slice(i,j).trim();
    const num=parseFloat(t);
    jelenlegi=(t!==''&&!isNaN(num))?num:t; van=true; i=j; continue;
  }
  zar();
  return {ki,i};
}

/* STEP szövegkódolás feloldása: \X\E9 · \X2\00F5…\X0\ · \S\c · \\ */
function szovegDekod(s){
  if(s.indexOf('\\')<0) return s;
  let ki='';
  for(let i=0;i<s.length;i++){
    if(s[i]!=='\\'){ ki+=s[i]; continue; }
    const p=s[i+1];
    if(p==='\\'){ ki+='\\'; i++; continue; }
    if(p==='S'&&s[i+2]==='\\'){ ki+=String.fromCharCode(s.charCodeAt(i+3)+128); i+=3; continue; }
    if(p==='X'&&s[i+2]==='\\'){ ki+=String.fromCharCode(parseInt(s.substr(i+3,2),16)); i+=4; continue; }
    if(p==='X'&&s[i+2]==='2'&&s[i+3]==='\\'){
      let j=i+4, hex='';
      while(j<s.length&&!(s[j]==='\\'&&s[j+1]==='X'&&s[j+2]==='0')) { hex+=s[j]; j++; }
      for(let k=0;k+3<hex.length+1;k+=4) ki+=String.fromCharCode(parseInt(hex.substr(k,4),16));
      i=j+3; continue;
    }
    if(p==='X'&&s[i+2]==='4'&&s[i+3]==='\\'){
      let j=i+4, hex='';
      while(j<s.length&&!(s[j]==='\\'&&s[j+1]==='X'&&s[j+2]==='0')) { hex+=s[j]; j++; }
      for(let k=0;k+7<hex.length+1;k+=8) ki+=String.fromCodePoint(parseInt(hex.substr(k,8),16));
      i=j+3; continue;
    }
    ki+=s[i];
  }
  return ki;
}

/* ---------------------------------------------------------------------------
   3. FEJLÉC
   ------------------------------------------------------------------------- */
function fejlec(sz){
  const fej=sz.slice(0, Math.max(0,sz.indexOf('DATA;')));
  const egy=(n)=>{ const i=fej.indexOf(n+'('); if(i<0) return [];
    let m=1,j=i+n.length+1,id=false;
    while(j<fej.length&&m>0){ const c=fej[j];
      if(id){ if(c==="'"){ if(fej[j+1]==="'") j++; else id=false; } }
      else if(c==="'") id=true; else if(c==='(') m++; else if(c===')') m--;
      j++; }
    return lista(fej,i+n.length+1,j-1).ki; };
  const leiras=egy('FILE_DESCRIPTION'), nev=egy('FILE_NAME'), sema=egy('FILE_SCHEMA');
  const opcSor=(Array.isArray(leiras[0])?leiras[0]:[]).map(String);
  const opc={};
  for(const o of opcSor){ const m=/^Option \[(.+?): (.+)\]$/.exec(o); if(m) opc[m[1]]=m[2]; }
  return {
    sema: (Array.isArray(sema[0])?sema[0][0]:sema[0])||'ismeretlen',
    fajlNev: String(nev[0]||'').split(/[\\/]/).pop(),
    ido: nev[1]||'',
    exporter: [nev[5],nev[6]].filter(Boolean).join(' — '),
    opciok: opc,
    /* A modellnézet-definíció (pl. „CoordinationView_V2.0" vagy az iTWO-alapú
       „QuantityTakeOffAddOnView"): megmutatja, melyik fordítóval készült. */
    nezet: ((opcSor.find(o=>/^ViewDefinition \[/.test(o))||'').replace(/^ViewDefinition \[|\]$/g,'')),
    baseQuantities: String(opc['IFC Base Quantities']||'').toLowerCase()==='on',
    osztalyozasVan: String(opc['Element Classifications']||'').toLowerCase()==='on'
  };
}

/* ---------------------------------------------------------------------------
   4. HOSSZEGYSÉG
   Minden hosszmértéket méterre váltunk, hogy az ELBA-ban ne kelljen figyelni rá.
   ------------------------------------------------------------------------- */
const ELOTAG={EXA:1e18,PETA:1e15,TERA:1e12,GIGA:1e9,MEGA:1e6,KILO:1e3,HECTO:100,DECA:10,
  DECI:.1,CENTI:.01,MILLI:.001,MICRO:1e-6,NANO:1e-9,PICO:1e-12};
function hosszSzorzo(R,byType){
  for(const id of (byType.get('IFCSIUNIT')||[])){
    const p=bont(R,id);
    if(!(p[1]&&p[1].e==='LENGTHUNIT')) continue;
    const elo=p[2]&&p[2].e?ELOTAG[p[2].e]:1;
    return elo||1;
  }
  for(const id of (byType.get('IFCCONVERSIONBASEDUNIT')||[])){
    const p=bont(R,id);
    if(p[1]&&p[1].e==='LENGTHUNIT'&&p[3]&&p[3].r){
      const m=bont(R,p[3].r); if(typeof m[0]==='number') return m[0];
    }
  }
  return 1;
}

/* ---------------------------------------------------------------------------
   5. FŐ KIVONATOLÓ
   ------------------------------------------------------------------------- */
/* Amit soha nem tekintünk épületelemnek. */
const TERBELI=new Set(['IFCPROJECT','IFCSITE','IFCBUILDING','IFCBUILDINGSTOREY','IFCSPACE']);
/* Amit nem kérünk be a kivonatba (nyílás, annotáció, rács, geometria). */
const KIHAGY=new Set(['IFCOPENINGELEMENT','IFCANNOTATION','IFCGRID','IFCVIRTUALELEMENT']);

function olvas(szoveg,opciok){
  opciok=opciok||{};
  const halad=opciok.halad||function(){};
  halad('olvasas',5,'Rekordok keresése…');
  const R=Rekordok(szoveg);
  const fej=fejlec(szoveg);

  halad('olvasas',25,'Típusok indexelése…');
  const byType=new Map();
  for(const id of R.idLista){
    const t=tipus(R,id); if(!t) continue;
    let l=byType.get(t); if(!l){ l=[]; byType.set(t,l); }
    l.push(id);
  }
  const H=hosszSzorzo(R,byType);                       // → méter
  const lista_=t=>byType.get(t)||[];

  /* --- kapcsolatok ------------------------------------------------------- */
  halad('kapcsolatok',40,'Kapcsolatok feloldása…');
  const szuloAgg=new Map();        // gyerek id → szülő id  (IfcRelAggregates)
  for(const id of lista_('IFCRELAGGREGATES')){
    const p=bont(R,id); const sz=p[4]&&p[4].r; const gy=p[5];
    if(!sz||!Array.isArray(gy)) continue;
    for(const g of gy) if(g&&g.r) szuloAgg.set(g.r,sz);
  }
  const terben=new Map();          // elem id → térbeli szerkezet id
  for(const id of lista_('IFCRELCONTAINEDINSPATIALSTRUCTURE')){
    const p=bont(R,id); const st=p[5]&&p[5].r; const el=p[4];
    if(!st||!Array.isArray(el)) continue;
    for(const e of el) if(e&&e.r) terben.set(e.r,st);
  }
  /* Melyik helyiségek határolják az elemet (IfcRelSpaceBoundary). Az ajtót és
     az ablakot az Archicad nem köti zónához, de a térhatárból kiderül, melyik
     helyiségek között áll — ebből tudjuk, melyik lakásé (lásd egysegKod). */
  const hatarolt=new Map();        // elem id → [helyiség id]
  for(const id of lista_('IFCRELSPACEBOUNDARY')){
    const p=bont(R,id); const ter=p[4]&&p[4].r, el=p[5]&&p[5].r;
    if(!ter||!el) continue;
    let l=hatarolt.get(el); if(!l){ l=[]; hatarolt.set(el,l); }
    if(l.indexOf(ter)<0) l.push(ter);
  }
  /* IFC-CSOPORTOK — a lakás mint helyiség-csoport (lásd T1 b). Revit, Allplan,
     Vectorworks a lakást gyakran IfcZone-ként exportálja (IfcRelAssignsToGroup),
     az IFC4 IfcSpatialZone-t is ismer (IfcRelReferencedInSpatialStructure).
     A zóna zónát is csoportosíthat — a szülő csoport a helyiségé is. */
  const csoportEl=new Map();       // helyiség id → [csoport id]
  {
    const tagjai=new Map();        // csoport id → [tag id]
    const fel=(g,t)=>{ let l=tagjai.get(g); if(!l){ l=[]; tagjai.set(g,l); } l.push(t); };
    for(const id of lista_('IFCRELASSIGNSTOGROUP')){
      const p=bont(R,id); const g=p[6]&&p[6].r; if(!g||!/^IFC(ZONE|GROUP)$/.test(tipus(R,g)||'')) continue;
      for(const o of (Array.isArray(p[4])?p[4]:[])) if(o&&o.r) fel(g,o.r);
    }
    for(const id of lista_('IFCRELREFERENCEDINSPATIALSTRUCTURE')){
      const p=bont(R,id); const g=p[5]&&p[5].r; if(!g||tipus(R,g)!=='IFCSPATIALZONE') continue;
      for(const o of (Array.isArray(p[4])?p[4]:[])) if(o&&o.r) fel(g,o.r);
    }
    for(const id of lista_('IFCRELAGGREGATES')){
      const p=bont(R,id); const g=p[4]&&p[4].r; if(!g||tipus(R,g)!=='IFCSPATIALZONE') continue;
      for(const o of (Array.isArray(p[5])?p[5]:[])) if(o&&o.r) fel(g,o.r);
    }
    const bejar=(g,t,mely)=>{ if(mely>4) return;
      if(tipus(R,t)==='IFCSPACE'){ let l=csoportEl.get(t); if(!l){ l=[]; csoportEl.set(t,l); } if(l.indexOf(g)<0) l.push(g); return; }
      if(tagjai.has(t)) for(const u of tagjai.get(t)) bejar(g,u,mely+1); };
    for(const [g,l] of tagjai) for(const t of l) bejar(g,t,0);
  }
  const csoportAdat=g=>{ const t=tipus(R,g), p=bont(R,g); const s=v=>typeof v==='string'?v.trim():'';
    return {ifc:t, nev:s(p[2]), leiras:s(p[3]), tipus:s(p[4]),
            hosszu:t==='IFCSPATIALZONE'?s(p[7]):(t==='IFCZONE'?s(p[5]):'')}; };
  /* tulajdonságok */
  const psetEl=new Map();          // elem id → [pset id]
  for(const id of lista_('IFCRELDEFINESBYPROPERTIES')){
    const p=bont(R,id); const def=p[5]&&p[5].r; const cel=p[4];
    if(!def||!Array.isArray(cel)) continue;
    for(const c of cel){ if(!c||!c.r) continue;
      let l=psetEl.get(c.r); if(!l){ l=[]; psetEl.set(c.r,l); } l.push(def); }
  }
  /* típus */
  const tipusEl=new Map();
  for(const id of lista_('IFCRELDEFINESBYTYPE')){
    const p=bont(R,id); const tp=p[5]&&p[5].r; const cel=p[4];
    if(!tp||!Array.isArray(cel)) continue;
    for(const c of cel) if(c&&c.r) tipusEl.set(c.r,tp);
  }
  /* anyag */
  const anyagEl=new Map();
  for(const id of lista_('IFCRELASSOCIATESMATERIAL')){
    const p=bont(R,id); const an=p[5]&&p[5].r; const cel=p[4];
    if(!an||!Array.isArray(cel)) continue;
    for(const c of cel) if(c&&c.r) anyagEl.set(c.r,an);
  }
  /* osztályozás */
  /* Egy elem TÖBB osztályozást is kaphat — a Naszály-modellben pl. az Archicad
     sajátját ÉS egy „ELBA" rendszerűt is. Ezért listát tartunk, nem egy értéket. */
  const osztEl=new Map();
  for(const id of lista_('IFCRELASSOCIATESCLASSIFICATION')){
    /* IFC2X3: (GlobalId,OwnerHistory,Name,Description,RelatedObjects,RelatingClassification) */
    const p=bont(R,id);
    const cel=Array.isArray(p[4])?p[4]:null, ref=p[5]&&p[5].r;
    if(!cel||!ref) continue;
    for(const c of cel){ if(!c||!c.r) continue;
      let l=osztEl.get(c.r); if(!l){ l=[]; osztEl.set(c.r,l); } l.push(ref); }
  }
  /* nyílás → befogadó elem (ablak/ajtó melyik falban van) */
  const nyilasFal=new Map();
  for(const id of lista_('IFCRELVOIDSELEMENT')){
    const p=bont(R,id); if(p[4]&&p[4].r&&p[5]&&p[5].r) nyilasFal.set(p[5].r,p[4].r);
  }
  const beepitve=new Map();        // ablak/ajtó id → fal id
  for(const id of lista_('IFCRELFILLSELEMENT')){
    const p=bont(R,id); const ny=p[4]&&p[4].r, el=p[5]&&p[5].r;
    if(ny&&el&&nyilasFal.has(ny)) beepitve.set(el,nyilasFal.get(ny));
  }
  /* FÓLIÁK (rétegek az Archicadben).
     Az IFC ezt IfcPresentationLayerAssignment-ben hordozza, és — szerencsére —
     ez FÜGGETLEN attól, hogy az „Elemparaméterek" exportja be van-e kapcsolva.
     A hozzárendelés az alakzat-ábrázolásokra mutat, nem magukra az elemekre,
     ezért egy lépéssel vissza kell menni: fólia → IfcShapeRepresentation → elem.
     A fólianév a gyakorlatban erős párosítási kulcs („B-Fal-szerkezetek.STR"),
     mert a tervezőirodák fegyelmezetten fóliáznak. */
  const foliaRep=new Map();
  for(const id of lista_('IFCPRESENTATIONLAYERASSIGNMENT')){
    const p=bont(R,id); const nev=p[0];
    if(typeof nev!=='string'||!nev) continue;
    for(const it of (p[2]||[])) if(it&&it.r) foliaRep.set(it.r,nev);
  }
  function foliaja(id){
    const p=bont(R,id); const rep=p[6]&&p[6].r; if(!rep) return null;
    const rp=bont(R,rep);
    for(const r of (rp[2]||[])) if(r&&r.r&&foliaRep.has(r.r)) return foliaRep.get(r.r);
    return null;
  }

  /* mennyiségek */
  const menyEl=new Map();
  for(const [el,psl] of psetEl){
    for(const ps of psl){ if(tipus(R,ps)==='IFCELEMENTQUANTITY'){
      let l=menyEl.get(el); if(!l){ l=[]; menyEl.set(el,l); } l.push(ps); } }
  }

  /* --- segédfeloldók ------------------------------------------------------ */
  const gidOf=id=>{ const p=bont(R,id); return typeof p[0]==='string'?p[0]:null; };
  const nevOf=id=>{ const p=bont(R,id); return typeof p[2]==='string'?p[2]:null; };

  function anyagNev(id){
    const t=tipus(R,id); const p=bont(R,id);
    if(t==='IFCMATERIAL') return {nev:p[0]||null,retegek:null};
    if(t==='IFCMATERIALLAYERSETUSAGE'&&p[0]&&p[0].r) return anyagNev(p[0].r);
    if(t==='IFCMATERIALLAYERSET'){
      const ret=[];
      for(const l of (p[0]||[])) if(l&&l.r){
        const lp=bont(R,l.r);
        ret.push({anyag:(lp[0]&&lp[0].r)?(bont(R,lp[0].r)[0]||null):null,
                  vast:typeof lp[1]==='number'?lp[1]*H:null});
      }
      return {nev:p[1]||null,retegek:ret};
    }
    if(t==='IFCMATERIALLIST'){
      const nevek=[]; for(const m of (p[0]||[])) if(m&&m.r) nevek.push(bont(R,m.r)[0]);
      return {nev:nevek.filter(Boolean).join(' + ')||null,retegek:null};
    }
    return {nev:null,retegek:null};
  }
  /* IfcClassificationReference = (Location, ItemReference/Identification, Name,
     ReferencedSource). A ReferencedSource lehet IfcClassification VAGY egy másik
     hivatkozás (fa-szerű rendszereknél) — felfelé megyünk, amíg rendszert találunk.
     IfcClassification = (Source, Edition, EditionDate, Name): a NÉV a 4. mező,
     a 3. egy dátum-hivatkozás. */
  function rendszerNev(id,melyseg){
    if(!id||(melyseg||0)>6) return 'ismeretlen';
    const t=tipus(R,id), p=bont(R,id);
    if(t==='IFCCLASSIFICATION') return (typeof p[3]==='string'&&p[3])||(typeof p[0]==='string'?p[0]:'ismeretlen');
    if(t==='IFCCLASSIFICATIONREFERENCE') return p[3]&&p[3].r?rendszerNev(p[3].r,(melyseg||0)+1):'ismeretlen';
    return 'ismeretlen';
  }
  function osztalyozas(id){
    const p=bont(R,id);
    const kod=typeof p[1]==='string'?p[1]:null;      // pl. '303.05' vagy 'Elemes fal'
    const nev=typeof p[2]==='string'?p[2]:null;      // pl. 'Alapozás'
    return {kod, nev, ertek:nev||kod, rendszer:rendszerNev(p[3]&&p[3].r,0)};
  }
  const NEM_ERTEK=new Set(['<válassz>','<valassz>','','-','—']);
  function psetKiolvas(id){
    const t=tipus(R,id); const p=bont(R,id);
    if(t!=='IFCPROPERTYSET') return null;
    const nev=p[2]||''; const mezok={};
    for(const pr of (p[4]||[])){
      if(!pr||!pr.r) continue;
      const pt=tipus(R,pr.r), pp=bont(R,pr.r);
      const kulcs=pp[0]; if(typeof kulcs!=='string') continue;
      let v=null;
      if(pt==='IFCPROPERTYSINGLEVALUE') v=pp[2];
      else if(pt==='IFCPROPERTYENUMERATEDVALUE') v=Array.isArray(pp[2])?pp[2].map(x=>x&&x.e?x.e:x).join(', '):null;
      else if(pt==='IFCPROPERTYLISTVALUE') v=Array.isArray(pp[2])?pp[2].join(', '):null;
      if(v&&v.e) v=v.e;
      if(v===null||v===undefined) continue;
      if(typeof v==='string'&&NEM_ERTEK.has(v.trim())) continue;
      mezok[kulcs]=v;
    }
    return Object.keys(mezok).length?{nev,mezok}:{nev,mezok:{}};
  }
  /* NEVESÍTETT MENNYISÉGEK — csak amire a párosításnak szüksége van.
     Az Archicad 862 különböző mennyiségnevet ír ki; ha mindet megtartanánk,
     a kivonat megabájtos lenne. Ez a szűrő a mértékadó geometriai adatokra
     szűkít — falhossz, falfelület oldalanként, nyílásterület, rétegvastagság,
     nyílászáró-méret —, vagyis pont azokra, amikből az ELBA mezői töltődnek. */
  const Q_KELL=[
    /^Fal hossza a (bels|küls)/i, /^Fal (bels|küls)ő oldal(a|ának)/i,
    /^Fal réteg leg(nagyobb|kisebb) magassága/i, /^Falösszetevő rétegvastagsága/i,
    /^(Üres nyílások összesített területe|Nyílások száma|Nyílások területe|Pontos nyílásterület)/i,
    /^Falnyílás (szélessége|magassága)/i, /^Névleges nyílás(terület|szélesség|magasság)$/i,
    /^Nyílászáró (névleges )?(parapet|nyílásterülete|nyílásszélessége|nyílásmagassága)/i,
    /^Összetevő (térfogata|vetített területe|keresztmetszeti területe)/i,
    /^(Terület|Térfogat|Hossz|Magasság|Szélesség|Vastagság|Tömeg)$/i,
    /^Térfogat \((nettó|bruttó)\)$/i, /^Felület területe$/i,
    /^(Felső|Alsó) felület területe/i, /^Élfelület területe/i,
    /^Helyiség (nettó|bruttó) kerülete$/i, /^Mért nettó terület$/i,
    /^Födém (felső|alsó) felületének területe/i, /^Tető (felső|alsó) felületének területe/i,
    /^Oszlop(mag|burkolat) (térfogata|felületének)/i, /^Téglalap összetevő (magassága|szélessége)$/i,
    /^(Gross|Net)[A-Za-z]+$/,
    /* CSARNOK (2026-10-27): az Archicad keretszerkezet-objektumának méretei —
       a hegesztett keret kifejtett hosszához (fesztáv, eresz, gerinc) */
    /^(Keret hossza|Ereszmagasság|Gerincmagasság)$/i
  ];
  /* A ZÓNA mennyiségei. Az Archicad a helyiségre kiírja a belmagasságot, a
     padlórétegrend vastagságát, a falak felületét és a sarkok számát —
     mindet olyan néven, ami a fenti listába nem fér bele. Ezek nélkül a
     belmagasságot a falakból kellene találgatni. */
  const Q_ZONA=[
    /^(ClearHeight|FinishCeilingHeight|FinishFloorHeight|Height)$/,
    /^(Gross|Net)(FloorArea|CeilingArea|WallArea|Perimeter)$/,
    /^(Magasság|Terület)$/i, /^Padló vastagsága$/i,
    /^(Sarkok|Konkáv sarkok|Ablakok|Ajtók) száma$/i,
    /^(Ablakok|Ajtók|Falak) területe$/i,
    /^Álmennyezet magassága$/i,
    /^(Felső|Alsó|Él)felület területe/i, /^Élfelület területe/i];
  const qKell=n=>Q_KELL.some(r=>r.test(n));
  const qZonaKell=n=>Q_ZONA.some(r=>r.test(n));

  function mennyisegek(idk,zona){
    const ki={L:null,A:null,V:null,db:null,sajat:{}};
    for(const q of idk){
      const p=bont(R,q);
      /* IfcElementQuantity = (GlobalId, OwnerHistory, Name, Description,
         MethodOfMeasurement, Quantities) — a lista a 6. helyen van, EGGYEL
         hátrébb, mint az IfcPropertySet-nél. Ez a plusz mező a csapda. */
      for(const m of (p[5]||[])){
        if(!m||!m.r) continue;
        const mt=tipus(R,m.r), mp=bont(R,m.r);
        /* IfcQuantity* = (Name, Description, Unit, Value) — az ÉRTÉK a 4. helyen van.
           A 3. a mértékegység, ami majdnem mindig $, ezért egy elrontott index
           csendben nullát ad: pont ez rejtette el sokáig, hogy van adat. */
        const nev=mp[0], ert=mp[3];
        if(typeof ert!=='number') continue;
        const kell=typeof nev==='string'&&(zona?qZonaKell(nev):qKell(nev));
        if(mt==='IFCQUANTITYLENGTH'){ if(kell) ki.sajat[nev]=ert*H; if(ert&&ki.L==null) ki.L=ert*H; }
        else if(mt==='IFCQUANTITYAREA'){ if(kell) ki.sajat[nev]=ert; if(ert&&ki.A==null) ki.A=ert; }
        else if(mt==='IFCQUANTITYVOLUME'){ if(kell) ki.sajat[nev]=ert; if(ert&&ki.V==null) ki.V=ert; }
        else if(mt==='IFCQUANTITYCOUNT'){ if(kell) ki.sajat[nev]=ert; if(ert&&ki.db==null) ki.db=ert; }
        else if(mt==='IFCQUANTITYWEIGHT'){ if(kell) ki.sajat[nev]=ert; }
      }
    }
    return ki;
  }

  /* --- szintek ------------------------------------------------------------ */
  halad('szerkezet',55,'Szintek és helyiségek…');
  const szintById=new Map();
  const szintek=lista_('IFCBUILDINGSTOREY').map(id=>{
    const p=bont(R,id);
    const sz={gid:p[0],id,nev:(p[2]||'').trim()||'(névtelen szint)',
              magassag:typeof p[9]==='number'?p[9]*H:null};
    szintById.set(id,sz); return sz;
  }).sort((a,b)=>(a.magassag==null?0:a.magassag)-(b.magassag==null?0:b.magassag));
  szintek.forEach((s,i)=>{ s.sorrend=i; });

  /* Melyik szinten van egy elem: a befoglalás, ha van; különben a szülőn át. */
  function szintje(id){
    let cur=id;
    for(let k=0;k<12&&cur;k++){
      /* Maga a csomópont is lehet szint — a helyiségek nem „benne vannak",
         hanem a szint RÉSZEI (IfcRelAggregates), ezért ez a sor kell. */
      const sajat=szintById.get(cur); if(sajat&&cur!==id) return sajat;
      const st=terben.get(cur);
      if(st!==undefined){ const s=szintById.get(st); if(s) return s;
        cur=szuloAgg.get(st); continue; }        /* pl. telken lóg — menjünk feljebb */
      cur=szuloAgg.get(cur);
    }
    return null;
  }

  /* --- helyiségek: a padlópoligonból --------------------------------------- */
  function pontok(id){                      // IfcPolyline → [[x,y], …] méterben
    const p=bont(R,id); const ki=[];
    for(const c of (p[0]||[])){ if(!c||!c.r) continue;
      const q=bont(R,c.r); if(!Array.isArray(q[0])) continue;
      ki.push([(q[0][0]||0)*H,(q[0][1]||0)*H]); }
    if(ki.length>1){ const a=ki[0], b=ki[ki.length-1];
      if(Math.abs(a[0]-b[0])<1e-9&&Math.abs(a[1]-b[1])<1e-9) ki.pop(); }
    return ki;
  }
  function poligon(id){                     // elem → a FootPrint poligonja
    const p=bont(R,id); const rep=p[6]&&p[6].r; if(!rep) return null;
    const rp=bont(R,rep);
    for(const r of (rp[2]||[])){ if(!r||!r.r) continue;
      const q=bont(R,r.r);
      if(q[1]!=='FootPrint') continue;
      for(const it of (q[3]||[])){ if(!it||!it.r) continue;
        const t=tipus(R,it.r);
        if(t==='IFCPOLYLINE') return pontok(it.r);
        if(t==='IFCGEOMETRICCURVESET'){
          const gp=bont(R,it.r); let legjobb=null;
          for(const e of (gp[0]||[])) if(e&&e.r&&tipus(R,e.r)==='IFCPOLYLINE'){
            const pt=pontok(e.r);
            if(!legjobb||terulet(pt)>terulet(legjobb)) legjobb=pt; }
          if(legjobb) return legjobb;
        } } }
    return null;
  }
  /* MENNYISÉG A GEOMETRIÁBÓL (2026-10-04). Az Archicad alap IFC-fordítója (nem
     az ELBA-beállítás) nem írja ki az „IFC Base Quantities"-t: a falnak nincs
     hossza és magassága, a födémnek területe — a falszakasz-sorok üresek
     maradtak (Ruff, Győrújbarát). A geometria viszont ott van:
       · fal: az „Axis" görbe hossza = a fal tengelyhossza, a „Body"
         IfcExtrudedAreaSolid mélysége = a magassága;
       · födém: az extrúzió PROFILJA az alaprajzi sokszög (terület, kerület),
         a mélysége a vastagsága.
     Csak akkor használjuk, ha a modell mennyiséget nem adott. */
  function abrazolasok(id){
    const p=bont(R,id); const rep=p[6]&&p[6].r; if(!rep) return [];
    const ki=[];
    for(const r of (bont(R,rep)[2]||[])){ if(!r||!r.r) continue;
      const q=bont(R,r.r); ki.push({azon:q[1], fajta:q[2], elemek:(q[3]||[]).filter(x=>x&&x.r).map(x=>x.r)}); }
    return ki;
  }
  function gorbeHossz(id,m){
    if((m||0)>6) return null;
    const t=tipus(R,id);
    if(t==='IFCPOLYLINE'){ const p=bont(R,id); const pt=[];
      for(const c of (p[0]||[])){ if(!c||!c.r) continue; const q=bont(R,c.r); if(Array.isArray(q[0])) pt.push([(q[0][0]||0)*H,(q[0][1]||0)*H]); }
      let s=0; for(let i=1;i<pt.length;i++) s+=Math.hypot(pt[i][0]-pt[i-1][0],pt[i][1]-pt[i-1][1]); return pt.length>1?s:null; }
    if(t==='IFCTRIMMEDCURVE'){ const p=bont(R,id); const b=p[0]&&p[0].r;
      if(b&&tipus(R,b)==='IFCCIRCLE'){ const r=(bont(R,b)[1]||0)*H;
        const a1=Array.isArray(p[1])?p[1].find(x=>typeof x==='number'||x&&x.v!=null):null, a2=Array.isArray(p[2])?p[2].find(x=>typeof x==='number'||x&&x.v!=null):null;
        const sz=v=>typeof v==='number'?v:(v&&typeof v.v==='number'?v.v:null);
        const u1=sz(a1), u2=sz(a2);
        if(r&&u1!=null&&u2!=null){ let d=Math.abs(u2-u1); if(d>2*Math.PI+1e-6) d=d*Math.PI/180; return r*d; } }
      return b?gorbeHossz(b,(m||0)+1):null; }
    if(t==='IFCCOMPOSITECURVE'){ let s=0, van=false;
      for(const sg of (bont(R,id)[0]||[])){ if(!sg||!sg.r) continue; const c=bont(R,sg.r)[2];
        const h=c&&c.r?gorbeHossz(c.r,(m||0)+1):null; if(h!=null){ s+=h; van=true; } }
      return van?s:null; }
    return null;
  }
  function extruzio(id){
    for(const a of abrazolasok(id)){
      if(a.azon!=='Body') continue;
      for(const it of a.elemek){
        let x=it, t=tipus(R,x), lep=0;
        while((t==='IFCBOOLEANCLIPPINGRESULT'||t==='IFCBOOLEANRESULT')&&lep<200){ const q=bont(R,x); x=q[1]&&q[1].r; t=x?tipus(R,x):null; lep++; }
        if(t!=='IFCEXTRUDEDAREASOLID') continue;
        const q=bont(R,x);
        const melyseg=typeof q[3]==='number'?q[3]*H:null;
        let iranyZ=true; if(q[2]&&q[2].r){ const d=bont(R,q[2].r)[0]; if(Array.isArray(d)) iranyZ=Math.abs(d[2]||0)>0.99; }
        let prof=null, terulet0=null, kerulet0=null;
        const pr=q[0]&&q[0].r, pt=pr?tipus(R,pr):null;
        if(pt==='IFCRECTANGLEPROFILEDEF'){ const pp=bont(R,pr); const a2=(pp[3]||0)*H, b2=(pp[4]||0)*H;
          prof={x:a2,y:b2}; terulet0=a2*b2; kerulet0=2*(a2+b2); }
        else if(pt==='IFCARBITRARYCLOSEDPROFILEDEF'||pt==='IFCARBITRARYPROFILEDEFWITHVOIDS'){
          const pp=bont(R,pr); const c=pp[2]&&pp[2].r;
          if(c&&tipus(R,c)==='IFCPOLYLINE'){ const pts=pontok(c); terulet0=terulet(pts); kerulet0=kerulet(pts); prof={pts}; }
          else if(c){ const h=gorbeHossz(c,0); if(h) kerulet0=h; } }
        return {melyseg,iranyZ,prof,terulet:terulet0,kerulet:kerulet0};
      }
    }
    return null;
  }
  function tengelyHossz(id){
    for(const a of abrazolasok(id)) if(a.azon==='Axis')
      for(const it of a.elemek){ const h=gorbeHossz(it,0); if(h) return h; }
    return null;
  }
  const terulet=pts=>{ if(!pts||pts.length<3) return 0; let s=0;
    for(let i=0;i<pts.length;i++){ const a=pts[i], b=pts[(i+1)%pts.length];
      s+=a[0]*b[1]-b[0]*a[1]; } return Math.abs(s)/2; };
  const kerulet=pts=>{ if(!pts||pts.length<2) return 0; let s=0;
    for(let i=0;i<pts.length;i++){ const a=pts[i], b=pts[(i+1)%pts.length];
      s+=Math.hypot(b[0]-a[0],b[1]-a[1]); } return s; };
  /* BREP BEFOGLALÓ TÉGLALAP. Az Archicad a tetőt és a födémet gyakran csak
     határoló-felületként (Brep) exportálja — nincs FootPrint poligon, amiből
     az alaprajzi méret kijönne. A test MINDEN pontját összegyűjtjük, és a
     szélső koordinátákat vesszük. A pontok az elem saját rendszerében vannak,
     ezért ez a KITERJEDÉST adja meg, nem a helyzetet — de nekünk pont az kell.
     Mélységkorlát véd a körkörös hivatkozástól. */
  function brepBefoglalo(id){
    const p=bont(R,id); const rep=p[6]&&p[6].r; if(!rep) return null;
    let x0=1/0,x1=-1/0,y0=1/0,y1=-1/0,z0=1/0,z1=-1/0,db=0;
    const latott=new Set();
    const jar=(n,m)=>{
      if(m>30||latott.has(n)||db>200000) return;
      latott.add(n);
      const t=tipus(R,n); if(!t) return;
      const q=bont(R,n);
      if(t==='IFCCARTESIANPOINT'){
        const c=q[0]; if(!Array.isArray(c)) return;
        const x=(c[0]||0)*H, y=(c[1]||0)*H, z=(c[2]||0)*H;
        if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
        if(z<z0)z0=z; if(z>z1)z1=z; db++; return;
      }
      const bejar=v=>{ if(!v) return;
        if(Array.isArray(v)){ for(const w of v) bejar(w); return; }
        if(v.r) jar(v.r,m+1); };
      for(const v of q) bejar(v);
    };
    jar(rep,0);
    if(db<3||!isFinite(x0)) return null;
    const a=x1-x0, b=y1-y0;
    const h=Math.max(a,b), w=Math.min(a,b);
    return [+h.toFixed(3), +w.toFixed(3), +(z1-z0).toFixed(3)];
  }
  const befoglalo=pts=>{ if(!pts||!pts.length) return [null,null];
    let x0=1/0,x1=-1/0,y0=1/0,y1=-1/0;
    for(const p of pts){ if(p[0]<x0)x0=p[0]; if(p[0]>x1)x1=p[0];
      if(p[1]<y0)y0=p[1]; if(p[1]>y1)y1=p[1]; }
    const a=x1-x0,b=y1-y0; return a>=b?[a,b]:[b,a]; };

  /* Az Archicad MINDEN zónát .INTERNAL.-nak exportál — a mintában az udvar és a
     teraszok is. Ezért a nevéből is tippelünk; a user a listán felülbírálja.
     EZ A SZÓTÁR MÁSHOL IS KELL: a geometria-varázsló táblázat-importja ugyanígy
     ismeri fel a kültérit, és ONNAN ezt olvassa (ElbaBimOlvaso.KULTERI) — hogy ne
     legyen két, egymástól elcsúszó lista. Ez a modul workerben is fut, ezért nem
     hivatkozhat kifelé; a szótár marad itt, és kifelé adjuk. */
  const ker2=v=>(typeof v==='number'&&v)?+v.toFixed(3):null;
  const KULTERI=KULTERI_MINTA;
  /* PADLÓBURKOLAT: A KOPÓRÉTEG ANYAGA. A padló összetett szerkezet: a
     modellben egy szülő burkolatelem (P3/P4/P5 — „PB 01 Lapburkolat …",
     „PB 01b Parketta …") alatt rétegek ülnek, és az ANYAG a rétegeken van,
     a szülőn nincs. Az ELBA viszont a szülőt árazza padlóburkolatként —
     enélkül a burkolat típusa üres marad, és nem lehet megmondani, hol van
     greslap és hol parketta. Ezért a szülőre RÁÍRJUK a kopóréteg anyagát. */
  const burkAnyag=new Map();         // szülő burkolat id → kopóréteg anyagneve
  {
    const gyerekei=new Map();
    for(const id of lista_('IFCCOVERING')){
      const sz2=szuloAgg.get(id); if(!sz2) continue;
      if(!gyerekei.has(sz2)) gyerekei.set(sz2,[]);
      gyerekei.get(sz2).push(id);
    }
    for(const [szulo,gyk] of gyerekei){
      if(tipus(R,szulo)!=='IFCCOVERING') continue;
      let jo=null;
      for(const gy of gyk){
        const an=anyagEl.has(gy)?anyagNev(anyagEl.get(gy)):null;
        const nev=an&&an.nev; if(!nev) continue;
        if(/^padl[óo]burkolat/i.test(nev)){ jo=nev; break; }
        if(!jo&&/burkolat|parketta|greslap|lap|sz[őo]nyeg|laminalt|lamin[áa]lt/i.test(nev)) jo=nev;
      }
      if(jo) burkAnyag.set(szulo,jo);
    }
  }
  /* HELYISÉG → PADLÓBURKOLAT. Az `IfcRelSpaceBoundary` megmondja, melyik
     zónához melyik burkolat tartozik — nem kell geometriából találgatni.
     Egy burkolatelem több helyiséghez is tartozhat (a nappali, a közlekedő és
     a konyha gyakran egy összefüggő greslap felület), és ez így is helyes:
     az ELBA-ban egy PADLÓBURKOLAT al-elembe kerülnek, soronként a helyiségek.
     Csak a PADLÓRA szűrünk: a fal- és mennyezetburkolat is IfcCovering. */
  const helyBurk=new Map();          // helyiség id → burkolat id
  for(const id of lista_('IFCRELSPACEBOUNDARY')){
    const p=bont(R,id);
    const ter=p[4]&&p[4].r, elemR=p[5]&&p[5].r;
    if(!ter||!elemR) continue;
    if(tipus(R,elemR)!=='IFCCOVERING') continue;
    const fp=foliaja(elemR);
    const pe=bont(R,elemR);
    const fajta=(pe[8]&&pe[8].e)||'';
    if(!/padl|floor/i.test(String(fp||'')+' '+fajta)&&!burkAnyag.has(elemR)) continue;
    if(!helyBurk.has(ter)) helyBurk.set(ter,elemR);
  }
  const helyisegek=lista_('IFCSPACE').map(id=>{
    const p=bont(R,id);
    const pts=poligon(id);
    const [h,w]=befoglalo(pts);
    const sz=szintje(id);
    const ps=(psetEl.get(id)||[]).map(psetKiolvas).filter(Boolean);
    /* BELMAGASSÁG. A tulajdonságok között „Építménymagasság" néven ott van, de
       az Archicad 0-t exportál bele. A ZÓNA MENNYISÉGEI viszont pontosak:
       `ClearHeight` (= tiszta belmagasság), `FinishCeilingHeight` és a magyar
       „Magasság" is ugyanazt hozza. Ezért onnan olvassuk. */
    const zq=(menyEl.has(id)?mennyisegek(menyEl.get(id),true):{sajat:{}}).sajat||{};
    const zs=n=>{ const v=zq[n]; return (typeof v==='number'&&v)?v:null; };
    const belmag=zs('ClearHeight')||zs('FinishCeilingHeight')||zs('Magasság')||zs('Height')
      ||(()=>{ for(const x of ps){ const v=x.mezok['Építménymagasság'];
        if(typeof v==='number'&&v>0) return v*H; } return null; })();
    return {gid:p[0], jel:(p[2]||'').trim(), nev:(p[7]||'').trim()||(p[2]||'').trim(),
            szint:sz?sz.nev:null,
            /* a lakás (egység) kódja — lásd egysegKod */
            _j:egysegJeloltek(p[2],ps,p[7],(csoportEl.get(id)||[]).map(csoportAdat),p[3]),
            _pl:(p[5]&&p[5].r)||null,
            belsoIfc:(p[9]&&p[9].e)==='INTERNAL',
            belso:!KULTERI.test((p[7]||p[2]||'')),
            tipp:KULTERI.test((p[7]||p[2]||''))?'a neve alapján kültéri':null,
            /* Alaprajz nélkül (más szoftver, más export) a zóna szabványos
               mennyiségeiből: Qto_SpaceBaseQuantities NetFloorArea / NetPerimeter. */
            terulet:pts?+terulet(pts).toFixed(2):ker2(zs('NetFloorArea')||zs('GrossFloorArea')||zs('Terület')),
            kerulet:pts?+kerulet(pts).toFixed(2):ker2(zs('NetPerimeter')||zs('GrossPerimeter')),
            hossz:h==null?null:+h.toFixed(2), szel:w==null?null:+w.toFixed(2),
            belmag:belmag?+belmag.toFixed(2):null,
            /* A zóna további mérőszámai: a falak felülete (belső felületképzés
               és burkolat), a padlórétegrend vastagsága, a nyílások területe
               és a sarkok száma — mindet az Archicad számolta ki, nem mi. */
            /* Archicad: „Élfelület területe (nettó)"; IFC-szabvány (Revit, Allplan…):
               Qto_SpaceBaseQuantities NetWallArea, ennek híján GrossWallArea. */
            falFelulet:ker2(zs('Élfelület területe (nettó)')||zs('Falak területe')||zs('NetWallArea')||zs('GrossWallArea')),
            mennyezet:ker2(zs('Felső felület területe (nettó)')||zs('NetCeilingArea')),
            padloVast:ker2(zs('Padló vastagsága')||zs('FinishFloorHeight')),
            nyilasTerulet:ker2((zs('Ablakok területe')||0)+(zs('Ajtók területe')||0)),
            sarok:zs('Sarkok száma')||null, konkavSarok:zs('Konkáv sarkok száma')||0,
            almennyezet:ker2(zs('Álmennyezet magassága')),
            /* A padlóburkolat, amit a modell rendelt ehhez a helyiséghez. */
            burkGid:(()=>{ const b=helyBurk.get(id); if(!b) return null;
              const bp=bont(R,b); return typeof bp[0]==='string'?bp[0]:null; })(),
            burkolat:(()=>{ const b=helyBurk.get(id); if(!b) return null;
              return burkAnyag.get(b)
                ||((anyagEl.has(b)?anyagNev(anyagEl.get(b)):null)||{}).nev||null; })(),
            poligon:pts&&pts.length<=64?pts.map(q=>[+q[0].toFixed(3),+q[1].toFixed(3)]):null};
  }).sort((a,b)=>(b.terulet||0)-(a.terulet||0));
  /* LAKÁSOK — modell-szintű döntés (T1–T5), utána a jelöltek nem kellenek */
  const egysegInfo=egysegDontes(helyisegek);
  for(const h of helyisegek) delete h._j;

  /* ELEM HELYE A TÉRBEN. A pillér falhoz rendeléséhez tudni kell, hol áll —
     ehhez elég a 2D: az `IfcLocalPlacement` láncot végigjárva a vízszintes
     eltolást és az elforgatást halmozzuk. A modellek elhelyezései a
     gyakorlatban eltolás + Z körüli forgatás, ezért a teljes 4x4-es
     mátrixszorzás felesleges lenne — ez a lánc pontos, és nagyságrenddel
     olcsóbb, mint a testek háromszögelése. */
  const helyGyorsito=new Map();
  function helyzet2D(id,mely){
    if(!id) return {x:0,y:0,z:0,c:1,s:0};
    if(helyGyorsito.has(id)) return helyGyorsito.get(id);
    if((mely||0)>12) return {x:0,y:0,z:0,c:1,s:0};
    const t=tipus(R,id);
    let ki={x:0,y:0,z:0,c:1,s:0};
    if(t==='IFCLOCALPLACEMENT'){
      const p=bont(R,id);
      const szulo=helyzet2D(p[0]&&p[0].r,(mely||0)+1);
      const sajat=helyzet2D(p[1]&&p[1].r,(mely||0)+1);
      /* gyerek a szülő rendszerében: elforgatjuk, majd eltoljuk */
      ki={ x:szulo.x + sajat.x*szulo.c - sajat.y*szulo.s,
           y:szulo.y + sajat.x*szulo.s + sajat.y*szulo.c,
           z:szulo.z + sajat.z,
           c:szulo.c*sajat.c - szulo.s*sajat.s,
           s:szulo.s*sajat.c + szulo.c*sajat.s };
    } else if(t==='IFCAXIS2PLACEMENT3D'||t==='IFCAXIS2PLACEMENT2D'){
      const p=bont(R,id);
      const loc=p[0]&&p[0].r;
      if(loc&&tipus(R,loc)==='IFCCARTESIANPOINT'){
        const c=bont(R,loc)[0]||[];
        ki.x=(+c[0]||0)*H; ki.y=(+c[1]||0)*H; ki.z=(+c[2]||0)*H;
      }
      const ref=(t==='IFCAXIS2PLACEMENT3D'?(p[2]&&p[2].r):(p[1]&&p[1].r));
      if(ref&&tipus(R,ref)==='IFCDIRECTION'){
        const d=bont(R,ref)[0]||[];
        const dx=+d[0]||0, dy=+d[1]||0;
        const h=Math.hypot(dx,dy);
        if(h>1e-9){ ki.c=dx/h; ki.s=dy/h; }
      }
    }
    helyGyorsito.set(id,ki);
    return ki;
  }
  /* --- elemek ------------------------------------------------------------- */
  halad('elemek',75,'Elemek kivonatolása…');
  const elemek=[];
  /* ÖSSZETETT ELEM TÁROLÓJA (2026-09-29). Van olyan export (Nyárfa: „Leier térkő"
     padló), ahol a szerkezet egy SAJÁT TEST NÉLKÜLI tároló (Representation = $),
     és a rétegei IfcRelAggregates-szel lógnak alatta — az anyag és a fólia a
     RÉTEGEKEN van. Ha a tárolót is besoroljuk, kétszer számolunk (a rétegek mellett
     egy másik al-elembe is bekerül), ráadásul egy téves „gyenge" javaslattal. */
  const vanResze=new Set(szuloAgg.values());
  const oszlopMinta=/(\d+(?:[.,]\d+)?)\s*[xX×]\s*(\d+(?:[.,]\d+)?)\s*$/;
  for(const [t,idk] of byType){
    if(!t.startsWith('IFC')) continue;
    if(TERBELI.has(t)||KIHAGY.has(t)) continue;
    /* Csak a valódi termékek: van GlobalId + OwnerHistory + Name + ObjectPlacement. */
    if(!/^(IFC)(WALL|SLAB|BEAM|COLUMN|COVERING|ROOF|DOOR|WINDOW|STAIR|RAMP|RAILING|PLATE|MEMBER|CURTAINWALL|FOOTING|PILE|BUILDINGELEMENT|FURNISHINGELEMENT|FLOWTERMINAL|ENERGYCONVERSIONDEVICE|DISTRIBUTIONELEMENT|FLOWSEGMENT|FLOWFITTING|TRANSPORTELEMENT|ELEMENTASSEMBLY|DISCRETEACCESSORY|FASTENER|MECHANICALFASTENER|REINFORCINGBAR|CHIMNEY|SHADINGDEVICE)/.test(t)) continue;
    if(/TYPE$|STYLE$|PROPERTIES$/.test(t)) continue;
    for(const id of idk){
      const p=bont(R,id);
      const tp=tipusEl.get(id);
      const tipusNev=tp?(nevOf(tp)||null):null;
      const an=anyagEl.has(id)?anyagNev(anyagEl.get(id)):{nev:null,retegek:null};
      const ozk=(osztEl.get(id)||[]).map(osztalyozas);
      /* A saját rendszerünk a legerősebb: ha a tervező ELBA-kódot tett az elemre,
         azzal a párosítás gyakorlatilag egy lépés. */
      const elba=ozk.find(x=>/^elba$/i.test(String(x.rendszer)));
      const oz=ozk.find(x=>x!==elba)||elba||null;
      const sz=szintje(id);
      const szulo=szuloAgg.get(id);
      const psl=(psetEl.get(id)||[]).map(psetKiolvas).filter(x=>x&&Object.keys(x.mezok).length);
      const ps={}; for(const x of psl) ps[x.nev]=Object.assign(ps[x.nev]||{},x.mezok);
      const m=menyEl.has(id)?mennyisegek(menyEl.get(id)):{L:null,A:null,V:null,db:null,sajat:{}};
      /* A típusnév vége gyakran „vastagság x magasság" — ez ingyen adat. */
      let vast=null,mag=null;
      if(tipusNev){ const mm=oszlopMinta.exec(tipusNev);
        if(mm){ vast=parseFloat(mm[1].replace(',','.'))*H; mag=parseFloat(mm[2].replace(',','.'))*H; } }
      const e={
        gid:p[0], id, ifc:t,
        nev:(p[2]||'').trim()||null,
        leiras:(p[3]||'')||null,
        tipusNev, anyag:an.nev||burkAnyag.get(id)||null, retegek:an.retegek,
        oszt:oz?oz.ertek:null, osztRendszer:oz?oz.rendszer:null,
        elbaKod:elba?elba.kod:null, elbaNev:elba?elba.nev:null,
        osztMind:ozk.length>1?ozk.map(x=>({r:x.rendszer,k:x.kod,n:x.nev})):null,
        szint:sz?sz.nev:null, szuloGid:szulo?gidOf(szulo):null, szuloIfc:szulo?tipus(R,szulo):null,
        /* Hol áll az elem, és merre néz a saját X tengelye (falnál a tengelye). */
        hely:(()=>{ const h=helyzet2D(p[5]&&p[5].r,0);
          return {x:ker2(h.x),y:ker2(h.y),z:ker2(h.z),dx:ker2(h.c),dy:ker2(h.s)}; })(),
        folia:foliaja(id),
        tarolo:(vanResze.has(id)&&!(p[6]&&p[6].r))||undefined,
        /* A ZÓNA, amelyikben az elem áll. Az Archicad a belső elemeket (válaszfal,
           burkolat, szaniter, bútor) a zónához köti — ebből tudjuk, melyik lakásé. */
        zona:(()=>{ const st=terben.get(id); return (st&&tipus(R,st)==='IFCSPACE')?gidOf(st):undefined; })(),
        /* nyílászárónál a határolt helyiségek (két oldala) */
        zonak:((t==='IFCDOOR'||t==='IFCWINDOW')&&hatarolt.has(id))
          ? hatarolt.get(id).map(gidOf).filter(Boolean) : undefined,
        vastagsag:vast, magassag:mag,
        menny:{L:m.L,A:m.A,V:m.V,db:m.db},
        q:Object.keys(m.sajat).length?m.sajat:null,
        pset:ps
      };
      /* ALAPRAJZI KITERJEDÉS. Az ELBA az épület HOSSZÁT és SZÉLESSÉGÉT kérdezi
         (ebből számol tetőt, koszorút, munkaterületet), a mennyiséglista
         viszont csak területet és térfogatot ad. A födém, a lemezalap és a
         tető FootPrint-poligonja megvan a modellben — abból a befoglaló
         téglalap közvetlenül kijön, és nem kell egyenértékű téglalapot
         becsülni. Csak ezekre kérjük le, mert a poligon-olvasás nem ingyen van. */
      /* geometriából pótolt mennyiség (lásd extruzio / tengelyHossz) */
      if(/^IFCWALL/.test(t)&&!(e.q&&(e.q['Hossz']||e.q['Fal hossza a külső oldalon']||e.q['Fal hossza a belső oldalon']||e.q['Téglalap összetevő magassága']))){
        const L=tengelyHossz(id), ex=extruzio(id);
        const Hm=ex&&ex.iranyZ?ex.melyseg:null;
        const v=(e.retegek||[]).reduce((a,r)=>a+(r.vast||0),0)||vast||null;
        if(L&&Hm){ e.q=Object.assign({},e.q||{},{'Hossz':+L.toFixed(4),'Magasság':+Hm.toFixed(4)},v?{'Vastagság':+v.toFixed(4)}:{});
          e.menny=Object.assign({},e.menny,{L:e.menny.L||+L.toFixed(4),A:e.menny.A||+(L*Hm).toFixed(4),
            V:e.menny.V||(ex.terulet?+(ex.terulet*Hm).toFixed(4):null)});
          e.geoMenny=1; }
      }
      if((t==='IFCSLAB'||t==='IFCCOVERING')&&!(e.q&&(e.q['Födém felső felületének területe (bruttó)']||e.q['Összetevő vetített területe (bruttó)']))){
        const ex=extruzio(id);
        if(ex&&ex.iranyZ&&ex.terulet){
          e.q=Object.assign({},e.q||{},{'Födém felső felületének területe (bruttó)':+ex.terulet.toFixed(4)},
            ex.kerulet?{'Kerület':+ex.kerulet.toFixed(4)}:{}, ex.melyseg?{'Vastagság':+ex.melyseg.toFixed(4)}:{});
          e.menny=Object.assign({},e.menny,{A:e.menny.A||+ex.terulet.toFixed(4),V:e.menny.V||(ex.melyseg?+(ex.terulet*ex.melyseg).toFixed(4):null)});
          e.geoMenny=1;
          if(ex.prof&&ex.prof.pts&&ex.prof.pts.length>2&&!e.alaprajz){ const [h,w]=befoglalo(ex.prof.pts);
            e.alaprajz={hossz:+h.toFixed(3), szel:+w.toFixed(3), terulet:+ex.terulet.toFixed(3), kerulet:+(ex.kerulet||0).toFixed(3)}; }
        }
      }
      if(t==='IFCSLAB'||t==='IFCROOF'){
        const pts=poligon(id);
        if(pts&&pts.length>2){
          const [h,w]=befoglalo(pts);
          e.alaprajz={hossz:+h.toFixed(3), szel:+w.toFixed(3),
                      terulet:+terulet(pts).toFixed(3), kerulet:+kerulet(pts).toFixed(3)};
        } else {
          const b=brepBefoglalo(id);
          if(b) e.alaprajz={hossz:b[0], szel:b[1], magassag:b[2]};
        }
      }
      /* nyílászáró: névleges méret és a befogadó fal */
      if(t==='IFCDOOR'||t==='IFCWINDOW'){
        /* IfcDoor / IfcWindow = (…, Tag, OverallHeight, OverallWidth) —
           a MAGASSÁG áll elöl. Fordítva véve az ablak 150×180 helyett
           180×150 lenne, és a konszignáció csendben hibás méreteket adna. */
        e.nyilasMagassag=typeof p[8]==='number'?p[8]*H:null;
        e.szelesseg=typeof p[9]==='number'?p[9]*H:null;
        const fal=beepitve.get(id); if(fal) e.falGid=gidOf(fal);
        e.kulso=!!(ps['Pset_DoorCommon']&&ps['Pset_DoorCommon'].IsExternal)||
                !!(ps['Pset_WindowCommon']&&ps['Pset_WindowCommon'].IsExternal);
      }
      elemek.push(e);
    }
  }

  /* BEFOGADÓ FAL A HELYBŐL (2026-10-04). Az IfcRelFillsElement /
     IfcRelVoidsElement megmondja, melyik falban áll a nyílászáró — de nem
     minden export írja ki (az Olimpikonban egyetlen ilyen kapcsolat sincs).
     Enélkül minden ajtó a legnagyobb falcsoportba esett: a 10 cm-es válaszfal
     ajtaja 30 cm-es falvastagságot és kávát kapott, és a nyílást is a rossz
     falból vonta le a motor. A szabály általános: a nyílászáró elhelyezési
     pontja a befogadó fal REFERENCIAVONALÁN (vagy a falon belül) van, és a
     nyílászáró iránya párhuzamos a faléval. Jelölt az a fal, amelyik
       · ugyanazon a szinten van, párhuzamos,
       · a pontra merőleges távolsága legfeljebb a fal vastagsága,
       · és a hossza mentén a pont a falon van (a végeken 5 cm tűréssel).
     Több jelölt (két egyenes fal találkozása) közül az nyer, amelyik közelebb
     van, amelyiknek a modell szerint VAN nyílása, és amelyiknek a belsejébe
     (nem a végére) esik a pont. Olimpikon: 607 nyílásból 603. */
  {
    const falHossz=e=>{ const q=e.q||{}; let m=0;
      for(const k of ['Fal hossza a külső oldalon','Fal hossza a belső oldalon','Fal belső oldalának hossza (feltételes)',
        'Fal külső oldalának hossza (feltételes)','Length','Hossz']){ const v=Number(q[k]); if(v>m) m=v; }
      return m||null; };
    const falNyilas=e=>{ const q=e.q||{}; return (Number(q['Pontos nyílásterület a belső oldalon'])||0)
      +(Number(q['Pontos nyílásterület a külső oldalon'])||0)+(Number(q['Ablakok területe'])||0)+(Number(q['Ajtók területe'])||0); };
    const falSzint=new Map();
    for(const w of elemek){ if(!/^IFCWALL/.test(w.ifc||'')||w.szuloGid||!w.hely) continue;
      const L=falHossz(w); if(!L) continue;
      let l=falSzint.get(w.szint); if(!l){ l=[]; falSzint.set(w.szint,l); } l.push({w,L}); }
    for(const e of elemek){
      if(e.falGid||!/^IFC(DOOR|WINDOW)$/.test(e.ifc||'')||!e.hely) continue;
      const dx=e.hely.dx||0, dy=e.hely.dy||0; let jo=null;
      for(const {w,L} of (falSzint.get(e.szint)||[])){
        const wx=w.hely.dx||0, wy=w.hely.dy||0;
        if(Math.abs(dx*wy-dy*wx)>0.05) continue;
        const ux=e.hely.x-w.hely.x, uy=e.hely.y-w.hely.y;
        const menten=ux*wx+uy*wy, meroleges=Math.abs(-ux*wy+uy*wx), t=w.vastagsag||0.3;
        if(menten<-0.05||menten>L+0.05||meroleges>t+0.05) continue;
        const pont=meroleges*10+(falNyilas(w)>0?0:1)+((menten<0.02||menten>L-0.02)?0.5:0);
        if(!jo||pont<jo.pont) jo={w,pont};
      }
      if(jo){ e.falGid=jo.w.gid; e.falHelybol=true; }
    }
  }
  /* A ZÓNA HELYE. A padlópoligon a zóna SAJÁT koordinátarendszerében van; hogy
     egy elem (pl. a zónához nem kötött ajtó) helyét össze lehessen vetni vele,
     kell a zóna eltolása és elforgatása is. */
  for(const h of helyisegek){
    if(h._pl&&h.poligon){ const t=helyzet2D(h._pl,0);
      h.hely={x:ker2(t.x),y:ker2(t.y),c:+t.c.toFixed(6),s:+t.s.toFixed(6)}; }
    delete h._pl;
  }
  /* --- tömörítés ----------------------------------------------------------
     A kivonat a projekt `meta` mezőjébe kerül, ezért minden fölösleges bájt
     számít: a null mezőket és az üres alobjektumokat kidobjuk. Az „üres"
     tulajdonságcsoportokat (csak státusz, csak nulla) sem tartjuk meg.
     ---------------------------------------------------------------------- */
  halad('osszesites',88,'Tömörítés…');
  const PSET_ZAJ=new Set(['AC_Pset_RenovationAndPhasing','Pset_ManufacturerOccurrence',
    'Pset_ManufacturerTypeInformation','GYÁRTÁS','KÖRNYEZETVÉDELEM','HELYISÉGEK']);
  const ker=(v,t)=>typeof v==='number'?+v.toFixed(t):v;
  /* MENNYISÉG A TESTBŐL (2026-10-04). Ami után így sincs mennyiség (nincs
     IfcElementQuantity, és nem egyszerű extrúzió — pl. Brep test, réteg,
     gerenda, pillér, tárgy), annak a mértékeit a háromszögelt testből vesszük
     (ElbaBimGeometria.mertekek), ha a geometria-modul be van töltve. A kulcsok
     ugyanazok, mint az Archicad mennyiséglistájában — a szabályok így nem
     tudják, honnan jött az érték. Csak a HIÁNYZÓ kulcsot töltjük. */
  {
    const MERET=/^IFC(SLAB|COVERING|ROOF|FOOTING|BUILDINGELEMENTPART|WALL|WALLSTANDARDCASE|COLUMN|BEAM|MEMBER|PLATE|STAIR|STAIRFLIGHT|RAMP|RAMPFLIGHT|RAILING|BUILDINGELEMENTPROXY|CHIMNEY)$/;
    const hiany=elemek.filter(e=>!e.tarolo&&MERET.test(e.ifc)&&!(e.q&&Object.keys(e.q).length));
    const G=gyoker.ElbaBimGeometria;
    if(hiany.length&&G&&G.mertekek){
      halad('osszesites',90,'Mennyiség a testekből ('+hiany.length+' elem)…');
      let M={}; try{ M=G.mertekek(szoveg,{R,hosszSzorzo:H,gidk:hiany.map(e=>e.gid)})||{}; }catch(err){ M={}; }
      for(const e of hiany){ const m=M[e.gid]; if(!m||!(m.V>0||m.felso>0||m.oldal>0)) continue;
        const q={};
        const fekvo=/^IFC(SLAB|COVERING|ROOF|FOOTING)$/.test(e.ifc)||(m.vetulet>0.5*m.oldal&&m.magassag<Math.max(m.hossz,m.szel)*0.5);
        const vonal=/^IFC(BEAM|MEMBER)$/.test(e.ifc), oszlop=e.ifc==='IFCCOLUMN';
        if(vonal){
          const L=Math.max(m.hossz,m.magassag);
          Object.assign(q,{'Hossz':L,'Szélesség':m.szel,'Magasság':Math.min(m.magassag,m.hossz)||m.magassag,'Térfogat (bruttó)':m.V,'Térfogat (nettó)':m.V,'GrossVolume':m.V});
        } else if(oszlop){
          Object.assign(q,{'Magasság':m.magassag,'Hossz':m.magassag,'Szélesség':m.hossz,'Térfogat (bruttó)':m.V,'Térfogat (nettó)':m.V});
          if(e.vastagsag==null) e.vastagsag=m.szel; if(e.magassag==null) e.magassag=m.hossz;
        } else if(fekvo){
          const t=m.vetulet>0?m.V/m.vetulet:null;
          Object.assign(q,{'Födém felső felületének területe (bruttó)':m.felso,'Felső felület területe (bruttó)':m.felso,
            'Felső felület területe (általános)':m.vetulet,'Alsó felület területe (bruttó)':m.also,'Alsó felület területe (nettó)':m.also,
            'GrossArea':m.vetulet,'NetArea':m.vetulet,'Összetevő vetített területe (bruttó)':m.vetulet,'Összetevő vetített területe (nettó)':m.vetulet,
            'Élfelület területe (bruttó)':m.oldal,'Élfelület területe (nettó)':m.oldal,'Felület területe':m.felso,
            'Térfogat (bruttó)':m.V,'Térfogat (nettó)':m.V,'Összetevő térfogata (bruttó)':m.V,'Összetevő térfogata (nettó)':m.V,'GrossVolume':m.V,'NetVolume':m.V});
          if(t) Object.assign(q,{'Vastagság':t});
          if(e.ifc==='IFCROOF') Object.assign(q,{'Tető felső felületének területe (bruttó)':m.felso,'Tető alsó felületének területe (bruttó)':m.also});
        } else {
          /* álló elem (fal, falréteg, tárgy): hossz × magasság × vastagság */
          const L=m.hossz, Hm=m.magassag, w=(L&&Hm)?m.V/(L*Hm):m.szel;
          Object.assign(q,{'Hossz':L,'Magasság':Hm,'Vastagság':w,'Fal hossza a külső oldalon':L,
            'Téglalap összetevő szélessége':w,'Téglalap összetevő magassága':Hm,'Összetevő keresztmetszeti területe':w*Hm,
            'Összetevő vetített területe (bruttó)':L*Hm,'Összetevő vetített területe (nettó)':L*Hm,
            'Fal külső oldala felületének területe (bruttó)':L*Hm,'Fal belső oldala felületének területe (bruttó)':L*Hm,'GrossSideArea':L*Hm,
            'Térfogat (bruttó)':m.V,'Térfogat (nettó)':m.V,'Összetevő térfogata (bruttó)':m.V,'Összetevő térfogata (nettó)':m.V});
        }
        for(const k of Object.keys(q)) if(!(q[k]>0)) delete q[k];
        if(!Object.keys(q).length) continue;
        e.q=Object.assign(q,e.q||{});
        e.menny=Object.assign({},e.menny||{},{V:(e.menny&&e.menny.V)||m.V||null,A:(e.menny&&e.menny.A)||(fekvo?m.vetulet:null)||null});
        e.geoMenny=2;
      }
    }
  }
  for(const e of elemek){
    for(const k of ['vastagsag','magassag','szelesseg','nyilasMagassag']) if(e[k]!=null) e[k]=ker(e[k],4);
    if(e.q){ for(const k of Object.keys(e.q)) e.q[k]=ker(e.q[k],4); }
    if(e.menny){ for(const k of ['L','A','V','db']) if(e.menny[k]!=null) e.menny[k]=ker(e.menny[k],4);
      if(e.menny.L==null&&e.menny.A==null&&e.menny.V==null&&e.menny.db==null) delete e.menny; }
    if(e.retegek) for(const r of e.retegek) if(r.vast!=null) r.vast=ker(r.vast,4);
    for(const nev of Object.keys(e.pset||{})) if(PSET_ZAJ.has(nev)) delete e.pset[nev];
    if(e.pset&&!Object.keys(e.pset).length) delete e.pset;
    for(const k of Object.keys(e)) if(e[k]===null||e[k]===undefined||e[k]==='') delete e[k];
  }
  for(const h of helyisegek) for(const k of Object.keys(h)) if(h[k]===null||h[k]==='') delete h[k];

  /* --- TETŐ GEOMETRIÁJA (2026-10-12) ----------------------------------------
     A magastető síkjai, élei (eresz, gerinc, élszarufa, vápa, orom) és az ELBA
     ábrája szerinti bontása (fő tető + tetőszakaszok) a tetőtestek háromszögeiből
     — lásd ElbaBimGeometria.tetoBontas. Csak ha a geometria-modul be van töltve. */
  let teto=null;
  { const G=gyoker.ElbaBimGeometria;
    if(G&&G.tetoElemzes){
      /* MELYIK TEST A HÉJALÁS: elsősorban a neve/fóliája mondja (héjalás, tetőfedés,
         cserép…). Az osztályozásra nem hagyatkozunk — a Naszályban a héjalás
         „Lapostető" osztályú. Ha semmi ilyen nincs, a tető-nevű IFCROOF/IFCSLAB. */
      const EROS=/h[ée]jal|tet[őo]\s*fed|fed[ée]s|cser[ée]p|zsindely|\bpala\b|h[ée]j\s*-\s*tet|roof\s*cover/i,
            NEM_TETO=/tart[óo]szerk|terasz|f[öo]d[ée]m|padl[óo]|[áa]lmennyez|szigetel|p[áa]ra|f[óo]lia|\bl[ée]c|deszk|ereszcsatorna|lefoly|kieg[ée]sz[íi]t|dobozol/i;
      const ix=new Map(elemek.map(e=>[e.gid,e]));
      const szov=e=>e?[e.nev,e.folia,e.tipusNev,e.anyag].filter(Boolean).join(' '):'';
      const jelolt=e=>/^IFC(ROOF|SLAB|COVERING|BUILDINGELEMENTPART|PLATE)$/.test(e.ifc);
      const sz2=e=>szov(e)+' '+szov(e.szuloGid?ix.get(e.szuloGid):null);
      let gidk=elemek.filter(e=>jelolt(e)&&EROS.test(sz2(e))&&!NEM_TETO.test(sz2(e))).map(e=>e.gid);
      if(!gidk.length) gidk=elemek.filter(e=>/^IFC(ROOF|SLAB)$/.test(e.ifc)&&/tet[őo]|roof/i.test(sz2(e)+' '+(e.oszt||''))
        &&!NEM_TETO.test(sz2(e))&&!/lapos/i.test(e.oszt||'')).map(e=>e.gid);
      /* CSARNOK (2026-10-27, Biogáz): a tető csak a hőszigetelésével van megrajzolva,
         „Tető" osztályú proxyként — a tető alakja ebből is kijön. Csak csarnokgyanúnál. */
      if(!gidk.length&&csarnokGyanu(elemek,szintek)) gidk=elemek.filter(e=>!e.szuloGid&&/^tet[őo]$/i.test(String(e.oszt||''))
        &&/^IFC(BUILDINGELEMENTPROXY|COVERING|ROOF|SLAB)$/.test(e.ifc)).map(e=>e.gid);
      if(gidk.length){
        halad('osszesites',92,'Tető síkjai és élei…');
        try{ teto=G.tetoElemzes(szoveg,{R,hosszSzorzo:H,gidk}); }catch(err){ teto=null; }
        if(teto) teto.gidDb=gidk.length;
      }
    }
  }

  /* --- HŐHÍDMEGSZAKÍTÓ INDÍTÓSOR (2026-10-12) ------------------------------
     Balázs: „A modellből beolvashatná, hogy a falak alsó részén van-e más anyagú
     fal, ebből lenne a hőhídmegszakító, ha nincs ilyen, akkor nem töltöm ki-vel
     jönne létre." Lásd hohidKeres. */
  { const G=gyoker.ElbaBimGeometria;
    const dobozFn=(G&&G.dobozok)?(gidk=>{ try{ return G.dobozok(szoveg,{R,hosszSzorzo:H,gidk}); }catch(err){ return null; } }):null;
    try{ hohidKeres(elemek,dobozFn); }catch(err){}
    try{ if(dobozFn) athidaloKeres(elemek,dobozFn); }catch(err){}
    /* ALSÓ SÍKOK A TERV ±0,00-TÓL (2026-10-12, Balázs: „Földtükör szintje az eredeti
       terepszinttől — a vasalt aljzat/lemezalap alsó síkja és a terepszint (terv 0
       szint) közötti különbség"). A két legalsó szint födémjeinek és rétegeinek alja
       és teteje (e.zAlja, e.zTeteje, méter, a ±0-hoz mérve). */
    try{ if(G&&G.dobozok&&G.szintNulla){
      const nulla=G.szintNulla(szoveg,{R,hosszSzorzo:H,szintek});
      const lent=new Set(szintek.filter(x=>x.magassag!=null).slice(0,2).map(x=>x.nev));
      const jel=nulla==null?[]:elemek.filter(e=>lent.has(e.szint)&&/^IFC(SLAB|FOOTING|BUILDINGELEMENTPART|COVERING)$/.test(e.ifc||''));
      if(jel.length){ const d=G.dobozok(szoveg,{R,hosszSzorzo:H,gidk:jel.map(e=>e.gid),vilag:true})||{};
        for(const e of jel){ const b=d[e.gid]; if(!b) continue;
          e.zAlja=Math.round((b.z0-nulla)*1000)/1000; e.zTeteje=Math.round((b.z1-nulla)*1000)/1000; } }
    } }catch(err){} }

  /* --- TARTÓSZERKEZET-JELÖLTEK ALAKJA (2026-11-16) ----------------------------
     Az energetika szál összevetése (PDF-modell ↔ IFC, docs/ELBA-atadas.md): a
     proxy-exportban (iTWO, Nyárfa) a „VASBETON pillér 300" típusnevet a koszorú és
     az áthidaló is viseli, a „VASBETON pillér 150"-et a födémlemez — a név nem dönt,
     az ALAK igen. A javaslat (ElbaBimEpito, tartoAlak) ehhez a befoglaló dobozt kéri:
     pillér = függőleges (≥ 1,5 m, vízszintesen ≤ 0,8 m), gerenda/koszorú = vízszintes
     (0,1–0,9 m magas), lemez. Csak a jelöltekre (pillér/oszlop/gerenda/koszorú nevű
     vagy beton anyagú proxy, oszlop, gerenda), legfeljebb 2000 elemre. */
  try{ const G=gyoker.ElbaBimGeometria;
    if(G&&G.dobozok){
      const TARTO_JEL=/pill[ée]r|oszlop|gerenda|koszor[úu]|\bvb\b|vasbeton|beton/i;
      const jel=elemek.filter(e=>!e.doboz&&!e.tarolo&&(/^IFC(COLUMN|BEAM|MEMBER)$/.test(e.ifc)
        ||(e.ifc==='IFCBUILDINGELEMENTPROXY'&&TARTO_JEL.test([e.tipusNev,e.anyag,e.nev].filter(Boolean).join(' ')))));
      if(jel.length&&jel.length<=2000){
        const d=G.dobozok(szoveg,{R,hosszSzorzo:H,gidk:jel.map(e=>e.gid),vilag:true})||{};
        const k3=v=>Math.round(v*1000)/1000;
        for(const e of jel){ const b=d[e.gid]; if(!b||!isFinite(b.x0)) continue;
          e.doboz={x0:k3(b.x0),x1:k3(b.x1),y0:k3(b.y0),y1:k3(b.y1),z0:k3(b.z0),z1:k3(b.z1)}; }
      }
    } }catch(err){}

  /* --- CSARNOK: BEFOGLALÓ DOBOZOK (2026-10-27) -------------------------------
     A csarnok-építés (ElbaBimEpito) a csarnok alaprajzát a falak, nyílászárók és a
     tető dobozából veszi, és ebből dönti el, melyik födém a csarnoké — a telepi
     modellben (Biogáz) a környező burkolatok, tartályok födémjei is benne vannak.
     A pontalap méretei is ebből jönnek, ha a modell nem írja ki. Csak
     csarnokgyanúnál: lakóháznál nincs rá szükség, és nagy modellnél időbe kerül. */
  try{ const G=gyoker.ElbaBimGeometria;
    if(G&&G.dobozok&&elemek.length<=4000&&csarnokGyanu(elemek,szintek)){
      const jel=elemek;
      const d=G.dobozok(szoveg,{R,hosszSzorzo:H,gidk:jel.map(e=>e.gid),vilag:true})||{};
      const k3=v=>Math.round(v*1000)/1000;
      for(const e of jel){ const b=d[e.gid]; if(!b||!isFinite(b.x0)) continue;
        e.doboz={x0:k3(b.x0),x1:k3(b.x1),y0:k3(b.y0),y1:k3(b.y1),z0:k3(b.z0),z1:k3(b.z1)}; }
    } }catch(err){}

  /* --- összesítők --------------------------------------------------------- */
  halad('osszesites',94,'Összesítés…');
  const szamlal=(f)=>{ const m=new Map();
    for(const e of elemek){ const k=f(e); if(k==null) continue; m.set(k,(m.get(k)||0)+1); }
    return [...m].map(([ertek,db])=>({ertek,db})).sort((a,b)=>b.db-a.db); };

  const kivonat={
    fejlec:fej,
    hosszSzorzo:H,
    projekt:(function(){ const id=lista_('IFCPROJECT')[0]; if(!id) return null;
      const p=bont(R,id); return {nev:p[2]||null,leiras:p[3]||null,fazis:p[6]||null}; })(),
    szintek, helyisegek, elemek, egysegInfo, teto,
    osztalyozasok:szamlal(e=>e.oszt),
    elbaKodok:szamlal(e=>e.elbaKod?(e.elbaKod+(e.elbaNev?' — '+e.elbaNev:'')):null),
    rendszerek:szamlal(e=>e.osztRendszer),
    anyagok:szamlal(e=>e.anyag),
    tipusok:szamlal(e=>e.tipusNev),
    foliak:szamlal(e=>e.folia),
    statisztika:{
      rekord:R.idLista.length,
      elem:elemek.length,
      szint:szintek.length,
      helyiseg:helyisegek.length,
      osztalyozott:elemek.filter(e=>e.oszt).length,
      elbaval:elemek.filter(e=>e.elbaKod).length,
      anyaggal:elemek.filter(e=>e.anyag).length,
      foliaval:elemek.filter(e=>e.folia).length,
      mennyiseggel:elemek.filter(e=>e.menny&&(e.menny.V||e.menny.A||e.menny.L)).length
    }
  };
  halad('kesz',100,'Kész.');
  return kivonat;
}

/* HŐHÍDMEGSZAKÍTÓ: a fal ALJÁN lévő, a falazattól eltérő anyagú alacsony sor.
   Három alak:
     a) a név mondja (hőhídmegszakító, Thermomur, Isomur, Purenit, habüveg…) —
        a fal rétege vagy a fal maga;
     b) a fal rétegei között egy ≤ 60 cm magas, más anyagú falazó réteg a fal
        alján (a test dobozából látjuk, hogy alul van; pórusbeton / habüveg
        anyagnál a doboz nélkül is elfogadjuk);
     c) külön, ≤ 60 cm magas falazott fal, amelyen egy másik fal áll.
   Eredmény: a fölötte lévő (vagy a saját) falon `hhAlso` = {anyag, mag, vast},
   az indítósor elemein (és rétegein) `hhSor` = a fal gid-je — az építő ezeket
   nem számolja a falazatba, hanem a fal HH tételébe írja. */
const HH_SZO=/h[őo]h[íi]d|thermo\s*-?\s*mur|isomur|purenit|foamglas|perinsul|hab[üu]veg|ind[íi]t[óo]\s*sor/i;
const HH_ANYAG=/p[óo]rusbeton|g[áa]zbeton|ytong|hebel|hab[üu]veg|foamglas|h[őo]szigetelt\s*beton/i;
const FALAZO=/falaz|t[ée]gla|blokk|ker[áa]mia|m[ée]szhomok|p[óo]rusbeton|g[áa]zbeton|ytong|hab[üu]veg/i;
const HH_NEM=/vasbeton|monolit|zsaluk[őo]|szigetel(?!t\s*beton)|vakolat|bitumen|f[óo]lia|EPS|XPS|gyapot|koszor[úu]/i;
/* CSARNOKGYANÚ (2026-10-27) — gyors előszűrő a drágább geometriai lépésekhez.
   Nem dönt: a csarnok-felismerés az építőben van (ElbaBimEpito, csarnokFelismer).
   Jel: legalább 4,5 m-es szintmagasság, vagy csarnokra jellemző elemnév. */
const CSARNOK_NEV=/szendvics|sandwich|trap[ée]zlemez|ipari padl|keretszerk|\bIPE\s?\d|\bHE[AB]\s?\d|szelemen|csarnok|szekcion|\bZ\d{3}\s*\/|melegen ?h/i;
function csarnokGyanu(elemek,szintek){
  const m=(szintek||[]).map(s=>s.magassag).filter(v=>v!=null).sort((a,b)=>a-b);
  for(let i=1;i<m.length;i++) if(m[i]-m[i-1]>=4.5) return true;
  return (elemek||[]).some(e=>CSARNOK_NEV.test(String(e.tipusNev||'')+' '+String(e.nev||'')+' '+String(e.anyag||'')));
}
function hohidKeres(elemek,dobozFn){
  const sz=(x)=>typeof x==='number'?x:parseFloat(String(x==null?'':x).replace(',','.'));
  const mag=e=>{ const q=e.q||{}; const v=sz(q['Téglalap összetevő magassága'])||sz(q['Magasság'])||sz(e.magassag); return isFinite(v)&&v>0?v:null; };
  const vast=e=>{ const q=e.q||{}; const v=sz(q['Téglalap összetevő szélessége'])||sz(q['Vastagság'])||sz(q['Szélesség'])||sz(e.vastagsag); return isFinite(v)&&v>0?v:null; };
  const szov=e=>[e.nev,e.tipusNev,e.anyag].filter(Boolean).join(' ');
  const falak=elemek.filter(e=>/^IFCWALL/.test(e.ifc||'')&&!e.szuloGid);
  const reszek=new Map();
  for(const e of elemek) if(e.szuloGid){ let l=reszek.get(e.szuloGid); if(!l){ l=[]; reszek.set(e.szuloGid,l); } l.push(e); }
  const jel=(f,x,ok)=>{ f.hhAlso={anyag:x.anyag||x.tipusNev||x.nev||'', mag:mag(x), vast:vast(x)||vast(f), gid:x.gid, ok};
    x.hhSor=f.gid; for(const r of (reszek.get(x.gid)||[])) r.hhSor=f.gid; };
  const alacsony=[];
  for(const f of falak){
    const r=reszek.get(f.gid)||[];
    const nevben=r.find(x=>HH_SZO.test(szov(x)));
    if(nevben){ jel(f,nevben,'a réteg neve'); continue; }
    const m=mag(f);
    if(m&&m<=0.6&&(HH_SZO.test(szov(f))||((HH_ANYAG.test(szov(f))||FALAZO.test(szov(f))||r.some(x=>FALAZO.test(szov(x))))&&!HH_NEM.test(szov(f))))){ alacsony.push(f); continue; }
    /* b) más anyagú, alacsony falazó réteg */
    const falazo=r.filter(x=>FALAZO.test(String(x.anyag||''))&&!HH_NEM.test(String(x.anyag||'')));
    if(falazo.length<2) continue;
    const fo=falazo.reduce((a,x)=>(mag(x)||0)>(mag(a)||0)?x:a);
    const also=falazo.filter(x=>x!==fo&&mag(x)&&mag(x)<=0.6&&String(x.anyag)!==String(fo.anyag));
    if(!also.length) continue;
    let d=null; if(dobozFn) d=dobozFn([fo.gid].concat(also.map(x=>x.gid)));
    for(const x of also){
      const dx=d&&d[x.gid], df=d&&d[fo.gid];
      const alul=(dx&&df)?(dx.z1<=df.z0+0.05&&dx.z0<=df.z0):HH_ANYAG.test(String(x.anyag||''));
      if(alul){ jel(f,x,dx?'a fal alján (test)':'anyag'); break; }
    }
  }
  /* c) külön alacsony fal, amin egy másik áll */
  if(alacsony.length&&dobozFn){
    const szintek=new Set(alacsony.map(e=>e.szint));
    const tobbi=falak.filter(f=>szintek.has(f.szint)&&alacsony.indexOf(f)<0);
    const d=dobozFn(alacsony.concat(tobbi).map(e=>e.gid))||{};
    for(const a of alacsony){ const da=d[a.gid]; if(!da) continue;
      const cx=(da.x0+da.x1)/2, cy=(da.y0+da.y1)/2;
      const fent=tobbi.filter(f=>{ const df=d[f.gid]; return df&&Math.abs(df.z0-da.z1)<=0.05
        &&cx>=df.x0-0.1&&cx<=df.x1+0.1&&cy>=df.y0-0.1&&cy<=df.y1+0.1; });
      for(const f of fent) if(!f.hhAlso){ f.hhAlso={anyag:a.anyag||a.tipusNev||a.nev||'',mag:mag(a),vast:vast(a),gid:a.gid,ok:'alatta külön fal'}; }
      if(fent.length){ a.hhSor=fent[0].gid; for(const r of (reszek.get(a.gid)||[])) r.hhSor=fent[0].gid; }
    }
  }
}

/* ÁTHIDALÓ A NYÍLÁS FÖLÖTT (2026-10-12, Balázs: „kiváltókat talált-e a
   modellben - ha nem talált, akkor automatikusan létrehozza"). A gerenda és a
   nyílás testének dobozából: a gerenda a nyílás teteje fölött ≤ 60 cm-en belül
   kezdődik, alaprajzban fedi a nyílást, és legalább olyan hosszú. A nyílás
   `athidalo` mezője a gerenda gid-je — az építő ezeknek nem generál kiváltót. */
const ATHIDALO_NEV=/[áa]thidal|kiv[áa]lt[óo]|\bNEO\s*\d+\s*x\s*\d+|\bA\.?\s?NEO\b|porotherm\s+a\s?\d/i;
function athidaloKeres(elemek,dobozFn){
  const reszek=new Map();
  for(const e of elemek) if(e.szuloGid){ let l=reszek.get(e.szuloGid); if(!l){ l=[]; reszek.set(e.szuloGid,l); } l.push(e); }
  const gerendak=elemek.filter(e=>{ if(e.ifc!=='IFCBEAM') return false;
    const nev=(e.tipusNev||'')+' '+(e.nev||''); const an=(reszek.get(e.gid)||[]).map(x=>x.anyag||'').join(' ')+' '+(e.anyag||'');
    return ATHIDALO_NEV.test(nev)||(/t[ée]gla|ker[áa]mia/i.test(an)&&/beton/i.test(an)); });
  if(!gerendak.length) return;
  const nyilasok=elemek.filter(e=>/^IFC(WINDOW|DOOR)$/.test(e.ifc||''));
  if(!nyilasok.length) return;
  const gyerek=e=>[e].concat(reszek.get(e.gid)||[]);
  const d=dobozFn(gerendak.flatMap(gyerek).concat(nyilasok.flatMap(gyerek)).map(e=>e.gid))||{};
  /* a test lehet a darabjaiban (Porotherm NEO: tégla köpeny + vasbeton mag) */
  const unio=e=>{ let u=null; for(const x of gyerek(e)){ const b=d[x.gid]; if(!b) continue;
    if(!u) u=Object.assign({},b); else { u.x0=Math.min(u.x0,b.x0); u.x1=Math.max(u.x1,b.x1); u.y0=Math.min(u.y0,b.y0); u.y1=Math.max(u.y1,b.y1); u.z0=Math.min(u.z0,b.z0); u.z1=Math.max(u.z1,b.z1); } }
    return u; };
  for(const g of gerendak) d[g.gid]=unio(g);
  for(const n of nyilasok){ d[n.gid]=unio(n); const dn=d[n.gid]; if(!dn) continue;
    const w=Math.max(dn.x1-dn.x0,dn.y1-dn.y0);
    const b=gerendak.find(g=>{ const dg=d[g.gid]; if(!dg) return false;
      if(dg.z0<dn.z1-0.05||dg.z0>dn.z1+0.6) return false;
      const ox=Math.min(dg.x1,dn.x1+0.2)-Math.max(dg.x0,dn.x0-0.2), oy=Math.min(dg.y1,dn.y1+0.2)-Math.max(dg.y0,dn.y0-0.2);
      return ox>0&&oy>0&&Math.max(dg.x1-dg.x0,dg.y1-dg.y0)>=w-0.05; });
    if(b) n.athidalo=b.gid;
  }
}

gyoker.ElbaBimOlvaso={olvas,_hohidKeres:hohidKeres,_athidaloKeres:athidaloKeres,KULTERI:KULTERI_MINTA,egysegKod,egysegJeloltek,egysegDontes,EGYSEG_FORRAS,
  _bont:bont,_rekordok:Rekordok,_fejlec:fejlec,_szovegDekod:szovegDekod};
})(typeof self!=='undefined'?self:(typeof globalThis!=='undefined'?globalThis:this));
if(typeof module!=='undefined'&&module.exports) module.exports=(typeof self!=='undefined'?self:globalThis).ElbaBimOlvaso;
