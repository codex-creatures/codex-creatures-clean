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
  it("is its hit at the lowest and highest roll, against the foe it's aimed at; every roll lands inside it", () => {
    const me = fighter("dire_wolf", { melee: 40, ranged: 10 }, { mDef: 20 });
    const them = fighter("glob", { melee: 10 }, { mDef: 40, rDef: 20, magDef: 10 });
    for (const sk of me.skills.filter((s) => s.damage > 0)) {
      const text = damageRange(sk, me, them)!;
      const [lo, hi] = text.replace(" dmg", "").split("–").map(Number);
      for (let i = 0; i <= 20; i++) {
        const roll = 1 - DAMAGE_VARIANCE + (2 * DAMAGE_VARIANCE * i) / 20;
        const d = calcDamage(sk, me, them, false, PRECISE_IGNORE, roll).damage;
        expect(d, sk.name).toBeGreaterThanOrEqual(lo);
        expect(d, sk.name).toBeLessThanOrEqual(hi ?? lo);
      }
    }
  });

  it("counts the foe's armour: the same move shows less against a tougher one", () => {
    const me = fighter("dire_wolf", { melee: 40 }, {});
    const soft = fighter("moss_wolf", {}, {}), hard = fighter("moss_wolf", {}, { mDef: 80 });
    const sk = me.skills.find((s) => s.damage > 0)!;
    const top = (t: string) => Number(t.replace(" dmg", "").split("–").pop());
    expect(top(damageRange(sk, me, hard)!)).toBeLessThan(top(damageRange(sk, me, soft)!));
  });

  it("is nothing for a move that does no damage", () => {
    const me = fighter("dire_wolf", {}, {}), them = fighter("glob", {}, {});
    expect(damageRange({ ...me.skills[0], damage: 0 }, me, them)).toBeUndefined();
  });
});
