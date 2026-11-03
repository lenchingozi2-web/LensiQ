"""Verified Live Class visual commands and safe learner interactions.

Pure Python; the existing real-time voice, STT and TTS code is not changed.
URLs are taken only from the approved assets provided in the room protocol.
"""
import json
import math
import re
from typing import Any

SIMULATIONS = (
    ("acid_base_balance", r"\b(?:henderson.hasselbalch|acid.base (?:balance|equation)|metabolic acidosis|respiratory acidosis|metabolic alkalosis|respiratory alkalosis)\b"),
    ("anion_gap", r"\b(?:anion gap|unmeasured anions)\b"),
    ("drug_half_life", r"\b(?:drug half.life|elimination half.life|first.order elimination)\b"),
    ("competitive_antagonism", r"\b(?:competitive antagonis[mt]|dose.response curve|receptor occupancy|EC50)\b"),
    ("oxygen_content", r"\b(?:arterial oxygen content|blood oxygen content|oxygen carrying capacity)\b"),
    ("renal_clearance", r"\b(?:renal clearance (?:equation|calculation)|solute clearance|urine.plasma clearance)\b"),
    ("cardiac_output", r"\b(?:cardiac output|stroke volume and heart rate)\b"),
    ("mean_arterial_pressure", r"\b(?:mean arterial pressure|systolic and diastolic pressure)\b"),
    ("alveolar_ventilation", r"\b(?:alveolar ventilation|anatomic(?:al)? dead space)\b"),
)
MOLECULES = (
    ("acetylcholinesterase", r"\b(?:donepezil|acetylcholinesterase enzyme|acetylcholinesterase inhibition)\b"),
    ("dihydrofolateReductase", r"\b(?:methotrexate|dihydrofolate reductase|DHFR)\b"),
    ("beta2Adrenergic", r"\b(?:beta.?2 adrenergic receptor|carazolol|beta.?2 adrenoceptor)\b"),
)
SCHEMATICS = (
    ("gramCellEnvelope", r"\b(?:gram.positive|gram.negative|peptidoglycan|lipopolysaccharide|outer bacterial membrane)\b"),
    ("bacterialEndospore", r"\b(?:endospore|sporulation|bacterial spore formation)\b"),
    ("envelopedVirus", r"\b(?:enveloped vir(?:us|uses)|viral envelope|nucleocapsid|viral glycoprotein spike)\b"),
    ("septateFungalHypha", r"\b(?:septate hyph|fungal hyph|mycelial branch|aspergillus morphology)\w*"),
    ("bacterialBiofilm", r"\b(?:biofilm|extracellular polymeric matrix)\b"),
    ("antibodyAntigen", r"\b(?:antibody structure|immunoglobulin structure|fab region|fc region|antigen.antibody binding)\b"),
    ("opsonisation", r"\b(?:opsoni[sz]ation|c3b opsonin|phagocytic engulfment)\b"),
    ("megaloblastic", r"\b(?:megaloblas|nuclear.cytoplasmic asynchrony)\w*"),
    ("plateletFibrin", r"\b(?:platelet aggregation|platelet plug|fibrin mesh|fibrin network|primary haemostasis)\b"),
    ("acuteInflammation", r"\b(?:acute inflammation|diapedesis|neutrophil extravasation|leukocyte rolling|leucocyte adhesion)\b"),
    ("coagulativeNecrosis", r"\b(?:coagulative necrosis|ischaemic necrosis|ischemic necrosis)\b"),
    ("apoptosis", r"\b(?:apoptosis|apoptotic bleb|programmed cell death)\b"),
    ("thrombosisEmbolism", r"\b(?:thromboembolism|embolus|thrombosis|pulmonary embolism)\b"),
    ("glomerularInflammation", r"\b(?:glomerulonephritis|glomerular inflammation|mesangial proliferation)\b"),
    ("cirrhosis", r"\b(?:cirrhosis|regenerative hepatic nodules?|fibrous septa)\b"),
    ("invasiveCarcinoma", r"\b(?:invasive carcinoma|basement membrane invasion|tumou?r invasion)\b"),
    ("cholinergicSynapse", r"\b(?:cholinergic synapse|neuromuscular junction|acetylcholine release)\b"),
    ("sodiumChannelBlockade", r"\b(?:voltage.gated sodium channel|sodium channel block|lidocaine mechanism|lignocaine mechanism)\b"),
    ("receptorOccupancy", r"\b(?:agonist versus antagonist|receptor binding sites?|competitive agonists?)\b"),
    ("bloodCellMorphology", r"\b(?:sickle.cell|erythrocyte morphology|red blood cell morphology)\b"),
    ("leukocyteMorphology", r"\b(?:neutrophil morphology|leukocyte morphology|eosinophil granules)\b"),
    ("leukemiaBlastMorphology", r"\b(?:acute leukaemia blast|acute leukemia blast|myeloblast morphology)\b"),
    ("epithelialDysplasia", r"\b(?:epithelial dysplasia|cervical dysplasia|cellular atypia)\b"),
    ("atherosclerosis", r"\b(?:atherosclerosis|atheromatous plaque|foam cells)\b"),
    ("tumorMicroenvironment", r"\b(?:tumou?r microenvironment|tumou?r stroma)\b"),
    ("granulomatousInflammation", r"\b(?:granuloma|caseous necrosis|epithelioid macrophage)\b"),
    ("fattyLiver", r"\b(?:hepatic steatosis|fatty liver|lipid vacuoles? in hepatocytes)\b"),
)
ORGANS = (
    ("hraLung", r"\b(?:lung anatomy|pulmonary lobes|pneumonia|bronchiectasis|emphysema|pulmonary fibrosis)\b"),
    ("hraHeart", r"\b(?:heart anatomy|right ventricle|left ventricle|myocardial infarction|endocarditis|pericarditis|cardiac valve)\b"),
    ("hraLiver", r"\b(?:hepatic anatomy|portal triad|liver anatomy|hepatic lobule|liver blood supply)\b"),
    ("hraKidney", r"\b(?:kidney anatomy|hydronephrosis|renal cortex|renal medulla|renal calyces)\b"),
    ("hraBrain", r"\b(?:brain anatomy|intracranial h[ae]morrhage|cerebral cortex|basal ganglia|cerebellum)\b"),
    ("hraPancreas", r"\b(?:pancreatitis|pancreatic islets?|pancreatic adenocarcinoma|pancreas anatomy)\b"),
    ("hraSpleen", r"\b(?:splenic anatomy|splenomegaly|splenic infarct|splenic white pulp)\b"),
    ("hraLymphNode", r"\b(?:lymph node architecture|lymphadenopathy|lymphadenitis|germinal centres?|lymphoma)\b"),
    ("hraLargeIntestine", r"\b(?:colorectal cancer|colon cancer|ulcerative colitis|large intestine anatomy|diverticulitis)\b"),
    ("hraSmallIntestine", r"\b(?:small intestine|crohn.s disease|intestinal villi|ileal anatomy)\b"),
    ("hraSkin", r"\b(?:skin anatomy|epidermal layers?|psoriasis|dermatitis)\b"),
    ("hraBladder", r"\b(?:urinary bladder|cystitis|urothelial carcinoma)\b"),
    ("hraUterus", r"\b(?:uterus anatomy|endometrium|endometrial carcinoma|uterine fibroids?|leiomyoma)\b"),
    ("hraProstate", r"\b(?:prostate anatomy|prostatic hyperplasia|prostate cancer)\b"),
    ("hraThymus", r"\b(?:thymus anatomy|thymoma|thymic involution)\b"),
    ("hraSpinalCord", r"\b(?:spinal cord anatomy|anterior horn|transverse myelitis)\b"),
    ("hraTrachea", r"\b(?:tracheal anatomy|tracheal stenosis|tracheal rings)\b"),
    ("hraMainBronchus", r"\b(?:main bronchus|bronchial anatomy|main bronchi)\b"),
    ("hraPlacenta", r"\b(?:placental circulation|placental infarction|placenta anatomy)\b"),
    ("hraRenalPelvis", r"\b(?:renal pelvis anatomy|ureteropelvic junction)\b"),
    ("hraEye", r"\b(?:eye anatomy|retinal anatomy|glaucoma|optic disc)\b"),
    ("hraBloodVessels", r"\b(?:vascular anatomy|arterial tree|venous system|vasculitis)\b"),
    ("hraMammaryGland", r"\b(?:breast anatomy|mammary gland|ductal carcinoma|breast carcinoma)\b"),
    ("hraLarynx", r"\b(?:laryngeal anatomy|laryngeal cancer|vocal folds)\b"),
    ("hraUreter", r"\b(?:ureter anatomy|ureteric stones?|ureteral calculi)\b"),
    ("hraKnee", r"\b(?:knee anatomy|knee osteoarthritis|meniscal injury)\b"),
    ("hraPelvis", r"\b(?:bony pelvis|pelvic skeleton|pelvic bones)\b"),
    ("hraFallopianTube", r"\b(?:fallopian tube|ectopic pregnancy|salpingitis)\b"),
)
SIMULATION_VARIABLES = {
    "cardiac_output": {"heartRate", "strokeVolume"},
    "mean_arterial_pressure": {"systolic", "diastolic"},
    "alveolar_ventilation": {"tidalVolume", "deadSpace", "respiratoryRate"},
    "acid_base_balance": {"bicarbonate", "arterialPCO2"},
    "anion_gap": {"sodium", "chloride", "bicarbonate"},
    "drug_half_life": {"halfLife", "elapsed"},
    "competitive_antagonism": {"agonist", "antagonist", "ec50"},
    "oxygen_content": {"haemoglobin", "saturation", "paO2"},
    "renal_clearance": {"urineConcentration", "plasmaConcentration", "urineFlow"},
}
REFERENCE_KEYS = {k for k, _ in ORGANS}

def first_match(text: str, rules: tuple[tuple[str,str],...]) -> str | None:
    return next((key for key, pattern in rules if re.search(pattern, text, flags=re.I)), None)

def select_visual(speech: str, models: dict[str,str], molecules: dict[str,Any]) -> dict[str,Any] | None:
    if not isinstance(speech, str): return None
    text = re.sub(r"\s+", " ", speech).strip()[:2500]
    if len(text)<13: return None
    key=first_match(text,SIMULATIONS)
    if key: return {"type":"show_physiology_simulation","preset":key,"title":key.replace("_"," ").capitalize()}
    key=first_match(text,MOLECULES)
    item=molecules.get(key) if key else None
    if isinstance(item,dict) and isinstance(item.get("modelUrl"),str):
        return {"type":"show_molecular_model","modelUrl":item["modelUrl"]}
    key=first_match(text,SCHEMATICS) or first_match(text,ORGANS)
    if key:
        url=models.get(key)
        if isinstance(url,str) and url.startswith("https://"):
            return {"type":"show_3d_model","modelUrl":url,"note":(
                "Expert-reviewed healthy reference anatomy; disease changes are explained separately."
                if key in REFERENCE_KEYS else "Simplified teaching schematic; not an actual diseased specimen."
            )}
    return None

class VisualPacer:
    """Avoid abrupt model swaps on successive short spoken phrases."""
    def __init__(self, models: dict[str,str], molecules: dict[str,Any]):
        self.models=models
        self.molecules=molecules
        self.last_visual_key=None
        self.steps_since_switch=2
    def next_for_spoken(self, utterance: str) -> dict[str,Any] | None:
        self.steps_since_switch+=1
        cmd=select_visual(utterance,self.models,self.molecules)
        if cmd is None: return None
        key=json.dumps(cmd,sort_keys=True)
        if key==self.last_visual_key or self.steps_since_switch<2: return None
        self.last_visual_key=key
        self.steps_since_switch=0
        return cmd
    def record_explicit(self, cmd: dict[str,Any]) -> None:
        self.last_visual_key=json.dumps(cmd,sort_keys=True)
        self.steps_since_switch=0

def clean_label(value: Any, limit: int=130) -> str:
    text=re.sub(r"\s+"," ",str(value or "")).strip()[:limit]
    return re.sub(r"[<>{}\[\]\r\n\t\x60]","",text)

def structure_focus(data: dict[str,Any], models: dict[str,str]) -> str | None:
    url=str(data.get("modelUrl") or "")
    if url not in set(models.values()): return None
    name=clean_label(data.get("structureId"),105)
    if not (2<=len(name)<=105):return None
    return (
        f"The learner tapped the labelled structure '{name}' in the displayed approved 3D model. "
        "Identify it, explain its position and function, then connect it to the current lesson. "
        "For HRA models, distinguish healthy reference anatomy from pathology. "
        "If the mesh label is unclear, say so and ask for a clearer selection; never invent details. "
        "Answer this selection first, then continue the topic."
    )

def simulation_snapshot(data: dict[str,Any]) -> str | None:
    preset=clean_label(data.get("preset"),48)
    expected=SIMULATION_VARIABLES.get(preset)
    values=data.get("variables")
    result=data.get("result")
    if not expected or not isinstance(values,dict) or set(values)!=expected:return None
    if type(result) not in (int,float) or not math.isfinite(result) or abs(result)>100000:return None
    nums={}
    for k in expected:
        v=values[k]
        if type(v) not in (int,float) or not math.isfinite(v) or abs(v)>100000:return None
        nums[k]=float(v)
    desc=", ".join(f"{k} {v:g}" for k,v in sorted(nums.items()))
    return (f"{preset.replace('_',' ')} teaching simulation: {desc}; output {result:.3g} "
            f"{clean_label(data.get('unit'),16)}. These are learner-adjusted values, not patient data.")

def interaction_focus(data: dict[str,Any], models: dict[str,str]) -> str | None:
    kind=data.get("type")
    if kind=="structure_selected":return structure_focus(data,models)
    if kind=="simulation_result":
        snapshot=simulation_snapshot(data)
        if snapshot:
            return ("The learner changed an interactive medical simulation: "+snapshot+
                    " Explain why the values affect the result and give a brief clinical example; "
                    "do not imply that any measurements came from a real patient.")
    if kind=="concept_selected":
        concept=clean_label(data.get("concept"),420)
        if len(concept)>=5:
            return ("The learner selected this teaching-board concept: "+concept+
                    ". Explain its mechanism and a relevant clinical example, then continue.")
    return None
