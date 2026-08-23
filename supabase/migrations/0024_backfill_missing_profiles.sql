begin;

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
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
  u.email,
  'user',
  'free',
  0,
  0,
  0,
  0,
  0,
  0,
  104857600
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
limit 10000;

commit;
