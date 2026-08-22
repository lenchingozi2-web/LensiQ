from __future__ import annotations

import json
from pathlib import Path

ROOT = Path('/home/ubuntu/LensiQ')
SEED = ROOT / 'scripts/reference_curriculum_topics.json'
OUT = ROOT / 'supabase/migrations/0013_reference_curriculum.sql'

COURSES = [
    ('anatomical-pathology', 'Anatomical Pathology', 'General, systemic, autopsy, forensic, and organ-system pathology.', '#F4A261', 1),
    ('chemical-pathology', 'Chemical Pathology', 'Laboratory medicine, renal and liver chemistry, endocrine, metabolic, and clinical chemical pathology.', '#2A9D8F', 2),
    ('haematology-immunology', 'Haematology / Immunology', 'Haematopoiesis, anaemias, haemostasis, malignancy, transfusion medicine, and clinical immunology.', '#457B9D', 3),
    ('microbiology', 'Microbiology', 'Medical microbiology, bacteriology, mycology, parasitology, virology, infection control, and clinical syndromes.', '#7C3AED', 4),
    ('pharmacology', 'Pharmacology', 'General and autonomic pharmacology, system pharmacology, CNS, toxicology, and chemotherapy.', '#E76F51', 5),
]


def sql_literal(value: object) -> str:
    if value is None:
        return 'null'
    if isinstance(value, bool):
        return 'true' if value else 'false'
    return "'" + str(value).replace("'", "''") + "'"


def main() -> None:
    topics = json.loads(SEED.read_text(encoding='utf-8'))
    lines: list[str] = [
        '-- Authoritative curriculum replacement from Pharmacology_and_Pathology_Reference.docx.',
        '-- This migration replaces curriculum topic rows only; it does not modify questions, practicals, knowledge chunks, or attachments.',
        'begin;',
        '',
        'alter table public.curriculum_topics',
        '  add column if not exists subtopics jsonb not null default \'[]\'::jsonb;',
        'alter table public.curriculum_topics drop constraint if exists curriculum_topics_day_number_check;',
        'alter table public.curriculum_topics add constraint curriculum_topics_day_number_check check (day_number between 1 and 20);',
        '',
        'insert into public.curriculum_courses (slug, name, description, accent_color, display_order)',
        'values',
    ]
    lines.append(',\n'.join('  (' + ', '.join(sql_literal(v) for v in row) + ')' for row in COURSES))
    lines.extend([
        'on conflict (slug) do update set',
        '  name = excluded.name,',
        '  description = excluded.description,',
        '  accent_color = excluded.accent_color,',
        '  display_order = excluded.display_order,',
        '  updated_at = now();',
        '',
        '-- Delete only the old curriculum topic rows. Course identities remain stable, and all question-bank data remains untouched.',
        'delete from public.curriculum_topics;',
        '',
        'insert into public.curriculum_topics (course_id, slug, title, day_number, day_title, order_index, subtopics)',
        'select c.id, seed.slug, seed.title, seed.day_number, seed.day_title, seed.order_index, seed.subtopics::jsonb',
        'from public.curriculum_courses c',
        'join (values',
    ])
    seed_rows: list[str] = []
    for topic in topics:
        subtopics_json = json.dumps(topic.get('subtopics', []), ensure_ascii=False, separators=(',', ':'))
        values = [
            topic['course_slug'], topic['slug'], topic['title'], int(topic['day_number']),
            topic['day_title'], int(topic['order_index']), subtopics_json,
        ]
        seed_rows.append('  (' + ', '.join([
            sql_literal(values[0]), sql_literal(values[1]), sql_literal(values[2]),
            str(values[3]), sql_literal(values[4]), str(values[5]), sql_literal(values[6]),
        ]) + ')')
    lines.append(',\n'.join(seed_rows))
    lines.extend([
        ') as seed(course_slug, slug, title, day_number, day_title, order_index, subtopics)',
        '  on seed.course_slug = c.slug;',
        '',
        'commit;',
        '',
    ])
    OUT.write_text('\n'.join(lines), encoding='utf-8')
    print(f'wrote {OUT} with {len(topics)} topics and {sum(len(t.get("subtopics", [])) for t in topics)} subtopics')


if __name__ == '__main__':
    main()
