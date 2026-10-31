-- The global barcode registry (docs/design.md §12): the first scan of a barcode anywhere is
-- rolled here, on the server, and stored; everyone after gets that outcome.
-- Players never touch the tables: they call scan_barcode(), which looks a barcode up and, if it's
-- new, rolls and registers it. Who scanned it is not stored.
-- The roll follows registry_rules: a copy of REGISTRY_RULES (lib/barcodeRegistry.ts), written by
-- `npm run registry:rules` as a migration of its own. registry_roll() takes the same steps as
-- rollFromRules() there.
-- To undo: drop function public.scan_barcode(text), public.registry_roll(jsonb),
--   public.registry_pick(jsonb), public.registry_any(jsonb);
--   drop table public.barcode_registry, public.registry_rules;

create table public.barcode_registry (
  code text primary key check (code ~ '^[0-9]{6,20}(:[0-9]{1,2})?$'),
  outcome jsonb not null,
  registered_at timestamptz not null default now()
);

create table public.registry_rules (
  id smallint primary key default 1 check (id = 1),
  rules jsonb not null,
  updated_at timestamptz not null default now()
);

-- Row Level Security with no policies, and no grants: only scan_barcode() gets in.
alter table public.barcode_registry enable row level security;
alter table public.registry_rules enable row level security;
revoke all on public.barcode_registry from anon, authenticated;
revoke all on public.registry_rules from anon, authenticated;

-- A key of a {key: weight} object, at those weights.
create function public.registry_pick(weights jsonb) returns text
language plpgsql volatile set search_path = '' as $$
declare
  roll double precision;
  k text;
  w double precision;
begin
  select random() * sum(value::double precision) into roll from jsonb_each_text(weights);
  for k, w in select key, value::double precision from jsonb_each_text(weights) loop
    roll := roll - w;
    if roll < 0 then return k; end if;
  end loop;
  return k;
end;
$$;

-- Any one item of a list.
create function public.registry_any(list jsonb) returns text
language sql volatile set search_path = '' as $$
  select list ->> floor(random() * jsonb_array_length(list))::int;
$$;

-- One fresh outcome, shaped like BarcodeOutcome (lib/barcodeRegistry.ts).
create function public.registry_roll(rules jsonb) returns jsonb
language plpgsql volatile set search_path = '' as $$
declare
  pick text := public.registry_pick(rules -> 'odds');
  rarity text;
  lo int := (rules #>> '{gold,min}')::int;
  hi int := (rules #>> '{gold,max}')::int;
begin
  if pick = 'gold' then
    return jsonb_build_object('outcome', 'gold', 'amount', lo + floor(random() * (hi - lo + 1))::int);
  elsif pick = 'soul_stone' then
    return jsonb_build_object('outcome', 'soul_stone', 'stone', public.registry_any(rules -> 'soulStones'));
  elsif pick = 'creature' then
    rarity := public.registry_pick(rules -> 'rarity');
    return jsonb_build_object('outcome', 'creature', 'rarity', rarity,
      'creatureId', public.registry_any(rules -> 'creatures' -> rarity));
  elsif pick = 'consumable' then
    return jsonb_build_object('outcome', 'item', 'itemCategory', pick,
      'rarity', public.registry_pick(rules -> 'consumableRarity'));
  end if;
  rarity := public.registry_pick(rules -> 'rarity');
  if pick = 'weapon' then
    return jsonb_build_object('outcome', 'item', 'itemCategory', pick, 'rarity', rarity,
      'itemKey', public.registry_any(rules -> 'weapons'));
  elsif pick = 'armor' then
    return jsonb_build_object('outcome', 'item', 'itemCategory', pick, 'rarity', rarity,
      'armorKey', public.registry_any(rules -> 'armors'),
      'armorSlot', public.registry_any(rules -> 'armorSlots'));
  end if;
  return jsonb_build_object('outcome', 'item', 'itemCategory', pick, 'rarity', rarity);
end;
$$;

-- Look a barcode up for a signed-in player: {entry, registeredAt, first}. first: this call
-- registered it (nobody had scanned it before). Two first scans at the same moment: the
-- insert lets only one in, and the other gets that one's outcome.
create function public.scan_barcode(barcode text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  held jsonb;
  found_at timestamptz;
  rolled jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in to scan'; end if;
  if barcode is null or barcode !~ '^[0-9]{6,20}(:[0-9]{1,2})?$' then raise exception 'Not a barcode'; end if;

  select r.outcome, r.registered_at into held, found_at from public.barcode_registry r where r.code = barcode;
  if held is not null then
    return jsonb_build_object('entry', held, 'registeredAt', found_at, 'first', false);
  end if;

  select public.registry_roll(x.rules) into rolled from public.registry_rules x where x.id = 1;
  if rolled is null then raise exception 'The registry has no rules yet'; end if;

  insert into public.barcode_registry (code, outcome) values (barcode, rolled)
    on conflict (code) do nothing
    returning registered_at into found_at;
  if found_at is not null then
    return jsonb_build_object('entry', rolled, 'registeredAt', found_at, 'first', true);
  end if;

  select r.outcome, r.registered_at into held, found_at from public.barcode_registry r where r.code = barcode;
  return jsonb_build_object('entry', held, 'registeredAt', found_at, 'first', false);
end;
$$;

-- Only signed-in players may scan; the helpers are for scan_barcode alone.
revoke execute on function public.registry_pick(jsonb) from public, anon, authenticated;
revoke execute on function public.registry_any(jsonb) from public, anon, authenticated;
revoke execute on function public.registry_roll(jsonb) from public, anon, authenticated;
revoke execute on function public.scan_barcode(text) from public, anon;
grant execute on function public.scan_barcode(text) to authenticated;
