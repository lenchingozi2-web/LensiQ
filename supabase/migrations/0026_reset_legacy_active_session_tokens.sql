begin;

-- The previous implementation stored a browser-visible token that could become
-- stale or disappear independently of the Supabase session. Reset those legacy
-- values before the reliable HttpOnly token flow is enabled. Existing users stay
-- signed in; their next successful login establishes the new active session.
update public.profiles
set session_token = null
where session_token is not null;

commit;
