revoke execute on function public.reserve_live_class_session(text, text, uuid) from public;
revoke execute on function public.reserve_live_class_session(text, text, uuid) from anon;
grant execute on function public.reserve_live_class_session(text, text, uuid) to authenticated;
alter function public.reserve_live_class_session(text, text, uuid) set search_path = public;
