#!/usr/bin/env python3
"""Safely install 100-160MB of licensed HRA 3D reference organs.

Follows the first release listed in HRA's official machine-readable catalog.
Only relevant organs, one reference per organ, no duplicate sex/side variants.
Never deletes objects, alters permissions or overwrites existing paths.
"""
from __future__ import annotations

import argparse, concurrent.futures, csv, hashlib, io, json, os, re, struct
import urllib.error, urllib.parse, urllib.request
from pathlib import Path

import yaml
from supabase_storage_preflight import list_bucket_objects, request_json

PROJECT="https://hixvbcrrklyajhkyliay.supabase.co"
BUCKET="medical-models"
PREFIX="hra-v25/"
HRA_YAML="https://humanatlas.io/assets/content/3d-reference-library-page/data.yaml"
HRA_SOURCE="https://cdn.humanatlas.io/digital-objects/ref-organ/"
PROJECT_LIMIT=790_000_000
PACK_LIMIT=165_000_000
PER_FILE_LIMIT=44_000_000

# Subject relevance before fidelity/size, consistent with the Study Hub's MBBS content.
ORDER=[
    "Lung","Heart","Liver","Kidney","Brain","Pancreas","Spleen","Lymph Node",
    "Large Intestine","Small Intestine","Skin","Urinary Bladder","Uterus","Ovary",
    "Prostate","Thymus","Spinal Cord","Trachea","Main Bronchus","Placenta",
    "Renal Pelvis","Eye","Blood Vasculature","Mammary Gland","Larynx","Ureter",
    "Knee","Pelvis","Fallopian Tube"
]

def urlopen(url, method="GET", timeout=45):
    if not url.startswith("https://"):
        raise ValueError("Only HTTPS supported")
    return urllib.request.urlopen(urllib.request.Request(
        url,method=method,headers={"User-Agent":"LenxiQ-LiveClass-Verified-HRA/2.0"}),timeout=timeout)

def fetch_json_url(url):
    with urlopen(url,timeout=45) as res:
        raw=res.read(850_000)
    return yaml.safe_load(raw)

def candidate_size(item):
    try:
        with urlopen(item["sourceUrl"],"HEAD",30) as res:
            n=int(res.headers.get("content-length",0))
        return {**item,"sourceBytes":n,"error":""}
    except Exception as e:
        return {**item,"sourceBytes":0,"error":type(e).__name__}

def plan():
    release=fetch_json_url(HRA_YAML)["content"][1]["content"][1]["releaseVersionData"][0]
    if str(release.get("version")) != "11":
        raise RuntimeError("HRA release changed; review before downloading")
    desired={}
    for organ in release.get("organData",[]):
        name=organ.get("label")
        if name not in ORDER: continue
        cards=organ.get("cards") or []
        card=(next((c for c in cards if c.get("label")=="Female"),None)
              or next((c for c in cards if str(c.get("label","")).startswith("Female")),None)
              or next((c for c in cards if str(c.get("label","")).startswith("Male")),None))
        if not card:continue
        url=card.get("fileUrl") or ""
        crosswalk=card.get("crosswalkUrl") or ""
        if not (url.startswith(HRA_SOURCE) and url.endswith(".glb")):
            raise RuntimeError("Unapproved catalog file URL")
        if crosswalk and not crosswalk.startswith(HRA_SOURCE):
            raise RuntimeError("Unexpected HRA crosswalk location")
        desired[name]={"name":name,"slug":re.sub(r"[^a-z0-9]+","-",name.lower()).strip("-"),
                       "sourceUrl":url,"crosswalkUrl":crosswalk,"variant":card.get("label",""),
                       "license":"CC BY 4.0"}
    if len(desired)<24:raise RuntimeError("HRA release too sparse")
    with concurrent.futures.ThreadPoolExecutor(max_workers=7) as pool:
        inspected=list(pool.map(candidate_size,[desired[name] for name in ORDER if name in desired]))
    selected=[];total=0
    for item in inspected:
        n=item["sourceBytes"]
        if not (3000<=n<=PER_FILE_LIMIT) or item["error"]:continue
        if total+n>150_000_000:continue
        selected.append(item);total+=n
    if not (100_000_000<=total<=150_000_000 and len(selected)>=18):
        raise RuntimeError(f"No medically useful 100-150MB licensed organ pack fits: {len(selected)} / {total}")
    print("Official HRA reference organ release 11 (v2.5)")
    print("Selected",len(selected),"organ models, source bytes",total)
    return selected

def load_crosswalk(url):
    if not url:return {}
    try:
        with urlopen(url,timeout=25) as res: raw=res.read(4_000_000)
        rows=list(csv.DictReader(io.StringIO(raw.decode("utf-8-sig"))))
        if not rows:return {}
        print("Crosswalk fields:",list(rows[0].keys())[:8],"rows:",len(rows))
        mapping={}
        for row in rows:
            node=(row.get("node_name") or row.get("node") or "").strip()
            label=(row.get("label") or row.get("name") or "").strip()
            if node and 3<len(label)<150:mapping[node]=label
        return mapping
    except Exception as e:
        print("Crosswalk unavailable:",type(e).__name__)
        return {}

def inspect_and_label(raw, name, crosswalk):
    if raw[:4]!=b"glTF" or len(raw)<20 or struct.unpack_from("<I",raw,8)[0]!=len(raw):
        raise RuntimeError("Invalid GLB header: "+name)
    version=struct.unpack_from("<I",raw,4)[0]
    if version!=2:raise RuntimeError("Only GLB 2.0 is supported")
    offset=12;items=[]
    while offset<len(raw):
        if offset+8>len(raw):raise RuntimeError("Truncated GLB chunk header")
        length,typ=struct.unpack_from("<I4s",raw,offset)
        offset+=8
        chunk=raw[offset:offset+length];offset+=length
        if len(chunk)!=length:raise RuntimeError("Invalid GLB chunk length")
        items.append((typ,chunk))
    if not items or items[0][0]!=b"JSON":raise RuntimeError("Missing first GLB JSON chunk")
    doc=json.loads(items[0][1])
    meshes=doc.get("meshes",[])
    nodes=doc.get("nodes",[])
    accessors=doc.get("accessors",[])
    used=[x for x in nodes if isinstance(x,dict) and "mesh" in x]
    if not meshes or not used:
        raise RuntimeError("Non-manipulatable HRA model: "+name)
    n_verts=sum(int(accessors[p["attributes"]["POSITION"]].get("count",0))
        for m in meshes for p in m.get("primitives",[])
        if "POSITION" in p.get("attributes",{}) and p["attributes"]["POSITION"]<len(accessors))
    if n_verts<1000:raise RuntimeError("Insufficient 3D mesh geometry: "+name)
    rewrites=0
    for node in nodes:
        if "mesh" not in node:continue
        old=str(node.get("name",""))
        label=crosswalk.get(old)
        if label and label.lower()!=old.lower():
            extra=node.get("extras") or {}
            if not isinstance(extra,dict):extra={}
            extra["hraOriginalNode"]=old
            node["extras"]=extra
            node["name"]=label
            rewrites+=1
    # Mesh names matter in some loaders; source names retained when crosswalk has no matching term.
    json_bytes=json.dumps(doc,ensure_ascii=False,separators=(",",":")).encode("utf-8")
    json_bytes+=b" " * ((4-len(json_bytes)%4)%4)
    items[0]=(b"JSON",json_bytes)
    chunks=b"".join(struct.pack("<I4s",len(data),typ)+data for typ,data in items)
    result=struct.pack("<4sII",b"glTF",2,12+len(chunks))+chunks
    if struct.unpack_from("<I",result,8)[0]!=len(result):raise RuntimeError("Incorrect binary size")
    return result,{"nodes":len(nodes),"meshes":len(meshes),"selectableMeshNodes":len(used),
                   "vertices":n_verts,"crosswalkRenamed":rewrites,
                   "sampleStructureNames":[str(x.get("name","")) for x in used[:5]]}

def download_one(item,output):
    path=output/(item["slug"]+".glb")
    sha=hashlib.sha256()
    size=0
    with urlopen(item["sourceUrl"],timeout=150) as res:
        with open(path,"wb") as f:
            while True:
                chunk=res.read(1024*1024)
                if not chunk:break
                size+=len(chunk)
                if size>PER_FILE_LIMIT:raise RuntimeError("Individual HRA model larger than allowed")
                f.write(chunk);sha.update(chunk)
    if size != item["sourceBytes"]:
        raise RuntimeError("Source content length changed "+item["name"])
    raw=path.read_bytes()
    crosswalk=load_crosswalk(item["crosswalkUrl"])
    adjusted,metrics=inspect_and_label(raw,item["name"],crosswalk)
    if len(adjusted)>PER_FILE_LIMIT:raise RuntimeError("Post-labelled GLB too large")
    path.write_bytes(adjusted)
    return {**item,**metrics,"bytes":len(adjusted),"sha256":hashlib.sha256(adjusted).hexdigest(),
            "sourceSha256":sha.hexdigest(),"path":PREFIX+item["slug"]+".glb",
            "attribution":"Human Reference Atlas (HRA), 3D Reference Object Library; CC BY 4.0. Organ geometry for education, not disease depiction."}

def build(output):
    selected=plan()
    output.mkdir(parents=True,exist_ok=True)
    files=[]
    for item in selected:
        try:
            entry=download_one(item,output)
        except RuntimeError as exc:
            # Tiny HRA references can have insufficient geometry for a useful 3D class.
            if "Insufficient 3D mesh geometry:" not in str(exc):
                raise
            print("SKIPPED_LOW_DETAIL",item["name"],str(exc))
            (output/(item["slug"]+".glb")).unlink(missing_ok=True)
            continue
        print("VALIDATED",entry["name"],entry["bytes"],"mesh nodes",entry["selectableMeshNodes"],"renamed",entry["crosswalkRenamed"])
        files.append(entry)
    total=sum(x["bytes"] for x in files)
    if not(100_000_000<=total<=PACK_LIMIT):raise RuntimeError("Pack outside budget: "+str(total))
    manifest={"version":"hra-v25","release":"HRA v2.5, Release 11","sourceManifest":HRA_YAML,
             "license":"CC BY 4.0","anatomyIsHealthyReference":True,
             "sourcesAreNotDiseaseSpecimens":True,"asset_count":len(files),
             "total_bytes":total,"assets":files}
    (output/"hra-model-manifest.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8")
    print("BUILT",len(files),"total bytes",total)
    return manifest

def upload(output,manifest):
    base=os.getenv("SUPABASE_URL","").rstrip("/")
    key=os.getenv("SUPABASE_SERVICE_ROLE_KEY","")
    if base!=PROJECT or not key:raise RuntimeError("Study Hub storage credentials missing")
    buckets=request_json(base+"/storage/v1/bucket","GET",key)
    if not isinstance(buckets,list) or not any(b.get("name")==BUCKET for b in buckets):
        raise RuntimeError("Target bucket missing")
    total=0;existing={}
    for bucket in buckets:
        content=list_bucket_objects(base,key,bucket["name"])
        total+=sum(content.values())
        if bucket["name"]==BUCKET:existing=content
    paths={asset["path"]:(output/(asset["slug"]+".glb"),asset["sha256"],asset["bytes"],"model/gltf-binary") for asset in manifest["assets"]}
    raw=(output/"hra-model-manifest.json").read_bytes()
    digest=hashlib.sha256(raw).hexdigest()
    paths[PREFIX+"manifest-"+digest[:12]+".json"]=(output/"hra-model-manifest.json",digest,len(raw),"application/json")
    added=sum(x[2] for path,x in paths.items() if path not in existing)
    if total+added>PROJECT_LIMIT:raise RuntimeError(f"Storage would exceed {PROJECT_LIMIT} bytes")
    for path,(_,_,length,_) in paths.items():
        if path in existing and existing[path]!=length:
            raise RuntimeError("Existing HRA path differs; cannot overwrite: "+path)
    print("PROJECT_STORAGE_BEFORE",total,"PLANNED_NEW",added,"PROJECTED",total+added)
    for path,(local,digest,length,media_type) in paths.items():
        encoded=urllib.parse.quote(path,safe="/")
        objurl=base+"/storage/v1/object/"+BUCKET+"/"+encoded
        public=base+"/storage/v1/object/public/"+BUCKET+"/"+encoded
        if path in existing:
            with urlopen(public,timeout=110) as res:
                check=hashlib.sha256()
                while True:
                    chunk=res.read(1024*1024)
                    if not chunk:break
                    check.update(chunk)
            if check.hexdigest()!=digest:raise RuntimeError("Conflicting existing HRA object: "+path)
            print("ALREADY_VERIFIED",path)
            continue
        payload=local.read_bytes()
        request=urllib.request.Request(objurl,data=payload,method="POST",headers={
            "Authorization":"Bearer "+key,"apikey":key,"Content-Type":media_type,
            "Cache-Control":"max-age=31536000","x-upsert":"false"})
        with urllib.request.urlopen(request,timeout=180) as res:
            if res.status not in (200,201):raise RuntimeError("Upload returned non-success status")
        with urlopen(public,timeout=160) as res:
            verified=hashlib.sha256()
            while True:
                part=res.read(1024*1024)
                if not part:break
                verified.update(part)
        if verified.hexdigest()!=digest:raise RuntimeError("Public CDN SHA verification mismatch "+path)
        print("PUBLIC_SHA_VERIFIED",path,length)
    print("SUCCESS_HRA",manifest["asset_count"],"models",manifest["total_bytes"],"bytes; no original assets deleted or overwritten")
    print("MANIFEST",PREFIX+"manifest-"+digest[:12]+".json")

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--output-dir",type=Path,required=True)
    p.add_argument("--upload",action="store_true")
    args=p.parse_args()
    manifest=build(args.output_dir)
    if args.upload:upload(args.output_dir,manifest)

if __name__=="__main__":main()
