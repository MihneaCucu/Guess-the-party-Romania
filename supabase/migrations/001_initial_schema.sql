create extension if not exists pgcrypto;

create table if not exists public.politicians (
  id text primary key,
  name text not null,
  slug text not null unique,
  party_key text not null,
  party_label text not null,
  chamber text not null check (chamber in ('Camera Deputatilor', 'Senat', 'Guvern', 'Parlamentul European')),
  constituency text not null,
  photo_url text not null,
  source_url text not null,
  active boolean not null default true,
  review_status text not null default 'needs_review' check (review_status in ('approved', 'needs_review', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  guess_count integer not null default 0 check (guess_count >= 0),
  best_streak integer not null default 0 check (best_streak >= 0)
);

create table if not exists public.guesses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  politician_id text not null references public.politicians(id) on delete restrict,
  actual_party text not null,
  guessed_party text not null,
  correct boolean not null,
  created_at timestamptz not null default now()
);

create table if not exists public.session_seen_politicians (
  session_id uuid not null references public.sessions(id) on delete cascade,
  politician_id text not null references public.politicians(id) on delete cascade,
  scope text not null default 'all' check (scope in ('all', 'Camera Deputatilor', 'Senat', 'Guvern', 'Parlamentul European')),
  seen_at timestamptz not null default now(),
  primary key (session_id, scope, politician_id)
);

create table if not exists public.party_aliases (
  id uuid primary key default gen_random_uuid(),
  raw_label text not null unique,
  party_key text not null,
  party_label text not null,
  created_at timestamptz not null default now()
);

create index if not exists politicians_active_review_idx
  on public.politicians (active, review_status, party_key);

create index if not exists guesses_created_at_idx
  on public.guesses (created_at desc);

create index if not exists guesses_actual_party_idx
  on public.guesses (actual_party);

create index if not exists guesses_politician_idx
  on public.guesses (politician_id);

create index if not exists session_seen_politicians_seen_at_idx
  on public.session_seen_politicians (seen_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists politicians_touch_updated_at on public.politicians;
create trigger politicians_touch_updated_at
before update on public.politicians
for each row
execute function public.touch_updated_at();

alter table public.politicians enable row level security;
alter table public.sessions enable row level security;
alter table public.guesses enable row level security;
alter table public.session_seen_politicians enable row level security;
alter table public.party_aliases enable row level security;

insert into public.party_aliases (raw_label, party_key, party_label)
values
  ('Grupul parlamentar al Partidului Social Democrat', 'PSD', 'PSD'),
  ('Grupul parlamentar al Partidului National Liberal', 'PNL', 'PNL'),
  ('Grupul parlamentar al Partidului Naţional Liberal', 'PNL', 'PNL'),
  ('Grupul parlamentar al Uniunii Salvati Romania', 'USR', 'USR'),
  ('Grupul parlamentar al Uniunii Salvați România', 'USR', 'USR'),
  ('Grupul parlamentar Alianta pentru Unirea Romanilor', 'AUR', 'AUR'),
  ('Grupul parlamentar Alianța pentru Unirea Românilor', 'AUR', 'AUR'),
  ('Grupul parlamentar AUR', 'AUR', 'AUR'),
  ('Grupul parlamentar POT', 'POT', 'POT'),
  ('Grupul parlamentar al Uniunii Democrate Maghiare din Romania', 'UDMR', 'UDMR'),
  ('Grupul parlamentar al Uniunii Democrate Maghiare din România', 'UDMR', 'UDMR'),
  ('Grupul parlamentar S.O.S. Romania', 'SOS', 'S.O.S.'),
  ('Grupul parlamentar PACE – Întâi România', 'PACE', 'PACE'),
  ('Senatori neafiliati', 'NEAFILIATI', 'Neafiliati'),
  ('Senatori neafiliați', 'NEAFILIATI', 'Neafiliati')
on conflict (raw_label) do update
set party_key = excluded.party_key,
    party_label = excluded.party_label;
