begin;

create table if not exists public.live_class_provider_health (
  provider_model text primary key check (length(provider_model) between 3 and 160),
  failure_count smallint not null default 0 check (failure_count between 0 and 8),
  last_status integer,
  cooldown_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.live_class_provider_health enable row level security;
revoke all on public.live_class_provider_health from anon, authenticated;
grant select, insert, update, delete on public.live_class_provider_health to service_role;

commit;
