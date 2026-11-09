# Creatures, levels and XP

Authoritative for species, rolls, cards, cages, soul stones, levels and XP. Part of the [game design index](../design.md); status tags (✅ 📌 🧪 ❓ ⏸ ✗) are explained in [docs/README.md](../README.md#status-tags). **The code is the truth for numbers:** if this file and a constant disagree, trust the code and fix this file.

Moved here word for word from design.md on 2026-11-09 (the original is in [archive/2026-11-09](../archive/2026-11-09/design.md)); section numbers are kept, so references like "design.md §N" still find their place.

## 4. Creatures

- ✅ 35 scannable species (`CREATURE_TEMPLATES`, lib/creatures/creatureData.ts and rosterV2.ts):
  7 races × one of each rarity. Each has a rarity, a main **style** (`cls`: melee / ranged / magic),
  an **archetype** (which style kits it draws from, §6) and **one or two races** (Undead, Divine,
  Beast, Underkin, Geo, Humanoid, Toxic). Plus Klutz (no race) and the boss parts. (The 7 species retired before V2 were removed
  on 2026-11-04: no save from after the fresh start can hold one.)
- ✅ **Individual rolls:** each creature's %s are the species' values with a small zero-sum spread
  (`ROLL_SPREAD_*` in creatureRoll.ts). Rarer creatures get bigger spreads. 4 move slots: it's
  born with its 3 starting moves (§6), and a 10% chance (`RARE_MOVE_CHANCE`) of a rare learnable
  move of its style in the empty fourth (the user, 2026-10-26: never in place of a starting move).
- ✅ **Cards:** a card shows one specific rolled creature. Summon with 3 cards of a species
  (`CARDS_TO_SUMMON`): **choose** a card to get exactly that creature, or **random** for a fresh
  roll. The summoning plays out (the user, 2026-11-02; components/SummonShow.tsx): the 3 cards are
  set on the Soul Altar, whirl up into a whirlwind that climbs the rarity colours like a Code Cache
  (`summonStages`, lib/scanReveal.ts) to the creature's, then burst into it. Tap to skip.
- ✅ **Cage:** holds 1 creature (`CAGE_SIZE`; upgrades later). A new game's first creature waits in
  the cage (`starterCreature`, Lv 3). Releasing a creature gives nothing. A captured creature joins
  your creatures (the starter is also the first free pick at the Labyrinth's entrance).
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
- ✅ **After a won fight** (the user, 2026-11-09; components/FightWon.tsx, `xpShown`): a Victory
  window shows each creature's XP counting up from what it had to what it has now ("120 / 300
  XP"), its level bar filling with it and on through each level it gains, then **Loot** (opens what they dropped) or **Leave** (it stays on the floor to open later; a
  fight with nothing to loot, the thief's, has just Carry on). Level-up shows follow it. Not
  when a win ends the run at the top (classic): the haul screen shows it, as before.
- ✅ **Explorer level** (you, `save.player`) gets every fight's full XP and gates scan rarity
  (section 2).
- ✅ **Tattered XP Scroll:** a flat 400 XP (`SCROLL_XP`, about Lv 1 → 5). Read from the creature
  window; works on Klutz.
  - 🧪 Drop rates: mini-boss chests 25%, boss chests 50%, 20% of merchants at 200 gold. The 25% and
    50% are Claude's numbers.
- ✅ Enemy levels come in bands by depth (`DUNGEONS[d].levels`). Cyclops Lv 6, Hydra Lv 16, Warden Lv 25 (the Abyss).
- ❓ Cards still show level-15 %s; Pit fights give no XP.
