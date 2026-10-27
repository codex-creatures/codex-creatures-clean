# Codex Creatures: game design

This is the agreed design **as it stands now**, with how far each part has got. Keep it that way:
each decision once, in its current form, with a short reason (and anything tried and rejected, so
it isn't proposed again). Change rounds, superseded plans and old sims go in
[history.md](history.md), which Claude doesn't need to read for normal work. It's gathered from the design decisions
made with Claude through October 2026, and the built numbers were checked against the code on
2026-10-26 (after Combat V2 and the audit that followed it). **The code is the truth for numbers:** if this file and a constant disagree, trust the
code and fix this file. Constants are named in `code font` so you can grep for them.

**Status tags**

- ✅ **Built**: in the game now.
- 📌 **Decided**: the user has agreed it, but it isn't built (or only partly).
- 🧪 **Provisional**: built, but with numbers Claude picked as a default or that are still being
  balanced. Fine to tune, but say so.
- ❓ **Open**: the user hasn't decided. Ask; don't pick.

Ideas the user floated but never confirmed are listed as ❓, not as decisions.

## Where things stand (2026-10-26)

- **Live:** Combat V2 (7 races, 35 creatures, race kits, codexes for the rest of a creature's kit),
  soul stones, the Labyrinth / Deep Labyrinth / Abyss, Klutz and his hunts, the tavern questline
  (stages 1–9), save slots, Vercel hosting.
- **Recent changes:** see `git log` (the commit messages say what changed for the player).
- **Next (📌, decided, not built):** the merchant's gear wares and armour priced like weapons (§7),
  the barcode merchant (§2), the onboarding scan gate (§2), the re-entry cooldown (§7), the
  Cyclops's Meditate heal (§7), more soul stones and effects (§4, §6), the tavern's interior (§9),
  Klutz's kidnap plan (§8).
- **Open (❓, the user's call):** what Klutz gets in place of his old counter bonus; agility doing
  more; race-move rules beyond the kits; shared barcode lists once there's a global registry;
  longer Klutz walks; a creature trader.

---

## 1. Core idea

- ✅ Creatures and items have always lived inside barcodes. Scanning a real barcode opens a
  **Code Cache** with what that barcode holds. Scanning stays the most effective source of items
  forever, even as other sources grow.
- ✅ Battles give scanning a purpose: you take a team into the **Labyrinth**, a roguelike climb of
  rooms to a boss.
- ✅ Home is the **Den**, a gloomy cavern you move around (pan/zoom map) with places to visit.
- Design goal (the user's): attachment to *individual* creatures, and team building plus
  outplaying should decide fights, not rarity alone.

## 2. Barcodes and scanning

- ✅ **The barcode number must not decide the outcome.** The first-ever scan of a barcode rolls its
  outcome at random and registers it. Everyone who scans it later gets the same outcome (item kind
  and rarity, or creature species) but their own stat roll. Rescanning a barcode you already own
  gives gold, never a new item or a reroll. (lib/barcodeRegistry.ts)
- ✅ The registry is **local** for now (`codex_creatures_registry_v3`). "Reset player" keeps it,
  to simulate a friend; "Global reset" clears it.
- 🧪 Outcome odds (`SCAN_ODDS`, 2026-10-20, for playtesting): 40% creature, 13% weapon, 26% armour,
  7% consumable, 6% material, 7% gold, 1% soul stone (2026-10-25, first scanner only). Aim: about 1 legendary creature or card per 250 scans (from
  explorer level 12); a real creature every 12–13 scans. Players will also hunt legendaries with good
  rolls, so the chase goes on past the first. Shared barcode lists (once there's a global database)
  are an open risk: ideas are seasons, limited stock, or the legendary species rolled per player.
- ✅ Labyrinth chests keep the original table (`CHEST_ODDS`): 20% creature, 12% weapon, 24% armour,
  12% consumable, 12% material, 20% gold. Creatures found in the Labyrinth always come as cards;
  only encampment cages hold real creatures.
- ✅ **1 drop per new scan** (`SCAN_DROPS`). Items should stay scarce; gold scans are the
  "dud" consolation.
- ✅ The altar (layout 2026-10-20): a big **Scan Barcode** button, the Looting/Storage toggle, and a
  3×3 loot window (one empty row of 3 until something's in it). **Looting** opens each Code Cache
  at once: the find goes straight to your things and the window shows this visit's latest 9,
  cleared when you leave. **Storage** keeps caches in the window, at most 9 (`CACHE_LIMIT`); when
  full, open some before scanning. Typed barcodes (Repeatable by default, or Random) sit at the
  bottom as a testing tool.
- ✅ **Items discovered** counts every kind of item: weapon and armour types, materials, potions and
  codexes (lib/items/discovery.ts). The save remembers kinds you've used up (`found`).
- ✅ Scanned creatures: 20% are a real creature, 80% a **creature card** (`REAL_CREATURE_CHANCE`).
  In the loot window a real creature shows as the creature itself (its sprite, its plain name), a
  card as the card.
- ✅ Your **explorer level** caps how rare a creature you can take from a barcode **someone already
  found** (`SCAN_UNLOCK`: rare at Lv 2, epic at 6, legendary at 12). That barcode stays sealed: it
  doesn't count, and the altar shows the level needed. **Being first beats the cap** (2026-10-20):
  a barcode nobody has scanned rolls at the usual odds and is yours whatever it is
  (`scanBarcode`). Locally "someone" means any earlier player in this browser's registry.
- 📌 **Barcode merchant:** 10% of scans, taken from materials and consumables. The planned split
  is creature 20 / weapon 15 / armour 15 / material 10 / consumable 10 / merchant 10 / gold 20.
  Not in the outcome roll yet.
- 📌 **Onboarding scan gate**, deliberately unconventional: the game stays locked until you scan a
  real barcode, then Klutz drags you out of the labyrinth. Don't "fix" this for convenience. Edge
  cases still need solving: manual entry, no camera, app-store review. Not built: a new game starts
  at the Den.
- 📌 **Future online version:** a real global registry, which needs a server; sealed offline scans
  in an "Offline Scanner Sack" that open when back online, still counting against scan limits.
  ❓ This conflicts with today's offline-only rule, so it needs the user's go-ahead before any
  work starts.
- ⏸ **Scanner / camera work is parked.** It's fragile, and better scanning plus fake-scan detection
  is a future project. Test with manual barcode entry.

## 3. Items

### Stat rolling: the user's most carefully balanced system. Don't change the numbers unasked.

- ✅ Rarity odds 40/30/20/9/1 (`RARITY_WEIGHTS`, shared by items, scanned creatures and Klutz's
  encounters, so changing it changes all three). Use whole-number weights.
- ✅ Stat budgets by rarity: 60/80/100/120/150 (lib/items/budgets.ts).
- ✅ The roller (lib/items/rollConfig.ts and rollItemStats.ts):
  - +1 to each of the 2 primary stats;
  - chunks of 5–20% of the *original* budget, rounded up and clamped to what's left;
  - 20% chaos / 80% weighted toward room left (^0.6);
  - the total comes out exact.
  - A Legendary Void Scythe with Attack ≥ 100 about 1.1% of the time is intended. Impossible
    configs (ceilings summing below the budget) throw.
- ✅ Tests lock these numbers (tests/rollSystem.test.ts and others).

### Gear

- ✅ 15 weapons and 7 armour sets (helmet / chest / legs).
- ✅ **Armour pieces roll in full** (decided 2026-10-19, so armour doesn't look weak next to
  weapons): every piece rolls the whole budget (60–150) within its armour's ceilings, and the slot
  doesn't change what it can roll. Defence counts at a third in the damage maths
  (`ARMOR_DEFENCE_WEIGHT`, lib/combat/engine.ts): 30 melee defence blocks what 10 used to, so
  defence is unchanged. HP and agility count in full; a piece can roll ⅓ of its armour's HP
  ceiling (`PIECE_HP_SHARE`).
  - Enemies wear three real pieces, and the one that drops is one they wore. Bosses' and the
    thief's hand-set armour is on the same scale.
  - Old saves: armour's defence is multiplied by 3 on load (`upgradeOldArmor`, lib/save.ts), so it
    blocks what it did.
  - ⚠️ Provisional: HP at ⅓ is the user's playtest choice. A full set gives about twice the old
    armour HP (rare +46, legendary +72), and fights run about ½–1 hit longer (sim: ~5.9 hits to
    KO at every rarity, against 4.9–5.9 before). ⅕ would keep fights as they were.
- ✅ Full-set bonuses (all 3 pieces) are effects, not stats (`SET_BONUS` in lib/items/armor.ts):
  Hard Shell, Quickscale, Nullify, Deflect, Steadfast, Unstoppable, Second Wind.
- Weapons have a damage-type affinity (+15% when the move's type matches: `AFFINITY_BONUS`), but only
  under the old rules: Combat V2 has no damage types, so it's off (and not shown).

### Materials, consumables, bags

- ✅ **Materials** (planks, metal bars, nails, essence stones: lib/items/materials.ts) are a tally at
  home, like gold. In the Labyrinth a material find is a stack that takes one bag slot and joins
  the tally when you get home.
- ✅ **Potions** go in the bag. The Chest (Inventory) stores the rest.
- ✅ **Chest boxes** (the user, 2026-10-20, `lib/items/storage.ts`): weapons, armour and consumables each
  hold 50 (`BOX_CAP`). Materials (a tally, shown in a strip by your gold at the top of the
  Inventory) and codexes (their own Inventory tab; the bookcase limits them) don't count. A run's
  haul still comes home into a full box and can go over, but you can't enter the Labyrinth while
  any box is at 50 or more. A scan for a full box is kept as a sealed Code Cache at the altar (even
  in Looting mode), and a cache for a full box won't open until there's room. The altar holds 9
  caches (`CACHE_LIMIT`): with 9 waiting, every scan says "Scan Failed / Code Cache Full".
  ✅ **Storage schematics** (2026-10-25): the merchant's Weapon and Armour Storage Schematics
  (`weapon_storage`, `armor_storage`) build that box up to 75 (`BIG_BOX_CAP`; consumables stay at
  50). Built from the Inventory (a panel above the list) for 10 planks, 10 nails, 1 essence stone.
  The save remembers which boxes are built (`storage`, optional, default none).
- ✅ **Bags:** you start with a Bindle (3 slots, `BINDLE`). The Rugged Backpack (5, `BACKPACK`) is
  found three ways, until you've got it (the user, 2026-10-20): the first Cyclops's chest; every
  wandering merchant's cart, Labyrinth or tavern, for 1,000 gold (`BACKPACK_PRICE`; it takes one of
  the cart's 10 slots); and 50% of
  storehouses (`STOREHOUSE_BACKPACK`). Gear, codexes, potions, tools and material stacks take a slot; gold and
  creature cards don't. Swapping a weapon from the bag mid-fight uses your turn.
- ✅ **Backpack upgrades** (2026-10-25): +1 slot each from the backpack's 5 up to 8 (`BAG_MAX`), at
  1,000 → 1,500 → 2,000 gold (`BAG_UPGRADE_PRICES`), from the merchant once you own the backpack. It
  works straight away (in the Labyrinth) or from the next run (tavern). Stored as `bagSize`.
- ✅ **Revival Elixir** (2026-10-25, a tool: `revival`): from the bag between rooms (not in a
  fight), brings a knocked-out creature back with 50% HP (`REVIVE_HP`). One bag slot. 500 gold at
  the merchant (25% of carts); also in 20% of mini-boss chests (`MINIBOSS_REVIVAL`) and 50% of boss
  chests (`BOSS_REVIVAL`).
- ✅ **Schematics:** the Crooked Bookcase (epic drop: 20 planks + 10 nails) raises the bookcase from
  10 to 25 codexes. 📌 Changing (the user, 2026-10-20): it will come only from the tavern
  questline (§9), for 10 planks + 5 nails, holding 20.
- ✅ **Throwing out codexes** (2026-10-25): tap a codex on the bookcase, then Throw out and Yes. It
  is gone for good (no gold), to free the shelf without having to teach it.
- 📌 More schematics and furniture later, e.g. a fireplace in the Den for faster healing.
- ❓ A 10-item battle bag and bags for Klutz have been mentioned, but neither is designed.

## 4. Creatures

- ✅ 35 scannable species (`CREATURE_TEMPLATES`, lib/creatures/creatureData.ts and rosterV2.ts):
  7 races × one of each rarity. Each has a rarity, a main **style** (`cls`: melee / ranged / magic),
  an **archetype** (which style kits it draws from, §6) and **one or two races** (Undead, Divine,
  Beast, Underkin, Geo, Humanoid, Toxic). Plus Klutz (no race), the boss parts, and 7 retired
  species kept out of scans.
- ✅ **Individual rolls:** each creature's %s are the species' values with a small zero-sum spread
  (`ROLL_SPREAD_*` in creatureRoll.ts). Rarer creatures get bigger spreads. 4 move slots: it's
  born with its 3 starting moves (§6), and a 10% chance (`RARE_MOVE_CHANCE`) of a rare learnable
  move of its style in the empty fourth (the user, 2026-10-26: never in place of a starting move).
- ✅ **Cards:** a card shows one specific rolled creature. Summon with 3 cards of a species
  (`CARDS_TO_SUMMON`): **choose** a card to get exactly that creature, or **random** for a fresh
  roll.
- ✅ **Cage:** holds 1 creature (`CAGE_SIZE`; upgrades later). A new game's first creature waits in
  the cage (`starterCreature`, Lv 3). Releasing a creature gives nothing. A captured creature joins
  your creatures but not your roster (the user, 2026-10-23), unless the roster is empty (the
  starter: the Labyrinth's party is picked from the roster).
- ✅ The card design is settled (CardFace, the stone card). The Skull Raven (id `storm_phoenix`) is
  the quality benchmark for sprites and cards.
- ✅ Races have 5 creatures each, one per rarity (a dual-race creature counts under its first race).
- ❓ **Secondary classes** (Shaman, Rogue, Brute, Trickster, Cleric were floated): largely answered
  by Combat V2's archetypes (§6); anything more is undefined and deferred. A **Celestial** race was mentioned as a future race.

### Soul stones (✅ the user's spec, 2026-10-25; lib/creatures/soulStones.ts)

- A passive power some creatures are born with, shown under the weapon in the creature window
  (and on cards). They **replaced the old abilities** (Keen Eye, Divine Healing), which are gone.
- Only Rare or better, and not guaranteed: Rare 25%, Epic 60%, Legendary 100% (`SOUL_STONE_CHANCE`),
  cards included. Summoning "choose" keeps the card's stone; "random" rolls a new one.
- Each Rare+ species has a pool of **at least 2** stones (`POOLS`, picked by Claude to fit each
  creature; the user may re-sort them), so two of a species can differ. Trickster only goes on
  races with a utility move (Divine: Mirage; Undead: Corpsify).
- Creatures and cards from before soul stones get theirs rolled once on load (`soulStoneOf`,
  seeded by the drop's id). Save field `soulStone` on the drop: a key, or `null` for none.
- Enemies roll them too, at the same rates (the user, 2026-10-25: `makeEnemy`, and the practice
  battles), and a creature Klutz catches keeps its stone. In a fight, each creature's stone is
  written out under it (plain text for now, while they're tested). The first quest's thief and
  the Cyclops have none.
- The starter creature always has one, from its pool (the user, 2026-10-25).
- **Klutz:** you choose his stone from his Equip window (tap the soul stone slot), and can change
  it or take it off for free whenever he is home (the user, 2026-10-25). Only the four that do
  something for him (`KLUTZ_STONES`): no Revitalise (he never swaps out) and no Trickster (no
  utility move). Saved as `KlutzState.soulStone` (missing = none).
- **Loose soul stones** (the user, 2026-10-25): a stone found on its own, as a consumable item
  (`stone` on the drop, `soulStoneDrop`), always one particular stone of the six.
  - Scans: 1% of outcomes (`SCAN_ODDS.soul_stone`, taken from armour: now 26%), **only for the
    first ever to scan the barcode**; anyone after gets gold (`claimedOutcome`). "First" means
    first in this browser's registry until there's a global one.
  - Boss chests: the Cyclops 2% (`CYCLOPS_SOUL_STONE`), the Warden's strongbox 5%
    (`WARDEN_SOUL_STONE`). Not in ordinary Labyrinth chests (`CHEST_ODDS`).
  - Set in **any creature** (any rarity, any stone, not just its species pool; not cards) by tapping
    its soul stone slot: free into an empty slot, 5,000 gold to replace one
    (`SOUL_STONE_REPLACE_COST`), and the old stone is destroyed (`setStoneIn`).
  - 📌 Later (the user's plan): 1 in 500 creature drops (real creatures, not cards) a cosmetic
    variant, only for the first to scan that barcode, for trading. Needs the global registry to
    mean much.
- The altar says **"First to find this Code Cache!"** when nobody had scanned the barcode before,
  and **"You've already looted this Code Cache"** on a rescan (the user, 2026-10-25).
- The six (the user's numbers):
  - **Toxic Skin**: hit by a melee attack, 50% to poison the attacker: 5% of its max HP each turn
    for 3–5 turns, on the bench too. A new poisoning replaces the old one with a fresh 3–5 roll.
  - **Haunting Presence**: when it enters (the start of the fight or a swap; not when sent in
    after a knockout, which the user confirmed is right, 2026-10-26), 25% that the enemy
    on the field is "crippled with fear": it loses its next attack and spends no energy. Swaps
    resolve first, so swapping it in can stop the attack due that same turn.
  - **Unstoppable Force**: can't be crippled.
  - **Perfectionist**: each use of the same move in a row does 10% more than the last, compounding
    (10 → 11 → 12.1, ±5% spread), with no cap. Resets on a different move, a rest, a stumble or
    fear, an item, or swapping out (the foe swapping doesn't reset it).
  - **Trickster**: its utility moves (ones used on itself: Mirage, Corpsify) go before everyone,
    whatever the agility. (Cripple, Haste and Precise are utility *attacks*: not included.)
  - **Revitalise**: swapped out to the bench, heals 25% of its max HP.
- 📌 More stones later: the user plans to expand the list.
- ❓ A slave trader who buys creatures (with the Tavern's encounters): mentioned, not designed.

## 5. Levels and XP

- ✅ Levels 1–30 (`MAX_LEVEL`). The species' listed %s are its level-15 values (`REF_LEVEL`). At
  Lv 1 a creature has only its roll, so two creatures of a rarity are close and the species shows
  as they level. HP is ×1.5 overall (`HP_SCALE`). (lib/creatures/levels.ts)
- ✅ XP per KO depends on the enemy's level and rarity. A boss part gives 200. A fight's XP is
  shared by impact (damage dealt + half the damage taken, at least 10% each). No XP for a lost
  fight. Levelling is 1.5× slower than first built (`XP_PACE`), at the user's request.
- ✅ **Explorer level** (you, `save.player`) gets every fight's full XP and gates scan rarity
  (section 2).
- ✅ **Tattered XP Scroll:** a flat 400 XP (`SCROLL_XP`, about Lv 1 → 5). Read from the creature
  window; works on Klutz.
  - 🧪 Drop rates: mini-boss chests 25%, boss chests 50%, 20% of merchants at 200 gold. The 25% and
    50% are Claude's numbers.
- ✅ Enemy levels come in bands by depth (`DUNGEONS[d].levels`). Cyclops Lv 6, Warden Lv 16 (Lv 25 in the Abyss).
- ❓ Cards still show level-15 %s; Pit fights give no XP.

## 6. Combat

### The rules (lib/combat)

- ✅ **Format:** teams of 3, one active creature each side. Swapping uses your turn and resolves
  before attacks, so the incoming creature takes the hit. The creature swapped out recovers 50% of
  its *missing* energy (`SWAP_ENERGY_RESTORE`).
- ✅ **Agility only decides who strikes first.** This threshold behaviour is intended: players
  judge how much to invest. Don't "fix" it.
- ✅ **Races, not the triangle** (Combat V2, below). The old class triangle (melee > ranged > magic,
  ±50%) and damage types are off; their code stays, for the sims.
- ✅ **Damage:** ratio formula, hit² / (hit + defence), so a bad matchup still chips (the user wants
  Pokémon-style chip damage, never ~0). A move's style (melee, ranged, magic) picks the attack and
  defence stats; then the race multipliers apply.
- ✅ **Hard counters are intended:** a counter means much less damage and a reason to swap, not
  invulnerability.
- ✅ **Energy:** max 100, +30 after each attack, so energy never falls below 30 once it has attacked.
- ✅ **No resting** (the user, 2026-10-26): every set of moves keeps at least one **steady move**
  (30 energy or less, no cooldown: `isSteadyMove`, `STEADY_MAX_ENERGY`), so a creature can always
  attack. The Moves tab and the codex "forget which?" won't give up the last one; a set saved
  without one gets its first steady move back in the last slot (`resolveMoves`). The Rest button
  is gone (the engine's "pass" stays as a safety net: with nothing affordable, a creature rests by itself).
- ✅ **Who used what:** while a round plays out, the line above the moves says "Moss Wolf used
  Gore" ("Foe's …" for theirs) in place of the energy bar.
- ✅ **Precise hits:** 5% chance, ignoring 25% of defence, and 1.75× damage (`PRECISE_DAMAGE`, the user, 2026-10-24; a brief try at 75% ignored instead was reverted).
- **The armour gap was removed** (the user, 2026-10-25): repeating a move no longer raises the
  precise chance or cracks armour. The Perfectionist soul stone is the only thing that rewards
  repeating a move now. (Tank-vs-tank stalls can now run to the 100-round draw.)
- ✅ **Stances:** neutral, float, entrench (engine.ts). Float takes −10% from melee and +10% from
  ranged, and deals +10% ranged; Entrench is the mirror image (melee). The stance rules are
  provisional in the original design, and there's no elemental type chart.
- ✅ **Utility moves** (learnable): Cripple (−50% agility for 3 rounds, plus a 25% chance each
  attack is lost), Haste/Quickcast (double agility this round only, 15 power, 60 energy), Precise (70% to hit,
  always precise).
- ✅ **Race moves:** single-use codexes, learnable only by that race (either of a creature's two).
  Pounce (Beast), Rabid Bite (Beast, Underkin and Toxic can learn it: the user, 2026-10-26,
  `learnRaces`; it hits as Toxic; venom ticks even on the bench), Mirage (Divine), Corpsify
  (Undead), Barrage (Humanoid; hits every enemy). Geo has none yet.
- ✅ **Move codexes** (decided 2026-10-19): every older move comes as a codex from scans, each
  teachable only to a creature of that move's style (race-kit codexes: below). Every codex says
  who can read it ("Underkin melee only", `codexLearners`) at the librarian, in the loot window
  and on the bookcase, and every move has a description (one without its own just says "A plain melee
  hit.": the user, 2026-10-27, doesn't want moves spelling out what they're strong against; the
  race chart is for that). Up to 20 damage (`BASIC_MOVES`, 15 moves)
  they're Common; above that (`STRONG_MOVES`, 10 moves) they're Rare.
- ✅ **Consumables from scans** (decided 2026-10-19) roll Common : Uncommon : Rare at 40 : 30 : 20. Common is a basic
  codex or a Lesser Potion, half each (`BASIC_CODEX_SHARE`). Uncommon is a learnable codex. Rare
  is a strong codex or a Healing Potion, half each (`STRONG_CODEX_SHARE`). The Healing Potion is
  Rare everywhere now (it was Uncommon).
- Dropped for now (2026-10-19): the **Codex of Stances** (Aerial Assault, Dig In, Meditate), once
  a planned Cyclops reward.
- ✅ **Thinking AI** (Monte Carlo) with Easy / Normal / Hard.
- ✅ **Enemies' moves scale with level** (the user, 2026-10-26; `enemyMoves`, `ENEMY_MOVE_LEVELS`
  in lib/dungeon/run.ts). From Lv 5 its empty fourth slot holds its race's heavy move; from Lv 12
  its Neutral light move becomes another move from its kits; from Lv 20 its Neutral priority move
  does too. It always keeps its race's 30-energy move. 🧪 The levels are Claude's draft. A creature
  Klutz catches keeps the moves it fought with.
- 🧪 Balance in general: the user tunes from sims (the balance lab is at /lab and /simulator). Their
  goals: rarity raises the ceiling but a Legendary must not always win; well-fitted, well-rolled
  gear should beat raw rarity within a band; good play should matter more than it does now.
  Present changes to creature stats or move numbers as options. Don't apply them unasked.

### Combat V2: races (✅ live since 2026-10-26)

How it came about, round by round: history.md.

- ✅ **Live rules** (`LIVE_RULES`, `setCombatRules` in engine.ts): races on (each move's own race),
  triangle off (`TRIANGLE_RULES` kept for sims), damage types off (`damageTypes: false`: Force /
  Pierce / Arcane are gone; a move is just its style and race). **Magic stays** as a third style.
  Sims: `npx vite-node scripts/sim-races.ts [scale]`.
- ✅ **7 races:** Undead, Divine, Beast, Underkin, Geo (elemental, not just stone), Humanoid, Toxic
  (was Pestilence; id `toxic`). Creatures have 1 or 2 (`SPECIES_RACES`, lib/creatures/racesV2.ts;
  the user's race pass is in; the user is fine with lopsided races). Colours (`RACE_INFO`): Undead
  bone grey, Divine light gold, Beast green, Underkin brown, Geo red, Humanoid blue, Toxic purple;
  **Neutral** (no race) slate grey (in code still `BALANCED_INFO` / `BALANCED_MOVES`).
- 🧪 **Multipliers 1.25× effective / 0.8× resisted** (`RACE_EFFECT`; dual races multiply), plus
  1.15× for a move of the creature's own race, once (`MATCH_BONUS`). The user picked these over
  1.4× / 0.75× (2026-10-26): the race edge drops from 74% to 68% of even duels, and gear a rarity
  better can make up for a bad matchup. The chart (`RACE_BEATS`, lib/combat/raceChart.ts) is Claude's
  rebalance of the user's draft: each race beats 3 and is weak to 3, with 4 mutual pairs.
- ✅ **35 creatures** (`CREATURE_TEMPLATES`, `ROSTER_V2` in rosterV2.ts), one per rarity per race;
  the older 25 as they were are `PRE_V2_SPECIES`, for tests of battle mechanics. V2 style changes
  are `V2_RESTYLE` (main % moved to the new style, total unchanged). The Cave Bat is now the **Cave
  Goblin** (same id `cave_bat`). The Deep Angler is a melee Battlemage. The Deep Angler, Rotgut Fly
  and Dust Sprite PNGs are mirrored.
- ✅ **Archetypes** (`ARCHETYPE_INFO`, Claude's draft, approved): Bruiser, Bulwark (melee tank),
  Sniper, Skirmisher, Arcanist, Warden (magic tank), and hybrids Ranger (melee + ranged), Battlemage
  (melee + magic), Spellbow (ranged + magic). An archetype decides which style kits a creature draws
  from. 4 of most, 3 Snipers, 5 Battlemages, 3 Spellbows.
- ✅ **Race kits** (lib/creatures/raceKitsV2.ts): per race and style, a 30 and a 50 energy move
  (15/25 damage), a quick attack (20 energy, 8 damage, always first) and a precise move (30 energy,
  15 damage, 70% to hit, always precise): 84 race moves (`KIT_RACE_MOVES`). Each style's 20-energy
  light move is one shared **Neutral** move (Strike, Shot, Zap; `RETIRED_KIT_MOVES` maps the old
  names). Plus the **Neutral priority moves** (`NEUTRAL_QUICK_MOVES`: Rush, Quickshot, Blink; 15
  damage, 50 energy, always first; two in one round: the faster goes first). The old haste spell
  Blink is now **Quickcast**. 🧪 Move names are Claude's; the user will add more moves.
- ✅ **Starting moves** (`STARTING_MOVES`): every creature is born with 3, all in its main style:
  Neutral 20, its race's 30, and the Neutral priority move. The fourth slot needs a codex. Klutz
  still starts with 4. Saves from before this went back to their 3 once (`upgradeMoveSet`, `moveSet`
  = 2; codex-learned moves kept): the user chose this over keeping their 4.
- ✅ **Race-kit codexes:** only a creature with that move in its kits can read one (`movesAvailableTo`:
  born + learned). From scans by the usual split (`KIT_BASIC_CODEXES` Common / `KIT_STRONG_CODEXES`
  Rare), and librarians, chests and the Cyclops alongside the older race codexes
  (`RACE_CODEX_MOVES`). 🧪 A librarian's kit codex costs 200 (`LEARNABLE_CODEX_PRICE`).
- ✅ **Guided first fight** teaches races: the Baby Cyclops thief is Humanoid; Klutz has you use
  Tunnel Rush (resisted), then Gore (effective). The Cyclops and the Warden's pack have no race.
- ✅ **UI:** moves show their race; tablets are cut in their race's stone with a big style icon
  (impact / arrow / bolt). Cards show race squares under the sprite (not the style); creature
  windows and name plates show races spelled out. A hit says **EFFECTIVE!** or **RESISTED**. A move's
  (i) says how its race lands; no hint on the tile. The Bestiary's "How fights work" has the race
  chart and a calculator; Labyrinth fights have a race chart button (▲▼).
- 🧪 Soul stone pools for the six new Rare+ creatures are Claude's drafts.
- 🧪 Sim of the live roster (2026-10-26): spread within a rarity 3.3 (was 6.3); the race edge wins
  72% of even duels; swapping no longer pays (50%).
- ❓ `MOVE_RACES` gives the older moves (codexes, Klutz's, learnable ones) draft races. Race move
  rules beyond the kits are open.

### Planned

- 📌 More effects: vampirism, curse/blind, fear (blocks swapping). More moves from encounters,
  drops or daily quests.
- ❓ Making agility do more (e.g. a dodge chance): mentioned, needs the user's decision.

## 7. The Labyrinth

- ✅ A run is a climb up a **scroll map**: you plan a route and partly see rooms ahead. The first
  step is blind. Rooms can repeat. (lib/dungeon/run.ts, map.ts)
- ✅ **Four dungeons** (`DUNGEONS`):
  - **The Encampment** (dungeon 0; the user, 2026-10-27): a new player's first labyrinth, after
    Klutz's box. 5 rooms you walk into (`CAMP_ROUTE`): rooms 1–4 are creature dens, or a stash
    half the time (`CAMP_STASH`), never two stashes in a row; no mysteries. Its first rooms ease you
    in like the Labyrinth's (below). Room 5 is the camp: its **chief**, an Uncommon in Common gear,
    Lv 5 (`CAMP_CHIEF_LEVEL`, Hard AI), with a mini boss's chest. Beaten the first time, it guards
    2 cages (`campCages`): each a Common or Uncommon (even odds), Lv 2–4, of no race your party
    has, so you've a team of 3 for the Labyrinth. After that, one cage with a creature in it 20% of
    the time (`CAMP_REPEAT_CHANCE`). Always free.
    - The **Labyrinth opens** once you've beaten it, or scanned 25 barcodes (`LABYRINTH_SCANS`,
      `labyrinthOpen`); anyone who'd beaten the Cyclops before keeps the way in. Until then the
      entrance shows it locked.
    - Sims (`scripts/sim-encampment.ts`: a lone Rare starter in the best of Klutz's box, spamming
      its race move, no scans or pickups): first win median run 3–4, 59% by run 4, 13% not by run
      12 (levelling is slow, so a bad starter or box can stall; Dustwraith and Crystalback suffer
      most). Then, with the two cage creatures in the box's leftovers, 87% of runs get through the
      Labyrinth's rooms 1–5 (a brute beats you 16% of the time, the chief ~70%); ungeared, 66%.
  - **The Labyrinth:** 15 rooms to the lair, 1 large room, enemies Lv 1–7, boss the **Cyclops**.
  - **The Deep Labyrinth:** opens after your first Cyclops clear. 15 rooms, 2 large rooms, enemies
    up to Lv 17, boss the **Warden's pack** (a Legendary plus 2 Epic guards).
  - **The Abyss:** opens after your first Warden clear (the user, 2026-10-26). The Deep Labyrinth
    again (same map, same creature rarities, same Warden's pack) with higher levels (Lv 15–26 by
    depth, Warden Lv 25) and every piece of enemy gear a rarity up; gold ×3. 🧪 The levels and gold
    are Claude's numbers.
- ✅ **Party:** up to 5 creatures (`PARTY_SIZE`). 3 fight (`TEAM_SIZE`), and reserves swap in
  between rooms.
- ✅ **Entry:** 50 gold (`ENTRY_FEE`); the first 5 runs are free (`FREE_RUNS`).
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
  keep, in 3 variants: plain, ambush, rigged. The drunk one, foes on ×3 HP, was removed by the user
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
  `SCROLL_LOOKS`); a flare still shows the map on top.
- ✅ **Tools:** flare (re-view the map and light around you, twice as far as your torch), clairvoyance scroll (reveal any room
  and its surroundings; 200 gold at merchants). Merchants carry 5 wares. Also found (the user,
  2026-10-20): a flare in 10% of stashes and 20% of chests, a clairvoyance scroll in 5% of stashes and
  10% of chests (`STASH_TOOLS`, `CHEST_TOOLS`), on top of what they already hold. A chest holds at
  most 5 things (`CHEST_SLOTS`, `capSack`): rolled more, the least rare fall out (gold first, then
  Common, Uncommon…).
- ✅ **Selling to the merchant:** his room shows your bag (slots used/free); tap a slot and sell it to make room,
  or Use it (opens it in your bag: drink, equip…). In the merchant's or a librarian's room, your bag also has a
  Sell button, at the same prices (`buysHere`; selling to a librarian is Claude's default, 2026-10-23). A codex
  can't be bought with a full bag (the user, 2026-10-23).
  - ✅ Prices (decided 2026-10-19; `merchantOffer`, lib/dungeon/run.ts): weapons and armour at the crate's sell price; potions, materials,
    scrolls and tools at half his price (`MERCHANT_BUYBACK`); codexes at half the librarian's. Klutz's club can't be sold.
    Claude's defaults, added 2026-10-19.
- **The bigger merchant** (the user, 2026-10-23; the Labyrinth's and the tavern's alike; the user
  wants him to keep growing). ✅ Built: the 10-slot cart (`MERCHANT_SLOTS`, always 10 spaces shown):
  always a Healing Potion, Lesser Potion and Flare; rare wares rolled one by one (backpack or, once
  owned, a backpack upgrade 20%; each storage schematic 20% until bought; Revival Elixir 25%; XP
  scroll 20%; clairvoyance scroll 40%); materials fill the rest.
  📌 **Not built yet:**
  - **Gear on the cart:** 0–2 weapons or armour pieces, rolled like a scan (`RARITY_WEIGHTS`, **no
    explorer-level gate**: price is the filter), at **2× the crate's sell value** (rough prices:
    weapons Common ~100 to Legendary ~5,000).
  - **Materials:** 3–5 stacks, repeats allowed, filling what's left; never more than 10 wares.
  - **Armour priced like weapons:** `PIECE_VALUE` (sell.ts) goes, so a piece is worth a weapon of
    its rarity. The user accepts the knock-on (armour sells for 3× everywhere, gear gold roughly
    doubles); if gold gets too easy, tune the 2× mark-up or crate prices, not this.
  - Build notes: a grid for 10 wares (fixed structure), unique ware keys with repeated materials,
    old saves' 5-ware carts must load, and a quick sim of cart prices.
- ✅ **Death / retreat:** a party wipe ends the run. Items left on the room floor are lost; what's in
  your bag comes home. Retreating keeps the witch's winnings. Going back to the Den mid-run is a
  retreat (after a "Leave the labyrinth?" check): runs can't be paused.
- ✅ After a boss clear, the **walk back** lets you pick from everything you left behind, but only
  what fits in your bag; gold and creature cards come home free, the rest stays (the user,
  2026-10-26: back to how it was; on 2026-10-23 everything came home, but most of it was junk).
- ✅ **Healing pool (Den):** heals 25% HP an hour on one global clock, runs included.
  - 🧪 The rate is Claude's default (the user said "slowly"). The user plans upgrades and elixirs,
    and may use it as a monetisation lever later. The instant heal at the entrance is a testing
    shortcut.
  - 🧪 **For testing, everyone comes home at full health** (`HEAL_AT_HOME` in lib/dungeon/run.ts,
    on since 2026-10-19). Set it to `false` to bring the pool back.
  - ✅ Decided (the user, 2026-10-20): healing after death **stays as it is now**, with everyone
    coming home at full health (`HEAL_AT_HOME`). The other options (slow pool 25%/h, faster pool
    50%/h, a quick heal to half then the pool) are set aside.
- 📌 **Re-entry cooldown** as the anti-farming bar, with cooldown potions from barcode merchants
  (or real money later). Not built: today the gold fee is the only bar.
- ❓ Labyrinth look: a top-down voxel style is the likely long-term direction, not committed.

### Bosses

- ✅ **The Cyclops** (lib/creatures/bosses.ts, lib/combat/bossAi.ts), each phase with a full health bar:
  1. A melee tank. Stomp (about 1 in 3) can cripple you, so swap out. It has an occasional costly Eye Laser. (A Meditate heal with a
     3-turn cooldown was decided too; 📌 not built.)
  2. At half HP it becomes **2 crawling hands**, both on the field at once (you pick a target):
     fast, strong melee.
  3. Then **the Eye** leaves the skull: ranged, in Float stance, with very high melee defence.
  - It's meant to take a few attempts (sims: a median of about 12–13 runs to the first kill).
- ✅ **Boss rewards:** the boss chest (10 rolls, plus a scroll chance) and the Rugged Backpack. The
  Warden drops a strongbox.
- 📌 Also decided as Cyclops rewards, **not built** (the game says "next update"): building the
  **Tavern** (now via the tavern questline in §9, not gold), and a **trophy** showing which run you won on (that run is already
  recorded: `meta.firstClearRun`).
- ⏸ **Shelved (2026-10-19): an explorable Labyrinth** walked room to room
  ([ideas/labyrinth-v2.png](ideas/labyrinth-v2.png); details and the 8–12 session estimate in
  history.md). If picked up: a 1-session throwaway prototype in /lab first.
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

## 8. Klutz

- ✅ A clumsy goblin **helper, not a party creature.** He's easily bribed with gold into serving
  you, wanders the Den, and you tap him for /klutz. (lib/klutz.ts)
- ✅ **Hunts** (until beaten, decided 2026-10-20): every 20–60 minutes (🧪 Claude's range) he meets a
  creature (his level −2 to +1) and fights it 1v1, and he keeps going until one beats him. He
  doesn't heal between fights. Past 6 hours out, what he meets is a level tougher for every hour
  past it (🧪). You can see his HP while he's away and **call him back** at any time (he comes home
  with what he's won so far). A safety stop brings him home after 60 fights. The user's aim: send
  him off at bedtime and wake up to creatures and gear. Sim (400 trips a level, gear at his rarity):
  trips last about 2 h on average (2–4 fights, 1–3 wins; 90% are under 3–5 h), so the 6-hour
  toughening rarely comes into it. **Open:** longer walks would make trips last overnight.
  - **Each win:** the creature goes to the cage, and its weapon plus one armour piece to his crate.
  - **Beaten:** he comes home with everything and heals in the pool (1 HP every 10 s) before he can
    go out again.
  - His gear is locked while he's away.
- ✅ **The cage** holds 1. The **Iron Cage Schematic** (rare) is in a mini boss's chest 20% of the
  time until you have one (at home or in your bag) or have built it; with 10 metal bars it builds
  the iron cage, which holds 3 (`CAGE_LEVELS`, lib/items/materials.ts). Catches that don't fit are
  let go (he keeps their gear).
- ✅ **Neutral** (decided 2026-10-20): Klutz hunts alone and can't swap, so he was outside the
  triangle (+25% when a move of his countered, `NEUTRAL_COUNTER`). In Combat V2 he has **no race**,
  so nothing is effective against him and he gets no matching-race bonus; but his moves (the older
  ones) have races (`MOVE_RACES`), so they can be effective or resisted like anyone's. ❓ Whether
  he should get something in place of his old counter bonus is open. His badge reads a grey
  "⚖️ Neutral", and he shows no race (the user, 2026-10-26).
- ✅ **Codexes** (2026-10-23): Klutz reads codexes you own from his Equip window → Moves (not while
  he's away). Any class's moves and the learnable ones, but **no race moves**, not even his own
  race's. What he's learned is kept in `KlutzState.learned`.
  - **Skill points** (decided 2026-10-20, replacing the even 9s): he's a **Rare**, his %s start at 0,
    and he earns 6 points a level over 1 (84 at Lv 15, about a Rare's total; `POINTS_PER_LEVEL`).
    In his stats window, tap a stat to add 1% (attacks on the top row beside the points left;
    defences and agility below), then Confirm or Cancel; the stat bars preview it. A re-spec gives
    every point back for 1000 gold. His weapon and the codexes you teach him still decide most of
    how he fights. He starts with Slash, Heavy Blow, Jab and Stone Throw. (A pre-V2 sim: history.md.)
- ✅ **Finds:** 35% of walks (each fight's) bring home gear for a slot he wears. It's **never rarer than his own
  piece** (the same rarity only 5%, rising slightly with his level).
- ✅ **Levels:** a won hunt gives the KO's XP + 50, and every piece of gear he brings home gives 20
  (a catch's weapon and armour, and a find; 2026-10-20, to make him level faster). A first catch
  reaches Lv 2. The crate shows a ❗ in the Den while it holds loot. Scrolls work on
  him, and the user wants that to feel worthwhile ("the closest thing to you").
- ✅ **A new game starts at Klutz:** he dragged you in out of the Labyrinth and, because you were kind
  to him, he'll help you. He caught an evil creature exploring: you can recruit it. The cage glows
  until you do; only then does he tell you about his box (`needsFirstCreature`, lib/quest.ts).
- ✅ **First quest, "Klutz's box":** a Baby Cyclops stole his box. In a guided first fight he gives
  advice (he doesn't fight). The box holds 10 pieces of Common/Uncommon gear (lib/quest.ts).
  On the way, Klutz's Club lies on the floor and is picked up through the loot window: a tutorial
  there teaches taking it into the bag and equipping it (tap, or drag onto a creature), and the
  equip window explains where stats come from (gear × the creature's %).
  Before he borrows any gear, you have to put some armour from the box on your creature (the Pit
  glows; `needsGearUp`).
- ✅ **Equipping:** gear can be dragged onto a creature (loot windows and the bag in the Labyrinth)
  or onto its slot (the creature window). In the Labyrinth, equipping opens a compare window first:
  the slot's old piece vs the new one, each stat's change, and your party along the top marked ▲/▼
  so you can see who it helps.
- 📌 **Kidnap plan** (after the first Cyclops kill): hunts can end with Klutz kidnapped, rescued
  through a mini dungeon; rare smoke bombs let him escape. ❓ The chance, smoke-bomb sources, mini
  dungeon and kidnappers are all undecided.
- ⏸ The intro (Klutz drags you in, you tip him gold) is parked until the art direction settles.

## 9. The Den and economy

- ✅ Places: Soul Altar (scanning), Labyrinth archway, quest board, Bestiary lectern, cage, pool,
  Fight Pit, chest (Inventory), crates, bookcase (codexes; 10, or 20 upgraded), bindle/bag, merchant
  stall, and a boarded-up Tavern.
- 📌 **Tavern:** where travellers, merchants and librarians gather. Now reached through the
  questline below (the earlier "built with 300 gold after the Cyclops" is replaced by it). Not
  built.
- 📌 Wandering merchants and weapon dealers as gold sinks. The user will design gold sinks.
- ✅ **Save slots and the title screen** (2026-10-20, `app/start`, lib/saveSlots.ts): opening the
  game shows Continue / New Game / Load file; up to 4 named saves per browser (no real login: the
  user chose this over online accounts). The game saves itself on every change. The slot in play
  lives in the usual keys; the others are parked as save files.
- ✅ Sell prices **stay as they are** (the user, 2026-10-20), even though they (epic ~800,
  legendary ~2,700) dwarf Labyrinth gold (~18 a room) and re-scan gold has no cap.

### The tavern questline (📌 the user's spec, 2026-10-20; stages 1–8 built, lib/tavern.ts)

Each stage unlocks the next, so every stage can ship on its own and leave the game playable.
Placeholder art (existing sprites, simple markers) until a later PixelLab pass. All new save
fields optional with defaults.

1. ✅ **Klutz's quest.** It unlocks once any creature reaches Lv 6 **and** Klutz is Lv 2 or more
   (either order). Only won hunts give him XP and a first catch takes him to Lv 2, so his level
   is the record of having hunted, and old saves work too. While he's out, the quest waits until
   he's home. Then a "!" shows over him; talking to him gives the quest, once.
2. ✅ **Storehouse.** Once the quest is accepted and until you have the dynamite, a Labyrinth's
   Large Room is always a Storehouse, always marked on the scroll from the start (no extra room).
   In the Deep (2 large rooms) only one is. The first-quest run has no large room. The dynamite
   lies among its crates and barrels. Taking it is permanent: rooms go back to normal and you
   can't get a second one. 🧪 Its usual mini-boss guard chance stays (the dynamite waits until the
   guard's beaten). 🧪 The dynamite takes no bag slot and is yours the moment you pick it up, even if
   the run then goes wrong (there's no second one). Both Claude's defaults; not asked.
3. ✅ **Rubble.** A rubble-choked doorway on the Den's right-hand wall, between the bookcase
   corner and the merchant (the user's sketch: [ideas/den-second-room.png](ideas/den-second-room.png)).
   Using the dynamite on it (once) blows it open (a flash and a shake) into a passage to a second
   room. **Until then you can't see or pan over the second room at all.** It isn't a general
   destructible-walls system.
   ✅ **The room strip:** the Den and the tavern's room sit side by side in one view you drag across
   (`DenRoom`'s `annex`); the tavern's room lies straight behind the Den's right wall, through a
   see-through doorway and a wall one floor unit thick (`PASS`, lib/den/scene.ts). Each room is its
   own picture, built only once open, so later rooms don't slow the others (watch phone
   performance). The tavern's room is the Den's cave with nothing in it (`createDen({ bare })`), with
   the tavern, head and visitor standing in it (`components/TavernRoom.tsx`); tapping there opens
   `/tavern` (repair, bounty, trading). Meant to grow into more rooms.
   📌 Still to come: mounted head art, and the tavern's interior (needs design). The user's
   [ideas/future-dungeon-direction.png](ideas/future-dungeon-direction.png) is the likely long-term
   look for the base.
   🧪 Testing tools at the altar: "🧨 Open the rubble" (`forceOpen`) and "🍺 Call a visitor"
   (`callVisitor`).
4. ✅ **The tavern (outside only for now)** stands broken in that room, a building against its far
   wall (the sketch). The first time you see it, Klutz reacts once (it needs materials). Art:
   PixelLab, at the room's angle (§11); greyed until repaired. ✅ (the user, 2026-10-20) **No
   wanted poster:** instead a ❗ over the tavern while it has a quest step for you (the bounty to
   take, or the head to hand in: `tavernHasQuest`), also shown at the Den's doorway; tapping the
   tavern opens its window with the offer.
5. ✅ **Repair:** 5 metal bars, 20 planks, 5 nails. It shows have/need, is blocked if you're short,
   takes the materials exactly once, and swaps in the restored look.
6. ✅ **Bounty:** the tavern offers the Cyclops bounty. If you'd already beaten the Cyclops
   (`meta.clears`), it completes as soon as you open the tavern. Cyclops combat is unchanged.
   🧪 Built as a "Take the Cyclops bounty" button once the tavern's repaired; with a win already
   on record, the head is ready to mount straight away.
7. ✅ **Cyclops Head:** a unique trophy, given once, that can't be sold, used or duplicated. It is
   the decided Cyclops trophy, showing the run you first won on (`meta.firstClearRun`). Mounting
   it on the tavern wall (once) completes the bounty and unlocks the bookcase schematic.
   🧪 The head isn't an item in your storage: it's yours once you've beaten the Cyclops and taken
   the bounty, so it can't be sold, used, lost or doubled. Mounted, it hangs over the tavern door
   (placeholder: the Cyclops sprite on a plaque marked with the run).
   The schematic it pays isn't an item either: the bookcase just offers to build.
8. ✅ **Bookcase upgrade:** the existing Crooked Bookcase schematic, but the tavern is now the
   **only** way to get it: it no longer drops from mini bosses, the Cyclops or storehouses. It costs
   10 planks and 5 nails, is built separately, holds **20** codexes, and uses the user's upgraded
   bookcase art (`den/bookcase-2.png`). (It was 20 planks + 10 nails for 25.) A save that already
   built it keeps its 25 slots, and schematics already in a save stay buildable (now 20 slots).
   In the Den the shelf swaps to the upgraded art once it's built.
9. **Visitors** (after the repair): on returning home from each run, roll a merchant (12%), a
   librarian (8%) or nobody. A visitor stays about 2 runs. The first roll after the repair is
   guaranteed, and so is one after 3 misses. They reuse the Labyrinth's merchant and librarian. 🧪 Built 2026-10-20 (`lib/tavern.ts` `comeHome`, `VISITOR_ODDS`/`VISITOR_STAY`/`VISITOR_PITY`). A sure visit is still merchant or librarian at 12:8. The roll happens whenever a run ends (won, lost or retreated). While a visitor's in, a ❗ shows at the Den's doorway and they stand in the tavern. They bring the Labyrinth stock: a merchant's cart, or a librarian's 3 race codexes. You buy one of each, and it goes straight home: potions and XP scrolls to the Inventory, materials to the tally, codexes to the bookcase (needs room). Flares and clairvoyance scrolls go to the Inventory's consumables too, and the bag page packs them (and stores them back). One not used on a run comes home to the Inventory too. ✅ The tavern merchant buys (2026-10-20, `tavernSellables`/`materialOffer`): anything in the Inventory he'd take in the Labyrinth, at the same prices (`merchantOffer`), except what's worn, packed or favourited; materials one at a time. Tap twice to sell.
   (The creature trader is left out for now.)

## 10. UI philosophy (settled; follow it)

- **Mobile-first**, for iOS/Android later. Touch only: tap targets of 44px or more, no hover-only
  information, safe areas.
- **One fixed phone-sized screen** (`components/GameScreen.tsx`). On a laptop: no border, full window height, 9:16 wide, centred. **Screen size** (Settings, `lib/uiScale.ts`, built 2026-10-20): everything inside is laid out smaller and drawn scaled up; per device, a laptop starts at 175% (the user found 175% browser zoom the right size), a phone at 100%.
  - The page never grows or shrinks between areas; long lists scroll inside panels.
  - Actions sit in docks built into the screen, not floating buttons.
  - In battle, the moves fill the bottom ~30% of the screen. Above them, a one-on-one fight's room
    fills the whole stage (the code-drawn room's ceiling and floor carry on, `extend` in
    `lib/dungeon/chamber.ts`); there's no row of who's left (Swap shows your bench).
  - Labyrinth rooms have no frame: edge to edge, the floor fading into the screen.
  - On a laptop, Esc closes whatever's open (`hooks/useEscape.ts`); with nothing open it goes back
    a page (`components/EscapeBack.tsx`), except mid-fight in the Labyrinth.
- **Vibration** (Settings, `lib/haptics.ts`, built 2026-10-24): off by default, per device. When it's on, hits that land buzz briefly, and precise hits and level-ups buzz harder. It only works in browsers that allow vibration (Android, not iPhone), and the switch is hidden elsewhere.
- **Double tap** (`lib/doubleTap.ts`, built 2026-10-24): a quick second tap on the same thing does its main button. In a creature's Equip picker it equips the piece (or unequips, on ⊘); in the loot window it takes the item.
- **Few words.** One-line summaries on screen, and depth behind a "?" (`components/Help.tsx`) in
  big, bold, broken-up text. Klutz's lines are short.
- **The stone card standard:**
  - #23262f stone with pixel bevels and a thin rarity-coloured trim;
  - the pixel font in yellow #f1d9a0, and sunken wells for text;
  - `.inv-panel` for anything holding loot or creatures;
  - Colour carries **race** (`RACE_INFO`: Beast green, Humanoid blue…; Neutral slate grey); the
    three styles share one neutral cream, so they don't clash.
- **Fixed structure, text fits it** (the user, 2026-10-19: "the text around the box should move as
  that is the variable, not the constant"). Windows are a standard frame of fixed boxes; flicking
  through items or creatures changes only the contents. Varying text gets a fixed number of lines
  (clamped), and absent parts keep their space. This is what makes the game feel polished.
  - **Text budgets** (lib/uiText.ts, checked by tests/uiText.test.ts): a card's name gets two lines
    of at most 14 letters (`CARD_NAME_LINE`), a move tablet's two lines of 12 (`MOVE_NAME_LINE`).
    New creature and move names must fit: write them shorter rather than growing the box.
  - Built this way (2026-10-26): cards (the name box is always two lines tall), move tablets (name
    box plus one tag/note line, kept when empty), the item window (one fixed size; the ←/→ row
    kept), the creature window's gear picker (four fixed lines; the 🔒 line kept), librarian rows
    (two-line descriptions), the battle dock (no Rest tab; the energy line doubles as "X used Y"),
    and the loot window (one fixed "closer look" box for whatever you tap, chest or bag, its buttons
    in one row that scrolls sideways; the chest's rows never shrink while it's open).
- One tap on a Den object goes in (no name-first double tap).

## 11. Art and PixelLab

- ✅ All creature, item, room, NPC and prop art is from **PixelLab** (the `pixellab` MCP in Claude
  Code, set up with its key on each computer, never in the repo). Files are in `public/sprites/`, with
  IDs in `public/sprites/PIXELLAB.md`.
- **The style:** a single black outline, a dark-fantasy palette, detailed but clean shading (no noisy
  dithering). Creatures are side-on, trimmed and mirrored to face left (battle flips the player's
  side). Register art in `lib/sprites` (`withArt`, `ART_SIZES`); the old grid sprite is the fallback.
- **The workflow:** samples first, then the user's approval, then the full rollout. When the user
  hands over their own art, **keep their design** and only restyle it (`edit_image_pro_flash` on
  their upscaled image: "keep this exact …, redraw as crisp pixel art …"). Never reinterpret it
  from a description.
- **Recipes that worked:**
  - creatures: `create_image_pixen`, side view, "…to the right in profile…";
  - items: `create_image_pro_flash` 64×64 with the Void Scythe as the style image;
  - rooms: `edit_image` over the code-drawn chamber, so the tunnels line up.
  - Ask before using the expensive generators (`create_image_pro`, pro characters).
- **Scale (the block standard, 2026-10-20):** the Den and its rooms draw art 1:1 (one PNG pixel =
  one room pixel), and **1 floor block = 64px across**. Plan a prop's footprint in blocks first; its
  width in pixels follows. The Soul Altar is 2×2 blocks (128px); Klutz is about 1 block wide and 1⅓
  tall (69×85px) and is the yardstick for doors. The tavern is 10×5 blocks (510px), its door
  about 130px. An isometric footprint of a×b blocks is (a+b)×32px wide.
  - **Buildings must match the room's 2:1 angle** (walls slope 1 down for every 2 across). AI
    generators draw their own perspective, so: draw a flat-colour block-out in code on the exact grid
    (doors and windows where the code expects them), then `edit_image` (up to 512px, ~25
    generations) on the block-out with an approved sample as the reference image. It keeps the
    shape and angle and copies the look. It comes out a little gloomy: warm it in code (a gentle
    saturation and lamp-light lift), and add the light spill as glows in the room.
  - Don't enlarge a small draft and redraw it with pixflux: it lost the angle and the colours.
- Hand-drawn detailed sprites in code were tried and scrapped. Don't do it again.
- Rejected, so don't reopen: the mushroom/ruin room theme, the Mr. Shadows redraws (keep the old
  sprite), and the parchment / MTG / wood-and-brass card styles.
