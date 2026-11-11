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

// ── The rickety table (world version 12, the user, 2026-11-11): a top slab on four legs, PixelLab's
// faces as the chest's (48 a unit, square on screen), as big as the chest (1.25 × 0.79 u: room on top
// for a candle and the deck), in the dungeon's palette and styled on the chest's faces. The front picture
// is the whole table seen from the front (the 2D view's picture of it): its edge band is the slab's front
// and sides, a front leg's column every leg, and what's below the slab (the cross brace, see-through
// between) stands between the front legs and the back ones. The deck of cards lies on top, face down,
// to one side, a candle (if there is one) to the other.
export const TABLE_V = 2;
export const TABLE_FACES = {
  front: { src: `/sprites/props/table3d/front.png?v=${TABLE_V}`, w: 60, h: 20, edge: [0, 5], leg: { x: [2, 8], y: [5, 20] }, across: [0, 60] },
  top: { src: `/sprites/props/table3d/top.png?v=${TABLE_V}`, w: 60, h: 33 },
  deck: { src: `/sprites/props/table3d/deck.png?v=${TABLE_V}`, w: 16, h: 20 },
};
export const DECK_TALL = 0.05; // u: the deck's thickness
export const LEG_IN = 2 / ART_PER_U; // u: each leg in from the slab's end (as the front picture has it)
export const DECK_AT = 0.28;         // u: the deck, right of the table's middle
export const CANDLE_AT = -0.3;       // u: a candle on a table, left of its middle (WalkView3D)
export function tableArt() {
  const F = TABLE_FACES, up = ART_PER_U * Math.cos(ART_PITCH), flat = ART_PER_U * Math.sin(ART_PITCH);
  const slab = (F.front.edge[1] - F.front.edge[0]) / up, legs = (F.front.leg.y[1] - F.front.leg.y[0]) / up;
  return {
    width: (F.front.across[1] - F.front.across[0]) / ART_PER_U, depth: F.top.h / flat, slab, legs, top: slab + legs,
    leg: (F.front.leg.x[1] - F.front.leg.x[0]) / ART_PER_U,
    deck: { width: F.deck.w / ART_PER_U, depth: F.deck.h / flat },
  };
}
// The glow of the rarest card in a deck lying on a table (the user, 2026-11-11): its rarity's colour, out
// to half a candle's reach, half as bright.
export const DECK_GLOW = { share: 0.5, strength: 0.5 };

// ── In the game (the user, 2026-11-11: "getting the 3d items into the dungeon") ──
// Which objects the walk view draws in 3D instead of their flat pictures. Every chest is the treasure
// chest for now (the user, 2026-11-11): a storehouse's rickety one, and a mini boss's or boss's loot,
// till they get their own painted faces.
// A cards room's deck is drawn on a table (the user, 2026-11-11), in runs of every world version.
export type Prop3DKind = "chest" | "stash" | "bookcase" | "table";
export const PROPS_3D: Record<string, Prop3DKind> = { chest: "chest", "rickety-chest": "chest", "loot-chest": "chest", sack: "stash", "loot-sack": "stash", bookcase: "bookcase", table: "table", "card-deck": "table" };
export const prop3dOf = (def: string): Prop3DKind | undefined => PROPS_3D[def];

