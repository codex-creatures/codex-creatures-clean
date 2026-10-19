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
- ✅ Outcome odds (`rollBarcodeOutcome`): 20% creature, 60% item, 20% gold. Items: weapon, armour,
  material, consumable.
- ✅ **1 drop per new scan** (`SCAN_DROPS`). Items should stay scarce; gold scans are the
  "dud" consolation.
- ✅ The altar has a setting: **Looting** opens each Code Cache at once; **Storage** keeps them at
  the altar to open ten at a time.
- ✅ Scanned creatures: 10% are a real creature, 90% a **creature card** (`REAL_CREATURE_CHANCE`).
- ✅ Your **explorer level** caps how rare a scanned creature can be (`SCAN_UNLOCK`: rare at
  Lv 2, epic at 6, legendary at 12). A too-rare barcode stays sealed: it doesn't count, and the
  altar shows the level needed.
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
- ✅ Full-set bonuses (all 3 pieces) are effects, not stats (`SET_BONUS` in lib/items/armor.ts):
  Hard Shell, Quickscale, Nullify, Deflect, Steadfast, Unstoppable, Second Wind.
- ✅ Weapons have a damage-type affinity (+15% when the move's type matches: `AFFINITY_BONUS`).

### Materials, consumables, bags

- ✅ **Materials** (planks, metal bars, nails, essence stones: lib/items/materials.ts) are a tally at
  home, like gold. In the Labyrinth a material find is a stack that takes one bag slot and joins
  the tally when you get home.
- ✅ **Potions** go in the bag. The Chest (Inventory) stores the rest.
- ✅ **Bags:** you start with a Bindle (3 slots, `BINDLE`). The first Cyclops's chest holds a Rugged
  Backpack (5, `BACKPACK`). Gear, codexes, potions, tools and material stacks take a slot; gold and
  creature cards don't. Swapping a weapon from the bag mid-fight uses your turn.
- ✅ **Schematics:** the Crooked Bookcase (epic drop: 20 planks + 10 nails) raises the bookcase from
  10 to 25 codexes.
- 📌 More schematics and furniture later, e.g. a fireplace in the Den for faster healing.
- ❓ Bag upgrades beyond the backpack, a 10-item battle bag, and bags for Klutz have all been
  mentioned, but none is designed.

## 4. Creatures

- ✅ 25 scannable species (lib/creatures/creatureData.ts), each with a rarity, a **class**
  (melee / ranged / magic) and a **race** (Beast, Under-dweller, Etherial, Undead, Elvish), plus
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
  attack is lost), Haste/Blink (+50% agility this round and the next 2), Precise (70% to hit,
  always precise).
- ✅ **Race moves:** single-use codexes, learnable only by that race. Pounce (Beast), Rabid Bite
  (Under-dweller, venom ticks even on the bench), Mirage (Etherial), Corpsify (Undead), Barrage
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
  - ❓ Claude read "equal %s including stick" as higher / lower / same at equal odds, with "same"
    as a push. Confirm with the user.
- ✅ **Tools:** flare (re-view the map and light around you), clairvoyance scroll (reveal any room
  and its surroundings; 200 gold at merchants). Merchants carry 5 wares.
- ✅ **Death / retreat:** a party wipe ends the run. Items left on the room floor are lost; what's in
  your bag comes home. Retreating keeps the witch's winnings.
- ✅ After a boss clear, the **walk back** gathers what you left behind.
- ✅ **Healing pool (Den):** heals 25% HP an hour on one global clock, runs included.
  - 🧪 The rate is Claude's default (the user said "slowly"). The user plans upgrades and elixirs,
    and may use it as a monetisation lever later. The instant heal at the entrance is a testing
    shortcut.
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
  **Tavern** for 300 gold, and a **trophy** showing which run you won on (that run is already
  recorded: `meta.firstClearRun`).

## 8. Klutz

- ✅ A clumsy goblin **helper, not a party creature.** He's easily bribed with gold into serving
  you, wanders the Den, and you tap him for /klutz. (lib/klutz.ts)
- ✅ **Hunts:** he walks 20–60 minutes (🧪 Claude's range), meets one creature (his level −2 to +1)
  and fights it 1v1.
  - **Win:** the creature goes to the cage, and he brings home its weapon plus one armour piece.
  - **Lose:** he heals in the pool (1 HP every 10 s) before he can go out again.
  - His gear is locked while he's away.
- ✅ **Finds:** 35% of trips bring home gear for a slot he wears. It's **never rarer than his own
  piece** (the same rarity only 5%, rising slightly with his level).
- ✅ **Levels:** only won hunts give XP. A first catch reaches Lv 2; a find gives 20. Scrolls work on
  him, and the user wants that to feel worthwhile ("the closest thing to you").
- ✅ **First quest, "Klutz's box":** a Baby Cyclops stole his box. In a guided first fight he gives
  advice (he doesn't fight). The box holds 10 pieces of Common/Uncommon gear (lib/quest.ts).
  On the way, Klutz's Club lies on the floor and is picked up through the loot window: a tutorial
  there teaches taking it into the bag and equipping it (tap, or drag onto a creature), and the
  equip window explains where stats come from (gear × the creature's %).
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
  Fight Pit, chest (Inventory), crates, bookcase (codexes; 10, or 25 upgraded), bindle/bag, merchant
  stall, and a boarded-up Tavern.
- 📌 **Tavern:** where travellers, merchants and librarians gather. Built with gold after the
  Cyclops. Not built (reserved space only).
- 📌 Wandering merchants and weapon dealers as gold sinks. The user will design gold sinks.
- ❓ Known imbalance, not acted on: sell prices (epic ~800, legendary ~2,700) dwarf Labyrinth gold
  (~18 a room), and re-scan gold has no cap.

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
- Hand-drawn detailed sprites in code were tried and scrapped. Don't do it again.
- Rejected, so don't reopen: the mushroom/ruin room theme, the Mr. Shadows redraws (keep the old
  sprite), and the parchment / MTG / wood-and-brass card styles.
