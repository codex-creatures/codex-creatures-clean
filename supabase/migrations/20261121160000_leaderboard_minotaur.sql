-- The Minotaur's leaderboards ('runs:4', 'wins:4'): its dungeon is number 4 (lib/dungeon/run.ts
-- DungeonId; saves already held 0–3). Only the board names it accepts change.
-- To undo: run the leaderboard() from 20261031151122_friends.sql again.
create or replace function public.leaderboard(board text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  kind text := split_part(board, ':', 1);
  dungeon text := split_part(board, ':', 2);
  field text := case split_part(board, ':', 1) when 'time' then 'playTime' else 'scans' end;
  season_id integer;
  season_start timestamptz;
  result jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in to see the leaderboards'; end if;
  if board is null or board !~ '^(species|time|scans|(runs|wins):[0-4])$' then raise exception 'No such leaderboard'; end if;
  select s.id, s.started_at into season_id, season_start from public.leaderboard_seasons s order by s.id desc limit 1;

  with scores as (
    select c.user_id, p.name,
      case when kind = 'species' then public.leaderboard_int(c.stats ->> 'species')
        when kind in ('time', 'scans') then greatest(0, public.leaderboard_int(c.stats ->> field)
                                                      - public.leaderboard_int(b.stats ->> field))
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
    'top', coalesce((select jsonb_agg(jsonb_build_object('rank', place, 'id', user_id, 'name', name, 'value', value, 'me', user_id = auth.uid()) order by place, name)
                     from (select * from ranked order by place, name limit 50) t), '[]'::jsonb),
    'me', (select jsonb_build_object('rank', place, 'value', value) from ranked where user_id = auth.uid())
  ) into result;
  return result;
end;
$$;
