# The walkable Labyrinth: layout generation

Authoritative for how a walkable run's rooms, tunnels and pillars are rolled (`lib/dungeon/layout.ts`, `interior.ts`). What happens in the rooms is in [walkable-play.md](walkable-play.md); what's placed in them, technically, in [world/placement.md](../world/placement.md). Part of the [game design index](../design.md); status tags (✅ 📌 🧪 ❓ ⏸ ✗) are explained in [docs/README.md](../README.md#status-tags). **The code is the truth for numbers:** if this file and a constant disagree, trust the code and fix this file.

Moved here word for word from design.md on 2026-11-09 (the original is in [archive/2026-11-09](../archive/2026-11-09/design.md)); section numbers are kept, so references like "design.md §N" still find their place.

## 1. Layout, in layers

1. ✅ **Layout, in layers** (the user's sketches, 2026-11-05: [room 1](../ideas/room-1.png),
[gen roll 1–4](../ideas/gen-roll-1.png); `lib/dungeon/layout.ts`, walked in `/lab/walk`). The
layout comes first and the scroll is made from it (`layoutMap`), not the other way round.
- **Sizes in blocks** (`BLOCK`): room sizes, places and gaps are all whole blocks. A block
  was 3×3 tiles; **the walkable Encampment's are now 2×2** (the user, 2026-11-07: rooms felt
  too large and empty, walking them a chore; `WALK_SPEC.block`), so every room, gap and
  tunnel is two thirds the size while the layout's rules (in blocks) stay the same, and most
  rooms are about a screen across. Tunnels stay 3 tiles wide, so rooms need 3 blocks of
  wall in common for one (`minOverlap`). Shrinking the shapes instead was tried and broke
  the rules (no layout came out sound). **The walkable Labyrinth keeps 3** for now: at 2,
  30-room layouts mostly fail to roll (24 rooms roll in ~2 s), the user's call. Each layout
  keeps its block size (`Layout.block`; runs saved before have none, and were 3). A size is the footprint, walls included. The user's starting sizes, then made a bit
  wider (the user, 2026-11-05: bigger rooms will help later, some of them empty): small 6×5,
  wide 12×4, tall 5×10, big 10×6, the entrance 16×4, the boss's room 12×8 (`SHAPES`;
  provisional). And the **dog-leg** (the user, 2026-11-05): an L, an 11×4 and a 4×9 joined at
  a corner (11×9 overall), turned any of 4 ways (`cut`: the corner it lacks), as likely as a
  wide room.
- **Gen 1, rooms:** the entrance alone along the bottom, then rooms dropped in one by one,
  1–3 blocks of rock round each, **laid like bricks**: each as low as it'll go, within a
  block (`PACK_SLACK`) of that where it sits over the most rooms below, so rooms get more
  than one way up. The first row is always three rooms over the entrance (one hanging off
  each end, one between). `LAYOUT_W` 34 blocks across (the user, 2026-11-05: about **4 rooms
  across the middle**; staggered, so a band a room tall across the middle holds about 5).
  The boss's room on top, **in the middle** (the user, 2026-11-05: never off to one side,
  which limits the ways in; `BOSS_DRIFT` a block either way), as high as the highest room,
  and the top row is a room either side of it, level with it, so ways come in from both sides
  as well as below. A dog-leg is packed as its whole box (tunnels may cross its missing
  corner).
- **Gen 2, tunnels:** straight, **3 tiles wide** (the user: so you can get about), between
  rooms (any arm of a dog-leg) whose facing floors overlap enough for one, its side flush with
  a corner at most (`DOOR_INSET` 0, so a 2-block overlap does: rooms can sit over two below),
  across up to 6 blocks of rock (`MAX_REACH`; was 3: the user wanted longer tunnels too).
  **Twins** (the user, 2026-11-05): a second tunnel **up** into the same room, 30% of the time
  where one fits (`TWIN_CHANCE`), at least 3 blocks of rock from the first (`TWIN_PILLAR`),
  so the two look like they could lead to different rooms. Never sideways (a sideways move can
  be undone), and **a twin is never a choice**: two tunnels into one room are one decision.
  Everything is dug, then tunnels are dropped (off the shortest route till it's 7+ rooms,
  from rooms with more than 5, then up ones 20% and sideways 60% of the time:
  `UP_DROP_CHANCE`, `SIDE_DROP_CHANCE`, as going up is a lasting choice and there should be
  plenty) as long as it stays sound. So the most direct way isn't always there.
  (Twins about 0.4 a map, dog-legs about 1.)
- **Always a choice** (the user, 2026-11-05: keep the "do I go left or right here?"
  feeling; `fewChoices`): from every room but the boss's there are 2+ **different rooms**
  to go on to: up, or sideways into a room that leads on (one with a tunnel up, or on
  sideways again to one, never back the way you came). A dead end off to the side doesn't
  count, and the room it hangs off still needs 2 other ways on. A room that opens into the
  boss's is on its last step, and needn't have another.
- **No choke points** (the user, 2026-11-05: seed 1 had two rooms you had to go through;
  `routesToBoss`): **3 ways to the boss that share no room** (`ROUTES`), so no room, nor any
  two, can be in the way of every route. Hence the entrance leads to 3–4 rooms. Three
  separate ways of 7+ rooms need 18 rooms between the entrance and the boss, so the walkable
  Encampment has **19** (the user's pick, 2026-11-05, over a shorter minimum route or only 2
  separate ways). This changes the Encampment when it goes live (the scroll map's has 15).
- **Forward only** (the user, 2026-11-05): up tunnels are one way. Going up one draws a line
  along the bottom of the room you came into; a room wholly behind it (the one you left, for
  one) is closed, and every tunnel into it. Sideways tunnels go both ways, even into a room
  hanging partly behind the line. You never go back down an up tunnel below the line you've
  crossed, not even by sliding sideways first (the user confirmed, 2026-11-05).
- **Sound** (`routeProblems`, every roll is checked and rerolled if not): no traps (wherever
  you go, the boss can still be reached), every room reachable, the entrance leading to 3–4
  rooms, **3+ rooms leading into the boss** (`BOSS_WAYS`; the user, 2026-11-05: 2–3 at
  least), 5 tunnels a room at most, the shortest route 7+ rooms, always a choice, no choke
  points; and the tiles pass `checkFloorplan` (tunnels join exactly the rooms they should,
  twins counted). About 0.3 s a layout, 0.8 s at worst (most rolls fail fast; up to 3000
  tries). Sims: about 22 up and 13 sideways tunnels a map.
- (A first try laid the scroll map out on tiles and dug tunnels round the rooms: long and
  winding, too much walking. Deleted; `lib/dungeon/floorplan.ts` keeps only the tile types
  and `checkFloorplan`.)
- **Feel** (the user, 2026-11-05): hard to judge yet, with every room in sight and flat
  top-down boxes rather than the slightly 3D view of the future-dungeon picture. That comes
  with the art (step 5) and the scroll as minimap (step 6).
  So the lab has **darkness** (on by default, a button turns it off). **You explore by
  torchlight** (the user, 2026-11-06; `lib/dungeon/torch.ts`): the torch lights what it
  can reach in a straight line within `TORCH_RADIUS` (5.5 tiles 🧪; foes see 7, so one can
  spot you from the dark), walls blocking it, so you walk round a corner to see past it.
  What it's lit stays remembered, dimmer (`REMEMBERED`); you only walk where you've seen;
  foes show only while they're in the light. The light glows warm and flickers, fading to a
  cold dark (`torchGlow`; the colours are the lab's, 🧪).
- **Torches on the walls** (the user, 2026-11-06; `placeSconces`, numbers 🧪): sconces along
  rooms' top walls (one per `SCONCE_EVERY` 8 tiles of wall, at least one a room, never over
  a tunnel), the entrance's burning and `SCONCE_LIT_SHARE` 20% of the rest. Walk within half
  your torch's reach of an unlit one, in sight of it, and it lights (`canIgnite`); a burning
  one lights `SCONCE_RADIUS` 4 tiles round it for good (`sconceGlow`, a little dimmer than
  your torch), seen from up to 12 tiles away. PixelLab art in the walls' style (round 3, the kit's
  `lights`; a smaller one on a tunnel's side wall), with its flame drawn in code over it.
  > ⚠️ The original torch rule. New runs (world version 8) also get extra torches on rooms' side walls and pillars by each room's darkness: [world/placement.md](../world/placement.md#candles-and-extra-torches-world-versions-58).
- **No doors** (the user, 2026-11-06): it's a winding labyrinth. A tunnel closed off behind
  you is solid rock (`shutPlan`): if you'd seen it, it falls in as you go (stones drop,
  dust, a shake) and rubble blocks its mouth (`rubbleOf`); if you hadn't, it was never
  there. Only a tunnel up gets rubble (`showsRubble`): one across just becomes wall, on the
  scroll too, as if it was never there (the user, 2026-11-09). The rubble is drawn in code
  for now, a placeholder for PixelLab art.

## Size and guided rolling

(From step 7's "walkable Labyrinth" bullet in the original.)

**Now** (lib/dungeon/layout.ts): both walkable dungeons are rolled guided (`guided: true`) at
2-tile blocks (`BLOCK`): the Encampment as `WALK_SPEC` (19 rooms, a shortest route of
`CAMP_ROUTE`, no large room), the Cyclops as `WALK_LABYRINTH` (30 rooms, a shortest route of 10,
1 large room). These are the current settings, **not a fixed design constraint** (the user,
2026-11-09): guided rolling (below) makes bigger layouts quick, and a dungeon's size follows the
bench rule below. The scroll map's Labyrinth is 36 rooms, 15 to the lair. What follows is how the
size came to be held at 30, then the guided rolling that lifted the limit.

**Why it was held at 30 rooms** (2026-11-06, before guided rolling): the scroll map's Labyrinth is 36 rooms, 15 to the lair, but with
`ROUTES` (3) separate ways of 15 that needs 44+ rooms, and those layouts take ~15 s to
roll and mostly fail. `WALK_LABYRINTH` is 30 rooms, 10 to the lair, for now (rolls in
~1 s, 2 s at worst). **Why the big ones are slow** (measured, 2026-11-06): each try is
quick (10–20 ms), but rooms are packed first and checked after, and one bad room (mostly
at the edges, with only one room above in reach) throws the whole packing away: 7% of
19-room packings pass, 1% of 30, ~0% of 44. Tried and dropped, as both were slower than
rolling again: moving the bad rooms (the packing's too tight to find them better places),
and packing 30% extra rooms then taking the worst out (the gaps break their neighbours).
Pre-rolled seeds: not for now (the user). Next idea: build the layout so each room is
checked as it's placed.
✅ **Built 2026-11-09: guided rolling** (`rollRooms` with `guided`; both dungeons use it).
Each room goes where it gives the rooms below the ways up they still need (`GUIDE_UPS`),
never with nothing below it if it can help it; a room closed in short of ways on (nothing
more could land near enough above it; a room beside counts as a way, `SIDE_WAY`) has its
real tunnels counted, and if it's short, the last few rooms are taken up and placed again
(`BACK_STEP` 5, more each time it comes back; `BACKTRACKS` 400 at most); the top (the
boss's room and the two beside it) steps back the same way when it won't fit. Measured
(tests/layoutBench.test.ts, `npm run test:stress`, this PC): the Encampment 0.2 s a layout
(0.5 s at worst; 0.25 s and 2 s before); **the Cyclops at the Encampment's room size**
(2-tile blocks, the user, 2026-11-09: narrower rooms are more fun to explore) 0.4 s, 1.3 s
at worst (unguided, a third couldn't be rolled at all). Its large room keeps its shape in
blocks, so about two thirds of the size it was in tiles (the user: large rooms can be
large, needn't stay as large). Runs already made keep their layouts.
**The rule for a new dungeon's size** (`rooms`, `minRoute`, and `across`: rooms side by side
at the widest, which sets the width, `acrossW`), from the bench:
- **across ≥ 4**: three separate ways to the boss don't fit in 3 (3 wide failed even at
  a gentle route).
- **route × across ÷ rooms ≤ 1.33** rolls reliably and fast; about 1.5 works but slowly
  (5–15 s); 1.6 or more fails. So rooms ≥ route × across ÷ 1.33: 4 wide with a route of
  10 needs 30 rooms; **5 wide, route 15 needs about 56** (55 rolled in 2.7 s, 5 s at
  worst; 45 took minutes).
- **Time grows with rooms** at a good ratio: about 0.5 s at 30, 0.6 s at 45, 3 s at
  55–65, 7–10 s at 70–80 (worst about twice that; a phone perhaps 3× slower). Past ~60
  rooms a dungeon wants its layout rolled ahead of time, or in parts.
Rare tunnels that skip a row (the user: fine, for risk and reward): a tunnel may already
cross up to `MAX_REACH` blocks of rock, past a gap in the row between; nothing marks them
yet.

## Rooms' insides (pillars)

(From step 7 in the original.)

- **Rooms' insides** (the user, 2026-11-07: "fill the big rooms with structure, not
  objects"; `lib/dungeon/interior.ts`, rolled with the layout, `LayoutRoom.inner`): solid
  stone built in a room's floor, drawn like the walls (brick face, mossy cap), blocking
  light and sight, walked round. **Only the odd lone pillar** (the user, 2026-11-07: the walls
  were too obstructing; colonnades, alcoves and dividing walls are no longer rolled, though
  runs that rolled them keep them): 1–2 2×2 pillars (`PILLARS_MOST`) in some bigger rooms
  (`STYLES`, 🧪: 35–50% of wide, tall, big, dog-leg and large rooms; at the Encampment's
  size the wide ones are too narrow to take one), the boss's room pillars down both
  sides with its middle aisle clear (`AISLE`), small rooms and the entrance nothing. Always
  kept clear: a margin inside the walls (wall torches, cages), the doors, the room's middle
  (its chest, pool or stash), and every floor tile still reachable from every door; a piece
  that would break any of that is left out. Drawn like the walls for now (📌 the user wants
  pillar art that reads as a pillar).
