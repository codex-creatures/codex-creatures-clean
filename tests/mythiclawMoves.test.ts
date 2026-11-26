import { describe, it, expect } from "vitest";
import { createBattle, resolveRound, affordableSkills, changeActive, currentAgility, type BattleState } from "../lib/combat/battle";
import { buildFighter } from "../lib/combat/loadout";
import { calcDamage, effectiveAgil, slowedAgil } from "../lib/combat/engine";
import { CREATURE_BY_ID, MOVE_BY_NAME, canLearnFromCodex } from "../lib/creatures/creatureData";
import { HORN_RUSH_AGILITY, SPIRIT_BLADE } from "../lib/creatures/codexMoves";
import { codexDrop } from "../lib/drops";
import type { CreatureOrItemDrop } from "../lib/types";
import { rollCreature } from "../lib/creatures/creatureRoll";
import { fighterFor } from "../lib/creatures/instance";

// The user's Mythiclaw moves (2026-11-26): Horn Rush, Leg Sweep and Spirit Blade.
const fighter = (id: string, moves: string[], agility = 20) =>
  buildFighter(CREATURE_BY_ID[id], { melee: 20, ranged: 20, magic: 20, agility }, { mDef: 5, rDef: 5 }, moves);
const big = <T extends { maxHp: number; hp: number }>(f: T, hp = 999) => ({ ...f, maxHp: hp, hp });
const attack = (skillName: string) => ({ kind: "attack" as const, skillName });
const swap = (to: number) => ({ kind: "swap" as const, to });
const hitsBy = (s: BattleState, side: "A" | "B") => s.log.filter((e) => e.type === "attack" && e.side === side);

describe("the codexes", () => {
  it("Horn Rush Rare Beast, Leg Sweep Common neutral, Spirit Blade Epic Divine; the Mythiclaw reads Horn Rush and Leg Sweep (the user's ticks)", () => {
    expect(MOVE_BY_NAME["Horn Rush"]).toMatchObject({ type: "melee", race: "beast", codexRarity: "rare", damage: 20, energyCost: 50 });
    expect(MOVE_BY_NAME["Leg Sweep"]).toMatchObject({ type: "melee", codexRarity: "common", damage: 10, energyCost: 30 });
    expect(MOVE_BY_NAME["Leg Sweep"].race).toBeUndefined();
    expect(MOVE_BY_NAME["Spirit Blade"]).toMatchObject({ type: "melee", race: "divine", codexRarity: "epic", damage: 20, energyCost: 60 });
    for (const m of ["Horn Rush", "Leg Sweep", "Spirit Blade"]) {
      expect(canLearnFromCodex(CREATURE_BY_ID.dire_wolf, m), m).toBe(m !== "Spirit Blade");
      expect((codexDrop(m) as CreatureOrItemDrop).rarity).toBe(MOVE_BY_NAME[m].codexRarity);
    }
  });
});

describe("the Labyrinth Sprite", () => {
  it("is always born knowing Mirage in its fourth slot (its signature move), and it works in a fight", () => {
    for (let n = 0; n < 50; n++) expect(rollCreature(CREATURE_BY_ID.labyrinth_sprite).moves).toEqual([...CREATURE_BY_ID.labyrinth_sprite.skills.slice(0, 3).map((m) => m.name), "Mirage"]);
    const f = fighterFor({ id: "x", moves: rollCreature(CREATURE_BY_ID.labyrinth_sprite).moves } as unknown as CreatureOrItemDrop, CREATURE_BY_ID.labyrinth_sprite);
    expect(f.skills.map((m) => m.name)).toContain("Mirage");
  });
});

describe("Horn Rush", () => {
  it("swings with 60% of its agility in place of its melee attack: more agility, a bigger hit", () => {
    const foe = big(fighter("glob", ["Strike"]));
    const slow = fighter("dire_wolf", ["Horn Rush"], 0), fast = fighter("dire_wolf", ["Horn Rush"], 200);
    const hr = slow.skills[0];
    expect(calcDamage(hr, fast, foe, false).damage).toBeGreaterThan(calcDamage(hr, slow, foe, false).damage * 1.5);
    // Same as a plain melee move of its power swung by an attack of 0.6 × its agility.
    const plain = { ...hr, effect: undefined };
    const asAttack = { ...fast, weapon: { ...fast.weapon, atk: (effectiveAgil(fast) * HORN_RUSH_AGILITY) / (1 + fast.proficiency.atk / 100) } };
    expect(calcDamage(hr, fast, foe, false).damage).toBe(calcDamage(plain, asAttack, foe, false).damage);
  });
  it("a slow (Leg Sweep) or a cripple takes its share off the hit", () => {
    const foe = big(fighter("glob", ["Strike"]));
    const me = fighter("dire_wolf", ["Horn Rush"], 200);
    const swept = { ...me, statuses: [{ id: "slow", rounds: 2, loss: 0.3 }] };
    expect(slowedAgil(swept)).toBeCloseTo(effectiveAgil(me) * 0.7);
    expect(calcDamage(me.skills[0], swept, foe, false).damage).toBeLessThan(calcDamage(me.skills[0], me, foe, false).damage);
  });
});

describe("Leg Sweep", () => {
  it("30% of the time: −30% agility for 3 rounds, no stumble; a second sweep restarts it", () => {
    let slowed = 0;
    const fails: string[] = [];
    for (let n = 0; n < 400; n++) {
      const s = createBattle([big(fighter("dire_wolf", ["Leg Sweep"]))], [big(fighter("glob", ["Strike"]))]);
      resolveRound(s, { A: attack("Leg Sweep"), B: attack("Strike") });
      const t = s.sides.B.team[0], slow = t.statuses.find((x) => x.id === "slow");
      if (!slow) continue;
      slowed++;
      if (slow.rounds !== 3 || slow.loss !== 0.3) fails.push(`${slow.rounds} rounds, ${slow.loss}`);
      if (Math.abs(currentAgility(t) - effectiveAgil(t) * 0.7) > 1e-9) fails.push("agility");
      if (t.statuses.some((x) => x.id === "cripple")) fails.push("cripple");
    }
    expect(fails.slice(0, 5)).toEqual([]);
    expect(slowed / 400).toBeGreaterThan(0.22);
    expect(slowed / 400).toBeLessThan(0.38);
  });
});

describe("Spirit Blade", () => {
  it("each hit adds 6% of the target's max HP past its armour", () => {
    const s = createBattle([big(fighter("pale_rider", ["Spirit Blade"]))], [big(fighter("gravewarden", ["Strike"]), 1000)]);
    resolveRound(s, { A: attack("Spirit Blade"), B: attack("Strike") });
    const [hit] = hitsBy(s, "A");
    const plain = calcDamage(MOVE_BY_NAME["Spirit Blade"], s.sides.A.team[0], s.sides.B.team[0], false).damage;
    expect(hit.type === "attack" && hit.damage).toBeGreaterThanOrEqual(Math.round(1000 * SPIRIT_BLADE.share) + Math.floor(plain * 0.9));
  });
  it("pays once, then is locked in for 3 swings (only it or a swap), free", () => {
    const me = big(fighter("pale_rider", ["Spirit Blade", "Strike"])), them = big(fighter("glob", ["Strike"]));
    const s = createBattle([me], [them]);
    resolveRound(s, { A: attack("Spirit Blade"), B: attack("Strike") });
    const a = s.sides.A.team[0];
    expect(a.energy).toBe(100 - 60 + 30);
    expect(affordableSkills(a).map((m) => m.name)).toEqual(["Spirit Blade"]);
    a.energy = 10; // (free while locked: it needn't afford it)
    resolveRound(s, { A: attack("Spirit Blade"), B: attack("Strike") });
    expect(a.energy).toBe(40);
    expect(affordableSkills(a).map((m) => m.name)).toEqual(["Spirit Blade"]);
    resolveRound(s, { A: attack("Spirit Blade"), B: attack("Strike") });
    expect(hitsBy(s, "A")).toHaveLength(3);
    expect(a.statuses.some((x) => x.id === "locked")).toBe(false);
    expect(affordableSkills(a).map((m) => m.name)).toEqual(["Spirit Blade", "Strike"]); // (free again: 70 energy)
  });
  it("swapping out ends the lock", () => {
    const s = createBattle([big(fighter("pale_rider", ["Spirit Blade", "Strike"])), big(fighter("glob", ["Strike"]))], [big(fighter("glob", ["Strike"]))]);
    resolveRound(s, { A: attack("Spirit Blade"), B: attack("Strike") });
    resolveRound(s, { A: swap(1), B: attack("Strike") });
    expect(s.sides.A.team[0].statuses.some((x) => x.id === "locked")).toBe(false);
    changeActive(s, "A", 0);
    expect(affordableSkills(s.sides.A.team[0]).map((m) => m.name)).toContain("Strike");
  });
});
