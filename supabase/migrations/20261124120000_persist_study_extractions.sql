begin;

-- Parsed extraction is temporary and tied to the uploaded file's lifecycle.
-- A compile retry reuses this structured artifact instead of downloading and
-- extracting the source file once per batch. It is deleted with the document.
create table if not exists public.study_document_extractions (
  document_id uuid primary key references public.study_documents(id) on delete cascade,
  syllabus_id uuid not null references public.study_syllabi(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parser_version integer not null,
  extraction_json jsonb not null,
  extracted_at timestamptz not null default now()
);

create index if not exists study_document_extractions_owner_idx
  on public.study_document_extractions(user_id, syllabus_id);
alter table public.study_document_extractions enable row level security;
create policy study_document_extractions_owner_read on public.study_document_extractions
  for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.study_document_extractions from anon, authenticated;

commit;
