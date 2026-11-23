-- The rivals' starting ratings, re-seeded after the rivals were played through again with Klutz
-- (lib/pvp/rivals.json `rating`, from their ten warm-up battles; the user, 2026-11-24). Only the
-- ratings move: nobody has played them yet. To undo: nothing (the first migration's numbers are history).

update public.pvp_ratings set rating = v.rating, updated_at = now()
from (values ('rival:blaze', 1017), ('rival:cinder', 999), ('rival:dusk', 983), ('rival:ember', 1018),
             ('rival:frost', 941), ('rival:gale', 1045), ('rival:hollow', 997)) as v (id, rating)
where public.pvp_ratings.id = v.id and public.pvp_ratings.games = 0;
