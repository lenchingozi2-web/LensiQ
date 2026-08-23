begin;

alter table public.profiles
  add column if not exists voice_minutes_balance integer not null default 0,
  add column if not exists text_teaching_balance integer not null default 0,
  add column if not exists wallet_reset_at timestamptz,
  add column if not exists storage_limit_bytes bigint not null default 104857600;

alter table public.teaching_conversations
  add column if not exists recording_expires_at timestamptz;

alter table public.live_class_sessions
  add column if not exists voice_reserved_minutes integer not null default 0,
  add column if not exists voice_charged_minutes integer not null default 0,
  add column if not exists usage_charged_at timestamptz;

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('subscription_payment', 'topup_payment', 'monthly_grant', 'voice_charge', 'text_teaching_charge', 'storage_delete', 'recording_expiry')),
  payment_reference text,
  plan_id text,
  product_id text,
  units numeric,
  revenue_amount_ngn numeric(14,2) not null default 0,
  estimated_cost_usd numeric(14,6) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint billing_events_payment_reference_unique unique (payment_reference)
);

create index if not exists billing_events_created_at_idx on public.billing_events(created_at desc);
create index if not exists billing_events_user_type_idx on public.billing_events(user_id, event_type, created_at desc);

alter table public.billing_events enable row level security;
drop policy if exists "Users can read their own billing events" on public.billing_events;
create policy "Users can read their own billing events"
  on public.billing_events for select
  using (auth.uid() = user_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create or replace function public.get_user_teaching_storage_bytes(p_user_id uuid default auth.uid())
returns bigint
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or (p_user_id <> auth.uid() and not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')) then
    raise exception 'not_authorized';
  end if;
  return coalesce((select sum(size_bytes)::bigint from public.teaching_attachments where user_id = p_user_id), 0);
end;
$$;

revoke all on function public.get_user_teaching_storage_bytes(uuid) from public;
grant execute on function public.get_user_teaching_storage_bytes(uuid) to authenticated, service_role;

create or replace function public.consume_text_teaching_credit(p_idempotency_key text default null)
returns table (allowed boolean, remaining_credits integer, is_admin boolean, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_plan text;
  v_expires_at timestamptz;
  v_balance integer;
  v_existing integer;
  v_key text := coalesce(nullif(trim(p_idempotency_key), ''), gen_random_uuid()::text);
begin
  if v_user_id is null then
    return query select false, 0, false, 'not_authenticated';
    return;
  end if;

  select role, plan, plan_expires_at, text_teaching_balance
    into v_role, v_plan, v_expires_at, v_balance
  from public.profiles
  where id = v_user_id
  for update;

  if v_role = 'admin' then
    return query select true, null::integer, true, 'admin';
    return;
  end if;

  if v_plan not in ('premium_monthly', '3mo', '6mo', '9mo', '12mo') or (v_expires_at is not null and v_expires_at <= now()) then
    return query select false, coalesce(v_balance, 0), false, 'premium_required';
    return;
  end if;

  select count(*) into v_existing
  from public.billing_events
  where user_id = v_user_id and event_type = 'text_teaching_charge' and payment_reference = 'text:' || v_key;
  if v_existing > 0 then
    return query select true, v_balance, false, 'already_charged';
    return;
  end if;

  if coalesce(v_balance, 0) <= 0 then
    return query select false, 0, false, 'text_teaching_balance_empty';
    return;
  end if;

  update public.profiles
    set text_teaching_balance = text_teaching_balance - 1
  where id = v_user_id;

  insert into public.billing_events (user_id, event_type, payment_reference, units, metadata)
    values (v_user_id, 'text_teaching_charge', 'text:' || v_key, 1, jsonb_build_object('balance_before', v_balance));

  return query select true, v_balance - 1, false, 'charged';
end;
$$;

revoke all on function public.consume_text_teaching_credit(text) from public;
grant execute on function public.consume_text_teaching_credit(text) to authenticated;

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
  v_voice_balance integer := 0;
  v_session_id uuid;
  v_used integer := 0;
  v_month_start timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
  v_month_end timestamptz := (date_trunc('month', now() at time zone 'UTC') + interval '1 month') at time zone 'UTC';
  v_now timestamptz := now();
  v_active boolean;
  v_max_seconds integer;
begin
  if v_user_id is null then
    return query select false, 'not_authenticated', null::uuid, 0, 3, 600, null::timestamptz, false;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':live-class-wallet', 0));

  select role, plan, plan_expires_at, voice_minutes_balance
    into v_role, v_plan, v_plan_expires_at, v_voice_balance
  from public.profiles
  where id = v_user_id
  for update;

  select exists(
    select 1 from public.live_class_sessions
    where user_id = v_user_id and status = 'active'
  ) into v_active;
  if v_active then
    return query select false, 'active_session', null::uuid, null::integer, null::integer, null::integer, null::timestamptz, false;
    return;
  end if;

  if v_role = 'admin' then
    insert into public.live_class_sessions (user_id, conversation_id, room_name, course_name)
      values (v_user_id, p_conversation_id, p_room_name, coalesce(nullif(trim(p_course_name), ''), 'Live Class'))
      returning id into v_session_id;
    return query select true, 'admin', v_session_id, null::integer, null::integer, null::integer, null::timestamptz, true;
    return;
  end if;

  if v_plan in ('premium_monthly', '3mo', '6mo', '9mo', '12mo') and (v_plan_expires_at is null or v_plan_expires_at > v_now) then
    if coalesce(v_voice_balance, 0) <= 0 then
      return query select false, 'voice_balance_empty', null::uuid, null::integer, null::integer, 0, v_now, false;
      return;
    end if;
    v_max_seconds := v_voice_balance * 60;
    insert into public.live_class_sessions (user_id, conversation_id, room_name, course_name, voice_reserved_minutes)
      values (v_user_id, p_conversation_id, p_room_name, coalesce(nullif(trim(p_course_name), ''), 'Live Class'), v_voice_balance)
      returning id into v_session_id;
    return query select true, 'premium_wallet', v_session_id, null::integer, null::integer, v_max_seconds, v_now + make_interval(mins => v_max_seconds / 60), false;
    return;
  end if;

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

create or replace function public.charge_live_class_session(p_session_id uuid, p_duration_seconds integer default 0, p_end boolean default false)
returns table (ok boolean, remaining_voice_minutes integer, should_end boolean, charged_minutes integer, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_plan text;
  v_balance integer := 0;
  v_started timestamptz;
  v_status text;
  v_charged integer := 0;
  v_target integer := 0;
  v_delta integer := 0;
  v_remaining integer := 0;
  v_key text;
begin
  if v_user_id is null then
    return query select false, 0, true, 0, 'not_authenticated';
    return;
  end if;

  select s.user_id, s.started_at, s.status, s.voice_charged_minutes, p.role, p.plan, p.voice_minutes_balance
    into v_user_id, v_started, v_status, v_charged, v_role, v_plan, v_balance
  from public.live_class_sessions s
  join public.profiles p on p.id = s.user_id
  where s.id = p_session_id and s.user_id = auth.uid()
  for update of s;

  if not found then
    return query select false, 0, true, 0, 'session_not_found';
    return;
  end if;

  if v_role = 'admin' or v_plan not in ('premium_monthly', '3mo', '6mo', '9mo', '12mo') then
    if p_end then
      update public.live_class_sessions set status = 'ended', ended_at = coalesce(ended_at, now()), usage_charged_at = coalesce(usage_charged_at, now()) where id = p_session_id;
    end if;
    return query select true, null::integer, false, 0, 'unmetered';
    return;
  end if;

  v_target := greatest(0, ceil(greatest(extract(epoch from (now() - v_started)), greatest(p_duration_seconds, 0)) / 60.0)::integer);
  v_delta := greatest(0, v_target - coalesce(v_charged, 0));
  v_delta := least(v_delta, greatest(v_balance, 0));

  if v_delta > 0 then
    update public.profiles set voice_minutes_balance = voice_minutes_balance - v_delta where id = auth.uid();
    v_balance := v_balance - v_delta;
    v_charged := v_charged + v_delta;
    v_key := 'voice:' || p_session_id::text || ':' || v_charged::text;
    insert into public.billing_events (user_id, event_type, payment_reference, units, estimated_cost_usd, metadata)
      values (auth.uid(), 'voice_charge', v_key, v_delta, 0, jsonb_build_object('session_id', p_session_id, 'duration_seconds', p_duration_seconds));
  end if;

  update public.live_class_sessions
    set voice_charged_minutes = v_charged,
        usage_charged_at = case when p_end or v_balance <= 0 then coalesce(usage_charged_at, now()) else usage_charged_at end,
        status = case when p_end or v_balance <= 0 then 'ended' else status end,
        ended_at = case when p_end or v_balance <= 0 then coalesce(ended_at, now()) else ended_at end
  where id = p_session_id;

  v_remaining := greatest(0, v_balance);
  return query select true, v_remaining, (v_remaining <= 0), v_charged, case when v_remaining <= 0 then 'voice_balance_empty' else 'charged' end;
end;
$$;

revoke all on function public.charge_live_class_session(uuid, integer, boolean) from public;
grant execute on function public.charge_live_class_session(uuid, integer, boolean) to authenticated;

create or replace function public.reset_due_wallets()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_record record;
  v_next timestamptz;
begin
  for v_record in
    select id, wallet_reset_at
    from public.profiles
    where plan in ('premium_monthly', '3mo', '6mo', '9mo', '12mo')
      and (plan_expires_at is null or plan_expires_at > now())
      and wallet_reset_at is not null
      and wallet_reset_at <= now()
    for update
  loop
    v_next := v_record.wallet_reset_at + interval '1 month';
    update public.profiles
      set voice_minutes_balance = 60,
          text_teaching_balance = 50,
          wallet_reset_at = v_next
    where id = v_record.id;
    insert into public.billing_events (user_id, event_type, units, metadata)
      values (v_record.id, 'monthly_grant', 110, jsonb_build_object('voice_minutes', 60, 'text_teaching_credits', 50, 'rollover', false));
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.reset_due_wallets() from public;
grant execute on function public.reset_due_wallets() to service_role;

update public.profiles
set voice_minutes_balance = case when coalesce(voice_minutes_balance, 0) = 0 then 60 else voice_minutes_balance end,
    text_teaching_balance = case when coalesce(text_teaching_balance, 0) = 0 then 50 else text_teaching_balance end,
    wallet_reset_at = coalesce(wallet_reset_at, now() + interval '1 month')
where plan in ('premium_monthly', '3mo', '6mo', '9mo', '12mo')
  and (plan_expires_at is null or plan_expires_at > now());

commit;
