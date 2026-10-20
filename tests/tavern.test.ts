import { describe, it, expect } from "vitest";
import { rollMap, knownRooms, waysOn } from "../lib/dungeon/map";
import { DUNGEONS, startRun, stepInside, enterRoom, dynamiteHere, takeDynamite, hasFight, type DungeonRun } from "../lib/dungeon/run";
import { tavernQuestDue, wantsStorehouse, QUEST_CREATURE_LEVEL, QUEST_KLUTZ_LEVEL } from "../lib/tavern";

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
