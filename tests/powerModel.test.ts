// tests/powerModel.test.ts: the engine's "multiply" power model (lib/combat/engine.ts, the balance refresh study,
// 2026-11-25) is off unless a sim or the lab switches it on, and under it a move's power multiplies the creature's
// swing: a power-15 move is one and a half times a power-10 one, an unarmed creature still swings for BARE_SWING,
// and nothing else about the hit changes.
import { afterEach, describe, expect, it } from "vitest";
import { calcDamage, setCombatRules, LIVE_RULES, SWING_UNIT, BARE_SWING, type Fighter } from "../lib/combat/engine";
import { buildFighter } from "../lib/combat/loadout";
import { CREATURE_BY_ID } from "../lib/creatures/creatureData";
import type { Skill } from "../lib/creatures/creatureData";

const strike: Skill = { name: "Strike", damage: 10, energyCost: 20, type: "melee", dmgType: "force" };
const smash: Skill = { name: "Smash", damage: 15, energyCost: 50, type: "melee", dmgType: "force" };
const wolf = (weapon?: Record<string, number>): Fighter => buildFighter(CREATURE_BY_ID.dire_wolf, weapon, undefined, undefined, undefined, undefined, undefined, 16);
const target = (): Fighter => buildFighter(CREATURE_BY_ID.moss_wolf, undefined, { mDef: 0, rDef: 0, magDef: 0 }, undefined, undefined, undefined, undefined, 16);

describe("the multiply power model", () => {
  afterEach(() => setCombatRules(LIVE_RULES));

  it("is off by default: the live rules add power to the attack", () => {
    expect(LIVE_RULES.powerModel).toBeUndefined();
    const a = wolf({ melee: 40 }), atk = a.weapon.atk * (1 + a.proficiency.atk / 100);
    expect(calcDamage(strike, a, target(), false).damage).toBe(Math.round(10 + atk));
  });

  it("multiplies: power 10 is one swing (the creature's attack), 15 is one and a half", () => {
    setCombatRules({ ...LIVE_RULES, powerModel: "multiply" });
    const a = wolf({ melee: 40 }), atk = a.weapon.atk * (1 + a.proficiency.atk / 100);
    const hit10 = calcDamage(strike, a, target(), false).damage, hit15 = calcDamage(smash, a, target(), false).damage;
    expect(hit10).toBe(Math.round((10 * atk) / SWING_UNIT));
    expect(hit15 / hit10).toBeCloseTo(1.5, 1);
  });

  it("an unarmed creature still swings for BARE_SWING", () => {
    setCombatRules({ ...LIVE_RULES, powerModel: "multiply" });
    const bare = wolf(undefined);
    expect(bare.weapon.atk).toBe(0);
    expect(calcDamage(strike, bare, target(), false).damage).toBe(Math.round((10 * BARE_SWING) / SWING_UNIT));
  });
});
