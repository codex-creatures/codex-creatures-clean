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
  - **Once in every 20 minutes** (`FIND_EVERY_MS`), at a random moment in it, he may come across something (the user, 2026-11-19:
    every 20 minutes on the dot felt far too rigid). Nothing at all is 30% less 1% a level (`NOTHING_START`,
    `NOTHING_STEP`, `findChance`; the user, 2026-11-20): 71% at Lv 1, 100% at Lv 30, shown on the Hunt tab (🔍). When
    it's something: a creature 30%, a codex 10%, a material or potion 20%, a weapon or armour piece 40% (`FIND_MIX`). Rarities at the usual split, capped by the dungeon, by his level
    (`SCAN_UNLOCK`) and by your explorer level (`capRarity`). The old "never rarer than his piece" rule is gone.
  - **Creatures:** he fights it (no healing on the way); beaten, it's caught at `CATCH_CHANCE` (Common 100%,
    Uncommon 90%, Rare 70%, Epic 40%, Legendary 15%; 🧪), plus Trapping. Caught ones go to the cage (spares let go,
    as before); a beaten one drops a piece of its gear 20% of the time (`GEAR_DROP_CHANCE`). Legendaries come home
    as creatures.
  - **Home** when his pack is full, when he's down to 10% HP (`HOME_AT`), or when something beats him: no penalty, he
    keeps everything. Call him back any time. He can set off from 40% HP (`SEND_AT`; the pool still heals 1 HP every
    10 s), not while his chest is full, and not without the gold. A safety stop after 100 windows (about 33 h).
  - **His pack** holds 8 (`PACK_START`), up to 20: the **Bigger Pack** trait (+4; free since 2026-11-14, the user: the trait pick
    is its price, it cost 1,000 gold) and **Pack Upgrades** (+1 each; in 5% of chests, and 20% of merchants' carts at
    500 rising to 4,000: `KLUTZ_PACK_PRICES`), sewn on from his Skills tab: it shows his pack's slots (all 20, the
    ones still to sew on dashed) and the upgrades you hold; tap one and a new slot pops in (the user, 2026-11-14).
  - **His chest** (the crate) takes codexes, potions and gear; materials go straight to your tally. It holds 30
    (`CHEST_START`), +10 an upgrade for 500 to 5,000 gold; full, he won't set off (a trip can overfill it). Keeping
    things from it needs room (the user, 2026-11-17): each goes only into a box with space, a codex only while
    the bookcase has room, and the rest stay in the crate with the reason shown (`roomFor`, lib/items/storage.ts).
    Quest rewards, by contrast, always come home, even into a full box.
  - **Skills** (a point a level over 1, each up to 10): **Trapping** (+2% catch chance a level), **Armourer**,
    **Scavenger**, **Scholar** (each +3% a level: an extra weapon or armour, material or potion, or codex). They roll
    on a clock of their own (the user, 2026-11-19): in each 30 minutes (`SKILL_EVERY_MS`) the skills he has go in a
    random order, each rolling once at a random moment. His trip story marks what they found with a ⭐. 🧪 The steps
    are Claude's. A re-spec hands them back with his % points.
  - **Traits** (the user, 2026-11-14): he picks one at **Lv 5, 10 and 15** (`TRAIT_LEVELS`), any he hasn't got, in any
    order: the Bigger Pack (above), **Selective** (he leaves things below a rarity you pick) or the **cage filter** (he
    only cages creatures of a rarity you pick or better). Till he has a pick, the rest show locked. Each skill
    shows his level in it, big (3/10); its +1 shows only with a point to spend (the user, 2026-11-14).
  - **Klutz's Den** (the user, 2026-11-18; app/klutz): his home, a den within the Den, reached from his crate in the
    room (labelled Klutz's Den) or from him when he's in, and opens on the Crate tab. His card says where he is (home,
    resting with his HP, or out and when he's back: greyed out while he's away), with his tours on a button. Five tabs, in this order (the user, 2026-11-20: his finds first, Hunt in the middle):
    **Crate** (its fill and upgrade, and what's in it to
    keep or sell: components/klutz/KlutzCrate.tsx; app/crate still shows it on its own), **Kit** (his stats with gear on and his own % under each, what he's wearing, his soul stone and
    moves, and Equip: components/klutz/KlutzKit.tsx), **Hunt** (the dungeons as fixed rows, best rarity and cost, one button that says why he can't go; while he's out,
    his HP, his trip told as a story, his pack's slots and Call back: see below), **Skills** and **Trips**.
  - ✅ **His trip, as a story** (the user, 2026-11-18; components/klutz/KlutzStory.tsx): every fight and find in
    order, each with how many minutes in: a fight says the creature (rarity, level), how many rounds, the damage he
    took and his HP, and how it ended (caught; beaten but got away; caught but the cage full; under the cage filter,
    let go: `filtered`; or it beat him), with its XP; gear a creature dropped follows it; a skill's extra find says
    which skill spotted it (with a ⭐); a window that brought nothing gets a line of its own (he broke into some crates, but they were empty…: `Expedition.empty`, `EMPTY_LINES`, the user 2026-11-20); a find under his Selective rarity says he left it behind (`Expedition.passed`, from
    2026-11-18); it ends with why he came home, or "still exploring". In a scrolling panel that keeps the newest line
    in view. Under it while he's out, his pack: a slot for each it holds, filled with what he's picked up (full: he's
    heading home). (The testing "skip to the end" button went the same day.)
  - ✅ **His trips are kept** (`trips`, `TRIP_LOG` = 20, newest first; lib/klutz.ts `tripOf`, `tripLog`): each, once
    he's home, as a short record: where, when and how long, why he came home, his XP, every fight (won, caught) and
    every find (names and rarities), how many went in the cage, and his **kit** as he set off (level, HP, his %s,
    gear, soul stone and moves: `Expedition.kit`, stored when he's sent). The Trips tab lists them; tap one to open
    it. A save from before shows its last trip (with no kit). Planned: art for his den (a den within the Den, the
    user: UI first, art and its place in the room later).
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
  ✅ **Walked, by torchlight** (the user, 2026-11-20: "run like a normal labyrinth… make this feel special as
  it will be their first experience"; lib/dungeon/tutorialRun.ts): always the same place, made by hand. You start
  inside (no scroll first) with a line from Klutz handing you a torch and two Lesser Potions (the thief's a long
  fight: combat.md, the guided first fight), at the bottom of a small entrance: wall
  torches lit, an empty bookcase to search (dust), cobwebs in its top corners, a puddle, a rat running along the
  top wall into its hole, crates, pots and a skull in its corners. One corridor leads up, a torch on each wall;
  halfway up Klutz's Club lies on the floor, glowing gold with a "!" over it. Walk up to it: it goes in your bag,
  and the bag opens under the walk with the tutorial that teaches equipping it (tap, or drag onto a creature),
  and the equip window explains where stats come from (gear × the creature's %). The next room is the thief's:
  standing torches either side of the way up light a pair at a time, bones, pots and barrels in its corners, a
  cobweb, and the Baby Cyclops waiting at the top, club in hand (his sprite since 2026-11-20; the box is his prize). Walk up to him and the guided fight starts; win,
  and the room's window has the box to pick up and take home. It's free, counts as a Labyrinth run, never a
  clear. Left before the end, you start it again (the club isn't there twice). Its placements are written by
  hand at the world version of its day (`TUTORIAL_PLACED`), so it doesn't change when the generator does.
  (Until 2026-11-20 it was the old Labyrinth's scroll: one tunnel to a "?" room with the club, one on to the thief;
  a run like that still saved plays out as it did.)
  Before he borrows any gear, you have to put some armour from the box on your creature
  (`needsGearUp`). Each step glows (the user, 2026-10-31): the Pit in the Den, the Creatures tab, your
  creature, the armour slots you have armour for, a piece in the picker, Equip, then "Back to Klutz".
  Once the box is opened, Klutz offers "Show me round" or "Skip the tutorial" (the user, 2026-11-01):
  skipping goes straight to him hunting for you (`skipTutorial`).
- ✅ **His first trip** (the user, 2026-11-20: "guide them to equip Klutz before we send him into the Labyrinth";
  `klutzFirstStep`, lib/quest.ts): once he's helping (after "Deal.", or skipping the tutorial) and till he's first sent, he
  asks to be kitted out (a weapon or any armour on him: his Kit tab and its Equip glow), then to be sent (the Hunt tab and
  Send glow; the Encampment's free), with a ❗ on his cabin in the Den. Only a nudge: he can still be sent bare. Anyone who's
  sent him before is past it.
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
