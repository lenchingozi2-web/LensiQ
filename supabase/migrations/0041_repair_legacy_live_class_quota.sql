-- Repair deployments that still expose the legacy one-time Live Class trial RPC.
begin;
alter table public.profiles
  add column if not exists free_live_class_minutes_balance integer not null default 30;
alter table public.profiles
  add column if not exists free_live_class_reset_at timestamptz;
comment on column public.profiles.free_live_class_minutes_balance is
  'Remaining free Live Class minutes in the current monthly cycle.';
comment on column public.profiles.free_live_class_reset_at is
  'When the free Live Class minute allowance refreshes.';
update public.profiles
set free_live_class_minutes_balance = 30,
    free_live_class_reset_at = now() + interval '1 month'
where role <> 'admin'
  and (plan is null
    or plan not in ('premium_monthly', 'premium_3mo', 'premium_6mo', '3mo', '6mo', '9mo', '12mo')
    or plan_expires_at <= now());

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
  v_free_balance integer := 30;
  v_free_reset_at timestamptz;
  v_session_id uuid;
  v_now timestamptz := now();
  v_max_seconds integer;
begin
  if v_user_id is null then
    return query select false, 'not_authenticated', null::uuid, 0, null::integer, 0, null::timestamptz, false;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':live-class-wallet', 0));

  select role, plan, plan_expires_at, voice_minutes_balance, free_live_class_minutes_balance, free_live_class_reset_at
    into v_role, v_plan, v_plan_expires_at, v_voice_balance, v_free_balance, v_free_reset_at
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    return query select false, 'profile_missing', null::uuid, 0, null::integer, 0, null::timestamptz, false;
    return;
  end if;

  if v_role = 'admin' then
    update public.live_class_sessions
      set status = 'ended', ended_at = coalesce(ended_at, v_now)
      where user_id = v_user_id and status = 'active';

    insert into public.live_class_sessions (user_id, conversation_id, room_name, course_name)
      values (v_user_id, p_conversation_id, p_room_name, coalesce(nullif(trim(p_course_name), ''), 'Live Class'))
      returning id into v_session_id;
    return query select true, 'admin', v_session_id, null::integer, null::integer, null::integer, null::timestamptz, true;
    return;
  end if;

  if v_plan in ('premium_monthly', 'premium_3mo', 'premium_6mo', '3mo', '6mo', '9mo', '12mo')
     and (v_plan_expires_at is null or v_plan_expires_at > v_now) then
    if coalesce(v_voice_balance, 0) <= 0 then
      return query select false, 'voice_balance_empty', null::uuid, null::integer, null::integer, 0, v_now, false;
      return;
    end if;

    v_max_seconds := v_voice_balance * 60;
    update public.live_class_sessions
      set status = 'ended', ended_at = coalesce(ended_at, v_now)
      where user_id = v_user_id and status = 'active';

    insert into public.live_class_sessions (user_id, conversation_id, room_name, course_name, voice_reserved_minutes)
      values (v_user_id, p_conversation_id, p_room_name, coalesce(nullif(trim(p_course_name), ''), 'Live Class'), v_voice_balance)
      returning id into v_session_id;
    return query select true, 'premium_wallet', v_session_id, null::integer, null::integer, v_max_seconds, v_now + make_interval(mins => v_voice_balance), false;
    return;
  end if;

  if v_free_reset_at is null or v_free_reset_at <= v_now then
    v_free_balance := 30;
    v_free_reset_at := v_now + interval '1 month';
    update public.profiles
      set free_live_class_minutes_balance = 30,
          free_live_class_reset_at = v_free_reset_at
      where id = v_user_id;
  end if;
  v_free_balance := greatest(0, coalesce(v_free_balance, 0));
  if v_free_balance <= 0 then
    return query select false, 'free_monthly_exhausted', null::uuid, 1, 1, 0, v_free_reset_at, false;
    return;
  end if;
  update public.live_class_sessions
    set status = 'ended', ended_at = coalesce(ended_at, v_now)
    where user_id = v_user_id and status = 'active';
  insert into public.live_class_sessions (user_id, conversation_id, room_name, course_name, is_free_trial, voice_reserved_minutes)
    values (v_user_id, p_conversation_id, p_room_name, coalesce(nullif(trim(p_course_name), ''), 'Live Class'), true, v_free_balance)
    returning id into v_session_id;
  return query select true, 'free_monthly', v_session_id, 1, 1, v_free_balance * 60, v_now + make_interval(mins => v_free_balance), false;
end;
$$;
revoke all on function public.reserve_live_class_session(text, text, uuid) from public;
grant execute on function public.reserve_live_class_session(text, text, uuid) to authenticated;

create or replace function public.charge_live_class_session(
  p_session_id uuid,
  p_duration_seconds integer default 0,
  p_end boolean default false
)
returns table (ok boolean, remaining_voice_minutes integer, should_end boolean, charged_minutes integer, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_plan text;
  v_plan_expires_at timestamptz;
  v_balance integer := 0;
  v_free_balance integer := 0;
  v_started timestamptz;
  v_status text;
  v_is_free_trial boolean := false;
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

  select s.user_id, s.started_at, s.status, s.is_free_trial, s.voice_charged_minutes,
         p.role, p.plan, p.plan_expires_at, p.voice_minutes_balance, p.free_live_class_minutes_balance
    into v_user_id, v_started, v_status, v_is_free_trial, v_charged,
         v_role, v_plan, v_plan_expires_at, v_balance, v_free_balance
  from public.live_class_sessions s
  join public.profiles p on p.id = s.user_id
  where s.id = p_session_id and s.user_id = auth.uid()
  for update of s;

  if not found then
    return query select false, 0, true, 0, 'session_not_found';
    return;
  end if;

  v_target := greatest(0, ceil(greatest(extract(epoch from (now() - v_started)), greatest(p_duration_seconds, 0)) / 60.0)::integer);

  if v_role = 'admin' then
    v_delta := greatest(0, v_target - coalesce(v_charged, 0));
    if v_delta > 0 then
      v_key := 'admin_voice:' || p_session_id::text || ':' || v_target::text;
      insert into public.billing_events (user_id, event_type, payment_reference, units, metadata)
        values (auth.uid(), 'voice_charge', v_key, v_delta, jsonb_build_object('admin_usage', true, 'session_id', p_session_id));
      v_charged := v_target;
    end if;
    update public.live_class_sessions
      set voice_charged_minutes = v_charged,
          usage_charged_at = case when p_end then coalesce(usage_charged_at, now()) else usage_charged_at end,
          status = case when p_end then 'ended' else status end,
          ended_at = case when p_end then coalesce(ended_at, now()) else ended_at end
      where id = p_session_id;
    return query select true, null::integer, false, v_charged, 'admin_unmetered';
    return;
  end if;

  if v_is_free_trial then
    v_target := least(30, v_target);
    v_delta := least(greatest(0, v_target - coalesce(v_charged, 0)), greatest(v_free_balance, 0));
    if v_delta > 0 then
      update public.profiles
        set free_live_class_minutes_balance = greatest(0, coalesce(free_live_class_minutes_balance, 0) - v_delta)
        where id = auth.uid();
      v_free_balance := greatest(0, v_free_balance - v_delta);
      v_charged := v_charged + v_delta;
      insert into public.billing_events (user_id, event_type, payment_reference, units, metadata)
        values (auth.uid(), 'voice_charge', 'free_voice:' || p_session_id::text || ':' || v_charged::text, v_delta,
          jsonb_build_object('free_monthly_usage', true, 'session_id', p_session_id, 'duration_seconds', p_duration_seconds));
    end if;
    update public.live_class_sessions
      set voice_charged_minutes = v_charged,
          usage_charged_at = case when p_end or v_free_balance <= 0 then coalesce(usage_charged_at, now()) else usage_charged_at end,
          status = case when p_end or v_free_balance <= 0 then 'ended' else status end,
          ended_at = case when p_end or v_free_balance <= 0 then coalesce(ended_at, now()) else ended_at end
      where id = p_session_id;
    return query select true, v_free_balance, (p_end or v_free_balance <= 0), v_charged,
      case when p_end or v_free_balance <= 0 then 'free_monthly_exhausted' else 'free_monthly' end;
    return;
  end if;

  if coalesce(v_plan, 'free') not in ('premium_monthly', 'premium_3mo', 'premium_6mo', '3mo', '6mo', '9mo', '12mo')
     or (v_plan_expires_at is not null and v_plan_expires_at <= now()) then
    update public.live_class_sessions
      set status = 'ended', ended_at = coalesce(ended_at, now()), usage_charged_at = coalesce(usage_charged_at, now())
      where id = p_session_id;
    return query select true, 0, true, coalesce(v_charged, 0), 'premium_required';
    return;
  end if;

  v_delta := greatest(0, v_target - coalesce(v_charged, 0));
  v_delta := least(v_delta, greatest(v_balance, 0));
  if v_delta > 0 then
    update public.profiles set voice_minutes_balance = voice_minutes_balance - v_delta where id = auth.uid();
    v_balance := v_balance - v_delta;
    v_charged := v_charged + v_delta;
    v_key := 'voice:' || p_session_id::text || ':' || v_charged::text;
    insert into public.billing_events (user_id, event_type, payment_reference, units, metadata)
      values (auth.uid(), 'voice_charge', v_key, v_delta, jsonb_build_object('session_id', p_session_id, 'duration_seconds', p_duration_seconds));
  end if;

  update public.live_class_sessions
    set voice_charged_minutes = v_charged,
        usage_charged_at = case when p_end or v_balance <= 0 then coalesce(usage_charged_at, now()) else usage_charged_at end,
        status = case when p_end or v_balance <= 0 then 'ended' else status end,
        ended_at = case when p_end or v_balance <= 0 then coalesce(ended_at, now()) else ended_at end
    where id = p_session_id;

  v_remaining := greatest(0, v_balance);
  return query select true, v_remaining, (v_remaining <= 0), v_charged,
    case when v_remaining <= 0 then 'voice_balance_empty' else 'charged' end;
end;
$$;
revoke all on function public.charge_live_class_session(uuid, integer, boolean) from public;
grant execute on function public.charge_live_class_session(uuid, integer, boolean) to authenticated;
revoke all on function public.charge_live_class_session(uuid, integer, boolean) from public;
grant execute on function public.charge_live_class_session(uuid, integer, boolean) to authenticated;
commit;
