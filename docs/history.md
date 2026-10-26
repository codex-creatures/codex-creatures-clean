# Codex Creatures: design history

Passages moved out of [design.md](design.md) on 2026-10-27, word for word, so that file can stay a
description of the game as it is now. This is the long story: change rounds, superseded plans and
old sims. **Claude: you do not need to read this file for normal work.** Look here only when the
user asks how or why something came about, or before reopening something design.md says was tried.
design.md wins wherever the two disagree.

## "Just changed" list (2026-10-26)

- **Just changed (the audit, 2026-10-26):** Klutz shows no race; Rabid Bite is for Beast, Underkin
  and Toxic; codexes say who can read them; every move has a description; enemies' moves scale with
  level; a rare move fills the empty 4th slot; drunk encampments are gone; no more resting (every
  set keeps a move of 30 energy or less); a fight's dock says who used what; fixed-size text boxes
  on cards, move tablets, the loot window, the item window and the gear picker.

## Combat V2: the full section as it stood on 2026-10-27

### Combat V2: races replace the triangle (✅ live since 2026-10-26)

- ✅ **Switched on** (the user, 2026-10-26): "replace everything with the new races, creatures and
  combat changes", with **new saves for everyone** (it's only the user so far). `LIVE_RULES` is
  races on ("drafted": each move's own race), triangle off, damage types off. The 35-creature roster
  is `CREATURE_TEMPLATES` (scannable, in the Labyrinth, with Klutz). The 25 older species as they
  were are kept as `PRE_V2_SPECIES` for tests of battle mechanics.
- ✅ **Fresh saves:** the save keys moved (`codex_creatures_save_v3`, `_registry_v3`, `_battles_v2`,
  `_slots_v2`, `_slot2_<id>`), so every address starts at the title screen with no saves. The old
  saves stay in the browser under their old keys, unread. Save files from before V2 (version 1)
  are refused with a message (`FIRST_READABLE_VERSION`).
- ✅ A creature is born with its species' **3 starting moves** (`STARTING_MOVES`, the first 3 of its
  kits). Its fourth slot stays empty until it reads a codex, and the rest of its race kits need
  codexes too (`movesAvailableTo`: born moves + learned). Klutz still starts with 4.
- ✅ The **guided first fight** teaches races: the Baby Cyclops thief is Humanoid; Klutz has you use
  Tunnel Rush (Underkin, resisted) and then Gore (Beast, effective), then lets you finish. The
  Cyclops and the Warden's pack themselves still have no race (neutral).
- ✅ **UI:** moves show their race where they showed a damage type; creatures show both races (one
  chip, "Geo / Beast"); the race filter matches either race. In a fight a move's details (behind the
  (i)) say how its race lands on the foe; there's still no hint on the tile itself. Weapons no longer
  show a damage type. The Bestiary's "How fights work" has the race chart and a race calculator.
- ✅ **The user's changes after first play** (2026-10-26):
  - Pestilence is renamed **Toxic** (id `toxic` too; races aren't stored in saves).
  - **Race colours** (`RACE_INFO`): Undead bone grey, Divine light gold, Beast green, Underkin
    brown, Geo red, Humanoid blue, Toxic purple; **Balanced** (no race) slate grey
    (`BALANCED_INFO`). Move tablets are cut in their race's stone, with a big icon for the style
    behind the name (impact: melee, arrow: ranged, bolt: magic; the old damage-type shapes). Style
    colours are now one neutral cream, so they don't clash with the races.
  - **Balanced moves:** each style's 20-energy light move is now one shared move with no race
    (Strike, Shot, Zap: `BALANCED_MOVES`; names are Claude's), neutral against everyone. The old
    light kit names are retired (`RETIRED_KIT_MOVES`: a creature that knew one has its Balanced
    move instead). The kits are now 7 × 3 × 4 race moves + 3 Balanced = 87.
  - ~~Starting moves: Balanced 20, race 30, a fourth, and the race's quick move.~~ Replaced, below.
- ✅ **The user's second round of changes** (2026-10-26):
  - **Balanced is now called Neutral** on screen (moves with no race, and Klutz's badge). In code
    it's still `BALANCED_MOVES` / `BALANCED_INFO`.
  - **Neutral priority moves** (`NEUTRAL_QUICK_MOVES`): Rush, Quickshot and Blink (the older haste
    spell called Blink is now **Quickcast**; saves are moved over), 15 damage for 50 energy, always first. Two priority moves in
    one round: the faster goes first (as before).
  - **Starting moves**, every V2 creature, all in its main style: Neutral 20 (Strike/Shot/Zap), its
    race's 30, and the Neutral priority move. That's 3; the fourth slot needs a codex.
  - **Race-kit codexes** (the 84 race moves of the kits, `KIT_RACE_MOVES`): only a creature with
    the move in its kits can read one (its race, in its style). From scans by the usual split
    (up to 20 damage Common, heavier Rare: `KIT_BASIC_CODEXES`/`KIT_STRONG_CODEXES`), and from
    librarians, chests and the Cyclops alongside the older race codexes (`RACE_CODEX_MOVES`).
    🧪 A librarian's kit codex costs 200 (`LEARNABLE_CODEX_PRICE`; Claude's draft).
  - **Saves:** creatures and cards from before this go back to their starting 3 once on load
    (`upgradeMoveSet`, `moveSet` = 2; their chosen slots cleared, codex-learned moves kept). The
    user chose this over keeping their 4.
  - **Fights:** a hit's popup says **EFFECTIVE!** or **RESISTED** under the damage when its race
    lands that way. Name plates: level and name, then the races spelled out, then the health bar.
  - The **Deep Angler** is a melee Battlemage, not a ranged Spellbow (its ranged % moved to melee),
    so the archetypes are no longer even: 5 Battlemages, 3 Spellbows. The Deep Angler, Rotgut Fly
    and Dust Sprite PNGs are mirrored.
  - **Cards** show the race(s) in the two squares under the sprite, in the race colours (one race:
    one wide square); the style is no longer on cards. Creature windows and fight name plates show
    races instead of the style.
  - A **race chart button** (▲▼) in the fight dock on Labyrinth (Cyclops) runs.
- 🧪 Soul stone pools for the six new Rare+ creatures are Claude's drafts (lib/creatures/soulStones.ts).
- 🧪 Sim of the live roster (2026-10-26, `scripts/sim-races.ts`, "V2: drafted moves"): creature
  spread within a rarity 3.3 (it was 6.3 with today's 25 and their old moves; the Ironhide is no
  longer an outlier); the race edge wins 72% of even duels; swapping no longer pays (50%).


- 📌 Decided (the user, 2026-10-26): **magic stays** as a third style; the **class triangle goes**,
  replaced by race effectiveness. 7 races: Undead, Divine, Beast, Underkin, Geo (elemental, not
  just stone), Humanoid, Toxic. Creatures have 1 or 2 races. Every current creature is kept
  and re-raced (`SPECIES_RACES`, lib/creatures/racesV2.ts; the user's example: Crystalback is
  Geo/Beast; the rest is Claude's draft).
- 🧪 Multipliers **1.25× effective / 0.8× resisted** (`RACE_EFFECT`); dual races multiply. The user
  picked these for playtesting (2026-10-26) over the first choice, 1.4× / 0.75×: in the sims the race
  edge drops from 74% to 68% of even duels, and gear a rarity better can make up for a bad matchup.
  Sims also showed swapping matters less in V2 than today (the swapping side wins 49%, not 56%).
  The chart (`RACE_BEATS`, lib/combat/raceChart.ts) is Claude's rebalance of the user's first
  draft: each race beats 3 and is weak to 3, with 4 mutual pairs.
- 🧪 Matching-race bonus 1.15× (`MATCH_BONUS`), once.
- 📌 **Race kits** (the user, 2026-10-26; lib/creatures/raceKitsV2.ts; the light move is now
  Balanced, see above): every race has 5 moves in each style (7 × 3 × 5 = 105): a 20, 30 and 50 energy move (10/15/25 damage), a **quick attack**
  (20 energy, 8 damage, always strikes first) and a **precise** move (30 energy, 15 damage, 70% to
  hit, always precise). The user will add more moves on top. 🧪 The names are Claude's drafts.
- 📌 **No damage types in V2** (the user, 2026-10-26): Force / Pierce / Arcane go; a move is just its
  style and its race. The switch is `damageTypes: false` in `CombatRules` (engine.ts).
- 📌 **35 creatures**, one of each rarity per race (lib/creatures/rosterV2.ts, `ROSTER_V2`): today's
  25 plus 10 new: the user's Flame Imp (Geo Uncommon), Glob (Toxic Rare) and Dreadpox
  (Toxic + Undead Epic), and Claude's drafts Gleamling, Thunderhead, Deep Angler, Tunnel Wyrm,
  Plague Rat, Rotgut Fly and The Pale Rider (art: PixelLab, the user's picks, 2026-10-26). The
  user will re-race them. Veilstalker moved Undead → Divine so Undead didn't have two Rares.
- 📌 **The user's race pass** (2026-10-26): Rust Beetle is Underkin only; Hollow Matriarch Underkin +
  Beast and melee; Flame Imp Geo + Divine; Veilstalker Divine + Underkin; Void Serpent Divine + Beast;
  The Watcher magic, not ranged; The Pale Rider Undead + Humanoid (so Undead has two Legendaries and
  Toxic none; the user is fine with lopsided races). Dust Sprite stays Geo. The rest waits for
  the user to see sprites. V2-only style changes are `V2_RESTYLE` (lib/creatures/rosterV2.ts): the
  main % moves to the new style, total unchanged.
- 📌 The Cave Bat is now the **Cave Goblin** (the user, 2026-10-26: pale skin, big eyes, like Klutz
  but meaner; PixelLab sample 11). It stands rather than floats. Same id (`cave_bat`), stats and moves,
  so owned ones just change.
- 📌 **Archetypes** (Claude's draft, approved by the user 2026-10-26, `ARCHETYPE_INFO`): Bruiser, Bulwark (melee tank), Sniper,
  Skirmisher, Arcanist, Warden (magic tank), and the hybrids Ranger (melee + ranged), Battlemage
  (melee + magic) and Spellbow (ranged + magic). An archetype decides which style kits a creature
  draws from, so a hybrid fights in two styles. Evened out (the user asked, 2026-10-26): 4 of each, 3
  Snipers. Crystal Golem and Tunnel Wyrm became Wardens, Dustwraith and Gleamling Spellbows.
- ❓ `MOVE_RACES` gives the older moves (codexes, Klutz's, learnable ones) draft races. Race move
  rules beyond the kits are still open.
- The switch is `setCombatRules` in engine.ts (the live game: `LIVE_RULES`; the old rules:
  `TRIANGLE_RULES`). Sims: `npx vite-node scripts/sim-races.ts [scale]` ("Old (triangle)" there is
  the old rules on the new roster).

## The bigger merchant: the full spec (the user, 2026-10-23)

- **The bigger merchant** (all decided by the user, 2026-10-23). Applies to the Labyrinth merchant
  and the tavern merchant alike. The user wants the merchant to keep growing.
  ✅ **Steps 1 and 2 built (2026-10-25):** the 10-slot cart (`MERCHANT_SLOTS`), the always-wares,
  and the rare wares (backpack upgrades, both storage schematics, the Revival Elixir, scrolls).
  Materials (one stack of each kind, as before) fill the slots left. The cart always shows 10
  spaces (empty ones greyed). A storage schematic you hold or have built isn't shown.
  📌 **Not built yet:** step 3 (gear on the cart), step 4 as specified (3–5 material stacks with
  repeats), and armour priced like weapons.
  - **Cart: 10 slots**, filled in this order:
    1. Always: Healing Potion, Lesser Potion, Flare.
    2. Rare wares, each rolled on its own: the backpack (until you own it) or, once you do, a
       **backpack upgrade** 20%; the **weapon storage schematic** 20% and the **armour storage
       schematic** 20% (each until bought); the **Revival Elixir** 25%; XP scroll 20% and
       clairvoyance scroll 40% (as now).
    3. **Gear:** 0–2 weapons or armour pieces, rolled like a scan (normal rarity odds,
       `RARITY_WEIGHTS`, with **no explorer-level gate**: price is the filter), sold at **2× the
       crate's sell value**.
    4. **Materials:** 3–5 stacks, repeats allowed (each bought separately). They fill what's left:
       the rarer rolls above push materials off. Never more than 10 in all.
  - **Backpack upgrades:** +1 slot each, from the backpack's 5 up to **8** (3 upgrades), at
    **1,000 → 1,500 → 2,000** gold. Only once you own the backpack.
  - **Storage schematics** (two, separate, one-time): weapon box and armour box, each 50 → 75
    (`BOX_CAP` is shared today; consumables stay at 50). Bought for **2,000 gold**, built at home
    like the other schematics for **10 planks, 10 nails, 1 essence stone**.
  - **Revival Elixir:** revives one knocked-out creature to **50% HP**, **between rooms only**
    (not in battle). Takes a bag slot like a potion. **500 gold** at the merchant (25% of carts);
    also in **20% of mini-boss chests** and **50% of boss chests**.
  - **Armour priced like weapons:** an armour piece's sell value stops being a third of a set
    (`PIECE_VALUE` in sell.ts goes), so armour is worth the same as a weapon of its rarity. The
    user accepts the knock-on: armour sells for 3× more everywhere (crate, merchant, tavern), so
    gold from selling gear roughly doubles. If gold starts to feel too easy, tune the 2× mark-up
    or crate prices, not this.
  - Rough prices at 2× (estimates from the formula; a typical roll is about half the max): weapons
    Common ~100, Uncommon ~200, Rare ~500, Epic ~1,500, Legendary ~5,000 (a great roll about
    double). The user's own save for scale (2026-10-23): Cyclops beaten, backpack, tavern, a team
    around Lv 8–18, about 5,000 gold.
  - Build notes: the cart screen needs a grid for 10 wares (like the bag's slots), keeping the
    fixed-structure rule; ware keys must stay unique with repeated materials; old saves' carts
    (5 wares) must still load. Run a quick sim of cart prices when building.

## The shelved explorable Labyrinth (2026-10-19)

- ⏸ **Shelved (2026-10-19): an explorable Labyrinth** (the user's sketch: [ideas/labyrinth-v2.png](ideas/labyrinth-v2.png)).
  Rooms of different sizes joined by corridors, walked by a little person (tap to move); one-way
  points going up (no going back), sideways moves allowed; pools, chests and the witch *inside*
  rooms (tap them), some rooms empty; the first Cyclops run twice the sketch's size; the scroll and
  flares still give a peek. Estimate: 8–12 sessions (generator, movement, room objects, saves,
  ~50–100 PixelLab generations). If picked up: a 1-session throwaway prototype in /lab first.

## Klutz skill points: the pre-V2 sim (2026-10-20)

  - **Skill points** (decided 2026-10-20, replacing the even 9s): he's a **Rare**, his %s start at 0,
    and he earns 6 points a level over 1 (84 at Lv 15, about a Rare's total; `POINTS_PER_LEVEL`).
    In his stats window, tap a stat to add 1% (attacks on the top row beside the points left;
    defences and agility below), then Confirm or Cancel; the stat bars preview it. A re-spec gives
    every point back for 1000 gold. Old saves get all their points to spend. His weapon and the
    codexes you teach him still decide most of how he fights. He can learn any style's codex (no race moves, no
  race-kit moves), and starts with Slash, Heavy Blow, Jab and Stone Throw. (The sim below is from
  before Combat V2.) Sim (2,000 hunts,
  Lv 1–30): 67–72% wins, as before, but about 50% against magic instead of 26%. That lower magic
  number is only because no magic creature is Common (at equal rarity magic is one of his better
  matchups); the user chose to leave the roster as it is (2026-10-20).

## Tavern questline stage 3: how the second room came about (2026-10-20)

3. ✅ **Rubble.** A pile of rubble on the Den's right-hand wall, between the bookcase corner and the
   merchant (the user's sketch: [ideas/den-second-room.png](ideas/den-second-room.png)). The
   boarded-up tavern doorway goes. Using the dynamite on it (once) blows it open with an
   explosion and leaves a passage into a second room behind that wall. **Until then you can't see
   or pan over the second room at all.** It isn't a general destructible-walls system.
   🧪 Built as a rubble-choked doorway on the right wall (code-drawn, between the shelves and the
   merchant; the old boarded tavern opening is gone). Its label says "Rubble"; with the dynamite,
   tapping it offers "Use the dynamite": a flash and a shake, then it's an open passage.
   🧪 **For now the second room is its own screen (`/tavern`), reached through the passage**, not
   part of the Den you pan over: making the Den's picture bigger would slow it on phones. To revisit
   with the art pass.
   ✅ (2026-10-20) The room is now drawn as the Den's own cave with nothing in it (`createDen({ bare })`:
   walls, floor and torches; no furniture, pit, pool, archway, cage or rubble), with the tavern,
   head and visitor standing in it (`components/TavernRoom.tsx`, `RoomSpot`).
   ✅ **The room strip** (the user, 2026-10-20): once the rubble's open, the Den and the tavern's room
   sit **side by side** in one view you drag across (`DenRoom`'s `annex`). Each room is its own
   picture, so a room added later doesn't slow the others; the tavern's room is only built once
   it's open. Tapping the passage slides the view over; tapping in the tavern's room opens the
   tavern's window (`/tavern`: repair, bounty, trading). Meant to grow into more rooms later.
   ✅ **Straight through the doorway** (the user, 2026-10-20): the tavern's room now lies directly
   behind the Den's right wall, so you drag up and to the right to see it. A wall one floor unit
   thick (`PASS` in lib/den/scene.ts) separates them; the open doorway is see-through, showing a
   short lit passage into the room. The Den is drawn over the tavern's room so its wall hides the
   near side.
   📌 Future look (not now): the user's [ideas/future-dungeon-direction.png](ideas/future-dungeon-direction.png)
   is the likely long-term style for viewing the base; this layout stays until then.
   🧪 Testing tool: the altar's "🧨 Open the rubble" opens it at once (`forceOpen`), as if the quest
   and dynamite were done.
   🧪 Testing tool: the altar's "🍺 Call a visitor" (`callVisitor`) opens and repairs the tavern and
   has the merchant (or, if he's there, the librarian) call now. Visitors stand out front by the
   door, at 1:1 scale.
   📌 **Building the room up, one shippable stage at a time** (the user, 2026-10-20): 1 ✅ the bare
   cave; 2 ✅ PixelLab tavern art (one picture, greyed while broken); 3 mounted head art (the
   poster was dropped); 4 ✅ a sliding walk-through from the Den's passage; 5 ✅ one strip you drag across
   (watch phone performance); 6 the tavern's interior (needs design).
