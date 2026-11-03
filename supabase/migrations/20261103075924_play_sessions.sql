-- One game at a time per account (docs/design.md §12, lib/online/playSession.ts): which browser
-- tab is playing each account. Tapping Play claims it; a game on any other device hears the
-- change (Realtime) and goes back to its title screen.
-- To undo: drop table public.play_sessions;

create table public.play_sessions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  session text not null check (char_length(session) <= 64),
  claimed_at timestamptz not null default now()
);

-- The server's clock, not the device's, says when it was claimed.
create function public.play_sessions_stamp() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.claimed_at := now();
  return new;
end;
$$;

create trigger play_sessions_stamp before insert or update on public.play_sessions
  for each row execute function public.play_sessions_stamp();

-- Row Level Security: each player sees and changes only their own.
alter table public.play_sessions enable row level security;

create policy "Players read their own play session"
  on public.play_sessions for select
  using (auth.uid() = user_id);

create policy "Players claim their own play session"
  on public.play_sessions for insert
  with check (auth.uid() = user_id);

create policy "Players move their own play session"
  on public.play_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Signed-in players only.
revoke all on public.play_sessions from anon;

-- Realtime: so the other device hears the claim straight away.
alter publication supabase_realtime add table public.play_sessions;
