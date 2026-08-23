begin;

create or replace function public.enforce_teaching_storage_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_limit bigint;
  v_used bigint;
begin
  select role, storage_limit_bytes into v_role, v_limit from public.profiles where id = new.user_id;
  if v_role = 'admin' then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text || ':teaching-storage', 0));
  select coalesce(sum(size_bytes), 0)::bigint into v_used from public.teaching_attachments where user_id = new.user_id;
  if v_used + new.size_bytes > coalesce(v_limit, 104857600) then raise exception 'teaching_storage_limit_exceeded'; end if;
  return new;
end;
$$;

drop trigger if exists teaching_attachments_storage_limit_trigger on public.teaching_attachments;
create trigger teaching_attachments_storage_limit_trigger
before insert on public.teaching_attachments
for each row execute function public.enforce_teaching_storage_limit();

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
    (select count(*) from public.profiles where role <> 'admin' and plan in ('premium_monthly', '3mo', '6mo', '9mo', '12mo') and (plan_expires_at is null or plan_expires_at > now())),
    coalesce((select sum(size_bytes)::bigint from public.teaching_attachments), 0),
    (select count(*) from public.teaching_conversations where recording_path is not null and recording_expires_at > now() and recording_expires_at <= now() + interval '7 days'),
    coalesce((select jsonb_agg(jsonb_build_object('month', months.month_key, 'subscriptions', coalesce(revenue.subscription_revenue, 0), 'topups', coalesce(revenue.topup_revenue, 0)) order by months.month_start desc) from months left join revenue using (month_start)), '[]'::jsonb),
    feature.breakdown
  from usage cross join feature;
end;
$$;

revoke all on function public.get_admin_financial_summary() from public;
grant execute on function public.get_admin_financial_summary() to authenticated;

commit;
