-- Cloud saves (docs/design.md §12): each player's one online save, so it follows them between
-- devices. `save` is a save file (lib/saveFile.ts) without the barcode registry.
-- `revision` goes up by one on every write (the trigger below, so a device can't skip it): a
-- device only writes over the revision it last saw, so it can never overwrite a newer save
-- from another device by accident (lib/online/cloudSave.ts).
-- To undo: drop table public.cloud_saves; drop function public.cloud_saves_bump();

create table public.cloud_saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  save jsonb not null check (pg_column_size(save) <= 5000000),
  revision integer not null default 1,
  updated_at timestamptz not null default now()
);

create function public.cloud_saves_bump() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.revision := 1;
  else
    new.revision := old.revision + 1;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger cloud_saves_bump before insert or update on public.cloud_saves
  for each row execute function public.cloud_saves_bump();

-- Row Level Security: each player sees and changes only their own save.
alter table public.cloud_saves enable row level security;

create policy "Players read their own save"
  on public.cloud_saves for select
  using (auth.uid() = user_id);

create policy "Players create their own save"
  on public.cloud_saves for insert
  with check (auth.uid() = user_id);

create policy "Players update their own save"
  on public.cloud_saves for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Signed-in players only.
revoke all on public.cloud_saves from anon;
