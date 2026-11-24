# Brief: two attack styles (melee + ranged), sim before and after

For a fresh Claude Code session. Read CLAUDE.md first and keep to it. **This is a study, not a
release:** don't commit, don't push, don't change the game's live code paths, don't write any
saves. The only lasting output is one report file (below). Throwaway sim files are deleted at the end.

## The user's idea (2026-11-24)

Drop magic as a style. Every attack is **melee or ranged**; magic-sounding moves stay, each one
filed under melee (a touch spell, a scythe of shadow) or ranged (a bolt, an orb).

Why: with 3 attack styles and 3 defences it isn't clear what a creature does or what defence it
needs. Specialising in defence doesn't pay, because you face every style anyway, so tanks lose to
just stacking damage, and the user puts on "any old armour". With two styles the matchup should
read at a glance, and a tank that picks a side should actually pay off.

The user's decisions (treat as given):

1. **Magic stats go away; every creature is rebalanced.** No creature has 0% in either attack
   style. Every creature is a hybrid to some degree; some are true 50/50 hybrids (by proficiency
   %, and gear can push them). The aim is a forgiving game: a casual player can put a cool weapon
   on a cool creature, use cool-sounding moves and do fine, without hyper-optimising.
2. **The magic core moves (Zap, Blast, Blink) are removed.** They only existed so magic had basic
   coverage.
3. **Weapons lean by their nature:** the Void Scythe is melee at heart (heavily melee), the Chaos
   Orb is ranged at heart, and so on. Draft every weapon.
4. **You make the assumptions** where stats go (magic attack, magic defence, the Runed
   enchantment, Voltage Surge's magic boost, archetypes such as Arcanist / Warden / Battlemage /
   Spellbow, magic codex moves). List each one in the report so the user can overrule it.

## Where things are

- Damage and styles: lib/combat/engine.ts (`ATTACK_STAT`, `DEFENCE_STAT`, `mag` / `magdef`,
  `ARMOR_DEFENCE_WEIGHT`, the ratio formula). AIs: lib/combat/thinkingAi.ts, bossAi.ts.
  Teams: teamBattle.ts, loadout.ts.
- Creatures: lib/creatures (rosterV2.ts, raceKitsV2.ts `CORE_MOVES`, creatureType.ts,
  creatureRoll.ts, levels.ts). Items: lib/items (rollConfig.ts, budgets.ts, ceilings.ts, armor.ts).
  **The item roller is the user's most carefully balanced system:** keep its budgets and roller
  logic as they are; only redistribute the ceilings' magic share to melee and ranged.
- Specs: docs/design/combat.md (Combat V2 section), docs/design/items.md (Gear).
- How the last audit ran its sims, and their limits: docs/balance-audit-2026-11.md, "What this
  rests on". Reuse that approach (throwaway Vitest files); don't re-run its economy sims.

## Method

**Build the two-style version as a transform inside the sim files, not as a refactor of the
game.** For example: a function that takes the current species, moves, weapons and armour and
returns the two-style versions (magic stat folded into melee or ranged per your draft, magic
defence folded in, magic moves re-filed). Run both rule sets through the same harness. That keeps
this cheap and leaves the game untouched.

**Usage budget is tight (the user is at half their usage).** Aim for enough to see the shape, not
precision. Rows of about 40 fights, Normal AI against Normal (plus Hard for one or two key rows),
and a few minutes of sim time per rule set. Stop and report if it's growing past that.

## What to measure (same rows before and after)

1. **Tanks against damage.** A defence-heavy team against a damage-heavy one, at equal level and
   gear rarity (Lv 16, Rare gear, as in the audit). Then the same with the tank's armour picked
   for the foe's main style, against armour picked at random. Does specialising now pay, and by
   how much?
2. **The casual player.** A team in random gear of the right rarity against the same team in
   gear that fits its styles. The gap should shrink (decision 1). How big is it before and after?
3. **Hybrids.** True 50/50 hybrids against specialists, and against tanks of either side. Are
   hybrids now the answer to tanks, and are they too strong?
4. **Nothing else breaks:** fight length (hits to KO), the race chart's edge (it was 68% of even
   duels), and the bosses at full health, Normal party, a few runs each.

## The report: docs/two-styles-sim-2026-11.md

Plain English, short, tables where they help:

- The short version: does two styles do what the user wants? Yes, no or partly, with the key numbers.
- **The draft:** each of the 35 creatures' new melee / ranged %s (and a one-line why); each
  weapon's lean; armour ceilings and enchantments remapped; the archetypes renamed or merged;
  every magic codex move filed as melee or ranged; which core moves each creature knows now.
- Before and after for each row above, with ±8 points noted as the noise on 40-fight rows.
- Every assumption you made, numbered, for the user to overrule.
- **Options, not changes** (CLAUDE.md hard rule 3): if tanks still lose, give 2–3 ways to nudge
  them (e.g. a set bonus, the defence weight) with sim numbers, and don't pick one.
- What a real build would need (not doing it now): save conversion for rolled magic stats and
  magic-style creatures, the registry rules migration (`npm run registry:rules`), the Labyrinth
  golden, doc updates, and anything showing foes' styles on screen.

Finish by deleting the throwaway sim files, checking `git status` shows only the report (and this
brief), and telling the user the headline in a few lines.
