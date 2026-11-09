# The Den and economy

Authoritative for the Den, save slots, the tavern questline, visitors, the pits, the collector and daily quests. Part of the [game design index](../design.md); status tags (✅ 📌 🧪 ❓ ⏸ ✗) are explained in [docs/README.md](../README.md#status-tags). **The code is the truth for numbers:** if this file and a constant disagree, trust the code and fix this file.

Moved here word for word from design.md on 2026-11-09 (the original is in [archive/2026-11-09](../archive/2026-11-09/design.md)); section numbers are kept, so references like "design.md §N" still find their place.

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
   corner and the merchant (the user's sketch: [ideas/den-second-room.png](../ideas/den-second-room.png)).
   Using the dynamite on it (once) blows it open (a flash and a shake) into a passage to a second
   room. **Until then you can't see or pan over the second room at all.** It isn't a general
   destructible-walls system.
   ✅ **The room strip:** the Den and the tavern's room sit side by side in one view you drag across
   (`DenRoom`'s `annex`); the tavern's room lies straight behind the Den's right wall, through a
   see-through doorway and a wall one floor unit thick (`PASS`, lib/den/scene.ts). Each room is its
   own picture, built only once open, so later rooms don't slow the others (watch phone
   performance). The tavern's room is the Den's cave with nothing in it (`createDen({ bare })`), with
   the tavern, head and visitor standing in it (`components/TavernRoom.tsx`). Tapping the tavern opens
   `/tavern` (the repair, sending for a visitor); tapping the visitor opens their wares (`/visitor`,
   the user, 2026-11-06); the pit and the portal open their own windows; the bare floor does nothing.
   The view is remembered for the visit (the user, 2026-11-06): coming back from any place opens it
   where you left it, in either room. Meant to grow into more rooms.
   📌 Still to come: mounted head art, and the tavern's interior (needs design). The user's
   [ideas/future-dungeon-direction.png](../ideas/future-dungeon-direction.png) is the likely long-term
   look for the base.
   🧪 Testing tools at the altar: "🧨 Open the rubble" (`forceOpen`) and "🍺 Call a visitor"
   (`callVisitor`).
4. ✅ **The tavern (outside only for now)** stands broken in that room, a building against its far
   wall (the sketch). The first time you see it, Klutz reacts once (it needs materials). Art:
   PixelLab, at the room's angle (§11); greyed until repaired. ✅ (the user, 2026-10-20) **No
   wanted poster.** ✅ (the user, 2026-11-02) The bounty lives on the **quest board's Quests tab**
   (`/board`), not in the tavern: a ❗ on the board in the Den while it has a step for you (the
   bounty to take, or the head to hand in: `bountyHasStep`). The ❗ for a visitor is over the visitor (and the Den's doorway), not the tavern.
5. ✅ **Repair:** 5 metal bars, 20 planks, 5 nails. It shows have/need, is blocked if you're short,
   takes the materials exactly once, and swaps in the restored look.
6. ✅ **Bounty:** repairing the tavern puts the Cyclops bounty up on the quest board
   (`bountyStep`: offer, hunt, head, paid). Cyclops combat is unchanged. 🧪 A "Take the bounty"
   button; with a win already on record (`meta.clears`), the head is ready to hand in straight away.
7. ✅ **Cyclops Head:** a unique trophy, given once, that can't be sold, used or duplicated. It is
   the decided Cyclops trophy, showing the run you first won on (`meta.firstClearRun`). Handing it
   in at the board (once) mounts it on the tavern wall, completes the bounty and unlocks the bookcase schematic.
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
   librarian (8%), the creature collector (8%) or nobody. A visitor stays about 2 runs. The first roll after the repair is
   guaranteed, and so is one after 3 misses. They reuse the Labyrinth's merchant and librarian. 🧪 Built 2026-10-20 (`lib/tavern.ts` `comeHome`, `VISITOR_ODDS`/`VISITOR_STAY`/`VISITOR_PITY`). A sure visit is still one of them, at 12:8:8. The roll happens whenever a run ends (won, lost or retreated). While a visitor's in, a ❗ shows at the Den's doorway and over their head (their name: tap them to trade), and they stroll round the tavern's room with a walk cycle, as Klutz does round the Den (`VISITOR_PATH` in lib/den/scene.ts; walks: PixMiniMax, 2026-11-03). They bring the Labyrinth stock: a merchant's cart, or a librarian's 3 race codexes. You buy one of each, and it goes straight home: potions and XP scrolls to the Inventory, materials to the tally, codexes to the bookcase (needs room). Flares and clairvoyance scrolls go to the Inventory's consumables too, and the bag page packs them (and stores them back). One not used on a run comes home to the Inventory too. ✅ The tavern merchant buys (2026-10-20, `tavernSellables`/`materialOffer`): anything in the Inventory he'd take in the Labyrinth, at the same prices (`merchantOffer`), except what's worn, packed or favourited; materials one at a time. Tap twice to sell.
   (The creature trader is left out for now.)
   ✅ **The Sparring Pit and the Training Pit** (the user, 2026-11-03; lib/trainingPit.ts, `/training`).
   The **Sparring Pit**, a bed of tan sand in a ring of grey stones, with a straw dummy (`den/sparring-pit-3.png`), is yours as
   soon as the rubble's blown open, in the tavern room's back corner against the right-hand wall,
   clear of the tavern, drawn 1.9× (`PIT_SCALE`, the Training Pit too). One creature at a time trains in it, in real time
   (**50 XP an hour**, `SPARRING_XP_PER_HOUR`), and stops with its bar full until you tap **Level
   up** (one level, then it trains on from empty), so it never gains more than a level while
   you're away: a ❗ on the pit in the room says it's ready. While it's in, it's away training:
   it can't fight: where you pick a team (the Labyrinth's entrance, a duel, PvP teams) it shows
   greyed, "🏋️ In the pit" (the user, 2026-11-04), and other fight lists leave it out. Take it out any time with the XP
   it's earned (a full bar levels it up). An XP scroll read on it banks what it's earned first.
   **Slay the Hydra**, a quest on the board's Quests tab, goes up once you've beaten the Cyclops;
   beat the Hydra and claim its reward there, the **Training Pit Schematic** (not an item: the pit
   just offers to build). It builds the **Training Pit** over the Sparring Pit (a stone rim ringed with
   spears, `den/training-pit.png`, the same grid) for **10 stone, 10 metal bars, 5 planks, 5 nails
   and 3 essence stones**, once: **100 XP an hour** (`TRAINING_XP_PER_HOUR`; 🧪 the user's pick: Lv
   10→11 about 3.5h, Lv 20→21 about 8h, Lv 29→30 about 13h). Whoever's training keeps what they earned
   at the sparring rate. Saved in the tavern field (`plans`, `pit`, `training`, and `trainedXp`: the
   pit's **lifetime XP**, everything banked out of it, `logTrained`). Its window (`/training`, tapped in the
   room: taps there look past the Den's canvas for the pit) shows the pit's picture, its rate, the lifetime XP
   (plus what's training now), the creature in it, and with the plans, the schematic: the Training Pit's
   picture beside a column of material icons with have/need, "50 → 100 XP/h" and Build.
   ✅ **Sending for one** (the user, 2026-11-03; `summonVisitor`, `SUMMON_PRICE`): at the repaired tavern, pay 500 gold for a merchant, a librarian or the collector now, for `VISITOR_STAY` runs, in place of whoever's in (one of the same kind too: a new one, new stock). Two taps (the second pays). The tavern librarian's codexes are an inventory (components/LibrarianShelf.tsx): tap one to see its move in the box on top, and buy it there. The Labyrinth's librarian has the same shelf (your bag's room in place of the bookcase's).
   ✅ **The creature collector** (the user, 2026-11-03; `lib/collector.ts`): a third visitor, dealing only in creatures (never cards). He buys a creature for `COLLECTOR_PRICES`: Common 50, Uncommon 100, Rare 250, Epic 600, Legendary 1,500 (🧪 Claude's proposal, the user's pick). Or he trades 3 creatures of one rarity, any species (`TRADE_UP_COUNT`), for a card of a random species one rarity up, freshly rolled; Legendaries can't be traded up. Not a creature in a team, in the pit or out on a run; a sold or traded creature's gear comes off and stays yours. His window: Sell / Trade up, a tab per rarity, tap creatures to pick them, then the button (Sell takes two taps). His art (the user's pick of 3 samples, 2026-11-03): a hooded figure in a cloak pinned with creature cards, holding up a glowing jar, with a walk cycle like the others (`npcs/collector.png`).

### Daily quests (✅ the user, 2026-11-02; lib/daily.ts)

On the quest board's Quests tab, above the Cyclops bounty. **Two a day, a primary and a
secondary, the same for everyone** (picked from the date), new at **local midnight**. Only what you
do that day counts; finish one, then claim its reward once. A ❗ on the board in the Den while one's
ready to claim. Plays offline. ✅ (the user, 2026-11-06) Coming into the Den, a small popup lists
today's quests not yet claimed, with their rewards and progress (`openQuests`,
components/DailyPopup.tsx): once a day per visit to the site, so again at midnight's new quests;
not during Klutz's tour or before your first creature. A tap anywhere closes it.

**A boss you've never beaten steps down** (the user: the Hydra to the Cyclops or Encampment):
the Abyss to the Hydra, the Hydra to the Cyclops, the Cyclops to the Encampment, until it's one
you've beaten before. You get the easier quest's reward. 🧪 The Abyss and Cyclops steps follow the
same rule (Claude's reading). Which quests you got is fixed the first time they're seen that day.

| Primary | Reward |
|---|---|
| Beat the Cyclops | a box of 5 pieces of gear, Rare or better |
| Beat the Encampment twice | a creature, Rare at most |
| Beat the Hydra | 3 Rare or Epic weapons or armour |
| Beat the Abyss | an Epic weapon or armour piece |

| Secondary | Reward |
|---|---|
| Scan 5 new barcodes | 500 gold |
| Sell 300 gold's worth of items | the travelling merchant calls at the tavern |
| Win 5 fights in a dungeon | an XP scroll |
| Send Klutz out hunting | a bundle of one material |
| Clear 10 rooms in a dungeon | a Revival Elixir |
| Beat a mini boss | a codex, its rarity rolled |
| Summon a creature from 3 cards | 250 gold |
| Win a duel with a friend | 100 gold |
| Find a creature you've never owned | a Code Cache (at the altar) |

🧪 Claude's readings, not asked: "5 item scans" counts new barcodes (a Code Cache, sealed or not;
a rescan's gold doesn't). Rarities are rolled at the usual odds (`RARITY_WEIGHTS`) and then held
to the limits (`rollRarity`), so the box is mostly Rare; a weapon a third of the time. The
material bundle is a scan's (`materialBundle`, its rarity rolled); the codex is what a scan of the
rolled rarity gives (Epic and up: a race codex); the Code Cache is a fresh scan roll. Sales count
at home (Inventory, altar, crate, tavern, materials) and to the Labyrinth's merchant. Fights count
in any dungeon; rooms are each run's finished rooms, counted as it ends; a mini boss includes a
guarded storehouse but not the Encampment's chief. A duel counts only when won in battle. Klutz
steps down to the fights quest until he hunts for you, and duels do in a copy without online.
The merchant replaces whoever's at the tavern for 2 runs, and can't be claimed until the
tavern's repaired (progress still counts). A reward with no room (chest boxes, the bookcase for a
codex, the altar for a Code Cache) waits until there is.
