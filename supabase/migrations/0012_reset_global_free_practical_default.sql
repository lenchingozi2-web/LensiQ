update public.profiles
set selected_free_practical_branch = null
where role <> 'admin'
  and (plan is null or plan = 'free');
