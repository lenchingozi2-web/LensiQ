begin;
-- Phase 2: durable, owner-scoped orchestration and race-safe purge.
alter table public.study_syllabi drop constraint if exists study_syllabi_status_check;
alter table public.study_syllabi add constraint study_syllabi_status_check
  check(status in ('draft','compiling','ready','ended','purging','purged','failed'));
alter table public.study_syllabi add column if not exists purged_at timestamptz;

-- Only the service client may change lifecycle, active generation or expiry.
revoke update on public.study_syllabi from authenticated;
revoke delete on public.study_syllabi from authenticated;

create table if not exists public.live_class_lessons (
  session_id uuid primary key references public.live_class_sessions(id) on delete cascade,
  syllabus_id uuid not null references public.study_syllabi(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  phase text not null default 'IDLE' check(phase in ('IDLE','SYLLABUS_READY','TEACHING_NODE','HANDLING_INTERRUPT','CHECKPOINT_VERIFICATION','PAUSED','COMPLETED')),
  state_version bigint not null default 0 check(state_version >= 0),
  nodes_json jsonb not null default '[]'::jsonb,
  cursor integer not null default -1,
  current_node_id uuid,
  previous_phase text,
  visual_stack_json jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists live_class_lessons_owner_idx on public.live_class_lessons(user_id,syllabus_id);
alter table public.live_class_lessons enable row level security;
create policy live_class_lesson_owner_read on public.live_class_lessons
  for select to authenticated using ((select auth.uid()) = user_id);
revoke insert,update,delete on public.live_class_lessons from anon,authenticated;

-- A terminating class cannot race a 70MiB indexing job and have rows reappear
-- after cleanup: every index write locks and verifies the active staging lease.
create or replace function public.guard_syllabus_index_write()
returns trigger language plpgsql security invoker set search_path=public as $$
declare v_status text; v_generation integer; v_expiry timestamptz;
begin
  select status,staging_generation,expires_at into v_status,v_generation,v_expiry
    from public.study_syllabi where id=new.syllabus_id and user_id=new.user_id for share;
  if not found or v_status<>'compiling' or v_generation is distinct from new.generation
     or v_expiry<=now() then
    raise exception 'Syllabus compilation is no longer active';
  end if;
  return new;
end;$$;
drop trigger if exists guard_concept_node_write on public.syllabus_concept_nodes;
create trigger guard_concept_node_write before insert on public.syllabus_concept_nodes
for each row execute function public.guard_syllabus_index_write();
drop trigger if exists guard_atomic_chunk_write on public.document_atomic_chunks;
create trigger guard_atomic_chunk_write before insert on public.document_atomic_chunks
for each row execute function public.guard_syllabus_index_write();

-- Ensure newly linked syllabi always belong to the same active class owner.
create or replace function public.guard_study_syllabus_session()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if new.session_id is not null and not exists(
    select 1 from public.live_class_sessions
    where id=new.session_id and user_id=new.user_id and status='active'
  ) then raise exception 'Syllabus must belong to an active owned Live Class' using errcode='42501';end if;
  return new;
end;$$;
drop trigger if exists guard_study_syllabus_session on public.study_syllabi;
create trigger guard_study_syllabus_session before insert or update of session_id
on public.study_syllabi for each row execute function public.guard_study_syllabus_session();
commit;
