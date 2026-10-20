# Codex Creatures: game design

This is the agreed design, with how far each part has got. It's gathered from the design decisions
made with Claude through October 2026, and the built numbers were checked against the code on
2026-10-19. **The code is the truth for numbers:** if this file and a constant disagree, trust the
code and fix this file. Constants are named in `code font` so you can grep for them.

**Status tags**

- ✅ **Built**: in the game now.
- 📌 **Decided**: the user has agreed it, but it isn't built (or only partly).
- 🧪 **Provisional**: built, but with numbers Claude picked as a default or that are still being
  balanced. Fine to tune, but say so.
- ❓ **Open**: the user hasn't decided. Ask; don't pick.

Ideas the user floated but never confirmed are listed as ❓, not as decisions.

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
- ✅ The registry is **local** for now (`codex_creatures_registry_v2`). "Reset player" keeps it,
  to simulate a friend; "Global reset" clears it.
- 🧪 Outcome odds (`SCAN_ODDS`, 2026-10-20, for playtesting): 40% creature, 13% weapon, 27% armour,
  7% consumable, 6% material, 7% gold. Aim: about 1 legendary creature or card per 250 scans (from
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
- ✅ Weapons have a damage-type affinity (+15% when the move's type matches: `AFFINITY_BONUS`).

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
- ✅ **Bags:** you start with a Bindle (3 slots, `BINDLE`). The Rugged Backpack (5, `BACKPACK`) is
  found three ways, until you've got it (the user, 2026-10-20): the first Cyclops's chest; every
  wandering merchant's cart, Labyrinth or tavern, for 1,000 gold (`BACKPACK_PRICE`; it takes one of
  the cart's 5 slots, so with both scrolls the clairvoyance scroll misses out); and 50% of
  storehouses (`STOREHOUSE_BACKPACK`). Gear, codexes, potions, tools and material stacks take a slot; gold and
  creature cards don't. Swapping a weapon from the bag mid-fight uses your turn.
- ✅ **Schematics:** the Crooked Bookcase (epic drop: 20 planks + 10 nails) raises the bookcase from
  10 to 25 codexes. 📌 Changing (the user, 2026-10-20): it will come only from the tavern
  questline (§9), for 10 planks + 5 nails, holding 20.
- 📌 More schematics and furniture later, e.g. a fireplace in the Den for faster healing.
- ❓ Bag upgrades beyond the backpack, a 10-item battle bag, and bags for Klutz have all been
  mentioned, but none is designed.

## 4. Creatures

- ✅ 25 scannable species (lib/creatures/creatureData.ts), each with a rarity, a **class**
  (melee / ranged / magic) and a **race** (Beast, Underkin, Etherial, Undead, Elvish), plus
  companions (Klutz), boss parts and 6 retired species that are kept out of scans.
- ✅ **Individual rolls:** each creature's %s are the species' values with a small zero-sum spread
  (`ROLL_SPREAD_*` in creatureRoll.ts). Rarer creatures get bigger spreads. 4 move slots, each with
  a 10% chance of a rare move.
- ✅ **Cards:** a card shows one specific rolled creature. Summon with 3 cards of a species
  (`CARDS_TO_SUMMON`): **choose** a card to get exactly that creature, or **random** for a fresh
  roll.
- ✅ **Cage:** holds 1 creature (`CAGE_SIZE`; upgrades later). A new game's first creature waits in
  the cage (`starterCreature`, Lv 3). Releasing a creature gives nothing.
- ✅ The card design is settled (CardFace, the stone card). The Skull Raven (id `storm_phoenix`) is
  the quality benchmark for sprites and cards.
- 📌 Races have 5 creatures each, across the rarities. The user is designing creatures and classes
  in depth.
- ❓ **Secondary classes** (Shaman, Rogue, Brute, Trickster, Cleric were floated): undefined, and
  deferred. A **Celestial** race was mentioned as a future race. Per-creature ability pools wait on
  the user's design. (The Epic 25% / Legendary 50% chances in abilities.ts were Claude's defaults.)
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
- ✅ Enemy levels come in bands by depth (`DUNGEONS[d].levels`). Cyclops Lv 6, Warden Lv 16.
- ❓ Cards still show level-15 %s; Pit fights give no XP.

## 6. Combat

### The rules (lib/combat)

- ✅ **Format:** teams of 3, one active creature each side. Swapping uses your turn and resolves
  before attacks, so the incoming creature takes the hit. The creature swapped out recovers 50% of
  its *missing* energy (`SWAP_ENERGY_RESTORE`).
- ✅ **Agility only decides who strikes first.** This threshold behaviour is intended: players
  judge how much to invest. Don't "fix" it.
- ✅ **Class triangle:** melee > ranged > magic > melee, at **±50%** (`TRIANGLE`). The user chose
  it: mixed teams are the point, and an all-countered team should be beaten badly. Melee may stay
  the weakest class; it'll get a better move pool rather than stat changes.
- ✅ **Damage:** ratio formula, hit² / (hit + defence), so a bad matchup still chips (the user wants
  Pokémon-style chip damage, never ~0). Damage types are Force, Pierce (ignores 50% of armour) and
  Arcane (ignores 20%, plus a % of max HP). The type multiplier applies *after* armour.
  🧪 The type multipliers (Force ×1.1, Pierce ×0.95, Arcane ×0.9, the Arcane cap) are Claude's
  tuning.
- ✅ **Hard counters are intended:** a counter means much less damage and a reason to swap, not
  invulnerability.
- ✅ **Energy:** max 100, +30 after each attack. A creature with no affordable move rests (+30).
- ✅ **Precise hits:** 5% chance, ignoring 25% of defence. **Armour gap:** from the 6th use of the
  same move in a row, +10% precise chance each use, and each precise hit ignores 25 → 50 → 75 →
  100% of defence. It resets on a different move or a swap. This is the user's anti-stall design.
- ✅ **Stances:** neutral, float, entrench (engine.ts). Float takes −10% from melee and +10% from
  ranged, and deals +10% ranged; Entrench is the mirror image (melee). The stance rules are
  provisional in the original design, and there's no elemental type chart.
- ✅ **Utility moves** (learnable): Cripple (−50% agility for 3 rounds, plus a 25% chance each
  attack is lost), Haste/Blink (double agility this round only, 15 power, 60 energy), Precise (70% to hit,
  always precise).
- ✅ **Race moves:** single-use codexes, learnable only by that race. Pounce (Beast), Rabid Bite
  (Underkin, venom ticks even on the bench), Mirage (Etherial), Corpsify (Undead), Barrage
  (Elvish, hits every enemy).
- ✅ **Move codexes** (decided 2026-10-19): every natural move comes as a codex from scans, each
  teachable only to a creature of that move's class. Up to 20 damage (`BASIC_MOVES`, 15 moves)
  they're Common; above that (`STRONG_MOVES`, 10 moves) they're Rare.
- ✅ **Consumables from scans** (decided 2026-10-19) roll Common : Uncommon : Rare at 40 : 30 : 20. Common is a basic
  codex or a Lesser Potion, half each (`BASIC_CODEX_SHARE`). Uncommon is a learnable codex. Rare
  is a strong codex or a Healing Potion, half each (`STRONG_CODEX_SHARE`). The Healing Potion is
  Rare everywhere now (it was Uncommon).
- Dropped for now (2026-10-19): the **Codex of Stances** (Aerial Assault, Dig In, Meditate), once
  a planned Cyclops reward.
- ✅ **Thinking AI** (Monte Carlo) with Easy / Normal / Hard.
- 🧪 Balance in general: the user tunes from sims (the balance lab is at /lab and /simulator). Their
  goals: rarity raises the ceiling but a Legendary must not always win; well-fitted, well-rolled
  gear should beat raw rarity within a band; good play should matter more than it does now.
  Present changes to creature stats or move numbers as options. Don't apply them unasked.

### Planned

- 📌 More effects: vampirism, curse/blind, fear (blocks swapping). More moves from encounters,
  drops or daily quests.
- ❓ Making agility do more (e.g. a dodge chance): mentioned, needs the user's decision.

## 7. The Labyrinth

- ✅ A run is a climb up a **scroll map**: you plan a route and partly see rooms ahead. The first
  step is blind. Rooms can repeat. (lib/dungeon/run.ts, map.ts)
- ✅ **Two dungeons** (`DUNGEONS`):
  - **The Labyrinth:** 15 rooms to the lair, 1 large room, enemies Lv 1–7, boss the **Cyclops**.
  - **The Deep Labyrinth:** opens after your first Cyclops clear. 15 rooms, 2 large rooms, enemies
    up to Lv 17, boss the **Warden's pack** (a Legendary plus 2 Epic guards).
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
- ✅ **Gentle start, the Cyclops' Labyrinth only** (the user, 2026-10-19, as the game felt too hard
  without scanned gear): no mini boss (nor a guarded storehouse) before room 7 (`MINIBOSS_FROM`);
  the first 2 rooms are creature dens 90% of the time (`FIRST_ROOM_DENS`, otherwise a room with
  no fight), their creatures Lv 1 60% / Lv 2 25% / Lv 3 15% (`FIRST_ROOM_LEVELS`).
- ✅ **Map** (the user, 2026-10-19): a large room is never before room 5 (`LARGE_FROM`), and the
  scroll marks 7 corridors from the start (`KNOWN_CORRIDORS`), no two touching the same room.
- ✅ **Large rooms** (`LARGE_MIX`): Encampment (Rares guarding cages that may hold a creature you
  keep, in 4 variants: plain, drunk, ambush, rigged), Library (codexes to find, or a librarian
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
- ✅ **Tools:** flare (re-view the map and light around you, twice as far as your torch), clairvoyance scroll (reveal any room
  and its surroundings; 200 gold at merchants). Merchants carry 5 wares. Also found (the user,
  2026-10-20): a flare in 10% of stashes and 20% of chests, a clairvoyance scroll in 5% of stashes and
  10% of chests (`STASH_TOOLS`, `CHEST_TOOLS`), on top of what they already hold. A chest holds at
  most 5 things (`CHEST_SLOTS`, `capSack`): rolled more, the least rare fall out (gold first, then
  Common, Uncommon…).
- ✅ **Selling to the merchant:** his room shows your bag (slots used/free); tap a slot and sell it to make room.
  - ✅ Prices (decided 2026-10-19; `merchantOffer`, lib/dungeon/run.ts): weapons and armour at the crate's sell price; potions, materials,
    scrolls and tools at half his price (`MERCHANT_BUYBACK`); codexes at half the librarian's. Klutz's club can't be sold.
    Claude's defaults, added 2026-10-19.
- ✅ **Death / retreat:** a party wipe ends the run. Items left on the room floor are lost; what's in
  your bag comes home. Retreating keeps the witch's winnings. Going back to the Den mid-run is a
  retreat (after a "Leave the labyrinth?" check): runs can't be paused.
- ✅ After a boss clear, the **walk back** gathers what you left behind.
- ✅ **Healing pool (Den):** heals 25% HP an hour on one global clock, runs included.
  - 🧪 The rate is Claude's default (the user said "slowly"). The user plans upgrades and elixirs,
    and may use it as a monetisation lever later. The instant heal at the entrance is a testing
    shortcut.
  - 🧪 **For testing, everyone comes home at full health** (`HEAL_AT_HOME` in lib/dungeon/run.ts,
    on since 2026-10-19). Set it to `false` to bring the pool back.
  - ❓ How healing after a death should really work is open. Options the user was given: keep the
    slow pool (25%/h, about 4 h from knocked out to full), a faster pool (50%/h), a full heal on
    getting home, or a quick heal to about half then the slow pool.
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
- ⏸ **Shelved (2026-10-19): an explorable Labyrinth** (the user's sketch: [ideas/labyrinth-v2.png](ideas/labyrinth-v2.png)).
  Rooms of different sizes joined by corridors, walked by a little person (tap to move); one-way
  points going up (no going back), sideways moves allowed; pools, chests and the witch *inside*
  rooms (tap them), some rooms empty; the first Cyclops run twice the sketch's size; the scroll and
  flares still give a peek. Estimate: 8–12 sessions (generator, movement, room objects, saves,
  ~50–100 PixelLab generations). If picked up: a 1-session throwaway prototype in /lab first.
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
- ✅ **Neutral** (decided 2026-10-20): Klutz hunts alone and can't swap, so he's outside the
  triangle. Nothing counters him and his moves never do less; a move of his that would counter the
  target does +25% (`NEUTRAL_COUNTER`, 🧪 to tune). His class badge reads a grey "⚖️ Balanced".
  - **Skill points** (decided 2026-10-20, replacing the even 9s): he's a **Rare**, his %s start at 0,
    and he earns 6 points a level over 1 (84 at Lv 15, about a Rare's total; `POINTS_PER_LEVEL`).
    In his stats window, tap a stat to add 1% (attacks on the top row beside the points left;
    defences and agility below), then Confirm or Cancel; the stat bars preview it. A re-spec gives
    every point back for 1000 gold. Old saves get all their points to spend. His weapon and the
    codexes you teach him still decide most of how he fights. He can learn any class's codex, plus his own
  race's (Rabid Bite), and starts with Slash, Heavy Blow, Jab and Stone Throw. Sim (2,000 hunts,
  Lv 1–30): 67–72% wins, as before, but about 50% against magic instead of 26%. That lower magic
  number is only because no magic creature is Common (at equal rarity magic is one of his better
  matchups); the user chose to leave the roster as it is (2026-10-20).
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
- ❓ Known imbalance, not acted on: sell prices (epic ~800, legendary ~2,700) dwarf Labyrinth gold
  (~18 a room), and re-scan gold has no cap.

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
- **One fixed phone-sized screen** (`components/GameScreen.tsx`). On a laptop: no border, full window height, 9:16 wide, centred.
  - The page never grows or shrinks between areas; long lists scroll inside panels.
  - Actions sit in docks built into the screen, not floating buttons.
  - In battle, the moves fill the bottom ~30% of the screen. Above them, a one-on-one fight's room
    fills the whole stage (the code-drawn room's ceiling and floor carry on, `extend` in
    `lib/dungeon/chamber.ts`); there's no row of who's left (Swap shows your bench).
  - Labyrinth rooms have no frame: edge to edge, the floor fading into the screen.
  - On a laptop, Esc closes whatever's open (`hooks/useEscape.ts`); with nothing open it goes back
    a page (`components/EscapeBack.tsx`), except mid-fight in the Labyrinth.
- **Few words.** One-line summaries on screen, and depth behind a "?" (`components/Help.tsx`) in
  big, bold, broken-up text. Klutz's lines are short.
- **The stone card standard:**
  - #23262f stone with pixel bevels and a thin rarity-coloured trim;
  - the pixel font in yellow #f1d9a0, and sunken wells for text;
  - `.inv-panel` for anything holding loot or creatures;
  - Ranged is green #6fdc6f everywhere.
- **Fixed structure, text fits it** (the user, 2026-10-19: "the text around the box should move as
  that is the variable, not the constant"). Windows are a standard frame of fixed boxes; flicking
  through items or creatures changes only the contents. Varying text gets a fixed number of lines
  (clamped), and absent parts keep their space. This is what makes the game feel polished.
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
