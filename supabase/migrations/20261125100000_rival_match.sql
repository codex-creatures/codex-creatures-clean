-- After every ranked match a player plays, two random rivals fight each other too (the user, 2026-11-24:
-- "every time you play a battle, 2 random AI also battle, meaning that it continues to move"). The player's
-- machine plays it (lib/pvp/sideMatch.ts) and posts it here; it's kept as kind 'side' in pvp_matches. The
-- server takes one only just after a ranked match you reported (10 minutes), so the ladder can't be churned
-- from a console without playing (the rest of PvP isn't hardened either).
-- To undo: drop function public.rival_match(text, text, text, text, jsonb); put the kind check back to ('ranked', 'round').

alter table public.pvp_matches drop constraint pvp_matches_kind_check;
alter table public.pvp_matches add constraint pvp_matches_kind_check check (kind in ('ranked', 'round', 'side'));

-- One rival-against-rival match: a and b rival ids, winner from a's side. Returns pvp_apply's ratings.
-- (Every reference to an argument is qualified: ranked_result's `rival` once clashed with a column.)
create function public.rival_match(a text, b text, format text, winner text, log jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if rival_match.a = rival_match.b then raise exception 'A rival can''t fight itself'; end if;
  if rival_match.winner not in ('a', 'b', 'draw') then raise exception 'No such result'; end if;
  if rival_match.format !~ '^[0-9]v[0-9]-[a-z]+-[0-9]+(-scaled)?$' then raise exception 'No such format'; end if;
  if (select count(*) from public.pvp_ratings p where p.rival in (rival_match.a, rival_match.b)) <> 2 then raise exception 'No such rival'; end if;
  if not exists (select 1 from public.pvp_matches m where m.kind = 'ranked' and m.reported_by = auth.uid() and m.played_at > now() - interval '10 minutes') then
    raise exception 'Play a ranked match first';
  end if;
  return public.pvp_apply('side', 'rival:' || rival_match.a, 'rival:' || rival_match.b, rival_match.format, rival_match.winner, 'battle', rival_match.log, auth.uid());
end;
$$;
revoke execute on function public.rival_match(text, text, text, text, jsonb) from public, anon;
grant execute on function public.rival_match(text, text, text, text, jsonb) to authenticated;
