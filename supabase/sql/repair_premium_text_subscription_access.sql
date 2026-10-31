-- LenxiQ AI: fix real entitlements for verified Premium Study (text-only) subscriptions.
-- Run in the SQL editor for the MEDICAL project: hixvbcrrklyajhkyliay.
-- No profiles, payments, balances, or records are deleted.
-- Earlier 0037-0049 functions must already exist.
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

  if coalesce(v_plan, 'free') not in ('premium_text_monthly', 'premium_monthly', 'premium_3mo', 'premium_6mo', '3mo', '6mo', '9mo', '12mo')
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
    where plan in ('premium_text_monthly', 'premium_monthly', 'premium_3mo', 'premium_6mo', '3mo', '6mo', '9mo', '12mo')
      and (plan_expires_at is null or plan_expires_at > now())
      and wallet_reset_at is not null
      and wallet_reset_at <= now()
    for update
  loop
    v_next := v_record.wallet_reset_at + interval '1 month';
    update public.profiles
      set voice_minutes_balance = case when plan = 'premium_text_monthly' then 0 else 360 end,
           text_teaching_balance = 50, wallet_reset_at = v_next
      where id = v_record.id;
    insert into public.billing_events (user_id, event_type, units, metadata)
      values (v_record.id, 'monthly_grant',
          case when (select plan from public.profiles where id = v_record.id) = 'premium_text_monthly' then 50 else 410 end,
          jsonb_build_object('voice_minutes',
            (select voice_minutes_balance from public.profiles where id = v_record.id),
            'text_teaching_credits', 50, 'rollover', false));
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
          voice_minutes_balance = case when p_plan_id = 'premium_text_monthly' then 0 else 360 end,
          text_teaching_balance = 50,
          wallet_reset_at = now() + interval '1 month',
          ai_explanations_used = 0,
          ai_teachings_used = 0,
          quiz_attempts_used = 0
      where id = p_user_id;
    insert into public.billing_events (user_id, event_type, plan_id, units, metadata)
      values (p_user_id, 'monthly_grant', p_plan_id,
        case when p_plan_id = 'premium_text_monthly' then 50 else 410 end,
        jsonb_build_object('voice_minutes', case when p_plan_id = 'premium_text_monthly' then 0 else 360 end,
          'text_teaching_credits', 50, 'rollover', false, 'payment_reference', p_payment_reference));
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

-- Inspection only: confirms functions exist after the transaction.
select proname, pg_get_function_identity_arguments(oid) as arguments
from pg_proc where pronamespace='public'::regnamespace
 and proname in ('settle_verified_payment','consume_text_teaching_credit','reset_due_wallets')
order by proname;
