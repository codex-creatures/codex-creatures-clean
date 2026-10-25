import { describe, it, expect } from "vitest";
import { CREATURE_BY_ID as LIVE_BY_ID, PRE_V2_SPECIES } from "../lib/creatures/creatureData";
// Battle mechanics tests use the older species, with the moves they were written with.
const CREATURE_BY_ID = { ...LIVE_BY_ID, ...PRE_V2_SPECIES };
import { buildFighter } from "../lib/combat/loadout";
import { calcDamage, ARCANE_CAP, setCombatRules, LIVE_RULES, TRIANGLE_RULES } from "../lib/combat/engine";
import { createBattle, resolveRound, sendInReplacement, swapTargets } from "../lib/combat/battle";
import { aiChooseAction, aiChooseReplacement } from "../lib/combat/teamBattle";
import { MOVE_BY_NAME, CREATURES_BY_RARITY } from "../lib/creatures/creatureData";

const f = (id: string) => buildFighter(CREATURE_BY_ID[id]);

describe("encampment fights", () => {
  it("an ambush puts two of theirs on the field, and both attack", () => {
    const s = createBattle([f("rust_beetle")], [f("moss_wolf"), f("cave_bat"), f("rattlebones")], {}, undefined, { pairB: true });
    expect(s.sides.B.partner).toBe(1);
    expect(swapTargets(s.sides.B)).toEqual([2]); // the partner isn't a swap target
    resolveRound(s, { A: { kind: "attack", skillName: "Jab" }, B: { kind: "attack", skillName: "Slash" } });
    const hits = s.log.filter((e) => e.type === "attack" && e.side === "B");
    expect(hits.length).toBe(2);
  });

  it("in an ambush, the AI never tries to swap to the partner already beside it (that crashed the fight)", () => {
    const pool = Object.values(CREATURES_BY_RARITY).flat();
    const team = () => Array.from({ length: 3 }, () => buildFighter(pool[Math.floor(Math.random() * pool.length)]));
    for (let n = 0; n < 60; n++) {
      const s = createBattle(team(), team(), {}, undefined, { pairB: true });
      while (!s.winner) {
        resolveRound(s, { A: aiChooseAction(s, "A", { canSwap: true }), B: aiChooseAction(s, "B", { canSwap: true }) }); // throws on an invalid swap
        for (const k of [...s.needsReplacement]) sendInReplacement(s, k, aiChooseReplacement(s, k));
      }
    }
  });

  it("a rigged room: if they still stand when time's up, you lose", () => {
    const s = createBattle([f("rust_beetle")], [f("rust_beetle")], {}, undefined, { turnLimit: 2 });
    resolveRound(s, { A: { kind: "attack", skillName: "Jab" }, B: { kind: "attack", skillName: "Jab" } });
    expect(s.winner).toBeNull();
    resolveRound(s, { A: { kind: "attack", skillName: "Jab" }, B: { kind: "attack", skillName: "Jab" } });
    expect(s.winner).toBe("B");
  });

  it("arcane's cap grows with a potion-drunk foe's HP (the old rules: Combat V2 has no damage types)", () => {
    setCombatRules(TRIANGLE_RULES);
    const me = f("dustwraith");
    const fat = { ...f("ironhide") };
    const drunk = { ...fat, maxHp: fat.maxHp * 3, hp: fat.maxHp * 3, hpMult: 3 };
    const sk = { ...MOVE_BY_NAME["Ice Lance"], dmgType: "arcane" as const, damage: 100 };
    const plain = calcDamage(sk, me, { ...drunk, hpMult: undefined }, false).damage;
    const swollen = calcDamage(sk, me, drunk, false).damage;
    expect(swollen).toBeGreaterThan(plain);
    expect(swollen - plain).toBeGreaterThanOrEqual(ARCANE_CAP); // roughly 2 more caps' worth
    setCombatRules(LIVE_RULES);
  });
});
