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

### Materials, consumables, bags

- ✅ **Materials** (planks, nails, metal bars, stone, essence stones: lib/items/materials.ts) are a tally at
  home, like gold. In the Labyrinth a material find is a stack that takes one bag slot and joins
  the tally when you get home.
  ✅ **Stone and essence stones** (the user, 2026-11-03): **Stone** (rare, 🪨 until PixelLab art)
  took the old rare essence stone's place everywhere: material finds, the merchants (Labyrinth
  150, tavern 300) and the storage schematics. It keeps the save key `essence_stones`, so stones
  already in a save are Stone now. **Essence stones** are a new **epic** material (`essence`, the
  old gem art): 1 in an Epic material find and 1–2 in a Legendary one (each a third of those
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
  ✅ **Storage schematics** (2026-10-25): the merchant's Weapon and Armour Storage Schematics
  (`weapon_storage`, `armor_storage`) build that box up to 75 (`BIG_BOX_CAP`; consumables stay at
  50). Built from the Inventory (a panel above the list) for 10 planks, 10 nails, 1 stone.
  The save remembers which boxes are built (`storage`, optional, default none).
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
- ✅ **Schematics:** the Crooked Bookcase (epic drop: 20 planks + 10 nails) raises the bookcase from
  10 to 25 codexes. 📌 Changing (the user, 2026-10-20): it will come only from the tavern
  questline (§9), for 10 planks + 5 nails, holding 20.
- ✅ **Throwing out codexes** (2026-10-25): tap a codex on the bookcase, then Throw out and Yes. It
  is gone for good (no gold), to free the shelf without having to teach it.
- 📌 More schematics and furniture later, e.g. a fireplace in the Den for faster healing.
- ❓ A 10-item battle bag and bags for Klutz have been mentioned, but neither is designed.
