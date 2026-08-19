create extension if not exists pgcrypto;

create table if not exists public.teaching_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_name text not null,
  title text not null default 'New teaching session',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.teaching_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.teaching_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.teaching_attachments (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.teaching_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  created_at timestamptz not null default now()
);

create index if not exists teaching_conversations_user_updated_idx
  on public.teaching_conversations(user_id, updated_at desc);
create index if not exists teaching_messages_conversation_created_idx
  on public.teaching_messages(conversation_id, created_at);
create index if not exists teaching_attachments_conversation_idx
  on public.teaching_attachments(conversation_id, created_at);

alter table public.teaching_conversations enable row level security;
alter table public.teaching_messages enable row level security;
alter table public.teaching_attachments enable row level security;

create policy "Users can read their own teaching conversations"
  on public.teaching_conversations for select
  using (auth.uid() = user_id);
create policy "Users can create their own teaching conversations"
  on public.teaching_conversations for insert
  with check (auth.uid() = user_id);
create policy "Users can update their own teaching conversations"
  on public.teaching_conversations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "Users can delete their own teaching conversations"
  on public.teaching_conversations for delete
  using (auth.uid() = user_id);

create policy "Users can read their own teaching messages"
  on public.teaching_messages for select
  using (auth.uid() = user_id);
create policy "Users can create their own teaching messages"
  on public.teaching_messages for insert
  with check (auth.uid() = user_id);

create policy "Users can read their own teaching attachments"
  on public.teaching_attachments for select
  using (auth.uid() = user_id);
create policy "Users can create their own teaching attachments"
  on public.teaching_attachments for insert
  with check (auth.uid() = user_id);
create policy "Users can delete their own teaching attachments"
  on public.teaching_attachments for delete
  using (auth.uid() = user_id);

create or replace function public.touch_teaching_conversation_updated_at()
returns trigger
language plpgsql
security invoker
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists teaching_conversations_touch_updated_at on public.teaching_conversations;
create trigger teaching_conversations_touch_updated_at
before update on public.teaching_conversations
for each row execute function public.touch_teaching_conversation_updated_at();

insert into storage.buckets (id, name, public)
values ('teaching-attachments', 'teaching-attachments', false)
on conflict (id) do nothing;

create policy "Users can read their own teaching attachment files"
  on storage.objects for select
  using (bucket_id = 'teaching-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can upload their own teaching attachment files"
  on storage.objects for insert
  with check (bucket_id = 'teaching-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can delete their own teaching attachment files"
  on storage.objects for delete
  using (bucket_id = 'teaching-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
