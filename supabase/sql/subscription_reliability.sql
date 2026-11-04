begin;
-- Non-public helpers always execute behind a verified user/service entry point.
create table if not exists public.ai_request_reservations(
 id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,feature text not null,
 cycle_end timestamptz,plan_id text not null,status text not null default 'reserved' check(status in ('reserved','completed','refunded')),
 created_at timestamptz not null default now(),finished_at timestamptz
);
alter table public.ai_request_reservations enable row level security;
revoke all on public.ai_request_reservations from anon,authenticated;
grant select on public.ai_request_reservations to authenticated;
grant all on public.ai_request_reservations to service_role;
drop policy if exists own_ai_reservations on public.ai_request_reservations;
create policy own_ai_reservations on public.ai_request_reservations for select to authenticated using(user_id=auth.uid() or private.is_admin());
create index if not exists ai_reservations_user_created on public.ai_request_reservations(user_id,created_at desc);
create table if not exists public.study_ai_usage(
 id uuid primary key, user_id uuid references auth.users(id) on delete set null,reservation_id uuid references public.ai_request_reservations(id) on delete set null,
 feature text not null,provider text not null,model text not null,input_tokens bigint not null default 0,output_tokens bigint not null default 0,
 cached_tokens bigint not null default 0,thinking_tokens bigint not null default 0,estimated_cost_usd numeric not null default 0,
 token_source text not null check(token_source in ('provider','estimate','cache')),outcome text not null,
 created_at timestamptz not null default now()
);
alter table public.study_ai_usage enable row level security;
revoke all on public.study_ai_usage from anon,authenticated;
grant select on public.study_ai_usage to authenticated;
grant all on public.study_ai_usage to service_role;
drop policy if exists admin_ai_usage on public.study_ai_usage;
create policy admin_ai_usage on public.study_ai_usage for select to authenticated using(private.is_admin());
create index if not exists study_ai_usage_month on public.study_ai_usage(created_at,provider,feature);

create table if not exists public.scheduled_subscriptions(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 payment_reference text unique not null,plan_id text not null references public.subscription_plans(id),starts_at timestamptz not null,ends_at timestamptz not null,
 status text not null default 'scheduled' check(status in ('scheduled','activated','elapsed')),created_at timestamptz not null default now()
);
alter table public.scheduled_subscriptions enable row level security;
revoke all on public.scheduled_subscriptions from anon,authenticated;
grant select on public.scheduled_subscriptions to authenticated;
grant all on public.scheduled_subscriptions to service_role;
drop policy if exists own_scheduled_subscription on public.scheduled_subscriptions;
create policy own_scheduled_subscription on public.scheduled_subscriptions for select to authenticated using(user_id=auth.uid() or private.is_admin());

update public.profiles set plan='free',voice_minutes_balance=0,text_teaching_balance=0 where plan is null;
alter table public.profiles alter column plan set not null;

-- Close the profile read/update boundary as well as the protected-column trigger.
drop policy if exists profile_owner_boundary on public.profiles;
create policy profile_owner_boundary on public.profiles as restrictive for all to authenticated using(id=auth.uid() or private.is_admin()) with check(id=auth.uid() or private.is_admin());

create or replace function private.refresh_subscription(p_user uuid) returns void language plpgsql security definer set search_path=public as $$
declare p public.profiles%rowtype;s public.subscription_plans%rowtype;r record;delta integer;target integer;t timestamptz;q public.scheduled_subscriptions%rowtype;
begin
 if p_user is null then return;end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text||':subscription',0));
 select * into p from public.profiles where id=p_user for update;
 if not found or p.role='admin' then return;end if;
 for r in select id from public.ai_request_reservations where user_id=p_user and status='reserved' and created_at<now()-interval '15 minutes' loop perform public.finish_ai_request(r.id,false);end loop;
 -- Settle the previous cycle before resetting or expiring it. A closed browser cannot skip the debit.
 for r in select * from public.live_class_sessions where user_id=p_user and status='active' and (
   now()>=started_at+make_interval(mins=>greatest(1,coalesce(voice_reserved_minutes,90))) or p.plan_expires_at<=now() or p.wallet_reset_at<=now()) for update loop
  target:=least(greatest(0,coalesce(r.voice_reserved_minutes,0)),greatest(0,ceil(extract(epoch from (least(now(),coalesce(p.wallet_reset_at,now()),coalesce(p.plan_expires_at,now()))-r.started_at))/60.0)::integer));
  delta:=least(greatest(0,target-coalesce(r.voice_charged_minutes,0)),greatest(0,coalesce(p.voice_minutes_balance,0)));
  if delta>0 then
   update public.profiles set voice_minutes_balance=greatest(0,voice_minutes_balance-delta) where id=p_user;
   p.voice_minutes_balance:=p.voice_minutes_balance-delta;
   insert into public.billing_events(user_id,event_type,payment_reference,units,metadata) values(p_user,'voice_charge','stale-voice:'||r.id::text,delta,jsonb_build_object('session_id',r.id,'server_reconciliation',true)) on conflict(payment_reference) do nothing;
  end if;
  update public.live_class_sessions set status='ended',ended_at=least(now(),r.started_at+make_interval(mins=>greatest(1,coalesce(r.voice_reserved_minutes,90)))),voice_charged_minutes=coalesce(voice_charged_minutes,0)+delta,usage_charged_at=now() where id=r.id;
 end loop;
 -- A paid downgrade begins only after the already purchased term.
 if p.plan_expires_at is null or p.plan_expires_at<=now() or p.plan='free' then
  update public.scheduled_subscriptions set status='elapsed' where user_id=p_user and status='scheduled' and ends_at<=now();
  select * into q from public.scheduled_subscriptions where user_id=p_user and status='scheduled' and starts_at<=now() and ends_at>now() order by starts_at limit 1 for update;
  if found then
   select * into s from public.subscription_plans where id=q.plan_id;
   update public.profiles set plan=s.id,plan_expires_at=q.ends_at,plan_duration=1,voice_minutes_balance=s.voice_minutes,text_teaching_balance=s.ai_credits,quiz_attempts_used=0,wallet_reset_at=q.ends_at where id=p_user;
   update public.scheduled_subscriptions set status='activated' where id=q.id;return;
  end if;
  update public.profiles set plan='free',voice_minutes_balance=0,text_teaching_balance=0,quiz_attempts_used=case when wallet_reset_at is null or wallet_reset_at<=now() then 0 else coalesce(quiz_attempts_used,0) end,wallet_reset_at=case when wallet_reset_at is null or wallet_reset_at<=now() then now()+interval '1 month' else wallet_reset_at end where id=p_user;return;
 end if;
 select * into s from public.subscription_plans where id=p.plan;
 if not found then raise exception 'unrecognized_subscription';end if;
 if p.wallet_reset_at is null or p.wallet_reset_at<=now() then
  t:=coalesce(p.wallet_reset_at,now());while t<=now() loop t:=t+interval '1 month';end loop;
  update public.profiles set voice_minutes_balance=s.voice_minutes,text_teaching_balance=s.ai_credits,quiz_attempts_used=0,wallet_reset_at=t where id=p_user;
 end if;
end;$$;
revoke all on function private.refresh_subscription(uuid) from public,anon,authenticated;
create or replace function public.refresh_my_subscription() returns void language plpgsql security definer set search_path=public as $$begin perform private.refresh_subscription(auth.uid());end;$$;
revoke all on function public.refresh_my_subscription() from public;
grant execute on function public.refresh_my_subscription() to authenticated;
create or replace function public.reset_due_wallets() returns integer language plpgsql security definer set search_path=public as $$
declare r record;n integer:=0;begin
 if coalesce(auth.role(),'')<>'service_role' and not private.is_admin() then raise exception 'admin_access_required';end if;
 for r in select id from public.profiles where role<>'admin' and (wallet_reset_at<=now() or plan_expires_at<=now()) loop perform private.refresh_subscription(r.id);n:=n+1;end loop;return n;
end;$$;
revoke all on function public.reset_due_wallets() from public,anon;
grant execute on function public.reset_due_wallets() to authenticated,service_role;

create or replace function public.reserve_ai_request(p_feature text,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.profiles%rowtype;r public.ai_request_reservations%rowtype;begin
 if auth.uid() is null then return jsonb_build_object('allowed',false,'message','Sign in to continue.');end if;
 if p_feature not in ('teaching','explanation','transcription') or p_request_id is null then raise exception 'invalid_ai_request';end if;
 perform private.refresh_subscription(auth.uid());select * into p from public.profiles where id=auth.uid() for update;
 if p.role='admin' then return jsonb_build_object('allowed',true,'admin',true);end if;
 if not private.has_paid_access() then return jsonb_build_object('allowed',false,'message','Choose a paid plan for AI explanations and teaching.');end if;
 select * into r from public.ai_request_reservations where id=p_request_id;
 if found then return jsonb_build_object('allowed',false,'message','This request has already been submitted.');end if;
 if (select count(*) from public.ai_request_reservations where user_id=p.id and status='reserved' and created_at>now()-interval '15 minutes')>=2 then return jsonb_build_object('allowed',false,'message','Please wait for your current AI responses to finish.');end if;
 if (select count(*) from public.ai_request_reservations where user_id=p.id and status='refunded' and created_at>now()-interval '1 hour')>=10 then return jsonb_build_object('allowed',false,'message','Several requests failed recently. Please wait before retrying.');end if;
 if coalesce(p.text_teaching_balance,0)<=0 then return jsonb_build_object('allowed',false,'remaining',0,'message','Your monthly AI response allowance has been used.');end if;
 insert into public.ai_request_reservations(id,user_id,feature,cycle_end,plan_id) values(p_request_id,auth.uid(),p_feature,p.wallet_reset_at,p.plan);
 update public.profiles set text_teaching_balance=text_teaching_balance-1 where id=p.id;
 insert into public.billing_events(user_id,event_type,payment_reference,units,metadata) values(p.id,'text_teaching_charge','ai:'||p_request_id,1,jsonb_build_object('feature',p_feature,'request_id',p_request_id));
 return jsonb_build_object('allowed',true,'remaining',p.text_teaching_balance-1,'request_id',p_request_id);
end;$$;
revoke all on function public.reserve_ai_request(text,uuid) from public;
grant execute on function public.reserve_ai_request(text,uuid) to authenticated;
create or replace function public.finish_ai_request(p_request_id uuid,p_success boolean) returns void language plpgsql security definer set search_path=public as $$
declare r public.ai_request_reservations%rowtype;p public.profiles%rowtype;cap integer;restored boolean:=false;begin
 select * into r from public.ai_request_reservations where id=p_request_id;
 if not found then return;end if;
 perform pg_advisory_xact_lock(hashtextextended(r.user_id::text||':subscription',0));
 select * into r from public.ai_request_reservations where id=p_request_id for update;
 if r.status<>'reserved' then return;end if;
 select * into p from public.profiles where id=r.user_id for update;
 if not p_success then
  if p.plan=r.plan_id and p.wallet_reset_at is not distinct from r.cycle_end and p.plan_expires_at>now() then
   select ai_credits into cap from public.subscription_plans where id=p.plan;
   restored:=p.text_teaching_balance<cap;
   update public.profiles set text_teaching_balance=least(cap,greatest(0,text_teaching_balance)+1) where id=p.id;
  end if;
  insert into public.billing_events(user_id,event_type,payment_reference,units,metadata) values(r.user_id,'text_teaching_charge','ai-refund:'||r.id,case when restored then -1 else 0 end,jsonb_build_object('feature',r.feature,'request_id',r.id,'refund',restored)) on conflict(payment_reference) do nothing;
 end if;
 update public.ai_request_reservations set status=case when p_success then 'completed' else 'refunded' end,finished_at=now() where id=r.id;
end;$$;
revoke all on function public.finish_ai_request(uuid,boolean) from public,anon,authenticated;
grant execute on function public.finish_ai_request(uuid,boolean) to service_role;

create or replace function public.claim_pending_checkouts(p_user_id uuid) returns setof public.subscription_checkouts language sql security definer set search_path=public as $$
 update public.subscription_checkouts set last_checked_at=now() where tx_ref in (
 select tx_ref from public.subscription_checkouts where user_id=p_user_id and settled_at is null and (last_checked_at is null or last_checked_at<now()-interval '1 minute') order by last_checked_at nulls first,created_at limit 5 for update skip locked
 ) returning *;$$;
revoke all on function public.claim_pending_checkouts(uuid) from public,anon,authenticated;
grant execute on function public.claim_pending_checkouts(uuid) to service_role;

create or replace function public.settle_verified_payment(p_payment_reference text,p_user_id uuid,p_event_type text,p_plan_id text default null,p_plan_duration integer default null,p_revenue_amount_ngn numeric default 0,p_voice_minutes integer default 0,p_metadata jsonb default '{}'::jsonb)
returns table(settled boolean,already_settled boolean) language plpgsql security definer set search_path=public as $$
declare s public.subscription_plans%rowtype;p public.profiles%rowtype;prior public.billing_events%rowtype;queue_end timestamptz;old_price integer;begin
 select * into s from public.subscription_plans where id=p_plan_id and id<>'free';
 if not found or p_event_type is distinct from 'subscription_payment' or p_plan_duration is distinct from 1 or p_revenue_amount_ngn is distinct from s.price_ngn or coalesce(p_payment_reference,'')='' then raise exception 'invalid_subscription_product';end if;
 perform private.refresh_subscription(p_user_id);
 select * into p from public.profiles where id=p_user_id for update;if not found then raise exception 'profile_missing';end if;
 select * into prior from public.billing_events where payment_reference=p_payment_reference;
 if found then
  if prior.user_id is distinct from p_user_id or prior.plan_id is distinct from s.id or prior.revenue_amount_ngn is distinct from s.price_ngn then raise exception 'payment_reference_conflict';end if;
  return query select false,true;return;
 end if;
 insert into public.billing_events(user_id,event_type,payment_reference,plan_id,units,revenue_amount_ngn,metadata) values(p_user_id,'subscription_payment',p_payment_reference,s.id,1,s.price_ngn,p_metadata);
 select price_ngn into old_price from public.subscription_plans where id=p.plan;
 select max(ends_at) into queue_end from public.scheduled_subscriptions where user_id=p_user_id and status='scheduled';
 if queue_end>now() or (p.plan_expires_at>now() and old_price>s.price_ngn) then
  queue_end:=greatest(coalesce(queue_end,now()),coalesce(p.plan_expires_at,now()),now());
  insert into public.scheduled_subscriptions(user_id,payment_reference,plan_id,starts_at,ends_at) values(p_user_id,p_payment_reference,s.id,queue_end,queue_end+interval '1 month');
 else
  update public.profiles set plan=s.id,plan_duration=1,
   plan_expires_at=case when p.plan in ('scholar','all_access','intensive') and p.plan_expires_at>now() then p.plan_expires_at+interval '1 month' else now()+interval '1 month' end,
   voice_minutes_balance=case when p.plan=s.id and p.plan_expires_at>now() then p.voice_minutes_balance else s.voice_minutes end,
   text_teaching_balance=case when p.plan=s.id and p.plan_expires_at>now() then p.text_teaching_balance else s.ai_credits end,
   quiz_attempts_used=case when p.plan=s.id and p.plan_expires_at>now() then p.quiz_attempts_used else 0 end,
   wallet_reset_at=case when p.plan=s.id and p.plan_expires_at>now() then coalesce(p.wallet_reset_at,now()+interval '1 month') else now()+interval '1 month' end where id=p_user_id;
 end if;
 update public.subscription_checkouts set settled_at=now() where tx_ref=p_metadata->>'tx_ref' and user_id=p_user_id;
 return query select true,false;
end;$$;
revoke all on function public.settle_verified_payment(text,uuid,text,text,integer,numeric,integer,jsonb) from public,anon,authenticated;
grant execute on function public.settle_verified_payment(text,uuid,text,text,integer,numeric,integer,jsonb) to service_role;

create table if not exists public.finance_month_settings(month date primary key,config jsonb not null default '{}'::jsonb,updated_at timestamptz not null default now());
create table if not exists public.finance_invoices(month date not null,provider text not null check(provider in ('supabase','vercel','livekit','gemini','groq','other','refunds','payment_fees')),amount numeric not null check(amount>=0),currency text not null check(currency in ('USD','NGN')),note text not null default '',updated_at timestamptz not null default now(),primary key(month,provider));
alter table public.finance_month_settings enable row level security;
alter table public.finance_invoices enable row level security;
revoke all on public.finance_month_settings,public.finance_invoices from anon,authenticated;
grant select,insert,update on public.finance_month_settings,public.finance_invoices to authenticated;
grant all on public.finance_month_settings,public.finance_invoices to service_role;
drop policy if exists admin_finance_settings on public.finance_month_settings;
create policy admin_finance_settings on public.finance_month_settings for all to authenticated using(private.is_admin()) with check(private.is_admin());
drop policy if exists admin_finance_invoices on public.finance_invoices;
create policy admin_finance_invoices on public.finance_invoices for all to authenticated using(private.is_admin()) with check(private.is_admin());

create or replace function public.admin_monthly_financials(p_month date) returns jsonb language plpgsql security definer set search_path=public as $$
declare start_at timestamptz;end_at timestamptz;result jsonb;begin
 if not private.is_admin() then raise exception 'admin_access_required';end if;
 start_at:=date_trunc('month',p_month::timestamp) at time zone 'UTC';end_at:=start_at+interval '1 month';
 select jsonb_build_object(
  'month',to_char(start_at at time zone 'UTC','YYYY-MM'),
  'revenueNgn',coalesce((select sum(revenue_amount_ngn) from public.billing_events where event_type in ('subscription_payment','topup_payment') and created_at>=start_at and created_at<end_at),0),
  'paymentCount',(select count(*) from public.billing_events where event_type in ('subscription_payment','topup_payment') and revenue_amount_ngn>0 and created_at>=start_at and created_at<end_at),
  'voiceMinutes',coalesce((select sum(units) from public.billing_events where event_type='voice_charge' and created_at>=start_at and created_at<end_at),0),
  'textCredits',coalesce((select sum(units) from public.billing_events where event_type='text_teaching_charge' and created_at>=start_at and created_at<end_at),0),
  'creditRefunds',coalesce((select -sum(units) from public.billing_events where event_type='text_teaching_charge' and units<0 and created_at>=start_at and created_at<end_at),0),
  'openSessions',(select count(*) from public.live_class_sessions where status='active'),
  'pendingCheckouts',(select count(*) from public.subscription_checkouts where settled_at is null and created_at>=start_at and created_at<end_at),
  'subscribers',coalesce((select jsonb_agg(to_jsonb(t)) from(select p.plan,s.label,count(*) accounts,s.price_ngn from public.profiles p join public.subscription_plans s on s.id=p.plan where p.role<>'admin' and p.plan<>'free' and p.plan_expires_at>now() group by p.plan,s.label,s.price_ngn) t),'[]'::jsonb),
  'usage',coalesce((select jsonb_agg(to_jsonb(t)) from(select provider,feature,count(*) requests,sum(input_tokens) input_tokens,sum(output_tokens) output_tokens,sum(cached_tokens) cached_tokens,sum(thinking_tokens) thinking_tokens,sum(estimated_cost_usd) cost_usd,count(*) filter(where token_source='provider') measured_requests,count(*) filter(where token_source='estimate') estimated_requests,count(*) filter(where reservation_id is not null and outcome in ('completed','cache')) charged_requests from public.study_ai_usage where created_at>=start_at and created_at<end_at group by provider,feature) t),'[]'::jsonb),
  'settings',coalesce((select config from public.finance_month_settings where month=p_month),'{}'::jsonb),
  'invoices',coalesce((select jsonb_agg(to_jsonb(t)) from(select provider,amount,currency,note from public.finance_invoices where month=p_month order by provider) t),'[]'::jsonb),
  'meteringStartedAt',(select min(created_at) from public.study_ai_usage)
 ) into result;
 return result;
end;$$;
revoke all on function public.admin_monthly_financials(date) from public,anon;
grant execute on function public.admin_monthly_financials(date) to authenticated;

-- Anonymous content views must also obey the underlying question/profile RLS.
do $$declare r record;begin
 for r in select distinct v.oid::regclass view_name from pg_class v join pg_namespace n on n.oid=v.relnamespace join pg_rewrite w on w.ev_class=v.oid join pg_depend d on d.objid=w.oid join pg_class t on t.oid=d.refobjid where n.nspname='public' and v.relkind='v' and t.relname in ('questions','profiles','question_explanations','teaching_attachments') loop
 execute format('alter view %s set (security_invoker=true)',r.view_name);
 end loop;
end$$;
-- Prevent free users from uploading around paid-only API checks.
drop policy if exists paid_study_storage_insert on storage.objects;
create policy paid_study_storage_insert on storage.objects as restrictive for insert to authenticated with check(bucket_id not in ('teaching-attachments','ephemeral_class_materials','live-class-recordings') or private.has_paid_access());
drop policy if exists paid_study_storage_update on storage.objects;
create policy paid_study_storage_update on storage.objects as restrictive for update to authenticated using(bucket_id not in ('teaching-attachments','ephemeral_class_materials','live-class-recordings') or private.has_paid_access()) with check(bucket_id not in ('teaching-attachments','ephemeral_class_materials','live-class-recordings') or private.has_paid_access());
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
  v_elapsed integer := 0;
  v_limit_reached boolean := false;
  v_reserved integer;
  v_key text;
begin
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text||':subscription',0));
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
  for update of s,p;
  if not found then
    return query select false, 0, true, 0, 'session_not_found';
    return;
  end if;
  if v_status <> 'active' then
    return query select true, greatest(v_balance, 0), true, coalesce(v_charged, 0), 'session_ended';
    return;
  end if;

  select case when v_role='admin' then 90 else voice_reserved_minutes end into v_reserved from public.live_class_sessions where id=p_session_id;
  v_reserved:=greatest(1,coalesce(v_reserved,90));
  v_elapsed := greatest(0, least(v_reserved*60, floor(extract(epoch from (clock_timestamp() - v_started))::integer)));
  v_target := least(v_reserved, greatest(0, ceil(greatest(v_elapsed, least(greatest(coalesce(p_duration_seconds, 0), 0), v_reserved*60)) / 60.0)::integer));
  v_limit_reached := clock_timestamp() >= v_started + make_interval(mins=>v_reserved);

  -- Older free/trial sessions are closed instead of grandfathered into access.
  if v_is_free_trial then
    update public.live_class_sessions
      set status = 'ended', ended_at = coalesce(ended_at, clock_timestamp()),
          usage_charged_at = coalesce(usage_charged_at, clock_timestamp())
      where id = p_session_id;
    return query select true, 0, true, coalesce(v_charged, 0), 'premium_required';
    return;
  end if;
  if v_role <> 'admin' and (
      coalesce(v_plan, 'free') not in ('scholar','all_access','intensive')
      or v_plan_expires_at is null or v_plan_expires_at <= clock_timestamp()
  ) then
    update public.live_class_sessions
      set status = 'ended', ended_at = coalesce(ended_at, clock_timestamp()),
          usage_charged_at = coalesce(usage_charged_at, clock_timestamp())
      where id = p_session_id;
    return query select true, 0, true, coalesce(v_charged, 0), 'premium_required';
    return;
  end if;
  if v_role = 'admin' then
    update public.live_class_sessions
      set voice_charged_minutes = v_target,
          usage_charged_at = case when p_end or v_limit_reached then coalesce(usage_charged_at, clock_timestamp()) else usage_charged_at end,
          status = case when p_end or v_limit_reached then 'ended' else status end,
          ended_at = case when p_end or v_limit_reached then coalesce(ended_at, clock_timestamp()) else ended_at end
      where id = p_session_id;
    return query select true, null::integer, (p_end or v_limit_reached), v_target,
      case when v_limit_reached then 'session_time_limit' else 'admin_unmetered' end;
    return;
  end if;

  v_delta := least(greatest(0, v_target - coalesce(v_charged, 0)), greatest(v_balance, 0));
  if v_delta > 0 then
    update public.profiles set voice_minutes_balance = greatest(0, voice_minutes_balance - v_delta) where id = auth.uid();
    v_balance := greatest(0, v_balance - v_delta);
    v_charged := coalesce(v_charged, 0) + v_delta;
    v_key := 'voice:' || p_session_id::text || ':' || v_charged::text;
    insert into public.billing_events (user_id, event_type, payment_reference, units, metadata)
      values (auth.uid(), 'voice_charge', v_key, v_delta,
        jsonb_build_object('session_id', p_session_id, 'duration_seconds', least(v_elapsed, 5400), 'server_time_capped', true));
  end if;
  update public.live_class_sessions
    set voice_charged_minutes = v_charged,
        usage_charged_at = case when p_end or v_balance <= 0 or v_limit_reached then coalesce(usage_charged_at, clock_timestamp()) else usage_charged_at end,
        status = case when p_end or v_balance <= 0 or v_limit_reached then 'ended' else status end,
        ended_at = case when p_end or v_balance <= 0 or v_limit_reached then coalesce(ended_at, clock_timestamp()) else ended_at end
    where id = p_session_id;
  v_remaining := greatest(v_balance, 0);
  return query select true, v_remaining, (p_end or v_remaining <= 0 or v_limit_reached), v_charged,
    case when v_limit_reached then 'session_time_limit' when v_remaining <= 0 then 'voice_balance_empty' else 'charged' end;
end;
$$;
revoke all on function public.charge_live_class_session(uuid, integer, boolean) from public;
grant execute on function public.charge_live_class_session(uuid, integer, boolean) to authenticated;



notify pgrst,'reload schema';
commit;
