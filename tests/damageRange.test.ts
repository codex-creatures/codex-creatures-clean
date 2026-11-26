// tests/damageRange.test.ts: the damage range on a move in a fight (the user, 2026-11-26) holds every hit it can roll.
import { describe, it, expect } from "vitest";
import { damageRange } from "../components/BattleScreen";
import { buildFighter } from "../lib/combat/loadout";
import { calcDamage, DAMAGE_VARIANCE, PRECISE_IGNORE } from "../lib/combat/engine";
import { CREATURE_BY_ID } from "../lib/creatures/creatureData";
import type { Combatant } from "../lib/combat/battle";

const fighter = (id: string, weapon: Record<string, number>, armor: Record<string, number>) =>
  ({ ...buildFighter(CREATURE_BY_ID[id], weapon, armor, undefined, undefined, undefined, undefined, 20), statuses: [] }) as Combatant;

describe("a move's damage range in a fight", () => {
  const span = (t: string) => t.replace(" dmg", "").split("–").map(Number);
  it("is its hit at the lowest and highest roll before the foe's defences: every roll on a foe with none lands inside it, and on the real foe no higher", () => {
    const me = fighter("dire_wolf", { melee: 40, ranged: 10 }, { mDef: 20 });
    const them = fighter("glob", { melee: 10 }, { mDef: 40, rDef: 20, magDef: 10 });
    const bare = { ...them, armor: { ...them.armor, mdef: 0, rdef: 0, magdef: 0 }, proficiency: { ...them.proficiency, mdef: 0, rdef: 0, magdef: 0 } };
    for (const sk of me.skills.filter((s) => s.damage > 0)) {
      const [lo, hi = lo] = span(damageRange(sk, me, them)!);
      for (let i = 0; i <= 20; i++) {
        const roll = 1 - DAMAGE_VARIANCE + (2 * DAMAGE_VARIANCE * i) / 20;
        const d = calcDamage(sk, me, bare, false, PRECISE_IGNORE, roll).damage;
        expect(d, sk.name).toBeGreaterThanOrEqual(lo);
        expect(d, sk.name).toBeLessThanOrEqual(hi);
        expect(calcDamage(sk, me, them, false, PRECISE_IGNORE, roll).damage, sk.name).toBeLessThan(d);
      }
    }
  });

  it("leaves out the foe's armour and defence %s (the user, 2026-11-26: raw damage before the enemy's deduction)", () => {
    const me = fighter("dire_wolf", { melee: 40 }, {});
    const soft = fighter("moss_wolf", {}, {}), hard = fighter("ironhide", {}, { mDef: 80 });
    const sk = me.skills.find((s) => s.damage > 0)!;
    expect(damageRange(sk, me, hard)).toBe(damageRange(sk, me, { ...soft, maxHp: hard.maxHp, hpMult: hard.hpMult, races: hard.races }));
  });

  it("counts the race chart only when asked (the Encampment and the Cyclops' Labyrinth)", () => {
    const me = fighter("dire_wolf", { melee: 40 }, {});
    const sk = { ...me.skills.find((s) => s.damage > 0)!, race: "beast" as const }; // (a beast move: the core moves have no race)
    const them = fighter("moss_wolf", {}, {});
    // Against a foe whose race the move is strong or weak against, the hint moves the number; without it, it's as against no race.
    const pick = ["shambler", "rattlebones", "flicker_wisp", "crystalback", "thicket_archer", "glob"].map((id) => fighter(id, {}, {}))
      .find((f) => damageRange(sk, me, f, true) !== damageRange(sk, me, f, false))!;
    expect(pick).toBeDefined();
    expect(damageRange(sk, me, pick, false)).toBe(damageRange(sk, me, { ...pick, races: [] }, true));
    expect(damageRange(sk, me, them, false)).toBe(damageRange(sk, me, { ...them, races: [] }, true));
  });

  it("is nothing for a move that does no damage", () => {
    const me = fighter("dire_wolf", {}, {}), them = fighter("glob", {}, {});
    expect(damageRange({ ...me.skills[0], damage: 0 }, me, them)).toBeUndefined();
  });
});
