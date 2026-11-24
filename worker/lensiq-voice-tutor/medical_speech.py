"""Speech-only rendering: source notes and numeric evidence are never rewritten."""
import re
from typing import AsyncIterator

# NCI pronunciations: cancer.gov/publications/dictionaries/cancer-terms/def/{term}
# Cartesia inline IPA syntax: docs.cartesia.ai/build-with-cartesia/capability-guides/custom-pronunciations
PHONEMES = {
    'pharmacokinetics': '<<ˌ|f|ɑ|ɹ|m|ə|k|oʊ|k|ɪ|ˈ|n|ɛ|t|ɪ|k|s>>',
    'adenocarcinoma': '<<ˌ|æ|d|ə|n|oʊ|ˌ|k|ɑ|ɹ|s|ɪ|ˈ|n|oʊ|m|ə>>',
}
ABBREVIATIONS = {
    'eGFR': 'estimated glomerular filtration rate',
    'HbA1c': 'haemoglobin A one C',
    'NSAIDs': 'nonsteroidal anti-inflammatory drugs',
    'NSAID': 'nonsteroidal anti-inflammatory drug',
    'CYP3A4': 'cytochrome P four fifty, three A four',
    'ACE': 'angiotensin converting enzyme',
    'H&E': 'haematoxylin and eosin',
    'TB': 'tuberculosis',
    'MI': 'myocardial infarction',
    'CHF': 'congestive heart failure',
    'DIC': 'disseminated intravascular coagulation',
    'ARDS': 'acute respiratory distress syndrome',
    'CNS': 'central nervous system',
    'RBCs': 'red blood cells',
    'WBCs': 'white blood cells',
    'RBC': 'red blood cell',
    'WBC': 'white blood cell',
    'ECG': 'E C G',
    'DNA': 'D N A',
    'RNA': 'R N A',
    'IgG': 'immunoglobulin G',
    'IgM': 'immunoglobulin M',
    'IgA': 'immunoglobulin A',
    'IgE': 'immunoglobulin E',
    'TNF': 'tumour necrosis factor',
    'IL-1': 'interleukin one',
    'IL-6': 'interleukin six',
}

def medical_speech(text: str) -> str:
    text = re.sub(r'</?(?:speed|emotion|volume|break)\b[^>]*>', '', text, flags=re.I)
    text = text.replace('**', '').replace('__', '').replace('\x60', '')
    text = re.sub(r'(?m)^\s*(?:#{1,6}|[•●▪◦]|[-*]\s+|\d{1,3}[.)]\s+)\s*', '', text)
    text = re.sub(r'[•●▪◦·]+', ', ', text)
    text = re.sub(r'\.{2,}', '.', text)
    text = re.sub(r'(?<!\d)\.(?!\d)(?=\s|$)', '.', text)
    text = re.sub(r'\s+', ' ', text).strip()
    for term, spoken in ABBREVIATIONS.items():
        text = re.sub(r'\b'+re.escape(term)+r'\b', spoken, text)
    for unit, spoken in [('mL/min','millilitres per minute'), ('mmHg','millimetres of mercury'), ('mcg','micrograms'), ('µg','micrograms'), ('μg','micrograms'), ('mg','milligrams'), ('mL','millilitres')]:
        text = re.sub(r'(?<=\d)\s*'+re.escape(unit)+r'\b', ' '+spoken, text)
    text = text.replace('≤', ' less than or equal to ').replace('≥', ' greater than or equal to ')
    text = re.sub(r'>(?=\s*\d)', ' greater than ', text)
    text = re.sub(r'<(?=\s*\d)', ' less than ', text)
    text = text.replace('α','alpha').replace('β','beta')
    for term, pronunciation in PHONEMES.items():
        text = re.sub(r'\b'+term+r'\b', lambda _: pronunciation, text, flags=re.I)
    return text

async def spoken_sentences(source: AsyncIterator[str]) -> AsyncIterator[str]:
    """Keep medical words intact across model token boundaries without waiting for the full answer."""
    pending = ''
    async for part in source:
        pending += part
        while (boundary := re.search(r'[.!?](?=\s)', pending)):
            cut = boundary.end()
            yield medical_speech(pending[:cut])
            pending = pending[cut:].lstrip()
    if pending.strip():
        yield medical_speech(pending)
