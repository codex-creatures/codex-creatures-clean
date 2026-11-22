# Balance audit, November 2026

Written 2026-11-22 (a read-only session: no game code was changed). **A report, not a spec: nothing
here is decided.** Every fix is an option for the user to pick or drop; the numbers they touch stay
as they are until then. The prompt that asked for it is [prompts/fable-balance-audit.md](prompts/fable-balance-audit.md).

## The short version

One bug to fix first, then eleven balance items, ranked by how much each would hurt a new player's
first 20 hours against how little work the fix is.

| # | What | Bites at | Confidence | Effort |
|---|---|---|---|---|
| 0 | **Bug:** a tap can do nothing against a foe that carries Mega Smash (the AI throws) | Hydra on | High (reproduced) | Tiny |
| 1 | The campaign pays in strict order, so a slow quest holds back every reward after it, the boss's included | Hours 0.5 to 5 | Medium | Small |
| 2 | Gear rarity is the gate, not level, and nothing says so; levels run out by about hour 15 | Hours 4 to 20 | Medium to high | Small to medium |
| 3 | Bleed, poison clouds, venom and Healing Blessing beat every boss | Hours 3 on | High | Small |
| 4 | Deeper dungeons don't pay for their risk: the same boss chest everywhere, flat stash gold, the daily rewards upside down | Hours 5 to 20 | High | Small |
| 5 | Nails and metal bars for the first Den upgrades | Hours 2 to 10 | Medium | Tiny |
| 6 | The Cyclops takes about 18 runs, against a target of 12 to 13 | Hours 1 to 4 | Low to medium | Small |
| 7 | Soul stones: three are strong, three do almost nothing | All along | Medium | Small |
| 8 | Potions are everywhere, so the merchant's are never worth buying | All along | Medium | Tiny |
| 9 | The Training Pit gives a trickle of XP for the scarcest materials | Hours 10 on | High | Tiny |
| 10 | Small things: XP scrolls as late rewards, Vampiric, the Enchantress's price, cards with nowhere to go, moves the AI wastes | Various | Mixed | Tiny each |
| 11 | The Abyss: 1 clear in 63 real runs | Past hour 13 | Low | Unknown |

The gold economy itself came out healthier than expected: see [Gold, hour by hour](#gold-hour-by-hour).
Selling loot is the bigger half of a run's takings, and there's no reason to take it away.

If the sessions were mine to order: 0 (minutes), then 1 with its option 3 or 1, then 3 with its
option 1, then 4 (its options 1 and 4 together), then 2's option 1, and decide on the XP curve
once run history is in.

## The user's replies (2026-11-23)

Read these before acting on an item: they overrule what's written under it.

- **Item 1 is intended.** Rewards wait in order on purpose: a quest in the way makes the other parts
  of the game worth doing, because finishing it unlocks what's behind it. Not to be changed.
- **Item 6 is fine as it is.** The user beat the Cyclops in 8 runs; a new player taking longer is
  expected.
- **Item 5:** the iron cage is meant to be a big upgrade (it's what lets Klutz bring creatures
  home), so its price stays unless the user says otherwise. A fairer reading of Player D than the
  one below: they had also spent 5 metal bars repairing the tavern and their nails on tavern
  upgrades, so they'd found at least 8 bars in 24 runs.
- **Item 0 is fixed** (2026-11-23), with a test, and the battle screen falls back to the simple AI
  if the thinking one ever throws.
- **Item 3 is built** (2026-11-23): every boss has **Cleanse** (Crystal Armour's ward, the user's
  choice of effect and name), in place of the Minotaur's Water Body. Simmed three ways; what's in
  is "the round after, and it costs the turn". It brings the Hydra back to a fight (Obsidian
  Arrows 78% in 19 rounds, from 100% in 10). The Minotaur still loses to those moves every time,
  only in 20 rounds, not 10. The numbers are in [design/labyrinth.md](design/labyrinth.md) (Bosses).
- **Item 4 is built** (2026-11-23): a chest, gold and XP for each boss (`BOSS_LOOT`), and stash
  gold replaced by money stashes (1 in 4, their gold times the dungeon's gold scale). The daily
  boss rewards are not changed.
- **Item 2:** no gear shown on the dungeon picker (the user: people read the levels, and gear there
  adds complexity). The level cap may go to 50 one day; gear is meant to be the end-game chase, and
  PvP can raise levels and stay fair. The XP curve waits for run history.
- **Run history** now also records the kind of room a run ended in.
- **The Minotaur falling to bleed and venom in 20 rounds is as meant** (the user, 2026-11-23): it was
  designed to want some share-of-max-HP damage. Cleanse stays.
- **The level cap is 50** (2026-11-23; Klutz stays at 30), and the Bestiary shows stats at Lv 15, 30 and 50.
- **Item 4's daily rewards are fixed** (2026-11-23): every boss pays the Cyclops's box of 5, a little
  better the deeper the boss, and the Minotaur has one. Kept small: the big reward is to be the Challenge
  (a dungeon beaten with a quirk), decided in outline in [design/den.md](design/den.md), not built.

## What this rests on

**Sims** (throwaway Vitest files, deleted afterwards; the code as it stood on 2026-11-22, with the
uncommitted "chest guards see all round" change in the working copy, which touches none of this):

- **Economy:** 30 whole walked runs per dungeon (Encampment, Cyclops, Hydra, Minotaur), every room
  opened: gold, what each thing sells for, XP. A "natural run" is the shortest way up plus 5 side
  rooms. It reproduces the 2026-11-21 gold figures (full clears 737 / 2,187 / 3,458 / 3,961).
- **Fights:** a party of a set level, creature rarities and gear rarity walks the careful way up a
  real layout (24 to 40 runs a row), fighting what's on it, healing at pools and campfires and
  drinking the potions it finds. Also the boss alone, at full health.
- **Moves and soul stones:** two identical teams of three (Lv 16, Rare gear), one with the move in
  its fourth slot, 60 fights a move; and the same parties against each boss with and without a move.

**What the sims can't tell you.** Both sides are the game's AI (Normal for the party). A person
plays better: the Hard AI wins the Cyclops fight 78% where Normal wins 58%. A person also sneaks
past rooms, packs potions for the boss and picks gear that fits. So read a sim's win rate as a
floor, and trust the differences between rows more than the rows themselves. Rows of 40 runs are
good to about ±8 points.

**Real data:** 10 cloud saves, read on 2026-11-22. **There is no run history yet:** no save has
been written since history went in, so `history` is empty everywhere. What there is:

- Runs and clears per dungeon, gold, levels, gear, materials and campaign progress for each save,
  and each save's last 10 fights (72 in all).
- Only 5 saves have more than an hour of play: two at about 4 hours (one is Player D below) and
  three veterans at 13.5, 19 and 24 hours, whose play was mostly on the Speed Scroll, before
  walked runs. The other five are under an hour; one of them, Player E, was still playing on
  2026-11-21.
- So the real data is thin: good for spotting a wall, no good for rates. Run this again once a
  week or two of history is in.

## 0. Fix first: a tap that does nothing (a bug)

**What's wrong.** Against a foe that carries **Mega Smash as its off-race codex move**, asking the
AI for its move throws about half the time ("Invalid action for side B: pass"). The battle screen
doesn't catch it (`act` in components/BattleScreen.tsx), so the player's tap is lost: nothing
happens, and they tap again.

- Why: Mega Smash winds up for a turn. Wound up, it's the only move the foe may use
  (`affordableSkills`). The simple AI then drops the off-race move half the time
  (`aiChooseSkill` in lib/combat/teamBattle.ts, the `OFF_RACE_USE` filter), finds nothing left and
  passes, and a pass isn't allowed while a move is affordable (`isValidAction`). The thinking AI's
  own choice guards against this (`candidates` in thinkingAi.ts), but its look-ahead plays the
  simple AI, so it hits it whenever it imagines winding up.
- Reproduced: a foe with off-race Mega Smash, first turn: the call threw 109 of 200 times on
  Normal, 103 of 200 on Hard, never on Easy.
- How often: about 0.3 to 0.4% of foes from the Hydra on carry it (Rare codexes start there), so
  roughly 1 fight room in 100: about one full Hydra clear in four meets one, and nearer one in two
  in the Minotaur. It also stopped two of this audit's own sim batches.

**Confidence:** high. **Effort:** tiny (in `aiChooseSkill`, if the filter leaves nothing, keep the
moves it had; a test with a wound-up foe). Worth a try/catch round the AI call in `act` as well,
falling back to the simple AI, so the next bug of this kind can't freeze a fight.

## 1. The campaign pays in strict order

**What's wrong.** Rewards are claimed in order (`claimNext`), and several quests early in each
chapter wait on luck or materials. The chapter's boss reward is last, so anything slow before it
holds it back, which is the opposite of what the pacing note intends ("none holds a boss's reward
up for long", den.md).

- **Player E** (0.6 hours, on the current build) has beaten the Encampment twice in three runs, has
  built the crooked bookcase and has a Lv 5 creature, but has claimed 6 rewards: the next is
  "Collect 3 creature cards", and they have 2 (cards come from scans, and they've done only the
  calibration ones). The Encampment's Gear Barrel, the reward that would help with the Cyclops,
  waits behind it.
- **Player D** (4.3 hours, the most engaged recent player; 3 Cyclops clears, into the Hydra) has
  claimed 33 and is stopped at "Build the sturdy bookcase": 5 nails of 15, 3 metal bars of 5.
  Six later quests they've already done wait behind it.
- The quests that can stall, in the first three chapters: 3 cards, the crooked bookcase, a Common
  summoned (3 cards of one species), Klutz bringing home a Rare, the iron cage (its plan is 20%
  from a mini boss, then 10 metal bars), a rack, the Labyrinth Stone, the sturdy bookcase, a
  golden chest opened.

**Confidence:** medium. Two of the three newest active players are held up, but it's two players.

**Options.**

1. **Order between chapters only:** inside the chapter you're on, claim any quest that's done.
   Keeps the story's shape and the ➜ guidance. Needs the save to remember which quests are claimed
   (a new optional field beside `claimed`, old saves read as now) and the board to allow it.
2. **Keep strict order, move the slow quests** after each chapter's boss (or into the next
   chapter). No new save field, but every reorder is a `CAMPAIGN_V` step, and luck will still
   stall someone.
3. **Only the boss's reward jumps the queue.** The smallest change; the rest still wait.

**Effort:** small (option 3), small to medium (1 and 2).

## 2. Gear is the gate, not level, and levels run out by hour 15

**What's wrong.** Three things that add up.

**Gear rarity decides the boss fights, more than level does.** Boss alone, party at full health:

| Boss | Party | Wins |
|---|---|---|
| Cyclops | Lv 6, Uncommon gear | 5% |
| Cyclops | Lv 8, Uncommon gear | 28% |
| Cyclops | Lv 8, Rare gear | 58% |
| Cyclops | Lv 10 / 12 / 14, Rare gear | 70% / 63% / 88% |
| Cyclops | Lv 10, Epic gear (and an Epic creature) | 98% |
| Hydra | Lv 13, Rare gear | 13% |
| Hydra | Lv 16, Rare gear | 15% |
| Hydra | Lv 16, Epic gear | 53% |
| Hydra | Lv 20 / 25 / 30, Epic gear | 70% / 78% / 83% |
| Minotaur (5 v 5) | Lv 18 / 22 / 26 / 30, Epic gear | 58% / 88% / 79% / 92% |

One step of gear rarity is worth about 6 levels at the Cyclops and 14 or more at the Hydra. That
fits the user's goal ("well-fitted gear should beat raw rarity"), but the dungeon picker shows
foe levels as the measure of a dungeon, and a player past the Hydra's levels in Rare gear has
about a 15% shot at it. Levels do count on the climb: up the whole Hydra in Epic gear, a party
clears 23% of runs at Lv 15, 33% at Lv 21, 57% at Lv 25 and 80% at Lv 30 (appendix).

**Levels come 2 to 4 times faster than the campaign's pacing model assumed.** The model
(2026-11-16, den.md) took a won run as 620 XP in the Cyclops and 1,760 in the Hydra. Walked runs
give:

| | Encampment | Cyclops | Hydra | Minotaur |
|---|---|---|---|---|
| XP, natural run | 283 | 1,448 | 2,112 | 3,859 |
| XP, full clear | 433 | 2,772 | 5,467 | 11,532 |

A team of three is past the Cyclops's top level (7) within two or three natural runs there, and
three creatures go from Lv 15 to Lv 30 in about 19 natural Hydra runs. The three veterans were at
Lv 30 with 5 or 6 creatures, and explorer level 30, at 13.5, 19 and 24 hours.

**So by hour 15 the level bar is done,** and the campaign's level quests (Lv 20, 25, 30, explorer
30) are finished chapters before their place. From there the only growth is gear, codexes and
ascension, and Epic gear is slow: about 1.1 Epic pieces in a full Cyclops clear, 2.1 in a Hydra
one, 3.4 in a Minotaur one (plus 0.7 Legendary), and 1 scan in 28.

- Real play agrees as far as it goes. Player D, at 4.3 hours with Lv 17, 16 and 11 creatures in
  mostly Rare gear and 7 Epic pieces in all, is 0 for 5 at the Hydra, while winning its dens and
  mini bosses. The veterans, maxed and in Epic gear, clear it 28 times in 91 runs.

**Confidence:** high that gear outweighs level and that XP outruns the model (code and sims
agree, and the veterans' saves show it); medium on how long the Cyclops-to-Hydra stretch feels,
which needs run history.

**Options.**

1. **Say what the gate is.** On the dungeon picker, show the gear its foes wear beside their
   levels ("Foes: Lv 7–17, Uncommon to Rare gear; the Hydra wants Epic"). No balance change at
   all. Small.
2. **Slow the top of the XP curve** (`XP_PACE`, or a steeper curve past Lv 15) so Lv 30 lands
   nearer hour 40. Knock-ons: the campaign's level quests fall back into place; the Sparring Pit
   and XP scrolls matter for longer; the veterans keep their levels. It was already slowed once at
   the user's request, so this is the user's number.
3. **Make a level worth more** (HP or %s per level). This changes every fight in the game: foes
   level too, so every sim result in the docs would need redoing. The riskiest of the three.
4. **More Epic gear in the Hydra's own rooms** (say, one sure Rare-or-Epic piece in a mini boss's
   chest there), so the dungeon you're stuck on is the one that gears you for itself. See item 4.

**Effort:** small (1, 2), medium (4), large (3).

## 3. Bleed, clouds, venom and Healing Blessing beat every boss

**What's wrong.** Damage that takes a share of max HP every round ignores a boss's defences and
its big health bar, and a boss can't leave the field to shake it off. Sustained healing does the
same job from the other side. The same parties, against each boss, with the move and without it
(40 fights each way, 20 for the Minotaur; the rounds are how long the fight lasted):

| Boss and party | Move | With it | The same parties without |
|---|---|---|---|
| Cyclops (Lv 10, Rare gear) | Obsidian Arrows | 100%, 13 rounds | 85%, 16 rounds |
| | Choking Smog | 98%, 14 | 78%, 17 |
| | Rabid Bite | 85%, 15 | 48%, 18 |
| | Healing Blessing | 100%, 20 | 88%, 15 |
| Hydra (Lv 20, Epic gear) | Obsidian Arrows | 100%, 10 | 45%, 21 |
| | Razor Arrows | 100%, 12 | 55%, 20 |
| | Choking Smog | 100%, 8 | 53%, 23 |
| | Rabid Bite | 100%, 15 | 48%, 20 |
| | Poison Dart | 80%, 18 | 45%, 21 |
| | Healing Blessing | 88%, 32 | 53%, 21 |
| | Mega Smash (a plain big hit, to compare) | 85%, 16 | 60%, 20 |
| Minotaur (five at Lv 26, Epic gear) | Obsidian Arrows | 100%, 9 | 70%, 25 |
| | Razor Arrows | 100%, 11 | 65%, 28 |
| | Choking Smog | 100%, 10 | 80%, 26 |
| | Rabid Bite | 100%, 10 | 50%, 28 |
| | Poison Dart | 100%, 16 | 65%, 26 |
| | Healing Blessing | 85%, 31 | 80%, 28 |
| | Mega Smash | 65%, 25 | 65%, 30 |

With a bleed, a cloud or venom, the Hydra and the Minotaur stop being a coin toss and become a
sure thing in half the rounds.

- **Obsidian Arrows** (a Rare codex, 500 gold at a librarian) and **Razor Arrows** (Uncommon, 250
  gold, a 50% chance): the target "bleeds 10% of its max HP a round until it leaves the field"
  (`bleed` with `SOAK_ROUNDS` in battle.ts). A boss part never leaves, so each one is dead in 10
  rounds at most whatever its health.
- **Choking Smog** (Legendary): 10% a round for 5 to 7 rounds, on whichever head is out. Even
  **Poison Dart** (a Common codex, 100 gold: 5% a round for 3 to 5 rounds) is worth 35 points.
- **Rabid Bite** (a race codex): venom. The Minotaur's Water Body was added to answer it, but it's
  one roll in five on a 7-round cooldown, and the venom or the bleed goes straight back on: the
  fight is over in 9 to 11 rounds all the same.
- **Healing Blessing** (an Uncommon codex, 250 gold): 60% of max HP every third round for 40
  energy. The docs' own sim had it the strongest move of its batch (+21 points), and it's already
  kept off foes.

This isn't "strong but predictable". Against a boss there's nothing to predict or play round:
the answer the game offers to bleed and venom is swapping out, and bosses can't. Ordinary foes
can, but the AI doesn't: in the mirror sim (appendix) the team with Healing Blessing won 98% of
fights, Obsidian Arrows 92%, Rabid Bite 87% and Razor Arrows 85%, the top four of all 57 moves.

**Confidence:** high for bleed and the cloud (it follows from the rules, and the sim agrees);
medium for how many players will find these early (three of the five experienced saves have
Rabid Bite on a main creature; one has Healing Blessing).

**Options.**

1. **Bosses shrug off part of it:** share-of-max-HP damage on a boss part does half, or is capped
   (say 4% a round). One rule, and the moves stay as they are everywhere else. The Hydra's own
   poison (2.5% a round) is a fair yardstick.
2. **Give each boss a way out,** as the Minotaur has: a bleed on a boss part lasts 3 rounds; a
   Hydra head that regrows comes back clean. More to build and to explain, but each boss keeps
   its character.
3. **Change the moves:** a bleed lasts 4 rounds, like Haemorrhage's blood. Simplest to read, and
   it brings them back into line in ordinary fights too (they top the mirror sim), but it's a
   change to moves players already own.
4. For Healing Blessing: a longer cooldown (5 rounds, like the Divine blessings), a smaller heal
   (40%), or a dearer codex (it's Uncommon). It's the strongest move in the game for 250 gold.

**Effort:** small (1, 3, 4), small to medium (2).

## 4. Deeper dungeons don't pay for their risk

**What's wrong.** What a run brings home, from the economy sim (gold picked up; what the loot
sells for; XP):

| | Encampment | Cyclops | Hydra | Minotaur |
|---|---|---|---|---|
| Entry fee | 50 (10 free) | 100 | 200 | 300 |
| Gold, natural run | 415 | 763 | 1,244 | 1,428 |
| Gold, full clear | 737 | 2,187 | 3,458 | 3,961 |
| Loot's sale value, natural run, best 5 things | 505 | 1,014 | 1,426 | 2,111 |
| Loot's sale value, full clear, everything | 971 | 4,681 | 6,174 | 8,244 |
| The boss's room: gold / chest's sale value / XP | 68 / 125 / 42 | 93 / 684 / 800 | 203 / 797 / 600 | 251 / 785 / 200 |

- **Every boss opens the Cyclops's chest.** The Hydra, the Minotaur and the Warden all roll
  `cyclopsChest()` (app/dungeon/page.tsx): 3 to 5 pieces at scan odds, a codex or two, potions.
  Only the gold scales (80 to 120 times `goldScale`) and the soul stone chance (2% to 5%).
- **The Minotaur itself is worth two of its own mini boss rooms:** 200 XP (one boss part; a den of
  five there gives about 310), about 250 gold and that chest, for one of the longest fights in the game
  (about 24 rounds).
- **The Minotaur pays 15% more gold than the Hydra,** as already known. Why: fight gold is per
  room, not per foe, so five foes pay what three do; and the flat half doesn't move (next point).
- **Stash gold is the flat part, not chest gold.** A chest room holds about 58 gold (three rolls,
  each 20% gold of 50 to 150). The flat gold is in stashes and the stashes beside campfires
  (half of either hold 100 to 250): about 750 a full clear in every dungeon. With chests, the flat
  part is 51% of the Cyclops's gold, 32% of the Hydra's and 24% of the Minotaur's.
- **Chest rooms and stashes roll the same rarities everywhere,** the Encampment included. What
  does scale is foes' own gear: Rare and Epic pieces dropped per full clear go 2.0 / 6.5 / 9.1
  (plus 0.7 Legendary) from the Cyclops to the Minotaur. So the loot is there, but in the fights,
  not the chests.
- **The daily boss quests pay less the deeper they go** (lib/daily.ts): the Cyclops gives 5 pieces,
  Rare to Legendary; the Hydra 3, Rare or Epic; the Abyss 1 Epic. A player who can't do the
  Hydra's yet is stepped down to the Cyclops's, which is the better reward. The Minotaur has none.

**Confidence:** high (read from the code, and the sim agrees).

**Options.**

1. **A chest for each boss.** The Hydra's strongbox: its gear rolled Rare or better, one piece
   surely Epic. The Minotaur's: Epic or better. And the Minotaur's XP at 600, as the Hydra's three
   heads give. Knock-on: it's the answer to item 2's "where does Epic gear come from", so it
   shortens the Hydra-to-Minotaur stretch.
2. **The user's idea, aimed at stashes:** less gold in stashes (not chests: there's little there
   to cut), and a rarer golden money sack that scales. For instance: halve a stash's gold, and 1
   stash in 4 holds a golden sack of 150 to 300 times `goldScale`. That's about the same gold in
   the Cyclops, about 500 more a full clear in the Hydra and 750 more in the Minotaur.
3. **Pay the Minotaur per foe:** raise its `goldScale` from 2.5 to about 3.5 (fight gold 3,000 to
   4,200, so a full clear is about 5,200: half as much again as the Hydra's, in line with its
   fights being 5 v 5).
4. **Turn the daily ladder the right way up:** swap the Cyclops's and the Abyss's rewards, or
   make each a box whose size and floor rise with the dungeon; add the Minotaur.

**Effort:** small for each (numbers and one roll function; option 1 wants a test or two).

## 5. Nails and metal bars for the first Den upgrades

**What's wrong.** The first Den upgrades sit in the campaign's second and third chapters, and cost
more nails and metal bars than a new player finds.

- A full Cyclops clear gives about 12 planks, 12 nails, 1.4 metal bars, 0.2 stone and 0.07 essence
  crystals (the crates in rooms' corners add a little); a natural run about a third of that. A
  merchant's cart adds 2 bars for 90 gold, if you find him.
- The iron cage is 10 metal bars; the sturdy bookcase 25 planks, 15 nails and 5 bars; a rack 10
  planks and 5 nails.
- Player D (4.3 hours, 24 runs) holds 38 planks, 5 nails and 3 metal bars, and three plans they
  can't build (the iron cage, both racks). The veterans, after 100 to 160 runs, hold 6, 19 and 9
  metal bars with plans waiting; two hold over 100 nails, so nails only pinch early.

The slow pace of the tavern's upgrades is the user's own pick (den.md); this is about the first
few upgrades only, which come when a player is still deciding whether the Den matters.

**Confidence:** medium (the rates are solid; one new player's save shows the pinch).

**Options.**

1. **Cheaper first steps:** the iron cage 5 bars, the sturdy bookcase 10 nails and 3 bars. The
   later stages stay dear.
2. **More early metal:** a Common bundle can be 1 metal bar; or the Cyclops's stockrooms always
   hold one stack of bars. Knock-on: it speeds everything that needs bars, the tavern's upgrades
   too.
3. **Leave the costs, and take the quests out of the queue** (item 1): then a slow build is just
   slow, and blocks nothing.

**Effort:** tiny (1, 2).

## 6. The Cyclops takes about 18 runs

**What's wrong.** The docs' target is a first Cyclops kill around run 12 or 13. The five saves
that have one got it on run 18, 18, 20, 20 and 8.

- The four slow ones played older builds, so this may already be better: the 8 is Player D, the
  only one on a recent build. Their Cyclops record since is 3 clears in 12.
- The sim says what the wall is made of. The party a player arrives with from the Encampment (a
  Rare, an Uncommon and a Common, Lv 4 to 6, Common or Uncommon gear) reaches the Cyclops in 13 to
  30% of runs and never beats it. In Rare gear at Lv 8 it reaches him 60% of the time and wins
  18%; three more potions in the bag make that 28%. Each den on the way costs about a fifth of
  the team's health, and 35 to 40% of sim runs end in a den, not at the boss.
- The Encampment before it looks right now. A lone Lv 3 Rare in Common gear clears it 20% of
  the time; with the second Rare the calibration scans have given since 2026-11-20, 55%; in
  Uncommon gear, 90%. (The one real player who went 0 for 7 there, and stopped, did so with a
  single creature, before that gift.)

**Confidence:** low to medium. The real numbers are from older builds, and a person does better
than the sim on exactly this kind of run.

**Options.**

1. **Wait for run history.** It will show the real first-clear run on the current build, and how
   far up failed runs get. This is the first thing to look at when it's in.
2. If it's still 18: **a gentler middle.** The eased start ends at room 7; dens from room 5 on are
   2 to 3 foes. Dens of 1 to 2 up to room 6 would take about one den's damage off the climb.
3. Or **more Rare gear on the way:** the Encampment's Gear Barrel is the campaign's push here, and
   item 1 is what's holding it back.

**Effort:** small.

## 7. Soul stones: three strong, three nearly nothing

**What's wrong.** Two identical teams of three, one with the stone on every creature (100 fights
each; 50% means it did nothing):

| Stone | Wins with it |
|---|---|
| Revitalise | 85% |
| Perfectionist | 75% |
| Toxic Skin | 74% |
| Haunting Presence | 54% |
| Trickster | 49% |
| Unstoppable Force | 45% |

- Trickster and Unstoppable Force only do anything in particular fights (a utility move to cast; a
  foe that cripples), so a creature born with one has, most of the time, no stone. A replacement
  costs a Legendary find and 5,000 gold.
- These fights ran long (21 to 25 rounds), which flatters Revitalise and Perfectionist. Against
  bosses Perfectionist stayed within 6 points of a plain party; Revitalise was worth a lot
  against the Cyclops (100% against 62%) and nothing against the Hydra. So the strong three
  aren't a problem; the weak three are just dull.

**Confidence:** medium (AI against AI; the order is clear, the sizes less so).

**Options.**

1. **Give the weak ones a second, small, always-on line:** Unstoppable Force also takes 10% less
   from heavy moves; Trickster's first move each fight goes first. They stay situational, but
   never dead.
2. **Leave them:** uneven stones are part of what makes a good roll feel good. If so, consider a
   cheaper replacement than 5,000 gold for a stone that does nothing.

**Effort:** small.

## 8. Potions are everywhere

**What's wrong.** A full clear turns up 28 potions in the Cyclops, 34 in the Hydra and 32 in the
Minotaur (stashes, the stashes by campfires, mini bosses' chests, stockrooms); a natural run about
8 to 10. The veterans' stores hold 6, 13 and 18 potions, and 4 to 9 Revival Elixirs.

- So the merchant's potions (50 and 100 gold) are never worth buying, and they're two of the
  cart's three fixed wares.
- They don't break the climb: in the sim the party drinks 3 to 6 a run and still loses most runs.
  And they're a fair reward for exploring. This is about a dead ware, not about difficulty.
- They are also a real slice of loot value: about 900 to 1,100 gold a full clear if sold (25 or 50
  each), a fifth of the Cyclops's.

**Confidence:** medium.

**Options.**

1. **Leave it,** and swap the cart's fixed Lesser Potion for something a player wants every run (a
   stack of nails, say: see item 5).
2. **Fewer by campfires:** a campfire's stash 25% of the time, not 50% (`CAMPFIRE_STASH`). About
   4 fewer potions and 170 less gold a full clear.

**Effort:** tiny.

## 9. The Training Pit

**What's wrong.** It trains at 50 XP an hour (sparring) or 100 (built), one level at a time. One
natural Hydra run is 2,112 XP: 21 hours of the built pit for one creature. Over weeks the
veterans' pits have given 3,100, 6,600 and 9,500 XP in all, about half of what one creature
needs for Lv 30, and all their creatures were maxed by hour 24 anyway.

It costs 10 stone, 10 metal bars and 3 essence crystals to build, then 20 bars, 10 stone and 3
crystals, then 30, 15 and 6, for its slots: the scarcest things in the game. And the campaign
sends you there five times (build it, 2 slots, 3 slots, and 3 and 10 levels from sparring).

**Confidence:** high on the numbers. Whether it matters depends on what the pit is for.

**Options.**

1. **A share of the bar an hour, not a flat rate** (say a level every 8 hours, whatever the
   level): then it's worth having at Lv 20, and it's the natural home for the creatures you're
   raising to give up at the altar.
2. **Leave the rate, cut the slots' cost** to planks and nails. It stays a trickle, but a cheap
   one.
3. If item 2's slower XP curve goes in, look at this again afterwards: the pit matters more when
   levels are scarcer.

**Effort:** tiny.

## 10. Small things

- **XP scrolls as late rewards.** A scroll is a flat 400 XP: most of a level at Lv 10, half at
  Lv 20, a third at Lv 29, nothing at Lv 30. The campaign's fourth and fifth chapters pay 21 of
  them across six quests. Two of the veterans hold 9 and 17 unread. Options: a scroll gives a
  share of the reader's bar (at least 400 XP); or pay essence crystals there, as the 2026-11-20
  change did elsewhere.
- **Vampiric is Leeching with smaller numbers.** Both heal a share of damage dealt and both work
  in every fight (battle.ts adds them together): 2 / 3 / 5% against 3 / 4 / 5%. Options: make
  Vampiric different (heals on a knock-out, say), or drop it from the pool.
- **The Enchantress asks a lot for a little.** 1,000 to 5,000 gold and an essence crystal to
  reroll an edge of a few percent, to a random other one of seven. Crystals are the scarcest
  material (the veterans hold 2, 1 and 0). Options: gold only; or let the player pick from two.
- **Cards have nowhere to go.** The veterans hold 119 and 179 cards. The collector buys and
  trades creatures only, and a summon wants three of one species. Options: the collector takes
  cards (3 for one of the rarity above, as with creatures), or buys them cheaply.
- **Moves the AI wastes.** With Brace a team wins 31% of mirror fights, with Cleansing Water 33%:
  the AI spends turns on them for nothing. A foe that rolls one as its own-race codex is weaker
  for it. Options: keep both off foes (`NOT_ON_FOES`), which costs nothing.
- **The Minotaur's mini bosses drop Legendary gear,** about 0.7 pieces a full clear, because their
  Epic gear steps up 30% of the time with the creature (`STEP_UP`'s rule, the Hydra's 0.3 carried
  over). That may be wanted. It is the game's steadiest source of Legendary gear, and it
  arrives before the Abyss. Worth a deliberate yes or no.
- **Strong moves in ordinary fights** (mirror sim, 60 fights each, so ±6 points; a plain race move
  sits around 55 to 60% because core moves have no race): after item 3's four, the top is Pounce
  85%, Bolas Shot and Voltage Surge 80%, Mega Smash and Soul Snatch 78%, Curse 77%, Bone Javelin
  and Emulate 75%. None of these looks broken; they're listed so the next move pass knows where
  the top is. At the bottom with Brace and Cleansing Water: Nibble 38% and Implode 42% (the AI
  can't play either: one wants ten turns in a row, the other is a sacrifice), Meditate and Dark
  Seal 45%.

## 11. The Abyss

The three veterans, all at Lv 30 in Epic and Legendary gear, have cleared the Abyss once in 63
runs (the Hydra: 28 in 91). In the sim a party of five at Lv 30 in Epic gear beats the Warden's
pack 75% of the time at full health (a 38-round fight; in Legendary gear 100%), but gets up the
Abyss to face it in only 29% of runs: over half the runs end in a den. (In Legendary gear with a
Legendary creature: 88% get up, 54% clear.) So the climb is the wall, not the boss, and the way
through it is Legendary gear.

It's past a new player's first 20 hours, and since 2026-11-21 the Minotaur stands in front of
it, so it's last here. But it is where the three most engaged players have been stuck. Worth its
own session once the Minotaur has been played. The place to look is its dens: three to five
Uncommons in Rare gear, Lv 19 to 24, on the Normal AI, each costing a fifth of the team's health.

**Confidence:** low (old builds, three players). **Effort:** unknown.

## Gold, hour by hour

What a natural run brings in, if you sold the best things your bag could carry home (sim):

| | Encampment (bindle, 3) | Cyclops (backpack, 5) | Hydra (5) | Minotaur (10) |
|---|---|---|---|---|
| Gold picked up | 415 | 763 | 1,244 | 1,428 |
| Selling the loot | 429 | 1,014 | 1,426 | 2,663 |
| Entry fee | 0 to 50 | 100 | 200 | 300 |
| **Net** | **about 800** | **about 1,700** | **about 2,500** | **about 3,800** |
| Selling's share | 51% | 57% | 53% | 65% |

**Selling loot is the bigger half, at every stage,** as suspected. It's also the half that takes a
decision (what to carry, what to keep), and the bag's size is what limits it: a 10-slot bag is
worth about 400 to 550 gold a run over a 5-slot one. That's a good loop. Keep it.

These are ceilings: they assume the run gets to the top and that everything is sold. Real
balances, where the saves show them:

| Hour | Where a player is | Gold in hand (real) | What there is to spend it on |
|---|---|---|---|
| 1 | The Encampment, 10 free runs | 750 and 1,400 (2 players) | Nothing: no merchant in the Encampment, the tavern's shut. It piles up for the backpack (1,000) on the first Cyclops merchant. |
| 5 | Cyclops beaten, starting the Hydra | 830 and 1,350 (2 players) | The backpack, bag slots (1,000 to 3,000 each, on 1 cart in 5), codexes (100 to 750), Klutz's pack. Gold is tight here, which feels right. |
| 20 | Hydra farmed; the veterans were in the Abyss | 2,300, 3,700 and 10,900 (3 veterans, mostly Speed Scroll play) | Bag slots are bought out (11,000 in all); Klutz's chest and pack (26,750 in all); plans off the cart (1,000 to 8,000); materials at the tavern. |
| 50 | No data | On the sim's rates, 5,000 or more an hour coming in | The one-off sinks (about 40,000 without plans, 80,000 with) are done by about hour 20 to 30. After that: the tavern's merchant (a visit is 500 gold to send for, then about 850 to 1,850 of materials), rerolls, soul stones. |

- **Too plentiful:** potions (item 8); XP (item 2); gold in the first hour, harmlessly; cards
  (item 10).
- **Too scarce:** metal bars all along and nails early (item 5); essence crystals late (they're
  meant to be); Epic gear between the Cyclops and the Hydra (item 2).
- **Skippable:** the merchant's potions; the Training Pit (item 9); the Enchantress (item 10); XP
  scrolls on a cart at 200 gold (400 XP is a quarter of one Cyclops run's).
- **Entry fees** are 12 to 21% of a natural run's gold and under 10% of its takings. They're a
  nudge, not a bar: even a run that fails halfway usually picks up more than its fee.
- **Late gold is the open question.** Nothing in the saves shows a player swimming in it, but the
  veterans' play was on the Speed Scroll, which has about half as many rooms. On walked rates gold will outrun the
  sinks somewhere past hour 20, and the tavern's merchant becomes the only drain. Run history
  (gold found, spent and sold per run) will show it directly. Wait for that before changing
  prices.

## Checked and found fine

- **The Encampment** as a first hour, now that calibration gives a second Rare: 50 to 55% a run
  with two Rares in Common gear, 90% in Uncommon. A struggle, as asked, not a wall.
- **Entry fees**, and Klutz's trips costing the same: in proportion at every dungeon.
- **Scan gold and scans generally:** a scan is worth about 35 gold in gold and sale value. Scans
  are for creatures and gear, not money, and stay that way.
- **Campaign and daily gold:** about 3,500 gold over the whole campaign since the 2026-11-20
  change to essence crystals, and 100 to 500 from a daily. Neither floods anything now.
- **Codex prices** (100 to 2,500): in line with what a run earns at the stage each rarity turns up.
- **Golden chests and Gold Keys:** a golden chest is worth about 2,000 gold (500 to 1,000 in gold,
  five enchanted pieces); there's 0.5 to 1.3 a map and about half a key a full clear. A fair chase.
- **Enchantments' sizes:** small on purpose, and they are. Bounty is worth roughly 85 to 170 gold on a
  natural Hydra run.
- **Cripple** since the 2026-11-13 and 2026-11-21 changes: Cripple 63%, Crippling Shot 55% in the
  mirror sim. Useful, not dominant. (Bolas Shot, at a 70% chance, is the strongest of the family.)
- **Perfectionist and Nibble against bosses,** which compound without a cap and looked alarming on
  paper: no better than a plain party against any of the three bosses (the AI may underuse them;
  a person spamming one move through a 25-round boss fight would do better than this).
- **Explorer level** gating scan rarity: passed by about hour 3, as it's meant to be.
- **The collector's prices, soul stone replacement, Klutz's re-spec:** nothing odd.
- **The 5 v 5 Minotaur fight** on its own numbers: 58% at Lv 18 to 92% at Lv 30 in Epic gear,
  about what the docs' sim found.

## Not checked

- **PvP and duels:** no data, and the AI is no guide to it.
- **Klutz's trips** beyond their price: the docs' own sim (2026-11-16) is recent.
- **The Speed Scroll's** rooms and rates: everything here is walked runs.
- **Ascension's** cost and worth: outside the first 20 hours.
- **The stat roller** (budgets, ceilings, roll config): the user's own, and nothing here points at it.
- **Wandering merchants, librarians and witches** in walked runs: how often a player actually finds
  them. Run history's "spent" will show it.

## Appendix: the sims' numbers

**Up each dungeon** (the careful way up, Normal AI, 2 Lesser Potions packed unless said; r / u / c /
e / l are the party's creature rarities).

| Dungeon | Party | Reaches the top | Clears | Fights won | A den costs (team HP) |
|---|---|---|---|---|---|
| Encampment | Lv 3, r, Common gear | 50% | 20% | 76% | 48% |
| Encampment | Lv 3, r, Common gear, no potions | 33% | 15% | 71% | 45% |
| Encampment | Lv 4, r, Common gear | 65% | 43% | 84% | 46% |
| Encampment | Lv 5, r, Uncommon gear | 85% | 75% | 94% | 37% |
| Encampment | Lv 3, rr, Common gear | 88% | 55% | 90% | 28% |
| Encampment | Lv 4, rr, Uncommon gear | 95% | 90% | 98% | 20% |
| Encampment | Lv 5, ruc, Common gear | 95% | 75% | 94% | 23% |
| Cyclops | Lv 4, ruc, Common gear | 15% | 0% | 74% | 30% |
| Cyclops | Lv 6, ruc, Uncommon gear | 30% | 0% | 79% | 24% |
| Cyclops | Lv 6, rru, Uncommon gear | 25% | 0% | 81% | 23% |
| Cyclops | Lv 8, rru, Uncommon gear | 40% | 5% | 81% | 26% |
| Cyclops | Lv 8, rru, Rare gear | 60% | 18% | 86% | 19% |
| Cyclops | the same, no potions / 5 potions | 48% / 65% | 13% / 28% | 84% / 88% | 21% / 20% |
| Cyclops | the same, Hard AI | 68% | 13% | 86% | 20% |
| Cyclops | Lv 10, rru, Rare gear | 58% | 23% | 87% | 19% |
| Cyclops | Lv 12, rru, Rare gear | 60% | 25% | 87% | 19% |
| Hydra | Lv 10, rru, Rare gear | 7% | 0% | 71% | 38% |
| Hydra | Lv 13, rru, Rare gear | 20% | 3% | 78% | 32% |
| Hydra | Lv 15, rrr, Rare gear | 20% | 3% | 81% | 31% |
| Hydra | Lv 15, err, Epic gear | 60% | 23% | 86% | 20% |
| Hydra | Lv 18, err, Epic gear | 73% | 17% | 86% | 21% |
| Hydra | Lv 21, err, Epic gear | 73% | 33% | 89% | 21% |
| Hydra | Lv 25, eer, Epic gear | 87% | 57% | 93% | 15% |
| Hydra | Lv 30, eer, Epic gear | 93% | 80% | 97% | 14% |
| Minotaur | Lv 18, eerrr, Epic gear | 38% | 17% | 82% | 22% |
| Minotaur | Lv 22, eerrr, Epic gear | 33% | 17% | 82% | 21% |
| Minotaur | Lv 26, eerrr, Epic gear | 67% | 38% | 89% | 18% |
| Minotaur | Lv 30, eerrr, Epic gear | 60% | 35% | 89% | 15% |
| Abyss (the Hydra's layouts) | Lv 30, eeerr, Epic gear | 29% | 17% | 83% | 22% |
| Abyss | Lv 30, leeer, Legendary gear | 88% | 54% | 93% | 12% |

**What a full clear holds** (30 runs each): rooms 23 / 72 / 72 / 73; fights 18 / 39 / 36 / 38;
potions 10 / 28 / 34 / 32; Epic gear 0.2 / 1.1 / 2.1 / 3.4; Rare gear 0.6 / 3.9 / 7.4 / 8.9;
golden chests 0 / 0.5 / 1.1 / 1.3; material bundles (Common / Uncommon / Rare / Epic) in the
Cyclops 5.4 / 1.5 / 0.4 / 0.2.

**Every codex move, in the mirror sim** (wins with it; 60 fights; Lv 16, Rare gear):

Healing Blessing 98 · Obsidian Arrows 92 · Rabid Bite 87 · Pounce 85 · Razor Arrows 85 · Bolas Shot 80 ·
Voltage Surge 80 · Mega Smash 78 · Soul Snatch 78 · Curse 77 · Bone Javelin 75 · Emulate 75 · Headbutt 73 ·
Erupt 72 · Poison Dart 72 · Rock Toss 68 · Vampiric Bite 68 · Ambush 67 · Choking Smog 65 · Smite 65 ·
Cripple 63 · Mirage 63 · Arcane Channel 62 · Bounce 62 · Nullifying Voice 62 · Septic Shock 62 ·
Sureshot Blessing 62 · Cursed Claw 61 · Haunting Scream 60 · Claw 58 · Stalactite 58 · Flame Body 57 ·
Barrage 55 · Blood Sacrifice 55 · Crippling Shot 55 · Blessed Bolt 53 · Caltrops 53 · Pin Down 53 ·
Corpsify 52 · Haemorrhage 52 · Slap 52 · Smoke Bomb 52 · Divine Strength 50 · Flame Spit 50 · Hobble Hex 50 ·
Impale 50 · Crystal Armour 48 · Enfeeble 48 · Fissure 48 · Whiplash 48 · Corrosive Soak 47 · Dark Seal 45 ·
Meditate 45 · Implode 42 · Nibble 38 · Cleansing Water 33 · Brace 31.

A team with any fourth move has an edge over one with three, and a move with a race gets the race
bonuses the core moves don't, so about 55 to 60 is "an ordinary move". The utility moves are
under-rated here: the AI plays them poorly.
