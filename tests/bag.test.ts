import { describe, it, expect } from "vitest";
import { makeRoom, addToBag, BAG_SIZE, POTIONS, STASH_ITEMS, type PotionKey } from "../lib/dungeon/run";
import { createBattle, resolveRound, isValidAction } from "../lib/combat/battle";
import { buildFighter } from "../lib/combat/loadout";
import { CREATURE_BY_ID } from "../lib/creatures/creatureData";

describe("the battle bag", () => {
  it("holds 10 items, one per slot", () => {
    const full = addToBag([], Array<PotionKey>(12).fill("lesser"));
    expect(full).toHaveLength(BAG_SIZE);
    expect(addToBag(full, ["potion"])).toHaveLength(BAG_SIZE);
  });

  it("potions: 100 HP for 100 gold, or a lesser 50 for 50", () => {
    expect(POTIONS.potion).toMatchObject({ heal: 100, price: 100 });
    expect(POTIONS.lesser).toMatchObject({ heal: 50, price: 50 });
  });

  it("stashes hold 3 potions", () => {
    for (let i = 0; i < 50; i++) {
      const room = makeRoom("stash");
      expect(room.stash).toHaveLength(STASH_ITEMS);
      for (const k of room.stash!) expect(POTIONS[k]).toBeTruthy();
    }
  });

  it("in a fight, a potion uses your turn and heals before anyone attacks", () => {
    const me = buildFighter(CREATURE_BY_ID.moss_wolf, {}, {}, ["Slash"]);
    const foe = buildFighter(CREATURE_BY_ID.cave_bat, {}, {}, ["Flick"]);
    const s = createBattle([me], [foe], { A: [10] });
    const potion = { kind: "item" as const, item: "Lesser Potion", heal: 50 };
    expect(isValidAction(s, "A", potion)).toBe(true);
    resolveRound(s, { A: potion, B: { kind: "attack", skillName: "Flick" } });
    const firstHeal = s.log.findIndex((e) => e.type === "effect" && e.kind === "item");
    const firstHit = s.log.findIndex((e) => e.type === "attack");
    expect(firstHeal).toBeGreaterThan(-1);
    expect(firstHeal).toBeLessThan(firstHit);
    expect(s.log.some((e) => e.type === "attack" && e.side === "A")).toBe(false); // no attack from you this round
    // Can't drink at full HP, and never above max.
    const full = createBattle([me], [foe]);
    expect(isValidAction(full, "A", potion)).toBe(false);
    const nearly = createBattle([me], [foe], { A: [me.maxHp - 5] });
    nearly.sides.B.team[0].energy = 0;
    resolveRound(nearly, { A: potion, B: { kind: "pass" } });
    expect(nearly.sides.A.team[0].hp).toBe(me.maxHp);
  });
});
