import { describe, expect, it } from "vitest";
import { slowIt } from "./slow";
import { rollLayout, layoutFloorplan, layoutMap, roomCentre, blockOf, WALK_SPEC, WALK_LABYRINTH, BLOCK, OLD_BLOCK, type Layout } from "../lib/dungeon/layout";
import { checkFloorplan, FLOOR, ROCK } from "../lib/dungeon/floorplan";
import { findPath } from "../lib/dungeon/walk";
import { DOOR_KEEP, MIDDLE_KEEP, AISLE, PILLAR, PILLARS_MOST } from "../lib/dungeon/interior";

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// Everything wrong with a furnished layout's rooms.
function problems(l: Layout, tag: string): string[] {
  const out: string[] = [];
  const fp = layoutFloorplan(l);
  out.push(...checkFloorplan(fp, layoutMap(l)).map((p) => `${tag}: ${p}`));
  for (const r of Object.values(l.rooms)) {
    const mid = roomCentre(r), doors = fp.doors.filter((d) => d.room === r.id);
    if (fp.tiles[mid.y * fp.w + mid.x] !== FLOOR) out.push(`${tag}: ${r.id}'s middle is built over`);
    for (const q of r.inner ?? []) for (let y = q.y; y < q.y + q.h; y++) for (let x = q.x; x < q.x + q.w; x++) {
      if (fp.tiles[y * fp.w + x] !== ROCK) out.push(`${tag}: ${r.id} inner not rock`);
      if (doors.some((d) => Math.hypot(d.x - x, d.y - y) < DOOR_KEEP)) out.push(`${tag}: ${r.id} built by a door`);
      if (Math.hypot(x - mid.x, y - mid.y) < MIDDLE_KEEP) out.push(`${tag}: ${r.id} built on its middle`);
      if (r.id === l.boss && Math.abs(x - mid.x) <= AISLE) out.push(`${tag}: the boss's aisle built over`);
    }
    // Every floor tile still reachable from the first door's room side.
    const from = doors[0];
    if (!from) continue;
    const start = [{ x: from.x + 1, y: from.y }, { x: from.x - 1, y: from.y }, { x: from.x, y: from.y + 1 }, { x: from.x, y: from.y - 1 }]
      .find((q) => fp.rooms[r.id].some((f) => q.x >= f.x && q.x < f.x + f.w && q.y >= f.y && q.y < f.y + f.h) && fp.tiles[q.y * fp.w + q.x] === FLOOR);
    if (!start) { out.push(`${tag}: ${r.id}'s door opens onto stone`); continue; }
    let cut = 0;
    for (const f of fp.rooms[r.id]) for (let y = f.y; y < f.y + f.h; y += 2) for (let x = f.x; x < f.x + f.w; x += 2) {
      if (fp.tiles[y * fp.w + x] === FLOOR && !findPath(fp, start, { x, y })) cut++;
    }
    if (cut > 0) out.push(`${tag}: ${cut} tiles of ${r.id} cut off`);
  }
  return out;
}

describe("rooms' insides (the odd pillar)", () => {
  it("the walkable Encampment: smaller rooms (2-tile blocks), furnished, every tile still reachable", () => {
    const all: string[] = [];
    let furnished = 0, rooms = 0;
    for (let seed = 1; seed <= 3; seed++) {
      const l = rollLayout(WALK_SPEC, seeded(seed));
      expect(blockOf(l)).toBe(BLOCK);
      all.push(...problems(l, `seed ${seed}`));
      furnished += Object.values(l.rooms).filter((r) => r.inner).length;
      rooms += Object.keys(l.rooms).length;
    }
    expect(all).toEqual([]);
    // Some rooms have a pillar or two (not the small ones or the entrance).
    expect(furnished / rooms).toBeGreaterThan(0.1);
  });
  it("new rooms get only the odd lone pillar: no walls, no rows (the boss's aisle aside)", () => {
    const fails: string[] = [];
    for (let seed = 1; seed <= 6; seed++) {
      const l = rollLayout(WALK_SPEC, seeded(seed));
      for (const r of Object.values(l.rooms)) {
        if (r.id === l.boss || !r.inner) continue;
        if (r.inner.length > PILLARS_MOST) fails.push(`${seed}: ${r.id} has ${r.inner.length} pieces`);
        if (r.inner.some((q) => q.w !== PILLAR || q.h !== PILLAR)) fails.push(`${seed}: ${r.id} has a wall`);
      }
    }
    expect(fails).toEqual([]);
  });
  slowIt("the walkable Labyrinth (3-tile blocks for now), and the boss's room keeps its aisle", () => {
    const all: string[] = [];
    for (let seed = 1; seed <= 3; seed++) {
      const l = rollLayout(WALK_LABYRINTH, seeded(seed));
      expect(blockOf(l)).toBe(OLD_BLOCK);
      all.push(...problems(l, `seed ${seed}`));
    }
    expect(all).toEqual([]);
  });
  it("a layout saved before (no block, no insides) draws as it did", () => {
    const l = rollLayout(WALK_SPEC, seeded(2));
    const old: Layout = { ...l, block: undefined, rooms: Object.fromEntries(Object.entries(l.rooms).map(([id, r]) => [id, { ...r, block: undefined, inner: undefined }])) };
    const fp = layoutFloorplan(old);
    expect(fp.w).toBe(l.w * OLD_BLOCK);
    expect(fp.tiles.some((t, i) => t === FLOOR && i >= 0)).toBe(true);
  });
});
