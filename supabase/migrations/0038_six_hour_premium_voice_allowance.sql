begin;
-- Premium voice access is 6 hours (360 minutes) per monthly cycle.
-- Preserve any already-consumed minutes by adding the 300-minute difference to active balances.
update public.profiles
set voice_minutes_balance = coalesce(voice_minutes_balance, 0) + 300
where role <> 'admin'
  and plan in ('premium_monthly', 'premium_3mo', 'premium_6mo', '3mo', '6mo', '9mo', '12mo')
  and (plan_expires_at is null or plan_expires_at > now())
  and coalesce(voice_minutes_balance, 0) <= 60;

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
