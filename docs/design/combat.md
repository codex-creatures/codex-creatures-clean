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
- ✅ **Who used what:** while a round plays out, the line above the moves says "Moss Wolf used
  Gore" ("Foe's …" for theirs) in place of the energy bar.
- ✅ **Precise hits:** 5% chance, ignoring 25% of defence, and 1.75× damage (`PRECISE_DAMAGE`, the user, 2026-10-24; a brief try at 75% ignored instead was reverted).
- **The armour gap was removed** (the user, 2026-10-25): repeating a move no longer raises the
  precise chance or cracks armour. The Perfectionist soul stone is the only thing that rewards
  repeating a move now. (Tank-vs-tank stalls can now run to the 100-round draw.)
- ✅ **Stances:** neutral, float, entrench (engine.ts). Float takes −10% from melee and +10% from
  ranged, and deals +10% ranged; Entrench is the mirror image (melee). The stance rules are
  provisional in the original design, and there's no elemental type chart.
- ✅ **Utility moves** (learnable): Cripple (−50% agility for 3 rounds, plus a 25% chance each
  attack is lost), Haste/Quickcast (double agility this round only, 15 power, 60 energy), Precise (70% to hit,
  always precise).
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
  - Erupt (Geo; also Swamp Witch, Mr. Shadows, Ironhide): magic, 25 damage, 70 energy, a 25%
    chance to cripple for 3–5 rounds.
- ✅ **Special moves** (the user's, 2026-10-27; `SPECIAL_MOVES` in creatureData.ts). Each has its
  own codex rarity and a list of the species that can learn it (`learners`; not race-locked:
  the list is the user's pick). Their codexes come from librarians, chests, library rooms and the
  Cyclops (with the race codexes), and from scans at their rarity (Common / Uncommon / Rare pools;
  the Epic one only from the Labyrinth; a librarian charges 500 for it, 200 for the rest).
  - **Dark Seal** (Undead, magic, Rare): 5 damage, 50 energy, 5-round cooldown. The target can't
    swap out for 3 rounds, even if you swap. Dreadpox, Swamp Witch, Mr. Shadows, Flame Imp,
    Dustwraith, Thunderhead.
  - **Meditate** (Neutral, utility, Common): 0 energy, 3-round cooldown, +30 energy on top of the
    usual 30. Anyone, Klutz too.
  - **Healing Blessing** (Divine, utility, Uncommon): 40 energy, 3-round cooldown. Next round,
    after both sides have attacked (the user, 2026-11-01: it mends the hit just taken), whoever is
    on your side of the field heals 60% of its max HP, if it's still standing.
    Thunderhead, Crystal Golem, Veilstalker, Flicker Wisp, Sylvaran.
  - **Corrosive Soak** (Toxic, utility, Rare): 40 energy, no damage. The target's three defences
    drop by 30% of their full value until it leaves the field; no stacking (the user's pick of
    energy, duration and stacking). Bellow Toad, Rotgut Fly, Plague Rat, Glob, Deep Angler,
    Dreadpox, Void Serpent, Hollow Matriarch.
  - **Impale** (Underkin, ranged, Epic): 25 damage, 80 energy; 60% chance the target can't swap
    out for 2 rounds. Deep Angler, Aurelius, Crystal Golem, Skull Raven, Sylvaran, The Pale Rider.
    The old melee Impale (a Rare scan codex) is retired: an old codex of it is now this one, and a
    creature that learned it keeps it only if it's on this list.
  - **Pin Down** (Humanoid, ranged, Rare): 10 damage, 60 energy, 5-round cooldown; the target
    can't swap out for 2 rounds, and 30% of the time a third. Thicket Archer, Aurelius, Skull
    Raven, Sylvaran, Hollow Matriarch, Rotgut Fly.
  - A sealed creature still gets replaced when it's knocked out: a seal only stops swaps.
    The AI knows a sealed creature can't swap out (until 2026-11-12 the simple AI, and the
    thinking AI's look-ahead, could try to, which crashed the fight).
  - **Brace** (Neutral, utility, Rare; the user, 2026-11-03): 50 energy, always goes first; the next
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
    have out, 20% to each creature that comes in (a swap at once; a replacement as the next round
    starts); the 3rd comer sets off a 25-power magic hit with the caster's stats, and the pool is
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
- ✅ **Consumables from scans** (decided 2026-10-19) roll Common : Uncommon : Rare at 40 : 30 : 20. Common is a Common
  codex or a Lesser Potion, half each (`BASIC_CODEX_SHARE`). Uncommon is a learnable codex or an
  Uncommon special. Rare is a Rare codex or a Healing Potion, half each (`STRONG_CODEX_SHARE`). The
  Healing Potion is Rare everywhere now (it was Uncommon). ⚠️ Since the cut (decision 40) the only
  Common codex is Meditate, so half of Common consumables are Meditate until new Common moves are added.
- Dropped for now (2026-10-19): the **Codex of Stances** (Aerial Assault, Dig In), once a planned
  Cyclops reward. (Meditate is now a special move.)
- ✅ **Thinking AI** (Monte Carlo) with Easy / Normal / Hard.
- ✅ **Enemies' moves** (`enemyMoves`, `ENEMY_MOVE_LEVELS` in lib/dungeon/run.ts): its core moves,
  as yours (and now and then a rare cripple move it was born with). From Lv 5 a hybrid's empty
  fourth slot holds its second style's heavy move. (Until 2026-11-12 foes drew more of their race
  kits as they levelled; the kits are retired, so foes no longer change with level beyond that.)
  🧪 The level is Claude's draft. A creature Klutz catches keeps the moves it fought with.
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
  chart counts only for codex moves (the guided first fight's thief is Humanoid, and Klutz's tour
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
  moves, and the Baby Cyclops thief's race is one those moves are effective against (`thiefRace`: since
  2026-11-12, one its own race beats, as its core moves land as it; Humanoid if none). Klutz names its race and has you hit it with that move (it glows), then
  points you to the ▲▼ race chart (it glows) and lets you finish it. Sim: 3–8 rounds (about 6), never a loss.
  Bosses (the Cyclops, the Hydra, the Warden's pack) have no race, so no party is hard-countered.
- ✅ **UI:** moves show their race; tablets are cut in their race's stone with a big style icon
  (impact / arrow / bolt). Cards show race squares under the sprite (not the style); creature
  windows and name plates show races spelled out. A hit says **EFFECTIVE!** or **RESISTED**. A move's
  (i) says how its race lands; no hint on the tile. The Bestiary's "How fights work" has the race
  chart and a calculator; Labyrinth fights have a race chart button (▲▼).
- ✅ **Style colours in a fight** (the user, 2026-10-30; `STYLE_COLOR` in components/BattleScreen.tsx):
  as a move is used, its name in the dock's line ("Foe's Moss Wolf used Gore") and the damage it
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

- **Rarity:** Common: Whiplash, Nibble, Crystal Armour, Poison Dart, Headbutt, Slap. Uncommon:
  Nullifying Voice, Vampiric Bite, Bone Javelin, Caltrops, Cleansing Water, Ambush, Soul Snatch,
  Bolas Shot, Enfeeble, Razor Arrows. Rare: Smoke Bomb, Obsidian Arrows, Septic Shock, Smite, Mega
  Smash, Emulate, Voltage Surge, Flame Body, Haemorrhage. Epic: Haunting Scream, Choking Smog,
  Implode, Fissure. (A Legendary codex tier was floated for Choking Smog and Blood Sacrifice: ❓ open.)
- **Clouds** (`GroundEffect` "cloud", lib/combat/battle.ts): Choking Smog, Implode and the Hydra's
  breath. Whoever stands in one is poisoned (10% a round for Smog and Implode), and keeps it 1–3
  rounds after it leaves or the cloud clears; the Hydra's poisons only as a creature comes in, for 20
  rounds. Toxic creatures and warded ones (Crystal Armour) aren't touched. Clouds don't stack (a new
  one replaces the old). Blood under a cloud (a Blood Sacrifice pool, Haemorrhage's) is soaked up: the
  blood goes and the cloud is 50% stronger. Cleansing Water washes the cloud under your team away,
  Flame Body burns only your own team's, Emulate burns the one under the target (and hits double).
- **Poison** keeps whichever has the most left (dose × rounds); a new one never shortens it.
- **Bleed** (Obsidian, Razor Arrows): until it leaves the field; Undead don't bleed. **Weaken**
  (Nullifying Voice, Haunting Scream's fallback): an attack style, or all, down. **Ward** (Crystal
  Armour): clears its statuses, then none stick (cripple, poison, venom, bleed, seal, weaken, soak,
  fear) for 3 rounds. **Haunting Scream:** 70% the target flees for a random teammate, who doesn't
  act that round. **Smoke Bomb:** after its hit it swaps to its best matchup (in the game the player
  will pick: 🧪 for now it's chosen for you). **Mega Smash** winds up (paying 50), then can only
  strike or swap; the strike is free and still regains 30. **Fissure** hits every foe on the field
  (like Barrage). **Implode** goes last; if it acts, the user falls.
- **Smite and Ambush** were retired kit moves' names: an old one in a save is wiped once
  (`wipeReusedNames`, `codexSet`), its slot getting its next core move; the names are the new moves'.
- 🧪 Round 2 (core moves neutral): Healing Blessing +21, Rabid Bite +13 at 50 energy (+8 at 70),
  Obsidian Arrows +10, Implode +7; Choking Smog as first drafted +35 (the user's foe-only version is
  built, not yet simmed). Cripple is weak (Cripple 0, Bolas +3, Enfeeble −2): ❓ options with the user.

### Planned

- 📌 More effects: vampirism, curse/blind, fear (blocks swapping). More moves from encounters,
  drops or daily quests.
- ❓ Making agility do more (e.g. a dodge chance): mentioned, needs the user's decision.
