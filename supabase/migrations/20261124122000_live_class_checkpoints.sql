alter table public.live_class_lessons
  add column if not exists session_memory_json jsonb not null default '{"recent_questions":[],"taught_titles":[]}'::jsonb,
  add column if not exists delivered_checkpoint_json jsonb;
