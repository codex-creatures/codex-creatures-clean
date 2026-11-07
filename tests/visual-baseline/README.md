# Visual baseline of the walkable dungeons

Screenshots of the walk view, for comparing by eye before and after each phase of the world
architecture (docs/world-spec.md §8). They're references, not automated pixel tests: the
torchlight flickers, so two shots of the same scene are never identical to the pixel.

`phase0/` was taken on 2026-11-07 from the code as it was before phase 1 (the user's one-off
exception to the no-browser rule, run locally on a scratch port, nothing deployed).

## The scenes (`app/lab/baseline`, `?s=<scene>`)

Each is a saved run from `tests/fixtures/walk/`, with you stood at a chosen spot and the view
frozen (busy), so nothing moves. "Seen all": every tile shows as seen (dim where your torch isn't).

| Scene | What it shows |
|---|---|
| enc-entrance | the Encampment's entrance at the start: wall torches, the dark |
| enc-midrun | part-way, as saved: rubble behind, torches lit, what you've seen |
| enc-midrun-decor | the same, with the lab's decor |
| enc-scroll | the scroll part-way (red lines across the fallen tunnels) |
| enc-pillar | beside a lone pillar (seen all) |
| enc-foes | just below a room's foes, by torchlight (seen all) |
| enc-south-wall | on a room's bottom row, the south wall see-through (seen all) |
| enc-chief | below the chief: his cages, the pillars down the sides (seen all) |
| enc-campfire | by a campfire (seen all) |
| enc-candle | by a lit candle (seen all) |
| enc-before-pillars | a run from before pillars (bigger rooms), as saved |
| cyc-midrun | the Cyclops's dungeon part-way, as saved |
| cyc-boss | below the Cyclops waiting at the top (seen all) |
| cyc-witch | below the card witch (seen all) |
| cyc-pool | a healing pool (seen all) |
| cyc-large | the large room (seen all) |

## Taking them again

Only with the user's OK (the no-browser rule), locally, never on the user's addresses:

1. `npx next build`, then `npx next start -p 3123` (a scratch port; the dev server on 3000 keeps
   its own build folder).
2. For each scene, with Edge headless and a throwaway profile:
   `msedge --headless=new --disable-gpu --hide-scrollbars --no-first-run --user-data-dir=<temp>
   --window-size=390,693 --virtual-time-budget=6000 --screenshot=<dir>/<scene>.png
   "http://localhost:3123/lab/baseline?s=<scene>"`
3. Stop the scratch server.

Put each phase's shots in their own folder (`phase1/`…) beside `phase0/` and compare.
