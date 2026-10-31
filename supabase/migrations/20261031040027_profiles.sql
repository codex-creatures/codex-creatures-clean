-- Players' profiles: the name each player picks after logging in (docs/design.md §12).
-- To undo: drop table public.profiles;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 16),
  created_at timestamptz not null default now()
);

-- Row Level Security: each player sees and changes only their own profile.
-- (Leaderboards will need other players' names; they'll get their own read rule then.)
alter table public.profiles enable row level security;

create policy "Players read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Players create their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Players rename themselves"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
