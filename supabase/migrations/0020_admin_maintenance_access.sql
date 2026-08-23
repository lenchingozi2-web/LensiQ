begin;

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
  if not v_is_admin and auth.role() <> 'service_role' then raise exception 'admin_access_required'; end if;
  for v_record in
    select id, wallet_reset_at
    from public.profiles
    where plan in ('premium_monthly', '3mo', '6mo', '9mo', '12mo')
      and (plan_expires_at is null or plan_expires_at > now())
      and wallet_reset_at is not null
      and wallet_reset_at <= now()
    for update
  loop
    v_next := v_record.wallet_reset_at + interval '1 month';
    update public.profiles set voice_minutes_balance = 60, text_teaching_balance = 50, wallet_reset_at = v_next where id = v_record.id;
    insert into public.billing_events (user_id, event_type, units, metadata) values (v_record.id, 'monthly_grant', 110, jsonb_build_object('voice_minutes', 60, 'text_teaching_credits', 50, 'rollover', false));
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.reset_due_wallets() from public;
grant execute on function public.reset_due_wallets() to authenticated;
grant execute on function public.reset_due_wallets() to service_role;

create policy "Admins can read teaching conversations for maintenance"
  on public.teaching_conversations for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "Admins can update teaching conversations for maintenance"
  on public.teaching_conversations for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admins can delete expired recording objects"
  on storage.objects for delete
  using (bucket_id = 'live-class-recordings' and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

commit;
