// lib/den3d/layout.ts
// 🧪 The new Den (the user, 2026-11-18; Settings → New Den, lib/den3d/setting.ts): the Den built as
// the Labyrinth is, a room of floor tiles carved out of rock, drawn by the same 3D renderer under the
// same camera (components/Den3D.tsx; world/rendering.md §4.8), with warmer light. Pure: the plan, where
// everything stands (and where it may be moved to), its lights, who strolls where, how far the camera
// may go, and what a tap lands on.
//
// The shape (the user's drawing, 2026-11-19, "like the Tetris block that's 3 wide with one above in the
// middle"): a wide hall with a narrower nook rising from the middle of its back wall, split down the middle
// by a wall. Room 1 is the left half of each; room 2 (the tavern's room) the right, shut off till Klutz uses
// the Labyrinth Stone on the wall (lib/tavern.ts): then the whole wall moves away. Each nook has a tunnel
// in the middle of its north wall: room 1's the way into the Labyrinth, room 2's (its mirror) the PvP portal.
// Tile units, x east, y south, as the Labyrinth's floorplans. Everything faces south, at the camera; things
// against a wall are on north walls, the only ones whose faces show (rendering.md §4.8).

import { FLOOR, ROCK, TUNNEL, type Floorplan, type Pt, type Rect } from "../dungeon/floorplan";
import { OBJ, type ObjId } from "../den/scene";

export const HALL_W = 12;        // floor tiles across each room's half of the hall
export const HALL_D = 11;        // …and down it
export const NOOK_W = 6;         // floor tiles across each room's half of the nook
export const NOOK_D = 6;         // …and down it
export const DEN_WALL = 3;       // 🧪 u: the Den's rock walls (the Labyrinth's are 2.25): a cavern, so the buildings stand under them
const TOP = 2;                   // rock rows above the nook (its tunnels run into them)
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
// The tunnels, each in the middle of its room's nook (mirrored about the dividing wall).
const ARCH = [9, 10];                         // room 1's: the Labyrinth
const PORTAL = [16, 17];                      // room 2's: the PvP portal
const mid = (t: number[]) => (t[0] + t[1]) / 2;

// The plan: rock, the halls and nooks, the tunnels; once `opened`, the dividing wall is floor.
// (Its own Floorplan, so the Labyrinth's renderer and light rules read it as is.)
export function denPlan(opened: boolean): Floorplan {
  const tiles = new Uint8Array(PLAN_W * PLAN_H).fill(ROCK);
  const set = (x: number, y: number, t: number) => { tiles[y * PLAN_W + x] = t; };
  for (const r of [ROOM1, ROOM2, NOOK1, NOOK2]) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) set(x, y, FLOOR);
  for (const x of [...ARCH, ...PORTAL]) for (let y = 0; y < TOP; y++) set(x, y, TUNNEL);
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
// Floor things snap to a half-unit grid inside the middle of the hall; wall things to slots on the north
// walls: beside each tunnel, in the middle between them (once the wall's gone), and along the hall's back
// wall beside the shack. Kept in the save (lib/den3d/placement.ts); anything missing stands where it starts.
export type FloorKey = "altar" | "pool" | "pit" | "training";
export type WallKey = "board" | "bookcase" | "cage";
export type SlotId = "hall-1" | "hall-2" | "nook-1" | "nook-mid" | "nook-2";
export type DenLayout = { floor?: Partial<Record<FloorKey, Pt>>; wall?: Partial<Record<WallKey, SlotId>> };
export const FLOOR_KEYS: FloorKey[] = ["altar", "pool", "pit", "training"];
export const WALL_KEYS: WallKey[] = ["board", "bookcase", "cage"];
export const SNAP = 0.5;                      // u: the floor grid
export const FLOOR_START: Record<FloorKey, Pt> = { altar: { x: 7, y: 13 }, pool: { x: 4.7, y: 17 }, pit: { x: 9.9, y: 16.9 }, training: { x: 17.5, y: 15 } };
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
export const FLOOR_SIZE: Record<FloorKey, { w: number; d: number }> = { altar: { w: 2.2, d: 2 }, pool: { w: 2, d: 1.5 }, pit: { w: 2.6, d: 2.8 }, training: { w: 2.6, d: 3.1 } };
const WALL_SIZE: Record<WallKey, { w: number; d: number; out: number }> = { board: { w: 1.35, d: 0.2, out: 0 }, bookcase: { w: 1.25, d: 0.5, out: 0.25 }, cage: { w: 1.1, d: 1.1, out: 0.6 } };
// The middle of the hall, where floor things may stand (room 2's half only once the wall's gone; a margin
// kept clear for walking along the walls and in front of the buildings).
export function floorZone(opened: boolean): { x0: number; x1: number; y0: number; y1: number } {
  return { x0: 3.6, x1: opened ? ROOM2.x + ROOM2.w - 3.1 : DIVIDE_X - 1.5, y0: HALL_Y + 3, y1: HALL_Y + HALL_D - 0.6 };
}
// The braziers stand either side of the altar's front, and of the pit in the tavern's room: they move with them.
export const BRAZIER_AT = { dx: 1.5, dy: 1.6 };
// How much floor a thing keeps to itself (its footprint, its braziers, and room to walk round).
const KEEP = 0.3;
export function keptBox(key: FloorKey, at: Pt) {
  const s = FLOOR_SIZE[key], fires = key === "altar" || key === "training";
  const hw = Math.max(s.w / 2, fires ? BRAZIER_AT.dx + 0.2 : 0) + KEEP, below = Math.max(s.d / 2, fires ? BRAZIER_AT.dy + 0.2 : 0) + KEEP;
  return { x0: at.x - hw, x1: at.x + hw, y0: at.y - s.d / 2 - KEEP, y1: at.y + below };
}
export const snap = (v: number) => Math.round(v / SNAP) * SNAP;

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
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y) && fitsFloor(k, p, { floor, wall }, opened)) floor[k] = { x: p.x, y: p.y };
  }
  return { floor, wall };
}
// Can floor thing `key` stand at `at`: inside the middle of the hall, clear of everything else there?
// (The tavern's room's pit only in its own half: it's the tavern's.)
export function fitsFloor(key: FloorKey, at: Pt, p: Placed, opened: boolean): boolean {
  const z = floorZone(opened), b = keptBox(key, at), s = FLOOR_SIZE[key];
  if (at.x - s.w / 2 < z.x0 || at.x + s.w / 2 > z.x1 || at.y - s.d / 2 < z.y0 || at.y + s.d / 2 > z.y1) return false;
  if (key === "training" && at.x - s.w / 2 < DIVIDE_X + 0.5) return false;
  const hits = (o: { x0: number; x1: number; y0: number; y1: number }) => b.x0 < o.x1 && o.x0 < b.x1 && b.y0 < o.y1 && o.y0 < b.y1;
  return FLOOR_KEYS.every((k) => k === key || (k === "training" && !opened) || !hits(keptBox(k, p.floor[k])));
}
// Can wall thing `key` hang in (or stand against) slot `id`? It must fit, and the slot be open; a slot
// another wall thing holds swaps them (placeWall).
export function fitsWall(key: WallKey, id: SlotId, opened: boolean): boolean {
  const s = SLOTS.find((q) => q.id === id);
  return !!s && (opened || !s.opened) && WALL_SIZE[key].w <= s.wide + 0.001;
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
  | "rubble" | "portal" | "tavern" | "training";
export type Station = { key: StationKey; obj?: Exclude<ObjId, 0>; label: string; href?: string; x: number; y: number; w: number; d: number; tall: number;
  wall?: boolean; turn?: "east"; move?: "floor" | "wall"; room: 1 | 2 };

// The Den's stations, room 1's then room 2's (the tavern's room only once the wall's gone; its pit only once
// the tavern has its pit, as the old room had: lib/trainingPit.ts hasPit). Room 1: the shack in the hall's
// top-left corner, the storehouse along the west wall, the Bestiary in the nook, the Labyrinth's tunnel, and
// what you can move. Room 2: the tavern in the hall's top-right corner and the PvP portal's tunnel.
export type DenState = { opened: boolean; pit: boolean; trainingPit: boolean; repaired: boolean };
export function stations(s: DenState, p: Placed = placed(undefined, s.opened)): Station[] {
  const back = (face: number, d: number) => face + d / 2; // a thing standing against a north wall: its y
  const floorAt = (k: FloorKey) => ({ ...p.floor[k], ...FLOOR_SIZE[k], room: (p.floor[k].x < DIVIDE_X ? 1 : 2) as 1 | 2 });
  const wallAt = (k: WallKey) => {
    const slot = SLOTS.find((q) => q.id === p.wall[k])!, z = WALL_SIZE[k];
    return { x: slot.x, y: z.out ? slot.face + z.out : slot.face, w: z.w, d: z.d, room: (slot.x < DIVIDE_X ? 1 : 2) as 1 | 2 };
  };
  const out: Station[] = [
    { key: "shack", obj: OBJ.crate, label: "Klutz's Den", href: "/klutz", x: 2.15, y: back(HALL_N, 2.5), w: 3.25, d: 2.5, tall: 3, room: 1 },
    { key: "storehouse", obj: OBJ.chest, label: "Storehouse", href: "/chest?store=1", x: 1.8, y: 13.1, w: 2.6, d: 3.45, tall: 3, turn: "east", room: 1 },
    { key: "arch", obj: OBJ.arch, label: "The Labyrinth", href: "/dungeon", x: mid(ARCH), y: NOOK_N, w: 2.9, d: 0.2, tall: 3, wall: true, room: 1 },
    { key: "lectern", obj: OBJ.scroll, label: "Bestiary", href: "/guide", x: 11.6, y: 4.6, w: 0.8, d: 0.6, tall: 1.3, room: 1 },
    { key: "board", obj: OBJ.quests, label: "Quest Board", href: "/board", ...wallAt("board"), tall: 2.45, wall: true, move: "wall" },
    { key: "bookcase", obj: OBJ.bookcase, label: "Bookcase", href: "/bookcase", ...wallAt("bookcase"), tall: 2, move: "wall" },
    { key: "cage", obj: OBJ.cage, label: "Cage", href: "/cage", ...wallAt("cage"), tall: 2.1, move: "wall" },
    { key: "altar", obj: OBJ.altar, label: "Soul Altar", href: "/altar", ...floorAt("altar"), tall: 2, move: "floor" },
    { key: "pool", obj: OBJ.pool, label: "Healing Pool", href: "/pool", ...floorAt("pool"), tall: 0.4, move: "floor" },
    { key: "pit", obj: OBJ.pit, label: "The Pit", href: "/pit", ...floorAt("pit"), tall: 0.6, move: "floor" },
  ];
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
export const DEN_LIGHT = { torch: 5.5, brazier: 4.5, altar: 4, tavern: 4.5, lantern: 3.5 }; // 🧪 reaches
export const SCONCES: Pt[] = [{ x: 12.2, y: NOOK_N }, { x: 13.8, y: NOOK_N }, { x: 20, y: HALL_N }];
export const ARCH_LIGHTS: Pt[] = [{ x: mid(ARCH) - 1.2, y: NOOK_N }, { x: mid(ARCH) + 1.2, y: NOOK_N }];
export const PORTAL_LIGHTS: Pt[] = [{ x: mid(PORTAL) - 1.2, y: NOOK_N }, { x: mid(PORTAL) + 1.2, y: NOOK_N }];
const LANTERNS: Pt[] = [{ x: 2.6, y: 10.4 }, { x: 3.4, y: 13.1 }, { x: 5.2, y: 8.4 }]; // (the shack's and storehouse's doors, the board)
export function braziers(p: Placed, s: DenState): Pt[] {
  const by = (c: Pt) => [-1, 1].map((k) => ({ x: c.x + k * BRAZIER_AT.dx, y: c.y + BRAZIER_AT.dy }));
  return [...by(p.floor.altar), ...(s.opened && s.pit ? by(p.floor.training) : [])];
}
export function denLights(s: DenState, p: Placed = placed(undefined, s.opened)): { x: number; y: number; r: number }[] {
  const inRoom = (q: Pt) => s.opened || q.x < DIVIDE_X;
  return [
    ...[...SCONCES, ...ARCH_LIGHTS, ...PORTAL_LIGHTS].filter(inRoom).map((q) => ({ x: q.x, y: q.y + 0.6, r: DEN_LIGHT.torch })),
    ...braziers(p, s).map((q) => ({ ...q, r: DEN_LIGHT.brazier })),
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
export const KLUTZ_LOOP: Pt[] = [{ x: 4.5, y: 10.6 }, { x: 9.5, y: 9.4 }, { x: 8.8, y: 4.6 }, { x: 11.5, y: 10.2 }, { x: 7, y: 18.1 }, { x: 4.3, y: 15.6 }];
export const VISITOR_LOOP: Pt[] = [{ x: 15, y: 11 }, { x: 16.5, y: 4.6 }, { x: 19, y: 10.8 }, { x: 23.5, y: 15.5 }, { x: 19, y: 18.1 }, { x: 13, y: 17.5 },
  { x: 7, y: 18.1 }, { x: 4.3, y: 15.6 }, { x: 4.5, y: 10.6 }, { x: 9.5, y: 9.4 }, { x: 13, y: 5 }];
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
