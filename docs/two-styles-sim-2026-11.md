# Two attack styles (melee + ranged): the sim, November 2026

A study, not a change (the brief: docs/ideas/two-styles-sim-brief.md; the user's idea, 2026-11-24).
Nothing in the game was touched. The two-style version was built as a transform of today's
species, moves, weapons, armour and bosses inside a throwaway Vitest file (deleted afterwards), and
both rule sets were run through the real engine and AIs (lib/combat). Rows are 40 fights, Normal AI
against Normal, Lv 16 in Rare gear unless said; **a 40-fight row is good to about ±8 points**, so
read differences under 10 as noise. Bosses and the Hard-AI row are 20 fights (±11).

## The short version

**Partly, and not yet in the way the user wants.** The draft below does what decision 1 asks
(every creature fights in both styles, the magic core moves go, each weapon leans one way) without
breaking anything: fights are the same length (hits to knock out 8.8 → 9.1), the race chart's
edge is unchanged (63% → 65%), the Cyclops and Minotaur are as before. But on the three things it
was meant to fix:

1. **Tanks still lose to stacked damage,** and the armour that picks a side pays off *less* than
   today. Against a damage team with one melee hitter and two casters, a tank team in the plate
   matched to the foe's main style wins 35% today and 13% after; in the all-round plate, 15% today
   and **40% after**. Folding magic defence into the all-rounders (Juggernaut 88/88/88 → 132/132)
   gives them a full-size defence on both sides, while the specialist plate's strong side was already
   near what a Rare piece's 100 points can fill, and its weak side stays a hole that the foe's
   melee creature walks through. Even against a team that is *all* one style, the matched plate is no
   better than the all-rounder (18% v 20% today, 8% v 15% after; section 7). Part of the after-world
   drop is a sim fault: the Nullifier's reflect was dead there (see section 1). The root is the damage
   formula: armour defence counts at a third, so the matched plate's 40% more defence takes about a
   tenth off a hit, and a creature's defence % only multiplies armour, so a tank with no armour has
   no defence at all. Two styles don't change that; only the defence maths or a set bonus would.
2. **The casual player's gap doesn't shrink.** The same team in random gear against itself in
   fitted gear wins 0% today and 5% after. The gap is the weapon, not the armour: with a fitted weapon
   and random armour it wins 43% / 55%; with a random weapon and fitted armour, 10% / 10%. A 14/4
   wolf with a bow still does nothing, because off-style weapon ceilings are 25 against 95. Two
   styles don't change that; raising off-style ceilings would (section "Options").
3. **Hybrids are weaker, not stronger.** True 50/50 hybrids against melee specialists: 25% today,
   **3% after**; against the casters (ranged after): 38% → 25%. A 50/50 split in the %s *and* a
   hybrid weapon split 72/80 is a double discount, and the gain (hitting the softer defence) is
   small when the foe wears all-round plate. Hybrids beat tanks (95–98%), but so does everyone:
   the tank teams here win 2–10% against any attacker in both worlds, because Basalt Bulwark tanks
   do no damage.

One thing got easier: **the Hydra** (80% → 95% at Lv 21, err, Epic gear), because its Hex Head is a
second ranged head now and a party's armour covers both heads at once.

What would make it work is in "Options": keep the all-round armours at today's per-style defence,
give hybrids a real both-ways weapon, and raise weapons' off-style ceilings. Those are the user's calls.

## The draft

Everything here is Claude's draft for the sim, for the user to overrule. Attack totals are
unchanged; magic went to the style the creature's magic looked like; nobody keeps a 0 (about a fifth
of the total at the least); magic defence is split half and half into melee and ranged defence
(assumption 2).

### The 35 creatures

Before: melee / ranged / magic % · melee def / ranged def / magic def %. After: melee / ranged · melee def / ranged def.
"Main" is the style it starts with (a 50/50 hybrid starts melee: assumption 4).

| Creature | Before | After | Main | Why |
|---|---|---|---|---|
| Moss Wolf (C) | 16/2/0 · 4/2/3 | 14/4 · 6/3 | melee | bites; a little reach for the leap |
| Amber Wasp (U) | 22/0/0 · 3/3/3 | 17/5 · 5/4 | melee | stings; can spit venom |
| Bellow Toad (R) | 14/12/0 · 10/3/18 | 13/13 · 19/12 | melee | tongue and spit: a true hybrid (a Ranger today) |
| Dire Wolf (E) | 42/4/0 · 12/8/10 | 37/9 · 17/13 | melee | a wolf; the floor for its ranged |
| Ironhide (L) | 52/6/0 · 44/30/37 | 46/12 · 63/48 | melee | a charging beast; a horn toss for ranged |
| Cave Goblin (C) | 18/0/0 · 2/6/4 | 14/4 · 4/8 | melee | a goblin with a knife; throws rocks |
| Rust Beetle (U) | 10/3/0 · 24/12/18 | 10/3 · 33/21 | melee | a tank that bites |
| Crystalback (R) | 6/0/8 · 30/24/30 | 5/9 · 45/39 | ranged | its magic was crystal shards fired: a ranged tank |
| Crystal Golem (E) | 20/0/14 · 32/20/26 | 20/14 · 45/33 | melee | fists first (the user), crystal magic as hurled shards |
| Hollow Matriarch (L) | 40/24/0 · 24/22/23 | 32/32 · 36/33 | melee | fangs and webs, both: a true hybrid |
| Dust Sprite (C) | 2/0/18 · 2/4/6 | 4/16 · 5/7 | ranged | a mote that zaps from afar |
| Flicker Wisp (U) | 4/0/20 · 4/6/8 | 5/19 · 8/10 | ranged | bolts of light |
| Veilstalker (R) | 20/0/16 · 6/6/8 | 20/16 · 10/10 | melee | hex blade in hand, hexes thrown: a melee-leaning hybrid |
| The Watcher (E) | 10/0/42 · 10/16/20 | 11/41 · 20/26 | ranged | a gaze: ranged |
| Void Serpent (L) | 34/0/38 · 20/20/24 | 36/36 · 32/32 | melee | fangs and void bolts: a true hybrid |
| Rattlebones (C) | 16/4/0 · 8/4/6 | 16/4 · 11/7 | melee | a skeleton with a blade; throws a bone |
| Shambler (U) | 18/2/0 · 16/10/13 | 16/4 · 23/16 | melee | a shambling tank that claws |
| Dustwraith (R) | 6/6/14 · 4/8/6 | 6/20 · 7/11 | ranged | hurls the dust it's made of |
| Mr. Shadows (E) | 14/0/24 · 18/14/16 | 19/19 · 26/22 | melee | shadow blade and shadow bolt: a true hybrid |
| Skull Raven (L) | 20/48/0 · 14/24/19 | 20/48 · 24/33 | ranged | as today |
| Thicket Archer (C) | 4/20/0 · 2/4/3 | 5/19 · 4/5 | ranged | an archer |
| Leafblade Scout (U) | 16/12/0 · 4/4/4 | 14/14 · 6/6 | melee | blade and bow: a true hybrid (a Ranger today) |
| Aurelius (R) | 12/22/0 · 16/6/11 | 12/22 · 22/11 | ranged | a centaur archer: as today |
| Swamp Witch (E) | 6/0/46 · 8/14/11 | 11/41 · 14/19 | ranged | hexes and ice lances: ranged |
| Sylvaran (L) | 14/52/0 · 16/24/20 | 14/52 · 26/34 | ranged | as today |
| Gleamling (C) | 2/6/12 · 2/4/6 | 4/16 · 5/7 | ranged | a mote of light that zaps |
| Flame Imp (U) | 4/0/20 · 4/6/8 | 5/19 · 8/10 | ranged | spits blue fire |
| Thunderhead (L) | 38/0/44 · 16/22/24 | 41/41 · 28/34 | melee | hail fists and lightning: a true hybrid |
| Deep Angler (R) | 22/0/16 · 8/10/10 | 30/8 · 13/15 | melee | nothing about it shoots (the user): its lure is a touch spell |
| Tunnel Wyrm (E) | 26/0/0 · 34/24/24 | 21/5 · 46/36 | melee | a melee tank; spits grit |
| Plague Rat (C) | 14/0/0 · 4/4/4 | 11/3 · 6/6 | melee | bites |
| Rotgut Fly (U) | 4/18/0 · 4/6/6 | 5/17 · 7/9 | ranged | spits |
| Glob (R) | 14/0/0 · 26/20/22 | 11/3 · 37/31 | melee | a slime tank; flings slime |
| Dreadpox (E) | 6/0/30 · 22/20/28 | 8/28 · 36/34 | ranged | sends sickness back: a ranged tank |
| The Pale Rider (L) | 40/0/36 · 22/20/24 | 44/32 · 34/32 | melee | scythe first, plague second: a melee-leaning hybrid |

**True 50/50 hybrids** (7): Bellow Toad, Hollow Matriarch, Void Serpent, Mr. Shadows, Leafblade
Scout, Thunderhead, and nearly Veilstalker (20/16). Gear pushes them either way.

### Archetypes

Bruiser, Bulwark, Sniper, Skirmisher and Ranger stay. Arcanist → Sniper (Dust Sprite, Flicker Wisp,
The Watcher, Swamp Witch, Flame Imp). Warden → **Sentinel** (a ranged tank: Crystalback, Dreadpox).
Battlemage → Ranger (Crystal Golem, Veilstalker, Void Serpent, Mr. Shadows, Thunderhead, Pale
Rider), except Deep Angler → Bruiser. Spellbow → Sniper (Gleamling) or Skirmisher (Dustwraith,
agility 32). The type labels (lib/creatures/creatureType.ts) lose Spellcaster and Magic Tank.

### Core moves

Zap, Blast and Blink go. **Every creature knows all six core moves** (Strike, Smash, Rush; Shot,
Power Shot, Quickshot) and starts with its main style's three, as a hybrid does today (assumption 5).
A magic creature's saved Zap / Blast / Blink become Shot / Power Shot / Quickshot.

### Weapons: each one's lean (Rare ceilings, melee / ranged / magic → melee / ranged)

| Weapon | Before | After | Lean |
|---|---|---|---|
| Void Scythe | 75/25/12 | 87/25 | melee at heart |
| Temporal Maul | 95/25/12 | 107/25 | melee |
| Serrated Fan-Blade | 70/25/12 | 82/25 | melee |
| Stormlash Whip | 80/60/12 | 80/72 | melee weapon with reach: its magic goes to ranged |
| Weeping Greatbow | 25/95/12 | 25/107 | ranged |
| Lightning Trident | 60/80/12 | 72/80 | the hybrid weapon: its magic goes to melee |
| Thunderhead Crossbow | 25/75/12 | 25/87 | ranged |
| Soul Storm | 25/12/75 | 25/87 | ranged at heart (a storm of souls) |
| Chaos Orb | 25/12/75 | 25/87 | ranged at heart (the user) |
| Frostspire Staff | 25/12/95 | 88/44 | melee at heart (a staff strikes), a third to ranged |
| Chainbound Aegis | 30/55/12 | 30/67 | the ranged tank's shield |
| Ironfang Guard | 55/30/12 | 67/30 | the melee tank's shield |
| Basalt Bulwark | 35/25/12 | 47/25 | the wall: melee |
| Aether Shield | 30/25/55 | 58/52 | the all-round shield: half and half |
| Klutz's Club | 12 each of 5 | 15 each of 4 | not rolled: the budget split evenly |

The weapons' primaries (lib/items/itemPrimaries.ts, for the sell formula): Soul Storm and Chaos Orb
ranged + HP / agility, Frostspire Staff melee + HP, Aether Shield HP + ranged. The roller
(lib/items/rollItemStats.ts, rollConfig.ts, budgets.ts) is untouched: the budgets and chunk rules
are as they are; only the ceilings' magic share moves.

### Armour: ceilings remapped (Rare, melee def / ranged def / magic def → melee def / ranged def)

| Armour | Before | After | Fold |
|---|---|---|---|
| Frontier's Mail | 110/45/45 | 133/67 | half and half |
| Arrowward Mantle | 34/110/53 | 61/136 | half and half |
| Dragonscale Tunic | 34/45/53 | 61/71 | half and half |
| Colossal Shellarmor | 120/45/40 | 160/45 | all to melee: the heavy anti-melee plate |
| Arcane Nullifier | 45/63/120 | 45/183 | all to ranged: the heavy anti-ranged plate (a new name wanted) |
| Polished Chainbolster | 85/85/85 | 128/127 | half and half |
| Juggernaut Platemail | 88/88/88 | 132/132 | half and half |

Set bonuses: **Nullify** (reflects 25% of magic damage) → reflects 25% of ranged damage; the others
are unchanged. That leaves two anti-ranged sets (Deflect and Nullify) and one anti-melee (Hard
Shell); see assumption 10.

**Enchantments:** Runed (+magic defence) goes; a Runed piece becomes Shielded (+ranged defence).
Ironbound, Shielded, Stalwart, Fleet, Cleansing and Victorious are unchanged.

### Every magic move, filed

Damage moves: **Smite → melee** (a holy blow). Ranged: Soul Snatch, Smoke Bomb, Force Push, Emulate,
Erupt, Dark Seal, Hobble Hex, Voltage Surge (its "+25% magic damage" becomes +25% ranged damage),
Curse (its round-by-round hit), Blood Sacrifice's burst. Bosses' beams: Eye Laser, Laser, Searing
Beam, Hex Bolt, Withering Curse → ranged.

Utility moves do no damage, so their style is only the tablet's mark: Mirage, Healing Blessing,
Corrosive Soak, Brace, Crystal Armour, Cleansing Water, Haunting Scream, Choking Smog, Enfeeble,
Flame Body, Caltrops, Meditate. **Nullifying Voice** (halves the target's magic attack) → halves its
ranged attack. **Arcane Channel** (+50% magic attack) is retired: an owned codex or learned move
becomes Sureshot Blessing (assumption 8).

### Bosses

Cyclops body: melee 28 + magic 22 → melee 28, ranged 22; the Eye's magic 26 → ranged 26 (Eye Laser
and the beams are ranged). Hydra: the Hex Head is a ranged head (38); weak spots Spitter → melee,
Hex → ranged (unchanged), **Fang → ranged** (was magic), so two heads are weak to ranged (assumption
9). Boss armour's magic defence is split half and half. The Minotaur is unchanged.

## Before and after

A wins = the first-named team's wins. Rows of 40 unless said; ±8.

### 1. Tanks against damage

Tanks: Tunnel Wyrm, Crystal Golem, Dreadpox (Epic) with Basalt Bulwarks. Damage: Dire Wolf, The
Watcher, Swamp Witch (Epic) with their best weapon and Dragonscale. Lv 16, Rare gear. "Plate against
the foe's main style": the Arcane Nullifier in both worlds (anti-magic today, anti-ranged after).

| Tanks' armour | Tanks win, today | Tanks win, two styles |
|---|---|---|
| All-round plate (Juggernaut) | 15% | **40%** |
| Plate against the foe's main style (Nullifier) | **35%** | 13% |
| Random armour | 25% | 15% |
| The wrong plate (Colossal, anti-melee) | 15% | 25% |
| Right plate, Hard AI both sides (20 fights) | 5% | 0% |

Today, picking the right plate is worth +20 over the all-rounder. After, it's worth −27: the
all-rounder is the best armour. Why: see the short version. With the Hard AI the damage team
exploits the soft side every time and the tanks lose outright in both worlds.

**A sim fault in the "right plate" rows (found 2026-11-24, after the runs):** the Nullifier's set bonus
reflects 25% of *magic* damage, keyed on the move's type (lib/combat/battle.ts). Today's casters'
Zap and Blast set it off every hit; in the two-style world nothing is magic, so the bonus did nothing,
though assumption 10 says it should reflect ranged damage. Most of the drop in the right-plate rows
(35% → 13% here, 18% → 8% in section 7) is likely that missing reflect, not two styles. Read the
after-world right-plate rows as "the plate without its set bonus".

### 7. Tanks against an all-one-style team

The same tanks against Sylvaran, The Watcher and Swamp Witch (all casters today; all ranged after).

| Tanks' armour | Tanks win, today | Tanks win, two styles |
|---|---|---|
| Right plate (Nullifier) | 18% | 8% |
| All-round plate (Juggernaut) | 20% | 15% |
| Wrong plate (Colossal) | 5% | 3% |

Even here the right plate is no better than the all-rounder, in either world; only the wrong plate
costs (about 15 points). The reason is the damage formula, not the number of styles: armour defence
counts at a third (`ARMOR_DEFENCE_WEIGHT`) inside the ratio `raw² / (raw + defence)`, so a Nullifier
set's ranged defence (about 140 rolled, against the Juggernaut's 100) takes about a tenth off each
hit. A plate can't swing a fight by 20 points when it changes a hit by 10%. That is also why "any old
armour" feels right today. The Nullifier's lower agility (it goes second) eats the rest.

### 2. The casual player

Dire Wolf, The Watcher, Aurelius (one of each style today) against the same three in fitted gear
(best weapon for their main style; armour against the team's most common style: Juggernaut today,
the Nullifier after). Random gear: any of the 14 weapons, any of the 7 armours, a full set.

| The casual side's gear | Wins, today | Wins, two styles |
|---|---|---|
| Random weapon + random armour | 0% | 5% |
| Fitted weapon + random armour | 43% | 55% |
| Random weapon + fitted armour | 10% | 10% |

The gap is the weapon. Armour hardly matters either way (43 / 55 against an even 50), and it
matters a shade less after, because the fitted side's "right" plate is the Nullifier, which the
all-round plate beats (row 1).

### 3. Hybrids

Hybrids: Void Serpent (L), Mr. Shadows (E), Bellow Toad (R) with both styles' light and heavy moves.
Today their weapon is their main style's best (the Serpent and Mr. Shadows the Frostspire Staff, the
Toad the Whip); after, the Lightning Trident (72/80). Specialists wear Juggernaut. Tanks: Tunnel
Wyrm, Dreadpox, Glob with Basalt Bulwarks.

| Row | Today | Two styles |
|---|---|---|
| Hybrids v melee specialists (Ironhide, Dire Wolf, Deep Angler) | 25% | **3%** |
| Hybrids v casters / ranged specialists (Sylvaran, The Watcher, Dustwraith) | 38% | 25% |
| Hybrids v tanks in anti-melee plate | 100% | 95% |
| Hybrids v tanks in the Nullifier | 95% | 98% |
| Melee specialists v tanks in anti-melee plate | 93% | 98% |
| Casters / ranged specialists v tanks in the Nullifier | 90% | 98% |

Hybrids aren't the answer to tanks: everyone beats these tanks. Hybrids are the ones who lose out:
a true 50/50 on a 72/80 weapon hits for about 109 (80 × 1.36) where Ironhide on a Maul hits for
156 (107 × 1.46), and today's Void Serpent hit for 131 (95 × 1.38) with its staff.

### 4. Nothing else breaks

- **Fight length:** across the fourteen 3v3 rows, hits to knock out 8.8 → 9.1 and rounds 20.0 →
  20.6 (3% longer, within noise). A hit took 15% of a creature's HP today and 14% after.
- **The race chart's edge:** mirror teams (Dire Wolf, Ironhide, Moss Wolf), one side's moves landing
  as Geo against Beasts: 63% today, 65% after. Unchanged.
- **Bosses** (Normal party at full health, 20 fights, ±11): Cyclops (Lv 6) v Lv 12 rru Rare gear
  100% / 100%; **Hydra (Lv 16) v Lv 21 err Epic gear 80% / 95%**; Minotaur (Lv 20) v Lv 26 eerrr Epic
  gear 95% / 95%. The Hydra gets easier because its Hex Head is a second ranged head, so one plate
  covers two heads, and its Fang Head is weak to the party's ranged moves too.

## Options, not changes

These are tried in the two-style world only, same rows, 40 fights (±8). None is picked.

| Option | Row | Two styles as drafted | With the option |
|---|---|---|---|
| **A. All-round armours keep today's per-style defence** (Juggernaut and Chainbolster stay 88/88 and 85/85; their magic defence goes to HP instead) | tanks, all-round plate | 40% | 33% |
| | tanks, right plate | 13% | 15% |
| | tanks, random armour | 15% | 30% |
| **B. Armour defence counts at a half, not a third** (ARMOR_DEFENCE_WEIGHT; done as ×1.5 on everyone's armour defence) | tanks, all-round plate | 40% | 30% |
| | tanks, right plate | 13% | 18% |
| | tanks, random armour | 15% | 23% |
| | hybrids v melee specialists | 3% | 20% |
| **C. A real hybrid weapon** (Lightning Trident 90/90 at Rare) | hybrids v melee specialists | 3% | 23% |
| | hybrids v ranged specialists | 25% | 35% |
| **D. Off-style weapon ceilings raised to 45** (every attack weapon's weaker side; shields unchanged) | casual: random weapon + random armour | 5% | 28% |
| | casual: random weapon + fitted armour | 10% | 13% |

What the options say:

- **A and B don't make the right plate pay** against a mixed damage team (15% and 18%, against 33%
  and 30% for the all-rounder). The fold isn't the whole story: the Nullifier's melee defence is capped
  at 45 a piece, and the damage team's one melee creature is sent in against it every time. With two
  styles, every team of three carries both, so a plate that picks a side is a plate with a hole. And
  even against a team all on one side the plate's edge is too small to show (section 7), because a
  third-weighted defence trims a hit by a tenth. If the user wants specialising to pay, the lever is
  how hard a matched plate bites: a flat cut as a set bonus (say "−25% damage from ranged moves" on
  the anti-ranged plates, like Hard Shell but every hit), or a defence weight well past a half (B's
  ×1.5 wasn't enough to show). Not the all-rounders' ceilings, which A tested.
- **B makes fights longer** (hits to knock out 9.5 → 11.3 on the tank rows) and helps hybrids a little
  (3% → 20%), because longer fights give picking the softer defence more turns to count.
- **C brings hybrids back to today's standing** (23% / 35% against 25% / 38% today). A 50/50 hybrid
  needs a weapon that is 50/50 at the specialist's ceiling, not a split of it.
- **D does most for the casual player:** the fully random row goes from 5% to 28%. It's a change to
  the item ceilings, which the user guards; it would also make every specialist a bit of a hybrid by
  gear alone, which is what decision 1 asks for.

Other nudges not simmed: a tank set bonus that bites (Hard Shell on every hit while HP is above
half, say), or tanks' shields with real attack so a tank fight can end.

## Assumptions, numbered (for the user to overrule)

1. **Attack totals stay.** Each creature's melee + ranged = today's melee + ranged + magic; magic
   went to the style its moves looked like (table above); no attack % below about a fifth of the total.
2. **Magic defence splits half and half** into melee and ranged defence, for creatures, armour
   ceilings (except the two "true" plates: Colossal all to melee, Nullifier all to ranged) and bosses.
   The effect: every defence stat grows while attack stats only move sideways. Fights came out the
   same length anyway, but this is also what makes the all-round plate the best armour (row 1).
3. **Seven true 50/50 hybrids,** picked by flavour: Bellow Toad, Hollow Matriarch, Void Serpent, Mr.
   Shadows, Leafblade Scout, Thunderhead (and Veilstalker close). Crystal Golem, Pale Rider and Deep
   Angler lean melee as the user said of them.
4. **A 50/50 hybrid's main style is melee** (it starts with Strike, Smash, Rush). Ties could go either
   way, or by the creature's old class.
5. **Every creature knows all six core moves**, starting with its main style's three. The stricter
   reading (specialists know only their style's three; hybrids both) is as easy.
6. **Weapon leans** as in the table. The Frostspire Staff is the one former magic weapon made melee at
   heart; Soul Storm and Chaos Orb are ranged; the Trident is the hybrid weapon and the Whip the
   melee weapon with reach; the Aether Shield is the all-round shield.
7. **Voltage Surge** becomes +25% ranged damage (its own style). Alternative: +25% to both styles.
8. **Arcane Channel is retired** (two empowers are enough: Divine Strength melee, Sureshot Blessing
   ranged); a saved one becomes Sureshot Blessing. Alternative: keep it as "+25% to both styles".
9. **Hydra weak spots:** Fang → ranged (so two heads are weak to ranged). Alternative: Hex → melee,
   so each style has a head and a half.
10. **Nullify** reflects 25% of ranged damage; the Arcane Nullifier wants a new name (it's the heavy
    anti-ranged plate) and perhaps a different mechanic, as Deflect already answers ranged.
11. **Runed → Shielded** on existing pieces.
12. **Nullifying Voice** halves the target's ranged attack. Alternative: halves its weaker style.
13. **The sim's gear choices:** tanks carry Basalt Bulwarks; "fitted weapon" is the highest ceiling in
    the creature's main style (Maul, Greatbow; the Staff for casters today); "fitted armour" is the
    plate against the foe team's most common style, Juggernaut for a tie. Every fighter wears a full
    set (so set bonuses are on). Gear is rolled afresh each fight.
14. **Soul stones, enchantments and codex moves** were left out of the fights (core moves only, as
    the audit's baseline), apart from Geo-tagged moves in the race row.
15. **Hybrids' weapon today** is their main style's best (no melee + magic weapon exists today): a
    finding in itself, and part of why the "before" hybrid numbers are what they are.

## What a real build would need (not done)

- **Saves:** fold each creature's rolled `mag` into its new main style (and `magdef` half and half),
  or re-roll; move Zap / Blast / Blink in saved move slots to Shot / Power Shot / Quickshot; re-file
  saved codex moves and tablets; convert Runed pieces and Arcane Channel codexes; rolled weapon and
  armour stats: fold `magic` by the weapon's lean and `magDef` by the armour's fold (or leave old items
  as they are and let `mag` count as 0, which quietly weakens every old magic weapon). `upgradeStyle`
  (lib/creatures/instance.ts) is the precedent.
- **The global registry's rules:** `npm run registry:rules` and apply the migration (species styles,
  weapon kinds).
- **The Labyrinth golden** (tests/golden/page/dungeon.json) will move: foes' stats and moves change.
  Re-record in an "Intended change:" commit.
- **Docs:** combat.md (Combat V2's styles and archetypes), items.md (Gear ceilings, enchantments),
  creatures and bosses docs, decisions.md, the privacy page if the registry's stored fields change.
- **Screens:** `CLASS_INFO`, the three style icons and colours (BattleScreen's STYLE_COLOR), the
  creature window's "Melee - Magic" line, type labels, Help panels, the Hydra's weak-spot text, the
  bosses' labels ("Floating Caster"), the PvP rivals (`npm run pvp:rivals` to replay their rosters).
- **Showing foes' styles on screen:** the point of two styles is reading the matchup at a glance, so
  a foe's main style (and its armour's side) wants a mark in the Labyrinth and in battle.
- **The AIs** need nothing: they read damage, not styles. Klutz's club and his points want a look.

## Rounds 2 and 3: finding a level (2026-11-24, later the same day)

The user's steer after the first round: no set bonuses that cut one style's damage; redraft the
tanks' defence %s to lean hard one way; aim for a Pokémon shape, where a wall takes little from its
own style (10–15% a hit) and a lot from its counter (50–80%, up to 100% if the attacker is empowered
or the wall soaked); and try more HP with today's stats. Also: would scaling every number by 10
help? **No:** the formula is linear, so ×10 everywhere gives the same shares of HP; only the move
powers (10, 25), the 1-damage floor, flat potion heals and the +5/10/20 enchantments would fall out
of step. Big numbers are presentation; balance in today's units and multiply on screen if wanted.

**The per-hit arithmetic first** (real rollers, 400 Rare rolls averaged; a Lv 16 Tunnel Wyrm with
%s sharpened to 70/12 in a Colossal plate whose ranged defence is cut to 15; Dire Wolf on a Maul
and Sylvaran on a Greatbow). Today's formula already gives the matched side (Strike 9%, Smash 12%
of the tank's HP). The counter side can't get past 24%, and no defence formula fixes it: with **no
defence at all** Sylvaran's Power Shot is 87 on 320 HP, 27%. Hits are small next to HP (a third of
the tank's HP is gear HP, and `HP_SCALE` is 1.5). Counting armour in full and making hits 2.5× bigger
next to HP gives Strike 10%, Smash 15%, Power Shot 50%, 73% empowered, about 80% empowered and
soaked: the user's targets exactly.

**The packages** (all in the two-style world; no set bonuses this round; the knobs are
`ARMOR_DEFENCE_WEIGHT` (W), hit size next to HP (M, done as HP ÷ M, the same as changing
`HP_SCALE`), and "sharp": the tanks' %s and plates sharpened):

| Package | Armour counts at | Hits next to HP | Sharp tanks | Other |
|---|---|---|---|---|
| K0 | a third (today) | ×1 | no | the round-1 draft |
| K1 | a third | ×1 | yes | |
| K2 | full | ×1 | yes | |
| K3 | full | ×2 | yes | |
| K4 | full | ×2.5 | yes | the per-hit table's package |
| K5 | a third | ×0.5 (double HP) | no | the user's "more HP, stats as is" |
| K6 | full | ×0.5 (double HP) | no | |
| K7 | full | ×2 | yes | tank species have 1.5× their own HP |

Sharpened tanks: Tunnel Wyrm 70/12, Glob 55/13, Crystal Golem 60/18, Rust Beetle 40/14, Ironhide
80/31, Shambler 30/9 (melee def / ranged def, same totals as the draft), the ranged tanks the other
way (Crystalback 20/64, Dreadpox 20/50); the Colossal's ranged defence and the Nullifier's melee
defence ceilings cut to 15 at Rare. "Tank species" in K7: those eight bar Ironhide.

### Round 2: team rows (40 fights, ±8; bosses 20)

A wins = the first-named side.

| Row | K0 | K1 | K2 | K3 | K4 | K5 | K6 |
|---|---|---|---|---|---|---|---|
| 1 Melee tanks (anti-melee plate) v melee specialists | 10% | 18% | 28% | 30% | 30% | 3% | 3% |
| 2 Melee tanks (anti-melee plate) v ranged assassins | 10% | 3% | 3% | 0% | 0% | 5% | 10% |
| 3 Melee tanks (anti-melee plate) v mixed damage (1 melee, 2 ranged) | 28% | 8% | 8% | 10% | 5% | 20% | 18% |
| 4 Melee tanks (all-round plate) v mixed damage | 28% | 23% | 28% | 28% | 38% | 23% | 23% |
| 5 Hybrids (Trident, both styles' moves) v melee specialists | 35% | 33% | 40% | 28% | 30% | 33% | 40% |
| 6 Casual: random weapon + armour v fitted, same team | 5% | 5% | 10% | 0% | 10% | 10% | 10% |
| 7 Race edge (mirror Beasts, Geo moves v neutral) | 78% | 70% | 75% | 65% | 68% | 73% | 73% |
| Hits to knock out, row 1 | 10.8 | 12.4 | 24.6 | 12.4 | 10.0 | 22.6 | 43.4 |
| A hit on the wall from its counter (row 2), share of HP | 16% | 18% | 14% | 29% | 37% | 8% | 5% |
| Cyclops (Lv 6) v Lv 12 rru Rare, un-retuned | 95% | 95% | 95% | 90% | 95% | 95% | 95% |
| Hydra (Lv 16) v Lv 21 err Epic, un-retuned | 75% | 75% | 65% | 100% | 100% | 40% | 10% |
| Minotaur (Lv 20) v Lv 26 eerrr Epic, un-retuned | 100% | 100% | 90% | 100% | 100% | 45% | 5% |

Tanks: Tunnel Wyrm, Crystal Golem, Glob with Basalt Bulwarks. Melee specialists: Ironhide, Dire
Wolf, Deep Angler in Juggernaut. Assassins: Sylvaran, Skull Raven, Dustwraith in Dragonscale.
Mixed: Dire Wolf, The Watcher, Swamp Witch.

- **The crumble works everywhere** (row 2), and under K3 / K4 a counter hit is 29–37% of the wall's HP.
- **A team of three walls never holds** (row 1, at best 30%): a Bulwark-armed tank hits back for the
  same 6–7% it takes and has little more HP, so it can't finish. Pokémon walls win on HP and
  recovery, not damage; core moves have neither.
- **Against a mixed team the all-round plate still beats the matched plate** (rows 3 v 4) in every
  package, because the foe's AI sends its ranged creatures at the sharpened weak side.
- **Double HP (K5, K6) buys only time:** fights 2–4× longer, no more tank wins, and the bosses turn
  brutal because their scripted tricks (clouds, the charge) get the extra rounds.
- **K2 doubles fight length; K3 keeps today's pace** with armour in full (hits to KO 12 on the tank
  row, 6–7 elsewhere). K3 and K4 make the bosses fall fast: every boss would be re-numbered.
- The casual gap (row 6) and the race edge (row 7) don't move with any of these.

### Round 3: is a tank worth a slot, and the clean 1v1

| Row | K0 | K3 | K4 | K6 | K7 |
|---|---|---|---|---|---|
| 11 Team with a melee tank (anti-melee plate) v the same team with a 3rd attacker | 45% | 33% | 45% | 45% | **53%** |
| 12 Team with a melee tank (all-round plate) v the same | 45% | 40% | 53% | 35% | 53% |
| 13 1v1: Tunnel Wyrm (anti-melee plate, Bulwark) v Dire Wolf, the matched fight | 33% | 55% | 55% | 35% | **75%** |
| 14 1v1: Tunnel Wyrm v Sylvaran, the counter | 15% | 5% | 3% | 8% | **8%** |
| 15 1v1: Tunnel Wyrm with an Ironfang Guard (melee shield) v Dire Wolf | 40% | 58% | 58% | 33% | 68% |
| Rounds, row 13 / row 14 | 8 / 7 | 10 / 4 | 8 / 3 | 32 / 23 | 11 / 5 |

The team: Tunnel Wyrm + Sylvaran + Dire Wolf against Deep Angler + Sylvaran + Dire Wolf.

- **K7 has the Pokémon shape.** One on one the wall holds against its own style three times in
  four and falls to its counter eleven times in twelve, in about half the rounds. In a team a tank is
  worth exactly a slot (53%). Ordinary fights run at today's pace (7–7.5 hits to a knockout). Today
  (K0) the same wall loses the matched fight two times in three.
- **The plate's side stops mattering inside a team** (rows 11 v 12 are level): with the AI swapping,
  teammates cover the tank's weak side, so the sharpened plate costs nothing and the identity sits in
  the creature, which is where the user wanted it.
- **Shields:** a melee shield in the tank's hand (row 15) is about as good as the Bulwark; neither
  makes the tank a threat. Tanks' damage is a separate question.

### Where this leaves it (for the user to decide)

The package that meets the brief's shape is **K7**: two styles as drafted; armour counting in full
(`ARMOR_DEFENCE_WEIGHT` 1/3 → 1); hits twice as big next to HP (`HP_SCALE` 1.5 → 0.75, or the
equivalent); the tank species' defence %s leaning hard one way and their base HP up by half; the
two heavy plates' weak side cut to 15. What it costs, besides the build list above: every boss
re-numbered (their armour counts in full and the party's hits are bigger), potions and every flat
heal re-scaled, foes with little armour taking twice the damage, and the casual player's gap left
as it is (that one is the weapons' off-style ceilings; option D). The wall's identity comes from
its %s and HP, not from set bonuses, as the user asked. Not simmed: a wall with a recovery or stall
move, which is how Pokémon walls earn their keep; and K7 at ×2.5 instead of ×2 for a harder crumble.

## Round 4: an HP % as part of each creature (the user, 2026-11-24)

The user's idea: instead of a flat boost for tank species (K7), give every creature an HP %, like
its attack and defence %s, that multiplies its whole HP, gear included. HP scale becomes identity,
and a Bulwark's or a Stalwart piece's HP is worth more in a wall's hands. Potions get weaker for
walls; the user is fine with that and will add a %-based epic potion.

**The draft HP %s** (Claude's, by identity, on top of today's %s; a real build might trade them
against defence %s): walls 50–80 (Tunnel Wyrm 80, Glob 70, Crystalback 70, Crystal Golem 60, Rust
Beetle 60, Dreadpox 60, Shambler 50, Ironhide 50); bruisers 10–30 (Dire Wolf 25, Deep Angler 30,
Pale Rider 30, Moss Wolf 20, Rattlebones 20, Cave Goblin 15, Plague Rat 15, Amber Wasp 10); snipers
and assassins 0–15 (Aurelius 25, The Watcher 15, Sylvaran 10, Swamp Witch 10, Flicker Wisp 5, Flame
Imp 5, Thicket Archer 5, Rotgut Fly 5, Skull Raven 5, Dust Sprite 0, Gleamling 0, Dustwraith 0);
hybrids 10–30 (Bellow Toad 30, Hollow Matriarch 25, Thunderhead 25, Void Serpent 20, Mr. Shadows 20,
Leafblade Scout 15, Veilstalker 10). Bosses 0 (they'd need their own).

Packages: **K8** = armour in full, hits ×2, sharpened tanks, the HP % (no flat tank boost); **K9** =
the same at ×2.5. K7 (the flat 1.5× tank HP) and K0 (the round-1 draft) for comparison.

| Row | K0 | K7 | K8 | K9 |
|---|---|---|---|---|
| 1 Melee tanks (anti-melee plate) v melee specialists | 10% | 30%* | **50%** | 40% |
| 2 Melee tanks v ranged assassins | 10% | 0%* | 13% | 15% |
| 3 Melee tanks (anti-melee plate) v mixed damage | 28% | 10%* | 40% | 48% |
| 4 Melee tanks (all-round plate) v mixed damage | 28% | 28%* | 63% | 60% |
| 5 Hybrids v melee specialists | 35% | 28%* | 20% | 23% |
| 6 Casual random gear v fitted | 5% | 0%* | 10% | 15% |
| 7 Race edge | 78% | 65%* | 68% | 75% |
| 11 Team with a melee tank (anti-melee plate) v a 3rd attacker | 45% | 53% | 45% | 45% |
| 12 Team with a melee tank (all-round plate) v a 3rd attacker | 45% | 53% | 55% | 53% |
| 13 1v1: Tunnel Wyrm v Dire Wolf (matched) | 33% | 75% | **78%** | 73% |
| 14 1v1: Tunnel Wyrm v Sylvaran (the counter) | 15% | 8% | 15% | 15% |
| 16 1v1: the same wall with +20 HP on each armour piece v Dire Wolf | | | 75% | 78% |
| Hits to knock out: row 1 / row 11 / row 13 | 10.8 / 7.8 / 15 | 12.4 / 7.5 / 22 | 19.3 / 9.2 / 29 | 15.5 / 6.7 / 23 |
| Rounds, row 1 (wall team v melee specialists) | 23 | 28 | 41 | 33 |
| Bosses (un-retuned): Cyclops / Hydra / Minotaur | 95 / 75 / 100 | | 100 / 100 / 100 | 100 / 100 / 100 |

\* K7 ran only rows 11–16 in round 3; its rows 1–7 are K3's (the same package without the tank HP).

- **The HP % does what K7 did, and more.** One on one the wall holds three times in four (78%) and
  falls to its counter 85% of the time. A tank is worth a slot (45–55%). And a team of walls is now a
  real team: even against melee specialists (50%), and 40–63% against a mixed damage team, where
  today it's 28% and under K3 it was 10–28%.
- **The counter is softer than the brief's 50% a hit,** because the wall now has 1.8× the HP: Sylvaran
  takes about five hits to fell it (15–20% each) instead of three. That is the Pokémon trade the user
  named: the wall's HP is much higher, so it can still take a wrong-type hit. The 50%-a-hit target and
  "walls have far more HP" can't both hold; the HP % picks the second.
- **Matched fights are grinds.** Wall v wall-ish melee (row 1) runs 41 rounds and 19 hits a knockout
  at ×2; ×2.5 (K9) trims that to 33 and 15.5 with the same shape elsewhere. K9 is the more playable
  of the two; a stall or recovery move for walls would be the other answer.
- **The all-round plate still beats the matched plate** against a mixed team (63% v 40%), by the same
  margin as before. That's structural: against a team carrying both styles, a plate with a hole loses
  more than it gains, and the identity now lives in the creature anyway. One on one the matched plate
  is what makes the hold (rows 13–14), so both plates keep a use.
- **Gear HP in a wall's hands:** +20 HP a piece (a Stalwart set) didn't show (75% v 78%, noise), because
  60 points are small next to a wall's 290. The lever works, but the enchantment's numbers would want
  raising (or a % form) to be felt.
- **Casual, hybrids, race edge:** unmoved, as in every round. Hybrids drift lower (20–23%) as walls
  gain HP; they'd want the 90/90 Trident (option C).
- **Bosses fall at 100%** un-retuned: the party's hits are twice the size and bosses have no HP %. In a
  build each boss gets an HP % and re-numbered armour; that's the retune already on the list.

### Where this leaves it (updated)

The shape the user asked for is reached by **K9** (or K8 for longer, tankier fights): two styles as
drafted; armour counting in full; hits ×2.5 next to HP (`HP_SCALE` 1.5 → 0.6); an HP % on every
creature (walls 50–80, bruisers 10–30, snipers 0–15, hybrids 10–30); tank defence %s leaning hard one
way; the two heavy plates' weak side at 15; no style-specific set bonuses. Costs: bosses re-numbered
with HP %s of their own; a %-based potion (the user's call); the casual gap left to option D; hybrids
to option C; walls' matched fights long (15 hits a knockout) unless walls get a stall or recovery move.

## Round 5: three styles kept, tanks with a side and an HP % (2026-11-25)

The user's rethink: cutting magic narrows the roster's room to grow, and the tanks' real problem may just be that
they were even across their defences while attackers weren't. So: keep three styles; give each tank defences
that follow what it's made of, with one clear weakness (the user's examples: a Crystal Golem takes magic, then
arrows, and shatters to big hits; a Glob swallows blows and bolts but not magic); add the HP % (round 4's draft)
to every creature. Tested with today's maths (T1) and with armour counting in full and hits ×2 / ×2.5 (T2, T3),
against today (T0). No set bonuses, no changes to attack %s, moves, weapons or the Hydra.

**The tanks' defences** (melee / ranged / magic def, today's totals): Crystal Golem 32/20/26 → 12/27/39; Glob
26/20/22 → 32/26/10; Tunnel Wyrm 34/24/24 → 50/24/8; Rust Beetle 24/12/18 → 20/28/6; Shambler 16/10/13 →
22/12/5; Crystalback 30/24/30 → 12/30/42; Dreadpox 22/20/28 → 10/22/38; Ironhide 44/30/37 → 60/33/18. The three
sided plates (Colossal, Nullifier, Arrowward) keep their side and lose the other two to 15 at Rare.

| Row (A wins; 40 fights, ±8; bosses 20) | T0 today | T1 sharp + HP % | T2 + armour full, ×2 | T3 + armour full, ×2.5 |
|---|---|---|---|---|
| 1 Melee walls (Colossal) v melee attackers | 30% | **80%** | 83% | 83% |
| 2 Melee walls v ranged attackers | 5% | 20% | 13% | 10% |
| 3 Melee walls v magic attackers | 10% | 40% | 28% | 38% |
| 4 Magic walls (Nullifier) v magic attackers | 18% | **83%** | 90% | 93% |
| 5 Magic walls v melee attackers | 15% | 30% | 18% | 10% |
| 6 Melee walls (Colossal) v mixed team | 8% | 35% | 33% | 30% |
| 7 Melee walls (Juggernaut) v mixed team | 3% | 33% | 33% | 30% |
| 8 Team with a melee tank v the same with a 3rd attacker | 48% | 63% | 65% | 53% |
| 9 1v1 Tunnel Wyrm v Dire Wolf (matched) | 30% | 68% | 70% | 70% |
| 10 1v1 Tunnel Wyrm v Sylvaran (counter) | 10% | 38% | 25% | 25% |
| 11 1v1 Tunnel Wyrm v Swamp Witch (counter) | 25% | 53% | 40% | 38% |
| 12 1v1 Crystal Golem v Swamp Witch (matched) | 25% | 53% | 55% | 53% |
| 13 1v1 Crystal Golem v Dire Wolf (it shatters) | 18% | 18% | 10% | 13% |
| 14 Casual random gear v fitted | 15% | 10% | 8% | 8% |
| 15 Race edge | 70% | 73% | 68% | 73% |
| 16–18 Cyclops / Hydra / Minotaur, un-retuned | 90 / 45 / 95 | 95 / 70 / 100 | 85 / 85 / 100 | 90 / 90 / 100 |
| Hits to knock out: row 1 / row 6 / row 9 | 8.4 / 7.2 / 15 | 14.2 / 11.5 / 25 | 12.6 / 7.8 / 22 | 10.0 / 6.1 / 18 |

Melee walls: Tunnel Wyrm, Glob, Shambler with Basalt Bulwarks. Magic walls: Crystal Golem, Crystalback, Dreadpox
with Aether Shields. Melee attackers: Dire Wolf, Deep Angler, Leafblade Scout. Ranged: Sylvaran, Skull Raven,
Aurelius. Magic: Swamp Witch, The Watcher, Flicker Wisp. Mixed: Dire Wolf, The Watcher, Sylvaran.

- **Sharpening plus the HP % does most of the work, in three styles, with today's maths (T1).** Walls hold
  against their own style four times in five as a team (30% → 80%, 18% → 83%) and two in three one on one.
  The Crystal Golem holds a Swamp Witch (25% → 53%) and still shatters to a Dire Wolf (18%). A tank is worth
  more than a slot (48% → 63%). And **the sided plate is no longer worse than the all-rounder** against a mixed
  team (35% v 33%); in every two-style round it had lost by 15–25 points. Why it works where round 2's K1
  didn't: K1 sharpened only the %s; the HP % is what lets a wall outlast a specialist that hits it for the same
  share it hits back.
- **T1's two costs:** fights run about 70% longer (14 hits a knockout on the wall row, 25 one on one), and the
  HP is direction-blind, so a wall also holds its counters too well one on one (38% against Sylvaran, 53%
  against the Witch, where today it's 10% and 25%). The crumble goes soft.
- **T2 keeps T1's hold and restores the crumble at today's pace.** Armour counting in full makes the sided
  defence bite (counters back to 25% / 40%; the Golem to 10% against the wolf), and hits ×2 bring ordinary fights
  back to today's length (7.8 hits a knockout on the mixed row against 7.2 today). T3 is the same a little
  faster, with the tank slot back to even (53%).
- **Bosses:** the Hydra gets easier in every package (45% → 70–90%) because the party has HP % and the Hydra
  doesn't. Each boss wants an HP % of its own (and, under T2 / T3, re-numbered armour).
- **Casual and the race edge** don't move, as in every round. The casual gap is the weapons (round 1, option D).

### Where this leaves it (final)

**Keep three styles.** The two-style change never did the balancing; the knobs did, and they work the same with
magic kept. The package that meets the user's shape with the least change is **T1**: tank defences leaning to one
side with a clear weakness, the sided plates' other sides cut to 15, and an HP % on every creature. No formula
change, no new weapons, no creature reworks, no save conversion beyond the new %s. Its cost is longer fights
and a soft crumble one on one. **T2** fixes both for one formula change (`ARMOR_DEFENCE_WEIGHT` 1/3 → 1 and
`HP_SCALE` 1.5 → 0.75), at the price of re-numbering the bosses and flat heals. Either way: bosses get an HP %;
the casual gap is a separate weapon-ceiling question (option D); the three sustained weapons' HP ceilings are the
user's call (the lab's ceilings panel shows them).

## The codex move audit (2026-11-25)

Before the tier words and a power rescale go in (every move's hidden power is then up for grabs), each learnable
move's facts and impact in one place. **Facts** from the code: style and race, codex rarity (a race move's codex
is Epic by default, the three cripples' Uncommon), power (× its multiplier), energy, cooldown, how many of the 35
can learn it, its effect. **Impact** from the mirror sim: two identical Lv 16 teams of three of the move's
learners (Rare: best weapon for their style, Juggernaut set), side A with the move in its fourth slot; 40 fights,
Normal AI both sides; ±8. Also how often A used it a fight and the share of A's damage it did. A fourth move of
any kind is worth about 50–60%, so that's "ordinary"; the AI plays utility moves poorly, so their rows read low.
The flags are Claude's suggestions for the refresh, not changes.

### Common codexes

| Move | Style · race | Power | Energy | Learn | Effect | Wins | Used | Dmg share | Flag |
|---|---|---|---|---|---|---|---|---|---|
| Headbutt | melee | 25 ×1.4 | 50 | 25 | 20% recoil | **68%** | 3.0 | 32% | A Mega-tier hit anyone can read for a Common: Uncommon, or recoil 30% |
| Flame Spit | ranged · geo | 10 | 20 | 10 | 5% burn | 58% | 2.6 | 7% | fine |
| Poison Dart | ranged · toxic | 10 | 40 | 16 | 70% poison 5% × 3–5 | 55% | 2.2 | 7% | fine |
| Meditate | magic | 0 | 0 (cd 3) | 35 | +30 energy | 48% | 0.8 | — | fine; the AI hardly uses it |
| Nibble | melee · undead | 8 | 20 | 18 | +10% a chain, to +100% | 48% | 3.0 | 18% | fine |
| Whiplash | melee · humanoid | 15 | 50 | 22 | +50% agility | 48% | 2.7 | 22% | 50 energy is dear for 15 power: 40 |
| Crystal Armour | magic · divine | 0 | 40 (cd 5) | 18 | ward 3 rounds | 48% | 0.9 | — | fine |
| Claw | melee · beast | 10 | 20 | 16 | plain | 45% | 3.1 | 18% | fine |
| Slap | melee | 10 | 35 | 17 | 70% wipe stat changes | 45% | 2.1 | 13% | fine |
| Cleansing Water | magic · geo | 0 | 60 (cd 3) | 11 | team cleanse | 43% | 0.7 | — | 60 energy for a cleanse: 40 |
| Rock Toss | ranged · underkin | 8 | 20 | 6 | plain | 38% | 1.9 | 6% | the Underkin starter hit at 8 where Claw is 10: make it 10 |

### Uncommon codexes

| Move | Style · race | Power | Energy | Learn | Effect | Wins | Used | Dmg share | Flag |
|---|---|---|---|---|---|---|---|---|---|
| Healing Blessing | magic · divine | 0 | 40 (cd 3) | 12 | heal 60% next round | **88%** | 4.8 | — | far too strong for Uncommon (98% in the November audit): Epic, or heal 40% / cooldown 5 |
| Razor Arrows | ranged · humanoid | 15 | 50 | 8 | 50% bleed 10%/round, whole fight | **75%** | 3.2 | 31% | strong for Uncommon: Rare, or chance 35% |
| Crippling Shot | ranged | 15 | 60 | 35 | 50% cripple | 68% | 3.6 | 27% | see the cripple note below |
| Vampiric Bite | melee · underkin | 20 | 60 | 12 | heals 30% | 60% | 3.5 | 37% | fine (50 energy would match Soul Snatch's standing) |
| Bolas Shot | ranged · humanoid | 10 | 60 | 9 | 70% cripple | 60% | 3.4 | 26% | fine |
| Hobble Hex | magic | 15 | 60 | 35 | 50% cripple | 58% | 2.9 | 10% | see the cripple note |
| Ambush | melee · underkin | 15 | 50 | 10 | first; +50% at full HP | 58% | 3.3 | 33% | fine |
| Cursed Claw | melee · undead | 20 | 40 | 8 | 10% fear if first | 50% | 3.1 | 23% | fine |
| Enfeeble | magic · undead | 0 | 50 (cd 5) | 10 | sure cripple 3 rounds | 50% | 3.4 | — | fine |
| Blessed Bolt | ranged · divine | 15 | 30 | 6 | plain | 48% | 1.7 | 5% | fine |
| Nullifying Voice | magic · divine | 0 | 40 | 16 | halves magic attack | 48% | 5.4 | — | fine (the AI spams it) |
| Cripple | melee | 15 | 60 | 35 | 50% cripple | 40% | 4.0 | 20% | see below |

The three cripples share one team here (Aurelius, Bellow Toad, Crystalback, all archers by weapon), so their
40 / 68 / 58 is the move's style against that team's weapons, not three different moves. They are one move in
three styles; a refresh could make it one codex that fights in the reader's main style.

### Rare codexes

| Move | Style · race | Power | Energy | Learn | Effect | Wins | Used | Dmg share | Flag |
|---|---|---|---|---|---|---|---|---|---|
| Obsidian Arrows | ranged · geo | 15 | 60 | 12 | sure bleed 10%/round, whole fight | **85%** | 3.5 | 21% | too strong (92% in November): Epic, or chance 70% |
| Soul Snatch | magic · undead | 20 | 60 | 12 | heals 30% | 68% | 2.5 | 23% | fine |
| Dark Seal | magic · undead | 5 | 50 (cd 5) | 7 | sealed 3 rounds | 60% | 1.9 | 15% | fine |
| Smoke Bomb | magic · geo | 5 | 40 (cd 3) | 15 | hit, then swap out first | 60% | 2.7 | 15% | fine |
| Mega Smash | melee · beast | 25 ×2.5 | 50 | 12 | winds up a turn | 58% | 6.7 | 46% | fine (the wind-up is the price) |
| Voltage Surge | magic · geo | 15 | 60 | 13 | +25% magic damage | 55% | 2.6 | 22% | fine (80% in November; now ordinary) |
| Haemorrhage | melee · underkin | 10 | 50 | 11 | blood 4 rounds, toxic +50% | 55% | 2.4 | 18% | fine |
| Pin Down | ranged · humanoid | 10 | 60 (cd 5) | 6 | sealed 2 (30%: 3) | 53% | 1.4 | 11% | fine |
| Emulate | magic · geo | 20 | 50 | 12 | ×2 if a cloud lies under | 53% | 3.0 | 26% | fine |
| Bounce | melee · beast | 5 | 40 (cd 3) | 13 | hit, then swap to a pick | 50% | 2.3 | 10% | fine |
| Flame Body | magic · geo | 0 | 40 (cd 5) | 11 | reflects 30% of melee, 3 rounds | 48% | 1.1 | — | fine |
| Bone Javelin | ranged · underkin | 25 ×1.3 | 40 (cd 3) | 10 | plain, cheap, on cooldown | 45% | 1.6 | 14% | fine |
| Septic Shock | ranged · toxic | 15 | 50 | 13 | ×2 if bleeding or on blood | 45% | 1.2 | 5% | fine (needs its setup) |
| Corrosive Soak | magic · toxic | 0 | 40 | 13 | −30% defences while out | 43% | 1.6 | — | fine (utility, under-played) |
| Brace | magic | 0 | 50 | 35 | first; next hit −90% | 40% | 4.0 | — | the AI wastes it; fine, or 40 energy |
| Force Push | magic · geo | 5 | 60 | 12 | clears hazards | 35% | 1.0 | 7% | 60 energy for a 5 hit: 40 |

### Epic codexes

| Move | Style · race | Power | Energy | Learn | Effect | Wins | Used | Dmg share | Flag |
|---|---|---|---|---|---|---|---|---|---|
| Smite | magic · divine | 25 | 55 | 12 | +50% below 30% HP | 65% | 1.5 | 10% | fine |
| Corpsify (race) | melee · undead | 0 | 30 (cd 3) | 9 | rises at 55% if KO'd | 60% | 2.1 | — | fine |
| Impale | ranged · geo | 25 | 80 | 13 | 60% sealed 2 rounds | 60% | 0.8 | 6% | 80 energy means it's used once a fight: 60 |
| Rabid Bite (race) | melee · toxic | 15 | 70 | 20 | venom 10% × 3–5 | 60% | 2.0 | 18% | fine (87% in November; venom ticks don't count here) |
| Arcane Channel | magic · divine | 0 | 50 (cd 5) | 35 | +50% magic attack while out | 55% | 0.8 | — | fine |
| Caltrops | magic · humanoid | 0 | 40 | 13 | 10% to each comer, whole fight | 55% | 1.9 | — | fine at Epic (moved 2026-11-24) |
| Implode | melee · toxic | 25 ×2.5 | 50 | 10 | goes last, KO's itself, cloud | 53% | 1.6 | 38% | fine |
| Pounce (race) | melee · beast | 15 | 50 | 13 | first; +50% below half HP | 53% | 2.3 | 17% | fine |
| Mirage (race) | magic · divine | 0 | 40 | 13 | 30% dodge, 5 rounds | 53% | 3.6 | — | fine |
| Barrage (race) | ranged · humanoid | 15 | 60 | 8 | hits every foe on the field | 53% | 1.8 | 19% | fine |
| Sureshot Blessing | ranged · divine | 0 | 50 (cd 5) | 35 | +50% ranged attack while out | 50% | 1.1 | — | fine |
| Fissure | melee · geo | 15 | 60 | 12 | hits every foe on the field | 50% | 1.6 | 11% | fine |
| Erupt (race) | magic · geo | 25 | 70 | 13 | 25% cripple | 50% | 2.7 | 23% | 70 energy for a heavy with a weak cripple: 60 |
| Divine Strength | melee · divine | 0 | 50 (cd 5) | 35 | +50% melee attack while out | 45% | 1.0 | — | fine |
| Blood Sacrifice | magic · undead | 0 | 70 | 6 | 25% HP; blood pool; burst | 43% | 0.5 | — | the AI barely uses it; 60 energy, or leave for players |
| Stalactite | ranged · underkin | 25 ×1.5 | 65 | 8 | plain | **35%** | 2.4 | 19% | 65 energy for a plain 37: 50 |

### Legendary codexes

| Move | Style · race | Power | Energy | Learn | Effect | Wins | Used | Dmg share | Flag |
|---|---|---|---|---|---|---|---|---|---|
| Curse | magic · undead | 0 | 60 | 5 | 10-power magic hit a round, 2–3 rounds; 60% spreads on swap | **93%** | 3.6 | — | far too strong (77% in November): tick power 10 → 6, or rounds 2, or energy 80 |
| Choking Smog | magic · toxic | 0 | 90 | 9 | cloud 10%/round, 5–7 rounds + tail | 53% | 0.8 | — | fine at Legendary; 90 energy is what keeps it to once a fight |
| Haunting Scream | magic · undead | 0 | 50 (cd 5) | 5 | 70% flee, else −50% attacks 3 rounds | 50% | 2.5 | — | ordinary for a Legendary; player-valued; fine |

### What to take from it

- **Four moves are out of band:** Curse (93%), Healing Blessing (88%), Obsidian Arrows (85%) and Razor Arrows
  (75%). Three of the four are "for the whole fight" effects (bleed that never stops, a curse that follows).
  Headbutt (68%) is the strongest Common by a distance because it's a Mega-tier hit anyone can read.
- **Energy is the lever most often off:** Impale 80, Stalactite 65, Erupt 70, Cleansing Water 60, Force Push 60,
  Whiplash 50 all cost more than their hit and effect buy, and the AI's use count shows it (Impale 0.8 a fight).
- **The tier words will expose the plain hits.** Under the bands, Headbutt, Bone Javelin, Stalactite and
  Mega Smash are Mega or Colossal; Claw, Rock Toss, Blessed Bolt and Flame Spit are Basic. Rock Toss at 8 is the
  one plain hit below its peers.
- **Nothing here depends on the formula change:** the standings are relative, and a ×4 on every power keeps
  them. The hidden-power flexibility would let a refresh split "Strong" moves by energy and effect rather than
  by a 15 against a 20.

### The retune (the user, 2026-11-25; built the same day)

The user's rules: a rarity is a band of overall strength (Common 45–55% in this mirror, Uncommon 50–60, Rare
55–65, Epic 62–72, Legendary 70–80); weaken in place rather than move a move up a rarity, so the game stays
bottom-heavy (bloat Rare, keep Epic special); the three cripples stay three separate Uncommon codexes at the same
power. No codex changed rarity, so the registry's rules stand. Two passes, each re-simmed the same way:

| Move | Change | Before | After |
|---|---|---|---|
| Curse | tick power 10 → 6, and a 3-round cooldown | 93% | 78% |
| Healing Blessing | heal 60% → 30%, cooldown 3 → 5, energy 40 → 50 | 88% | 63% |
| Obsidian Arrows | sure bleed stays; 10% → 6% a round | 85% | 68% |
| Razor Arrows | bleed chance 50% → 25% (the gamble to Obsidian's slow sure one) | 75% | 65% |
| Headbutt | recoil 20% → 35% | 68% | 60% |
| Stalactite | energy 65 → 50, 1.5× → 2× a heavy hit | 35% | 70% |
| Impale | energy 80 → 60 | 60% | 58% |
| Erupt | energy 70 → 60 | 50% | 60% |
| Choking Smog | energy 90 → 75 | 53% | 63% |
| Rock Toss | power 8 → 10 | 38% | 45% |
| Force Push | energy 60 → 40 | 35% | 43% |
| Brace | energy 50 → 40 | 40% | 45% |
| Cleansing Water | energy 60 → 40 | 43% | 40% |
| Whiplash | energy 50 → 40 | 48% | 43% |
| Haunting Scream | fallback weaken 3 → 5 rounds | 50% | 50% |

What the passes taught: **power is a weak lever under today's formula.** Curse's tick is power plus the caster's
attack, so 10 → 6 took it from 93% to 88%; the cooldown took it to 78%. Healing Blessing's energy did nothing
(68% at 40, 70% at 50); the heal size did. The five situational moves at the foot (Force Push, Brace, Cleansing
Water, Whiplash, Haunting Scream) read low because a mirror of core-move teams has no hazards, no poison and
no reason to flee; they're priced for what they do in real fights and were left there.

## Trying it by hand: /lab/pvp

A dev-only lab (`npm run dev`, then /lab/pvp; no build has it, nothing is saved) to feel these numbers: pick
two teams of three from the stat table, roll 50 Rare-or-better items, kit each creature out (weapon, three
armour pieces, up to four moves from everything it could learn), see each creature's best hit on each foe,
then fight both sides yourself round by round, every hit logged as damage and a share of HP. A switch at
the top fights under today's rules, K8 or K9; the two-style packages are the sims' transform
(app/lab/pvp/rules.ts), so the game's code is untouched. Under K8 / K9 the HP shown is already ÷2 or ÷2.5
(that's how "hits ×2.5" is carried without touching the engine), and there are no set bonuses.

## How this was run

Throwaway files, tests/twoStylesSim.test.ts, twoStylesPackages.test.ts, twoStylesHpPct.test.ts and threeStylesTanks.test.ts (all deleted after this report), built on the real engine:
`buildFighter`, `createBattle`, `playBattle` (the Normal thinking AI on both sides), `rollItemStats`
and `rollArmorStats` with the two-style ceilings swapped in, `bossTeam` with the bosses' stats folded.
Seeded dice, Lv 16, Rare gear, 40 fights a row, about 1.2 s a fight. The same seeds and rows in both
worlds; gear is rolled each fight, so a row's spread includes gear luck.
