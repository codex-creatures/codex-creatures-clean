import { describe, it, expect } from "vitest";
import { CREATURE_BY_ID } from "../lib/creatures/creatureData";
import { buildFighter } from "../lib/combat/loadout";
import { calcDamage, ARCANE_CAP } from "../lib/combat/engine";
import { createBattle, resolveRound, swapTargets } from "../lib/combat/battle";
import { MOVE_BY_NAME } from "../lib/creatures/creatureData";

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

  it("a rigged room: if they still stand when time's up, you lose", () => {
    const s = createBattle([f("rust_beetle")], [f("rust_beetle")], {}, undefined, { turnLimit: 2 });
    resolveRound(s, { A: { kind: "attack", skillName: "Jab" }, B: { kind: "attack", skillName: "Jab" } });
    expect(s.winner).toBeNull();
    resolveRound(s, { A: { kind: "attack", skillName: "Jab" }, B: { kind: "attack", skillName: "Jab" } });
    expect(s.winner).toBe("B");
  });

  it("arcane's cap grows with a potion-drunk foe's HP", () => {
    const me = f("dustwraith");
    const fat = { ...f("ironhide") };
    const drunk = { ...fat, maxHp: fat.maxHp * 3, hp: fat.maxHp * 3, hpMult: 3 };
    const sk = { ...MOVE_BY_NAME["Ice Lance"], dmgType: "arcane" as const, damage: 100 };
    const plain = calcDamage(sk, me, { ...drunk, hpMult: undefined }, false).damage;
    const swollen = calcDamage(sk, me, drunk, false).damage;
    expect(swollen).toBeGreaterThan(plain);
    expect(swollen - plain).toBeGreaterThanOrEqual(ARCANE_CAP); // roughly 2 more caps' worth
  });
});
