-- Ranked PvP (docs/design/online.md §12; the user, 2026-11-24): one ladder of players and the
-- seven simulated rivals (lib/pvp/rivals.json), rated by Elo (lib/pvp/elo.ts: start 1000, K 32).
-- The server works the ratings out itself from a match's result, so a player's copy can't
-- invent a rating (it can still invent a result: not hardened, as with the rest of PvP).
-- Every match's log is kept (pvp_matches, the last PVP_MATCHES_KEPT) for building a better AI later.
-- The rivals' daily round (each fights two others) is played by the first signed-in player to
-- open the PvP portal that day and posted once: pvp_rounds keeps the day.
-- To undo: drop function public.pvp_leaderboard(), public.ranked_result(text, text, text, text, jsonb),
--   public.rival_round(text, jsonb), public.pvp_elo(integer, integer, numeric);
--   drop table public.pvp_matches, public.pvp_rounds, public.pvp_ratings;

create table public.pvp_ratings (
  id text primary key,                                   -- a player's account id, or 'rival:<id>'
  user_id uuid references auth.users (id) on delete cascade,
  rival text,                                            -- the rival's id (lib/pvp/rivals.json)
  name text,                                             -- rivals only (players' names are in profiles)
  rating integer not null default 1000,
  games integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  updated_at timestamptz not null default now(),
  check ((user_id is null) <> (rival is null))
);

create table public.pvp_matches (
  id uuid primary key default gen_random_uuid(),
  played_at timestamptz not null default now(),
  kind text not null check (kind in ('ranked', 'round')),  -- a player against a rival, or the rivals' daily round
  a text not null references public.pvp_ratings (id),
  b text not null references public.pvp_ratings (id),
  format text not null,
  winner text not null check (winner in ('a', 'b', 'draw')),
  reason text not null default 'battle',                   -- battle, forfeit, gone
  a_before integer not null, a_after integer not null,
  b_before integer not null, b_after integer not null,
  reported_by uuid references auth.users (id) on delete set null,
  log jsonb check (log is null or pg_column_size(log) <= 80000)
);
create index pvp_matches_played_at on public.pvp_matches (played_at desc);

create table public.pvp_rounds (
  day text primary key,                                  -- 'YYYY-MM-DD' (UTC)
  played_by uuid references auth.users (id) on delete set null,
  played_at timestamptz not null default now()
);

-- Only the functions below get in.
alter table public.pvp_ratings enable row level security;
alter table public.pvp_matches enable row level security;
alter table public.pvp_rounds enable row level security;
revoke all on public.pvp_ratings from anon, authenticated;
revoke all on public.pvp_matches from anon, authenticated;
revoke all on public.pvp_rounds from anon, authenticated;

-- The rivals, at the ratings their ten warm-up battles left them (lib/pvp/rivals.json `rating`).
insert into public.pvp_ratings (id, rival, name, rating) values
  ('rival:blaze',  'blaze',  'Blaze',   984),
  ('rival:cinder', 'cinder', 'Cinder', 1030),
  ('rival:dusk',   'dusk',   'Dusk',    952),
  ('rival:ember',  'ember',  'Ember',   986),
  ('rival:frost',  'frost',  'Frost',   972),
  ('rival:gale',   'gale',   'Gale',   1044),
  ('rival:hollow', 'hollow', 'Hollow', 1032);

-- Elo: a's change from a match against b with score s (1 win, 0 loss, 0.5 draw), K 32.
create function public.pvp_elo(a integer, b integer, s numeric) returns integer
language sql immutable set search_path = '' as $$
  select round(32 * (s - 1 / (1 + power(10, (b - a) / 400.0))))::integer;
$$;

-- Both sides' ratings move; the match is kept (its log too), and only the last 2000 matches stay.
create function public.pvp_apply(kind text, a_id text, b_id text, fmt text, winner text, reason text, log jsonb, reporter uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  ra integer; rb integer; da integer; s numeric;
begin
  select rating into ra from public.pvp_ratings where id = a_id for update;
  select rating into rb from public.pvp_ratings where id = b_id for update;
  if ra is null or rb is null then raise exception 'Unknown contender'; end if;
  s := case winner when 'a' then 1 when 'b' then 0 else 0.5 end;
  da := public.pvp_elo(ra, rb, s);
  update public.pvp_ratings set rating = ra + da, games = games + 1, updated_at = now(),
    wins = wins + (winner = 'a')::integer, losses = losses + (winner = 'b')::integer, draws = draws + (winner = 'draw')::integer where id = a_id;
  update public.pvp_ratings set rating = rb - da, games = games + 1, updated_at = now(),
    wins = wins + (winner = 'b')::integer, losses = losses + (winner = 'a')::integer, draws = draws + (winner = 'draw')::integer where id = b_id;
  insert into public.pvp_matches (kind, a, b, format, winner, reason, a_before, a_after, b_before, b_after, reported_by, log)
    values (kind, a_id, b_id, fmt, winner, reason, ra, ra + da, rb, rb - da, reporter, log);
  delete from public.pvp_matches where id in (select id from public.pvp_matches order by played_at desc offset 2000);
  return jsonb_build_object('aBefore', ra, 'aAfter', ra + da, 'bBefore', rb, 'bAfter', rb - da);
end;
$$;
revoke execute on function public.pvp_apply(text, text, text, text, text, text, jsonb, uuid) from public, anon, authenticated;

-- A ranked match you played against a rival: result from your side ('win', 'loss', 'draw').
-- Returns {before, after, rival: {before, after}}.
create function public.ranked_result(rival text, format text, result text, reason text, log jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me text := auth.uid()::text;
  r jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in to play ranked'; end if;
  if result not in ('win', 'loss', 'draw') then raise exception 'No such result'; end if;
  if format !~ '^[0-9]v[0-9]-[a-z]+-[0-9]+(-scaled)?$' then raise exception 'No such format'; end if;
  if not exists (select 1 from public.pvp_ratings where id = 'rival:' || rival) then raise exception 'No such rival'; end if;
  insert into public.pvp_ratings (id, user_id) values (me, auth.uid()) on conflict (id) do nothing;
  r := public.pvp_apply('ranked', me, 'rival:' || rival, format, case result when 'win' then 'a' when 'loss' then 'b' else 'draw' end,
    coalesce(reason, 'battle'), log, auth.uid());
  return jsonb_build_object('before', r -> 'aBefore', 'after', r -> 'aAfter', 'rival', jsonb_build_object('before', r -> 'bBefore', 'after', r -> 'bAfter'));
end;
$$;
revoke execute on function public.ranked_result(text, text, text, text, jsonb) from public, anon;
grant execute on function public.ranked_result(text, text, text, text, jsonb) to authenticated;

-- The rivals' round for a day: [{a, b, format, winner, log}], a and b rival ids. The first to post a day
-- wins; later posts for it are refused (false). Each battle moves both rivals' ratings.
create function public.rival_round(day text, results jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  m jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if day !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or day > to_char(now() at time zone 'utc', 'YYYY-MM-DD') then raise exception 'No such day'; end if;
  if jsonb_typeof(results) <> 'array' or jsonb_array_length(results) > 20 then raise exception 'Bad round'; end if;
  begin
    insert into public.pvp_rounds (day, played_by) values (day, auth.uid());
  exception when unique_violation then
    return false;
  end;
  for m in select * from jsonb_array_elements(results) loop
    if (m ->> 'winner') not in ('a', 'b', 'draw') then raise exception 'Bad result'; end if;
    perform public.pvp_apply('round', 'rival:' || (m ->> 'a'), 'rival:' || (m ->> 'b'), coalesce(m ->> 'format', '?'), m ->> 'winner', 'battle', m -> 'log', auth.uid());
  end loop;
  return true;
end;
$$;
revoke execute on function public.rival_round(text, jsonb) from public, anon;
grant execute on function public.rival_round(text, jsonb) to authenticated;

-- The ladder: {top: [{rank, id, name, rating, games, ai, me}], me: {rank, rating, games} | null, rivals: [{id, rating}],
-- lastRound: 'YYYY-MM-DD' | null}. The top 50 of everyone who has played (rivals always count as having played);
-- the rivals' ratings on their own for matchmaking; the last day a rivals' round was posted.
create function public.pvp_leaderboard() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in to see the ladder'; end if;
  with contenders as (
    select r.id, coalesce(r.name, p.name, '?') as name, r.rating, r.games, r.rival is not null as ai, r.user_id = auth.uid() as me
    from public.pvp_ratings r
    left join public.profiles p on p.id = r.user_id
    where r.games > 0 or r.rival is not null
  ), ranked as (
    select *, rank() over (order by rating desc) as place from contenders
  )
  select jsonb_build_object(
    'top', coalesce((select jsonb_agg(jsonb_build_object('rank', place, 'id', id, 'name', name, 'rating', rating, 'games', games, 'ai', ai, 'me', me) order by place, name)
                     from (select * from ranked order by place, name limit 50) t), '[]'::jsonb),
    'me', (select jsonb_build_object('rank', place, 'rating', rating, 'games', games) from ranked where me),
    'rivals', coalesce((select jsonb_agg(jsonb_build_object('id', rival, 'rating', rating) order by rival) from public.pvp_ratings where rival is not null), '[]'::jsonb),
    'lastRound', (select max(day) from public.pvp_rounds)
  ) into result;
  return result;
end;
$$;
revoke execute on function public.pvp_leaderboard() from public, anon;
grant execute on function public.pvp_leaderboard() to authenticated;
