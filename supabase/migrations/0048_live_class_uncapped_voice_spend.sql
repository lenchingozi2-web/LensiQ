-- Live Class voice requests do not consume the shared dollar-denominated AI caps.
-- Request-rate limits, service-role access, duplicate protection, event logging,
-- and the central admin-controlled global emergency pause remain in force.
create or replace function public.reserve_live_class_ai_request(
  p_user_id uuid,
  p_request_id uuid
)
returns table (allowed boolean, reason text, reserved_microusd bigint)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_minute timestamptz := date_trunc('minute', clock_timestamp());
  v_hour timestamptz := date_trunc('hour', clock_timestamp());
  v_day timestamptz := date_trunc('day', clock_timestamp());
  v_user_min text := 'user:' || p_user_id::text || ':voice:minute';
  v_user_hour text := 'user:' || p_user_id::text || ':voice:hour';
  v_user_day text := 'user:' || p_user_id::text || ':voice:day';
  v_global_min text := 'global:voice:minute';
  v_global_hour text := 'global:voice:hour';
  v_global_day text := 'global:voice:day';
  v_user_min_count integer := 0;
  v_user_hour_count integer := 0;
  v_user_day_count integer := 0;
  v_global_min_count integer := 0;
  v_global_hour_count integer := 0;
  v_global_day_count integer := 0;
  v_estimated_cost bigint := 20000;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    return query select false, 'unauthorized'::text, 0::bigint;
    return;
  end if;
  if p_user_id is null or p_request_id is null then
    return query select false, 'invalid_request'::text, 0::bigint;
    return;
  end if;

  -- Serialize aggregate and per-user voice-rate reservations.
  perform pg_advisory_xact_lock(hashtextextended('live-class-voice:global', 0));
  perform pg_advisory_xact_lock(hashtextextended('live-class-voice:' || p_user_id::text, 0));
  if exists (select 1 from public.ai_spend_reservations r where r.request_id = p_request_id) then
    return query select false, 'duplicate_request'::text, 0::bigint;
    return;
  end if;

  select coalesce(request_count, 0) into v_global_min_count
    from public.ai_request_windows where window_start = v_minute and scope_key = v_global_min;
  select coalesce(request_count, 0) into v_global_hour_count
    from public.ai_request_windows where window_start = v_hour and scope_key = v_global_hour;
  select coalesce(request_count, 0) into v_global_day_count
    from public.ai_request_windows where window_start = v_day and scope_key = v_global_day;
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

  if v_global_min_count >= 100 then
    return query select false, 'global_minute_limit'::text, 0::bigint; return;
  elsif v_global_hour_count >= 600 then
    return query select false, 'global_hour_limit'::text, 0::bigint; return;
  elsif v_global_day_count >= 5000 then
    return query select false, 'global_day_limit'::text, 0::bigint; return;
  elsif v_user_min_count >= 30 then
    return query select false, 'user_minute_limit'::text, 0::bigint; return;
  elsif v_user_hour_count >= 120 then
    return query select false, 'user_hour_limit'::text, 0::bigint; return;
  elsif v_user_day_count >= 1000 then
    return query select false, 'user_day_limit'::text, 0::bigint; return;
  end if;

  insert into public.ai_request_windows(window_start, scope_key, request_count) values
    (v_minute, v_global_min, 1), (v_hour, v_global_hour, 1), (v_day, v_global_day, 1),
    (v_minute, v_user_min, 1), (v_hour, v_user_hour, 1), (v_day, v_user_day, 1)
  on conflict (window_start, scope_key)
  do update set request_count = public.ai_request_windows.request_count + 1;

  -- Keep idempotency and a per-turn estimate for monitoring, but do not write
  -- this to ai_spend_windows; voice is exempt from all dollar caps.
  insert into public.ai_spend_reservations(request_id, user_id, feature, reserved_microusd)
    values (p_request_id, p_user_id, 'voice', v_estimated_cost);
  return query select true, null::text, v_estimated_cost;
end;
$$;
revoke all on function public.reserve_live_class_ai_request(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reserve_live_class_ai_request(uuid, uuid) to service_role;
