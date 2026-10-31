-- Leaderboards (docs/design.md §12), shown at the Den's quest board.
-- Each cloud save carries the player's numbers in `stats` (worked out by the game:
-- leaderboardStats in lib/leaderboard.ts): {species, runs: {"0": n, …}, wins: {"0": n, …}}.
-- Players never read other saves: they call leaderboard(), which ranks everyone by one board
-- and shows only their names (never emails).
-- Seasons: the user starts a new one by running `select public.start_season();` in the SQL
-- editor. It notes everyone's numbers at that moment, and runs and wins count from there.
-- Species aren't reset: they're your collection.
-- To undo: drop function public.leaderboard(text), public.start_season(), public.leaderboard_int(text);
--   drop table public.leaderboard_baselines, public.leaderboard_seasons;
--   alter table public.cloud_saves drop column stats;

alter table public.cloud_saves add column stats jsonb check (stats is null or pg_column_size(stats) <= 2000);

create table public.leaderboard_seasons (
  id serial primary key,
  started_at timestamptz not null default now()
);

create table public.leaderboard_baselines (
  season integer not null references public.leaderboard_seasons (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  stats jsonb not null,
  primary key (season, user_id)
);

-- Only the functions below get in.
alter table public.leaderboard_seasons enable row level security;
alter table public.leaderboard_baselines enable row level security;
revoke all on public.leaderboard_seasons from anon, authenticated;
revoke all on public.leaderboard_baselines from anon, authenticated;

-- The first season starts now.
insert into public.leaderboard_seasons default values;

-- A count from a save's stats (anything that isn't a sensible whole number counts as 0).
create function public.leaderboard_int(v text) returns integer
language sql immutable set search_path = '' as $$
  select case when v ~ '^[0-9]{1,9}$' then v::integer else 0 end;
$$;

-- One board for a signed-in player: {season, startedAt, top: [{rank, name, value, me}], me: {rank, value} | null}.
-- board: 'species', or 'runs:<dungeon>' / 'wins:<dungeon>' (dungeons 0–3).
-- Only named players with more than 0 are ranked; equal numbers share a rank.
create function public.leaderboard(board text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  kind text := split_part(board, ':', 1);
  dungeon text := split_part(board, ':', 2);
  season_id integer;
  season_start timestamptz;
  result jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in to see the leaderboards'; end if;
  if board is null or board !~ '^(species|(runs|wins):[0-3])$' then raise exception 'No such leaderboard'; end if;
  select s.id, s.started_at into season_id, season_start from public.leaderboard_seasons s order by s.id desc limit 1;

  with scores as (
    select c.user_id, p.name,
      case when kind = 'species' then public.leaderboard_int(c.stats ->> 'species')
        else greatest(0, public.leaderboard_int(c.stats -> kind ->> dungeon)
                       - public.leaderboard_int(b.stats -> kind ->> dungeon)) end as value
    from public.cloud_saves c
    join public.profiles p on p.id = c.user_id
    left join public.leaderboard_baselines b on b.season = season_id and b.user_id = c.user_id
    where c.stats is not null
  ), ranked as (
    select user_id, name, value, rank() over (order by value desc) as place
    from scores where value > 0
  )
  select jsonb_build_object(
    'season', season_id,
    'startedAt', season_start,
    'top', coalesce((select jsonb_agg(jsonb_build_object('rank', place, 'name', name, 'value', value, 'me', user_id = auth.uid()) order by place, name)
                     from (select * from ranked order by place, name limit 50) t), '[]'::jsonb),
    'me', (select jsonb_build_object('rank', place, 'value', value) from ranked where user_id = auth.uid())
  ) into result;
  return result;
end;
$$;

-- A new season: everyone's numbers now are where runs and wins count from. For the user only
-- (the SQL editor); players can't call it.
create function public.start_season() returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  season_id integer;
begin
  insert into public.leaderboard_seasons default values returning id into season_id;
  insert into public.leaderboard_baselines (season, user_id, stats)
    select season_id, c.user_id, c.stats from public.cloud_saves c where c.stats is not null;
  return season_id;
end;
$$;

revoke execute on function public.leaderboard_int(text) from public, anon, authenticated;
revoke execute on function public.start_season() from public, anon, authenticated;
revoke execute on function public.leaderboard(text) from public, anon;
grant execute on function public.leaderboard(text) to authenticated;
