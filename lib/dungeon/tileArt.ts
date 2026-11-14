// lib/dungeon/tileArt.ts
// Drawing the walkable Labyrinth (floorplan.ts) with PixelLab tile sheets, in
// the three-quarter top-down look of docs/ideas/future-dungeon-direction.png:
// floors seen from above, walls showing their front faces. Pure rules, no
// drawing (the lab draws: app/lab/walk). The grid, collision and paths don't
// change; only the picture does.
//
// - The sheets are PixelLab "Wang" tilesets with walls (transition size 1):
//   25 tiles, each picked by the terrain at its four corners and, for some,
//   the corners round it (its `pattern`, from the sheet's metadata).
// - Corners are tiles: the picture is drawn on a grid half a tile off the
//   floorplan's, so each drawn cell sits between four floorplan tiles and
//   takes its corners from them (a "dual grid"). Rock is the upper terrain,
//   anything walkable the lower.
// - A wall's front face is the cell below the rock, down to a walkable
//   tile's middle (the sheet's "cliff" corner: a walkable tile with rock
//   right above it). So a face eats half the top row of a floor; you still
//   walk there, standing in front of the wall.
// - Rock away from any floor isn't drawn (black), like the picture's dark.
// - Things standing up (you, foes, doors, chests) are drawn after the
//   floors, lowest on screen last (drawOrder), so what's nearer is in front.

import { ROCK, TUNNEL, type Floorplan } from "./floorplan";

export const LOWER = 0, UPPER = 1, CLIFF = 2;
export const SHEET_TILE = 16; // px

// The 25 tiles of a PixelLab wall tileset (all our samples share this
// layout): where each is on the sheet (in tiles), and its 4×4 pattern of
// corners, row by row: the drawn cell's own corners are the middle 2×2, the
// ring round them its neighbours' (9 = any). From the sheets' metadata.
export type WangTile = { col: number; row: number; pattern: number[] };
export const ANY_TILE = 9; // a pattern corner that may be anything
const ANY = ANY_TILE;
const WANG_LAYOUT: [number, number, string][] = [
  [2, 2, "9999900990099999"], [3, 2, "9999900990199999"], [1, 4, "9999900991199999"], [2, 4, "9999900991099999"],
  [3, 3, "9009901990199999"], [3, 4, "9999901990199999"], [0, 6, "9999911991199999"], [1, 0, "9119910991099999"],
  [1, 1, "9999910991099999"], [0, 4, "9999910991199999"], [3, 6, "9999901991199999"], [1, 6, "9999911991299909"],
  [3, 0, "9999911992299009"], [1, 2, "9999910992099009"], [1, 7, "9199912991099999"], [3, 1, "9119922990099999"],
  [1, 3, "9999920990099999"], [2, 0, "9999901990299009"], [0, 0, "9999911992199099"], [2, 6, "9999910992199019"],
  [2, 1, "9999902990099999"], [0, 1, "9919921990199999"], [2, 7, "9109921990199999"], [0, 2, "9999901991299109"],
  [0, 3, "9019912991099999"],
];
export const WANG_TILES: WangTile[] = WANG_LAYOUT.map(([col, row, p]) => ({ col, row, pattern: [...p].map(Number) }));

// The terrain at each floorplan tile, as a corner: rock is upper; a walkable
// tile with rock right above it is a cliff's foot (a wall face comes down to
// it); any other walkable tile is lower. Outside the floorplan is rock.
export function cornerTerrain(fp: Floorplan): Uint8Array {
  const out = new Uint8Array(fp.w * fp.h);
  for (let y = 0; y < fp.h; y++) for (let x = 0; x < fp.w; x++) {
    const i = y * fp.w + x;
    out[i] = fp.tiles[i] === ROCK ? UPPER : y === 0 || fp.tiles[i - fp.w] === ROCK ? CLIFF : LOWER;
  }
  return out;
}

// The tile for a cell whose 4×4 corners (row by row, the cell's own in the
// middle) are `around`: one whose pattern matches every corner it cares
// about, the most particular if several do; failing that, the closest.
export function pickTile(around: number[], tiles: WangTile[] = WANG_TILES): number {
  let best = 0, bestMiss = Infinity, bestCares = -1;
  tiles.forEach((t, i) => {
    let miss = 0, cares = 0;
    t.pattern.forEach((v, k) => {
      if (v === ANY) return;
      cares++;
      if (v !== around[k]) miss += k === 5 || k === 6 || k === 9 || k === 10 ? 10 : 1; // its own corners matter most
    });
    if (miss < bestMiss || (miss === bestMiss && cares > bestCares)) { best = i; bestMiss = miss; bestCares = cares; }
  });
  return best;
}

// What to draw in each cell: for the cell whose top-left corner is floorplan
// tile (x, y), x and y from -1 (the cells round the edge), the tile to draw
// and which sheet: the room floor's or the tunnel floor's (a cell with any
// tunnel corner and no room floor or door). -1: nothing (deep rock).
export type CellArt = { w: number; h: number; tile: Int16Array; tunnel: Uint8Array }; // w = fp.w + 1, indexed (y + 1) * w + (x + 1)
export function cellArt(fp: Floorplan): CellArt {
  const corner = cornerTerrain(fp);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= fp.w || y >= fp.h ? UPPER : corner[y * fp.w + x]);
  const kind = (x: number, y: number) => (x < 0 || y < 0 || x >= fp.w || y >= fp.h ? ROCK : fp.tiles[y * fp.w + x]);
  const W = fp.w + 1, H = fp.h + 1;
  const tile = new Int16Array(W * H).fill(-1), tunnel = new Uint8Array(W * H);
  // Rock is drawn (as a wall's top) only within a tile of somewhere walkable.
  const nearOpen = (x: number, y: number) => {
    for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 2; dx++) if (kind(x + dx, y + dy) !== ROCK) return true;
    return false;
  };
  const around = new Array<number>(16);
  for (let cy = -1; cy < fp.h; cy++) for (let cx = -1; cx < fp.w; cx++) {
    if (!nearOpen(cx, cy)) continue;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) around[r * 4 + c] = at(cx - 1 + c, cy - 1 + r);
    const i = (cy + 1) * W + cx + 1;
    tile[i] = pickTile(around);
    const own = [kind(cx, cy), kind(cx + 1, cy), kind(cx, cy + 1), kind(cx + 1, cy + 1)];
    tunnel[i] = own.includes(TUNNEL) && own.every((k) => k === TUNNEL || k === ROCK) ? 1 : 0; // (doors: the room's floor)
  }
  return { w: W, h: H, tile, tunnel };
}

// Facing, from a step: the way you're mostly going (straight up or down
// wins a tie, so diagonals in a room look like walking up or down it).
export type Facing = "south" | "east" | "north" | "west";
export const FACINGS: Facing[] = ["south", "east", "north", "west"]; // the rows of a hero sheet
export function facingOf(dx: number, dy: number, was: Facing = "south"): Facing {
  if (dx === 0 && dy === 0) return was;
  if (Math.abs(dy) >= Math.abs(dx)) return dy > 0 ? "south" : "north";
  return dx > 0 ? "east" : "west";
}

// Turning as you walk (the user, 2026-11-14: walking diagonally, you flickered between two views every
// frame, as each frame's little step was a bit more one way, then the other). The way you face follows
// your heading smoothed over about FACING_SMOOTH tiles of walking (smoothHeading), and turns from an
// up/down view to a side one (or back) only once that heading is clearly past the diagonal: its bigger
// way FACING_LEAN times the other at least (about 36°). Turning right round is straight away.
export const FACING_SMOOTH = 0.4;  // tiles 🧪
export const FACING_LEAN = 1.35;   // 🧪
const OPPOSITE: Record<Facing, Facing> = { south: "north", north: "south", east: "west", west: "east" };
export function smoothHeading(h: { x: number; y: number }, dx: number, dy: number): { x: number; y: number } {
  const d = Math.hypot(dx, dy);
  if (d === 0) return h;
  const a = Math.min(1, d / FACING_SMOOTH);
  return { x: h.x * (1 - a) + (dx / d) * a, y: h.y * (1 - a) + (dy / d) * a };
}
export function turnTo(dx: number, dy: number, was: Facing): Facing {
  const next = facingOf(dx, dy, was);
  if (next === was || next === OPPOSITE[was]) return next;
  return Math.max(Math.abs(dx), Math.abs(dy)) >= Math.min(Math.abs(dx), Math.abs(dy)) * FACING_LEAN ? next : was;
}

// The frame of a walk cycle `frames` long after walking `tiles` tiles, a
// stride every STRIDE tiles; standing still is frame -1 (the standing pose).
export const STRIDE = 1.5; // tiles per walk cycle
export function walkFrame(tiles: number, moving: boolean, frames: number): number {
  return moving ? Math.floor(((tiles % STRIDE) / STRIDE) * frames) % frames : -1;
}

// Things that stand up, drawn lowest on screen last (by where they touch the
// floor, in tiles), so what's nearer the viewer is in front. Ties: left first.
export type Standing = { y: number; x: number };
export const drawOrder = <T extends Standing>(things: T[]): T[] => [...things].sort((a, b) => a.y - b.y || a.x - b.x);

// A little depth (2.5D) on top of the flat sheets, drawn by the lab:
// - Side walls show their inner face, more the further across the room you
//   are from them (seen from the right, a room's left wall shows its face):
//   sideFace, in tiles across.
// - South walls stand up: a room's bottom wall is drawn raised by WALL_LIFT,
//   over the floor's bottom row, so you can be hidden behind it; close to it,
//   it goes see-through (capFade) so you're never lost behind a wall.
export const SIDE_FACE_RATE = 0.06; // tiles of face per tile you're across from it (🧪)
export const SIDE_FACE_MAX = 0.4;   // tiles (🧪)
export const WALL_LIFT = 0.5;       // tiles a south wall stands up over the floor (🧪)
export const CAP_SEE = 1.6;         // tiles: this close behind a south wall, it's at its faintest
export const CAP_CLEAR = 3;         // tiles: from here, it's solid
export const CAP_FAINT = 0.35;      // how solid it is at its faintest

// How wide a side wall's face shows: `across` is how far you (the camera's
// middle) are from the wall's edge, into the room (≤ 0: you can't see it).
export const sideFace = (across: number) => Math.max(0, Math.min(SIDE_FACE_MAX, across * SIDE_FACE_RATE));

// How solid a raised south wall's piece is, `d` tiles from you (behind it or not).
export function capFade(d: number): number {
  if (d <= CAP_SEE) return CAP_FAINT;
  if (d >= CAP_CLEAR) return 1;
  return CAP_FAINT + ((1 - CAP_FAINT) * (d - CAP_SEE)) / (CAP_CLEAR - CAP_SEE);
}

// The sheet tiles the depth is drawn with: a plain wall face, and a plain wall top.
export const FACE_TILE = pickTile([UPPER, UPPER, UPPER, UPPER, UPPER, UPPER, UPPER, UPPER, CLIFF, CLIFF, CLIFF, CLIFF, LOWER, LOWER, LOWER, LOWER]);
export const TOP_TILE = pickTile(new Array<number>(16).fill(UPPER));

// The wall edges a floorplan's depth is drawn along: side walls (rock with
// walkable to its right, "left" walls, or to its left, "right" walls) and
// south walls (rock with walkable right above). Each as the rock tile.
export type DepthEdges = { left: { x: number; y: number }[]; right: { x: number; y: number }[]; south: { x: number; y: number }[] };
export function depthEdges(fp: Floorplan): DepthEdges {
  const open = (x: number, y: number) => x >= 0 && y >= 0 && x < fp.w && y < fp.h && fp.tiles[y * fp.w + x] !== ROCK;
  const out: DepthEdges = { left: [], right: [], south: [] };
  for (let y = 0; y < fp.h; y++) for (let x = 0; x < fp.w; x++) {
    if (open(x, y)) continue;
    if (open(x + 1, y)) out.left.push({ x, y });
    if (open(x - 1, y)) out.right.push({ x, y });
    if (open(x, y - 1)) out.south.push({ x, y });
  }
  return out;
}
