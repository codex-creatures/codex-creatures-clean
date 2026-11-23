-- Ranked results were refused (2026-11-23: two wins from the user's phone came back 400). The function's
-- `rival` argument shares its name with pvp_ratings' `rival` column, and Postgres refused to guess
-- ("column reference "rival" is ambiguous") in the check that the rival exists. Naming the argument
-- by its function (ranked_result.rival) settles it. Same body otherwise.
-- To undo: nothing (the old function was the same, minus the fix).

create or replace function public.ranked_result(rival text, format text, result text, reason text, log jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me text := auth.uid()::text;
  r jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in to play ranked'; end if;
  if result not in ('win', 'loss', 'draw') then raise exception 'No such result'; end if;
  if format !~ '^[0-9]v[0-9]-[a-z]+-[0-9]+(-scaled)?$' then raise exception 'No such format'; end if;
  if not exists (select 1 from public.pvp_ratings p where p.id = 'rival:' || ranked_result.rival) then raise exception 'No such rival'; end if;
  insert into public.pvp_ratings (id, user_id) values (me, auth.uid()) on conflict (id) do nothing;
  r := public.pvp_apply('ranked', me, 'rival:' || ranked_result.rival, format, case result when 'win' then 'a' when 'loss' then 'b' else 'draw' end,
    coalesce(reason, 'battle'), log, auth.uid());
  return jsonb_build_object('before', r -> 'aBefore', 'after', r -> 'aAfter', 'rival', jsonb_build_object('before', r -> 'bBefore', 'after', r -> 'bAfter'));
end;
$$;
