# Klutz

Authoritative for Klutz: hunts, his cage, skill points, finds, the first quest and the tour. Part of the [game design index](../design.md); status tags (✅ 📌 🧪 ❓ ⏸ ✗) are explained in [docs/README.md](../README.md#status-tags). **The code is the truth for numbers:** if this file and a constant disagree, trust the code and fix this file.

Moved here word for word from design.md on 2026-11-09 (the original is in [archive/2026-11-09](../archive/2026-11-09/design.md)); section numbers are kept, so references like "design.md §N" still find their place.

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
  save field, `tour`, with which tour it is: none means the full one); "Show me round again" on
  Klutz's page.
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
