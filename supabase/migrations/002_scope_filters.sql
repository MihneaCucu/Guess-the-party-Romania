alter table public.politicians
  drop constraint if exists politicians_chamber_check;

alter table public.politicians
  add constraint politicians_chamber_check
  check (chamber in ('Camera Deputatilor', 'Senat', 'Guvern'));

alter table public.session_seen_politicians
  add column if not exists scope text not null default 'all';

alter table public.session_seen_politicians
  drop constraint if exists session_seen_politicians_scope_check;

alter table public.session_seen_politicians
  add constraint session_seen_politicians_scope_check
  check (scope in ('all', 'Camera Deputatilor', 'Senat', 'Guvern'));

alter table public.session_seen_politicians
  drop constraint if exists session_seen_politicians_pkey;

alter table public.session_seen_politicians
  add primary key (session_id, scope, politician_id);
