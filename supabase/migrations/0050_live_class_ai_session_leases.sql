-- 0050: session-scoped, atomic 128-turn leases; the voice loop never waits on a per-turn HTTP call.
-- Historical 0042-0049 migrations remain immutable. Apply this after 0049.
create or replace function public.reserve_live_class_ai_lease(
  p_user_id uuid, p_session_id uuid, p_request_id uuid, p_turns integer default 128
)
returns table (allowed boolean, reason text, reserved_microusd bigint)
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_started_at timestamptz;
  v_min timestamptz := date_trunc('minute', clock_timestamp());
  v_hour timestamptz := date_trunc('hour', clock_timestamp());
  v_day timestamptz := date_trunc('day', clock_timestamp());
  v_user_hour integer := 0; v_user_day integer := 0;
  v_global_hour integer := 0; v_global_day integer := 0;
  v_key text := 'user:' || p_user_id::text || ':voice:';
  v_estimate bigint;
begin
  if (select auth.role()) <> 'service_role' then
    return query select false, 'unauthorized'::text, 0::bigint; return;
  end if;
  if p_user_id is null or p_session_id is null or p_request_id is null or p_turns not between 1 and 128 then
    return query select false, 'invalid_lease'::text, 0::bigint; return;
  end if;
  select s.started_at into v_started_at from public.live_class_sessions s
  where s.id=p_session_id and s.user_id=p_user_id and s.status='active';
  if not found or v_started_at + interval '90 minutes' <= clock_timestamp() then
    return query select false, 'session_ended'::text, 0::bigint; return;
  end if;
  -- One global lock prevents simultaneous workers from overshooting the shared cap.
  perform pg_advisory_xact_lock(hashtextextended('live-class-lease:global', 0));
  perform pg_advisory_xact_lock(hashtextextended('live-class-lease:' || p_user_id::text, 0));
  if exists (select 1 from public.ai_spend_reservations r
    where r.request_id=p_request_id and r.user_id=p_user_id and r.feature='voice') then
    return query select true, 'already_reserved'::text, 0::bigint; return;
  end if;
  if exists (select 1 from public.ai_spend_reservations r where r.request_id=p_request_id) then
    return query select false, 'duplicate_request'::text, 0::bigint; return;
  end if;
  select coalesce(w.request_count,0) into v_user_hour from public.ai_request_windows w
    where w.window_start=v_hour and w.scope_key=v_key || 'hour';
  select coalesce(w.request_count,0) into v_user_day from public.ai_request_windows w
    where w.window_start=v_day and w.scope_key=v_key || 'day';
  select coalesce(w.request_count,0) into v_global_hour from public.ai_request_windows w
    where w.window_start=v_hour and w.scope_key='global:voice:hour';
  select coalesce(w.request_count,0) into v_global_day from public.ai_request_windows w
    where w.window_start=v_day and w.scope_key='global:voice:day';
  if coalesce(v_user_hour,0) + p_turns > 768 then
    return query select false, 'user_hour_limit'::text, 0::bigint; return;
  elsif coalesce(v_user_day,0) + p_turns > 3600 then
    return query select false, 'user_day_limit'::text, 0::bigint; return;
  elsif coalesce(v_global_hour,0) + p_turns > 4096 then
    return query select false, 'global_hour_limit'::text, 0::bigint; return;
  elsif coalesce(v_global_day,0) + p_turns > 18000 then
    return query select false, 'global_day_limit'::text, 0::bigint; return;
  end if;
  -- Minute windows count leases, not turns. Hour/day windows count reserved turns.
  insert into public.ai_request_windows(window_start,scope_key,request_count) values
    (v_min,v_key || 'leases:minute',1),
    (v_min,'global:voice:leases:minute',1),
    (v_hour,v_key || 'hour',p_turns), (v_day,v_key || 'day',p_turns),
    (v_hour,'global:voice:hour',p_turns),(v_day,'global:voice:day',p_turns)
  on conflict (window_start,scope_key)
  do update set request_count=public.ai_request_windows.request_count + excluded.request_count;
  -- Indicative usage, not a billable reservation in ai_spend_windows.
  -- Actual Groq and Gemini charges must be reconciled from provider usage.
  v_estimate := p_turns::bigint * 1500;
  insert into public.ai_spend_reservations(request_id,user_id,feature,reserved_microusd)
    values (p_request_id,p_user_id,'voice',v_estimate);
  return query select true, null::text, v_estimate;
end;
$$;
revoke all on function public.reserve_live_class_ai_lease(uuid,uuid,uuid,integer) from public, anon, authenticated;
grant execute on function public.reserve_live_class_ai_lease(uuid,uuid,uuid,integer) to service_role;
