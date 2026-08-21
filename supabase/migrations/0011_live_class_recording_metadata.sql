alter table public.teaching_conversations
  add column if not exists recording_path text;

alter table public.teaching_conversations
  add column if not exists recording_mime_type text;

alter table public.teaching_conversations
  add column if not exists recording_size_bytes bigint;

alter table public.teaching_conversations
  add column if not exists recording_created_at timestamptz;
