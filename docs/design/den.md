# The Den and economy

Authoritative for the Den, save slots, the tavern questline, visitors, the pits, the collector and daily quests. Part of the [game design index](../design.md); status tags (✅ 📌 🧪 ❓ ⏸ ✗) are explained in [docs/README.md](../README.md#status-tags). **The code is the truth for numbers:** if this file and a constant disagree, trust the code and fix this file.

Moved here word for word from design.md on 2026-11-09 (the original is in [archive/2026-11-09](../archive/2026-11-09/design.md)); section numbers are kept, so references like "design.md §N" still find their place.

## 9. The Den and economy

- ✅ Places: Soul Altar (scanning), Labyrinth archway, quest board, Bestiary lectern, cage, pool,
  Fight Pit, chest (Inventory), crates, bookcase (codexes; 10, or 20 upgraded), bindle/bag, merchant
  stall, and a boarded-up Tavern.
- ✅ **The Den's top bar** (the user, 2026-11-14): your explorer level as an XP bar, `Lv 3 [45 / 180] Lv 4`
  (MAX at Lv 30), where the title "Codex Creatures" was; then gold, creatures and items found, and ⚙️.
- 📌 **Tavern:** where travellers, merchants and librarians gather. Now reached through the
  questline below (the earlier "built with 300 gold after the Cyclops" is replaced by it). ✅ Its
  outside, repair, visitors and pits are built (the questline below); 📌 its interior is not.
- 📌 Wandering merchants and weapon dealers as gold sinks. The user will design gold sinks.
- ✅ **Save slots and the title screen** (2026-10-20, `app/start`, lib/saveSlots.ts): opening the
  game shows Continue / New Game / Load file; up to 4 named saves per browser (no real login: the
  user chose this over online accounts). The game saves itself on every change. The slot in play
  lives in the usual keys; the others are parked as save files.
- ✅ Sell prices **stay as they are** (the user, 2026-10-20), even though they (epic ~800,
  legendary ~2,700) dwarf Labyrinth gold (~18 a room) and re-scan gold has no cap.

### The tavern questline (the user's spec, 2026-10-20; ✅ stages 1–9 built, lib/tavern.ts)

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
   wanted poster.** The ❗ for a visitor is over the visitor (and the Den's doorway), not the tavern.
5. ✅ **Repair:** 5 metal bars, 20 planks, 5 nails. It shows have/need, is blocked if you're short,
   takes the materials exactly once, and swaps in the restored look.
6. ✗ **Bounty** (replaced by the campaign, the user, 2026-11-16): the Cyclops bounty on the quest
   board (take it, beat the Cyclops, hand in the head, paid the bookcase schematic) is gone; the
   campaign's "Beat the Cyclops" step (an enchanted Epic weapon) takes its place. Old saves keep what
   it paid (`bounty`, `mounted` stay in the tavern field; `hasBookPlans`).
7. ✅ **Cyclops Head:** a unique trophy, the decided Cyclops trophy, showing the run you first won on
   (`meta.firstClearRun`). Since the bounty went (2026-11-16) it goes up over the tavern door by
   itself once the tavern's repaired and you've beaten the Cyclops (`headUp`; Claude's reading, as
   the head was the bounty's). It isn't an item, so it can't be sold, used, lost or doubled
   (placeholder: the Cyclops sprite on a plaque marked with the run).
8. ✅ **Bookcase upgrade:** the existing Crooked Bookcase schematic, but the tavern is now the
   **only** way to get it (since 2026-11-16 the campaign's reward for blowing open the rubble: found
   in the broken tavern, `bookPlans`): it no longer drops from mini bosses, the Cyclops or storehouses. It costs
   10 planks and 5 nails, is built separately, holds **20** codexes, and uses the user's upgraded
   bookcase art (`den/bookcase-2.png`). (It was 20 planks + 10 nails for 25.) A save that already
   built it keeps its 25 slots, and schematics already in a save stay buildable (now 20 slots).
   In the Den the shelf swaps to the upgraded art once it's built.
9. **Visitors** (after the repair). ⚠️ The per-run roll below was replaced on 2026-11-16 by visitors on the clock (decision 47, the 📌 block at the end of this item, now ✅); it's kept as the record of what came before. On returning home from each run, roll a merchant (12%), a
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
   and 3 essence crystals**, once: **100 XP an hour** (`TRAINING_XP_PER_HOUR`; 🧪 the user's pick: Lv
   10→11 about 3.5h, Lv 20→21 about 8h, Lv 29→30 about 13h). Whoever's training keeps what they earned
   at the sparring rate. Saved in the tavern field (`plans`, `pit`, `training`, and `trainedXp`: the
   pit's **lifetime XP**, everything banked out of it, `logTrained`). Its window (`/training`, tapped in the
   room: taps there look past the Den's canvas for the pit) shows the pit's picture, its rate, the lifetime XP
   (plus what's training now), the creature in it, and with the plans, the schematic: the Training Pit's
   picture beside a column of material icons with have/need, "50 → 100 XP/h" and Build.
   ✅ **Sending for one** (the user, 2026-11-03; `summonVisitor`, `SUMMON_PRICE`): at the repaired tavern, pay 500 gold for any visitor now, for 30 minutes (`SUMMON_STAY`; it was `VISITOR_STAY` runs before the clock), in place of one of the same kind who's in (a new one, new stock); the others stay. Two taps (the second pays). The tavern librarian's codexes are an inventory (components/LibrarianShelf.tsx): tap one to see its move in the box on top, and buy it there. The Labyrinth's librarian has the same shelf (your bag's room in place of the bookcase's).
   ✅ **The creature collector** (the user, 2026-11-03; `lib/collector.ts`): a third visitor, dealing only in creatures (never cards). He buys a creature for `COLLECTOR_PRICES`: Common 50, Uncommon 100, Rare 250, Epic 600, Legendary 1,500 (🧪 Claude's proposal, the user's pick). Or he trades 3 creatures of one rarity, any species (`TRADE_UP_COUNT`), for a card of a random species one rarity up, freshly rolled; Legendaries can't be traded up. Not a creature in a team, in the pit or out on a run; a sold or traded creature's gear comes off and stays yours. His window: Sell / Trade up, a tab per rarity, tap creatures to pick them, then the button (Sell takes two taps). His art (the user's pick of 3 samples, 2026-11-03): a hooded figure in a cloak pinned with creature cards, holding up a glowing jar, with a walk cycle like the others (`npcs/collector.png`).
   ✅ **The Enchantress, visitors on the clock, and tavern upgrades** (the user, 2026-11-16, decision 47; built 2026-11-16; replaces the per-run roll above):
   - ✅ **The Enchantress**, a fourth visitor (built 2026-11-16, `lib/enchantress.ts`): she doesn't play; she rerolls an item's enchantment
     ([items.md](items.md) §3, Enchantments) for 1 essence crystal plus 1,000 / 2,000 / 5,000 gold by
     the item's rarity (Rare / Epic / Legendary). Can be sent for, as the others. Art: PixelLab
     samples for the user to pick; ✅ her own art since 2026-11-16 (`ENCHANTRESS`, npcs/enchantress.png and its walk: smaller than the other visitors, a hunched old woman with a lantern; the walk to be redone with the Den). Her window is like the collector's:
     your enchanted weapons and armour in tabs (worn ones too), tap one to see it, then Reroll
     (two taps; the second pays). On the clock like the others (5% a half hour to start). Claude's reading, agreed by the user: she rerolls only an item that has an
     enchantment (she doesn't add one), always to a different one, each that fits as likely.
   - ✅ **On the clock** (`onTheClock`, lib/tavern.ts): every 30 minutes of real time each visitor rolls on their own chance, so
     several can be in at once; one who comes stays that 30-minute window (a sent-for one 30 minutes
     too). Fixed per window (reloading doesn't reroll); windows missed while away are gone. No more
     roll after runs, and no pity rule.
   - ✅ As built: the windows are fixed half hours of the clock (`VISITOR_WINDOW`, counted from 1970, so
     every device agrees); each roll is seeded from the tavern's own seed (`seed`, made the first time
     it's needed and saved) plus the window's number and the visitor, and `rolled` records the last
     window rolled. The tavern's window shows who's in on one line. Several in at once each walk the
     room's stroll, spread evenly round it (`strollLoop`), each with their own ❗ and name, and a tap
     opens their own window (`/visitor?v=…`). The game checks the clock every 30 seconds while a page
     is open (`TAVERN_TICK_MS`). Saves: `guests` (one per visitor: until when, or runs left, and their
     stock), `seed`, `rolled` and `upgrades` are new optional fields; an old save's one visitor
     becomes a guest staying the runs they had left (`fromOldSave`), counted down on coming home
     (`comeHome` no longer rolls). Claude's readings (agreed by the user, 2026-11-16; the costs stay testing numbers):
     - A visitor already in (sent for, say) whose roll comes up in the next window stays to that
       window's end, keeping their stock and what you've bought. A visitor from an old save isn't
       rolled until they've gone.
     - The daily quest's merchant comes as if sent for: 30 minutes.
     - 🧪 The upgrade costs (`UPGRADE_COSTS`, a row per level): 6/8/10/12/14/16/16/14/12/12 planks,
       3/4/5/5/6/6/6/5/3/2 nails, metal bars from level 3 (2, 4, 6, 8, 10, 14, 18, 23), stone from
       level 6 (1, 2, 4, 7, 12) and an essence crystal at levels 9 and 10: the totals above, each level
       dearer than the last at the merchant's prices. An upgrade takes two taps (the second pays).
   - **Odds start at 5% each** (merchant, librarian, collector, Enchantress) and the tavern upgrades
     them: tapping the tavern shows sending for a visitor and the upgrades, a row per visitor,
     +1% a level, 10 levels (15% at most), paid in materials, dearer each level. 🧪 Testing cost
     (the user's pick of the slowest pace, 2026-11-16): about 120 planks, 45 nails, 85 metal bars,
     26 stone and 2 essence crystals per visitor, planks and nails first, metal bars, then stone and
     essence at the top. Claude's sim (2026-11-16, full clears): a Cyclops run gives about 4
     planks, 3.4 nails, 1 metal bar, 0.25 stone, 0.05 essence (the Deep and the Abyss about half as
     much again); Klutz, sent out 3 times a day, about 1.5 metal bars and 0.4 stone a day; so an
     active player maxes one visitor in about 3–4 weeks.

### Daily quests (✅ the user, 2026-11-02; lib/daily.ts)

On the quest board's Quests tab, above the Hydra quest. **Two a day, a primary and a
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

### The campaign (✅ the user, 2026-11-16; lib/campaign.ts)

Quests that aren't daily and lead through the game, on the quest board's **📖 Campaign** tab
(`/board`, beside Quests and Boards), once Klutz's first quest is done. **Five chapters**, each
leading up to a dungeon's boss (the Encampment, the Cyclops, the Hydra, the Abyss), then **Legend**,
a long last one. The user listed the quests and the kinds of reward; Claude set the order and the
numbers from a model of a normal player's progress (below). All 🧪 testing numbers.

- **Progress counts all along; rewards are claimed in order.** A quest done early shows ☑️ "Done:
  claim the ones above first". Most quests read the save as it is (levels, gold, gear worn, bosses
  beaten, the tavern), so an old save opens with most done. The rest count events from the day it
  came in (`tally`): fights won in a dungeon, new barcodes, cards got, Klutz sent, buys from a
  merchant (in the Labyrinth or the tavern), camp cages opened (the Encampment's and the large rooms'),
  golden chests opened, fights won with only effective hits, levels from the Sparring Pit, summons by
  rarity, gear Klutz brings home by rarity, each visitor seen at the tavern, and a boss beaten on a
  run with no potion drunk (`drank`: the run, `meta.runs`, a potion was last drunk on). Scans
  and cards take the larger of the save's count and the tally.
- **The screen:** the chapter's name and how many are claimed, then a row per quest (fixed: the task
  on one line, the reward and progress on the next) with one 44px button: 🎁 Claim on the next
  reward when it's done, ➜ to the screen where an unfinished quest is done. A ❗ on the board in the
  Den while the next reward is ready. Claiming opens crates and gear in the Code Cache window.
  A reward with no room (chest boxes, the bookcase for codexes) waits ("No room for it").
- **Rewards** (the user): gold for the small ones, Tattered XP Scrolls for some, better things at
  milestones; **crates** opened as you claim them (Materials, Gear, Codex: a number of things in a
  rarity band; gear gets a chest's 10% enchantment chance; Supplies: 2 Lesser Potions, a Healing
  Potion, a Revival Elixir and a torch). ✅ (the user, 2026-11-16) The gear one is the **Gear Barrel**
  and the codex one the **Codex Bookcase**; each container is shown in 3D first (components/RewardReveal.tsx:
  the crate, the barrel or the game's bookcase on the dungeon floor by torchlight; tap it, a crate's lid
  swings open or the barrel or bookcase hops), then its loot window (`rewardModel`). Fixing up the tavern pays a **Gold Key**; the Cyclops a
  random **enchanted Epic weapon**; the rubble the **Crooked Bookcase Schematic** (500 gold instead
  if you have the plans or the bookcase already, `PLANS_TAKEN_GOLD`).
- Claude's readings (2026-11-16, not asked): "upgrade your inventory slot" is a bigger bag (the
  backpack, or a slot bought); "camp cages" are any cages in an encampment; "beat X level without
  potions" is a dungeon's boss beaten on a run with no potion drunk (Revival Elixirs don't count);
  "identify creatures in the Bestiary" counts every creature in it (seen, owned or carded);
  summons are exact (the user, 2026-11-16: a Common, then an Uncommon, a Rare, an Epic, a Legendary); "level every one of Klutz's skills" is each of
  his four skills at level 1 or more; "Klutz's explorations" count his weapons and armour.

| Chapter | Quests, in order (reward) |
|---|---|
| 1 The Encampment | Scan 3 (50g) · 3 in the Bestiary (50g) · Send Klutz hunting (scroll) · A creature fully kitted (100g) · Win 5 fights (100g) · Collect 3 cards (100g) · A creature Lv 5 (scroll) · **Beat the Encampment** (Gear Crate, Uncommon–Rare ×3) |
| 2 The Cyclops | Calibrate the scanner (150g) · Explorer Lv 5 (scroll) · Learn a codex move (150g) · Buy from a merchant (150g) · Summon a Common (Supplies) · Open 3 camp cages (200g) · A Rare+ weapon on (250g) · Klutz brings home Rare+ gear (scroll) · Win 25 fights (scroll) · A set bonus (250g) · 1,000 gold saved (Materials, Common–Uncommon) · The Encampment without a potion (300g) · Blow open the rubble (bookcase schematic) · **Beat the Cyclops** (enchanted Epic weapon) |
| 3 The Hydra | Klutz Lv 5 (scroll) · A creature Lv 10 (Materials, Uncommon–Rare) · An enchanted weapon on (300g) · Every Klutz skill levelled (300g) · Fix up the tavern (Gold Key) · A win with only effective moves (400g) · Summon an Uncommon (Supplies) · Scan 50 (500g) · 15 in the Bestiary (scroll) · A bigger bag (500g) · 3 Sparring Pit levels (2 scrolls) · Klutz brings home Epic+ gear (Materials, Rare–Epic) · An Epic+ item on (500g) · Win 100 fights (Codex Crate, Uncommon–Rare ×2) · Open a golden chest (Gear, Rare–Epic) · 5,000 gold (2 scrolls) · The Cyclops without a potion (1,000g) · A creature Lv 15 (Gear, Rare–Epic) · **Beat the Hydra** (enchanted Epic armour) |
| 4 The Abyss | An enchanted armour piece on (1,000g) · Klutz Lv 10 (Materials, Rare–Epic) · Every visitor calls (2 scrolls) · Summon a Rare (Supplies) · Build 3 schematics (Materials, Rare–Epic) · Explorer Lv 20 (2,000g) · 10 Sparring Pit levels (3 scrolls) · A creature Lv 20 (Gear, Epic) · 15,000 gold (3 scrolls) · Win 250 fights (Codex, Rare–Epic ×2) · The Hydra without a potion (Gear, Epic) · **Beat the Abyss** (enchanted Legendary weapon) |
| 5 Legend | A creature Lv 25 · Klutz Lv 15 · Summon an Epic · Klutz brings home Legendary gear · A Legendary item on · Scan 250 · 35 in the Bestiary (all) · Explorer Lv 30 · 50,000 gold · The Abyss without a potion · A creature Lv 30 · Klutz Lv 20 · Summon a Legendary · Klutz Lv 25 · Klutz Lv 30 (crates Epic–Legendary, scrolls, enchanted Legendary gear) |

**The pacing model** (Claude, 2026-11-16; scripts not kept). Explorer XP is every fight's XP; a
creature Lv 5 / 10 / 15 / 20 / 25 / 30 needs 399 / 1,567 / 3,654 / 6,847 / 11,334 / 17,302 XP, an
explorer 640 / 2,340 / 5,040 / 8,740 / 13,440 / 19,140. A won run gives about 190 XP (the
Encampment), 620 (the Cyclops), 1,760 (the Hydra) and 4,100 (the Abyss), shared by the team. Klutz,
simulated with the real trip code (40 players, ungeared, points spread evenly, no scrolls, going
deeper as bosses fall): Lv 2 on trip 3, **Lv 5 on trip ~18, Lv 10 on trip ~70, Lv 15 in only a
quarter of players by trip 140, Lv 20 never by trip 150**; his first Rare gear on trip ~7, Epic ~35,
Legendary ~120 (half of players by trip 150). So Klutz Lv 5 opens chapter 3, Lv 10 chapter 4, and
Lv 15–30 wait in Legend (scrolls and gear make him faster; Lv 20+ is meant to be a very long goal).
Slow quests sit late in a chapter or early in the next, so none holds a boss's reward up for long.
