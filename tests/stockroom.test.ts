// The stockroom (world version 18, the user, 2026-11-20): a small storehouse in an ordinary room.
import { describe, expect, it } from "vitest";
import { slowIt } from "./slow";
import { seeded } from "./walkBaseline";
import { startWalkRun, walkRoom } from "../lib/dungeon/walkRun";
import { makeRoom, WALK_ROOM_MIX, STOCKROOM_MATERIALS, type DungeonRun, type SackItem } from "../lib/dungeon/run";
import { STOCK_CRATES } from "../lib/world/place";
import { newWalkRun, placedProblem } from "../lib/world/migrate";
import { WALK_V } from "../lib/world/version";

const isMat = (x: SackItem) => "gear" in x && x.gear.dropType === "item" && !!x.gear.material;

describe("the stockroom", () => {
  it("is in the walkable rooms' mix, about 6% of rooms; never guarded; its stores 2–3 material stacks, a potion and now and then more", () => {
    const total = WALK_ROOM_MIX.reduce((n, [, w]) => n + w, 0), share = (WALK_ROOM_MIX.find(([k]) => k === "stockroom")?.[1] ?? 0) / total;
    expect(share).toBeGreaterThan(0.04);
    expect(share).toBeLessThan(0.08);
    for (let i = 0; i < 200; i++) {
      const r = makeRoom("stockroom", seeded(i), 8, 1);
      expect(r.guarded).toBeFalsy();
      const mats = (r.sack ?? []).filter(isMat).length;
      expect(mats).toBeGreaterThanOrEqual(STOCKROOM_MATERIALS[0]);
      expect(mats).toBeLessThanOrEqual(STOCKROOM_MATERIALS[1]);
      expect((r.sack ?? []).some((x) => "potion" in x)).toBe(true);
    }
  });

  slowIt("from world version 18: its chest holds all but the materials; its stacked crates and barrels the materials", () => {
    expect(WALK_V).toBe(18);
    let seen = 0;
    for (let i = 0; i < 400 && seen < 6; i++) {
      const run = startWalkRun(["a", "b"], ["a", "b"], { a: 1, b: 1 }, 5, [], false, seeded(i * 7919 + 3), 1, false);
      const ids = Object.keys(run.walk!.rooms).filter((k) => run.walk!.rooms[k].kind === "stockroom");
      if (!ids.length) continue;
      const placed = newWalkRun(run) as DungeonRun;
      expect(placedProblem(placed.walk!.placed, placed.walk!.v)).toBeNull();
      for (const id of ids) {
        const r = walkRoom(placed, id)!, mine = placed.walk!.placed!.filter((p) => p.room === id && p.id.startsWith("crate:"));
        const before = run.walk!.rooms[id].sack ?? [];
        if (!mine.length) continue;
        seen++;
        const chest = mine.findIndex((p) => p.def === "rickety-chest");
        expect(chest).toBe(0);
        expect(mine.length - 1).toBeGreaterThanOrEqual(1);
        expect(mine.length - 1).toBeLessThanOrEqual(STOCK_CRATES[1]);
        expect(mine.slice(1).every((p) => p.def === "stacked-crates" || p.def === "store-barrels")).toBe(true);
        expect(r.sack).toEqual([]);
        expect(r.crates![0]).toEqual(before.filter((x) => !isMat(x)));
        expect(r.crates!.slice(1).flat().length).toBe(before.filter(isMat).length);
        expect(r.crates!.slice(1).flat().every(isMat)).toBe(true);
      }
    }
    expect(seen).toBeGreaterThan(0);
  }, 120_000);

  it("a run placed before version 18 can't hold stacked crates", () => {
    expect(placedProblem([{ id: "crate:r1:1", def: "stacked-crates", room: "r1", x: 4, y: 4 }], 17)).toMatch(/stacked-crates/);
  });

});
