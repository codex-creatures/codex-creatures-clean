// lib/den3d/layout.ts
// 🧪 The Den (the user, 2026-11-18; the only one since 2026-11-24): the Den built as
// the Labyrinth is, a room of floor tiles carved out of rock, drawn by the same 3D renderer under the
// same camera (components/Den3D.tsx; world/rendering.md §4.8), with warmer light. Pure: the plan, where
// everything stands (and where it may be moved to), its lights, who strolls where, how far the camera
// may go, and what a tap lands on.
//
// The shape (the user's drawing, 2026-11-19, "like the Tetris block that's 3 wide with one above in the
// middle"): a wide hall with a narrower nook rising from the middle of its back wall, split down the middle
// by a wall. Room 1 is the left half of each; room 2 (the tavern's room) the right, shut off till Klutz uses
// the Labyrinth Stone on the wall (lib/tavern.ts): then the whole wall moves away. Each nook has a way out
// in the middle of its north wall: room 1's the way into the Labyrinth, room 2's (its mirror) the PvP portal,
// each a dark hole in the rock under its arch (the user, 2026-11-18: "a hole in the wall", not a corridor).
// Tile units, x east, y south, as the Labyrinth's floorplans. Everything faces south, at the camera; things
// against a wall are on north walls, the only ones whose faces show (rendering.md §4.8).

import { FLOOR, ROCK, type Floorplan, type Pt, type Rect } from "../dungeon/floorplan";
import { OBJ, type ObjId } from "./objects";

export const HALL_W = 12;        // floor tiles across each room's half of the hall
export const HALL_D = 15;        // …and down it (the user, 2026-11-19: 4 more rows south, for the bigger pool and pits)
export const NOOK_W = 6;         // floor tiles across each room's half of the nook
export const NOOK_D = 6;         // …and down it
export const DEN_WALL = 3;       // 🧪 u: the Den's rock walls (the Labyrinth's are 2.25): a cavern, so the buildings stand under them
const TOP = 2;                   // rock rows above the nook
export const DIVIDE_X = HALL_W + 1;           // the wall between the rooms
const HALL_Y = TOP + NOOK_D;                  // the hall's first row
// (Three rows of rock below the hall, drawn as the low south rim: rock past the plan's edge stands full
// height, and from the camera it hid the hall's front.)
export const PLAN_W = 1 + HALL_W + 1 + HALL_W + 1;
export const PLAN_H = HALL_Y + HALL_D + 3;
export const ROOM1 = { x: 1, y: HALL_Y, w: HALL_W, h: HALL_D };              // the hall's halves
export const ROOM2 = { x: DIVIDE_X + 1, y: HALL_Y, w: HALL_W, h: HALL_D };
export const NOOK1: Rect = { x: DIVIDE_X - NOOK_W, y: TOP, w: NOOK_W, h: NOOK_D }; // the nook's halves
export const NOOK2: Rect = { x: DIVIDE_X + 1, y: TOP, w: NOOK_W, h: NOOK_D };
export const WALL_GAP = { y0: TOP, y1: HALL_Y + HALL_D }; // the wall between the rooms, all of it (y1 not included)
export const NOOK_N = TOP - 0.5;              // the nook's north wall's face (y)
export const HALL_N = HALL_Y - 0.5;           // the hall's north wall's face, either side of the nook (y)
// The ways out, each in the middle of its room's nook (mirrored about the dividing wall): the tiles under each arch.
const ARCH = [9, 10];                         // room 1's: the Labyrinth
const PORTAL = [16, 17];                      // room 2's: the PvP portal
const mid = (t: number[]) => (t[0] + t[1]) / 2;

// The plan: rock, the halls and nooks; once `opened`, the dividing wall is floor. (The ways out are holes
// drawn on the north wall's face, under their arches: components/Den3DPlaces.tsx.)
// (Its own Floorplan, so the Labyrinth's renderer and light rules read it as is.)
export function denPlan(opened: boolean): Floorplan {
  const tiles = new Uint8Array(PLAN_W * PLAN_H).fill(ROCK);
  const set = (x: number, y: number, t: number) => { tiles[y * PLAN_W + x] = t; };
  for (const r of [ROOM1, ROOM2, NOOK1, NOOK2]) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) set(x, y, FLOOR);
  if (opened) for (let y = WALL_GAP.y0; y < WALL_GAP.y1; y++) set(DIVIDE_X, y, FLOOR);
  return { w: PLAN_W, h: PLAN_H, tiles, rooms: { den: [ROOM1, NOOK1], annex: [ROOM2, NOOK2] }, doors: [], tunnels: {} };
}

// Which tiles show: room 1 (with its walls) always; room 2 only once the wall's gone. (Drawn black till then.)
export function denShown(opened: boolean): Uint8Array {
  const shown = new Uint8Array(PLAN_W * PLAN_H);
  for (let y = 0; y < PLAN_H; y++) for (let x = 0; x < PLAN_W; x++) if (opened || x <= DIVIDE_X) shown[y * PLAN_W + x] = 1;
  return shown;
}

// ── Where things may go (the user, 2026-11-19: hold one, drag it, let go) ──
// Floor things snap to the floor's small tiles (each tile 3 × 3 of them) anywhere on the open floor (the user, 2026-11-19: "more flexibility…
// a huge area you can't move stuff"), clear of the rock, of everything else, of the room in front of doors and
// the ways out, and never boxing anyone in (fitsFloor); the standing torches move too. Wall things snap to slots
// on the north walls: beside each tunnel, in the middle between them (once the wall's gone), and along the hall's
// back wall beside the cabin. Kept in the save (lib/den3d/placement.ts); anything missing stands where it starts.
export type LampKey = "lamp-1" | "lamp-2" | "lamp-3" | "lamp-4" | "lamp-5";
export type FloorKey = "altar" | "pool" | "pit" | "training" | LampKey;
export type WallKey = "board" | "bookcase" | "cage";
export type SlotId = "hall-1" | "hall-2" | "nook-1" | "nook-mid" | "nook-2";
export type DenLayout = { floor?: Partial<Record<FloorKey, Pt>>; wall?: Partial<Record<WallKey, SlotId>> };
export const LAMP_KEYS: LampKey[] = ["lamp-1", "lamp-2", "lamp-3", "lamp-4", "lamp-5"];
export const FLOOR_KEYS: FloorKey[] = ["altar", "pool", "pit", "training", ...LAMP_KEYS];
export const isLamp = (k: string): k is LampKey => k.startsWith("lamp-");
export const WALL_KEYS: WallKey[] = ["board", "bookcase", "cage"];
export const SNAP = 1 / 3;                    // u: the floor grid, its small tiles (the user, 2026-11-20; was 0.5)
// (The standing torches start where the Den was darkest: along the walls and the south end.)
export const FLOOR_START: Record<FloorKey, Pt> = { altar: { x: 8, y: 12.5 }, pool: { x: 6.4, y: 20 }, pit: { x: 10.5, y: 17.2 }, training: { x: 18.5, y: 16.5 },
  "lamp-1": { x: 3.4, y: 21.4 }, "lamp-2": { x: 11.6, y: 21.8 }, "lamp-3": { x: 14.6, y: 21.8 }, "lamp-4": { x: 24.4, y: 13.6 }, "lamp-5": { x: 24.4, y: 20.6 } };
export const WALL_START: Record<WallKey, SlotId> = { board: "hall-1", bookcase: "hall-2", cage: "nook-1" };
// A wall slot: where along which face (x, the face's y), and how wide a thing it takes.
export type Slot = { id: SlotId; x: number; face: number; wide: number; opened?: boolean };
export const SLOTS: Slot[] = [
  { id: "hall-1", x: 4.5, face: HALL_N, wide: 1.4 },
  { id: "hall-2", x: 5.85, face: HALL_N, wide: 1.35 },
  { id: "nook-1", x: 7.4, face: NOOK_N, wide: 1.5 },
  { id: "nook-mid", x: DIVIDE_X, face: NOOK_N, wide: 2.5, opened: true },
  { id: "nook-2", x: 18.6, face: NOOK_N, wide: 1.5, opened: true },
];
// Each movable thing's size (u), and how far a wall thing stands out from its wall (0: hung on it).
// (The user, 2026-11-19: the altar 0.6 the size, the pool big and swampy, the Sparring/Training Pit twice the size.)
export const FLOOR_SIZE: Record<FloorKey, { w: number; d: number }> = { altar: { w: 1.6, d: 1.5 }, pool: { w: 3.8, d: 2.6 }, pit: { w: 2.6, d: 2.8 }, training: { w: 5.2, d: 5.2 },
  ...(Object.fromEntries(LAMP_KEYS.map((k) => [k, { w: 0.5, d: 0.5 }])) as Record<LampKey, { w: number; d: number }>) };
// A standing torch's foot: one small tile, and it may stand right up against anything (the user, 2026-11-20: "they can be next
// to other units - so you can customize the lighting"), the rock included; only the gap between other things is kept.
export const LAMP_FOOT = 1 / 3;
const WALL_SIZE: Record<WallKey, { w: number; d: number; out: number }> = { board: { w: 1.35, d: 0.2, out: 0 }, bookcase: { w: 1.25, d: 0.5, out: 0.25 }, cage: { w: 1.05, d: 1.05, out: 0.55 } };
// How far a floor thing keeps from the rock (u), and the room kept clear in front of a door or a way out.
export const FLOOR_MARGIN = 0.35;
export const DOOR_CLEAR = { building: 0.8, way: 1.6, board: 0.7 };
// The odds and ends along the west wall below the storehouse (barrels, crates, pots): nothing goes on them.
export const DECOR: { kind: "barrels" | "crates" | "pots"; at: Pt }[] = [
  { kind: "barrels", at: { x: 1.1, y: 17.7 } }, { kind: "crates", at: { x: 1.1, y: 18.9 } }, { kind: "pots", at: { x: 1.1, y: 20.1 } }];
// The braziers stand either side of the altar's front, and of the pit in the tavern's room: they move with them.
export const BRAZIER_AT: Record<"altar" | "training", { dx: number; dy: number }> = { altar: { dx: 1.15, dy: 1 }, training: { dx: 2.9, dy: 2.1 } };
// The gap kept between things: two of the floor's small tiles (the user, 2026-11-20), half of it round each.
// (Torches keep none: LAMP_FOOT.)
export const GAP = 2 / 3;
const KEEP = GAP / 2;
// (The gap before, 0.6: what was put down with it still loads where it was, placed.)
const OLD_KEEP = 0.3;
// The floor a thing stands on (its footprint, with its braziers), and what it keeps to itself (that and KEEP round it).
export function footBox(key: FloorKey, at: Pt): Box {
  if (isLamp(key)) return { x0: at.x - LAMP_FOOT / 2, x1: at.x + LAMP_FOOT / 2, y0: at.y - LAMP_FOOT / 2, y1: at.y + LAMP_FOOT / 2 };
  const s = FLOOR_SIZE[key], fire = key === "altar" || key === "training" ? BRAZIER_AT[key] : null;
  const hw = Math.max(s.w / 2, fire ? fire.dx + 0.2 : 0), below = Math.max(s.d / 2, fire ? fire.dy + 0.2 : 0);
  return { x0: at.x - hw, x1: at.x + hw, y0: at.y - s.d / 2, y1: at.y + below };
}
export function keptBox(key: FloorKey, at: Pt, keep = KEEP): Box {
  const b = footBox(key, at), k = isLamp(key) ? 0 : keep;
  return { x0: b.x0 - k, x1: b.x1 + k, y0: b.y0 - k, y1: b.y1 + k };
}
// (On the grid's small tiles, tidied so a third doesn't save as 6.333333333333334.)
export const snap = (v: number) => Math.round(Math.round(v / SNAP) * SNAP * 1000) / 1000;

// Where everything movable stands, from the saved layout (what's missing, or no longer fits, at its start).
export type Placed = { floor: Record<FloorKey, Pt>; wall: Record<WallKey, SlotId> };
export function placed(layout: DenLayout | undefined, opened: boolean): Placed {
  const floor = { ...FLOOR_START }, wall = { ...WALL_START };
  for (const k of WALL_KEYS) { const id = layout?.wall?.[k]; const s = SLOTS.find((q) => q.id === id); if (s && (opened || !s.opened) && fitsWall(k, s.id, opened)) wall[k] = s.id; }
  // (Two wall things saved in one slot: the later one back to its start.)
  WALL_KEYS.forEach((k, i) => { if (WALL_KEYS.slice(0, i).some((o) => wall[o] === wall[k])) wall[k] = WALL_START[k]; });
  // (A floor thing saved somewhere it can't stand now: back to its start.)
  for (const k of FLOOR_KEYS) {
    const p = layout?.floor?.[k];
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y) && floorFitter(k, { floor, wall }, opened, OLD_KEEP)(p)) floor[k] = { x: p.x, y: p.y };
  }
  return { floor, wall };
}
// Can floor thing `key` stand at `at`? On open floor (room 1's only till the wall's gone), FLOOR_MARGIN clear of the
// rock; clear of everything else, and of the room in front of doors and the ways out; and with every place still
// reachable from the Labyrinth's tunnel, so nothing can be boxed in (why fully free placement was ruled out,
// 2026-11-18). The tavern's room's pit only in its own half: it's the tavern's.
export type Box = { x0: number; x1: number; y0: number; y1: number };
// (Touching is fine: thirds never add up exactly in floating point, hence the hair.)
const E = 1e-6;
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 - E && b.x0 < a.x1 - E && a.y0 < b.y1 - E && b.y0 < a.y1 - E;
// (Something in room 2 before the wall's gone isn't there yet.)
const absent = (k: FloorKey, p: Placed, opened: boolean) => !opened && p.floor[k].x > DIVIDE_X;
const stateFor = (opened: boolean): DenState => ({ opened, pit: opened, trainingPit: false, repaired: false });
export function fitsFloor(key: FloorKey, at: Pt, p: Placed, opened: boolean): boolean {
  return floorFitter(key, p, opened)(at);
}
// The same question for many spots at once (fitMap, while a thing's being dragged): everything that doesn't depend on
// where the thing goes is worked out once (the others, the places that don't move, the walking grid round them), so
// each spot costs only its own checks and one walk over the grid.
export function floorFitter(key: FloorKey, p: Placed, opened: boolean, keep = KEEP): (at: Pt) => boolean {
  const s = FLOOR_SIZE[key], plan = denPlan(opened), shown = denShown(opened), state = stateFor(opened);
  // (A torch keeps no gap: one being moved, or one already standing, is checked foot to foot; anything else keeps GAP.)
  const lamp = isLamp(key), pad = lamp ? 0 : keep;
  const others = FLOOR_KEYS.filter((k) => k !== key && !absent(k, p, opened)).map((k) => {
    const bare = lamp || isLamp(k);
    return { bare, box: bare ? footBox(k, p.floor[k]) : keptBox(k, p.floor[k], keep) };
  });
  const decor = DECOR.map((d) => ({ x0: d.at.x - 0.6 + KEEP - pad, x1: d.at.x + 0.6 - KEEP + pad, y0: d.at.y - 0.6 + KEEP - pad, y1: d.at.y + 0.6 - KEEP + pad }));
  const rest = stations(state, p).filter((st) => st.key !== key);
  const fixed = rest.filter((st) => !st.move || st.move === "wall").map((st) => keepClear(st, pad));
  const firesOf = (k: FloorKey, c: Pt): Pt[] => k === "altar" ? [-1, 1].map((d) => ({ x: c.x + d * BRAZIER_AT.altar.dx, y: c.y + BRAZIER_AT.altar.dy }))
    : k === "training" ? (opened ? [-1, 1].map((d) => ({ x: c.x + d * BRAZIER_AT.training.dx, y: c.y + BRAZIER_AT.training.dy })) : [])
    : isLamp(k) ? (opened || c.x < DIVIDE_X ? [c] : []) : [];
  const otherFires = FLOOR_KEYS.filter((k) => k !== key).flatMap((k) => firesOf(k, p.floor[k]));
  // The walking grid with everything but this thing on it, and where each other place must be reached from.
  const W = Math.ceil(PLAN_W / CELL), H = Math.ceil(PLAN_H / CELL);
  const cx = (i: number) => (i % W) * CELL - 0.5 + CELL / 2, cy = (i: number) => Math.floor(i / W) * CELL - 0.5 + CELL / 2;
  const cell = (x: number, y: number) => Math.floor((y + 0.5) / CELL) * W + Math.floor((x + 0.5) / CELL);
  const still = strollBlocked(plan, shown, rest, otherFires), base = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) base[i] = still(cx(i), cy(i)) ? 1 : 0;
  const start = cell(mid(ARCH), NOOK_N + 1), out = 0.65;
  const sides = (st: { x: number; y: number; w: number; d: number }): Pt[] =>
    [{ x: st.x, y: st.y + st.d / 2 + out }, { x: st.x, y: st.y - st.d / 2 - out }, { x: st.x - st.w / 2 - out, y: st.y }, { x: st.x + st.w / 2 + out, y: st.y }];
  const targets: Pt[][] = rest.filter((st) => !isLamp(st.key) && st.key !== "arch").map((st) =>
    st.wall || st.key === "bookcase" || st.key === "cage" || st.key === "shack" || st.key === "tavern" ? [{ x: st.x, y: st.y + st.d / 2 + out }]
      : st.turn === "east" ? [{ x: st.x + st.w / 2 + out, y: st.y }] : sides(st));
  const seen = new Uint8Array(W * H), q = new Int32Array(W * H);
  return (at) => {
    const hw = lamp ? LAMP_FOOT / 2 : s.w / 2 + FLOOR_MARGIN, hd = lamp ? LAMP_FOOT / 2 : s.d / 2 + FLOOR_MARGIN;
    const x0 = at.x - hw, x1 = at.x + hw, y0 = at.y - hd, y1 = at.y + hd;
    const nx = Math.ceil((x1 - x0) / 0.25), ny = Math.ceil((y1 - y0) / 0.25);
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const tx = Math.round(x0 + ((x1 - x0) * i) / nx), ty = Math.round(y0 + ((y1 - y0) * j) / ny);
      if (tx < 0 || ty < 0 || tx >= plan.w || ty >= plan.h || plan.tiles[ty * plan.w + tx] !== FLOOR || (!opened && tx >= DIVIDE_X)) return false;
    }
    if (key === "training" && at.x - s.w / 2 < DIVIDE_X + 0.5) return false;
    const mine = keptBox(key, at, keep), foot0 = footBox(key, at);
    if (others.some((o) => overlaps(o.bare ? foot0 : mine, o.box)) || decor.some((o) => overlaps(mine, o)) || fixed.some((o) => overlaps(mine, o))) return false;
    // Walk the grid from the Labyrinth's tunnel with this thing (and its fires) where it would stand.
    const fires = firesOf(key, at), foot = { x0: at.x - s.w / 2 - 0.3, x1: at.x + s.w / 2 + 0.3, y0: at.y - s.d / 2 - 0.3, y1: at.y + s.d / 2 + 0.3 };
    const hasStation = !isLamp(key) || opened || at.x < DIVIDE_X;
    const free = (i: number) => {
      if (base[i]) return false;
      const x = cx(i), y = cy(i);
      if (hasStation && x > foot.x0 && x < foot.x1 && y > foot.y0 && y < foot.y1) return false;
      return !fires.some((f) => Math.hypot(f.x - x, f.y - y) < 0.45);
    };
    seen.fill(0);
    if (!free(start)) return false;
    let n = 0; q[n++] = start; seen[start] = 1;
    for (let h = 0; h < n; h++) {
      const i = q[h], x = i % W, y = Math.floor(i / W);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ix = x + dx, iy = y + dy, j = iy * W + ix;
        if (ix < 0 || iy < 0 || ix >= W || iy >= H || seen[j] || !free(j)) continue;
        seen[j] = 1; q[n++] = j;
      }
    }
    const near = (pt: Pt) => [[0, 0], [CELL, 0], [-CELL, 0], [0, CELL], [0, -CELL]].some(([dx, dy]) => {
      const x = pt.x + dx, y = pt.y + dy;
      return x > -0.5 && y > -0.5 && x < PLAN_W - 0.5 && y < PLAN_H - 0.5 && seen[cell(x, y)] === 1;
    });
    if (!targets.every((t) => t.some(near))) return false;
    return isLamp(key) || sides({ x: at.x, y: at.y, w: s.w, d: s.d }).some(near);
  };
}
// Where a floor thing could go, for showing while it's dragged (the user, 2026-11-19): every snap spot for its middle
// on the shown floor, 2 where it fits, 1 where it doesn't, 0 off the floor (rock, or room 2 before the wall's gone).
// Spot (i, j) is at (i, j) × SNAP.
export type FitMap = { w: number; h: number; at: Uint8Array };
export function fitMap(key: FloorKey, p: Placed, opened: boolean): FitMap {
  const m = fitMapper(key, p, opened);
  while (!m.next(Infinity));
  return m.map;
}
// The map a few rows at a time (`next(rows)`, true once it's all done), so working it out never stalls a drag.
export function fitMapper(key: FloorKey, p: Placed, opened: boolean): { map: FitMap; next: (rows: number) => boolean } {
  const fits = floorFitter(key, p, opened), plan = denPlan(opened), shown = denShown(opened);
  const w = Math.round((PLAN_W - 1) / SNAP) + 1, h = Math.round((PLAN_H - 1) / SNAP) + 1, map = { w, h, at: new Uint8Array(w * h) };
  let j = 0;
  return { map, next: (rows) => {
    for (const end = Math.min(h, j + rows); j < end; j++) for (let i = 0; i < w; i++) {
      const x = i * SNAP, y = j * SNAP, t = Math.round(y) * plan.w + Math.round(x);
      if (plan.tiles[t] === FLOOR && shown[t]) map.at[j * w + i] = fits({ x, y }) ? 2 : 1;
    }
    return j >= h;
  } };
}
// The floor a place that doesn't move keeps to itself: its footprint, and the room in front of its door or way out.
function keepClear(st: Station, keep = KEEP): Box {
  const b = { x0: st.x - st.w / 2 - keep, x1: st.x + st.w / 2 + keep, y0: st.y - st.d / 2 - keep, y1: st.y + st.d / 2 + keep };
  if (st.key === "arch" || st.key === "portal") return { ...b, y1: st.y + DOOR_CLEAR.way };
  if (st.key === "board") return { ...b, y1: st.y + DOOR_CLEAR.board };
  if (st.turn === "east") return { ...b, x1: b.x1 + DOOR_CLEAR.building };
  if (st.key === "shack" || st.key === "tavern") return { ...b, y1: b.y1 + DOOR_CLEAR.building };
  return b;
}
// Can someone walk from the Labyrinth's tunnel to every place: to the front of a building, a wall thing or a way out,
// to any side of the rest? On the strollers' grid, round whatever stands in the way (strollBlocked).
export function allReachable(list: Station[], p: Placed, opened: boolean): boolean {
  const plan = denPlan(opened), blocked = strollBlocked(plan, denShown(opened), list, braziers(p, stateFor(opened)));
  const W = Math.ceil(PLAN_W / CELL), H = Math.ceil(PLAN_H / CELL);
  const cell = (x: number, y: number) => Math.floor((y + 0.5) / CELL) * W + Math.floor((x + 0.5) / CELL);
  const free = (i: number) => !blocked((i % W) * CELL - 0.5 + CELL / 2, Math.floor(i / W) * CELL - 0.5 + CELL / 2);
  const seen = new Uint8Array(W * H), q = [cell(mid(ARCH), NOOK_N + 1)];
  if (!free(q[0])) return false;
  seen[q[0]] = 1;
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % W, y = Math.floor(i / W);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, j = ny * W + nx;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[j] || !free(j)) continue;
      seen[j] = 1; q.push(j);
    }
  }
  const near = (pt: Pt) => [[0, 0], [CELL, 0], [-CELL, 0], [0, CELL], [0, -CELL]].some(([dx, dy]) => {
    const x = pt.x + dx, y = pt.y + dy;
    return x > -0.5 && y > -0.5 && x < PLAN_W - 0.5 && y < PLAN_H - 0.5 && seen[cell(x, y)] === 1;
  });
  const out = 0.65;
  return list.every((st) => {
    if (isLamp(st.key) || st.key === "arch") return true;
    if (st.wall || st.key === "bookcase" || st.key === "cage" || st.key === "shack" || st.key === "tavern") return near({ x: st.x, y: st.y + st.d / 2 + out });
    if (st.turn === "east") return near({ x: st.x + st.w / 2 + out, y: st.y });
    return [{ x: st.x, y: st.y + st.d / 2 + out }, { x: st.x, y: st.y - st.d / 2 - out }, { x: st.x - st.w / 2 - out, y: st.y }, { x: st.x + st.w / 2 + out, y: st.y }].some(near);
  });
}
// Can wall thing `key` hang in (or stand against) slot `id`? It must fit, and the slot be open; a slot
// another wall thing holds swaps them (placeWall).
export function fitsWall(key: WallKey, id: SlotId, opened: boolean): boolean {
  const s = SLOTS.find((q) => q.id === id);
  return !!s && (opened || !s.opened) && WALL_SIZE[key].w <= s.wide + 0.001;
}
// The floor a wall thing takes in slot `id` (shown while it's moved, as footBox for floor things).
export function wallFoot(key: WallKey, id: SlotId): Box {
  const slot = SLOTS.find((q) => q.id === id)!, z = WALL_SIZE[key], y = z.out ? slot.face + z.out : slot.face;
  return { x0: slot.x - z.w / 2, x1: slot.x + z.w / 2, y0: y - z.d / 2, y1: y + z.d / 2 };
}
export function placeWall(p: Placed, key: WallKey, id: SlotId): Placed {
  const wall = { ...p.wall }, other = WALL_KEYS.find((k) => k !== key && wall[k] === id);
  if (other) wall[other] = wall[key];
  wall[key] = id;
  return { ...p, wall };
}
// The wall slot nearest a spot on the floor (for a wall thing being dragged).
export function nearestSlot(p: Pt, opened: boolean): Slot {
  return SLOTS.filter((s) => opened || !s.opened).sort((a, b) => Math.hypot(a.x - p.x, a.face - p.y) - Math.hypot(b.x - p.x, b.face - p.y))[0];
}
// As saved: only what's been moved from its start.
export function toLayout(p: Placed): DenLayout {
  const floor: NonNullable<DenLayout["floor"]> = {}, wall: NonNullable<DenLayout["wall"]> = {};
  for (const k of FLOOR_KEYS) if (p.floor[k].x !== FLOOR_START[k].x || p.floor[k].y !== FLOOR_START[k].y) floor[k] = p.floor[k];
  for (const k of WALL_KEYS) if (p.wall[k] !== WALL_START[k]) wall[k] = p.wall[k];
  return { floor, wall };
}

// ── What stands where ──
// A station: something you tap to go somewhere. (x, y) is its footprint's middle, w × d its footprint
// (u), `tall` how high it stands (taps and its label go by it). `wall`: hung on a north wall, its back
// against the face. `turn`: a building turned to face east, along the west wall. `move`: it can be picked
// up and moved. `obj`: the old Den's id for it, so Klutz's tour finds it ("den-<id>").
export type StationKey = "shack" | "bookcase" | "arch" | "board" | "cage" | "lectern" | "storehouse" | "altar" | "pool" | "pit"
  | "rubble" | "portal" | "tavern" | "training" | LampKey;
export type Station = { key: StationKey; obj?: Exclude<ObjId, 0>; label: string; href?: string; x: number; y: number; w: number; d: number; tall: number;
  wall?: boolean; turn?: "east"; move?: "floor" | "wall"; room: 1 | 2; quiet?: boolean }; // (quiet: no name over it)

// The Den's stations, room 1's then room 2's (the tavern's room only once the wall's gone; its pit only once
// the tavern has its pit, as the old room had: lib/trainingPit.ts hasPit). Room 1: the shack in the hall's
// top-left corner, the storehouse along the west wall, the Bestiary in the nook, the Labyrinth's tunnel, and
// what you can move. Room 2: the tavern in the hall's top-right corner and the PvP portal's tunnel.
export type DenState = { opened: boolean; pit: boolean; trainingPit: boolean; repaired: boolean; shack?: boolean; altarBroken?: boolean }; // shack, altarBroken: not yet repaired / mended (their looks only)
export function stations(s: DenState, p: Placed = placed(undefined, s.opened)): Station[] {
  const back = (face: number, d: number) => face + d / 2; // a thing standing against a north wall: its y
  const floorAt = (k: FloorKey) => ({ ...p.floor[k], ...FLOOR_SIZE[k], room: (p.floor[k].x < DIVIDE_X ? 1 : 2) as 1 | 2 });
  const wallAt = (k: WallKey) => {
    const slot = SLOTS.find((q) => q.id === p.wall[k])!, z = WALL_SIZE[k];
    return { x: slot.x, y: z.out ? slot.face + z.out : slot.face, w: z.w, d: z.d, room: (slot.x < DIVIDE_X ? 1 : 2) as 1 | 2 };
  };
  const out: Station[] = [
    { key: "shack", obj: OBJ.crate, label: "Klutz's Cabin", href: "/klutz", x: 2.15, y: back(HALL_N, 2.7), w: 3.25, d: 2.7, tall: 3, room: 1 },
    { key: "storehouse", obj: OBJ.chest, label: "Storehouse", href: "/chest?store=1", x: 2.05, y: 15.2, w: 3.1, d: 3.45, tall: 3, turn: "east", room: 1 },
    { key: "arch", obj: OBJ.arch, label: "The Labyrinth", href: "/dungeon", x: mid(ARCH), y: NOOK_N, w: 2.9, d: 0.2, tall: 3, wall: true, room: 1 },
    { key: "lectern", obj: OBJ.scroll, label: "Bestiary", href: "/guide", x: 11.6, y: 4.6, w: 0.8, d: 0.6, tall: 1.3, room: 1 },
    { key: "board", obj: OBJ.quests, label: "Quest Board", href: "/board", ...wallAt("board"), tall: 2.45, wall: true, move: "wall" },
    { key: "bookcase", obj: OBJ.bookcase, label: "Bookcase", href: "/bookcase", ...wallAt("bookcase"), tall: 2, move: "wall" },
    { key: "cage", obj: OBJ.cage, label: "Cage", href: "/cage", ...wallAt("cage"), tall: 1.6, move: "wall" },
    { key: "altar", obj: OBJ.altar, label: "Soul Altar", href: "/altar", ...floorAt("altar"), tall: 1.45, move: "floor" },
    { key: "pool", obj: OBJ.pool, label: "Healing Pool", href: "/pool", ...floorAt("pool"), tall: 0.7, move: "floor" },
    { key: "pit", obj: OBJ.pit, label: "The Pit", href: "/pit", ...floorAt("pit"), tall: 0.6, move: "floor" },
  ];
  // The standing torches: picked up and moved like the rest; tapping one goes nowhere. (Room 2's once the wall's gone.)
  for (const k of LAMP_KEYS) if (s.opened || p.floor[k].x < DIVIDE_X) out.push({ key: k, label: "Torch", ...floorAt(k), tall: 1.2, move: "floor", quiet: true });
  // The wall's stone socket, where Klutz uses the Labyrinth Stone (in the old Den's rubble's place: its tour id).
  if (!s.opened) out.push({ key: "rubble", obj: OBJ.tavern, label: "Old wall", x: DIVIDE_X - 1, y: 14.6, w: 1, d: 1, tall: 1.4, room: 1 });
  else {
    out.push({ key: "tavern", label: s.repaired ? "Tavern" : "Broken tavern", href: "/tavern", x: 23, y: back(HALL_N, 3.1), w: 4.85, d: 3.1, tall: 3.1, room: 2 });
    if (s.pit) out.push(
      { key: "portal", label: "PvP Portal", href: "/pvp", x: mid(PORTAL), y: NOOK_N, w: 2.9, d: 0.2, tall: 3, wall: true, room: 2 },
      { key: "training", label: s.trainingPit ? "Training Pit" : "Sparring Pit", href: "/training", ...floorAt("training"), tall: 0.6, move: "floor" },
    );
  }
  return out;
}

// ── Light ──
// The Den's lights: torches on the nook's north wall (and by the tavern), the light on each tunnel's arch,
// the braziers (with the altar, and the tavern room's pit), lanterns by the shack's and storehouse's doors and
// the board, the altar's soul fire and the tavern's windows. Tile units and reach in tiles (stone.ts Light3D).
// (The user, 2026-11-20: "too many dark spots": every reach up, torch 5.5 → 6.5, brazier 4.5 → 5, lantern 3.5 → 4.5, lamp 4.5 → 6,
// pool 3 → 3.5; with the ambient up in Den3D's DEN_STONE.)
export const DEN_LIGHT = { torch: 6.5, brazier: 5, altar: 4, tavern: 5, lantern: 4.5, lamp: 6, pool: 3.5 }; // 🧪 reaches
// The standing torches (the user, 2026-11-19: "a higher ambient light with additional lighting in certain areas"; they
// can be moved, LAMP_KEYS): where each stands now (room 2's only once the wall's gone).
export const lampsAt = (p: Placed, opened: boolean): Pt[] => LAMP_KEYS.map((k) => p.floor[k]).filter((l) => opened || l.x < DIVIDE_X);
export const SCONCES: Pt[] = [{ x: 12.2, y: NOOK_N }, { x: 13.8, y: NOOK_N }, { x: 20, y: HALL_N }];
export const ARCH_LIGHTS: Pt[] = [{ x: mid(ARCH) - 1.2, y: NOOK_N }, { x: mid(ARCH) + 1.2, y: NOOK_N }];
export const PORTAL_LIGHTS: Pt[] = [{ x: mid(PORTAL) - 1.2, y: NOOK_N }, { x: mid(PORTAL) + 1.2, y: NOOK_N }];
const LANTERNS: Pt[] = [{ x: 2.6, y: 10.6 }, { x: 3.9, y: 15.2 }, { x: 5.2, y: 8.4 }]; // (the shack's and storehouse's doors, the board)
export function braziers(p: Placed, s: DenState): Pt[] {
  const by = (c: Pt, f: { dx: number; dy: number }) => [-1, 1].map((k) => ({ x: c.x + k * f.dx, y: c.y + f.dy }));
  return [...by(p.floor.altar, BRAZIER_AT.altar), ...(s.opened && s.pit ? by(p.floor.training, BRAZIER_AT.training) : []), ...lampsAt(p, s.opened)];
}
export function denLights(s: DenState, p: Placed = placed(undefined, s.opened)): { x: number; y: number; r: number }[] {
  const inRoom = (q: Pt) => s.opened || q.x < DIVIDE_X;
  return [
    ...[...SCONCES, ...ARCH_LIGHTS, ...PORTAL_LIGHTS].filter(inRoom).map((q) => ({ x: q.x, y: q.y + 0.6, r: DEN_LIGHT.torch })),
    ...braziers(p, s).map((q) => ({ ...q, r: lampsAt(p, s.opened).includes(q) ? DEN_LIGHT.lamp : DEN_LIGHT.brazier })),
    { ...p.floor.pool, r: DEN_LIGHT.pool }, // (the healing water's own glow)
    ...LANTERNS.map((q) => ({ ...q, r: DEN_LIGHT.lantern })),
    { ...p.floor.altar, r: DEN_LIGHT.altar },
    ...(s.opened && s.repaired ? [{ x: 23, y: 11, r: DEN_LIGHT.tavern }] : []),
  ];
}

// Where light may fall (the Labyrinth's `lightNow`): every open tile that shows.
export function denLit(plan: Floorplan, shown: Uint8Array): Uint8Array {
  return Uint8Array.from(plan.tiles, (t, i) => (t !== ROCK && shown[i] ? 1 : 0));
}

// ── Who strolls where ──
// Klutz round room 1 when he's home (up into the nook and back), and visitors round the whole Den, each going
// from spot to spot along a loop; between spots they find their way round whatever stands in the way
// (routeLoop), so moving things never leaves anyone walking through them.
export const KLUTZ_LOOP: Pt[] = [{ x: 4.5, y: 10.8 }, { x: 9.5, y: 9.4 }, { x: 8.8, y: 4.6 }, { x: 11.5, y: 10.2 }, { x: 11.6, y: 21.2 }, { x: 5.5, y: 21.9 }, { x: 4.9, y: 16.4 }];
export const VISITOR_LOOP: Pt[] = [{ x: 15, y: 11 }, { x: 16.5, y: 4.6 }, { x: 19, y: 10.8 }, { x: 23.5, y: 15.5 }, { x: 22.5, y: 21.5 }, { x: 13, y: 21.5 },
  { x: 5.5, y: 21.9 }, { x: 4.9, y: 16.4 }, { x: 4.5, y: 10.8 }, { x: 9.5, y: 9.4 }, { x: 13, y: 5 }];
export const STROLL = { klutz: 0.55, visitor: 0.45, pause: 3 }; // u a second; s stopped at each spot
const CELL = 0.5;                                               // u: the grid they find their way on

// A loop of spots turned into a walk: each leg the shortest way round what's `blocked` (on a half-unit grid,
// then straightened wherever the way's clear), stopping at each spot. A spot that's blocked moves to the
// nearest clear cell; a leg with no way through is skipped.
export type Route = { pts: Pt[]; stop: boolean[] };
export function routeLoop(spots: Pt[], blocked: (x: number, y: number) => boolean): Route {
  const W = Math.ceil(PLAN_W / CELL), H = Math.ceil(PLAN_H / CELL);
  const at = (i: number) => ({ x: (i % W) * CELL - 0.5 + CELL / 2, y: Math.floor(i / W) * CELL - 0.5 + CELL / 2 });
  const free = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) { const c = at(i); free[i] = blocked(c.x, c.y) ? 0 : 1; }
  const cellOf = (p: Pt) => Math.min(H - 1, Math.max(0, Math.floor((p.y + 0.5) / CELL))) * W + Math.min(W - 1, Math.max(0, Math.floor((p.x + 0.5) / CELL)));
  const nearestFree = (i: number) => {
    if (free[i]) return i;
    let best = -1, bd = Infinity;
    for (let j = 0; j < W * H; j++) if (free[j]) { const a = at(i), b = at(j), d = Math.hypot(a.x - b.x, a.y - b.y); if (d < bd) { bd = d; best = j; } }
    return best;
  };
  const clear = (a: Pt, b: Pt) => {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.05);
    for (let k = 0; k <= n; k++) if (blocked(a.x + ((b.x - a.x) * k) / n, a.y + ((b.y - a.y) * k) / n)) return false;
    return true;
  };
  const path = (s: number, e: number): Pt[] | null => {
    const prev = new Int32Array(W * H).fill(-1); prev[s] = s;
    const q = [s];
    for (let h = 0; h < q.length && prev[e] < 0; h++) {
      const i = q[h], x = i % W, y = Math.floor(i / W);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, j = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || !free[j] || prev[j] >= 0) continue;
        prev[j] = i; q.push(j);
      }
    }
    if (prev[e] < 0) return null;
    const cells: Pt[] = [];
    for (let i = e; i !== s; i = prev[i]) cells.push(at(i));
    cells.push(at(s));
    cells.reverse();
    // Straightened: from each point, the furthest one along still in a clear line.
    const out = [cells[0]];
    for (let i = 0; i < cells.length - 1;) {
      let j = cells.length - 1;
      while (j > i + 1 && !clear(cells[i], cells[j])) j--;
      out.push(cells[j]); i = j;
    }
    return out;
  };
  const ends = spots.map((p) => nearestFree(cellOf(p))).filter((i) => i >= 0);
  const pts: Pt[] = [], stop: boolean[] = [];
  ends.forEach((s, k) => {
    const leg = path(s, ends[(k + 1) % ends.length]);
    if (!leg) return;
    leg.slice(0, -1).forEach((q, i) => { pts.push(q); stop.push(i === 0); });
  });
  return pts.length ? { pts, stop } : { pts: [at(ends[0] ?? 0)], stop: [true] };
}
// What strollers keep clear of: rock and what hasn't shown yet, every station's footprint and the braziers.
export function strollBlocked(plan: Floorplan, shown: Uint8Array, list: Station[], fires: Pt[]): (x: number, y: number) => boolean {
  return (x, y) => {
    const tx = Math.round(x), ty = Math.round(y);
    if (tx < 0 || ty < 0 || tx >= plan.w || ty >= plan.h || plan.tiles[ty * plan.w + tx] !== FLOOR || !shown[ty * plan.w + tx]) return true;
    if (fires.some((f) => Math.hypot(f.x - x, f.y - y) < 0.45)) return true;
    return list.some((s) => !s.wall && x > s.x - s.w / 2 - 0.3 && x < s.x + s.w / 2 + 0.3 && y > s.y - s.d / 2 - 0.3 && y < s.y + s.d / 2 + 0.3);
  };
}

// Where a stroller is `t` seconds along its route (looping): x, y, which way it faces (radians, 0 east, as the
// Labyrinth's people), moving or stopped (`pause` seconds at each spot of the loop).
export function strollAt(t: number, r: Route, speed: number, pause = STROLL.pause): { x: number; y: number; facing: number; moving: boolean } {
  const n = r.pts.length;
  const legs = r.pts.map((p, i) => { const q = r.pts[(i + 1) % n]; return { p, q, wait: r.stop[i] ? pause : 0, time: Math.hypot(q.x - p.x, q.y - p.y) / speed }; });
  const total = legs.reduce((s, l) => s + l.time + l.wait, 0) || 1;
  let left = ((t % total) + total) % total;
  for (const l of legs) {
    const facing = Math.atan2(l.q.y - l.p.y, l.q.x - l.p.x);
    if (left < l.wait) return { x: l.p.x, y: l.p.y, facing, moving: false };
    left -= l.wait;
    if (left < l.time) { const k = left / l.time; return { x: l.p.x + (l.q.x - l.p.x) * k, y: l.p.y + (l.q.y - l.p.y) * k, facing, moving: true }; }
    left -= l.time;
  }
  return { x: r.pts[0].x, y: r.pts[0].y, facing: 0, moving: false };
}
export const routeTime = (r: Route, speed: number, pause = STROLL.pause) =>
  r.pts.reduce((s, p, i) => { const q = r.pts[(i + 1) % r.pts.length]; return s + Math.hypot(q.x - p.x, q.y - p.y) / speed + (r.stop[i] ? pause : 0); }, 0);

// ── The camera ──
// How far the camera may look past the Den's walls, into the dark rock round it (the user, 2026-11-19: "see
// more black on each side, so it feels like you can really look above the places"): u either side, and above and below.
export const LOOK_PAST = { across: 4, deep: 4 };
// How far you can zoom (pinch, or the mouse wheel): units across the screen (the Labyrinth's 15 to start). 🧪
export const ZOOM = { min: 8, max: 24, start: 15 };
// The part of the Den worth looking at: from the west wall to the east one (room 1's, till the wall's
// gone), and from the top of the north wall (as the camera sees it: `pitch` down) to the south rim, and
// LOOK_PAST beyond them.
export type Area = { x0: number; x1: number; y0: number; y1: number };
export function denArea(opened: boolean, pitch: number): Area {
  const L = LOOK_PAST;
  return { x0: ROOM1.x - 1 - L.across, x1: (opened ? ROOM2.x + ROOM2.w : DIVIDE_X) + 0.5 + L.across,
    y0: NOOK_N - DEN_WALL / Math.tan(pitch) - 0.3 - L.deep, y1: ROOM1.y + ROOM1.h + 0.3 + L.deep };
}
// Where the camera looks (the floor spot in the middle of the screen), kept so the view stays on the
// Den: `across` × `deep` floor units in view; a way wider than the Den is centred on it.
export function clampView(at: Pt, across: number, deep: number, a: Area): Pt {
  const fit = (v: number, lo: number, hi: number, span: number) => (span >= hi - lo ? (lo + hi) / 2 : Math.min(hi - span / 2, Math.max(lo + span / 2, v)));
  return { x: fit(at.x, a.x0, a.x1, across), y: fit(at.y, a.y0, a.y1, deep) };
}
// Where the camera first looks: room 1's middle, or the whole Den's once the wall's gone (the user: "when
// you first load up the game with it blown through, the camera is centralised").
export function firstView(opened: boolean, pitch: number): Pt {
  const a = denArea(opened, pitch);
  return { x: (a.x0 + a.x1) / 2, y: (a.y0 + a.y1) / 2 };
}

// ── Taps ──
// What a tap on the floor at (x, y) lands on: the station whose footprint, or its height as the camera
// sees it (a thing `tall` high covers the floor up to tall / tan(pitch) north of it), holds that spot;
// of several, the nearest in front (the one drawn over the others).
const SLACK = 0.15; // u round each footprint (a near miss on a small thing still counts)
export function stationAt(list: Station[], p: Pt, pitch: number): Station | undefined {
  const hits = list.filter((s) => {
    const x0 = s.x - s.w / 2 - SLACK, x1 = s.x + s.w / 2 + SLACK;
    const y1 = s.y + s.d / 2 + SLACK, y0 = s.y - s.d / 2 - s.tall / Math.tan(pitch) - SLACK;
    return p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
  });
  return hits.sort((a, b) => b.y + b.d / 2 - (a.y + a.d / 2))[0];
}
