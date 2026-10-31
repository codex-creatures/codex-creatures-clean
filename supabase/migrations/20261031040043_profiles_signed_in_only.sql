-- Profiles are for signed-in players only: logged-out visitors can't even see the table.
-- To undo: grant select, insert, update, delete on public.profiles to anon;
revoke all on public.profiles from anon;
