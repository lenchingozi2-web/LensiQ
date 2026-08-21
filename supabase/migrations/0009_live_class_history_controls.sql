alter table public.teaching_conversations
  add column if not exists is_pinned boolean not null default false;

alter table public.teaching_conversations
  add column if not exists deleted_at timestamptz;

create index if not exists teaching_conversations_history_controls_idx
  on public.teaching_conversations(user_id, session_type, is_pinned desc, updated_at desc)
  where deleted_at is null;
