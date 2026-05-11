alter table public.legislative_votes
  add column if not exists source_chamber text not null default 'cdep'
    check (source_chamber in ('cdep', 'senate'));

alter table public.legislative_votes
  drop constraint if exists legislative_votes_source_vote_id_key;

create unique index if not exists legislative_votes_source_unique_idx
  on public.legislative_votes (source_chamber, source_vote_id);

create table if not exists public.legislative_import_runs (
  id uuid primary key default gen_random_uuid(),
  source_chamber text not null check (source_chamber in ('cdep', 'senate')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'success', 'failed')),
  votes_seen integer not null default 0 check (votes_seen >= 0),
  positions_seen integer not null default 0 check (positions_seen >= 0),
  questions_seen integer not null default 0 check (questions_seen >= 0),
  error text
);

create index if not exists legislative_import_runs_started_idx
  on public.legislative_import_runs (started_at desc);

alter table public.legislative_import_runs enable row level security;
