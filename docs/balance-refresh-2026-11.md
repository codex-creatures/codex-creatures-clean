# The balance refresh: decision report (2026-11-25)

What was decided across the two-style study, the tank rounds and the codex move audit
(docs/two-styles-sim-2026-11.md), what is drafted and needs the user's yes, and what is still open. Nothing in
this file is built yet except the codex move retune (pushed 2026-11-25). When the user signs it off, the decided
parts move into docs/design/combat.md and docs/decisions.md and get built in the order at the end.

## The short version

1. **Three styles stay.** Two styles never did the balancing; the knobs did. Magic keeps the roster's room to grow.
2. **Codexes show a tier word on their own, and a damage range on a creature.** Weak, Basic, Strong, Mega,
   Colossal are bands of hidden power. Held up to a creature, a move shows "X–X" in its style's colour, the
   real hit before armour, ±5%. No raw number on the codex itself.
3. **Tanks get defences that follow what they're made of**, with one clear weakness each; every other creature's
   %s are untouched; the three sided plates lose their other sides.
4. **Every creature gets an HP %**, a proficiency like the others, multiplying its whole HP, gear included.

Decided by the user: 1, the shape of 2, 3 and 4. Drafted by Claude for the user to confirm: the tier bands, the
eight tanks' numbers, the 35 HP %s. Open: whether the damage formula changes (T1 or T2) and whether move powers
are rescaled (×4) so the tiers read true.

## 1. How codexes are displayed

**A codex on its own** (bookcase shelf, loot window, a librarian's stall, a codex floating over the bookcase):
no number. It shows its tier word, its style, its energy, its effect in one line, and who can read it. The tier
word is the move's hidden power placed in a band. Bands in today's units (a Strike is 10):

| Tier | Hidden power | Today's moves there |
|---|---|---|
| Weak | 8 or less | Nibble, Dark Seal, Smoke Bomb, Bounce, Force Push |
| Basic | 9–12 | Strike, Shot, Zap, Claw, Rock Toss, Slap, Poison Dart, Bolas Shot, Haemorrhage, Pin Down, Flame Spit |
| Strong | 13–30 | Rush, Smash, Whiplash, Pounce, Ambush, Obsidian and Razor Arrows, Vampiric Bite, Soul Snatch, Smite, Erupt, Impale, Cursed Claw, Blessed Bolt, Emulate, Septic Shock, Fissure, Barrage |
| Mega | 31–45 | Bone Javelin (32), Headbutt (35) |
| Colossal | 46 and up | Stalactite (50), Mega Smash (62), Implode (62) |

Two Strongs can differ in hidden power; the word is what the player sees. Utility moves (no hit) show "Utility"
as they do now. If move powers are rescaled (open question B) the bands scale with them, so the words don't
move.

**A codex held up to a creature** (the creature's Moves tab in the Pit, the bookcase's teach flow, the battle
screen's move buttons): the range, "93–103", in the style's colour, under the move's name. It is hidden power +
the creature's weapon attack × its style %, with the ±5% wobble every hit has, before armour and before the
race chart. In a fight the existing "about X against this foe" estimate stays as the after-armour number. No
"Raw 98" line (the user: only the range).

**The viewer:** flicking the codex between creatures changes the range live, so a Shot reads 40–44 on a bruiser
and 95–105 on an archer. That is where the player learns that the creature is the power and the codex the
shape of the swing. The bookcase window already flicks between codexes with the side arrows; the same arrows
over the Pit's creature window do this.

**Why not a number on the codex alone:** a hit is mostly the creature (about 58 of a Lv 16 wolf's 68 Strike),
so any fixed number would be false for every other creature, and showing the true share would make every codex
look weak. The tier word is honest and reads as power. (The alternatives weighed, and why they lost, are in
docs/two-styles-sim-2026-11.md.)

## 2. How the defensive stats are reshuffled

**Every creature's three defences** (melee / ranged / magic def) keep today's total and lean to what the creature
is made of, with one clear weakness (the user, 2026-11-25: not just the tanks; the Amber Wasp is weak to
ranged, say). Attack %s and agility are untouched. A tank still out-defends an attacker of its rarity on the
totals (Glob 68 against the Rares' 18–33; Crystal Golem 78 and Dreadpox 70 against the Epics' 30–48); the
legendary attackers have Epic-tank totals, as legendaries do, and now a weakness each.

| Creature | Today | Draft | Read |
|---|---|---|---|
| Moss Wolf | 4/2/3 | 5/1/3 | a running wolf; arrows find it |
| Amber Wasp | 3/3/3 | 4/1/4 | swatted from range (the user's example) |
| Bellow Toad | 10/3/18 | 11/2/18 | slimy hide and poison glands; a soft target for arrows |
| Dire Wolf | 12/8/10 | 14/5/11 | fur against teeth; shot down |
| Ironhide | 44/30/37 | 60/33/18 | hide against teeth, then arrows; magic goes through |
| Cave Goblin | 2/6/4 | 2/6/4 | already weak to melee: small, crushed |
| Rust Beetle | 24/12/18 | 20/28/6 | a shell that sheds arrows; rust fails against magic |
| Crystalback | 30/24/30 | 12/30/42 | crystal takes magic; big hits shatter it |
| Crystal Golem | 32/20/26 | 12/27/39 | the user's split: magic, then arrows, shattered by big hits |
| Hollow Matriarch | 24/22/23 | 24/9/28 | the user: strong against magic, weaker to melee, arrows are its weakness |
| Dust Sprite | 2/4/6 | 1/5/6 | a swat disperses it |
| Flicker Wisp | 4/6/8 | 2/7/9 | the same |
| Veilstalker | 6/6/8 | 10/8/2 | half out of phase; magic finds it (the user's numbers) |
| The Watcher | 10/16/20 | 16/8/22 | an eye: an arrow in it |
| Void Serpent | 20/20/24 | 26/26/12 | scales shed blades and bolts; magic doesn't care |
| Rattlebones | 8/4/6 | 3/9/6 | arrows pass between the bones; a club breaks them |
| Shambler | 16/10/13 | 22/12/5 | blows sink into rot; magic burns it |
| Dustwraith | 4/8/6 | 6/9/3 | a whirlwind: arrows blown aside, magic unmakes it |
| Mr. Shadows | 18/14/16 | 24/16/8 | blades pass through a shade; light burns it |
| Skull Raven | 14/24/19 | 20/11/26 | a bird: shot down |
| Thicket Archer | 2/4/3 | 1/5/3 | in cover from arrows; caught in melee |
| Leafblade Scout | 4/4/4 | 5/5/2 | nimble; no answer to magic |
| Aurelius | 16/6/11 | 16/6/11 | already weak to ranged: a big target |
| Swamp Witch | 8/14/11 | 4/16/13 | frail; keeps arrows and spells off |
| Sylvaran | 16/24/20 | 10/28/22 | an archer caught in melee |
| Gleamling | 2/4/6 | 1/5/6 | a mote; swatted |
| Flame Imp | 4/6/8 | 5/3/10 | a small flame; a thrown stone puts it out |
| Thunderhead | 16/22/24 | 20/22/10 | the user: the same lean, less defence and more HP (HP % 25 → 40): a storm is bulk, not armour |
| Deep Angler | 8/10/10 | 12/11/5 | the user: melee and magic swapped; a fish that bites, undone by magic |
| Tunnel Wyrm | 34/24/24 | 50/24/8 | stone plates; soft to magic |
| Plague Rat | 4/4/4 | 2/5/5 | stomped |
| Rotgut Fly | 4/6/6 | 6/3/7 | bloated; a bolt pops it |
| Glob | 26/20/22 | 32/26/10 | the user's read: blows and bolts sink in, magic ignores the goo |
| Dreadpox | 22/20/28 | 10/22/38 | the dreamcatcher catches curses; bones break |
| The Pale Rider | 22/20/24 | 22/20/8 | the user: below Thunderhead, as the harder hitter; holy fire burns the undead |

**On the rarity gap** (the user asked whether a Rare's 20–30 total against a Legendary's 60–111 is too wide):
the %s multiply armour rather than being the defence, so a 60% and a 10% are ×1.6 and ×1.1 on the same plate, a
half again, not six times; they scale with level (nothing at Lv 1, as listed at Lv 15, double at Lv 29); and
ascension adds each rarity's gap along the creature's own shape, so a climbed Common lands near a natural
Legendary's totals and keeps its role. The gap is the rarity design, and it closes as the game means it to.

Measured (1v1, Lv 16, Rare gear fitted to role, 40 fights, ±8; "A" is the lower rarity; the stats are what each has in
the fight: HP, best attack, average defence):

| Matchup | Today | Package (no ×4) | Today's in-fight numbers, A v B |
|---|---|---|---|
| Rare attacker v Epic attacker (Deep Angler v Dire Wolf) | 28% | 40% | HP 206 v 238 · atk 67 v 78 · def 69 v 69 |
| Rare attacker v Legendary attacker (Deep Angler v Pale Rider) | 33% | 30% | HP 193 v 282 · atk 67 v 77 · def 69 v 77 |
| Rare archer v Legendary archer (Aurelius v Sylvaran) | 20% | 25% | HP 210 v 278 · atk 99 v 125 · def 70 v 75 |
| Rare wall v Epic attacker (Glob v Dire Wolf) | 18% | 50% | HP 257 v 238 · atk 25 v 78 · def 81 v 69 |
| Rare wall v Legendary attacker (Glob v Pale Rider) | 13% | 38% | |
| Rare magic wall v Legendary caster (Crystalback v Thunderhead) | 0% | 30% | |
| Common v Legendary (Moss Wolf v Pale Rider) | 8% | 8% | HP 164 v 281 · atk 63 v 77 · def 64 v 77 |
| Climbed to Legendary: Deep Angler +2 v Pale Rider | 63% | 68% | HP 264 v 282 · atk 80 v 77 · def 75 v 77 |
| Aurelius +2 v Sylvaran | 55% | 55% | HP 281 v 278 · atk 118 v 125 |
| Glob +2 v Pale Rider | 33% | 68% | |
| Crystalback +2 v Thunderhead | 3% | 60% | |
| Moss Wolf +4 v Pale Rider | 65% | 75% | HP 288 v 281 · atk 93 v 77 |
| Pale Rider v Pale Rider (yardstick) | 40% | 43% | |

One rarity step is about 70/30, two about 75/25, Common to Legendary 92/8. The %s exaggerate it: Rare to
Legendary reads 38 against 76 attack % and is 67 against 77 in the fight (+15%), defence +12%; **the real gap is
HP, 193 against 282**, from base HP 88 against 140. Ascension closes it completely: a climbed Rare meets a natural
Legendary at par or a little above, and a climbed Common edges one (65%) because its budget lands along its own
attacking shape. Walls today can't win up a rarity (Glob 13%, Crystalback 0%, climbed 33% / 3%); under the package
they can (38%, 30%; climbed 68%, 60%).

### The package simmed on all 35 (2026-11-25)

The whole package at once: the table above, the HP %s, armour counting in full, every move's hidden power ×4,
HP as today. Every creature one on one at Lv 16 in Rare gear fitted to its role, against a melee, a ranged and a
magic attacker of its own rarity in Juggernaut with their style's best weapon (20 fights each, ±11; no Epic
ranged attacker exists, so Aurelius stands in). Its wins:

| Creature | def | HP % | v melee | v ranged | v magic | Reads |
|---|---|---|---|---|---|---|
| Moss Wolf (C) | 5/1/3 | 20 | 65% | 80% | 80% | the strongest Common |
| Cave Goblin (C) | 2/6/4 | 15 | 55% | 60% | 45% | even |
| Dust Sprite (C) | 1/5/6 | 0 | 15% | 60% | 45% | a mote: swatted, as drawn |
| Rattlebones (C) | 3/9/6 | 20 | 50% | 85% | 90% | arrows pass between the bones |
| Thicket Archer (C) | 1/5/3 | 5 | 45% | 55% | 70% | |
| Gleamling (C) | 1/5/6 | 0 | 20% | 25% | 60% | frail |
| Plague Rat (C) | 2/5/5 | 15 | 50% | 55% | 75% | |
| Amber Wasp (U) | 4/1/4 | 10 | 70% | 50% | 60% | its arrow weakness shows as the lowest |
| Rust Beetle (U) | 20/28/6 | 60 | 65% | 100% | 70% | a wall; its magic weakness barely shows (the Uncommon caster is a 20) |
| Flicker Wisp (U) | 2/7/9 | 5 | 15% | 50% | 55% | swatted |
| Shambler (U) | 22/12/5 | 50 | 100% | 80% | 80% | a wall over its rarity's attackers |
| Leafblade Scout (U) | 5/5/2 | 15 | 60% | 45% | 40% | its magic weakness shows |
| Flame Imp (U) | 5/3/10 | 5 | 35% | 65% | 50% | |
| Rotgut Fly (U) | 6/3/7 | 5 | 45% | 70% | 60% | |
| Bellow Toad (R) | 11/2/18 | 30 | 55% | 40% | 95% | arrows are its weakness, magic bounces off |
| Crystalback (R) | 12/30/42 | 70 | 70% | 65% | 100% | |
| Veilstalker (R) | 10/8/2 | 10 | 20% | 20% | 55% | **weak overall at Rare** |
| Dustwraith (R) | 6/9/3 | 0 | 20% | 10% | 35% | **weak overall**: a 14-magic caster with no HP |
| Aurelius (R) | 16/6/11 | 25 | 55% | 35% | 80% | arrows are its weakness |
| Deep Angler (R) | 12/11/5 | 30 | 45% | 40% | 90% | |
| Glob (R) | 32/26/10 | 70 | 95% | 50% | 95% | the Rare caster can't punish its magic weakness |
| Dire Wolf (E) | 14/5/11 | 25 | 65% | 70% | 60% | strong |
| Crystal Golem (E) | 12/27/39 | 60 | 20% | 60% | 95% | **the user's spec exactly**: shatters to melee, holds magic |
| The Watcher (E) | 16/8/22 | 15 | 45% | 40% | 55% | |
| Mr. Shadows (E) | 24/16/8 | 20 | 50% | 25% | 10% | **weak overall for an Epic**: 14/0/24 attack is low; its magic weakness bites hard |
| Swamp Witch (E) | 4/16/13 | 10 | 30% | 45% | 55% | frail caster, as drawn |
| Tunnel Wyrm (E) | 50/24/8 | 80 | 90% | 70% | 75% | its magic weakness doesn't show: 80% HP carries it past the Witch |
| Dreadpox (E) | 10/22/38 | 60 | 50% | 75% | 100% | |
| Ironhide (L) | 60/33/18 | 50 | 100% | 55% | 20% | holds melee, falls to Thunderhead |
| Hollow Matriarch (L) | 24/9/28 | 25 | 45% | 60% | 45% | its arrow weakness doesn't show: it kills Sylvaran first |
| Void Serpent (L) | 26/26/12 | 20 | 30% | 55% | 50% | |
| Skull Raven (L) | 20/11/26 | 5 | 35% | 45% | 40% | a glass cannon among Legendaries |
| Sylvaran (L) | 10/28/22 | 10 | 30% | 55% | 20% | melee weakness shows; Thunderhead beats it |
| Thunderhead (L) | 20/22/10 | 40 | 65% | 70% | 60% | **the strongest Legendary**: 44 magic and 40% HP |
| The Pale Rider (L) | 22/20/8 | 30 | 50% | 80% | 50% | |

What it says, and what Claude would adjust (the user's call):

- **Weaknesses bite where the counter can also take a hit.** The Golem (20% to melee), Ironhide (20% to magic),
  Mr. Shadows (10% to magic), Sylvaran (30% to melee), Leafblade (40% to magic), Bellow Toad and Aurelius (40%
  and 35% to arrows) all show theirs. Where a weakness doesn't show it's because the creature kills the counter
  first (the Matriarch's 40 melee against Sylvaran) or outlasts it on HP (the Wyrm's 80% against the Witch), or
  the rarity's attacker in that style is frail (every Common and Uncommon caster).
- **Four creatures read weak for their rarity:** Veilstalker and Dustwraith at Rare, Mr. Shadows at Epic,
  Skull Raven at Legendary. The first three were never built as attackers (Dustwraith is an agility creature with
  14 magic; Mr. Shadows has 38 total attack where other Epics have 46–52). Suggested: HP % Veilstalker 10 → 25,
  Dustwraith 0 → 15, Mr. Shadows 20 → 35, Skull Raven 5 → 20; and Mr. Shadows' attack is worth a look in its
  own right.
- **Tanks at low rarity dominate their rarity** (Shambler 100/80/80, Rust Beetle 65/100/70) because Uncommon
  attackers hit for little. That's rarity doing its job, but if it feels like too much, Shambler's HP % 50 → 40
  and Rust Beetle's 60 → 50 would trim it.
- **Thunderhead** at 65/70/60 against the other Legendaries is the roster's strongest; its 40% HP (the user's
  call: bulk over armour) with 44 magic does it. If that's too much, 40 → 30.
- **The Wyrm's magic weakness** only shows as 75% because of its 80% HP. If the user wants its weakness to bite,
  80 → 65.

**The three sided plates** keep their side and lose the other two to 15 at Rare (scaled by rarity): Colossal
Shellarmor (melee), Arrowward Mantle (ranged), Arcane Nullifier (magic). Frontier's Mail, Dragonscale,
Chainbolster and Juggernaut are unchanged. Set bonuses are unchanged (magic stays, so Nullify keeps its meaning).
No style-specific set bonuses are added (the user).

**What it does** (round 5 of the study, with the HP %): melee walls hold melee attackers 80% (today 30%), magic
walls hold magic 83% (today 18%), the Golem holds a Swamp Witch and shatters to a Dire Wolf, a tank is worth
more than a slot (63%), and the sided plate is no longer worse than the all-round plate against a mixed team.

**Saves.** A creature's saved %s are its species' plus its rolls. Changing a species' defences would make an old
save's values read as big rolls, so owned tanks get a one-time move on load, like `upgradeStyle` did for the
2026-10-27 restyles: new species defences plus the creature's old rolls (saved minus the old species values,
kept in a table for the migration). The registry's rules carry species, so `npm run registry:rules` and its
migration follow.

## 3. How the HP % is added

**A new proficiency, `hp`,** beside atk / rng / mag / agil / mdef / rdef / magdef. A creature's HP in a fight is
(its level HP + its weapon's HP + its armour's HP) × (1 + hp% / 100). Gear HP counts more in a wall's hands,
which is the point: a Bulwark is a tank's weapon.

**Draft values** (Claude's, by identity; the user to adjust):

| Band | HP % | Creatures |
|---|---|---|
| Walls | 50–80 | Tunnel Wyrm 80, Glob 70, Crystalback 70, Crystal Golem 60, Rust Beetle 60, Dreadpox 60, Shambler 50, Ironhide 50 |
| Bruisers | 10–30 | Deep Angler 30, Pale Rider 30, Dire Wolf 25, Moss Wolf 20, Rattlebones 20, Cave Goblin 15, Plague Rat 15, Amber Wasp 10 |
| Hybrids | 10–40 | Thunderhead 40 (the user: bulk over armour), Bellow Toad 30, Hollow Matriarch 25, Void Serpent 20, Mr. Shadows 20, Leafblade Scout 15, Veilstalker 10 |
| Snipers, casters, assassins | 0–25 | Aurelius 25, The Watcher 15, Sylvaran 10, Swamp Witch 10, Flicker Wisp 5, Flame Imp 5, Thicket Archer 5, Rotgut Fly 5, Skull Raven 5, Dust Sprite 0, Gleamling 0, Dustwraith 0 |

**Rules around it:**
- **It does not level or ascend like the other %s.** Those are 0 at Lv 1, as listed at Lv 15 and double at Lv 29
  (`levelFactor`), and ascension spreads a budget along the species' shape; an HP % treated the same would be
  nothing at Lv 1 and 160% on a Lv 29 wall, on top of HP that already grows with level. So: a fixed species
  value, a creature's birth roll may move it a few points like any stat, and ascension adds a flat +5 a step.
  (Revised 2026-11-25 from the first draft, which had it levelling.)
- It shows in the creature's window with the other %s, and the Pit's stat sliders if the Bestiary gets them.
- Saves: the field is optional; a creature without one takes its species' value (so old saves gain it on load,
  with no roll).
- **Bosses get their own HP %,** set when each boss is re-numbered; without it the Hydra gets easier (45% →
  70–90% in the sims) because the party has HP % and the boss doesn't.
- **Potions:** the flat 50 stays (the user); a %-based Epic potion is the user's to add. Venom, poison, bleed,
  blood and clouds are already shares of max HP, so they scale with it.
- Klutz: his points are spent by the player; HP % joins the stats his points can buy (the user to confirm).
- The registry's rules carry species %s, so the migration above covers this too.

### The package's team rows (2026-11-25): ×4 on an additive formula flattens who hits hard

The round-5 rows under the whole package (every creature's defences, the HP %s, armour in full, every move's
hidden power ×4, HP as today; 40 fights, ±8):

| Row | Today | T2 (round 5) | The package |
|---|---|---|---|
| Melee walls v melee attackers | 30% | 83% | **100%** |
| Melee walls v ranged attackers | 5% | 13% | **35%** |
| Melee walls v magic attackers (their weakness) | 10% | 28% | **85%** |
| Magic walls v magic attackers | 18% | 90% | 100% |
| Magic walls v melee attackers (their weakness) | 15% | 18% | 45% |
| Melee walls, sided plate v mixed / all-round plate v mixed | 8 / 3 | 33 / 33 | **70 / 53** |
| A tank in a team v a third attacker | 48% | 65% | **88%** |
| 1v1 Tunnel Wyrm v Dire Wolf / v Sylvaran / v Swamp Witch | 30 / 10 / 25 | 70 / 25 / 40 | 98 / 58 / 75 |
| 1v1 Crystal Golem v Swamp Witch / v Dire Wolf | 25 / 18 | 55 / 10 | 100 / 45 |
| Casual random gear v fitted | 15% | 8% | 18% |
| Race edge | 70% | 68% | 83% |
| Cyclops / Hydra / Minotaur, un-retuned | 90 / 45 / 95 | 85 / 85 / 100 | 100 / 90 / 100 |
| Hits to knock out, mixed-team row | 7.2 | 7.8 | 7.1 |

(HP ÷ 1.2 as well: the same shape, fights a tenth shorter, the magic walls' weakness a little sharper at 60%.)

The hold is total and the sided plate beats the all-rounder at last, but **the crumble is gone**: melee walls
beat the magic attackers they're weak to 85% of the time, a tank is worth far more than a slot (88%), the Golem
no longer shatters (45%). The cause is the ×4 itself. Damage adds the move's power to the creature's weapon × %,
and today the creature's part is most of the hit, so a Tunnel Wyrm's Smash (56) is 1.5× below a Dire Wolf's
(83). With powers ×4 the move is most of the hit, 131 against 158, a 1.2× gap: walls hit nearly as hard as
attackers, frail casters die to a wall's heavy before their magic breaks through, and the weakness never bites.
The same flattening is what lifts the casual row and lets the sided plate win, so it isn't all loss, but "a tank
does little damage" is.

**What follows:** the tier words need the move to be the bigger part of a hit, and "tanks hit softly" needs the
creature to be the bigger part. Adding can't give both. Multiplying can: if the move's number multiplies the
creature's swing (weapon × %) instead of adding to it, the Wyrm-to-wolf gap is the swing gap, 31 against 58
(1.85×, sharper than today), while a 15 is exactly one and a half times a 10 everywhere. So question B becomes
"multiply", not "×4": the move table re-drafted in swing units (Strike 10, Smash 15, Rush 12, Bone Javelin 20,
Stalactite 23, Mega Smash 38; bosses likewise), carried behind a flag in `lib/combat/engine.ts` like the triangle
switch the sims use, off by default, and simmed on these rows before anything is built. If the user would rather
not change the formula at all, the fallback is T1 as it stood (no ×4): the hold at 80%, the crumble kept, the
tier words only approximately true.

## Open: the two questions that gate the rest

**A. The damage formula.** T1 (nothing changes: armour at a third as today) gives the shape above at the cost
of fights about 70% longer and walls holding their counters too well one on one (38% against Sylvaran, 53%
against the Witch). T2 (armour counts in full, `ARMOR_DEFENCE_WEIGHT` 1/3 → 1; hits twice as big next to HP,
`HP_SCALE` 1.5 → 0.75 or the equivalent) keeps the hold, restores the crumble (25% / 40%) and today's fight
length, and costs every boss and every flat heal a re-number. **Recommendation:** T1 first, T2 if the long
matched fights bother the user in the lab. Both are in /lab/pvp to feel.

**B. Move powers ×4.** The tier words only read as true if the move is the bigger half of a hit; today a Basic
and a Strong land within a fifth of each other. ×4 on every hidden power (Strike 40, Smash 100) makes the move
about 60% of a hit at Lv 16 Rare, keeps gear at about 40%, and makes hits about 1.7× today's, which is most of
T2's "hits ×2" without a hidden multiplier. HP then rises to hold the pace wanted. Every boss's moves follow.
**Recommendation:** yes, together with A, as one retune with the bosses.

**C. Also open,** smaller: the three sustained weapons' HP ceilings (Void Scythe, Thunderhead Crossbow, Soul
Storm at 85 against their 75 attack; the user: HP should not pass the main stat); a true 90/90 Trident for the
50/50 hybrids; weapons' off-style ceilings (25 → 45) for the casual player; whether ×10 on shown numbers is
wanted for feel.

## Build order (once signed off)

1. **The HP %** (lib/creatures: `CreatureProficiency`, species values, levels and ascension, rolls; loadout's
   HP; the creature window and type labels; saves' default; registry rules migration). Tests: creatures, levels,
   saves, the Labyrinth golden (re-record as an "Intended change" commit: every foe's HP moves).
2. **The tanks' defences and the sided plates** (species table + the on-load move; armour ceilings; docs).
3. **Tier words and ranges on codexes** (a `tierOf(power)` in lib; CardFace / the codex window / the bookcase
   teach flow / the Pit's Moves tab / BattleScreen's move buttons; Help "?" text). Pure display: no rules change.
4. **A and B if taken:** `ARMOR_DEFENCE_WEIGHT`, `HP_SCALE`, every move's hidden power ×4 (core moves, codex
   moves, boss moves, Klutz), bosses re-numbered with HP %s, flat heals; the pvp rivals replayed
   (`npm run pvp:rivals`); the golden re-recorded.
5. Docs each step: combat.md, items.md, creatures, decisions.md; the privacy page if the registry's stored
   fields change.
