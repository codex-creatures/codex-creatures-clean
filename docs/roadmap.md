# Roadmap: not built yet

Everything decided but not built, still open, shelved or dropped, in one place, so it's never
mistaken for what's in the game. **Nothing here is built** unless marked. Each line links to the
file that holds the detail; that file is authoritative. When something here gets built, take it
out and update its file. (Gathered on 2026-11-09 from design.md and world-spec.md.)

📌 decided, not built · ❓ open: the user hasn't decided (ask, don't pick) · ⏸ shelved: don't build
unasked · ✗ dropped: don't propose again unless the user brings it back.

## The game

### 📌 Decided, not built

- **Onboarding scan gate** (later): the game stays locked until you scan a real barcode, then
  Klutz drags you out of the labyrinth. Deliberately unconventional: don't "fix" it. Edge cases
  unsolved (manual entry, no camera, app-store review). [design/scanning.md](design/scanning.md) §2
- **More soul stones**, and **cosmetic variants** (1 in 500 real-creature drops, first scanner
  only, for trading). [design/creatures.md](design/creatures.md) §4
- **More combat effects**: vampirism, curse/blind, fear (blocks swapping); more moves from
  encounters, drops or daily quests. More **ground effects** that interact (the user's direction,
  theorycraft only). [design/combat.md](design/combat.md) §6
- **More schematics and furniture**, e.g. a Den fireplace for faster healing.
  [design/items.md](design/items.md) §3
- **The tavern's interior** (needs design), the mounted head's art; wandering merchants and weapon
  dealers as gold sinks (the user will design gold sinks). [design/den.md](design/den.md) §9
- **Sign in with Apple** alongside Google, for the iPhone App Store. **Email-link sign-in** is built
  but hidden until the game has a domain and Resend. Challenging players who aren't friends.
  Server-side checks against cheating, later. [design/online.md](design/online.md) §12
- **Rooms holding more than one thing** (a mini boss and a pool, or nothing; kinds of room in 1–3
  styles). Touches the room mix, a decided balance: present as options.
  [design/walkable-play.md](design/walkable-play.md) "Later"
- **The first PvP playtest** (goal: about 2026-11-21, the user and a friend).

### ❓ Open

- What Klutz gets in place of his old counter bonus; longer Klutz walks (overnight trips).
  [design/klutz.md](design/klutz.md)
- Agility doing more (e.g. a dodge chance); race-move rules beyond the kits (`MOVE_RACES` drafts).
  [design/combat.md](design/combat.md)
- Shared barcode lists once the registry is global (seasons, limited stock, legendary species per
  player). [design/scanning.md](design/scanning.md) §2
- Secondary classes (largely answered by archetypes); a Celestial race; a creature trader / slave
  trader. [design/creatures.md](design/creatures.md)
- A 10-item battle bag; bags for Klutz. [design/items.md](design/items.md)
- Cards showing level-15 %s; Pit fights giving no XP. [design/creatures.md](design/creatures.md) §5
- Whether coming home at full health (`HEAL_AT_HOME`, a testing convenience) ever turns off, and
  what the healing pool becomes then (the user's planned upgrades and elixirs).
  [design/labyrinth.md](design/labyrinth.md) §7

### ⏸ Shelved

- The re-entry cooldown (the gold fee is the bar). [design/labyrinth.md](design/labyrinth.md)
- Ranked ladders with Elo (the portal's tab says "Coming soon"). [design/online.md](design/online.md)
- The intro (Klutz drags you in, you tip him gold), until the art direction settles.
  [design/klutz.md](design/klutz.md)

### ✗ Dropped

The barcode merchant; the merchant's gear wares and armour priced like weapons; the Cyclops's
Meditate heal; the Klutz kidnap plan (replaced by the Encampment); the Codex of Stances; the drunk
encampment; lighting floor candles by tapping ("B6"); wall candles in new runs (replaced by wall
torches in v8, with their sprites and south-face fade); voxel-style rendering for the Labyrinth;
the rejected art (the mushroom/ruin room
theme, Mr. Shadows redraws, parchment / MTG / wood-and-brass cards); hand-drawn sprites in code.

## The walkable world

### Paused (the user, 2026-11-10)

While a 3D renderer (Three.js with React Three Fiber) is assessed for the walkable dungeons:
Stage 3 of splitting app/dungeon/page.tsx (one step done: hooks/useDungeonSave.ts; next the sack
and loot handlers, each with a played-through scenario first), the four-way 2D lighting and
pixel-scaling experiment, and settling D, sprite sizes and the art pipeline. The 2D findings are
kept in [world/rendering.md](world/rendering.md#47-what-todays-drawing-gets-wrong-found-2026-11-10-true-whichever-renderer-comes-next).

### Still to do

- **Phase 3, the art standard and its tools:** the dungeon art spec, palette, template generator,
  checks and test-room render; D for new art decided from two in-game comparisons
  ([world/rendering.md](world/rendering.md) §4.6). Built so far: the palette
  (`art/palettes/dungeon.json`) and `scripts/art-check.mjs`. *Done when:* a test pins template
  sizes to the projection; the checks run over today's assets and give a report (the old kit is
  expected to be flagged); the user approves the spec and a test-room render made with grey
  templates. [world/art-pipeline.md](world/art-pipeline.md)
- **Phase 4, the first assets to the standard:** one kit and the pillar, then the props, each
  through templates, checks, the test room, the game and the user's approval. *Done when:* the
  user approves each in the game; only then into the active registry.
- **Stage C, decor and banners in real runs** (a new world version): placed by passes 8 and 5 and
  saved as instances; solid decor against walls, never across a required path or a clearance;
  walk-over decor anywhere free; banners take a wall panel's three slots, after torches and
  candles; the lab's numbers to start (`DECOR_PER`, `DECOR_MOST`, `BANNER_CHANCE`). *Done when:*
  the invariants hold with decor in, pockets flagged, required paths kept, blocked panels per room
  within agreed ranges, and the lab and the game show the same thing for a seed.
- **Stage B's leftovers, now for the extra wall torches** (v8): drawing each from its mount point,
  sorted with its face, pinned in draw-list tests; and the density comparison (sparse, ambient,
  rich) for the user to set `DARK_PER_V7`. The wall-candle sprites and south fade are superseded.
  [world/placement.md](world/placement.md#candles-and-extra-torches-world-versions-58)
- **Undefined art standards** to settle as they come up (square wall pixels, D, when older assets
  move to 48, outline and detail, PixelLab settings per kind):
  [world/art-pipeline.md](world/art-pipeline.md#still-undefined)
- **Candles placed by where a room is darkest** was proposed as its own approved change (stage A
  notes); the v5 budget does this for mounted lights. Floor candles are decorative.
- **Wandering NPCs and the lights they carry**: its own feature, designed and approved before it's
  built ([world/placement.md](world/placement.md) §5.7). Needs nothing from the art phases.
- **Art in the walkable rooms** (the user's list, [design/walkable-play.md](design/walkable-play.md)):
  small floor decorations to break up the repeat (decorations, not scattered tile variants); 5–6
  variants of the wall panel (moss, vines, cracks); pillar art that reads as a pillar; rubble art;
  the animated flame sprite; scenery; creatures and items at the user's quality target (detailed
  pixel art about 128–200 px a portrait) when PixelLab spend allows. The checker's contrast limit
  needs an allowance for light materials (wax).
- **The old Encampment's retirement** once New has been played (the user's call); porting
  `/lab/walk` onto WalkView.
- **Gen 4: extras inside other rooms** (witches and pools within rooms): later, after the walkable
  run matches the live balance. [design/walkable-play.md](design/walkable-play.md) §4

### §9 Now, later, never (world-spec §9, word for word)

> Notes added 2026-11-09: "Candles by any wall" was built in v5 and replaced in v8 (wall torches);
> "A placement debugging view" is built (`/lab/placement`).

**Now (phases 0–4):** everything above.

**Designed for, built later:**
- **Height levels:** z is in the data and the projection. Steps, ledges and raised floors come
  later.
- **Stamps:** the format is in §5.5; the first is built when a room needs one. (A stamp's grid is
  in panels; a stamp may give a thing an exact subcell spot.)
- **Walking on subcells:** designed for in §5.4, changed only when the user decides.
- **Wandering NPCs with their own lights** (§5.7): after phase 2, its own feature.
- **Candles by any wall** (§5.6): on 2b's placement.
- **A placement debugging view** (the user, 2026-11-08): a lab page drawing a room's subcells,
  each thing's footprint, the blocked and reserved panels, the paths kept, and the interaction
  points, from `placeWalk`'s occupancy map, to inspect placement by eye.
- **Levers, traps, breakable walls:** a definition slot and instance state only.
- **A second setting:** packs are laid out for it; built once the dungeon pack is right.
- **4-way walking art for creatures:** size classes now, art later.
- **8 facings.**
- **A different renderer:** the world/scene split allows it; nothing is built for it.

**Not worth it for this game:**
- real 3D, or a rotating camera;
- a general game-engine object framework, or a physics engine;
- lighting tricks that give flat sprites depth (normal maps, dynamic shadows from sprites);
- smart pattern-matching or constraint-solving generators: passes plus stamps are enough;
- a level editor: stamps are text;
- re-drawing all 40+ creatures at once;
- more than one setting before the first is approved.
