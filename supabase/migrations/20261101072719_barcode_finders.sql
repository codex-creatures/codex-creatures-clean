-- Who has found each barcode, so the altar can say "You're the 3rd to find this Code Cache"
-- (a treasure hunt for barcodes nobody has scanned). One row per player per barcode, so
-- asking again (a sealed cache retried, a find too rare for you yet) never counts twice.
-- Only scan_barcode() reads or writes it; players see just their own place.
-- Barcodes registered before this kept no finders: `untracked` counts their first finder.
-- To undo: run scan_barcode() from 20261031073552_barcode_registry.sql again, then
--   drop table public.barcode_finders; alter table public.barcode_registry drop column untracked;

create table public.barcode_finders (
  code text not null references public.barcode_registry (code) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  found_at timestamptz not null default clock_timestamp(),
  primary key (code, user_id)
);
create index barcode_finders_code_found on public.barcode_finders (code, found_at);

alter table public.barcode_finders enable row level security;
revoke all on public.barcode_finders from anon, authenticated;

alter table public.barcode_registry add column untracked smallint not null default 0;
update public.barcode_registry set untracked = 1;

-- Look a barcode up for a signed-in player: {entry, registeredAt, first, place}. first: this
-- call registered it (nobody had scanned it before). place: how many players had found it,
-- you included, when you first did (1 for the first). Two first scans at the same moment: the
-- insert lets only one in, and the other gets that one's outcome.
create or replace function public.scan_barcode(barcode text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  held jsonb;
  found_at timestamptz;
  rolled jsonb;
  is_first boolean := false;
  mine timestamptz;
  place int;
begin
  if auth.uid() is null then raise exception 'Sign in to scan'; end if;
  if barcode is null or barcode !~ '^[0-9]{6,20}(:[0-9]{1,2})?$' then raise exception 'Not a barcode'; end if;

  select r.outcome, r.registered_at into held, found_at from public.barcode_registry r where r.code = barcode;
  if held is null then
    select public.registry_roll(x.rules) into rolled from public.registry_rules x where x.id = 1;
    if rolled is null then raise exception 'The registry has no rules yet'; end if;

    insert into public.barcode_registry (code, outcome) values (barcode, rolled)
      on conflict (code) do nothing
      returning registered_at into found_at;
    if found_at is not null then
      held := rolled;
      is_first := true;
    else
      select r.outcome, r.registered_at into held, found_at from public.barcode_registry r where r.code = barcode;
    end if;
  end if;

  insert into public.barcode_finders (code, user_id) values (barcode, auth.uid())
    on conflict (code, user_id) do nothing;
  select f.found_at into mine from public.barcode_finders f where f.code = barcode and f.user_id = auth.uid();
  select r.untracked + count(*)::int into place
    from public.barcode_registry r join public.barcode_finders f on f.code = r.code
    where r.code = barcode and f.found_at <= mine
    group by r.untracked;

  return jsonb_build_object('entry', held, 'registeredAt', found_at, 'first', is_first, 'place', place);
end;
$$;

revoke execute on function public.scan_barcode(text) from public, anon;
grant execute on function public.scan_barcode(text) to authenticated;
