import { describe, it, expect } from "vitest";
import { slowIt } from "./slow";
import { rollMap, knownRooms, waysOn } from "../lib/dungeon/map";
import { DUNGEONS, startRun, stepInside, enterRoom, dynamiteHere, takeDynamite, hasFight, minibossExtras, makeRoom, MERCHANT_MATERIALS, type DungeonRun } from "../lib/dungeon/run";
import { tavernQuestDue, wantsStorehouse, canBlast, blast, forceOpen, tavernVisitor, repair, repairNeeds, REPAIR_COST, QUEST_CREATURE_LEVEL, QUEST_KLUTZ_LEVEL, canTakeBounty, headToMount, mountHead, bountyHasStep, bountyStep, callVisitor, tavernPlan, comeHome, buyFromVisitor, tavernSellables, materialOffer, merchantCalls, tavernWares, summonVisitor, SUMMON_PRICE, TAVERN_MATERIAL_PRICES, VISITOR_ODDS, VISITOR_PITY, VISITOR_STAY, type TavernQuest } from "../lib/tavern";
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
    expect(tavernVisitor({ blasted: true, visitor: "merchant" })).toBeUndefined();
    expect(tavernVisitor({ blasted: true, repaired: true, visitor: "librarian" })).toBe("librarian");
    expect(tavernVisitor({ blasted: true, repaired: true })).toBeUndefined();
  });

  it("takes the materials exactly once", () => {
    const done = repair({ dynamite: true, blasted: true }, { metal_bars: 6, planks: 20, nails: 9, essence_stones: 2 })!;
    expect(done.tavern.repaired).toBe(true);
    expect(done.materials).toEqual({ metal_bars: 1, planks: 0, nails: 4, essence_stones: 2 });
    expect(repair(done.tavern, { metal_bars: 50, planks: 50, nails: 50 })).toBeNull();
  });
});

describe("the tavern questline: the Cyclops bounty and the bookcase", () => {
  const repaired = { accepted: true, dynamite: true, blasted: true, seen: true, repaired: true };

  it("the bounty can only be taken from a repaired tavern, once", () => {
    expect(canTakeBounty({ blasted: true })).toBe(false);
    expect(canTakeBounty(repaired)).toBe(true);
    expect(canTakeBounty({ ...repaired, bounty: true })).toBe(false);
  });

  it("the head needs the bounty and a Cyclops win (one from before the bounty counts)", () => {
    expect(headToMount(repaired, 3)).toBe(false);                 // no bounty taken
    expect(headToMount({ ...repaired, bounty: true }, 0)).toBe(false); // not beaten yet
    expect(headToMount({ ...repaired, bounty: true }, 1)).toBe(true);
    expect(mountHead({ ...repaired, bounty: true }, 0).mounted).toBeUndefined();
  });

  it("the tavern shows its ❗ while the bounty's on offer or the head's ready to hand in", () => {
    expect(bountyHasStep({ blasted: true }, 0)).toBe(false);              // still broken
    expect(bountyHasStep(repaired, 0)).toBe(true);                        // bounty on offer
    expect(bountyHasStep({ ...repaired, bounty: true }, 0)).toBe(false);  // out hunting the Cyclops
    expect(bountyHasStep({ ...repaired, bounty: true }, 1)).toBe(true);   // head to hand in
    expect(bountyHasStep({ ...repaired, bounty: true, mounted: true }, 1)).toBe(false); // all done
  });

  it("mounting it is once only, and pays the bookcase schematic", () => {
    const t = mountHead({ ...repaired, bounty: true }, 2);
    expect(t.mounted).toBe(true);
    expect(headToMount(t, 2)).toBe(false);
    expect(tavernPlan(t, 1)).toBe(true);
    expect(tavernPlan({ ...repaired, bounty: true }, 1)).toBe(false);
    expect(tavernPlan(t, BOOKCASE_BUILT)).toBe(false); // already built
    expect(tavernPlan(t, 2)).toBe(false);              // an old save's crooked bookcase
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

describe("the tavern questline: visitors", () => {
  // These rolls first, then real ones (the stock rolls need them: a librarian picks 3 different codexes).
  const seq = (...xs: number[]) => { let i = 0; return () => (i < xs.length ? xs[i++] : Math.random()); };

  it("only call at a repaired tavern", () => {
    expect(comeHome({ blasted: true }, seq(0))).toEqual({ blasted: true });
  });

  it("the first roll after the repair always brings someone, in the usual proportions", () => {
    let merchants = 0;
    for (let i = 0; i < 400; i++) {
      const t = comeHome({ repaired: true });
      expect(t.visitor).toBeDefined();
      if (t.visitor === "merchant") merchants++;
    }
    // 12 : 8 → 60% merchants.
    expect(merchants / 400).toBeGreaterThan(0.5);
    expect(merchants / 400).toBeLessThan(0.7);
  });

  it("rolls 12% merchant, 8% librarian, else nobody", () => {
    expect(VISITOR_ODDS).toEqual({ merchant: 0.12, librarian: 0.08 });
    const base = { repaired: true, visited: true };
    expect(comeHome(base, seq(0.05)).visitor).toBe("merchant");
    expect(comeHome(base, seq(0.15)).visitor).toBe("librarian");
    const none = comeHome(base, seq(0.5));
    expect(none.visitor).toBeUndefined();
    expect(none.misses).toBe(1);
  });

  it("is sure to bring someone after 3 misses in a row", () => {
    expect(VISITOR_PITY).toBe(3);
    let t: TavernQuest = { repaired: true, visited: true };
    for (let i = 0; i < 3; i++) t = comeHome(t, seq(0.99));
    expect(t.visitor).toBeUndefined();
    t = comeHome(t, seq(0.99));
    expect(t.visitor).toBe("librarian"); // 0.99 of the sure range
    expect(t.misses).toBe(0);
  });

  it("the altar's testing button calls one straight away, opening and repairing the tavern", () => {
    const m = callVisitor({}, "merchant");
    expect(tavernVisitor(m)).toBe("merchant");
    expect(m.blasted && m.repaired).toBe(true);
    expect(m.wares?.length).toBeGreaterThan(0);
    expect(m.stay).toBe(VISITOR_STAY);
    const l = callVisitor(m, "librarian");
    expect(tavernVisitor(l)).toBe("librarian");
    expect(l.offers?.length).toBe(3);
  });

  it("brings their stock, stays 2 runs, then leaves", () => {
    expect(VISITOR_STAY).toBe(2);
    const m = comeHome({ repaired: true }, seq(0.1));
    expect(m.visitor).toBe("merchant");
    expect(m.wares?.length).toBeGreaterThan(0);
    const l = comeHome({ repaired: true }, seq(0.9));
    expect(l.visitor).toBe("librarian");
    expect(l.offers?.length).toBe(3);
    const still = comeHome(m, seq(0.99));
    expect(still.visitor).toBe("merchant");
    expect(still.wares).toBe(m.wares);
    const gone = comeHome(still, seq(0.99));
    expect(gone.visitor).toBeUndefined();
    expect(gone.wares).toBeUndefined();
  });

  it("sells one of each", () => {
    const m = comeHome({ repaired: true }, seq(0.1));
    const key = m.wares![0].key;
    const once = buyFromVisitor(m, key);
    expect(once.bought).toEqual([key]);
    expect(buyFromVisitor(once, key)).toBe(once);
    expect(buyFromVisitor({ repaired: true }, key).bought).toBeUndefined();
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
    for (const t of [callVisitor({}, "merchant"), comeHome({ repaired: true }, seq(0.1)), merchantCalls({ repaired: true })])
      for (const w of t.wares!) if ("material" in w) expect(w.price).toBe(TAVERN_MATERIAL_PRICES[w.material]);
    expect(materialOffer("essence_stones")).toBe(75);
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

describe("the bounty on the quest board", () => {
  it("goes up with the repair, then hunt, head and paid", () => {
    const repaired: TavernQuest = { blasted: true, repaired: true };
    expect(bountyStep({ blasted: true }, 1)).toBe("closed");
    expect(bountyStep(repaired, 1)).toBe("offer");
    expect(bountyStep({ ...repaired, bounty: true }, 0)).toBe("hunt");
    expect(bountyStep({ ...repaired, bounty: true }, 1)).toBe("head");
    expect(bountyStep({ ...repaired, bounty: true, mounted: true }, 1)).toBe("paid");
  });
});

describe("sending for a visitor at the tavern (the user, 2026-11-03)", () => {
  it("500 gold; only once it's repaired; a new one replaces whoever's in, with new stock", () => {
    expect(SUMMON_PRICE).toBe(500);
    expect(summonVisitor({ blasted: true }, "librarian")).toEqual({ blasted: true });
    const lib = summonVisitor({ blasted: true, repaired: true, visitor: "merchant", stay: 1, bought: ["x"] }, "librarian");
    expect(lib).toMatchObject({ visitor: "librarian", stay: VISITOR_STAY, bought: [] });
    expect(lib.offers?.length).toBeGreaterThan(0);
    const again = summonVisitor({ ...lib, bought: [lib.offers![0]] }, "librarian");
    expect(again.bought).toEqual([]);
    expect(summonVisitor(lib, "merchant").wares?.length).toBeGreaterThan(0);
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
