alter table public.teaching_conversations
  add column if not exists session_type text not null default 'teaching_room';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'teaching_conversations_session_type_check'
  ) then
    alter table public.teaching_conversations
      add constraint teaching_conversations_session_type_check
      check (session_type in ('teaching_room', 'live_class'));
  end if;
end;
$$;

create index if not exists teaching_conversations_user_type_updated_idx
  on public.teaching_conversations(user_id, session_type, updated_at desc);

create table if not exists public.live_class_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.teaching_conversations(id) on delete set null,
  room_name text not null unique,
  course_name text not null default 'Live Class',
  status text not null default 'active' check (status in ('active', 'ended', 'expired')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  last_heartbeat_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists live_class_sessions_user_started_idx
  on public.live_class_sessions(user_id, started_at desc);
create index if not exists live_class_sessions_conversation_idx
  on public.live_class_sessions(conversation_id);

alter table public.live_class_sessions enable row level security;

create policy "Users can read their own live class sessions"
  on public.live_class_sessions for select
  using (auth.uid() = user_id);
create policy "Users can update their own live class sessions"
  on public.live_class_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.reserve_live_class_session(
  p_room_name text,
  p_course_name text default 'Live Class',
  p_conversation_id uuid default null
)
returns table (
  allowed boolean,
  reason text,
  session_id uuid,
  used_sessions integer,
  max_sessions integer,
  max_duration_seconds integer,
  expires_at timestamptz,
  is_unlimited boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_plan text;
  v_plan_expires_at timestamptz;
  v_session_id uuid;
  v_used integer := 0;
  v_month_start timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
  v_month_end timestamptz := (date_trunc('month', now() at time zone 'UTC') + interval '1 month') at time zone 'UTC';
  v_now timestamptz := now();
begin
  if v_user_id is null then
    return query select false, 'not_authenticated', null::uuid, 0, 3, 600, null::timestamptz, false;
    return;
  end if;

  select role, plan, plan_expires_at
    into v_role, v_plan, v_plan_expires_at
  from public.profiles
  where id = v_user_id;

  if v_role = 'admin' or (
    v_plan in ('3mo', '6mo', '9mo', '12mo')
    and (v_plan_expires_at is null or v_plan_expires_at > v_now)
  ) then
    insert into public.live_class_sessions (user_id, conversation_id, room_name, course_name)
      values (v_user_id, p_conversation_id, p_room_name, coalesce(nullif(trim(p_course_name), ''), 'Live Class'))
      returning id into v_session_id;

    return query select true, 'unlimited', v_session_id, null::integer, null::integer, null::integer, null::timestamptz, true;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':live-class-monthly-quota', 0));

  select count(*)::integer
    into v_used
  from public.live_class_sessions
  where user_id = v_user_id
    and started_at >= v_month_start
    and started_at < v_month_end;

  if v_used >= 3 then
    return query select false, 'limit_reached', null::uuid, v_used, 3, 600, v_month_end, false;
    return;
  end if;

  insert into public.live_class_sessions (user_id, conversation_id, room_name, course_name)
    values (v_user_id, p_conversation_id, p_room_name, coalesce(nullif(trim(p_course_name), ''), 'Live Class'))
    returning id into v_session_id;

  return query select true, 'free_allowance', v_session_id, v_used + 1, 3, 600, v_now + interval '10 minutes', false;
end;
$$;

revoke all on function public.reserve_live_class_session(text, text, uuid) from public;
grant execute on function public.reserve_live_class_session(text, text, uuid) to authenticated;
