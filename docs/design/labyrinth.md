# The Labyrinth: runs, dungeons, rooms and bosses

Authoritative for runs as a whole: the entrance, dungeons, party, fees, room mixes, merchants, death and the haul, bosses and enemies. The walkable ("New") runs' own rules are in [walkable-layout.md](walkable-layout.md) and [walkable-play.md](walkable-play.md). Part of the [game design index](../design.md); status tags (✅ 📌 🧪 ❓ ⏸ ✗) are explained in [docs/README.md](../README.md#status-tags). **The code is the truth for numbers:** if this file and a constant disagree, trust the code and fix this file.

Moved here word for word from design.md on 2026-11-09 (the original is in [archive/2026-11-09](../archive/2026-11-09/design.md)); section numbers are kept, so references like "design.md §N" still find their place.

## 7. The Labyrinth

- ✅ **The dungeon picker** (the user, 2026-11-13; components/dungeon/Entrance.tsx): a toggle at the top, **Dungeon Crawling** (the walkable runs, by torchlight; the default) or **Speed Scroll** (the scroll map), then one row each: Encampment, Cyclops, Hydra, Minotaur (to come, greyed), Abyss, with its price (FREE or the gold) or "locked", and an (i) with the details (rooms to the boss, foe levels, team size, free runs left, foes' codexes, times beaten). Dungeon Crawling is built for the Encampment and the Cyclops; the Hydra and the Abyss say "Speed Scroll only" there. (It replaced the cards and the two "🔥 New" cards.)
- ✅ **The entrance** (the user, 2026-11-01): pick the dungeon, with its Enter button straight under it (the "?" beside it explains a run; the user, 2026-11-03), then two tabs. **Party**: Free pick
  (the default; it starts empty every time: tap the creatures that go in, up to the dungeon's team
  size) or one of **3 teams** (`TEAM_SLOTS`, lib/teams.ts: saved line-ups, up to a full
  party each; a creature can be in several). With a team picked, tapping creatures adds them to it or
  takes them out, saved at once; the screen remembers the last choice. A creature's window has
  **Add to team** (the first time, that makes Team 1; then it opens Team 1–3). Teams replaced the ★
  roster (the Inventory's ★ tab now lists creatures in a team; a team creature can't be sold).
  **Bag**: the bindle or backpack, packed there as in the Den's Bindle (components/BagPacker.tsx),
  fresh each run (teams don't remember a bag). The Inventory to pack from is laid out like the bag (5 a
  row, slot-sized, no names): drag a thing up into the bag, double-tap it, or tap it and Pack it.
- ✅ A run is a climb up a **scroll map**: you plan a route and partly see rooms ahead. The first
  step is blind. Rooms can repeat. (lib/dungeon/run.ts, map.ts)
- ✅ **Four dungeons** (`DUNGEONS`):
  - **The Encampment** (dungeon 0; the user, 2026-10-27): a new player's first labyrinth, after
    Klutz's box. 7 rooms you walk into (`CAMP_ROUTE`, the user, 2026-10-27: it should be a struggle
    to reach the chief without finding potions or some luck): rooms 1–6 are creature dens (1–2
    creatures however deep), or a stash 30% of the time (`CAMP_STASH`, 🧪 Claude's number), never
    two stashes in a row; no mysteries. Every map also has one chest (a den turned into it; the
    user, 2026-11-01), never marked on the scroll (the user, 2026-11-02: it's a find), and at least
    one stash. Up to 2 stashes are marked on the scroll (`CAMP_STASH_MARKS`), even on the blind
    first step; the chest and any other stash stay hidden (even in torch sight) till you walk in. Its first rooms ease you in like the
    Labyrinth's (below). Room 7 is the camp: its **chief**, an Uncommon in Common gear,
    Lv 5 (`CAMP_CHIEF_LEVEL`, Hard AI), with a mini boss's chest (never the Iron Cage Schematic). Beaten the first time, it guards
    2 cages (`campCages`): each a Common or Uncommon (even odds), Lv 2–4, of no race your party
    has, so you've a team of 3 for the Labyrinth. After that, one cage with a creature in it 20% of
    the time (`CAMP_REPEAT_CHANCE`). Opening a cage plays a short show (`CageReveal`): it rattles,
    then out pops the creature in its rarity's glow. Beating any labyrinth's boss opens with a
    celebration (`Triumph`: gold falling, your team cheering, rooms/finds/run number) before the
    haul (below; the user, 2026-11-01). The first 10 runs are free (`FREE_RUNS`), then 50 gold.
    - The **Labyrinth opens** once you've beaten it, or scanned 25 barcodes (`LABYRINTH_SCANS`,
      `labyrinthOpen`); anyone who'd beaten the Cyclops before keeps the way in. Until then the
      entrance shows it locked.
    - Sims (an encampment sim, since removed: a lone Rare starter in the best of Klutz's box, spamming
      its race move, no scans or pickups, heading for a stash): 27% of runs reach the chief, 13% win
      on run 1, 25% by run 4, 50% not by run 12 (Dustwraith, Veilstalker and Crystalback worst). Real
      play does far better: the user beat the 5-room version on run 1 twice, where this player won
      22% of the time. (Older, 5 rooms:) Then, with the two cage creatures in the box's leftovers, 87% of runs get through the
      Labyrinth's rooms 1–5 (a brute beats you 16% of the time, the chief ~70%); ungeared, 66%.
  Their names on screen (the user, 2026-11-03): the Encampment, **the Cyclops** (the Labyrinth below),
  **the Hydra** (the Deep Labyrinth) and the Abyss. "The Labyrinth" is still the place as a whole (the
  Den's archway, Klutz's hunts).
  - **The Labyrinth:** 15 rooms to the lair, 1 large room, enemies Lv 1–7, boss the **Cyclops**.
  - **The Deep Labyrinth:** opens after your first Cyclops clear. 15 rooms, 2 large rooms, enemies
    up to Lv 17, boss the **Hydra** (below; it replaced the Warden's pack here, the user, 2026-10-30).
  - **The Abyss:** opens after your first Deep Labyrinth clear (the user, 2026-10-26). The Deep Labyrinth
    again (same map, same creature rarities) with higher levels (Lv 15–26 by depth) and every piece
    of enemy gear a rarity up; gold ×3. Its boss is the **Warden's pack** (a Legendary plus Epic
    guards, Warden Lv 25; the user kept it here when the Hydra took the Deep Labyrinth). 🧪 The levels and gold
    are Claude's numbers.
    - **Fought 5 against 5** (the user, 2026-10-27): your whole party of 5 goes in, and foes come in
      matching numbers (`ABYSS_SQUADS`, `squadsOf`): dens 2 in the first 2 rooms, 2–3 to depth 4, 3–5
      deeper; brutes and mini bosses (and a storehouse's guard) come in pairs; encampments 3–5 (an
      ambush 3) with a 30-round fuse; the Warden has 4 guards. No two foes in a fight are the same
      species. 🧪 The counts are Claude's, about 5/3 of the usual. The user kept brutes and mini
      bosses as pairs, and the party at 5 (so no bench in the Abyss), 2026-10-27.
- ✅ **Party** (the user, 2026-11-02): the creatures that go in are picked at the entrance: 3
  (`TEAM_SIZE`; 5 in the Abyss: `teamSize`). A team holds up to 5 (`PARTY_SIZE`); a bigger team
  than the dungeon takes sends its first ones. No bench and no picking at the map (it shows the team,
  to change who leads). Entering with nobody picked asks you to pick.
- ✅ **PvP** (built 2026-11-01, waiting for its first two-player test): live duels with a friend, from the quest board. See §12.
- ✅ **Entry** (`ENTRY_FEES`, `entryFee`, the user 2026-10-31: a gold sink that grows with the loot, and a nudge to scan): the Encampment 50 gold after its first 10 free runs (`FREE_RUNS`), the Labyrinth 100, the Deep Labyrinth 200, the Abyss 500. No free Labyrinth runs; Klutz's quest run is free.
- ✅ **Room mix** (`ROOM_MIX`): creature den 40, healing pool 20, lurking brute 10, chest 10,
  stash 10, merchant 5, card witch 5.
  - **Mystery "?" rooms** (`MYSTERY_MIX`) are a gamble: 45% a mini boss, some good wanderers
    (librarians appear only here), and the rest ordinary rooms. They're meant to be high risk,
    high reward. Don't soften them.
- ✅ **Dens scale with depth** (the user's fix after progression sims): the first 2 rooms hold 1
  creature, up to depth 4 hold 1–2, deeper hold 2–3.
- ✅ **Gentle start, the Encampment's and the Cyclops' Labyrinth's** (the user, 2026-10-19, as the game felt too hard
  without scanned gear): no mini boss (nor a guarded storehouse) before room 7 (`MINIBOSS_FROM`);
  the first 2 rooms are creature dens 90% of the time (`FIRST_ROOM_DENS`, otherwise a room with
  no fight), their creatures Lv 1 60% / Lv 2 25% / Lv 3 15% (`FIRST_ROOM_LEVELS`).
  Lighter-armed foes (the user, 2026-10-26, `LIGHT_GEAR`): rooms 1–3 no weapon but all 3 armour
  pieces (they were 1–2 pieces and too easy to one-shot: the user, later on 2026-10-26); rooms 4–7 a weapon and 1–2 armour pieces; deeper as rolled. Mini bosses
  and the Cyclops are armed as ever. The piece that drops is always one they wore.
- ✅ **Map** (the user, 2026-10-19): a large room is never before room 5 (`LARGE_FROM`), and the
  scroll marks 7 corridors from the start (`KNOWN_CORRIDORS`), no two touching the same room.
- ✅ **Large rooms** (`LARGE_MIX`): Encampment (Rares guarding cages that may hold a creature you
  keep, in 3 variants: plain, ambush, rigged; no ambushes in walked runs for now, the user, 2026-11-09:
  one rolls as a plain camp, `WALK_AMBUSH`). The ambush pair stand side by side in the battle room,
  drawn like the Cyclops's hands (tap the one to hit), not as cards. The drunk one, foes on ×3 HP, was removed by the user
  on 2026-10-26: nothing answered it once damage types went), Library (codexes to find, or a librarian
  selling) and Storehouse (mostly materials, sometimes guarded by a mini boss).
  - 🧪 Content visible 50%, storehouse guard 35%, equal variant odds, and a rigged timeout ending
    the run (loot kept) are Claude's defaults.
- ✅ **Card witch:** higher or lower on cards 1–11. Each correct guess wins a creature card. Lose and
  she stabs a creature: an illness costing 15% max HP per action for 3 actions.
  - ✅ (the user, 2026-10-19) Her deck is 33 cards: 1–11 in each of three suits (Melee, Ranged,
    Magic, for variety). Every card, the first included, is drawn evenly from what's left; played
    cards are gone. The same number again ("stick") is a push: guess again.
  - ✅ Walking away (or winning all 10 prizes), she turns over the card that would have come next.
  - ✅ (the user, 2026-10-19) She offers a game; accept and it opens in a window over her room. Her card keeps the
    creature card's shape and rarity trim, laid out like a playing card: the prize's sprite in the middle, the number top
    right and bottom left, the suit (attack style) top left and bottom right. Lower to its left, higher to its right, walk
    away under it. The next prize lies face down behind it (its rarity shows); a right guess sparkles the card away and
    the one behind comes forward (`nextPrize`, components/WitchWindow.tsx).
- ✅ **The Scroll button** (looking at your map again inside) works 2 times a run (the user, 2026-10-25,
  `SCROLL_LOOKS`), and not while the map's first look at the entrance is open; tapped while the
  scroll's already out, it puts it away and costs nothing; a flare still shows
  the map on top. Every scroll (the Encampment's shorter one too) fits the window, with no
  close-up drag view. On the scroll, a stash is marked with a loot sack and a chest with a
  treasure chest (their art, also in the room's title).
- ✅ **Tools:** Torch (id `flare`: it was the Flare until 2026-10-30, and old saves are renamed on load; re-view the map and light around you, twice as far as your own light), clairvoyance scroll (reveal any room
  and its surroundings; 200 gold at merchants). Merchants carry 5 wares. Also found (the user,
  2026-10-20): a flare in 10% of stashes and 20% of chests, a clairvoyance scroll in 5% of stashes and
  10% of chests (`STASH_TOOLS`, `CHEST_TOOLS`), on top of what they already hold. A chest holds at
  most 5 things (`CHEST_SLOTS`, `capSack`): rolled more, the least rare fall out (gold first, then
  Common, Uncommon…).
- ✅ **Golden chests and Gold Keys** (the user, 2026-11-13): 10% of mini bosses (`GOLDEN_CHEST`,
  room kind `miniboss` only, rolled with the room as `Room.golden`) guard a golden chest instead of
  the rickety one. It opens only with a **Gold Key** in your bag, which is used up (no key: it stays
  locked, and it isn't in the haul). Inside: the mini boss's gold and dropped gear as usual, and,
  instead of its potions, extras and XP scroll, 5 finds rolled like a chest's but each Rare or better,
  never plain gold (`GOLDEN_DROPS`, walkRooms.ts `goldenDrops`; materials there are stone or essence
  stones). The Gold Key is an Epic tool (`gold_key`) in 10% of chests (`CHEST_TOOLS`); it takes a bag
  slot, stays in your bag between runs as tools do, and isn't sold by merchants (they buy it for 200).
  Walking, the chest is drawn gilded (the chest's art tinted gold, and the key a stand-in icon, till
  PixelLab art).
- ✅ **Selling to the merchant:** his room shows your bag (slots used/free); tap a slot and sell it to make room,
  or Use it (opens it in your bag: drink, equip…). In the merchant's or a librarian's room, your bag also has a
  Sell button, at the same prices (`buysHere`; selling to a librarian is Claude's default, 2026-10-23). A codex
  can't be bought with a full bag (the user, 2026-10-23).
  - ✅ Prices (decided 2026-10-19; `merchantOffer`, lib/dungeon/run.ts): weapons and armour at the crate's sell price; potions, materials,
    scrolls and tools at half his price (`MERCHANT_BUYBACK`); codexes at half the librarian's. Klutz's club can't be sold.
    Claude's defaults, added 2026-10-19.
- **The bigger merchant** (the user, 2026-10-23; the Labyrinth's and the tavern's alike; the user
  wants him to keep growing). ✅ Built: the 10-slot cart (`MERCHANT_SLOTS`, always 10 spaces shown):
  always a Healing Potion, Lesser Potion and Torch; rare wares rolled one by one (backpack or, once
  owned, a backpack upgrade 20%; each storage schematic 20% until bought (once built, its dearer second one); Revival Elixir 25%; XP
  scroll 20%; clairvoyance scroll 40%); materials fill the rest.
  🧪 **Tavern material prices** (the user, 2026-11-02: at the Labyrinth's prices you'd buy the lot
  every time; 500 for an essence stone is the benchmark): planks ×5 150, nails ×5 100, metal bars
  ×2 300, stone 300, essence stone 1,000 (`TAVERN_MATERIAL_PRICES`, lib/tavern.ts; Labyrinth 40 / 30 / 90 / 150 / 500;
  stone and essence stones the user's, 2026-11-03). Essence stones are on only 1 cart in 3 (`chance` in `MERCHANT_MATERIALS`). He buys materials back at half the Labyrinth's price at both.
  ✗ Dropped (the user, 2026-11-04: armour comes at the right rate as it is): gear on the cart
  (0–2 weapons or armour pieces at 2× the crate's value) and armour priced like weapons
  (`PIECE_VALUE` stays).
- ✅ **Death / retreat:** a party wipe ends the run. Items left on the room floor are lost; what's in
  your bag comes home. Retreating keeps the witch's winnings. Going back to the Den mid-run is a
  retreat (after a "Leave the labyrinth?" check): runs can't be paused.
- ✅ After a boss clear, **the haul** (the user, 2026-11-02: one looting screen, then home; it
  replaced the boss room's chest, the summary and the walk back): your bag's free space, then the
  boss's chest (and the Encampment's cages), then everything you left on the floors. "Sort" opens
  either one to take things into your bag or put things down; then **Return to Den** (a check
  first if anything rare is left). Only what fits in your bag comes home; gold and creature cards
  come free, the rest stays (the user, 2026-10-26: on 2026-10-23 everything came home, but most of
  it was junk). The Cyclops' first rugged backpack goes on straight away.
- ✅ **Healing pool (Den):** heals 25% HP an hour on one global clock, runs included.
  - 🧪 The rate is Claude's default (the user said "slowly"). The user plans upgrades and elixirs,
    and may use it as a monetisation lever later. The instant heal at the entrance is a testing
    shortcut.
  - 🧪 **For testing, everyone comes home at full health** (`HEAL_AT_HOME` in lib/dungeon/run.ts,
    on since 2026-10-19). Set it to `false` to bring the pool back.
  - 🧪 Kept on for now (the user, 2026-10-20: healing after death "stays as it is now"; the other
    options, a slow pool 25%/h, a faster pool 50%/h or a quick heal to half then the pool, set
    aside). **It's a testing convenience, not the settled design** (the user, 2026-11-09): the game
    labels it so ("🧪 Testing: everyone comes home from the Labyrinth at full health for now",
    app/pool), and the pool above is what it switches back to.
- ⏸ **Re-entry cooldown** as the anti-farming bar: set aside (the user, 2026-11-04). The gold fee
  is the bar, and that's enough for now. (Its cooldown potions were to come from the barcode
  merchant, since dropped.)
- ✅ **The Labyrinth's look** (the user, 2026-11-09): a stylised 2D three-quarter-perspective dungeon
  giving an illusion of depth ([walkable-play.md](walkable-play.md) §5,
  [world/rendering.md](../world/rendering.md)). Voxel-style rendering is not the objective (it was
  once noted as a likely long-term direction, never committed).

### Bosses

- ✅ **The Cyclops** (lib/creatures/bosses.ts, lib/combat/bossAi.ts), each phase with a full health bar:
  1. A melee tank. Stomp (about 1 in 3) can cripple you, so swap out. It has an occasional costly Eye Laser. (A Meditate heal with a
     3-turn cooldown was decided too, then dropped by the user, 2026-11-04: its strength is right.)
  2. At half HP it becomes **2 crawling hands**, both on the field at once (you pick a target):
     fast, strong melee.
  3. Then **the Eye** leaves the skull: ranged, in Float stance, with very high melee defence.
  - It's meant to take a few attempts (sims: a median of about 12–13 runs to the first kill).
- ✅ **The Hydra** (the Deep Labyrinth's boss; the user's spec, 2026-10-30; `HYDRA` in
  lib/combat/bossAi.ts, `HYDRA_PARTS` in lib/creatures/bosses.ts). Lv 16, no race.
  - **Three heads, all on the field**, left to right as drawn (the user, 2026-11-04): the Spitter
    Head (ranged), the Hex Head (magic), the Fang Head (melee). You tap a head (or its label) to aim
    at it. ✅ **Weak spots, no resistances** (the user, 2026-10-30): every head has the same defences,
    and each takes **1.5×** from the style that beat its own in the old triangle (`weakTo`,
    `WEAK_SPOT` in lib/combat/engine.ts): the Fang Head from magic, the Spitter Head from melee,
    the Hex Head from ranged.
  - **One head acts a round**, always left to right, starting from a random head; a head that's
    down is skipped.
  - **Toxic Breath:** once, in a random round from 3 to 5, the head whose turn it is breathes
    instead. The cloud hangs for 3 rounds: your creature on the field, and every creature that
    comes in while it hangs (a swap or a replacement), is poisoned for **2.5% of max HP a round for
    20 rounds** (50% in all). A creature that's already poisoned isn't poisoned again. Once a cloud
    has cleared, each turn has a 20% chance of another breath.
  - **Heads grow back** 5 rounds after one goes down; another head going down starts the count
    again. One head grows back with 75% HP, two with 50% each. All three down at once kills it.
  - 🧪 Its numbers (head HP, attack, defences, the moves' damage) are Claude's, set against the
    Warden's pack by sim (since removed; 200 fights: an Epic and two Rares, Lv 16, in Rare gear,
    full health, no potions, the Normal AI): the party beats the Hydra 56% of the time, the Warden's pack
    40%; 17–18 rounds. (With resistances as well, before the user dropped them: 29%.)
    Then the user had every head's HP raised 25% (longer fights, so the poison does more): the
    party now beats the Hydra 23% of the time (the Warden's pack 38%), in about 20 rounds (150 fights).
  - ✅ Art (the user's pick, 2026-11-04): one Hydra, four legs and a tail, three necks from the
    shoulders, green acid on the left head, purple magic on the middle one. Drawn whole (192×160)
    for each of the 8 mixes of heads cut off, a cut head a bloody stump
    (`public/sprites/creatures/hydra/hydra-<spitter><hex><fang>.png`, 1 = cut; `hydraSprite`;
    `HydraBody` in components/BossStage.tsx). The heads' names and health sit in a row above it.
- ✅ **Boss rewards:** the boss chest (10 rolls, plus a scroll chance) and the Rugged Backpack. The
  Hydra and the Warden drop a strongbox.
- ✅ Also Cyclops rewards: building the **Tavern** (via the tavern questline in §9, not gold), and
  the **trophy** showing which run you won on: the Cyclops Head (§9, step 7), mounted in the
  tavern's room marked "Run N" (`meta.firstClearRun`).
- 🚧 **The explorable (walkable) Labyrinth**: see [walkable-play.md](walkable-play.md) (what it is, walking, fights, loot, light, art) and [walkable-layout.md](walkable-layout.md) (how its layouts are rolled). Its technical rules (world units, placement, saved placements, versions) are in the [world specification](../world-spec.md).

### Enemies

- ✅ **Enemy rarity by room and depth** (the user, 2026-10-19; `DUNGEONS[d].foes`, `foeAt`). Every
  enemy wears a full kit (weapon + whole armour set). Each has a chance to **step up** one rarity,
  creature and gear together (`STEP_UP` 20%):
  - Labyrinth dens: Commons in Common gear; rooms 1–3 never step up.
  - Labyrinth brutes: Uncommon to room 6, then Rare (in matching gear). Encampments: Uncommon
    to room 6, then Rare creatures in Uncommon gear (no step-up).
  - Labyrinth mini bosses: Rare in Rare gear, no step-up.
  - Deep: dens Uncommon, brutes Epic in Rare gear, encampments Epic in Rare gear, mini bosses Rare
    in Rare gear with 30% Epic.
  - Sim (60 players × 25 runs, no scans): a lone starter beats a first-room den 75% (was 67%);
    players with a Cyclops clear by run 25: 28/60 (was 16/60); the Cyclops itself is still beaten
    only ~15% of attempts. (The shelved alternative, shrinking enemy gear by level, was tried and
    dropped as too complicated.)
- ✅ **Enemy gear drops** (the user, 2026-10-19; `ENEMY_DROP_CHANCE`): every enemy you fight has a
  20% chance to drop one of its 4 equipped items when you win, each 1 in 4: weapon, helmet, chest
  or legs (chosen when the room is made, `dropSlot`). It goes in the fight's sack. One item per
  enemy at most. (Was 5%, brutes only.) Easy fights' 5% upgraded piece (`UPGRADE_CHANCE`) still
  drops, picked the same 1-in-4 way. The Cyclops has no gear, so no change there.
