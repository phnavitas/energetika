import re, json, sys
src = open(sys.argv[1], encoding='utf-8').read().splitlines()
def grab(start, end):
    rows=[]
    for ln in src[start-1:end]:
        m = re.match(r'^\s*(?:[ÉKDNy]{1,3}\s+)?(0|30|45|60|90)\s+(.*)$', ln)
        if not m: continue
        nums=[float(x.replace(',','.')) for x in re.findall(r'-?\d+,\d+|-?\d+', m.group(2))]
        rows.append((int(m.group(1)), nums))
    return rows
rows = grab(117, 160)
assert len(rows)==33, len(rows)
orient=['É','ÉK','K','DK','D','DNy','Ny','ÉNy']
out={'vizszintes':None}
errs=[]
for i,(tilt,nums) in enumerate(rows):
    assert len(nums)==13, (i,tilt,nums)
    havi, eves = nums[:12], nums[12]
    if abs(sum(havi)-eves)>0.6: errs.append((i,tilt,round(sum(havi),1),eves))
    if i==0: out['vizszintes']=havi; continue
    o = orient[(i-1)//4]
    out.setdefault(o,{})[str(tilt)] = havi
print(json.dumps({'errs':errs}, ensure_ascii=False))
json.dump(out, open(sys.argv[2],'w',encoding='utf-8'), ensure_ascii=False, indent=1)
