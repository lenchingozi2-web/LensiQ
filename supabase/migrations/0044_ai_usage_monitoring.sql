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
