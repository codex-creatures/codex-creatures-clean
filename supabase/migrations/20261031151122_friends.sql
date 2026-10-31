-- Friends (docs/design.md §12, PvP): a player adds someone from the leaderboards to their
-- friend list, and can challenge them to a duel from there. One-sided, like following: adding
-- someone doesn't put you on their list. The leaderboards now say each row's account id, so
-- a row can be added (ids are random and say nothing about the player).
-- To undo: drop function public.my_friends(); drop table public.friends;
-- and run the leaderboard() from 20261031122348_leaderboard_scans.sql again.

create table public.friends (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  friend_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

-- Each player sees and changes only their own list.
alter table public.friends enable row level security;
revoke all on public.friends from anon;

create policy "Players read their own friends"
  on public.friends for select
  using (auth.uid() = user_id);

create policy "Players add their own friends"
  on public.friends for insert
  with check (auth.uid() = user_id);

create policy "Players remove their own friends"
  on public.friends for delete
  using (auth.uid() = user_id);

-- Your friends with their names (profiles are private, so the names come through here).
create or replace function public.my_friends() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', f.friend_id, 'name', coalesce(p.name, '?')) order by p.name), '[]'::jsonb)
  from public.friends f
  left join public.profiles p on p.id = f.friend_id
  where f.user_id = auth.uid();
$$;

revoke execute on function public.my_friends() from public, anon;
grant execute on function public.my_friends() to authenticated;

-- The leaderboards, as before, with each row's account id.
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
  if board is null or board !~ '^(species|time|scans|(runs|wins):[0-3])$' then raise exception 'No such leaderboard'; end if;
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

revoke execute on function public.leaderboard(text) from public, anon;
grant execute on function public.leaderboard(text) to authenticated;
