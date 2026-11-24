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

**Only the eight tanks change.** Their three defences (melee / ranged / magic def) keep today's total and lean
to what the creature is made of, with one clear weakness (the user's rule, with the Crystal Golem and Glob as
his examples). Everything else about every creature, and every attacker's %s, stays.

| Tank | Today | Draft | Why |
|---|---|---|---|
| Crystal Golem | 32/20/26 | 12/27/39 | crystal takes magic, rock takes arrows, big hits shatter it (the user's split) |
| Glob | 26/20/22 | 32/26/10 | blows sink in, bolts stick, magic ignores the goo (the user) |
| Tunnel Wyrm | 34/24/24 | 50/24/8 | plates of stone against teeth and arrows; soft to magic |
| Rust Beetle | 24/12/18 | 20/28/6 | a shell that sheds arrows; rust fails against magic |
| Shambler | 16/10/13 | 22/12/5 | blows sink into rot; holy and magic burn it |
| Crystalback | 30/24/30 | 12/30/42 | the Golem's pattern, crystal first |
| Dreadpox | 22/20/28 | 10/22/38 | the dreamcatcher catches curses; bones break |
| Ironhide | 44/30/37 | 60/33/18 | hide against teeth, then arrows; magic goes through |

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
| Hybrids | 10–30 | Bellow Toad 30, Hollow Matriarch 25, Thunderhead 25, Void Serpent 20, Mr. Shadows 20, Leafblade Scout 15, Veilstalker 10 |
| Snipers, casters, assassins | 0–25 | Aurelius 25, The Watcher 15, Sylvaran 10, Swamp Witch 10, Flicker Wisp 5, Flame Imp 5, Thicket Archer 5, Rotgut Fly 5, Skull Raven 5, Dust Sprite 0, Gleamling 0, Dustwraith 0 |

**Rules around it:**
- It rolls like the other %s (a creature's zero-sum ± rolls can land on HP), it levels like them (0 at Lv 1,
  full at Lv 15), and ascension adds to it like the rest. Claude's recommendation; the user may prefer it fixed.
- It shows in the creature's window with the other %s, and the Pit's stat sliders if the Bestiary gets them.
- Saves: the field is optional; a creature without one takes its species' value (so old saves gain it on load,
  with no roll).
- **Bosses get their own HP %,** set when each boss is re-numbered; without it the Hydra gets easier (45% →
  70–90% in the sims) because the party has HP % and the boss doesn't.
- **Potions:** the flat 50 stays (the user); a %-based Epic potion is the user's to add. Venom, poison, bleed,
  blood and clouds are already shares of max HP, so they scale with it.
- Klutz: his points are spent by the player; HP % joins the stats his points can buy (the user to confirm).
- The registry's rules carry species %s, so the migration above covers this too.

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
