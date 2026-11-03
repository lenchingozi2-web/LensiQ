#!/usr/bin/env python3
"""Build small, original GLB teaching schematics for LenxiQ Live Class.

Every selectable mesh is explicitly named. These are simplified educational
representations, not clinical photographs, real specimens or anatomical scans.
No third-party anatomical geometry or patient material is included.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
import struct
from pathlib import Path

C = {
    "red": (0.85, 0.20, 0.25, 1), "blue": (0.20, 0.53, 0.86, 1),
    "green": (0.19, 0.73, 0.53, 1), "yellow": (0.97, 0.72, 0.25, 1),
    "purple": (0.54, 0.37, 0.80, 1), "grey": (0.65, 0.70, 0.74, 1),
    "white": (0.92, 0.90, 0.84, 1), "orange": (0.97, 0.43, 0.20, 1),
    "pink": (0.97, 0.56, 0.59, 1), "dark": (0.14, 0.24, 0.37, 1),
    "pale": (0.72, 0.85, 0.88, 0.38), "teal": (0.15, 0.71, 0.72, 1),
}
PACK: dict[str, list[tuple]] = {}
current: list[tuple] = []

def start(path: str):
    global current
    current = []
    PACK[path] = current

def ball(name, x, y, z, sx, sy, sz, color):
    current.append(("sphere", name, (x,y,z), (sx,sy,sz), color))

def bar(name, a, b, radius, color):
    current.append(("rod", name, tuple(a), tuple(b), radius, color))

def box(name, x, y, z, sx, sy, sz, color):
    current.append(("box", name, (x,y,z), (sx,sy,sz), color))

def ring(name, x, y, z, radius, width, color):
    current.append(("ring", name, (x,y,z), radius, width, color))

def dots(prefix, cx, cy, cz, n, radius, size, color):
    for i in range(n):
        a=2*math.pi*i/n
        ball(f"{prefix} {i+1}", cx+radius*math.cos(a),cy+radius*math.sin(a),cz, size,size,size,color)

def build_pack():
    start("microbiology/Gram_Cell_Envelope.glb")
    ball("Gram-positive cytoplasmic membrane", -1.2,0,0,.64,.79,.58,"blue")
    ball("Gram-positive thick peptidoglycan wall", -1.2,0,0,.80,.95,.71,"pale")
    ball("Gram-negative cytoplasmic membrane", 1.2,0,0,.53,.70,.53,"green")
    ball("Gram-negative thin peptidoglycan layer", 1.2,0,0,.63,.81,.63,"yellow")
    ball("Gram-negative outer membrane", 1.2,0,0,.80,.96,.80,"pale")
    for i in range(6):
        a=i*math.pi/3
        ball(f"Outer membrane lipopolysaccharide {i+1}",1.2+.88*math.cos(a),.98*math.sin(a),0,.11,.11,.11,"orange")

    start("microbiology/Bacterial_Endospore.glb")
    ball("Vegetative Bacillus cell outline",0,0,0,1.5,.55,.55,"pale")
    ball("Endospore core",.25,0,.24,.50,.30,.32,"purple")
    ball("Endospore cortex",.25,0,.21,.63,.40,.42,"yellow")
    ball("Endospore coat",.25,0,.17,.75,.47,.45,"grey")
    ball("Mother-cell cytoplasm",-1.0,0,0,.40,.28,.28,"green")

    start("microbiology/Enveloped_Virus.glb")
    ball("Viral nucleocapsid",0,0,0,.62,.62,.62,"purple")
    ball("Viral lipid envelope",0,0,0,1.0,1.0,1.0,"pale")
    for i in range(12):
        a=2*math.pi*i/12
        x,y=1.13*math.cos(a),1.13*math.sin(a)
        bar(f"Envelope glycoprotein spike {i+1}",(.89*math.cos(a),.89*math.sin(a),0),(x,y,0),.075,"red")
        ball(f"Spike tip {i+1}",x,y,0,.12,.12,.12,"orange")
    ball("Viral genetic material",0,.0,.39,.37,.13,.14,"yellow")

    start("microbiology/Septate_Fungal_Hypha.glb")
    for i in range(6):
        bar(f"Hyphal filament segment {i+1}",(-2+i*.63,0,0),(-1.43+i*.63,0,0),.18,"teal")
        bar(f"Septum {i+1}",(-1.43+i*.63,-.20,0),(-1.43+i*.63,.20,0),.045,"purple")
    for i in range(4):
        bar(f"Branching hypha segment {i+1}",(-.35+i*.38,.08+i*.37,0),(.03+i*.38,.43+i*.37,0),.14,"green")
    ball("Terminal conidium (diagrammatic)",1.44,1.64,0,.23,.23,.23,"yellow")

    start("microbiology/Bacterial_Biofilm.glb")
    box("Adherent surface",0,-1.15,-.15,4.6,.20,.50,"dark")
    box("Extracellular polymeric matrix (schematic)",0,-.18,-.1,4.0,1.70,.44,"pale")
    for i in range(9):
        x=-1.60+(i%5)*.76
        y=-.62+(i//5)*.84
        ball(f"Biofilm bacterial cell {i+1}",x,y,.25,.22,.30,.20,"green" if i%2 else "purple")

    start("immunology/Antibody_Antigen_Binding.glb")
    bar("Immunoglobulin heavy chain left",(-.2,-1.35,0),(-.2,.07,0),.15,"blue")
    bar("Immunoglobulin heavy chain right",(.2,-1.35,0),(.2,.07,0),.15,"blue")
    bar("Antibody Fab left",(-.10,.07,0),(-1.13,1.1,0),.17,"teal")
    bar("Antibody Fab right",(.10,.07,0),(1.13,1.1,0),.17,"teal")
    bar("Antibody light chain left",(-.62,.61,.10),(-1.28,1.25,.10),.08,"yellow")
    bar("Antibody light chain right",(.62,.61,.10),(1.28,1.25,.10),.08,"yellow")
    ball("Antigen bound to left Fab",-1.25,1.38,0,.30,.30,.30,"red")
    ball("Antigen bound to right Fab",1.25,1.38,0,.30,.30,.30,"red")
    ball("Antibody Fc region",0,-1.02,.12,.26,.43,.23,"purple")

    start("immunology/Opsonisation_Phagocytosis.glb")
    ball("Pathogen surface",-.95,0,.15,.72,.72,.70,"green")
    dots("C3b opsonin",-.95,0,.22,10,.82,.10,"yellow")
    ball("Phagocyte cell body",1.1,0,0,1.00,.98,.70,"pale")
    ball("Phagocyte nucleus",1.18,-.14,.42,.39,.43,.22,"purple")
    bar("Phagocyte membrane extension 1",(.5,.58,.18),(-.20,.52,.18),.18,"blue")
    bar("Phagocyte membrane extension 2",(.5,-.57,.18),(-.20,-.48,.18),.18,"blue")

    start("haematology/Megaloblastic_Maturation.glb")
    ball("Normal erythroblast cell",-1.25,0,0,.64,.64,.50,"red")
    ball("Normal erythroblast nucleus",-1.25,0,.47,.25,.25,.14,"purple")
    ball("Megaloblastic erythroblast (enlarged)",1.0,0,0,1.03,1.04,.58,"pink")
    ball("Immature megaloblast nucleus",1.0,0,.56,.51,.53,.15,"purple")
    ball("Nuclear-cytoplasmic asynchrony (schematic)",1.55,.55,.62,.09,.09,.09,"yellow")

    start("haematology/Platelet_Fibrin_Thrombus.glb")
    for i in range(5):
        a=-1.6+i*.8
        bar(f"Fibrin strand A{i+1}",(a,-.8,0),(a+.55,.84,0),.05,"yellow")
        bar(f"Fibrin strand B{i+1}",(a,.77,.09),(a+.48,-.82,.09),.05,"yellow")
    for i in range(9):
        ball(f"Aggregated platelet {i+1}",-1.7+(i%5)*.8,-.38+(i//5)*.75,.18,.22,.16,.18,"purple")
    ball("Trapped erythrocyte",.9,.10,.10,.35,.27,.13,"red")

    start("pathology/Acute_Inflammation_Diapedesis.glb")
    bar("Capillary endothelial upper wall",(-2, .8,0),(2,.8,0),.15,"blue")
    bar("Capillary endothelial lower wall",(-2,-.8,0),(.15,-.8,0),.15,"blue")
    bar("Capillary endothelial lower wall beyond gap",(.60,-.8,0),(2,-.8,0),.15,"blue")
    for i,p in enumerate([(-1.4,0,.1),(-.15,0,.1),(.39,-1.10,.1),(1.2,-1.45,.1)]):
        ball(f"Neutrophil transmigration stage {i+1}",*p,.28,.28,.24,"white")
        ball(f"Segmented neutrophil nucleus {i+1}",p[0],p[1],p[2]+.23,.14,.11,.10,"purple")
    ball("Extravascular oedema fluid",1.30,-2.05,0,.47,.12,.20,"pale")

    start("pathology/Coagulative_Necrosis.glb")
    for i in range(6):
        x=-1.55+(i%3)*.64
        y=-.40+(i//3)*.84
        ball(f"Viable tissue cell {i+1}",x,y,0,.28,.32,.22,"pink")
        ball(f"Viable nucleus {i+1}",x,y,.20,.11,.12,.07,"purple")
    for i in range(6):
        x=.50+(i%3)*.64
        y=-.40+(i//3)*.84
        ball(f"Necrotic ghost cell outline {i+1}",x,y,0,.28,.32,.22,"pale")
    ball("Affected ischaemic region",1.10,0,-.25,1.15,.93,.15,"yellow")

    start("pathology/Apoptosis_Blebbing.glb")
    ball("Viable cell",-1.30,0,0,.78,.78,.59,"pink")
    ball("Intact nucleus",-1.30,0,.53,.27,.29,.15,"purple")
    ball("Shrinking apoptotic cell",.90,0,0,.52,.52,.40,"red")
    for i in range(4):
        a=2*math.pi*i/4
        ball(f"Apoptotic membrane bleb {i+1}",.9+.45*math.cos(a),.45*math.sin(a),.23,.17,.17,.12,"orange")
    for i in range(3):
        ball(f"Condensed chromatin fragment {i+1}",.70+i*.19,-.07+(i%2)*.17,.36,.11,.09,.09,"purple")

    start("pathology/Thrombosis_Embolism.glb")
    for y in (-.70,.70):
        bar(f"Arterial wall y={y}",(-2,y,0),(2,y,0),.15,"blue")
    for i in range(6):
        x=-.72+(i%3)*.28
        y=-.26+(i//3)*.48
        ball(f"Adherent thrombus platelet {i+1}",x,y,.17,.19,.18,.15,"purple")
    ball("Embolus transported downstream",1.30,0,.20,.36,.26,.23,"red")
    for i in range(4):
        bar(f"Thrombus fibrin strand {i+1}",(-.75+i*.2,-.32,.34),(-.58+i*.20,.31,.34),.04,"yellow")

    start("pathology/Glomerular_Inflammation.glb")
    for i in range(6):
        a=2*math.pi*i/6
        cx=.95*math.cos(a); cy=.95*math.sin(a)
        ring(f"Glomerular capillary loop {i+1}",cx,cy,0,.42,.09,"red")
    ring("Bowman capsule cross-section",0,0,-.23,1.78,.12,"blue")
    for i in range(7):
        a=2*math.pi*i/7
        ball(f"Glomerular inflammatory cell {i+1}",.95*math.cos(a),.95*math.sin(a),.32,.13,.13,.13,"purple")
    ball("Mesangial expansion (schematic)",0,0,.23,.45,.45,.18,"pale")

    start("pathology/Cirrhosis_Fibrous_Septa.glb")
    for i,(x,y) in enumerate([(-.95,.80),(.90,.85),(-.65,-.85),(.90,-.82),(0,0)]):
        ball(f"Regenerating hepatocyte nodule {i+1}",x,y,0,.70,.59,.38,"pink")
    for i in range(4):
        bar(f"Fibrous septum {i+1}",(-1.9,-1.3+i*.76,.15),(1.95,-.98+i*.73,.15),.11,"yellow")
    for i in range(3):
        ball(f"Inflammatory stromal cell {i+1}",-1.30+i*1.3,.10,.45,.12,.12,.12,"purple")

    start("pathology/Invasive_Epithelial_Carcinoma.glb")
    bar("Basement membrane left",(-2,0,0),(-.28,0,0),.09,"blue")
    bar("Breached basement membrane right",(.48,0,0),(2,0,0),.09,"blue")
    for i in range(7):
        x=-1.50+(i%4)*.86
        y=.62+(i//4)*.64
        ball(f"Atypical epithelial cell {i+1}",x,y,.18,.31,.27,.24,"red")
        ball(f"Pleomorphic nucleus {i+1}",x+.08,y,.42,.16,.14,.10,"purple")
    for i in range(3):
        ball(f"Invasive malignant cell {i+1}",-.05+i*.49,-.53-i*.30,.20,.29,.30,.25,"orange")
    bar("Tumour-associated stromal collagen",(-2,-1.5,0),(1.8,-1.4,0),.07,"yellow")

    start("pharmacology/Cholinergic_Synapse.glb")
    ball("Presynaptic nerve terminal",-.95,.62,0,1.00,.68,.45,"pale")
    for i in range(5):
        ball(f"Acetylcholine vesicle {i+1}",-1.6+i*.33,.56,.39,.17,.17,.12,"yellow")
    bar("Postsynaptic cell membrane",(-2,-.68,0),(2,-.68,0),.14,"blue")
    for i in range(3):
        bar(f"Postsynaptic cholinergic receptor {i+1}",(-1.1+i*.85,-.48,.05),(-1.1+i*.85,-.95,.05),.16,"green")
    for i in range(4):
        ball(f"Released acetylcholine {i+1}",-.75+i*.45,-.25,.18,.09,.09,.09,"orange")
    ball("Acetylcholinesterase enzyme",1.43,-.18,.15,.29,.24,.24,"purple")

    start("pharmacology/Receptor_Agonist_Antagonist.glb")
    bar("Cell membrane",(-2,-.53,0),(2,-.53,0),.20,"blue")
    for x,tag in [(-1.03,"Agonist"),(1.03,"Antagonist")]:
        bar(f"{tag} receptor", (x,-.50,.20),(x,.55,.20),.23,"green")
        ball(f"{tag} ligand",x,.96,.20,.29,.27,.25,"yellow" if tag=="Agonist" else "red")
    ball("Agonist-induced intracellular signal",-1.03,-1.08,.18,.22,.22,.19,"teal")

    start("pharmacology/Voltage_Gated_Sodium_Channel.glb")
    bar("Cell membrane upper leaflet",(-2,.70,-.30),(2,.70,-.30),.14,"blue")
    bar("Cell membrane lower leaflet",(-2,-.70,-.30),(2,-.70,-.30),.14,"blue")
    for x in [-.72,-.29,.29,.72]:
        bar(f"Sodium channel transmembrane helix x={x}",(x,-.95,.18),(x,.99,.18),.15,"green")
    ball("Sodium ion approaching pore",0,1.32,.25,.18,.18,.18,"yellow")
    ball("Sodium-channel blocking drug",0,-.10,.40,.31,.24,.26,"red")

def geometry(spec):
    kind=spec[0]
    if kind=="box":
        _,name,loc,scale,color=spec
        sx,sy,sz=scale
        p=[(x*sx+loc[0],y*sy+loc[1],z*sz+loc[2]) for x,y,z in
           [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
        tris=[(0,1,2),(0,2,3),(4,6,5),(4,7,6),(0,4,5),(0,5,1),
              (2,6,7),(2,7,3),(0,3,7),(0,7,4),(1,5,6),(1,6,2)]
        return name,p,tris,color
    if kind=="sphere":
        _,name,loc,scale,color=spec
        count=14; bands=10; p=[]; tris=[]
        for j in range(bands+1):
            v=math.pi*j/bands
            for i in range(count):
                a=2*math.pi*i/count
                x=math.sin(v)*math.cos(a);y=math.sin(v)*math.sin(a);z=math.cos(v)
                p.append((loc[0]+scale[0]*x,loc[1]+scale[1]*y,loc[2]+scale[2]*z))
        for j in range(bands):
            for i in range(count):
                a=j*count+i;b=j*count+(i+1)%count;c=(j+1)*count+i;d=(j+1)*count+(i+1)%count
                tris.extend(((a,c,b),(b,c,d)))
        return name,p,tris,color
    if kind=="ring":
        _,name,loc,major,minor,color=spec
        p=[];tris=[];around=24;side=6
        for i in range(around):
            theta=2*math.pi*i/around
            for j in range(side):
                phi=2*math.pi*j/side
                radius=major+minor*math.cos(phi)
                p.append((loc[0]+radius*math.cos(theta),loc[1]+radius*math.sin(theta),loc[2]+minor*math.sin(phi)))
        for i in range(around):
            for j in range(side):
                a=i*side+j;b=((i+1)%around)*side+j;c=i*side+(j+1)%side;d=((i+1)%around)*side+(j+1)%side
                tris.extend(((a,b,c),(c,b,d)))
        return name,p,tris,color
    if kind=="rod":
        _,name,a,b,r,color=spec
        delta=[b[i]-a[i] for i in range(3)]
        length=math.sqrt(sum(t*t for t in delta))
        if length<.0001: raise ValueError("Zero-length rod")
        direction=[x/length for x in delta]
        tangent=[0,0,1] if abs(direction[2])<.9 else [0,1,0]
        u=[direction[1]*tangent[2]-direction[2]*tangent[1],direction[2]*tangent[0]-direction[0]*tangent[2],direction[0]*tangent[1]-direction[1]*tangent[0]]
        mag=math.sqrt(sum(t*t for t in u));u=[x/mag for x in u]
        v=[direction[1]*u[2]-direction[2]*u[1],direction[2]*u[0]-direction[0]*u[2],direction[0]*u[1]-direction[1]*u[0]]
        p=[];tris=[];n=12
        for center in [a,b]:
            for j in range(n):
                t=2*math.pi*j/n
                p.append(tuple(center[k]+r*(math.cos(t)*u[k]+math.sin(t)*v[k]) for k in range(3)))
        for j in range(n):
            nxt=(j+1)%n
            tris.extend(((j,nxt,n+j),(n+j,nxt,n+nxt)))
        for j in range(1,n-1):
            tris.append((0,j+1,j));tris.append((n,n+j,n+j+1))
        return name,p,tris,color
    raise ValueError("Unknown geometric shape")

def write_glb(path: Path, components: list[tuple]):
    binary=bytearray();views=[];accessors=[];meshes=[];nodes=[];materials=[];palette={}
    def chunk(blob):
        while len(binary)%4:binary.append(0)
        offset=len(binary);binary.extend(blob)
        views.append({"buffer":0,"byteOffset":offset,"byteLength":len(blob)})
        return len(views)-1
    for spec in components:
        name,points,tris,color_name=geometry(spec)
        if color_name not in palette:
            rgba=C[color_name]
            material={"pbrMetallicRoughness":{"baseColorFactor":rgba,"roughnessFactor":0.6,"metallicFactor":0},
                      "doubleSided":True}
            if rgba[3]<1:material["alphaMode"]="BLEND"
            palette[color_name]=len(materials);materials.append(material)
        positions=b"".join(struct.pack("<3f",*v) for v in points)
        indices=b"".join(struct.pack("<H",n) for tri in tris for n in tri)
        pos_view=chunk(positions);idx_view=chunk(indices)
        lo=[min(p[i] for p in points) for i in range(3)]
        hi=[max(p[i] for p in points) for i in range(3)]
        pa=len(accessors)
        accessors.append({"bufferView":pos_view,"componentType":5126,"count":len(points),"type":"VEC3","min":lo,"max":hi})
        ia=len(accessors)
        accessors.append({"bufferView":idx_view,"componentType":5123,"count":len(tris)*3,"type":"SCALAR"})
        mesh=len(meshes)
        meshes.append({"name":name,"primitives":[{"attributes":{"POSITION":pa},"indices":ia,"material":palette[color_name],"mode":4}]})
        nodes.append({"name":name,"mesh":mesh})
    while len(binary)%4:binary.append(0)
    obj={"asset":{"version":"2.0","generator":"LenxiQ original medical concept schematic pack v1"},
         "scene":0,"scenes":[{"nodes":list(range(len(nodes)))}],
         "nodes":nodes,"meshes":meshes,"materials":materials,
         "buffers":[{"byteLength":len(binary)}],"bufferViews":views,"accessors":accessors}
    encoded=json.dumps(obj,ensure_ascii=False,separators=(",",":")).encode("utf-8")
    while len(encoded)%4:encoded+=b" "
    length=12+8+len(encoded)+8+len(binary)
    payload=struct.pack("<4sII",b"glTF",2,length)+struct.pack("<I4s",len(encoded),b"JSON")+encoded+struct.pack("<I4s",len(binary),b"BIN\x00")+binary
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_bytes(payload)
    assert path.stat().st_size==length
    return len(nodes),len(payload),hashlib.sha256(payload).hexdigest()

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--output-dir",type=Path,required=True)
    args=p.parse_args()
    build_pack()
    if len(PACK)!=19: raise SystemExit("Expected 19 concept models; got "+str(len(PACK)))
    manifest={"schema_version":1,"generator":"LenxiQ original low-poly educational concepts","assets":[]}
    for path,specs in PACK.items():
        num,size,digest=write_glb(args.output_dir/path,specs)
        if size>600_000:raise SystemExit("Schematic too large: "+path)
        manifest["assets"].append({"path":path,"objects":num,"bytes":size,"sha256":digest,
                                   "source":"Original LenxiQ diagrammatic teaching geometry",
                                   "license":"Original LenxiQ teaching asset; reuse subject to LenxiQ terms","clinical_fidelity":"schematic; not a diagnostic specimen"})
        print(path, num, size)
    total=sum(x["bytes"] for x in manifest["assets"])
    if total>8_000_000:raise SystemExit("Over the pack's 8 MB limit")
    (args.output_dir/"manifest-concepts-v1.json").write_text(json.dumps(manifest,indent=2)+"\n")
    print("MODEL COUNT",len(manifest["assets"]),"BYTES",total)

if __name__=="__main__":
    main()
