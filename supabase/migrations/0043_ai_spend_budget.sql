-- Atomic request-count and dollar-denominated reservation budget for paid AI calls.
-- Reservations are conservative upper-bound charges; do not refund on provider
-- timeout because the provider may have processed the request despite the timeout.
-- Apply in staging, validate RPC permissions/concurrency, then apply to production.

create table if not exists public.ai_spend_windows (
  window_start timestamptz not null,
  scope_key text not null,
  reserved_microusd bigint not null default 0 check (reserved_microusd >= 0),
  primary key (window_start, scope_key)
);

create table if not exists public.ai_spend_reservations (
  request_id uuid primary key,
  user_id uuid not null,
  feature text not null check (feature in ('teach', 'explain', 'voice')),
  reserved_microusd bigint not null check (reserved_microusd > 0),
  created_at timestamptz not null default now()
);

alter table public.ai_spend_windows enable row level security;
alter table public.ai_spend_reservations enable row level security;
revoke all on public.ai_spend_windows from public, anon, authenticated;
revoke all on public.ai_spend_reservations from public, anon, authenticated;
grant all on public.ai_spend_windows to service_role;
grant all on public.ai_spend_reservations to service_role;

-- Remove direct authenticated access to the earlier request-only RPC. Only the
-- trusted server-side service-role client may reserve shared global capacity.
revoke all on function public.reserve_ai_request(text) from public, anon, authenticated;
grant execute on function public.reserve_ai_request(text) to service_role;

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

  -- Global caps: $25/day and $500/month. Per-user fairness caps: $5/day, $100/month.
  if v_global_day_spend + v_cost > 25000000 then
    return query select false, 'global_daily_spend_limit'::text, 0::bigint; return;
  elsif v_global_month_spend + v_cost > 500000000 then
    return query select false, 'global_monthly_spend_limit'::text, 0::bigint; return;
  elsif v_user_day_spend + v_cost > 5000000 then
    return query select false, 'user_daily_spend_limit'::text, 0::bigint; return;
  elsif v_user_month_spend + v_cost > 100000000 then
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

-- Bounded cleanup is scheduled by the migration runner/admin; no client role can
-- read or mutate spend data. Retain reservations for 90 days for incident review.
delete from public.ai_spend_reservations where created_at < now() - interval '90 days';
delete from public.ai_spend_windows where window_start < now() - interval '90 days';
