import { describe, it, expect } from "vitest";
import { pinnedRun } from "./pinnedRuns";
import { walkRoom } from "../lib/dungeon/walkRun";
import { dungeonOf, cornerCrateFind, CORNER_FIND, type DungeonRun, type SackItem } from "../lib/dungeon/run";
import { placeWalk, PLACED_V, SEARCH_V, CORNER_THEMES_V17 } from "../lib/world/place";
import { WALK_V } from "../lib/world/version";
import { placedProblem as checkPlaced } from "../lib/world/migrate";

// World version 17 (the user, 2026-11-17): no nests in rooms' corners (they don't fit), and the crates in
// rooms' corners can be searched, now and then holding one material or consumable.
const placed = (v: number, seed: number) => {
  const run = pinnedRun(0, seed), r: DungeonRun = { ...run, walk: { ...run.walk!, v } };
  return placeWalk(r.walk!, r.map, dungeonOf(r), (id) => walkRoom(r, id)).placed;
};

describe("world version 17", () => {
  it("searchable corner crates from version 17 (new runs are placed at 18 since: tests/stockroom.test.ts)", () => {
    expect(WALK_V).toBeGreaterThanOrEqual(17);
    expect(PLACED_V).toBeGreaterThanOrEqual(17);
    expect(SEARCH_V).toBe(17);
  });

  it("puts no nests in rooms' corners", () => {
    expect(Object.values(CORNER_THEMES_V17).flat(2)).not.toContain("nest");
    for (const seed of [31, 32]) expect(placed(17, seed).filter((i) => i.def === "nest")).toEqual([]);
  });

  it("marks every corner crate to search (and only crates, only from v17)", () => {
    const all = [31, 32].flatMap((seed) => placed(17, seed));
    const corner = all.filter((i) => i.id.startsWith("decor:"));
    for (const i of corner) expect(!!i.search).toBe(i.def === "crates");
    expect([31, 32].flatMap((seed) => placed(16, seed)).some((i) => i.search)).toBe(false);
  });

  it("refuses a search on anything but a crate, or before v17", () => {
    const crate = { id: "decor:r1:0:0", def: "crates", room: "r1", sx: 3, sy: 3, search: true };
    expect(checkPlaced([crate], 17)).toBeNull();
    expect(checkPlaced([crate], 16)).toMatch(/search/);
    expect(checkPlaced([{ ...crate, def: "pots" }], 17)).toMatch(/search/);
  });
});

describe("a corner crate's find", () => {
  it("is empty about CORNER_FIND of the time; otherwise one material bundle or one consumable", () => {
    let seed = 1;
    const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const finds = Array.from({ length: 2000 }, () => cornerCrateFind(rng));
    const empty = finds.filter((f) => f.length === 0).length / finds.length;
    expect(Math.abs(empty - (1 - CORNER_FIND))).toBeLessThan(0.05);
    const bad: SackItem[][] = [];
    for (const f of finds.filter((x) => x.length)) {
      const it = f[0];
      const ok = f.length === 1 && ("potion" in it || ("gear" in it && it.gear.dropType === "item" && (!!it.gear.material || !!it.gear.tool)));
      if (!ok) bad.push(f);
    }
    expect(bad).toEqual([]);
  });
});

describe("a room's corner barrels in 3D (the user, 2026-11-17: a single barrel and the pair)", () => {
  it("are alone or two by the thing's id, the same every time, and both turn up", async () => {
    const { barrelsOf, DECOR_3D } = await import("../lib/render3d/props3d");
    const ids = Array.from({ length: 40 }, (_, i) => `decor:r${i}:0:1`);
    expect(ids.map(barrelsOf)).toEqual(ids.map(barrelsOf));
    expect(new Set(ids.map(barrelsOf))).toEqual(new Set(["barrel", "barrels"]));
    expect(DECOR_3D["store-barrels"]).toBe("barrel"); // (a storehouse's, each searched, stand alone)
  });
});
