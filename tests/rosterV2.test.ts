import { describe, it, expect, vi } from "vitest";
import { BALANCED_MOVES, KIT_MOVES, KIT_MOVE_RACE, KIT_NUMBERS, KIT_RACE_MOVES, NEUTRAL_QUICK_MOVES, kitFor, kitMoveFor } from "../lib/creatures/raceKitsV2";
import { rollMoves } from "../lib/creatures/creatureRoll";
import { ARCHETYPE_INFO, NEW_SPECIES_V2, SPECIES_ARCHETYPE, V2_RESTYLE, v2Moves } from "../lib/creatures/rosterV2";
import { CREATURE_TEMPLATES as ROSTER_V2 } from "../lib/creatures/creatureData";
import { RACES_V2, SPECIES_RACES } from "../lib/creatures/racesV2";
import { ALL_SKILLS, LEARNABLE_MOVES, MOVE_BY_NAME, PRE_V2_SPECIES, STARTING_MOVES, defaultMoveNames, resolveMoves } from "../lib/creatures/creatureData";
import { createBattle, resolveRound, type BattleAction } from "../lib/combat/battle";
import { buildFighter } from "../lib/combat/loadout";
import { raceMultiplier, raceOfMove, RACE_EFFECT, MATCH_BONUS } from "../lib/combat/raceChart";
import { calcDamage, LIVE_RULES, setCombatRules, TRIANGLE_RULES } from "../lib/combat/engine";
import { afterEach } from "vitest";

afterEach(() => setCombatRules(LIVE_RULES));

const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];
const v2 = (id: string) => ROSTER_V2.find((c) => c.id === id)!;

describe("Combat V2 race kits", () => {
  it("4 race moves per race in each style, plus 2 Neutral moves per style: 90, all new names", () => {
    expect(KIT_MOVES).toHaveLength(7 * 3 * 4 + 6);
    expect(new Set(KIT_MOVES.map((m) => m.name)).size).toBe(90);
    for (const m of KIT_MOVES) expect(MOVE_BY_NAME[m.name], m.name).toBe(m);
    expect(new Set([...KIT_MOVES.map((m) => m.name), ...ALL_SKILLS.map((m) => m.name), ...LEARNABLE_MOVES.map((m) => m.name)]).size)
      .toBe(90 + ALL_SKILLS.length + LEARNABLE_MOVES.length);
    expect(KIT_RACE_MOVES).toHaveLength(7 * 3 * 4);
  });

  it("the Neutral priority moves: no race, 15 damage for 50 energy, always first", () => {
    for (const m of Object.values(NEUTRAL_QUICK_MOVES)) {
      expect([m.damage, m.energyCost, m.effect?.kind]).toEqual([15, 50, "quick"]);
      expect(KIT_MOVE_RACE[m.name]).toBeUndefined();
      expect(raceOfMove(m)).toBeUndefined();
    }
    expect(Object.values(NEUTRAL_QUICK_MOVES).map((m) => m.name)).toEqual(["Rush", "Quickshot", "Blink"]);
  });

  it("the light move is Balanced: the same in every kit of a style, with no race", () => {
    for (const style of ["melee", "ranged", "magic"] as const) {
      for (const race of RACES_V2) expect(kitMoveFor(race, style, "light")).toBe(BALANCED_MOVES[style]);
      expect(raceOfMove(BALANCED_MOVES[style])).toBeUndefined();
      expect(raceMultiplier(BALANCED_MOVES[style], { races: ["beast"] }, { races: ["humanoid"] }, "drafted")).toBe(1);
    }
  });

  it("a creature that still knows a retired light move gets its Balanced move", () => {
    expect(resolveMoves(v2("moss_wolf"), ["Claw Swipe", "Gore"]).map((m) => m.name)).toEqual(["Strike", "Gore"]);
    expect(MOVE_BY_NAME["Claw Swipe"]).toBe(BALANCED_MOVES.melee);
  });

  it("every kit is a 20, 30 and 50 energy move, a quick attack and a precise move", () => {
    for (const race of RACES_V2) for (const style of ["melee", "ranged", "magic"] as const) {
      const [light, medium, heavy, quick, precise] = kitFor(race, style);
      expect([light, medium, heavy].map((m) => m.energyCost)).toEqual([20, 30, 50]);
      expect(quick.effect?.kind).toBe("quick");
      expect(precise.effect).toEqual({ kind: "precise", hitChance: 0.7 });
      expect(kitFor(race, style).every((m) => m.type === style)).toBe(true);
      expect([medium, heavy, quick, precise].every((m) => KIT_MOVE_RACE[m.name] === race)).toBe(true);
    }
    expect(KIT_NUMBERS.heavy).toEqual({ damage: 25, energyCost: 50 });
  });

  it("kit moves count as their race on the chart", () => {
    const gore = kitMoveFor("beast", "melee", "medium");
    // Beast beats Humanoid, and the wolf is a Beast: effective plus the match bonus.
    expect(raceMultiplier(gore, { races: ["beast"] }, { races: ["humanoid"] }, "drafted")).toBeCloseTo(RACE_EFFECT.strong * MATCH_BONUS);
  });

  it("the quick attack strikes first even when slower", () => {
    const hit = (skillName: string): BattleAction => ({ kind: "attack", skillName });
    const slow = buildFighter(v2("ironhide"), { melee: 20 }, { mDef: 5, rDef: 5 }, ["Lunge", "Gore"]);   // agility 10%
    const fast = buildFighter(v2("amber_wasp"), { ranged: 20 }, { mDef: 5, rDef: 5 });                    // agility 22%
    const s = createBattle([slow], [fast]);
    resolveRound(s, { A: hit("Lunge"), B: hit(fast.skills[0].name) });
    const first = s.log.find((e) => e.type === "attack");
    expect(first?.type === "attack" && first.attacker).toBe("Ironhide");
  });
});

describe("Combat V2: no damage types", () => {
  it("force, pierce and arcane hit the same with damage types off", () => {
    const wolf = buildFighter(v2("moss_wolf"), { melee: 30 }, { mDef: 30, rDef: 30, magDef: 30 });
    const golem = buildFighter(v2("crystal_golem"), { melee: 30 }, { mDef: 30, rDef: 30, magDef: 30 });
    const as = (dmgType: "force" | "pierce" | "arcane") => ({ name: "Test", damage: 25, energyCost: 50, type: "melee" as const, dmgType });
    const dmg = (t: "force" | "pierce" | "arcane") => { const r = vi.spyOn(Math, "random").mockReturnValue(0.5); const d = calcDamage(as(t), wolf, golem, false).damage; r.mockRestore(); return d; };
    setCombatRules(TRIANGLE_RULES);
    expect(dmg("force")).not.toBe(dmg("pierce")); // the old rules: they differ
    setCombatRules(LIVE_RULES);
    expect(new Set([dmg("force"), dmg("pierce"), dmg("arcane")]).size).toBe(1);
  });
});

describe("Combat V2 roster", () => {
  it("35 creatures, one of each rarity per race by first race (the Pale Rider made Undead's Legendary a pair)", () => {
    expect(ROSTER_V2).toHaveLength(35);
    for (const race of RACES_V2) {
      const rs = ROSTER_V2.filter((c) => SPECIES_RACES[c.id][0] === race).map((c) => c.rarity).sort();
      const want = race === "undead" ? [...RARITIES, "legendary"] : race === "toxic" ? RARITIES.slice(0, 4) : RARITIES;
      expect(rs, race).toEqual([...want].sort());
    }
  });

  // (Even at 4 each, 3 Snipers, until the Deep Angler became a melee Battlemage, 2026-10-26.)
  it("the archetypes are near even: 4 each, 3 Snipers and Spellbows, 5 Battlemages", () => {
    const counts: Record<string, number> = {};
    for (const c of ROSTER_V2) counts[SPECIES_ARCHETYPE[c.id]] = (counts[SPECIES_ARCHETYPE[c.id]] ?? 0) + 1;
    for (const a of Object.keys(ARCHETYPE_INFO)) expect(counts[a], a).toBe(a === "sniper" || a === "spellbow" ? 3 : a === "battlemage" ? 5 : 4);
  });

  it("a V2 restyle changes the style but keeps the % total", () => {
    const sum = (p: Record<string, number>) => Object.values(p).reduce((a, b) => a + b, 0);
    for (const [id, r] of Object.entries(V2_RESTYLE)) {
      expect(sum(r.proficiency), id).toBe(sum(PRE_V2_SPECIES[id].proficiency));
      expect(v2(id).cls).toBe(r.cls);
    }
    expect(PRE_V2_SPECIES.the_watcher.cls).toBe("ranged");
    expect(v2("the_watcher").skills.every((m) => m.type === "magic")).toBe(true);
  });

  it("every creature has an archetype whose styles include its class", () => {
    for (const c of ROSTER_V2) {
      const a = SPECIES_ARCHETYPE[c.id];
      expect(a, c.id).toBeDefined();
      expect(ARCHETYPE_INFO[a].styles, c.id).toContain(c.cls);
    }
  });

  it("starting moves: Neutral 20, race 30 and the Neutral priority move, all in its main style; the fourth slot is empty", () => {
    const wolf = v2Moves(v2("moss_wolf")).slice(0, STARTING_MOVES);
    expect(wolf.map((m) => m.name)).toEqual(["Strike", "Gore", "Rush"]);
    expect(wolf.map((m) => m.energyCost)).toEqual([20, 30, 50]);
    const angler = v2Moves(v2("deep_angler")).slice(0, STARTING_MOVES); // Underkin Battlemage: melee
    expect(angler.map((m) => m.name)).toEqual(["Strike", "Tunnel Rush", "Rush"]);
    for (const t of ROSTER_V2) {
      expect(defaultMoveNames(t), t.id).toHaveLength(3);
      expect(rollMoves(t, () => 0.99), t.id).toEqual(defaultMoveNames(t)); // no rare move: still 3
    }
  });

  it("the new species' %s sit within today's range for their rarity", () => {
    const sum = (p: Record<string, number>) => Object.values(p).reduce((a, b) => a + b, 0);
    for (const c of NEW_SPECIES_V2) {
      const today = ROSTER_V2.filter((o) => o.rarity === c.rarity && !NEW_SPECIES_V2.some((n) => n.id === o.id));
      const sums = today.map((o) => sum(o.proficiency));
      expect(sum(c.proficiency), c.id).toBeGreaterThanOrEqual(Math.min(...sums) - 5);
      expect(sum(c.proficiency), c.id).toBeLessThanOrEqual(Math.max(...sums) + 5);
    }
  });
});
