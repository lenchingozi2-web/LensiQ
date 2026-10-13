begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ephemeral_class_materials',
  'ephemeral_class_materials',
  false,
  52428800,
  array['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']
)
on conflict (id) do update
set public = false, file_size_limit = 52428800;

drop policy if exists "Ephemeral class materials insert" on storage.objects;
create policy "Ephemeral class materials insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'ephemeral_class_materials'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Ephemeral class materials select" on storage.objects;
create policy "Ephemeral class materials select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'ephemeral_class_materials'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Ephemeral class materials delete" on storage.objects;
create policy "Ephemeral class materials delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'ephemeral_class_materials'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create or replace function public.cleanup_ephemeral_class_materials()
returns integer
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  deleted_count integer;
begin
  delete from storage.objects
  where bucket_id = 'ephemeral_class_materials'
    and created_at < now() - interval '2 hours';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.cleanup_ephemeral_class_materials() from public;
grant execute on function public.cleanup_ephemeral_class_materials() to service_role;

-- Free accounts receive a rolling monthly 30-minute allowance. The counter is
-- stored in profile metadata and changed only by the security-definer RPCs.
create or replace function public.reserve_live_class_session(
  p_room_name text,
  p_course_name text default 'Live Class',
  p_conversation_id uuid default null
)
returns table (
  allowed boolean, reason text, session_id uuid, used_sessions integer,
  max_sessions integer, max_duration_seconds integer, expires_at timestamptz,
  is_unlimited boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_session_id uuid;
  v_month text := to_char(now() at time zone 'UTC', 'YYYY-MM');
  v_used_seconds integer;
begin
  if v_user_id is null then
    return query select false, 'not_authenticated', null::uuid, 0, null::integer, 0, null::timestamptz, false;
    return;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':live-class-wallet', 0));
  select * into v_profile from public.profiles where id = v_user_id for update;
  if v_profile.role = 'admin' then
    insert into public.live_class_sessions (user_id, conversation_id, room_name, course_name)
      values (v_user_id, p_conversation_id, p_room_name, coalesce(nullif(trim(p_course_name), ''), 'Live Class'))
      returning id into v_session_id;
    return query select true, 'admin', v_session_id, null::integer, null::integer, null::integer, null::timestamptz, true;
    return;
  end if;
  if v_profile.plan in ('premium_monthly', '3mo', '6mo', '9mo', '12mo')
     and (v_profile.plan_expires_at is null or v_profile.plan_expires_at > now()) then
    if coalesce(v_profile.voice_minutes_balance, 0) <= 0 then
      return query select false, 'voice_balance_empty', null::uuid, null::integer, null::integer, 0, now(), false;
      return;
    end if;
    insert into public.live_class_sessions (user_id, conversation_id, room_name, course_name, voice_reserved_minutes)
      values (v_user_id, p_conversation_id, p_room_name, coalesce(nullif(trim(p_course_name), ''), 'Live Class'), v_profile.voice_minutes_balance)
      returning id into v_session_id;
    return query select true, 'premium_wallet', v_session_id, null::integer, null::integer, v_profile.voice_minutes_balance * 60, now() + make_interval(mins => v_profile.voice_minutes_balance), false;
    return;
  end if;
  v_used_seconds := case
    when v_profile.metadata->>'live_class_voice_month' = v_month
      then greatest(0, coalesce((v_profile.metadata->>'live_class_voice_seconds')::integer, 0))
    else 0
  end;
  if v_used_seconds >= 1800 then
    return query select false, 'free_allowance_empty', null::uuid, null::integer, 1, 0, (date_trunc('month', now() at time zone 'UTC') + interval '1 month') at time zone 'UTC', false;
    return;
  end if;
  insert into public.live_class_sessions (user_id, conversation_id, room_name, course_name)
    values (v_user_id, p_conversation_id, p_room_name, coalesce(nullif(trim(p_course_name), ''), 'Live Class'))
    returning id into v_session_id;
  return query select true, 'free_allowance', v_session_id, 0, 1, 1800 - v_used_seconds, (date_trunc('month', now() at time zone 'UTC') + interval '1 month') at time zone 'UTC', false;
end;
$$;

-- Extend the existing charge function's free branch without exposing a client
-- writable counter. Paid and admin behavior remains unchanged in 0022.
create or replace function public.charge_live_class_session(
  p_session_id uuid, p_duration_seconds integer default 0, p_end boolean default false
)
returns table (ok boolean, remaining_voice_minutes integer, should_end boolean, charged_minutes integer, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.live_class_sessions%rowtype;
  v_profile public.profiles%rowtype;
  v_target integer;
  v_delta integer;
  v_month text := to_char(now() at time zone 'UTC', 'YYYY-MM');
  v_used integer;
  v_remaining integer;
begin
  select * into v_session from public.live_class_sessions where id = p_session_id and user_id = v_user_id for update;
  if v_session.id is null then
    return query select false, 0, true, 0, 'session_not_found';
    return;
  end if;
  select * into v_profile from public.profiles where id = v_user_id for update;
  if v_profile.id is null then return query select false, 0, true, 0, 'not_authenticated'; return; end if;
  v_target := greatest(0, ceil(greatest(extract(epoch from (now() - v_session.started_at)), greatest(p_duration_seconds, 0)) / 60.0)::integer);
  v_delta := greatest(0, v_target - coalesce(v_session.voice_charged_minutes, 0));
  if v_profile.role = 'admin' then
    update public.live_class_sessions set voice_charged_minutes = v_target, status = case when p_end then 'ended' else status end, ended_at = case when p_end then coalesce(ended_at, now()) else ended_at end where id = p_session_id;
    return query select true, null::integer, false, v_target, 'admin_unmetered'; return;
  end if;
  if v_profile.plan in ('premium_monthly', '3mo', '6mo', '9mo', '12mo')
     and (v_profile.plan_expires_at is null or v_profile.plan_expires_at > now()) then
    v_delta := least(v_delta, greatest(v_profile.voice_minutes_balance, 0));
    update public.profiles set voice_minutes_balance = voice_minutes_balance - v_delta where id = v_user_id;
    v_remaining := greatest(0, v_profile.voice_minutes_balance - v_delta);
  else
    v_used := case when v_profile.metadata->>'live_class_voice_month' = v_month then coalesce((v_profile.metadata->>'live_class_voice_seconds')::integer, 0) else 0 end;
    v_used := least(1800, v_used + greatest(0, p_duration_seconds - coalesce(v_session.voice_charged_minutes, 0) * 60));
    update public.profiles set metadata = jsonb_set(jsonb_set(coalesce(metadata, '{}'::jsonb), '{live_class_voice_month}', to_jsonb(v_month)), '{live_class_voice_seconds}', to_jsonb(v_used)) where id = v_user_id;
    v_remaining := greatest(0, 1800 - v_used);
    v_delta := greatest(0, ceil((v_used - (v_used - greatest(0, p_duration_seconds - coalesce(v_session.voice_charged_minutes, 0) * 60))) / 60.0)::integer);
  end if;
  update public.live_class_sessions set voice_charged_minutes = voice_charged_minutes + v_delta, status = case when p_end or v_remaining = 0 then 'ended' else status end, ended_at = case when p_end or v_remaining = 0 then coalesce(ended_at, now()) else ended_at end where id = p_session_id;
  return query select true, ceil(v_remaining / 60.0)::integer, v_remaining = 0, v_session.voice_charged_minutes + v_delta, case when v_remaining = 0 then 'voice_balance_empty' else 'charged' end;
end;
$$;

revoke all on function public.reserve_live_class_session(text, text, uuid) from public;
grant execute on function public.reserve_live_class_session(text, text, uuid) to authenticated;
revoke all on function public.charge_live_class_session(uuid, integer, boolean) from public;
grant execute on function public.charge_live_class_session(uuid, integer, boolean) to authenticated;

commit;
