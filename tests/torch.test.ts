import { describe, expect, it } from "vitest";
import { ROCK, FLOOR, type Floorplan } from "../lib/dungeon/floorplan";
import { rollLayout, layoutFloorplan, startProgress, waysOn, isOpen, cutOffY, WALK_SPEC } from "../lib/dungeon/layout";
import { torchLit, torchGlow, shutPlan, rubbleOf, showsRubble, fallenIn, fallenSoFar, tunnelShut, canIgnite, sconceInSight, sconceGlow, TORCH_RADIUS, REMEMBERED, IGNITE_REACH, SCONCE_RADIUS, SCONCE_BRIGHT } from "../lib/dungeon/torch";
import { sideFace, capFade, depthEdges, SIDE_FACE_MAX, CAP_FAINT, FACE_TILE, TOP_TILE, WANG_TILES } from "../lib/dungeon/tileArt";
import { placeSconces } from "../lib/world/compat/v0Placers";

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
// A floorplan from rows of text: # rock, . floor.
function plan(rows: string[]): Floorplan {
  const w = rows[0].length, h = rows.length;
  const tiles = new Uint8Array(w * h);
  rows.forEach((r, y) => [...r].forEach((c, x) => { tiles[y * w + x] = c === "#" ? ROCK : FLOOR; }));
  return { w, h, tiles, rooms: {}, doors: [], tunnels: {} };
}

describe("the torch", () => {
  // A dog-leg: you at the bottom of the left arm, the right arm round the corner.
  const legs = plan([
    "#########",
    "#.......#",
    "#.......#",
    "#..######",
    "#..#.....",
    "#..######",
    "#..#.....",
    "#..######",
  ]);
  it("lights what it reaches, and the wall round it", () => {
    const lit = torchLit(legs, { x: 1, y: 6 });
    expect(lit[6 * legs.w + 1]).toBe(1);
    expect(lit[2 * legs.w + 1]).toBe(1);   // straight up the arm
    expect(lit[6 * legs.w + 0]).toBe(1);   // the wall beside you
    expect(lit[6 * legs.w + 3]).toBe(1);   // the wall on the other side
  });
  it("lights a wall's face up to its top", () => {
    const tall = plan(["#####", "#####", "#####", "#####", "#...#", "#...#"]);
    const lit = torchLit(tall, { x: 2, y: 5 });
    for (let y = 1; y <= 3; y++) expect(lit[y * tall.w + 2]).toBe(1);
    expect(lit[0 * tall.w + 2]).toBe(0);
  });
  it("doesn't see round a corner, or through a wall", () => {
    const lit = torchLit(legs, { x: 1, y: 6 });
    expect(lit[1 * legs.w + 6]).toBe(0);   // round the corner at the top
    expect(lit[6 * legs.w + 5]).toBe(0);   // behind the wall
    const there = torchLit(legs, { x: 2, y: 1 });
    expect(there[1 * legs.w + 6]).toBe(1); // walk to the corner and it's lit
  });
  it("only reaches so far", () => {
    const long = plan(["#" + ".".repeat(20) + "#"]);
    const lit = torchLit(long, { x: 1, y: 0 });
    expect(lit[1 + Math.floor(TORCH_RADIUS)]).toBe(1);
    expect(lit[1 + Math.ceil(TORCH_RADIUS) + 1]).toBe(0);
  });
  it("is brightest at you, remembered dimness at its edge, black where you've never been", () => {
    expect(torchGlow(0, true, true)).toBe(0);
    expect(torchGlow(TORCH_RADIUS / 2, true, true)).toBeLessThan(REMEMBERED);
    expect(torchGlow(TORCH_RADIUS, true, true)).toBeCloseTo(REMEMBERED);
    expect(torchGlow(3, false, true)).toBe(REMEMBERED);
    expect(torchGlow(3, false, false)).toBe(1);
  });
});

describe("tunnels that fall in", () => {
  it("closed tunnels turn to rock, with rubble where you can still see their mouth", () => {
    const fails: string[] = [];
    for (let s = 1; s <= 8; s++) {
      const layout = rollLayout(WALK_SPEC, seeded(s)), fp = layoutFloorplan(layout);
      const start = startProgress(layout);
      if (shutPlan(fp, layout, start) !== fp) fails.push(`${s}: something shut at the start`);
      const up = waysOn(layout, start).find((w) => w.tunnel.up);
      if (!up) continue;
      const p = up.to, shut = shutPlan(fp, layout, p);
      for (const t of layout.tunnels) {
        const rock = fp.tunnels[t.key].every((q) => shut.tiles[q.y * fp.w + q.x] === ROCK);
        if (tunnelShut(layout, p, t) && !rock) fails.push(`${s}: ${t.key} shut but walkable`);
        if (!tunnelShut(layout, p, t) && fp.tunnels[t.key].some((q) => shut.tiles[q.y * fp.w + q.x] === ROCK)) fails.push(`${s}: ${t.key} open but rock`);
      }
      const rubble = rubbleOf(fp, layout, p);
      const behind = rubble.find((r) => r.key === up.tunnel.key);
      if (!behind || behind.room !== p.room || behind.wall !== "bottom" || behind.tiles.length === 0) fails.push(`${s}: no rubble behind you`);
      for (const r of rubble) if (!isOpen(layout, p, r.room)) fails.push(`${s}: rubble in a closed room`);
    }
    expect(fails).toEqual([]);
  });
});

describe("the scroll's red lines", () => {
  it("only the tunnels that fell in behind you, and only if you'd seen them; none deep behind you", () => {
    const fails: string[] = [];
    let checked = 0;
    for (let s = 1; s <= 8; s++) {
      const layout = rollLayout(WALK_SPEC, seeded(s)), fp = layoutFloorplan(layout);
      const all = new Uint8Array(fp.w * fp.h).fill(1), none = new Uint8Array(fp.w * fp.h);
      // Climb as far as the first way up goes, three times.
      let p = startProgress(layout);
      for (let k = 0; k < 3; k++) { const up = waysOn(layout, p).find((w) => w.tunnel.up); if (up) p = up.to; }
      if (fallenIn(fp, layout, p, none).length > 0) fails.push(`${s}: a line where you'd seen nothing`);
      for (const r of fallenIn(fp, layout, p, all)) {
        const t = layout.tunnels.find((u) => u.key === r.key)!;
        checked++;
        if (isOpen(layout, p, t.a) === isOpen(layout, p, t.b)) fails.push(`${s}: ${t.key} lined but not fallen in`);
      }
      // Tunnels with both ends behind you (shut, but nothing you could go back down) aren't lined.
      const deep = layout.tunnels.filter((t) => !isOpen(layout, p, t.a) && !isOpen(layout, p, t.b));
      if (deep.some((t) => fallenIn(fp, layout, p, all).some((r) => r.key === t.key))) fails.push(`${s}: ${deep[0].key} deep behind you lined`);
    }
    expect(fails).toEqual([]);
    expect(checked).toBeGreaterThan(0);
  });
  it("keeps the ones that fell in further down, once you're further up", () => {
    const fails: string[] = [];
    let kept = 0;
    for (let s = 1; s <= 8; s++) {
      const layout = rollLayout(WALK_SPEC, seeded(s)), fp = layoutFloorplan(layout);
      const all = new Uint8Array(fp.w * fp.h).fill(1), none = new Uint8Array(fp.w * fp.h);
      let p = startProgress(layout);
      const cuts: number[] = [], earlier = new Set<string>();
      for (let k = 0; k < 3; k++) {
        const up = waysOn(layout, p).find((w) => w.tunnel.up);
        if (!up) break;
        p = up.to;
        cuts.push(cutOffY(p, layout));
        if (k < 2) for (const r of fallenIn(fp, layout, p, all)) earlier.add(r.key);
      }
      const so = fallenSoFar(fp, layout, p, cuts, all);
      for (const key of earlier) if (!so.includes(key)) fails.push(`${s}: ${key} forgotten`);
      for (const r of fallenIn(fp, layout, p, all)) if (!so.includes(r.key)) fails.push(`${s}: ${r.key} missing now`);
      if (fallenSoFar(fp, layout, p, cuts, none).length > 0) fails.push(`${s}: a line where you'd seen nothing`);
      kept += [...earlier].filter((key) => !fallenIn(fp, layout, p, all).some((r) => r.key === key)).length;
    }
    expect(fails).toEqual([]);
    expect(kept).toBeGreaterThan(0); // (some only show because they're kept)
  });
});

describe("depth", () => {
  it("side faces grow as you go across the room, up to a limit", () => {
    expect(sideFace(-2)).toBe(0);
    expect(sideFace(0)).toBe(0);
    expect(sideFace(3)).toBeGreaterThan(sideFace(1));
    expect(sideFace(100)).toBe(SIDE_FACE_MAX);
  });
  it("south walls go see-through only when you're close", () => {
    expect(capFade(0.5)).toBe(CAP_FAINT);
    expect(capFade(2.2)).toBeGreaterThan(CAP_FAINT);
    expect(capFade(2.2)).toBeLessThan(1);
    expect(capFade(5)).toBe(1);
  });
  it("finds the walls' edges", () => {
    const room = plan(["#####", "#...#", "#...#", "#####"]);
    const e = depthEdges(room);
    expect(e.left.map((q) => q.y)).toEqual([1, 2]);
    expect(e.left.every((q) => q.x === 0)).toBe(true);
    expect(e.right.every((q) => q.x === 4)).toBe(true);
    expect(e.south.map((q) => q.x)).toEqual([1, 2, 3]);
    expect(e.south.every((q) => q.y === 3)).toBe(true);
  });
  it("draws faces and tops with real sheet tiles", () => {
    expect(WANG_TILES[FACE_TILE]).toBeDefined();
    expect(WANG_TILES[TOP_TILE]).toBeDefined();
    expect(FACE_TILE).not.toBe(TOP_TILE);
  });
});

describe("torches on the walls", () => {
  it("every room has one on its top wall, the entrance's lit, never over a tunnel", () => {
    const fails: string[] = [];
    for (let s = 1; s <= 6; s++) {
      const layout = rollLayout(WALK_SPEC, seeded(s)), fp = layoutFloorplan(layout);
      const all = placeSconces(fp, layout.start, seeded(s + 5));
      for (const id of Object.keys(fp.rooms)) if (!all.some((c) => c.room === id)) fails.push(`${s}: none in ${id}`);
      for (const c of all) {
        if (fp.tiles[c.y * fp.w + c.x] === ROCK) fails.push(`${s}: ${c.id} not over a floor`);
        if (fp.tiles[(c.y - 1) * fp.w + c.x] !== ROCK) fails.push(`${s}: ${c.id} over a tunnel`);
        if (c.room === layout.start && !c.lit) fails.push(`${s}: the entrance's unlit`);
      }
      if (all.filter((c) => !c.lit).length < all.length / 2) fails.push(`${s}: most should be unlit`);
    }
    expect(fails).toEqual([]);
  });
  it("lights when you walk close, in sight; then it lights round it", () => {
    const room = plan(["##########", "#........#", "#........#", "#........#", "##########"]);
    const s = { id: "a", room: "a", x: 2, y: 1, lit: false };
    expect(canIgnite(room, s, { x: 2 + Math.floor(IGNITE_REACH), y: 1 })).toBe(true);
    expect(canIgnite(room, s, { x: 2 + Math.ceil(IGNITE_REACH) + 1, y: 1 })).toBe(false);
    expect(canIgnite(room, { ...s, lit: true }, { x: 2, y: 2 })).toBe(false);
    expect(sconceGlow(0)).toBe(SCONCE_BRIGHT);
    expect(sconceGlow(SCONCE_RADIUS + 1)).toBe(1);
    expect(sconceInSight(room, { ...s, lit: true }, { x: 8, y: 3 })).toBe(true);
  });
  it("can't be lit through a wall", () => {
    const two = plan(["#######", "#..#..#", "#..#..#", "#######"]);
    expect(canIgnite(two, { id: "a", room: "a", x: 2, y: 1, lit: false }, { x: 4, y: 1 })).toBe(false);
  });
});

describe("no rubble across (the user, 2026-11-09)", () => {
  it("only a tunnel up's mouth shows rubble; a closed tunnel across is just wall", () => {
    const r = (wall: "top" | "bottom" | "left" | "right") => ({ key: "k", room: "a", tiles: [], wall });
    expect(["top", "bottom", "left", "right"].map((w) => showsRubble(r(w as "top")))).toEqual([true, true, false, false]);
  });
});
