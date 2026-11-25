# Creatures, levels and XP

Authoritative for species, rolls, cards, cages, soul stones, levels and XP. Part of the [game design index](../design.md); status tags (✅ 📌 🧪 ❓ ⏸ ✗) are explained in [docs/README.md](../README.md#status-tags). **The code is the truth for numbers:** if this file and a constant disagree, trust the code and fix this file.

Moved here word for word from design.md on 2026-11-09 (the original is in [archive/2026-11-09](../archive/2026-11-09/design.md)); section numbers are kept, so references like "design.md §N" still find their place.

## 4. Creatures

- ✅ 44 scannable species (`CREATURE_TEMPLATES`, lib/creatures/creatureData.ts and rosterV2.ts): the 35 (7 races × one of
  each rarity) and the user's 9 picks of 2026-11-26 (decision 66): Skinwing, Gutsnout, Grub Keeper (Commons), Mole Hag,
  Gloom Gnome (Uncommons), Cinder Husk, Troglodyte Brute, Gravewarden (Rares), Hexed Puppet (Epic); chosen from 50 drafts
  (art/creature-candidates, with their specs). Each has a rarity, a main **style** (`cls`: melee / ranged / magic),
  an **archetype** (which style kits it draws from, §6) and **one or two races** (Undead, Divine,
  Beast, Underkin, Geo, Humanoid, Toxic). Plus Klutz (no race) and the boss parts. (The 7 species retired before V2 were removed
  on 2026-11-04: no save from after the fresh start can hold one.)
- ✅ **Individual rolls:** each creature's %s are the species' values with a small zero-sum spread
  (`ROLL_SPREAD_*` in creatureRoll.ts). Rarer creatures get bigger spreads. 4 move slots: it's
  born with its 3 starting moves (§6), and a 10% chance (`RARE_MOVE_CHANCE`) of a rare learnable
  move of its style in the empty fourth (the user, 2026-10-26: never in place of a starting move).
- ✅ **Cards:** a card shows one specific rolled creature. Summon with 3 cards of a species
  (`CARDS_TO_SUMMON`) at the **Soul Altar** (app/altar, its Summon tab; the user, 2026-11-18: only
  there): **choose** a card to get exactly that creature, or **random** for a fresh
  roll. Its summoning page (the user, 2026-11-20; components/altar/SummonRite.tsx) shows the 3
  cards going in on top and every card of the kind below to swap them; a ready stack at the altar
  opens it straight away, and a card window anywhere else has a Summon button that goes there
  (`/altar?summon=<id>`). The summoning plays out (the user, 2026-11-02; components/SummonShow.tsx): the 3 cards are
  set on the Soul Altar, whirl up into a whirlwind that climbs the rarity colours like a Code Cache
  (`summonStages`, lib/scanReveal.ts) to the creature's, then burst into it. Tap to skip.
- ✅ **Cage:** holds 1 creature, then 3 and 5 as it's built up ([items.md](items.md): the cage in stages). A new game's first creature waits in
  the cage (`starterCreature`, Lv 3). It knows its style's three core moves and one move of its own (main)
  race, `STARTER_RACE_MOVE` (the user, 2026-11-20: that race's least damaging, least complicated attack, whatever
  its style): Beast Claw, Geo Flame Spit, Undead Nibble, Toxic Poison Dart, Humanoid Whiplash, Underkin Rock
  Toss (made for it, 2026-11-20), Divine Blessed Bolt (the user's, 2026-11-20: ranged, Uncommon, 30 energy; 15
  power 🧪, Claude's). It keeps it whatever its species could learn from a codex (a gift;
  codexes still follow their learners). Releasing a creature gives nothing. A captured creature joins
  your creatures (the starter is also the first free pick at the Labyrinth's entrance).
- ✅ **Ascension** (see below): give up creatures of a kind at the Soul Altar to raise one a rarity.
- ✅ **Naming** (the user, 2026-11-24; lib/creatures/nickname.ts): tap a creature's name in its window and it's a
  text box; what you type (up to `NICK_MAX` = 14 letters, the longest species name's; empty puts the species' name
  back) stands in for its species' name everywhere (lists, cards' owners, battles, the Labyrinth, Klutz's crate,
  PvP: a fighter built from it carries it). Kept on the drop as `nick`; its `name` is set to it on load, so every
  screen shows it without knowing. The species shows small under a given name. Klutz suggests naming your first
  creature once he's helping (`nameTipDue`, till you've heard him or named one: `nameTipRead`).
- ✅ The card design is settled (CardFace, the stone card). The Skull Raven (id `storm_phoenix`) is
  the quality benchmark for sprites and cards.
- ✅ The 35 are one per rarity per race (a dual-race creature counts under its first race); since the 2026-11-26 picks a
  race can have more than one of a rarity (by first race: Underkin 9, Beast 7, Undead 7, Humanoid 6, Geo 6, Divine 5, Toxic 4). The plan is to roughly
  double Epic and below; Geo and Divine are the next to grow (the user, 2026-11-26).
- ❓ **Secondary classes** (Shaman, Rogue, Brute, Trickster, Cleric were floated): largely answered
  by Combat V2's archetypes (§6); anything more is undefined and deferred. A **Celestial** race was mentioned as a future race.

### Ascension (the user, 2026-11-18, decision 49; lib/creatures/ascend.ts)

- ✅ **The Soul Altar starts broken** (the user, 2026-11-20; lib/dungeon/run.ts `altarMended`): no summoning and
  no ascending (its two choices greyed out, "The altar is cracked and cold…") until the Encampment's chief is
  beaten: he drops the gem that mends it (the first-win line says so). Anyone past him already has a working altar.
  The 3D Den draws it cracked and cold till then (the sample recipe `altar-broken`).
- ✅ **The Soul Altar's screen** (the user, 2026-11-18; app/altar, components/altar/AltarBackdrop.tsx):
  you stand over the altar, its soul-fire cauldron big at the bottom (the Den art's 8 frames,
  spirit motes rising), and pick from two borderless floating panels side by side: **Spirit
  Summon** (from cards) and **Ascend** (from creatures), each saying what you could do now.
- ✅ **The ritual** (Ascend, components/AscendRitual.tsx): a circle of turning rune rings hovers over
  the cauldron, lit in the next rarity's colour: the creature to raise in the middle, the offerings
  round it, 4 for the first step (`ASCEND_FIRST` = 5 in all), 2 for each after (`ASCEND_AFTER` =
  3), each tied to the middle by a thread of light. Under it, rarity now → next and its stats
  now → after (at its level and at the top level, Lv 50); then an inspect panel for the creature you tapped (its
  soul stone, birth rolls, moves with codex ones marked, gear, and a Raise / Offer / Take out
  button); then your creatures in a tray you swipe sideways and drag up into the circle (onto a
  slot, or anywhere in it for the next free one; dropped on the middle when one's there, it's an
  offering: only Raise changes the one in the middle). Up to Legendary, so a Common takes 5 / 15 /
  45 / 135 of its kind to reach Uncommon / Rare / Epic / Legendary.
- ✅ **Who can take part:** creatures only (not cards), all the same species and the same rarity at
  the time (an Uncommon Moss Wolf is raised with Uncommon Moss Wolves, each from its own ritual),
  every one Lv 5 or more (`ASCEND_MIN_LEVEL`; an XP scroll gets one there). One on a run or in the
  pit can't take part; one in a team (a PvP one too) can be raised but not given up.
- ✅ **What happens:** the kept one keeps its level, XP, roll, moves, codex moves and soul stone. The
  others are gone, with their soul stones and codex moves; their gear comes off and stays yours. A
  warning first if one given up has a soul stone or an Epic or Legendary codex move
  (`WARN_CODEX_FROM`). The summoning's whirlwind plays with the creatures, climbing to the new
  rarity, and ends on what it gained: each stat now, its rise, and its rise by Lv 50.
- ✅ **Its stats** (lib/creatures/ascendStats.ts): each step adds that rarity's budget to its
  species' level-15 values: `ASCEND_STATS` +16 / 24 / 25 / 59 %s and `ASCEND_HP` +15 / 19 / 23 / 23
  base HP for Uncommon / Rare / Epic / Legendary (the gaps between the rarities' average species on
  2026-11-18). The %s follow the species' own shape (a stat it has none of stays none), shared out
  exactly; no randomness, so its birth roll is its only variance. Like the species' %s, the bonus
  grows with level (`levelFactor`): small at Lv 5, all of it at Lv 15, double by Lv 30 and three and a half times by Lv 50. So an
  ascended creature at any level has what that level gives at its rarity, however and whenever it
  climbed. The ritual's window shows its stats now and after, and at the top level (`MAX_LEVEL`).
- ✅ **Nothing is stored but the steps** (`ascended` on the creature; missing = none). Its stats are
  worked out from them every time (`proficiencyAt` and `hpAt` take the steps, so nothing that
  shows a creature can leave them out; enemies and cards pass 0), its saved %s are never touched,
  and its `rarity` is its species' plus its steps (put right whenever a save loads).
- ✅ **Its rarity counts everywhere**: PvP brackets (an Epic Bellow Toad is out of the Rare formats;
  a Rare Moss Wolf is in them), card trim, quests that ask for a rarity. It isn't a summon. ★ on its
  tile and window marks each step.
- 🧪 **What it costs** (a sim on 2026-11-18, the Encampment's chief's cage and chest only, a party
  picked to narrow the cage): 15 of one Common ≈ 370 Encampment runs or ≈ 1,400 new scans; 45 ≈
  1,100 runs. With scans and runs together, Epic in about four weeks of steady play. The user
  judged 5-then-3 balanced.

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
- **Klutz:** he can't just pick one: you give him one of your loose soul stones from his Equip
  window (tap the soul stone slot), on the same terms as a creature (free into an empty slot,
  5,000 gold to replace his, the old one destroyed), and only while he's home (the user,
  2026-10-31; before that you chose his stone for free, and a stone he got then he keeps). Only the four that do
  something for him (`KLUTZ_STONES`): no Revitalise (he never swaps out) and no Trickster (no
  utility move). Saved as `KlutzState.soulStone` (missing = none).
- **Loose soul stones** (the user, 2026-10-25): a stone found on its own, as a consumable item
  (`stone` on the drop, `soulStoneDrop`), always one particular stone of the six.
  - Scans: 1% of outcomes (`SCAN_ODDS.soul_stone`, taken from armour: now 26%), **only for the
    first ever to scan the barcode**; anyone after gets gold (`claimedOutcome`). Online, "first"
    means first of all players (the global registry, §12).
  - Boss chests: the Cyclops 2% (`CYCLOPS_SOUL_STONE`), the strongbox (the Hydra's, the Warden's) 5%
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
    resolve first, so swapping it in can stop the attack due that same turn. The fear is hidden
    (no status icon, no log line) until the creature tries to attack and loses it.
  - **Unstoppable Force**: can't be crippled.
  - **Perfectionist**: each use of the same move in a row does 10% more than the last, compounding
    (10 → 11 → 12.1, ±5% spread), with no cap. Resets on a different move, a rest, a stumble or
    fear, an item, or swapping out (the foe swapping doesn't reset it).
  - **Trickster**: its utility moves go before everyone, whatever the agility. ✅ (the user,
    2026-11-16) Every utility move counts, any move that does no damage, the ones aimed at a foe
    too (Nullifying Voice, Caltrops, Choking Smog…), not just those used on itself as before
    (`turnPriority`, lib/combat/battle.ts). Its text: "Its utility moves always go first." (Attacks
    with a side effect, like Cripple, are attacks: not included.)
  - **Revitalise**: swapped out to the bench, heals 25% of its max HP.
- 📌 More stones later: the user plans to expand the list.
- ❓ A slave trader who buys creatures (with the Tavern's encounters): mentioned, not designed.

## 5. Levels and XP

- ✅ Levels 1–50 (`MAX_LEVEL`; the user, 2026-11-23: it was 30, which the veterans' whole teams had reached by
  hour 13 to 24). The curve carries on as it was: Lv 30 to 50 takes about 42,400 XP a creature (Lv 1 to 30:
  17,300), and a Lv 50 creature has its species' %s three and a half times over and twice its Lv 15 HP.
  Nothing in the Labyrinth is above Lv 26, so levels past 30 are for getting through the Abyss and for
  PvP's formats (which set their own level). Klutz stays at 30 (`KLUTZ_MAX_LEVEL`: his trips, points and
  the campaign's last quest were set for it), and so does your explorer level. The Bestiary shows every
  creature's stats at Lv 15, 30 or 50 (a row of three buttons over the list; `STAT_LEVELS` in app/guide).
  The species' listed %s are its level-15 values (`REF_LEVEL`). At
  Lv 1 a creature has only its roll, so two creatures of a rarity are close and the species shows
  as they level. HP is ×1.5 overall (`HP_SCALE`). (lib/creatures/levels.ts)
- ✅ **HP %** (the user, 2026-11-25, decision 65): a % like the others (`hp` in the %s), levelling the same way, that multiplies a
  creature's whole HP, gear included (`withHpPct` in buildFighter). The species' values are the balance refresh's draft
  (walls 50–80, bruisers 15–30, casters and snipers 3–25; the Glob 50 with base HP 118, its defence being its goo). A
  birth roll can move points onto or off it; ascension grows it by the same share as the other %s, outside the step's
  budget. A creature saved before it takes its species' value. Bosses have their own (`BOSS_HP_PCT`, lib/creatures/creatureData.ts),
  set by sim so their win rates hold (tests/bossSim.test.ts, run on request: the Cyclops 50, the Hydra 22; the Minotaur's 15 is an
  estimate until its sim is run, ❓). Shown in the creature window (the Health row, and a Health box with the multipliers),
  cards, the Bestiary, the level-up and the Soul Altar.
- ✅ **No zeros** (the user, 2026-11-25): every species % is at least 3; the zeros were filled without taking from other stats.
  Creatures already owned were moved over once on load (`upgradePcts`, `pctSet`), rivals' rosters too.
- ✅ XP per KO depends on the enemy's level and rarity. A boss part gives 200. A fight's XP is
  shared by impact (damage dealt + half the damage taken, at least 10% each); a level-30 creature
  takes half its share and the rest goes to the others (`MAXED_SHARE`, the user, 2026-11-11). No XP for a lost
  fight. Levelling is 1.5× slower than first built (`XP_PACE`), at the user's request.
- ✅ **After a won fight** (the user, 2026-11-09; components/FightWon.tsx, `xpShown`): a Victory
  window shows each creature's XP counting up from what it had to what it has now ("120 / 300
  XP"), its level bar filling with it and on through each level it gains, then **Leave** (on the left; the loot stays on the floor to open later) or **Loot** (opens what they dropped; a
  fight with nothing to loot, the thief's, has just Carry on). Level-up shows follow it. Not
  when a win ends the run at the top (classic): the haul screen shows it, as before.
- ✅ **Explorer level** (you, `save.player`) gets every fight's full XP and gates scan rarity
  (section 2).
- ✅ **Tattered XP Scroll:** a flat 400 XP (`SCROLL_XP`, about Lv 1 → 5). Read from the creature
  window; works on Klutz. Or from the Inventory (the user, 2026-11-20): tap the scroll, 📜 Read, and pick
  who reads it, Klutz first (once he's helping), then your creatures (components/ScrollTargetPicker.tsx).
  - 🧪 Drop rates: mini-boss chests 25%, boss chests 50%, 20% of merchants at 200 gold. The 25% and
    50% are Claude's numbers.
- ✅ Enemy levels come in bands by depth (`DUNGEONS[d].levels`). Cyclops Lv 6, Hydra Lv 16, Warden Lv 25 (the Abyss).
- ❓ Cards still show level-15 %s; Pit fights give no XP.
