create extension if not exists vector;

create table if not exists public.lecture_chunks (
  id uuid primary key default gen_random_uuid(),
  attachment_id uuid not null references public.teaching_attachments(id) on delete cascade,
  page_number integer not null check (page_number >= 1),
  chunk_text text not null,
  embedding vector(768),
  created_at timestamptz not null default now()
);

create index if not exists lecture_chunks_attachment_page_idx
  on public.lecture_chunks(attachment_id, page_number, id);

create index if not exists lecture_chunks_embedding_idx
  on public.lecture_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create table if not exists public.slide_question_mappings (
  chunk_id uuid not null references public.lecture_chunks(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  confidence_score double precision not null check (confidence_score >= 0 and confidence_score <= 1),
  created_at timestamptz not null default now(),
  primary key (chunk_id, question_id)
);

create index if not exists slide_question_mappings_question_idx
  on public.slide_question_mappings(question_id);

create index if not exists slide_question_mappings_confidence_idx
  on public.slide_question_mappings(confidence_score desc);

alter table public.lecture_chunks enable row level security;
alter table public.slide_question_mappings enable row level security;

drop policy if exists "Users can read their own lecture chunks" on public.lecture_chunks;
drop policy if exists "Users can create their own lecture chunks" on public.lecture_chunks;
drop policy if exists "Users can update their own lecture chunks" on public.lecture_chunks;
drop policy if exists "Users can delete their own lecture chunks" on public.lecture_chunks;

create policy "Users can read their own lecture chunks"
  on public.lecture_chunks for select
  using (
    exists (
      select 1
      from public.teaching_attachments attachment
      where attachment.id = lecture_chunks.attachment_id
        and attachment.user_id = auth.uid()
    )
  );

create policy "Users can create their own lecture chunks"
  on public.lecture_chunks for insert
  with check (
    exists (
      select 1
      from public.teaching_attachments attachment
      where attachment.id = lecture_chunks.attachment_id
        and attachment.user_id = auth.uid()
    )
  );

create policy "Users can update their own lecture chunks"
  on public.lecture_chunks for update
  using (
    exists (
      select 1
      from public.teaching_attachments attachment
      where attachment.id = lecture_chunks.attachment_id
        and attachment.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.teaching_attachments attachment
      where attachment.id = lecture_chunks.attachment_id
        and attachment.user_id = auth.uid()
    )
  );

create policy "Users can delete their own lecture chunks"
  on public.lecture_chunks for delete
  using (
    exists (
      select 1
      from public.teaching_attachments attachment
      where attachment.id = lecture_chunks.attachment_id
        and attachment.user_id = auth.uid()
    )
  );

drop policy if exists "Users can read their own slide question mappings" on public.slide_question_mappings;
drop policy if exists "Users can create their own slide question mappings" on public.slide_question_mappings;
drop policy if exists "Users can update their own slide question mappings" on public.slide_question_mappings;
drop policy if exists "Users can delete their own slide question mappings" on public.slide_question_mappings;

create policy "Users can read their own slide question mappings"
  on public.slide_question_mappings for select
  using (
    exists (
      select 1
      from public.lecture_chunks chunk
      join public.teaching_attachments attachment on attachment.id = chunk.attachment_id
      where chunk.id = slide_question_mappings.chunk_id
        and attachment.user_id = auth.uid()
    )
  );

create policy "Users can create their own slide question mappings"
  on public.slide_question_mappings for insert
  with check (
    exists (
      select 1
      from public.lecture_chunks chunk
      join public.teaching_attachments attachment on attachment.id = chunk.attachment_id
      where chunk.id = slide_question_mappings.chunk_id
        and attachment.user_id = auth.uid()
    )
  );

create policy "Users can update their own slide question mappings"
  on public.slide_question_mappings for update
  using (
    exists (
      select 1
      from public.lecture_chunks chunk
      join public.teaching_attachments attachment on attachment.id = chunk.attachment_id
      where chunk.id = slide_question_mappings.chunk_id
        and attachment.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.lecture_chunks chunk
      join public.teaching_attachments attachment on attachment.id = chunk.attachment_id
      where chunk.id = slide_question_mappings.chunk_id
        and attachment.user_id = auth.uid()
    )
  );

create policy "Users can delete their own slide question mappings"
  on public.slide_question_mappings for delete
  using (
    exists (
      select 1
      from public.lecture_chunks chunk
      join public.teaching_attachments attachment on attachment.id = chunk.attachment_id
      where chunk.id = slide_question_mappings.chunk_id
        and attachment.user_id = auth.uid()
    )
  );
