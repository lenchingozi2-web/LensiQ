-- LenxiQ Studio video jobs
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  bgm_query text not null default '',
  scenes jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'rendering', 'completed', 'failed')),
  output_url text,
  youtube_video_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists videos_status_created_at_idx on public.videos(status, created_at);
create index if not exists videos_user_created_at_idx on public.videos(user_id, created_at desc);
alter table public.videos enable row level security;

drop policy if exists "Users can read their own video jobs" on public.videos;
create policy "Users can read their own video jobs" on public.videos for select using (auth.uid() = user_id);
drop policy if exists "Users can create their own video jobs" on public.videos;
create policy "Users can create their own video jobs" on public.videos for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their own video jobs" on public.videos;
create policy "Users can update their own video jobs" on public.videos for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists videos_set_updated_at on public.videos;
create or replace function public.set_videos_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger videos_set_updated_at before update on public.videos for each row execute function public.set_videos_updated_at();
