import { describe, it, expect } from "vitest";
import { makeRoom, addToBag, bagSize, bagName, BINDLE, BACKPACK, POTIONS, gearEntry, gearIdOf, lootEntry, lootIdOf, isPotionEntry, bagWantsPotions, bossChest, BOSS_LOOT, withMoney, MONEY_STASH, MONEY_GOLD, DUNGEONS, type SackItem, CYCLOPS_CHEST_MAX, type PotionKey } from "../lib/dungeon/run";
import { createBattle, resolveRound, isValidAction, revivable, swapTargets } from "../lib/combat/battle";
import { buildFighter } from "../lib/combat/loadout";
import { CREATURE_BY_ID as LIVE_BY_ID, PRE_V2_SPECIES } from "../lib/creatures/creatureData";
// Battle mechanics tests use the older species, with the moves they were written with.
const CREATURE_BY_ID = { ...LIVE_BY_ID, ...PRE_V2_SPECIES };

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

  it("stashes: 2 potions, then a potion (25%), nothing (50%) or gear (25%) — besides any flare or clairvoyance scroll; never gold (it's in money stashes)", () => {
    const N = 4000;
    let three = 0, gold = 0, gear = 0;
    for (let i = 0; i < N; i++) {
      const sack = makeRoom("stash").sack!.filter((x) => !("gear" in x && "tool" in x.gear)); // (toolFinds.test.ts)
      expect(sack.length === 2 || sack.length === 3).toBe(true);
      if (sack.length === 2) gold++; // (the roll that held gold, and now holds nothing)
      const potions = sack.filter((x) => "potion" in x);
      expect(potions.length === 2 || potions.length === 3).toBe(true);
      for (const p of potions) expect(POTIONS[(p as { potion: "potion" | "lesser" }).potion]).toBeTruthy();
      if (potions.length === 3) three++;
      const g = sack.find((x) => "gold" in x) as { gold: number } | undefined;
      expect(g).toBeUndefined();
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

  it("a Revival Elixir uses your turn to bring back a knocked-out teammate, who can then be swapped in", () => {
    const me = buildFighter(CREATURE_BY_ID.moss_wolf, {}, {}, ["Slash"]);
    const mate = buildFighter(CREATURE_BY_ID.cave_bat, {}, {}, ["Flick"]);
    const foe = buildFighter(CREATURE_BY_ID.cave_bat, {}, {}, ["Flick"]);
    const s = createBattle([me, mate], [foe]);
    s.sides.A.team[1].hp = 0;
    s.sides.A.team[1].statuses = [{ id: "venom", rounds: 2, dmg: 5 }];
    expect(revivable(s.sides.A)).toEqual([1]);
    expect(swapTargets(s.sides.A)).toEqual([]);
    const elixir = { kind: "item" as const, item: "Revival Elixir", heal: 0, revive: { index: 1, share: 0.5 } };
    expect(isValidAction(s, "A", elixir)).toBe(true);
    // Not on one still standing, nor at your full-HP creature on the field as a heal.
    expect(isValidAction(s, "A", { ...elixir, revive: { index: 0, share: 0.5 } })).toBe(false);
    s.sides.B.team[0].energy = 0;
    resolveRound(s, { A: elixir, B: { kind: "pass" } });
    expect(s.sides.A.team[1].hp).toBe(Math.round(mate.maxHp * 0.5));
    expect(s.sides.A.team[1].statuses).toEqual([]);
    expect(s.log.some((e) => e.type === "effect" && e.kind === "revive" && e.index === 1)).toBe(true);
    expect(s.log.some((e) => e.type === "attack" && e.side === "A")).toBe(false); // it took your turn
    expect(swapTargets(s.sides.A)).toEqual([1]);
    expect(revivable(s.sides.A)).toEqual([]);
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

describe("the deeper bosses' chests (the user, 2026-11-23)", () => {
  const ORDER = ["common", "uncommon", "rare", "epic", "legendary"];
  const gearIn = (chest: SackItem[]) => chest.flatMap((x) => ("gear" in x && x.gear.dropType === "item" && (x.gear.itemCategory === "weapon" || x.gear.itemCategory === "armor") ? [x.gear] : []));
  const crystals = (chest: SackItem[]) => chest.reduce((n, x) => n + ("gear" in x && x.gear.dropType === "item" && x.gear.material === "essence" ? x.gear.qty ?? 1 : 0), 0);
  it("the Hydra's: 4–5 pieces, Rare or better, one at least Epic; the Minotaur's: 5, Epic or better; the Warden's: 5, a Legendary among them, all enchanted", () => {
    for (let i = 0; i < 150; i++) {
      const hydra = gearIn(bossChest(2)), mino = gearIn(bossChest(4)), warden = gearIn(bossChest(3));
      expect(hydra.length).toBeGreaterThanOrEqual(4); expect(hydra.length).toBeLessThanOrEqual(5);
      expect(hydra.every((d) => ORDER.indexOf(d.rarity) >= 2)).toBe(true);
      expect(hydra.some((d) => ORDER.indexOf(d.rarity) >= 3)).toBe(true);
      expect(mino).toHaveLength(5);
      expect(mino.every((d) => ORDER.indexOf(d.rarity) >= 3)).toBe(true);
      expect(warden).toHaveLength(5);
      expect(warden.every((d) => ORDER.indexOf(d.rarity) >= 3 && !!d.enchant)).toBe(true);
      expect(warden.some((d) => d.rarity === "legendary")).toBe(true);
    }
  });
  it("essence crystals: none from the Cyclops, one half the time from the Hydra, one from the Minotaur, two from the Warden", () => {
    let hydra = 0;
    for (let i = 0; i < 400; i++) {
      expect(crystals(bossChest(1))).toBe(0);
      hydra += crystals(bossChest(2));
      expect(crystals(bossChest(4))).toBe(1);
      expect(crystals(bossChest(3))).toBe(2);
    }
    expect(Math.abs(hydra / 400 - 0.5)).toBeLessThan(0.1);
  });
  it("each boss's own gold, and the Minotaur's XP three parts' worth", () => {
    for (const d of [1, 2, 4, 3] as const) for (let i = 0; i < 30; i++) {
      const gold = makeRoom("boss", Math.random, 15, d).gold!;
      expect(gold).toBeGreaterThanOrEqual(BOSS_LOOT[d].gold[0]); expect(gold).toBeLessThanOrEqual(BOSS_LOOT[d].gold[1]);
    }
    expect(BOSS_LOOT[1].gold).toEqual([80, 120]); // (the Cyclops' as it was)
    expect(BOSS_LOOT[4].partXp).toBe(3 * BOSS_LOOT[2].partXp);
  });
});

describe("money stashes (the user, 2026-11-23)", () => {
  it("a quarter of stashes, their gold grown by the dungeon's; the rest hold none", () => {
    const N = 4000;
    for (const d of [0, 1, 2, 4] as const) {
      let money = 0;
      for (let i = 0; i < N; i++) {
        const r = withMoney(makeRoom("stash", Math.random, 9, d), d, Math.random);
        const g = r.sack!.find((x) => "gold" in x) as { gold: number } | undefined;
        expect(!!g).toBe(!!r.money);
        if (!g) continue;
        money++;
        expect(g.gold).toBeGreaterThanOrEqual(Math.round(MONEY_GOLD[0] * DUNGEONS[d].goldScale)); expect(g.gold).toBeLessThanOrEqual(Math.round(MONEY_GOLD[1] * DUNGEONS[d].goldScale));
      }
      expect(Math.abs(money / N - MONEY_STASH)).toBeLessThan(0.03);
    }
  });
  it("a room with no sack is left alone", () => {
    const pool = makeRoom("pool");
    expect(withMoney(pool, 2, () => 0)).toBe(pool);
  });
});

describe("the Cyclops' chest", () => {
  it("holds 1–2 codexes, 1–2 potions and then 3–5 gear, never more than 10 rolls (gear is cut first)", () => {
    for (let i = 0; i < 200; i++) {
      const chest = bossChest(1);
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

describe("packing for the Encampment", () => {
  it("nudges you to pack a potion when you've none in the bag and some in storage, going into the Encampment", () => {
    expect(bagWantsPotions(0, [], 2)).toBe(true);
    expect(bagWantsPotions(0, ["lesser"], 2)).toBe(false);      // one's packed
    expect(bagWantsPotions(0, [], 0)).toBe(false);              // none to pack
    expect(bagWantsPotions(1, [], 2)).toBe(false);              // only the Encampment
  });
});
