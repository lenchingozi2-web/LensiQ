-- New tables are private by owner-scoped RLS; uploaded materials remain in a private Storage bucket.
begin;
create extension if not exists vector;
create table if not exists public.study_syllabi (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.live_class_sessions(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','compiling','ready','ended','purged','failed')),
  active_generation integer not null default 0 check (active_generation >= 0),
  staging_generation integer,
  reserved_bytes bigint not null default 0 check (reserved_bytes between 0 and 73400320),
  used_bytes bigint not null default 0 check (used_bytes between 0 and 73400320),
  expires_at timestamptz not null default (now() + interval '90 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.study_documents (
  id uuid primary key default gen_random_uuid(),
  syllabus_id uuid not null references public.study_syllabi(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  original_name text not null,
  storage_path text not null unique,
  reserved_size_bytes bigint not null check (reserved_size_bytes > 0 and reserved_size_bytes <= 73400320),
  actual_size_bytes bigint not null default 0 check (actual_size_bytes >= 0),
  status text not null default 'reserved' check (status in ('reserved','uploaded','indexed','removed','failed')),
  created_at timestamptz not null default now()
);
create index if not exists study_documents_syllabus_idx on public.study_documents (syllabus_id, status);
create table if not exists public.syllabus_concept_nodes (
  id uuid primary key default gen_random_uuid(),
  syllabus_id uuid not null references public.study_syllabi(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  generation integer not null check (generation > 0),
  parent_id uuid references public.syllabus_concept_nodes(id) on delete cascade,
  node_type text not null check (node_type in ('module','topic','concept')),
  title text not null,
  sort_order integer not null default 0,
  consolidated_notes text not null default '',
  key_details_json jsonb not null default '[]'::jsonb,
  visual_spec_json jsonb not null default '{}'::jsonb,
  source_citations_json jsonb not null default '[]'::jsonb
);
create index if not exists syllabus_node_active_idx on public.syllabus_concept_nodes(syllabus_id,generation,parent_id,sort_order);
create table if not exists public.document_atomic_chunks (
  id uuid primary key default gen_random_uuid(),
  syllabus_id uuid not null references public.study_syllabi(id) on delete cascade,
  document_id uuid not null references public.study_documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_node_id uuid references public.syllabus_concept_nodes(id) on delete cascade,
  generation integer not null check (generation > 0),
  chunk_text text not null check (length(chunk_text) > 0),
  source_file text not null,
  page_number integer,
  embedding vector(1536),
  fts tsvector generated always as (to_tsvector('english'::regconfig,chunk_text)) stored,
  created_at timestamptz not null default now()
);
create index if not exists document_chunk_owner_idx on public.document_atomic_chunks(syllabus_id,generation,user_id);
create index if not exists document_chunk_fts_idx on public.document_atomic_chunks using gin(fts);
create index if not exists document_chunk_embed_idx on public.document_atomic_chunks using hnsw(embedding vector_cosine_ops);
alter table public.study_syllabi enable row level security;
alter table public.study_documents enable row level security;
alter table public.syllabus_concept_nodes enable row level security;
alter table public.document_atomic_chunks enable row level security;
create policy syllabus_owner_read on public.study_syllabi for select to authenticated using ((select auth.uid())=user_id);
create policy syllabus_owner_insert on public.study_syllabi for insert to authenticated with check ((select auth.uid())=user_id);
create policy syllabus_owner_update on public.study_syllabi for update to authenticated
  using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy document_owner_read on public.study_documents for select to authenticated using ((select auth.uid())=user_id);
create policy node_owner_read on public.syllabus_concept_nodes for select to authenticated using ((select auth.uid())=user_id);
create policy chunk_owner_read on public.document_atomic_chunks for select to authenticated using ((select auth.uid())=user_id);
-- Any writes to generated indexes require the server's non-browser service client.
revoke insert,update,delete on public.study_documents from anon,authenticated;
revoke insert,update,delete on public.syllabus_concept_nodes from anon,authenticated;
revoke insert,update,delete on public.document_atomic_chunks from anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('ephemeral_class_materials','ephemeral_class_materials',false,73400320,
 array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'application/vnd.openxmlformats-officedocument.presentationml.presentation','text/plain'])
on conflict(id) do update set public=false,file_size_limit=73400320,allowed_mime_types=excluded.allowed_mime_types;

-- Signed URL creation requires Storage INSERT authorization. Limit it to
-- exact rows reserved for the authenticated learner; bucket remains private.
create policy "Owner can sign reserved syllabus uploads"
on storage.objects for insert to authenticated
with check (
 bucket_id='ephemeral_class_materials'
 and exists (
   select 1 from public.study_documents d
   join public.study_syllabi s on s.id=d.syllabus_id
   where d.storage_path=storage.objects.name and d.user_id=(select auth.uid())
     and d.status='reserved' and s.user_id=d.user_id and s.status='draft'
     and s.expires_at>now()
 )
);
-- Atomic reservations prevent parallel uploads exceeding 25 files or 70 MiB.
create or replace function public.reserve_study_documents(p_syllabus_id uuid,p_files jsonb)
returns table(document_id uuid,storage_path text,original_name text) language plpgsql security definer
set search_path=public,extensions,storage as $$
declare v_owner uuid := auth.uid(); v_syllabus public.study_syllabi%rowtype;
  v_file jsonb; v_ext text; v_name text; v_bytes bigint; v_id uuid;
  v_total bigint := 0; v_count int := 0;
begin
  if v_owner is null then raise exception 'Sign-in required' using errcode='42501'; end if;
  select * into v_syllabus from public.study_syllabi where id=p_syllabus_id and user_id=v_owner for update;
  if not found or v_syllabus.status not in ('draft','failed') or v_syllabus.expires_at <= now()
    then raise exception 'Syllabus cannot accept uploads' using errcode='42501'; end if;
  if jsonb_typeof(p_files) <> 'array' or jsonb_array_length(p_files)=0 or jsonb_array_length(p_files)>25
    then raise exception 'Invalid file batch'; end if;
  for v_file in select value from jsonb_array_elements(p_files) loop
    v_bytes := (v_file->>'size')::bigint;
    v_name := left(coalesce(v_file->>'name',''),180);
    v_ext := lower(split_part(v_name,'.',array_length(string_to_array(v_name,'.'),1)));
    if v_ext not in ('pdf','doc','docx','pptx','txt') or v_bytes <= 0 or v_bytes > 73400320
      then raise exception 'Unsupported document name or size'; end if;
    v_total:=v_total+v_bytes; v_count:=v_count+1;
  end loop;
  if v_syllabus.reserved_bytes + v_total > 73400320
   or (select count(*) from public.study_documents where syllabus_id=p_syllabus_id and status<>'removed')+v_count>25
   then raise exception 'Syllabus quota exceeded'; end if;
  for v_file in select value from jsonb_array_elements(p_files) loop
    v_id:=gen_random_uuid();v_name:=left(v_file->>'name',180);
    v_ext:=lower(split_part(v_name,'.',array_length(string_to_array(v_name,'.'),1)));
    insert into public.study_documents(id,syllabus_id,user_id,original_name,storage_path,reserved_size_bytes)
    values(v_id,p_syllabus_id,v_owner,v_name,v_owner::text||'/'||p_syllabus_id::text||'/'||v_id::text||'.'||v_ext,(v_file->>'size')::bigint);
    document_id:=v_id;original_name:=v_name;
    storage_path:=v_owner::text||'/'||p_syllabus_id::text||'/'||v_id::text||'.'||v_ext;
    return next;
  end loop;
  update public.study_syllabi set reserved_bytes=reserved_bytes+v_total,updated_at=now() where id=p_syllabus_id;
end;$$;
revoke all on function public.reserve_study_documents(uuid,jsonb) from public;
grant execute on function public.reserve_study_documents(uuid,jsonb) to authenticated;

-- Verify Storage metadata rather than trusting the browser's declared size.
create or replace function public.confirm_study_document(p_document_id uuid)
returns bigint language plpgsql security definer set search_path=public,storage as $$
declare v_owner uuid:=auth.uid();v_doc public.study_documents%rowtype;v_size bigint;
begin
  select * into v_doc from public.study_documents where id=p_document_id and user_id=v_owner for update;
  if not found then raise exception 'Document not found' using errcode='42501'; end if;
  if v_doc.status in ('uploaded','indexed') then return v_doc.actual_size_bytes; end if;
  if v_doc.status<>'reserved' then raise exception 'Document not confirmable'; end if;
  select nullif(metadata->>'size','')::bigint into v_size from storage.objects
    where bucket_id='ephemeral_class_materials' and name=v_doc.storage_path;
  if v_size is null or v_size<=0 or v_size>v_doc.reserved_size_bytes
    then raise exception 'Storage upload size differs from reservation'; end if;
  update public.study_documents set status='uploaded',actual_size_bytes=v_size where id=p_document_id;
  update public.study_syllabi set used_bytes=used_bytes+v_size,updated_at=now() where id=v_doc.syllabus_id;
  return v_size;
end;$$;
revoke all on function public.confirm_study_document(uuid) from public;
grant execute on function public.confirm_study_document(uuid) to authenticated;

create or replace function public.search_study_chunks(
 p_syllabus_id uuid,p_query text,p_embedding vector(1536) default null,p_limit integer default 8)
returns table(id uuid,concept_node_id uuid,chunk_text text,source_file text,page_number integer,score double precision)
language sql stable security invoker set search_path=public,extensions as $$
with target as (
 select id,active_generation from public.study_syllabi
 where id=p_syllabus_id and user_id=auth.uid() and status='ready'
),
lex as (
 select c.id,row_number() over(order by ts_rank_cd(c.fts,websearch_to_tsquery('english',p_query)) desc,c.id) as rank
 from public.document_atomic_chunks c join target t on t.id=c.syllabus_id and t.active_generation=c.generation
 where c.user_id=auth.uid() and c.fts @@ websearch_to_tsquery('english',p_query)
 order by ts_rank_cd(c.fts,websearch_to_tsquery('english',p_query)) desc limit 80
),
semantic as (
 select c.id,row_number() over(order by c.embedding <=> p_embedding,c.id) as rank
 from public.document_atomic_chunks c join target t on t.id=c.syllabus_id and t.active_generation=c.generation
 where c.user_id=auth.uid() and p_embedding is not null and c.embedding is not null
 order by c.embedding <=> p_embedding,c.id limit 80
), fused as (
 select coalesce(l.id,s.id) as id,coalesce(1.0/(60+l.rank),0)+coalesce(1.0/(60+s.rank),0) as rr
 from lex l full join semantic s on s.id=l.id
)
select c.id,c.concept_node_id,c.chunk_text,c.source_file,c.page_number,f.rr::double precision
from fused f join public.document_atomic_chunks c on c.id=f.id
order by f.rr desc,c.id limit greatest(1,least(coalesce(p_limit,8),25))
$$;
revoke all on function public.search_study_chunks(uuid,text,vector(1536),integer) from public;
grant execute on function public.search_study_chunks(uuid,text,vector(1536),integer) to authenticated;
commit;
