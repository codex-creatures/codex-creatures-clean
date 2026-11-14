# Klutz

Authoritative for Klutz: hunts, his cage, skill points, finds, the first quest and the tour. Part of the [game design index](../design.md); status tags (✅ 📌 🧪 ❓ ⏸ ✗) are explained in [docs/README.md](../README.md#status-tags). **The code is the truth for numbers:** if this file and a constant disagree, trust the code and fix this file.

Moved here word for word from design.md on 2026-11-09 (the original is in [archive/2026-11-09](../archive/2026-11-09/design.md)); section numbers are kept, so references like "design.md §N" still find their place.

## 8. Klutz

- ✅ A clumsy goblin **helper, not a party creature.** He's easily bribed with gold into serving
  you, wanders the Den, and you tap him for /klutz. (lib/klutz.ts)
- ✅ **Expeditions (v2)** (the user, 2026-11-14, after the Klutz audit; built 2026-11-14, lib/klutz.ts). Sims in the
  audit (claude.ai doc "Klutz audit"): a keen player's month gives about 7 Epic creatures and a first Legendary for
  13% of players; a struggling player (no Cyclops kill) gets Rare creatures and Rare gear, no Epics.
  - **Where:** a dungeon you've beaten the boss of (the Encampment from the start): `KLUTZ_DESTS`. Each costs half
    your entry fee (`destCost`; the Encampment is free) and sets the best rarity (Encampment Rare, Cyclops Epic,
    Hydra and Abyss Legendary; the Abyss rolls a rarity up 30% of the time), how many levels tougher its creatures
    are (0 to +3) and how many strike first (10% to 40%: they use their style's first-strike move, so a glass cannon
    takes chip damage). 🧪 Those numbers are Claude's.
  - **Every 20 minutes** (`FIND_EVERY_MS`) he finds something: a creature 30%, a codex 10%, a material or potion 20%,
    a weapon or armour piece 40% (`FIND_MIX`). Rarities at the usual split, capped by the dungeon, by his level
    (`SCAN_UNLOCK`) and by your explorer level (`capRarity`). The old "never rarer than his piece" rule is gone.
  - **Creatures:** he fights it (no healing on the way); beaten, it's caught at `CATCH_CHANCE` (Common 100%,
    Uncommon 90%, Rare 70%, Epic 40%, Legendary 15%; 🧪), plus Trapping. Caught ones go to the cage (spares let go,
    as before); a beaten one drops a piece of its gear 20% of the time (`GEAR_DROP_CHANCE`). Legendaries come home
    as creatures.
  - **Home** when his pack is full, when he's down to 10% HP (`HOME_AT`), or when something beats him: no penalty, he
    keeps everything. Call him back any time. He can set off from 40% HP (`SEND_AT`; the pool still heals 1 HP every
    10 s), not while his chest is full, and not without the gold. A safety stop after 100 finds (about 33 h).
  - **His pack** holds 8 (`PACK_START`), up to 20: the **Bigger Pack** trait (+4; free since 2026-11-14, the user: the trait pick
    is its price, it cost 1,000 gold) and **Pack Upgrades** (+1 each; in 5% of chests, and 20% of merchants' carts at
    500 rising to 4,000: `KLUTZ_PACK_PRICES`), sewn on from his Skills tab: it shows his pack's slots (all 20, the
    ones still to sew on dashed) and the upgrades you hold; tap one and a new slot pops in (the user, 2026-11-14).
  - **His chest** (the crate) takes codexes, potions and gear; materials go straight to your tally. It holds 30
    (`CHEST_START`), +10 an upgrade for 500 to 5,000 gold; full, he won't set off (a trip can overfill it).
  - **Skills** (a point a level over 1, each up to 10): **Trapping** (+2% catch chance a level), **Armourer**,
    **Scavenger**, **Scholar** (each +3% a level: an extra weapon or armour, material or potion, or codex in each
    20-minute window). 🧪 The steps are Claude's. A re-spec hands them back with his % points.
  - **Traits** (the user, 2026-11-14): he picks one at **Lv 5, 10 and 15** (`TRAIT_LEVELS`), any he hasn't got, in any
    order: the Bigger Pack (above), **Selective** (he leaves things below a rarity you pick) or the **cage filter** (he
    only cages creatures of a rarity you pick or better). Till he has a pick, the rest show locked. Each skill
    shows his level in it, big (3/10); its +1 shows only with a point to spend (the user, 2026-11-14).
  - **Screens:** his page has three tabs under his card: Send (the dungeons as fixed rows, best rarity and cost, one
    button that says why he can't go; while he's out, HP, pack and a log), Skills, and Chest (its fill and upgrade).
  - Trips planned before v2 keep their own rules (fights with a find each) and still hand over what they held.
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
  he's away). Since v2 (the user, 2026-11-14) **any codex there is**, race and special moves included. What he's learned is kept in `KlutzState.learned`.
  - **Skill points** (decided 2026-10-20, replacing the even 9s): he's a **Rare**, his %s start at 0,
    and he earns 6 points a level over 1 (84 at Lv 15, about a Rare's total; `POINTS_PER_LEVEL`).
    In his stats window, tap a stat to add 1% (attacks on the top row beside the points left;
    defences and agility below), then Confirm or Cancel; the stat bars preview it. A re-spec gives
    every point back for 1000 gold. His weapon and the codexes you teach him still decide most of
    how he fights. He starts with Slash, Heavy Blow, Jab and Stone Throw. (A pre-V2 sim: history.md.)
- ✅ **Levels:** a catch gives the KO's XP + 50 and everything he brings home 20, all halved since v2 (`XP_SHARE`,
  the user, 2026-11-14: "so you use more books"). A first catch
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
  Before he borrows any gear, you have to put some armour from the box on your creature
  (`needsGearUp`). Each step glows (the user, 2026-10-31): the Pit in the Den, the Creatures tab, your
  creature, the armour slots you have armour for, a piece in the picker, Equip, then "Back to Klutz".
  Once the box is opened, Klutz offers "Show me round" or "Skip the tutorial" (the user, 2026-11-01):
  skipping goes straight to him hunting for you (`skipTutorial`).
- ✅ **Klutz's tour** (lib/tour.ts, components/TourOverlay.tsx; the user, 2026-11-01): "Show me round"
  walks you through the Den. Each step dims the screen but one thing (a place's label in the Den, or a
  `data-tour` mark on a screen) with a line from Klutz; a tap anywhere goes on, into a place after
  it's been lit up in the Den. Altar, Pit, bag and Klutz are entered; cage, crate, pool, bookcase,
  board, Bestiary and the Labyrinth are explained from the Den. It ends in the Inventory with the
  box's gear and how to equip it, then the quest carries on (armour on, then "Deal"). The aim: a new
  player understands ~70% of the game. Skip tour any time; it resumes where you left it (its own
  save field, `tour`, with which tour it is: none means the full one); a "Tutorial" button beside Equip on
  Klutz's page opens the tours again in a pop-up window.
  - ✅ **Four tours** (the user, 2026-11-12; `TOURS`): **The basics** (round the Den, a line a
    place), **Combat** (races and their colours, a tablet's colour = its race and its carved mark
    = its style, the (i), energy and how it comes back, the race chart with pictures in Klutz's
    bubble (components/TourPicture.tsx), swapping, turn order; ends on the chart in the Bestiary),
    **Items** (rarity budgets, what a kind leans to, armour, a creature's % as extra from its gear;
    ends in the Inventory), and **The full tour** (all three in a row). Offered two by two when the
    box is opened, beside "Skip the tutorial". Klutz's line sits inside the screen's safe area, so
    it's never under a phone's notch.
- ✅ **Equipping:** gear can be dragged onto a creature (loot windows, and the bag in the Labyrinth)
  or onto its slot (the creature window). Dragged straight from a chest, it opens the compare
  window with nothing moved (bag full or not); equipped, what it replaces goes in the bag, or into
  the chest if the bag is full.
  In loot windows and the Labyrinth bag, an XP scroll can be dragged onto any party creature to read
  it, and a Revival Elixir onto a knocked-out one (the party row shows the knocked out at 0%). A
  flare or clairvoyance scroll can be used straight from a chest (tap it: Light it / Read it). In the Labyrinth, equipping opens a compare window first:
  the slot's old piece vs the new one, each stat's change, and your party along the top marked ▲/▼
  so you can see who it helps.
- ✗ **Kidnap plan** (Klutz kidnapped on a hunt, rescued through a mini dungeon): replaced by the
  Encampment dungeon (the user, 2026-11-04).
- ⏸ The intro (Klutz drags you in, you tip him gold) is parked until the art direction settles.
