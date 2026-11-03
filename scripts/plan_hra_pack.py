#!/usr/bin/env python3
"""Read-only HRA v2.5 reference-organ size and teaching-relevance inventory."""
from __future__ import annotations
import concurrent.futures, json, urllib.request, urllib.parse
import yaml

MANIFEST="https://humanatlas.io/assets/content/3d-reference-library-page/data.yaml"
PRIORITY = [
"Lung","Heart","Liver","Kidney","Brain","Pancreas","Spleen","Lymph Node",
"Large Intestine","Small Intestine","Skin","Urinary Bladder","Uterus",
"Ovary","Prostate","Thymus","Spinal Cord","Trachea","Main Bronchus",
"Placenta","Renal Pelvis","Eye","Blood Vasculature","Mammary Gland",
"Larynx","Ureter","Knee","Pelvis","Fallopian Tube"
]
def get_yaml():
    r=urllib.request.Request(MANIFEST,headers={"User-Agent":"LenxiQ-HRA-model-inventory/1.0"})
    with urllib.request.urlopen(r,timeout=40) as z:return yaml.safe_load(z.read(750000))
def head(row):
    name,url,source=row
    if not url.startswith("https://cdn.humanatlas.io/digital-objects/ref-organ/") or not url.endswith(".glb"):
        raise ValueError("Unexpected source URL")
    try:
        r=urllib.request.Request(url,method="HEAD",headers={"User-Agent":"LenxiQ-HRA-model-inventory/1.0"})
        with urllib.request.urlopen(r,timeout=30) as z:
            size=int(z.headers.get("content-length") or 0)
            content_type=z.headers.get("content-type")
        return {"name":name,"url":url,"bytes":size,"content_type":content_type,
                "crosswalkUrl":source,"error":""}
    except Exception as exc:
        return {"name":name,"url":url,"bytes":0,"error":str(exc)[:120]}

root=get_yaml()
versions=root["content"][1]["content"][1]["releaseVersionData"]
latest=versions[0]
print("CURRENT HRA RELEASE",latest.get("version"),latest.get("label"))
entries=[]
for organ in latest["organData"]:
    name=organ.get("label")
    if name not in PRIORITY:continue
    cards=organ.get("cards") or []
    chosen=next((x for x in cards if x.get("label")=="Female"),None)
    if chosen is None:chosen=next((x for x in cards if str(x.get("label","")).startswith("Female")),None)
    if chosen is None:chosen=next((x for x in cards if str(x.get("label","")).startswith("Male")),None)
    if chosen is None:continue
    url=chosen.get("fileUrl","")
    entries.append((name,url,chosen.get("crosswalkUrl","")))
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
    out=list(executor.map(head,entries))
out.sort(key=lambda x:PRIORITY.index(x["name"]))
for item in out:
    print("HRA",item["name"],"MB",round(item["bytes"]/1e6,2),"url",item["url"],"error",item["error"])
eligible=[x for x in out if 0<x["bytes"]<44_000_000 and not x["error"]]
total=0;selected=[]
for item in eligible:
    if total+item["bytes"]<=150_000_000:
        selected.append(item);total+=item["bytes"]
print("PROPOSED MODELS",len(selected),"TOTAL BYTES",total)
print("PROPOSED NAMES",[(x["name"],round(x["bytes"]/1e6,2)) for x in selected])
with open("hra-model-preflight.json","w") as f:
    json.dump({"release":str(latest.get("version")),"selected":selected,"candidates":out,
    "selected_bytes":total},f,indent=2)
