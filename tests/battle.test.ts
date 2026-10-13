import { describe, it, expect } from "vitest";
import { CREATURE_BY_ID } from "../lib/creatures/creatureData";
import { buildFighter } from "../lib/combat/loadout";
import { createBattle, resolveRound, sendInReplacement, activeOf } from "../lib/combat/battle";
import { runTeamBattle } from "../lib/combat/teamBattle";
import { creatureTypeLabel } from "../lib/creatures/creatureType";

const f = (id: string, weapon?: Record<string, number>) => buildFighter(CREATURE_BY_ID[id], weapon);

describe("team battle rules", () => {
  it("a swap resolves first and the incoming creature takes the hit", () => {
    const s = createBattle([f("moss_wolf"), f("rust_beetle")], [f("dire_wolf"), f("cave_bat")]);
    resolveRound(s, { A: { kind: "swap", to: 1 }, B: { kind: "attack", skillName: "Slash" } });
    const beetle = s.sides.A.team[1];
    expect(s.sides.A.active).toBe(1);
    expect(beetle.hp).toBeLessThan(beetle.maxHp);
    expect(s.sides.A.team[0].hp).toBe(s.sides.A.team[0].maxHp);
  });

  it("swapping out restores 50% of missing energy", () => {
    const s = createBattle([f("moss_wolf"), f("rust_beetle")], [f("crystal_golem"), f("cave_bat")]);
    resolveRound(s, { A: { kind: "attack", skillName: "Heavy Blow" }, B: { kind: "attack", skillName: "Jab" } });
    const wolf = s.sides.A.team[0];
    expect(wolf.energy).toBe(100 - 40 + 30); // 90
    resolveRound(s, { A: { kind: "swap", to: 1 }, B: { kind: "attack", skillName: "Jab" } });
    expect(wolf.energy).toBe(95);
  });

  it("attack costs energy, then regenerates 30 (max 100)", () => {
    const s = createBattle([f("ironjaw_hound")], [f("crystal_golem")]);
    resolveRound(s, { A: { kind: "attack", skillName: "Crush" }, B: { kind: "attack", skillName: "Jab" } });
    expect(activeOf(s.sides.A).energy).toBe(80);
    expect(activeOf(s.sides.B).energy).toBe(100);
  });

  it("rejects moves the creature can't afford or doesn't know", () => {
    const s = createBattle([f("ironjaw_hound")], [f("crystal_golem")]);
    expect(() => resolveRound(s, { A: { kind: "attack", skillName: "Annihilator" }, B: { kind: "pass" } })).toThrow();
  });

  it("a fainted creature must be replaced before the next round", () => {
    const big = { melee: 500 };
    const s = createBattle([f("dire_wolf", big)], [f("cave_bat"), f("rust_beetle")]);
    resolveRound(s, { A: { kind: "attack", skillName: "Crush" }, B: { kind: "attack", skillName: "Bolt" } });
    expect(s.needsReplacement).toEqual(["B"]);
    resolveRound(s, { A: { kind: "attack", skillName: "Crush" }, B: { kind: "attack", skillName: "Bolt" } });
    expect(s.round).toBe(1); // blocked until a replacement is sent in
    sendInReplacement(s, "B", 1);
    expect(activeOf(s.sides.B).name).toBe("Rust Beetle");
  });

  it("auto battles always finish", () => {
    const team = () => [f("mantis_warden"), f("swamp_witch"), f("crystalback")];
    for (let i = 0; i < 50; i++) {
      const r = runTeamBattle(team(), team(), { swapsA: true, swapsB: true });
      expect(["A", "B", "draw"]).toContain(r.winner);
    }
  });
});

describe("creature type labels", () => {
  it("come from proficiency multipliers", () => {
    expect(creatureTypeLabel(CREATURE_BY_ID.dire_wolf.proficiency)).toBe("Bruiser");
    expect(creatureTypeLabel(CREATURE_BY_ID.crystalback.proficiency)).toBe("Tank");
    expect(creatureTypeLabel(CREATURE_BY_ID.forest_slime.proficiency)).toBe("Balanced");
    expect(creatureTypeLabel(CREATURE_BY_ID.void_serpent.proficiency)).toBe("Hybrid · Skirmisher");
  });
});
