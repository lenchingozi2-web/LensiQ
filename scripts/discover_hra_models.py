#!/usr/bin/env python3
"""Read-only discovery of HRA's official 3D Reference Library releases."""
import json, urllib.request, urllib.parse, yaml
from collections import Counter

url="https://humanatlas.io/assets/content/3d-reference-library-page/data.yaml"
req=urllib.request.Request(url, headers={"User-Agent":"LenxiQ-Clinical-Visuals-Inventory/1.0"})
with urllib.request.urlopen(req,timeout=35) as res:
    payload=res.read(3_000_000)
    if len(payload)>=3_000_000: raise SystemExit("Unexpectedly large manifest")
print("Manifest bytes:",len(payload))
doc=yaml.safe_load(payload)
print("Top-level keys:",list(doc.keys())[:35] if isinstance(doc,dict) else type(doc).__name__)
print("Root sample (non-sensitive):",str(doc)[:2400])
urls=[]
def walk(obj,trail=()):
    if isinstance(obj,dict):
        for k,v in obj.items():walk(v,trail+(str(k),))
    elif isinstance(obj,list):
        for i,v in enumerate(obj):walk(v,trail+(str(i),))
    elif isinstance(obj,str):
        if "glb" in obj.lower() or ("cdn.humanatlas.io" in obj and "ref-organ" in obj):
            urls.append(("/".join(trail),obj[:700]))
walk(doc)
print("Matched organ-related fields:",len(urls))
for trail,val in urls[:70]:print("ASSET",trail,val)

print("Release groups:")
groups=doc.get("content",[])[1].get("content",[])[1].get("releaseVersionData",[])
for i,g in enumerate(groups[:3]):
    print("GROUP",i,"fields",list(g.keys()),"release",str(g.get("version") or g.get("releaseVersion") or g.get("name"))[:80],"organs",len(g.get("organData",[])))
for item in groups[0].get("organData",[]):
    cards=item.get("cards",[])
    if cards:
        print("ORGAN",str(item.get("title") or item.get("name") or item.get("organ") or item)[:90],
              str(cards[0].get("fileUrl",""))[:160])
