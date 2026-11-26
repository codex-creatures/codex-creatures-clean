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
