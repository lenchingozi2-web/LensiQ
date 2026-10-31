-- Bound paid Live Class sessions to 90 minutes using database time.
-- Free and Premium Study access remain denied; legacy free-trial sessions cannot continue.
begin;
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
  v_now timestamptz := clock_timestamp();
  v_reserved_minutes integer;
begin
  if v_user_id is null then
    return query select false, 'not_authenticated', null::uuid, 0, null::integer, 0, null::timestamptz, false;
    return;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':live-class-wallet', 0));
  select role, plan, plan_expires_at, voice_minutes_balance
    into v_role, v_plan, v_plan_expires_at, v_voice_balance
  from public.profiles where id = v_user_id for update;
  if not found then
    return query select false, 'profile_missing', null::uuid, 0, null::integer, 0, null::timestamptz, false;
    return;
  end if;
  if v_role = 'admin' then
    update public.live_class_sessions
      set status = 'ended', ended_at = coalesce(ended_at, v_now), usage_charged_at = coalesce(usage_charged_at, v_now)
      where user_id = v_user_id and status = 'active';
    insert into public.live_class_sessions (user_id, conversation_id, room_name, course_name)
      values (v_user_id, p_conversation_id, p_room_name, coalesce(nullif(trim(p_course_name), ''), 'Live Class'))
      returning id into v_session_id;
    return query select true, 'admin', v_session_id, null::integer, null::integer, 5400, v_now + interval '90 minutes', true;
    return;
  end if;
  if v_plan in ('premium_monthly', 'premium_3mo', 'premium_6mo', '3mo', '6mo', '9mo', '12mo')
     and (v_plan_expires_at is null or v_plan_expires_at > v_now) then
    if coalesce(v_voice_balance, 0) <= 0 then
      return query select false, 'voice_balance_empty', null::uuid, null::integer, null::integer, 0, v_now, false;
      return;
    end if;
    v_reserved_minutes := least(greatest(v_voice_balance, 0), 90);
    update public.live_class_sessions
      set status = 'ended', ended_at = coalesce(ended_at, v_now), usage_charged_at = coalesce(usage_charged_at, v_now)
      where user_id = v_user_id and status = 'active';
    insert into public.live_class_sessions (user_id, conversation_id, room_name, course_name, voice_reserved_minutes)
      values (v_user_id, p_conversation_id, p_room_name, coalesce(nullif(trim(p_course_name), ''), 'Live Class'), v_reserved_minutes)
      returning id into v_session_id;
    return query select true, 'premium_wallet', v_session_id, null::integer, null::integer,
      v_reserved_minutes * 60, v_now + make_interval(mins => v_reserved_minutes), false;
    return;
  end if;
  return query select false, 'premium_required', null::uuid, 0, 0, 0, v_now, false;
  return;
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
  v_started timestamptz;
  v_status text;
  v_is_free_trial boolean := false;
  v_charged integer := 0;
  v_target integer := 0;
  v_delta integer := 0;
  v_remaining integer := 0;
  v_elapsed integer := 0;
  v_limit_reached boolean := false;
  v_key text;
begin
  if v_user_id is null then
    return query select false, 0, true, 0, 'not_authenticated';
    return;
  end if;
  select s.user_id, s.started_at, s.status, s.is_free_trial, s.voice_charged_minutes,
         p.role, p.plan, p.plan_expires_at, p.voice_minutes_balance
    into v_user_id, v_started, v_status, v_is_free_trial, v_charged,
         v_role, v_plan, v_plan_expires_at, v_balance
  from public.live_class_sessions s
  join public.profiles p on p.id = s.user_id
  where s.id = p_session_id and s.user_id = auth.uid()
  for update of s;
  if not found then
    return query select false, 0, true, 0, 'session_not_found';
    return;
  end if;
  if v_status <> 'active' then
    return query select true, greatest(v_balance, 0), true, coalesce(v_charged, 0), 'session_ended';
    return;
  end if;

  v_elapsed := greatest(0, least(5400, floor(extract(epoch from (clock_timestamp() - v_started))::integer)));
  v_target := least(90, greatest(0, ceil(greatest(v_elapsed, least(greatest(coalesce(p_duration_seconds, 0), 0), 5400)) / 60.0)::integer));
  v_limit_reached := clock_timestamp() >= v_started + interval '90 minutes';

  -- Older free/trial sessions are closed instead of grandfathered into access.
  if v_is_free_trial then
    update public.live_class_sessions
      set status = 'ended', ended_at = coalesce(ended_at, clock_timestamp()),
          usage_charged_at = coalesce(usage_charged_at, clock_timestamp())
      where id = p_session_id;
    return query select true, 0, true, coalesce(v_charged, 0), 'premium_required';
    return;
  end if;
  if v_role <> 'admin' and (
      coalesce(v_plan, 'free') not in ('premium_monthly', 'premium_3mo', 'premium_6mo', '3mo', '6mo', '9mo', '12mo')
      or (v_plan_expires_at is not null and v_plan_expires_at <= clock_timestamp())
  ) then
    update public.live_class_sessions
      set status = 'ended', ended_at = coalesce(ended_at, clock_timestamp()),
          usage_charged_at = coalesce(usage_charged_at, clock_timestamp())
      where id = p_session_id;
    return query select true, 0, true, coalesce(v_charged, 0), 'premium_required';
    return;
  end if;
  if v_role = 'admin' then
    update public.live_class_sessions
      set voice_charged_minutes = v_target,
          usage_charged_at = case when p_end or v_limit_reached then coalesce(usage_charged_at, clock_timestamp()) else usage_charged_at end,
          status = case when p_end or v_limit_reached then 'ended' else status end,
          ended_at = case when p_end or v_limit_reached then coalesce(ended_at, clock_timestamp()) else ended_at end
      where id = p_session_id;
    return query select true, null::integer, (p_end or v_limit_reached), v_target,
      case when v_limit_reached then 'session_time_limit' else 'admin_unmetered' end;
    return;
  end if;

  v_delta := least(greatest(0, v_target - coalesce(v_charged, 0)), greatest(v_balance, 0));
  if v_delta > 0 then
    update public.profiles set voice_minutes_balance = greatest(0, voice_minutes_balance - v_delta) where id = auth.uid();
    v_balance := greatest(0, v_balance - v_delta);
    v_charged := coalesce(v_charged, 0) + v_delta;
    v_key := 'voice:' || p_session_id::text || ':' || v_charged::text;
    insert into public.billing_events (user_id, event_type, payment_reference, units, metadata)
      values (auth.uid(), 'voice_charge', v_key, v_delta,
        jsonb_build_object('session_id', p_session_id, 'duration_seconds', least(v_elapsed, 5400), 'server_time_capped', true));
  end if;
  update public.live_class_sessions
    set voice_charged_minutes = v_charged,
        usage_charged_at = case when p_end or v_balance <= 0 or v_limit_reached then coalesce(usage_charged_at, clock_timestamp()) else usage_charged_at end,
        status = case when p_end or v_balance <= 0 or v_limit_reached then 'ended' else status end,
        ended_at = case when p_end or v_balance <= 0 or v_limit_reached then coalesce(ended_at, clock_timestamp()) else ended_at end
    where id = p_session_id;
  v_remaining := greatest(v_balance, 0);
  return query select true, v_remaining, (p_end or v_remaining <= 0 or v_limit_reached), v_charged,
    case when v_limit_reached then 'session_time_limit' when v_remaining <= 0 then 'voice_balance_empty' else 'charged' end;
end;
$$;
revoke all on function public.charge_live_class_session(uuid, integer, boolean) from public;
grant execute on function public.charge_live_class_session(uuid, integer, boolean) to authenticated;
commit;
