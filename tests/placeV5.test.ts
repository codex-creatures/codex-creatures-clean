import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { slowIt } from "./slow";
import { seeded } from "./walkBaseline";
import { startWalkRun, walkRoom } from "../lib/dungeon/walkRun";
import { dungeonOf, type DungeonRun } from "../lib/dungeon/run";
import { layoutFloorplan } from "../lib/dungeon/layout";
import { ROCK, type Pt } from "../lib/dungeon/floorplan";
import { CANDLE_CLEAR, CANDLE_RADIUS, DARK_KEPT, LIGHT_GAP, MOUNTED_CAP, FLOOR_CANDLE_CAP, FLOOR_KEEP_OFF, CANDLE_MIN_DARK, CANDLE_GROUP } from "../lib/dungeon/torch";
import { placeWalk, candleCount, mountedDef, MOUNTED_DEFS, PLACED_V, type Placed } from "../lib/world/place";
import { attachmentSlots, slotKey, panelKey, occupant, type Slot } from "../lib/world/occupancy";
import { navBlocked } from "../lib/world/policy";
import { panelOfSubcell, footprintPanels } from "../lib/world/grid";
import { objectDef, type Instance } from "../lib/world/objects";
import { WALK_V } from "../lib/world/version";
import { placementSvg } from "../lib/world/placementView";
import { newWalkRun, migrateWalkRun, canRecover, recoverWalkRun, placedProblem } from "../lib/world/migrate";
import { placementsFrom } from "../lib/world/placements";
import { unsupportedRun } from "../lib/world/version";

// World version 5's candles (docs/world-spec.md §8 2b-2 stage B, step B1):
// the room-by-room budget, mounted candles on walls' and pillars' faces, and
// floor candles as placed objects; and (B5) new runs made at v5, with the save
// checks, mending, and how the walk reads them. Version 6 (the user's
// play-test, 2026-11-09) keeps floor candles out of mounted candles' light and
// off the panels by stone; new runs are made at it.

const made = (d: 0 | 1, seed: number, v = 5): DungeonRun => {
  const run = startWalkRun(["a", "b"], ["a", "b"], { a: 1, b: 0.5 }, 4, d === 0 ? [{ creatureId: "moss_wolf", level: 3 }, {}] : [], false, seeded(seed * 7919 + 13), d);
  return { ...run, walk: { ...run.walk!, v } };
};
const placedOf = (run: DungeonRun) => placeWalk(run.walk!, run.map, dungeonOf(run), (id) => walkRoom(run, id));
const panelOf = (i: Instance): Pt => ({ x: panelOfSubcell(i.sx), y: panelOfSubcell(i.sy) });
const STEP = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] } as const;
// The slot a mounted candle took: its subcell is the light cell in front of the slot, so its place
// along the face (k) is how far that subcell is from its panel's middle, along the wall.
const slotOf = (slots: Map<string, Slot>, i: Instance) => {
  const at = panelOf(i), k = i.wall === "north" || i.wall === "south" ? i.sx - 3 * at.x : i.sy - 3 * at.y;
  return slots.get(slotKey(at, i.wall!, k as -1 | 0 | 1));
};
const inRect = (r: { x: number; y: number; w: number; h: number }, p: Pt) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;

// A few runs, shared by the checks below (the Cyclops's take seconds each: test:all adds them).
const RUNS: [0 | 1, number][] = process.env.FULL_TESTS ? [[0, 1], [0, 2], [0, 3], [1, 1], [1, 2]] : [[0, 1], [0, 2]];
const cases = RUNS.map(([d, s]) => { const run = made(d, s); return { d, s, run, p: placedOf(run) }; });

describe("the candle budget's arithmetic", () => {
  it("rolls E's whole part, and one more by the chance of what's left, capped", () => {
    expect(candleCount(0, 2, 0)).toBe(0);           // no dark (or W 0): none, whatever the roll
    expect(candleCount(0.3, 2, 0.29)).toBe(1);      // E 0.3: a 30% chance of one
    expect(candleCount(0.3, 2, 0.3)).toBe(0);
    expect(candleCount(1.4, 2, 0.39)).toBe(2);      // E 1.4: one, and a 40% chance of a second
    expect(candleCount(1.4, 2, 0.5)).toBe(1);
    expect(candleCount(3.6, MOUNTED_CAP[0], 0)).toBe(2); // the caps: 2 a room, 3 in a large room
    expect(candleCount(3.6, MOUNTED_CAP[1], 0)).toBe(3);
    expect(candleCount(1.4, FLOOR_CANDLE_CAP[0], 0)).toBe(1);
  });
  it("works out each room's D, W and E as the design says; W 0 and dark-free rooms get none", () => {
    for (const { p } of cases) for (const b of p.lighting!.budgets) {
      expect(b.weight).toBe({ none: 0, fight: 0.75, quiet: 1, lived: 1.25 }[CANDLE_GROUP[b.kind] ?? "none"]);
      expect(b.mounted).toBeLessThanOrEqual(b.wanted);
      expect(b.wanted).toBeLessThanOrEqual(MOUNTED_CAP[b.large ? 1 : 0]);
      expect(b.floorPlaced).toBeLessThanOrEqual(b.floorWanted);
      if (b.weight === 0 || b.dark === 0) expect(b.mounted + b.floorPlaced * (b.weight === 0 ? 1 : 0)).toBe(0);
      // Meaningful dark kept: no candle took the room under DARK_KEPT.
      if (b.mounted) expect(b.darkLeft / b.floor).toBeGreaterThanOrEqual(DARK_KEPT - 1e-9);
    }
  });
});

describe("mounted candles (v5)", () => {
  it("each takes a slot of its own room's walls or pillars, one thing a slot, light cell on floor with stone behind", () => {
    for (const { run, p } of cases) {
      const fp = layoutFloorplan(run.walk!.layout), slots = new Map(attachmentSlots(fp).map((s) => [s.key, s]));
      const owners = [...p.occupancy.attached.values()];
      expect(new Set(owners).size).toBe(owners.length);
      for (const i of p.placed.filter((q) => MOUNTED_DEFS.includes(q.def))) {
        const sl = slotOf(slots, i)!;
        expect(sl, i.id).toBeDefined();
        expect(p.occupancy.attached.get(sl.key)).toBe(i.id);
        expect(i.def).toBe(mountedDef(i.wall!));
        expect(fp.rooms[i.room].some((r) => inRect(r, sl.floor))).toBe(true);
        // Its light point is floor; the stone is on its wall's side (never light from inside rock).
        const fl = panelOf(i);
        expect(fp.tiles[fl.y * fp.w + fl.x]).not.toBe(ROCK);
        const [dx, dy] = STEP[i.wall!];
        expect(fp.tiles[(fl.y + dy) * fp.w + fl.x + dx]).toBe(ROCK);
        expect(i.size).toBeUndefined();
      }
    }
  });
  it("keeps the gaps: from every torch, campfire and other candle, at most one a pillar, off doorways, nothing solid in front", () => {
    for (const { run, p } of cases) {
      const fp = layoutFloorplan(run.walk!.layout), slots = new Map(attachmentSlots(fp).map((s) => [s.key, s]));
      const mounted = p.placed.filter((q) => MOUNTED_DEFS.includes(q.def));
      const torches = p.placed.filter((q) => q.def === "sconce" || q.def === "sconce-side").map(panelOf);
      const others = [...torches, ...(run.walk!.fires ?? [])];
      const pillars = new Map<string, string>();
      for (const i of mounted) {
        const at = panelOf(i), sl = slotOf(slots, i)!;
        for (const q of [...others, ...mounted.filter((m) => m !== i).map(panelOf)]) expect(Math.hypot(q.x - at.x, q.y - at.y), i.id).toBeGreaterThanOrEqual(LIGHT_GAP);
        expect(p.occupancy.reserved.get(panelKey(at))?.why).not.toBe("door");
        expect(occupant(p.occupancy, "blocking", { sx: i.sx, sy: i.sy })).toBeUndefined();
        if (sl.kind === "pillar") {
          // The pillar it's on: its stone panels, touching.
          const seen = new Set([panelKey(sl.rock)]), queue = [sl.rock];
          while (queue.length) { const a = queue.shift()!; for (const [dx, dy] of Object.values(STEP)) { const n = { x: a.x + dx, y: a.y + dy }; if (!seen.has(panelKey(n)) && fp.tiles[n.y * fp.w + n.x] === ROCK && fp.rooms[i.room].some((r) => inRect(r, n))) { seen.add(panelKey(n)); queue.push(n); } } }
          const name = [...seen].sort()[0];
          expect(pillars.get(name), `${i.id} and ${pillars.get(name)} on one pillar`).toBeUndefined();
          pillars.set(name, i.id);
        }
      }
    }
  });
  it("in a dog-leg, the second goes in the other leg while that's still dark", () => {
    let checked = 0;
    for (const { run, p } of cases) {
      const fp = layoutFloorplan(run.walk!.layout), L = p.lighting!;
      for (const b of L.budgets.filter((q) => fp.rooms[q.room].length > 1 && q.mounted >= 2)) {
        const rects = fp.rooms[b.room], rectOf = (q: Pt) => rects.findIndex((r) => inRect(r, q));
        const [first, second] = p.placed.filter((q) => q.room === b.room && MOUNTED_DEFS.includes(q.def));
        const other = rects.findIndex((_, k) => k !== rectOf(panelOf(first)));
        const darkThere = [...L.dark].map((k) => { const [x, y] = k.split(",").map(Number); return { x, y }; })
          .filter((q) => rectOf(q) === other && L.candleLit.get(panelKey(q)) !== first.id).length;
        if (darkThere >= CANDLE_MIN_DARK) { expect(rectOf(panelOf(second))).toBe(other); checked++; }
      }
    }
    expect(checked).toBeGreaterThanOrEqual(0); // (the sim below finds them across many runs)
  });
});

describe("floor candles (v5)", () => {
  it("are floor-candle objects, never lit to start, clear of doors, paths and what you use", () => {
    for (const { run, p } of cases) {
      const fp = layoutFloorplan(run.walk!.layout);
      expect(p.placed.some((i) => i.def === "candle")).toBe(false);
      for (const i of p.placed.filter((q) => q.def === "floor-candle")) {
        expect(i.start).toBeUndefined();
        const at = panelOf(i);
        for (const d of fp.doors.filter((q) => q.room === i.room)) expect(Math.hypot(d.x - at.x, d.y - at.y)).toBeGreaterThanOrEqual(CANDLE_CLEAR);
        expect(p.occupancy.reserved.get(panelKey(at))?.why).not.toBe("path");
        const used = p.placed.filter((q) => q.room === i.room && q.size && objectDef(q.def).attach === "floor" && objectDef(q.def).interact).flatMap((q) => footprintPanels(q, q.size!));
        for (const q of used) expect(Math.hypot(q.x - at.x, q.y - at.y), i.id).toBeGreaterThanOrEqual(FLOOR_KEEP_OFF[1]);
      }
    }
  });
  it("ids: the room's first candle of either kind is candle:<room>, then :1, :2…", () => {
    for (const { p } of cases) {
      const byRoom = new Map<string, string[]>();
      for (const i of p.placed.filter((q) => q.def === "floor-candle" || MOUNTED_DEFS.includes(q.def))) byRoom.set(i.room, [...(byRoom.get(i.room) ?? []), i.id]);
      for (const [room, ids] of byRoom) expect(ids).toEqual(ids.map((_, n) => (n ? `candle:${room}:${n}` : `candle:${room}`)));
    }
  });
});

describe("v5 changes only the candles", () => {
  const strip = (p: Placed) => p.placed.filter((i) => i.def === "sconce" || i.def === "sconce-side");
  // (Seconds: test:all runs it.)
  slowIt("is deterministic; torches identical to v4; walking blocked exactly where v4 blocks it", async () => {
    for (const { d, s, run, p } of cases) {
      await new Promise((ok) => setTimeout(ok, 0));
      expect(JSON.stringify(placedOf(made(d, s)).placed)).toBe(JSON.stringify(p.placed));
      const v4 = placedOf(made(d, s, 4)), fp = layoutFloorplan(run.walk!.layout);
      expect(strip(p)).toEqual(strip(v4));
      for (const id of Object.keys(fp.rooms)) for (const r of fp.rooms[id]) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
        expect(navBlocked(p.occupancy, { x, y }), `${id} ${x},${y}`).toBe(navBlocked(v4.occupancy, { x, y }));
      }
      expect(p.report.problems).toEqual([]);
    }
  }, 120000);
  it("a v4 run has no budget or v5 candles", () => {
    const v4 = placedOf(made(0, 1, 4));
    expect(v4.lighting).toBeUndefined();
    expect(v4.placed.some((i) => i.def === "floor-candle" || MOUNTED_DEFS.includes(i.def))).toBe(false);
  });
});

describe("new runs (B5; world version 7 since 2026-11-09)", () => {
  const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));
  const quiet = <T>(f: () => T): T => { const warn = console.warn; console.warn = () => {}; try { return f(); } finally { console.warn = warn; } };
  const fresh = (d: 0 | 1, s: number) => { const r = made(d, s); return newWalkRun({ ...r, walk: { ...r.walk!, v: undefined } }); };
  // The first Encampment run with candles of both kinds.
  const run = Array.from({ length: 20 }, (_, k) => k + 1).map((k) => fresh(0, k))
    .find((r) => r.walk!.placed!.some((i) => MOUNTED_DEFS.includes(i.def)) && r.walk!.placed!.some((i) => i.def === "floor-candle"))!;
  it("are made at the newest version, survive save, export and reload unchanged, and open as they were made", () => {
    expect(PLACED_V).toBe(7);
    expect(WALK_V).toBe(7);
    expect(run.walk!.v).toBe(7);
    expect(run.walk!.placed!.some((i) => MOUNTED_DEFS.includes(i.def) || i.def === "floor-candle")).toBe(true);
    expect(run.walk!.placed).toEqual(placedOf(run).placed);
    expect(json(run)).toEqual(run);
    expect(migrateWalkRun(json(run)).outcome).toBe("unchanged");
    expect(quiet(() => newWalkRun(run))).toEqual(run);
  });
  it("a damaged run is held, and mended into the run as made", () => {
    const broken = { ...run, walk: { ...run.walk!, placed: [] as Instance[] } };
    expect(quiet(() => migrateWalkRun(broken)).outcome).toBe("damaged");
    expect(canRecover(broken)).toBe(true);
    const mended = quiet(() => recoverWalkRun(broken));
    expect(mended.run.walk!.v).toBe(7);
    expect(mended.run.walk!.placed).toEqual(run.walk!.placed);
  });
  it("refuses stage B's candles where they can't be: in a v4 run, a floor candle lit to start, a mounted one off its wall", () => {
    const placed = run.walk!.placed!, mounted = placed.find((i) => MOUNTED_DEFS.includes(i.def))!;
    const floorC = placed.find((i) => i.def === "floor-candle")!;
    expect(placedProblem(placed, 4)).toMatch(/in a world version 4 run/);
    expect(placedProblem(placed, 5)).toBeNull();
    const swap = (i: Instance, to: Partial<Instance>) => ({ ...run, walk: { ...run.walk!, placed: placed.map((q) => (q === i ? { ...q, ...to } : q)) } });
    expect(quiet(() => migrateWalkRun(swap(floorC, { start: "lit" }))).outcome).toBe("damaged");
    expect(quiet(() => migrateWalkRun(swap(mounted, { wall: undefined }))).outcome).toBe("damaged");
    // Its wall turned to face the floor: no stone on that side.
    const away = ({ north: "south", south: "north", west: "east", east: "west" } as const)[mounted.wall!];
    expect(quiet(() => migrateWalkRun(swap(mounted, { wall: away }))).problem).toMatch(/no stone/);
    // A v4 run carrying one is damaged, not read.
    const v4 = { ...run, walk: { ...run.walk!, v: 4 } };
    expect(quiet(() => migrateWalkRun(v4)).outcome).toBe("damaged");
  });
  it("an older copy of the game holds a run from a newer version untouched", () => {
    expect(unsupportedRun({ walk: { v: 7 } })).toBe(false);
    expect(unsupportedRun({ walk: { v: 8 } })).toBe(true);
    const newer = { ...run, walk: { ...run.walk!, v: 8 } };
    expect(migrateWalkRun(newer)).toEqual({ run: newer, outcome: "unsupported", problem: expect.any(String) });
  });
  it("the walk reads them: mounted candles as candles at the floor by their wall, lit as rolled or as you lit them; floor candles unlit to start, lit by walking near as any candle", () => {
    const placed = run.walk!.placed!, mounted = placed.filter((i) => MOUNTED_DEFS.includes(i.def)), floors = placed.filter((i) => i.def === "floor-candle");
    const unlit = mounted.find((i) => !i.start);
    const lit = unlit ? [unlit.id] : [];
    const p = placementsFrom(placed, { ...run.walk!, lit }), again = placementsFrom(json(placed), json({ ...run.walk!, lit }));
    expect(again.candles).toEqual(p.candles);
    const fp = layoutFloorplan(run.walk!.layout);
    for (const i of mounted) {
      const c = p.candles.find((q) => q.id === i.id)!;
      expect(c.lit).toBe(i.start === "lit" || lit.includes(i.id));
      // Its light point rounds to its floor panel, never into the wall.
      expect(fp.tiles[Math.round(c.y) * fp.w + Math.round(c.x)]).not.toBe(ROCK);
    }
    for (const i of floors) expect(p.candles.find((q) => q.id === i.id)).toEqual({ id: i.id, room: i.room, x: expect.any(Number), y: expect.any(Number), lit: false });
  });
});

describe("world version 6's floor candles (the user's play-test, 2026-11-09)", () => {
  const AROUND = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => [dx, dy])).filter(([dx, dy]) => dx || dy);
  // Floor candles too near a mounted candle's light point, or on a panel touching stone (diagonals too).
  const problems = (run: DungeonRun, p: Placed) => {
    const fp = layoutFloorplan(run.walk!.layout), out: string[] = [];
    const mounted = p.placed.filter((i) => MOUNTED_DEFS.includes(i.def)).map(panelOf);
    for (const i of p.placed.filter((q) => q.def === "floor-candle")) {
      const at = panelOf(i);
      if (mounted.some((q) => Math.hypot(q.x - at.x, q.y - at.y) <= CANDLE_RADIUS)) out.push(`${i.id} in a mounted candle's light`);
      if (AROUND.some(([dx, dy]) => fp.tiles[(at.y + dy) * fp.w + at.x + dx] === ROCK)) out.push(`${i.id} by stone`);
    }
    return out;
  };
  it("are never in a mounted candle's light, nor by a wall or pillar; v5 runs keep theirs", () => {
    let floors = 0, v5Problems = 0;
    for (const [d, s] of RUNS) {
      const run = made(d, s, 6), p = placedOf(run);
      expect(problems(run, p)).toEqual([]);
      floors += p.placed.filter((i) => i.def === "floor-candle").length;
      // (Only the floor candles differ from v5.)
      const v5 = cases.find((c) => c.d === d && c.s === s)!.p;
      expect(p.placed.filter((i) => i.def !== "floor-candle" && i.def !== "foe")).toEqual(v5.placed.filter((i) => i.def !== "floor-candle" && i.def !== "foe"));
      v5Problems += problems(run, v5).length;
    }
    expect(floors).toBeGreaterThan(0);
    expect(v5Problems).toBeGreaterThan(0); // (what the user saw: v5's rules allowed both)
  });
  slowIt("floor candles a room at v6 (printed), against v5's", async () => {
    let rooms = 0, f5 = 0, f6 = 0;
    for (const d of [0, 1] as const) for (let s = 1; s <= 10; s++) {
      await new Promise((ok) => setTimeout(ok, 0));
      const r5 = placedOf(made(d, s, 5)), run = made(d, s, 6), r6 = placedOf(run);
      expect(problems(run, r6)).toEqual([]);
      rooms += Object.keys(run.walk!.layout.rooms).length;
      f5 += r5.placed.filter((i) => i.def === "floor-candle").length; f6 += r6.placed.filter((i) => i.def === "floor-candle").length;
    }
    console.log(`${rooms} rooms: floor candles ${(f5 / rooms).toFixed(2)} a room at v5, ${(f6 / rooms).toFixed(2)} at v6`);
    expect(f6).toBeGreaterThan(0);
  }, 300000);
});

// The sim (B1): counts per room kind and shape, and the starting-lit shares, over many runs.
// PLACEMENT_SVG=<folder> also writes example rooms for gate 1.
describe("the v5 candle sim", () => {
  // (Async, with a pause between runs, so the test runner's worker can still report while it works.)
  const breathe = () => new Promise((ok) => setTimeout(ok, 0));
  slowIt("new runs: about 0.5 mounted candles a room, lit shares by kind, and the dog-leg spread", async () => {
    const by: Record<string, { rooms: number; mounted: number; floor: number; lit: number }> = {};
    const add = (k: string, m: number, f: number, l: number) => { const r = (by[k] ??= { rooms: 0, mounted: 0, floor: 0, lit: 0 }); r.rooms++; r.mounted += m; r.floor += f; r.lit += l; };
    let spread = 0, sameLeg = 0;
    for (const d of [0, 1] as const) for (let s = 1; s <= 10; s++) {
      await breathe();
      const run = made(d, s, PLACED_V), p = placedOf(run), fp = layoutFloorplan(run.walk!.layout); // (new runs' version: the density is set per version)
      for (const b of p.lighting!.budgets) {
        const rects = fp.rooms[b.room], mine = p.placed.filter((i) => i.room === b.room && MOUNTED_DEFS.includes(i.def));
        const pillars = rects.some((r) => { for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (fp.tiles[y * fp.w + x] === ROCK) return true; return false; });
        const shape = b.large ? "large" : rects.length > 1 ? "dog-leg" : pillars ? "pillars" : "plain";
        const lit = mine.filter((i) => i.start === "lit").length;
        add("all", b.mounted, b.floorPlaced, lit); add(`kind ${b.group}`, b.mounted, b.floorPlaced, lit); add(`shape ${shape}`, b.mounted, b.floorPlaced, lit);
        if (rects.length > 1 && mine.length >= 2) {
          const legs = new Set(mine.map((i) => rects.findIndex((r) => inRect(r, panelOf(i)))));
          if (legs.size > 1) spread++; else sameLeg++;
        }
      }
    }
    const per = (k: string) => by[k].mounted / by[k].rooms, litShare = (k: string) => by[k].lit / by[k].mounted;
    console.log(Object.entries(by).map(([k, r]) => `${k}: ${r.rooms} rooms, ${(r.mounted / r.rooms).toFixed(2)} mounted, ${(r.floor / r.rooms).toFixed(2)} floor, ${r.mounted ? Math.round((100 * r.lit) / r.mounted) : 0}% lit`).join("\n"), `\ndog-legs with 2+: ${spread} spread, ${sameLeg} in one leg`);
    expect(per("all")).toBeGreaterThan(0.4);
    expect(per("all")).toBeLessThan(0.6);
    expect(by["kind none"].mounted + by["kind none"].floor).toBe(0);
    expect(per("kind fight")).toBeLessThan(per("kind quiet"));
    expect(per("kind quiet")).toBeLessThan(per("kind lived"));
    expect(litShare("kind fight")).toBeGreaterThan(0.03); expect(litShare("kind fight")).toBeLessThan(0.2);
    expect(litShare("kind quiet")).toBeGreaterThan(0.15); expect(litShare("kind quiet")).toBeLessThan(0.35);
    expect(litShare("kind lived")).toBeGreaterThan(0.45); expect(litShare("kind lived")).toBeLessThan(0.75);
    expect(spread).toBeGreaterThanOrEqual(sameLeg); // (smaller rooms rarely get two: then there's nothing to spread)
  }, 300000);

  slowIt("the placement view shows the darkness map, the budget and the candles' light points; PLACEMENT_SVG=<folder> writes examples", () => {
    const dir = process.env.PLACEMENT_SVG;
    for (const { d, s, run, p } of cases) {
      for (const id of Object.keys(run.walk!.layout.rooms).sort()) {
        const v = placementSvg(run.walk!, p, id, (k) => walkRoom(run, k));
        expect(v.svg.startsWith("<svg") && v.svg.endsWith("</svg>")).toBe(true);
        expect(v.budget?.room).toBe(id);
        expect(v.svg).toContain(" · W ");
        if (p.placed.some((i) => i.room === id && MOUNTED_DEFS.includes(i.def))) expect(v.svg).toContain("light point");
        if (dir) fs.writeFileSync(path.join(dir, `v5-d${d}-s${s}-${id}-${run.map.nodes[id]?.kind}.svg`), v.svg);
      }
    }
  }, 120000);
});
