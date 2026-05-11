create table if not exists public.legislative_votes (
  id text primary key,
  source_vote_id text not null unique,
  voted_at date not null,
  bill_number text not null default '',
  title text not null,
  vote_type text not null default 'vot final',
  source_url text not null,
  total_for integer not null default 0 check (total_for >= 0),
  total_against integer not null default 0 check (total_against >= 0),
  total_abstain integer not null default 0 check (total_abstain >= 0),
  total_present integer not null default 0 check (total_present >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.legislative_party_positions (
  id text primary key,
  vote_id text not null references public.legislative_votes(id) on delete cascade,
  party_key text not null,
  party_label text not null,
  stance text not null check (stance in ('for', 'against', 'abstain')),
  vote_count integer not null check (vote_count >= 0),
  party_present_count integer not null check (party_present_count > 0),
  majority_share numeric(6, 4) not null check (majority_share > 0.5 and majority_share <= 1),
  unique (vote_id, party_key)
);

create table if not exists public.legislative_questions (
  id text primary key,
  vote_id text not null references public.legislative_votes(id) on delete cascade,
  target_party text not null,
  target_stance text not null check (target_stance in ('for', 'against', 'abstain')),
  prompt_ro text not null,
  prompt_en text,
  active boolean not null default false,
  review_status text not null default 'needs_review' check (review_status in ('approved', 'needs_review', 'rejected')),
  interesting boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vote_id, target_party, target_stance)
);

create table if not exists public.vote_guesses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  question_id text not null references public.legislative_questions(id) on delete restrict,
  actual_party text not null,
  guessed_party text not null,
  correct boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists legislative_votes_voted_at_idx
  on public.legislative_votes (voted_at desc);

create index if not exists legislative_questions_review_idx
  on public.legislative_questions (active, interesting, review_status);

create index if not exists legislative_party_positions_vote_idx
  on public.legislative_party_positions (vote_id, stance);

create index if not exists vote_guesses_created_at_idx
  on public.vote_guesses (created_at desc);

drop trigger if exists legislative_votes_touch_updated_at on public.legislative_votes;
create trigger legislative_votes_touch_updated_at
before update on public.legislative_votes
for each row
execute function public.touch_updated_at();

drop trigger if exists legislative_questions_touch_updated_at on public.legislative_questions;
create trigger legislative_questions_touch_updated_at
before update on public.legislative_questions
for each row
execute function public.touch_updated_at();

alter table public.legislative_votes enable row level security;
alter table public.legislative_party_positions enable row level security;
alter table public.legislative_questions enable row level security;
alter table public.vote_guesses enable row level security;
