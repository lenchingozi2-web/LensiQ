create table if not exists public.knowledge_document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  course text not null,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null,
  created_at timestamptz not null default now(),
  unique(document_id, chunk_index)
);

create index if not exists knowledge_chunks_course_idx
  on public.knowledge_document_chunks(course, document_id, chunk_index);
create index if not exists knowledge_chunks_search_tsv_idx
  on public.knowledge_document_chunks using gin (
    to_tsvector('simple'::regconfig, coalesce(content, ''))
  );

alter table public.knowledge_document_chunks enable row level security;

create or replace function public.search_knowledge_chunks(
  search_text text,
  course_filter text default null,
  max_results integer default 12
)
returns table (
  document_id uuid,
  course text,
  chunk_index integer,
  content text,
  relevance real
)
language sql stable security definer set search_path = public
as $$
  with query_terms as (
    select websearch_to_tsquery('simple', trim(search_text)) as tsquery
  )
  select c.document_id, c.course, c.chunk_index, c.content,
    ts_rank_cd(to_tsvector('simple'::regconfig, coalesce(c.content, '')), query_terms.tsquery) as relevance
  from public.knowledge_document_chunks c
  cross join query_terms
  where length(trim(search_text)) > 0
    and (course_filter is null or c.course = course_filter)
    and to_tsvector('simple'::regconfig, coalesce(c.content, '')) @@ query_terms.tsquery
  order by relevance desc, c.chunk_index asc
  limit least(greatest(coalesce(max_results, 12), 1), 30);
$$;

revoke all on function public.search_knowledge_chunks(text, text, integer) from public;
grant execute on function public.search_knowledge_chunks(text, text, integer) to authenticated, service_role;
