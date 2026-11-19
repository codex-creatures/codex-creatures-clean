// lib/dungeon/tutorialRun.ts
// The first quest's run, walked by torchlight (the user, 2026-11-20: "the
// tutorial should run like a normal labyrinth… let's make this feel special as
// it will be their first experience"). Klutz's box was stolen by a Baby
// Cyclops (lib/quest.ts); this is where you chase it. Always the same place,
// made by hand rather than rolled:
// - the entrance: a small room where you start, at the bottom, with wall
//   torches burning, a bookcase with nothing in it (searched: dust), cobwebs in
//   both top corners, a rat running along the top wall into its hole, and a
//   few crates and pots in a corner;
// - one corridor up, with torches along its walls, and Klutz's Club lying on
//   its floor halfway up, glowing, with a "!" over it (dropped by the fleeing
//   thief): walk up to it, it goes in your bag, and the bag opens to teach
//   you to put it on (components/dungeon/Bag.tsx's tutorial);
// - the thief's room: the Baby Cyclops waiting at the top with the box,
//   standing torches either side of the way up to him (lit a pair at a time as
//   you come, as on the way to any boss), bones and a pot in its corners.
// Walk up to him and the guided fight starts (lib/quest.ts thiefRoom).
//
// It's a walkable run like any other (walkRun.ts: run.walk, with tutorial:
// true), saved at the world version of its day, its placements written here
// rather than by place.ts, so it never changes when the generator does.

import type { DungeonRun, Room, PotionKey } from "./run";
import type { DungeonMap } from "./map";
import type { Layout } from "./layout";
import type { Instance } from "../world/objects";
import type { RatHole, CobWeb } from "./decor";
import type { Pt } from "./floorplan";
import { PLACED_V } from "../world/place";
import { clubRoom, thiefRoom } from "../quest";

const B = 2; // tiles a block
// In blocks (with 2 blocks of rock round the outside): the thief's room at the
// top, 10 × 7; five blocks of rock (the corridor, 10 tiles long); the entrance, 8 × 5.
export const TUTORIAL_LAYOUT: Layout = {
  w: 14, h: 21, start: "start", boss: "thief", block: B,
  rooms: {
    thief: { id: "thief", shape: "boss", x: 2, y: 2, w: 10, h: 7, block: B },
    start: { id: "start", shape: "start", x: 3, y: 14, w: 8, h: 5, block: B },
  },
  // (In tiles: from the thief's room's bottom wall, row 17, to the entrance's top wall, row 28.)
  tunnels: [{ key: "start-thief", a: "start", b: "thief", up: true, rect: { x: 13, y: 17, w: 3, h: 12 } }],
};

// The scroll: the two rooms and the corridor. The thief's room is a "?"
// until you're in it (map.quest: no lair shown).
export function tutorialMap(): DungeonMap {
  return {
    h: TUTORIAL_LAYOUT.h * B, start: "start", boss: "thief", quest: true,
    nodes: {
      start: { id: "start", x: 14, y: 33, kind: "entrance", links: ["thief"] },
      thief: { id: "thief", x: 14, y: 10, kind: "easy", links: ["start"], mystery: true },
    },
  };
}

// Where things stand, in tiles (the middle of a panel); turned into subcells for the saved placements.
const S = 3; // subcells a tile (lib/world/grid.ts SUBCELLS)
const at = (id: string, def: string, room: string, x: number, y: number, extra: Partial<Instance> = {}): Instance =>
  ({ id, def, room, sx: x * S, sy: y * S, ...extra });

export const CLUB_SPOT: Pt = { x: 14, y: 23 };   // halfway up the corridor
export const START_SPOT: Pt = { x: 14, y: 35 };  // where you start: near the entrance's bottom wall
export const THIEF_SPOT: Pt = { x: 14, y: 8 };   // where the thief waits, near the top of his room

export const TUTORIAL_PLACED: Instance[] = [
  // The entrance: torches either side on its top wall, lit; the empty bookcase against it; a corner's crates and pots.
  at("start:sconce:0", "sconce", "start", 9, 29, { wall: "north", start: "lit" }),
  at("start:sconce:1", "sconce", "start", 18, 29, { wall: "north", start: "lit" }),
  at("shelf:start", "bookcase", "start", 11, 29),
  at("decor:start:0:0", "crates", "start", 19, 35),
  at("decor:start:0:1", "pots", "start", 20, 34),
  at("decor:start:1:0", "skull", "start", 8, 36),
  // The corridor: a torch on each wall, unlit till you pass; the club on its floor.
  at("start-thief:sconce:0", "sconce-side", "start-thief", 13, 26, { wall: "west" }),
  at("start-thief:sconce:1", "sconce-side", "start-thief", 15, 20, { wall: "east" }),
  at("club:start", "club", "start", CLUB_SPOT.x, CLUB_SPOT.y),
  // The thief's room: standing torches lining the way up to him (a pair at a time from the door), torches on
  // its top wall, bones and pots in its bottom corners, barrels in a top one.
  ...[0, 1, 2].flatMap((pair) => [
    at(`brazier:thief:${pair}:0`, "standing-torch", "thief", 12, 15 - pair * 3),
    at(`brazier:thief:${pair}:1`, "standing-torch", "thief", 16, 15 - pair * 3),
  ]),
  at("thief:sconce:0", "sconce", "thief", 8, 5, { wall: "north" }),
  at("thief:sconce:1", "sconce", "thief", 20, 5, { wall: "north" }),
  at("decor:thief:0:0", "skull", "thief", 6, 16),
  at("decor:thief:0:1", "pots", "thief", 7, 16),
  at("decor:thief:1:0", "barrels", "thief", 21, 6),
  at("decor:thief:2:0", "skull", "thief", 22, 15),
  // The thief himself, waiting.
  at("thief:foe:0", "foe", "thief", THIEF_SPOT.x, THIEF_SPOT.y, { foe: { waits: true }, facing: Math.PI / 2 }),
];

// What the screen draws on the floors and walls (decor.ts placeFloorLife, here by hand): a web in each of
// the entrance's top corners and one in the thief's, a rat's hole at the foot of the entrance's top wall, right of the corridor.
export const TUTORIAL_LIFE: { puddles: Pt[]; holes: RatHole[]; webs: CobWeb[] } = {
  puddles: [{ x: 9, y: 34 }],
  holes: [{ x: 19, y: 29, from: 16 }],
  webs: [{ x: 7, y: 29, side: "left" }, { x: 20, y: 29, side: "right" }, { x: 5, y: 5, side: "left" }],
};

// What Klutz says as you step in (a line over the walk; a tap clears it), and what he puts in your bag: the
// thief's a long fight, so two Lesser Potions (the user, 2026-11-20: you'd use 1 or 2).
export const TUTORIAL_POTIONS: PotionKey[] = ["lesser", "lesser"];
export const TUTORIAL_HELLO = "🔥 Klutz hands you a torch and two potions: “It went up that corridor with my box! Drag where you want to walk. I'm right behind you.”";

// The run: the entrance is the room you start in (the club's: done once you've picked it up), the thief's
// room waits with him in it.
// clubFound: you picked the club up on a run you left before beating him (it isn't there again).
export function startTutorialRun(party: string[], team: string[], hp: Record<string, number>, runNumber: number, clubFound = false): DungeonRun {
  const map = tutorialMap();
  const start: Room = { ...clubRoom(), sack: undefined, gold: 0, done: clubFound };
  return {
    id: crypto.randomUUID(), runNumber, startedAt: new Date().toISOString(),
    party: [...party], team: [...team], hp: Object.fromEntries(party.map((id) => [id, hp[id] ?? 1])),
    room: 0, map, path: [map.start], cleared: [], current: start,
    loot: [], status: "exploring", inside: false,
    walk: {
      layout: TUTORIAL_LAYOUT, rooms: { thief: thiefRoom() }, seed: 20261120, at: START_SPOT, room: map.start, line: null,
      fires: [], v: PLACED_V, placed: TUTORIAL_PLACED, tutorial: true,
    },
  };
}
