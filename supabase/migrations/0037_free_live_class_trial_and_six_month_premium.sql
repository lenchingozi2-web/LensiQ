begin;

alter table public.profiles
  add column if not exists free_live_class_trial_used_at timestamptz;

alter table public.live_class_sessions
  add column if not exists is_free_trial boolean not null default false;

comment on column public.profiles.free_live_class_trial_used_at is
  'Timestamp when this account consumed its one-time free Live Class trial; never reset by wallet cycles.';
comment on column public.live_class_sessions.is_free_trial is
  'Marks a free one-time Live Class session that is not charged against Premium voice minutes.';

create index if not exists live_class_sessions_active_user_idx
  on public.live_class_sessions (user_id)
  where status = 'active';

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
  v_trial_used_at timestamptz;
  v_session_id uuid;
  v_now timestamptz := now();
  v_max_seconds integer;
begin
  if v_user_id is null then
    return query select false, 'not_authenticated', null::uuid, 0, null::integer, 0, null::timestamptz, false;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':live-class-wallet', 0));

  select role, plan, plan_expires_at, voice_minutes_balance, free_live_class_trial_used_at
    into v_role, v_plan, v_plan_expires_at, v_voice_balance, v_trial_used_at
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    return query select false, 'profile_missing', null::uuid, 0, null::integer, 0, null::timestamptz, false;
    return;
  end if;

  if v_role = 'admin' then
    update public.live_class_sessions
      set status = 'ended', ended_at = coalesce(ended_at, v_now)
      where user_id = v_user_id and status = 'active';

    insert into public.live_class_sessions (user_id, conversation_id, room_name, course_name)
      values (v_user_id, p_conversation_id, p_room_name, coalesce(nullif(trim(p_course_name), ''), 'Live Class'))
      returning id into v_session_id;
    return query select true, 'admin', v_session_id, null::integer, null::integer, null::integer, null::timestamptz, true;
    return;
  end if;

  if v_plan in ('premium_monthly', 'premium_3mo', 'premium_6mo', '3mo', '6mo', '9mo', '12mo')
     and (v_plan_expires_at is null or v_plan_expires_at > v_now) then
    if coalesce(v_voice_balance, 0) <= 0 then
      return query select false, 'voice_balance_empty', null::uuid, null::integer, null::integer, 0, v_now, false;
      return;
    end if;

    v_max_seconds := v_voice_balance * 60;
    update public.live_class_sessions
      set status = 'ended', ended_at = coalesce(ended_at, v_now)
      where user_id = v_user_id and status = 'active';

    insert into public.live_class_sessions (user_id, conversation_id, room_name, course_name, voice_reserved_minutes)
      values (v_user_id, p_conversation_id, p_room_name, coalesce(nullif(trim(p_course_name), ''), 'Live Class'), v_voice_balance)
      returning id into v_session_id;
    return query select true, 'premium_wallet', v_session_id, null::integer, null::integer, v_max_seconds, v_now + make_interval(mins => v_voice_balance), false;
    return;
  end if;

  if v_trial_used_at is not null then
    return query select false, 'free_trial_used', null::uuid, 1, 1, 600, v_trial_used_at, false;
    return;
  end if;

  update public.live_class_sessions
    set status = 'ended', ended_at = coalesce(ended_at, v_now)
    where user_id = v_user_id and status = 'active';

  update public.profiles
    set free_live_class_trial_used_at = v_now
    where id = v_user_id and free_live_class_trial_used_at is null;

  if not found then
    return query select false, 'free_trial_used', null::uuid, 1, 1, 600, v_now, false;
    return;
  end if;

  insert into public.live_class_sessions (user_id, conversation_id, room_name, course_name, is_free_trial)
    values (v_user_id, p_conversation_id, p_room_name, coalesce(nullif(trim(p_course_name), ''), 'Live Class'), true)
    returning id into v_session_id;

  return query select true, 'free_trial', v_session_id, 1, 1, 600, v_now + interval '10 minutes', false;
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

  v_target := greatest(0, ceil(greatest(extract(epoch from (now() - v_started)), greatest(p_duration_seconds, 0)) / 60.0)::integer);

  if v_role = 'admin' then
    v_delta := greatest(0, v_target - coalesce(v_charged, 0));
    if v_delta > 0 then
      v_key := 'admin_voice:' || p_session_id::text || ':' || v_target::text;
      insert into public.billing_events (user_id, event_type, payment_reference, units, metadata)
        values (auth.uid(), 'voice_charge', v_key, v_delta, jsonb_build_object('admin_usage', true, 'session_id', p_session_id));
      v_charged := v_target;
    end if;
    update public.live_class_sessions
      set voice_charged_minutes = v_charged,
          usage_charged_at = case when p_end then coalesce(usage_charged_at, now()) else usage_charged_at end,
          status = case when p_end then 'ended' else status end,
          ended_at = case when p_end then coalesce(ended_at, now()) else ended_at end
      where id = p_session_id;
    return query select true, null::integer, false, v_charged, 'admin_unmetered';
    return;
  end if;

  if v_is_free_trial then
    v_target := least(10, v_target);
    update public.live_class_sessions
      set voice_charged_minutes = 0,
          usage_charged_at = case when p_end or v_target >= 10 then coalesce(usage_charged_at, now()) else usage_charged_at end,
          status = case when p_end or v_target >= 10 then 'ended' else status end,
          ended_at = case when p_end or v_target >= 10 then coalesce(ended_at, now()) else ended_at end
      where id = p_session_id;
    return query select true, null::integer, (p_end or v_target >= 10), 0,
      case when p_end or v_target >= 10 then 'free_trial_complete' else 'free_trial' end;
    return;
  end if;

  if coalesce(v_plan, 'free') not in ('premium_monthly', 'premium_3mo', 'premium_6mo', '3mo', '6mo', '9mo', '12mo')
     or (v_plan_expires_at is not null and v_plan_expires_at <= now()) then
    update public.live_class_sessions
      set status = 'ended', ended_at = coalesce(ended_at, now()), usage_charged_at = coalesce(usage_charged_at, now())
      where id = p_session_id;
    return query select true, 0, true, coalesce(v_charged, 0), 'premium_required';
    return;
  end if;

  v_delta := greatest(0, v_target - coalesce(v_charged, 0));
  v_delta := least(v_delta, greatest(v_balance, 0));
  if v_delta > 0 then
    update public.profiles set voice_minutes_balance = voice_minutes_balance - v_delta where id = auth.uid();
    v_balance := v_balance - v_delta;
    v_charged := v_charged + v_delta;
    v_key := 'voice:' || p_session_id::text || ':' || v_charged::text;
    insert into public.billing_events (user_id, event_type, payment_reference, units, metadata)
      values (auth.uid(), 'voice_charge', v_key, v_delta, jsonb_build_object('session_id', p_session_id, 'duration_seconds', p_duration_seconds));
  end if;

  update public.live_class_sessions
    set voice_charged_minutes = v_charged,
        usage_charged_at = case when p_end or v_balance <= 0 then coalesce(usage_charged_at, now()) else usage_charged_at end,
        status = case when p_end or v_balance <= 0 then 'ended' else status end,
        ended_at = case when p_end or v_balance <= 0 then coalesce(ended_at, now()) else ended_at end
    where id = p_session_id;

  v_remaining := greatest(0, v_balance);
  return query select true, v_remaining, (v_remaining <= 0), v_charged,
    case when v_remaining <= 0 then 'voice_balance_empty' else 'charged' end;
end;
$$;
revoke all on function public.charge_live_class_session(uuid, integer, boolean) from public;
grant execute on function public.charge_live_class_session(uuid, integer, boolean) to authenticated;

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
  if v_user_id is null then
    return query select false, 0, false, 'not_authenticated';
    return;
  end if;

  select role, plan, plan_expires_at, text_teaching_balance
    into v_role, v_plan, v_expires_at, v_balance
  from public.profiles where id = v_user_id for update;

  if v_role = 'admin' then
    select count(*) into v_existing
      from public.billing_events
      where user_id = v_user_id and event_type = 'text_teaching_charge' and payment_reference = 'text:' || v_key;
    if v_existing = 0 then
      insert into public.billing_events (user_id, event_type, payment_reference, units, metadata)
        values (v_user_id, 'text_teaching_charge', 'text:' || v_key, 1, jsonb_build_object('admin_usage', true));
    end if;
    return query select true, null::integer, true, 'admin';
    return;
  end if;

  if coalesce(v_plan, 'free') not in ('premium_monthly', 'premium_3mo', 'premium_6mo', '3mo', '6mo', '9mo', '12mo')
     or (v_expires_at is not null and v_expires_at <= now()) then
    return query select false, coalesce(v_balance, 0), false, 'premium_required';
    return;
  end if;

  select count(*) into v_existing
    from public.billing_events
    where user_id = v_user_id and event_type = 'text_teaching_charge' and payment_reference = 'text:' || v_key;
  if v_existing > 0 then
    return query select true, v_balance, false, 'already_charged';
    return;
  end if;
  if coalesce(v_balance, 0) <= 0 then
    return query select false, 0, false, 'text_teaching_balance_empty';
    return;
  end if;

  update public.profiles set text_teaching_balance = text_teaching_balance - 1 where id = v_user_id;
  insert into public.billing_events (user_id, event_type, payment_reference, units, metadata)
    values (v_user_id, 'text_teaching_charge', 'text:' || v_key, 1, jsonb_build_object('balance_before', v_balance));
  return query select true, v_balance - 1, false, 'charged';
end;
$$;
revoke all on function public.consume_text_teaching_credit(text) from public;
grant execute on function public.consume_text_teaching_credit(text) to authenticated;

create or replace function public.reset_due_wallets()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_record record;
  v_next timestamptz;
  v_is_admin boolean := false;
begin
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin') into v_is_admin;
  if not v_is_admin and auth.role() <> 'service_role' then
    raise exception 'admin_access_required';
  end if;

  for v_record in
    select id, wallet_reset_at
    from public.profiles
    where plan in ('premium_monthly', 'premium_3mo', 'premium_6mo', '3mo', '6mo', '9mo', '12mo')
      and (plan_expires_at is null or plan_expires_at > now())
      and wallet_reset_at is not null
      and wallet_reset_at <= now()
    for update
  loop
    v_next := v_record.wallet_reset_at + interval '1 month';
    update public.profiles
      set voice_minutes_balance = 360, text_teaching_balance = 50, wallet_reset_at = v_next
      where id = v_record.id;
    insert into public.billing_events (user_id, event_type, units, metadata)
      values (v_record.id, 'monthly_grant', 410, jsonb_build_object('voice_minutes', 360, 'text_teaching_credits', 50, 'rollover', false));
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.reset_due_wallets() from public;
grant execute on function public.reset_due_wallets() to service_role;

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
    select role, plan, plan_expires_at
      into v_role, v_plan, v_plan_expires_at
      from public.profiles where id = p_user_id for update;
    if not found then raise exception 'profile_not_found'; end if;
    if v_role = 'admin'
       or v_plan not in ('premium_monthly', 'premium_3mo', 'premium_6mo', '3mo', '6mo', '9mo', '12mo')
       or (v_plan_expires_at is not null and v_plan_expires_at <= now()) then
      raise exception 'topup_requires_active_premium';
    end if;
  end if;

  insert into public.billing_events (user_id, event_type, payment_reference, plan_id, units, revenue_amount_ngn, metadata)
    values (p_user_id, p_event_type, p_payment_reference, p_plan_id,
      case when p_event_type = 'topup_payment' then p_voice_minutes else p_plan_duration end,
      p_revenue_amount_ngn, p_metadata)
    on conflict (payment_reference) do nothing;
  v_inserted := found;

  if not v_inserted then
    return query select false, true;
    return;
  end if;

  if p_event_type = 'subscription_payment' then
    select greatest(coalesce(plan_expires_at, now()), now()) into v_base
      from public.profiles where id = p_user_id for update;
    if not found then raise exception 'profile_not_found'; end if;
    v_expiration := v_base + make_interval(months => greatest(1, coalesce(p_plan_duration, 1)));
    update public.profiles
      set plan = coalesce(p_plan_id, 'premium_monthly'),
          plan_duration = greatest(1, coalesce(p_plan_duration, 1)),
          plan_expires_at = v_expiration,
          voice_minutes_balance = 360,
          text_teaching_balance = 50,
          wallet_reset_at = now() + interval '1 month',
          ai_explanations_used = 0,
          ai_teachings_used = 0,
          quiz_attempts_used = 0
      where id = p_user_id;
    insert into public.billing_events (user_id, event_type, plan_id, units, metadata)
      values (p_user_id, 'monthly_grant', p_plan_id, 410,
        jsonb_build_object('voice_minutes', 360, 'text_teaching_credits', 50, 'rollover', false, 'payment_reference', p_payment_reference));
  else
    update public.profiles
      set voice_minutes_balance = voice_minutes_balance + greatest(0, coalesce(p_voice_minutes, 0))
      where id = p_user_id;
    if not found then raise exception 'profile_not_found'; end if;
  end if;

  return query select true, false;
end;
$$;
revoke all on function public.settle_verified_payment(text, uuid, text, text, integer, numeric, integer, jsonb) from public;
grant execute on function public.settle_verified_payment(text, uuid, text, text, integer, numeric, integer, jsonb) to service_role;

commit;
