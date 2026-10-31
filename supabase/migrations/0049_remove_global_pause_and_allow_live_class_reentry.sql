-- Remove the system-wide AI pause while retaining hard spend/rate budgets.
-- Reassert reservation semantics so a 90-minute room close never locks the user out.
begin;

create or replace function public.reserve_ai_budget(
  p_user_id uuid,
  p_feature text,
  p_request_id uuid
)
returns table (allowed boolean, reason text, reserved_microusd bigint)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_minute timestamptz := date_trunc('minute', clock_timestamp());
  v_hour timestamptz := date_trunc('hour', clock_timestamp());
  v_day timestamptz := date_trunc('day', clock_timestamp());
  v_month timestamptz := date_trunc('month', clock_timestamp());
  v_cost bigint;
  v_user_min text;
  v_user_hour text;
  v_user_day text;
  v_user_min_count integer := 0;
  v_user_hour_count integer := 0;
  v_user_day_count integer := 0;
  v_global_min_count integer := 0;
  v_global_hour_count integer := 0;
  v_global_day_count integer := 0;
  v_global_day_spend bigint := 0;
  v_global_month_spend bigint := 0;
  v_user_day_spend bigint := 0;
  v_user_month_spend bigint := 0;
  v_global_daily_cap bigint := 1000000;
  v_global_monthly_cap bigint := 10000000;
  v_user_daily_cap bigint := 250000;
  v_user_monthly_cap bigint := 2000000;
begin
  -- Explicitly restrict the privileged function to the trusted server client.
  if coalesce(auth.role(), '') <> 'service_role' then
    return query select false, 'unauthorized'::text, 0::bigint;
    return;
  end if;

  if p_user_id is null or p_request_id is null or p_feature is null or p_feature not in ('teach', 'explain', 'voice') then
    return query select false, 'invalid_request'::text, 0::bigint;
    return;
  end if;

  -- Serialize budget-limit changes against this reservation.
  perform pg_advisory_xact_lock(hashtextextended('ai-budget-control-global', 0));

  -- Read only the active hard caps; there is no global pause switch.
  select global_daily_limit_microusd, global_monthly_limit_microusd,
         user_daily_limit_microusd, user_monthly_limit_microusd
    into v_global_daily_cap, v_global_monthly_cap,
         v_user_daily_cap, v_user_monthly_cap
    from public.ai_runtime_controls where id = 1;

  if not found then
    return query select false, 'budget_unavailable'::text, 0::bigint;
    return;
  end if;

  -- Conservative maximum reservation per request, in micro-USD.
  v_cost := case p_feature when 'teach' then 100000 when 'explain' then 50000 else 20000 end;
  v_user_min := 'user:' || p_user_id::text || ':' || p_feature || ':minute';
  v_user_hour := 'user:' || p_user_id::text || ':' || p_feature || ':hour';
  v_user_day := 'user:' || p_user_id::text || ':' || p_feature || ':day';

  -- Serialize all reservations against the shared global and monthly caps.
  perform pg_advisory_xact_lock(hashtextextended('ai-budget-global-day:' || v_day::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('ai-budget-global-month:' || v_month::text, 0));

  if exists (select 1 from public.ai_spend_reservations r where r.request_id = p_request_id) then
    return query select false, 'duplicate_request'::text, 0::bigint;
    return;
  end if;

  select coalesce(request_count, 0) into v_global_min_count
    from public.ai_request_windows where window_start = v_minute and scope_key = 'global:minute';
  select coalesce(request_count, 0) into v_global_hour_count
    from public.ai_request_windows where window_start = v_hour and scope_key = 'global:hour';
  select coalesce(request_count, 0) into v_global_day_count
    from public.ai_request_windows where window_start = v_day and scope_key = 'global:day';
  select coalesce(request_count, 0) into v_user_min_count
    from public.ai_request_windows where window_start = v_minute and scope_key = v_user_min;
  select coalesce(request_count, 0) into v_user_hour_count
    from public.ai_request_windows where window_start = v_hour and scope_key = v_user_hour;
  select coalesce(request_count, 0) into v_user_day_count
    from public.ai_request_windows where window_start = v_day and scope_key = v_user_day;

  v_global_min_count := coalesce(v_global_min_count, 0);
  v_global_hour_count := coalesce(v_global_hour_count, 0);
  v_global_day_count := coalesce(v_global_day_count, 0);
  v_user_min_count := coalesce(v_user_min_count, 0);
  v_user_hour_count := coalesce(v_user_hour_count, 0);
  v_user_day_count := coalesce(v_user_day_count, 0);

  if (p_feature <> 'voice' and v_global_min_count >= 30) or (p_feature = 'voice' and v_global_min_count >= 100) then
    return query select false, 'global_minute_limit'::text, 0::bigint; return;
  elsif (p_feature <> 'voice' and v_global_hour_count >= 120) or (p_feature = 'voice' and v_global_hour_count >= 600) then
    return query select false, 'global_hour_limit'::text, 0::bigint; return;
  elsif (p_feature <> 'voice' and v_global_day_count >= 500) or (p_feature = 'voice' and v_global_day_count >= 5000) then
    return query select false, 'global_day_limit'::text, 0::bigint; return;
  elsif (p_feature <> 'voice' and v_user_min_count >= 6) or (p_feature = 'voice' and v_user_min_count >= 30) then
    return query select false, 'user_minute_limit'::text, 0::bigint; return;
  elsif (p_feature <> 'voice' and v_user_hour_count >= 30) or (p_feature = 'voice' and v_user_hour_count >= 120) then
    return query select false, 'user_hour_limit'::text, 0::bigint; return;
  elsif (p_feature <> 'voice' and v_user_day_count >= 100) or (p_feature = 'voice' and v_user_day_count >= 1000) then
    return query select false, 'user_day_limit'::text, 0::bigint; return;
  end if;

  select coalesce(w.reserved_microusd, 0) into v_global_day_spend
    from public.ai_spend_windows as w where w.window_start = v_day and w.scope_key = 'global:day';
  select coalesce(w.reserved_microusd, 0) into v_global_month_spend
    from public.ai_spend_windows as w where w.window_start = v_month and w.scope_key = 'global:month';
  select coalesce(w.reserved_microusd, 0) into v_user_day_spend
    from public.ai_spend_windows as w where w.window_start = v_day and w.scope_key = 'user:' || p_user_id::text || ':day';
  select coalesce(w.reserved_microusd, 0) into v_user_month_spend
    from public.ai_spend_windows as w where w.window_start = v_month and w.scope_key = 'user:' || p_user_id::text || ':month';

  v_global_day_spend := coalesce(v_global_day_spend, 0);
  v_global_month_spend := coalesce(v_global_month_spend, 0);
  v_user_day_spend := coalesce(v_user_day_spend, 0);
  v_user_month_spend := coalesce(v_user_month_spend, 0);

  -- Default caps: $1/day and $10/month globally; $0.25/day and $2/month per user.
  if v_global_day_spend + v_cost > v_global_daily_cap then
    return query select false, 'global_daily_spend_limit'::text, 0::bigint; return;
  elsif v_global_month_spend + v_cost > v_global_monthly_cap then
    return query select false, 'global_monthly_spend_limit'::text, 0::bigint; return;
  elsif v_user_day_spend + v_cost > v_user_daily_cap then
    return query select false, 'user_daily_spend_limit'::text, 0::bigint; return;
  elsif v_user_month_spend + v_cost > v_user_monthly_cap then
    return query select false, 'user_monthly_spend_limit'::text, 0::bigint; return;
  end if;

  insert into public.ai_request_windows(window_start, scope_key, request_count) values
    (v_minute, 'global:minute', 1), (v_hour, 'global:hour', 1), (v_day, 'global:day', 1),
    (v_minute, v_user_min, 1), (v_hour, v_user_hour, 1), (v_day, v_user_day, 1)
  on conflict (window_start, scope_key)
  do update set request_count = public.ai_request_windows.request_count + 1;

  insert into public.ai_spend_windows(window_start, scope_key, reserved_microusd) values
    (v_day, 'global:day', v_cost),
    (v_month, 'global:month', v_cost),
    (v_day, 'user:' || p_user_id::text || ':day', v_cost),
    (v_month, 'user:' || p_user_id::text || ':month', v_cost)
  on conflict (window_start, scope_key)
  do update set reserved_microusd = public.ai_spend_windows.reserved_microusd + excluded.reserved_microusd;

  insert into public.ai_spend_reservations(request_id, user_id, feature, reserved_microusd)
  values (p_request_id, p_user_id, p_feature, v_cost);

  return query select true, null::text, v_cost;
end;
$$;


revoke all on function public.reserve_ai_budget(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.reserve_ai_budget(uuid, text, uuid) to service_role;

-- A new session ends any stale prior active row for this user, then reserves
-- a fresh session id and lease. Entitlements and remaining voice minutes remain enforced.
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

drop function if exists public.set_ai_runtime_pause(boolean, text, uuid);
alter table public.ai_runtime_controls drop column if exists is_paused;
alter table public.ai_runtime_controls drop column if exists pause_reason;

commit;
