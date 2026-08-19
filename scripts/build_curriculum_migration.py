from __future__ import annotations

import json
from pathlib import Path

ROOT = Path('/home/ubuntu/LensiQ')
TOPICS_PATH = ROOT / 'scripts/timetable_topics.json'
MIGRATION_PATH = ROOT / 'supabase/migrations/0003_curriculum_discovery.sql'

COURSES = [
    ('anatomical-pathology', 'Anatomical Pathology', 'Cell injury, inflammation, organ-system pathology, neoplasia, and practical specimen recognition.', '#F4A261', 1),
    ('chemical-pathology', 'Chemical Pathology', 'Clinical chemistry, endocrine testing, metabolic disease, and laboratory interpretation.', '#2A9D8F', 2),
    ('haematology-immunology', 'Haematology / Immunology', 'Blood formation, anaemia, transfusion, haem malignancy, immunity, and immune disorders.', '#457B9D', 3),
    ('microbiology', 'Microbiology', 'Bacteriology, virology, mycology, parasitology, infection control, and diagnosis.', '#7C3AED', 4),
    ('pharmacology', 'Pharmacology', 'General, autonomic, antimicrobial, endocrine, CNS, cardiovascular, and clinical pharmacology.', '#E76F51', 5),
]


def quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def main() -> None:
    topics = json.loads(TOPICS_PATH.read_text(encoding='utf-8'))
    lines: list[str] = [
        '-- Generated from Year4_7Day_Master_Timetable.pdf. Do not alter questions in this migration.',
        'create extension if not exists pg_trgm;',
        '',
        'create table if not exists public.curriculum_courses (',
        '  id uuid primary key default gen_random_uuid(),',
        '  slug text not null unique,',
        '  name text not null unique,',
        '  description text not null,',
        '  accent_color text not null default \'#E8A23D\',',
        '  display_order integer not null default 0,',
        '  created_at timestamptz not null default now(),',
        '  updated_at timestamptz not null default now()',
        ');',
        '',
        'create table if not exists public.curriculum_topics (',
        '  id uuid primary key default gen_random_uuid(),',
        '  course_id uuid not null references public.curriculum_courses(id) on delete cascade,',
        '  slug text not null,',
        '  title text not null,',
        '  day_number smallint not null check (day_number between 1 and 7),',
        '  day_title text not null,',
        '  order_index integer not null default 0,',
        '  created_at timestamptz not null default now(),',
        '  updated_at timestamptz not null default now(),',
        '  unique(course_id, slug)',
        ');',
        '',
        'create index if not exists curriculum_topics_course_order_idx',
        '  on public.curriculum_topics(course_id, day_number, order_index);',
        'create index if not exists curriculum_topics_title_trgm_idx',
        '  on public.curriculum_topics using gin (title gin_trgm_ops);',
        '',
        'alter table public.teaching_attachments',
        '  add column if not exists extraction_status text not null default \'pending\',',
        '  add column if not exists extracted_text text,',
        '  add column if not exists extraction_error text,',
        '  add column if not exists extracted_at timestamptz;',
        '',
        'create table if not exists public.curriculum_attachment_chunks (',
        '  id uuid primary key default gen_random_uuid(),',
        '  attachment_id uuid not null references public.teaching_attachments(id) on delete cascade,',
        '  user_id uuid not null references auth.users(id) on delete cascade,',
        '  chunk_index integer not null check (chunk_index >= 0),',
        '  content text not null,',
        '  created_at timestamptz not null default now(),',
        '  unique(attachment_id, chunk_index)',
        ');',
        '',
        'create index if not exists curriculum_attachment_chunks_user_idx',
        '  on public.curriculum_attachment_chunks(user_id, attachment_id, chunk_index);',
        '',
        'alter table public.curriculum_courses enable row level security;',
        'alter table public.curriculum_topics enable row level security;',
        'alter table public.curriculum_attachment_chunks enable row level security;',
        '',
        'drop policy if exists "Anyone can read curriculum courses" on public.curriculum_courses;',
        'create policy "Anyone can read curriculum courses" on public.curriculum_courses',
        '  for select using (true);',
        'drop policy if exists "Anyone can read curriculum topics" on public.curriculum_topics;',
        'create policy "Anyone can read curriculum topics" on public.curriculum_topics',
        '  for select using (true);',
        'drop policy if exists "Users can read their own attachment chunks" on public.curriculum_attachment_chunks;',
        'create policy "Users can read their own attachment chunks" on public.curriculum_attachment_chunks',
        '  for select using (auth.uid() = user_id);',
        'drop policy if exists "Users can create their own attachment chunks" on public.curriculum_attachment_chunks;',
        'create policy "Users can create their own attachment chunks" on public.curriculum_attachment_chunks',
        '  for insert with check (auth.uid() = user_id);',
        'drop policy if exists "Users can delete their own attachment chunks" on public.curriculum_attachment_chunks;',
        'create policy "Users can delete their own attachment chunks" on public.curriculum_attachment_chunks',
        '  for delete using (auth.uid() = user_id);',
        '',
        'insert into public.curriculum_courses (slug, name, description, accent_color, display_order)',
        'values',
    ]
    lines.append(',\n'.join(f'  ({quote(slug)}, {quote(name)}, {quote(description)}, {quote(accent)}, {order_index})' for slug, name, description, accent, order_index in COURSES) + '\non conflict (slug) do update set\n  name = excluded.name,\n  description = excluded.description,\n  accent_color = excluded.accent_color,\n  display_order = excluded.display_order,\n  updated_at = now();')
    lines.append('')
    lines.append('insert into public.curriculum_topics (course_id, slug, title, day_number, day_title, order_index)')
    lines.append('select c.id, seed.slug, seed.title, seed.day_number, seed.day_title, seed.order_index')
    lines.append('from public.curriculum_courses c')
    lines.append('join (values')
    seed_values = []
    for topic in topics:
        seed_values.append(
            f"  ({quote(topic['course_slug'])}, {quote(topic['slug'])}, {quote(topic['title'])}, {int(topic['day_number'])}, {quote(topic['day_title'])}, {int(topic['order_index'])})"
        )
    lines.append(',\n'.join(seed_values))
    lines.append(') as seed(course_slug, slug, title, day_number, day_title, order_index) on seed.course_slug = c.slug')
    lines.append('on conflict (course_id, slug) do update set')
    lines.append('  title = excluded.title,')
    lines.append('  day_number = excluded.day_number,')
    lines.append('  day_title = excluded.day_title,')
    lines.append('  order_index = excluded.order_index,')
    lines.append('  updated_at = now();')
    lines.extend([
        '',
        'create index if not exists questions_search_tsv_idx on public.questions using gin (',
        "  to_tsvector('simple'::regconfig, coalesce(question_text, '') || ' ' || coalesce(division, '') || ' ' || coalesce(topic, '') || ' ' || coalesce(source_flag, '') || ' ' || coalesce(model_answer, ''))",
        ');',
        '',
        'create or replace function public.search_question_bank(',
        '  search_text text,',
        '  subject_filter text default null,',
        '  division_filter text default null,',
        '  max_results integer default 40',
        ')',
        'returns table (',
        '  id uuid, subject text, division text, topic text, type text, year integer,',
        '  question_text text, image_url text, correct_answer text, model_answer text, relevance real',
        ')',
        'language sql stable set search_path = public',
        'as $$',
        '  with query_terms as (',
        "    select websearch_to_tsquery('simple', trim(search_text)) as tsquery",
        '  )',
        '  select q.id, q.subject, q.division, q.topic, q.type, q.year, q.question_text, q.image_url,',
        '    q.correct_answer, q.model_answer,',
        "    ts_rank_cd(to_tsvector('simple', concat_ws(' ', q.question_text, q.division, q.topic, q.source_flag, q.model_answer)), query_terms.tsquery) as relevance",
        '  from public.questions q',
        '  cross join query_terms',
        '  where length(trim(search_text)) > 0',
        '    and (subject_filter is null or q.subject = subject_filter)',
        '    and (division_filter is null or q.division = division_filter)',
        "    and (to_tsvector('simple', concat_ws(' ', q.question_text, q.division, q.topic, q.source_flag, q.model_answer)) @@ query_terms.tsquery",
        "      or q.question_text ilike '%' || trim(search_text) || '%'",
        "      or coalesce(q.topic, '') ilike '%' || trim(search_text) || '%'",
        "      or coalesce(q.division, '') ilike '%' || trim(search_text) || '%')",
        '  order by relevance desc, q.created_at desc',
        '  limit least(greatest(coalesce(max_results, 40), 1), 100);',
        '$$;',
        '',
        'revoke all on function public.search_question_bank(text, text, text, integer) from public;',
        'grant execute on function public.search_question_bank(text, text, text, integer) to anon, authenticated, service_role;',
    ])
    MIGRATION_PATH.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f'Wrote {MIGRATION_PATH} with {len(topics)} timetable topics')


if __name__ == '__main__':
    main()
