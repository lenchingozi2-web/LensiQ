begin;

create or replace function public.enforce_teaching_storage_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit bigint;
  v_used bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text || ':teaching-storage', 0));
  select storage_limit_bytes into v_limit from public.profiles where id = new.user_id;
  select coalesce(sum(size_bytes), 0)::bigint into v_used from public.teaching_attachments where user_id = new.user_id;
  if v_used + new.size_bytes > coalesce(v_limit, 104857600) then raise exception 'teaching_storage_limit_exceeded'; end if;
  return new;
end;
$$;

commit;
