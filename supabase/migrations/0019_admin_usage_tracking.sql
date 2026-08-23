begin;

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
  if v_user_id is null then return query select false, 0, false, 'not_authenticated'; return; end if;
  select role, plan, plan_expires_at, text_teaching_balance into v_role, v_plan, v_expires_at, v_balance from public.profiles where id = v_user_id for update;
  if v_role = 'admin' then
    select count(*) into v_existing from public.billing_events where user_id = v_user_id and event_type = 'text_teaching_charge' and payment_reference = 'text:' || v_key;
    if v_existing = 0 then insert into public.billing_events (user_id, event_type, payment_reference, units, metadata) values (v_user_id, 'text_teaching_charge', 'text:' || v_key, 1, jsonb_build_object('admin_usage', true)); end if;
    return query select true, null::integer, true, 'admin'; return;
  end if;
  if v_plan not in ('premium_monthly', '3mo', '6mo', '9mo', '12mo') or (v_expires_at is not null and v_expires_at <= now()) then return query select false, coalesce(v_balance, 0), false, 'premium_required'; return; end if;
  select count(*) into v_existing from public.billing_events where user_id = v_user_id and event_type = 'text_teaching_charge' and payment_reference = 'text:' || v_key;
  if v_existing > 0 then return query select true, v_balance, false, 'already_charged'; return; end if;
  if coalesce(v_balance, 0) <= 0 then return query select false, 0, false, 'text_teaching_balance_empty'; return; end if;
  update public.profiles set text_teaching_balance = text_teaching_balance - 1 where id = v_user_id;
  insert into public.billing_events (user_id, event_type, payment_reference, units, metadata) values (v_user_id, 'text_teaching_charge', 'text:' || v_key, 1, jsonb_build_object('balance_before', v_balance));
  return query select true, v_balance - 1, false, 'charged';
end;
$$;

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
  if v_user_id is null then return query select false, 0, true, 0, 'not_authenticated'; return; end if;
  select s.user_id, s.started_at, s.status, s.voice_charged_minutes, p.role, p.plan, p.voice_minutes_balance
    into v_user_id, v_started, v_status, v_charged, v_role, v_plan, v_balance
  from public.live_class_sessions s join public.profiles p on p.id = s.user_id
  where s.id = p_session_id and s.user_id = auth.uid()
  for update of s;
  if not found then return query select false, 0, true, 0, 'session_not_found'; return; end if;

  v_target := greatest(0, ceil(greatest(extract(epoch from (now() - v_started)), greatest(p_duration_seconds, 0)) / 60.0)::integer);
  v_delta := greatest(0, v_target - coalesce(v_charged, 0));

  if v_role = 'admin' then
    if v_delta > 0 then
      v_key := 'admin_voice:' || p_session_id::text || ':' || v_target::text;
      insert into public.billing_events (user_id, event_type, payment_reference, units, metadata) values (auth.uid(), 'voice_charge', v_key, v_delta, jsonb_build_object('admin_usage', true, 'session_id', p_session_id));
      v_charged := v_target;
    end if;
    update public.live_class_sessions set voice_charged_minutes = v_charged, usage_charged_at = case when p_end then coalesce(usage_charged_at, now()) else usage_charged_at end, status = case when p_end then 'ended' else status end, ended_at = case when p_end then coalesce(ended_at, now()) else ended_at end where id = p_session_id;
    return query select true, null::integer, false, v_charged, 'admin_unmetered'; return;
  end if;

  if v_plan not in ('premium_monthly', '3mo', '6mo', '9mo', '12mo') then
    if p_end then update public.live_class_sessions set status = 'ended', ended_at = coalesce(ended_at, now()), usage_charged_at = coalesce(usage_charged_at, now()) where id = p_session_id; end if;
    return query select true, null::integer, false, 0, 'unmetered'; return;
  end if;

  v_delta := least(v_delta, greatest(v_balance, 0));
  if v_delta > 0 then
    update public.profiles set voice_minutes_balance = voice_minutes_balance - v_delta where id = auth.uid();
    v_balance := v_balance - v_delta;
    v_charged := v_charged + v_delta;
    v_key := 'voice:' || p_session_id::text || ':' || v_charged::text;
    insert into public.billing_events (user_id, event_type, payment_reference, units, metadata) values (auth.uid(), 'voice_charge', v_key, v_delta, jsonb_build_object('session_id', p_session_id, 'duration_seconds', p_duration_seconds));
  end if;
  update public.live_class_sessions set voice_charged_minutes = v_charged, usage_charged_at = case when p_end or v_balance <= 0 then coalesce(usage_charged_at, now()) else usage_charged_at end, status = case when p_end or v_balance <= 0 then 'ended' else status end, ended_at = case when p_end or v_balance <= 0 then coalesce(ended_at, now()) else ended_at end where id = p_session_id;
  v_remaining := greatest(0, v_balance);
  return query select true, v_remaining, (v_remaining <= 0), v_charged, case when v_remaining <= 0 then 'voice_balance_empty' else 'charged' end;
end;
$$;

commit;
