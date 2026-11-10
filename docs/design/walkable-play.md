# The walkable Labyrinth: playing a run

Authoritative for walking, the scroll, foes and fights, loot, cages, campfires, light, decor and the walkable art. Layout generation is in [walkable-layout.md](walkable-layout.md); runs as a whole (fees, mixes, bosses) in [labyrinth.md](labyrinth.md); the technical rules (placement, saves, versions, drawing) in the [world specification](../world-spec.md). Part of the [game design index](../design.md); status tags (✅ 📌 🧪 ❓ ⏸ ✗) are explained in [docs/README.md](../README.md#status-tags). **The code is the truth for numbers:** if this file and a constant disagree, trust the code and fix this file.

Moved here word for word from design.md on 2026-11-09 (the original is in [archive/2026-11-09](../archive/2026-11-09/design.md)); section numbers are kept, so references like "design.md §N" still find their place.

## Overview

- ✅ **An explorable Labyrinth** (picked up 2026-11-05; live, still growing), walked round in 2D top-down
pixel art like [ideas/future-dungeon-direction.png](../ideas/future-dungeon-direction.png), laid out
like the user's sketch [ideas/labyrinth-v2.png](../ideas/labyrinth-v2.png) (older notes in
history.md). Decided: 2D (not 3D), in the current web game (no engine switch); the procedural
randomness stays. ⚠️ Since 2026-11-10 a 3D renderer (Three.js, same web game) is being assessed;
the 2D view stays what the game draws until the user approves a move ([world/rendering.md](../world/rendering.md#48-the-3d-direction-the-user-2026-11-10)). **The Encampment first** (the user, 2026-11-05): 15 rooms (19 in the walkable one, `WALK_SPEC`: see Sound below), at least 7 to the
camp, made walkable end to end before the deeper dungeons. It was kept behind `/lab` until the
user switched it on: since 2026-11-06 it's live as "🔥 New" runs (step 7). Plan, one step at a time:

## 1. Layout

See [walkable-layout.md](walkable-layout.md).

## 2. Walking

2. ✅ **Walking** (`lib/dungeon/walk.ts`, in `/lab/walk`): tap a spot and you walk there by
the shortest way (`findPath`, diagonals allowed but never cutting a rock corner), through
floors, doors and tunnels only, and only where the forward rule lets you (`stepRule`:
closed rooms are dimmed, and an up tunnel can't be entered from the top). A tap anywhere you
can't walk (rock, the dark, somewhere cut off) walks you as close to it as you can get
(`walkToward`, the user 2026-11-06); a new tap mid-walk
finishes the step first. `WALK_SPEED` 6 tiles a second; the camera keeps you in the middle
but never shows past the edge (`cameraAt`). Zoomed in close so you explore rather than
oversee (the user, 2026-11-06): 15 tiles across the screen (the user's pick), whatever its
size, so a laptop shows what a phone does (the lab's Zoom tries 22, 15, 11, 9). The lab plays inside the
game's own phone screen (header, and the live Labyrinth's dock: Party, Bag, Scroll, Retreat;
Retreat, tapped twice, starts afresh), so its windows are sized as in the game. Speed, zoom and tap reach are provisional: the user judges them in the lab. No line or
square shows where you're walking: you just walk (the user, 2026-11-09).
**Press and hold, then drag** (the user, 2026-11-11; WalkView3D `HOLD_DRAG` 10 px 🧪, `useWalkPlay`
`holdAt`): once a held finger moves, you walk toward the floor under it, again as it moves (and as
the camera follows you, so a finger held near an edge keeps you walking that way); a drag never
opens things on the way. A plain tap is as before.
A **joystick** bottom right, above the dock (the user, 2026-11-09; `walkStick`, WalkView `Stick`):
held, you walk the way it points, a tile at a time snapped to the eight ways, sliding along
a wall you push into diagonally. Things are used by tapping them (the ✋ button was taken
out, the user, 2026-11-09). On a keyboard, WASD or the arrows walk (`keysPush`, two at once
a diagonal) and E uses what you're beside (`usableNear`: unopened things first). Tapping to
walk still works. 🧪
**Drawing order** (the user, 2026-11-09): things you walk over (a fight's sack, floor
candles) lie under everything standing, so you're always drawn over them; a mini boss's or
boss's chest is solid (you walk round it), as chests, cages and pools are.

## 3. What's in each room, and the scroll

3. ✅ **Gen 3, what's in each room** (`campMap` in layout.ts, labelled in `/lab/walk`): the
Encampment's mix exactly as in the live game, by the same code (`fillCamp`, map.ts, which the
scroll map uses too): the entrance (treasure on your first run), dens or a stash 30% of the
time, never two stashes joined by a tunnel, one hidden chest, at least one stash (up to 2
marked), the chief's camp in the boss's room. Filled from the bottom up. No mini bosses: the
live Encampment has none. Fights and pickups come with step 6.
- **The scroll** (the user, 2026-11-05; `scrollMarks`, the Scroll button in `/lab/walk`):
  looked at **twice a run** (`SCROLL_LOOKS`), it shows a mark where each room's middle
  is: its icon if you know what's there, else "?". Of the rooms and tunnels themselves it
  shows only what your torch has lit, drawn like a treasure map: lit floors and walls, your
  trail dotted, and a **red line across each tunnel up that fell in behind you this run** (not
  the tunnels across: the user, 2026-11-09)
  (`fallenSoFar`: closed with its mouth in a room still open, and you'd seen it, at any
  cut-off you've crossed; kept once you're further up. The user, 2026-11-07: not every closed
  tunnel behind you, which got spammy) (the cut-offs
  themselves, `cutOffY`, are kept by the game but not drawn: the user, 2026-11-06). It's as wide
  as the furthest walls, on a classic tea-stained scroll rolled at the top and bottom (PixelLab,
  cut nine ways round it, the map scrolling between the rolls: the user, 2026-11-09), zoomed out 10% for paper either side (`SCROLL_ROOM`, the user,
  2026-11-09), and scrolls up and down, opened at you. A **clairvoyance scroll** picks a
  room on it: that room's drawn in and marked, with the rooms joined to it (`foreseen`); a flare
  marks the rooms joined to yours. Never the unlit tunnels or room sizes, so you work the way up
  out yourself. You know the entrance, the camp, the rooms marked from the start (**3–4 in
  all**, the user 2026-11-05, `SCROLL_MARKS`: the 1–2 marked stashes, then dens; the live
  scroll marks 8 plus stashes) and rooms you've been in; the chest and unmarked stashes stay
  "?" till you've been in. Tap it to put it away.

## 4. Extras inside rooms (later)

4. **Gen 4, extras** like witches and healing pools sitting inside other rooms: later (the
user picked this, 2026-11-05: witches and pools stay rooms of their own for now, so the
walkable run matches the live balance first). Then scenery.

## 5. Art

5. Art (PixelLab): a dungeon tileset in the tavern image's style and a walking character.
That style is three-quarter top-down (floors from above, walls and furniture showing their
fronts), not isometric: the square grid, collision, paths and camera stay as they are; only
the drawing changes (wall fronts, and things lower on screen drawn over things above).
No engine switch for it (the user, 2026-11-05: keep building as we are; if an engine is
ever needed, Phaser could run in this web game for the dungeon alone, a new dependency to
ask about).
**Who walks** (the user, 2026-11-05): a hero character (the player, a human adventurer);
creatures appear only in fights. Samples first, the user picks.
- ✅ **Samples made (2026-11-06); the user picked the cloaked torchbearer (step 7)** (`/lab/walk` → Art, then Tiles and
  Hero to flick between them; ids in public/sprites/PIXELLAB.md, `lib/sprites/walk.ts`):
  two tilesets, "Mossy brick" (cobbles, grey brick wall faces, an earth tunnel floor) and
  "Ivy blocks" (dark flagstones, ivy-covered old blocks; its floor in the tunnels too), and
  two heroes, a hooded ranger and a torchbearer, each walking in 4 directions (6 frames;
  west is east mirrored). PixelLab's wall tilesets (16px, 25 tiles each). The heroes were
  too lanky to feel for (the user, 2026-11-06): the hero carries a torch, and three chunkier
  samples (standing only, no walk yet) are up for picking: a sturdy adventurer, a stout
  bearded delver, a small cloaked torchbearer, drawn at 3/4 size 🧪. The chosen one gets a
  walk; then darker, more dungeon-like tile samples.
- ✅ **Drawing** (`lib/dungeon/tileArt.ts`): the sheets are drawn on a grid half a tile off
  the floorplan's, each cell taking its tile from the four tiles round it (rock the upper
  terrain, walkable the lower; a walkable tile with rock right above is a wall's foot), so
  a wall shows its front face wherever it has floor below, coming down over half the floor's
  top row (you walk there, in front of it). Rock away from any floor stays black. Tunnel
  floor where a cell is all tunnel (doors count as the room). Things standing up (chests,
  rubble, foes, you) are drawn lowest on screen last (`drawOrder`). The hero faces the way
  they're mostly going (`facingOf`) and steps a walk cycle every 1.5 tiles (`STRIDE`, 🧪).
  3 cells in a whole map have no exact tile (inner corners where a wall steps down by a
  tunnel): the closest is drawn.
- 🚧 **One angle for everything** (the user, 2026-11-06: the flat tiles didn't match the
  hero's three-quarter angle, and it wasn't immersive). A PixelLab building kit (walls 2
  tiles tall, the same low top-down angle as the heroes; id in PIXELLAB.md), cut into its
  materials (`KitArt` in lib/sprites/walk.ts) and drawn in the reference picture's look:
  dark mossy flagstones, every north wall a tall brick face under a pale mossy cap standing
  in the rock above the floor (lit to its top: `FACE_ROWS`), side walls only their narrow
  tops, south walls a cap band over the floor's bottom row, the rest of the rock dark. Hero
  pixels the kit's size. "Kit: mossy dungeon", the lab's first Tiles choice; no side-face
  wobble in it (one fixed angle).
  ✅ **The walls since 2026-11-09: kit E, "dark fieldstone"** (the user's pick: the first kits
  were "far too orange", "too clean and too brick like… a factory wall"; wanted dark, dingy,
  random stone). 48 art pixels a tile (the walls' own size, `KitArt.size`; you and things stay
  at 32 a unit), crumbling grey-brown fieldstone under worn capstones, a mossy cobbled floor
  (one tile, its seams repaired), and corner pieces so a side wall's top turns into the back
  wall's cap and the south band as one L. Old kits still draw (butted corners).
  🧪 **Kit F, to try (2026-11-09):** kit E softened at the user's ask (the wall tops' trim stood
  out, and the floor met the walls in a hard line): the wall tops' stone toned to 75%
  (`CAP_TONE`), fading into the dark away from the floor (to 12% at the far edge: the user,
  "more natural"), and the floor shading into the walls at its edges, from two PixelLab inpaints
  of the floor (a wall above, a wall to the left) used as overlays (`KitArt.edges`), flipped
  for a wall below or to the right and drawn together, darkest winning, where two meet.
  Kit E is `WALK_TILES[1]`, to go back to. Next: small floor
  decorations to break up the repeat (the user: decorations, not scattered tile variants),
  then 5–6 variants of the wall panel (moss, vines, cracks). Creatures and items: the user's
  quality target is detailed pixel art about 128–200 px a portrait ("Creature or item pix
  quality" in their Downloads), when PixelLab spend allows; nothing redone till then.
- ✅ **Depth, 2.5D** (the user, 2026-11-06: not real 3D, which would need three.js and 3D
  models; ⚠️ 3D now being assessed, [world/rendering.md](../world/rendering.md#48-the-3d-direction-the-user-2026-11-10); `tileArt.ts`, numbers 🧪): side walls show their inner face, wider the further
  across the room you are (`sideFace`: from a room's right you see its left wall's face),
  and south walls stand up `WALL_LIFT` (half a tile) over the floor's bottom row, so you
  and foes can be hidden behind them; close behind one, it goes see-through (`capFade`).

## 6. Into the run (the lab)

6. Into the run: fights, chests, saving your spot, the scroll as minimap. (All in `/lab/walk`
so far, with an in-memory test team; nothing touches a save.)
- **Fights start by being seen** (the user, 2026-11-05): a room's foes stand in it, some
  still and some moving about. Each sees along a line of sight (walls block it); if any of
  them sees you, all of that room's foes fight you together. So a dog-leg can hide foes
  round its corner for a surprise. Built (2026-11-06; `lib/dungeon/foes.ts`; the lab's Cones
  button shows what each sees), the numbers all 🧪 (Claude's, for the user to judge):
  - **The foes** are the live room roll's (`lib/dungeon/walkRooms.ts`: `makeRoom` for the
    Encampment, so the same rarities, levels and gold), one marker each. Every room is rolled
    as the run starts, not as you walk in (you can see foes before you're through the door);
    a room's depth is counted forward as the live game does (`routeLength`), or by any
    route for a room only reached sideways (`roomDepth`).
  - **Where they stand** 🧪: on the room's floor (not its top row), 4+ tiles from its doors
    (`DOOR_CLEAR`), 3+ apart (`FOE_GAP`).
  - **How they move** 🧪: half of them walk about their room (`WANDER_SHARE`; the first
    always stands still), 1.5 tiles a second, pausing 1–3 s at each spot. The rest face one
    of 4 ways and turn every 2–5 s.
  - **What they see** 🧪: 7 tiles (`SIGHT_RANGE`) in a 90° cone (`SIGHT_CONE`) the way they
    face, or 1.5 tiles (`SIGHT_NEAR`) any way. Rock blocks it; floors, doors and tunnels
    don't, so a foe can see you coming down a tunnel.
  - **The chief** 🧪 is waiting (the lab: his fight starts as you step into the camp,
    `ALERT_KINDS`; in the game, see "Bosses wait" under step 7). Won, his cages are listed
    (the live chief's cages, `campCages`).
  - **Slipping past unseen** 🧪: nothing happens. The foes stay where they are with their
    loot, and the room isn't cleared (no cross on the scroll). It's mostly behind you then
    (up tunnels are one way); a room still reachable sideways can still see you if you go back.
- **A room plays out** (the lab, 2026-11-06): seen, you fight that room's foes in the real
  battle screen. Win: they're gone, and what the live game's win leaves (gold, dropped gear,
  the chief's mini boss extras: `fightSack`) is left in a sack where you stand; your team
  keeps its HP to the next fight. Lose: the run's over, back to the entrance on a fresh roll.
  **Anything you can loot opens when you tap it** (the user, 2026-11-06): chests, stashes
  and fight spoils. Tap one and you walk up beside it (chests are solid), then the game's
  loot window opens (`LootWindow`, with a 6-slot test bag; gold and cards take no room).
  A chest rolls the live chest roll (`chestSack`), a stash its sack; what you leave stays
  in it. Later, with the art, the chest should fit the room.
  **The test team** 🧪: three Uncommons in Uncommon gear at level 5, rolled with the layout.
- **Your spot** is kept for the browser tab (the lab's own sessionStorage key, never a
  save): where you are, what you've seen, cleared, looted and in the bag, the scroll's looks, your trail.
  A reload carries on; Reroll or losing starts afresh. The scroll crosses out cleared rooms.

## 7. In the game: the Labyrinth's "New"

7. ✅ **In the game: the Labyrinth's "New"** (the user, 2026-11-06: a new choice at the
Labyrinth's entrance, "🔥 New", the Encampment in the new style, live for playtesting and
others' opinions; the old Encampment stays as it is). A New run **is an Encampment run**
(dungeon 0: its fee and free runs, its run and clear counts, its chief and cages, its room
mix and balance), with an optional `walk` record in the run (`lib/dungeon/walkRun.ts`, so
old saves load): the layout and its scroll map, every room rolled at the start (its foes
stand in it), where you stand, what you've seen, the torches you've lit, where each beaten
room's loot lies, your trail and cut-offs. The room you're in is the run's current room, so
the Labyrinth screen plays it out as ever: fights (XP, level-ups, knock-outs, the battle
history), loot into your bag, the chief's cages, the haul, retreat, losing.
- **The screen** (`components/WalkView3D.tsx` since 2026-11-10, decision 38: drawn in 3D, Stone with decision 37's picks,
  [world/rendering.md](../world/rendering.md#48-the-3d-direction-the-user-2026-11-10); its play logic, events and taps in
  `hooks/useWalkPlay.ts`; in place of the room view. Before, `components/WalkView.tsx`, the 2D view, kept until the 3D one
  has been played; `/lab/newrun` still shows that one without a save): the mossy kit, the cloaked torchbearer (the user's pick, walking with
  the torch held up), 15 tiles across, torchlight, wall torches, rubble. Walking into a room
  makes it the current one; walking out leaves it as it is (`walkInto`: foes you slipped past
  stay; an opened sack's leftovers go to the floor, as down a tunnel). Seen by a room's foes,
  or into the chief's camp, that room's fight starts, but not at once (the user, 2026-11-06;
  `fightReady` and the numbers in foes.ts, 🧪): every foe of the room lights up like your torch
  (`ALARM_LIGHT` 2.5 tiles) with a "!" over it, half a second later they all come at you
  (`CHARGE_SPEED` 4 tiles a second), and it fades to black into the fight (`FADE_TIME` 0.6 s)
  once they've all reached you, or a second after the first has (`LATE_GRACE`), or 4 s after
  they saw you whatever happens (`ALARM_MAX`). You can't walk meanwhile. (`/lab/walk` still
  starts its fights at once.) Tap a chest, stash or a fight's sack
  to walk up and open it in the loot window. A camp's cages are guarded like a mini boss's
  chest (the user, 2026-11-09): its foes patrol in front of them (`cageGuardSpot`), and
  trying one before they're beaten sets them on you; then each opens as you walk up. Walking
  in never opens the room's window now; the room button (top left) opens it any time. It sits at the
  bottom, at most 55% of the view; a shop's (the merchant's cart, the librarian's shelf) takes the
  whole view, anchored to the top, as it was cut off at the bottom (the user, 2026-11-11).
  **Bosses wait** (the user, 2026-11-06; `placeWaiter`, `waitsHere`): the Encampment's
  chief (and the Labyrinth's boss) stands at the top of his room (`WAIT_FROM_TOP` 4 tiles
  down, facing the way in), never wandering, and his fight starts only once you've walked up
  to him (`WAIT_REACH` 3.5 tiles, in sight 🧪), not as you step in. The Labyrinth's large
  encampments aren't bosses: their foes look about like any room's.
  **Cages** (the user, 2026-11-06; `cageSpots`): a camp's cages stand in a row along the top
  of its room, behind the chief (`CAGE_GAP` 4 tiles apart; PixelLab art, shut and opened).
  Once he's beaten (or with no guards to see) each one still shut has a "!" over it: tap it,
  walk up, and it opens like a chest (the creature inside is yours, as ever). **Winning at
  the top no longer ends a walk at once**: the chest he guarded is there to open, and a "🏠 Head
  home" button ends the run on to the cheer and the haul (`headHome`). The clear counts
  however you leave once he's beaten, by the Den or Retreat too (`wonAtTop`, run.ts
  `endRun`).
  **Guarded chests** (the user, 2026-11-07): a mini boss's or boss's chest (`fightContainer`
  not a sack) is on the ground from the start, shut: behind a boss waiting at the top (beside
  him, a little behind, where cages stand), else the room's middle (walkWorld.ts
  `guardedChestSpot`, from the layout). Its guards patrol close round it (`guarding`, foes.ts
  `GUARD_REACH` 2 tiles 🧪; a waiting boss still stands). You can tap it before they're beaten,
  but trying to open it sets them on you (`soundAlarm`: as if seen); win, and Loot opens it
  (the user, 2026-11-09). An ordinary fight's sack still lies where you stood.
  **The campfire window** (the user, 2026-11-06: the long bars were too big; 2026-11-09: out
  of the way): a thin bar of what the fire has left, then your team in a column down from the
  top left, small (56 px), a health bar under each.
- **Two dens in a big room** (the user, 2026-11-06: big and long rooms can hold two spawns,
  one down each end; `SECOND_DEN` 35% 🧪 of creature dens in a wide, tall, big, dog-leg or
  large room): the second den is a room of its own in the run (`<room>~2`, foes.ts
  `spawnOf`), with no tunnels or mark on the scroll, its foes keeping to the far end of
  the room (`endOf`: split across the middle of its longer side) and the first den's to the
  near end. Each is its own fight, with its own loot. A balance change (more fights, more
  XP and gold): 🧪 for the user to judge. The dock's
  Scroll is the treasure map, and the entrance's look at the map is that scroll with only its marks (`WalkFirstMap`); the Den button is locked only mid-fight. A stash's or a fight's sack is drawn smaller than a chest (the user, 2026-11-06).
- **Torches in tunnels** (the user, 2026-11-06; `placeSconces(…, tunnels)` in torch.ts): some
  tunnels (`TUNNEL_SCONCE_CHANCE` 40% 🧪) have unlit torches along their walls, one every
  `SCONCE_EVERY` tiles (taking turns side to side up an up tunnel), lit by walking past like
  the rooms' ones. A tunnel that falls in takes its torches with it.
- **Campfires** (the user, 2026-11-06; `lib/dungeon/campfire.ts`): some rooms have one
  burning (`CAMPFIRE_CHANCE` 15% of rooms, never the entrance or the camp, one a room at
  most 🧪), rolled with the run (`walk.fires`, optional: older runs have none). Stand by one
  (`CAMPFIRE_REACH` 2.5 tiles, in sight 🧪) and the team heals: it holds half a creature's
  health in all (`CAMPFIRE_HEAL`), given out at 5% of max HP a second (`CAMPFIRE_RATE`),
  shared evenly between those standing and not full (three hurt: a third each; one: all of
  it; what a nearly full one can't take goes to the rest; knocked-out ones get nothing).
  A window over the walk shows the team's health bars rising, a "+" by each one healing,
  and what the fire has left; green crosses rise round you. Given out, it burns down to
  embers with half its light (`EMBER_LIGHT`). It's solid, and lights its part of the room
  (`CAMPFIRE_LIGHT` 5 tiles 🧪). PixelLab art (see "Campfire art" below).
  **Pools** (the user's call): a campfire and a healing pool never share a room, and
  campfires take some of the pools' share of rooms. The Encampment has no pools, so this
  applies once the walkable run reaches the Labyrinth: half each (pools 10, campfires 10 of
  `ROOM_MIX`'s 20; the user, 2026-11-06), 🧪 to adjust, as walking sideways likely finds
  more of them than the scroll's tunnels did.
- **The walkable Labyrinth** (the Cyclops; ✅ the user, 2026-11-06: live as a second New at
  the Labyrinth's entrance, "🔥 New: the Cyclops", locked till the Labyrinth opens; the old
  Labyrinth stays as it is, and Klutz's quest runs are still the old one's;
  `/lab/newrun` → Labyrinth shows it without a save): `startWalkRun(…, dungeon 1)`, a
  Labyrinth run (its fee, run and clear counts, first clear, the Cyclops). Rolling its layout
  takes up to ~2 s, so the screen says "🔥 Lighting the torches…" first. Its rooms are the live Labyrinth's mix by the same code
  (map.ts `fillRooms`, shared with the scroll map: dens up front, mini bosses deeper, "?"
  rooms), on `labyrinthMap` (layout.ts). **Large rooms**: `LARGE_SHAPE` 14×9 blocks 🧪,
  `spec.large` of them up the middle of the layout, each an encampment, library or
  storehouse (`LARGE_MIX`, half marked, `LARGE_KNOWN`): its foes (a guarded storehouse's
  mini boss, a camp's Rares) look about as any room's, its cages along the top (an ambush
  springs as you open one), a library's codexes or a storehouse's crates to tap, or the
  librarian. **Pools and campfires**: half the pools are campfire rooms (`CAMPFIRE_SHARE`,
  a `campfire` room kind, always with a fire; no 15% extra fires in the Labyrinth), pools a
  stone ring of glowing water (PixelLab, a very faint pulsing glow), tapped for the room's
  window. **The card witch** walks about her room (PixelLab, a 4-way walk), stopping to
  face you as you come near; tap her for her game. The merchant, the librarian and a deck
  of cards stand in their rooms, tapped for the room's window. (From world version 9 the
  witches, merchant and librarian wander the dungeon instead: §8.) Walking into a room ticks the
  witch's illness, and walking out mid-game leaves with your winnings, as down a tunnel.
  **The Cyclops** waits at the top of his lair (his sprite, drawn 2.6× a foe's size).
  (Its size, the guided rolling and the rule for a new dungeon's size: [walkable-layout.md](walkable-layout.md#size-and-guided-rolling).)
  Klutz's dynamite quest: the large room is its storehouse, marked, and the dynamite's yours
  as you reach its crates.
- **Flares, walking** (the user, 2026-11-06): lighting one shows the scroll on top as ever,
  and your light reaches twice as far (`FLARE_REACH`) for the next `FLARE_WALK` 90 tiles
  you walk (about half the walkable Encampment, 🧪). A new flare lights afresh.
- **The card witch** wanders on once her game's played out, but there's nothing more to tap
  her for (the user, 2026-11-06).
- **Campfire art** (the user, 2026-11-06): PixelLab, logs stacked in a teepee in a ring of
  stones, burning, and the same burnt out; a flickering glow and a tongue of flame are drawn
  over it, bigger the more it has left.
- **Rooms' insides** (pillars): [walkable-layout.md](walkable-layout.md#rooms-insides-pillars).
- **Candles** (the user, 2026-11-06: "the odd candle in the middle-ish of the rooms,
  unlit"; torch.ts `placeCandles`): `CANDLE_CHANCE` 35% of rooms 🧪 (never the entrance or
  the boss's room) have one on the floor 2–5 tiles from the middle, unlit. Walk near it (in
  sight) and it lights, keeping a little pool of light round it for good (`CANDLE_RADIUS`
  2.5 tiles 🧪). Once lit it's drawn lit wherever you've seen it, in sight or not (its pool of
  light needs you to see it, like a wall torch's). Placed from the run's seed and kept lit with the wall torches' list, so
  nothing new is saved. PixelLab art (the unlit one is the lit one with its flame taken off).
  > ⚠️ This is the candle rule for runs made before world version 5. New runs (v5 to v8) place candles, and extra wall torches, by each room's darkness: [world/placement.md](../world/placement.md#candles-and-extra-torches-world-versions-58).
- 🚧 **Decor samples** (the user, 2026-11-06: "upgrades to the art, things that make the rooms
  less repetitive and more engaging"; `lib/dungeon/decor.ts`; **only in `/lab/newrun`**, its
  Decor switch, until the user picks; a still: [decor-samples.png](../ideas/decor-samples.png)):
  - **Worn floor tiles**: a quarter of floor tiles (`FLOOR_WORN`) are one of 12 worn versions
    of the kit's floor (cracks, chips, moss tufts), picked by place and seed. They tile with
    the plain one without seams.
  - **Worn walls**: 30% (`WALL_WORN`) of a top wall's face, in pairs of tiles, is one of 3
    worn versions (cracks, a broken-out brick, cobwebs, creeping ivy).
  - **Banners**: 35% of rooms (`BANNER_CHANCE`) have a tattered red banner on the top wall,
    never over a door or a wall torch.
  - **Things lying about**, by the room's kind (`THEMES`): skulls, pots and a nest (with eggs)
    in dens; barrels and crates in storehouses, by merchants and in camps; a bit of everything
    elsewhere. One per `DECOR_PER` 28 floor tiles, 8 at most, two of a kind at most, one nest;
    a big room's fallen pillar (a heap of mossy blocks) half the time. Barrels, crates and the
    pillar are solid and only stand against a wall, so no way through is ever blocked (tested:
    every door still reaches every other); the rest are walked over. Never on a room's middle,
    its fire or candle, or by a door.
  - Ideas not drawn yet: puddles and moss patches as decals (PixelLab gave plain floor
    circles), side walls' faces, room-kind floors (a library's boards, a camp's dirt),
    cobwebs in corners, a darker pillar.
- **Still to come:** scenery, rubble art, the animated flame sprite, the old Encampment's retirement once
  New has been played (the user's call), and porting `/lab/walk` onto WalkView (it keeps its
  own copy of the drawing for now, with its testing switches).

## 8. ✅ People who wander, and the locators (the user, 2026-11-10; decision 39; built 2026-11-10)

A core mechanic, for every walkable dungeon; **built in the Cyclops first** (the Encampment has
no witches, merchant or librarian to wander). World version 9: runs already made keep today's
rules (version 8 is pinned: tests/placeV4Pinned.test.ts). Code: `lib/dungeon/people.ts` (who,
where they start, how they wander, the locators), the rooms in `walkRun.ts` (`addWanderersRooms`),
the walk in `lib/world/walkSim.ts`, what you tap in `walkWorld.ts thingsOf`, drawn by
`components/WalkView3D.tsx`; tests in tests/people.test.ts and the Labyrinth page test.

- **Who:** every dungeon has **2 card witches, 1 merchant and 1 librarian**, wandering. They no
  longer take up a room of their own: each starts in any room that isn't hostile (the boss's lair
  left out), and walks the whole dungeon, but keeps out of any room with creatures in it.
  - **As built:** each is a room of the run of their own, `person~witch0`, `person~witch1`,
    `person~merchant`, `person~librarian` (like a big room's second den), holding their game or
    their cart, with a mark on the run's map that's never on the scroll. Talking to one (walk up
    and tap, as before) walks you "into" them, so the witch's, merchant's and librarian's windows
    work on them unchanged; walking into a room puts them back. Where each stands is saved in the
    run (`walk.people`, with the last room they were in), so they're where you left them.
  - **Wandering** (🧪 `WANDER_*` in people.ts): off to one of the 6 open rooms nearest them with no
    creatures in it (`WANDER_NEAR`), through rooms with none, at 0.6 of a foe's pace; a pause of
    4–10 s there (`WANDER_PAUSE`), then on. They stop and face you when you come within 4 tiles
    (`NPC_STILL`), as the witch did. Nobody moves while a window's open.
  - The merchant and the librarian walk without their carts for now (their standing pictures,
    sliding; ❓ walking art is for the user to choose); the witches use their 4-way walk.
- **Cut off:** one left somewhere you can no longer reach (their room behind you, or a tunnel
  that's fallen in round them) stops wandering for good (`stopped`). A locator used for them isn't
  used up; it says "It appears that they are no longer here…".
- **The rooms they leave** (`WALK_ROOM_MIX`, `WALK_MYSTERY_MIX` in run.ts): normal rooms, dens 40 →
  45 and a campfire share of 5 (besides the half of pools drawn as campfires); "?" rooms, the
  witch, librarian and merchant shares (18) go to dens +6, brutes +6 and campfires +6. **Half of
  campfires** have a stash beside them (`CAMPFIRE_STASH`, a stash's sack rolled as a stash's).
  Smaller rooms are empty **1 time in 5** (`EMPTY_CHANCE`; ❓ "smaller" read as the `small` shape,
  `EMPTY_SHAPES`): a new room kind, `empty`, done from the start.
- **Their light:** every wandering person gives off a light (`PERSON_LIGHT` 🧪, a wall torch's 4
  tiles: a candle's 2.5 was too small for the person drawn fully lit in it, the user, 2026-11-11; worked out where they stand each frame, and only while in your sight). A witch's goes
  out once you've played her, won or lost (or walked away with your winnings).
- **The witches:** each has her own game and winnings. Both can give illnesses, and illnesses
  stack: each counts down on its own, so two on one creature hurt twice as much (`illnesses` in
  the run, read from an older run's one `illness`; in a fight each is its own status, and what's
  left of each comes back out). This holds in every dungeon, the classic ones too.
- **The librarian** always starts in the large library (if the run has one; else any calm room),
  then wanders like the others. The large library no longer holds a librarian of its own selling
  books, nor codexes lying about: its codexes are in its broken bookcases, and it has a **locator
  lectern** (the Den's lectern art): using it finds the librarian as the librarian locator does,
  and from then on the scroll shows them (❓ as built: the lectern counts as a used librarian
  locator for the rest of the run). The room's window has the lectern's button too.
- **Broken bookcases:** every large library holds **3–5** of them (the battered bookcase art,
  den/bookcase-2.png), in a row along its top (kept clear of its doorways: world version 10), each a room of its own (`<library>~b<i>`) searched
  like a stash. They hold only codexes and clairvoyance scrolls, rolled separately (run.ts
  `rollBookcases`): **30%** hold no codex, the rest **1–2 codexes**, each at the usual rarity odds
  (Common 40, Uncommon 30, Rare 20, Epic 9, Legendary 1; Legendary counts as Epic until there's a
  Legendary codex: drops.ts `randomCodexOfRarity`, any codex of the rarity), and each bookcase has
  a **20%** chance of a clairvoyance scroll, at most **2** a library.
- **Later, planned by the user (not part of this decision):** codexes can be sold for half what
  they cost; a scan that gives a codex fixes its rarity, and which codex of that rarity is random.
- **Locators** (new tools, `LOCATORS` in materials.ts: Rare; stand-in icons till they have art of
  their own): **5% per chest or stash** holds one, any of the three (`LOCATOR_FIND`; a stash's
  rolled with the run, a chest's as it's opened); the merchant sells **one**, at **200 gold** (in
  his cart's last slot if it's full).
  - **Merchant map**: where the merchant is;
  - **Crystal ball**: where a witch is (the closest one you can still reach and haven't played, as the crow
    flies: the user, 2026-11-11). Where nobody wanders (scroll-map runs, older walkable runs) a locator reveals the room they keep instead (`locateRoom`). The merchant and librarian use the tavern's 8-frame walks.
  - **Librarian locator**: where the librarian is.

  Using one (the bag's "Use it") opens the scroll, free (no look spent), with that person's icon at
  exactly where they are, among the rooms' marks: it shows nothing else (no rooms or tunnels).
  Every time the scroll's opened from then on (the Scroll button, its looks as ever) it shows where
  they are now. A locator is **used once and then works for the rest of the run** (`walk.tracking`);
  a second one of a kind you're already using opens the scroll and isn't spent.

## Later

- **Later (the user, 2026-11-05):** what's in a room stops being one thing: a room can hold
  e.g. a mini boss *and* a healing pool, or nothing. Several kinds of room, each in 1–3 styles.
  (This touches the room mix, a decided balance: present it as options when it comes up.)
