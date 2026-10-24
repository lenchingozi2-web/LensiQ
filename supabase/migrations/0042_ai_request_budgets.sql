-- Atomic per-user and global minute budgets for paid AI provider calls.
-- Apply this migration before enabling AI routes.
create table if not exists public.ai_request_windows (
  window_start timestamptz not null,
  scope_key text not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (window_start, scope_key)
);

alter table public.ai_request_windows enable row level security;
revoke all on public.ai_request_windows from anon, authenticated;
grant all on public.ai_request_windows to service_role;

create or replace function public.reserve_ai_request(p_feature text)
returns table (allowed boolean, reason text, user_count integer, global_count integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_window timestamptz := date_trunc('minute', now());
  v_user_key text;
  v_global_key text;
  v_user_count integer;
  v_global_count integer;
  v_user_limit integer;
  v_global_limit integer;
begin
  if v_user_id is null then
    return query select false, 'unauthenticated'::text, 0, 0;
    return;
  end if;

  if p_feature not in ('teach', 'explain') then
    return query select false, 'invalid_feature'::text, 0, 0;
    return;
  end if;

  -- Conservative hard caps: maximum 6 calls/user/minute and 30 total/minute.
  v_user_limit := 6;
  v_global_limit := 30;
  v_user_key := 'user:' || v_user_id::text || ':' || p_feature;
  v_global_key := 'global:' || p_feature;

  -- Serialize all reservations for this feature's global minute bucket.
  perform pg_advisory_xact_lock(hashtextextended(v_global_key || ':' || v_window::text, 0));

  select request_count into v_global_count
    from public.ai_request_windows
    where window_start = v_window and scope_key = v_global_key;
  v_global_count := coalesce(v_global_count, 0);

  select request_count into v_user_count
    from public.ai_request_windows
    where window_start = v_window and scope_key = v_user_key;
  v_user_count := coalesce(v_user_count, 0);

  if v_global_count >= v_global_limit then
    return query select false, 'global_minute_limit'::text, v_user_count, v_global_count;
    return;
  end if;
  if v_user_count >= v_user_limit then
    return query select false, 'user_minute_limit'::text, v_user_count, v_global_count;
    return;
  end if;

  insert into public.ai_request_windows(window_start, scope_key, request_count)
    values (v_window, v_global_key, 1)
    on conflict (window_start, scope_key)
    do update set request_count = public.ai_request_windows.request_count + 1;
  insert into public.ai_request_windows(window_start, scope_key, request_count)
    values (v_window, v_user_key, 1)
    on conflict (window_start, scope_key)
    do update set request_count = public.ai_request_windows.request_count + 1;

  return query select true, null::text, v_user_count + 1, v_global_count + 1;
end;
$$;

revoke all on function public.reserve_ai_request(text) from public, anon;
grant execute on function public.reserve_ai_request(text) to authenticated;

-- Old minute buckets are harmless but periodically prune them.
delete from public.ai_request_windows where window_start < now() - interval '2 days';
