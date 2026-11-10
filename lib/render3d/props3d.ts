// lib/render3d/props3d.ts — 🧪 drafts of more things built in 3D, after the chest (chest3d.ts), for
// /lab/chest (the user, 2026-11-11): a library's bookcase and a stash's sack. Nothing in the game
// uses them yet. Units as chest3d.ts: x across, y up, z towards you; standing on y = 0, centred.

import { ART_PER_U, ART_PITCH } from "./chest3d";

// ── The bookcase: one box with PixelLab's flat faces, drawn square on screen at 48 a unit (as the
// chest's), so its size comes from the pictures: 1.25 wide, 2 tall, 0.5 deep. As tall as you look (the
// user, 2026-11-11: "at least our character high"): your sprite is drawn stretched to stand up, so on
// screen you're as tall as a thing about 2 units high, nearly a wall (the object's 1.4 is shorter).
export const BOOKCASE_V = 2; // (a new address when a picture changes: browsers keep sprites up to an hour)
export const BOOKCASE_FACES = {
  front: { src: `/sprites/props/bookcase3d/front.png?v=${BOOKCASE_V}`, w: 60, h: 48 },
  side: { src: `/sprites/props/bookcase3d/side.png?v=${BOOKCASE_V}`, w: 24, h: 48 },
  top: { src: `/sprites/props/bookcase3d/top.png?v=${BOOKCASE_V}`, w: 60, h: 21 },
};
export function bookcaseArt() {
  const F = BOOKCASE_FACES, up = ART_PER_U * Math.cos(ART_PITCH), flat = ART_PER_U * Math.sin(ART_PITCH);
  return { width: F.front.w / ART_PER_U, height: F.front.h / up, depth: F.top.h / flat };
}

// ── The sack: a bag's outline (radius, height) turned round its middle, with few sides so it stays
// chunky, like pixel art; a rope tied round its neck. 0.6 tall, as the object is.
export const SACK_SIDES = 8;       // 🧪 faces round it
export const SACK_TALL = 0.6;
export const SACK_V = 1;
export const SACK_CLOTH = { src: `/sprites/props/sack3d/burlap.png?v=${SACK_V}`, w: 48, h: 48 };
// From the bottom up: the base, the belly, in to the neck where it's tied, and the tuft above the tie.
const SACK_OUTLINE: [number, number][] = [
  [0, 0], [0.2, 0.005], [0.3, 0.08], [0.33, 0.2], [0.31, 0.31], [0.24, 0.4], [0.13, 0.46],
  [0.07, 0.49], [0.08, 0.52], [0.13, 0.57], [0.1, 0.6], [0, 0.59],
];
export const SACK_NECK = { y: 0.49, r: 0.075, rope: 0.022 }; // where the rope's tied, and its thickness
export const sackOutline = (): [number, number][] => SACK_OUTLINE.map(([r, y]) => [r, y]);

// Opened, the sack's neck is untied: the outline stops at the neck and flares a little into an open
// mouth (no tuft, no rope), so you can see it's been gone through, as the flat open picture showed.
const SACK_OPEN_OUTLINE: [number, number][] = [...SACK_OUTLINE.slice(0, 8), [0.11, 0.53], [0.13, 0.55]];
export const sackOpenOutline = (): [number, number][] => SACK_OPEN_OUTLINE.map(([r, y]) => [r, y]);

// ── In the game (the user, 2026-11-11: "getting the 3d items into the dungeon") ──
// Which objects the walk view draws in 3D instead of their flat pictures. The rickety chests (a
// mini boss's or boss's loot, and the rickety ones) stay flat: their look isn't the treasure chest's,
// and they'd need their own painted faces.
export type Prop3DKind = "chest" | "stash" | "bookcase";
export const PROPS_3D: Record<string, Prop3DKind> = { chest: "chest", sack: "stash", "loot-sack": "stash", bookcase: "bookcase" };
export const prop3dOf = (def: string): Prop3DKind | undefined => PROPS_3D[def];

// Where one stands: in the middle of its footprint (lib/world/grid.ts footprintCells: an even depth
// reaches one subcell further back than forward), so its box sits on the floor it takes up.
export function propSpot(t: { x: number; y: number }, footprint: { w: number; d: number }, subcells: number): { x: number; z: number } {
  const off = (n: number) => (n % 2 ? 0 : -0.5 / subcells);
  return { x: t.x + off(footprint.w), z: t.y + off(footprint.d) };
}
