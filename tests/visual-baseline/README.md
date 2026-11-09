# Visual baseline of the walkable dungeons

Screenshots of the walk view, for comparing by eye before and after each phase of the world
architecture (docs/world-spec.md §8). They're references, not automated pixel tests: the
torchlight flickers, so two shots of the same scene are never identical to the pixel.

`phase0/` was taken on 2026-11-07 from the code as it was before phase 1 (the user's one-off
exception to the no-browser rule, run locally on a scratch port, nothing deployed).

## The scenes (`app/lab/baseline`, `?s=<scene>`)

The page is never on the live site: it's shown by the dev server, or a local build made with
`LAB_BASELINE=1`; any other build makes it "not found" (app/lab/baseline/page.tsx).

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

1. `LAB_BASELINE=1 npx next build`, then `npx next start -p 3123` (a scratch port; the dev server
   on 3000 keeps its own build folder). Without LAB_BASELINE=1 a build makes the page "not found",
   as on the live site; the dev server always shows it.
2. For each scene, with Edge headless and a throwaway profile:
   `msedge --headless=new --disable-gpu --hide-scrollbars --no-first-run --user-data-dir=<temp>
   --window-size=390,693 --virtual-time-budget=6000 --screenshot=<dir>/<scene>.png
   "http://localhost:3123/lab/baseline?s=<scene>"`
3. Stop the scratch server.

Put each phase's shots in their own folder (`phase1/`…) beside `phase0/` and compare: by eye,
and by the average difference per colour channel. Retaking phase 0's scenes with the same build
gave 0.0–0.2 (torch flicker), so anything well above that is a real difference.

## Phase 1 (2026-11-07)

`phase1/` was shot from the phase-1 code (4f2cd52) the same way. Against `phase0/`: 0.00–0.50 on
average, but the phase-0 code itself, rebuilt and shot again the same day, differed from `phase0/`
by 0.05–0.47, so a fresh capture session alone moves the numbers that much (the torch glow's radius
flickers with the time a shot is taken). Shot side by side in one session, the phase-0 and phase-1
builds differed by 0.00–0.81, about as much as two shots of the same build (0.00–1.03), with every
pixel more than 24 levels off on a flame (wall torches, a candle, the campfire) and nowhere else.
So: no visual difference. Compare by shooting the old and new builds side by side in one session,
not against old shots alone.

## Comparing (2026-11-10)

`node scripts/shot-diff.mjs <folder-a> <folder-b>` prints each scene's average difference per
colour channel and the share of pixels more than 24 levels off. These scenes show only the walk
view (`WalkView`, `lib/render/`), so they check changes there, not the rest of the Labyrinth
screen: that's played through in tests/dungeonPage.test.tsx. Against `phase1/`, today's build
differs by 2–8 (and the scroll by 48), from the art approved since (kit E/F walls, the torch and
candle art, the new scroll), so shoot a new reference before the next walk-view change.
