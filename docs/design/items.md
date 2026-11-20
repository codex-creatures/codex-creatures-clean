# Items

Authoritative for stat rolling, gear, materials, consumables, bags and schematics. Part of the [game design index](../design.md); status tags (✅ 📌 🧪 ❓ ⏸ ✗) are explained in [docs/README.md](../README.md#status-tags). **The code is the truth for numbers:** if this file and a constant disagree, trust the code and fix this file.

Moved here word for word from design.md on 2026-11-09 (the original is in [archive/2026-11-09](../archive/2026-11-09/design.md)); section numbers are kept, so references like "design.md §N" still find their place.

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

### Enchantments (✅ the user, 2026-11-16, decision 46; built 2026-11-16, lib/items/enchantments.ts)

Marginal edges, never game-breaking. Some are meant for the Labyrinth (PvE), some for PvP, but
✅ (the user, 2026-11-16, after the first build) **they all work in every fight**: one with nothing
to do there (Bounty in a duel, with no gold) just does nothing.

- **Which items:** Rare, Epic and Legendary weapons and armour; one enchantment an item. Rolled
  apart from the stat budget, so the roller above doesn't change. Numbers below are
  Rare / Epic / Legendary.
- **Where from:** scans 25%; Labyrinth chests 10% (✅ the user, 2026-11-16: any chest in a run that
  already holds weapons or armour: chest rooms, stashes, boss chests, storehouses); golden chests always (all 5 finds); campaign
  rewards to be decided with the campaign (roadmap). Never from foes (they don't wear them; they
  keep their soul stones), merchants, Klutz or daily quests.
- **Weapons, PvE:** Bounty (+10/15/20% gold from fights it's in; ✅ the user, 2026-11-16: only a
  fight's own gold, never a chest's, and only if its wielder dealt damage), Scholar's (+10/15/20% XP for its
  wielder), Bossbane (+4/6/8% damage to bosses), Leeching (heals 3/4/5% of the damage it deals).
- **Weapons, PvP:** Keen (precise chance 6/8/10%, from 5%), Piercing (ignores 6/8/10% of the
  target's defence), Vampiric (heals 2/3/5% of the damage it deals).
- **Armour, PvE and PvP:**
  - A stat on top of the budget, +5/10/20, agility in full: Ironbound (melee defence), Shielded
    (ranged defence), Runed (magic defence), Stalwart (HP), Fleet (agility). Kept to stats so the
    full-set bonuses stay armour's only effects.
  - Cleansing: 2/3/5% a piece, rolled at the end of each round, to remove the most recent
    negative effect on the creature (lowered stats, poison, bleed, cripple…). Pieces add up.
  - Victorious: heals 2/3/5% of max HP a piece when the creature knocks out an opponent. Pieces
    add up. ✅ (the user, 2026-11-16) It heals whenever a foe falls while the creature is on the
    field, whatever felled it (poison, a cloud, a teammate's hit…); not from the bench.
- ✅ **Gear already owned** (the user, 2026-11-16): every Rare or better weapon and armour piece in a
  save (Inventory, chest, worn, the Labyrinth bag and loot, Klutz's crate) got one roll at a
  chest's 10% (`enchantOldGear`, lib/save.ts). Only gear made before `ENCHANT_ROLL_BEFORE`; the roll
  is seeded by the item's id, so it comes out the same on every load and every device.
- ✅ **Selling** (the user, 2026-11-16): an enchanted item sells for 20% more (`ENCHANT_SELL_BONUS`,
  lib/items/economy/sell.ts), wherever it's sold.
- **Rerolling:** only the Enchantress, a tavern visitor ([den.md](den.md) §9): 1 essence crystal
  plus 1,000 / 2,000 / 5,000 gold by the item's rarity.
- **Look:** an enchanted item's picture has a moving shine over it (like Minecraft's), drawn in
  code: no new art. ✅ A purple glint sweeping across, masked to the picture's shape (CSS
  `.enchant-shine`; `shining` in lib/sprites/art.ts gives an enchanted piece's picture its own
  identity, so every place that draws `itemSprite` shows it).
- ✅ **As built:** a drop's optional `enchant` field (missing: none, so old saves load unchanged; no
  new save-file version). The Inventory's item window and the Labyrinth's loot window and found-gear
  window show a line under the item, "✦ name" with its one-line effect behind a "?". Bounty pays
  only the team members who dealt damage with an attack (`dealtDamage`, lib/combat/battle.ts).
  Claude's readings of the spec (the user agreed these, 2026-11-16):
  - 🧪 Scans: the 25% is in the registry's rules (`REGISTRY_RULES.enchant`, so the server's copy
    carries it), but each player rolls their own enchantment when they open the find, like its
    stats; the server's roll is unchanged.
  - 🧪 Every enchantment that fits the item (7 for weapons, 7 for armour) is as likely.
  - 🧪 Bossbane counts the Cyclops and the Hydra (scripted bosses), not mini bosses.
  - Scholar's: the wielder's share of the fight's XP (explorer XP as it was).
  - Leeching and Vampiric heal from each hit's final damage.
  - 🧪 Cleansing: for creatures on the field, after the round's poison and bleeding; "negative
    effects" are what a ward keeps off (cripple, venom, poison, bleed, seal, weaken, soak, fear),
    not the witch's illness; it rolls only when there's one with a round left to run.
  - 🧪 Stat enchantments go on the piece's stats, so defence counts at a third like all armour
    defence (`ARMOR_DEFENCE_WEIGHT`), and HP and agility in full.
- Dropped in the design: Racebane, Draining, Duelist's, Torchlit and Scavenger's (armour that
  helped the adventurer, not the creature).

### Materials, consumables, bags

- ✅ **Materials** (planks, nails, metal bars, stone, essence crystals: lib/items/materials.ts) are a tally at
  home, like gold. In the Labyrinth a material find is a stack that takes one bag slot and joins
  the tally when you get home.
  ✅ **Stone and essence crystals** (the user, 2026-11-03): **Stone** (rare, 🪨 until PixelLab art)
  took the old rare essence crystal's place everywhere: material finds, the merchants (Labyrinth
  150, tavern 300) and the storage schematics. It keeps the save key `essence_stones`, so stones
  already in a save are Stone now. **Essence stones** are a new **epic** material (`essence`;
  ✅ renamed the **Essence crystal**, with its own crystal art, by the user on 2026-11-16): 1 in an Epic material find and 1–2 in a Legendary one (each a third of those
  finds; the rest metal bars or stone), and on 1 merchant's cart in 3: 500 in the Labyrinth,
  1,000 at the tavern, bought back for 250.
- ✅ **Potions** go in the bag. The Chest (Inventory) stores the rest.
- ✅ **Chest boxes** (the user, 2026-10-20, `lib/items/storage.ts`): weapons, armour and consumables each
  hold 50 (`BOX_CAP`). Materials (a tally, shown in a strip by your gold at the top of the
  Inventory) and codexes (their own Inventory tab; the bookcase limits them) don't count. A run's
  haul still comes home into a full box and can go over, but you can't enter the Labyrinth while
  any box is at 50 or more. A scan for a full box is kept as a sealed Code Cache at the altar (even
  in Looting mode), and a cache for a full box won't open until there's room. The altar holds 9
  caches (`CACHE_LIMIT`): with 9 waiting, every scan says "Scan Failed / Code Cache Full".
  ✅ **Storage in stages** (the user, 2026-11-20; it was two schematics, 75 then 100, since 2026-10-25 and
  2026-11-13): the weapon and armour boxes each grow 50 → 60 → 75 → 85 → 100 (`BOX_CAPS`,
  lib/items/storage.ts), a schematic for each stage, found (you have to find it) and dearer each time, the last
  with essence crystals: the Rack (10 planks, 5 nails), Storage (15 planks, 10 nails, 3 metal bars), Iron
  Storage (10 nails, 10 bars, 3 stone) and Reinforced Storage (15 bars, 5 stone, 2 essence crystals)
  Schematics (`weapon_storage_1`, `weapon_storage`, `weapon_storage_3`, `weapon_storage_2`; the armour
  ones the same). Room past 100 is to be bought for real money (📌 not built or designed); consumables stay
  at 50. Built from the Inventory (a panel above the list, components/PlanBuild.tsx); a plan builds its own
  stage, so one held from before can skip a stage. Where they're found: the Den's ladders, below.
  The save counts each box's stages in `storage` (`boxTier`); `storageV` 2 marks a save in stages, and an older
  one's boxes move onto them as it loads (built once, 75, is stage 2; twice, 100, stage 4: `storageFromOld`).
- ✅ **Bags:** you start with a Bindle (3 slots, `BINDLE`). The Rugged Backpack (5, `BACKPACK`) is
  found three ways, until you've got it (the user, 2026-10-20): the first Cyclops's chest; every
  wandering merchant's cart, Labyrinth or tavern, for 1,000 gold (`BACKPACK_PRICE`; it takes one of
  the cart's 10 slots); and 50% of
  storehouses (`STOREHOUSE_BACKPACK`). Gear, codexes, potions, tools and material stacks take a slot; gold and
  creature cards don't. Swapping a weapon from the bag mid-fight uses your turn.
- ✅ **Backpack upgrades** (2026-10-25): +1 slot each from the backpack's 5 up to 10 (`BAG_MAX`), at
  1,000 → 1,500 → 2,000 → 2,500 → 3,000 gold (`BAG_UPGRADE_PRICES`), from the merchant once you own the backpack. It
  works straight away (in the Labyrinth) or from the next run (tavern). Stored as `bagSize`.
- ✅ **Revival Elixir** (2026-10-25, a tool: `revival`): from the bag between rooms, or in a
  fight (the user, 2026-11-02: it takes your turn, on a knocked-out teammate, who can then be
  swapped in), brings a knocked-out creature back with 50% HP (`REVIVE_HP`). One bag slot. 500 gold at
  the merchant (25% of carts); also in 20% of mini-boss chests (`MINIBOSS_REVIVAL`) and 50% of boss
  chests (`BOSS_REVIVAL`).
- ✅ **The bookcase in stages** (the user, 2026-11-20; it stops at 50, as there aren't that many codexes yet):
  the old shelf 5, the crooked bookcase 15 (7 planks, 4 nails, no schematic), the sturdy bookcase 30 (its
  schematic, `crooked_bookcase` by its old key: 25 planks, 15 nails, 5 metal bars) and the carved bookcase 50
  (`carved_bookcase`: 25 planks, 15 nails, 10 bars, 2 stone, 1 essence crystal and 1,000 gold)
  (`BOOKCASE_STAGES`, saved as `shelf`). The campaign's reward for the rubble is the sturdy one's plan.
  A save from before lands on the stage at or above its size: the broken shelf of 10 → crooked (15); 20, 25
  or 30 → sturdy (30) (`shelfFromOld`). (Before: 10, the Crooked Bookcase Schematic to 20, an iron-bound
  build to 30.)
- ✅ **The cage in stages:** 1, the iron cage 3 (the Iron Cage Schematic, 10 metal bars), the reinforced cage 5
  (the user, 2026-11-20: the Reinforced Cage Schematic, 25 metal bars and 2 essence crystals; from the Hydra on,
  or 3,000 gold) (`CAGE_LEVELS`).
- ✅ **The Training Pit's slots:** [den.md](den.md) §9, step 8 (the pits).
- ✅ **The Den's ladders of schematics** (lib/items/plans.ts; the user, 2026-11-20). Each thing's stages are a
  ladder, a schematic a stage. Only the next one you need turns up, and none on a ladder while you're holding one
  of its plans: in chests (a chest room's, a mini boss's, a boss's; none in the Encampment) and on wandering
  merchants' carts (each ladder's plan on 20% of carts, `STORAGE_PLAN_CHANCE`). 🧪 Claude's numbers
  (`PLAN_FINDS`, `PLAN_PRICES`), but the reinforced cage's (the user's):

  | Plan | From | Chest room | Mini boss | Boss | Merchant |
  |---|---|---|---|---|---|
  | Iron Cage | Cyclops | — | 20% | — | not sold |
  | Reinforced Cage | Hydra | — | 20% | 20% | 3,000 |
  | Weapon / Armour Rack (60) | Cyclops | 5% | 10% | — | 1,000 |
  | Weapon / Armour Storage (75) | Cyclops | 3% | 10% | — | 2,000 |
  | Iron Storage (85) | Cyclops | — | 10% | 10% | 3,000 |
  | Reinforced Storage (100) | Hydra | — | 10% | 15% | 4,000 |
  | Sturdy Bookcase (once the crooked one's built) | Cyclops | 5% | 10% | — | 2,000 |
  | Carved Bookcase | Cyclops | — | 10% | 15% | 5,000 |
  | Pit Extension (2 slots; once the Training Pit's built) | Hydra | — | 10% | 20% | 4,000 |
  | Grand Pit (3 slots) | Abyss | — | 10% | 20% | 8,000 |

  ⚠️ The plan (roadmap, 2026-11-20) also had the bookcase's schematics from scans: left out for now, as it
  changes the global registry's rules (`npm run registry:rules` and Supabase). Ask before adding it.
- ✅ **Codex prices** (the user, 2026-11-21, `CODEX_PRICES`): a librarian sells a codex by its rarity:
  Common 100, Uncommon 250, Rare 500, Epic 750 (a race codex counts as Epic), Legendary 2,500 gold. Selling
  one pays half (50 / 125 / 250 / 375 / 1,250).
- ✅ **Selling consumables** (the user, 2026-11-21): potions, XP scrolls and tools sell from the Inventory
  too (Sell mode, or the item's window), for what a merchant pays (`isSellableConsumable`, `findPrice`).
- ✅ **Selling codexes** (the user, 2026-11-12; was throwing out, for no gold, since 2026-10-25): tap a
  codex on the bookcase, then Sell and Yes, for what a merchant pays (`codexSellPrice`: half a
  librarian's price, `MERCHANT_BUYBACK`). It
  counts towards the daily selling quest. Merchants in the Labyrinth and at the tavern pay the same.
- 📌 More schematics and furniture later, e.g. a fireplace in the Den for faster healing.
- ❓ A 10-item battle bag and bags for Klutz have been mentioned, but neither is designed.
