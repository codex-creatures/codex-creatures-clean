import { describe, it, expect, vi } from "vitest";
import { KIT_MOVES, KIT_MOVE_RACE, KIT_NUMBERS, kitFor, kitMoveFor } from "../lib/creatures/raceKitsV2";
import { ARCHETYPE_INFO, NEW_SPECIES_V2, ROSTER_V2, SPECIES_ARCHETYPE, v2Moves } from "../lib/creatures/rosterV2";
import { RACES_V2, SPECIES_RACES } from "../lib/creatures/racesV2";
import { MOVE_BY_NAME } from "../lib/creatures/creatureData";
import { createBattle, resolveRound, type BattleAction } from "../lib/combat/battle";
import { buildFighter } from "../lib/combat/loadout";
import { raceMultiplier, RACE_EFFECT, MATCH_BONUS } from "../lib/combat/raceChart";
import { calcDamage, LIVE_RULES, setCombatRules } from "../lib/combat/engine";
import { afterEach } from "vitest";

afterEach(() => setCombatRules(LIVE_RULES));

const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];
const v2 = (id: string) => ROSTER_V2.find((c) => c.id === id)!;

describe("Combat V2 race kits", () => {
  it("5 moves per race in each style: 105, all new names", () => {
    expect(KIT_MOVES).toHaveLength(105);
    expect(new Set(KIT_MOVES.map((m) => m.name)).size).toBe(105);
    for (const m of KIT_MOVES) expect(MOVE_BY_NAME[m.name], m.name).toBeUndefined();
  });

  it("every kit is a 20, 30 and 50 energy move, a quick attack and a precise move", () => {
    for (const race of RACES_V2) for (const style of ["melee", "ranged", "magic"] as const) {
      const [light, medium, heavy, quick, precise] = kitFor(race, style);
      expect([light, medium, heavy].map((m) => m.energyCost)).toEqual([20, 30, 50]);
      expect(quick.effect?.kind).toBe("quick");
      expect(precise.effect).toEqual({ kind: "precise", hitChance: 0.7 });
      expect(kitFor(race, style).every((m) => m.type === style && KIT_MOVE_RACE[m.name] === race)).toBe(true);
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
    expect(dmg("force")).not.toBe(dmg("pierce")); // the live game: they differ
    setCombatRules({ triangle: false, races: null, damageTypes: false });
    expect(new Set([dmg("force"), dmg("pierce"), dmg("arcane")]).size).toBe(1);
  });
});

describe("Combat V2 roster", () => {
  it("35 creatures: one of each rarity for each race (by first race)", () => {
    expect(ROSTER_V2).toHaveLength(35);
    for (const race of RACES_V2) {
      const rs = ROSTER_V2.filter((c) => SPECIES_RACES[c.id][0] === race).map((c) => c.rarity).sort();
      expect(rs, race).toEqual([...RARITIES].sort());
    }
  });

  it("every creature has an archetype whose styles include its class", () => {
    for (const c of ROSTER_V2) {
      const a = SPECIES_ARCHETYPE[c.id];
      expect(a, c.id).toBeDefined();
      expect(ARCHETYPE_INFO[a].styles, c.id).toContain(c.cls);
    }
  });

  it("starting moves: its own race and style; a hybrid starts with both styles", () => {
    const wolf = v2Moves(v2("moss_wolf")).slice(0, 4);
    expect(wolf.map((m) => m.name)).toEqual(["Gore", "Maul", "Claw Swipe", "Lunge"]);
    const angler = v2Moves(v2("deep_angler")).slice(0, 4); // Underkin Spellbow
    expect(new Set(angler.map((m) => m.type))).toEqual(new Set(["ranged", "magic"]));
    // A second race puts one of its moves in the starting four.
    const toad = v2Moves(v2("bellow_toad")).slice(0, 4); // Beast + Pestilence Ranger
    expect(toad.some((m) => KIT_MOVE_RACE[m.name] === "pestilence")).toBe(true);
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
