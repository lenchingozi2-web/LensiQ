-- Medical project only: hixvbcrrklyajhkyliay. Atomic upgrade; payment history is preserved.
begin;
select pg_advisory_xact_lock(hashtextextended('lenxiq-four-tier-v1',0));
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;
create table if not exists public.subscription_plans (
 id text primary key, label text not null, price_ngn integer not null,
 ai_credits integer not null, voice_minutes integer not null, mock_exams integer not null, session_minutes integer not null
);
alter table public.subscription_plans enable row level security;
revoke all on public.subscription_plans from anon, authenticated;
grant select on public.subscription_plans to authenticated;
drop policy if exists plans_read on public.subscription_plans;
create policy plans_read on public.subscription_plans for select to authenticated using(true);
insert into public.subscription_plans values
 ('free','Explorer',0,0,0,3,0),('scholar','Scholar',4570,60,30,20,30),
 ('all_access','Scholar Plus',9870,200,90,-1,90),('intensive','Mastery',29900,600,360,-1,90)
on conflict(id) do update set label=excluded.label,price_ngn=excluded.price_ngn,ai_credits=excluded.ai_credits,voice_minutes=excluded.voice_minutes,mock_exams=excluded.mock_exams,session_minutes=excluded.session_minutes;

-- Remove old CHECKs before converting account entitlements. History is not a saleable product.
do $$declare r record; begin
 for r in select conname from pg_constraint where conrelid='public.profiles'::regclass and contype='c' and pg_get_constraintdef(oid) ~ '\mplan\M' loop
 execute format('alter table public.profiles drop constraint %I',r.conname); end loop;
end$$;
create table if not exists private.subscription_migration_backup as select id,plan,plan_expires_at,voice_minutes_balance,text_teaching_balance,wallet_reset_at from public.profiles;
revoke all on private.subscription_migration_backup from public,anon,authenticated;
-- Paid time already bought remains valid; only identifiers and allowances change.
update public.profiles set plan=case
 when plan='premium_text_monthly' then 'scholar'
 when plan in ('premium_monthly','premium_3mo','premium_6mo','3mo','6mo','9mo','12mo') then 'all_access'
 else 'free' end,
 plan_expires_at=case when plan<>'free' and plan_expires_at is null then now()+interval '1 month' else plan_expires_at end
where plan not in ('free','scholar','all_access','intensive');
update public.profiles p set voice_minutes_balance=least(greatest(coalesce(p.voice_minutes_balance,0),0),s.voice_minutes),
 text_teaching_balance=least(greatest(coalesce(p.text_teaching_balance,0),0),s.ai_credits),
 wallet_reset_at=coalesce(p.wallet_reset_at,now()+interval '1 month')
from public.subscription_plans s where s.id=p.plan and p.role<>'admin';
alter table public.profiles add constraint profiles_current_plan check(plan in ('free','scholar','all_access','intensive'));
alter table public.profiles alter column plan set default 'free';

create or replace function private.is_admin() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='admin'); $$;
create or replace function private.has_paid_access() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid() and (role='admin' or (plan in ('scholar','all_access','intensive') and plan_expires_at>now()))); $$;
revoke all on function private.is_admin(),private.has_paid_access() from public;
grant execute on function private.is_admin(),private.has_paid_access() to authenticated,service_role;

-- Starter branch selection is per course AND format, never per user's first click.
create or replace function private.question_branch(p_subject text,p_division text,p_type text) returns text language sql immutable set search_path=public as $$
 select case when lower(trim(p_subject))='pathology' and (lower(trim(p_division))='anatomical pathology' or (lower(trim(p_type))='practical' and trim(p_division) in ('Breast','Cardiovascular','Central Nervous System','Female Genital Tract','Gastrointestinal System','Genitourinary System','Hepatobiliary System','Lymphoreticular / Haematopoietic','Other / Congenital','Other / Surface','Respiratory System','Thyroid'))) then 'anatomical pathology' else lower(trim(p_division)) end; $$;
create table if not exists public.free_study_branches(subject text not null,format text not null,branch text not null,primary key(subject,format));
alter table public.free_study_branches enable row level security;
revoke all on public.free_study_branches from anon,authenticated;
grant select on public.free_study_branches to authenticated;
drop policy if exists free_branches_read on public.free_study_branches;
create policy free_branches_read on public.free_study_branches for select to authenticated using(true);
insert into public.free_study_branches
select distinct on (subject,format) subject,format,branch from (
 select distinct lower(trim(subject)) subject,lower(trim(type)) format,private.question_branch(subject,division,type) branch from public.questions where division is not null and type in ('mcq','theory','practical')
) b order by subject,format,case when branch ~ 'general.*autonomic' or branch='anatomical pathology' then 0 else 1 end,branch
on conflict(subject,format) do update set branch=excluded.branch;
create or replace function private.can_read_question(p_subject text,p_division text,p_type text) returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and (private.has_paid_access() or exists(select 1 from public.free_study_branches f where f.subject=lower(trim(p_subject)) and f.format=lower(trim(p_type)) and f.branch=private.question_branch(p_subject,p_division,p_type))); $$;
revoke all on function private.can_read_question(text,text,text),private.question_branch(text,text,text) from public;
grant execute on function private.can_read_question(text,text,text),private.question_branch(text,text,text) to authenticated,service_role;
alter table public.questions enable row level security;
drop policy if exists four_tier_question_boundary on public.questions;
create policy four_tier_question_boundary on public.questions as restrictive for select to authenticated using(private.can_read_question(subject,division,type));
revoke select on public.questions from anon;
drop policy if exists four_tier_question_read on public.questions;
create policy four_tier_question_read on public.questions for select to authenticated using(true);

-- Prevent REST clients from changing plans, balances, role or monthly reset counters.
create or replace function private.protect_profile_entitlements() returns trigger language plpgsql set search_path=public as $$
begin
 if current_user in ('anon','authenticated') and not private.is_admin() then
  if tg_op='INSERT' then raise exception 'profiles_must_be_provisioned_by_server'; end if;
  if (to_jsonb(new)-array['name','email','session_token','selected_free_course','selected_free_practical_branch','updated_at']) is distinct from (to_jsonb(old)-array['name','email','session_token','selected_free_course','selected_free_practical_branch','updated_at']) then
   raise exception 'subscription_fields_are_server_managed';
  end if;
 end if; return new;
end;$$;
drop trigger if exists protect_profile_entitlements on public.profiles;
create trigger protect_profile_entitlements before insert or update on public.profiles for each row execute function private.protect_profile_entitlements();

create or replace function public.refresh_my_subscription() returns void language plpgsql security definer set search_path=public as $$
declare p public.profiles%rowtype; s public.subscription_plans%rowtype; next_reset timestamptz;
begin
 if auth.uid() is null then return; end if;
 select * into p from public.profiles where id=auth.uid() for update;
 if not found or p.role='admin' then return; end if;
 if p.plan='free' or p.plan_expires_at is null or p.plan_expires_at<=now() then
  update public.profiles set plan='free',voice_minutes_balance=0,text_teaching_balance=0,quiz_attempts_used=case when wallet_reset_at is null or wallet_reset_at<=now() then 0 else quiz_attempts_used end,wallet_reset_at=case when wallet_reset_at is null or wallet_reset_at<=now() then now()+interval '1 month' else wallet_reset_at end where id=p.id; return;
 end if;
 select * into s from public.subscription_plans where id=p.plan;
 if p.wallet_reset_at is null or p.wallet_reset_at<=now() then
  next_reset:=coalesce(p.wallet_reset_at,now());
  while next_reset<=now() loop next_reset:=next_reset+interval '1 month'; end loop;
  update public.profiles set voice_minutes_balance=s.voice_minutes,text_teaching_balance=s.ai_credits,quiz_attempts_used=0,wallet_reset_at=next_reset where id=p.id;
 end if;
end;$$;
revoke all on function public.refresh_my_subscription() from public;
grant execute on function public.refresh_my_subscription() to authenticated;

create or replace function public.authorize_study_feature(p_feature text,p_subject text default null,p_division text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.profiles%rowtype; s public.subscription_plans%rowtype;
begin
 if auth.uid() is null then return jsonb_build_object('allowed',false,'message','Sign in to continue.'); end if;
 perform public.refresh_my_subscription();
 select * into p from public.profiles where id=auth.uid() for update;
 if p.role='admin' then return jsonb_build_object('allowed',true,'admin',true); end if;
 if p_feature in ('browse','practical') then
  return jsonb_build_object('allowed',p_division is null or private.has_paid_access() or exists(select 1 from public.free_study_branches f where (p_subject is null or f.subject=lower(trim(p_subject))) and (p_feature='browse' or f.format='practical') and f.branch=private.question_branch(coalesce(p_subject,'Pathology'),p_division,case when p_feature='practical' then 'practical' else f.format end)), 'message','Your free plan includes one starter branch in each course and format. Choose a paid plan for the complete bank.');
 end if;
 if p_feature='quiz' then
 select * into s from public.subscription_plans where id=p.plan;
 return jsonb_build_object('allowed',s.mock_exams=-1 or p.quiz_attempts_used<s.mock_exams,'message','Your monthly timed mock allowance has been used.');
 end if;
 if not private.has_paid_access() then return jsonb_build_object('allowed',false,'message','A paid plan is required for AI, Live Class and timed mock exams.'); end if;
 select * into s from public.subscription_plans where id=p.plan;
 if p_feature='quiz' then return jsonb_build_object('allowed',p.quiz_attempts_used<s.mock_exams,'message','Your monthly timed mock allowance has been used.'); end if;
 if p_feature='paid' then return jsonb_build_object('allowed',true); end if;
 if p_feature not in ('teaching','explanation') then return jsonb_build_object('allowed',false,'message','Unsupported feature.'); end if;
 if p.text_teaching_balance<=0 then return jsonb_build_object('allowed',false,'remaining',0,'message','Your monthly AI response allowance has been used.'); end if;
 update public.profiles set text_teaching_balance=text_teaching_balance-1 where id=p.id;
 insert into public.billing_events(user_id,event_type,units,metadata) values(p.id,'text_teaching_charge',1,jsonb_build_object('feature',p_feature));
 return jsonb_build_object('allowed',true,'remaining',p.text_teaching_balance-1);
end;$$;
revoke all on function public.authorize_study_feature(text,text,text) from public;
grant execute on function public.authorize_study_feature(text,text,text) to authenticated;

-- Old RPC callers use the same atomic pool. Client idempotency cannot grant unlimited responses.
create or replace function public.consume_text_teaching_credit(p_idempotency_key text default null)
returns table(allowed boolean,remaining_credits integer,is_admin boolean,reason text) language plpgsql security definer set search_path=public as $$
declare r jsonb;begin r:=public.authorize_study_feature('teaching');return query select (r->>'allowed')::boolean,(r->>'remaining')::integer,coalesce((r->>'admin')::boolean,false),coalesce(r->>'message','charged');end;$$;
revoke all on function public.consume_text_teaching_credit(text) from public;
grant execute on function public.consume_text_teaching_credit(text) to authenticated;

create or replace function public.settle_verified_payment(p_payment_reference text,p_user_id uuid,p_event_type text,p_plan_id text default null,p_plan_duration integer default null,p_revenue_amount_ngn numeric default 0,p_voice_minutes integer default 0,p_metadata jsonb default '{}'::jsonb)
returns table(settled boolean,already_settled boolean) language plpgsql security definer set search_path=public as $$
declare s public.subscription_plans%rowtype; p public.profiles%rowtype; inserted boolean;
begin
 select * into s from public.subscription_plans where id=p_plan_id and id<>'free';
 if not found or p_event_type<>'subscription_payment' or p_plan_duration<>1 or p_revenue_amount_ngn<>s.price_ngn or p_payment_reference is null then raise exception 'invalid_subscription_product'; end if;
 select * into p from public.profiles where id=p_user_id for update;
 if not found then raise exception 'profile_missing'; end if;
 insert into public.billing_events(user_id,event_type,payment_reference,plan_id,units,revenue_amount_ngn,metadata) values(p_user_id,'subscription_payment',p_payment_reference,s.id,1,s.price_ngn,p_metadata) on conflict(payment_reference) do nothing;
 inserted:=found;
 if not inserted then return query select false,true; return; end if;
 -- Same-plan early renewal extends time without refreshing allowances. Plan changes start a new cycle.
 update public.profiles set plan=s.id,plan_duration=1,
 plan_expires_at=case when p.plan=s.id and p.plan_expires_at>now() then p.plan_expires_at+interval '1 month' else now()+interval '1 month' end,
 voice_minutes_balance=case when p.plan=s.id and p.plan_expires_at>now() then p.voice_minutes_balance else s.voice_minutes end,
 text_teaching_balance=case when p.plan=s.id and p.plan_expires_at>now() then p.text_teaching_balance else s.ai_credits end,
 quiz_attempts_used=case when p.plan=s.id and p.plan_expires_at>now() then p.quiz_attempts_used else 0 end,
 wallet_reset_at=case when p.plan=s.id and p.plan_expires_at>now() then coalesce(p.wallet_reset_at,now()+interval '1 month') else now()+interval '1 month' end
 where id=p_user_id;
 return query select true,false;
end;$$;
revoke all on function public.settle_verified_payment(text,uuid,text,text,integer,numeric,integer,jsonb) from public,anon,authenticated;
grant execute on function public.settle_verified_payment(text,uuid,text,text,integer,numeric,integer,jsonb) to service_role;

-- Daily maintenance uses the same catalog, and advances missed monthly cycles once.
create or replace function public.reset_due_wallets() returns integer language plpgsql security definer set search_path=public as $$
declare r record; n integer:=0; t timestamptz;
begin
 if auth.role()<>'service_role' and not private.is_admin() then raise exception 'admin_access_required'; end if;
 for r in select p.id,p.wallet_reset_at,s.voice_minutes,s.ai_credits from public.profiles p join public.subscription_plans s on s.id=p.plan where p.role<>'admin' and p.plan<>'free' and p.plan_expires_at>now() and p.wallet_reset_at<=now() for update of p loop
 t:=r.wallet_reset_at;while t<=now() loop t:=t+interval '1 month';end loop;
 update public.profiles set voice_minutes_balance=r.voice_minutes,text_teaching_balance=r.ai_credits,quiz_attempts_used=0,wallet_reset_at=t where id=r.id;n:=n+1;
 end loop;return n;
end;$$;
revoke all on function public.reset_due_wallets() from public,anon,authenticated;
grant execute on function public.reset_due_wallets() to service_role;

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
  v_now timestamptz := clock_timestamp();
  v_reserved_minutes integer;
begin
  if v_user_id is null then
    return query select false, 'not_authenticated', null::uuid, 0, null::integer, 0, null::timestamptz, false;
    return;
  end if;
  perform public.refresh_my_subscription();
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':live-class-wallet', 0));
  select role, plan, plan_expires_at, voice_minutes_balance
    into v_role, v_plan, v_plan_expires_at, v_voice_balance
  from public.profiles where id = v_user_id for update;
  if not found then
    return query select false, 'profile_missing', null::uuid, 0, null::integer, 0, null::timestamptz, false;
    return;
  end if;
  if v_role = 'admin' then
    update public.live_class_sessions
      set status = 'ended', ended_at = coalesce(ended_at, v_now), usage_charged_at = coalesce(usage_charged_at, v_now)
      where user_id = v_user_id and status = 'active';
    insert into public.live_class_sessions (user_id, conversation_id, room_name, course_name)
      values (v_user_id, p_conversation_id, p_room_name, coalesce(nullif(trim(p_course_name), ''), 'Live Class'))
      returning id into v_session_id;
    return query select true, 'admin', v_session_id, null::integer, null::integer, 5400, v_now + interval '90 minutes', true;
    return;
  end if;
  if v_plan in ('scholar','all_access','intensive')
     and (v_plan_expires_at > v_now) then
    if coalesce(v_voice_balance, 0) <= 0 then
      return query select false, 'voice_balance_empty', null::uuid, null::integer, null::integer, 0, v_now, false;
      return;
    end if;
    perform public.charge_live_class_session(id,0,true) from public.live_class_sessions where user_id=v_user_id and status='active';
    select voice_minutes_balance into v_voice_balance from public.profiles where id=v_user_id;
    if v_voice_balance<=0 then return query select false,'voice_balance_empty',null::uuid,0,0,0,v_now,false; return;end if;
    v_reserved_minutes := least(greatest(v_voice_balance, 0), (select session_minutes from public.subscription_plans where id=v_plan));
    update public.live_class_sessions
      set status = 'ended', ended_at = coalesce(ended_at, v_now), usage_charged_at = coalesce(usage_charged_at, v_now)
      where user_id = v_user_id and status = 'active';
    insert into public.live_class_sessions (user_id, conversation_id, room_name, course_name, voice_reserved_minutes)
      values (v_user_id, p_conversation_id, p_room_name, coalesce(nullif(trim(p_course_name), ''), 'Live Class'), v_reserved_minutes)
      returning id into v_session_id;
    return query select true, 'premium_wallet', v_session_id, null::integer, null::integer,
      v_reserved_minutes * 60, v_now + make_interval(mins => v_reserved_minutes), false;
    return;
  end if;
  return query select false, 'premium_required', null::uuid, 0, 0, 0, v_now, false;
  return;
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
  v_elapsed integer := 0;
  v_limit_reached boolean := false;
  v_reserved integer;
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


create or replace function public.live_class_gateway_allowed(p_session uuid,p_user uuid) returns boolean language sql stable security definer set search_path=public as $$
select exists(select 1 from public.live_class_sessions s join public.profiles p on p.id=s.user_id where s.id=p_session and s.user_id=p_user and s.status='active' and (p.role='admin' or (p.plan in ('scholar','all_access','intensive') and p.plan_expires_at>now() and now()<s.started_at+make_interval(mins=>s.voice_reserved_minutes))));$$;
revoke all on function public.live_class_gateway_allowed(uuid,uuid) from public,anon,authenticated;
grant execute on function public.live_class_gateway_allowed(uuid,uuid) to service_role;

create table if not exists public.timed_mock_attempts(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 subject text not null,division text not null,question_ids uuid[] not null,started_at timestamptz not null default now(),
 expires_at timestamptz not null,submitted_at timestamptz,score integer
);
alter table public.timed_mock_attempts enable row level security;
revoke all on public.timed_mock_attempts from anon,authenticated;
grant select on public.timed_mock_attempts to authenticated;
drop policy if exists own_mock_attempts on public.timed_mock_attempts;
create policy own_mock_attempts on public.timed_mock_attempts for select to authenticated using(user_id=auth.uid() or private.is_admin());
create or replace function public.begin_timed_mock(p_subject text,p_division text,p_count integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.profiles%rowtype;s public.subscription_plans%rowtype;a public.timed_mock_attempts%rowtype;ids uuid[];qs jsonb;
begin
 if auth.uid() is null then raise exception 'not_authenticated';end if;
 if p_count not in (10,20,50,100) then raise exception 'invalid_question_count';end if;
 perform public.refresh_my_subscription();select * into p from public.profiles where id=auth.uid() for update;
 if not private.can_read_question(p_subject,p_division,'mcq') then raise exception 'branch_not_included';end if;
 select * into a from public.timed_mock_attempts where user_id=auth.uid() and subject=p_subject and division=p_division and submitted_at is null and expires_at>now() order by started_at desc limit 1;
 if not found then
 select * into s from public.subscription_plans where id=p.plan;
 if p.role<>'admin' and s.mock_exams<>-1 and p.quiz_attempts_used>=s.mock_exams then raise exception 'monthly_mock_allowance_used';end if;
 select array_agg(id) into ids from(select id from public.questions where lower(trim(subject))=lower(trim(p_subject)) and lower(trim(division))=lower(trim(p_division)) and type='mcq' order by random() limit p_count) q;
 if coalesce(array_length(ids,1),0)=0 then raise exception 'no_questions_found';end if;
 insert into public.timed_mock_attempts(user_id,subject,division,question_ids,expires_at) values(auth.uid(),p_subject,p_division,ids,now()+make_interval(secs=>array_length(ids,1)*50)) returning * into a;
 if p.role<>'admin' then update public.profiles set quiz_attempts_used=coalesce(quiz_attempts_used,0)+1 where id=p.id;end if;
 end if;
 select jsonb_agg(to_jsonb(q) order by array_position(a.question_ids,q.id)) into qs from public.questions q where q.id=any(a.question_ids);
 return jsonb_build_object('id',a.id,'expiresAt',a.expires_at,'questions',qs);
end;$$;
revoke all on function public.begin_timed_mock(text,text,integer) from public;
grant execute on function public.begin_timed_mock(text,text,integer) to authenticated;
create or replace function public.submit_timed_mock(p_attempt uuid,p_answers jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare a public.timed_mock_attempts%rowtype; points integer;total integer;
begin
 select * into a from public.timed_mock_attempts where id=p_attempt and user_id=auth.uid() for update;
 if not found then raise exception 'attempt_not_found';end if;
 if a.submitted_at is not null then return jsonb_build_object('score',a.score,'total',array_length(a.question_ids,1));end if;
 -- An expired browser cannot submit late answers; a short grace permits automatic timer submission.
 if now()>a.expires_at+interval '15 seconds' then p_answers:='{}'::jsonb;end if;
 select count(*) filter(where lower(trim(q.correct_answer))=lower(p_answers->>q.id::text)),count(*) into points,total from public.questions q where q.id=any(a.question_ids);
 update public.timed_mock_attempts set submitted_at=now(),score=points where id=a.id;
 insert into public.exam_results(user_id,test_title,score,total_questions,percentage) values(auth.uid(),a.division||' Mock Exam',points,total,round(points*100.0/greatest(total,1)));
 return jsonb_build_object('score',points,'total',total);
end;$$;
revoke all on function public.submit_timed_mock(uuid,jsonb) from public;
grant execute on function public.submit_timed_mock(uuid,jsonb) to authenticated;
revoke insert,update,delete on public.exam_results from authenticated;

-- Existing permissive policies cannot override restrictive boundaries.
do $$declare t text;begin
 foreach t in array array['question_explanations','teaching_conversations','teaching_attachments'] loop
  if to_regclass('public.'||t) is not null then
   execute format('drop policy if exists four_tier_paid_boundary on public.%I',t);
   execute format('create policy four_tier_paid_boundary on public.%I as restrictive for all to authenticated using(private.has_paid_access()) with check(private.has_paid_access())',t);
  end if;
 end loop;
end$$;
-- Direct room creation/status edits bypass the reservation RPC. Only trusted services/RPCs write rooms.
revoke insert,update,delete on public.live_class_sessions from authenticated;

create or replace function public.get_admin_financial_summary()
returns table (
  gross_subscription_revenue_ngn numeric,
  gross_topup_revenue_ngn numeric,
  voice_minutes_consumed numeric,
  text_teaching_credits_consumed numeric,
  active_premium_users bigint,
  retained_teaching_storage_bytes bigint,
  recordings_expiring_7d bigint,
  revenue_by_month jsonb,
  feature_usage jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then raise exception 'not_authorized'; end if;
  return query
  with months as (
    select to_char(date_trunc('month', now()) - (g.n || ' months')::interval, 'YYYY-MM') as month_key,
           date_trunc('month', now()) - (g.n || ' months')::interval as month_start,
           date_trunc('month', now()) - ((g.n - 1) || ' months')::interval as month_end
    from generate_series(0, 11) g(n)
  ), revenue as (
    select date_trunc('month', created_at) as month_start,
      sum(case when event_type = 'subscription_payment' then revenue_amount_ngn else 0 end) as subscription_revenue,
      sum(case when event_type = 'topup_payment' then revenue_amount_ngn else 0 end) as topup_revenue
    from public.billing_events
    where created_at >= date_trunc('month', now()) - interval '11 months'
    group by 1
  ), usage as (
    select
      coalesce(sum(case when event_type = 'voice_charge' then units else 0 end), 0) as voice_minutes,
      coalesce(sum(case when event_type = 'text_teaching_charge' then units else 0 end), 0) as text_credits
    from public.billing_events
  ), feature as (
    select coalesce(jsonb_object_agg(event_type, units), '{}'::jsonb) as breakdown
    from (
      select event_type, sum(coalesce(units, 0)) as units
      from public.billing_events
      where event_type in ('voice_charge', 'text_teaching_charge', 'monthly_grant')
      group by event_type
    ) grouped
  )
  select
    coalesce((select sum(subscription_revenue) from revenue), 0),
    coalesce((select sum(topup_revenue) from revenue), 0),
    usage.voice_minutes,
    usage.text_credits,
    (select count(*) from public.profiles where role <> 'admin' and plan in ('scholar','all_access','intensive') and (plan_expires_at is null or plan_expires_at > now())),
    coalesce((select sum(size_bytes)::bigint from public.teaching_attachments), 0),
    (select count(*) from public.teaching_conversations where recording_path is not null and recording_expires_at > now() and recording_expires_at <= now() + interval '7 days'),
    coalesce((select jsonb_agg(jsonb_build_object('month', months.month_key, 'subscriptions', coalesce(revenue.subscription_revenue, 0), 'topups', coalesce(revenue.topup_revenue, 0)) order by months.month_start desc) from months left join revenue using (month_start)), '[]'::jsonb),
    feature.breakdown
  from usage cross join feature;
end;
$$;

revoke all on function public.get_admin_financial_summary() from public;
grant execute on function public.get_admin_financial_summary() to authenticated;

-- All earlier RPC definitions mentioning obsolete plans are retired from user execution.
-- The replacements above are the only authoritative entitlement/payment implementations.
do $$declare r record;begin
 for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and pg_get_functiondef(p.oid) ~ '''(premium_monthly|premium_text_monthly|premium_3mo|premium_6mo|3mo|6mo|9mo|12mo)''' loop
  execute format('revoke execute on function %s from public,anon,authenticated',r.signature);
 end loop;
end$$;
-- Search RPCs must use the caller's question/content boundaries.
alter function public.search_question_bank(text,text,text,integer) security invoker;
alter function public.search_knowledge_chunks(text,text,integer) security invoker;
drop policy if exists four_tier_knowledge_read on public.knowledge_document_chunks;
create policy four_tier_knowledge_read on public.knowledge_document_chunks for select to authenticated using(private.has_paid_access());
grant select on public.knowledge_document_chunks to authenticated;
revoke all on public.question_explanations from authenticated,anon;

notify pgrst,'reload schema';
commit;
