begin;

create or replace function public.ensure_user_profile(p_name text default null, p_email text default null)
returns setof public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    return;
  end if;

  insert into public.profiles (
    id,
    name,
    email,
    role,
    plan,
    plan_duration,
    ai_teachings_used,
    ai_explanations_used,
    quiz_attempts_used,
    voice_minutes_balance,
    text_teaching_balance,
    storage_limit_bytes
  )
  values (
    v_user_id,
    nullif(trim(p_name), ''),
    nullif(trim(p_email), ''),
    'user',
    'free',
    0,
    0,
    0,
    0,
    0,
    0,
    104857600
  )
  on conflict (id) do nothing;

  return query
    select p.*
    from public.profiles p
    where p.id = v_user_id;
end;
$$;

revoke all on function public.ensure_user_profile(text, text) from public;
grant execute on function public.ensure_user_profile(text, text) to authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    name,
    email,
    role,
    plan,
    plan_duration,
    ai_teachings_used,
    ai_explanations_used,
    quiz_attempts_used,
    voice_minutes_balance,
    text_teaching_balance,
    storage_limit_bytes
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email,
    'user',
    'free',
    0,
    0,
    0,
    0,
    0,
    0,
    104857600
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public;

do $$
begin
  if to_regclass('auth.users') is not null
     and not exists (
       select 1
       from pg_trigger
       where tgname = 'on_auth_user_created_create_profile'
         and tgrelid = 'auth.users'::regclass
     ) then
    create trigger on_auth_user_created_create_profile
      after insert on auth.users
      for each row execute function public.handle_new_auth_user();
  end if;
end;
$$;

commit;
