-- LenxiQ AI: allow the public premium_3mo plan in existing entitlement RPCs.
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
  v_active boolean;
  v_now timestamptz := now();
  v_max_seconds integer;
begin
  if v_user_id is null then
    return query select false, 'not_authenticated', null::uuid, 0, null::integer, 0, null::timestamptz, false;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':live-class-wallet', 0));

  select role, plan, plan_expires_at, voice_minutes_balance
    into v_role, v_plan, v_plan_expires_at, v_voice_balance
  from public.profiles
  where id = v_user_id
  for update;

  select exists(select 1 from public.live_class_sessions where user_id = v_user_id and status = 'active') into v_active;
  if v_active then
    return query select false, 'active_session', null::uuid, null::integer, null::integer, null::integer, null::timestamptz, false;
    return;
  end if;

  if v_role = 'admin' then
    insert into public.live_class_sessions (user_id, conversation_id, room_name, course_name)
      values (v_user_id, p_conversation_id, p_room_name, coalesce(nullif(trim(p_course_name), ''), 'Live Class'))
      returning id into v_session_id;
    return query select true, 'admin', v_session_id, null::integer, null::integer, null::integer, null::timestamptz, true;
    return;
  end if;

  if v_plan in ('premium_monthly', 'premium_3mo', '3mo', '6mo', '9mo', '12mo') and (v_plan_expires_at is null or v_plan_expires_at > v_now) then
    if coalesce(v_voice_balance, 0) <= 0 then
      return query select false, 'voice_balance_empty', null::uuid, null::integer, null::integer, 0, v_now, false;
      return;
    end if;
    v_max_seconds := v_voice_balance * 60;
    insert into public.live_class_sessions (user_id, conversation_id, room_name, course_name, voice_reserved_minutes)
      values (v_user_id, p_conversation_id, p_room_name, coalesce(nullif(trim(p_course_name), ''), 'Live Class'), v_voice_balance)
      returning id into v_session_id;
    return query select true, 'premium_wallet', v_session_id, null::integer, null::integer, v_max_seconds, v_now + make_interval(mins => v_voice_balance), false;
    return;
  end if;

  return query select false, 'premium_required', null::uuid, null::integer, null::integer, 0, null::timestamptz, false;
end;
$$;
revoke all on function public.reserve_live_class_session(text, text, uuid) from public;
grant execute on function public.reserve_live_class_session(text, text, uuid) to authenticated;


create or replace function public.settle_verified_payment(
  p_payment_reference text,
  p_user_id uuid,
  p_event_type text,
  p_plan_id text default null,
  p_plan_duration integer default null,
  p_revenue_amount_ngn numeric default 0,
  p_voice_minutes integer default 0,
  p_metadata jsonb default '{}'::jsonb
)
returns table (settled boolean, already_settled boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted boolean;
  v_expiration timestamptz;
  v_base timestamptz;
  v_role text;
  v_plan text;
  v_plan_expires_at timestamptz;
begin
  if p_user_id is null or p_payment_reference is null or p_event_type not in ('subscription_payment', 'topup_payment') then
    raise exception 'invalid_payment_settlement';
  end if;

  if p_event_type = 'topup_payment' then
    select role, plan, plan_expires_at into v_role, v_plan, v_plan_expires_at from public.profiles where id = p_user_id for update;
    if not found then raise exception 'profile_not_found'; end if;
    if v_role = 'admin' or v_plan not in ('premium_monthly', 'premium_3mo', '3mo', '6mo', '9mo', '12mo') or (v_plan_expires_at is not null and v_plan_expires_at <= now()) then
      raise exception 'topup_requires_active_premium';
    end if;
  end if;

  insert into public.billing_events (user_id, event_type, payment_reference, plan_id, units, revenue_amount_ngn, metadata)
    values (p_user_id, p_event_type, p_payment_reference, p_plan_id, case when p_event_type = 'topup_payment' then p_voice_minutes else p_plan_duration end, p_revenue_amount_ngn, p_metadata)
    on conflict (payment_reference) do nothing;
  v_inserted := found;

  if not v_inserted then
    return query select false, true;
    return;
  end if;

  if p_event_type = 'subscription_payment' then
    select greatest(coalesce(plan_expires_at, now()), now()) into v_base from public.profiles where id = p_user_id for update;
    if not found then raise exception 'profile_not_found'; end if;
    v_expiration := v_base + make_interval(months => greatest(1, coalesce(p_plan_duration, 1)));
    update public.profiles
      set plan = coalesce(p_plan_id, 'premium_monthly'),
          plan_duration = greatest(1, coalesce(p_plan_duration, 1)),
          plan_expires_at = v_expiration,
          voice_minutes_balance = 60,
          text_teaching_balance = 50,
          wallet_reset_at = now() + interval '1 month',
          ai_explanations_used = 0,
          ai_teachings_used = 0,
          quiz_attempts_used = 0
    where id = p_user_id;
    insert into public.billing_events (user_id, event_type, plan_id, units, metadata)
      values (p_user_id, 'monthly_grant', p_plan_id, 110, jsonb_build_object('voice_minutes', 60, 'text_teaching_credits', 50, 'rollover', false, 'payment_reference', p_payment_reference));
  else
    update public.profiles set voice_minutes_balance = voice_minutes_balance + greatest(0, coalesce(p_voice_minutes, 0)) where id = p_user_id;
    if not found then raise exception 'profile_not_found'; end if;
  end if;

  return query select true, false;
end;
$$;
revoke all on function public.settle_verified_payment(text, uuid, text, text, integer, numeric, integer, jsonb) from public;
grant execute on function public.settle_verified_payment(text, uuid, text, text, integer, numeric, integer, jsonb) to service_role;

commit;
