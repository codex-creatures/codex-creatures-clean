import { describe, it, expect } from "vitest";
import { rollMap, knownRooms, waysOn } from "../lib/dungeon/map";
import { DUNGEONS, startRun, stepInside, enterRoom, dynamiteHere, takeDynamite, hasFight, minibossExtras, makeRoom, type DungeonRun } from "../lib/dungeon/run";
import { tavernQuestDue, wantsStorehouse, canBlast, blast, tavernVisitor, repair, repairNeeds, REPAIR_COST, QUEST_CREATURE_LEVEL, QUEST_KLUTZ_LEVEL, canTakeBounty, headToMount, mountHead, tavernPlan } from "../lib/tavern";
import { SCHEMATICS, BOOKCASE_BUILT, bookcaseSize } from "../lib/items/materials";

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
  it("is the large room (one of the Deep's two), always marked on the scroll", () => {
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

  it("isn't there without the quest", () => {
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

  it("the schematic no longer turns up in the Labyrinth", () => {
    for (let i = 0; i < 400; i++) {
      expect(minibossExtras().some((x) => "gear" in x && x.gear.dropType === "item" && x.gear.schematic)).toBe(false);
      const r = makeRoom("storehouse", Math.random, 8);
      expect((r.sack ?? []).some((x) => "gear" in x && x.gear.dropType === "item" && x.gear.schematic)).toBe(false);
    }
  });
});
