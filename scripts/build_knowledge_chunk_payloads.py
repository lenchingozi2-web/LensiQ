from __future__ import annotations

import json
from pathlib import Path

ROOT = Path('/home/ubuntu/LensiQ')
SEED = ROOT / 'scripts/knowledge_chunks_seed.json'
OUT = Path('/tmp/knowledge_chunk_payloads')
BATCH_SIZE = 8


def quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def main() -> None:
    rows = json.loads(SEED.read_text(encoding='utf-8'))
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob('*.json'):
        old.unlink()
    for batch_index in range(0, len(rows), BATCH_SIZE):
        batch = rows[batch_index:batch_index + BATCH_SIZE]
        values = ',\n'.join(
            f"  ({quote(row['document_id'])}, {quote(row['course'])}, {int(row['chunk_index'])}, {quote(row['content'])})"
            for row in batch
        )
        query = (
            'insert into public.knowledge_document_chunks (document_id, course, chunk_index, content)\n'
            'values\n'
            f'{values}\n'
            'on conflict (document_id, chunk_index) do update set\n'
            '  course = excluded.course,\n'
            '  content = excluded.content;'
        )
        payload = {'project_id': 'hixvbcrrklyajhkyliay', 'query': query}
        (OUT / f'batch_{batch_index // BATCH_SIZE + 1:02d}.json').write_text(json.dumps(payload), encoding='utf-8')
    print(f'Wrote {(len(rows) + BATCH_SIZE - 1) // BATCH_SIZE} payloads for {len(rows)} chunks')


if __name__ == '__main__':
    main()
