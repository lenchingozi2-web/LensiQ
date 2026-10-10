-- Automatically close stale/current Live Class sessions before reserving a new one.
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

  if v_role = 'admin' then
    update public.live_class_sessions
    set status = 'ended',
        ended_at = coalesce(ended_at, v_now)
    where user_id = v_user_id
      and status = 'active';

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
    update public.live_class_sessions
    set status = 'ended',
        ended_at = coalesce(ended_at, v_now)
    where user_id = v_user_id
      and status = 'active';

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

commit;
