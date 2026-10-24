-- Atomic per-user and global minute/hour/day budgets for paid AI provider calls.
-- Apply this migration before enabling AI routes.
create table if not exists public.ai_request_windows (
  window_start timestamptz not null,
  scope_key text not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (window_start, scope_key)
);

alter table public.ai_request_windows enable row level security;
revoke all on public.ai_request_windows from anon, authenticated;
grant all on public.ai_request_windows to service_role;

create or replace function public.reserve_ai_request(p_feature text)
returns table (allowed boolean, reason text, user_count integer, global_count integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_minute timestamptz := date_trunc('minute', now());
  v_hour timestamptz := date_trunc('hour', now());
  v_day timestamptz := date_trunc('day', now());
  v_user_min text;
  v_user_hour text;
  v_user_day text;
  v_global_min text := 'global:minute';
  v_global_hour text := 'global:hour';
  v_global_day text := 'global:day';
  v_user_min_count integer := 0;
  v_user_hour_count integer := 0;
  v_user_day_count integer := 0;
  v_global_min_count integer := 0;
  v_global_hour_count integer := 0;
  v_global_day_count integer := 0;
begin
  if v_user_id is null then
    return query select false, 'unauthenticated'::text, 0, 0;
    return;
  end if;

  if p_feature not in ('teach', 'explain') then
    return query select false, 'invalid_feature'::text, 0, 0;
    return;
  end if;

  v_user_min := 'user:' || v_user_id::text || ':' || p_feature || ':minute';
  v_user_hour := 'user:' || v_user_id::text || ':' || p_feature || ':hour';
  v_user_day := 'user:' || v_user_id::text || ':' || p_feature || ':day';

  -- Serialize reservations globally so parallel serverless requests cannot overshoot caps.
  perform pg_advisory_xact_lock(hashtextextended(v_global_day || ':' || v_day::text, 0));

  select request_count into v_global_min_count from public.ai_request_windows
    where window_start = v_minute and scope_key = v_global_min;
  select request_count into v_global_hour_count from public.ai_request_windows
    where window_start = v_hour and scope_key = v_global_hour;
  select request_count into v_global_day_count from public.ai_request_windows
    where window_start = v_day and scope_key = v_global_day;
  select request_count into v_user_min_count from public.ai_request_windows
    where window_start = v_minute and scope_key = v_user_min;
  select request_count into v_user_hour_count from public.ai_request_windows
    where window_start = v_hour and scope_key = v_user_hour;
  select request_count into v_user_day_count from public.ai_request_windows
    where window_start = v_day and scope_key = v_user_day;

  v_global_min_count := coalesce(v_global_min_count, 0);
  v_global_hour_count := coalesce(v_global_hour_count, 0);
  v_global_day_count := coalesce(v_global_day_count, 0);
  v_user_min_count := coalesce(v_user_min_count, 0);
  v_user_hour_count := coalesce(v_user_hour_count, 0);
  v_user_day_count := coalesce(v_user_day_count, 0);

  if v_global_min_count >= 30 then
    return query select false, 'global_minute_limit'::text, v_user_min_count, v_global_min_count;
    return;
  end if;
  if v_global_hour_count >= 120 then
    return query select false, 'global_hour_limit'::text, v_user_min_count, v_global_min_count;
    return;
  end if;
  if v_global_day_count >= 500 then
    return query select false, 'global_day_limit'::text, v_user_min_count, v_global_min_count;
    return;
  end if;
  if v_user_min_count >= 6 then
    return query select false, 'user_minute_limit'::text, v_user_min_count, v_global_min_count;
    return;
  end if;
  if v_user_hour_count >= 30 then
    return query select false, 'user_hour_limit'::text, v_user_min_count, v_global_min_count;
    return;
  end if;
  if v_user_day_count >= 100 then
    return query select false, 'user_day_limit'::text, v_user_min_count, v_global_min_count;
    return;
  end if;

  insert into public.ai_request_windows(window_start, scope_key, request_count) values
    (v_minute, v_global_min, 1), (v_hour, v_global_hour, 1), (v_day, v_global_day, 1),
    (v_minute, v_user_min, 1), (v_hour, v_user_hour, 1), (v_day, v_user_day, 1)
  on conflict (window_start, scope_key)
  do update set request_count = public.ai_request_windows.request_count + 1;

  return query select true, null::text, v_user_min_count + 1, v_global_min_count + 1;
end;
$$;

revoke all on function public.reserve_ai_request(text) from public, anon;
grant execute on function public.reserve_ai_request(text) to authenticated;

-- Old minute/hour/day buckets are harmless but periodically prune them.
delete from public.ai_request_windows where window_start < now() - interval '2 days';
