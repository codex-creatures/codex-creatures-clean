# Back views, 2026-11 redo

Your creature in a fight, seen over its RIGHT shoulder as it faces the foe (upper right).
Three-quarter rear view, turned away from us towards the upper right. Near side = its right
side (largest); far side = its left (hidden, at most an edge peeks out). No face, eyes, chest
or belly. The 13 approved backs in public/sprites/creatures/back/ set the family look.

- `<id>/src.png`: the front sprite flipped to face right (as in a fight), padded.
- `<id>/c<n>.png`: candidates, in order. `finals/<id>.png`: passed by the reviewer.
- `sheets/<id>.md`: the visibility sheet and the prompt used.
- `jobs.tsv`: every PixelLab job, candidate by candidate (id, candidate, job, notes). `status.json`:
  the picked candidate for each. 33 creatures took 252 generations (2026-11-27).
- The picked ones are copied, trimmed, into public/sprites/creatures/back/ and listed in
  `BACK_SIZES` (lib/sprites/creatures.ts). Two have a scripted fix after PixelLab (see jobs.tsv):
  aurelius (far forearm clipped), gravewarden (shield bars recoloured to leather).

## Round 2 standard (the user, 2026-11-27)
Approved as best: gloom_gnome, gleamling, gutsnout, troglodyte_brute. Rejected for wrong proportions:
flicker_wisp, veilstalker, the_watcher, rattlebones, shambler, leafblade_scout, plague_rat,
pale_rider, skinwing, klutz (eyes and ears), labyrinth_sprite. What the good ones do:
- The body is truly TURNED AWAY: it points into the screen, turned only a little to the right. Do
  NOT keep the side view's silhouette or stride with just the torso turned.
- Legs and feet are seen from behind: side by side under the body, planted (a stride shows as one
  foot slightly lower/nearer, not a sideways scissor). Fliers fly away into the screen, wings out
  to both sides.
- The head keeps its size relative to the body (no shrunk heads); big ears/eyes stay big.
- A held weapon sits on the right side.
