#!/usr/bin/env python3
"""WinWatt „Energetikai számítás” PDF (pdftotext -layout) → JSON a mi számításunkkal való összevetéshez.
Csak számadatokat és szerkezetneveket ment (személyes adatot nem). Használat: ww_parse.py be.pdf ki.json"""
import json, re, subprocess, sys

def num(s):
    s = s.strip()
    if s in ('-', ''): return None
    try: return float(s.replace('−', '-').replace(' ', '').replace(',', '.'))
    except ValueError: return None

def szoveg(pdf):
    return subprocess.run(['pdftotext', '-layout', pdf, '-'], capture_output=True, text=True).stdout

def tisztit(sorok):
    """Oldalfejléc/lábléc sorok eltávolítása."""
    ki = []
    for s in sorok:
        if 'WinWatt' in s or 'bausoft' in s.lower() or '.wwp' in s or re.match(r'^\S.*számítás\s+\d+\s*$', s.strip()) and len(s) - len(s.lstrip()) == 0 and re.search(r'\s{5,}\d+\s*$', s):
            continue
        ki.append(s)
    return ki

SZAM = r'-?\d+(?:,\d+)?'

def havi_tabla(sorok, i):
    """i: a „Számítási zóna: X” sor. 12 havi sor oszlopai a fejléc szerint."""
    fej = sorok[i + 1].split()
    # a „ηF/H” oszlop; a fejléc első tagja „Hónap”
    adat = []
    j = i + 2
    while j < len(sorok) and len(adat) < 12:
        t = sorok[j].split()
        if t and re.fullmatch(r'\d{1,2}', t[0]) and len(t) >= 10 and int(t[0]) == len(adat) + 1:
            adat.append([num(x) for x in t[1:]])
        j += 1
    oszl = fej[1:]
    return [dict(zip(oszl, r)) for r in adat], j

def kv(sorok, kulcs):
    for s in sorok:
        m = re.match(r'\s*' + re.escape(kulcs) + r'\s+(' + SZAM.replace(',', '[.,]') + r')', s)
        if m: return num(m.group(1))
    return None

def szekcio_zonak(sorok):
    """Használati, hőegyensúly és számítási zónák + havi táblák egy szakaszban (tervezett vagy referencia)."""
    out = {'hasznalati': [], 'hoegyensuly': [], 'szamitasi': [], 'havi': {}}
    i = 0
    while i < len(sorok):
        s = sorok[i]
        if s.startswith('Használati feltételek szerinti zónák'):
            fej = sorok[i + 1].split()
            j = i + 2
            while j < len(sorok) and sorok[j].strip() and not sorok[j].startswith('Hőegyensúly'):
                t = sorok[j]
                m = re.match(r'^(.*?)\s{2,}(' + SZAM + r'.*)$', t)
                if m and not t.strip().startswith('[') and not t.strip().startswith('típusa'):
                    nums = m.group(2).split()
                    vals = [num(x) for x in nums]
                    if len(vals) >= 8 and vals[0] is not None:
                        # oszlopok: A θF θH nszüks VLT/A tnap nap/év MV qb [t0]
                        k = ['A', 'thetaF', 'thetaH', 'nSzuks', 'VLTA', 'tnap', 'napEv', 'MV', 'qb', 't0']
                        out['hasznalati'].append({'nev': m.group(1).strip(), **dict(zip(k, vals))})
                j += 1
            i = j; continue
        if s.startswith('Hőegyensúly szerinti zónák'):
            fej = sorok[i + 1].split()
            nfej = [x for x in fej if x not in ('Zóna', 'fűtés', 'hűtés', 'megnevezés')]
            j = i + 3
            while j < len(sorok) and sorok[j].strip():
                t = sorok[j]
                m = re.search(r'(' + SZAM + r'(?:\s+' + SZAM + r')+)(?:\s+(Igen|Nem)\s+(Igen|Nem))?\s*$', t)
                if m and not t.strip().startswith('['):
                    vals = [num(x) for x in m.group(1).split()]
                    d = dict(zip(nfej[-len(vals):], vals))
                    out['hoegyensuly'].append({'nev': t[:m.start()].strip(), 'A': d.get('A'), 'CmFajl': d.get('Cm,eff/AN'), 'nfilt': d.get('nfilt'), 'nEjjel': d.get('néjjel'),
                                               'futesProg': m.group(2) == 'Igen', 'hutesKikapcs': m.group(3) == 'Igen'})
                j += 1
            i = j; continue
        if s.startswith('Számítási zónák'):
            j = i + 3
            while j < len(sorok) and sorok[j].strip():
                t = sorok[j].split()
                if len(t) >= 8 and re.fullmatch(r'[FH]\d+', t[0]):
                    out['szamitasi'].append({'jel': t[0], 'tipus': t[1], 'hoegyA': num(t[2]), 'te': num(t[4]), 'A': num(t[5]), 'V': num(t[6]), 'CmFajl': num(t[7]),
                                             'Qnet': num(t[8]) if len(t) > 8 else None, 'qnet': num(t[9]) if len(t) > 9 else None})
                j += 1
            i = j; continue
        m = re.match(r'^Számítási zóna:\s*(\S+)', s)
        if m:
            tab, j = havi_tabla(sorok, i)
            out['havi'][m.group(1)] = tab
            i = j; continue
        i += 1
    return out

def szerkezetek(sorok):
    """„Határoló szerkezetek:” táblázat sorai (nyers oszlopokkal)."""
    ki = []
    for i, s in enumerate(sorok):
        if s.startswith('Határoló szerkezetek'):
            j = i + 1
            while j < len(sorok) and not sorok[j].startswith('Hőtároló tömegek'):
                t = sorok[j]
                if t.strip() and not t.strip().startswith('[') and not t.startswith('Szerkezet megnevezés') and 'tájol' not in t:
                    ki.append(t.rstrip())
                j += 1
            break
    return ki

def rendszer_ertekek(sorok):
    """„kulcs: érték” sorok a rendszerleírásokból, sorrendben (a rendszer címével)."""
    ki = []; cim = None
    for s in sorok:
        st = s.strip()
        mc = re.match(r'^(Fűtési rendszer|Melegvíz-termelő rendszer|Hűtési rendszer|Légtechnikai rendszer|Világítási rendszer|Beépített világítás|Napelemes rendszer|Villamosenergia-termelő rendszer)(\s*-?\s*[^\d]*)?$', st)
        if mc and not re.search(r'\d', st):
            cim = mc.group(1); ki.append({'rendszer': cim, 'alnev': (mc.group(2) or '').strip(' -'), 'ertekek': {}, 'szoveg': []}); continue
        if cim is None: continue
        m = re.match(r'^\s*([^\s:][^:]{0,30}?):\s+(-?[\d.,]+)\s*(\S*)', s)
        if m and num(m.group(2)) is not None:
            k = m.group(1).strip()
            ki[-1]['ertekek'].setdefault(k, []).append(num(m.group(2)))
            v = re.search(r'\(végenergiaigény\)\s*(.+)$', s)
            if v: ki[-1].setdefault('vegenergia', []).append({'kulcs': k, 'Q': num(m.group(2)), 'hordozo': v.group(1).strip()})
        elif st and not st.startswith('[') and len(ki[-1]['szoveg']) < 40:
            ki[-1]['szoveg'].append(re.sub(r'\s{2,}', ' | ', st))
        if st.startswith('Épülettechnikai rendszerek értékelése'): cim = None
    return ki

def eredmenyek(sorok):
    d = {}
    for k in ['Hasznos alapterület:', 'Összesített energetikai jellemző:', 'Fajlagos széndioxid kibocsátás:', 'Enren,fajl:', 'Enren,fajl,max:', 'ECO2,fajl:', 'Fajlagos hőveszteségtényező:',
              'Fajlagos hőveszteségtényező követelményértéke:', 'Épület felület-térfogat aránya:', 'A nyári hővédelemre vonatkozó mutató:']:
        v = kv(sorok, k)
        if v is not None: d[k.rstrip(':')] = v
    for s in sorok:
        m = re.match(r'^\s*Enren = .*= (.*)$', s)
        if m: d['Enren_tagok'] = [num(x) for x in m.group(1).split('+')]
    return d

def main(pdf, ki):
    sorok = tisztit(szoveg(pdf).split('\n'))
    ref = next((i for i, s in enumerate(sorok) if 'referencia épületre vonatkozó számítás' in s), len(sorok))
    terv, refs = sorok[:ref], sorok[ref:]
    zonak = szekcio_zonak(terv)
    er = eredmenyek(terv)
    if 'Hasznos alapterület' not in er:
        er['Hasznos alapterület'] = round(sum(z['A'] for z in zonak['szamitasi'] if z['tipus'] == 'fűtés'), 2) or None
    adat = {
        'verzio': next((re.search(r'WinWatt fecske ([\d.]+)', s).group(1) for s in szoveg(pdf).split('\n') if 'WinWatt fecske' in s), None),
        'eredmeny': er,
        'zonak': zonak,
        'szerkezetek': szerkezetek(terv),
        'rendszerek': rendszer_ertekek(terv),
        'referencia': {'zonak': szekcio_zonak(refs), 'eredmeny': eredmenyek(refs)} if refs else None,
    }
    json.dump(adat, open(ki, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
