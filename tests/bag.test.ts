import { describe, it, expect } from "vitest";
import { makeRoom, addToBag, bagSize, bagName, BINDLE, BACKPACK, POTIONS, gearEntry, gearIdOf, lootEntry, lootIdOf, isPotionEntry, cyclopsChest, CYCLOPS_CHEST_MAX, type PotionKey } from "../lib/dungeon/run";
import { createBattle, resolveRound, isValidAction } from "../lib/combat/battle";
import { buildFighter } from "../lib/combat/loadout";
import { CREATURE_BY_ID } from "../lib/creatures/creatureData";

describe("the battle bag", () => {
  it("starts as a 3-slot bindle; the first mini boss's rugged backpack holds 5, one thing per slot", () => {
    expect(bagSize({})).toBe(BINDLE);
    expect(bagName({})).toBe("Bindle");
    expect(bagName({ bagSize: BACKPACK })).toBe("Rugged backpack");
    const full = addToBag([], Array<PotionKey>(12).fill("lesser"), BINDLE);
    expect(full).toHaveLength(BINDLE);
    expect(addToBag(full, ["potion"], BINDLE)).toHaveLength(BINDLE);
    expect(addToBag(full, ["potion"], BACKPACK)).toHaveLength(4);
  });

  it("a slot holds a potion, your own gear, or loot found this run", () => {
    const g = gearEntry("abc"), l = lootEntry("xyz");
    expect(gearIdOf(g)).toBe("abc");
    expect(lootIdOf(l)).toBe("xyz");
    expect(gearIdOf(l)).toBeUndefined();
    expect(isPotionEntry(g)).toBe(false);
    expect(isPotionEntry(l)).toBe(false);
    expect(isPotionEntry("potion")).toBe(true);
    expect(gearIdOf("lesser")).toBeUndefined();
  });

  it("potions: 100 HP for 100 gold, or a lesser 50 for 50", () => {
    expect(POTIONS.potion).toMatchObject({ heal: 100, price: 100 });
    expect(POTIONS.lesser).toMatchObject({ heal: 50, price: 50 });
  });

  it("stashes: always 3 things — 2 potions, then a potion (25%), gold (50%) or gear (25%)", () => {
    const N = 4000;
    let three = 0, gold = 0, gear = 0;
    for (let i = 0; i < N; i++) {
      const sack = makeRoom("stash").sack!;
      expect(sack).toHaveLength(3);
      const potions = sack.filter((x) => "potion" in x);
      expect(potions.length === 2 || potions.length === 3).toBe(true);
      for (const p of potions) expect(POTIONS[(p as { potion: "potion" | "lesser" }).potion]).toBeTruthy();
      if (potions.length === 3) three++;
      const g = sack.find((x) => "gold" in x) as { gold: number } | undefined;
      if (g) { gold++; expect(g.gold).toBeGreaterThanOrEqual(100); expect(g.gold).toBeLessThanOrEqual(250); }
      const it = sack.find((x) => "gear" in x) as { gear: { dropType: string; itemCategory?: string } } | undefined;
      if (it) { gear++; expect(["weapon", "armor"]).toContain(it.gear.itemCategory); }
    }
    expect(Math.abs(three / N - 0.25)).toBeLessThan(0.03);
    expect(Math.abs(gold / N - 0.5)).toBeLessThan(0.03);
    expect(Math.abs(gear / N - 0.25)).toBeLessThan(0.03);
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

describe("swapping a weapon in mid-fight", () => {
  it("uses your turn, and the new weapon's stats and affinity apply from then on", () => {
    const me = buildFighter(CREATURE_BY_ID.dire_wolf, { melee: 10 }, undefined, ["Crush"]);
    const foe = { ...buildFighter(CREATURE_BY_ID.rust_beetle, undefined, { mDef: 80, hp: 2000 }, ["Jab"]) };
    const s = createBattle([me], [foe]);
    const hammer = { atk: 120, rng: 0, mag: 0, agil: 0, mdef: 0, rdef: 0, magdef: 0, hp: 0, affinity: "force" as const };
    const action = { kind: "weapon", name: "Big Hammer", weapon: hammer } as const;
    expect(isValidAction(s, "A", action)).toBe(true);
    resolveRound(s, { A: action, B: { kind: "attack", skillName: "Jab" } });
    // No attack from A this round: the swap was its turn.
    expect(s.log.some((e) => e.type === "attack" && e.side === "A")).toBe(false);
    expect(s.log.some((e) => e.type === "effect" && e.text.includes("Big Hammer"))).toBe(true);
    expect(s.sides.A.team[0].weapon).toMatchObject({ atk: 120, affinity: "force" });
    // Next round it hits with the hammer.
    const before = s.sides.B.team[0].hp;
    resolveRound(s, { A: { kind: "attack", skillName: "Crush" }, B: { kind: "attack", skillName: "Jab" } });
    expect(before - s.sides.B.team[0].hp).toBeGreaterThan(60);
  });
});

describe("the Cyclops' chest", () => {
  it("holds 1–2 codexes, 1–2 potions and then 3–5 gear, never more than 10 rolls (gear is cut first)", () => {
    for (let i = 0; i < 200; i++) {
      const chest = cyclopsChest();
      const gear = chest.filter((x) => "gear" in x && (x.gear.dropType !== "item" || !x.gear.codexMove)).length;
      const codexes = chest.filter((x) => "gear" in x && x.gear.dropType === "item" && !!x.gear.codexMove).length;
      const potions = chest.filter((x) => "potion" in x).length;
      expect(gear).toBeGreaterThanOrEqual(3); expect(gear).toBeLessThanOrEqual(5);
      expect(codexes).toBeGreaterThanOrEqual(1); expect(codexes).toBeLessThanOrEqual(2);
      expect(potions).toBeGreaterThanOrEqual(1); expect(potions).toBeLessThanOrEqual(2);
      expect(chest.length).toBeLessThanOrEqual(CYCLOPS_CHEST_MAX);
      expect("gear" in chest[chest.length - 1] && !(chest[chest.length - 1] as { gear: { codexMove?: string } }).gear.codexMove).toBe(true); // gear rolled last
    }
  });
});
