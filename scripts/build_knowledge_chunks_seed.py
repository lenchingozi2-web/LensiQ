from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

ROOT = Path('/home/ubuntu')
OUTPUT = Path('/home/ubuntu/LensiQ/scripts/knowledge_chunks_seed.json')
CHUNK_SIZE = 4500
OVERLAP = 250

DOCUMENTS = [
    ('cfff6aee-b499-43e8-a4a3-7ba9f27ce330', 'Anatomical Pathology', ROOT / 'lenxiq_new_practicals/knowledge_parts/Anatomical_Pathology/Anatomical_Pathology_part_01.pdf'),
    ('89b3f1cc-c47d-4968-91df-845cfa77bb98', 'Anatomical Pathology', ROOT / 'lenxiq_new_practicals/knowledge_parts/Anatomical_Pathology/Anatomical_Pathology_part_02.pdf'),
    ('6435f4ac-0484-4858-b0b0-590e97533c6b', 'Chemical Pathology', ROOT / 'lenxiq_new_practicals/knowledge_parts/Chemical_Pathology/Chemical_Pathology_part_01.pdf'),
    ('f25b59c8-91ea-463d-9665-687a37a896e5', 'Chemical Pathology', ROOT / 'lenxiq_new_practicals/knowledge_parts/Chemical_Pathology/Chemical_Pathology_part_02.pdf'),
    ('a0c5d27a-7383-4ae6-99e3-55a60050b9fd', 'Haematology/Immunology', ROOT / 'lenxiq_new_practicals/knowledge_parts/Haematology_and_Immunology/Haematology_and_Immunology_part_01.pdf'),
    ('58621267-1bdc-4da2-bb81-2fd6690149d2', 'Haematology/Immunology', ROOT / 'lenxiq_new_practicals/knowledge_parts/Haematology_and_Immunology/Haematology_and_Immunology_part_02.pdf'),
    ('91158784-99db-4958-9316-4ed548dfeb31', 'Microbiology', ROOT / 'lenxiq_new_practicals/knowledge_parts/Medical_Microbiology/Medical_Microbiology_part_01.pdf'),
    ('f1828c5c-9be3-44de-9b2e-1318ab6525a6', 'Pharmacology', ROOT / 'lenxiq_new_practicals/knowledge_parts/Pharmacology/Pharmacology_part_01.pdf'),
    ('c926a9aa-e60d-414f-830c-880063e8f821', 'Pharmacology', ROOT / 'lenxiq_new_practicals/knowledge_parts/Pharmacology/Pharmacology_part_02.pdf'),
]


def normalize(value: str) -> str:
    value = value.replace('\x0c', '\n')
    value = re.sub(r'[ \t]+', ' ', value)
    value = re.sub(r'\n{3,}', '\n\n', value)
    return value.strip()


def chunks(text: str) -> list[str]:
    text = normalize(text)
    result: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + CHUNK_SIZE, len(text))
        if end < len(text):
            boundary = text.rfind('\n\n', start + CHUNK_SIZE // 2, end)
            if boundary > start:
                end = boundary
        chunk = text[start:end].strip()
        if chunk:
            result.append(chunk)
        if end >= len(text):
            break
        start = max(end - OVERLAP, start + 1)
    return result


def extract(pdf_path: Path) -> str:
    completed = subprocess.run(
        ['pdftotext', '-layout', str(pdf_path), '-'],
        check=True,
        capture_output=True,
        text=True,
    )
    return completed.stdout


def main() -> None:
    rows: list[dict[str, object]] = []
    for document_id, course, pdf_path in DOCUMENTS:
        text = extract(pdf_path)
        document_chunks = chunks(text)
        for index, content in enumerate(document_chunks):
            rows.append({
                'document_id': document_id,
                'course': course,
                'chunk_index': index,
                'content': content,
            })
        print(f'{course}: {pdf_path.name} -> {len(document_chunks)} chunks, {len(text):,} raw characters')

    if not rows:
        raise SystemExit('No knowledge-bank chunks were generated')
    OUTPUT.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Wrote {len(rows)} chunks to {OUTPUT}')


if __name__ == '__main__':
    main()
