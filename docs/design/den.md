# The Den and economy

Authoritative for the Den, save slots, the tavern questline, visitors, the pits, the collector and daily quests. Part of the [game design index](../design.md); status tags (✅ 📌 🧪 ❓ ⏸ ✗) are explained in [docs/README.md](../README.md#status-tags). **The code is the truth for numbers:** if this file and a constant disagree, trust the code and fix this file.

Moved here word for word from design.md on 2026-11-09 (the original is in [archive/2026-11-09](../archive/2026-11-09/design.md)); section numbers are kept, so references like "design.md §N" still find their place.

## 9. The Den and economy

- ✅ Places: Soul Altar (summoning and ascension, since 2026-11-18; scanning is the dock's 🔍 button), Labyrinth archway, quest board, Bestiary lectern, cage, pool,
  Fight Pit, chest (Inventory), crates, bookcase (codexes: 5, 15, 30 or 50 as it's built up, [items.md](items.md)), bindle/bag, merchant
  stall, and a boarded-up Tavern.
- ✅ **The Den's top bar** (the user, 2026-11-14): your explorer level as an XP bar, `Lv 3 [45 / 180] Lv 4`
  (MAX at Lv 30), where the title "Codex Creatures" was; then gold, creatures and items found, and ⚙️.
  Under it, every material's count, even at 0 (the user, 2026-11-17).
- ✅ **The Den's dock** (the user, 2026-11-17): just **Enter the Labyrinth** and **Scan barcodes**
  (the Soul Altar). The other places are tapped in the room; Klutz's tour shows them. (It had a
  button for every place before.) While Klutz is out hunting he isn't in the room (the "Klutz is out
  hunting" button went on 2026-11-18, the user: you can see he's gone); his crate, labelled Klutz's Den,
  is the way to his home then ([klutz.md](klutz.md) §8).
- 📌 **Tavern:** where travellers, merchants and librarians gather. Now reached through the
  questline below (the earlier "built with 300 gold after the Cyclops" is replaced by it). ✅ Its
  outside, repair, visitors and pits are built (the questline below); 📌 its interior is not.
- 📌 Wandering merchants and weapon dealers as gold sinks. The user will design gold sinks.
- ✅ **Save slots and the title screen** (2026-10-20, `app/start`, lib/saveSlots.ts): opening the
  game shows Continue / New Game / Load file; up to 4 named saves per browser (no real login: the
  user chose this over online accounts). The game saves itself on every change. The slot in play
  lives in the usual keys; the others are parked as save files.
- ✅ Sell prices **stay as they are** (the user, 2026-10-20), even though they (epic ~800,
  legendary ~2,700) dwarf Labyrinth gold (~18 a room) and re-scan gold has no cap.

### The new Den (on for everyone; the old one behind a setting)

✅ **On for everyone since 2026-11-20** (the user: "flip the Den to the new view for everyone, leave the old in a
toggle + view degrees"; built 2026-11-18, off by default till then; decision 50): Settings → **New Den** turns it off
for the old Den, per device (`codex_creatures_den3d_v2`: what anyone set before, in v1, is left unread, so everyone
starts on it once; lib/den3d/setting.ts; not in the save). Its View angle and Names stay in Settings under it. With
it on, the bag empties into storage after a run (lib/den3d/bag.ts), now everyone's default too. The user's design, 2026-11-18:
the Den as a room like the Labyrinth's, warmer walls for contrast, built up over time; no free
placement (players could block themselves in). With it off, the old Den, as it was.

- **The look:** the Labyrinth's 3D renderer as is (components/Den3D.tsx reuses WalkView3D's Stone
  shader, the carved rock, the camera at 60°, the lean, 48 art pixels a unit at 15 units across), with
  the Den's own light: never pitch dark (`DEN_STONE` remember 0.3), warmer, from torches on the north
  walls, two braziers by the altar, the altar's fire and the tavern's windows (`denLights`). Walls 3 u
  high (`DEN_WALL`; the Labyrinth's are 2.25): a cavern, the buildings under them. 🧪 The walls and floor
  are the Labyrinth's kit F, every pixel kept, recoloured warm sandstone and earth (scripts/den-kit-warm.mjs);
  lanterns by the shack's and storehouse's doors, braziers in the tavern's room once it's open.
- **The shape** (the user's drawing, 2026-11-19; lib/den3d/layout.ts): a **T**. A wide hall (12 × 15 floor
  each side; 11 deep till the user added 4 rows south, 2026-11-19, for the bigger pool and pits) with a narrower nook (6 × 6 each side) rising from the middle of its back wall, split down the
  middle by a wall that all moves away once Klutz uses the Labyrinth Stone. Each nook has a way out in the
  middle of its north wall, mirrored: a dark hole in the rock face under an arch (the user, 2026-11-18: a hole in
  the wall, not a short corridor; the hole is the arch's open middle, scripts/den-parts.mjs). Room 1's is the
  Labyrinth's (a sandstone arch), room 2's the **PvP portal** (the same arch mirrored and turned green, a green
  swirl across its mouth, and its glowing count of players online, numbers only: 0 and up as soon as you're
  signed in, shown even with names off; nothing when signed out or offline). All the rock south of the hall is the low rim, so nothing hides the hall's front.
- **What's where:** room 1: **Klutz's Cabin** (its name in the new Den, the user, 2026-11-19) in the hall's top-left corner (his page: gear, crate, trips), the
  **storehouse** turned along the west wall, doors facing into the room, far enough down that the cabin's front shows (the Inventory's weapons, armour and
  consumables: `/chest?store=1`), the Bestiary in the nook, and what you can move. Room 2: the tavern in the
  hall's top-right corner, the portal, the Sparring/Training Pit (once the tavern has its pit).
- **Moving things** (the user, 2026-11-19): hold a movable thing still (`LIFT_MS` 450 ms) and it lifts; drag
  it and let go. Floor things (the Soul Altar with its two braziers, the healing pool, the Pit, the standing
  torches, and the tavern's pit in its own half) snap to the floor's small tiles (`SNAP` ⅓ u: each tile is 3 × 3 of them;
  the user, 2026-11-20, was a half unit) anywhere on the open floor, nooks included
  (the user, 2026-11-19: "more flexibility"): `FLOOR_MARGIN` clear of the rock, two small tiles (`GAP` ⅔ u, was 0.6) clear of each other and of the
  barrels, crates and pots (`DECOR`), of the room in front of a building's door, a wall thing and a way out
  (`DOOR_CLEAR`), and never boxing a place in: every place must still be reachable on foot from the Labyrinth's
  tunnel (`allReachable`; why fully free placement was ruled out, 2026-11-18). While a floor thing is held, the floor
  shows where its middle can go (the user, 2026-11-19): green where it fits, red where it doesn't (`fitMap`, worked
  out a few ms a frame, `FIT_MS`, so a drag never stalls), and the thing's own footprint shows under it, green or red
  (the user, 2026-11-20; wall things' too). **Standing torches** keep no gap (the user, 2026-11-20: "so you can customize
  the lighting"): their foot is one small tile (`LAMP_FOOT`) and may touch anything, the rock included, but not stand on
  it, nor in front of a door or a way out, nor box anything in. Things put down with the old 0.6 gap still load where they were. Wall things (the bookcase, the quest board, the cage) snap to slots (`SLOTS`): beside each tunnel, in
  the middle between them (once the wall's gone), and along the hall's back wall by the shack; dropping on a
  taken slot swaps the two. Where it can't go it's red ("It won't fit there") and goes back. Kept in the save
  in its own field (`den3d`, lib/den3d/placement.ts: only what's moved), so it goes with save files and cloud
  saves; anything saved where it can't stand now goes back to its start. Klutz and visitors find their way
  round wherever things stand (`routeLoop`).
- **Props from recipes** (the user approved them for the new Den, 2026-11-19, to try with players): the Soul Altar,
  the healing pool, the Pit, the Sparring and Training Pits, the quest board, the cage, Klutz's shack, the storehouse and the
  tavern (once repaired; the boarded-up one keeps its old look) are drawn from their recipes (lib/props/recipes,
  world/art-pipeline.md §6.6) by Den3DPlaces' `Place` (`Made`): the buildings and the board with their backs to
  their wall (the storehouse turned to face east from the west wall), the rest in the middle of their footprints.
  They're lit by a key light from the upper left (`DEN_KEY`, Den3D: only the recipes take it) times the Den's own
  light where they stand, as the old drawings were tinted. Footprints, slots, taps and moving them are unchanged.
  A recipe that won't read falls back to its old drawing (lib/props/recipes/load.ts). The user's verdict: the altar
  the most impressive, the Pit the least detailed and next to improve. Their second round (2026-11-19): the altar 0.6 its
  size (its soup within reach, under the buildings' eaves), the buildings 1.7× deeper (they read as fronts, not
  buildings), the board's posts, frame and back in wood, the Sparring and Training Pits twice the size (as many stones and
  spears again, the dummy 0.85), the Pit's stones in its drawing's blocks with rubble round them, the pool big and swampy
  as the old Den's (about 3.3 × 2.2 of murky water, a ragged bank, mud, moss, reeds and bulrushes), and a new cage, 1 × 1
  and 1.5 high (a wooden plinth and posts, iron caps, round bars all round and over the top, straw; the creature on it).
  The braziers stand closer to the smaller altar and further out round the bigger pit (`BRAZIER_AT`, per place).
  Round three (the user, 2026-11-19, "lets do these all"): the boarded-up tavern, the old wall's socket, the Labyrinth's
  arch and the PvP portal are recipes too (`tavern-broken`, `socket`, `arch`, `portal`; the arches' pictures stand out
  from the wall with their stones' thickness behind, over their holes); the bookcase and lectern stay the Labyrinth's
  3D things. The bigger flat-colour faces wear shared textures (stone, wood, grain; world/art-pipeline.md §6.6).
- **Light, shadows and life** (the user, 2026-11-19): a higher ambient light (`DEN_STONE` remember 0.48, 0.58 since 2026-11-20 with
  every light's reach up, `DEN_LIGHT`, for "too many dark spots"; the recipes'
  key light brighter), standing torches where it was darkest (along the walls and the south end to start; they
  move like the rest, `LAMP_KEYS`, with no name over them; finding and upgrading them is an idea for later), and the healing pool's own glow. Every place, lamp, brazier and person has a
  fixed shadow on the floor (the lights never move): a soft patch in three stepped bands, a little to the lower right,
  buildings' thrown forward. Flames flicker, the tavern's chimney smokes, the caged creature breathes, and a place
  lights up while a finger's on it (`PRESS_GLOW`).
- **The camera turns a little** as the view slides (up to 6°, `TURN`), so the sides of things shift and the 3D shows,
  and settles back square when it stops, so a still view keeps its pixels square.
- 🧪 **The upgrade stages in 3D** (the user, 2026-11-20: "3D models of each, the current as the baseline"; samples, to
  approve in /lab/propbuilder and /lab/propreview before the Den draws them): recipes built from today's models by
  scripts/den-stages.mjs: the cage's old cell (wood and rope) and reinforced cage (a size up, iron bands, more bars);
  the Training Pit with 2 and 3 dummies (a weapon rack, then banners); the bookcase's old shelf, crooked, sturdy
  (today's, taller) and carved (two wide, columns, a gilt crest), each taller than the last; the storehouse with a
  weapon rack (60), a lean-to (75), iron bands (85) and a stone footing (100). The stockroom's stacked crates are in
  /lab/props. The Den still draws one look for each till they're approved.
- **3D models** (the user, 2026-11-19, now the fallbacks for the props above): the Soul Altar (a two-tier plinth, a black cauldron with the horned
  skull, teal lanterns, the soul fire and its spirits), the healing pool (a ring of stones round its water and
  lily pads), the Pit (a stone frame, an iron grate) and the Sparring Pit (a low wall round sand, the dummy;
  iron spikes once it's the Training Pit), their parts cut from the approved pictures (scripts/den-parts.mjs).
- **Looking round:** drag past the walls into the dark (`LOOK_PAST` 4 u every way); pinch or scroll to zoom
  (`ZOOM`: 8 to 24 units across, 15 to start).
- **Options** (Settings, under New Den, per device: `codex_creatures_den3d_opts_v1`, the user, 2026-11-19):
  **Names** on or off (off, only a name with a ❗ or the one Klutz's tour is showing stays); **View**: the camera's angle, 45° to 75° in 5° steps
  (60°, the Labyrinth's, by default). The art is drawn for 60°: other angles re-lay the walls' and floor's
  textures square on screen for that angle, and the rest keeps its 60° sizes, so they're to try.
- **The old wall:** tap its socket (a stone post by the wall); once Klutz has the Labyrinth Stone, use it: the
  ground rumbles and the whole wall, nook and hall, sinks into the floor (`SINK` 2.6 s), and the view glides
  out to both rooms, once: the 3D Den waits for the save before it's drawn, so coming home never replays it.
  Till then room 2 is black and the camera can't go past room 1. Opened, the Den first shows the middle of both rooms.
- **Where the view opens** (the user, 2026-11-18; lib/den3d/view.ts): in the middle the first time in a visit
  and after going into the Labyrinth; coming back from anywhere else, where you left it, zoom included. Klutz's
  tour glides it only when he shows somewhere new.
- **No walking:** drag to look round (the view stays on what's open, and a little past it), tap a place to go in. Every place
  has its name over it (names that would overlap move apart), with a ❗ where something's waiting; Klutz's
  tour lights a place's name and glides the view to it (the same `den-<id>` marks as the old Den).
- **Who's about:** Klutz strolls round room 1 when he's home, rests in the pool while he heals, and is gone
  while he's out (his shack's name gets his ❗ then). Visitors stroll round the whole Den once it's open
  (`VISITOR_LOOP`); tap one for their wares.
- **The bag:** not in the Den. With the new Den on, the whole bag empties when a run ends (lib/den3d/bag.ts:
  potions back to storage, packed gear unpacked, found things into storage as before; a codex with no room
  on the bookcase stays in it), so you pack it at the Labyrinth's entrance each run (going into the Encampment with no potion packed and some in storage,
  the Bag tab glows: `bagWantsPotions`, lib/dungeon/run.ts, the user, 2026-11-20; only a nudge). Off: as before.
- **Art:** the bookcase, lectern, barrels, crates, pots and torches are the Labyrinth's approved 3D
  things. 🧪 Samples, waiting for the user's approval (lib/den3d/art.ts, public/sprites/den3d/, PIXELLAB.md;
  the Den palette art/palettes/den.json), each drawn square on screen at 48 art pixels a unit, its size from
  its picture: the **buildings** (shack, storehouse, tavern, and the tavern boarded up till it's repaired) as
  boxes with their front painted on and a pitched roof (thatch, shingles, clay tiles); the **Soul Altar** as a
  standing picture redrawn from the front, keeping the old one's design; the **Pit** and the **Sparring Pit**
  seen from above on low stone blocks, redrawn from the old ones; the passage's **arch**, the **portal** and the
  board's **notes** on the north wall. The **healing pool** from above, redrawn from the old one. `/lab/den` shows them, with
  switches for the rubble, Klutz, the tavern and visitors. `/lab/models` shows each place on its own on a plain
  background, turned freely on any axis, with a wireframe switch (what's a shape and what's a flat picture). Names sit over everything, and a drag that starts on a
  name still looks round.
- Tests: tests/den3d.test.ts (the plan, nothing overlapping, the strolls clear of everything, the camera's
  limits, taps), tests/den3dBag.test.ts.

### The tavern questline (the user's spec, 2026-10-20; ✅ stages 1–9 built, lib/tavern.ts)

Each stage unlocks the next, so every stage can ship on its own and leave the game playable.
Placeholder art (existing sprites, simple markers) until a later PixelLab pass. All new save
fields optional with defaults.

1. ✅ **Klutz's quest.** It unlocks once any creature reaches Lv 6 **and** Klutz is Lv 2 or more
   (either order). Only won hunts give him XP and a first catch takes him to Lv 2, so his level
   is the record of having hunted, and old saves work too. Then the quest is yours straight away,
   once, whether he's home or out hunting (the user, 2026-11-20: it used to wait till he was home and
   talked to, so a Klutz always out never gave it). His page tells you about it, and the board's step
   (`rubble`) says to find the stone in a storehouse: Cyclops runs and deeper (the Encampment has no large room).
   ✅ **The Labyrinth Stone** (the user, 2026-11-19): what Klutz wants is the Labyrinth Stone, old magic that
   makes the Labyrinth's walls move, where it was dynamite (the same find, in the same place; the save keeps
   the name `dynamite`, so whoever had the dynamite has the stone). In the new Den he sets it in the old wall's
   socket and the whole wall moves away; in the old Den he uses it on the rubbled doorway.
2. ✅ **Storehouse.** Once the quest is accepted and until you have the stone, a Labyrinth's
   Large Room is always a Storehouse, always marked on the scroll from the start (no extra room).
   In the Deep (2 large rooms) only one is. The first-quest run has no large room. The stone
   lies among its crates and barrels (glowing teal). Taking it is permanent: rooms go back to normal and you
   can't get a second one. 🧪 Its usual mini-boss guard chance stays (the stone waits until the
   guard's beaten). 🧪 The stone takes no bag slot and is yours the moment you pick it up, even if
   the run then goes wrong (there's no second one). Both Claude's defaults; not asked.
3. ✅ **Rubble.** A rubble-choked doorway on the Den's right-hand wall, between the bookcase
   corner and the merchant (the user's sketch: [ideas/den-second-room.png](../ideas/den-second-room.png)).
   Using the stone on it (once) opens it (a flash and a shake) into a passage to a second
   room. **Until then you can't see or pan over the second room at all.** It isn't a general
   destructible-walls system.
   ✅ **The room strip:** the Den and the tavern's room sit side by side in one view you drag across
   (`DenRoom`'s `annex`); the tavern's room lies straight behind the Den's right wall, through a
   see-through doorway and a wall one floor unit thick (`PASS`, lib/den/scene.ts). Each room is its
   own picture, built only once open, so later rooms don't slow the others (watch phone
   performance). The tavern's room is the Den's cave with nothing in it (`createDen({ bare })`), with
   the tavern, head and visitor standing in it (`components/TavernRoom.tsx`). Tapping the tavern opens
   `/tavern` (the repair, sending for a visitor); tapping the visitor opens their wares (`/visitor`,
   the user, 2026-11-06); the pit and the portal open their own windows; the bare floor does nothing.
   The view is remembered for the visit (the user, 2026-11-06): coming back from any place opens it
   where you left it, in either room. Meant to grow into more rooms.
   📌 Still to come: mounted head art, and the tavern's interior (needs design). The user's
   [ideas/future-dungeon-direction.png](../ideas/future-dungeon-direction.png) is the likely long-term
   look for the base.
   🧪 Testing tools at the altar: "🧨 Open the rubble" (`forceOpen`) and "🍺 Call a visitor"
   (`callVisitor`).
4. ✅ **The tavern (outside only for now)** stands broken in that room, a building against its far
   wall (the sketch). The first time you see it, Klutz reacts once (it needs materials). Art:
   PixelLab, at the room's angle (§11); greyed until repaired. ✅ (the user, 2026-10-20) **No
   wanted poster.** The ❗ for a visitor is over the visitor (and the Den's doorway), not the tavern.
5. ✅ **Repair:** 5 metal bars, 20 planks, 5 nails. It shows have/need, is blocked if you're short,
   takes the materials exactly once, and swaps in the restored look.
6. ✗ **Bounty** (replaced by the campaign, the user, 2026-11-16): the Cyclops bounty on the quest
   board (take it, beat the Cyclops, hand in the head, paid the bookcase schematic) is gone; the
   campaign's "Beat the Cyclops" step (an enchanted Epic weapon) takes its place. Old saves keep what
   it paid (`bounty`, `mounted` stay in the tavern field; `hasBookPlans`).
7. ✅ **Cyclops Head:** a unique trophy, the decided Cyclops trophy, showing the run you first won on
   (`meta.firstClearRun`). Since the bounty went (2026-11-16) it goes up over the tavern door by
   itself once the tavern's repaired and you've beaten the Cyclops (`headUp`; Claude's reading, as
   the head was the bounty's). It isn't an item, so it can't be sold, used, lost or doubled
   (placeholder: the Cyclops sprite on a plaque marked with the run).
8. ✅ **Bookcase upgrade:** the campaign's reward for blowing open the rubble (found in the broken tavern,
   `bookPlans`) is the bookcase's plans: the **Sturdy Bookcase Schematic** since 2026-11-20 (the bookcase in stages,
   [items.md](items.md): it builds the crooked bookcase into the sturdy one, 30 codexes; the crooked bookcase itself
   takes no plan). Before, it was the Crooked Bookcase Schematic, 10 planks and 5 nails for 20 (25 before that). In
   the Den the shelf swaps to the upgraded art once it's the crooked bookcase or better.
9. **Visitors** (after the repair). ⚠️ The per-run roll below was replaced on 2026-11-16 by visitors on the clock (decision 47, the 📌 block at the end of this item, now ✅); it's kept as the record of what came before. On returning home from each run, roll a merchant (12%), a
   librarian (8%), the creature collector (8%) or nobody. A visitor stays about 2 runs. The first roll after the repair is
   guaranteed, and so is one after 3 misses. They reuse the Labyrinth's merchant and librarian. 🧪 Built 2026-10-20 (`lib/tavern.ts` `comeHome`, `VISITOR_ODDS`/`VISITOR_STAY`/`VISITOR_PITY`). A sure visit is still one of them, at 12:8:8. The roll happens whenever a run ends (won, lost or retreated). While a visitor's in, a ❗ shows at the Den's doorway and over their head (their name: tap them to trade), and they stroll round the tavern's room with a walk cycle, as Klutz does round the Den (`VISITOR_PATH` in lib/den/scene.ts; walks: PixMiniMax, 2026-11-03). They bring the Labyrinth stock: a merchant's cart, or a librarian's 3 race codexes. You buy one of each, and it goes straight home: potions and XP scrolls to the Inventory, materials to the tally, codexes to the bookcase (needs room). Flares and clairvoyance scrolls go to the Inventory's consumables too, and the bag page packs them (and stores them back). One not used on a run comes home to the Inventory too. ✅ The tavern merchant buys (2026-10-20, `tavernSellables`/`materialOffer`): anything in the Inventory he'd take in the Labyrinth, at the same prices (`merchantOffer`), except what's worn, packed or favourited; materials one at a time. Tap twice to sell.
   (The creature trader is left out for now.)
   ✅ **The Sparring Pit and the Training Pit** (the user, 2026-11-03; lib/trainingPit.ts, `/training`).
   The **Sparring Pit**, a bed of tan sand in a ring of grey stones, with a straw dummy (`den/sparring-pit-3.png`), is yours as
   soon as the rubble's blown open, in the tavern room's back corner against the right-hand wall,
   clear of the tavern, drawn 1.9× (`PIT_SCALE`, the Training Pit too). One creature at a time trains in it, in real time
   (**50 XP an hour**, `SPARRING_XP_PER_HOUR`), and stops with its bar full until you tap **Level
   up** (one level, then it trains on from empty), so it never gains more than a level while
   you're away: a ❗ on the pit in the room says it's ready. While it's in, it's away training:
   it can't fight: where you pick a team (the Labyrinth's entrance, a duel, PvP teams) it shows
   greyed, "🏋️ In the pit" (the user, 2026-11-04), and other fight lists leave it out. Take it out any time with the XP
   it's earned (a full bar levels it up). An XP scroll read on it banks what it's earned first.
   **Slay the Hydra**, a quest on the board's Daily Quests tab, goes up once you've beaten the Cyclops;
   beat the Hydra and claim its reward there, the **Training Pit Schematic** (not an item: the pit
   just offers to build). It builds the **Training Pit** over the Sparring Pit (a stone rim ringed with
   spears, `den/training-pit.png`, the same grid) for **10 stone, 10 metal bars, 5 planks, 5 nails
   and 3 essence crystals**, once: **100 XP an hour** (`TRAINING_XP_PER_HOUR`; 🧪 the user's pick: Lv
   10→11 about 3.5h, Lv 20→21 about 8h, Lv 29→30 about 13h). Whoever's training keeps what they earned
   at the sparring rate. Saved in the tavern field (`plans`, `pit`, `training`, and `trainedXp`: the
   pit's **lifetime XP**, everything banked out of it, `logTrained`). Its window (`/training`, tapped in the
   room: taps there look past the Den's canvas for the pit) shows the pit's picture, its rate, the lifetime XP
   (plus what's training now), the creature in it, and with the plans, the schematic: the Training Pit's
   picture beside a column of material icons with have/need, "50 → 100 XP/h" and Build.
   ✅ **More slots** (the user, 2026-11-20: up to 3, a big upgrade): the Training Pit widens to 2 creatures with the
   **Pit Extension Schematic** (15 planks, 10 nails, 20 metal bars, 10 stone, 3 essence crystals) and to 3 with the
   **Grand Pit Schematic** (20 planks, 15 nails, 30 bars, 15 stone, 6 essence crystals) (🧪 Claude's costs; where they're
   found: [items.md](items.md), the Den's ladders). Each creature trains on its own clock, with its own Level up and Take
   out; all of them are away training (`PIT_SLOTS`; saved as the tavern's `slots`, the first in `training` as before
   and the others in `more`). No change to the XP rates.
   ✅ **Sending for one** (the user, 2026-11-03; `summonVisitor`, `SUMMON_PRICE`): at the repaired tavern, pay 500 gold for any visitor now, for 30 minutes (`SUMMON_STAY`; it was `VISITOR_STAY` runs before the clock), in place of one of the same kind who's in (a new one, new stock); the others stay. Two taps (the second pays). The tavern librarian's codexes are an inventory (components/LibrarianShelf.tsx): tap one to see its move in the box on top, and buy it there. The Labyrinth's librarian has the same shelf (your bag's room in place of the bookcase's).
   ⏸ **The creature collector** (away since 2026-11-18, the user: the Soul Altar's ascension is the better use for spare creatures; he's out of `VISITORS`, his code kept; as built, 2026-11-03; `lib/collector.ts`): a third visitor, dealing only in creatures (never cards). He buys a creature for `COLLECTOR_PRICES`: Common 50, Uncommon 100, Rare 250, Epic 600, Legendary 1,500 (🧪 Claude's proposal, the user's pick). Or he trades 3 creatures of one rarity, any species (`TRADE_UP_COUNT`), for a card of a random species one rarity up, freshly rolled; Legendaries can't be traded up. Not a creature in a team, in the pit or out on a run; a sold or traded creature's gear comes off and stays yours. His window: Sell / Trade up, a tab per rarity, tap creatures to pick them, then the button (Sell takes two taps). His art (the user's pick of 3 samples, 2026-11-03): a hooded figure in a cloak pinned with creature cards, holding up a glowing jar, with a walk cycle like the others (`npcs/collector.png`).
   ✅ **The Enchantress, visitors on the clock, and tavern upgrades** (the user, 2026-11-16, decision 47; built 2026-11-16; replaces the per-run roll above):
   - ✅ **The Enchantress**, a fourth visitor (built 2026-11-16, `lib/enchantress.ts`): she doesn't play; she rerolls an item's enchantment
     ([items.md](items.md) §3, Enchantments) for 1 essence crystal plus 1,000 / 2,000 / 5,000 gold by
     the item's rarity (Rare / Epic / Legendary). Can be sent for, as the others. Art: PixelLab
     samples for the user to pick; ✅ her own art since 2026-11-16 (`ENCHANTRESS`, npcs/enchantress.png and its walk: smaller than the other visitors, a hunched old woman with a lantern; the walk to be redone with the Den). Her window is like the collector's:
     your enchanted weapons and armour in tabs (worn ones too), tap one to see it, then Reroll
     (two taps; the second pays). On the clock like the others (5% a half hour to start). Claude's reading, agreed by the user: she rerolls only an item that has an
     enchantment (she doesn't add one), always to a different one, each that fits as likely.
   - ✅ **On the clock** (`onTheClock`, lib/tavern.ts): every 30 minutes of real time each visitor rolls on their own chance, so
     several can be in at once; one who comes stays that 30-minute window (a sent-for one 30 minutes
     too). Fixed per window (reloading doesn't reroll); windows missed while away are gone. No more
     roll after runs, and no pity rule.
   - ✅ As built: the windows are fixed half hours of the clock (`VISITOR_WINDOW`, counted from 1970, so
     every device agrees); each roll is seeded from the tavern's own seed (`seed`, made the first time
     it's needed and saved) plus the window's number and the visitor, and `rolled` records the last
     window rolled. The tavern's window shows who's in on one line. Several in at once each walk the
     room's stroll, spread evenly round it (`strollLoop`), each with their own ❗ and name, and a tap
     opens their own window (`/visitor?v=…`). The game checks the clock every 30 seconds while a page
     is open (`TAVERN_TICK_MS`). Saves: `guests` (one per visitor: until when, or runs left, and their
     stock), `seed`, `rolled` and `upgrades` are new optional fields; an old save's one visitor
     becomes a guest staying the runs they had left (`fromOldSave`), counted down on coming home
     (`comeHome` no longer rolls). Claude's readings (agreed by the user, 2026-11-16; the costs stay testing numbers):
     - A visitor already in (sent for, say) whose roll comes up in the next window stays to that
       window's end, keeping their stock and what you've bought. A visitor from an old save isn't
       rolled until they've gone.
     - The daily quest's merchant comes as if sent for: 30 minutes.
     - 🧪 The upgrade costs (`UPGRADE_COSTS`, a row per level): 6/8/10/12/14/16/16/14/12/12 planks,
       3/4/5/5/6/6/6/5/3/2 nails, metal bars from level 3 (2, 4, 6, 8, 10, 14, 18, 23), stone from
       level 6 (1, 2, 4, 7, 12) and an essence crystal at levels 9 and 10: the totals above, each level
       dearer than the last at the merchant's prices. An upgrade takes two taps (the second pays).
   - **Odds start at 5% each** (merchant, librarian, Enchantress; the collector's away) and the tavern upgrades
     them: tapping the tavern shows sending for a visitor and the upgrades, a row per visitor,
     +1% a level, 10 levels (15% at most), paid in materials, dearer each level. 🧪 Testing cost
     (the user's pick of the slowest pace, 2026-11-16): about 120 planks, 45 nails, 85 metal bars,
     26 stone and 2 essence crystals per visitor, planks and nails first, metal bars, then stone and
     essence at the top. Claude's sim (2026-11-16, full clears): a Cyclops run gives about 4
     planks, 3.4 nails, 1 metal bar, 0.25 stone, 0.05 essence (the Deep and the Abyss about half as
     much again); Klutz, sent out 3 times a day, about 1.5 metal bars and 0.4 stone a day; so an
     active player maxes one visitor in about 3–4 weeks.

### Daily quests (✅ the user, 2026-11-02; lib/daily.ts)

On the quest board's Daily Quests tab, above the Hydra quest. **Two a day, a primary and a
secondary, the same for everyone** (picked from the date), new at **local midnight**. Only what you
do that day counts; finish one, then claim its reward once. A ❗ on the board in the Den while one's
ready to claim. Plays offline. ✅ (the user, 2026-11-06) Coming into the Den, a small popup lists
today's quests not yet claimed, with their rewards and progress (`openQuests`,
components/DailyPopup.tsx): once a day per visit to the site, so again at midnight's new quests;
not during Klutz's tour or before your first creature. A tap anywhere closes it.

**A boss you've never beaten steps down** (the user: the Hydra to the Cyclops or Encampment):
the Abyss to the Hydra, the Hydra to the Cyclops, the Cyclops to the Encampment, until it's one
you've beaten before. You get the easier quest's reward. 🧪 The Abyss and Cyclops steps follow the
same rule (Claude's reading). Which quests you got is fixed the first time they're seen that day.

| Primary | Reward |
|---|---|
| Beat the Cyclops | a box of 5 pieces of gear, Rare or better |
| Beat the Encampment twice | a creature, Rare at most (claimed, the Soul Altar's whirl climbs to its rarity and it steps out: the user, 2026-11-20) |
| Beat the Hydra | 3 Rare or Epic weapons or armour |
| Beat the Abyss | an Epic weapon or armour piece |

| Secondary | Reward |
|---|---|
| Scan 5 new barcodes | 500 gold |
| Sell 300 gold's worth of items | the travelling merchant calls at the tavern |
| Win 5 fights in a dungeon | an XP scroll |
| Send Klutz out hunting | a bundle of one material |
| Clear 10 rooms in a dungeon | a Revival Elixir |
| Beat a mini boss | a codex, its rarity rolled |
| Summon a creature from 3 cards | 250 gold |
| Win a duel with a friend | 100 gold |
| Find a creature you've never owned | a Code Cache (at the altar) |

🧪 Claude's readings, not asked: "5 item scans" counts new barcodes (a Code Cache, sealed or not;
a rescan's gold doesn't). Rarities are rolled at the usual odds (`RARITY_WEIGHTS`) and then held
to the limits (`rollRarity`), so the box is mostly Rare; a weapon a third of the time. The
material bundle is a scan's (`materialBundle`, its rarity rolled); the codex is what a scan of the
rolled rarity gives (Epic and up: a race codex); the Code Cache is a fresh scan roll. Sales count
at home (Inventory, altar, crate, tavern, materials) and to the Labyrinth's merchant. Fights count
in any dungeon; rooms are each run's finished rooms, counted as it ends; a mini boss includes a
guarded storehouse but not the Encampment's chief. A duel counts only when won in battle. Klutz
steps down to the fights quest until he hunts for you, and duels do in a copy without online.
✅ The user, 2026-11-19: the sales quest steps down to the fights quest until the tavern's
repaired (its merchant calls there), and the summoning quest until you hold 3 cards of one
creature (`hasCardsToSummon`). Like every step down, it's settled when the day's quests are
first seen. The merchant replaces whoever's at the tavern for 2 runs; a sales quest fixed before
this rule still can't be claimed until the repair (progress still counts), and the Den doesn't
mark the board for it (`dailyNews`). A reward with no room (chest boxes, the bookcase for a
codex, the altar for a Code Cache) waits until there is.

### The campaign (✅ the user, 2026-11-16; lib/campaign.ts)

Quests that aren't daily and lead through the game, on the quest board's **📖 Campaign** tab
(`/board`, beside Daily Quests and Leaderboards: the tabs in plain words, the quests icon by the
Quest Board's title, and no title or "?" row under the tabs on any of them, the user, 2026-11-17; the tabs are
an old filer's, out to the panel's trim, the one you're on running into its page; the Den's daily popup opens
the board on Daily Quests, `?tab=daily`), once Klutz's first quest is done. Opened, the campaign shows its top,
then glides down to the quest you're on. **Five chapters**, each
leading up to a dungeon's boss (the Encampment, the Cyclops, the Hydra, the Abyss), then **Legend**,
a long last one. The user listed the quests and the kinds of reward; Claude set the order and the
numbers from a model of a normal player's progress (below). All 🧪 testing numbers.

- **Progress counts all along; rewards are claimed in order.** A quest done early shows ☑️ "Done:
  claim the ones above first". Most quests read the save as it is (levels, gold, gear worn, bosses
  beaten, the tavern), so an old save opens with most done. The rest count events from the day it
  came in (`tally`): fights won in a dungeon, new barcodes, cards got, Klutz sent, buys from a
  merchant (in the Labyrinth or the tavern), camp cages opened (the Encampment's and the large rooms'),
  golden chests opened, fights won with only effective hits, levels from the Sparring Pit, summons by
  rarity, gear Klutz brings home by rarity, each visitor seen at the tavern, and a boss beaten on a
  run with no potion drunk (`drank`: the run, by its id, a potion was last drunk on; it was `meta.runs` until 2026-11-17, which
  Encampment, Deep and Abyss runs never move on). Scans
  and cards take the larger of the save's count and the tally.
- **The screen** (redrawn by the user's brief, 2026-11-17): the quest board opens on the campaign, straight under the tabs (no title, "?" or
  empty row over it: the user, 2026-11-17). A plaque with
  the chapter, how many are claimed and a bar; then a parchment note per quest, pinned to a wooden board
  (the chapter's last a Wanted poster). Each shows its reward as a picture with its amount (coins and how
  many, the XP scroll ×n, a crate with what's inside on top and its rarities, the barrel, the key, an
  enchanted piece, the schematic), the task, and how far along: nothing for a one-off, a box per step up to
  6 (a cage each for the camp cages, opened and crossed out as you go), else a bar and the count. A claimed
  quest is faded with a green seal in its corner (off the words); the next one done glows gold with a 🎁, and a
  tap anywhere on it claims it: gold (or the schematic) at once, anything else as a box of "?"s to open one by
  one or all at once (as Klutz's armoury box; the 3D crate before it is gone), or, if it's one thing (the
  Gold Key, an enchanted piece), straight into your things with no window: the celebration showed it (daily
  rewards too; the user, 2026-11-17). First, a claim celebrates
  (components/ClaimBurst.tsx, the user, 2026-11-17): the reward's picture flies off the note to the middle, grows
  with rays and sparkles and what you got under it, then zooms off up (a tap skips it); the box opens after. Daily quests the same: each note shows its
  reward's picture (gold and how much, Klutz's box, the XP scroll…) and a claim celebrates.
  Materials in a box show how many (×4 on the slot, "Nails ×4"). ➜ goes where an unfinished one
  is done. **A reward always comes home, even into a full box** (as a run's haul does): only a codex needs
  room, on the bookcase (`rewardBlocked`). (A full consumables box held back an XP scroll, and with it every
  reward after it.) A ❗ on the board in the
  Den while the next reward is ready, and once Klutz's quest is done till the campaign's first been opened (`campaignUnseen`;
  the user, 2026-11-20: "encourage them to check it out and then go to the Encampment"; not for anyone who's claimed one);
  the first quest's ➜ (do an Encampment run) glows till its reward's claimed. Claiming opens crates and gear in the Code Cache window.
  A reward with no room (chest boxes, the bookcase for codexes) waits ("No room for it").
- **Rewards** (the user): gold for the small ones, Tattered XP Scrolls for some, better things at
  milestones; **crates** opened as you claim them (Materials, Gear, Codex: a number of things in a
  rarity band; gear gets a chest's 10% enchantment chance; Supplies: 2 Lesser Potions, a Healing
  Potion, a Revival Elixir and a torch). ✅ (the user, 2026-11-16) The gear one is the **Gear Barrel**
  and the codex one the **Codex Bookcase**; each container is shown in 3D first (components/RewardReveal.tsx:
  the crate, the barrel or the game's bookcase on the dungeon floor by torchlight; tap it, a crate's lid
  swings open or the barrel or bookcase hops), then its loot window (`rewardModel`). Fixing up the tavern pays a **Gold Key**; the Cyclops a
  random **enchanted Epic weapon**; the rubble the **Crooked Bookcase Schematic** (500 gold instead
  if you have the plans or the bookcase already, `PLANS_TAKEN_GOLD`).
- Claude's readings (2026-11-16, not asked): "upgrade your inventory slot" is a bigger bag (the
  backpack, or a slot bought); "camp cages" are any cages in an encampment; "beat X level without
  potions" is a dungeon's boss beaten on a run with no potion drunk (Revival Elixirs don't count);
  "identify creatures in the Bestiary" counts every creature in it (seen, owned or carded);
  summons are exact (the user, 2026-11-16: a Common, then an Uncommon, a Rare, an Epic, a Legendary); "level every one of Klutz's skills" is each of
  his four skills at level 1 or more; "Klutz's explorations" count his weapons and armour.

| Chapter | Quests, in order (reward) |
|---|---|
| 1 The Encampment | Do an Encampment run (50g; first since 2026-11-20, the user: `CAMPAIGN_V` 2 shifts older saves' claims past it) · Scan 3 (50g) · 3 in the Bestiary (50g) · Send Klutz hunting (scroll) · A creature fully kitted (a Rare weapon, not enchanted; 100g till the user, 2026-11-20) · Win 5 fights (100g) · Collect 3 cards (100g) · A creature Lv 5 (scroll) · **Beat the Encampment** (Gear Crate, Uncommon–Rare ×3) |
| 2 The Cyclops | Calibrate the scanner (150g) · Explorer Lv 5 (scroll) · Learn a codex move (150g) · Buy from a merchant (150g) · Summon a Common (Supplies) · Open 3 camp cages (200g) · A Rare+ weapon on (250g) · Klutz brings home Rare+ gear (scroll) · Win 25 fights (scroll) · A set bonus (250g) · 1,000 gold saved (Materials, Common–Uncommon) · The Encampment without a potion (300g) · Find the Labyrinth Stone and open the old wall (bookcase schematic) · **Beat the Cyclops** (enchanted Epic weapon) |
| 3 The Hydra | Klutz Lv 5 (scroll) · A creature Lv 10 (Materials, Uncommon–Rare) · An enchanted weapon on (300g) · Every Klutz skill levelled (an essence crystal; 300g till 2026-11-20) · Fix up the tavern (Gold Key) · A win with only effective moves (400g) · Summon an Uncommon (Supplies) · Scan 50 (2 essence crystals; 500g) · 15 in the Bestiary (scroll) · A bigger bag (500g) · 3 Sparring Pit levels (2 scrolls) · Klutz brings home Epic+ gear (Materials, Rare–Epic) · An Epic+ item on (500g) · Win 100 fights (Codex Crate, Uncommon–Rare ×2) · Open a golden chest (Gear, Rare–Epic) · 5,000 gold (2 scrolls) · The Cyclops without a potion (2 essence crystals; 1,000g) · A creature Lv 15 (Gear, Rare–Epic) · **Beat the Hydra** (enchanted Epic armour) |
| 4 The Abyss | An enchanted armour piece on (2 essence crystals; 1,000g) · Klutz Lv 10 (Materials, Rare–Epic) · Every visitor calls (2 scrolls) · Summon a Rare (Supplies) · Build 3 schematics (Materials, Rare–Epic) · Explorer Lv 20 (3 essence crystals; 2,000g) · 10 Sparring Pit levels (3 scrolls) · A creature Lv 20 (Gear, Epic) · 15,000 gold (3 scrolls) · Win 250 fights (Codex, Rare–Epic ×2) · The Hydra without a potion (Gear, Epic) · **Beat the Abyss** (enchanted Legendary weapon) |
| 5 Legend | A creature Lv 25 · Klutz Lv 15 · Summon an Epic · Klutz brings home Legendary gear · A Legendary item on (4 essence crystals) · Scan 250 (4 essence crystals; each 5,000g till 2026-11-20) · 35 in the Bestiary (all) · Explorer Lv 30 · 50,000 gold · The Abyss without a potion · A creature Lv 30 · Klutz Lv 20 · Summon a Legendary · Klutz Lv 25 · Klutz Lv 30 (crates Epic–Legendary, scrolls, enchanted Legendary gear) |

**The pacing model** (Claude, 2026-11-16; scripts not kept). Explorer XP is every fight's XP; a
creature Lv 5 / 10 / 15 / 20 / 25 / 30 needs 399 / 1,567 / 3,654 / 6,847 / 11,334 / 17,302 XP, an
explorer 640 / 2,340 / 5,040 / 8,740 / 13,440 / 19,140. A won run gives about 190 XP (the
Encampment), 620 (the Cyclops), 1,760 (the Hydra) and 4,100 (the Abyss), shared by the team. Klutz,
simulated with the real trip code (40 players, ungeared, points spread evenly, no scrolls, going
deeper as bosses fall): Lv 2 on trip 3, **Lv 5 on trip ~18, Lv 10 on trip ~70, Lv 15 in only a
quarter of players by trip 140, Lv 20 never by trip 150**; his first Rare gear on trip ~7, Epic ~35,
Legendary ~120 (half of players by trip 150). So Klutz Lv 5 opens chapter 3, Lv 10 chapter 4, and
Lv 15–30 wait in Legend (scrolls and gear make him faster; Lv 20+ is meant to be a very long goal).
Slow quests sit late in a chapter or early in the next, so none holds a boss's reward up for long.
