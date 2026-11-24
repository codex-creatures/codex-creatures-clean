# Combat

Authoritative for the battle rules, moves, codexes, races (Combat V2) and planned effects. Part of the [game design index](../design.md); status tags (✅ 📌 🧪 ❓ ⏸ ✗) are explained in [docs/README.md](../README.md#status-tags). **The code is the truth for numbers:** if this file and a constant disagree, trust the code and fix this file.

Moved here word for word from design.md on 2026-11-09 (the original is in [archive/2026-11-09](../archive/2026-11-09/design.md)); section numbers are kept, so references like "design.md §N" still find their place.

## 6. Combat

### The rules (lib/combat)

- ✅ **Format:** teams of 3, one active creature each side. Swapping uses your turn and resolves
  before attacks, so the incoming creature takes the hit. The creature swapped out recovers 50% of
  its *missing* energy (`SWAP_ENERGY_RESTORE`).
- ✅ **Agility only decides who strikes first.** This threshold behaviour is intended: players
  judge how much to invest. Don't "fix" it.
- ✅ **Races, not the triangle** (Combat V2, below). The old class triangle (melee > ranged > magic,
  ±50%) and damage types are off; their code stays, for the sims.
- ✅ **Damage:** ratio formula, hit² / (hit + defence), so a bad matchup still chips (the user wants
  Pokémon-style chip damage, never ~0). A move's style (melee, ranged, magic) picks the attack and
  defence stats; then the race multipliers apply.
- ✅ **Hard counters are intended:** a counter means much less damage and a reason to swap, not
  invulnerability.
- ✅ **Energy:** max 100, +30 after each attack, so energy never falls below 30 once it has attacked.
- ✅ **No resting** (the user, 2026-10-26): every set of moves keeps at least one **steady move**
  (30 energy or less, no cooldown: `isSteadyMove`, `STEADY_MAX_ENERGY`), so a creature can always
  attack. The Moves tab and the codex "forget which?" won't give up the last one; a set saved
  without one gets its first steady move back in the last slot (`resolveMoves`). The Rest button
  is gone (the engine's "pass" stays as a safety net: with nothing affordable, a creature rests by itself).
- ✅ **Who used what:** as each move is used, a note across the top of the stage says "Moss Wolf used
  Gore" ("Foe's …" for theirs), like the Labyrinth's notes, and stays 4 s (`MOVE_NOTE_MS`; the next move
  replaces it; the user, 2026-11-20: it was in the dock's line, gone with its step).
- ✅ **Precise hits:** 5% chance, ignoring 25% of defence, and 1.75× damage (`PRECISE_DAMAGE`, the user, 2026-10-24; a brief try at 75% ignored instead was reverted).
- **The armour gap was removed** (the user, 2026-10-25): repeating a move no longer raises the
  precise chance or cracks armour. The Perfectionist soul stone is the only thing that rewards
  repeating a move now. (Tank-vs-tank stalls can now run to the 100-round draw.)
- ✅ **Stances:** neutral, float, entrench (engine.ts). Float takes −10% from melee and +10% from
  ranged, and deals +10% ranged; Entrench is the mirror image (melee). The stance rules are
  provisional in the original design, and there's no elemental type chart.
- ✅ **Cripple** (the user, 2026-11-13; was 3 rounds and a 25% stumble): −50% agility for 3–5 rounds
  (`CRIPPLE_ROUNDS`–`CRIPPLE_ROUNDS_MAX`, or the move's own range: Enfeeble and the Cyclops's Stomp 3),
  and a 50% chance each attack is lost (`CRIPPLE.stumble`, for every cripple, Stomp's too), 10 points less each time
  it has stumbled while crippled: 50%, 40%, 30%, 20%, 10%, then no more, back to 50% once the cripple ends
  (`CRIPPLE.drop`, `stumbleChance`; the user, 2026-11-21).
- ✅ **Learnable moves:** Cripple, Crippling Shot, Hobble Hex (15 power, 60 energy, a 50% chance to
  cripple). (Haste/Quickcast and the precise moves were retired 2026-11-12.)
- ✅ **Race moves:** single-use codexes, learnable by that race (either of a creature's two), plus
  the species the user named (`alsoLearners`), minus any left out (`notLearners`) (the user,
  2026-10-31). The codex window no longer says who can learn it: tapping one greys out the rest.
  - Pounce (Beast; also Void Serpent, Deep Angler, Veilstalker, Cave Goblin; not Ironhide).
  - Rabid Bite (70 energy since 2026-11-12, was 50; Beast, Underkin and Toxic: `learnRaces`; it hits as Toxic; venom ticks even on
    the bench; Toxic creatures are immune).
  - Mirage (Divine; also Dust Sprite, Dustwraith, Swamp Witch, Mr. Shadows, Dreadpox, Thunderhead,
    Pale Rider, Skull Raven).
  - Corpsify (Undead; also Hollow Matriarch, Plague Rat; Dreadpox is already Undead).
  - Barrage (Humanoid, hits every enemy; also Rotgut Fly, The Watcher, Thunderhead, Skull Raven,
    Hollow Matriarch; Leafblade Scout, Aurelius and Sylvaran are already Humanoid).
  - Erupt (Geo; also Swamp Witch, Mr. Shadows, Ironhide): magic, 25 damage, 60 energy (70 until the
    2026-11-25 retune), a 25% chance to cripple for 3–5 rounds.
- ✅ **Special moves** (the user's, 2026-10-27; `SPECIAL_MOVES` in creatureData.ts). Since 2026-11-13 each
  lands as its own race (`raceOfMove` reads `race`; before, they landed neutral). Each has its
  own codex rarity and a list of the species that can learn it (`learners`; not race-locked:
  the list is the user's pick). Their codexes come from librarians, chests, library rooms and the
  Cyclops (with the race codexes), and from scans at their rarity (Common / Uncommon / Rare pools;
  the Epic one only from the Labyrinth; a librarian charges 500 for it, 200 for the rest).
  - **Dark Seal** (Undead, magic, Rare): 5 damage, 50 energy, 5-round cooldown. The target can't
    swap out for 3 rounds, even if you swap. Dreadpox, Swamp Witch, Mr. Shadows, Flame Imp,
    Dustwraith, Thunderhead.
  - **Meditate** (Neutral, utility, Common): 0 energy, 3-round cooldown, +30 energy on top of the
    usual 30. Anyone, Klutz too.
  - **Healing Blessing** (Divine, utility, Uncommon): 50 energy, 5-round cooldown. Next round,
    after both sides have attacked (the user, 2026-11-01: it mends the hit just taken), whoever is
    on your side of the field heals 30% of its max HP, if it's still standing. (60% every 3 rounds
    for 40 energy until the 2026-11-25 retune: it won 88% of mirror fights as an Uncommon.)
    Thunderhead, Crystal Golem, Veilstalker, Flicker Wisp, Sylvaran.
  - **Corrosive Soak** (Toxic, utility, Rare): 40 energy, no damage. The target's three defences
    drop by 30% of their full value until it leaves the field; no stacking (the user's pick of
    energy, duration and stacking). Bellow Toad, Rotgut Fly, Plague Rat, Glob, Deep Angler,
    Dreadpox, Void Serpent, Hollow Matriarch.
  - **Impale** (Underkin, ranged, Epic): 25 damage, 60 energy (80 until 2026-11-25); 60% chance the target can't swap
    out for 2 rounds. Deep Angler, Aurelius, Crystal Golem, Skull Raven, Sylvaran, The Pale Rider.
    The old melee Impale (a Rare scan codex) is retired: an old codex of it is now this one, and a
    creature that learned it keeps it only if it's on this list.
  - **Pin Down** (Humanoid, ranged, Rare): 10 damage, 60 energy, 5-round cooldown; the target
    can't swap out for 2 rounds, and 30% of the time a third. Thicket Archer, Aurelius, Skull
    Raven, Sylvaran, Hollow Matriarch, Rotgut Fly.
  - A sealed creature still gets replaced when it's knocked out: a seal only stops swaps.
    The AI knows a sealed creature can't swap out (until 2026-11-12 the simple AI, and the
    thinking AI's look-ahead, could try to, which crashed the fight).
  - **Brace** (Neutral, utility, Rare; the user, 2026-11-03): 40 energy (50 until 2026-11-25), always goes first; the next
    attack that lands on it this round does 90% less (at least 1). Anyone, Klutz too. 🧪 Claude's
    reading: it lasts that round only, and covers one hit (a barrage's second target isn't it).
  - **Divine Strength / Arcane Channel / Sureshot Blessing** (Divine, utility, Epic; the user,
    2026-11-03; strong on purpose: that turn does no damage, and it's best cast for free when your
    swap-in forces theirs out): 50 energy, 5-round cooldown, +50% melee / magic / ranged attack *stat* (`Fighter.boost`)
    until it leaves the field; doesn't stack. Learners: every creature whose archetype fights in
    that style, hybrids included (`learnStyles`, `stylesOf`); not Klutz. With typical gear that's
    about +45% damage (Common) to +58% (Legendary), as the damage formula squares the hit.
  - **Blood Sacrifice** (Undead, magic, Epic; the user, 2026-11-03): 70 energy, no damage; Dark
    Seal's learners. The caster pays 25% of its max HP, which can knock it out (the user, 2026-11-03). A **blood pool** lies
    under the foes (a *ground effect*, below): 5% max HP at the end of each round to whoever they
    have out, 20% to each creature that comes in, at once, a swap or a replacement (the user, 2026-11-20:
    replacements waited for the next round; caltrops the same; a poison cloud is breathed in at once
    and does its harm round by round; knocked out stepping in, another's sent in); the 3rd comer sets off a 25-power magic hit with the caster's stats, and the pool is
    gone. Whoever the caster's side has out heals 50% of all of it. Undead are untouched, and one
    coming in doesn't count. 🧪 Claude's picks: it's Undead-race (for the burst's race multiplier);
    casting it again replaces the pool (the count restarts). (Both confirmed by the user.)
- ✅ **Toxic creatures can't be poisoned** (the user, 2026-11-03; `poisonImmune`): no venom (Rabid
  Bite), no Toxic Skin poison, no Hydra cloud. Illness (the witch) isn't poison.
- ✅ **Ground effects** (2026-11-03; `BattleSide.ground`, components/GroundEffects.tsx): things lying
  under a side's field, drawn on the floor under it (the blood pool: a rippling pool with a drop per
  comer, lit as each is hit). Only blood so far. 📌 The user's direction (theorycraft, not decided):
  more of them, interacting, e.g. igniting a poison cloud (extra damage, burns the poison off),
  poison moves hitting harder on creatures standing in blood.
- ✅ **Move codexes:** since 2026-11-12 (decision 40) only moves that do something come as codexes:
  the race moves, the special moves and the three cripple moves. The plain moves don't (every
  creature knows its core moves). Every codex says who can read it ("Beast + 4 more",
  `codexLearners`) at the librarian, in the loot window and on the bookcase, and every move has a
  description (one without its own just says "A plain melee hit.": the user, 2026-10-27, doesn't
  want moves spelling out what they're strong against; the race chart is for that). A codex of a
  retired move (in a save, a run or a librarian's offer) becomes a codex of the same rarity
  (`retiredCodexMove`, seeded by its id: the same one every time).
- ✅ **A codex at a glance** (the user, 2026-11-13; components/CodexMove.tsx): its tablet, then three
  fixed lines: style and race; power (or "No damage"), energy and cooldown; its ability in a word or two
  (`abilityOf`, lib/creatures/moveAbility.ts: Venom, Bleed, Poison cloud…). Its "?" opens the full move
  card (MoveCard: "Power", not "Damage") and who can learn it. Shown on the bookcase, in the creature
  window, the loot window and at the librarian (whose own "?" it replaced). ⚠️ The bookcase still doesn't
  show who can read a codex before you tap Teach (the snapshot's "?" does).
- ✅ **Consumables from scans** (decided 2026-10-19) roll Common : Uncommon : Rare at 40 : 30 : 20. Common is a Common
  codex or a Lesser Potion, half each (`BASIC_CODEX_SHARE`). Uncommon is a learnable codex or an
  Uncommon special. Rare is a Rare codex or a Healing Potion, half each (`STRONG_CODEX_SHARE`). The
  Healing Potion is Rare everywhere now (it was Uncommon). ⚠️ Since the cut (decision 40) the only
  Common codex is Meditate, so half of Common consumables are Meditate until new Common moves are added.
- Dropped for now (2026-10-19): the **Codex of Stances** (Aerial Assault, Dig In), once a planned
  Cyclops reward. (Meditate is now a special move.)
- ✅ **Thinking AI** (Monte Carlo) with Easy / Normal / Hard. Since 2026-11-24 (the user, after his seven ranked wins:
  the rivals swapped onto his caltrops all match) three nudges lie over the lookahead, each scaled by a random
  ±50% so it misjudges now and then "to be more human-like": a voluntary swap costs the entry damage of what lies
  under its field (`entryCost`); a debuff is worth more when the foe looks about to swap (hurt, or swapped in the
  last two rounds: `foeSwapChance`), since it sticks to whoever comes in; laying a hazard is worth more while the
  foe has creatures benched. Hard plays 48 futures an option (was 32: too few to tell a hazard's cost from the
  noise). Numbers: `HAZARD_SWAP_WEIGHT`, `DEBUFF_BONUS`, `HAZARD_LAY_BONUS`, `NUDGE_JITTER` in lib/combat/thinkingAi.ts 🧪.
- ✅ **Enemies' moves** (`enemyMoves`, `ENEMY_MOVE_LEVELS` in lib/dungeon/run.ts): its core moves,
  as yours (and now and then a rare cripple move it was born with). From Lv 5 a hybrid's empty
  fourth slot holds its second style's heavy move. (Until 2026-11-12 foes drew more of their race
  kits as they levelled; the kits are retired, so foes no longer change with level beyond that.)
  🧪 The level is Claude's draft. A creature Klutz catches keeps the moves it fought with.
- ✅ **Foes' codex moves** (the user, 2026-11-13, decision 43; `foeCodexes`, `FOE_CODEX` in
  lib/dungeon/run.ts): from the Labyrinth on, every foe carries a codex move of its own race in its
  fourth slot, if it can learn one at the dungeon's rarity (the Labyrinth up to Uncommon, the Deep
  Labyrinth up to Rare, the Abyss up to Epic; rarer ones rarer, by the item weights). Some also carry
  one of another race, in place of their first-strike move (🧪 a third, half, two thirds), which the
  AI thinks of only half the time (`OFF_RACE_USE`) so foes don't play too sharply. Never Healing
  Blessing or Blood Sacrifice; at most one Choking Smog a room. None in the Encampment. Foes play
  their race move where it lands well and a core move where it's resisted, so you can read them
  (their moves aren't shown). Picks are seeded by the foe's own rolls. ⚠️ Divine and Geo have no
  codex at Common or Uncommon yet, so their Labyrinth foes carry none of their own race (the user
  adds three Uncommon moves, Beast, Divine and Geo, later; the Beast cripple fills Beast's gap for now).
- 🧪 Balance in general: the user tunes by playing, and fights against the AI (the balance lab, /simulator and the sim scripts went 2026-11-04). Their
  goals: rarity raises the ceiling but a Legendary must not always win; well-fitted, well-rolled
  gear should beat raw rarity within a band; good play should matter more than it does now.
  Present changes to creature stats or move numbers as options. Don't apply them unasked.

### Combat V2: races (✅ live since 2026-10-26)

How it came about, round by round: history.md.

- ✅ **Live rules** (`LIVE_RULES`, `setCombatRules` in engine.ts): races on (each move's own race),
  triangle off (`TRIANGLE_RULES` kept for tests), damage types off (`damageTypes: false`: Force /
  Pierce / Arcane are gone; a move is just its style and race). **Magic stays** as a third style.
- ✅ **7 races:** Undead, Divine, Beast, Underkin, Geo (elemental, not just stone), Humanoid, Toxic
  (was Pestilence; id `toxic`). Creatures have 1 or 2 (`SPECIES_RACES`, lib/creatures/racesV2.ts;
  the user's race pass is in; the user is fine with lopsided races). Colours (`RACE_INFO`): Undead
  bone grey, Divine light gold, Beast green, Underkin brown, Geo red, Humanoid blue, Toxic purple;
  **Neutral** (no race) slate grey (in code still `BALANCED_INFO` / `BALANCED_MOVES`).
- 🧪 **Multipliers 1.25× effective / 0.8× resisted** (`RACE_EFFECT`; dual races multiply), plus
  1.15× for a move of the creature's own race, once (`MATCH_BONUS`). The user picked these over
  1.4× / 0.75× (2026-10-26): the race edge drops from 74% to 68% of even duels, and gear a rarity
  better can make up for a bad matchup. The chart (`RACE_BEATS`, lib/combat/raceChart.ts) is Claude's
  rebalance of the user's draft: each race beats 3 and is weak to 3, with 4 mutual pairs.
- ✅ **35 creatures** (`CREATURE_TEMPLATES`, `ROSTER_V2` in rosterV2.ts), one per rarity per race;
  the older 25 as they were are `PRE_V2_SPECIES`, for tests of battle mechanics. V2 style changes
  are `V2_RESTYLE` (main % moved to the new style, total unchanged). The Cave Bat is now the **Cave
  Goblin** (same id `cave_bat`). The Deep Angler is a melee Battlemage. The Deep Angler, Rotgut Fly
  and Dust Sprite PNGs are mirrored.
- ✅ **The user's restyles (2026-10-27,** `RESTYLED_SPECIES`**):** Cave Goblin melee (Bruiser), Dust
  Sprite magic (Arcanist), Amber Wasp melee (Bruiser) and Beast / Toxic, Crystal Golem melee +
  magic (Battlemage), Tunnel Wyrm melee (Bulwark), Thunderhead magic + melee (Battlemage). 🧪 Their
  new %s are Claude's: each one's attack %s add up to the same as before, moved to the new style
  (hybrids split; Crystal Golem atk 20 / mag 14, Thunderhead mag 44 / atk 38). Ones players already
  own move over once on load (`upgradeStyle`, `styleSet`): defence and agility rolls stay, the
  roll's attack gain or loss goes on the new main style, and they go back to their new starting
  moves (codex moves of the old style no longer fit).
- ✅ **Archetypes** (`ARCHETYPE_INFO`, Claude's draft, approved): Bruiser, Bulwark (melee tank),
  Sniper, Skirmisher, Arcanist, Warden (magic tank), and hybrids Ranger (melee + ranged), Battlemage
  (melee + magic), Spellbow (ranged + magic). An archetype decides which style kits a creature draws
  from. Since the restyles: 6 Bruisers, 5 Bulwarks, 5 Arcanists, 7 Battlemages, 4 Rangers, and 2
  each of Sniper, Skirmisher, Warden and Spellbow.
- ✅ **Core moves** (the user, 2026-11-12, decision 40; lib/creatures/raceKitsV2.ts `CORE_MOVES`):
  every creature knows 3 moves in each style it fights in (a hybrid: both styles', 6):

  | | Melee | Ranged | Magic |
  |---|---|---|---|
  | Light (10 dmg, 20⚡) | Strike | Shot | Zap |
  | Heavy (25 dmg, 50⚡) | Smash | Power Shot | Blast |
  | First (15 dmg, 50⚡, always first) | Rush | Quickshot | Blink |

  ✅ **Since 2026-11-12 (decision 41) they're neutral:** no race and no own-race bonus, so the race
  chart counts only for codex moves (a starter has its own race move for the guided first fight, and Klutz's tour
  and the Bestiary say so). Until then: each landed as its creature's **main race** (`asRace`, its first
  race), with the match bonus, so the race chart decides every hit. Klutz knows all 9 and lands
  neutral. Two first-strike moves in one round: the faster goes first. 🧪 The heavy names are
  Claude's placeholders. Everything else comes from codexes; the user adds new moves next.
- ✅ **Retired 2026-11-12:** the race kits (84 moves: a 30 and 50 energy move, a quick attack and a
  precise move per race and style), the 24 older plain moves (Slash, Fireball…) and the dash and
  precise learnables (6). A saved creature that knows one has it replaced by its **closest core
  move** (light for up to 20 damage or precise, heavy above, first-strike for quick and dash; if it
  already has that one, the next core move it doesn't, so it keeps as many moves: `replaceRetired`,
  `RETIRED_MOVES`), once, when the save loads; retired ones it learned from codexes are dropped.
  Their codexes become others of the same rarity. The older moves stay in the code for the old
  species in tests (`PRE_V2_SPECIES`). The old haste spell Blink was renamed **Quickcast** (now retired).
- ✅ **Starting moves** (`STARTING_MOVES`): every creature is born with its main style's 3 core moves
  (light, heavy, first). The fourth slot needs a codex. Klutz starts with 4 (Strike, Smash, Rush, Shot).
  Saves from before 2026-10-26 went back to their 3 once (`upgradeMoveSet`, `moveSet` = 2).
- 🧪 Sim (2026-11-12, one-on-one at Lv 15, no gear, starting moves, 4,200 fights): fights went from
  7.1 rounds to 5.2 (the heavy move is now a starting move, and every hit gets the match bonus);
  6.1 with no match bonus. The side whose race beats the other's wins about 94% (97% before).
- ✅ **Guided first fight** teaches races (the user, 2026-10-31): your creature fights with its own
  moves against the Baby Cyclops thief, who has **no race** (the user, 2026-11-20: "he is neutral"; until then he
  took a race your moves beat, `thiefRace`, now gone). The lesson is your creature's own race: Klutz
  names it, says its own race's moves hit harder from it (the match bonus), and has you hit the thief with the one it
  knows (every starter has one, `STARTER_RACE_MOVE`, creatures.md; it glows), then says "see? extra damage" and lets
  you carry on. What beats what (the race chart) is for later. It can't knock you out, but it's a long fight
  (the user, 2026-11-20: "put up a bit of a fight… 1 or 2 potions"): `THIEF_HP_MULT` 5.5 🧪, about 15 rounds, and about
  150% of your health in hits, so Klutz hands you two Lesser Potions as you go in (`TUTORIAL_POTIONS`, topped up to two)
  and, below 40% health (`TUTORIAL_DRINK_AT`), tells you to drink one, the Bag button glowing. Never a loss.
  Bosses (the Cyclops, the Hydra, the Warden's pack) have no race, so no party is hard-countered.
- ✅ **UI:** moves show their race; tablets are cut in their race's stone with a big style icon
  (impact / arrow / bolt). Cards show race squares under the sprite (not the style); creature
  windows and name plates show races spelled out. A hit says **EFFECTIVE!** or **RESISTED**. A move's
  (i) says how its race lands; no hint on the tile. The Bestiary's "How fights work" has the race
  chart and a calculator; Labyrinth fights have a race chart button (▲▼).
- ✅ **Style colours in a fight** (the user, 2026-10-30; `STYLE_COLOR` in components/BattleScreen.tsx):
  as a move is used, its name in the note at the top ("Foe's Moss Wolf used Gore") and the damage it
  does are in its style's colour: red melee, green ranged, blue magic (a precise or crippling hit's
  number keeps its own colour). Under the damage: EFFECTIVE! / RESISTED for its race, WEAK SPOT! for a
  boss's weak spot.
- 🧪 Soul stone pools for the six new Rare+ creatures are Claude's drafts.
- 🧪 Sim of the live roster (2026-10-26): spread within a rarity 3.3 (was 6.3); the race edge wins
  72% of even duels; swapping no longer pays (50%).
- ❓ `MOVE_RACES` gives the cripple moves draft races (Cripple Beast, Crippling Shot Humanoid,
  Hobble Hex Toxic). Race move rules beyond the core moves are open.

### The 2026-11 codex moves (decision 41)

✅ Built 2026-11-13. The user's 29 moves (names and what they do); Claude's numbers and learners, by
race and by how the creature looks (not race-locked), in `lib/creatures/codexMoves.ts`; they're
special moves, so their codexes come from scans, chests and librarians by rarity. Each lands as its
own race (`asRace`) and gets the own-race bonus for a creature of that race. 🧪 Numbers are Claude's,
from two sim rounds (3v3, Lv 5–30, Normal AI; the reports were published pages): most move a fight
by −3 to +5 points of win rate. Big hits use a damage multiplier (`mult`), not big power, because
power counts for less as attack grows.

- ✅ **The user's v2 codex review** (2026-11-16, the spreadsheet `codex-creatures-review v2.xlsx`):
  who can read each codex is now the user's list, for every codex but the three anyone can read
  (Cripple, Crippling Shot, Hobble Hex), Meditate and Brace: `learners` on each move, race codexes
  too (`raceMovesFor`). The Divine blessings (Divine Strength, Arcane Channel, Sureshot Blessing)
  are for anyone now, not by style. Races: Dark Seal lands Divine (was Undead; Undead again since 2026-11-20, the user), Impale Geo (was
  Underkin), Caltrops Humanoid (was neutral), Hobble Hex neutral (was Toxic). Mirage lasts 5 rounds
  (was 3). A creature that loses a codex move it had learned can no longer use it.
- **Rarity:** Common: Whiplash, Nibble, Crystal Armour, Poison Dart, Headbutt, Slap, Cleansing
  Water, Rock Toss (the user, 2026-11-20: Underkin's basic hit, ranged, 10 power (8 until 2026-11-25), 20 energy, no effect; learned by
  the Underkin creatures; the name is Claude's). Uncommon too: Blessed Bolt (the user, 2026-11-20: Divine's basic hit, ranged, 30 energy; 15
  power 🧪; learned by the Divine creatures). Nibble: +10% each time in a row, up to 10 times (+100%; the
  user, 2026-11-20; it was 5, +50%). A move with no damage (Caltrops, Crystal Armour…) shows as Utility
  everywhere, never by the style it's filed under (`isUtility`; Caltrops showed as Magic). Uncommon: Nullifying Voice, Vampiric Bite, Ambush, Bolas Shot, Enfeeble, Razor
  Arrows. Rare: Smoke Bomb, Obsidian Arrows, Septic Shock, Mega Smash, Emulate, Voltage Surge, Flame
  Body, Haemorrhage, Soul Snatch, Bone Javelin, Force Push. Epic: Smite, Implode, Fissure, Caltrops (Uncommon until 2026-11-24; the user, after
  watching the ranked rivals walk onto them every swap: they last the whole fight and had no answer). ✅ Legendary (the v2
  review): Choking Smog, Haunting Scream. Legendary codexes cost 2,500 gold at a librarian
  (`codexPrice`), come from a library's bookcases 1 in 100 (`CODEX_ODDS`) and the other places
  every codex does, and are never on foes (no dungeon goes past Epic). The Choking Smog codexes
  found while it was Epic were taken back on load (the user, 2026-11-16; `dropTakenBack` in
  lib/save.ts); creatures that had already learned it keep it.
- **Clouds** (`GroundEffect` "cloud", lib/combat/battle.ts): Choking Smog, Implode and the Hydra's
  breath. Whoever stands in one is poisoned (10% a round for Smog and Implode), and keeps it 1–3
  rounds after it leaves or the cloud clears; the Hydra's poisons only as a creature comes in, for 20
  rounds. Toxic creatures and warded ones (Crystal Armour) aren't touched. Clouds don't stack (a new
  one replaces the old). Blood under a cloud (a Blood Sacrifice pool, Haemorrhage's) is soaked up: the
  blood goes and the cloud is 50% stronger. Cleansing Water washes the cloud under your team away,
  Flame Body burns only your own team's, Emulate burns the one under the target: it hits double, and the cloud goes up in flames for one more tick of it, as fire (so Toxic creatures take it too; the user, 2026-11-13).
- ✅ **Caltrops and Force Push** (the user, 2026-11-24): caltrops lie under the foes for the rest of the fight (10% of max
  HP from each creature that comes in), and nothing but Force Push moves them: a Rare Geo codex (magic, 5 power, 40
  energy since 2026-11-25, 60 before; learned by the Geo and the magic-looking creatures) that hits, shoves the caltrops and any cloud off your
  side (blood and gore stay), and hurls the caltrops at the target for 10% of its max HP, past armour. Without
  caltrops under you it's just the small hit. ✅ (the user, 2026-11-24) Caltrops hurt the Cyclops's hands as they
  tear free (each steps in for 10%), but never its Eye, which floats (`bossOnFoot`, bossAi.ts); the Hydra's heads and
  the Minotaur never come in after the start.
- ✅ **A creature knows only the moves in its slots** (the user, 2026-11-24: "moves a creature used to know should
  be removed"; option 1). Its Moves tab is the 4 slots and nothing else: no list of other moves to swap in. Reading
  a codex puts the move in a free slot, or in place of one you pick (and confirm), and the move it replaces is gone
  for good; codex moves are tagged in their slots. A save from before kept its born moves and every codex move
  beside its chosen slots: on load those are cut to the slots (`pruneMoves`, lib/creatures/instance.ts; `learned`
  becomes the slot moves that came from codexes). Klutz the same. Ascension carries the codex moves still in its slots.
- **Poison** keeps whichever has the most left (dose × rounds); a new one never shortens it.
- **Bleed** (Obsidian, Razor Arrows): until it leaves the field; Undead don't bleed. Since the
  2026-11-25 retune Obsidian Arrows is the sure slow bleed (always, 6% a round; was 10%) and Razor
  Arrows the gamble (25%, 10% a round; was 50%). **Weaken**
  (Nullifying Voice, Haunting Scream's fallback): an attack style, or all, down. **Ward** (Crystal
  Armour): clears its statuses, then none stick (cripple, poison, venom, bleed, seal, weaken, soak,
  fear) for 3 rounds. **Haunting Scream:** 70% the target flees for a random teammate, who doesn't
  act that round; otherwise its attacks are halved for 5 rounds (3 until 2026-11-25). **Smoke Bomb:** after its hit it swaps to its best matchup (in the game the player
  will pick: 🧪 for now it's chosen for you). **Mega Smash** winds up (paying 50), then can only
  strike or swap; the strike is free and still regains 30. **Fissure** hits every foe on the field
  (like Barrage). **Implode** goes last; if it acts, the user falls.
- ✅ **The user's third batch** (2026-11-19; moves, learners and rules all the user's, the learners
  ticked on a published page): Common: Flame Spit (ranged, Geo, 20 energy, 5% to burn), Claw (melee,
  Beast, 20, plain). Uncommon: Cursed Claw (melee, Undead, 40; if it strikes first, 10% the target
  is struck with Haunting Presence's fear and loses its attack). Rare: Bounce (melee, Beast; Smoke
  Bomb's 5 power, 40 energy, 3-round cooldown, but not first, and the player picks who comes in:
  `swapTo` on the attack, a "Bounce to…" panel on the battle screen; the AI gets the best matchup).
  Epic: Stalactite (ranged, Underkin, 50 energy and 2× a heavy hit since 2026-11-25 (65 and 1.5× before: it went unused), no cooldown). Legendary: Curse
  (magic, Undead, 60 energy, no hit, 3-round cooldown since 2026-11-25). "Usual damage" is the core moves' half a power per energy.
  🧪 Not simmed yet.
- **Burn** (Flame Spit): like poison, 5% max HP a round for 3–5 rounds, on the bench too, and the
  one with more left stays. Geo are immune. It can sit alongside poison, but not bleed: a burn puts
  out a bleed, and a new bleed puts out a burn (Claude's default for that way round; the user asked
  for burn over bleed). Cleansing Water washes burns off too (Claude's call).
- **Curse:** the target takes a power-6 magic hit (power 10 until 2026-11-25: it won 93% of mirror fights) each round for 2–3 rounds (worked out when cast:
  the caster's attack against its defences, races counted; on the bench too). Each time a cursed
  creature swaps out (any swap: a choice, Smoke Bomb, Bounce, Haunting Scream), 60% it passes the
  curse to a random benched teammate, not the one coming in, which takes it fresh; it keeps its own.
  It never stacks: catching it again restarts the clock. A ward keeps burn, curse and fear off.
- **Smite and Ambush** were retired kit moves' names: an old one in a save is wiped once
  (`wipeReusedNames`, `codexSet`), its slot getting its next core move; the names are the new moves'.
- 🧪 Round 2 (core moves neutral): Healing Blessing +21, Rabid Bite +13 at 50 energy (+8 at 70),
  Obsidian Arrows +10, Implode +7; Choking Smog as first drafted +35 (the user's foe-only version is
  built, not yet simmed). Cripple was weak (Cripple 0, Bolas +3, Enfeeble −2); at a 50% stumble +2 to +4 over 3 rounds, so the user made it 3–5 rounds at 50% (Enfeeble kept to 3, Erupt's chance kept at 25%).

- ✅ **The 2026-11-25 retune** (the user, from the codex move audit in docs/two-styles-sim-2026-11.md: every
  learnable move's facts and a 40-fight mirror sim; a rarity is a band of overall strength, so an Epic should
  beat a Rare, and nothing moves up a rarity: weaken in place, and bloat Rare rather than Epic). Weakened:
  Curse's tick power 10 → 6 and a 3-round cooldown (power alone did little: the tick is mostly the caster's attack);
  Healing Blessing heals 30% every 5 rounds for 50 energy (was 60% every 3 for 40); Obsidian Arrows bleeds
  6% a round (was 10%; still sure); Razor Arrows' bleed chance 50% → 25%; Headbutt's recoil 20% → 35%. Cheaper:
  Stalactite 65 → 50 energy and 1.5× → 2× a heavy hit, Impale 80 → 60, Erupt 70 → 60, Force Push 60 → 40,
  Brace 50 → 40, Cleansing Water 60 → 40, Whiplash 50 → 40, Choking Smog 90 → 75. Up: Rock Toss 8 → 10 power
  (Claw's), Haunting Scream's fallback weaken 3 → 5 rounds. The three cripples stay three separate Uncommon codexes at the same power (the
  user: a core, early mechanic). No codex changed rarity, so the registry's rules stand.

### Planned

- 📌 More effects: vampirism, curse/blind, fear (blocks swapping). More moves from encounters,
  drops or daily quests.
- ❓ Making agility do more (e.g. a dodge chance): mentioned, needs the user's decision.
