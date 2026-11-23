-- The rivals' starting ratings once more, after they were pushed further (the user, 2026-11-24: more
-- scans and play, every rival past the Cyclops; lib/pvp/rivals.json `rating`, from their ten warm-up
-- battles). Only unplayed rivals move. To undo: nothing.

update public.pvp_ratings set rating = v.rating, updated_at = now()
from (values ('rival:blaze', 1016), ('rival:cinder', 1030), ('rival:dusk', 1014), ('rival:ember', 954),
             ('rival:frost', 940), ('rival:gale', 1045), ('rival:hollow', 1001)) as v (id, rating)
where public.pvp_ratings.id = v.id and public.pvp_ratings.games = 0;
