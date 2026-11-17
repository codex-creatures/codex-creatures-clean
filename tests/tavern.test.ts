import { describe, it, expect } from "vitest";
import { slowIt } from "./slow";
import { rollMap, knownRooms, waysOn } from "../lib/dungeon/map";
import { DUNGEONS, startRun, stepInside, enterRoom, dynamiteHere, takeDynamite, hasFight, minibossExtras, makeRoom, MERCHANT_MATERIALS, type DungeonRun } from "../lib/dungeon/run";
import { hasBookPlans, tavernQuestDue, wantsStorehouse, canBlast, blast, forceOpen, tavernVisitors, guestOf, onTheClock, windowOf, VISITORS, VISITOR_WINDOW, visitorChance, upgradeVisitor, upgradeCost, upgradeLevel, canUpgrade, UPGRADE_COSTS, UPGRADE_STEP, MAX_UPGRADE, repair, repairNeeds, REPAIR_COST, QUEST_CREATURE_LEVEL, QUEST_KLUTZ_LEVEL, callVisitor, tavernPlan, comeHome, buyFromVisitor, tavernSellables, materialOffer, merchantCalls, tavernWares, summonVisitor, SUMMON_PRICE, TAVERN_MATERIAL_PRICES, type TavernQuest, headUp } from "../lib/tavern";
import { SCHEMATICS, BOOKCASE_BUILT, bookcaseSize, TOOLS, toolDrop, schematicDrop } from "../lib/items/materials";
import { potionDrop, scrollDrop } from "../lib/drops";
import type { Drop } from "../lib/types";
import { createDen, mergeRects, strollAt, OBJ, W, H, VISITOR_PATH, VISITOR_SPEED, VISITOR_PAUSE } from "../lib/den/scene";

describe("the tavern questline: Klutz's quest", () => {
  const due = (levels: number[], klutz: number, away = false, done = true, t = {}) => tavernQuestDue(t, done, levels, klutz, away);

  it("needs a Lv 6 creature and Klutz at Lv 2, in either order", () => {
    expect(QUEST_CREATURE_LEVEL).toBe(6);
    expect(QUEST_KLUTZ_LEVEL).toBe(2);
    expect(due([3, 6], 2)).toBe(true);
    expect(due([3, 5], 2)).toBe(false); // no creature at Lv 6 yet
    expect(due([6], 1)).toBe(false);    // Klutz has never won a hunt
    expect(due([9], 4)).toBe(true);
  });

  it("waits while he's out hunting, and until his box quest is done", () => {
    expect(due([6], 2, true)).toBe(false);
    expect(due([6], 2, false, false)).toBe(false);
  });

  it("is given once", () => {
    expect(due([6], 2, false, true, { accepted: true })).toBe(false);
  });

  it("wants the storehouse from accepting it until the dynamite is yours", () => {
    expect(wantsStorehouse({})).toBe(false);
    expect(wantsStorehouse({ accepted: true })).toBe(true);
    expect(wantsStorehouse({ accepted: true, dynamite: true })).toBe(false);
  });
});

describe("the tavern questline: the dynamite's storehouse", () => {
  slowIt("is the large room (one of the Deep's two), always marked on the scroll", () => {
    for (const d of [1, 2] as const) {
      for (let i = 0; i < 40; i++) {
        const map = rollMap(false, Math.random, DUNGEONS[d].spec, d, true);
        const large = Object.values(map.nodes).filter((n) => n.large);
        expect(large).toHaveLength(d); // no extra room
        const stash = large.filter((n) => n.dynamite);
        expect(stash).toHaveLength(1);
        expect(stash[0].kind).toBe("storehouse");
        expect(stash[0].mystery).toBeFalsy();
        expect(knownRooms(map, [map.start]).has(stash[0].id)).toBe(true);
      }
    }
  });

  slowIt("isn't there without the quest", () => {
    for (let i = 0; i < 40; i++) {
      const map = rollMap(false, Math.random, DUNGEONS[1].spec, 1);
      expect(Object.values(map.nodes).some((n) => n.dynamite)).toBe(false);
    }
  });

  // Stand in a room just below the storehouse, then walk in.
  function walkIn(run: DungeonRun): DungeonRun {
    const target = Object.values(run.map.nodes).find((n) => n.dynamite)!;
    const below = Object.keys(run.map.nodes).find((id) => waysOn(run.map, id).some((n) => n.id === target.id))!;
    return enterRoom({ ...stepInside(run), path: [run.map.start, below], current: null }, target.id);
  }

  it("holds the dynamite: yours to take once any guard is beaten, and only once", () => {
    let guarded = 0;
    for (let i = 0; i < 30; i++) {
      const r = walkIn(startRun(["a"], ["a"], {}, 3, Math.random, 1, true));
      const room = r.current!;
      expect(room.kind).toBe("storehouse");
      expect(room.dynamite).toBe(true);
      if (hasFight(room)) guarded++;
      if (hasFight(room)) {
        expect(dynamiteHere(room)).toBe(false);
        expect(takeDynamite(r)).toBe(r);
        const won = { ...r, current: { ...room, done: true } };
        expect(dynamiteHere(won.current)).toBe(true);
        continue;
      }
      expect(dynamiteHere(room)).toBe(true);
      const taken = takeDynamite(r);
      expect(taken.current!.dynamite).toBe(false);
      expect(dynamiteHere(taken.current)).toBe(false);
      expect(takeDynamite(taken)).toBe(taken);
    }
    expect(guarded).toBeLessThan(30); // (some guarded, at the usual odds; most not)
  });
});

describe("the tavern questline: the rubble and the repair", () => {
  it("the rubble can be blown once, and only with the dynamite", () => {
    expect(canBlast({ accepted: true })).toBe(false);
    expect(canBlast({ accepted: true, dynamite: true })).toBe(true);
    const t = blast({ accepted: true, dynamite: true });
    expect(t.blasted).toBe(true);
    expect(canBlast(t)).toBe(false);
    expect(blast({ accepted: true })).toEqual({ accepted: true }); // no dynamite: nothing happens
  });

  it("the repair costs 5 metal bars, 20 planks and 5 nails, and shows have/need", () => {
    expect(REPAIR_COST).toEqual({ metal_bars: 5, planks: 20, nails: 5 });
    expect(repairNeeds({ planks: 30, nails: 2 })).toEqual([
      { key: "metal_bars", have: 0, need: 5 }, { key: "planks", have: 30, need: 20 }, { key: "nails", have: 2, need: 5 },
    ]);
  });

  it("is blocked while you're short or the room's still shut", () => {
    const open = { dynamite: true, blasted: true };
    expect(repair(open, { metal_bars: 5, planks: 19, nails: 5 })).toBeNull();
    expect(repair({ dynamite: true }, { metal_bars: 5, planks: 20, nails: 5 })).toBeNull();
  });

  it("only has visitors once it's repaired", () => {
    expect(tavernVisitors({ blasted: true, guests: { merchant: { runs: 1 } } }, 0)).toEqual([]);
    expect(tavernVisitors({ blasted: true, repaired: true, guests: { librarian: { runs: 1 } } }, 0)).toEqual(["librarian"]);
    expect(tavernVisitors({ blasted: true, repaired: true }, 0)).toEqual([]);
  });

  it("takes the materials exactly once", () => {
    const done = repair({ dynamite: true, blasted: true }, { metal_bars: 6, planks: 20, nails: 9, essence_stones: 2 })!;
    expect(done.tavern.repaired).toBe(true);
    expect(done.materials).toEqual({ metal_bars: 1, planks: 0, nails: 4, essence_stones: 2 });
    expect(repair(done.tavern, { metal_bars: 50, planks: 50, nails: 50 })).toBeNull();
  });
});

describe("the tavern questline: the Cyclops Head and the bookcase", () => {
  const repaired = { accepted: true, dynamite: true, blasted: true, seen: true, repaired: true };

  it("the head goes up by itself once the tavern's repaired and the Cyclops is beaten (the bounty's gone: 2026-11-16)", () => {
    expect(headUp({ blasted: true }, 3)).toBe(false);  // still broken
    expect(headUp(repaired, 0)).toBe(false);           // not beaten yet
    expect(headUp(repaired, 1)).toBe(true);
    expect(headUp({ blasted: true, mounted: true }, 0)).toBe(true); // handed in before the campaign
  });

  it("the bookcase schematic: the campaign's reward for the rubble, or the old bounty's", () => {
    expect(tavernPlan(repaired, 1)).toBe(false);
    // The campaign's reward for the rubble: the plans, found in the broken tavern.
    const found = { ...repaired, bookPlans: true };
    expect(tavernPlan(found, 1)).toBe(true);
    expect(tavernPlan(found, BOOKCASE_BUILT)).toBe(false); // already built
    expect(tavernPlan(found, 2)).toBe(false);              // an old save's crooked bookcase
    // A head handed in for the old bounty paid the plans, and they're kept.
    const old = { ...repaired, bounty: true, mounted: true };
    expect(hasBookPlans(old)).toBe(true);
    expect(tavernPlan(old, 1)).toBe(true);
  });

  it("the crooked bookcase: 10 planks and 5 nails for 20 slots; an old save's keeps 25", () => {
    expect(SCHEMATICS.crooked_bookcase.cost).toEqual({ planks: 10, nails: 5 });
    expect(bookcaseSize(1)).toBe(10);
    expect(bookcaseSize(BOOKCASE_BUILT)).toBe(20);
    expect(bookcaseSize(2)).toBe(25);
    expect(bookcaseSize()).toBe(10);
  });

  it("the bookcase schematic no longer turns up in the Labyrinth", () => {
    for (let i = 0; i < 400; i++) {
      expect(minibossExtras(Math.random, true).some((x) => "gear" in x && x.gear.dropType === "item" && x.gear.schematic === "crooked_bookcase")).toBe(false);
      const r = makeRoom("storehouse", Math.random, 8);
      expect((r.sack ?? []).some((x) => "gear" in x && x.gear.dropType === "item" && x.gear.schematic)).toBe(false);
    }
  });
});

describe("the tavern questline: visitors on the clock (decision 47)", () => {
  const W = VISITOR_WINDOW;
  const at = 1_000 * W + 60_000; // a minute into a window
  const seedOf = (s: string) => () => s;
  // A tavern whose seed brings who in this window (found by trying seeds).
  function seedBringing(want: (t: TavernQuest) => boolean, base: TavernQuest = { repaired: true }): string {
    for (let i = 0; i < 5000; i++) if (want(onTheClock(base, at, false, seedOf(`s${i}`)))) return `s${i}`;
    throw new Error("no seed");
  }

  it("only call at a repaired tavern", () => {
    expect(onTheClock({ blasted: true }, at)).toEqual({ blasted: true });
    expect(tavernVisitors({ blasted: true, guests: { merchant: { until: at + W } } }, at)).toEqual([]);
    expect(comeHome({ blasted: true })).toEqual({ blasted: true });
  });

  it("every half hour, each of the 4 rolls on their own 5% (so several can be in), staying to the window's end", () => {
    expect(W).toBe(30 * 60 * 1000);
    expect(VISITORS.map((v) => visitorChance({}, v))).toEqual([0.05, 0.05, 0.05]);
    const counts: Record<string, number> = {};
    let several = 0;
    for (let i = 0; i < 4000; i++) {
      const t = onTheClock({ repaired: true }, at, false, seedOf(`r${i}`));
      const who = tavernVisitors(t, at);
      for (const v of who) counts[v] = (counts[v] ?? 0) + 1;
      if (who.length > 1) several++;
      for (const v of who) expect(guestOf(t, v, at)!.until).toBe((windowOf(at) + 1) * W);
    }
    for (const v of VISITORS) { expect(counts[v] / 4000, v).toBeGreaterThan(0.035); expect(counts[v] / 4000, v).toBeLessThan(0.065); }
    expect(several).toBeGreaterThan(0);
  });

  it("is fixed per window: rolled once from the tavern's seed, so reloading doesn't reroll", () => {
    const seed = seedBringing((t) => tavernVisitors(t, at).length > 0);
    const first = onTheClock({ repaired: true }, at, false, seedOf(seed));
    expect(first.seed).toBe(seed);
    expect(first.rolled).toBe(windowOf(at));
    // The same window again (a reload): nothing changes, and it's the same object (nothing to save).
    expect(onTheClock(first, at + 60_000)).toBe(first);
    // Rolled afresh from the start (a lost save write): the same visitors with the same stock.
    expect(onTheClock({ repaired: true }, at + 5 * 60_000, false, seedOf(seed)).guests).toEqual(first.guests);
  });

  it("windows missed while away are gone: only the current one is rolled, and a stay ends with its window", () => {
    const seed = seedBringing((t) => tavernVisitors(t, at).length > 0);
    const first = onTheClock({ repaired: true }, at, false, seedOf(seed));
    const later = at + 7 * W;
    const back = onTheClock(first, later);
    expect(back.rolled).toBe(windowOf(later));
    for (const v of tavernVisitors(back, later)) expect(guestOf(back, v, later)!.until).toBe((windowOf(later) + 1) * W);
    expect(tavernVisitors(first, later)).toEqual([]); // (their stay was up)
  });

  it("no pity: a long run of empty windows brings nobody for sure", () => {
    let t: TavernQuest = { repaired: true, seed: "x" };
    let empty = 0;
    for (let w = 0; w < 200; w++) { t = onTheClock(t, (2000 + w) * W); if (!tavernVisitors(t, (2000 + w) * W).length) empty++; }
    expect(empty).toBeGreaterThan(100);
  });

  it("brings their stock: the merchant's cart, the librarian's 3 codexes; the collector and the Enchantress none", () => {
    for (const who of VISITORS) {
      const t = onTheClock({ repaired: true }, at, false, seedOf(seedBringing((x) => !!guestOf(x, who, at))));
      const g = guestOf(t, who, at)!;
      if (who === "merchant") expect(g.wares!.length).toBeGreaterThan(0);
      else expect(g.wares).toBeUndefined();
      if (who === "librarian") expect(g.offers).toHaveLength(3);
      else expect(g.offers).toBeUndefined();
      expect(g.bought).toEqual([]);
    }
  });

  it("an old save's visitor stays their old stay out (in runs), then the clock takes over", () => {
    const old: TavernQuest = { repaired: true, visitor: "librarian", stay: 2, offers: ["a", "b", "c"], bought: ["a"], visited: true, misses: 1 };
    const now = onTheClock(old, at, false, seedOf("old"));
    expect(now.visitor).toBeUndefined();
    expect(now.visited).toBeUndefined();
    expect(now.misses).toBeUndefined();
    expect(now.guests!.librarian).toEqual({ runs: 2, offers: ["a", "b", "c"], bought: ["a"], wares: undefined });
    expect(guestOf(now, "librarian", at + 99 * W)).toBeDefined(); // (not on the clock)
    const one = comeHome(now);
    expect(one.guests!.librarian!.runs).toBe(1);
    const gone = comeHome(one);
    expect(gone.guests!.librarian).toBeUndefined();
    // Coming home never brings anyone new.
    expect(comeHome({ repaired: true })).toEqual({ repaired: true });
  });

  it("sells one of each, per visitor", () => {
    const t = summonVisitor({ repaired: true }, "merchant", Math.random, false, at);
    const key = guestOf(t, "merchant", at)!.wares![0].key;
    const once = buyFromVisitor(t, "merchant", key, at);
    expect(guestOf(once, "merchant", at)!.bought).toEqual([key]);
    expect(buyFromVisitor(once, "merchant", key, at)).toBe(once);
    expect(buyFromVisitor(once, "librarian", key, at)).toBe(once); // (she isn't in)
  });

  it("the altar's testing button calls one straight away, opening and repairing the tavern", () => {
    const m = callVisitor({}, "merchant", Math.random, false, at);
    expect(tavernVisitors(m, at)).toEqual(["merchant"]);
    expect(m.blasted && m.repaired).toBe(true);
    const l = callVisitor(m, "librarian", Math.random, false, at);
    expect(tavernVisitors(l, at)).toEqual(["merchant", "librarian"]);
    expect(guestOf(l, "librarian", at)!.offers?.length).toBe(3);
  });

  it("charges more for materials than the Labyrinth's merchant, and buys them back at the Labyrinth's half", () => {
    expect(TAVERN_MATERIAL_PRICES.essence_stones).toBe(300);
    expect(TAVERN_MATERIAL_PRICES.essence).toBe(1000);
    for (const m of MERCHANT_MATERIALS) expect(TAVERN_MATERIAL_PRICES[m.material]).toBeGreaterThan(m.price);
    const labyrinth = makeRoom("merchant", () => 0.99, Infinity, 1, false).wares!; // no rare wares: materials fill the cart
    const tavern = tavernWares(labyrinth)!;
    expect(tavern.filter((w) => "material" in w).length).toBe(MERCHANT_MATERIALS.filter((m) => !m.chance).length); // (0.99: no essence stones)
    for (const w of tavern) {
      const before = labyrinth.find((x) => x.key === w.key)!;
      expect(w.price).toBe("material" in w ? TAVERN_MATERIAL_PRICES[w.material] : before.price);
    }
    // Every way a merchant calls brings the tavern's prices.
    const clock = onTheClock({ repaired: true }, at, false, seedOf(seedBringing((x) => !!guestOf(x, "merchant", at))));
    for (const t of [callVisitor({}, "merchant", Math.random, false, at), clock, merchantCalls({ repaired: true }, Math.random, false, at)])
      for (const w of guestOf(t, "merchant", at)!.wares!) if ("material" in w) expect(w.price).toBe(TAVERN_MATERIAL_PRICES[w.material]);
    expect(materialOffer("essence_stones")).toBe(75);
  });
});

describe("tavern upgrades (decision 47)", () => {
  it("+1% a level, 10 levels: 5% to 15%", () => {
    expect([UPGRADE_STEP, MAX_UPGRADE]).toEqual([0.01, 10]);
    expect(visitorChance({ upgrades: { librarian: 4 } }, "librarian")).toBeCloseTo(0.09);
    expect(visitorChance({ upgrades: { librarian: 4 } }, "merchant")).toBeCloseTo(0.05);
    expect(visitorChance({ upgrades: { merchant: 99 } }, "merchant")).toBeCloseTo(0.15);
  });
  it("cost materials, dearer each level: 120 planks, 45 nails, 85 metal bars, 26 stone and 2 essence stones a visitor", () => {
    expect(UPGRADE_COSTS).toHaveLength(10);
    const total: Record<string, number> = {};
    for (const c of UPGRADE_COSTS) for (const [k, n] of Object.entries(c)) total[k] = (total[k] ?? 0) + n!;
    expect(total).toEqual({ planks: 120, nails: 45, metal_bars: 85, essence_stones: 26, essence: 2 });
    // Dearer each level, by the merchant's prices for one of each.
    const worth = (c: Record<string, number | undefined>) => Object.entries(c).reduce((n, [k, v]) => n + (v ?? 0) * (TAVERN_MATERIAL_PRICES[k as keyof typeof TAVERN_MATERIAL_PRICES] ?? 0), 0);
    for (let i = 1; i < UPGRADE_COSTS.length; i++) expect(worth(UPGRADE_COSTS[i]), `level ${i + 1}`).toBeGreaterThan(worth(UPGRADE_COSTS[i - 1]));
    // Planks and nails first; stone, then essence, only at the top.
    expect(Object.keys(UPGRADE_COSTS[0])).toEqual(["planks", "nails"]);
    expect(UPGRADE_COSTS.findIndex((c) => c.essence_stones)).toBeGreaterThan(UPGRADE_COSTS.findIndex((c) => c.metal_bars));
    expect(UPGRADE_COSTS.findIndex((c) => c.essence)).toBeGreaterThan(UPGRADE_COSTS.findIndex((c) => c.essence_stones));
  });
  it("takes the next level's materials, once a level, only at a repaired tavern, and stops at 10", () => {
    const have = { planks: 6, nails: 3 };
    expect(upgradeVisitor({ blasted: true }, "collector", have)).toBeNull();
    const done = upgradeVisitor({ repaired: true }, "collector", have)!;
    expect(done.tavern.upgrades).toEqual({ collector: 1 });
    expect(done.materials).toEqual({ planks: 0, nails: 0 });
    expect(upgradeVisitor(done.tavern, "collector", done.materials)).toBeNull(); // (level 2 costs more)
    expect(upgradeCost({ repaired: true, upgrades: { collector: 10 } }, "collector")).toBeNull();
    expect(canUpgrade({ repaired: true, upgrades: { collector: 10 } }, "collector", { planks: 999 })).toBe(false);
  });
  it("an old save has none: every visitor at level 0", () => {
    for (const v of VISITORS) expect(upgradeLevel({ repaired: true }, v)).toBe(0);
  });
});

describe("the tavern questline: selling to the merchant", () => {
  const gearValue = () => 300;
  const sword = { ...toolDrop("flare"), id: "sword", itemCategory: "weapon", tool: undefined, itemKey: "sword", name: "Sword" } as unknown as Drop;
  it("buys what he'd buy in the Labyrinth, at the same prices", () => {
    const flare = toolDrop("flare"), potion = potionDrop("", "potion"), scroll = scrollDrop();
    const sells = tavernSellables([flare, potion, scroll, sword], new Set(), gearValue);
    expect(sells.map((x) => x.price)).toEqual([Math.floor(TOOLS.flare.price / 2), 50, 100, 300]);
  });
  it("won't take what's worn, packed or favourited, nor a schematic", () => {
    const flare = toolDrop("flare");
    expect(tavernSellables([flare, sword, schematicDrop("crooked_bookcase")], new Set(["sword"]), gearValue).map((x) => x.drop.id)).toEqual([flare.id]);
  });
  it("buys materials one at a time at half his price", () => {
    expect(materialOffer("planks")).toBe(4);
    expect(materialOffer("metal_bars")).toBe(22);
  });
});

describe("testing: opening the rubble", () => {
  it("opens it from any point in the quest, keeping the rest", () => {
    expect(forceOpen({})).toEqual({ accepted: true, dynamite: true, blasted: true });
    expect(forceOpen({ seen: true, repaired: true })).toMatchObject({ blasted: true, seen: true, repaired: true });
    expect(canBlast(forceOpen({}))).toBe(false); // nothing left to blow up
  });
});

describe("the tavern's room (the Den's cave, bare)", () => {
  // Node has no ImageData; the scene only needs its pixels.
  (globalThis as { ImageData?: unknown }).ImageData ??= class { data: Uint8ClampedArray; constructor(public width: number, public height: number) { this.data = new Uint8ClampedArray(width * height * 4); } };
  const ids = (bare: boolean) => {
    const den = createDen({ bare });
    den.render(0, OBJ.none);
    const seen = new Set<number>();
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) seen.add(den.idAt(x, y));
    return seen;
  };
  it("has nothing in it to tap: no furniture, pit, pool, archway, cage or rubble", () => {
    expect([...ids(true)]).toEqual([OBJ.none]);
  });
  slowIt("while the Den keeps all of them", () => {
    const den = ids(false);
    for (const id of [OBJ.arch, OBJ.altar, OBJ.pit, OBJ.pool, OBJ.cage, OBJ.tavern, OBJ.chest]) expect(den.has(id)).toBe(true);
  });
});

describe("drawing the Den: changed patches go to the screen in a few copies", () => {
  (globalThis as { ImageData?: unknown }).ImageData ??= class { data: Uint8ClampedArray; constructor(public width: number, public height: number) { this.data = new Uint8ClampedArray(width * height * 4); } };
  type Rect = [number, number, number, number];
  const covers = (big: Rect[], r: Rect) => big.some((b) => b[0] <= r[0] && b[1] <= r[1] && b[2] >= r[2] && b[3] >= r[3]);
  it("joins patches that are close, keeps far ones apart, and loses none", () => {
    const rects: Rect[] = [[0, 0, 2, 2], [3, 1, 5, 3], [1, 4, 3, 6], [900, 900, 902, 902], [904, 899, 906, 901]];
    const m = mergeRects(rects);
    expect(m.length).toBe(2);
    expect(rects.every((r) => covers(m, r))).toBe(true);
  });
  it("leaves a big patch alone rather than join it across the room", () => {
    expect(mergeRects([[0, 0, 300, 300], [1000, 1000, 1300, 1300]]).length).toBe(2);
  });
  it("a frame of the Den (embers and all) is a handful of copies, not one per ember", () => {
    const den = createDen({});
    den.render(0, OBJ.none);
    let most = 0;
    for (let f = 1; f <= 36; f++) { den.render(f / 12, OBJ.none); most = Math.max(most, den.dirty()?.length ?? 0); }
    expect(most).toBeLessThanOrEqual(20);
  });
});


describe("sending for a visitor at the tavern (the user, 2026-11-03)", () => {
  const at = 2_000 * VISITOR_WINDOW;
  it("500 gold; only once it's repaired; half an hour; a new one replaces one of the same kind, the others stay", () => {
    expect(SUMMON_PRICE).toBe(500);
    expect(summonVisitor({ blasted: true }, "librarian", Math.random, false, at)).toEqual({ blasted: true });
    const both = summonVisitor(summonVisitor({ repaired: true }, "merchant", Math.random, false, at), "librarian", Math.random, false, at);
    expect(tavernVisitors(both, at)).toEqual(["merchant", "librarian"]);
    expect(guestOf(both, "librarian", at)!.until).toBe(at + VISITOR_WINDOW);
    expect(tavernVisitors(both, at + VISITOR_WINDOW)).toEqual([]);
    const bought = buyFromVisitor(both, "librarian", guestOf(both, "librarian", at)!.offers![0], at);
    const again = summonVisitor(bought, "librarian", Math.random, false, at + 60_000);
    expect(guestOf(again, "librarian", at)!.bought).toEqual([]);
    expect(guestOf(again, "merchant", at)).toEqual(guestOf(both, "merchant", at));
  });
  it("a sent-for one rolled again in the next window stays to that window's end", () => {
    const t = summonVisitor({ repaired: true, seed: "x" }, "librarian", Math.random, false, at + VISITOR_WINDOW - 60_000);
    for (let i = 0; i < 2000; i++) {
      const next = onTheClock({ ...t, seed: `k${i}` }, at + VISITOR_WINDOW + 1);
      const g = guestOf(next, "librarian", at + VISITOR_WINDOW + 1);
      if (g && g.until === at + 2 * VISITOR_WINDOW) return;
    }
    throw new Error("never extended");
  });
});

describe("the tavern's visitor strolling round its room", () => {
  it("starts by the door, keeps clear of the tavern and the pit, and stays where it can be seen", () => {
    expect(strollAt(0, VISITOR_PATH, VISITOR_SPEED, VISITOR_PAUSE)).toMatchObject({ u: 12.4, v: 6.2, walking: false });
    const bad: string[] = [];
    let walked = false;
    const turned = new Set<boolean>();
    for (let t = 0; t < 600; t += 0.5) {
      const at = strollAt(t, VISITOR_PATH, VISITOR_SPEED, VISITOR_PAUSE);
      walked ||= at.walking;
      turned.add(at.left);
      const inTavern = at.u > 10 && at.u < 21 && at.v < 5.6;
      const inPit = at.u < 6.7 && at.v < 6.1;
      if (inTavern || inPit || at.v > 11.5 || at.u < 1 || at.u > 21) bad.push(`${t}s: ${at.u.toFixed(1)}, ${at.v.toFixed(1)}`);
    }
    expect(bad).toEqual([]);
    expect(walked).toBe(true);
    expect(turned.size).toBe(2); // they face both ways
  });
});
