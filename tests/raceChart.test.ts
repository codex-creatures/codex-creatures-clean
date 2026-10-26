import { afterEach, describe, expect, it } from "vitest";
import { MATCH_BONUS, RACE_BEATS, RACE_EFFECT, raceMultiplier, raceVs, raceVsAll } from "../lib/combat/raceChart";
import { RACES_V2, SPECIES_RACES, MOVE_RACES } from "../lib/creatures/racesV2";
import { calcDamage, LIVE_RULES, setCombatRules, TRIANGLE, TRIANGLE_RULES } from "../lib/combat/engine";
import { buildFighter } from "../lib/combat/loadout";
import { ALL_SKILLS, CREATURE_BY_ID, CREATURE_TEMPLATES, LEARNABLE_MOVES, RACE_MOVES } from "../lib/creatures/creatureData";

afterEach(() => setCombatRules(LIVE_RULES));

const skill = (name: string) => [...ALL_SKILLS, ...LEARNABLE_MOVES, ...RACE_MOVES].find((s) => s.name === name)!;

describe("race chart", () => {
  it("each race beats 3 and is weak to 3", () => {
    for (const r of RACES_V2) {
      expect(RACE_BEATS[r]).toHaveLength(3);
      expect(RACES_V2.filter((o) => RACE_BEATS[o].includes(r))).toHaveLength(3);
    }
  });

  it("effective, resisted, neutral and mutual", () => {
    expect(raceVs("divine", "undead")).toBe(RACE_EFFECT.strong);
    expect(raceVs("undead", "divine")).toBe(RACE_EFFECT.resisted);
    expect(raceVs("undead", "underkin")).toBe(1);
    // Beast and Humanoid beat each other: both land effective.
    expect(raceVs("beast", "humanoid")).toBe(RACE_EFFECT.strong);
    expect(raceVs("humanoid", "beast")).toBe(RACE_EFFECT.strong);
    expect(raceVs("geo", "geo")).toBe(1);
  });

  it("two defending races multiply; none is neutral", () => {
    expect(raceVsAll("geo", ["beast", "divine"])).toBeCloseTo(RACE_EFFECT.strong ** 2);
    expect(raceVsAll("geo", ["beast", "underkin"])).toBeCloseTo(RACE_EFFECT.strong * RACE_EFFECT.resisted);
    expect(raceVsAll("geo", [])).toBe(1);
  });

  it("the match bonus applies once; own mode picks the better of two races", () => {
    const toad = { races: SPECIES_RACES.bellow_toad }; // beast + toxic
    // vs Divine: Toxic lands effective, Beast neutral.
    expect(raceMultiplier(skill("Slash"), toad, { races: ["divine"] }, "own")).toBeCloseTo(RACE_EFFECT.strong * MATCH_BONUS);
    // Drafted: Slash is a Beast move (matches, neutral on Divine).
    expect(raceMultiplier(skill("Slash"), toad, { races: ["divine"] }, "drafted")).toBeCloseTo(MATCH_BONUS);
    // An off-race move gets no bonus.
    expect(raceMultiplier(skill("Bolt"), toad, { races: ["geo"] }, "drafted")).toBeCloseTo(RACE_EFFECT.strong);
  });

  it("every scannable creature and every move has a race", () => {
    for (const c of CREATURE_TEMPLATES) expect(SPECIES_RACES[c.id]?.length, c.id).toBeGreaterThan(0);
    for (const m of [...ALL_SKILLS, ...LEARNABLE_MOVES, ...RACE_MOVES]) expect(MOVE_RACES[m.name], m.name).toBeDefined();
  });
});

describe("combat rules switch", () => {
  const wolf = buildFighter(CREATURE_BY_ID.moss_wolf, { melee: 40 }, { mDef: 30, rDef: 30, magDef: 30 });
  const archer = buildFighter(CREATURE_BY_ID.thicket_archer, { ranged: 40 }, { mDef: 30, rDef: 30, magDef: 30 });

  it("the old rules use the triangle and ignore races", () => {
    setCombatRules(TRIANGLE_RULES);
    const old = calcDamage(skill("Slash"), wolf, archer, false).damage;
    setCombatRules({ triangle: false, races: null });
    const plain = calcDamage(skill("Slash"), wolf, archer, false).damage;
    expect(old / plain).toBeCloseTo(TRIANGLE.strong, 1); // melee beats ranged
  });

  it("the live game is Combat V2: each move's own race, no triangle, no damage types", () => {
    expect(LIVE_RULES).toEqual({ triangle: false, races: "drafted", damageTypes: false });
    const gore = CREATURE_BY_ID.moss_wolf.skills.find((m) => m.name === "Gore")!; // a Beast kit move
    const live = calcDamage(gore, wolf, archer, false).damage;
    setCombatRules({ triangle: false, races: null, damageTypes: false });
    const plain = calcDamage(gore, wolf, archer, false).damage;
    // Beast beats Humanoid, plus the match bonus.
    expect(live / plain).toBeCloseTo(RACE_EFFECT.strong * MATCH_BONUS, 1);
  });

  it("V2 drops the triangle and uses races", () => {
    setCombatRules({ triangle: false, races: null });
    const plain = calcDamage(skill("Slash"), wolf, archer, false).damage;
    setCombatRules({ triangle: false, races: "own" });
    const v2 = calcDamage(skill("Slash"), wolf, archer, false).damage;
    // Beast beats Humanoid, plus the match bonus.
    expect(v2 / plain).toBeCloseTo(RACE_EFFECT.strong * MATCH_BONUS, 1);
  });
});
