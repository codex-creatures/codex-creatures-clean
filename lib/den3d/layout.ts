// lib/den3d/layout.ts
// 🧪 The new Den (the user, 2026-11-18; Settings → New Den, lib/den3d/setting.ts): the Den built as
// the Labyrinth is, a room of floor tiles carved out of rock, drawn by the same 3D renderer under the
// same camera (components/Den3D.tsx; world/rendering.md §4.8), with warmer light. Pure: the plan, where
// everything stands, its lights, who strolls where, how far the camera may go, and what a tap lands on.
//
// Two rooms side by side in a T (tile units, x east, y south, as the Labyrinth's floorplans; the shape below):
// - Room 1, the Den: the hall's left half and the nook's (stations() says what stands where).
// - Room 2, the tavern's room: the right halves. Shut off behind the rock between them, with the rubble
//   against it, till the dynamite blows it: then the wall comes down and the hall is one (the nook stays split).
// Everything faces south, at the camera; things set into a wall are on the north wall, the only one
// whose face shows (rendering.md §4.8).

import { FLOOR, ROCK, TUNNEL, type Floorplan, type Pt, type Rect } from "../dungeon/floorplan";
import { OBJ, type ObjId } from "../den/scene";

// The shape (the user's drawing, 2026-11-19, "like the Tetris block that's 3 wide with one above in the
// middle"): a wide hall with a narrower nook rising from the middle of its back wall, split down the
// middle by rock. Room 1 is the hall's left half and the nook's left half; room 2 the right halves. The
// rock between them stays through the nook and a little way into the hall; the rest of it (the rubble's
// wall) comes down with the dynamite. Each nook has a tunnel north: room 1's is the way into the Labyrinth,
// room 2's shows once the wall's down.
export const HALL_W = 12;        // floor tiles across each room's half of the hall
export const HALL_D = 11;        // …and down it
export const NOOK_W = 6;         // floor tiles across each room's half of the nook
export const NOOK_D = 6;         // …and down it
export const DEN_WALL = 3;       // 🧪 u: the Den's rock walls (the Labyrinth's are 2.25): a cavern, so the buildings stand under them
const TOP = 2;                   // rock rows above the nook (its tunnels run into them)
export const PLAN_W = 1 + HALL_W + 1 + HALL_W + 1;
// (Three rows of rock below the hall: rock past the plan's edge stands full height, and from the camera
// it hid the hall's front; these are the low south rim instead, SOUTH_BAND, and then far enough off.)
export const PLAN_H = TOP + NOOK_D + HALL_D + 3;
export const DIVIDE_X = HALL_W + 1;           // the rock between the rooms
const HALL_Y = TOP + NOOK_D;                  // the hall's first row
export const ROOM1 = { x: 1, y: HALL_Y, w: HALL_W, h: HALL_D };              // the hall's halves
export const ROOM2 = { x: DIVIDE_X + 1, y: HALL_Y, w: HALL_W, h: HALL_D };
export const NOOK1: Rect = { x: DIVIDE_X - NOOK_W, y: TOP, w: NOOK_W, h: NOOK_D }; // the nook's halves
export const NOOK2: Rect = { x: DIVIDE_X + 1, y: TOP, w: NOOK_W, h: NOOK_D };
export const STAYS = 3;                       // rows of the hall the rock between the rooms keeps (past the nook)
export const WALL_GAP = { y0: HALL_Y + STAYS, y1: HALL_Y + HALL_D }; // the rows that come down (y1 not included)
const NOOK_N = TOP - 0.5;                     // the nook's north wall's face (y)
const HALL_N = HALL_Y - 0.5;                  // the hall's north wall's face, either side of the nook (y)
const ARCH = [10, 11];                        // room 1's tunnel (x): the Labyrinth
const TUNNEL_2 = [16, 17];                    // room 2's tunnel (x)
const ALCOVE = [7, 8];                        // the cage's alcove (x), one tile into the nook's north wall

// The plan: rock, the halls and nooks, the tunnels and the alcove; once `opened`, the rubble's wall is floor.
// (Its own Floorplan, so the Labyrinth's renderer and light rules read it as is.)
export function denPlan(opened: boolean): Floorplan {
  const tiles = new Uint8Array(PLAN_W * PLAN_H).fill(ROCK);
  const set = (x: number, y: number, t: number) => { tiles[y * PLAN_W + x] = t; };
  for (const r of [ROOM1, ROOM2, NOOK1, NOOK2]) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) set(x, y, FLOOR);
  for (const x of [...ARCH, ...TUNNEL_2]) for (let y = 0; y < TOP; y++) set(x, y, TUNNEL);
  for (const x of ALCOVE) set(x, TOP - 1, FLOOR);
  if (opened) for (let y = WALL_GAP.y0; y < WALL_GAP.y1; y++) set(DIVIDE_X, y, FLOOR);
  return { w: PLAN_W, h: PLAN_H, tiles, rooms: { den: [ROOM1, NOOK1], annex: [ROOM2, NOOK2] }, doors: [], tunnels: {} };
}

// Which tiles show: room 1 (with its walls) always; room 2 only once the wall's down. (Drawn black till then.)
export function denShown(opened: boolean): Uint8Array {
  const shown = new Uint8Array(PLAN_W * PLAN_H);
  for (let y = 0; y < PLAN_H; y++) for (let x = 0; x < PLAN_W; x++) if (opened || x <= DIVIDE_X) shown[y * PLAN_W + x] = 1;
  return shown;
}

// ── What stands where ──
// A station: something you tap to go somewhere. (x, y) is its footprint's middle, w × d its footprint
// (u), `tall` how high it stands (taps and its label go by it). `wall`: set on a north wall, its back
// against the face. `obj`: the old Den's id for it, so Klutz's tour finds it ("den-<id>").
export type StationKey = "shack" | "bookcase" | "arch" | "board" | "cage" | "lectern" | "storehouse" | "altar" | "pool" | "pit"
  | "rubble" | "portal" | "tavern" | "training";
export type Station = { key: StationKey; obj?: Exclude<ObjId, 0>; label: string; href?: string; x: number; y: number; w: number; d: number; tall: number; wall?: boolean; room: 1 | 2 };

// The Den's stations, room 1's then room 2's (the tavern's room: only once the wall's down; the
// portal and the pit only once the tavern has its pit, as the old room had: lib/trainingPit.ts hasPit).
// Room 1: along the hall's back wall the shack (its top-left corner), the board and the bookcase; in the
// nook the cage, the Labyrinth's arch and the Bestiary; in the hall the storehouse, the altar, the pool
// and the Pit. Room 2: the tavern on the hall's back wall, the portal in the nook, the pit in the hall.
export type DenState = { opened: boolean; pit: boolean; trainingPit: boolean; repaired: boolean };
export function stations(s: DenState): Station[] {
  const back = (face: number, d: number) => face + d / 2; // a thing standing against a north wall: its y
  const out: Station[] = [
    { key: "shack", obj: OBJ.crate, label: "Klutz's Den", href: "/klutz", x: 2.15, y: back(HALL_N, 2.5), w: 3.25, d: 2.5, tall: 3, room: 1 },
    { key: "board", obj: OBJ.quests, label: "Quest Board", href: "/board", x: 4.5, y: HALL_N, w: 1.35, d: 0.2, tall: 2.45, wall: true, room: 1 },
    { key: "bookcase", obj: OBJ.bookcase, label: "Bookcase", href: "/bookcase", x: 5.85, y: back(HALL_N, 0.5), w: 1.25, d: 0.5, tall: 2, room: 1 },
    { key: "cage", obj: OBJ.cage, label: "Cage", href: "/cage", x: (ALCOVE[0] + ALCOVE[1]) / 2, y: NOOK_N - 0.2, w: 1.1, d: 1.1, tall: 2.1, room: 1 },
    { key: "arch", obj: OBJ.arch, label: "The Labyrinth", href: "/dungeon", x: (ARCH[0] + ARCH[1]) / 2, y: NOOK_N, w: 2.9, d: 0.2, tall: 3, wall: true, room: 1 },
    { key: "lectern", obj: OBJ.scroll, label: "Bestiary", href: "/guide", x: 8.2, y: 4.3, w: 0.8, d: 0.6, tall: 1.3, room: 1 },
    { key: "storehouse", obj: OBJ.chest, label: "Storehouse", href: "/chest?store=1", x: 2.25, y: 13.3, w: 3.45, d: 2.6, tall: 3, room: 1 },
    { key: "altar", obj: OBJ.altar, label: "Soul Altar", href: "/altar", x: 7, y: 13, w: 2.2, d: 2, tall: 2, room: 1 },
    { key: "pool", obj: OBJ.pool, label: "Healing Pool", href: "/pool", x: 4.6, y: 17.1, w: 2, d: 1.5, tall: 0.4, room: 1 },
    { key: "pit", obj: OBJ.pit, label: "The Pit", href: "/pit", x: 10.2, y: 16.8, w: 2.6, d: 2.8, tall: 0.6, room: 1 },
  ];
  if (!s.opened) out.push({ key: "rubble", obj: OBJ.tavern, label: "Rubble", x: DIVIDE_X - 1, y: 14.6, w: 1, d: 3, tall: 1.6, room: 1 });
  else {
    out.push({ key: "tavern", label: s.repaired ? "Tavern" : "Broken tavern", href: "/tavern", x: 23, y: back(HALL_N, 3.1), w: 4.85, d: 3.1, tall: 3.1, room: 2 });
    if (s.pit) out.push(
      { key: "portal", label: "PvP Portal", href: "/pvp", x: 18.5, y: NOOK_N, w: 1.6, d: 0.2, tall: 3.4, wall: true, room: 2 },
      { key: "training", label: s.trainingPit ? "Training Pit" : "Sparring Pit", href: "/training", x: 17.5, y: 14.5, w: 2.6, d: 3.1, tall: 0.6, room: 2 },
    );
  }
  return out;
}

// ── Light ──
// The Den's lights: torches on the nook's north wall (and by the tavern), the light on the Labyrinth's arch,
// braziers by the altar (and in the tavern's room once it's open), lanterns by the shack's and storehouse's
// doors, the altar's soul fire and the tavern's windows. Tile units and reach in tiles (stone.ts Light3D).
export const DEN_LIGHT = { torch: 5.5, brazier: 4.5, altar: 4, tavern: 4.5, lantern: 3.5 }; // 🧪 reaches
export const SCONCES: Pt[] = [{ x: 8.55, y: NOOK_N }, { x: 12.15, y: NOOK_N }, { x: 14.4, y: NOOK_N }, { x: 20, y: HALL_N }];
export const ARCH_LIGHTS: Pt[] = [{ x: 9.3, y: NOOK_N }, { x: 11.7, y: NOOK_N }];
export const BRAZIERS: Pt[] = [{ x: 5.5, y: 14.6 }, { x: 8.5, y: 14.6 }];
export const BRAZIERS_2: Pt[] = [{ x: 15, y: 13 }, { x: 20.5, y: 13.5 }]; // (the tavern's room's, once it's open)
const LANTERNS: Pt[] = [{ x: 2.6, y: 10.4 }, { x: 2.25, y: 15 }, { x: 5.2, y: 8.4 }]; // (the shack's and storehouse's doors, the board)
export function denLights(opened: boolean, repaired: boolean): { x: number; y: number; r: number }[] {
  const inRoom = (p: Pt) => opened || p.x < DIVIDE_X;
  return [
    ...[...SCONCES.filter(inRoom), ...ARCH_LIGHTS].map((p) => ({ x: p.x, y: p.y + 0.6, r: DEN_LIGHT.torch })),
    ...[...BRAZIERS, ...(opened ? BRAZIERS_2 : [])].map((p) => ({ ...p, r: DEN_LIGHT.brazier })),
    ...LANTERNS.map((p) => ({ ...p, r: DEN_LIGHT.lantern })),
    { x: 7, y: 13, r: DEN_LIGHT.altar },
    ...(opened && repaired ? [{ x: 23, y: 11, r: DEN_LIGHT.tavern }] : []),
  ];
}

// Where light may fall (the Labyrinth's `lightNow`): every open tile that shows.
export function denLit(plan: Floorplan, shown: Uint8Array): Uint8Array {
  return Uint8Array.from(plan.tiles, (t, i) => (t !== ROCK && shown[i] ? 1 : 0));
}

// ── Who strolls where ──
// Klutz round room 1 when he's home (up into the nook and back), and visitors round the whole Den (the user,
// 2026-11-18), each a loop of spots on open floor (straight legs clear of everything: tests/den3d.test.ts).
export const KLUTZ_LOOP: [number, number][] = [[4.8, 11.2], [9.4, 11], [10.4, 5.4], [8.8, 6.6], [10, 15], [4.7, 15.5]];
export const VISITOR_LOOP: [number, number][] = [[14.8, 11.4], [16.5, 4.5], [18.2, 6], [20.5, 11.6], [23.5, 15.5], [20, 17.6], [15, 17.6], [13, 15], [10, 15], [4.7, 15.5], [4.8, 11.2], [9.4, 11], [12.5, 11.6]];
export const STROLL = { klutz: 0.55, visitor: 0.45, pause: 3 }; // u a second; s stopped at each spot

// Where a stroller is `t` seconds in (looping): x, y, and which way it faces (radians, 0 east, as the
// Labyrinth's people), moving or stopped.
export function strollAt(t: number, loop: [number, number][], speed: number, pause = STROLL.pause): { x: number; y: number; facing: number; moving: boolean } {
  const legs = loop.map((p, i) => { const q = loop[(i + 1) % loop.length]; return { p, q, time: Math.hypot(q[0] - p[0], q[1] - p[1]) / speed }; });
  const total = legs.reduce((s, l) => s + l.time + pause, 0);
  let left = ((t % total) + total) % total;
  for (const l of legs) {
    const facing = Math.atan2(l.q[1] - l.p[1], l.q[0] - l.p[0]);
    if (left < pause) return { x: l.p[0], y: l.p[1], facing, moving: false };
    left -= pause;
    if (left < l.time) { const k = left / l.time; return { x: l.p[0] + (l.q[0] - l.p[0]) * k, y: l.p[1] + (l.q[1] - l.p[1]) * k, facing, moving: true }; }
    left -= l.time;
  }
  return { x: loop[0][0], y: loop[0][1], facing: 0, moving: false };
}
export const loopTime = (loop: [number, number][], speed: number, pause = STROLL.pause) =>
  loop.reduce((s, p, i) => { const q = loop[(i + 1) % loop.length]; return s + Math.hypot(q[0] - p[0], q[1] - p[1]) / speed + pause; }, 0);

// ── The camera ──
// How far the camera may look past the Den's walls, into the dark rock round it (the user, 2026-11-19: "see
// more black on each side, so it feels like you can really look above the places"): u either side, and above and below.
export const LOOK_PAST = { across: 4, deep: 2 };
// The part of the Den worth looking at: from the west wall to the east one (room 1's, till the wall's
// down), and from the top of the north wall (as the camera sees it: `pitch` down) to the south rim, and
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
// Where the camera first looks: room 1's middle, or the whole Den's once the wall's down (the user: "when
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
