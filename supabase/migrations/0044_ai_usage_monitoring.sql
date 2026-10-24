-- AI spend monitoring, alert history, and central fail-closed kill switch.
-- Apply after 0043_ai_spend_budget.sql. Default remains paused.
create table if not exists public.ai_runtime_controls (
  id smallint primary key check (id = 1),
  is_paused boolean not null default true,
  pause_reason text not null default 'Emergency pause: awaiting budget and provider verification',
  global_daily_limit_microusd bigint not null default 1000000 check (global_daily_limit_microusd > 0),
  global_monthly_limit_microusd bigint not null default 10000000 check (global_monthly_limit_microusd > 0),
  user_daily_limit_microusd bigint not null default 250000 check (user_daily_limit_microusd > 0),
  user_monthly_limit_microusd bigint not null default 2000000 check (user_monthly_limit_microusd > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into public.ai_runtime_controls(id) values (1) on conflict (id) do nothing;

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid,
  user_id uuid,
  feature text not null check (feature in ('teach', 'explain', 'voice')),
  provider text,
  model text,
  status text not null check (status in ('reserved', 'succeeded', 'failed', 'denied')),
  input_tokens integer,
  output_tokens integer,
  estimated_cost_microusd bigint not null default 0,
  actual_cost_microusd bigint,
  error_code text,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_events_created_at_idx on public.ai_usage_events(created_at desc);
create index if not exists ai_usage_events_feature_idx on public.ai_usage_events(feature, created_at desc);

create table if not exists public.ai_budget_alerts (
  alert_key text primary key,
  level text not null check (level in ('warning', 'critical')),
  metric text not null,
  observed_microusd bigint not null,
  threshold_microusd bigint not null,
  active boolean not null default true,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.ai_runtime_controls enable row level security;
alter table public.ai_usage_events enable row level security;
alter table public.ai_budget_alerts enable row level security;
revoke all on public.ai_runtime_controls from public, anon, authenticated;
revoke all on public.ai_usage_events from public, anon, authenticated;
revoke all on public.ai_budget_alerts from public, anon, authenticated;
grant all on public.ai_runtime_controls to service_role;
grant all on public.ai_usage_events to service_role;
grant all on public.ai_budget_alerts to service_role;


-- Serialize control changes against budget reservations so an emergency stop
-- waits for any in-progress reservation and blocks subsequent reservations.
create or replace function public.set_ai_runtime_pause(
  p_is_paused boolean,
  p_pause_reason text,
  p_updated_by uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    return false;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('ai-budget-control-global', 0));
  update public.ai_runtime_controls
    set is_paused = coalesce(p_is_paused, true),
        pause_reason = left(coalesce(p_pause_reason, ''), 200),
        updated_by = p_updated_by,
        updated_at = clock_timestamp()
    where id = 1;
  return found;
end;
$$;

create or replace function public.set_ai_budget_limits(
  p_global_daily_limit_microusd bigint,
  p_global_monthly_limit_microusd bigint,
  p_user_daily_limit_microusd bigint,
  p_user_monthly_limit_microusd bigint,
  p_updated_by uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    return false;
  end if;
  if p_global_daily_limit_microusd < 100000 or p_global_daily_limit_microusd > 25000000
    or p_global_monthly_limit_microusd < 1000000 or p_global_monthly_limit_microusd > 500000000
    or p_user_daily_limit_microusd < 50000 or p_user_daily_limit_microusd > 5000000
    or p_user_monthly_limit_microusd < 250000 or p_user_monthly_limit_microusd > 100000000
    or p_global_daily_limit_microusd > p_global_monthly_limit_microusd
    or p_user_daily_limit_microusd > p_global_daily_limit_microusd
    or p_user_monthly_limit_microusd > p_global_monthly_limit_microusd
    or p_user_daily_limit_microusd > p_user_monthly_limit_microusd then
    return false;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('ai-budget-control-global', 0));
  update public.ai_runtime_controls
    set global_daily_limit_microusd = p_global_daily_limit_microusd,
        global_monthly_limit_microusd = p_global_monthly_limit_microusd,
        user_daily_limit_microusd = p_user_daily_limit_microusd,
        user_monthly_limit_microusd = p_user_monthly_limit_microusd,
        updated_by = p_updated_by,
        updated_at = clock_timestamp()
    where id = 1;
  return found;
end;
$$;

revoke all on function public.set_ai_runtime_pause(boolean, text, uuid) from public, anon, authenticated;
revoke all on function public.set_ai_budget_limits(bigint, bigint, bigint, bigint, uuid) from public, anon, authenticated;
grant execute on function public.set_ai_runtime_pause(boolean, text, uuid) to service_role;
grant execute on function public.set_ai_budget_limits(bigint, bigint, bigint, bigint, uuid) to service_role;


-- Re-apply the guarded budget RPC here so existing installations that already
-- applied migration 0043 also receive the new kill-switch and configurable caps.
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
  v_is_paused boolean := true;
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

  -- Serialize with admin control changes; emergency pause waits for an
  -- in-progress reservation and prevents later reservations after it commits.
  perform pg_advisory_xact_lock(hashtextextended('ai-budget-control-global', 0));

  -- Central pause and caps are read from a service-role-only singleton.
  -- Missing control state fails closed.
  select is_paused, global_daily_limit_microusd, global_monthly_limit_microusd,
         user_daily_limit_microusd, user_monthly_limit_microusd
    into v_is_paused, v_global_daily_cap, v_global_monthly_cap,
         v_user_daily_cap, v_user_monthly_cap
    from public.ai_runtime_controls where id = 1;

  if not found or coalesce(v_is_paused, true) then
    return query select false, 'ai_globally_paused'::text, 0::bigint;
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

  select coalesce(reserved_microusd, 0) into v_global_day_spend
    from public.ai_spend_windows where window_start = v_day and scope_key = 'global:day';
  select coalesce(reserved_microusd, 0) into v_global_month_spend
    from public.ai_spend_windows where window_start = v_month and scope_key = 'global:month';
  select coalesce(reserved_microusd, 0) into v_user_day_spend
    from public.ai_spend_windows where window_start = v_day and scope_key = 'user:' || p_user_id::text || ':day';
  select coalesce(reserved_microusd, 0) into v_user_month_spend
    from public.ai_spend_windows where window_start = v_month and scope_key = 'user:' || p_user_id::text || ':month';

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
